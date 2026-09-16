/* Sandbox do runner JavaScript.

   Duas partes:
     · WORKER_SOURCE — o script, como STRING, que roda dentro do Worker. A mesma
       fonte é usada em produção (Blob -> Worker dentro de um iframe sandbox) e nos
       testes (executada em um contexto isolado do Node). Executar código do aluno
       aqui é seguro porque isto NÃO é o realm da aplicação: em produção é um Worker
       dentro de um iframe `sandbox="allow-scripts"` sem `allow-same-origin`, de
       origem opaca; no Node é um contexto `vm` sem acesso ao LX.
     · createBrowserTransport — monta essa fronteira no navegador e fala com o
       coordenador (39-js-runner.js) pelo contrato open/post/terminate.

   O código dentro de WORKER_SOURCE é propositalmente autocontido: ele não pode
   importar nada do LX (esse é justamente o ponto do isolamento). A inspeção de
   console é uma versão compacta da que existe no protocolo. */
'use strict';
(function () {
  const JS = (LX.JS = LX.JS || {});

  const WORKER_SOURCE = [
    "'use strict';",
    "(function () {",
    "  var post = (self && self.postMessage) ? self.postMessage.bind(self) : function () {};",
    "  var LIMITS = { OUTPUT_BYTES: 262144, STRING_LEN: 10000, INSPECT_DEPTH: 6, INSPECT_ITEMS: 100 };",
    "  var files = {};",
    "  var PARAMS = 'console, self, postMessage, onmessage, globalThis, importScripts, close';",
    "  var PROLOGUE = '\"use strict\";\\n';",
    "  var OFFSET = null;",
    "  function wrapperOffset() {",
    "    if (OFFSET !== null) return OFFSET;",
    "    OFFSET = 0;",
    "    try { new Function(PARAMS, PROLOGUE + 'throw new Error(\"p\");\\n//# sourceURL=__lx_probe__')(); }",
    "    catch (e) { if (e && e.stack) { var m = String(e.stack).match(/__lx_probe__:(\\d+):/); if (m) OFFSET = Number(m[1]) - 1; } }",
    "    return OFFSET;",
    "  }",
    "  function byteLen(t) { try { return new TextEncoder().encode(t).length; } catch (e) { return t.length; } }",
    "  function clip(t) { return t.length > LIMITS.STRING_LEN ? t.slice(0, LIMITS.STRING_LEN) + '\\u2026 (truncado)' : t; }",
    "  function inspect(value) {",
    "    var seen = [];",
    "    function walk(node, depth) {",
    "      var type = typeof node;",
    "      if (node === null) return 'null';",
    "      if (type === 'undefined') return 'undefined';",
    "      if (type === 'string') return depth === 0 ? clip(node) : JSON.stringify(clip(node));",
    "      if (type === 'number' || type === 'boolean') return String(node);",
    "      if (type === 'bigint') return String(node) + 'n';",
    "      if (type === 'symbol') return node.toString();",
    "      if (type === 'function') return '[Function: ' + (node.name || 'anonima') + ']';",
    "      if (node instanceof Error) return node.name + ': ' + clip(String(node.message));",
    "      if (depth >= LIMITS.INSPECT_DEPTH) return Array.isArray(node) ? '[Array]' : '[Object]';",
    "      if (seen.indexOf(node) !== -1) return '[Circular]';",
    "      seen.push(node);",
    "      try {",
    "        if (Array.isArray(node)) {",
    "          var parts = [];",
    "          for (var i = 0; i < node.length && i < LIMITS.INSPECT_ITEMS; i++) parts.push(walk(node[i], depth + 1));",
    "          if (node.length > LIMITS.INSPECT_ITEMS) parts.push('\\u2026 +' + (node.length - LIMITS.INSPECT_ITEMS) + ' itens');",
    "          return '[' + parts.join(', ') + ']';",
    "        }",
    "        var keys = Object.keys(node), out = [];",
    "        for (var k = 0; k < keys.length && k < LIMITS.INSPECT_ITEMS; k++) {",
    "          var label = /^[A-Za-z_$][\\w$]*$/.test(keys[k]) ? keys[k] : JSON.stringify(keys[k]);",
    "          out.push(label + ': ' + walk(node[keys[k]], depth + 1));",
    "        }",
    "        if (keys.length > LIMITS.INSPECT_ITEMS) out.push('\\u2026 +' + (keys.length - LIMITS.INSPECT_ITEMS) + ' chaves');",
    "        var ctor = node.constructor && node.constructor.name;",
    "        var prefix = ctor && ctor !== 'Object' ? ctor + ' ' : '';",
    "        return prefix + '{' + out.join(', ') + '}';",
    "      } finally { seen.pop(); }",
    "    }",
    "    try { return walk(value, 0); } catch (e) { return '[valor nao inspecionavel]'; }",
    "  }",
    "  function formatArgs(args) {",
    "    var parts = [];",
    "    for (var i = 0; i < args.length; i++) parts.push(inspect(args[i]));",
    "    return parts.join(' ');",
    "  }",
    "  function makeConsole(runId, state) {",
    "    function sink(level) {",
    "      return function () {",
    "        if (state.stopped) return;",
    "        var text = formatArgs(Array.prototype.slice.call(arguments));",
    "        state.bytes += byteLen(text);",
    "        if (state.bytes > LIMITS.OUTPUT_BYTES) { state.stopped = true; post({ type: 'output-limit', runId: runId, kind: 'console' }); return; }",
    "        post({ type: 'console', runId: runId, level: level, text: text });",
    "      };",
    "    }",
    "    return { log: sink('log'), info: sink('info'), warn: sink('warn'), error: sink('error'), debug: sink('debug') };",
    "  }",
    "  function locate(error, entry) {",
    "    var info = { name: 'Error', message: String(error), stack: null, line: null, column: null, file: entry };",
    "    if (error && typeof error === 'object') {",
    "      info.name = String(error.name || 'Error');",
    "      info.message = String(error.message == null ? error : error.message);",
    "      if (error.stack) info.stack = String(error.stack);",
    "      if (typeof error.lineNumber === 'number') info.line = error.lineNumber - wrapperOffset();",
    "      if (typeof error.columnNumber === 'number') info.column = error.columnNumber;",
    "    }",
    "    if ((info.line == null) && info.stack) {",
    "      var re = new RegExp(entry.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ':(\\\\d+):(\\\\d+)');",
    "      var m = info.stack.match(re);",
    "      if (m) { info.line = Number(m[1]) - wrapperOffset(); info.column = Number(m[2]); }",
    "    }",
    "    if (info.line != null && !(info.line > 0)) info.line = null;",
    "    return info;",
    "  }",
    "  function runFile(runId, entry) {",
    "    if (!Object.prototype.hasOwnProperty.call(files, entry)) {",
    "      post({ type: 'uncaught-error', runId: runId, error: { name: 'ResolutionError', message: 'Arquivo nao encontrado: ' + entry, file: entry } });",
    "      post({ type: 'run-complete', runId: runId, ok: false });",
    "      return;",
    "    }",
    "    var state = { bytes: 0, stopped: false };",
    "    var sandboxConsole = makeConsole(runId, state);",
    "    var source = String(files[entry]) + '\\n//# sourceURL=' + entry;",
    "    var factory;",
    "    try {",
    "      factory = new Function(PARAMS, PROLOGUE + source);",
    "    } catch (syntaxError) {",
    "      post({ type: 'uncaught-error', runId: runId, error: locate(syntaxError, entry) });",
    "      post({ type: 'run-complete', runId: runId, ok: false });",
    "      return;",
    "    }",
    "    var ok = true;",
    "    try {",
    "      factory(sandboxConsole, undefined, undefined, undefined, undefined, undefined, undefined);",
    "    } catch (runtimeError) {",
    "      ok = false;",
    "      post({ type: 'uncaught-error', runId: runId, error: locate(runtimeError, entry) });",
    "    }",
    "    post({ type: 'run-complete', runId: runId, ok: ok });",
    "  }",
    "  function handle(msg) {",
    "    if (!msg || typeof msg !== 'object') return;",
    "    if (msg.type === 'init') { if (msg.limits && typeof msg.limits === 'object') { for (var k in LIMITS) if (typeof msg.limits[k] === 'number') LIMITS[k] = msg.limits[k]; } return; }",
    "    if (msg.type === 'run') { files = (msg.files && typeof msg.files === 'object') ? msg.files : {}; runFile(String(msg.runId), String(msg.entrypoint)); return; }",
    "    if (msg.type === 'dispose') { if (self.close) self.close(); return; }",
    "  }",
    "  if (self.addEventListener) self.addEventListener('message', function (ev) { handle(ev.data); });",
    "  else self.onmessage = function (ev) { handle(ev.data); };",
    "  post({ type: 'ready' });",
    "})();"
  ].join('\n');

  /* HTML do iframe isolado. Origem opaca (sandbox sem allow-same-origin), CSP que
     só permite workers do próprio documento e nenhuma conexão de rede. O bootstrap
     cria o Worker a partir do Blob de WORKER_SOURCE e faz a ponte entre a janela
     pai e o Worker. */
  function iframeHtml() {
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      // 'unsafe-eval' é intencional e SÓ existe aqui, dentro da origem opaca do
      // iframe/Worker: é assim que o Worker compila o código do aluno (new
      // Function). Isso nunca alcança o realm principal do app. connect-src 'none'
      // mantém a rede negada; worker-src blob: permite o Worker descartável.
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' blob:; worker-src blob:; connect-src \'none\'">',
      '</head><body><script>',
      '(function(){',
      '  var src = ', JSON.stringify(WORKER_SOURCE), ';',
      '  var worker = null;',
      '  function boot(){',
      '    var blob = new Blob([src], { type: "text/javascript" });',
      '    worker = new Worker(URL.createObjectURL(blob));',
      '    worker.onmessage = function(ev){ parent.postMessage({ __sandbox: true, data: ev.data }, "*"); };',
      '  }',
      '  window.addEventListener("message", function(ev){',
      '    var msg = ev.data;',
      '    if (!msg || !msg.__sandbox) return;',
      '    if (msg.command === "post" && worker) worker.postMessage(msg.data);',
      '  });',
      '  boot();',
      '  parent.postMessage({ __sandbox: true, data: { type: "iframe-ready" } }, "*");',
      '})();',
      '<\/script></body></html>'
    ].join('');
  }

  /* Transport de navegador. Só toca em document/Worker quando chamado, então o
     carregamento no Node (sem DOM) é seguro. Cada sessão ganha seu próprio iframe;
     terminate() remove o iframe e, com ele, o Worker. */
  function createBrowserTransport(config) {
    if (typeof document === 'undefined' || typeof Worker === 'undefined') {
      throw new Error('createBrowserTransport exige um navegador com Worker.');
    }
    config = config || {};
    const host = config.host || document.body;

    function open(sessionId, onMessage) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.display = 'none';
      iframe.srcdoc = iframeHtml();
      const queue = [];
      let ready = false;

      function onWindowMessage(ev) {
        if (ev.source !== iframe.contentWindow) return;
        const msg = ev.data;
        if (!msg || !msg.__sandbox) return;
        if (msg.data && msg.data.type === 'iframe-ready') {
          ready = true;
          while (queue.length) iframe.contentWindow.postMessage({ __sandbox: true, command: 'post', data: queue.shift() }, '*');
          return;
        }
        try { onMessage(msg.data); } catch (_) { /* assinante quebrado não derruba o transport */ }
      }
      window.addEventListener('message', onWindowMessage);
      host.appendChild(iframe);

      return {
        post(command) {
          if (!ready) { queue.push(command); return; }
          iframe.contentWindow.postMessage({ __sandbox: true, command: 'post', data: command }, '*');
        },
        terminate() {
          window.removeEventListener('message', onWindowMessage);
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }
      };
    }
    return { open };
  }

  JS.Sandbox = { WORKER_SOURCE, iframeHtml, createBrowserTransport };
})();
