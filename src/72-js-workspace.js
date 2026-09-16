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
  const PADRAO = '/home/aluno/js/rascunho.js';
  const MODELO = "// Escreva JavaScript e clique em rodar.\nconsole.log('Olá, JavaScript');\n";

  let app = null;
  let runner = null;
  let sessionId = null;
  let entry = null;
  let runId = null;
  let running = false;
  let bound = false;
  let salvarTimer = null;

  function ensure(a) {
    app = a || app;
    if (!runner) {
      runner = LX.JS.createRunner({ transport: LX.JS.Sandbox.createBrowserTransport() });
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
    const ed = $('#js-editor');
    if (ed) {
      // Salva o buffer no VFS com debounce, para o programa persistir mesmo sem rodar.
      ed.addEventListener('input', () => { clearTimeout(salvarTimer); salvarTimer = setTimeout(salvar, 700); });
      // Tab insere dois espaços em vez de mudar o foco — é um editor de código.
      ed.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = ed.selectionStart, t = ed.selectionEnd;
          ed.value = ed.value.slice(0, s) + '  ' + ed.value.slice(t);
          ed.selectionStart = ed.selectionEnd = s + 2;
        }
      });
    }
  }

  function editorEl() { return $('#js-editor'); }
  function consoleEl() { return $('#js-console'); }

  function append(cls, text, locText) {
    const el = consoleEl();
    if (!el) return;
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
  }

  function locationOf(payload) {
    if (!payload || !payload.file) return '';
    let text = 'linha ' + (payload.line != null ? payload.line : '?');
    if (payload.column != null) text += ', coluna ' + payload.column;
    return text;
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

  function setEntry(path) {
    entry = path || PADRAO;
    const el = $('#js-entry');
    if (el) el.textContent = baseName(entry);
  }

  /* Grava o conteúdo do editor no VFS (cria o diretório se preciso). */
  function salvar() {
    if (!app || !entry) return;
    const ed = editorEl();
    if (!ed) return;
    const sh = app.term.sh;
    try {
      sh.m.fs.mkdirp(dirName(entry), sh.fsopts());
      sh.m.fs.writeFile(entry, ed.value, sh.fsopts());
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
  }

  JSW.onShow = function (a) {
    ensure(a);
    const ed = editorEl();
    if (ed && !ed.value) carregar(entry || PADRAO);
  };

  /* Abre um arquivo .js no editor e roda (usado pelo preview de Arquivos). */
  JSW.openAndRun = function (a, path) {
    ensure(a);
    carregar(path);
    if (app && typeof app.switchTab === 'function') app.switchTab('js');
    JSW.run();
  };

  JSW.run = function () {
    if (!runner || running) return;
    if (!entry) setEntry(PADRAO);
    const ed = editorEl();
    const codigo = ed ? ed.value : '';
    if (!codigo.trim()) { append('js-err', 'Escreva algo no editor antes de rodar.'); return; }
    salvar();                       // o programa vira arquivo no laboratório
    const name = baseName(entry);
    try {
      runner.putFiles(sessionId, { [name]: codigo });
      setRunning(true);
      runId = runner.run(sessionId, name);
    } catch (error) {
      append('js-err', 'Falha ao iniciar: ' + error.message);
      setRunning(false);
    }
  };

  JSW.cancel = function () {
    if (runner && runId) runner.cancel(runId);
  };

  JSW.clear = function () {
    const el = consoleEl();
    if (el) el.innerHTML = '';
  };

  LX.JSWorkspace = JSW;
})();
