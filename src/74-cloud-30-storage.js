/* =========================================================================
   TERMINALIS — LX.Storage: abstração única de armazenamento
   ---------------------------------------------------------------------
   A aplicação NUNCA fala com localStorage, com claude.use('db') ou com o
   Supabase diretamente. Ela fala com LX.Storage, e o provider ativo decide
   onde os bytes moram:

              aplicação  ->  LX.Storage
                              /       \
                    LocalStorage     Supabase (nuvem, sincronizado)
                     (cache/offline)

   Providers disponíveis:
     · local  — localStorage (cache, offline, fallback);
     · nuvem  — claude.use('db'), quando presente;
     · supabase — PostgreSQL do Supabase com RLS.

   Todos expõem a MESMA interface: get/set por coleção+id e os atalhos de
   workspace com revisão. Trocar de provider não muda uma linha da aplicação.
   ========================================================================= */
'use strict';
(function () {
  const Store = LX.Store;

  /* Guarda as implementações originais (local / claude db) antes de estender. */
  const baseGet = Store.get.bind(Store);
  const baseSet = Store.set.bind(Store);

  Store.provider = null;   // quando definido (SupabaseStore), tem prioridade

  /* Liga/desliga o provider Supabase. Chamado por LX.Auth ao autenticar. */
  Store.usarSupabase = function (ligar) {
    this.provider = ligar ? LX.SupabaseStore : null;
    this.modo = ligar ? 'supabase' : this.modo;
    return this.modo;
  };

  /* get/set: coleções mapeadas pelo provider (progresso, workspaces,
     profiles) vão para a nuvem; o resto (contas, índice de e-mail, só
     usados no modo local) permanece local. */
  Store.get = async function (col, id) {
    if (this.provider && this.provider._tabela && this.provider._tabela(col)) return this.provider.get(col, id);
    return baseGet(col, id);
  };
  Store.set = async function (col, id, dados) {
    if (this.provider && this.provider._tabela && this.provider._tabela(col)) return this.provider.set(col, id, dados);
    return baseSet(col, id, dados);
  };

  /* -------- workspace: leitura e gravação com controle de revisão --------
     Documento gravado: { version, revision, updatedAt, device, snapshot }. */
  Store.getWorkspace = async function (uid) {
    if (this.provider && this.provider.getWorkspace) return this.provider.getWorkspace(uid);
    const doc = await baseGet('workspaces', uid);
    return doc || null;
  };

  /* Leitura com resultado explícito para decisões irreversíveis (migração):
     distingue "não existe" de "falha ao ler". Delega ao provider quando ele
     souber diferenciar; senão faz o melhor esforço (não consegue detectar erro
     do backend antigo, mas mantém o formato). Não muda o get/getWorkspace. */
  Store.getWorkspaceResult = async function (uid) {
    if (this.provider) {
      if (this.provider.getWorkspaceResult) return this.provider.getWorkspaceResult(uid);
      const doc = await this.provider.getWorkspace(uid);
      return { ok: true, encontrado: !!(doc && doc.snapshot), value: doc || null };
    }
    const doc = await baseGet('workspaces', uid);
    return { ok: true, encontrado: !!doc, value: doc || null };
  };
  Store.getProgressResult = async function (uid) {
    if (this.provider) {
      if (this.provider.getProgressResult) return this.provider.getProgressResult(uid);
      const doc = await this.provider.get('progresso', uid);
      return { ok: true, encontrado: !!doc, value: doc || null };
    }
    const doc = await baseGet('progresso', uid);
    return { ok: true, encontrado: !!doc, value: doc || null };
  };

  /* Optimistic locking genérico (local / claude db): grava só se a revisão
     que lemos ainda for a atual. Impede que um dispositivo apague em
     silêncio o trabalho mais novo feito em outro. */
  Store.saveWorkspace = async function (uid, doc) {
    if (this.provider && this.provider.saveWorkspace) return this.provider.saveWorkspace(uid, doc);
    const base = Number(doc.baseRevision || 0);
    const atual = await baseGet('workspaces', uid);
    if (atual && Number(atual.revision || 0) !== base) return { ok: false, conflito: true, atual };
    const nova = base + 1;
    const gravar = {
      version: doc.version, revision: nova, updatedAt: Date.now(),
      device: doc.device || null, snapshot: doc.snapshot
    };
    const ok = await baseSet('workspaces', uid, gravar);
    return ok ? { ok: true, revision: nova } : { ok: false, erro: 'falha ao gravar' };
  };

  /* ------------------------ merge determinístico ------------------------
     Progresso é um conjunto de fatos monotônicos na maior parte dos campos:
     duas abas podem concluir aulas diferentes e ambas devem sobreviver. Para
     notas/preferências, preservamos chaves distintas e escolhemos o documento
     mais recente (com desempate estável) quando a mesma chave diverge. */
  function copia(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }
  function unirMapas(a, b) {
    const out = Object.assign({}, a || {});
    for (const k of Object.keys(b || {})) {
      const av = out[k], bv = b[k];
      if (av === undefined || (typeof bv === 'number' && Number(bv) > Number(av))) out[k] = bv;
    }
    return out;
  }
  function unirCampos(a, b, ta, tb) {
    const out = {};
    for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})]))
      out[k] = escolherCampo(a && a[k], b && b[k], ta, tb);
    return out;
  }
  function textoCanonico(v) { try { return JSON.stringify(v, Object.keys(v || {}).sort()); } catch (e) { return String(v); } }
  function escolherCampo(a, b, ta, tb) {
    if (a === undefined) return copia(b);
    if (b === undefined) return copia(a);
    if (ta !== tb) return copia(ta > tb ? a : b);
    return copia(textoCanonico(a) >= textoCanonico(b) ? a : b);
  }
  const ProgressMerge = {
    merge(base, incoming) {
      const a = base || {}, b = incoming || {};
      const ta = Number(a.atualizadoEm || 0), tb = Number(b.atualizadoEm || 0);
      const out = Object.assign({}, copia(a), copia(b));
      for (const campo of ['lessons', 'tasks', 'projetos', 'desbloqueios', 'conclusoes', 'etapasFeitas'])
        out[campo] = unirMapas(a[campo], b[campo]);
      out.notes = unirCampos(a.notes, b.notes, ta, tb);
      out.settings = unirCampos(a.settings, b.settings, ta, tb);
      out.streakDays = Array.from(new Set([...(a.streakDays || []), ...(b.streakDays || [])])).sort();
      out.seconds = Math.max(Number(a.seconds || 0), Number(b.seconds || 0));
      out.lastLesson = escolherCampo(a.lastLesson, b.lastLesson, ta, tb);
      out.atualizadoEm = Math.max(ta, tb);
      return out;
    }
  };
  LX.ProgressMerge = ProgressMerge;

  /* ============================ LX.Storage ============================
     Interface de domínio, estável e independente de onde os dados vivem.
     Notas e preferências vivem dentro do documento de progresso (um único
     registro por usuário), então são lidas/escritas a partir dele. */
  const Storage = {
    get modo() { return Store.modo; },

    getUser() { return LX.Auth ? LX.Auth.usuario : null; },

    async getProgress(uid) { return await Store.get('progresso', uid); },
    async getProgressResult(uid) { return await Store.getProgressResult(uid); },
    async saveProgress(uid, dados) { return await Store.set('progresso', uid, dados); },

    async getNotes(uid) { const p = await this.getProgress(uid); return (p && p.notes) || {}; },
    async saveNotes(uid, notes) {
      const p = (await this.getProgress(uid)) || (LX.PROGRESSO_VAZIO ? LX.PROGRESSO_VAZIO() : {});
      p.notes = notes; return await this.saveProgress(uid, p);
    },

    async getSettings(uid) { const p = await this.getProgress(uid); return (p && p.settings) || {}; },
    async saveSettings(uid, settings) {
      const p = (await this.getProgress(uid)) || (LX.PROGRESSO_VAZIO ? LX.PROGRESSO_VAZIO() : {});
      p.settings = settings; return await this.saveProgress(uid, p);
    },

    async getWorkspace(uid) { return await Store.getWorkspace(uid); },
    async getWorkspaceResult(uid) { return await Store.getWorkspaceResult(uid); },
    async saveWorkspace(uid, doc) { return await Store.saveWorkspace(uid, doc); }
  };

  LX.Storage = Storage;
})();

