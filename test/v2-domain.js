const assert = require('node:assert/strict');
const { loadEngine } = require('./harness');
const LX = loadEngine();

assert.ok(LX.ChallengeCatalog, 'catálogo V2 deve carregar');
assert.ok(LX.ChallengeCatalog.technology('linux'), 'Linux deve estar registrado');
assert.ok(LX.ChallengeCatalog.technology('typescript'), 'tecnologias futuras também devem estar no catálogo');

LX.challenge({
  id: 'TEST-001', slug: 'desafio-de-teste', title: 'Desafio de teste',
  summary: 'Valida o contrato data-driven.', technology: 'linux',
  difficulty: 'easy', type: 'command', xp: 80,
  situation: 'Um ambiente controlado precisa ser verificado.',
  mission: 'Conclua o objetivo do teste.', objectives: ['Alterar o estado'],
  hints: ['Investigue primeiro.'], concepts: [{ term: 'estado', summary: 'O resultado observável da ação.' }],
  setup() {}, validate() { return { ok: true }; },
  explanation: 'O estado foi validado.', possibleSolution: 'Uma solução possível.'
});

assert.equal(LX.ChallengeCatalog.search({ query: 'desafio teste' }).length, 1);
assert.equal(LX.ChallengeCatalog.search({ technology: 'docker' }).length, 0);
assert.equal(LX.V2Progress.thresholdForLevel(1), 0);
assert.ok(LX.V2Progress.thresholdForLevel(4) > LX.V2Progress.thresholdForLevel(3));

const progress = {};
const started = LX.V2Progress.start('TEST-001', { mode: 'realistic', commandsAtStart: 3 }, progress);
assert.equal(started.mode, 'realistic');
LX.V2Progress.recordHint('TEST-001', 0, progress);
LX.V2Progress.recordHint('TEST-001', 0, progress);
assert.deepEqual(Array.from(progress.challengeAttempts['TEST-001'].hintsUsed), [0], 'dica repetida não duplica métrica');
LX.V2Progress.recordValidation('TEST-001', { ok: true }, progress);
const first = LX.V2Progress.complete('TEST-001', { commandsCount: 4 }, progress);
const repeated = LX.V2Progress.complete('TEST-001', { commandsCount: 9 }, progress);
assert.equal(first.awardedXp, 80);
assert.equal(repeated.awardedXp, 0, 'conclusão repetida não concede XP novamente');
assert.equal(LX.V2Progress.start('TEST-001', {}, progress).completedAt, first.completion.completedAt, 'reabrir não apaga a tentativa concluída');
assert.equal(LX.V2Progress.totalXp(progress), 80);
assert.equal(LX.V2Progress.summary(progress).completed, 1);
assert.equal(LX.V2Progress.summary(progress).withoutHints, 0);

assert.equal(LX.V2Progress.toggleFavorite('TEST-001', progress), true);
assert.equal(LX.V2Progress.toggleFavorite('TEST-001', progress), false);
assert.deepEqual(Array.from(progress.challengeFavorites), []);

assert.throws(() => LX.challenge({
  id: 'BAD', slug: 'Invalido', title: 'Inválido', summary: 'Registro inválido.',
  technology: 'linux', xp: 50, situation: 'Teste.', mission: 'Teste.',
  objectives: ['Teste'], hints: ['Teste'], setup() {}, validate() { return { ok: false }; },
  explanation: 'Teste.', possibleSolution: 'Teste.'
}), /slug/);

console.log('Terminalis V2 domain: catalog, search, levels and idempotent rewards passed.');
