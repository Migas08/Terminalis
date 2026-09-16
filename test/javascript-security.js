/* Fase 1 do runner JS: testes de segurança do protocolo e da fronteira.

   Aqui provamos, sem navegador, que:
     · o protocolo recusa poluição de protótipo, valores não serializáveis e
       mensagens gigantes;
     · capabilities (rede, fs, objetos do app) são negadas por padrão — código do
       aluno não alcança LX, fetch, process, require, window nem document;
     · a fonte real do Worker pode ser encerrada por quem a hospeda (o coordenador
       faz isso via terminate no timeout).

   O escape de realm em si (parent DOM, storage do navegador) é validado por
   Playwright na fase do navegador; aqui o contexto vm cumpre o papel da fronteira. */
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadEngine } = require('./harness');

const LX = loadEngine();
const P = LX.JS.Protocol;
const SOURCE = LX.JS.Sandbox.WORKER_SOURCE;

function nodeVmTransport() {
  return {
    open(sessionId, onMessage) {
      let listener = null, dead = false;
      const self = {
        postMessage(data) { if (!dead) onMessage(JSON.parse(JSON.stringify(data))); },
        addEventListener(type, fn) { if (type === 'message') listener = fn; },
        close() { dead = true; }
      };
      // Só TextEncoder é injetado; Function/Object/Error/JSON etc. vêm do próprio
      // contexto vm, para que `new Function` do Worker crie código do aluno no
      // escopo isolado do contexto e não no realm do Node (sem fetch/process).
      const sandbox = { self, TextEncoder };
      sandbox.globalThis = sandbox;
      vm.createContext(sandbox);
      vm.runInContext(SOURCE, sandbox, { filename: 'worker.js' });
      return {
        post(command) { if (!dead && listener) listener({ data: JSON.parse(JSON.stringify(command)) }); },
        terminate() { dead = true; listener = null; }
      };
    }
  };
}

function runProgram(source, limits) {
  const runner = LX.JS.createRunner({ transport: nodeVmTransport(), limits });
  const events = [];
  runner.subscribe(e => events.push(e));
  const sid = runner.createSession();
  runner.putFiles(sid, { 'main.js': source });
  runner.run(sid, 'main.js');
  runner.disposeAll();
  return events;
}

(async () => {
  /* ---------------------- protocolo: poluição de protótipo ---------------------- */
  // JSON.parse cria "__proto__" como chave PRÓPRIA (o vetor real vindo do canal),
  // ao contrário do literal { __proto__: ... }, que só troca o protótipo.
  assert.throws(() => P.validateCommand(JSON.parse('{"type":"run","a":{"__proto__":{"x":1}}}')), /proibida/);
  assert.throws(() => P.assertSerializable({ constructor: 1 }), /proibida/);
  assert.throws(() => P.assertNoPollution({ nested: { prototype: {} } }), /proibida/);
  // Um objeto criado por JSON com "__proto__" literal carrega a chave própria.
  assert.throws(() => P.assertNoPollution(JSON.parse('{"__proto__": {"x": 1}}')), /proibida/);
  assert.equal({}.x, undefined, 'o protótipo global não foi poluído pelos testes');

  /* ---------------------- protocolo: valores não serializáveis ---------------------- */
  assert.throws(() => P.makeEvent('console', { sessionId: 's' }, { fn: () => {} }), /não serializável/);
  assert.throws(() => P.makeEvent('console', { sessionId: 's' }, { n: Infinity }), /não finito/);
  assert.throws(() => P.makeEvent('console', { sessionId: 's' }, { e: new Error('x') }), /não serializável/);
  assert.throws(() => P.makeEvent('inexistente', { sessionId: 's' }, {}), /desconhecido/);

  /* ---------------------- protocolo: mensagem gigante ---------------------- */
  const gigante = 'x'.repeat(P.LIMITS.MESSAGE_BYTES + 10);
  assert.throws(() => P.makeEvent('console', { sessionId: 's' }, { text: gigante }), /tamanho máximo/);
  assert.throws(() => P.validateCommand({ type: 'run', blob: gigante }), /tamanho máximo/);

  /* ---------------------- protocolo: comando desconhecido ---------------------- */
  assert.throws(() => P.validateCommand({ type: 'evil' }), /desconhecido/);
  assert.throws(() => P.validateCommand(null), /objeto/);

  /* ---------------------- runner: arquivos com chave proibida ---------------------- */
  {
    const runner = LX.JS.createRunner({ transport: nodeVmTransport() });
    const sid = runner.createSession();
    assert.throws(() => runner.putFiles(sid, JSON.parse('{"__proto__": "x"}')), /proibida/);
    assert.throws(() => runner.putFiles(sid, { 'a.js': 123 }), /texto/);
    runner.disposeAll();
  }

  /* ---------------------- capabilities negadas por padrão ----------------------
     Código do aluno não enxerga o app nem a rede. typeof não lança, então
     conferimos que tudo é 'undefined'. */
  {
    const events = runProgram(
      "console.log(typeof LX, typeof fetch, typeof XMLHttpRequest, typeof process, typeof require, typeof window, typeof document, typeof localStorage);"
    );
    const line = events.find(e => e.type === 'console');
    assert.ok(line, 'houve saída de console');
    assert.equal(line.payload.text, 'undefined undefined undefined undefined undefined undefined undefined undefined',
      'nenhum objeto do app, rede ou storage está acessível');
  }

  /* Chamar a rede diretamente é um ReferenceError controlado, não uma conexão. */
  {
    const events = runProgram("fetch('https://exemplo.com');");
    const err = events.find(e => e.type === 'uncaught-error');
    assert.ok(err, 'fetch negado gera uncaught-error');
    assert.match(err.payload.name, /ReferenceError/);
    assert.equal(events.filter(e => e.type === 'run-complete').length, 1);
  }

  /* Tentar alcançar a ponte do Worker (postMessage/self) também falha: os nomes
     são sombreados na função do aluno. */
  {
    const events = runProgram("postMessage({ type: 'run-complete', runId: 'falso' });");
    const err = events.find(e => e.type === 'uncaught-error');
    assert.ok(err, 'postMessage não está acessível ao aluno');
    assert.match(err.payload.name, /TypeError|ReferenceError/);
  }

  /* ---------------------- prova de que a sandbox é encerrável ----------------------
     A fonte do Worker roda um laço infinito de verdade; o host a aborta pelo
     timeout do vm, como o coordenador faz com Worker.terminate() no estouro. */
  {
    let registered = null;
    const self = {
      postMessage() {},
      addEventListener(type, fn) { if (type === 'message') registered = fn; },
      close() {}
    };
    const sandbox = { self, TextEncoder };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, { filename: 'worker.js' });
    assert.ok(registered, 'a fonte do Worker registrou seu listener');
    sandbox._deliver = msg => registered({ data: msg });
    const loop = new vm.Script(
      "_deliver({ type: 'run', runId: 'r', entrypoint: 'loop.js', files: { 'loop.js': 'while (true) {}' } });"
    );
    assert.throws(() => loop.runInContext(sandbox, { timeout: 200 }), /timed out|Script execution/i,
      'o laço infinito é interrompido pelo host');
  }

  console.log('JavaScript security: poluição, não-serializável, mensagem gigante, capabilities negadas e sandbox encerrável passaram.');
})().catch(error => { console.error(error); process.exitCode = 1; });
