/* =========================================================================
   TERMINALIS — permissões, identidade e usuários
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, SysError, defcmd, getopt, modeToRwx } = LX;
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
        if (LX.WorkspaceMutation) LX.WorkspaceMutation.markDirty();   // metadados alterados direto: fora dos hooks do FS
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
        if (LX.WorkspaceMutation) LX.WorkspaceMutation.markDirty();   // dono/grupo alterados direto: fora dos hooks do FS
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
        if (LX.WorkspaceMutation) LX.WorkspaceMutation.markDirty();   // ACL alterada direto: fora dos hooks do FS
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

})();
