const assert = require('node:assert/strict');
const { loadEngine, makeSession } = require('./harness');
const LX = loadEngine();

async function context(session) {
  return {
    machine: session.m, sh: session.sh,
    term: { history: [] },
    run: command => session.run(command)
  };
}

async function runSolution(id, commands) {
  const challenge = LX.ChallengeCatalog.challenge(id);
  assert.ok(challenge, id + ' deve existir');
  const session = makeSession(LX);
  challenge.setup(session.m, session.term);
  const before = await challenge.validate(await context(session));
  assert.equal(before.ok, false, id + ' não pode começar concluído');
  for (const command of commands) {
    const result = await session.run(command);
    assert.equal(result.status, 0, id + ': comando falhou: ' + command + '\n' + result.out);
  }
  const after = await challenge.validate(await context(session));
  assert.equal(after.ok, true, id + ': solução de referência não foi aceita: ' + after.msg);
}

(async () => {
  assert.equal(LX.ChallengeCatalog.search({ technology: 'linux' }).length, 5);
  await runSolution('LINUX-001', [
    'mkdir -p /srv/migracao/backup',
    'mv /srv/migracao/*.sql /srv/migracao/backup/'
  ]);
  await runSolution('LINUX-002', [
    'grep -R "API_ENDPOINT" /etc/terminalis /opt/legacy > /home/aluno/endpoint-encontrado.txt'
  ]);
  await runSolution('LINUX-003', [
    'sudo systemctl enable --now ssh'
  ]);
  await runSolution('LINUX-004', [
    'sudo chown root:www-data /srv/financeiro/fechamento.csv',
    'sudo chmod 640 /srv/financeiro/fechamento.csv'
  ]);
  await runSolution('LINUX-005', [
    'sudo tar -czf /var/backups/aplicacao.tar.gz -C /srv aplicacao',
    'cd /var/backups',
    'sha256sum aplicacao.tar.gz | sudo tee aplicacao.sha256',
    'printf "/var/backups/aplicacao.tar.gz\\n/var/backups/aplicacao.sha256\\n" > /home/aluno/entrega-backup.txt'
  ]);
  console.log('Terminalis V2 challenges: 5 Linux reference solutions passed.');
})().catch(error => { console.error(error); process.exit(1); });
