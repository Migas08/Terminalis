/* =========================================================================
   MÓDULO D16 — Traefik e HTTPS
   Certificados, ACME, os três desafios, redirecionamento e um ambiente
   local onde dá para praticar sem ter domínio.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 16.1 ============================== */
  LX.lesson('d16', {
    id: 'ld16-1', n: '16.1', title: 'O que um certificado prova, e como o ACME emite',
    goal: 'Saber o que precisa estar verdadeiro no mundo para o Let\'s Encrypt emitir um certificado, e escolher o desafio certo.',
    body: [
      { h2: 'Duas coisas diferentes' },
      { p: 'HTTPS faz duas promessas, e vale separá-las porque elas falham por motivos diferentes:' },
      {
        ol: [
          '<strong>Criptografia</strong> — ninguém no caminho lê nem altera o tráfego. Para isso, um certificado qualquer serve, inclusive um autoassinado que você mesmo gera.',
          '<strong>Identidade</strong> — este servidor é mesmo o dono de <code>loja.com.br</code>. Isso só uma <strong>autoridade certificadora</strong> reconhecida pelos navegadores pode atestar.'
        ]
      },
      { p: 'O aviso vermelho do navegador não é sobre criptografia: a conexão está criptografada do mesmo jeito. Ele é sobre identidade — o navegador não reconhece quem assinou.' },

      { h2: 'ACME em uma frase' },
      {
        box: 'key', label: 'A ideia', body: [
          { p: 'ACME é o protocolo pelo qual um servidor <strong>prova automaticamente</strong> que controla um domínio e recebe um certificado por isso. O Let\'s Encrypt é a autoridade certificadora gratuita que popularizou o protocolo, e o Traefik fala ACME nativamente — sem certbot, sem cron, sem script de renovação.' }
        ]
      },
      {
        ascii: `Traefik                         Let's Encrypt
   │  "quero certificado             │
   │   para loja.com.br"  ──────────▶│
   │                                 │
   │◀──── "prove: publique isto" ────┤
   │                                 │
   │  publica a prova                │
   │  ──────────────────────────────▶│  verifica de fora,
   │                                 │  pela internet
   │◀──── certificado (90 dias) ─────┤
   └── renova sozinho aos 60 dias`
      },

      { h2: 'Os três desafios' },
      {
        table: {
          head: ['Desafio', 'Como prova', 'Precisa de', 'Curinga?'],
          rows: [
            ['<strong>HTTP-01</strong>', 'serve um arquivo em <code>/.well-known/acme-challenge/</code>', 'porta <strong>80</strong> aberta ao mundo', 'não'],
            ['<strong>TLS-ALPN-01</strong>', 'responde no handshake TLS', 'porta <strong>443</strong> aberta ao mundo', 'não'],
            ['<strong>DNS-01</strong>', 'cria um registro TXT no DNS', 'credencial de API do provedor de DNS', '<strong>sim</strong>']
          ]
        }
      },
      {
        code: [
          '# HTTP-01 — o mais comum',
          '--certificatesresolvers.le.acme.email=voce@exemplo.com.br',
          '--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json',
          '--certificatesresolvers.le.acme.httpchallenge=true',
          '--certificatesresolvers.le.acme.httpchallenge.entrypoint=web'
        ], run: false
      },
      {
        box: 'note', label: 'Qual escolher', body: [
          { p: '<strong>HTTP-01</strong> é o padrão de fato: simples, sem credencial extra. Exige a porta 80 aberta — inclusive depois, para a renovação.' },
          { p: '<strong>TLS-ALPN-01</strong> serve quando a porta 80 está fechada ou já ocupada, mas exige a 443 acessível diretamente.' },
          { p: '<strong>DNS-01</strong> é o único que emite <strong>curinga</strong> (<code>*.exemplo.com.br</code>) e o único que funciona para um servidor sem nenhuma porta exposta à internet. Em compensação, você entrega ao Traefik uma credencial que pode alterar seu DNS — guarde-a como segredo, nunca no <code>compose.yaml</code>.' }
        ]
      },

      { h2: 'O que precisa ser verdade antes de tentar' },
      { p: 'A emissão falha por motivos que estão fora do Docker. Confira esta lista antes de culpar o Traefik:' },
      {
        ol: [
          'O domínio <strong>existe</strong> e o registro A aponta para o IP público deste servidor. Confira com <code>dig +short loja.com.br</code>.',
          'A propagação do DNS terminou. Trocou o registro há cinco minutos? Espere.',
          'A porta do desafio está <strong>aberta na internet</strong> — no firewall do servidor <em>e</em> no grupo de segurança do provedor de nuvem.',
          'Nenhum outro programa está ocupando a porta 80 ou 443 no servidor.',
          'O e-mail do resolvedor está preenchido: sem ele, o Traefik ignora o resolvedor inteiro e serve o certificado autoassinado dele.'
        ]
      },
      {
        box: 'warn', label: 'Os limites do Let\'s Encrypt são reais', body: [
          { p: 'Existe um limite de <strong>5 falhas de validação por hora</strong> por conta e domínio, e limites semanais de emissão por domínio registrado. Ficar tentando "só mais uma vez" com o DNS errado bloqueia você por horas — bem no meio de uma migração.' },
          { p: 'Por isso, enquanto estiver ajustando, use o <strong>ambiente de teste</strong> (staging), que tem limites folgados:' },
          { code: ['--certificatesresolvers.le.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory'], run: false }
        ]
      },
      { p: 'O certificado de staging <strong>não é confiável</strong> — de propósito. Ele serve para você confirmar que o fluxo inteiro funciona; o navegador (e o <code>curl</code>) vão reclamar. Quando estiver tudo certo, remova a linha do <code>caserver</code>, <strong>apague o <code>acme.json</code></strong> (senão o Traefik reaproveita a conta de teste) e recrie o container.' },

      { h2: 'O <code>acme.json</code>' },
      { p: 'É onde o Traefik guarda a conta ACME e os certificados emitidos. Duas regras:' },
      {
        ul: [
          '<strong>Persistir em um volume.</strong> Sem isso, cada recriação do container pede tudo de novo — e você bate no limite de emissões.',
          '<strong>Permissão <code>600</code>.</strong> O arquivo contém a chave privada dos seus certificados. Se estiver mais aberto, o Traefik recusa a subir.'
        ]
      },
      {
        code: [
          '# usando um volume nomeado (o Traefik cria o arquivo com a permissão certa)',
          'volumes:',
          '  - letsencrypt:/letsencrypt',
          '',
          '# usando um bind mount, você prepara o arquivo antes',
          '$ touch ./letsencrypt/acme.json',
          '$ chmod 600 ./letsencrypt/acme.json'
        ], run: false
      },
      {
        box: 'warn', label: 'E ele nunca vai para o Git', body: [
          { p: 'O <code>acme.json</code> tem chave privada. Acrescente-o ao <code>.gitignore</code> junto com o <code>.env</code>. Se ele vazou, revogue os certificados e emita novos.' }
        ]
      }
    ],
    tasks: [
{
        id: 'td16-1-a', kind: 'guiado', title: 'Prepare o armazenamento do ACME',
        body: [
          { p: 'Quando se usa bind mount para o ACME, o arquivo precisa existir com a permissão certa <strong>antes</strong> de o Traefik subir — senão ele recusa a iniciar. Prepare-o:' },
          {
            code: [
              '$ mkdir -p ~/acme-lab/letsencrypt',
              '$ touch ~/acme-lab/letsencrypt/acme.json',
              '$ chmod 600 ~/acme-lab/letsencrypt/acme.json',
              '$ ls -l ~/acme-lab/letsencrypt/acme.json'
            ]
          },
          { p: 'O <code>600</code> deixa o arquivo legível e gravável só pelo dono. O <code>acme.json</code> guarda a chave privada dos seus certificados — por isso essa permissão, e por isso ele nunca vai para o Git.' }
        ],
        hints: ['Se o Traefik reclamar da permissão do <code>acme.json</code> ao subir, é exatamente este passo que faltou.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /touch\s+.*acme\.json/), 'Crie o arquivo com <code>touch ~/acme-lab/letsencrypt/acme.json</code>.'],
          [() => H.usedCommand(ctx, /chmod\s+600\s+.*acme\.json/), 'Ajuste a permissão com <code>chmod 600 ~/acme-lab/letsencrypt/acme.json</code>.']
        ])
      },
      {
        id: 'td16-1-q', kind: 'quiz', title: 'A emissão falhou',
        body: [
          { p: 'O log do Traefik repete:' },
          { code: ['unable to obtain ACME certificate for domains "app.exemplo.com.br": error: one or more domains had a problem: [app.exemplo.com.br] acme: error presenting token'], run: false, lang: 'text' },
          { p: 'A stack está certa, o container responde por HTTP interno, o DNS aponta para o servidor. O que investigar primeiro?' }
        ],
        options: [
          { text: 'Se a porta 80 está mesmo acessível <strong>a partir da internet</strong> — firewall do servidor e grupo de segurança do provedor. O HTTP-01 é validado de fora para dentro.', correct: true },
          { text: 'Se o <code>acme.json</code> tem permissão 600.', why: 'Permissão errada impede o Traefik de subir ou de gravar, com uma mensagem específica sobre o arquivo. Aqui a mensagem é sobre apresentar o token, ou seja, a validação externa.' },
          { text: 'Se a imagem do Traefik está atualizada.', why: 'A emissão não depende de versão nova. A mensagem descreve uma falha de validação, não um bug.' },
          { text: 'Se o container da aplicação está saudável.', why: 'A validação HTTP-01 é respondida pelo próprio Traefik, não pela aplicação. Ela falharia igual com a aplicação parada.' }
        ],
        hints: ['Quem faz a requisição de validação: o seu servidor ou o Let\'s Encrypt?'],
        explain: 'O HTTP-01 é validado <strong>de fora</strong>: o Let\'s Encrypt faz uma requisição à porta 80 do seu IP público. Se ela está fechada no firewall, no grupo de segurança da nuvem, ou o DNS aponta para outro lugar, o token não é encontrado. Teste de outra máquina: <code>curl -I http://app.exemplo.com.br/</code>. E enquanto ajusta, use o <code>caserver</code> de staging para não queimar o limite de tentativas.'
      },
      {
        id: 'td16-1-b', kind: 'desafio', title: 'Declare o resolvedor ACME',
        body: [
          { p: 'Em <code>~/acme-cfg</code>, escreva um <code>compose.yaml</code> com um serviço <code>traefik</code> (imagem <code>traefik:v3.7</code>) cuja seção <code>command</code> declare, corretamente, um resolvedor ACME chamado <code>le</code> usando o desafio <strong>HTTP-01</strong>. Ele precisa ter, nas flags:' },
          { ul: [
            'o <strong>e-mail</strong> do resolvedor preenchido (use <code>voce@exemplo.com.br</code>);',
            'o <strong>storage</strong> em <code>/letsencrypt/acme.json</code>;',
            'o <strong>httpchallenge</strong> ligado, apontando para o entryPoint <code>web</code>.'
          ] },
          { p: 'Não precisa subir nada — o que se avalia é a configuração escrita. As flags exatas estão na aula.' }
        ],
        hints: [
          'São quatro flags <code>--certificatesresolvers.le.acme.*</code>: <code>email</code>, <code>storage</code>, <code>httpchallenge</code> e <code>httpchallenge.entrypoint</code>.',
          'Escreva o serviço com a lista <code>command:</code> em YAML (uma flag por item), dentro de um heredoc: <code>cat &gt; compose.yaml &lt;&lt;\'EOF\' ... EOF</code>.'
        ],
        solution: '<pre>$ mkdir -p ~/acme-cfg\n$ cd ~/acme-cfg\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    command:\n      - "--providers.docker=true"\n      - "--entrypoints.web.address=:80"\n      - "--certificatesresolvers.le.acme.email=voce@exemplo.com.br"\n      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"\n      - "--certificatesresolvers.le.acme.httpchallenge=true"\n      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"\nEOF\n$ docker compose config</pre>',
        check: (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/acme-cfg/compose.yaml');
          const cmd = (doc && doc.services && doc.services.traefik && doc.services.traefik.command) || [];
          const flags = [].concat(cmd).map(String);
          const tem = (re) => flags.some(f => re.test(f));
          const emailFlag = flags.find(f => /certificatesresolvers\.le\.acme\.email=/.test(f)) || '';
          return LX.H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/acme-cfg/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc.services && doc.services.traefik, 'O arquivo precisa ter um serviço chamado <code>traefik</code>.'],
            [() => flags.length > 0, 'O serviço <code>traefik</code> precisa de uma seção <code>command</code> com as flags.'],
            [() => /@/.test(emailFlag.split('=')[1] || ''), 'A flag do <code>email</code> do resolvedor precisa estar preenchida — sem e-mail, o Traefik ignora o resolvedor inteiro.'],
            [() => tem(/certificatesresolvers\.le\.acme\.storage=\/letsencrypt\/acme\.json/), 'Falta a flag <code>storage</code> apontando para <code>/letsencrypt/acme.json</code>.'],
            [() => tem(/certificatesresolvers\.le\.acme\.httpchallenge=true/), 'Falta ligar o <code>httpchallenge</code> (HTTP-01).'],
            [() => tem(/certificatesresolvers\.le\.acme\.httpchallenge\.entrypoint=web/), 'Falta apontar o <code>httpchallenge.entrypoint</code> para <code>web</code>.']
          ]);
        }
      },

    ]
  });

  /* ============================== 16.2 ============================== */
  LX.lesson('d16', {
    id: 'ld16-2', n: '16.2', title: 'HTTPS na prática e o laboratório local',
    goal: 'Montar a configuração completa de HTTPS com redirecionamento e entender por que ela não emite certificado em ambiente local.',
    body: [
      { h2: 'A configuração completa' },
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
          '      - "--entrypoints.websecure.address=:443"',
          '      # todo tráfego HTTP vira HTTPS, para todos os sites',
          '      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"',
          '      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"',
          '      - "--entrypoints.web.http.redirections.entrypoint.permanent=true"',
          '      # TLS por padrão no entryPoint seguro',
          '      - "--entrypoints.websecure.http.tls=true"',
          '      - "--entrypoints.websecure.http.tls.certresolver=le"',
          '      # o resolvedor ACME',
          '      - "--certificatesresolvers.le.acme.email=${EMAIL_ACME:?defina EMAIL_ACME no .env}"',
          '      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"',
          '      - "--certificatesresolvers.le.acme.httpchallenge=true"',
          '      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"',
          '      - "--accesslog=true"',
          '    ports:',
          '      - "80:80"',
          '      - "443:443"',
          '    volumes:',
          '      - /var/run/docker.sock:/var/run/docker.sock:ro',
          '      - letsencrypt:/letsencrypt',
          '',
          '  site:',
          '    image: traefik/whoami:v1.10',
          '    restart: unless-stopped',
          '    labels:',
          '      - "traefik.enable=true"',
          '      - "traefik.http.routers.site.rule=Host(`loja.exemplo.com.br`)"',
          '      - "traefik.http.routers.site.entrypoints=websecure"',
          '      - "traefik.http.routers.site.tls.certresolver=le"',
          '      - "traefik.http.services.site.loadbalancer.server.port=80"',
          '',
          'volumes:',
          '  letsencrypt:'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'key', label: 'Redirecionamento: no entryPoint, não em cada site', body: [
          { p: 'Declarar a redireção no <strong>entryPoint</strong> <code>web</code> faz todo o tráfego HTTP da máquina virar HTTPS, para qualquer domínio, sem repetir label em cada serviço.' },
          { p: 'A alternativa é um middleware <code>redirectScheme</code> por router — útil quando você quer a exceção de um site que precisa continuar em HTTP. Se não precisa, use a forma global: menos linhas, menos esquecimento.' }
        ]
      },
      {
        table: {
          head: ['Onde definir o certResolver', 'Efeito'],
          rows: [
            ['<code>--entrypoints.websecure.http.tls.certresolver=le</code>', 'padrão para <strong>todo</strong> router que entra pelo websecure'],
            ['<code>traefik.http.routers.X.tls.certresolver=le</code>', 'só para aquele router — sobrepõe o padrão'],
            ['<code>traefik.http.routers.X.tls=true</code> (sem resolver)', 'usa o certificado padrão do Traefik: autoassinado, o navegador reclama']
          ]
        }
      },

      { h2: 'Por que isso não emite certificado no seu laboratório' },
      {
        box: 'warn', label: 'Domínio local não recebe certificado do Let\'s Encrypt', body: [
          { p: 'Nomes como <code>site.local</code>, <code>app.test</code> ou <code>meuprojeto.localhost</code> <strong>não são domínios públicos</strong>. O Let\'s Encrypt precisa alcançar o servidor de fora, pela internet, para validar — e não há como alcançar um nome que só existe no seu <code>/etc/hosts</code>.' },
          { p: 'Isso não é limitação do Traefik nem erro de configuração: é como a autoridade certificadora funciona. Nenhuma CA pública emite para domínio não público.' }
        ]
      },
      { p: 'O que acontece então, na prática: o Traefik serve o <strong>certificado padrão dele</strong>, autoassinado. O HTTPS funciona — o tráfego é criptografado — mas o cliente não confia em quem assinou:' },
      {
        code: [
          'curl -s -H "Host: site.local" https://localhost/',
          '# curl: (60) SSL certificate problem: ...'
        ], run: false
      },
      { p: 'Para praticar mesmo assim, existem três caminhos honestos:' },
      {
        table: {
          head: ['Caminho', 'Como', 'Quando usar'],
          rows: [
            ['aceitar o certificado', '<code>curl -k</code>, ou "avançar" no navegador', 'testar roteamento e redirecionamento localmente'],
            ['CA local', 'gerar uma CA com <code>mkcert</code> e instalá-la no seu sistema', 'desenvolvimento sério, com cadeado verde no navegador'],
            ['domínio de verdade', 'um domínio barato apontando para o servidor', 'quando for para produção — e é o único jeito de testar o ACME de ponta a ponta']
          ]
        }
      },
      {
        box: 'note', label: 'O <code>-k</code> é para o laboratório', body: [
          { p: '<code>curl -k</code> (ou <code>--insecure</code>) manda ignorar a validação do certificado. É perfeito para testar sua própria stack e <strong>péssimo</strong> como hábito: em um script que fala com um serviço real, ele remove justamente a proteção contra alguém se passar pelo servidor.' }
        ]
      },

      { h2: 'Conferindo que o HTTPS está certo' },
      {
        code: [
          '# 1. HTTP redireciona? (301 + Location https)',
          'curl -sI -H "Host: site.local" http://localhost/',
          '',
          '# 2. HTTPS responde? (no laboratório, com -k)',
          'curl -sk -H "Host: site.local" https://localhost/',
          '',
          '# 3. o que o Traefik registrou?',
          'docker logs traefik | tail -20'
        ], run: false
      },
      {
        table: {
          head: ['Você vê', 'Significa'],
          rows: [
            ['<code>301</code> com <code>Location: https://…</code>', 'a redireção do entryPoint está funcionando'],
            ['<code>curl: (60) SSL certificate problem</code>', 'HTTPS funcionando com certificado não confiável — esperado em domínio local'],
            ['<code>Client sent an HTTP request to an HTTPS server</code>', 'você mandou HTTP numa porta que só fala TLS'],
            ['<code>404</code> no HTTPS mas 200 no HTTP', 'falta <code>entrypoints=websecure</code> no router'],
            ['<code>acme: error presenting token</code>', 'a validação externa não chegou: porta 80 ou DNS']
          ]
        }
      }
    ],
    tasks: [
{
        id: 'td16-2-a', kind: 'guiado', title: 'Veja o redirect e o certificado local',
        body: [
          { p: 'Suba a stack HTTPS completa e observe as duas coisas que a aula explica: o redirecionamento de HTTP para HTTPS, e o certificado autoassinado que o Traefik serve para um domínio local.' },
          {
            code: [
              '$ mkdir -p ~/lab-tls && cd ~/lab-tls',
              '$ cat > compose.yaml <<\'EOF\'',
              'services:',
              '  traefik:',
              '    image: traefik:v3.7',
              '    command:',
              '      - "--providers.docker=true"',
              '      - "--providers.docker.exposedByDefault=false"',
              '      - "--entrypoints.web.address=:80"',
              '      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"',
              '      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"',
              '      - "--entrypoints.websecure.address=:443"',
              '      - "--entrypoints.websecure.http.tls=true"',
              '    ports:',
              '      - "8138:80"',
              '      - "8139:443"',
              '    volumes:',
              '      - /var/run/docker.sock:/var/run/docker.sock:ro',
              '  site:',
              '    image: traefik/whoami:v1.10',
              '    labels:',
              '      - "traefik.enable=true"',
              '      - "traefik.http.routers.lab.rule=Host(`lab.local`)"',
              '      - "traefik.http.routers.lab.entrypoints=websecure"',
              '      - "traefik.http.services.lab.loadbalancer.server.port=80"',
              'EOF',
              '$ docker compose up -d',
              '$ curl -sI -H "Host: lab.local" http://localhost:8138/',
              '$ curl -sk -H "Host: lab.local" https://localhost:8139/ | grep Hostname'
            ]
          },
          { p: 'A primeira requisição (HTTP) responde <code>301</code> com <code>Location: https://...</code>: o redirect do entryPoint <code>web</code>. A segunda só funciona com o <code>-k</code>, porque <code>lab.local</code> não é um domínio público — o Traefik serve o certificado autoassinado dele, e o cliente, corretamente, desconfia.' }
        ],
        hints: ['Sem o <code>-k</code>, o <code>curl</code> na porta HTTPS vai recusar o certificado. Isso é o esperado em domínio local, não um erro de configuração.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba a stack com <code>docker compose up -d</code> em <code>~/lab-tls</code>.'],
          [() => H.usedCommand(ctx, /curl.*https:\/\/localhost:8139|curl\s+-sk/), 'Teste o HTTPS com <code>curl -sk -H "Host: lab.local" https://localhost:8139/</code>.']
        ])
      },
      {
        id: 'td16-2-q', kind: 'quiz', title: 'Staging para produção',
        body: [
          { p: 'Você validou toda a stack usando o servidor de teste (staging) do Let\'s Encrypt. Está tudo funcionando, com o aviso de certificado não confiável — como esperado. Agora vai para produção. O que fazer?' }
        ],
        options: [
          { text: 'Remover a linha do <code>caserver</code>, <strong>apagar o <code>acme.json</code></strong> e recriar o container do Traefik.', correct: true },
          { text: 'Apenas remover a linha do <code>caserver</code> e recriar o container.', why: 'Perto: mas o <code>acme.json</code> ainda guarda a conta e os certificados de staging. Sem apagá-lo, o Traefik reaproveita o que já tem e você continua com certificado de teste.' },
          { text: 'Trocar o <code>caserver</code> para o endereço de produção do Let\'s Encrypt.', why: 'Desnecessário: o padrão do Traefik já é o servidor de produção. Basta remover a linha — e ainda sobra o problema do <code>acme.json</code> antigo.' },
          { text: 'Nada: o Traefik detecta o ambiente e troca sozinho quando o domínio fica público.', why: 'Não existe essa detecção. O resolvedor usa o servidor que você configurou, e o estado dele fica no <code>acme.json</code>.' }
        ],
        hints: ['Pergunte-se onde ficou guardada a conta ACME de teste.'],
        explain: 'A conta e os certificados de staging ficam no <code>acme.json</code>. O caminho é: remover a linha <code>caserver</code>, apagar o <code>acme.json</code> (ou o volume) e recriar o Traefik — configuração estática só é lida na inicialização. Depois, confirme no navegador que o cadeado está limpo e que o emissor é o Let\'s Encrypt de produção.'
      },
            {
        id: 'td16-2-b', kind: 'desafio', title: 'HTTPS com redirecionamento',
        body: [
          { p: 'Em <code>~/tls</code>, monte a stack completa:' },
          { ul: [
            '<code>traefik</code> (<code>traefik:v3.7</code>) publicando <strong>80 e 443</strong>, socket montado <code>:ro</code>, <code>exposedByDefault=false</code>, entryPoints <code>web</code> (:80) e <code>websecure</code> (:443), TLS ligado no <code>websecure</code>, <strong>redirecionamento global de <code>web</code> para <code>websecure</code></strong> em HTTPS e permanente, um resolvedor ACME chamado <code>le</code> com e-mail preenchido e <code>httpchallenge</code> pelo entryPoint <code>web</code>, e <code>accesslog</code> ligado;',
            '<code>site</code> (<code>traefik/whoami:v1.10</code>), sem publicar porta, com router <code>site</code> respondendo por <code>Host(`site.local`)</code> <strong>no entryPoint websecure</strong>, com <code>tls.certresolver=le</code> e porta interna 80.'
          ] },
          { p: 'Ao final:' },
          { ol: [
            '<code>curl -sI -H "Host: site.local" http://localhost/</code> deve devolver <strong>301</strong> com <code>Location</code> em <code>https://</code>;',
            '<code>curl -sk -H "Host: site.local" https://localhost/</code> deve devolver a resposta do <code>whoami</code>;',
            'sem o <code>-k</code>, o <code>curl</code> deve <strong>recusar</strong> o certificado — e você deve entender por quê.'
          ] }
        ],
        hints: [
          'A redireção global tem três flags: <code>...redirections.entrypoint.to=websecure</code>, <code>.scheme=https</code> e <code>.permanent=true</code>, todas no entryPoint <code>web</code>.',
          'O <code>site.local</code> não é um domínio público, então o Let\'s Encrypt não emite certificado para ele: o Traefik serve o autoassinado. Por isso o teste do HTTPS é com <code>-k</code>.'
        ],
        solution: '<pre>$ mkdir -p ~/tls\n$ cd ~/tls\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    restart: unless-stopped\n    command:\n      - "--providers.docker=true"\n      - "--providers.docker.exposedByDefault=false"\n      - "--entrypoints.web.address=:80"\n      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"\n      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"\n      - "--entrypoints.web.http.redirections.entrypoint.permanent=true"\n      - "--entrypoints.websecure.address=:443"\n      - "--entrypoints.websecure.http.tls=true"\n      - "--certificatesresolvers.le.acme.email=admin@exemplo.com.br"\n      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"\n      - "--certificatesresolvers.le.acme.httpchallenge=true"\n      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"\n      - "--accesslog=true"\n    ports:\n      - "80:80"\n      - "443:443"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\n      - letsencrypt:/letsencrypt\n\n  site:\n    image: traefik/whoami:v1.10\n    restart: unless-stopped\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.site.rule=Host(`site.local`)"\n      - "traefik.http.routers.site.entrypoints=websecure"\n      - "traefik.http.routers.site.tls.certresolver=le"\n      - "traefik.http.services.site.loadbalancer.server.port=80"\n\nvolumes:\n  letsencrypt:\nEOF\n$ docker compose up -d\n$ curl -sI -H "Host: site.local" http://localhost/ | head -3\n$ curl -sk -H "Host: site.local" https://localhost/ | head -3\n$ curl -s -H "Host: site.local" https://localhost/</pre>',
        check: (ctx) => {
          const tf = D.doProjeto(ctx, 'tls', 'traefik');
          const site = D.doProjeto(ctx, 'tls', 'site');
          const argv = tf ? (tf.entrypoint || []).concat(tf.cmd || []).join(' ') : '';
          const redir = D.http(ctx, 'localhost', 80, '/', { Host: 'site.local' });
          const m = ctx.machine || ctx.sh.m;
          let seguro = null, recusou = false;
          try {
            seguro = LX.httpRequest(m, 'localhost', 443, '/', 'GET',
              { cabecalhos: { Host: 'site.local' }, tls: true, inseguro: true });
          } catch (e) { seguro = null; }
          try {
            LX.httpRequest(m, 'localhost', 443, '/', 'GET', { cabecalhos: { Host: 'site.local' }, tls: true });
          } catch (e) { recusou = e.code === 'ECERT'; }
          return H.checkAll([
            [() => tf && tf.rodando, 'O Traefik não está rodando no projeto <code>tls</code>.'],
            [() => site && site.rodando, 'O serviço <code>site</code> não está rodando.'],
            [() => D.publicada(ctx, tf.nome, 80) && D.publicada(ctx, tf.nome, 443),
              'O Traefik precisa publicar as portas 80 <strong>e</strong> 443 do servidor.'],
            [() => site.portas.length === 0, 'O <code>site</code> não deve publicar porta.'],
            [() => /entrypoints\.websecure\.address=:443/.test(argv), 'Falta o entryPoint <code>websecure</code> na porta 443.'],
            [() => /redirections\.entrypoint\.to=websecure/.test(argv),
              'Falta o redirecionamento global do entryPoint <code>web</code> para o <code>websecure</code>.'],
            [() => /certificatesresolvers\.le\.acme\.email=\S+@\S+/.test(argv),
              'O resolvedor <code>le</code> precisa de um e-mail — sem ele o Traefik ignora o resolvedor inteiro.'],
            [() => /certificatesresolvers\.le\.acme\.httpchallenge/.test(argv), 'Falta configurar o desafio HTTP-01 do resolvedor.'],
            [() => Object.entries(site.labels || {}).some(([k, v]) => /routers\.site\.entrypoints$/.test(k) && /websecure/.test(String(v))),
              'O router do <code>site</code> precisa atender o entryPoint <code>websecure</code>.'],
            [() => Object.keys(site.labels || {}).some(k => /routers\.site\.tls\.certresolver$/.test(k)),
              'Falta a label <code>traefik.http.routers.site.tls.certresolver=le</code>.'],
            [() => !!redir && (redir.status === 301 || redir.status === 308),
              () => 'A requisição HTTP respondeu <code>' + (redir ? redir.status : 'nada') + '</code>; esperava 301.'],
            [() => /^https:\/\//.test(((redir && redir.cabecalhos) || {}).Location || ''),
              'O redirecionamento não aponta para <code>https://</code>.'],
            [() => !!seguro && seguro.status === 200 && /Hostname:/.test(seguro.body || ''),
              'Com o certificado aceito (<code>-k</code>), a porta 443 deveria devolver a resposta do <code>whoami</code>.'],
            [() => recusou,
              'Sem o <code>-k</code>, o cliente deveria recusar o certificado — é o esperado em domínio local. Se não recusou, algo está servindo sem TLS.']
          ]);
        }
      },

    ]
  });
})();
