/* =========================================================================
   TERMINALIS — pacotes
   ========================================================================= */
'use strict';
(function () {
  const { defcmd, getopt, C, humanSize } = LX;

  /* ============================== pacotes ============================== */
  defcmd({
    name: ['apt', 'apt-get', 'apt-cache'], path: '/usr/bin/', pkg: 'apt',
    run: async ({ sh, io, args, name }) => {
      const { opts, rest } = getopt(args, { y: 0, q: 0, s: 0, '--yes': 0, '--quiet': 0, '--no-install-recommends': 0, '--purge': 0, '--dry-run': 0 });
      const verb = rest[0];
      const pkgs = rest.slice(1);
      const needRoot = ['install', 'remove', 'purge', 'update', 'upgrade', 'full-upgrade', 'dist-upgrade', 'autoremove', 'clean', 'autoclean'].includes(verb);
      if (needRoot && sh.uid !== 0) {
        io.stderr.write(`E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n`);
        return 100;
      }
      switch (verb) {
        case 'update': {
          const lines = [
            'Get:1 http://br.archive.ubuntu.com/ubuntu resolute InRelease [265 kB]',
            'Get:2 http://security.ubuntu.com/ubuntu resolute-security InRelease [126 kB]',
            'Get:3 http://br.archive.ubuntu.com/ubuntu resolute-updates InRelease [126 kB]',
            'Get:4 http://br.archive.ubuntu.com/ubuntu resolute/main amd64 Packages [1,792 kB]',
            'Get:5 http://br.archive.ubuntu.com/ubuntu resolute/universe amd64 Packages [15.7 MB]',
            'Fetched 18.0 MB in 3s (6,004 kB/s)'
          ];
          for (const l of lines) { io.stdout.write(l + '\n'); await new Promise(r => setTimeout(r, 90)); }
          io.stdout.write('Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n');
          const up = 3;
          io.stdout.write(`${up} packages can be upgraded. Run 'apt list --upgradable' to see them.\n`);
          sh.m.aptUpdated = true;
          return 0;
        }
        case 'install': {
          if (!pkgs.length) { io.stderr.write('E: Missing package name\n'); return 100; }
          io.stdout.write('Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n');
          const toInstall = [], already = [], missing = [];
          for (const p of pkgs) {
            const base = p.split('=')[0];
            if (sh.m.packages.has(base)) already.push(base);
            else if (sh.m.aptCache.has(base)) toInstall.push(base);
            else missing.push(base);
          }
          if (missing.length) {
            missing.forEach(p => io.stderr.write(`E: Unable to locate package ${p}\n`));
            return 100;
          }
          already.forEach(p => io.stdout.write(`${p} is already the newest version (${(sh.m.packages.get(p) || {}).version || '1.0'}).\n`));
          if (!toInstall.length) { io.stdout.write('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n'); return 0; }
          const deps = [];
          for (const p of toInstall) for (const d of (sh.m.aptCache.get(p).depends || [])) if (!sh.m.packages.has(d) && !toInstall.includes(d)) deps.push(d);
          const all = [...new Set([...deps, ...toInstall])];
          if (deps.length) io.stdout.write(`The following additional packages will be installed:\n  ${deps.join(' ')}\n`);
          io.stdout.write(`The following NEW packages will be installed:\n  ${all.join(' ')}\n`);
          const size = all.reduce((s, p) => s + ((sh.m.aptCache.get(p) || {}).size || 100000), 0);
          io.stdout.write(`0 upgraded, ${all.length} newly installed, 0 to remove and 0 not upgraded.\n`);
          io.stdout.write(`Need to get ${humanSize(Math.round(size * 0.35))}B of archives.\nAfter this operation, ${humanSize(size)}B of additional disk space will be used.\n`);
          if (!opts.y && !opts['--yes'] && all.length > 1) {
            if (io.term && io.term.readLine) {
              io.stdout.write('Do you want to continue? [Y/n] ');
              const ans = await io.term.readLine('');
              if (ans && /^n/i.test(ans.trim())) { io.stdout.write('Abort.\n'); return 1; }
            }
          }
          if (opts.s || opts['--dry-run']) { io.stdout.write('(simulação, nada foi instalado)\n'); return 0; }
          let i = 0;
          for (const p of all) {
            i++;
            const meta = sh.m.aptCache.get(p);
            io.stdout.write(`Get:${i} http://br.archive.ubuntu.com/ubuntu resolute/main amd64 ${p} amd64 ${meta.version} [${humanSize(Math.round(meta.size * 0.35))}B]\n`);
            await new Promise(r => setTimeout(r, 80));
          }
          io.stdout.write(`Fetched ${humanSize(Math.round(size * 0.35))}B in 2s (${humanSize(Math.round(size * 0.2))}B/s)\n`);
          for (const p of all) {
            const meta = sh.m.aptCache.get(p);
            io.stdout.write(`Selecting previously unselected package ${p}.\n(Reading database ... 187432 files and directories currently installed.)\nPreparing to unpack .../${p}_${meta.version}_amd64.deb ...\nUnpacking ${p} (${meta.version}) ...\n`);
            await new Promise(r => setTimeout(r, 60));
          }
          for (const p of all) {
            const r = sh.m.installPackage(p);
            io.stdout.write(`Setting up ${p} (${(sh.m.aptCache.get(p) || {}).version}) ...\n`);
            const meta = sh.m.aptCache.get(p);
            if (meta && meta.unit) io.stdout.write(`Created symlink /etc/systemd/system/multi-user.target.wants/${meta.unit.name} → /lib/systemd/system/${meta.unit.name}.\n`);
            await new Promise(r => setTimeout(r, 60));
            try { sh.m.fs.appendFile('/var/log/dpkg.log', `${new Date().toISOString().slice(0, 19).replace('T', ' ')} install ${p}:amd64 <none> ${meta.version}\n`, { ctx: sh.m.ctxRoot() }); } catch (e) { }
          }
          io.stdout.write('Processing triggers for man-db (2.13.1-1) ...\n');
          return 0;
        }
        case 'remove': case 'purge': {
          io.stdout.write('Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n');
          let any = false;
          for (const p of pkgs) {
            const r = sh.m.removePackage(p, verb === 'purge' || opts['--purge']);
            if (!r.ok) { io.stdout.write(`Package '${p}' is not installed, so not removed\n`); continue; }
            any = true;
            io.stdout.write(`The following packages will be REMOVED:\n  ${p}${verb === 'purge' ? '*' : ''}\n`);
            io.stdout.write(`0 upgraded, 0 newly installed, 1 to remove and 0 not upgraded.\n`);
            io.stdout.write(`(Reading database ... 187432 files and directories currently installed.)\nRemoving ${p} (1.0) ...\n`);
            if (verb === 'purge' || opts['--purge']) io.stdout.write(`Purging configuration files for ${p} ...\n`);
          }
          return any ? 0 : 0;
        }
        case 'upgrade': case 'full-upgrade': case 'dist-upgrade': {
          io.stdout.write('Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nCalculating upgrade... Done\n');
          io.stdout.write('The following packages will be upgraded:\n  curl libcurl4t64 openssl\n3 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\nNeed to get 1,842 kB of archives.\n');
          if (!opts.y && !opts['--yes'] && io.term && io.term.readLine) {
            io.stdout.write('Do you want to continue? [Y/n] ');
            const ans = await io.term.readLine('');
            if (ans && /^n/i.test(ans.trim())) { io.stdout.write('Abort.\n'); return 1; }
          }
          for (const l = 0; ;) break;
          io.stdout.write('Fetched 1,842 kB in 1s (2,104 kB/s)\nSetting up openssl (3.5.1-1ubuntu2) ...\nSetting up libcurl4t64:amd64 (8.14.1-2ubuntu2) ...\nSetting up curl (8.14.1-2ubuntu2) ...\n');
          return 0;
        }
        case 'search': {
          const q = pkgs[0] || '';
          io.stdout.write('Sorting... Done\nFull Text Search... Done\n');
          const re = new RegExp(q, 'i');
          let found = 0;
          for (const [n, meta] of sh.m.aptCache) {
            if (re.test(n) || re.test(meta.description || '')) {
              found++;
              io.stdout.write(`${C.green}${C.bold}${n}${C.reset}/resolute ${meta.version} amd64\n  ${meta.description}\n\n`);
            }
          }
          if (!found) io.stdout.write('');
          return 0;
        }
        case 'show': {
          const p = pkgs[0];
          const meta = sh.m.aptCache.get(p) || sh.m.packages.get(p);
          if (!meta) { io.stderr.write(`E: No packages found\n`); return 100; }
          io.stdout.write(`Package: ${p}\nVersion: ${meta.version}\nPriority: optional\nSection: ${meta.section || 'utils'}\nOrigin: Ubuntu\nInstalled-Size: ${Math.round((meta.size || 100000) / 1024)} kB\nDepends: ${(meta.depends || []).join(', ') || 'libc6'}\nHomepage: https://example.org/${p}\nDownload-Size: ${Math.round((meta.size || 100000) * 0.35 / 1024)} kB\nAPT-Sources: http://br.archive.ubuntu.com/ubuntu resolute/main amd64 Packages\nDescription: ${meta.description}\n${meta.long ? meta.long + '\n' : ''}`);
          return 0;
        }
        case 'list': {
          if (pkgs.includes('--installed') || args.includes('--installed')) {
            io.stdout.write('Listing... Done\n');
            for (const [n, meta] of Array.from(sh.m.packages).sort()) io.stdout.write(`${C.green}${n}${C.reset}/resolute,now ${meta.version} amd64 [installed]\n`);
            return 0;
          }
          if (args.includes('--upgradable')) {
            io.stdout.write('Listing... Done\ncurl/resolute-updates 8.14.1-2ubuntu2 amd64 [upgradable from: 8.14.1-2ubuntu1]\nopenssl/resolute-updates 3.5.1-1ubuntu2 amd64 [upgradable from: 3.5.1-1ubuntu1]\n');
            return 0;
          }
          io.stdout.write('Listing... Done\n');
          for (const [n, meta] of Array.from(sh.m.aptCache).sort()) io.stdout.write(`${n}/resolute ${meta.version} amd64\n`);
          return 0;
        }
        case 'autoremove': io.stdout.write('Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n'); return 0;
        case 'clean': case 'autoclean': return 0;
        case 'policy': {
          const p = pkgs[0];
          if (!p) { io.stdout.write('Package files:\n 100 /var/lib/dpkg/status\n     release a=now\n'); return 0; }
          const inst = sh.m.packages.get(p);
          const cand = sh.m.aptCache.get(p) || inst;
          io.stdout.write(`${p}:\n  Installed: ${inst ? inst.version : '(none)'}\n  Candidate: ${cand ? cand.version : '(none)'}\n  Version table:\n`);
          return 0;
        }
        default:
          io.stdout.write(`apt 3.1.7 (amd64)
Usage: apt [options] command

apt is a commandline package manager and provides commands for
searching and managing as well as querying information about packages.

Most used commands:
  update - atualiza a lista de pacotes disponíveis
  upgrade - instala as atualizações disponíveis
  install - instala pacotes
  remove - remove pacotes
  purge - remove pacotes e seus arquivos de configuração
  autoremove - remove automaticamente dependências não usadas
  search - procura na descrição dos pacotes
  show - mostra detalhes do pacote
  list - lista pacotes
  policy - mostra a política de origem dos pacotes
`);
          return verb ? 100 : 0;
      }
    }
  });

  defcmd({
    name: 'dpkg', pkg: 'dpkg', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, L: 1, S: 1, i: 1, r: 1, s: 1, '--list': 0, '--get-selections': 0, '--configure': 1, '--search': 1, '--status': 1, '--listfiles': 1 });
      if (opts.l || opts['--list'] || args[0] === '-l') {
        const filter = rest[0];
        io.stdout.write(`Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)\n||/ Name           Version         Architecture Description\n+++-==============-===============-============-=================================\n`);
        for (const [n, meta] of Array.from(sh.m.packages).sort()) {
          if (filter && !LX.matchGlob(n, filter)) continue;
          io.stdout.write(`ii  ${n.padEnd(15).slice(0, 15)}${(meta.version || '1.0').padEnd(16).slice(0, 16)}amd64        ${(meta.description || '').slice(0, 40)}\n`);
        }
        return 0;
      }
      /* --get-selections / --set-selections: a lista de pacotes que se
         guarda no backup para reconstruir a máquina depois. */
      if (opts['--get-selections']) {
        const filtro = rest[0];
        for (const [n] of Array.from(sh.m.packages).sort()) {
          if (filtro && !LX.matchGlob(n, filtro)) continue;
          io.stdout.write(`${n}\t\t\t\tinstall\n`);
        }
        return 0;
      }
      if (args.includes('--set-selections')) {
        const texto = io.stdin ? io.stdin.readAll() : '';
        let n = 0;
        for (const linha of texto.split('\n')) {
          const mm = /^(\S+)\s+(install|deinstall|hold|purge)\s*$/.exec(linha.trim());
          if (mm) n++;
        }
        io.stdout.write(`${n} seleções lidas. Use "apt-get dselect-upgrade" para aplicá-las.\n`);
        return 0;
      }

      const listFiles = opts.L || opts['--listfiles'];
      if (listFiles) {
        const meta = sh.m.packages.get(listFiles) || sh.m.aptCache.get(listFiles);
        if (!meta) { io.stderr.write(`dpkg-query: package '${listFiles}' is not installed\n`); return 1; }
        io.stdout.write(`/.\n/usr\n/usr/share\n/usr/share/doc\n/usr/share/doc/${listFiles}\n`);
        (meta.provides || []).forEach(f => io.stdout.write(f.path + '\n'));
        return 0;
      }
      const search = opts.S || opts['--search'];
      if (search) {
        for (const [n, meta] of sh.m.packages) {
          for (const f of (meta.provides || [])) if (f.path.includes(search)) { io.stdout.write(`${n}: ${f.path}\n`); return 0; }
        }
        // binários do sistema base: o pacote vem do registro de comandos
        const base = String(search).replace(/^.*\//, '');
        const cmd = LX.COMMANDS && LX.COMMANDS[base];
        if (cmd && /^\/(usr\/)?(s?bin)\//.test(search)) {
          const pacote = cmd.pkg || 'coreutils';
          if (sh.m.packages.has(pacote) || pacote === 'coreutils') { io.stdout.write(`${pacote}: ${search}\n`); return 0; }
        }
        io.stderr.write(`dpkg-query: no path found matching pattern ${search}\n`);
        return 1;
      }
      const status = opts.s || opts['--status'];
      if (status) {
        const meta = sh.m.packages.get(status);
        if (!meta) { io.stderr.write(`dpkg-query: package '${status}' is not installed and no information is available\n`); return 1; }
        io.stdout.write(`Package: ${status}\nStatus: install ok installed\nPriority: optional\nSection: ${meta.section || 'utils'}\nInstalled-Size: ${Math.round((meta.size || 100000) / 1024)}\nVersion: ${meta.version}\nDescription: ${meta.description}\n`);
        return 0;
      }
      if (opts.i) { io.stderr.write(`dpkg: error: cannot access archive '${opts.i}': No such file or directory\n`); return 2; }
      io.stdout.write('Usage: dpkg [<option>...] <command>\n\nCommands:\n  -i|--install <.deb file name>\n  -l|--list [<pattern>...]         Lista pacotes.\n  -L|--listfiles <package>...      Lista arquivos do pacote.\n  -S|--search <pattern>...         Descobre a que pacote um arquivo pertence.\n  -s|--status <package>...         Mostra detalhes do pacote.\n');
      return 0;
    }
  });

})();
