/* =========================================================================
   TERMINALIS — backend Supabase (Auth + PostgreSQL)
   ---------------------------------------------------------------------
   Este arquivo isola TODA a conversa com o Supabase. O resto do Terminalis
   nunca importa o SDK diretamente: fala com `LX.CloudAuth` (contas) e com
   `LX.SupabaseStore` (dados), que têm exatamente a mesma interface do
   backend local. Assim, trocar local <-> nuvem não vaza para a aplicação.

   Segurança:
     · usamos apenas a chave pública (anon). RLS no banco garante que cada
       usuário só enxergue linhas com user_id = auth.uid().
     · a senha é responsabilidade exclusiva do Supabase Auth — nunca é
       derivada, guardada ou trafegada por nós.
   ========================================================================= */
'use strict';
(function () {

  /* ------------------------- cliente compartilhado ------------------------- */
  let _cliente = null;
  function cliente() {
    if (_cliente) return _cliente;
    if (!LX.Config.supabaseDisponivel()) return null;
    _cliente = globalThis.supabase.createClient(
      LX.Config.supabase.url,
      LX.Config.supabase.anonKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
    return _cliente;
  }

  const publico = (user, perfil) => ({
    uid: user.id,
    usuario: (perfil && perfil.username) || (user.email || '').split('@')[0],
    email: user.email || '',
    nome: (perfil && perfil.name) || (user.user_metadata && user.user_metadata.name) || (user.email || '').split('@')[0],
    criadoEm: user.created_at ? Date.parse(user.created_at) : Date.now()
  });

  function erro(campo, msg) { const e = new (LX.ErroAuth || Error)(campo, msg); if (!e.campo) e.campo = campo; return e; }

  /* Erros do Supabase (RLS, tabela/coluna, sessão expirada, payload) não podem
     sumir em silêncio: sem diagnóstico, uma gravação recusada parece um "salvo".
     Preserva a interface (get/set devolvem null/false), mas deixa o motivo no
     console para que o problema seja visível. */
  function diag(contexto, detalhe) {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
    const msg = detalhe && (detalhe.message || detalhe.msg || detalhe.error_description || detalhe.details || detalhe.hint);
    console.warn('[Workspace] ' + contexto + (msg ? ': ' + msg : ''), detalhe || '');
  }

  /* Traduz mensagens do Supabase para algo legível em português. */
  function traduzir(m) {
    const t = String(m || '').toLowerCase();
    if (t.includes('invalid login')) return 'Usuário ou senha incorretos.';
    if (t.includes('already registered') || t.includes('already exists')) return 'Esse e-mail já tem uma conta. Tente entrar.';
    if (t.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).';
    if (t.includes('password')) return 'A senha precisa de pelo menos 8 caracteres.';
    if (t.includes('rate limit')) return 'Muitas tentativas. Aguarde um instante e tente de novo.';
    return m || 'Não foi possível concluir. Tente de novo.';
  }

  /* ============================ Auth em nuvem ============================ */
  const CloudAuth = {
    async perfil(uid) {
      const c = cliente(); if (!c) return null;
      const { data } = await c.from('profiles').select('username,name').eq('id', uid).maybeSingle();
      return data || null;
    },

    async garantirPerfil(user, usuario, nome) {
      const c = cliente(); if (!c) return null;
      const linha = {
        id: user.id,
        username: (usuario || (user.email || '').split('@')[0] || '').toLowerCase().slice(0, 24),
        name: nome || usuario || (user.email || '').split('@')[0]
      };
      await c.from('profiles').upsert(linha, { onConflict: 'id' });
      return linha;
    },

    /* Retoma a sessão persistida pelo SDK (entrar de outro aparelho). */
    async restaurarSessao() {
      const c = cliente(); if (!c) return null;
      const { data } = await c.auth.getSession();
      const sess = data && data.session;
      if (!sess || !sess.user) return null;
      const perfil = await this.perfil(sess.user.id);
      return publico(sess.user, perfil);
    },

    async criar({ usuario, email, senha, nome }) {
      const c = cliente(); if (!c) throw erro('email', 'Nuvem indisponível.');
      if (String(senha || '').length < 8) throw erro('senha', 'A senha precisa de pelo menos 8 caracteres.');
      const { data, error } = await c.auth.signUp({
        email: String(email || '').trim().toLowerCase(),
        password: senha,
        options: { data: { name: nome || usuario, username: (usuario || '').toLowerCase() } }
      });
      if (error) throw erro('email', traduzir(error.message));
      if (!data.user) throw erro('email', 'Não foi possível criar a conta.');
      const perfil = await this.garantirPerfil(data.user, usuario, nome);
      /* Sem sessão => o projeto exige confirmação de e-mail. */
      if (!data.session) {
        const e = erro('email', 'Conta criada. Confirme o e-mail enviado para poder entrar.');
        e.precisaConfirmar = true;
        throw e;
      }
      return publico(data.user, perfil);
    },

    async entrar({ login, senha }) {
      const c = cliente(); if (!c) throw erro('login', 'Nuvem indisponível.');
      const email = String(login || '').trim().toLowerCase();
      if (!email.includes('@')) throw erro('login', 'No modo nuvem, entre com o seu e-mail.');
      const { data, error } = await c.auth.signInWithPassword({ email, password: senha });
      if (error) throw erro('senha', traduzir(error.message));
      const perfil = await this.perfil(data.user.id);
      return publico(data.user, perfil);
    },

    async sair() {
      const c = cliente(); if (!c) return;
      try { await c.auth.signOut(); } catch (e) { /* offline: a sessão local será descartada */ }
    },

    async trocarSenha(_senhaAtual, senhaNova) {
      const c = cliente(); if (!c) throw erro('senha', 'Nuvem indisponível.');
      if (String(senhaNova || '').length < 8) throw erro('nova', 'A nova senha precisa de pelo menos 8 caracteres.');
      const { error } = await c.auth.updateUser({ password: senhaNova });
      if (error) throw erro('senha', traduzir(error.message));
      return true;
    },

    /* Recuperação de senha por e-mail (opcional). */
    async recuperarSenha(email) {
      const c = cliente(); if (!c) throw erro('email', 'Nuvem indisponível.');
      const { error } = await c.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase());
      if (error) throw erro('email', traduzir(error.message));
      return true;
    }
  };

  /* ===================== Store em nuvem (PostgreSQL) =====================
     Mesma interface do LX.Store local: get/set por coleção+id, mais os
     atalhos de workspace com controle de revisão (optimistic locking).
     ===================================================================== */
  const SupabaseStore = {
    modo: 'supabase',

    _tabela(col) {
      return ({ progresso: 'user_progress', workspaces: 'workspaces', profiles: 'profiles' })[col] || null;
    },

    /* Progresso com resultado explícito (mesma distinção do workspace). */
    async getProgressResult(id) {
      const c = cliente(); if (!c) return { ok: false, encontrado: false, value: null, error: 'sem cliente' };
      try {
        const { data, error } = await c.from('user_progress').select('data').eq('user_id', id).maybeSingle();
        if (error) { diag('falha ao ler user_progress', error); return { ok: false, encontrado: false, value: null, error }; }
        if (!data) return { ok: true, encontrado: false, value: null };
        return { ok: true, encontrado: true, value: data.data };
      } catch (e) { diag('exceção ao ler user_progress', e); return { ok: false, encontrado: false, value: null, error: e }; }
    },

    async get(col, id) {
      const c = cliente(); if (!c) return null;
      const tab = this._tabela(col);
      if (!tab) return null;
      try {
        if (col === 'progresso') {
          /* Contrato antigo preservado: data | null (null para ausência OU
             falha). A migração usa getProgressResult para diferenciar. */
          const r = await this.getProgressResult(id);
          return r.ok && r.encontrado ? r.value : null;
        }
        if (col === 'profiles') {
          const { data, error } = await c.from(tab).select('*').eq('id', id).maybeSingle();
          if (error) diag('falha ao ler ' + tab, error);
          return data || null;
        }
        return null;
      } catch (e) { diag('exceção ao ler ' + tab, e); return null; }
    },

    async set(col, id, dados) {
      const c = cliente(); if (!c) return false;
      const tab = this._tabela(col);
      if (!tab) return false;
      try {
        if (col === 'progresso') {
          /* Mescla fatos locais com o documento remoto e grava sob trava
             otimista (ver _salvarProgresso): duas máquinas concluindo aulas
             diferentes ao mesmo tempo não podem apagar o progresso uma da
             outra. */
          return await this._salvarProgresso(id, dados);
        }
        if (col === 'profiles') {
          const { error } = await c.from(tab).upsert(Object.assign({ id }, dados), { onConflict: 'id' });
          if (error) diag('falha ao gravar ' + tab, error);
          return !error;
        }
        return false;
      } catch (e) { diag('exceção ao gravar ' + tab, e); return false; }
    },

    /* Núcleo testável da trava otimista do progresso. Recebe um `io` com:
         io.ler()            -> { data, tag } | null   (tag identifica a versão)
         io.gravar(m, tag)   -> { ok:true } | { ok:false, conflito:true } | { ok:false }
       Relê e mescla enquanto a gravação for recusada por conflito (outra
       máquina gravou entre o GET e o UPDATE). Como o merge é monotônico
       (união de aulas/tarefas/dias), converge para o conjunto completo. */
    async _progressoCAS(io, dados) {
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const atual = await io.ler();
        const base = atual && atual.data;
        const merged = (base && LX.ProgressMerge) ? LX.ProgressMerge.merge(base, dados) : dados;
        const r = await io.gravar(merged, atual ? atual.tag : null);
        if (r && r.ok) return true;
        if (!r || !r.conflito) return false;   // erro real: não insiste
      }
      diag('user_progress: conflitos consecutivos ao gravar', null);
      return false;
    },

    async _salvarProgresso(id, dados) {
      const c = cliente(); if (!c) return false;
      try {
        return await this._progressoCAS({
          ler: async () => {
            const { data, error } = await c.from('user_progress')
              .select('data,updated_at').eq('user_id', id).maybeSingle();
            if (error) { diag('falha ao ler user_progress', error); throw error; }
            return data ? { data: data.data, tag: data.updated_at } : null;
          },
          gravar: async (merged, tag) => {
            const agora = new Date().toISOString();
            if (tag === null) {
              /* Ninguém gravou ainda: insert. Se outra aba inserir primeiro, a
                 PK colide (23505) — reler e mesclar. Outros erros (RLS, rede)
                 não viram conflito para não repetir em vão. */
              const { error } = await c.from('user_progress').insert({ user_id: id, data: merged, updated_at: agora });
              if (!error) return { ok: true };
              if (error.code === '23505') return { ok: false, conflito: true };
              diag('falha ao inserir user_progress', error);
              return { ok: false };
            }
            /* Atualiza só se a linha não mudou desde a leitura (trava otimista
               por updated_at, sem coluna nova nem service_role). */
            const { data, error } = await c.from('user_progress')
              .update({ data: merged, updated_at: agora })
              .eq('user_id', id).eq('updated_at', tag).select('user_id');
            if (error) { diag('falha ao gravar user_progress', error); return { ok: false }; }
            return (data && data.length) ? { ok: true } : { ok: false, conflito: true };
          }
        }, dados);
      } catch (e) { diag('exceção ao gravar user_progress', e); return false; }
    },

    /* -------- workspace com revisão (detecção de conflito real) --------
       Leitura com resultado EXPLÍCITO. Distingue três casos que antes eram
       todos `null` — o que é perigoso para decisões irreversíveis (migração):
         { ok:true,  encontrado:true,  value }   registro existe
         { ok:true,  encontrado:false, value:null } não existe (leitura ok)
         { ok:false, encontrado:false, value:null, error } falha na leitura
       Erro NUNCA vira "não encontrado". O diagnóstico fica aqui (camada única). */
    async getWorkspaceResult(uid) {
      const c = cliente(); if (!c) return { ok: false, encontrado: false, value: null, error: 'sem cliente' };
      try {
        const { data, error } = await c.from('workspaces')
          .select('snapshot_version,data,revision,updated_at,device')
          .eq('user_id', uid).maybeSingle();
        if (error) { diag('falha ao ler workspace', error); return { ok: false, encontrado: false, value: null, error }; }
        if (!data) return { ok: true, encontrado: false, value: null };
        return {
          ok: true, encontrado: true, value: {
            version: data.snapshot_version,
            revision: data.revision || 0,
            updatedAt: data.updated_at ? Date.parse(data.updated_at) : 0,
            device: data.device || null,
            snapshot: data.data
          }
        };
      } catch (e) { diag('exceção ao ler workspace', e); return { ok: false, encontrado: false, value: null, error: e }; }
    },

    /* Contrato antigo preservado: workspace | null (null tanto para ausência
       quanto para falha — o restore normal ainda cai no cache local nesses
       casos). Só a migração usa getWorkspaceResult para não confundir os dois. */
    async getWorkspace(uid) {
      const r = await this.getWorkspaceResult(uid);
      return r.ok && r.encontrado ? r.value : null;
    },

    /* Grava só se a revisão base ainda for a atual. Devolve:
         { ok:true, revision }               em caso de sucesso
         { ok:false, conflito:true, atual }  se outro dispositivo passou à frente
         { ok:false, erro }                  em falha de rede */
    async saveWorkspace(uid, doc) {
      const c = cliente(); if (!c) return { ok: false, erro: 'sem cliente' };
      const base = Number(doc.baseRevision || 0);
      const nova = base + 1;
      const linha = {
        user_id: uid,
        snapshot_version: doc.version,
        data: doc.snapshot,
        revision: nova,
        device: doc.device || null,
        updated_at: new Date().toISOString()
      };
      try {
        if (base === 0) {
          /* Primeira gravação: insert. Se já existir, é conflito. */
          const { error } = await c.from('workspaces').insert(linha);
          if (error) {
            const atual = await this.getWorkspace(uid);
            if (atual) return { ok: false, conflito: true, atual };
            diag('insert do workspace recusado', error);
            return { ok: false, erro: error.message };
          }
          return { ok: true, revision: nova };
        }
        /* Update condicionado à revisão base — o coração do optimistic lock. */
        const { data, error } = await c.from('workspaces')
          .update(linha).eq('user_id', uid).eq('revision', base).select('revision');
        if (error) { diag('update do workspace recusado', error); return { ok: false, erro: error.message }; }
        if (!data || !data.length) {
          const atual = await this.getWorkspace(uid);
          return { ok: false, conflito: true, atual };
        }
        return { ok: true, revision: nova };
      } catch (e) {
        diag('exceção ao gravar workspace', e);
        return { ok: false, erro: String(e && e.message || e) };
      }
    }
  };

  /* Ativa o backend em nuvem se estiver configurado e disponível. */
  const Cloud = {
    async ativar() {
      if (!LX.Config.supabaseDisponivel()) return false;
      return !!cliente();
    },
    cliente,
    onAuthChange(cb) {
      const c = cliente(); if (!c) return () => { };
      const { data } = c.auth.onAuthStateChange((ev, sess) => cb(ev, sess));
      return () => { try { data.subscription.unsubscribe(); } catch (e) { } };
    }
  };

  LX.CloudAuth = CloudAuth;
  LX.SupabaseStore = SupabaseStore;
  LX.Cloud = Cloud;
})();

