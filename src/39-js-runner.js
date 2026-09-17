/* Coordenador do runner JavaScript/TypeScript.

   Domínio puro: não acessa DOM, não usa eval/new Function e não conhece a
   implementação da sandbox. Conversa com a fronteira isolada apenas por um
   `transport` injetado, o que permite:
     · em produção, dirigir um iframe sandbox + Worker descartável;
     · em teste, dirigir a mesma fonte de Worker dentro de um contexto isolado.

   Contrato do transport:
     transport.open(sessionId, onMessage) -> handle
     handle.post(command)   // envia um comando validado para dentro da sandbox
     handle.terminate()     // encerra a sandbox (equivale a Worker.terminate)
   `onMessage(raw)` é chamado pelo transport quando a sandbox emite algo; o
   coordenador traduz essa mensagem crua em um evento estruturado e a repassa aos
   assinantes já sanitizada. */
'use strict';
(function () {
  const JS = (LX.JS = LX.JS || {});
  const P = JS.Protocol;

  function createRunner(options) {
    options = options || {};
    const transport = options.transport;
    if (!transport || typeof transport.open !== 'function') {
      throw new Error('createRunner exige um transport com open().');
    }
    const limits = Object.assign({}, P.LIMITS, options.limits || {});
    const now = options.now || (() => (typeof Date !== 'undefined' ? Date.now() : 0));
    const schedule = options.schedule || ((fn, ms) => setTimeout(fn, ms));
    const cancelSchedule = options.cancelSchedule || (token => clearTimeout(token));

    const sessions = new Map();
    const listeners = new Set();
    let seq = 0;

    function emit(type, session, runId, payload) {
      let event;
      try {
        event = P.makeEvent(type, { sessionId: session.id, runId: runId, seq: seq++, at: now() }, payload);
      } catch (error) {
        // Um payload impossível de sanitizar nunca deve derrubar o coordenador.
        event = P.makeEvent(EVENTS_SAFE(type), { sessionId: session.id, runId: runId, seq: seq++, at: now() },
          { message: 'Evento descartado: ' + error.message });
      }
      for (const listener of listeners) {
        try { listener(event); } catch (_) { /* um assinante quebrado não afeta os demais */ }
      }
    }
    function EVENTS_SAFE(type) {
      return Object.values(P.EVENTS).includes(type) ? type : P.EVENTS.DIAGNOSTIC;
    }

    function openHandle(session) {
      session.handle = transport.open(session.id, raw => onSandboxMessage(session, raw));
      try { session.handle.post({ type: P.COMMANDS.INIT, limits: limits }); }
      catch (_) { /* INIT é best-effort; RUN reenvia tudo o que a sandbox precisa */ }
    }

    function requireSession(sessionId) {
      const session = sessions.get(String(sessionId));
      if (!session) throw new Error('Sessão inválida ou já descartada.');
      return session;
    }

    function finishRun(session, type, payload, runId) {
      const run = session.run;
      const id = runId || (run && run.runId);
      if (run && run.timer != null) { cancelSchedule(run.timer); run.timer = null; }
      session.run = null;
      if (type) emit(type, session, id, payload || {});
    }

    /* Traduz uma mensagem crua da sandbox no evento correspondente. Só o runId
       ativo é aceito: mensagens de uma execução já encerrada são ignoradas. */
    function onSandboxMessage(session, raw) {
      if (!raw || typeof raw !== 'object') return;
      const run = session.run;
      const type = raw.type;

      if (type === 'ready') { emit(P.EVENTS.LIFECYCLE, session, null, { state: 'ready' }); return; }
      if (!run || (raw.runId != null && String(raw.runId) !== run.runId)) return;

      switch (type) {
        case P.EVENTS.CONSOLE: {
          const text = String(raw.text == null ? '' : raw.text);
          const level = P.CONSOLE_LEVELS.includes(raw.level) ? raw.level : 'log';
          run.output += P.byteLength(text);
          if (run.output > limits.OUTPUT_BYTES) {
            if (!run.limited) { run.limited = true; emit(P.EVENTS.OUTPUT_LIMIT, session, run.runId, { kind: 'console' }); }
            return;
          }
          emit(P.EVENTS.CONSOLE, session, run.runId, { level, text });
          return;
        }
        case P.EVENTS.OUTPUT_LIMIT:
          if (!run.limited) { run.limited = true; emit(P.EVENTS.OUTPUT_LIMIT, session, run.runId, { kind: String(raw.kind || 'console') }); }
          return;
        case P.EVENTS.UNCAUGHT_ERROR:
          emit(P.EVENTS.UNCAUGHT_ERROR, session, run.runId, safeError(raw.error));
          return;
        case P.EVENTS.UNHANDLED_REJECTION:
          emit(P.EVENTS.UNHANDLED_REJECTION, session, run.runId, safeError(raw.reason));
          return;
        case P.EVENTS.DIAGNOSTIC:
          emit(P.EVENTS.DIAGNOSTIC, session, run.runId, plain(raw.payload));
          return;
        case P.EVENTS.MODULE_LOADED:
          emit(P.EVENTS.MODULE_LOADED, session, run.runId, { path: String(raw.path == null ? '' : raw.path) });
          return;
        case P.EVENTS.TEST_START:
          emit(P.EVENTS.TEST_START, session, run.runId, { name: String(raw.name == null ? '' : raw.name) });
          return;
        case P.EVENTS.TEST_RESULT:
          emit(P.EVENTS.TEST_RESULT, session, run.runId, {
            name: String(raw.name == null ? '' : raw.name),
            ok: raw.ok === true,
            message: raw.message != null ? String(raw.message).slice(0, limits.STRING_LEN) : null,
            durationMs: Number.isFinite(raw.durationMs) ? raw.durationMs : null
          });
          return;
        case P.EVENTS.RUN_COMPLETE:
          finishRun(session, P.EVENTS.RUN_COMPLETE, { ok: raw.ok !== false }, run.runId);
          return;
        default:
          // Tipos ainda não suportados (test-result, module-loaded) chegam nas
          // fases seguintes; por ora são ignorados em silêncio controlado.
          return;
      }
    }

    function safeError(error) {
      error = error || {};
      const out = {
        name: String(error.name || 'Error'),
        message: String(error.message == null ? '' : error.message).slice(0, limits.STRING_LEN),
        stack: error.stack != null ? String(error.stack).slice(0, limits.STRING_LEN) : null,
        line: Number.isFinite(error.line) ? error.line : null,
        column: Number.isFinite(error.column) ? error.column : null,
        file: error.file != null ? String(error.file).slice(0, limits.MAX_PATH_LEN) : null
      };
      return out;
    }
    function plain(value) {
      try { return P.assertSerializable(value == null ? {} : value); }
      catch (_) { return { note: 'payload não serializável descartado' }; }
    }

    function validateFiles(files) {
      if (!files || typeof files !== 'object' || Array.isArray(files)) {
        throw new Error('files deve ser um objeto { caminho: conteúdo }.');
      }
      P.assertNoPollution(files);
      const names = Object.keys(files);
      if (names.length > limits.MAX_FILES) throw new Error('Excesso de arquivos na sessão (máximo ' + limits.MAX_FILES + ').');
      const clean = {};
      for (const name of names) {
        if (typeof name !== 'string' || !name || name.length > limits.MAX_PATH_LEN) throw new Error('Caminho de arquivo inválido.');
        const content = files[name];
        if (typeof content !== 'string') throw new Error('Conteúdo de arquivo deve ser texto: ' + name + '.');
        if (P.byteLength(content) > limits.MAX_FILE_BYTES) throw new Error('Arquivo excede o tamanho máximo: ' + name + '.');
        clean[name] = content;
      }
      return clean;
    }

    /* -------------------------------- API pública -------------------------------- */

    function createSession(sessionOptions) {
      sessionOptions = sessionOptions || {};
      const id = P.newId('sess');
      const session = { id, files: {}, handle: null, run: null };
      sessions.set(id, session);
      openHandle(session);
      if (sessionOptions.files) session.files = validateFiles(sessionOptions.files);
      emit(P.EVENTS.LIFECYCLE, session, null, { state: 'created' });
      return id;
    }

    function putFiles(sessionId, files) {
      const session = requireSession(sessionId);
      const clean = validateFiles(files);
      Object.assign(session.files, clean);
      return Object.keys(session.files).length;
    }

    function run(sessionId, entrypoint, runOptions) {
      const session = requireSession(sessionId);
      runOptions = runOptions || {};
      if (typeof entrypoint !== 'string' || !Object.prototype.hasOwnProperty.call(session.files, entrypoint)) {
        throw new Error('Arquivo de entrada inexistente na sessão: ' + entrypoint + '.');
      }
      if (session.run) throw new Error('A sessão já tem uma execução ativa. Cancele ou aguarde.');
      if (!session.handle) openHandle(session);
      const runId = P.newId('run');
      const timeout = Number.isFinite(runOptions.timeoutMs) ? runOptions.timeoutMs : limits.RUN_TIMEOUT_MS;
      const runState = { runId, output: 0, limited: false, timer: null };
      session.run = runState;
      emit(P.EVENTS.RUN_START, session, runId, { entrypoint, mode: 'run' });
      runState.timer = schedule(() => onTimeout(session, runId), timeout);
      try {
        // Os arquivos já foram validados (chaves e tamanho) em putFiles; o
        // comando RUN é uma transferência em bloco, então não passa pelo teto de
        // MESSAGE_BYTES do validateCommand, que vale para mensagens avulsas.
        session.handle.post({ type: P.COMMANDS.RUN, runId, entrypoint, files: session.files });
      } catch (error) {
        finishRun(session, P.EVENTS.UNCAUGHT_ERROR, safeError({ name: 'RunnerError', message: error.message }), runId);
      }
      return runId;
    }

    function runTests(sessionId, entrypoint, runOptions) {
      // O test runner (describe/it/expect) roda como parte de uma execução normal:
      // basta o arquivo registrar testes. Este atalho deixa a intenção explícita.
      return run(sessionId, entrypoint, Object.assign({ mode: 'test' }, runOptions || {}));
    }

    function onTimeout(session, runId) {
      if (!session.run || session.run.runId !== runId) return;
      // Um laço infinito só termina encerrando a sandbox; reabrimos em seguida.
      hardReset(session);
      finishRun(session, P.EVENTS.RUN_TIMEOUT, { timeoutMs: limits.RUN_TIMEOUT_MS }, runId);
    }

    function hardReset(session) {
      try { if (session.handle) session.handle.terminate(); } catch (_) { /* já pode estar morto */ }
      openHandle(session);
    }

    function cancel(runId) {
      for (const session of sessions.values()) {
        if (session.run && session.run.runId === String(runId)) {
          hardReset(session);
          finishRun(session, P.EVENTS.RUN_CANCELLED, { reason: 'cancelado' }, session.run.runId);
          return true;
        }
      }
      return false;
    }

    function resetSession(sessionId) {
      const session = requireSession(sessionId);
      finishRun(session, null, null, null);
      hardReset(session);
      emit(P.EVENTS.LIFECYCLE, session, null, { state: 'reset' });
    }

    function dispose(sessionId) {
      const session = sessions.get(String(sessionId));
      if (!session) return false;
      if (session.run && session.run.timer != null) cancelSchedule(session.run.timer);
      try { if (session.handle) session.handle.terminate(); } catch (_) { /* ignora */ }
      sessions.delete(session.id);
      return true;
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') throw new Error('subscribe exige uma função.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function disposeAll() {
      for (const id of Array.from(sessions.keys())) dispose(id);
    }

    return {
      createSession, putFiles, run, runTests, cancel,
      resetSession, dispose, disposeAll, subscribe,
      get sessionCount() { return sessions.size; }
    };
  }

  JS.createRunner = createRunner;
})();
