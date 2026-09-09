/* =========================================================================
   TERMINALIS — Núcleo virtual: sistema de arquivos
   Implementação real de inodes, permissões, links e caminhos.
   ========================================================================= */
'use strict';

const LX = (typeof window !== 'undefined' ? (window.LX = window.LX || {}) : (globalThis.LX = globalThis.LX || {}));

/* ---------- Erros de sistema (mensagens autênticas em inglês, como no Linux) ---------- */
const ERRNO_MSG = {
  ENOENT: 'No such file or directory',
  EACCES: 'Permission denied',
  EPERM: 'Operation not permitted',
  EEXIST: 'File exists',
  ENOTDIR: 'Not a directory',
  EISDIR: 'Is a directory',
  ENOTEMPTY: 'Directory not empty',
  EINVAL: 'Invalid argument',
  ELOOP: 'Too many levels of symbolic links',
  ENOSPC: 'No space left on device',
  EXDEV: 'Invalid cross-device link',
  ETXTBSY: 'Text file busy',
  ENAMETOOLONG: 'File name too long',
  EADDRINUSE: 'Address already in use',
  ECONNREFUSED: 'Connection refused',
  EHOSTUNREACH: 'No route to host',
  ETIMEDOUT: 'Connection timed out',
  ESRCH: 'No such process',
  EROFS: 'Read-only file system'
};

class SysError extends Error {
  constructor(code, path) {
    super(ERRNO_MSG[code] || code);
    this.code = code;
    this.path = path;
    this.isSysError = true;
  }
  format(prefix) {
    // ex: "ls: /naoexiste: No such file or directory"
    const parts = [];
    if (prefix) parts.push(prefix);
    if (this.path) parts.push(this.path);
    parts.push(this.message);
    return parts.join(': ');
  }
}
LX.SysError = SysError;
LX.ERRNO_MSG = ERRNO_MSG;

/* ---------- Constantes de modo ---------- */
const S_IFMT = 0o170000;
const S_IFDIR = 0o040000, S_IFREG = 0o100000, S_IFLNK = 0o120000;
const S_IFCHR = 0o020000, S_IFBLK = 0o060000, S_IFIFO = 0o010000, S_IFSOCK = 0o140000;
const S_ISUID = 0o4000, S_ISGID = 0o2000, S_ISVTX = 0o1000;

const TYPE_BITS = { dir: S_IFDIR, file: S_IFREG, link: S_IFLNK, chr: S_IFCHR, blk: S_IFBLK, fifo: S_IFIFO, sock: S_IFSOCK };
const TYPE_CHAR = { dir: 'd', file: '-', link: 'l', chr: 'c', blk: 'b', fifo: 'p', sock: 's' };

let INO_SEQ = 1;

class Inode {
  constructor(type, mode, uid = 0, gid = 0) {
    this.ino = INO_SEQ++;
    this.type = type;              // 'dir' | 'file' | 'link' | 'chr' | 'blk' | 'fifo' | 'sock'
    this.mode = mode & 0o7777;     // apenas bits de permissão + especiais
    this.uid = uid;
    this.gid = gid;
    const now = Date.now();
    this.atime = now; this.mtime = now; this.ctime = now; this.btime = now;
    this.nlink = 1;
    this.blocks = 0;
    if (type === 'dir') this.children = new Map();
    else if (type === 'link') this.target = '';
    else if (type === 'chr' || type === 'blk') { this.major = 0; this.minor = 0; }
    else this.content = '';
    // arquivos "vivos" (/proc, /sys): função geradora de conteúdo
    this.dynamic = null;
    this.immutable = false;
  }

  get size() {
    if (this.type === 'dir') return 4096;
    if (this.type === 'link') return this.target.length;
    if (this.dynamic) { try { return this.dynamic().length; } catch (e) { return 0; } }
    /* Arquivo comprimido: o conteúdo continua inteiro na memória (para poder
       ser descomprimido), mas o tamanho relatado é o comprimido — senão a
       aula de compactação mostraria três arquivos do mesmo tamanho. */
    if (this.tamanhoComprimido !== undefined) return this.tamanhoComprimido;
    return (this.content || '').length;
  }
  read() {
    if (this.dynamic) return this.dynamic();
    return this.content || '';
  }
  write(data) {
    if (this.dynamic) throw new SysError('EACCES');
    this.content = data;
    this.mtime = Date.now();
    this.blocks = Math.ceil(data.length / 512);
  }
  get fullMode() { return (TYPE_BITS[this.type] || S_IFREG) | this.mode; }
}
LX.Inode = Inode;

/* ---------- Formatação de permissões ---------- */
function modeToRwx(mode, type) {
  const perm = mode & 0o777;
  let s = TYPE_CHAR[type] || '-';
  const trip = [(perm >> 6) & 7, (perm >> 3) & 7, perm & 7];
  const chars = ['r', 'w', 'x'];
  for (let i = 0; i < 3; i++) {
    for (let b = 0; b < 3; b++) {
      s += (trip[i] & (4 >> b)) ? chars[b] : '-';
    }
  }
  // bits especiais
  const arr = s.split('');
  if (mode & S_ISUID) arr[3] = (arr[3] === 'x') ? 's' : 'S';
  if (mode & S_ISGID) arr[6] = (arr[6] === 'x') ? 's' : 'S';
  if (mode & S_ISVTX) arr[9] = (arr[9] === 'x') ? 't' : 'T';
  return arr.join('');
}
LX.modeToRwx = modeToRwx;

/* ---------- ACLs POSIX (setfacl / getfacl) ----------
   node.acl        : entradas nomeadas [{tag:'u'|'g', id, bits}]
   node.aclGroupObj: permissões do grupo dono (os bits de grupo do mode viram a máscara)
   Regra POSIX: dono → user_obj; usuário nomeado → entrada & máscara;
   senão classe de grupo (grupo dono + grupos nomeados) & máscara; senão other. */
function aclBits(node, ctx, perm) {
  if (node.uid === ctx.uid) return (perm >> 6) & 7;
  const mask = (perm >> 3) & 7;
  const nomeado = node.acl.find(e => e.tag === 'u' && e.id === ctx.uid);
  if (nomeado) return nomeado.bits & mask;
  const noGrupo = (gid) => gid === ctx.gid || (ctx.groups || []).includes(gid);
  let classe = -1;
  if (noGrupo(node.gid)) classe = (node.aclGroupObj != null ? node.aclGroupObj : mask);
  for (const e of node.acl) {
    if (e.tag === 'g' && noGrupo(e.id)) classe = (classe < 0 ? 0 : classe) | e.bits;
  }
  if (classe >= 0) return classe & mask;
  return perm & 7;
}
LX.aclBits = aclBits;
LX.temACL = (node) => !!(node && node.acl && node.acl.length);

/* ---------- Sistema de arquivos ---------- */
class FileSystem {
  constructor() {
    this.root = new Inode('dir', 0o755, 0, 0);
    this.root.parent = null;
    this.root.name = '';
    this.mounts = [];       // pontos de montagem (informativo, para df/mount/lsblk)
    this.totalBlocks = 20 * 1024 * 1024; // 20 GiB em KiB
    this.usedBlocks = 3_100_000;
  }

  /* Normaliza um caminho textual (não resolve links) */
  static normalize(path, cwd = '/') {
    if (!path) path = '.';
    let p = path.startsWith('/') ? path : (cwd === '/' ? '/' + path : cwd + '/' + path);
    const parts = p.split('/');
    const out = [];
    for (const seg of parts) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') { out.pop(); continue; }
      out.push(seg);
    }
    return '/' + out.join('/');
  }

  static dirname(p) {
    const n = FileSystem.normalize(p);
    if (n === '/') return '/';
    const i = n.lastIndexOf('/');
    return i === 0 ? '/' : n.slice(0, i);
  }
  static basename(p) {
    const n = FileSystem.normalize(p);
    if (n === '/') return '/';
    return n.slice(n.lastIndexOf('/') + 1);
  }
  static join(...parts) {
    return FileSystem.normalize(parts.filter(Boolean).join('/'));
  }

  /* Caminho absoluto de um inode (subindo por parent).
     A parada também acontece quando o inode não tem pai: isso vale para a
     raiz de OUTRO sistema de arquivos, que aparece aqui quando um diretório
     do host está montado dentro de um container (ver montarGraft). */
  pathOf(node) {
    const parts = [];
    let cur = node;
    while (cur && cur !== this.root && cur.parent) { parts.unshift(cur.name); cur = cur.parent; }
    return '/' + parts.join('/');
  }

  /* ---- Montagem de um diretório de OUTRO sistema de arquivos ----
     É assim que um volume ou um bind mount do host aparece dentro do
     container: o caminho `prefixo` deste sistema de arquivos passa a ser
     resolvido em `fsOrigem`, a partir de `destino`. Os inodes são os
     mesmos objetos, então escrever de um lado é ver do outro — que é
     exatamente o que uma montagem faz de verdade. */
  montarGraft(prefixo, fsOrigem, destino, extra = {}) {
    this.grafts = this.grafts || [];
    const p = FileSystem.normalize(prefixo);
    this.grafts = this.grafts.filter(g => g.prefix !== p);
    this.grafts.push(Object.assign({ prefix: p, fs: fsOrigem, target: FileSystem.normalize(destino) }, extra));
    /* mais específico primeiro: /dados/cache antes de /dados */
    this.grafts.sort((a, b) => b.prefix.length - a.prefix.length);
    return this.grafts[this.grafts.length - 1];
  }
  desmontarGraft(prefixo) {
    if (!this.grafts) return;
    const p = FileSystem.normalize(prefixo);
    this.grafts = this.grafts.filter(g => g.prefix !== p);
  }
  /* Qual montagem cobre este caminho? (usada por df, mount e docker inspect) */
  graftDe(caminho) {
    if (!this.grafts) return null;
    const n = FileSystem.normalize(caminho);
    for (const g of this.grafts) if (n === g.prefix || n.startsWith(g.prefix + '/')) return g;
    return null;
  }

  /* ---- Raiz somente leitura (`docker run --read-only`) ----
     Um container com a raiz somente leitura ainda pode escrever nos pontos
     de montagem (volumes, bind mounts, tmpfs) — é exatamente assim que o
     kernel se comporta, e é o que torna a opção usável na prática. */
  _checarEscrita(caminho, opts = {}) {
    if (!this.somenteLeitura) return;
    const n = FileSystem.normalize(caminho, opts.cwd || '/');
    if (this.graftDe(n)) return;
    for (const t of (this.tmpfs || [])) if (n === t || n.startsWith(t + '/')) return;
    throw new SysError('EROFS', n);
  }

  /* ---- Verificação de permissão ---- */
  can(node, want, ctx) {
    // ctx: {uid, gid, groups:[gids]}
    if (!ctx) return true;
    if (ctx.uid === 0) {
      // root ignora r/w; para x precisa de ao menos um bit x (comportamento real)
      if (want === 'x' && node.type !== 'dir') return (node.mode & 0o111) !== 0;
      return true;
    }
    const perm = node.mode & 0o777;
    let bits;
    if (node.acl && node.acl.length) bits = aclBits(node, ctx, perm);
    else if (node.uid === ctx.uid) bits = (perm >> 6) & 7;
    else if (node.gid === ctx.gid || (ctx.groups || []).includes(node.gid)) bits = (perm >> 3) & 7;
    else bits = perm & 7;
    if (want === 'r') return (bits & 4) !== 0;
    if (want === 'w') return (bits & 2) !== 0;
    if (want === 'x') return (bits & 1) !== 0;
    return false;
  }

  /* ---- Resolução de caminho ----
     opts: { cwd, ctx, follow (segue link final), nofollowParent }
     Retorna { node, parent, name, path }  (node pode ser null se não existir) */
  lookup(path, opts = {}) {
    const cwd = opts.cwd || '/';
    const ctx = opts.ctx;
    const follow = opts.follow !== false;
    let abs = path.startsWith('/') ? path : (cwd.endsWith('/') ? cwd + path : cwd + '/' + path);

    /* Um caminho montado de outro sistema de arquivos (volume ou bind mount
       de um container) é resolvido lá, não aqui. O inode devolvido é o mesmo
       objeto que o host enxerga — por isso o dado sobrevive ao container. */
    if (this.grafts && this.grafts.length) {
      const norm = FileSystem.normalize(abs, cwd);
      for (const g of this.grafts) {
        if (norm === g.prefix || norm.startsWith(g.prefix + '/')) {
          const resto = norm.slice(g.prefix.length);
          const r = g.fs.lookup(FileSystem.normalize(g.target + (resto || '')), { cwd: '/', ctx, follow });
          return { node: r.node, parent: r.parent, name: r.name, path: norm, graft: g, dangling: r.dangling, via: r.via };
        }
      }
    }

    const segs = abs.split('/').filter(s => s !== '' && s !== '.');
    let cur = this.root;
    let parent = null;
    let name = '/';
    let hops = 0;

    for (let i = 0; i < segs.length; i++) {
      let seg = segs[i];
      const isLast = i === segs.length - 1;
      if (seg === '..') {
        cur = cur.parent || this.root;
        parent = cur.parent; name = cur.name || '/';
        continue;
      }
      if (cur.type === 'link') {
        // resolve link intermediário
        const t = this.lookup(this.resolveLinkTarget(cur), { cwd: this.pathOf(cur.parent), ctx, follow: true });
        if (!t.node) throw new SysError('ENOENT', abs);
        cur = t.node;
      }
      if (cur.type !== 'dir') throw new SysError('ENOTDIR', this.pathOf(cur));
      if (ctx && !this.can(cur, 'x', ctx)) throw new SysError('EACCES', this.pathOf(cur));
      if (cur.dynDir) { try { cur.dynDir(); } catch (e) { } }   // /proc: reconcilia com a tabela de processos
      parent = cur;
      name = seg;
      const child = cur.children.get(seg);
      if (!child) {
        if (isLast) return { node: null, parent, name, path: FileSystem.normalize(abs, cwd) };
        throw new SysError('ENOENT', abs);
      }
      cur = child;
      // seguir symlink
      if (cur.type === 'link' && (!isLast || follow)) {
        if (++hops > 40) throw new SysError('ELOOP', abs);
        const base = this.pathOf(parent);
        const r = this.lookup(cur.target, { cwd: base, ctx, follow: true });
        if (!r.node) {
          if (isLast) return { node: null, parent: r.parent, name: r.name, path: r.path, dangling: true, via: cur };
          throw new SysError('ENOENT', abs);
        }
        cur = r.node;
        parent = r.parent;
      }
    }
    return { node: cur, parent: cur.parent, name: cur === this.root ? '/' : cur.name, path: this.pathOf(cur) };
  }

  resolveLinkTarget(node) { return node.target; }

  exists(path, opts) {
    try { const r = this.lookup(path, opts); return !!r.node; } catch (e) { return false; }
  }

  stat(path, opts = {}) {
    const r = this.lookup(path, opts);
    if (!r.node) throw new SysError('ENOENT', path);
    return r.node;
  }
  lstat(path, opts = {}) {
    const r = this.lookup(path, Object.assign({}, opts, { follow: false }));
    if (!r.node) {
      if (r.dangling) return r.via;
      throw new SysError('ENOENT', path);
    }
    return r.node;
  }

  /* ---- Criação ---- */
  mkdir(path, opts = {}) {
    const mode = opts.mode !== undefined ? opts.mode : (0o777 & ~(opts.umask !== undefined ? opts.umask : 0o022));
    this._checarEscrita(path, opts);
    const r = this.lookup(path, opts);
    if (r.node) throw new SysError('EEXIST', path);
    if (!r.parent) throw new SysError('ENOENT', path);
    if (opts.ctx && !this.can(r.parent, 'w', opts.ctx)) throw new SysError('EACCES', path);
    const n = new Inode('dir', mode, opts.ctx ? opts.ctx.uid : 0, opts.ctx ? opts.ctx.gid : 0);
    // SGID no diretório pai: o grupo é herdado e o próprio bit se propaga
    if (r.parent.mode & S_ISGID) { n.gid = r.parent.gid; n.mode |= S_ISGID; }
    n.parent = r.parent; n.name = r.name;
    r.parent.children.set(r.name, n);
    r.parent.mtime = Date.now();
    return n;
  }

  mkdirp(path, opts = {}) {
    this._checarEscrita(path, opts);
    const abs = FileSystem.normalize(path, opts.cwd || '/');
    const segs = abs.split('/').filter(Boolean);
    let cur = '/';
    let last = this.root;
    for (const s of segs) {
      cur = cur === '/' ? '/' + s : cur + '/' + s;
      const r = this.lookup(cur, opts);
      if (r.node) {
        if (r.node.type !== 'dir') throw new SysError('ENOTDIR', cur);
        last = r.node;
      } else {
        last = this.mkdir(cur, opts);
      }
    }
    return last;
  }

  create(path, content = '', opts = {}) {
    this._checarEscrita(path, opts);
    const r = this.lookup(path, opts);
    if (r.node) {
      if (r.node.type === 'dir') throw new SysError('EISDIR', path);
      if (opts.ctx && !this.can(r.node, 'w', opts.ctx)) throw new SysError('EACCES', path);
      r.node.write(content);
      return r.node;
    }
    if (!r.parent) throw new SysError('ENOENT', path);
    if (opts.ctx && !this.can(r.parent, 'w', opts.ctx)) throw new SysError('EACCES', path);
    const mode = opts.mode !== undefined ? opts.mode : (0o666 & ~(opts.umask !== undefined ? opts.umask : 0o022));
    const n = new Inode('file', mode, opts.ctx ? opts.ctx.uid : 0, opts.ctx ? opts.ctx.gid : 0);
    if (r.parent.mode & S_ISGID) n.gid = r.parent.gid;   // herança de grupo (SGID)
    n.parent = r.parent; n.name = r.name;
    n.write(content);
    r.parent.children.set(r.name, n);
    r.parent.mtime = Date.now();
    return n;
  }

  writeFile(path, content, opts = {}) { return this.create(path, content, opts); }

  appendFile(path, content, opts = {}) {
    this._checarEscrita(path, opts);
    const r = this.lookup(path, opts);
    if (r.node) {
      if (r.node.type === 'dir') throw new SysError('EISDIR', path);
      if (opts.ctx && !this.can(r.node, 'w', opts.ctx)) throw new SysError('EACCES', path);
      r.node.write(r.node.read() + content);
      return r.node;
    }
    return this.create(path, content, opts);
  }

  readFile(path, opts = {}) {
    const r = this.lookup(path, opts);
    if (!r.node) throw new SysError('ENOENT', path);
    if (r.node.type === 'dir') throw new SysError('EISDIR', path);
    if (opts.ctx && !this.can(r.node, 'r', opts.ctx)) throw new SysError('EACCES', path);
    r.node.atime = Date.now();
    return r.node.read();
  }

  symlink(target, path, opts = {}) {
    const r = this.lookup(path, Object.assign({}, opts, { follow: false }));
    if (r.node && !r.dangling) throw new SysError('EEXIST', path);
    if (!r.parent) throw new SysError('ENOENT', path);
    if (opts.ctx && !this.can(r.parent, 'w', opts.ctx)) throw new SysError('EACCES', path);
    const n = new Inode('link', 0o777, opts.ctx ? opts.ctx.uid : 0, opts.ctx ? opts.ctx.gid : 0);
    n.target = target;
    n.parent = r.parent; n.name = r.name;
    r.parent.children.set(r.name, n);
    return n;
  }

  link(oldPath, newPath, opts = {}) {
    const src = this.lookup(oldPath, opts);
    if (!src.node) throw new SysError('ENOENT', oldPath);
    if (src.node.type === 'dir') throw new SysError('EPERM', oldPath);
    const dst = this.lookup(newPath, opts);
    if (dst.node) throw new SysError('EEXIST', newPath);
    if (opts.ctx && !this.can(dst.parent, 'w', opts.ctx)) throw new SysError('EACCES', newPath);
    src.node.nlink++;
    // hard link: mesmo inode em dois lugares. Guardamos aliases.
    const alias = Object.create(src.node);
    // Precisamos que sejam realmente o mesmo objeto para refletir escritas:
    dst.parent.children.set(dst.name, src.node);
    src.node.aliases = src.node.aliases || [];
    src.node.aliases.push({ parent: dst.parent, name: dst.name });
    return src.node;
  }

  unlink(path, opts = {}) {
    this._checarEscrita(path, opts);
    const r = this.lookup(path, Object.assign({}, opts, { follow: false }));
    const node = r.node || (r.dangling ? r.via : null);
    if (!node) throw new SysError('ENOENT', path);
    if (node.type === 'dir' && !opts.allowDir) throw new SysError('EISDIR', path);
    const parent = r.parent || node.parent;
    if (opts.ctx && !this.can(parent, 'w', opts.ctx)) throw new SysError('EACCES', path);
    // sticky bit: só dono do arquivo ou do diretório pode remover
    if (opts.ctx && opts.ctx.uid !== 0 && (parent.mode & S_ISVTX)) {
      if (node.uid !== opts.ctx.uid && parent.uid !== opts.ctx.uid) throw new SysError('EACCES', path);
    }
    parent.children.delete(r.name !== undefined ? r.name : node.name);
    parent.mtime = Date.now();
    node.nlink = Math.max(0, node.nlink - 1);
    return true;
  }

  rmdir(path, opts = {}) {
    this._checarEscrita(path, opts);
    const r = this.lookup(path, opts);
    if (!r.node) throw new SysError('ENOENT', path);
    if (r.node.type !== 'dir') throw new SysError('ENOTDIR', path);
    if (r.node.children.size > 0) throw new SysError('ENOTEMPTY', path);
    if (r.node === this.root) throw new SysError('EBUSY', path);
    if (opts.ctx && !this.can(r.node.parent, 'w', opts.ctx)) throw new SysError('EACCES', path);
    r.node.parent.children.delete(r.node.name);
    return true;
  }

  rmrf(path, opts = {}) {
    const r = this.lookup(path, Object.assign({}, opts, { follow: false }));
    const node = r.node || (r.dangling ? r.via : null);
    if (!node) throw new SysError('ENOENT', path);
    if (node === this.root) throw new SysError('EPERM', path);
    return this.unlink(path, Object.assign({}, opts, { allowDir: true }));
  }

  rename(oldPath, newPath, opts = {}) {
    const src = this.lookup(oldPath, Object.assign({}, opts, { follow: false }));
    if (!src.node && !src.dangling) throw new SysError('ENOENT', oldPath);
    const node = src.node || src.via;
    let dst = this.lookup(newPath, Object.assign({}, opts, { follow: false }));
    if (dst.node && dst.node.type === 'dir' && node.type !== 'dir') {
      // mover para dentro do diretório
      dst = this.lookup(FileSystem.join(this.pathOf(dst.node), node.name), Object.assign({}, opts, { follow: false }));
    } else if (dst.node && dst.node.type === 'dir' && node.type === 'dir') {
      dst = this.lookup(FileSystem.join(this.pathOf(dst.node), node.name), Object.assign({}, opts, { follow: false }));
      if (dst.node) throw new SysError('ENOTEMPTY', newPath);
    }
    if (!dst.parent) throw new SysError('ENOENT', newPath);
    if (opts.ctx) {
      if (!this.can(src.parent, 'w', opts.ctx)) throw new SysError('EACCES', oldPath);
      if (!this.can(dst.parent, 'w', opts.ctx)) throw new SysError('EACCES', newPath);
    }
    src.parent.children.delete(src.name);
    node.parent = dst.parent; node.name = dst.name;
    dst.parent.children.set(dst.name, node);
    node.ctime = Date.now();
    return node;
  }

  copy(srcPath, dstPath, opts = {}) {
    const src = this.lookup(srcPath, Object.assign({}, opts, { follow: !opts.noDeref }));
    if (!src.node) throw new SysError('ENOENT', srcPath);
    if (opts.ctx && !this.can(src.node, 'r', opts.ctx)) throw new SysError('EACCES', srcPath);
    let dst = this.lookup(dstPath, opts);
    if (dst.node && dst.node.type === 'dir') {
      dst = this.lookup(FileSystem.join(this.pathOf(dst.node), src.node.name || FileSystem.basename(srcPath)), opts);
    }
    if (src.node.type === 'dir') {
      if (!opts.recursive) throw new SysError('EISDIR', srcPath);
      const newDir = dst.node && dst.node.type === 'dir' ? dst.node : this.mkdir(dst.path, opts);
      if (opts.preserve) { newDir.mode = src.node.mode; newDir.uid = src.node.uid; newDir.gid = src.node.gid; }
      for (const [name, child] of src.node.children) {
        this.copy(FileSystem.join(this.pathOf(src.node), name), FileSystem.join(this.pathOf(newDir), name), opts);
      }
      return newDir;
    }
    if (!dst.parent) throw new SysError('ENOENT', dstPath);
    if (opts.ctx && !this.can(dst.parent, 'w', opts.ctx)) throw new SysError('EACCES', dstPath);
    if (src.node.type === 'link' && opts.noDeref) {
      const n = new Inode('link', 0o777, opts.ctx ? opts.ctx.uid : 0, opts.ctx ? opts.ctx.gid : 0);
      n.target = src.node.target; n.parent = dst.parent; n.name = dst.name;
      dst.parent.children.set(dst.name, n);
      return n;
    }
    const n = new Inode('file', src.node.mode & 0o777, opts.ctx ? opts.ctx.uid : 0, opts.ctx ? opts.ctx.gid : 0);
    n.write(src.node.read());
    if (opts.preserve) { n.uid = src.node.uid; n.gid = src.node.gid; n.mtime = src.node.mtime; n.mode = src.node.mode; }
    n.parent = dst.parent; n.name = dst.name;
    dst.parent.children.set(dst.name, n);
    return n;
  }

  /* Lista ordenada de nomes de um diretório */
  /* ---- Montagem: a partição passa a fornecer o conteúdo do diretório ---- */
  montarParticao(pontoPath, part, opts = {}) {
    const r = this.lookup(pontoPath, opts);
    if (!r.node) throw new SysError('ENOENT', pontoPath);
    if (r.node.type !== 'dir') throw new SysError('ENOTDIR', pontoPath);
    if (!part.fsRoot) {
      part.fsRoot = new Inode('dir', 0o755, 0, 0);
      const lf = new Inode('dir', 0o700, 0, 0);
      lf.name = 'lost+found'; lf.parent = part.fsRoot;
      part.fsRoot.children.set('lost+found', lf);
    }
    r.node._preMount = r.node.children;
    r.node._modeAntes = r.node.mode;
    r.node.children = part.fsRoot.children;
    r.node.mode = part.fsRoot.mode;
    for (const c of r.node.children.values()) c.parent = r.node;
    r.node._particao = part;
    return true;
  }

  desmontarParticao(pontoPath, opts = {}) {
    const r = this.lookup(pontoPath, opts);
    if (!r.node || !r.node._particao) throw new SysError('EINVAL', pontoPath);
    const part = r.node._particao;
    part.fsRoot.children = r.node.children;
    for (const c of part.fsRoot.children.values()) c.parent = part.fsRoot;
    r.node.children = r.node._preMount || new Map();
    if (r.node._modeAntes !== undefined) r.node.mode = r.node._modeAntes;
    for (const c of r.node.children.values()) c.parent = r.node;
    delete r.node._particao; delete r.node._preMount; delete r.node._modeAntes;
    return true;
  }

  readdir(path, opts = {}) {
    const r = this.lookup(path, opts);
    if (!r.node) throw new SysError('ENOENT', path);
    if (r.node.type !== 'dir') throw new SysError('ENOTDIR', path);
    if (opts.ctx && !this.can(r.node, 'r', opts.ctx)) throw new SysError('EACCES', path);
    if (r.node.dynDir) { try { r.node.dynDir(); } catch (e) { } }
    return Array.from(r.node.children.keys()).sort((a, b) => a.localeCompare(b, 'en'));
  }

  /* Percorre recursivamente: callback(path, node, depth) */
  walk(path, cb, opts = {}, depth = 0) {
    const node = this.stat(path, opts);
    cb(FileSystem.normalize(path), node, depth);
    if (node.type === 'dir') {
      let names;
      try { names = Array.from(node.children.keys()).sort((a, b) => a.localeCompare(b, 'en')); }
      catch (e) { return; }
      for (const n of names) {
        try { this.walk(FileSystem.join(path, n), cb, opts, depth + 1); } catch (e) { /* ignora */ }
      }
    }
  }

  /* Uso de disco em blocos de 1K */
  duBlocks(node) {
    if (node.type === 'dir') {
      let total = 4;
      for (const c of node.children.values()) total += this.duBlocks(c);
      return total;
    }
    return Math.max(4, Math.ceil((node.size || 0) / 1024 / 4) * 4);
  }

  /* Snapshot leve (para checar desafios e restaurar cenários) */
  snapshot(node = this.root, name = '') {
    const o = { n: name, t: node.type, m: node.mode, u: node.uid, g: node.gid };
    if (node.type === 'dir') { o.c = Array.from(node.children.entries()).map(([k, v]) => this.snapshot(v, k)); }
    else if (node.type === 'link') o.l = node.target;
    else if (!node.dynamic) o.d = node.content;
    return o;
  }
  restore(snap, parent = null, name = '') {
    const n = new Inode(snap.t, snap.m, snap.u, snap.g);
    n.name = name; n.parent = parent;
    if (snap.t === 'dir') { for (const c of (snap.c || [])) { const ch = this.restore(c, n, c.n); n.children.set(c.n, ch); } }
    else if (snap.t === 'link') n.target = snap.l;
    else n.content = snap.d || '';
    if (parent === null) { this.root = n; n.name = ''; }
    return n;
  }
}
LX.FileSystem = FileSystem;
