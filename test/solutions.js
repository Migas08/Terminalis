/* Executa a solução oficial de cada desafio e confere se o verificador aprova.
   Também testa que um estado "vazio" é REPROVADO (o verificador precisa discriminar). */
const { loadEngine } = require('./harness');
const LX = loadEngine();

function stripHtml(s) {
  return String(s)
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/* divide um script em comandos, sem quebrar heredocs nem aspas multilinha */
function splitScript(text) {
  const out = [];
  let cur = [], sq = false, dq = false, heredoc = null;
  for (const line of text.split('\n')) {
    if (heredoc !== null) {
      cur.push(line);
      if (line.trim() === heredoc) { heredoc = null; out.push(cur.join('\n')); cur = []; }
      continue;
    }
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '\\') { i++; continue; }
      if (c === "'" && !dq) sq = !sq;
      else if (c === '"' && !sq) dq = !dq;
    }
    const hd = !sq && !dq && /<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/.exec(line);
    cur.push(line);
    if (hd) { heredoc = hd[1]; continue; }
    const contInc = /\\$/.test(line);
    if (!sq && !dq && !contInc) { out.push(cur.join('\n')); cur = []; }
  }
  if (cur.length) out.push(cur.join('\n'));
  return out.map(t => t.trim()).filter(t => t && !/^#/.test(t));
}

/* o <pre> da solução vira UM script (preserva heredoc e quebras dentro de aspas) */
function solutionScripts(html) {
  const pres = String(html).match(/<pre>([\s\S]*?)<\/pre>/g) || [];
  const out = [];
  for (const p of pres) {
    const txt = stripHtml(p.replace(/^<pre>/, '').replace(/<\/pre>$/, ''))
      .split('\n').map(l => l.replace(/^\$ /, '')).join('\n');
    out.push(...splitScript(txt));
  }
  return out;
}

/* blocos executáveis do enunciado — cenário do desafio, como script único */
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
    catch (e) { if (e && e.isExit) sh.lastStatus = e.code; else if (e && e.isLimit) { } else if (e && e.isInterrupt) { } else throw e; }
    return sh.lastStatus;
  }
  term.runQuiet = async (c) => { const before = out.length; await run(c); return { status: sh.lastStatus, out: out.slice(before).join('') }; };
  return { m, sh, term, run, out, ctx: () => ({ app: null, machine: m, term, sh, run: term.runQuiet }) };
}

(async () => {
  let pass = 0, fail = 0, skip = 0, weak = 0, explode = 0;
  const problems = [];

  for (const mod of LX.COURSE.modules) {
    for (const lesson of mod.lessons) {
      for (const t of (lesson.tasks || [])) {
        if (!t.check) { skip++; continue; }

        // ---------- 1) o desafio deve REPROVAR um ambiente intocado ----------
        if (t.kind !== 'fill') {
          const s0 = makeCtx();
          if (lesson.setup) { try { lesson.setup(s0.m, s0.term); } catch (e) { } }
          let r0;
          try { r0 = await t.check(s0.ctx()); }
          catch (e) {
            /* Um verificador que estoura no ambiente vazio mostra ao aluno
               "não consegui verificar: Cannot read properties of null" em vez
               da pendência. É defeito, não rejeição. */
            r0 = { ok: false };
            explode++;
            problems.push({ id: t.id, tipo: 'EXPLODE', lesson: lesson.n + ' ' + lesson.title, msg: e.message + ' — ' + (e.stack || '').split('\n')[1] });
          }
          if (r0 && r0.ok) { weak++; problems.push({ id: t.id, tipo: 'FRACO', msg: 'aprova sem o aluno fazer nada' }); }
        }

        // ---------- 1b) o desafio deve REPROVAR um relatório inventado ----------
        /* Se o desafio pede um arquivo de saída, escrever nele um texto
           plausível colhido do próprio enunciado não pode aprovar. */
        if (t.kind !== 'fill' && t.forja) {
          const sf = makeCtx();
          if (lesson.setup) { try { lesson.setup(sf.m, sf.term); } catch (e) { } }
          for (const c of [].concat(t.forja)) { try { await sf.run(c); } catch (e) { } }
          let rf;
          try { rf = await t.check(sf.ctx()); } catch (e) { rf = { ok: false }; }
          if (rf && rf.ok) { weak++; problems.push({ id: t.id, tipo: 'FORJAVEL', lesson: lesson.n + ' ' + lesson.title, msg: 'aprova um relatório inventado' }); }
        }

        // ---------- 2) a solução oficial deve APROVAR ----------
        const s = makeCtx();
        if (lesson.setup) { try { lesson.setup(s.m, s.term); } catch (e) { } }

        // cenário descrito no enunciado
        for (const c of bodyScripts(t.body)) {
          try { await s.run(c); } catch (e) { problems.push({ id: t.id, tipo: 'CENARIO', msg: c.slice(0, 60) + ' → ' + e.message }); }
        }

        let res;
        if (t.kind === 'fill') {
          const vals = t.sample ? [].concat(t.sample) : (t.answers || []).map(a => {
            const first = String(a).split('|')[0];
            return first.replace(/\[([^\]]+)\]\{(\d+)\}/g, (mm, cls, n) => cls.slice(0, +n))
              .replace(/\\/g, '').replace(/[\[\]{}()^$?*+]/g, '');
          });
          try { res = await t.check(Object.assign(s.ctx(), { vals })); }
          catch (e) { res = { ok: false, msg: 'exceção: ' + e.message }; }
        } else {
          for (const c of solutionScripts(t.solution || '')) {
            try { await s.run(c); }
            catch (e) { problems.push({ id: t.id, tipo: 'SOLUCAO-ERRO', msg: c.slice(0, 60) + ' → ' + e.message }); }
          }
          try { res = await t.check(s.ctx()); }
          catch (e) { res = { ok: false, msg: 'exceção: ' + e.message + '\n' + (e.stack || '').split('\n')[1] }; }
        }

        if (res && res.ok) pass++;
        else {
          fail++;
          problems.push({ id: t.id, tipo: 'REPROVOU', msg: (res && res.msg) || '(sem mensagem)', lesson: lesson.n + ' ' + lesson.title });
        }
      }
    }
  }

  console.log(`\n=== desafios: ${pass} ok · ${fail} falharam · ${weak} fracos · ${explode} estouram · ${skip} sem verificador ===\n`);
  for (const p of problems) {
    console.log(`  [${p.tipo}] ${p.id}${p.lesson ? ' (' + p.lesson + ')' : ''}`);
    console.log(`      ${String(p.msg).replace(/<[^>]+>/g, '').slice(0, 220)}`);
  }
  process.exit(fail || weak || explode ? 1 : 0);
})();
