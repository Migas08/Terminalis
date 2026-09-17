/* =========================================================================
   TERMINALIS — trilha de JavaScript

   Registra a trilha, seus 12 módulos + projeto final e a primeira aula-piloto,
   que já roda de verdade no playground isolado (aba JS). Os demais módulos ainda
   não têm aulas: a interface os mostra como "em breve" automaticamente, então o
   aluno enxerga o mapa completo e o que já dá para fazer.

   Este arquivo é autocontido (usa LX.mod, LX.TRILHAS.push e LX.lesson) para não
   alterar os cursos existentes, conforme o briefing da fase JS/TS. Carrega depois
   de 50-content-02-trilhas.js, quando LX.TRILHAS já existe.
   ========================================================================= */
'use strict';
(function () {
  const G = 'JavaScript';

  /* Títulos dos módulos, na ordem do currículo. Só o primeiro tem aula por ora;
     os outros aparecem como "em breve" enquanto o conteúdo é escrito. */
  const MODULOS = [
    ['js01', '01', 'O que executa JavaScript', 'Linguagem, engine e host: o que roda seu código e em que contexto.'],
    ['js02', '02', 'Valores, coerção e contratos de dados', 'Tipos, identidade, igualdade e conversões — sem decorar trivia.'],
    ['js03', '03', 'Escopo, funções e closures', 'var/let/const, this, closures, fábricas e memoização.'],
    ['js04', '04', 'Objetos, prototypes e classes', 'Lookup por prototype, classes, campos privados e composição.'],
    ['js05', '05', 'Coleções, iteradores e transformação', 'Arrays, Map, Set, iteradores, geradores e avaliação preguiçosa.'],
    ['js06', '06', 'Módulos e design de pacotes', 'ESM, live bindings, ciclos, dynamic import e superfície pública.'],
    ['js07', '07', 'Assíncrono, event loop e concorrência', 'Promises, async/await, task/microtask, cancelamento e limites.'],
    ['js08', '08', 'JavaScript no browser', 'DOM, eventos, fetch, URL, storage e workers, sem framework.'],
    ['js09', '09', 'Node.js, arquivos e streams', 'process, fs, Buffer, EventEmitter, streams e backpressure.'],
    ['js10', '10', 'HTTP, backend e persistência', 'HTTP, REST, idempotência, autenticação, middleware e repositórios.'],
    ['js11', '11', 'Testes, segurança e observabilidade', 'Testes, XSS/CSRF/CSP, injeção, segredos, logs, métricas e traces.'],
    ['js12', '12', 'Arquitetura, performance e produção', 'Acoplamento, ports/adapters, profiling, build, deploy e shutdown.'],
    ['jspf', 'PF', 'Projeto final de JavaScript', 'Um sistema completo, do SDK à API, sem passo a passo.']
  ];
  for (const [id, num, title, blurb] of MODULOS) LX.mod({ id, num, group: G, title, blurb });

  const iconeJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5v3A2 2 0 0 1 2.5 11.4v.2A2 2 0 0 1 4 13.5v4A2.5 2.5 0 0 0 6.5 20H8"/><path d="M16 4h1.5A2.5 2.5 0 0 1 20 6.5v3a2 2 0 0 0 1.5 1.9v.2A2 2 0 0 0 20 13.5v4a2.5 2.5 0 0 1-2.5 2.5H16"/></svg>';

  LX.TRILHAS.push({
    id: 'js', nome: 'JavaScript do zero ao profissional', icone: iconeJS, cor: 'amber',
    resumo: 'Da execução isolada de um script ao projeto final com API, testes e produção.',
    detalhe: 'Modelo de execução, valores, funções, objetos, coleções, módulos, assíncrono, browser, Node, HTTP, testes, segurança e arquitetura.',
    nivel: 'Iniciante → profissional',
    mods: ['js01', 'js02', 'js03', 'js04', 'js05', 'js06', 'js07', 'js08', 'js09', 'js10', 'js11', 'js12', 'jspf'],
    estado: 'disponivel',
    requer: [],
    objetivos: [
      'Executar JavaScript em ambiente isolado e ler console, erros e resultados',
      'Dominar valores, funções, objetos, coleções e módulos da linguagem',
      'Prever a ordem do código assíncrono e controlar concorrência',
      'Trabalhar nos dois ambientes reais: browser e Node',
      'Construir um serviço HTTP com testes, segurança e arquitetura'
    ],
    etapas: [
      { id: 'e1', nome: 'Fundamentos e execução', resumo: 'O que roda seu código, e os valores com que ele trabalha.', mods: ['js01', 'js02'] },
      { id: 'e2', nome: 'Funções, objetos e dados', resumo: 'Escopo, closures, prototypes e as coleções da linguagem.', mods: ['js03', 'js04', 'js05'] },
      { id: 'e3', nome: 'Módulos e assíncrono', resumo: 'Organizar o código em módulos e dominar o event loop.', mods: ['js06', 'js07'] },
      { id: 'e4', nome: 'Browser e Node', resumo: 'Os dois ambientes onde JavaScript roda de verdade.', mods: ['js08', 'js09'] },
      { id: 'e5', nome: 'Backend, qualidade e produção', resumo: 'Serviços HTTP, testes, segurança e arquitetura.', mods: ['js10', 'js11', 'js12'] },
      { id: 'ef', nome: 'Projeto final', resumo: 'Um sistema inteiro, verificado por estado e testes.', mods: ['jspf'] }
    ]
  });

  /* ---------------------------- utilitários das aulas JS ----------------------------
     O aluno pratica no editor da aba JS: escreve arquivos .js em /home/aluno/js e
     roda. Os desafios são verificados pelo ESTADO desses arquivos (conteúdo real
     no VFS), nunca por execução — o mesmo verificador vale no navegador e nos
     testes de conteúdo. A solução oficial escreve o arquivo por um heredoc de
     shell (cat), que o teste de soluções executa para provar que o verificador
     aprova de fato. */
  const DIR = '/home/aluno/js';

  /* Semeia o diretório do projeto (dono: aluno) e um arquivo inicial de apoio. */
  function semear(nomeInicial, conteudoInicial) {
    return (m) => {
      const ctx = m.ctxRoot();
      const d = m.fs.mkdirp(DIR, { ctx }); d.uid = 1000; d.gid = 1000;
      if (nomeInicial) {
        const n = m.fs.writeFile(DIR + '/' + nomeInicial, conteudoInicial || '', { ctx });
        n.uid = 1000; n.gid = 1000;
      }
    };
  }

  /* Constrói o verificador de um desafio: exige ao menos um arquivo .js escrito
     pelo aluno (fora dos arquivos semeados) cujo conteúdo satisfaça TODAS as
     regras. Cada regra é [regex, mensagem-de-pendência]. Reprova o ambiente
     intocado, porque só os arquivos semeados existem — e eles são ignorados. */
  function desafioJS(ignorados, regras, dicaVazio) {
    const ignore = new Set(['ola.js'].concat(ignorados || []));
    return async (ctx) => {
      const H = LX.H;
      const nomes = () => (H.ls(ctx, DIR) || [])
        .filter(n => typeof n === 'string' && /\.(mjs|cjs|js)$/i.test(n) && !ignore.has(n));
      const conteudos = () => nomes().map(n => H.read(ctx, DIR + '/' + n) || '');
      const melhor = () => {
        const cs = conteudos();
        if (!cs.length) return null;
        let best = cs[0], score = -1;
        for (const c of cs) { const s = regras.filter(([re]) => re.test(c)).length; if (s > score) { score = s; best = c; } }
        return best;
      };
      const checks = [[() => nomes().length > 0, dicaVazio || 'Escreva um programa novo na aba <strong>JS</strong> e clique em rodar.']];
      for (const [re, msg] of regras) checks.push([() => { const c = melhor(); return c != null && re.test(c); }, msg]);
      return H.checkAll(checks);
    };
  }

  /* ---------------------------- aula-piloto (js01) ---------------------------- */
  LX.lesson('js01', {
    id: 'js1-1', n: '1.1', title: 'Rodar seu primeiro JavaScript',
    goal: 'Executar um programa JavaScript no laboratório e ler o que o console mostra.',
    setup: (m) => {
      const ctx = m.ctxRoot();
      const d = m.fs.mkdirp('/home/aluno/js', { ctx });
      d.uid = 1000; d.gid = 1000;
      const n = m.fs.writeFile('/home/aluno/js/ola.js', "console.log('Olá, JavaScript');\nconsole.log(2 + 2);\n", { ctx });
      n.uid = 1000; n.gid = 1000;
    },
    body: [
      { h2: 'Linguagem, engine e host' },
      { p: 'JavaScript é a <strong>linguagem</strong>. Quem lê e executa suas instruções é uma <strong>engine</strong> (como a V8). E a engine sempre roda dentro de um <strong>host</strong> — um navegador ou o Node.js — que decide quais recursos existem ao redor do código.' },
      { p: 'No Terminalis, seu código roda em uma <strong>sandbox isolada</strong>, fora da aplicação. Ele não enxerga a página, o seu progresso nem a rede: só o que a aula libera. Use a aba <strong>JS</strong>: ali você <strong>escreve o código no editor</strong> e clica em <strong>rodar</strong> — o programa é salvo como arquivo e o resultado aparece no console abaixo.' },
      { box: 'key', label: 'O que é real aqui', body: [
        { p: 'A execução é JavaScript de verdade: <code>console.log</code>, erros com linha e coluna e o encerramento de um laço infinito. Rede, arquivos e APIs do Node chegam nos módulos seguintes — quando não existirem, a aula avisa.' }
      ] },
      { h4: 'Um primeiro programa' },
      { p: 'O editor da aba <strong>JS</strong> já começa com um exemplo de duas linhas:' },
      { code: ["console.log('Olá, JavaScript');", 'console.log(2 + 2);'], lang: 'text', run: false },
      { p: 'Clique em <strong>rodar</strong>: a primeira linha escreve um texto; a segunda mostra o resultado de <code>2 + 2</code>. Se errar o nome de algo (por exemplo <code>consele</code> no lugar de <code>console</code>), o console mostra o erro com a linha e a coluna — é assim que você acha o problema.' }
    ],
    tasks: [
      {
        id: 'js1-1-a', kind: 'guiado', title: 'Rode o exemplo',
        body: [
          { p: 'Abra a aba <strong>JS</strong>. O editor já traz o exemplo pronto. Clique em <strong>rodar</strong> e leia o console: uma linha com o texto e outra com o número <code>4</code>.' },
          { p: 'Depois, troque um caractere de propósito (por exemplo, escreva <code>consele</code>) e rode de novo para ver como o erro aparece. Volte a corrigir antes de seguir.' }
        ],
        hints: ['O botão <em>rodar</em> fica no topo da aba JS. O resultado aparece no console, abaixo do editor.']
      },
      {
        id: 'js1-1-q', kind: 'quiz', title: 'O que o console mostra?',
        body: [{ p: 'Você rodou <code>ola.js</code> e viu duas linhas. O que <code>console.log(2 + 2)</code> escreve no console?' }],
        options: [
          { text: 'O número 4 — a expressão é calculada antes de ser exibida.', correct: true },
          { text: 'O texto <code>2 + 2</code>, exatamente como está escrito.', why: 'console.log recebe o VALOR do argumento; <code>2 + 2</code> é avaliado para <code>4</code> antes de chegar lá.' },
          { text: 'Nada, porque console.log só aceita texto entre aspas.', why: 'console.log aceita qualquer valor — números, objetos, arrays — e não só strings.' },
          { text: 'Um erro, porque falta ponto e vírgula em algum lugar.', why: 'O ponto e vírgula é opcional na maioria dos casos; estas linhas rodam normalmente.' }
        ],
        explain: 'JavaScript calcula <code>2 + 2</code> primeiro e entrega o resultado, <code>4</code>, para <code>console.log</code>, que o escreve no console.',
        hints: ['Pense no que acontece com <code>2 + 2</code> antes de virar argumento.']
      },
      {
        id: 'js1-1-b', kind: 'desafio', title: 'Escreva uma mensagem sua',
        body: [
          { p: 'No editor da aba <strong>JS</strong>, troque o exemplo por um programa <strong>seu</strong>: use <code>console.log(...)</code> para escrever uma mensagem diferente de <code>Olá, JavaScript</code>. Clique em <strong>rodar</strong> — o editor salva o programa sozinho.' }
        ],
        hints: [
          'Apague a mensagem do exemplo e escreva a sua: <code>console.log(\'a sua mensagem aqui\')</code>.',
          'Ao rodar, o programa é salvo em <code>/home/aluno/js/rascunho.js</code>.'
        ],
        solution: '<p>No editor da aba <strong>JS</strong>, escreva por exemplo <code>console.log(\'estou aprendendo JavaScript\')</code> e clique em <strong>rodar</strong>.</p><pre>$ echo "console.log(\'estou aprendendo JavaScript\');" &gt; /home/aluno/js/meu.js</pre>',
        check: async (ctx) => {
          const H = LX.H;
          const dir = '/home/aluno/js';
          const nomes = () => (H.ls(ctx, dir) || []).filter(n => /\.(mjs|cjs|js)$/i.test(n) && n !== 'ola.js');
          const proprio = () => nomes().some(n => {
            const c = H.read(ctx, dir + '/' + n) || '';
            return /console\.log\s*\(/.test(c) && !/Olá,\s*JavaScript/.test(c);
          });
          return H.checkAll([
            [() => nomes().length > 0, 'Escreva um programa no editor da aba <strong>JS</strong> e clique em rodar.'],
            [() => proprio(), 'Use <code>console.log(...)</code> com uma mensagem <strong>sua</strong>, diferente do exemplo <code>Olá, JavaScript</code>.']
          ]);
        }
      }
    ]
  });

  /* ---------------------------- js02 — valores e coerção ---------------------------- */
  LX.lesson('js02', {
    id: 'js2-1', n: '2.1', title: 'Tipos, igualdade e valor de verdade',
    goal: 'Distinguir os tipos primitivos, usar igualdade estrita e prever o que é verdadeiro ou falso.',
    setup: semear('contrato.js', '// TODO: escreva uma função que classifica um valor.\n'),
    body: [
      { h2: 'Os tipos que existem' },
      { p: 'JavaScript tem alguns <strong>tipos primitivos</strong>: <code>number</code>, <code>string</code>, <code>boolean</code>, <code>null</code>, <code>undefined</code>, <code>bigint</code> e <code>symbol</code>. Tudo o que não é primitivo é <strong>objeto</strong> (inclusive arrays e funções). O operador <code>typeof</code> revela o tipo de um valor:' },
      { code: ["typeof 42;        // 'number'", "typeof 'oi';      // 'string'", "typeof true;      // 'boolean'", "typeof undefined; // 'undefined'", "typeof null;      // 'object'  (um bug histórico da linguagem)"], lang: 'js', run: false },
      { box: 'warn', label: 'A pegadinha do null', body: [
        { p: '<code>typeof null</code> devolve <code>\'object\'</code> por um erro que ficou na linguagem para sempre. Para testar <code>null</code>, compare direto: <code>valor === null</code>.' }
      ] },
      { h4: 'Igualdade: === e ==' },
      { p: 'Use sempre <code>===</code> (igualdade <strong>estrita</strong>): compara tipo e valor, sem surpresas. O <code>==</code> faz <strong>coerção</strong> antes de comparar, e isso gera resultados que confundem — <code>0 == \'\'</code> é <code>true</code>, <code>null == undefined</code> é <code>true</code>. Prefira <code>===</code> e converta você mesmo quando precisar.' },
      { code: ["1 === 1;      // true", "1 === '1';    // false — tipos diferentes", "1 == '1';     // true  — o == converte antes (evite)", "NaN === NaN;  // false — NaN nunca é igual a nada"], lang: 'js', run: false },
      { h4: 'Verdadeiro e falso' },
      { p: 'Em um <code>if</code>, o valor é convertido para booleano. São <strong>falsy</strong> apenas seis valores: <code>false</code>, <code>0</code>, <code>\'\'</code> (string vazia), <code>null</code>, <code>undefined</code> e <code>NaN</code>. Todo o resto é <strong>truthy</strong> — inclusive <code>\'0\'</code>, <code>[]</code> e <code>{}</code>.' },
      { box: 'key', label: 'Converter de propósito', body: [
        { p: '<code>Number(x)</code>, <code>String(x)</code> e <code>Boolean(x)</code> convertem explicitamente. Escrever a conversão à mão deixa a intenção clara e evita a coerção implícita do <code>==</code>.' }
      ] }
    ],
    tasks: [
      {
        id: 'js2-1-a', kind: 'guiado', title: 'Veja os tipos e a igualdade',
        body: [
          { p: 'Na aba <strong>JS</strong>, rode este programa e leia cada linha do console:' },
          { code: ["console.log(typeof 42, typeof 'oi', typeof null);", "console.log(1 === 1, 1 === '1', 1 == '1');", "console.log(Boolean(''), Boolean('0'), Boolean([]));"], lang: 'js', run: false },
          { p: 'Repare: <code>typeof null</code> mostra <code>object</code>; <code>1 === \'1\'</code> é <code>false</code> mas <code>1 == \'1\'</code> é <code>true</code>; e <code>\'0\'</code> e <code>[]</code> são ambos verdadeiros.' }
        ],
        hints: ['Escreva as três linhas no editor e clique em <em>rodar</em>. Compare o que você previu com o que apareceu.']
      },
      {
        id: 'js2-1-q', kind: 'quiz', title: 'O que é falsy?',
        body: [{ p: 'Qual destes valores é <strong>falsy</strong> (equivale a <code>false</code> dentro de um <code>if</code>)?' }],
        options: [
          { text: 'A string vazia <code>\'\'</code>.', correct: true },
          { text: 'A string <code>\'0\'</code>.', why: 'Qualquer string não vazia é truthy, mesmo <code>\'0\'</code> ou <code>\'false\'</code>.' },
          { text: 'O array vazio <code>[]</code>.', why: 'Objetos e arrays são sempre truthy, mesmo vazios; só primitivos entram na lista de falsy.' },
          { text: 'O objeto <code>{}</code>.', why: 'Um objeto, mesmo sem propriedades, é truthy.' }
        ],
        explain: 'São falsy apenas <code>false</code>, <code>0</code>, <code>\'\'</code>, <code>null</code>, <code>undefined</code> e <code>NaN</code>. Strings não vazias, arrays e objetos são todos truthy.',
        hints: ['A lista de falsy tem seis valores e nenhum deles é objeto ou array.']
      },
      {
        id: 'js2-1-b', kind: 'desafio', title: 'Uma função que classifica valores',
        body: [
          { p: 'No editor da aba <strong>JS</strong>, escreva uma função <code>tipoDe(valor)</code> que devolva o tipo do valor como texto, tratando <code>null</code> à parte (deve devolver <code>\'nulo\'</code>, não <code>\'object\'</code>). Use <code>typeof</code> e a igualdade estrita <code>===</code>. No fim, chame <code>console.log</code> mostrando o resultado para alguns valores diferentes.' }
        ],
        hints: [
          'Comece tratando o caso especial: <code>if (valor === null) return \'nulo\';</code>.',
          'Para o resto, <code>return typeof valor;</code> já basta.',
          'Salve como um arquivo seu (por exemplo <code>resposta.js</code>) e rode para conferir a saída.'
        ],
        solution: '<p>Uma função curta que trata <code>null</code> antes de recorrer a <code>typeof</code>, e um <code>console.log</code> exercitando vários tipos:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nconst tipoDe = (valor) =&gt; {\n  if (valor === null) return \'nulo\';\n  return typeof valor;\n};\nconsole.log(tipoDe(10), tipoDe(\'oi\'), tipoDe(null), tipoDe(true));\nEOF</pre>',
        check: desafioJS(['contrato.js'], [
          [/(function\b|=>)/, 'Defina uma função (com <code>function</code> ou <code>=&gt;</code>).'],
          [/typeof\s/, 'Use <code>typeof</code> para descobrir o tipo do valor.'],
          [/===/, 'Trate o <code>null</code> com igualdade estrita: <code>valor === null</code>.'],
          [/console\.log/, 'Mostre o resultado com <code>console.log(...)</code>.']
        ], 'Crie um arquivo na aba <strong>JS</strong> com a função <code>tipoDe</code> e clique em rodar.')
      }
    ]
  });

  /* ---------------------------- js01 — segunda aula ---------------------------- */
  LX.lesson('js01', {
    id: 'js1-2', n: '1.2', title: 'Guardar valores: let e const',
    goal: 'Declarar variáveis com const e let, entender a diferença e nomear bem.',
    setup: semear('nota.js', '// TODO: declare suas variáveis aqui.\n'),
    body: [
      { h2: 'Um nome para um valor' },
      { p: 'Uma <strong>variável</strong> é um nome que aponta para um valor. Você declara com <code>const</code> ou <code>let</code>. Use <code>const</code> por padrão: o nome não pode ser reatribuído depois. Use <code>let</code> só quando o valor realmente muda ao longo do tempo.' },
      { code: ["const nome = 'Ana';   // não será reatribuído", 'let contador = 0;      // vai mudar', 'contador = contador + 1;'], lang: 'js', run: false },
      { box: 'note', label: 'const não é imutável', body: [
        { p: '<code>const</code> impede trocar o valor a que o nome aponta. Se o valor for um objeto, o <em>conteúdo</em> dele ainda pode mudar — o que trava é o nome, não o objeto.' }
      ] },
      { p: 'Evite <code>var</code>: ele tem regras de escopo antigas e confusas. Em código novo, <code>const</code> e <code>let</code> resolvem tudo.' }
    ],
    tasks: [
      {
        id: 'js1-2-a', kind: 'guiado', title: 'Declare e reatribua',
        body: [
          { p: 'Rode este programa e observe: o <code>let</code> pode receber um novo valor; se você tentar reatribuir um <code>const</code>, o console mostra um erro.' },
          { code: ["const pais = 'Brasil';", 'let idade = 20;', 'idade = 21;', 'console.log(pais, idade);'], lang: 'js', run: false }
        ],
        hints: ['Depois, adicione uma linha <code>pais = \'outro\';</code> e rode para ver o erro de reatribuição de <code>const</code>. Remova antes de seguir.']
      },
      {
        id: 'js1-2-q', kind: 'quiz', title: 'const ou let?',
        body: [{ p: 'Você tem um valor que <strong>nunca</strong> será trocado depois de definido. O que usar?' }],
        options: [
          { text: '<code>const</code> — deixa claro que o nome não muda.', correct: true },
          { text: '<code>let</code> — porque const é só para números.', why: '<code>const</code> serve para qualquer valor; o tipo não importa.' },
          { text: '<code>var</code> — é o mais moderno.', why: '<code>var</code> é justamente o mais antigo; prefira <code>const</code> ou <code>let</code>.' }
        ],
        explain: 'Use <code>const</code> sempre que o nome não for reatribuído — a maior parte dos casos. <code>let</code> fica para o que muda.',
        hints: ['Se o valor não vai ser reatribuído, o padrão é o que impede reatribuição.']
      },
      {
        id: 'js1-2-b', kind: 'desafio', title: 'Suas próprias variáveis',
        body: [
          { p: 'Escreva um programa que declare uma variável com <code>const</code> e outra com <code>let</code>, reatribua a de <code>let</code> pelo menos uma vez e mostre as duas com <code>console.log</code>.' }
        ],
        hints: [
          'Uma linha <code>const</code>, uma linha <code>let</code>, uma linha que muda o <code>let</code>.',
          'Termine com <code>console.log(...)</code> mostrando os dois valores.'
        ],
        solution: '<p>Um valor fixo em <code>const</code>, um valor que muda em <code>let</code>:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nconst nome = \'Ana\';\nlet idade = 30;\nidade = idade + 1;\nconsole.log(nome, idade);\nEOF</pre>',
        check: desafioJS(['nota.js'], [
          [/const\s+\w+/, 'Declare pelo menos uma variável com <code>const</code>.'],
          [/let\s+\w+/, 'Declare pelo menos uma variável com <code>let</code>.'],
          [/console\.log/, 'Mostre os valores com <code>console.log(...)</code>.']
        ], 'Crie um arquivo na aba <strong>JS</strong> com um <code>const</code> e um <code>let</code>.')
      }
    ]
  });

  /* ---------------------------- js03 — funções e closures ---------------------------- */
  LX.lesson('js03', {
    id: 'js3-1', n: '3.1', title: 'Funções que lembram: closures',
    goal: 'Criar uma função que devolve outra função e guarda estado privado por closure.',
    setup: semear('escopo.js', '// TODO: crie uma fábrica de funções.\n'),
    body: [
      { h2: 'Funções são valores' },
      { p: 'Em JavaScript, uma função é um <strong>valor</strong>: pode ser guardada em variável, passada como argumento e <strong>devolvida</strong> por outra função. Quando uma função interna usa uma variável declarada na função externa, ela <strong>lembra</strong> dessa variável mesmo depois de a externa terminar. A isso se chama <strong>closure</strong>.' },
      { code: ['function criarContador() {', '  let n = 0;', '  return function () {', '    n = n + 1;', '    return n;', '  };', '}', 'const proximo = criarContador();', 'console.log(proximo(), proximo()); // 1 2'], lang: 'js', run: false },
      { box: 'key', label: 'Estado privado', body: [
        { p: 'O <code>n</code> vive dentro de <code>criarContador</code>. Ninguém de fora consegue lê-lo ou alterá-lo diretamente — só a função devolvida. É assim que se cria estado privado sem classes.' }
      ] }
    ],
    tasks: [
      {
        id: 'js3-1-a', kind: 'guiado', title: 'Rode um contador',
        body: [
          { p: 'Cole a fábrica <code>criarContador</code> acima no editor, crie um contador e chame-o algumas vezes. Veja que cada chamada devolve o próximo número — o estado sobrevive entre chamadas.' },
          { code: ['const c = criarContador();', 'console.log(c(), c(), c()); // 1 2 3'], lang: 'js', run: false }
        ],
        hints: ['Cole a definição de <code>criarContador</code> e as duas linhas acima; clique em rodar.']
      },
      {
        id: 'js3-1-q', kind: 'quiz', title: 'De onde vem o estado?',
        body: [{ p: 'Dois contadores criados pela mesma fábrica: <code>const a = criarContador(); const b = criarContador();</code>. O que acontece?' }],
        options: [
          { text: 'Cada um tem o seu próprio <code>n</code> independente.', correct: true },
          { text: 'Os dois compartilham o mesmo <code>n</code>.', why: 'Cada chamada de <code>criarContador</code> cria um novo escopo, com um <code>n</code> próprio.' },
          { text: 'O segundo apaga o primeiro.', why: 'São closures independentes; um não interfere no outro.' }
        ],
        explain: 'Cada chamada da fábrica cria um novo escopo e, portanto, um <code>n</code> separado. As closures não se misturam.',
        hints: ['Pense quantas vezes a função externa rodou.']
      },
      {
        id: 'js3-1-b', kind: 'desafio', title: 'Sua própria fábrica',
        body: [
          { p: 'Escreva uma função que <strong>devolva outra função</strong>, guardando um valor privado por closure (um contador, um acumulador — o que preferir). Chame a função devolvida e mostre o resultado com <code>console.log</code>.' }
        ],
        hints: [
          'A função externa declara uma variável e retorna uma função interna que a usa.',
          'Exemplo do formato: <code>function fabrica() { let x = 0; return function () { ... }; }</code>.'
        ],
        solution: '<p>Uma fábrica que devolve uma função com estado privado:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nfunction criarContador() {\n  let n = 0;\n  return function () {\n    n = n + 1;\n    return n;\n  };\n}\nconst proximo = criarContador();\nconsole.log(proximo(), proximo(), proximo());\nEOF</pre>',
        check: desafioJS(['escopo.js'], [
          [/function[\s\S]*function|function[\s\S]*=>|=>[\s\S]*function|=>[\s\S]*=>/, 'Uma função deve conter (e devolver) outra função.'],
          [/return\s+(function|\(|[A-Za-z_$])/, 'Devolva a função interna com <code>return</code>.'],
          [/console\.log/, 'Mostre o resultado com <code>console.log(...)</code>.']
        ], 'Crie um arquivo com uma função que devolve outra função.')
      }
    ]
  });

  /* ---------------------------- js04 — objetos e classes ---------------------------- */
  LX.lesson('js04', {
    id: 'js4-1', n: '4.1', title: 'Objetos, this e classes',
    goal: 'Modelar dados com objetos e uma classe que guarda estado em this.',
    setup: semear('modelo.js', '// TODO: defina uma classe.\n'),
    body: [
      { h2: 'Objetos: dados com nome' },
      { p: 'Um <strong>objeto</strong> agrupa valores sob chaves. Suas funções internas (métodos) acessam o próprio objeto por <code>this</code>.' },
      { code: ["const conta = {", "  saldo: 100,", "  depositar(v) { this.saldo = this.saldo + v; }", "};", "conta.depositar(50);", "console.log(conta.saldo); // 150"], lang: 'js', run: false },
      { h4: 'Classes: um molde para muitos objetos' },
      { p: 'Uma <strong>classe</strong> descreve como criar objetos parecidos. O <code>constructor</code> prepara o estado inicial em <code>this</code>; os métodos operam sobre ele. Cada <code>new</code> cria uma instância independente.' },
      { code: ['class Conta {', '  constructor(inicial) {', '    this.saldo = inicial;', '  }', '  depositar(valor) {', '    this.saldo = this.saldo + valor;', '    return this.saldo;', '  }', '}', 'const c = new Conta(100);', 'console.log(c.depositar(50)); // 150'], lang: 'js', run: false }
    ],
    tasks: [
      {
        id: 'js4-1-a', kind: 'guiado', title: 'Crie uma instância',
        body: [
          { p: 'Cole a classe <code>Conta</code> acima, crie uma conta com <code>new</code> e faça dois depósitos. Veja o saldo acumular — cada instância guarda o seu próprio <code>this.saldo</code>.' }
        ],
        hints: ['<code>const c = new Conta(0); c.depositar(10); c.depositar(5); console.log(c.saldo);</code>']
      },
      {
        id: 'js4-1-q', kind: 'quiz', title: 'O que é this?',
        body: [{ p: 'Dentro de um método de <code>Conta</code>, a que se refere <code>this</code>?' }],
        options: [
          { text: 'À instância sobre a qual o método foi chamado.', correct: true },
          { text: 'À classe <code>Conta</code> em si.', why: 'A classe é o molde; <code>this</code> é o objeto concreto criado com <code>new</code>.' },
          { text: 'A um objeto global compartilhado.', why: 'Cada instância tem o seu <code>this</code>; não há estado global implícito aqui.' }
        ],
        explain: '<code>this</code> aponta para a instância em que o método roda — o objeto criado por <code>new</code>. Por isso duas contas têm saldos independentes.',
        hints: ['Pense em duas contas diferentes chamando o mesmo método.']
      },
      {
        id: 'js4-1-b', kind: 'desafio', title: 'Sua própria classe',
        body: [
          { p: 'Escreva uma classe com um <code>constructor</code> que guarde algum estado em <code>this</code> e pelo menos um método que use esse estado. Crie uma instância com <code>new</code> e mostre um resultado com <code>console.log</code>.' }
        ],
        hints: [
          'Comece com <code>class Nome { constructor(x) { this.x = x; } }</code>.',
          'Adicione um método que leia ou altere <code>this.x</code>.'
        ],
        solution: '<p>Uma classe com estado em <code>this</code> e um método que o usa:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nclass Conta {\n  constructor(inicial) {\n    this.saldo = inicial;\n  }\n  depositar(valor) {\n    this.saldo = this.saldo + valor;\n    return this.saldo;\n  }\n}\nconst c = new Conta(100);\nc.depositar(50);\nconsole.log(\'saldo\', c.saldo);\nEOF</pre>',
        check: desafioJS(['modelo.js'], [
          [/class\s+\w+/, 'Defina uma classe com <code>class</code>.'],
          [/this\./, 'Guarde e use o estado em <code>this</code>.'],
          [/console\.log/, 'Mostre um resultado com <code>console.log(...)</code>.']
        ], 'Crie um arquivo com uma <code>class</code> e um método.')
      }
    ]
  });

  /* ---------------------------- js05 — coleções e transformação ---------------------------- */
  LX.lesson('js05', {
    id: 'js5-1', n: '5.1', title: 'Transformar arrays: map, filter, reduce',
    goal: 'Encadear map, filter e reduce para transformar uma lista sem laços manuais.',
    setup: semear('lista.js', '// TODO: transforme a lista.\n'),
    body: [
      { h2: 'Três verbos que resolvem quase tudo' },
      { p: '<code>filter</code> escolhe elementos por uma condição; <code>map</code> transforma cada elemento; <code>reduce</code> combina tudo em um único valor. Os três recebem uma função e não alteram o array original.' },
      { code: ['const nums = [1, 2, 3, 4, 5, 6];', 'const pares = nums.filter(function (n) { return n % 2 === 0; });', 'const dobros = pares.map(function (n) { return n * 2; });', 'const soma = dobros.reduce(function (acc, n) { return acc + n; }, 0);', 'console.log(pares, dobros, soma);'], lang: 'js', run: false },
      { box: 'tip', label: 'Encadear', body: [
        { p: 'Como cada método devolve um novo array, você pode encadear: <code>nums.filter(...).map(...).reduce(...)</code>. Lê-se de cima para baixo, como uma linha de montagem.' }
      ] }
    ],
    tasks: [
      {
        id: 'js5-1-a', kind: 'guiado', title: 'Rode a linha de montagem',
        body: [
          { p: 'Rode o exemplo acima e confira: <code>pares</code> tem só os pares, <code>dobros</code> os dobra e <code>soma</code> junta tudo em um número. O array <code>nums</code> continua intacto.' }
        ],
        hints: ['Cole as cinco linhas e clique em rodar. Some os pares na cabeça e compare.']
      },
      {
        id: 'js5-1-q', kind: 'quiz', title: 'O que reduce devolve?',
        body: [{ p: '<code>[1, 2, 3].reduce(function (acc, n) { return acc + n; }, 0)</code> resulta em?' }],
        options: [
          { text: 'O número <code>6</code> — a soma acumulada.', correct: true },
          { text: 'O array <code>[1, 2, 3]</code> sem mudança.', why: '<code>reduce</code> combina os elementos em um só valor; não devolve o array.' },
          { text: 'Um novo array <code>[1, 3, 6]</code>.', why: 'Isso seria um <em>scan</em>; <code>reduce</code> devolve apenas o valor final.' }
        ],
        explain: '<code>reduce</code> parte do valor inicial (<code>0</code>) e acumula: 0+1, +2, +3 = <code>6</code>. Devolve um único valor.',
        hints: ['O segundo argumento é o valor inicial do acumulador.']
      },
      {
        id: 'js5-1-b', kind: 'desafio', title: 'Some os quadrados dos pares',
        body: [
          { p: 'Partindo de uma lista de números, use <code>filter</code> para ficar só com os pares, <code>map</code> para elevá-los ao quadrado e <code>reduce</code> para somar. Mostre o total com <code>console.log</code>.' }
        ],
        hints: [
          'Par é <code>n % 2 === 0</code>; quadrado é <code>n * n</code>.',
          'O <code>reduce</code> começa em <code>0</code> e soma o acumulador com cada número.'
        ],
        solution: '<p>Os três verbos encadeados, do filtro à soma:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nconst nums = [1, 2, 3, 4, 5, 6];\nconst pares = nums.filter(function (n) { return n % 2 === 0; });\nconst quadrados = pares.map(function (n) { return n * n; });\nconst soma = quadrados.reduce(function (acc, n) { return acc + n; }, 0);\nconsole.log(\'soma dos quadrados dos pares\', soma);\nEOF</pre>',
        check: desafioJS(['lista.js'], [
          [/\.filter\(/, 'Use <code>filter</code> para escolher os pares.'],
          [/\.map\(/, 'Use <code>map</code> para elevar ao quadrado.'],
          [/\.reduce\(/, 'Use <code>reduce</code> para somar tudo.'],
          [/console\.log/, 'Mostre o total com <code>console.log(...)</code>.']
        ], 'Crie um arquivo que encadeia <code>filter</code>, <code>map</code> e <code>reduce</code>.')
      }
    ]
  });

  /* ---------------------------- js06 — módulos ESM ---------------------------- */
  LX.lesson('js06', {
    id: 'js6-1', n: '6.1', title: 'Módulos: export e import',
    goal: 'Separar código em dois arquivos e ligá-los com export e import.',
    setup: semear(null),
    body: [
      { h2: 'Um arquivo, uma responsabilidade' },
      { p: 'Um <strong>módulo</strong> é um arquivo que expõe parte do seu código com <code>export</code>; outro arquivo usa esse código com <code>import</code>. O que não é exportado fica privado ao arquivo. No laboratório, cada arquivo <code>.js</code> da aba JS é um módulo.' },
      { code: ['// matematica.js', 'export function somar(a, b) {', '  return a + b;', '}'], lang: 'js', run: false },
      { code: ["// principal.js", "import { somar } from './matematica.js';", "console.log(somar(2, 3)); // 5"], lang: 'js', run: false },
      { box: 'note', label: 'Caminho relativo', body: [
        { p: 'O <code>./</code> em <code>\'./matematica.js\'</code> significa "no mesmo diretório". É assim que um módulo encontra o outro dentro do projeto.' }
      ] }
    ],
    tasks: [
      {
        id: 'js6-1-a', kind: 'guiado', title: 'Crie dois arquivos e ligue-os',
        body: [
          { p: 'Use a faixa de arquivos da aba <strong>JS</strong> (o botão <code>+</code>) para criar <code>matematica.js</code> com um <code>export</code>. Depois, no arquivo principal, <code>import</code>e a função e rode. O resultado do módulo aparece no console.' }
        ],
        hints: ['Crie <code>matematica.js</code> com <code>export function somar...</code>; no principal, <code>import { somar } from \'./matematica.js\';</code> e rode.']
      },
      {
        id: 'js6-1-q', kind: 'quiz', title: 'O que fica visível?',
        body: [{ p: 'Em <code>matematica.js</code> você tem <code>function ajudante() {}</code> (sem export) e <code>export function somar() {}</code>. O que outro arquivo consegue importar?' }],
        options: [
          { text: 'Apenas <code>somar</code> — só o que foi exportado.', correct: true },
          { text: 'As duas, pois estão no mesmo arquivo.', why: 'Só cruza a fronteira do módulo o que tem <code>export</code>; o resto é privado.' },
          { text: 'Nenhuma, sem uma configuração extra.', why: 'Não precisa de configuração: <code>export</code>/<code>import</code> bastam.' }
        ],
        explain: 'Um módulo expõe só o que marca com <code>export</code>. Funções sem <code>export</code> ficam privadas ao arquivo.',
        hints: ['Procure a palavra <code>export</code>.']
      },
      {
        id: 'js6-1-b', kind: 'desafio', title: 'Um módulo e quem o usa',
        body: [
          { p: 'Crie <strong>dois arquivos</strong> na aba JS: um módulo que <code>export</code>a ao menos uma função, e outro que a <code>import</code>a por caminho relativo (<code>./</code>) e a usa com <code>console.log</code>. Rode o arquivo que importa.' }
        ],
        hints: [
          'No módulo: <code>export function somar(a, b) { return a + b; }</code>.',
          'No principal: <code>import { somar } from \'./matematica.js\';</code> e depois <code>console.log(somar(2, 3));</code>.'
        ],
        solution: '<p>Um módulo com <code>export</code> e um principal que o importa:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/matematica.js\nexport function somar(a, b) {\n  return a + b;\n}\nexport function dobro(n) {\n  return n * 2;\n}\nEOF\ncat &lt;&lt;\'EOF\' &gt; /home/aluno/js/principal.js\nimport { somar, dobro } from \'./matematica.js\';\nconsole.log(somar(2, 3), dobro(21));\nEOF</pre>',
        check: async (ctx) => {
          const H = LX.H;
          const arqs = () => (H.ls(ctx, DIR) || []).filter(n => typeof n === 'string' && /\.(mjs|js)$/i.test(n) && n !== 'ola.js');
          const conts = () => arqs().map(n => H.read(ctx, DIR + '/' + n) || '');
          return H.checkAll([
            [() => arqs().length >= 2, 'Crie dois arquivos: um módulo e outro que o importa.'],
            [() => conts().some(c => /export\s+(function|const|let|var|default|class|\{)/.test(c)), 'Um arquivo deve <code>export</code>ar algo.'],
            [() => conts().some(c => /import\s[\s\S]*from\s+['"]\.\//.test(c)), 'O outro deve <code>import</code>ar do módulo com caminho relativo (<code>./</code>).'],
            [() => conts().some(c => /console\.log/.test(c)), 'Mostre o resultado com <code>console.log(...)</code>.']
          ]);
        }
      }
    ]
  });

  /* ---------------------------- js07 — assíncrono ---------------------------- */
  LX.lesson('js07', {
    id: 'js7-1', n: '7.1', title: 'Promises e async/await',
    goal: 'Escrever uma função assíncrona que espera uma Promise antes de continuar.',
    setup: semear('async.js', '// TODO: escreva uma função assíncrona.\n'),
    body: [
      { h2: 'Código que espera sem travar' },
      { p: 'Uma <strong>Promise</strong> representa um valor que ainda vai chegar. Uma função <code>async</code> pode <code>await</code> uma Promise: o código pausa naquela linha, deixa o resto do programa rodar, e retoma quando o valor chega. Nada trava enquanto se espera.' },
      { code: ['function esperar(ms) {', '  return new Promise(function (resolve) {', '    setTimeout(resolve, ms);', '  });', '}', 'async function principal() {', "  console.log('antes');", '  await esperar(10);', "  console.log('depois');", '}', 'principal();'], lang: 'js', run: false },
      { box: 'key', label: 'A ordem real', body: [
        { p: 'O <code>await</code> não bloqueia o programa inteiro — só a função <code>async</code> em que está. Timers e outras Promises seguem correndo. Prever essa ordem é metade do trabalho com assíncrono.' }
      ] }
    ],
    tasks: [
      {
        id: 'js7-1-a', kind: 'guiado', title: 'Veja antes e depois',
        body: [
          { p: 'Rode o exemplo acima. O console mostra <code>antes</code>, espera ~10ms e então <code>depois</code>. A execução só é considerada concluída quando a Promise resolve.' }
        ],
        hints: ['Cole as linhas do exemplo e clique em rodar. Observe a pausa entre as duas mensagens.']
      },
      {
        id: 'js7-1-q', kind: 'quiz', title: 'O que await faz?',
        body: [{ p: 'Dentro de uma função <code>async</code>, o que <code>await umaPromise</code> faz?' }],
        options: [
          { text: 'Pausa essa função até a Promise resolver, sem travar o resto do programa.', correct: true },
          { text: 'Trava o programa inteiro até a Promise resolver.', why: 'Só a função <code>async</code> pausa; o restante do event loop continua.' },
          { text: 'Cancela a Promise imediatamente.', why: '<code>await</code> espera o resultado; não cancela nada.' }
        ],
        explain: '<code>await</code> suspende apenas a função <code>async</code> atual até a Promise resolver, entregando o valor. O resto do programa continua rodando.',
        hints: ['Pense em "esperar aqui" versus "congelar tudo".']
      },
      {
        id: 'js7-1-b', kind: 'desafio', title: 'Sua função assíncrona',
        body: [
          { p: 'Escreva uma função <code>async</code> que use <code>await</code> para esperar uma Promise (por exemplo, um pequeno atraso com <code>setTimeout</code>) e mostre uma mensagem antes e depois da espera com <code>console.log</code>. Chame a função no fim.' }
        ],
        hints: [
          'Crie um ajudante que devolve <code>new Promise(function (resolve) { setTimeout(resolve, 10); })</code>.',
          'Na função <code>async</code>: log, <code>await ajudante()</code>, log de novo.'
        ],
        solution: '<p>Um atraso como Promise, aguardado por uma função <code>async</code>:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nfunction esperar(ms) {\n  return new Promise(function (resolve) {\n    setTimeout(resolve, ms);\n  });\n}\nasync function principal() {\n  console.log(\'antes\');\n  await esperar(10);\n  console.log(\'depois\');\n}\nprincipal();\nEOF</pre>',
        check: desafioJS(['async.js'], [
          [/async\s/, 'Declare a função com <code>async</code>.'],
          [/await\s/, 'Espere a Promise com <code>await</code>.'],
          [/console\.log/, 'Mostre mensagens antes e depois com <code>console.log(...)</code>.']
        ], 'Crie um arquivo com uma função <code>async</code> que usa <code>await</code>.')
      }
    ]
  });

  /* ---------------------------- js08 — dados no browser (JSON) ---------------------------- */
  LX.lesson('js08', {
    id: 'js8-1', n: '8.1', title: 'Dados na web: JSON',
    goal: 'Converter texto JSON em objeto, transformá-lo e serializar de volta.',
    setup: semear('web.js', '// TODO: trabalhe com JSON.\n'),
    body: [
      { h2: 'O formato da web' },
      { p: 'Quase toda troca de dados no browser (um <code>fetch</code>, um <code>localStorage</code>) passa por <strong>JSON</strong> — texto com a mesma cara de um objeto JavaScript. <code>JSON.parse</code> transforma texto em objeto; <code>JSON.stringify</code> faz o caminho de volta.' },
      { code: ["const texto = '{\"nome\":\"Ana\",\"idade\":30}';", 'const pessoa = JSON.parse(texto);', 'console.log(pessoa.nome);        // Ana', 'pessoa.idade = pessoa.idade + 1;', 'console.log(JSON.stringify(pessoa));'], lang: 'js', run: false },
      { box: 'warn', label: 'JSON não é JavaScript', body: [
        { p: 'No JSON, as chaves vão entre aspas duplas e não há funções nem comentários. É só <em>dados</em>. Por isso <code>JSON.parse</code> é seguro para texto vindo de fora — ele não executa código.' }
      ] }
    ],
    tasks: [
      {
        id: 'js8-1-a', kind: 'guiado', title: 'Ida e volta',
        body: [
          { p: 'Rode o exemplo acima: o texto vira objeto, você lê e altera um campo, e <code>JSON.stringify</code> devolve o texto atualizado. Repare nas aspas duplas do JSON.' }
        ],
        hints: ['Cole o exemplo e rode. Compare o texto inicial com o que <code>JSON.stringify</code> imprime.']
      },
      {
        id: 'js8-1-q', kind: 'quiz', title: 'Parse ou stringify?',
        body: [{ p: 'Você recebeu uma <strong>string</strong> de um servidor e quer acessar seus campos como objeto. O que usar?' }],
        options: [
          { text: '<code>JSON.parse</code> — texto para objeto.', correct: true },
          { text: '<code>JSON.stringify</code> — texto para objeto.', why: '<code>stringify</code> faz o contrário: objeto para texto.' },
          { text: 'Nenhum; a string já é um objeto.', why: 'Uma string é texto; para acessar campos você precisa convertê-la com <code>JSON.parse</code>.' }
        ],
        explain: '<code>JSON.parse</code> converte texto em objeto (para ler campos); <code>JSON.stringify</code> converte objeto em texto (para enviar ou salvar).',
        hints: ['De qual lado está o texto e de qual está o objeto?']
      },
      {
        id: 'js8-1-b', kind: 'desafio', title: 'Transforme um JSON',
        body: [
          { p: 'Parta de uma string JSON, converta com <code>JSON.parse</code>, altere ou acrescente um campo do objeto e mostre o resultado de volta como texto com <code>JSON.stringify</code>.' }
        ],
        hints: [
          'A string precisa de aspas duplas nas chaves: <code>\'{"nome":"Ana"}\'</code>.',
          'Depois de alterar o objeto, imprima <code>JSON.stringify(obj)</code>.'
        ],
        solution: '<p>Texto para objeto, uma alteração, e de volta para texto:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nconst texto = \'{"nome":"Ana","idade":30}\';\nconst pessoa = JSON.parse(texto);\npessoa.idade = pessoa.idade + 1;\nconsole.log(JSON.stringify(pessoa));\nEOF</pre>',
        check: desafioJS(['web.js'], [
          [/JSON\.parse/, 'Converta o texto em objeto com <code>JSON.parse</code>.'],
          [/JSON\.stringify/, 'Serialize de volta com <code>JSON.stringify</code>.'],
          [/console\.log/, 'Mostre o resultado com <code>console.log(...)</code>.']
        ], 'Crie um arquivo que usa <code>JSON.parse</code> e <code>JSON.stringify</code>.')
      }
    ]
  });

  /* ---------------------------- js09 — Node e arquivos ---------------------------- */
  LX.lesson('js09', {
    id: 'js9-1', n: '9.1', title: 'Node: ler e escrever arquivos',
    goal: 'Usar o módulo fs (assíncrono) para gravar e ler um arquivo no laboratório.',
    setup: semear('node.js', '// TODO: use o módulo fs.\n'),
    body: [
      { h2: 'JavaScript fora do browser' },
      { p: 'No <strong>Node</strong>, o mesmo JavaScript ganha acesso ao sistema: arquivos, processos, rede. Você pede um módulo embutido com <code>require</code>. O <code>fs</code> (filesystem) lê e escreve arquivos; sua versão em <code>fs.promises</code> é assíncrona, então combina com <code>await</code>.' },
      { code: ["const fs = require('fs');", 'async function principal() {', "  await fs.promises.writeFile('dados.txt', 'ola\\nmundo\\n');", "  const conteudo = await fs.promises.readFile('dados.txt');", "  console.log('lido:', conteudo);", '}', 'principal();'], lang: 'js', run: false },
      { box: 'note', label: 'Área restrita', body: [
        { p: 'No laboratório, o <code>fs</code> enxerga apenas a sua pasta de projeto (<code>/home/aluno/js</code>). Tentar sair dela (<code>../</code>) é barrado — é a mesma ideia de permissões do Linux, aplicada ao seu código.' }
      ] }
    ],
    tasks: [
      {
        id: 'js9-1-a', kind: 'guiado', title: 'Grave e leia',
        body: [
          { p: 'Rode o exemplo. Ele grava <code>dados.txt</code>, lê de volta e mostra o conteúdo. Depois, abra a aba <strong>Arquivos</strong> e confirme que <code>dados.txt</code> apareceu na sua pasta de projeto.' }
        ],
        hints: ['Cole o exemplo e rode. O arquivo é criado dentro de <code>/home/aluno/js</code>.']
      },
      {
        id: 'js9-1-q', kind: 'quiz', title: 'Por que await?',
        body: [{ p: 'Por que usamos <code>await</code> com <code>fs.promises.readFile</code>?' }],
        options: [
          { text: 'Porque a leitura é assíncrona: o resultado chega depois, via Promise.', correct: true },
          { text: 'Porque <code>await</code> torna a leitura mais rápida.', why: '<code>await</code> não acelera nada; apenas espera o resultado que chega de forma assíncrona.' },
          { text: 'Porque sem <code>await</code> o arquivo é apagado.', why: '<code>await</code> não tem relação com apagar arquivos; ele só aguarda a Promise.' }
        ],
        explain: 'Operações de arquivo em <code>fs.promises</code> devolvem Promises. <code>await</code> espera o valor sem travar o resto do programa.',
        hints: ['Pense no que <code>fs.promises.readFile</code> devolve.']
      },
      {
        id: 'js9-1-b', kind: 'desafio', title: 'Escreva e leia de volta',
        body: [
          { p: 'Usando <code>require(\'fs\')</code>, escreva um arquivo com <code>fs.promises.writeFile</code> e leia-o de volta com <code>fs.promises.readFile</code>, tudo dentro de uma função <code>async</code>. Mostre algo do conteúdo lido com <code>console.log</code>.' }
        ],
        hints: [
          'Importe com <code>const fs = require(\'fs\');</code>.',
          'Use <code>await fs.promises.writeFile(...)</code> e depois <code>await fs.promises.readFile(...)</code>.'
        ],
        solution: '<p>Gravar e ler de volta pela API assíncrona do <code>fs</code>:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nconst fs = require(\'fs\');\nasync function principal() {\n  await fs.promises.writeFile(\'dados.txt\', \'linha 1\\nlinha 2\\n\');\n  const conteudo = await fs.promises.readFile(\'dados.txt\');\n  console.log(\'bytes:\', conteudo.length);\n}\nprincipal();\nEOF</pre>',
        check: desafioJS(['node.js'], [
          [/require\(\s*['"](fs|node:fs)['"]\s*\)/, 'Importe o <code>fs</code> com <code>require(\'fs\')</code>.'],
          [/writeFile/, 'Grave um arquivo com <code>fs.promises.writeFile</code>.'],
          [/readFile/, 'Leia de volta com <code>fs.promises.readFile</code>.'],
          [/await\s|\.then\(/, 'O <code>fs</code> é assíncrono: use <code>await</code>.'],
          [/console\.log/, 'Mostre algo do conteúdo com <code>console.log(...)</code>.']
        ], 'Crie um arquivo que usa <code>require(\'fs\')</code> para gravar e ler.')
      }
    ]
  });

  /* ---------------------------- js10 — backend e persistência ---------------------------- */
  LX.lesson('js10', {
    id: 'js10-1', n: '10.1', title: 'Um repositório de dados',
    goal: 'Modelar persistência com um repositório que guarda e busca registros por id.',
    setup: semear('backend.js', '// TODO: modele um repositório.\n'),
    body: [
      { h2: 'Guardar e recuperar' },
      { p: 'Um <strong>backend</strong> quase sempre precisa guardar dados e buscá-los depois por uma chave. O padrão <strong>repositório</strong> esconde <em>como</em> os dados são guardados atrás de métodos claros — <code>salvar</code>, <code>buscar</code> — para que o resto do sistema não dependa do armazenamento.' },
      { code: ['class Repositorio {', '  constructor() {', '    this.itens = new Map();', '  }', '  salvar(id, valor) {', '    this.itens.set(id, valor);', '  }', '  buscar(id) {', '    return this.itens.get(id);', '  }', '}'], lang: 'js', run: false },
      { box: 'key', label: 'Map: chave para valor', body: [
        { p: 'Um <code>Map</code> associa chaves a valores e busca em tempo constante. Aqui ele simula o banco; trocá-lo por um banco real depois não muda quem usa <code>salvar</code>/<code>buscar</code>.' }
      ] }
    ],
    tasks: [
      {
        id: 'js10-1-a', kind: 'guiado', title: 'Salve e busque',
        body: [
          { p: 'Cole a classe <code>Repositorio</code>, crie uma instância, salve um registro com um id e busque-o de volta. O valor recuperado deve ser o mesmo que você guardou.' },
          { code: ['const repo = new Repositorio();', "repo.salvar(1, { nome: 'Ana' });", 'console.log(repo.buscar(1));'], lang: 'js', run: false }
        ],
        hints: ['Cole a classe e as três linhas acima; clique em rodar.']
      },
      {
        id: 'js10-1-q', kind: 'quiz', title: 'Por que esconder o Map?',
        body: [{ p: 'Qual a vantagem de acessar os dados só por <code>salvar</code>/<code>buscar</code>, e não pelo <code>Map</code> diretamente?' }],
        options: [
          { text: 'Dá para trocar o armazenamento depois sem mudar quem usa o repositório.', correct: true },
          { text: 'Torna o programa mais rápido em qualquer caso.', why: 'A vantagem é de desenho (desacoplamento), não necessariamente de velocidade.' },
          { text: 'Impede totalmente qualquer erro de dados.', why: 'Nenhum padrão elimina erros; ele apenas organiza o acesso e reduz o acoplamento.' }
        ],
        explain: 'Esconder o armazenamento atrás de métodos deixa o resto do sistema independente dele. Trocar <code>Map</code> por um banco real depois não afeta quem chama <code>salvar</code>/<code>buscar</code>.',
        hints: ['Pense no dia em que o <code>Map</code> vira um banco de verdade.']
      },
      {
        id: 'js10-1-b', kind: 'desafio', title: 'Seu repositório',
        body: [
          { p: 'Escreva uma classe repositório com um <code>Map</code> (ou array) interno e métodos para guardar e recuperar registros por chave. Crie uma instância, guarde algo, recupere-o e mostre com <code>console.log</code>.' }
        ],
        hints: [
          'No <code>constructor</code>: <code>this.itens = new Map();</code>.',
          'Métodos: <code>salvar(id, v) { this.itens.set(id, v); }</code> e <code>buscar(id) { return this.itens.get(id); }</code>.'
        ],
        solution: '<p>Um repositório em memória com <code>salvar</code> e <code>buscar</code>:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nclass Repositorio {\n  constructor() {\n    this.itens = new Map();\n  }\n  salvar(id, valor) {\n    this.itens.set(id, valor);\n  }\n  buscar(id) {\n    return this.itens.get(id);\n  }\n}\nconst repo = new Repositorio();\nrepo.salvar(1, { nome: \'Ana\' });\nconsole.log(repo.buscar(1));\nEOF</pre>',
        check: desafioJS(['backend.js'], [
          [/class\s+\w+/, 'Defina o repositório como uma <code>class</code>.'],
          [/new Map\(|\.set\(|\.push\(/, 'Guarde os registros em uma coleção (<code>Map</code> ou array).'],
          [/console\.log/, 'Recupere um registro e mostre-o com <code>console.log(...)</code>.']
        ], 'Crie um arquivo com uma classe repositório.')
      }
    ]
  });

  /* ---------------------------- js11 — testes ---------------------------- */
  LX.lesson('js11', {
    id: 'js11-1', n: '11.1', title: 'Escrever testes',
    goal: 'Verificar o comportamento de uma função com describe, it e expect.',
    setup: semear('teste.js', '// TODO: escreva testes.\n'),
    body: [
      { h2: 'Provar que o código faz o que promete' },
      { p: 'Um <strong>teste</strong> executa seu código com entradas conhecidas e confere a saída. O laboratório traz um mini-runner: <code>describe</code> agrupa, <code>it</code> descreve um caso e <code>expect(x).toBe(y)</code> verifica. Um teste que falha aparece marcado no console, com o valor esperado e o obtido.' },
      { code: ['function soma(a, b) {', '  return a + b;', '}', "describe('soma', function () {", "  it('soma dois números', function () {", '    expect(soma(2, 3)).toBe(5);', '  });', '});'], lang: 'js', run: false },
      { box: 'tip', label: 'Um caso, uma afirmação', body: [
        { p: 'Bons testes são pequenos: cada <code>it</code> verifica uma coisa. Quando quebra, você sabe exatamente o quê. Comece pelo caso normal e depois cubra as bordas (zero, vazio, negativo).' }
      ] }
    ],
    tasks: [
      {
        id: 'js11-1-a', kind: 'guiado', title: 'Rode um teste',
        body: [
          { p: 'Cole o exemplo e rode. O console mostra o teste passando. Agora troque <code>toBe(5)</code> por <code>toBe(6)</code> e rode de novo: veja como um teste que falha é reportado. Volte para <code>5</code>.' }
        ],
        hints: ['O runner de testes já vem embutido: basta usar <code>describe</code>, <code>it</code> e <code>expect</code> e clicar em rodar.']
      },
      {
        id: 'js11-1-q', kind: 'quiz', title: 'O que expect verifica?',
        body: [{ p: 'Em <code>expect(soma(2, 3)).toBe(5)</code>, o que está sendo afirmado?' }],
        options: [
          { text: 'Que o resultado de <code>soma(2, 3)</code> é igual a <code>5</code>.', correct: true },
          { text: 'Que <code>soma</code> existe, sem olhar o resultado.', why: '<code>toBe</code> compara o valor produzido com o esperado, não apenas a existência da função.' },
          { text: 'Que <code>soma</code> é mais rápida que <code>5</code>.', why: 'Testes de <code>expect/toBe</code> comparam valores; não medem velocidade.' }
        ],
        explain: '<code>expect(valor).toBe(esperado)</code> falha se <code>valor</code> for diferente de <code>esperado</code>. Aqui, afirma que <code>soma(2, 3)</code> resulta em <code>5</code>.',
        hints: ['Leia como "espero que ... seja ...".']
      },
      {
        id: 'js11-1-b', kind: 'desafio', title: 'Teste a sua função',
        body: [
          { p: 'Escreva uma função simples e, em seguida, um teste para ela usando <code>describe</code>, <code>it</code> e <code>expect(...).toBe(...)</code>. Rode e veja o resultado no console.' }
        ],
        hints: [
          'Defina, por exemplo, <code>function soma(a, b) { return a + b; }</code>.',
          'Depois: <code>describe(\'soma\', function () { it(\'...\', function () { expect(soma(2, 3)).toBe(5); }); });</code>.'
        ],
        solution: '<p>Uma função e seu teste, prontos para o runner embutido:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nfunction soma(a, b) {\n  return a + b;\n}\ndescribe(\'soma\', function () {\n  it(\'soma dois numeros\', function () {\n    expect(soma(2, 3)).toBe(5);\n  });\n});\nEOF</pre>',
        check: desafioJS(['teste.js'], [
          [/describe\(/, 'Agrupe com <code>describe(...)</code>.'],
          [/\bit\(/, 'Descreva um caso com <code>it(...)</code>.'],
          [/expect\(/, 'Verifique o resultado com <code>expect(...)</code>.']
        ], 'Crie um arquivo com <code>describe</code>, <code>it</code> e <code>expect</code>.')
      }
    ]
  });

  /* ---------------------------- js12 — arquitetura e produção ---------------------------- */
  LX.lesson('js12', {
    id: 'js12-1', n: '12.1', title: 'Estado imutável e funções puras',
    goal: 'Atualizar estado sem mutação, devolvendo um novo objeto congelado.',
    setup: semear('arquitetura.js', '// TODO: atualize estado sem mutar.\n'),
    body: [
      { h2: 'Não mudar por baixo dos panos' },
      { p: 'Uma <strong>função pura</strong> só depende dos seus argumentos e não altera nada de fora — dado o mesmo input, devolve sempre o mesmo output. Trabalhar com <strong>estado imutável</strong> (devolver um objeto novo em vez de alterar o antigo) torna o sistema previsível e fácil de testar. <code>Object.freeze</code> trava um objeto contra mudanças.' },
      { code: ['function aplicar(estado, evento) {', '  return Object.freeze(', '    Object.assign({}, estado, { total: estado.total + evento.valor })', '  );', '}', 'let estado = Object.freeze({ total: 0 });', 'estado = aplicar(estado, { valor: 10 });', 'estado = aplicar(estado, { valor: 5 });', 'console.log(estado.total); // 15'], lang: 'js', run: false },
      { box: 'key', label: 'Por que importa em produção', body: [
        { p: 'Estado imutável elimina uma classe inteira de bugs: nada muda o objeto pelas suas costas. É a base de reducers, histórico/undo e de raciocinar sobre concorrência sem medo.' }
      ] }
    ],
    tasks: [
      {
        id: 'js12-1-a', kind: 'guiado', title: 'Acumule sem mutar',
        body: [
          { p: 'Rode o exemplo. Cada <code>aplicar</code> devolve um <strong>novo</strong> estado; o anterior nunca é alterado. O <code>console.log</code> final mostra <code>15</code>.' },
          { p: 'Experimente adicionar <code>estado.total = 99;</code> depois do freeze e rode: a atribuição é silenciosamente ignorada (ou lança, em modo estrito) — o objeto está congelado.' }
        ],
        hints: ['Cole o exemplo e rode. Some 10 + 5 e confira o total.']
      },
      {
        id: 'js12-1-q', kind: 'quiz', title: 'O que é função pura?',
        body: [{ p: 'Qual característica define uma <strong>função pura</strong>?' }],
        options: [
          { text: 'Dado o mesmo input, devolve o mesmo output e não altera nada externo.', correct: true },
          { text: 'É escrita sem usar <code>function</code>, só com arrow.', why: 'A sintaxe não define pureza; o que conta é não ter efeitos colaterais.' },
          { text: 'É qualquer função que usa <code>console.log</code>.', why: 'Escrever no console é justamente um efeito colateral — o oposto de pureza.' }
        ],
        explain: 'Pureza é sobre comportamento: mesmo input, mesmo output, sem efeitos colaterais. Isso torna o código previsível e testável.',
        hints: ['Pense em "sem surpresas e sem mexer em nada de fora".']
      },
      {
        id: 'js12-1-b', kind: 'desafio', title: 'Atualize estado sem mutar',
        body: [
          { p: 'Escreva uma função que receba um estado e um evento e devolva um <strong>novo</strong> estado (sem alterar o recebido), usando <code>Object.freeze</code> para congelá-lo. Aplique-a duas vezes a um estado inicial e mostre o resultado com <code>console.log</code>.' }
        ],
        hints: [
          'Use <code>Object.assign({}, estado, { ... })</code> para copiar e mudar campos.',
          'Envolva o retorno em <code>Object.freeze(...)</code>.'
        ],
        solution: '<p>Atualização imutável: um novo objeto congelado a cada evento:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nfunction aplicar(estado, evento) {\n  return Object.freeze(\n    Object.assign({}, estado, { total: estado.total + evento.valor })\n  );\n}\nlet estado = Object.freeze({ total: 0 });\nestado = aplicar(estado, { valor: 10 });\nestado = aplicar(estado, { valor: 5 });\nconsole.log(\'total\', estado.total);\nEOF</pre>',
        check: desafioJS(['arquitetura.js'], [
          [/Object\.freeze/, 'Congele o novo estado com <code>Object.freeze</code>.'],
          [/(function\b|=>)/, 'Escreva a atualização como uma função.'],
          [/console\.log/, 'Mostre o total final com <code>console.log(...)</code>.']
        ], 'Crie um arquivo com uma função que devolve estado congelado.')
      }
    ]
  });

  /* ---------------------------- jspf — projeto final ---------------------------- */
  LX.lesson('jspf', {
    id: 'jspf-1', n: 'PF.1', title: 'Projeto: um módulo com testes',
    goal: 'Reunir função, teste e verificação em um pequeno módulo completo.',
    setup: semear('projeto.js', '// TODO: monte seu módulo com testes.\n'),
    body: [
      { h2: 'Juntar tudo' },
      { p: 'Chegou a hora de combinar o que você viu: uma <strong>função</strong> com uma regra de negócio clara e <strong>testes</strong> que provam o comportamento. Um módulo que se testa é um módulo em que se pode confiar e mexer sem medo.' },
      { code: ['function precoComDesconto(preco, pct) {', '  return preco - preco * (pct / 100);', '}', "describe('precoComDesconto', function () {", "  it('aplica 10 por cento', function () {", '    expect(precoComDesconto(100, 10)).toBe(90);', '  });', '});'], lang: 'js', run: false },
      { box: 'tip', label: 'Cubra as bordas', body: [
        { p: 'Além do caso normal, teste os limites: desconto zero mantém o preço; desconto de 100% zera. Cada borda vira um <code>it</code> a mais.' }
      ] }
    ],
    tasks: [
      {
        id: 'jspf-1-a', kind: 'guiado', title: 'Rode o módulo',
        body: [
          { p: 'Cole a função e o teste acima e rode. Depois acrescente um segundo <code>it</code> para uma borda (por exemplo, desconto de 0% deve manter o preço) e rode de novo.' }
        ],
        hints: ['Adicione <code>it(\'sem desconto\', function () { expect(precoComDesconto(50, 0)).toBe(50); });</code> dentro do <code>describe</code>.']
      },
      {
        id: 'jspf-1-q', kind: 'quiz', title: 'Por que testar as bordas?',
        body: [{ p: 'Por que não basta um único teste do caso normal?' }],
        options: [
          { text: 'Bugs costumam morar nos limites (zero, vazio, máximo), não no caso comum.', correct: true },
          { text: 'Porque o runner exige pelo menos três testes.', why: 'Não há número mínimo obrigatório; a questão é cobrir os casos que quebram.' },
          { text: 'Porque testes de borda deixam o código mais rápido.', why: 'Testes verificam comportamento; não alteram a velocidade do código.' }
        ],
        explain: 'O caso normal costuma funcionar; os erros aparecem nos extremos. Cobrir as bordas é onde os testes mais pagam.',
        hints: ['Onde os programas costumam falhar: no meio ou nas pontas?']
      },
      {
        id: 'jspf-1-b', kind: 'desafio', title: 'Seu módulo testado',
        body: [
          { p: 'Escreva um módulo com uma função de sua escolha (uma regra de negócio simples) e ao menos um teste com <code>describe</code>, <code>it</code> e <code>expect</code> que prove o comportamento. Rode e veja os testes passarem.' }
        ],
        hints: [
          'Defina a função primeiro; depois descreva-a com <code>describe</code>.',
          'Cada caso vai em um <code>it</code>, com um <code>expect(...).toBe(...)</code>.'
        ],
        solution: '<p>Uma função de negócio com dois casos de teste:</p><pre>cat &lt;&lt;\'EOF\' &gt; /home/aluno/js/resposta.js\nfunction precoComDesconto(preco, pct) {\n  return preco - preco * (pct / 100);\n}\ndescribe(\'precoComDesconto\', function () {\n  it(\'aplica 10 por cento de desconto\', function () {\n    expect(precoComDesconto(100, 10)).toBe(90);\n  });\n  it(\'sem desconto mantem o preco\', function () {\n    expect(precoComDesconto(50, 0)).toBe(50);\n  });\n});\nconsole.log(\'modulo pronto\');\nEOF</pre>',
        check: desafioJS(['projeto.js'], [
          [/(function\b|=>)/, 'Defina a função do seu módulo.'],
          [/describe\(/, 'Descreva o comportamento com <code>describe(...)</code>.'],
          [/\bit\(/, 'Escreva ao menos um caso com <code>it(...)</code>.'],
          [/expect\(/, 'Prove o resultado com <code>expect(...)</code>.']
        ], 'Crie um módulo com uma função e seus testes.')
      }
    ]
  });
})();
