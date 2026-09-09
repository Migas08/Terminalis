/* =========================================================================
   MÓDULO D14 — Traefik: os conceitos
   O caminho de uma requisição: entryPoint → router → middleware → service.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 14.1 ============================== */
  LX.lesson('d14', {
    id: 'ld14-1', n: '14.1', title: 'Por que existe um proxy reverso',
    goal: 'Entender o problema que o Traefik resolve e a diferença entre configuração estática e dinâmica.',
    body: [
      { h2: 'O servidor com nove portas' },
      { p: 'Você subiu três projetos no mesmo servidor. Cada um publicou uma porta:' },
      {
        code: [
          'http://177.54.10.20:8081   ← loja',
          'http://177.54.10.20:8082   ← blog',
          'http://177.54.10.20:8083   ← painel interno'
        ], run: false, lang: 'text'
      },
      { p: 'Funciona, e é péssimo. Ninguém decora porta. Certificado HTTPS por porta é um inferno. O firewall vira uma lista crescente de exceções. E o dia em que dois projetos quiserem a mesma porta, um deles não sobe.' },
      { p: 'O que você quer é isto:' },
      {
        code: [
          'https://loja.exemplo.com.br    ─┐',
          'https://blog.exemplo.com.br    ─┼─▶  porta 443 do servidor',
          'https://painel.exemplo.com.br  ─┘'
        ], run: false, lang: 'text'
      },
      { p: 'Um único endereço de entrada, três destinos. Quem faz essa distribuição é um <strong>proxy reverso</strong>.' },

      { h2: 'Proxy reverso em uma frase' },
      {
        box: 'key', label: 'A definição', body: [
          { p: 'Um proxy reverso é o único programa que escuta nas portas 80 e 443 do servidor. Ele lê o cabeçalho <code>Host</code> (e o caminho) de cada requisição, decide para qual container repassar, repassa, e devolve a resposta ao cliente.' },
          { p: '"Reverso" porque ele está do lado do <em>servidor</em>: o cliente acha que está falando com o site, e não sabe que existe uma frota de containers atrás.' }
        ]
      },
      {
        ascii: `        cliente
           │  https://loja.exemplo.com.br/produtos
           ▼
   ┌───────────────┐  :80 :443
   │    TRAEFIK    │  lê o Host, escolhe o destino
   └──┬────────┬───┘
      │        │        (rede interna do Docker)
      ▼        ▼
  ┌───────┐ ┌───────┐
  │ loja  │ │ blog  │   nenhum publica porta no servidor
  │ :3000 │ │ :80   │
  └───────┘ └───────┘`
      },
      { p: 'Repare no que isso muda em segurança: os containers de aplicação deixam de publicar porta. Eles ficam alcançáveis apenas pela rede interna, e só através do proxy. A superfície exposta do servidor cai para duas portas.' },
      {
        table: {
          head: ['O proxy reverso resolve', 'Como'],
          rows: [
            ['vários sites, um IP', 'roteamento por <code>Host</code> (virtual host)'],
            ['HTTPS sem mexer em cada aplicação', 'o TLS termina no proxy; para trás, HTTP simples na rede interna'],
            ['certificados', 'emissão e renovação automáticas em um lugar só'],
            ['portas expostas', 'só 80 e 443; o resto fica na rede do Docker'],
            ['autenticação e limites', 'middlewares aplicados antes de chegar na aplicação']
          ]
        }
      },

      { h2: 'Por que Traefik, e não Nginx' },
      { p: 'Nginx e Apache também fazem proxy reverso, e fazem bem. A diferença aparece quando os destinos mudam o tempo todo — que é exatamente o que acontece com containers.' },
      {
        table: {
          head: ['', 'Nginx como proxy', 'Traefik'],
          rows: [
            ['Novo site', 'escrever um bloco <code>server</code>, testar, recarregar', 'subir o container com <em>labels</em>'],
            ['Container recriado com IP novo', 'a configuração aponta para o IP velho', 'redescoberto automaticamente'],
            ['Certificado', 'certbot, cron, recarga', 'ACME embutido, renovação automática'],
            ['Ver o que está roteado', 'ler os arquivos de configuração', 'dashboard'],
            ['Curva de aprendizado', 'sintaxe própria, muito material', 'conceitos novos, material menor']
          ]
        }
      },
      { p: 'O Traefik foi desenhado para um mundo em que os destinos nascem e morrem sozinhos. Ele conversa com o Docker, vê os containers subindo e descendo, e reescreve a própria configuração de roteamento em tempo real. Ninguém edita arquivo e ninguém recarrega nada.' },
      {
        box: 'note', label: 'Nem sempre Traefik é a resposta', body: [
          { p: 'Para um servidor com dois sites estáticos que não mudam há três anos, o Nginx é mais simples e você já sabe usar. O Traefik brilha quando há muitos serviços, quando eles mudam com frequência, e quando você quer que subir um serviço novo seja só subir um container.' }
        ]
      },

      { h2: 'Duas configurações, e é aqui que todo mundo se perde' },
      { p: 'O Traefik tem <strong>duas</strong> configurações separadas. Confundi-las é a fonte da maior parte dos erros.' },
      {
        table: {
          head: ['', 'Estática', 'Dinâmica'],
          rows: [
            ['O que define', 'como o Traefik <em>funciona</em>: portas de entrada, providers, ACME, log', 'como o tráfego é <em>roteado</em>: quais domínios vão para onde'],
            ['Onde mora', 'flags do <code>command</code>, <code>traefik.yml</code>, ou variáveis <code>TRAEFIK_*</code>', 'labels dos containers (com o provider Docker)'],
            ['Quando é lida', 'uma vez, na inicialização', 'continuamente, a cada mudança'],
            ['Para mudar', '<strong>recriar o container do Traefik</strong>', 'subir ou recriar o container do serviço']
          ]
        }
      },
      {
        box: 'warn', label: 'O sintoma da confusão', body: [
          { p: 'Você acrescenta <code>--entrypoints.websecure.address=:443</code> e nada acontece. Motivo: isso é configuração <strong>estática</strong>, e o Traefik só lê na largada. É preciso <code>docker compose up -d --force-recreate traefik</code>.' },
          { p: 'No sentido contrário: você põe uma label de rota no container do Traefik em vez de no container do serviço. As labels de rota vão no <strong>serviço que recebe o tráfego</strong>, não no proxy.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td14-1-a', kind: 'guiado', title: 'Sinta o problema: um serviço por porta',
        body: [
          { p: 'Suba dois serviços de verdade, cada um com a sua própria porta publicada, e visite os dois:' },
          {
            code: [
              '$ docker run -d --name loja -p 8130:80 nginx:alpine',
              '$ docker run -d --name blog -p 8131:80 nginx:alpine',
              '$ curl -sI http://localhost:8130/',
              '$ curl -sI http://localhost:8131/'
            ]
          },
          { p: 'Dois serviços, duas portas — e para acrescentar um terceiro é preciso lembrar de mais uma porta livre. Nenhum dos dois fala HTTPS, e os dois estão publicados direto na internet, sem nada na frente.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código.'],
        check: async (ctx) => {
          const loja = D.container(ctx, 'loja'), blog = D.container(ctx, 'blog');
          const rLoja = D.http(ctx, 'localhost', 8130, '/');
          const rBlog = D.http(ctx, 'localhost', 8131, '/');
          return H.checkAll([
            [() => H.usedCommand(ctx, /docker\s+run\s+-d\s+--name\s+loja\s+-p\s+8130:80/), 'Suba o <code>loja</code> com <code>docker run -d --name loja -p 8130:80 nginx:alpine</code>.'],
            [() => H.usedCommand(ctx, /docker\s+run\s+-d\s+--name\s+blog\s+-p\s+8131:80/), 'Suba o <code>blog</code> com <code>docker run -d --name blog -p 8131:80 nginx:alpine</code>.'],
            [() => loja && loja.rodando && blog && blog.rodando, 'Os dois containers (<code>loja</code> e <code>blog</code>) precisam estar rodando.'],
            [() => !!rLoja && rLoja.status === 200, 'A porta 8130 deveria responder.'],
            [() => !!rBlog && rBlog.status === 200, 'A porta 8131 deveria responder.']
          ]);
        }
      },
      {
        id: 'td14-1-q', kind: 'quiz', title: 'Estática ou dinâmica?',
        body: [
          { p: 'Você precisa acrescentar um novo domínio, <code>api.exemplo.com.br</code>, apontando para um container que já está rodando na stack. O Traefik já está de pé, com entryPoints web e websecure configurados.' },
          { p: 'O que é preciso fazer?' }
        ],
        options: [
          { text: 'Acrescentar as labels de router no container da API e recriar <strong>esse</strong> container. O Traefik descobre a rota sozinho, sem ser reiniciado.', correct: true },
          { text: 'Acrescentar o domínio ao <code>traefik.yml</code> e reiniciar o Traefik.', why: 'Roteamento por domínio é configuração dinâmica. Com o provider Docker, ela vem das labels dos containers — o <code>traefik.yml</code> guarda a configuração estática.' },
          { text: 'Acrescentar um novo entryPoint para esse domínio na configuração estática.', why: 'EntryPoint é porta de entrada, não domínio. Todos os domínios entram pelos mesmos entryPoints (80 e 443); quem separa é o router.' },
          { text: 'Publicar uma nova porta no container da API e apontar o DNS para ela.', why: 'Isso é justamente o que o proxy reverso existe para evitar. O container da API não deve publicar porta nenhuma.' }
        ],
        hints: ['Pergunte-se: isso muda como o Traefik funciona, ou para onde o tráfego vai?'],
        explain: 'Roteamento é <strong>dinâmico</strong>. Com o provider Docker, ele vem das labels do container de destino:<pre>labels:\n  - "traefik.enable=true"\n  - "traefik.http.routers.api.rule=Host(`api.exemplo.com.br`)"\n  - "traefik.http.routers.api.entrypoints=websecure"\n  - "traefik.http.services.api.loadbalancer.server.port=3000"</pre>Basta recriar o container da API. O Traefik nem pisca.'
      },
      {
        id: 'td14-1-b', kind: 'desafio', title: 'Mude a porta sem tocar no vizinho',
        body: [
          { p: 'Em <code>~/portas</code>, monte uma stack Compose com dois serviços <code>nginx:alpine</code>: <code>loja</code>, publicando a porta <strong>8132</strong>, e <code>blog</code>, publicando a porta <strong>8133</strong>.' },
          { p: 'Depois, <strong>sem apagar o <code>blog</code></strong>, mude o <code>loja</code> para publicar a porta <strong>8140</strong> em vez de 8132, e suba a stack de novo.' },
          { p: 'Ao final: <code>loja</code> responde em 8140 (não mais em 8132), e <code>blog</code> continua respondendo em 8133 — porque, para mudar o que um serviço expõe, você recria <strong>aquele</strong> container, e nenhum outro.' }
        ],
        hints: [
          'A primeira subida é uma stack Compose comum: escreva o <code>compose.yaml</code> e rode <code>docker compose up -d</code>.',
          'Depois, reescreva só a linha <code>ports</code> do <code>loja</code> no mesmo arquivo e rode <code>docker compose up -d</code> de novo — o Compose recria apenas quem mudou.'
        ],
        solution: '<pre>$ mkdir -p ~/portas\n$ cd ~/portas\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  loja:\n    image: nginx:alpine\n    ports:\n      - "8132:80"\n  blog:\n    image: nginx:alpine\n    ports:\n      - "8133:80"\nEOF\n$ docker compose up -d\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  loja:\n    image: nginx:alpine\n    ports:\n      - "8140:80"\n  blog:\n    image: nginx:alpine\n    ports:\n      - "8133:80"\nEOF\n$ docker compose up -d\n$ curl -sI http://localhost:8140/\n$ curl -sI http://localhost:8133/</pre>',
        check: (ctx) => {
          const loja = D.doProjeto(ctx, 'portas', 'loja');
          const blog = D.doProjeto(ctx, 'portas', 'blog');
          const novo = D.http(ctx, 'localhost', 8140, '/');
          const blogResp = D.http(ctx, 'localhost', 8133, '/');
          return H.checkAll([
            [() => loja && loja.rodando, 'O serviço <code>loja</code> não está rodando no projeto <code>portas</code>.'],
            [() => blog && blog.rodando, 'O serviço <code>blog</code> não está rodando.'],
            [() => D.publicada(ctx, loja.nome, 8140), 'O <code>loja</code> precisa publicar a porta 8140.'],
            [() => !D.publicada(ctx, loja.nome, 8132), 'O <code>loja</code> ainda está publicando a porta 8132 — recrie-o com a porta nova.'],
            [() => D.publicada(ctx, blog.nome, 8133), 'O <code>blog</code> deveria continuar publicando a porta 8133, sem ser tocado.'],
            [() => !!novo && novo.status === 200, 'A porta 8140 deveria responder pelo <code>loja</code>.'],
            [() => !!blogResp && blogResp.status === 200, 'A porta 8133 deveria continuar respondendo pelo <code>blog</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 14.2 ============================== */
  LX.lesson('d14', {
    id: 'ld14-2', n: '14.2', title: 'EntryPoints, routers, middlewares e services',
    goal: 'Ler e escrever as regras de roteamento da v3 e saber qual peça é responsável por cada decisão.',
    body: [
      { h2: 'O caminho de uma requisição' },
      {
        ascii: `  requisição
      │
      ▼
 ┌─────────────┐  Em qual PORTA ela entrou?
 │ ENTRYPOINT  │  web (:80)  ·  websecure (:443)
 └──────┬──────┘
        ▼
 ┌─────────────┐  Qual REGRA casa com ela?
 │   ROUTER    │  Host(\`loja.com.br\`) && PathPrefix(\`/api\`)
 └──────┬──────┘
        ▼
 ┌─────────────┐  Modificar, bloquear ou redirecionar?
 │ MIDDLEWARE  │  stripPrefix · basicAuth · redirect
 └──────┬──────┘
        ▼
 ┌─────────────┐  Para QUAL container e QUAL porta interna?
 │   SERVICE   │  loja → 172.18.0.4:3000
 └──────┬──────┘
        ▼
    container`
      },
      { p: 'Quatro peças, quatro perguntas. Quando algo não funciona, o diagnóstico é descobrir em qual delas a requisição parou.' },

      { h2: 'EntryPoint — a porta de entrada' },
      { p: 'Configuração <strong>estática</strong>. Um entryPoint é um nome dado a uma porta em que o Traefik escuta:' },
      {
        code: [
          '--entrypoints.web.address=:80',
          '--entrypoints.websecure.address=:443'
        ], run: false
      },
      { p: 'Os nomes <code>web</code> e <code>websecure</code> são convenção, não obrigação — mas use-os, porque é o que toda a documentação usa. E lembre: o container do Traefik precisa <strong>publicar</strong> essas portas com <code>-p</code>, senão ninguém de fora chega nele.' },

      { h2: 'Router — a regra que decide' },
      { p: 'Configuração <strong>dinâmica</strong>. Cada router tem um nome, uma regra e, opcionalmente, os entryPoints que atende:' },
      {
        code: [
          'traefik.http.routers.loja.rule=Host(`loja.exemplo.com.br`)',
          'traefik.http.routers.loja.entrypoints=websecure'
        ], run: false, lang: 'text'
      },
      {
        table: {
          head: ['Matcher (v3)', 'Casa quando'],
          rows: [
            ['<code>Host(`a.com`)</code>', 'o cabeçalho Host é exatamente <code>a.com</code>'],
            ['<code>HostRegexp(`^.+\\.a\\.com$`)</code>', 'o Host casa com a expressão regular'],
            ['<code>Path(`/saude`)</code>', 'o caminho é exatamente esse'],
            ['<code>PathPrefix(`/api`)</code>', 'o caminho começa com esse prefixo'],
            ['<code>Method(`POST`)</code>', 'o método é esse'],
            ['<code>Header(`X-Chave`, `valor`)</code>', 'o cabeçalho tem esse valor'],
            ['<code>ClientIP(`10.0.0.0/8`)</code>', 'o IP de origem está na faixa']
          ]
        }
      },
      { p: 'Combinam-se com <code>&amp;&amp;</code> (e), <code>||</code> (ou), <code>!</code> (não) e parênteses:' },
      {
        code: [
          'Host(`loja.com.br`) && PathPrefix(`/api`)',
          'Host(`loja.com.br`) || Host(`www.loja.com.br`)',
          'Host(`loja.com.br`) && !PathPrefix(`/admin`)'
        ], run: false, lang: 'text'
      },
      {
        box: 'warn', label: 'Crase, não aspas — e isto mudou na v3', body: [
          { p: 'Os valores dentro dos matchers vão entre <strong>crases</strong> (<code>`</code>), não entre aspas. É a mudança que mais quebra tutoriais antigos.' },
          { p: 'Outras mudanças da v2 para a v3: <code>PathPrefix</code> deixou de aceitar vários valores em uma chamada, <code>HostRegexp</code> passou a usar sintaxe de regex padrão (sem <code>{nome:...}</code>), e <code>Query</code> ganhou forma nova. Se um exemplo da internet usa aspas ou <code>{subdominio:[a-z]+}</code>, ele é da v2.' },
          { p: 'E cuidado no shell: a crase é substituição de comando no bash. Ao passar uma regra por <code>--label</code> na linha de comando, use <strong>aspas simples</strong> em volta do argumento inteiro.' }
        ]
      },
      {
        box: 'key', label: 'Quando duas regras casam', body: [
          { p: 'Ganha a de maior <strong>prioridade</strong>. Sem prioridade explícita, o Traefik usa o <em>comprimento da regra</em>: a mais específica (mais longa) vence. É por isso que <code>Host(`x`) && PathPrefix(`/api`)</code> naturalmente ganha de <code>Host(`x`)</code>.' },
          { p: 'Para não depender disso, declare: <code>traefik.http.routers.api.priority=100</code>.' }
        ]
      },

      { h2: 'Service — para onde vai' },
      {
        code: ['traefik.http.services.loja.loadbalancer.server.port=3000'], run: false, lang: 'text'
      },
      { p: 'A porta aqui é a <strong>interna</strong> do container — a que o processo escuta. Nada de porta publicada: o Traefik fala pela rede do Docker.' },
      {
        box: 'warn', label: 'A causa nº 1 de 502', body: [
          { p: 'Sem a label de service, o Traefik tenta adivinhar a porta pela <code>EXPOSE</code> da imagem. Se a imagem expõe mais de uma porta, ou nenhuma, a adivinhação erra e você recebe <em>Bad Gateway</em>.' },
          { p: 'Regra prática: <strong>sempre declare a porta</strong>. Uma linha a mais que elimina uma classe inteira de problema.' }
        ]
      },

      { h2: 'Middleware — o que acontece no meio' },
      { p: 'Middlewares são declarados em um lugar e aplicados em outro:' },
      {
        code: [
          '# declara',
          'traefik.http.middlewares.tira-api.stripprefix.prefixes=/api',
          '# aplica ao router',
          'traefik.http.routers.loja.middlewares=tira-api'
        ], run: false, lang: 'text'
      },
      {
        table: {
          head: ['Middleware', 'Para quê'],
          rows: [
            ['<code>stripPrefix</code>', 'tirar <code>/api</code> do caminho antes de repassar'],
            ['<code>addPrefix</code>', 'acrescentar um prefixo'],
            ['<code>redirectScheme</code>', 'mandar de HTTP para HTTPS'],
            ['<code>basicAuth</code>', 'exigir usuário e senha antes de passar'],
            ['<code>headers</code>', 'acrescentar cabeçalhos de segurança na resposta'],
            ['<code>rateLimit</code>', 'limitar requisições por segundo'],
            ['<code>ipAllowList</code>', 'só deixar passar certas faixas de IP'],
            ['<code>compress</code>', 'comprimir a resposta']
          ]
        }
      },
      { p: 'A ordem importa: eles rodam na sequência em que aparecem na label <code>middlewares</code>, separados por vírgula.' },

      { h2: 'Provider — de onde vem a configuração dinâmica' },
      {
        code: [
          '--providers.docker=true',
          '--providers.docker.exposedByDefault=false',
          '--providers.docker.network=web'
        ], run: false
      },
      {
        table: {
          head: ['Opção', 'Efeito'],
          rows: [
            ['<code>providers.docker=true</code>', 'liga a leitura das labels dos containers'],
            ['<code>exposedByDefault=false</code>', '<strong>só</strong> expõe containers com <code>traefik.enable=true</code>'],
            ['<code>network=web</code>', 'a rede pela qual o Traefik alcança os containers']
          ]
        }
      },
      {
        box: 'key', label: 'Sempre <code>exposedByDefault=false</code>', body: [
          { p: 'O padrão é <code>true</code>: qualquer container que suba no servidor vira candidato a rota. Em um servidor com vários projetos, isso é uma exposição acidental esperando para acontecer. Desligue, e marque explicitamente quem deve ser exposto com <code>traefik.enable=true</code>.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td14-2-a', kind: 'guiado', title: 'Duas regras, uma mais específica',
        body: [
          { p: 'Monte um Traefik e dois serviços no mesmo host, um deles com uma regra mais específica que o outro — e observe qual router ganha sem nenhum dos dois declarar <code>priority</code>:' },
          {
            code: [
              '$ mkdir -p ~/regras && cd ~/regras',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  traefik:',
              '    image: traefik:v3.7',
              '    restart: unless-stopped',
              '    command:',
              '      - "--providers.docker=true"',
              '      - "--providers.docker.exposedByDefault=false"',
              '      - "--entrypoints.web.address=:80"',
              '    ports:',
              '      - "8141:80"',
              '    volumes:',
              '      - /var/run/docker.sock:/var/run/docker.sock:ro',
              '',
              '  vitrine:',
              '    image: traefik/whoami:v1.10',
              '    restart: unless-stopped',
              '    labels:',
              '      - "traefik.enable=true"',
              '      - "traefik.http.routers.vitrine.rule=Host(`priori.local`)"',
              '      - "traefik.http.routers.vitrine.entrypoints=web"',
              '      - "traefik.http.services.vitrine.loadbalancer.server.port=80"',
              '',
              '  pedidos:',
              '    image: traefik/whoami:v1.10',
              '    restart: unless-stopped',
              '    labels:',
              '      - "traefik.enable=true"',
              '      - "traefik.http.routers.pedidos.rule=Host(`priori.local`) && PathPrefix(`/pedidos`)"',
              '      - "traefik.http.routers.pedidos.entrypoints=web"',
              '      - "traefik.http.services.pedidos.loadbalancer.server.port=80"',
              'EOF',
              '$ docker compose up -d',
              '$ curl -s -H "Host: priori.local" http://localhost:8141/ | head -1',
              '$ curl -s -H "Host: priori.local" http://localhost:8141/pedidos/123 | head -1'
            ]
          },
          { p: 'Nenhum dos dois routers declara <code>priority</code> — mas <code>/pedidos/123</code> mesmo assim vai para o <code>pedidos</code>, porque a regra dele é mais comprida. Sem essa regra de desempate, os dois casariam e o resultado seria imprevisível.' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código, na ordem em que aparece.'],
        check: async (ctx) => {
          const vitrine = D.doProjeto(ctx, 'regras', 'vitrine');
          const pedidos = D.doProjeto(ctx, 'regras', 'pedidos');
          const rGeral = D.http(ctx, 'localhost', 8141, '/', { Host: 'priori.local' });
          const rPedidos = D.http(ctx, 'localhost', 8141, '/pedidos/123', { Host: 'priori.local' });
          const veioDe = (r, c) => !!r && !!c && new RegExp('Hostname: ' + c.id.slice(0, 12)).test(r.body || '');
          return H.checkAll([
            [() => H.usedCommand(ctx, /docker\s+compose\s+up\s+-d/), 'Suba a stack com <code>docker compose up -d</code>.'],
            [() => H.usedCommand(ctx, /curl\b.*\/pedidos\/123/), 'Teste também o caminho <code>/pedidos/123</code>.'],
            [() => vitrine && vitrine.rodando && pedidos && pedidos.rodando, 'Os dois serviços (<code>vitrine</code> e <code>pedidos</code>) precisam estar rodando.'],
            [() => veioDe(rGeral, vitrine), 'A raiz (<code>/</code>) deveria vir do container <code>vitrine</code>.'],
            [() => veioDe(rPedidos, pedidos), 'O caminho <code>/pedidos/123</code> deveria vir do container <code>pedidos</code> — confira a regra com <code>PathPrefix</code>.']
          ]);
        }
      },
      {
        id: 'td14-2-f', kind: 'fill', title: 'Escreva a regra',
        body: [
          { p: 'Complete a regra de um router que atende <strong>somente</strong> as requisições para o host <code>painel.exemplo.com.br</code> cujo caminho comece com <code>/admin</code>. Use a sintaxe da v3.' }
        ],
        template: 'traefik.http.routers.painel.rule=___', sample: 'Host(`painel.exemplo.com.br`) && PathPrefix(`/admin`)',
        answers: ['.+'],
        hints: [
          'São dois matchers combinados. O operador "e" é <code>&&</code>.',
          'Na v3, os valores vão entre crases: <code>Host(`...`)</code>. O matcher de caminho por prefixo é <code>PathPrefix</code>.'
        ],
        solution: '<code>Host(`painel.exemplo.com.br`) &amp;&amp; PathPrefix(`/admin`)</code> — os dois precisam casar. Com aspas em vez de crases, a v3 recusa a regra.',
        check: (ctx) => {
          const v = (ctx.vals[0] || '').trim();
          if (!v) return { ok: false, msg: 'Escreva a regra completa.' };
          const req = { cabecalhos: { Host: 'painel.exemplo.com.br' }, caminho: '/admin/usuarios', metodo: 'GET' };
          const outroHost = { cabecalhos: { Host: 'loja.exemplo.com.br' }, caminho: '/admin/usuarios', metodo: 'GET' };
          const outroPath = { cabecalhos: { Host: 'painel.exemplo.com.br' }, caminho: '/publico', metodo: 'GET' };
          const casa = (r) => { try { return LX.traefikCasaRegra(v, r); } catch (e) { return null; } };
          return H.checkAll([
            [() => !/["']painel\.exemplo/.test(v), 'Na v3 os valores vão entre crases (<code>`</code>), não entre aspas.'],
            [() => casa(req) === true, 'A regra não casa com <code>painel.exemplo.com.br/admin/usuarios</code>, que deveria passar.'],
            [() => casa(outroHost) === false, 'A regra deixa passar outro host. Ela precisa exigir o <code>Host</code>.'],
            [() => casa(outroPath) === false, 'A regra deixa passar um caminho fora de <code>/admin</code>. Falta o <code>PathPrefix</code>.']
          ]);
        }
      },
      {
        id: 'td14-2-b', kind: 'desafio', title: 'Priority que ganha por declaração, não por tamanho',
        body: [
          { p: 'Em <code>~/prioridade</code>, monte um Traefik (porta <strong>8142</strong>) e dois serviços <code>traefik/whoami:v1.10</code>, os dois respondendo por <code>Host(`central14.local`)</code>:' },
          { ul: [
            '<code>vip</code> — regra <code>Host(`central14.local`) &amp;&amp; Path(`/vip`)</code>, com uma <code>priority</code> alta o bastante para ganhar do outro router, mesmo ele tendo uma regra mais comprida;',
            '<code>longo</code> — regra <code>Host(`central14.local`) &amp;&amp; PathPrefix(`/vip`) &amp;&amp; Method(`GET`)</code>, sem <code>priority</code> declarada.'
          ] },
          { p: 'Ao final, uma requisição para <code>Host: central14.local</code>, caminho <code>/vip</code>, precisa vir do container <strong><code>vip</code></strong> — mesmo a regra do <code>longo</code> sendo, sozinha, mais comprida (e por isso ganharia por padrão).' }
        ],
        hints: [
          'Sem <code>priority</code> declarada, quem ganha é a regra mais comprida — conte os caracteres das duas regras para ver quem sairia na frente por padrão.',
          'Declare a prioridade no router que precisa ganhar: <code>traefik.http.routers.vip.priority=NÚMERO</code>. Escolha um número bem acima do comprimento da regra concorrente.'
        ],
        solution: '<pre>$ mkdir -p ~/prioridade\n$ cd ~/prioridade\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    restart: unless-stopped\n    command:\n      - "--providers.docker=true"\n      - "--providers.docker.exposedByDefault=false"\n      - "--entrypoints.web.address=:80"\n    ports:\n      - "8142:80"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\n\n  vip:\n    image: traefik/whoami:v1.10\n    restart: unless-stopped\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.vip.rule=Host(`central14.local`) &amp;&amp; Path(`/vip`)"\n      - "traefik.http.routers.vip.priority=200"\n      - "traefik.http.routers.vip.entrypoints=web"\n      - "traefik.http.services.vip.loadbalancer.server.port=80"\n\n  longo:\n    image: traefik/whoami:v1.10\n    restart: unless-stopped\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.longo.rule=Host(`central14.local`) &amp;&amp; PathPrefix(`/vip`) &amp;&amp; Method(`GET`)"\n      - "traefik.http.routers.longo.entrypoints=web"\n      - "traefik.http.services.longo.loadbalancer.server.port=80"\nEOF\n$ docker compose up -d\n$ curl -s -H "Host: central14.local" http://localhost:8142/vip | head -1</pre>',
        check: (ctx) => {
          const vip = D.doProjeto(ctx, 'prioridade', 'vip');
          const longo = D.doProjeto(ctx, 'prioridade', 'longo');
          const resp = D.http(ctx, 'localhost', 8142, '/vip', { Host: 'central14.local' });
          const veioDe = (r, c) => !!r && !!c && new RegExp('Hostname: ' + c.id.slice(0, 12)).test(r.body || '');
          return H.checkAll([
            [() => vip && vip.rodando, 'O serviço <code>vip</code> não está rodando no projeto <code>prioridade</code>.'],
            [() => longo && longo.rodando, 'O serviço <code>longo</code> não está rodando.'],
            [() => !!resp && resp.status === 200, () => 'A requisição para <code>/vip</code> respondeu <code>' + (resp ? resp.status : 'nada') + '</code>.'],
            [() => veioDe(resp, vip), 'A resposta veio do container errado — declare <code>priority</code> no router <code>vip</code>, maior que o comprimento da regra do <code>longo</code>.']
          ]);
        }
      }
    ]
  });
})();
