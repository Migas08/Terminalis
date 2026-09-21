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
  assert.equal(LX.ChallengeCatalog.search({ technology: 'linux' }).length, 9);
  assert.deepEqual(
    Array.from(LX.ChallengeCatalog.search({ technology: 'linux' }).map(challenge => challenge.id)),
    ['LINUX-006', 'LINUX-007', 'LINUX-001', 'LINUX-008', 'LINUX-009', 'LINUX-002', 'LINUX-004', 'LINUX-003', 'LINUX-005'],
    'a progressão deve começar no básico e avançar até o projeto'
  );
  assert.equal(LX.ChallengeCatalog.search({ format: 'training' }).length, 3);
  assert.equal(LX.ChallengeCatalog.search({ format: 'ticket' }).length, 4);
  assert.equal(LX.ChallengeCatalog.search({ format: 'incident' }).length, 1);
  assert.equal(LX.ChallengeCatalog.search({ format: 'project' }).length, 1);
  assert.equal(LX.ChallengeCatalog.isUnlocked('LINUX-006', {}), true);
  assert.deepEqual(Array.from(LX.ChallengeCatalog.unmetPrerequisites('LINUX-007', {})), ['LINUX-006']);
  await runSolution('LINUX-006', [
    'cd /srv/portal/releases/current',
    'pwd > /home/aluno/inspecao-deploy.txt',
    'ls -la >> /home/aluno/inspecao-deploy.txt'
  ]);
  await runSolution('LINUX-007', [
    'mkdir -p /srv/portal/releases/2026-09-22/app /srv/portal/releases/2026-09-22/config /srv/portal/releases/2026-09-22/logs',
    'cp /srv/portal/template/.env.example /srv/portal/releases/2026-09-22/config/app.env'
  ]);
  await runSolution('LINUX-001', [
    'mkdir -p /srv/migracao/backup',
    'mv /srv/migracao/*.sql /srv/migracao/backup/'
  ]);
  await runSolution('LINUX-008', [
    'grep "req-7f3a" /var/log/checkout/app.log | grep "ERROR" > /home/aluno/chamado-2187.log'
  ]);
  await runSolution('LINUX-009', [
    'du -sh /var/lib/terminalis/* | sort -hr | head -1 > /home/aluno/maior-consumo.txt'
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
  console.log('Terminalis V2 challenges: 9 Linux reference solutions passed.');
})().catch(error => { console.error(error); process.exit(1); });
