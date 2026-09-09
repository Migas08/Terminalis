/* =========================================================================
   TERMINALIS — permissões, usuários, processos, systemd, pacotes, arquivos
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, SysError, defcmd, getopt, C, modeToRwx, humanSize } = LX;
  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }

  /* ============================== chmod ============================== */
  function applySymbolic(mode, spec, isDir) {
    for (const clause of spec.split(',')) {
      const m = /^([ugoa]*)([+\-=])([rwxXstugo]*)$/.exec(clause.trim());
      if (!m) { const e = new Error(`invalid mode: ‘${spec}’`); e.badMode = true; throw e; }
      let [, who, op, perms] = m;
      if (!who) who = 'a';
      let bits = 0;
      let special = 0;
      for (const c of perms) {
        if (c === 'r') bits |= 4;
        else if (c === 'w') bits |= 2;
        else if (c === 'x') bits |= 1;
        else if (c === 'X') { if (isDir || (mode & 0o111)) bits |= 1; }
        else if (c === 's') special |= (who.includes('u') || who.includes('a') ? 0o4000 : 0) | (who.includes('g') || who.includes('a') ? 0o2000 : 0);
        else if (c === 't') special |= 0o1000;
        else if (c === 'u') bits |= (mode >> 6) & 7;
        else if (c === 'g') bits |= (mode >> 3) & 7;
        else if (c === 'o') bits |= mode & 7;
      }
      const targets = [];
      if (who.includes('u') || who.includes('a')) targets.push(6);
      if (who.includes('g') || who.includes('a')) targets.push(3);
      if (who.includes('o') || who.includes('a')) targets.push(0);
      for (const shift of targets) {
        if (op === '+') mode |= bits << shift;
        else if (op === '-') mode &= ~(bits << shift);
        else { mode &= ~(7 << shift); mode |= bits << shift; }
      }
      if (op === '+') mode |= special;
      else if (op === '-') mode &= ~special;
      else if (op === '=' && perms.includes('s')) mode |= special;
    }
    return mode;
  }
  LX.applySymbolic = applySymbolic;

  defcmd({
    name: 'chmod', run: async ({ sh, io, args }) => {
      // GNU chmod aceita modos simbólicos que começam com '-' (ex.: chmod -x arquivo)
      if (args.length && /^[-+=][ugoarwxXst]*$/.test(args[0]) && args[0] !== '-R' && args[0] !== '-v' && args[0] !== '-c' && args[0] !== '-f') {
        args = ['--'].concat(args);
        const spec0 = args[1];
        const targets = args.slice(2);
        let st = 0;
        for (const f of targets) {
          try {
            const node = sh.m.fs.lstat(P(sh, f), sh.fsopts());
            if (sh.uid !== 0 && node.uid !== sh.uid) { io.stderr.write(`chmod: changing permissions of '${f}': Operation not permitted\n`); st = 1; continue; }
            node.mode = applySymbolic(node.mode, spec0, node.type === 'dir');
          } catch (e) { io.stderr.write(`chmod: cannot access '${f}': ${e.message}\n`); st = 1; }
        }
        return st;
      }
      const { opts, rest } = getopt(args, { R: 0, v: 0, c: 0, f: 0, '--recursive': 0, '--verbose': 0, '--reference': 1, '--help': 0 });
      if (opts['--help']) { io.stdout.write(HELP_CHMOD); return 0; }
      if (rest.length < 2 && !opts['--reference']) { io.stderr.write('chmod: missing operand\nTry \'chmod --help\' for more information.\n'); return 1; }
      const spec = opts['--reference'] ? null : rest.shift();
      let status = 0;
      const apply = (path) => {
        const node = sh.m.fs.lstat(path, sh.fsopts());
        if (sh.uid !== 0 && node.uid !== sh.uid) { io.stderr.write(`chmod: changing permissions of '${path}': Operation not permitted\n`); status = 1; return; }
        const old = node.mode;
        if (opts['--reference']) node.mode = sh.m.fs.stat(P(sh, opts['--reference']), sh.fsopts()).mode;
        else if (/^[0-7]{1,4}$/.test(spec)) node.mode = parseInt(spec, 8);
        else node.mode = applySymbolic(node.mode, spec, node.type === 'dir');
        node.ctime = Date.now();
        if (opts.v || opts['--verbose'] || (opts.c && old !== node.mode))
          io.stdout.write(`mode of '${path}' ${old === node.mode ? 'retained as' : 'changed from'} ${(old & 0o7777).toString(8).padStart(4, '0')} (${modeToRwx(old, node.type).slice(1)})${old === node.mode ? '' : ' to ' + (node.mode & 0o7777).toString(8).padStart(4, '0') + ' (' + modeToRwx(node.mode, node.type).slice(1) + ')'}\n`);
      };
      for (const f of rest) {
        try {
          const path = P(sh, f);
          if (opts.R || opts['--recursive']) sh.m.fs.walk(path, (p) => { try { apply(p); } catch (e) { } }, sh.fsopts());
          else apply(path);
        } catch (e) {
          if (e.badMode) { io.stderr.write(`chmod: ${e.message}\n`); return 1; }
          if (!opts.f) { io.stderr.write(`chmod: cannot access '${f}': ${e.message}\n`); status = 1; }
        }
      }
      return status;
    }
  });
  const HELP_CHMOD = `Uso: chmod [OPÇÃO]... MODO[,MODO]... ARQUIVO...
  ou: chmod [OPÇÃO]... MODO-OCTAL ARQUIVO...

Modo simbólico:  [ugoa][+-=][rwxXst]
  u = dono (user)   g = grupo   o = outros   a = todos
  + adiciona   - remove   = define exatamente
  r = leitura (4)   w = escrita (2)   x = execução (1)
  s = SUID/SGID     t = sticky bit    X = x só se for diretório ou já executável

Modo octal: três dígitos (dono, grupo, outros), somando r=4 w=2 x=1
  644 = rw-r--r--     755 = rwxr-xr-x     600 = rw-------

  -R, --recursive   aplica recursivamente em diretórios
  -v, --verbose     mostra cada alteração
`;

  defcmd({
    name: 'chown', path: '/usr/bin/chown', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { R: 0, v: 0, '--recursive': 0, '--verbose': 0, '--from': 1 });
      if (rest.length < 2) { io.stderr.write('chown: missing operand\n'); return 1; }
      const spec = rest.shift();
      const [uname, gname] = spec.split(':');
      let uid = null, gid = null;
      if (uname) {
        const u = sh.m.userByName(uname) || (/^\d+$/.test(uname) ? { uid: +uname } : null);
        if (!u) { io.stderr.write(`chown: invalid user: '${spec}'\n`); return 1; }
        uid = u.uid;
      }
      if (gname !== undefined && gname !== '') {
        const g = sh.m.groupByName(gname) || (/^\d+$/.test(gname) ? { gid: +gname } : null);
        if (!g) { io.stderr.write(`chown: invalid group: '${spec}'\n`); return 1; }
        gid = g.gid;
      } else if (gname === '' && uid !== null) {
        const u = sh.m.userByName(uname); if (u) gid = u.gid;
      }
      /* Dentro de um container, ser root não basta: é preciso ter a
         capability CAP_CHOWN. `--cap-drop ALL` a remove. */
      const semCap = sh.m.capacidades && !sh.m.capacidades.has('CHOWN');
      if (sh.uid !== 0 || semCap) { io.stderr.write(`chown: changing ownership of '${rest[0]}': Operation not permitted\n`); return 1; }
      let status = 0;
      const apply = (path) => {
        const n = sh.m.fs.lstat(path, sh.fsopts());
        if (uid !== null) n.uid = uid;
        if (gid !== null) n.gid = gid;
        n.ctime = Date.now();
        if (opts.v || opts['--verbose']) io.stdout.write(`changed ownership of '${path}'\n`);
      };
      for (const f of rest) {
        try {
          const path = P(sh, f);
          if (opts.R || opts['--recursive']) sh.m.fs.walk(path, apply, sh.fsopts());
          else apply(path);
        } catch (e) { io.stderr.write(`chown: cannot access '${f}': ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  defcmd({
    name: 'chgrp', path: '/usr/bin/chgrp', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { R: 0, v: 0, '--recursive': 0 });
      if (rest.length < 2) { io.stderr.write('chgrp: missing operand\n'); return 1; }
      const gname = rest.shift();
      const g = sh.m.groupByName(gname) || (/^\d+$/.test(gname) ? { gid: +gname } : null);
      if (!g) { io.stderr.write(`chgrp: invalid group: '${gname}'\n`); return 1; }
      let status = 0;
      for (const f of rest) {
        try {
          const path = P(sh, f);
          const apply = (p) => {
            const n = sh.m.fs.lstat(p, sh.fsopts());
            if (sh.uid !== 0 && n.uid !== sh.uid) throw new SysError('EPERM');
            n.gid = g.gid;
          };
          if (opts.R || opts['--recursive']) sh.m.fs.walk(path, apply, sh.fsopts());
          else apply(path);
        } catch (e) { io.stderr.write(`chgrp: changing group of '${f}': ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  /* ====================== bases do sistema: getent ====================== */
  defcmd({
    name: 'getent', path: '/usr/bin/getent', run: async ({ sh, io, args }) => {
      const base = args[0];
      const chaves = args.slice(1);
      const ctx = sh.m.ctxRoot();
      const leia = (p) => { try { return sh.m.fs.readFile(p, { ctx }).split('\n').filter(Boolean); } catch (e) { return []; } };
      let linhas;
      switch (base) {
        case 'passwd': linhas = leia('/etc/passwd'); break;
        case 'group': linhas = leia('/etc/group'); break;
        case 'shadow':
          if (sh.uid !== 0) return 2;
          linhas = leia('/etc/shadow'); break;
        case 'hosts':
          linhas = leia('/etc/hosts').map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
          /* O getent percorre a pilha do nsswitch: primeiro `files`
             (/etc/hosts), depois `dns`. É por isso que ele é melhor que o
             `dig` para diagnosticar — vê o mesmo que os programas veem. */
          if (chaves.length) {
            for (const k of chaves) {
              const jaTem = linhas.some(l => l.split(/\s+/).slice(1).includes(k));
              if (jaTem) continue;
              let ip = null;
              try { ip = sh.m.resolve(k); } catch (e) { ip = null; }
              if (ip) linhas.push(`${ip} ${k}`);
            }
          }
          break;
        case 'services':
          linhas = ['ssh 22/tcp', 'http 80/tcp', 'https 443/tcp', 'postgresql 5432/tcp', 'mysql 3306/tcp']; break;
        case undefined:
          io.stderr.write('Usage: getent [OPTION...] database [key ...]\n'); return 1;
        default:
          io.stderr.write(`getent: Unknown database: ${base}\n`); return 2;
      }
      if (!chaves.length) { io.stdout.write(linhas.join('\n') + (linhas.length ? '\n' : '')); return 0; }
      let achou = false;
      for (const k of chaves) {
        const campos = (l) => l.split(base === 'hosts' || base === 'services' ? /\s+/ : ':');
        const m = linhas.filter(l => {
          const c = campos(l);
          if (base === 'hosts') return c.slice(1).includes(k) || c[0] === k;
          if (base === 'services') return c[0] === k;
          return c[0] === k || c[2] === k;   // nome, uid ou gid
        });
        if (m.length) { achou = true; io.stdout.write(m.join('\n') + '\n'); }
      }
      return achou ? 0 : 2;
    }
  });

  /* ====================== validade de senha: chage ====================== */
  function shadowLinhas(sh) {
    const ctx = sh.m.ctxRoot();
    try { return sh.m.fs.readFile('/etc/shadow', { ctx }).split('\n'); } catch (e) { return []; }
  }
  function gravaShadow(sh, linhas) {
    sh.m.fs.writeFile('/etc/shadow', linhas.join('\n'), { ctx: sh.m.ctxRoot() });
  }
  const diaParaData = (d) => {
    if (d === '' || d === undefined || d === null) return 'never';
    const t = new Date(+d * 86400000);
    return t.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  };
  defcmd({
    name: 'chage', path: '/usr/bin/chage', needsRoot: true, run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, m: 1, M: 1, W: 1, I: 1, E: 1, d: 1, '--list': 0 });
      const name = rest[0];
      if (!name) { io.stderr.write('Usage: chage [options] LOGIN\n'); return 2; }
      if (!sh.m.userByName(name)) { io.stderr.write(`chage: user '${name}' does not exist in /etc/passwd\n`); return 1; }
      const lista = opts.l || opts['--list'];
      if (!lista && sh.uid !== 0) { io.stderr.write('chage: Permission denied.\n'); return 1; }
      if (lista && sh.uid !== 0 && sh.user !== name) { io.stderr.write('chage: Permission denied.\n'); return 1; }
      const linhas = shadowLinhas(sh);
      const idx = linhas.findIndex(l => l.startsWith(name + ':'));
      if (idx < 0) { io.stderr.write(`chage: user '${name}' does not exist in /etc/shadow\n`); return 1; }
      const c = linhas[idx].split(':');
      while (c.length < 9) c.push('');
      if (lista) {
        io.stdout.write(
          `Last password change\t\t\t\t\t: ${c[2] === '0' ? 'password must be changed' : diaParaData(c[2])}\n` +
          `Password expires\t\t\t\t\t: ${c[4] === '' || c[4] === '99999' ? 'never' : diaParaData(+c[2] + +c[4])}\n` +
          `Password inactive\t\t\t\t\t: ${c[6] === '' ? 'never' : diaParaData(+c[2] + +c[4] + +c[6])}\n` +
          `Account expires\t\t\t\t\t\t: ${diaParaData(c[7])}\n` +
          `Minimum number of days between password change\t\t: ${c[3] || 0}\n` +
          `Maximum number of days between password change\t\t: ${c[4] || 99999}\n` +
          `Number of days of warning before password expires\t: ${c[5] || 7}\n`);
        return 0;
      }
      if (opts.d !== undefined) c[2] = /^\d+$/.test(opts.d) ? opts.d : String(Math.floor(Date.parse(opts.d) / 86400000));
      if (opts.m !== undefined) c[3] = String(+opts.m);
      if (opts.M !== undefined) c[4] = String(+opts.M);
      if (opts.W !== undefined) c[5] = String(+opts.W);
      if (opts.I !== undefined) c[6] = String(+opts.I);
      if (opts.E !== undefined) c[7] = /^\d+$/.test(opts.E) ? opts.E : (opts.E === '-1' ? '' : String(Math.floor(Date.parse(opts.E) / 86400000)));
      linhas[idx] = c.join(':');
      gravaShadow(sh, linhas);
      return 0;
    }
  });

  /* ====================== newgrp e lastlog ====================== */
  defcmd({
    name: 'newgrp', path: '/usr/bin/newgrp', suid: true, run: async ({ sh, io, args }) => {
      const nome = args[0];
      if (!nome) { const g = sh.m.groupByGid(sh.m.userByName(sh.user) ? sh.m.userByName(sh.user).gid : sh.gid); if (g) sh.gid = g.gid; return 0; }
      const g = sh.m.groupByName(nome);
      if (!g) { io.stderr.write(`newgrp: group '${nome}' does not exist\n`); return 1; }
      const meus = sh.m.groupsOfUser(sh.user).map(x => x.gid);
      if (sh.uid !== 0 && !meus.includes(g.gid)) { io.stderr.write('newgrp: Permission denied\n'); return 1; }
      sh.gid = g.gid;
      io.stdout.write(`Grupo primário desta sessão agora é '${g.name}' (gid ${g.gid}).\n`);
      return 0;
    }
  });
  defcmd({
    name: 'lastlog', path: '/usr/bin/lastlog', run: async ({ sh, io, args }) => {
      const { opts } = getopt(args, { u: 1, t: 1 });
      const users = sh.m.users().filter(u => !opts.u || u.name === opts.u);
      io.stdout.write('Username         Port     From             Latest\n');
      for (const u of users) {
        const logou = u.uid === 0 || u.uid >= 1000;
        const quando = logou ? new Date(sh.m.bootTime).toString().slice(0, 24) + ' +0000' : '**Never logged in**';
        io.stdout.write(`${u.name.padEnd(16)} ${(logou ? 'pts/0' : '').padEnd(8)} ${(logou ? '10.0.2.15' : '').padEnd(16)} ${quando}\n`);
      }
      return 0;
    }
  });

  /* ============================== ACLs ============================== */
  const rwx = (b) => ((b & 4) ? 'r' : '-') + ((b & 2) ? 'w' : '-') + ((b & 1) ? 'x' : '-');
  const parseBits = (s) => {
    if (/^[0-7]$/.test(s)) return +s;
    let b = 0;
    for (const c of s) { if (c === 'r') b |= 4; else if (c === 'w') b |= 2; else if (c === 'x') b |= 1; else if (c !== '-') return null; }
    return b;
  };
  function aclMask(node) {
    // máscara = união da classe de grupo; fica gravada nos bits de grupo do mode
    let m = node.aclGroupObj != null ? node.aclGroupObj : ((node.mode >> 3) & 7);
    for (const e of (node.acl || [])) if (e.tag === 'g' || e.tag === 'u') m |= e.bits;
    return m;
  }
  defcmd({
    name: 'getfacl', path: '/usr/bin/getfacl', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { R: 0, c: 0, '--omit-header': 0, '--recursive': 0 });
      if (!rest.length) { io.stderr.write('getfacl: No filename given\n'); return 1; }
      let status = 0;
      for (const f of rest) {
        let node, path;
        try { path = P(sh, f); node = sh.m.fs.lstat(path, sh.fsopts()); }
        catch (e) { io.stderr.write(`getfacl: ${f}: ${e.message}\n`); status = 1; continue; }
        const rel = path.replace(/^\//, '');
        const dono = (sh.m.userByUid(node.uid) || {}).name || node.uid;
        const grupo = (sh.m.groupByGid(node.gid) || {}).name || node.gid;
        if (!opts.c && !opts['--omit-header']) io.stdout.write(`# file: ${rel}\n# owner: ${dono}\n# group: ${grupo}\n`);
        if (node.mode & 0o1000) io.stdout.write('# flags: --t\n');
        const temAcl = LX.temACL(node);
        io.stdout.write(`user::${rwx((node.mode >> 6) & 7)}\n`);
        for (const e of (node.acl || [])) if (e.tag === 'u') io.stdout.write(`user:${(sh.m.userByUid(e.id) || {}).name || e.id}:${rwx(e.bits)}\n`);
        io.stdout.write(`group::${rwx(temAcl && node.aclGroupObj != null ? node.aclGroupObj : (node.mode >> 3) & 7)}\n`);
        for (const e of (node.acl || [])) if (e.tag === 'g') io.stdout.write(`group:${(sh.m.groupByGid(e.id) || {}).name || e.id}:${rwx(e.bits)}\n`);
        if (temAcl) io.stdout.write(`mask::${rwx((node.mode >> 3) & 7)}\n`);
        io.stdout.write(`other::${rwx(node.mode & 7)}\n\n`);
      }
      return status;
    }
  });
  defcmd({
    name: 'setfacl', path: '/usr/bin/setfacl', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { m: 1, x: 1, b: 0, R: 0, d: 0, '--modify': 1, '--remove': 1, '--remove-all': 0, '--recursive': 0 });
      const spec = opts.m || opts['--modify'] || opts.x || opts['--remove'];
      const remover = !!(opts.x || opts['--remove']);
      const limpar = !!(opts.b || opts['--remove-all']);
      if (!rest.length) { io.stderr.write('setfacl: No filename given\n'); return 1; }
      if (!spec && !limpar) { io.stderr.write('setfacl: Option -m, -x ou -b é obrigatória\n'); return 1; }
      let status = 0;
      const aplicar = (path) => {
        const node = sh.m.fs.lstat(path, sh.fsopts());
        if (sh.uid !== 0 && node.uid !== sh.uid) { io.stderr.write(`setfacl: ${path}: Operation not permitted\n`); status = 1; return; }
        if (limpar) {
          if (node.aclGroupObj != null) node.mode = (node.mode & ~0o070) | (node.aclGroupObj << 3);
          delete node.acl; delete node.aclGroupObj; return;
        }
        for (const clause of String(spec).split(',')) {
          const partes = clause.trim().split(':');
          let tipo = partes[0], nome = partes[1], perm = partes[2];
          if (tipo === 'd' || tipo === 'default') { io.stderr.write('setfacl: ACLs padrão (default) não são suportadas neste ambiente\n'); status = 1; return; }
          if (tipo === 'u' || tipo === 'user') tipo = 'u';
          else if (tipo === 'g' || tipo === 'group') tipo = 'g';
          else if (tipo === 'm' || tipo === 'mask') tipo = 'm';
          else if (tipo === 'o' || tipo === 'other') tipo = 'o';
          else { io.stderr.write(`setfacl: Option -${remover ? 'x' : 'm'}: Invalid argument near character 1\n`); status = 1; return; }
          if (!node.acl) { node.acl = []; node.aclGroupObj = (node.mode >> 3) & 7; }
          if (remover) {
            node.acl = node.acl.filter(e => !(e.tag === tipo && String((sh.m[tipo === 'u' ? 'userByName' : 'groupByName'](nome) || {})[tipo === 'u' ? 'uid' : 'gid']) === String(e.id)));
            if (!node.acl.length) {
              if (node.aclGroupObj != null) node.mode = (node.mode & ~0o070) | (node.aclGroupObj << 3);
              delete node.acl; delete node.aclGroupObj; return;
            }
          } else {
            const bits = parseBits(perm === undefined ? '' : perm);
            if (bits === null) { io.stderr.write(`setfacl: Invalid argument near character ${clause.length}\n`); status = 1; return; }
            if (tipo === 'm') { node.mode = (node.mode & ~0o070) | (bits << 3); continue; }
            if (tipo === 'o') { node.mode = (node.mode & ~0o007) | bits; continue; }
            if (tipo === 'u' && !nome) { node.mode = (node.mode & ~0o700) | (bits << 6); continue; }
            if (tipo === 'g' && !nome) { node.aclGroupObj = bits; }
            else {
              const ent = tipo === 'u' ? sh.m.userByName(nome) : sh.m.groupByName(nome);
              if (!ent) { io.stderr.write(`setfacl: Option -m: Invalid argument near character 3\n`); status = 1; return; }
              const id = tipo === 'u' ? ent.uid : ent.gid;
              const ja = node.acl.find(e => e.tag === tipo && e.id === id);
              if (ja) ja.bits = bits; else node.acl.push({ tag: tipo, id, bits });
            }
          }
        }
        // recalcula a máscara (bits de grupo do mode), como faz o setfacl real
        if (node.acl && node.acl.length) node.mode = (node.mode & ~0o070) | (aclMask(node) << 3);
        node.ctime = Date.now();
      };
      for (const f of rest) {
        try {
          const path = P(sh, f);
          if (opts.R || opts['--recursive']) sh.m.fs.walk(path, (p) => { try { aplicar(p); } catch (e) { } }, sh.fsopts());
          else aplicar(path);
        } catch (e) { io.stderr.write(`setfacl: ${f}: ${e.message}\n`); status = 1; }
      }
      return status;
    }
  });

  /* ============================== namei ============================== */
  defcmd({
    name: 'namei', path: '/usr/bin/namei', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, m: 0, x: 0, '--long': 0 });
      if (!rest.length) { io.stderr.write('namei: usage: namei [-l] pathname\n'); return 1; }
      let status = 0;
      for (const alvo of rest) {
        const abs = P(sh, alvo);
        io.stdout.write('f: ' + abs + '\n');
        const segs = abs.split('/').filter(Boolean);
        let atual = '';
        const linhas = [{ path: '/', nome: '/' }];
        for (const s of segs) { atual += '/' + s; linhas.push({ path: atual, nome: s }); }
        let indent = 0;
        for (const l of linhas) {
          let node = null;
          try { node = sh.m.fs.lstat(l.path, { cwd: '/', ctx: sh.m.ctxRoot() }); } catch (e) { }
          const pad = ' '.repeat(indent);
          if (!node) { io.stdout.write(`${pad}  ${l.nome} - No such file or directory\n`); status = 1; break; }
          const u = (sh.m.userByUid(node.uid) || {}).name || node.uid;
          const g = (sh.m.groupByGid(node.gid) || {}).name || node.gid;
          const seta = node.type === 'link' ? ` -> ${node.target}` : '';
          if (opts.l || opts['--long']) io.stdout.write(`${pad} ${modeToRwx(node.mode, node.type)} ${u} ${g} ${l.nome}${seta}\n`);
          else io.stdout.write(`${pad} ${(node.type === 'dir' ? 'd' : node.type === 'link' ? 'l' : '-')} ${l.nome}${seta}\n`);
          indent += 1;
        }
      }
      return status;
    }
  });

  /* ============================== identidade ============================== */
  defcmd({
    name: 'id', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { u: 0, g: 0, G: 0, n: 0, r: 0 });
      const name = rest[0] || sh.user;
      let u = sh.m.userByName(name);
      /* Um UID sem entrada em /etc/passwd é legítimo: `docker run -u 1000`
         em uma imagem que não tem esse usuário roda assim mesmo, e o id
         responde com o número puro, sem nome entre parênteses. */
      if (!u && /^\d+$/.test(name) && +name === sh.uid) {
        u = { name, uid: sh.uid, gid: sh.gid, semRegistro: true };
      }
      if (!u) { io.stderr.write(`id: '${name}': no such user\n`); return 1; }
      if (u.semRegistro) {
        if (opts.u) { io.stdout.write(u.uid + '\n'); return 0; }
        if (opts.g) { io.stdout.write(u.gid + '\n'); return 0; }
        if (opts.G) { io.stdout.write(u.gid + '\n'); return 0; }
        io.stdout.write(`uid=${u.uid} gid=${u.gid} groups=${u.gid}\n`);
        return 0;
      }
      const groups = sh.m.groupsOfUser(name);
      const primary = sh.m.groupByGid(u.gid);
      if (opts.u) { io.stdout.write((opts.n ? u.name : u.uid) + '\n'); return 0; }
      if (opts.g) { io.stdout.write((opts.n ? (primary || {}).name || u.gid : u.gid) + '\n'); return 0; }
      if (opts.G) { io.stdout.write(groups.map(g => opts.n ? g.name : g.gid).join(' ') + '\n'); return 0; }
      io.stdout.write(`uid=${u.uid}(${u.name}) gid=${u.gid}(${(primary || {}).name || u.gid}) groups=${groups.map(g => `${g.gid}(${g.name})`).join(',')}\n`);
      return 0;
    }
  });
  defcmd({ name: 'whoami', run: async ({ sh, io }) => { io.stdout.write(sh.user + '\n'); return 0; } });
  defcmd({
    name: 'groups', run: async ({ sh, io, args }) => {
      const name = args[0] || sh.user;
      if (!sh.m.userByName(name)) { io.stderr.write(`groups: '${name}': no such user\n`); return 1; }
      io.stdout.write(sh.m.groupsOfUser(name).map(g => g.name).join(' ') + '\n');
      return 0;
    }
  });
  defcmd({
    name: ['w', 'who'], path: '/usr/bin/', run: async ({ sh, io, args, name }) => {
      const boot = new Date(sh.m.bootTime);
      const p = (x) => String(x).padStart(2, '0');
      if (name === 'w') {
        const up = sh.m.uptimeSec;
        io.stdout.write(` ${p(new Date().getHours())}:${p(new Date().getMinutes())}:${p(new Date().getSeconds())} up ${Math.floor(up / 3600)}:${p(Math.floor((up % 3600) / 60))},  1 user,  load average: ${sh.m.loadavg.map(l => l.toFixed(2)).join(', ')}\n`);
        io.stdout.write(`USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\n`);
        io.stdout.write(`${sh.user.padEnd(8)} pts/0    10.0.2.2         ${p(boot.getHours())}:${p(boot.getMinutes())}    0.00s  0.05s  0.01s -bash\n`);
        return 0;
      }
      io.stdout.write(`${sh.user.padEnd(8)} pts/0        2026-09-01 ${p(boot.getHours())}:${p(boot.getMinutes())} (10.0.2.2)\n`);
      return 0;
    }
  });
  defcmd({
    name: 'last', run: async ({ sh, io, args }) => {
      io.stdout.write(`aluno    pts/0        10.0.2.2         Tue Sep  1 08:59   still logged in\naluno    pts/0        10.0.2.2         Mon Aug 31 14:02 - 18:31  (04:29)\nreboot   system boot  6.14.0-27-generi Mon Aug 31 06:00   still running\n\nwtmp begins Mon Aug 24 09:11:02 2026\n`);
      return 0;
    }
  });

  /* ============================== usuários ============================== */
  defcmd({
    name: 'useradd', path: '/usr/sbin/useradd', needsRoot: true,
    run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('useradd: Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.\n'); return 1; }
      const { opts, rest } = getopt(args, { m: 0, M: 0, d: 1, s: 1, u: 1, g: 1, G: 1, c: 1, r: 0, N: 0, e: 1, '--system': 0, '--create-home': 0, '--shell': 1, '--groups': 1, '--home-dir': 1, '--expiredate': 1 });
      const name = rest[0];
      if (!name) { io.stderr.write('Usage: useradd [options] LOGIN\n'); return 2; }
      if (sh.m.userByName(name)) { io.stderr.write(`useradd: user '${name}' already exists\n`); return 9; }
      const sistema = !!(opts.r || opts['--system']);
      const uid = opts.u ? +opts.u : (sistema ? sh.m.nextSysUid() : sh.m.nextUid());
      let gid;
      if (opts.g) { const g = sh.m.groupByName(opts.g) || sh.m.groupByGid(opts.g); if (!g) { io.stderr.write(`useradd: group '${opts.g}' does not exist\n`); return 6; } gid = g.gid; }
      else { gid = sistema ? sh.m.nextSysGid() : sh.m.nextGid(); sh.m.addGroupRecord({ name, gid, members: [] }); }
      const home = opts.d || opts['--home-dir'] || `/home/${name}`;
      const shell = opts.s || opts['--shell'] || '/bin/sh';
      sh.m.addUserRecord({ name, uid, gid, gecos: '', home, shell, locked: true });
      if (opts.m || opts['--create-home']) {
        const ctx = sh.m.ctxRoot();
        sh.m.fs.mkdirp(home, { ctx });
        const h = sh.m.fs.stat(home, { ctx });
        h.uid = uid; h.gid = gid; h.mode = 0o750;
        for (const f of ['.bashrc', '.profile', '.bash_logout']) {
          try {
            const c = sh.m.fs.readFile('/etc/skel/' + f, { ctx });
            const n = sh.m.fs.writeFile(FileSystem.join(home, f), c, { ctx });
            n.uid = uid; n.gid = gid;
          } catch (e) { }
        }
      }
      const extra = opts.G || opts['--groups'];
      if (extra) {
        const groups = sh.m.groups();
        for (const gn of extra.split(',')) {
          const g = groups.find(x => x.name === gn.trim());
          if (g && !g.members.includes(name)) g.members.push(name);
        }
        sh.m.rewriteGroup(groups);
      }
      return 0;
    }
  });

  defcmd({
    name: 'adduser', path: '/usr/sbin/adduser', needsRoot: true,
    run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('adduser: Only root may add a user or group to the system.\n'); return 1; }
      const { opts, rest } = getopt(args, { '--system': 0, '--disabled-password': 0, '--gecos': 1, '--ingroup': 1, '--shell': 1, '--home': 1, '--no-create-home': 0 });
      if (rest.length === 2) {
        // adduser USUARIO GRUPO  -> adiciona usuário ao grupo
        const [uname, gname] = rest;
        const u = sh.m.userByName(uname);
        if (!u) { io.stderr.write(`adduser: The user '${uname}' does not exist.\n`); return 1; }
        const groups = sh.m.groups();
        const g = groups.find(x => x.name === gname);
        if (!g) { io.stderr.write(`adduser: The group '${gname}' does not exist.\n`); return 1; }
        if (g.members.includes(uname)) { io.stdout.write(`The user '${uname}' is already a member of '${gname}'.\n`); return 0; }
        g.members.push(uname);
        sh.m.rewriteGroup(groups);
        io.stdout.write(`Adding user '${uname}' to group '${gname}' ...\nDone.\n`);
        return 0;
      }
      const name = rest[0];
      if (!name) { io.stderr.write('adduser: Only one or two names allowed.\n'); return 1; }
      if (sh.m.userByName(name)) { io.stderr.write(`adduser: The user '${name}' already exists.\n`); return 1; }
      const uid = sh.m.nextUid();
      const gid = sh.m.nextGid();
      sh.m.addGroupRecord({ name, gid, members: [] });
      const home = opts['--home'] || `/home/${name}`;
      sh.m.addUserRecord({ name, uid, gid, gecos: (opts['--gecos'] || '') + ',,,', home, shell: opts['--shell'] || '/bin/bash', locked: !!opts['--disabled-password'] });
      const ctx = sh.m.ctxRoot();
      io.stdout.write(`info: Adding user \`${name}' ...\ninfo: Selecting UID/GID from range 1000 to 59999 ...\ninfo: Adding new group \`${name}' (${gid}) ...\ninfo: Adding new user \`${name}' (${uid}) with group \`${name} (${gid})' ...\n`);
      if (!opts['--no-create-home']) {
        sh.m.fs.mkdirp(home, { ctx });
        const h = sh.m.fs.stat(home, { ctx }); h.uid = uid; h.gid = gid; h.mode = 0o750;
        for (const f of ['.bashrc', '.profile', '.bash_logout']) {
          try { const c = sh.m.fs.readFile('/etc/skel/' + f, { ctx }); const n = sh.m.fs.writeFile(FileSystem.join(home, f), c, { ctx }); n.uid = uid; n.gid = gid; } catch (e) { }
        }
        io.stdout.write(`info: Creating home directory \`${home}' ...\ninfo: Copying files from \`/etc/skel' ...\n`);
      }
      if (!opts['--disabled-password'] && io.term && io.term.readLine) {
        io.stdout.write(`New password: `);
        await io.term.readLine('', { silent: true });
        io.stdout.write(`\nRetype new password: `);
        await io.term.readLine('', { silent: true });
        io.stdout.write(`\npasswd: password updated successfully\n`);
        io.stdout.write(`Changing the user information for ${name}\nEnter the new value, or press ENTER for the default\n`);
      }
      io.stdout.write(`info: Adding new user \`${name}' to supplemental / extra groups \`users' ...\ninfo: Adding user \`${name}' to group \`users' ...\n`);
      return 0;
    }
  });

  defcmd({
    name: 'usermod', path: '/usr/sbin/usermod', needsRoot: true,
    run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('usermod: Permission denied.\n'); return 1; }
      const { opts, rest } = getopt(args, { a: 0, G: 1, g: 1, s: 1, d: 1, l: 1, L: 0, U: 0, c: 1, u: 1, m: 0, e: 1, '--append': 0, '--groups': 1, '--shell': 1, '--lock': 0, '--unlock': 0, '--home': 1 });
      const name = rest[0];
      const users = sh.m.users();
      const u = users.find(x => x.name === name);
      if (!u) { io.stderr.write(`usermod: user '${name}' does not exist\n`); return 6; }
      const G = opts.G || opts['--groups'];
      if (G) {
        const groups = sh.m.groups();
        const wanted = G.split(',').map(s => s.trim()).filter(Boolean);
        for (const gn of wanted) if (!groups.find(g => g.name === gn)) { io.stderr.write(`usermod: group '${gn}' does not exist\n`); return 6; }
        if (!(opts.a || opts['--append'])) for (const g of groups) g.members = g.members.filter(mm => mm !== name);
        for (const gn of wanted) { const g = groups.find(x => x.name === gn); if (!g.members.includes(name)) g.members.push(name); }
        sh.m.rewriteGroup(groups);
      }
      if (opts.s || opts['--shell']) u.shell = opts.s || opts['--shell'];
      if (opts.d || opts['--home']) u.home = opts.d || opts['--home'];
      if (opts.c) u.gecos = opts.c;
      if (opts.u) u.uid = +opts.u;
      if (opts.g) { const g = sh.m.groupByName(opts.g) || sh.m.groupByGid(opts.g); if (g) u.gid = g.gid; }
      if (opts.l) u.name = opts.l;
      sh.m.rewritePasswd(users);
      if (opts.L || opts['--lock']) {
        const sc = sh.m.fs.readFile('/etc/shadow', { ctx: sh.m.ctxRoot() }).split('\n').map(l => l.startsWith(name + ':') ? l.replace(/^([^:]+):/, '$1:!') : l).join('\n');
        sh.m.fs.writeFile('/etc/shadow', sc, { ctx: sh.m.ctxRoot() });
      }
      if (opts.U || opts['--unlock']) {
        const sc = sh.m.fs.readFile('/etc/shadow', { ctx: sh.m.ctxRoot() }).split('\n').map(l => l.startsWith(name + ':') ? l.replace(/^([^:]+):!+/, '$1:') : l).join('\n');
        sh.m.fs.writeFile('/etc/shadow', sc, { ctx: sh.m.ctxRoot() });
      }
      return 0;
    }
  });

  defcmd({
    name: ['userdel', 'deluser'], path: '/usr/sbin/', needsRoot: true,
    run: async ({ sh, io, args, name: cmdName }) => {
      if (sh.uid !== 0) { io.stderr.write(`${cmdName}: Permission denied.\n`); return 1; }
      const { opts, rest } = getopt(args, { r: 0, f: 0, '--remove-home': 0, '--remove': 0, '--help': 0 });
      const name = rest[0];
      if (opts['--help'] || !name) {
        io.stdout.write(`Uso: ${cmdName} [opções] LOGIN\n\n  -r, --remove   remove também o diretório pessoal e a caixa de correio\n  -f, --force    remove mesmo com processos do usuário em execução\n`);
        return name ? 0 : 2;
      }
      const users = sh.m.users();
      const u = users.find(x => x.name === name);
      if (!u) { io.stderr.write(`${cmdName}: user '${name}' does not exist\n`); return 6; }
      sh.m.rewritePasswd(users.filter(x => x.name !== name));
      const groups = sh.m.groups().filter(g => g.name !== name);
      groups.forEach(g => g.members = g.members.filter(mm => mm !== name));
      sh.m.rewriteGroup(groups);
      const sc = sh.m.fs.readFile('/etc/shadow', { ctx: sh.m.ctxRoot() }).split('\n').filter(l => !l.startsWith(name + ':')).join('\n');
      sh.m.fs.writeFile('/etc/shadow', sc, { ctx: sh.m.ctxRoot() });
      if (opts.r || opts['--remove-home'] || opts['--remove']) {
        try { sh.m.fs.rmrf(u.home, { ctx: sh.m.ctxRoot() }); } catch (e) { }
        io.stdout.write(`info: Removing home directory \`${u.home}' ...\n`);
      }
      io.stdout.write(`info: Removing user \`${name}' ...\n`);
      return 0;
    }
  });

  defcmd({
    name: ['groupadd', 'addgroup'], path: '/usr/sbin/', needsRoot: true,
    run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('groupadd: Permission denied.\n'); return 1; }
      const { opts, rest } = getopt(args, { g: 1, r: 0, f: 0 });
      const name = rest[0];
      if (!name) { io.stderr.write('Usage: groupadd [options] GROUP\n'); return 2; }
      if (sh.m.groupByName(name)) { io.stderr.write(`groupadd: group '${name}' already exists\n`); return 9; }
      const gid = opts.g ? +opts.g : sh.m.nextGid();
      sh.m.addGroupRecord({ name, gid, members: [] });
      return 0;
    }
  });
  defcmd({
    name: ['groupdel', 'delgroup'], path: '/usr/sbin/', needsRoot: true,
    run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('groupdel: Permission denied.\n'); return 1; }
      const name = args[0];
      const groups = sh.m.groups();
      if (!groups.find(g => g.name === name)) { io.stderr.write(`groupdel: group '${name}' does not exist\n`); return 6; }
      sh.m.rewriteGroup(groups.filter(g => g.name !== name));
      return 0;
    }
  });
  defcmd({
    name: 'gpasswd', needsRoot: true,
    run: async ({ sh, io, args }) => {
      if (sh.uid !== 0) { io.stderr.write('gpasswd: Permission denied.\n'); return 1; }
      const { opts, rest } = getopt(args, { a: 1, d: 1, M: 1, A: 1 });
      const gname = rest[0];
      const groups = sh.m.groups();
      const g = groups.find(x => x.name === gname);
      if (!g) { io.stderr.write(`gpasswd: group '${gname}' does not exist in /etc/group\n`); return 1; }
      if (opts.a) { if (!g.members.includes(opts.a)) g.members.push(opts.a); io.stdout.write(`Adding user ${opts.a} to group ${gname}\n`); }
      if (opts.d) { g.members = g.members.filter(mm => mm !== opts.d); io.stdout.write(`Removing user ${opts.d} from group ${gname}\n`); }
      if (opts.M) g.members = opts.M.split(',');
      sh.m.rewriteGroup(groups);
      return 0;
    }
  });

  defcmd({
    name: 'passwd', path: '/usr/bin/passwd', suid: true,
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, u: 0, d: 0, S: 0, e: 0 });
      const target = rest[0] || sh.user;
      if (target !== sh.user && sh.uid !== 0) { io.stderr.write(`passwd: You may not view or modify password information for ${target}.\n`); return 1; }
      if (!sh.m.userByName(target)) { io.stderr.write(`passwd: user '${target}' does not exist\n`); return 1; }
      if (opts.S) {
        const line = sh.m.fs.readFile('/etc/shadow', { ctx: sh.m.ctxRoot() }).split('\n').find(l => l.startsWith(target + ':')) || '';
        const hash = line.split(':')[1] || '';
        const st = hash.startsWith('!') ? 'L' : (hash === '' ? 'NP' : 'P');
        io.stdout.write(`${target} ${st} 2026-08-01 0 99999 7 -1\n`);
        return 0;
      }
      if (opts.l) { io.stdout.write(`passwd: password expiry information changed.\n`); return 0; }
      if (!io.term || !io.term.readLine) { io.stderr.write('passwd: Authentication token manipulation error\n'); return 1; }
      if (sh.uid !== 0) {
        io.stdout.write(`Changing password for ${target}.\nCurrent password: `);
        await io.term.readLine('', { silent: true });
        io.stdout.write('\n');
      } else {
        io.stdout.write(`New password: `);
      }
      if (sh.uid !== 0) io.stdout.write('New password: ');
      const p1 = await io.term.readLine('', { silent: true });
      io.stdout.write('\nRetype new password: ');
      const p2 = await io.term.readLine('', { silent: true });
      io.stdout.write('\n');
      if (p1 !== p2) { io.stderr.write('Sorry, passwords do not match.\npasswd: Authentication token manipulation error\npasswd: password unchanged\n'); return 1; }
      if (p1.length < 8) { io.stderr.write('BAD PASSWORD: The password is shorter than 8 characters\n'); if (sh.uid !== 0) { io.stderr.write('passwd: Have exhausted maximum number of retries for service\npasswd: password unchanged\n'); return 1; } }
      io.stdout.write('passwd: password updated successfully\n');
      return 0;
    }
  });

  defcmd({
    name: 'su', path: '/usr/bin/su', suid: true,
    run: async ({ sh, io, args, ex }) => {
      const { opts, rest } = getopt(args, { c: 1, l: 0, '-': 0, m: 0, s: 1 });
      const target = rest.find(r => r !== '-') || 'root';
      const u = sh.m.userByName(target);
      if (!u) { io.stderr.write(`su: user ${target} does not exist or the user entry does not contain all the required fields\n`); return 1; }
      if (sh.uid !== 0) {
        if (io.term && io.term.readLine) {
          io.stdout.write('Password: ');
          await io.term.readLine('', { silent: true });
          io.stdout.write('\n');
        }
        const line = sh.m.fs.readFile('/etc/shadow', { ctx: sh.m.ctxRoot() }).split('\n').find(l => l.startsWith(target + ':')) || '';
        if ((line.split(':')[1] || '').startsWith('!')) {
          io.stderr.write('su: Authentication failure\n');
          sh.m.log('su', `FAILED SU (to ${target}) ${sh.user} on pts/0`, 4);
          return 1;
        }
      }
      io.stderr.write(`su: neste ambiente de estudo, use "sudo -i" ou "sudo <comando>" para virar root.\n`);
      return 1;
    }
  });

  defcmd({
    name: 'sudo', path: '/usr/bin/sudo', suid: true,
    run: async ({ sh, io, args, ex }) => {
      // as opções do sudo terminam no nome do comando: em "sudo ls -l", o -l é do ls
      let corte = args.length;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--') { corte = i + 1; break; }
        if (a.startsWith('-')) { if (/^-[uUgCp]$/.test(a)) i++; continue; }
        corte = i; break;
      }
      const g0 = getopt(args.slice(0, corte), { u: 1, i: 0, s: 0, l: 0, k: 0, E: 0, H: 0, n: 0, b: 0, '--user': 1, '--login': 0, '--list': 0, '--help': 0 });
      const opts = g0.opts;
      const rest = g0.rest.concat(args.slice(corte));
      if (opts['--user']) opts.u = opts['--user'];
      if (opts['--login']) opts.i = 1;
      if (opts['--list']) opts.l = 1;
      const groups = sh.m.groupsOfUser(sh.user).map(g => g.name);
      const allowed = sh.uid === 0 || groups.includes('sudo') || groups.includes('admin');
      if (!allowed) {
        sh.m.log('sudo', `${sh.user} : user NOT in sudoers ; TTY=pts/0 ; PWD=${sh.cwd} ; USER=root ; COMMAND=${rest.join(' ')}`, 4);
        try { sh.m.fs.appendFile('/var/log/auth.log', `Sep  1 ${new Date().toTimeString().slice(0, 8)} ${sh.m.hostname} sudo: ${sh.user} : user NOT in sudoers ; TTY=pts/0 ; PWD=${sh.cwd} ; USER=root ; COMMAND=${rest.join(' ')}\n`, { ctx: sh.m.ctxRoot() }); } catch (e) { }
        io.stderr.write(`${sh.user} is not in the sudoers file.  This incident will be reported.\n`);
        return 1;
      }
      if (opts.l) {
        io.stdout.write(`Matching Defaults entries for ${sh.user} on ${sh.m.hostname}:\n    env_reset, mail_badpass,\n    secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin\n\nUser ${sh.user} may run the following commands on ${sh.m.hostname}:\n    (ALL : ALL) ALL\n`);
        return 0;
      }
      const targetUser = opts.u || 'root';
      const tu = sh.m.userByName(targetUser);
      if (!tu) { io.stderr.write(`sudo: unknown user ${targetUser}\n`); return 1; }
      try { sh.m.fs.appendFile('/var/log/auth.log', `Sep  1 ${new Date().toTimeString().slice(0, 8)} ${sh.m.hostname} sudo:    ${sh.user} : TTY=pts/0 ; PWD=${sh.cwd} ; USER=${targetUser} ; COMMAND=${rest.join(' ') || '/bin/bash'}\n`, { ctx: sh.m.ctxRoot() }); } catch (e) { }
      if (opts.i || opts.s || !rest.length) {
        if (io.term && io.term.becomeRoot) { io.term.becomeRoot(tu, opts.i); return 0; }
        io.stderr.write('sudo: shell interativo indisponível aqui; use "sudo <comando>".\n');
        return 1;
      }
      const saved = { uid: sh.uid, gid: sh.gid, user: sh.user, home: sh.getVar('HOME'), path: sh.getVar('PATH') };
      sh.uid = tu.uid; sh.gid = tu.gid; sh.user = tu.name;
      sh.setVar('USER', tu.name, true); sh.setVar('HOME', tu.home, true); sh.setVar('LOGNAME', tu.name, true);
      sh.setVar('PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', true);
      try {
        return await ex.dispatch(rest, io, { type: 'simple', words: [], assigns: [], redirs: [] });
      } finally {
        sh.uid = saved.uid; sh.gid = saved.gid; sh.user = saved.user;
        sh.setVar('USER', saved.user, true); sh.setVar('HOME', saved.home, true); sh.setVar('LOGNAME', saved.user, true);
        sh.setVar('PATH', saved.path, true);
      }
    }
  });

  defcmd({ name: 'visudo', path: '/usr/sbin/visudo', run: async ({ sh, io }) => {
    if (sh.uid !== 0) { io.stderr.write('visudo: /etc/sudoers: Permission denied\n'); return 1; }
    if (io.term && io.term.editor) { await io.term.editor('/etc/sudoers'); io.stdout.write('visudo: /etc/sudoers.tmp: parsed OK\n'); return 0; }
    return 0;
  } });

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
        case 'show': { if (!u) return 1; io.stdout.write(`Id=${u.name}\nDescription=${u.description}\nActiveState=${u.state}\nSubState=${u.sub}\nMainPID=${u.mainPid || 0}\nUnitFileState=${u.enabled ? 'enabled' : 'disabled'}\n`); return 0; }
        default:
          io.stderr.write(`Unknown command verb ${verb}.\n`);
          return 1;
      }
      // --failed
      const failed = Array.from(sh.m.units.values()).filter(x => x.state === 'failed');
      if (!failed.length) { io.stdout.write('0 loaded units listed.\n'); return 0; }
      io.stdout.write('  UNIT              LOAD   ACTIVE SUB    DESCRIPTION\n');
      failed.forEach(x => io.stdout.write(`${C.red}●${C.reset} ${x.name.padEnd(17)} loaded failed failed ${x.description}\n`));
      io.stdout.write(`\n${failed.length} loaded units listed.\n`);
      return 0;
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

  /* ============================== arquivos compactados ============================== */
  const TAR_MAGIC = 'TARDATA\n';
  const GZ_MAGIC = 'GZIPDATA\n';
  const ZIP_MAGIC = 'ZIPDATA\n';
  function packTree(sh, paths, base) {
    const entries = {};
    for (const p of paths) {
      const abs = P(sh, p);
      sh.m.fs.walk(abs, (path, node) => {
        const rel = p.replace(/^\.\//, '').replace(/\/$/, '') + (path === abs ? '' : path.slice(abs.length));
        entries[rel] = { type: node.type, mode: node.mode, uid: node.uid, gid: node.gid, mtime: node.mtime, content: node.type === 'file' ? node.read() : (node.type === 'link' ? node.target : '') };
      }, sh.fsopts());
    }
    return entries;
  }
  function unpackTree(sh, entries, dest, io, verbose) {
    const names = Object.keys(entries).sort();
    for (const rel of names) {
      const e = entries[rel];
      const target = FileSystem.join(P(sh, dest), rel);
      try {
        if (e.type === 'dir') sh.m.fs.mkdirp(target, sh.fsopts());
        else if (e.type === 'link') { try { sh.m.fs.unlink(target, sh.fsopts()); } catch (x) { } sh.m.fs.symlink(e.content, target, sh.fsopts()); }
        else { sh.m.fs.mkdirp(FileSystem.dirname(target), sh.fsopts()); const n = sh.m.fs.create(target, e.content, sh.fsopts()); n.mode = e.mode; n.mtime = e.mtime || Date.now(); }
        if (verbose) io.stdout.write(rel + (e.type === 'dir' ? '/' : '') + '\n');
      } catch (err) { io.stderr.write(`tar: ${rel}: Cannot open: ${err.message}\n`); }
    }
  }
  LX.packTree = packTree;

  defcmd({
    name: 'tar', pkg: 'tar', run: async ({ sh, io, args }) => {
      /* Só os agrupamentos curtos entram no flagStr. Opções longas ficam de
         fora: `--strip-components` contém "c" e "t" e faria o tar achar que
         é para criar e listar ao mesmo tempo. */
      const flagStr = args.filter(a => /^-[cxtzjvfJaCk]+$/.test(a) || (args.indexOf(a) === 0 && /^[cxtzjvfJa]+$/.test(a))).join('');
      const has = (c) => flagStr.includes(c) || args.some(a => a === '--' + ({ c: 'create', x: 'extract', t: 'list', z: 'gzip', v: 'verbose' }[c] || '###'));
      const { opts, rest } = getopt(args, { f: 1, C: 1, '--file': 1, '--directory': 1, '--exclude': 1 });
      const file = opts.f || opts['--file'];
      const positional = rest.filter(r => !/^[-]?[cxtzjvfJa]+$/.test(r) || r.includes('.') || r.includes('/'));
      const files = positional.filter(p => p !== file);
      const create = has('c'), extract = has('x'), list = has('t'), verbose = has('v');
      const bz = has('j') || args.includes('--bzip2') || (file && /\.(tbz2?|tar\.bz2)$/.test(file));
      const xz = flagStr.includes('J') || args.includes('--xz') || (file && /\.(txz|tar\.xz)$/.test(file));
      const zst = args.includes('--zstd') || (file && /\.tar\.zst$/.test(file));
      const gz = has('z') || (file && /\.(tgz|tar\.gz)$/.test(file));
      const comprimido = gz || bz || xz || zst;
      const excluir = [].concat(opts['--exclude'] || []).filter(Boolean)
        .concat(args.filter(a => a.startsWith('--exclude=')).map(a => a.slice(10)));
      if (!create && !extract && !list) {
        io.stderr.write("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information.\n");
        return 2;
      }
      if (!file) { io.stderr.write('tar: Refusing to read archive contents from terminal (missing -f option?)\ntar: Error is not recoverable: exiting now\n'); return 2; }
      const dest = opts.C || opts['--directory'] || '.';
      if (create) {
        if (!files.length) { io.stderr.write('tar: Cowardly refusing to create an empty archive\nTry \'tar --help\' for more information.\n'); return 2; }
        const arquivoDestino = P(sh, file);            // resolve antes de mudar de diretório
        let entries;
        const cwdAntes = sh.cwd;
        try {
          if (dest && dest !== '.') {
            const alvo = P(sh, dest);
            const st = sh.m.fs.stat(alvo, sh.fsopts());
            if (st.type !== 'dir') throw new Error(`${dest}: Not a directory`);
            sh.cwd = alvo;
          }
          entries = packTree(sh, files, '.');
        } catch (e) { sh.cwd = cwdAntes; io.stderr.write(`tar: ${e.message}\n`); return 2; }
        sh.cwd = cwdAntes;
        if (excluir.length) {
          for (const k of Object.keys(entries)) {
            const base = k.replace(/^.*\//, '');
            if (excluir.some(pat => LX.matchGlob(base, pat) || LX.matchGlob(k, pat))) delete entries[k];
          }
        }
        if (verbose) Object.keys(entries).sort().forEach(k => io.stdout.write(k + (entries[k].type === 'dir' ? '/' : '') + '\n'));
        let payload = TAR_MAGIC + JSON.stringify(entries);
        if (comprimido) payload = GZ_MAGIC + payload;
        const taxaTar = zst ? 0.30 : xz ? 0.22 : bz ? 0.28 : 0.36;
        sh.m.fs.writeFile(arquivoDestino, payload, sh.fsopts());
        return 0;
      }
      let data;
      try { data = sh.m.fs.readFile(P(sh, file), sh.fsopts()); }
      catch (e) { io.stderr.write(`tar: ${file}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now\n`); return 2; }
      if (data.startsWith(GZ_MAGIC)) data = data.slice(GZ_MAGIC.length);
      else if (comprimido) { io.stderr.write('\ngzip: stdin: not in gzip format\ntar: Child returned status 1\ntar: Error is not recoverable: exiting now\n'); return 2; }
      if (!data.startsWith(TAR_MAGIC)) { io.stderr.write(`tar: This does not look like a tar archive\ntar: Exiting with failure status due to previous errors\n`); return 2; }
      let entries;
      try { entries = JSON.parse(data.slice(TAR_MAGIC.length)); } catch (e) { io.stderr.write('tar: arquivo corrompido\n'); return 2; }
      if (list) { Object.keys(entries).sort().forEach(k => io.stdout.write(k + (entries[k].type === 'dir' ? '/' : '') + '\n')); return 0; }

      /* Extração seletiva: `tar -xzf a.tgz caminho/dentro` traz só aquilo
         (e o que estiver abaixo dele). Com --wildcards, o membro pode ser
         um padrão. Sem membros, extrai o arquivo inteiro. */
      const membros = files.filter(f => f !== file);
      const curinga = args.includes('--wildcards');
      let selecionadas = entries;
      if (membros.length) {
        selecionadas = {};
        for (const k of Object.keys(entries)) {
          const casa = membros.some(mm => {
            const alvo = mm.replace(/\/+$/, '');
            if (curinga || /[*?\[]/.test(alvo)) return LX.matchGlob(k, alvo) || LX.matchGlob(k, alvo + '/*');
            return k === alvo || k.startsWith(alvo + '/');
          });
          if (casa) selecionadas[k] = entries[k];
        }
        if (!Object.keys(selecionadas).length) {
          for (const mm of membros) io.stderr.write(`tar: ${mm}: Not found in archive\n`);
          io.stderr.write('tar: Exiting with failure status due to previous errors\n');
          return 2;
        }
      }

      /* --strip-components=N remove os N primeiros níveis de cada caminho —
         é o que tira o diretório de versão dos tarballs de release. */
      const stripArg = args.find(a => /^--strip-components(=|$)/.test(a));
      let strip = 0;
      if (stripArg) {
        strip = stripArg.includes('=') ? +stripArg.split('=')[1] : +(args[args.indexOf(stripArg) + 1] || 0);
        if (!isFinite(strip) || strip < 0) strip = 0;
      }
      if (strip > 0) {
        const cortadas = {};
        for (const k of Object.keys(selecionadas)) {
          const partes = k.split('/').filter(Boolean);
          if (partes.length <= strip) continue;          // some junto com o nível removido
          cortadas[partes.slice(strip).join('/')] = selecionadas[k];
        }
        selecionadas = cortadas;
      }

      unpackTree(sh, selecionadas, dest, io, verbose);
      return 0;
    }
  });

  /* bzip2 / xz / zstd: mesma mecânica do gzip, extensões diferentes */
  for (const fam of [
    { nomes: ['bzip2', 'bunzip2', 'bzcat'], ext: '.bz2', pkg: 'bzip2', taxa: 0.28 },
    { nomes: ['xz', 'unxz', 'xzcat'], ext: '.xz', pkg: 'xz-utils', taxa: 0.22 },
    { nomes: ['zstd', 'unzstd', 'zstdcat'], ext: '.zst', pkg: 'zstd', taxa: 0.30 }
  ]) {
    defcmd({
      name: fam.nomes, path: '/usr/bin/', pkg: fam.pkg,
      run: async ({ sh, io, args, name }) => {
        const { opts, rest } = getopt(args, { d: 0, k: 0, c: 0, f: 0, v: 0, '9': 0, '1': 0, '--version': 0, '--decompress': 0, '--keep': 0, '--stdout': 0 });
        if (opts['--version']) { io.stdout.write(`${fam.nomes[0]} (Terminalis) 1.9\n`); return 0; }
        const descomprimir = name === fam.nomes[1] || name === fam.nomes[2] || opts.d || opts['--decompress'];
        const paraStdout = name === fam.nomes[2] || opts.c || opts['--stdout'];
        const manter = opts.k || opts['--keep'] || paraStdout;
        let status = 0;
        for (const f of rest) {
          const caminho = P(sh, f);
          try {
            const conteudo = sh.m.fs.readFile(caminho, sh.fsopts());
            if (descomprimir) {
              if (!f.endsWith(fam.ext)) { io.stderr.write(`${name}: ${f}: Unknown suffix -- ignored\n`); status = 1; continue; }
              const dados = conteudo.startsWith(GZ_MAGIC) ? conteudo.slice(GZ_MAGIC.length) : conteudo;
              if (paraStdout) { io.stdout.write(dados); continue; }
              sh.m.fs.writeFile(caminho.slice(0, -fam.ext.length), dados, sh.fsopts());
              if (!manter) sh.m.fs.unlink(caminho, sh.fsopts());
            } else {
              if (f.endsWith(fam.ext)) { io.stderr.write(`${name}: ${f} already has ${fam.ext} suffix -- unchanged\n`); status = 1; continue; }
              const dados = GZ_MAGIC + conteudo;
              if (paraStdout) { io.stdout.write(dados); continue; }
              const n = sh.m.fs.writeFile(caminho + fam.ext, dados, sh.fsopts());
              n.compressedFrom = conteudo.length;
              n.tamanhoComprimido = Math.max(20, Math.round(conteudo.length * fam.taxa));
              if (opts.v) io.stderr.write(`  ${f}: ${(100 - fam.taxa * 100).toFixed(1)}% -- replaced with ${f}${fam.ext}\n`);
              if (!manter) sh.m.fs.unlink(caminho, sh.fsopts());
            }
          } catch (e) { io.stderr.write(`${name}: ${f}: ${e.message}\n`); status = 1; }
        }
        return status;
      }
    });
  }

  defcmd({
    name: ['gzip', 'gunzip', 'zcat'], path: '/usr/bin/', pkg: 'gzip',
    run: async ({ sh, io, args, name }) => {
      const { opts, rest } = getopt(args, { d: 0, k: 0, c: 0, r: 0, '9': 0, '1': 0, l: 0, f: 0, '--decompress': 0, '--keep': 0, '--stdout': 0 });
      const decompress = name === 'gunzip' || name === 'zcat' || opts.d || opts['--decompress'];
      const toStdout = name === 'zcat' || opts.c || opts['--stdout'];
      let status = 0;
      for (const f of rest) {
        const path = P(sh, f);
        try {
          const data = sh.m.fs.readFile(path, sh.fsopts());
          if (decompress) {
            if (!data.startsWith(GZ_MAGIC)) { io.stderr.write(`\ngzip: ${f}: not in gzip format\n`); status = 1; continue; }
            const out = data.slice(GZ_MAGIC.length);
            if (toStdout) { io.stdout.write(out); continue; }
            const newPath = path.replace(/\.gz$/, '');
            sh.m.fs.writeFile(newPath, out, sh.fsopts());
            if (!opts.k && !opts['--keep']) sh.m.fs.unlink(path, sh.fsopts());
          } else {
            if (data.startsWith(GZ_MAGIC)) { io.stderr.write(`gzip: ${f} already has .gz suffix -- unchanged\n`); status = 1; continue; }
            const out = GZ_MAGIC + data;
            if (toStdout) { io.stdout.write(out); continue; }
            const nz = sh.m.fs.writeFile(path + '.gz', out, sh.fsopts());
            nz.compressedFrom = data.length;
            nz.tamanhoComprimido = Math.max(20, Math.round(data.length * 0.36));
            if (!opts.k && !opts['--keep']) sh.m.fs.unlink(path, sh.fsopts());
          }
        } catch (e) { io.stderr.write(`gzip: ${f}: ${e.message}\n`); status = 1; }
      }
      if (!rest.length) { const d = io.stdin.readAll(); io.stdout.write(decompress ? d.replace(GZ_MAGIC, '') : GZ_MAGIC + d); }
      return status;
    }
  });

  defcmd({
    name: 'zip', pkg: 'zip', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { r: 0, q: 0, '9': 0, e: 0 });
      const archive = rest[0];
      const files = rest.slice(1);
      if (!archive || !files.length) { io.stderr.write('zip error: Nothing to do! (try: zip -r arquivo.zip . -i *)\n'); return 12; }
      const entries = packTree(sh, files, '.');
      sh.m.fs.writeFile(P(sh, archive.endsWith('.zip') ? archive : archive + '.zip'), ZIP_MAGIC + JSON.stringify(entries), sh.fsopts());
      if (!opts.q) Object.keys(entries).sort().forEach(k => io.stdout.write(`  adding: ${k}${entries[k].type === 'dir' ? '/' : ''} (stored 0%)\n`));
      return 0;
    }
  });
  defcmd({
    name: 'unzip', pkg: 'unzip', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, d: 1, q: 0, o: 0 });
      const archive = rest[0];
      if (!archive) { io.stderr.write('UnZip 6.00 -- usage: unzip file[.zip] [-d exdir]\n'); return 10; }
      let data;
      try { data = sh.m.fs.readFile(P(sh, archive), sh.fsopts()); }
      catch (e) { io.stderr.write(`unzip:  cannot find or open ${archive}, ${archive}.zip or ${archive}.ZIP.\n`); return 9; }
      if (!data.startsWith(ZIP_MAGIC)) { io.stderr.write(`Archive:  ${archive}\n  End-of-central-directory signature not found.\n`); return 9; }
      const entries = JSON.parse(data.slice(ZIP_MAGIC.length));
      io.stdout.write(`Archive:  ${archive}\n`);
      if (opts.l) {
        io.stdout.write('  Length      Date    Time    Name\n---------  ---------- -----   ----\n');
        let total = 0;
        for (const k of Object.keys(entries).sort()) { total += entries[k].content.length; io.stdout.write(`${String(entries[k].content.length).padStart(9)}  2026-09-01 12:00   ${k}\n`); }
        io.stdout.write(`---------                     -------\n${String(total).padStart(9)}                     ${Object.keys(entries).length} files\n`);
        return 0;
      }
      unpackTree(sh, entries, opts.d || '.', io, false);
      for (const k of Object.keys(entries).sort()) io.stdout.write(`  inflating: ${k}${entries[k].type === 'dir' ? '/' : ''}\n`);
      return 0;
    }
  });

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
