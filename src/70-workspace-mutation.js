/* =========================================================================
   TERMINALIS — LX.WorkspaceMutation: dirty tracking barato do laboratório
   ---------------------------------------------------------------------
   Antes, descobrir se um comando alterou o ambiente exigia exportar a VM
   inteira e comparar assinaturas — a cada comando, inclusive leituras. Aqui
   um contador de "época" é incrementado apenas nos PONTOS CENTRAIS de mutação.
   Comandos de leitura (ls, cat, ps, git status, docker ps) não tocam nesses
   pontos, então o LX.Sync os ignora sem exportar nada.

   Cobertura das mutações persistentes:
     · conteúdo de arquivos ......... Inode.prototype.write
     · estrutura do sistema de arq .. métodos mutadores do FileSystem
     · metadados (chmod/chown/…) .... markDirty() explícito nos poucos comandos
       que alteram mode/uid/gid direto (o FS não tem um método central p/ isso)
     · processos/serviços/portas .... métodos centrais da Machine
     · Docker (engine) .............. métodos centrais do DockerEngine
     · Git .......................... persistido em arquivo do VFS (write)
     · estado do shell (cd/export) .. o LX.Sync compara uma assinatura pequena
       do shell (barata), fora deste contador

   suspender(fn): desliga o rastreamento durante restauração/importação e no
   append do histórico (que não deve, sozinho, agendar um save) — reconstruir a
   VM a partir de um snapshot nunca pode gerar "dirty" falso.
   ========================================================================= */
'use strict';
(function () {
  const MUT = {
    _epoca: 0,
    _suspenso: 0,
    markDirty() { if (this._suspenso === 0) this._epoca++; return this; },
    epoca() { return this._epoca; },
    suspenso() { return this._suspenso > 0; },
    suspender(fn) {
      this._suspenso++;
      try { return fn(); }
      finally { this._suspenso--; }
    }
  };
  LX.WorkspaceMutation = MUT;

  /* Envolve métodos de um protótipo para marcar dirty após a execução com
     sucesso (se lançar, não marca). Idempotente entre carregamentos. */
  function envolver(proto, nomes) {
    if (!proto) return;
    for (const nome of nomes) {
      const orig = proto[nome];
      if (typeof orig !== 'function' || orig.__wsHook) continue;
      const wrapped = function (...args) {
        const r = orig.apply(this, args);
        if (MUT._suspenso === 0) MUT._epoca++;
        return r;
      };
      wrapped.__wsHook = true;
      proto[nome] = wrapped;
    }
  }

  // conteúdo de arquivos (writeFile/appendFile/create/redirects/truncate)
  envolver(LX.Inode && LX.Inode.prototype, ['write']);

  // estrutura do sistema de arquivos
  envolver(LX.FileSystem && LX.FileSystem.prototype,
    ['mkdir', 'mkdirp', 'create', 'writeFile', 'appendFile', 'symlink', 'link',
      'unlink', 'rmdir', 'rmrf', 'rename', 'copy', 'montarParticao', 'desmontar', 'umount']);

  // subsistemas da máquina fora do VFS (processos, serviços, portas, rede)
  envolver(LX.Machine && LX.Machine.prototype,
    ['spawn', 'kill', 'listen', 'unlisten', 'startUnit', 'stopUnit', 'reload',
      'daemonReload', 'registrarUnidade', 'definirUnidade', 'addRoute', 'delRoute']);

  // Docker: criação/remoção/estado de containers, imagens, volumes e redes
  envolver(LX.DockerEngine && LX.DockerEngine.prototype,
    ['criarContainer', 'iniciar', 'parar', 'remover', 'criarVolume', 'removerVolume',
      'criarRede', 'removerRede', 'removerImagem', 'construir', 'construirImagem',
      'commit', 'etiquetar', 'puxar', 'empurrar', 'podar', 'prune']);
})();
