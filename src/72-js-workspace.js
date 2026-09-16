/* =========================================================================
   TERMINALIS — controlador do playground JavaScript (Fase 1)

   Liga a interface ao runner isolado (LX.JS). Lê o arquivo do VFS, executa na
   sandbox de navegador (iframe + Worker) e renderiza os eventos estruturados no
   painel "JS". Não acessa o domínio do runner nem executa código do aluno aqui:
   apenas orquestra e desenha. Carregar este módulo no Node é seguro — nada toca
   em document/Worker no nível de módulo; a sandbox só é criada sob demanda.
   ========================================================================= */
'use strict';
(function () {
  const { query: $ } = LX.Util;
  const JSW = {};
  let app = null;
  let runner = null;
  let sessionId = null;
  let entry = null;
  let runId = null;
  let running = false;
  let bound = false;

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
  }

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
    let text = 'em ' + payload.file;
    if (payload.line != null) text += ':' + payload.line + (payload.column != null ? ':' + payload.column : '');
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

  JSW.setEntry = function (path) {
    entry = path || null;
    const el = $('#js-entry');
    if (el) el.textContent = entry || 'nenhum arquivo';
  };

  JSW.onShow = function (a) {
    ensure(a);
    const el = consoleEl();
    if (el && !el.children.length && !entry) {
      append('js-sys', 'Abra um arquivo .js em Arquivos e clique em rodar.');
    }
  };

  JSW.openAndRun = function (a, path) {
    ensure(a);
    JSW.setEntry(path);
    if (app && typeof app.switchTab === 'function') app.switchTab('js');
    JSW.run();
  };

  JSW.run = function () {
    if (!runner || running) return;
    if (!entry) { append('js-err', 'Nenhum arquivo selecionado.'); return; }
    const sh = app.term.sh;
    let content;
    try { content = sh.m.fs.readFile(entry, sh.fsopts()); }
    catch (error) { append('js-err', 'Não foi possível ler ' + entry + ': ' + error.message); return; }
    const name = baseName(entry);
    try {
      runner.putFiles(sessionId, { [name]: content });
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
