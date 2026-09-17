/* =========================================================================
   TERMINALIS — controlador do playground JavaScript (Fase 1)

   Liga a interface ao runner isolado (LX.JS). O aluno programa direto no editor
   da aba "JS"; ao rodar, o código é salvo como arquivo no VFS e executado na
   sandbox de navegador (iframe + Worker). Os eventos estruturados são desenhados
   no console. Não acessa o domínio do runner nem executa código do aluno aqui:
   apenas orquestra e desenha. Carregar no Node é seguro — nada toca em
   document/Worker no nível de módulo; a sandbox só é criada sob demanda.
   ========================================================================= */
'use strict';
(function () {
  const { query: $ } = LX.Util;
  const JSW = {};
  const PROJ = '/home/aluno/js';
  const PADRAO = PROJ + '/rascunho.js';
  const MODELO = "// Escreva JavaScript e clique em Executar.\nconsole.log('Olá, JavaScript');\n";
  const MODELO_NOVO = "// Novo arquivo.\n";
  // Arquivos de código que a aba JS reconhece: JavaScript e TypeScript.
  const RE_JS = /\.(mjs|cjs|js|ts|mts|cts)$/i;

  let app = null;
  let runner = null;
  let sessionId = null;
  let entry = null;
  let runId = null;
  let running = false;
  let bound = false;
  let salvarTimer = null;
  let machineRef = null;

  const RAIZ = '/home/aluno';

  function normalizarAbs(path) {
    const out = [];
    for (const s of String(path).split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
    return '/' + out.join('/');
  }
  /* Resolve o caminho pedido pela sandbox contra o diretório do projeto e barra
     qualquer escape para fora de /home/aluno. */
  function resolverVfs(p) {
    let full = String(p);
    if (full.charAt(0) !== '/') full = dirName(entry || PADRAO) + '/' + full;
    full = normalizarAbs(full);
    if (full !== RAIZ && full.indexOf(RAIZ + '/') !== 0) throw new Error('Caminho fora da área permitida: ' + p);
    return full;
  }
  /* Capability fs: o único acesso ao VFS que a sandbox tem, sempre como o aluno
     e restrito à sua área. */
  function fsCapabilities() {
    const sh = () => app.term.sh;
    return {
      fs: {
        readFile: (p) => sh().m.fs.readFile(resolverVfs(p), sh().fsopts()),
        writeFile: (p, d) => {
          const full = resolverVfs(p);
          sh().m.fs.mkdirp(dirName(full), sh().fsopts());
          sh().m.fs.writeFile(full, String(d), sh().fsopts());
          marcarWorkspaceSujo();
          return true;
        },
        readdir: (p) => (sh().m.fs.readdir(resolverVfs(p), sh().fsopts()) || []).filter(n => typeof n === 'string'),
        mkdir: (p) => { sh().m.fs.mkdirp(resolverVfs(p), sh().fsopts()); marcarWorkspaceSujo(); return true; },
        stat: (p) => { const s = sh().m.fs.stat(resolverVfs(p), sh().fsopts()); return { type: s.type, size: s.size, mode: s.mode & 0o7777, isDirectory: s.type === 'dir', isFile: s.type === 'file' }; }
      }
    };
  }

  function resetarContextoDaMachine() {
    if (salvarTimer) { clearTimeout(salvarTimer); salvarTimer = null; }
    if (runner && sessionId) runner.dispose(sessionId);
    sessionId = runner ? runner.createSession() : null;
    entry = null;
    runId = null;
    setRunning(false);
    const ed = editorEl(); if (ed) ed.value = '';
    const out = consoleEl(); if (out) out.innerHTML = '';
  }

  function ensure(a) {
    const proximaApp = a || app;
    const proximaMachine = proximaApp && proximaApp.term && proximaApp.term.sh ? proximaApp.term.sh.m : null;
    if (machineRef && proximaMachine && proximaMachine !== machineRef) resetarContextoDaMachine();
    app = proximaApp;
    machineRef = proximaMachine;
    if (!runner) {
      runner = LX.JS.createRunner({ transport: LX.JS.Sandbox.createBrowserTransport(), capabilities: fsCapabilities() });
      runner.subscribe(onEvent);
      sessionId = runner.createSession();
    }
    if (!bound) bindControls();
  }

  function bindControls() {
    bound = true;
    const run = $('#js-run'); if (run) run.onclick = () => JSW.run();
    const cancel = $('#js-cancel'); if (cancel) cancel.onclick = () => JSW.cancel();
    const clear = $('#js-clear'); if (clear) clear.onclick = () => JSW.clear();
    const save = $('#js-save'); if (save) save.onclick = () => salvar(true);
    const ed = $('#js-editor');
    if (ed) {
      // Salva o buffer no VFS com debounce, para o programa persistir mesmo sem rodar.
      ed.addEventListener('input', agendarSalvar);
      ed.addEventListener('scroll', () => { const g = $('#js-gutter'); if (g) g.scrollTop = ed.scrollTop; });
      for (const ev of ['click', 'keyup', 'select']) ed.addEventListener(ev, atualizarCursor);
      // Tab insere dois espaços em vez de mudar o foco — é um editor de código.
      ed.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault(); salvar(true); return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault(); JSW.run(); return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = ed.selectionStart, t = ed.selectionEnd;
          ed.value = ed.value.slice(0, s) + '  ' + ed.value.slice(t);
          ed.selectionStart = ed.selectionEnd = s + 2;
          ed.dispatchEvent(new Event('input'));
        }
      });
    }
    bindPaneResizer();
  }

  function editorEl() { return $('#js-editor'); }
  function consoleEl() { return $('#js-console'); }

  function append(cls, text, locText) {
    const el = consoleEl();
    if (!el) return;
    const empty = el.querySelector('.js-empty'); if (empty) empty.remove();
    const line = document.createElement('div');
    line.className = 'js-line ' + cls;
    line.textContent = text;
    if (locText) {
      const span = document.createElement('span');
      span.className = 'js-loc';
      span.textContent = ' ' + locText;
      line.appendChild(span);
    }
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function setRunning(value) {
    running = value;
    const run = $('#js-run'); if (run) run.disabled = value;
    const cancel = $('#js-cancel'); if (cancel) cancel.disabled = !value;
    const state = $('#js-run-state'); if (state) state.textContent = value ? 'executando…' : 'pronto';
    const label = $('#js-run-label'); if (label) label.textContent = value ? 'Executando' : 'Executar';
  }

  function locationOf(payload) {
    if (!payload || payload.line == null) return '';
    let text = 'linha ' + payload.line;
    if (payload.column != null) text += ', coluna ' + payload.column;
    return '(' + text + ')';
  }

  function onEvent(event) {
    const E = LX.JS.Protocol.EVENTS;
    const p = event.payload || {};
    switch (event.type) {
      case E.RUN_START: append('js-sys', '▸ executando ' + p.entrypoint); break;
      case E.CONSOLE: append('js-' + p.level, p.text); break;
      case E.OUTPUT_LIMIT: append('js-sys', '■ limite de saída atingido — restante omitido'); break;
      case E.UNCAUGHT_ERROR: append('js-err', p.name + ': ' + p.message, locationOf(p)); break;
      case E.UNHANDLED_REJECTION: append('js-err', 'Promessa rejeitada: ' + p.message, locationOf(p)); break;
      case E.TEST_START: append('js-sys', '▷ ' + p.name); break;
      case E.TEST_RESULT: append(p.ok ? 'js-ok' : 'js-err', (p.ok ? '✓ ' : '✗ ') + p.name + (p.ok ? '' : ' — ' + (p.message || 'falhou'))); break;
      case E.DIAGNOSTIC:
        if (p.kind === 'test-summary') append('js-sys', '■ testes: ' + p.passed + ' passaram, ' + p.failed + ' falharam');
        break;
      case E.RUN_TIMEOUT: append('js-sys', '■ tempo esgotado — execução encerrada'); setRunning(false); break;
      case E.RUN_CANCELLED: append('js-sys', '■ execução cancelada'); setRunning(false); break;
      case E.RUN_COMPLETE: append('js-sys', '■ concluído'); setRunning(false); break;
      default: break;
    }
  }

  function baseName(path) {
    const parts = String(path).split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : String(path);
  }
  function dirName(path) {
    return LX.FileSystem && LX.FileSystem.dirname ? LX.FileSystem.dirname(path) : path.replace(/\/[^/]*$/, '') || '/';
  }

  function marcarWorkspaceSujo() {
    if (LX.Sync && typeof LX.Sync.marcarSujo === 'function') LX.Sync.marcarSujo('workspace');
  }

  function agendarSalvar() {
    statusSalvar('salvando…', true);
    atualizarEditorUI();
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(salvar, 700);
  }

  function setEntry(path) {
    entry = path || PADRAO;
    const el = $('#js-entry');
    if (el) el.textContent = baseName(entry);
    const lang = $('#js-lang-state');
    if (lang) lang.textContent = /\.(ts|mts|cts)$/i.test(entry) ? 'TypeScript' : 'JavaScript';
  }

  function statusSalvar(text, pendente) {
    const el = $('#js-save-state');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('pending', !!pendente);
  }

  function atualizarCursor() {
    const ed = editorEl(), out = $('#js-cursor-state');
    if (!ed || !out) return;
    const antes = ed.value.slice(0, ed.selectionStart).split('\n');
    out.textContent = 'Ln ' + antes.length + ', Col ' + (antes[antes.length - 1].length + 1);
  }

  function atualizarEditorUI() {
    const ed = editorEl(), gutter = $('#js-gutter');
    if (!ed) return;
    if (gutter) {
      const total = Math.max(1, ed.value.split('\n').length);
      gutter.textContent = Array.from({ length: total }, (_, i) => i + 1).join('\n');
      gutter.scrollTop = ed.scrollTop;
    }
    atualizarCursor();
  }

  function bindPaneResizer() {
    const handle = $('#js-pane-resizer'), pane = $('#js-editor-pane'), shell = $('.js-shell');
    if (!handle || !pane || !shell) return;
    const aplicar = (y) => {
      const r = shell.getBoundingClientRect();
      const top = pane.getBoundingClientRect().top;
      const max = Math.max(150, r.bottom - top - 150);
      pane.style.flexBasis = Math.max(110, Math.min(max, y - top)) + 'px';
    };
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId); handle.classList.add('dragging');
    });
    handle.addEventListener('pointermove', e => { if (handle.hasPointerCapture(e.pointerId)) aplicar(e.clientY); });
    handle.addEventListener('pointerup', e => { if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId); handle.classList.remove('dragging'); });
    handle.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      aplicar(pane.getBoundingClientRect().bottom + (e.key === 'ArrowDown' ? 24 : -24));
    });
  }

  /* Grava o conteúdo do editor no VFS (cria o diretório se preciso). */
  function salvar(manual) {
    if (salvarTimer) { clearTimeout(salvarTimer); salvarTimer = null; }
    if (!app || !entry) return;
    const ed = editorEl();
    if (!ed) return;
    const sh = app.term.sh;
    try {
      let atual = null;
      try { atual = sh.m.fs.readFile(entry, sh.fsopts()); } catch (error) { atual = null; }
      if (atual === ed.value) {
        statusSalvar(manual ? 'salvo agora' : 'salvo localmente', false);
        return;
      }
      sh.m.fs.mkdirp(dirName(entry), sh.fsopts());
      sh.m.fs.writeFile(entry, ed.value, sh.fsopts());
      marcarWorkspaceSujo();
      statusSalvar(manual ? 'salvo agora' : 'salvo localmente', false);
    } catch (error) { /* sem permissão de escrita: silencioso, o run reporta */ }
  }

  /* Carrega o conteúdo de um arquivo do VFS no editor (ou o modelo inicial). */
  function carregar(path) {
    setEntry(path);
    const ed = editorEl();
    if (!ed) return;
    let conteudo = null;
    try { conteudo = app.term.sh.m.fs.readFile(entry, app.term.sh.fsopts()); }
    catch (error) { conteudo = null; }
    ed.value = conteudo != null ? conteudo : MODELO;
    atualizarEditorUI();
    statusSalvar('salvo localmente', false);
  }

  /* ---------- barra de arquivos do projeto (estilo editor multi-arquivo) ----------
     A "aba JS" é um mini-editor: a faixa lista os arquivos de código do diretório
     do projeto, o aluno cria/renomeia/exclui e alterna entre eles. Tudo mora no
     VFS (nunca em memória volátil), então persiste com o laboratório. */
  function projDir() { return entry ? dirName(entry) : PROJ; }

  function listarArquivos() {
    if (!app) return [];
    const sh = app.term.sh;
    let nomes;
    try { nomes = sh.m.fs.readdir(projDir(), sh.fsopts()) || []; }
    catch (error) { return []; }
    return nomes.filter(n => typeof n === 'string' && RE_JS.test(n)).sort();
  }

  /* Salva o buffer atual e abre outro arquivo do projeto no editor. */
  function abrirArquivo(full) {
    if (full === entry) return;
    salvar();
    carregar(full);
    renderArquivos();
    const ed = editorEl(); if (ed) ed.focus();
  }

  /* Campo embutido na faixa para nomear um arquivo (criar ou renomear). */
  function campoNome(valorInicial, aoConfirmar, antesDe) {
    const wrap = $('#js-files');
    if (!wrap) return;
    const existente = wrap.querySelector('.js-file-input');
    if (existente) { existente.focus(); return; }
    const inp = document.createElement('input');
    inp.className = 'js-file-input';
    inp.setAttribute('aria-label', 'Nome do arquivo');
    inp.placeholder = 'nome.js';
    inp.value = valorInicial || '';
    let feito = false;
    const confirmar = () => {
      if (feito) return; feito = true;
      const bruto = inp.value.trim();
      if (!bruto || bruto.indexOf('/') >= 0) { renderArquivos(); return; }
      let nome = bruto;
      if (!RE_JS.test(nome)) nome += '.js';
      aoConfirmar(nome);
    };
    const cancelar = () => { if (feito) return; feito = true; renderArquivos(); };
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
    });
    inp.addEventListener('blur', confirmar);
    wrap.insertBefore(inp, antesDe || wrap.querySelector('.js-file-new'));
    inp.focus();
    if (valorInicial) inp.select();
  }

  /* Cria um arquivo vazio no diretório do projeto e o abre. */
  function criarArquivo() {
    if (!app) return;
    campoNome('', (nome) => {
      const sh = app.term.sh;
      const full = projDir() + '/' + nome;
      try {
        sh.m.fs.mkdirp(projDir(), sh.fsopts());
        let existe = false;
        try { sh.m.fs.lstat(full, sh.fsopts()); existe = true; } catch (error) { existe = false; }
        if (!existe) {
          sh.m.fs.writeFile(full, MODELO_NOVO, sh.fsopts());
          marcarWorkspaceSujo();
        }
      } catch (error) { renderArquivos(); return; }
      salvar();
      carregar(full);
      renderArquivos();
      const ed = editorEl(); if (ed) ed.focus();
    });
  }

  /* Renomeia um arquivo do projeto (mantém o conteúdo). */
  function renomearArquivo(full, tab) {
    if (!app) return;
    const atual = baseName(full);
    campoNome(atual, (nome) => {
      const sh = app.term.sh;
      const alvo = projDir() + '/' + nome;
      if (alvo === full) { renderArquivos(); return; }
      try {
        let ocupado = false;
        try { sh.m.fs.lstat(alvo, sh.fsopts()); ocupado = true; } catch (error) { ocupado = false; }
        if (ocupado) { renderArquivos(); return; }
        if (full === entry) salvar();
        sh.m.fs.rename(full, alvo, sh.fsopts());
        marcarWorkspaceSujo();
      } catch (error) { renderArquivos(); return; }
      if (full === entry) carregar(alvo);
      renderArquivos();
    }, tab);
  }

  /* Exclui um arquivo do projeto (sempre resta ao menos um). */
  function excluirArquivo(full) {
    if (!app) return;
    const sh = app.term.sh;
    const nomes = listarArquivos();
    if (nomes.length <= 1) return;
    try { sh.m.fs.rmrf(full, sh.fsopts()); marcarWorkspaceSujo(); } catch (error) { return; }
    if (full === entry) {
      const resta = listarArquivos();
      carregar(resta.length ? projDir() + '/' + resta[0] : PADRAO);
    }
    renderArquivos();
  }

  /* Desenha a faixa: uma aba por arquivo (ativa destacada) e o botão "novo". */
  function renderArquivos() {
    const wrap = $('#js-files');
    if (!wrap) return;
    wrap.textContent = '';
    const dir = projDir();
    const nomes = listarArquivos();
    // O arquivo aberto sempre aparece, mesmo antes do primeiro salvamento.
    if (entry && dirName(entry) === dir && RE_JS.test(entry) && nomes.indexOf(baseName(entry)) < 0) {
      nomes.push(baseName(entry));
      nomes.sort();
    }
    for (const n of nomes) {
      const full = dir + '/' + n;
      const ativo = full === entry;
      const tab = document.createElement('div');
      tab.className = 'js-file' + (ativo ? ' active' : '');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', ativo ? 'true' : 'false');
      const nome = document.createElement('button');
      nome.type = 'button';
      nome.className = 'js-file-name';
      nome.textContent = n;
      nome.title = n;
      nome.onclick = () => abrirArquivo(full);
      nome.ondblclick = () => renomearArquivo(full, tab);
      tab.appendChild(nome);
      if (nomes.length > 1) {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'js-file-x';
        x.textContent = '×';
        x.title = 'Excluir ' + n;
        x.setAttribute('aria-label', 'Excluir ' + n);
        x.onclick = (e) => { e.stopPropagation(); excluirArquivo(full); };
        tab.appendChild(x);
      }
      wrap.appendChild(tab);
    }
    const novo = document.createElement('button');
    novo.type = 'button';
    novo.id = 'js-file-new';
    novo.className = 'js-file-new';
    novo.textContent = '+';
    novo.title = 'Novo arquivo';
    novo.setAttribute('aria-label', 'Novo arquivo');
    novo.onclick = () => criarArquivo();
    wrap.appendChild(novo);
  }

  JSW.onShow = function (a) {
    ensure(a);
    const ed = editorEl();
    if (ed && !ed.value && !entry) carregar(PADRAO);
    atualizarEditorUI();
    renderArquivos();
  };

  /* Abre um arquivo .js no editor e roda (usado pelo preview de Arquivos). */
  JSW.openAndRun = function (a, path) {
    ensure(a);
    carregar(path);
    renderArquivos();
    if (app && typeof app.switchTab === 'function') app.switchTab('js');
    JSW.run();
  };

  /* Leva um exemplo da aula ao editor sem executá-lo automaticamente. */
  JSW.openSnippet = function (a, code) {
    ensure(a);
    if (!entry) setEntry(PADRAO);
    const ed = editorEl();
    if (!ed) return;
    ed.value = String(code || '').replace(/\n$/, '');
    ed.selectionStart = ed.selectionEnd = 0;
    atualizarEditorUI();
    statusSalvar('salvando…', true);
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(salvar, 700);
    renderArquivos();
    if (app && typeof app.switchTab === 'function') app.switchTab('js');
    ed.focus();
  };

  /* Reúne os arquivos de código sob o diretório do projeto, com caminho relativo
     ao diretório do entrypoint — assim `import './lib.js'` resolve na sandbox. */
  function coletarProjeto(dir, entryName, codigo) {
    const sh = app.term.sh;
    const map = {};
    let count = 0;
    const walk = (d) => {
      let nomes;
      try { nomes = sh.m.fs.readdir(d, sh.fsopts()); } catch (e) { return; }
      for (const n of nomes) {
        if (count > 180) return;
        const full = d + '/' + n;
        let st;
        try { st = sh.m.fs.lstat(full, sh.fsopts()); } catch (e) { continue; }
        if (st.type === 'dir') { walk(full); continue; }
        if (!RE_JS.test(n)) continue;
        let c;
        try { c = sh.m.fs.readFile(full, sh.fsopts()); } catch (e) { continue; }
        map[full.slice(dir.length + 1)] = c;
        count++;
      }
    };
    walk(dir);
    map[entryName] = codigo;   // o buffer do editor é a verdade para o entrypoint
    return map;
  }

  /* Entrega os arquivos ao runner e dispara a execução na sandbox. */
  function iniciar(files, entryName) {
    try {
      /* Cada execução recebe o retrato atual do projeto. Reusar a sessão faria
         arquivos excluídos ou renomeados sobreviverem no mapa interno. */
      if (sessionId) runner.dispose(sessionId);
      sessionId = runner.createSession();
      runner.putFiles(sessionId, files);
      setRunning(true);
      runId = runner.run(sessionId, entryName);
    } catch (error) {
      append('js-err', 'Falha ao iniciar: ' + error.message);
      setRunning(false);
    }
  }

  JSW.run = function () {
    if (!runner || running) return;
    if (!entry) setEntry(PADRAO);
    const ed = editorEl();
    const codigo = ed ? ed.value : '';
    if (!codigo.trim()) { append('js-err', 'Escreva algo no editor antes de rodar.'); return; }
    salvar();                       // o programa vira arquivo no laboratório
    const name = baseName(entry);
    const projeto = coletarProjeto(dirName(entry), name, codigo);
    const TS = LX.JS.TypeScript;
    // TypeScript: compila (fora do realm do app) antes de rodar na mesma sandbox.
    if (TS && TS.projectHasTypeScript(projeto)) {
      setRunning(true);
      append('js-sys', '↻ compilando TypeScript…');
      TS.load().then((ts) => {
        let saida;
        try { saida = TS.transpileProject(ts, projeto); }
        catch (error) { append('js-err', 'Erro de compilação: ' + error.message); setRunning(false); return; }
        for (const d of saida.diagnostics) {
          append('js-err', 'TS' + (d.code != null ? ' TS' + d.code : '') + ': ' + d.message, d.line != null ? locationOf(d) : '');
        }
        iniciar(saida.files, TS.jsName(name));
      }, (error) => {
        append('js-err', (error && error.message) || 'Falha ao carregar o TypeScript.');
        setRunning(false);
      });
      return;
    }
    iniciar(projeto, name);
  };

  JSW.cancel = function () {
    if (runner && runId) runner.cancel(runId);
  };

  /* Força o buffer pendente para o VFS antes de logout/reload; marcarSujo cria
     o cache síncrono e o Sync decide se também deve enviar ao Supabase. */
  JSW.flush = function () {
    salvar();
  };

  JSW.clear = function () {
    const el = consoleEl();
    if (el) el.innerHTML = '<div class="js-empty"><span>&gt;_</span><p>A saída, os erros e os testes aparecem aqui.</p></div>';
  };

  LX.JSWorkspace = JSW;
})();
