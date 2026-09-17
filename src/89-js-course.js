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
})();
