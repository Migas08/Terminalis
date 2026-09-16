/* =========================================================================
   TERMINALIS — navegador de arquivos do laboratório
   ========================================================================= */
'use strict';
(function () {
  const { query: $, queryAll: $$, escapeHtml: esc } = LX.Util;
  const { ICON } = LX;

  class FileBrowser extends LX.App {
    renderFiles(path) {
      const sh = this.term.sh;
      this.fbPath = path || this.fbPath || sh.cwd;
      let node;
      try { node = sh.m.fs.stat(this.fbPath, sh.fsopts()); }
      catch (e) { this.fbPath = '/'; node = sh.m.fs.root; }
      const parts = this.fbPath.split('/').filter(Boolean);
      let crumbs = `<button data-go="/">/</button>`;
      let acc = '';
      parts.forEach((p, i) => { acc += '/' + p; crumbs += `<span class="sep">/</span><button data-go="${esc(acc)}">${esc(p)}</button>`; });
      let rows = '';
      let names = [];
      try { names = sh.m.fs.readdir(this.fbPath, sh.fsopts()); } catch (e) { rows = `<div class="fb-empty">Sem permissão de leitura neste diretório.</div>`; }
      const entries = names.map(n => {
        let st; try { st = sh.m.fs.lstat(LX.FileSystem.join(this.fbPath, n), sh.fsopts()); } catch (e) { st = null; }
        return { n, st };
      }).filter(e => e.st);
      entries.sort((a, b) => (b.st.type === 'dir') - (a.st.type === 'dir') || a.n.localeCompare(b.n));
      if (this.fbPath !== '/') rows += `<div class="fb-row dir" data-dir="${esc(LX.FileSystem.dirname(this.fbPath))}"><span class="ic">${ICON.folder}</span><span class="nm">..</span><span class="mode"></span><span class="sz"></span></div>`;
      for (const e of entries) {
        const isDir = e.st.type === 'dir';
        const isExe = !isDir && (e.st.mode & 0o111);
        const cls = isDir ? 'dir' : (isExe ? 'exe' : '');
        const ic = isDir ? ICON.folder : (e.st.type === 'link' ? ICON.link : ICON.file);
        rows += `<div class="fb-row ${cls}" data-${isDir ? 'dir' : 'file'}="${esc(LX.FileSystem.join(this.fbPath, e.n))}">
          <span class="ic">${ic}</span>
          <span class="nm">${esc(e.n)}${isDir ? '/' : ''}</span>
          <span class="mode">${LX.modeToRwx(e.st.mode, e.st.type)}</span>
          <span class="sz">${isDir ? '—' : LX.humanSize(e.st.size)}</span>
        </div>`;
      }
      if (!rows) rows = `<div class="fb-empty">Diretório vazio.</div>`;
      $('#fb-crumbs').innerHTML = crumbs;
      $('#fb-list').innerHTML = rows;
      $$('#fb-crumbs button').forEach(b => b.onclick = () => this.renderFiles(b.dataset.go));
      $$('#fb-list .fb-row').forEach(r => r.onclick = () => {
        if (r.dataset.dir !== undefined) this.renderFiles(r.dataset.dir);
        else this.previewFile(r.dataset.file);
      });
      $('#fb-here').onclick = () => this.renderFiles(this.term.sh.cwd);
    }

    previewFile(path) {
      const sh = this.term.sh;
      let content;
      try { content = sh.m.fs.readFile(path, sh.fsopts()); }
      catch (e) { content = `(não foi possível ler: ${e.message})`; }
      if (content.length > 20000) content = content.slice(0, 20000) + '\n… (truncado)';
      $('#fb-preview').classList.remove('hidden');
      $('#fb-prev-name').textContent = path;
      $('#fb-prev-body').textContent = content || '(arquivo vazio)';
      $('#fb-prev-close').onclick = () => $('#fb-preview').classList.add('hidden');
      $('#fb-prev-edit').onclick = async () => { await this.term.editor(path); this.previewFile(path); };
      const runBtn = $('#fb-prev-run');
      // O 'rodar' (playground JS) so aparece dentro do curso de JavaScript.
      const rodavel = /\.(mjs|cjs|js)$/i.test(path) && this.trilhaId === 'js';
      if (runBtn) {
        runBtn.classList.toggle('hidden', !rodavel);
        runBtn.onclick = () => { if (LX.JSWorkspace) LX.JSWorkspace.openAndRun(this, path); };
      }
    }
  }

  for (const name of ['renderFiles', 'previewFile']) {
    Object.defineProperty(LX.App.prototype, name, Object.getOwnPropertyDescriptor(FileBrowser.prototype, name));
  }
})();
