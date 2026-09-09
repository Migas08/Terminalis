/* =========================================================================
   MÓDULO D12 — Ambiente e segredos
   Duas coisas com o mesmo nome: variável que o ARQUIVO usa e variável que o
   CONTAINER recebe. E o que nunca deve entrar no Git.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 12.1 ============================== */
  LX.lesson('d12', {
    id: 'ld12-1', n: '12.1', title: 'Variáveis: as duas que se confundem',
    goal: 'Separar interpolação (o arquivo) de ambiente (o container) e parametrizar uma stack com .env.',
    body: [
      { h2: 'Existem duas variáveis, e elas não são a mesma coisa' },
      { p: 'Esta é a confusão que faz gente rodar em círculos por horas. As duas se escrevem quase igual e vivem no mesmo arquivo, mas fazem coisas diferentes em momentos diferentes.' },
      {
        table: {
          head: ['', 'Interpolação', 'Ambiente do container'],
          rows: [
            ['Como aparece', '<code>ports: ["${PORTA}:80"]</code>', '<code>environment:</code><br><code>&nbsp;&nbsp;PORTA: 8080</code>'],
            ['Quem lê', 'o <strong>Compose</strong>, antes de qualquer container existir', 'o <strong>processo dentro do container</strong>'],
            ['De onde vem o valor', 'do <code>.env</code> e do seu shell', 'do que o <code>compose.yaml</code> declarar'],
            ['Quando é resolvido', 'ao ler o arquivo', 'na criação do container'],
            ['Como conferir', '<code>docker compose config</code>', '<code>docker compose exec svc env</code>']
          ]
        }
      },
      {
        ascii: `  .env  +  shell           compose.yaml            container
    │                        │                       │
    └──▶ INTERPOLAÇÃO ──────▶│                       │
         (troca ${'$'}{VAR} no      │                       │
          texto do arquivo)   └── environment: ─────▶│  variáveis
                                                     │  do processo`
      },
      {
        box: 'key', label: 'Regra de bolso', body: [
          { p: 'Se a variável muda <strong>o desenho da stack</strong> (porta publicada, tag da imagem, nome do volume, quantidade de réplicas), ela é de interpolação e vem do <code>.env</code>.' },
          { p: 'Se a variável muda <strong>o comportamento do programa</strong> (senha do banco, modo de depuração, URL de conexão), ela é de ambiente e vai em <code>environment</code> ou <code>env_file</code>.' }
        ]
      },

      { h2: 'O arquivo <code>.env</code>' },
      { p: 'O Compose lê automaticamente um arquivo chamado <code>.env</code> na <strong>pasta do projeto</strong> — a mesma pasta do <code>compose.yaml</code>. Ele é um <code>CHAVE=valor</code> por linha, sem aspas obrigatórias, sem <code>export</code>:' },
      {
        code: [
          '# .env',
          'PORTA_SITE=8101',
          'TAG_NGINX=alpine',
          'NOME_BANCO=loja'
        ], run: false, lang: 'text'
      },
      {
        code: [
          '# compose.yaml',
          'services:',
          '  site:',
          '    image: nginx:${TAG_NGINX}',
          '    ports:',
          '      - "${PORTA_SITE}:80"',
          '  db:',
          '    image: mariadb:11.4',
          '    environment:',
          '      MARIADB_DATABASE: ${NOME_BANCO}',
          '      MARIADB_ROOT_PASSWORD: ${SENHA_DO_BANCO:?defina SENHA_DO_BANCO no .env}'
        ], run: false, lang: 'yaml'
      },
      { p: 'O mesmo arquivo agora serve para desenvolvimento e para produção: o que muda é o <code>.env</code> de cada lugar.' },

      { h2: 'As formas de interpolação' },
      {
        table: {
          head: ['Escrita', 'Se a variável existe', 'Se não existe'],
          rows: [
            ['<code>${VAR}</code>', 'usa o valor', 'usa <strong>vazio</strong> e segue em frente'],
            ['<code>${VAR:-padrao}</code>', 'usa o valor', 'usa <code>padrao</code>'],
            ['<code>${VAR:?mensagem}</code>', 'usa o valor', '<strong>para com erro</strong> e mostra a mensagem'],
            ['<code>${VAR:+valor}</code>', 'usa <code>valor</code>', 'usa vazio'],
            ['<code>$$</code>', '—', 'um <code>$</code> literal, que o Compose não interpreta']
          ]
        }
      },
      {
        box: 'warn', label: 'A forma perigosa é a primeira', body: [
          { p: '<code>${VAR}</code> com a variável ausente vira string vazia <strong>sem avisar</strong>. O resultado é <code>image: nginx:</code>, <code>ports: [":80"]</code> — erros confusos, longe da causa.' },
          { p: 'Para tudo que é obrigatório, use <code>${VAR:?explicação}</code>. O Compose para na hora e diz exatamente qual variável falta. É uma linha a mais que evita meia hora de investigação.' },
          { p: 'Precisa de um <code>$</code> literal no valor (uma senha com <code>$</code>, um <code>$$</code> de shell)? Escreva <code>$$</code>.' }
        ]
      },

      { h2: 'Quem ganha de quem' },
      { p: 'Quando a mesma variável aparece em vários lugares, a ordem de precedência para a <strong>interpolação</strong> é:' },
      {
        ol: [
          'variável exportada no shell onde você rodou o comando (vence tudo);',
          'arquivo apontado por <code>--env-file</code>;',
          'arquivo <code>.env</code> da pasta do projeto.'
        ]
      },
      { p: 'Isso permite sobrepor um valor pontualmente sem editar arquivo nenhum:' },
      {
        code: [
          'PORTA_SITE=9999 docker compose up -d      # só nesta execução',
          'docker compose --env-file .env.prod config'
        ], run: false
      },

      { h2: 'Levando variáveis para dentro do container' },
      {
        table: {
          head: ['Forma', 'O que faz'],
          rows: [
            ['<code>environment:</code> com <code>CHAVE: valor</code>', 'define explicitamente (forma de mapa, a mais legível)'],
            ['<code>environment:</code> com <code>- CHAVE=valor</code>', 'o mesmo, na forma de lista'],
            ['<code>environment:</code> com <code>- CHAVE</code> (sem valor)', '<strong>repassa</strong> a variável do shell/.env com o mesmo nome'],
            ['<code>env_file: .env.app</code>', 'lê um arquivo inteiro de <code>CHAVE=valor</code> e injeta tudo no container']
          ]
        }
      },
      {
        box: 'note', label: '<code>.env</code> e <code>env_file</code> não são a mesma coisa', body: [
          { p: 'O <code>.env</code> alimenta a <strong>interpolação do arquivo</strong> e não entra em nenhum container por conta própria. O <code>env_file</code> é o oposto: alimenta o <strong>ambiente do container</strong> e o Compose não usa aquilo para interpolar nada.' },
          { p: 'Se você põe <code>SENHA_DO_BANCO=...</code> no <code>.env</code> e o container não vê a variável, é isso que está acontecendo. Ou você a declara em <code>environment</code> (repassando com <code>- SENHA_DO_BANCO</code>), ou usa <code>env_file</code>.' }
        ]
      },

      { h2: 'Conferindo antes de subir' },
      {
        code: [
          '$ mkdir -p ~/param && cd ~/param',
          '$ printf \'PORTA_SITE=8101\\nTAG_NGINX=alpine\\n\' > .env',
          '$ printf \'services:\\n  site:\\n    image: nginx:${TAG_NGINX}\\n    ports:\\n      - "${PORTA_SITE}:80"\\n\' > compose.yaml',
          '$ docker compose config',
          '$ PORTA_SITE=8102 docker compose config | grep published'
        ], run: true
      },
      { p: 'O <code>config</code> mostra o arquivo já resolvido. Se o valor que aparece ali não é o que você esperava, o problema é de variável — e você descobriu isso sem subir nada.' }
    ],
    tasks: [
      {
        id: 'td12-1-a', kind: 'guiado', title: 'Veja a interpolação antes de subir',
        body: [
          { p: 'Monte um projeto parametrizado e confira o que o Compose resolve antes de subir qualquer coisa:' },
          {
            code: [
              '$ mkdir -p ~/param && cd ~/param',
              '$ printf \'PORTA_SITE=8101\\nTAG_NGINX=alpine\\n\' > .env',
              '$ printf \'services:\\n  site:\\n    image: nginx:${TAG_NGINX}\\n    ports:\\n      - "${PORTA_SITE}:80"\\n\' > compose.yaml',
              '$ docker compose config',
              '$ PORTA_SITE=8102 docker compose config | grep published'
            ]
          },
          { p: 'A segunda chamada ao <code>config</code> mostra a porta 8102, não a 8101 do <code>.env</code>: a variável exportada no shell vence.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código, na ordem em que aparece.'],
        check: (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+config/), 'Rode <code>docker compose config</code> primeiro, sem sobrepor nada.'],
          [() => H.usedCommand(ctx, /PORTA_SITE=8102\s+docker\s+compose\s+config/), 'Rode de novo com <code>PORTA_SITE=8102</code> na frente do comando, para ver a variável do shell vencer o <code>.env</code>.']
        ])
      },
      {
        id: 'td12-1-q', kind: 'quiz', title: 'A variável que o container não vê',
        body: [
          { p: 'O <code>.env</code> do projeto tem <code>API_TOKEN=HASH_KEY</code>. O <code>compose.yaml</code> é este:' },
          {
            code: [
              'services:',
              '  api:',
              '    image: node:22-alpine',
              '    command: sleep 3600'
            ], run: false, lang: 'yaml'
          },
          { p: 'Dentro do container, <code>echo $API_TOKEN</code> não mostra nada. Por quê?' }
        ],
        options: [
          { text: 'Porque o <code>.env</code> serve à interpolação do arquivo, não ao ambiente do container. Para a variável chegar lá, o serviço precisa de <code>environment: [API_TOKEN]</code> ou de um <code>env_file</code>.', correct: true },
          { text: 'Porque o <code>.env</code> precisa se chamar <code>.env.local</code> para o Compose enxergar.', why: 'O nome lido automaticamente é exatamente <code>.env</code>, na pasta do projeto.' },
          { text: 'Porque falta rodar <code>docker compose up --force-recreate</code>.', why: 'Recriar não muda nada: o serviço não declara essa variável em lugar nenhum, então não há o que injetar.' },
          { text: 'Porque variáveis de ambiente só funcionam com <code>build</code>, não com <code>image</code>.', why: '<code>environment</code> funciona igual com imagem pronta ou construída. O que existe de diferente no build é o <code>ARG</code>, que vale só durante a construção.' }
        ],
        hints: ['Reveja a tabela das duas variáveis: quem lê o <code>.env</code>?'],
        explain: 'O <code>.env</code> alimenta a <strong>interpolação</strong>. Para a variável entrar no container, declare no serviço:<pre>services:\n  api:\n    image: node:22-alpine\n    command: sleep 3600\n    environment:\n      - API_TOKEN        # repassa a de mesmo nome\n    # ou\n    env_file: .env.app</pre>'
      },
      {
        id: 'td12-1-b', kind: 'desafio', title: 'Parametrize a stack',
        body: [
          { p: 'Em <code>~/parametro</code>, monte um projeto com dois arquivos:' },
          { ul: [
            '<code>.env</code> — com <code>PORTA_SITE=8103</code> e <code>NOME_BANCO=catalogo</code>;',
            '<code>compose.yaml</code> — com um serviço <code>site</code> (<code>nginx:alpine</code>) publicando <code>${PORTA_SITE}</code> na 80, e um serviço <code>db</code> (<code>mariadb:11.4</code>) com <code>MARIADB_DATABASE</code> vindo de <code>${NOME_BANCO}</code> e <code>MARIADB_ROOT_PASSWORD</code> valendo <code>SENHA_DO_BANCO</code>.'
          ] },
          { p: 'A porta e o nome do banco <strong>não podem</strong> aparecer escritos direto no <code>compose.yaml</code>: os dois têm que vir da interpolação.' },
          { p: 'Suba e confirme que a 8103 responde e que, dentro do container do banco, a variável <code>MARIADB_DATABASE</code> vale <code>catalogo</code>.' }
        ],
        hints: [
          'O <code>.env</code> fica na mesma pasta do <code>compose.yaml</code> e é lido sozinho — você não precisa passar <code>--env-file</code>.',
          'No arquivo, escreva <code>- "${PORTA_SITE}:80"</code> e <code>MARIADB_DATABASE: ${NOME_BANCO}</code>. Confira com <code>docker compose config</code> antes de subir.'
        ],
        solution: '<pre>$ mkdir -p ~/parametro\n$ cd ~/parametro\n$ cat &gt; .env &lt;&lt;\'EOF\'\nPORTA_SITE=8103\nNOME_BANCO=catalogo\nEOF\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    image: nginx:alpine\n    ports:\n      - "${PORTA_SITE}:80"\n  db:\n    image: mariadb:11.4\n    environment:\n      MARIADB_DATABASE: ${NOME_BANCO}\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\nEOF\n$ docker compose config\n$ docker compose up -d\n$ docker compose ps</pre>',
        check: (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          let bruto = null;
          try { bruto = m.fs.readFile('/home/aluno/parametro/compose.yaml', { ctx: m.ctxRoot() }); } catch (e) { }
          let env = null;
          try { env = m.fs.readFile('/home/aluno/parametro/.env', { ctx: m.ctxRoot() }); } catch (e) { }
          const site = D.doProjeto(ctx, 'parametro', 'site');
          const db = D.doProjeto(ctx, 'parametro', 'db');
          return H.checkAll([
            [() => bruto !== null, 'Não encontrei <code>~/parametro/compose.yaml</code>.'],
            [() => env !== null, 'Não encontrei <code>~/parametro/.env</code>.'],
            [() => /^\s*PORTA_SITE\s*=\s*8103\s*$/m.test(env), 'O <code>.env</code> precisa ter <code>PORTA_SITE=8103</code>.'],
            [() => /^\s*NOME_BANCO\s*=\s*catalogo\s*$/m.test(env), 'O <code>.env</code> precisa ter <code>NOME_BANCO=catalogo</code>.'],
            [() => /\$\{?PORTA_SITE/.test(bruto), 'A porta precisa vir da interpolação (<code>${PORTA_SITE}</code>), não escrita direto no arquivo.'],
            [() => !/["']?8103["']?\s*:\s*80/.test(bruto), 'A porta 8103 está escrita direto no <code>compose.yaml</code>. Ela deve vir só do <code>.env</code>.'],
            [() => /\$\{?NOME_BANCO/.test(bruto), 'O nome do banco precisa vir da interpolação (<code>${NOME_BANCO}</code>).'],
            [() => !/MARIADB_DATABASE\s*:\s*catalogo/.test(bruto), 'O valor <code>catalogo</code> está escrito direto no <code>compose.yaml</code>.'],
            [() => site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => db && db.rodando, 'O serviço <code>db</code> não está rodando.'],
            [() => D.publicada(ctx, site.nome, 8103), 'O <code>site</code> não está publicando a porta 8103 — a interpolação chegou ao container?'],
            [() => { const r = D.http(ctx, 'localhost', 8103, '/'); return !!r && r.status === 200; }, 'A porta 8103 não respondeu.'],
            [() => D.env(ctx, db.nome, 'MARIADB_DATABASE') === 'catalogo',
              () => 'Dentro do banco, <code>MARIADB_DATABASE</code> vale <code>' + D.env(ctx, db.nome, 'MARIADB_DATABASE') + '</code> em vez de <code>catalogo</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 12.2 ============================== */
  LX.lesson('d12', {
    id: 'ld12-2', n: '12.2', title: 'Segredos: o que nunca vai para o Git',
    goal: 'Tirar credenciais de dentro do compose.yaml, entender por onde uma variável de ambiente vaza e usar o bloco secrets.',
    setup: (m) => {
      D.pasta(m, '/home/aluno/vazando');
      D.arquivo(m, '/home/aluno/vazando/compose.yaml',
        'services:\n' +
        '  db:\n' +
        '    image: mariadb:11.4\n' +
        '    environment:\n' +
        '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n' +
        '      MARIADB_DATABASE: loja\n');
    },
    body: [
      { h2: 'O erro mais caro do Docker é de uma linha' },
      {
        code: [
          'services:',
          '  db:',
          '    image: mariadb:11.4',
          '    environment:',
          '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO   # ← isso vai para o Git'
        ], run: false, lang: 'yaml'
      },
      { p: 'O <code>compose.yaml</code> é versionado junto com o projeto. Uma credencial escrita ali entra no repositório, entra no histórico e fica lá <strong>para sempre</strong> — apagar em um commit posterior não remove do histórico, e qualquer pessoa com acesso ao repositório consegue recuperar.' },
      {
        box: 'warn', label: 'Neste curso, e no seu projeto', body: [
          { p: 'Todos os exemplos aqui usam marcadores: <code>SENHA_DO_BANCO</code>, <code>HASH_KEY</code>, <code>DATABASE_URL</code>. Nunca são credenciais reais, e você também não deve escrever as suas em nenhum arquivo de exemplo, comentário, print de tela ou pergunta em fórum.' },
          { p: 'Se uma credencial real vazou, o conserto não é apagar o arquivo: é <strong>trocar a credencial</strong>. Ela deve ser considerada comprometida a partir do instante em que saiu do lugar seguro.' }
        ]
      },

      { h2: 'O par <code>.env</code> + <code>.env.example</code>' },
      { p: 'O padrão que funciona em qualquer projeto:' },
      {
        ascii: `projeto/
├── compose.yaml     ← vai para o Git (só ${'$'}{VARIAVEIS})
├── .env.example     ← vai para o Git (chaves, valores falsos)
├── .env             ← NÃO vai (valores reais)
└── .gitignore       ← contém a linha  .env`
      },
      {
        code: [
          '# .env.example — commitado, serve de documentação',
          'PORTA_SITE=8080',
          'NOME_BANCO=loja',
          'SENHA_DO_BANCO=troque-me',
          'API_TOKEN=HASH_KEY'
        ], run: false, lang: 'text'
      },
      { p: 'Quem clona o projeto copia o exemplo para <code>.env</code> e preenche com os valores reais do ambiente dele. O <code>.gitignore</code> garante que esse arquivo nunca seja enviado por acidente:' },
      {
        code: [
          '$ printf ".env\\n*.env.local\\n" >> .gitignore',
          '$ cp .env.example .env'
        ], run: false
      },
      {
        box: 'note', label: 'Confira antes do primeiro commit', body: [
          { p: '<code>git status</code> deve mostrar <code>.env.example</code> e <strong>não</strong> mostrar <code>.env</code>. Se o <code>.env</code> aparecer, o <code>.gitignore</code> não está pegando — e o momento de descobrir isso é agora, não depois de dar <code>push</code>.' }
        ]
      },

      { h2: 'Por onde uma variável de ambiente vaza' },
      { p: 'Tirar a senha do arquivo versionado resolve o problema do Git. Mas variável de ambiente não é um cofre: uma vez dentro do container, ela é visível em vários lugares.' },
      {
        table: {
          head: ['Onde aparece', 'Quem consegue ver'],
          rows: [
            ['<code>docker inspect &lt;container&gt;</code>', 'qualquer um com acesso ao daemon do Docker'],
            ['<code>docker compose config</code>', 'qualquer um com acesso à pasta do projeto'],
            ['<code>/proc/1/environ</code> dentro do container', 'qualquer processo do container'],
            ['<code>ps auxe</code> no servidor', 'root no servidor'],
            ['logs de erro que imprimem o ambiente', 'quem lê os logs — e frequentemente quem lê o sistema de logs central']
          ]
        }
      },
      {
        code: [
          '$ cd ~/vazando',
          '$ docker compose up -d',
          '$ docker inspect vazando-db-1 --format "{{json .Config.Env}}"'
        ], run: true
      },
      { p: 'A senha aparece inteira, em texto claro. Não existe configuração que esconda isso: é assim que variável de ambiente funciona.' },

      { h2: 'A alternativa: segredos em arquivo' },
      { p: 'Em vez de entregar o valor, entregue o <strong>caminho de um arquivo</strong> que contém o valor. O bloco <code>secrets</code> do Compose monta esse arquivo dentro do container, somente leitura, em <code>/run/secrets/&lt;nome&gt;</code>.' },
      {
        code: [
          'services:',
          '  db:',
          '    image: mariadb:11.4',
          '    environment:',
          '      MARIADB_ROOT_PASSWORD_FILE: /run/secrets/senha_db',
          '      MARIADB_DATABASE: loja',
          '    secrets:',
          '      - senha_db',
          '',
          'secrets:',
          '  senha_db:',
          '    file: ./segredos/senha_db.txt'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'A convenção <code>_FILE</code>', body: [
          { p: 'As imagens oficiais de banco de dados (MariaDB, MySQL, PostgreSQL) aceitam qualquer variável com o sufixo <code>_FILE</code>: em vez de <code>MARIADB_ROOT_PASSWORD</code>, você passa <code>MARIADB_ROOT_PASSWORD_FILE</code> apontando para um caminho. O <em>entrypoint</em> lê o arquivo na inicialização e usa o conteúdo.' },
          { p: 'A diferença prática: <code>docker inspect</code> passa a mostrar apenas o <strong>caminho</strong>. A senha em si nunca entrou na configuração do container.' }
        ]
      },
      { p: 'O arquivo do segredo fica fora do Git, com permissão restrita:' },
      {
        code: [
          'mkdir -p segredos',
          'printf "SENHA_DO_BANCO" > segredos/senha_db.txt   # sem quebra de linha no fim',
          'chmod 600 segredos/senha_db.txt',
          'printf "segredos/\\n" >> .gitignore'
        ], run: false
      },
      {
        box: 'warn', label: 'Duas armadilhas do arquivo de segredo', body: [
          { ol: [
            'Uma <strong>quebra de linha</strong> no fim do arquivo entra na senha em várias ferramentas. Use <code>printf</code> em vez de <code>echo</code>, ou <code>echo -n</code>.',
            'Trocar o conteúdo do arquivo <strong>não</strong> muda o segredo de um container que já está rodando: ele leu o valor na inicialização. Depois de rotacionar uma senha, é <code>docker compose up -d --force-recreate</code>.'
          ] }
        ]
      },
      {
        box: 'note', label: 'Até onde isso protege', body: [
          { p: 'O bloco <code>secrets</code> do Compose tira o valor do <code>docker inspect</code> e do arquivo versionado. Ele <strong>não</strong> criptografa nada: o arquivo continua em texto claro no servidor, e quem for root ali lê. Para segredos que exigem mais — rotação automática, auditoria de acesso, criptografia em repouso — o caminho são gerenciadores dedicados (Vault, AWS Secrets Manager, Docker Swarm secrets). Este módulo cobre o básico bem feito, que já elimina a maioria dos vazamentos reais.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td12-2-a', kind: 'guiado', title: 'Veja a senha exposta no inspect',
        body: [
          { p: 'A pasta <code>~/vazando</code> já tem uma stack com a senha escrita direto no <code>compose.yaml</code>. Suba e veja onde ela aparece:' },
          {
            code: [
              '$ cd ~/vazando',
              '$ docker compose up -d',
              '$ docker inspect vazando-db-1 --format "{{json .Config.Env}}"'
            ]
          },
          { p: 'A senha aparece inteira, em texto claro, na configuração do container — não existe ajuste que esconda isso: é assim que variável de ambiente funciona.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código.'],
        check: (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up\s+-d/), 'Suba a stack com <code>docker compose up -d</code> dentro de <code>~/vazando</code>.'],
          [() => H.usedCommand(ctx, /docker\s+inspect\s+vazando-db-1/), 'Rode <code>docker inspect vazando-db-1 --format "{{json .Config.Env}}"</code> para ver a senha em texto claro.']
        ])
      },
      {
        id: 'td12-2-q', kind: 'quiz', title: 'A senha vazou. E agora?',
        body: [
          { p: 'Você percebe que o <code>compose.yaml</code> com a senha real do banco de produção foi commitado e enviado há três semanas. O repositório é privado, com cinco pessoas de acesso. Qual é a primeira ação?' }
        ],
        options: [
          { text: 'Trocar a senha do banco. A credencial está comprometida desde o momento em que saiu do lugar seguro, e só a troca resolve isso.', correct: true },
          { text: 'Fazer um commit removendo a linha e dar push.', why: 'Não adianta: o valor continua em todo o histórico do Git e é recuperável com um comando. Remover é necessário, mas é o segundo passo, não o primeiro.' },
          { text: 'Reescrever o histórico do repositório para apagar o commit.', why: 'É uma limpeza legítima e às vezes necessária — mas trabalhosa, disruptiva para quem já clonou, e não garante nada: cópias e clones já feitos permanecem. A senha continua comprometida.' },
          { text: 'Como o repositório é privado, não há risco imediato; basta anotar para corrigir na próxima refatoração.', why: 'Repositório privado hoje pode virar público, ser clonado por alguém que sai da equipe, ou ter acesso comprometido. Credencial exposta é credencial queimada.' }
        ],
        hints: ['Pergunte-se: depois de qual ação a credencial exposta deixa de servir para alguém?'],
        explain: 'A ordem é: <strong>(1) rotacionar a credencial</strong> — a exposta deixa de funcionar; (2) tirar o valor do arquivo e passar a usar <code>.env</code> ou <code>secrets</code>; (3) acrescentar o arquivo ao <code>.gitignore</code>; (4) se fizer sentido, limpar o histórico. Sem o passo 1, os outros três não protegem nada.'
      },
      {
        id: 'td12-2-b', kind: 'desafio', title: 'Tire a senha de dentro do arquivo',
        body: [
          { p: 'A stack de <code>~/vazando</code> tem a senha escrita no <code>compose.yaml</code>. Reescreva o projeto para que:' },
          { ol: [
            'exista <code>~/vazando/segredos/senha_db.txt</code> contendo exatamente <code>SENHA_DO_BANCO</code>, com permissão <code>600</code>;',
            'o <code>compose.yaml</code> use o bloco <code>secrets</code> e a variável <code>MARIADB_ROOT_PASSWORD_FILE</code>, e <strong>não contenha mais</strong> a palavra <code>SENHA_DO_BANCO</code>;',
            'exista um <code>.gitignore</code> na pasta do projeto ignorando <code>segredos/</code>;',
            'a stack esteja no ar e <code>docker inspect</code> do container do banco <strong>não</strong> mostre a senha.'
          ] },
          { p: 'O banco <code>loja</code> deve continuar existindo.' }
        ],
        hints: [
          'O bloco <code>secrets:</code> aparece duas vezes: uma dentro do serviço (a lista dos segredos que ele recebe) e outra no topo do arquivo (de onde cada segredo vem).',
          'Depois de reescrever, é preciso recriar o container para a mudança valer: <code>docker compose up -d --force-recreate</code>. E use <code>printf</code>, não <code>echo</code>, para não deixar quebra de linha no arquivo do segredo.'
        ],
        solution: '<pre>$ cd ~/vazando\n$ mkdir -p segredos\n$ printf "SENHA_DO_BANCO" &gt; segredos/senha_db.txt\n$ chmod 600 segredos/senha_db.txt\n$ printf "segredos/\\n.env\\n" &gt; .gitignore\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  db:\n    image: mariadb:11.4\n    environment:\n      MARIADB_ROOT_PASSWORD_FILE: /run/secrets/senha_db\n      MARIADB_DATABASE: loja\n    secrets:\n      - senha_db\n\nsecrets:\n  senha_db:\n    file: ./segredos/senha_db.txt\nEOF\n$ docker compose up -d --force-recreate\n$ docker inspect vazando-db-1 --format "{{json .Config.Env}}"\n$ docker compose exec db mariadb -uroot -pSENHA_DO_BANCO -e "SHOW DATABASES;"</pre>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const ler = (p) => { try { return m.fs.readFile(p, { ctx: m.ctxRoot() }); } catch (e) { return null; } };
          const yaml = ler('/home/aluno/vazando/compose.yaml');
          const seg = ler('/home/aluno/vazando/segredos/senha_db.txt');
          const git = ler('/home/aluno/vazando/.gitignore');
          const db = D.doProjeto(ctx, 'vazando', 'db');
          let modo = null;
          try { modo = m.fs.stat('/home/aluno/vazando/segredos/senha_db.txt', { ctx: m.ctxRoot() }).mode & 0o777; } catch (e) { }
          let consulta = { status: 1, out: '' };
          if (db && db.rodando) consulta = await D.exec(ctx, db.nome, 'mariadb -uroot -pSENHA_DO_BANCO -e "SHOW DATABASES;"');
          return H.checkAll([
            [() => yaml !== null, 'Não encontrei <code>~/vazando/compose.yaml</code>.'],
            [() => seg !== null, 'Não encontrei <code>~/vazando/segredos/senha_db.txt</code>.'],
            [() => seg.replace(/\n+$/, '') === 'SENHA_DO_BANCO',
              () => 'O arquivo do segredo contém <code>' + JSON.stringify(seg) + '</code>; espero exatamente <code>SENHA_DO_BANCO</code>.'],
            [() => modo === 0o600, () => 'A permissão do arquivo do segredo é <code>' + (modo === null ? '?' : modo.toString(8)) + '</code>; o enunciado pede <code>600</code>.'],
            [() => git !== null && /segredos\/?/.test(git), 'Falta um <code>.gitignore</code> na pasta do projeto ignorando <code>segredos/</code>.'],
            [() => !/SENHA_DO_BANCO/.test(yaml), 'A senha ainda aparece dentro do <code>compose.yaml</code>.'],
            [() => /MARIADB_ROOT_PASSWORD_FILE/.test(yaml), 'O <code>compose.yaml</code> precisa usar <code>MARIADB_ROOT_PASSWORD_FILE</code>.'],
            [() => /^\s*secrets\s*:/m.test(yaml), 'O <code>compose.yaml</code> precisa declarar o bloco <code>secrets</code>.'],
            [() => db && db.rodando, 'O container do banco não está rodando. Suba com <code>docker compose up -d --force-recreate</code>.'],
            [() => D.existeNoContainer(ctx, db.nome, '/run/secrets/senha_db'),
              'O arquivo <code>/run/secrets/senha_db</code> não existe dentro do container: o serviço está recebendo o segredo?'],
            [() => (db.env.MARIADB_ROOT_PASSWORD_FILE || '') === '/run/secrets/senha_db',
              'A variável <code>MARIADB_ROOT_PASSWORD_FILE</code> precisa apontar para <code>/run/secrets/senha_db</code>.'],
            [() => !Object.entries(db.env)
              .some(([k, v]) => !(db.envDeArquivo && db.envDeArquivo.has(k)) && String(v) === 'SENHA_DO_BANCO'),
              'A senha ainda aparece na configuração do container (é o que o <code>docker inspect</code> mostra). Ela não deve ser passada como valor de variável.'],
            [() => consulta.status === 0 && /loja/.test(consulta.out),
              'O banco não aceitou a senha ou o banco <code>loja</code> não existe. O segredo chegou com o conteúdo certo (sem quebra de linha no fim)?']
          ]);
        }
      }
    ]
  });
})();
