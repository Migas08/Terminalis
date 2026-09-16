/* Dirty tracking barato do workspace (LX.WorkspaceMutation + LX.Sync):
   leituras não exportam a VM nem marcam sujo; escritas marcam; restaurar não
   gera dirty falso. Prova, contando exportações, que comandos de leitura não
   causam mais exportState/assinatura. */
const assert = require('node:assert/strict');
const { loadEngine, makeSession } = require('./harness');

const LX = loadEngine();
const MUT = LX.WorkspaceMutation;
const S = LX.Sync;

function app(sessao) {
  const a = { machine: sessao.m, term: sessao.sh, trilhaId: null, _restaurado: null };
  a.aplicarWorkspaceRestaurado = r => { a._restaurado = r; if (r && r.machine) { a.machine = r.machine; a.term = r.shell; } };
  return a;
}
function limpar() {
  if (S._timer) clearTimeout(S._timer);
  LX.Store.provider = null; LX.Store.modo = 'local';
  LX.Auth.usuario = { uid: 'mut' };
  S._timer = null; S._sujo = false; S._pendente = false; S._exportCount = 0;
  S._epocaSnap = -1; S._shellSig = null; S._assinatura = null;
}

(async () => {
  assert.ok(MUT, 'LX.WorkspaceMutation deve existir');

  /* ---------- leituras: 0 exportações, 0 dirty ---------- */
  limpar();
  const s = makeSession(LX);
  const a = app(s);
  S.iniciar(a);
  await s.run('ls /');            // aquece a variável volátil `_`
  S.marcarSujo('workspace'); S._sujo = false;
  const exportsAntes = S._exportCount;
  let algumDirty = false;
  for (const cmd of ['ls /', 'pwd', 'cat /etc/hostname', 'ls -la /home', 'stat /etc/passwd', 'ps', 'head -1 /etc/passwd']) {
    await s.run(cmd);
    if (S.marcarSujo('workspace')) algumDirty = true;
  }
  assert.equal(algumDirty, false, 'nenhuma leitura marca o workspace como sujo');
  assert.equal(S._exportCount - exportsAntes, 0, 'nenhuma leitura exporta a VM');

  /* ---------- escritas: marcam dirty ---------- */
  async function escreveMarca(cmd) { await s.run(cmd); const d = S.marcarSujo('workspace'); S._sujo = false; return d; }
  assert.ok(await escreveMarca('mkdir /home/aluno/p1'), 'mkdir marca dirty');
  assert.ok(await escreveMarca('echo oi > /home/aluno/p1/a.txt'), 'writeFile marca dirty');
  assert.ok(await escreveMarca('chmod 700 /home/aluno/p1/a.txt'), 'chmod marca dirty');
  assert.ok(await escreveMarca('touch /home/aluno/p1/a.txt'), 'touch marca dirty');
  assert.ok(await escreveMarca('cd /home/aluno/p1'), 'cd (estado do shell) marca dirty');
  assert.ok(await escreveMarca('export FOO=bar'), 'export (estado do shell) marca dirty');
  assert.ok(await escreveMarca('rm /home/aluno/p1/a.txt'), 'rm marca dirty');

  /* ---------- git commit marca dirty (estado do Git é arquivo do VFS) ---------- */
  assert.ok(await escreveMarca('cd /home/aluno; git init; echo x > y; git add y; git -c user.email=a@b -c user.name=a commit -m z'),
    'git commit marca dirty');

  /* ---------- docker run marca dirty ---------- */
  assert.ok(await escreveMarca('docker run -d --name w nginx:alpine'), 'docker run marca dirty');

  /* ---------- restaurar NÃO gera dirty falso (importação suspende o rastreamento) ---------- */
  limpar();
  const origem = makeSession(LX);
  await origem.run('mkdir -p /home/aluno/proj; echo conteudo > /home/aluno/proj/f.txt');
  const snap = LX.Workspace.exportState(origem.m, origem.sh);
  const destino = makeSession(LX);
  const ad = app(destino);
  S.iniciar(ad);
  S.marcarSujo('workspace'); S._sujo = false; S._marcarLimpo();
  const epAntes = MUT.epoca();
  const restaurado = LX.Workspace.importState(JSON.parse(JSON.stringify(snap)));
  assert.equal(MUT.epoca() - epAntes, 0, 'importar um snapshot não incrementa a época de mutação');
  ad.aplicarWorkspaceRestaurado(restaurado);
  S._marcarLimpo();
  assert.equal(S.marcarSujo('workspace'), false, 'logo após restaurar, um gancho não marca dirty falso');

  /* ---------- várias mutações rápidas -> um único save no flush ---------- */
  limpar();
  const provider = (() => {
    const mem = {}; let saves = 0;
    return {
      saves: () => saves,
      _tabela: c => ({ progresso: 'user_progress', workspaces: 'workspaces' }[c] || null),
      async get() { return null; },
      async set() { return true; },
      async getWorkspace(uid) { return mem[uid] || null; },
      async saveWorkspace(uid, doc) { saves++; const base = Number(doc.baseRevision || 0); mem[uid] = { version: doc.version, revision: base + 1, snapshot: doc.snapshot, updatedAt: Date.now() }; return { ok: true, revision: base + 1 }; }
    };
  })();
  LX.Store.provider = provider; LX.Store.modo = 'supabase';
  const sb = makeSession(LX);
  const ab = app(sb);
  S.iniciar(ab);
  for (const cmd of ['echo a >> /tmp/b', 'echo c >> /tmp/b', 'mkdir /tmp/d', 'chmod 700 /tmp/d', 'echo e >> /tmp/b']) {
    await sb.run(cmd); S.marcarSujo('workspace');   // reagenda o debounce a cada mutação
  }
  if (S._timer) { clearTimeout(S._timer); S._timer = null; }   // dispara uma vez, como o debounce faria
  await S.flushWorkspace();
  assert.equal(provider.saves(), 1, 'uma rajada de mutações gera um único save no Supabase (debounce)');

  if (S._timer) { clearTimeout(S._timer); S._timer = null; }   // não segura o processo Node
  console.log('Mutation: leituras não exportam (0), escritas/chmod/touch/cd/export/git/docker marcam, restaurar não suja, rajada = 1 save.');
})().catch(e => { console.error(e); process.exitCode = 1; });
