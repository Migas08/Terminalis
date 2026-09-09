/* Valida UMA aula: estrutura, solução oficial e rejeição do ambiente vazio.
     node tools/checar-aula.js ld11-2  [outra ...]
   Sem argumento, valida todas as aulas (é o mesmo que rodar as três suítes). */
const path = require('path');
const { loadEngine } = require(path.join(__dirname, '..', 'test', 'harness'));
const LX = loadEngine();

function stripHtml(s) {
  return String(s).replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}
function splitScript(text) {
  const out = []; let cur = [], sq = false, dq = false, heredoc = null;
  for (const line of text.split('\n')) {
    if (heredoc !== null) {
      cur.push(line);
      if (line.trim() === heredoc) { heredoc = null; out.push(cur.join('\n')); cur = []; }
      continue;
    }
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '\\') { i++; continue; }
      if (c === "'" && !dq) sq = !sq; else if (c === '"' && !sq) dq = !dq;
    }
    const hd = !sq && !dq && /<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/.exec(line);
    cur.push(line);
    if (hd) { heredoc = hd[1]; continue; }
    if (!sq && !dq && !/\\$/.test(line)) { out.push(cur.join('\n')); cur = []; }
  }
  if (cur.length) out.push(cur.join('\n'));
  return out.map(t => t.trim()).filter(t => t && !/^#/.test(t));
}
function bodyScripts(blocks) {
  const out = [];
  for (const b of (blocks || [])) {
    if (!b || !b.code) continue;
    if (b.run === false) continue;
    if (b.lang && b.lang !== 'bash') continue;
    const lines = Array.isArray(b.code) ? b.code : String(b.code).split('\n');
    if (!lines.some(l => /^\$ /.test(l))) continue;
    out.push(...splitScript(lines.map(l => l.replace(/^\$ /, '')).join('\n')));
  }
  return out;
}
function solutionScripts(html) {
  const out = [];
  for (const p of (String(html).match(/<pre>([\s\S]*?)<\/pre>/g) || [])) {
    const txt = stripHtml(p.replace(/^<pre>/, '').replace(/<\/pre>$/, ''))
      .split('\n').map(l => l.replace(/^\$ /, '')).join('\n');
    out.push(...splitScript(txt));
  }
  return out;
}
function makeCtx() {
  const m = new LX.Machine();
  LX.installBinaries(m);
  if (LX.DockerEngine) m.docker = new LX.DockerEngine(m);
  if (LX.seedWorkspace) LX.seedWorkspace(m);
  const sh = new LX.Shell(m, { cwd: '/home/aluno', uid: 1000, gid: 1000, user: 'aluno' });
  const history = [];
  const term = {
    aborted: false, history,
    readLine: async () => 'sim',
    clear() { }, pager: async () => { }, editor: async () => { },
    liveView: async () => { }, follow: async () => { },
    becomeRoot: (u) => { sh.uid = u.uid; sh.gid = u.gid; sh.user = u.name; sh.setVar('HOME', u.home, true); },
    sshInto: () => { }, flash: () => { }, runQuiet: null
  };
  const out = [];
  async function run(cmd) {
    history.push(cmd);
    const io = {
      stdin: new LX.InStream(''),
      stdout: new LX.Stream({ onWrite: s => out.push(s), isTTY: true }),
      stderr: new LX.Stream({ onWrite: s => out.push(s), isTTY: true }),
      term
    };
    const ex = new LX.Executor(sh, io);
    try { sh.lastStatus = await ex.run(cmd); }
    catch (e) { if (e && e.isExit) sh.lastStatus = e.code; else if (e && (e.isLimit || e.isInterrupt)) { } else throw e; }
    return sh.lastStatus;
  }
  term.runQuiet = async (c) => { const before = out.length; await run(c); return { status: sh.lastStatus, out: out.slice(before).join('') }; };
  return { m, sh, term, run, out, ctx: () => ({ app: null, machine: m, term, sh, run: term.runQuiet }) };
}

const alvos = process.argv.slice(2);
(async () => {
  let erros = 0, vistas = 0;
  for (const mod of LX.COURSE.modules) {
    for (const l of mod.lessons) {
      if (alvos.length && !alvos.includes(l.id)) continue;
      vistas++;
      const ts = l.tasks || [];
      const kinds = ts.map(t => t.kind);
      const falha = (msg) => { erros++; console.log(`  ✗ ${l.n} ${l.title}\n      ${msg}`); };
      if (ts.length !== 3) falha(`tem ${ts.length} tarefas: ${kinds.join(', ')}`);
      else {
        if (kinds[0] !== 'guiado') falha(`a 1ª tarefa deveria ser guiado, é "${kinds[0]}"`);
        if (!['quiz', 'fill'].includes(kinds[1])) falha(`a 2ª deveria ser pergunta (quiz/fill), é "${kinds[1]}"`);
        if (kinds[2] !== 'desafio') falha(`a 3ª deveria ser desafio, é "${kinds[2]}"`);
      }
      for (const t of ts) {
        if (!t.check) { if (t.kind !== 'quiz') falha(`${t.id} sem check`); continue; }
        /* rejeita ambiente vazio */
        if (t.kind !== 'fill') {
          const s0 = makeCtx();
          if (l.setup) { try { l.setup(s0.m, s0.term); } catch (e) { } }
          let r0;
          try { r0 = await t.check(s0.ctx()); }
          catch (e) { falha(`${t.id}: o verificador estourou no ambiente vazio → ${e.message}`); continue; }
          if (r0 && r0.ok) falha(`${t.id}: aprova sem o aluno fazer nada`);
        }
        /* tarefa de preencher (fill): a "solução" são as respostas certas,
           entregues ao verificador como ctx.vals — igual ao test/solutions.js */
        if (t.kind === 'fill') {
          const s = makeCtx();
          if (l.setup) { try { l.setup(s.m, s.term); } catch (e) { } }
          const vals = t.sample ? [].concat(t.sample) : (t.answers || []).map(a => {
            const first = String(a).split('|')[0];
            return first.replace(/\[([^\]]+)\]\{(\d+)\}/g, (mm, cls, n) => cls.slice(0, +n))
              .replace(/\\/g, '').replace(/[\[\]{}()^$?*+]/g, '');
          });
          let resf;
          try { resf = await t.check(Object.assign(s.ctx(), { vals })); }
          catch (e) { falha(`${t.id}: o verificador (fill) estourou → ${e.message}`); continue; }
          if (!resf || !resf.ok) falha(`${t.id}: as respostas oficiais NÃO passam → ${stripHtml((resf && resf.msg) || '(sem mensagem)')}`);
          continue;
        }
        if (!t.solution && t.kind === 'desafio') { falha(`${t.id}: prática sem solução`); continue; }
        if (!t.solution) continue;
        const s = makeCtx();
        if (l.setup) { try { l.setup(s.m, s.term); } catch (e) { } }
        /* cenário descrito no enunciado (blocos de código executáveis do body) */
        for (const c of bodyScripts(t.body)) {
          try { await s.run(c); } catch (e) { }
        }
        for (const c of solutionScripts(t.solution)) {
          try { await s.run(c); }
          catch (e) { falha(`${t.id}: a solução estourou em "${c.slice(0, 50)}" → ${e.message}`); }
        }
        let res;
        try { res = await t.check(s.ctx()); }
        catch (e) { falha(`${t.id}: o verificador estourou depois da solução → ${e.message}`); continue; }
        if (!res || !res.ok) falha(`${t.id}: a solução oficial NÃO passa → ${stripHtml((res && res.msg) || '(sem mensagem)')}`);
      }
    }
  }
  console.log(`\n=== ${vistas} aula(s) verificada(s) · ${erros} problema(s) ===\n`);
  process.exit(erros ? 1 : 0);
})();
