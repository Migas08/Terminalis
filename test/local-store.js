/* Persistência local (LX.LocalWorkspaceStore) e migrations do workspace.
   No Node não há IndexedDB, então esta suíte exercita o FALLBACK em localStorage
   (que também é o que roda quando o IndexedDB está bloqueado no navegador):
   cache, backups com retenção, migração idempotente e migrations versionadas.
   O caminho IndexedDB real é validado no navegador. */
const assert = require('node:assert/strict');
const { loadEngine } = require('./harness');

const LX = loadEngine();
const LWS = LX.LocalWorkspaceStore;
const localStorage = LX.__localStorage;

(async () => {
  assert.ok(LWS, 'LX.LocalWorkspaceStore deve existir');
  assert.equal(LWS.idbAtivo(), false, 'no Node não há IndexedDB — opera em fallback localStorage');

  /* ---------- cache: espelho síncrono no localStorage ---------- */
  localStorage.clear();
  const doc = { version: 1, revision: 3, updatedAt: 100, snapshot: { hi: 'a' } };
  LWS.setCurrent('u1', doc);
  assert.ok(localStorage.getItem('terminalis.cache.workspace/u1'), 'setCurrent grava o espelho síncrono');
  const got = await LWS.getCurrent('u1');
  assert.equal(got && got.snapshot.hi, 'a', 'getCurrent devolve o documento');
  assert.equal(LWS._localCache('u1').revision, 3, 'leitura síncrona do espelho');
  await LWS.deleteCurrent('u1');
  assert.equal(localStorage.getItem('terminalis.cache.workspace/u1'), null, 'deleteCurrent remove o cache');

  /* ---------- backups: retenção mantém os 5 mais recentes ---------- */
  localStorage.clear();
  for (let i = 1; i <= 7; i++) LWS.saveBackup('u2', { version: 1, updatedAt: i, snapshot: { n: i } }, 'u2.' + i);
  const bk = LWS.listBackupsLocal('u2');
  assert.equal(bk.length, 5, 'mantém no máximo 5 backups por usuário');
  assert.deepEqual(bk.map(b => b.doc.snapshot.n), [3, 4, 5, 6, 7], 'os 5 mais recentes sobrevivem, o recém-criado nunca é apagado');
  await LWS.deleteBackup('u2.7');
  assert.equal(LWS.listBackupsLocal('u2').length, 4, 'deleteBackup remove um backup');

  /* ---------- migração legada: no-op sem IndexedDB (nada é perdido) ---------- */
  localStorage.clear();
  localStorage.setItem('terminalis.cache.workspace/u3', JSON.stringify({ version: 1, revision: 2, updatedAt: 5, snapshot: { legacy: true } }));
  localStorage.setItem('terminalis.backup.workspace/u3.1', JSON.stringify({ version: 1, updatedAt: 1, snapshot: { b: 1 } }));
  const migrou = await LWS.migrarLegado('u3');
  assert.equal(migrou, false, 'sem IndexedDB, migrarLegado é no-op');
  assert.ok(localStorage.getItem('terminalis.cache.workspace/u3'), 'o cache legado permanece (nada perdido)');
  assert.ok(localStorage.getItem('terminalis.backup.workspace/u3.1'), 'o backup legado permanece');

  /* ---------- workspace migrations: subida sequencial e rejeições ---------- */
  const V = LX.Workspace.VERSION;
  const atual = { version: V, machines: [1] };
  assert.equal(LX.Workspace.migrar(atual), atual, 'snapshot na versão atual passa direto');
  assert.throws(() => LX.Workspace.migrar({ version: V + 1 }), /nova/, 'versão mais nova é rejeitada');
  assert.throws(() => LX.Workspace.migrar({ version: V - 1 }), /migração/i, 'versão antiga sem migração registrada é rejeitada');

  /* migração encadeada v(V-1) -> v(V) quando registrada (determinística) */
  LX.Workspace.migrations[V - 1] = (s) => Object.assign({}, s, { version: V, migrado: true });
  try {
    const subido = LX.Workspace.migrar({ version: V - 1, machines: [1] });
    assert.equal(subido.version, V, 'a migração registrada sobe até a versão atual');
    assert.equal(subido.migrado, true, 'a migração registrada foi aplicada');
  } finally { delete LX.Workspace.migrations[V - 1]; }

  console.log('LocalStore: cache/espelho, retenção de 5 backups, migração legada no-op sem IDB e migrations versionadas passaram.');
})().catch(e => { console.error(e); process.exitCode = 1; });
