/* =========================================================================
   TERMINALIS — Bash: análise léxica e sintática
   ========================================================================= */
'use strict';
(function () {

  class ParseError extends Error {
    constructor(msg, near) { super(msg); this.near = near; this.isParseError = true; }
  }
  LX.ParseError = ParseError;

  const OPERATORS = ['<<<', '&>>', '>>', '<<-', '<<', '&&', '||', ';;', '>&', '<&', '>|', '&>', '|&', '|', '&', ';', '(', ')', '<', '>', '\n'];

  const RESERVED = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'while', 'until', 'do', 'done',
    'case', 'esac', 'in', 'function', 'select', 'time', '{', '}', '!', '[[', ']]']);

  /* Uma "palavra" é uma lista de pedaços com informação de aspas. */
  class Word {
    constructor(parts) { this.parts = parts || []; }
    get raw() { return this.parts.map(p => p.s).join(''); }
    get literal() { return this.parts.map(p => p.s).join(''); }
    get isQuoted() { return this.parts.some(p => p.q !== 'none'); }
    get plain() { // texto sem aspas, sem expansão (usado para palavras reservadas)
      return this.parts.every(p => p.q === 'none') ? this.raw : null;
    }
  }
  LX.Word = Word;

  /* ------------------------------ TOKENIZER ------------------------------ */
  function tokenize(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    const heredocQueue = [];

    function pushOp(op) { toks.push({ type: 'op', value: op }); }

    while (i < n) {
      const c = src[i];

      // comentário
      if (c === '#' && (toks.length === 0 || toks[toks.length - 1].type === 'op' || /\s/.test(src[i - 1] || ' '))) {
        while (i < n && src[i] !== '\n') i++;
        continue;
      }
      // espaço
      if (c === ' ' || c === '\t') { i++; continue; }
      // continuação de linha
      if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
      // nova linha
      if (c === '\n') {
        i++;
        pushOp('\n');
        // ler heredocs pendentes
        while (heredocQueue.length) {
          const hd = heredocQueue.shift();
          const lines = [];
          while (i < n) {
            let j = src.indexOf('\n', i);
            if (j === -1) j = n;
            let line = src.slice(i, j);
            i = j + 1;
            const cmp = hd.strip ? line.replace(/^\t+/, '') : line;
            if (cmp === hd.delim) { hd.found = true; break; }
            lines.push(hd.strip ? line.replace(/^\t+/, '') : line);
          }
          hd.token.heredoc = lines.length ? lines.join('\n') + '\n' : '';
        }
        continue;
      }

      // operadores
      let matched = null;
      for (const op of OPERATORS) {
        if (op !== '\n' && src.startsWith(op, i)) {
          // não confundir "2>" (tratado como redirecionamento com fd)
          matched = op; break;
        }
      }
      // fd numérico antes de redirecionamento: 2> 2>> 1>&2 etc
      const fdMatch = /^(\d+)(>>|>&|<&|>\||>|<)/.exec(src.slice(i));
      if (fdMatch && (toks.length === 0 || true)) {
        const prevChar = src[i - 1];
        if (prevChar === undefined || /[\s;&|()<>]/.test(prevChar)) {
          toks.push({ type: 'op', value: fdMatch[2], fd: +fdMatch[1] });
          i += fdMatch[0].length;
          continue;
        }
      }
      if (matched) {
        i += matched.length;
        if (matched === '<<' || matched === '<<-') {
          // heredoc: próxima palavra é o delimitador
          let j = i;
          while (j < n && /\s/.test(src[j]) && src[j] !== '\n') j++;
          let delim = '', quoted = false;
          if (src[j] === '"' || src[j] === "'") {
            const q = src[j]; quoted = true; j++;
            while (j < n && src[j] !== q) { delim += src[j]; j++; }
            j++;
          } else {
            while (j < n && /[^\s;&|<>\n]/.test(src[j])) { delim += src[j]; j++; }
          }
          i = j;
          const tok = { type: 'op', value: '<<', delim, quoted, heredoc: '' };
          toks.push(tok);
          heredocQueue.push({ delim, strip: matched === '<<-', token: tok, quoted });
          continue;
        }
        pushOp(matched);
        continue;
      }

      // palavra
      const parts = [];
      let cur = '', curQ = 'none';
      const flush = () => { if (cur !== '') { parts.push({ q: curQ, s: cur }); cur = ''; } };
      let consumed = false;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\' && curQ === 'none') {
          if (src[i + 1] === '\n') { i += 2; continue; }
          flush(); parts.push({ q: 'esc', s: src[i + 1] === undefined ? '\\' : src[i + 1] });
          i += 2; consumed = true; continue;
        }
        if (ch === '\\' && curQ === 'double') {
          const nx = src[i + 1];
          if ('"$`\\\n'.includes(nx)) {
            if (nx === '\n') { i += 2; continue; }
            flush(); parts.push({ q: 'esc', s: nx }); i += 2; consumed = true; continue;
          }
          cur += ch; i++; consumed = true; continue;
        }
        // $'...'  — aspas ANSI-C: interpreta \n, \t, \\ etc. (usado em IFS=$'\n\t')
        if (ch === '$' && src[i + 1] === "'" && curQ === 'none') {
          flush();
          i += 2;
          let cru = '';
          while (i < n && src[i] !== "'") {
            if (src[i] === '\\' && i + 1 < n) { cru += src[i] + src[i + 1]; i += 2; continue; }
            cru += src[i]; i++;
          }
          i++;
          const mapa = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '0': '\0', e: '\x1b', E: '\x1b', '\\': '\\', "'": "'", '"': '"' };
          const texto = cru.replace(/\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{4}|.)/g, (m, g) => {
            if (g[0] === 'x') return String.fromCharCode(parseInt(g.slice(1), 16));
            if (g[0] === 'u') return String.fromCharCode(parseInt(g.slice(1), 16));
            return mapa[g] !== undefined ? mapa[g] : g;
          });
          parts.push({ q: 'single', s: texto });
          consumed = true;
          continue;
        }
        if (ch === "'" && curQ === 'none') {
          flush();
          i++;
          let s = '';
          while (i < n && src[i] !== "'") { s += src[i]; i++; }
          i++;
          parts.push({ q: 'single', s });
          consumed = true;
          continue;
        }
        if (ch === '"' && curQ === 'none') {
          flush();
          i++;
          curQ = 'double';
          let s = '';
          let depth = 0;
          while (i < n) {
            if (src[i] === '\\' && '"$`\\\n'.includes(src[i + 1])) {
              if (src[i + 1] === '\n') { i += 2; continue; }
              s += '\\' + src[i + 1]; i += 2; continue;
            }
            if (src[i] === '"') break;
            if (src[i] === '$' && src[i + 1] === '(') {
              const sub = readBalanced(src, i + 1, '(', ')');
              s += src.slice(i, sub.end); i = sub.end; continue;
            }
            if (src[i] === '`') {
              let j = i + 1; let bs = '`';
              while (j < n && src[j] !== '`') { if (src[j] === '\\') { bs += src[j] + (src[j + 1] || ''); j += 2; continue; } bs += src[j]; j++; }
              bs += '`'; i = j + 1; s += bs; continue;
            }
            s += src[i]; i++;
          }
          i++;
          parts.push({ q: 'double', s });
          curQ = 'none';
          consumed = true;
          continue;
        }
        if (ch === '(' && /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=$/.test(parts.map(x => x.s).join('') + cur)) {
          const sub = readBalanced(src, i, '(', ')');
          flush(); parts.push({ q: 'none', s: src.slice(i, sub.end) });
          i = sub.end; consumed = true; continue;
        }
        if (ch === '$' && src[i + 1] === '(') {
          const sub = readBalanced(src, i + 1, '(', ')');
          flush(); parts.push({ q: 'none', s: src.slice(i, sub.end) });
          i = sub.end; consumed = true; continue;
        }
        if (ch === '$' && src[i + 1] === '{') {
          const sub = readBalanced(src, i + 1, '{', '}');
          flush(); parts.push({ q: 'none', s: src.slice(i, sub.end) });
          i = sub.end; consumed = true; continue;
        }
        if (ch === '`') {
          let j = i + 1; let bs = '`';
          while (j < n && src[j] !== '`') { if (src[j] === '\\') { bs += src[j] + (src[j + 1] || ''); j += 2; continue; } bs += src[j]; j++; }
          bs += '`';
          flush(); parts.push({ q: 'none', s: bs });
          i = j + 1; consumed = true; continue;
        }
        // fim de palavra?
        if (/[\s;&|<>()]/.test(ch)) break;
        if (ch === '\n') break;
        cur += ch; i++; consumed = true;
      }
      flush();
      if (!consumed && parts.length === 0) { i++; continue; }
      toks.push({ type: 'word', word: new Word(parts) });
    }
    toks.push({ type: 'eof' });
    return toks;
  }
  LX.tokenize = tokenize;

  function readBalanced(src, start, open, close) {
    // src[start] === open
    let depth = 0, i = start;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === "'" ) { i++; while (i < src.length && src[i] !== "'") i++; i++; continue; }
      if (c === '"') { i++; while (i < src.length && src[i] !== '"') { if (src[i] === '\\') i++; i++; } i++; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) return { end: i + 1 }; }
      i++;
    }
    return { end: src.length };
  }

  /* ------------------------------ PARSER ------------------------------ */
  class Parser {
    constructor(toks) { this.toks = toks; this.pos = 0; }
    peek(k = 0) { return this.toks[this.pos + k]; }
    next() { return this.toks[this.pos++]; }
    at(type, value) {
      const t = this.peek();
      if (!t || t.type !== type) return false;
      if (value !== undefined) {
        if (type === 'op') return t.value === value;
        if (type === 'word') return t.word.plain === value;
      }
      return true;
    }
    atWord(...vals) { const t = this.peek(); return t && t.type === 'word' && vals.includes(t.word.plain); }
    expectWord(v) {
      if (!this.atWord(v)) throw new ParseError(`syntax error near unexpected token \`${this.peek() && (this.peek().type === 'word' ? this.peek().word.raw : this.peek().value) || 'newline'}'`);
      return this.next();
    }
    skipNewlines() { while (this.at('op', '\n') || this.at('op', ';')) this.next(); }
    skipOnlyNewlines() { while (this.at('op', '\n')) this.next(); }

    parseProgram() {
      const list = this.parseList(['eof']);
      return { type: 'program', body: list };
    }

    parseList(stopWords) {
      const items = [];
      this.skipNewlines();
      while (!this.at('eof')) {
        if (stopWords && this.peek().type === 'word' && stopWords.includes(this.peek().word.plain)) break;
        if (stopWords && stopWords.includes(')') && this.at('op', ')')) break;
        if (this.at('op', ';;')) break;
        const andOr = this.parseAndOr();
        if (!andOr) break;
        let sep = 'seq';
        if (this.at('op', '&')) { this.next(); sep = 'bg'; }
        else if (this.at('op', ';')) { this.next(); }
        items.push({ node: andOr, sep });
        this.skipNewlines();
      }
      return { type: 'list', items };
    }

    parseAndOr() {
      let left = this.parsePipeline();
      if (!left) return null;
      while (this.at('op', '&&') || this.at('op', '||')) {
        const op = this.next().value;
        this.skipOnlyNewlines();
        const right = this.parsePipeline();
        left = { type: 'andor', op, left, right };
      }
      return left;
    }

    parsePipeline() {
      let bang = false;
      if (this.atWord('!')) { this.next(); bang = true; }
      if (this.atWord('time')) { this.next(); }
      const cmds = [];
      let c = this.parseCommand();
      if (!c) return null;
      cmds.push(c);
      while (this.at('op', '|') || this.at('op', '|&')) {
        const both = this.next().value === '|&';
        this.skipOnlyNewlines();
        const nx = this.parseCommand();
        if (!nx) throw new ParseError("syntax error near unexpected token `|'");
        nx.pipeStderr = both;
        cmds.push(nx);
      }
      if (cmds.length === 1 && !bang) return cmds[0];
      return { type: 'pipeline', cmds, bang };
    }

    parseCommand() {
      const t = this.peek();
      if (!t || t.type === 'eof') return null;
      if (t.type === 'op' && (t.value === '\n' || t.value === ';')) return null;

      if (t.type === 'word') {
        const w = t.word.plain;
        switch (w) {
          case 'if': return this.parseIf();
          case 'while': return this.parseWhileUntil('while');
          case 'until': return this.parseWhileUntil('until');
          case 'for': return this.parseFor();
          case 'case': return this.parseCase();
          case '{': return this.parseBraceGroup();
          case '[[': return this.parseDoubleBracket();
          case 'function': return this.parseFunctionDef();
        }
        // definição de função:  nome() { ... }
        if (this.peek(1) && this.peek(1).type === 'op' && this.peek(1).value === '(' &&
          this.peek(2) && this.peek(2).type === 'op' && this.peek(2).value === ')') {
          return this.parseFunctionDef();
        }
      }
      /* `(( expr ))` é um comando aritmético: avalia e devolve 0 se o
         resultado for diferente de zero. É o que faz `((i++))` e
         `while (( i < 10 ))` funcionarem. */
      if (t.type === 'op' && t.value === '(' && this.peek(1) && this.peek(1).type === 'op' && this.peek(1).value === '(') {
        const salvo = this.i;
        const arit = this.parseAritmetico();
        if (arit) return arit;
        this.i = salvo;
      }
      if (t.type === 'op' && t.value === '(') return this.parseSubshell();
      return this.parseSimple();
    }

    /* Junta tudo entre `((` e `))` de volta numa expressão de texto. */
    parseAritmetico() {
      this.next(); this.next();                 // consome os dois '('
      const partes = [];
      let profundidade = 0;
      while (true) {
        const t = this.peek();
        if (!t || t.type === 'eof') return null;
        if (t.type === 'op' && t.value === '(') { profundidade++; partes.push('('); this.next(); continue; }
        if (t.type === 'op' && t.value === ')') {
          if (profundidade > 0) { profundidade--; partes.push(')'); this.next(); continue; }
          const seg = this.peek(1);
          if (!seg || seg.type !== 'op' || seg.value !== ')') return null;
          this.next(); this.next();             // consome os dois ')'
          const redirs = [];
          this.parseRedirects(redirs);
          return { type: 'aritmetico', expr: partes.join(' '), redirs };
        }
        /* dentro de (( )) os operadores são aritméticos, não do shell:
           `<` e `>` são comparação, não redirecionamento */
        if (t.type === 'op') { partes.push(String(t.value)); this.next(); continue; }
        if (t.type !== 'word') return null;
        partes.push(t.word.raw);
        this.next();
      }
    }

    parseRedirects(redirs) {
      let found = false;
      while (true) {
        const t = this.peek();
        if (!t || t.type !== 'op') break;
        if (['>', '>>', '<', '<<', '>&', '<&', '&>', '&>>', '<<<', '>|'].includes(t.value)) {
          this.next();
          const r = { op: t.value, fd: t.fd };
          if (t.value === '<<') { r.heredoc = t.heredoc; r.delim = t.delim; r.quoted = t.quoted; }
          else {
            const target = this.peek();
            if (!target || target.type !== 'word') throw new ParseError('syntax error near unexpected token `newline\'');
            this.next();
            r.target = target.word;
          }
          redirs.push(r);
          found = true;
          continue;
        }
        break;
      }
      return found;
    }

    parseSimple() {
      const words = [];
      const assigns = [];
      const redirs = [];
      let seenWord = false;
      while (true) {
        if (this.parseRedirects(redirs)) continue;
        const t = this.peek();
        if (!t || t.type !== 'word') break;
        const plain = t.word.plain;
        if (!seenWord) {
          const as = assignSplit(t.word);
          if (as) { this.next(); assigns.push(as); continue; }
        }
        if (seenWord === false && RESERVED.has(plain) && ['then', 'fi', 'do', 'done', 'else', 'elif', 'esac', '}', ']]'].includes(plain)) break;
        this.next();
        words.push(t.word);
        seenWord = true;
      }
      if (words.length === 0 && assigns.length === 0 && redirs.length === 0) return null;
      return { type: 'simple', words, assigns, redirs };
    }

    parseIf() {
      this.expectWord('if');
      const cond = this.parseList(['then']);
      this.expectWord('then');
      const then = this.parseList(['elif', 'else', 'fi']);
      let elseBranch = null;
      if (this.atWord('elif')) {
        // trata como if aninhado
        const sub = this.parseIfFromElif();
        elseBranch = { type: 'list', items: [{ node: sub, sep: 'seq' }] };
      } else if (this.atWord('else')) {
        this.next();
        elseBranch = this.parseList(['fi']);
      }
      this.expectWord('fi');
      const node = { type: 'if', cond, then, else: elseBranch, redirs: [] };
      this.parseRedirects(node.redirs);
      return node;
    }
    parseIfFromElif() {
      this.expectWord('elif');
      const cond = this.parseList(['then']);
      this.expectWord('then');
      const then = this.parseList(['elif', 'else', 'fi']);
      let elseBranch = null;
      if (this.atWord('elif')) {
        const sub = this.parseIfFromElif();
        elseBranch = { type: 'list', items: [{ node: sub, sep: 'seq' }] };
      } else if (this.atWord('else')) {
        this.next();
        elseBranch = this.parseList(['fi']);
      }
      return { type: 'if', cond, then, else: elseBranch, redirs: [] };
    }

    parseWhileUntil(kind) {
      this.expectWord(kind);
      const cond = this.parseList(['do']);
      this.expectWord('do');
      const body = this.parseList(['done']);
      this.expectWord('done');
      const node = { type: kind, cond, body, redirs: [] };
      this.parseRedirects(node.redirs);
      return node;
    }

    parseFor() {
      this.expectWord('for');
      // for ((init; cond; step))
      if (this.at('op', '(') && this.peek(1) && this.peek(1).type === 'op' && this.peek(1).value === '(') {
        // reconstroi texto aritmético
        this.next(); this.next();
        let depth = 2, txt = '';
        while (!this.at('eof')) {
          const t = this.next();
          if (t.type === 'op' && t.value === ')') { depth--; if (depth === 0) break; txt += ')'; continue; }
          if (t.type === 'op' && t.value === '(') { depth++; txt += '('; continue; }
          txt += (t.type === 'word' ? t.word.raw : t.value) + ' ';
        }
        const parts = txt.split(';');
        this.skipNewlines();
        this.expectWord('do');
        const body = this.parseList(['done']);
        this.expectWord('done');
        return { type: 'cfor', init: parts[0] || '', cond: parts[1] || '1', step: parts[2] || '', body, redirs: [] };
      }
      const varTok = this.next();
      if (!varTok || varTok.type !== 'word') throw new ParseError("syntax error near unexpected token `for'");
      const name = varTok.word.plain;
      let items = null;
      this.skipOnlyNewlines();
      if (this.atWord('in')) {
        this.next();
        items = [];
        while (this.peek().type === 'word' && !['do'].includes(this.peek().word.plain)) items.push(this.next().word);
      }
      this.skipNewlines();
      this.expectWord('do');
      const body = this.parseList(['done']);
      this.expectWord('done');
      const node = { type: 'for', name, items, body, redirs: [] };
      this.parseRedirects(node.redirs);
      return node;
    }

    parseCase() {
      this.expectWord('case');
      const subject = this.next().word;
      this.skipOnlyNewlines();
      this.expectWord('in');
      this.skipNewlines();
      const clauses = [];
      while (!this.atWord('esac') && !this.at('eof')) {
        if (this.at('op', '(')) this.next();
        const pats = [];
        while (true) {
          const t = this.peek();
          if (!t || t.type !== 'word') break;
          pats.push(this.next().word);
          if (this.at('op', '|')) { this.next(); continue; }
          break;
        }
        if (this.at('op', ')')) this.next();
        const body = this.parseList(['esac']);
        if (this.at('op', ';;')) this.next();
        this.skipNewlines();
        clauses.push({ pats, body });
      }
      this.expectWord('esac');
      const node = { type: 'case', subject, clauses, redirs: [] };
      this.parseRedirects(node.redirs);
      return node;
    }

    parseBraceGroup() {
      this.expectWord('{');
      const body = this.parseList(['}']);
      this.expectWord('}');
      const node = { type: 'group', body, redirs: [] };
      this.parseRedirects(node.redirs);
      return node;
    }

    parseSubshell() {
      this.next(); // (
      const body = this.parseList([')']);
      if (this.at('op', ')')) this.next();
      const node = { type: 'subshell', body, redirs: [] };
      this.parseRedirects(node.redirs);
      return node;
    }

    parseDoubleBracket() {
      this.expectWord('[[');
      const words = [];
      let depth = 0;
      while (!this.at('eof')) {
        const t = this.peek();
        if (t.type === 'word' && t.word.plain === ']]') { this.next(); break; }
        if (t.type === 'op' && t.value === '\n') { this.next(); continue; }
        if (t.type === 'op') { this.next(); words.push({ op: t.value }); continue; }
        this.next(); words.push({ word: t.word });
      }
      const node = { type: 'dbracket', words, redirs: [] };
      this.parseRedirects(node.redirs);
      return node;
    }

    parseFunctionDef() {
      let name;
      if (this.atWord('function')) {
        this.next();
        name = this.next().word.plain;
        if (this.at('op', '(')) { this.next(); if (this.at('op', ')')) this.next(); }
      } else {
        name = this.next().word.plain;
        this.next(); this.next(); // ( )
      }
      this.skipNewlines();
      let body;
      if (this.atWord('{')) body = this.parseBraceGroup();
      else body = { type: 'group', body: { type: 'list', items: [{ node: this.parseCommand(), sep: 'seq' }] }, redirs: [] };
      return { type: 'funcdef', name, body };
    }
  }

  /* Detecta NOME=valor no início de um comando, mesmo quando o valor está
     entre aspas (NOME="Ana Maria"). O nome só pode vir de pedaços sem aspas. */
  function assignSplit(word) {
    const parts = word.parts || [];
    let name = '';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.q !== 'none') return null;
      const eq = p.s.indexOf('=');
      if (eq < 0) { name += p.s; continue; }
      name += p.s.slice(0, eq);
      if (!/^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?$/.test(name)) return null;
      const rest = [];
      const tail = p.s.slice(eq + 1);
      if (tail) rest.push({ q: 'none', s: tail });
      for (let j = i + 1; j < parts.length; j++) rest.push(parts[j]);
      return { name: name.replace(/\+$/, ''), append: /\+$/.test(name), word: new LX.Word(rest) };
    }
    return null;
  }

  function sliceWordAfter(word, idx) {
    // Reconstrói a Word a partir do índice de caractere idx (do texto plano)
    const parts = [];
    let consumed = 0;
    for (const p of word.parts) {
      const len = p.s.length + (p.q === 'single' ? 2 : p.q === 'double' ? 2 : p.q === 'esc' ? 1 : 0);
      if (consumed + len <= idx) { consumed += len; continue; }
      if (consumed >= idx) { parts.push(p); consumed += len; continue; }
      const cut = idx - consumed;
      parts.push({ q: p.q, s: p.s.slice(cut) });
      consumed += len;
    }
    return new LX.Word(parts);
  }

  LX.parse = function (src) {
    const p = new Parser(tokenize(src));
    return p.parseProgram();
  };
  LX.Parser = Parser;
})();
