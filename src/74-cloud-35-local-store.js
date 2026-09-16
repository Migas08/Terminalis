/* =========================================================================
   TERMINALIS — LX.LocalWorkspaceStore: persistência local do laboratório
   ---------------------------------------------------------------------
   Camada ISOLADA para os dados grandes da VM (cache do workspace e backups de
   conflito). O LX.Sync fala só com esta camada — nunca com IndexedDB direto.

   Estratégia HÍBRIDA:
     · IndexedDB é o armazenamento principal (assíncrono, sem a cota apertada
       do localStorage) para o cache e para os backups;
     · o localStorage guarda um ESPELHO SÍNCRONO do cache atual, escrito na
       hora — é o que protege o "reload durante o debounce" (o beforeunload não
       espera o IndexedDB). Chave legada preservada: terminalis.cache.workspace/<uid>.

   Fallback: se o IndexedDB estiver bloqueado/indisponível/com erro, tudo cai no
   localStorage legado e a aplicação continua funcionando — erro de IndexedDB
   NUNCA vira perda de workspace. No Node (testes) não há IndexedDB, então a
   camada opera 100% em localStorage, idêntica ao comportamento anterior.

   Retenção: no máximo MAX_BACKUPS por usuário; ao exceder, o mais antigo é
   descartado (nunca o recém-criado).
   ========================================================================= */
'use strict';
(function () {
  const temLS = (() => { try { return typeof localStorage !== 'undefined' && !!localStorage; } catch (e) { return false; } })();
  const CACHE_WS = 'terminalis.cache.workspace/';
  const BACKUP_WS = 'terminalis.backup.workspace/';
  const DB_NOME = 'terminalis-workspace';
  const LOJA_CACHE = 'current';
  const LOJA_BACKUP = 'backups';

  function diag(contexto, erro) {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
    console.warn('[Workspace local] ' + contexto + (erro && erro.message ? ': ' + erro.message : ''), erro || '');
  }

  /* ------------------------------ IndexedDB ------------------------------ */
  function idbDisponivel() {
    try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch (e) { return false; }
  }
  function prom(req) {
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  }

  const Store = {
    MAX_BACKUPS: 5,
    _dbPromise: null,

    idbAtivo() { return idbDisponivel(); },

    _abrir() {
      if (!idbDisponivel()) return Promise.resolve(null);
      if (this._dbPromise) return this._dbPromise;
      this._dbPromise = new Promise((res) => {
        let req;
        try { req = indexedDB.open(DB_NOME, 1); }
        catch (e) { diag('não foi possível abrir o IndexedDB', e); return res(null); }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(LOJA_CACHE)) db.createObjectStore(LOJA_CACHE, { keyPath: 'uid' });
          if (!db.objectStoreNames.contains(LOJA_BACKUP)) {
            const s = db.createObjectStore(LOJA_BACKUP, { keyPath: 'id' });
            s.createIndex('uid', 'uid', { unique: false });
          }
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => { diag('falha ao abrir o IndexedDB; usando localStorage', req.error); res(null); };
        req.onblocked = () => { diag('IndexedDB bloqueado; usando localStorage', null); res(null); };
      });
      return this._dbPromise;
    },

    async _tx(loja, modo, fn) {
      const db = await this._abrir();
      if (!db) return { ok: false };
      try {
        const tx = db.transaction(loja, modo);
        const store = tx.objectStore(loja);
        const r = await fn(store);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
        return { ok: true, value: r };
      } catch (e) { diag('operação IndexedDB falhou; caindo para localStorage', e); return { ok: false }; }
    },

    /* ------------------------- cache do workspace ------------------------- */
    /* Grava o cache. SÍNCRONO no localStorage (proteção de reload) + assíncrono
       no IndexedDB (melhor esforço). Devolve imediatamente. */
    setCurrent(uid, doc) {
      if (temLS) {
        try { localStorage.setItem(CACHE_WS + uid, JSON.stringify(doc)); }
        catch (e) { diag('não foi possível espelhar o cache no localStorage', e); }
      }
      // IndexedDB em segundo plano; falha não afeta a aplicação.
      this._tx(LOJA_CACHE, 'readwrite', (s) => s.put({ uid, doc })).catch(() => { });
      return true;
    },

    /* Lê o cache: IndexedDB primeiro (mais durável), senão o espelho local. */
    async getCurrent(uid) {
      const r = await this._tx(LOJA_CACHE, 'readonly', (s) => prom(s.get(uid)));
      if (r.ok && r.value && r.value.doc) return r.value.doc;
      return this._localCache(uid);
    },

    /* Leitura SÍNCRONA do espelho local (usada no caminho rápido de restauração). */
    _localCache(uid) {
      if (!temLS) return null;
      try { const raw = localStorage.getItem(CACHE_WS + uid); return raw ? JSON.parse(raw) : null; }
      catch (e) { return null; }
    },

    async deleteCurrent(uid) {
      if (temLS) { try { localStorage.removeItem(CACHE_WS + uid); } catch (e) { } }
      await this._tx(LOJA_CACHE, 'readwrite', (s) => s.delete(uid)).catch(() => { });
      return true;
    },

    /* ------------------------------ backups ------------------------------
       O caminho localStorage é SÍNCRONO (o backup fica visível na hora e a
       retenção roda de imediato); o IndexedDB é espelhado em segundo plano. */
    saveBackup(uid, doc, id) {
      id = id || (uid + '.' + Date.now());
      const registro = { version: doc.version, updatedAt: doc.updatedAt || Date.now(), snapshot: doc.snapshot || doc };
      if (temLS) {
        try { localStorage.setItem(BACKUP_WS + id, JSON.stringify(registro)); }
        catch (e) { diag('não foi possível gravar backup no localStorage', e); }
        this._retencaoLocal(uid);
      }
      // Espelho no IndexedDB + retenção (melhor esforço, sem bloquear).
      this._tx(LOJA_BACKUP, 'readwrite', (s) => s.put({ id, uid, doc: registro, ts: registro.updatedAt }))
        .then(() => this._retencaoIDB(uid)).catch(() => { });
      return id;
    },

    /* Lista SÍNCRONA dos backups no localStorage (antigo -> novo). */
    listBackupsLocal(uid) {
      const out = [];
      if (!temLS) return out;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(BACKUP_WS + uid + '.') === 0) {
            let d = null; try { d = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
            out.push({ id: k.slice(BACKUP_WS.length), uid, doc: d, ts: (d && d.updatedAt) || Number(k.split('.').pop()) || 0 });
          }
        }
      } catch (e) { /* armazenamento indisponível */ }
      return out.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    },

    /* Lista (IndexedDB primeiro; senão o localStorage). */
    async listBackups(uid) {
      const r = await this._tx(LOJA_BACKUP, 'readonly', (s) => { const idx = s.index('uid'); return prom(idx.getAll(uid)); });
      if (r.ok && Array.isArray(r.value) && r.value.length) return r.value.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
      return this.listBackupsLocal(uid);
    },

    deleteBackup(id) {
      if (temLS) { try { localStorage.removeItem(BACKUP_WS + id); } catch (e) { } }
      this._tx(LOJA_BACKUP, 'readwrite', (s) => s.delete(id)).catch(() => { });
      return true;
    },

    /* Retenção SÍNCRONA no localStorage: mantém os MAX_BACKUPS mais recentes,
       descartando os mais antigos (nunca o recém-criado, que é o de maior ts). */
    _retencaoLocal(uid) {
      const lista = this.listBackupsLocal(uid);
      const excesso = lista.length - this.MAX_BACKUPS;
      for (let i = 0; i < excesso; i++) { try { localStorage.removeItem(BACKUP_WS + lista[i].id); } catch (e) { } }
    },

    async _retencaoIDB(uid) {
      try {
        const r = await this._tx(LOJA_BACKUP, 'readonly', (s) => { const idx = s.index('uid'); return prom(idx.getAll(uid)); });
        if (!r.ok || !Array.isArray(r.value)) return;
        const lista = r.value.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
        const excesso = lista.length - this.MAX_BACKUPS;
        for (let i = 0; i < excesso; i++) await this._tx(LOJA_BACKUP, 'readwrite', (s) => s.delete(lista[i].id)).catch(() => { });
      } catch (e) { diag('falha na retenção de backups (IndexedDB)', e); }
    },

    /* --------------------------- migração legada --------------------------- */
    /* Move o cache e os backups já existentes no localStorage para o IndexedDB,
       de forma idempotente: lê, grava no IDB, confirma e só então remove o
       legado. Se o IDB falhar, o legado permanece e a próxima sessão tenta de
       novo (o localStorage segue sendo lido normalmente). */
    async migrarLegado(uid) {
      if (!idbDisponivel() || !temLS) return false;
      let migrou = false;
      // cache atual
      try {
        const legado = this._localCache(uid);
        if (legado) {
          const r = await this._tx(LOJA_CACHE, 'readwrite', (s) => s.put({ uid, doc: legado }));
          if (r.ok) {
            const conf = await this._tx(LOJA_CACHE, 'readonly', (s) => prom(s.get(uid)));
            if (conf.ok && conf.value) { migrou = true; /* mantém o espelho local (proteção de reload) */ }
          }
        }
      } catch (e) { diag('falha ao migrar o cache legado', e); }
      // backups
      try {
        const chaves = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(BACKUP_WS + uid + '.') === 0) chaves.push(k);
        }
        for (const k of chaves) {
          let d = null; try { d = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
          const id = k.slice(BACKUP_WS.length);
          const r = await this._tx(LOJA_BACKUP, 'readwrite', (s) => s.put({ id, uid, doc: d, ts: (d && d.updatedAt) || Date.now() }));
          if (r.ok) { try { localStorage.removeItem(k); } catch (e) { } migrou = true; }
        }
        await this._retencaoIDB(uid);
      } catch (e) { diag('falha ao migrar backups legados', e); }
      return migrou;
    }
  };

  LX.LocalWorkspaceStore = Store;
})();
