/* =========================================================================
   PROJETO FINAL DE DOCKER — colocar a stack da equipe no ar
   Seis etapas, sem passo a passo: só o requisito, os critérios de aceite e o
   verificador olhando o estado real do ambiente Docker.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== PF.1 ============================== */
  LX.lesson('mpf2', {
    id: 'lpd-1', n: 'PF.1', title: 'O briefing: a stack base no ar',
    goal: 'Receber um chamado de deploy e transformá-lo numa stack Compose funcional — site, banco e administração — sem que ninguém dite o arquivo.',
    body: [
      { h2: 'O que muda daqui para frente' },
      { p: 'Nos vinte e dois módulos anteriores, cada aula tinha um assunto e um desafio sobre aquele assunto. Aqui não. Você recebe <strong>o pedido de uma entrega</strong> e precisa colocá-la no ar. Qual imagem, quais serviços, em que rede, com que cuidados — é decisão sua.' },
      { p: 'É assim que o trabalho chega: alguém descreve o resultado esperado, não o arquivo. Este projeto vale como avaliação final da trilha de Docker.' },
      {
        box: 'key', label: 'Regra do projeto', body: [
          { p: 'Os verificadores <strong>não olham o que você digitou</strong>. Eles inspecionam o ambiente: se o serviço está no ar, se o banco tem volume, se a porta certa responde, se o proxy roteia por domínio, se o backup restaura. Qualquer <code>compose.yaml</code> que produza o estado correto é aceito.' }
        ]
      },

      { h2: 'As seis etapas' },
      {
        table: {
          head: ['Etapa', 'Assunto', 'Módulos que ela cobra'],
          rows: [
            ['<strong>PF.1</strong>', 'a stack base: site, banco e admin', '8, 11'],
            ['<strong>PF.2</strong>', 'segredos fora do repositório', '12'],
            ['<strong>PF.3</strong>', 'o proxy reverso na frente', '14, 15'],
            ['<strong>PF.4</strong>', 'saúde e ordem de subida', '13'],
            ['<strong>PF.5</strong>', 'backup e restauração do banco', '20'],
            ['<strong>PF.6</strong>', 'o incidente em produção', '17, 18, 21']
          ]
        }
      },

      { h2: 'O chamado' },
      { p: 'Você assumiu o servidor <code>srv-loja</code>, recebido por SSH. A equipe vai publicar uma pequena aplicação — a "loja" — e mandou o seguinte pedido:' },
      {
        box: 'note', label: 'Chamado #7720 — subir a stack da loja em srv-loja', body: [
          {
            ul: [
              'Um <strong>site</strong> (por ora, um <code>nginx</code>) acessível para a equipe testar.',
              'Um <strong>banco de dados</strong> MariaDB para a aplicação, chamado <code>loja</code>.',
              'Uma ferramenta de <strong>administração</strong> do banco (o <code>adminer</code>), também acessível.',
              'O banco <strong>não</strong> deve ficar exposto para fora da máquina — só o site e a administração precisam de acesso externo por enquanto.',
              'Os dados do banco <strong>não podem se perder</strong> quando o container for recriado.'
            ]
          }
        ]
      },

      { h2: 'Traduzindo o chamado' },
      {
        table: {
          head: ['Frase do chamado', 'O que isso significa tecnicamente'],
          rows: [
            ['"um site acessível para a equipe"', 'serviço <code>nginx</code> com <code>ports</code> publicando uma porta de host'],
            ['"um banco MariaDB chamado loja"', '<code>mariadb:11.4</code> com <code>MARIADB_DATABASE: loja</code> e senha de root definida'],
            ['"administração também acessível"', '<code>adminer</code> com porta publicada'],
            ['"o banco não deve ficar exposto"', 'o serviço <code>db</code> <strong>sem</strong> bloco <code>ports</code>'],
            ['"os dados não podem se perder"', 'um <strong>volume nomeado</strong> em <code>/var/lib/mysql</code>']
          ]
        }
      },
      { p: 'O chamado nunca disse "use um volume nomeado". Ele descreveu um comportamento — dados que sobrevivem à recriação — e cabe a você lembrar qual recurso entrega isso. Se travar, os módulos 8 e 11 têm a resposta; consultar o material é parte do trabalho, não trapaça.' }
    ],
    tasks: [
      {
        id: 'tpd-1-g', kind: 'guiado', title: 'Confira o servidor antes de mexer',
        body: [
          { p: 'Antes de subir qualquer coisa, veja o que <code>srv-loja</code> já tem — o Docker está pronto? Há algo rodando? É assim que se evita conflitar com o que já existe.' },
          { code: ['$ docker version', '$ docker ps -a', '$ docker network ls'] },
          { p: 'O <code>docker version</code> confirma que o cliente e o serviço estão de pé; o <code>ps -a</code> mostra que a máquina está limpa, sem containers; o <code>network ls</code> lista só as redes padrão. Terreno livre para a stack.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado de cada linha, um comando por vez.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+ps/), 'Rode <code>docker ps -a</code> para ver o estado do servidor.']
        ])
      },
      {
        id: 'tpd-1-q', kind: 'quiz', title: 'Por que o banco fica sem porta',
        body: [{ p: 'O chamado pede que o banco não fique exposto para fora, mas o <code>adminer</code> (que fica na mesma stack) precisa consultá-lo. Como o <code>adminer</code> alcança um banco que não publica porta?' }],
        options: [
          { text: 'Pela rede interna que o Compose cria: todos os serviços da stack estão nela e se acham pelo nome. O <code>adminer</code> conecta em <code>db:3306</code> sem que o banco publique nada para o host. Publicar porta serve só para acesso de <em>fora</em> da máquina.', correct: true },
          { text: 'O <code>adminer</code> não consegue: sem porta publicada, o banco é inalcançável.', why: 'Publicar porta é só para o mundo externo. Dentro da rede do Compose, os serviços se falam pelo nome — é assim que o adminer alcança o db.' },
          { text: 'Só funciona se o <code>db</code> publicar a 3306 no host.', why: 'Isso exporia o banco à máquina sem necessidade, contrariando o chamado. A comunicação interna não precisa de publicação.' },
          { text: 'O Compose copia o banco para dentro do container do adminer.', why: 'Não há cópia; há uma conexão de rede pela rede interna da stack. O adminer consulta o banco ao vivo.' }
        ],
        hints: ['Lembre da diferença entre publicar uma porta (para fora) e a rede interna (entre os serviços).'],
        explain: 'Publicar uma porta (<code>ports</code>) abre um serviço para <em>fora</em> da máquina. A conversa <em>entre</em> containers acontece pela rede interna da stack, onde cada serviço é alcançável pelo próprio nome. Por isso o banco não precisa — e não deve — publicar porta: quem fala com ele são os vizinhos de rede.'
      },
      {
        id: 'tpd-1-a', kind: 'desafio', title: 'A stack base',
        body: [
          { p: 'Em <code>~/loja</code>, entregue a primeira parte do chamado num <code>compose.yaml</code>:' },
          {
            ul: [
              '<code>site</code> — <code>nginx:alpine</code>, publicando a porta de host <strong>8700</strong>;',
              '<code>db</code> — <code>mariadb:11.4</code>, com <code>MARIADB_ROOT_PASSWORD</code> valendo <code>SENHA_DO_BANCO</code> e <code>MARIADB_DATABASE</code> valendo <code>loja</code>, com um <strong>volume nomeado</strong> em <code>/var/lib/mysql</code>, e <strong>sem publicar porta</strong>;',
              '<code>admin</code> — <code>adminer:5</code>, publicando a porta de host <strong>8701</strong>.'
            ]
          },
          { p: 'Ao final: os três serviços no ar; site na 8700, admin na 8701, banco sem porta e com o volume montado.' }
        ],
        hints: [
          'Não esqueça a seção <code>volumes:</code> no fim do arquivo declarando o volume nomeado que você montou no <code>db</code>.',
          'O <code>db</code> não leva bloco <code>ports</code> — é isso que o mantém interno. Suba com <code>docker compose up -d</code> em <code>~/loja</code>.'
        ],
        solution: '<div class="code"><pre>$ mkdir -p ~/loja && cd ~/loja\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8700:80"\n\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: loja\n    volumes:\n      - dados:/var/lib/mysql\n\n  admin:\n    image: adminer:5\n    restart: unless-stopped\n    ports:\n      - "8701:8080"\n\nvolumes:\n  dados:\nEOF\n$ docker compose up -d\n$ docker compose ps</pre></div><p style="margin-top:8px">Qualquer nome de volume serve, desde que ele apareça na seção <code>volumes:</code> e na montagem do <code>db</code>. O que importa é o estado final: dados fora da camada do container.</p>',
        check: (ctx) => {
          const site = D.doProjeto(ctx, 'loja', 'site');
          const db = D.doProjeto(ctx, 'loja', 'db');
          const admin = D.doProjeto(ctx, 'loja', 'admin');
          const vol = db ? (db.montagens || []).find(m => m.tipo === 'volume' && !m.anonimo && LX.FileSystem.normalize(m.destino) === '/var/lib/mysql') : null;
          return H.checkAll([
            [() => !!site && site.rodando, 'O serviço <code>site</code> não está rodando em <code>~/loja</code>.'],
            [() => !!db && db.rodando, 'O serviço <code>db</code> não está rodando.'],
            [() => !!admin && admin.rodando, 'O serviço <code>admin</code> não está rodando.'],
            [() => !!site && D.publicada(ctx, site.nome, 8700), 'O <code>site</code> precisa publicar a porta de host 8700.'],
            [() => !!admin && D.publicada(ctx, admin.nome, 8701), 'O <code>admin</code> precisa publicar a porta de host 8701.'],
            [() => !!db && (db.portas || []).length === 0, 'O <code>db</code> não deve publicar porta nenhuma — ele é interno.'],
            [() => !!D.env(ctx, db ? db.nome : '', 'MARIADB_DATABASE') && D.env(ctx, db.nome, 'MARIADB_DATABASE') === 'loja', 'O banco precisa ter <code>MARIADB_DATABASE: loja</code>.'],
            [() => !!vol, 'Falta o volume nomeado montado em <code>/var/lib/mysql</code> no <code>db</code> (com a seção <code>volumes:</code> declarando-o).']
          ]);
        }
      }
    ]
  });

  /* ============================== PF.2 ============================== */
  LX.lesson('mpf2', {
    id: 'lpd-2', n: 'PF.2', title: 'Segredos fora do repositório',
    goal: 'Tirar a senha do banco de dentro do compose e do controle de versão, entregando-a por um secret de arquivo — do jeito que produção exige.',
    setup: (m) => {
      if (!m.docker) return;
      D.pasta(m, '/home/aluno/loja');
      D.arquivo(m, '/home/aluno/loja/compose.yaml',
        'services:\n' +
        '  db:\n' +
        '    image: mariadb:11.4\n' +
        '    restart: unless-stopped\n' +
        '    environment:\n' +
        '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n' +
        '      MARIADB_DATABASE: loja\n' +
        '    volumes:\n' +
        '      - dados:/var/lib/mysql\n' +
        'volumes:\n' +
        '  dados:\n');
    },
    body: [
      { h2: 'A senha não pode morar no compose' },
      { p: 'A stack base funciona, mas tem um problema que só aparece quando o projeto vai para o Git: a senha do banco está escrita, em texto puro, dentro do <code>compose.yaml</code> — o arquivo que todo mundo versiona e compartilha. No primeiro <code>git push</code>, o segredo vaza para o histórico, onde é praticamente impossível apagar de verdade.' },
      { p: 'A saída que você viu no módulo 12 é o <strong>secret de arquivo</strong>: a senha fica num arquivo separado, que <strong>não</strong> vai para o Git, e o Compose a injeta no container por baixo. O banco lê a senha de um caminho em vez de uma variável.' },
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
        box: 'key', label: 'A variável ganha o sufixo _FILE', body: [
          { p: 'A imagem do MariaDB aceita <code>MARIADB_ROOT_PASSWORD</code> (o valor direto) <strong>ou</strong> <code>MARIADB_ROOT_PASSWORD_FILE</code> (um caminho de onde ler o valor). O secret é montado dentro do container em <code>/run/secrets/&lt;nome&gt;</code>, e é para lá que a variável <code>_FILE</code> aponta. Assim, o valor real nunca aparece no <code>compose.yaml</code> nem no <code>docker inspect</code> do ambiente.' }
        ]
      },
      {
        box: 'warn', label: 'O segredo e o .gitignore andam juntos', body: [
          { p: 'Mover a senha para <code>segredos/senha_db.txt</code> só resolve se esse arquivo <strong>não</strong> for versionado. Sem uma linha no <code>.gitignore</code> excluindo a pasta <code>segredos/</code>, você apenas trocou o lugar do vazamento. O par é sempre: secret de arquivo <em>e</em> <code>.gitignore</code> cobrindo o arquivo do secret.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tpd-2-g', kind: 'guiado', title: 'Veja o segredo exposto',
        body: [
          { p: 'A stack em <code>~/loja</code> hoje guarda a senha em texto no compose. Confirme o problema antes de consertar:' },
          { code: [
            '$ cd ~/loja',
            '$ grep -n MARIADB_ROOT_PASSWORD compose.yaml',
            '$ ls -a'
          ] },
          { p: 'O <code>grep</code> mostra a senha escrita ali, à vista de qualquer um que abra o arquivo. E não há <code>.gitignore</code> nenhum — ou seja, se isto virasse um repositório, o segredo iria junto no primeiro commit.' }
        ],
        hints: ['Um <code>grep</code> por <code>MARIADB_ROOT_PASSWORD</code> no <code>compose.yaml</code> revela o segredo em texto puro.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /grep|cat/), 'Olhe o <code>compose.yaml</code> (com <code>grep</code> ou <code>cat</code>) para ver a senha exposta.']
        ])
      },
      {
        id: 'tpd-2-q', kind: 'quiz', title: 'Por que _FILE e não a variável direta',
        body: [{ p: 'Usar <code>MARIADB_ROOT_PASSWORD_FILE</code> apontando para <code>/run/secrets/senha_db</code>, em vez de <code>MARIADB_ROOT_PASSWORD</code> com o valor, ganha o quê exatamente?' }],
        options: [
          { text: 'O valor real da senha some do <code>compose.yaml</code> e do ambiente do container: fica só num arquivo separado, fora do Git. A imagem lê a senha do caminho montado, então nada sensível aparece no arquivo versionado nem no <code>docker inspect</code>.', correct: true },
          { text: 'A versão <code>_FILE</code> criptografa a senha automaticamente.', why: 'Não há criptografia: o arquivo do secret é texto puro. O ganho é <em>onde</em> ele fica — fora do compose e do Git —, não uma cifra.' },
          { text: 'Só a forma <code>_FILE</code> funciona com o MariaDB; a variável direta é inválida.', why: 'As duas formas funcionam. A direta é cômoda para testes locais; a <code>_FILE</code> é a que mantém o segredo fora do arquivo versionado.' },
          { text: 'A forma <code>_FILE</code> dispensa o <code>.gitignore</code>.', why: 'Ao contrário: ela depende do <code>.gitignore</code> excluir o arquivo do secret. Sem isso, o segredo volta a vazar, agora de outro arquivo.' }
        ],
        hints: ['Pense no que aparece — e no que deixa de aparecer — no arquivo que vai para o Git.'],
        explain: 'O secret de arquivo separa o <em>valor</em> do segredo da <em>configuração</em> da stack. O <code>compose.yaml</code> passa a referir um arquivo (<code>./segredos/senha_db.txt</code>), e é esse arquivo — coberto pelo <code>.gitignore</code> — que carrega a senha. Assim o repositório descreve a stack sem nunca conter o segredo.'
      },
      {
        id: 'tpd-2-a', kind: 'desafio', title: 'Tire a senha do compose',
        body: [
          { p: 'Reescreva a stack em <code>~/loja</code> para o banco ler a senha de um secret de arquivo, e garanta que o segredo não seria versionado:' },
          {
            ul: [
              'crie o arquivo <code>segredos/senha_db.txt</code> com o conteúdo <code>SENHA_DO_BANCO</code>;',
              'no <code>compose.yaml</code>, declare um secret <code>senha_db</code> apontando para esse arquivo, e faça o serviço <code>db</code> usá-lo via <code>MARIADB_ROOT_PASSWORD_FILE</code> (sem mais nenhuma <code>MARIADB_ROOT_PASSWORD</code> em texto);',
              'crie um <code>.gitignore</code> que exclua a pasta <code>segredos/</code>;',
              'suba a stack e confirme que o banco fica no ar lendo a senha do secret.'
            ]
          },
          { p: 'Ao final: o <code>db</code> rodando; o <code>compose.yaml</code> sem a senha em texto; o secret <code>senha_db</code> definido; e o <code>.gitignore</code> cobrindo <code>segredos/</code>.' }
        ],
        hints: [
          'O valor da senha vai para <code>segredos/senha_db.txt</code>; o <code>compose.yaml</code> só cita o <em>nome</em> do arquivo, nunca a senha.',
          'A imagem lê de <code>/run/secrets/senha_db</code> — é para lá que o <code>MARIADB_ROOT_PASSWORD_FILE</code> aponta. Recrie com <code>docker compose up -d --force-recreate</code>.'
        ],
        solution: '<div class="code"><pre>$ cd ~/loja\n$ mkdir -p segredos\n$ printf "SENHA_DO_BANCO" &gt; segredos/senha_db.txt\n$ printf "segredos/\\n.env\\n" &gt; .gitignore\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD_FILE: /run/secrets/senha_db\n      MARIADB_DATABASE: loja\n    volumes:\n      - dados:/var/lib/mysql\n    secrets:\n      - senha_db\n\nsecrets:\n  senha_db:\n    file: ./segredos/senha_db.txt\n\nvolumes:\n  dados:\nEOF\n$ docker compose up -d --force-recreate\n$ docker compose ps\n$ docker compose exec db mariadb -uroot -pSENHA_DO_BANCO -e "SHOW DATABASES;"</pre></div><p style="margin-top:8px">O último comando prova que a senha lida do secret é a esperada: o banco aceita a conexão. O valor real só existe no arquivo ignorado pelo Git.</p>',
        check: (ctx) => {
          const db = D.doProjeto(ctx, 'loja', 'db');
          const compose = D.compose(ctx, '/home/aluno/loja/compose.yaml');
          const gitignore = H.read(ctx, '/home/aluno/loja/.gitignore') || '';
          const composeTexto = (() => { try { return (ctx.machine || ctx.sh.m).fs.readFile('/home/aluno/loja/compose.yaml', { ctx: (ctx.machine || ctx.sh.m).ctxRoot() }); } catch (e) { return ''; } })();
          return H.checkAll([
            [() => !!db && db.rodando, 'O serviço <code>db</code> não está no ar. Recrie a stack depois de reescrever o compose.'],
            [() => !!compose && !compose.erroYaml, () => 'O <code>compose.yaml</code> não é um YAML válido: <code>' + ((compose && compose.erroYaml) || '') + '</code>'],
            [() => compose && compose.secrets && compose.secrets.senha_db, 'Falta declarar o secret <code>senha_db</code> na seção <code>secrets:</code> do compose.'],
            [() => /MARIADB_ROOT_PASSWORD_FILE/.test(composeTexto), 'O <code>db</code> precisa usar <code>MARIADB_ROOT_PASSWORD_FILE</code> apontando para o secret.'],
            [() => !/MARIADB_ROOT_PASSWORD\s*:/.test(composeTexto), 'Ainda há uma <code>MARIADB_ROOT_PASSWORD</code> com valor em texto no compose. Deixe apenas a forma <code>_FILE</code>.'],
            [() => !!H.read(ctx, '/home/aluno/loja/segredos/senha_db.txt'), 'Falta o arquivo do secret em <code>segredos/senha_db.txt</code>.'],
            [() => /segredos\/?/.test(gitignore), 'O <code>.gitignore</code> precisa excluir a pasta <code>segredos/</code>, senão o segredo ainda seria versionado.']
          ]);
        }
      }
    ]
  });

  /* ============================== PF.3 ============================== */
  LX.lesson('mpf2', {
    id: 'lpd-3', n: 'PF.3', title: 'O proxy reverso na frente',
    goal: 'Pôr um Traefik como único ponto de entrada, roteando o site por domínio, com os serviços de trás sem porta publicada.',
    body: [
      { h2: 'De portas soltas a um portão só' },
      { p: 'Na stack base, o site publicava a 8700 e o admin a 8701 — duas portas do host abertas. Em produção isso não escala: cada serviço novo é mais uma porta, e o acesso por domínio (<code>loja.local</code>, <code>admin.local</code>) fica impossível. A resposta é o <strong>proxy reverso</strong>: um Traefik na frente, dono da porta 80, que recebe tudo e roteia por <code>Host</code> para o serviço certo — que, por sua vez, deixa de publicar porta.' },
      {
        code: [
          'services:',
          '  traefik:',
          '    image: traefik:v3.7',
          '    restart: unless-stopped',
          '    command:',
          '      - "--providers.docker=true"',
          '      - "--providers.docker.exposedByDefault=false"',
          '      - "--entrypoints.web.address=:80"',
          '    ports:',
          '      - "80:80"',
          '    volumes:',
          '      - /var/run/docker.sock:/var/run/docker.sock:ro',
          '',
          '  site:',
          '    image: nginx:alpine',
          '    restart: unless-stopped',
          '    labels:',
          '      - "traefik.enable=true"',
          '      - "traefik.http.routers.site.rule=Host(`loja.local`)"',
          '      - "traefik.http.routers.site.entrypoints=web"',
          '      - "traefik.http.services.site.loadbalancer.server.port=80"'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'As três labels que ligam um serviço ao Traefik', body: [
          { ul: [
            '<code>traefik.enable=true</code> — com <code>exposedByDefault=false</code>, sem esta label o serviço é ignorado pelo proxy;',
            '<code>...routers.&lt;nome&gt;.rule=Host(`loja.local`)</code> — a condição que faz o tráfego daquele domínio cair neste serviço;',
            '<code>...services.&lt;nome&gt;.loadbalancer.server.port=80</code> — a porta <em>interna</em> em que o serviço escuta (o nginx: 80).'
          ] }
        ]
      },
      {
        box: 'warn', label: 'O socket vai somente leitura', body: [
          { p: 'O Traefik lê o socket <code>/var/run/docker.sock</code> para descobrir os serviços e suas labels — montado <strong>somente leitura</strong> (<code>:ro</code>). Quem tem escrita no socket controla o Docker do host inteiro; o proxy só precisa <em>ler</em> a lista. É o cuidado do módulo 17 aplicado onde ele mais conta.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tpd-3-g', kind: 'guiado', title: 'Suba o proxy e roteie por domínio',
        body: [
          { p: 'Monte um Traefik com um site atrás e veja o roteamento por <code>Host</code> funcionar:' },
          { code: [
            '$ mkdir -p ~/frente && cd ~/frente',
            '# (use o compose.yaml da aula)',
            '$ docker compose up -d',
            '$ curl -sI -H "Host: loja.local" http://localhost/',
            '$ curl -sI -H "Host: naoexiste.local" http://localhost/'
          ] },
          { p: 'A requisição com <code>Host: loja.local</code> chega ao site e responde; um host desconhecido leva 404, porque nenhum router casou. O site respondeu sem publicar porta — quem tem a 80 é só o Traefik.' }
        ],
        hints: ['Com <code>exposedByDefault=false</code>, o site precisa da label <code>traefik.enable=true</code>. Teste com <code>curl -H "Host: loja.local" http://localhost/</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba a stack com <code>docker compose up -d</code> em <code>~/frente</code>.']
        ])
      },
      {
        id: 'tpd-3-q', kind: 'quiz', title: 'O 404 e o 502',
        body: [{ p: 'Depois de subir o proxy, uma requisição com o <code>Host</code> certo devolve <strong>502 Bad Gateway</strong> em vez de responder. O que isso costuma indicar?' }],
        options: [
          { text: 'O Traefik casou o router, mas não conseguiu falar com o serviço de trás: porta interna errada na label <code>loadbalancer.server.port</code>, ou os dois não compartilham rede. Um 404 seria "nenhum router casou"; o 502 é "casou, mas o destino não respondeu".', correct: true },
          { text: 'O domínio não foi reconhecido por nenhuma regra.', why: 'Isso daria 404, não 502. O 502 significa que a regra casou e o Traefik <em>tentou</em> encaminhar, mas o serviço de trás não atendeu.' },
          { text: 'Falta publicar a porta do site no host.', why: 'O ponto do proxy é justamente o site não publicar porta. O 502 não é sobre publicação — é o Traefik não alcançar a porta <em>interna</em> correta do serviço.' },
          { text: 'O socket do Docker não foi montado.', why: 'Sem o socket, o Traefik nem descobriria o serviço e daria 404 (nenhum router). O 502 aparece depois: o router existe, mas o destino falhou.' }
        ],
        hints: ['Separe "nenhuma regra casou" de "a regra casou mas o destino não respondeu".'],
        explain: '404 e 502 contam histórias diferentes. <strong>404</strong>: nenhum router casou — regra de <code>Host</code> errada, <code>traefik.enable</code> faltando, entryPoint trocado. <strong>502</strong>: o router casou, mas o Traefik não alcançou o serviço — porta interna errada na label do <code>loadbalancer</code>, ou proxy e serviço em redes diferentes. O log do Traefik (<code>docker logs</code>) aponta qual foi.'
      },
      {
        id: 'tpd-3-a', kind: 'desafio', title: 'Coloque a loja atrás do proxy',
        body: [
          { p: 'Em <code>~/proxy-loja</code>, monte a stack com o Traefik na frente:' },
          {
            ul: [
              '<code>traefik</code> — <code>traefik:v3.7</code>, publicando a porta <strong>80</strong>, com o socket do Docker montado somente leitura, provider Docker com <code>exposedByDefault=false</code> e um entryPoint <code>web</code> na porta 80;',
              '<code>site</code> — <code>nginx:alpine</code>, <strong>sem publicar porta</strong>, com labels que criem um router respondendo por <code>Host(`loja.local`)</code> no entryPoint <code>web</code> e um service na porta interna 80.'
            ]
          },
          { p: 'Ao final: o Traefik publicando a 80; uma requisição com <code>Host: loja.local</code> respondendo 200; um host desconhecido recebendo 404; e o <code>site</code> sem porta publicada.' }
        ],
        hints: [
          'Aproveite o <code>compose.yaml</code> da aula — ele já tem o Traefik e o site no formato certo.',
          'A crase de <code>Host(`loja.local`)</code> precisa estar dentro de uma label entre aspas; o socket vai com <code>:ro</code> no fim.'
        ],
        solution: '<div class="code"><pre>$ mkdir -p ~/proxy-loja && cd ~/proxy-loja\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    restart: unless-stopped\n    command:\n      - "--providers.docker=true"\n      - "--providers.docker.exposedByDefault=false"\n      - "--entrypoints.web.address=:80"\n    ports:\n      - "80:80"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\n\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.site.rule=Host(`loja.local`)"\n      - "traefik.http.routers.site.entrypoints=web"\n      - "traefik.http.services.site.loadbalancer.server.port=80"\nEOF\n$ docker compose up -d\n$ curl -sI -H "Host: loja.local" http://localhost/\n$ curl -sI -H "Host: naoexiste.local" http://localhost/</pre></div><p style="margin-top:8px">O site nunca publica porta: o único ponto de entrada é a 80 do Traefik, que decide, pelo <code>Host</code>, para onde o tráfego vai.</p>',
        check: (ctx) => {
          const tf = D.doProjeto(ctx, 'proxy-loja', 'traefik');
          const site = D.doProjeto(ctx, 'proxy-loja', 'site');
          const certo = D.http(ctx, 'localhost', 80, '/', { Host: 'loja.local' });
          const errado = D.http(ctx, 'localhost', 80, '/', { Host: 'naoexiste.local' });
          const sock = tf ? (tf.montagens || []).find(m => /docker\.sock$/.test(m.destino)) : null;
          return H.checkAll([
            [() => !!tf && tf.rodando, 'O serviço <code>traefik</code> não está rodando.'],
            [() => !!site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => !!tf && D.publicada(ctx, tf.nome, 80), 'O <code>traefik</code> precisa publicar a porta 80.'],
            [() => !!site && (site.portas || []).length === 0, 'O <code>site</code> não deve publicar porta — quem recebe de fora é o proxy.'],
            [() => !!sock, 'Falta montar o socket <code>/var/run/docker.sock</code> no Traefik.'],
            [() => !!sock && sock.ro, 'Monte o socket do Docker como somente leitura (<code>:ro</code>).'],
            [() => !!site && (site.labels || {})['traefik.enable'] === 'true', 'Falta a label <code>traefik.enable=true</code> no <code>site</code>.'],
            [() => !!certo && certo.status === 200, () => 'A requisição com <code>Host: loja.local</code> respondeu <code>' + (certo ? certo.status : 'nada') + '</code> em vez de 200.'],
            [() => !!errado && errado.status === 404, 'Um host desconhecido deveria receber 404 — confira a regra <code>Host()</code> do router.']
          ]);
        }
      }
    ]
  });

  /* ============================== PF.4 ============================== */
  LX.lesson('mpf2', {
    id: 'lpd-4', n: 'PF.4', title: 'Saúde e ordem de subida',
    goal: 'Fazer o Compose saber quando o banco está pronto de verdade e só então subir quem depende dele — com healthcheck, depends_on e reinício.',
    body: [
      { h2: 'Rodando não é o mesmo que pronto' },
      { p: 'Um container de banco fica <code>Up</code> em um segundo, mas o MariaDB leva mais alguns até aceitar conexões. Se a aplicação sobe junto e tenta conectar nesse intervalo, ela falha na largada. O <strong>healthcheck</strong> resolve: ele ensina o Compose a perguntar "você já aceita conexões?" — e o <code>depends_on</code> com <code>condition: service_healthy</code> segura quem depende até a resposta ser sim.' },
      {
        code: [
          'services:',
          '  db:',
          '    image: mariadb:11.4',
          '    restart: unless-stopped',
          '    environment:',
          '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
          '      MARIADB_DATABASE: loja',
          '    healthcheck:',
          '      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]',
          '      interval: 10s',
          '      timeout: 5s',
          '      retries: 5',
          '      start_period: 30s',
          '',
          '  preparo:',
          '    image: alpine:3.21',
          '    command: sh -c "echo banco pronto"',
          '    depends_on:',
          '      db:',
          '        condition: service_healthy'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'O healthcheck precisa autenticar', body: [
          { p: 'Um teste que só verifica se a porta 3306 abriu prova pouco — a porta abre antes de o banco aceitar login. Por isso o <code>mariadb-admin ping</code> vai com usuário e senha: ele só passa quando o servidor está realmente pronto para consultas. Um healthcheck fraco é quase tão ruim quanto nenhum.' }
        ]
      },
      {
        box: 'note', label: 'depends_on sozinho não espera a saúde', body: [
          { p: 'Um <code>depends_on: [db]</code> simples só garante a <em>ordem de criação</em> — o Compose sobe o db antes, mas não espera ele ficar pronto. Para esperar de verdade é preciso a forma longa, com <code>condition: service_healthy</code>, que se apoia no healthcheck. Sem healthcheck, não há "healthy" para aguardar.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tpd-4-g', kind: 'guiado', title: 'Veja a saúde do banco mudar',
        body: [
          { p: 'Suba um banco com healthcheck e observe o estado de saúde:' },
          { code: [
            '$ mkdir -p ~/saude && cd ~/saude',
            '# (use o compose.yaml da aula)',
            '$ docker compose up -d',
            '$ docker compose ps',
            '$ docker inspect saude-db-1 --format "{{.State.Health.Status}}"'
          ] },
          { p: 'O <code>ps</code> mostra o banco como <code>healthy</code> quando o healthcheck passa, e o <code>preparo</code> só roda depois disso — foi o <code>depends_on: service_healthy</code> que o segurou até o banco estar pronto.' }
        ],
        hints: ['Depois do <code>up -d</code>, veja a coluna de saúde no <code>docker compose ps</code> ou pelo <code>docker inspect</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba a stack com <code>docker compose up -d</code> em <code>~/saude</code>.']
        ])
      },
      {
        id: 'tpd-4-q', kind: 'quiz', title: 'Por que a forma longa do depends_on',
        body: [{ p: 'Você quer que a aplicação só suba quando o banco estiver aceitando conexões. Um <code>depends_on: [db]</code> na forma curta basta?' }],
        options: [
          { text: 'Não: a forma curta só garante a ordem de criação — o Compose cria o db primeiro, mas não espera ele ficar pronto. Para aguardar a prontidão é preciso a forma longa com <code>condition: service_healthy</code>, que depende de um healthcheck no db.', correct: true },
          { text: 'Sim: <code>depends_on</code> sempre espera o serviço estar pronto antes de subir o próximo.', why: 'A forma curta não espera prontidão — só ordena a criação. O container do db pode estar "Up" e ainda não aceitar conexões; a app subiria cedo demais.' },
          { text: 'Sim, desde que o db tenha <code>restart: always</code>.', why: 'A política de reinício não tem relação com esperar a saúde. Quem faz a app aguardar é o <code>condition: service_healthy</code> apoiado no healthcheck.' },
          { text: 'Não, e a solução é pôr um <code>sleep</code> na aplicação.', why: 'Um <code>sleep</code> fixo é um chute: às vezes curto demais, às vezes desperdício. O healthcheck + <code>service_healthy</code> espera exatamente o necessário, nem mais nem menos.' }
        ],
        hints: ['Diferencie "criar na ordem certa" de "esperar ficar pronto".'],
        explain: 'A forma curta do <code>depends_on</code> ordena a criação, não a prontidão — e "Up" não é "pronto". A forma longa, <code>condition: service_healthy</code>, faz o Compose aguardar o healthcheck do serviço virar <code>healthy</code> antes de subir quem depende. Por isso os dois andam juntos: o healthcheck define o que é "pronto", e o <code>depends_on</code> longo espera por ele.'
      },
      {
        id: 'tpd-4-a', kind: 'desafio', title: 'Só suba a app com o banco pronto',
        body: [
          { p: 'Em <code>~/ordem</code>, monte uma stack em que a aplicação só suba com o banco saudável:' },
          {
            ul: [
              '<code>db</code> — <code>mariadb:11.4</code>, com <code>MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO</code> e <code>MARIADB_DATABASE: loja</code>, <code>restart: unless-stopped</code>, e um <strong>healthcheck</strong> que use <code>mariadb-admin ping</code> <em>autenticado</em>;',
              '<code>app</code> — <code>alpine:3.21</code>, com <code>command: sh -c "echo iniciada"</code>, que só suba quando o <code>db</code> estiver <strong>saudável</strong> (<code>depends_on</code> na forma longa, <code>condition: service_healthy</code>).'
            ]
          },
          { p: 'Ao final: o <code>db</code> no ar e saudável, com healthcheck configurado; e o <code>app</code> declarando depender da saúde do <code>db</code>.' }
        ],
        hints: [
          'O healthcheck vai em <code>test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]</code>.',
          'No <code>app</code>, use a forma longa: <code>depends_on:</code> → <code>db:</code> → <code>condition: service_healthy</code>.'
        ],
        solution: '<div class="code"><pre>$ mkdir -p ~/ordem && cd ~/ordem\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: loja\n    healthcheck:\n      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]\n      interval: 10s\n      timeout: 5s\n      retries: 5\n      start_period: 30s\n\n  app:\n    image: alpine:3.21\n    command: sh -c "echo iniciada"\n    depends_on:\n      db:\n        condition: service_healthy\nEOF\n$ docker compose up -d\n$ docker compose ps -a</pre></div><p style="margin-top:8px">O <code>app</code> só é criado depois de o <code>db</code> virar <code>healthy</code>. Sem o healthcheck, não haveria "healthy" para o <code>depends_on</code> esperar.</p>',
        check: (ctx) => {
          const db = D.doProjeto(ctx, 'ordem', 'db');
          const compose = D.compose(ctx, '/home/aluno/ordem/compose.yaml');
          const svc = compose && compose.services ? compose.services : {};
          const teste = svc.db && svc.db.healthcheck ? [].concat(svc.db.healthcheck.test || []).join(' ') : '';
          const dep = (svc.app && svc.app.depends_on) ? svc.app.depends_on : null;
          let cond = null;
          if (dep && typeof dep === 'object' && dep.db) cond = dep.db.condition;
          return H.checkAll([
            [() => !!compose && !compose.erroYaml, () => 'O <code>compose.yaml</code> não é válido: <code>' + ((compose && compose.erroYaml) || '') + '</code>'],
            [() => !!db && db.rodando, 'O serviço <code>db</code> não está no ar em <code>~/ordem</code>.'],
            [() => !!db && !!db.saudeConfig, 'O <code>db</code> precisa de um healthcheck configurado.'],
            [() => /mariadb-admin|mysqladmin/.test(teste), 'O healthcheck do <code>db</code> deve usar <code>mariadb-admin ping</code>.'],
            [() => /-p/.test(teste) && /ping/.test(teste), 'O healthcheck precisa autenticar (usuário e senha), não só testar a porta.'],
            [() => !!svc.app, 'Falta o serviço <code>app</code> na stack.'],
            [() => cond === 'service_healthy', 'O <code>app</code> precisa depender do <code>db</code> na forma longa, com <code>condition: service_healthy</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== PF.5 ============================== */
  LX.lesson('mpf2', {
    id: 'lpd-5', n: 'PF.5', title: 'Backup e restauração do banco',
    goal: 'Provar que a loja tem uma rede de segurança: gerar um dump do banco, perder dados e trazê-los de volta a partir do arquivo.',
    setup: (m) => {
      if (!m.docker) return;
      const c = D.montar(m, {
        nome: 'loja-db', imagem: 'mariadb:11.4',
        env: { MARIADB_ROOT_PASSWORD: 'SENHA_DO_BANCO', MARIADB_DATABASE: 'loja' }
      });
      if (c && c.banco) {
        c.banco.executarLote(
          'CREATE TABLE pedidos (id INT PRIMARY KEY AUTO_INCREMENT, cliente VARCHAR(50), total INT);' +
          "INSERT INTO pedidos (cliente, total) VALUES ('Ana', 4200), ('Bruno', 1800), ('Carla', 9500), ('Diego', 3100);");
        if (c.banco._persistir) c.banco._persistir();
      }
    },
    body: [
      { h2: 'O backup que ninguém testou não existe' },
      { p: 'A loja está no ar, e o banco já tem pedidos. A pergunta que separa um serviço amador de um profissional é: se o banco corromper agora, você recupera? A única resposta honesta é <strong>ter testado a restauração</strong>. Copiar os arquivos de <code>/var/lib/mysql</code> com o banco no ar é arriscado — eles mudam a cada escrita. O caminho seguro é o <strong>dump lógico</strong>: pedir ao banco o SQL que reconstrói tudo.' },
      {
        code: [
          '# gera o dump do banco loja e salva no host',
          'docker exec loja-db mariadb-dump -uroot -pSENHA_DO_BANCO loja > backup.sql',
          '',
          '# restaura: manda o SQL de volta para dentro (o -i abre a entrada)',
          'docker exec -i loja-db mariadb -uroot -pSENHA_DO_BANCO loja < backup.sql'
        ], run: false
      },
      {
        box: 'key', label: 'O dump sai; a restauração entra', body: [
          { p: 'No backup, o <code>&gt; backup.sql</code> é do <em>seu</em> shell: o <code>mariadb-dump</code> roda dentro do container, mas o arquivo cai na sua máquina, fora do container que ele protege. Na restauração, o fluxo <em>entra</em>, e aí o <code>docker exec -i</code> é obrigatório — é o <code>-i</code> que mantém a entrada padrão aberta para o arquivo chegar ao cliente lá dentro.' }
        ]
      },
      {
        box: 'note', label: 'Restaurar num banco de teste primeiro', body: [
          { p: 'Em produção, você não restaura por cima do banco vivo para "ver se funciona". Restaura num banco de teste, confere que os dados vieram, e só então confia no dump. Um arquivo corrompido ou truncado só se revela quando você tenta usá-lo — o melhor momento para descobrir isso é num teste, não no incidente.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tpd-5-g', kind: 'guiado', title: 'Faça o ciclo completo num banco de teste',
        body: [
          { p: 'Prove o par backup/restauração sem risco, num banco separado:' },
          { code: [
            '$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO -e "CREATE DATABASE teste;"',
            '$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO teste -e "CREATE TABLE t (id INT PRIMARY KEY AUTO_INCREMENT, v VARCHAR(20));"',
            '$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO teste -e "INSERT INTO t (v) VALUES (\'ok\');"',
            '$ docker exec loja-db mariadb-dump -uroot -pSENHA_DO_BANCO teste > ~/teste.sql',
            '$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO teste -e "DROP TABLE t;"',
            '$ docker exec -i loja-db mariadb -uroot -pSENHA_DO_BANCO teste < ~/teste.sql',
            '$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO teste -e "SELECT * FROM t;"'
          ] },
          { p: 'Você criou dados, guardou o dump, apagou a tabela e a trouxe de volta pelo arquivo. O último <code>SELECT</code> mostra o dado de volta — a prova de que o backup presta.' }
        ],
        hints: ['O <code>mariadb-dump ... &gt; arquivo</code> guarda; o <code>mariadb ... &lt; arquivo</code> (com <code>docker exec -i</code>) restaura.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /mariadb-dump/), 'Gere um dump com <code>docker exec loja-db mariadb-dump ... &gt; arquivo</code>.']
        ])
      },
      {
        id: 'tpd-5-q', kind: 'quiz', title: 'Por que o dump, e não copiar os arquivos',
        body: [{ p: 'Por que gerar um dump com <code>mariadb-dump</code> é mais seguro do que copiar os arquivos de <code>/var/lib/mysql</code> com o banco no ar?' }],
        options: [
          { text: 'Com o banco ativo, esses arquivos mudam a cada escrita; uma cópia pode pegá-los no meio de uma transação e sair inconsistente. O dump lógico pede ao banco um retrato coerente, em SQL que recria tudo.', correct: true },
          { text: 'O dump é sempre menor que os arquivos.', why: 'Nem sempre — dumps de texto podem ser grandes. A vantagem central é a consistência e a portabilidade do SQL, não o tamanho.' },
          { text: 'Copiar arquivos de um container é impossível.', why: 'É possível (com o container parado, inclusive). O problema não é possibilidade, é a inconsistência de copiar com o banco escrevendo.' },
          { text: 'Os arquivos de <code>/var/lib/mysql</code> nunca podem ser restaurados.', why: 'Podem, com o banco parado e a mesma versão. Mas o dump lógico é mais seguro com o banco no ar e mais portável.' }
        ],
        hints: ['Pense no que acontece com os arquivos de dados enquanto o banco recebe escritas.'],
        explain: 'Um backup precisa de um retrato coerente num instante. Copiar arquivos de dados com o servidor escrevendo neles arrisca um estado quebrado, no meio de uma operação. O <code>mariadb-dump</code> conversa com o banco e emite o SQL (<code>CREATE TABLE</code> + <code>INSERT</code>) que reconstrói os dados de forma consistente — e o <code>&gt; arquivo</code> guarda esse SQL fora do container.'
      },
      {
        id: 'tpd-5-a', kind: 'desafio', title: 'Salve os pedidos e prove a volta',
        body: [
          { p: 'O banco <code>loja</code> (no container <code>loja-db</code>) tem a tabela <code>pedidos</code> com quatro pedidos. Faça a rede de segurança completa:' },
          {
            ul: [
              'gere um backup do banco <code>loja</code> no arquivo <code>~/loja-backup.sql</code>;',
              'simule o acidente: apague a tabela <code>pedidos</code> com <code>DROP TABLE</code>;',
              'restaure a tabela a partir do seu backup.'
            ]
          },
          { p: 'Ao final: o arquivo <code>~/loja-backup.sql</code> precisa existir e a tabela <code>pedidos</code> precisa estar de volta, com os quatro pedidos originais.' }
        ],
        hints: [
          'Backup: <code>docker exec loja-db mariadb-dump -uroot -pSENHA_DO_BANCO loja &gt; ~/loja-backup.sql</code>.',
          'Restauração: <code>docker exec -i loja-db mariadb -uroot -pSENHA_DO_BANCO loja &lt; ~/loja-backup.sql</code> — o <code>-i</code> é o que deixa o arquivo entrar.'
        ],
        solution: '<div class="code"><pre>$ docker exec loja-db mariadb-dump -uroot -pSENHA_DO_BANCO loja &gt; ~/loja-backup.sql\n$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO loja -e "DROP TABLE pedidos;"\n$ docker exec -i loja-db mariadb -uroot -pSENHA_DO_BANCO loja &lt; ~/loja-backup.sql\n$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM pedidos;"</pre></div><p style="margin-top:8px">O backup foi tirado <em>antes</em> do acidente, então guarda os quatro pedidos. A restauração os traz de volta inteiros.</p>',
        check: (ctx) => {
          const c = D.container(ctx, 'loja-db');
          const t = (c && c.banco && c.rodando) ? (c.banco.bancos.get('loja') ? c.banco.bancos.get('loja').tabelas.get('pedidos') : null) : null;
          const clientes = t ? (t.linhas || []).map(r => String(r.cliente)) : [];
          const tar = H.read(ctx, '/home/aluno/loja-backup.sql');
          return H.checkAll([
            [() => !!c && c.rodando, 'O container <code>loja-db</code> não está rodando.'],
            [() => tar !== null && String(tar).length > 0, 'Não encontrei o backup em <code>~/loja-backup.sql</code>. Gere-o com <code>mariadb-dump ... &gt; ~/loja-backup.sql</code>.'],
            [() => /INSERT INTO/.test(String(tar || '')), 'O arquivo <code>~/loja-backup.sql</code> não parece um dump com dados (sem nenhum <code>INSERT</code>). Gere-o antes de apagar a tabela.'],
            [() => !!t, 'A tabela <code>pedidos</code> ainda não voltou. Restaure com <code>docker exec -i loja-db mariadb ... loja &lt; ~/loja-backup.sql</code>.'],
            [() => (t.linhas || []).length >= 4, () => 'A tabela <code>pedidos</code> voltou com ' + ((t && t.linhas ? t.linhas.length : 0)) + ' linha(s); deveriam ser 4.'],
            [() => ['Ana', 'Bruno', 'Carla', 'Diego'].every(n => clientes.includes(n)), 'Os pedidos restaurados não batem com os originais (Ana, Bruno, Carla, Diego).']
          ]);
        }
      }
    ]
  });

  /* ============================== PF.6 ============================== */
  LX.lesson('mpf2', {
    id: 'lpd-6', n: 'PF.6', title: 'O incidente em produção',
    goal: 'Aplicar o método de diagnóstico num problema que você não plantou: a stack subiu, mas o site não responde — e deixá-la funcionando.',
    setup: (m) => {
      if (!m.docker) return;
      D.pasta(m, '/home/aluno/incidente');
      /* A stack "de produção" veio com dois defeitos plantados:
         1) o site publica para uma porta interna errada (8081, não 80);
         2) o banco está sem a senha de root, então nem sobe.            */
      D.arquivo(m, '/home/aluno/incidente/compose.yaml',
        'services:\n' +
        '  site:\n' +
        '    image: nginx:alpine\n' +
        '    restart: unless-stopped\n' +
        '    ports:\n' +
        '      - "8800:8081"\n' +
        '  db:\n' +
        '    image: mariadb:11.4\n' +
        '    restart: unless-stopped\n' +
        '    environment:\n' +
        '      MARIADB_DATABASE: loja\n' +
        '    volumes:\n' +
        '      - dados:/var/lib/mysql\n' +
        'volumes:\n' +
        '  dados:\n');
    },
    body: [
      { h2: 'Um chamado de madrugada' },
      { p: 'Alguém subiu a stack da loja e foi dormir. De manhã, dois problemas: o site "não abre" e o banco "vive caindo". Você não escreveu esse <code>compose.yaml</code> — recebeu o incidente pronto, como na vida real. O método do módulo 21 vale aqui inteiro: <strong>estado, log, configuração</strong>, um problema de cada vez.' },
      {
        box: 'key', label: 'Duas queixas, dois diagnósticos', body: [
          { ul: [
            'O <strong>banco caindo</strong> é do tipo "grita no log": <code>docker compose ps -a</code> mostra <code>Exited</code>, e <code>docker compose logs db</code> diz o que faltou.',
            'O <strong>site que não abre</strong> é o silencioso: o container aparece <code>Up</code>, mas o <code>curl</code> recusa. Aí o suspeito é o mapa de portas — o lado direito (porta do container) não bate com onde o processo escuta.'
          ] }
        ]
      },
      { p: 'Não conserte no escuro. Rode o <code>ps -a</code>, leia os logs, olhe a coluna <code>PORTS</code> e o <code>compose.yaml</code>. Cada defeito deixa uma assinatura clara para quem lê antes de mexer.' },
      {
        box: 'note', label: 'Um de cada vez', body: [
          { p: 'A tentação é mexer nos dois ao mesmo tempo e rodar um <code>up -d</code> torcendo. Resista: conserte um defeito, confirme que aquele sumiu, e só então vá ao outro. Assim, quando algo melhora, você sabe exatamente o que o melhorou.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tpd-6-g', kind: 'guiado', title: 'Diagnostique as duas queixas',
        body: [
          { p: 'Levante as evidências dos dois problemas antes de consertar qualquer coisa:' },
          { code: [
            '$ cd ~/incidente',
            '$ docker compose up -d',
            '$ docker compose ps -a',
            '$ docker compose logs db',
            '$ curl -sI http://localhost:8800/'
          ] },
          { p: 'O <code>ps -a</code> mostra o <code>db</code> como <code>Exited</code> e o <code>site</code> como <code>Up</code>; o <code>logs db</code> revela a senha faltando; o <code>curl</code> recusa a conexão apesar do site estar no ar — a assinatura de porta publicada errada. Dois defeitos, dois diagnósticos.' }
        ],
        hints: ['Use <code>docker compose ps -a</code> para o estado, <code>docker compose logs db</code> para o banco, e <code>curl</code> mais a coluna <code>PORTS</code> para o site.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+logs/), 'Leia o motivo da queda do banco com <code>docker compose logs db</code>.']
        ])
      },
      {
        id: 'tpd-6-q', kind: 'quiz', title: 'Up e recusando ao mesmo tempo',
        body: [{ p: 'O container do <code>site</code> está <code>Up</code>, mas <code>curl http://localhost:8800/</code> dá "connection refused", e o mapa de portas é <code>8800-&gt;8081</code>. Qual é a causa mais provável?' }],
        options: [
          { text: 'A porta publicada aponta para a 8081 dentro do container, mas o nginx escuta na 80. O tráfego chega a uma porta interna sem ninguém ouvindo. Basta publicar para a porta certa: <code>8800:80</code>.', correct: true },
          { text: 'O container caiu; o "Up" está desatualizado.', why: 'Se o <code>ps</code> mostra <code>Up</code>, ele está rodando. O problema é o cano de porta apontando para o lugar errado dentro do container.' },
          { text: 'Falta publicar qualquer porta no site.', why: 'Uma porta está publicada — a 8800. O problema é para onde ela aponta lá dentro (8081), não a ausência de publicação.' },
          { text: 'O <code>curl</code> não fala com containers.', why: 'O <code>curl</code> fala com a porta do host normalmente; ele recusa porque, atrás dela, o destino interno não tem ninguém ouvindo. Ajustada a porta, o mesmo <code>curl</code> responde.' }
        ],
        hints: ['Container vivo + conexão recusada aponta para o lado direito do mapa de portas.'],
        explain: 'Container <code>Up</code> e conexão recusada é a assinatura de um mapa de portas errado: o lado direito (porta do container) não é onde o processo escuta. O nginx ouve na 80; publicar para 8081 leva o tráfego a lugar nenhum. Alinhar a porta interna (<code>8800:80</code>) resolve.'
      },
      {
        id: 'tpd-6-a', kind: 'desafio', title: 'Deixe a stack funcionando',
        body: [
          { p: 'Conserte os dois defeitos da stack em <code>~/incidente</code> e deixe-a de pé:' },
          {
            ul: [
              'o <strong>site</strong> precisa responder em <code>http://localhost:8800/</code> — alinhe o mapa de portas à porta em que o nginx realmente escuta;',
              'o <strong>banco</strong> precisa ficar no ar — dê a ele o que o log pediu, usando <code>SENHA_DO_BANCO</code> como senha de root.'
            ]
          },
          { p: 'Ao final: o <code>site</code> rodando e respondendo 200 na 8800; o <code>db</code> rodando; e o volume do banco preservado.' }
        ],
        hints: [
          'Site: troque <code>"8800:8081"</code> por <code>"8800:80"</code>. Banco: adicione <code>MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO</code> ao <code>environment</code>.',
          'Reescreva o <code>compose.yaml</code> com as duas correções e rode <code>docker compose up -d</code>.'
        ],
        solution: '<div class="code"><pre>$ cd ~/incidente\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8800:80"\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: loja\n    volumes:\n      - dados:/var/lib/mysql\nvolumes:\n  dados:\nEOF\n$ docker compose up -d\n$ docker compose ps\n$ curl -sI http://localhost:8800/</pre></div><p style="margin-top:8px">Dois defeitos, duas correções cirúrgicas: a porta interna do site e a senha do banco. Nada mais foi tocado — o volume dos dados seguiu intacto.</p>',
        check: (ctx) => {
          const site = D.doProjeto(ctx, 'incidente', 'site');
          const db = D.doProjeto(ctx, 'incidente', 'db');
          const r = D.http(ctx, 'localhost', 8800, '/');
          const vol = db ? (db.montagens || []).find(m => m.tipo === 'volume' && LX.FileSystem.normalize(m.destino) === '/var/lib/mysql') : null;
          return H.checkAll([
            [() => !!site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => !!site && D.publicada(ctx, site.nome, 8800), 'O <code>site</code> precisa publicar a porta de host 8800.'],
            [() => !!r && r.status === 200, 'O site ainda não responde na 8800. Alinhe o mapa de portas à porta 80 do nginx.'],
            [() => !!db && db.rodando, () => 'O <code>db</code> ainda não está no ar (estado <code>' + (db ? db.estado : '?') + '</code>). Dê a ele a senha de root que o log pediu.'],
            [() => !!vol, 'O volume do banco precisa continuar montado em <code>/var/lib/mysql</code>.']
          ]);
        }
      }
    ]
  });
})();
