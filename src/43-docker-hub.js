/* =========================================================================
   TERMINALIS — catálogo de imagens (o "Docker Hub" deste ambiente)
   Cada imagem traz camadas, configuração e um sistema de arquivos real.
   Quando o container sobe, `aoIniciar` abre portas, escreve logs e liga o
   que a imagem promete servir.
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, defimage, camada } = LX;

  /* Atalhos para escrever no sistema de arquivos do container */
  function ferramentas(cm) {
    const ctx = cm.ctxRoot();
    return {
      ctx,
      D: (p, mode = 0o755, uid = 0, gid = 0) => { const n = cm.fs.mkdirp(p, { ctx }); n.mode = mode; n.uid = uid; n.gid = gid; return n; },
      F: (p, c, mode = 0o644, uid = 0, gid = 0) => {
        cm.fs.mkdirp(FileSystem.dirname(p), { ctx });
        const n = cm.fs.writeFile(p, c, { ctx }); n.mode = mode; n.uid = uid; n.gid = gid; return n;
      }
    };
  }

  /* Toda imagem começa enxuta: nada de systemd, ssh, cron ou ferramentas
     de administração de máquina. Um container não é um servidor. */
  const FORA_DE_TODA_IMAGEM = [
    'systemctl', 'journalctl', 'systemd-analyze', 'timedatectl', 'hostnamectl', 'loginctl',
    'ufw', 'iptables', 'crontab', 'cron', 'logrotate', 'ssh', 'sshd', 'scp', 'sftp', 'rsync',
    'ssh-keygen', 'ssh-copy-id', 'ssh-add', 'sudo', 'su', 'passwd', 'useradd', 'usermod',
    'userdel', 'groupadd', 'groupdel', 'gpasswd', 'chage', 'adduser', 'deluser', 'addgroup',
    'mount', 'umount', 'fdisk', 'parted', 'mkfs', 'mkfs.ext4', 'lsblk', 'blkid', 'fsck',
    'e2label', 'tune2fs', 'swapon', 'swapoff', 'dmesg', 'lsof', 'strace', 'systemd-run',
    'docker', 'nmcli', 'netplan', 'iotop', 'vmstat', 'sar', 'ncdu', 'htop', 'lscpu', 'dmidecode'
  ];
  function enxugar(cm, extras = []) {
    LX.removerBin(cm, FORA_DE_TODA_IMAGEM.concat(extras));
  }

  /* Perfil Alpine: sem bash, sem curl, sem as ferramentas GNU. É por isso
     que `docker exec -it alp bash` falha — e o aluno precisa ver isso. */
  function alpine(cm) {
    const { F, D } = ferramentas(cm);
    enxugar(cm, ['bash', 'curl', 'apt', 'apt-get', 'apt-cache', 'dpkg', 'nano', 'vim',
      'dig', 'nslookup', 'host', 'traceroute', 'jq', 'tree', 'less', 'man', 'apt-key', 'add-apt-repository']);
    LX.instalarBin(cm, ['apk', 'wget']);
    F('/etc/alpine-release', '3.21.3\n');
    F('/etc/os-release',
      'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.21.3\nPRETTY_NAME="Alpine Linux v3.21"\n' +
      'HOME_URL="https://alpinelinux.org/"\nBUG_REPORT_URL="https://gitlab.alpinelinux.org/alpine/aports/-/issues"\n');
    F('/etc/passwd',
      'root:x:0:0:root:/root:/bin/sh\nbin:x:1:1:bin:/bin:/sbin/nologin\ndaemon:x:2:2:daemon:/sbin:/sbin/nologin\n' +
      'nobody:x:65534:65534:nobody:/:/sbin/nologin\n');
    F('/etc/group', 'root:x:0:\nbin:x:1:\ndaemon:x:2:\nnobody:x:65534:\n');
    F('/etc/apk/repositories', 'https://dl-cdn.alpinelinux.org/alpine/v3.21/main\nhttps://dl-cdn.alpinelinux.org/alpine/v3.21/community\n');
    D('/root', 0o700);
    cm.mem = Object.assign({}, cm.mem);
    /* /bin/sh no Alpine é o busybox ash, não o dash */
    F('/bin/busybox', '\x7fELF busybox\n', 0o755);
  }

  function debian(cm, nome, versao, id) {
    const { F, D } = ferramentas(cm);
    enxugar(cm);
    F('/etc/os-release',
      `PRETTY_NAME="${nome}"\nNAME="${id === 'ubuntu' ? 'Ubuntu' : 'Debian GNU/Linux'}"\nVERSION_ID="${versao}"\n` +
      `VERSION="${nome}"\nID=${id}\nHOME_URL="https://www.${id === 'ubuntu' ? 'ubuntu.com' : 'debian.org'}/"\n`);
    F('/etc/debian_version', id === 'ubuntu' ? 'trixie/sid\n' : versao + '\n');
    F('/etc/passwd',
      'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n' +
      'bin:x:2:2:bin:/bin:/usr/sbin/nologin\nsys:x:3:3:sys:/dev:/usr/sbin/nologin\n' +
      'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\n');
    F('/etc/group', 'root:x:0:\ndaemon:x:1:\nbin:x:2:\nsys:x:3:\nwww-data:x:33:\nnobody:x:65534:\n');
    D('/root', 0o700);
  }

  /* Camadas reutilizáveis: imagens da mesma base compartilham o mesmo id */
  const L = {
    alpine: () => camada('alpine-3.21', 3_640_000, '/bin/sh -c #(nop) ADD file:37a4bfa6b2b2ad2 in / '),
    debian: () => camada('debian-trixie', 74_800_000, '/bin/sh -c #(nop) ADD file:c1e7c2b0c8b1d4a in / '),
    ubuntu: () => camada('ubuntu-24.04', 78_100_000, '/bin/sh -c #(nop) ADD file:9b1e8a4c2f77b3e in / ')
  };

  /* =====================================================================
     hello-world — a primeira imagem de todo mundo
     ===================================================================== */
  const MSG_HELLO =
    `\nHello from Docker!\nThis message shows that your installation appears to be working correctly.\n\n` +
    `To generate this message, Docker took the following steps:\n` +
    ` 1. The Docker client contacted the Docker daemon.\n` +
    ` 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.\n    (amd64)\n` +
    ` 3. The Docker daemon created a new container from that image which runs the\n` +
    `    executable that produces the output you are currently reading.\n` +
    ` 4. The Docker daemon streamed that output to the Docker client, which sent it\n` +
    `    to your terminal.\n\n` +
    `To try something more ambitious, you can run an Ubuntu container with:\n $ docker run -it ubuntu bash\n\n` +
    `Share images, automate workflows, and more with a free Docker ID:\n https://hub.docker.com/\n\n` +
    `For more examples and ideas, visit:\n https://docs.docker.com/get-started/\n\n`;

  defimage({
    tags: ['hello-world:latest'], diasAtras: 120, encerraSozinha: true,
    camadas: [{ chave: 'hello-world', tamanho: 13_256, criadoPor: '/bin/sh -c #(nop) COPY file:201f8f1849e89d5 in / ' }],
    config: { Cmd: ['/hello'], Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'] },
    semear: (cm) => {
      const { F } = ferramentas(cm);
      /* imagem "scratch": tem UM arquivo e mais nada. Nem shell. */
      try { cm.fs.rmrf('/usr', { ctx: cm.ctxRoot() }); } catch (e) { }
      try { cm.fs.rmrf('/bin', { ctx: cm.ctxRoot() }); } catch (e) { }
      try { cm.fs.rmrf('/sbin', { ctx: cm.ctxRoot() }); } catch (e) { }
      try { cm.fs.rmrf('/etc', { ctx: cm.ctxRoot() }); } catch (e) { }
      F('/hello', '\x7fELF binário estático\n', 0o755);
    },
    aoIniciar: (c) => { c.registrar(MSG_HELLO); }
  });

  /* =====================================================================
     Bases
     ===================================================================== */
  defimage({
    tags: ['alpine:3.21', 'alpine:latest', 'alpine:3'], diasAtras: 30,
    camadas: [{ chave: 'alpine-3.21', tamanho: 3_640_000, criadoPor: '/bin/sh -c #(nop) ADD file:37a4bfa6b2b2ad2 in / ' }],
    config: { Cmd: ['/bin/sh'], Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'] },
    semear: alpine, encerraSozinha: true
  });
  defimage({
    tags: ['busybox:latest', 'busybox:1.37'], diasAtras: 40,
    camadas: [{ chave: 'busybox', tamanho: 4_270_000, criadoPor: '/bin/sh -c #(nop) ADD file:6ac4bdd2a4b9ff1 in / ' }],
    config: { Cmd: ['sh'], Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'] },
    semear: alpine, encerraSozinha: true
  });
  defimage({
    tags: ['ubuntu:24.04', 'ubuntu:latest', 'ubuntu:noble'], diasAtras: 21,
    camadas: [{ chave: 'ubuntu-24.04', tamanho: 78_100_000, criadoPor: '/bin/sh -c #(nop) ADD file:9b1e8a4c2f77b3e in / ' }],
    config: { Cmd: ['/bin/bash'], Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'] },
    semear: (cm) => debian(cm, 'Ubuntu 24.04.2 LTS', '24.04', 'ubuntu'), encerraSozinha: true
  });
  defimage({
    tags: ['debian:bookworm-slim', 'debian:stable-slim', 'debian:latest', 'debian:12'], diasAtras: 25,
    camadas: [{ chave: 'debian-trixie', tamanho: 74_800_000, criadoPor: '/bin/sh -c #(nop) ADD file:c1e7c2b0c8b1d4a in / ' }],
    config: { Cmd: ['bash'], Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'] },
    semear: (cm) => debian(cm, 'Debian GNU/Linux 12 (bookworm)', '12', 'debian'), encerraSozinha: true
  });

  /* =====================================================================
     NGINX
     ===================================================================== */
  const NGINX_CONF_IMG =
    `user  nginx;\nworker_processes  auto;\n\nerror_log  /var/log/nginx/error.log notice;\npid        /var/run/nginx.pid;\n\n` +
    `events {\n    worker_connections  1024;\n}\n\nhttp {\n    include       /etc/nginx/mime.types;\n` +
    `    default_type  application/octet-stream;\n\n    sendfile        on;\n    keepalive_timeout  65;\n\n` +
    `    include /etc/nginx/conf.d/*.conf;\n}\n`;
  const NGINX_DEFAULT_CONF =
    `server {\n    listen       80;\n    server_name  localhost;\n\n    location / {\n` +
    `        root   /usr/share/nginx/html;\n        index  index.html index.htm;\n    }\n\n` +
    `    error_page   500 502 503 504  /50x.html;\n    location = /50x.html {\n` +
    `        root   /usr/share/nginx/html;\n    }\n}\n`;
  const NGINX_INDEX =
    `<!DOCTYPE html>\n<html>\n<head>\n<title>Welcome to nginx!</title>\n<style>\nhtml { color-scheme: light dark; }\n` +
    `body { width: 35em; margin: 0 auto;\nfont-family: Tahoma, Verdana, Arial, sans-serif; }\n</style>\n</head>\n<body>\n` +
    `<h1>Welcome to nginx!</h1>\n<p>If you see this page, the nginx web server is successfully installed and\n` +
    `working. Further configuration is required.</p>\n\n<p>For online documentation and support please refer to\n` +
    `<a href="http://nginx.org/">nginx.org</a>.<br/>\nCommercial support is available at\n` +
    `<a href="http://nginx.com/">nginx.com</a>.</p>\n\n<p><em>Thank you for using nginx.</em></p>\n</body>\n</html>\n`;

  function semearNginx(cm, alpineBase) {
    if (alpineBase) alpine(cm); else debian(cm, 'Debian GNU/Linux 12 (bookworm)', '12', 'debian');
    const { F, D } = ferramentas(cm);
    LX.instalarBin(cm, ['nginx']);
    D('/etc/nginx'); D('/etc/nginx/conf.d'); D('/usr/share/nginx/html'); D('/var/log/nginx');
    F('/etc/nginx/nginx.conf', NGINX_CONF_IMG);
    F('/etc/nginx/conf.d/default.conf', NGINX_DEFAULT_CONF);
    F('/etc/nginx/mime.types', 'types {\n    text/html                    html htm;\n    text/css                     css;\n    application/javascript       js;\n    application/json             json;\n    image/png                    png;\n    image/svg+xml                svg;\n}\n');
    F('/usr/share/nginx/html/index.html', NGINX_INDEX);
    F('/usr/share/nginx/html/50x.html', '<html>\n<head><title>Error</title></head>\n<body>\n<h1>An error occurred.</h1>\n</body>\n</html>\n');
    F('/var/log/nginx/access.log', '');
    F('/var/log/nginx/error.log', '');
    F('/docker-entrypoint.sh', '#!/bin/sh\nset -e\nexec "$@"\n', 0o755);
    /* usuário nginx existe na imagem: é o dono dos processos worker */
    let passwd = '';
    try { passwd = cm.fs.readFile('/etc/passwd', { ctx: cm.ctxRoot() }); } catch (e) { }
    if (!/^nginx:/m.test(passwd)) F('/etc/passwd', passwd + 'nginx:x:101:101:nginx:/nonexistent:/sbin/nologin\n');
    let grupo = '';
    try { grupo = cm.fs.readFile('/etc/group', { ctx: cm.ctxRoot() }); } catch (e) { }
    if (!/^nginx:/m.test(grupo)) F('/etc/group', grupo + 'nginx:x:101:\n');
  }

  /* Serve arquivos de verdade a partir da raiz configurada no conf.d */
  function servidorNginx(c) {
    return (caminho, metodo) => {
      const cm = c.maquina, ctx = cm.ctxRoot();
      let raiz = '/usr/share/nginx/html';
      let indexes = ['index.html', 'index.htm'];
      let proxyPara = null;
      try {
        let conf = '';
        for (const arq of (cm.fs.readdir('/etc/nginx/conf.d', { ctx }) || [])) {
          const nome = typeof arq === 'string' ? arq : arq.name;
          if (!/\.conf$/.test(nome)) continue;
          conf += cm.fs.readFile('/etc/nginx/conf.d/' + nome, { ctx }) + '\n';
        }
        const mr = /^\s*root\s+([^;]+);/m.exec(conf);
        if (mr) raiz = mr[1].trim();
        const mi = /^\s*index\s+([^;]+);/m.exec(conf);
        if (mi) indexes = mi[1].trim().split(/\s+/);
        const mp = /proxy_pass\s+https?:\/\/([^;\/]+)/.exec(conf);
        if (mp) proxyPara = mp[1];
      } catch (e) { }

      const registrarAcesso = (status, tam) => {
        const linha = `172.17.0.1 - - [${new Date().toUTCString()}] "${metodo || 'GET'} ${caminho} HTTP/1.1" ${status} ${tam} "-" "curl/8.14.1" "-"`;
        c.registrar(linha, 'stdout');
        try { cm.fs.appendFile('/var/log/nginx/access.log', linha + '\n', { ctx }); } catch (e) { }
      };

      /* proxy_pass para outro container, quando configurado */
      if (proxyPara && caminho !== '/favicon.ico') {
        const eng = cm._host && cm._host.docker;
        const [alvoHost, alvoPorta] = proxyPara.split(':');
        if (eng) {
          try {
            const conn = eng.connectFrom(c, alvoHost, +(alvoPorta || 80));
            if (conn && conn.listener && conn.listener.http) {
              const r = conn.listener.http(caminho, metodo);
              registrarAcesso(r.status, (r.body || '').length);
              return Object.assign({ server: 'nginx/1.27.4' }, r);
            }
          } catch (e) {
            registrarAcesso(502, 157);
            c.registrar(`${new Date().toUTCString()} [error] 29#29: *1 connect() failed (111: Connection refused) while connecting to upstream, client: 172.17.0.1, server: localhost, request: "${metodo || 'GET'} ${caminho} HTTP/1.1", upstream: "http://${proxyPara}${caminho}"`, 'stderr');
            return { status: 502, type: 'text/html', body: '<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body>\r\n<center><h1>502 Bad Gateway</h1></center>\r\n<hr><center>nginx/1.27.4</center>\r\n</body>\r\n</html>\r\n', server: 'nginx/1.27.4' };
          }
        }
      }

      const candidatos = caminho.endsWith('/')
        ? indexes.map(i => raiz + caminho + i)
        : [raiz + caminho].concat(indexes.map(i => raiz + caminho + '/' + i));
      for (const p of candidatos) {
        try {
          const st = cm.fs.stat(p, { ctx });
          if (st.type !== 'file') continue;
          const body = cm.fs.readFile(p, { ctx });
          registrarAcesso(200, body.length);
          const ext = p.split('.').pop();
          const tipo = { html: 'text/html', htm: 'text/html', css: 'text/css', js: 'application/javascript', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', txt: 'text/plain' }[ext] || 'application/octet-stream';
          return { status: 200, type: tipo, body, server: 'nginx/1.27.4' };
        } catch (e) { }
      }
      registrarAcesso(404, 153);
      c.registrar(`${new Date().toUTCString()} [error] 29#29: *1 open() "${raiz}${caminho}" failed (2: No such file or directory), client: 172.17.0.1, server: localhost, request: "${metodo || 'GET'} ${caminho} HTTP/1.1"`, 'stderr');
      return { status: 404, type: 'text/html', body: '<html>\r\n<head><title>404 Not Found</title></head>\r\n<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx/1.27.4</center>\r\n</body>\r\n</html>\r\n', server: 'nginx/1.27.4' };
    };
  }

  function iniciarNginx(c, eng) {
    const erro = LX.validarNginx(c.maquina, '/etc/nginx/nginx.conf');
    if (erro) {
      c.registrar(`nginx: [emerg] ${erro}`, 'stderr');
      eng._encerrar(c, 1);
      return;
    }
    /* a porta que o nginx escuta vem do listen do conf, não é fixa */
    let porta = 80;
    try {
      let conf = '';
      for (const arq of (c.maquina.fs.readdir('/etc/nginx/conf.d', { ctx: c.maquina.ctxRoot() }) || [])) {
        const nome = typeof arq === 'string' ? arq : arq.name;
        if (/\.conf$/.test(nome)) conf += c.maquina.fs.readFile('/etc/nginx/conf.d/' + nome, { ctx: c.maquina.ctxRoot() }) + '\n';
      }
      const m = /^\s*listen\s+(\d+)/m.exec(conf);
      if (m) porta = +m[1];
    } catch (e) { }
    eng.escutar(c, porta, { processo: 'nginx', http: servidorNginx(c) });
    c.perfilCarga = { cpu: 0.15, mem: 9 * 1024 * 1024 };
    const cm = c.maquina;
    for (let i = 0; i < 2; i++) {
      cm.processes.set(20 + i, new LX.Process({ pid: 20 + i, ppid: 1, cmd: 'nginx: worker process', comm: 'nginx', user: 'nginx', uid: 101, cpu: 0, mem: 0.2, rss: 6200 }));
    }
    const d = new Date().toUTCString();
    c.registrar(`/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration`, 'stdout');
    c.registrar(`/docker-entrypoint.sh: Configuration complete; ready for start up`, 'stdout');
    c.registrar(`${d} [notice] 1#1: using the "epoll" event method`, 'stderr');
    c.registrar(`${d} [notice] 1#1: nginx/1.27.4`, 'stderr');
    c.registrar(`${d} [notice] 1#1: OS: Linux 6.14.0-27-generic`, 'stderr');
    c.registrar(`${d} [notice] 1#1: start worker processes`, 'stderr');
  }

  for (const [tags, alp, tam] of [
    [['nginx:1.28-alpine'], true, 48_500_000],
    [['nginx:1.27-alpine', 'nginx:alpine', 'nginx:stable-alpine'], true, 48_300_000],
    [['nginx:1.27', 'nginx:latest', 'nginx:stable'], false, 192_000_000]
  ]) {
    defimage({
      tags, diasAtras: 12,
      camadas: alp
        ? [{ chave: 'alpine-3.21', tamanho: 3_640_000, criadoPor: '/bin/sh -c #(nop) ADD file:37a4bfa6b2b2ad2 in / ' },
        { chave: 'nginx-alpine', tamanho: tam - 3_640_000, criadoPor: '/bin/sh -c apk add --no-cache nginx' }]
        : [{ chave: 'debian-trixie', tamanho: 74_800_000, criadoPor: '/bin/sh -c #(nop) ADD file:c1e7c2b0c8b1d4a in / ' },
        { chave: 'nginx-debian', tamanho: tam - 74_800_000, criadoPor: '/bin/sh -c apt-get update && apt-get install -y nginx' }],
      config: {
        Cmd: ['nginx', '-g', 'daemon off;'], Entrypoint: ['/docker-entrypoint.sh'],
        Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'NGINX_VERSION=1.27.4'],
        ExposedPorts: { '80/tcp': {} }, StopSignal: 'SIGQUIT'
      },
      semear: (cm) => semearNginx(cm, alp),
      aoIniciar: iniciarNginx
    });
  }

  /* =====================================================================
     traefik/whoami — o serviço de teste do próprio Traefik
     ===================================================================== */
  defimage({
    tags: ['traefik/whoami:v1.10', 'traefik/whoami:latest'], diasAtras: 60,
    camadas: [{ chave: 'whoami', tamanho: 6_940_000, criadoPor: '/bin/sh -c #(nop) COPY file:whoami in /' }],
    config: { Cmd: ['/whoami'], Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'], ExposedPorts: { '80/tcp': {} } },
    semear: (cm) => { alpine(cm); ferramentas(cm).F('/whoami', '\x7fELF whoami\n', 0o755); },
    aoIniciar: (c, eng) => {
      const porta = +(c.env.WHOAMI_PORT_NUMBER || 80);
      c.perfilCarga = { cpu: 0.05, mem: 4 * 1024 * 1024 };
      eng.escutar(c, porta, {
        processo: 'whoami',
        http: (caminho, metodo, pedido) => {
          if (caminho === '/health') return { status: 200, type: 'text/plain', body: 'OK\n' };
          const cab = (pedido && pedido.cabecalhos) || {};
          const host = cab['X-Forwarded-Host'] || cab.Host || cab.host || c.nome;
          const encaminhado = cab['X-Forwarded-For'];
          const corpo =
            `Hostname: ${c.hostname}\nIP: 127.0.0.1\nIP: ${c.ip}\nRemoteAddr: ${c.ip}:52344\n` +
            `GET ${caminho} ${(metodo || 'GET') === 'GET' ? 'HTTP/1.1' : 'HTTP/1.1'}\nHost: ${host}\n` +
            (encaminhado ? `X-Forwarded-For: ${encaminhado}\nX-Forwarded-Proto: ${cab['X-Forwarded-Proto'] || 'http'}\n` : '') +
            `User-Agent: curl/8.14.1\nAccept: */*\n`;
          c.registrar(`${c.ip} - - "GET ${caminho} HTTP/1.1" 200`, 'stdout');
          return { status: 200, type: 'text/plain', body: corpo };
        }
      });
      c.registrar('Starting up on port ' + porta);
    }
  });

  /* =====================================================================
     MARIADB
     ===================================================================== */
  defimage({
    tags: ['mariadb:11.4', 'mariadb:latest', 'mariadb:lts'], diasAtras: 18,
    camadas: [
      { chave: 'ubuntu-24.04', tamanho: 78_100_000, criadoPor: '/bin/sh -c #(nop) ADD file:9b1e8a4c2f77b3e in / ' },
      { chave: 'mariadb-server', tamanho: 328_000_000, criadoPor: '/bin/sh -c apt-get install -y mariadb-server' }
    ],
    config: {
      Cmd: ['mariadbd'], Entrypoint: ['docker-entrypoint.sh'],
      Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'MARIADB_VERSION=1:11.4.4+maria~ubu2404', 'GOSU_VERSION=1.17'],
      ExposedPorts: { '3306/tcp': {} }, Volumes: { '/var/lib/mysql': {} },
      Healthcheck: { Test: ['CMD-SHELL', 'mariadb-admin ping -h localhost || exit 1'], Interval: 10_000_000_000, Timeout: 5_000_000_000, Retries: 5, StartPeriod: 10_000_000_000 }
    },
    semear: (cm) => {
      debian(cm, 'Ubuntu 24.04.2 LTS', '24.04', 'ubuntu');
      const { F, D } = ferramentas(cm);
      LX.instalarBin(cm, ['mariadb', 'mysql', 'mariadb-dump', 'mysqldump', 'mariadb-admin', 'mysqladmin']);
      LX.instalarBin(cm, ['mariadbd']);
      D('/var/lib/mysql', 0o700, 999, 999);
      D('/docker-entrypoint-initdb.d');
      D('/etc/mysql/conf.d');
      F('/etc/mysql/my.cnf', '[mariadbd]\nskip-host-cache\nskip-name-resolve\nbind-address = 0.0.0.0\ndatadir = /var/lib/mysql\n\n!includedir /etc/mysql/conf.d/\n');
      F('/usr/local/bin/docker-entrypoint.sh', '#!/bin/bash\nset -eo pipefail\nexec "$@"\n', 0o755);
      let p = ''; try { p = cm.fs.readFile('/etc/passwd', { ctx: cm.ctxRoot() }); } catch (e) { }
      F('/etc/passwd', p + 'mysql:x:999:999::/var/lib/mysql:/bin/false\n');
    },
    aoIniciar: (c, eng) => {
      const senha = c.env.MARIADB_ROOT_PASSWORD || c.env.MYSQL_ROOT_PASSWORD;
      const vazia = c.env.MARIADB_ALLOW_EMPTY_ROOT_PASSWORD || c.env.MYSQL_ALLOW_EMPTY_PASSWORD;
      const aleatoria = c.env.MARIADB_RANDOM_ROOT_PASSWORD;
      /* Sem senha declarada o container morre na largada — é o erro que
         todo mundo encontra no primeiro `docker run mariadb`. */
      if (!senha && !vazia && !aleatoria) {
        c.registrar('2026-09-03  9:14:02+00:00 [ERROR] [Entrypoint]: Database is uninitialized and password option is not specified', 'stderr');
        c.registrar('\tYou need to specify one of MARIADB_ROOT_PASSWORD, MARIADB_ALLOW_EMPTY_ROOT_PASSWORD and MARIADB_RANDOM_ROOT_PASSWORD', 'stderr');
        eng._encerrar(c, 1);
        return;
      }
      const banco = new LX.Banco({ motor: 'mariadb' });
      c.banco = banco;
      c.perfilCarga = { cpu: 0.6, mem: 128 * 1024 * 1024 };

      if (c.env.MARIADB_DATABASE || c.env.MYSQL_DATABASE) {
        const nome = c.env.MARIADB_DATABASE || c.env.MYSQL_DATABASE;
        banco.criarBanco(nome);
        banco.usar(nome);
      }
      /* scripts em /docker-entrypoint-initdb.d rodam na primeira subida */
      const cm = c.maquina, ctx = cm.ctxRoot();
      if (!c.bancoIniciado) {
        try {
          const arqs = (cm.fs.readdir('/docker-entrypoint-initdb.d', { ctx }) || [])
            .map(x => typeof x === 'string' ? x : x.name).filter(n => /\.sql$/.test(n)).sort();
          for (const a of arqs) {
            c.registrar(`2026-09-03  9:14:05+00:00 [Note] [Entrypoint]: running /docker-entrypoint-initdb.d/${a}`);
            const r = banco.executarLote(cm.fs.readFile('/docker-entrypoint-initdb.d/' + a, { ctx }));
            if (r.erro) c.registrar(`ERROR ${r.erro}`, 'stderr');
          }
        } catch (e) { }
        c.bancoIniciado = true;
      }
      /* o estado do banco vive no volume: dump/restore atravessam reinícios */
      const persistir = () => {
        try {
          const dados = {};
          for (const [nome, d] of banco.bancos) {
            if (d.sistema) continue;
            dados[nome] = { tabelas: Array.from(d.tabelas.entries()).map(([n, t]) => [n, { colunas: t.colunas, linhas: t.linhas, chavePrimaria: t.chavePrimaria, proxId: t.proxId }]) };
          }
          cm.fs.writeFile('/var/lib/mysql/terminalis.json', JSON.stringify(dados), { ctx });
        } catch (e) { }
      };
      try {
        const bruto = cm.fs.readFile('/var/lib/mysql/terminalis.json', { ctx });
        const dados = JSON.parse(bruto);
        for (const nome in dados) {
          if (!banco.bancos.has(nome)) banco.bancos.set(nome, { nome, tabelas: new Map() });
          const d = banco.bancos.get(nome);
          for (const [n, t] of dados[nome].tabelas) d.tabelas.set(n, Object.assign({ nome: n }, t));
        }
      } catch (e) { }
      banco._persistir = persistir;
      persistir();

      const l = eng.escutar(c, 3306, { processo: 'mariadbd' });
      l.banco = banco;
      cm.processes.set(1, cm.processes.get(1));
      c.registrar(`2026-09-03  9:14:02+00:00 [Note] [Entrypoint]: Entrypoint script for MariaDB Server ${banco.versao} started.`);
      c.registrar(`2026-09-03  9:14:06 0 [Note] mariadbd: ready for connections.`);
      c.registrar(`Version: '${banco.versao}'  socket: '/run/mysqld/mysqld.sock'  port: 3306  mariadb.org binary distribution`);
    }
  });

  /* =====================================================================
     POSTGRESQL
     ===================================================================== */
  defimage({
    tags: ['postgres:17-alpine', 'postgres:alpine', 'postgres:17', 'postgres:latest'], diasAtras: 15,
    camadas: [
      { chave: 'alpine-3.21', tamanho: 3_640_000, criadoPor: '/bin/sh -c #(nop) ADD file:37a4bfa6b2b2ad2 in / ' },
      { chave: 'postgres-alpine', tamanho: 270_000_000, criadoPor: '/bin/sh -c apk add --no-cache postgresql17' }
    ],
    config: {
      Cmd: ['postgres'], Entrypoint: ['docker-entrypoint.sh'],
      Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'PG_VERSION=17.2', 'PGDATA=/var/lib/postgresql/data'],
      ExposedPorts: { '5432/tcp': {} }, Volumes: { '/var/lib/postgresql/data': {} }, User: '',
      Healthcheck: { Test: ['CMD-SHELL', 'pg_isready -U postgres'], Interval: 10_000_000_000, Timeout: 5_000_000_000, Retries: 5 }
    },
    semear: (cm) => {
      alpine(cm);
      const { F, D } = ferramentas(cm);
      LX.instalarBin(cm, ['psql', 'pg_dump', 'pg_isready', 'postgres']);
      D('/var/lib/postgresql/data', 0o700, 70, 70);
      D('/docker-entrypoint-initdb.d');
      F('/usr/local/bin/docker-entrypoint.sh', '#!/usr/bin/env bash\nset -Eeo pipefail\nexec "$@"\n', 0o755);
      let p = ''; try { p = cm.fs.readFile('/etc/passwd', { ctx: cm.ctxRoot() }); } catch (e) { }
      F('/etc/passwd', p + 'postgres:x:70:70::/var/lib/postgresql:/bin/sh\n');
    },
    aoIniciar: (c, eng) => {
      const senha = c.env.POSTGRES_PASSWORD;
      const confia = c.env.POSTGRES_HOST_AUTH_METHOD === 'trust';
      if (!senha && !confia) {
        c.registrar('Error: Database is uninitialized and superuser password is not specified.', 'stderr');
        c.registrar('       You must specify POSTGRES_PASSWORD to a non-empty value for the', 'stderr');
        c.registrar('       superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".', 'stderr');
        eng._encerrar(c, 1);
        return;
      }
      const banco = new LX.Banco({ motor: 'postgres' });
      c.banco = banco;
      c.perfilCarga = { cpu: 0.4, mem: 96 * 1024 * 1024 };
      const nome = c.env.POSTGRES_DB || c.env.POSTGRES_USER || 'postgres';
      if (!banco.bancos.has(nome)) banco.criarBanco(nome);
      banco.usar(nome);
      const cm = c.maquina, ctx = cm.ctxRoot();
      if (!c.bancoIniciado) {
        try {
          const arqs = (cm.fs.readdir('/docker-entrypoint-initdb.d', { ctx }) || [])
            .map(x => typeof x === 'string' ? x : x.name).filter(n => /\.sql$/.test(n)).sort();
          for (const a of arqs) {
            c.registrar(`/usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/${a}`);
            banco.executarLote(cm.fs.readFile('/docker-entrypoint-initdb.d/' + a, { ctx }));
          }
        } catch (e) { }
        c.bancoIniciado = true;
      }
      const l = eng.escutar(c, 5432, { processo: 'postgres' });
      l.banco = banco;
      c.registrar('PostgreSQL init process complete; ready for start up.');
      c.registrar('2026-09-03 09:14:07.221 UTC [1] LOG:  starting PostgreSQL 17.2 on x86_64-pc-linux-musl');
      c.registrar('2026-09-03 09:14:07.223 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432');
      c.registrar('2026-09-03 09:14:07.240 UTC [1] LOG:  database system is ready to accept connections');
    }
  });

  /* =====================================================================
     REDIS
     ===================================================================== */
  defimage({
    tags: ['redis:7-alpine', 'redis:alpine', 'redis:latest', 'redis:7'], diasAtras: 22,
    camadas: [
      { chave: 'alpine-3.21', tamanho: 3_640_000, criadoPor: '/bin/sh -c #(nop) ADD file:37a4bfa6b2b2ad2 in / ' },
      { chave: 'redis-alpine', tamanho: 37_000_000, criadoPor: '/bin/sh -c apk add --no-cache redis' }
    ],
    config: {
      Cmd: ['redis-server'], Entrypoint: ['docker-entrypoint.sh'],
      Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'REDIS_VERSION=7.4.1'],
      ExposedPorts: { '6379/tcp': {} }, Volumes: { '/data': {} }
    },
    semear: (cm) => {
      alpine(cm);
      const { F, D } = ferramentas(cm);
      LX.instalarBin(cm, ['redis-cli', 'redis-server']);
      D('/data');
      F('/usr/local/bin/docker-entrypoint.sh', '#!/bin/sh\nset -e\nexec "$@"\n', 0o755);
    },
    aoIniciar: (c, eng) => {
      c.redis = c.redis || new Map();
      c.perfilCarga = { cpu: 0.1, mem: 12 * 1024 * 1024 };
      eng.escutar(c, 6379, { processo: 'redis-server' });
      c.registrar('1:C 03 Sep 2026 09:14:02.101 * oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo');
      c.registrar('1:M 03 Sep 2026 09:14:02.103 * Running mode=standalone, port=6379.');
      c.registrar('1:M 03 Sep 2026 09:14:02.104 * Ready to accept connections tcp');
    }
  });

  /* =====================================================================
     NODE
     ===================================================================== */
  function semearNode(cm, alp) {
    if (alp) alpine(cm); else debian(cm, 'Debian GNU/Linux 12 (bookworm)', '12', 'debian');
    const { F, D } = ferramentas(cm);
    LX.instalarBin(cm, ['node', 'npm']);
    D('/app');
    let p = ''; try { p = cm.fs.readFile('/etc/passwd', { ctx: cm.ctxRoot() }); } catch (e) { }
    if (!/^node:/m.test(p)) F('/etc/passwd', p + 'node:x:1000:1000::/home/node:/bin/sh\n');
    let g = ''; try { g = cm.fs.readFile('/etc/group', { ctx: cm.ctxRoot() }); } catch (e) { }
    if (!/^node:/m.test(g)) F('/etc/group', g + 'node:x:1000:\n');
    D('/home/node', 0o755, 1000, 1000);
  }
  for (const [tags, alp, tam] of [
    [['node:22-alpine', 'node:alpine', 'node:lts-alpine'], true, 137_000_000],
    [['node:22', 'node:latest', 'node:lts'], false, 1_100_000_000]
  ]) {
    defimage({
      tags, diasAtras: 9,
      camadas: alp
        ? [{ chave: 'alpine-3.21', tamanho: 3_640_000, criadoPor: '/bin/sh -c #(nop) ADD file:37a4bfa6b2b2ad2 in / ' },
        { chave: 'node-alpine', tamanho: tam - 3_640_000, criadoPor: '/bin/sh -c apk add --no-cache nodejs npm' }]
        : [{ chave: 'debian-trixie', tamanho: 74_800_000, criadoPor: '/bin/sh -c #(nop) ADD file:c1e7c2b0c8b1d4a in / ' },
        { chave: 'node-debian', tamanho: tam - 74_800_000, criadoPor: '/bin/sh -c apt-get install -y nodejs' }],
      config: {
        Cmd: ['node'], Entrypoint: ['docker-entrypoint.sh'],
        Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'NODE_VERSION=22.14.0', 'YARN_VERSION=1.22.22']
      },
      semear: (cm) => {
        semearNode(cm, alp);
        ferramentas(cm).F('/usr/local/bin/docker-entrypoint.sh', '#!/bin/sh\nset -e\nexec "$@"\n', 0o755);
      },
      encerraSozinha: true
    });
  }

  /* =====================================================================
     PYTHON
     ===================================================================== */
  defimage({
    tags: ['python:3.13-slim', 'python:slim', 'python:3.13', 'python:latest'], diasAtras: 11,
    camadas: [
      { chave: 'debian-trixie', tamanho: 74_800_000, criadoPor: '/bin/sh -c #(nop) ADD file:c1e7c2b0c8b1d4a in / ' },
      { chave: 'python-slim', tamanho: 55_000_000, criadoPor: '/bin/sh -c apt-get install -y python3' }
    ],
    config: { Cmd: ['python3'], Env: ['PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin', 'PYTHON_VERSION=3.13.2'] },
    semear: (cm) => { debian(cm, 'Debian GNU/Linux 12 (bookworm)', '12', 'debian'); ferramentas(cm).D('/app'); },
    encerraSozinha: true
  });

  /* =====================================================================
     ADMINER — a ferramenta administrativa de banco das stacks
     ===================================================================== */
  defimage({
    tags: ['adminer:5', 'adminer:latest'], diasAtras: 45,
    camadas: [
      { chave: 'alpine-3.21', tamanho: 3_640_000, criadoPor: '/bin/sh -c #(nop) ADD file:37a4bfa6b2b2ad2 in / ' },
      { chave: 'adminer', tamanho: 92_000_000, criadoPor: '/bin/sh -c apk add --no-cache php83 php83-session' }
    ],
    config: {
      Cmd: ['php', '-S', '[::]:8080', '-t', '/var/www/html'], Entrypoint: ['entrypoint.sh'],
      Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'ADMINER_VERSION=5.0.6'],
      ExposedPorts: { '8080/tcp': {} }
    },
    semear: (cm) => {
      alpine(cm);
      const { F, D } = ferramentas(cm);
      D('/var/www/html');
      LX.instalarBin(cm, ['php']);
      F('/var/www/html/index.php', '<?php // Adminer 5.0.6\n');
      F('/usr/local/bin/entrypoint.sh', '#!/bin/sh\nset -e\nexec "$@"\n', 0o755);
    },
    aoIniciar: (c, eng) => {
      c.perfilCarga = { cpu: 0.08, mem: 22 * 1024 * 1024 };
      eng.escutar(c, 8080, {
        processo: 'php',
        http: (caminho) => {
          c.registrar(`[03-Sep-2026 09:20:11] ${c.ip}:41022 [200]: GET ${caminho}`);
          const servidor = c.env.ADMINER_DEFAULT_SERVER || 'db';
          return {
            status: 200, type: 'text/html',
            body: `<!DOCTYPE html>\n<html><head><title>Login - Adminer</title></head>\n<body>\n` +
              `<h1>Adminer 5.0.6</h1>\n<form action="" method="post">\n` +
              `<p>Sistema: MySQL/MariaDB</p>\n<p>Servidor: ${servidor}</p>\n` +
              `<p>Usuário: <input name="username"></p>\n<p>Senha: <input type="password" name="password"></p>\n` +
              `<p><input type="submit" value="Entrar"></p>\n</form>\n</body></html>\n`
          };
        }
      });
      c.registrar('PHP 8.3.16 Development Server (http://[::]:8080) started');
    }
  });

  /* =====================================================================
     REGISTRY privado
     ===================================================================== */
  defimage({
    tags: ['registry:2', 'registry:latest'], diasAtras: 90,
    camadas: [{ chave: 'registry', tamanho: 25_400_000, criadoPor: '/bin/sh -c #(nop) COPY file:registry in /bin/' }],
    config: {
      Cmd: ['/etc/docker/registry/config.yml'], Entrypoint: ['/entrypoint.sh'],
      Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'],
      ExposedPorts: { '5000/tcp': {} }, Volumes: { '/var/lib/registry': {} }
    },
    semear: (cm) => {
      alpine(cm);
      const { F, D } = ferramentas(cm);
      D('/var/lib/registry'); D('/etc/docker/registry');
      F('/etc/docker/registry/config.yml', 'version: 0.1\nstorage:\n  filesystem:\n    rootdirectory: /var/lib/registry\nhttp:\n  addr: :5000\n');
      F('/entrypoint.sh', '#!/bin/sh\nset -e\nexec registry serve "$@"\n', 0o755);
      LX.instalarBin(cm, ['registry']);
    },
    aoIniciar: (c, eng) => {
      c.registroPrivado = c.registroPrivado || new Map();
      c.perfilCarga = { cpu: 0.05, mem: 18 * 1024 * 1024 };
      eng.escutar(c, 5000, {
        processo: 'registry',
        http: (caminho) => {
          if (caminho === '/v2/' || caminho === '/v2') return { status: 200, type: 'application/json', body: '{}' };
          if (caminho === '/v2/_catalog') {
            return { status: 200, type: 'application/json', body: JSON.stringify({ repositories: Array.from(c.registroPrivado.keys()) }) + '\n' };
          }
          return { status: 404, type: 'application/json', body: '{"errors":[{"code":"NAME_UNKNOWN","message":"repository name not known to registry"}]}\n' };
        }
      });
      c.registrar('level=info msg="listening on [::]:5000" go.version=go1.20.8');
    }
  });

  /* =====================================================================
     TRAEFIK — o proxy reverso do curso
     A configuração estática vem do command/arquivo; a dinâmica vem das
     labels dos containers, exatamente como no provider Docker.
     ===================================================================== */
  defimage({
    tags: ['traefik:v3.7', 'traefik:v3', 'traefik:latest'], diasAtras: 8,
    camadas: [{ chave: 'traefik', tamanho: 189_000_000, criadoPor: '/bin/sh -c #(nop) COPY file:traefik in /' }],
    config: {
      Cmd: ['traefik'], Entrypoint: ['/entrypoint.sh'],
      Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'],
      ExposedPorts: { '80/tcp': {} }
    },
    semear: (cm) => {
      alpine(cm);
      const { F, D } = ferramentas(cm);
      LX.instalarBin(cm, ['traefik']);
      F('/entrypoint.sh', '#!/bin/sh\nset -e\nexec "$@"\n', 0o755);
      D('/etc/traefik'); D('/letsencrypt');
    },
    aoIniciar: (c, eng) => LX.iniciarTraefik(c, eng)
  });

  /* =====================================================================
     Imagens de aplicação usadas nos cenários de servidor.
     Vivem em um registro privado fictício; nada aqui usa credencial real.
     ===================================================================== */
  LX.defAppImage = function (spec) {
    defimage(Object.assign({
      camadas: [
        { chave: 'alpine-3.21', tamanho: 3_640_000, criadoPor: '/bin/sh -c #(nop) ADD file:37a4bfa6b2b2ad2 in / ' },
        { chave: 'node-alpine', tamanho: 133_360_000, criadoPor: '/bin/sh -c apk add --no-cache nodejs npm' },
        { chave: spec.chaveCamada || ('app-' + spec.tags[0]), tamanho: spec.tamanhoApp || 8_400_000, criadoPor: 'COPY . /app # buildkit' }
      ]
    }, spec));
  };
})();
