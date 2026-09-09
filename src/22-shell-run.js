/* =========================================================================
   TERMINALIS — Bash: executor, redirecionamentos e comandos internos
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, SysError, Stream, InStream, Expander, Shell, arith, matchGlob, globToRegex } = LX;
  const { OutputLimit, LoopLimit, ReturnSignal, BreakSignal, ContinueSignal, ExitSignal } = LX;

  LX.COMMANDS = {};
  LX.COMMANDS_BY_PATH = {};

  /* Registra um comando "externo" (aparece em /usr/bin, respeita PATH e bit x) */
  LX.defcmd = function (spec) {
    const names = Array.isArray(spec.name) ? spec.name : [spec.name];
    for (const n of names) {
      const path = spec.path ? (spec.path.endsWith('/') ? spec.path + n : spec.path) : '/usr/bin/' + n;
      const entry = { name: n, path, run: spec.run, help: spec.help, pkg: spec.pkg || 'coreutils', usage: spec.usage, needsRoot: spec.needsRoot, soImagem: spec.soImagem };
      LX.COMMANDS[n] = entry;
      LX.COMMANDS_BY_PATH[path] = entry;
    }
  };

  /* Popula o VFS com os binários registrados */
  LX.installBinaries = function (machine) {
    const ctx = machine.ctxRoot();
    for (const name in LX.COMMANDS) {
      const c = LX.COMMANDS[name];
      /* Binários que só existem dentro de certas imagens (psql, node,
         redis-cli...). Quem os coloca em cena é a imagem, não o sistema —
         senão o host teria mariadb instalado sem ninguém ter instalado. */
      if (c.soImagem) continue;
      try {
        machine.fs.mkdirp(FileSystem.dirname(c.path), { ctx });
        const n = machine.fs.writeFile(c.path, `\x7fELF binário: ${name}\n`, { ctx });
        n.mode = 0o755;
        if (c.suid) n.mode |= 0o4000;
      } catch (e) { }
    }
    // alguns binários com SUID (exemplos reais e didáticos)
    ['/usr/bin/sudo', '/usr/bin/passwd', '/usr/bin/su'].forEach(p => {
      try { const n = machine.fs.stat(p, { ctx }); n.mode = 0o4755; } catch (e) { }
    });
  };

  /* ============================ Streams de arquivo ============================ */
  class FileStream extends Stream {
    constructor(sh, path, append) {
      super({ limit: 5_000_000 });
      this.sh = sh; this.path = path;
      // o arquivo é aberto AGORA, com a identidade atual: um "sudo cmd > arq"
      // grava com o usuário que abriu o redirecionamento, como no shell real
      const opts = sh.fsopts();
      this.opts = opts;
      if (path === '/dev/null') { this.devnull = true; return; }
      try {
        if (append) { if (!sh.m.fs.exists(path, opts)) sh.m.fs.create(path, '', opts); }
        else sh.m.fs.create(path, '', opts);
      } catch (e) { throw e; }
    }
    write(s) {
      if (this.devnull) return;
      if (s === undefined || s === null || s === '') return;
      this.sh.m.fs.appendFile(this.path, String(s), this.opts);
    }
  }
  class NullStream extends Stream { write() { } }

  /* ================================ EXECUTOR ================================ */
  class Executor {
    constructor(sh, io) {
      this.sh = sh;
      this.io = io;
      this.exp = new Expander(sh, io);
      this.loopDepth = 0;
    }

    checkAbort() {
      if (this.io.term && this.io.term.aborted) { const e = new LX.InterruptSignal(); throw e; }
    }

    async run(src) {
      const ast = LX.parse(src);
      return await this.execList(ast.body);
    }

    async execList(list) {
      let status = this.sh.lastStatus;
      for (const item of list.items) {
        this.checkAbort();
        if (item.sep === 'bg') { status = await this.runBackground(item.node); continue; }
        this._curtoCircuito = false;
        status = await this.execNode(item.node);
        this.sh.lastStatus = status;
        if (this.sh.opts.e && status !== 0 && !this._inCond && !this._curtoCircuito) {
          throw new ExitSignal(status);
        }
        this._curtoCircuito = false;
      }
      return status;
    }

    async runBackground(node) {
      const sh = this.sh;
      const desc = describeNode(node);
      const pid = ++sh.m.nextPid;
      const proc = sh.m.spawn({ pid, ppid: sh.pid, cmd: desc, user: sh.user, uid: sh.uid, gid: sh.gid, tty: 'pts/0', state: 'S' });
      const job = { id: sh.jobs.filter(j => j.state !== 'Done').length + 1, pid, cmd: desc, state: 'Running' };
      sh.jobs.push(job);
      sh.lastBgPid = pid;
      this.io.stdout.write(`[${job.id}] ${pid}\n`);
      const sub = new Executor(sh, this.io);
      sub._bgJob = job;
      const p = (async () => {
        try { await sub.execNode(node); }
        catch (e) { if (!(e && (e.isExit || e.isInterrupt))) { /* silencioso */ } }
        job.state = 'Done';
        job.doneAt = Date.now();
        sh.m.processes.delete(pid);
      })();
      job.promise = p;
      return 0;
    }

    async execNode(node) {
      if (!node) return 0;
      this.checkAbort();
      switch (node.type) {
        case 'list': return await this.execList(node);
        case 'andor': {
          const prevCond = this._inCond;
          this._inCond = true;
          let l;
          try { l = await this.execNode(node.left); } finally { this._inCond = prevCond; }
          this.sh.lastStatus = l;
          /* Curto-circuito: quando a lista para no lado esquerdo, o `set -e`
             não derruba o script. É a regra do POSIX ("o -e é ignorado em
             qualquer comando de uma lista AND-OR que não seja o último") e é
             o que faz o idioma `[ cond ] && acao` ser seguro sob set -e. */
          if (node.op === '&&' && l !== 0) { this._curtoCircuito = true; return l; }
          if (node.op === '||' && l === 0) { this._curtoCircuito = true; return l; }
          return await this.execNode(node.right);
        }
        case 'pipeline': return await this.execPipeline(node);
        case 'simple': return await this.execSimple(node);
        case 'if': return await this.comRedirs(node, (ex) => ex.execIf(node));
        case 'while': case 'until': return await this.comRedirs(node, (ex) => ex.execWhile(node));
        // redirecionamentos em blocos: "for ... done > arq", "if ... fi > arq"
        case 'for': return await this.comRedirs(node, (ex) => ex.execFor(node));
        case 'cfor': return await this.comRedirs(node, (ex) => ex.execCFor(node));
        case 'case': return await this.comRedirs(node, (ex) => ex.execCase(node));
        case 'aritmetico': {
          /* status 0 quando o valor é diferente de zero — a mesma convenção
             estranha e útil que o bash usa, para servir de condição. */
          let v = 0;
          try { v = arith(node.expr, this.sh); }
          catch (e) { this.io.stderr.write(`${this.sh.nomeShell}: ((: ${e.message}\n`); return 1; }
          return v !== 0 ? 0 : 1;
        }
        case 'group': return await this.withRedirs(node.redirs, async (io) => {
          const sub = new Executor(this.sh, io); return await sub.execList(node.body);
        });
        case 'subshell': {
          const sub = this.sh.clone();
          return await this.withRedirs(node.redirs, async (io) => {
            const ex = new Executor(sub, io);
            try { return await ex.execList(node.body); }
            catch (e) { if (e && e.isExit) return e.code; throw e; }
          });
        }
        case 'dbracket': return await this.execDBracket(node);
        case 'funcdef': this.sh.funcs.set(node.name, node.body); return 0;
        default: return 0;
      }
    }

    /* Executa um bloco aplicando os redirecionamentos declarados nele */
    async comRedirs(node, fn) {
      if (!node.redirs || !node.redirs.length) return await fn(this);
      return await this.withRedirs(node.redirs, async (io) => {
        const sub = new Executor(this.sh, io);
        sub.loopDepth = this.loopDepth;
        sub._inCond = this._inCond;
        return await fn(sub);
      });
    }

    async execIf(node) {
      const prevCond = this._inCond; this._inCond = true;
      let c;
      try { c = await this.execList(node.cond); } finally { this._inCond = prevCond; }
      if (c === 0) return await this.execList(node.then);
      if (node.else) return await this.execList(node.else);
      return 0;
    }

    async execWhile(node) {
      let status = 0, iter = 0;
      this.loopDepth++;
      try {
        while (true) {
          if (++iter > MAXLOOP) throw new LoopLimit();
          this.checkAbort();
          const prevCond = this._inCond; this._inCond = true;
          let c;
          try { c = await this.execList(node.cond); } finally { this._inCond = prevCond; }
          const ok = node.type === 'while' ? c === 0 : c !== 0;
          if (!ok) break;
          try { status = await this.execList(node.body); }
          catch (e) {
            if (e instanceof BreakSignal) { if (--e.n > 0) throw e; break; }
            if (e instanceof ContinueSignal) { if (--e.n > 0) throw e; continue; }
            throw e;
          }
          if (iter % 200 === 0) await tick();
        }
      } finally { this.loopDepth--; }
      return status;
    }

    async execFor(node) {
      const items = node.items === null
        ? this.sh.positional.slice()
        : await this.exp.expandWords(node.items);
      let status = 0, iter = 0;
      this.loopDepth++;
      try {
        for (const it of items) {
          if (++iter > MAXLOOP) throw new LoopLimit();
          this.checkAbort();
          this.sh.setVar(node.name, it);
          try { status = await this.execList(node.body); }
          catch (e) {
            if (e instanceof BreakSignal) { if (--e.n > 0) throw e; break; }
            if (e instanceof ContinueSignal) { if (--e.n > 0) throw e; continue; }
            throw e;
          }
          if (iter % 200 === 0) await tick();
        }
      } finally { this.loopDepth--; }
      return status;
    }

    async execCFor(node) {
      let status = 0, iter = 0;
      if (node.init.trim()) arith(await this.exp.expandForArith(node.init), this.sh);
      this.loopDepth++;
      try {
        while (arith(await this.exp.expandForArith(node.cond.trim() || '1'), this.sh)) {
          if (++iter > MAXLOOP) throw new LoopLimit();
          this.checkAbort();
          try { status = await this.execList(node.body); }
          catch (e) {
            if (e instanceof BreakSignal) { if (--e.n > 0) throw e; break; }
            if (e instanceof ContinueSignal) { if (--e.n > 0) throw e; if (node.step.trim()) arith(await this.exp.expandForArith(node.step), this.sh); continue; }
            throw e;
          }
          if (node.step.trim()) arith(await this.exp.expandForArith(node.step), this.sh);
          if (iter % 200 === 0) await tick();
        }
      } finally { this.loopDepth--; }
      return status;
    }

    async execCase(node) {
      const subj = (await this.exp.expandWord(node.subject, { noSplit: true, noGlob: true }))[0] || '';
      for (const cl of node.clauses) {
        for (const pw of cl.pats) {
          const pat = (await this.exp.expandWord(pw, { noSplit: true, noGlob: true }))[0] || '';
          if (pat === '*' || matchGlob(subj, pat)) {
            return await this.execList(cl.body);
          }
        }
      }
      return 0;
    }

    async execDBracket(node) {
      // reconstrói argumentos, mantendo operadores
      const args = [];
      for (const w of node.words) {
        if (w.op) { args.push({ op: w.op }); continue; }
        const plain = w.word.plain;
        if (plain === '=~') { args.push({ op: '=~' }); continue; }
        const vals = await this.exp.expandWord(w.word, { noSplit: true, noGlob: true });
        args.push({ val: vals.join(' '), quoted: w.word.isQuoted, raw: w.word.raw });
      }
      try {
        const r = evalDBracket(args, this.sh);
        return r ? 0 : 1;
      } catch (e) {
        this.io.stderr.write(`${this.sh.nomeShell}: [[: ${e.message}\n`);
        return 2;
      }
    }

    async execPipeline(node) {
      const sh = this.sh;
      const statuses = [];
      let input = new InStream('');
      let last = 0;
      for (let i = 0; i < node.cmds.length; i++) {
        const isLast = i === node.cmds.length - 1;
        const out = isLast ? this.io.stdout : new Stream({ limit: 2_000_000 });
        const errStream = node.cmds[i].pipeStderr && !isLast ? out : this.io.stderr;
        const io = { stdin: input, stdout: out, stderr: errStream, term: this.io.term, inPipe: !isLast };
        const ex = new Executor(sh, io);
        ex._inCond = this._inCond;
        let st;
        try { st = await ex.execNode(node.cmds[i]); }
        catch (e) {
          if (e instanceof OutputLimit) { this.io.stderr.write('\n[saída truncada: limite do ambiente]\n'); st = 1; }
          else throw e;
        }
        statuses.push(st);
        last = st;
        if (!isLast) input = new InStream(out.value());
      }
      sh.pipestatus = statuses;
      sh.setVar('PIPESTATUS', statuses.join(' '));
      sh.setArray('PIPESTATUS', statuses.map(String));
      let result = last;
      if (sh.opts.pipefail) { const bad = statuses.filter(s => s !== 0); if (bad.length) result = bad[bad.length - 1]; }
      if (node.bang) result = result === 0 ? 1 : 0;
      return result;
    }

    /* ---------------- redirecionamentos ---------------- */
    async withRedirs(redirs, fn) {
      if (!redirs || !redirs.length) return await fn(this.io);
      const sh = this.sh;
      const io = Object.assign({}, this.io);
      const closers = [];
      for (const r of redirs) {
        let targetPath = null;
        if (r.target) {
          const t = await this.exp.expandWord(r.target, { noSplit: true });
          targetPath = t[0];
          if (t.length > 1) { this.io.stderr.write((this.sh.nomeShell + ': ambiguous redirect\n')); return 1; }
        }
        try {
          switch (r.op) {
            case '>': case '>|': {
              const fd = r.fd === undefined ? 1 : r.fd;
              const st = targetPath === '/dev/null' ? new NullStream() : new FileStream(sh, resolveOut(sh, targetPath), false);
              if (fd === 1) io.stdout = st; else if (fd === 2) io.stderr = st; else io['fd' + fd] = st;
              break;
            }
            case '>>': {
              const fd = r.fd === undefined ? 1 : r.fd;
              const st = targetPath === '/dev/null' ? new NullStream() : new FileStream(sh, resolveOut(sh, targetPath), true);
              if (fd === 1) io.stdout = st; else if (fd === 2) io.stderr = st; else io['fd' + fd] = st;
              break;
            }
            case '&>': case '&>>': {
              const st = targetPath === '/dev/null' ? new NullStream() : new FileStream(sh, resolveOut(sh, targetPath), r.op === '&>>');
              io.stdout = st; io.stderr = st;
              break;
            }
            case '<': {
              if (targetPath === '/dev/null') { io.stdin = new InStream(''); break; }
              const data = sh.m.fs.readFile(targetPath, sh.fsopts());
              io.stdin = new InStream(data);
              break;
            }
            case '<<': {
              let text = r.heredoc || '';
              if (!r.quoted) text = (await this.exp.expandDollars(text, true)).join('');
              io.stdin = new InStream(text);
              break;
            }
            case '<<<': {
              const t = (await this.exp.expandWord(r.target, { noSplit: true }))[0] || '';
              io.stdin = new InStream(t + '\n');
              break;
            }
            case '>&': case '<&': {
              const fdFrom = r.fd === undefined ? 1 : r.fd;
              if (targetPath === '1') { if (fdFrom === 2) io.stderr = io.stdout; }
              else if (targetPath === '2') { if (fdFrom === 1) io.stdout = io.stderr; }
              else if (targetPath === '-') { if (fdFrom === 1) io.stdout = new NullStream(); else io.stderr = new NullStream(); }
              else {
                const st = new FileStream(sh, resolveOut(sh, targetPath), false);
                if (fdFrom === 1) io.stdout = st; else io.stderr = st;
              }
              break;
            }
          }
        } catch (e) {
          if (e && e.isSysError) { this.io.stderr.write(`${this.sh.nomeShell}: ${targetPath}: ${e.message}\n`); return 1; }
          throw e;
        }
      }
      return await fn(io);
    }

    /* ---------------- comando simples ---------------- */
    async execSimple(node) {
      const sh = this.sh;
      // atribuições sem comando
      let words = [];
      try {
        words = await this.exp.expandWords(node.words);
      } catch (e) {
        if (e && e.shellError) { this.io.stderr.write(`${this.sh.nomeShell}: ${e.message}\n`); return e.status || 1; }
        throw e;
      }

      if (words.length === 0) {
        for (const a of node.assigns) {
          const vals = await this.exp.expandWord(a.word, { noSplit: true, noGlob: !/[\*\?\[]/.test(a.word.raw) });
          if (a.word.raw.startsWith('(') && a.word.raw.endsWith(')')) {
            const inner = a.word.raw.slice(1, -1);
            const toks = LX.tokenize(inner).filter(t => t.type === 'word').map(t => t.word);
            const novos = await this.exp.expandWords(toks);
            /* `arr+=(d e)` acrescenta ao fim; sem isto o += substituía o
               array inteiro, que é o oposto do que o operador significa. */
            sh.setArray(a.name, a.append ? (sh.getArray(a.name) || []).concat(novos) : novos);
            continue;
          }
          const m = /^([A-Za-z_][A-Za-z0-9_]*)\[(.+)\]$/.exec(a.name);
          if (m) {
            const arr = (sh.getArray(m[1]) || []).slice();
            arr[arith(m[2], sh)] = vals.join(' ');
            sh.setArray(m[1], arr);
            continue;
          }
          try {
            if (a.append) sh.setVar(a.name, (sh.getVar(a.name) || '') + vals.join(' '));
            else sh.setVar(a.name, vals.join(' '));
          } catch (e) { this.io.stderr.write(`${this.sh.nomeShell}: ${e.message}\n`); return 1; }
        }
        return 0;
      }

      // expansão de alias (apenas a primeira palavra, uma vez)
      if (!node._aliasDone && sh.aliases.has(words[0])) {
        const expansion = sh.aliases.get(words[0]);
        const rest = words.slice(1);
        const src = expansion + (rest.length ? ' ' + rest.map(shQuote).join(' ') : '');
        const sub = LX.parse(src);
        const first = sub.body.items[0];
        if (first) {
          if (first.node.type === 'simple') { first.node._aliasDone = true; first.node.redirs = (first.node.redirs || []).concat(node.redirs); }
          const ex = new Executor(sh, this.io);
          ex._inCond = this._inCond;
          return await ex.execList(sub.body);
        }
      }

      // variáveis temporárias VAR=x cmd
      const saved = [];
      for (const a of node.assigns) {
        const vals = await this.exp.expandWord(a.word, { noSplit: true });
        saved.push([a.name, sh.vars.get(a.name)]);
        sh.setVar(a.name, vals.join(' '), true);
      }

      let status;
      try {
        status = await this.withRedirs(node.redirs, async (io) => await this.dispatch(words, io, node));
      } finally {
        for (const [name, old] of saved) { if (old) sh.vars.set(name, old); else sh.vars.delete(name); }
      }
      sh.setVar('_', words[words.length - 1]);
      return status;
    }

    async dispatch(words, io, node) {
      const sh = this.sh;
      const name = words[0];
      const args = words.slice(1);
      if (sh.opts.x) this.io.stderr.write('+ ' + words.join(' ') + '\n');

      // funções
      if (sh.funcs.has(name) && !BUILTIN_FORCE.has(name)) {
        return await this.callFunction(name, args, io);
      }
      // builtins
      if (BUILTINS[name]) {
        try {
          return await BUILTINS[name]({ sh, io, args, name, ex: this, exp: this.exp });
        } catch (e) {
          if (e && (e.isExit || e.isReturn || e instanceof BreakSignal || e instanceof ContinueSignal || e.isInterrupt || e.isLimit)) throw e;
          if (e && e.isSysError) { io.stderr.write(`${name}: ${e.format()}\n`); return 1; }
          if (e && e.shellError) { io.stderr.write(`${sh.nomeShell}: ${name}: ${e.message}\n`); return 1; }
          throw e;
        }
      }
      return await this.execExternal(name, args, io);
    }

    async callFunction(name, args, io) {
      const sh = this.sh;
      if (sh.funcDepth > 60) { io.stderr.write((sh.nomeShell + ': maximum function nesting level exceeded\n')); return 1; }
      const body = sh.funcs.get(name);
      const savedPos = sh.positional;
      const savedName = sh.scriptName;
      sh.positional = args;
      sh.funcDepth++;
      sh.localStack.push([]);
      try {
        const ex = new Executor(sh, io);
        return await ex.execNode(body);
      } catch (e) {
        if (e && e.isReturn) return e.code;
        throw e;
      } finally {
        const locals = sh.localStack.pop() || [];
        for (const [n, old] of locals) { if (old === undefined) sh.vars.delete(n); else sh.vars.set(n, old); }
        sh.positional = savedPos;
        sh.scriptName = savedName;
        sh.funcDepth--;
      }
    }

    async execExternal(name, args, io) {
      const sh = this.sh;
      let path = null, node = null;
      if (name.includes('/')) {
        const p = FileSystem.normalize(name, sh.cwd);
        try { node = sh.m.fs.stat(p, sh.fsopts()); path = p; }
        catch (e) {
          if (e.code === 'ENOENT') { io.stderr.write(`${sh.nomeShell}: ${name}: No such file or directory\n`); return 127; }
          if (e.code === 'EACCES') { io.stderr.write(`${sh.nomeShell}: ${name}: Permission denied\n`); return 126; }
          throw e;
        }
      } else {
        const dirs = (sh.getVar('PATH') || '').split(':').filter(Boolean);
        for (const d of dirs) {
          const p = FileSystem.join(d, name);
          try {
            const st = sh.m.fs.stat(p, sh.fsopts());
            if (st.type === 'dir') continue;
            node = st; path = p; break;
          } catch (e) { continue; }
        }
        if (!node) {
          return this.commandNotFound(name, io);
        }
      }
      if (node.type === 'dir') { io.stderr.write(`${sh.nomeShell}: ${name}: Is a directory\n`); return 126; }
      if (!sh.m.fs.can(node, 'x', sh.ctx)) { io.stderr.write(`${sh.nomeShell}: ${name}: Permission denied\n`); return 126; }

      /* /bin é um link para /usr/bin: chamar /bin/sh tem que encontrar o
         mesmo binário que /usr/bin/sh. A busca é pelo caminho já resolvido,
         não pelo que foi digitado. */
      let impl = LX.COMMANDS_BY_PATH[path];
      if (!impl) {
        try {
          const real = sh.m.fs.lookup(path, sh.fsopts()).path;
          if (real && real !== path) impl = LX.COMMANDS_BY_PATH[real];
        } catch (e) { }
      }
      if (impl) {
        try {
          const r = await impl.run({ sh, io, args, name, ex: this, exp: this.exp, path });
          return r === undefined ? 0 : r;
        } catch (e) {
          if (e && (e.isExit || e.isInterrupt || e.isLimit || e.isReturn)) throw e;
          if (e && e.isSysError) { io.stderr.write(`${name}: ${e.format()}\n`); return 1; }
          if (e && e.shellError) { io.stderr.write(`${name}: ${e.message}\n`); return 1; }
          io.stderr.write(`${name}: erro interno: ${e.message}\n`);
          return 1;
        }
      }

      // script com shebang
      const content = node.read();
      if (content.startsWith('#!')) {
        const shebang = content.slice(2, content.indexOf('\n') > 0 ? content.indexOf('\n') : content.length).trim();
        const interp = shebang.split(/\s+/)[0];
        const base = interp.split('/').pop();
        if (base === 'env') {
          const real = shebang.split(/\s+/)[1] || 'bash';
          if (!['bash', 'sh'].includes(real)) { io.stderr.write(`${name}: ${real}: interpretador não disponível neste ambiente\n`); return 127; }
        } else if (!['bash', 'sh', 'dash'].includes(base)) {
          io.stderr.write(`${sh.nomeShell}: ${name}: ${interp}: bad interpreter: No such file or directory\n`);
          return 126;
        }
        return await this.runScript(content, path, args, io);
      }
      if (/[\x00-\x08]/.test(content.slice(0, 40)) || content.startsWith('\x7fELF')) {
        io.stderr.write(`${sh.nomeShell}: ${name}: cannot execute binary file: Exec format error\n`);
        return 126;
      }
      return await this.runScript(content, path, args, io);
    }

    commandNotFound(name, io) {
      const sh = this.sh;
      // sugestão no estilo do Ubuntu
      const known = LX.COMMANDS[name];
      if (known) {
        io.stderr.write(`${sh.nomeShell}: ${name}: command not found\n`);
        return 127;
      }
      let pkg = null;
      for (const [pn, meta] of sh.m.aptCache) {
        if ((meta.provides || []).some(f => f.path.endsWith('/' + name))) { pkg = pn; break; }
      }
      if (pkg) {
        io.stderr.write(`Command '${name}' not found, but can be installed with:\n\nsudo apt install ${pkg}\n`);
        return 127;
      }
      io.stderr.write(`${sh.nomeShell}: ${name}: command not found\n`);
      return 127;
    }

    async runScript(content, path, args, io) {
      const sh = this.sh;
      // executar um script é criar um processo: só o ambiente exportado atravessa
      const sub = sh.clone({ soExportadas: true });
      sub.positional = args;
      sub.scriptName = path;
      sub.setVar('BASH_SOURCE', path);
      const ex = new Executor(sub, io);
      let status = 0;
      try {
        status = await ex.run(content);
      } catch (e) {
        if (e && e.isExit) status = e.code;
        else if (e && e.isParseError) { io.stderr.write(`${path}: line ?: ${e.message}\n`); status = 2; }
        else if (e && e.isLimit) { io.stderr.write(`\n${path}: ${e.message}\n`); status = 1; }
        else { await ex.dispararTrapExit(io, 1); throw e; }
      }
      /* O trap de EXIT roda quando o script termina — por sucesso, por erro,
         por `exit` explícito ou por `set -e`. É justamente isso que faz dele o
         lugar certo para apagar arquivo temporário. */
      const trapado = await ex.dispararTrapExit(io, status);
      return trapado === null ? status : trapado;
    }

    /* Executa o handler de EXIT uma única vez. Devolve null se não havia
       trap, ou o status final (o handler pode chamar `exit` com outro código). */
    async dispararTrapExit(io, status) {
      const sub = this.sh;
      const acao = sub.traps && sub.traps.EXIT;
      if (!acao || sub._trapExitRodou) return null;
      sub._trapExitRodou = true;
      const anterior = sub.lastStatus;
      sub.lastStatus = status;
      try {
        const ex2 = new Executor(sub, io);
        await ex2.run(acao);
      } catch (e) {
        if (e && e.isExit) return e.code;
      } finally {
        sub.lastStatus = anterior;
      }
      return null;
    }
  }
  LX.Executor = Executor;

  const MAXLOOP = 100000;
  function tick() { return new Promise(r => setTimeout(r, 0)); }
  LX.tick = tick;

  function resolveOut(sh, p) { return FileSystem.normalize(p, sh.cwd); }
  function shQuote(s) { return /[^A-Za-z0-9_@%+=:,./-]/.test(s) ? "'" + s.replace(/'/g, `'\\''`) + "'" : s; }
  LX.shQuote = shQuote;

  function describeNode(node) {
    if (node.type === 'simple') return node.words.map(w => w.raw).join(' ');
    if (node.type === 'pipeline') return node.cmds.map(describeNode).join(' | ');
    return node.type;
  }

  /* ======================= test / [ / [[ ======================= */
  function fileTest(sh, op, path) {
    const opts = sh.fsopts();
    let st = null;
    try { st = op === 'L' || op === 'h' ? sh.m.fs.lstat(path, opts) : sh.m.fs.stat(path, opts); }
    catch (e) { return false; }
    switch (op) {
      case 'e': return true;
      case 'f': return st.type === 'file';
      case 'd': return st.type === 'dir';
      case 'L': case 'h': return st.type === 'link';
      case 'b': return st.type === 'blk';
      case 'c': return st.type === 'chr';
      case 'p': return st.type === 'fifo';
      case 'S': return st.type === 'sock';
      case 's': return st.size > 0;
      case 'r': return sh.m.fs.can(st, 'r', sh.ctx);
      case 'w': return sh.m.fs.can(st, 'w', sh.ctx);
      case 'x': return sh.m.fs.can(st, 'x', sh.ctx);
      case 'u': return (st.mode & 0o4000) !== 0;
      case 'g': return (st.mode & 0o2000) !== 0;
      case 'k': return (st.mode & 0o1000) !== 0;
      case 'O': return st.uid === sh.uid;
      case 'G': return st.gid === sh.gid;
      case 'N': return st.mtime > st.atime;
      case 't': return false;
      default: return false;
    }
  }

  function testEval(args, sh) {
    // implementação de test/[ (POSIX) com os operadores mais usados
    let i = 0;
    function expr() { return orExpr(); }
    function orExpr() {
      let l = andExpr();
      while (args[i] === '-o') { i++; const r = andExpr(); l = l || r; }
      return l;
    }
    function andExpr() {
      let l = unary();
      while (args[i] === '-a') { i++; const r = unary(); l = l && r; }
      return l;
    }
    function unary() {
      if (args[i] === '!') { i++; return !unary(); }
      if (args[i] === '(') { i++; const v = expr(); if (args[i] === ')') i++; return v; }
      const a = args[i];
      // binário?
      const b = args[i + 1];
      if (b !== undefined && ['=', '==', '!=', '<', '>', '-eq', '-ne', '-lt', '-le', '-gt', '-ge', '-nt', '-ot', '-ef'].includes(b)) {
        const c = args[i + 2] === undefined ? '' : args[i + 2];
        i += 3;
        return binop(a, b, c, sh);
      }
      if (a !== undefined && /^-[a-zA-Z]$/.test(a) && args[i + 1] !== undefined) {
        const op = a[1]; const p = args[i + 1]; i += 2;
        if (op === 'z') return p === '';
        if (op === 'n') return p !== '';
        return fileTest(sh, op, FileSystem.normalize(p, sh.cwd));
      }
      i++;
      return a !== undefined && a !== '';
    }
    if (args.length === 0) return false;
    return expr();
  }

  function binop(a, op, b, sh) {
    switch (op) {
      case '=': case '==': return a === b;
      case '!=': return a !== b;
      case '<': return a < b;
      case '>': return a > b;
      case '-eq': return num(a) === num(b);
      case '-ne': return num(a) !== num(b);
      case '-lt': return num(a) < num(b);
      case '-le': return num(a) <= num(b);
      case '-gt': return num(a) > num(b);
      case '-ge': return num(a) >= num(b);
      case '-nt': { try { return sh.m.fs.stat(a, sh.fsopts()).mtime > sh.m.fs.stat(b, sh.fsopts()).mtime; } catch (e) { return false; } }
      case '-ot': { try { return sh.m.fs.stat(a, sh.fsopts()).mtime < sh.m.fs.stat(b, sh.fsopts()).mtime; } catch (e) { return false; } }
      case '-ef': { try { return sh.m.fs.stat(a, sh.fsopts()).ino === sh.m.fs.stat(b, sh.fsopts()).ino; } catch (e) { return false; } }
    }
    return false;
  }
  function num(x) { const n = parseInt(String(x).trim(), 10); if (isNaN(n)) { const e = new Error(`integer expression expected`); throw e; } return n; }

  function evalDBracket(items, sh) {
    let i = 0;
    function peekOp() { const t = items[i]; return t && t.op ? t.op : (t && t.val !== undefined ? t.val : null); }
    function orE() { let l = andE(); while (items[i] && items[i].op === '||') { i++; const r = andE(); l = l || r; } return l; }
    function andE() { let l = un(); while (items[i] && items[i].op === '&&') { i++; const r = un(); l = l && r; } return l; }
    function un() {
      const t = items[i];
      if (!t) return false;
      if (t.val === '!') { i++; return !un(); }
      if (t.op === '(') { i++; const v = orE(); if (items[i] && items[i].op === ')') i++; return v; }
      const a = t.val;
      const nx = items[i + 1];
      const nxv = nx ? (nx.op || nx.val) : null;
      if (nxv && ['=', '==', '!=', '=~', '<', '>', '-eq', '-ne', '-lt', '-le', '-gt', '-ge', '-nt', '-ot', '-ef'].includes(nxv)) {
        const c = items[i + 2];
        const cval = c ? (c.val !== undefined ? c.val : c.op) : '';
        i += 3;
        if (nxv === '=~') {
          try { return new RegExp(cval).test(a); } catch (e) { return false; }
        }
        if ((nxv === '==' || nxv === '=' || nxv === '!=') && c && !c.quoted && /[*?\[]/.test(cval)) {
          const r = matchGlob(a, cval);
          return nxv === '!=' ? !r : r;
        }
        return binop(a, nxv, cval, sh);
      }
      if (a !== undefined && /^-[a-zA-Z]$/.test(a) && nx) {
        const op = a[1]; const p = nx.val !== undefined ? nx.val : ''; i += 2;
        if (op === 'z') return p === '';
        if (op === 'n') return p !== '';
        if (op === 'v') return sh.getVar(p) !== undefined || sh.arrays.has(p);
        if (op === 'o') return !!sh.opts[p];
        return fileTest(sh, op, FileSystem.normalize(p, sh.cwd));
      }
      i++;
      return a !== undefined && a !== '';
    }
    return orE();
  }
  LX.testEval = testEval;
  LX.fileTest = fileTest;

  /* =========================== BUILTINS =========================== */
  const BUILTIN_FORCE = new Set(['return', 'local', 'break', 'continue', 'exit', 'shift', 'declare', 'unset', 'export', 'eval', 'source', '.', 'set']);
  const BUILTINS = {};
  LX.BUILTINS = BUILTINS;
  const B = (names, fn) => { for (const n of [].concat(names)) BUILTINS[n] = fn; };

  B('cd', async ({ sh, io, args }) => {
    let target = args[0];
    if (!target || target === '~') target = sh.getVar('HOME') || '/';
    else if (target === '-') {
      target = sh.getVar('OLDPWD');
      if (!target) { io.stderr.write((sh.nomeShell + ': cd: OLDPWD not set\n')); return 1; }
      io.stdout.write(target + '\n');
    }
    const p = FileSystem.normalize(target, sh.cwd);
    let st;
    try { st = sh.m.fs.stat(p, sh.fsopts()); }
    catch (e) {
      if (e.code === 'EACCES') { io.stderr.write(`${sh.nomeShell}: cd: ${target}: Permission denied\n`); return 1; }
      io.stderr.write(`${sh.nomeShell}: cd: ${target}: No such file or directory\n`); return 1;
    }
    if (st.type !== 'dir') { io.stderr.write(`${sh.nomeShell}: cd: ${target}: Not a directory\n`); return 1; }
    if (!sh.m.fs.can(st, 'x', sh.ctx)) { io.stderr.write(`${sh.nomeShell}: cd: ${target}: Permission denied\n`); return 1; }
    sh.setVar('OLDPWD', sh.cwd);
    sh.cwd = p;
    sh.setVar('PWD', p);
    return 0;
  });

  B(':', async () => 0);
  B('true', async () => 0);
  B('false', async () => 1);

  B('echo', async ({ io, args }) => {
    let interpret = false, noNewline = false, i = 0;
    while (args[i] && /^-[neE]+$/.test(args[i])) {
      if (args[i].includes('e')) interpret = true;
      if (args[i].includes('E')) interpret = false;
      if (args[i].includes('n')) noNewline = true;
      i++;
    }
    let out = args.slice(i).join(' ');
    if (interpret) out = unescapeC(out);
    io.stdout.write(out + (noNewline ? '' : '\n'));
    return 0;
  });

  function unescapeC(s) {
    return s.replace(/\\(n|t|r|a|b|f|v|0[0-7]{0,3}|x[0-9a-fA-F]{1,2}|\\|e)/g, (m, g) => {
      switch (g[0]) {
        case 'n': return '\n'; case 't': return '\t'; case 'r': return '\r';
        case 'a': return '\x07'; case 'b': return '\b'; case 'f': return '\f';
        case 'v': return '\v'; case '\\': return '\\'; case 'e': return '\x1b';
        case '0': return String.fromCharCode(parseInt(g.slice(1) || '0', 8));
        case 'x': return String.fromCharCode(parseInt(g.slice(1), 16));
      }
      return m;
    });
  }
  LX.unescapeC = unescapeC;

  B('printf', async ({ io, args, sh }) => {
    if (!args.length) { io.stderr.write('printf: usage: printf [-v var] format [arguments]\n'); return 2; }
    let varName = null, i = 0;
    if (args[0] === '-v') { varName = args[1]; i = 2; }
    const fmt = args[i]; const rest = args.slice(i + 1);
    const out = formatPrintf(fmt, rest);
    if (varName) { sh.setVar(varName, out); return 0; }
    io.stdout.write(out);
    return 0;
  });

  function formatPrintf(fmt, args) {
    let out = '';
    let ai = 0;
    let guard = 0;
    do {
      let consumedAny = false;
      let i = 0;
      while (i < fmt.length) {
        const c = fmt[i];
        if (c === '\\') { const r = unescapeC(fmt.slice(i, i + 5)); const m = /^\\(n|t|r|a|b|f|v|\\|e|0[0-7]{0,3}|x[0-9a-fA-F]{1,2})/.exec(fmt.slice(i)); if (m) { out += unescapeC(m[0]); i += m[0].length; continue; } out += '\\'; i++; continue; }
        if (c !== '%') { out += c; i++; continue; }
        if (fmt[i + 1] === '%') { out += '%'; i += 2; continue; }
        const m = /^%([-+ 0#']*)(\*|\d+)?(?:\.(\*|\d+))?([diouxXeEfgGcsq%b])/.exec(fmt.slice(i));
        if (!m) { out += c; i++; continue; }
        let [full, flags, width, prec, conv] = m;
        if (width === '*') width = String(parseInt(args[ai++] || '0', 10));
        if (prec === '*') prec = String(parseInt(args[ai++] || '0', 10));
        let arg = args[ai++]; consumedAny = true;
        if (arg === undefined) arg = /[dioxXufeEgG]/.test(conv) ? '0' : '';
        let s;
        switch (conv) {
          case 'd': case 'i': s = String(Math.trunc(Number(arg) || 0)); break;
          case 'u': s = String(Math.abs(Math.trunc(Number(arg) || 0))); break;
          case 'o': s = (Math.trunc(Number(arg) || 0) >>> 0).toString(8); break;
          case 'x': s = (Math.trunc(Number(arg) || 0) >>> 0).toString(16); break;
          case 'X': s = (Math.trunc(Number(arg) || 0) >>> 0).toString(16).toUpperCase(); break;
          case 'f': case 'F': s = (Number(arg) || 0).toFixed(prec === undefined ? 6 : +prec); break;
          case 'e': s = (Number(arg) || 0).toExponential(prec === undefined ? 6 : +prec); break;
          case 'E': s = (Number(arg) || 0).toExponential(prec === undefined ? 6 : +prec).toUpperCase(); break;
          case 'g': case 'G': s = String(Number(arg) || 0); break;
          case 'c': s = String(arg).charAt(0); break;
          case 'b': s = unescapeC(String(arg)); break;
          case 'q': s = shQuote(String(arg)); break;
          default: s = String(arg);
        }
        if (conv === 's' && prec !== undefined) s = String(arg).slice(0, +prec);
        if (conv === 's') s = s === undefined ? String(arg) : (typeof s === 'string' ? s : String(arg));
        if (conv === 's') s = String(arg).slice(0, prec === undefined ? undefined : +prec);
        if (/[dioxXu]/.test(conv) && prec !== undefined) s = (s.startsWith('-') ? '-' : '') + s.replace('-', '').padStart(+prec, '0');
        if (flags.includes('+') && /[dif]/.test(conv) && Number(arg) >= 0) s = '+' + s;
        if (width) {
          const w = +width;
          if (flags.includes('-')) s = s.padEnd(w);
          else if (flags.includes('0') && !/[sc]/.test(conv)) {
            const neg = s.startsWith('-');
            s = (neg ? '-' : '') + (neg ? s.slice(1) : s).padStart(neg ? w - 1 : w, '0');
          }
          else s = s.padStart(w);
        }
        out += s;
        i += full.length;
      }
      if (!consumedAny) break;
      guard++;
    } while (ai < args.length && guard < 1000);
    return out;
  }
  LX.formatPrintf = formatPrintf;

  B('export', async ({ sh, io, args, exp }) => {
    if (!args.length || args[0] === '-p') {
      for (const l of sh.exportedList()) io.stdout.write('declare -x ' + l.replace('=', '="') + '"\n');
      return 0;
    }
    let status = 0;
    for (const a of args) {
      if (a === '-n') continue;
      const eq = a.indexOf('=');
      if (eq > 0) {
        const name = a.slice(0, eq);
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) { io.stderr.write(`${sh.nomeShell}: export: \`${a}': not a valid identifier\n`); status = 1; continue; }
        sh.setVar(name, a.slice(eq + 1), true);
      } else {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(a)) { io.stderr.write(`${sh.nomeShell}: export: \`${a}': not a valid identifier\n`); status = 1; continue; }
        const cur = sh.vars.get(a);
        if (cur) cur.exported = true; else sh.setVar(a, '', true);
      }
    }
    if (args.includes('-n')) for (const a of args) { if (a === '-n') continue; const c = sh.vars.get(a); if (c) c.exported = false; }
    return status;
  });

  B('unset', async ({ sh, args }) => {
    for (const a of args) { if (a === '-v' || a === '-f') continue; sh.unsetVar(a); sh.funcs.delete(a); }
    return 0;
  });

  B(['declare', 'typeset'], async ({ sh, io, args }) => {
    const flags = args.filter(a => a.startsWith('-')).join('');
    const rest = args.filter(a => !a.startsWith('-'));
    if (flags.includes('f') && !rest.length) {
      for (const k of sh.funcs.keys()) io.stdout.write(`${k} ()\n{\n    ...\n}\n`);
      return 0;
    }
    if (!rest.length) {
      for (const [k, v] of sh.vars) {
        if (flags.includes('x') && !v.exported) continue;
        io.stdout.write(`${v.exported ? 'declare -x ' : 'declare -- '}${k}="${v.value}"\n`);
      }
      if (!flags.includes('x')) for (const [k, a] of sh.arrays) io.stdout.write(`declare -a ${k}=(${a.map((x, i) => `[${i}]="${x}"`).join(' ')})\n`);
      return 0;
    }
    if (flags.includes('p')) {
      // declare -p NOME: imprime a declaração de variáveis específicas
      let st = 0;
      for (const nome of rest) {
        if (sh.arrays.has(nome)) {
          const a = sh.arrays.get(nome);
          io.stdout.write(`declare -a ${nome}=(${a.map((x, i) => `[${i}]="${x}"`).join(' ')})\n`);
          continue;
        }
        const v = sh.vars.get(nome);
        if (!v) { io.stderr.write(`${sh.nomeShell}: declare: ${nome}: not found\n`); st = 1; continue; }
        const atributos = (v.exported ? 'x' : '') + (v.readonly ? 'r' : '');
        io.stdout.write(`declare -${atributos || '-'} ${nome}="${v.value}"\n`);
      }
      return st;
    }
    for (const r of rest) {
      const eq = r.indexOf('=');
      const name = eq > 0 ? r.slice(0, eq) : r;
      let val = eq > 0 ? r.slice(eq + 1) : undefined;
      if (flags.includes('a')) {
        if (val !== undefined && val.startsWith('(')) {
          const inner = val.replace(/^\(|\)$/g, '');
          sh.setArray(name, inner.split(/\s+/).filter(Boolean).map(s => s.replace(/^["']|["']$/g, '')));
        } else if (!sh.arrays.has(name)) sh.setArray(name, val !== undefined ? [val] : []);
        continue;
      }
      if (flags.includes('i') && val !== undefined) { sh.setVar(name, String(arith(val, sh))); continue; }
      if (val !== undefined) sh.setVar(name, val);
      if (flags.includes('x')) { const c = sh.vars.get(name); if (c) c.exported = true; }
      if (flags.includes('r')) { const c = sh.vars.get(name); if (c) c.readonly = true; }
      if (flags.includes('l') && val !== undefined) sh.setVar(name, val.toLowerCase());
      if (flags.includes('u') && val !== undefined) sh.setVar(name, val.toUpperCase());
    }
    return 0;
  });

  B('readonly', async ({ sh, args }) => {
    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq > 0) { sh.setVar(a.slice(0, eq), a.slice(eq + 1)); const c = sh.vars.get(a.slice(0, eq)); if (c) c.readonly = true; }
      else { const c = sh.vars.get(a); if (c) c.readonly = true; }
    }
    return 0;
  });

  B('local', async ({ sh, io, args }) => {
    if (sh.funcDepth === 0) { io.stderr.write((sh.nomeShell + ': local: can only be used in a function\n')); return 1; }
    const frame = sh.localStack[sh.localStack.length - 1];
    for (const a of args) {
      if (a.startsWith('-')) continue;
      const eq = a.indexOf('=');
      const name = eq > 0 ? a.slice(0, eq) : a;
      frame.push([name, sh.vars.get(name)]);
      if (eq > 0) sh.setVar(name, a.slice(eq + 1)); else sh.setVar(name, '');
    }
    return 0;
  });

  B('exit', async ({ sh, args }) => { throw new ExitSignal(args.length ? (parseInt(args[0], 10) & 255) : sh.lastStatus); });
  B('logout', async ({ sh, args }) => { throw new ExitSignal(args.length ? parseInt(args[0], 10) : sh.lastStatus); });
  B('return', async ({ sh, args }) => { throw new ReturnSignal(args.length ? (parseInt(args[0], 10) & 255) : sh.lastStatus); });
  B('break', async ({ args, ex, io }) => { if (ex.loopDepth === 0) return 0; throw new BreakSignal(args.length ? parseInt(args[0], 10) : 1); });
  B('continue', async ({ args, ex }) => { if (ex.loopDepth === 0) return 0; throw new ContinueSignal(args.length ? parseInt(args[0], 10) : 1); });

  B('shift', async ({ sh, args }) => {
    const n = args.length ? parseInt(args[0], 10) : 1;
    if (n > sh.positional.length) return 1;
    sh.positional = sh.positional.slice(n);
    return 0;
  });

  B(['test', '['], async ({ sh, io, args, name }) => {
    let a = args.slice();
    if (name === '[') {
      if (a[a.length - 1] !== ']') { io.stderr.write((sh.nomeShell + ": [: missing `]'\n")); return 2; }
      a = a.slice(0, -1);
    }
    try { return testEval(a, sh) ? 0 : 1; }
    catch (e) { io.stderr.write(`${sh.nomeShell}: ${name}: ${e.message}\n`); return 2; }
  });

  B('read', async ({ sh, io, args }) => {
    let names = [], raw = false, silent = false, promptText = null, nchars = null, delim = '\n', arrayName = null, timeout = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-r') { raw = true; continue; }
      if (a === '-s') { silent = true; continue; }
      if (a === '-p') { promptText = args[++i]; continue; }
      if (a === '-n' || a === '-N') { nchars = parseInt(args[++i], 10); continue; }
      if (a === '-d') { delim = args[++i]; continue; }
      if (a === '-a') { arrayName = args[++i]; continue; }
      if (a === '-t') { timeout = args[++i]; continue; }
      if (a.startsWith('-')) continue;
      names.push(a);
    }
    let line;
    if (io.stdin && !io.stdin.eof) line = io.stdin.readLine();
    else if (io.stdin && io.stdin.eof && !io.stdin.isTTY) line = null;   // fim de arquivo: read devolve 1
    else if (io.term && io.term.readLine) line = await io.term.readLine(promptText || '', { silent });
    else line = null;
    if (line === null || line === undefined) return 1;
    if (!raw) line = line.replace(/\\(.)/g, '$1');
    if (arrayName) { sh.setArray(arrayName, line.split(/\s+/).filter(Boolean)); return 0; }
    if (!names.length) { sh.setVar('REPLY', line); return 0; }
    const ifs = sh.getVar('IFS') || ' \t\n';
    const sep = new RegExp('[' + ifs.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + ']+');
    const fields = line.trim() === '' ? [] : line.trim().split(sep);
    for (let i = 0; i < names.length; i++) {
      if (i === names.length - 1 && fields.length > names.length) sh.setVar(names[i], fields.slice(i).join(' '));
      else sh.setVar(names[i], fields[i] === undefined ? '' : fields[i]);
    }
    return 0;
  });

  B(['source', '.'], async ({ sh, io, args, ex }) => {
    if (!args.length) { io.stderr.write((sh.nomeShell + ': source: filename argument required\n')); return 2; }
    let p = args[0];
    if (!p.includes('/')) {
      const dirs = (sh.getVar('PATH') || '').split(':');
      let found = null;
      for (const d of dirs) { const c = FileSystem.join(d, p); if (sh.m.fs.exists(c, sh.fsopts())) { found = c; break; } }
      p = found || FileSystem.normalize(p, sh.cwd);
    } else p = FileSystem.normalize(p, sh.cwd);
    let content;
    try { content = sh.m.fs.readFile(p, sh.fsopts()); }
    catch (e) { io.stderr.write(`${sh.nomeShell}: ${args[0]}: No such file or directory\n`); return 1; }
    const savedPos = sh.positional;
    if (args.length > 1) sh.positional = args.slice(1);
    try {
      const sub = new Executor(sh, io);
      return await sub.run(content);
    } catch (e) {
      if (e && e.isExit) throw e;
      if (e && e.isParseError) { io.stderr.write(`${sh.nomeShell}: ${p}: ${e.message}\n`); return 2; }
      throw e;
    } finally { sh.positional = savedPos; }
  });

  B('eval', async ({ sh, io, args, ex }) => {
    const src = args.join(' ');
    if (!src.trim()) return 0;
    const sub = new Executor(sh, io);
    try { return await sub.run(src); }
    catch (e) {
      if (e && e.isParseError) { io.stderr.write(`${sh.nomeShell}: eval: ${e.message}\n`); return 2; }
      throw e;
    }
  });

  B('set', async ({ sh, io, args }) => {
    if (!args.length) {
      const keys = Array.from(sh.vars.keys()).sort();
      for (const k of keys) io.stdout.write(`${k}=${sh.vars.get(k).value}\n`);
      return 0;
    }
    let i = 0;
    for (; i < args.length; i++) {
      const a = args[i];
      if (a === '--') { i++; break; }
      // "-euo pipefail": o 'o' final consome o próximo argumento
      if (/^[-+][a-zA-Z]*o$/.test(a)) {
        const on = a[0] === '-';
        for (const letra of a.slice(1, -1)) {
          const mapa = { e: 'e', u: 'u', x: 'x', f: 'noglob', a: 'allexport', C: 'noclobber', m: 'monitor', b: 'notify' };
          if (mapa[letra]) sh.opts[mapa[letra]] = on;
        }
        const nome = args[i + 1];
        const map2 = { errexit: 'e', nounset: 'u', xtrace: 'x', pipefail: 'pipefail', noglob: 'noglob', allexport: 'allexport' };
        if (nome && map2[nome]) { sh.opts[map2[nome]] = on; i++; continue; }
        if (!nome) {
          for (const k of ['errexit', 'nounset', 'xtrace', 'pipefail', 'noglob']) {
            const key = { errexit: 'e', nounset: 'u', xtrace: 'x', pipefail: 'pipefail', noglob: 'noglob' }[k];
            io.stdout.write(`${k}\t${sh.opts[key] ? 'on' : 'off'}\n`);
          }
          continue;
        }
        continue;
      }
      if (a.startsWith('-o') || a.startsWith('+o')) {
        const on = a[0] === '-';
        const name = args[++i];
        if (!name) {
          for (const k of ['errexit', 'nounset', 'xtrace', 'pipefail', 'noglob']) {
            const key = { errexit: 'e', nounset: 'u', xtrace: 'x', pipefail: 'pipefail', noglob: 'noglob' }[k];
            io.stdout.write(`${k}\t${sh.opts[key] ? 'on' : 'off'}\n`);
          }
          continue;
        }
        const map = { errexit: 'e', nounset: 'u', xtrace: 'x', pipefail: 'pipefail', noglob: 'noglob', allexport: 'allexport' };
        if (map[name]) sh.opts[map[name]] = on;
        continue;
      }
      if (a[0] === '-' || a[0] === '+') {
        const on = a[0] === '-';
        for (const ch of a.slice(1)) {
          if (ch === 'e') sh.opts.e = on;
          else if (ch === 'u') sh.opts.u = on;
          else if (ch === 'x') sh.opts.x = on;
          else if (ch === 'f') sh.opts.noglob = on;
          else if (ch === 'a') sh.opts.allexport = on;
        }
        continue;
      }
      break;
    }
    if (i < args.length) sh.positional = args.slice(i);
    return 0;
  });

  B('shopt', async ({ sh, io, args }) => {
    if (!args.length || args[0] === '-p') {
      for (const k in sh.shopts) io.stdout.write(`${k}\t${sh.shopts[k] ? 'on' : 'off'}\n`);
      return 0;
    }
    const on = args[0] === '-s';
    const off = args[0] === '-u';
    if (args[0] === '-q') return sh.shopts[args[1]] ? 0 : 1;
    for (const n of args.slice(1)) sh.shopts[n] = on ? true : (off ? false : sh.shopts[n]);
    return 0;
  });

  B('alias', async ({ sh, io, args }) => {
    if (!args.length) {
      for (const [k, v] of Array.from(sh.aliases).sort()) io.stdout.write(`alias ${k}='${v}'\n`);
      return 0;
    }
    let status = 0;
    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq > 0) sh.aliases.set(a.slice(0, eq), a.slice(eq + 1).replace(/^['"]|['"]$/g, ''));
      else {
        if (sh.aliases.has(a)) io.stdout.write(`alias ${a}='${sh.aliases.get(a)}'\n`);
        else { io.stderr.write(`${sh.nomeShell}: alias: ${a}: not found\n`); status = 1; }
      }
    }
    return status;
  });
  B('unalias', async ({ sh, args }) => { if (args[0] === '-a') sh.aliases.clear(); else for (const a of args) sh.aliases.delete(a); return 0; });

  B('type', async ({ sh, io, args }) => {
    let status = 0;
    const all = args.includes('-a');
    const short = args.includes('-t');
    for (const a of args.filter(x => !x.startsWith('-'))) {
      if (sh.aliases.has(a)) { io.stdout.write(short ? 'alias\n' : `${a} is aliased to \`${sh.aliases.get(a)}'\n`); if (!all) continue; }
      if (sh.funcs.has(a)) { io.stdout.write(short ? 'function\n' : `${a} is a function\n`); if (!all) continue; }
      if (BUILTINS[a]) { io.stdout.write(short ? 'builtin\n' : `${a} is a shell builtin\n`); if (!all) continue; }
      const dirs = (sh.getVar('PATH') || '').split(':');
      let found = false;
      for (const d of dirs) {
        const p = FileSystem.join(d, a);
        try { const st = sh.m.fs.stat(p, sh.fsopts()); if (st.type !== 'dir') { io.stdout.write(short ? 'file\n' : `${a} is ${p}\n`); found = true; if (!all) break; } } catch (e) { }
      }
      if (!found && !sh.aliases.has(a) && !sh.funcs.has(a) && !BUILTINS[a]) {
        if (!short) io.stderr.write(`${sh.nomeShell}: type: ${a}: not found\n`);
        status = 1;
      }
    }
    return status;
  });

  B('command', async ({ sh, io, args, ex }) => {
    const rest = args.filter(a => !['-v', '-V', '-p'].includes(a));
    if (args.includes('-v')) {
      for (const a of rest) {
        if (BUILTINS[a]) { io.stdout.write(a + '\n'); continue; }
        const dirs = (sh.getVar('PATH') || '').split(':');
        let f = null;
        for (const d of dirs) { const p = FileSystem.join(d, a); if (sh.m.fs.exists(p, sh.fsopts())) { f = p; break; } }
        if (f) io.stdout.write(f + '\n'); else return 1;
      }
      return 0;
    }
    if (!rest.length) return 0;
    return await ex.execExternal(rest[0], rest.slice(1), io);
  });
  B('builtin', async ({ sh, io, args, ex, exp }) => {
    if (!args.length) return 0;
    if (BUILTINS[args[0]]) return await BUILTINS[args[0]]({ sh, io, args: args.slice(1), name: args[0], ex, exp });
    io.stderr.write(`${sh.nomeShell}: builtin: ${args[0]}: not a shell builtin\n`);
    return 1;
  });

  B('let', async ({ sh, args }) => {
    let last = 0;
    for (const a of args) last = arith(a, sh);
    return last === 0 ? 1 : 0;
  });

  B('umask', async ({ sh, io, args }) => {
    if (!args.length) { io.stdout.write('0' + sh.umask.toString(8).padStart(3, '0') + '\n'); return 0; }
    if (args[0] === '-S') {
      const p = 0o777 & ~sh.umask;
      const s = ['u', 'g', 'o'].map((who, i) => {
        const bits = (p >> (6 - i * 3)) & 7;
        return who + '=' + (bits & 4 ? 'r' : '') + (bits & 2 ? 'w' : '') + (bits & 1 ? 'x' : '');
      }).join(',');
      io.stdout.write(s + '\n'); return 0;
    }
    const v = parseInt(args[0], 8);
    if (isNaN(v)) { io.stderr.write(`${sh.nomeShell}: umask: ${args[0]}: invalid octal number\n`); return 1; }
    sh.umask = v & 0o777;
    return 0;
  });

  B('jobs', async ({ sh, io, args }) => {
    const active = sh.jobs.filter(j => j.state !== 'Done' || args.includes('-l'));
    sh.jobs.forEach((j, idx) => {
      if (j.state === 'Done' && !args.includes('-l')) return;
      const cur = idx === sh.jobs.length - 1 ? '+' : (idx === sh.jobs.length - 2 ? '-' : ' ');
      io.stdout.write(`[${j.id}]${cur}  ${j.state.padEnd(22)} ${j.cmd}${j.state === 'Running' ? ' &' : ''}\n`);
    });
    return 0;
  });

  B('fg', async ({ sh, io, args }) => {
    const j = pickJob(sh, args[0]);
    if (!j) { io.stderr.write((sh.nomeShell + ': fg: current: no such job\n')); return 1; }
    io.stdout.write(j.cmd + '\n');
    j.state = 'Running';
    const p = sh.m.procByPid(j.pid); if (p) p.state = 'R';
    if (j.promise) await j.promise;
    j.state = 'Done';
    return 0;
  });
  B('bg', async ({ sh, io, args }) => {
    const j = pickJob(sh, args[0]);
    if (!j) { io.stderr.write((sh.nomeShell + ': bg: current: no such job\n')); return 1; }
    j.state = 'Running';
    const p = sh.m.procByPid(j.pid); if (p) p.state = 'S';
    io.stdout.write(`[${j.id}]+ ${j.cmd} &\n`);
    return 0;
  });
  function pickJob(sh, spec) {
    const list = sh.jobs.filter(j => j.state !== 'Done');
    if (!spec) return list[list.length - 1];
    const n = parseInt(String(spec).replace('%', ''), 10);
    return sh.jobs.find(j => j.id === n) || null;
  }

  B('wait', async ({ sh, args }) => {
    const targets = args.length ? sh.jobs.filter(j => args.includes(String(j.pid)) || args.includes('%' + j.id)) : sh.jobs;
    for (const j of targets) if (j.promise) { try { await j.promise; } catch (e) { } }
    return 0;
  });

  B('history', async ({ sh, io, args }) => {
    if (args[0] === '-c') { sh.history.length = 0; return 0; }
    const n = args[0] && /^\d+$/.test(args[0]) ? parseInt(args[0], 10) : sh.history.length;
    const start = Math.max(0, sh.history.length - n);
    for (let i = start; i < sh.history.length; i++) io.stdout.write(String(i + 1).padStart(5) + '  ' + sh.history[i] + '\n');
    return 0;
  });

  B('trap', async ({ sh, io, args }) => {
    if (!args.length) { for (const k in sh.traps) io.stdout.write(`trap -- '${sh.traps[k]}' ${k}\n`); return 0; }
    const action = args[0];
    for (const sig of args.slice(1)) sh.traps[sig.toUpperCase().replace(/^SIG/, '')] = action;
    return 0;
  });

  B('times', async ({ io }) => { io.stdout.write('0m0.012s 0m0.004s\n0m0.008s 0m0.002s\n'); return 0; });
  B('hash', async ({ io, args }) => { if (args.includes('-r')) return 0; io.stdout.write('hits\tcommand\n'); return 0; });
  B('ulimit', async ({ io, args }) => {
    if (args.includes('-a')) {
      io.stdout.write(`real-time non-blocking time  (microseconds, -R) unlimited\ncore file size              (blocks, -c) 0\ndata seg size               (kbytes, -d) unlimited\nfile size                   (blocks, -f) unlimited\nmax locked memory           (kbytes, -l) 8192\nopen files                          (-n) 1024\nstack size                  (kbytes, -s) 8192\ncpu time                   (seconds, -t) unlimited\nmax user processes                  (-u) 15374\n`);
      return 0;
    }
    io.stdout.write('unlimited\n'); return 0;
  });
  B(['pushd'], async ({ sh, io, args }) => {
    if (!args.length) return 1;
    sh.dirstack.unshift(sh.cwd);
    const r = await BUILTINS.cd({ sh, io, args });
    io.stdout.write([sh.cwd, ...sh.dirstack].join(' ') + '\n');
    return r;
  });
  B(['popd'], async ({ sh, io }) => {
    if (!sh.dirstack.length) { io.stderr.write((sh.nomeShell + ': popd: directory stack empty\n')); return 1; }
    const d = sh.dirstack.shift();
    await BUILTINS.cd({ sh, io, args: [d] });
    io.stdout.write([sh.cwd, ...sh.dirstack].join(' ') + '\n');
    return 0;
  });
  B('dirs', async ({ sh, io }) => { io.stdout.write([sh.cwd, ...sh.dirstack].join(' ') + '\n'); return 0; });

  B(['mapfile', 'readarray'], async ({ sh, io, args }) => {
    const name = args.filter(a => !a.startsWith('-'))[0] || 'MAPFILE';
    const strip = args.includes('-t');
    const data = io.stdin ? io.stdin.readAll() : '';
    let lines = data === '' ? [] : data.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    sh.setArray(name, strip ? lines : lines.map(l => l + '\n'));
    return 0;
  });

  B('getopts', async ({ sh, io, args }) => {
    const optstring = args[0] || '';
    const varName = args[1] || 'OPTARG';
    let optind = parseInt(sh.getVar('OPTIND') || '1', 10);
    const pos = sh.positional;
    if (optind > pos.length) { sh.setVar('OPTIND', String(optind)); return 1; }
    const cur = pos[optind - 1];
    if (!cur || !cur.startsWith('-') || cur === '-' || cur === '--') { sh.setVar('OPTIND', String(optind + (cur === '--' ? 1 : 0))); return 1; }
    const ch = cur[1];
    const idx = optstring.indexOf(ch);
    if (idx === -1) { sh.setVar(varName, '?'); sh.setVar('OPTARG', ch); sh.setVar('OPTIND', String(optind + 1)); if (!optstring.startsWith(':')) io.stderr.write(`${sh.scriptName}: illegal option -- ${ch}\n`); return 0; }
    if (optstring[idx + 1] === ':') {
      let arg = cur.slice(2);
      if (!arg) { arg = pos[optind]; optind++; }
      sh.setVar('OPTARG', arg || '');
      sh.setVar(varName, ch);
    } else { sh.setVar(varName, ch); sh.setVar('OPTARG', ''); }
    sh.setVar('OPTIND', String(optind + 1));
    return 0;
  });

  B('help', async ({ io, args, sh }) => {
    if (!args.length) {
      io.stdout.write(`GNU bash, versão 5.3.0(1)-release (x86_64-pc-linux-gnu)
Estes comandos são definidos internamente. Digite \`help' para ver esta lista.
Digite \`help nome' para saber mais sobre a função \`nome'.
Use \`man -k' ou \`info' para saber mais sobre comandos que não estão nesta lista.

`);
      const names = Object.keys(BUILTINS).sort();
      const cols = 3;
      const per = Math.ceil(names.length / cols);
      for (let r = 0; r < per; r++) {
        let line = '';
        for (let c = 0; c < cols; c++) { const n = names[c * per + r]; if (n) line += (' ' + n).padEnd(26); }
        io.stdout.write(line.trimEnd() + '\n');
      }
      return 0;
    }
    const topic = args[0];
    const h = LX.BUILTIN_HELP && LX.BUILTIN_HELP[topic];
    if (h) { io.stdout.write(h + '\n'); return 0; }
    if (BUILTINS[topic]) { io.stdout.write(`${topic}: comando interno do bash.\nUse "help" para a lista completa ou "man bash" para a documentação.\n`); return 0; }
    io.stderr.write(`${sh.nomeShell}: help: nenhum tópico de ajuda corresponde a \`${topic}'. Tente \`help help' ou \`man -k ${topic}' ou \`info ${topic}'.\n`);
    return 1;
  });

  B('exec', async ({ sh, io, args, ex }) => {
    if (!args.length) return 0;
    return await ex.execExternal(args[0], args.slice(1), io);
  });

  B('enable', async () => 0);
  B('complete', async () => 0);
  B('compgen', async () => 0);
  B('bind', async () => 0);
  B('caller', async () => 0);
  B('suspend', async () => 0);
  B('disown', async ({ sh, args }) => { sh.jobs = sh.jobs.filter(j => j.state === 'Running'); return 0; });

  LX.FileStream = FileStream;
  LX.NullStream = NullStream;
})();
