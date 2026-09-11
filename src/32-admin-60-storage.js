/* =========================================================================
   TERMINALIS — disco e armazenamento
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, defcmd, getopt } = LX;
  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }

  /* ============================== disco ============================== */
  /* Procura um dispositivo por /dev/nome, UUID= ou LABEL= */
  function acharParticao(sh, spec) {
    if (!spec) return null;
    const todas = sh.m.blockDevices.flatMap(d => [d, ...(d.children || [])]);
    const mu = /^UUID=(.+)$/i.exec(spec);
    if (mu) return todas.find(x => x.uuid === mu[1].replace(/"/g, '')) || null;
    const ml = /^LABEL=(.+)$/i.exec(spec);
    if (ml) return todas.find(x => x.label === ml[1].replace(/"/g, '')) || null;
    return todas.find(x => '/dev/' + x.name === spec) || null;
  }
  LX.novoUUID = function () {
    const h = () => Math.floor(Math.random() * 16).toString(16);
    const bloco = (n) => Array.from({ length: n }, h).join('');
    return `${bloco(8)}-${bloco(4)}-4${bloco(3)}-a${bloco(3)}-${bloco(12)}`;
  };

  defcmd({
    name: 'parted', path: '/usr/sbin/parted', pkg: 'parted', run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('Error: You must be root (or use sudo) to run parted.\n'); return 1; }
      const { opts, rest } = getopt(args, { s: 0, a: 1, '--script': 0 });
      const dev = rest[0];
      const disco = sh.m.blockDevices.find(d => '/dev/' + d.name === dev);
      if (!disco) { io.stderr.write(`Error: Could not stat device ${dev} - No such file or directory.\n`); return 1; }
      const verbo = (rest[1] || 'print').toLowerCase();
      const silencioso = opts.s || opts['--script'];
      if (verbo === 'print') {
        io.stdout.write(`Model: Virtio Block Device (virtblk)\nDisk ${dev}: ${disco.size}\nSector size (logical/physical): 512B/512B\nPartition Table: ${disco.tabela || 'unknown'}\nDisk Flags: \n\n`);
        if ((disco.children || []).length) {
          io.stdout.write('Number  Start   End     Size    File system  Name     Flags\n');
          disco.children.forEach((c, i) => {
            io.stdout.write(` ${i + 1}      1049kB  ${c.size.replace('G', 'GB')}  ${c.size.replace('G', 'GB')}  ${(c.fstype || '').padEnd(11)}  ${(c.nome || 'primary').padEnd(7)}  \n`);
          });
          io.stdout.write('\n');
        }
        return 0;
      }
      if (verbo === 'mklabel' || verbo === 'mktable') {
        const tipo = (rest[2] || 'gpt').toLowerCase();
        if (!['gpt', 'msdos'].includes(tipo)) { io.stderr.write(`Error: Unknown partition table type ${tipo}\n`); return 1; }
        if ((disco.children || []).some(c => c.mount)) { io.stderr.write(`Error: Partition(s) on ${dev} are being used.\n`); return 1; }
        disco.tabela = tipo;
        disco.children = [];
        if (!silencioso) io.stdout.write(`Warning: The existing disk label on ${dev} will be destroyed and all data on this disk will be lost. Do you want to continue?\nYes/No? Yes\n`);
        io.stdout.write(`Information: You may need to update /etc/fstab.\n\n`);
        return 0;
      }
      if (verbo === 'mkpart') {
        if (!disco.tabela) { io.stderr.write(`Error: /dev/${disco.name}: unrecognised disk label\nDica: crie a tabela antes com "parted -s ${dev} mklabel gpt".\n`); return 1; }
        const partes = rest.slice(2);
        const nome = partes[0] || 'primary';
        const n = (disco.children || []).length + 1;
        const nova = { name: disco.name + n, size: disco.size, fstype: '', uuid: '', label: '', mount: '', nome };
        disco.children = (disco.children || []).concat([nova]);
        io.stdout.write('Information: You may need to update /etc/fstab.\n\n');
        sh.m.log('kernel', ` ${disco.name}: ${disco.children.map(c => c.name).join(' ')}`, 6, 0);
        return 0;
      }
      if (verbo === 'rm') {
        const n = +rest[2];
        if (!disco.children || !disco.children[n - 1]) { io.stderr.write(`Error: Partition doesn't exist.\n`); return 1; }
        if (disco.children[n - 1].mount) { io.stderr.write(`Error: Partition ${dev}${n} is being used. You must unmount it before you modify it.\n`); return 1; }
        disco.children.splice(n - 1, 1);
        io.stdout.write('Information: You may need to update /etc/fstab.\n\n');
        return 0;
      }
      io.stderr.write(`parted: comando "${verbo}" não suportado neste ambiente.\nUse: parted -s DISCO mklabel gpt | mkpart NOME INICIO FIM | print | rm N\n`);
      return 1;
    }
  });

  defcmd({
    name: 'apt-mark', path: '/usr/bin/apt-mark', pkg: 'apt', run: async ({ sh, io, args }) => {
      const verbo = args[0];
      const nomes = args.slice(1);
      sh.m.pacotesSegurados = sh.m.pacotesSegurados || new Set();
      if (verbo === 'hold') {
        if (sh.uid !== 0) { io.stderr.write('E: Não foi possível abrir arquivo de lock — você é root?\n'); return 1; }
        for (const n of nomes) {
          if (!sh.m.packages.has(n)) { io.stderr.write(`E: Unable to locate package ${n}\n`); return 1; }
          sh.m.pacotesSegurados.add(n);
          io.stdout.write(`${n} set on hold.\n`);
        }
        return 0;
      }
      if (verbo === 'unhold') {
        if (sh.uid !== 0) { io.stderr.write('E: Não foi possível abrir arquivo de lock — você é root?\n'); return 1; }
        for (const n of nomes) { sh.m.pacotesSegurados.delete(n); io.stdout.write(`Canceled hold on ${n}.\n`); }
        return 0;
      }
      if (verbo === 'showhold') { for (const n of sh.m.pacotesSegurados) io.stdout.write(n + '\n'); return 0; }
      if (verbo === 'showmanual' || verbo === 'showauto') {
        for (const [nome, meta] of sh.m.packages) {
          const auto = !!meta.auto;
          if ((verbo === 'showauto') === auto) io.stdout.write(nome + '\n');
        }
        return 0;
      }
      io.stdout.write('Uso: apt-mark {hold|unhold|showhold|showauto|showmanual} [pacote...]\n');
      return 0;
    }
  });

  defcmd({
    name: 'vmstat', path: '/usr/bin/vmstat', pkg: 'procps', run: async ({ sh, io, args }) => {
      const nums = args.filter(a => /^\d+$/.test(a)).map(Number);
      const repeticoes = nums.length > 1 ? nums[1] : 1;
      const m = sh.m.mem;
      io.stdout.write('procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------\n');
      io.stdout.write(' r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu\n');
      for (let i = 0; i < repeticoes; i++) {
        const rodando = 1 + Math.floor(Math.random() * 2);
        const us = Math.min(40, Math.round(Array.from(sh.m.processes.values()).reduce((a, p) => a + p.cpu, 0)));
        const wa = sh.m.ioWait || 0;
        io.stdout.write(` ${rodando}  0      0 ${String(m.free * 1024).padStart(6)} ${String(120000).padStart(6)} ${String(m.buffcache * 1024).padStart(6)}    0    0    ${String(12 + i).padStart(3)}   ${String(40 + i).padStart(3)}  ${String(300 + i * 5).padStart(4)} ${String(600 + i * 9).padStart(4)} ${String(us).padStart(2)}  1 ${String(Math.max(0, 99 - us - wa)).padStart(2)} ${String(wa).padStart(2)}  0  0\n`);
      }
      return 0;
    }
  });

  /* locale: mostra a configuração de idioma e formatos. Importa em script
     porque LC_ALL muda a ordem do sort e o separador decimal. */
  defcmd({
    name: 'locale', path: '/usr/bin/locale', pkg: 'libc-bin', run: async ({ sh, io, args }) => {
      if (args[0] === '-a') {
        io.stdout.write('C\nC.utf8\nPOSIX\npt_BR.utf8\nen_US.utf8\n');
        return 0;
      }
      const lang = sh.getVar('LANG') || 'pt_BR.UTF-8';
      const all = sh.getVar('LC_ALL') || '';
      const efetivo = all || lang;
      io.stdout.write(`LANG=${lang}\n`);
      for (const k of ['LC_CTYPE', 'LC_NUMERIC', 'LC_TIME', 'LC_COLLATE', 'LC_MONETARY', 'LC_MESSAGES', 'LC_PAPER', 'LC_NAME', 'LC_ADDRESS', 'LC_TELEPHONE', 'LC_MEASUREMENT', 'LC_IDENTIFICATION']) {
        const v = sh.getVar(k) || efetivo;
        io.stdout.write(`${k}="${v}"\n`);
      }
      io.stdout.write(`LC_ALL=${all}\n`);
      return 0;
    }
  });

  /* split: quebra um arquivo grande em pedaços — o jeito de transportar
     um backup por um canal com limite de tamanho. */
  defcmd({
    name: 'split', path: '/usr/bin/split', pkg: 'coreutils', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { b: 1, l: 1, n: 1, d: 0, a: 1, '--bytes': 1, '--lines': 1, '--numeric-suffixes': 0, '--suffix-length': 1 });
      const entrada = rest[0];
      const prefixo = rest[1] || 'x';
      if (!entrada) { io.stderr.write('split: informe o arquivo\nUsage: split [OPTION]... [FILE [PREFIX]]\n'); return 1; }
      let dados;
      try { dados = entrada === '-' ? io.stdin.readAll() : sh.m.fs.readFile(P(sh, entrada), sh.fsopts()); }
      catch (e) { io.stderr.write(`split: cannot open '${entrada}' for reading: No such file or directory\n`); return 1; }

      const tamanho = (v) => {
        const mm = /^(\d+)([kKmMgG]?)B?$/.exec(String(v));
        if (!mm) return null;
        return +mm[1] * ({ '': 1, k: 1024, K: 1024, m: 1048576, M: 1048576, g: 1073741824, G: 1073741824 }[mm[2]]);
      };
      const pedacos = [];
      const porBytes = tamanho(opts.b || opts['--bytes'] || '');
      const porLinhas = +(opts.l || opts['--lines'] || 0);
      if (porBytes) {
        for (let i = 0; i < dados.length; i += porBytes) pedacos.push(dados.slice(i, i + porBytes));
      } else {
        const n = porLinhas || 1000;
        const linhas = dados.split('\n');
        const temFinal = linhas[linhas.length - 1] === '';
        if (temFinal) linhas.pop();
        for (let i = 0; i < linhas.length; i += n) pedacos.push(linhas.slice(i, i + n).join('\n') + '\n');
      }
      if (!pedacos.length) pedacos.push('');

      const numerico = opts.d || opts['--numeric-suffixes'];
      const largura = +(opts.a || opts['--suffix-length'] || 2);
      const sufixo = (i) => {
        if (numerico) return String(i).padStart(largura, '0');
        let s2 = '', n = i;
        for (let k = 0; k < largura; k++) { s2 = String.fromCharCode(97 + (n % 26)) + s2; n = Math.floor(n / 26); }
        return s2;
      };
      pedacos.forEach((p, i) => {
        try { sh.m.fs.writeFile(P(sh, prefixo + sufixo(i)), p, sh.fsopts()); }
        catch (e) { io.stderr.write(`split: ${prefixo + sufixo(i)}: ${e.message}\n`); }
      });
      return 0;
    }
  });

  /* flock: garante que só uma instância do script roda por vez. Sem isso,
     um backup que demora mais que o intervalo do cron acaba rodando em
     duplicata — e duas cópias mexendo no mesmo destino é receita de dano. */
  defcmd({
    name: 'flock', path: '/usr/bin/flock', pkg: 'util-linux', run: async ({ sh, io, args, ex }) => {
      /* as opções do flock terminam no arquivo de trava: tudo depois é o
         comando a executar, com as opções dele próprio */
      const meus = [], depois = [];
      for (let i = 0; i < args.length; i++) {
        if (!depois.length && /^-/.test(args[i])) {
          meus.push(args[i]);
          if (/^-(w|c)$/.test(args[i]) || /^--(wait|command)$/.test(args[i])) meus.push(args[++i]);
          continue;
        }
        depois.push(args[i]);
      }
      const { opts } = getopt(meus, { n: 0, x: 0, s: 0, u: 0, w: 1, c: 1, '--nonblock': 0, '--exclusive': 0, '--wait': 1 });
      const rest = depois;
      const naoBloquear = opts.n || opts['--nonblock'] || opts.w !== undefined || opts['--wait'] !== undefined;
      const alvo = rest[0];
      if (!alvo) { io.stderr.write('flock: not enough arguments\nUsage: flock [options] <file>|<directory> <command> [...]\n'); return 64; }
      const caminho = P(sh, alvo);

      sh.m._locks = sh.m._locks || new Set();
      if (sh.m._locks.has(caminho)) {
        if (naoBloquear) { io.stderr.write(`flock: failed to get lock\n`); return 1; }
        io.stderr.write(`flock: aguardando o bloqueio de ${alvo}… (neste ambiente a espera não é simulada)\n`);
        return 1;
      }
      /* o arquivo de trava é criado se não existir — é isso que o flock faz */
      try { if (!sh.m.fs.exists(caminho, sh.fsopts())) sh.m.fs.writeFile(caminho, '', sh.fsopts()); }
      catch (e) { io.stderr.write(`flock: ${alvo}: ${e.message}\n`); return 1; }

      const cmd = opts.c !== undefined ? String(opts.c) : rest.slice(1).map(a => LX.shQuote(a)).join(' ');
      if (!cmd) return 0;
      sh.m._locks.add(caminho);
      try {
        const sub = new LX.Executor(sh, io);
        return await sub.run(cmd);
      } finally {
        sh.m._locks.delete(caminho);
      }
    }
  });

  /* nproc: quantos núcleos a máquina tem. Sem esse número, o load average
     não significa nada — por isso ele aparece em toda receita de diagnóstico. */
  defcmd({
    name: 'nproc', path: '/usr/bin/nproc', pkg: 'coreutils', run: async ({ sh, io, args }) => {
      const cpuinfo = sh.m.fs.readFile('/proc/cpuinfo', { ctx: sh.m.ctxRoot() });
      const n = cpuinfo.split('\n').filter(l => /^processor/.test(l)).length || 1;
      io.stdout.write(String(n) + '\n');
      return 0;
    }
  });

  defcmd({
    name: 'systemd-analyze', path: '/usr/bin/systemd-analyze', pkg: 'systemd', run: async ({ sh, io, args }) => {
      const verbo = (args[0] || 'time').toLowerCase();
      if (verbo === 'blame') {
        const linhas = [
          ['4.312s', 'unattended-upgrades.service'],
          ['2.108s', 'docker.service'],
          ['1.844s', 'systemd-udev-settle.service'],
          ['912ms', 'systemd-journald.service'],
          ['688ms', 'ssh.service'],
          ['402ms', 'cron.service']
        ];
        for (const [t, u] of linhas) io.stdout.write(`${t.padStart(8)} ${u}\n`);
        return 0;
      }
      /* `systemd-analyze calendar` traduz a expressão OnCalendar= e diz
         quando ela dispara — o jeito de conferir a agenda antes de confiar. */
      if (verbo === 'calendar') {
        const spec = args.slice(1).join(' ').trim();
        if (!spec) { io.stderr.write('Not enough arguments.\n'); return 1; }
        const atalhos = {
          minutely: '*-*-* *:*:00', hourly: '*-*-* *:00:00', daily: '*-*-* 00:00:00',
          weekly: 'Mon *-*-* 00:00:00', monthly: '*-*-01 00:00:00', yearly: '*-01-01 00:00:00',
          quarterly: '*-01,04,07,10-01 00:00:00', semiannually: '*-01,07-01 00:00:00'
        };
        const norm = atalhos[spec.toLowerCase()] || spec;
        if (!/^(([A-Za-z]{3}(,[A-Za-z]{3})*)\s+)?[-*\d,\/]+-[-*\d,\/]+-[-*\d,\/]+\s+[:*\d,\/]+$/.test(norm)) {
          io.stderr.write(`Failed to parse calendar expression '${spec}': Invalid argument\n`);
          return 1;
        }
        const agora = new Date();
        const prox = new Date(agora.getTime() + (/\*:\*/.test(norm) ? 60000 : /\*:00:00/.test(norm) ? 3600000 : 86400000));
        io.stdout.write(`  Original form: ${spec}\n`);
        io.stdout.write(`Normalized form: ${norm}\n`);
        io.stdout.write(`    Next elapse: ${prox.toString().slice(0, 24)}\n`);
        io.stdout.write(`       From now: ${/\*:\*/.test(norm) ? '1min' : /\*:00:00/.test(norm) ? '1h' : '1 day'} left\n`);
        return 0;
      }
      if (verbo === 'critical-chain') {
        io.stdout.write('The time when unit became active or started is printed after the "@" character.\nThe time the unit took to start is printed after the "+" character.\n\n');
        io.stdout.write('multi-user.target @5.401s\n└─docker.service @3.290s +2.108s\n  └─network-online.target @3.284s\n    └─ssh.service @2.596s +688ms\n      └─basic.target @2.100s\n');
        return 0;
      }
      io.stdout.write('Startup finished in 1.482s (kernel) + 3.918s (userspace) = 5.401s\nmulti-user.target reached after 5.401s in userspace.\n');
      return 0;
    }
  });

  defcmd({
    name: 'logrotate', path: '/usr/sbin/logrotate', pkg: 'logrotate', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { d: 0, f: 0, v: 0, s: 1, '--debug': 0, '--force': 0, '--verbose': 0 });
      const conf = rest[0];
      if (!conf) { io.stderr.write('logrotate: informe o arquivo de configuração. Ex.: logrotate -d /etc/logrotate.conf\n'); return 1; }
      let texto;
      try { texto = sh.m.fs.readFile(P(sh, conf), sh.fsopts()); }
      catch (e) { io.stderr.write(`error: cannot stat ${conf}: No such file or directory\n`); return 1; }
      const simulacao = opts.d || opts['--debug'];
      if (simulacao) io.stdout.write('WARNING: logrotate in debug mode does nothing except printing debug messages!\n\n');

      /* `include /etc/logrotate.d` é como a configuração real se organiza:
         o arquivo principal traz os padrões e cada pacote deixa o seu bloco
         num arquivo próprio. Sem seguir o include, o logrotate aqui não via
         nada — que é justamente o contrário do que a aula ensina. */
      const seguirIncludes = (txt, prof) => {
        if (prof > 3) return txt;
        return txt.replace(/^\s*include\s+(\S+)\s*$/gm, (linha, alvo) => {
          const caminho = P(sh, alvo);
          let st; try { st = sh.m.fs.stat(caminho, sh.fsopts()); } catch (e) { return ''; }
          if (st.type === 'dir') {
            let nomes = []; try { nomes = sh.m.fs.readdir(caminho, sh.fsopts()); } catch (e) { }
            return nomes.filter(n => !/[~]$|\.(dpkg-|rpm)/.test(n)).map(n => {
              try { return seguirIncludes(sh.m.fs.readFile(FileSystem.join(caminho, n), sh.fsopts()), prof + 1); }
              catch (e) { return ''; }
            }).join('\n');
          }
          try { return seguirIncludes(sh.m.fs.readFile(caminho, sh.fsopts()), prof + 1); } catch (e) { return ''; }
        });
      };
      texto = seguirIncludes(texto, 0);

      // encontra blocos "caminho { ... }"
      const blocos = texto.match(/^\s*([^\s{#][^{]*)\{([^}]*)\}/gm) || [];
      let girados = 0;
      for (const b of blocos) {
        const alvo = b.slice(0, b.indexOf('{')).trim();
        const corpo = b.slice(b.indexOf('{') + 1, b.lastIndexOf('}'));
        const manter = (/rotate\s+(\d+)/.exec(corpo) || [, '4'])[1];
        const comprimir = /\bcompress\b/.test(corpo);
        for (const padrao of alvo.split(/\s+/)) {
          let arquivos = [];
          if (/[*?\[]/.test(padrao)) {
            const dir = FileSystem.dirname(padrao);
            const base = FileSystem.basename(padrao);
            let nomes = [];
            try { nomes = sh.m.fs.readdir(dir, sh.fsopts()); } catch (e) { }
            arquivos = nomes.filter(n => LX.matchGlob(n, base) && !/\.(gz|[0-9]+)$/.test(n)).map(n => FileSystem.join(dir, n));
          } else {
            try { sh.m.fs.lstat(P(sh, padrao), sh.fsopts()); arquivos = [P(sh, padrao)]; } catch (e) { }
          }
          if (!arquivos.length) continue;
          for (const arq of arquivos) {
            io.stdout.write(`considering log ${arq}\n`);
            if (simulacao) { io.stdout.write(`  log needs rotating (mantendo ${manter} gerações${comprimir ? ', com compressão' : ''})\n`); continue; }
            try {
              const conteudo = sh.m.fs.readFile(arq, sh.fsopts());
              const destino = arq + '.1' + (comprimir ? '.gz' : '');
              const n = sh.m.fs.writeFile(destino, (comprimir ? 'GZ\u0000' : '') + conteudo, sh.fsopts());
              n.mode = 0o640;
              sh.m.fs.writeFile(arq, '', sh.fsopts());
              io.stdout.write(`  rotated to ${destino}\n`);
              girados++;
            } catch (e) { io.stderr.write(`error: ${arq}: ${e.message}\n`); }
          }
        }
      }
      if (!blocos.length) io.stderr.write(`logrotate: nenhum bloco de configuração encontrado em ${conf}\n`);
      return 0;
    }
  });

  defcmd({
    name: 'dd', path: '/usr/bin/dd', run: async ({ sh, io, args }) => {
      const par = {};
      for (const a of args) { const m = /^([a-z]+)=(.*)$/.exec(a); if (m) par[m[1]] = m[2]; }
      const tamanho = (v) => {
        const m = /^(\d+)([kKmMgGbc]?)B?$/.exec(String(v || '512'));
        if (!m) return 512;
        const mult = { '': 1, b: 512, c: 1, k: 1024, K: 1024, m: 1048576, M: 1048576, g: 1073741824, G: 1073741824 }[m[2]];
        return +m[1] * mult;
      };
      const bs = tamanho(par.bs || '512');
      const count = par.count !== undefined ? +par.count : null;
      if (!par.if && !par.of) { io.stderr.write("dd: informe if= e/ou of=\nEx.: dd if=/dev/zero of=arquivo bs=1M count=10\n"); return 1; }
      let dados = '';
      const LIMITE = 64 * 1024 * 1024;
      const total = count !== null ? Math.min(bs * count, LIMITE) : bs;
      try {
        if (par.if === '/dev/zero' || !par.if) dados = '\0'.repeat(total);
        else if (par.if === '/dev/urandom' || par.if === '/dev/random') {
          const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789';
          let t = '';
          for (let i = 0; i < total; i++) t += alfabeto[Math.floor(Math.random() * alfabeto.length)];
          dados = t;
        } else {
          const conteudo = sh.m.fs.readFile(P(sh, par.if), sh.fsopts());
          dados = count !== null ? conteudo.slice(0, total) : conteudo;
        }
      } catch (e) { io.stderr.write(`dd: failed to open '${par.if}': ${e.message}\n`); return 1; }
      if (par.of) {
        try {
          if (par.of === '/dev/null') { /* descarta */ }
          else sh.m.fs.writeFile(P(sh, par.of), dados, sh.fsopts());
        } catch (e) { io.stderr.write(`dd: failed to open '${par.of}': ${e.message}\n`); return 1; }
      } else io.stdout.write(dados);
      if (par.status !== 'none') {
        const blocos = count !== null ? count : 1;
        const mb = (dados.length / 1048576);
        io.stderr.write(`${blocos}+0 records in\n${blocos}+0 records out\n${dados.length} bytes (${mb.toFixed(1)} MB, ${(dados.length / 1048576).toFixed(1)} MiB) copied, 0.0${Math.max(1, Math.round(mb))} s, ${(mb * 8).toFixed(1)} MB/s\n`);
      }
      return 0;
    }
  });

  defcmd({
    name: 'findmnt', path: '/usr/bin/findmnt', pkg: 'util-linux', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { n: 0, l: 0, t: 1, S: 1, T: 1, o: 1 });
      let lista = sh.m.fs.mounts.slice();
      if (opts.t) lista = lista.filter(m => m.type === opts.t);
      if (opts.S) lista = lista.filter(m => m.dev === opts.S);
      if (rest.length) {
        const alvo = P(sh, rest[0]);
        lista = lista.filter(m => m.mount === alvo || m.dev === rest[0]);
        if (!lista.length) return 1;
      }
      if (!opts.n) io.stdout.write('TARGET                  SOURCE     FSTYPE   OPTIONS\n');
      for (const m of lista) io.stdout.write(`${m.mount.padEnd(23)} ${m.dev.padEnd(10)} ${m.type.padEnd(8)} ${m.opts}\n`);
      return 0;
    }
  });

  defcmd({
    name: 'lsblk', pkg: 'util-linux', run: async ({ sh, io, args }) => {
      const { opts } = getopt(args, { f: 0, a: 0, p: 0, o: 1 });
      if (opts.f) {
        io.stdout.write('NAME   FSTYPE FSVER LABEL            UUID                                 FSAVAIL FSUSE% MOUNTPOINTS\n');
        for (const d of sh.m.blockDevices) {
          io.stdout.write(`${d.name}\n`);
          d.children.forEach((c, i) => {
            const last = i === d.children.length - 1;
            io.stdout.write(`${last ? '└─' : '├─'}${c.name.padEnd(5)}${(c.fstype || '').padEnd(7)}${c.fstype === 'ext4' ? '1.0  ' : '     '}${(c.label || '').padEnd(17)}${(c.uuid || '').padEnd(37)}${c.mount === '/' ? '  15.9G    17% ' : '   500M     1% '}${c.mount}\n`);
          });
        }
        return 0;
      }
      io.stdout.write('NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\n');
      let maj = 252, min = 0;
      for (const d of sh.m.blockDevices) {
        io.stdout.write(`${d.name.padEnd(6)} ${maj}:${String(min).padStart(3, ' ')}   0 ${d.size.padStart(5)}  0 disk \n`);
        d.children.forEach((c, i) => {
          min++;
          const last = i === d.children.length - 1;
          io.stdout.write(`${(last ? '└─' : '├─') + c.name.padEnd(4)} ${maj}:${String(min).padStart(3, ' ')}   0 ${c.size.padStart(5)}  0 part ${c.mount}\n`);
        });
        min += 4;
      }
      return 0;
    }
  });
  defcmd({
    name: 'blkid', path: '/usr/sbin/blkid', pkg: 'util-linux', run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('blkid: Permission denied. Use sudo blkid.\n'); return 2; }
      const { opts, rest } = getopt(args, { s: 1, o: 1, p: 0, c: 1 });
      let alvos = sh.m.blockDevices.flatMap(d => d.children || []).filter(c => c.fstype);
      if (rest.length) {
        alvos = rest.map(r => acharParticao(sh, r)).filter(Boolean);
        if (!alvos.length) return 2;
      }
      const campo = opts.s ? String(opts.s).toUpperCase() : null;
      const formato = opts.o ? String(opts.o).toLowerCase() : 'full';
      for (const c of alvos) {
        const valores = {
          UUID: c.uuid, LABEL: c.label, TYPE: c.fstype,
          BLOCK_SIZE: c.fstype === 'vfat' ? '512' : '4096',
          PARTUUID: `3f2a1b0${c.name.slice(-1)}-0${c.name.slice(-1)}`
        };
        if (formato === 'value') {
          const lista = campo ? [campo] : ['UUID', 'BLOCK_SIZE', 'TYPE'];
          for (const k of lista) if (valores[k]) io.stdout.write(valores[k] + '\n');
          continue;
        }
        if (formato === 'device') { io.stdout.write('/dev/' + c.name + '\n'); continue; }
        if (formato === 'export') {
          io.stdout.write(`DEVNAME=/dev/${c.name}\n`);
          for (const k of ['LABEL', 'UUID', 'BLOCK_SIZE', 'TYPE', 'PARTUUID']) if (valores[k]) io.stdout.write(`${k}=${valores[k]}\n`);
          io.stdout.write('\n');
          continue;
        }
        if (campo) { if (valores[campo]) io.stdout.write(`/dev/${c.name}: ${campo}="${valores[campo]}"\n`); continue; }
        io.stdout.write(`/dev/${c.name}: ${c.label ? `LABEL="${c.label}" ` : ''}UUID="${c.uuid}" BLOCK_SIZE="${valores.BLOCK_SIZE}" TYPE="${c.fstype}" PARTUUID="${valores.PARTUUID}"\n`);
      }
      return 0;
    }
  });
  defcmd({
    name: 'mount', path: '/usr/bin/mount', pkg: 'util-linux', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { a: 0, t: 1, o: 1, l: 0, r: 0 });
      if (!rest.length && !opts.a) {
        for (const m of sh.m.fs.mounts) io.stdout.write(`${m.dev} on ${m.mount} type ${m.type} (${m.opts})\n`);
        return 0;
      }
      if (sh.uid !== 0) { io.stderr.write('mount: only root can use "--options" option\nmount: (hint) permission denied. Use sudo.\n'); return 1; }
      if (opts.a) {
        // mount -a: monta tudo que está no /etc/fstab e ainda não está montado
        let texto = '';
        try { texto = sh.m.fs.readFile('/etc/fstab', { ctx: sh.m.ctxRoot() }); } catch (e) { }
        let erros = 0;
        for (const linha of texto.split('\n')) {
          const l = linha.replace(/#.*/, '').trim();
          if (!l) continue;
          const [spec, ponto, tipo, opcoes] = l.split(/\s+/);
          if (!ponto || ponto === 'none' || ponto === '/' || tipo === 'swap') continue;
          if (sh.m.fs.mounts.some(mm => mm.mount === ponto)) continue;
          const part = acharParticao(sh, spec);
          if (!part) { io.stderr.write(`mount: ${ponto}: can't find ${spec}.\n`); erros = 1; continue; }
          if (!part.fstype) { io.stderr.write(`mount: ${ponto}: wrong fs type, bad option, bad superblock on /dev/${part.name}.\n`); erros = 1; continue; }
          try { sh.m.fs.mkdirp(ponto, { ctx: sh.m.ctxRoot() }); } catch (e) { }
          try {
            sh.m.fs.montarParticao(ponto, part, { ctx: sh.m.ctxRoot() });
            sh.m.fs.mounts.push({ dev: '/dev/' + part.name, mount: ponto, type: part.fstype, opts: (opcoes || 'defaults').replace('defaults', 'rw,relatime'), sizeKb: part.sizeKb || 5 * 1024 * 1024, usedKb: part.usedKb || 24 });
            part.mount = ponto;
          } catch (e) { io.stderr.write(`mount: ${ponto}: ${e.message}\n`); erros = 1; }
        }
        return erros;
      }
      const [dev, point] = rest;
      if (!point) { io.stderr.write(`mount: bad usage\nTry 'mount --help' for more information.\n`); return 1; }
      if (!sh.m.fs.exists(P(sh, point), sh.fsopts())) { io.stderr.write(`mount: ${point}: mount point does not exist.\n`); return 32; }
      const known = acharParticao(sh, dev);
      if (!known) { io.stderr.write(`mount: ${point}: special device ${dev} does not exist.\n`); return 32; }
      if (!known.fstype && !opts.t) { io.stderr.write(`mount: ${point}: wrong fs type, bad option, bad superblock on ${dev}, missing codepage or helper program, or other error.\n       dmesg(1) may have more information after failed mount system call.\nDica: o disco ${dev} não tem sistema de arquivos. Formate com "mkfs.ext4 ${dev}".\n`); return 32; }
      const alvo = P(sh, point);
      if (sh.m.fs.mounts.some(mm => mm.mount === alvo)) { io.stderr.write(`mount: ${point}: ${dev} already mounted or mount point busy.\n`); return 32; }
      const opcoes = 'rw,relatime' + (opts.o ? ',' + opts.o : '');
      try { sh.m.fs.montarParticao(alvo, known, { ctx: sh.m.ctxRoot() }); }
      catch (e) { io.stderr.write(`mount: ${point}: ${e.message}\n`); return 32; }
      sh.m.fs.mounts.push({ dev: '/dev/' + known.name, mount: alvo, type: known.fstype || opts.t, opts: opcoes, sizeKb: known.sizeKb || 5 * 1024 * 1024, usedKb: known.usedKb || 24 });
      known.mount = alvo;
      sh.m.log('kernel', `EXT4-fs (${known.name}): mounted filesystem ${known.uuid} r/w with ordered data mode. Quota mode: none.`, 6, 0);
      return 0;
    }
  });
  defcmd({
    name: 'umount', path: '/usr/bin/umount', pkg: 'util-linux', run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write(`umount: ${args[0]}: must be superuser to unmount.\n`); return 32; }
      const target = P(sh, args[0] || '');
      const idx = sh.m.fs.mounts.findIndex(m => m.mount === target || m.dev === args[0]);
      if (idx === -1) { io.stderr.write(`umount: ${args[0]}: not mounted.\n`); return 32; }
      const mnt = sh.m.fs.mounts[idx];
      if (['/', '/proc', '/sys', '/dev', '/run'].includes(mnt.mount)) {
        io.stderr.write(`umount: ${mnt.mount}: target is busy.\n`); return 32;
      }
      // processos com cwd dentro do ponto de montagem seguram o umount
      const ocupado = Array.from(sh.m.processes.values()).find(pr => (pr.cwd || '').startsWith(mnt.mount + '/'));
      if (ocupado) {
        io.stderr.write(`umount: ${mnt.mount}: target is busy.\n`); return 32;
      }
      if (sh.cwd === mnt.mount || sh.cwd.startsWith(mnt.mount + '/')) {
        io.stderr.write(`umount: ${mnt.mount}: target is busy.\n       (o seu shell está dentro do ponto de montagem — saia com "cd /" antes)\n`);
        return 32;
      }
      try { sh.m.fs.desmontarParticao(mnt.mount, { ctx: sh.m.ctxRoot() }); } catch (e) { }
      const part = acharParticao(sh, mnt.dev);
      if (part) part.mount = '';
      sh.m.fs.mounts.splice(idx, 1);
      return 0;
    }
  });
  defcmd({
    name: ['mkfs.ext4', 'mkfs.ext3', 'mkfs.ext2', 'mkfs.xfs', 'mkfs'], path: '/usr/sbin/', pkg: 'e2fsprogs',
    run: async ({ sh, io, args, name }) => {
      if (sh.uid !== 0) { io.stderr.write('mke2fs: Permission denied while trying to determine filesystem size\n'); return 1; }
      const { opts } = getopt(args, { L: 1, t: 1, F: 0, m: 1 });
      const dev = args.filter(a => a.startsWith('/dev/'))[0];
      const known = acharParticao(sh, dev);
      if (!known) { io.stderr.write(`mke2fs 1.47.2 (1-Jan-2026)\nThe file ${dev} does not exist and no size was specified.\n`); return 1; }
      if (known.mount) { io.stderr.write(`mke2fs 1.47.2 (1-Jan-2026)\n${dev} is mounted; will not make a filesystem here!\n`); return 1; }
      known.fstype = /ext[234]/.test(name) ? name.replace('mkfs.', '') : (opts.t || 'ext4');
      known.uuid = LX.novoUUID ? LX.novoUUID() : '4b8e7d21-9a3c-4f56-b021-7e9f3a2c5d81';
      if (opts.L) known.label = opts.L;
      known.fsRoot = null;   // formatar apaga tudo que havia na partição
      io.stdout.write(`mke2fs 1.47.2 (1-Jan-2026)\nCreating filesystem with 1310720 4k blocks and 327680 inodes\nFilesystem UUID: ${known.uuid}\nSuperblock backups stored on blocks: \n\t32768, 98304, 163840, 229376, 294912\n\nAllocating group tables: done                            \nWriting inode tables: done                            \nCreating journal (16384 blocks): done\nWriting superblocks and filesystem accounting information: done\n\n`);
      return 0;
    }
  });
  defcmd({
    name: 'fdisk', path: '/usr/sbin/fdisk', pkg: 'util-linux', run: async ({ sh, io, args }) => {
      if (args.includes('-l')) {
        if (sh.uid !== 0) { io.stderr.write('fdisk: cannot open /dev/vda: Permission denied\n'); return 1; }
        io.stdout.write(`Disk /dev/vda: 20 GiB, 21474836480 bytes, 41943040 sectors\nUnits: sectors of 1 * 512 = 512 bytes\nSector size (logical/physical): 512 bytes / 512 bytes\nI/O size (minimum/optimal): 512 bytes / 512 bytes\nDisklabel type: gpt\nDisk identifier: 2F1A9C03-7B4E-4D21-9E05-8A3F2C1B7D64\n\nDevice      Start      End  Sectors  Size Type\n/dev/vda1    2048  1050623  1048576  512M EFI System\n/dev/vda2 1050624 41940991 40890368 19.5G Linux filesystem\n\n\nDisk /dev/vdb: 5 GiB, 5368709120 bytes, 10485760 sectors\n`);
        return 0;
      }
      io.stderr.write('fdisk: modo interativo indisponível neste ambiente. Use "sudo fdisk -l" para listar.\n');
      return 1;
    }
  });

})();
