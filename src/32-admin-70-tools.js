/* =========================================================================
   TERMINALIS — firewall e ferramentas do sistema
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, defcmd, getopt } = LX;
  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }

  /* ============================== firewall ============================== */
  defcmd({
    name: 'ufw', path: '/usr/sbin/ufw', pkg: 'ufw', needsRoot: true,
    run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('ERROR: You need to be root to run this script\n'); return 1; }
      const fw = sh.m.firewall;
      const verb = args[0];
      switch (verb) {
        case 'enable': fw.enabled = true; io.stdout.write('Firewall is active and enabled on system startup\n'); return 0;
        case 'disable': fw.enabled = false; io.stdout.write('Firewall stopped and disabled on system startup\n'); return 0;
        case 'status': {
          io.stdout.write(`Status: ${fw.enabled ? 'active' : 'inactive'}\n`);
          if (!fw.enabled) return 0;
          if (args.includes('verbose')) io.stdout.write(`Logging: on (low)\nDefault: ${fw.defaultIn} (incoming), ${fw.defaultOut} (outgoing), disabled (routed)\nNew profiles: skip\n`);
          const numerado = args.includes('numbered');
          if (fw.rules.length) {
            io.stdout.write('\nTo                         Action      From\n--                         ------      ----\n');
            fw.rules.forEach((r, i) => {
              const alvo = (numerado ? `[${String(i + 1).padStart(2)}] ` : '') + r.port + (r.proto ? '/' + r.proto : '');
              io.stdout.write(`${alvo.padEnd(26)} ${(r.action.toUpperCase() + (r.dir === 'out' ? ' OUT' : ' IN')).padEnd(11)} ${r.from || 'Anywhere'}\n`);
            });
          }
          return 0;
        }
        case 'default': {
          /* ufw default {allow|deny|reject} [incoming|outgoing] */
          const acao = args[1];
          const sentido = args[2] || 'incoming';
          if (!['allow', 'deny', 'reject'].includes(acao)) {
            io.stderr.write(`ERROR: Unsupported default policy\n`); return 1;
          }
          if (/^in/.test(sentido)) fw.defaultIn = acao;
          else if (/^out/.test(sentido)) fw.defaultOut = acao;
          else { io.stderr.write(`ERROR: Unsupported default policy\n`); return 1; }
          io.stdout.write(`Default ${/^in/.test(sentido) ? 'incoming' : 'outgoing'} policy changed to '${acao}'\n(be sure to update your rules accordingly)\n`);
          return 0;
        }
        case 'allow': case 'deny': case 'limit': case 'reject': {
          let resto = args.slice(1);
          const dir = resto[0] === 'out' ? 'out' : 'in';
          if (resto[0] === 'in' || resto[0] === 'out') resto = resto.slice(1);
          // ufw allow from 10.0.2.0/24 to any port 22
          let from = null;
          if (resto[0] === 'from') { from = resto[1]; resto = resto.slice(2); }
          if (resto[0] === 'to' && resto[1] === 'any' && resto[2] === 'port') resto = resto.slice(3);
          const spec = resto[0];
          if (!spec) { io.stderr.write('ERROR: Wrong number of arguments\n'); return 1; }
          const m = /^(\d+)(?:\/(tcp|udp))?$/.exec(spec);
          const perfis = { ssh: '22', http: '80', https: '443', OpenSSH: '22', 'Nginx Full': '80', 'Nginx HTTP': '80' };
          const port = m ? m[1] : (perfis[spec] || spec);
          if (!m && !perfis[spec]) { io.stderr.write(`ERROR: Could not find a profile matching '${spec}'\n`); return 1; }
          const proto = m && m[2] ? m[2] : (resto[1] === 'proto' ? resto[2] : null);
          fw.rules = fw.rules.filter(r => !(r.port === port && r.dir === dir && (r.from || null) === (from || null)));
          fw.rules.push({ port, proto, action: verb === 'reject' ? 'deny' : verb, dir, from });
          io.stdout.write(`Rule ${fw.enabled ? 'added' : 'added (v6)'}\n`);
          return 0;
        }
        case 'delete': {
          const alvo = args[1];
          if (/^\d+$/.test(alvo) && !args[2]) {
            const i = +alvo - 1;
            if (i < 0 || i >= fw.rules.length) { io.stderr.write('ERROR: Could not delete non-existent rule\n'); return 1; }
            fw.rules.splice(i, 1);
            io.stdout.write('Rule deleted\n');
            return 0;
          }
          const spec = args[2] || '';
          const m2 = /^(\d+)(?:\/(tcp|udp))?$/.exec(spec);
          const porta = m2 ? m2[1] : ({ ssh: '22', http: '80', https: '443', OpenSSH: '22' }[spec] || spec);
          const antes = fw.rules.length;
          fw.rules = fw.rules.filter(r => r.port !== porta);
          io.stdout.write(antes === fw.rules.length ? 'Could not delete non-existent rule\n' : 'Rule deleted\n');
          return 0;
        }
        case 'reset':
          fw.rules = []; fw.enabled = false; fw.defaultIn = 'deny'; fw.defaultOut = 'allow';
          io.stdout.write('Resetting all rules to installed defaults.\n'); return 0;
        default:
          io.stdout.write(`Usage: ufw COMMAND\n\nCommands:\n enable                          ativa o firewall\n disable                         desativa o firewall\n status                          mostra o estado (use "status verbose")\n allow ARGS                      libera tráfego\n deny ARGS                       bloqueia tráfego\n delete RULE                     apaga uma regra\n reset                           volta ao padrão\n`);
          return 0;
      }
    }
  });

  /* ============================== editores ============================== */
  defcmd({
    name: ['nano', 'vi', 'vim', 'pico', 'editor'], path: '/usr/bin/', pkg: 'nano',
    run: async ({ sh, io, args, name }) => {
      const file = args.filter(a => !a.startsWith('-'))[0];
      if (!file) { io.stderr.write(`${name}: informe um arquivo. Ex.: ${name} script.sh\n`); return 1; }
      if (!io.term || !io.term.editor) {
        io.stderr.write(`${name}: editor de tela cheia indisponível aqui.\nUse: cat > ${file} << 'EOF' ... EOF\n`);
        return 1;
      }
      await io.term.editor(P(sh, file), { flavor: name });
      return 0;
    }
  });

  /* ============================== man ============================== */
  defcmd({
    name: 'man', pkg: 'man-db', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { k: 1, f: 1, '--help': 0 });
      if (opts.k) {
        const re = new RegExp(opts.k, 'i');
        let found = 0;
        for (const k in LX.MAN_PAGES) {
          const page = LX.MAN_PAGES[k];
          if (re.test(k) || re.test(page.short || '')) { io.stdout.write(`${k} (1)${' '.repeat(Math.max(1, 18 - k.length))}- ${page.short}\n`); found++; }
        }
        return found ? 0 : 1;
      }
      const topic = rest[rest.length - 1];
      if (!topic) { io.stderr.write('What manual page do you want?\nFor example, try \'man man\'.\n'); return 1; }
      const page = LX.MAN_PAGES[topic];
      if (!page) {
        io.stderr.write(`No manual entry for ${topic}\n`);
        if (LX.COMMANDS[topic]) io.stderr.write(`Dica: "${topic} --help" pode funcionar.\n`);
        return 16;
      }
      const text = LX.renderManPage(topic, page);
      if (io.term && io.term.pager && !io.inPipe) { await io.term.pager(text, `man ${topic}`, { man: true }); return 0; }
      io.stdout.write(text);
      return 0;
    }
  });

  defcmd({ name: 'apropos', pkg: 'man-db', run: async ({ sh, io, args, ex }) => await LX.COMMANDS['man'].run({ sh, io, args: ['-k', args[0] || ''], ex }) });
  defcmd({ name: 'chsh', run: async ({ sh, io, args }) => {
    const { opts, rest } = getopt(args, { s: 1, l: 0 });
    if (opts.l) { io.stdout.write(sh.m.fs.readFile('/etc/shells', sh.fsopts()).split('\n').filter(l => l && !l.startsWith('#')).join('\n') + '\n'); return 0; }
    if (!opts.s) { io.stderr.write('Usage: chsh [options] [LOGIN]\n  -s, --shell SHELL\n  -l, --list-shells\n'); return 1; }
    const target = rest[0] || sh.user;
    if (target !== sh.user && sh.uid !== 0) { io.stderr.write('chsh: you may not change the shell for other users.\n'); return 1; }
    const users = sh.m.users();
    const u = users.find(x => x.name === target);
    if (!u) { io.stderr.write(`chsh: user '${target}' does not exist\n`); return 1; }
    u.shell = opts.s;
    sh.m.rewritePasswd(users);
    io.stdout.write('Shell changed.\n');
    return 0;
  } });

  defcmd({ name: 'timedatectl', pkg: 'systemd', run: async ({ sh, io }) => {
    const now = new Date();
    io.stdout.write(`               Local time: ${now.toString().slice(0, 33)}\n           Universal time: ${now.toUTCString()}\n                 RTC time: ${now.toUTCString().slice(5, 25)}\n                Time zone: America/Sao_Paulo (-03, -0300)\nSystem clock synchronized: yes\n              NTP service: active\n          RTC in local TZ: no\n`);
    return 0;
  } });

  defcmd({ name: 'lsof', pkg: 'lsof', run: async ({ sh, io, args }) => {
    const { opts, rest } = getopt(args, { i: 1, p: 1, n: 0, P: 0, t: 0 });
    io.stdout.write('COMMAND    PID    USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\n');
    const iSpec = opts.i;
    for (const l of sh.m.listeners) {
      if (iSpec && typeof iSpec === 'string') {
        const m = /:(\d+)/.exec(iSpec);
        if (m && +m[1] !== l.port) continue;
      }
      io.stdout.write(`${l.process.padEnd(10)} ${String(l.pid).padStart(5)} ${'root'.padStart(7)}    3u  IPv4  ${20000 + l.pid}      0t0  ${l.proto.toUpperCase()} ${l.addr === '0.0.0.0' ? '*' : l.addr}:${l.port} (LISTEN)\n`);
    }
    return 0;
  } });

  defcmd({ name: 'strace', pkg: 'strace', run: async ({ sh, io, args }) => {
    io.stderr.write(`execve("${args[0] || '/bin/true'}", [...], 0x7ffd...) = 0\nopenat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3\nfstat(3, {st_mode=S_IFREG|0644, st_size=57344, ...}) = 0\nmmap(NULL, 57344, PROT_READ, MAP_PRIVATE, 3, 0) = 0x7f2b...\nclose(3)                                = 0\nwrite(1, "ok\\n", 3)                     = 3\nexit_group(0)                           = ?\n`);
    return 0;
  } });
})();
