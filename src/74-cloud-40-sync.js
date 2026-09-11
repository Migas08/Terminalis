/* =========================================================================
   TERMINALIS — LX.Sync: sincronização automática do laboratório
   ---------------------------------------------------------------------
   Liga a máquina virtual (VFS, shell, Git, Docker) à nuvem sem que o aluno
   precise apertar "salvar" nem dar `git commit`. O ciclo é:

       alteração  ->  marca "sujo"  ->  debounce  ->  snapshot
                  ->  cache local   ->  envia à nuvem (com revisão)

   Responsabilidades:
     · detectar alterações de estado de forma CENTRALIZADA (todo comando do
       terminal marca o workspace como sujo — cobre criar arquivo, git add,
       mkdir, chmod, commit, docker, etc. sem interceptar comando a comando);
     · exportar o estado com LX.Workspace.exportState (nunca JSON.stringify da
       máquina viva);
     · gravar localmente sempre (offline-first) e na nuvem quando houver rede;
     · proteger contra conflito entre dispositivos por revisão (optimistic
       locking): nunca sobrescreve em silêncio um estado mais novo;
     · restaurar o ambiente ao entrar em outro computador;
     · migrar dados locais existentes na primeira entrada em nuvem;
     · refletir o estado no indicador discreto da barra do terminal.

   O módulo é defensivo: funciona sem DOM e sem `window` (para os testes em
   Node), e degrada para "só cache local" quando não há nuvem.
   ========================================================================= */
'use strict';
(function () {
  const temWindow = typeof window !== 'undefined';
  const temDoc = typeof document !== 'undefined';
  const CACHE_WS = 'terminalis.cache.workspace/';
  const CACHE_PROG = 'terminalis.cache.progresso/';
  const BACKUP_WS = 'terminalis.backup.workspace/';
  const MIGRADO = 'terminalis.migrado/';

  const Sync = {
    app: null,
    _revisao: 0,          // última revisão conhecida do workspace na nuvem
    _sujo: false,
    _pendente: false,     // há algo à espera de rede
    _flushing: false,
    _reflush: false,
    _pausado: false,          // conflito pendente: só o aluno pode retomar
    _conflito: null,
    _timer: null,
    _timerProg: null,
    _estado: 'local',

    /* --------------------------- ciclo de vida --------------------------- */
    iniciar(app) {
      this.app = app || this.app;
      if (temWindow && !this._ligado) {
        window.addEventListener('online', () => this._voltouOnline());
        window.addEventListener('offline', () => this.status('offline'));
        window.addEventListener('beforeunload', () => { try { this._cacheProgresso(); } catch (e) { } });
        this._ligado = true;
      }
      this.status(this._temNuvem() ? 'salvo' : 'local');
      return this;
    },

    _temNuvem() {
      return !!(LX.Auth && LX.Auth.usuario) && (Store().modo === 'supabase' || Store().modo === 'nuvem');
    },
    _offline() { return temWindow && 'onLine' in navigator && navigator.onLine === false; },
    _uid() { return LX.Auth && LX.Auth.usuario ? LX.Auth.usuario.uid : null; },

    /* --------------------------- marcar alteração --------------------------- */
    /* dominio: 'workspace' (laboratório) ou 'progresso' (aulas/notas). */
    marcarSujo(dominio) {
      if (!this._uid()) return;
      if (dominio === 'progresso') {
        this._cacheProgresso();
        return; // o progresso é gravado pelo LX.Auth (debounce próprio); aqui só cacheamos
      }
      this._sujo = true;
      this._cacheWorkspace();          // cache local imediato (offline-first)
      const ms = (LX.Config.sync && LX.Config.sync.workspaceDebounceMs) || 1500;
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => { this._timer = null; this.flushWorkspace(); }, ms);
    },

    /* --------------------------- exportar snapshot --------------------------- */
    exportarSnapshot() {
      if (!this.app || !this.app.machine) return null;
      return LX.Workspace.exportState(this.app.machine, this.app.term || null,
        { trilhaId: this.app.trilhaId || null });
    },

    _docLocal() {
      let raw = null;
      try { raw = localStorage.getItem(CACHE_WS + this._uid()); } catch (e) { }
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },
    _cacheWorkspace() {
      try {
        const snap = this.exportarSnapshot();
        if (!snap) return;
        localStorage.setItem(CACHE_WS + this._uid(), JSON.stringify(
          { version: snap.version, revision: this._revisao, updatedAt: Date.now(), snapshot: snap }));
      } catch (e) { /* cota cheia ou snapshot inválido: ignora o cache */ }
    },
    _cacheProgresso() {
      try {
        if (LX.Progress && LX.Progress.data)
          localStorage.setItem(CACHE_PROG + this._uid(), JSON.stringify(LX.Progress.data));
      } catch (e) { }
    },

    /* ------------------------------ enviar ------------------------------ */
    async flushWorkspace() {
      const uid = this._uid();
      if (!uid || !this.app || !this.app.machine) return;
      if (this._pausado) return;
      if (!this._temNuvem()) { this._sujo = false; this.status('local'); return; }
      if (this._flushing) { this._reflush = true; return; }
      this._flushing = true;
      this.status('salvando');
      try {
        const snap = this.exportarSnapshot();
        if (!snap) { this.status('salvo'); return; }
        const doc = { version: snap.version, snapshot: snap, device: LX.Config.dispositivoId(), baseRevision: this._revisao };
        this._cacheWorkspace();          // offline-first: garante uma cópia local antes da rede
        if (this._offline()) { this._pendente = true; this.status('offline'); return; }
        const r = await LX.Storage.saveWorkspace(uid, doc);
        if (r.ok) { this._revisao = r.revision; this._pendente = false; this._sujo = false; this.status('salvo'); }
        else if (r.conflito) { this._resolverConflito(r.atual); }
        else { this._pendente = true; this.status('erro'); }
      } catch (e) {
        this._pendente = true; this.status('erro');
        if (typeof console !== 'undefined') console.warn('Sync workspace falhou:', e);
      } finally {
        this._flushing = false;
        if (this._reflush) { this._reflush = false; this.marcarSujo('workspace'); }
      }
    },

    /* Grava agora, sem esperar o debounce (logout, troca de conta). */
    async capturarAgora() {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      this._cacheProgresso();
      if (this._sujo || this._pendente) await this.flushWorkspace();
    },

    /* --------------------------- conflito entre dispositivos ---------------------------
       Estratégia v1 ("latest version + revision"): quem chega com a revisão
       velha NÃO sobrescreve a mais nova. Guardamos o estado local num backup
       (nada é perdido em silêncio), adotamos a revisão da nuvem como base e
       avisamos o aluno. Assim, nem o remoto mais novo é destruído, nem o
       trabalho local desaparece sem aviso. */
    _resolverConflito(atual) {
      this._revisao = (atual && atual.revision) || this._revisao;
      let localSnapshot = null;
      try {
        const snap = this.exportarSnapshot();
        localSnapshot = snap;
        if (snap) localStorage.setItem(BACKUP_WS + this._uid() + '.' + Date.now(),
          JSON.stringify({ version: snap.version, updatedAt: Date.now(), snapshot: snap }));
      } catch (e) { }
      this._conflito = { atual: atual || null, localSnapshot };
      this._pausado = true;
      this._pendente = false; this._sujo = false;
      this.status('erro');
      this._mostrarConflito();
    },

    /* O remoto nunca é aplicado e o local nunca é reenviado automaticamente:
       o aluno precisa escolher explicitamente um dos dois ambientes. */
    _mostrarConflito() {
      if (!temDoc || !this._conflito) return;
      let el = document.getElementById('sync-conflict');
      if (!el) {
        el = document.createElement('div');
        el.id = 'sync-conflict';
        el.innerHTML = '<div class="sc-card" role="dialog" aria-modal="true" aria-labelledby="sc-title">' +
          '<div class="sc-kicker">sincronização pausada</div>' +
          '<h2 id="sc-title">Este ambiente mudou em outro dispositivo</h2>' +
          '<p>Escolha qual versão deve continuar. Sua versão local já foi guardada em um backup neste navegador.</p>' +
          '<div class="sc-actions"><button type="button" data-sc="remoto">Usar ambiente remoto</button>' +
          '<button type="button" data-sc="local">Manter meu ambiente local</button></div></div>';
        document.body.appendChild(el);
        el.querySelectorAll('[data-sc]').forEach(btn => {
          btn.addEventListener('click', () => this.resolverConflitoEscolha(btn.dataset.sc));
        });
      }
      el.classList.add('on');
      const first = el.querySelector('[data-sc]');
      if (first) first.focus();
    },

    async resolverConflitoEscolha(escolha) {
      const conflito = this._conflito;
      if (!conflito || (escolha !== 'local' && escolha !== 'remoto')) return false;
      const uid = this._uid();
      this._conflito = null;
      this._pausado = false;
      const el = temDoc && document.getElementById('sync-conflict');
      if (el) el.classList.remove('on');
      if (escolha === 'remoto') {
        try {
          if (conflito.atual && conflito.atual.snapshot && this.app && this.app.aplicarWorkspaceRestaurado) {
            this.app.aplicarWorkspaceRestaurado(LX.Workspace.importState(conflito.atual.snapshot));
          }
          this._revisao = Number(conflito.atual && conflito.atual.revision || this._revisao);
          this._sujo = false; this._pendente = false; this.status('salvo');
          return true;
        } catch (e) {
          this.status('erro');
          return false;
        }
      }
      /* Reaplica o snapshot local que o aluno escolheu, agora sobre a revisão
         remota mais nova. O controle otimista continua protegendo a gravação. */
      this._revisao = Number(conflito.atual && conflito.atual.revision || this._revisao);
      this._sujo = true;
      if (uid) await this.flushWorkspace();
      return !this._sujo && !this._pendente;
    },

    /* ------------------------------ restaurar ------------------------------
       Chamado ao entrar (inclusive de outro computador). Lê o snapshot mais
       recente, valida a versão e reconstrói o laboratório. */
    async restaurar(uid) {
      uid = uid || this._uid();
      if (!uid) return false;
      this.status('restaurando');
      let doc = null;
      try { doc = await LX.Storage.getWorkspace(uid); } catch (e) { doc = null; }
      /* Sem nuvem ou sem snapshot na nuvem: tenta o cache local desta máquina. */
      if (!doc || !doc.snapshot) doc = this._melhorLocal(uid, doc);
      if (!doc || !doc.snapshot) { this._revisao = doc ? (doc.revision || 0) : 0; this.status(this._temNuvem() ? 'salvo' : 'local'); return false; }
      try {
        const restaurado = LX.Workspace.importState(doc.snapshot);
        this._revisao = doc.revision || 0;
        if (this.app && this.app.aplicarWorkspaceRestaurado) this.app.aplicarWorkspaceRestaurado(restaurado);
        this.status(this._temNuvem() ? 'salvo' : 'local');
        return true;
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('Restauração falhou:', e);
        this.status(this._temNuvem() ? 'salvo' : 'local');
        return false;
      }
    },

    /* Escolhe entre o doc da nuvem e o cache local o mais recente. */
    _melhorLocal(uid, docNuvem) {
      const local = (() => { try { const r = localStorage.getItem(CACHE_WS + uid); return r ? JSON.parse(r) : null; } catch (e) { return null; } })();
      if (!local || !local.snapshot) return docNuvem || null;
      if (!docNuvem || !docNuvem.snapshot) return local;
      return (local.updatedAt || 0) > (docNuvem.updatedAt || 0) ? local : docNuvem;
    },

    /* ------------------------------ migração ------------------------------
       Primeira entrada em nuvem: se a conta ainda não tem progresso/ambiente
       salvos, aproveita o que já existia neste navegador (modo local). */
    async migrarLocais(uid) {
      uid = uid || this._uid();
      if (!uid) return false;
      let jaFez = false;
      try { jaFez = !!localStorage.getItem(MIGRADO + uid); } catch (e) { }
      if (jaFez) return false;

      let migrou = false;
      /* Progresso: só migra se a nuvem estiver vazia e houver progresso local. */
      try {
        const nuvem = await LX.Storage.getProgress(uid);
        const temNuvem = nuvem && Object.keys(nuvem.lessons || {}).length;
        if (!temNuvem) {
          const localProg = this._melhorProgressoLocal();
          if (localProg && Object.keys(localProg.lessons || {}).length) {
            await LX.Storage.saveProgress(uid, localProg);
            if (LX.Auth) LX.Auth.progresso = localProg;
            if (LX.Progress) LX.Progress.replace(localProg);
            migrou = true;
          }
        }
      } catch (e) { }

      /* Workspace: idem, migra o cache local se a nuvem não tiver nada. */
      try {
        const wsNuvem = await LX.Storage.getWorkspace(uid);
        if (!wsNuvem || !wsNuvem.snapshot) {
          const local = this._docLocal();
          if (local && local.snapshot) {
            const r = await LX.Storage.saveWorkspace(uid, { version: local.version, snapshot: local.snapshot, device: LX.Config.dispositivoId(), baseRevision: 0 });
            if (r.ok) { this._revisao = r.revision; migrou = true; }
          }
        }
      } catch (e) { }

      try { localStorage.setItem(MIGRADO + uid, String(Date.now())); } catch (e) { }
      return migrou;
    },

    /* Varre o localStorage por documentos de progresso locais e devolve o
       mais completo (mais aulas concluídas). */
    _melhorProgressoLocal() {
      let melhor = null, max = -1;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || k.indexOf('terminalis.dados.v1/progresso/') !== 0 && k.indexOf(CACHE_PROG) !== 0) continue;
          let d = null; try { d = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
          const n = d && d.lessons ? Object.keys(d.lessons).length : 0;
          if (n > max) { max = n; melhor = d; }
        }
      } catch (e) { }
      return melhor;
    },

    /* ------------------------------ reconexão ------------------------------ */
    async _voltouOnline() {
      if (!this._temNuvem()) { this.status('local'); return; }
      if (this._pendente || this._sujo) await this.flushWorkspace();
      else this.status('salvo');
      /* Reenvia progresso em cache, caso uma gravação tenha falhado offline. */
      try {
        const uid = this._uid();
        const raw = localStorage.getItem(CACHE_PROG + uid);
        if (raw && LX.Auth && LX.Auth.gravarAgora) await LX.Auth.gravarAgora(JSON.parse(raw));
      } catch (e) { }
    },

    /* ------------------------------- status ------------------------------- */
    status(estado) {
      this._estado = estado;
      if (!temDoc) return estado;
      const el = document.getElementById('sync-state');
      if (!el) return estado;
      const mapa = {
        salvando: ['dot-sync', 'salvando…'],
        salvo: ['dot-ok', 'salvo'],
        offline: ['dot-local', 'offline'],
        erro: ['dot-err', 'erro ao sincronizar'],
        restaurando: ['dot-sync', 'restaurando ambiente…'],
        local: ['dot-local', 'local']
      };
      const [cls, txt] = mapa[estado] || mapa.local;
      el.classList.remove('dot-ok', 'dot-sync', 'dot-err', 'dot-local');
      el.classList.add(cls);
      const span = el.querySelector('span');
      if (span) span.textContent = txt;
      el.setAttribute('title', 'Sincronização: ' + txt);
      return estado;
    }
  };

  function Store() { return LX.Store; }

  LX.Sync = Sync;
})();

