/* =========================================================================
   MÓDULO D10 — YAML sem decoreba
   A linguagem em que o Compose, o Traefik e metade da infraestrutura moderna
   são escritos. Três aulas: a forma, os tipos e o conserto.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 10.1 ============================== */
  LX.lesson('d10', {
    id: 'ld10-1', n: '10.1', title: 'A forma: mapas, listas e indentação',
    goal: 'Ler qualquer arquivo YAML e saber, olhando, o que é chave, o que é valor, o que é lista e quem está dentro de quem.',
    body: [
      { h2: 'Por que aprender isto antes do Compose' },
      { p: 'O <code>compose.yaml</code> é um arquivo YAML. O <code>traefik.yml</code> é um arquivo YAML. Um manifesto de Kubernetes, um pipeline de CI, um playbook de Ansible: YAML. Quase todo erro que trava um iniciante no Compose não é um erro de Docker — é um erro de YAML.' },
      { p: 'A boa notícia: YAML tem <strong>três</strong> construções, e só. Escalar, mapa e lista. Todo arquivo, por maior que seja, é uma combinação dessas três.' },

      { h4: '1. Escalar — um valor solto' },
      { code: ['nginx:alpine', '8080', 'true'], run: false, lang: 'yaml' },
      { p: 'Um texto, um número, um booleano, um nulo. É a folha da árvore: não tem nada dentro.' },

      { h4: '2. Mapa — pares <code>chave: valor</code>' },
      {
        code: [
          'image: nginx:alpine',
          'container_name: web',
          'restart: unless-stopped'
        ], run: false, lang: 'yaml'
      },
      { p: 'Um mapa é um conjunto de chaves, cada uma com um valor. Repare no espaço depois dos dois-pontos: <code>image:nginx</code> (sem espaço) <strong>não</strong> é um par chave/valor, é um escalar de texto chamado <code>image:nginx</code>. O espaço é obrigatório.' },

      { h4: '3. Lista — itens começando com <code>- </code>' },
      {
        code: [
          '- 80:80',
          '- 443:443'
        ], run: false, lang: 'yaml'
      },
      { p: 'Um hífen, um espaço, o item. A ordem importa e os itens não têm nome — você acessa pela posição, não por chave.' },

      { h2: 'A indentação é a estrutura' },
      { p: 'Em JSON, quem diz o que está dentro de quem são as chaves <code>{ }</code>. Em YAML, é a <strong>quantidade de espaços à esquerda</strong>. A indentação não é enfeite: ela é a sintaxe.' },
      {
        table: {
          head: ['JSON', 'YAML'],
          rows: [
            ['<code>{"services": {"web": {"image": "nginx"}}}</code>', '<code>services:</code><br><code>&nbsp;&nbsp;web:</code><br><code>&nbsp;&nbsp;&nbsp;&nbsp;image: nginx</code>'],
            ['<code>{"ports": ["80:80", "443:443"]}</code>', '<code>ports:</code><br><code>&nbsp;&nbsp;- "80:80"</code><br><code>&nbsp;&nbsp;- "443:443"</code>']
          ]
        }
      },
      {
        box: 'key', label: 'Três regras que resolvem 90% dos problemas', body: [
          { ol: [
            '<strong>Só espaços. Nunca TAB.</strong> O YAML recusa a tabulação na indentação — e o pior é que ela é invisível no editor.',
            '<strong>Dois espaços por nível</strong> é a convenção universal. O YAML aceita outras quantidades, mas você não ganha nada com isso.',
            '<strong>Irmãos alinhados.</strong> Chaves do mesmo nível começam exatamente na mesma coluna. Um espaço a mais em uma delas muda o significado do arquivo.'
          ] }
        ]
      },

      { h2: 'Lendo de fora para dentro' },
      {
        code: [
          'services:',
          '  web:',
          '    image: nginx:alpine',
          '    ports:',
          '      - "8080:80"',
          '    environment:',
          '      TZ: America/Sao_Paulo',
          '  cache:',
          '    image: redis:7-alpine'
        ], run: false, lang: 'yaml'
      },
      { p: 'Traduzindo em voz alta: <em>o documento tem uma chave <code>services</code>; dentro dela, um mapa com duas chaves, <code>web</code> e <code>cache</code>; dentro de <code>web</code>, um mapa com <code>image</code>, <code>ports</code> e <code>environment</code>; <code>ports</code> é uma lista com um item; <code>environment</code> é um mapa com uma chave.</em>' },
      {
        ascii: `services            (mapa)
├── web            (mapa)
│   ├── image      escalar
│   ├── ports      LISTA  →  ["8080:80"]
│   └── environment (mapa) → TZ: America/Sao_Paulo
└── cache          (mapa)
    └── image      escalar`
      },

      { h2: 'Lista de mapas: o formato que confunde' },
      { p: 'Um item de lista pode ser um mapa inteiro. É o caso das montagens no formato longo:' },
      {
        code: [
          'volumes:',
          '  - type: volume',
          '    source: dados',
          '    target: /var/lib/mysql',
          '  - type: bind',
          '    source: ./site',
          '    target: /usr/share/nginx/html'
        ], run: false, lang: 'yaml'
      },
      { p: 'A lista tem <strong>dois</strong> itens. O hífen marca onde cada item começa; as chaves seguintes, alinhadas com <code>type</code>, pertencem ao mesmo item. Se <code>source</code> estivesse desalinhado, ele viraria outro item ou um erro.' },
      {
        box: 'warn', label: 'O sintoma clássico', body: [
          { p: 'Você escreve uma lista de três serviços e o Compose só enxerga um. Quase sempre a causa é que os hifens não estão todos na mesma coluna — os que estão mais à direita viraram parte do item anterior.' }
        ]
      },

      { h2: 'As formas em linha' },
      { p: 'YAML aceita a sintaxe do JSON dentro dele. As duas formas abaixo produzem exatamente o mesmo objeto:' },
      {
        code: [
          '# forma em bloco',
          'ports:',
          '  - "8080:80"',
          '  - "8443:443"',
          '',
          '# forma em linha (flow)',
          'ports: ["8080:80", "8443:443"]'
        ], run: false, lang: 'yaml'
      },
      { p: 'A forma em linha é ótima para listas curtas e é o que você vai ver em muitos exemplos de documentação. A forma em bloco é melhor para arquivos que outras pessoas vão editar: cada mudança vira uma linha nova no <code>git diff</code>.' },

      { h2: 'Comentários e texto de várias linhas' },
      {
        code: [
          '# comentário de linha inteira',
          'image: nginx:alpine   # comentário no fim da linha (precisa de espaço antes do #)',
          '',
          'command: |',
          '  sh -c "echo iniciando',
          '  && nginx -g \'daemon off;\'"'
        ], run: false, lang: 'yaml'
      },
      { p: 'O <code>|</code> abre um bloco literal: tudo que estiver indentado abaixo dele vira uma única string, com as quebras de linha preservadas. O <code>&gt;</code> faz o mesmo, mas junta as linhas com espaço em vez de quebra.' },
      {
        box: 'note', label: 'O <code>#</code> precisa de espaço antes', body: [
          { p: '<code>image: nginx#latest</code> tem o <code>#</code> colado: ele faz parte do valor. <code>image: nginx #latest</code> tem um espaço antes: dali para a frente é comentário, e o valor é só <code>nginx</code>. Uma diferença de um caractere que muda a imagem que sobe.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td10-1-a', kind: 'guiado', title: 'Escreva a árvore à mão',
        body: [
          { p: 'Crie a pasta <code>~/yaml</code> e, dentro dela, o arquivo <code>inventario.yaml</code> que descreve exatamente esta estrutura:' },
          { ul: [
            'uma chave <code>servidor</code> no topo;',
            'dentro dela, <code>nome</code> com o valor <code>borges</code>;',
            'ainda dentro dela, <code>servicos</code>, que é uma <strong>lista</strong> com três itens: <code>web</code>, <code>banco</code> e <code>cache</code>;',
            'ainda dentro dela, <code>portas</code>, que é um <strong>mapa</strong> com <code>http</code> valendo <code>80</code> e <code>https</code> valendo <code>443</code>.'
          ] },
          { p: 'Use o editor que preferir (<code>nano ~/yaml/inventario.yaml</code>) ou um <em>heredoc</em>. Dois espaços por nível, sem TAB.' }
        ],
        hints: [
          'A raiz tem uma única chave. Tudo o mais é filho dela, então tudo o mais começa com pelo menos dois espaços.',
          '<code>servicos</code> é lista: os três itens começam com <code>- </code> e ficam alinhados entre si. <code>portas</code> é mapa: as duas chaves ficam alinhadas entre si.'
        ],
        solution: '<pre>$ mkdir -p ~/yaml\n$ cat &gt; ~/yaml/inventario.yaml &lt;&lt;\'EOF\'\nservidor:\n  nome: borges\n  servicos:\n    - web\n    - banco\n    - cache\n  portas:\n    http: 80\n    https: 443\nEOF\n$ cat ~/yaml/inventario.yaml</pre>',
        check: (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/yaml/inventario.yaml');
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/yaml/inventario.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O arquivo existe mas o YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc && doc.servidor && typeof doc.servidor === 'object' && !Array.isArray(doc.servidor),
              'A raiz precisa ter a chave <code>servidor</code>, e o valor dela precisa ser um mapa (chaves indentadas embaixo).'],
            [() => doc.servidor.nome === 'borges', 'Falta <code>nome: borges</code> dentro de <code>servidor</code>.'],
            [() => Array.isArray(doc.servidor.servicos),
              '<code>servicos</code> precisa ser uma <strong>lista</strong> (itens com <code>- </code>), não um mapa.'],
            [() => doc.servidor.servicos.length === 3 &&
              ['web', 'banco', 'cache'].every(x => doc.servidor.servicos.includes(x)),
              'A lista <code>servicos</code> precisa ter exatamente três itens: web, banco e cache.'],
            [() => doc.servidor.portas && typeof doc.servidor.portas === 'object' && !Array.isArray(doc.servidor.portas),
              '<code>portas</code> precisa ser um <strong>mapa</strong> (<code>http: 80</code>), não uma lista.'],
            [() => doc.servidor.portas.http === 80 && doc.servidor.portas.https === 443,
              'Dentro de <code>portas</code>, espero <code>http: 80</code> e <code>https: 443</code>.']
          ]);
        }
      },
      {
        id: 'td10-1-q', kind: 'quiz', title: 'Quantos serviços existem aqui?',
        body: [
          { p: 'Um colega mandou este trecho e diz que o Compose "está ignorando o Redis".' },
          {
            code: [
              'services:',
              '  web:',
              '    image: nginx:alpine',
              '    ports:',
              '      - "8080:80"',
              '    cache:',
              '      image: redis:7-alpine'
            ], run: false, lang: 'yaml'
          },
          { p: 'O que este arquivo realmente descreve?' }
        ],
        options: [
          { text: 'Um único serviço, <code>web</code>, que tem uma chave desconhecida <code>cache</code> dentro dele — porque <code>cache</code> está indentado no nível das opções de <code>web</code>, não no nível dos serviços.', correct: true },
          { text: 'Dois serviços, <code>web</code> e <code>cache</code>; o Compose só precisa de um <code>docker compose up --force-recreate</code>.', why: 'A indentação é a estrutura. <code>cache</code> está quatro espaços à direita, alinhado com <code>image</code> e <code>ports</code>: ele é uma opção de <code>web</code>, não um irmão dele.' },
          { text: 'Um erro de sintaxe: o YAML não vai nem carregar.', why: 'Sintaticamente o arquivo é válido — é um mapa dentro de outro mapa. O problema aparece depois, na validação do Compose, que não conhece uma opção chamada <code>cache</code>.' },
          { text: 'Dois serviços, mas o <code>cache</code> só sobe se for citado em <code>depends_on</code>.', why: '<code>depends_on</code> ordena a subida de serviços que existem; ele não cria serviço nenhum. E aqui <code>cache</code> nem serviço é.' }
        ],
        hints: ['Conte os espaços à esquerda de <code>web</code> e à esquerda de <code>cache</code>.'],
        explain: 'Para virar um segundo serviço, <code>cache</code> precisa ficar alinhado com <code>web</code> — dois espaços, não quatro:<pre>services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n  cache:\n    image: redis:7-alpine</pre>'
      },
      {
        id: 'td10-1-b', kind: 'desafio', title: 'Escreva uma lista de mapas',
        body: [
          { p: 'Em <code>~/yaml/pedido.yaml</code>, descreva exatamente esta estrutura:' },
          { ul: [
            'uma chave <code>pedido</code> no topo;',
            'dentro dela, <code>cliente</code> valendo <code>borges</code>;',
            'ainda dentro dela, <code>itens</code>, que é uma <strong>lista de dois mapas</strong>: o primeiro com <code>produto: cadeira</code> e <code>quantidade: 2</code>; o segundo com <code>produto: mesa</code> e <code>quantidade: 1</code>.'
          ] }
        ],
        hints: [
          'É o mesmo formato da montagem no estilo longo que a aula mostrou: cada item da lista começa com um hífen, e as chaves seguintes ficam alinhadas com a primeira, no mesmo item.',
          'Se <code>produto</code> e <code>quantidade</code> do segundo item não ficarem na mesma coluna do primeiro, ou o hífen do segundo item ficar desalinhado do primeiro, a lista deixa de ter dois itens certos.'
        ],
        solution: '<pre>$ mkdir -p ~/yaml\n$ cat &gt; ~/yaml/pedido.yaml &lt;&lt;\'EOF\'\npedido:\n  cliente: borges\n  itens:\n    - produto: cadeira\n      quantidade: 2\n    - produto: mesa\n      quantidade: 1\nEOF\n$ cat ~/yaml/pedido.yaml</pre>',
        check: (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/yaml/pedido.yaml');
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/yaml/pedido.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O arquivo existe mas o YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc.pedido && typeof doc.pedido === 'object' && !Array.isArray(doc.pedido),
              'A raiz precisa ter a chave <code>pedido</code>, com um mapa dentro.'],
            [() => doc.pedido.cliente === 'borges', 'Falta <code>cliente: borges</code> dentro de <code>pedido</code>.'],
            [() => Array.isArray(doc.pedido.itens) && doc.pedido.itens.length === 2,
              '<code>itens</code> precisa ser uma <strong>lista</strong> com exatamente dois itens.'],
            [() => doc.pedido.itens.every(it => it && typeof it === 'object' && !Array.isArray(it)),
              'Cada item de <code>itens</code> precisa ser um mapa (as chaves do item alinhadas sob o mesmo hífen), não um texto solto.'],
            [() => doc.pedido.itens.some(it => it.produto === 'cadeira' && Number(it.quantidade) === 2),
              'Falta o item com <code>produto: cadeira</code> e <code>quantidade: 2</code>.'],
            [() => doc.pedido.itens.some(it => it.produto === 'mesa' && Number(it.quantidade) === 1),
              'Falta o item com <code>produto: mesa</code> e <code>quantidade: 1</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 10.2 ============================== */
  LX.lesson('d10', {
    id: 'ld10-2', n: '10.2', title: 'Os tipos: quando o YAML decide por você',
    goal: 'Saber exatamente quando um valor vira número, booleano ou nulo sem você pedir — e quando colocar aspas.',
    setup: (m) => {
      D.pasta(m, '/home/aluno/yaml');
      D.arquivo(m, '/home/aluno/yaml/tipos.yaml',
        'app:\n' +
        '  versao: 1.10\n' +
        '  pin: 007\n' +
        '  modo: 0755\n' +
        '  ativo: yes\n' +
        '  debug: true\n' +
        '  janela: 22:30\n' +
        '  senha: 123456\n');
    },
    body: [
      { h2: 'YAML adivinha o tipo — e às vezes adivinha errado' },
      { p: 'Quando você escreve <code>porta: 8080</code>, o YAML não devolve o texto <code>"8080"</code>: devolve o <strong>número</strong> 8080. Ele olha a forma do valor e decide o tipo sozinho. Na maior parte do tempo isso ajuda. Nas outras, produz bugs que parecem sobrenaturais.' },
      {
        table: {
          head: ['Você escreve', 'O YAML entende', 'Tipo'],
          rows: [
            ['<code>nginx:alpine</code>', '<code>nginx:alpine</code>', 'texto'],
            ['<code>8080</code>', '<code>8080</code>', 'número inteiro'],
            ['<code>1.10</code>', '<code>1.1</code>', 'número decimal — <strong>o zero some</strong>'],
            ['<code>007</code>', '<code>7</code>', 'número — <strong>os zeros somem</strong>'],
            ['<code>0755</code>', '<code>755</code>', 'número decimal, <strong>não</strong> octal'],
            ['<code>true</code> / <code>false</code>', 'verdadeiro / falso', 'booleano'],
            ['<code>null</code> ou <code>~</code> ou nada', 'nulo', 'nulo'],
            ['<code>"8080"</code>', '<code>8080</code>', 'texto — as aspas mandam'],
            ['<code>2026-09-01</code>', '<code>2026-09-01</code>', 'texto (no esquema core)']
          ]
        }
      },

      { h2: 'A armadilha dos zeros à esquerda' },
      { p: 'Esta é a que mais dói na prática, porque o valor não fica errado de um jeito escandaloso — ele fica errado de um jeito plausível.' },
      {
        code: [
          '$ cd ~/yaml',
          '$ cat tipos.yaml'
        ], run: true
      },
      { p: 'Repare em <code>pin: 007</code>, <code>modo: 0755</code> e <code>versao: 1.10</code>. Nenhum dos três sobrevive intacto: viram <code>7</code>, <code>755</code> e <code>1.1</code>.' },
      {
        box: 'warn', label: 'Permissões em YAML', body: [
          { p: 'Em Linux, <code>0755</code> é octal e vale 493 em decimal. Em YAML 1.2 — o que o Compose, o Traefik e o Kubernetes usam — <code>0755</code> é <strong>decimal</strong> e vale setecentos e cinquenta e cinco. Se você precisa mesmo de octal, ou usa aspas (<code>"0755"</code>) ou o prefixo explícito <code>0o755</code>.' }
        ]
      },

      { h2: 'A armadilha dos booleanos: o problema da Noruega' },
      { p: 'Existem duas versões de YAML circulando pelo mundo, e elas discordam sobre o que é booleano:' },
      {
        table: {
          head: ['Valor solto', 'YAML 1.1 (PyYAML, Ansible, docker-compose v1)', 'YAML 1.2 core (Compose v2, Traefik, Kubernetes)'],
          rows: [
            ['<code>true</code>', 'booleano', 'booleano'],
            ['<code>yes</code>, <code>on</code>, <code>y</code>', '<strong>booleano verdadeiro</strong>', 'texto'],
            ['<code>no</code>, <code>off</code>, <code>n</code>', '<strong>booleano falso</strong>', 'texto'],
            ['<code>NO</code> (código do país Noruega)', '<strong>falso</strong> 😱', 'texto <code>"NO"</code>']
          ]
        }
      },
      { p: 'O apelido "problema da Noruega" vem de uma lista de códigos de países em que <code>NO</code> virava <code>false</code> silenciosamente. As ferramentas em Go — o Docker Compose v2 incluso — seguem o esquema 1.2 e não fazem essa conversão, mas ferramentas em Python que você vai encontrar por aí ainda fazem.' },
      {
        box: 'key', label: 'A regra que atravessa as duas versões', body: [
          { p: 'Se o valor <strong>precisa</strong> ser texto, coloque entre aspas. Custa dois caracteres e funciona igual em toda ferramenta que existe. Vale especialmente para: senhas, PINs, versões, códigos de país, números de porta e qualquer coisa com <code>:</code> dentro.' }
        ]
      },

      { h2: 'Senhas e segredos que viram número' },
      {
        code: [
          'environment:',
          '  MARIADB_ROOT_PASSWORD: 123456        # vira o número 123456',
          '  MARIADB_ROOT_PASSWORD: "SENHA_DO_BANCO"   # texto, sempre'
        ], run: false, lang: 'yaml'
      },
      { p: 'O Compose converte o número de volta para texto antes de entregar ao container, então esse caso específico costuma passar batido. Mas <code>PIN: 007</code> chega no container como <code>7</code>, e ninguém vai descobrir isso lendo o log.' },
      {
        box: 'note', label: 'Sobre credenciais nos exemplos', body: [
          { p: 'Todos os exemplos deste curso usam marcadores como <code>SENHA_DO_BANCO</code>, <code>HASH_KEY</code> e <code>DATABASE_URL</code>. Nunca escreva uma senha real dentro de um arquivo que vai para o Git — o módulo 12 mostra o caminho certo, com <code>.env</code> fora do repositório.' }
        ]
      },

      { h2: 'Aspas simples e aspas duplas' },
      {
        table: {
          head: ['Forma', 'Comportamento', 'Quando usar'],
          rows: [
            ['sem aspas', 'o YAML adivinha o tipo', 'valores óbvios e sem risco: nomes de imagem, caminhos'],
            ['<code>\'texto\'</code>', 'texto literal; nada é interpretado; para pôr uma aspa simples, dobre: <code>\'\'</code>', 'quando o valor tem <code>\\</code> ou <code>$</code> que devem ficar como estão'],
            ['<code>"texto"</code>', 'texto com escapes: <code>\\n</code> vira quebra de linha, <code>\\"</code> vira aspa', 'quando você precisa de escapes']
          ]
        }
      },
      {
        box: 'warn', label: 'Quando as aspas são obrigatórias', body: [
          { p: 'Um valor que <strong>começa</strong> com <code>*</code>, <code>&amp;</code>, <code>[</code>, <code>{</code>, <code>%</code>, <code>@</code>, <code>!</code> ou <code>`</code> quebra o analisador se ficar solto — esses caracteres têm significado especial em YAML. Um valor que começa com <code>#</code> vira comentário. Sempre entre aspas.' }
        ]
      },

      { h2: 'Como conferir o que o YAML entendeu' },
      { p: 'Não adivinhe: pergunte. Dentro de um projeto Compose, o comando que renderiza o arquivo final já resolvido é:' },
      { code: ['docker compose config'], run: false },
      { p: 'Ele mostra o documento depois de toda a interpolação e conversão de tipos — inclusive com aspas nos valores que o Compose entende como texto. É a ferramenta de depuração de YAML mais útil que existe, e ela não sobe container nenhum.' }
    ],
    tasks: [
      {
        id: 'td10-2-a', kind: 'guiado', title: 'Veja o YAML adivinhar tipos',
        body: [
          { p: 'A pasta <code>~/yaml</code> já tem um arquivo com valores escritos sem cuidado nenhum com tipo. Leia-o:' },
          { code: ['$ cd ~/yaml', '$ cat tipos.yaml'] },
          { p: 'Compare cada valor com a tabela da aula: <code>pin: 007</code> vira o número 7, <code>modo: 0755</code> vira 755, <code>versao: 1.10</code> vira 1.1 — cada um perdeu algo ao ser lido sem aspas.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código.'],
        check: (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /cat\s+.*tipos\.yaml/), 'Rode <code>cat tipos.yaml</code> (dentro de <code>~/yaml</code>) para ver o arquivo.']
        ])
      },
      {
        id: 'td10-2-f', kind: 'fill', title: 'Complete para que o valor seja texto',
        body: [
          { p: 'Este trecho precisa entregar ao container o PIN exatamente como <code>007</code>, com os dois zeros. Complete o valor:' }
        ],
        template: 'PIN: ___', sample: '"007"',
        answers: ['["\']007["\']'],
        hints: ['Sem aspas, o YAML lê <code>007</code> como o número 7 e os zeros somem.'],
        solution: 'Qualquer forma com aspas serve: <code>PIN: "007"</code> ou <code>PIN: \'007\'</code>. As aspas desligam a adivinhação de tipo e o valor chega como texto.',
        check: (ctx) => {
          const v = (ctx.vals[0] || '').trim();
          if (!v) return { ok: false, msg: 'Escreva o valor completo, com o que for preciso para ele ser texto.' };
          let doc = null;
          try { doc = LX.lerYaml('PIN: ' + v); } catch (e) { return { ok: false, msg: 'Isso não é YAML válido: ' + e.message }; }
          const val = doc && doc.PIN;
          return H.checkAll([
            [() => typeof val === 'string', 'O YAML ainda está lendo isso como número. Falta o que desliga a adivinhação de tipo.'],
            [() => val === '007', () => 'Ficou como <code>' + val + '</code>. Preciso do texto exato <code>007</code>, com os dois zeros.']
          ]);
        }
      },
      {
        id: 'td10-2-b', kind: 'desafio', title: 'Conserte os tipos',
        body: [
          { p: 'O arquivo <code>~/yaml/tipos.yaml</code> foi escrito sem cuidado nenhum com tipos. Ajuste-o para que, quando lido, cada campo tenha o valor abaixo — <strong>sem mudar os nomes das chaves e sem mudar o que o valor significa</strong>:' },
          {
            table: {
              head: ['Chave', 'Precisa ser'],
              rows: [
                ['<code>versao</code>', 'o texto <code>1.10</code>'],
                ['<code>pin</code>', 'o texto <code>007</code>'],
                ['<code>modo</code>', 'o texto <code>0755</code>'],
                ['<code>ativo</code>', 'o texto <code>yes</code>'],
                ['<code>debug</code>', 'o booleano verdadeiro (esse pode continuar como está)'],
                ['<code>janela</code>', 'o texto <code>22:30</code>'],
                ['<code>senha</code>', 'o texto <code>123456</code>']
              ]
            }
          },
          { p: 'Todos continuam dentro da chave <code>app</code>.' }
        ],
        hints: [
          'Só um mecanismo do YAML transforma qualquer valor em texto, e ele cabe em dois caracteres.',
          'Cuidado com <code>debug</code>: esse precisa continuar booleano, então ele é o único que <strong>não</strong> leva aspas.'
        ],
        solution: '<pre>$ cat &gt; ~/yaml/tipos.yaml &lt;&lt;\'EOF\'\napp:\n  versao: "1.10"\n  pin: "007"\n  modo: "0755"\n  ativo: "yes"\n  debug: true\n  janela: "22:30"\n  senha: "123456"\nEOF\n$ cat ~/yaml/tipos.yaml</pre>',
        check: (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/yaml/tipos.yaml');
          const esperado = { versao: '1.10', pin: '007', modo: '0755', ativo: 'yes', janela: '22:30', senha: '123456' };
          const testes = [
            [() => doc !== null, 'Não encontrei <code>~/yaml/tipos.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML ficou inválido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc.app && typeof doc.app === 'object', 'As chaves precisam continuar dentro de <code>app</code>.']
          ];
          for (const k in esperado) {
            testes.push([() => typeof doc.app[k] === 'string',
              () => '<code>' + k + '</code> ainda não é texto: o YAML leu como <code>' + JSON.stringify(doc.app[k]) + '</code>.']);
            testes.push([() => doc.app[k] === esperado[k],
              () => '<code>' + k + '</code> virou <code>' + JSON.stringify(doc.app[k]) + '</code>, mas precisa ser o texto <code>' + esperado[k] + '</code>.']);
          }
          testes.push([() => doc.app.debug === true,
            '<code>debug</code> precisa continuar sendo o booleano verdadeiro — sem aspas.']);
          return H.checkAll(testes);
        }
      }
    ]
  });

  /* ============================== 10.3 ============================== */
  LX.lesson('d10', {
    id: 'ld10-3', n: '10.3', title: 'Ler o erro e consertar',
    goal: 'Transformar uma mensagem de erro de YAML em uma correção precisa, em vez de sair mexendo em espaços até funcionar.',
    setup: (m) => {
      D.pasta(m, '/home/aluno/quebrado');
      D.arquivo(m, '/home/aluno/quebrado/compose.yaml',
        'services:\n' +
        '  web:\n' +
        '    image: nginx:alpine\n' +
        '\trestart: sempre\n' +
        '    ports:\n' +
        '      - "8087:80"\n' +
        '  cache\n' +
        '    image: redis:7-alpine\n');
    },
    body: [
      { h2: 'A mensagem sempre diz a linha' },
      { p: 'Erros de YAML assustam porque a mensagem é em inglês e cheia de jargão. Mas ela quase sempre traz duas informações que resolvem o caso: <strong>a linha</strong> e <strong>o que o analisador esperava encontrar</strong>.' },
      {
        table: {
          head: ['Mensagem', 'O que aconteceu', 'O que fazer'],
          rows: [
            ['<code>found character \'\\t\' that cannot start any token</code>', 'tem TAB na indentação daquela linha', 'trocar o TAB por espaços'],
            ['<code>could not find expected \':\'</code>', 'uma linha que deveria ser <code>chave: valor</code> não tem dois-pontos', 'colocar o <code>:</code>, ou transformar a linha em item de lista com <code>- </code>'],
            ['<code>mapping values are not allowed here</code>', 'uma linha está indentada mais do que as irmãs, ou há um <code>:</code> extra dentro de um valor', 'realinhar a linha, ou pôr o valor entre aspas'],
            ['<code>did not find expected key</code>', 'indentação inconsistente entre irmãos', 'alinhar as chaves do mesmo nível na mesma coluna'],
            ['<code>services must be a mapping</code>', 'o YAML é válido, mas a estrutura não é a que o Compose espera', 'conferir se <code>services</code> tem serviços indentados embaixo']
          ]
        }
      },
      {
        box: 'key', label: 'Uma correção por vez', body: [
          { p: 'O analisador para no <strong>primeiro</strong> erro. Corrija um, rode de novo, leia o próximo. Tentar consertar três coisas de uma vez é como você quebra um arquivo que estava quase certo.' }
        ]
      },

      { h2: 'Como ver o invisível' },
      { p: 'TAB e espaço são idênticos na tela. Estes comandos mostram a diferença:' },
      {
        code: [
          'cat -A arquivo.yaml       # TAB aparece como ^I, fim de linha como $',
          'grep -n -P "\\t" arquivo.yaml   # lista as linhas que têm TAB',
          'sed -i "s/\\t/  /g" arquivo.yaml  # troca cada TAB por dois espaços'
        ], run: false
      },
      {
        box: 'note', label: 'Prevenção vale mais que conserto', body: [
          { p: 'Configure seu editor para inserir espaços ao apertar TAB em arquivos <code>.yaml</code>. No VS Code: <em>Insert Spaces</em> ligado e <em>Tab Size</em> igual a 2. É a correção definitiva para o erro mais comum de todos.' }
        ]
      },

      { h2: 'O validador que você já tem' },
      { p: 'Dentro de um projeto Compose, este comando lê o arquivo, resolve as variáveis, valida a estrutura e imprime o resultado — sem subir nada:' },
      { code: ['docker compose config'], run: false },
      { p: 'Ele separa muito bem dois tipos de problema. Se o erro fala em <code>parsing</code>, o YAML está malformado. Se o erro fala em <code>validating</code> ou cita um caminho como <code>services.web.restart</code>, o YAML está certo e quem reclamou foi o Compose: a estrutura existe, mas o valor não faz sentido para ele.' },
      {
        ascii: `docker compose config
        │
        ├── erro com "parsing ..."      → problema de YAML (forma)
        ├── erro com "services.x.y ..." → problema de Compose (conteúdo)
        └── imprime o documento         → está tudo válido`
      },

      { h2: 'Um arquivo quebrado esperando por você' },
      { p: 'A pasta <code>~/quebrado</code> tem um <code>compose.yaml</code> com três defeitos, um de cada tipo. Comece olhando:' },
      {
        code: [
          '$ cd ~/quebrado',
          '$ cat -A compose.yaml',
          '$ docker compose config'
        ], run: true
      },
      { p: 'Leia a mensagem, corrija <strong>só</strong> o que ela apontou, rode de novo. Três rodadas.' }
    ],
    tasks: [
      {
        id: 'td10-3-a', kind: 'guiado', title: 'Leia o erro antes de mexer',
        body: [
          { p: 'A pasta <code>~/quebrado</code> tem um <code>compose.yaml</code> com defeitos. Antes de corrigir qualquer coisa, veja o que há de errado e a primeira mensagem de erro:' },
          { code: ['$ cd ~/quebrado', '$ cat -A compose.yaml', '$ docker compose config'] },
          { p: 'A mensagem aponta uma linha e um motivo. É nela que você mexe primeiro — nunca nas três de uma vez.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código.'],
        check: (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /cat\s+-A/), 'Rode <code>cat -A compose.yaml</code> para ver o TAB escondido.'],
          [() => H.usedCommand(ctx, /docker\s+compose\s+config/), 'Rode <code>docker compose config</code> para ler a mensagem de erro.']
        ])
      },
      {
        id: 'td10-3-q', kind: 'quiz', title: 'O que "could not find expected \':\'" quer dizer',
        body: [
          { p: 'Rodando <code>docker compose config</code> sobre um arquivo, o analisador aponta a linha do serviço <code>cache</code> e diz <code>could not find expected \':\'</code>. O que isso significa?' }
        ],
        options: [
          { text: 'A linha que deveria declarar a chave <code>cache</code> (como <code>cache:</code>) está sem os dois-pontos — o analisador esperava um par chave/valor ali e não achou.', correct: true },
          { text: 'Tem um TAB escondido na indentação daquela linha.', why: 'Essa é a mensagem <code>found character \'\\t\' that cannot start any token</code>. É outra mensagem, para outro defeito.' },
          { text: 'A linha está indentada mais do que as irmãs.', why: 'Isso dá <code>mapping values are not allowed here</code> ou <code>did not find expected key</code>. Aqui o problema é a ausência do <code>:</code>, não a coluna.' },
          { text: 'O valor de <code>restart</code> não é uma política válida.', why: 'Isso não é erro de YAML: o arquivo já estaria sintaticamente válido e o Compose reclamaria depois, na validação, citando <code>services.web.restart</code> — uma mensagem bem diferente desta.' }
        ],
        hints: ['Releia a tabela de mensagens da aula: qual delas fala em dois-pontos?'],
        explain: 'Um par chave/valor em YAML precisa do <code>:</code>. A linha <code>cache</code> (sem os dois-pontos) não pode virar uma chave — o conserto é escrever <code>cache:</code>, alinhado com <code>web:</code>.'
      },
      {
        id: 'td10-3-b', kind: 'desafio', title: 'Conserte até subir',
        body: [
          { p: 'Em <code>~/quebrado/compose.yaml</code>, corrija os três defeitos até que <code>docker compose config</code> imprima o documento sem erro. Depois suba a stack.' },
          { p: 'Regras: mantenha os dois serviços (<code>web</code> e <code>cache</code>), mantenha as imagens, mantenha a porta <strong>8087</strong> publicada para a 80 do <code>web</code> e mantenha a intenção do <code>restart</code> — o serviço deve reiniciar sempre.' },
          { p: 'No fim, <code>curl http://localhost:8087/</code> precisa responder.' }
        ],
        hints: [
          'Rode <code>cat -A compose.yaml</code>: um <code>^I</code> no começo de uma linha é um TAB.',
          'O segundo erro está em uma linha que anuncia um serviço mas esqueceu de um caractere. O terceiro não é YAML: é um valor que o Compose não aceita — as políticas válidas são <code>no</code>, <code>always</code>, <code>on-failure</code> e <code>unless-stopped</code>.'
        ],
        solution: '<pre>$ cd ~/quebrado\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  web:\n    image: nginx:alpine\n    restart: always\n    ports:\n      - "8087:80"\n  cache:\n    image: redis:7-alpine\nEOF\n$ docker compose config\n$ docker compose up -d\n$ curl -s http://localhost:8087/ | head -3</pre>',
        check: (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/quebrado/compose.yaml');
          const web = D.doProjeto(ctx, 'quebrado', 'web');
          const cache = D.doProjeto(ctx, 'quebrado', 'cache');
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/quebrado/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML ainda está quebrado: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc.services && doc.services.web && doc.services.cache,
              'O arquivo precisa continuar descrevendo os dois serviços, <code>web</code> e <code>cache</code>, no mesmo nível.'],
            [() => ['always', 'unless-stopped'].includes(String(doc.services.web.restart)),
              () => '<code>restart</code> está como <code>' + JSON.stringify(doc.services.web.restart) + '</code>. A política que significa "reinicia sempre" é <code>always</code>.'],
            [() => web && web.rodando, 'O container do serviço <code>web</code> não está rodando. Falta <code>docker compose up -d</code>.'],
            [() => cache && cache.rodando, 'O container do serviço <code>cache</code> não está rodando.'],
            [() => D.publicada(ctx, web ? web.nome : '', 8087), 'A porta 8087 do servidor não está publicada para o <code>web</code>.'],
            [() => { const r = D.http(ctx, 'localhost', 8087, '/'); return !!r && r.status === 200; },
              'A porta 8087 não respondeu com sucesso. Confira se o container do <code>web</code> subiu de fato.']
          ]);
        }
      },

    ]
  });
})();
