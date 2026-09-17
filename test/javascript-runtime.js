/* Fase 1–2 do runner JS: ciclo de vida do coordenador executando a fonte real do
   Worker (LX.JS.Sandbox.WORKER_SOURCE) dentro de um contexto isolado do Node.
   Cobre execução síncrona e, na Fase 2, assíncrona: promises, microtasks e
   timers, com a execução só terminando quando o event loop esvazia. */
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadEngine } = require('./harness');

const LX = loadEngine();
const SOURCE = LX.JS.Sandbox.WORKER_SOURCE;

/* Transport de teste: cada sessão recebe um contexto vm próprio que roda a fonte
   do Worker. Injeta timers reais do Node (não são intrínsecos do realm) para o
   event loop assíncrono funcionar; Function/Object/etc. vêm do próprio contexto,
   mantendo o código isolado do realm do Node. */
function nodeVmTransport() {
  return {
    open(sessionId, onMessage) {
      let listener = null, dead = false;
      const self = {
        postMessage(data) { if (!dead) onMessage(JSON.parse(JSON.stringify(data))); },
        addEventListener(type, fn) { if (type === 'message') listener = fn; },
        close() { dead = true; }
      };
      const sandbox = {
        self, TextEncoder,
        setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask
      };
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

/* Runner com coleta de eventos e espera assíncrona pelo fim de uma execução. */
function makeRunner(options) {
  const runner = LX.JS.createRunner(Object.assign({ transport: nodeVmTransport() }, options || {}));
  const events = [];
  let waiters = [];
  runner.subscribe(e => {
    events.push(e);
    if (e.type === 'run-complete' || e.type === 'run-timeout' || e.type === 'run-cancelled') {
      const w = waiters; waiters = []; w.forEach(fn => fn(e));
    }
  });
  runner.events = events;
  runner.of = type => events.filter(e => e.type === type);
  runner.textos = () => events.filter(e => e.type === 'console').map(e => e.payload.text);
  runner.clear = () => { events.length = 0; };
  runner.done = () => new Promise(res => waiters.push(res));
  return runner;
}

async function runFile(runner, files, entry) {
  const sid = runner.createSession();
  runner.putFiles(sid, files);
  const done = runner.done();
  const runId = runner.run(sid, entry);
  await done;
  return runId;
}

(async () => {
  /* ---------- programa "Olá": console estruturado + run-complete ---------- */
  {
    const runner = makeRunner();
    const runId = await runFile(runner, { 'main.js': "console.log('Olá', 42, { a: 1 });" }, 'main.js');
    assert.equal(runner.of('run-start').length, 1, 'um run-start');
    assert.equal(runner.of('run-start')[0].runId, runId);
    const consoles = runner.of('console');
    assert.equal(consoles.length, 1, 'uma linha de console');
    assert.equal(consoles[0].payload.text, 'Olá 42 {a: 1}');
    assert.equal(runner.of('run-complete').length, 1, 'um run-complete');
    for (let i = 1; i < runner.events.length; i++) assert.ok(runner.events[i].seq > runner.events[i - 1].seq, 'seq cresce');
    runner.disposeAll();
  }

  /* ---------- throw: erro com nome, mensagem e localização ---------- */
  {
    const runner = makeRunner();
    await runFile(runner, { 'app.js': "const x = 1;\nthrow new Error('explodiu');" }, 'app.js');
    const errs = runner.of('uncaught-error');
    assert.equal(errs.length, 1, 'um uncaught-error');
    assert.equal(errs[0].payload.name, 'Error');
    assert.equal(errs[0].payload.message, 'explodiu');
    assert.equal(errs[0].payload.line, 2, 'a linha do throw é localizada');
    assert.ok(Number.isFinite(errs[0].payload.column), 'coluna localizada');
    assert.equal(runner.of('run-complete')[0].payload.ok, false);
    runner.disposeAll();
  }

  /* ---------- syntax error: reportado como erro, não como sucesso ---------- */
  {
    const runner = makeRunner();
    await runFile(runner, { 'quebrado.js': 'function (' }, 'quebrado.js');
    assert.equal(runner.of('uncaught-error').length, 1, 'erro de sintaxe vira uncaught-error');
    assert.equal(runner.of('run-complete')[0].payload.ok, false, 'run-complete marca falha');
    runner.disposeAll();
  }

  /* ---------- limite de saída: inunda o console e recebe um único output-limit ---------- */
  {
    const runner = makeRunner({ limits: { OUTPUT_BYTES: 2048 } });
    await runFile(runner, { 'flood.js': "for (let i = 0; i < 100000; i++) console.log('linha ' + i);" }, 'flood.js');
    assert.equal(runner.of('output-limit').length, 1, 'exatamente um output-limit');
    const bytes = runner.of('console').reduce((n, e) => n + Buffer.byteLength(e.payload.text), 0);
    assert.ok(bytes <= 2048 * 2, 'saída repassada fica próxima do teto, não ilimitada');
    runner.disposeAll();
  }

  /* ---------- ASSÍNCRONO: ordem de sync, microtask e timer ---------- */
  {
    const runner = makeRunner();
    await runFile(runner, {
      'async.js': [
        "console.log('sync');",
        "Promise.resolve().then(function () { console.log('micro'); });",
        "setTimeout(function () { console.log('timer'); }, 5);",
        "console.log('fim do script');"
      ].join('\n')
    }, 'async.js');
    assert.deepEqual(runner.textos(), ['sync', 'fim do script', 'micro', 'timer'],
      'ordem: síncrono, resto do script, microtask, timer');
    // run-complete só depois do timer (o event loop foi drenado)
    const idxTimer = runner.events.findIndex(e => e.type === 'console' && e.payload.text === 'timer');
    const idxDone = runner.events.findIndex(e => e.type === 'run-complete');
    assert.ok(idxTimer < idxDone, 'run-complete só depois do timer');
    runner.disposeAll();
  }

  /* ---------- ASSÍNCRONO: async/await ---------- */
  {
    const runner = makeRunner();
    await runFile(runner, {
      'await.js': "async function main() { const v = await Promise.resolve(7); console.log('valor', v); }\nmain();"
    }, 'await.js');
    assert.deepEqual(runner.textos(), ['valor 7'], 'await resolve antes do fim');
    assert.equal(runner.of('run-complete')[0].payload.ok, true);
    runner.disposeAll();
  }

  /* ---------- ASSÍNCRONO: erro dentro de setTimeout é reportado ---------- */
  {
    const runner = makeRunner();
    await runFile(runner, { 'late.js': "setTimeout(function () { throw new Error('tarde'); }, 1);" }, 'late.js');
    const errs = runner.of('uncaught-error');
    assert.equal(errs.length, 1, 'erro assíncrono reportado');
    assert.equal(errs[0].payload.message, 'tarde');
    assert.equal(runner.of('run-complete')[0].payload.ok, false, 'falha marca run-complete');
    runner.disposeAll();
  }

  /* ---------- TEST RUNNER: describe/it/expect, hooks e async ---------- */
  {
    const runner = makeRunner();
    await runFile(runner, {
      'spec.js': [
        "var setups = 0;",
        "describe('soma', function () {",
        "  beforeEach(function () { setups++; });",
        "  it('2 + 2 é 4', function () { expect(2 + 2).toBe(4); });",
        "  it('async resolve', async function () { var v = await Promise.resolve(3); expect(v).toBe(3); });",
        "  it('falha proposital', function () { expect(1).toBe(2); });",
        "  it('viu os setups', function () { expect(setups).toBe(4); });",
        "});"
      ].join('\n')
    }, 'spec.js');
    assert.equal(runner.of('test-start').length, 4, 'quatro testes iniciados');
    const res = runner.of('test-result');
    assert.equal(res.length, 4);
    assert.equal(res.filter(e => e.payload.ok).length, 3, 'três passam');
    const falhou = res.find(e => !e.payload.ok);
    assert.ok(falhou && /esperava/.test(falhou.payload.message), 'a falha traz mensagem');
    const resumo = runner.of('diagnostic').find(e => e.payload.kind === 'test-summary');
    assert.ok(resumo && resumo.payload.passed === 3 && resumo.payload.failed === 1, 'resumo correto');
    assert.equal(runner.of('run-complete')[0].payload.ok, false, 'suíte com falha marca run-complete ok:false');
    runner.disposeAll();
  }

  /* ---------- runTests: atalho que roda a suíte ---------- */
  {
    const runner = makeRunner();
    const sid = runner.createSession();
    runner.putFiles(sid, { 'spec.js': "it('ok', function () { expect(true).toBeTruthy(); });" });
    const done = runner.done();
    runner.runTests(sid, 'spec.js');
    await done;
    assert.equal(runner.of('test-result')[0].payload.ok, true, 'teste passa via runTests');
    assert.equal(runner.of('run-complete')[0].payload.ok, true);
    runner.disposeAll();
  }

  /* ---------- módulos embutidos didáticos (Node): process/path/events/Buffer ---------- */
  {
    const runner = makeRunner();
    await runFile(runner, {
      'node.js': [
        "var path = require('path');",
        "var events = require('events');",
        "console.log('platform', process.platform);",
        "console.log('join', path.join('a', 'b', '..', 'c.js'));",
        "console.log('base', path.basename('/x/y/z.txt', '.txt'));",
        "var em = new events.EventEmitter();",
        "em.on('ping', function (n) { console.log('ping', n); });",
        "em.emit('ping', 5);",
        "console.log('buf', Buffer.from('AB').toString('hex'));"
      ].join('\n')
    }, 'node.js');
    assert.deepEqual(runner.textos(), ['platform browser', 'join a/c.js', 'base z', 'ping 5', 'buf 4142'],
      'process, path, EventEmitter e Buffer funcionam');
    assert.equal(runner.of('run-complete')[0].payload.ok, true);
    runner.disposeAll();
  }

  /* ---------- require de pacote externo falha de forma clara ---------- */
  {
    const runner = makeRunner();
    await runFile(runner, { 'x.js': "require('lodash');" }, 'x.js');
    const err = runner.of('uncaught-error')[0];
    assert.ok(err && /não disponível|não busca pacotes/.test(err.payload.message), 'require externo falha claro');
    runner.disposeAll();
  }

  /* ---------- timeout: laço infinito é encerrado e a sessão volta a executar ----------
     Transport mudo + scheduler manual: dispara o estouro do tempo de forma
     determinística, como o setTimeout do coordenador faria. */
  {
    let pending = null;
    const silent = {
      terminated: 0, opened: 0,
      open() { this.opened++; const self = this; return { post() {}, terminate() { self.terminated++; } }; }
    };
    const runner = LX.JS.createRunner({
      transport: silent,
      schedule: fn => { pending = fn; return 1; },
      cancelSchedule: () => { pending = null; }
    });
    const log = [];
    runner.subscribe(e => log.push(e));
    const sid = runner.createSession();
    assert.equal(silent.opened, 1, 'abre uma sandbox ao criar a sessão');
    runner.putFiles(sid, { 'loop.js': 'while (true) {}' });
    const runId = runner.run(sid, 'loop.js');
    assert.ok(pending, 'timeout agendado');
    pending();
    const timeouts = log.filter(e => e.type === 'run-timeout');
    assert.equal(timeouts.length, 1, 'um run-timeout');
    assert.equal(timeouts[0].runId, runId);
    assert.equal(silent.terminated, 1, 'a sandbox foi encerrada no timeout');
    assert.equal(silent.opened, 2, 'a sandbox foi reaberta após o encerramento');
    assert.doesNotThrow(() => runner.run(sid, 'loop.js'), 'a sessão executa de novo após o timeout');
    runner.disposeAll();
  }

  /* ---------- cancel: encerra a execução ativa ---------- */
  {
    const silent = { open() { return { post() {}, terminate() {} }; } };
    const runner = LX.JS.createRunner({ transport: silent, schedule: () => 1, cancelSchedule: () => {} });
    const log = [];
    runner.subscribe(e => log.push(e));
    const sid = runner.createSession();
    runner.putFiles(sid, { 'main.js': 'while (true) {}' });
    const runId = runner.run(sid, 'main.js');
    assert.equal(runner.cancel(runId), true, 'cancel encontra a execução');
    assert.equal(log.filter(e => e.type === 'run-cancelled').length, 1, 'um run-cancelled');
    assert.equal(runner.cancel('run_inexistente'), false, 'cancel de runId inválido devolve false');
    runner.disposeAll();
  }

  /* ---------- validações de sessão/arquivo inválidos ---------- */
  {
    const runner = makeRunner();
    assert.throws(() => runner.putFiles('sess_fantasma', { 'a.js': 'x' }), /Sessão inválida/);
    const sid = runner.createSession();
    assert.throws(() => runner.run(sid, 'nao-existe.js'), /inexistente/);
    assert.throws(() => runner.runTests(), /Sessão inválida/);
    assert.equal(runner.dispose('sess_fantasma'), false);
    assert.equal(runner.dispose(sid), true);
    runner.disposeAll();
  }

  console.log('JavaScript runtime: olá, throw localizado, syntax error, limite de saída, async (micro/timer/await), erro assíncrono, test runner, módulos Node (process/path/events/Buffer), timeout, cancel e validações passaram.');
})().catch(error => { console.error(error); process.exitCode = 1; });
