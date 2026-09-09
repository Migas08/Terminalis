/* =========================================================================
   TERMINALIS — o comando `docker`
   Cobre o CLI que o curso ensina, com as mensagens de erro reais do
   daemon. Cada subcomando age sobre o motor de verdade: não existe
   resposta pré-gravada aqui.
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, defcmd, getopt } = LX;
  const P = (sh, p) => FileSystem.normalize(p, sh.cwd);

  /* --------------------------- utilidades --------------------------- */
  function eng(sh) { return sh.m.docker; }

  /* O daemon só responde a quem está no grupo docker (ou é root). É a
     razão de "permission denied while trying to connect to the Docker
     daemon socket" ser o primeiro erro de quase todo mundo. */
  function podeFalarComDaemon(sh) {
    if (sh.uid === 0) return true;
    const g = sh.m.groups().find(x => x.name === 'docker');
    if (!g) return false;
    const u = sh.m.userByUid(sh.uid);
    return !!(u && (g.members.includes(u.name) || u.gid === g.gid));
  }
  function erroPermissao(io) {
    io.stderr.write(`permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: ` +
      `Get "http://%2Fvar%2Frun%2Fdocker.sock/v1.52/containers/json": dial unix /var/run/docker.sock: connect: permission denied\n`);
    return 1;
  }

  function tabela(io, cabecalhos, linhas) {
    if (!linhas.length) { io.stdout.write(cabecalhos.join('   ') + '\n'); return; }
    const larg = cabecalhos.map((c, i) => Math.max(c.length, ...linhas.map(l => String(l[i] === undefined ? '' : l[i]).length)));
    const fmt = (vals) => vals.map((v, i) => i === vals.length - 1 ? String(v) : String(v) + ' '.repeat(larg[i] - String(v).length)).join('   ');
    io.stdout.write(fmt(cabecalhos) + '\n');
    for (const l of linhas) io.stdout.write(fmt(l.map(v => v === undefined || v === null ? '' : v)) + '\n');
  }

  function humano(bytes) {
    if (bytes === 0) return '0B';
    const u = ['B', 'kB', 'MB', 'GB', 'TB'];
    let i = 0, v = bytes;
    while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
    return (v >= 100 || i === 0 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)) + u[i];
  }
  LX.dockerHumano = humano;

  function idade(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s} seconds ago`;
    const mi = Math.floor(s / 60); if (mi < 60) return `${mi} minute${mi === 1 ? '' : 's'} ago`;
    const h = Math.floor(mi / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
    const d = Math.floor(h / 24);
    if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`;
    if (d < 60) return `${Math.floor(d / 7)} weeks ago`;
    return `${Math.floor(d / 30)} months ago`;
  }

  /* Formatação --format com {{.Campo}} */
  function aplicarFormato(fmt, obj) {
    if (fmt === 'json' || fmt === '{{json .}}') return JSON.stringify(obj);
    return String(fmt).replace(/\{\{\s*\.([A-Za-z0-9_.]+)\s*\}\}/g, (_, campo) => {
      const partes = campo.split('.');
      let v = obj;
      for (const p of partes) v = (v === null || v === undefined) ? '' : v[p];
      return v === undefined || v === null ? '' : String(v);
    }).replace(/\\t/g, '\t').replace(/\\n/g, '\n');
  }

  /* ---------------------------------------------------------------------
     Análise dos argumentos de `docker run` / `docker create`
     --------------------------------------------------------------------- */
  const FLAGS_VALOR = new Set([
    '--name', '-p', '--publish', '-e', '--env', '--env-file', '-v', '--volume', '--mount',
    '--network', '--net', '--restart', '--cpus', '-m', '--memory', '--memory-reservation', '--memory-swap', '--cpu-shares',
    '--hostname', '-h', '--entrypoint', '-u', '--user', '-w', '--workdir', '--label', '-l',
    '--add-host', '--dns', '--tmpfs', '--health-cmd', '--health-interval', '--health-retries',
    '--health-start-period', '--health-timeout', '--stop-signal', '--pull', '--platform',
    '--cap-add', '--cap-drop', '--security-opt', '--pids-limit', '--log-driver', '--ulimit',
    '--network-alias', '--ip', '--device', '--volumes-from', '--link', '--expose', '--shm-size'
  ]);
  const FLAGS_BOOL = new Set([
    '-d', '--detach', '-i', '--interactive', '-t', '--tty', '--rm', '-P', '--publish-all',
    '--read-only', '--privileged', '--init', '--no-healthcheck', '-q', '--quiet', '--sig-proxy'
  ]);

  function analisarRun(args) {
    const spec = {
      env: {}, portas: [], montagens: [], labels: {}, redes: [], aliases: [],
      recursos: {}, capAdd: [], capDrop: [], securityOpt: [], expostas: {}, hosts: []
    };
    let i = 0, erro = null;
    const pega = (flag) => {
      const v = args[++i];
      if (v === undefined) { erro = `docker: flag needs an argument: '${flag}'`; return null; }
      return v;
    };
    for (; i < args.length; i++) {
      let a = args[i];
      if (!a.startsWith('-')) break;
      if (a === '--') { i++; break; }
      /* --flag=valor */
      let valorEmbutido = null;
      const eq = a.indexOf('=');
      if (a.startsWith('--') && eq > 0) { valorEmbutido = a.slice(eq + 1); a = a.slice(0, eq); }
      /* agrupamento de curtas: -it, -itd, -dp 8080:80 */
      if (/^-[a-zA-Z]{2,}$/.test(a) && !FLAGS_VALOR.has(a)) {
        let consumiu = false;
        for (let k = 1; k < a.length; k++) {
          const curta = '-' + a[k];
          if (FLAGS_VALOR.has(curta)) {
            const resto = a.slice(k + 1);
            const v = resto !== '' ? resto : args[++i];
            if (v === undefined) { erro = `docker: flag needs an argument: '${curta}'`; break; }
            aplicar(spec, curta, v, (e) => erro = e);
            consumiu = true;
            break;
          }
          if (!FLAGS_BOOL.has(curta)) { erro = `unknown shorthand flag: '${a[k]}' in ${a}`; break; }
          aplicar(spec, curta, true, (e) => erro = e);
        }
        if (erro) return { erro };
        continue;
      }
      if (FLAGS_VALOR.has(a)) {
        const v = valorEmbutido !== null ? valorEmbutido : pega(a);
        if (erro) return { erro };
        aplicar(spec, a, v, (e) => erro = e);
        if (erro) return { erro };
        continue;
      }
      if (FLAGS_BOOL.has(a)) { aplicar(spec, a, valorEmbutido === null ? true : valorEmbutido !== 'false', (e) => erro = e); continue; }
      return { erro: `unknown flag: ${a}` };
    }
    spec.imagem = args[i];
    spec.comando = args.slice(i + 1);
    if (!spec.imagem) return { erro: `docker: 'docker run' requires at least 1 argument.\nSee 'docker run --help'.\n\nUsage:  docker run [OPTIONS] IMAGE [COMMAND] [ARG...]\n\nCreate and run a new container from an image` };
    return { spec };
  }

  function aplicar(spec, flag, v, falhar) {
    switch (flag) {
      case '-d': case '--detach': spec.detach = true; break;
      case '-i': case '--interactive': spec.interativo = true; break;
      case '-t': case '--tty': spec.tty = true; break;
      case '--rm': spec.autoRemover = true; break;
      case '-P': case '--publish-all': spec.publicarTudo = true; break;
      case '--read-only': spec.somenteLeitura = true; break;
      case '--privileged': spec.privilegiado = true; break;
      case '--no-healthcheck': spec.saude = { Test: ['NONE'] }; break;
      case '--name': spec.nome = v; break;
      case '-p': case '--publish': {
        const p = analisarPorta(v);
        if (!p) return falhar(`docker: invalid publish opts format (should be [ip:[hostPort:]]containerPort[/protocol]): ${v}`);
        spec.portas.push(p);
        break;
      }
      case '--expose': {
        const [porta, proto] = String(v).split('/');
        spec.expostas[`${parseInt(porta, 10)}/${proto || 'tcp'}`] = {};
        break;
      }
      case '-e': case '--env': {
        const dp = String(v).indexOf('=');
        if (dp < 0) spec.env[v] = process_env_placeholder(v);
        else spec.env[String(v).slice(0, dp)] = String(v).slice(dp + 1);
        break;
      }
      case '--env-file': spec.envFiles = (spec.envFiles || []).concat([v]); break;
      case '-v': case '--volume': {
        const mo = analisarVolumeCurto(v);
        if (!mo) return falhar(`docker: invalid spec: ${v}: empty section between colons`);
        spec.montagens.push(mo);
        break;
      }
      case '--mount': {
        const mo = analisarMount(v);
        if (mo.erro) return falhar(`docker: ${mo.erro}`);
        spec.montagens.push(mo);
        break;
      }
      case '--tmpfs': spec.montagens.push({ tipo: 'tmpfs', destino: String(v).split(':')[0] }); break;
      case '--network': case '--net': spec.redes.push(v); break;
      case '--network-alias': spec.aliases.push(v); break;
      case '--restart': {
        const m = /^(no|always|unless-stopped|on-failure)(?::(\d+))?$/.exec(String(v));
        if (!m) return falhar(`docker: invalid restart policy: ${v}`);
        spec.restart = { politica: m[1], maxTentativas: m[2] ? +m[2] : 0 };
        break;
      }
      case '--cpus': spec.recursos.cpus = parseFloat(v); break;
      case '-m': case '--memory': spec.recursos.memoria = analisarBytes(v); break;
      case '--memory-reservation': spec.recursos.memoriaReserva = analisarBytes(v); break;
      case '--memory-swap': spec.recursos.memoriaSwap = analisarBytes(v); break;
      case '--cpu-shares': spec.recursos.cpuShares = parseInt(v, 10); break;
      case '--pids-limit': spec.recursos.pidsLimit = parseInt(v, 10); break;
      case '-h': case '--hostname': spec.hostname = v; break;
      case '--entrypoint': spec.entrypoint = String(v).trim() ? [String(v)] : []; break;
      case '-u': case '--user': spec.usuario = v; break;
      case '-w': case '--workdir': spec.workdir = v; break;
      case '-l': case '--label': {
        const dp = String(v).indexOf('=');
        if (dp < 0) spec.labels[v] = '';
        else spec.labels[String(v).slice(0, dp)] = String(v).slice(dp + 1);
        break;
      }
      case '--health-cmd': spec.saude = Object.assign({ Retries: 3 }, spec.saude, { Test: ['CMD-SHELL', v] }); break;
      case '--health-retries': spec.saude = Object.assign({}, spec.saude, { Retries: parseInt(v, 10) }); break;
      case '--health-interval': spec.saude = Object.assign({}, spec.saude, { IntervalTexto: v }); break;
      case '--stop-signal': spec.stopSignal = v; break;
      case '--pull': spec.pull = v; break;
      case '--cap-add': spec.capAdd.push(v); break;
      case '--cap-drop': spec.capDrop.push(v); break;
      case '--security-opt': spec.securityOpt.push(v); break;
      case '--add-host': spec.hosts.push(v); break;
      default: break;
    }
  }
  function process_env_placeholder(nome) { return ''; }

  function analisarPorta(v) {
    const s = String(v);
    const m = /^(?:(\d+\.\d+\.\d+\.\d+):)?(?:(\d+):)?(\d+)(?:\/(tcp|udp))?$/.exec(s);
    if (!m) return null;
    return { hostIp: m[1] || '0.0.0.0', hostPort: m[2] ? +m[2] : (m[3] ? null : null), contPort: +m[3], proto: m[4] || 'tcp' };
  }
  function analisarBytes(v) {
    const m = /^(\d+(?:\.\d+)?)\s*([bkmgKMGB]?)[bB]?$/.exec(String(v));
    if (!m) return null;
    const n = parseFloat(m[1]);
    const mult = { '': 1, b: 1, B: 1, k: 1024, K: 1024, m: 1024 ** 2, M: 1024 ** 2, g: 1024 ** 3, G: 1024 ** 3 }[m[2]] || 1;
    return Math.round(n * mult);
  }
  LX.dockerBytes = analisarBytes;

  /* -v tem três formas: só destino (volume anônimo), origem:destino e
     origem:destino:ro. Caminho que começa com / ou . é bind mount; o
     resto é nome de volume — a distinção que faz `-v config:/etc` criar
     um volume chamado "config" em vez de montar a pasta ./config. */
  function analisarVolumeCurto(v) {
    const partes = String(v).split(':');
    if (partes.some(p => p === '' )) return null;
    if (partes.length === 1) return { tipo: 'volume', nome: null, destino: partes[0], anonimo: true };
    const origem = partes[0], destino = partes[1];
    const ro = (partes[2] || '').split(',').includes('ro');
    if (/^[./~]/.test(origem)) return { tipo: 'bind', origem, destino, ro, criarSeFaltar: true };
    return { tipo: 'volume', nome: origem, destino, ro };
  }
  function analisarMount(v) {
    const o = {};
    for (const par of String(v).split(',')) {
      const dp = par.indexOf('=');
      if (dp < 0) { o[par.trim().toLowerCase()] = true; continue; }
      o[par.slice(0, dp).trim().toLowerCase()] = par.slice(dp + 1).trim();
    }
    const tipo = o.type || 'volume';
    const destino = o.destination || o.dst || o.target;
    if (!destino) return { erro: `invalid mount config: destination is required` };
    const ro = o.readonly !== undefined || o.ro !== undefined;
    if (tipo === 'bind') {
      if (!o.source && !o.src) return { erro: `invalid mount config for type "bind": field Source must not be empty` };
      /* --mount não cria o diretório de origem — diferente do -v */
      return { tipo: 'bind', origem: o.source || o.src, destino, ro, criarSeFaltar: o['bind-create-src'] !== undefined };
    }
    if (tipo === 'tmpfs') return { tipo: 'tmpfs', destino, tamanhoKb: o['tmpfs-size'] ? Math.round(analisarBytes(o['tmpfs-size']) / 1024) : undefined };
    return { tipo: 'volume', nome: o.source || o.src || null, destino, ro, anonimo: !(o.source || o.src) };
  }

  /* ---------------------------------------------------------------------
     Executar um comando dentro do container, com saída em tempo real
     --------------------------------------------------------------------- */
  function citar(a) {
    if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a)) return a;
    return "'" + String(a).replace(/'/g, `'\\''`) + "'";
  }
  const SHELLS = ['sh', 'bash', '/bin/sh', '/bin/bash', '/usr/bin/sh', '/usr/bin/bash', 'ash', '/bin/ash'];

  async function rodarNoContainer(e, c, argv, io, opts = {}) {
    const cm = c.maquina;
    const nomeShell = argv[0];
    /* sessão interativa: o shell do container assume o terminal */
    if (SHELLS.includes(nomeShell) && argv.length === 1 && opts.interativo && io.term && io.term.enterContainer) {
      if (!e._existeExecutavel(cm, nomeShell)) {
        io.stderr.write(`OCI runtime exec failed: exec failed: unable to start container process: exec: "${nomeShell}": executable file not found in $PATH: unknown\n`);
        return 126;
      }
      const sh = e.shellDe(c, opts);
      io.term.enterContainer(sh, c.nome);
      return 0;
    }
    if (!e._existeExecutavel(cm, nomeShell)) {
      io.stderr.write(`OCI runtime exec failed: exec failed: unable to start container process: exec: "${nomeShell}": executable file not found in $PATH: unknown\n`);
      return 126;
    }
    const sh = e.shellDe(c, opts);
    if (opts.env) for (const k in opts.env) sh.setVar(k, opts.env[k], true);
    const linha = argv.map(citar).join(' ');
    try { return await LX.rodarLinha(sh, io, linha); }
    catch (err) { io.stderr.write(String(err.message || err) + '\n'); return 1; }
  }

  /* Imprime as linhas de log de um container */
  function imprimirLogs(io, c, opts, prefixo) {
    let linhas = c.logs;
    if (opts.tail && opts.tail !== 'all') linhas = linhas.slice(-Math.max(0, parseInt(opts.tail, 10)));
    for (const l of linhas) {
      const ts = opts.timestamps ? new Date(l.ts).toISOString() + ' ' : '';
      const texto = (prefixo || '') + ts + l.texto + '\n';
      if (l.fluxo === 'stderr') io.stderr.write(texto); else io.stdout.write(texto);
    }
  }

  /* =====================================================================
     O comando
     ===================================================================== */
  defcmd({
    name: 'docker', pkg: 'docker-ce-cli',
    run: async ({ sh, io, args }) => {
      const e = eng(sh);
      if (!e) { io.stderr.write('docker: motor indisponível neste ambiente\n'); return 1; }
      const sub = args[0];
      if (!sub || sub === 'help' || sub === '--help' || sub === '-h') { return ajuda(io, args[1]); }
      if (sub === '--version' || sub === '-v') {
        io.stdout.write(`Docker version ${e.versao.cliente}, build 1a2b3c4\n`);
        return 0;
      }
      /* o daemon só responde a root ou ao grupo docker */
      const SEM_DAEMON = ['version', 'compose', 'context', 'buildx'];
      if (!SEM_DAEMON.includes(sub) && !podeFalarComDaemon(sh)) return erroPermissao(io);

      const resto = args.slice(1);
      switch (sub) {
        case 'version': return cmdVersion(sh, io, resto);
        case 'info': case 'system': return sub === 'info' ? cmdInfo(sh, io) : cmdSystem(sh, io, resto);
        case 'pull': return cmdPull(sh, io, resto);
        case 'push': return cmdPush(sh, io, resto);
        case 'login': return cmdLogin(sh, io, resto);
        case 'logout': { e.login = null; io.stdout.write('Removing login credentials for https://index.docker.io/v1/\n'); return 0; }
        case 'images': return cmdImages(sh, io, resto);
        case 'image': return await cmdImage(sh, io, resto);
        case 'rmi': return cmdRmi(sh, io, resto);
        case 'tag': return cmdTag(sh, io, resto);
        case 'history': return cmdHistory(sh, io, resto);
        case 'save': return cmdSave(sh, io, resto);
        case 'load': return cmdLoad(sh, io, resto);
        case 'build': return LX.cmdDockerBuild(sh, io, resto);
        case 'buildx': return resto[0] === 'build' ? LX.cmdDockerBuild(sh, io, resto.slice(1)) : cmdBuildx(sh, io, resto);
        case 'run': return cmdRun(sh, io, resto, true);
        case 'create': return cmdRun(sh, io, resto, false);
        case 'start': return cmdStart(sh, io, resto);
        case 'stop': return cmdStop(sh, io, resto, 'stop');
        case 'kill': return cmdStop(sh, io, resto, 'kill');
        case 'restart': return cmdRestart(sh, io, resto);
        case 'pause': return cmdPausa(sh, io, resto, true);
        case 'unpause': return cmdPausa(sh, io, resto, false);
        case 'rm': return cmdRm(sh, io, resto);
        case 'ps': return cmdPs(sh, io, resto);
        case 'logs': return cmdLogs(sh, io, resto);
        case 'inspect': return await cmdInspect(sh, io, resto);
        case 'exec': return cmdExec(sh, io, resto);
        case 'attach': return cmdAttach(sh, io, resto);
        case 'cp': return cmdCp(sh, io, resto);
        case 'rename': return cmdRename(sh, io, resto);
        case 'stats': return cmdStats(sh, io, resto);
        case 'top': return cmdTop(sh, io, resto);
        case 'diff': return cmdDiff(sh, io, resto);
        case 'port': return cmdPort(sh, io, resto);
        case 'events': return cmdEvents(sh, io, resto);
        case 'wait': return cmdWait(sh, io, resto);
        case 'container': return cmdContainer(sh, io, resto);
        case 'volume': return cmdVolume(sh, io, resto);
        case 'network': return cmdNetwork(sh, io, resto);
        case 'compose': return LX.cmdDockerCompose(sh, io, resto);
        case 'update': return cmdUpdate(sh, io, resto);
        default:
          io.stderr.write(`docker: unknown command: docker ${sub}\n\nRun 'docker --help' for more information\n`);
          return 125;
      }
    }
  });

  /* --------------------------------------------------------------- */
  function ajuda(io, topico) {
    io.stdout.write(
      `\nUsage:  docker [OPTIONS] COMMAND\n\nA self-sufficient runtime for containers\n\n` +
      `Common Commands:\n` +
      `  run         Create and run a new container from an image\n` +
      `  exec        Execute a command in a running container\n` +
      `  ps          List containers\n` +
      `  build       Build an image from a Dockerfile\n` +
      `  pull        Download an image from a registry\n` +
      `  push        Upload an image to a registry\n` +
      `  images      List images\n` +
      `  login       Authenticate to a registry\n` +
      `  logout      Log out from a registry\n` +
      `  version     Show the Docker version information\n` +
      `  info        Display system-wide information\n\n` +
      `Management Commands:\n` +
      `  compose     Docker Compose\n` +
      `  container   Manage containers\n` +
      `  image       Manage images\n` +
      `  network     Manage networks\n` +
      `  system      Manage Docker\n` +
      `  volume      Manage volumes\n\n` +
      `Commands:\n` +
      `  attach      Attach local standard input, output, and error streams to a running container\n` +
      `  cp          Copy files/folders between a container and the local filesystem\n` +
      `  diff        Inspect changes to files or directories on a container's filesystem\n` +
      `  events      Get real time events from the server\n` +
      `  history     Show the history of an image\n` +
      `  inspect     Return low-level information on Docker objects\n` +
      `  kill        Kill one or more running containers\n` +
      `  load        Load an image from a tar archive or STDIN\n` +
      `  logs        Fetch the logs of a container\n` +
      `  pause       Pause all processes within one or more containers\n` +
      `  port        List port mappings or a specific mapping for the container\n` +
      `  rename      Rename a container\n` +
      `  restart     Restart one or more containers\n` +
      `  rm          Remove one or more containers\n` +
      `  rmi         Remove one or more images\n` +
      `  save        Save one or more images to a tar archive\n` +
      `  start       Start one or more stopped containers\n` +
      `  stats       Display a live stream of container(s) resource usage statistics\n` +
      `  stop        Stop one or more running containers\n` +
      `  tag         Create a tag TARGET_IMAGE that refers to SOURCE_IMAGE\n` +
      `  top         Display the running processes of a container\n` +
      `  unpause     Unpause all processes within one or more containers\n` +
      `  wait        Block until one or more containers stop, then print their exit codes\n\n` +
      `Run 'docker COMMAND --help' for more information on a command.\n\n`);
    return 0;
  }

  function cmdVersion(sh, io, args) {
    const e = eng(sh);
    if (args.includes('--format') || args.includes('-f')) {
      const i = Math.max(args.indexOf('--format'), args.indexOf('-f'));
      const f = args[i + 1] || '';
      io.stdout.write(aplicarFormato(f, { Client: { Version: e.versao.cliente }, Server: { Version: e.versao.servidor } }) + '\n');
      return 0;
    }
    io.stdout.write(
      `Client: Docker Engine - Community\n Version:           ${e.versao.cliente}\n API version:       ${e.versao.api}\n` +
      ` Go version:        go1.24.4\n Git commit:        1a2b3c4\n Built:             Tue Aug 11 14:02:11 2026\n` +
      ` OS/Arch:           linux/amd64\n Context:           default\n\n` +
      `Server: Docker Engine - Community\n Engine:\n  Version:          ${e.versao.servidor}\n` +
      `  API version:      ${e.versao.api} (minimum version 1.24)\n  Go version:       go1.24.4\n` +
      `  Git commit:       5d6e7f8\n  Built:            Tue Aug 11 14:02:11 2026\n  OS/Arch:          linux/amd64\n` +
      `  Experimental:     false\n containerd:\n  Version:          1.7.28\n runc:\n  Version:          1.2.5\n` +
      ` docker-init:\n  Version:          0.19.0\n`);
    return 0;
  }

  function cmdInfo(sh, io) {
    const e = eng(sh);
    const rodando = Array.from(e.containers.values()).filter(c => c.rodando).length;
    const pausados = Array.from(e.containers.values()).filter(c => c.estado === 'paused').length;
    const parados = e.containers.size - rodando - pausados;
    io.stdout.write(
      `Client: Docker Engine - Community\n Version:    ${e.versao.cliente}\n Context:    default\n` +
      ` Plugins:\n  buildx: Docker Buildx (Docker Inc.)\n    Version:  ${e.versao.buildx}\n` +
      `  compose: Docker Compose (Docker Inc.)\n    Version:  ${e.versao.compose}\n\n` +
      `Server:\n Containers: ${e.containers.size}\n  Running: ${rodando}\n  Paused: ${pausados}\n  Stopped: ${parados}\n` +
      ` Images: ${e.imagens.size}\n Server Version: ${e.versao.servidor}\n Storage Driver: overlayfs\n` +
      `  driver-type: io.containerd.snapshotter.v1\n Logging Driver: json-file\n Cgroup Driver: systemd\n Cgroup Version: 2\n` +
      ` Plugins:\n  Volume: local\n  Network: bridge host ipvlan macvlan null overlay\n` +
      ` Swarm: inactive\n Runtimes: io.containerd.runc.v2 runc\n Default Runtime: runc\n Init Binary: docker-init\n` +
      ` containerd version: 1.7.28\n runc version: 1.2.5\n Security Options:\n  apparmor\n  seccomp\n   Profile: builtin\n  cgroupns\n` +
      ` Kernel Version: 6.14.0-27-generic\n Operating System: Ubuntu 26.04 LTS\n OSType: linux\n Architecture: x86_64\n` +
      ` CPUs: ${sh.m.cpuCount}\n Total Memory: ${(sh.m.mem.total / 1024).toFixed(2)}GiB\n Name: ${sh.m.hostname}\n` +
      ` Docker Root Dir: /var/lib/docker\n Debug Mode: false\n Experimental: false\n Live Restore Enabled: false\n\n`);
    return 0;
  }

  /* -------------------------- imagens -------------------------- */
  function cmdPull(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { q: 0, a: 0, '--quiet': 0, '--platform': 1, '--all-tags': 0 });
    const ref = rest[0];
    if (!ref) { io.stderr.write(`"docker pull" requires exactly 1 argument.\nSee 'docker pull --help'.\n\nUsage:  docker pull [OPTIONS] NAME[:TAG|@DIGEST]\n`); return 1; }
    const r = e.puxar(ref);
    if (!r.ok) { io.stderr.write(r.erro + '\n'); return 1; }
    const analise = LX.analisarRefImagem(ref);
    if (r.jaExistia) {
      io.stdout.write(`${analise.tag}: Pulling from ${analise.namespace}/${analise.repositorio}\n`);
      io.stdout.write(`Digest: ${r.imagem.digest}\nStatus: Image is up to date for ${r.ref}\n${r.ref}\n`);
      return 0;
    }
    io.stdout.write(`${analise.tag}: Pulling from ${analise.namespace}/${analise.repositorio}\n`);
    for (const cam of r.imagem.camadas) {
      const cid = cam.id.replace('sha256:', '').slice(0, 12);
      io.stdout.write(`${cid}: Pull complete\n`);
    }
    io.stdout.write(`Digest: ${r.imagem.digest}\nStatus: Downloaded newer image for ${r.ref}\n${r.ref}\n`);
    return 0;
  }

  function cmdPush(sh, io, args) {
    const e = eng(sh);
    const ref = args.find(a => !a.startsWith('-'));
    if (!ref) { io.stderr.write(`"docker push" requires exactly 1 argument.\n`); return 1; }
    const img = e.imagemPorRef(ref);
    if (!img) { io.stderr.write(`An image does not exist locally with the tag: ${String(ref).split(':')[0]}\n`); return 1; }
    const a = LX.analisarRefImagem(ref);
    if (a.registro === 'docker.io' && !e.login) {
      io.stdout.write(`The push refers to repository [docker.io/${a.namespace}/${a.repositorio}]\n`);
      io.stderr.write(`denied: requested access to the resource is denied\n`);
      return 1;
    }
    io.stdout.write(`The push refers to repository [${a.registro}/${a.namespace ? a.namespace + '/' : ''}${a.repositorio}]\n`);
    for (const cam of img.camadas) io.stdout.write(`${cam.id.replace('sha256:', '').slice(0, 12)}: Pushed\n`);
    io.stdout.write(`${a.tag}: digest: ${img.digest} size: ${1571 + img.camadas.length * 528}\n`);
    /* registry privado rodando em container recebe o repositório */
    for (const c of e.containers.values()) {
      if (!c.rodando || !c.registroPrivado) continue;
      const escuta = c.escutas.find(l => l.port === 5000);
      if (!escuta) continue;
      const alvo = `${a.registro}`;
      const publicado = c.portas.find(p => p.contPort === 5000);
      if (publicado && (alvo === `localhost:${publicado.hostPort}` || alvo === `127.0.0.1:${publicado.hostPort}`)) {
        const repo = (a.namespace ? a.namespace + '/' : '') + a.repositorio;
        c.registroPrivado.set(repo, a.tag);
        /* guarda o conteúdo para o pull de volta funcionar */
        c.registroBlobs = c.registroBlobs || new Map();
        c.registroBlobs.set(repo + ':' + a.tag, img);
      }
    }
    return 0;
  }

  async function cmdLogin(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { u: 1, p: 1, '--username': 1, '--password': 1, '--password-stdin': 0 });
    const servidor = rest[0] || 'https://index.docker.io/v1/';
    const usuario = opts.u || opts['--username'];
    let senha = opts.p || opts['--password'];
    if (opts['--password-stdin']) senha = (io.stdin && io.stdin.readAll ? io.stdin.readAll() : '').trim();
    else if (senha) {
      io.stderr.write(`WARNING! Using --password via the CLI is insecure. Use --password-stdin.\n`);
    }
    if (!usuario) { io.stderr.write('Error: must provide --username with --password-stdin\n'); return 1; }
    if (!senha) { io.stdout.write('Password: '); senha = await io.term.readLine({ senha: true }); }
    if (!senha) { io.stderr.write('Error response from daemon: Get "https://registry-1.docker.io/v2/": unauthorized: incorrect username or password\n'); return 1; }
    e.login = { usuario, servidor };
    const ctx = sh.fsopts();
    try {
      const dir = (sh.getVar('HOME') || '/root') + '/.docker';
      sh.m.fs.mkdirp(dir, ctx);
      sh.m.fs.writeFile(dir + '/config.json',
        JSON.stringify({ auths: { [servidor]: { auth: '<credencial-armazenada-em-base64>' } } }, null, 2) + '\n', ctx);
      io.stderr.write(`WARNING! Your credentials are stored unencrypted in '${dir}/config.json'.\nConfigure a credential helper to remove this warning. See\nhttps://docs.docker.com/go/credential-store/\n\n`);
    } catch (err) { }
    io.stdout.write('Login Succeeded\n');
    return 0;
  }

  function listarImagens(e, opts) {
    const linhas = [];
    for (const img of e.imagens.values()) {
      const tags = img.tags.size ? Array.from(img.tags) : ['<none>:<none>'];
      for (const t of tags) {
        const dp = t.lastIndexOf(':');
        linhas.push({
          Repository: t.slice(0, dp), Tag: t.slice(dp + 1),
          ID: img.idCurto, CreatedSince: idade(img.criadaEm), Size: humano(img.tamanho),
          Digest: img.digest, criadaEm: img.criadaEm, imagem: img
        });
      }
    }
    linhas.sort((a, b) => b.criadaEm - a.criadaEm);
    return linhas;
  }

  function cmdImages(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { q: 0, a: 0, '--quiet': 0, '--all': 0, '--no-trunc': 0, '--format': 1, '--filter': 1, f: 1, '--digests': 0 });
    let linhas = listarImagens(e, opts);
    if (rest[0]) {
      const alvo = LX.analisarRefImagem(rest[0]);
      linhas = linhas.filter(l => l.Repository === alvo.nome && (rest[0].includes(':') ? l.Tag === alvo.tag : true));
    }
    const filtro = opts['--filter'] || opts.f;
    if (filtro) {
      const m = /^dangling=(true|false)$/.exec(filtro);
      if (m) linhas = linhas.filter(l => (l.Repository === '<none>') === (m[1] === 'true'));
      const mr = /^reference=(.+)$/.exec(filtro);
      if (mr) {
        const re = new RegExp('^' + mr[1].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
        linhas = linhas.filter(l => re.test(l.Repository + ':' + l.Tag) || re.test(l.Repository));
      }
    }
    if (opts.q || opts['--quiet']) {
      const vistos = new Set();
      for (const l of linhas) { if (vistos.has(l.ID)) continue; vistos.add(l.ID); io.stdout.write(l.ID + '\n'); }
      return 0;
    }
    if (opts['--format']) {
      for (const l of linhas) io.stdout.write(aplicarFormato(opts['--format'], l) + '\n');
      return 0;
    }
    const cab = ['REPOSITORY', 'TAG'].concat(opts['--digests'] ? ['DIGEST'] : []).concat(['IMAGE ID', 'CREATED', 'SIZE']);
    tabela(io, cab, linhas.map(l => ['REPOSITORY', 'TAG'].concat(opts['--digests'] ? ['DIGEST'] : []).concat(['IMAGE ID', 'CREATED', 'SIZE'])
      .map(k => ({ REPOSITORY: l.Repository, TAG: l.Tag, DIGEST: l.Digest, 'IMAGE ID': l.ID, CREATED: l.CreatedSince, SIZE: l.Size })[k])));
    return 0;
  }

  async function cmdImage(sh, io, args) {
    const sub = args[0];
    const resto = args.slice(1);
    switch (sub) {
      case 'ls': case 'list': return cmdImages(sh, io, resto);
      case 'rm': case 'remove': return cmdRmi(sh, io, resto);
      case 'inspect': return await cmdInspect(sh, io, ['--type', 'image'].concat(resto));
      case 'pull': return cmdPull(sh, io, resto);
      case 'push': return cmdPush(sh, io, resto);
      case 'tag': return cmdTag(sh, io, resto);
      case 'history': return cmdHistory(sh, io, resto);
      case 'save': return cmdSave(sh, io, resto);
      case 'load': return cmdLoad(sh, io, resto);
      case 'build': return LX.cmdDockerBuild(sh, io, resto);
      case 'prune': return cmdPrune(sh, io, resto, { imagens: true });
      default:
        io.stdout.write(`Usage:  docker image COMMAND\n\nManage images\n\nCommands:\n  build       Build an image from a Dockerfile\n  history     Show the history of an image\n  import      Import the contents from a tarball to create a filesystem image\n  inspect     Display detailed information on one or more images\n  load        Load an image from a tar archive or STDIN\n  ls          List images\n  prune       Remove unused images\n  pull        Download an image from a registry\n  push        Upload an image to a registry\n  rm          Remove one or more images\n  save        Save one or more images to a tar archive\n  tag         Create a tag TARGET_IMAGE that refers to SOURCE_IMAGE\n\n`);
        return 0;
    }
  }

  function cmdRmi(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { f: 0, '--force': 0 });
    if (!rest.length) { io.stderr.write(`"docker rmi" requires at least 1 argument.\n`); return 1; }
    let cod = 0;
    for (const ref of rest) {
      const r = e.removerImagem(ref, { force: opts.f || opts['--force'] });
      if (!r.ok) { io.stderr.write(r.erro + '\n'); cod = 1; continue; }
      for (const t of (r.untagged || [])) io.stdout.write(`Untagged: ${t}\n`);
      for (const d of (r.deleted || [])) io.stdout.write(`Deleted: ${d}\n`);
    }
    return cod;
  }

  function cmdTag(sh, io, args) {
    const e = eng(sh);
    if (args.length < 2) { io.stderr.write(`"docker tag" requires exactly 2 arguments.\nSee 'docker tag --help'.\n\nUsage:  docker tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]\n`); return 1; }
    const r = e.marcar(args[0], args[1]);
    if (!r.ok) { io.stderr.write(r.erro + '\n'); return 1; }
    return 0;
  }

  function cmdHistory(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { '--no-trunc': 0, H: 0, q: 0, '--quiet': 0, '--format': 1 });
    const img = e.imagemPorRef(rest[0]);
    if (!img) { io.stderr.write(`Error response from daemon: No such image: ${rest[0]}\n`); return 1; }
    const linhas = [];
    const cams = img.camadas.slice().reverse();
    for (let i = 0; i < cams.length; i++) {
      const cam = cams[i];
      const cria = cam.criadoPor || '';
      linhas.push([
        i === 0 ? img.idCurto : '<missing>',
        idade(img.criadaEm - i * 1000),
        opts['--no-trunc'] ? cria : (cria.length > 45 ? cria.slice(0, 42) + '…' : cria),
        humano(cam.tamanho),
        ''
      ]);
    }
    if (opts.q || opts['--quiet']) { for (const l of linhas) io.stdout.write(l[0] + '\n'); return 0; }
    tabela(io, ['IMAGE', 'CREATED', 'CREATED BY', 'SIZE', 'COMMENT'], linhas);
    return 0;
  }

  /* docker save / load — o .tar que atravessa servidores */
  function cmdSave(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { o: 1, '--output': 1 });
    if (!rest.length) { io.stderr.write(`"docker save" requires at least 1 argument.\nSee 'docker save --help'.\n\nUsage:  docker save [OPTIONS] IMAGE [IMAGE...]\n`); return 1; }
    const imagens = [];
    for (const ref of rest) {
      const img = e.imagemPorRef(ref);
      if (!img) { io.stderr.write(`Error response from daemon: No such image: ${ref}\n`); return 1; }
      /* O .tar carrega a imagem inteira: identidade, configuração,
         camadas e o sistema de arquivos. É por isso que ele pode viajar
         de scp para outro servidor e virar a mesma imagem lá. */
      imagens.push({
        ref, id: img.id, tags: Array.from(img.tags), tamanho: img.tamanho,
        camadas: img.camadas.map(c => ({ id: c.id, tamanho: c.tamanho, criadoPor: c.criadoPor })),
        config: img.config, criadaEm: img.criadaEm, hub: img._defChave || null,
        arvore: img.arvore || null
      });
    }
    const conteudo = 'DOCKER-IMAGE-ARCHIVE\n' + JSON.stringify({ imagens }) + '\n';
    const destino = opts.o || opts['--output'];
    if (!destino) {
      if (io.stdout.isTTY) {
        io.stderr.write(`Error response from daemon: cowardly refusing to save to a terminal. Use the -o flag or redirect\n`);
        return 1;
      }
      io.stdout.write(conteudo);
      return 0;
    }
    const caminho = P(sh, destino);
    try {
      const n = sh.m.fs.writeFile(caminho, conteudo, sh.fsopts());
      n.tamanhoComprimido = imagens.reduce((a, i) => a + i.tamanho, 0);
    } catch (err) { io.stderr.write(`Error response from daemon: ${err.message}\n`); return 1; }
    return 0;
  }

  function cmdLoad(sh, io, args) {
    const e = eng(sh);
    const { opts } = getopt(args, { i: 1, '--input': 1, q: 0, '--quiet': 0 });
    let texto = null;
    const origem = opts.i || opts['--input'];
    if (origem) {
      try { texto = sh.m.fs.readFile(P(sh, origem), sh.fsopts()); }
      catch (err) { io.stderr.write(`open ${P(sh, origem)}: no such file or directory\n`); return 1; }
    } else {
      texto = io.stdin && io.stdin.readAll ? io.stdin.readAll() : '';
      if (!texto) { io.stderr.write('open /dev/stdin: no such file or directory\n'); return 1; }
    }
    if (!texto.startsWith('DOCKER-IMAGE-ARCHIVE')) {
      io.stderr.write(`Error response from daemon: invalid tar header\n`);
      return 1;
    }
    let dados;
    try { dados = JSON.parse(texto.split('\n')[1]); }
    catch (err) { io.stderr.write('Error response from daemon: invalid tar header\n'); return 1; }
    for (const info of dados.imagens) {
      let img = Array.from(e.imagens.values()).find(x => x.id === info.id);
      if (!img) {
        if (info.hub && LX.HUB.get(info.hub)) {
          img = e._materializar(LX.HUB.get(info.hub), info.tags[0]);
        } else {
          const arvore = info.arvore;
          img = new LX.ImagemDocker({
            id: info.id, tags: info.tags, camadas: info.camadas,
            config: info.config, criadaEm: info.criadaEm, local: true,
            semear: arvore ? (cmNovo) => LX.aplicarArvore(cmNovo.fs, cmNovo.ctxRoot(), arvore) : null
          });
          img.arvore = arvore;
          e.imagens.set(img.id, img);
        }
      }
      for (const t of info.tags) img.tags.add(t);
      io.stdout.write(`Loaded image: ${info.tags[0]}\n`);
    }
    return 0;
  }

  function cmdBuildx(sh, io, args) {
    const sub = args[0];
    if (sub === 'version') { io.stdout.write(`github.com/docker/buildx ${eng(sh).versao.buildx} 1a2b3c4\n`); return 0; }
    if (sub === 'ls') {
      tabela(io, ['NAME/NODE', 'DRIVER/ENDPOINT', 'STATUS', 'BUILDKIT', 'PLATFORMS'],
        [['default *', 'docker', '', '', ''], [' \\_ default', ' \\_ default', 'running', 'v0.19.0', 'linux/amd64, linux/arm64']]);
      return 0;
    }
    io.stdout.write(`Usage:  docker buildx [OPTIONS] COMMAND\n\nExtended build capabilities with BuildKit\n\nCommands:\n  build       Start a build\n  ls          List builder instances\n  version     Show buildx version information\n\n`);
    return 0;
  }

  /* -------------------------- containers -------------------------- */
  async function cmdRun(sh, io, args, iniciar) {
    const e = eng(sh);
    const r = analisarRun(args);
    if (r.erro) { io.stderr.write(r.erro + '\n'); return 125; }
    const spec = r.spec;

    /* --env-file: lido pelo cliente, no formato chave=valor, sem shell */
    if (spec.envFiles) {
      for (const arq of spec.envFiles) {
        let texto;
        try { texto = sh.m.fs.readFile(P(sh, arq), sh.fsopts()); }
        catch (err) {
          io.stderr.write(`docker: open ${P(sh, arq)}: no such file or directory\n`);
          return 125;
        }
        for (const linha of texto.split('\n')) {
          const l = linha.trim();
          if (!l || l.startsWith('#')) continue;
          const dp = l.indexOf('=');
          if (dp < 0) { spec.env[l] = sh.getVar(l) || ''; continue; }
          spec.env[l.slice(0, dp)] = l.slice(dp + 1);
        }
      }
      /* -e vence o --env-file: reaplicamos as explícitas */
      for (const a of args) {
        const m = /^--env=(.*)$|^-e$/.exec(a);
      }
    }
    /* -e VAR (sem =) herda do ambiente do shell */
    for (const k in spec.env) if (spec.env[k] === '' && sh.getVar(k)) spec.env[k] = sh.getVar(k);

    /* bind mounts relativos são resolvidos contra o diretório atual */
    for (const mo of spec.montagens) {
      if (mo.tipo === 'bind') mo.origem = P(sh, mo.origem.replace(/^~/, sh.getVar('HOME') || '/root'));
    }
    if (spec.aliases.length && spec.redes.length) {
      spec.redes = spec.redes.map((n, i) => i === 0 ? { nome: n, aliases: spec.aliases } : n);
    }

    const criacao = e.criarContainer({
      imagem: spec.imagem, nome: spec.nome, env: spec.env, portas: spec.portas,
      publicarTudo: spec.publicarTudo, montagens: spec.montagens, redes: spec.redes,
      labels: spec.labels, hostname: spec.hostname, usuario: spec.usuario, workdir: spec.workdir,
      somenteLeitura: spec.somenteLeitura, tty: spec.tty, interativo: spec.interativo,
      autoRemover: spec.autoRemover, recursos: spec.recursos, restart: spec.restart,
      saude: spec.saude, entrypoint: spec.entrypoint, cmd: spec.comando,
      expostas: spec.expostas, capAdd: spec.capAdd, capDrop: spec.capDrop,
      securityOpt: spec.securityOpt, privilegiado: spec.privilegiado,
      stopSignal: spec.stopSignal, pull: spec.pull
    });
    if (!criacao.ok) {
      const msg = criacao.erro.startsWith('docker:') ? criacao.erro : 'docker: ' + criacao.erro;
      io.stderr.write(msg + '\n');
      if (/No such image|pull access denied|manifest for/.test(criacao.erro)) {
        io.stderr.write(`\nRun 'docker run --help' for more information\n`);
        return 125;
      }
      return 125;
    }
    const c = criacao.container;
    if (!iniciar) { io.stdout.write(c.id + '\n'); return 0; }

    const ini = e.iniciar(c);
    if (!ini.ok) {
      io.stderr.write((ini.erro.startsWith('docker:') ? ini.erro : 'docker: ' + ini.erro) + '\n');
      return ini.iniciouEFalhou ? 127 : 125;
    }

    if (spec.detach) {
      /* Em segundo plano, um container sem daemon só continua de pé se o
         comando dele for de longa duração. `docker run -d alpine ls` roda,
         imprime no log e termina — e é isso que confunde quem espera vê-lo
         no `docker ps`. */
      if (c.efemera && !e.comandoLongo(c)) {
        const pedacos = [];
        const ioLog = {
          stdin: new LX.InStream(''),
          stdout: new LX.Stream({ onWrite: s => pedacos.push(s) }),
          stderr: new LX.Stream({ onWrite: s => pedacos.push(s) }),
          term: io.term
        };
        await e.rodarPrincipal(c, ioLog);
        const texto = pedacos.join('');
        if (texto) c.registrar(texto.replace(/\n$/, ''));
      }
      io.stdout.write(c.id + '\n');
      return 0;
    }

    /* Primeiro plano: se a imagem entrega um comando executável, ele roda
       aqui e o container termina junto — como o Docker faz de verdade. */
    const argv = (c.entrypoint || []).concat(c.cmd || []);
    const img = e.imagens.get(c.imagemId);
    const ehEntrypointScript = argv[0] && /entrypoint/.test(argv[0]);
    const argvReal = ehEntrypointScript ? argv.slice(1) : argv;

    /* A imagem já escreveu tudo o que tinha a dizer (hello-world) ou o
       processo dela falhou na largada: só resta mostrar a saída. */
    const soImprime = (img.aoIniciar && img.encerraSozinha) || !c.rodando;
    if (soImprime) {
      imprimirLogs(io, c, {});
      const saida = c.saida || 0;
      if (e.containers.has(c.id) && c.rodando) e.parar(c);
      return saida;
    }

    if (!c.escutas.length) {
      if (argvReal.length) {
        const cod = await rodarNoContainer(e, c, argvReal, io, { interativo: spec.interativo && spec.tty });
        if (e.containers.has(c.id)) {
          c.saida = cod;
          if (c.rodando) e._encerrar(c, cod, 'primeiro-plano');
          if (c.autoRemover && e.containers.has(c.id)) e.remover(c, { force: true, silencioso: true });
        }
        return cod;
      }
      imprimirLogs(io, c, {});
      if (e.containers.has(c.id) && c.rodando) e.parar(c);
      return c.saida || 0;
    }

    /* serviço em primeiro plano: acompanha os logs até o Ctrl+C */
    imprimirLogs(io, c, {});
    if (io.term && io.term.follow) {
      let vistos = c.logs.length;
      await io.term.follow(async () => {
        const novos = c.logs.slice(vistos);
        vistos = c.logs.length;
        return novos.map(l => l.texto).join('\n') + (novos.length ? '\n' : '');
      });
      io.stdout.write('^C\n');
      if (e.containers.has(c.id) && c.rodando) e.parar(c);
      return 130;
    }
    return 0;
  }

  function cadaContainer(sh, io, nomes, fn, verbo) {
    const e = eng(sh);
    let cod = 0;
    for (const nome of nomes) {
      let c;
      try { c = e.achar(nome); }
      catch (err) { io.stderr.write(`Error response from daemon: multiple IDs found with provided prefix: ${nome}\n`); cod = 1; continue; }
      if (!c) {
        io.stderr.write(`Error response from daemon: No such container: ${nome}\n`);
        io.stderr.write(`Error: failed to ${verbo}: ${nome}\n`);
        cod = 1;
        continue;
      }
      const r = fn(c);
      if (r === false) cod = 1;
    }
    return cod;
  }

  function cmdStart(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { a: 0, i: 0, '--attach': 0, '--interactive': 0 });
    if (!rest.length) { io.stderr.write(`"docker start" requires at least 1 argument.\n`); return 1; }
    return cadaContainer(sh, io, rest, (c) => {
      const r = e.iniciar(c);
      if (!r.ok) { io.stderr.write(`Error response from daemon: ${r.erro.replace(/^docker: /, '')}\nError: failed to start containers: ${c.nome}\n`); return false; }
      io.stdout.write(c.nome + '\n');
    }, 'start containers');
  }

  function cmdStop(sh, io, args, modo) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { t: 1, '--timeout': 1, '--time': 1, s: 1, '--signal': 1 });
    if (!rest.length) { io.stderr.write(`"docker ${modo}" requires at least 1 argument.\n`); return 1; }
    return cadaContainer(sh, io, rest, (c) => {
      if (modo === 'kill' && !c.rodando) {
        io.stderr.write(`Error response from daemon: cannot kill container: ${c.nome}: Container ${c.id} is not running\n`);
        return false;
      }
      e.parar(c, { sinal: modo === 'kill' ? (opts.s || opts['--signal'] || 'SIGKILL') : c.stopSignal });
      io.stdout.write(c.nome + '\n');
    }, modo === 'kill' ? 'kill containers' : 'stop containers');
  }

  function cmdRestart(sh, io, args) {
    const e = eng(sh);
    const { rest } = getopt(args, { t: 1, '--timeout': 1 });
    return cadaContainer(sh, io, rest, (c) => { e.reiniciar(c); io.stdout.write(c.nome + '\n'); }, 'restart containers');
  }

  function cmdPausa(sh, io, args, pausar) {
    const e = eng(sh);
    return cadaContainer(sh, io, args.filter(a => !a.startsWith('-')), (c) => {
      const r = pausar ? e.pausar(c) : e.despausar(c);
      if (!r.ok) { io.stderr.write(r.erro + '\n'); return false; }
      io.stdout.write(c.nome + '\n');
    }, pausar ? 'pause containers' : 'unpause containers');
  }

  function cmdRm(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { f: 0, v: 0, l: 0, '--force': 0, '--volumes': 0 });
    if (!rest.length) { io.stderr.write(`"docker rm" requires at least 1 argument.\n`); return 1; }
    return cadaContainer(sh, io, rest, (c) => {
      const r = e.remover(c, { force: opts.f || opts['--force'], volumes: opts.v || opts['--volumes'] });
      if (!r.ok) { io.stderr.write(r.erro + '\nError: failed to remove containers: ' + c.nome + '\n'); return false; }
      io.stdout.write(c.nome + '\n');
    }, 'remove containers');
  }

  async function cmdPs(sh, io, args) {
    const e = eng(sh);
    const { opts } = getopt(args, { a: 0, q: 0, l: 0, n: 1, s: 0, '--all': 0, '--quiet': 0, '--no-trunc': 0, '--format': 1, '--filter': 1, f: 1, '--latest': 0 });
    let lista = Array.from(e.containers.values());
    const todos = opts.a || opts['--all'];
    if (!todos) lista = lista.filter(c => c.rodando || c.estado === 'paused' || c.estado === 'restarting');
    lista.sort((a, b) => b.criadoEm - a.criadoEm);
    if (opts.l || opts['--latest']) lista = lista.slice(0, 1);
    if (opts.n) lista = lista.slice(0, parseInt(opts.n, 10));

    const filtros = [];
    for (let i = 0; i < args.length; i++) {
      if ((args[i] === '--filter' || args[i] === '-f') && args[i + 1]) filtros.push(args[++i]);
      else if (args[i].startsWith('--filter=')) filtros.push(args[i].slice(9));
    }
    for (const f of filtros) {
      const dp = f.indexOf('=');
      const chave = f.slice(0, dp), valor = f.slice(dp + 1);
      if (chave === 'status') lista = lista.filter(c => c.estado === valor || (valor === 'exited' && c.estado === 'exited'));
      else if (chave === 'name') lista = lista.filter(c => c.nome.includes(valor));
      else if (chave === 'ancestor') lista = lista.filter(c => c.imagemRef === valor || (e.imagens.get(c.imagemId) || { tags: new Set() }).tags.has(valor));
      else if (chave === 'label') {
        const dpp = valor.indexOf('=');
        if (dpp < 0) lista = lista.filter(c => valor in (c.labels || {}));
        else lista = lista.filter(c => (c.labels || {})[valor.slice(0, dpp)] === valor.slice(dpp + 1));
      } else if (chave === 'health') lista = lista.filter(c => c.saude.estado === valor);
      else if (chave === 'network') lista = lista.filter(c => c.redes.has(valor));
    }

    /* a saúde é reavaliada aqui: é o `docker ps` que o aluno usa para
       descobrir que o serviço subiu mas ainda não está pronto */
    for (const c of lista) if (c.saudeConfig && c.rodando) { try { await e.avaliarSaude(c); } catch (err) { } }

    if (opts.q || opts['--quiet']) { for (const c of lista) io.stdout.write((opts['--no-trunc'] ? c.id : c.curto) + '\n'); return 0; }

    const dados = lista.map(c => {
      const img = e.imagens.get(c.imagemId);
      const argv = (c.entrypoint || []).concat(c.cmd || []).join(' ');
      return {
        ID: opts['--no-trunc'] ? c.id : c.curto,
        Image: c.imagemRef || (img ? img.tagPrincipal : ''),
        Command: opts['--no-trunc'] ? `"${argv}"` : `"${argv.length > 18 ? argv.slice(0, 17) + '…' : argv}"`,
        CreatedAt: idade(c.criadoEm), RunningFor: idade(c.criadoEm),
        Status: c.status, Ports: c.portasTexto, Names: c.nome,
        State: c.estado, Networks: Array.from(c.redes.keys()).join(','),
        Size: '0B (virtual ' + humano((e.imagens.get(c.imagemId) || { tamanho: 0 }).tamanho) + ')'
      };
    });
    if (opts['--format']) {
      for (const d of dados) io.stdout.write(aplicarFormato(opts['--format'], d) + '\n');
      return 0;
    }
    const cab = ['CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES'];
    tabela(io, cab, dados.map(d => [d.ID, d.Image, d.Command, d.CreatedAt, d.Status, d.Ports, d.Names]));
    return 0;
  }

  async function cmdLogs(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { f: 0, n: 1, t: 0, '--follow': 0, '--tail': 1, '--timestamps': 0, '--since': 1, '--until': 1, '--details': 0 });
    if (!rest.length) { io.stderr.write(`"docker logs" requires exactly 1 argument.\nSee 'docker logs --help'.\n\nUsage:  docker logs [OPTIONS] CONTAINER\n`); return 1; }
    let c; try { c = e.achar(rest[0]); } catch (err) { io.stderr.write(`Error response from daemon: multiple IDs found with provided prefix: ${rest[0]}\n`); return 1; }
    if (!c) { io.stderr.write(`Error response from daemon: No such container: ${rest[0]}\n`); return 1; }
    imprimirLogs(io, c, { tail: opts.n || opts['--tail'], timestamps: opts.t || opts['--timestamps'] });
    if ((opts.f || opts['--follow']) && io.term && io.term.follow) {
      let vistos = c.logs.length;
      await io.term.follow(async () => {
        const novos = c.logs.slice(vistos);
        vistos = c.logs.length;
        return novos.map(l => l.texto).join('\n') + (novos.length ? '\n' : '');
      });
    }
    return 0;
  }

  async function cmdExec(sh, io, args) {
    const e = eng(sh);
    const r = analisarExec(args);
    if (r.erro) { io.stderr.write(r.erro + '\n'); return 125; }
    let c;
    try { c = e.achar(r.container); } catch (err) { io.stderr.write(`Error response from daemon: multiple IDs found with provided prefix: ${r.container}\n`); return 1; }
    if (!c) { io.stderr.write(`Error response from daemon: No such container: ${r.container}\n`); return 1; }
    if (!c.rodando) {
      io.stderr.write(`Error response from daemon: container ${c.id} is not running\n`);
      return 1;
    }
    if (!r.comando.length) {
      io.stderr.write(`"docker exec" requires at least 2 arguments.\nSee 'docker exec --help'.\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]\n\nExecute a command in a running container\n`);
      return 1;
    }
    return await rodarNoContainer(e, c, r.comando, io, {
      interativo: r.interativo && r.tty, usuario: r.usuario, workdir: r.workdir, env: r.env
    });
  }

  function analisarExec(args) {
    const r = { env: {}, interativo: false, tty: false };
    let i = 0;
    for (; i < args.length; i++) {
      let a = args[i];
      if (!a.startsWith('-')) break;
      let v = null;
      const eq = a.indexOf('=');
      if (a.startsWith('--') && eq > 0) { v = a.slice(eq + 1); a = a.slice(0, eq); }
      if (a === '-i' || a === '--interactive') { r.interativo = true; continue; }
      if (a === '-t' || a === '--tty') { r.tty = true; continue; }
      if (a === '-d' || a === '--detach') { r.detach = true; continue; }
      if (a === '--privileged') continue;
      if (a === '-u' || a === '--user') { r.usuario = v !== null ? v : args[++i]; continue; }
      if (a === '-w' || a === '--workdir') { r.workdir = v !== null ? v : args[++i]; continue; }
      if (a === '-e' || a === '--env') {
        const par = v !== null ? v : args[++i];
        const dp = String(par).indexOf('=');
        if (dp > 0) r.env[par.slice(0, dp)] = par.slice(dp + 1);
        continue;
      }
      if (/^-[a-zA-Z]{2,}$/.test(a)) {
        for (const ch of a.slice(1)) {
          if (ch === 'i') r.interativo = true;
          else if (ch === 't') r.tty = true;
          else if (ch === 'd') r.detach = true;
          else return { erro: `unknown shorthand flag: '${ch}' in ${a}` };
        }
        continue;
      }
      return { erro: `unknown flag: ${a}` };
    }
    r.container = args[i];
    r.comando = args.slice(i + 1);
    if (!r.container) return { erro: `"docker exec" requires at least 2 arguments.\nSee 'docker exec --help'.\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]` };
    return r;
  }

  async function cmdAttach(sh, io, args) {
    const e = eng(sh);
    const nome = args.find(a => !a.startsWith('-'));
    let c; try { c = e.achar(nome); } catch (err) { c = null; }
    if (!c) { io.stderr.write(`Error response from daemon: No such container: ${nome}\n`); return 1; }
    if (!c.rodando) { io.stderr.write(`Error response from daemon: container ${c.id} is not running\n`); return 1; }
    /* attach entra no processo PID 1; sair com Ctrl+C mata o container.
       É por isso que exec é o comando certo para "só dar uma olhada". */
    io.stdout.write(`\x1b[2m(anexado ao processo principal de ${c.nome} — Ctrl+C encerraria o container)\x1b[0m\n`);
    imprimirLogs(io, c, { tail: 20 });
    if (io.term && io.term.follow) {
      let vistos = c.logs.length;
      await io.term.follow(async () => {
        const novos = c.logs.slice(vistos);
        vistos = c.logs.length;
        return novos.map(l => l.texto).join('\n') + (novos.length ? '\n' : '');
      });
      io.stdout.write('^C\n');
      if (e.containers.has(c.id) && c.rodando) e.parar(c);
      return 130;
    }
    return 0;
  }

  /* docker cp — atravessa a fronteira entre o host e o container */
  function cmdCp(sh, io, args) {
    const e = eng(sh);
    const rest = args.filter(a => !a.startsWith('-'));
    if (rest.length < 2) { io.stderr.write(`"docker cp" requires exactly 2 arguments.\nSee 'docker cp --help'.\n\nUsage:  docker cp [OPTIONS] CONTAINER:SRC_PATH DEST_PATH|-\n\tdocker cp [OPTIONS] SRC_PATH|- CONTAINER:DEST_PATH\n`); return 1; }
    const [origem, destino] = rest;
    const parte = (s) => {
      const m = /^([^:/][^:]*):(.+)$/.exec(s);
      return m ? { container: m[1], caminho: m[2] } : { caminho: s };
    };
    const a = parte(origem), b = parte(destino);
    if (a.container && b.container) { io.stderr.write('copying between containers is not supported\n'); return 1; }
    if (!a.container && !b.container) { io.stderr.write('must specify at least one container source\n'); return 1; }

    const achar = (nome) => { try { return e.achar(nome); } catch (err) { return null; } };
    const copiar = (fsOrigem, ctxOrigem, cOrig, fsDestino, ctxDestino, cDest) => {
      let st;
      try { st = fsOrigem.lstat(cOrig, { ctx: ctxOrigem }); }
      catch (err) {
        io.stderr.write(`${a.container ? 'Error response from daemon: ' : ''}Could not find the file ${cOrig} in container\n`);
        return 1;
      }
      /* destino que é diretório recebe o arquivo com o nome de origem */
      let alvo = cDest;
      try {
        const sd = fsDestino.lstat(cDest, { ctx: ctxDestino });
        if (sd.type === 'dir' && st.type !== 'dir') alvo = cDest.replace(/\/$/, '') + '/' + FileSystem.basename(cOrig);
      } catch (err) { }
      if (st.type === 'dir') {
        const anda = (de, para) => {
          try { fsDestino.mkdirp(para, { ctx: ctxDestino }); } catch (err) { }
          let itens = [];
          try { itens = fsOrigem.readdir(de, { ctx: ctxOrigem }); } catch (err) { return; }
          for (const it of itens) {
            const nm = typeof it === 'string' ? it : it.name;
            if (nm === '.' || nm === '..') continue;
            let s2; try { s2 = fsOrigem.lstat(de + '/' + nm, { ctx: ctxOrigem }); } catch (err) { continue; }
            if (s2.type === 'dir') anda(de + '/' + nm, para + '/' + nm);
            else {
              try {
                const n = fsDestino.writeFile(para + '/' + nm, fsOrigem.readFile(de + '/' + nm, { ctx: ctxOrigem }), { ctx: ctxDestino });
                n.mode = s2.mode;
              } catch (err) { }
            }
          }
        };
        anda(cOrig, alvo);
        return 0;
      }
      try {
        fsDestino.mkdirp(FileSystem.dirname(alvo), { ctx: ctxDestino });
        const n = fsDestino.writeFile(alvo, fsOrigem.readFile(cOrig, { ctx: ctxOrigem }), { ctx: ctxDestino });
        n.mode = st.mode;
      } catch (err) { io.stderr.write(`Error response from daemon: ${err.message}\n`); return 1; }
      return 0;
    };

    /* O daemon roda como root: ele lê e escreve dos dois lados sem
       esbarrar nas permissões do usuário que digitou o comando. */
    const ctxDaemon = sh.m.ctxRoot();
    if (a.container) {
      const c = achar(a.container);
      if (!c) { io.stderr.write(`Error response from daemon: No such container: ${a.container}\n`); return 1; }
      const destino = P(sh, b.caminho);
      const r = copiar(c.maquina.fs, c.maquina.ctxRoot(), FileSystem.normalize(a.caminho, c.workdir || '/'),
        sh.m.fs, ctxDaemon, destino);
      if (r === 0) io.stdout.write(`Successfully copied 2.05kB to ${destino}\n`);
      return r;
    }
    const c = achar(b.container);
    if (!c) { io.stderr.write(`Error response from daemon: No such container: ${b.container}\n`); return 1; }
    const r = copiar(sh.m.fs, ctxDaemon, P(sh, a.caminho), c.maquina.fs, c.maquina.ctxRoot(),
      FileSystem.normalize(b.caminho, c.workdir || '/'));
    if (r === 0) io.stdout.write(`Successfully copied 2.05kB to ${c.nome}:${b.caminho}\n`);
    return r;
  }

  function cmdRename(sh, io, args) {
    const e = eng(sh);
    if (args.length < 2) { io.stderr.write(`"docker rename" requires exactly 2 arguments.\n`); return 1; }
    let c; try { c = e.achar(args[0]); } catch (err) { c = null; }
    if (!c) { io.stderr.write(`Error response from daemon: No such container: ${args[0]}\n`); return 1; }
    const r = e.renomear(c, args[1]);
    if (!r.ok) { io.stderr.write(r.erro + '\n'); return 1; }
    return 0;
  }

  async function cmdStats(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { a: 0, '--all': 0, '--no-stream': 0, '--format': 1, '--no-trunc': 0 });
    let lista = rest.length
      ? rest.map(n => { try { return e.achar(n); } catch (err) { return null; } }).filter(Boolean)
      : Array.from(e.containers.values()).filter(c => (opts.a || opts['--all']) ? true : c.rodando);
    const montar = () => {
      const dados = lista.map(c => {
        const s = e.stats(c);
        return {
          ID: c.curto, Name: c.nome,
          CPUPerc: s.cpu.toFixed(2) + '%',
          MemUsage: `${humano(s.mem)} / ${humano(s.memLimite)}`,
          MemPerc: s.memPct.toFixed(2) + '%',
          NetIO: `${humano(s.redeRx)} / ${humano(s.redeTx)}`,
          BlockIO: `${humano(s.blocoR)} / ${humano(s.blocoW)}`,
          PIDs: String(s.pids)
        };
      });
      if (opts['--format']) return dados.map(d => aplicarFormato(opts['--format'], d)).join('\n') + '\n';
      const cab = ['CONTAINER ID', 'NAME', 'CPU %', 'MEM USAGE / LIMIT', 'MEM %', 'NET I/O', 'BLOCK I/O', 'PIDS'];
      const linhas = dados.map(d => [d.ID, d.Name, d.CPUPerc, d.MemUsage, d.MemPerc, d.NetIO, d.BlockIO, d.PIDs]);
      const larg = cab.map((c, i) => Math.max(c.length, ...linhas.map(l => String(l[i]).length)));
      const fmt = (v) => v.map((x, i) => String(x) + ' '.repeat(larg[i] - String(x).length)).join('   ');
      return [fmt(cab)].concat(linhas.map(fmt)).join('\n') + '\n';
    };
    if (opts['--no-stream'] || !io.term || !io.term.liveView) { io.stdout.write(montar()); return 0; }
    await io.term.liveView(async () => montar());
    return 0;
  }

  function cmdTop(sh, io, args) {
    const e = eng(sh);
    const nome = args.find(a => !a.startsWith('-'));
    let c; try { c = e.achar(nome); } catch (err) { c = null; }
    if (!c) { io.stderr.write(`Error response from daemon: No such container: ${nome}\n`); return 1; }
    if (!c.rodando) { io.stderr.write(`Error response from daemon: container ${c.id} is not running\n`); return 1; }
    const linhas = Array.from(c.maquina.processes.values()).map((p, i) => [
      p.user || 'root', String(4000 + p.pid), p.pid === 1 ? '3985' : '4000',
      '0', new Date(c.iniciadoEm).toTimeString().slice(0, 5), '?', '00:00:00', p.cmd
    ]);
    tabela(io, ['UID', 'PID', 'PPID', 'C', 'STIME', 'TTY', 'TIME', 'CMD'], linhas);
    return 0;
  }

  function cmdDiff(sh, io, args) {
    const e = eng(sh);
    const nome = args.find(a => !a.startsWith('-'));
    let c; try { c = e.achar(nome); } catch (err) { c = null; }
    if (!c) { io.stderr.write(`Error response from daemon: No such container: ${nome}\n`); return 1; }
    for (const d of e.diff(c)) io.stdout.write(`${d.tipo} ${d.caminho}\n`);
    return 0;
  }

  function cmdPort(sh, io, args) {
    const e = eng(sh);
    const rest = args.filter(a => !a.startsWith('-'));
    let c; try { c = e.achar(rest[0]); } catch (err) { c = null; }
    if (!c) { io.stderr.write(`Error response from daemon: No such container: ${rest[0]}\n`); return 1; }
    const filtro = rest[1];
    for (const p of c.portas) {
      const chave = `${p.contPort}/${p.proto}`;
      if (filtro && chave !== filtro && filtro !== String(p.contPort)) continue;
      io.stdout.write((filtro ? '' : chave + ' -> ') + `${p.hostIp}:${p.hostPort}\n`);
    }
    return 0;
  }

  async function cmdEvents(sh, io, args) {
    const e = eng(sh);
    const { opts } = getopt(args, { '--since': 1, '--until': 1, '--filter': 1, f: 1, '--format': 1 });
    const linhas = e.eventos.map(ev =>
      `${new Date(ev.ts).toISOString()} ${ev.tipo} ${ev.acao} ${ev.ator} (${Object.entries(ev.atributos).map(([k, v]) => `${k}=${v}`).concat([`name=${ev.ator}`]).join(', ')})`);
    if (opts['--since'] || opts['--until']) { io.stdout.write(linhas.join('\n') + (linhas.length ? '\n' : '')); return 0; }
    io.stdout.write(linhas.join('\n') + (linhas.length ? '\n' : ''));
    if (io.term && io.term.follow) {
      let vistos = e.eventos.length;
      await io.term.follow(async () => {
        const novos = e.eventos.slice(vistos);
        vistos = e.eventos.length;
        return novos.map(ev => `${new Date(ev.ts).toISOString()} ${ev.tipo} ${ev.acao} ${ev.ator}`).join('\n') + (novos.length ? '\n' : '');
      });
    }
    return 0;
  }

  function cmdWait(sh, io, args) {
    const e = eng(sh);
    for (const nome of args.filter(a => !a.startsWith('-'))) {
      let c; try { c = e.achar(nome); } catch (err) { c = null; }
      if (!c) { io.stderr.write(`Error response from daemon: No such container: ${nome}\n`); return 1; }
      io.stdout.write(String(c.saida || 0) + '\n');
    }
    return 0;
  }

  function cmdUpdate(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { '--restart': 1, '--cpus': 1, '--memory': 1, m: 1 });
    return cadaContainer(sh, io, rest, (c) => {
      if (opts['--restart']) {
        const m = /^(no|always|unless-stopped|on-failure)(?::(\d+))?$/.exec(opts['--restart']);
        if (m) c.restart = { politica: m[1], maxTentativas: m[2] ? +m[2] : 0 };
      }
      if (opts['--cpus']) c.recursos.cpus = parseFloat(opts['--cpus']);
      if (opts['--memory'] || opts.m) c.recursos.memoria = analisarBytes(opts['--memory'] || opts.m);
      io.stdout.write(c.nome + '\n');
    }, 'update containers');
  }

  function cmdContainer(sh, io, args) {
    const sub = args[0], resto = args.slice(1);
    const mapa = {
      ls: cmdPs, list: cmdPs, ps: cmdPs, run: (s, i, a) => cmdRun(s, i, a, true),
      create: (s, i, a) => cmdRun(s, i, a, false), start: cmdStart,
      stop: (s, i, a) => cmdStop(s, i, a, 'stop'), kill: (s, i, a) => cmdStop(s, i, a, 'kill'),
      restart: cmdRestart, rm: cmdRm, logs: cmdLogs, exec: cmdExec, inspect: cmdInspect,
      top: cmdTop, stats: cmdStats, diff: cmdDiff, port: cmdPort, rename: cmdRename,
      cp: cmdCp, attach: cmdAttach, pause: (s, i, a) => cmdPausa(s, i, a, true),
      unpause: (s, i, a) => cmdPausa(s, i, a, false), wait: cmdWait,
      prune: (s, i, a) => cmdPrune(s, i, a, { containers: true })
    };
    if (mapa[sub]) return mapa[sub](sh, io, resto);
    io.stdout.write(`Usage:  docker container COMMAND\n\nManage containers\n\nCommands:\n  attach, cp, create, diff, exec, export, inspect, kill, logs, ls,\n  pause, port, prune, rename, restart, rm, run, start, stats, stop,\n  top, unpause, update, wait\n\n`);
    return 0;
  }

  /* -------------------------- inspect -------------------------- */
  async function cmdInspect(sh, io, args) {
    const e = eng(sh);
    const { opts, rest } = getopt(args, { f: 1, '--format': 1, s: 0, '--size': 0, '--type': 1 });
    if (!rest.length) { io.stderr.write(`"docker inspect" requires at least 1 argument.\n`); return 1; }
    const saida = [];
    let cod = 0;
    for (const nome of rest) {
      let obj = null;
      const tipo = opts['--type'];
      if (!tipo || tipo === 'container') {
        let c; try { c = e.achar(nome); } catch (err) { c = null; }
        if (c) { if (c.saudeConfig && c.rodando) { try { await e.avaliarSaude(c); } catch (err) { } } obj = jsonContainer(e, c); }
      }
      if (!obj && (!tipo || tipo === 'image')) { const i = e.imagemPorRef(nome); if (i) obj = jsonImagem(i); }
      if (!obj && (!tipo || tipo === 'network')) { const n = e.redePorNome(nome); if (n) obj = jsonRede(e, n); }
      if (!obj && (!tipo || tipo === 'volume')) { const v = e.volumes.get(nome); if (v) obj = jsonVolume(e, v); }
      if (!obj) { io.stderr.write(`Error: No such object: ${nome}\n`); cod = 1; continue; }
      saida.push(obj);
    }
    const fmt = opts.f || opts['--format'];
    if (fmt) {
      for (const o of saida) io.stdout.write(formatarGo(fmt, o) + '\n');
      return cod;
    }
    io.stdout.write(JSON.stringify(saida, null, 4) + '\n');
    return cod;
  }

  /* --format do inspect aceita caminhos aninhados e alguns helpers */
  function formatarGo(fmt, obj) {
    let s = String(fmt);
    /* {{json .Campo}} */
    s = s.replace(/\{\{\s*json\s+\.([A-Za-z0-9_.]*)\s*\}\}/g, (_, campo) => {
      let v = obj;
      for (const p of (campo ? campo.split('.') : [])) v = (v || {})[p];
      return JSON.stringify(v);
    });
    /* {{range ...}} simples sobre listas de strings */
    s = s.replace(/\{\{\s*range\s+\.([A-Za-z0-9_.]+)\s*\}\}(.*?)\{\{\s*end\s*\}\}/gs, (_, campo, corpo) => {
      let v = obj;
      for (const p of campo.split('.')) v = (v || {})[p];
      if (!v) return '';
      /* como no Go: percorrer um mapa entrega os VALORES, não os pares */
      const itens = Array.isArray(v) ? v : Object.values(v);
      return itens.map(it => corpo.replace(/\{\{\s*\.([A-Za-z0-9_.]*)\s*\}\}/g, (__, c2) => {
        if (!c2) return typeof it === 'object' ? JSON.stringify(it) : String(it);
        let vv = it;
        for (const p of c2.split('.')) vv = (vv || {})[p];
        return vv === undefined || vv === null ? '' : (typeof vv === 'object' ? JSON.stringify(vv) : String(vv));
      })).join('');
    });
    s = s.replace(/\{\{\s*\.([A-Za-z0-9_.]+)\s*\}\}/g, (_, campo) => {
      let v = obj;
      for (const p of campo.split('.')) {
        if (v === null || v === undefined) return '<no value>';
        v = v[p];
      }
      if (v === undefined || v === null) return '<no value>';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    });
    return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  function jsonContainer(e, c) {
    const img = e.imagens.get(c.imagemId) || { id: '', tagPrincipal: '' };
    const portas = {};
    for (const chave in c.expostas) portas[chave] = null;
    for (const p of c.portas) portas[`${p.contPort}/${p.proto}`] = [{ HostIp: p.hostIp, HostPort: String(p.hostPort) }];
    const redes = {};
    for (const [nome, cfg] of c.redes) {
      const r = e.networks.get(nome) || {};
      redes[nome] = {
        NetworkID: r.id || '', EndpointID: LX.dockerHex(64), Gateway: cfg.gateway || '',
        IPAddress: cfg.ip || '', IPPrefixLen: r.subnet ? +r.subnet.split('/')[1] : 0,
        MacAddress: cfg.ip ? '02:42:' + cfg.ip.split('.').map(n => (+n).toString(16).padStart(2, '0')).join(':') : '',
        Aliases: (cfg.aliases || []).concat(c.servico ? [c.servico] : []), DNSNames: c.nomesNaRede(nome)
      };
    }
    return {
      Id: c.id, Created: new Date(c.criadoEm).toISOString(),
      Path: (c.entrypoint[0] || c.cmd[0] || ''), Args: (c.entrypoint.slice(1) || []).concat(c.cmd || []),
      State: {
        Status: c.estado, Running: c.rodando, Paused: c.estado === 'paused',
        Restarting: c.estado === 'restarting', OOMKilled: !!c.oom, Dead: c.estado === 'dead',
        Pid: c.rodando ? 4000 + 1 : 0, ExitCode: c.saida, Error: c.erro || '',
        StartedAt: c.iniciadoEm ? new Date(c.iniciadoEm).toISOString() : '0001-01-01T00:00:00Z',
        FinishedAt: c.terminadoEm ? new Date(c.terminadoEm).toISOString() : '0001-01-01T00:00:00Z',
        Health: c.saudeConfig ? {
          Status: c.saude.estado, FailingStreak: c.saude.falhas,
          Log: c.saude.log.map(l => ({ Start: new Date(l.ts).toISOString(), End: new Date(l.ts + 40).toISOString(), ExitCode: l.codigo, Output: l.saida }))
        } : undefined
      },
      Image: img.id, Name: '/' + c.nome, RestartCount: c.reinicios,
      Driver: 'overlayfs', Platform: 'linux',
      HostConfig: {
        NetworkMode: Array.from(c.redes.keys())[0] || 'bridge',
        PortBindings: c.portas.reduce((a, p) => { a[`${p.contPort}/${p.proto}`] = [{ HostIp: p.hostIp === '0.0.0.0' ? '' : p.hostIp, HostPort: String(p.hostPort) }]; return a; }, {}),
        RestartPolicy: { Name: c.restart.politica, MaximumRetryCount: c.restart.maxTentativas },
        AutoRemove: !!c.autoRemover, Privileged: !!c.privilegiado, ReadonlyRootfs: !!c.somenteLeitura,
        CapAdd: c.capAdd, CapDrop: c.capDrop, SecurityOpt: c.securityOpt,
        Memory: c.recursos.memoria || 0, MemoryReservation: c.recursos.memoriaReserva || 0,
        NanoCpus: c.recursos.cpus ? Math.round(c.recursos.cpus * 1e9) : 0,
        PidsLimit: c.recursos.pidsLimit || null,
        Binds: c.montagens.filter(m => m.tipo !== 'tmpfs').map(m => `${m.tipo === 'volume' ? m.nome : m.origem}:${m.destino}${m.ro ? ':ro' : ''}`)
      },
      Mounts: c.montagens.map(m => ({
        Type: m.tipo, Name: m.nome, Source: m.origem || '', Destination: m.destino,
        Driver: m.tipo === 'volume' ? 'local' : undefined, Mode: '', RW: !m.ro, Propagation: m.tipo === 'bind' ? 'rprivate' : ''
      })),
      Config: {
        Hostname: c.hostname, User: c.usuario === 'root' ? '' : c.usuario,
        ExposedPorts: Object.keys(c.expostas).reduce((a, k) => { a[k] = {}; return a; }, {}),
        Tty: !!c.tty, OpenStdin: !!c.interativo,
        Env: Object.entries(c.env).filter(([k]) => !(c.envDeArquivo && c.envDeArquivo.has(k))).map(([k, v]) => `${k}=${v}`),
        Cmd: c.cmd.length ? c.cmd : null, Entrypoint: c.entrypoint.length ? c.entrypoint : null,
        Image: c.imagemRef, WorkingDir: c.workdir === '/' ? '' : c.workdir,
        Labels: c.labels, StopSignal: c.stopSignal,
        Healthcheck: c.saudeConfig || undefined
      },
      NetworkSettings: {
        Ports: portas, IPAddress: c.ip,
        Gateway: (Array.from(c.redes.values())[0] || {}).gateway || '',
        Networks: redes
      }
    };
  }

  function jsonImagem(img) {
    return {
      Id: img.id, RepoTags: Array.from(img.tags), RepoDigests: Array.from(img.tags).map(t => t.split(':')[0] + '@' + img.digest),
      Created: new Date(img.criadaEm).toISOString(), Size: img.tamanho, Architecture: img.arch, Os: img.os,
      Author: img.autor, DockerVersion: '29.7.0',
      Config: {
        Cmd: img.config.Cmd, Entrypoint: img.config.Entrypoint, Env: img.config.Env,
        ExposedPorts: img.config.ExposedPorts, WorkingDir: img.config.WorkingDir,
        User: img.config.User, Labels: img.config.Labels, Volumes: img.config.Volumes,
        StopSignal: img.config.StopSignal, Healthcheck: img.config.Healthcheck || undefined
      },
      RootFS: { Type: 'layers', Layers: img.camadas.map(c => c.id) },
      Metadata: { LastTagTime: new Date(img.criadaEm).toISOString() }
    };
  }

  function jsonRede(e, r) {
    const cont = {};
    for (const [cid, cfg] of r.containers) {
      const c = e.containers.get(cid);
      if (!c) continue;
      cont[cid] = {
        Name: c.nome, EndpointID: LX.dockerHex(64),
        MacAddress: cfg.ip ? '02:42:' + cfg.ip.split('.').map(n => (+n).toString(16).padStart(2, '0')).join(':') : '',
        IPv4Address: cfg.ip ? cfg.ip + '/' + (r.subnet ? r.subnet.split('/')[1] : '16') : '', IPv6Address: ''
      };
    }
    return {
      Name: r.nome, Id: r.id, Created: new Date(r.criadaEm).toISOString(), Scope: r.escopo,
      Driver: r.driver, EnableIPv6: false,
      IPAM: { Driver: 'default', Options: null, Config: r.subnet ? [{ Subnet: r.subnet, Gateway: r.gateway }] : [] },
      Internal: !!r.interno, Attachable: !!r.attachable, Ingress: false,
      Containers: cont, Options: {}, Labels: r.labels || {}
    };
  }

  function jsonVolume(e, v) {
    return {
      CreatedAt: new Date(v.criadoEm).toISOString(), Driver: v.driver, Labels: v.labels,
      Mountpoint: v.montagem, Name: v.nome, Options: v.opcoes, Scope: v.escopo,
      UsageData: { Size: e.tamanhoVolume(v.nome), RefCount: e.volumeEmUso(v.nome).length }
    };
  }

  /* -------------------------- volumes -------------------------- */
  function cmdVolume(sh, io, args) {
    const e = eng(sh);
    const sub = args[0], resto = args.slice(1);
    if (sub === 'create') {
      const { opts, rest } = getopt(resto, { d: 1, '--driver': 1, '--label': 1, o: 1, '--opt': 1 });
      const v = e.criarVolume(rest[0] || undefined, { driver: opts.d || opts['--driver'] });
      io.stdout.write(v.nome + '\n');
      return 0;
    }
    if (sub === 'ls' || sub === 'list') {
      const { opts } = getopt(resto, { q: 0, '--quiet': 0, '--format': 1, '--filter': 1, f: 1 });
      let lista = Array.from(e.volumes.values());
      const filtro = opts['--filter'] || opts.f;
      if (filtro === 'dangling=true') lista = lista.filter(v => !e.volumeEmUso(v.nome).length);
      if (filtro === 'dangling=false') lista = lista.filter(v => e.volumeEmUso(v.nome).length);
      if (opts.q || opts['--quiet']) { for (const v of lista) io.stdout.write(v.nome + '\n'); return 0; }
      if (opts['--format']) { for (const v of lista) io.stdout.write(aplicarFormato(opts['--format'], { Name: v.nome, Driver: v.driver, Mountpoint: v.montagem, Scope: v.escopo }) + '\n'); return 0; }
      tabela(io, ['DRIVER', 'VOLUME NAME'], lista.map(v => [v.driver, v.nome]));
      return 0;
    }
    if (sub === 'inspect') return cmdInspect(sh, io, ['--type', 'volume'].concat(resto));
    if (sub === 'rm' || sub === 'remove') {
      const { opts, rest } = getopt(resto, { f: 0, '--force': 0 });
      let cod = 0;
      for (const nome of rest) {
        const r = e.removerVolume(nome, { force: opts.f || opts['--force'] });
        if (!r.ok) { io.stderr.write(r.erro + '\n'); cod = 1; continue; }
        io.stdout.write(nome + '\n');
      }
      return cod;
    }
    if (sub === 'prune') {
      const { opts } = getopt(resto, { f: 0, a: 0, '--force': 0, '--all': 0 });
      const r = e.limpar({ volumes: true, todosVolumes: opts.a || opts['--all'] });
      io.stdout.write('Deleted Volumes:\n' + r.volumes.map(v => v + '\n').join('') + `\nTotal reclaimed space: ${humano(r.bytes)}\n`);
      return 0;
    }
    io.stdout.write(`Usage:  docker volume COMMAND\n\nManage volumes\n\nCommands:\n  create      Create a volume\n  inspect     Display detailed information on one or more volumes\n  ls          List volumes\n  prune       Remove unused local volumes\n  rm          Remove one or more volumes\n\n`);
    return 0;
  }

  /* -------------------------- redes -------------------------- */
  function cmdNetwork(sh, io, args) {
    const e = eng(sh);
    const sub = args[0], resto = args.slice(1);
    if (sub === 'create') {
      const { opts, rest } = getopt(resto, { d: 1, '--driver': 1, '--subnet': 1, '--gateway': 1, '--internal': 0, '--attachable': 0, '--label': 1 });
      const r = e.criarRede(rest[0], {
        driver: opts.d || opts['--driver'], subnet: opts['--subnet'], gateway: opts['--gateway'],
        interno: opts['--internal'], attachable: opts['--attachable']
      });
      if (!r.ok) { io.stderr.write(r.erro + '\n'); return 1; }
      io.stdout.write(r.rede.id + '\n');
      return 0;
    }
    if (sub === 'ls' || sub === 'list') {
      const { opts } = getopt(resto, { q: 0, '--quiet': 0, '--format': 1, '--filter': 1, f: 1, '--no-trunc': 0 });
      const lista = Array.from(e.networks.values());
      if (opts.q || opts['--quiet']) { for (const r of lista) io.stdout.write(r.id.slice(0, 12) + '\n'); return 0; }
      if (opts['--format']) { for (const r of lista) io.stdout.write(aplicarFormato(opts['--format'], { ID: r.id.slice(0, 12), Name: r.nome, Driver: r.driver, Scope: r.escopo }) + '\n'); return 0; }
      tabela(io, ['NETWORK ID', 'NAME', 'DRIVER', 'SCOPE'],
        lista.map(r => [opts['--no-trunc'] ? r.id : r.id.slice(0, 12), r.nome, r.driver, r.escopo]));
      return 0;
    }
    if (sub === 'inspect') return cmdInspect(sh, io, ['--type', 'network'].concat(resto));
    if (sub === 'rm' || sub === 'remove') {
      let cod = 0;
      for (const nome of resto.filter(a => !a.startsWith('-'))) {
        const r = e.removerRede(nome);
        if (!r.ok) { io.stderr.write(r.erro + '\n'); cod = 1; continue; }
        io.stdout.write(nome + '\n');
      }
      return cod;
    }
    if (sub === 'connect' || sub === 'disconnect') {
      const { opts, rest } = getopt(resto, { '--alias': 1, '--ip': 1, f: 0, '--force': 0 });
      let c; try { c = e.achar(rest[1]); } catch (err) { c = null; }
      if (!c) { io.stderr.write(`Error response from daemon: No such container: ${rest[1]}\n`); return 1; }
      const r = sub === 'connect'
        ? e.conectar(rest[0], c, { aliases: opts['--alias'] ? [opts['--alias']] : [], ip: opts['--ip'] })
        : e.desconectar(rest[0], c);
      if (!r.ok) { io.stderr.write(r.erro + '\n'); return 1; }
      return 0;
    }
    if (sub === 'prune') {
      const r = e.limpar({});
      io.stdout.write('Deleted Networks:\n' + r.redes.map(n => n + '\n').join('') + '\n');
      return 0;
    }
    io.stdout.write(`Usage:  docker network COMMAND\n\nManage networks\n\nCommands:\n  connect     Connect a container to a network\n  create      Create a network\n  disconnect  Disconnect a container from a network\n  inspect     Display detailed information on one or more networks\n  ls          List networks\n  prune       Remove all unused networks\n  rm          Remove one or more networks\n\n`);
    return 0;
  }

  /* -------------------------- system -------------------------- */
  function cmdSystem(sh, io, args) {
    const sub = args[0], resto = args.slice(1);
    if (sub === 'df') return cmdDf(sh, io, resto);
    if (sub === 'prune') return cmdPrune(sh, io, resto, { containers: true, redes: true, imagens: true, cache: true });
    if (sub === 'info') return cmdInfo(sh, io);
    if (sub === 'events') return cmdEvents(sh, io, resto);
    io.stdout.write(`Usage:  docker system COMMAND\n\nManage Docker\n\nCommands:\n  df          Show docker disk usage\n  events      Get real time events from the server\n  info        Display system-wide information\n  prune       Remove unused data\n\n`);
    return 0;
  }

  function cmdDf(sh, io, args) {
    const e = eng(sh);
    const { opts } = getopt(args, { v: 0, '--verbose': 0, '--format': 1 });
    const d = e.df();
    const pct = (rec, tot) => tot ? Math.round(rec / tot * 100) : 0;
    tabela(io, ['TYPE', 'TOTAL', 'ACTIVE', 'SIZE', 'RECLAIMABLE'], [
      ['Images', d.imagens.total, d.imagens.ativos, humano(d.imagens.tamanho), `${humano(d.imagens.recuperavel)} (${pct(d.imagens.recuperavel, d.imagens.tamanho)}%)`],
      ['Containers', d.containers.total, d.containers.ativos, humano(d.containers.tamanho), `${humano(d.containers.recuperavel)} (${pct(d.containers.recuperavel, d.containers.tamanho)}%)`],
      ['Local Volumes', d.volumes.total, d.volumes.ativos, humano(d.volumes.tamanho), `${humano(d.volumes.recuperavel)} (${pct(d.volumes.recuperavel, d.volumes.tamanho)}%)`],
      ['Build Cache', d.cache.total, d.cache.ativos, humano(d.cache.tamanho), humano(d.cache.recuperavel)]
    ]);
    if (opts.v || opts['--verbose']) {
      io.stdout.write('\nImages space usage:\n\n');
      tabela(io, ['REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE', 'SHARED SIZE', 'UNIQUE SIZE', 'CONTAINERS'],
        listarImagens(e, {}).map(l => {
          const usados = Array.from(e.containers.values()).filter(c => c.imagemId === l.imagem.id).length;
          const comuns = l.imagem.camadas.filter(cam =>
            Array.from(e.imagens.values()).some(o => o !== l.imagem && o.camadas.some(x => x.id === cam.id)));
          const compartilhado = comuns.reduce((a, c) => a + c.tamanho, 0);
          return [l.Repository, l.Tag, l.ID, l.CreatedSince, l.Size, humano(compartilhado), humano(l.imagem.tamanho - compartilhado), usados];
        }));
      io.stdout.write('\nContainers space usage:\n\n');
      tabela(io, ['CONTAINER ID', 'IMAGE', 'COMMAND', 'LOCAL VOLUMES', 'SIZE', 'CREATED', 'STATUS', 'NAMES'],
        Array.from(e.containers.values()).map(c => [c.curto, c.imagemRef, `"${(c.entrypoint.concat(c.cmd)).join(' ').slice(0, 18)}"`,
          c.montagens.filter(m => m.tipo === 'volume').length, humano(e.diff(c).length * 4096), idade(c.criadoEm), c.status, c.nome]));
      io.stdout.write('\nLocal Volumes space usage:\n\n');
      tabela(io, ['VOLUME NAME', 'LINKS', 'SIZE'],
        Array.from(e.volumes.keys()).map(n => [n, e.volumeEmUso(n).length, humano(e.tamanhoVolume(n))]));
    }
    return 0;
  }

  async function cmdPrune(sh, io, args, escopo) {
    const e = eng(sh);
    const { opts } = getopt(args, { f: 0, a: 0, '--force': 0, '--all': 0, '--volumes': 0, '--filter': 1 });
    const todas = opts.a || opts['--all'];
    const comVolumes = opts['--volumes'];
    if (!(opts.f || opts['--force'])) {
      const partes = [];
      if (escopo.containers) partes.push('  - all stopped containers');
      if (escopo.redes) partes.push('  - all networks not used by at least one container');
      if (comVolumes) partes.push('  - all anonymous volumes not used by at least one container');
      if (escopo.imagens) partes.push(todas ? '  - all images without at least one container associated to them' : '  - unused build cache');
      if (escopo.imagens && !todas) partes.unshift('  - all dangling images');
      io.stdout.write(`WARNING! This will remove:\n${partes.join('\n')}\n${comVolumes ? '' : (escopo.containers ? '\nItems to be pruned will be permanently removed. Are you sure you want to continue? [y/N] ' : '')}`);
      if (!comVolumes && escopo.containers) {
        const r = io.term && io.term.readLine ? await io.term.readLine() : 'y';
        if (!/^(y|s|sim|yes)$/i.test(String(r || '').trim())) { io.stdout.write('\n'); return 0; }
      }
    }
    const r = e.limpar({
      todas, volumes: comVolumes, todosVolumes: comVolumes && todas
    });
    if (escopo.containers && r.containers.length) io.stdout.write('Deleted Containers:\n' + r.containers.map(x => x + '\n').join('') + '\n');
    if (escopo.redes && r.redes.length) io.stdout.write('Deleted Networks:\n' + r.redes.map(x => x + '\n').join('') + '\n');
    if (comVolumes && r.volumes.length) io.stdout.write('Deleted Volumes:\n' + r.volumes.map(x => x + '\n').join('') + '\n');
    if (escopo.imagens && r.imagens.length) io.stdout.write('Deleted Images:\n' + r.imagens.map(x => 'untagged: ' + x + '\n').join('') + '\n');
    io.stdout.write(`Total reclaimed space: ${humano(r.bytes)}\n`);
    return 0;
  }

  LX.dockerTabela = tabela;
  LX.dockerIdade = idade;
  LX.dockerFormato = aplicarFormato;
  LX.dockerFormatoGo = formatarGo;
  LX.dockerRodarNoContainer = rodarNoContainer;
  LX.dockerImprimirLogs = imprimirLogs;
  LX.dockerAnalisarVolume = analisarVolumeCurto;
  LX.dockerAnalisarPorta = analisarPorta;
})();
