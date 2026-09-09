/* =========================================================================
   MÓDULO D21 — Troubleshooting
   Um método para diagnosticar, e três ambientes quebrados de propósito para
   praticá-lo: o que não sobe, o conflito de porta e o que "sobe mas não
   responde".
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 21.1 ============================== */
  LX.lesson('d21', {
    id: 'ld21-1', n: '21.1', title: 'O método: ler antes de adivinhar',
    goal: 'Diagnosticar um serviço que não sobe seguindo um roteiro fixo — estado, log, configuração — em vez de tentar coisas ao acaso.',
    setup: (m) => {
      if (!m.docker) return;
      D.pasta(m, '/home/aluno/reparo');
      D.arquivo(m, '/home/aluno/reparo/compose.yaml',
        'services:\n' +
        '  db:\n' +
        '    image: mariadb:11.4\n' +
        '    restart: unless-stopped\n' +
        '    environment:\n' +
        '      MARIADB_DATABASE: loja\n');
    },
    body: [
      { h2: 'Adivinhar é o inimigo' },
      { p: 'Quando um container não funciona, a tentação é mexer em tudo ao mesmo tempo até algo mudar. Isso costuma trocar um problema por dois. O caminho que funciona é um roteiro curto e sempre na mesma ordem: <strong>o estado</strong>, <strong>o log</strong>, <strong>a configuração</strong>. Três perguntas, nesta sequência.' },
      {
        box: 'key', label: 'O roteiro de diagnóstico', body: [
          { ol: [
            '<strong>Qual é o estado?</strong> <code>docker ps -a</code> (ou <code>docker compose ps -a</code>). Está <code>Up</code>? <code>Exited</code>? <code>Restarting</code>? O código de saída entre parênteses já é uma pista.',
            '<strong>O que ele disse?</strong> <code>docker logs &lt;container&gt;</code> (ou <code>docker compose logs</code>). Quase todo processo grita o motivo antes de morrer — a resposta costuma estar na última linha.',
            '<strong>Como ele foi configurado?</strong> <code>docker inspect</code> e o <code>compose.yaml</code>. Se o log aponta uma variável, uma porta, um caminho, é aqui que você confere o que realmente foi passado.'
          ] }
        ]
      },
      { p: 'O <code>-a</code> do <code>ps -a</code> é essencial: sem ele, o <code>docker ps</code> mostra só o que está <em>rodando</em> — e o container que você procura justamente <strong>não</strong> está. Um container que morreu some da lista normal; o <code>-a</code> traz os mortos de volta para você ler a causa.' },

      { h2: 'Lendo um estado de "Exited"' },
      { p: 'Um <code>STATUS</code> de <code>Exited (1)</code> diz duas coisas: o container <em>rodou</em> e <em>parou</em>, e parou com código <strong>1</strong> (erro). Código <code>0</code> seria saída limpa; qualquer outro número é falha. O número não diz <em>o que</em> falhou — para isso é o log:' },
      {
        code: [
          '$ docker compose ps -a',
          'NAME             IMAGE          STATUS',
          'reparo-db-1      mariadb:11.4   Exited (1) 2 seconds ago',
          '',
          '$ docker compose logs db',
          "db-1  | [ERROR] [Entrypoint]: Database is uninitialized and password option is not specified",
          "db-1  | \tYou need to specify one of MARIADB_ROOT_PASSWORD, MARIADB_ALLOW_EMPTY_ROOT_PASSWORD..."
        ], run: false
      },
      { p: 'O log é explícito: o MariaDB se recusa a iniciar sem uma senha de root definida. Não é um bug misterioso — é uma exigência da imagem que faltou atender. O conserto sai direto da mensagem: definir a variável que ela pede.' },
      {
        box: 'note', label: 'A mensagem quase sempre é literal', body: [
          { p: 'Programadores de imagens sérias escrevem mensagens de erro para serem lidas. "You need to specify MARIADB_ROOT_PASSWORD" não é uma charada — é a instrução. O reflexo de colar o erro no buscador é útil, mas metade das vezes a própria linha já contém a solução. Leia antes de pesquisar.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td21-1-a', kind: 'guiado', title: 'Faça o diagnóstico',
        body: [
          { p: 'A stack em <code>~/reparo</code> tem um serviço <code>db</code> que não fica no ar. Rode o roteiro — sem consertar ainda, só diagnosticar:' },
          {
            code: [
              '$ cd ~/reparo',
              '$ docker compose up -d',
              '$ docker compose ps -a',
              '$ docker compose logs db'
            ]
          },
          { p: 'O <code>ps -a</code> mostra o <code>db</code> como <code>Exited (1)</code> — subiu e caiu. O <code>logs</code> revela por quê: falta a senha de root. Você já sabe o conserto sem ter chutado nada.' }
        ],
        hints: ['Depois do <code>docker compose up -d</code>, veja o estado com <code>docker compose ps -a</code> e o motivo com <code>docker compose logs db</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+logs/), 'Leia o motivo da falha com <code>docker compose logs db</code>.']
        ])
      },
      {
        id: 'td21-1-q', kind: 'quiz', title: 'O que "Exited (1)" conta',
        body: [
          { p: 'No <code>docker compose ps -a</code>, o serviço aparece como <code>Exited (1)</code>. O que isso, sozinho, já te diz?' }
        ],
        options: [
          { text: 'O container chegou a iniciar e depois encerrou com código 1 (erro). Não diz qual erro — para isso é o <code>docker logs</code> —, mas confirma que o processo rodou e falhou, não que ficou preso subindo.', correct: true },
          { text: 'O container nunca chegou a iniciar.', why: '<code>Exited</code> significa justamente que ele iniciou e depois saiu. "Nunca iniciou" seria um erro na criação (imagem inexistente, por exemplo), não um estado <code>Exited</code>.' },
          { text: 'O código 1 identifica exatamente qual foi o erro.', why: 'O 1 só diz "saiu com erro". É genérico — quase toda falha usa 1. <em>Qual</em> erro está no log, não no número.' },
          { text: 'O container está rodando, mas com um aviso.', why: 'Rodando seria <code>Up</code>. <code>Exited</code> é o oposto: ele parou. O número entre parênteses é o código de saída, não um aviso.' }
        ],
        explain: 'O estado (<code>Exited</code>, <code>Up</code>, <code>Restarting</code>) diz o que o container está fazendo; o código de saída (0 = limpo, ≠0 = erro) diz como ele terminou. Juntos, apontam <em>que</em> algo falhou. O <em>quê</em> vem do log — que é sempre o próximo passo depois de ver um <code>Exited</code> com código diferente de zero.'
      },
      {
        id: 'td21-1-b', kind: 'desafio', title: 'Conserte o que o log pediu',
        body: [
          { p: 'Você já diagnosticou: o <code>db</code> em <code>~/reparo</code> cai porque falta a senha de root. Conserte o <code>compose.yaml</code> para o serviço subir e ficar no ar.' },
          { p: 'Ao final: o serviço <code>db</code> precisa estar <strong>rodando</strong>. Use o marcador <code>SENHA_DO_BANCO</code> como valor da senha.' }
        ],
        hints: [
          'O log pediu <code>MARIADB_ROOT_PASSWORD</code>. Adicione essa variável ao bloco <code>environment</code> do <code>db</code>, com valor <code>SENHA_DO_BANCO</code>.',
          'Depois de editar, <code>docker compose up -d</code> recria o container com a configuração nova; confira com <code>docker compose ps</code>.'
        ],
        solution: '<pre>$ cd ~/reparo\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: loja\nEOF\n$ docker compose up -d\n$ docker compose ps</pre>',
        check: (ctx) => {
          const db = D.doProjeto(ctx, 'reparo', 'db');
          return H.checkAll([
            [() => !!db, 'Não encontrei o serviço <code>db</code> da stack <code>reparo</code>. Rode <code>docker compose up -d</code> em <code>~/reparo</code>.'],
            [() => !!db && db.rodando,
              () => 'O <code>db</code> ainda não está no ar (estado <code>' + (db ? db.estado : '?') + '</code>). Defina <code>MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO</code> no <code>environment</code> e recrie com <code>docker compose up -d</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 21.2 ============================== */
  LX.lesson('d21', {
    id: 'ld21-2', n: '21.2', title: 'Conflito de porta',
    goal: 'Reconhecer o erro "address already in use" e resolvê-lo entendendo que uma porta do host só pode pertencer a um serviço.',
    setup: (m) => {
      if (!m.docker) return;
      D.pasta(m, '/home/aluno/duplo');
      D.arquivo(m, '/home/aluno/duplo/compose.yaml',
        'services:\n' +
        '  web:\n' +
        '    image: nginx:alpine\n' +
        '    ports:\n' +
        '      - "8400:80"\n' +
        '  admin:\n' +
        '    image: adminer:5\n' +
        '    ports:\n' +
        '      - "8400:8080"\n');
    },
    body: [
      { h2: 'Uma porta do host, um dono' },
      { p: 'Publicar uma porta (<code>8400:80</code>) é reservar a porta <strong>8400 da máquina</strong> para um container. Como só existe uma porta 8400 no host, dois serviços não podem publicá-la ao mesmo tempo — o segundo a tentar bater na porta encontra a casa ocupada.' },
      {
        code: [
          '$ docker compose up -d',
          ' Container duplo-web-1    Started',
          ' Container duplo-admin-1  Error',
          'Error response from daemon: ... failed to bind host port for 0.0.0.0:8400:...:8080/tcp:',
          ' address already in use'
        ], run: false
      },
      { p: 'A frase-chave é <code>address already in use</code>: alguém já ocupa aquele endereço:porta no host. Repare que o <code>web</code> subiu e o <code>admin</code> falhou — o primeiro a chegar pegou a 8400, o segundo bateu na porta fechada.' },
      {
        box: 'key', label: 'O host:contêiner do mapa de portas', body: [
          { p: 'Em <code>8400:8080</code>, o número da <strong>esquerda</strong> é a porta do <em>host</em> (a máquina), e a da <strong>direita</strong> é a porta <em>dentro</em> do container. O conflito é sempre do lado esquerdo: containers diferentes podem escutar a mesma porta interna à vontade (cada um no seu isolamento), mas cada porta do host só serve a um. A solução é dar a cada serviço uma porta de host diferente: <code>8400</code> para um, <code>8401</code> para o outro.' }
        ]
      },
      {
        box: 'note', label: 'E se o ocupante não for um container?', body: [
          { p: 'Às vezes a 8400 está tomada por um processo comum da máquina, não por um container — um servidor que você subiu à mão, por exemplo. O sintoma é o mesmo (<code>address already in use</code>), e no Linux você acha o ocupante com as ferramentas de rede que viu no curso (como <code>ss -ltnp</code>). A saída é igual: liberar a porta ou escolher outra.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td21-2-a', kind: 'guiado', title: 'Veja o conflito acontecer',
        body: [
          { p: 'A stack em <code>~/duplo</code> tem dois serviços pedindo a mesma porta do host. Suba e observe:' },
          {
            code: [
              '$ cd ~/duplo',
              '$ docker compose up -d',
              '$ docker compose ps -a'
            ]
          },
          { p: 'O <code>up</code> reclama de <code>address already in use</code> para o segundo serviço, e o <code>ps -a</code> mostra um serviço no ar e o outro sem subir. O erro nomeia exatamente o problema: a porta já tem dono.' }
        ],
        hints: ['Rode <code>docker compose up -d</code> em <code>~/duplo</code> e leia a linha de erro; depois confira o estado com <code>docker compose ps -a</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba a stack com <code>docker compose up -d</code> em <code>~/duplo</code> para ver o conflito.']
        ])
      },
      {
        id: 'td21-2-q', kind: 'quiz', title: 'De quem é a culpa do conflito',
        body: [
          { p: 'Dois serviços publicam <code>8400:80</code> e <code>8400:8080</code>, e o segundo falha com <code>address already in use</code>. Onde está o conflito?' }
        ],
        options: [
          { text: 'Na porta do host (o 8400 à esquerda dos dois): só um serviço pode ocupá-la. As portas internas (80 e 8080) não conflitam — cada container tem as suas. A saída é dar a um dos serviços outra porta de host, como 8401.', correct: true },
          { text: 'Nas portas internas 80 e 8080, que precisam ser iguais.', why: 'As portas internas nem entram no conflito — são de containers isolados. O choque é no 8400 do host, repetido nos dois.' },
          { text: 'Os dois serviços usam a mesma imagem, e por isso colidem.', why: 'São imagens diferentes (nginx e adminer). Ainda que fossem iguais, o conflito seria pela porta de host repetida, não pela imagem.' },
          { text: 'Falta uma rede definida no compose.', why: 'O Compose já cria uma rede padrão, e o erro não é de rede — é <code>address already in use</code>, um choque de porta do host.' }
        ],
        explain: 'No mapa <code>host:contêiner</code>, o número da esquerda é a porta da máquina, e ela é única. Dois serviços com o mesmo host-port colidem, não importa a porta interna de cada um. Conserta-se atribuindo portas de host distintas — uma por serviço.'
      },
      {
        id: 'td21-2-b', kind: 'desafio', title: 'Dê a cada serviço a sua porta',
        body: [
          { p: 'Resolva o conflito em <code>~/duplo</code>: mantenha o <code>web</code> na porta de host <strong>8400</strong> e mova o <code>admin</code> para a porta de host <strong>8401</strong>. As portas internas não mudam.' },
          { p: 'Ao final: os dois serviços, <code>web</code> e <code>admin</code>, precisam estar rodando — o <code>web</code> publicando a 8400 e o <code>admin</code> a 8401.' }
        ],
        hints: [
          'No <code>compose.yaml</code>, troque o mapeamento do <code>admin</code> de <code>"8400:8080"</code> para <code>"8401:8080"</code>. Só o número do host (à esquerda) muda.',
          'Depois, <code>docker compose up -d</code> sobe o serviço que faltava, agora sem conflito.'
        ],
        solution: '<pre>$ cd ~/duplo\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8400:80"\n  admin:\n    image: adminer:5\n    ports:\n      - "8401:8080"\nEOF\n$ docker compose up -d\n$ docker compose ps</pre>',
        check: (ctx) => {
          const web = D.doProjeto(ctx, 'duplo', 'web');
          const admin = D.doProjeto(ctx, 'duplo', 'admin');
          return H.checkAll([
            [() => !!web && web.rodando, 'O serviço <code>web</code> precisa estar rodando (na porta 8400).'],
            [() => !!admin && admin.rodando,
              () => 'O serviço <code>admin</code> ainda não está no ar (estado <code>' + (admin ? admin.estado : '?') + '</code>). Mova-o para a porta de host 8401 e recrie.'],
            [() => !!web && D.publicada(ctx, web.nome, 8400), 'O <code>web</code> precisa continuar publicando a porta 8400.'],
            [() => !!admin && D.publicada(ctx, admin.nome, 8401), 'O <code>admin</code> precisa publicar a porta 8401.']
          ]);
        }
      }
    ]
  });

  /* ============================== 21.3 ============================== */
  LX.lesson('d21', {
    id: 'ld21-3', n: '21.3', title: 'Sobe, mas não responde',
    goal: 'Diagnosticar o caso traiçoeiro em que o container está Up mas o serviço não responde — quase sempre um descompasso entre a porta publicada e a porta que o processo escuta.',
    setup: (m) => {
      if (!m.docker) return;
      D.pasta(m, '/home/aluno/portal');
      D.arquivo(m, '/home/aluno/portal/compose.yaml',
        'services:\n' +
        '  web:\n' +
        '    image: nginx:alpine\n' +
        '    ports:\n' +
        '      - "8500:8081"\n');
    },
    body: [
      { h2: 'Up não é o mesmo que funcionando' },
      { p: 'O erro mais confuso não é o que grita no log — é o silencioso. O container aparece <code>Up</code>, o <code>docker ps</code> parece saudável, e mesmo assim o site não abre: a conexão é <em>recusada</em>. Nada morreu; algo simplesmente não se encaixa. O suspeito número um é o <strong>mapa de portas</strong>.' },
      {
        code: [
          '$ docker compose ps',
          'NAME            IMAGE          STATUS          PORTS',
          'portal-web-1    nginx:alpine   Up 3 seconds    0.0.0.0:8500->8081/tcp',
          '',
          '$ curl -I http://localhost:8500/',
          'curl: (7) Failed to connect to localhost port 8500: Connection refused'
        ], run: false
      },
      { p: 'Olhe a coluna <code>PORTS</code>: <code>8500-&gt;8081</code>. O host 8500 encaminha para a porta <strong>8081 dentro do container</strong>. Mas o nginx escuta na <strong>80</strong>, não na 8081. O tráfego chega ao container e bate numa porta onde ninguém atende — daí o "connection refused", com o container vivíssimo.' },
      {
        box: 'key', label: 'O lado direito precisa bater com o processo', body: [
          { p: 'Em <code>8500:8081</code>, a direita (<code>8081</code>) tem que ser a porta em que o programa <em>realmente escuta dentro do container</em>. Publicar para 8081 quando o nginx ouve na 80 cria um cano que não leva a lugar nenhum. O conserto é alinhar: <code>8500:80</code>. A porta do host (esquerda) você escolhe; a do container (direita) é ditada pelo processo.' }
        ]
      },
      {
        box: 'note', label: 'Como saber em que porta o processo escuta', body: [
          { p: 'Cada imagem documenta a porta que expõe (o nginx: 80; o adminer: 8080; um app Node costuma ser 3000). O <code>docker inspect</code> mostra os <code>ExposedPorts</code> da imagem, e um <code>docker exec</code> com as ferramentas de rede confirma de dentro. Quando o container sobe mas não responde, comparar "porta publicada × porta que o processo escuta" resolve a maioria dos casos.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td21-3-a', kind: 'guiado', title: 'Confirme o descompasso',
        body: [
          { p: 'A stack em <code>~/portal</code> sobe, mas o site não responde. Reúna as duas evidências:' },
          {
            code: [
              '$ cd ~/portal',
              '$ docker compose up -d',
              '$ docker compose ps',
              '$ curl -I http://localhost:8500/'
            ]
          },
          { p: 'O <code>ps</code> mostra o container <code>Up</code> e a coluna <code>PORTS</code> com <code>8500-&gt;8081</code>; o <code>curl</code> recusa a conexão. Container vivo + conexão recusada = quase sempre porta publicada errada. E 8081 não é onde o nginx escuta.' }
        ],
        hints: ['Suba com <code>docker compose up -d</code>, veja a coluna <code>PORTS</code> no <code>docker compose ps</code> e tente <code>curl -I http://localhost:8500/</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba a stack com <code>docker compose up -d</code> em <code>~/portal</code>.']
        ])
      },
      {
        id: 'td21-3-q', kind: 'quiz', title: 'Up e recusando ao mesmo tempo',
        body: [
          { p: 'O container está <code>Up</code>, mas <code>curl http://localhost:8500/</code> dá "connection refused", e o mapa de portas é <code>8500-&gt;8081</code>. Qual é a causa mais provável?' }
        ],
        options: [
          { text: 'A porta publicada aponta para a 8081 dentro do container, mas o nginx escuta na 80. O tráfego chega a uma porta interna sem ninguém ouvindo. Basta publicar para a porta certa: <code>8500:80</code>.', correct: true },
          { text: 'O container caiu; "Up" está desatualizado.', why: 'Se o <code>ps</code> mostra <code>Up</code>, ele está rodando. O problema não é o container morto, é o cano de porta apontando para o lugar errado dentro dele.' },
          { text: 'Falta publicar qualquer porta.', why: 'Uma porta <em>está</em> publicada — a 8500. O problema é para onde ela aponta lá dentro (8081), não a ausência de publicação.' },
          { text: 'O <code>curl</code> não funciona com container.', why: 'O <code>curl</code> fala com a porta do host normalmente; ele recusa porque, atrás dela, o destino interno não tem ninguém ouvindo. Ajustada a porta, o mesmo <code>curl</code> responde.' }
        ],
        explain: 'Container <code>Up</code> e conexão recusada é a assinatura de um mapa de portas errado: o lado direito (porta do container) não é onde o processo escuta. O nginx ouve na 80; publicar para 8081 leva o tráfego a lugar nenhum. Alinhar a porta interna (<code>8500:80</code>) resolve.'
      },
      {
        id: 'td21-3-b', kind: 'desafio', title: 'Alinhe a porta e faça responder',
        body: [
          { p: 'Conserte a stack em <code>~/portal</code> para o site responder na porta de host <strong>8500</strong>. O nginx escuta na porta <strong>80</strong> dentro do container — o mapa de portas precisa refletir isso.' },
          { p: 'Ao final: uma requisição a <code>http://localhost:8500/</code> precisa responder com sucesso (o container <code>web</code> continua sendo o mesmo nginx).' }
        ],
        hints: [
          'No <code>compose.yaml</code>, troque <code>"8500:8081"</code> por <code>"8500:80"</code>: a porta do host segue 8500, mas agora aponta para a 80, onde o nginx realmente escuta.',
          'Depois, <code>docker compose up -d</code> recria o <code>web</code> com o mapa corrigido; confirme com <code>curl -I http://localhost:8500/</code>.'
        ],
        solution: '<pre>$ cd ~/portal\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8500:80"\nEOF\n$ docker compose up -d\n$ curl -I http://localhost:8500/</pre>',
        check: (ctx) => {
          const web = D.doProjeto(ctx, 'portal', 'web');
          const r = D.http(ctx, 'localhost', 8500, '/');
          return H.checkAll([
            [() => !!web && web.rodando, 'O serviço <code>web</code> precisa estar rodando.'],
            [() => !!web && D.publicada(ctx, web.nome, 8500), 'O <code>web</code> precisa publicar a porta de host 8500.'],
            [() => !!r && r.status === 200,
              'A porta 8500 ainda não responde. Aponte o mapa para a porta 80 do container (<code>8500:80</code>) e recrie com <code>docker compose up -d</code>.']
          ]);
        }
      }
    ]
  });
})();
