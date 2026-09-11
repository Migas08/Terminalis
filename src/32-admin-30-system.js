/* =========================================================================
   TERMINALIS — systemd e sistema
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, defcmd, getopt, C, humanSize } = LX;
  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }

  /* ============================== systemd ============================== */
  defcmd({
    name: 'systemctl', path: '/usr/bin/systemctl', pkg: 'systemd',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { '--no-pager': 0, '--now': 0, '--type': 1, '--all': 0, '-l': 0, '--failed': 0, '--quiet': 0, q: 0, p: 1, '--property': 1, '--value': 0, '--user': 0 });
      const verb = opts['--failed'] && !rest.length ? '--failed' : rest[0];
      const unitName = rest[1];
      const needRoot = ['start', 'stop', 'restart', 'reload', 'enable', 'disable', 'mask', 'unmask', 'daemon-reload'].includes(verb);
      if (needRoot && sh.uid !== 0) {
        io.stderr.write(`Failed to ${verb} ${unitName || ''}: Interactive authentication required.\nSee system logs and 'systemctl status ${unitName || ''}' for details.\n`);
        return 1;
      }
      const u = unitName ? sh.m.unit(unitName) : null;
      switch (verb) {
        case undefined:
        case 'list-units': {
          const units = Array.from(sh.m.units.values()).filter(x => opts['--all'] || x.state === 'active' || x.state === 'failed');
          io.stdout.write('  UNIT                              LOAD   ACTIVE SUB     DESCRIPTION\n');
          for (const x of units.sort((a, b) => a.name.localeCompare(b.name))) {
            const mark = x.state === 'failed' ? `${C.red}●${C.reset} ` : '  ';
            io.stdout.write(`${mark}${x.name.padEnd(33)} loaded ${x.state.padEnd(6)} ${x.sub.padEnd(7)} ${x.description}\n`);
          }
          io.stdout.write(`\nLOAD   = Reflects whether the unit definition was properly loaded.\nACTIVE = The high-level unit activation state.\nSUB    = The low-level unit activation state.\n\n${units.length} loaded units listed.\n`);
          return 0;
        }
        case '--failed':
        case 'list-units-failed': {
          const falhas = Array.from(sh.m.units.values()).filter(x => x.state === 'failed');
          if (!falhas.length) { io.stdout.write('  UNIT LOAD ACTIVE SUB DESCRIPTION\n0 loaded units listed.\n'); return 0; }
          io.stdout.write('  UNIT                              LOAD   ACTIVE SUB     DESCRIPTION\n');
          for (const x of falhas) io.stdout.write(`${C.red}●${C.reset} ${x.name.padEnd(33)} loaded failed failed  ${x.description}\n`);
          io.stdout.write(`\n${falhas.length} loaded units listed.\n`);
          return 0;
        }
        case 'list-unit-files': {
          io.stdout.write('UNIT FILE                    STATE           PRESET\n');
          for (const x of Array.from(sh.m.units.values()).sort((a, b) => a.name.localeCompare(b.name)))
            io.stdout.write(`${x.name.padEnd(28)} ${(x.enabled ? 'enabled' : 'disabled').padEnd(15)} enabled\n`);
          return 0;
        }
        case 'status': {
          if (!unitName) {
            io.stdout.write(`● ${sh.m.hostname}\n    State: running\n     Jobs: 0 queued\n   Failed: ${Array.from(sh.m.units.values()).filter(x => x.state === 'failed').length} units\n    Since: ${new Date(sh.m.bootTime).toString()}\n`);
            return 0;
          }
          if (!u) { io.stderr.write(`Unit ${unitName}.service could not be found.\n`); return 4; }
          const dot = u.state === 'active' ? `${C.green}●${C.reset}` : u.state === 'failed' ? `${C.red}●${C.reset}` : '○';
          io.stdout.write(`${dot} ${u.name} - ${u.description}\n`);
          io.stdout.write(`     Loaded: loaded (${u.unitFile}; ${u.enabled ? 'enabled' : 'disabled'}; preset: enabled)\n`);
          const since = u.activeSince ? new Date(u.activeSince) : new Date(sh.m.bootTime);
          if (u.state === 'active') io.stdout.write(`     Active: ${C.green}active (running)${C.reset} since ${since.toString().slice(0, 33)}; ${Math.floor((Date.now() - since) / 60000)}min ago\n`);
          else if (u.state === 'failed') io.stdout.write(`     Active: ${C.red}failed${C.reset} (Result: exit-code) since ${new Date().toString().slice(0, 33)}; 5s ago\n`);
          else io.stdout.write(`     Active: inactive (dead)\n`);
          if (u.mainPid) io.stdout.write(`   Main PID: ${u.mainPid} (${u.name.replace('.service', '')})\n      Tasks: 3 (limit: 4613)\n     Memory: 12.4M\n        CPU: 128ms\n     CGroup: /system.slice/${u.name}\n             └─${u.mainPid} ${u.execStart}\n`);
          if (u.lastError) io.stdout.write(`\n${C.dim}Erro registrado:${C.reset} ${u.lastError}\n`);
          io.stdout.write('\n');
          const logs = sh.m.journal.filter(l => l.unit === u.name || l.unit === 'systemd').slice(-8);
          for (const l of logs) {
            const d = new Date(l.ts);
            io.stdout.write(`${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${String(d.getDate()).padStart(2)} ${d.toTimeString().slice(0, 8)} ${sh.m.hostname} ${l.unit === 'systemd' ? 'systemd[1]' : l.unit.replace('.service', '') + '[' + (u.mainPid || 0) + ']'}: ${l.msg}\n`);
          }
          return u.state === 'active' ? 0 : 3;
        }
        case 'start': { const r = sh.m.startUnit(unitName); if (!r.ok) { io.stderr.write(r.err + '\n'); return 1; } return 0; }
        case 'stop': { const r = sh.m.stopUnit(unitName); if (!r.ok) { io.stderr.write(r.err + '\n'); return 1; } return 0; }
        case 'restart': case 'reload-or-restart': { const r = sh.m.restartUnit(unitName); if (!r.ok) { io.stderr.write(r.err + '\n'); return 1; } return 0; }
        case 'reload': { if (!u) { io.stderr.write(`Failed to reload ${unitName}: Unit ${unitName}.service not found.\n`); return 5; } sh.m.log('systemd', `Reloading ${u.description}.`); return 0; }
        case 'enable': { if (!u) { io.stderr.write(`Failed to enable unit: Unit file ${unitName}.service does not exist.\n`); return 1; } u.enabled = true; io.stderr.write(`Created symlink /etc/systemd/system/multi-user.target.wants/${u.name} → ${u.unitFile}.\n`); if (opts['--now']) sh.m.startUnit(unitName); return 0; }
        case 'disable': { if (!u) { io.stderr.write(`Failed to disable unit: Unit file ${unitName}.service does not exist.\n`); return 1; } u.enabled = false; io.stderr.write(`Removed "/etc/systemd/system/multi-user.target.wants/${u.name}".\n`); if (opts['--now']) sh.m.stopUnit(unitName); return 0; }
        case 'is-active': { io.stdout.write((u ? u.state : 'inactive') + '\n'); return u && u.state === 'active' ? 0 : 3; }
        case 'is-enabled': { io.stdout.write((u && u.enabled ? 'enabled' : 'disabled') + '\n'); return u && u.enabled ? 0 : 1; }
        case 'is-failed': { io.stdout.write((u && u.state === 'failed' ? 'failed' : 'active') + '\n'); return u && u.state === 'failed' ? 0 : 1; }
        case 'cat': {
          if (!u) { io.stderr.write(`No files found for ${unitName}.service.\n`); return 1; }
          try {
            const txt = sh.m.fs.readFile(u.unitFile, { ctx: sh.m.ctxRoot() });
            io.stdout.write(`# ${u.unitFile}\n${txt}`);
            return 0;
          } catch (e) { }
          io.stdout.write(`# ${u.unitFile}\n[Unit]\nDescription=${u.description}\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=${u.execStart}\nRestart=${u.restart}\nUser=${u.user}\n\n[Install]\nWantedBy=multi-user.target\n`); return 0; }
        case 'show': {
          const props = (opts.p || opts['--property'] || '').split(',').filter(Boolean);
          const alvo = unitName || rest[1];
          const x = alvo ? sh.m.unit(alvo) : null;
          const todos = x ? {
            Id: x.name, Description: x.description, LoadState: 'loaded',
            ActiveState: x.state, SubState: x.sub, MainPID: x.mainPid || 0,
            ExecStart: x.execStart, Restart: x.restart, User: x.user,
            UnitFileState: x.enabled ? 'enabled' : 'disabled',
            FragmentPath: x.unitFile, Type: x.serviceType || 'simple',
            NRestarts: x.restartCount || 0,
            WorkingDirectory: x.workingDirectory || ''
          } : { Version: '258.2-1ubuntu4', Architecture: 'x86-64', Virtualization: 'kvm', NNames: String(sh.m.units.size) };
          if (!x && alvo) { io.stderr.write(`Unit ${alvo}.service could not be found.\n`); return 4; }
          const lista = props.length ? props : Object.keys(todos);
          for (const k of lista) io.stdout.write(`${k}=${todos[k] !== undefined ? todos[k] : ''}\n`);
          return 0;
        }
        case 'daemon-reload': case 'daemon-reexec': {
          const erros = sh.m.daemonReload();
          for (const e of erros) io.stderr.write(`${e}\n`);
          if (erros.length) io.stderr.write('systemd: Unit files contain errors; see above.\n');
          return 0;
        }
        case 'list-timers': { io.stdout.write('NEXT                        LEFT       LAST                        PASSED    UNIT                 ACTIVATES\nTue 2026-09-01 18:00:00 -03 5h 12min   Tue 2026-09-01 06:12:03 -03 6h ago    apt-daily.timer      apt-daily.service\n\n1 timers listed.\n'); return 0; }
        case 'reboot': case 'poweroff': case 'halt': io.stderr.write('Neste ambiente de estudo a máquina não reinicia. Use o botão "Reiniciar ambiente" da plataforma.\n'); return 1;
        case 'mask': if (u) { u.enabled = false; u.masked = true; } io.stderr.write(`Created symlink /etc/systemd/system/${unitName}.service → /dev/null.\n`); return 0;
        case 'unmask': if (u) u.masked = false; return 0;
        default:
          io.stderr.write(`Unknown command verb ${verb}.\n`);
          return 1;
      }
    }
  });

  defcmd({
    name: 'journalctl', path: '/usr/bin/journalctl', pkg: 'systemd',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { u: 1, n: 1, f: 0, e: 0, x: 0, r: 0, p: 1, b: 0, k: 0, '--unit': 1, '--lines': 1, '--since': 1, '--until': 1, '--no-pager': 0, '--follow': 0, '--priority': 1, '--grep': 1, '-xeu': 1, '--disk-usage': 0, '--vacuum-size': 1, '--vacuum-time': 1, '--verify': 0 });

      /* Quanto espaço o journal ocupa e como reduzi-lo — o par de comandos
         que resolve "o /var encheu e é tudo log". */
      if (opts['--disk-usage']) {
        const bytes = sh.m.journal.reduce((t, l) => t + String(l.msg || '').length + 120, 0) + 8 * 1024 * 1024;
        const mb = (bytes / 1048576).toFixed(1);
        io.stdout.write(`Archived and active journals take up ${mb}M in the file system.\n`);
        return 0;
      }
      if (opts['--vacuum-size'] || opts['--vacuum-time']) {
        if (sh.uid !== 0) { io.stderr.write('journalctl: Operation not permitted\n'); return 1; }
        const antes = sh.m.journal.length;
        const manter = opts['--vacuum-time'] ? Math.ceil(antes / 2) : Math.ceil(antes / 3);
        sh.m.journal = sh.m.journal.slice(-manter);
        io.stderr.write(`Deleted archived journal /var/log/journal/${'a1b2c3'}/system@0001.journal (${antes - manter} entries).\nVacuuming done, freed ${(((antes - manter) * 180000) / 1048576).toFixed(1)}M of archived journals.\n`);
        return 0;
      }
      let unit = opts.u || opts['--unit'];
      // suporta -xeu nome
      const xeu = args.findIndex(a => /^-[a-z]*u[a-z]*$/.test(a) && a.length > 2);
      if (xeu >= 0 && !unit) unit = args[xeu + 1];
      let logs = sh.m.journal.slice();
      if (unit) {
        if (!unit.includes('.')) unit += '.service';
        logs = logs.filter(l => l.unit === unit || l.forUnit === unit || (l.unit === 'systemd' && l.msg.includes(unit.replace('.service', ''))));
      }
      if (opts['--grep']) { const re = new RegExp(opts['--grep'], 'i'); logs = logs.filter(l => re.test(l.msg)); }
      if (opts.p || opts['--priority']) {
        const map = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 };
        const lvl = map[opts.p || opts['--priority']] !== undefined ? map[opts.p || opts['--priority']] : +(opts.p || opts['--priority']);
        logs = logs.filter(l => l.prio <= lvl);
      }
      const n = opts.n || opts['--lines'];
      if (n) logs = logs.slice(-(+n));
      if (opts.e) logs = logs.slice(-30);
      if (opts.r) logs.reverse();
      if (!logs.length) { io.stdout.write(`-- No entries --\n`); return 0; }
      io.stdout.write(`-- Journal begins at ${new Date(sh.m.bootTime).toString().slice(0, 33)}, ends at ${new Date().toString().slice(0, 33)}. --\n`);
      const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (const l of logs) {
        const d = new Date(l.ts);
        const tag = l.unit === 'systemd' ? 'systemd[1]' : `${l.unit.replace('.service', '')}[${l.pid || 1000}]`;
        const color = l.prio <= 3 ? C.red : (l.prio === 4 ? C.yellow : '');
        io.stdout.write(`${color}${MON[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${d.toTimeString().slice(0, 8)} ${sh.m.hostname} ${tag}: ${l.msg}${color ? C.reset : ''}\n`);
      }
      if (opts.f || opts['--follow']) {
        io.stdout.write(`${C.dim}[journalctl -f: acompanhando o journal... Ctrl+C para sair]${C.reset}\n`);
        if (io.term && io.term.follow) await io.term.follow(null, sh.m);
      }
      return 0;
    }
  });

  /* ============================== sistema ============================== */
  defcmd({
    name: 'uname', run: async ({ sh, io, args }) => {
      const { opts } = getopt(args, { a: 0, s: 0, n: 0, r: 0, v: 0, m: 0, o: 0, p: 0, i: 0, '--all': 0, '--kernel-release': 0 });
      const K = { s: 'Linux', n: sh.m.hostname, r: '6.14.0-27-generic', v: '#27-Ubuntu SMP PREEMPT_DYNAMIC Mon Aug 17 14:22:09 UTC 2026', m: 'x86_64', p: 'x86_64', i: 'x86_64', o: 'GNU/Linux' };
      if (opts.a || opts['--all']) { io.stdout.write(`${K.s} ${K.n} ${K.r} ${K.v} ${K.m} ${K.p} ${K.i} ${K.o}\n`); return 0; }
      const order = ['s', 'n', 'r', 'v', 'm', 'p', 'i', 'o'];
      const chosen = order.filter(k => opts[k]);
      io.stdout.write((chosen.length ? chosen.map(k => K[k]).join(' ') : K.s) + '\n');
      return 0;
    }
  });

  defcmd({
    name: 'hostname', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { i: 0, I: 0, f: 0, s: 0 });
      if (rest.length) {
        if (sh.uid !== 0) { io.stderr.write('hostname: you must be root to change the host name\n'); return 1; }
        sh.m.hostname = rest[0];
        sh.m.fs.writeFile('/etc/hostname', rest[0] + '\n', { ctx: sh.m.ctxRoot() });
        return 0;
      }
      if (opts.I || opts.i) { io.stdout.write(sh.m.primaryIp() + ' \n'); return 0; }
      io.stdout.write(sh.m.hostname + '\n');
      return 0;
    }
  });

  defcmd({
    name: 'hostnamectl', path: '/usr/bin/hostnamectl', pkg: 'systemd',
    run: async ({ sh, io, args }) => {
      const { rest } = getopt(args, {});
      if (rest[0] === 'set-hostname') {
        if (sh.uid !== 0) { io.stderr.write('Could not set property: Access denied\n'); return 1; }
        sh.m.hostname = rest[1];
        sh.m.fs.writeFile('/etc/hostname', rest[1] + '\n', { ctx: sh.m.ctxRoot() });
        return 0;
      }
      io.stdout.write(` Static hostname: ${sh.m.hostname}\n       Icon name: computer-vm\n         Chassis: vm 🖴\n      Machine ID: b7f4d1a9c3e64f2a8d05e71c9a3b6f42\n         Boot ID: 3a91f0c7d2e84b16a5c7092e1f4d8b03\n  Virtualization: kvm\nOperating System: Ubuntu 26.04.1 LTS\n          Kernel: Linux 6.14.0-27-generic\n    Architecture: x86-64\n Hardware Vendor: QEMU\n  Hardware Model: Standard PC\nFirmware Version: 1.16.3\n`);
      return 0;
    }
  });

  defcmd({
    name: 'uptime', pkg: 'procps', run: async ({ sh, io, args }) => {
      const up = sh.m.uptimeSec;
      const p = (x) => String(x).padStart(2, '0');
      const now = new Date();
      if (args.includes('-p')) { io.stdout.write(`up ${Math.floor(up / 3600)} hours, ${Math.floor((up % 3600) / 60)} minutes\n`); return 0; }
      if (args.includes('-s')) { io.stdout.write(new Date(sh.m.bootTime).toISOString().replace('T', ' ').slice(0, 19) + '\n'); return 0; }
      io.stdout.write(` ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())} up ${Math.floor(up / 3600)}:${p(Math.floor((up % 3600) / 60))},  1 user,  load average: ${sh.m.loadavg.map(l => l.toFixed(2)).join(', ')}\n`);
      return 0;
    }
  });

  defcmd({
    name: 'free', pkg: 'procps', run: async ({ sh, io, args }) => {
      const { opts } = getopt(args, { h: 0, m: 0, g: 0, t: 0, '--human': 0, '--mega': 0 });
      const m = sh.m.mem;
      const f = (mib) => opts.h || opts['--human'] ? humanSize(mib * 1024 * 1024) : (opts.g ? (mib / 1024).toFixed(1) : String(mib));
      io.stdout.write(`               total        used        free      shared  buff/cache   available\n`);
      io.stdout.write(`Mem:    ${f(m.total).padStart(12)}${f(m.used).padStart(12)}${f(m.free).padStart(12)}${f(4).padStart(12)}${f(m.buffcache).padStart(12)}${f(m.available).padStart(12)}\n`);
      io.stdout.write(`Swap:   ${f(m.swapTotal).padStart(12)}${f(m.swapUsed).padStart(12)}${f(m.swapTotal - m.swapUsed).padStart(12)}\n`);
      if (opts.t) io.stdout.write(`Total:  ${f(m.total + m.swapTotal).padStart(12)}${f(m.used + m.swapUsed).padStart(12)}${f(m.free + m.swapTotal - m.swapUsed).padStart(12)}\n`);
      return 0;
    }
  });

  defcmd({
    name: 'lscpu', pkg: 'util-linux', run: async ({ sh, io }) => {
      io.stdout.write(`Architecture:             x86_64\n  CPU op-mode(s):         32-bit, 64-bit\n  Address sizes:          46 bits physical, 48 bits virtual\n  Byte Order:             Little Endian\nCPU(s):                   ${sh.m.cpuCount}\n  On-line CPU(s) list:    0-${sh.m.cpuCount - 1}\nVendor ID:                GenuineIntel\n  Model name:             Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz\n    CPU family:           6\n    Model:                106\n    Thread(s) per core:   2\n    Core(s) per socket:   1\n    Socket(s):            1\n    CPU max MHz:          3500.0000\nVirtualization features:\n  Hypervisor vendor:      KVM\n  Virtualization type:    full\nCaches (sum of all):\n  L1d:                    48 KiB (1 instance)\n  L2:                     1.3 MiB (1 instance)\n  L3:                     54 MiB (1 instance)\n`);
      return 0;
    }
  });

  defcmd({
    name: 'dmesg', pkg: 'util-linux', run: async ({ sh, io, args }) => {
      if (sh.uid !== 0 && !args.includes('--help')) { io.stderr.write('dmesg: read kernel buffer failed: Operation not permitted\nDica: use "sudo dmesg".\n'); return 1; }
      const lines = [
        '[    0.000000] Linux version 6.14.0-27-generic (buildd@lcy02) (x86_64-linux-gnu-gcc-14) #27-Ubuntu SMP',
        '[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz-6.14.0-27-generic root=UUID=8f3b1c02 ro',
        '[    0.004000] KVM: Detected virtualization',
        '[    0.512331] Memory: 3985024K/4194304K available',
        '[    1.204118] virtio_net virtio0 eth0: renamed from enp0s3',
        '[    1.884012] EXT4-fs (vda2): mounted filesystem with ordered data mode',
        '[    2.114509] systemd[1]: Detected virtualization kvm.',
        '[    9.220317] docker0: port 1(veth9f2a11) entered blocking state'
      ];
      lines.forEach(l => io.stdout.write(l + '\n'));
      return 0;
    }
  });

  defcmd({
    name: ['env', 'printenv'], path: '/usr/bin/',
    run: async ({ sh, io, args, name, ex }) => {
      const { opts, rest } = getopt(args, { i: 0, u: 1, '0': 0 });
      if (name === 'printenv' && rest.length) {
        let status = 0;
        for (const r of rest) { const v = sh.vars.get(r); if (v && v.exported) io.stdout.write(v.value + '\n'); else status = 1; }
        return status;
      }
      const assigns = rest.filter(r => /^[A-Za-z_][A-Za-z0-9_]*=/.test(r));
      const cmd = rest.filter(r => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(r));
      if (cmd.length) {
        const saved = [];
        for (const a of assigns) { const eq = a.indexOf('='); saved.push([a.slice(0, eq), sh.vars.get(a.slice(0, eq))]); sh.setVar(a.slice(0, eq), a.slice(eq + 1), true); }
        try { return await ex.dispatch(cmd, io, { type: 'simple', words: [], assigns: [], redirs: [] }); }
        finally { for (const [n, old] of saved) { if (old) sh.vars.set(n, old); else sh.vars.delete(n); } }
      }
      for (const l of sh.exportedList()) io.stdout.write(l + '\n');
      return 0;
    }
  });

  defcmd({
    name: 'watch', pkg: 'procps', run: async ({ sh, io, args, ex }) => {
      const { opts, rest } = getopt(args, { n: 1, d: 0, t: 0 });
      const cmd = rest.join(' ');
      if (!cmd) { io.stderr.write('watch: no command specified\n'); return 1; }
      const render = async () => {
        const cap = new LX.Stream({ limit: 100000 });
        const sub = new LX.Executor(sh, { stdin: new LX.InStream(''), stdout: cap, stderr: cap, term: io.term });
        await sub.run(cmd);
        const every = opts.n || '2';
        return `Every ${every}.0s: ${cmd.padEnd(40)}${sh.m.hostname}: ${new Date().toString().slice(0, 24)}\n\n` + cap.value();
      };
      if (io.term && io.term.liveView) { await io.term.liveView(render, { title: 'watch', async: true, interval: (+(opts.n || 2)) * 1000 }); return 0; }
      io.stdout.write(await render());
      return 0;
    }
  });

  defcmd({
    name: 'logger', pkg: 'util-linux', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { t: 1, p: 1, s: 0 });
      const msg = rest.join(' ');
      sh.m.log(opts.t || sh.user, msg, 6);
      try { sh.m.fs.appendFile('/var/log/syslog', `Sep  1 ${new Date().toTimeString().slice(0, 8)} ${sh.m.hostname} ${opts.t || sh.user}: ${msg}\n`, { ctx: sh.m.ctxRoot() }); } catch (e) { }
      if (opts.s) io.stderr.write(`<13>${msg}\n`);
      return 0;
    }
  });

  defcmd({
    name: 'crontab', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, e: 0, r: 0, u: 1 });
      const user = opts.u || sh.user;
      const path = `/var/spool/cron/crontabs/${user}`;
      if (opts.l) {
        try { io.stdout.write(sh.m.fs.readFile(path, { ctx: sh.m.ctxRoot() })); return 0; }
        catch (e) { io.stderr.write(`no crontab for ${user}\n`); return 1; }
      }
      if (opts.r) { try { sh.m.fs.unlink(path, { ctx: sh.m.ctxRoot() }); } catch (e) { } return 0; }
      if (opts.e) {
        sh.m.fs.mkdirp('/var/spool/cron/crontabs', { ctx: sh.m.ctxRoot() });
        if (!sh.m.fs.exists(path, { ctx: sh.m.ctxRoot() }))
          sh.m.fs.writeFile(path, `# Edite este arquivo para definir tarefas agendadas.\n# m h  dom mon dow   command\n`, { ctx: sh.m.ctxRoot() });
        if (io.term && io.term.editor) { await io.term.editor(path); io.stdout.write('crontab: installing new crontab\n'); return 0; }
        return 0;
      }
      if (rest.length) {
        /* `crontab -` lê a agenda da entrada padrão: é assim que se instala
           um crontab a partir de script, sem abrir editor nenhum. */
        let c;
        if (rest[0] === '-') c = io.stdin.readAll();
        else {
          try { c = sh.m.fs.readFile(P(sh, rest[0]), sh.fsopts()); }
          catch (e) { io.stderr.write(`crontab: ${rest[0]}: No such file or directory\n`); return 1; }
        }
        /* validação mínima: cada linha útil precisa dos 5 campos + comando */
        const ruim = c.split('\n').map(l => l.trim())
          .filter(l => l && !l.startsWith('#') && !/^[A-Z_]+=/.test(l))
          .find(l => l.split(/\s+/).length < 6);
        if (ruim) {
          io.stderr.write(`crontab: errors in crontab file, can't install.\n"${ruim}": bad command\n`);
          return 1;
        }
        sh.m.fs.mkdirp('/var/spool/cron/crontabs', { ctx: sh.m.ctxRoot() });
        const n = sh.m.fs.writeFile(path, c.endsWith('\n') ? c : c + '\n', { ctx: sh.m.ctxRoot() });
        n.mode = 0o600;
        io.stdout.write(`crontab: installing new crontab\n`);
        return 0;
      }
      io.stderr.write('usage: crontab [-u user] file\n       crontab [-u user] [-l | -r | -e]\n');
      return 1;
    }
  });

})();
