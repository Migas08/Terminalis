/* Carrega o motor no Node e expõe utilitários de teste */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

function loadEngine(extra = []) {
  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
  const engineFiles = files.filter(f => /^\d\d-/.test(f));
  const memoria = new Map();
  const ctx = {
    console, setTimeout, clearTimeout, Math, Date, JSON, RegExp, Promise,
    TextEncoder, TextDecoder, crypto: globalThis.crypto, Error, Object, Array, String, Number, Boolean, Map, Set, Uint8Array, parseInt, parseFloat, isNaN,
    localStorage: {
      getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
      setItem: (k, v) => { memoria.set(k, String(v)); },
      removeItem: (k) => { memoria.delete(k); },
      clear: () => memoria.clear()
    },
    document: undefined, window: undefined
  };
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of engineFiles.concat(extra)) {
    const code = fs.readFileSync(path.join(SRC, f), 'utf8');
    try { vm.runInContext(code, ctx, { filename: f }); }
    catch (e) { console.error(`\n!! Erro carregando ${f}: ${e.message}\n${e.stack.split('\n').slice(0, 4).join('\n')}`); throw e; }
  }
  return ctx.LX;
}

function makeSession(LX, opts = {}) {
  const m = new LX.Machine(opts.machine || {});
  LX.installBinaries(m);
  if (LX.DockerEngine) { m.docker = new LX.DockerEngine(m); }
  if (LX.seedWorkspace) LX.seedWorkspace(m);
  const sh = new LX.Shell(m, { cwd: '/home/aluno', uid: 1000, gid: 1000, user: 'aluno' });
  const out = [];
  const errs = [];
  const term = {
    aborted: false,
    _answers: opts.answers || [],
    readLine: async function () { return this._answers.length ? this._answers.shift() : 'sim'; },
    clear() { },
    pager: async (data) => { out.push(data); },
    editor: async () => { },
    liveView: async (render) => { out.push(typeof render === 'function' ? await render() : ''); },
    follow: async () => { },
    becomeRoot: () => { sh.uid = 0; sh.gid = 0; sh.user = 'root'; sh.setVar('HOME', '/root', true); },
    sshInto: () => { }
  };
  async function run(cmd) {
    out.length = 0; errs.length = 0;
    const io = {
      stdin: new LX.InStream(''),
      stdout: new LX.Stream({ onWrite: s => out.push(s), isTTY: true }),
      stderr: new LX.Stream({ onWrite: s => { out.push(s); errs.push(s); }, isTTY: true }),
      term
    };
    const ex = new LX.Executor(sh, io);
    let status = 0;
    try { status = await ex.run(cmd); }
    catch (e) {
      if (e && e.isExit) status = e.code;
      else if (e && e.isParseError) { errs.push(e.message); out.push('bash: ' + e.message + '\n'); status = 2; }
      else if (e && e.isLimit) { errs.push(e.message); status = 1; }
      else throw e;
    }
    sh.lastStatus = status;
    return { status, out: out.join(''), err: errs.join('') };
  }
  return { m, sh, run, term };
}

module.exports = { loadEngine, makeSession, SRC };
