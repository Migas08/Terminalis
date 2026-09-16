/* Protocolo do runner JavaScript/TypeScript do Terminalis.

   Este módulo NÃO executa código do aluno e NÃO acessa o DOM. Ele define o
   contrato entre a aplicação (LX) e a sandbox: nomes de eventos e comandos,
   limites numéricos, geração de identificadores e — o mais importante — as
   funções que garantem que só passe pelo canal dado serializável. Nunca deve
   trafegar Error cru, nó de DOM, função ou objeto interno do LX.

   O runner (39-js-runner.js) e a sandbox (39-js-sandbox.js) dependem daqui, por
   isso o prefixo 39 vem antes deles e depois do VFS/rede que eventualmente serão
   expostos como capabilities. */
'use strict';
(function () {
  const JS = (LX.JS = LX.JS || {});

  /* Eventos que o coordenador emite para os assinantes. Todo evento carrega
     sessionId, runId, seq (relógio lógico monotônico) e um payload serializável. */
  const EVENTS = Object.freeze({
    RUN_START: 'run-start',
    CONSOLE: 'console',
    DIAGNOSTIC: 'diagnostic',
    TEST_START: 'test-start',
    TEST_RESULT: 'test-result',
    UNCAUGHT_ERROR: 'uncaught-error',
    UNHANDLED_REJECTION: 'unhandled-rejection',
    RUN_TIMEOUT: 'run-timeout',
    RUN_CANCELLED: 'run-cancelled',
    RUN_COMPLETE: 'run-complete',
    OUTPUT_LIMIT: 'output-limit',
    MODULE_LOADED: 'module-loaded',
    LIFECYCLE: 'lifecycle'
  });

  /* Comandos que a aplicação envia para dentro da sandbox. */
  const COMMANDS = Object.freeze({
    INIT: 'init',
    RUN: 'run',
    RUN_TESTS: 'run-tests',
    CANCEL: 'cancel',
    DISPOSE: 'dispose'
  });

  const CONSOLE_LEVELS = Object.freeze(['log', 'info', 'warn', 'error', 'debug']);

  /* Limites deliberadamente conservadores. São o teto de segurança: saída,
     tamanho de mensagem, profundidade de inspeção, número e tamanho de arquivos e
     o tempo de uma execução antes do encerramento forçado. */
  const LIMITS = Object.freeze({
    OUTPUT_BYTES: 256 * 1024,
    MESSAGE_BYTES: 1024 * 1024,
    INSPECT_DEPTH: 6,
    INSPECT_ITEMS: 100,
    STRING_LEN: 10000,
    RUN_TIMEOUT_MS: 5000,
    MAX_FILES: 200,
    MAX_FILE_BYTES: 512 * 1024,
    MAX_PATH_LEN: 1024
  });

  /* Chaves proibidas em qualquer profundidade: barram prototype pollution vinda
     de um payload malicioso do canal. */
  const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

  function byteLength(text) {
    // TextEncoder existe no navegador, no Worker e no Node moderno.
    return typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(text).length
      : unescape(encodeURIComponent(text)).length;
  }

  /* Inspeção legível de valores para o console: à prova de ciclos, com limite de
     profundidade, de itens e de tamanho de string. Nunca lança e nunca devolve o
     objeto original — só uma string. */
  function inspect(value, opts) {
    const depthMax = (opts && opts.depth) || LIMITS.INSPECT_DEPTH;
    const itemMax = (opts && opts.items) || LIMITS.INSPECT_ITEMS;
    const strMax = (opts && opts.stringLen) || LIMITS.STRING_LEN;
    const seen = new Set();

    function clip(text) {
      return text.length > strMax ? text.slice(0, strMax) + '… (truncado)' : text;
    }

    function walk(node, depth) {
      const type = typeof node;
      if (node === null) return 'null';
      if (type === 'undefined') return 'undefined';
      if (type === 'string') return depth === 0 ? clip(node) : JSON.stringify(clip(node));
      if (type === 'number' || type === 'boolean') return String(node);
      if (type === 'bigint') return String(node) + 'n';
      if (type === 'symbol') return node.toString();
      if (type === 'function') return '[Function: ' + (node.name || 'anônima') + ']';
      if (node instanceof Error) return node.name + ': ' + clip(String(node.message));
      if (depth >= depthMax) return Array.isArray(node) ? '[Array]' : '[Object]';
      if (seen.has(node)) return '[Circular]';
      seen.add(node);
      try {
        if (Array.isArray(node)) {
          const parts = node.slice(0, itemMax).map(item => walk(item, depth + 1));
          if (node.length > itemMax) parts.push('… +' + (node.length - itemMax) + ' itens');
          return '[' + parts.join(', ') + ']';
        }
        if (node instanceof Map) {
          const parts = [];
          for (const [k, v] of node) {
            if (parts.length >= itemMax) { parts.push('…'); break; }
            parts.push(walk(k, depth + 1) + ' => ' + walk(v, depth + 1));
          }
          return 'Map(' + node.size + ') {' + parts.join(', ') + '}';
        }
        if (node instanceof Set) {
          const parts = [];
          for (const v of node) {
            if (parts.length >= itemMax) { parts.push('…'); break; }
            parts.push(walk(v, depth + 1));
          }
          return 'Set(' + node.size + ') {' + parts.join(', ') + '}';
        }
        const keys = Object.keys(node);
        const parts = keys.slice(0, itemMax).map(k => {
          const label = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
          return label + ': ' + walk(node[k], depth + 1);
        });
        if (keys.length > itemMax) parts.push('… +' + (keys.length - itemMax) + ' chaves');
        const ctor = node.constructor && node.constructor.name;
        const prefix = ctor && ctor !== 'Object' ? ctor + ' ' : '';
        return prefix + '{' + parts.join(', ') + '}';
      } finally {
        seen.delete(node);
      }
    }
    try {
      return walk(value, 0);
    } catch (_) {
      return '[valor não inspecionável]';
    }
  }

  /* Garante que um valor é seguro para atravessar o canal: só primitivos JSON,
     arrays e objetos simples, sem chaves proibidas e dentro do limite de bytes.
     Devolve uma cópia limpa. Lança em qualquer coisa fora disso. É a rede de
     segurança usada ao montar todo evento de saída. */
  function assertSerializable(value, depth) {
    depth = depth || 0;
    if (depth > 100) throw new Error('Payload excede a profundidade permitida.');
    if (value === null) return null;
    const type = typeof value;
    if (type === 'boolean') return value;
    if (type === 'number') { if (!Number.isFinite(value)) throw new Error('Número não finito no payload.'); return value; }
    if (type === 'string') return value;
    if (type === 'undefined' || type === 'function' || type === 'symbol' || type === 'bigint') {
      throw new Error('Valor não serializável no payload: ' + type + '.');
    }
    if (Array.isArray(value)) return value.map(item => assertSerializable(item, depth + 1));
    const tag = Object.prototype.toString.call(value);
    if (tag !== '[object Object]') throw new Error('Objeto não serializável no payload: ' + tag + '.');
    // Plainness pela PROFUNDIDADE da cadeia de protótipos, não por comparação com
    // um Object.prototype específico: literais criados em outro realm (o vm dos
    // testes injeta um Object externo) têm um Object.prototype diferente, então a
    // comparação direta falharia. Um objeto simples tem protótipo nulo ou cujo
    // próprio protótipo é nulo; uma instância de classe tem a cadeia mais longa.
    // Também não usa value.constructor, para uma chave própria "constructor" não
    // mascarar a checagem — ela é barrada como poluição logo abaixo.
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && Object.getPrototypeOf(proto) !== null) {
      throw new Error('Instância não serializável no payload.');
    }
    const out = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) throw new Error('Chave proibida no payload: ' + key + '.');
      out[key] = assertSerializable(value[key], depth + 1);
    }
    return out;
  }

  /* Rejeita chaves proibidas em qualquer profundidade de uma mensagem de entrada,
     sem exigir que ela seja totalmente serializável (o comando pode carregar
     strings grandes de arquivo). */
  function assertNoPollution(value, depth) {
    depth = depth || 0;
    if (depth > 100) throw new Error('Comando excede a profundidade permitida.');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(item => assertNoPollution(item, depth + 1)); return; }
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) throw new Error('Chave proibida no comando: ' + key + '.');
      assertNoPollution(value[key], depth + 1);
    }
  }

  /* Valida um comando de entrada: objeto simples, tipo conhecido, sem poluição de
     protótipo e dentro do limite de tamanho. Devolve o próprio comando. */
  function validateCommand(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new Error('Comando inválido: esperado objeto.');
    }
    if (typeof message.type !== 'string' || !Object.values(COMMANDS).includes(message.type)) {
      throw new Error('Comando desconhecido.');
    }
    assertNoPollution(message);
    let size;
    try { size = byteLength(JSON.stringify(message)); }
    catch (_) { throw new Error('Comando não serializável.'); }
    if (size > LIMITS.MESSAGE_BYTES) throw new Error('Comando excede o tamanho máximo de mensagem.');
    return message;
  }

  let counter = 0;
  function newId(prefix) {
    counter = (counter + 1) >>> 0;
    let random;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(6);
      crypto.getRandomValues(buf);
      random = Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
    } else {
      random = Math.random().toString(16).slice(2, 14);
    }
    return (prefix || 'id') + '_' + counter.toString(36) + random;
  }

  /* Monta um evento de saída já validado. O payload é sanitizado (cópia limpa) e o
     tamanho total é conferido contra MESSAGE_BYTES. */
  function makeEvent(type, meta, payload) {
    if (!Object.values(EVENTS).includes(type)) throw new Error('Tipo de evento desconhecido: ' + type + '.');
    const event = {
      type,
      sessionId: String((meta && meta.sessionId) || ''),
      runId: (meta && meta.runId != null) ? String(meta.runId) : null,
      seq: (meta && Number.isInteger(meta.seq)) ? meta.seq : 0,
      at: (meta && Number.isFinite(meta.at)) ? meta.at : 0,
      payload: assertSerializable(payload == null ? {} : payload)
    };
    const size = byteLength(JSON.stringify(event));
    if (size > LIMITS.MESSAGE_BYTES) throw new Error('Evento excede o tamanho máximo de mensagem.');
    return event;
  }

  JS.Protocol = {
    EVENTS, COMMANDS, CONSOLE_LEVELS, LIMITS, FORBIDDEN_KEYS,
    byteLength, inspect, assertSerializable, assertNoPollution,
    validateCommand, newId, makeEvent
  };
})();
