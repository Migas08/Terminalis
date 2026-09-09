/* =========================================================================
   TERMINALIS — GNU coreutils
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, SysError, defcmd, modeToRwx } = LX;
  const C = {
    reset: '\x1b[0m', dir: '\x1b[1;34m', link: '\x1b[1;36m', exec: '\x1b[1;32m',
    arch: '\x1b[1;31m', dev: '\x1b[1;33m', img: '\x1b[1;35m', bold: '\x1b[1m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
    magenta: '\x1b[35m', cyan: '\x1b[36m', dim: '\x1b[2m'
  };
  LX.C = C;

  /* -------- utilidades comuns -------- */
  function getopt(args, spec) {
    // spec: { 'l': 0, 'w': 1, '--long': 1 }
    const opts = {}; const rest = []; let noMore = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (noMore) { rest.push(a); continue; }
      if (a === '--') { noMore = true; continue; }
      if (a.startsWith('--')) {
        const eq = a.indexOf('=');
        const name = eq > 0 ? a.slice(0, eq) : a;
        const need = spec[name];
        if (need === 1) opts[name] = eq > 0 ? a.slice(eq + 1) : args[++i];
        else opts[name] = eq > 0 ? a.slice(eq + 1) : true;
        continue;
      }
      if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
        for (let k = 1; k < a.length; k++) {
          const ch = a[k];
          if (spec[ch] === 1) {
            const val = a.slice(k + 1);
            opts[ch] = val !== '' ? val : args[++i];
            break;
          }
          opts[ch] = true;
        }
        continue;
      }
      rest.push(a);
    }
    return { opts, rest };
  }
  LX.getopt = getopt;

  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }
  function err(io, cmd, path, e) {
    const msg = e && e.isSysError ? e.message : (e ? e.message : 'erro');
    io.stderr.write(`${cmd}: ${path ? path + ': ' : ''}${msg}\n`);
  }
  LX.cmdErr = err;

  function humanSize(bytes, si) {
    const base = si ? 1000 : 1024;
    const units = si ? ['B', 'kB', 'MB', 'GB', 'TB'] : ['', 'K', 'M', 'G', 'T'];
    if (bytes < base) return String(bytes) + (si ? 'B' : '');
    let u = 0, v = bytes;
    while (v >= base && u < units.length - 1) { v /= base; u++; }
    return (v < 10 ? v.toFixed(1) : Math.round(v)) + units[u];
  }
  LX.humanSize = humanSize;

  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function lsTime(ms) {
    const d = new Date(ms);
    const now = Date.now();
    const six = 1000 * 60 * 60 * 24 * 182;
    const mon = MONTHS_EN[d.getMonth()];
    const day = String(d.getDate()).padStart(2, ' ');
    if (now - ms > six || ms - now > 1000 * 60 * 60)
      return `${mon} ${day} ${String(d.getFullYear()).padStart(5, ' ')}`.slice(0, 12);
    return `${mon} ${day} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  LX.lsTime = lsTime;

  function colorFor(node, name) {
    if (node.type === 'dir') return C.dir;
    if (node.type === 'link') return C.link;
    if (node.type === 'chr' || node.type === 'blk') return C.dev;
    if (node.mode & 0o111) return C.exec;
    if (/\.(tar|gz|zip|bz2|xz|tgz|deb|rpm)$/.test(name)) return C.arch;
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(name)) return C.img;
    return '';
  }

  /* ================================ ls ================================ */
  defcmd({
    name: 'ls', path: '/usr/bin/ls', pkg: 'coreutils',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, a: 0, A: 0, h: 0, R: 0, t: 0, r: 0, S: 0, d: 0, i: 0, n: 0, F: 0, '1': 0, m: 0, Q: 0, '--color': 1, '--help': 0, '--all': 0, '--human-readable': 0, '--reverse': 0, '--recursive': 0, '--time': 1, '--sort': 1, '--full-time': 0, '--group-directories-first': 0 });
      if (opts['--help']) { io.stdout.write(HELP_LS); return 0; }
      const long = !!(opts.l || opts.n || opts['--full-time']);
      const all = !!(opts.a || opts['--all']);
      const almost = !!opts.A;
      const human = !!(opts.h || opts['--human-readable']);
      const useColor = opts['--color'] !== 'never' && io.stdout.isTTY !== false && !io.inPipe;
      const targets = rest.length ? rest : ['.'];
      let status = 0;
      const dirs = [], files = [];
      for (const t of targets) {
        try {
          const st = opts.d ? sh.m.fs.lstat(P(sh, t), sh.fsopts()) : sh.m.fs.stat(P(sh, t), sh.fsopts());
          if (st.type === 'dir' && !opts.d) dirs.push({ arg: t, node: st });
          else files.push({ arg: t, node: st, name: t });
        } catch (e) {
          io.stderr.write(`ls: cannot access '${t}': ${e.isSysError ? e.message : e.message}\n`);
          status = 2;
        }
      }
      const fmtEntries = (entries, dirPath) => {
        // entries: [{name, node}]
        let list = entries.slice();
        if (opts.t) list.sort((a, b) => b.node.mtime - a.node.mtime);
        else if (opts.S) list.sort((a, b) => b.node.size - a.node.size);
        else list.sort((a, b) => a.name.replace(/^\./, '').localeCompare(b.name.replace(/^\./, ''), 'en'));
        if (opts.r || opts['--reverse']) list.reverse();
        if (opts['--group-directories-first']) list = [...list.filter(e => e.node.type === 'dir'), ...list.filter(e => e.node.type !== 'dir')];
        if (long) {
          let total = 0;
          for (const e of list) total += sh.m.fs.duBlocks(e.node);
          if (dirPath) io.stdout.write(`total ${total}\n`);
          const widths = { links: 1, user: 1, group: 1, size: 1 };
          const rows = list.map(e => {
            const n = e.node;
            const u = opts.n ? String(n.uid) : ((sh.m.userByUid(n.uid) || {}).name || String(n.uid));
            const g = opts.n ? String(n.gid) : ((sh.m.groupByGid(n.gid) || {}).name || String(n.gid));
            const size = n.type === 'chr' || n.type === 'blk' ? `${n.major}, ${n.minor}` : (human ? humanSize(n.size) : String(n.size));
            widths.links = Math.max(widths.links, String(n.nlink).length);
            widths.user = Math.max(widths.user, u.length);
            widths.group = Math.max(widths.group, g.length);
            widths.size = Math.max(widths.size, size.length);
            return { e, n, u, g, size };
          });
          for (const r of rows) {
            const n = r.n;
            let nm = r.e.name;
            if (useColor) { const c = colorFor(n, nm); if (c) nm = c + nm + C.reset; }
            if (n.type === 'link') nm += ' -> ' + n.target;
            io.stdout.write(`${opts.i ? String(n.ino).padStart(8) + ' ' : ''}${modeToRwx(n.mode, n.type)}${LX.temACL(n) ? '+' : ''} ${String(n.nlink).padStart(widths.links)} ${r.u.padEnd(widths.user)} ${r.g.padEnd(widths.group)} ${r.size.padStart(widths.size)} ${lsTime(n.mtime)} ${nm}\n`);
          }
          return;
        }
        // colunas
        const names = list.map(e => {
          let nm = (opts.i ? String(e.node.ino) + ' ' : '') + e.name;
          if (opts.F) nm += e.node.type === 'dir' ? '/' : (e.node.type === 'link' ? '@' : ((e.node.mode & 0o111) ? '*' : ''));
          if (useColor) { const c = colorFor(e.node, e.name); if (c) nm = c + nm + C.reset; }
          return nm;
        });
        if (!names.length) return;
        if (opts['1'] || io.inPipe) { names.forEach(n => io.stdout.write(n + '\n')); return; }
        const plain = list.map(e => e.name + (opts.F && e.node.type === 'dir' ? '/' : ''));
        const width = 80;
        const maxLen = Math.max(...plain.map(s => s.length)) + 2;
        const cols = Math.max(1, Math.floor(width / maxLen));
        const rowsN = Math.ceil(names.length / cols);
        for (let r = 0; r < rowsN; r++) {
          let line = '';
          for (let c = 0; c < cols; c++) {
            const i = c * rowsN + r;
            if (i >= names.length) continue;
            const pad = maxLen - plain[i].length;
            line += names[i] + (c === cols - 1 ? '' : ' '.repeat(Math.max(1, pad)));
          }
          io.stdout.write(line.trimEnd() + '\n');
        }
      };

      if (files.length) {
        fmtEntries(files.map(f => ({ name: f.arg, node: f.node })), null);
        if (dirs.length) io.stdout.write('\n');
      }
      const listDir = (d, printHeader) => {
        if (printHeader) io.stdout.write(`${d.arg}:\n`);
        let names;
        try { names = sh.m.fs.readdir(P(sh, d.arg), sh.fsopts()); }
        catch (e) { io.stderr.write(`ls: cannot open directory '${d.arg}': ${e.message}\n`); status = 2; return; }
        let entries = names.filter(n => all || almost || !n.startsWith('.')).map(n => {
          let node;
          try { node = sh.m.fs.lstat(FileSystem.join(P(sh, d.arg), n), sh.fsopts()); } catch (e) { node = { type: 'file', mode: 0, uid: 0, gid: 0, size: 0, mtime: 0, nlink: 1 }; }
          return { name: n, node };
        });
        if (all) {
          entries.unshift({ name: '..', node: sh.m.fs.stat(FileSystem.join(P(sh, d.arg), '..'), sh.fsopts()) });
          entries.unshift({ name: '.', node: d.node });
        }
        fmtEntries(entries, P(sh, d.arg));
        if (opts.R || opts['--recursive']) {
          for (const e of entries) {
            if (e.node.type === 'dir' && e.name !== '.' && e.name !== '..') {
              io.stdout.write('\n');
              listDir({ arg: FileSystem.join(d.arg, e.name), node: e.node }, true);
            }
          }
        }
      };
      dirs.forEach((d, i) => {
        if (i > 0) io.stdout.write('\n');
        listDir(d, targets.length > 1 || dirs.length > 1 || opts.R || opts['--recursive']);
      });
      return status;
    }
  });
  const HELP_LS = `Uso: ls [OPÇÃO]... [ARQUIVO]...
Lista informações sobre os ARQUIVOS (do diretório atual por padrão).

  -a, --all                  não ignora entradas que começam com .
  -A                         como -a, mas não lista . e ..
  -d                         lista o próprio diretório, não seu conteúdo
  -h, --human-readable       tamanhos legíveis (ex.: 1K 234M 2G)
  -l                         usa o formato longo (permissões, dono, tamanho, data)
  -R, --recursive            lista subdiretórios recursivamente
  -r, --reverse              inverte a ordem
  -S                         ordena por tamanho, maior primeiro
  -t                         ordena por data de modificação, mais recente primeiro
  -i                         mostra o número de inode
  -1                         um arquivo por linha
      --help                 mostra esta ajuda
`;

  /* ============================ navegação ============================ */
  defcmd({ name: 'pwd', run: async ({ sh, io, args }) => { io.stdout.write((args.includes('-P') ? sh.cwd : (sh.getVar('PWD') || sh.cwd)) + '\n'); return 0; } });

  defcmd({
    name: 'mkdir', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { p: 0, v: 0, m: 1, '--parents': 0, '--verbose': 0, '--mode': 1, '--help': 0 });
      if (opts['--help']) { io.stdout.write(`Uso: mkdir [OPÇÃO]... DIRETÓRIO...\nCria os DIRETÓRIOS, se ainda não existirem.\n\n  -m, --mode=MODO   define o modo (permissões), como em chmod\n  -p, --parents     cria diretórios-pai conforme necessário; não reclama se já existir\n  -v, --verbose     mostra uma mensagem para cada diretório criado\n`); return 0; }
      if (!rest.length) { io.stderr.write('mkdir: missing operand\nTry \'mkdir --help\' for more information.\n'); return 1; }
      let status = 0;
      for (const d of rest) {
        try {
          const o = sh.fsopts();
          if (opts.m || opts['--mode']) o.mode = parseInt(opts.m || opts['--mode'], 8);
          if (opts.p || opts['--parents']) sh.m.fs.mkdirp(P(sh, d), o);
          else sh.m.fs.mkdir(P(sh, d), o);
          if (opts.v || opts['--verbose']) io.stdout.write(`mkdir: created directory '${d}'\n`);
        } catch (e) {
          io.stderr.write(`mkdir: cannot create directory '${d}': ${e.message}\n`); status = 1;
        }
      }
      return status;
    }
  });

  defcmd({
    name: 'rmdir', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { p: 0, v: 0, '--parents': 0, '--ignore-fail-on-non-empty': 0 });
      let status = 0;
      for (const d of rest) {
        try { sh.m.fs.rmdir(P(sh, d), sh.fsopts()); }
        catch (e) { io.stderr.write(`rmdir: failed to remove '${d}': ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  defcmd({
    name: 'touch', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { c: 0, a: 0, m: 0, t: 1, d: 1, r: 1, '--help': 0 });
      if (!rest.length) { io.stderr.write('touch: missing file operand\n'); return 1; }
      let status = 0;
      for (const f of rest) {
        try {
          const path = P(sh, f);
          if (sh.m.fs.exists(path, sh.fsopts())) {
            const n = sh.m.fs.stat(path, sh.fsopts());
            const t = opts.d ? Date.parse(opts.d) : Date.now();
            if (!opts.a) n.mtime = isNaN(t) ? Date.now() : t;
            if (!opts.m) n.atime = isNaN(t) ? Date.now() : t;
          } else if (!opts.c) {
            sh.m.fs.create(path, '', sh.fsopts());
          }
        } catch (e) { io.stderr.write(`touch: cannot touch '${f}': ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  defcmd({
    name: 'cp', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { r: 0, R: 0, a: 0, v: 0, i: 0, f: 0, p: 0, n: 0, u: 0, d: 0, '--recursive': 0, '--verbose': 0, '--archive': 0, '--preserve': 0, '--help': 0, '--parents': 0 });
      if (opts['--help']) { io.stdout.write(`Uso: cp [OPÇÃO]... ORIGEM DESTINO\n  ou: cp [OPÇÃO]... ORIGEM... DIRETÓRIO\n\n  -r, -R, --recursive   copia diretórios recursivamente\n  -a, --archive         mesmo que -dR --preserve=all\n  -i                    pergunta antes de sobrescrever\n  -n                    não sobrescreve arquivo existente\n  -p                    preserva dono, permissões e datas\n  -v, --verbose         mostra o que está sendo feito\n`); return 0; }
      if (rest.length < 2) { io.stderr.write(`cp: missing ${rest.length ? 'destination file operand after \'' + rest[0] + '\'' : 'file operand'}\n`); return 1; }
      const recursive = opts.r || opts.R || opts.a || opts['--recursive'] || opts['--archive'];
      const dst = rest[rest.length - 1];
      const srcs = rest.slice(0, -1);
      let status = 0;
      let dstIsDir = false;
      try { dstIsDir = sh.m.fs.stat(P(sh, dst), sh.fsopts()).type === 'dir'; } catch (e) { }
      if (srcs.length > 1 && !dstIsDir) { io.stderr.write(`cp: target '${dst}' is not a directory\n`); return 1; }
      for (const s of srcs) {
        try {
          const target = dstIsDir ? FileSystem.join(P(sh, dst), FileSystem.basename(s)) : P(sh, dst);
          if (opts.n && sh.m.fs.exists(target, sh.fsopts())) continue;
          const st = sh.m.fs.lstat(P(sh, s), sh.fsopts());
          if (st.type === 'dir' && !recursive) { io.stderr.write(`cp: -r not specified; omitting directory '${s}'\n`); status = 1; continue; }
          sh.m.fs.copy(P(sh, s), target, sh.fsopts({ recursive, preserve: opts.p || opts.a || opts['--archive'], noDeref: opts.d || opts.a }));
          if (opts.v || opts['--verbose']) io.stdout.write(`'${s}' -> '${dstIsDir ? dst + '/' + FileSystem.basename(s) : dst}'\n`);
        } catch (e) { io.stderr.write(`cp: cannot stat '${s}': ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  defcmd({
    name: 'mv', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { v: 0, i: 0, f: 0, n: 0, u: 0, '--verbose': 0, '--help': 0 });
      if (rest.length < 2) { io.stderr.write(`mv: missing ${rest.length ? 'destination file operand after \'' + rest[0] + '\'' : 'file operand'}\n`); return 1; }
      const dst = rest[rest.length - 1];
      const srcs = rest.slice(0, -1);
      let status = 0;
      let dstIsDir = false;
      try { dstIsDir = sh.m.fs.stat(P(sh, dst), sh.fsopts()).type === 'dir'; } catch (e) { }
      if (srcs.length > 1 && !dstIsDir) { io.stderr.write(`mv: target '${dst}' is not a directory\n`); return 1; }
      for (const s of srcs) {
        try {
          if (opts.n && sh.m.fs.exists(dstIsDir ? FileSystem.join(P(sh, dst), FileSystem.basename(s)) : P(sh, dst), sh.fsopts())) continue;
          sh.m.fs.rename(P(sh, s), P(sh, dst), sh.fsopts());
          if (opts.v || opts['--verbose']) io.stdout.write(`renamed '${s}' -> '${dst}'\n`);
        } catch (e) { io.stderr.write(`mv: cannot move '${s}' to '${dst}': ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  defcmd({
    name: 'rm', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { r: 0, R: 0, f: 0, i: 0, v: 0, d: 0, '--recursive': 0, '--force': 0, '--verbose': 0, '--help': 0, '--no-preserve-root': 0 });
      if (opts['--help']) { io.stdout.write(`Uso: rm [OPÇÃO]... [ARQUIVO]...\nRemove (desvincula) os ARQUIVOS.\n\n  -f, --force        ignora arquivos inexistentes, nunca pergunta\n  -i                 pergunta antes de cada remoção\n  -r, -R, --recursive  remove diretórios e seu conteúdo recursivamente\n  -d                 remove diretórios vazios\n  -v, --verbose      explica o que está sendo feito\n\nCuidado: arquivos removidos com rm NÃO vão para uma lixeira.\n`); return 0; }
      const recursive = opts.r || opts.R || opts['--recursive'];
      const force = opts.f || opts['--force'];
      if (!rest.length) { if (!force) io.stderr.write('rm: missing operand\nTry \'rm --help\' for more information.\n'); return force ? 0 : 1; }
      let status = 0;
      for (const f of rest) {
        const path = P(sh, f);
        if (path === '/' && !opts['--no-preserve-root']) { io.stderr.write(`rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n`); status = 1; continue; }
        try {
          let st;
          try { st = sh.m.fs.lstat(path, sh.fsopts()); }
          catch (e) { if (!force) { io.stderr.write(`rm: cannot remove '${f}': No such file or directory\n`); status = 1; } continue; }
          if (st.type === 'dir' && !recursive && !opts.d) { io.stderr.write(`rm: cannot remove '${f}': Is a directory\n`); status = 1; continue; }
          if (st.type === 'dir' && opts.d && !recursive) { sh.m.fs.rmdir(path, sh.fsopts()); continue; }
          sh.m.fs.rmrf(path, sh.fsopts());
          if (opts.v || opts['--verbose']) io.stdout.write(`removed '${f}'\n`);
        } catch (e) { if (!force) { io.stderr.write(`rm: cannot remove '${f}': ${e.message}\n`); status = 1; } }
      }
      return status;
    }
  });

  defcmd({
    name: 'ln', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { s: 0, f: 0, v: 0, '--symbolic': 0, '--force': 0 });
      if (rest.length < 1) { io.stderr.write('ln: missing file operand\n'); return 1; }
      const target = rest[0];
      let linkName = rest[1] || FileSystem.basename(target);
      try {
        let lp = P(sh, linkName);
        try { if (sh.m.fs.stat(lp, sh.fsopts()).type === 'dir') lp = FileSystem.join(lp, FileSystem.basename(target)); } catch (e) { }
        if ((opts.f || opts['--force'])) { try { sh.m.fs.unlink(lp, sh.fsopts()); } catch (e) { } }
        if (opts.s || opts['--symbolic']) sh.m.fs.symlink(target, lp, sh.fsopts());
        else sh.m.fs.link(P(sh, target), lp, sh.fsopts());
        if (opts.v) io.stdout.write(`'${linkName}' -> '${target}'\n`);
        return 0;
      } catch (e) { io.stderr.write(`ln: failed to create link '${linkName}': ${e.message}\n`); return 1; }
    }
  });

  /* ============================ leitura ============================ */
  defcmd({
    name: 'cat', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { n: 0, b: 0, A: 0, E: 0, T: 0, s: 0, v: 0, '--number': 0, '--help': 0 });
      let status = 0;
      let ln = 0;
      const emit = (text) => {
        if (opts.n || opts.b || opts['--number'] || opts.E || opts.A || opts.T) {
          const lines = text.split('\n');
          const trailing = lines[lines.length - 1] === '';
          if (trailing) lines.pop();
          for (const l of lines) {
            let out = l;
            if (opts.T || opts.A) out = out.replace(/\t/g, '^I');
            if (opts.E || opts.A) out = out + '$';
            if (opts.b) { if (l !== '') { ln++; out = String(ln).padStart(6) + '\t' + out; } }
            else if (opts.n || opts['--number']) { ln++; out = String(ln).padStart(6) + '\t' + out; }
            io.stdout.write(out + '\n');
          }
          if (!trailing && lines.length === 0) { }
        } else io.stdout.write(text);
      };
      if (!rest.length || rest.includes('-')) {
        for (const f of (rest.length ? rest : ['-'])) {
          if (f === '-') { emit(io.stdin ? io.stdin.readAll() : ''); continue; }
          try { emit(sh.m.fs.readFile(P(sh, f), sh.fsopts())); }
          catch (e) { io.stderr.write(`cat: ${f}: ${e.message}\n`); status = 1; }
        }
        return status;
      }
      for (const f of rest) {
        try {
          const st = sh.m.fs.stat(P(sh, f), sh.fsopts());
          if (st.type === 'dir') { io.stderr.write(`cat: ${f}: Is a directory\n`); status = 1; continue; }
          emit(sh.m.fs.readFile(P(sh, f), sh.fsopts()));
        }
        catch (e) { io.stderr.write(`cat: ${f}: ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  defcmd({ name: 'tac', run: async ({ sh, io, args }) => {
    const data = args.length ? args.map(f => sh.m.fs.readFile(P(sh, f), sh.fsopts())).join('') : io.stdin.readAll();
    const lines = data.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
    io.stdout.write(lines.reverse().join('\n') + (lines.length ? '\n' : ''));
    return 0;
  } });

  defcmd({
    name: ['less', 'more'], path: '/usr/bin/', pkg: 'less',
    run: async ({ sh, io, args, name }) => {
      const { opts, rest } = getopt(args, { N: 0, S: 0, F: 0, R: 0, X: 0, '+F': 0 });
      let data = '';
      if (rest.length) {
        for (const f of rest) {
          try { data += sh.m.fs.readFile(P(sh, f), sh.fsopts()); }
          catch (e) { io.stderr.write(`${name}: ${f}: ${e.message}\n`); return 1; }
        }
      } else data = io.stdin ? io.stdin.readAll() : '';
      if (io.term && io.term.pager && !io.inPipe) { await io.term.pager(data, rest[0] || '(stdin)', { numbers: !!opts.N }); return 0; }
      io.stdout.write(data);
      return 0;
    }
  });

  defcmd({
    name: 'head', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { n: 1, c: 1, q: 0, v: 0, '--lines': 1, '--bytes': 1 });
      const pediuN = opts.n !== undefined || opts['--lines'] !== undefined;
      let n = parseInt(opts.n || opts['--lines'] || '10', 10);
      /* a forma antiga `head -5`; só vale quando o -n não foi usado, senão
         o próprio valor negativo de `-n -1` seria relido como contagem */
      const numArg = pediuN ? null : args.find(a => /^-\d+$/.test(a));
      if (numArg) n = parseInt(numArg.slice(1), 10);
      const files = rest.filter(r => !/^-\d+$/.test(r));
      const emit = (text, label, showLabel) => {
        if (showLabel) io.stdout.write(`==> ${label} <==\n`);
        if (opts.c || opts['--bytes']) { io.stdout.write(text.slice(0, parseInt(opts.c || opts['--bytes'], 10))); return; }
        const lines = text.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        /* `head -n -1` significa "tudo menos as últimas N linhas" — é como se
           descarta a linha "total" do wc, por exemplo. */
        const fatia = n < 0 ? lines.slice(0, Math.max(0, lines.length + n)) : lines.slice(0, n);
        io.stdout.write(fatia.map(l => l + '\n').join(''));
      };
      if (!files.length) { emit(io.stdin ? io.stdin.readAll() : '', '(stdin)', false); return 0; }
      let status = 0;
      files.forEach((f, i) => {
        try {
          if (i > 0) io.stdout.write('\n');
          emit(sh.m.fs.readFile(P(sh, f), sh.fsopts()), f, files.length > 1 && !opts.q);
        } catch (e) { io.stderr.write(`head: cannot open '${f}' for reading: ${e.message}\n`); status = 1; }
      });
      return status;
    }
  });

  defcmd({
    name: 'tail', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { n: 1, c: 1, f: 0, F: 0, q: 0, '--lines': 1, '--follow': 0 });
      let nspec = opts.n || opts['--lines'] || '10';
      const numArg = args.find(a => /^-\d+$/.test(a));
      if (numArg) nspec = numArg.slice(1);
      const fromStart = String(nspec).startsWith('+');
      let n = parseInt(String(nspec).replace('+', ''), 10);
      const files = rest.filter(r => !/^-\d+$/.test(r));
      const emit = (text, label, showLabel) => {
        if (showLabel) io.stdout.write(`==> ${label} <==\n`);
        if (opts.c) { io.stdout.write(text.slice(-parseInt(opts.c, 10))); return; }
        const lines = text.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        const out = fromStart ? lines.slice(n - 1) : lines.slice(Math.max(0, lines.length - n));
        io.stdout.write(out.map(l => l + '\n').join(''));
      };
      if (!files.length) { emit(io.stdin ? io.stdin.readAll() : '', '(stdin)', false); return 0; }
      let status = 0;
      files.forEach((f, i) => {
        try {
          if (i > 0) io.stdout.write('\n');
          emit(sh.m.fs.readFile(P(sh, f), sh.fsopts()), f, files.length > 1 && !opts.q);
        } catch (e) { io.stderr.write(`tail: cannot open '${f}' for reading: ${e.message}\n`); status = 1; }
      });
      if (opts.f || opts.F || opts['--follow']) {
        io.stdout.write(`\n${LX.C.dim}[tail -f: acompanhando... pressione Ctrl+C para sair]${LX.C.reset}\n`);
        if (io.term && io.term.follow) await io.term.follow(files.map(f => P(sh, f)));
      }
      return status;
    }
  });

  defcmd({
    name: 'wc', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, w: 0, c: 0, m: 0, L: 0, '--lines': 0, '--words': 0, '--bytes': 0, '--chars': 0 });
      const showAll = !(opts.l || opts.w || opts.c || opts.m || opts.L || opts['--lines'] || opts['--words'] || opts['--bytes']);
      const count = (text) => {
        const lines = text === '' ? 0 : (text.split('\n').length - (text.endsWith('\n') ? 1 : 0));
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        return { l: lines, w: words, c: text.length, maxL: Math.max(0, ...text.split('\n').map(s => s.length)) };
      };
      const fmt = (r, label) => {
        const parts = [];
        if (showAll || opts.l || opts['--lines']) parts.push(String(r.l).padStart(showAll ? 7 : 0));
        if (showAll || opts.w || opts['--words']) parts.push(String(r.w).padStart(showAll ? 7 : 0));
        if (showAll || opts.c || opts.m || opts['--bytes'] || opts['--chars']) parts.push(String(r.c).padStart(showAll ? 7 : 0));
        if (opts.L) parts.push(String(r.maxL));
        io.stdout.write(parts.join(' ') + (label ? ' ' + label : '') + '\n');
      };
      if (!rest.length) { fmt(count(io.stdin ? io.stdin.readAll() : ''), ''); return 0; }
      let status = 0;
      const totals = { l: 0, w: 0, c: 0, maxL: 0 };
      for (const f of rest) {
        try {
          const r = count(sh.m.fs.readFile(P(sh, f), sh.fsopts()));
          totals.l += r.l; totals.w += r.w; totals.c += r.c;
          fmt(r, f);
        } catch (e) { io.stderr.write(`wc: ${f}: ${e.message}\n`); status = 1; }
      }
      if (rest.length > 1) fmt(totals, 'total');
      return status;
    }
  });

  defcmd({
    name: 'sort', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { n: 0, r: 0, u: 0, f: 0, k: 1, t: 1, h: 0, b: 0, o: 1, V: 0, R: 0, c: 0, '--numeric-sort': 0, '--reverse': 0, '--unique': 0, '--human-numeric-sort': 0 });
      let data = '';
      if (rest.length) { for (const f of rest) { try { data += sh.m.fs.readFile(P(sh, f), sh.fsopts()); } catch (e) { io.stderr.write(`sort: cannot read: ${f}: ${e.message}\n`); return 2; } } }
      else data = io.stdin ? io.stdin.readAll() : '';
      let lines = data.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      const sep = opts.t;
      const keyOf = (l) => {
        if (!opts.k) return l;
        const spec = String(opts.k).split(',');
        const parts = sep ? l.split(sep) : l.trim().split(/\s+/);
        const startSpec = spec[0];
        const m = /^(\d+)([a-zA-Z]*)$/.exec(startSpec);
        const start = m ? parseInt(m[1], 10) - 1 : 0;
        const end = spec[1] ? parseInt(spec[1], 10) : parts.length;
        return parts.slice(start, end).join(sep || ' ');
      };
      const numeric = opts.n || opts['--numeric-sort'];
      const human = opts.h || opts['--human-numeric-sort'];
      const parseHuman = (s) => {
        const m = /^\s*([\d.,]+)\s*([KMGTP]?)/i.exec(s);
        if (!m) return 0;
        const mult = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }[m[2].toUpperCase()] || 1;
        return parseFloat(m[1].replace(',', '.')) * mult;
      };
      const keyOpts = /^(\d+)([a-zA-Z]*)/.exec(String(opts.k || ''));
      const keyNumeric = numeric || (keyOpts && keyOpts[2] && keyOpts[2].includes('n'));
      const keyReverse = (keyOpts && keyOpts[2] && keyOpts[2].includes('r'));
      lines.sort((a, b) => {
        let ka = keyOf(a), kb = keyOf(b);
        if (opts.f) { ka = ka.toLowerCase(); kb = kb.toLowerCase(); }
        if (human) return parseHuman(ka) - parseHuman(kb);
        if (keyNumeric) {
          const na = parseFloat(ka) || 0, nb = parseFloat(kb) || 0;
          if (na !== nb) return na - nb;
          return 0;
        }
        if (opts.V) return ka.localeCompare(kb, 'en', { numeric: true });
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
      if (opts.r || opts['--reverse'] || keyReverse) lines.reverse();
      if (opts.R) lines.sort(() => Math.random() - 0.5);
      if (opts.u || opts['--unique']) { const seen = new Set(); lines = lines.filter(l => { const k = opts.f ? l.toLowerCase() : l; if (seen.has(k)) return false; seen.add(k); return true; }); }
      const out = lines.map(l => l + '\n').join('');
      if (opts.o) { sh.m.fs.writeFile(P(sh, opts.o), out, sh.fsopts()); return 0; }
      io.stdout.write(out);
      return 0;
    }
  });

  defcmd({
    name: 'uniq', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { c: 0, d: 0, u: 0, i: 0, D: 0, f: 1, w: 1, '--count': 0, '--repeated': 0, '--unique': 0 });
      let data = rest.length && rest[0] !== '-' ? sh.m.fs.readFile(P(sh, rest[0]), sh.fsopts()) : (io.stdin ? io.stdin.readAll() : '');
      const lines = data.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      const key = (l) => { let k = opts.i ? l.toLowerCase() : l; if (opts.f) k = k.split(/\s+/).slice(parseInt(opts.f, 10)).join(' '); if (opts.w) k = k.slice(0, parseInt(opts.w, 10)); return k; };
      const groups = [];
      for (const l of lines) {
        if (groups.length && key(groups[groups.length - 1].line) === key(l)) groups[groups.length - 1].n++;
        else groups.push({ line: l, n: 1 });
      }
      let out = groups;
      if (opts.d || opts['--repeated']) out = out.filter(g => g.n > 1);
      if (opts.u || opts['--unique']) out = out.filter(g => g.n === 1);
      for (const g of out) {
        if (opts.D) { for (let i = 0; i < g.n; i++) io.stdout.write(g.line + '\n'); continue; }
        io.stdout.write((opts.c || opts['--count'] ? String(g.n).padStart(7) + ' ' : '') + g.line + '\n');
      }
      return 0;
    }
  });

  defcmd({
    name: 'cut', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { d: 1, f: 1, c: 1, b: 1, s: 0, '--delimiter': 1, '--fields': 1, '--characters': 1, '--complement': 0, '--output-delimiter': 1 });
      const delim = opts.d || opts['--delimiter'] || '\t';
      const outDelim = opts['--output-delimiter'] || delim;
      const spec = opts.f || opts['--fields'] || opts.c || opts['--characters'] || opts.b;
      if (!spec) { io.stderr.write('cut: you must specify a list of bytes, characters, or fields\nTry \'cut --help\' for more information.\n'); return 1; }
      const ranges = String(spec).split(',').map(r => {
        if (r.includes('-')) { const [a, b] = r.split('-'); return { a: a === '' ? 1 : +a, b: b === '' ? Infinity : +b }; }
        return { a: +r, b: +r };
      });
      const inRange = (i) => ranges.some(r => i >= r.a && i <= r.b);
      let data = rest.length ? rest.map(f => sh.m.fs.readFile(P(sh, f), sh.fsopts())).join('') : (io.stdin ? io.stdin.readAll() : '');
      const lines = data.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      for (const l of lines) {
        if (opts.c || opts['--characters'] || opts.b) {
          let out = '';
          for (let i = 1; i <= l.length; i++) if (inRange(i)) out += l[i - 1];
          io.stdout.write(out + '\n');
          continue;
        }
        if (!l.includes(delim)) { if (!opts.s) io.stdout.write(l + '\n'); continue; }
        const parts = l.split(delim);
        const out = parts.filter((_, i) => inRange(i + 1));
        io.stdout.write(out.join(outDelim) + '\n');
      }
      return 0;
    }
  });

  defcmd({
    name: 'tr', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { d: 0, s: 0, c: 0, '--delete': 0, '--squeeze-repeats': 0, '--complement': 0 });
      const expand = (s) => {
        let out = '';
        for (let i = 0; i < s.length; i++) {
          if (s[i] === '\\') { out += LX.unescapeC(s.slice(i, i + 2)); i++; continue; }
          if (s[i] === '[' && s[i + 1] === ':') {
            const end = s.indexOf(':]', i);
            const cls = s.slice(i + 2, end);
            const map = {
              alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
              lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
              digit: '0123456789', alnum: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
              space: ' \t\n\r\f\v', punct: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
            };
            out += map[cls] || '';
            i = end + 1;
            continue;
          }
          if (s[i + 1] === '-' && s[i + 2] && s[i + 2] !== ']') {
            for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out += String.fromCharCode(c);
            i += 2;
            continue;
          }
          out += s[i];
        }
        return out;
      };
      const set1 = expand(rest[0] || '');
      const set2 = expand(rest[1] || '');
      let data = io.stdin ? io.stdin.readAll() : '';
      let out = '';
      const del = opts.d || opts['--delete'];
      const comp = opts.c || opts['--complement'];
      for (const ch of data) {
        const idx = set1.indexOf(ch);
        const inSet = comp ? idx === -1 : idx !== -1;
        if (del) { if (!inSet) out += ch; continue; }
        if (inSet) out += comp ? (set2[set2.length - 1] || ch) : (set2[Math.min(idx, set2.length - 1)] || ch);
        else out += ch;
      }
      if (opts.s || opts['--squeeze-repeats']) {
        const squeezeSet = del ? set2 : (set2 || set1);
        let sq = '';
        for (let i = 0; i < out.length; i++) {
          if (i > 0 && out[i] === out[i - 1] && squeezeSet.includes(out[i])) continue;
          sq += out[i];
        }
        out = sq;
      }
      io.stdout.write(out);
      return 0;
    }
  });

  defcmd({
    name: 'tee', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { a: 0, i: 0, '--append': 0 });
      const data = io.stdin ? io.stdin.readAll() : '';
      let status = 0;
      for (const f of rest) {
        try {
          if (opts.a || opts['--append']) sh.m.fs.appendFile(P(sh, f), data, sh.fsopts());
          else sh.m.fs.writeFile(P(sh, f), data, sh.fsopts());
        } catch (e) { io.stderr.write(`tee: ${f}: ${e.message}\n`); status = 1; }
      }
      io.stdout.write(data);
      return status;
    }
  });

  defcmd({
    name: 'nl', run: async ({ sh, io, args }) => {
      const { rest } = getopt(args, { b: 1, n: 1, w: 1, s: 1 });
      const data = rest.length ? sh.m.fs.readFile(P(sh, rest[0]), sh.fsopts()) : io.stdin.readAll();
      const lines = data.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
      let i = 0;
      for (const l of lines) { if (l === '') { io.stdout.write('\n'); continue; } i++; io.stdout.write(String(i).padStart(6) + '\t' + l + '\n'); }
      return 0;
    }
  });

  defcmd({ name: 'rev', run: async ({ sh, io, args }) => {
    const data = args.length ? sh.m.fs.readFile(P(sh, args[0]), sh.fsopts()) : io.stdin.readAll();
    const lines = data.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
    lines.forEach(l => io.stdout.write(l.split('').reverse().join('') + '\n'));
    return 0;
  } });

  defcmd({
    name: 'paste', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { d: 1, s: 0 });
      const d = opts.d || '\t';
      const cols = rest.map(f => {
        const data = f === '-' ? io.stdin.readAll() : sh.m.fs.readFile(P(sh, f), sh.fsopts());
        const l = data.split('\n'); if (l[l.length - 1] === '') l.pop();
        return l;
      });
      if (opts.s) { cols.forEach(c => io.stdout.write(c.join(d) + '\n')); return 0; }
      const max = Math.max(0, ...cols.map(c => c.length));
      for (let i = 0; i < max; i++) io.stdout.write(cols.map(c => c[i] === undefined ? '' : c[i]).join(d) + '\n');
      return 0;
    }
  });

  defcmd({
    name: 'comm', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { '1': 0, '2': 0, '3': 0 });
      const rd = f => { const t = f === '-' ? io.stdin.readAll() : sh.m.fs.readFile(P(sh, f), sh.fsopts()); const l = t.split('\n'); if (l[l.length - 1] === '') l.pop(); return l; };
      const a = rd(rest[0]), b = rd(rest[1]);
      let i = 0, j = 0;
      while (i < a.length || j < b.length) {
        if (i >= a.length) { if (!opts['2']) io.stdout.write((opts['1'] ? '' : '\t') + b[j] + '\n'); j++; continue; }
        if (j >= b.length) { if (!opts['1']) io.stdout.write(a[i] + '\n'); i++; continue; }
        if (a[i] === b[j]) { if (!opts['3']) io.stdout.write((opts['1'] ? '' : '\t') + (opts['2'] ? '' : '\t') + a[i] + '\n'); i++; j++; continue; }
        if (a[i] < b[j]) { if (!opts['1']) io.stdout.write(a[i] + '\n'); i++; }
        else { if (!opts['2']) io.stdout.write((opts['1'] ? '' : '\t') + b[j] + '\n'); j++; }
      }
      return 0;
    }
  });

  /* ============================ informação ============================ */
  defcmd({
    name: 'stat', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { c: 1, f: 0, L: 0, '--format': 1, '--printf': 1, '--file-system': 0 });
      let status = 0;
      if (opts.f || opts['--file-system']) {
        // -f: estatísticas do SISTEMA DE ARQUIVOS, não do arquivo
        for (const f of (rest.length ? rest : ['.'])) {
          const alvo = P(sh, f);
          const mnt = sh.m.fs.mounts
            .filter(m => alvo === m.mount || alvo.startsWith(m.mount === '/' ? '/' : m.mount + '/'))
            .sort((a, b) => b.mount.length - a.mount.length)[0];
          if (!mnt) { io.stderr.write(`stat: cannot read file system information for '${f}': No such file or directory\n`); status = 1; continue; }
          const totalKb = mnt.mount === '/' ? sh.m.diskTotalKb : mnt.sizeKb;
          const usadoKb = mnt.mount === '/' ? sh.m.diskUsedKb : mnt.usedKb;
          const blocos = Math.floor(totalKb / 4), usados = Math.floor(usadoKb / 4);
          const inodes = Math.floor(totalKb / 64);
          io.stdout.write(
            `  File: "${f}"\n` +
            `    ID: ${(mnt.dev || '').replace(/\D/g, '') || '0'}b1c024d5e Namelen: 255     Type: ${mnt.type}\n` +
            `Block size: 4096       Fundamental block size: 4096\n` +
            `Blocks: Total: ${blocos}   Free: ${blocos - usados}   Available: ${blocos - usados - Math.floor(blocos * 0.05)}\n` +
            `Inodes: Total: ${inodes}   Free: ${inodes - Math.floor(usados / 8)}\n`);
        }
        return status;
      }
      for (const f of rest) {
        try {
          const n = opts.L ? sh.m.fs.stat(P(sh, f), sh.fsopts()) : sh.m.fs.lstat(P(sh, f), sh.fsopts());
          const user = (sh.m.userByUid(n.uid) || {}).name || n.uid;
          const group = (sh.m.groupByGid(n.gid) || {}).name || n.gid;
          const fmt = opts.c || opts['--format'] || opts['--printf'];
          if (fmt) {
            io.stdout.write(fmt
              .replace(/%n/g, f).replace(/%s/g, n.size).replace(/%a/g, (n.mode & 0o7777).toString(8))
              .replace(/%A/g, modeToRwx(n.mode, n.type)).replace(/%U/g, user).replace(/%G/g, group)
              .replace(/%u/g, n.uid).replace(/%g/g, n.gid).replace(/%i/g, n.ino).replace(/%h/g, n.nlink)
              .replace(/%F/g, n.type === 'dir' ? 'directory' : n.type === 'link' ? 'symbolic link' : 'regular file')
              .replace(/%y/g, new Date(n.mtime).toISOString().replace('T', ' ').slice(0, 19))
              + (opts['--printf'] ? '' : '\n'));
            continue;
          }
          const typeName = n.type === 'dir' ? 'directory' : n.type === 'link' ? 'symbolic link' : n.type === 'chr' ? 'character special file' : n.type === 'blk' ? 'block special file' : (n.size === 0 ? 'regular empty file' : 'regular file');
          io.stdout.write(
            `  File: ${f}${n.type === 'link' ? ' -> ' + n.target : ''}\n` +
            `  Size: ${String(n.size).padEnd(14)}Blocks: ${String(Math.ceil(n.size / 512)).padEnd(10)} IO Block: 4096   ${typeName}\n` +
            `Device: 252,2\tInode: ${String(n.ino).padEnd(11)}Links: ${n.nlink}\n` +
            `Access: (${(n.mode & 0o7777).toString(8).padStart(4, '0')}/${modeToRwx(n.mode, n.type)})  Uid: (${String(n.uid).padStart(5)}/${String(user).padStart(8)})   Gid: (${String(n.gid).padStart(5)}/${String(group).padStart(8)})\n` +
            `Access: ${fmtFull(n.atime)}\nModify: ${fmtFull(n.mtime)}\nChange: ${fmtFull(n.ctime)}\n Birth: ${fmtFull(n.btime || n.ctime)}\n`);
        } catch (e) { io.stderr.write(`stat: cannot statx '${f}': ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });
  function fmtFull(ms) {
    const d = new Date(ms);
    const p = (x, n = 2) => String(x).padStart(n, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.000000000 -0300`;
  }

  defcmd({
    name: 'file', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { b: 0, i: 0 });
      for (const f of rest) {
        try {
          const n = sh.m.fs.lstat(P(sh, f), sh.fsopts());
          let desc;
          if (n.type === 'dir') desc = 'directory';
          else if (n.type === 'link') desc = `symbolic link to ${n.target}`;
          else if (n.type === 'chr') desc = 'character special';
          else if (n.type === 'blk') desc = 'block special';
          else {
            const c = n.read();
            if (c.startsWith('\x7fELF')) desc = 'ELF 64-bit LSB pie executable, x86-64, dynamically linked';
            else if (c.startsWith('#!/bin/bash') || c.startsWith('#!/usr/bin/env bash')) desc = 'Bourne-Again shell script, ASCII text executable';
            else if (c.startsWith('#!/bin/sh')) desc = 'POSIX shell script, ASCII text executable';
            else if (c.startsWith('#!/usr/bin/env python') || c.startsWith('#!/usr/bin/python')) desc = 'Python script, ASCII text executable';
            else if (/^\s*[{[]/.test(c)) desc = 'JSON text data';
            else if (n.size === 0) desc = 'empty';
            else if (/^GZIPDATA|\x1f\x8b/.test(c)) desc = 'gzip compressed data';
            else if (/^ZIPDATA|PK\x03\x04/.test(c)) desc = 'Zip archive data';
            else if (/^TARDATA/.test(c)) desc = 'POSIX tar archive';
            else if (/[^\x09\x0a\x0d\x20-\x7e -￿]/.test(c.slice(0, 200))) desc = 'data';
            else desc = 'ASCII text';
          }
          io.stdout.write((opts.b ? '' : f + ': ') + desc + '\n');
        } catch (e) { io.stdout.write(`${f}: cannot open '${f}' (No such file or directory)\n`); }
      }
      return 0;
    }
  });

  defcmd({
    name: 'du', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { h: 0, s: 0, a: 0, c: 0, d: 1, x: 0, '--human-readable': 0, '--summarize': 0, '--max-depth': 1, '--all': 0 });
      const human = opts.h || opts['--human-readable'];
      const summarize = opts.s || opts['--summarize'];
      const maxDepth = opts.d !== undefined ? +opts.d : (opts['--max-depth'] !== undefined ? +opts['--max-depth'] : (summarize ? 0 : Infinity));
      const targets = rest.length ? rest : ['.'];
      let grand = 0;
      const show = (blocks, path) => io.stdout.write(`${human ? humanSize(blocks * 1024).padEnd(7) : String(blocks).padEnd(7)}\t${path}\n`);
      for (const t of targets) {
        const base = P(sh, t);
        let node;
        try { node = sh.m.fs.stat(base, sh.fsopts()); }
        catch (e) { io.stderr.write(`du: cannot access '${t}': ${e.message}\n`); continue; }
        const rec = (path, n, depth) => {
          let total = n.type === 'dir' ? 4 : Math.max(4, Math.ceil(n.size / 4096) * 4);
          if (n.type === 'dir') {
            for (const [name, child] of n.children) {
              total += rec(FileSystem.join(path, name), child, depth + 1);
            }
          }
          const alvoDireto = depth === 0;   // "du -sh arquivo" sempre mostra o próprio alvo
          if (depth <= maxDepth && (n.type === 'dir' || alvoDireto || opts.a || opts['--all'])) show(total, path === base ? t : path);
          return total;
        };
        const tot = rec(base, node, 0);
        grand += tot;
      }
      if (opts.c) show(grand, 'total');
      return 0;
    }
  });

  defcmd({
    name: 'df', path: '/usr/bin/df', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { h: 0, T: 0, i: 0, a: 0, '--human-readable': 0, '--type': 1, '--total': 0 });
      const human = opts.h || opts['--human-readable'];
      let mounts = sh.m.fs.mounts.filter(m => opts.a || m.sizeKb > 0);
      if (rest.length) {
        const target = P(sh, rest[0]);
        mounts = [mounts.filter(m => target.startsWith(m.mount)).sort((a, b) => b.mount.length - a.mount.length)[0] || mounts[0]];
      }
      if (opts.i) {
        // -i mostra inodes em vez de blocos
        const linhas = mounts.map(m => {
          const total = Math.floor((m.mount === '/' ? sh.m.diskTotalKb : m.sizeKb) / 64);
          const usados = m.mount === '/' ? 118432 : Math.max(11, Math.floor((m.usedKb || 24) / 4));
          const livres = total - usados;
          const pct = total ? Math.round(usados / total * 100) : 0;
          return [m.dev, String(total), String(usados), String(livres), pct + '%', m.mount];
        });
        const cab = ['Filesystem', 'Inodes', 'IUsed', 'IFree', 'IUse%', 'Mounted on'];
        const todas = [cab, ...linhas];
        const larg = cab.map((_, i) => Math.max(...todas.map(r => String(r[i]).length)));
        for (const r of todas) io.stdout.write(r.map((c, i) => i === 0 || i === r.length - 1 ? String(c).padEnd(larg[i]) : String(c).padStart(larg[i])).join(' ').trimEnd() + '\n');
        return 0;
      }
      const rows = mounts.map(m => {
        const used = m.mount === '/' ? sh.m.diskUsedKb : m.usedKb;
        const size = m.mount === '/' ? sh.m.diskTotalKb : m.sizeKb;
        const avail = Math.max(0, size - used - Math.floor(size * 0.05));
        const pct = size ? Math.round(used / size * 100) : 0;
        const f = (kb) => human ? humanSize(kb * 1024) : String(kb);
        return [m.dev, ...(opts.T ? [m.type] : []), f(size), f(used), f(avail), pct + '%', m.mount];
      });
      const header = ['Filesystem', ...(opts.T ? ['Type'] : []), human ? 'Size' : '1K-blocks', 'Used', human ? 'Avail' : 'Available', 'Use%', 'Mounted on'];
      const all = [header, ...rows];
      const w = header.map((_, i) => Math.max(...all.map(r => String(r[i]).length)));
      for (const r of all) {
        io.stdout.write(r.map((c, i) => i === 0 || i === r.length - 1 ? String(c).padEnd(w[i]) : String(c).padStart(w[i])).join(' ').trimEnd() + '\n');
      }
      return 0;
    }
  });

  /* ============================ diversos ============================ */
  defcmd({ name: 'basename', run: async ({ io, args }) => {
    const { opts, rest } = getopt(args, { s: 1, a: 0, z: 0 });
    let name = FileSystem.basename(rest[0] || '');
    const suffix = opts.s || rest[1];
    if (suffix && name.endsWith(suffix) && name !== suffix) name = name.slice(0, -suffix.length);
    io.stdout.write(name + '\n'); return 0;
  } });
  defcmd({ name: 'dirname', run: async ({ io, args }) => { io.stdout.write(FileSystem.dirname(args[0] || '') + '\n'); return 0; } });
  defcmd({ name: 'realpath', run: async ({ sh, io, args }) => {
    let status = 0;
    for (const a of args.filter(x => !x.startsWith('-'))) {
      try { io.stdout.write(sh.m.fs.pathOf(sh.m.fs.stat(P(sh, a), sh.fsopts())) + '\n'); }
      catch (e) { io.stderr.write(`realpath: ${a}: ${e.message}\n`); status = 1; }
    }
    return status;
  } });
  defcmd({ name: 'readlink', run: async ({ sh, io, args }) => {
    const { opts, rest } = getopt(args, { f: 0, e: 0 });
    for (const a of rest) {
      try {
        const n = sh.m.fs.lstat(P(sh, a), sh.fsopts());
        if (opts.f) { io.stdout.write(sh.m.fs.pathOf(sh.m.fs.stat(P(sh, a), sh.fsopts())) + '\n'); continue; }
        if (n.type !== 'link') return 1;
        io.stdout.write(n.target + '\n');
      } catch (e) { return 1; }
    }
    return 0;
  } });

  defcmd({
    name: 'seq', run: async ({ io, args }) => {
      const { opts, rest } = getopt(args, { s: 1, w: 0, f: 1 });
      let start = 1, step = 1, end;
      if (rest.length === 1) end = +rest[0];
      else if (rest.length === 2) { start = +rest[0]; end = +rest[1]; }
      else { start = +rest[0]; step = +rest[1]; end = +rest[2]; }
      if (isNaN(start) || isNaN(end) || step === 0) { io.stderr.write('seq: invalid argument\n'); return 1; }
      const sep = opts.s !== undefined ? opts.s : '\n';
      const out = [];
      let guard = 0;
      if (step > 0) for (let v = start; v <= end + 1e-9; v += step) { out.push(v); if (++guard > 100000) break; }
      else for (let v = start; v >= end - 1e-9; v += step) { out.push(v); if (++guard > 100000) break; }
      const strs = out.map(v => Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6));
      if (opts.w) { const w = Math.max(...strs.map(s => s.length)); strs.forEach((s, i) => strs[i] = s.padStart(w, '0')); }
      io.stdout.write(strs.join(sep) + (opts.s !== undefined ? '\n' : '\n').replace('\n\n', '\n'));
      return 0;
    }
  });

  defcmd({
    name: 'sleep', run: async ({ io, args, sh }) => {
      let total = 0;
      for (const a of args) {
        const m = /^([\d.]+)([smhd]?)$/.exec(a);
        if (!m) { io.stderr.write(`sleep: invalid time interval '${a}'\n`); return 1; }
        const mult = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2]];
        total += parseFloat(m[1]) * mult;
      }
      const ms = Math.min(total * 1000, 30000);
      const started = Date.now();
      while (Date.now() - started < ms) {
        if (io.term && io.term.aborted) throw new LX.InterruptSignal();
        await new Promise(r => setTimeout(r, Math.min(60, ms - (Date.now() - started))));
      }
      return 0;
    }
  });

  defcmd({
    name: 'date', run: async ({ io, args, sh }) => {
      const { opts, rest } = getopt(args, { u: 0, d: 1, R: 0, s: 1, I: 0, '--date': 1, '--utc': 0, '--iso-8601': 0 });
      let d = new Date();
      if (opts.d || opts['--date']) {
        const spec = opts.d || opts['--date'];
        const rel = /^([+-]?\d+)\s+(second|minute|hour|day|week|month|year)s?( ago)?$/.exec(spec);
        if (rel) {
          const mult = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[rel[2]];
          const n = parseInt(rel[1], 10) * (rel[3] ? -1 : 1);
          d = new Date(Date.now() + n * mult);
        } else if (spec === 'yesterday') d = new Date(Date.now() - 864e5);
        else if (spec === 'tomorrow') d = new Date(Date.now() + 864e5);
        else if (!isNaN(Date.parse(spec))) d = new Date(spec);
      }
      const fmt = rest.find(r => r.startsWith('+'));
      const p = (x, n = 2) => String(x).padStart(n, '0');
      if (fmt) {
        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const DAYSF = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const MONF = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const out = fmt.slice(1).replace(/%([a-zA-Z%])/g, (m, c) => {
          switch (c) {
            case 'Y': return String(d.getFullYear());
            case 'y': return p(d.getFullYear() % 100);
            case 'm': return p(d.getMonth() + 1);
            case 'd': return p(d.getDate());
            case 'e': return String(d.getDate()).padStart(2, ' ');
            case 'H': return p(d.getHours());
            case 'I': return p(((d.getHours() + 11) % 12) + 1);
            case 'M': return p(d.getMinutes());
            case 'S': return p(d.getSeconds());
            case 'N': return '000000000';
            case 's': return String(Math.floor(d.getTime() / 1000));
            case 'a': return DAYS[d.getDay()];
            case 'A': return DAYSF[d.getDay()];
            case 'b': case 'h': return MONTHS_EN[d.getMonth()];
            case 'B': return MONF[d.getMonth()];
            case 'j': return String(Math.ceil((d - new Date(d.getFullYear(), 0, 0)) / 864e5)).padStart(3, '0');
            case 'F': return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
            case 'T': return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
            case 'D': return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${p(d.getFullYear() % 100)}`;
            case 'Z': return 'UTC-3';
            case 'z': return '-0300';
            case 'u': return String(d.getDay() === 0 ? 7 : d.getDay());
            case 'w': return String(d.getDay());
            case '%': return '%';
            default: return m;
          }
        });
        io.stdout.write(out + '\n');
        return 0;
      }
      if (opts.R) { io.stdout.write(d.toUTCString().replace('GMT', '-0300') + '\n'); return 0; }
      if (opts.I || opts['--iso-8601']) { io.stdout.write(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}\n`); return 0; }
      const DAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      io.stdout.write(`${DAYS[d.getDay()]} ${p(d.getDate())} ${MONTHS[d.getMonth()].toLowerCase()} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} -03\n`);
      return 0;
    }
  });

  defcmd({ name: 'yes', run: async ({ io, args }) => {
    const text = args.length ? args.join(' ') : 'y';
    for (let i = 0; i < 5000; i++) io.stdout.write(text + '\n');
    return 0;
  } });

  defcmd({
    name: 'shuf', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { n: 1, e: 0, i: 1 });
      let items;
      if (opts.i) { const [a, b] = String(opts.i).split('-').map(Number); items = []; for (let v = a; v <= b; v++) items.push(String(v)); }
      else if (opts.e) items = rest;
      else { const data = rest.length ? sh.m.fs.readFile(P(sh, rest[0]), sh.fsopts()) : io.stdin.readAll(); items = data.split('\n'); if (items[items.length - 1] === '') items.pop(); }
      for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
      if (opts.n) items = items.slice(0, +opts.n);
      io.stdout.write(items.map(i => i + '\n').join(''));
      return 0;
    }
  });

  defcmd({
    name: 'split', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 1, b: 1, d: 0, a: 1 });
      const data = rest[0] ? sh.m.fs.readFile(P(sh, rest[0]), sh.fsopts()) : io.stdin.readAll();
      const prefix = rest[1] || 'x';
      const lines = data.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
      const per = opts.l ? +opts.l : 1000;
      const suffixes = 'abcdefghijklmnopqrstuvwxyz';
      let idx = 0;
      for (let i = 0; i < lines.length; i += per) {
        const chunk = lines.slice(i, i + per).map(l => l + '\n').join('');
        const suf = opts.d ? String(idx).padStart(2, '0') : suffixes[Math.floor(idx / 26)] + suffixes[idx % 26];
        sh.m.fs.writeFile(P(sh, prefix + suf), chunk, sh.fsopts());
        idx++;
      }
      return 0;
    }
  });

  defcmd({
    name: 'mktemp', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { d: 0, p: 1, t: 0, '--directory': 0, '--suffix': 1 });
      const rand = Math.random().toString(36).slice(2, 12).toUpperCase();
      const tmpl = rest[0] || 'tmp.XXXXXXXXXX';
      const base = tmpl.includes('/') ? tmpl : ((opts.p || '/tmp') + '/' + tmpl);
      const path = base.replace(/X{3,}/, rand.slice(0, (base.match(/X+/) || ['XXXXXXXXXX'])[0].length));
      try {
        if (opts.d || opts['--directory']) { const n = sh.m.fs.mkdir(path, sh.fsopts()); n.mode = 0o700; }
        else { const n = sh.m.fs.create(path, '', sh.fsopts()); n.mode = 0o600; }
        io.stdout.write(path + '\n');
        return 0;
      } catch (e) { io.stderr.write(`mktemp: failed to create file: ${e.message}\n`); return 1; }
    }
  });

  defcmd({
    name: 'truncate', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { s: 1, '--size': 1 });
      const spec = opts.s || opts['--size'] || '0';
      for (const f of rest) {
        const p = P(sh, f);
        if (!sh.m.fs.exists(p, sh.fsopts())) sh.m.fs.create(p, '', sh.fsopts());
        const n = sh.m.fs.stat(p, sh.fsopts());
        const m = /^([+-]?)(\d+)([KMG]?)$/.exec(spec);
        if (!m) { io.stderr.write(`truncate: invalid number: '${spec}'\n`); return 1; }
        const mult = { '': 1, K: 1024, M: 1048576, G: 1073741824 }[m[3]];
        const size = +m[2] * mult;
        const cur = n.read();
        if (m[1] === '+') n.write(cur + '\0'.repeat(size));
        else if (m[1] === '-') n.write(cur.slice(0, Math.max(0, cur.length - size)));
        else n.write(cur.length > size ? cur.slice(0, size) : cur + '\0'.repeat(size - cur.length));
      }
      return 0;
    }
  });

  defcmd({ name: 'sync', run: async () => 0 });
  defcmd({ name: 'clear', run: async ({ io }) => { if (io.term && io.term.clear) io.term.clear(); else io.stdout.write('\x1b[2J\x1b[H'); return 0; } });
  defcmd({ name: 'reset', run: async ({ io }) => { if (io.term && io.term.clear) io.term.clear(); return 0; } });
  defcmd({ name: 'echo', path: '/usr/bin/echo', run: async ({ io, args }) => { io.stdout.write(args.join(' ') + '\n'); return 0; } });
  defcmd({ name: 'sleep-forever', path: '/usr/bin/sleep-forever', run: async () => 0 });

  defcmd({
    name: 'install', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { m: 1, o: 1, g: 1, d: 0, D: 0, v: 0 });
      if (opts.d) { for (const d of rest) sh.m.fs.mkdirp(P(sh, d), sh.fsopts()); return 0; }
      const dst = rest[rest.length - 1];
      for (const s of rest.slice(0, -1)) {
        sh.m.fs.copy(P(sh, s), P(sh, dst), sh.fsopts());
        if (opts.m) { const n = sh.m.fs.stat(FileSystem.join(P(sh, dst), FileSystem.basename(s)), sh.fsopts()); n.mode = parseInt(opts.m, 8); }
      }
      return 0;
    }
  });

  defcmd({
    name: ['md5sum', 'sha256sum', 'sha1sum'], path: '/usr/bin/',
    run: async ({ sh, io, args, name }) => {
      const hash = (s) => {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0; i < s.length; i++) {
          const ch = s.charCodeAt(i);
          h1 = Math.imul(h1 ^ ch, 2654435761);
          h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        let out = '';
        let a = (h2 >>> 0), b = (h1 >>> 0);
        const len = name === 'md5sum' ? 32 : name === 'sha1sum' ? 40 : 64;
        while (out.length < len) {
          out += ((a ^ b) >>> 0).toString(16).padStart(8, '0');
          a = Math.imul(a ^ 0x9e3779b9, 2654435761) >>> 0;
          b = Math.imul(b + 0x7f4a7c15, 1597334677) >>> 0;
        }
        return out.slice(0, len);
      };
      const { opts, rest } = getopt(args, { c: 0, '--check': 0, quiet: 0, '--quiet': 0, '--status': 0 });
      const conferir = opts.c || opts['--check'];
      const calado = opts['--quiet'] || opts['--status'];

      /* -c relê o arquivo de somas e confere cada linha: é isso que
         transforma "tenho um hash" em "o arquivo está íntegro". */
      if (conferir) {
        let status = 0, falhas = 0, lidos = 0;
        for (const lista of (rest.length ? rest : ['-'])) {
          let conteudo;
          try { conteudo = lista === '-' ? io.stdin.readAll() : sh.m.fs.readFile(P(sh, lista), sh.fsopts()); }
          catch (e) { io.stderr.write(`${name}: ${lista}: No such file or directory\n`); return 1; }
          for (const linha of conteudo.split('\n')) {
            if (!linha.trim()) continue;
            const mm = /^([0-9a-fA-F]+)\s+[* ]?(.+)$/.exec(linha.trim());
            if (!mm) { io.stderr.write(`${name}: ${lista}: improperly formatted checksum line\n`); status = 1; continue; }
            lidos++;
            const [, soma, alvo] = mm;
            let dados;
            try { dados = sh.m.fs.readFile(P(sh, alvo), sh.fsopts()); }
            catch (e) {
              if (!opts['--status']) io.stdout.write(`${alvo}: FAILED open or read\n`);
              falhas++; status = 1; continue;
            }
            const bate = hash(dados).toLowerCase() === soma.toLowerCase();
            if (!bate) falhas++;
            if (!calado || !bate) {
              if (!opts['--status']) io.stdout.write(`${alvo}: ${bate ? 'OK' : 'FAILED'}\n`);
            }
            if (!bate) status = 1;
          }
        }
        if (falhas && !opts['--status']) {
          io.stderr.write(`${name}: WARNING: ${falhas} computed checksum${falhas > 1 ? 's' : ''} did NOT match\n`);
        }
        if (!lidos) status = 1;
        return status;
      }

      if (!rest.length) { io.stdout.write(hash(io.stdin.readAll()) + '  -\n'); return 0; }
      let status = 0;
      for (const f of rest) {
        try { io.stdout.write(hash(sh.m.fs.readFile(P(sh, f), sh.fsopts())) + '  ' + f + '\n'); }
        catch (e) { io.stderr.write(`${name}: ${f}: ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  defcmd({ name: 'expand', run: async ({ sh, io, args }) => {
    const data = args.filter(a => !a.startsWith('-')).length ? sh.m.fs.readFile(P(sh, args.filter(a => !a.startsWith('-'))[0]), sh.fsopts()) : io.stdin.readAll();
    io.stdout.write(data.replace(/\t/g, '        '));
    return 0;
  } });
  defcmd({ name: 'fold', run: async ({ sh, io, args }) => {
    const { opts, rest } = getopt(args, { w: 1, s: 0 });
    const w = +(opts.w || 80);
    const data = rest.length ? sh.m.fs.readFile(P(sh, rest[0]), sh.fsopts()) : io.stdin.readAll();
    for (const line of data.split('\n')) {
      if (line === '') { io.stdout.write('\n'); continue; }
      for (let i = 0; i < line.length; i += w) io.stdout.write(line.slice(i, i + w) + '\n');
    }
    return 0;
  } });
})();

/* ===================== bash / sh como comandos externos ===================== */
(function () {
  const { FileSystem, defcmd, getopt } = LX;
  defcmd({
    name: ['bash', 'sh', 'dash'], path: '/usr/bin/', pkg: 'bash',
    run: async ({ sh, io, args, name, ex }) => {
      const { opts, rest } = getopt(args, { c: 1, x: 0, e: 0, n: 0, l: 0, i: 0, '--version': 0, '--help': 0 });
      if (opts['--version']) {
        io.stdout.write(`GNU bash, version 5.3.0(1)-release (x86_64-pc-linux-gnu)\nCopyright (C) 2025 Free Software Foundation, Inc.\nLicense GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>\n\nThis is free software; you are free to change and redistribute it.\n`);
        return 0;
      }
      // um shell novo é outro processo: herda só as variáveis exportadas
      const sub = sh.clone({ soExportadas: true });
      sub.setVar('SHLVL', String(+(sh.getVar('SHLVL') || 1) + 1), true);
      if (opts.x) sub.opts.x = true;
      if (opts.e) sub.opts.e = true;
      if (opts.c) {
        sub.scriptName = name;
        sub.positional = rest.slice(1);
        if (rest[0]) sub.scriptName = rest[0];
        const sx = new LX.Executor(sub, io);
        let st = 0;
        try { st = await sx.run(opts.c); }
        catch (e) {
          if (e && e.isExit) st = e.code;
          else if (e && e.isParseError) { io.stderr.write(`${name}: -c: line 1: ${e.message}\n`); return 2; }
          else throw e;
        }
        const t = await sx.dispararTrapExit(io, st);
        return t === null ? st : t;
      }
      if (!rest.length) { io.stderr.write(`${name}: shell interativo aninhado não é suportado aqui. Use "bash script.sh" ou "bash -c 'comando'".\n`); return 1; }
      const path = FileSystem.normalize(rest[0], sh.cwd);
      let content;
      try { content = sh.m.fs.readFile(path, sh.fsopts()); }
      catch (e) { io.stderr.write(`${name}: ${rest[0]}: ${e.code === 'ENOENT' ? 'No such file or directory' : e.message}\n`); return 127; }
      if (opts.n) { try { LX.parse(content); return 0; } catch (e) { io.stderr.write(`${name}: ${rest[0]}: line ?: ${e.message}\n`); return 2; } }
      sub.positional = rest.slice(1);
      sub.scriptName = rest[0];
      sub.setVar('BASH_SOURCE', path);
      const sx = new LX.Executor(sub, io);
      let st = 0;
      try { st = await sx.run(content); }
      catch (e) {
        if (e && e.isExit) st = e.code;
        else if (e && e.isParseError) { io.stderr.write(`${rest[0]}: line ?: ${e.message}\n${name}: ${rest[0]}: cannot execute\n`); return 2; }
        else if (e && e.isLimit) { io.stderr.write(`\n${rest[0]}: ${e.message}\n`); st = 1; }
        else { await sx.dispararTrapExit(io, 1); throw e; }
      }
      const t = await sx.dispararTrapExit(io, st);
      return t === null ? st : t;
    }
  });

  defcmd({
    name: 'shellcheck', pkg: 'shellcheck',
    run: async ({ sh, io, args }) => {
      const f = args.filter(a => !a.startsWith('-'))[0];
      if (!f) { io.stderr.write('shellcheck: informe um arquivo\n'); return 1; }
      let src;
      try { src = sh.m.fs.readFile(FileSystem.normalize(f, sh.cwd), sh.fsopts()); }
      catch (e) { io.stderr.write(`shellcheck: ${f}: ${e.message}\n`); return 1; }
      const lines = src.split('\n');
      const issues = [];
      lines.forEach((l, i) => {
        if (/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/.test(l) && /(?:^|[^"'])\$\{?[A-Za-z_][A-Za-z0-9_]*\}?(?![^"]*")/.test(l) && /\b(rm|cp|mv|cd|cat|test|\[)\b/.test(l) && !/"/.test(l))
          issues.push({ line: i + 1, code: 'SC2086', msg: 'Double quote to prevent globbing and word splitting.', text: l });
        if (/^\s*(if|while)\s+\[\s/.test(l) && !/\[\[/.test(l) && /==/.test(l))
          issues.push({ line: i + 1, code: 'SC2039', msg: 'In POSIX sh, == in place of = is undefined. Use [ x = y ] or [[ x == y ]].', text: l });
        if (/`[^`]+`/.test(l))
          issues.push({ line: i + 1, code: 'SC2006', msg: 'Use $(...) notation instead of legacy backticks `...`.', text: l });
        if (i === 0 && !/^#!/.test(l))
          issues.push({ line: 1, code: 'SC2148', msg: 'Tips depend on target shell and yours is unknown. Add a shebang (#!/bin/bash).', text: l });
      });
      if (!issues.length) { return 0; }
      for (const is of issues) {
        io.stdout.write(`\nIn ${f} line ${is.line}:\n${is.text}\n${' '.repeat(Math.max(0, 0))}^-- ${is.code}: ${is.msg}\n`);
      }
      io.stdout.write(`\nFor more information:\n  https://www.shellcheck.net/wiki/${issues[0].code}\n`);
      return 1;
    }
  });
})();
