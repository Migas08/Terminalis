/* =========================================================================
   TERMINALIS — configuração central da nuvem (Supabase)
   ---------------------------------------------------------------------
   Único lugar onde vivem a URL e a chave pública do projeto Supabase.
   Nada de segredo entra aqui: a `anonKey` é a chave "anon/public" que o
   próprio Supabase projeta para o navegador. Toda a proteção real é feita
   por Row Level Security no banco (auth.uid() = user_id). NUNCA coloque
   aqui a `service_role` nem qualquer segredo administrativo.

   Como configurar (qualquer uma das formas):

     1. Editar os campos abaixo em `supabase`; ou
     2. Definir `window.TERMINALIS_CONFIG` numa tag script antes do bundle:
          window.TERMINALIS_CONFIG = {
            supabase: { url: 'https://xxxx.supabase.co', anonKey: 'eyJ...' }
          };

   Se nada for configurado, o Terminalis inicia em modo LOCAL/OFFLINE
   normalmente — a nuvem é totalmente opcional.
   ========================================================================= */
'use strict';
(function () {
  const Config = {
    /* Preencha para ligar a sincronização em nuvem. Deixe vazio para
       rodar 100% local (localStorage), como sempre funcionou. */
    supabase: {
      url: '',
      anonKey: ''
    },

    /* Ajustes finos da sincronização automática. */
    sync: {
      workspaceDebounceMs: 1500,   // espera após a última alteração do laboratório
      progressoDebounceMs: 700,    // espera após a última alteração de progresso
      maxSnapshotBytes: 8 * 1024 * 1024,
      dispositivoId: null          // preenchido em runtime (identifica esta aba/máquina)
    }
  };

  /* Permite sobrescrever por window.TERMINALIS_CONFIG sem editar o bundle. */
  try {
    const ext = (typeof window !== 'undefined' && window.TERMINALIS_CONFIG) ||
                (typeof globalThis !== 'undefined' && globalThis.TERMINALIS_CONFIG) || null;
    if (ext && typeof ext === 'object') {
      if (ext.supabase) Object.assign(Config.supabase, ext.supabase);
      if (ext.sync) Object.assign(Config.sync, ext.sync);
    }
  } catch (e) { /* sem window: contexto de teste em Node */ }

  /* Um identificador estável por navegador, só para marcar qual dispositivo
     gravou por último (ajuda a explicar conflitos ao aluno). Não é segredo. */
  Config.dispositivoId = function () {
    if (this.sync.dispositivoId) return this.sync.dispositivoId;
    let id = null;
    try { id = localStorage.getItem('terminalis.dispositivo'); } catch (e) { }
    if (!id) {
      const rnd = (typeof crypto !== 'undefined' && crypto.getRandomValues)
        ? Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('')
        : Math.random().toString(16).slice(2, 14);
      id = 'dev-' + rnd;
      try { localStorage.setItem('terminalis.dispositivo', id); } catch (e) { }
    }
    this.sync.dispositivoId = id;
    return id;
  };

  /* A configuração existe (url + chave pública preenchidas)? */
  Config.supabaseConfigurado = function () {
    return !!(this.supabase.url && this.supabase.anonKey);
  };

  /* Além de configurado, o SDK do Supabase foi carregado no navegador? */
  Config.supabaseDisponivel = function () {
    return this.supabaseConfigurado() &&
      typeof globalThis !== 'undefined' &&
      globalThis.supabase &&
      typeof globalThis.supabase.createClient === 'function';
  };

  LX.Config = Config;
})();
