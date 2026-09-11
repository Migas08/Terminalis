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

    async get(col, id) {
      const c = cliente(); if (!c) return null;
      const tab = this._tabela(col);
      if (!tab) return null;
      try {
        if (col === 'progresso') {
          const { data } = await c.from(tab).select('data').eq('user_id', id).maybeSingle();
          return data ? data.data : null;
        }
        if (col === 'profiles') {
          const { data } = await c.from(tab).select('*').eq('id', id).maybeSingle();
          return data || null;
        }
        return null;
      } catch (e) { return null; }
    },

    async set(col, id, dados) {
      const c = cliente(); if (!c) return false;
      const tab = this._tabela(col);
      if (!tab) return false;
      try {
        if (col === 'progresso') {
          /* Mescla fatos locais com o documento remoto antes do upsert para
             que abas diferentes não apaguem aulas, tarefas ou anotações. */
          const remoto = await this.get(col, id);
          if (remoto && LX.ProgressMerge) dados = LX.ProgressMerge.merge(remoto, dados);
          const { error } = await c.from(tab).upsert(
            { user_id: id, data: dados, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' });
          return !error;
        }
        if (col === 'profiles') {
          const { error } = await c.from(tab).upsert(Object.assign({ id }, dados), { onConflict: 'id' });
          return !error;
        }
        return false;
      } catch (e) { return false; }
    },

    /* -------- workspace com revisão (detecção de conflito real) -------- */
    async getWorkspace(uid) {
      const c = cliente(); if (!c) return null;
      try {
        const { data } = await c.from('workspaces')
          .select('snapshot_version,data,revision,updated_at,device')
          .eq('user_id', uid).maybeSingle();
        if (!data) return null;
        return {
          version: data.snapshot_version,
          revision: data.revision || 0,
          updatedAt: data.updated_at ? Date.parse(data.updated_at) : 0,
          device: data.device || null,
          snapshot: data.data
        };
      } catch (e) { return null; }
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
            return { ok: false, erro: error.message };
          }
          return { ok: true, revision: nova };
        }
        /* Update condicionado à revisão base — o coração do optimistic lock. */
        const { data, error } = await c.from('workspaces')
          .update(linha).eq('user_id', uid).eq('revision', base).select('revision');
        if (error) return { ok: false, erro: error.message };
        if (!data || !data.length) {
          const atual = await this.getWorkspace(uid);
          return { ok: false, conflito: true, atual };
        }
        return { ok: true, revision: nova };
      } catch (e) {
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

