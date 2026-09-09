/* =========================================================================
   MÓDULO D11 — Docker Compose
   Do `docker run` interminável ao arquivo que descreve a stack inteira.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 11.1 ============================== */
  LX.lesson('d11', {
    id: 'ld11-1', n: '11.1', title: 'De comando solto para arquivo',
    goal: 'Traduzir um `docker run` completo em um compose.yaml equivalente e operar a stack com up, ps, logs e down.',
    body: [
      { h2: 'O problema que o Compose resolve' },
      { p: 'Suba um site com banco de dados usando só a linha de comando e você vai digitar algo assim:' },
      {
        code: [
          'docker network create loja',
          'docker volume create loja-dados',
          'docker run -d --name loja-db --network loja \\',
          '  -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO \\',
          '  -e MARIADB_DATABASE=loja \\',
          '  -v loja-dados:/var/lib/mysql \\',
          '  --restart unless-stopped mariadb:11.4',
          'docker run -d --name loja-web --network loja \\',
          '  -p 8080:80 --restart unless-stopped nginx:alpine'
        ], run: false
      },
      { p: 'Funciona. E aí você fecha o terminal. Daqui a três meses, quando precisar subir de novo, ou em outro servidor, ou explicar para um colega: <strong>onde está isso?</strong> No histórico do bash, se der sorte.' },
      {
        box: 'key', label: 'A ideia central', body: [
          { p: 'O Compose pega tudo o que você digitaria e coloca em um arquivo versionado junto com o projeto. O arquivo deixa de ser documentação sobre o ambiente: ele <strong>é</strong> o ambiente.' }
        ]
      },
      { p: 'O mesmo ambiente, declarado:' },
      {
        code: [
          'services:',
          '  db:',
          '    image: mariadb:11.4',
          '    restart: unless-stopped',
          '    environment:',
          '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
          '      MARIADB_DATABASE: loja',
          '    volumes:',
          '      - loja-dados:/var/lib/mysql',
          '  web:',
          '    image: nginx:alpine',
          '    restart: unless-stopped',
          '    ports:',
          '      - "8080:80"',
          '',
          'volumes:',
          '  loja-dados:'
        ], run: false, lang: 'yaml'
      },
      { p: 'Repare no que <strong>sumiu</strong>: não tem <code>docker network create</code> e não tem <code>--network</code>. O Compose cria uma rede para o projeto e coloca todos os serviços nela automaticamente. O volume também não precisa de <code>docker volume create</code>: basta declarar em <code>volumes:</code> no fim do arquivo.' },

      { h2: 'A tradução, campo a campo' },
      {
        table: {
          head: ['Na linha de comando', 'No compose.yaml'],
          rows: [
            ['<code>--name loja-db</code>', '<code>container_name: loja-db</code> (raramente vale a pena — veja abaixo)'],
            ['<code>-d</code>', 'nada: <code>up -d</code> é que decide isso'],
            ['<code>-p 8080:80</code>', '<code>ports:</code> com <code>- "8080:80"</code>'],
            ['<code>-e CHAVE=valor</code>', '<code>environment:</code> com <code>CHAVE: valor</code>'],
            ['<code>-v dados:/caminho</code>', '<code>volumes:</code> com <code>- dados:/caminho</code>'],
            ['<code>--network loja</code>', 'nada: a rede do projeto é automática'],
            ['<code>--restart unless-stopped</code>', '<code>restart: unless-stopped</code>'],
            ['<code>-u 1000:1000</code>', '<code>user: "1000:1000"</code>'],
            ['<code>-w /app</code>', '<code>working_dir: /app</code>'],
            ['<code>--entrypoint X</code>', '<code>entrypoint: X</code>'],
            ['o comando depois da imagem', '<code>command: X</code>']
          ]
        }
      },

      { h2: 'O nome do arquivo e o nome do projeto' },
      { p: 'O nome oficial hoje é <code>compose.yaml</code>. O Docker também procura, nesta ordem: <code>compose.yaml</code>, <code>compose.yml</code>, <code>docker-compose.yaml</code>, <code>docker-compose.yml</code>. Os dois últimos são o nome histórico e continuam funcionando — mas em projeto novo use <code>compose.yaml</code>.' },
      {
        box: 'warn', label: 'Obsoleto: a linha <code>version:</code>', body: [
          { p: 'Tutoriais antigos começam com <code>version: "3.8"</code>. Isso vinha do Compose v1 e <strong>não é mais usado</strong>: o Compose v2 ignora a linha e avisa que ela está obsoleta. Se você ver isso em um arquivo, pode apagar.' },
          { p: 'Outro sinal de conteúdo velho: <code>docker-compose</code> com hífen, como programa separado. Hoje é <code>docker compose</code>, um subcomando do próprio Docker.' }
        ]
      },
      { p: 'O <strong>nome do projeto</strong> é, por padrão, o nome da pasta onde está o arquivo, em minúsculas. Ele prefixa tudo o que o Compose cria:' },
      {
        ascii: `pasta ~/loja  →  projeto "loja"

  containers   loja-db-1        loja-web-1
  rede         loja_default
  volume       loja_loja-dados

  <projeto>-<servico>-<numero>`
      },
      { p: 'Para mudar: <code>docker compose -p outronome ...</code>, ou uma chave <code>name: outronome</code> no topo do arquivo.' },
      {
        box: 'note', label: 'Sobre <code>container_name</code>', body: [
          { p: 'Definir <code>container_name</code> fixa o nome e é útil quando algo externo depende dele. Mas o nome fixo impede o Compose de rodar mais de uma instância do serviço e faz colidir dois projetos que usem o mesmo nome. Na maioria dos casos, deixe o Compose nomear.' }
        ]
      },

      { h2: 'Os quatro comandos que você usa todo dia' },
      {
        table: {
          head: ['Comando', 'O que faz'],
          rows: [
            ['<code>docker compose up -d</code>', 'cria rede, volumes e containers que faltam e sobe tudo em segundo plano'],
            ['<code>docker compose ps</code>', 'lista os containers <strong>deste projeto</strong>, com estado e portas'],
            ['<code>docker compose logs -f</code>', 'log de todos os serviços juntos, cada linha marcada com o serviço'],
            ['<code>docker compose down</code>', 'para e remove os containers e a rede do projeto (os volumes <strong>ficam</strong>)']
          ]
        }
      },
      { p: 'Todos eles precisam ser rodados <strong>de dentro da pasta do projeto</strong>, porque é assim que o Compose acha o arquivo. Fora dela, use <code>-f caminho/compose.yaml</code>.' },
      {
        box: 'key', label: '<code>up</code> é idempotente', body: [
          { p: 'Rodar <code>up -d</code> duas vezes seguidas não cria containers duplicados. O Compose compara o que está descrito no arquivo com o que existe e só mexe no que mudou. Isso muda o jeito de trabalhar: você edita o arquivo e roda <code>up -d</code> de novo — não precisa derrubar nada antes.' }
        ]
      },

      { h2: 'Primeira stack, ao vivo' },
      {
        code: [
          '$ mkdir -p ~/primeira && cd ~/primeira',
          '$ printf \'services:\\n  web:\\n    image: nginx:alpine\\n    ports:\\n      - "8081:80"\\n\' > compose.yaml',
          '$ docker compose config',
          '$ docker compose up -d',
          '$ docker compose ps',
          '$ curl -s http://localhost:8081/ | head -4',
          '$ docker compose down'
        ], run: true
      },
      { p: 'Repare no nome do container em <code>docker compose ps</code>: <code>primeira-web-1</code>. E veja que <code>docker compose down</code> removeu também a rede <code>primeira_default</code> que ninguém pediu explicitamente para criar.' }
    ],
    tasks: [
      {
        id: 'td11-1-a', kind: 'guiado', title: 'Traduza o comando para arquivo',
        body: [
          { p: 'Este comando sobe um Redis com nome fixo, política de reinício e uma porta publicada presa ao loopback:' },
          {
            code: [
              'docker run -d --name cache-manual \\',
              '  --restart unless-stopped \\',
              '  -p 127.0.0.1:6390:6379 \\',
              '  redis:7-alpine'
            ], run: false
          },
          { p: 'Crie a pasta <code>~/traduz</code> e escreva ali um <code>compose.yaml</code> com um serviço chamado <code>cache</code> que produza o <strong>mesmo</strong> resultado — mesma imagem, mesma política de reinício, mesma publicação de porta. Não use <code>container_name</code>: deixe o Compose nomear.' },
          { p: 'Suba com <code>docker compose up -d</code> e confira com <code>docker compose ps</code>.' }
        ],
        hints: [
          'A raiz é <code>services:</code> e o nome do serviço é <code>cache</code>. Consulte a tabela de tradução da aula.',
          'Para prender a publicação ao loopback, o item da lista <code>ports</code> tem três partes: <code>"127.0.0.1:6390:6379"</code>. As aspas evitam qualquer surpresa de tipo.'
        ],
        solution: '<pre>$ mkdir -p ~/traduz\n$ cd ~/traduz\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  cache:\n    image: redis:7-alpine\n    restart: unless-stopped\n    ports:\n      - "127.0.0.1:6390:6379"\nEOF\n$ docker compose up -d\n$ docker compose ps</pre>',
        check: (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/traduz/compose.yaml');
          const c = D.doProjeto(ctx, 'traduz', 'cache');
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/traduz/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc.services && doc.services.cache, 'O arquivo precisa ter um serviço chamado <code>cache</code>.'],
            [() => !doc.services.cache.container_name, 'Tire o <code>container_name</code>: o enunciado pede que o Compose nomeie o container.'],
            [() => c, 'Não achei nenhum container do projeto <code>traduz</code>, serviço <code>cache</code>. Rodou <code>docker compose up -d</code> dentro de <code>~/traduz</code>?'],
            [() => c.nome === 'traduz-cache-1', () => 'O container se chama <code>' + c.nome + '</code>; esperava <code>traduz-cache-1</code>.'],
            [() => c.rodando, 'O container existe mas não está rodando.'],
            [() => /redis:7-alpine/.test(c.imagemRef || ''), () => 'A imagem é <code>' + c.imagemRef + '</code>; o comando usava <code>redis:7-alpine</code>.'],
            [() => c.restart && c.restart.politica === 'unless-stopped', 'Falta <code>restart: unless-stopped</code>.'],
            [() => c.portas.some(p => p.hostPort === 6390 && p.contPort === 6379),
              'A publicação de porta não bate: espero a 6390 do servidor apontando para a 6379 do container.'],
            [() => c.portas.some(p => p.hostPort === 6390 && p.hostIp === '127.0.0.1'),
              'A porta está publicada em todas as interfaces. O comando original prendia ao loopback: <code>127.0.0.1:6390:6379</code>.']
          ]);
        }
      },
      {
        id: 'td11-1-q', kind: 'quiz', title: 'Rodei up duas vezes',
        body: [
          { p: 'Você roda <code>docker compose up -d</code>, o container sobe. Sem mudar nada no arquivo, roda de novo. O que acontece?' }
        ],
        options: [
          { text: 'Nada muda: o Compose vê que o container existente já corresponde ao arquivo e o deixa como está.', correct: true },
          { text: 'Um segundo container do mesmo serviço sobe, com o sufixo <code>-2</code>.', why: 'O sufixo numérico existe para réplicas pedidas explicitamente, não para chamadas repetidas do <code>up</code>.' },
          { text: 'O container é recriado do zero, perdendo o que estava na camada gravável.', why: 'O Compose só recria quando a configuração mudou — ou quando você pede com <code>--force-recreate</code>.' },
          { text: 'Dá erro de nome em uso.', why: 'Esse é o comportamento do <code>docker run --name</code> repetido. O Compose reconhece o container como sendo dele e não trata como conflito.' }
        ],
        hints: ['O Compose compara o estado desejado (o arquivo) com o estado real (os containers).'],
        explain: 'O <code>up</code> é <strong>idempotente</strong>: ele converge o ambiente para o que o arquivo descreve. Se nada mudou, nada é feito. Por isso o ciclo normal de trabalho é editar o arquivo e rodar <code>up -d</code> de novo, sem derrubar antes.'
      },
      {
        id: 'td11-1-b', kind: 'desafio', title: 'Traduza outro comando e confira o ar',
        body: [
          { p: 'Traduza este comando para um <code>compose.yaml</code> em <code>~/site-manual</code>, com um serviço chamado <code>site</code>:' },
          {
            code: [
              'docker run -d --name site-manual \\',
              '  --restart unless-stopped \\',
              '  -p 8121:80 \\',
              '  -e TZ=America/Sao_Paulo \\',
              '  nginx:alpine'
            ], run: false
          },
          { p: 'Não use <code>container_name</code>. Suba com <code>docker compose up -d</code> e confirme que a porta 8121 responde e que a variável <code>TZ</code> chegou ao container.' }
        ],
        hints: [
          'Consulte de novo a tabela de tradução: <code>-e</code> vira <code>environment</code>, <code>-p</code> vira <code>ports</code>, <code>--restart</code> vira <code>restart</code>.',
          'O nome do serviço é <code>site</code> — o comando original usava <code>--name</code> só para dar um nome ao container, e o enunciado pede para deixar o Compose nomear.'
        ],
        solution: '<pre>$ mkdir -p ~/site-manual\n$ cd ~/site-manual\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8121:80"\n    environment:\n      TZ: America/Sao_Paulo\nEOF\n$ docker compose up -d\n$ docker compose ps</pre>',
        check: (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/site-manual/compose.yaml');
          const c = D.doProjeto(ctx, 'site-manual', 'site');
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/site-manual/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc.services && doc.services.site, 'O arquivo precisa ter um serviço chamado <code>site</code>.'],
            [() => !doc.services.site.container_name, 'Tire o <code>container_name</code>: deixe o Compose nomear o container.'],
            [() => c, 'Não achei nenhum container do projeto <code>site-manual</code>, serviço <code>site</code>. Rodou <code>docker compose up -d</code> dentro de <code>~/site-manual</code>?'],
            [() => c.rodando, 'O container existe mas não está rodando.'],
            [() => /nginx:alpine/.test(c.imagemRef || ''), () => 'A imagem é <code>' + c.imagemRef + '</code>; o comando usava <code>nginx:alpine</code>.'],
            [() => c.restart && c.restart.politica === 'unless-stopped', 'Falta <code>restart: unless-stopped</code>.'],
            [() => D.publicada(ctx, c.nome, 8121), 'A porta 8121 não está publicada para a 80 do container.'],
            [() => { const r = D.http(ctx, 'localhost', 8121, '/'); return !!r && r.status === 200; }, 'A porta 8121 não respondeu.'],
            [() => D.env(ctx, c.nome, 'TZ') === 'America/Sao_Paulo', 'Falta a variável <code>TZ: America/Sao_Paulo</code> no serviço.']
          ]);
        }
      }
    ]
  });

  /* ============================== 11.2 ============================== */
  LX.lesson('d11', {
    id: 'ld11-2', n: '11.2', title: 'Uma stack de verdade: serviços, redes e volumes',
    goal: 'Montar uma stack de vários serviços que conversam por nome, com dados persistentes e sem expor o banco.',
    body: [
      { h2: 'A rede automática, e quando ela não basta' },
      { p: 'Todo projeto Compose ganha uma rede chamada <code>&lt;projeto&gt;_default</code>, e todo serviço entra nela. Como é uma rede definida por usuário, o DNS interno funciona: dentro de qualquer container da stack, o <strong>nome do serviço</strong> resolve para o IP do container daquele serviço.' },
      {
        code: [
          'services:',
          '  api:',
          '    image: node:22-alpine',
          '    environment:',
          '      # o host é o NOME DO SERVIÇO, e a porta é a INTERNA',
          '      DATABASE_URL: "mysql://app:SENHA_DO_BANCO@db:3306/loja"',
          '  db:',
          '    image: mariadb:11.4'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'Repita até virar automático', body: [
          { p: 'Entre containers da mesma stack: <strong>nome do serviço</strong> + <strong>porta interna</strong>. Nunca <code>localhost</code>, nunca IP, nunca a porta publicada.' }
        ]
      },

      { h2: 'Redes explícitas: separar o que é público do que não é' },
      { p: 'Quando você declara <code>networks:</code>, o Compose para de colocar tudo junto e passa a obedecer você. Isso permite o desenho mais comum de produção: um proxy que fala com todo mundo, uma camada interna que ninguém alcança de fora.' },
      {
        code: [
          'services:',
          '  proxy:',
          '    image: nginx:alpine',
          '    ports:',
          '      - "8082:80"',
          '    networks: [publica, privada]',
          '  api:',
          '    image: nginx:alpine',
          '    networks: [privada]',
          '  db:',
          '    image: mariadb:11.4',
          '    networks: [privada]',
          '',
          'networks:',
          '  publica:',
          '  privada:'
        ], run: false, lang: 'yaml'
      },
      {
        ascii: `      internet / servidor
              │  :8082
      ┌───────▼────────┐
      │     proxy      │  (publica + privada)
      └───────┬────────┘
      ────────┼──────── rede "privada"
         ┌────▼───┐   ┌────────┐
         │  api   │──▶│   db   │
         └────────┘   └────────┘
      nenhum dos dois publica porta
`
      },
      { p: 'Nenhum <code>-p</code> em <code>api</code> e <code>db</code>. Eles continuam perfeitamente alcançáveis pelo <code>proxy</code> — e completamente inalcançáveis de fora do servidor. Essa é a diferença entre uma stack e uma stack segura.' },

      { h2: 'Volumes nomeados no Compose' },
      { p: 'Um volume declarado no bloco <code>volumes:</code> do fim do arquivo é criado pelo Compose com o prefixo do projeto e sobrevive ao <code>down</code>.' },
      {
        code: [
          'services:',
          '  db:',
          '    image: mariadb:11.4',
          '    volumes:',
          '      - dados:/var/lib/mysql        # volume nomeado',
          '      - ./init:/docker-entrypoint-initdb.d:ro   # bind mount, só leitura',
          '',
          'volumes:',
          '  dados:'
        ], run: false, lang: 'yaml'
      },
      {
        table: {
          head: ['Forma', 'Onde os dados ficam', 'Use para'],
          rows: [
            ['<code>- dados:/var/lib/mysql</code>', 'volume gerenciado pelo Docker', 'dados de banco, uploads — tudo que o container gera'],
            ['<code>- ./site:/usr/share/nginx/html</code>', 'pasta do projeto, no servidor', 'código e arquivos que <em>você</em> edita'],
            ['<code>- ./conf.d:/etc/nginx/conf.d:ro</code>', 'idem, mas o container não pode escrever', 'arquivos de configuração']
          ]
        }
      },
      {
        box: 'warn', label: 'Caminho relativo é relativo ao arquivo', body: [
          { p: 'Em um bind mount, <code>./site</code> significa "a pasta <code>site</code> ao lado do <code>compose.yaml</code>" — não a pasta onde você estava quando digitou o comando. Sempre comece com <code>./</code>: um caminho sem <code>./</code> e sem <code>/</code> é interpretado como <strong>nome de volume</strong>, e o Docker vai criar um volume vazio em vez de montar sua pasta.' }
        ]
      },

      { h2: 'A stack completa' },
      { p: 'Juntando tudo: um site servido pelo Nginx com arquivos vindos do servidor, um banco com dados persistentes e um Adminer para olhar o banco pelo navegador.' },
      {
        code: [
          'services:',
          '  site:',
          '    image: nginx:alpine',
          '    restart: unless-stopped',
          '    ports:',
          '      - "8083:80"',
          '    volumes:',
          '      - ./publico:/usr/share/nginx/html:ro',
          '',
          '  db:',
          '    image: mariadb:11.4',
          '    restart: unless-stopped',
          '    environment:',
          '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
          '      MARIADB_DATABASE: loja',
          '    volumes:',
          '      - dados:/var/lib/mysql',
          '',
          '  adminer:',
          '    image: adminer:5',
          '    restart: unless-stopped',
          '    ports:',
          '      - "8084:8080"',
          '',
          'volumes:',
          '  dados:'
        ], run: false, lang: 'yaml'
      },
      { p: 'O <code>adminer</code> vai perguntar o servidor de banco. A resposta é <code>db</code> — o nome do serviço. Ele não sabe nem precisa saber o IP.' }
    ],
    tasks: [
      {
        id: 'td11-2-a', kind: 'guiado', title: 'Monte duas redes e veja quem se alcança',
        body: [
          { p: 'Crie esta stack, com um proxy exposto e um banco que só a rede interna alcança:' },
          {
            code: [
              '$ mkdir -p ~/redes && cd ~/redes',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  proxy:',
              '    image: nginx:alpine',
              '    ports:',
              '      - "8122:80"',
              '    networks: [publica, privada]',
              '  api:',
              '    image: nginx:alpine',
              '    networks: [privada]',
              '  db:',
              '    image: mariadb:11.4',
              '    environment:',
              '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
              '    networks: [privada]',
              '',
              'networks:',
              '  publica:',
              '  privada:',
              'EOF',
              '$ docker compose up -d',
              '$ docker compose exec api getent hosts db',
              '$ curl -s -o /dev/null -w "%{http_code}\\n" http://localhost:8122/'
            ]
          },
          { p: 'O <code>db</code> não publica porta nenhuma, e mesmo assim a <code>api</code> o alcança pelo nome — porque as duas estão na rede <code>privada</code>.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código.'],
        check: async (ctx) => {
          const proxy = D.doProjeto(ctx, 'redes', 'proxy');
          const api = D.doProjeto(ctx, 'redes', 'api');
          const db = D.doProjeto(ctx, 'redes', 'db');
          let resolveu = { status: 1, out: '' };
          if (api && api.rodando) resolveu = await D.exec(ctx, api.nome, 'getent hosts db');
          return H.checkAll([
            [() => proxy && proxy.rodando, 'Suba a stack com <code>docker compose up -d</code> dentro de <code>~/redes</code>.'],
            [() => D.publicada(ctx, proxy.nome, 8122), 'A porta 8122 não está publicada pelo <code>proxy</code>.'],
            [() => api && api.rodando && db && db.rodando, 'Os serviços <code>api</code> e <code>db</code> também precisam estar de pé.'],
            [() => db.portas.length === 0, 'O <code>db</code> não deve publicar porta nenhuma no servidor.'],
            [() => resolveu.status === 0 && /\d+\.\d+\.\d+\.\d+/.test(resolveu.out),
              'Rode <code>docker compose exec api getent hosts db</code> depois de a stack subir, para ver o nome resolvendo.']
          ]);
        }
      },
      {
        id: 'td11-2-q', kind: 'quiz', title: 'O banco sem porta publicada',
        body: [
          { p: 'No <code>compose.yaml</code> da aula, o serviço <code>db</code> não tem <code>ports</code>. Um colega diz que, por isso, a <code>api</code> não vai conseguir se conectar ao banco. Ele está certo?' }
        ],
        options: [
          { text: 'Não. Dentro da rede do projeto, a <code>api</code> alcança o <code>db</code> pelo nome do serviço e pela porta interna, sem precisar de porta publicada — publicar só serviria para acesso de <strong>fora</strong> do Docker.', correct: true },
          { text: 'Sim: sem <code>ports</code>, nenhum outro container alcança o <code>db</code>.', why: '<code>ports</code> só cria um mapeamento entre uma porta do servidor e a porta interna. A comunicação entre containers da mesma rede não passa por ali.' },
          { text: 'Sim, mas resolve com <code>--network host</code> no <code>db</code>.', why: '<code>host</code> faria o <code>db</code> usar a pilha de rede do servidor — o oposto do que se quer aqui, e ele deixaria de ter um nome de serviço para resolver.' },
          { text: 'Não, mas só funciona se o <code>db</code> tiver <code>container_name</code> definido.', why: 'O DNS do Docker resolve pelo <strong>nome do serviço</strong>, que já existe independente de <code>container_name</code>.' }
        ],
        hints: ['Releia a caixa "Repita até virar automático": o que entra na conta é nome do serviço + porta interna.'],
        explain: 'Portas publicadas (<code>-p</code>/<code>ports</code>) só importam para quem está <strong>fora</strong> da rede do Docker. Entre containers da mesma stack, o nome do serviço já resolve pela rede interna — por isso o <code>db</code> desta aula fica seguro sem publicar porta nenhuma.'
      },
      {
        id: 'td11-2-b', kind: 'desafio', title: 'Monte a stack com banco isolado',
        body: [
          { p: 'Na pasta <code>~/stack</code>, escreva um <code>compose.yaml</code> com três serviços:' },
          { ul: [
            '<code>site</code> — imagem <code>nginx:alpine</code>, publicando a porta <strong>8085</strong> do servidor na 80;',
            '<code>db</code> — imagem <code>mariadb:11.4</code>, com <code>MARIADB_ROOT_PASSWORD</code> valendo <code>SENHA_DO_BANCO</code> e <code>MARIADB_DATABASE</code> valendo <code>loja</code>, guardando os dados em um <strong>volume nomeado</strong> chamado <code>dados</code> montado em <code>/var/lib/mysql</code>, e <strong>sem publicar porta nenhuma</strong>;',
            '<code>admin</code> — imagem <code>adminer:5</code>, publicando a porta <strong>8086</strong> do servidor na 8080.'
          ] },
          { p: 'Os três com <code>restart: unless-stopped</code>. Suba a stack e confirme que <code>http://localhost:8085/</code> e <code>http://localhost:8086/</code> respondem.' },
          { p: 'Depois, de dentro do <code>admin</code>, prove que o banco é alcançável pelo nome.' }
        ],
        hints: [
          'O volume precisa aparecer em dois lugares: na lista <code>volumes:</code> do serviço <code>db</code> e no bloco <code>volumes:</code> do fim do arquivo (com um <code>dados:</code> e nada mais).',
          'Para provar o alcance pelo nome, um container da stack resolve o outro pelo DNS do Docker: <code>docker compose exec admin getent hosts db</code>.'
        ],
        solution: '<pre>$ mkdir -p ~/stack\n$ cd ~/stack\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8085:80"\n\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: loja\n    volumes:\n      - dados:/var/lib/mysql\n\n  admin:\n    image: adminer:5\n    restart: unless-stopped\n    ports:\n      - "8086:8080"\n\nvolumes:\n  dados:\nEOF\n$ docker compose up -d\n$ docker compose ps\n$ docker compose exec admin getent hosts db\n$ curl -s -o /dev/null -w "%{http_code}\\n" http://localhost:8085/</pre>',
        check: async (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/stack/compose.yaml');
          const site = D.doProjeto(ctx, 'stack', 'site');
          const db = D.doProjeto(ctx, 'stack', 'db');
          const admin = D.doProjeto(ctx, 'stack', 'admin');
          let resolveu = { status: 1, out: '' };
          if (admin && admin.rodando) resolveu = await D.exec(ctx, admin.nome, 'getent hosts db');
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/stack/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => db && db.rodando, 'O serviço <code>db</code> não está rodando.'],
            [() => admin && admin.rodando, 'O serviço <code>admin</code> não está rodando.'],
            [() => D.publicada(ctx, site.nome, 8085), 'O <code>site</code> não está publicando a porta 8085.'],
            [() => D.publicada(ctx, admin.nome, 8086), 'O <code>admin</code> não está publicando a porta 8086.'],
            [() => db.portas.length === 0,
              'O <code>db</code> está publicando porta no servidor. Um banco de uma stack não precisa disso: tire o <code>ports</code> dele.'],
            [() => D.env(ctx, db.nome, 'MARIADB_DATABASE') === 'loja', 'Falta <code>MARIADB_DATABASE: loja</code> no <code>db</code>.'],
            [() => !!D.env(ctx, db.nome, 'MARIADB_ROOT_PASSWORD'), 'Falta <code>MARIADB_ROOT_PASSWORD</code> no <code>db</code>.'],
            [() => { const mo = D.montagem(ctx, db.nome, '/var/lib/mysql'); return !!mo && mo.tipo === 'volume'; },
              'O <code>/var/lib/mysql</code> do banco precisa estar em um volume nomeado.'],
            [() => { const mo = D.montagem(ctx, db.nome, '/var/lib/mysql'); return !!mo && /(^|[/_])stack_dados([/_]|$)/.test(String(mo.nome || mo.origem)); },
              () => 'O volume montado é <code>' + ((D.montagem(ctx, db.nome, '/var/lib/mysql') || {}).nome || (D.montagem(ctx, db.nome, '/var/lib/mysql') || {}).origem) + '</code>. O enunciado pede um volume nomeado <code>dados</code>, que o Compose cria como <code>stack_dados</code>.'],
            [() => D.volume(ctx, 'stack_dados'), 'O volume <code>stack_dados</code> não existe. Declare <code>dados:</code> no bloco <code>volumes:</code> do fim do arquivo.'],
            [() => [site, db, admin].every(c => c.restart && c.restart.politica === 'unless-stopped'),
              'Os três serviços precisam de <code>restart: unless-stopped</code>.'],
            [() => { const r = D.http(ctx, 'localhost', 8085, '/'); return !!r && r.status === 200; }, 'A porta 8085 não respondeu.'],
            [() => { const r = D.http(ctx, 'localhost', 8086, '/'); return !!r && r.status === 200; }, 'A porta 8086 não respondeu.'],
            [() => resolveu.status === 0 && /\d+\.\d+\.\d+\.\d+/.test(resolveu.out),
              'De dentro do <code>admin</code>, o nome <code>db</code> não resolveu. Os três serviços estão no mesmo projeto?']
          ]);
        }
      },

    ]
  });

  /* ============================== 11.3 ============================== */
  LX.lesson('d11', {
    id: 'ld11-3', n: '11.3', title: 'O dia a dia: alterar, recriar, derrubar',
    goal: 'Aplicar mudanças com segurança e saber exatamente qual comando apaga dados e qual não apaga.',
    setup: (m, term) => {
      D.pasta(m, '/home/aluno/dia');
      D.arquivo(m, '/home/aluno/dia/compose.yaml',
        'services:\n' +
        '  web:\n' +
        '    image: nginx:alpine\n' +
        '    ports:\n' +
        '      - "8091:80"\n' +
        '  guarda:\n' +
        '    image: redis:7-alpine\n' +
        '    volumes:\n' +
        '      - memoria:/data\n' +
        '\n' +
        'volumes:\n' +
        '  memoria:\n');
    },
    body: [
      { h2: 'Editou o arquivo? Rode <code>up -d</code> de novo' },
      { p: 'É esse o ciclo. Você não derruba a stack para mudar uma variável: você edita, roda <code>up -d</code>, e o Compose recria <strong>apenas</strong> os containers cuja configuração mudou. Os outros nem piscam.' },
      {
        code: [
          'docker compose up -d          # aplica o que mudou',
          'docker compose up -d web      # aplica só nesse serviço (e nas dependências)',
          'docker compose up -d --no-deps web   # só nesse, sem tocar nas dependências'
        ], run: false
      },
      {
        table: {
          head: ['Situação', 'Comando', 'O container é recriado?'],
          rows: [
            ['mudou <code>environment</code>, <code>ports</code>, <code>volumes</code>, <code>image</code>…', '<code>up -d</code>', 'sim — configuração nova exige container novo'],
            ['nada mudou', '<code>up -d</code>', 'não'],
            ['quero recriar mesmo assim', '<code>up -d --force-recreate</code>', 'sim'],
            ['só quero reiniciar o processo', '<code>restart</code>', '<strong>não</strong> — mesmo container, PID 1 reiniciado'],
            ['mudei o Dockerfile', '<code>up -d --build</code>', 'sim, e a imagem é reconstruída antes'],
            ['saiu versão nova da imagem', '<code>pull</code> e depois <code>up -d</code>', 'sim']
          ]
        }
      },
      {
        box: 'key', label: '<code>restart</code> não aplica mudanças', body: [
          { p: 'Erro clássico: mudar uma variável de ambiente no arquivo e rodar <code>docker compose restart</code>. O container é o mesmo — variáveis de ambiente são definidas na <strong>criação</strong>. O processo reinicia com a configuração velha e você fica achando que o Docker está louco. Para aplicar mudança de arquivo, é sempre <code>up -d</code>.' }
        ]
      },

      { h2: 'Os três jeitos de parar, e o que cada um destrói' },
      {
        table: {
          head: ['Comando', 'Containers', 'Rede do projeto', 'Volumes nomeados', 'Dados'],
          rows: [
            ['<code>stop</code>', 'parados, ainda existem', 'fica', 'ficam', 'intactos'],
            ['<code>down</code>', '<strong>removidos</strong>', '<strong>removida</strong>', 'ficam', 'intactos'],
            ['<code>down -v</code>', '<strong>removidos</strong>', '<strong>removida</strong>', '<strong>REMOVIDOS</strong>', '<strong>APAGADOS</strong>']
          ]
        }
      },
      {
        box: 'warn', label: 'O que <code>docker compose down -v</code> faz de verdade', body: [
          { p: 'O <code>-v</code> (de <em>volumes</em>) apaga os volumes nomeados declarados no arquivo. Em uma stack com banco de dados, isso significa <strong>apagar o banco inteiro</strong>: tabelas, registros, usuários. Não existe lixeira, não existe desfazer.' },
          { p: 'Ele é útil e legítimo — em ambiente de desenvolvimento, quando você quer voltar ao estado zero. Em servidor, pense duas vezes, confira em que pasta você está e confira se existe backup. A quantidade de bancos de produção perdidos por um <code>down -v</code> digitado na janela errada é grande.' },
          { p: 'A versão sem susto para "quero desligar isso agora": <code>docker compose down</code>, sem o <code>-v</code>. Ou <code>docker compose stop</code>, que nem remove os containers.' }
        ]
      },

      { h2: 'Olhar para dentro' },
      {
        table: {
          head: ['Comando', 'Para quê'],
          rows: [
            ['<code>docker compose logs -f</code>', 'seguir todos os serviços ao vivo'],
            ['<code>docker compose logs --tail 50 db</code>', 'as últimas 50 linhas de um serviço só'],
            ['<code>docker compose ps</code>', 'estado e portas dos serviços do projeto'],
            ['<code>docker compose top</code>', 'processos rodando dentro de cada container'],
            ['<code>docker compose exec web sh</code>', 'shell dentro de um container <strong>que já está rodando</strong>'],
            ['<code>docker compose run --rm web sh</code>', 'container <strong>novo e descartável</strong> a partir do mesmo serviço'],
            ['<code>docker compose config</code>', 'o arquivo final, com variáveis resolvidas'],
            ['<code>docker compose config --services</code>', 'só a lista de nomes de serviço']
          ]
        }
      },
      {
        box: 'note', label: '<code>exec</code> ou <code>run</code>?', body: [
          { p: '<code>exec</code> entra no container que está de pé — é o que você quer para investigar um problema acontecendo agora. <code>run</code> cria outro container do mesmo serviço, com a mesma imagem e rede; use quando precisa rodar uma tarefa avulsa (uma migração, um <em>dump</em>) sem incomodar o que está no ar. Com <code>--rm</code>, ele some ao terminar.' }
        ]
      },

      { h2: 'Praticando o ciclo' },
      { p: 'A pasta <code>~/dia</code> já tem uma stack pronta com dois serviços. Suba e experimente:' },
      {
        code: [
          '$ cd ~/dia',
          '$ docker compose up -d',
          '$ docker compose ps',
          '$ docker compose logs --tail 5',
          '$ docker compose exec guarda sh -c "echo lembranca > /data/nota.txt"',
          '$ docker compose exec guarda cat /data/nota.txt',
          '$ docker compose down',
          '$ docker compose up -d',
          '$ docker compose exec guarda cat /data/nota.txt'
        ], run: true
      },
      { p: 'O arquivo continua lá depois do <code>down</code> e do <code>up</code>: ele está no volume <code>dia_memoria</code>, não no container. É exatamente essa a diferença entre <code>down</code> e <code>down -v</code>.' }
    ],
    tasks: [
      {
        id: 'td11-3-a', kind: 'guiado', title: 'Grave um dado, derrube e suba de novo',
        body: [
          { p: 'A pasta <code>~/dia</code> já tem uma stack pronta. Suba, grave algo no <code>guarda</code>, derrube a stack e suba de novo:' },
          {
            code: [
              '$ cd ~/dia',
              '$ docker compose up -d',
              '$ docker compose ps',
              '$ docker compose logs --tail 5',
              '$ docker compose exec guarda sh -c "echo lembranca > /data/nota.txt"',
              '$ docker compose exec guarda cat /data/nota.txt',
              '$ docker compose down',
              '$ docker compose up -d',
              '$ docker compose exec guarda cat /data/nota.txt'
            ]
          },
          { p: 'O arquivo continua lá depois do <code>down</code> e do <code>up</code>: ele está no volume <code>dia_memoria</code>, não no container.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código, na ordem em que aparece.'],
        check: (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up\s+-d/), 'Suba a stack primeiro, com <code>docker compose up -d</code>.'],
          [() => H.usedCommand(ctx, /docker\s+compose\s+exec\s+guarda\s+sh\s+-c\s+"echo\s+lembranca/), 'Grave o arquivo com <code>docker compose exec guarda sh -c "echo lembranca &gt; /data/nota.txt"</code>.'],
          [() => H.usedCommand(ctx, /docker\s+compose\s+down\s*$/), 'Derrube a stack com <code>docker compose down</code> — sem <code>-v</code>.'],
          [() => H.usedCommand(ctx, /docker\s+compose\s+exec\s+guarda\s+cat\s+\/data\/nota\.txt/), 'Depois de subir de novo, confira o arquivo com <code>docker compose exec guarda cat /data/nota.txt</code>.']
        ])
      },
      {
        id: 'td11-3-q', kind: 'quiz', title: 'O comando que apaga o banco',
        body: [
          { p: 'Você está em um servidor, na pasta de uma stack em produção com um MariaDB usando um volume nomeado. Precisa desligar a stack por uma hora para uma manutenção elétrica, sem perder nada. Qual comando?' }
        ],
        options: [
          { text: '<code>docker compose stop</code> — para os containers e não remove nada; depois <code>docker compose start</code> traz tudo de volta.', correct: true },
          { text: '<code>docker compose down -v</code> — o <code>-v</code> é de "verbose", mostra mais detalhes durante a parada.', why: 'Perigoso: o <code>-v</code> é de <em>volumes</em> e remove os volumes nomeados da stack. Nesse cenário, apagaria o banco.' },
          { text: '<code>docker compose down</code> — é o oposto do <code>up</code>, então é o comando certo.', why: 'Não apaga dados (os volumes ficam), então não é catastrófico — mas remove containers e rede sem necessidade. Para uma pausa curta, <code>stop</code> é mais direto e mais rápido de reverter.' },
          { text: '<code>docker compose kill</code> — encerra imediatamente.', why: 'Mata os processos com SIGKILL, sem dar chance de encerramento limpo. Em banco de dados, é o caminho mais curto para corrupção de dados.' }
        ],
        hints: ['A pergunta é: quem remove volumes? E quem apenas para?'],
        explain: '<code>docker compose stop</code> para os containers preservando containers, rede e volumes; <code>docker compose start</code> retoma. <code>down</code> remove containers e rede (dados ficam). <strong><code>down -v</code> remove os volumes nomeados e apaga os dados</strong> — nunca em produção sem backup e sem certeza absoluta.'
      },
      {
        id: 'td11-3-b', kind: 'desafio', title: 'Aplique uma mudança sem derrubar tudo',
        body: [
          { p: 'Na stack de <code>~/dia</code>, faça duas mudanças e aplique-as:' },
          { ol: [
            'o serviço <code>web</code> deve passar a publicar a porta <strong>8092</strong> (em vez da 8091), continuando na 80 do container;',
            'o serviço <code>web</code> deve ganhar uma variável de ambiente <code>AMBIENTE</code> com o valor <code>homologacao</code>.'
          ] },
          { p: 'Ao final: a 8092 responde, a 8091 não responde mais, a variável está de fato <strong>dentro</strong> do container, e o container do <code>guarda</code> precisa continuar com o arquivo <code>/data/nota.txt</code> que você criou — ou seja, nada de <code>down -v</code>.' }
        ],
        hints: [
          'Edite o <code>compose.yaml</code> e rode <code>docker compose up -d</code>. O Compose vai recriar só o <code>web</code>.',
          'Se você mudou o arquivo e nada aconteceu, você provavelmente rodou <code>restart</code>. Variáveis de ambiente só entram na criação do container — use <code>up -d</code>.',
          'Para conferir de dentro: <code>docker compose exec web env | grep AMBIENTE</code>.'
        ],
        solution: '<pre>$ cd ~/dia\n$ docker compose up -d\n$ docker compose exec guarda sh -c "echo lembranca &gt; /data/nota.txt"\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8092:80"\n    environment:\n      AMBIENTE: homologacao\n  guarda:\n    image: redis:7-alpine\n    volumes:\n      - memoria:/data\n\nvolumes:\n  memoria:\nEOF\n$ docker compose up -d\n$ docker compose ps\n$ docker compose exec web env | grep AMBIENTE\n$ docker compose exec guarda cat /data/nota.txt</pre>',
        check: async (ctx) => {
          const web = D.doProjeto(ctx, 'dia', 'web');
          const guarda = D.doProjeto(ctx, 'dia', 'guarda');
          let dentro = { status: 1, out: '' };
          if (web && web.rodando) dentro = await D.exec(ctx, web.nome, 'printenv AMBIENTE');
          return H.checkAll([
            [() => web && web.rodando, 'O serviço <code>web</code> do projeto <code>dia</code> não está rodando.'],
            [() => D.publicada(ctx, web.nome, 8092), 'A porta 8092 ainda não está publicada pelo <code>web</code>.'],
            [() => !D.publicada(ctx, web.nome, 8091), 'A porta 8091 continua publicada. A mudança troca a porta, não acrescenta uma segunda.'],
            [() => { const r = D.http(ctx, 'localhost', 8092, '/'); return !!r && r.status === 200; }, 'A porta 8092 não respondeu.'],
            [() => !D.http(ctx, 'localhost', 8091, '/'), 'A porta 8091 ainda responde — o container antigo continua de pé?'],
            [() => dentro.status === 0 && dentro.out.trim() === 'homologacao',
              () => 'Dentro do container, <code>AMBIENTE</code> não vale <code>homologacao</code> (li: <code>' + dentro.out.trim() + '</code>). Se você editou o arquivo e rodou <code>restart</code>, a variável não foi aplicada: use <code>up -d</code>.'],
            [() => guarda && guarda.rodando, 'O serviço <code>guarda</code> precisa continuar de pé.'],
            [() => D.existeNoContainer(ctx, guarda ? guarda.nome : '', '/data/nota.txt'),
              'O arquivo <code>/data/nota.txt</code> sumiu. Crie-o como mostra a aula e aplique a mudança sem apagar o volume (nada de <code>down -v</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 11.4 ============================== */
  LX.lesson('d11', {
    id: 'ld11-4', n: '11.4', title: 'Build, sobreposição e perfis',
    goal: 'Construir imagem a partir do próprio projeto, mudar a stack por ambiente sem duplicar arquivo e ligar serviços opcionais.',
    body: [
      { h2: 'Quando a imagem é sua: <code>build</code>' },
      { p: 'Até agora todo serviço usava uma imagem pronta. Quando a imagem é do seu projeto, troque <code>image:</code> por <code>build:</code> — ou use os dois.' },
      {
        code: [
          'services:',
          '  api:',
          '    build: .                 # forma curta: Dockerfile na pasta do projeto',
          '',
          '  worker:',
          '    build:                   # forma longa',
          '      context: ./worker',
          '      dockerfile: Dockerfile.prod',
          '      args:',
          '        VERSAO: "2.1"',
          '    image: minha-api:local   # nome que a imagem construída recebe'
        ], run: false, lang: 'yaml'
      },
      {
        table: {
          head: ['Comando', 'O que faz com o build'],
          rows: [
            ['<code>up -d</code>', 'constrói só se a imagem <strong>ainda não existir</strong>'],
            ['<code>up -d --build</code>', 'constrói sempre, antes de subir — é o que você usa depois de mexer no código'],
            ['<code>build</code>', 'só constrói, não sobe nada'],
            ['<code>build --no-cache</code>', 'constrói ignorando o cache de camadas']
          ]
        }
      },
      {
        box: 'warn', label: 'A pegadinha do <code>up -d</code> sem <code>--build</code>', body: [
          { p: 'Você muda o código, roda <code>docker compose up -d</code>, e o comportamento continua o antigo. Motivo: a imagem já existia, então o Compose não reconstruiu nada. Depois de mexer em código ou Dockerfile, é <code>up -d --build</code>.' }
        ]
      },

      { h2: 'Sobreposição: um arquivo base, um por ambiente' },
      { p: 'Se existir um <code>compose.override.yaml</code> ao lado do <code>compose.yaml</code>, o Compose carrega os dois automaticamente e funde: o que estiver no override <strong>vence</strong>.' },
      {
        code: [
          '# compose.yaml — o que vale em qualquer lugar',
          'services:',
          '  site:',
          '    image: nginx:alpine',
          '    restart: unless-stopped'
        ], run: false, lang: 'yaml'
      },
      {
        code: [
          '# compose.override.yaml — o que só vale na sua máquina',
          'services:',
          '  site:',
          '    ports:',
          '      - "8093:80"',
          '    volumes:',
          '      - ./publico:/usr/share/nginx/html:ro'
        ], run: false, lang: 'yaml'
      },
      { p: 'Na sua máquina, <code>docker compose up -d</code> junta os dois. No servidor, onde o override não existe, o mesmo <code>compose.yaml</code> sobe sem a porta de desenvolvimento e sem o bind mount do código.' },
      { p: 'Para escolher a combinação explicitamente, liste os arquivos na ordem — o último vence:' },
      {
        code: [
          'docker compose -f compose.yaml -f compose.prod.yaml up -d',
          'docker compose -f compose.yaml -f compose.prod.yaml config   # confira antes!'
        ], run: false
      },
      {
        box: 'key', label: 'Como a fusão trata listas', body: [
          { p: 'Mapas são fundidos chave a chave: um <code>environment</code> no override acrescenta variáveis sem apagar as do base. <strong>Listas são substituídas por inteiro</strong>: um <code>ports</code> no override troca a lista inteira, não acrescenta um item. É a fonte de surpresa mais comum com sobreposição — na dúvida, <code>docker compose config</code> mostra o resultado real.' }
        ]
      },

      { h2: 'Perfis: serviços que só sobem quando você pede' },
      { p: 'Nem todo serviço da stack precisa subir sempre. Um Adminer, um <em>seed</em> de banco, uma ferramenta de depuração: úteis às vezes, peso morto no resto do tempo. É para isso que existem os perfis.' },
      {
        code: [
          'services:',
          '  site:',
          '    image: nginx:alpine',
          '    ports:',
          '      - "8094:80"',
          '',
          '  admin:',
          '    image: adminer:5',
          '    profiles: [ferramentas]',
          '    ports:',
          '      - "8095:8080"'
        ], run: false, lang: 'yaml'
      },
      {
        code: [
          'docker compose up -d                        # sobe só o site',
          'docker compose --profile ferramentas up -d  # sobe o site e o admin',
          'docker compose --profile ferramentas down   # e derruba os dois'
        ], run: false
      },
      { p: 'Um serviço <strong>sem</strong> <code>profiles</code> sobe sempre. Um serviço com perfil só sobe quando aquele perfil é pedido — pela flag ou pela variável <code>COMPOSE_PROFILES</code>.' },
      {
        box: 'note', label: 'Cuidado ao derrubar', body: [
          { p: 'O <code>down</code> sem o perfil não remove os containers do perfil. Se você subiu com <code>--profile ferramentas</code>, derrube com <code>--profile ferramentas</code> também — ou eles ficam rodando sozinhos, órfãos da stack.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td11-4-a', kind: 'guiado', title: 'Veja a sobreposição se fundir',
        body: [
          { p: 'Crie um projeto com um arquivo base e um de sobreposição:' },
          {
            code: [
              '$ mkdir -p ~/sobre && cd ~/sobre',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  site:',
              '    image: nginx:alpine',
              '    restart: unless-stopped',
              'EOF',
              '$ cat > compose.override.yaml <<\'EOF\'',
              'services:',
              '  site:',
              '    ports:',
              '      - "8124:80"',
              'EOF',
              '$ docker compose config',
              '$ docker compose up -d',
              '$ curl -s -o /dev/null -w "%{http_code}\\n" http://localhost:8124/'
            ]
          },
          { p: 'O <code>docker compose config</code> mostra o resultado já fundido: <code>restart</code> veio do arquivo base, <code>ports</code> veio do override.' }
        ],
        hints: ['Os dois arquivos ficam lado a lado na mesma pasta; com esses nomes exatos, o Compose junta os dois sozinho.'],
        check: (ctx) => {
          const site = D.doProjeto(ctx, 'sobre', 'site');
          return H.checkAll([
            [() => H.usedCommand(ctx, /docker\s+compose\s+config/), 'Rode <code>docker compose config</code> para ver a fusão antes de subir.'],
            [() => site && site.rodando, 'Suba a stack com <code>docker compose up -d</code> dentro de <code>~/sobre</code>.'],
            [() => D.publicada(ctx, site.nome, 8124), 'A porta 8124 (que vem do override) não está publicada.'],
            [() => { const r = D.http(ctx, 'localhost', 8124, '/'); return !!r && r.status === 200; }, 'A porta 8124 não respondeu.']
          ]);
        }
      },
      {
        id: 'td11-4-q', kind: 'quiz', title: 'Mudei o código e nada mudou',
        body: [
          { p: 'Um serviço usa <code>build: .</code>. Você edita o código, roda <code>docker compose up -d</code>, e o comportamento continua o antigo. O que aconteceu?' }
        ],
        options: [
          { text: 'A imagem já existia, então o Compose não construiu de novo — <code>up -d</code> só constrói o que ainda não existe. Depois de mexer em código ou Dockerfile, é <code>docker compose up -d --build</code>.', correct: true },
          { text: 'O <code>compose.yaml</code> tem algum erro de sintaxe.', why: 'Se o YAML estivesse errado, o <code>up</code> teria falhado com uma mensagem — não teria subido normalmente com o comportamento antigo.' },
          { text: 'Falta rodar <code>docker compose restart</code>.', why: '<code>restart</code> reinicia o processo do mesmo container, com a mesma imagem. Não reconstrói nada.' },
          { text: 'É preciso <code>docker compose down -v</code> antes de subir de novo.', why: 'O <code>-v</code> apaga volumes — não tem relação com a imagem ser reconstruída, e arrisca apagar dados à toa.' }
        ],
        hints: ['Releia a tabela: o que cada comando de build faz.'],
        explain: '<code>up -d</code> sozinho só constrói se a imagem ainda não existir. Depois de mudar código ou Dockerfile, use <code>docker compose up -d --build</code>, que reconstrói a imagem antes de subir.'
      },
      {
        id: 'td11-4-b', kind: 'desafio', title: 'Base, override e um serviço opcional',
        body: [
          { p: 'Monte em <code>~/ambientes</code> um projeto com <strong>dois</strong> arquivos:' },
          { ul: [
            '<code>compose.yaml</code> — um serviço <code>site</code> com a imagem <code>nginx:alpine</code> e <code>restart: unless-stopped</code>, <strong>sem</strong> publicar porta; e um serviço <code>admin</code> com a imagem <code>adminer:5</code> no perfil <code>ferramentas</code>, publicando a porta <strong>8097</strong> na 8080;',
            '<code>compose.override.yaml</code> — acrescenta ao <code>site</code> a publicação da porta <strong>8096</strong> na 80.'
          ] },
          { p: 'Suba a stack de modo que <strong>o <code>site</code> esteja no ar na 8096 e o <code>admin</code> NÃO tenha subido</strong>. Depois confirme com <code>docker compose config</code> que a fusão dos dois arquivos resultou no que você esperava.' }
        ],
        hints: [
          'Os dois arquivos ficam lado a lado na mesma pasta. Com esses nomes exatos, o Compose junta os dois sozinho — você roda <code>docker compose up -d</code> normalmente.',
          'Para o <code>admin</code> não subir, basta <strong>não</strong> passar <code>--profile ferramentas</code>. Se ele já subiu, derrube com <code>docker compose --profile ferramentas down</code> e suba de novo sem o perfil.'
        ],
        solution: '<pre>$ mkdir -p ~/ambientes\n$ cd ~/ambientes\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n\n  admin:\n    image: adminer:5\n    profiles:\n      - ferramentas\n    ports:\n      - "8097:8080"\nEOF\n$ cat &gt; compose.override.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    ports:\n      - "8096:80"\nEOF\n$ docker compose config\n$ docker compose up -d\n$ docker compose ps</pre>',
        check: (ctx) => {
          const base = D.compose(ctx, '/home/aluno/ambientes/compose.yaml');
          const over = D.compose(ctx, '/home/aluno/ambientes/compose.override.yaml');
          const site = D.doProjeto(ctx, 'ambientes', 'site');
          const admin = D.doProjeto(ctx, 'ambientes', 'admin');
          return H.checkAll([
            [() => base !== null, 'Não encontrei <code>~/ambientes/compose.yaml</code>.'],
            [() => over !== null, 'Não encontrei <code>~/ambientes/compose.override.yaml</code>.'],
            [() => !(base && base.erroYaml) && !(over && over.erroYaml),
              () => 'Um dos arquivos tem YAML inválido: <code>' + ((base && base.erroYaml) || (over && over.erroYaml)) + '</code>'],
            [() => base.services && base.services.site && base.services.admin,
              'O <code>compose.yaml</code> precisa descrever os dois serviços, <code>site</code> e <code>admin</code>.'],
            [() => !base.services.site.ports,
              'No <code>compose.yaml</code>, o <code>site</code> não deve publicar porta: essa parte é do arquivo de sobreposição.'],
            [() => [].concat(base.services.admin.profiles || []).includes('ferramentas'),
              'O serviço <code>admin</code> precisa estar no perfil <code>ferramentas</code>.'],
            [() => over.services && over.services.site && [].concat(over.services.site.ports || []).length === 1,
              'O <code>compose.override.yaml</code> precisa acrescentar a publicação de porta ao <code>site</code>.'],
            [() => site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => D.publicada(ctx, site.nome, 8096),
              'O <code>site</code> não está publicando a 8096 — sinal de que a sobreposição não foi aplicada. Confira o nome do arquivo: <code>compose.override.yaml</code>.'],
            [() => { const r = D.http(ctx, 'localhost', 8096, '/'); return !!r && r.status === 200; }, 'A porta 8096 não respondeu.'],
            [() => !admin || !admin.rodando,
              'O <code>admin</code> subiu. Ele está em um perfil e só deve subir quando o perfil for pedido — derrube com <code>docker compose --profile ferramentas down</code> e suba sem o perfil.']
          ]);
        }
      },

    ]
  });
})();
