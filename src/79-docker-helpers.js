/* =========================================================================
   TERMINALIS — auxiliares de verificação para as aulas de Docker
   Os desafios olham o estado REAL do motor: existe mesmo esse container?
   ele está mesmo rodando? o volume tem mesmo esse arquivo dentro? a porta
   responde mesmo? Nada aqui compara texto digitado.
   ========================================================================= */
'use strict';
(function () {
  const D = {};
  LX.D = D;

  D.eng = (ctx) => (ctx.machine || ctx.sh.m).docker;

  /* ---------------- containers ---------------- */
  D.container = (ctx, nome) => {
    const e = D.eng(ctx);
    if (!e) return null;
    try { return e.achar(nome); } catch (err) { return null; }
  };
  D.containers = (ctx, filtro) => {
    const e = D.eng(ctx);
    if (!e) return [];
    return Array.from(e.containers.values()).filter(filtro || (() => true));
  };
  D.rodando = (ctx, nome) => { const c = D.container(ctx, nome); return !!c && c.rodando; };
  D.porImagem = (ctx, ref) => D.containers(ctx, c => {
    if (c.imagemRef === ref) return true;
    const img = D.eng(ctx).imagens.get(c.imagemId);
    return !!img && Array.from(img.tags).some(t => t === ref || t.split(':')[0] === ref);
  });
  D.logs = (ctx, nome) => {
    const c = D.container(ctx, nome);
    return c ? c.logs.map(l => l.texto).join('\n') : '';
  };
  D.env = (ctx, nome, chave) => {
    const c = D.container(ctx, nome);
    return c ? c.env[chave] : undefined;
  };
  D.publicada = (ctx, nome, hostPort) => {
    const c = D.container(ctx, nome);
    return !!c && c.portas.some(p => p.hostPort === +hostPort);
  };
  D.montagem = (ctx, nome, destino) => {
    const c = D.container(ctx, nome);
    if (!c) return null;
    return c.montagens.find(mo => LX.FileSystem.normalize(mo.destino) === LX.FileSystem.normalize(destino)) || null;
  };
  D.naRede = (ctx, nome, rede) => {
    const c = D.container(ctx, nome);
    return !!c && c.redes.has(rede);
  };

  /* Lê um arquivo de dentro do container, como root */
  D.leNoContainer = (ctx, nome, caminho) => {
    const c = D.container(ctx, nome);
    if (!c || !c.maquina) return null;
    try { return c.maquina.fs.readFile(caminho, { ctx: c.maquina.ctxRoot() }); }
    catch (err) { return null; }
  };
  D.existeNoContainer = (ctx, nome, caminho) => {
    const c = D.container(ctx, nome);
    if (!c || !c.maquina) return false;
    try { c.maquina.fs.lstat(caminho, { ctx: c.maquina.ctxRoot() }); return true; }
    catch (err) { return false; }
  };
  /* Executa um comando dentro do container e devolve {status, out} */
  D.exec = async (ctx, nome, linha) => {
    const c = D.container(ctx, nome);
    const e = D.eng(ctx);
    if (!c || !e || !c.rodando) return { status: 127, out: '' };
    return await e.execSilencioso(c, linha);
  };

  /* ---------------- imagens, volumes, redes ---------------- */
  D.imagem = (ctx, ref) => { const e = D.eng(ctx); return e ? e.imagemPorRef(ref) : null; };
  D.volume = (ctx, nome) => { const e = D.eng(ctx); return e ? (e.volumes.get(nome) || null) : null; };
  D.rede = (ctx, nome) => { const e = D.eng(ctx); return e ? e.redePorNome(nome) : null; };
  /* Conteúdo de um arquivo dentro de um volume, olhando o disco do host */
  D.noVolume = (ctx, nomeVolume, relativo) => {
    const e = D.eng(ctx);
    const m = ctx.machine || ctx.sh.m;
    if (!e || !e.volumes.has(nomeVolume)) return null;
    const caminho = e.caminhoVolume(nomeVolume) + (relativo.startsWith('/') ? relativo : '/' + relativo);
    try { return m.fs.readFile(caminho, { ctx: m.ctxRoot() }); } catch (err) { return null; }
  };

  /* ---------------- rede vista do host ---------------- */
  /* Uma requisição HTTP de verdade, saindo do host. Devolve null quando a
     conexão é recusada — que também é uma resposta útil para o desafio. */
  D.http = (ctx, host, porta, caminho, cabecalhos) => {
    const m = ctx.machine || ctx.sh.m;
    try {
      return LX.httpRequest(m, host, porta, caminho || '/', 'GET',
        cabecalhos ? { cabecalhos } : undefined);
    } catch (err) { return null; }
  };

  /* ---------------- saúde e composição ---------------- */
  D.saude = async (ctx, nome) => {
    const c = D.container(ctx, nome);
    const e = D.eng(ctx);
    if (!c || !e) return 'none';
    if (!c.saudeConfig) return 'none';
    return await e.avaliarSaude(c);
  };
  D.doProjeto = (ctx, projeto, servico) => D.containers(ctx,
    c => c.projeto === projeto && (!servico || c.servico === servico))[0] || null;

  /* Lê um compose.yaml do disco do aluno e devolve o objeto já analisado */
  D.compose = (ctx, caminho) => {
    const m = ctx.machine || ctx.sh.m;
    let texto;
    try { texto = m.fs.readFile(caminho, { ctx: m.ctxRoot() }); } catch (err) { return null; }
    try { return LX.lerYaml(texto); } catch (err) { return { erroYaml: err.message }; }
  };
  D.dockerfile = (ctx, caminho) => {
    const m = ctx.machine || ctx.sh.m;
    let texto;
    try { texto = m.fs.readFile(caminho, { ctx: m.ctxRoot() }); } catch (err) { return null; }
    return LX.lerDockerfile(texto);
  };
  /* Uma instrução específica do Dockerfile, já analisada */
  D.instrucao = (ctx, caminho, nome) => {
    const d = D.dockerfile(ctx, caminho);
    if (!d || d.erro) return [];
    return d.instrucoes.filter(i => i.nome === nome);
  };

  /* ---------------- montagem de cenários ---------------- */
  /* Sobe um container direto pelo motor, para as aulas que já começam com
     um ambiente pronto (ou quebrado de propósito). */
  D.montar = function (m, spec) {
    const e = m.docker;
    if (!e) return null;
    const existente = spec.nome && e.containerPorNome(spec.nome);
    if (existente) e.remover(existente, { force: true, silencioso: true });
    const r = e.criarContainer(spec);
    if (!r.ok) return null;
    if (spec.parado) return r.container;
    e.iniciar(r.container);
    return r.container;
  };
  D.garantirRede = function (m, nome, opts) {
    const e = m.docker;
    if (!e) return null;
    if (!e.networks.has(nome)) e.criarRede(nome, opts || {});
    return e.networks.get(nome);
  };
  D.limparTudo = function (m) {
    const e = m.docker;
    if (!e) return;
    for (const c of Array.from(e.containers.values())) e.remover(c, { force: true, silencioso: true });
    for (const [nome, r] of Array.from(e.networks)) if (!r.padrao) e.networks.delete(nome);
    for (const [nome] of Array.from(e.volumes)) e.removerVolume(nome, { force: true });
  };
  /* Escreve um arquivo no disco do aluno (usado nos setup das aulas) */
  D.arquivo = function (m, caminho, conteudo, modo) {
    const ctx = m.ctxRoot();
    try {
      m.fs.mkdirp(LX.FileSystem.dirname(caminho), { ctx });
      const n = m.fs.writeFile(caminho, conteudo, { ctx });
      n.mode = modo === undefined ? 0o644 : modo;
      n.uid = 1000; n.gid = 1000;
      return n;
    } catch (e) { return null; }
  };
  D.pasta = function (m, caminho) {
    const ctx = m.ctxRoot();
    try { const n = m.fs.mkdirp(caminho, { ctx }); n.uid = 1000; n.gid = 1000; return n; }
    catch (e) { return null; }
  };
})();
