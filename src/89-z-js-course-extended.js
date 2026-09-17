/* =========================================================================
   TERMINALIS — currículo expandido de JavaScript

   Mantém as aulas publicadas em 89-js-course.js e acrescenta a progressão que
   liga fundamentos, browser, Node, backend e produção. Os IDs antigos não são
   alterados; novos IDs são estáveis para preservar o progresso do aluno.
   ========================================================================= */
'use strict';
(function () {
  const DIR = '/home/aluno/js';

  function escapar(valor) {
    return String(valor)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function semear(def) {
    return (m) => {
      const ctx = m.ctxRoot();
      const dir = m.fs.mkdirp(DIR, { ctx }); dir.uid = 1000; dir.gid = 1000;
      const arq = m.fs.writeFile(DIR + '/' + def.seed, '// ' + def.title + '\n// TODO: implemente o desafio desta aula.\n', { ctx });
      arq.uid = 1000; arq.gid = 1000;
    };
  }

  function satisfaz(codigo, regra) {
    const flags = regra.re.flags.replace(/g/g, '');
    const re = new RegExp(regra.re.source, flags);
    if (!regra.count) return re.test(codigo);
    const global = new RegExp(regra.re.source, flags + 'g');
    return (codigo.match(global) || []).length >= regra.count;
  }

  function estruturaBalanceada(codigo) {
    const pares = { ')': '(', ']': '[', '}': '{' };
    const pilha = [];
    let aspas = null, escape = false, linha = false, bloco = false;
    for (let i = 0; i < codigo.length; i += 1) {
      const atual = codigo[i], proximo = codigo[i + 1];
      if (linha) { if (atual === '\n') linha = false; continue; }
      if (bloco) { if (atual === '*' && proximo === '/') { bloco = false; i += 1; } continue; }
      if (aspas) {
        if (escape) { escape = false; continue; }
        if (atual === '\\') { escape = true; continue; }
        if (atual === aspas) aspas = null;
        continue;
      }
      if (atual === '/' && proximo === '/') { linha = true; i += 1; continue; }
      if (atual === '/' && proximo === '*') { bloco = true; i += 1; continue; }
      if (atual === '"' || atual === "'" || atual === '`') { aspas = atual; continue; }
      if (atual === '(' || atual === '[' || atual === '{') pilha.push(atual);
      if (pares[atual] && pilha.pop() !== pares[atual]) return false;
    }
    return pilha.length === 0 && aspas === null && !bloco;
  }

  function pontuar(codigo, regras) {
    return regras.reduce((total, regra) => total + (satisfaz(codigo, regra) ? 1 : 0), 0);
  }

  /* A execução continua isolada no runner. O verificador de conteúdo não usa
     eval no domínio da aplicação: exige um arquivo próprio, rejeita rascunhos e
     valida a estrutura específica de cada comportamento pedido. */
  function validar(def) {
    return async (ctx) => {
      const H = LX.H;
      const nomes = (H.ls(ctx, DIR) || []).filter(nome =>
        typeof nome === 'string' && /\.(?:js|mjs|cjs)$/i.test(nome) && nome !== def.seed && nome !== 'ola.js'
      );
      const candidatos = nomes.map(nome => ({ nome, codigo: H.read(ctx, DIR + '/' + nome) || '' }));
      candidatos.sort((a, b) => pontuar(b.codigo, def.rules) - pontuar(a.codigo, def.rules));
      const melhor = candidatos[0] || { codigo: '' };
      const checks = [
        [() => candidatos.length > 0, 'Crie um arquivo JavaScript próprio no <strong>Code Lab</strong>.'],
        [() => melhor.codigo.trim().length >= 24, 'O arquivo ainda está curto demais para resolver o comportamento pedido.'],
        [() => !/\bTODO\b|implemente o desafio/i.test(melhor.codigo), 'Remova o <code>TODO</code> e conclua a implementação.'],
        [() => estruturaBalanceada(melhor.codigo), 'Revise parênteses, colchetes, chaves e aspas: a estrutura está incompleta.']
      ];
      for (const regra of def.rules) checks.push([() => satisfaz(melhor.codigo, regra), regra.msg]);
      for (const proibida of (def.forbid || [])) checks.push([() => !satisfaz(melhor.codigo, proibida), proibida.msg]);
      return H.checkAll(checks);
    };
  }

  function solucao(def) {
    const codigo = def.solution.join('\n');
    return '<p>Uma implementação possível, que você deve entender e adaptar:</p><pre>cat &lt;&lt;\'EOF\' &gt; ' +
      DIR + '/resposta-' + def.id + '.js\n' + escapar(codigo) + '\nEOF</pre>';
  }

  function registrar(modulo, def) {
    LX.lesson(modulo, {
      id: def.id, n: def.n, title: def.title, goal: def.goal,
      setup: semear(def),
      body: [
        { h2: def.title },
        { p: def.concept },
        { p: def.detail },
        { code: def.example, lang: 'js', run: false },
        { box: 'key', label: 'Conexão', body: [{ p: def.connection }] },
        { box: 'warn', label: 'Erro comum', body: [{ p: def.pitfall }] }
      ],
      tasks: [
        {
          id: def.id + '-a', kind: 'guiado', title: 'Experimente o conceito',
          body: [{ p: 'Abra o exemplo no <strong>Code Lab</strong>, execute e explique a saída com suas palavras. Depois altere uma entrada e observe o que muda.' }],
          hints: ['Leia a saída linha por linha e compare com o valor que você previa antes de rodar.']
        },
        {
          id: def.id + '-q', kind: 'quiz', title: 'Confira o entendimento',
          body: [{ p: def.question }],
          options: [
            { text: def.correct, correct: true },
            { text: def.wrong, why: def.whyWrong },
            { text: 'Depende apenas do nome das variáveis.', why: 'Nomes ajudam a leitura, mas não mudam as regras de execução da linguagem.' }
          ],
          explain: def.explain,
          hints: ['Volte ao exemplo e acompanhe cada expressão na ordem em que é avaliada.']
        },
        {
          id: def.id + '-b', kind: 'desafio', title: def.challengeTitle,
          body: [{ p: def.challenge }],
          hints: def.hints,
          solution: solucao(def),
          check: validar(def)
        }
      ]
    });
  }

  const CURRICULO = {
    js01: [
      {
        id: 'js1-3', n: '1.3', title: 'Operadores e expressões', seed: 'operadores.js',
        goal: 'Combinar valores com operadores e prever a ordem de avaliação.',
        concept: 'Uma <strong>expressão</strong> produz um valor. Operadores aritméticos, relacionais e lógicos permitem transformar e comparar valores; parênteses deixam a precedência explícita.',
        detail: '<code>===</code> compara sem coerção. <code>&amp;&amp;</code> e <code>||</code> fazem curto-circuito e devolvem um dos operandos, não necessariamente um booleano.',
        example: ['const subtotal = 40 + 2 * 5;', 'const aprovado = subtotal >= 50 && subtotal < 100;', "console.log(subtotal, aprovado); // 50 true"],
        connection: 'Agora que valores podem ser guardados, expressões permitem calcular decisões usadas na próxima aula.',
        pitfall: 'Confiar na memória da precedência. Quando a intenção não estiver óbvia, use parênteses.',
        question: 'Quanto vale <code>2 + 3 * 4</code>?', correct: '<code>14</code>, porque a multiplicação ocorre antes da soma.',
        wrong: '<code>20</code>, porque tudo é executado da esquerda para a direita.', whyWrong: 'A precedência faz <code>3 * 4</code> acontecer antes.', explain: 'Operadores possuem precedência; parênteses podem torná-la explícita.',
        challengeTitle: 'Calcule um total válido', challenge: 'Calcule preço vezes quantidade, aplique um desconto e produza um booleano que diga se o total final é positivo. Mostre total e booleano.',
        hints: ['Separe subtotal e total em constantes.', 'Use ao menos um operador aritmético e uma comparação.'],
        solution: ['const preco = 25;', 'const quantidade = 3;', 'const desconto = 10;', 'const subtotal = preco * quantidade;', 'const total = subtotal - desconto;', 'const valido = total > 0;', "console.log('total', total, 'valido', valido);"],
        rules: [
          { re: /\bconst\s+\w+\s*=\s*[^;]*(?:\*|\/|\+|-)/, msg: 'Crie um cálculo aritmético e guarde o resultado.' },
          { re: /(?:>|<|===|!==|>=|<=)/, msg: 'Produza o booleano com uma comparação.' },
          { re: /console\.log\s*\([^)]*,[^)]*\)/, msg: 'Mostre o total e o booleano no console.' }
        ]
      },
      {
        id: 'js1-4', n: '1.4', title: 'Decisões com if e switch', seed: 'decisoes.js',
        goal: 'Escolher caminhos de execução com condições explícitas.',
        concept: '<code>if</code>, <code>else if</code> e <code>else</code> selecionam um bloco a partir de uma condição. O ternário é útil para uma escolha curta que produz um valor.',
        detail: '<code>switch</code> organiza vários casos discretos. Cada caminho precisa ser legível e cobrir também entradas inesperadas.',
        example: ['const status = 201;', "let mensagem = 'erro';", "if (status >= 200 && status < 300) mensagem = 'sucesso';", 'console.log(mensagem);'],
        connection: 'As comparações da aula anterior passam a controlar quais instruções serão executadas.',
        pitfall: 'Esquecer chaves ou deixar um <code>switch</code> cair no caso seguinte sem intenção.',
        question: 'Quando usar um ternário?', correct: 'Quando uma condição curta escolhe entre dois valores simples.',
        wrong: 'Para substituir qualquer sequência longa de if/else.', whyWrong: 'Ternários aninhados escondem a intenção e prejudicam a leitura.', explain: 'Escolha a estrutura que deixa os caminhos mais claros.',
        challengeTitle: 'Classifique uma nota', challenge: 'Crie uma função que receba uma nota e devolva aprovado, recuperação ou reprovado usando condições. Mostre os três casos.',
        hints: ['Teste primeiro a faixa mais alta.', 'Devolva uma string em cada caminho.'],
        solution: ['function classificar(nota) {', "  if (nota >= 7) return 'aprovado';", "  if (nota >= 5) return 'recuperacao';", "  return 'reprovado';", '}', 'console.log(classificar(8), classificar(6), classificar(3));'],
        rules: [
          { re: /function\s+\w+\s*\([^)]*\)/, msg: 'Defina uma função que receba a nota.' },
          { re: /\bif\s*\([^)]*(?:>=|>)/, msg: 'Use condições para separar as faixas.' },
          { re: /return\s+['"][^'"]+['"]/, msg: 'Devolva uma classificação textual.' },
          { re: /console\.log\s*\([^)]*\w+\s*\(/, msg: 'Exercite a função com valores diferentes.' }
        ]
      },
      {
        id: 'js1-5', n: '1.5', title: 'Repetição, erros e depuração', seed: 'repeticao.js',
        goal: 'Percorrer dados sem laços infinitos e localizar falhas pelo erro.',
        concept: '<code>for</code>, <code>for...of</code> e <code>while</code> repetem um bloco. Todo laço precisa de uma condição de término observável.',
        detail: 'Ao depurar, reduza o problema, leia a primeira linha útil da stack trace e registre valores na fronteira onde o resultado deixa de ser o esperado.',
        example: ['const valores = [2, 4, 6];', 'let soma = 0;', 'for (const valor of valores) soma += valor;', 'console.log(soma); // 12'],
        connection: 'Decisões dentro de laços permitem processar coleções; arrays serão aprofundados depois.',
        pitfall: 'Alterar a variável errada ou esquecer de avançar a condição de um <code>while</code>.',
        question: 'Qual laço expressa melhor “para cada item de um array”?', correct: '<code>for...of</code>.',
        wrong: '<code>while (true)</code> sem interrupção.', whyWrong: 'Sem uma condição de saída, o laço não termina.', explain: '<code>for...of</code> comunica diretamente a intenção de percorrer valores.',
        challengeTitle: 'Some apenas os pares', challenge: 'Percorra um array com um laço, use uma condição para somar somente números pares e mostre o total.',
        hints: ['O resto da divisão por 2 identifica números pares.', 'Inicialize o acumulador antes do laço.'],
        solution: ['const numeros = [1, 2, 3, 4, 5, 6];', 'let total = 0;', 'for (const numero of numeros) {', '  if (numero % 2 === 0) total += numero;', '}', "console.log('pares', total);"],
        rules: [
          { re: /for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)/, msg: 'Percorra o array com <code>for...of</code>.' },
          { re: /%\s*2\s*===\s*0/, msg: 'Teste se o número é par pelo resto da divisão.' },
          { re: /\+=/, msg: 'Acumule os pares em uma variável.' },
          { re: /console\.log/, msg: 'Mostre o total calculado.' }
        ]
      }
    ],
    js03: [
      {
        id: 'js3-2', n: '3.2', title: 'Formas de função e parâmetros', seed: 'funcoes.js',
        goal: 'Escolher uma forma de função e modelar entradas e retornos.',
        concept: 'Declarações, expressões e arrow functions criam valores chamáveis. Parâmetros padrão tratam ausência; rest reúne argumentos adicionais em um array.',
        detail: 'Uma função pequena deve ter uma responsabilidade, receber tudo de que precisa e devolver um resultado previsível.',
        example: ['function somar(a, b = 0) { return a + b; }', 'const dobrar = valor => valor * 2;', 'const total = (...valores) => valores.reduce((s, n) => s + n, 0);'],
        connection: 'Com tipos e validação dominados, funções passam a encapsular contratos reutilizáveis.',
        pitfall: 'Misturar cálculo com console ou estado global torna a função difícil de testar.',
        question: 'O que um parâmetro rest recebe?', correct: 'Um array com os argumentos restantes.', wrong: 'Somente o primeiro argumento.', whyWrong: 'Rest agrupa zero ou mais argumentos.', explain: 'A sintaxe <code>...nome</code> reúne os argumentos restantes.',
        challengeTitle: 'Resuma valores', challenge: 'Crie resumir(prefixo, ...valores) que use um parâmetro padrão, some os valores e devolva uma string. Mostre duas chamadas.',
        hints: ['Defina prefixo com valor padrão.', 'Use rest para os números.'],
        solution: ["function resumir(prefixo = 'total', ...valores) {", '  const soma = valores.reduce((acc, valor) => acc + valor, 0);', "  return prefixo + ': ' + soma;", '}', "console.log(resumir(undefined, 2, 3), resumir('pontos', 4, 5));"],
        rules: [
          { re: /function\s+\w+\s*\([^)]*=\s*['"][^'"]+['"][^)]*\.\.\./, msg: 'Use parâmetro padrão e parâmetro rest.' },
          { re: /\.reduce\s*\(/, msg: 'Some os valores recebidos.' },
          { re: /return\s+/, msg: 'Devolva a mensagem montada.' },
          { re: /console\.log\s*\([^)]*\w+\s*\(/, msg: 'Mostre chamadas da função.' }
        ]
      },
      {
        id: 'js3-3', n: '3.3', title: 'Escopo, hoisting e TDZ', seed: 'escopo.js',
        goal: 'Prever onde cada nome existe e evitar dependência de hoisting.',
        concept: '<code>let</code> e <code>const</code> têm escopo de bloco e ficam na temporal dead zone antes da declaração. <code>var</code> tem escopo de função e comportamento de hoisting diferente.',
        detail: 'Declarações de função são içadas; expressões atribuídas a const só podem ser chamadas depois da inicialização. Declare perto do uso e reduza escopos.',
        example: ['const fora = 1;', '{', '  const dentro = 2;', '  console.log(fora + dentro);', '}', '// dentro não existe aqui'],
        connection: 'Escopo explica por que closures lembram valores e prepara o uso consciente de callbacks.',
        pitfall: 'Trocar <code>let</code> por <code>var</code> para “consertar” um erro de escopo apenas esconde o problema.',
        question: 'Onde uma const declarada dentro de um bloco existe?', correct: 'Do ponto da declaração até o fim daquele bloco.', wrong: 'Em todo o arquivo, inclusive antes da declaração.', whyWrong: 'Const possui escopo de bloco e TDZ.', explain: 'Blocos limitam nomes e reduzem interferência entre partes do programa.',
        challengeTitle: 'Isole um contador', challenge: 'Crie uma função que use um for com let e acumule um valor em variável local. Mostre o retorno e não dependa de variáveis globais.',
        hints: ['Declare o acumulador dentro da função.', 'Use let no índice do for.'],
        solution: ['function somarAte(limite) {', '  let total = 0;', '  for (let indice = 1; indice <= limite; indice += 1) {', '    total += indice;', '  }', '  return total;', '}', 'console.log(somarAte(5));'],
        rules: [
          { re: /function\s+\w+\s*\([^)]*\)\s*\{\s*let\s+\w+/s, msg: 'Mantenha o acumulador no escopo da função.' },
          { re: /for\s*\(\s*let\s+/, msg: 'Use um índice com escopo do laço.' },
          { re: /return\s+\w+/, msg: 'Devolva o valor calculado.' }
        ],
        forbid: [{ re: /^(?:let|var)\s+total\b/m, msg: 'Não crie o acumulador no escopo global.' }]
      },
      {
        id: 'js3-4', n: '3.4', title: 'Callbacks e o valor de this', seed: 'callbacks.js',
        goal: 'Passar funções como valores e controlar o contexto de métodos.',
        concept: 'Callback é uma função entregue para outra função chamar. O valor de <code>this</code> depende de como uma função comum é chamada; arrows capturam o this léxico.',
        detail: '<code>call</code>, <code>apply</code> e <code>bind</code> tornam o receptor explícito. Em código novo, prefira dependências por parâmetros quando isso for mais simples.',
        example: ['function executar(valor, transformar) { return transformar(valor); }', 'const dobro = executar(4, n => n * 2);', 'console.log(dobro);'],
        connection: 'Funções como valores sustentam métodos de arrays, eventos, Promises e middleware.',
        pitfall: 'Passar <code>obj.metodo</code> isoladamente pode perder o objeto que fornecia <code>this</code>.',
        question: 'O que <code>bind</code> devolve?', correct: 'Uma nova função com this e, opcionalmente, argumentos pré-fixados.', wrong: 'O resultado imediato da função original.', whyWrong: 'Bind cria uma função; call e apply chamam imediatamente.', explain: 'Bind prepara uma chamada futura com contexto controlado.',
        challengeTitle: 'Transforme com callback', challenge: 'Crie aplicar(valor, callback), passe uma arrow function e também demonstre bind em um método que usa this.',
        hints: ['A função aplicar deve chamar callback(valor).', 'Crie um objeto com fator e um método normal.'],
        solution: ['function aplicar(valor, callback) { return callback(valor); }', 'const escala = { fator: 3, multiplicar(valor) { return valor * this.fator; } };', 'const triplicar = escala.multiplicar.bind(escala);', 'console.log(aplicar(5, valor => valor + 1));', 'console.log(aplicar(5, triplicar));'],
        rules: [
          { re: /function\s+\w+\s*\([^,]+,\s*\w+\)[\s\S]*\w+\s*\([^)]*\)/, msg: 'Receba e invoque um callback.' },
          { re: /=>/, msg: 'Passe uma arrow function como valor.' },
          { re: /\bthis\./, msg: 'Crie um método que use <code>this</code>.' },
          { re: /\.bind\s*\(/, msg: 'Demonstre o vínculo explícito com <code>bind</code>.' }
        ]
      },
      {
        id: 'js3-5', n: '3.5', title: 'Recursão, fábricas e memoização', seed: 'fabricas.js',
        goal: 'Criar estado encapsulado e cachear cálculos puros.',
        concept: 'Factory functions devolvem objetos ou funções configuradas e podem encapsular estado em closures. Recursão exige um caso-base que encerre as chamadas.',
        detail: 'Memoização guarda o resultado de uma função pura por entrada. Só aplique depois de medir e quando as chaves do cache forem estáveis.',
        example: ['function criarContador() {', '  let valor = 0;', '  return () => { valor += 1; return valor; };', '}', 'const proximo = criarContador();'],
        connection: 'Closures deixam de ser curiosidade e passam a resolver encapsulamento e cache.',
        pitfall: 'Memoizar funções com efeitos colaterais ou permitir que o cache cresça para sempre.',
        question: 'O que impede uma recursão de continuar indefinidamente?', correct: 'Um caso-base alcançável.', wrong: 'O nome da função ser curto.', whyWrong: 'A terminação depende dos dados e da condição de parada.', explain: 'Cada chamada precisa se aproximar do caso-base.',
        challengeTitle: 'Crie uma função memoizada', challenge: 'Implemente uma factory memoizar(fn) usando Map. A função devolvida deve reutilizar o resultado para a mesma entrada.',
        hints: ['Crie o Map dentro da factory.', 'Teste has antes de executar fn.'],
        solution: ['function memoizar(fn) {', '  const cache = new Map();', '  return function (entrada) {', '    if (cache.has(entrada)) return cache.get(entrada);', '    const resultado = fn(entrada);', '    cache.set(entrada, resultado);', '    return resultado;', '  };', '}', 'const quadrado = memoizar(n => n * n);', 'console.log(quadrado(4), quadrado(4));'],
        rules: [
          { re: /function\s+memoizar\s*\(/, msg: 'Crie a factory <code>memoizar</code>.' },
          { re: /new\s+Map\s*\(/, msg: 'Mantenha um cache em Map.' },
          { re: /\.has\s*\([^)]*\)[\s\S]*\.get\s*\(/, msg: 'Reutilize resultados existentes.' },
          { re: /\.set\s*\(/, msg: 'Guarde resultados novos no cache.' }
        ]
      }
    ],
    js04: [
      {
        id: 'js4-2', n: '4.2', title: 'Propriedades, cópia e desestruturação', seed: 'objetos.js',
        goal: 'Ler, copiar e recompor objetos sem compartilhar mutações acidentais.',
        concept: 'Objetos agrupam propriedades. Desestruturação extrai campos; spread cria uma cópia rasa com substituições explícitas.',
        detail: 'Objetos são valores de referência: duas variáveis podem apontar para o mesmo objeto. Cópia rasa não duplica objetos aninhados.',
        example: ['const original = { nome: \'Ana\', perfil: { ativo: true } };', 'const atualizado = { ...original, nome: \'Bia\' };', 'const { nome } = atualizado;', 'console.log(nome);'],
        connection: 'Antes de estudar prototypes, é essencial dominar propriedades próprias e referências.',
        pitfall: 'Achar que spread faz deep clone; propriedades aninhadas continuam compartilhadas.',
        question: 'O spread de objeto cria que tipo de cópia?', correct: 'Uma cópia rasa das propriedades enumeráveis.', wrong: 'Uma cópia profunda de toda a árvore.', whyWrong: 'Objetos aninhados mantêm a mesma referência.', explain: 'Cópia rasa separa o primeiro nível apenas.',
        challengeTitle: 'Atualize sem alterar o original', challenge: 'Crie atualizarEmail(usuario, email) que devolva um novo objeto com o novo email. Demonstre que o original permanece igual.',
        hints: ['Use spread no retorno.', 'Compare as referências e os emails.'],
        solution: ['function atualizarEmail(usuario, email) {', '  return { ...usuario, email };', '}', "const original = { nome: 'Ana', email: 'a@x.test' };", "const novo = atualizarEmail(original, 'b@x.test');", 'console.log(original.email, novo.email, original !== novo);'],
        rules: [
          { re: /function\s+\w+\s*\([^)]*,[^)]*\)/, msg: 'Receba o objeto e o novo email.' },
          { re: /return\s*\{\s*\.\.\.\w+\s*,\s*email/s, msg: 'Crie um novo objeto com spread.' },
          { re: /!==/, msg: 'Demonstre que as referências são diferentes.' },
          { re: /console\.log/, msg: 'Mostre original e resultado.' }
        ]
      },
      {
        id: 'js4-3', n: '4.3', title: 'Prototype chain e propriedades próprias', seed: 'prototypes.js',
        goal: 'Distinguir propriedade própria de propriedade herdada.',
        concept: 'Quando uma propriedade não existe no objeto, JavaScript continua a busca pelo prototype. <code>Object.create</code> escolhe explicitamente esse elo.',
        detail: '<code>Object.hasOwn</code> testa somente propriedades próprias; o operador <code>in</code> inclui a cadeia de prototypes.',
        example: ["const base = { tipo: 'base' };", 'const item = Object.create(base);', 'item.id = 1;', "console.log(Object.hasOwn(item, 'id'), 'tipo' in item);"],
        connection: 'Classes são uma sintaxe sobre esse mecanismo; entender lookup evita “magia”.',
        pitfall: 'Usar <code>obj.hasOwnProperty</code> em objetos sem prototype ou com método sobrescrito.',
        question: 'O operador in considera propriedades herdadas?', correct: 'Sim, ele percorre a cadeia de prototypes.', wrong: 'Não, apenas Object.hasOwn faz isso.', whyWrong: 'Object.hasOwn restringe; in inclui herança.', explain: 'Escolha o teste conforme o contrato desejado.',
        challengeTitle: 'Modele uma herança explícita', challenge: 'Crie um objeto base, derive outro com Object.create, adicione uma propriedade própria e mostre resultados diferentes para Object.hasOwn e in.',
        hints: ['A propriedade herdada deve existir apenas no objeto base.', 'Teste a mesma chave herdada de duas formas.'],
        solution: ["const base = { categoria: 'curso' };", 'const aula = Object.create(base);', 'aula.id = 7;', "console.log(Object.hasOwn(aula, 'categoria'));", "console.log('categoria' in aula, Object.hasOwn(aula, 'id'));"],
        rules: [
          { re: /Object\.create\s*\(/, msg: 'Crie o objeto derivado com Object.create.' },
          { re: /Object\.hasOwn\s*\(/, msg: 'Teste uma propriedade própria.' },
          { re: /['"][^'"]+['"]\s+in\s+\w+/, msg: 'Teste a cadeia com o operador in.' },
          { re: /console\.log/, msg: 'Mostre os resultados.' }
        ]
      },
      {
        id: 'js4-4', n: '4.4', title: 'Descritores, seal e freeze', seed: 'descritores.js',
        goal: 'Controlar escrita, enumeração e extensão de objetos.',
        concept: 'Descritores definem <code>writable</code>, <code>enumerable</code> e <code>configurable</code>. <code>seal</code> impede adicionar/remover propriedades; <code>freeze</code> também impede reatribuir as existentes.',
        detail: 'Essas operações são rasas. Um objeto aninhado continua mutável até ser tratado separadamente.',
        example: ['const config = { tema: { nome: \'escuro\' } };', 'Object.freeze(config);', "config.tema.nome = 'claro'; // ainda muda o objeto aninhado", 'console.log(config.tema.nome);'],
        connection: 'Imutabilidade real exige entender profundidade e referências, não apenas chamar freeze.',
        pitfall: 'Prometer deep freeze quando somente o primeiro nível foi congelado.',
        question: 'Object.freeze congela automaticamente objetos aninhados?', correct: 'Não; o congelamento é raso.', wrong: 'Sim, toda a árvore fica imutável.', whyWrong: 'As referências aninhadas não são percorridas.', explain: 'Para profundidade, é necessária uma estratégia recursiva ou novos objetos.',
        challengeTitle: 'Crie uma configuração somente leitura', challenge: 'Defina uma propriedade versao não gravável com Object.defineProperty, congele o objeto e demonstre Object.isFrozen.',
        hints: ['Configure writable: false.', 'Use Object.isFrozen no console.'],
        solution: ['const config = {};', "Object.defineProperty(config, 'versao', { value: 1, writable: false, enumerable: true });", 'Object.freeze(config);', 'console.log(config.versao, Object.isFrozen(config));'],
        rules: [
          { re: /Object\.defineProperty\s*\(/, msg: 'Defina a propriedade por descritor.' },
          { re: /writable\s*:\s*false/, msg: 'Marque a propriedade como não gravável.' },
          { re: /Object\.freeze\s*\(/, msg: 'Congele o objeto.' },
          { re: /Object\.isFrozen\s*\(/, msg: 'Verifique o estado do objeto.' }
        ]
      },
      {
        id: 'js4-5', n: '4.5', title: 'Herança, campos privados e composição', seed: 'composicao.js',
        goal: 'Encapsular estado e preferir composição quando comportamentos variam.',
        concept: '<code>extends</code> e <code>super</code> constroem sobre prototypes. Campos <code>#privados</code> são validados pela linguagem e só existem dentro da classe.',
        detail: 'Composição injeta colaboradores menores em vez de criar hierarquias profundas. Herança expressa “é um”; composição expressa “usa um”.',
        example: ['class Cofre {', '  #valor = 0;', '  depositar(v) { this.#valor += v; }', '  saldo() { return this.#valor; }', '}'],
        connection: 'Objetos bem encapsulados se tornam componentes dos módulos e serviços seguintes.',
        pitfall: 'Criar uma árvore de subclasses apenas para reaproveitar duas linhas de código.',
        question: 'Quando composição costuma ser melhor?', correct: 'Quando o comportamento deve ser trocado ou combinado independentemente.', wrong: 'Somente quando não existem objetos.', whyWrong: 'Composição é justamente uma relação entre objetos.', explain: 'Colaboradores pequenos reduzem acoplamento a hierarquias.',
        challengeTitle: 'Componha um serviço', challenge: 'Crie uma classe com campo privado e um serviço que receba uma instância colaboradora pelo construtor. Use os dois sem acessar o campo privado diretamente.',
        hints: ['O colaborador pode guardar valores.', 'O serviço chama um método público do colaborador.'],
        solution: ['class Cofre {', '  #valor = 0;', '  depositar(valor) { this.#valor += valor; }', '  saldo() { return this.#valor; }', '}', 'class Caixa {', '  constructor(cofre) { this.cofre = cofre; }', '  receber(valor) { this.cofre.depositar(valor); return this.cofre.saldo(); }', '}', 'console.log(new Caixa(new Cofre()).receber(20));'],
        rules: [
          { re: /class\s+\w+[\s\S]*#\w+/, msg: 'Use um campo privado em uma classe.' },
          { re: /constructor\s*\(\s*\w+\s*\)[\s\S]*this\.\w+\s*=\s*\w+/, msg: 'Injete o colaborador pelo construtor.' },
          { re: /this\.\w+\.\w+\s*\(/, msg: 'Delegue uma operação ao colaborador.' },
          { re: /new\s+\w+\s*\(\s*new\s+\w+/, msg: 'Monte os objetos por composição.' }
        ]
      }
    ],
    js05: [
      {
        id: 'js5-2', n: '5.2', title: 'Arrays: consulta, ordem e mutação', seed: 'arrays.js',
        goal: 'Escolher operações de array conscientes de mutação.',
        concept: '<code>find</code>, <code>some</code> e <code>every</code> consultam coleções. <code>sort</code> tradicional altera o array; <code>toSorted</code> devolve outro.',
        detail: 'Métodos como map, filter e reduce não alteram diretamente o array, mas callbacks ainda podem mutar objetos e estado externo.',
        example: ['const notas = [8, 5, 10];', 'const ordenadas = notas.toSorted((a, b) => a - b);', 'console.log(notas, ordenadas);'],
        connection: 'Depois das transformações básicas, é preciso reconhecer quais operações preservam ou mudam a coleção.',
        pitfall: 'Usar <code>sort()</code> sem comparador numérico e obter ordem lexicográfica.',
        question: 'Qual método devolve uma cópia ordenada?', correct: '<code>toSorted</code>.', wrong: '<code>sort</code>, sem alterar o original.', whyWrong: 'Sort altera o array em que é chamado.', explain: 'APIs modernas “to...” ajudam a manter atualizações imutáveis.',
        challengeTitle: 'Consulte sem alterar', challenge: 'A partir de um array numérico, crie uma cópia ordenada, encontre o primeiro valor maior que 10 e verifique se todos são positivos. Mostre também o original.',
        hints: ['Use toSorted, find e every.', 'Forneça comparador numérico.'],
        solution: ['const valores = [12, 3, 20, 7];', 'const ordenados = valores.toSorted((a, b) => a - b);', 'const primeiro = ordenados.find(valor => valor > 10);', 'const positivos = valores.every(valor => valor > 0);', 'console.log(valores, ordenados, primeiro, positivos);'],
        rules: [
          { re: /\.toSorted\s*\(/, msg: 'Ordene sem mutar com <code>toSorted</code>.' },
          { re: /\.find\s*\(/, msg: 'Encontre o primeiro valor pedido.' },
          { re: /\.every\s*\(/, msg: 'Verifique todos os valores.' },
          { re: /\(\s*a\s*,\s*b\s*\)\s*=>\s*a\s*-\s*b/, msg: 'Use um comparador numérico.' }
        ]
      },
      {
        id: 'js5-3', n: '5.3', title: 'Map, Set e coleções fracas', seed: 'colecoes.js',
        goal: 'Escolher a coleção de acordo com identidade, unicidade e ciclo de vida.',
        concept: '<code>Map</code> aceita chaves de qualquer tipo; <code>Set</code> mantém valores únicos. A especificação exige acesso médio sublinear, não O(1) garantido.',
        detail: '<code>WeakMap</code> e <code>WeakSet</code> aceitam objetos como chaves e não impedem sua coleta, por isso não são enumeráveis.',
        example: ['const porId = new Map([[1, { nome: \'Ana\' }]]);', 'const etiquetas = new Set([\'js\', \'js\', \'web\']);', 'console.log(porId.get(1), [...etiquetas]);'],
        connection: 'Coleções especializadas expressam melhor o contrato que arrays usados como dicionários.',
        pitfall: 'Esperar enumerar um WeakMap; sua fraqueza depende justamente de não expor as chaves.',
        question: 'Qual coleção representa valores únicos?', correct: '<code>Set</code>.', wrong: '<code>WeakMap</code> com qualquer valor primitivo.', whyWrong: 'WeakMap usa objetos como chaves e associa valores.', explain: 'Set modela pertencimento e remoção de duplicatas.',
        challengeTitle: 'Indexe e remova duplicatas', challenge: 'Crie um Map de usuários por id e um Set de tags únicas. Leia um usuário, adicione/remova uma tag e mostre os resultados.',
        hints: ['Use set/get no Map.', 'Use add/delete no Set.'],
        solution: ['const usuarios = new Map();', "usuarios.set(1, { nome: 'Ana' });", "usuarios.set(2, { nome: 'Bia' });", "const tags = new Set(['js', 'web', 'js']);", "tags.add('node');", "tags.delete('web');", 'console.log(usuarios.get(2), [...tags]);'],
        rules: [
          { re: /new\s+Map\s*\(/, msg: 'Crie um Map.' },
          { re: /\.set\s*\([^)]*\)[\s\S]*\.get\s*\(/, msg: 'Grave e leia pelo Map.' },
          { re: /new\s+Set\s*\(/, msg: 'Crie um Set.' },
          { re: /\.add\s*\([^)]*\)[\s\S]*\.delete\s*\(/, msg: 'Altere o conjunto com add e delete.' }
        ]
      },
      {
        id: 'js5-4', n: '5.4', title: 'Iterables, iterators e generators', seed: 'iteradores.js',
        goal: 'Produzir sequências sob demanda pelo protocolo de iteração.',
        concept: 'Um iterable expõe <code>Symbol.iterator</code>; seu iterator devolve objetos <code>{ value, done }</code>. <code>function*</code> e <code>yield</code> simplificam esse protocolo.',
        detail: 'Generators pausam e retomam a execução, permitindo produzir valores sem criar toda a coleção antecipadamente.',
        example: ['function* intervalo(inicio, fim) {', '  for (let n = inicio; n <= fim; n += 1) yield n;', '}', 'console.log([...intervalo(2, 4)]);'],
        connection: 'Iteração preguiçosa prepara streams, paginação e processamento de conjuntos grandes.',
        pitfall: 'Reutilizar um generator já consumido; a instância mantém estado e termina.',
        question: 'O que yield faz em um generator?', correct: 'Produz um valor e pausa a função até o próximo avanço.', wrong: 'Encerra definitivamente a função como return.', whyWrong: 'Yield permite retomar; return encerra.', explain: 'Generators modelam sequências incrementais.',
        challengeTitle: 'Gere uma faixa filtrada', challenge: 'Crie um generator que receba início e fim e produza somente números pares. Consuma-o com for...of.',
        hints: ['Use function*.', 'Use yield apenas dentro da condição de par.'],
        solution: ['function* pares(inicio, fim) {', '  for (let n = inicio; n <= fim; n += 1) {', '    if (n % 2 === 0) yield n;', '  }', '}', 'for (const numero of pares(1, 8)) console.log(numero);'],
        rules: [
          { re: /function\s*\*\s*\w+\s*\(/, msg: 'Declare um generator com <code>function*</code>.' },
          { re: /%\s*2\s*===\s*0[\s\S]*\byield\b/, msg: 'Produza somente valores pares.' },
          { re: /for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\(/, msg: 'Consuma a sequência com <code>for...of</code>.' }
        ]
      },
      {
        id: 'js5-5', n: '5.5', title: 'Iteração assíncrona e pipelines preguiçosos', seed: 'iteracao-async.js',
        goal: 'Consumir valores que chegam ao longo do tempo sem carregar tudo na memória.',
        concept: 'Async iterables produzem Promises de resultados de iteração. <code>for await...of</code> aguarda cada item e mantém o fluxo legível.',
        detail: 'Pipelines preguiçosos processam um item por vez. Isso reduz memória e permite começar antes que a origem termine.',
        example: ['async function* carregar() {', '  yield Promise.resolve(1);', '  yield Promise.resolve(2);', '}', 'for await (const item of carregar()) console.log(item);'],
        connection: 'O mesmo modelo aparece em streams, respostas HTTP e filas assíncronas.',
        pitfall: 'Transformar tudo em array antes de processar e perder a vantagem do fluxo incremental.',
        question: 'Qual laço consome um async iterable?', correct: '<code>for await...of</code>.', wrong: '<code>for...in</code>.', whyWrong: 'For...in enumera chaves e não aguarda Promises.', explain: 'For await coordena iteração e espera assíncrona.',
        challengeTitle: 'Consuma páginas assíncronas', challenge: 'Crie um async generator que produza três páginas simuladas e consuma com for await...of, acumulando a quantidade de itens.',
        hints: ['Use async function*.', 'Cada yield pode entregar um array.'],
        solution: ['async function* paginas() {', '  yield [1, 2];', '  yield [3];', '  yield [4, 5, 6];', '}', 'async function principal() {', '  let total = 0;', '  for await (const pagina of paginas()) total += pagina.length;', '  console.log(total);', '}', 'principal();'],
        rules: [
          { re: /async\s+function\s*\*\s*\w+/, msg: 'Crie um async generator.' },
          { re: /\byield\s*\[/, msg: 'Produza páginas incrementais.' },
          { re: /for\s+await\s*\(\s*const\s+\w+\s+of/, msg: 'Consuma com <code>for await...of</code>.' },
          { re: /\+=\s*\w+\.length/, msg: 'Acumule a quantidade de itens.' }
        ]
      }
    ],
    js06: [
      {
        id: 'js6-2', n: '6.2', title: 'Exports, imports e live bindings', seed: 'modulos-vivos.js',
        goal: 'Separar API pública de detalhes internos em módulos ESM.',
        concept: 'Exports nomeados tornam dependências explícitas; export default representa um valor principal. Imports ESM são bindings vivos e somente leitura no consumidor.',
        detail: 'O consumidor observa atualizações feitas pelo módulo exportador, mas não pode reatribuir diretamente o nome importado.',
        example: ["// estado.js", 'export let total = 0;', 'export function incrementar() { total += 1; }', "// app.js", "import { total, incrementar } from './estado.js';"],
        connection: 'A aula-base apresentou a sintaxe; agora a superfície pública vira um contrato consciente.',
        pitfall: 'Exportar todo detalhe interno amplia acoplamento e impede refatorações.',
        question: 'Um import nomeado é uma cópia congelada do valor?', correct: 'Não; é um binding vivo e somente leitura no consumidor.', wrong: 'Sim; nunca reflete mudanças do exportador.', whyWrong: 'ESM mantém ligação ao binding exportado.', explain: 'Live bindings preservam identidade entre módulos.',
        challengeTitle: 'Defina uma API mínima', challenge: 'Crie dois arquivos: um exporta estado e duas funções; outro importa somente a API necessária, altera o estado por função e mostra o valor.',
        hints: ['Use export nomeado.', 'Não exporte a estrutura interna inteira.'],
        solution: ["// estado.js", 'export let total = 0;', 'export function adicionar(valor) { total += valor; }', "// app.js", "import { total, adicionar } from './estado.js';", 'adicionar(5);', 'console.log(total);'],
        rules: [
          { re: /export\s+(?:let|const|function)\s+/, msg: 'Exporte bindings nomeados.' },
          { re: /import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]/, msg: 'Importe apenas os nomes necessários.' },
          { re: /\w+\s*\([^)]*\)[\s\S]*console\.log/, msg: 'Altere por função e observe o estado.' }
        ]
      },
      {
        id: 'js6-3', n: '6.3', title: 'Ciclos, import dinâmico e top-level await', seed: 'modulos-dinamicos.js',
        goal: 'Reconhecer ciclos e carregar código somente quando necessário.',
        concept: 'Ciclos ESM podem expor bindings ainda não inicializados. Quebre o ciclo extraindo dependências comuns ou invertendo a direção.',
        detail: '<code>import()</code> devolve uma Promise e habilita carregamento sob demanda. Top-level await é válido em ESM, mas pode bloquear módulos dependentes.',
        example: ["async function carregar(nome) {", "  if (nome === 'relatorio') return import('./relatorio.js');", "  throw new Error('modulo desconhecido');", '}'],
        connection: 'O grafo de módulos precisa ter direção compreensível antes de virar um pacote.',
        pitfall: 'Usar import dinâmico em toda parte e esconder dependências essenciais.',
        question: 'O que import() devolve?', correct: 'Uma Promise para o namespace do módulo.', wrong: 'O texto bruto do arquivo imediatamente.', whyWrong: 'O carregamento e avaliação são assíncronos.', explain: 'Import dinâmico integra módulos ao fluxo de Promises.',
        challengeTitle: 'Carregue uma funcionalidade sob demanda', challenge: 'Crie uma função async que valide um nome permitido, use import() apenas nesse caso e devolva uma função exportada.',
        hints: ['Valide antes de montar o caminho.', 'Aguarde a Promise retornada por import().'],
        solution: ["async function carregarRelatorio(tipo) {", "  if (tipo !== 'resumo') throw new Error('tipo invalido');", "  const modulo = await import('./resumo.js');", '  return modulo.gerar;', '}', "carregarRelatorio('resumo').then(gerar => console.log(typeof gerar));"],
        rules: [
          { re: /async\s+function\s+/, msg: 'Crie uma função assíncrona.' },
          { re: /if\s*\([^)]*!==?[^)]*\)\s*throw\s+new\s+Error/, msg: 'Valide a opção antes de carregar.' },
          { re: /await\s+import\s*\(/, msg: 'Use import dinâmico e aguarde o módulo.' },
          { re: /return\s+\w+\.\w+/, msg: 'Devolva apenas a API necessária.' }
        ]
      },
      {
        id: 'js6-4', n: '6.4', title: 'ESM e CommonJS sem mistura acidental', seed: 'esm-cjs.js',
        goal: 'Identificar os dois sistemas e escolher um formato por pacote.',
        concept: 'ESM usa <code>import/export</code>; CommonJS usa <code>require/module.exports</code>. No Node, <code>type</code> no package.json e as extensões .mjs/.cjs ajudam a determinar o formato.',
        detail: 'CommonJS carrega de forma síncrona e exporta valores por objeto. Interoperabilidade existe, mas possui regras; não misture sintaxes no mesmo arquivo sem uma estratégia.',
        example: ["// ESM", "import { readFile } from 'node:fs/promises';", "// CommonJS", "const { readFile: ler } = require('node:fs/promises');"],
        connection: 'Isso explica por que aulas de ESM e exemplos legados com require parecem diferentes.',
        pitfall: 'Copiar um require para arquivo ESM e culpar a biblioteca pelo erro de formato.',
        question: 'Qual extensão força CommonJS no Node?', correct: '<code>.cjs</code>.', wrong: '<code>.mjs</code>.', whyWrong: '.mjs força ESM.', explain: 'Extensões explícitas eliminam ambiguidade de formato.',
        challengeTitle: 'Escreva os dois formatos', challenge: 'Mostre o mesmo módulo soma exportado e consumido em ESM e CommonJS, separando claramente os arquivos.',
        hints: ['ESM: export/import.', 'CommonJS: module.exports/require.'],
        solution: ["// soma.mjs", 'export const soma = (a, b) => a + b;', "// app.mjs", "import { soma } from './soma.mjs';", '// soma.cjs', 'module.exports = { soma: (a, b) => a + b };', '// app.cjs', "const { soma: somaCjs } = require('./soma.cjs');", 'console.log(soma(2, 3), somaCjs(4, 5));'],
        rules: [
          { re: /export\s+(?:const|function)/, msg: 'Inclua a exportação ESM.' },
          { re: /import\s*\{[^}]+\}\s*from/, msg: 'Inclua o consumo ESM.' },
          { re: /module\.exports\s*=/, msg: 'Inclua a exportação CommonJS.' },
          { re: /require\s*\(/, msg: 'Inclua o consumo CommonJS.' }
        ]
      },
      {
        id: 'js6-5', n: '6.5', title: 'package.json, semver e API pública', seed: 'pacote.js',
        goal: 'Desenhar um pacote com comandos e pontos de entrada estáveis.',
        concept: '<code>package.json</code> descreve formato, scripts, dependências e exports. Semver comunica versões major, minor e patch conforme compatibilidade.',
        detail: 'O campo <code>exports</code> limita caminhos públicos. Isso impede consumidores de depender de arquivos internos que deveriam poder mudar.',
        example: ["const pacote = {", "  type: 'module',", "  scripts: { test: 'node --test' },", "  exports: { '.': './src/index.js' }", '};'],
        connection: 'Módulos locais ganham um contrato distribuível e verificável.',
        pitfall: 'Confundir caret com versão fixa ou publicar internals como se fossem API.',
        question: 'O que uma mudança major comunica?', correct: 'Uma quebra incompatível na API pública.', wrong: 'Somente correção interna compatível.', whyWrong: 'Correções compatíveis incrementam patch.', explain: 'Semver só é útil quando a superfície pública está definida.',
        challengeTitle: 'Modele o manifesto do pacote', challenge: 'Crie um objeto que represente package.json com type module, scripts start/test, dependencies e exports limitado ao índice público. Mostre JSON formatado.',
        hints: ['Use JSON.stringify com indentação.', 'Inclua somente o ponto de entrada público em exports.'],
        solution: ["const pacote = {", "  name: 'terminalis-exemplo',", "  type: 'module',", "  scripts: { start: 'node src/index.js', test: 'node --test' },", "  dependencies: { biblioteca: '^2.1.0' },", "  exports: { '.': './src/index.js' }", '};', 'console.log(JSON.stringify(pacote, null, 2));'],
        rules: [
          { re: /type\s*:\s*['"]module['"]/, msg: 'Declare o formato ESM.' },
          { re: /scripts\s*:\s*\{[^}]*start[^}]*test/s, msg: 'Defina scripts de execução e teste.' },
          { re: /dependencies\s*:\s*\{/, msg: 'Declare dependências.' },
          { re: /exports\s*:\s*\{[^}]*['"]\.['"]/s, msg: 'Limite a API ao ponto de entrada público.' },
          { re: /JSON\.stringify\s*\(/, msg: 'Mostre o manifesto serializado.' }
        ]
      }
    ],
    js02: [
      {
        id: 'js2-2', n: '2.2', title: 'Conversões, números e BigInt', seed: 'conversoes.js',
        goal: 'Converter entrada explicitamente e rejeitar números inválidos.',
        concept: '<code>Number</code>, <code>String</code> e <code>Boolean</code> tornam a conversão visível. <code>Number.isNaN</code> detecta uma conversão numérica inválida sem coerção adicional.',
        detail: '<code>BigInt</code> representa inteiros além da precisão segura de Number, mas não pode ser misturado diretamente com Number em operações aritméticas.',
        example: ["const entrada = '42';", 'const valor = Number(entrada);', "console.log(Number.isNaN(valor) ? 'invalido' : valor + 1);"],
        connection: 'Tipos só formam contratos confiáveis quando as fronteiras convertem e validam as entradas.',
        pitfall: '<code>parseInt</code> aceita prefixos parciais; para validar o valor inteiro, converta e confira o resultado.',
        question: 'Como verificar especificamente o valor NaN?', correct: 'Com <code>Number.isNaN(valor)</code>.', wrong: 'Com <code>valor === NaN</code>.', whyWrong: '<code>NaN</code> não é estritamente igual a si mesmo.', explain: 'Number.isNaN evita a comparação impossível com NaN.',
        challengeTitle: 'Converta uma quantidade', challenge: 'Crie uma função que converta texto em número e lance Error quando o resultado for NaN ou negativo. Demonstre um valor válido.',
        hints: ['Use Number(texto).', 'Valide com Number.isNaN e uma comparação.'],
        solution: ['function quantidade(texto) {', '  const valor = Number(texto);', "  if (Number.isNaN(valor) || valor < 0) throw new Error('quantidade invalida');", '  return valor;', '}', "console.log(quantidade('12'));"],
        rules: [
          { re: /Number\s*\(/, msg: 'Converta explicitamente com <code>Number</code>.' },
          { re: /Number\.isNaN\s*\(/, msg: 'Detecte <code>NaN</code> sem coerção.' },
          { re: /throw\s+new\s+Error/, msg: 'Lance um erro para entrada inválida.' },
          { re: /return\s+\w+/, msg: 'Devolva a quantidade válida.' }
        ]
      },
      {
        id: 'js2-3', n: '2.3', title: 'Strings e template literals', seed: 'strings.js',
        goal: 'Normalizar texto e montar mensagens sem concatenação confusa.',
        concept: 'Strings são imutáveis. Métodos como <code>trim</code>, <code>toLowerCase</code>, <code>includes</code> e <code>slice</code> devolvem novas strings.',
        detail: 'Template literals interpolam expressões e preservam quebras de linha. Normalizar cedo evita comparações inconsistentes.',
        example: ["const nome = '  Ada Lovelace  ';", 'const limpo = nome.trim();', "console.log(limpo.toLowerCase(), limpo.length);"],
        connection: 'Dados textuais normalizados são a base para validação, busca e mensagens de interface.',
        pitfall: 'Esperar que <code>trim()</code> altere a variável original; é necessário guardar o retorno.',
        question: 'O que <code>trim()</code> faz com a string original?', correct: 'Nada; ele devolve uma nova string sem espaços nas pontas.', wrong: 'Remove espaços alterando a string original.', whyWrong: 'Strings são imutáveis.', explain: 'Operações de string produzem novos valores.',
        challengeTitle: 'Normalize um identificador', challenge: 'Crie uma função que remova espaços das pontas, converta para minúsculas e troque espaços internos por hífens. Mostre o resultado.',
        hints: ['Encadeie trim e toLowerCase.', 'Use replaceAll ou replace com expressão global.'],
        solution: ['function slug(texto) {', "  return texto.trim().toLowerCase().replaceAll(' ', '-');", '}', "console.log(slug('  Curso JavaScript  '));"],
        rules: [
          { re: /\.trim\s*\(\)/, msg: 'Remova espaços das pontas com <code>trim</code>.' },
          { re: /\.toLowerCase\s*\(\)/, msg: 'Normalize para minúsculas.' },
          { re: /(?:replaceAll|replace)\s*\(/, msg: 'Troque os espaços internos.' },
          { re: /return\s+/, msg: 'Devolva a nova string.' }
        ]
      },
      {
        id: 'js2-4', n: '2.4', title: 'Ausência de dados sem atalhos falsos', seed: 'ausencia.js',
        goal: 'Usar optional chaining e nullish coalescing sem perder valores válidos.',
        concept: '<code>?.</code> interrompe o acesso quando encontra <code>null</code> ou <code>undefined</code>. <code>??</code> usa um padrão apenas nesses dois casos.',
        detail: '<code>||</code> também substitui zero, string vazia e false; por isso não serve quando esses valores são válidos no domínio.',
        example: ['const conta = { perfil: { pontos: 0 } };', "const pontos = conta?.perfil?.pontos ?? 10;", 'console.log(pontos); // 0'],
        connection: 'Contratos reais precisam distinguir ausência de valores válidos como zero e string vazia.',
        pitfall: 'Usar <code>||</code> como padrão e transformar zero em outro valor sem querer.',
        question: 'Qual operador preserva zero e usa padrão apenas para null/undefined?', correct: '<code>??</code>.', wrong: '<code>||</code>.', whyWrong: '<code>||</code> considera zero falsy.', explain: 'Nullish coalescing trata especificamente ausência.',
        challengeTitle: 'Leia uma configuração opcional', challenge: 'Crie uma função que leia config.usuario.limite com optional chaining e use 100 apenas se o valor estiver ausente. Demonstre que zero é preservado.',
        hints: ['Encadeie os acessos com ?.', 'Use ?? 100 no final.'],
        solution: ['function obterLimite(config) {', '  return config?.usuario?.limite ?? 100;', '}', 'console.log(obterLimite({ usuario: { limite: 0 } }));', 'console.log(obterLimite({}));'],
        rules: [
          { re: /\?\.[A-Za-z_$]/, msg: 'Use optional chaining no acesso aninhado.' },
          { re: /\?\?\s*100/, msg: 'Use nullish coalescing para o valor padrão.' },
          { re: /limite\s*:\s*0/, msg: 'Demonstre que zero continua válido.' },
          { re: /console\.log/, count: 2, msg: 'Mostre casos presente e ausente.' }
        ]
      },
      {
        id: 'js2-5', n: '2.5', title: 'Validar dados externos', seed: 'validacao.js',
        goal: 'Transformar entrada desconhecida em um objeto confiável.',
        concept: 'Tudo que vem de formulário, arquivo ou rede começa como dado não confiável. Validar significa conferir tipo, presença, faixa e formato antes do uso.',
        detail: 'Um validador deve falhar com mensagem útil e devolver uma forma normalizada. Isso impede que suposições frágeis se espalhem pelo programa.',
        example: ['function lerId(dado) {', "  if (!dado || typeof dado.id !== 'string') throw new TypeError('id obrigatorio');", '  return dado.id.trim();', '}'],
        connection: 'A validação explícita cria os contratos consumidos por funções, APIs e persistência.',
        pitfall: 'Conferir apenas se a propriedade é truthy; isso mistura ausência, tipo errado e valor vazio.',
        question: 'Em que momento validar entrada externa?', correct: 'Na fronteira, antes de usar ou armazenar os dados.', wrong: 'Somente quando surgir um erro em produção.', whyWrong: 'A validação tardia espalha dados inválidos pelo sistema.', explain: 'Fronteiras convertem dados desconhecidos em contratos internos.',
        challengeTitle: 'Valide um cadastro', challenge: 'Crie validarUsuario(dado): exija objeto, nome string não vazia e idade inteira maior ou igual a 18; devolva um novo objeto normalizado.',
        hints: ['Use typeof e Number.isInteger.', 'Não devolva o mesmo objeto recebido.'],
        solution: ['function validarUsuario(dado) {', "  if (!dado || typeof dado !== 'object') throw new TypeError('objeto obrigatorio');", "  const nome = typeof dado.nome === 'string' ? dado.nome.trim() : '';", "  if (!nome) throw new Error('nome obrigatorio');", "  if (!Number.isInteger(dado.idade) || dado.idade < 18) throw new Error('idade invalida');", '  return { nome, idade: dado.idade };', '}', "console.log(validarUsuario({ nome: ' Ana ', idade: 20 }));"],
        rules: [
          { re: /typeof\s+\w+\s*!==?\s*['"]object['"]/, msg: 'Confirme que a entrada é objeto.' },
          { re: /typeof\s+[^;]+\.nome\s*===?\s*['"]string['"]/, msg: 'Confirme que nome é string.' },
          { re: /Number\.isInteger\s*\(/, msg: 'Exija idade inteira.' },
          { re: /return\s*\{[^}]*nome[^}]*idade/s, msg: 'Devolva um novo objeto normalizado.' }
        ]
      }
    ],
    js07: [
      {
        id: 'js7-2', n: '7.2', title: 'Callbacks e cadeias de Promise', seed: 'promises.js',
        goal: 'Transformar callbacks aninhados em uma cadeia com propagação de erro.',
        concept: 'Uma Promise representa um resultado futuro: pending, fulfilled ou rejected. <code>then</code> transforma valores; <code>catch</code> trata rejeições; <code>finally</code> executa limpeza.',
        detail: 'Retornar a próxima Promise dentro de <code>then</code> mantém uma cadeia plana. Esquecer o return cria trabalho solto e erros difíceis de observar.',
        example: ['Promise.resolve(2)', '  .then(valor => valor * 3)', '  .then(console.log)', '  .catch(console.error);'],
        connection: 'A aula-base mostrou async/await; a cadeia revela o modelo de Promise que existe por baixo.',
        pitfall: 'Criar <code>new Promise</code> ao redor de uma função que já devolve Promise.',
        question: 'Como um erro lançado dentro de then chega ao tratamento?', correct: 'Ele vira uma rejeição e segue até o catch seguinte.', wrong: 'Ele é ignorado automaticamente.', whyWrong: 'Promises propagam erros pela cadeia.', explain: 'A cadeia unifica valores assíncronos e falhas.',
        challengeTitle: 'Monte uma cadeia completa', challenge: 'Parta de Promise.resolve, faça duas transformações, provoque ou trate uma validação e finalize com catch e finally.',
        hints: ['Retorne o valor em cada then.', 'Use finally somente para limpeza ou registro.'],
        solution: ['Promise.resolve(4)', '  .then(valor => valor * 2)', "  .then(valor => { if (valor < 0) throw new Error('negativo'); return valor + 1; })", "  .then(valor => console.log('resultado', valor))", "  .catch(erro => console.error('falha', erro.message))", "  .finally(() => console.log('fim'));"],
        rules: [
          { re: /Promise\.resolve\s*\(/, msg: 'Inicie com uma Promise resolvida.' },
          { re: /\.then\s*\([^)]*\)[\s\S]*\.then\s*\(/, msg: 'Encadeie ao menos duas transformações.' },
          { re: /\.catch\s*\(/, msg: 'Trate rejeições.' },
          { re: /\.finally\s*\(/, msg: 'Finalize a cadeia explicitamente.' }
        ]
      },
      {
        id: 'js7-3', n: '7.3', title: 'Combinadores de Promise', seed: 'combinadores.js',
        goal: 'Escolher a política correta para várias operações concorrentes.',
        concept: '<code>Promise.all</code> exige todas; <code>allSettled</code> registra todos os resultados; <code>race</code> usa o primeiro encerramento; <code>any</code> usa o primeiro sucesso.',
        detail: 'Concorrência não significa paralelismo de CPU. Ela permite que esperas independentes avancem sem serem serializadas desnecessariamente.',
        example: ['const tarefas = [Promise.resolve(1), Promise.resolve(2)];', 'const valores = await Promise.all(tarefas);', 'console.log(valores);'],
        connection: 'Combinar Promises evita awaits sequenciais quando as operações não dependem umas das outras.',
        pitfall: 'Usar Promise.all quando falhas parciais são aceitáveis e perder os demais resultados.',
        question: 'Qual combinador preserva sucessos e falhas de todas as tarefas?', correct: '<code>Promise.allSettled</code>.', wrong: '<code>Promise.all</code> sempre.', whyWrong: 'All rejeita assim que uma entrada rejeita.', explain: 'A política deve refletir o contrato do caso de uso.',
        challengeTitle: 'Colete resultados parciais', challenge: 'Execute três Promises, incluindo uma rejeitada, com allSettled. Separe os valores fulfilled e mostre-os.',
        hints: ['Aguarde Promise.allSettled.', 'Filtre por status antes de acessar value.'],
        solution: ['async function principal() {', '  const tarefas = [Promise.resolve(1), Promise.reject(new Error(\'x\')), Promise.resolve(3)];', '  const resultados = await Promise.allSettled(tarefas);', "  const valores = resultados.filter(item => item.status === 'fulfilled').map(item => item.value);", '  console.log(valores);', '}', 'principal();'],
        rules: [
          { re: /Promise\.allSettled\s*\(/, msg: 'Use allSettled para preservar todos os resultados.' },
          { re: /Promise\.reject\s*\(/, msg: 'Inclua uma falha simulada.' },
          { re: /\.filter\s*\([^)]*status[^)]*fulfilled/, msg: 'Separe os resultados fulfilled.' },
          { re: /\.map\s*\([^)]*value/, msg: 'Extraia os valores dos sucessos.' }
        ]
      },
      {
        id: 'js7-4', n: '7.4', title: 'Event loop: tasks e microtasks', seed: 'event-loop.js',
        goal: 'Prever a ordem entre código síncrono, Promises e timers.',
        concept: 'A pilha síncrona termina antes das filas. Reações de Promise entram na fila de microtasks, que é drenada antes da próxima task de timer.',
        detail: 'Browser e Node possuem fases e APIs diferentes, mas ambos preservam a prioridade das microtasks após a pilha atual.',
        example: ["console.log('A');", "setTimeout(() => console.log('D'), 0);", "Promise.resolve().then(() => console.log('C'));", "console.log('B'); // A B C D"],
        connection: 'Async/await agenda continuação como microtask; agora a ordem deixa de parecer aleatória.',
        pitfall: 'Usar setTimeout zero como se fosse execução imediata.',
        question: 'O que roda primeiro após a pilha atual: then ou setTimeout zero?', correct: 'A reação de Promise em uma microtask.', wrong: 'O timer, porque o atraso é zero.', whyWrong: 'Zero é atraso mínimo; microtasks são drenadas antes da próxima task.', explain: 'A ordem típica é síncrono, microtasks, próxima task.',
        challengeTitle: 'Prove a ordem do loop', challenge: 'Escreva um programa com duas saídas síncronas, uma microtask e um timer zero que produza claramente a ordem A B C D.',
        hints: ['Agende antes de imprimir B.', 'Use Promise.resolve().then para C.'],
        solution: ["console.log('A');", "setTimeout(() => console.log('D'), 0);", "Promise.resolve().then(() => console.log('C'));", "console.log('B');"],
        rules: [
          { re: /console\.log\s*\(\s*['"]A['"]\s*\)/, msg: 'Imprima A sincronicamente.' },
          { re: /setTimeout\s*\([^,]+,\s*0\s*\)/, msg: 'Agende D como timer zero.' },
          { re: /Promise\.resolve\s*\([^)]*\)\.then\s*\(/, msg: 'Agende C como microtask.' },
          { re: /console\.log\s*\(\s*['"]B['"]\s*\)/, msg: 'Imprima B ainda na pilha atual.' }
        ]
      },
      {
        id: 'js7-5', n: '7.5', title: 'Cancelamento, timeout e limite de concorrência', seed: 'concorrencia.js',
        goal: 'Interromper trabalho desnecessário e limitar pressão sobre recursos.',
        concept: '<code>AbortController</code> oferece um signal compartilhável. Timeout é uma política construída ao redor de cancelamento, não uma propriedade automática de toda Promise.',
        detail: 'Pools limitam quantas tarefas avançam ao mesmo tempo. Backpressure surge quando o produtor precisa respeitar a capacidade do consumidor.',
        example: ['const controller = new AbortController();', 'const timer = setTimeout(() => controller.abort(), 1000);', '// passe controller.signal à operação', 'clearTimeout(timer);'],
        connection: 'Concorrência controlada prepara fetch, streams, filas e serviços estáveis.',
        pitfall: 'Rejeitar uma Promise de timeout sem cancelar a operação original, que continua gastando recursos.',
        question: 'AbortController cancela qualquer Promise automaticamente?', correct: 'Não; a operação precisa observar o signal.', wrong: 'Sim, ele encerra qualquer função JavaScript.', whyWrong: 'O cancelamento é cooperativo.', explain: 'Passe e observe o signal em APIs compatíveis.',
        challengeTitle: 'Crie uma operação cancelável', challenge: 'Implemente esperar(ms, signal) que resolve por timer, rejeita com AbortError ao abortar e remove o listener ao finalizar. Demonstre um cancelamento.',
        hints: ['Escute o evento abort com once.', 'Limpe o timer no cancelamento.'],
        solution: ['function esperar(ms, signal) {', '  return new Promise((resolve, reject) => {', '    const timer = setTimeout(resolve, ms);', "    signal.addEventListener('abort', () => {", '      clearTimeout(timer);', "      reject(new DOMException('cancelado', 'AbortError'));", '    }, { once: true });', '  });', '}', 'const controller = new AbortController();', "esperar(100, controller.signal).catch(erro => console.log(erro.name));", 'controller.abort();'],
        rules: [
          { re: /new\s+Promise\s*\(/, msg: 'Modele a espera com uma Promise.' },
          { re: /signal\.addEventListener\s*\(\s*['"]abort['"]/, msg: 'Observe o sinal de cancelamento.' },
          { re: /clearTimeout\s*\(/, msg: 'Libere o timer ao cancelar.' },
          { re: /AbortError/, msg: 'Use um erro de cancelamento reconhecível.' },
          { re: /\.abort\s*\(\)/, msg: 'Demonstre o cancelamento.' }
        ]
      }
    ],
    js08: [
      {
        id: 'js8-2', n: '8.2', title: 'DOM: selecionar, criar e atualizar', seed: 'dom.js',
        goal: 'Transformar estado em elementos acessíveis sem inserir HTML não confiável.',
        concept: 'O DOM representa o documento como objetos. <code>querySelector</code> localiza, <code>createElement</code> cria e <code>append</code> conecta nós.',
        detail: '<code>textContent</code> trata texto como texto. <code>innerHTML</code> exige sanitização e não deve receber entrada externa diretamente.',
        example: ["const lista = document.querySelector('#lista');", "const item = document.createElement('li');", "item.textContent = 'JavaScript';", 'lista.append(item);'],
        connection: 'JSON passa a ter um destino visual real: o estado pode ser renderizado no documento.',
        pitfall: 'Montar HTML com strings de usuário e abrir uma vulnerabilidade XSS.',
        question: 'Qual propriedade é adequada para inserir texto não confiável?', correct: '<code>textContent</code>.', wrong: '<code>innerHTML</code> sem sanitização.', whyWrong: 'InnerHTML interpreta marcação.', explain: 'Criar nós e usar textContent mantém dados como texto.',
        challengeTitle: 'Renderize uma lista segura', challenge: 'Crie renderizar(lista, itens) que limpe o conteúdo, crie um li por item com textContent e use DocumentFragment antes de anexar.',
        hints: ['Use replaceChildren para limpar.', 'Monte tudo em um fragmento.'],
        solution: ['function renderizar(lista, itens) {', '  const fragmento = document.createDocumentFragment();', '  for (const texto of itens) {', "    const item = document.createElement('li');", '    item.textContent = texto;', '    fragmento.append(item);', '  }', '  lista.replaceChildren(fragmento);', '}', "renderizar(document.querySelector('#lista'), ['JS', 'DOM']);"],
        rules: [
          { re: /document\.createDocumentFragment\s*\(/, msg: 'Monte os nós em um fragmento.' },
          { re: /document\.createElement\s*\(\s*['"]li['"]/, msg: 'Crie um elemento por item.' },
          { re: /\.textContent\s*=/, msg: 'Insira o conteúdo como texto.' },
          { re: /\.replaceChildren\s*\(/, msg: 'Substitua a renderização anterior.' }
        ],
        forbid: [{ re: /\.innerHTML\s*=/, msg: 'Não use innerHTML com os dados da lista.' }]
      },
      {
        id: 'js8-3', n: '8.3', title: 'Eventos, formulários e acessibilidade', seed: 'eventos.js',
        goal: 'Responder a interação preservando semântica e teclado.',
        concept: 'Eventos percorrem captura, alvo e bubbling. Delegação trata muitos elementos por um listener em um ancestral estável.',
        detail: 'Formulários fornecem submit por teclado. Rótulos, botões reais, foco e mensagens associadas são parte do comportamento, não decoração.',
        example: ["form.addEventListener('submit', evento => {", '  evento.preventDefault();', '  const dados = new FormData(form);', "  console.log(dados.get('nome'));", '});'],
        connection: 'DOM ganha comportamento com eventos e uma fronteira de entrada por formulários.',
        pitfall: 'Usar div clicável no lugar de button e perder teclado, foco e semântica.',
        question: 'Por que ouvir submit em vez de somente click?', correct: 'Submit cobre botão, Enter e semântica nativa do formulário.', wrong: 'Porque click não existe em botões.', whyWrong: 'Click existe, mas não representa todo o fluxo do formulário.', explain: 'Use o evento semântico mais próximo da intenção.',
        challengeTitle: 'Valide um formulário acessível', challenge: 'Adicione listener de submit, preventDefault, leia FormData, valide nome vazio e atualize uma região de mensagem com textContent e aria-live.',
        hints: ['Use trim no nome.', 'Configure aria-live na região de retorno.'],
        solution: ["const form = document.querySelector('form');", "const mensagem = document.querySelector('#mensagem');", "mensagem.setAttribute('aria-live', 'polite');", "form.addEventListener('submit', evento => {", '  evento.preventDefault();', '  const dados = new FormData(form);', "  const nome = String(dados.get('nome') || '').trim();", "  mensagem.textContent = nome ? 'Enviado: ' + nome : 'Informe o nome';", '});'],
        rules: [
          { re: /addEventListener\s*\(\s*['"]submit['"]/, msg: 'Ouça o evento submit.' },
          { re: /preventDefault\s*\(\)/, msg: 'Controle o envio do formulário.' },
          { re: /new\s+FormData\s*\(/, msg: 'Leia os campos por FormData.' },
          { re: /aria-live/, msg: 'Crie uma região anunciável.' },
          { re: /\.textContent\s*=/, msg: 'Atualize a mensagem como texto.' }
        ]
      },
      {
        id: 'js8-4', n: '8.4', title: 'Fetch, URL e corpos de requisição', seed: 'fetch.js',
        goal: 'Montar requisições, validar respostas e cancelar operações.',
        concept: '<code>fetch</code> resolve mesmo em respostas HTTP 4xx/5xx; confira <code>response.ok</code>. URL e URLSearchParams montam endereços sem concatenação frágil.',
        detail: 'FormData envia campos e arquivos; Blob representa dados binários. AbortSignal liga a requisição à política de cancelamento.',
        example: ["const url = new URL('/api/aulas', location.origin);", "url.searchParams.set('pagina', '2');", 'const resposta = await fetch(url);', "if (!resposta.ok) throw new Error('HTTP ' + resposta.status);"],
        connection: 'Browser passa a conversar com APIs usando contratos e cancelamento aprendidos antes.',
        pitfall: 'Chamar response.json antes de verificar status e tipo de conteúdo.',
        question: 'Fetch rejeita automaticamente em HTTP 404?', correct: 'Não; confira response.ok ou status.', wrong: 'Sim, todo status fora de 2xx vira rejeição.', whyWrong: 'Fetch rejeita principalmente por falhas de rede/cancelamento.', explain: 'Status HTTP pertence ao protocolo e precisa ser interpretado.',
        challengeTitle: 'Busque com parâmetros e timeout', challenge: 'Crie uma função que monte URL com termo, use AbortSignal.timeout, chame fetch, confira ok e devolva response.json.',
        hints: ['Use new URL e searchParams.set.', 'Lance Error contendo o status.'],
        solution: ["async function buscar(termo) {", "  const url = new URL('/api/busca', location.origin);", "  url.searchParams.set('q', termo);", '  const resposta = await fetch(url, { signal: AbortSignal.timeout(3000) });', "  if (!resposta.ok) throw new Error('HTTP ' + resposta.status);", '  return resposta.json();', '}', "buscar('js').then(console.log).catch(console.error);"],
        rules: [
          { re: /new\s+URL\s*\(/, msg: 'Monte o endereço com URL.' },
          { re: /\.searchParams\.set\s*\(/, msg: 'Adicione o parâmetro sem concatenar strings.' },
          { re: /fetch\s*\([^)]*signal\s*:/s, msg: 'Passe um sinal de cancelamento ao fetch.' },
          { re: /if\s*\(\s*!\s*\w+\.ok\s*\)\s*throw/, msg: 'Rejeite respostas HTTP sem sucesso.' },
          { re: /return\s+\w+\.json\s*\(\)/, msg: 'Devolva os dados JSON.' }
        ]
      },
      {
        id: 'js8-5', n: '8.5', title: 'Storage, workers, performance e crypto', seed: 'browser-apis.js',
        goal: 'Escolher APIs do browser considerando custo, segurança e ciclo de vida.',
        concept: 'localStorage é síncrono e persistente; sessionStorage acompanha a aba. Nenhum deles deve guardar segredos. Workers movem CPU pesada para outra thread e conversam por mensagens.',
        detail: '<code>performance.now</code> mede intervalos; Web Crypto oferece aleatoriedade e primitivas criptográficas. Não invente algoritmos de criptografia.',
        example: ["const id = crypto.randomUUID();", "localStorage.setItem('rascunho', JSON.stringify({ id }));", "const salvo = JSON.parse(localStorage.getItem('rascunho') || 'null');", 'console.log(salvo);'],
        connection: 'O módulo termina conectando persistência local, trabalho fora da UI e medição responsável.',
        pitfall: 'Guardar token sensível em localStorage ou usar Math.random para identificadores de segurança.',
        question: 'Onde guardar um segredo de servidor?', correct: 'No servidor ou em mecanismo seguro apropriado, não no localStorage.', wrong: 'No localStorage porque ele persiste.', whyWrong: 'Scripts da origem podem ler esse armazenamento.', explain: 'Persistência conveniente não equivale a armazenamento secreto.',
        challengeTitle: 'Persista um rascunho versionado', challenge: 'Gere id com crypto.randomUUID, salve um objeto versionado como JSON no localStorage, leia com fallback e meça a operação com performance.now.',
        hints: ['Use JSON.stringify/parse.', 'Calcule fim menos início.'],
        solution: ['const inicio = performance.now();', "const rascunho = { versao: 1, id: crypto.randomUUID(), texto: 'estudo' };", "localStorage.setItem('rascunho', JSON.stringify(rascunho));", "const recuperado = JSON.parse(localStorage.getItem('rascunho') || 'null');", 'const duracao = performance.now() - inicio;', 'console.log(recuperado, duracao);'],
        rules: [
          { re: /crypto\.randomUUID\s*\(/, msg: 'Gere o identificador com Web Crypto.' },
          { re: /localStorage\.setItem\s*\(/, msg: 'Persista o rascunho.' },
          { re: /localStorage\.getItem\s*\(/, msg: 'Leia o rascunho salvo.' },
          { re: /JSON\.stringify[\s\S]*JSON\.parse/, msg: 'Serialize e desserialize o objeto.' },
          { re: /performance\.now\s*\(/, msg: 'Meça a duração da operação.' }
        ]
      }
    ],
    js09: [
      {
        id: 'js9-2', n: '9.2', title: 'Processo, caminhos e ambiente', seed: 'node-ambiente.js',
        goal: 'Ler configuração do processo e construir caminhos portáveis.',
        concept: '<code>process.argv</code> recebe argumentos e <code>process.env</code> configuração textual. <code>node:path</code> monta caminhos respeitando o sistema operacional.',
        detail: 'URL de arquivo e caminho de sistema são conceitos diferentes. Módulos <code>node:url</code> convertem entre eles quando necessário.',
        example: ["const path = require('node:path');", "const porta = Number(process.env.PORT || '3000');", "const arquivo = path.join(process.cwd(), 'dados', 'app.json');", 'console.log(porta, arquivo);'],
        connection: 'Depois de fs, o programa precisa localizar arquivos e receber configuração sem valores fixos.',
        pitfall: 'Concatenar caminhos com barra literal e quebrar em outro sistema.',
        question: 'Qual é o tipo dos valores em process.env?', correct: 'String ou undefined.', wrong: 'Número automaticamente quando parece número.', whyWrong: 'A conversão é responsabilidade da aplicação.', explain: 'Valide e converta configuração na entrada.',
        challengeTitle: 'Carregue configuração do processo', challenge: 'Leia PORT com padrão, converta e valide, monte um caminho com path.join e mostre plataforma, porta e caminho.',
        hints: ['Use Number e Number.isInteger.', 'Use process.cwd como base.'],
        solution: ["const path = require('node:path');", "const porta = Number(process.env.PORT || '3000');", "if (!Number.isInteger(porta) || porta <= 0) throw new Error('PORT invalida');", "const arquivo = path.join(process.cwd(), 'dados', 'config.json');", 'console.log(process.platform, porta, arquivo);'],
        rules: [
          { re: /require\s*\(\s*['"]node:path['"]\s*\)/, msg: 'Carregue node:path.' },
          { re: /process\.env\.PORT/, msg: 'Leia PORT do ambiente.' },
          { re: /Number\.isInteger\s*\(/, msg: 'Valide a conversão da porta.' },
          { re: /path\.join\s*\(/, msg: 'Monte o caminho de forma portável.' },
          { re: /process\.platform/, msg: 'Mostre a plataforma atual.' }
        ]
      },
      {
        id: 'js9-3', n: '9.3', title: 'Buffer e EventEmitter', seed: 'buffer-eventos.js',
        goal: 'Distinguir bytes de texto e modelar notificações locais.',
        concept: '<code>Buffer</code> representa bytes no Node. Encoding define como texto vira bytes e vice-versa; UTF-8 deve ser explícito nas fronteiras.',
        detail: '<code>EventEmitter</code> desacopla produtor e ouvintes no mesmo processo, mas exige política de erros e remoção de listeners.',
        example: ["const { EventEmitter } = require('node:events');", 'const eventos = new EventEmitter();', "eventos.on('salvo', id => console.log(id));", "eventos.emit('salvo', 7);"],
        connection: 'Arquivos e rede trabalham com bytes; eventos conectam componentes sem chamada direta.',
        pitfall: 'Converter bytes em texto sem saber o encoding ou ignorar o evento error.',
        question: 'O que Buffer.byteLength mede?', correct: 'Quantidade de bytes de uma string em determinado encoding.', wrong: 'Sempre o mesmo que string.length.', whyWrong: 'Caracteres Unicode podem ocupar vários bytes.', explain: 'Comprimento de texto e tamanho em bytes são medidas diferentes.',
        challengeTitle: 'Emita dados codificados', challenge: 'Crie Buffer UTF-8 de um texto com acento, mostre bytes e recupere texto; emita o Buffer por EventEmitter e trate-o em um listener once.',
        hints: ['Use Buffer.from(texto, utf8).', 'Use once para um evento único.'],
        solution: ["const { EventEmitter } = require('node:events');", "const dados = Buffer.from('olá', 'utf8');", 'const eventos = new EventEmitter();', "eventos.once('dados', buffer => console.log(buffer.length, buffer.toString('utf8')));", "eventos.emit('dados', dados);"],
        rules: [
          { re: /Buffer\.from\s*\([^)]*['"]utf8['"]/, msg: 'Crie os bytes com encoding explícito.' },
          { re: /\.toString\s*\(\s*['"]utf8['"]/, msg: 'Decodifique com o mesmo encoding.' },
          { re: /new\s+EventEmitter\s*\(/, msg: 'Crie o emissor.' },
          { re: /\.once\s*\(/, msg: 'Registre um listener único.' },
          { re: /\.emit\s*\(/, msg: 'Emita os dados.' }
        ]
      },
      {
        id: 'js9-4', n: '9.4', title: 'Streams, pipeline e backpressure', seed: 'streams.js',
        goal: 'Mover dados em fluxo com erro e pressão controlados.',
        concept: 'Readable produz chunks, Writable consome e Transform modifica. Streams evitam carregar arquivos inteiros na memória.',
        detail: '<code>pipeline</code> conecta etapas, propaga erros e respeita backpressure: o produtor desacelera quando o consumidor não acompanha.',
        example: ["const { pipeline } = require('node:stream/promises');", "const fs = require('node:fs');", "await pipeline(fs.createReadStream('a.txt'), fs.createWriteStream('b.txt'));"],
        connection: 'Iteração preguiçosa ganha uma implementação de I/O pronta para arquivos e HTTP.',
        pitfall: 'Encadear pipe sem tratar erros de todas as etapas ou misturar modo flowing e leitura manual.',
        question: 'O que backpressure evita?', correct: 'Que o produtor acumule dados mais rápido do que o consumidor processa.', wrong: 'Que qualquer stream contenha mais de um chunk.', whyWrong: 'Streams trabalham com muitos chunks; a pressão regula o ritmo.', explain: 'Fluxo estável exige coordenação entre capacidades.',
        challengeTitle: 'Monte um pipeline de transformação', challenge: 'Use Readable.from, uma Transform que converta chunks para maiúsculas e Writable que acumule saída; conecte tudo com pipeline.',
        hints: ['Implemente transform(chunk, encoding, callback).', 'Aguarde pipeline em função async.'],
        solution: ["const { Readable, Transform, Writable } = require('node:stream');", "const { pipeline } = require('node:stream/promises');", 'async function principal() {', "  let saida = '';", "  const maiusculas = new Transform({ transform(chunk, encoding, callback) { callback(null, chunk.toString().toUpperCase()); } });", "  const destino = new Writable({ write(chunk, encoding, callback) { saida += chunk.toString(); callback(); } });", "  await pipeline(Readable.from(['a', 'b']), maiusculas, destino);", '  console.log(saida);', '}', 'principal();'],
        rules: [
          { re: /Readable\.from\s*\(/, msg: 'Crie uma origem em fluxo.' },
          { re: /new\s+Transform\s*\(/, msg: 'Crie uma transformação.' },
          { re: /new\s+Writable\s*\(/, msg: 'Crie um destino.' },
          { re: /await\s+pipeline\s*\(/, msg: 'Conecte e aguarde o pipeline.' }
        ]
      },
      {
        id: 'js9-5', n: '9.5', title: 'Sinais, contexto e encerramento gracioso', seed: 'shutdown.js',
        goal: 'Encerrar um processo sem abandonar trabalho em andamento.',
        concept: 'SIGTERM pede encerramento. O processo deve parar de aceitar trabalho, aguardar recursos fecharem e só então terminar.',
        detail: '<code>AsyncLocalStorage</code> transporta contexto como correlation id por uma cadeia assíncrona sem variável global compartilhada.',
        example: ["process.once('SIGTERM', async () => {", '  await servidor.close();', '  process.exitCode = 0;', '});'],
        connection: 'Recursos de baixo nível se unem a requisitos reais de produção.',
        pitfall: 'Chamar process.exit imediatamente e cortar logs, respostas e gravações pendentes.',
        question: 'Por que preferir process.exitCode?', correct: 'Permite que o loop termine depois das limpezas pendentes.', wrong: 'Porque encerra mais rápido que process.exit.', whyWrong: 'A vantagem é não forçar encerramento imediato.', explain: 'Shutdown gracioso coopera com o ciclo de vida do processo.',
        challengeTitle: 'Modele um shutdown idempotente', challenge: 'Crie shutdown async protegido contra segunda execução, registre SIGTERM/SIGINT com once, aguarde fechar dois recursos e defina exitCode.',
        hints: ['Use uma flag encerrando.', 'Aguarde Promise.all para os recursos.'],
        solution: ['let encerrando = false;', 'async function shutdown(sinal) {', '  if (encerrando) return;', '  encerrando = true;', "  console.log('encerrando', sinal);", '  await Promise.all([Promise.resolve(\'http fechado\'), Promise.resolve(\'db fechado\')]);', '  process.exitCode = 0;', '}', "process.once('SIGTERM', () => shutdown('SIGTERM'));", "process.once('SIGINT', () => shutdown('SIGINT'));"],
        rules: [
          { re: /if\s*\(\s*encerrando\s*\)\s*return/, msg: 'Torne o shutdown idempotente.' },
          { re: /Promise\.all\s*\(/, msg: 'Aguarde os recursos em conjunto.' },
          { re: /process\.once\s*\(\s*['"]SIGTERM['"]/, msg: 'Trate SIGTERM uma vez.' },
          { re: /process\.once\s*\(\s*['"]SIGINT['"]/, msg: 'Trate SIGINT uma vez.' },
          { re: /process\.exitCode\s*=/, msg: 'Defina o código sem saída forçada.' }
        ]
      }
    ],
    js10: [
      {
        id: 'js10-2', n: '10.2', title: 'HTTP: método, status, headers e corpo', seed: 'http.js',
        goal: 'Interpretar uma requisição e construir uma resposta HTTP coerente.',
        concept: 'HTTP troca mensagens: método e URL descrevem a intenção; headers carregam metadados; status e corpo descrevem o resultado.',
        detail: 'Métodos possuem semântica. GET deve ser seguro; PUT e DELETE devem ser idempotentes; Content-Type descreve a representação enviada.',
        example: ["const resposta = {", '  status: 201,', "  headers: { 'content-type': 'application/json' },", "  body: JSON.stringify({ id: 7 })", '};'],
        connection: 'O repositório da aula-base passa a ser usado por uma fronteira de protocolo.',
        pitfall: 'Responder 200 para todo resultado e obrigar o cliente a adivinhar sucesso pelo corpo.',
        question: 'Qual status normalmente representa criação bem-sucedida?', correct: '<code>201 Created</code>.', wrong: '<code>404 Not Found</code>.', whyWrong: '404 comunica ausência do recurso.', explain: 'Status faz parte do contrato observável da API.',
        challengeTitle: 'Despache uma requisição', challenge: 'Crie responder(req) que aceite GET /saude e POST /itens, retorne status, headers JSON e corpo; demais rotas devem retornar 404.',
        hints: ['Compare método e URL juntos.', 'Mantenha o formato da resposta igual em todos os caminhos.'],
        solution: ['function responder(req) {', "  const headers = { 'content-type': 'application/json; charset=utf-8' };", "  if (req.method === 'GET' && req.url === '/saude') return { status: 200, headers, body: JSON.stringify({ ok: true }) };", "  if (req.method === 'POST' && req.url === '/itens') return { status: 201, headers, body: JSON.stringify({ id: 1 }) };", "  return { status: 404, headers, body: JSON.stringify({ erro: 'nao encontrado' }) };", '}', "console.log(responder({ method: 'GET', url: '/saude' }));"],
        rules: [
          { re: /req\.method\s*===\s*['"]GET['"][\s\S]*req\.url/, msg: 'Despache GET por método e URL.' },
          { re: /req\.method\s*===\s*['"]POST['"][\s\S]*201/, msg: 'Responda à criação com 201.' },
          { re: /content-type['"]?\s*:\s*['"]application\/json/, msg: 'Declare o tipo do corpo.' },
          { re: /status\s*:\s*404/, msg: 'Cubra a rota inexistente.' }
        ]
      },
      {
        id: 'js10-3', n: '10.3', title: 'REST, idempotência, paginação e validação', seed: 'rest.js',
        goal: 'Desenhar operações repetíveis e consultas limitadas.',
        concept: 'Recursos usam URLs estáveis e representações. Idempotência significa que repetir a mesma operação produz o mesmo efeito observável pretendido.',
        detail: 'Paginação limita custo; validação rejeita entradas ruins antes do serviço. Uma chave de idempotência evita duplicar criações após retry.',
        example: ['function pagina(itens, limite, cursor = 0) {', '  const dados = itens.slice(cursor, cursor + limite);', '  return { dados, proximo: cursor + dados.length };', '}'],
        connection: 'Semântica HTTP ganha regras de domínio para repetição, volume e entrada.',
        pitfall: 'Aceitar limite arbitrário e permitir que uma requisição leia toda a base.',
        question: 'Por que uma chave de idempotência é útil em POST?', correct: 'Para retries não criarem o mesmo efeito duas vezes.', wrong: 'Para transformar todo POST em GET.', whyWrong: 'Método e intenção permanecem; a chave deduplica o efeito.', explain: 'Clientes e redes repetem requisições; o servidor precisa de política.',
        challengeTitle: 'Crie com idempotência', challenge: 'Implemente criar(chave, dados) com Map de resultados: valide nome, reutilize resultado da mesma chave e gere novo id apenas uma vez.',
        hints: ['Confira o cache antes de criar.', 'Armazene o resultado pela chave.'],
        solution: ['const resultados = new Map();', 'let proximoId = 1;', 'function criar(chave, dados) {', "  if (!chave) throw new Error('chave obrigatoria');", "  if (!dados || typeof dados.nome !== 'string' || !dados.nome.trim()) throw new Error('nome invalido');", '  if (resultados.has(chave)) return resultados.get(chave);', '  const criado = { id: proximoId++, nome: dados.nome.trim() };', '  resultados.set(chave, criado);', '  return criado;', '}', "console.log(criar('abc', { nome: ' Aula ' }), criar('abc', { nome: ' Aula ' }));"],
        rules: [
          { re: /new\s+Map\s*\(/, msg: 'Mantenha os resultados por chave.' },
          { re: /if\s*\(\s*!\s*chave\s*\)\s*throw/, msg: 'Exija a chave de idempotência.' },
          { re: /typeof\s+\w+\.nome\s*!==?\s*['"]string['"]/, msg: 'Valide o payload.' },
          { re: /\.has\s*\(\s*chave\s*\)[\s\S]*\.get\s*\(\s*chave\s*\)/, msg: 'Reutilize o resultado existente.' },
          { re: /\.set\s*\(\s*chave\s*,/, msg: 'Guarde o primeiro resultado.' }
        ]
      },
      {
        id: 'js10-4', n: '10.4', title: 'Autenticação, autorização, cookies e rate limit', seed: 'auth-http.js',
        goal: 'Separar identidade, permissão e proteção contra abuso.',
        concept: 'Autenticação responde quem é; autorização responde o que pode fazer. A autorização deve ser verificada no servidor a cada operação protegida.',
        detail: 'Cookies de sessão sensíveis pedem HttpOnly, Secure e SameSite. Rate limit reduz abuso, mas precisa de chave, janela e resposta 429 coerentes.',
        example: ['function autorizar(usuario, donoId) {', "  if (!usuario) return { status: 401 };", "  if (usuario.id !== donoId && usuario.papel !== 'admin') return { status: 403 };", '  return { status: 204 };', '}'],
        connection: 'A API deixa de confiar apenas em dados do cliente e passa a impor políticas.',
        pitfall: 'Confundir 401 (não autenticado) com 403 (autenticado, sem permissão).',
        question: 'Onde a autorização deve ser aplicada?', correct: 'No servidor, perto da operação protegida.', wrong: 'Somente escondendo o botão no frontend.', whyWrong: 'O cliente pode chamar a API diretamente.', explain: 'Interface melhora UX; servidor protege o recurso.',
        challengeTitle: 'Aplique uma política de acesso', challenge: 'Crie autorizar(usuario, recurso) com 401, 403 e permitido; crie também uma função de cookie de sessão com HttpOnly, Secure e SameSite.',
        hints: ['Compare dono ou papel admin.', 'Não coloque o token no console.'],
        solution: ['function autorizar(usuario, recurso) {', "  if (!usuario) return { permitido: false, status: 401 };", "  if (usuario.id !== recurso.donoId && usuario.papel !== 'admin') return { permitido: false, status: 403 };", '  return { permitido: true, status: 200 };', '}', "function cookieSessao(token) { return 'sessao=' + encodeURIComponent(token) + '; HttpOnly; Secure; SameSite=Lax; Path=/'; }", "console.log(autorizar({ id: 2, papel: 'membro' }, { donoId: 2 }).status);"],
        rules: [
          { re: /!\s*usuario[\s\S]*401/, msg: 'Diferencie ausência de autenticação.' },
          { re: /usuario\.id\s*!==?\s*recurso\.donoId[\s\S]*403/, msg: 'Verifique propriedade ou papel.' },
          { re: /HttpOnly/, msg: 'Proteja o cookie contra JavaScript do cliente.' },
          { re: /Secure/, msg: 'Restrinja o cookie a HTTPS.' },
          { re: /SameSite=(?:Lax|Strict)/, msg: 'Declare política SameSite.' }
        ]
      },
      {
        id: 'js10-5', n: '10.5', title: 'Middleware, serviços e persistência', seed: 'camadas.js',
        goal: 'Separar protocolo, regra de negócio e armazenamento.',
        concept: 'Middleware trata preocupações transversais; rota traduz HTTP; serviço aplica regra; repositório esconde persistência.',
        detail: 'A direção da dependência aponta para contratos. Um serviço recebe o repositório, o que permite trocar memória por banco e testar sem rede.',
        example: ['function criarServico(repo) {', '  return { listar: () => repo.listar() };', '}', 'const servico = criarServico(repositorio);'],
        connection: 'O Map da primeira aula do módulo torna-se uma implementação atrás de uma porta estável.',
        pitfall: 'Colocar SQL, validação, autorização e formatação HTTP dentro da mesma função de rota.',
        question: 'Quem deve conhecer o status HTTP?', correct: 'A camada de rota/adaptador HTTP, não o repositório.', wrong: 'O repositório de dados.', whyWrong: 'Persistência não deve depender do protocolo de entrega.', explain: 'Separação permite testar e trocar adaptadores.',
        challengeTitle: 'Separe três camadas', challenge: 'Crie repositorio com salvar, um serviço injetado que valida e salva, e uma rota que traduz sucesso/erro para status e corpo.',
        hints: ['O serviço recebe repo pelo parâmetro.', 'Somente a rota cria resposta HTTP.'],
        solution: ['function criarRepositorio() {', '  const itens = new Map();', '  return { salvar(item) { itens.set(item.id, item); return item; } };', '}', 'function criarServico(repo) {', '  return { criar(dados) {', "    if (!dados.nome) throw new Error('nome obrigatorio');", '    return repo.salvar({ id: 1, nome: dados.nome });', '  } };', '}', 'function criarRota(servico) {', '  return dados => { try { return { status: 201, body: servico.criar(dados) }; } catch (erro) { return { status: 400, body: { erro: erro.message } }; } };', '}', "console.log(criarRota(criarServico(criarRepositorio()))({ nome: 'Aula' }));"],
        rules: [
          { re: /function\s+criarRepositorio[\s\S]*salvar\s*\(/, msg: 'Defina a porta de persistência.' },
          { re: /function\s+criarServico\s*\(\s*repo\s*\)/, msg: 'Injete o repositório no serviço.' },
          { re: /repo\.salvar\s*\(/, msg: 'Faça o serviço usar a porta.' },
          { re: /status\s*:\s*201[\s\S]*status\s*:\s*400/, msg: 'Traduza sucesso e erro na rota.' }
        ]
      }
    ],
    js11: [
      {
        id: 'js11-2', n: '11.2', title: 'Pirâmide de testes e dublês', seed: 'testes-camadas.js',
        goal: 'Escolher entre teste unitário, integração, E2E e contrato.',
        concept: 'Unitários isolam regra; integração verifica componentes reais juntos; E2E percorre o sistema; contrato garante compatibilidade entre fronteiras.',
        detail: 'Fakes implementam uma porta de forma simples; spies observam chamadas; mocks prescrevem interações. Prefira verificar comportamento observável.',
        example: ['function criarServico(repo) { return { contar: () => repo.listar().length }; }', 'const fake = { listar: () => [1, 2] };', "it('conta itens', () => expect(criarServico(fake).contar()).toBe(2));"],
        connection: 'O primeiro teste unitário ganha contexto dentro de uma estratégia de qualidade.',
        pitfall: 'Mockar todos os detalhes internos e quebrar testes a cada refatoração segura.',
        question: 'Qual teste verifica banco e repositório juntos?', correct: 'Um teste de integração.', wrong: 'Um teste unitário totalmente isolado.', whyWrong: 'Unitário não exercita a integração real.', explain: 'O tipo do teste depende da fronteira exercitada.',
        challengeTitle: 'Teste com um fake', challenge: 'Crie um serviço que recebe repositório, um fake em memória e dois testes: caso normal e erro/limite. Use describe, it e expect.',
        hints: ['O fake deve obedecer à mesma porta.', 'Teste resultado, não implementação interna.'],
        solution: ['function criarServico(repo) { return { buscar(id) { const item = repo.buscar(id); if (!item) throw new Error(\'ausente\'); return item; } }; }', "const fake = { buscar: id => id === 1 ? { id: 1, nome: 'Ana' } : null };", "describe('servico', () => {", "  it('busca existente', () => expect(criarServico(fake).buscar(1).nome).toBe('Ana'));", "  it('rejeita ausente', () => expect(() => criarServico(fake).buscar(2)).toThrow('ausente'));", '});'],
        rules: [
          { re: /function\s+\w+\s*\(\s*repo\s*\)/, msg: 'Injete o repositório no serviço.' },
          { re: /const\s+\w+\s*=\s*\{[^}]*buscar\s*:/s, msg: 'Crie um fake da porta.' },
          { re: /describe\s*\(/, msg: 'Agrupe os testes.' },
          { re: /\bit\s*\(/, count: 2, msg: 'Escreva ao menos dois casos de teste.' },
          { re: /toThrow\s*\(/, msg: 'Cubra o caminho de erro.' }
        ]
      },
      {
        id: 'js11-3', n: '11.3', title: 'XSS, CSRF, CORS e CSP', seed: 'seguranca-web.js',
        goal: 'Aplicar defesas no contexto correto do browser.',
        concept: 'XSS injeta execução no contexto da origem; evite sinks perigosos e escape por contexto. CSRF explora credenciais enviadas automaticamente.',
        detail: 'CORS controla leitura por outras origens, não autentica. CSP reduz impacto de injeção ao limitar fontes de código, mas não substitui correção.',
        example: ['function mostrar(elemento, entrada) {', '  elemento.textContent = entrada;', '}', "const headers = { 'content-security-policy': \"default-src 'self'; script-src 'self'\" };"],
        connection: 'DOM, cookies e HTTP se encontram nas ameaças de uma aplicação web real.',
        pitfall: 'Achar que CORS bloqueia chamadas de servidor para servidor ou corrige CSRF sozinho.',
        question: 'CORS é um mecanismo de autenticação?', correct: 'Não; é uma política do browser sobre leitura entre origens.', wrong: 'Sim, substitui sessão e autorização.', whyWrong: 'O servidor ainda precisa autenticar e autorizar.', explain: 'Cada defesa cobre uma ameaça e uma fronteira específica.',
        challengeTitle: 'Monte uma resposta web defensiva', challenge: 'Crie uma função que insira mensagem com textContent e outra que devolva headers com CSP, CORS restrito e cookie SameSite. Não use innerHTML.',
        hints: ['Permita uma origem específica, não asterisco com credenciais.', 'Use uma CSP pequena e explícita.'],
        solution: ['function mostrar(elemento, mensagem) { elemento.textContent = mensagem; }', 'function headers(origemPermitida) {', '  return {', "    'content-security-policy': \"default-src 'self'; script-src 'self'\",", "    'access-control-allow-origin': origemPermitida,", "    'set-cookie': 'sessao=x; HttpOnly; Secure; SameSite=Lax'", '  };', '}', "console.log(headers('https://app.example'));"],
        rules: [
          { re: /\.textContent\s*=/, msg: 'Insira a mensagem como texto.' },
          { re: /content-security-policy/, msg: 'Defina uma CSP.' },
          { re: /access-control-allow-origin/, msg: 'Defina explicitamente a origem permitida.' },
          { re: /SameSite=(?:Lax|Strict)/, msg: 'Reduza CSRF no cookie.' }
        ],
        forbid: [{ re: /\.innerHTML\s*=/, msg: 'Evite o sink innerHTML para entrada variável.' }]
      },
      {
        id: 'js11-4', n: '11.4', title: 'Injeção, prototype pollution, ReDoS e segredos', seed: 'seguranca-node.js',
        goal: 'Defender fronteiras de backend contra entradas hostis.',
        concept: 'Consultas devem usar parâmetros, nunca concatenação. Chaves como __proto__ exigem bloqueio ao mesclar entrada em objetos.',
        detail: 'Regex com retrocesso explosivo pode causar ReDoS. Segredos ficam fora do código e logs; JWT deve ter assinatura, expiração, emissor e audiência verificados.',
        example: ["const proibidas = new Set(['__proto__', 'prototype', 'constructor']);", 'function chaveSegura(chave) { return !proibidas.has(chave); }'],
        connection: 'Validação do módulo 2 agora considera adversários, não somente erro acidental.',
        pitfall: 'Decodificar JWT e tratar o payload como confiável sem verificar assinatura e claims.',
        question: 'Como passar valor variável para SQL?', correct: 'Por parâmetro preparado da biblioteca do banco.', wrong: 'Concatenando após remover aspas manualmente.', whyWrong: 'Sanitização caseira não cobre a gramática e os encodings.', explain: 'Separe comando e dados na API do driver.',
        challengeTitle: 'Copie apenas chaves seguras', challenge: 'Crie copiarSeguro(entrada) que produza Object.create(null), ignore __proto__/prototype/constructor e copie somente chaves próprias. Demonstre com objeto normal.',
        hints: ['Percorra Object.keys.', 'Use um Set de chaves proibidas.'],
        solution: ["const proibidas = new Set(['__proto__', 'prototype', 'constructor']);", 'function copiarSeguro(entrada) {', '  const saida = Object.create(null);', '  for (const chave of Object.keys(entrada)) {', '    if (!proibidas.has(chave)) saida[chave] = entrada[chave];', '  }', '  return saida;', '}', "console.log(copiarSeguro({ nome: 'Ana' }));"],
        rules: [
          { re: /['"]__proto__['"][\s\S]*['"]prototype['"][\s\S]*['"]constructor['"]/, msg: 'Bloqueie as três chaves sensíveis.' },
          { re: /Object\.create\s*\(\s*null\s*\)/, msg: 'Crie um dicionário sem prototype.' },
          { re: /Object\.keys\s*\(/, msg: 'Percorra somente chaves próprias enumeráveis.' },
          { re: /!\s*\w+\.has\s*\(\s*chave\s*\)/, msg: 'Copie apenas chaves permitidas.' }
        ]
      },
      {
        id: 'js11-5', n: '11.5', title: 'Logs, métricas e traces', seed: 'observabilidade.js',
        goal: 'Produzir sinais correlacionáveis sem expor dados sensíveis.',
        concept: 'Logs descrevem eventos discretos; métricas agregam medidas; traces acompanham uma operação por serviços. Um correlation id liga os sinais.',
        detail: 'Logs estruturados são objetos serializáveis com nível, evento e contexto. Redija tokens, senhas e dados pessoais antes de registrar.',
        example: ['function log(evento, contexto) {', '  console.log(JSON.stringify({ nivel: \'info\', evento, ...contexto }));', '}', "log('pedido_concluido', { correlationId: 'abc', duracaoMs: 12 });"],
        connection: 'Testes provam cenários conhecidos; observabilidade ajuda a entender o sistema real em execução.',
        pitfall: 'Registrar o objeto request inteiro e vazar Authorization, cookies ou senha.',
        question: 'Qual sinal representa uma distribuição de latência?', correct: 'Uma métrica, como histograma de duração.', wrong: 'Um segredo em um log de texto.', whyWrong: 'Além de inseguro, um log isolado não é uma distribuição agregada.', explain: 'Escolha o sinal conforme a pergunta operacional.',
        challengeTitle: 'Registre um evento seguro', challenge: 'Crie registrar(evento, contexto) que remova token e senha, inclua timestamp/correlationId/duracaoMs e escreva JSON estruturado.',
        hints: ['Desestruture campos sensíveis sem copiá-los.', 'Use JSON.stringify uma única vez.'],
        solution: ['function registrar(evento, contexto) {', '  const { token, senha, ...seguro } = contexto;', '  const registro = { nivel: \'info\', evento, timestamp: new Date().toISOString(), ...seguro };', '  console.log(JSON.stringify(registro));', '}', "registrar('http_fim', { correlationId: 'abc', duracaoMs: 18, token: 'segredo' });"],
        rules: [
          { re: /\{\s*token\s*,\s*senha\s*,\s*\.\.\.\w+\s*\}/, msg: 'Remova os campos sensíveis por desestruturação.' },
          { re: /new\s+Date\s*\(\s*\)\.toISOString\s*\(\)/, msg: 'Inclua timestamp padronizado.' },
          { re: /correlationId/, msg: 'Inclua um identificador de correlação.' },
          { re: /duracaoMs/, msg: 'Inclua uma medida de duração.' },
          { re: /console\.log\s*\(\s*JSON\.stringify\s*\(/, msg: 'Emita um objeto estruturado.' }
        ]
      }
    ],
    js12: [
      {
        id: 'js12-2', n: '12.2', title: 'Coesão, acoplamento e inversão de dependência', seed: 'dependencias.js',
        goal: 'Fazer regras dependerem de contratos pequenos.',
        concept: 'Coesão mantém responsabilidades relacionadas juntas. Acoplamento mede quanto uma parte conhece detalhes de outra.',
        detail: 'Inversão de dependência faz a regra receber uma porta. O adaptador concreto conhece banco, rede ou relógio; o caso de uso conhece apenas operações necessárias.',
        example: ['function criarCasoDeUso({ agora, repo }) {', '  return dados => repo.salvar({ ...dados, criadoEm: agora() });', '}'],
        connection: 'A injeção usada no backend se torna uma regra de arquitetura consciente.',
        pitfall: 'Criar uma interface enorme para “desacoplar” e obrigar todo consumidor a conhecer métodos que não usa.',
        question: 'Quem define a porta ideal?', correct: 'O consumidor, a partir das operações de que precisa.', wrong: 'Sempre a biblioteca de banco.', whyWrong: 'Isso faz a regra depender do detalhe externo.', explain: 'Contratos pequenos seguem as necessidades do caso de uso.',
        challengeTitle: 'Inverta relógio e persistência', challenge: 'Crie uma factory de caso de uso que receba agora e repo, valide dados, use as dependências e não acesse Date ou banco diretamente.',
        hints: ['Receba um objeto de dependências.', 'Use agora() e repo.salvar().'],
        solution: ['function criarCadastro({ agora, repo }) {', '  return function cadastrar(dados) {', "    if (!dados.nome) throw new Error('nome obrigatorio');", '    return repo.salvar({ nome: dados.nome, criadoEm: agora() });', '  };', '}', "const cadastrar = criarCadastro({ agora: () => '2026-01-01', repo: { salvar: item => item } });", "console.log(cadastrar({ nome: 'Ana' }));"],
        rules: [
          { re: /function\s+\w+\s*\(\s*\{\s*agora\s*,\s*repo\s*\}\s*\)/, msg: 'Receba as dependências explicitamente.' },
          { re: /agora\s*\(\s*\)/, msg: 'Use o relógio injetado.' },
          { re: /repo\.salvar\s*\(/, msg: 'Use a porta de persistência.' }
        ],
        forbid: [{ re: /new\s+Date\s*\(/, msg: 'O caso de uso não deve criar seu relógio diretamente.' }]
      },
      {
        id: 'js12-3', n: '12.3', title: 'Ports and adapters e monólito modular', seed: 'arquitetura-modular.js',
        goal: 'Organizar módulos por capacidade e manter adaptadores nas bordas.',
        concept: 'Ports and adapters mantém domínio no centro e integrações nas bordas. Um monólito modular preserva limites sem custo operacional de vários serviços.',
        detail: 'Eventos internos comunicam fatos já ocorridos. Padrões são vocabulário, não objetivos; aplique-os onde reduzem mudança e dependência.',
        example: ['function criarModuloPedidos({ repositorio, publicar }) {', '  return { criar: pedido => { const salvo = repositorio.salvar(pedido); publicar({ tipo: \'PedidoCriado\', id: salvo.id }); return salvo; } };', '}'],
        connection: 'Contratos pequenos podem delimitar módulos inteiros dentro da mesma implantação.',
        pitfall: 'Criar microserviços antes de existirem limites claros, necessidade de escala ou autonomia.',
        question: 'Monólito modular significa código sem módulos?', correct: 'Não; é uma implantação com limites internos explícitos.', wrong: 'Sim, tudo pode importar qualquer coisa.', whyWrong: 'Isso seria um monólito acoplado, não modular.', explain: 'Limite lógico não exige processo separado.',
        challengeTitle: 'Publique um evento de domínio', challenge: 'Crie módulo de pedidos injetando repositório e publicar. Ao criar, salve, publique PedidoCriado e devolva o registro.',
        hints: ['Publique depois de salvar.', 'O evento leva tipo e id, não o objeto inteiro.'],
        solution: ['function criarModuloPedidos({ repositorio, publicar }) {', '  return {', '    criar(dados) {', '      const salvo = repositorio.salvar(dados);', "      publicar({ tipo: 'PedidoCriado', id: salvo.id });", '      return salvo;', '    }', '  };', '}', 'const eventos = [];', 'const pedidos = criarModuloPedidos({ repositorio: { salvar: p => ({ id: 1, ...p }) }, publicar: e => eventos.push(e) });', "console.log(pedidos.criar({ total: 20 }), eventos);"],
        rules: [
          { re: /function\s+\w+\s*\(\s*\{\s*repositorio\s*,\s*publicar\s*\}/, msg: 'Injete as duas portas.' },
          { re: /repositorio\.salvar\s*\(/, msg: 'Persista pela porta.' },
          { re: /publicar\s*\(\s*\{[^}]*tipo\s*:\s*['"]PedidoCriado['"][^}]*id/s, msg: 'Publique o evento mínimo.' },
          { re: /return\s+salvo/, msg: 'Devolva o registro criado.' }
        ]
      },
      {
        id: 'js12-4', n: '12.4', title: 'Profiling, GC e vazamentos de memória', seed: 'performance.js',
        goal: 'Medir antes de otimizar e reconhecer retenção acidental.',
        concept: 'Profiling revela onde tempo e memória são gastos. Garbage collection libera objetos inalcançáveis; vazamento é retenção indesejada por referências ainda alcançáveis.',
        detail: 'Listeners nunca removidos, caches sem limite e timers esquecidos são fontes comuns. Otimize o gargalo medido e preserve um teste de comportamento.',
        example: ['const inicio = performance.now();', 'const resultado = trabalho();', 'const duracaoMs = performance.now() - inicio;', 'console.log({ duracaoMs, resultado });'],
        connection: 'Arquitetura dá limites; profiling mostra qual limite realmente custa.',
        pitfall: 'Micro-otimizar sintaxe sem medir o fluxo completo ou criar um cache infinito.',
        question: 'Quando o GC pode liberar um objeto?', correct: 'Quando ele deixa de ser alcançável por referências vivas.', wrong: 'Assim que uma variável muda de nome.', whyWrong: 'Nomes não determinam alcançabilidade por si só.', explain: 'Referências e raízes vivas determinam retenção.',
        challengeTitle: 'Crie um cache limitado e medido', challenge: 'Implemente uma função memoizada com Map e limite máximo; ao exceder, remova a chave mais antiga. Meça duas chamadas com performance.now.',
        hints: ['Map preserva ordem de inserção.', 'A primeira chave vem de cache.keys().next().value.'],
        solution: ['function memoLimitado(fn, limite = 2) {', '  const cache = new Map();', '  return chave => {', '    if (cache.has(chave)) return cache.get(chave);', '    const valor = fn(chave);', '    cache.set(chave, valor);', '    if (cache.size > limite) cache.delete(cache.keys().next().value);', '    return valor;', '  };', '}', 'const dobro = memoLimitado(n => n * 2);', 'const inicio = performance.now();', 'dobro(1); dobro(2); dobro(3); dobro(3);', "console.log('duracaoMs', performance.now() - inicio);"],
        rules: [
          { re: /new\s+Map\s*\(/, msg: 'Use Map para o cache.' },
          { re: /cache\.size\s*>\s*limite/, msg: 'Imponha um limite explícito.' },
          { re: /cache\.delete\s*\(\s*cache\.keys\s*\(\s*\)\.next\s*\(\s*\)\.value/, msg: 'Remova a entrada mais antiga.' },
          { re: /performance\.now\s*\(/, msg: 'Meça o cenário.' }
        ]
      },
      {
        id: 'js12-5', n: '12.5', title: 'Configuração, health, deploy e shutdown', seed: 'producao.js',
        goal: 'Preparar uma aplicação para iniciar, sinalizar prontidão e encerrar.',
        concept: 'Build produz artefatos reproduzíveis; deploy promove uma versão. Configuração varia por ambiente, mas o código e o artefato devem permanecer os mesmos.',
        detail: 'Liveness responde se o processo vive; readiness responde se pode receber tráfego. Shutdown retira prontidão antes de fechar dependências.',
        example: ['let pronto = false;', 'async function iniciar() { await conectar(); pronto = true; }', "function health(tipo) { return tipo === 'ready' && !pronto ? 503 : 200; }"],
        connection: 'O curso termina com o ciclo de vida operacional do sistema construído.',
        pitfall: 'Marcar readiness como saudável antes de banco e dependências estarem disponíveis.',
        question: 'Quando readiness deve virar falsa no encerramento?', correct: 'Antes de fechar recursos, para parar de receber tráfego novo.', wrong: 'Somente depois de o processo morrer.', whyWrong: 'Nesse ponto não há resposta e requisições podem ter sido enviadas durante o fechamento.', explain: 'Prontidão coordena o processo com o balanceador/orquestrador.',
        challengeTitle: 'Modele o ciclo de vida', challenge: 'Crie estado pronto, iniciar que valida NODE_ENV e conecta, health com live/ready e shutdown que desativa prontidão, fecha recursos e define exitCode.',
        hints: ['Readiness deve retornar 503 antes da inicialização.', 'Desative pronto no começo do shutdown.'],
        solution: ['let pronto = false;', 'async function iniciar({ conectar }) {', "  const ambiente = process.env.NODE_ENV || 'development';", "  if (!['development', 'test', 'production'].includes(ambiente)) throw new Error('ambiente invalido');", '  await conectar(); pronto = true;', '}', "function health(tipo) { return tipo === 'ready' && !pronto ? { status: 503 } : { status: 200 }; }", 'async function shutdown({ fechar }) { pronto = false; await fechar(); process.exitCode = 0; }', 'console.log(health(\'ready\'));'],
        rules: [
          { re: /process\.env\.NODE_ENV/, msg: 'Leia a configuração do ambiente.' },
          { re: /await\s+conectar\s*\(\s*\)[\s\S]*pronto\s*=\s*true/, msg: 'Só fique pronto depois de conectar.' },
          { re: /['"]ready['"][\s\S]*503/, msg: 'Exponha readiness indisponível.' },
          { re: /shutdown[\s\S]*pronto\s*=\s*false[\s\S]*await\s+fechar/, msg: 'Retire prontidão antes de fechar.' },
          { re: /process\.exitCode\s*=\s*0/, msg: 'Finalize sem saída forçada.' }
        ]
      }
    ],
    jspf: [
      {
        id: 'jspf-2', n: 'PF.2', title: 'Contrato e plano do sistema', seed: 'projeto-contrato.js',
        goal: 'Transformar o projeto final em entregas verificáveis.',
        concept: 'O projeto será um serviço de tarefas: núcleo de domínio, repositório, API, autenticação, observabilidade e testes. O contrato vem antes dos detalhes.',
        detail: 'Defina operações, entradas, erros e eventos. Divida a entrega em fatias verticais pequenas que já possam ser demonstradas.',
        example: ['const contrato = {', "  criar: { entrada: ['titulo', 'usuarioId'], saida: ['id', 'titulo', 'concluida'] },", "  concluir: { erros: ['NAO_ENCONTRADA', 'PROIBIDO'] }", '};'],
        connection: 'O projeto deixa de ser uma função isolada e passa a integrar toda a trilha.',
        pitfall: 'Começar por framework ou banco antes de estabilizar as regras e os contratos.',
        question: 'Qual é uma boa primeira fatia?', correct: 'Criar e listar tarefas em memória com testes do domínio.', wrong: 'Configurar produção inteira sem uma regra funcionando.', whyWrong: 'Isso adia feedback sobre o comportamento central.', explain: 'Fatia vertical pequena reduz risco e produz evidência cedo.',
        challengeTitle: 'Especifique o contrato', challenge: 'Crie um objeto contrato com criar/listar/concluir, campos de entrada/saída e códigos de erro; valide que os nomes das operações são únicos e mostre JSON.',
        hints: ['Use arrays de campos.', 'Inclua NAO_ENCONTRADA e PROIBIDO.'],
        solution: ['const contrato = {', "  criar: { entrada: ['titulo', 'usuarioId'], saida: ['id', 'titulo', 'concluida'] },", "  listar: { entrada: ['usuarioId'], saida: ['tarefas'] },", "  concluir: { entrada: ['id', 'usuarioId'], erros: ['NAO_ENCONTRADA', 'PROIBIDO'] }", '};', 'const operacoes = Object.keys(contrato);', 'if (new Set(operacoes).size !== operacoes.length) throw new Error(\'operacao duplicada\');', 'console.log(JSON.stringify(contrato, null, 2));'],
        rules: [
          { re: /criar\s*:\s*\{[\s\S]*listar\s*:\s*\{[\s\S]*concluir\s*:\s*\{/s, msg: 'Descreva as três operações.' },
          { re: /entrada\s*:\s*\[[^\]]+\][\s\S]*saida\s*:\s*\[[^\]]+\]/, msg: 'Declare entradas e saídas.' },
          { re: /NAO_ENCONTRADA[\s\S]*PROIBIDO/, msg: 'Declare erros de domínio.' },
          { re: /new\s+Set\s*\(/, msg: 'Valide operações únicas.' }
        ]
      },
      {
        id: 'jspf-3', n: 'PF.3', title: 'Domínio e persistência do projeto', seed: 'projeto-dominio.js',
        goal: 'Implementar regras sem depender de HTTP ou banco específico.',
        concept: 'O domínio cria e conclui tarefas. O repositório é uma porta com salvar, buscar e listarPorUsuario; a implementação em memória permite teste rápido.',
        detail: 'IDs e relógio entram como dependências para que testes sejam determinísticos. Toda entrada é validada antes de persistir.',
        example: ['function criarServico({ repo, novoId, agora }) {', '  return { criar: dados => repo.salvar({ id: novoId(), criadaEm: agora(), ...dados }) };', '}'],
        connection: 'Funções, objetos, coleções, módulos e arquitetura agora trabalham na mesma entrega.',
        pitfall: 'Gerar Date e id dentro da regra e tornar o teste dependente do ambiente.',
        question: 'Por que injetar novoId e agora?', correct: 'Para controlar efeitos e tornar testes determinísticos.', wrong: 'Para aumentar o número de parâmetros sem benefício.', whyWrong: 'Essas dependências isolam variação externa.', explain: 'Efeitos nas bordas deixam o núcleo previsível.',
        challengeTitle: 'Implemente o núcleo', challenge: 'Crie repo em memória e serviço injetado com criar, listar e concluir; valide título, isole usuários e impeça concluir tarefa alheia.',
        hints: ['Guarde tarefas em Map.', 'Liste filtrando usuarioId.'],
        solution: ['function criarRepo() {', '  const itens = new Map();', '  return { salvar: t => (itens.set(t.id, t), t), buscar: id => itens.get(id), listarPorUsuario: usuarioId => [...itens.values()].filter(t => t.usuarioId === usuarioId) };', '}', 'function criarServico({ repo, novoId, agora }) {', '  return {', "    criar({ titulo, usuarioId }) { if (!titulo || !titulo.trim()) throw new Error('TITULO_INVALIDO'); return repo.salvar({ id: novoId(), titulo: titulo.trim(), usuarioId, concluida: false, criadaEm: agora() }); },", '    listar(usuarioId) { return repo.listarPorUsuario(usuarioId); },', "    concluir(id, usuarioId) { const t = repo.buscar(id); if (!t) throw new Error('NAO_ENCONTRADA'); if (t.usuarioId !== usuarioId) throw new Error('PROIBIDO'); return repo.salvar({ ...t, concluida: true }); }", '  };', '}', "const servico = criarServico({ repo: criarRepo(), novoId: () => 't1', agora: () => '2026-01-01' });", "console.log(servico.criar({ titulo: ' Estudar ', usuarioId: 'u1' }));"],
        rules: [
          { re: /new\s+Map\s*\(/, msg: 'Implemente persistência em memória.' },
          { re: /listarPorUsuario[\s\S]*\.filter\s*\(/, msg: 'Isole os dados por usuário.' },
          { re: /novoId\s*\(\s*\)[\s\S]*agora\s*\(\s*\)/, msg: 'Use id e relógio injetados.' },
          { re: /NAO_ENCONTRADA[\s\S]*PROIBIDO/, msg: 'Implemente os dois erros de domínio.' },
          { re: /\{\s*\.\.\.t\s*,\s*concluida\s*:\s*true\s*\}/, msg: 'Conclua criando novo estado.' }
        ]
      },
      {
        id: 'jspf-4', n: 'PF.4', title: 'API, segurança e observabilidade do projeto', seed: 'projeto-api.js',
        goal: 'Adaptar o domínio para HTTP com identidade e logs seguros.',
        concept: 'A rota autentica, valida o protocolo, chama o serviço e traduz erros conhecidos. Correlation id acompanha toda resposta e log.',
        detail: 'Não registre token ou corpo completo. Respostas de erro usam código estável e mensagem segura; detalhes internos ficam no log controlado.',
        example: ['async function rota(req, servico, log) {', "  if (!req.usuario) return { status: 401, body: { codigo: 'NAO_AUTENTICADO' } };", '  log({ evento: \'requisicao\', correlationId: req.correlationId });', '}'],
        connection: 'HTTP, autenticação, validação e observabilidade envolvem o núcleo sem contaminá-lo.',
        pitfall: 'Devolver stack trace para o cliente ou registrar Authorization.',
        question: 'Onde traduzir PROIBIDO para status 403?', correct: 'No adaptador/rota HTTP.', wrong: 'Dentro do repositório.', whyWrong: 'O repositório não deve conhecer HTTP.', explain: 'O adaptador traduz entre contratos externos e internos.',
        challengeTitle: 'Implemente o adaptador HTTP', challenge: 'Crie uma rota de concluir que exige usuario, passa id/usuarioId ao serviço, mapeia NAO_ENCONTRADA=404 e PROIBIDO=403, inclui correlationId e log estruturado.',
        hints: ['Use try/catch somente para traduzir erros conhecidos.', 'Não inclua token no log.'],
        solution: ['function rotaConcluir(req, servico, registrar) {', "  if (!req.usuario) return { status: 401, body: { codigo: 'NAO_AUTENTICADO', correlationId: req.correlationId } };", '  try {', '    const tarefa = servico.concluir(req.params.id, req.usuario.id);', "    registrar('tarefa_concluida', { correlationId: req.correlationId, tarefaId: tarefa.id });", '    return { status: 200, body: { tarefa, correlationId: req.correlationId } };', '  } catch (erro) {', "    const status = erro.message === 'NAO_ENCONTRADA' ? 404 : erro.message === 'PROIBIDO' ? 403 : 500;", '    return { status, body: { codigo: status === 500 ? \'INTERNO\' : erro.message, correlationId: req.correlationId } };', '  }', '}'],
        rules: [
          { re: /!\s*req\.usuario[\s\S]*401/, msg: 'Exija autenticação.' },
          { re: /servico\.concluir\s*\(\s*req\.params\.id\s*,\s*req\.usuario\.id\s*\)/, msg: 'Passe identidade ao domínio.' },
          { re: /NAO_ENCONTRADA['"]?\s*\?\s*404[\s\S]*PROIBIDO['"]?\s*\?\s*403/, msg: 'Mapeie os erros conhecidos.' },
          { re: /correlationId/, msg: 'Correlacione resposta e log.' },
          { re: /registrar\s*\(\s*['"]tarefa_concluida['"]/, msg: 'Registre um evento estruturado.' }
        ]
      },
      {
        id: 'jspf-5', n: 'PF.5', title: 'Testes e entrega operacional', seed: 'projeto-entrega.js',
        goal: 'Provar o sistema e documentar seu ciclo de vida.',
        concept: 'A entrega final combina testes unitários do domínio, integração da rota com fake e verificações de health/readiness e shutdown.',
        detail: 'Um README operacional deve explicar configuração, comandos, endpoints, migração, observabilidade e rollback. “Funciona na minha máquina” não é critério de produção.',
        example: ["describe('tarefas', () => {", "  it('isola tarefas por usuário', () => { /* cenário e expect */ });", "  it('nega tarefa alheia', () => { /* expect toThrow */ });", '});'],
        connection: 'O projeto fecha a trilha com evidência de comportamento e operação segura.',
        pitfall: 'Testar apenas o caminho feliz e chamar o projeto de pronto sem readiness ou shutdown.',
        question: 'O que um teste de integração da rota deve exercer?', correct: 'Tradução HTTP e colaboração real entre rota e serviço, com bordas controladas.', wrong: 'Somente uma soma isolada sem relação com a API.', whyWrong: 'Isso não verifica a integração do endpoint.', explain: 'Cada teste deve corresponder a um risco do sistema.',
        challengeTitle: 'Crie a suíte de aceite', challenge: 'Escreva pelo menos quatro testes: criar válido, título inválido, isolamento por usuário e tradução de PROIBIDO para 403. Inclua um health/readiness verificável.',
        hints: ['Use describe e quatro it.', 'Construa o sistema novamente em cada teste para evitar estado compartilhado.'],
        solution: ["describe('aceite do servico de tarefas', () => {", "  it('cria uma tarefa valida', () => expect(criarSistema().criar({ titulo: 'A', usuarioId: 'u1' }).concluida).toBe(false));", "  it('rejeita titulo vazio', () => expect(() => criarSistema().criar({ titulo: '', usuarioId: 'u1' })).toThrow('TITULO_INVALIDO'));", "  it('isola usuarios', () => { const s = criarSistema(); s.criar({ titulo: 'A', usuarioId: 'u1' }); expect(s.listar('u2').length).toBe(0); });", "  it('traduz proibido para 403', () => expect(testarRotaProibida().status).toBe(403));", '});', 'function health(pronto) { return { status: pronto ? 200 : 503 }; }', 'console.log(health(false), health(true));'],
        rules: [
          { re: /describe\s*\(/, msg: 'Agrupe a suíte de aceite.' },
          { re: /\bit\s*\(/, count: 4, msg: 'Inclua ao menos quatro casos de teste.' },
          { re: /TITULO_INVALIDO/, msg: 'Cubra validação de título.' },
          { re: /listar\s*\(\s*['"]u2['"]\s*\)[\s\S]*toBe\s*\(\s*0\s*\)/, msg: 'Prove isolamento por usuário.' },
          { re: /403/, msg: 'Cubra a tradução de autorização.' },
          { re: /health[\s\S]*503/, msg: 'Inclua readiness indisponível com status 503.' },
          { re: /health[\s\S]*200/, msg: 'Inclua readiness disponível com status 200.' }
        ]
      }
    ]
  };

  for (const [modulo, aulas] of Object.entries(CURRICULO)) {
    for (const aula of aulas) registrar(modulo, aula);
  }
})();
