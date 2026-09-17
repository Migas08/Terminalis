/* Contrato estrutural da trilha JavaScript: profundidade, progressão, IDs e
   componentes pedagógicos de todas as aulas. */
const assert = require('node:assert/strict');
const { loadEngine } = require('./harness');
const LX = loadEngine();

const trilha = LX.trilhaPorId('js');
assert.ok(trilha, 'trilha JavaScript registrada');
assert.equal(trilha.mods.length, 13, '12 módulos + projeto final');

const modulos = trilha.mods.map(id => LX.COURSE.modules.find(modulo => modulo.id === id));
assert.equal(modulos.filter(Boolean).length, 13, 'todos os módulos existem');

const idsAulas = new Set();
const idsTarefas = new Set();
let totalAulas = 0;
let totalTarefas = 0;

for (const modulo of modulos) {
  assert.equal(modulo.lessons.length, 5, modulo.id + ' deve ter cinco aulas');
  for (const aula of modulo.lessons) {
    totalAulas += 1;
    assert.ok(!idsAulas.has(aula.id), 'ID de aula único: ' + aula.id);
    idsAulas.add(aula.id);
    assert.ok(aula.title && aula.goal, aula.id + ' possui título e objetivo');
    const texto = JSON.stringify(aula.body || []);
    assert.ok(texto.length >= 180, aula.id + ' possui explicação substancial');
    assert.doesNotMatch(texto, /em breve|lorem ipsum|TODO/, aula.id + ' não possui placeholder');
    assert.equal((aula.tasks || []).length, 3, aula.id + ' possui prática guiada, quiz e desafio');
    assert.equal(Array.from(aula.tasks, tarefa => tarefa.kind).join(','), 'guiado,quiz,desafio', aula.id + ' mantém a sequência pedagógica');

    for (const tarefa of aula.tasks) {
      totalTarefas += 1;
      assert.ok(!idsTarefas.has(tarefa.id), 'ID de tarefa único: ' + tarefa.id);
      idsTarefas.add(tarefa.id);
    }
    const quiz = aula.tasks[1];
    assert.equal(quiz.options.filter(opcao => opcao.correct).length, 1, aula.id + ' possui uma resposta correta');
    const desafio = aula.tasks[2];
    assert.equal(typeof desafio.check, 'function', aula.id + ' possui verificador');
    assert.match(String(desafio.solution || ''), /<pre>/, aula.id + ' possui solução executável');
  }
}

assert.equal(totalAulas, 65, 'currículo possui 65 aulas');
assert.equal(totalTarefas, 195, 'cada aula possui três atividades');

/* IDs publicados antes da expansão permanecem válidos para o progresso salvo. */
for (const id of ['js1-1', 'js1-2', 'js2-1', 'js3-1', 'js4-1', 'js5-1', 'js6-1', 'js7-1', 'js8-1', 'js9-1', 'js10-1', 'js11-1', 'js12-1', 'jspf-1']) {
  assert.ok(idsAulas.has(id), 'ID legado preservado: ' + id);
}

/* Os títulos dos módulos agora são sustentados por conteúdo real. */
const cobertura = {
  js01: ['Operadores', 'Decisões', 'depuração'],
  js02: ['Conversões', 'template literals', 'Validar dados'],
  js03: ['parâmetros', 'hoisting', 'Callbacks', 'memoização'],
  js04: ['desestruturação', 'Prototype', 'Descritores', 'campos privados'],
  js05: ['Arrays', 'Map, Set', 'generators', 'assíncrona'],
  js06: ['live bindings', 'import dinâmico', 'CommonJS', 'package.json'],
  js07: ['Promise', 'Combinadores', 'Event loop', 'Cancelamento'],
  js08: ['DOM', 'Eventos', 'Fetch', 'workers'],
  js09: ['Processo', 'Buffer', 'Streams', 'encerramento gracioso'],
  js10: ['HTTP', 'idempotência', 'Autenticação', 'Middleware'],
  js11: ['testes', 'XSS', 'prototype pollution', 'métricas'],
  js12: ['inversão de dependência', 'Ports and adapters', 'Profiling', 'deploy'],
  jspf: ['Contrato', 'persistência', 'segurança', 'Testes']
};
for (const modulo of modulos) {
  const texto = modulo.lessons.map(aula => aula.title + ' ' + aula.goal + ' ' + JSON.stringify(aula.body)).join(' ');
  for (const termo of cobertura[modulo.id]) assert.match(texto, new RegExp(termo, 'i'), modulo.id + ' cobre ' + termo);
}

const fonteBase = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/89-js-course.js'), 'utf8');
assert.doesNotMatch(fonteBase, /falsy<\/strong> apenas seis valores/, 'lista de falsy corrigida');
assert.doesNotMatch(fonteBase, /busca em tempo constante/, 'Map sem garantia absoluta de O(1)');
assert.doesNotMatch(fonteBase, /JSON\.parse<\/code> é seguro para texto vindo de fora/, 'JSON externo não é chamado de automaticamente seguro');
assert.match(fonteBase, /readFile\('dados\.txt', 'utf8'\)/, 'leitura textual declara encoding');
assert.match(fonteBase, /Object\.freeze[\s\S]{0,200}raso/, 'freeze documentado como raso');

console.log('Currículo JavaScript: 13 módulos, 65 aulas, 195 atividades, IDs estáveis e cobertura completa validados.');
