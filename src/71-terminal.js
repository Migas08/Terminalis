/* =========================================================================
   TERMINALIS — o terminal interativo
   ========================================================================= */
'use strict';
(function () {
  const { Shell, Executor, Stream, InStream, Machine } = LX;

  const ANSI_CLASS = {
    30: 'c-dim', 31: 'c-red', 32: 'c-green', 33: 'c-yellow', 34: 'c-blue',
    35: 'c-magenta', 36: 'c-cyan', 37: 'c-white', 90: 'c-dim', 91: 'c-red',
    92: 'c-green', 93: 'c-yellow', 94: 'c-blue', 95: 'c-magenta', 96: 'c-cyan', 97: 'c-white'
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Converte texto com códigos ANSI em HTML */
  function ansiToHtml(text) {
    let out = '';
    const stack = [];
    let i = 0;
    while (i < text.length) {
      const idx = text.indexOf('\x1b[', i);
      if (idx === -1) { out += esc(text.slice(i)); break; }
      out += esc(text.slice(i, idx));
      const end = text.indexOf('m', idx);
      if (end === -1) { out += esc(text.slice(idx)); break; }
      const codes = text.slice(idx + 2, end).split(';').map(n => parseInt(n, 10) || 0);
      for (const code of codes) {
        if (code === 0) { while (stack.length) { out += '</span>'; stack.pop(); } }
        else if (code === 1) { out += '<b>'; stack.push('b'); }
        else if (code === 2) { out += '<span class="c-dim">'; stack.push('span'); }
        else if (code === 7) { out += '<span class="c-inv">'; stack.push('span'); }
        else if (ANSI_CLASS[code]) { out += `<span class="${ANSI_CLASS[code]}">`; stack.push('span'); }
      }
      i = end + 1;
    }
    while (stack.length) { out += stack.pop() === 'b' ? '</b>' : '</span>'; }
    return out;
  }
  LX.ansiToHtml = ansiToHtml;

  class Terminal {
    constructor(root, app) {
      this.app = app;
      this.el = root;
      this.out = root.querySelector('#term-out');
      this.bar = root.querySelector('#term-status');
      this.hidden = root.querySelector('#term-hidden');
      this.mobileInput = root.querySelector('#term-mobile-in');
      this.shellEl = root.querySelector('.term-shell');

      this.line = '';
      this.cursor = 0;
      this.history = [];
      this.histIdx = -1;
      this.histDraft = '';
      this.busy = false;
      this.aborted = false;
      this.stack = [];          // pilha de sessões (ssh / docker exec)
      this.pendingRead = null;
      this.overlay = null;

      this.machine = null;
      this.sh = null;
      this.session = null;

      this._bind();
    }

    /* ---------------- ciclo de vida ---------------- */
    boot(machine, opts = {}) {
      this.machine = machine;
      this.sh = new Shell(machine, { cwd: '/home/aluno', uid: 1000, gid: 1000, user: 'aluno' });
      this.sh.history = this.history;
      this.stack = [];
      this.clear();
      if (opts.motd !== false) this.motd();
      this.prompt();
      this.syncBar();
    }

    motd() {
      const m = this.machine;
      this.write(`\x1b[2mUbuntu 26.04.1 LTS (GNU/Linux 6.14.0-27-generic x86_64)\x1b[0m\n\n`);
      this.write(`  \x1b[2mAmbiente de estudo Terminalis — máquina \x1b[0m\x1b[36m${m.hostname}\x1b[0m\n`);
      this.write(`  \x1b[2mDigite\x1b[0m \x1b[33mhelp\x1b[0m \x1b[2mpara os comandos internos,\x1b[0m \x1b[33mman <comando>\x1b[0m \x1b[2mpara o manual.\x1b[0m\n\n`);
      const failed = Array.from(m.units.values()).filter(u => u.state === 'failed');
      if (failed.length) this.write(`\x1b[31m  ${failed.length} serviço(s) com falha. Use "systemctl --failed".\x1b[0m\n\n`);
    }

    /* ---------------- saída ---------------- */
    write(text) {
      if (!text) return;
      const frag = document.createElement('span');
      frag.innerHTML = ansiToHtml(text);
      this.outputEl().appendChild(frag);
      this.scroll();
    }
    outputEl() {
      if (!this._buf || !this._buf.isConnected) {
        this._buf = document.createElement('div');
        this.out.appendChild(this._buf);
      }
      return this._buf;
    }
    scroll() { this.out.scrollTop = this.out.scrollHeight; }
    clear() { this.out.innerHTML = ''; this._buf = null; this.inputEl = null; }

    promptHtml() {
      const p = this.sh.prompt();
      const cls = p.container ? 'container' : (p.remote ? 'remote' : '');
      return `<span class="ps1"><span class="u">${esc(p.user)}@${esc(p.host)}</span><span class="s">:</span><span class="w">${esc(p.cwd)}</span><span class="s">${p.sym} </span></span>`;
    }

    prompt() {
      if (this.overlay) return;
      const row = document.createElement('div');
      row.className = 'term-input-row';
      row.innerHTML = this.promptHtml() + '<span class="tin"></span><span id="term-caret"></span>';
      this.out.appendChild(row);
      this._buf = null;
      this.inputEl = row.querySelector('.tin');
      this.caretEl = row.querySelector('#term-caret');
      this.line = ''; this.cursor = 0;
      this.renderLine();
      this.scroll();
      this.syncBar();
    }

    renderLine() {
      if (!this.inputEl) return;
      const before = this.line.slice(0, this.cursor);
      const at = this.line.slice(this.cursor, this.cursor + 1);
      const after = this.line.slice(this.cursor + 1);
      if (this.masked) {
        this.inputEl.textContent = '';
        return;
      }
      if (this.cursor >= this.line.length) {
        this.inputEl.textContent = this.line;
      } else {
        this.inputEl.innerHTML = esc(before) + `<span class="c-inv">${esc(at || ' ')}</span>` + esc(after);
      }
      if (this.caretEl) this.caretEl.style.display = this.cursor >= this.line.length ? '' : 'none';
    }

    freezeLine(showText) {
      if (!this.inputEl) return;
      if (this.caretEl) this.caretEl.remove();
      this.inputEl.textContent = showText !== undefined ? showText : this.line;
      this.inputEl.classList.remove('tin');
      this.inputEl = null; this.caretEl = null;
      this._buf = null;
    }

    /* ---------------- barra de estado ---------------- */
    syncBar() {
      if (!this.sh) return;
      const p = this.sh.prompt();
      const env = document.getElementById('term-env');
      const ctx = document.getElementById('term-ctx');
      const ex = document.getElementById('term-exit');
      if (env) env.textContent = `${p.user}@${p.host}:${p.cwd}`;
      if (ctx) {
        let html = '';
        if (p.container) html += `<span class="badge-ctx container">container</span>`;
        else if (p.remote) html += `<span class="badge-ctx remote">ssh ${esc(p.remote || p.host)}</span>`;
        if (this.sh.uid === 0 && !p.container) html += `<span class="badge-ctx root">root</span>`;
        ctx.innerHTML = html;
      }
      if (ex) {
        const st = this.sh.lastStatus;
        ex.innerHTML = st === 0
          ? `<span style="color:var(--tx-3)">exit 0</span>`
          : `<span style="color:var(--term-red)">exit ${st}</span>`;
      }
    }

    /* ---------------- entrada ---------------- */
    _bind() {
      this.out.addEventListener('mouseup', () => {
        if (window.getSelection().toString() === '') this.focus();
      });
      this.hidden.addEventListener('keydown', (e) => this.onKey(e));
      this.hidden.addEventListener('input', (e) => {
        const v = this.hidden.value;
        if (v) { this.insert(v); this.hidden.value = ''; }
      });
      if (this.mobileInput) {
        const send = () => {
          const v = this.mobileInput.value;
          this.mobileInput.value = '';
          if (this.pendingRead) { this.line = v; this.submitRead(); return; }
          if (this.busy) return;
          this.line = v; this.cursor = v.length;
          this.renderLine();
          this.submit();
        };
        this.mobileInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
        const btn = this.el.querySelector('#term-mobile-go');
        if (btn) btn.onclick = send;
      }
    }

    focus() {
      if (this.overlay) { const t = this.overlay.querySelector('textarea, .ov-body'); if (t && t.focus) t.focus(); return; }
      if (window.innerWidth <= 860 && this.mobileInput) { this.mobileInput.focus(); return; }
      this.hidden.focus({ preventScroll: true });
    }

    insert(text) {
      if (this.busy && !this.pendingRead) return;
      text = text.replace(/\r/g, '');
      if (text.includes('\n')) {
        const parts = text.split('\n');
        for (let i = 0; i < parts.length; i++) {
          this.line = this.line.slice(0, this.cursor) + parts[i] + this.line.slice(this.cursor);
          this.cursor += parts[i].length;
          this.renderLine();
          if (i < parts.length - 1) { if (this.pendingRead) this.submitRead(); else this.submit(); }
        }
        return;
      }
      this.line = this.line.slice(0, this.cursor) + text + this.line.slice(this.cursor);
      this.cursor += text.length;
      this.renderLine();
      this.scroll();
    }

    onKey(e) {
      if (this.overlay) return;
      const k = e.key;

      if (e.ctrlKey || e.metaKey) {
        if (k === 'c' || k === 'C') {
          e.preventDefault();
          if (window.getSelection().toString()) { document.execCommand('copy'); return; }
          if (this.busy) { this.aborted = true; return; }
          this.freezeLine(this.line + '^C');
          this.line = ''; this.cursor = 0;
          this.prompt();
          return;
        }
        if (k === 'l' || k === 'L') { e.preventDefault(); this.clear(); this.prompt(); return; }
        if (k === 'd' || k === 'D') {
          e.preventDefault();
          if (this.line === '') {
            if (this.stack.length) { this.write('exit\n'); this.popSession(); }
            else this.write('\x1b[2m(Ctrl+D: use "exit" para sair de sessões aninhadas)\x1b[0m\n');
          }
          return;
        }
        if (k === 'u' || k === 'U') { e.preventDefault(); this.line = this.line.slice(this.cursor); this.cursor = 0; this.renderLine(); return; }
        if (k === 'k' || k === 'K') { e.preventDefault(); this.line = this.line.slice(0, this.cursor); this.renderLine(); return; }
        if (k === 'a' || k === 'A') { e.preventDefault(); this.cursor = 0; this.renderLine(); return; }
        if (k === 'e' || k === 'E') { e.preventDefault(); this.cursor = this.line.length; this.renderLine(); return; }
        if (k === 'w' || k === 'W') {
          e.preventDefault();
          const before = this.line.slice(0, this.cursor).replace(/\s*\S+\s*$/, '');
          this.line = before + this.line.slice(this.cursor);
          this.cursor = before.length;
          this.renderLine();
          return;
        }
        if (k === 'v' || k === 'V') return; // deixa colar
        return;
      }

      switch (k) {
        case 'Enter':
          e.preventDefault();
          if (this.pendingRead) { this.submitRead(); return; }
          if (this.busy) return;
          this.submit();
          return;
        case 'Backspace':
          e.preventDefault();
          if (this.cursor > 0) { this.line = this.line.slice(0, this.cursor - 1) + this.line.slice(this.cursor); this.cursor--; this.renderLine(); }
          return;
        case 'Delete':
          e.preventDefault();
          this.line = this.line.slice(0, this.cursor) + this.line.slice(this.cursor + 1);
          this.renderLine();
          return;
        case 'ArrowLeft': e.preventDefault(); if (this.cursor > 0) { this.cursor--; this.renderLine(); } return;
        case 'ArrowRight': e.preventDefault(); if (this.cursor < this.line.length) { this.cursor++; this.renderLine(); } return;
        case 'Home': e.preventDefault(); this.cursor = 0; this.renderLine(); return;
        case 'End': e.preventDefault(); this.cursor = this.line.length; this.renderLine(); return;
        case 'ArrowUp':
          e.preventDefault();
          if (this.pendingRead || this.busy) return;
          if (this.histIdx === -1) { this.histDraft = this.line; this.histIdx = this.history.length; }
          if (this.histIdx > 0) { this.histIdx--; this.line = this.history[this.histIdx]; this.cursor = this.line.length; this.renderLine(); }
          return;
        case 'ArrowDown':
          e.preventDefault();
          if (this.histIdx === -1) return;
          this.histIdx++;
          if (this.histIdx >= this.history.length) { this.histIdx = -1; this.line = this.histDraft; }
          else this.line = this.history[this.histIdx];
          this.cursor = this.line.length;
          this.renderLine();
          return;
        case 'Tab':
          e.preventDefault();
          this.complete();
          return;
        case 'Escape':
          e.preventDefault();
          this.line = ''; this.cursor = 0; this.renderLine();
          return;
      }
    }

    /* ---------------- autocompletar ---------------- */
    complete() {
      if (this.busy) return;
      const before = this.line.slice(0, this.cursor);
      const m = /(\S*)$/.exec(before);
      const frag = m ? m[1] : '';
      const isFirst = before.trim() === frag.trim() && !/[|;&]\s*\S*$/.test(before.slice(0, -frag.length || undefined));
      let candidates = [];
      const sh = this.sh;
      if (isFirst && !frag.includes('/')) {
        const seen = new Set();
        for (const n of Object.keys(LX.BUILTINS)) if (n.startsWith(frag)) seen.add(n);
        for (const d of (sh.getVar('PATH') || '').split(':')) {
          try { for (const n of sh.m.fs.readdir(d, sh.fsopts())) if (n.startsWith(frag)) seen.add(n); } catch (e) { }
        }
        for (const n of sh.aliases.keys()) if (n.startsWith(frag)) seen.add(n);
        candidates = Array.from(seen).sort();
      } else {
        const slash = frag.lastIndexOf('/');
        const dir = slash >= 0 ? frag.slice(0, slash + 1) : '';
        const base = slash >= 0 ? frag.slice(slash + 1) : frag;
        const dirPath = dir === '' ? sh.cwd : LX.FileSystem.normalize(dir.replace(/^~/, sh.getVar('HOME')), sh.cwd);
        try {
          const names = sh.m.fs.readdir(dirPath, sh.fsopts());
          candidates = names.filter(n => n.startsWith(base) && (base.startsWith('.') || !n.startsWith('.')))
            .map(n => {
              let isDir = false;
              try { isDir = sh.m.fs.stat(LX.FileSystem.join(dirPath, n), sh.fsopts()).type === 'dir'; } catch (e) { }
              return dir + n + (isDir ? '/' : '');
            }).sort();
        } catch (e) { candidates = []; }
      }
      if (!candidates.length) return;
      if (candidates.length === 1) {
        const add = candidates[0].slice(frag.length);
        this.insert(add + (candidates[0].endsWith('/') ? '' : ' '));
        return;
      }
      // prefixo comum
      let common = candidates[0];
      for (const c of candidates) { while (!c.startsWith(common)) common = common.slice(0, -1); }
      if (common.length > frag.length) { this.insert(common.slice(frag.length)); return; }
      const saved = this.line, savedCur = this.cursor;
      this.freezeLine();
      this.write('\n');
      const cols = 4;
      const w = Math.max(...candidates.map(c => c.length)) + 2;
      for (let i = 0; i < candidates.length; i += cols) {
        this.write(candidates.slice(i, i + cols).map(c => c.padEnd(w)).join('') + '\n');
      }
      this.prompt();
      this.line = saved; this.cursor = savedCur;
      this.renderLine();
    }

    /* ---------------- execução ---------------- */
    async submit() {
      const cmd = this.line;
      this.freezeLine();
      this.histIdx = -1;
      if (cmd.trim()) {
        this.history.push(cmd);
        if (this.history.length > 500) this.history.shift();
        try { this.sh.m.fs.appendFile(this.sh.getVar('HISTFILE') || '/home/aluno/.bash_history', cmd + '\n', this.sh.fsopts()); } catch (e) { }
      }
      if (!cmd.trim()) { this.prompt(); return; }
      await this.exec(cmd);
      this.prompt();
      this.focus();
    }

    async exec(cmd) {
      // "exit" fecha sessões aninhadas
      if (/^\s*(exit|logout)\s*$/.test(cmd) && this.stack.length) { this.popSession(); return; }
      this.busy = true;
      this.aborted = false;
      const io = {
        stdin: new InStream(''),
        stdout: new Stream({ onWrite: (s) => this.write(s), isTTY: true, limit: 300000 }),
        stderr: new Stream({ onWrite: (s) => this.write(s), isTTY: true, limit: 300000 }),
        term: this
      };
      const ex = new Executor(this.sh, io);
      let status = 0;
      try {
        status = await ex.run(cmd);
      } catch (e) {
        if (e && e.isExit) {
          status = e.code;
          if (this.stack.length) { this.popSession(); this.busy = false; return status; }
        }
        else if (e && e.isInterrupt) { this.write('^C\n'); status = 130; }
        else if (e && e.isParseError) { this.write(`\x1b[31mbash: ${e.message}\x1b[0m\n`); status = 2; }
        else if (e && e.isLimit) { this.write(`\n\x1b[33m[${e.message}]\x1b[0m\n`); status = 1; }
        else { this.write(`\x1b[31mbash: erro interno: ${e.message}\x1b[0m\n`); status = 1; console.error(e); }
      }
      this.sh.lastStatus = status;
      this.busy = false;
      this.aborted = false;
      this.syncBar();
      if (this.app) this.app.onCommandRun(cmd, status);
      return status;
    }

    /* Executa em nome da plataforma (botão "rodar exemplo") */
    async runVisible(cmd) {
      if (this.busy) return;
      if (this.inputEl) { this.freezeLine(cmd); }
      else { this.write(this.promptHtmlPlain() + cmd + '\n'); }
      this.history.push(cmd);
      await this.exec(cmd);
      this.prompt();
      this.focus();
    }
    promptHtmlPlain() {
      const p = this.sh.prompt();
      return `\x1b[32m${p.user}@${p.host}\x1b[0m:\x1b[34m${p.cwd}\x1b[0m${p.sym} `;
    }

    /* Executa em silêncio (verificadores) */
    async runQuiet(cmd, shell) {
      const sh = shell || this.sh;
      const out = new Stream({ limit: 200000 });
      const io = { stdin: new InStream(''), stdout: out, stderr: out, term: { aborted: false } };
      const ex = new Executor(sh, io);
      let status = 0;
      try { status = await ex.run(cmd); } catch (e) { if (e && e.isExit) status = e.code; else status = 1; }
      return { status, out: out.value() };
    }

    /* ---------------- leitura interativa (senhas, confirmações) ---------------- */
    readLine(promptText, opts = {}) {
      return new Promise((resolve) => {
        if (promptText) this.write(promptText);
        const row = document.createElement('div');
        row.className = 'term-input-row';
        row.innerHTML = '<span class="tin"></span><span id="term-caret"></span>';
        this.out.appendChild(row);
        this._buf = null;
        this.inputEl = row.querySelector('.tin');
        this.caretEl = row.querySelector('#term-caret');
        this.line = ''; this.cursor = 0;
        this.masked = !!opts.silent;
        this.renderLine();
        this.scroll();
        this.focus();
        this.pendingRead = (value) => {
          this.masked = false;
          this.pendingRead = null;
          resolve(value);
        };
      });
    }
    submitRead() {
      const v = this.line;
      this.freezeLine(this.masked ? '' : v);
      const cb = this.pendingRead;
      this.line = ''; this.cursor = 0;
      if (cb) cb(v);
    }

    /* ---------------- sessões aninhadas ---------------- */
    pushSession(sh, label) {
      this.stack.push({ sh: this.sh, label: this.label });
      this.sh = sh;
      this.label = label;
      this.syncBar();
    }
    popSession() {
      if (!this.stack.length) return;
      const prev = this.stack.pop();
      this.sh = prev.sh;
      this.label = prev.label;
      this.write('\x1b[2mlogout\x1b[0m\n');
      this.syncBar();
      this.prompt();
    }
    becomeRoot(user, login) {
      const sh = this.sh.clone({ uid: user.uid, gid: user.gid, user: user.name });
      sh.setVar('USER', user.name, true);
      sh.setVar('HOME', user.home, true);
      sh.setVar('LOGNAME', user.name, true);
      sh.setVar('PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', true);
      if (login) sh.cwd = user.home;
      sh.jobs = this.sh.jobs;
      this.pushSession(sh, 'root');
      this.write(`\x1b[2mAgora você é ${user.name}. Digite "exit" para voltar.\x1b[0m\n`);
    }
    sshInto(remoteMachine, user, host) {
      const u = remoteMachine.userByName(user);
      const sh = new Shell(remoteMachine, { cwd: u.home, uid: u.uid, gid: u.gid, user, remote: host });
      sh.history = this.history;
      this.pushSession(sh, 'ssh:' + host);
      this.write(`Welcome to Ubuntu 26.04.1 LTS (GNU/Linux 6.14.0-27-generic x86_64)\n\n`);
      this.write(`\x1b[2mÚltimo acesso: hoje, de 10.0.2.15\x1b[0m\n`);
    }
    enterContainer(sh, cid) {
      sh.history = this.history;
      this.pushSession(sh, 'docker:' + cid);
    }

    /* ---------------- overlays ---------------- */
    openOverlay(html) {
      const ov = document.createElement('div');
      ov.className = 'term-overlay';
      ov.innerHTML = html;
      this.shellEl.appendChild(ov);
      this.overlay = ov;
      return ov;
    }
    closeOverlay() {
      if (this.overlay) { this.overlay.remove(); this.overlay = null; }
      this.focus();
    }

    pager(text, title, opts = {}) {
      return new Promise((resolve) => {
        const lines = text.split('\n');
        const body = opts.numbers
          ? lines.map((l, i) => String(i + 1).padStart(6) + '  ' + l).join('\n')
          : text;
        const ov = this.openOverlay(
          `<div class="ov-body" tabindex="0">${ansiToHtml(body)}</div>` +
          `<div class="ov-bar"><b>${esc(title || '')}</b><span class="spacer"></span>` +
          `<span>${lines.length} linhas</span><span>q para sair</span></div>`);
        const el = ov.querySelector('.ov-body');
        el.focus();
        const done = () => { document.removeEventListener('keydown', onKey, true); this.closeOverlay(); resolve(); };
        const onKey = (e) => {
          if (e.key === 'q' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); return; }
          if (e.key === ' ' || e.key === 'PageDown' || e.key === 'f') { e.preventDefault(); el.scrollTop += el.clientHeight * .9; }
          if (e.key === 'b' || e.key === 'PageUp') { e.preventDefault(); el.scrollTop -= el.clientHeight * .9; }
          if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); el.scrollTop += 24; }
          if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); el.scrollTop -= 24; }
          if (e.key === 'g') { e.preventDefault(); el.scrollTop = 0; }
          if (e.key === 'G') { e.preventDefault(); el.scrollTop = el.scrollHeight; }
        };
        document.addEventListener('keydown', onKey, true);
        ov.querySelector('.ov-bar').onclick = done;
      });
    }

    editor(path, opts = {}) {
      return new Promise((resolve) => {
        const sh = this.sh;
        let content = '';
        let existed = true;
        try { content = sh.m.fs.readFile(path, sh.fsopts()); }
        catch (e) { existed = false; }
        const flavor = (opts.flavor || 'nano');
        const ov = this.openOverlay(
          `<div class="ov-bar"><b>GNU ${flavor === 'nano' ? 'nano 8.4' : flavor}</b>` +
          `<span class="spacer"></span><span>${esc(path)}${existed ? '' : '  (Novo arquivo)'}</span></div>` +
          `<textarea class="ov-edit" spellcheck="false"></textarea>` +
          `<div class="ov-keys">` +
          `<span><b>Ctrl+S</b> gravar</span><span><b>Ctrl+X</b> gravar e sair</span>` +
          `<span><b>Esc</b> sair sem gravar</span><span><b>Tab</b> indenta</span></div>`);
        const ta = ov.querySelector('textarea');
        ta.value = content;
        setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 10);
        const save = () => {
          try {
            sh.m.fs.writeFile(path, ta.value, sh.fsopts());
            return true;
          } catch (e) {
            this.write(`\x1b[31m${flavor}: ${path}: ${e.message}\x1b[0m\n`);
            return false;
          }
        };
        const finish = (didSave) => {
          ta.removeEventListener('keydown', onKey);
          this.closeOverlay();
          if (didSave) this.write(`\x1b[2m[ Gravado ${ta.value.split('\n').length} linhas em ${path} ]\x1b[0m\n`);
          resolve();
        };
        const onKey = (e) => {
          if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); const ok = save(); finish(ok); return; }
          if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (save()) this.flash('arquivo gravado'); return; }
          if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
          if (e.key === 'Tab') {
            e.preventDefault();
            const s = ta.selectionStart, en = ta.selectionEnd;
            ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
            ta.selectionStart = ta.selectionEnd = s + 2;
          }
        };
        ta.addEventListener('keydown', onKey);
      });
    }

    liveView(render, opts = {}) {
      return new Promise((resolve) => {
        const ov = this.openOverlay(
          `<div class="ov-body" tabindex="0"></div>` +
          `<div class="ov-bar"><b>${esc(opts.title || '')}</b><span class="spacer"></span><span>q ou Esc para sair</span></div>`);
        const el = ov.querySelector('.ov-body');
        el.focus();
        let timer = null;
        const tick = async () => {
          const html = opts.async ? await render() : render();
          el.innerHTML = ansiToHtml(html);
        };
        tick();
        timer = setInterval(tick, opts.interval || 1500);
        const done = () => { clearInterval(timer); document.removeEventListener('keydown', onKey, true); this.closeOverlay(); resolve(); };
        const onKey = (e) => { if (e.key === 'q' || e.key === 'Escape' || (e.ctrlKey && e.key === 'c')) { e.preventDefault(); e.stopPropagation(); done(); } };
        document.addEventListener('keydown', onKey, true);
        ov.querySelector('.ov-bar').onclick = done;
      });
    }

    async follow(paths, machine) {
      const sh = this.sh;
      const sizes = new Map();
      if (paths) for (const p of paths) { try { sizes.set(p, sh.m.fs.readFile(p, sh.fsopts()).length); } catch (e) { sizes.set(p, 0); } }
      let jlen = machine ? machine.journal.length : 0;
      this.aborted = false;
      const started = Date.now();
      while (!this.aborted && Date.now() - started < 120000) {
        await new Promise(r => setTimeout(r, 500));
        if (paths) for (const p of paths) {
          try {
            const data = sh.m.fs.readFile(p, sh.fsopts());
            const prev = sizes.get(p) || 0;
            if (data.length > prev) { this.write(data.slice(prev)); sizes.set(p, data.length); }
          } catch (e) { }
        }
        if (machine && machine.journal.length > jlen) {
          for (const l of machine.journal.slice(jlen)) {
            const d = new Date(l.ts);
            this.write(`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${String(d.getDate()).padStart(2)} ${d.toTimeString().slice(0, 8)} ${machine.hostname} ${l.unit}: ${l.msg}\n`);
          }
          jlen = machine.journal.length;
        }
      }
      throw new LX.InterruptSignal();
    }

    flash(msg) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = `<span class="ic">✓</span>${esc(msg)}`;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2200);
    }
  }

  LX.Terminal = Terminal;
})();
