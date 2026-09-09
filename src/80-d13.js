/* =========================================================================
   MÓDULO D13 — Healthcheck e dependências
   "Rodando" não é "pronto". Como o Docker mede saúde e como a stack espera.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 13.1 ============================== */
  LX.lesson('d13', {
    id: 'ld13-1', n: '13.1', title: 'Rodando não é pronto',
    goal: 'Escrever healthchecks que medem prontidão de verdade e ler o estado de saúde de um container.',
    body: [
      { h2: 'A diferença que quebra stacks' },
      { p: 'O Docker sabe uma coisa sobre o seu container: se o processo 1 está vivo. Só isso. Um MariaDB que subiu há meio segundo e ainda está criando as tabelas do sistema aparece como <code>Up</code> — e recusa toda conexão.' },
      {
        table: {
          head: ['Estado', 'Significa', 'O Docker sabe sozinho?'],
          rows: [
            ['<strong>rodando</strong>', 'o processo 1 não morreu', 'sim'],
            ['<strong>pronto</strong>', 'o serviço aceita e atende requisições', '<strong>não</strong> — só se você ensinar']
          ]
        }
      },
      { p: 'Ensinar é escrever um <strong>healthcheck</strong>: um comando que o Docker roda de tempos em tempos dentro do container. Código de saída 0 significa saudável; qualquer outro, falha.' },

      { h2: 'No Compose' },
      {
        code: [
          'services:',
          '  db:',
          '    image: mariadb:11.4',
          '    environment:',
          '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
          '      MARIADB_DATABASE: loja',
          '    healthcheck:',
          '      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]',
          '      interval: 10s',
          '      timeout: 5s',
          '      retries: 5',
          '      start_period: 30s'
        ], run: false, lang: 'yaml'
      },
      {
        table: {
          head: ['Campo', 'O que é', 'Escolhendo o valor'],
          rows: [
            ['<code>test</code>', 'o comando que decide', 'tem que rodar <strong>dentro</strong> do container e sair com 0 quando está pronto'],
            ['<code>interval</code>', 'de quanto em quanto tempo repetir', '10s a 30s serve para quase tudo; muito curto só gasta CPU'],
            ['<code>timeout</code>', 'quanto esperar cada execução', 'menor que o <code>interval</code>'],
            ['<code>retries</code>', 'quantas falhas seguidas para declarar doente', '3 a 5; menos que isso gera alarme falso'],
            ['<code>start_period</code>', 'carência inicial: falhas aqui não contam', '<strong>o campo mais esquecido</strong> — dê ao banco o tempo real de subida']
          ]
        }
      },
      {
        box: 'key', label: '<code>CMD</code> ou <code>CMD-SHELL</code>?', body: [
          { p: '<code>["CMD", "programa", "argumento"]</code> executa direto, sem shell. <code>["CMD-SHELL", "linha inteira"]</code> passa por <code>/bin/sh -c</code>, então aceita pipe, <code>&amp;&amp;</code>, redirecionamento e variáveis.' },
          { p: 'Use <code>CMD-SHELL</code> quando precisar de shell; <code>CMD</code> no resto. E lembre: o comando precisa <strong>existir dentro da imagem</strong>. Um healthcheck com <code>curl</code> em uma imagem Alpine sem curl falha sempre — e o container fica eternamente <code>unhealthy</code> por um motivo que não tem nada a ver com o serviço.' }
        ]
      },

      { h2: 'Healthchecks que valem a pena' },
      {
        table: {
          head: ['Serviço', 'Teste'],
          rows: [
            ['MariaDB / MySQL', '<code>mariadb-admin ping -h 127.0.0.1 -uroot -p"$MARIADB_ROOT_PASSWORD" --silent</code>'],
            ['PostgreSQL', '<code>pg_isready -U postgres</code>'],
            ['Redis', '<code>redis-cli ping</code>'],
            ['HTTP em geral', '<code>wget -qO- http://localhost:PORTA/saude || exit 1</code>'],
            ['Nginx', '<code>wget -q --spider http://localhost/ || exit 1</code>']
          ]
        }
      },
      {
        box: 'warn', label: 'Um healthcheck ruim é pior que nenhum', body: [
          { ul: [
            '<strong>Testar a porta e não o serviço.</strong> A porta abre antes de o banco aceitar login: o teste passa, a aplicação quebra.',
            '<strong>Testar coisa demais.</strong> Um teste que faz consulta pesada a cada 10 segundos vira carga permanente.',
            '<strong>Testar dependência externa.</strong> Se o healthcheck da sua API consulta uma API de terceiro, uma instabilidade lá derruba o seu container aqui.',
            '<strong>Esquecer o <code>start_period</code>.</strong> Sem ele, um banco que leva 40 segundos para subir é declarado doente antes de terminar de nascer.'
          ] }
        ]
      },

      { h2: 'No Dockerfile' },
      { p: 'Quando a imagem é sua, o healthcheck pode vir embutido — assim quem usa a imagem não precisa saber como testá-la:' },
      {
        code: [
          'HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \\',
          '  CMD wget -q --spider http://localhost/ || exit 1'
        ], run: false, lang: 'dockerfile'
      },
      { p: 'O Compose pode sobrescrever isso, e <code>test: ["NONE"]</code> desliga um healthcheck herdado da imagem.' },

      { h2: 'Lendo o estado' },
      {
        code: [
          '$ docker ps',
          '$ docker inspect NOME --format "{{.State.Health.Status}}"'
        ], run: false
      },
      {
        table: {
          head: ['Estado', 'Quando aparece'],
          rows: [
            ['<code>starting</code>', 'ainda no <code>start_period</code>, ou falhando mas sem atingir <code>retries</code>'],
            ['<code>healthy</code>', 'o último teste saiu com 0'],
            ['<code>unhealthy</code>', '<code>retries</code> falhas seguidas'],
            ['(nada)', 'o container não tem healthcheck definido']
          ]
        }
      },
      {
        box: 'note', label: 'Doente não é parado', body: [
          { p: 'Um container <code>unhealthy</code> continua rodando. O Docker <strong>não</strong> reinicia por causa disso — ele apenas relata. Quem reage é você, o Compose (com <code>depends_on</code>) ou um orquestrador. É por isso que o healthcheck precisa estar ligado a alguma decisão, senão vira enfeite.' }
        ]
      },
      { p: 'Quando um teste falha, o histórico das últimas execuções fica guardado — inclusive a saída do comando, que costuma dizer exatamente o que houve:' },
      { code: ['docker inspect NOME --format "{{json .State.Health}}"'], run: false }
    ],
    tasks: [
      {
        id: 'td13-1-a', kind: 'guiado', title: 'Suba um banco com healthcheck e leia o estado',
        body: [
          { p: 'Monte esta stack e acompanhe a saúde dela:' },
          {
            code: [
              '$ mkdir -p ~/saude-demo && cd ~/saude-demo',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  db:',
              '    image: mariadb:11.4',
              '    environment:',
              '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
              '      MARIADB_DATABASE: loja',
              '    healthcheck:',
              '      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]',
              '      interval: 10s',
              '      timeout: 5s',
              '      retries: 5',
              '      start_period: 30s',
              'EOF',
              '$ docker compose up -d',
              '$ docker inspect saude-demo-db-1 --format "{{.State.Health.Status}}"'
            ]
          },
          { p: 'Espere alguns segundos e rode o <code>inspect</code> de novo: o estado sai de <code>starting</code> para <code>healthy</code>.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código.'],
        check: async (ctx) => {
          const db = D.doProjeto(ctx, 'saude-demo', 'db');
          let estado = 'none';
          if (db && db.rodando) estado = await D.saude(ctx, db.nome);
          return H.checkAll([
            [() => H.usedCommand(ctx, /docker\s+compose\s+up\s+-d/), 'Suba a stack com <code>docker compose up -d</code>.'],
            [() => H.usedCommand(ctx, /docker\s+inspect\s+saude-demo-db-1/), 'Rode <code>docker inspect saude-demo-db-1 --format "{{.State.Health.Status}}"</code> para ler o estado.'],
            [() => estado === 'healthy', 'O container ainda não está <code>healthy</code>. Confira se o healthcheck ficou igual ao da aula.']
          ]);
        }
      },
      {
        id: 'td13-1-q', kind: 'quiz', title: 'O healthcheck que mente',
        body: [
          { p: 'Uma API tem este healthcheck:' },
          { code: ['test: ["CMD-SHELL", "nc -z localhost 3000"]'], run: false, lang: 'yaml' },
          { p: 'Ele passa a reportar <code>healthy</code> alguns segundos antes de a aplicação realmente atender. Qual é o problema?' }
        ],
        options: [
          { text: 'O teste verifica apenas se a porta está aberta. O servidor abre a porta antes de terminar de carregar; um <code>GET</code> em uma rota de saúde só passaria quando a aplicação estivesse mesmo pronta.', correct: true },
          { text: 'O <code>localhost</code> está errado: dentro do container ele não aponta para o próprio container.', why: 'Aqui <code>localhost</code> está certo — o healthcheck roda <em>dentro</em> do container, e ali <code>localhost</code> é o próprio serviço.' },
          { text: 'Falta aumentar o <code>interval</code> para 60s.', why: 'Intervalo maior só atrasa a descoberta; não muda o fato de que o teste mede a coisa errada.' },
          { text: 'O <code>nc</code> não existe na maioria das imagens, então o teste sempre falha.', why: 'Se o comando não existisse, o teste falharia sempre — mas o enunciado diz que ele passa. O problema não é disponibilidade do comando, é o que ele mede.' }
        ],
        hints: ['Pergunte-se o que exatamente cada teste prova sobre a aplicação.'],
        explain: 'Porta aberta ≠ aplicação pronta. O teste correto pede uma resposta do próprio serviço:<pre>test: ["CMD-SHELL", "wget -qO- http://localhost:3000/saude || exit 1"]</pre>E acrescente <code>start_period</code> para não contar as falhas do período de subida.'
      },
      {
        id: 'td13-1-b', kind: 'desafio', title: 'Um healthcheck que mede o serviço',
        body: [
          { p: 'Em <code>~/saude</code>, monte uma stack com um serviço <code>banco</code> usando <code>mariadb:11.4</code>, com <code>MARIADB_ROOT_PASSWORD</code> valendo <code>SENHA_DO_BANCO</code> e <code>MARIADB_DATABASE</code> valendo <code>estoque</code>, sem publicar porta.' },
          { p: 'Acrescente um <code>healthcheck</code> que:' },
          { ul: [
            'testa o <strong>serviço</strong> respondendo (não apenas a porta aberta);',
            'tem <code>interval</code>, <code>timeout</code>, <code>retries</code> e <code>start_period</code> declarados.'
          ] },
          { p: 'Suba a stack e confirme que <code>docker ps</code> mostra o container como <code>healthy</code>.' }
        ],
        hints: [
          'A imagem do MariaDB traz o programa <code>mariadb-admin</code>. O subcomando que pergunta "você está aceitando conexões?" é o <code>ping</code>.',
          'Um teste completo precisa autenticar, senão a resposta não prova quase nada:<pre>test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]</pre>'
        ],
        solution: '<pre>$ mkdir -p ~/saude\n$ cd ~/saude\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  banco:\n    image: mariadb:11.4\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: estoque\n    healthcheck:\n      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]\n      interval: 10s\n      timeout: 5s\n      retries: 5\n      start_period: 30s\nEOF\n$ docker compose up -d\n$ docker ps\n$ docker inspect saude-banco-1 --format "{{.State.Health.Status}}"</pre>',
        check: async (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/saude/compose.yaml');
          const c = D.doProjeto(ctx, 'saude', 'banco');
          const hc = doc && doc.services && doc.services.banco ? doc.services.banco.healthcheck : null;
          const teste = hc ? [].concat(hc.test || []).join(' ') : '';
          let estado = 'none';
          if (c && c.rodando) estado = await D.saude(ctx, c.nome);
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/saude/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc.services && doc.services.banco, 'O arquivo precisa ter um serviço chamado <code>banco</code>.'],
            [() => hc, 'O serviço <code>banco</code> não tem bloco <code>healthcheck</code>.'],
            [() => hc.interval && hc.timeout && hc.retries !== undefined && hc.start_period,
              'O healthcheck precisa declarar <code>interval</code>, <code>timeout</code>, <code>retries</code> e <code>start_period</code>.'],
            [() => /mariadb-admin|mysqladmin|mariadb\b|mysql\b/.test(teste),
              () => 'O teste (<code>' + teste + '</code>) não parece consultar o banco. Use um comando do próprio MariaDB dentro do container.'],
            [() => /ping|SELECT|select/.test(teste),
              'O teste precisa perguntar ao banco se ele responde — não basta olhar a porta.'],
            [() => c && c.rodando, 'O container do serviço <code>banco</code> não está rodando.'],
            [() => c.portas.length === 0, 'O enunciado pede o banco sem publicar porta no servidor.'],
            [() => D.env(ctx, c.nome, 'MARIADB_DATABASE') === 'estoque', 'Falta <code>MARIADB_DATABASE: estoque</code>.'],
            [() => estado === 'healthy',
              () => 'O container está com saúde <code>' + estado + '</code>. Se estiver <code>unhealthy</code>, rode <code>docker inspect saude-banco-1 --format "{{json .State.Health}}"</code> e leia a saída do teste.']
          ]);
        }
      }
    ]
  });

  /* ============================== 13.2 ============================== */
  LX.lesson('d13', {
    id: 'ld13-2', n: '13.2', title: 'Ordem de subida e política de reinício',
    goal: 'Fazer a stack esperar o que precisa esperar, e escolher a política de reinício certa para cada serviço.',
    body: [
      { h2: '<code>depends_on</code> sozinho não espera nada' },
      {
        code: [
          'services:',
          '  api:',
          '    image: node:22-alpine',
          '    depends_on:',
          '      - db      # forma curta',
          '  db:',
          '    image: mariadb:11.4'
        ], run: false, lang: 'yaml'
      },
      { p: 'Isso garante <strong>apenas</strong> que o container do <code>db</code> é iniciado antes do container da <code>api</code>. Iniciado — não pronto. A API sobe meio segundo depois, tenta conectar, o banco ainda está inicializando, e ela morre com <em>connection refused</em>.' },
      {
        box: 'key', label: 'A forma longa é a que resolve', body: [
          { p: 'Com <code>condition</code>, o Compose passa a esperar de verdade — e a condição <code>service_healthy</code> usa exatamente o healthcheck da aula anterior. Sem healthcheck no serviço de baixo, não há o que esperar.' }
        ]
      },
      {
        code: [
          'services:',
          '  api:',
          '    image: node:22-alpine',
          '    depends_on:',
          '      db:',
          '        condition: service_healthy',
          '      migracao:',
          '        condition: service_completed_successfully',
          '',
          '  migracao:',
          '    image: alpine:3.21',
          '    command: sh -c "echo aplicando migracoes"',
          '    depends_on:',
          '      db:',
          '        condition: service_healthy',
          '',
          '  db:',
          '    image: mariadb:11.4',
          '    environment:',
          '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
          '    healthcheck:',
          '      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]',
          '      interval: 10s',
          '      timeout: 5s',
          '      retries: 5',
          '      start_period: 30s'
        ], run: false, lang: 'yaml'
      },
      {
        table: {
          head: ['Condição', 'O Compose espera até…'],
          rows: [
            ['<code>service_started</code>', 'o container ter sido iniciado (o padrão da forma curta)'],
            ['<code>service_healthy</code>', 'o healthcheck reportar <code>healthy</code>'],
            ['<code>service_completed_successfully</code>', 'o container <strong>terminar</strong> com código 0']
          ]
        }
      },
      {
        ascii: `db (healthy?) ──▶ migracao (exit 0?) ──▶ api
   │                    │                  │
   │ healthcheck        │ roda e termina   │ só então sobe
   └── 30s start_period └── código 0       └── e conecta`
      },
      { p: 'Um serviço que roda uma tarefa e termina — uma migração de banco, uma carga inicial de dados — aparece como <code>Exited (0)</code> no <code>docker compose ps -a</code>, e isso é o correto. Ele não deveria ficar de pé.' },

      { h2: 'A verdade incômoda: espere no aplicativo também' },
      {
        box: 'warn', label: '<code>depends_on</code> não protege de tudo', body: [
          { p: 'A condição vale na <strong>subida da stack</strong>. Se o banco reiniciar às três da manhã, o Compose não vai recriar a API — e a API precisa saber reconectar sozinha.' },
          { p: 'Por isso, em qualquer aplicação séria, a conexão com serviços externos é feita com <strong>tentativa e espera</strong> (retry com backoff). O <code>depends_on</code> ordena a largada; a resiliência é responsabilidade do código.' }
        ]
      },

      { h2: 'Políticas de reinício' },
      {
        table: {
          head: ['<code>restart</code>', 'Reinicia se o processo cair?', 'Sobe sozinho ao ligar o servidor?', 'Use para'],
          rows: [
            ['<code>no</code> (padrão)', 'não', 'não', 'tarefas pontuais, migrações'],
            ['<code>on-failure</code>', 'só se sair com código ≠ 0', 'não', 'processos em lote que podem falhar por acaso'],
            ['<code>on-failure:3</code>', 'até 3 vezes', 'não', 'evitar laço infinito de reinício'],
            ['<code>always</code>', 'sim', 'sim — mesmo que você tenha parado à mão', 'raramente o que você quer'],
            ['<code>unless-stopped</code>', 'sim', 'sim, <strong>a menos que</strong> você o tenha parado', '<strong>o padrão sensato</strong> para serviços de longa duração']
          ]
        }
      },
      {
        box: 'key', label: '<code>always</code> ou <code>unless-stopped</code>?', body: [
          { p: 'A diferença aparece depois de um reboot. Com <code>always</code>, um container que você parou de propósito volta ao ligar a máquina — o que atrapalha manutenção. Com <code>unless-stopped</code>, ele respeita a sua decisão e continua parado.' },
          { p: 'Para praticamente todo serviço de produção, <code>unless-stopped</code>. Para o serviço de migração acima, <code>no</code> — reiniciar uma migração que terminou é justamente o que você não quer.' }
        ]
      },
      {
        box: 'note', label: 'Reinício não conserta configuração errada', body: [
          { p: 'Um container que falha por senha errada vai reiniciar, falhar, reiniciar, falhar. O <code>docker ps</code> mostra <code>Restarting</code> e o <code>docker logs</code> mostra a mesma mensagem repetida. Política de reinício serve para falhas <strong>transitórias</strong>; para falha de configuração, ela só transforma um erro visível em um laço barulhento.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td13-2-a', kind: 'guiado', title: 'Veja o depends_on esperar de verdade',
        body: [
          { p: 'Monte um banco com healthcheck e uma tarefa que só começa quando ele estiver saudável:' },
          {
            code: [
              '$ mkdir -p ~/ordem-demo && cd ~/ordem-demo',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  db:',
              '    image: mariadb:11.4',
              '    environment:',
              '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
              '    healthcheck:',
              '      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]',
              '      interval: 10s',
              '      timeout: 5s',
              '      retries: 5',
              '      start_period: 30s',
              '',
              '  migracao:',
              '    image: alpine:3.21',
              '    command: sh -c "echo aplicando migracoes"',
              '    depends_on:',
              '      db:',
              '        condition: service_healthy',
              'EOF',
              '$ docker compose up -d',
              '$ docker compose ps -a'
            ]
          },
          { p: 'O <code>migracao</code> não começa antes de o <code>db</code> ficar <code>healthy</code>, e depois termina sozinho — o <code>ps -a</code> mostra ele como <code>Exited (0)</code>.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código, na ordem em que aparece.'],
        check: async (ctx) => {
          const db = D.doProjeto(ctx, 'ordem-demo', 'db');
          const migracao = D.doProjeto(ctx, 'ordem-demo', 'migracao');
          return H.checkAll([
            [() => H.usedCommand(ctx, /docker\s+compose\s+up\s+-d/), 'Suba a stack com <code>docker compose up -d</code>.'],
            [() => H.usedCommand(ctx, /docker\s+compose\s+ps\s+-a/), 'Rode <code>docker compose ps -a</code> para ver o <code>migracao</code> encerrado.'],
            [() => db && db.rodando, 'O <code>db</code> precisa estar rodando.'],
            [() => migracao, 'Não encontrei o container do serviço <code>migracao</code>.'],
            [() => migracao && !migracao.rodando && migracao.saida === 0,
              'O <code>migracao</code> precisa ter terminado com código 0, depois de esperar o <code>db</code> ficar saudável.']
          ]);
        }
      },
      {
        id: 'td13-2-f', kind: 'fill', title: 'A política certa',
        body: [
          { p: 'Você quer que um serviço volte sozinho depois de um reboot do servidor, <strong>mas</strong> continue parado se você o tiver parado à mão para manutenção. Complete:' }
        ],
        template: 'restart: ___', sample: 'unless-stopped',
        answers: ['["\']?unless-stopped["\']?'],
        hints: ['Duas políticas sobem no boot. A diferença entre elas é justamente respeitar, ou não, uma parada manual.'],
        solution: '<code>restart: unless-stopped</code>. A alternativa <code>always</code> também sobe no boot, mas ignora a sua parada manual e traz o container de volta — atrapalhando exatamente a manutenção que você queria fazer.',
        check: (ctx) => {
          const v = (ctx.vals[0] || '').trim().replace(/^["']|["']$/g, '');
          if (!v) return { ok: false, msg: 'Escreva o valor da política.' };
          if (v === 'always') return { ok: false, msg: '<code>always</code> também sobe no boot, mas ressuscita um container que você parou de propósito.' };
          if (v === 'no' || v.startsWith('on-failure')) return { ok: false, msg: 'Essa política não faz o container voltar depois de um reboot do servidor.' };
          return { ok: v === 'unless-stopped', msg: 'Não é essa. Reveja a tabela das políticas de reinício.' };
        }
      },
      {
        id: 'td13-2-b', kind: 'desafio', title: 'A stack que espera de verdade',
        body: [
          { p: 'Em <code>~/ordem</code>, monte uma stack com três serviços:' },
          { ul: [
            '<code>db</code> — <code>mariadb:11.4</code>, com <code>MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO</code> e <code>MARIADB_DATABASE: pedidos</code>, com healthcheck que use <code>mariadb-admin ping</code> autenticado, e <code>restart: unless-stopped</code>;',
            '<code>preparo</code> — <code>alpine:3.21</code>, com <code>command</code> que apenas escreve alguma coisa e termina, dependendo do <code>db</code> com a condição <code>service_healthy</code>, e <code>restart: no</code>;',
            '<code>web</code> — <code>nginx:alpine</code>, publicando a porta <strong>8112</strong> na 80, dependendo do <code>preparo</code> com a condição <code>service_completed_successfully</code>, e <code>restart: unless-stopped</code>.'
          ] },
          { p: 'Ao final: <code>db</code> e <code>web</code> rodando, <code>preparo</code> em <code>Exited (0)</code>, e a 8112 respondendo.' }
        ],
        hints: [
          'A forma longa do <code>depends_on</code> é um mapa: o nome do serviço, e embaixo dele <code>condition:</code>.',
          'Para o <code>preparo</code> terminar sozinho, o comando dele precisa acabar — por exemplo <code>command: sh -c "echo preparado"</code>. Confira com <code>docker compose ps -a</code>, que também mostra containers já encerrados.'
        ],
        solution: '<pre>$ mkdir -p ~/ordem\n$ cd ~/ordem\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: pedidos\n    healthcheck:\n      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]\n      interval: 10s\n      timeout: 5s\n      retries: 5\n      start_period: 30s\n\n  preparo:\n    image: alpine:3.21\n    restart: "no"\n    command: sh -c "echo preparado"\n    depends_on:\n      db:\n        condition: service_healthy\n\n  web:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8112:80"\n    depends_on:\n      preparo:\n        condition: service_completed_successfully\nEOF\n$ docker compose up -d\n$ docker compose ps -a</pre>',
        check: async (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/ordem/compose.yaml');
          const svc = (doc && doc.services) || {};
          const db = D.doProjeto(ctx, 'ordem', 'db');
          const preparo = D.doProjeto(ctx, 'ordem', 'preparo');
          const web = D.doProjeto(ctx, 'ordem', 'web');
          const cond = (nome, dep) => {
            const d = svc[nome] && svc[nome].depends_on;
            if (!d || Array.isArray(d) || !d[dep]) return null;
            return d[dep].condition;
          };
          let estado = 'none';
          if (db && db.rodando) estado = await D.saude(ctx, db.nome);
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/ordem/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => svc.db && svc.preparo && svc.web, 'Faltam serviços: espero <code>db</code>, <code>preparo</code> e <code>web</code>.'],
            [() => svc.db.healthcheck && /mariadb-admin|mysqladmin/.test([].concat(svc.db.healthcheck.test || []).join(' ')),
              'O <code>db</code> precisa de um healthcheck que use <code>mariadb-admin ping</code>.'],
            [() => cond('preparo', 'db') === 'service_healthy',
              'O <code>preparo</code> precisa depender do <code>db</code> com <code>condition: service_healthy</code> (forma longa do <code>depends_on</code>).'],
            [() => cond('web', 'preparo') === 'service_completed_successfully',
              'O <code>web</code> precisa depender do <code>preparo</code> com <code>condition: service_completed_successfully</code>.'],
            [() => db && db.rodando, 'O <code>db</code> não está rodando.'],
            [() => estado === 'healthy', () => 'O <code>db</code> está com saúde <code>' + estado + '</code>, não <code>healthy</code>.'],
            [() => preparo, 'Não encontrei o container do serviço <code>preparo</code>. Use <code>docker compose ps -a</code> para ver os encerrados.'],
            [() => !preparo.rodando, 'O <code>preparo</code> ainda está rodando. Ele deve executar a tarefa e terminar.'],
            [() => preparo.saida === 0, () => 'O <code>preparo</code> terminou com código <code>' + preparo.saida + '</code>; a condição exige saída 0.'],
            [() => web && web.rodando, 'O <code>web</code> não está rodando — a condição de dependência foi satisfeita?'],
            [() => { const r = D.http(ctx, 'localhost', 8112, '/'); return !!r && r.status === 200; }, 'A porta 8112 não respondeu.'],
            [() => db.restart && db.restart.politica === 'unless-stopped' && web.restart && web.restart.politica === 'unless-stopped',
              '<code>db</code> e <code>web</code> precisam de <code>restart: unless-stopped</code>.'],
            [() => !preparo.restart || preparo.restart.politica === 'no',
              'O <code>preparo</code> deve ter <code>restart: "no"</code> — reiniciar uma tarefa concluída não faz sentido.']
          ]);
        }
      }
    ]
  });
})();
