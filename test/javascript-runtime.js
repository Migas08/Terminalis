/* Fase 1 do runner JS: ciclo de vida do coordenador executando a fonte real do
   Worker (LX.JS.Sandbox.WORKER_SOURCE) dentro de um contexto isolado do Node.
   O contexto vm faz o papel do Worker/iframe: código do aluno roda nele, sem
   acesso ao LX nem aos globais do processo Node. */
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadEngine } = require('./harness');

const LX = loadEngine();
const SOURCE = LX.JS.Sandbox.WORKER_SOURCE;

/* Transport de teste: cada sessão recebe um contexto vm próprio que roda a fonte
   do Worker. As mensagens trafegam por JSON (como o structured clone faria),
   o que também barra qualquer valor não serializável que escape sem querer. */
function nodeVmTransport() {
  return {
    open(sessionId, onMessage) {
      let listener = null;
      let dead = false;
      const self = {
        postMessage(data) { if (!dead) onMessage(JSON.parse(JSON.stringify(data))); },
        addEventListener(type, fn) { if (type === 'message') listener = fn; },
        close() { dead = true; }
      };
      // Só TextEncoder é injetado (não é intrínseco do realm). Function, Object,
      // Error, JSON etc. vêm do PRÓPRIO contexto vm: assim `new Function` do Worker
      // cria código do aluno no escopo isolado do contexto, não no realm do Node.
      // É isso que faz fetch/process/require ficarem indisponíveis ao aluno, do
      // mesmo modo que um Worker real de origem opaca no navegador.
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

function collector(runner) {
  const events = [];
  runner.subscribe(e => events.push(e));
  return {
    events,
    of(type) { return events.filter(e => e.type === type); },
    clear() { events.length = 0; }
  };
}

(async () => {
  /* ---------- programa "Olá": console estruturado + run-complete ---------- */
  {
    const runner = LX.JS.createRunner({ transport: nodeVmTransport() });
    const log = collector(runner);
    const sid = runner.createSession();
    runner.putFiles(sid, { 'main.js': "console.log('Olá', 42, { a: 1 });" });
    const runId = runner.run(sid, 'main.js');

    const starts = log.of('run-start');
    assert.equal(starts.length, 1, 'um run-start');
    assert.equal(starts[0].runId, runId);
    const consoles = log.of('console');
    assert.equal(consoles.length, 1, 'uma linha de console');
    assert.equal(consoles[0].payload.level, 'log');
    assert.equal(consoles[0].payload.text, 'Olá 42 {a: 1}');
    assert.equal(log.of('run-complete').length, 1, 'um run-complete');
    // Relógio lógico monotônico e não decrescente.
    for (let i = 1; i < log.events.length; i++) assert.ok(log.events[i].seq > log.events[i - 1].seq, 'seq cresce');
    runner.disposeAll();
  }

  /* ---------- throw: erro com nome, mensagem e localização ---------- */
  {
    const runner = LX.JS.createRunner({ transport: nodeVmTransport() });
    const log = collector(runner);
    const sid = runner.createSession();
    runner.putFiles(sid, { 'app.js': "const x = 1;\nthrow new Error('explodiu');" });
    runner.run(sid, 'app.js');
    const errs = log.of('uncaught-error');
    assert.equal(errs.length, 1, 'um uncaught-error');
    assert.equal(errs[0].payload.name, 'Error');
    assert.equal(errs[0].payload.message, 'explodiu');
    assert.equal(errs[0].payload.line, 2, 'a linha do throw é localizada');
    assert.ok(Number.isFinite(errs[0].payload.column), 'coluna localizada');
    assert.equal(log.of('run-complete').length, 1);
    runner.disposeAll();
  }

  /* ---------- syntax error: reportado como erro, não como sucesso ---------- */
  {
    const runner = LX.JS.createRunner({ transport: nodeVmTransport() });
    const log = collector(runner);
    const sid = runner.createSession();
    runner.putFiles(sid, { 'quebrado.js': 'function (' });
    runner.run(sid, 'quebrado.js');
    const errs = log.of('uncaught-error');
    assert.equal(errs.length, 1, 'erro de sintaxe vira uncaught-error');
    assert.match(errs[0].payload.name, /SyntaxError|Error/);
    const completes = log.of('run-complete');
    assert.equal(completes.length, 1);
    assert.equal(completes[0].payload.ok, false, 'run-complete marca falha');
    runner.disposeAll();
  }

  /* ---------- limite de saída: inunda o console e recebe um único output-limit ---------- */
  {
    const runner = LX.JS.createRunner({ transport: nodeVmTransport(), limits: { OUTPUT_BYTES: 2048 } });
    const log = collector(runner);
    const sid = runner.createSession();
    runner.putFiles(sid, { 'flood.js': "for (let i = 0; i < 100000; i++) console.log('linha ' + i);" });
    runner.run(sid, 'flood.js');
    assert.equal(log.of('output-limit').length, 1, 'exatamente um output-limit');
    // O coordenador para de repassar console além do teto.
    const bytes = log.of('console').reduce((n, e) => n + Buffer.byteLength(e.payload.text), 0);
    assert.ok(bytes <= 2048 * 2, 'saída repassada fica próxima do teto, não ilimitada');
    runner.disposeAll();
  }

  /* ---------- timeout: laço infinito é encerrado e a sessão volta a executar ----------
     Um laço infinito não pode rodar de verdade no vm (travaria o teste). Usamos um
     transport mudo — que nunca responde — e um scheduler manual para disparar o
     estouro do tempo de forma determinística, exatamente como o setTimeout faria. */
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
    const log = collector(runner);
    const sid = runner.createSession();
    assert.equal(silent.opened, 1, 'abre uma sandbox ao criar a sessão');
    runner.putFiles(sid, { 'loop.js': 'while (true) {}' });
    const runId = runner.run(sid, 'loop.js');
    assert.ok(pending, 'timeout agendado');
    pending();   // simula o estouro do tempo
    const timeouts = log.of('run-timeout');
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
    const log = collector(runner);
    const sid = runner.createSession();
    runner.putFiles(sid, { 'main.js': 'while (true) {}' });
    const runId = runner.run(sid, 'main.js');
    assert.equal(runner.cancel(runId), true, 'cancel encontra a execução');
    assert.equal(log.of('run-cancelled').length, 1, 'um run-cancelled');
    assert.equal(runner.cancel('run_inexistente'), false, 'cancel de runId inválido devolve false');
    runner.disposeAll();
  }

  /* ---------- validações de sessão/arquivo inválidos ---------- */
  {
    const runner = LX.JS.createRunner({ transport: nodeVmTransport() });
    assert.throws(() => runner.putFiles('sess_fantasma', { 'a.js': 'x' }), /Sessão inválida/);
    const sid = runner.createSession();
    assert.throws(() => runner.run(sid, 'nao-existe.js'), /inexistente/);
    assert.throws(() => runner.runTests(), /não é suportado/);
    assert.equal(runner.dispose('sess_fantasma'), false);
    assert.equal(runner.dispose(sid), true);
    runner.disposeAll();
  }

  console.log('JavaScript runtime: olá, throw localizado, syntax error, limite de saída, timeout terminável, cancel e validações passaram.');
})().catch(error => { console.error(error); process.exitCode = 1; });
