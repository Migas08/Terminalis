/* =========================================================================
   MÓDULO D15 — Traefik na prática
   Subir o proxy, expor serviços por label, vários domínios, middlewares e
   o dashboard. Tudo verificado por requisição de verdade.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 15.1 ============================== */
  LX.lesson('d15', {
    id: 'ld15-1', n: '15.1', title: 'Subir o Traefik e expor o primeiro serviço',
    goal: 'Colocar o proxy no ar com o provider Docker e rotear um container por domínio, sem publicar porta nele.',
    body: [
      { h2: 'A stack mínima que funciona' },
      {
        code: [
          'services:',
          '  traefik:',
          '    image: traefik:v3.7',
          '    restart: unless-stopped',
          '    command:',
          '      - "--providers.docker=true"',
          '      - "--providers.docker.exposedByDefault=false"',
          '      - "--providers.docker.network=web"',
          '      - "--entrypoints.web.address=:80"',
          '      - "--accesslog=true"',
          '    ports:',
          '      - "80:80"',
          '    volumes:',
          '      - /var/run/docker.sock:/var/run/docker.sock:ro',
          '    networks:',
          '      - web',
          '',
          '  site:',
          '    image: traefik/whoami:v1.10',
          '    restart: unless-stopped',
          '    labels:',
          '      - "traefik.enable=true"',
          '      - "traefik.http.routers.site.rule=Host(`site.local`)"',
          '      - "traefik.http.routers.site.entrypoints=web"',
          '      - "traefik.http.services.site.loadbalancer.server.port=80"',
          '    networks:',
          '      - web',
          '',
          'networks:',
          '  web:',
          '    name: web'
        ], run: false, lang: 'yaml'
      },
      { p: 'Cinco detalhes fazem essa stack funcionar, e cada um deles é uma armadilha quando falta:' },
      {
        ol: [
          '<strong>O socket montado.</strong> <code>/var/run/docker.sock</code> é como o Traefik conversa com o daemon e descobre os containers. Sem ele, o Traefik sobe e não descobre nada.',
          '<strong>Os dois na mesma rede.</strong> O Traefik alcança o serviço pela rede do Docker. Sem rede em comum, é 502.',
          '<strong>Só o Traefik publica porta.</strong> O <code>site</code> não tem <code>ports</code>, e é assim que deve ser.',
          '<strong><code>traefik.enable=true</code> no serviço.</strong> Com <code>exposedByDefault=false</code>, sem essa label o container é ignorado.',
          '<strong>A porta interna declarada.</strong> <code>loadbalancer.server.port</code> é a porta em que o processo escuta dentro do container.'
        ]
      },
      {
        box: 'warn', label: 'Sobre montar o socket do Docker', body: [
          { p: 'Montar <code>/var/run/docker.sock</code> dentro de um container dá a esse container <strong>controle total do daemon</strong> — e o daemon roda como root no servidor. Quem fala com o socket pode criar um container privilegiado que monta o disco inteiro do host. Na prática, é equivalente a dar root no servidor.' },
          { p: 'Duas mitigações que você deve aplicar sempre: montar como <strong>somente leitura</strong> (<code>:ro</code>) e não expor o container que tem o socket a tráfego não confiável. O módulo 17 volta a esse assunto com mais profundidade e com as alternativas (proxy de socket, provider por arquivo).' }
        ]
      },

      { h2: 'A rede compartilhada entre projetos' },
      { p: 'Em um servidor com vários projetos, o Traefik costuma viver na própria stack e os outros projetos se conectam a uma rede <strong>externa</strong> comum:' },
      {
        code: [
          '# no projeto do Traefik: cria a rede com nome fixo',
          'networks:',
          '  web:',
          '    name: web',
          '',
          '# em cada outro projeto: usa a que já existe',
          'networks:',
          '  web:',
          '    external: true'
        ], run: false, lang: 'yaml'
      },
      { p: 'Sem <code>name: web</code>, o Compose criaria <code>projeto_web</code> — e o outro projeto, procurando por <code>web</code>, não acharia.' },
      {
        box: 'note', label: 'Serviço com duas redes', body: [
          { p: 'Um serviço que fala com o Traefik <em>e</em> com um banco costuma estar em duas redes: <code>web</code> (pública, com o proxy) e a interna do projeto (com o banco). O banco fica só na interna. Quando o container está em mais de uma rede, diga ao Traefik qual usar: <code>traefik.docker.network=web</code>.' }
        ]
      },

      { h2: 'Testando sem DNS' },
      { p: 'Você não precisa de domínio registrado para testar roteamento. O que o Traefik lê é o cabeçalho <code>Host</code>, e o <code>curl</code> deixa você mandar o que quiser:' },
      {
        code: [
          'curl -H "Host: site.local" http://localhost/',
          'curl -sI -H "Host: site.local" http://localhost/    # só os cabeçalhos'
        ], run: false
      },
      { p: 'Em uma máquina de trabalho, o outro caminho é apontar o nome no <code>/etc/hosts</code>: <code>127.0.0.1 site.local</code>. Aí o navegador também funciona.' },

      { h2: 'As quatro falhas clássicas' },
      {
        table: {
          head: ['Sintoma', 'Causa provável', 'Como confirmar'],
          rows: [
            ['<code>404 page not found</code>', 'nenhum router casou: regra errada, <code>traefik.enable</code> faltando, ou entryPoint errado', 'o router aparece no dashboard?'],
            ['<code>502 Bad Gateway</code>', 'porta errada, ou sem rede em comum', '<code>docker logs traefik</code> diz qual foi'],
            ['nada aparece no dashboard', 'socket não montado, ou provider desligado', '<code>docker logs traefik | grep -i docker</code>'],
            ['conecta mas não responde', 'o Traefik não publicou a porta 80', '<code>docker ps</code> mostra <code>0.0.0.0:80-&gt;80/tcp</code>?']
          ]
        }
      },
      { p: 'O log do Traefik é honesto: ele diz, com nome e sobrenome, qual container ele não conseguiu alcançar e por quê. Leia antes de mexer.' },
      {
        code: [
          'docker logs traefik | tail -20',
          'docker logs -f traefik            # acompanhando enquanto testa'
        ], run: false
      }
    ],
    tasks: [
{
        id: 'td15-1-a', kind: 'guiado', title: 'Suba o proxy e faça a primeira requisição',
        body: [
          { p: 'Monte a stack mínima do Traefik com um serviço atrás dele e veja o roteamento por <code>Host</code> funcionar:' },
          {
            code: [
              '$ mkdir -p ~/lab-traefik && cd ~/lab-traefik',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  traefik:',
              '    image: traefik:v3.7',
              '    command:',
              '      - "--providers.docker=true"',
              '      - "--providers.docker.exposedByDefault=false"',
              '      - "--entrypoints.web.address=:80"',
              '    ports:',
              '      - "80:80"',
              '    volumes:',
              '      - /var/run/docker.sock:/var/run/docker.sock:ro',
              '  site:',
              '    image: traefik/whoami:v1.10',
              '    labels:',
              '      - "traefik.enable=true"',
              '      - "traefik.http.routers.lab.rule=Host(`lab.local`)"',
              '      - "traefik.http.routers.lab.entrypoints=web"',
              '      - "traefik.http.services.lab.loadbalancer.server.port=80"',
              'EOF',
              '$ docker compose up -d',
              '$ curl -s -H "Host: lab.local" http://localhost/',
              '$ curl -s -o /dev/null -w "%{http_code}\\n" -H "Host: outro.local" http://localhost/'
            ]
          },
          { p: 'A primeira requisição casa o router <code>lab</code> e chega no <code>whoami</code>. A segunda, com um Host que nenhum router conhece, volta 404 — é o Traefik dizendo "não tenho rota para isso".' }
        ],
        hints: ['O <code>site</code> não publica porta: o Traefik o alcança pela rede do projeto. É o cabeçalho <code>Host</code> que decide o destino.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba a stack com <code>docker compose up -d</code> dentro de <code>~/lab-traefik</code>.'],
          [() => H.usedCommand(ctx, /curl.*Host:\s*lab\.local/i), 'Faça a requisição com <code>curl -H "Host: lab.local" http://localhost/</code>.']
        ])
      },
      {
        id: 'td15-1-q', kind: 'quiz', title: 'Por que o site não publica porta',
        body: [
          { p: 'Na stack da aula, o serviço <code>site</code> não tem nenhuma linha <code>ports:</code> — só o Traefik publica a 80. Ainda assim o <code>curl -H "Host: site.local" http://localhost/</code> chega no <code>site</code>. Como, e por que é melhor assim?' }
        ],
        options: [
          { text: 'O Traefik alcança o <code>site</code> pela rede interna do Docker, pela porta que o processo escuta; publicar porta só serve para tráfego vindo de fora, e o <code>site</code> só precisa ser alcançado pelo proxy.', correct: true },
          { text: 'O Traefik republica automaticamente a porta do <code>site</code> no servidor.', why: 'Ele não republica nada. O acesso ao <code>site</code> acontece dentro da rede do Docker; nenhuma porta nova é aberta no servidor.' },
          { text: 'O <code>site</code> só funciona porque o Docker abre a porta 80 dele por padrão.', why: 'Container nenhum abre porta no servidor por padrão — é preciso <code>-p</code>. E aqui justamente não há: o tráfego entra pelo Traefik.' },
          { text: 'Sem <code>ports</code> o <code>site</code> ficaria inacessível; a stack só funciona por sorte.', why: 'Não é sorte: containers da mesma rede se alcançam pela porta interna sempre. Publicar porta é o que se quer evitar num serviço atrás do proxy.' }
        ],
        explain: 'Essa é a diferença que o proxy reverso traz para a segurança: os serviços de aplicação deixam de publicar porta e ficam alcançáveis só pela rede interna, através do Traefik. A superfície exposta do servidor cai para as portas 80 e 443 do proxy — e o <code>loadbalancer.server.port</code> diz ao Traefik em qual porta interna falar com cada serviço.'
      },
      {
        id: 'td15-1-b', kind: 'desafio', title: 'Ponha o proxy no ar',
        body: [
          { p: 'Em <code>~/proxy</code>, monte uma stack com:' },
          { ul: [
            '<code>traefik</code> — imagem <code>traefik:v3.7</code>, publicando a porta <strong>80</strong>, com o socket do Docker montado <strong>somente leitura</strong>, provider Docker ligado, <code>exposedByDefault=false</code>, um entryPoint <code>web</code> na porta 80 e <code>accesslog</code> ligado;',
            '<code>site</code> — imagem <code>traefik/whoami:v1.10</code>, <strong>sem publicar porta</strong>, com labels que criem um router chamado <code>site</code> respondendo por <code>Host(`site.local`)</code> no entryPoint <code>web</code>, e um service declarando a porta interna <strong>80</strong>.'
          ] },
          { p: 'Os dois na mesma rede. Ao final, <code>curl -H "Host: site.local" http://localhost/</code> deve devolver a resposta do <code>whoami</code>, e <code>curl -H "Host: outro.local" http://localhost/</code> deve devolver 404.' }
        ],
        hints: [
          'As labels vão no serviço <code>site</code>, não no Traefik. E com <code>exposedByDefault=false</code>, a primeira delas é <code>traefik.enable=true</code>.',
          'A crase é especial no shell — dentro do <code>compose.yaml</code> não há problema, mas escreva a label inteira entre aspas: <code>- "traefik.http.routers.site.rule=Host(`site.local`)"</code>.'
        ],
        solution: '<pre>$ mkdir -p ~/proxy\n$ cd ~/proxy\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    restart: unless-stopped\n    command:\n      - "--providers.docker=true"\n      - "--providers.docker.exposedByDefault=false"\n      - "--entrypoints.web.address=:80"\n      - "--accesslog=true"\n    ports:\n      - "80:80"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\n\n  site:\n    image: traefik/whoami:v1.10\n    restart: unless-stopped\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.site.rule=Host(`site.local`)"\n      - "traefik.http.routers.site.entrypoints=web"\n      - "traefik.http.services.site.loadbalancer.server.port=80"\nEOF\n$ docker compose up -d\n$ docker compose ps\n$ curl -s -H "Host: site.local" http://localhost/\n$ curl -s -H "Host: outro.local" http://localhost/</pre>',
        check: (ctx) => {
          const tf = D.doProjeto(ctx, 'proxy', 'traefik');
          const site = D.doProjeto(ctx, 'proxy', 'site');
          const certo = D.http(ctx, 'localhost', 80, '/', { Host: 'site.local' });
          const errado = D.http(ctx, 'localhost', 80, '/', { Host: 'outro.local' });
          const sock = tf ? tf.montagens.find(m => /docker\.sock$/.test(m.destino)) : null;
          return H.checkAll([
            [() => tf && tf.rodando, 'O serviço <code>traefik</code> não está rodando no projeto <code>proxy</code>.'],
            [() => site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => D.publicada(ctx, tf.nome, 80), 'O Traefik não está publicando a porta 80 do servidor.'],
            [() => site.portas.length === 0, 'O <code>site</code> não deve publicar porta nenhuma — quem recebe tráfego de fora é o proxy.'],
            [() => sock, 'O socket <code>/var/run/docker.sock</code> não está montado no Traefik: sem ele o provider não descobre container nenhum.'],
            [() => sock && sock.ro, 'Monte o socket como somente leitura (<code>:ro</code>).'],
            [() => (site.labels || {})['traefik.enable'] === 'true', 'Falta a label <code>traefik.enable=true</code> no <code>site</code>.'],
            [() => Object.keys(site.labels || {}).some(k => /^traefik\.http\.services\..*loadbalancer\.server\.port$/.test(k)),
              'Falta a label do service declarando a porta interna (<code>loadbalancer.server.port</code>).'],
            [() => Array.from(tf.redes.keys()).some(r => site.redes.has(r)),
              'O Traefik e o <code>site</code> não compartilham rede — é daí que sai o 502.'],
            [() => !!certo && certo.status === 200,
              () => 'A requisição com <code>Host: site.local</code> respondeu <code>' + (certo ? certo.status : 'nada') + '</code> em vez de 200. Se foi 404, nenhum router casou; se foi 502, o Traefik não alcançou o container.'],
            [() => /Hostname:/.test((certo && certo.body) || ''), 'A resposta não veio do <code>whoami</code>.'],
            [() => !!errado && errado.status === 404,
              'Um host desconhecido deveria receber 404. Confira se a regra do router exige o <code>Host</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 15.2 ============================== */
  LX.lesson('d15', {
    id: 'ld15-2', n: '15.2', title: 'Vários domínios, caminhos e middlewares',
    goal: 'Rotear mais de um serviço no mesmo servidor, dividir por caminho com stripPrefix e proteger o dashboard.',
    body: [
      { h2: 'Dois domínios, dois containers' },
      { p: 'Acrescentar um segundo site é acrescentar um segundo container com as próprias labels. Nada muda no Traefik.' },
      {
        code: [
          '  loja:',
          '    image: traefik/whoami:v1.10',
          '    labels:',
          '      - "traefik.enable=true"',
          '      - "traefik.http.routers.loja.rule=Host(`loja.local`)"',
          '      - "traefik.http.routers.loja.entrypoints=web"',
          '      - "traefik.http.services.loja.loadbalancer.server.port=80"',
          '',
          '  blog:',
          '    image: traefik/whoami:v1.10',
          '    labels:',
          '      - "traefik.enable=true"',
          '      - "traefik.http.routers.blog.rule=Host(`blog.local`)"',
          '      - "traefik.http.routers.blog.entrypoints=web"',
          '      - "traefik.http.services.blog.loadbalancer.server.port=80"'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'Nomes de router são globais', body: [
          { p: 'Dois containers com um router chamado <code>web</code> colidem, mesmo em projetos diferentes: o Traefik enxerga todos os containers do daemon. Use nomes específicos (<code>loja</code>, <code>loja-api</code>, <code>blog-admin</code>), não genéricos.' }
        ]
      },
      { p: 'Um domínio com e sem <code>www</code>, ou vários domínios para o mesmo serviço, cabem em uma regra só:' },
      { code: ['traefik.http.routers.loja.rule=Host(`loja.local`) || Host(`www.loja.local`)'], run: false, lang: 'text' },

      { h2: 'Dividindo pelo caminho' },
      { p: 'Um mesmo domínio pode ter partes servidas por containers diferentes:' },
      {
        ascii: `loja.local/          → container "site"
loja.local/api/...   → container "api"     (mais específico: ganha)`
      },
      {
        code: [
          '  api:',
          '    image: traefik/whoami:v1.10',
          '    labels:',
          '      - "traefik.enable=true"',
          '      - "traefik.http.routers.api.rule=Host(`loja.local`) && PathPrefix(`/api`)"',
          '      - "traefik.http.routers.api.priority=100"',
          '      - "traefik.http.routers.api.middlewares=tira-api"',
          '      - "traefik.http.middlewares.tira-api.stripprefix.prefixes=/api"',
          '      - "traefik.http.services.api.loadbalancer.server.port=80"'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'Por que o <code>stripPrefix</code>', body: [
          { p: 'Sem ele, uma requisição para <code>loja.local/api/pedidos</code> chega no container como <code>/api/pedidos</code>. Mas a aplicação dentro do container tem a rota <code>/pedidos</code> — ela não sabe que existe um prefixo. O resultado é 404 vindo da aplicação, não do Traefik.' },
          { p: 'O <code>stripPrefix</code> remove o prefixo antes de repassar, e informa o original no cabeçalho <code>X-Forwarded-Prefix</code> para a aplicação montar links corretos.' }
        ]
      },

      { h2: 'Middlewares que você vai usar' },
      {
        code: [
          '# forçar HTTPS',
          'traefik.http.middlewares.para-https.redirectscheme.scheme=https',
          'traefik.http.middlewares.para-https.redirectscheme.permanent=true',
          '',
          '# exigir usuário e senha',
          'traefik.http.middlewares.senha.basicauth.users=admin:$$apr1$$HASH_KEY',
          '',
          '# cabeçalhos de segurança',
          'traefik.http.middlewares.seguro.headers.stsseconds=31536000',
          'traefik.http.middlewares.seguro.headers.framedeny=true',
          'traefik.http.middlewares.seguro.headers.contenttypenosniff=true',
          '',
          '# limitar requisições',
          'traefik.http.middlewares.limite.ratelimit.average=50',
          'traefik.http.middlewares.limite.ratelimit.burst=100',
          '',
          '# aplicar vários, em ordem',
          'traefik.http.routers.painel.middlewares=senha,seguro,limite'
        ], run: false, lang: 'text'
      },
      {
        box: 'warn', label: 'O <code>$</code> dobrado no basicAuth', body: [
          { p: 'A senha do <code>basicAuth</code> é um hash gerado com <code>htpasswd -nb usuario senha</code>, e hashes têm <code>$</code>. Dentro de um <code>compose.yaml</code>, um <code>$</code> solto é interpolação do Compose — é preciso escrever <code>$$</code> para virar um <code>$</code> literal.' },
          { p: 'Esquecer disso produz um hash truncado e uma senha que nunca funciona. E nunca escreva a senha em texto claro na label: o valor ali é sempre o hash.' }
        ]
      },

      { h2: 'O dashboard' },
      { p: 'O dashboard mostra todos os routers, services e middlewares que o Traefik conhece — e diz quais estão com erro. É a primeira coisa a olhar quando uma rota não funciona.' },
      {
        code: [
          '# jeito rápido, SÓ para laboratório',
          '--api.insecure=true      # dashboard sem senha na porta 8080'
        ], run: false
      },
      {
        box: 'warn', label: '<code>api.insecure</code> em servidor é um convite', body: [
          { p: 'Com <code>--api.insecure=true</code>, qualquer pessoa que alcance a porta 8080 vê todo o desenho da sua infraestrutura: domínios, serviços internos, middlewares. O próprio Traefik registra um aviso no log quando você liga isso.' },
          { p: 'Em servidor, a forma correta é expor o dashboard como qualquer outro serviço — com domínio, HTTPS e <code>basicAuth</code>:' }
        ]
      },
      {
        code: [
          '  traefik:',
          '    image: traefik:v3.7',
          '    command:',
          '      - "--api.dashboard=true"',
          '      # ... resto da configuração estática',
          '    labels:',
          '      - "traefik.enable=true"',
          '      - "traefik.http.routers.painel.rule=Host(`painel.local`)"',
          '      - "traefik.http.routers.painel.entrypoints=web"',
          '      - "traefik.http.routers.painel.service=api@internal"',
          '      - "traefik.http.routers.painel.middlewares=senha"',
          '      - "traefik.http.middlewares.senha.basicauth.users=admin:$$apr1$$HASH_KEY"'
        ], run: false, lang: 'yaml'
      },
      { p: 'O serviço especial <code>api@internal</code> é o próprio Traefik. Aqui, excepcionalmente, as labels ficam no container do Traefik — porque o "serviço de destino" é ele mesmo.' }
    ],
    tasks: [
{
        id: 'td15-2-a', kind: 'guiado', title: 'Divida um domínio por caminho',
        body: [
          { p: 'Veja um caminho ser roteado para um container diferente, e o prefixo ser removido antes de chegar nele:' },
          {
            code: [
              '$ mkdir -p ~/lab-path && cd ~/lab-path',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  traefik:',
              '    image: traefik:v3.7',
              '    command:',
              '      - "--providers.docker=true"',
              '      - "--providers.docker.exposedByDefault=false"',
              '      - "--entrypoints.web.address=:80"',
              '    ports:',
              '      - "8137:80"',
              '    volumes:',
              '      - /var/run/docker.sock:/var/run/docker.sock:ro',
              '  api:',
              '    image: traefik/whoami:v1.10',
              '    labels:',
              '      - "traefik.enable=true"',
              '      - "traefik.http.routers.labapi.rule=Host(`app.local`) && PathPrefix(`/api`)"',
              '      - "traefik.http.routers.labapi.middlewares=tira"',
              '      - "traefik.http.middlewares.tira.stripprefix.prefixes=/api"',
              '      - "traefik.http.services.labapi.loadbalancer.server.port=80"',
              'EOF',
              '$ docker compose up -d',
              '$ curl -s -H "Host: app.local" http://localhost:8137/api/pedidos | grep GET'
            ]
          },
          { p: 'Repare na linha <code>GET</code> que o <code>whoami</code> devolve: o container recebeu <code>/pedidos</code>, não <code>/api/pedidos</code>. O <code>stripPrefix</code> tirou o <code>/api</code> antes de repassar.' }
        ],
        hints: ['A resposta do <code>whoami</code> mostra o caminho que ele recebeu — é assim que se confirma que o <code>stripPrefix</code> agiu.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba a stack com <code>docker compose up -d</code> em <code>~/lab-path</code>.'],
          [() => H.usedCommand(ctx, /curl.*\/api\/pedidos/), 'Faça a requisição para <code>/api/pedidos</code> com o <code>curl</code>.']
        ])
      },
      {
        id: 'td15-2-q', kind: 'quiz', title: 'Por que o stripPrefix',
        body: [
          { p: 'Você roteia <code>app.local/api</code> para um container com <code>PathPrefix(`/api`)</code>, mas <strong>sem</strong> <code>stripPrefix</code>. A aplicação lá dentro tem a rota <code>/pedidos</code>. Uma requisição para <code>app.local/api/pedidos</code> recebe <strong>404, vindo da aplicação</strong>. Por quê?' }
        ],
        options: [
          { text: 'Sem o <code>stripPrefix</code>, o Traefik repassa o caminho inteiro <code>/api/pedidos</code>; a aplicação só conhece <code>/pedidos</code> e não acha <code>/api/pedidos</code>, respondendo 404 ela mesma.', correct: true },
          { text: 'O router não casou; o 404 é do Traefik.', why: 'Se o router não casasse, o 404 seria a página do Traefik. O enunciado diz que o 404 vem da aplicação — ou seja, o Traefik roteou e a aplicação é que não achou a rota.' },
          { text: 'Falta declarar a porta do serviço; é um caso de 502.', why: 'Porta errada dá 502 (Bad Gateway), não 404 da aplicação. Aqui a conexão chegou até a aplicação.' },
          { text: 'O <code>PathPrefix</code> não funciona com <code>Host</code> na mesma regra.', why: 'Combinar <code>Host(...) && PathPrefix(...)</code> é exatamente o uso normal; a regra casou. O que falta é ajustar o caminho antes de repassar.' }
        ],
        explain: 'O <code>PathPrefix</code> decide o roteamento, mas não altera o caminho. Como a aplicação não sabe que existe um prefixo <code>/api</code> na frente dela, é preciso removê-lo antes de repassar: <code>traefik.http.middlewares.NOME.stripprefix.prefixes=/api</code>, aplicado ao router. O Traefik informa o prefixo original no cabeçalho <code>X-Forwarded-Prefix</code>, para a aplicação montar links corretos.'
      },
      {
        id: 'td15-2-b', kind: 'desafio', title: 'Dois domínios e um caminho',
        body: [
          { p: 'Em <code>~/multi</code>, monte uma stack com o Traefik (entryPoint <code>web</code> na 80, publicando a 80, socket montado <code>:ro</code>, <code>exposedByDefault=false</code>) e <strong>três</strong> serviços <code>traefik/whoami:v1.10</code>, nenhum publicando porta:' },
          { ul: [
            '<code>loja</code> — responde por <code>loja.local</code>;',
            '<code>blog</code> — responde por <code>blog.local</code>;',
            '<code>api</code> — responde por <code>loja.local</code> <strong>com caminho começando em <code>/api</code></strong>, e o prefixo <code>/api</code> deve ser <strong>removido</strong> antes de chegar no container.'
          ] },
          { p: 'Ao final, estas quatro requisições precisam se comportar assim:' },
          {
            table: {
              head: ['Requisição', 'Esperado'],
              rows: [
                ['<code>Host: loja.local</code>, <code>/</code>', '200, vindo do container <code>loja</code>'],
                ['<code>Host: blog.local</code>, <code>/</code>', '200, vindo do container <code>blog</code>'],
                ['<code>Host: loja.local</code>, <code>/api/pedidos</code>', '200, vindo do container <code>api</code>, que recebe o caminho <code>/pedidos</code>'],
                ['<code>Host: nada.local</code>, <code>/</code>', '404']
              ]
            }
          }
        ],
        hints: [
          'A regra do <code>api</code> combina dois matchers com <code>&&</code>. Para garantir que ela ganhe da regra do <code>loja</code>, declare <code>priority</code> maior.',
          'O middleware é declarado com <code>traefik.http.middlewares.NOME.stripprefix.prefixes=/api</code> e aplicado com <code>traefik.http.routers.api.middlewares=NOME</code>. A resposta do <code>whoami</code> mostra o caminho que ele recebeu — é assim que você confere.'
        ],
        solution: '<pre>$ mkdir -p ~/multi\n$ cd ~/multi\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    restart: unless-stopped\n    command:\n      - "--providers.docker=true"\n      - "--providers.docker.exposedByDefault=false"\n      - "--entrypoints.web.address=:80"\n      - "--accesslog=true"\n    ports:\n      - "80:80"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\n\n  loja:\n    image: traefik/whoami:v1.10\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.loja.rule=Host(`loja.local`)"\n      - "traefik.http.routers.loja.entrypoints=web"\n      - "traefik.http.services.loja.loadbalancer.server.port=80"\n\n  blog:\n    image: traefik/whoami:v1.10\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.blog.rule=Host(`blog.local`)"\n      - "traefik.http.routers.blog.entrypoints=web"\n      - "traefik.http.services.blog.loadbalancer.server.port=80"\n\n  api:\n    image: traefik/whoami:v1.10\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.api.rule=Host(`loja.local`) &amp;&amp; PathPrefix(`/api`)"\n      - "traefik.http.routers.api.entrypoints=web"\n      - "traefik.http.routers.api.priority=100"\n      - "traefik.http.routers.api.middlewares=tira-api"\n      - "traefik.http.middlewares.tira-api.stripprefix.prefixes=/api"\n      - "traefik.http.services.api.loadbalancer.server.port=80"\nEOF\n$ docker compose up -d\n$ curl -s -H "Host: loja.local" http://localhost/ | head -1\n$ curl -s -H "Host: blog.local" http://localhost/ | head -1\n$ curl -s -H "Host: loja.local" http://localhost/api/pedidos | head -5\n$ curl -s -o /dev/null -w "%{http_code}\\n" -H "Host: nada.local" http://localhost/</pre>',
        check: (ctx) => {
          const tf = D.doProjeto(ctx, 'multi', 'traefik');
          const loja = D.doProjeto(ctx, 'multi', 'loja');
          const blog = D.doProjeto(ctx, 'multi', 'blog');
          const api = D.doProjeto(ctx, 'multi', 'api');
          const rLoja = D.http(ctx, 'localhost', 80, '/', { Host: 'loja.local' });
          const rBlog = D.http(ctx, 'localhost', 80, '/', { Host: 'blog.local' });
          const rApi = D.http(ctx, 'localhost', 80, '/api/pedidos', { Host: 'loja.local' });
          const rNada = D.http(ctx, 'localhost', 80, '/', { Host: 'nada.local' });
          const veioDe = (r, c) => !!r && !!c && new RegExp('Hostname: ' + c.id.slice(0, 12)).test(r.body || '');
          return H.checkAll([
            [() => tf && tf.rodando, 'O Traefik não está rodando no projeto <code>multi</code>.'],
            [() => loja && blog && api && loja.rodando && blog.rodando && api.rodando,
              'Os três serviços (<code>loja</code>, <code>blog</code>, <code>api</code>) precisam estar rodando.'],
            [() => [loja, blog, api].every(c => c.portas.length === 0),
              'Nenhum dos três deve publicar porta no servidor.'],
            [() => !!rLoja && rLoja.status === 200, () => '<code>Host: loja.local /</code> respondeu <code>' + (rLoja ? rLoja.status : 'nada') + '</code>.'],
            [() => veioDe(rLoja, loja), 'A resposta de <code>loja.local/</code> não veio do container <code>loja</code>.'],
            [() => !!rBlog && rBlog.status === 200, () => '<code>Host: blog.local /</code> respondeu <code>' + (rBlog ? rBlog.status : 'nada') + '</code>.'],
            [() => veioDe(rBlog, blog), 'A resposta de <code>blog.local/</code> não veio do container <code>blog</code>.'],
            [() => !!rApi && rApi.status === 200, () => '<code>Host: loja.local /api/pedidos</code> respondeu <code>' + (rApi ? rApi.status : 'nada') + '</code>.'],
            [() => veioDe(rApi, api),
              'A requisição para <code>/api/pedidos</code> não chegou no container <code>api</code>. Falta prioridade na regra dele?'],
            [() => /GET \/pedidos /.test((rApi && rApi.body) || ''),
              () => 'O container <code>api</code> recebeu o caminho com o prefixo. O <code>whoami</code> respondeu: <code>' +
                String((rApi && rApi.body) || '').split('\n').find(l => /^GET /.test(l)) + '</code>. Falta o <code>stripPrefix</code>.'],
            [() => !!rNada && rNada.status === 404, 'Um host desconhecido deveria receber 404.']
          ]);
        }
      },

    ]
  });
})();
