/* =========================================================================
   TERMINALIS — autenticação e persistência por usuário
   ---------------------------------------------------------------------
   O que este arquivo faz de verdade:
     · guarda contas com senha derivada por PBKDF2-SHA256 (150k iterações,
       salt aleatório de 16 bytes por usuário). A senha em texto puro nunca
       é gravada nem enviada a lugar nenhum.
     · emite um token de sessão de 32 bytes aleatórios; o navegador guarda
       o token, e o armazenamento de contas guarda apenas seu SHA-256.
     · mantém o progresso em um documento por usuário, isolado dos demais.
   Armazenamento: capability "db" do artifact quando disponível (permite
   entrar do celular e do computador com a mesma conta) e localStorage
   como reserva. Ambos os modos usam exatamente o mesmo formato.
   ========================================================================= */
'use strict';
(function () {

  const ITERACOES = 150000;
  const VALIDADE_MS = 30 * 24 * 3600 * 1000;   // 30 dias
  const LS_SESSAO = 'terminalis.sessao.v1';
  const LS_PREFIXO = 'terminalis.dados.v1/';

  const cripto = (typeof self !== 'undefined' && self.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto);

  /* ----------------------------- utilidades ----------------------------- */
  const enc = new TextEncoder();

  function bytesAleatorios(n) {
    const b = new Uint8Array(n);
    cripto.getRandomValues(b);
    return b;
  }
  function paraHex(bytes) {
    let s = '';
    for (const b of bytes) s += b.toString(16).padStart(2, '0');
    return s;
  }
  function deHex(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  async function sha256Hex(texto) {
    const d = await cripto.subtle.digest('SHA-256', enc.encode(texto));
    return paraHex(new Uint8Array(d));
  }
  /* comparação de tempo constante — não vaza o prefixo correto pelo tempo */
  function igualSeguro(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let dif = 0;
    for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return dif === 0;
  }

  /* PBKDF2-SHA256 — a função lenta que transforma a senha em 256 bits */
  async function derivar(senha, saltHex, iteracoes) {
    if (!cripto || !cripto.subtle) throw new Error('Este navegador não expõe WebCrypto; não dá para guardar senhas com segurança aqui.');
    const chave = await cripto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
    const bits = await cripto.subtle.deriveBits(
      { name: 'PBKDF2', salt: deHex(saltHex), iterations: iteracoes, hash: 'SHA-256' }, chave, 256);
    return paraHex(new Uint8Array(bits));
  }

  /* --------------------------- normalizações --------------------------- */
  const normUsuario = (s) => String(s || '').trim().toLowerCase();
  const normEmail = (s) => String(s || '').trim().toLowerCase();
  const USUARIO_OK = /^[a-z0-9][a-z0-9._-]{2,23}$/;
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  /* ============================ armazenamento ============================
     Duas implementações da mesma interface: get/set por coleção + id.
     Nenhuma parte do resto do sistema sabe qual das duas está ativa.
     ===================================================================== */
  const Store = {
    modo: 'local',          // 'local' | 'nuvem'
    db: null,

    async iniciar() {
      try {
        if (typeof claude !== 'undefined' && claude && typeof claude.use === 'function') {
          const db = await claude.use('db');
          if (db) { this.db = db; this.modo = 'nuvem'; }
        }
      } catch (e) { /* segue no localStorage */ }
      return this.modo;
    },

    /* O db devolve documentos congelados (e o localStorage, texto). Em
       qualquer um dos dois casos entregamos uma cópia solta e mutável —
       quem chama precisa poder acrescentar uma sessão ao registro. */
    solta(d) {
      if (d === null || d === undefined) return null;
      try { return JSON.parse(JSON.stringify(d)); } catch (e) { return null; }
    },

    async get(col, id) {
      if (this.db) {
        try {
          const snap = await this.db.doc(col + '/' + id).get();
          if (!snap) return null;
          let d = snap;
          if (typeof snap.data === 'function') d = snap.data();
          else if (snap.data !== undefined) d = snap.data;
          else if (snap.exists === false) return null;
          return this.solta(d) || null;
        } catch (e) { return null; }
      }
      try {
        const raw = localStorage.getItem(LS_PREFIXO + col + '/' + id);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    async set(col, id, dados) {
      const limpo = this.solta(dados) || {};
      if (this.db) {
        try { await this.db.doc(col + '/' + id).set(limpo); return true; }
        catch (e) { console.warn('falha ao gravar ' + col + '/' + id, e); return false; }
      }
      try { localStorage.setItem(LS_PREFIXO + col + '/' + id, JSON.stringify(limpo)); return true; }
      catch (e) { return false; }
    }
  };

  /* =============================== progresso =============================== */
  const PROGRESSO_VAZIO = () => ({
    lessons: {}, tasks: {}, notes: {}, projetos: {},
    desbloqueios: {}, seconds: 0, lastLesson: null, streakDays: [], atualizadoEm: 0
  });

  /* ================================= Auth ================================= */
  const Auth = {
    usuario: null,          // { uid, usuario, email, nome } — nunca contém hash
    progresso: PROGRESSO_VAZIO(),
    modo: 'local',
    backend: 'local',       // 'local' (PBKDF2 neste navegador) | 'supabase' (nuvem)
    _envio: null,
    _pendente: null,

    /* ---------- ciclo de vida ----------
       Escolhe o backend uma única vez: Supabase quando configurado e com o
       SDK carregado; caso contrário, o backend local de sempre. */
    async iniciar() {
      if (LX.Cloud && await LX.Cloud.ativar()) {
        this.backend = 'supabase';
        this.modo = LX.Store.usarSupabase(true);
        return await this.restaurarSessao();
      }
      this.backend = 'local';
      this.modo = await Store.iniciar();
      return await this.restaurarSessao();
    },

    /* Retoma a sessão salva: valida o token contra o hash guardado na conta. */
    async restaurarSessao() {
      if (this.backend === 'supabase') {
        const u = await LX.CloudAuth.restaurarSessao();
        if (!u) return null;
        this.usuario = u;
        this.progresso = await this.lerProgresso(u.uid);
        return u;
      }
      let sess = null;
      try { const raw = localStorage.getItem(LS_SESSAO); if (raw) sess = JSON.parse(raw); } catch (e) { }
      if (!sess || !sess.uid || !sess.token) return null;

      const conta = await Store.get('contas', sess.uid);
      if (!conta) { this.limparSessaoLocal(); return null; }

      const tokenHash = await sha256Hex(sess.token);
      const registro = (conta.sessoes || {})[tokenHash];
      if (!registro || registro.expira < Date.now()) {
        this.limparSessaoLocal();
        if (registro) { delete conta.sessoes[tokenHash]; await Store.set('contas', conta.uid, conta); }
        return null;
      }
      this.usuario = this.publico(conta);
      this.progresso = await this.lerProgresso(conta.uid);
      return this.usuario;
    },

    publico(conta) {
      return { uid: conta.uid, usuario: conta.usuario, email: conta.email, nome: conta.nome, criadoEm: conta.criadoEm };
    },

    limparSessaoLocal() {
      try { localStorage.removeItem(LS_SESSAO); } catch (e) { }
    },

    /* ---------- criação de conta ---------- */
    async criar({ usuario, email, senha, nome }) {
      if (this.backend === 'supabase') {
        const user = await LX.CloudAuth.criar({ usuario, email, senha, nome });
        this.usuario = user;
        this.progresso = await this.lerProgresso(user.uid);
        return user;
      }
      const u = normUsuario(usuario);
      const e = normEmail(email);

      if (!USUARIO_OK.test(u)) throw new ErroAuth('usuario', 'Use de 3 a 24 caracteres: letras, números, ponto, hífen ou _ (começando por letra ou número).');
      if (!EMAIL_OK.test(e)) throw new ErroAuth('email', 'Informe um e-mail válido.');
      if (String(senha || '').length < 8) throw new ErroAuth('senha', 'A senha precisa de pelo menos 8 caracteres.');
      if (String(senha).toLowerCase().includes(u)) throw new ErroAuth('senha', 'A senha não pode conter o seu nome de usuário.');

      if (await Store.get('contas', u)) throw new ErroAuth('usuario', 'Esse nome de usuário já está em uso.');
      const aliasEmail = 'e:' + e;
      if (await Store.get('indice', aliasEmail)) throw new ErroAuth('email', 'Esse e-mail já tem uma conta. Tente entrar.');

      const salt = paraHex(bytesAleatorios(16));
      const hash = await derivar(senha, salt, ITERACOES);

      const conta = {
        uid: u, usuario: u, email: e,
        nome: String(nome || '').trim() || usuario.trim(),
        alg: 'PBKDF2-SHA256', iteracoes: ITERACOES, salt, hash,
        criadoEm: Date.now(), sessoes: {}
      };
      await Store.set('contas', u, conta);
      await Store.set('indice', aliasEmail, { uid: u });
      await Store.set('progresso', u, PROGRESSO_VAZIO());

      return await this.entrar({ login: u, senha });
    },

    /* ---------- login ---------- */
    async entrar({ login, senha, lembrar }) {
      if (this.backend === 'supabase') {
        const user = await LX.CloudAuth.entrar({ login, senha });
        this.usuario = user;
        this.progresso = await this.lerProgresso(user.uid);
        return user;
      }
      const bruto = String(login || '').trim();
      if (!bruto) throw new ErroAuth('login', 'Informe seu usuário ou e-mail.');
      if (!String(senha || '')) throw new ErroAuth('senha', 'Informe sua senha.');

      let uid = normUsuario(bruto);
      if (bruto.includes('@')) {
        const idx = await Store.get('indice', 'e:' + normEmail(bruto));
        uid = idx && idx.uid;
      }
      const conta = uid ? await Store.get('contas', uid) : null;

      /* Mesma mensagem para usuário inexistente e senha errada: não conta
         a quem está tentando qual dos dois campos está certo. E derivamos
         mesmo sem conta, para o tempo de resposta não denunciar nada. */
      const salt = (conta && conta.salt) || paraHex(bytesAleatorios(16));
      const iter = (conta && conta.iteracoes) || ITERACOES;
      const teste = await derivar(senha, salt, iter);
      if (!conta || !igualSeguro(teste, conta.hash || '')) {
        throw new ErroAuth('senha', 'Usuário ou senha incorretos.');
      }

      /* token de sessão: 32 bytes aleatórios. O navegador fica com o token,
         a conta guarda só o SHA-256 dele. */
      const token = paraHex(bytesAleatorios(32));
      const tokenHash = await sha256Hex(token);
      conta.sessoes = conta.sessoes || {};
      const agora = Date.now();
      for (const k of Object.keys(conta.sessoes)) {          // limpeza das expiradas
        if ((conta.sessoes[k].expira || 0) < agora) delete conta.sessoes[k];
      }
      conta.sessoes[tokenHash] = { criadaEm: agora, expira: agora + VALIDADE_MS };
      conta.ultimoAcesso = agora;
      await Store.set('contas', conta.uid, conta);

      try { localStorage.setItem(LS_SESSAO, JSON.stringify({ uid: conta.uid, token })); } catch (e) { }

      this.usuario = this.publico(conta);
      this.progresso = await this.lerProgresso(conta.uid);
      return this.usuario;
    },

    /* ---------- logout ---------- */
    async sair() {
      if (this.backend === 'supabase') {
        await LX.CloudAuth.sair();
        this.usuario = null;
        this.progresso = PROGRESSO_VAZIO();
        return;
      }
      let sess = null;
      try { const raw = localStorage.getItem(LS_SESSAO); if (raw) sess = JSON.parse(raw); } catch (e) { }
      if (sess && sess.uid && sess.token) {
        const conta = await Store.get('contas', sess.uid);
        if (conta && conta.sessoes) {
          delete conta.sessoes[await sha256Hex(sess.token)];   // invalida o token no armazenamento
          await Store.set('contas', conta.uid, conta);
        }
      }
      this.limparSessaoLocal();
      this.usuario = null;
      this.progresso = PROGRESSO_VAZIO();
    },

    /* ---------- progresso por usuário ---------- */
    async lerProgresso(uid) {
      const d = await Store.get('progresso', uid);
      return Object.assign(PROGRESSO_VAZIO(), d || {});
    },

    /* grava com um pequeno atraso para não escrever a cada tecla digitada */
    agendarGravacao(dados) {
      if (!this.usuario) return;
      this._pendente = dados;
      if (this._envio) return;
      this._envio = setTimeout(() => {
        this._envio = null;
        const d = this._pendente; this._pendente = null;
        if (d && this.usuario) Store.set('progresso', this.usuario.uid, d);
      }, 600);
    },

    async gravarAgora(dados) {
      if (!this.usuario) return false;
      if (this._envio) { clearTimeout(this._envio); this._envio = null; this._pendente = null; }
      return await Store.set('progresso', this.usuario.uid, dados);
    },

    /* ---------- recuperação de senha (nuvem) ---------- */
    async recuperarSenha(email) {
      if (this.backend === 'supabase') return await LX.CloudAuth.recuperarSenha(email);
      throw new ErroAuth('email', 'A recuperação por e-mail está disponível apenas no modo nuvem.');
    },

    /* ---------- troca de senha ---------- */
    async trocarSenha(senhaAtual, senhaNova) {
      if (this.backend === 'supabase') return await LX.CloudAuth.trocarSenha(senhaAtual, senhaNova);
      if (!this.usuario) throw new ErroAuth('login', 'Você precisa estar logado.');
      const conta = await Store.get('contas', this.usuario.uid);
      const teste = await derivar(senhaAtual, conta.salt, conta.iteracoes);
      if (!igualSeguro(teste, conta.hash)) throw new ErroAuth('senha', 'Senha atual incorreta.');
      if (String(senhaNova || '').length < 8) throw new ErroAuth('nova', 'A nova senha precisa de pelo menos 8 caracteres.');
      conta.salt = paraHex(bytesAleatorios(16));
      conta.hash = await derivar(senhaNova, conta.salt, ITERACOES);
      conta.iteracoes = ITERACOES;
      conta.sessoes = {};                                   // derruba todas as sessões
      await Store.set('contas', conta.uid, conta);
      this.limparSessaoLocal();
      return true;
    }
  };

  class ErroAuth extends Error {
    constructor(campo, msg) { super(msg); this.campo = campo; }
  }

  LX.Auth = Auth;
  LX.ErroAuth = ErroAuth;
  LX.Store = Store;
  LX.PROGRESSO_VAZIO = PROGRESSO_VAZIO;
})();
