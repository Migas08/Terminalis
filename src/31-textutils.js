/* =========================================================================
   TERMINALIS — grep, find, sed, awk, xargs, diff e amigos
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, SysError, defcmd, getopt, C } = LX;
  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }

  /* Converte ERE/BRE POSIX para RegExp do JS */
  function posixToJs(pat, extended) {
    let out = '';
    for (let i = 0; i < pat.length; i++) {
      const c = pat[i];
      if (c === '\\') {
        const n = pat[i + 1];
        if (!extended && '(){}|+?'.includes(n)) { out += n === '{' || n === '}' ? n : n; i++; continue; }
        if (n === '<' || n === '>') { out += '\\b'; i++; continue; }
        if (n === 'b') { out += '\\b'; i++; continue; }
        out += '\\' + n; i++; continue;
      }
      if (!extended && '(){}|+?'.includes(c)) { out += '\\' + c; continue; }
      if (c === '[') {
        const end = findClassEnd(pat, i);
        let cls = pat.slice(i, end + 1);
        cls = cls.replace(/\[:alpha:\]/g, 'a-zA-Z').replace(/\[:digit:\]/g, '0-9')
          .replace(/\[:alnum:\]/g, 'a-zA-Z0-9').replace(/\[:space:\]/g, '\\s')
          .replace(/\[:upper:\]/g, 'A-Z').replace(/\[:lower:\]/g, 'a-z')
          .replace(/\[:punct:\]/g, '!-\\/:-@\\[-`{-~').replace(/\[:blank:\]/g, ' \\t')
          .replace(/\[:xdigit:\]/g, '0-9a-fA-F');
        out += cls;
        i = end;
        continue;
      }
      out += c;
    }
    return out;
  }
  function findClassEnd(s, start) {
    let i = start + 1;
    if (s[i] === '^') i++;
    if (s[i] === ']') i++;
    while (i < s.length && s[i] !== ']') {
      if (s[i] === '[' && s[i + 1] === ':') { const e = s.indexOf(':]', i); if (e > 0) { i = e + 2; continue; } }
      i++;
    }
    return i;
  }
  LX.posixToJs = posixToJs;

  function makeRe(pat, { extended = true, ci = false, fixed = false, word = false, line = false, global = false } = {}) {
    let src = fixed ? pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : posixToJs(pat, extended);
    if (word) src = '\\b(?:' + src + ')\\b';
    if (line) src = '^(?:' + src + ')$';
    return new RegExp(src, (ci ? 'i' : '') + (global ? 'g' : ''));
  }
  LX.makeRe = makeRe;

  /* ================================ grep ================================ */
  defcmd({
    name: ['grep', 'egrep', 'fgrep'], path: '/usr/bin/', pkg: 'grep',
    run: async ({ sh, io, args, name }) => {
      const { opts, rest } = getopt(args, {
        i: 0, v: 0, n: 0, c: 0, l: 0, L: 0, r: 0, R: 0, w: 0, x: 0, E: 0, F: 0, o: 0, q: 0, h: 0, H: 0, s: 0,
        e: 1, f: 1, A: 1, B: 1, C: 1, m: 1, '--color': 1, '--include': 1, '--exclude': 1,
        '--ignore-case': 0, '--invert-match': 0, '--line-number': 0, '--recursive': 0, '--count': 0,
        '--files-with-matches': 0, '--word-regexp': 0, '--only-matching': 0, '--quiet': 0, '--help': 0, '--extended-regexp': 0, '--fixed-strings': 0
      });
      if (opts['--help']) { io.stdout.write(HELP_GREP); return 0; }
      let patterns = [];
      if (opts.e) patterns.push(opts.e);
      if (opts.f) { try { patterns.push(...sh.m.fs.readFile(P(sh, opts.f), sh.fsopts()).split('\n').filter(Boolean)); } catch (e) { } }
      let files = rest.slice();
      if (!patterns.length) {
        if (!files.length) { io.stderr.write('Usage: grep [OPTION]... PATTERNS [FILE]...\nTry \'grep --help\' for more information.\n'); return 2; }
        patterns.push(files.shift());
      }
      const extended = name === 'egrep' || opts.E || opts['--extended-regexp'];
      const fixed = name === 'fgrep' || opts.F || opts['--fixed-strings'];
      const ci = opts.i || opts['--ignore-case'];
      const invert = opts.v || opts['--invert-match'];
      const showNum = opts.n || opts['--line-number'];
      const recursive = opts.r || opts.R || opts['--recursive'];
      const onlyMatch = opts.o || opts['--only-matching'];
      const useColor = opts['--color'] && opts['--color'] !== 'never' || opts['--color'] === undefined && false;
      const colorOn = opts['--color'] === 'always' || opts['--color'] === 'auto' || opts['--color'] === true;
      const after = +(opts.A || opts.C || 0), before = +(opts.B || opts.C || 0);
      const maxCount = opts.m ? +opts.m : Infinity;
      let res;
      try {
        res = patterns.map(p => makeRe(p, { extended, ci, fixed, word: opts.w || opts['--word-regexp'], line: opts.x, global: true }));
      } catch (e) { io.stderr.write(`grep: ${e.message}\n`); return 2; }

      const targets = [];
      if (!files.length) targets.push(null);
      else {
        for (const f of files) {
          const path = P(sh, f);
          let st;
          try { st = sh.m.fs.stat(path, sh.fsopts()); }
          catch (e) { if (!opts.s) io.stderr.write(`grep: ${f}: ${e.message}\n`); continue; }
          if (st.type === 'dir') {
            if (!recursive) { io.stderr.write(`grep: ${f}: Is a directory\n`); continue; }
            sh.m.fs.walk(path, (p, n) => {
              if (n.type !== 'file') return;
              if (opts['--include'] && !LX.matchGlob(FileSystem.basename(p), opts['--include'])) return;
              if (opts['--exclude'] && LX.matchGlob(FileSystem.basename(p), opts['--exclude'])) return;
              targets.push(p);
            }, sh.fsopts());
          } else targets.push(path);
        }
      }
      const showName = (targets.length > 1 || recursive || opts.H) && !opts.h;
      let anyMatch = false;
      let totalCount = 0;
      for (const t of targets) {
        let data;
        if (t === null) data = io.stdin ? io.stdin.readAll() : '';
        else { try { data = sh.m.fs.readFile(t, sh.fsopts()); } catch (e) { if (!opts.s) io.stderr.write(`grep: ${t}: ${e.message}\n`); continue; } }
        const lines = data.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        let count = 0;
        const label = t === null ? '(standard input)' : relLabel(sh, t, files);
        const printed = new Set();
        const emit = (i, isMatch) => {
          if (printed.has(i)) return;
          printed.add(i);
          let text = lines[i];
          if (colorOn && isMatch && !invert) {
            for (const re of res) { re.lastIndex = 0; text = text.replace(new RegExp(re.source, re.flags), m => `${C.red}${C.bold}${m}${C.reset}`); }
          }
          io.stdout.write((showName ? (colorOn ? C.magenta + label + C.reset + C.cyan + ':' + C.reset : label + (isMatch ? ':' : '-')) : '') + (showNum ? (isMatch ? i + 1 + ':' : i + 1 + '-') : '') + text + '\n');
        };
        for (let i = 0; i < lines.length; i++) {
          const matched = res.some(re => { re.lastIndex = 0; return re.test(lines[i]); });
          const hit = invert ? !matched : matched;
          if (!hit) continue;
          count++; anyMatch = true;
          if (count > maxCount) break;
          if (opts.q || opts['--quiet']) return 0;
          if (opts.l || opts['--files-with-matches']) { io.stdout.write(label + '\n'); break; }
          if (opts.L) break;
          if (opts.c || opts['--count']) continue;
          if (onlyMatch) {
            for (const re of res) { re.lastIndex = 0; let m; const rg = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); while ((m = rg.exec(lines[i]))) { io.stdout.write((showName ? label + ':' : '') + (showNum ? (i + 1) + ':' : '') + m[0] + '\n'); if (m.index === rg.lastIndex) rg.lastIndex++; } }
            continue;
          }
          for (let b = Math.max(0, i - before); b < i; b++) emit(b, false);
          emit(i, true);
          for (let a = i + 1; a <= Math.min(lines.length - 1, i + after); a++) emit(a, false);
        }
        totalCount += count;
        if (opts.c || opts['--count']) io.stdout.write((showName ? label + ':' : '') + count + '\n');
        if (opts.L && count === 0) io.stdout.write(label + '\n');
      }
      if (opts.q || opts['--quiet']) return anyMatch ? 0 : 1;
      return anyMatch ? 0 : 1;
    }
  });
  function relLabel(sh, abs, origFiles) {
    for (const f of origFiles) {
      const base = P(sh, f);
      if (abs === base) return f;
      if (abs.startsWith(base + '/')) return (f === '.' ? '' : f.replace(/\/$/, '') + '/') + abs.slice(base.length + 1);
    }
    return abs;
  }
  const HELP_GREP = `Uso: grep [OPÇÃO]... PADRÕES [ARQUIVO]...
Procura por PADRÕES em cada ARQUIVO.

  -E, --extended-regexp     PADRÕES são expressões regulares estendidas (ERE)
  -F, --fixed-strings       PADRÕES são strings literais
  -i, --ignore-case         ignora maiúsculas/minúsculas
  -v, --invert-match        seleciona as linhas que NÃO correspondem
  -n, --line-number         mostra o número da linha
  -c, --count               mostra apenas a contagem de linhas
  -l, --files-with-matches  mostra apenas os nomes dos arquivos com correspondência
  -o, --only-matching       mostra apenas a parte que corresponde
  -r, --recursive           procura recursivamente nos diretórios
  -w, --word-regexp         corresponde apenas a palavras inteiras
  -A NUM                    mostra NUM linhas depois da correspondência
  -B NUM                    mostra NUM linhas antes
  -C NUM                    mostra NUM linhas antes e depois
      --color=WHEN          colore a saída (always, never, auto)

Código de saída: 0 se encontrou, 1 se não encontrou, 2 em caso de erro.
`;

  /* ================================ find ================================ */
  defcmd({
    name: 'find', path: '/usr/bin/find', pkg: 'findutils',
    run: async ({ sh, io, args, ex }) => {
      const paths = [];
      let i = 0;
      while (i < args.length && !args[i].startsWith('-') && !['(', ')', '!'].includes(args[i])) { paths.push(args[i]); i++; }
      if (!paths.length) paths.push('.');
      const expr = args.slice(i);
      if (expr.includes('--help')) { io.stdout.write(HELP_FIND); return 0; }

      // testes suportados
      const tests = [];
      const actions = [];
      let maxdepth = Infinity, mindepth = 0;
      for (let k = 0; k < expr.length; k++) {
        const a = expr[k];
        switch (a) {
          case '-name': { const p = expr[++k]; tests.push(n => LX.matchGlob(n.name, p)); break; }
          case '-iname': { const p = expr[++k].toLowerCase(); tests.push(n => LX.matchGlob(n.name.toLowerCase(), p)); break; }
          case '-path': case '-wholename': { const p = expr[++k]; tests.push(n => LX.matchGlob(n.path, p) || LX.matchGlob(n.rel, p)); break; }
          case '-type': { const t = expr[++k]; const map = { f: 'file', d: 'dir', l: 'link', b: 'blk', c: 'chr', p: 'fifo', s: 'sock' }; tests.push(n => n.node.type === map[t]); break; }
          case '-size': {
            const spec = expr[++k];
            const m = /^([+-]?)(\d+)([ckMGb]?)$/.exec(spec);
            if (m) {
              const mult = { c: 1, b: 512, k: 1024, M: 1048576, G: 1073741824, '': 512 }[m[3]];
              const v = +m[2] * mult;
              tests.push(n => m[1] === '+' ? n.node.size > v : m[1] === '-' ? n.node.size < v : Math.ceil(n.node.size / mult) === +m[2]);
            }
            break;
          }
          case '-empty': tests.push(n => n.node.type === 'dir' ? n.node.children.size === 0 : n.node.size === 0); break;
          case '-perm': {
            const spec = expr[++k];
            const parseSpec = (t) => /^[0-7]+$/.test(t) ? parseInt(t, 8) : (LX.applySymbolic ? LX.applySymbolic(0, t, false) : 0);
            if (spec.startsWith('-')) { const v = parseSpec(spec.slice(1)); tests.push(n => v !== 0 && (n.node.mode & v) === v); }
            else if (spec.startsWith('/') || spec.startsWith('+')) { const v = parseSpec(spec.slice(1)); tests.push(n => (n.node.mode & v) !== 0); }
            else { const v = parseSpec(spec); tests.push(n => (n.node.mode & 0o7777) === v); }
            break;
          }
          case '-user': { const u = expr[++k]; tests.push(n => { const uu = sh.m.userByName(u); return uu ? n.node.uid === uu.uid : n.node.uid === +u; }); break; }
          case '-group': { const g = expr[++k]; tests.push(n => { const gg = sh.m.groupByName(g); return gg ? n.node.gid === gg.gid : n.node.gid === +g; }); break; }
          case '-mtime': { const spec = expr[++k]; const days = parseInt(spec.replace(/^[+-]/, ''), 10); tests.push(n => { const age = (Date.now() - n.node.mtime) / 864e5; return spec.startsWith('+') ? age > days + 1 : spec.startsWith('-') ? age < days : Math.floor(age) === days; }); break; }
          case '-mmin': { const spec = expr[++k]; const mins = parseInt(spec.replace(/^[+-]/, ''), 10); tests.push(n => { const age = (Date.now() - n.node.mtime) / 6e4; return spec.startsWith('+') ? age > mins : spec.startsWith('-') ? age < mins : Math.floor(age) === mins; }); break; }
          case '-newer': { const ref = expr[++k]; let t = 0; try { t = sh.m.fs.stat(P(sh, ref), sh.fsopts()).mtime; } catch (e) { } tests.push(n => n.node.mtime > t); break; }
          case '-maxdepth': maxdepth = +expr[++k]; break;
          case '-mindepth': mindepth = +expr[++k]; break;
          case '-print': actions.push({ kind: 'print' }); break;
          case '-print0': actions.push({ kind: 'print0' }); break;
          case '-ls': actions.push({ kind: 'ls' }); break;
          case '-delete': actions.push({ kind: 'delete' }); break;
          case '-exec': case '-execdir': {
            const cmd = [];
            k++;
            while (k < expr.length && expr[k] !== ';' && expr[k] !== '+' && expr[k] !== '\\;') { cmd.push(expr[k]); k++; }
            actions.push({ kind: 'exec', cmd, batch: expr[k] === '+' });
            break;
          }
          case '-not': case '!': tests.push({ op: '!' }); break;
          case '-o': case '-or': tests.push({ op: '-o' }); break;
          case '-a': case '-and': tests.push({ op: '-a' }); break;
          case '(': case '\\(': tests.push({ op: '(' }); break;
          case ')': case '\\)': tests.push({ op: ')' }); break;
          default: break;
        }
      }
      if (!actions.length) actions.push({ kind: 'print' });

      /* Avalia a expressão de testes respeitando !, -a, -o e parênteses.
         Sem operador explícito entre dois testes, o find assume -a. */
      const compile = (toks) => {
        let pos = 0;
        const peek = () => toks[pos];
        const isTerm = (t) => typeof t === 'function' || (t && t.op === '(') || (t && t.op === '!');
        function unary() {
          const t = peek();
          if (t && t.op === '!') { pos++; const f = unary(); return (e) => !f(e); }
          if (t && t.op === '(') {
            pos++;
            const f = orExpr();
            if (peek() && peek().op === ')') pos++;
            return f;
          }
          if (typeof t === 'function') { pos++; return (e) => { try { return t(e); } catch (err) { return false; } }; }
          pos++; return () => true;
        }
        function andExpr() {
          let f = unary();
          while (pos < toks.length) {
            const t = peek();
            if (t && t.op === '-a') { pos++; const g = unary(); const prev = f; f = (e) => prev(e) && g(e); continue; }
            if (isTerm(t)) { const g = unary(); const prev = f; f = (e) => prev(e) && g(e); continue; }
            break;
          }
          return f;
        }
        function orExpr() {
          let f = andExpr();
          while (pos < toks.length && peek() && peek().op === '-o') {
            pos++; const g = andExpr(); const prev = f; f = (e) => prev(e) || g(e);
          }
          return f;
        }
        if (!toks.length) return () => true;
        const fn = orExpr();
        return fn;
      };
      const matchesExpr = compile(tests);

      let status = 0;
      const batchFiles = [];
      for (const p of paths) {
        const base = P(sh, p);
        let root;
        try { root = sh.m.fs.stat(base, sh.fsopts()); }
        catch (e) { io.stderr.write(`find: '${p}': ${e.message}\n`); status = 1; continue; }
        const visit = async (abs, node, depth, rel) => {
          if (depth > maxdepth) return;
          const entry = { path: abs, node, name: FileSystem.basename(abs) === '/' ? '/' : (abs === base ? FileSystem.basename(base) : FileSystem.basename(abs)), rel };
          const ok = depth >= mindepth && matchesExpr(entry);
          if (ok) {
            for (const act of actions) {
              if (act.kind === 'print') io.stdout.write(rel + '\n');
              else if (act.kind === 'print0') io.stdout.write(rel + '\0');
              else if (act.kind === 'ls') io.stdout.write(`${String(node.ino).padStart(8)} ${String(Math.ceil(node.size / 1024) * 4).padStart(6)} ${LX.modeToRwx(node.mode, node.type)} ${String(node.nlink).padStart(3)} ${(sh.m.userByUid(node.uid) || {}).name || node.uid} ${(sh.m.groupByGid(node.gid) || {}).name || node.gid} ${String(node.size).padStart(8)} ${LX.lsTime(node.mtime)} ${rel}\n`);
              else if (act.kind === 'delete') { try { sh.m.fs.rmrf(abs, sh.fsopts()); } catch (e) { io.stderr.write(`find: cannot delete '${rel}': ${e.message}\n`); status = 1; } }
              else if (act.kind === 'exec') {
                if (act.batch) { batchFiles.push({ act, file: rel }); continue; }
                const cmdArgs = act.cmd.map(c => c === '{}' ? rel : c);
                const line = cmdArgs.map(LX.shQuote).join(' ');
                const sub = new LX.Executor(sh, io);
                await sub.run(line);
              }
            }
          }
          if (node.type === 'dir' && depth < maxdepth) {
            let names;
            try { names = Array.from(node.children.keys()).sort((a, b) => a.localeCompare(b, 'en')); }
            catch (e) { return; }
            for (const nm of names) {
              const child = node.children.get(nm);
              await visit(FileSystem.join(abs, nm), child, depth + 1, rel === '/' ? '/' + nm : rel + '/' + nm);
            }
          }
        };
        await visit(base, root, 0, p === '.' ? '.' : p.replace(/\/$/, ''));
      }
      if (batchFiles.length) {
        const act = batchFiles[0].act;
        const files = batchFiles.map(b => b.file);
        const cmdArgs = act.cmd.filter(c => c !== '{}').concat(files);
        const sub = new LX.Executor(sh, io);
        await sub.run(cmdArgs.map(LX.shQuote).join(' '));
      }
      return status;
    }
  });
  const HELP_FIND = `Uso: find [CAMINHO...] [EXPRESSÃO]
Procura arquivos em uma hierarquia de diretórios.

Testes:
  -name PADRÃO      nome do arquivo corresponde ao PADRÃO (glob)
  -iname PADRÃO     idem, ignorando maiúsculas/minúsculas
  -type f|d|l       tipo: arquivo, diretório, link simbólico
  -size [+-]N[ckMG] tamanho maior (+) / menor (-) / igual
  -perm MODO        permissões exatas; -MODO = pelo menos; /MODO = qualquer
  -user NOME        pertence ao usuário
  -mtime [+-]N      modificado há mais/menos de N dias
  -mmin  [+-]N      modificado há mais/menos de N minutos
  -empty            arquivo ou diretório vazio
  -maxdepth N       desce no máximo N níveis

Ações:
  -print            imprime o caminho (padrão)
  -print0           imprime separado por NUL (use com xargs -0)
  -delete           apaga o que encontrar (CUIDADO)
  -exec CMD {} \\;   executa CMD para cada arquivo
  -exec CMD {} +    executa CMD uma vez com vários arquivos
`;

  /* ================================ xargs ================================ */
  defcmd({
    name: 'xargs', pkg: 'findutils',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { n: 1, I: 1, '0': 0, d: 1, r: 0, t: 0, P: 1, '--null': 0, '--no-run-if-empty': 0, '--replace': 1, '--max-args': 1 });
      const data = io.stdin ? io.stdin.readAll() : '';
      const sep = (opts['0'] || opts['--null']) ? '\0' : (opts.d || /\s+/);
      let items = data.split(sep).filter(s => s !== '');
      if (!(opts['0'] || opts['--null']) && !opts.d) items = data.trim() === '' ? [] : data.trim().split(/\s+/);
      if (!items.length && (opts.r || opts['--no-run-if-empty'])) return 0;
      const cmd = rest.length ? rest : ['echo'];
      const replace = opts.I || opts['--replace'];
      const maxArgs = opts.n ? +opts.n : (opts['--max-args'] ? +opts['--max-args'] : (replace ? 1 : Infinity));
      let status = 0;
      const runLine = async (line) => {
        if (opts.t) io.stderr.write(line + '\n');
        const sub = new LX.Executor(sh, io);
        const st = await sub.run(line);
        if (st !== 0) status = st;
      };
      if (replace) {
        for (const it of items) {
          const parts = cmd.map(c => c.split(replace).join(it));
          await runLine(parts.map(LX.shQuote).join(' '));
        }
        return status;
      }
      if (maxArgs === Infinity) {
        await runLine([...cmd, ...items].map(LX.shQuote).join(' '));
        return status;
      }
      for (let i = 0; i < items.length; i += maxArgs) {
        await runLine([...cmd, ...items.slice(i, i + maxArgs)].map(LX.shQuote).join(' '));
      }
      return status;
    }
  });

  /* ================================ sed ================================ */
  defcmd({
    name: 'sed', pkg: 'sed',
    run: async ({ sh, io, args }) => {
      // pré-varredura: -e pode aparecer várias vezes e -i pode vir com sufixo colado
      const preScripts = [];
      let inPlace = false, backupSuffix = '';
      const cleaned = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-e' || a === '--expression') { preScripts.push(args[++i]); continue; }
        if (/^-e./.test(a) && !/^--/.test(a)) { preScripts.push(a.slice(2)); continue; }
        if (/^--expression=/.test(a)) { preScripts.push(a.slice(13)); continue; }
        if (a === '-i' || a === '--in-place') { inPlace = true; continue; }
        if (/^-i[^\s]/.test(a) && !/^--/.test(a) && !/^-i[nEr]/.test(a)) { inPlace = true; backupSuffix = a.slice(2); continue; }
        if (/^--in-place=/.test(a)) { inPlace = true; backupSuffix = a.slice(11); continue; }
        cleaned.push(a);
      }
      args = cleaned;
      const { opts, rest } = getopt(args, { n: 0, f: 1, E: 0, r: 0, s: 0, '--quiet': 0, '--regexp-extended': 0, '--help': 0 });
      if (opts['--help']) { io.stdout.write(HELP_SED); return 0; }
      let scripts = preScripts.slice();
      let files = rest.slice();
      if (opts.f) { try { scripts.push(sh.m.fs.readFile(P(sh, opts.f), sh.fsopts())); } catch (e) { io.stderr.write(`sed: couldn't open file ${opts.f}\n`); return 1; } }
      if (!scripts.length) {
        if (!files.length) { io.stderr.write('Usage: sed [OPTION]... {script} [input-file]...\n'); return 1; }
        scripts.push(files.shift());
      }
      const extended = opts.E || opts.r || opts['--regexp-extended'];
      let cmds;
      try { cmds = parseSedScript(scripts.join('\n'), extended); }
      catch (e) { io.stderr.write(`sed: -e expression #1, char ${e.pos || 0}: ${e.message}\n`); return 1; }

      const runOn = (text) => {
        const out = [];
        const lines = text.split('\n');
        const hadTrailing = lines[lines.length - 1] === '';
        if (hadTrailing) lines.pop();
        const rangeActive = new Map();
        let quit = false;
        let lineNum = 0;
        for (let i = 0; i < lines.length && !quit; i++) {
          lineNum = i + 1;
          let pattern = lines[i];
          let deleted = false;
          let printedExplicit = [];
          const appendAfter = [];
          const runCmds = (list) => {
            for (const c of list) {
              if (deleted || quit) break;
              if (!sedMatches(c, lineNum, pattern, lines.length, rangeActive)) continue;
              switch (c.cmd) {
                case 's': {
                  const re = new RegExp(posixToJs(c.re, extended), c.flags.replace(/[^gi]/g, ''));
                  const rep = c.rep.replace(/\\(\d)/g, '$$$1').replace(/&/g, (m, off, str) => (off > 0 && str[off - 1] === '\\') ? '&' : '$&').replace(/\\&/g, '&');
                  const before = pattern;
                  if (c.flags.includes('g')) pattern = pattern.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), rep);
                  else if (/\d/.test(c.flags)) {
                    const nth = parseInt(c.flags.match(/\d+/)[0], 10);
                    let count = 0;
                    pattern = pattern.replace(new RegExp(re.source, re.flags + 'g'), (m, ...a) => { count++; return count === nth ? m.replace(new RegExp(re.source, re.flags), rep) : m; });
                  }
                  else pattern = pattern.replace(re, rep);
                  if (c.flags.includes('p') && before !== pattern) printedExplicit.push(pattern);
                  if (c.flags.includes('w') && c.wfile) { try { sh.m.fs.appendFile(P(sh, c.wfile), pattern + '\n', sh.fsopts()); } catch (e) { } }
                  break;
                }
                case 'd': deleted = true; break;
                case 'p': printedExplicit.push(pattern); break;
                case 'a': appendAfter.push(c.text); break;
                case 'i': out.push(c.text); break;
                case 'c': pattern = c.text; break;
                case 'y': {
                  let o = '';
                  for (const ch of pattern) { const k = c.from.indexOf(ch); o += k >= 0 ? c.to[k] : ch; }
                  pattern = o;
                  break;
                }
                case '=': out.push(String(lineNum)); break;
                case 'q': quit = true; break;
                case 'Q': quit = true; deleted = true; break;
                case 'block': runCmds(c.body); break;
                case 'r': { try { out.push(sh.m.fs.readFile(P(sh, c.text), sh.fsopts()).replace(/\n$/, '')); } catch (e) { } break; }
                case 'z': pattern = ''; break;
              }
            }
          };
          runCmds(cmds);
          if (!deleted && !opts.n && !opts['--quiet']) out.push(pattern);
          for (const p of printedExplicit) out.push(p);
          for (const a of appendAfter) out.push(a);
        }
        return out.length ? out.join('\n') + '\n' : '';
      };

      if (!files.length) { io.stdout.write(runOn(io.stdin ? io.stdin.readAll() : '')); return 0; }
      let status = 0;
      for (const f of files) {
        let data;
        try { data = sh.m.fs.readFile(P(sh, f), sh.fsopts()); }
        catch (e) { io.stderr.write(`sed: can't read ${f}: ${e.message}\n`); status = 2; continue; }
        const result = runOn(data);
        if (inPlace) {
          try {
            if (backupSuffix) sh.m.fs.writeFile(P(sh, f + backupSuffix), data, sh.fsopts());
            sh.m.fs.writeFile(P(sh, f), result, sh.fsopts());
          } catch (e) { io.stderr.write(`sed: couldn't open temporary file: ${e.message}\n`); status = 4; }
        }
        else io.stdout.write(result);
      }
      return status;
    }
  });

  function sedMatches(c, lineNum, text, total, rangeActive) {
    if (!c.addr) return true;
    const a = c.addr;
    const one = (spec) => {
      if (spec === '$') return lineNum === total;
      if (/^\d+$/.test(spec)) return lineNum === +spec;
      if (spec.startsWith('/') || spec.startsWith('\\')) {
        const body = spec.slice(1, spec.lastIndexOf('/'));
        const fl = spec.slice(spec.lastIndexOf('/') + 1);
        try { return new RegExp(posixToJs(body, c.extended), fl.includes('I') ? 'i' : '').test(text); } catch (e) { return false; }
      }
      const step = /^(\d+)~(\d+)$/.exec(spec);
      if (step) return lineNum >= +step[1] && (lineNum - +step[1]) % +step[2] === 0;
      return false;
    };
    let result;
    if (a.length === 1) result = one(a[0]);
    else {
      const key = c._id;
      const active = rangeActive.get(key);
      if (!active) {
        if (one(a[0])) { rangeActive.set(key, true); result = true; if (/^\d+$/.test(a[1]) && +a[1] <= lineNum) rangeActive.set(key, false); }
        else result = false;
      } else {
        result = true;
        if (one(a[1])) rangeActive.set(key, false);
      }
    }
    return c.negate ? !result : result;
  }

  let SED_ID = 0;
  function parseSedScript(src, extended) {
    const cmds = [];
    let i = 0;
    const readAddr = () => {
      const addrs = [];
      const readOne = () => {
        if (/\d/.test(src[i])) { let n = ''; while (/[\d~]/.test(src[i])) { n += src[i]; i++; } return n; }
        if (src[i] === '$') { i++; return '$'; }
        if (src[i] === '/') {
          let j = i + 1, body = '';
          while (j < src.length && src[j] !== '/') { if (src[j] === '\\') { body += src[j] + src[j + 1]; j += 2; continue; } body += src[j]; j++; }
          j++;
          let fl = '';
          while (j < src.length && /[I]/.test(src[j])) { fl += src[j]; j++; }
          i = j;
          return '/' + body + '/' + fl;
        }
        return null;
      };
      const a1 = readOne();
      if (a1 === null) return null;
      addrs.push(a1);
      if (src[i] === ',') { i++; const a2 = readOne(); if (a2 !== null) addrs.push(a2); }
      return addrs;
    };
    const skipWs = () => { while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++; };
    const parseList = (stopAtBrace) => {
      const list = [];
      while (i < src.length) {
        skipWs();
        while (src[i] === ';' || src[i] === '\n') { i++; skipWs(); }
        if (i >= src.length) break;
        if (src[i] === '}') { if (stopAtBrace) { i++; return list; } i++; continue; }
        if (src[i] === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
        const addr = readAddr();
        skipWs();
        let negate = false;
        if (src[i] === '!') { negate = true; i++; skipWs(); }
        const ch = src[i];
        const c = { addr, negate, extended, _id: ++SED_ID };
        if (ch === '{') { i++; c.cmd = 'block'; c.body = parseList(true); list.push(c); continue; }
        i++;
        switch (ch) {
          case 's': {
            const delim = src[i]; i++;
            let re = '', rep = '';
            while (i < src.length && src[i] !== delim) { if (src[i] === '\\') { if (src[i + 1] === delim) { re += delim; i += 2; continue; } re += src[i] + src[i + 1]; i += 2; continue; } re += src[i]; i++; }
            i++;
            while (i < src.length && src[i] !== delim) { if (src[i] === '\\') { if (src[i + 1] === delim) { rep += delim; i += 2; continue; } rep += src[i] + src[i + 1]; i += 2; continue; } rep += src[i]; i++; }
            i++;
            let flags = '';
            while (i < src.length && /[gipIw0-9]/.test(src[i])) { flags += src[i]; i++; }
            if (flags.includes('w')) { skipWs(); let f = ''; while (i < src.length && src[i] !== '\n' && src[i] !== ';') { f += src[i]; i++; } c.wfile = f.trim(); }
            c.cmd = 's'; c.re = re; c.rep = rep; c.flags = flags;
            break;
          }
          case 'y': {
            const delim = src[i]; i++;
            let from = '', to = '';
            while (i < src.length && src[i] !== delim) { from += src[i]; i++; } i++;
            while (i < src.length && src[i] !== delim) { to += src[i]; i++; } i++;
            c.cmd = 'y'; c.from = from; c.to = to;
            break;
          }
          case 'a': case 'i': case 'c': case 'r': case 'w': {
            skipWs();
            if (src[i] === '\\') { i++; if (src[i] === '\n') i++; }
            let text = '';
            while (i < src.length && src[i] !== '\n') { if (src[i] === '\\' && src[i + 1] === '\n') { text += '\n'; i += 2; continue; } text += src[i]; i++; }
            c.cmd = ch; c.text = text;
            break;
          }
          case 'd': case 'p': case '=': case 'q': case 'Q': case 'n': case 'N': case 'D': case 'P': case 'z': case 'h': case 'H': case 'g': case 'G': case 'x':
            c.cmd = ch; break;
          default:
            { const e = new Error(`unknown command: \`${ch}'`); e.pos = i; throw e; }
        }
        list.push(c);
      }
      return list;
    };
    return parseList(false);
  }
  const HELP_SED = `Uso: sed [OPÇÃO]... {script} [arquivo]...

  -n, --quiet               não imprime automaticamente cada linha
  -e SCRIPT                 adiciona o SCRIPT aos comandos
  -f ARQUIVO                lê o script do ARQUIVO
  -i[SUFIXO]                edita o arquivo no lugar (com backup se SUFIXO)
  -E, -r                    usa expressões regulares estendidas (ERE)

Comandos mais usados:
  s/regex/troca/flags       substitui (flags: g=todas, i=ignora caso, p=imprime, N=n-ésima)
  Nd                        apaga a linha N        /regex/d   apaga linhas que casam
  Np                        imprime a linha N      (use com -n)
  N,Mp                      imprime o intervalo
  a TEXTO / i TEXTO         acrescenta depois / insere antes
  y/abc/xyz/                troca caractere por caractere
`;

  /* ================================ awk ================================ */
  LX.awkRun = awkRun;
  defcmd({
    name: ['awk', 'gawk', 'mawk'], path: '/usr/bin/', pkg: 'gawk',
    run: async ({ sh, io, args, name }) => {
      const { opts, rest } = getopt(args, { F: 1, v: 1, f: 1, '--field-separator': 1, '--help': 0 });
      if (opts['--help']) { io.stdout.write(HELP_AWK); return 0; }
      let program;
      const files = rest.slice();
      if (opts.f) { try { program = sh.m.fs.readFile(P(sh, opts.f), sh.fsopts()); } catch (e) { io.stderr.write(`awk: can't open file ${opts.f}\n`); return 2; } }
      else {
        if (!files.length) { io.stderr.write('usage: awk [-F fs] [-v var=value] [prog | -f progfile] [file ...]\n'); return 2; }
        program = files.shift();
      }
      const vars = {};
      const vArgs = args.filter((a, i) => args[i - 1] === '-v' || (a.startsWith('-v') && a.length > 2));
      for (const va of vArgs) {
        const s = va.startsWith('-v') ? va.slice(2) : va;
        const eq = s.indexOf('=');
        if (eq > 0) vars[s.slice(0, eq)] = s.slice(eq + 1);
      }
      let input;
      if (files.length) {
        input = '';
        for (const f of files) {
          try { input += sh.m.fs.readFile(P(sh, f), sh.fsopts()); }
          catch (e) { io.stderr.write(`awk: can't open file ${f}\n`); return 2; }
        }
      } else input = io.stdin ? io.stdin.readAll() : '';
      try {
        return awkRun(program, input, io, { FS: opts.F || opts['--field-separator'], vars, sh, files });
      } catch (e) {
        io.stderr.write(`awk: ${e.message}\n`);
        return 2;
      }
    }
  });
  const HELP_AWK = `Uso: awk [-F sep] [-v var=valor] 'programa' [arquivo...]

Um programa awk é uma lista de regras:   padrão { ação }

  BEGIN { ... }      executa antes de ler a entrada
  END   { ... }      executa depois de ler tudo
  /regex/ { ... }    executa nas linhas que casam
  cond    { ... }    executa quando a condição é verdadeira

Variáveis embutidas: $0 (linha), $1..$NF (campos), NF (nº de campos),
NR (nº da linha), FS (separador de entrada), OFS (separador de saída).

Funções: length(), substr(s,i,n), index(s,t), split(s,a,fs), sub(), gsub(),
match(), sprintf(), toupper(), tolower(), int(), sqrt().
`;

  /* ---------- interpretador awk ---------- */
  function awkLex(src) {
    const toks = [];
    let i = 0;
    const KW = ['BEGIN', 'END', 'function', 'if', 'else', 'while', 'for', 'do', 'break', 'continue', 'next', 'exit', 'return', 'delete', 'in', 'print', 'printf', 'getline'];
    while (i < src.length) {
      const c = src[i];
      if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
      if (c === '\n') { toks.push({ t: 'nl' }); i++; continue; }
      if (/[ \t\r]/.test(c)) { i++; continue; }
      if (c === '"') {
        let s = ''; i++;
        while (i < src.length && src[i] !== '"') { if (src[i] === '\\') { s += LX.unescapeC(src.slice(i, i + 2)) || src[i + 1]; i += 2; continue; } s += src[i]; i++; }
        i++;
        toks.push({ t: 'str', v: s });
        continue;
      }
      if (c === '/' && canBeRegex(toks)) {
        let s = ''; i++;
        while (i < src.length && src[i] !== '/') { if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; continue; } s += src[i]; i++; }
        i++;
        toks.push({ t: 'regex', v: s });
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
        let s = '';
        while (i < src.length && /[0-9.eE]/.test(src[i])) { s += src[i]; i++; }
        toks.push({ t: 'num', v: parseFloat(s) });
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let s = '';
        while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) { s += src[i]; i++; }
        toks.push({ t: KW.includes(s) ? s : 'id', v: s });
        continue;
      }
      const three = src.slice(i, i + 3);
      const two = src.slice(i, i + 2);
      if (['**='].includes(three)) { toks.push({ t: 'op', v: three }); i += 3; continue; }
      if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '^=', '!~', '>>', '**'].includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
      toks.push({ t: 'op', v: c }); i++;
    }
    toks.push({ t: 'eof' });
    return toks;
  }
  function canBeRegex(toks) {
    for (let k = toks.length - 1; k >= 0; k--) {
      const t = toks[k];
      if (t.t === 'nl') return true;
      if (t.t === 'num' || t.t === 'str' || t.t === 'id' || t.t === 'regex') return false;
      if (t.t === 'op' && [')', ']'].includes(t.v)) return false;
      return true;
    }
    return true;
  }

  function awkParse(src) {
    const toks = awkLex(src);
    let p = 0;
    const peek = (k = 0) => toks[p + k];
    const at = (t, v) => peek().t === t && (v === undefined || peek().v === v);
    const atOp = (v) => peek().t === 'op' && peek().v === v;
    const next = () => toks[p++];
    const expect = (t, v) => { if (!at(t, v)) throw new Error(`syntax error at or near ${JSON.stringify(peek().v || peek().t)}`); return next(); };
    const skipNl = () => { while (at('nl') || atOp(';')) next(); };

    function program() {
      const rules = [];
      const funcs = {};
      skipNl();
      while (!at('eof')) {
        if (at('function')) {
          next();
          const name = next().v;
          expect('op', '(');
          const params = [];
          while (!atOp(')')) { if (at('id')) params.push(next().v); else next(); }
          expect('op', ')');
          skipNl();
          const body = block();
          funcs[name] = { params, body };
          skipNl();
          continue;
        }
        let pattern = null, action = null;
        if (at('BEGIN')) { next(); pattern = { type: 'BEGIN' }; }
        else if (at('END')) { next(); pattern = { type: 'END' }; }
        else if (!atOp('{')) { pattern = expr(); if (atOp(',')) { next(); const e2 = expr(); pattern = { type: 'range', a: pattern, b: e2 }; } }
        skipWsOnly();
        if (atOp('{')) action = block();
        rules.push({ pattern, action });
        skipNl();
      }
      return { rules, funcs };
    }
    function skipWsOnly() { }
    function block() {
      expect('op', '{');
      const stmts = [];
      skipNl();
      while (!atOp('}') && !at('eof')) { stmts.push(statement()); skipNl(); }
      expect('op', '}');
      return { type: 'block', body: stmts };
    }
    function statement() {
      skipNl();
      if (atOp('{')) return block();
      if (at('if')) {
        next(); expect('op', '('); const c = expr(); expect('op', ')'); skipNl();
        const then = statement();
        skipNl();
        let els = null;
        if (at('else')) { next(); skipNl(); els = statement(); }
        return { type: 'if', cond: c, then, else: els };
      }
      if (at('while')) { next(); expect('op', '('); const c = expr(); expect('op', ')'); skipNl(); const b = statement(); return { type: 'while', cond: c, body: b }; }
      if (at('do')) { next(); skipNl(); const b = statement(); skipNl(); expect('while'); expect('op', '('); const c = expr(); expect('op', ')'); return { type: 'do', cond: c, body: b }; }
      if (at('for')) {
        next(); expect('op', '(');
        if (at('id') && peek(1).t === 'in') {
          const v = next().v; next(); const arr = next().v; expect('op', ')'); skipNl();
          return { type: 'forin', var: v, arr, body: statement() };
        }
        if (atOp('(')) { }
        const init = atOp(';') ? null : simpleStatement();
        expect('op', ';');
        const cond = atOp(';') ? null : expr();
        expect('op', ';');
        const step = atOp(')') ? null : simpleStatement();
        expect('op', ')'); skipNl();
        return { type: 'for', init, cond, step, body: statement() };
      }
      if (at('break')) { next(); return { type: 'break' }; }
      if (at('continue')) { next(); return { type: 'continue' }; }
      if (at('next')) { next(); return { type: 'next' }; }
      if (at('exit')) { next(); const e = (at('nl') || atOp(';') || atOp('}')) ? null : expr(); return { type: 'exit', value: e }; }
      if (at('return')) { next(); const e = (at('nl') || atOp(';') || atOp('}')) ? null : expr(); return { type: 'return', value: e }; }
      if (at('delete')) { next(); const nm = next().v; let idx = null; if (atOp('[')) { next(); idx = exprList(']'); expect('op', ']'); } return { type: 'delete', name: nm, index: idx }; }
      return simpleStatement();
    }
    function simpleStatement() {
      if (at('print') || at('printf')) {
        const kind = next().t;
        const args = [];
        let dest = null, append = false;
        if (!at('nl') && !atOp(';') && !atOp('}') && !at('eof')) {
          if (!atOp('>')) {
            args.push(expr(true));
            while (atOp(',')) { next(); skipNl(); args.push(expr(true)); }
          }
        }
        if (atOp('>') || atOp('>>')) { append = peek().v === '>>'; next(); dest = expr(); }
        else if (atOp('|')) { next(); dest = expr(); }
        return { type: kind, args, dest, append };
      }
      const e = expr();
      return { type: 'expr', expr: e };
    }
    function exprList(stop) {
      const list = [expr()];
      while (atOp(',')) { next(); list.push(expr()); }
      return list;
    }

    /* expressões */
    function expr(noGt) { return assign(noGt); }
    function assign(noGt) {
      const left = ternary(noGt);
      if (peek().t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '^=', '**='].includes(peek().v)) {
        const op = next().v;
        const right = assign(noGt);
        return { type: 'assign', op, target: left, value: right };
      }
      return left;
    }
    function ternary(noGt) {
      const c = or(noGt);
      if (atOp('?')) { next(); const a = ternary(noGt); expect('op', ':'); const b = ternary(noGt); return { type: 'ternary', cond: c, a, b }; }
      return c;
    }
    function or(noGt) { let l = and(noGt); while (atOp('||')) { next(); skipNl(); l = { type: 'or', l, r: and(noGt) }; } return l; }
    function and(noGt) { let l = inOp(noGt); while (atOp('&&')) { next(); skipNl(); l = { type: 'and', l, r: inOp(noGt) }; } return l; }
    function inOp(noGt) { let l = matchOp(noGt); while (at('in')) { next(); const arr = next().v; l = { type: 'in', key: l, arr }; } return l; }
    function matchOp(noGt) {
      let l = rel(noGt);
      while (atOp('~') || atOp('!~')) { const op = next().v; const r = rel(noGt); l = { type: 'match', neg: op === '!~', l, r }; }
      return l;
    }
    function rel(noGt) {
      let l = concat(noGt);
      while (peek().t === 'op' && ['<', '<=', '>', '>=', '==', '!='].includes(peek().v)) {
        if (noGt && (peek().v === '>' || peek().v === '>>')) break;
        const op = next().v;
        l = { type: 'cmp', op, l, r: concat(noGt) };
      }
      return l;
    }
    function concat(noGt) {
      let l = additive(noGt);
      while (true) {
        const t = peek();
        if (t.t === 'num' || t.t === 'str' || t.t === 'id' || t.t === 'regex' ||
          (t.t === 'op' && ['$', '(', '!', '-', '+', '++', '--'].includes(t.v)) ||
          ['length', 'substr'].includes(t.t)) {
          if (t.t === 'op' && (t.v === '-' || t.v === '+')) break;
          l = { type: 'concat', l, r: additive(noGt) };
          continue;
        }
        break;
      }
      return l;
    }
    function additive(noGt) {
      let l = mul(noGt);
      while (atOp('+') || atOp('-')) { const op = next().v; l = { type: 'bin', op, l, r: mul(noGt) }; }
      return l;
    }
    function mul(noGt) {
      let l = unary(noGt);
      while (atOp('*') || atOp('/') || atOp('%')) { const op = next().v; l = { type: 'bin', op, l, r: unary(noGt) }; }
      return l;
    }
    function unary(noGt) {
      if (atOp('!')) { next(); return { type: 'not', e: unary(noGt) }; }
      if (atOp('-')) { next(); return { type: 'neg', e: unary(noGt) }; }
      if (atOp('+')) { next(); return unary(noGt); }
      if (atOp('++')) { next(); const t = unary(noGt); return { type: 'preinc', target: t, delta: 1 }; }
      if (atOp('--')) { next(); const t = unary(noGt); return { type: 'preinc', target: t, delta: -1 }; }
      return power(noGt);
    }
    function power(noGt) {
      const b = postfix(noGt);
      if (atOp('^') || atOp('**')) { next(); return { type: 'bin', op: '^', l: b, r: unary(noGt) }; }
      return b;
    }
    function postfix(noGt) {
      let e = primary(noGt);
      while (atOp('++') || atOp('--')) { const op = next().v; e = { type: 'postinc', target: e, delta: op === '++' ? 1 : -1 }; }
      return e;
    }
    function primary(noGt) {
      const t = peek();
      if (t.t === 'num') { next(); return { type: 'num', v: t.v }; }
      if (t.t === 'str') { next(); return { type: 'str', v: t.v }; }
      if (t.t === 'regex') { next(); return { type: 'regexlit', v: t.v }; }
      if (t.t === 'op' && t.v === '$') { next(); return { type: 'field', e: primary(noGt) }; }
      if (t.t === 'op' && t.v === '(') {
        next();
        const list = [expr()];
        while (atOp(',')) { next(); list.push(expr()); }
        expect('op', ')');
        if (list.length > 1) return { type: 'group', list };
        return list[0];
      }
      if (t.t === 'getline') { next(); return { type: 'getline' }; }
      if (t.t === 'id') {
        next();
        if (atOp('(')) {
          next();
          const args = [];
          if (!atOp(')')) { args.push(expr()); while (atOp(',')) { next(); args.push(expr()); } }
          expect('op', ')');
          return { type: 'call', name: t.v, args };
        }
        if (atOp('[')) {
          next();
          const idx = [expr()];
          while (atOp(',')) { next(); idx.push(expr()); }
          expect('op', ']');
          return { type: 'index', name: t.v, index: idx };
        }
        return { type: 'var', name: t.v };
      }
      if (t.t === 'op' && t.v === '-') { next(); return { type: 'neg', e: unary(noGt) }; }
      next();
      return { type: 'str', v: '' };
    }
    return program();
  }

  function awkRun(programSrc, input, io, opts = {}) {
    const ast = awkParse(programSrc);
    const globals = Object.create(null);
    const arrays = Object.create(null);
    globals.FS = opts.FS !== undefined && opts.FS !== null ? String(opts.FS) : ' ';
    globals.OFS = ' '; globals.ORS = '\n'; globals.RS = '\n';
    globals.NR = 0; globals.NF = 0; globals.FNR = 0; globals.FILENAME = (opts.files && opts.files[0]) || '';
    globals.SUBSEP = '\x1c'; globals.CONVFMT = '%.6g'; globals.OFMT = '%.6g';
    globals.RSTART = 0; globals.RLENGTH = -1;
    for (const k in (opts.vars || {})) globals[k] = opts.vars[k];
    let fields = [''];
    let exitCode = null;
    let scopes = [];

    const NEXT = { next: true }, EXIT = { exit: true }, BREAK = { brk: true }, CONT = { cont: true };
    class RetSig { constructor(v) { this.v = v; } }

    function scope() { return scopes.length ? scopes[scopes.length - 1] : null; }
    function getVar(name) {
      const s = scope();
      if (s && name in s) return s[name];
      if (name === 'NF') return fields.length - 1;
      return globals[name] !== undefined ? globals[name] : '';
    }
    function setVar(name, v) {
      const s = scope();
      if (s && name in s) { s[name] = v; return; }
      globals[name] = v;
      if (name === 'NF') { const n = toNum(v); fields.length = n + 1; for (let i = 1; i <= n; i++) if (fields[i] === undefined) fields[i] = ''; rebuild0(); }
    }
    function getArr(name) {
      const s = scope();
      if (s && name in s && typeof s[name] === 'object') return s[name];
      if (!arrays[name]) arrays[name] = Object.create(null);
      return arrays[name];
    }
    function splitLine(line) {
      const fs = String(globals.FS);
      let parts;
      if (fs === ' ') parts = line.trim() === '' ? [] : line.trim().split(/[ \t\n]+/);
      else if (fs.length === 1 && fs !== '\\') parts = line === '' ? [] : line.split(fs);
      else parts = line === '' ? [] : line.split(new RegExp(posixToJs(fs, true)));
      fields = [line, ...parts];
      globals.NF = parts.length;
    }
    function rebuild0() {
      fields[0] = fields.slice(1).map(f => f === undefined ? '' : f).join(String(globals.OFS));
    }
    function toNum(v) {
      if (typeof v === 'number') return v;
      if (v === undefined || v === null || v === '') return 0;
      const m = /^[ \t]*[-+]?(\d+\.?\d*([eE][-+]?\d+)?|\.\d+)/.exec(String(v));
      return m ? parseFloat(m[0]) : 0;
    }
    function toStr(v) {
      if (typeof v === 'number') {
        if (Number.isInteger(v)) return String(v);
        return LX.formatPrintf(String(globals.CONVFMT), [v]);
      }
      return v === undefined || v === null ? '' : String(v);
    }
    function truthy(v) {
      if (typeof v === 'number') return v !== 0;
      if (v === undefined || v === null || v === '') return false;
      if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v) !== 0;
      return v !== '';
    }
    function out(s, dest, append) {
      if (!dest) { io.stdout.write(s); return; }
      const path = FileSystem.normalize(toStr(dest), opts.sh.cwd);
      if (path === '/dev/stderr') { io.stderr.write(s); return; }
      if (path === '/dev/stdout') { io.stdout.write(s); return; }
      try {
        if (append || openedFiles.has(path)) opts.sh.m.fs.appendFile(path, s, opts.sh.fsopts());
        else { opts.sh.m.fs.writeFile(path, s, opts.sh.fsopts()); openedFiles.add(path); }
      } catch (e) { io.stderr.write(`awk: can't redirect to ${path}\n`); }
    }
    const openedFiles = new Set();

    function evalExpr(n) {
      switch (n.type) {
        case 'num': return n.v;
        case 'str': return n.v;
        case 'regexlit': return new RegExp(posixToJs(n.v, true)).test(fields[0]) ? 1 : 0;
        case 'var': return getVar(n.name);
        case 'field': { const i = Math.trunc(toNum(evalExpr(n.e))); return fields[i] === undefined ? '' : fields[i]; }
        case 'index': { const a = getArr(n.name); const key = n.index.map(x => toStr(evalExpr(x))).join(globals.SUBSEP); if (!(key in a)) a[key] = ''; return a[key]; }
        case 'group': return n.list.map(x => toStr(evalExpr(x))).join(globals.SUBSEP);
        case 'in': { const a = getArr(n.arr); const key = n.key.type === 'group' ? n.key.list.map(x => toStr(evalExpr(x))).join(globals.SUBSEP) : toStr(evalExpr(n.key)); return (key in a) ? 1 : 0; }
        case 'assign': {
          let v = evalExpr(n.value);
          if (n.op !== '=') {
            const cur = toNum(evalExpr(n.target));
            const rv = toNum(v);
            v = n.op === '+=' ? cur + rv : n.op === '-=' ? cur - rv : n.op === '*=' ? cur * rv :
              n.op === '/=' ? cur / rv : n.op === '%=' ? cur % rv : Math.pow(cur, rv);
          }
          assignTo(n.target, v);
          return v;
        }
        case 'ternary': return truthy(evalExpr(n.cond)) ? evalExpr(n.a) : evalExpr(n.b);
        case 'or': return (truthy(evalExpr(n.l)) || truthy(evalExpr(n.r))) ? 1 : 0;
        case 'and': return (truthy(evalExpr(n.l)) && truthy(evalExpr(n.r))) ? 1 : 0;
        case 'not': return truthy(evalExpr(n.e)) ? 0 : 1;
        case 'neg': return -toNum(evalExpr(n.e));
        case 'match': {
          const s = toStr(evalExpr(n.l));
          const pat = n.r.type === 'regexlit' ? n.r.v : toStr(evalExpr(n.r));
          let r;
          try { r = new RegExp(posixToJs(pat, true)).test(s); } catch (e) { r = false; }
          return (n.neg ? !r : r) ? 1 : 0;
        }
        case 'cmp': {
          let l = evalExpr(n.l), r = evalExpr(n.r);
          const bothNum = (typeof l === 'number' || isNumericStr(l)) && (typeof r === 'number' || isNumericStr(r));
          if (bothNum) { l = toNum(l); r = toNum(r); } else { l = toStr(l); r = toStr(r); }
          switch (n.op) {
            case '<': return l < r ? 1 : 0; case '<=': return l <= r ? 1 : 0;
            case '>': return l > r ? 1 : 0; case '>=': return l >= r ? 1 : 0;
            case '==': return l === r ? 1 : 0; case '!=': return l !== r ? 1 : 0;
          }
          return 0;
        }
        case 'bin': {
          const l = toNum(evalExpr(n.l)), r = toNum(evalExpr(n.r));
          switch (n.op) {
            case '+': return l + r; case '-': return l - r; case '*': return l * r;
            case '/': if (r === 0) throw new Error('division by zero'); return l / r;
            case '%': if (r === 0) throw new Error('division by zero in %'); return l % r;
            case '^': return Math.pow(l, r);
          }
          return 0;
        }
        case 'concat': return toStr(evalExpr(n.l)) + toStr(evalExpr(n.r));
        case 'preinc': { const v = toNum(evalExpr(n.target)) + n.delta; assignTo(n.target, v); return v; }
        case 'postinc': { const v = toNum(evalExpr(n.target)); assignTo(n.target, v + n.delta); return v; }
        case 'call': return callFn(n);
        case 'getline': return 0;
      }
      return '';
    }
    function isNumericStr(v) { return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))); }
    function assignTo(target, v) {
      if (target.type === 'var') { setVar(target.name, v); return; }
      if (target.type === 'field') {
        const i = Math.trunc(toNum(evalExpr(target.e)));
        if (i === 0) { splitLine(toStr(v)); return; }
        while (fields.length <= i) fields.push('');
        fields[i] = toStr(v);
        globals.NF = fields.length - 1;
        rebuild0();
        return;
      }
      if (target.type === 'index') {
        const a = getArr(target.name);
        a[target.index.map(x => toStr(evalExpr(x))).join(globals.SUBSEP)] = v;
        return;
      }
    }
    function callFn(n) {
      const name = n.name;
      const a = n.args;
      const A = (i) => a[i] === undefined ? '' : evalExpr(a[i]);
      switch (name) {
        case 'length': return a.length ? toStr(A(0)).length : toStr(fields[0]).length;
        case 'substr': { const s = toStr(A(0)); const start = Math.trunc(toNum(A(1))); const len = a.length > 2 ? Math.trunc(toNum(A(2))) : Infinity; const from = Math.max(0, start - 1); return s.substr(from, len === Infinity ? undefined : Math.max(0, len + Math.min(0, start - 1))); }
        case 'index': { const s = toStr(A(0)), t = toStr(A(1)); return s.indexOf(t) + 1; }
        case 'split': {
          const s = toStr(A(0));
          const arrName = a[1].type === 'var' ? a[1].name : (a[1].name || 'SPLITARR');
          const arr = getArr(arrName);
          for (const k in arr) delete arr[k];
          const fs = a.length > 2 ? (a[2].type === 'regexlit' ? a[2].v : toStr(A(2))) : String(globals.FS);
          let parts;
          if (fs === ' ') parts = s.trim() === '' ? [] : s.trim().split(/[ \t\n]+/);
          else parts = s === '' ? [] : s.split(fs.length === 1 ? fs : new RegExp(posixToJs(fs, true)));
          parts.forEach((v, i) => arr[i + 1] = v);
          return parts.length;
        }
        case 'sub': case 'gsub': {
          const pat = a[0].type === 'regexlit' ? a[0].v : toStr(A(0));
          const rep = toStr(A(1));
          const target = a[2] || { type: 'field', e: { type: 'num', v: 0 } };
          const s = toStr(evalExpr(target));
          let count = 0;
          const re = new RegExp(posixToJs(pat, true), name === 'gsub' ? 'g' : '');
          const result = s.replace(re, (m) => { count++; return rep.replace(/\\&/g, '\x00').replace(/&/g, m).replace(/\x00/g, '&'); });
          assignTo(target, result);
          return count;
        }
        case 'match': {
          const s = toStr(A(0));
          const pat = a[1].type === 'regexlit' ? a[1].v : toStr(A(1));
          const m = new RegExp(posixToJs(pat, true)).exec(s);
          globals.RSTART = m ? m.index + 1 : 0;
          globals.RLENGTH = m ? m[0].length : -1;
          return globals.RSTART;
        }
        case 'sprintf': return LX.formatPrintf(toStr(A(0)), a.slice(1).map(x => { const v = evalExpr(x); return typeof v === 'number' ? v : v; }));
        case 'toupper': return toStr(A(0)).toUpperCase();
        case 'tolower': return toStr(A(0)).toLowerCase();
        case 'int': return Math.trunc(toNum(A(0)));
        case 'sqrt': return Math.sqrt(toNum(A(0)));
        case 'exp': return Math.exp(toNum(A(0)));
        case 'log': return Math.log(toNum(A(0)));
        case 'sin': return Math.sin(toNum(A(0)));
        case 'cos': return Math.cos(toNum(A(0)));
        case 'atan2': return Math.atan2(toNum(A(0)), toNum(A(1)));
        case 'rand': return Math.random();
        case 'srand': return 0;
        case 'system': return 0;
        case 'close': return 0;
        case 'fflush': return 0;
      }
      const fn = ast.funcs[name];
      if (fn) {
        const local = Object.create(null);
        fn.params.forEach((pn, i) => {
          if (a[i] === undefined) local[pn] = '';
          else if (a[i].type === 'var' && arrays[a[i].name]) local[pn] = arrays[a[i].name];
          else local[pn] = evalExpr(a[i]);
        });
        scopes.push(local);
        try { execStmt(fn.body); return ''; }
        catch (e) { if (e instanceof RetSig) return e.v; throw e; }
        finally { scopes.pop(); }
      }
      throw new Error(`calling undefined function ${name}`);
    }

    function execStmt(n) {
      if (!n) return;
      switch (n.type) {
        case 'block': for (const s of n.body) execStmt(s); return;
        case 'expr': evalExpr(n.expr); return;
        case 'print': {
          const parts = n.args.length ? n.args.map(a => toStr(evalExpr(a))) : [toStr(fields[0])];
          out(parts.join(String(globals.OFS)) + String(globals.ORS), n.dest ? evalExpr(n.dest) : null, n.append);
          return;
        }
        case 'printf': {
          const fmt = toStr(evalExpr(n.args[0]));
          const rest = n.args.slice(1).map(a => evalExpr(a));
          out(LX.formatPrintf(fmt, rest), n.dest ? evalExpr(n.dest) : null, n.append);
          return;
        }
        case 'if': if (truthy(evalExpr(n.cond))) execStmt(n.then); else if (n.else) execStmt(n.else); return;
        case 'while': { let g = 0; while (truthy(evalExpr(n.cond))) { if (++g > 200000) throw new Error('loop infinito interrompido'); try { execStmt(n.body); } catch (e) { if (e === BREAK) break; if (e === CONT) continue; throw e; } } return; }
        case 'do': { let g = 0; do { if (++g > 200000) throw new Error('loop infinito interrompido'); try { execStmt(n.body); } catch (e) { if (e === BREAK) break; if (e === CONT) continue; throw e; } } while (truthy(evalExpr(n.cond))); return; }
        case 'for': {
          if (n.init) execStmt(n.init);
          let g = 0;
          while (n.cond ? truthy(evalExpr(n.cond)) : true) {
            if (++g > 200000) throw new Error('loop infinito interrompido');
            try { execStmt(n.body); } catch (e) { if (e === BREAK) break; if (e !== CONT) throw e; }
            if (n.step) execStmt(n.step);
          }
          return;
        }
        case 'forin': {
          const arr = getArr(n.arr);
          for (const k of Object.keys(arr)) {
            setVar(n.var, k);
            try { execStmt(n.body); } catch (e) { if (e === BREAK) break; if (e !== CONT) throw e; }
          }
          return;
        }
        case 'delete': {
          const arr = getArr(n.name);
          if (n.index) delete arr[n.index.map(x => toStr(evalExpr(x))).join(globals.SUBSEP)];
          else for (const k in arr) delete arr[k];
          return;
        }
        case 'break': throw BREAK;
        case 'continue': throw CONT;
        case 'next': throw NEXT;
        case 'exit': exitCode = n.value ? Math.trunc(toNum(evalExpr(n.value))) : 0; throw EXIT;
        case 'return': throw new RetSig(n.value ? evalExpr(n.value) : '');
      }
    }

    // BEGIN
    try {
      for (const r of ast.rules) if (r.pattern && r.pattern.type === 'BEGIN') execStmt(r.action);
    } catch (e) {
      if (e === EXIT) { runEnd(); return exitCode || 0; }
      if (!(e instanceof RetSig)) throw e;
    }

    const needsInput = ast.rules.some(r => !r.pattern || (r.pattern.type !== 'BEGIN'));
    if (needsInput) {
      const lines = input.split(String(globals.RS) === '\n' ? '\n' : new RegExp(posixToJs(String(globals.RS), true)));
      if (lines.length && lines[lines.length - 1] === '') lines.pop();
      const rangeState = new Map();
      outer:
      for (const line of lines) {
        globals.NR = toNum(globals.NR) + 1;
        globals.FNR = toNum(globals.FNR) + 1;
        splitLine(line);
        try {
          for (let ri = 0; ri < ast.rules.length; ri++) {
            const r = ast.rules[ri];
            if (r.pattern && (r.pattern.type === 'BEGIN' || r.pattern.type === 'END')) continue;
            let hit;
            if (!r.pattern) hit = true;
            else if (r.pattern.type === 'range') {
              const active = rangeState.get(ri);
              if (!active) { if (truthy(evalExpr(r.pattern.a))) { rangeState.set(ri, true); hit = true; if (truthy(evalExpr(r.pattern.b))) rangeState.set(ri, false); } else hit = false; }
              else { hit = true; if (truthy(evalExpr(r.pattern.b))) rangeState.set(ri, false); }
            }
            else hit = truthy(evalExpr(r.pattern));
            if (!hit) continue;
            if (r.action) execStmt(r.action);
            else io.stdout.write(toStr(fields[0]) + String(globals.ORS));
          }
        } catch (e) {
          if (e === NEXT) continue;
          if (e === EXIT) break outer;
          if (e instanceof RetSig) continue;
          throw e;
        }
      }
    }
    runEnd();
    function runEnd() {
      try { for (const r of ast.rules) if (r.pattern && r.pattern.type === 'END') execStmt(r.action); }
      catch (e) { if (e !== EXIT && !(e instanceof RetSig)) throw e; }
    }
    return exitCode === null ? 0 : exitCode;
  }

  /* ================================ diff / cmp ================================ */
  defcmd({
    name: 'diff', pkg: 'diffutils',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { u: 0, y: 0, q: 0, i: 0, w: 0, r: 0, c: 0, '--unified': 0, '--brief': 0, '--side-by-side': 0, '--color': 1 });
      if (rest.length < 2) { io.stderr.write('diff: missing operand\n'); return 2; }
      const read = (f) => { try { return sh.m.fs.readFile(P(sh, f), sh.fsopts()); } catch (e) { io.stderr.write(`diff: ${f}: ${e.message}\n`); return null; } };

      /* diff -r compara duas ÁRVORES. É o comando que responde "o backup
         restaurou tudo?" — sem ele, comparar restauro com original vira
         conferência manual. */
      const ehDir = (f) => { try { return sh.m.fs.stat(P(sh, f), sh.fsopts()).type === 'dir'; } catch (e) { return false; } };
      if (opts.r && ehDir(rest[0]) && ehDir(rest[1])) {
        const listar = (base) => {
          const saida = [];
          const anda = (rel) => {
            const abs = P(sh, base) + (rel ? '/' + rel : '');
            let itens = [];
            try { itens = sh.m.fs.readdir(abs, sh.fsopts()); } catch (e) { return; }
            for (const it of itens) {
              const nome = typeof it === 'string' ? it : it.name;
              if (nome === '.' || nome === '..') continue;
              const r2 = rel ? rel + '/' + nome : nome;
              let st; try { st = sh.m.fs.stat(P(sh, base) + '/' + r2, sh.fsopts()); } catch (e) { continue; }
              if (st.type === 'dir') { saida.push([r2, 'dir']); anda(r2); }
              else saida.push([r2, 'file']);
            }
          };
          anda('');
          return saida;
        };
        const A2 = listar(rest[0]), B2 = listar(rest[1]);
        const mapaB = new Map(B2.map(x => [x[0], x[1]]));
        const mapaA = new Map(A2.map(x => [x[0], x[1]]));
        let status = 0;
        for (const [rel, tipo] of A2) {
          if (!mapaB.has(rel)) {
            io.stdout.write(`Only in ${rest[0]}${rel.includes('/') ? '/' + rel.slice(0, rel.lastIndexOf('/')) : ''}: ${rel.split('/').pop()}\n`);
            status = 1; continue;
          }
          if (tipo === 'file' && mapaB.get(rel) === 'file') {
            const x = read(rest[0] + '/' + rel), y = read(rest[1] + '/' + rel);
            if (x !== y) { io.stdout.write(`Files ${rest[0]}/${rel} and ${rest[1]}/${rel} differ\n`); status = 1; }
          }
        }
        for (const [rel] of B2) {
          if (!mapaA.has(rel)) {
            io.stdout.write(`Only in ${rest[1]}${rel.includes('/') ? '/' + rel.slice(0, rel.lastIndexOf('/')) : ''}: ${rel.split('/').pop()}\n`);
            status = 1;
          }
        }
        return status;
      }
      const a = read(rest[0]), b = read(rest[1]);
      if (a === null || b === null) return 2;
      let A = a.split('\n'), Bx = b.split('\n');
      if (A[A.length - 1] === '') A.pop();
      if (Bx[Bx.length - 1] === '') Bx.pop();
      const norm = (s) => opts.i ? (opts.w ? s.replace(/\s+/g, '').toLowerCase() : s.toLowerCase()) : (opts.w ? s.replace(/\s+/g, '') : s);
      if (A.length === Bx.length && A.every((l, i) => norm(l) === norm(Bx[i]))) return 0;
      if (opts.q || opts['--brief']) { io.stdout.write(`Files ${rest[0]} and ${rest[1]} differ\n`); return 1; }
      const script = diffScript(A.map(norm), Bx.map(norm));
      if (opts.u || opts['--unified']) {
        io.stdout.write(`--- ${rest[0]}\t${new Date(sh.m.fs.stat(P(sh, rest[0]), sh.fsopts()).mtime).toISOString()}\n`);
        io.stdout.write(`+++ ${rest[1]}\t${new Date(sh.m.fs.stat(P(sh, rest[1]), sh.fsopts()).mtime).toISOString()}\n`);
        const hunks = buildHunks(script, A, Bx, 3);
        for (const h of hunks) {
          io.stdout.write(`@@ -${h.aStart},${h.aLen} +${h.bStart},${h.bLen} @@\n`);
          for (const l of h.lines) io.stdout.write(l + '\n');
        }
        return 1;
      }
      // formato clássico
      let i = 0;
      while (i < script.length) {
        if (script[i].op === '=') { i++; continue; }
        let j = i;
        const dels = [], adds = [];
        while (j < script.length && script[j].op !== '=') { if (script[j].op === '-') dels.push(script[j]); else adds.push(script[j]); j++; }
        const aStart = dels.length ? dels[0].ai + 1 : (script[i].ai + 1);
        const aEnd = dels.length ? dels[dels.length - 1].ai + 1 : aStart - 1;
        const bStart = adds.length ? adds[0].bi + 1 : (script[i].bi + 1);
        const bEnd = adds.length ? adds[adds.length - 1].bi + 1 : bStart - 1;
        const range = (s, e) => s === e ? String(s) : `${s},${e}`;
        if (dels.length && adds.length) io.stdout.write(`${range(aStart, aEnd)}c${range(bStart, bEnd)}\n`);
        else if (dels.length) io.stdout.write(`${range(aStart, aEnd)}d${bStart - 1}\n`);
        else io.stdout.write(`${aStart - 1}a${range(bStart, bEnd)}\n`);
        for (const d of dels) io.stdout.write('< ' + A[d.ai] + '\n');
        if (dels.length && adds.length) io.stdout.write('---\n');
        for (const ad of adds) io.stdout.write('> ' + Bx[ad.bi] + '\n');
        i = j;
      }
      return 1;
    }
  });
  function diffScript(A, B) {
    // LCS simples (suficiente para arquivos didáticos)
    const n = A.length, m = B.length;
    if (n * m > 400000) {
      const out = [];
      for (let i = 0; i < n; i++) out.push({ op: '-', ai: i, bi: -1 });
      for (let j = 0; j < m; j++) out.push({ op: '+', ai: -1, bi: j });
      return out;
    }
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push({ op: '=', ai: i, bi: j }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: '-', ai: i, bi: j }); i++; }
      else { out.push({ op: '+', ai: i, bi: j }); j++; }
    }
    while (i < n) { out.push({ op: '-', ai: i, bi: j }); i++; }
    while (j < m) { out.push({ op: '+', ai: i, bi: j }); j++; }
    return out;
  }
  function buildHunks(script, A, B, ctx) {
    const hunks = [];
    let i = 0;
    while (i < script.length) {
      if (script[i].op === '=') { i++; continue; }
      let start = Math.max(0, i - ctx);
      let end = i;
      while (end < script.length) {
        if (script[end].op !== '=') { end++; continue; }
        let k = end, same = 0;
        while (k < script.length && script[k].op === '=' && same < ctx * 2) { k++; same++; }
        if (same >= ctx * 2 || k >= script.length) break;
        end = k;
      }
      const stop = Math.min(script.length, end + ctx);
      const lines = [];
      let aStart = null, bStart = null, aLen = 0, bLen = 0;
      for (let k = start; k < stop; k++) {
        const s = script[k];
        if (aStart === null && s.ai >= 0) aStart = s.ai + 1;
        if (bStart === null && s.bi >= 0) bStart = s.bi + 1;
        if (s.op === '=') { lines.push(' ' + A[s.ai]); aLen++; bLen++; }
        else if (s.op === '-') { lines.push('-' + A[s.ai]); aLen++; }
        else { lines.push('+' + B[s.bi]); bLen++; }
      }
      hunks.push({ aStart: aStart || 1, bStart: bStart || 1, aLen, bLen, lines });
      i = stop;
    }
    return hunks;
  }

  defcmd({
    name: 'cmp', pkg: 'diffutils',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { s: 0, l: 0 });
      if (rest.length < 2) { io.stderr.write('cmp: missing operand\n'); return 2; }
      let a, b;
      try { a = sh.m.fs.readFile(P(sh, rest[0]), sh.fsopts()); b = sh.m.fs.readFile(P(sh, rest[1]), sh.fsopts()); }
      catch (e) { io.stderr.write(`cmp: ${e.message}\n`); return 2; }
      if (a === b) return 0;
      let line = 1;
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          if (i >= a.length) { if (!opts.s) io.stderr.write(`cmp: EOF on ${rest[0]} after byte ${a.length}\n`); return 1; }
          if (i >= b.length) { if (!opts.s) io.stderr.write(`cmp: EOF on ${rest[1]} after byte ${b.length}\n`); return 1; }
          if (!opts.s) io.stdout.write(`${rest[0]} ${rest[1]} differ: byte ${i + 1}, line ${line}\n`);
          return 1;
        }
        if (a[i] === '\n') line++;
      }
      return 1;
    }
  });

  /* ================================ tree ================================ */
  defcmd({
    name: 'tree', pkg: 'tree',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { a: 0, d: 0, L: 1, f: 0, F: 0, i: 0, p: 0, s: 0, h: 0, '--noreport': 0 });
      const base = rest.length ? rest[0] : '.';
      const maxLevel = opts.L ? +opts.L : Infinity;
      let dirs = 0, files = 0;
      let root;
      try { root = sh.m.fs.stat(P(sh, base), sh.fsopts()); }
      catch (e) { io.stdout.write(`${base} [error opening dir]\n\n0 directories, 0 files\n`); return 1; }
      io.stdout.write((opts.f ? P(sh, base) : base) + '\n');
      const walk = (path, node, prefix, level) => {
        if (level > maxLevel) return;
        let names;
        try { names = Array.from(node.children.keys()).sort((a, b) => a.localeCompare(b, 'en')); }
        catch (e) { return; }
        if (!opts.a) names = names.filter(n => !n.startsWith('.'));
        let entries = names.map(n => ({ n, node: node.children.get(n) }));
        if (opts.d) entries = entries.filter(e => e.node.type === 'dir');
        entries.forEach((e, idx) => {
          const last = idx === entries.length - 1;
          const branch = last ? '└── ' : '├── ';
          let label = e.n;
          if (opts.p) label = LX.modeToRwx(e.node.mode, e.node.type) + ' ' + label;
          if (opts.s) label = `[${String(e.node.size).padStart(11)}]  ` + label;
          if (opts.h) label = `[${LX.humanSize(e.node.size).padStart(6)}]  ` + label;
          const color = e.node.type === 'dir' ? C.dir : (e.node.type === 'link' ? C.link : ((e.node.mode & 0o111) ? C.exec : ''));
          io.stdout.write(prefix + branch + (color ? color + label + C.reset : label) + (opts.F && e.node.type === 'dir' ? '/' : '') + (e.node.type === 'link' ? ' -> ' + e.node.target : '') + '\n');
          if (e.node.type === 'dir') { dirs++; walk(FileSystem.join(path, e.n), e.node, prefix + (last ? '    ' : '│   '), level + 1); }
          else files++;
        });
      };
      if (root.type === 'dir') walk(P(sh, base), root, '', 1);
      if (!opts['--noreport']) io.stdout.write(`\n${dirs} ${dirs === 1 ? 'directory' : 'directories'}, ${files} ${files === 1 ? 'file' : 'files'}\n`);
      return 0;
    }
  });

  /* ================================ which / whereis / locate ================================ */
  defcmd({
    name: 'which', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { a: 0 });
      let status = 0;
      for (const a of rest) {
        const dirs = (sh.getVar('PATH') || '').split(':').filter(Boolean);
        let found = false;
        for (const d of dirs) {
          const p = FileSystem.join(d, a);
          try {
            const st = sh.m.fs.stat(p, sh.fsopts());
            if (st.type !== 'dir' && (st.mode & 0o111)) { io.stdout.write(p + '\n'); found = true; if (!opts.a) break; }
          } catch (e) { }
        }
        if (!found) status = 1;
      }
      return status;
    }
  });
  defcmd({
    name: 'whereis', run: async ({ sh, io, args }) => {
      for (const a of args.filter(x => !x.startsWith('-'))) {
        const hits = [];
        for (const d of ['/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/bin', '/usr/games']) {
          const p = FileSystem.join(d, a);
          if (sh.m.fs.exists(p, sh.fsopts())) hits.push(p);
        }
        const man = `/usr/share/man/man1/${a}.1.gz`;
        if (LX.MAN_PAGES && LX.MAN_PAGES[a]) hits.push(man);
        io.stdout.write(`${a}: ${hits.join(' ')}\n`);
      }
      return 0;
    }
  });
  defcmd({
    name: ['locate', 'plocate'], path: '/usr/bin/', pkg: 'plocate',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { i: 0, l: 1, c: 0, b: 0 });
      if (!sh.m.locateDb) { io.stderr.write('locate: can not stat () `/var/lib/plocate/plocate.db\': No such file or directory\nDica: rode "sudo updatedb" primeiro para criar o banco de dados.\n'); return 1; }
      const pat = rest[0] || '';
      const re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), opts.i ? 'i' : '');
      let hits = sh.m.locateDb.filter(p => re.test(opts.b ? FileSystem.basename(p) : p));
      if (opts.l) hits = hits.slice(0, +opts.l);
      if (opts.c) { io.stdout.write(hits.length + '\n'); return 0; }
      hits.forEach(h => io.stdout.write(h + '\n'));
      return hits.length ? 0 : 1;
    }
  });
  defcmd({
    name: 'updatedb', path: '/usr/sbin/updatedb', pkg: 'plocate', needsRoot: true,
    run: async ({ sh, io }) => {
      if (sh.uid !== 0) { io.stderr.write('updatedb: You are not authorized to update the database\n'); return 1; }
      const db = [];
      sh.m.fs.walk('/', (p) => { if (!p.startsWith('/proc') && !p.startsWith('/sys')) db.push(p); }, { ctx: sh.m.ctxRoot() });
      sh.m.locateDb = db;
      return 0;
    }
  });
})();
