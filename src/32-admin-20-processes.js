/* =========================================================================
   TERMINALIS — processos
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, defcmd, getopt, C } = LX;
  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }

  /* ============================== processos ============================== */
  defcmd({
    name: 'ps', pkg: 'procps',
    run: async ({ sh, io, args }) => {
      const raw = args.join(' ');
      const bsd = /[^-]?\b(aux|ax|au|ef)\b/.test(raw) || args.some(a => !a.startsWith('-') && /^[aux]+$/.test(a));
      const full = raw.includes('-ef') || raw.includes('f');
      const all = raw.includes('a') || raw.includes('-e') || raw.includes('A');
      const { opts } = getopt(args, { p: 1, u: 1, o: 1, C: 1 });
      let procs = Array.from(sh.m.processes.values());
      if (sh.m.docker) procs = procs.concat(sh.m.docker.hostProcesses());
      if (opts.p) procs = procs.filter(p => String(opts.p).split(',').includes(String(p.pid)));
      else if (opts.C) procs = procs.filter(p => p.comm === opts.C);
      else if (!all && !raw.includes('-e')) procs = procs.filter(p => p.user === sh.user && p.tty !== '?');
      procs.sort((a, b) => a.pid - b.pid);
      if (raw.includes('aux') || raw.includes('-aux')) {
        io.stdout.write('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n');
        for (const p of procs) {
          io.stdout.write(`${p.user.padEnd(9).slice(0, 12)} ${String(p.pid).padStart(5)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${String(p.vsz).padStart(6)} ${String(p.rss).padStart(5)} ${p.tty.padEnd(8)} ${(p.state + (p.pid === 1 ? 's' : '')).padEnd(4)} ${p.startTime.padStart(5)} ${('0:0' + (p.pid % 9)).padStart(6)} ${p.cmd}\n`);
        }
        return 0;
      }
      if (raw.includes('-ef')) {
        io.stdout.write('UID          PID    PPID  C STIME TTY          TIME CMD\n');
        for (const p of procs) {
          io.stdout.write(`${p.user.padEnd(8).slice(0, 12)} ${String(p.pid).padStart(6)} ${String(p.ppid).padStart(7)}  0 ${p.startTime} ${p.tty.padEnd(8)} ${('00:00:0' + (p.pid % 9))} ${p.cmd}\n`);
        }
        return 0;
      }
      if (opts.o) {
        // "-o comm=" suprime o cabeçalho daquela coluna (e, se todas tiverem =, some o cabeçalho)
        const brutas = String(opts.o).split(/[, ]+/).filter(Boolean);
        const cols = brutas.map(c => {
          const i = c.indexOf('=');
          return i < 0 ? { nome: c, titulo: null } : { nome: c.slice(0, i), titulo: c.slice(i + 1) };
        });
        const ordenar = /--sort=(\S+)/.exec(raw);
        if (ordenar) {
          const campo = ordenar[1].replace(/^[-+]/, '');
          const desc = ordenar[1].startsWith('-');
          const val = (p) => ({ pid: p.pid, ppid: p.ppid, pcpu: p.cpu, '%cpu': p.cpu, pmem: p.mem, '%mem': p.mem, rss: p.rss, vsz: p.vsz, comm: p.comm, user: p.user }[campo]);
          procs.sort((a, b) => { const x = val(a), y = val(b); const c = (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))); return desc ? -c : c; });
        }
        const semCabecalho = cols.every(c => c.titulo !== null);
        if (!semCabecalho) {
          io.stdout.write(cols.map(c => (c.titulo === null ? c.nome.toUpperCase() : c.titulo).padEnd(8)).join(' ').trimEnd() + '\n');
        }
        for (const p of procs) {
          io.stdout.write(cols.map(c => {
            const v = { pid: p.pid, ppid: p.ppid, pgid: p.pid, user: p.user, ruser: p.user, comm: p.comm, cmd: p.cmd, args: p.cmd, stat: p.state, s: p.state, state: p.state, '%cpu': p.cpu.toFixed(1), pcpu: p.cpu.toFixed(1), '%mem': p.mem.toFixed(1), pmem: p.mem.toFixed(1), rss: p.rss, vsz: p.vsz, tty: p.tty, etime: p.etime, etimes: p.etime, nice: p.nice === undefined ? 0 : p.nice, ni: p.nice === undefined ? 0 : p.nice, start: p.startTime, time: '00:00:0' + (p.pid % 9) }[c.nome.toLowerCase()];
            return String(v === undefined ? '' : v).padEnd(cols.length === 1 ? 0 : 8);
          }).join(' ').trimEnd() + '\n');
        }
        return 0;
      }
      io.stdout.write('    PID TTY          TIME CMD\n');
      for (const p of procs) io.stdout.write(`${String(p.pid).padStart(7)} ${p.tty.padEnd(8)} ${('00:00:0' + (p.pid % 9))} ${p.comm}\n`);
      return 0;
    }
  });

  defcmd({
    name: ['top', 'htop'], path: '/usr/bin/', pkg: 'procps',
    run: async ({ sh, io, args, name }) => {
      const { opts } = getopt(args, { b: 0, n: 1, d: 1, p: 1, o: 1, H: 0 });
      const render = () => {
        const procs = Array.from(sh.m.processes.values()).concat(sh.m.docker ? sh.m.docker.hostProcesses() : []);
        procs.sort((a, b) => b.cpu - a.cpu || b.mem - a.mem);
        const up = sh.m.uptimeSec;
        const pad = (x, n = 2) => String(x).padStart(n, '0');
        const now = new Date();
        const m = sh.m.mem;
        let out = '';
        out += `top - ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} up ${Math.floor(up / 3600)}:${pad(Math.floor((up % 3600) / 60))},  1 user,  load average: ${sh.m.loadavg.map(l => l.toFixed(2)).join(', ')}\n`;
        out += `Tasks: ${String(procs.length).padStart(3)} total,   1 running, ${String(procs.length - 1).padStart(3)} sleeping,   0 stopped,   0 zombie\n`;
        const cpuUsed = Math.min(99, procs.reduce((s, p) => s + p.cpu, 0));
        out += `%Cpu(s): ${cpuUsed.toFixed(1).padStart(4)} us,  1.0 sy,  0.0 ni, ${(100 - cpuUsed - 1).toFixed(1).padStart(4)} id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st\n`;
        out += `MiB Mem :  ${String(m.total).padStart(7)}.0 total, ${String(m.free).padStart(7)}.0 free, ${String(m.used).padStart(7)}.0 used, ${String(m.buffcache).padStart(7)}.0 buff/cache\n`;
        out += `MiB Swap:  ${String(m.swapTotal).padStart(7)}.0 total, ${String(m.swapTotal - m.swapUsed).padStart(7)}.0 free, ${String(m.swapUsed).padStart(7)}.0 used. ${String(m.available).padStart(7)}.0 avail Mem\n\n`;
        out += `${C.reset}\x1b[7m    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND                \x1b[0m\n`;
        for (const p of procs.slice(0, 18)) {
          out += `${String(p.pid).padStart(7)} ${p.user.padEnd(9).slice(0, 9)} 20   0 ${String(p.vsz).padStart(7)} ${String(p.rss).padStart(6)} ${String(Math.round(p.rss * 0.4)).padStart(6)} ${p.state} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)}   0:0${p.pid % 9}.${pad(p.pid % 60)} ${p.comm}\n`;
        }
        return out;
      };
      if (opts.b || io.inPipe || !io.term || !io.term.liveView) {
        io.stdout.write(render());
        return 0;
      }
      await io.term.liveView(render, { title: name });
      return 0;
    }
  });

  defcmd({
    name: 'kill', run: async ({ sh, io, args }) => {
      let sig = 15;
      const targets = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-l') {
          if (args[i + 1]) { io.stdout.write((LX.SIGNALS[+args[i + 1]] || '') + '\n'); return 0; }
          const list = Object.entries(LX.SIGNALS).map(([n, s]) => `${String(n).padStart(2)}) SIG${s}`);
          for (let k = 0; k < list.length; k += 4) io.stdout.write(list.slice(k, k + 4).map(s => s.padEnd(16)).join('') + '\n');
          return 0;
        }
        if (a === '-s' || a === '-n') { sig = args[++i]; continue; }
        if (/^-\d+$/.test(a)) { sig = +a.slice(1); continue; }
        if (/^-[A-Za-z]/.test(a)) { sig = a.slice(1).toUpperCase(); continue; }
        targets.push(a);
      }
      if (!targets.length) { io.stderr.write('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n'); return 2; }
      let status = 0;
      for (const t of targets) {
        let pid = t;
        if (String(t).startsWith('%')) {
          const j = sh.jobs.find(j => j.id === +String(t).slice(1));
          if (!j) { io.stderr.write(`bash: kill: ${t}: no such job\n`); status = 1; continue; }
          pid = j.pid; j.state = 'Terminated';
        }
        try {
          const ok = sh.m.kill(pid, sig);
          if (!ok) io.stderr.write(`kill: (${pid}) - Operation not permitted\n`);
        }
        catch (e) { io.stderr.write(`kill: (${pid}) - No such process\n`); status = 1; }
      }
      return status;
    }
  });

  defcmd({
    name: 'killall', pkg: 'psmisc', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { '9': 0, s: 1, i: 0, v: 0, u: 1 });
      let sig = 15;
      for (const a of args) if (/^-[A-Za-z0-9]+$/.test(a) && a !== '-i' && a !== '-v') sig = /^\-\d+$/.test(a) ? +a.slice(1) : a.slice(1).toUpperCase();
      if (opts.s) sig = opts.s;
      let status = 0;
      for (const nm of rest) {
        const procs = sh.m.findProcs(p => p.comm === nm || p.cmd.split(/\s+/)[0].split('/').pop() === nm);
        if (!procs.length) { io.stderr.write(`${nm}: no process found\n`); status = 1; continue; }
        for (const p of procs) { sh.m.kill(p.pid, sig); if (opts.v) io.stdout.write(`Killed ${nm}(${p.pid}) with signal ${sig}\n`); }
      }
      return status;
    }
  });

  defcmd({
    name: ['pgrep', 'pkill'], path: '/usr/bin/', pkg: 'procps',
    run: async ({ sh, io, args, name }) => {
      const { opts, rest } = getopt(args, { l: 0, a: 0, f: 0, u: 1, n: 0, o: 0, c: 0, x: 0, '9': 0, signal: 1 });
      // "-9" e "-KILL" caem em rest (não são opções com valor): são o sinal, não o padrão
      const sinais = rest.filter(a => /^-(\d+|(SIG)?[A-Z]+)$/.test(a));
      const alvos = rest.filter(a => !/^-(\d+|(SIG)?[A-Z]+)$/.test(a));
      const pat = alvos[0] || '';
      let re;
      try { re = new RegExp(opts.x ? `^${pat}$` : pat); } catch (e) { io.stderr.write(`${name}: invalid pattern\n`); return 2; }
      let procs = Array.from(sh.m.processes.values()).filter(p => re.test(opts.f ? p.cmd : p.comm));
      if (opts.u) procs = procs.filter(p => p.user === opts.u || String(p.uid) === opts.u);
      if (opts.n) procs = procs.slice(-1);
      if (opts.o) procs = procs.slice(0, 1);
      if (!procs.length) { if (opts.c) io.stdout.write('0\n'); return 1; }
      if (name === 'pkill') {
        let sig = 15;
        for (const a of sinais) { if (/^-\d+$/.test(a)) sig = +a.slice(1); else sig = a.slice(1); }
        if (opts['9']) sig = 9;
        for (const p of procs) sh.m.kill(p.pid, sig);
        return 0;
      }
      if (opts.c) { io.stdout.write(procs.length + '\n'); return procs.length ? 0 : 1; }
      for (const p of procs) io.stdout.write(opts.a ? `${p.pid} ${p.cmd}\n` : (opts.l ? `${p.pid} ${p.comm}\n` : `${p.pid}\n`));
      return 0;
    }
  });

  defcmd({
    name: 'pstree', path: '/usr/bin/pstree', pkg: 'psmisc', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { p: 0, u: 0, a: 0, n: 0, '--help': 0 });
      const procs = Array.from(sh.m.processes.values());
      const raiz = rest.length ? procs.find(p => String(p.pid) === rest[0] || p.comm === rest[0]) : procs.find(p => p.pid === 1);
      if (!raiz) { io.stderr.write(`pstree: no process found\n`); return 1; }
      const filhos = (pid) => procs.filter(p => p.ppid === pid && p.pid !== pid).sort((a, b) => a.pid - b.pid);
      const rotulo = (p) => p.comm + (opts.p ? `(${p.pid})` : '') + (opts.u && p.user !== 'root' ? `(${p.user})` : '') + (opts.a && p.cmd ? ' ' + p.cmd.split(/\s+/).slice(1).join(' ') : '');
      const desenha = (p, prefixo, ultimo, raizQ) => {
        io.stdout.write(raizQ ? rotulo(p) + '\n' : prefixo + (ultimo ? '└─' : '├─') + rotulo(p) + '\n');
        const f = filhos(p.pid);
        const novo = raizQ ? '  ' : prefixo + (ultimo ? '   ' : '│  ');
        f.forEach((c, i) => desenha(c, novo, i === f.length - 1, false));
      };
      desenha(raiz, '', true, true);
      return 0;
    }
  });

  defcmd({
    name: 'timeout', path: '/usr/bin/timeout', run: async ({ sh, io, args, ex }) => {
      const { opts, rest } = getopt(args, { s: 1, k: 1, '--signal': 1, '--preserve-status': 0, '--foreground': 0 });
      let limite = rest.shift();
      if (limite === undefined || !rest.length) { io.stderr.write('timeout: missing operand\nTry \'timeout --help\' for more information.\n'); return 125; }
      const seg = parseFloat(limite) * ({ s: 1, m: 60, h: 3600, d: 86400 }[String(limite).slice(-1)] || 1);
      const prazo = Date.now() + seg * 1000;
      const antes = io.term && io.term.deadline;
      if (io.term) io.term.deadline = prazo;
      try {
        const st = await ex.dispatch(rest, io, { type: 'simple', words: [], assigns: [], redirs: [] });
        if (io.term && io.term.timedOut) { io.term.timedOut = false; return 124; }
        return st;
      } finally { if (io.term) io.term.deadline = antes; }
    }
  });

  defcmd({
    name: 'fuser', path: '/usr/bin/fuser', pkg: 'psmisc', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { v: 0, k: 0, m: 0, n: 1, '-9': 0 });
      let status = 1;
      for (const alvo of rest) {
        const porta = /^(\d+)\/(tcp|udp)$/.exec(alvo);
        if (porta) {
          const ls = sh.m.listeners.filter(l => l.port === +porta[1] && l.proto === porta[2]);
          if (!ls.length) continue;
          status = 0;
          if (opts.v) {
            io.stdout.write('                     USER        PID ACCESS COMMAND\n');
            for (const l of ls) {
              const p = sh.m.procByPid(l.pid);
              io.stdout.write(`${alvo.padEnd(20)} ${(p ? p.user : 'root').padEnd(11)} ${String(l.pid).padStart(4)} F.... ${l.process}\n`);
            }
          } else {
            io.stderr.write(`${alvo}:`);
            io.stdout.write(ls.map(l => ' ' + l.pid).join('') + '\n');
          }
          if (opts.k) for (const l of ls) { try { sh.m.kill(l.pid, 9); } catch (e) { } }
          continue;
        }
        // arquivo ou diretório: procura processos com aquele cwd
        let alvoAbs;
        try { alvoAbs = P(sh, alvo); sh.m.fs.lstat(alvoAbs, sh.fsopts()); }
        catch (e) { io.stderr.write(`Specified filename ${alvo} does not exist.\n`); continue; }
        const usando = Array.from(sh.m.processes.values()).filter(p => (p.cwd || '').startsWith(alvoAbs) || (p.cmd || '').includes(alvoAbs));
        if (!usando.length) continue;
        status = 0;
        if (opts.v) {
          io.stdout.write('                     USER        PID ACCESS COMMAND\n');
          for (const p of usando) io.stdout.write(`${alvoAbs.padEnd(20)} ${p.user.padEnd(11)} ${String(p.pid).padStart(4)} ..c.. ${p.comm}\n`);
        } else {
          io.stderr.write(`${alvoAbs}:`);
          io.stdout.write(usando.map(p => ' ' + p.pid + 'c').join('') + '\n');
        }
        if (opts.k) for (const p of usando) { try { sh.m.kill(p.pid, 9); } catch (e) { } }
      }
      return status;
    }
  });

  defcmd({
    name: 'pidof', path: '/usr/bin/pidof', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { s: 0, x: 0, q: 0 });
      const alvos = rest;
      if (!alvos.length) return 1;
      let pids = [];
      for (const alvo of alvos) {
        const base = alvo.replace(/^.*\//, '');
        for (const p of sh.m.processes.values()) {
          if (p.comm === base || p.comm === alvo || (p.cmd || '').split(/\s+/)[0].replace(/^.*\//, '') === base) pids.push(p.pid);
        }
      }
      pids = Array.from(new Set(pids)).sort((a, b) => b - a);
      if (!pids.length) return 1;
      if (opts.s) pids = pids.slice(0, 1);
      if (!opts.q) io.stdout.write(pids.join(' ') + '\n');
      return 0;
    }
  });

  defcmd({
    name: 'nice', path: '/usr/bin/nice', run: async ({ sh, io, args, ex }) => {
      const { opts, rest } = getopt(args, { n: 1, '--adjustment': 1 });
      const inc = +(opts.n || opts['--adjustment'] || 10);
      if (!rest.length) { io.stdout.write(String(sh.nice || 0) + '\n'); return 0; }
      if (inc < 0 && sh.uid !== 0) { io.stderr.write("nice: cannot set niceness: Permission denied\n"); return 1; }
      const antes = sh.nice || 0;
      sh.nice = antes + inc;
      try { return await ex.dispatch(rest, io, { type: 'simple', words: [], assigns: [], redirs: [] }); }
      finally { sh.nice = antes; }
    }
  });

  defcmd({
    name: 'renice', path: '/usr/bin/renice', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { p: 1, n: 1, u: 1, g: 1 });
      let prioridade = opts.n !== undefined ? +opts.n : (rest.length && /^-?\d+$/.test(rest[0]) ? +rest.shift() : null);
      if (prioridade === null) { io.stderr.write('usage: renice [-n] priority [[-p] pid ...] [[-u] user ...]\n'); return 1; }
      const alvos = [];
      if (opts.p) alvos.push(...String(opts.p).split(/[, ]+/));
      alvos.push(...rest);
      if (!alvos.length && !opts.u) { io.stderr.write('renice: nenhum processo informado\n'); return 1; }
      let status = 0;
      const ajusta = (p) => {
        if (sh.uid !== 0 && (p.user !== sh.user || prioridade < (p.nice || 0))) {
          io.stderr.write(`renice: failed to set priority for ${p.pid} (process ID): Permission denied\n`); status = 1; return;
        }
        const antes = p.nice || 0;
        p.nice = prioridade;
        io.stdout.write(`${p.pid} (process ID) old priority ${antes}, new priority ${p.nice}\n`);
      };
      if (opts.u) {
        for (const p of sh.m.processes.values()) if (p.user === opts.u) ajusta(p);
      }
      for (const a of alvos) {
        const p = sh.m.processes.get(+a);
        if (!p) { io.stderr.write(`renice: failed to get priority for ${a} (process ID): No such process\n`); status = 1; continue; }
        ajusta(p);
      }
      return status;
    }
  });

  defcmd({
    name: 'nohup', run: async ({ sh, io, args, ex }) => {
      if (!args.length) { io.stderr.write('nohup: missing operand\n'); return 125; }
      io.stderr.write("nohup: ignoring input and appending output to 'nohup.out'\n");
      const outPath = P(sh, 'nohup.out');
      if (!sh.m.fs.exists(outPath, sh.fsopts())) sh.m.fs.create(outPath, '', sh.fsopts());
      const fileIo = { stdin: new LX.InStream(''), stdout: new LX.FileStream(sh, outPath, true), stderr: new LX.FileStream(sh, outPath, true), term: io.term };
      const p = sh.m.spawn({ cmd: args.join(' '), comm: args[0], user: sh.user, uid: sh.uid, gid: sh.gid, tty: '?' });
      const sub = new LX.Executor(sh, fileIo);
      await sub.dispatch(args, fileIo, { type: 'simple', words: [], assigns: [], redirs: [] });
      return 0;
    }
  });

})();
