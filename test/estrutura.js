/* Estrutura fixa de toda aula do curso: exatamente três tarefas, sempre na
   mesma ordem — um GUIADO (rode e leia), uma PERGUNTA (quiz ou completar) e
   uma PRÁTICA (faça no terminal, verificada pelo estado real).

   O aluno sempre sabe o que esperar, e nenhuma aula fica sem prática nem
   afogada em exercícios. */

const { loadEngine } = require('./harness');
const LX = loadEngine();

const ESPERADO = [
  { slot: 'guiado', aceita: ['guiado'] },
  { slot: 'pergunta', aceita: ['quiz', 'fill'] },
  { slot: 'prática', aceita: ['desafio'] }
];
const MODULOS_DIRETOS = new Set(['m01']);

let problemas = 0, aulas = 0;
for (const mod of LX.COURSE.modules) {
  for (const l of mod.lessons) {
    aulas++;
    const ts = l.tasks || [];
    const kinds = ts.map(t => t.kind);
    let erro = null;
    if (MODULOS_DIRETOS.has(mod.id) && !l.brief) erro = 'a aula ainda não possui leitura direta';
    if (l.brief) {
      const palavras = JSON.stringify(l.brief)
        .replace(/<[^>]+>/g, ' ')
        .replace(/[^A-Za-zÀ-ÿ0-9]+/g, ' ')
        .trim().split(/\s+/).filter(Boolean).length;
      if (!Array.isArray(l.brief) || !l.brief.length) erro = 'o resumo direto está vazio';
      else if (palavras > 220) erro = `o resumo direto tem ${palavras} palavras (máximo: 220)`;
    }
    if (ts.length !== 3) erro = `tem ${ts.length} tarefa(s): ${kinds.join(', ') || '(nenhuma)'}`;
    else {
      for (let i = 0; i < 3; i++) {
        if (!ESPERADO[i].aceita.includes(kinds[i])) {
          erro = `posição ${i + 1} deveria ser ${ESPERADO[i].slot} (${ESPERADO[i].aceita.join(' ou ')}), veio "${kinds[i]}" — ordem atual: ${kinds.join(', ')}`;
          break;
        }
      }
    }
    /* a prática precisa ter verificador, dicas e solução */
    if (!erro && ts[2]) {
      if (!ts[2].check) erro = 'a prática não tem verificador';
      else if (!ts[2].solution) erro = 'a prática não tem solução';
      else if (!(ts[2].hints || []).length) erro = 'a prática não tem dicas';
    }
    if (!erro && ts[1] && ts[1].kind === 'quiz') {
      const opts = ts[1].options || [];
      if (opts.length < 3) erro = 'a pergunta tem menos de 3 alternativas';
      else if (!opts.some(o => o.correct)) erro = 'a pergunta não tem alternativa correta marcada';
      else if (opts.filter(o => o.correct).length > 1) erro = 'a pergunta tem mais de uma alternativa correta';
      else if (opts.some(o => !o.correct && !o.why)) erro = 'há alternativa errada sem explicação (why)';
      else if (!ts[1].explain) erro = 'a pergunta não tem o campo `explain` (a UI mostra a explicação por ele, não por `solution`)';
    }
    if (erro) { problemas++; console.log(`  ✗ ${mod.id} ${l.n} ${l.title}\n      ${erro}`); }
  }
}

console.log(`\n=== estrutura: ${aulas} aulas · ${problemas} fora do padrão (3 tarefas: guiado · pergunta · prática) ===\n`);
process.exit(problemas ? 1 : 0);
