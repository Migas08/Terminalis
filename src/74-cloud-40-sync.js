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

  function diagnosticar(contexto, erro) {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
    const detalhe = erro && erro.message ? ': ' + erro.message : '';
    console.warn('[Terminalis Sync] ' + contexto + detalhe, erro);
  }
  function traco(msg) {
    if (typeof console !== 'undefined' && typeof console.info === 'function') console.info('[Workspace] ' + msg);
  }

  const Sync = {
    app: null,
    _revisao: 0,          // última revisão conhecida do workspace na nuvem
    _sujo: false,
    _pendente: false,     // há algo à espera de rede
    _flushing: false,
    _reflush: false,
    _pausado: false,          // conflito pendente: só o aluno pode retomar
    _conflito: null,
    _assinatura: null,        // JSON do último snapshot conhecido
    _timer: null,
    _timerProg: null,
    _estado: 'local',

    /* --------------------------- ciclo de vida --------------------------- */
    iniciar(app) {
      this.app = app || this.app;
      if (temWindow && !this._ligado) {
        window.addEventListener('online', () => this._voltouOnline());
        window.addEventListener('offline', () => this.status('offline'));
        window.addEventListener('beforeunload', () => {
          try { this._cacheProgresso(); }
          catch (e) { /* o navegador está encerrando; não há interface disponível para diagnóstico */ }
        });
        this._ligado = true;
      }
      this.status(this._temNuvem() ? 'salvo' : 'local');
      return this;
    },

    /* Zera TODO o estado da sessão de sincronização. O estado global (revisão,
       assinatura, conflito, pausa, pendências, timers) pertence a um usuário —
       não pode vazar para o próximo. Chamado no logout e antes de trocar de
       conta. NÃO apaga dados persistidos nem backups locais de conflito: só
       descarta o estado em memória. Não interrompe uma gravação legítima já
       iniciada (o logout faz capturarAgora() antes de chamar isto). */
    resetarSessao() {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      if (this._timerProg) { clearTimeout(this._timerProg); this._timerProg = null; }
      this._revisao = 0;
      this._sujo = false;
      this._pendente = false;
      this._flushing = false;
      this._reflush = false;
      this._pausado = false;
      this._conflito = null;
      this._assinatura = null;
      this._estado = 'local';
      /* Fecha o cartão de conflito de outra sessão, se ainda estiver aberto. */
      if (temDoc) { const el = document.getElementById('sync-conflict'); if (el) el.classList.remove('on'); }
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
      if (!this._uid()) return false;
      if (dominio === 'progresso') {
        this._cacheProgresso();
        return true; // o progresso é gravado pelo LX.Auth (debounce próprio); aqui só cacheamos
      }
      /* O gancho é chamado após qualquer comando, inclusive ls/pwd/cat. A
         assinatura evita agendar upload quando o domínio não mudou. */
      const atual = this.exportarSnapshot();
      const assinatura = atual ? this.assinarSnapshot(atual) : null;
      if (assinatura && assinatura === this._assinatura) return false;
      this._assinatura = assinatura || this._assinatura;
      this._sujo = true;
      this._cacheWorkspace();          // cache local imediato (offline-first)
      const ms = (LX.Config.sync && LX.Config.sync.workspaceDebounceMs) || 1500;
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => { this._timer = null; this.flushWorkspace(); }, ms);
      return true;
    },

    /* --------------------------- exportar snapshot --------------------------- */
    exportarSnapshot() {
      if (!this.app || !this.app.machine) return null;
      return LX.Workspace.exportState(this.app.machine, this.app.term || null,
        { trilhaId: this.app.trilhaId || null });
    },

    /* Campos voláteis ficam no snapshot persistido, mas não decidem se houve
       trabalho novo: cada export recebe updatedAt novo, leituras podem mudar
       atime e todo comando entra no histórico. */
    assinarSnapshot(snapshot) {
      try {
        const d = JSON.parse(JSON.stringify(snapshot));
        delete d.updatedAt; delete d.history;
        for (const m of (d.machines || [])) {
          for (const n of (m.filesystem && m.filesystem.nodes || [])) if (n.data) delete n.data.atime;
        }
        if (d.shell && d.shell.data) delete d.shell.data.history;
        for (const row of (d.stack || [])) if (row.data) delete row.data.history;
        return JSON.stringify(d);
      } catch (e) { return null; }
    },

    _docLocal(uid) {
      uid = uid || this._uid();
      let raw = null;
      try { raw = localStorage.getItem(CACHE_WS + uid); }
      catch (e) { /* armazenamento bloqueado: a restauração ainda pode usar a nuvem */ }
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },
    _cacheWorkspace() {
      try {
        const snap = this.exportarSnapshot();
        if (!snap) return;
        localStorage.setItem(CACHE_WS + this._uid(), JSON.stringify(
          { version: snap.version, revision: this._revisao, updatedAt: Date.now(), snapshot: snap }));
      } catch (e) { diagnosticar('não foi possível atualizar o cache do workspace', e); }
    },
    _cacheProgresso() {
      try {
        if (LX.Progress && LX.Progress.data)
          localStorage.setItem(CACHE_PROG + this._uid(), JSON.stringify(LX.Progress.data));
      } catch (e) { diagnosticar('não foi possível atualizar o cache de progresso', e); }
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
        traco('tentando salvar baseRevision=' + this._revisao);
        const r = await LX.Storage.saveWorkspace(uid, doc);
        if (r.ok) { this._revisao = r.revision; this._assinatura = this.assinarSnapshot(snap); this._pendente = false; this._sujo = false; this.status('salvo'); traco('salvo revision=' + r.revision); }
        else if (r.conflito) { traco('conflito de revisão — sincronização pausada'); this._resolverConflito(r.atual); }
        else { this._pendente = true; this.status('erro'); diagnosticar('falha ao salvar workspace', r.erro ? { message: r.erro } : null); }
      } catch (e) {
        this._pendente = true; this.status('erro');
        diagnosticar(`falha ao enviar workspace de ${uid} na revisão ${this._revisao}`, e);
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
      } catch (e) { diagnosticar('não foi possível criar o backup local do conflito', e); }
      this._conflito = { atual: atual || null, localSnapshot };
      this._pausado = true;
      this._pendente = false; this._sujo = false;
      this.status('conflito');
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
          this._assinatura = this.assinarSnapshot(conflito.atual.snapshot);
          this._sujo = false; this._pendente = false; this.status('salvo');
          return true;
        } catch (e) {
          diagnosticar('não foi possível aplicar o workspace remoto escolhido', e);
          this.status('erro');
          return false;
        }
      }
      /* Reaplica o snapshot local que o aluno escolheu, agora sobre a revisão
         remota mais nova. O controle otimista continua protegendo a gravação. */
      this._revisao = Number(conflito.atual && conflito.atual.revision || this._revisao);
      this._sujo = true;
      this._assinatura = null; // força o envio consciente da versão escolhida
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
      let remoto = null;
      try { remoto = await LX.Storage.getWorkspace(uid); }
      catch (e) { diagnosticar(`falha ao buscar workspace remoto de ${uid}; tentando o cache local`, e); remoto = null; }
      const local = this._docLocal(uid);
      const escolha = this.resolverRestauracao(remoto, local);
      const doc = escolha.doc;
      if (!doc || !doc.snapshot) { this._revisao = (remoto && remoto.revision) || 0; this.status(this._temNuvem() ? 'salvo' : 'local'); return false; }
      try {
        const restaurado = LX.Workspace.importState(doc.snapshot);
        this._revisao = Number(doc.revision || 0);
        this._assinatura = this.assinarSnapshot(doc.snapshot);
        if (this.app && this.app.aplicarWorkspaceRestaurado) this.app.aplicarWorkspaceRestaurado(restaurado);
        traco('ambiente restaurado revision=' + this._revisao + ' origem=' + escolha.origem);
        if (escolha.precisaEnviar) {
          /* O cache local trazia alterações não enviadas (reload/fechamento
             durante o debounce). Reenvia agora, mantendo baseRevision para não
             sobrescrever ninguém indevidamente. */
          this._sujo = true; this._assinatura = null; this.status('pendente');
          await this.flushWorkspace();
        } else {
          this.status(this._temNuvem() ? 'salvo' : 'local');
        }
        return true;
      } catch (e) {
        diagnosticar(`snapshot de ${uid} recusado durante a restauração`, e);
        this.status(this._temNuvem() ? 'salvo' : 'local');
        return false;
      }
    },

    /* Decide, entre o snapshot da nuvem e o cache local desta máquina, qual deve
       reconstruir o laboratório — e se o resultado precisa ser reenviado. A
       política é por REVISÃO (nunca escolhe o local só pelo relógio quando as
       revisões são incompatíveis):
         · só local          -> usa local; reenvia se houver nuvem (D)
         · só remoto          -> usa remoto (E)
         · remoto.rev > local -> outro dispositivo avançou: remoto tem
                                  precedência; o cache local não o sobrescreve (B)
         · local.rev > remoto -> estado inconsistente: usa remoto e diagnostica,
                                  sem sobrescrever a nuvem em silêncio (C)
         · revisões iguais    -> se o cache local é mais novo E difere de fato,
                                  ele carrega alterações do último debounce ainda
                                  não enviadas: usa local e reenvia (A)
       Devolve { doc, origem:'local'|'remote'|null, precisaEnviar, conflito }. */
    resolverRestauracao(remoto, local) {
      const temR = !!(remoto && remoto.snapshot);
      const temL = !!(local && local.snapshot);
      const R = (doc, origem, precisaEnviar) => ({ doc: doc || null, origem: doc ? origem : null, precisaEnviar: !!precisaEnviar, conflito: false });
      if (!temR && !temL) return R(null, null, false);
      if (temL && !temR) return R(local, 'local', this._temNuvem());
      if (temR && !temL) return R(remoto, 'remote', false);
      const rR = Number(remoto.revision || 0), rL = Number(local.revision || 0);
      if (rR > rL) return R(remoto, 'remote', false);
      if (rL > rR) { diagnosticar(`cache local à frente da nuvem (revisão ${rL} > ${rR}); a nuvem tem precedência`, null); return R(remoto, 'remote', false); }
      const maisNovo = (local.updatedAt || 0) > (remoto.updatedAt || 0);
      const difere = maisNovo && this.assinarSnapshot(local.snapshot) !== this.assinarSnapshot(remoto.snapshot);
      if (difere) return R(local, 'local', this._temNuvem());
      return R(remoto, 'remote', false);
    },

    /* ------------------------------ migração ------------------------------
       Primeira entrada em nuvem: se a conta ainda não tem progresso/ambiente
       salvos, aproveita o que já existia neste navegador (modo local). */
    async migrarLocais(uid) {
      uid = uid || this._uid();
      if (!uid) return false;
      let jaFez = false;
      try { jaFez = !!localStorage.getItem(MIGRADO + uid); }
      catch (e) { /* sem marcador local, a migração idempotente pode ser tentada novamente */ }
      if (jaFez) return false;

      /* O marcador de "migrado" SÓ pode ser gravado quando pudermos afirmar que
         o estado remoto foi lido, o local foi lido e tudo que precisava migrar
         foi salvo com sucesso — OU não havia nada a migrar. Se o Supabase falhar
         (leitura ou gravação), não marcamos: a próxima sessão tenta de novo. */
      let migrou = false, houveFalha = false;

      /* Progresso: só migra se a nuvem estiver vazia e houver progresso local. */
      try {
        const nuvem = await LX.Storage.getProgress(uid);
        const temNuvem = nuvem && Object.keys(nuvem.lessons || {}).length;
        if (!temNuvem) {
          const localProg = this._melhorProgressoLocal();
          if (localProg && Object.keys(localProg.lessons || {}).length) {
            const ok = await LX.Storage.saveProgress(uid, localProg);
            if (ok) {
              if (LX.Auth) LX.Auth.progresso = localProg;
              if (LX.Progress) LX.Progress.replace(localProg);
              migrou = true;
            } else { houveFalha = true; }   // gravação recusada: não confirma a migração
          }
        }
      } catch (e) { diagnosticar(`falha ao migrar o progresso local de ${uid}`, e); houveFalha = true; }

      /* Workspace: idem, migra o cache local se a nuvem não tiver nada. */
      try {
        const wsNuvem = await LX.Storage.getWorkspace(uid);
        if (!wsNuvem || !wsNuvem.snapshot) {
          const local = this._docLocal(uid);
          if (local && local.snapshot) {
            const r = await LX.Storage.saveWorkspace(uid, { version: local.version, snapshot: local.snapshot, device: LX.Config.dispositivoId(), baseRevision: 0 });
            if (r && r.ok) { this._revisao = r.revision; migrou = true; }
            else { houveFalha = true; }      // conflito ou erro: tenta de novo depois
          }
        }
      } catch (e) { diagnosticar(`falha ao migrar o workspace local de ${uid}`, e); houveFalha = true; }

      if (!houveFalha) {
        try { localStorage.setItem(MIGRADO + uid, String(Date.now())); }
        catch (e) { /* o marcador é uma otimização; os dados já foram tratados acima */ }
      }
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
      } catch (e) { diagnosticar('falha ao procurar progresso no armazenamento local', e); }
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
      } catch (e) { diagnosticar('falha ao reenviar o progresso depois da reconexão', e); }
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
        pendente: ['dot-sync', 'pendente — enviando…'],
        offline: ['dot-local', 'offline'],
        erro: ['dot-err', 'erro ao sincronizar'],
        conflito: ['dot-err', 'conflito — escolha uma versão'],
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

