/* Sandbox do runner JavaScript.

   Duas partes:
     · WORKER_SOURCE — o script, como STRING, que roda dentro do Worker. A mesma
       fonte é usada em produção (Blob -> Worker dentro de um iframe sandbox) e nos
       testes (executada em um contexto isolado do Node). Executar código do aluno
       aqui é seguro porque isto NÃO é o realm da aplicação: em produção é um Worker
       dentro de um iframe `sandbox="allow-scripts"` sem `allow-same-origin`, de
       origem opaca; no Node é um contexto `vm` sem acesso ao LX.
     · createBrowserTransport — monta essa fronteira no navegador e fala com o
       coordenador (39-js-runner.js) pelo contrato open/post/terminate.

   O código dentro de WORKER_SOURCE é propositalmente autocontido: ele não pode
   importar nada do LX (esse é justamente o ponto do isolamento). A inspeção de
   console é uma versão compacta da que existe no protocolo. */
'use strict';
(function () {
  const JS = (LX.JS = LX.JS || {});

  const WORKER_SOURCE = [
    "'use strict';",
    "(function () {",
    "  var post = (self && self.postMessage) ? self.postMessage.bind(self) : function () {};",
    "  var LIMITS = { OUTPUT_BYTES: 262144, STRING_LEN: 10000, INSPECT_DEPTH: 6, INSPECT_ITEMS: 100 };",
    "  var files = {};",
    "  var G = (typeof globalThis !== 'undefined') ? globalThis : self;",
    "  var nSetTimeout = (self && self.setTimeout) ? self.setTimeout.bind(self) : (typeof setTimeout !== 'undefined' ? setTimeout : null);",
    "  var nClearTimeout = (self && self.clearTimeout) ? self.clearTimeout.bind(self) : (typeof clearTimeout !== 'undefined' ? clearTimeout : null);",
    "  var nSetInterval = (self && self.setInterval) ? self.setInterval.bind(self) : (typeof setInterval !== 'undefined' ? setInterval : null);",
    "  var nClearInterval = (self && self.clearInterval) ? self.clearInterval.bind(self) : (typeof clearInterval !== 'undefined' ? clearInterval : null);",
    "  var nQueueMicro = (typeof queueMicrotask !== 'undefined') ? queueMicrotask : function (fn) { Promise.resolve().then(fn); };",
    "  // Estado do event loop da execução atual (uma execução por vez).",
    "  var curRun = null, curEntry = null, hadError = false, timersLeft = 0, timerIds = {}, intervalIds = {};",
    "  var PARAMS = 'console, self, postMessage, onmessage, globalThis, importScripts, close, setTimeout, setInterval, clearTimeout, clearInterval, queueMicrotask';",
    "  var PROLOGUE = '\"use strict\";\\n';",
    "  var OFFSET = null;",
    "  function wrapperOffset() {",
    "    if (OFFSET !== null) return OFFSET;",
    "    OFFSET = 0;",
    "    try { new Function(PARAMS, PROLOGUE + 'throw new Error(\"p\");\\n//# sourceURL=__lx_probe__')(); }",
    "    catch (e) { if (e && e.stack) { var m = String(e.stack).match(/__lx_probe__:(\\d+):/); if (m) OFFSET = Number(m[1]) - 1; } }",
    "    return OFFSET;",
    "  }",
    "  function byteLen(t) { try { return new TextEncoder().encode(t).length; } catch (e) { return t.length; } }",
    "  function clip(t) { return t.length > LIMITS.STRING_LEN ? t.slice(0, LIMITS.STRING_LEN) + '\\u2026 (truncado)' : t; }",
    "  function inspect(value) {",
    "    var seen = [];",
    "    function walk(node, depth) {",
    "      var type = typeof node;",
    "      if (node === null) return 'null';",
    "      if (type === 'undefined') return 'undefined';",
    "      if (type === 'string') return depth === 0 ? clip(node) : JSON.stringify(clip(node));",
    "      if (type === 'number' || type === 'boolean') return String(node);",
    "      if (type === 'bigint') return String(node) + 'n';",
    "      if (type === 'symbol') return node.toString();",
    "      if (type === 'function') return '[Function: ' + (node.name || 'anonima') + ']';",
    "      if (node instanceof Error) return node.name + ': ' + clip(String(node.message));",
    "      if (depth >= LIMITS.INSPECT_DEPTH) return Array.isArray(node) ? '[Array]' : '[Object]';",
    "      if (seen.indexOf(node) !== -1) return '[Circular]';",
    "      seen.push(node);",
    "      try {",
    "        if (Array.isArray(node)) {",
    "          var parts = [];",
    "          for (var i = 0; i < node.length && i < LIMITS.INSPECT_ITEMS; i++) parts.push(walk(node[i], depth + 1));",
    "          if (node.length > LIMITS.INSPECT_ITEMS) parts.push('\\u2026 +' + (node.length - LIMITS.INSPECT_ITEMS) + ' itens');",
    "          return '[' + parts.join(', ') + ']';",
    "        }",
    "        var keys = Object.keys(node), out = [];",
    "        for (var k = 0; k < keys.length && k < LIMITS.INSPECT_ITEMS; k++) {",
    "          var label = /^[A-Za-z_$][\\w$]*$/.test(keys[k]) ? keys[k] : JSON.stringify(keys[k]);",
    "          out.push(label + ': ' + walk(node[keys[k]], depth + 1));",
    "        }",
    "        if (keys.length > LIMITS.INSPECT_ITEMS) out.push('\\u2026 +' + (keys.length - LIMITS.INSPECT_ITEMS) + ' chaves');",
    "        var ctor = node.constructor && node.constructor.name;",
    "        var prefix = ctor && ctor !== 'Object' ? ctor + ' ' : '';",
    "        return prefix + '{' + out.join(', ') + '}';",
    "      } finally { seen.pop(); }",
    "    }",
    "    try { return walk(value, 0); } catch (e) { return '[valor nao inspecionavel]'; }",
    "  }",
    "  function formatArgs(args) {",
    "    var parts = [];",
    "    for (var i = 0; i < args.length; i++) parts.push(inspect(args[i]));",
    "    return parts.join(' ');",
    "  }",
    "  function makeConsole(runId, state) {",
    "    function sink(level) {",
    "      return function () {",
    "        if (state.stopped) return;",
    "        var text = formatArgs(Array.prototype.slice.call(arguments));",
    "        state.bytes += byteLen(text);",
    "        if (state.bytes > LIMITS.OUTPUT_BYTES) { state.stopped = true; post({ type: 'output-limit', runId: runId, kind: 'console' }); return; }",
    "        post({ type: 'console', runId: runId, level: level, text: text });",
    "      };",
    "    }",
    "    return { log: sink('log'), info: sink('info'), warn: sink('warn'), error: sink('error'), debug: sink('debug') };",
    "  }",
    "  function locate(error, entry) {",
    "    var info = { name: 'Error', message: String(error), stack: null, line: null, column: null, file: entry };",
    "    if (error && typeof error === 'object') {",
    "      info.name = String(error.name || 'Error');",
    "      info.message = String(error.message == null ? error : error.message);",
    "      if (error.stack) info.stack = String(error.stack);",
    "      if (typeof error.lineNumber === 'number') info.line = error.lineNumber - wrapperOffset();",
    "      if (typeof error.columnNumber === 'number') info.column = error.columnNumber;",
    "    }",
    "    if ((info.line == null) && info.stack) {",
    "      var re = new RegExp(entry.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ':(\\\\d+):(\\\\d+)');",
    "      var m = info.stack.match(re);",
    "      if (m) { info.line = Number(m[1]) - wrapperOffset(); info.column = Number(m[2]); }",
    "    }",
    "    if (info.line != null && !(info.line > 0)) info.line = null;",
    "    return info;",
    "  }",
    "  function reportError(err) { hadError = true; if (curRun) post({ type: 'uncaught-error', runId: curRun, error: locate(err, curEntry) }); }",
    "  function wrapTimeout(fn, ms) {",
    "    if (typeof fn !== 'function' || !nSetTimeout) return nSetTimeout ? nSetTimeout(fn, ms) : 0;",
    "    var extra = Array.prototype.slice.call(arguments, 2);",
    "    timersLeft++;",
    "    var id = nSetTimeout(function () { if (timerIds[id]) { delete timerIds[id]; timersLeft--; } try { fn.apply(undefined, extra); } catch (e) { reportError(e); } }, ms);",
    "    timerIds[id] = true; return id;",
    "  }",
    "  function wrapClearTimeout(id) { if (timerIds[id]) { delete timerIds[id]; timersLeft--; } if (nClearTimeout) nClearTimeout(id); }",
    "  function wrapInterval(fn, ms) {",
    "    if (typeof fn !== 'function' || !nSetInterval) return nSetInterval ? nSetInterval(fn, ms) : 0;",
    "    var extra = Array.prototype.slice.call(arguments, 2);",
    "    timersLeft++;",
    "    var id = nSetInterval(function () { try { fn.apply(undefined, extra); } catch (e) { reportError(e); } }, ms);",
    "    intervalIds[id] = true; return id;",
    "  }",
    "  function wrapClearInterval(id) { if (intervalIds[id]) { delete intervalIds[id]; timersLeft--; if (nClearInterval) nClearInterval(id); } }",
    "  // Espera o event loop esvaziar: microtasks drenam entre macrotasks, então",
    "  // dois giros seguidos sem timers pendentes significam ocioso. O tempo limite",
    "  // do coordenador encerra o Worker se isto nunca terminar.",
    "  function drainUntilIdle() {",
    "    return new Promise(function (resolve) {",
    "      if (!nSetTimeout) { resolve(); return; }",
    "      var quiet = 0;",
    "      (function tick() {",
    "        if (timersLeft > 0) { quiet = 0; nSetTimeout(tick, 0); return; }",
    "        quiet++;",
    "        if (quiet >= 2) resolve(); else nSetTimeout(tick, 0);",
    "      })();",
    "    });",
    "  }",
    "  function runFile(runId, entry) {",
    "    if (!Object.prototype.hasOwnProperty.call(files, entry)) {",
    "      post({ type: 'uncaught-error', runId: runId, error: { name: 'ResolutionError', message: 'Arquivo nao encontrado: ' + entry, file: entry } });",
    "      post({ type: 'run-complete', runId: runId, ok: false });",
    "      return;",
    "    }",
    "    var state = { bytes: 0, stopped: false };",
    "    var sandboxConsole = makeConsole(runId, state);",
    "    var source = String(files[entry]) + '\\n//# sourceURL=' + entry;",
    "    var factory;",
    "    try { factory = new Function(PARAMS, PROLOGUE + source); }",
    "    catch (syntaxError) {",
    "      post({ type: 'uncaught-error', runId: runId, error: locate(syntaxError, entry) });",
    "      post({ type: 'run-complete', runId: runId, ok: false });",
    "      return;",
    "    }",
    "    curRun = runId; curEntry = entry; hadError = false; timersLeft = 0; timerIds = {}; intervalIds = {};",
    "    var done = false;",
    "    function finish() { if (done) return; done = true; var run = curRun; curRun = null; curEntry = null; post({ type: 'run-complete', runId: run || runId, ok: !hadError }); }",
    "    Promise.resolve().then(function () {",
    "      return factory(sandboxConsole, undefined, undefined, undefined, undefined, undefined, undefined, wrapTimeout, wrapInterval, wrapClearTimeout, wrapClearInterval, nQueueMicro);",
    "    }).then(function () { return drainUntilIdle(); }, function (err) { reportError(err); return drainUntilIdle(); })",
    "      .then(function () { finish(); }, function () { finish(); });",
    "  }",
    "  function handle(msg) {",
    "    if (!msg || typeof msg !== 'object') return;",
    "    if (msg.type === 'init') { if (msg.limits && typeof msg.limits === 'object') { for (var k in LIMITS) if (typeof msg.limits[k] === 'number') LIMITS[k] = msg.limits[k]; } return; }",
    "    if (msg.type === 'run') { files = (msg.files && typeof msg.files === 'object') ? msg.files : {}; runFile(String(msg.runId), String(msg.entrypoint)); return; }",
    "    if (msg.type === 'dispose') { if (self.close) self.close(); return; }",
    "  }",
    "  if (self.addEventListener) self.addEventListener('message', function (ev) { handle(ev.data); });",
    "  else self.onmessage = function (ev) { handle(ev.data); };",
    "  if (self.addEventListener) self.addEventListener('unhandledrejection', function (ev) {",
    "    if (!curRun) return;",
    "    hadError = true;",
    "    post({ type: 'unhandled-rejection', runId: curRun, reason: locate(ev && ev.reason, curEntry) });",
    "    if (ev && ev.preventDefault) ev.preventDefault();",
    "  });",
    "  post({ type: 'ready' });",
    "})();"
  ].join('\n');

  /* HTML do iframe isolado. Origem opaca (sandbox sem allow-same-origin), CSP que
     só permite workers do próprio documento e nenhuma conexão de rede. O bootstrap
     cria o Worker a partir do Blob de WORKER_SOURCE e faz a ponte entre a janela
     pai e o Worker. */
  function iframeHtml() {
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      // 'unsafe-eval' é intencional e SÓ existe aqui, dentro da origem opaca do
      // iframe/Worker: é assim que o Worker compila o código do aluno (new
      // Function). Isso nunca alcança o realm principal do app. connect-src 'none'
      // mantém a rede negada; worker-src blob: permite o Worker descartável.
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' blob:; worker-src blob:; connect-src \'none\'">',
      '</head><body><script>',
      '(function(){',
      '  var src = ', JSON.stringify(WORKER_SOURCE), ';',
      '  var worker = null;',
      '  function boot(){',
      '    var blob = new Blob([src], { type: "text/javascript" });',
      '    worker = new Worker(URL.createObjectURL(blob));',
      '    worker.onmessage = function(ev){ parent.postMessage({ __sandbox: true, data: ev.data }, "*"); };',
      '  }',
      '  window.addEventListener("message", function(ev){',
      '    var msg = ev.data;',
      '    if (!msg || !msg.__sandbox) return;',
      '    if (msg.command === "post" && worker) worker.postMessage(msg.data);',
      '  });',
      '  boot();',
      '  parent.postMessage({ __sandbox: true, data: { type: "iframe-ready" } }, "*");',
      '})();',
      '<\/script></body></html>'
    ].join('');
  }

  /* Transport de navegador. Só toca em document/Worker quando chamado, então o
     carregamento no Node (sem DOM) é seguro. Cada sessão ganha seu próprio iframe;
     terminate() remove o iframe e, com ele, o Worker. */
  function createBrowserTransport(config) {
    if (typeof document === 'undefined' || typeof Worker === 'undefined') {
      throw new Error('createBrowserTransport exige um navegador com Worker.');
    }
    config = config || {};
    const host = config.host || document.body;

    function open(sessionId, onMessage) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.display = 'none';
      iframe.srcdoc = iframeHtml();
      const queue = [];
      let ready = false;

      function onWindowMessage(ev) {
        if (ev.source !== iframe.contentWindow) return;
        const msg = ev.data;
        if (!msg || !msg.__sandbox) return;
        if (msg.data && msg.data.type === 'iframe-ready') {
          ready = true;
          while (queue.length) iframe.contentWindow.postMessage({ __sandbox: true, command: 'post', data: queue.shift() }, '*');
          return;
        }
        try { onMessage(msg.data); } catch (_) { /* assinante quebrado não derruba o transport */ }
      }
      window.addEventListener('message', onWindowMessage);
      host.appendChild(iframe);

      return {
        post(command) {
          if (!ready) { queue.push(command); return; }
          iframe.contentWindow.postMessage({ __sandbox: true, command: 'post', data: command }, '*');
        },
        terminate() {
          window.removeEventListener('message', onWindowMessage);
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }
      };
    }
    return { open };
  }

  JS.Sandbox = { WORKER_SOURCE, iframeHtml, createBrowserTransport };
})();
