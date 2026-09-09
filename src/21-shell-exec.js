/* =========================================================================
   TERMINALIS — Bash: expansões, aritmética, globbing e execução
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, SysError } = LX;

  const MAX_OUTPUT = 400000;
  const MAX_LOOPS = 100000;

  class OutputLimit extends Error { constructor() { super('saída muito grande'); this.isLimit = true; } }
  class LoopLimit extends Error { constructor() { super('laço interrompido: limite de iterações atingido'); this.isLimit = true; } }
  class ExitSignal { constructor(code) { this.code = code; this.isExit = true; } }
  class ReturnSignal { constructor(code) { this.code = code; this.isReturn = true; } }
  class BreakSignal { constructor(n) { this.n = n || 1; this.isBreak = true; } }
  class ContinueSignal { constructor(n) { this.n = n || 1; this.isContinue = true; } }
  class InterruptSignal { constructor() { this.isInterrupt = true; } }
  LX.ExitSignal = ExitSignal; LX.InterruptSignal = InterruptSignal;

  /* ------------------------------- Streams ------------------------------- */
  class Stream {
    constructor(opts = {}) {
      this.parts = [];
      this.onWrite = opts.onWrite || null;
      this.len = 0;
      this.limit = opts.limit || MAX_OUTPUT;
      this.isTTY = !!opts.isTTY;
      this.name = opts.name || '';
    }
    write(s) {
      if (s === undefined || s === null || s === '') return;
      s = String(s);
      this.len += s.length;
      if (this.len > this.limit) { this.parts.push(s.slice(0, Math.max(0, this.limit - (this.len - s.length)))); throw new OutputLimit(); }
      if (this.onWrite) this.onWrite(s, this);
      else this.parts.push(s);
    }
    line(s = '') { this.write(s + '\n'); }
    value() { return this.parts.join(''); }
  }
  class InStream {
    constructor(text = '') { this.text = text; this.pos = 0; }
    get eof() { return this.pos >= this.text.length; }
    readAll() { const s = this.text.slice(this.pos); this.pos = this.text.length; return s; }
    readLine() {
      if (this.eof) return null;
      const i = this.text.indexOf('\n', this.pos);
      if (i === -1) { const s = this.text.slice(this.pos); this.pos = this.text.length; return s; }
      const s = this.text.slice(this.pos, i); this.pos = i + 1; return s;
    }
    lines() { const all = this.readAll(); if (all === '') return []; return all.replace(/\n$/, '').split('\n'); }
  }
  LX.Stream = Stream; LX.InStream = InStream;

  /* --------------------------- Glob → RegExp --------------------------- */
  function globToRegex(pat, opts = {}) {
    let re = '';
    let i = 0;
    while (i < pat.length) {
      const c = pat[i];
      if (c === '\\') { re += escRe(pat[i + 1] || '\\'); i += 2; continue; }
      if (c === '*') { re += opts.path ? '[^/]*' : '.*'; i++; continue; }
      if (c === '?') { re += opts.path ? '[^/]' : '.'; i++; continue; }
      if (c === '[') {
        let j = i + 1, neg = false;
        if (pat[j] === '!' || pat[j] === '^') { neg = true; j++; }
        let cls = '';
        if (pat[j] === ']') { cls += '\\]'; j++; }
        while (j < pat.length && pat[j] !== ']') {
          if (pat[j] === '[' && pat[j + 1] === ':') {
            const end = pat.indexOf(':]', j);
            if (end > 0) {
              const nm = pat.slice(j + 2, end);
              const map = { alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', space: '\\s', upper: 'A-Z', lower: 'a-z', punct: '!-/:-@\\[-`{-~' };
              cls += map[nm] || '';
              j = end + 2; continue;
            }
          }
          cls += pat[j] === '\\' ? '\\\\' : (/[\]\\^]/.test(pat[j]) ? '\\' + pat[j] : pat[j]);
          j++;
        }
        re += '[' + (neg ? '^' : '') + cls + ']';
        i = j + 1;
        continue;
      }
      re += escRe(c);
      i++;
    }
    return new RegExp('^' + re + '$', opts.ci ? 'is' : 's');
  }
  function escRe(c) { return /[.*+?^${}()|[\]\\]/.test(c) ? '\\' + c : c; }
  function matchGlob(str, pat) { try { return globToRegex(pat).test(str); } catch (e) { return false; } }
  LX.matchGlob = matchGlob; LX.globToRegex = globToRegex;

  /* Remove prefixo/sufixo conforme padrão glob (${v#pat} etc) */
  function stripPattern(str, pat, { fromEnd = false, greedy = false }) {
    if (!pat) return str;
    const idxs = [];
    for (let k = 0; k <= str.length; k++) idxs.push(k);
    if (!fromEnd) {
      const cands = greedy ? idxs.slice().reverse() : idxs;
      for (const k of cands) if (matchGlob(str.slice(0, k), pat)) return str.slice(k);
    } else {
      const cands = greedy ? idxs : idxs.slice().reverse();
      for (const k of cands) if (matchGlob(str.slice(k), pat)) return str.slice(0, k);
    }
    return str;
  }

  /* ---------------------------- Aritmética ---------------------------- */
  function arith(expr, sh) {
    let s = String(expr);
    let pos = 0;
    const peek = () => { skipWs(); return s[pos]; };
    const skipWs = () => { while (pos < s.length && /\s/.test(s[pos])) pos++; };
    const eat = (str) => { skipWs(); if (s.startsWith(str, pos)) { pos += str.length; return true; } return false; };

    function getVal(name) {
      const v = sh.getVar(name);
      if (v === undefined || v === '') return 0;
      const n = Number(String(v).trim());
      if (!isNaN(n)) return n;
      // variável contendo outra expressão
      try { return arith(String(v), sh); } catch (e) { return 0; }
    }

    function primary() {
      skipWs();
      if (eat('(')) { const v = ternary(); eat(')'); return v; }
      if (eat('!')) return primary() ? 0 : 1;
      if (eat('~')) return ~primary();
      if (eat('-')) return -primary();
      if (eat('+')) return +primary();
      if (eat('++')) { const n = ident(); const v = getVal(n) + 1; sh.setVar(n, String(v)); return v; }
      if (eat('--')) { const n = ident(); const v = getVal(n) - 1; sh.setVar(n, String(v)); return v; }
      skipWs();
      const numMatch = /^(0[xX][0-9a-fA-F]+|0[0-7]+|\d+)/.exec(s.slice(pos));
      if (numMatch) {
        pos += numMatch[0].length;
        const t = numMatch[0];
        if (/^0[xX]/.test(t)) return parseInt(t, 16);
        if (/^0[0-7]+$/.test(t)) return parseInt(t, 8);
        return parseInt(t, 10);
      }
      if (s[pos] === '$') { pos++; return primary(); }
      const name = ident();
      if (name) {
        skipWs();
        // índice de array
        if (s[pos] === '[') {
          const close = s.indexOf(']', pos);
          const idxExpr = s.slice(pos + 1, close);
          pos = close + 1;
          const idx = arith(idxExpr, sh);
          const arr = sh.getArray(name);
          const val = arr ? arr[idx] : undefined;
          return val === undefined ? 0 : Number(val) || 0;
        }
        if (eat('++')) { const v = getVal(name); sh.setVar(name, String(v + 1)); return v; }
        if (eat('--')) { const v = getVal(name); sh.setVar(name, String(v - 1)); return v; }
        for (const op of ['+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '|=', '^=']) {
          if (s.startsWith(op, pos)) {
            pos += op.length;
            const rhs = ternary();
            const cur = getVal(name);
            let v;
            switch (op[0]) {
              case '+': v = cur + rhs; break; case '-': v = cur - rhs; break;
              case '*': v = cur * rhs; break; case '/': v = Math.trunc(cur / rhs); break;
              case '%': v = cur % rhs; break; case '&': v = cur & rhs; break;
              case '|': v = cur | rhs; break; case '^': v = cur ^ rhs; break;
              case '<': v = cur << rhs; break; case '>': v = cur >> rhs; break;
            }
            sh.setVar(name, String(v));
            return v;
          }
        }
        if (s[pos] === '=' && s[pos + 1] !== '=') { pos++; const v = ternary(); sh.setVar(name, String(v)); return v; }
        return getVal(name);
      }
      return 0;
    }
    function ident() {
      skipWs();
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(pos));
      if (!m) return null;
      pos += m[0].length;
      return m[0];
    }
    function power() { let l = primary(); skipWs(); if (eat('**')) { const r = power(); return Math.pow(l, r); } return l; }
    function mul() {
      let l = power();
      while (true) {
        skipWs();
        if (s.startsWith('*', pos) && !s.startsWith('**', pos) && s[pos + 1] !== '=') { pos++; l = l * power(); }
        else if (s[pos] === '/' && s[pos + 1] !== '=') { pos++; const r = power(); if (r === 0) throw new Error('division by 0'); l = Math.trunc(l / r); }
        else if (s[pos] === '%' && s[pos + 1] !== '=') { pos++; const r = power(); if (r === 0) throw new Error('division by 0'); l = l % r; }
        else break;
      }
      return l;
    }
    function add() {
      let l = mul();
      while (true) {
        skipWs();
        if (s[pos] === '+' && s[pos + 1] !== '+' && s[pos + 1] !== '=') { pos++; l = l + mul(); }
        else if (s[pos] === '-' && s[pos + 1] !== '-' && s[pos + 1] !== '=') { pos++; l = l - mul(); }
        else break;
      }
      return l;
    }
    function shift() {
      let l = add();
      while (true) { skipWs(); if (s.startsWith('<<', pos) && s[pos + 2] !== '=') { pos += 2; l = l << add(); } else if (s.startsWith('>>', pos) && s[pos + 2] !== '=') { pos += 2; l = l >> add(); } else break; }
      return l;
    }
    function rel() {
      let l = shift();
      while (true) {
        skipWs();
        if (s.startsWith('<=', pos)) { pos += 2; l = (l <= shift()) ? 1 : 0; }
        else if (s.startsWith('>=', pos)) { pos += 2; l = (l >= shift()) ? 1 : 0; }
        else if (s[pos] === '<' && s[pos + 1] !== '<') { pos++; l = (l < shift()) ? 1 : 0; }
        else if (s[pos] === '>' && s[pos + 1] !== '>') { pos++; l = (l > shift()) ? 1 : 0; }
        else break;
      }
      return l;
    }
    function eq() {
      let l = rel();
      while (true) { skipWs(); if (s.startsWith('==', pos)) { pos += 2; l = (l === rel()) ? 1 : 0; } else if (s.startsWith('!=', pos)) { pos += 2; l = (l !== rel()) ? 1 : 0; } else break; }
      return l;
    }
    function band() { let l = eq(); while (true) { skipWs(); if (s[pos] === '&' && s[pos + 1] !== '&' && s[pos + 1] !== '=') { pos++; l = l & eq(); } else break; } return l; }
    function bxor() { let l = band(); while (true) { skipWs(); if (s[pos] === '^' && s[pos + 1] !== '=') { pos++; l = l ^ band(); } else break; } return l; }
    function bor() { let l = bxor(); while (true) { skipWs(); if (s[pos] === '|' && s[pos + 1] !== '|' && s[pos + 1] !== '=') { pos++; l = l | bxor(); } else break; } return l; }
    function land() { let l = bor(); while (true) { skipWs(); if (s.startsWith('&&', pos)) { pos += 2; const r = bor(); l = (l && r) ? 1 : 0; } else break; } return l; }
    function lor() { let l = land(); while (true) { skipWs(); if (s.startsWith('||', pos)) { pos += 2; const r = land(); l = (l || r) ? 1 : 0; } else break; } return l; }
    function ternary() {
      const c = lor();
      skipWs();
      if (s[pos] === '?') { pos++; const a = ternary(); skipWs(); if (s[pos] === ':') pos++; const b = ternary(); return c ? a : b; }
      return c;
    }
    function comma() { let v = ternary(); while (true) { skipWs(); if (s[pos] === ',') { pos++; v = ternary(); } else break; } return v; }
    const r = comma();
    return isNaN(r) ? 0 : r;
  }
  LX.arith = arith;

  /* ---------------------------- Brace expansion ---------------------------- */
  function braceExpand(str) {
    const out = [];
    (function rec(s) {
      const start = findBraceStart(s);
      if (start === -1) { out.push(s); return; }
      const end = matchBrace(s, start);
      if (end === -1) { out.push(s); return; }
      const pre = s.slice(0, start), body = s.slice(start + 1, end), post = s.slice(end + 1);
      // sequência {1..5} ou {a..z} ou {1..10..2}
      const seq = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/.exec(body);
      const seqc = /^([A-Za-z])\.\.([A-Za-z])(?:\.\.(-?\d+))?$/.exec(body);
      if (seq) {
        let a = +seq[1], b = +seq[2], st = seq[3] ? Math.abs(+seq[3]) : 1;
        if (st === 0) st = 1;
        const pad = (seq[1].startsWith('0') && seq[1].length > 1) || (seq[2].startsWith('0') && seq[2].length > 1)
          ? Math.max(seq[1].replace('-', '').length, seq[2].replace('-', '').length) : 0;
        if (a <= b) for (let v = a; v <= b; v += st) rec(pre + (pad ? String(Math.abs(v)).padStart(pad, '0') : String(v)) + post);
        else for (let v = a; v >= b; v -= st) rec(pre + (pad ? String(Math.abs(v)).padStart(pad, '0') : String(v)) + post);
        return;
      }
      if (seqc) {
        let a = seqc[1].charCodeAt(0), b = seqc[2].charCodeAt(0), st = seqc[3] ? Math.abs(+seqc[3]) : 1;
        if (st === 0) st = 1;
        if (a <= b) for (let v = a; v <= b; v += st) rec(pre + String.fromCharCode(v) + post);
        else for (let v = a; v >= b; v -= st) rec(pre + String.fromCharCode(v) + post);
        return;
      }
      const parts = splitTopComma(body);
      if (parts.length < 2) { out.push(s.slice(0, start) + '{' + body + '}' + post); return; }
      for (const p of parts) rec(pre + p + post);
    })(str);
    return out;
  }
  function findBraceStart(s) {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '\\') { i++; continue; }
      if (s[i] === '{') {
        const e = matchBrace(s, i);
        if (e > i + 1) {
          const body = s.slice(i + 1, e);
          if (splitTopComma(body).length > 1 || /^-?\w+\.\.-?\w+/.test(body)) return i;
        }
      }
    }
    return -1;
  }
  function matchBrace(s, start) {
    let d = 0;
    for (let i = start; i < s.length; i++) {
      if (s[i] === '\\') { i++; continue; }
      if (s[i] === '{') d++;
      else if (s[i] === '}') { d--; if (d === 0) return i; }
    }
    return -1;
  }
  function splitTopComma(s) {
    const parts = []; let d = 0, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { cur += c + (s[i + 1] || ''); i++; continue; }
      if (c === '{') d++;
      if (c === '}') d--;
      if (c === ',' && d === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }
  LX.braceExpand = braceExpand;

  /* =========================== A SHELL =========================== */
  class Shell {
    constructor(machine, opts = {}) {
      this.m = machine;
      this.vars = new Map();
      this.arrays = new Map();
      this.funcs = new Map();
      this.aliases = new Map();
      this.cwd = opts.cwd || '/home/aluno';
      this.uid = opts.uid !== undefined ? opts.uid : 1000;
      this.gid = opts.gid !== undefined ? opts.gid : 1000;
      this.user = opts.user || 'aluno';
      this.umask = 0o022;
      this.lastStatus = 0;
      this.pipestatus = [0];
      this.opts = { e: false, u: false, x: false, pipefail: false, noglob: false, nounset: false, allexport: false };
      this.shopts = { globstar: false, extglob: true, nullglob: false, dotglob: false, histappend: true, checkwinsize: true };
      this.history = [];
      this.jobs = [];
      this.dirstack = [];
      this.positional = [];
      this.scriptName = 'bash';
      /* nome que o shell usa ao reclamar de um erro: dentro de um container
         Alpine, sem bash instalado, as mensagens começam com "sh:" */
      this.nomeShell = opts.nomeShell || 'bash';
      this.traps = {};
      this.funcDepth = 0;
      this.localStack = [];
      this.pid = machine ? ++machine.nextPid : 1234;
      this.lastBgPid = 0;
      this.exited = false;
      this.container = opts.container || null;  // quando estamos "dentro" de um container
      this.remote = opts.remote || null;        // sessão SSH remota
      this.env0();
      if (opts.env) for (const k in opts.env) this.setVar(k, opts.env[k], true);
    }

    env0() {
      const home = this.uid === 0 ? '/root' : `/home/${this.user}`;
      const base = {
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games',
        HOME: home, USER: this.user, LOGNAME: this.user, SHELL: '/bin/bash',
        PWD: this.cwd, OLDPWD: '', TERM: 'xterm-256color', LANG: 'pt_BR.UTF-8',
        HOSTNAME: this.m ? this.m.hostname : 'localhost', HISTSIZE: '1000', HISTFILESIZE: '2000',
        SHLVL: '1', IFS: ' \t\n', PS1: '\\u@\\h:\\w\\$ ', PS2: '> ',
        BASH: '/usr/bin/bash', BASH_VERSION: '5.3.0(1)-release', EDITOR: 'nano',
        LS_COLORS: 'di=01;34:ln=01;36:ex=01;32:*.tar=01;31', HISTFILE: home + '/.bash_history'
      };
      for (const k in base) this.setVar(k, base[k], true);
    }

    get ctx() { return { uid: this.uid, gid: this.gid, groups: this.m ? this.m.gidsOfUser(this.user) : [this.gid] }; }
    fsopts(extra) { return Object.assign({ cwd: this.cwd, ctx: this.ctx, umask: this.umask }, extra); }

    /* --------- variáveis --------- */
    setVar(name, value, exported) {
      const cur = this.vars.get(name);
      if (cur && cur.readonly) { const e = new Error(`${name}: readonly variable`); e.shellError = true; throw e; }
      this.vars.set(name, { value: String(value), exported: exported !== undefined ? exported : (cur ? cur.exported : (this.opts.allexport || false)), readonly: cur ? cur.readonly : false });
      if (name === 'PWD') this.cwd = String(value);
    }
    getVar(name) {
      // variáveis especiais geradas pelo shell
      if (name === 'RANDOM') return String(Math.floor(Math.random() * 32768));
      if (name === 'SECONDS') return String(Math.floor((Date.now() - (this._nascimento || (this._nascimento = Date.now()))) / 1000));
      if (name === 'EPOCHSECONDS') return String(Math.floor(Date.now() / 1000));
      if (name === 'LINENO') return '1';
      const v = this.vars.get(name);
      if (v) return v.value;
      if (this.arrays.has(name)) { const a = this.arrays.get(name); return a[0] !== undefined ? a[0] : ''; }
      return undefined;
    }
    unsetVar(name) { this.vars.delete(name); this.arrays.delete(name); }
    setArray(name, arr) { this.arrays.set(name, arr.slice()); this.vars.delete(name); }
    getArray(name) { return this.arrays.get(name) || (this.vars.has(name) ? [this.vars.get(name).value] : null); }
    envObject() {
      const o = {};
      for (const [k, v] of this.vars) if (v.exported) o[k] = v.value;
      return o;
    }
    exportedList() {
      return Array.from(this.vars.entries()).filter(([, v]) => v.exported).map(([k, v]) => `${k}=${v.value}`).sort();
    }

    clone(opts = {}) {
      const s = new Shell(this.m, { cwd: this.cwd, uid: this.uid, gid: this.gid, user: this.user, container: this.container, remote: this.remote, nomeShell: this.nomeShell });
      // opts.soExportadas: novo processo (bash -c, script) só herda o AMBIENTE
      if (opts.soExportadas) {
        s.vars = new Map();
        for (const [k, v] of this.vars) if (v && v.exported) s.vars.set(k, Object.assign({}, v));
        s.arrays = new Map();
        s.funcs = new Map();
        s.aliases = new Map();
        s.opts = Object.assign({}, this.opts);
        s.shopts = Object.assign({}, this.shopts);
        s.positional = [];
        s.umask = this.umask;
        s.history = this.history;
        s.jobs = this.jobs;
        s.lastStatus = 0;
        s.funcDepth = 0;
        const rest = Object.assign({}, opts); delete rest.soExportadas;
        Object.assign(s, rest);
        return s;
      }
      s.vars = new Map(Array.from(this.vars.entries()).map(([k, v]) => [k, Object.assign({}, v)]));
      s.arrays = new Map(Array.from(this.arrays.entries()).map(([k, v]) => [k, v.slice()]));
      s.funcs = new Map(this.funcs);
      s.aliases = new Map(this.aliases);
      s.opts = Object.assign({}, this.opts);
      s.shopts = Object.assign({}, this.shopts);
      s.positional = this.positional.slice();
      s.umask = this.umask;
      s.history = this.history;
      s.jobs = this.jobs;
      s.lastStatus = this.lastStatus;
      s.scriptName = this.scriptName;
      s.funcDepth = this.funcDepth;
      Object.assign(s, opts);
      return s;
    }

    /* --------- prompt --------- */
    prompt() {
      const host = this.m ? this.m.hostname : 'localhost';
      let w = this.cwd;
      const home = this.getVar('HOME');
      if (home && w.startsWith(home)) w = '~' + w.slice(home.length);
      if (this.container) return { user: 'root', host: this.container.id.slice(0, 12), cwd: w, sym: '#', container: true };
      if (this.remote) return { user: this.user, host: this.remote, cwd: w, sym: this.uid === 0 ? '#' : '$', remote: true };
      return { user: this.user, host, cwd: w, sym: this.uid === 0 ? '#' : '$' };
    }
  }
  LX.Shell = Shell;

  /* =========================== EXPANSÃO =========================== */
  class Expander {
    constructor(sh, io) { this.sh = sh; this.io = io; }

    async expandWords(words, opts = {}) {
      const out = [];
      for (const w of words) {
        const fields = await this.expandWord(w, opts);
        out.push(...fields);
      }
      return out;
    }

    /* Retorna array de strings */
    async expandWord(word, opts = {}) {
      const sh = this.sh;
      // 1. brace expansion (só quando há partes não citadas com chaves)
      let wordsToProcess = [word];
      if (!opts.noBrace) {
        const rawAll = word.parts.map(p => p.q === 'none' ? p.s : '\x00' + this._stash(p) + '\x00').join('');
        if (/\{/.test(word.parts.filter(p => p.q === 'none').map(p => p.s).join(''))) {
          const expanded = braceExpand(rawAll);
          if (expanded.length > 1) {
            wordsToProcess = expanded.map(txt => this._unstashWord(txt));
          }
        }
      }

      const results = [];
      for (const w of wordsToProcess) {
        const fields = [{ text: '', glob: false, quotedEmpty: false }];
        let sawQuote = false;
        for (const part of w.parts) {
          if (part.q === 'single' || part.q === 'esc') {
            sawQuote = true;
            fields[fields.length - 1].text += part.s;
            continue;
          }
          if (part.q === 'double') {
            sawQuote = true;
            const pieces = await this.expandDollars(part.s, true);
            // pieces: array (mais de um quando "$@")
            for (let k = 0; k < pieces.length; k++) {
              if (k > 0) fields.push({ text: '', glob: false });
              fields[fields.length - 1].text += pieces[k];
            }
            continue;
          }
          // não citado
          let expandedPieces = await this.expandDollars(part.s, false);
          for (let k = 0; k < expandedPieces.length; k++) {
            if (k > 0) fields.push({ text: '', glob: false });
            let txt = expandedPieces[k];
            // tilde no começo do primeiro pedaço
            if (fields[fields.length - 1].text === '' && txt.startsWith('~')) txt = this.tilde(txt);
            // split em IFS apenas se houve expansão
            const ifs = sh.getVar('IFS');
            const hadExpansion = /[$`]/.test(part.s);
            if (hadExpansion && ifs !== '' && !opts.noSplit) {
              const sep = new RegExp('[' + (ifs || ' \t\n').replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + ']+');
              const bits = txt.split(sep);
              for (let b = 0; b < bits.length; b++) {
                if (b > 0) fields.push({ text: '', glob: false });
                if (bits[b] === '' && bits.length > 1 && (b === 0 || b === bits.length - 1)) { if (b === bits.length - 1) fields.pop(); continue; }
                fields[fields.length - 1].text += bits[b];
                fields[fields.length - 1].glob = fields[fields.length - 1].glob || /[*?\[]/.test(bits[b]) === false ? fields[fields.length - 1].glob : true;
              }
            } else {
              fields[fields.length - 1].text += txt;
            }
            if (/[*?\[]/.test(part.s)) fields[fields.length - 1].glob = true;
          }
          continue;
        }
        for (const f of fields) {
          if (f.text === '' && !sawQuote && fields.length === 1 && w.parts.length > 0 && w.parts.every(p => p.q === 'none')) {
            // resultado vazio de expansão não citada -> some
            if (/[$`]/.test(w.raw)) continue;
          }
          if (f.text === '' && fields.length > 1) continue;
          if (f.glob && !sh.opts.noglob && !opts.noGlob) {
            const g = this.glob(f.text);
            if (g.length) { results.push(...g); continue; }
          }
          results.push(f.text);
        }
      }
      return results;
    }

    _stash(part) {
      this._stashed = this._stashed || [];
      this._stashed.push(part);
      return String(this._stashed.length - 1);
    }
    _unstashWord(txt) {
      const parts = [];
      const re = /\x00(\d+)\x00/g;
      let last = 0, m;
      while ((m = re.exec(txt))) {
        if (m.index > last) parts.push({ q: 'none', s: txt.slice(last, m.index) });
        parts.push(this._stashed[+m[1]]);
        last = m.index + m[0].length;
      }
      if (last < txt.length) parts.push({ q: 'none', s: txt.slice(last) });
      return new LX.Word(parts);
    }

    tilde(txt) {
      const sh = this.sh;
      if (txt === '~' || txt.startsWith('~/')) return (sh.getVar('HOME') || '/') + txt.slice(1);
      const m = /^~([A-Za-z0-9_.-]+)(\/.*)?$/.exec(txt);
      if (m) {
        const u = sh.m && sh.m.userByName(m[1]);
        if (u) return u.home + (m[2] || '');
      }
      if (txt.startsWith('~+')) return sh.cwd + txt.slice(2);
      if (txt.startsWith('~-')) return (sh.getVar('OLDPWD') || sh.cwd) + txt.slice(2);
      return txt;
    }

    glob(pattern) {
      const sh = this.sh;
      if (!/[*?\[]/.test(pattern)) return [];
      const isAbs = pattern.startsWith('/');
      const segs = pattern.split('/').filter((s, i) => !(i === 0 && s === ''));
      let bases = [isAbs ? '/' : ''];
      for (let si = 0; si < segs.length; si++) {
        const seg = segs[si];
        const next = [];
        const isLast = si === segs.length - 1;
        for (const base of bases) {
          if (!/[*?\[]/.test(seg)) {
            const p = base === '' ? seg : (base === '/' ? '/' + seg : base + '/' + seg);
            next.push(p);
            continue;
          }
          const dirPath = base === '' ? sh.cwd : (base === '/' ? '/' : FileSystem.normalize(base, sh.cwd));
          let names;
          try { names = sh.m.fs.readdir(dirPath, sh.fsopts()); } catch (e) { continue; }
          const re = globToRegex(seg, { path: true });
          for (const nm of names) {
            if (nm.startsWith('.') && !seg.startsWith('.') && !sh.shopts.dotglob) continue;
            if (!re.test(nm)) continue;
            const full = base === '' ? nm : (base === '/' ? '/' + nm : base + '/' + nm);
            if (!isLast) {
              try { const st = sh.m.fs.stat(full, sh.fsopts()); if (st.type !== 'dir') continue; } catch (e) { continue; }
            }
            next.push(full);
          }
        }
        bases = next;
      }
      // valida existência
      const out = bases.filter(p => { try { sh.m.fs.lstat(p, sh.fsopts()); return true; } catch (e) { return false; } });
      out.sort((a, b) => a.localeCompare(b, 'en'));
      return out;
    }

    /* Expande $, ${}, $(), $(( )), ` ` dentro de uma string.
       Retorna array de campos (mais de um só quando "$@"). */
    async expandDollars(s, inQuotes) {
      const sh = this.sh;
      let out = [''];
      const push = (t) => { out[out.length - 1] += t; };
      let i = 0;
      while (i < s.length) {
        const c = s[i];
        if (c === '\\' && inQuotes) {
          const nx = s[i + 1];
          if ('"$`\\'.includes(nx)) { push(nx); i += 2; continue; }
          push(c); i++; continue;
        }
        if (c === '`') {
          let j = i + 1, cmd = '';
          while (j < s.length && s[j] !== '`') { if (s[j] === '\\') { cmd += s[j + 1]; j += 2; continue; } cmd += s[j]; j++; }
          push(await this.cmdSubst(cmd));
          i = j + 1; continue;
        }
        if (c !== '$') { push(c); i++; continue; }
        // $
        const nx = s[i + 1];
        if (nx === undefined) { push('$'); i++; continue; }
        if (nx === '(') {
          if (s[i + 2] === '(') {
            const close = findClose(s, i + 2, '(', ')');
            const inner = s.slice(i + 3, close - 1);
            if (s.slice(close, close + 1) === ')') {
              push(String(arith(await this.expandForArith(inner), sh)));
              i = close + 1; continue;
            }
            push(String(arith(await this.expandForArith(inner), sh)));
            i = close; continue;
          }
          const close = findClose(s, i + 1, '(', ')');
          const cmd = s.slice(i + 2, close - 1);
          push(await this.cmdSubst(cmd));
          i = close; continue;
        }
        if (nx === '{') {
          const close = findClose(s, i + 1, '{', '}');
          const body = s.slice(i + 2, close - 1);
          const r = await this.expandBraceParam(body, inQuotes);
          if (Array.isArray(r)) {
            for (let k = 0; k < r.length; k++) { if (k > 0) out.push(''); push(r[k]); }
          } else push(r);
          i = close; continue;
        }
        if (nx === '@' || nx === '*') {
          const args = sh.positional;
          if (inQuotes && nx === '@') { for (let k = 0; k < args.length; k++) { if (k > 0) out.push(''); push(args[k]); } if (args.length === 0) { /* nada */ } }
          else if (nx === '*') push(args.join((sh.getVar('IFS') || ' ')[0] || ' '));
          else push(args.join(' '));
          i += 2; continue;
        }
        if (/[0-9]/.test(nx)) {
          let j = i + 1, num = '';
          while (j < s.length && /[0-9]/.test(s[j])) { num += s[j]; j++; }
          const idx = +num;
          push(idx === 0 ? sh.scriptName : (sh.positional[idx - 1] !== undefined ? sh.positional[idx - 1] : ''));
          i = j; continue;
        }
        if (nx === '?') { push(String(sh.lastStatus)); i += 2; continue; }
        if (nx === '#') { push(String(sh.positional.length)); i += 2; continue; }
        if (nx === '$') { push(String(sh.pid)); i += 2; continue; }
        if (nx === '!') { push(String(sh.lastBgPid || '')); i += 2; continue; }
        if (nx === '-') { push(Object.keys(sh.opts).filter(k => sh.opts[k]).join('') + 'himBH'); i += 2; continue; }
        if (nx === '_') { push(sh.getVar('_') || ''); i += 2; continue; }
        if (/[A-Za-z_]/.test(nx)) {
          let j = i + 1, name = '';
          while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) { name += s[j]; j++; }
          // índice de array sem chaves não é válido em bash; nome puro
          let v = sh.getVar(name);
          if (v === undefined) {
            if (sh.opts.u || sh.opts.nounset) { const e = new Error(`${name}: unbound variable`); e.shellError = true; e.status = 1; throw e; }
            v = '';
          }
          push(v);
          i = j; continue;
        }
        push('$'); i++;
      }
      return out;
    }

    async expandForArith(inner) {
      const pieces = await this.expandDollars(inner, true);
      return pieces.join(' ');
    }

    async cmdSubst(cmd) {
      const sub = this.sh.clone();
      const outStream = new Stream({ limit: MAX_OUTPUT });
      const io = { stdin: new InStream(''), stdout: outStream, stderr: this.io.stderr, term: this.io.term };
      const ex = new LX.Executor(sub, io);
      try { await ex.run(cmd); } catch (e) { if (e && e.isExit) { } else if (e && e.isLimit) { } else if (e && e.isInterrupt) throw e; else if (e && e.shellError) this.io.stderr.write((this.sh.nomeShell + ': ') + e.message + '\n'); else throw e; }
      this.sh.lastStatus = sub.lastStatus;
      return outStream.value().replace(/\n+$/, '');
    }

    async expandBraceParam(body, inQuotes) {
      const sh = this.sh;
      // ${#nome}, ${#nome[@]}
      if (body.startsWith('#') && body.length > 1) {
        const nm = body.slice(1);
        if (nm === '@' || nm === '*') return String(sh.positional.length);
        const am = /^([A-Za-z_][A-Za-z0-9_]*)\[[@*]\]$/.exec(nm);
        if (am) { const a = sh.getArray(am[1]); return String(a ? a.filter(x => x !== undefined).length : 0); }
        const v = sh.getVar(nm);
        return String((v === undefined ? '' : v).length);
      }
      // ${!nome}  indireção  /  ${!arr[@]} índices  /  ${!prefixo*}
      if (body.startsWith('!')) {
        const nm = body.slice(1);
        const am = /^([A-Za-z_][A-Za-z0-9_]*)\[[@*]\]$/.exec(nm);
        if (am) { const a = sh.getArray(am[1]) || []; return a.map((_, k) => String(k)).filter((_, k) => a[k] !== undefined); }
        if (nm.endsWith('*') || nm.endsWith('@')) {
          const pre = nm.slice(0, -1);
          return Array.from(sh.vars.keys()).filter(k => k.startsWith(pre)).sort();
        }
        const target = sh.getVar(nm);
        return target === undefined ? '' : (sh.getVar(target) || '');
      }
      // arrays: ${arr[@]}, ${arr[*]}, ${arr[2]}
      const arrM = /^([A-Za-z_][A-Za-z0-9_]*)\[(.+)\]$/.exec(body);
      if (arrM && sh.arrays.has(arrM[1])) {
        const arr = sh.arrays.get(arrM[1]);
        const idx = arrM[2];
        if (idx === '@' || idx === '*') {
          const vals = arr.filter(x => x !== undefined);
          if (idx === '*' && inQuotes) return vals.join(' ');
          return vals;
        }
        const n = arith(idx, sh);
        return arr[n < 0 ? arr.length + n : n] !== undefined ? arr[n < 0 ? arr.length + n : n] : '';
      }
      // operadores
      const m = /^([A-Za-z_][A-Za-z0-9_]*|[@*#?$!0-9]+)(.*)$/s.exec(body);
      if (!m) return '';
      const name = m[1];
      let rest = m[2];
      let val;
      if (name === '@' || name === '*') val = sh.positional.join(' ');
      else if (/^\d+$/.test(name)) val = sh.positional[+name - 1];
      else if (name === '?') val = String(sh.lastStatus);
      else if (name === '#') val = String(sh.positional.length);
      else if (name === '$') val = String(sh.pid);
      else val = sh.getVar(name);

      if (rest === '') {
        if (val === undefined) {
          if (sh.opts.u || sh.opts.nounset) { const e = new Error(`${name}: unbound variable`); e.shellError = true; throw e; }
          return '';
        }
        return val;
      }
      const isSet = val !== undefined && val !== null;
      const isNonEmpty = isSet && val !== '';

      let mm;
      if ((mm = /^:-(.*)$/s.exec(rest))) return isNonEmpty ? val : (await this.expandDollars(mm[1], inQuotes)).join(' ');
      if ((mm = /^-(.*)$/s.exec(rest))) return isSet ? val : (await this.expandDollars(mm[1], inQuotes)).join(' ');
      if ((mm = /^:=(.*)$/s.exec(rest))) { if (isNonEmpty) return val; const d = (await this.expandDollars(mm[1], inQuotes)).join(' '); sh.setVar(name, d); return d; }
      if ((mm = /^=(.*)$/s.exec(rest))) { if (isSet) return val; const d = (await this.expandDollars(mm[1], inQuotes)).join(' '); sh.setVar(name, d); return d; }
      if ((mm = /^:\?(.*)$/s.exec(rest))) { if (isNonEmpty) return val; const e = new Error(`${name}: ${mm[1] || 'parameter null or not set'}`); e.shellError = true; e.status = 1; throw e; }
      if ((mm = /^\?(.*)$/s.exec(rest))) { if (isSet) return val; const e = new Error(`${name}: ${mm[1] || 'parameter null or not set'}`); e.shellError = true; e.status = 1; throw e; }
      if ((mm = /^:\+(.*)$/s.exec(rest))) return isNonEmpty ? (await this.expandDollars(mm[1], inQuotes)).join(' ') : '';
      if ((mm = /^\+(.*)$/s.exec(rest))) return isSet ? (await this.expandDollars(mm[1], inQuotes)).join(' ') : '';
      if ((mm = /^##(.*)$/s.exec(rest))) return stripPattern(val || '', (await this.expandDollars(mm[1], true)).join(''), { greedy: true });
      if ((mm = /^#(.*)$/s.exec(rest))) return stripPattern(val || '', (await this.expandDollars(mm[1], true)).join(''), {});
      if ((mm = /^%%(.*)$/s.exec(rest))) return stripPattern(val || '', (await this.expandDollars(mm[1], true)).join(''), { fromEnd: true, greedy: true });
      if ((mm = /^%(.*)$/s.exec(rest))) return stripPattern(val || '', (await this.expandDollars(mm[1], true)).join(''), { fromEnd: true });
      if ((mm = /^\/\/(.*)$/s.exec(rest))) return await this.substPattern(val || '', mm[1], true);
      if ((mm = /^\/#(.*)$/s.exec(rest))) { const [p, r] = splitUnescaped(mm[1], '/'); const re = globToRegex(p); const s2 = String(val || ''); return re.test(s2.slice(0, p.length)) ? (r || '') + s2.slice(p.length) : s2; }
      if ((mm = /^\/(.*)$/s.exec(rest))) return await this.substPattern(val || '', mm[1], false);
      if ((mm = /^\^\^(.*)$/s.exec(rest))) return String(val || '').toUpperCase();
      if ((mm = /^\^(.*)$/s.exec(rest))) { const s2 = String(val || ''); return s2.charAt(0).toUpperCase() + s2.slice(1); }
      if ((mm = /^,,(.*)$/s.exec(rest))) return String(val || '').toLowerCase();
      if ((mm = /^,(.*)$/s.exec(rest))) { const s2 = String(val || ''); return s2.charAt(0).toLowerCase() + s2.slice(1); }
      if ((mm = /^:(.+)$/s.exec(rest))) {
        const parts = splitUnescaped(mm[1], ':');
        const off = arith(parts[0], sh);
        const s2 = String(val || '');
        if (parts.length > 1) {
          const len = arith(parts[1], sh);
          return len < 0 ? s2.slice(off < 0 ? s2.length + off : off, s2.length + len) : s2.substr(off < 0 ? s2.length + off : off, len);
        }
        return off < 0 ? s2.slice(s2.length + off) : s2.slice(off);
      }
      return val === undefined ? '' : val;
    }

    async substPattern(val, spec, all) {
      const [pat, rep] = splitUnescaped(spec, '/');
      const p = (await this.expandDollars(pat, true)).join('');
      const r = rep === undefined ? '' : (await this.expandDollars(rep, true)).join('');
      let src = String(val);
      const reBody = globToRegex(p).source.replace(/^\^/, '').replace(/\$$/, '');
      try {
        const re = new RegExp(reBody, all ? 'gs' : 's');
        return src.replace(re, r.replace(/\$/g, '$$$$'));
      } catch (e) { return src; }
    }
  }

  function splitUnescaped(s, ch) {
    const out = []; let cur = '';
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '\\') { cur += s[i + 1] || ''; i++; continue; }
      if (s[i] === ch) { out.push(cur); cur = ''; continue; }
      cur += s[i];
    }
    out.push(cur);
    return out;
  }
  function findClose(s, start, open, close) {
    let d = 0;
    for (let i = start; i < s.length; i++) {
      if (s[i] === '\\') { i++; continue; }
      if (s[i] === "'" && open !== '{') { i++; while (i < s.length && s[i] !== "'") i++; continue; }
      if (s[i] === open) d++;
      else if (s[i] === close) { d--; if (d === 0) return i + 1; }
    }
    return s.length;
  }

  LX.Expander = Expander;
  LX.OutputLimit = OutputLimit;
  LX.LoopLimit = LoopLimit;
  LX.ReturnSignal = ReturnSignal;
  LX.BreakSignal = BreakSignal;
  LX.ContinueSignal = ContinueSignal;
  LX.stripPattern = stripPattern;
})();
