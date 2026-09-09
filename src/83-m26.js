/* =========================================================================
   MÓDULO 26 — Projetos integrados
   Três entregas que juntam as duas trilhas: o host preparado à mão (contas,
   diretórios, resolução de nomes, scripts) sustentando uma stack Docker. Aqui
   não há "só Linux" nem "só Docker" — é o ambiente inteiro, como em produção.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 26.1 ============================== */
  LX.lesson('m26', {
    id: 'lm26-1', n: '26.1', title: 'O host prepara, a stack sobe',
    goal: 'Preparar o servidor com as ferramentas do Linux — uma conta de serviço e um diretório de dados — e assentar uma stack Docker sobre esse preparo.',
    body: [
      { h2: 'Onde as duas trilhas se encontram' },
      { p: 'Até agora, Linux e Docker vieram separados. Em produção eles são o mesmo trabalho: o host é <strong>preparado à mão</strong> — uma conta dedicada, um lugar certo para os dados — e a stack Docker <strong>assenta sobre esse preparo</strong>. Este módulo são três entregas assim. A primeira: preparar o servidor e subir a stack usando o que você preparou.' },
      {
        box: 'note', label: 'Chamado #8100 — assentar a loja em srv-loja', body: [
          { ul: [
            'Uma conta de serviço <strong><code>deploy</code></strong> para operar a aplicação (nada de rodar tudo como root ou pela sua conta pessoal).',
            'Os dados do banco moram em <strong><code>/srv/loja</code></strong>, um diretório no disco do host — não perdido dentro de um container.',
            'A stack: um <strong>site</strong> (nginx) acessível, e um <strong>banco</strong> MariaDB cujos dados ficam justamente em <code>/srv/loja</code>.'
          ] }
        ]
      },
      { p: 'Repare que o pedido cruza os dois mundos numa frase só: "os dados do banco (Docker) moram num diretório do host (Linux)". Isso é um <strong>bind mount</strong> — o diretório <code>/srv/loja</code> que você cria e prepara no Linux é montado dentro do container do banco em <code>/var/lib/mysql</code>.' },
      {
        code: [
          '# preparo do host (Linux)',
          'sudo useradd -m deploy',
          'sudo mkdir -p /srv/loja',
          'sudo chown deploy:deploy /srv/loja',
          '',
          '# a stack (Docker), com o banco gravando em /srv/loja',
          '#   db.volumes:  - /srv/loja:/var/lib/mysql'
        ], run: false
      },
      {
        box: 'key', label: 'Volume nomeado × bind mount de novo', body: [
          { p: 'Nos projetos de Docker você usou <strong>volumes nomeados</strong> (o Docker gerencia onde ficam). Aqui é um <strong>bind mount</strong>: você aponta um caminho <em>seu</em>, do host, e sabe exatamente onde os dados estão — em <code>/srv/loja</code>, num diretório que você criou, com o dono que você definiu. É a escolha de quem quer os dados num lugar conhecido do sistema, integrados à gestão do host (backup, permissões, disco).' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tm26-1-a', kind: 'guiado', title: 'Veja o terreno dos dois lados',
        body: [
          { p: 'Antes de preparar, confira o estado do host e do Docker:' },
          { code: [
            '$ getent passwd deploy',
            '$ ls -ld /srv',
            '$ docker ps'
          ] },
          { p: 'A conta <code>deploy</code> ainda não existe, o <code>/srv</code> está lá mas sem o <code>/srv/loja</code>, e nenhum container roda. É o ponto de partida: preparar o host e então subir a stack.' }
        ],
        hints: ['Um comando por vez: <code>getent passwd deploy</code>, <code>ls -ld /srv</code>, <code>docker ps</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /getent|ls\s+-l?d?\s*\/srv|docker\s+ps/), 'Confira o terreno com <code>getent passwd deploy</code>, <code>ls -ld /srv</code> e <code>docker ps</code>.']
        ])
      },
      {
        id: 'tm26-1-q', kind: 'quiz', title: 'Por que /srv/loja e não um volume nomeado',
        body: [{ p: 'O chamado pede que os dados do banco fiquem em <code>/srv/loja</code>, um diretório do host, em vez de um volume nomeado gerenciado pelo Docker. Que vantagem isso traz?' }],
        options: [
          { text: 'Você sabe exatamente onde os dados estão no host e os integra à gestão do sistema: o mesmo <code>chown</code>, os mesmos backups e o mesmo controle de disco que valem para o resto de <code>/srv</code>. O bind mount põe os dados num caminho conhecido, não num diretório interno do Docker.', correct: true },
          { text: 'Bind mount é mais rápido que volume nomeado.', why: 'Desempenho não é o ponto. A diferença é <em>onde</em> os dados moram e quem os administra: um caminho seu, do host, versus um diretório gerenciado pelo Docker.' },
          { text: 'Volumes nomeados não guardam dados de banco.', why: 'Guardam perfeitamente — você usou volumes nomeados para bancos nos projetos anteriores. Aqui a escolha é ter os dados num caminho conhecido do host, não uma limitação técnica.' },
          { text: 'Só o bind mount sobrevive à recriação do container.', why: 'Os dois sobrevivem à recriação. A diferença é a localização e a gestão: o bind mount fica num caminho do host que você controla diretamente.' }
        ],
        hints: ['Pense em quem faz o backup e o controle de permissões daquele diretório.'],
        explain: 'Volume nomeado e bind mount persistem igual; mudam o dono da gestão. Um bind mount para <code>/srv/loja</code> coloca os dados num caminho do host que <em>você</em> administra — com o <code>chown</code>, o backup e o controle de disco do sistema. É a escolha de quem quer os dados integrados à operação do servidor, num lugar conhecido, e não num diretório interno do Docker.'
      },
      {
        id: 'tm26-1-b', kind: 'desafio', title: 'Prepare o host e assente a stack',
        body: [
          { p: 'Entregue o chamado #8100 de ponta a ponta:' },
          { ul: [
            'crie a conta de serviço <code>deploy</code> (com diretório pessoal);',
            'crie o diretório <code>/srv/loja</code> e faça-o pertencer ao <code>deploy</code>;',
            'em <code>~/loja</code>, suba uma stack com um <code>site</code> (<code>nginx:alpine</code>) publicando a porta de host <strong>8900</strong> e um <code>db</code> (<code>mariadb:11.4</code>, senha de root <code>SENHA_DO_BANCO</code>, banco <code>loja</code>) cujos dados ficam em <code>/srv/loja</code> via bind mount, <strong>sem publicar porta</strong>.'
          ] },
          { p: 'Ao final: a conta <code>deploy</code> existe; <code>/srv/loja</code> existe e pertence a ela; o <code>site</code> está no ar na 8900; o <code>db</code> está no ar, sem porta, gravando em <code>/srv/loja</code>.' }
        ],
        hints: [
          'Preparo do host primeiro: <code>sudo useradd -m deploy</code>, <code>sudo mkdir -p /srv/loja</code>, <code>sudo chown deploy:deploy /srv/loja</code>.',
          'No <code>compose.yaml</code>, o bind mount do banco é <code>- /srv/loja:/var/lib/mysql</code> (caminho absoluto do host, sem seção <code>volumes:</code>).'
        ],
        solution: '<div class="code"><pre>$ sudo useradd -m deploy\n$ sudo mkdir -p /srv/loja\n$ sudo chown deploy:deploy /srv/loja\n$ mkdir -p ~/loja && cd ~/loja\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8900:80"\n\n  db:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: SENHA_DO_BANCO\n      MARIADB_DATABASE: loja\n    volumes:\n      - /srv/loja:/var/lib/mysql\nEOF\n$ docker compose up -d\n$ docker compose ps</pre></div><p style="margin-top:8px">O preparo do host (conta e diretório) veio antes; a stack só assentou depois. O bind mount liga os dois: o banco grava no <code>/srv/loja</code> que você criou e cujo dono você definiu.</p>',
        check: (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const dep = m.userByName('deploy');
          let dirNode = null;
          try { dirNode = m.fs.stat('/srv/loja', { ctx: m.ctxRoot() }); } catch (e) { }
          const site = D.doProjeto(ctx, 'loja', 'site');
          const db = D.doProjeto(ctx, 'loja', 'db');
          const bind = db ? (db.montagens || []).find(mo => mo.tipo === 'bind' && LX.FileSystem.normalize(mo.destino) === '/var/lib/mysql' && /\/srv\/loja$/.test(mo.origem || '')) : null;
          return H.checkAll([
            [() => !!dep, 'A conta de serviço <code>deploy</code> ainda não existe. Crie-a com <code>sudo useradd -m deploy</code>.'],
            [() => !!dirNode && dirNode.type === 'dir', 'O diretório <code>/srv/loja</code> não existe. Crie-o com <code>sudo mkdir -p /srv/loja</code>.'],
            [() => !!dirNode && !!dep && dirNode.uid === dep.uid, 'O <code>/srv/loja</code> precisa pertencer ao <code>deploy</code> (<code>sudo chown deploy:deploy /srv/loja</code>).'],
            [() => !!site && site.rodando, 'O serviço <code>site</code> não está no ar.'],
            [() => !!site && D.publicada(ctx, site.nome, 8900), 'O <code>site</code> precisa publicar a porta 8900.'],
            [() => !!db && db.rodando, 'O serviço <code>db</code> não está no ar.'],
            [() => !!db && (db.portas || []).length === 0, 'O <code>db</code> não deve publicar porta — ele é interno.'],
            [() => !!bind, 'O <code>db</code> precisa gravar em <code>/srv/loja</code> via bind mount (<code>- /srv/loja:/var/lib/mysql</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 26.2 ============================== */
  LX.lesson('m26', {
    id: 'lm26-2', n: '26.2', title: 'Produção de ponta a ponta',
    goal: 'Montar a forma de produção — proxy na frente, serviço atrás sem porta — e fechar o último elo pelo host: fazer a máquina resolver o domínio.',
    body: [
      { h2: 'A stack certa não basta se o nome não resolve' },
      { p: 'Você já sabe pôr um serviço atrás do Traefik e roteá-lo por domínio. Mas há um elo que é do <em>host</em>, não do Docker: para abrir <code>http://loja.local/</code> na própria máquina, ela precisa <strong>resolver</strong> esse nome. A entrega de produção só está completa quando os dois lados se encontram: o Docker roteando por <code>Host(loja.local)</code>, e o host sabendo que <code>loja.local</code> é ele mesmo.' },
      {
        box: 'note', label: 'Chamado #8140 — publicar a loja por domínio', body: [
          { ul: [
            'Um <strong>proxy</strong> Traefik como único ponto de entrada, dono da porta 80.',
            'O <strong>site</strong> atrás dele, <strong>sem publicar porta</strong>, roteado por <code>Host(<code>loja.local</code>)</code>.',
            'A máquina precisa abrir <code>http://loja.local/</code> — ou seja, resolver esse nome localmente.'
          ] }
        ]
      },
      {
        code: [
          '# Docker: proxy + site roteado (nada de porta no site)',
          '#   traefik: ports ["80:80"], socket :ro, exposedByDefault=false',
          '#   site: labels traefik.enable + router Host(`loja.local`) + service port 80',
          '',
          '# Host (Linux): a máquina resolve o nome para ela mesma',
          'echo "127.0.0.1 loja.local" | sudo tee -a /etc/hosts'
        ], run: false
      },
      {
        box: 'key', label: 'Divisão de tarefas', body: [
          { p: 'O <strong>Docker</strong> recebe na porta 80 e decide, pelo <code>Host</code>, para qual container mandar. O <strong>host</strong> decide o que <code>loja.local</code> significa — e, pela linha no <code>/etc/hosts</code>, faz esse nome apontar para a própria máquina, onde o Traefik escuta. Um sem o outro não abre o site: com a stack certa mas sem o <code>/etc/hosts</code>, o navegador não resolve o nome; com o <code>/etc/hosts</code> mas sem o roteamento, o Traefik responde 404.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tm26-2-a', kind: 'guiado', title: 'Suba a stack e feche pelo host',
        body: [
          { p: 'Monte o proxy com o site e complete a resolução no host:' },
          { code: [
            '$ mkdir -p ~/prod && cd ~/prod',
            '# (use o compose.yaml de proxy + site que você já domina)',
            '$ docker compose up -d',
            '$ curl -sI -H "Host: loja.local" http://localhost/',
            '$ echo "127.0.0.1 loja.local" | sudo tee -a /etc/hosts',
            '$ curl -sI http://loja.local/'
          ] },
          { p: 'Com o <code>Host</code> forçado no <code>curl</code>, o Traefik já roteia (200). Depois da linha no <code>/etc/hosts</code>, o próprio nome <code>loja.local</code> resolve, e a requisição passa a funcionar como no navegador da equipe.' }
        ],
        hints: ['Primeiro prove o roteamento com <code>curl -H "Host: loja.local"</code>; depois acrescente o nome ao <code>/etc/hosts</code> e teste sem o <code>-H</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+compose\s+up/), 'Suba a stack com <code>docker compose up -d</code> em <code>~/prod</code>.']
        ])
      },
      {
        id: 'tm26-2-q', kind: 'quiz', title: 'Quem faz o quê',
        body: [{ p: 'Com o proxy e o site prontos, <code>curl -H "Host: loja.local" http://localhost/</code> dá 200, mas <code>curl http://loja.local/</code> (sem forçar o Host) dá <code>Could not resolve host</code>. O que falta?' }],
        options: [
          { text: 'Falta o host resolver o nome. O roteamento do Docker está certo (o 200 com Host forçado prova); o que falta é a máquina saber que <code>loja.local</code> é ela mesma — uma linha no <code>/etc/hosts</code> apontando para <code>127.0.0.1</code>.', correct: true },
          { text: 'Falta o site publicar uma porta.', why: 'O site não deve publicar porta — quem recebe é o proxy. E o 200 com Host forçado mostra que o caminho até o site funciona. O que falta é a resolução do nome no host.' },
          { text: 'A regra <code>Host()</code> do router está errada.', why: 'Se a regra estivesse errada, o <code>curl</code> com Host forçado daria 404, não 200. A regra casa; o problema é o host não traduzir o nome antes de conectar.' },
          { text: 'O Traefik precisa de uma entrada de DNS pública.', why: 'Para um domínio local de teste, não é preciso DNS público: o <code>/etc/hosts</code> resolve na própria máquina. É o elo do host que fecha a entrega.' }
        ],
        hints: ['O 200 com Host forçado já provou que o Docker roteia. O que sobra é a tradução do nome, e ela é do host.'],
        explain: 'A entrega tem dois donos. O Docker roteia por <code>Host</code> — e o 200 com o Host forçado prova que essa parte está pronta. Resolver o nome <code>loja.local</code> para um endereço é do sistema operacional; para um domínio local, a linha em <code>/etc/hosts</code> apontando para <code>127.0.0.1</code> fecha o elo. Só com os dois o site abre pelo nome.'
      },
      {
        id: 'tm26-2-b', kind: 'desafio', title: 'A loja no ar pelo domínio',
        body: [
          { p: 'Em <code>~/prod</code>, entregue o chamado #8140 inteiro:' },
          { ul: [
            '<code>traefik</code> (<code>traefik:v3.7</code>) publicando a porta <strong>80</strong>, socket do Docker montado somente leitura, provider Docker com <code>exposedByDefault=false</code> e entryPoint <code>web</code> na 80;',
            '<code>site</code> (<code>nginx:alpine</code>) <strong>sem publicar porta</strong>, com labels que criem um router por <code>Host(<code>loja.local</code>)</code> no entryPoint <code>web</code> e um service na porta interna 80;',
            'a linha no <code>/etc/hosts</code> que faz a máquina resolver <code>loja.local</code> para <code>127.0.0.1</code>.'
          ] },
          { p: 'Ao final: uma requisição a <code>http://loja.local/</code> (sem forçar o Host) precisa responder <strong>200</strong>, e um host desconhecido deve continuar recebendo 404.' }
        ],
        hints: [
          'Reaproveite o <code>compose.yaml</code> de proxy + site que você montou nos módulos de Traefik; o site usa <code>nginx:alpine</code> e escuta na porta 80.',
          'Feche pelo host: <code>echo "127.0.0.1 loja.local" | sudo tee -a /etc/hosts</code>. Teste com <code>curl -sI http://loja.local/</code>.'
        ],
        solution: '<div class="code"><pre>$ mkdir -p ~/prod && cd ~/prod\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    restart: unless-stopped\n    command:\n      - "--providers.docker=true"\n      - "--providers.docker.exposedByDefault=false"\n      - "--entrypoints.web.address=:80"\n    ports:\n      - "80:80"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\n\n  site:\n    image: nginx:alpine\n    restart: unless-stopped\n    labels:\n      - "traefik.enable=true"\n      - "traefik.http.routers.site.rule=Host(`loja.local`)"\n      - "traefik.http.routers.site.entrypoints=web"\n      - "traefik.http.services.site.loadbalancer.server.port=80"\nEOF\n$ docker compose up -d\n$ echo "127.0.0.1 loja.local" | sudo tee -a /etc/hosts\n$ curl -sI http://loja.local/\n$ curl -sI http://outro.local/</pre></div><p style="margin-top:8px">O Docker roteia; o host resolve. Só com os dois a loja abre pelo nome — e um domínio que ninguém roteou continua caindo em 404.</p>',
        check: (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const tf = D.doProjeto(ctx, 'prod', 'traefik');
          const site = D.doProjeto(ctx, 'prod', 'site');
          let hosts = '';
          try { hosts = m.fs.readFile('/etc/hosts', { ctx: m.ctxRoot() }); } catch (e) { }
          const sock = tf ? (tf.montagens || []).find(mo => /docker\.sock$/.test(mo.destino)) : null;
          const certo = D.http(ctx, 'loja.local', 80, '/');
          const errado = D.http(ctx, 'localhost', 80, '/', { Host: 'outro.local' });
          return H.checkAll([
            [() => !!tf && tf.rodando, 'O serviço <code>traefik</code> não está no ar.'],
            [() => !!site && site.rodando, 'O serviço <code>site</code> não está no ar.'],
            [() => !!tf && D.publicada(ctx, tf.nome, 80), 'O <code>traefik</code> precisa publicar a porta 80.'],
            [() => !!site && (site.portas || []).length === 0, 'O <code>site</code> não deve publicar porta — quem recebe é o proxy.'],
            [() => !!sock && sock.ro, 'Monte o socket do Docker somente leitura (<code>:ro</code>) no Traefik.'],
            [() => /loja\.local/.test(hosts), 'Falta a linha em <code>/etc/hosts</code> resolvendo <code>loja.local</code> para <code>127.0.0.1</code>.'],
            [() => !!certo && certo.status === 200, () => 'Uma requisição a <code>http://loja.local/</code> respondeu <code>' + (certo ? certo.status : 'nada') + '</code> em vez de 200. Confira o roteamento e o <code>/etc/hosts</code>.'],
            [() => !!errado && errado.status === 404, 'Um host desconhecido deveria receber 404 — confira a regra <code>Host()</code> do router.']
          ]);
        }
      }
    ]
  });

  /* ============================== 26.3 ============================== */
  LX.lesson('m26', {
    id: 'lm26-3', n: '26.3', title: 'A rotina que salva a operação',
    goal: 'Fechar o ambiente com a peça que a operação depende: um script no host que faz backup do banco em container — e a prova de que ele restaura.',
    setup: (m) => {
      if (!m.docker) return;
      const c = D.montar(m, {
        nome: 'loja-db', imagem: 'mariadb:11.4',
        env: { MARIADB_ROOT_PASSWORD: 'SENHA_DO_BANCO', MARIADB_DATABASE: 'loja' }
      });
      if (c && c.banco) {
        c.banco.executarLote(
          'CREATE TABLE clientes (id INT PRIMARY KEY AUTO_INCREMENT, nome VARCHAR(50));' +
          "INSERT INTO clientes (nome) VALUES ('Ana'), ('Bruno'), ('Carla'), ('Diego');");
        if (c.banco._persistir) c.banco._persistir();
      }
    },
    body: [
      { h2: 'O host cuida do banco do container' },
      { p: 'A loja está no ar, o banco tem clientes, e falta a peça que separa um serviço amador de um profissional: o <strong>backup</strong>. Ele é o encontro final das duas trilhas — um <strong>script do host</strong> (Linux) que chama o <strong>dump do banco</strong> (Docker) e guarda o resultado no disco da máquina, fora do container que ele protege.' },
      {
        box: 'note', label: 'Chamado #8180 — rotina de backup da loja', body: [
          { ul: [
            'Um script no host, <code>~/backup.sh</code>, que gera um dump do banco <code>loja</code> e o guarda em <code>~/backups/</code>.',
            'A garantia que importa: o backup precisa <strong>restaurar</strong>. Um dump que nunca foi restaurado é uma esperança, não uma rotina.'
          ] }
        ]
      },
      {
        code: [
          '#!/bin/bash',
          'set -e',
          'mkdir -p ~/backups',
          'docker exec loja-db mariadb-dump -uroot -pSENHA_DO_BANCO loja > ~/backups/loja.sql'
        ], run: false, lang: 'bash'
      },
      {
        box: 'key', label: 'Script no host, dump do container', body: [
          { p: 'O script é um arquivo de shell comum, do Linux — o mesmo tipo que você escreveu no projeto final de Linux. O que ele faz é cruzar a fronteira: <code>docker exec loja-db mariadb-dump ...</code> roda o dump <em>dentro</em> do container, e o <code>&gt; ~/backups/loja.sql</code> é do shell do <em>host</em>, então o arquivo cai no disco da máquina. Um script assim é o que um <code>cron</code> ou um <code>timer</code> do systemd dispara todo dia.' }
        ]
      },
      {
        box: 'warn', label: 'Restaurar é a única prova', body: [
          { p: 'A restauração é o caminho inverso, e o <code>-i</code> do <code>docker exec</code> é obrigatório para o arquivo entrar: <code>docker exec -i loja-db mariadb -uroot -pSENHA_DO_BANCO loja &lt; ~/backups/loja.sql</code>. Testá-la — apagar algo e trazer de volta — é a única forma de saber que o dump presta. Descobrir que o backup estava quebrado no dia do incidente é o pior desfecho possível.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tm26-3-a', kind: 'guiado', title: 'O ciclo completo, à mão',
        body: [
          { p: 'Antes de escrever o script, faça o ciclo uma vez, na mão, para ver cada peça:' },
          { code: [
            '$ mkdir -p ~/backups',
            '$ docker exec loja-db mariadb-dump -uroot -pSENHA_DO_BANCO loja > ~/backups/loja.sql',
            '$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO loja -e "DROP TABLE clientes;"',
            '$ docker exec -i loja-db mariadb -uroot -pSENHA_DO_BANCO loja < ~/backups/loja.sql',
            '$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM clientes;"'
          ] },
          { p: 'Você guardou o dump no host, apagou a tabela (o "acidente") e a trouxe de volta pelo arquivo. O <code>SELECT</code> final mostra os clientes de novo — a prova de que o backup funciona.' }
        ],
        hints: ['O <code>mariadb-dump ... &gt; arquivo</code> guarda; o <code>mariadb ... &lt; arquivo</code> (com <code>docker exec -i</code>) restaura.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /mariadb-dump/), 'Gere um dump com <code>docker exec loja-db mariadb-dump ... &gt; ~/backups/loja.sql</code>.']
        ])
      },
      {
        id: 'tm26-3-q', kind: 'quiz', title: 'Onde o script mora',
        body: [{ p: 'A rotina de backup é um script de shell no host que chama <code>docker exec ... mariadb-dump</code>. Por que faz sentido o script viver no host, e não dentro do container do banco?' }],
        options: [
          { text: 'O backup precisa sobreviver e ficar fora do que ele protege: um script no host é disparado por cron/timer da máquina, grava o dump no disco do host e continua existindo mesmo que o container seja recriado ou removido. Dentro do container, sumiria com ele.', correct: true },
          { text: 'Containers não conseguem rodar <code>mariadb-dump</code>.', why: 'A imagem do MariaDB tem o <code>mariadb-dump</code>. O ponto não é a capacidade, é o <em>lugar</em>: a rotina e o arquivo precisam persistir fora do container.' },
          { text: 'O <code>docker exec</code> só pode ser chamado de dentro de outro container.', why: 'O <code>docker exec</code> é chamado do host — é assim que você opera os containers. O script no host é justamente quem o chama.' },
          { text: 'Scripts de shell não funcionam dentro de containers.', why: 'Funcionam. A razão de o script morar no host é persistência e agendamento: ele guarda o dump no disco do host e é disparado pela máquina, sobrevivendo ao ciclo de vida do container.' }
        ],
        hints: ['Pense no que acontece com um arquivo guardado dentro de um container quando ele é recriado.'],
        explain: 'A rotina e o arquivo de backup precisam persistir independentemente do container. Um script no host é disparado pelo agendador da máquina (cron/timer), roda o dump via <code>docker exec</code> e grava o resultado no disco do host — sobrevivendo à recriação ou remoção do container. Guardado dentro do container, o backup morreria junto com aquilo que deveria proteger.'
      },
      {
        id: 'tm26-3-b', kind: 'desafio', title: 'A rotina de backup, com prova de restauração',
        body: [
          { p: 'Entregue o chamado #8180:' },
          { ul: [
            'crie o script <code>~/backup.sh</code> que gera um dump do banco <code>loja</code> (do container <code>loja-db</code>) e o guarda em <code>~/backups/loja.sql</code>;',
            'execute o script para produzir o backup;',
            'prove que ele restaura: apague a tabela <code>clientes</code> e traga-a de volta a partir de <code>~/backups/loja.sql</code>.'
          ] },
          { p: 'Ao final: o script <code>~/backup.sh</code> existe; o arquivo <code>~/backups/loja.sql</code> existe com os dados; e a tabela <code>clientes</code> está de volta no banco, com os quatro clientes originais.' }
        ],
        hints: [
          'O script é um <code>#!/bin/bash</code> com <code>docker exec loja-db mariadb-dump -uroot -pSENHA_DO_BANCO loja &gt; ~/backups/loja.sql</code>. Torne-o executável com <code>chmod +x</code> e rode-o.',
          'A prova: <code>docker exec loja-db mariadb ... -e "DROP TABLE clientes;"</code> e depois <code>docker exec -i loja-db mariadb ... loja &lt; ~/backups/loja.sql</code>.'
        ],
        solution: '<div class="code"><pre>$ cat &gt; ~/backup.sh &lt;&lt;\'EOF\'\n#!/bin/bash\nset -e\nmkdir -p ~/backups\ndocker exec loja-db mariadb-dump -uroot -pSENHA_DO_BANCO loja &gt; ~/backups/loja.sql\necho "backup gerado em ~/backups/loja.sql"\nEOF\n$ chmod +x ~/backup.sh\n$ ~/backup.sh\n$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO loja -e "DROP TABLE clientes;"\n$ docker exec -i loja-db mariadb -uroot -pSENHA_DO_BANCO loja &lt; ~/backups/loja.sql\n$ docker exec loja-db mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM clientes;"</pre></div><p style="margin-top:8px">O script (Linux) chama o dump (Docker) e guarda no host; o teste de restauração fecha a garantia. É esse o par que um cron dispara toda noite — e que você confia porque já viu restaurar.</p>',
        check: (ctx) => {
          const script = H.read(ctx, '/home/aluno/backup.sh') || '';
          const dump = H.read(ctx, '/home/aluno/backups/loja.sql');
          const c = D.container(ctx, 'loja-db');
          const t = (c && c.banco && c.rodando && c.banco.bancos.get('loja')) ? c.banco.bancos.get('loja').tabelas.get('clientes') : null;
          const nomes = t ? (t.linhas || []).map(r => String(r.nome)) : [];
          return H.checkAll([
            [() => /mariadb-dump/.test(script), 'O script <code>~/backup.sh</code> ainda não gera o dump (falta um <code>docker exec loja-db mariadb-dump ...</code>).'],
            [() => dump !== null && String(dump).length > 0, 'Não encontrei o backup em <code>~/backups/loja.sql</code>. Rode o script para gerá-lo.'],
            [() => /INSERT INTO/.test(String(dump || '')), 'O arquivo <code>~/backups/loja.sql</code> não parece ter dados (nenhum <code>INSERT</code>). Gere-o com o banco populado.'],
            [() => !!t, 'A tabela <code>clientes</code> não está no banco. Restaure-a a partir de <code>~/backups/loja.sql</code>.'],
            [() => (t.linhas || []).length >= 4 && ['Ana', 'Bruno', 'Carla', 'Diego'].every(n => nomes.includes(n)),
              () => 'A tabela <code>clientes</code> voltou com ' + ((t && t.linhas ? t.linhas.length : 0)) + ' linha(s); deveriam ser os 4 clientes originais.']
          ]);
        }
      }
    ]
  });
})();
