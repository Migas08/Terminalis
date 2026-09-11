/* Sincronização em nuvem: progresso, conflito por revisão, offline→online,
   restauração do ambiente e migração de dados locais. Tudo em memória, com
   um provider mock — não depende de rede nem do Supabase real. */
const assert = require('node:assert/strict');
const { loadEngine, makeSession } = require('./harness');

const LX = loadEngine();
const localStorage = LX.__localStorage;   // o mesmo localStorage que o motor usa

/* Zera o estado global entre subtestes. */
function limpar() {
  localStorage.clear();
  LX.Store.provider = null;
  LX.Store.modo = 'local';
  LX.Auth.backend = 'local';
  LX.Auth.usuario = null;
  LX.Sync.app = null;
  LX.Sync._revisao = 0;
  LX.Sync._sujo = false;
  LX.Sync._pendente = false;
  LX.Sync._flushing = false;
  LX.Sync._assinatura = null;
  LX.Sync._pausado = false;
  LX.Sync._conflito = null;
}

/* Provider de nuvem falso, com a mesma interface do SupabaseStore. */
function providerFalso() {
  const mem = { progresso: {}, workspaces: {} };
  return {
    mem, falhar: false,
    _tabela: c => ({ progresso: 'user_progress', workspaces: 'workspaces', profiles: 'profiles' }[c] || null),
    async get(col, id) { return col === 'progresso' ? (mem.progresso[id] || null) : null; },
    async set(col, id, d) { if (col === 'progresso') mem.progresso[id] = JSON.parse(JSON.stringify(d)); return true; },
    async getWorkspace(uid) { return mem.workspaces[uid] || null; },
    async saveWorkspace(uid, doc) {
      if (this.falhar) return { ok: false, erro: 'rede' };
      const base = Number(doc.baseRevision || 0);
      const cur = mem.workspaces[uid];
      if (cur && Number(cur.revision || 0) !== base) return { ok: false, conflito: true, atual: cur };
      const rev = base + 1;
      mem.workspaces[uid] = { version: doc.version, revision: rev, updatedAt: Date.now(), snapshot: doc.snapshot, device: doc.device };
      return { ok: true, revision: rev };
    }
  };
}

/* Um "app" mínimo com máquina e shell reais, suficiente para o Workspace. */
function appReal() {
  const s = makeSession(LX);
  const app = { machine: s.m, term: s.sh, trilhaId: null, _restaurado: null };
  app.aplicarWorkspaceRestaurado = r => { app._restaurado = r; };
  app.toast = () => { };
  return Object.assign(app, { sessao: s });
}

(async () => {
  /* ---------- A. progresso persiste e volta (Storage local) ---------- */
  limpar();
  LX.Auth.usuario = { uid: 'aluno1' };
  await LX.Storage.saveProgress('aluno1', { lessons: { l1: 1, l2: 1 }, tasks: {} });
  const prog = await LX.Storage.getProgress('aluno1');
  assert.equal(Object.keys(prog.lessons).length, 2, 'progresso deve voltar com 2 aulas');

  /* notas e preferências convivem no mesmo documento de progresso */
  await LX.Storage.saveNotes('aluno1', { l1: 'minha anotação' });
  assert.equal((await LX.Storage.getNotes('aluno1')).l1, 'minha anotação');
  assert.equal(Object.keys((await LX.Storage.getProgress('aluno1')).lessons).length, 2, 'salvar notas não apaga aulas');

  /* progresso de duas sessões deve ser mesclado de forma determinística */
  const mesclado = LX.ProgressMerge.merge(
    { lessons: { l1: 10 }, tasks: { t1: 10 }, notes: { l1: 'A' }, streakDays: ['2026-09-01'], seconds: 20, atualizadoEm: 10 },
    { lessons: { l2: 20 }, tasks: { t2: 20 }, notes: { geral: 'B' }, streakDays: ['2026-09-02'], seconds: 10, atualizadoEm: 20 }
  );
  assert.deepEqual(Object.keys(mesclado.lessons).sort(), ['l1', 'l2'], 'merge preserva aulas concluídas em abas diferentes');
  assert.deepEqual(Object.keys(mesclado.tasks).sort(), ['t1', 't2'], 'merge preserva desafios concluídos em abas diferentes');
  assert.deepEqual(mesclado.streakDays, ['2026-09-01', '2026-09-02'], 'merge une dias de sequência');
  assert.equal(mesclado.notes.l1, 'A');
  assert.equal(mesclado.notes.geral, 'B');
  assert.equal(LX.ProgressMerge.merge({ notes: { l1: 'antiga' }, atualizadoEm: 1 }, { notes: { l1: 'nova' }, atualizadoEm: 2 }).notes.l1, 'nova', 'conflito da mesma nota usa a versão mais recente');

  /* ---------- B. conflito por revisão não sobrescreve o mais novo ---------- */
  limpar();
  const snap = { version: 1, filesystem: {}, nada: 'x' };
  const r1 = await LX.Storage.saveWorkspace('u', { version: 1, snapshot: { a: 1 }, baseRevision: 0 });
  assert.ok(r1.ok && r1.revision === 1, 'primeira gravação cria revisão 1');
  const r2 = await LX.Storage.saveWorkspace('u', { version: 1, snapshot: { a: 2 }, baseRevision: 1 });
  assert.ok(r2.ok && r2.revision === 2, 'dispositivo atualizado grava revisão 2');
  const r3 = await LX.Storage.saveWorkspace('u', { version: 1, snapshot: { a: 999 }, baseRevision: 1 });
  assert.ok(!r3.ok && r3.conflito, 'gravação com revisão velha deve acusar conflito');
  const atual = await LX.Storage.getWorkspace('u');
  assert.equal(atual.snapshot.a, 2, 'o estado mais novo (a=2) não pode ser sobrescrito em silêncio');

  /* ---------- C. offline → guarda pendente → online → sincroniza ---------- */
  limpar();
  const prov = providerFalso();
  LX.Store.provider = prov; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'u2' };
  const app = appReal();
  await app.sessao.run('mkdir projeto; cd projeto; echo teste > index.html; git init; git add index.html');
  LX.Sync.iniciar(app);
  const antesOffline = LX.Sync._offline;
  LX.Sync._offline = () => true;               // simula sem rede
  await LX.Sync.flushWorkspace();
  assert.ok(LX.Sync._pendente, 'offline deve deixar a sincronização pendente');
  assert.ok(!prov.mem.workspaces['u2'], 'nada é enviado à nuvem enquanto offline');
  assert.ok(localStorage.getItem('terminalis.cache.workspace/u2'), 'mas fica salvo no cache local');
  LX.Sync._offline = () => false;              // conexão volta
  await LX.Sync._voltouOnline();
  assert.ok(prov.mem.workspaces['u2'], 'ao voltar a rede, o ambiente é enviado');
  assert.ok(!LX.Sync._pendente, 'e deixa de estar pendente');
  LX.Sync._sujo = false;
  assert.equal(LX.Sync.marcarSujo('workspace'), false, 'comando somente de leitura não agenda novo snapshot');
  LX.Sync._offline = antesOffline;

  /* ---------- D. conflito via Sync guarda backup e não destrói ---------- */
  limpar();
  const prov2 = providerFalso();
  prov2.mem.workspaces['u3'] = { version: 1, revision: 5, updatedAt: Date.now(), snapshot: { remoto: true } };
  LX.Store.provider = prov2; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'u3' };
  const app3 = appReal();
  await app3.sessao.run('echo local > /home/aluno/local.txt');
  LX.Sync.iniciar(app3);
  LX.Sync._revisao = 1;                         // achávamos que a base era 1; a nuvem já está em 5
  /* o snapshot remoto precisa ser válido para testar também a escolha explícita */
  prov2.mem.workspaces['u3'].snapshot = LX.Workspace.exportState(app3.machine, app3.term);
  prov2.mem.workspaces['u3'].snapshot.remoto = true;
  await LX.Sync.flushWorkspace();
  assert.equal(prov2.mem.workspaces['u3'].snapshot.remoto, true, 'o estado remoto mais novo é preservado');
  assert.equal(LX.Sync._revisao, 5, 'adotamos a revisão da nuvem como nova base');
  assert.equal(LX.Sync._pausado, true, 'conflito pausa o sync até uma escolha explícita');
  const temBackup = Object.keys(localStorage).some ?
    Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).some(k => k.indexOf('terminalis.backup.workspace/u3') === 0) :
    false;
  assert.ok(temBackup, 'o estado local vira um backup — nada é perdido em silêncio');
  assert.ok(await LX.Sync.resolverConflitoEscolha('remoto'), 'escolher o remoto retoma o laboratório');
  assert.equal(LX.Sync._pausado, false, 'a escolha explícita libera a sincronização');

  /* ---------- E. restauração reconstrói o ambiente noutra máquina ---------- */
  limpar();
  const prov4 = providerFalso();
  LX.Store.provider = prov4; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'u4' };
  const origem = appReal();
  await origem.sessao.run('mkdir -p /home/aluno/proj; echo "Olá Terminalis" > /home/aluno/proj/index.html; cd /home/aluno/proj; git init; git add index.html');
  LX.Sync.iniciar(origem);
  await LX.Sync.flushWorkspace();
  assert.ok(prov4.mem.workspaces['u4'], 'ambiente enviado à nuvem sem git commit');
  /* outro computador: app novo, máquina limpa, restaura da nuvem */
  const destino = appReal();
  LX.Sync.app = destino; LX.Sync._revisao = 0;
  const ok = await LX.Sync.restaurar('u4');
  assert.ok(ok, 'restauração deve ter sucesso');
  const m = destino._restaurado.machine;
  assert.equal(m.fs.readFile('/home/aluno/proj/index.html'), 'Olá Terminalis\n', 'o arquivo criado reaparece');
  const repo = LX.Git.Repo.find(destino._restaurado.shell);
  assert.equal(repo.d.index['index.html'], 'Olá Terminalis\n', 'o staging (git add sem commit) é restaurado');
  assert.equal(destino._restaurado.shell.cwd, '/home/aluno/proj', 'o diretório atual do terminal volta');

  /* ---------- F. migração de dados locais na primeira entrada em nuvem ---------- */
  limpar();
  const prov5 = providerFalso();
  LX.Store.provider = prov5; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'u5' };
  localStorage.setItem('terminalis.dados.v1/progresso/antigo', JSON.stringify({ lessons: { a: 1, b: 1, c: 1 }, tasks: {} }));
  const migrou = await LX.Sync.migrarLocais('u5');
  assert.ok(migrou, 'deve migrar o progresso local existente');
  assert.equal(Object.keys(prov5.mem.progresso['u5'].lessons).length, 3, 'as 3 aulas locais vão para a nuvem');
  assert.ok(localStorage.getItem('terminalis.migrado/u5'), 'marca a migração para não repetir');
  const migrou2 = await LX.Sync.migrarLocais('u5');
  assert.ok(!migrou2, 'não migra duas vezes');

  console.log('Cloud: progresso, conflito por revisão, offline→online, restauração de ambiente e migração passaram.');
})().catch(e => { console.error(e); process.exitCode = 1; });

