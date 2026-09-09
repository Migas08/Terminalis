/* =========================================================================
   TERMINALIS — rede: ip, ping, ss, curl, dig, ssh, scp, rsync
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, SysError, defcmd, getopt, C } = LX;
  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }

  /* Resposta HTTP de um listener local (serviço do sistema ou container) */
  LX.httpRequest = function (machine, host, port, path, method, req = {}) {
    let conn;
    try { conn = machine.connect(host, port); }
    catch (e) { throw e; }
    /* O cabeçalho Host é o que um proxy reverso usa para escolher a rota.
       Sem ele, Traefik e afins não teriam como saber qual site foi pedido. */
    const pedido = Object.assign({ host, porta: port, metodo: method || 'GET', tls: port === 443, cabecalhos: {} }, req);
    if (!pedido.cabecalhos.Host) pedido.cabecalhos.Host = host;
    if (conn.remote) {
      const route = conn.remote.routes[path] || conn.remote.routes[path.replace(/\/$/, '')] ||
        conn.remote.routes[path + '/'] || conn.remote.routes['/nao-existe'];
      if (!route) return { status: 404, type: 'text/html', body: '<html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>\n', server: 'nginx' };
      return Object.assign({ server: 'nginx/1.24.0' }, route);
    }
    const l = conn.listener;
    if (l.http) {
      const r = l.http(path, method, pedido);
      /* falha de validação do certificado: o cliente é quem recusa */
      if (r && r.__erro) throw r.__erro;
      return r;
    }
    if (l.container && machine.docker) return machine.docker.serve(l, path, method, pedido);
    if (l.unit) {
      const pkgName = l.unit.replace('.service', '');
      const meta = machine.packages.get(pkgName) || machine.aptCache.get(pkgName);
      if (meta && meta.http) return meta.http(machine, path);
    }
    if (l.port === 22) { const e = new Error('empty reply'); e.code = 'EMPTYREPLY'; throw e; }
    return { status: 200, type: 'text/plain', body: `resposta do serviço ${l.process} na porta ${l.port}\n`, server: l.process };
  };

  /* ================================ ip ================================ */
  defcmd({
    name: 'ip', path: '/usr/bin/ip', pkg: 'iproute2',
    run: async ({ sh, io, args }) => {
      const positional = args.filter(a => !a.startsWith('-'));
      const objRaw = (positional[0] || 'help').toLowerCase();
      const obj = { a: 'addr', ad: 'addr', add: 'addr', addr: 'addr', address: 'addr', l: 'link', li: 'link', link: 'link', r: 'route', ro: 'route', route: 'route', n: 'neigh', neigh: 'neigh', ne: 'neigh' }[objRaw] || objRaw;
      const verb = (positional[1] || 'show').toLowerCase();
      const brief = args.includes('-br') || args.includes('-brief');
      // "ip a show eth0", "ip a show dev eth0", "ip -br a eth0"
      let alvoDev = null;
      for (let k = 1; k < positional.length; k++) {
        const t = positional[k];
        if (['show', 'list', 'dev', 'add', 'del', 'set', 'get', 'up', 'down'].includes(t)) continue;
        if (sh.m.interfaces.some(i => i.name === t)) { alvoDev = t; break; }
      }
      const verbosMutantes = ['add', 'del', 'delete', 'set', 'get'];
      const ifaces = (alvoDev && !verbosMutantes.includes(verb))
        ? sh.m.interfaces.filter(i => i.name === alvoDev)
        : sh.m.interfaces;
      if (obj === 'addr') {
        if (verb === 'add' || verb === 'del') {
          if (sh.uid !== 0) { io.stderr.write('RTNETLINK answers: Operation not permitted\n'); return 2; }
          const cidr = positional[2];
          const devIdx = positional.indexOf('dev');
          const devNome = devIdx >= 0 ? positional[devIdx + 1] : 'eth0';
          const iface = ifaces.find(i => i.name === devNome);
          if (!iface) { io.stderr.write(`Cannot find device "${devNome}"\n`); return 1; }
          if (!cidr || !/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(cidr)) { io.stderr.write('Error: any valid prefix is expected rather than "".\n'); return 1; }
          iface.extras = iface.extras || [];
          if (verb === 'add') {
            if (iface.ipv4 === cidr || iface.extras.includes(cidr)) { io.stderr.write('RTNETLINK answers: File exists\n'); return 2; }
            iface.extras.push(cidr);
          } else {
            if (iface.ipv4 === cidr) { iface.ipv4 = iface.extras.shift() || '0.0.0.0/0'; }
            else {
              const k = iface.extras.indexOf(cidr);
              if (k < 0) { io.stderr.write('RTNETLINK answers: Cannot assign requested address\n'); return 2; }
              iface.extras.splice(k, 1);
            }
          }
          return 0;
        }
        if (brief) {
          for (const i of ifaces) io.stdout.write(`${i.name.padEnd(12)}${i.state.padEnd(9)}${[i.ipv4].concat(i.extras || []).join(' ')} ${i.ipv6 ? i.ipv6 : ''}\n`);
          return 0;
        }
        ifaces.forEach((i) => {
          const idx = sh.m.interfaces.indexOf(i);
          io.stdout.write(`${idx + 1}: ${C.bold}${i.name}${C.reset}: <${i.flags}> mtu ${i.mtu} qdisc ${i.name === 'lo' ? 'noqueue' : 'fq_codel'} state ${i.state} group default qlen 1000\n`);
          io.stdout.write(`    link/${i.name === 'lo' ? 'loopback' : 'ether'} ${i.mac} brd ${i.name === 'lo' ? '00:00:00:00:00:00' : 'ff:ff:ff:ff:ff:ff'}\n`);
          io.stdout.write(`    inet ${i.ipv4} ${i.name === 'lo' ? 'scope host lo' : 'brd ' + i.ipv4.split('.').slice(0, 3).join('.') + '.255 scope global dynamic ' + i.name}\n`);
          io.stdout.write(`       valid_lft ${i.name === 'lo' ? 'forever' : '84213sec'} preferred_lft ${i.name === 'lo' ? 'forever' : '84213sec'}\n`);
          for (const extra of (i.extras || [])) {
            io.stdout.write(`    inet ${extra} brd ${extra.split('/')[0].split('.').slice(0, 3).join('.')}.255 scope global secondary ${i.name}\n       valid_lft forever preferred_lft forever\n`);
          }
          if (i.ipv6) { io.stdout.write(`    inet6 ${i.ipv6} scope ${i.name === 'lo' ? 'host' : 'link'} \n       valid_lft forever preferred_lft forever\n`); }
        });
        if (sh.m.docker && sh.m.docker.networks.size) {
          const n = 3;
          io.stdout.write(`${ifaces.length + 1}: ${C.bold}docker0${C.reset}: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default \n    link/ether 02:42:1f:8a:0c:3e brd ff:ff:ff:ff:ff:ff\n    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0\n       valid_lft forever preferred_lft forever\n`);
        }
        return 0;
      }
      if (obj === 'link') {
        if (verb === 'set') {
          if (sh.uid !== 0) { io.stderr.write('RTNETLINK answers: Operation not permitted\n'); return 2; }
          const devNome = positional[2] === 'dev' ? positional[3] : positional[2];
          const estado = positional[positional.length - 1];
          const iface = ifaces.find(i => i.name === devNome);
          if (!iface) { io.stderr.write(`Cannot find device "${devNome}"\n`); return 1; }
          if (estado === 'up') {
            iface.state = iface.name === 'lo' ? 'UNKNOWN' : 'UP';
            iface.flags = iface.flags.replace(/,?NO-CARRIER/g, '');
            if (!/\bUP\b/.test(iface.flags)) iface.flags = iface.flags.replace('BROADCAST', 'BROADCAST').concat(',UP,LOWER_UP');
            sh.m.log('kernel', `${iface.name}: Link is Up - 1Gbps/Full`, 6, 0);
          } else if (estado === 'down') {
            iface.state = 'DOWN';
            iface.flags = iface.flags.replace(/,?UP/g, '').replace(/,?LOWER_UP/g, '');
            if (!/NO-CARRIER/.test(iface.flags)) iface.flags = 'NO-CARRIER,' + iface.flags;
            sh.m.log('kernel', `${iface.name}: Link is Down`, 4, 0);
          } else if (positional.includes('mtu')) {
            iface.mtu = +positional[positional.indexOf('mtu') + 1] || iface.mtu;
          }
          return 0;
        }
        ifaces.forEach((i) => {
          const idx = sh.m.interfaces.indexOf(i);
          if (brief) { io.stdout.write(`${i.name.padEnd(12)}${i.state.padEnd(9)}${i.mac}  <${i.flags}>\n`); return; }
          io.stdout.write(`${idx + 1}: ${i.name}: <${i.flags}> mtu ${i.mtu} qdisc ${i.name === 'lo' ? 'noqueue' : 'fq_codel'} state ${i.state} mode DEFAULT group default qlen 1000\n    link/${i.name === 'lo' ? 'loopback' : 'ether'} ${i.mac} brd ${i.name === 'lo' ? '00:00:00:00:00:00' : 'ff:ff:ff:ff:ff:ff'}\n`);
        });
        return 0;
      }
      if (obj === 'route') {
        if (verb === 'add' || verb === 'del' || verb === 'delete') {
          if (sh.uid !== 0) { io.stderr.write('RTNETLINK answers: Operation not permitted\n'); return 2; }
          const dst = positional[2];
          const viaIdx = positional.indexOf('via');
          const devIdx = positional.indexOf('dev');
          const via = viaIdx >= 0 ? positional[viaIdx + 1] : null;
          const dev = devIdx >= 0 ? positional[devIdx + 1] : 'eth0';
          if (!dst) { io.stderr.write('Error: either "to" is duplicate, or "" is a garbage.\n'); return 1; }
          if (verb === 'add') {
            if (sh.m.routes.find(r => r.dst === dst)) { io.stderr.write('RTNETLINK answers: File exists\n'); return 2; }
            sh.m.routes.push({ dst, via, dev, proto: 'static', scope: via ? 'global' : 'link', src: sh.m.primaryIp(), metric: 100 });
          } else {
            const k = sh.m.routes.findIndex(r => r.dst === dst);
            if (k < 0) { io.stderr.write('RTNETLINK answers: No such process\n'); return 2; }
            sh.m.routes.splice(k, 1);
          }
          return 0;
        }
        if (verb === 'get') {
          const alvo = positional[2];
          if (!alvo) { io.stderr.write('Error: an inet address is expected rather than "".\n'); return 1; }
          const ip = /^\d+\.\d+\.\d+\.\d+$/.test(alvo) ? alvo : sh.m.resolve(alvo);
          if (!ip) { io.stderr.write(`Error: any valid prefix is expected rather than "${alvo}".\n`); return 1; }
          const local = sh.m.routes.find(r => {
            if (r.dst === 'default') return false;
            const [rede, bits] = r.dst.split('/');
            const pref = rede.split('.').slice(0, Math.floor(+bits / 8)).join('.');
            return ip.startsWith(pref + '.') || ip === rede;
          });
          if (local) io.stdout.write(`${ip} dev ${local.dev} src ${sh.m.primaryIp()} uid ${sh.uid} \n    cache \n`);
          else {
            const def = sh.m.routes.find(r => r.dst === 'default');
            if (!def) { io.stderr.write(`RTNETLINK answers: Network is unreachable\n`); return 2; }
            io.stdout.write(`${ip} via ${def.via} dev ${def.dev} src ${sh.m.primaryIp()} uid ${sh.uid} \n    cache \n`);
          }
          return 0;
        }
        for (const r of sh.m.routes) {
          if (r.dst === 'default') io.stdout.write(`default via ${r.via} dev ${r.dev} proto ${r.proto} src ${sh.m.primaryIp()} metric ${r.metric} \n`);
          else if (r.via) io.stdout.write(`${r.dst} via ${r.via} dev ${r.dev} proto ${r.proto} metric ${r.metric || 100} \n`);
          else io.stdout.write(`${r.dst} dev ${r.dev} proto ${r.proto} scope ${r.scope} src ${r.src} metric 100 \n`);
        }
        if (sh.m.docker && sh.m.docker.networks.size) io.stdout.write(`172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1 linkdown \n`);
        return 0;
      }
      if (obj === 'neigh') {
        for (const a of sh.m.arp) io.stdout.write(`${a.ip} dev ${a.dev} lladdr ${a.mac} ${a.state}\n`);
        return 0;
      }
      io.stdout.write(`Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }
where  OBJECT := { address | link | route | neigh | ... }

Exemplos:
  ip addr show          (ou "ip a")  — mostra os endereços IP
  ip -br addr           versão resumida
  ip link show          (ou "ip l")  — mostra as interfaces
  ip route show         (ou "ip r")  — mostra a tabela de rotas
  ip neigh              tabela ARP (vizinhos)

Observação: 'ip' substitui os antigos ifconfig, route e arp (net-tools).
`);
      return 0;
    }
  });

  defcmd({
    name: 'resolvectl', path: '/usr/bin/resolvectl', pkg: 'systemd', run: async ({ sh, io, args }) => {
      const verbo = (args[0] || 'status').toLowerCase();
      if (verbo === 'query' || verbo === 'q') {
        const nome = args[1];
        if (!nome) { io.stderr.write('resolvectl: falta o nome a consultar\n'); return 1; }
        const ip = sh.m.resolve(nome);
        if (!ip) { io.stderr.write(`${nome}: Name or service not known\n`); return 4; }
        io.stdout.write(`${nome}: ${ip}\n\n-- Information acquired via protocol DNS in 12.4ms.\n-- Data is authenticated: no\n`);
        return 0;
      }
      if (verbo === 'flush-caches') { io.stdout.write(''); return 0; }
      if (verbo === 'statistics') { io.stdout.write('DNSSEC supported by current servers: no\n\nTransactions\nCurrent Transactions: 0\n  Total Transactions: 412\n\nCache\n  Current Cache Size: 18\n          Cache Hits: 233\n        Cache Misses: 179\n'); return 0; }
      const dns = (() => {
        try {
          const conf = sh.m.fs.readFile('/etc/resolv.conf', { ctx: sh.m.ctxRoot() });
          const l = conf.split('\n').filter(x => /^nameserver/.test(x.trim())).map(x => x.trim().split(/\s+/)[1]);
          return l.length ? l : ['127.0.0.53'];
        } catch (e) { return ['127.0.0.53']; }
      })();
      io.stdout.write(`Global\n       Protocols: -LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported\nresolv.conf mode: stub\n\nLink 2 (eth0)\n    Current Scopes: DNS\n         Protocols: +DefaultRoute\nCurrent DNS Server: ${dns[0]}\n       DNS Servers: ${dns.join(' ')}\n        DNS Domain: lan\n`);
      return 0;
    }
  });

  defcmd({
    name: 'arp', path: '/usr/sbin/arp', pkg: 'net-tools', run: async ({ sh, io, args }) => {
      io.stderr.write(`${C.yellow}Aviso: arp faz parte do net-tools, obsoleto. Use "ip neigh".${C.reset}\n`);
      io.stdout.write('Address                  HWtype  HWaddress           Flags Mask            Iface\n');
      for (const a of sh.m.arp) io.stdout.write(`${a.ip.padEnd(24)} ether   ${a.mac}   C                     ${a.dev}\n`);
      return 0;
    }
  });

  defcmd({
    name: 'ifconfig', path: '/sbin/ifconfig', pkg: 'net-tools',
    run: async ({ sh, io, args }) => {
      io.stderr.write(`${C.yellow}Aviso: ifconfig faz parte do pacote net-tools, que está obsoleto. Use "ip addr".${C.reset}\n`);
      for (const i of sh.m.interfaces) {
        const [ip, cidr] = i.ipv4.split('/');
        const mask = cidrToMask(+cidr);
        io.stdout.write(`${i.name}: flags=${i.name === 'lo' ? '73<UP,LOOPBACK,RUNNING>' : '4163<UP,BROADCAST,RUNNING,MULTICAST>'}  mtu ${i.mtu}\n`);
        io.stdout.write(`        inet ${ip}  netmask ${mask}  ${i.name === 'lo' ? '' : 'broadcast ' + ip.split('.').slice(0, 3).join('.') + '.255'}\n`);
        io.stdout.write(`        ${i.name === 'lo' ? 'loop' : 'ether ' + i.mac} txqueuelen 1000  (${i.name === 'lo' ? 'Local Loopback' : 'Ethernet'})\n`);
        io.stdout.write(`        RX packets ${Math.round(i.rx / 900)}  bytes ${i.rx} (${(i.rx / 1e6).toFixed(1)} MB)\n        TX packets ${Math.round(i.tx / 900)}  bytes ${i.tx} (${(i.tx / 1e6).toFixed(1)} MB)\n\n`);
      }
      return 0;
    }
  });
  function cidrToMask(bits) {
    const m = [];
    for (let i = 0; i < 4; i++) { const n = Math.min(8, Math.max(0, bits - i * 8)); m.push(256 - Math.pow(2, 8 - n)); }
    return m.join('.');
  }

  defcmd({
    name: 'ping', path: '/usr/bin/ping', pkg: 'iputils-ping',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { c: 1, i: 1, W: 1, s: 1, n: 0, q: 0, '4': 0, '6': 0 });
      const host = rest[0];
      if (!host) { io.stderr.write('ping: usage error: Destination address required\n'); return 2; }
      const ip = sh.m.resolve(host);
      if (!ip) { io.stderr.write(`ping: ${host}: Name or service not known\n`); return 2; }
      const count = opts.c ? +opts.c : 4;
      const size = opts.s ? +opts.s : 56;
      let sent = 0, recv = 0;
      const times = [];
      const eth = (sh.m.interfaces || []).find(i => i.name !== 'lo');
      const linkDown = !!eth && eth.state === 'DOWN';
      const semRota = !sh.m.routes.some(r => r.dst === 'default');
      if (ip !== '127.0.0.1' && linkDown) {
        io.stderr.write(`ping: connect: Network is unreachable\n`);
        return 2;
      }
      if (ip !== '127.0.0.1' && semRota && !/^10\.0\.2\./.test(ip)) {
        io.stderr.write(`ping: connect: Network is unreachable\n`);
        return 2;
      }
      io.stdout.write(`PING ${host} (${ip}) ${size}(${size + 28}) bytes of data.\n`);
      const reachable = sh.m.ipAlcancavel(ip) || sh.m.dns.has(host) || !!LX.INTERNET[host] ||
        (sh.m.docker && sh.m.docker.resolveAny && !!sh.m.docker.resolveAny(host));
      for (let i = 0; i < count; i++) {
        if (io.term && io.term.aborted) break;
        sent++;
        await new Promise(r => setTimeout(r, i === 0 ? 60 : 300));
        if (sh.m.netDown) { io.stdout.write(`From ${sh.m.primaryIp()} icmp_seq=${i + 1} Destination Host Unreachable\n`); continue; }
        if (!reachable) { continue; }
        const t = ip === '127.0.0.1' ? 0.03 + Math.random() * 0.02 : (LX.INTERNET[host] ? 8 + Math.random() * 12 : 0.4 + Math.random() * 0.6);
        times.push(t);
        recv++;
        io.stdout.write(`${size + 8} bytes from ${host === ip ? ip : host + ' (' + ip + ')'}: icmp_seq=${i + 1} ttl=${ip === '127.0.0.1' ? 64 : 55} time=${t.toFixed(t < 1 ? 3 : 1)} ms\n`);
      }
      const loss = sent ? Math.round((sent - recv) / sent * 100) : 100;
      io.stdout.write(`\n--- ${host} ping statistics ---\n`);
      io.stdout.write(`${sent} packets transmitted, ${recv} received, ${loss}% packet loss, time ${sent * 300}ms\n`);
      if (times.length) {
        const min = Math.min(...times), max = Math.max(...times), avg = times.reduce((a, b) => a + b, 0) / times.length;
        io.stdout.write(`rtt min/avg/max/mdev = ${min.toFixed(3)}/${avg.toFixed(3)}/${max.toFixed(3)}/${(max - min).toFixed(3)} ms\n`);
      }
      return recv > 0 ? 0 : 1;
    }
  });

  defcmd({
    name: 'ss', path: '/usr/bin/ss', pkg: 'iproute2',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { t: 0, u: 0, l: 0, n: 0, p: 0, a: 0, s: 0, '4': 0, '6': 0 });
      const flat = args.join('');
      const wantTcp = flat.includes('t') || (!flat.includes('u'));
      const wantUdp = flat.includes('u');
      const listening = flat.includes('l');
      const showProc = flat.includes('p');
      if (flat.includes('s')) {
        io.stdout.write(`Total: 218\nTCP:   6 (estab 1, closed 0, orphaned 0, timewait 0)\n\nTransport Total     IP        IPv6\nRAW\t  1         0         1        \nUDP\t  4         3         1        \nTCP\t  6         5         1        \n`);
        return 0;
      }
      let list = sh.m.listeners.slice();
      if (sh.m.docker) list = list.concat(sh.m.docker.hostListeners());
      list = list.filter(l => (l.proto === 'tcp' && wantTcp) || (l.proto === 'udp' && wantUdp));
      // filtro tipo: ss -tlnp 'sport = :80'
      const filter = rest.join(' ');
      const fm = /:(\d+)/.exec(filter);
      if (fm) list = list.filter(l => l.port === +fm[1]);
      io.stdout.write(`State      Recv-Q     Send-Q          Local Address:Port           Peer Address:Port    ${showProc ? 'Process' : ''}\n`);
      for (const l of list) {
        const addr = l.addr === '0.0.0.0' ? '0.0.0.0' : l.addr;
        const state = l.proto === 'udp' ? 'UNCONN' : 'LISTEN';
        io.stdout.write(`${state.padEnd(10)} ${'0'.padStart(5)} ${String(l.proto === 'tcp' ? 4096 : 0).padStart(10)} ${(addr + ':' + l.port).padStart(28)} ${'0.0.0.0:*'.padStart(22)}    ${showProc ? `users:(("${l.process}",pid=${l.pid},fd=3))` : ''}\n`);
      }
      if (!listening) {
        io.stdout.write(`ESTAB      ${'0'.padStart(5)} ${'0'.padStart(10)} ${(sh.m.primaryIp() + ':22').padStart(28)} ${'10.0.2.2:51422'.padStart(22)}    ${showProc ? 'users:(("sshd",pid=812,fd=4))' : ''}\n`);
      }
      return 0;
    }
  });

  defcmd({
    name: 'netstat', path: '/bin/netstat', pkg: 'net-tools',
    run: async ({ sh, io, args }) => {
      io.stderr.write(`${C.yellow}Aviso: netstat (net-tools) está obsoleto. Use "ss" — mais rápido e mantido.${C.reset}\n`);
      const flat = args.join('');
      let list = sh.m.listeners.slice();
      if (sh.m.docker) list = list.concat(sh.m.docker.hostListeners());
      io.stdout.write('Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\n');
      for (const l of list) {
        io.stdout.write(`${l.proto.padEnd(6)}${'0'.padStart(6)} ${'0'.padStart(6)} ${(l.addr + ':' + l.port).padEnd(23)} ${'0.0.0.0:*'.padEnd(23)} ${(l.proto === 'tcp' ? 'LISTEN' : '').padEnd(11)} ${flat.includes('p') ? l.pid + '/' + l.process : '-'}\n`);
      }
      return 0;
    }
  });

  /* ================================ curl / wget ================================ */
  defcmd({
    name: 'curl', pkg: 'curl',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, {
        o: 1, O: 0, s: 0, S: 0, L: 0, I: 0, v: 0, k: 0, f: 0, i: 0, X: 1, H: 1, d: 1, u: 1, w: 1,
        '--output': 1, '--silent': 1, '--head': 0, '--location': 0, '--request': 1, '--data': 1, '--fail': 0, '--verbose': 0, '--max-time': 1, '--connect-timeout': 1, '--write-out': 1
      });
      let url = rest[0];
      if (!url) { io.stderr.write('curl: try \'curl --help\' or \'curl --manual\' for more information\n'); return 2; }
      if (!/^https?:\/\//.test(url)) url = 'http://' + url;
      const m = /^https?:\/\/([^\/:?#]+)(?::(\d+))?([^?#]*)/.exec(url);
      if (!m) { io.stderr.write(`curl: (3) URL rejected: Bad hostname\n`); return 3; }
      const host = m[1];
      const port = m[2] ? +m[2] : (url.startsWith('https') ? 443 : 80);
      const path = m[3] || '/';
      const silent = opts.s || opts['--silent'];
      if (opts.v || opts['--verbose']) {
        const ip = sh.m.resolve(host);
        io.stderr.write(`*   Trying ${ip || '???'}:${port}...\n`);
      }
      /* -H pode repetir; getopt guarda o último, então relemos os args */
      const cabecalhos = {};
      for (let i = 0; i < args.length; i++) {
        let h = null;
        if ((args[i] === '-H' || args[i] === '--header') && args[i + 1]) h = args[++i];
        else if (/^-H./.test(args[i])) h = args[i].slice(2);
        if (!h) continue;
        const dp = h.indexOf(':');
        if (dp > 0) cabecalhos[h.slice(0, dp).trim()] = h.slice(dp + 1).trim();
      }
      let resp;
      try {
        resp = LX.httpRequest(sh.m, host, port, path,
          opts.X || opts['--request'] || (opts.d ? 'POST' : 'GET'),
          { cabecalhos, tls: url.startsWith('https'), inseguro: !!opts.k, corpo: opts.d || opts['--data'] || null });
      }
      catch (e) {
        if (e.code === 'ECERT') {
          io.stderr.write(`curl: (60) SSL certificate problem: ${e.message || 'self-signed certificate'}\nMore details here: https://curl.se/docs/sslcerts.html\n\ncurl failed to verify the legitimacy of the server and therefore could not\nestablish a secure connection to it.\n`);
          return 60;
        }
        if (e.code === 'EAI_NONAME') { io.stderr.write(`curl: (6) Could not resolve host: ${host}\n`); return 6; }
        if (e.code === 'ECONNREFUSED') { io.stderr.write(`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Connection refused\n`); return 7; }
        if (e.code === 'ETIMEDOUT') { io.stderr.write(`curl: (28) Failed to connect to ${host} port ${port} after 5000 ms: Timeout was reached\n`); return 28; }
        if (e.code === 'EHOSTUNREACH') { io.stderr.write(`curl: (7) Failed to connect to ${host} port ${port}: No route to host\n`); return 7; }
        if (e.code === 'EMPTYREPLY') { io.stderr.write(`curl: (52) Empty reply from server\n`); return 52; }
        io.stderr.write(`curl: (7) ${e.message}\n`); return 7;
      }
      await new Promise(r => setTimeout(r, 90));
      if (opts.v || opts['--verbose']) {
        io.stderr.write(`* Connected to ${host} (${sh.m.resolve(host)}) port ${port}\n> ${opts.X || 'GET'} ${path} HTTP/1.1\r\n> Host: ${host}\r\n> User-Agent: curl/8.14.1\r\n> Accept: */*\r\n> \r\n* Request completely sent off\n`);
      }
      const headers = `HTTP/1.1 ${resp.status} ${statusText(resp.status)}\r\nServer: ${resp.server || 'nginx/1.28.0 (Ubuntu)'}\r\nDate: ${new Date().toUTCString()}\r\nContent-Type: ${resp.type}\r\nContent-Length: ${resp.body.length}\r\nConnection: keep-alive\r\n\r\n`;
      if (opts.I || opts['--head']) { io.stdout.write(headers.replace(/\r/g, '')); return 0; }
      if ((opts.f || opts['--fail']) && resp.status >= 400) {
        io.stderr.write(`curl: (22) The requested URL returned error: ${resp.status}\n`);
        return 22;
      }
      let out = (opts.i ? headers.replace(/\r/g, '') : '') + resp.body;
      // -w / --write-out: formato de saída com variáveis (%{http_code} etc.)
      const escrever = opts.w || opts['--write-out'];
      const formatar = (f) => String(f)
        .replace(/%\{http_code\}/g, String(resp.status))
        .replace(/%\{size_download\}/g, String(resp.body.length))
        .replace(/%\{content_type\}/g, resp.type || 'text/html')
        .replace(/%\{time_total\}/g, '0.0' + (2 + Math.floor(Math.random() * 8)))
        .replace(/%\{url_effective\}/g, url)
        .replace(/%\{remote_ip\}/g, (typeof destIp !== 'undefined' ? destIp : ''))
        .replace(/\\n/g, '\n');
      const outFile = opts.o || opts['--output'] || (opts.O ? FileSystem.basename(path) : null);
      if (outFile) {
        if (outFile === '/dev/null') { /* descarta o corpo */ }
        else sh.m.fs.writeFile(P(sh, outFile), resp.tarContent ? tarify(resp.tarContent) : resp.body, sh.fsopts());
        if (!silent) {
          io.stderr.write(`  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n`);
          io.stderr.write(`100  ${String(resp.body.length).padStart(4)}  100  ${String(resp.body.length).padStart(4)}    0     0  ${String(resp.body.length * 6).padStart(5)}      0 --:--:-- --:--:-- --:--:-- ${resp.body.length * 6}\n`);
        }
        if (escrever) io.stdout.write(formatar(escrever));
        return 0;
      }
      io.stdout.write(out);
      if (escrever) io.stdout.write(formatar(escrever));
      return 0;
    }
  });
  function tarify(files) {
    const entries = {};
    for (const k in files) entries[k] = { type: 'file', mode: k.endsWith('.sh') ? 0o755 : 0o644, uid: 1000, gid: 1000, mtime: Date.now(), content: files[k] };
    const dirs = new Set();
    for (const k in files) { const parts = k.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/')); }
    for (const d of dirs) entries[d] = { type: 'dir', mode: 0o755, uid: 1000, gid: 1000, mtime: Date.now(), content: '' };
    return 'GZIPDATA\nTARDATA\n' + JSON.stringify(entries);
  }
  function statusText(s) {
    return { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' }[s] || 'Unknown';
  }

  defcmd({
    name: 'wget', pkg: 'wget',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { O: 1, q: 0, c: 0, P: 1, '--output-document': 1, '--quiet': 0, '--no-check-certificate': 0, '--spider': 0 });
      let url = rest[0];
      if (!url) { io.stderr.write('wget: missing URL\nUsage: wget [OPTION]... [URL]...\n'); return 1; }
      if (!/^https?:\/\//.test(url)) url = 'http://' + url;
      const m = /^https?:\/\/([^\/:?#]+)(?::(\d+))?([^?#]*)/.exec(url);
      const host = m[1], port = m[2] ? +m[2] : 80, path = m[3] || '/';
      const quiet = opts.q || opts['--quiet'];
      const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (!quiet) io.stderr.write(`--${stamp}--  ${url}\n`);
      const ip = sh.m.resolve(host);
      if (!quiet) io.stderr.write(`Resolving ${host} (${host})... ${ip || 'failed'}\n`);
      if (!ip) { io.stderr.write(`wget: unable to resolve host address '${host}'\n`); return 4; }
      let resp;
      try { resp = LX.httpRequest(sh.m, host, port, path, 'GET'); }
      catch (e) {
        if (e.code === 'ECONNREFUSED') { if (!quiet) io.stderr.write(`Connecting to ${host}|${ip}|:${port}... failed: Connection refused.\n`); return 4; }
        io.stderr.write(`wget: ${e.message}\n`); return 4;
      }
      if (!quiet) io.stderr.write(`Connecting to ${host} (${host})|${ip}|:${port}... connected.\nHTTP request sent, awaiting response... ${resp.status} ${statusText(resp.status)}\n`);
      if (resp.status >= 400) { io.stderr.write(`${new Date().toISOString().slice(11, 19)} ERROR ${resp.status}: ${statusText(resp.status)}.\n`); return 8; }
      const name = opts.O || opts['--output-document'] || (path === '/' ? 'index.html' : FileSystem.basename(path));
      if (opts['--spider']) { io.stderr.write('Remote file exists.\n'); return 0; }
      if (!quiet) io.stderr.write(`Length: ${resp.body.length} (${(resp.body.length / 1024).toFixed(1)}K) [${resp.type}]\nSaving to: '${name}'\n\n`);
      await new Promise(r => setTimeout(r, 150));
      if (name === '-') { io.stdout.write(resp.body); return 0; }
      const dir = opts.P ? P(sh, opts.P) : sh.cwd;
      sh.m.fs.writeFile(FileSystem.join(dir, name), resp.tarContent ? tarify(resp.tarContent) : resp.body, sh.fsopts());
      if (!quiet) {
        io.stderr.write(`${name}      100%[===================>]  ${(resp.body.length / 1024).toFixed(2)}K  --.-KB/s    in 0.001s  \n\n`);
        io.stderr.write(`${stamp} (${(resp.body.length / 1024).toFixed(1)} MB/s) - '${name}' saved [${resp.body.length}/${resp.body.length}]\n\n`);
      }
      return 0;
    }
  });

  /* ================================ DNS ================================ */
  defcmd({
    name: 'dig', pkg: 'dnsutils',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { x: 0, '+short': 0, t: 1 });
      const short = args.includes('+short');
      const noall = args.includes('+noall');
      const names = rest.filter(r => !r.startsWith('+') && !r.startsWith('@'));
      const type = (names.find(n => /^(A|AAAA|MX|TXT|NS|CNAME|PTR|SOA)$/i.test(n)) || 'A').toUpperCase();
      const host = names.find(n => !/^(A|AAAA|MX|TXT|NS|CNAME|PTR|SOA)$/i.test(n));
      if (!host) { io.stderr.write('dig: informe um nome. Ex.: dig exemplo.com\n'); return 1; }
      const ip = sh.m.resolve(host);
      if (short) { if (ip) io.stdout.write(ip + '\n'); return ip ? 0 : 0; }
      io.stdout.write(`\n; <<>> DiG 9.20.11-4-Ubuntu <<>> ${args.join(' ')}\n;; global options: +cmd\n`);
      if (!ip) {
        io.stdout.write(`;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: ${Math.floor(Math.random() * 60000)}\n;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1\n\n;; QUESTION SECTION:\n;${host}.\t\t\tIN\t${type}\n\n;; Query time: 41 msec\n;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)\n;; WHEN: ${new Date().toUTCString()}\n;; MSG SIZE  rcvd: ${60 + host.length}\n\n`);
        return 0;
      }
      io.stdout.write(`;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ${Math.floor(Math.random() * 60000)}\n;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1\n\n;; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: 65494\n;; QUESTION SECTION:\n;${host}.\t\t\tIN\t${type}\n\n;; ANSWER SECTION:\n${host}.\t\t300\tIN\t${type}\t${ip}\n\n;; Query time: 24 msec\n;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)\n;; WHEN: ${new Date().toUTCString()}\n;; MSG SIZE  rcvd: ${70 + host.length}\n\n`);
      return 0;
    }
  });

  defcmd({
    name: ['nslookup', 'host'], path: '/usr/bin/', pkg: 'dnsutils',
    run: async ({ sh, io, args, name }) => {
      const target = args.filter(a => !a.startsWith('-'))[0];
      if (!target) { io.stderr.write(`Usage: ${name} <nome>\n`); return 1; }
      const ip = sh.m.resolve(target);
      if (name === 'host') {
        if (!ip) { io.stdout.write(`Host ${target} not found: 3(NXDOMAIN)\n`); return 1; }
        io.stdout.write(`${target} has address ${ip}\n`);
        return 0;
      }
      io.stdout.write(`Server:\t\t127.0.0.53\nAddress:\t127.0.0.53#53\n\n`);
      if (!ip) { io.stdout.write(`** server can't find ${target}: NXDOMAIN\n`); return 1; }
      io.stdout.write(`${['127.0.0.1', sh.m.primaryIp()].includes(ip) ? '' : 'Non-authoritative answer:\n'}Name:\t${target}\nAddress: ${ip}\n\n`);
      return 0;
    }
  });

  defcmd({
    name: 'traceroute', pkg: 'traceroute',
    run: async ({ sh, io, args }) => {
      const host = args.filter(a => !a.startsWith('-'))[0];
      if (!host) { io.stderr.write('Usage: traceroute [ -46dFITnreAUEDV ] host\n'); return 2; }
      const ip = sh.m.resolve(host);
      if (!ip) { io.stderr.write(`traceroute: unknown host ${host}\n`); return 2; }
      io.stdout.write(`traceroute to ${host} (${ip}), 30 hops max, 60 byte packets\n`);
      const hops = ip === '127.0.0.1' ? [['localhost (127.0.0.1)', 0.04]] :
        [['_gateway (10.0.2.1)', 0.4], ['192.168.1.1', 2.1], ['10.20.30.1 (10.20.30.1)', 8.4], ['border1.sp.net (200.160.2.1)', 12.7], [`${host} (${ip})`, 18.2]];
      for (let i = 0; i < hops.length; i++) {
        await new Promise(r => setTimeout(r, 200));
        const [label, base] = hops[i];
        io.stdout.write(` ${i + 1}  ${label}  ${(base + Math.random()).toFixed(3)} ms  ${(base + Math.random()).toFixed(3)} ms  ${(base + Math.random()).toFixed(3)} ms\n`);
      }
      return 0;
    }
  });

  defcmd({
    name: ['nc', 'netcat'], path: '/usr/bin/', pkg: 'netcat-openbsd',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { z: 0, v: 0, l: 0, p: 1, w: 1, u: 0 });
      const host = rest[0], port = +rest[1];
      if (opts.l) { io.stderr.write('nc: modo servidor indisponível neste ambiente.\n'); return 1; }
      if (!host || !port) { io.stderr.write('usage: nc [-46CDdFhklNnrStUuvZz] [-w timeout] destination port\n'); return 1; }
      try {
        sh.m.connect(host, port);
        if (opts.v) io.stderr.write(`Connection to ${host} (${sh.m.resolve(host)}) ${port} port [tcp/*] succeeded!\n`);
        return 0;
      } catch (e) {
        if (opts.v) io.stderr.write(`nc: connect to ${host} port ${port} (tcp) failed: ${e.code === 'ECONNREFUSED' ? 'Connection refused' : e.message}\n`);
        return 1;
      }
    }
  });

  /* ================================ SSH ================================ */
  defcmd({
    name: 'ssh-keygen', path: '/usr/bin/ssh-keygen', pkg: 'openssh-client',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { t: 1, b: 1, C: 1, f: 1, N: 1, y: 0, l: 0, p: 0, R: 1, q: 0 });
      const type = opts.t || 'ed25519';
      if (!['ed25519', 'rsa', 'ecdsa', 'ed25519-sk'].includes(type)) { io.stderr.write(`unknown key type ${type}\n`); return 1; }
      const home = sh.getVar('HOME');
      let file = opts.f;
      if (!file) {
        if (io.term && io.term.readLine) {
          io.stdout.write(`Generating public/private ${type} key pair.\nEnter file in which to save the key (${home}/.ssh/id_${type}): `);
          const ans = await io.term.readLine('');
          file = (ans || '').trim() || `${home}/.ssh/id_${type}`;
        } else file = `${home}/.ssh/id_${type}`;
      } else io.stdout.write(`Generating public/private ${type} key pair.\n`);
      const path = P(sh, file);
      if (sh.m.fs.exists(path, sh.fsopts())) {
        if (io.term && io.term.readLine) {
          io.stdout.write(`${path} already exists.\nOverwrite (y/n)? `);
          const a = await io.term.readLine('');
          if (!/^y/i.test((a || '').trim())) { io.stdout.write('\n'); return 1; }
        }
      }
      if (opts.N === undefined && io.term && io.term.readLine) {
        io.stdout.write('Enter passphrase for "' + path + '" (empty for no passphrase): ');
        await io.term.readLine('', { silent: true });
        io.stdout.write('\nEnter same passphrase again: ');
        await io.term.readLine('', { silent: true });
        io.stdout.write('\n');
      }
      const rnd = () => Array.from({ length: 43 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[Math.floor(Math.random() * 64)]).join('');
      const comment = opts.C || `${sh.user}@${sh.m.hostname}`;
      const pub = `ssh-${type} AAAAC3NzaC1lZDI1NTE5AAAAI${rnd()} ${comment}`;
      try { sh.m.fs.mkdirp(FileSystem.dirname(path), sh.fsopts()); } catch (e) { }
      const dirNode = sh.m.fs.stat(FileSystem.dirname(path), sh.fsopts());
      dirNode.mode = 0o700;
      const priv = sh.m.fs.writeFile(path, `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n${rnd()}\n${rnd()}\n-----END OPENSSH PRIVATE KEY-----\n`, sh.fsopts());
      priv.mode = 0o600;
      const pubNode = sh.m.fs.writeFile(path + '.pub', pub + '\n', sh.fsopts());
      pubNode.mode = 0o644;
      const fp = 'SHA256:' + rnd().slice(0, 43);
      io.stdout.write(`Your identification has been saved in ${path}\nYour public key has been saved in ${path}.pub\nThe key fingerprint is:\n${fp} ${comment}\nThe key's randomart image is:\n+--[ED25519 256]--+\n|      .o+*=o     |\n|     . o=+..     |\n|    . o.oo .     |\n|   . o o. .      |\n|  . o o S        |\n| . E + = .       |\n|  o + * o        |\n| . = O =         |\n|  o=*=*.         |\n+----[SHA256]-----+\n`);
      return 0;
    }
  });

  defcmd({
    name: 'ssh-copy-id', path: '/usr/bin/ssh-copy-id', pkg: 'openssh-client',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { i: 1, p: 1, f: 0 });
      const dest = rest[0];
      if (!dest) { io.stderr.write('Usage: /usr/bin/ssh-copy-id [-i [identity_file]] [user@]hostname\n'); return 1; }
      const [user, host] = dest.includes('@') ? dest.split('@') : [sh.user, dest];
      const keyFile = opts.i || `${sh.getVar('HOME')}/.ssh/id_ed25519.pub`;
      let pub;
      try { pub = sh.m.fs.readFile(P(sh, keyFile.endsWith('.pub') ? keyFile : keyFile + '.pub'), sh.fsopts()).trim(); }
      catch (e) { io.stderr.write(`/usr/bin/ssh-copy-id: ERROR: failed to open ID file '${keyFile}': No such file or directory\n\t(to install the contents of '${keyFile}' anyway, look at --help)\n`); return 1; }
      const remote = LX.getRemote(sh.m, host);
      if (!remote) { io.stderr.write(`ssh: Could not resolve hostname ${host}: Name or service not known\n`); return 255; }
      io.stdout.write(`/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "${keyFile}"\n/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed\n/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys\n`);
      if (io.term && io.term.readLine) {
        io.stdout.write(`${user}@${host}'s password: `);
        await io.term.readLine('', { silent: true });
        io.stdout.write('\n');
      }
      const ru = remote.userByName(user);
      const homeDir = ru ? ru.home : `/home/${user}`;
      const ctx = remote.ctxRoot();
      remote.fs.mkdirp(homeDir + '/.ssh', { ctx });
      remote.fs.stat(homeDir + '/.ssh', { ctx }).mode = 0o700;
      try { remote.fs.appendFile(homeDir + '/.ssh/authorized_keys', pub + '\n', { ctx }); } catch (e) { remote.fs.writeFile(homeDir + '/.ssh/authorized_keys', pub + '\n', { ctx }); }
      remote.fs.stat(homeDir + '/.ssh/authorized_keys', { ctx }).mode = 0o600;
      remote.sshKeysAuthorized.set(user, pub);
      io.stdout.write(`\nNumber of key(s) added: 1\n\nNow try logging into the machine, with:   "ssh '${dest}'"\nand check to make sure that only the key(s) you wanted were added.\n\n`);
      return 0;
    }
  });

  defcmd({
    name: 'ssh-agent', pkg: 'openssh-client', run: async ({ sh, io, args }) => {
      if (args.includes('-k')) { sh.m.sshAgent = null; io.stdout.write('unset SSH_AUTH_SOCK;\nunset SSH_AGENT_PID;\necho Agent pid 4212 killed;\n'); return 0; }
      sh.m.sshAgent = sh.m.sshAgent || { pid: 4212, chaves: [] };
      io.stdout.write(`SSH_AUTH_SOCK=/tmp/ssh-XXXX4212/agent.4211; export SSH_AUTH_SOCK;\nSSH_AGENT_PID=4212; export SSH_AGENT_PID;\necho Agent pid 4212;\n`);
      return 0;
    }
  });

  defcmd({
    name: 'ssh-add', pkg: 'openssh-client', run: async ({ sh, io, args }) => {
      const agente = sh.m.sshAgent;
      if (!agente) { io.stderr.write('Could not open a connection to your authentication agent.\n'); return 2; }
      const { opts, rest } = getopt(args, { l: 0, L: 0, d: 0, D: 0 });
      if (opts.D) { agente.chaves = []; io.stdout.write('All identities removed.\n'); return 0; }
      if (opts.l || opts.L) {
        if (!agente.chaves.length) { io.stdout.write('The agent has no identities.\n'); return 1; }
        for (const k of agente.chaves) io.stdout.write(`256 SHA256:${k.fp} ${k.arquivo} (ED25519)\n`);
        return 0;
      }
      const arquivo = rest[0] || (sh.getVar('HOME') + '/.ssh/id_ed25519');
      let conteudo;
      try { conteudo = sh.m.fs.readFile(P(sh, arquivo), sh.fsopts()); }
      catch (e) { io.stderr.write(`Error loading key "${arquivo}": No such file or directory\n`); return 1; }
      if (opts.d) {
        agente.chaves = agente.chaves.filter(k => k.arquivo !== P(sh, arquivo));
        io.stdout.write(`Identity removed: ${arquivo}\n`);
        return 0;
      }
      const fp = 'YRHRIVtEfEdppqVjZgUPFOnl43UlNKmHe2W4wofWcyl'.slice(0, 43);
      agente.chaves.push({ arquivo: P(sh, arquivo), fp });
      io.stdout.write(`Identity added: ${arquivo} (${sh.user}@${sh.m.hostname})\n`);
      return 0;
    }
  });

  /* Máquinas remotas para praticar SSH */
  LX.REMOTE_DEFS = {
    web01: { hostname: 'web01', role: 'web' },
    db01: { hostname: 'db01', role: 'db' }
  };
  LX.getRemote = function (machine, host) {
    machine.remotes = machine.remotes || new Map();
    if (machine.remotes.has(host)) return machine.remotes.get(host);
    const def = LX.REMOTE_DEFS[host];
    if (!def) return null;
    const m = new LX.Machine({ hostname: def.hostname, uptime: 7 * 86400 });
    LX.installBinaries(m);
    // as contas do laboratório existem também nas máquinas remotas
    const ctxR = m.ctxRoot();
    for (const nome of ['aluno', 'deploy']) {
      if (!m.userByName(nome)) {
        const uid = m.nextUid(), gid = m.nextGid();
        m.addGroupRecord({ name: nome, gid, members: [] });
        m.addUserRecord({ name: nome, uid, gid, gecos: '', home: '/home/' + nome, shell: '/bin/bash' });
        try {
          m.fs.mkdirp('/home/' + nome, { ctx: ctxR });
          const h = m.fs.stat('/home/' + nome, { ctx: ctxR });
          h.uid = uid; h.gid = gid; h.mode = 0o750;
        } catch (e) { }
      }
    }
    try {
      const g = m.groups().find(x => x.name === 'sudo');
      if (g && !g.members.includes('aluno')) { g.members.push('aluno'); m.rewriteGroup(m.groups().map(x => x.name === 'sudo' ? g : x)); }
    } catch (e) { }
    if (def.role === 'web') {
      m.installPackage('nginx');
      m.fs.writeFile('/var/www/html/index.nginx-debian.html', '<html><body><h1>web01 no ar</h1></body></html>\n', { ctx: m.ctxRoot() });
    }
    if (def.role === 'db') {
      m.installPackage('postgresql');
    }
    machine.remotes.set(host, m);
    return m;
  };

  defcmd({
    name: 'ssh', pkg: 'openssh-client',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { p: 1, i: 1, l: 1, v: 0, o: 1, t: 0, N: 0, L: 1, R: 1, '-o': 1 });
      const target = rest[0];
      if (!target) { io.stderr.write('usage: ssh [-46AA] [-p port] [user@]hostname [command]\n'); return 255; }
      let [user, host] = target.includes('@') ? target.split('@') : [sh.user, target];
      if (opts.l) user = opts.l;
      const port = opts.p ? +opts.p : 22;
      // ~/.ssh/config
      try {
        const cfg = sh.m.fs.readFile(sh.getVar('HOME') + '/.ssh/config', sh.fsopts());
        const blocks = cfg.split(/^Host\s+/mi).slice(1);
        for (const b of blocks) {
          const lines = b.split('\n');
          const alias = lines[0].trim();
          if (alias === host) {
            for (const l of lines.slice(1)) {
              const hm = /^\s*HostName\s+(\S+)/i.exec(l); if (hm) host = hm[1];
              const um = /^\s*User\s+(\S+)/i.exec(l); if (um) user = um[1];
            }
          }
        }
      } catch (e) { }
      if (host === 'localhost' || host === '127.0.0.1' || host === sh.m.hostname) {
        io.stderr.write(`ssh: conectando em você mesmo. Neste ambiente, use os hosts de laboratório: web01, db01.\n`);
        return 255;
      }
      const remote = LX.getRemote(sh.m, host);
      if (!remote) { io.stderr.write(`ssh: Could not resolve hostname ${host}: Temporary failure in name resolution\n`); return 255; }
      if (port !== 22) { io.stderr.write(`ssh: connect to host ${host} port ${port}: Connection refused\n`); return 255; }
      const known = sh.getVar('HOME') + '/.ssh/known_hosts';
      let isKnown = false;
      try { isKnown = sh.m.fs.readFile(known, sh.fsopts()).includes(host); } catch (e) { }
      // -o StrictHostKeyChecking=no|accept-new aceita a chave sem perguntar
      const oOpts = [].concat(opts.o || [], opts['-o'] || []).filter(Boolean).join(' ');
      const aceitaAuto = /StrictHostKeyChecking\s*=\s*(no|accept-new|off)/i.test(oOpts);
      if (!isKnown && aceitaAuto) {
        try { sh.m.fs.appendFile(known, `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${host}key\n`, sh.fsopts()); }
        catch (e) { sh.m.fs.writeFile(known, `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${host}key\n`, sh.fsopts()); }
        io.stderr.write(`Warning: Permanently added '${host}' (ED25519) to the list of known hosts.\n`);
        isKnown = true;
      }
      if (!isKnown) {
        io.stdout.write(`The authenticity of host '${host} (${sh.m.resolve(host) || '10.0.2.31'})' can't be established.\nED25519 key fingerprint is SHA256:9pQ+cKm1XyR0v2sT8dLw3nB6hJ4kU7fE1oIaZbY5cWQ.\nThis key is not known by any other names.\nAre you sure you want to continue connecting (yes/no/[fingerprint])? `);
        if (io.term && io.term.readLine) {
          const ans = await io.term.readLine('');
          if (!/^(yes|sim|s|y)$/i.test((ans || '').trim())) { io.stderr.write('Host key verification failed.\n'); return 255; }
        }
        try { sh.m.fs.appendFile(known, `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${host}key\n`, sh.fsopts()); }
        catch (e) { sh.m.fs.writeFile(known, `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${host}key\n`, sh.fsopts()); }
        io.stdout.write(`\nWarning: Permanently added '${host}' (ED25519) to the list of known hosts.\n`);
      }
      const hasKey = remote.sshKeysAuthorized.has(user);
      if (!hasKey) {
        if (io.term && io.term.readLine) {
          io.stdout.write(`${user}@${host}'s password: `);
          const pw = await io.term.readLine('', { silent: true });
          io.stdout.write('\n');
          if (!pw) { io.stderr.write(`Permission denied, please try again.\n`); return 255; }
        }
      }
      if (!remote.userByName(user)) {
        io.stderr.write(`Permission denied, please try again.\n${user}@${host}: Permission denied (publickey,password).\n`);
        return 255;
      }
      const command = rest.slice(1).join(' ');
      if (command) {
        const rsh = new LX.Shell(remote, { cwd: remote.userByName(user).home, uid: remote.userByName(user).uid, gid: remote.userByName(user).gid, user, remote: host });
        // sem -t não há TTY do outro lado: a saída sai em uma coluna, como no ssh real
        const semTty = Object.assign({}, io);
        if (!opts.t && io.stdout) {
          semTty.stdout = Object.create(io.stdout);
          semTty.stdout.isTTY = false;
          semTty.inPipe = true;
        }
        const ex = new LX.Executor(rsh, semTty);
        try { return await ex.run(command); } catch (e) { if (e && e.isExit) return e.code; throw e; }
      }
      if (io.term && io.term.sshInto) {
        io.term.sshInto(remote, user, host);
        return 0;
      }
      io.stderr.write('ssh: sessão interativa indisponível aqui.\n');
      return 255;
    }
  });

  defcmd({
    name: 'scp', pkg: 'openssh-client',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { r: 0, P: 1, i: 1, v: 0, p: 0, C: 0 });
      if (rest.length < 2) { io.stderr.write('usage: scp [-346ABCOpqRrsTv] source ... target\n'); return 1; }
      const src = rest[0], dst = rest[1];
      const parse = (spec) => {
        const m = /^(?:([^@]+)@)?([A-Za-z0-9_.-]+):(.*)$/.exec(spec);
        if (!m || !LX.REMOTE_DEFS[m[2]]) return null;
        return { user: m[1] || sh.user, host: m[2], path: m[3] || '.' };
      };
      const s = parse(src), d = parse(dst);
      if (!s && !d) { io.stderr.write('scp: um dos lados precisa ser remoto (ex.: scp arquivo.txt aluno@web01:/tmp/)\n'); return 1; }
      const remoteSpec = s || d;
      const remote = LX.getRemote(sh.m, remoteSpec.host);
      if (!remote) { io.stderr.write(`ssh: Could not resolve hostname ${remoteSpec.host}\n`); return 255; }
      const ru = remote.userByName(remoteSpec.user);
      if (!ru) { io.stderr.write(`${remoteSpec.user}@${remoteSpec.host}: Permission denied (publickey,password).\n`); return 255; }
      if (!remote.sshKeysAuthorized.has(remoteSpec.user) && io.term && io.term.readLine) {
        io.stdout.write(`${remoteSpec.user}@${remoteSpec.host}'s password: `);
        await io.term.readLine('', { silent: true });
        io.stdout.write('\n');
      }
      const rpath = (p) => p.startsWith('/') ? p : FileSystem.join(ru.home, p === '.' ? '' : p);
      try {
        if (s) {
          const data = remote.fs.readFile(rpath(s.path), { ctx: { uid: ru.uid, gid: ru.gid, groups: remote.gidsOfUser(ru.name) }, cwd: ru.home });
          let target = P(sh, dst);
          try { if (sh.m.fs.stat(target, sh.fsopts()).type === 'dir') target = FileSystem.join(target, FileSystem.basename(s.path)); } catch (e) { }
          sh.m.fs.writeFile(target, data, sh.fsopts());
          io.stdout.write(`${FileSystem.basename(s.path)}${' '.repeat(Math.max(1, 24 - FileSystem.basename(s.path).length))}100% ${String(data.length).padStart(5)}   ${(data.length / 1024).toFixed(1)}KB/s   00:00\n`);
        } else {
          const data = sh.m.fs.readFile(P(sh, src), sh.fsopts());
          let target = rpath(d.path);
          try { if (remote.fs.stat(target, { ctx: remote.ctxRoot() }).type === 'dir') target = FileSystem.join(target, FileSystem.basename(src)); } catch (e) { }
          const n = remote.fs.writeFile(target, data, { ctx: remote.ctxRoot() });
          n.uid = ru.uid; n.gid = ru.gid;
          io.stdout.write(`${FileSystem.basename(src)}${' '.repeat(Math.max(1, 24 - FileSystem.basename(src).length))}100% ${String(data.length).padStart(5)}   ${(data.length / 1024).toFixed(1)}KB/s   00:00\n`);
        }
      } catch (e) {
        io.stderr.write(`scp: ${e.message}\n`);
        return 1;
      }
      return 0;
    }
  });

  defcmd({
    name: 'rsync', pkg: 'rsync',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { a: 0, v: 0, z: 0, r: 0, n: 0, P: 0, e: 1, '--delete': 0, '--dry-run': 0, '--exclude': 1, '--progress': 0, '--archive': 0 });
      if (rest.length < 2) { io.stderr.write('rsync: no destination specified\nrsync error: syntax or usage error (code 1) at main.c(1428)\n'); return 1; }
      const src = rest[0], dst = rest[1];
      const verbose = opts.v || opts['--verbose'];
      const dry = opts.n || opts['--dry-run'];
      const parse = (spec) => { const m = /^(?:([^@]+)@)?([A-Za-z0-9_.-]+):(.*)$/.exec(spec); return (m && LX.REMOTE_DEFS[m[2]]) ? { user: m[1] || sh.user, host: m[2], path: m[3] } : null; };
      const rs = parse(src), rd = parse(dst);
      io.stdout.write('sending incremental file list\n');
      const copied = [];
      try {
        if (!rs && !rd) {
          const srcPath = P(sh, src.replace(/\/$/, ''));
          const trailing = src.endsWith('/');
          const st = sh.m.fs.stat(srcPath, sh.fsopts());
          const dstPath = P(sh, dst);
          if (st.type === 'dir') {
            if (!sh.m.fs.exists(dstPath, sh.fsopts())) sh.m.fs.mkdirp(dstPath, sh.fsopts());
            const base = trailing ? dstPath : FileSystem.join(dstPath, FileSystem.basename(srcPath));
            if (!trailing && !dry) sh.m.fs.mkdirp(base, sh.fsopts());
            sh.m.fs.walk(srcPath, (p, node) => {
              const rel = p.slice(srcPath.length).replace(/^\//, '');
              if (!rel) return;
              if (opts['--exclude'] && LX.matchGlob(FileSystem.basename(p), opts['--exclude'])) return;
              copied.push(rel + (node.type === 'dir' ? '/' : ''));
              if (dry) return;
              const target = FileSystem.join(base, rel);
              if (node.type === 'dir') sh.m.fs.mkdirp(target, sh.fsopts());
              else { const n = sh.m.fs.create(target, node.read(), sh.fsopts()); if (opts.a || opts['--archive']) { n.mode = node.mode; n.mtime = node.mtime; } }
            }, sh.fsopts());
          } else {
            copied.push(FileSystem.basename(srcPath));
            if (!dry) sh.m.fs.copy(srcPath, dstPath, sh.fsopts({ recursive: true, preserve: opts.a }));
          }
        } else {
          const remoteSpec = rs || rd;
          const remote = LX.getRemote(sh.m, remoteSpec.host);
          if (!remote) { io.stderr.write(`ssh: Could not resolve hostname ${remoteSpec.host}\n`); return 255; }
          const ru = remote.userByName(remoteSpec.user) || { home: '/home/' + remoteSpec.user, uid: 1000, gid: 1000 };
          const rpath = (p) => p.startsWith('/') ? p : FileSystem.join(ru.home, p);
          if (rd) {
            const srcPath = P(sh, src.replace(/\/$/, ''));
            const st = sh.m.fs.stat(srcPath, sh.fsopts());
            const base = src.endsWith('/') ? rpath(rd.path) : FileSystem.join(rpath(rd.path), FileSystem.basename(srcPath));
            if (st.type === 'dir') {
              if (!dry) remote.fs.mkdirp(base, { ctx: remote.ctxRoot() });
              sh.m.fs.walk(srcPath, (p, node) => {
                const rel = p.slice(srcPath.length).replace(/^\//, '');
                if (!rel) return;
                copied.push(rel + (node.type === 'dir' ? '/' : ''));
                if (dry) return;
                const target = FileSystem.join(base, rel);
                if (node.type === 'dir') remote.fs.mkdirp(target, { ctx: remote.ctxRoot() });
                else remote.fs.writeFile(target, node.read(), { ctx: remote.ctxRoot() });
              }, sh.fsopts());
            } else {
              copied.push(FileSystem.basename(srcPath));
              if (!dry) remote.fs.writeFile(base, sh.m.fs.readFile(srcPath, sh.fsopts()), { ctx: remote.ctxRoot() });
            }
          } else {
            const data = remote.fs.readFile(rpath(rs.path), { ctx: remote.ctxRoot() });
            copied.push(FileSystem.basename(rs.path));
            if (!dry) sh.m.fs.writeFile(P(sh, dst), data, sh.fsopts());
          }
        }
      } catch (e) {
        io.stderr.write(`rsync: [sender] change_dir "${src}" failed: ${e.message}\nrsync error: some files/attrs were not transferred (code 23)\n`);
        return 23;
      }
      if (verbose || opts.P || opts['--progress']) copied.forEach(c => io.stdout.write(c + '\n'));
      const bytes = copied.length * 214 + 132;
      io.stdout.write(`\nsent ${bytes} bytes  received ${Math.round(bytes / 6)} bytes  ${(bytes * 1.2).toFixed(2)} bytes/sec\ntotal size is ${bytes * 3}  speedup is 2.31${dry ? ' (DRY RUN)' : ''}\n`);
      return 0;
    }
  });
})();
