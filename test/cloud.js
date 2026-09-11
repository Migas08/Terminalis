/* Sincronização em nuvem: progresso, conflito por revisão, offline→online,
   restauração do ambiente e migração de dados locais. Tudo em memória, com
   um provider mock — não depende de rede nem do Supabase real. */
const assert = require('node:assert/strict');
const { loadEngine, makeSession } = require('./harness');

const LX = loadEngine();
const localStorage = LX.__localStorage;   // o mesmo localStorage que o motor usa
const offlineOriginal = LX.Sync._offline;

/* Zera o estado global entre subtestes. */
function limpar() {
  if (LX.Sync._timer) clearTimeout(LX.Sync._timer);
  if (LX.Sync._timerProg) clearTimeout(LX.Sync._timerProg);
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
  LX.Sync._reflush = false;
  LX.Sync._assinatura = null;
  LX.Sync._pausado = false;
  LX.Sync._conflito = null;
  LX.Sync._timer = null;
  LX.Sync._timerProg = null;
  LX.Sync._offline = offlineOriginal;
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

  /* ---------- G. duas instâncias independentes (PC A → PC B → conflito) ---------- */
  limpar();
  const prov6 = providerFalso();
  LX.Store.provider = prov6; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'u6' };
  const pcA = appReal();
  LX.Sync.iniciar(pcA);
  await pcA.sessao.run('mkdir -p /home/aluno/projeto; echo "PC1" > /home/aluno/projeto/index.html');
  LX.Sync._sujo = true;
  await LX.Sync.flushWorkspace();
  assert.equal(prov6.mem.workspaces.u6.revision, 1, 'PC A grava a revisão 1');
  const pcB = appReal();
  LX.Sync.app = pcB; LX.Sync._revisao = 0;
  assert.ok(await LX.Sync.restaurar('u6'), 'PC B baixa a revisão 1');
  pcB.machine = pcB._restaurado.machine; pcB.term = pcB._restaurado.shell;
  pcB.machine.fs.appendFile('/home/aluno/projeto/index.html', 'PC2\n');
  LX.Sync._sujo = true;
  await LX.Sync.flushWorkspace();
  assert.equal(prov6.mem.workspaces.u6.revision, 2, 'PC B grava a revisão 2');
  LX.Sync.app = pcA; LX.Sync._revisao = 1; LX.Sync._assinatura = null; LX.Sync._pausado = false;
  await pcA.sessao.run('echo "PC1 atrasado" >> /home/aluno/projeto/index.html');
  LX.Sync._sujo = true;
  await LX.Sync.flushWorkspace();
  assert.equal(LX.Sync._pausado, true, 'PC A detecta conflito com a revisão 2');
  const remoto6 = LX.Workspace.importState(prov6.mem.workspaces.u6.snapshot);
  assert.match(remoto6.machine.fs.readFile('/home/aluno/projeto/index.html'), /PC2/, 'o trabalho do PC B não é apagado pelo PC A');

  /* ---------- H. reload durante debounce usa o cache imediato ---------- */
  limpar();
  LX.Auth.usuario = { uid: 'reload' };
  const antesReload = appReal();
  LX.Sync.iniciar(antesReload);
  await antesReload.sessao.run('echo debounce > /home/aluno/antes-do-reload.txt');
  assert.equal(LX.Sync.marcarSujo('workspace'), true, 'alteração deve agendar o debounce');
  assert.ok(LX.Sync._timer, 'o envio remoto ainda está aguardando o debounce');
  assert.ok(localStorage.getItem('terminalis.cache.workspace/reload'), 'o cache local é escrito antes do debounce');
  clearTimeout(LX.Sync._timer); LX.Sync._timer = null; // simula a página sendo encerrada
  const depoisReload = appReal();
  LX.Sync.app = depoisReload;
  assert.ok(await LX.Sync.restaurar('reload'), 'a nova página restaura o cache mesmo sem upload');
  assert.equal(depoisReload._restaurado.machine.fs.readFile('/home/aluno/antes-do-reload.txt'), 'debounce\n');

  /* ---------- I. logout durante gravação conclui o envio capturado ---------- */
  limpar();
  const provLogout = providerFalso();
  const saveLogout = provLogout.saveWorkspace.bind(provLogout);
  let liberarGravacao;
  let avisarInicio;
  const iniciouGravacao = new Promise(resolve => { avisarInicio = resolve; });
  const aguardarLogout = new Promise(resolve => { liberarGravacao = resolve; });
  provLogout.saveWorkspace = async (...args) => {
    avisarInicio();
    await aguardarLogout;
    return saveLogout(...args);
  };
  LX.Store.provider = provLogout; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'logout' };
  const appLogout = appReal();
  LX.Sync.iniciar(appLogout);
  await appLogout.sessao.run('echo logout > /home/aluno/logout.txt');
  LX.Sync._sujo = true;
  const capturaLogout = LX.Sync.capturarAgora();
  await iniciouGravacao;
  LX.Auth.usuario = null; // a conta é encerrada enquanto o provider responde
  liberarGravacao();
  await capturaLogout;
  assert.ok(provLogout.mem.workspaces.logout, 'o snapshot iniciado antes do logout chega ao provider');
  assert.equal(provLogout.mem.workspaces.logout.revision, 1, 'a gravação concluída mantém a revisão correta');

  /* ---------- J. indisponibilidade mantém cache e marca pendência ---------- */
  limpar();
  const provIndisponivel = providerFalso();
  provIndisponivel.saveWorkspace = async () => { throw new Error('Supabase indisponível'); };
  LX.Store.provider = provIndisponivel; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'sem-rede' };
  const appIndisponivel = appReal();
  LX.Sync.iniciar(appIndisponivel);
  await appIndisponivel.sessao.run('echo protegido > /home/aluno/indisponivel.txt');
  LX.Sync._sujo = true;
  const avisoOriginal = console.warn;
  const avisos = [];
  console.warn = (...args) => { avisos.push(args); };
  try { await LX.Sync.flushWorkspace(); } finally { console.warn = avisoOriginal; }
  assert.equal(LX.Sync._pendente, true, 'falha do provider deixa o envio pendente');
  assert.equal(LX.Sync._estado, 'erro', 'a interface recebe estado de erro');
  assert.ok(localStorage.getItem('terminalis.cache.workspace/sem-rede'), 'o snapshot continua no cache local');
  assert.match(String(avisos[0] && avisos[0][0]), /sem-rede.*revisão 0/, 'o diagnóstico identifica usuário e revisão');

  /* ---------- K. snapshots inválidos não substituem a máquina ativa ---------- */
  limpar();
  const provInvalido = providerFalso();
  LX.Store.provider = provInvalido; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'invalido' };
  const appInvalido = appReal();
  LX.Sync.iniciar(appInvalido);
  provInvalido.mem.workspaces.invalido = {
    version: 1, revision: 2, updatedAt: Date.now(),
    snapshot: { version: 1, machines: [], git: { format: 'vfs', repositoryFile: '.git/terminalis.json' } }
  };
  const avisosSnapshot = [];
  console.warn = (...args) => { avisosSnapshot.push(args); };
  try { assert.equal(await LX.Sync.restaurar('invalido'), false, 'snapshot estruturalmente inválido é recusado'); }
  finally { console.warn = avisoOriginal; }
  assert.equal(appInvalido._restaurado, null, 'a máquina ativa não é trocada por dados inválidos');

  const valido = LX.Workspace.exportState(appInvalido.machine, appInvalido.term);
  valido.version = LX.Workspace.VERSION + 1;
  provInvalido.mem.workspaces.invalido.snapshot = valido;
  console.warn = (...args) => { avisosSnapshot.push(args); };
  try { assert.equal(await LX.Sync.restaurar('invalido'), false, 'snapshot de outra versão é recusado'); }
  finally { console.warn = avisoOriginal; }
  assert.equal(appInvalido._restaurado, null, 'a versão incompatível também preserva a máquina ativa');
  assert.ok(avisosSnapshot.some(args => /snapshot de invalido recusado/.test(String(args[0]))), 'snapshot recusado deixa contexto no console');

  /* ---------- L. a escolha local vence somente após confirmação ---------- */
  limpar();
  const provEscolha = providerFalso();
  LX.Store.provider = provEscolha; LX.Store.modo = 'supabase';
  LX.Auth.usuario = { uid: 'escolha-local' };
  const remotoEscolha = appReal();
  await remotoEscolha.sessao.run('echo remoto > /home/aluno/escolha.txt');
  provEscolha.mem.workspaces['escolha-local'] = {
    version: 1, revision: 3, updatedAt: Date.now(),
    snapshot: LX.Workspace.exportState(remotoEscolha.machine, remotoEscolha.term)
  };
  const localEscolha = appReal();
  await localEscolha.sessao.run('echo local > /home/aluno/escolha.txt');
  LX.Sync.iniciar(localEscolha);
  LX.Sync._revisao = 1;
  LX.Sync._sujo = true;
  await LX.Sync.flushWorkspace();
  assert.equal(LX.Sync._pausado, true, 'a revisão antiga pausa antes de enviar a versão local');
  assert.equal(provEscolha.mem.workspaces['escolha-local'].revision, 3, 'o remoto não muda antes da escolha');
  assert.ok(await LX.Sync.resolverConflitoEscolha('local'), 'a escolha local é aceita');
  assert.equal(provEscolha.mem.workspaces['escolha-local'].revision, 4, 'a versão local cria uma nova revisão');
  const escolhido = LX.Workspace.importState(provEscolha.mem.workspaces['escolha-local'].snapshot);
  assert.equal(escolhido.machine.fs.readFile('/home/aluno/escolha.txt'), 'local\n', 'o conteúdo local escolhido chega à nuvem');

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

  console.log('Cloud: revisão, offline, reload, logout, restauração, snapshots inválidos, conflito e migração passaram.');
})().catch(e => { console.error(e); process.exitCode = 1; });

