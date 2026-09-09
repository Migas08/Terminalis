/* =========================================================================
   MÓDULO D22 — Projetos progressivos
   Seis construções que juntam tudo: em cada aula, um build guiado e um
   projeto para você fechar sozinho — do container único ao ambiente quase
   de produção, com proxy e banco.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 22.1 ============================== */
  LX.lesson('d22', {
    id: 'ld22-1', n: '22.1', title: 'Projeto: um serviço bem-empacotado',
    goal: 'Fechar um único container "de produção": porta publicada, política de reinício e dados num volume nomeado — tudo o que separa um contêiner de brinquedo de um que aguenta o dia a dia.',
    body: [
      { h2: 'Este módulo são seis builds' },
      { p: 'Você já viu cada peça isolada. Agora vem a síntese: <strong>seis construções</strong>, duas por aula — uma guiada, com você acompanhando, e uma para fechar sozinho. Elas sobem em dificuldade: começam num container só e terminam num ambiente com proxy e banco, do jeito que roda em servidor de verdade. Comece pelo mais simples, bem feito.' },

      { h2: 'O que torna um serviço "sério"' },
      { p: 'Rodar <code>docker run nginx</code> mostra a página de boas-vindas, e só. Um serviço que fica no ar precisa de três coisas que você já conhece, agora juntas:' },
      {
        table: {
          head: ['Peça', 'Por quê'],
          rows: [
            ['<strong>Porta publicada</strong> (<code>ports</code>)', 'sem publicar, ninguém de fora alcança o serviço'],
            ['<strong>Política de reinício</strong> (<code>restart: unless-stopped</code>)', 'se o processo morre ou a máquina reinicia, o container volta sozinho'],
            ['<strong>Volume nomeado</strong> para os dados', 'o que precisa sobreviver a uma recriação não pode morar na camada do container']
          ]
        }
      },
      {
        code: [
          'services:',
          '  web:',
          '    image: nginx:alpine',
          '    restart: unless-stopped',
          '    ports:',
          '      - "8600:80"',
          '    volumes:',
          '      - conteudo:/usr/share/nginx/html',
          '',
          'volumes:',
          '  conteudo:'
        ], run: false, lang: 'yaml'
      },
      { p: 'É o mesmo <code>nginx</code>, mas agora ele reaparece após um tombo, e o que estiver em <code>/usr/share/nginx/html</code> vive no volume <code>conteudo</code> — sobrevive a um <code>docker compose down</code> e a uma troca de imagem.' },
      {
        box: 'key', label: 'Volume nomeado × o que some', body: [
          { p: 'Tudo o que um container escreve fora de um volume vive na sua <strong>camada de escrita</strong>, que é destruída quando o container é removido (num <code>up</code> que recria, numa atualização de imagem). O volume nomeado é a parte que <em>fica</em>. A regra é simples: se perder aquilo doeria, aquilo vai num volume.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td22-1-a', kind: 'guiado', title: 'Suba o serviço e prove que ele volta',
        body: [
          { p: 'Monte o serviço e teste a rede de segurança — o container reaparecendo depois de cair:' },
          {
            code: [
              '$ mkdir -p ~/proj-um && cd ~/proj-um',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  web:',
              '    image: nginx:alpine',
              '    restart: unless-stopped',
              '    ports:',
              '      - "8600:80"',
              '    volumes:',
              '      - conteudo:/usr/share/nginx/html',
              'volumes:',
              '  conteudo:',
              'EOF',
              '$ docker compose up -d',
              '$ curl -sI http://localhost:8600/',
              '$ docker compose ps'
            ]
          },
          { p: 'O serviço responde na 8600, e o <code>ps</code> mostra a política de reinício em ação. Os dados servidos vivem no volume <code>conteudo</code>, separados do container.' }
        ],
        hints: ['Um <code>docker compose up -d</code> na pasta com o <code>compose.yaml</code> sobe tudo; confira com <code>curl -sI http://localhost:8600/</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba o serviço com <code>docker compose up -d</code> em <code>~/proj-um</code>.']
        ])
      },
      {
        id: 'td22-1-q', kind: 'quiz', title: 'Por que o volume nomeado',
        body: [
          { p: 'No serviço acima, os arquivos servidos ficam num volume nomeado <code>conteudo</code> em vez de na camada do container. Qual é o ganho concreto?' }
        ],
        options: [
          { text: 'O volume sobrevive à recriação do container: um <code>up</code> que recria o serviço, ou uma troca da imagem, apagam a camada de escrita, mas não o volume. O que precisa persistir fica preservado.', correct: true },
          { text: 'O volume deixa o container mais rápido.', why: 'Desempenho não é o motivo. O ponto é persistência: o volume separa os dados do ciclo de vida do container.' },
          { text: 'Sem o volume, o nginx não inicia.', why: 'O nginx inicia sem volume nenhum. O volume não é requisito para subir — é o que garante que os dados fiquem quando o container for recriado.' },
          { text: 'O volume publica a porta automaticamente.', why: 'Publicar porta é papel do <code>ports</code>. Volume e porta são coisas independentes: um guarda dados, o outro expõe a rede.' }
        ],
        explain: 'A camada de escrita de um container é descartável — some quando ele é removido, o que acontece a cada recriação e a cada atualização de imagem. Um volume nomeado é armazenamento à parte, com vida própria: é onde mora tudo o que precisa atravessar recriações. Dados importantes fora de um volume são dados que você vai perder um dia.'
      },
      {
        id: 'td22-1-b', kind: 'desafio', title: 'Empacote o seu serviço',
        body: [
          { p: 'Em <code>~/servico</code>, monte um <code>compose.yaml</code> com um único serviço <code>web</code> que reúna as três peças de um serviço sério:' },
          { ul: [
            'imagem <code>nginx:alpine</code>;',
            'política de reinício <code>unless-stopped</code>;',
            'publicando a porta de host <strong>8600</strong> na 80 do container;',
            'com um <strong>volume nomeado</strong> chamado <code>conteudo</code> montado em <code>/usr/share/nginx/html</code>.'
          ] },
          { p: 'Ao final: o <code>web</code> precisa estar rodando, respondendo na 8600, com a política de reinício e o volume nomeado no lugar.' }
        ],
        hints: [
          'Lembre da seção <code>volumes:</code> no topo do arquivo declarando <code>conteudo:</code>, além da montagem dentro do serviço.',
          'Depois de <code>docker compose up -d</code>, um <code>docker compose ps</code> e um <code>curl -sI http://localhost:8600/</code> confirmam.'
        ],
        solution: '<pre>$ mkdir -p ~/servico && cd ~/servico\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  web:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8600:80"\n    volumes:\n      - conteudo:/usr/share/nginx/html\n\nvolumes:\n  conteudo:\nEOF\n$ docker compose up -d\n$ docker compose ps\n$ curl -sI http://localhost:8600/</pre>',
        check: (ctx) => {
          const web = D.doProjeto(ctx, 'servico', 'web');
          const vol = web ? (web.montagens || []).find(m => m.tipo === 'volume' && !m.anonimo && /(^|_)conteudo$/.test(m.nome || '') && LX.FileSystem.normalize(m.destino) === '/usr/share/nginx/html') : null;
          return H.checkAll([
            [() => !!web && web.rodando, 'O serviço <code>web</code> não está rodando em <code>~/servico</code>.'],
            [() => !!web && D.publicada(ctx, web.nome, 8600), 'O <code>web</code> precisa publicar a porta de host 8600.'],
            [() => !!web && web.restart && web.restart.politica === 'unless-stopped',
              'Falta a política de reinício <code>restart: unless-stopped</code> no serviço.'],
            [() => !!vol, 'Falta o volume nomeado <code>conteudo</code> montado em <code>/usr/share/nginx/html</code> (com a seção <code>volumes:</code> declarando <code>conteudo</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 22.2 ============================== */
  LX.lesson('d22', {
    id: 'ld22-2', n: '22.2', title: 'Projeto: site, banco e administração',
    goal: 'Montar uma stack de três serviços que conversam pela rede interna do Compose, com o banco protegido (sem porta publicada) e os dados num volume.',
    body: [
      { h2: 'Três peças, uma rede' },
      { p: 'A segunda construção é a forma mais comum de aplicação: um <strong>site</strong> na frente, um <strong>banco</strong> atrás, e uma ferramenta de <strong>administração</strong> para você espiar o banco. O Compose põe os três na mesma rede automaticamente, e eles se acham pelo nome do serviço.' },
      {
        code: [
          'services:',
          '  site:',
          '    image: nginx:alpine',
          '    restart: unless-stopped',
          '    ports:',
          '      - "8601:80"',
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
          '  admin:',
          '    image: adminer:5',
          '    restart: unless-stopped',
          '    ports:',
          '      - "8602:8080"',
          '',
          'volumes:',
          '  dados:'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'O banco não publica porta — de propósito', body: [
          { p: 'Repare que o <code>db</code> não tem <code>ports</code>. Quem precisa do banco são o <code>site</code> e o <code>admin</code>, que estão na <strong>mesma rede interna</strong> e o alcançam pelo nome <code>db</code> na porta 3306. Publicar o banco para o host seria abrir a porta do cofre para a rua sem necessidade. A regra vale para todo serviço interno: só publica quem precisa receber tráfego <em>de fora</em>.' }
        ]
      },
      { p: 'Os dados do banco vão no volume <code>dados</code>, montado em <code>/var/lib/mysql</code> — o mesmo cuidado do projeto anterior, agora onde ele mais importa: perder o volume de um banco é perder o banco.' },
      {
        box: 'note', label: 'Testando que um enxerga o outro', body: [
          { p: 'Para confirmar que o <code>admin</code> acha o <code>db</code> pela rede, você usa o que viu em redes: <code>docker compose exec admin getent hosts db</code> resolve o nome para um IP interno. Se resolve, a rede está de pé; o resto é login. É o mesmo DNS interno do Compose que você já conhece.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td22-2-a', kind: 'guiado', title: 'Suba a stack e veja a rede funcionar',
        body: [
          { p: 'Monte os três serviços e confirme que o <code>admin</code> enxerga o <code>db</code> pelo nome:' },
          {
            code: [
              '$ mkdir -p ~/proj-dois && cd ~/proj-dois',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  site:',
              '    image: nginx:alpine',
              '    ports: ["8601:80"]',
              '  db:',
              '    image: mariadb:11.4',
              '    environment:',
              '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
              '      MARIADB_DATABASE: loja',
              '    volumes: ["dados:/var/lib/mysql"]',
              '  admin:',
              '    image: adminer:5',
              '    ports: ["8602:8080"]',
              'volumes:',
              '  dados:',
              'EOF',
              '$ docker compose up -d',
              '$ docker compose exec admin getent hosts db',
              '$ docker compose ps'
            ]
          },
          { p: 'O <code>getent hosts db</code> devolve um IP: o <code>admin</code> acha o <code>db</code> pela rede interna, sem que o banco publique porta nenhuma. Site e administração ficam expostos; o banco, protegido.' }
        ],
        hints: ['Depois do <code>up -d</code>, teste o DNS interno com <code>docker compose exec admin getent hosts db</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba os três serviços com <code>docker compose up -d</code> em <code>~/proj-dois</code>.']
        ])
      },
      {
        id: 'td22-2-q', kind: 'quiz', title: 'Por que o banco fica sem porta',
        body: [
          { p: 'Na stack, <code>site</code> e <code>admin</code> publicam portas, mas o <code>db</code> não. Como, então, o <code>admin</code> consegue conversar com o banco?' }
        ],
        options: [
          { text: 'Pela rede interna do Compose: os três serviços estão na mesma rede e se acham pelo nome (<code>db</code> na porta 3306). Publicar porta só serve para receber tráfego de <em>fora</em> — entre os containers, a rede interna basta.', correct: true },
          { text: 'O <code>admin</code> não consegue: sem porta publicada, o banco é inalcançável.', why: 'Publicar porta é só para o mundo externo. Dentro da rede do Compose, os serviços se falam livremente pelo nome — é assim que o admin alcança o db.' },
          { text: 'Só funciona se o <code>db</code> também publicar a 3306.', why: 'Publicar a 3306 exporia o banco ao host sem necessidade. A comunicação interna não depende de publicação — ela usa a rede privada da stack.' },
          { text: 'O Compose copia os dados do banco para o admin.', why: 'Não há cópia de dados; há uma conexão de rede. O admin conecta no db pela rede interna e consulta ao vivo.' }
        ],
        explain: 'Publicar uma porta (<code>ports</code>) abre um serviço para <em>fora</em> da máquina. A conversa <em>entre</em> containers acontece pela rede interna que o Compose cria, onde cada serviço é alcançável pelo próprio nome. Por isso o banco não precisa — e não deve — publicar porta: quem fala com ele são os vizinhos de rede, não o mundo.'
      },
      {
        id: 'td22-2-b', kind: 'desafio', title: 'Monte a stack de três peças',
        body: [
          { p: 'Em <code>~/loja-app</code>, monte um <code>compose.yaml</code> com três serviços:' },
          { ul: [
            '<code>site</code> — <code>nginx:alpine</code>, publicando a porta de host <strong>8601</strong>;',
            '<code>db</code> — <code>mariadb:11.4</code>, com <code>MARIADB_ROOT_PASSWORD</code> valendo <code>SENHA_DO_BANCO</code> e <code>MARIADB_DATABASE</code> valendo <code>loja</code>, guardando os dados num <strong>volume nomeado</strong> <code>dados</code> em <code>/var/lib/mysql</code>, e <strong>sem publicar porta</strong>;',
            '<code>admin</code> — <code>adminer:5</code>, publicando a porta de host <strong>8602</strong>.'
          ] },
          { p: 'Ao final: os três serviços rodando; o <code>site</code> na 8601, o <code>admin</code> na 8602, e o <code>db</code> sem porta publicada, com o volume <code>dados</code> montado.' }
        ],
        hints: [
          'Não esqueça a seção <code>volumes:</code> no fim declarando <code>dados:</code>.',
          'O <code>db</code> não leva bloco <code>ports</code> — é isso que o mantém interno.'
        ],
        solution: '<pre>$ mkdir -p ~/loja-app && cd ~/loja-app\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8601:80"\n\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: loja\n    volumes:\n      - dados:/var/lib/mysql\n\n  admin:\n    image: adminer:5\n    restart: unless-stopped\n    ports:\n      - "8602:8080"\n\nvolumes:\n  dados:\nEOF\n$ docker compose up -d\n$ docker compose ps</pre>',
        check: (ctx) => {
          const site = D.doProjeto(ctx, 'loja-app', 'site');
          const db = D.doProjeto(ctx, 'loja-app', 'db');
          const admin = D.doProjeto(ctx, 'loja-app', 'admin');
          const vol = db ? (db.montagens || []).find(m => m.tipo === 'volume' && !m.anonimo && /(^|_)dados$/.test(m.nome || '') && LX.FileSystem.normalize(m.destino) === '/var/lib/mysql') : null;
          return H.checkAll([
            [() => !!site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => !!db && db.rodando, 'O serviço <code>db</code> não está rodando.'],
            [() => !!admin && admin.rodando, 'O serviço <code>admin</code> não está rodando.'],
            [() => !!site && D.publicada(ctx, site.nome, 8601), 'O <code>site</code> precisa publicar a porta 8601.'],
            [() => !!admin && D.publicada(ctx, admin.nome, 8602), 'O <code>admin</code> precisa publicar a porta 8602.'],
            [() => !!db && (db.portas || []).length === 0, 'O <code>db</code> não deve publicar porta nenhuma — ele é interno.'],
            [() => !!vol, 'Falta o volume nomeado <code>dados</code> montado em <code>/var/lib/mysql</code> no <code>db</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 22.3 ============================== */
  LX.lesson('d22', {
    id: 'ld22-3', n: '22.3', title: 'Projeto: quase produção',
    goal: 'Fechar o ambiente completo: um proxy Traefik na frente roteando por domínio, um site sem porta publicada atrás dele e um banco protegido, com volume, healthcheck e reinício.',
    body: [
      { h2: 'A forma de servidor de verdade' },
      { p: 'A última construção junta tudo na topologia que roda em produção: <strong>um único ponto de entrada</strong> (o proxy Traefik, dono da porta 80), <strong>serviços atrás dele sem porta publicada</strong> (o proxy é quem os alcança e roteia por domínio) e <strong>um banco protegido</strong>, com os cuidados de dados que você já domina. Ninguém fala com o site ou o banco direto — tudo passa pela porta da frente.' },
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
          '    image: traefik/whoami:v1.10',
          '    restart: unless-stopped',
          '    labels:',
          '      - "traefik.enable=true"',
          '      - "traefik.http.routers.site.rule=Host(`loja.local`)"',
          '      - "traefik.http.routers.site.entrypoints=web"',
          '      - "traefik.http.services.site.loadbalancer.server.port=80"',
          '',
          '  db:',
          '    image: mariadb:11.4',
          '    restart: unless-stopped',
          '    environment:',
          '      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO',
          '      MARIADB_DATABASE: loja',
          '    volumes:',
          '      - dados:/var/lib/mysql',
          '    healthcheck:',
          '      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]',
          '      interval: 10s',
          '      timeout: 5s',
          '      retries: 5',
          '',
          'volumes:',
          '  dados:'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'A fronteira de confiança', body: [
          { p: 'Só o <code>traefik</code> publica porta (a 80). O <code>site</code> não publica — recebe tráfego só pelo proxy, que casa <code>Host(`loja.local`)</code> e encaminha. O <code>db</code> também não publica — vive na rede interna, alcançado por quem precisa. É a mesma ideia do projeto anterior, agora com o proxy como o único portão para o mundo. Reduzir a superfície exposta a um só ponto é o coração de um ambiente seguro.' }
        ]
      },
      {
        box: 'warn', label: 'O socket do Docker é somente leitura', body: [
          { p: 'O Traefik precisa do socket <code>/var/run/docker.sock</code> para descobrir os containers e suas labels — mas montado <strong>somente leitura</strong> (<code>:ro</code>). Quem tem escrita no socket controla o Docker inteiro do host; o proxy só precisa <em>ler</em> a lista de serviços. Este é o cuidado de segurança do módulo 17 aplicado aqui, no lugar onde ele mais conta.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td22-3-a', kind: 'guiado', title: 'Suba o ambiente e roteie por domínio',
        body: [
          { p: 'Monte o proxy com um site atrás e teste o roteamento por <code>Host</code>:' },
          {
            code: [
              '$ mkdir -p ~/proj-tres && cd ~/proj-tres',
              '# (use o compose.yaml completo mostrado na aula)',
              '$ docker compose up -d',
              '$ docker compose ps',
              '$ curl -s -H "Host: loja.local" http://localhost/',
              '$ curl -sI -H "Host: outro.local" http://localhost/'
            ]
          },
          { p: 'A requisição com <code>Host: loja.local</code> chega ao <code>site</code> e responde; um host desconhecido leva 404 — porque nenhum router casou. O proxy é o único que publica porta; o site respondeu sem ter uma.' }
        ],
        hints: ['Com <code>exposedByDefault=false</code>, o site precisa da label <code>traefik.enable=true</code>. Teste o roteamento com <code>curl -H "Host: loja.local" http://localhost/</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba o ambiente com <code>docker compose up -d</code> em <code>~/proj-tres</code>.']
        ])
      },
      {
        id: 'td22-3-q', kind: 'quiz', title: 'Por que só o proxy publica porta',
        body: [
          { p: 'No ambiente quase de produção, apenas o <code>traefik</code> publica a porta 80; o <code>site</code> e o <code>db</code> não publicam nada. Qual é o princípio por trás disso?' }
        ],
        options: [
          { text: 'Reduzir a superfície exposta a um único portão: o proxy é o único ponto que o mundo alcança, e ele decide o que entra e para onde vai. Site e banco ficam na rede interna, inalcançáveis direto de fora.', correct: true },
          { text: 'É só para economizar portas do host.', why: 'Economia de portas é um efeito colateral, não o motivo. O objetivo é de segurança: um só ponto de entrada, controlado, em vez de vários serviços expostos.' },
          { text: 'Serviços atrás de um proxy não podem publicar porta.', why: 'Podem, tecnicamente — mas não devem. A escolha de não publicar é o que os mantém protegidos atrás do proxy; não é uma proibição do Docker.' },
          { text: 'Sem publicar, o site fica mais rápido.', why: 'Não é questão de velocidade. Não publicar mantém o site acessível só pela rede interna e pelo proxy, encolhendo o que um atacante pode alcançar.' }
        ],
        explain: 'Cada porta publicada é uma porta que o mundo pode bater. Concentrar a entrada num único proxy — que roteia, e mais tarde aplica TLS e autenticação — deixa todo o resto na rede interna, fora do alcance direto. Menos superfície exposta, menos por onde algo dar errado. É o mesmo princípio de menor privilégio, aplicado à rede.'
      },
      {
        id: 'td22-3-b', kind: 'desafio', title: 'Feche o ambiente completo',
        body: [
          { p: 'Em <code>~/producao</code>, monte o ambiente quase de produção com três serviços:' },
          { ul: [
            '<code>traefik</code> — <code>traefik:v3.7</code>, publicando a porta <strong>80</strong>, com o socket do Docker montado <strong>somente leitura</strong>, provider Docker ligado com <code>exposedByDefault=false</code> e um entryPoint <code>web</code> na porta 80;',
            '<code>site</code> — <code>traefik/whoami:v1.10</code>, <strong>sem publicar porta</strong>, com labels que criem um router respondendo por <code>Host(`loja.local`)</code> no entryPoint <code>web</code> e um service na porta interna 80;',
            '<code>db</code> — <code>mariadb:11.4</code>, <strong>sem publicar porta</strong>, com <code>MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO</code>, um volume nomeado <code>dados</code> em <code>/var/lib/mysql</code>, um healthcheck com <code>mariadb-admin ping</code> autenticado e <code>restart: unless-stopped</code>.'
          ] },
          { p: 'Ao final: o <code>traefik</code> publicando a 80; uma requisição com <code>Host: loja.local</code> respondendo 200 e um host desconhecido recebendo 404; o <code>site</code> e o <code>db</code> sem porta publicada; e o <code>db</code> com volume e healthcheck.' }
        ],
        hints: [
          'Aproveite o <code>compose.yaml</code> completo mostrado na aula — ele já tem as três peças no formato certo.',
          'A crase da regra <code>Host(`loja.local`)</code> precisa estar dentro de uma label entre aspas, e o socket vai com <code>:ro</code> no fim.'
        ],
        solution: '<pre>$ mkdir -p ~/producao && cd ~/producao\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    restart: unless-stopped\n    command:\n      - "--providers.docker=true"\n      - "--providers.docker.exposedByDefault=false"\n      - "--entrypoints.web.address=:80"\n    ports:\n      - "80:80"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\n\n  site:\n    image: traefik/whoami:v1.10\n    restart: unless-stopped\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.site.rule=Host(`loja.local`)"\n      - "traefik.http.routers.site.entrypoints=web"\n      - "traefik.http.services.site.loadbalancer.server.port=80"\n\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: loja\n    volumes:\n      - dados:/var/lib/mysql\n    healthcheck:\n      test: ["CMD-SHELL", "mariadb-admin ping -h 127.0.0.1 -uroot -pSENHA_DO_BANCO --silent"]\n      interval: 10s\n      timeout: 5s\n      retries: 5\n\nvolumes:\n  dados:\nEOF\n$ docker compose up -d\n$ docker compose ps\n$ curl -s -H "Host: loja.local" http://localhost/\n$ curl -sI -H "Host: outro.local" http://localhost/</pre>',
        check: (ctx) => {
          const tf = D.doProjeto(ctx, 'producao', 'traefik');
          const site = D.doProjeto(ctx, 'producao', 'site');
          const db = D.doProjeto(ctx, 'producao', 'db');
          const certo = D.http(ctx, 'localhost', 80, '/', { Host: 'loja.local' });
          const errado = D.http(ctx, 'localhost', 80, '/', { Host: 'outro.local' });
          const sock = tf ? (tf.montagens || []).find(m => /docker\.sock$/.test(m.destino)) : null;
          const vol = db ? (db.montagens || []).find(m => m.tipo === 'volume' && !m.anonimo && /(^|_)dados$/.test(m.nome || '') && LX.FileSystem.normalize(m.destino) === '/var/lib/mysql') : null;
          return H.checkAll([
            [() => !!tf && tf.rodando, 'O serviço <code>traefik</code> não está rodando.'],
            [() => !!site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => !!db && db.rodando, 'O serviço <code>db</code> não está rodando.'],
            [() => !!tf && D.publicada(ctx, tf.nome, 80), 'O <code>traefik</code> precisa publicar a porta 80.'],
            [() => !!site && (site.portas || []).length === 0, 'O <code>site</code> não deve publicar porta — quem recebe de fora é o proxy.'],
            [() => !!db && (db.portas || []).length === 0, 'O <code>db</code> não deve publicar porta — ele é interno.'],
            [() => !!sock, 'Falta montar o socket <code>/var/run/docker.sock</code> no Traefik.'],
            [() => !!sock && sock.ro, 'Monte o socket do Docker como somente leitura (<code>:ro</code>).'],
            [() => !!vol, 'Falta o volume nomeado <code>dados</code> em <code>/var/lib/mysql</code> no <code>db</code>.'],
            [() => !!db && !!db.saudeConfig, 'O <code>db</code> precisa de um healthcheck (com <code>mariadb-admin ping</code> autenticado).'],
            [() => !!certo && certo.status === 200,
              () => 'A requisição com <code>Host: loja.local</code> respondeu <code>' + (certo ? certo.status : 'nada') + '</code> em vez de 200.'],
            [() => !!errado && errado.status === 404, 'Um host desconhecido deveria receber 404 — confira a regra <code>Host()</code> do router.']
          ]);
        }
      }
    ]
  });
})();
