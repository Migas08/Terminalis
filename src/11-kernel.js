/* =========================================================================
   TERMINALIS — Máquina virtual: usuários, processos, systemd, rede, pacotes
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, Inode, SysError, modeToRwx } = LX;

  /* ---------------- Processo ---------------- */
  let PID_SEQ = 1;
  class Process {
    constructor(o) {
      this.pid = o.pid !== undefined ? o.pid : ++PID_SEQ;
      this.ppid = o.ppid !== undefined ? o.ppid : 1;
      this.uid = o.uid !== undefined ? o.uid : 0;
      this.gid = o.gid !== undefined ? o.gid : 0;
      this.user = o.user || 'root';
      this.cmd = o.cmd || '';
      this.comm = o.comm || (this.cmd.split(/\s+/)[0] || '').split('/').pop();
      this.state = o.state || 'S';       // R running, S sleeping, D uninterruptible, T stopped, Z zombie
      this.cpu = o.cpu !== undefined ? o.cpu : 0.0;
      this.mem = o.mem !== undefined ? o.mem : 0.5;
      this.rss = o.rss !== undefined ? o.rss : Math.round(this.mem * 40960);
      this.vsz = o.vsz !== undefined ? o.vsz : this.rss * 6;
      this.tty = o.tty || '?';
      this.start = o.start || Date.now();
      this.nice = o.nice || 0;
      this.threads = o.threads || 1;
      this.unit = o.unit || null;        // unidade systemd dona
      this.container = o.container || null;
      this.unkillable = o.unkillable || false;
      this.ignoresTerm = o.ignoresTerm || false;
      this.onSignal = o.onSignal || null;
      this.job = null;
    }
    get etime() {
      const s = Math.floor((Date.now() - this.start) / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    get startTime() {
      const d = new Date(this.start);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  LX.Process = Process;

  const SIGNALS = {
    1: 'HUP', 2: 'INT', 3: 'QUIT', 4: 'ILL', 6: 'ABRT', 8: 'FPE', 9: 'KILL', 10: 'USR1',
    11: 'SEGV', 12: 'USR2', 13: 'PIPE', 14: 'ALRM', 15: 'TERM', 17: 'CHLD', 18: 'CONT',
    19: 'STOP', 20: 'TSTP', 28: 'WINCH'
  };
  const SIGNUM = {};
  for (const k in SIGNALS) { SIGNUM[SIGNALS[k]] = +k; SIGNUM['SIG' + SIGNALS[k]] = +k; }
  LX.SIGNALS = SIGNALS; LX.SIGNUM = SIGNUM;

  /* ---------------- Unidade systemd ---------------- */
  class Unit {
    constructor(o) {
      Object.assign(this, {
        name: o.name,
        description: o.description || o.name,
        type: o.type || 'service',
        state: o.state || 'inactive',     // active | inactive | failed | activating
        sub: o.sub || 'dead',             // running | dead | exited | failed
        enabled: o.enabled !== undefined ? o.enabled : false,
        execStart: o.execStart || '',
        mainPid: null,
        ports: o.ports || [],             // [{port, proto}]
        after: o.after || [],
        wants: o.wants || [],
        restart: o.restart || 'on-failure',
        user: o.user || 'root',
        configFiles: o.configFiles || [],
        validate: o.validate || null,     // fn(machine) -> null | {msg, journal:[]}
        onStart: o.onStart || null,
        onStop: o.onStop || null,
        broken: o.broken || null,
        workingDirectory: o.workingDirectory || null,
        environment: o.environment || {},
        execStartPre: o.execStartPre || null,
        restartSec: o.restartSec !== undefined ? o.restartSec : 1,
        wantedBy: o.wantedBy || 'multi-user.target',
        serviceType: o.serviceType || 'simple',
        fromFile: o.fromFile || false,
        unitFile: o.unitFile || `/lib/systemd/system/${o.name}`
      });
    }
  }
  LX.Unit = Unit;

  /* ---------------- Máquina ---------------- */
  class Machine {
    constructor(opts = {}) {
      this.fs = new FileSystem();
      this.hostname = opts.hostname || 'srv-aula';
      this.bootTime = Date.now() - (opts.uptime || 3 * 3600 + 1200) * 1000;
      this.processes = new Map();
      this.units = new Map();
      this.journal = [];
      this.packages = new Map();
      this.aptCache = new Map();
      this.listeners = [];   // {addr, port, proto, pid, process, container}
      this.dns = new Map();  // nome -> ip
      this.interfaces = [];
      this.routes = [];
      this.arp = [];
      this.remoteHosts = new Map();  // hosts SSH alcançáveis
      this.sshKeysAuthorized = new Map();
      this.timers = [];
      this.crontabs = new Map();
      this.docker = null;    // preenchido por 40-docker.js
      this.mem = { total: 4014, used: 812, free: 1900, buffcache: 1302, available: 2960, swapTotal: 2048, swapUsed: 0 };
      this.cpuCount = 2;
      this.loadavg = [0.08, 0.12, 0.09];
      this.diskUsedKb = 3_150_000;
      this.diskTotalKb = 20_508_296;
      this.firewall = { enabled: false, defaultIn: 'deny', defaultOut: 'allow', rules: [], backend: 'ufw' };
      this.nextPid = 900;
      this.container = !!opts.container;
      this._buildBaseSystem();
      if (this.container) this._virarContainer();
    }

    /* =====================================================================
       Transforma esta máquina no interior de um container.
       Um container NÃO é uma máquina virtual: não tem boot, não tem
       systemd, não tem journal, não tem serviços de sistema. Tem o seu
       processo como PID 1 e mais nada. Tudo isso é retirado aqui, e é
       exatamente o que o aluno enxerga quando roda `ps aux` lá dentro.
       ===================================================================== */
    _virarContainer() {
      const ctx = this.ctxRoot();
      this.processes.clear();
      this.units.clear();
      this.journal.length = 0;
      this.listeners.length = 0;
      this.timers.length = 0;
      this.crontabs.clear();
      this.remoteHosts.clear();
      this.dns.clear();
      this.nextPid = 1;
      this.firewall = { enabled: false, defaultIn: 'allow', defaultOut: 'allow', rules: [], backend: 'nenhum' };

      /* o container enxerga apenas a sua interface na rede do Docker */
      this.interfaces = [
        { name: 'lo', mac: '00:00:00:00:00:00', ipv4: '127.0.0.1/8', ipv6: '::1/128', state: 'UNKNOWN', mtu: 65536, flags: 'LOOPBACK,UP,LOWER_UP', rx: 0, tx: 0 }
      ];
      this.routes = [];
      this.arp = [];
      this.blockDevices = [];
      this.fs.mounts = [
        { dev: 'overlay', mount: '/', type: 'overlay', opts: 'rw,relatime,lowerdir=/var/lib/docker/overlay2/l', sizeKb: 20508296, usedKb: 3150000 },
        { dev: 'proc', mount: '/proc', type: 'proc', opts: 'rw,nosuid,nodev,noexec,relatime', sizeKb: 0, usedKb: 0 },
        { dev: 'tmpfs', mount: '/dev', type: 'tmpfs', opts: 'rw,nosuid,size=65536k,mode=755', sizeKb: 65536, usedKb: 0 },
        { dev: 'sysfs', mount: '/sys', type: 'sysfs', opts: 'ro,nosuid,nodev,noexec,relatime', sizeKb: 0, usedKb: 0 }
      ];

      /* sem systemd, sem cron, sem ssh, sem apt cheio de coisa instalada */
      for (const p of ['/etc/crontab', '/etc/fstab', '/etc/logrotate.conf']) {
        try { this.fs.unlink(p, { ctx }); } catch (e) { }
      }
      for (const d of ['/etc/systemd', '/lib/systemd', '/etc/cron.d', '/etc/cron.daily',
        '/etc/cron.hourly', '/etc/cron.weekly', '/etc/ssh', '/etc/logrotate.d']) {
        try { this.fs.rmrf(d, { ctx }); } catch (e) { try { this.fs.rmdir(d, { ctx }); } catch (e2) { } }
      }
      /* o resolvedor do Docker responde em 127.0.0.11 dentro de toda rede
         definida pelo usuário — é ele que faz o nome do serviço virar IP */
      try { this.fs.writeFile('/etc/resolv.conf', 'nameserver 127.0.0.11\noptions ndots:0\n', { ctx }).mode = 0o644; } catch (e) { }

      this.packages.clear();
      for (const [n, v, d] of [
        ['bash', '5.2.15-2', 'GNU Bourne Again SHell'],
        ['coreutils', '9.4-3', 'GNU core utilities'],
        ['dash', '0.5.12-6', 'POSIX-compliant shell'],
        ['apt', '2.7.14', 'commandline package manager'],
        ['dpkg', '1.22.6', 'Debian package management system']
      ]) this.packages.set(n, { name: n, version: v, description: d, installed: true, size: 1024 * (20 + n.length * 5) });
    }

    /* ---------- utilidades ---------- */
    get uptimeSec() { return Math.floor((Date.now() - this.bootTime) / 1000); }
    ctxRoot() { return { uid: 0, gid: 0, groups: [0] }; }

    log(unit, msg, prio = 6, pid = null, forUnit = null) {
      this.journal.push({ ts: Date.now(), unit, pid, prio, msg, host: this.hostname, forUnit });
      if (this.journal.length > 4000) this.journal.splice(0, 500);
    }

    spawn(o) {
      const p = new Process(Object.assign({ pid: ++this.nextPid }, o));
      this.processes.set(p.pid, p);
      return p;
    }
    findProcs(pred) { return Array.from(this.processes.values()).filter(pred); }
    procByPid(pid) { return this.processes.get(+pid) || null; }

    kill(pid, sig = 15) {
      const p = this.processes.get(+pid);
      if (!p) throw new SysError('ESRCH');
      const name = typeof sig === 'string' ? sig.replace(/^SIG/, '') : SIGNALS[sig];
      if (p.pid === 1) return false;
      if (p.onSignal) { const r = p.onSignal(name); if (r === false) return false; }
      if (name === 'STOP' || name === 'TSTP') { p.state = 'T'; return true; }
      if (name === 'CONT') { p.state = 'S'; return true; }
      if (name === 'KILL') { this._reap(p, 'SIGKILL'); return true; }
      if (name === 'TERM' || name === 'INT' || name === 'HUP' || name === 'QUIT') {
        if (p.unkillable || p.ignoresTerm) return false;
        this._reap(p, 'SIG' + name);
        return true;
      }
      return true;
    }
    _reap(p, how) {
      this.processes.delete(p.pid);
      this.listeners = this.listeners.filter(l => l.pid !== p.pid);
      if (p.unit) {
        const u = this.units.get(p.unit);
        if (u && u.mainPid === p.pid) {
          u.mainPid = null;
          const morreuMal = (how === 'SIGKILL' || how === 'SIGSEGV');
          if (morreuMal) { u.state = 'failed'; u.sub = 'failed'; this.log(u.name, `Main process exited, code=killed, status=9/${how.replace('SIG', '')}`, 3); this.log(u.name, `Failed with result 'signal'.`, 3); }
          else { u.state = 'inactive'; u.sub = 'dead'; this.log(u.name, `Deactivated successfully.`, 6); }
          // Restart=: o supervisor levanta o serviço de novo — é por isso que
          // "matar o PID" não resolve nada em um serviço gerenciado pelo systemd
          const politica = u.restart || 'no';
          const deveReiniciar = politica === 'always' || (politica === 'on-failure' && morreuMal) ||
            (politica === 'on-abnormal' && morreuMal);
          if (deveReiniciar && !this._reiniciando) {
            this._reiniciando = true;
            try {
              this.log('systemd', `${u.name}: Scheduled restart job, restart counter is at ${(u.restartCount = (u.restartCount || 0) + 1)}.`, 6, 1, u.name);
              this.startUnit(u.name);
            } finally { this._reiniciando = false; }
          }
        }
      }
      // filhos viram órfãos adotados pelo init
      for (const c of this.processes.values()) if (c.ppid === p.pid) c.ppid = 1;
    }

    /* ---------- portas ---------- */
    /* Todas as portas ocupadas nesta máquina — inclusive as que o Docker
       publicou por conta dos containers. É por isso que subir um container
       em -p 80:80 falha quando o nginx do host já está na 80. */
    todosListeners() {
      return this.docker ? this.listeners.concat(this.docker.hostListeners()) : this.listeners;
    }
    portInUse(port, proto = 'tcp', addr = '0.0.0.0') {
      return this.todosListeners().find(l => l.port === +port && l.proto === proto &&
        (l.addr === '0.0.0.0' || addr === '0.0.0.0' || l.addr === addr));
    }
    listen(o) {
      const clash = this.portInUse(o.port, o.proto || 'tcp', o.addr || '0.0.0.0');
      if (clash) { const e = new SysError('EADDRINUSE'); e.clash = clash; throw e; }
      const l = Object.assign({ addr: '0.0.0.0', proto: 'tcp' }, o);
      this.listeners.push(l);
      return l;
    }
    unlisten(pred) { this.listeners = this.listeners.filter(l => !pred(l)); }

    /* ---------- systemd ---------- */
    addUnit(o) {
      const u = new Unit(o);
      this.units.set(u.name, u);
      if (!o.fromFile) { try { this.writeUnitFile(u); } catch (e) { } }
      return u;
    }

    /* materializa o arquivo .service em disco, para systemctl cat e leitura pelo aluno */
    writeUnitFile(u) {
      const ctx = this.ctxRoot();
      const txt =
        `[Unit]\nDescription=${u.description}\n` +
        (u.after.length ? `After=${u.after.join(' ')}\n` : 'After=network.target\n') +
        `\n[Service]\nType=${u.serviceType}\nExecStart=${u.execStart}\n` +
        (u.user && u.user !== 'root' ? `User=${u.user}\n` : '') +
        `Restart=${u.restart}\n` +
        `\n[Install]\nWantedBy=${u.wantedBy}\n`;
      this.fs.mkdirp(FileSystem.dirname(u.unitFile), { ctx });
      const n = this.fs.writeFile(u.unitFile, txt, { ctx });
      n.mode = 0o644;
      return n;
    }

    /* interpreta um arquivo .service (formato INI do systemd) */
    parseUnitFile(texto) {
      const out = { secao: null, Unit: {}, Service: {}, Install: {} };
      for (let linha of texto.split('\n')) {
        linha = linha.replace(/^\s+|\s+$/g, '');
        if (!linha || linha.startsWith('#') || linha.startsWith(';')) continue;
        const sec = /^\[(\w+)\]$/.exec(linha);
        if (sec) { out.secao = sec[1]; continue; }
        const kv = /^([A-Za-z]+)\s*=\s*(.*)$/.exec(linha);
        if (!kv || !out.secao || !out[out.secao]) continue;
        const chave = kv[1], valor = kv[2];
        if (chave === 'Environment') {
          out[out.secao].Environment = (out[out.secao].Environment || []).concat([valor]);
        } else out[out.secao][chave] = valor;
      }
      return out;
    }

    /* systemctl daemon-reload: sincroniza as units com os arquivos em disco */
    daemonReload() {
      const ctx = this.ctxRoot();
      const dirs = ['/etc/systemd/system', '/lib/systemd/system'];
      const erros = [];
      const vistos = new Set();
      for (const d of dirs) {
        let nomes = [];
        try { nomes = this.fs.readdir(d, { ctx }); } catch (e) { continue; }
        for (const nome of nomes) {
          if (!/\.service$/.test(nome) || vistos.has(nome)) continue;
          vistos.add(nome);
          let texto;
          try { texto = this.fs.readFile(d + '/' + nome, { ctx }); } catch (e) { continue; }
          const ini = this.parseUnitFile(texto);
          const exec = ini.Service.ExecStart;
          const existente = this.units.get(nome);
          if (!exec) {
            erros.push(`${nome}: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.`);
            if (existente && existente.fromFile) { existente.state = 'inactive'; existente.sub = 'dead'; existente.loadError = 'bad-setting'; }
            continue;
          }
          const campos = {
            description: ini.Unit.Description || nome,
            after: (ini.Unit.After || '').split(/\s+/).filter(Boolean),
            serviceType: ini.Service.Type || 'simple',
            execStart: exec,
            execStartPre: ini.Service.ExecStartPre || null,
            user: ini.Service.User || 'root',
            workingDirectory: ini.Service.WorkingDirectory || null,
            restart: ini.Service.Restart || 'no',
            restartSec: ini.Service.RestartSec !== undefined ? parseInt(ini.Service.RestartSec, 10) || 0 : 1,
            environment: (ini.Service.Environment || []).reduce((acc, e) => {
              const mm = /^"?([A-Za-z_][A-Za-z0-9_]*)=([^"]*)"?$/.exec(e.trim());
              if (mm) acc[mm[1]] = mm[2];
              return acc;
            }, {}),
            wantedBy: ini.Install.WantedBy || 'multi-user.target',
            unitFile: d + '/' + nome,
            loadError: null
          };
          if (existente) {
            if (existente.fromFile || d === '/etc/systemd/system') Object.assign(existente, campos, { fromFile: true });
          } else {
            const u = new Unit(Object.assign({ name: nome, fromFile: true, enabled: this.unitEnabledOnDisk(nome) }, campos));
            this.units.set(nome, u);
          }
        }
      }
      // units criadas por arquivo que sumiram do disco deixam de existir
      for (const [nome, u] of Array.from(this.units.entries())) {
        if (u.fromFile && !vistos.has(nome)) { try { this.stopUnit(nome); } catch (e) { } this.units.delete(nome); }
      }
      this.log('systemd', 'Reloading.', 6);
      return erros;
    }

    unitEnabledOnDisk(nome) {
      try { this.fs.lstat('/etc/systemd/system/multi-user.target.wants/' + nome, { ctx: this.ctxRoot() }); return true; }
      catch (e) { return false; }
    }
    unit(name) {
      if (!name.includes('.')) name += '.service';
      return this.units.get(name) || null;
    }
    startUnit(name) {
      const u = this.unit(name);
      if (!u) return { ok: false, err: `Unit ${name}.service not found.` };
      if (u.state === 'active') return { ok: true, already: true };
      this.log('systemd', `Starting ${u.description}...`, 6, 1, u.name);
      // validação de configuração (usada nos cenários de troubleshooting)
      if (u.validate) {
        const problem = u.validate(this);
        if (problem) {
          (problem.journal || []).forEach(l => this.log(u.name, l, 3));
          this.log(u.name, `Failed to start ${u.description}.`, 3);
          this.log('systemd', `${u.name}: Failed with result 'exit-code'.`, 3, 1, u.name);
          u.state = 'failed'; u.sub = 'failed'; u.mainPid = null;
          u.lastError = problem.msg;
          return { ok: false, err: `Job for ${u.name} failed because the control process exited with error code.\nSee "systemctl status ${u.name}" and "journalctl -xeu ${u.name}" for details.` };
        }
      }
      // portas
      for (const p of u.ports) {
        const clash = this.portInUse(p.port, p.proto || 'tcp');
        if (clash) {
          this.log(u.name, `bind() to 0.0.0.0:${p.port} failed (98: Address already in use)`, 3);
          this.log(u.name, `still could not bind()`, 3);
          this.log('systemd', `${u.name}: Failed with result 'exit-code'.`, 3, 1, u.name);
          u.state = 'failed'; u.sub = 'failed';
          u.lastError = `Address already in use (porta ${p.port} ocupada por ${clash.process})`;
          return { ok: false, err: `Job for ${u.name} failed because the control process exited with error code.\nSee "systemctl status ${u.name}" and "journalctl -xeu ${u.name}" for details.` };
        }
      }
      // validações reais para units vindas de arquivo (erros clássicos do systemd)
      if (u.fromFile) {
        const ctx = this.ctxRoot();
        const falhar = (msg, linhas, code) => {
          (linhas || []).forEach(l => this.log(u.name, l, 3));
          this.log('systemd', `${u.name}: Main process exited, code=exited, status=${code}`, 3, 1, u.name);
          this.log('systemd', `${u.name}: Failed with result 'exit-code'.`, 3, 1, u.name);
          this.log('systemd', `Failed to start ${u.description}.`, 3, 1, u.name);
          u.state = 'failed'; u.sub = 'failed'; u.mainPid = null; u.lastError = msg;
          return { ok: false, err: `Job for ${u.name} failed because the control process exited with error code.\nSee "systemctl status ${u.name}" and "journalctl -xeu ${u.name}" for details.` };
        };
        if (u.user && u.user !== 'root' && !this.userByName(u.user)) {
          return falhar(`usuário '${u.user}' não existe`,
            [`Failed to determine user credentials: No such process`, `Failed at step USER spawning ${u.execStart.split(/\s+/)[0]}: No such process`], '217/USER');
        }
        const bin = (u.execStart || '').trim().split(/\s+/)[0];
        if (bin && bin.startsWith('/')) {
          let node = null;
          try { node = this.fs.stat(bin, { ctx }); } catch (e) { }
          if (!node) {
            return falhar(`o executável ${bin} não existe`,
              [`Failed at step EXEC spawning ${bin}: No such file or directory`], '203/EXEC');
          }
          if ((node.mode & 0o111) === 0) {
            return falhar(`o executável ${bin} não tem permissão de execução`,
              [`Failed at step EXEC spawning ${bin}: Permission denied`], '203/EXEC');
          }
        } else if (bin && !/^[-@+!]/.test(bin)) {
          return falhar(`ExecStart precisa de caminho absoluto (recebido: ${bin})`,
            [`Neither a valid executable name nor an absolute path: ${bin}`], '203/EXEC');
        }
        if (u.workingDirectory) {
          let d = null;
          try { d = this.fs.stat(u.workingDirectory, { ctx }); } catch (e) { }
          if (!d || d.type !== 'dir') {
            return falhar(`WorkingDirectory ${u.workingDirectory} não existe`,
              [`Changing to the requested working directory failed: No such file or directory`,
               `Failed at step CHDIR spawning ${bin}: No such file or directory`], '200/CHDIR');
          }
        }
      }
      const comando = (u.execStart || '').trim().split(/\s+/)[0].replace(/^.*\//, '');
      const proc = this.spawn({ cmd: u.execStart, comm: (u.fromFile && comando) ? comando : u.name.replace('.service', ''), user: u.user, uid: u.user === 'root' ? 0 : (this.userByName(u.user) || {}).uid || 0, unit: u.name, cpu: 0.3, mem: 1.2 });
      u.mainPid = proc.pid;
      for (const p of u.ports) this.listen({ port: p.port, proto: p.proto || 'tcp', pid: proc.pid, process: u.name.replace('.service', ''), addr: p.addr || '0.0.0.0' });
      u.state = 'active'; u.activeSince = Date.now(); u.lastError = null;
      if (u.fromFile && u.serviceType === 'oneshot') {
        // oneshot: o processo termina e a unit fica "active (exited)"
        this.processes.delete(proc.pid); u.mainPid = null; u.sub = 'exited';
      } else u.sub = 'running';
      if (u.onStart) u.onStart(this, u);
      this.log('systemd', `Started ${u.description}.`, 6, 1, u.name);
      return { ok: true };
    }
    stopUnit(name) {
      const u = this.unit(name);
      if (!u) return { ok: false, err: `Unit ${name}.service not loaded.` };
      this.log('systemd', `Stopping ${u.description}...`, 6, 1, u.name);
      if (u.mainPid) { this.processes.delete(u.mainPid); this.listeners = this.listeners.filter(l => l.pid !== u.mainPid); }
      u.mainPid = null; u.state = 'inactive'; u.sub = 'dead';
      if (u.onStop) u.onStop(this, u);
      this.log('systemd', `Stopped ${u.description}.`, 6, 1, u.name);
      return { ok: true };
    }
    restartUnit(name) { this.stopUnit(name); return this.startUnit(name); }

    /* ---------- usuários e grupos (lê/escreve /etc/passwd de verdade) ---------- */
    passwdLines() { return this.fs.readFile('/etc/passwd', { ctx: this.ctxRoot() }).split('\n').filter(Boolean); }
    groupLines() { return this.fs.readFile('/etc/group', { ctx: this.ctxRoot() }).split('\n').filter(Boolean); }
    users() {
      return this.passwdLines().map(l => {
        const [name, pw, uid, gid, gecos, home, shell] = l.split(':');
        return { name, pw, uid: +uid, gid: +gid, gecos, home, shell };
      });
    }
    groups() {
      return this.groupLines().map(l => {
        const [name, pw, gid, members] = l.split(':');
        return { name, pw, gid: +gid, members: (members || '').split(',').filter(Boolean) };
      });
    }
    userByName(n) { return this.users().find(u => u.name === n) || null; }
    userByUid(u) { return this.users().find(x => x.uid === +u) || null; }
    groupByName(n) { return this.groups().find(g => g.name === n) || null; }
    groupByGid(g) { return this.groups().find(x => x.gid === +g) || null; }
    groupsOfUser(name) {
      const u = this.userByName(name);
      const out = [];
      if (u) { const pg = this.groupByGid(u.gid); if (pg) out.push(pg); }
      for (const g of this.groups()) if (g.members.includes(name) && !out.find(x => x.gid === g.gid)) out.push(g);
      return out;
    }
    gidsOfUser(name) { return this.groupsOfUser(name).map(g => g.gid); }
    nextUid() {
      const used = this.users().map(u => u.uid).filter(u => u >= 1000 && u < 60000);
      let i = 1000; while (used.includes(i)) i++;
      return i;
    }
    nextSysUid() {
      const used = this.users().map(u => u.uid);
      let i = 999; while (used.includes(i) && i > 100) i--;
      return i;
    }
    nextSysGid() {
      const used = this.groups().map(g => g.gid);
      let i = 999; while (used.includes(i) && i > 100) i--;
      return i;
    }
    nextGid() {
      const used = this.groups().map(g => g.gid).filter(g => g >= 1000 && g < 60000);
      let i = 1000; while (used.includes(i)) i++;
      return i;
    }
    addUserRecord(u) {
      const ctx = this.ctxRoot();
      const line = `${u.name}:x:${u.uid}:${u.gid}:${u.gecos || ''}:${u.home}:${u.shell}`;
      this.fs.appendFile('/etc/passwd', line + '\n', { ctx });
      this.fs.appendFile('/etc/shadow', `${u.name}:${u.locked ? '!' : '$y$j9T$' + Math.random().toString(36).slice(2, 14)}:20500:0:99999:7:::\n`, { ctx });
    }
    addGroupRecord(g) {
      this.fs.appendFile('/etc/group', `${g.name}:x:${g.gid}:${(g.members || []).join(',')}\n`, { ctx: this.ctxRoot() });
      this.fs.appendFile('/etc/gshadow', `${g.name}:!::${(g.members || []).join(',')}\n`, { ctx: this.ctxRoot() });
    }
    rewritePasswd(users) {
      this.fs.writeFile('/etc/passwd', users.map(u => `${u.name}:${u.pw}:${u.uid}:${u.gid}:${u.gecos}:${u.home}:${u.shell}`).join('\n') + '\n', { ctx: this.ctxRoot() });
    }
    rewriteGroup(groups) {
      this.fs.writeFile('/etc/group', groups.map(g => `${g.name}:${g.pw}:${g.gid}:${g.members.join(',')}`).join('\n') + '\n', { ctx: this.ctxRoot() });
    }

    /* ---------- rede ---------- */
    resolve(name) {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return name;
      if (name === 'localhost' || name === 'localhost.localdomain') return '127.0.0.1';
      if (name === this.hostname) return this.primaryIp();
      // /etc/hosts
      try {
        const hosts = this.fs.readFile('/etc/hosts', { ctx: this.ctxRoot() });
        for (const line of hosts.split('\n')) {
          const l = line.replace(/#.*/, '').trim();
          if (!l) continue;
          const parts = l.split(/\s+/);
          if (parts.slice(1).includes(name)) return parts[0];
        }
      } catch (e) { }
      // resolv.conf precisa existir e ter nameserver válido
      let ns = null;
      try {
        const rc = this.fs.readFile('/etc/resolv.conf', { ctx: this.ctxRoot() });
        const m = rc.match(/^\s*nameserver\s+(\S+)/m);
        if (m) ns = m[1];
      } catch (e) { }
      if (!ns) return null;                       // sem servidor DNS configurado
      if (this.dnsBroken) return null;
      /* Dentro de um container, quem responde é o resolvedor do Docker
         (127.0.0.11): ele conhece os nomes dos outros containers das
         redes definidas pelo usuário — e só delas. */
      if (this.container && this._host && this._host.docker && this._container) {
        for (const [nomeRede] of this._container.redes) {
          const achado = this._host.docker.resolverNaRede(nomeRede, name);
          if (achado) return achado.ip;
        }
        if (name === 'host.docker.internal' || name === 'gateway.docker.internal') {
          for (const [, cfg] of this._container.redes) if (cfg.gateway) return cfg.gateway;
        }
        if (ns !== '127.0.0.11') return null;
      }
      // só servidores DNS que de fato respondem nesta rede resolvem nomes
      /* 10.0.2.3 é o resolvedor da rede virtual desta máquina (a convenção
         do modo usuário do QEMU), além dos públicos conhecidos. */
      const nsValidos = ['127.0.0.53', '127.0.0.1', '10.0.2.3', '8.8.8.8', '8.8.4.4', '1.1.1.1', '9.9.9.9'];
      const gw = (this.routes.find(r => r.dst === 'default') || {}).via;
      if (!nsValidos.includes(ns) && ns !== gw) return null;
      if (this.dns.has(name)) return this.dns.get(name);
      return null;
    }

    /* O IP responde a ping? (usado por ping, nc e traceroute) */
    ipAlcancavel(ip) {
      if (ip === '127.0.0.1' || ip === this.primaryIp()) return true;
      if (/^10\.|^172\.1[6-9]\.|^172\.2\d\.|^172\.3[01]\.|^192\.168\./.test(ip)) return true;
      for (const [, v] of this.dns) if (v === ip) return true;
      for (const nome in (LX.INTERNET || {})) { if (this.dns.get(nome) === ip) return true; }
      if (this.docker && this.docker.resolveAny && this.docker.resolveAny(ip)) return true;
      return false;
    }
    primaryIp() {
      const eth = this.interfaces.find(i => i.name !== 'lo');
      return eth ? eth.ipv4.split('/')[0] : '127.0.0.1';
    }

    /* Simula uma conexão TCP: retorna {ok, body, status} ou lança */
    connect(host, port, opts = {}) {
      const ip = this.resolve(host);
      if (!ip) { const e = new SysError('EAI_NONAME'); e.code = 'EAI_NONAME'; e.message = `Could not resolve host: ${host}`; throw e; }
      const isLocal = ip === '127.0.0.1' || ip === this.primaryIp() || ip === '::1';
      if (isLocal) {
        /* inclui as portas publicadas por containers: `curl localhost:8080`
           chega no container porque o Docker abriu a 8080 aqui no host */
        const l = this.todosListeners().find(x => x.port === +port && x.proto === 'tcp' &&
          (x.addr === '0.0.0.0' || x.addr === '127.0.0.1' || x.addr === ip));
        if (!l) throw new SysError('ECONNREFUSED');
        if (this.firewall.enabled && !this._fwAllows(port) && ip !== '127.0.0.1') throw new SysError('ETIMEDOUT');
        return { ok: true, listener: l, ip };
      }
      // rede docker?
      if (this.docker) {
        const r = this.docker.connectFrom(null, host, port);
        if (r) return r;
      }
      /* de dentro de um container, quem roteia é o motor do host */
      if (this.container && this._host && this._host.docker) {
        const r = this._host.docker.connectFrom(this._container, host, port);
        if (r) return r;
        throw new SysError('EHOSTUNREACH');
      }
      // internet simulada
      if (this.firewall.enabled && !this._fwAllows(port, 'out')) throw new SysError('ETIMEDOUT');
      const site = LX.INTERNET && LX.INTERNET[host];
      if (site) {
        if (+port !== 80 && +port !== 443 && !site.ports?.includes(+port)) throw new SysError('ECONNREFUSED');
        return { ok: true, remote: site, ip };
      }
      throw new SysError('EHOSTUNREACH');
    }
    _fwAllows(port, dir = 'in') {
      const rs = this.firewall.rules.filter(r => (r.dir || 'in') === dir);
      const bloqueio = rs.find(r => r.action === 'deny' && (r.port === String(port) || r.port === 'any'));
      if (bloqueio) return false;
      if (dir === 'out') return this.firewall.defaultOut !== 'deny' ||
        rs.some(r => r.action === 'allow' && (r.port === String(port) || r.port === 'any'));
      return rs.some(r => r.action === 'allow' && (r.port === String(port) || r.port === 'any'));
    }

    /* ---------- pacotes ---------- */
    installPackage(name, opts = {}) {
      const meta = this.aptCache.get(name);
      if (!meta) return { ok: false, err: `E: Unable to locate package ${name}` };
      if (this.packages.has(name)) return { ok: true, already: true, meta };
      const deps = [];
      for (const d of (meta.depends || [])) if (!this.packages.has(d)) deps.push(d);
      for (const d of deps) { const dm = this.aptCache.get(d); if (dm) this.packages.set(d, Object.assign({ installed: true, auto: true }, dm)); }
      this.packages.set(name, Object.assign({ installed: true }, meta));
      if (meta.provides) for (const f of meta.provides) {
        try { this.fs.mkdirp(FileSystem.dirname(f.path), { ctx: this.ctxRoot() }); } catch (e) { }
        this.fs.writeFile(f.path, f.content || '#!/bin/sh\n', { ctx: this.ctxRoot(), mode: f.mode !== undefined ? f.mode : 0o755 });
      }
      if (meta.unit) this.addUnit(Object.assign({}, meta.unit));
      if (meta.onInstall) meta.onInstall(this);
      return { ok: true, meta, deps };
    }
    removePackage(name, purge = false) {
      const p = this.packages.get(name);
      if (!p) return { ok: false, err: `Package '${name}' is not installed, so not removed` };
      if (p.provides) for (const f of p.provides) { try { this.fs.unlink(f.path, { ctx: this.ctxRoot() }); } catch (e) { } }
      if (p.unit) { try { this.stopUnit(p.unit.name); } catch (e) { } this.units.delete(p.unit.name); }
      this.packages.delete(name);
      return { ok: true };
    }

    /* =====================================================================
       Construção do sistema base (Ubuntu 26.04 LTS "Resolute Raccoon")
       ===================================================================== */
    _buildBaseSystem() {
      const fs = this.fs, ctx = this.ctxRoot();
      const D = (p, mode = 0o755, uid = 0, gid = 0) => { const n = fs.mkdirp(p, { ctx }); n.mode = mode; n.uid = uid; n.gid = gid; return n; };
      const F = (p, c, mode = 0o644, uid = 0, gid = 0) => { const n = fs.writeFile(p, c, { ctx }); n.mode = mode; n.uid = uid; n.gid = gid; return n; };

      // FHS
      ['/bin', '/sbin', '/lib', '/lib64', '/usr', '/usr/bin', '/usr/sbin', '/usr/lib', '/usr/local',
        '/usr/local/bin', '/usr/local/sbin', '/usr/share', '/usr/share/man', '/usr/share/doc', '/usr/include',
        '/etc', '/etc/systemd', '/etc/systemd/system', '/etc/apt', '/etc/apt/sources.list.d', '/etc/apt/keyrings',
        '/etc/ssh', '/etc/skel', '/etc/cron.d', '/etc/default', '/etc/network', '/etc/security', '/etc/sudoers.d',
        '/etc/profile.d', '/etc/apt/keyrings', '/etc/systemd/system/multi-user.target.wants',
        '/var', '/var/log', '/var/log/nginx', '/var/tmp', '/var/lib', '/var/lib/dpkg', '/var/cache', '/var/cache/apt',
        '/var/www', '/var/www/html', '/var/backups', '/var/spool', '/var/run',
        '/tmp', '/opt', '/srv', '/home', '/root', '/mnt', '/media', '/boot',
        '/dev', '/dev/pts', '/proc', '/sys', '/run'].forEach(p => D(p));

      D('/tmp', 0o1777);  // sticky bit
      D('/var/tmp', 0o1777);
      D('/root', 0o700);
      D('/etc/shadow-dir');
      fs.rmrf('/etc/shadow-dir', { ctx });

      /* usrmerge: /bin, /sbin, /lib e /lib64 são links para dentro de /usr,
         como em qualquer Ubuntu ou Debian atual. Isso não é detalhe: um
         Dockerfile escreve CMD ["/bin/sh", "-c", ...] e um healthcheck
         chama /bin/bash o tempo todo — se /bin fosse um diretório vazio,
         metade dos exemplos reais quebraria aqui dentro. */
      for (const [link, alvo] of [['/bin', 'usr/bin'], ['/sbin', 'usr/sbin'], ['/lib', 'usr/lib'], ['/lib64', 'usr/lib64']]) {
        try { fs.rmrf(link, { ctx }); } catch (e) { }
        try { fs.mkdirp('/' + alvo, { ctx }); fs.symlink(alvo, link, { ctx }); } catch (e) { }
      }
      F('/usr/share/doc/usrmerge.txt', 'Neste sistema /bin, /sbin e /lib são links para /usr/bin, /usr/sbin e /usr/lib (usrmerge).\n');

      // --- /etc essenciais ---
      F('/etc/hostname', this.hostname + '\n');
      F('/etc/hosts',
        `127.0.0.1\tlocalhost\n127.0.1.1\t${this.hostname}\n\n` +
        `# The following lines are desirable for IPv6 capable hosts\n` +
        `::1     ip6-localhost ip6-loopback\nfe00::0 ip6-localnet\nff00::0 ip6-mcastprefix\nff02::1 ip6-allnodes\nff02::2 ip6-allrouters\n`);
      F('/etc/resolv.conf', `# Gerenciado por systemd-resolved\nnameserver 127.0.0.53\noptions edns0 trust-ad\nsearch lan\n`);
      F('/etc/os-release',
        `PRETTY_NAME="Ubuntu 26.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="26.04"\nVERSION="26.04.1 LTS (Resolute Raccoon)"\n` +
        `VERSION_CODENAME=resolute\nID=ubuntu\nID_LIKE=debian\nHOME_URL="https://www.ubuntu.com/"\n` +
        `SUPPORT_URL="https://help.ubuntu.com/"\nBUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"\nUBUNTU_CODENAME=resolute\n`);
      F('/etc/lsb-release', `DISTRIB_ID=Ubuntu\nDISTRIB_RELEASE=26.04\nDISTRIB_CODENAME=resolute\nDISTRIB_DESCRIPTION="Ubuntu 26.04.1 LTS"\n`);
      F('/etc/debian_version', 'trixie/sid\n');
      F('/etc/timezone', 'America/Sao_Paulo\n');
      F('/etc/machine-id', 'b7f4d1a9c3e64f2a8d05e71c9a3b6f42\n');
      F('/etc/shells', '# /etc/shells: valid login shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/dash\n/usr/bin/dash\n/bin/rbash\n');
      F('/etc/fstab',
        `# /etc/fstab: static file system information.\n#\n` +
        `# <file system> <mount point>   <type>  <options>       <dump>  <pass>\n` +
        `UUID=8f3b1c02-4d5e-4a7b-9c11-6ee2a4f0d3b7 /               ext4    errors=remount-ro 0       1\n` +
        `UUID=A1B2-C3D4  /boot/efi       vfat    umask=0077      0       1\n` +
        `/swap.img       none            swap    sw              0       0\n`);
      F('/etc/mtab', `/dev/vda2 / ext4 rw,relatime,errors=remount-ro 0 0\n`);
      F('/etc/motd', '');
      F('/etc/issue', 'Ubuntu 26.04.1 LTS \\n \\l\n\n');
      F('/etc/environment', 'PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\n');
      F('/etc/login.defs', `UID_MIN\t\t\t 1000\nUID_MAX\t\t\t60000\nGID_MIN\t\t\t 1000\nGID_MAX\t\t\t60000\nCREATE_HOME\tyes\nUMASK\t\t022\nENCRYPT_METHOD YESCRYPT\n`);
      F('/etc/adduser.conf', `DHOME=/home\nDSHELL=/bin/bash\nSKEL=/etc/skel\nUSERGROUPS=yes\nDIR_MODE=0750\n`);
      F('/etc/sudoers',
        `# This file MUST be edited with the 'visudo' command as root.\n` +
        `Defaults\tenv_reset\nDefaults\tmail_badpass\n` +
        `Defaults\tsecure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\n\n` +
        `# User privilege specification\nroot\tALL=(ALL:ALL) ALL\n\n` +
        `# Members of the admin group may gain root privileges\n%admin ALL=(ALL) ALL\n\n` +
        `# Allow members of group sudo to execute any command\n%sudo\tALL=(ALL:ALL) ALL\n\n` +
        `@includedir /etc/sudoers.d\n`, 0o440);

      // usuários base
      F('/etc/passwd',
        `root:x:0:0:root:/root:/bin/bash\n` +
        `daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n` +
        `bin:x:2:2:bin:/bin:/usr/sbin/nologin\n` +
        `sys:x:3:3:sys:/dev:/usr/sbin/nologin\n` +
        `sync:x:4:65534:sync:/bin:/bin/sync\n` +
        `man:x:6:12:man:/var/cache/man:/usr/sbin/nologin\n` +
        `www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n` +
        `backup:x:34:34:backup:/var/backups:/usr/sbin/nologin\n` +
        `nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\n` +
        `systemd-network:x:998:998:systemd Network Management:/:/usr/sbin/nologin\n` +
        `sshd:x:107:65534::/run/sshd:/usr/sbin/nologin\n` +
        `aluno:x:1000:1000:Aluno Terminalis,,,:/home/aluno:/bin/bash\n`);
      F('/etc/group',
        `root:x:0:\ndaemon:x:1:\nbin:x:2:\nsys:x:3:\nadm:x:4:aluno\ntty:x:5:\ndisk:x:6:\nlp:x:7:\n` +
        `mail:x:8:\nnews:x:9:\nuucp:x:10:\nman:x:12:\nproxy:x:13:\nkmem:x:15:\ndialout:x:20:\n` +
        `fax:x:21:\nvoice:x:22:\ncdrom:x:24:aluno\nfloppy:x:25:\ntape:x:26:\nsudo:x:27:aluno\n` +
        `audio:x:29:\ndip:x:30:aluno\nwww-data:x:33:\nbackup:x:34:\noperator:x:37:\nlist:x:38:\n` +
        `irc:x:39:\nsrc:x:40:\nshadow:x:42:\nutmp:x:43:\nvideo:x:44:\nsasl:x:45:\nplugdev:x:46:aluno\n` +
        `staff:x:50:\ngames:x:60:\nusers:x:100:\nnogroup:x:65534:\nsystemd-network:x:998:\n` +
        `ssh:x:106:\ndocker:x:988:aluno\naluno:x:1000:\n`);
      F('/etc/shadow',
        `root:!:20450:0:99999:7:::\n` +
        `daemon:*:20450:0:99999:7:::\n` +
        `bin:*:20450:0:99999:7:::\n` +
        `sys:*:20450:0:99999:7:::\n` +
        `www-data:*:20450:0:99999:7:::\n` +
        `backup:*:20450:0:99999:7:::\n` +
        `nobody:*:20450:0:99999:7:::\n` +
        `sshd:!:20450:0:99999:7:::\n` +
        `aluno:$y$j9T$4kQz1pXvB2sN.Rt7:20500:0:99999:7:::\n`, 0o640, 0, 42);
      F('/etc/gshadow', `root:*::\nsudo:*::aluno\naluno:!::\n`, 0o640, 0, 42);

      // cron do sistema: /etc/crontab tem um campo a mais (o usuário)
      D('/etc/cron.d'); D('/etc/cron.daily'); D('/etc/cron.hourly'); D('/etc/cron.weekly');
      F('/etc/crontab',
        `# /etc/crontab: crontab do sistema\n` +
        `# Diferente do crontab de usuário, aqui existe um campo a mais: o usuário.\n` +
        `SHELL=/bin/sh\n` +
        `PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n` +
        `# m h  dom mon dow  user\tcommand\n` +
        `17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly\n` +
        `25 6\t* * *\troot\ttest -x /usr/sbin/anacron || run-parts --report /etc/cron.daily\n`);
      F('/etc/cron.d/e2scrub_all',
        `30 3 * * 0 root test -e /run/systemd/system || /usr/lib/x86_64-linux-gnu/e2fsprogs/e2scrub_all_cron\n`);

      // logrotate
      D('/etc/logrotate.d');
      F('/etc/logrotate.conf',
        `# rotaciona os logs semanalmente\nweekly\n\n# mantém 4 semanas de histórico\nrotate 4\n\n` +
        `# cria um arquivo novo depois de girar\ncreate\n\n# comprime as gerações antigas\ncompress\n\n` +
        `# inclui as configurações por pacote\ninclude /etc/logrotate.d\n`);
      F('/etc/logrotate.d/nginx',
        `/var/log/nginx/*.log {\n\tdaily\n\tmissingok\n\trotate 14\n\tcompress\n\tdelaycompress\n\tnotifempty\n\tcreate 0640 www-data adm\n\tsharedscripts\n}\n`);

      // perfis do sistema
      F('/etc/profile',
        `# /etc/profile: executado pelo Bourne shell em sessões de LOGIN.\n` +
        `# Não edite este arquivo: acrescente um .sh em /etc/profile.d/\n\n` +
        `if [ "\${PS1-}" ]; then\n  if [ "\${BASH-}" ]; then\n    PS1='\\u@\\h:\\w\\$ '\n  fi\nfi\n\n` +
        `if [ -d /etc/profile.d ]; then\n  for i in /etc/profile.d/*.sh; do\n    if [ -r "$i" ]; then\n      . "$i"\n    fi\n  done\n  unset i\nfi\n`);
      F('/etc/bash.bashrc',
        `# /etc/bash.bashrc: executado por shells interativos NÃO-login, para todos os usuários.\n` +
        `[ -z "\${PS1-}" ] && return\n`);
      F('/etc/environment',
        `PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\n` +
        `LANG="pt_BR.UTF-8"\n`);

      // skel + home
      F('/etc/skel/.bashrc', BASHRC_SKEL);
      F('/etc/skel/.profile', PROFILE_SKEL);
      F('/etc/skel/.bash_logout', `# ~/.bash_logout: executado por bash(1) ao encerrar a sessão de login.\n`);
      const home = D('/home/aluno', 0o750, 1000, 1000);
      F('/home/aluno/.bashrc', BASHRC_SKEL, 0o644, 1000, 1000);
      F('/home/aluno/.profile', PROFILE_SKEL, 0o644, 1000, 1000);
      F('/home/aluno/.bash_logout', `# ~/.bash_logout\n`, 0o644, 1000, 1000);
      F('/home/aluno/.bash_history', '', 0o600, 1000, 1000);
      D('/home/aluno/.ssh', 0o700, 1000, 1000);
      F('/root/.bashrc', ROOT_BASHRC, 0o644, 0, 0);
      F('/root/.profile', `# ~/.profile do root\nmesg n 2> /dev/null || true\n`, 0o644, 0, 0);
      D('/root/.ssh', 0o700, 0, 0);

      // apt
      F('/etc/apt/sources.list',
        `# Ubuntu 26.04 — este arquivo foi migrado para o formato deb822.\n` +
        `# Veja /etc/apt/sources.list.d/ubuntu.sources\n`);
      F('/etc/apt/sources.list.d/ubuntu.sources',
        `Types: deb\nURIs: http://br.archive.ubuntu.com/ubuntu/\nSuites: resolute resolute-updates resolute-backports\n` +
        `Components: main restricted universe multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n\n` +
        `Types: deb\nURIs: http://security.ubuntu.com/ubuntu/\nSuites: resolute-security\n` +
        `Components: main restricted universe multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n`);

      // ssh
      F('/etc/ssh/sshd_config', SSHD_CONFIG, 0o644);
      F('/etc/ssh/ssh_config', `Host *\n    SendEnv LANG LC_*\n    HashKnownHosts yes\n    GSSAPIAuthentication no\n`, 0o644);

      // logs
      F('/var/log/syslog', SYSLOG_SEED(this.hostname), 0o640, 0, 4);
      F('/var/log/auth.log', AUTHLOG_SEED(this.hostname), 0o640, 0, 4);
      F('/var/log/dpkg.log', `2026-08-29 09:14:02 startup archives unpack\n2026-08-29 09:14:03 install openssh-server:amd64 <none> 1:10.0p1-2ubuntu3\n`, 0o644);
      F('/var/log/wtmp', '(binário)\n', 0o664, 0, 43);
      F('/var/log/lastlog', '(binário)\n', 0o664, 0, 43);
      D('/var/log/journal', 0o2755, 0, 4);

      // www
      F('/var/www/html/index.html', DEFAULT_INDEX_HTML, 0o644, 0, 0);

      // /dev
      const dev = (name, type, major, minor, mode = 0o660, gid = 0) => {
        const n = new Inode(type, mode, 0, gid);
        n.major = major; n.minor = minor; n.name = name;
        const parent = fs.stat('/dev', { ctx }); n.parent = parent; parent.children.set(name, n);
        return n;
      };
      dev('null', 'chr', 1, 3, 0o666); dev('zero', 'chr', 1, 5, 0o666);
      dev('random', 'chr', 1, 8, 0o666); dev('urandom', 'chr', 1, 9, 0o666);
      // /dev/zero e /dev/urandom entregam conteúdo de verdade (limitado, para caber na memória)
      try {
        const zero = fs.lstat('/dev/zero', { ctx });
        zero.dynamic = () => '\0'.repeat(4 * 1024 * 1024);
        const alea = () => {
          let out = '';
          const alfabeto = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          for (let i = 0; i < 1024 * 256; i++) out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
          return out;
        };
        for (const nome of ['urandom', 'random']) {
          try { const n = fs.lstat('/dev/' + nome, { ctx }); n.dynamic = alea; } catch (e) { }
        }
      } catch (e) { }

      dev('tty', 'chr', 5, 0, 0o666, 5); dev('console', 'chr', 5, 1, 0o600);
      dev('vda', 'blk', 252, 0, 0o660, 6); dev('vda1', 'blk', 252, 1, 0o660, 6); dev('vda2', 'blk', 252, 2, 0o660, 6);
      dev('pts0', 'chr', 136, 0, 0o620, 5);
      fs.symlink('/proc/self/fd/0', '/dev/stdin', { ctx });
      fs.symlink('/proc/self/fd/1', '/dev/stdout', { ctx });
      fs.symlink('/proc/self/fd/2', '/dev/stderr', { ctx });

      // /proc dinâmico
      const machine = this;
      const dyn = (path, fn, mode = 0o444) => {
        const n = fs.writeFile(path, '', { ctx });
        n.dynamic = fn; n.mode = mode; return n;
      };
      dyn('/proc/version', () => `Linux version 6.14.0-27-generic (buildd@lcy02) (x86_64-linux-gnu-gcc-14 (Ubuntu 14.2.0)) #27-Ubuntu SMP PREEMPT_DYNAMIC ${new Date(machine.bootTime).toUTCString()}\n`);
      dyn('/proc/uptime', () => `${machine.uptimeSec.toFixed(2)} ${(machine.uptimeSec * 1.8).toFixed(2)}\n`);
      dyn('/proc/loadavg', () => `${machine.loadavg.map(n => n.toFixed(2)).join(' ')} 2/${machine.processes.size + 120} ${machine.nextPid}\n`);
      dyn('/proc/cpuinfo', () => {
        let out = '';
        for (let i = 0; i < machine.cpuCount; i++) {
          out += `processor\t: ${i}\nvendor_id\t: GenuineIntel\ncpu family\t: 6\nmodel\t\t: 106\n` +
            `model name\t: Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz\nstepping\t: 6\ncpu MHz\t\t: 2899.998\n` +
            `cache size\t: 54272 KB\nsiblings\t: ${machine.cpuCount}\ncore id\t\t: ${i}\ncpu cores\t: ${machine.cpuCount}\n` +
            `flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat sse sse2 ss ht syscall nx avx2\n` +
            `bogomips\t: 5799.99\n\n`;
        }
        return out;
      });
      dyn('/proc/meminfo', () => {
        const m = machine.mem;
        const k = v => String(v * 1024).padStart(8, ' ');
        return `MemTotal:       ${k(m.total)} kB\nMemFree:        ${k(m.free)} kB\nMemAvailable:   ${k(m.available)} kB\n` +
          `Buffers:         ${k(Math.round(m.buffcache * 0.15))} kB\nCached:         ${k(Math.round(m.buffcache * 0.85))} kB\n` +
          `SwapTotal:      ${k(m.swapTotal)} kB\nSwapFree:       ${k(m.swapTotal - m.swapUsed)} kB\n`;
      });
      dyn('/proc/mounts', () => machine.fs.mounts.map(m => `${m.dev} ${m.mount} ${m.type} ${m.opts} 0 0`).join('\n') + '\n');
      dyn('/proc/filesystems', () => `nodev\tsysfs\nnodev\tproc\nnodev\tdevtmpfs\nnodev\ttmpfs\nnodev\toverlay\n\text4\n\tvfat\n\txfs\n`);
      D('/proc/sys'); D('/proc/sys/net'); D('/proc/sys/net/ipv4'); D('/proc/self'); D('/proc/sys/kernel');
      D('/sys/class'); D('/sys/class/net'); D('/sys/class/net/eth0'); D('/sys/block'); D('/sys/block/vda');
      dyn('/proc/sys/net/ipv4/ip_forward', () => '1\n');
      dyn('/proc/self/status', () => `Name:\tbash\nState:\tR (running)\nPid:\t${machine.nextPid}\n`);
      dyn('/proc/sys/kernel/hostname', () => machine.hostname + '\n');

      /* /proc/<pid>/ — reconciliado com a tabela de processos a cada acesso */
      const procRoot = fs.stat('/proc', { ctx });
      procRoot.dynDir = () => machine.syncProcFs();
      machine.syncProcFs = function () {
        if (this._procFsBusy) return;          // evita reentrada: mkdir dispara lookup em /proc
        this._procFsBusy = true;
        try { this._syncProcFs(); } finally { this._procFsBusy = false; }
      };
      machine._syncProcFs = function () {
        const vivos = new Set(Array.from(this.processes.keys()).map(String));
        for (const nome of Array.from(procRoot.children.keys())) {
          if (/^\d+$/.test(nome) && !vivos.has(nome)) procRoot.children.delete(nome);
        }
        for (const p of this.processes.values()) {
          const nome = String(p.pid);
          if (procRoot.children.has(nome)) continue;
          const dir = fs.mkdir('/proc/' + nome, { ctx, mode: 0o555 });
          dir.uid = p.uid; dir.gid = p.gid;
          const arq = (n, fn, mode = 0o444) => {
            const x = fs.writeFile('/proc/' + nome + '/' + n, '', { ctx });
            x.dynamic = fn; x.mode = mode; x.uid = p.uid; x.gid = p.gid;
          };
          arq('cmdline', () => (p.cmd || p.comm) + '\n');
          arq('comm', () => p.comm + '\n');
          arq('status', () => {
            const estados = { R: 'R (running)', S: 'S (sleeping)', D: 'D (disk sleep)', T: 'T (stopped)', Z: 'Z (zombie)' };
            return `Name:\t${p.comm}\nState:\t${estados[p.state] || p.state}\nTgid:\t${p.pid}\nPid:\t${p.pid}\nPPid:\t${p.ppid}\n` +
              `Uid:\t${p.uid}\t${p.uid}\t${p.uid}\t${p.uid}\nGid:\t${p.gid}\t${p.gid}\t${p.gid}\t${p.gid}\n` +
              `Threads:\t${p.threads}\nVmSize:\t${p.vsz} kB\nVmRSS:\t${p.rss} kB\n`;
          });
          arq('stat', () => `${p.pid} (${p.comm}) ${p.state} ${p.ppid} ${p.pid} 0 0 -1 0 0 0 0 0 0 0 20 ${p.nice} ${p.threads} 0 ${Math.round((p.start - machine.bootTime) / 10)} ${p.vsz * 1024} ${p.rss}\n`);
          arq('limits', () => 'Limit                     Soft Limit           Hard Limit           Units\nMax open files            1024                 1048576              files\nMax processes             15000                15000                processes\n');
          try {
            const cwd = fs.symlink(p.cwd || '/', '/proc/' + nome + '/cwd', { ctx });
            cwd.uid = p.uid; cwd.gid = p.gid;
            const exe = fs.symlink(p.exe || ('/usr/bin/' + p.comm), '/proc/' + nome + '/exe', { ctx });
            exe.uid = p.uid; exe.gid = p.gid;
          } catch (e) { }
          const fdDir = fs.mkdir('/proc/' + nome + '/fd', { ctx, mode: 0o500 });
          fdDir.uid = p.uid; fdDir.gid = p.gid;
        }
      };
      machine.syncProcFs();
      dyn('/sys/class/net/eth0/address', () => machine.interfaces[1] ? machine.interfaces[1].mac + '\n' : '\n');
      dyn('/sys/block/vda/size', () => '41943040\n');

      // ---- interfaces de rede ----
      this.interfaces = [
        { name: 'lo', mac: '00:00:00:00:00:00', ipv4: '127.0.0.1/8', ipv6: '::1/128', state: 'UNKNOWN', mtu: 65536, flags: 'LOOPBACK,UP,LOWER_UP', rx: 1284512, tx: 1284512 },
        { name: 'eth0', mac: '52:54:00:8a:3f:1d', ipv4: '10.0.2.15/24', ipv6: 'fe80::5054:ff:fe8a:3f1d/64', state: 'UP', mtu: 1500, flags: 'BROADCAST,MULTICAST,UP,LOWER_UP', rx: 48219341, tx: 9182003, gw: '10.0.2.1' }
      ];
      this.routes = [
        { dst: 'default', via: '10.0.2.1', dev: 'eth0', proto: 'dhcp', metric: 100 },
        { dst: '10.0.2.0/24', dev: 'eth0', proto: 'kernel', scope: 'link', src: '10.0.2.15' }
      ];
      this.arp = [{ ip: '10.0.2.1', mac: '52:54:00:12:35:00', dev: 'eth0', state: 'REACHABLE' }];
      this.fs.mounts = [
        { dev: '/dev/vda2', mount: '/', type: 'ext4', opts: 'rw,relatime,errors=remount-ro', sizeKb: 20508296, usedKb: 3150000 },
        { dev: '/dev/vda1', mount: '/boot/efi', type: 'vfat', opts: 'rw,relatime,fmask=0077', sizeKb: 523248, usedKb: 6204 },
        { dev: 'tmpfs', mount: '/run', type: 'tmpfs', opts: 'rw,nosuid,nodev,noexec,relatime,size=411208k', sizeKb: 411208, usedKb: 1592 },
        { dev: 'tmpfs', mount: '/dev/shm', type: 'tmpfs', opts: 'rw,nosuid,nodev', sizeKb: 2056040, usedKb: 0 },
        { dev: 'udev', mount: '/dev', type: 'devtmpfs', opts: 'rw,nosuid,relatime,size=1998960k', sizeKb: 1998960, usedKb: 0 },
        { dev: 'proc', mount: '/proc', type: 'proc', opts: 'rw,nosuid,nodev,noexec,relatime', sizeKb: 0, usedKb: 0 },
        { dev: 'sysfs', mount: '/sys', type: 'sysfs', opts: 'rw,nosuid,nodev,noexec,relatime', sizeKb: 0, usedKb: 0 }
      ];
      this.devSizes = Object.assign({ vdb: 5 * 1024 * 1024, vdc: 3 * 1024 * 1024 }, this.devSizes || {});
      this.blockDevices = [
        { name: 'vda', type: 'disk', size: '20G', mount: '', fstype: '', uuid: '', children: [
          { name: 'vda1', type: 'part', size: '512M', mount: '/boot/efi', fstype: 'vfat', uuid: 'A1B2-C3D4', label: 'EFI' },
          { name: 'vda2', type: 'part', size: '19.5G', mount: '/', fstype: 'ext4', uuid: '8f3b1c02-4d5e-4a7b-9c11-6ee2a4f0d3b7', label: 'cloudimg-rootfs' }
        ] },
        { name: 'vdb', type: 'disk', size: '5G', mount: '', fstype: '', uuid: '', children: [] },
        /* segundo disco livre: cada aula de armazenamento tem o seu, então
           formatar um não invalida o desafio do outro */
        { name: 'vdc', type: 'disk', size: '3G', mount: '', fstype: '', uuid: '', children: [] }
      ];

      // ---- DNS público simulado ----
      [['ubuntu.com', '185.125.190.21'], ['archive.ubuntu.com', '185.125.190.36'], ['br.archive.ubuntu.com', '200.236.31.1'],
      ['security.ubuntu.com', '185.125.190.83'], ['docker.com', '18.239.83.20'], ['docs.docker.com', '18.239.83.63'],
      ['registry-1.docker.io', '54.236.113.205'], ['hub.docker.com', '3.219.239.5'], ['github.com', '140.82.113.4'],
      ['example.com', '93.184.216.34'], ['google.com', '142.250.219.14'], ['gnu.org', '209.51.188.116'],
      ['kernel.org', '139.178.84.217'], ['terminalis.dev', '203.0.113.42'], ['api.exemplo.local', '10.0.2.80']
      ].forEach(([n, ip]) => this.dns.set(n, ip));

      // ---- Hosts SSH alcançáveis ----
      this.dns.set('web01', '10.0.2.31');
      this.dns.set('db01', '10.0.2.32');

      // ---- processos base ----
      this.processes.clear();
      const P = (o) => { const p = new Process(o); this.processes.set(p.pid, p); return p; };
      P({ pid: 1, ppid: 0, cmd: '/sbin/init', comm: 'systemd', user: 'root', cpu: 0.1, mem: 0.3, rss: 12904, vsz: 168012 });
      P({ pid: 2, ppid: 0, cmd: '[kthreadd]', comm: 'kthreadd', user: 'root', cpu: 0, mem: 0, rss: 0, vsz: 0 });
      P({ pid: 254, ppid: 1, cmd: '/lib/systemd/systemd-journald', comm: 'systemd-journal', user: 'root', cpu: 0.1, mem: 0.6, unit: 'systemd-journald.service' });
      P({ pid: 288, ppid: 1, cmd: '/lib/systemd/systemd-udevd', comm: 'systemd-udevd', user: 'root', cpu: 0, mem: 0.4 });
      P({ pid: 402, ppid: 1, cmd: '/lib/systemd/systemd-resolved', comm: 'systemd-resolve', user: 'systemd-resolve', uid: 991, cpu: 0, mem: 0.5, unit: 'systemd-resolved.service' });
      P({ pid: 511, ppid: 1, cmd: '/usr/sbin/cron -f -P', comm: 'cron', user: 'root', cpu: 0, mem: 0.2, unit: 'cron.service' });
      P({ pid: 640, ppid: 1, cmd: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups', comm: 'sshd', user: 'root', cpu: 0, mem: 0.4, unit: 'ssh.service' });
      P({ pid: 812, ppid: 640, cmd: 'sshd: aluno [priv]', comm: 'sshd', user: 'root', cpu: 0, mem: 0.3 });
      P({ pid: 830, ppid: 812, cmd: '-bash', comm: 'bash', user: 'aluno', uid: 1000, gid: 1000, tty: 'pts/0', cpu: 0, mem: 0.2 });
      this.nextPid = 900;

      // ---- unidades systemd base ----
      this.addUnit({ name: 'systemd-journald.service', description: 'Journal Service', state: 'active', sub: 'running', enabled: true, execStart: '/lib/systemd/systemd-journald' });
      this.addUnit({ name: 'systemd-resolved.service', description: 'Network Name Resolution', state: 'active', sub: 'running', enabled: true, execStart: '/lib/systemd/systemd-resolved', ports: [] });
      this.addUnit({ name: 'cron.service', description: 'Regular background program processing daemon', state: 'active', sub: 'running', enabled: true, execStart: '/usr/sbin/cron -f -P' });
      this.addUnit({ name: 'ssh.service', description: 'OpenBSD Secure Shell server', state: 'active', sub: 'running', enabled: true, execStart: '/usr/sbin/sshd -D', ports: [{ port: 22 }] });
      this.units.get('ssh.service').mainPid = 640;
      this.units.get('systemd-journald.service').mainPid = 254;
      this.units.get('cron.service').mainPid = 511;
      this.units.get('systemd-resolved.service').mainPid = 402;
      this.addUnit({ name: 'systemd-timesyncd.service', description: 'Network Time Synchronization', state: 'active', sub: 'running', enabled: true, execStart: '/lib/systemd/systemd-timesyncd' });
      this.addUnit({ name: 'unattended-upgrades.service', description: 'Unattended Upgrades Shutdown', state: 'active', sub: 'running', enabled: true, execStart: '/usr/share/unattended-upgrades/unattended-upgrade-shutdown' });
      this.addUnit({ name: 'docker.service', description: 'Docker Application Container Engine', state: 'active', sub: 'running', enabled: true, execStart: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' });

      // ---- journal do boot: dá o que ler em journalctl -b e journalctl -u ----
      const t0 = this.bootTime;
      const bootLog = (dt, unit, msg, prio = 6, pid = 1, forUnit = null) => {
        this.journal.push({ ts: t0 + dt, unit, pid, prio, msg, host: this.hostname, forUnit });
      };
      bootLog(0, 'kernel', `Linux version 6.14.0-27-generic (buildd@lcy02) #27-Ubuntu SMP`, 6, 0);
      bootLog(400, 'kernel', 'Command line: BOOT_IMAGE=/vmlinuz-6.14.0-27-generic root=/dev/vda1 ro quiet', 6, 0);
      bootLog(1200, 'systemd', 'systemd 258.2-1ubuntu4 running in system mode.', 6);
      bootLog(1400, 'systemd', 'Detected virtualization kvm.', 6);
      bootLog(2100, 'systemd', 'Reached target Basic System.', 6);
      for (const [dt, nome, desc] of [
        [2600, 'systemd-journald.service', 'Journal Service'],
        [3000, 'systemd-resolved.service', 'Network Name Resolution'],
        [3400, 'systemd-timesyncd.service', 'Network Time Synchronization'],
        [3900, 'cron.service', 'Regular background program processing daemon'],
        [4300, 'docker.service', 'Docker Application Container Engine'],
        [4700, 'ssh.service', 'OpenBSD Secure Shell server']
      ]) {
        bootLog(dt, 'systemd', `Starting ${desc}...`, 6, 1, nome);
        bootLog(dt + 250, 'systemd', `Started ${desc}.`, 6, 1, nome);
      }
      bootLog(5000, 'ssh.service', 'Server listening on 0.0.0.0 port 22.', 6, 640);
      bootLog(5010, 'ssh.service', 'Server listening on :: port 22.', 6, 640);
      bootLog(5200, 'systemd', 'Reached target Multi-User System.', 6);
      bootLog(5400, 'systemd', 'Startup finished in 1.482s (kernel) + 3.918s (userspace) = 5.401s.', 6);
      bootLog(6000, 'systemd-resolved.service', 'Using system hostname \'' + this.hostname + '\'.', 6, 402);
      bootLog(7000, 'ssh.service', `Accepted publickey for aluno from 10.0.2.2 port 51422 ssh2: ED25519 SHA256:9Kc2`, 6, 812);
      bootLog(9000, 'cron.service', '(root) CMD (cd / && run-parts --report /etc/cron.hourly)', 6, 511);
      bootLog(11000, 'unattended-upgrades.service', 'Initial blacklist: ; Initial whitelist (not strict): ', 6, 700);

      /* Um journal só com mensagens de sucesso não ensina nada: `journalctl -p`
         existe para separar o ruído do que importa. Aqui há avisos e erros
         reais para filtrar, exatamente como num servidor com histórico. */
      bootLog(2300, 'kernel', 'ACPI: _OSC evaluation for CPUs failed, trying _PDC', 4, 0);
      bootLog(3100, 'systemd-timesyncd.service', 'Timed out waiting for reply from 91.189.91.157:123 (ntp.ubuntu.com).', 4, 398);
      bootLog(4500, 'systemd', 'apport.service: Main process exited, code=exited, status=1/FAILURE', 3, 1, 'apport.service');
      bootLog(4520, 'systemd', 'apport.service: Failed with result \'exit-code\'.', 3, 1, 'apport.service');
      bootLog(4530, 'systemd', 'Failed to start LSB: automatic crash report generation.', 3, 1, 'apport.service');
      bootLog(6200, 'ssh.service', 'error: kex_exchange_identification: Connection closed by remote host', 3, 640);
      bootLog(6400, 'ssh.service', 'Failed password for invalid user admin from 45.148.10.71 port 40122 ssh2', 4, 640);
      bootLog(6500, 'ssh.service', 'Failed password for invalid user test from 45.148.10.71 port 40188 ssh2', 4, 640);
      bootLog(6600, 'ssh.service', 'Failed password for root from 45.148.10.71 port 40255 ssh2', 4, 640);
      bootLog(8200, 'kernel', 'EXT4-fs (vda2): warning: mounting fs with errors, running e2fsck is recommended', 4, 0);
      bootLog(10500, 'cron.service', '(CRON) info (No MTA installed, discarding output)', 5, 511);

      this.listen({ port: 22, proto: 'tcp', pid: 640, process: 'sshd' });
      this.listen({ port: 53, proto: 'udp', pid: 402, process: 'systemd-resolve', addr: '127.0.0.53' });
      this.listen({ port: 53, proto: 'tcp', pid: 402, process: 'systemd-resolve', addr: '127.0.0.53' });

      // ---- pacotes instalados ----
      const INSTALLED = [
        ['bash', '5.3-2ubuntu2', 'GNU Bourne Again SHell'],
        ['coreutils', '9.8-2ubuntu1', 'GNU core utilities'],
        ['rust-coreutils', '0.4.0-1ubuntu3', 'Rust rewrite of GNU coreutils (padrão no Ubuntu 26.04)'],
        ['dpkg', '1.22.21ubuntu2', 'Debian package management system'],
        ['apt', '3.1.7', 'commandline package manager'],
        ['systemd', '258.2-1ubuntu4', 'system and service manager'],
        ['openssh-server', '1:10.0p1-2ubuntu3', 'secure shell (SSH) server'],
        ['openssh-client', '1:10.0p1-2ubuntu3', 'secure shell (SSH) client'],
        ['grep', '3.12-1', 'GNU grep, egrep and fgrep'],
        ['sed', '4.9-2', 'GNU stream editor'],
        ['gawk', '5.3.1-2', 'GNU awk'],
        ['findutils', '4.10.0-3', 'utilities for finding files'],
        ['tar', '1.35+dfsg-3.1', 'GNU version of the tar archiving utility'],
        ['gzip', '1.13-1', 'GNU compression utilities'],
        ['iproute2', '6.14.0-1ubuntu1', 'networking and traffic control tools'],
        ['curl', '8.14.1-2ubuntu1', 'command line tool for transferring data'],
        ['ca-certificates', '20250419', 'Common CA certificates'],
        ['docker-ce', '5:29.7.0-1~ubuntu.26.04~resolute', 'Docker: the open-source application container engine'],
        ['docker-ce-cli', '5:29.7.0-1~ubuntu.26.04~resolute', 'Docker CLI'],
        ['docker-compose-plugin', '2.41.0-1~ubuntu.26.04~resolute', 'Docker Compose (V2) plugin'],
        ['docker-buildx-plugin', '0.32.0-1~ubuntu.26.04~resolute', 'Docker Buildx plugin'],
        ['containerd.io', '1.7.28-1', 'An open and reliable container runtime'],
        ['nano', '8.4-1', 'small, friendly text editor'],
        ['less', '668-1', 'pager program similar to more'],
        ['procps', '2:4.0.5-2', '/proc file system utilities'],
        ['util-linux', '2.41-4ubuntu1', 'miscellaneous system utilities'],
        ['python3', '3.14.0-1', 'interactive high-level object-oriented language']
      ];
      INSTALLED.forEach(([n, v, d]) => this.packages.set(n, { name: n, version: v, description: d, installed: true, size: 1024 * (30 + n.length * 7) }));

      // catálogo apt (o que dá para instalar)
      LX.seedAptCache && LX.seedAptCache(this);
      LX.seedInternet && LX.seedInternet(this);
    }

    /* ---------- reinicia a máquina para um cenário ---------- */
    static fresh(opts) { return new Machine(opts); }
  }
  LX.Machine = Machine;

  /* ---------------- textos base ---------------- */
  const BASHRC_SKEL = `# ~/.bashrc: executado pelo bash(1) em shells interativos que não são de login.

# Se não for interativo, não faz nada
case $- in
    *i*) ;;
      *) return;;
esac

# não grava linhas duplicadas nem começadas com espaço no histórico
HISTCONTROL=ignoreboth

# acrescenta ao histórico, não sobrescreve
shopt -s histappend

HISTSIZE=1000
HISTFILESIZE=2000

# ajusta LINES e COLUMNS após cada comando
shopt -s checkwinsize

# prompt colorido
PS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '

# aliases úteis
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ls='ls --color=auto'
alias grep='grep --color=auto'

# arquivo separado de aliases pessoais
if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi
`;

  const ROOT_BASHRC = `# ~/.bashrc do root
export PS1='\\[\\033[01;31m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]# '
alias ll='ls -alF'
alias ls='ls --color=auto'
`;

  const PROFILE_SKEL = `# ~/.profile: executado pelos shells de login compatíveis com Bourne.

# o bash lê o .bashrc quando é um shell de login interativo
if [ -n "$BASH_VERSION" ]; then
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi
fi

# adiciona ~/bin e ~/.local/bin ao PATH, se existirem
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi
if [ -d "$HOME/.local/bin" ] ; then
    PATH="$HOME/.local/bin:$PATH"
fi
`;

  const SSHD_CONFIG = `# Este é o arquivo de configuração do servidor SSH (sshd).
# Veja sshd_config(5) para mais informações.

#Port 22
#AddressFamily any
#ListenAddress 0.0.0.0

#PermitRootLogin prohibit-password
PermitRootLogin no

#PubkeyAuthentication yes
#AuthorizedKeysFile     .ssh/authorized_keys .ssh/authorized_keys2

PasswordAuthentication yes
#PermitEmptyPasswords no

#MaxAuthTries 6
#MaxSessions 10

X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
Subsystem       sftp    /usr/lib/openssh/sftp-server
`;

  const DEFAULT_INDEX_HTML = `<!DOCTYPE html>
<html>
<head><title>Welcome to nginx!</title></head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>
<p><em>Thank you for using nginx.</em></p>
</body>
</html>
`;

  function SYSLOG_SEED(host) {
    const d = 'Sep  1';
    return [
      `${d} 06:12:01 ${host} systemd[1]: Starting Daily apt download activities...`,
      `${d} 06:12:03 ${host} systemd[1]: apt-daily.service: Deactivated successfully.`,
      `${d} 06:12:03 ${host} systemd[1]: Finished Daily apt download activities.`,
      `${d} 06:25:11 ${host} CRON[1841]: (root) CMD (test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; })`,
      `${d} 07:01:44 ${host} systemd-resolved[402]: Using degraded feature set UDP instead of UDP+EDNS0 for DNS server 10.0.2.1.`,
      `${d} 08:30:02 ${host} dockerd[1102]: time="2026-09-01T08:30:02.114Z" level=info msg="API listen on /run/docker.sock"`,
      `${d} 09:02:17 ${host} kernel: [ 3521.884012] EXT4-fs (vda2): re-mounted. Quota mode: none.`
    ].join('\n') + '\n';
  }
  function AUTHLOG_SEED(host) {
    const d = 'Sep  1';
    return [
      `${d} 08:59:12 ${host} sshd[812]: Accepted publickey for aluno from 10.0.2.2 port 51422 ssh2: ED25519 SHA256:9pQ+cKm1XyR0v2sT8dLw3nB6hJ4kU7fE1oIaZbY5cWQ`,
      `${d} 08:59:12 ${host} sshd[812]: pam_unix(sshd:session): session opened for user aluno(uid=1000) by (uid=0)`,
      `${d} 09:04:33 ${host} sudo:    aluno : TTY=pts/0 ; PWD=/home/aluno ; USER=root ; COMMAND=/usr/bin/apt update`,
      `${d} 09:04:33 ${host} sudo: pam_unix(sudo:session): session opened for user root(uid=0) by aluno(uid=1000)`,
      `${d} 09:04:41 ${host} sudo: pam_unix(sudo:session): session closed for user root`
    ].join('\n') + '\n';
  }

  LX._texts = { BASHRC_SKEL, PROFILE_SKEL, ROOT_BASHRC, SSHD_CONFIG, DEFAULT_INDEX_HTML };
})();
