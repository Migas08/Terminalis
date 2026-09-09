/* =========================================================================
   TERMINALIS — Motor do Docker
   Um daemon de verdade, em miniatura: imagens com camadas, containers com
   sistema de arquivos próprio, volumes que sobrevivem ao container, redes
   com DNS interno e portas publicadas que o host realmente alcança.

   A regra do projeto vale aqui também: nada de fingir. Se a aula manda
   digitar `docker exec -it api sh`, o aluno cai num shell de verdade,
   dentro de um sistema de arquivos de verdade, com processos de verdade.
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, SysError } = LX;

  /* Executa uma linha de comando em um shell qualquer (host ou container).
     É o mesmo interpretador Bash do curso de Linux — o container não
     ganha um shell de mentira só porque está dentro do Docker. */
  LX.rodarLinha = async function (sh, io, linha) {
    const ex = new LX.Executor(sh, io);
    try { return await ex.run(linha); }
    catch (e) {
      if (e && e.isExit) return e.code;
      if (e && e.isParseError) { io.stderr.write('sh: ' + e.message + '\n'); return 2; }
      if (e && e.isLimit) { io.stderr.write(e.message + '\n'); return 1; }
      throw e;
    }
  };

  /* ---------------------------------------------------------------------
     Identificadores no formato do Docker (hex de 64 caracteres)
     --------------------------------------------------------------------- */
  let SEMENTE = 0x2f6d1a7b;
  function hex(n) {
    let s = '';
    while (s.length < n) {
      SEMENTE = (SEMENTE * 1103515245 + 12345) & 0x7fffffff;
      s += SEMENTE.toString(16).padStart(8, '0');
    }
    return s.slice(0, n);
  }
  LX.dockerHex = hex;
  const idLongo = () => hex(64);
  const curto = (id) => id.slice(0, 12);

  /* Nomes automáticos, como os do Docker (adjetivo_cientista) */
  const ADJ = ['adoring', 'brave', 'clever', 'dreamy', 'eager', 'focused', 'gallant', 'happy',
    'jolly', 'keen', 'lucid', 'modest', 'nervous', 'optimistic', 'peaceful', 'quirky',
    'romantic', 'serene', 'trusting', 'vibrant', 'wizardly', 'zealous'];
  const CIENTISTAS = ['turing', 'hopper', 'lovelace', 'ritchie', 'thompson', 'torvalds', 'knuth',
    'curie', 'noether', 'shannon', 'dijkstra', 'hamilton', 'liskov', 'kernighan',
    'stallman', 'wozniak', 'babbage', 'mccarthy', 'backus', 'engelbart'];

  /* ---------------------------------------------------------------------
     Referências de imagem:  [registro/][namespace/]repositorio[:tag|@digest]
     --------------------------------------------------------------------- */
  function analisarRef(ref) {
    let r = String(ref || '').trim();
    let digest = null, tag = null;
    const at = r.indexOf('@');
    if (at > 0) { digest = r.slice(at + 1); r = r.slice(0, at); }
    /* o ":" da tag é o último, e não pode estar antes de uma "/"
       (senão "localhost:5000/app" viraria repositório "localhost" tag "5000/app") */
    const dp = r.lastIndexOf(':');
    if (dp > 0 && r.indexOf('/', dp) === -1) { tag = r.slice(dp + 1); r = r.slice(0, dp); }
    let registro = 'docker.io';
    const partes = r.split('/');
    if (partes.length > 1 && (partes[0].includes('.') || partes[0].includes(':') || partes[0] === 'localhost')) {
      registro = partes.shift();
    }
    let namespace = partes.length > 1 ? partes.slice(0, -1).join('/') : (registro === 'docker.io' ? 'library' : '');
    const repositorio = partes[partes.length - 1];
    if (!tag && !digest) tag = 'latest';
    const nomeCurto = (registro === 'docker.io')
      ? (namespace === 'library' ? repositorio : namespace + '/' + repositorio)
      : registro + '/' + (namespace ? namespace + '/' : '') + repositorio;
    return {
      registro, namespace, repositorio, tag, digest,
      nome: nomeCurto,
      completo: nomeCurto + (digest ? '@' + digest : ':' + tag)
    };
  }
  LX.analisarRefImagem = analisarRef;

  /* =====================================================================
     IMAGEM
     ===================================================================== */
  class Imagem {
    constructor(spec) {
      this.id = spec.id || ('sha256:' + idLongo());
      this.tags = new Set(spec.tags || []);
      this.digest = spec.digest || ('sha256:' + idLongo());
      this.criadaEm = spec.criadaEm || (Date.now() - (spec.diasAtras || 14) * 86400000);
      this.camadas = spec.camadas || [];
      this.os = spec.os || 'linux';
      this.arch = spec.arch || 'amd64';
      this.autor = spec.autor || '';
      this.base = spec.base || null;      // ref da imagem de origem (FROM)
      this.local = !!spec.local;          // construída aqui, não veio do Hub
      this.config = Object.assign({
        Cmd: null, Entrypoint: null, Env: [], ExposedPorts: {}, WorkingDir: '',
        User: '', Labels: {}, Volumes: {}, StopSignal: 'SIGTERM', Healthcheck: null
      }, spec.config || {});
      this._semear = spec.semear || null;
      this.aoIniciar = spec.aoIniciar || null;
      this.encerraSozinha = !!spec.encerraSozinha;
      this.tamanhoExtra = spec.tamanhoExtra || 0;
    }
    get idCurto() { return curto(this.id.replace('sha256:', '')); }
    /* Soma das camadas: é isso que `docker images` mostra em SIZE */
    get tamanho() {
      return this.camadas.reduce((a, c) => a + (c.tamanho || 0), 0) + this.tamanhoExtra;
    }
    get tagPrincipal() { return this.tags.size ? Array.from(this.tags)[0] : '<none>:<none>'; }
    /* Escreve os arquivos da imagem dentro do sistema de arquivos do container */
    semear(cm, engine) {
      if (this.base && engine) {
        const pai = engine.imagemPorRef(this.base);
        if (pai) pai.semear(cm, engine);
      }
      if (this._semear) this._semear(cm, engine, this);
    }
  }
  LX.ImagemDocker = Imagem;

  /* =====================================================================
     CATÁLOGO DO REGISTRY  (o "Docker Hub" deste ambiente)
     ===================================================================== */
  LX.HUB = new Map();
  LX.defimage = function (spec) {
    const def = Object.assign({}, spec);
    for (const t of spec.tags) LX.HUB.set(t, def);
    return def;
  };
  /* Uma camada compartilhada entre imagens tem o MESMO id — é assim que
     `docker system df` consegue dizer que 5 imagens ocupam menos disco
     do que a soma dos seus tamanhos. */
  const CAMADAS = new Map();
  LX.camada = function (chave, tamanho, criadoPor) {
    if (!CAMADAS.has(chave)) CAMADAS.set(chave, { id: 'sha256:' + idLongo(), tamanho, criadoPor, chave });
    const c = CAMADAS.get(chave);
    return { id: c.id, tamanho: c.tamanho, criadoPor: criadoPor || c.criadoPor, chave };
  };

  /* =====================================================================
     CONTAINER
     ===================================================================== */
  class Container {
    constructor(spec) {
      Object.assign(this, spec);
      this.id = spec.id || idLongo();
      this.criadoEm = Date.now();
      this.iniciadoEm = null;
      this.terminadoEm = null;
      this.estado = 'created';
      this.saida = 0;
      this.erro = '';
      this.oom = false;
      this.logs = [];
      this.maquina = null;
      this.pid1 = null;
      this.reinicios = 0;
      this.redes = new Map();
      this.escutas = [];
      this.saude = { estado: this.saudeConfig ? 'starting' : 'none', falhas: 0, log: [] };
      this.inventarioBase = null;
    }
    get curto() { return curto(this.id); }
    /* Status textual do `docker ps`, com a saúde entre parênteses */
    get status() {
      const dt = (ms) => {
        const s = Math.max(1, Math.floor(ms / 1000));
        if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
        const mi = Math.floor(s / 60);
        if (mi < 60) return `${mi} minute${mi === 1 ? '' : 's'}`;
        const h = Math.floor(mi / 60);
        if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`;
        const d = Math.floor(h / 24);
        return `${d} day${d === 1 ? '' : 's'}`;
      };
      if (this.estado === 'created') return 'Created';
      if (this.estado === 'running') {
        let s = `Up ${dt(Date.now() - this.iniciadoEm)}`;
        if (this.saude.estado === 'healthy') s += ' (healthy)';
        else if (this.saude.estado === 'unhealthy') s += ' (unhealthy)';
        else if (this.saude.estado === 'starting') s += ' (health: starting)';
        return s;
      }
      if (this.estado === 'paused') return `Up ${dt(Date.now() - this.iniciadoEm)} (Paused)`;
      if (this.estado === 'restarting') return `Restarting (${this.saida}) ${dt(Date.now() - (this.terminadoEm || Date.now()))} ago`;
      if (this.estado === 'dead') return 'Dead';
      return `Exited (${this.saida}) ${dt(Date.now() - (this.terminadoEm || Date.now()))} ago`;
    }
    get rodando() { return this.estado === 'running'; }
    /* Texto das portas como o `docker ps` imprime */
    get portasTexto() {
      if (!this.rodando) return '';
      const pub = this.portas.map(p =>
        `${p.hostIp === '0.0.0.0' ? '0.0.0.0' : p.hostIp}:${p.hostPort}->${p.contPort}/${p.proto}`);
      const expostas = Object.keys(this.expostas || {})
        .filter(k => !this.portas.some(p => `${p.contPort}/${p.proto}` === k));
      return pub.concat(expostas).join(', ');
    }
    registrar(texto, fluxo = 'stdout') {
      for (const linha of String(texto).split('\n')) {
        if (linha === '' && this.logs.length && this.logs[this.logs.length - 1].texto === '') continue;
        this.logs.push({ ts: Date.now(), fluxo, texto: linha });
      }
      if (this.logs.length > 3000) this.logs.splice(0, 800);
    }
    /* O primeiro IP do container, na ordem em que as redes foram ligadas */
    get ip() {
      for (const [, cfg] of this.redes) if (cfg.ip) return cfg.ip;
      return '';
    }
    nomesNaRede(rede) {
      const cfg = this.redes.get(rede);
      const lista = [this.nome, this.curto];
      if (this.servico) lista.push(this.servico);
      if (cfg && cfg.aliases) lista.push(...cfg.aliases);
      if (this.hostname) lista.push(this.hostname);
      return Array.from(new Set(lista.filter(Boolean)));
    }
  }
  LX.ContainerDocker = Container;

  /* =====================================================================
     O MOTOR
     ===================================================================== */
  class DockerEngine {
    constructor(machine) {
      this.m = machine;
      this.imagens = new Map();
      this.containers = new Map();
      this.volumes = new Map();
      this.networks = new Map();
      this.eventos = [];
      this.projetos = new Map();
      this.login = null;
      this.versao = { cliente: '29.7.0', servidor: '29.7.0', api: '1.52', compose: 'v5.1.3', buildx: 'v0.32.0' };
      this._nomeSeq = 0;
      this._subrede = 18;
      this._prepararHost();
      this._redesPadrao();
    }

    /* ----------------------------------------------------------------
       Estrutura do daemon no disco do host. O aluno pode olhar com
       `sudo ls /var/lib/docker` — e é bom que possa: isso desfaz a
       ideia de que container é mágica.
       ---------------------------------------------------------------- */
    _prepararHost() {
      const ctx = this.m.ctxRoot();
      for (const d of ['/var/lib/docker', '/var/lib/docker/volumes', '/var/lib/docker/containers',
        '/var/lib/docker/image', '/var/lib/docker/overlay2', '/var/lib/docker/network', '/etc/docker']) {
        try { const n = this.m.fs.mkdirp(d, { ctx }); n.mode = d === '/var/lib/docker' ? 0o710 : 0o700; } catch (e) { }
      }
      try {
        const s = this.m.fs.writeFile('/var/run/docker.sock', '', { ctx });
        s.type = 'sock'; s.mode = 0o660; s.gid = this._gidDocker();
      } catch (e) { }
    }
    _gidDocker() {
      const g = this.m.groups && this.m.groups().find(x => x.name === 'docker');
      return g ? g.gid : 0;
    }

    _redesPadrao() {
      this.criarRede('bridge', { driver: 'bridge', subnet: '172.17.0.0/16', gateway: '172.17.0.1', padrao: true, dnsInterno: false });
      this.criarRede('host', { driver: 'host', padrao: true });
      this.criarRede('none', { driver: 'null', padrao: true });
    }

    evento(tipo, acao, ator, atributos = {}) {
      this.eventos.push({ ts: Date.now(), tipo, acao, ator, atributos });
      if (this.eventos.length > 800) this.eventos.splice(0, 200);
    }

    /* ================================================================
       IMAGENS
       ================================================================ */
    imagemPorRef(ref) {
      if (!ref) return null;
      const r = analisarRef(ref);
      /* por id (completo ou abreviado) */
      const bruto = String(ref).replace(/^sha256:/, '');
      if (/^[0-9a-f]{6,64}$/.test(bruto)) {
        for (const img of this.imagens.values()) {
          if (img.id.replace('sha256:', '').startsWith(bruto)) return img;
        }
      }
      if (r.digest) {
        for (const img of this.imagens.values()) if (img.digest === r.digest) return img;
        return null;
      }
      for (const img of this.imagens.values()) {
        if (img.tags.has(r.nome + ':' + r.tag)) return img;
      }
      return null;
    }

    /* `docker pull` — devolve as camadas para o CLI desenhar o progresso */
    puxar(ref, opts = {}) {
      const r = analisarRef(ref);
      const chave = r.nome + ':' + r.tag;
      const jaTem = this.imagemPorRef(chave);
      const def = LX.HUB.get(chave) || LX.HUB.get(r.repositorio + ':' + r.tag);
      if (!def) {
        if (r.registro !== 'docker.io') {
          /* registry privado rodando em um container local: se a imagem foi
             enviada para ele com `docker push`, o pull de volta a recupera. */
          for (const c of this.containers.values()) {
            if (!c.rodando || !c.registroBlobs) continue;
            const pub = (c.portas || []).find(p => p.contPort === 5000);
            if (!pub) continue;
            if (r.registro !== `localhost:${pub.hostPort}` && r.registro !== `127.0.0.1:${pub.hostPort}`) continue;
            const local = (r.namespace ? r.namespace + '/' : '') + r.repositorio + ':' + r.tag;
            const img = c.registroBlobs.get(local);
            if (img) { img.tags.add(chave); this.imagens.set(img.id, img); this.evento('image', 'pull', chave, {}); return { ok: true, imagem: img, camadas: img.camadas, ref: chave, jaExistia: false }; }
          }
          return { ok: false, erro: `Error response from daemon: Get "https://${r.registro}/v2/": dial tcp: lookup ${r.registro}: no such host` };
        }
        /* repositório existe mas a tag não? O Docker distingue os dois casos. */
        const temRepo = Array.from(LX.HUB.keys()).some(k => k.split(':')[0] === r.nome);
        if (temRepo) return { ok: false, erro: `Error response from daemon: manifest for ${chave} not found: manifest unknown: manifest unknown`, tagRuim: true };
        return { ok: false, erro: `Error response from daemon: pull access denied for ${r.nome}, repository does not exist or may require 'docker login': denied: requested access to the resource is denied` };
      }
      if (jaTem && !opts.forcar) {
        jaTem.tags.add(chave);
        return { ok: true, imagem: jaTem, jaExistia: true, ref: chave };
      }
      const img = this._materializar(def, chave);
      return { ok: true, imagem: img, camadas: img.camadas, ref: chave, jaExistia: false };
    }

    _materializar(def, chave) {
      /* imagens com camadas em comum reaproveitam o mesmo id de camada */
      const camadas = (def.camadas || []).map(c => LX.camada(c.chave, c.tamanho, c.criadoPor));
      const existente = Array.from(this.imagens.values()).find(i => i._defChave === def.tags[0]);
      if (existente) { existente.tags.add(chave); return existente; }
      const img = new Imagem({
        id: def.id || ('sha256:' + idLongo()),
        tags: [chave], digest: def.digest, camadas,
        diasAtras: def.diasAtras, config: def.config, semear: def.semear,
        aoIniciar: def.aoIniciar, encerraSozinha: def.encerraSozinha,
        os: def.os, arch: def.arch, autor: def.autor
      });
      img._defChave = def.tags[0];
      img._def = def;
      this.imagens.set(img.id, img);
      this.evento('image', 'pull', chave, {});
      return img;
    }

    /* Garante a imagem localmente, puxando se preciso (é o que `run` faz) */
    garantirImagem(ref, opts = {}) {
      const politica = opts.pull || 'missing';
      if (politica === 'never') {
        const i = this.imagemPorRef(ref);
        return i ? { ok: true, imagem: i, jaExistia: true } : { ok: false, erro: `Error response from daemon: No such image: ${ref}` };
      }
      if (politica !== 'always') {
        const i = this.imagemPorRef(ref);
        if (i) return { ok: true, imagem: i, jaExistia: true };
      }
      return this.puxar(ref, { forcar: politica === 'always' });
    }

    /* Uma tag aponta para UMA imagem. Quando outra assume o nome, a antiga
       fica sem tag e vira <none> — é assim que nascem as imagens órfãs de
       quem reconstrói sempre com a mesma tag. */
    desmarcarOutras(tag, exceto) {
      for (const img of this.imagens.values()) {
        if (img === exceto) continue;
        if (img.tags.has(tag)) img.tags.delete(tag);
      }
    }

    marcar(refOrigem, refDestino) {
      const img = this.imagemPorRef(refOrigem);
      if (!img) return { ok: false, erro: `Error response from daemon: No such image: ${refOrigem}` };
      const d = analisarRef(refDestino);
      this.desmarcarOutras(d.nome + ':' + d.tag, img);
      img.tags.add(d.nome + ':' + d.tag);
      this.evento('image', 'tag', d.nome + ':' + d.tag, {});
      return { ok: true, imagem: img };
    }

    removerImagem(ref, opts = {}) {
      const img = this.imagemPorRef(ref);
      if (!img) return { ok: false, erro: `Error response from daemon: No such image: ${ref}` };
      const usando = Array.from(this.containers.values()).filter(c => c.imagemId === img.id);
      if (usando.length && !opts.force) {
        const c = usando[0];
        return {
          ok: false,
          erro: `Error response from daemon: conflict: unable to remove repository reference "${ref}" ` +
            `(must force) - container ${c.curto} is using its referenced image ${img.idCurto}`
        };
      }
      const r = analisarRef(ref);
      const tagAlvo = r.nome + ':' + r.tag;
      const eraId = /^(sha256:)?[0-9a-f]{6,64}$/.test(String(ref));
      /* Com várias tags, remover uma tag só "desmarca" — a imagem fica */
      if (!eraId && img.tags.size > 1 && img.tags.has(tagAlvo)) {
        img.tags.delete(tagAlvo);
        return { ok: true, untagged: [tagAlvo], deleted: [] };
      }
      const tags = Array.from(img.tags);
      this.imagens.delete(img.id);
      this.evento('image', 'delete', tags[0] || img.idCurto, {});
      return { ok: true, untagged: tags, deleted: [img.id].concat(img.camadas.map(c => c.id)) };
    }

    /* ================================================================
       VOLUMES — pastas de verdade no disco do host
       ================================================================ */
    caminhoVolume(nome) { return `/var/lib/docker/volumes/${nome}/_data`; }

    criarVolume(nome, opts = {}) {
      if (!nome) nome = hex(64);
      if (this.volumes.has(nome)) return this.volumes.get(nome);
      const ctx = this.m.ctxRoot();
      const dir = this.caminhoVolume(nome);
      try {
        this.m.fs.mkdirp(dir, { ctx });
        const n = this.m.fs.stat(dir, { ctx });
        n.mode = 0o755; n.uid = 0; n.gid = 0;
        const pai = this.m.fs.stat(`/var/lib/docker/volumes/${nome}`, { ctx });
        pai.mode = 0o700;
      } catch (e) { }
      const v = {
        nome, driver: opts.driver || 'local', escopo: 'local',
        montagem: dir, criadoEm: Date.now(),
        labels: opts.labels || {}, opcoes: opts.opcoes || {},
        anonimo: !!opts.anonimo, projeto: opts.projeto || null
      };
      this.volumes.set(nome, v);
      this.evento('volume', 'create', nome, {});
      return v;
    }
    volumeEmUso(nome) {
      return Array.from(this.containers.values()).filter(c =>
        c.montagens.some(mo => mo.tipo === 'volume' && mo.nome === nome));
    }
    removerVolume(nome, opts = {}) {
      const v = this.volumes.get(nome);
      if (!v) return { ok: false, erro: `Error response from daemon: get ${nome}: no such volume` };
      const usos = this.volumeEmUso(nome);
      if (usos.length && !opts.force) {
        return { ok: false, erro: `Error response from daemon: remove ${nome}: volume is in use - [${usos.map(c => c.id).join(', ')}]` };
      }
      try { this.m.fs.rmrf(`/var/lib/docker/volumes/${nome}`, { ctx: this.m.ctxRoot() }); } catch (e) { }
      this.volumes.delete(nome);
      this.evento('volume', 'destroy', nome, {});
      return { ok: true };
    }
    tamanhoVolume(nome) {
      const dir = this.caminhoVolume(nome);
      const fs = this.m.fs, ctx = this.m.ctxRoot();
      const soma = (p) => {
        let st; try { st = fs.lstat(p, { cwd: '/', ctx }); } catch (e) { return 0; }
        if (st.type !== 'dir') return st.size || 0;
        let t = 0, itens = [];
        try { itens = fs.readdir(p, { cwd: '/', ctx }); } catch (e) { return 0; }
        for (const it of itens) {
          const nm = typeof it === 'string' ? it : it.name;
          if (nm === '.' || nm === '..') continue;
          t += soma(p + '/' + nm);
        }
        return t;
      };
      return soma(dir);
    }

    /* ================================================================
       REDES
       ================================================================ */
    criarRede(nome, opts = {}) {
      if (this.networks.has(nome)) return { ok: false, erro: `Error response from daemon: network with name ${nome} already exists` };
      const driver = opts.driver || 'bridge';
      let subnet = opts.subnet || null, gateway = opts.gateway || null;
      if (driver === 'bridge' && !subnet) {
        subnet = `172.${this._subrede}.0.0/16`;
        gateway = `172.${this._subrede}.0.1`;
        this._subrede++;
      }
      if (subnet && !gateway) gateway = subnet.replace(/\.0\.0\/\d+$/, '.0.1').replace(/\.0\/\d+$/, '.1');
      const rede = {
        id: idLongo(), nome, driver, escopo: 'local',
        subnet, gateway, interno: !!opts.interno, attachable: !!opts.attachable,
        padrao: !!opts.padrao, criadaEm: Date.now(), labels: opts.labels || {},
        projeto: opts.projeto || null,
        /* Só rede definida pelo usuário tem o resolvedor do Docker.
           A bridge padrão não resolve nomes — e essa é a causa nº 1 de
           "por que a API não acha o banco". */
        dnsInterno: opts.dnsInterno !== undefined ? opts.dnsInterno : driver === 'bridge' && !opts.padrao,
        containers: new Map(),
        _proxIp: 2
      };
      this.networks.set(nome, rede);
      if (!opts.padrao) this.evento('network', 'create', nome, {});
      return { ok: true, rede };
    }
    redePorNome(x) {
      if (this.networks.has(x)) return this.networks.get(x);
      for (const r of this.networks.values()) if (r.id.startsWith(x) && x.length >= 6) return r;
      return null;
    }
    removerRede(nome) {
      const r = this.redePorNome(nome);
      if (!r) return { ok: false, erro: `Error response from daemon: network ${nome} not found` };
      if (r.padrao) return { ok: false, erro: `Error response from daemon: ${nome} is a pre-defined network and cannot be removed` };
      if (r.containers.size) {
        const nomes = Array.from(r.containers.keys()).map(id => (this.containers.get(id) || {}).nome || id);
        return { ok: false, erro: `Error response from daemon: error while removing network: network ${r.nome} id ${r.id} has active endpoints` , ativos: nomes };
      }
      this.networks.delete(r.nome);
      this.evento('network', 'destroy', r.nome, {});
      return { ok: true };
    }
    conectar(nomeRede, c, opts = {}) {
      const r = this.redePorNome(nomeRede);
      if (!r) return { ok: false, erro: `Error response from daemon: network ${nomeRede} not found` };
      if (c.redes.has(r.nome)) return { ok: false, erro: `Error response from daemon: endpoint with name ${c.nome} already exists in network ${r.nome}` };
      let ip = '';
      if (r.driver === 'bridge') {
        ip = opts.ip || r.subnet.replace(/\.0\.0\/\d+$/, '.0.' + (r._proxIp++));
      }
      const cfg = { ip, aliases: (opts.aliases || []).slice(), gateway: r.gateway };
      c.redes.set(r.nome, cfg);
      r.containers.set(c.id, cfg);
      this._sincronizarRede(c);
      this.evento('network', 'connect', r.nome, { container: c.id });
      return { ok: true, ip };
    }
    desconectar(nomeRede, c) {
      const r = this.redePorNome(nomeRede);
      if (!r) return { ok: false, erro: `Error response from daemon: network ${nomeRede} not found` };
      if (!c.redes.has(r.nome)) return { ok: false, erro: `Error response from daemon: container ${c.curto} is not connected to network ${r.nome}` };
      c.redes.delete(r.nome);
      r.containers.delete(c.id);
      this._sincronizarRede(c);
      this.evento('network', 'disconnect', r.nome, { container: c.id });
      return { ok: true };
    }
    /* Reflete as redes do container nas interfaces que ele enxerga por dentro */
    _sincronizarRede(c) {
      if (!c.maquina) return;
      const ifaces = [c.maquina.interfaces[0]];
      let i = 0;
      for (const [nomeRede, cfg] of c.redes) {
        if (!cfg.ip) continue;
        const rede = this.networks.get(nomeRede);
        ifaces.push({
          name: i === 0 ? 'eth0' : 'eth' + i, mac: '02:42:' + cfg.ip.split('.').map(n => (+n).toString(16).padStart(2, '0')).join(':'),
          ipv4: cfg.ip + '/' + (rede && rede.subnet ? rede.subnet.split('/')[1] : '16'),
          state: 'UP', mtu: 1500, flags: 'BROADCAST,MULTICAST,UP,LOWER_UP', rx: 12043, tx: 8221, gw: cfg.gateway
        });
        i++;
      }
      c.maquina.interfaces = ifaces;
      c.maquina.routes = [];
      if (ifaces[1]) {
        c.maquina.routes.push({ dst: 'default', via: ifaces[1].gw, dev: 'eth0', proto: 'static', metric: 0 });
        for (let k = 1; k < ifaces.length; k++) {
          const rede = this.networks.get(Array.from(c.redes.keys())[k - 1]);
          if (rede && rede.subnet) c.maquina.routes.push({ dst: rede.subnet, dev: ifaces[k].name, proto: 'kernel', scope: 'link', src: ifaces[k].ipv4.split('/')[0] });
        }
      }
    }

    /* ================================================================
       CRIAR / INICIAR / PARAR CONTAINERS
       ================================================================ */
    nomeAutomatico() {
      for (let t = 0; t < 200; t++) {
        const n = ADJ[(SEMENTE = (SEMENTE * 1103515245 + 12345) & 0x7fffffff) % ADJ.length] + '_' +
          CIENTISTAS[(SEMENTE = (SEMENTE * 1103515245 + 12345) & 0x7fffffff) % CIENTISTAS.length];
        if (!this.containerPorNome(n)) return n;
      }
      return 'container_' + (++this._nomeSeq);
    }
    containerPorNome(nome) {
      for (const c of this.containers.values()) if (c.nome === nome) return c;
      return null;
    }
    /* Aceita nome, id completo ou id abreviado (mínimo de 1 caractere, como o Docker) */
    achar(x) {
      if (!x) return null;
      const porNome = this.containerPorNome(x);
      if (porNome) return porNome;
      const cand = Array.from(this.containers.values()).filter(c => c.id.startsWith(x));
      if (cand.length === 1) return cand[0];
      if (cand.length > 1) { const e = new Error('ambiguo'); e.ambiguo = true; throw e; }
      return null;
    }

    criarContainer(spec) {
      const g = this.garantirImagem(spec.imagem, { pull: spec.pull });
      if (!g.ok) return { ok: false, erro: g.erro };
      const img = g.imagem;

      const nome = spec.nome || this.nomeAutomatico();
      if (spec.nome && this.containerPorNome(spec.nome)) {
        const outro = this.containerPorNome(spec.nome);
        return {
          ok: false,
          erro: `docker: Error response from daemon: Conflict. The container name "/${spec.nome}" is already in use by container "${outro.id}". ` +
            `You have to remove (or rename) that container to be able to reuse that name.`
        };
      }
      if (spec.nome && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(spec.nome)) {
        return { ok: false, erro: `docker: Error response from daemon: Invalid container name (${spec.nome}), only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed` };
      }

      /* variáveis: as da imagem primeiro, depois as do usuário */
      const env = {};
      for (const e of (img.config.Env || [])) { const i = e.indexOf('='); if (i > 0) env[e.slice(0, i)] = e.slice(i + 1); }
      Object.assign(env, spec.env || {});

      const entrypoint = spec.entrypoint !== undefined ? spec.entrypoint : (img.config.Entrypoint || null);
      let cmd = spec.cmd && spec.cmd.length ? spec.cmd : (img.config.Cmd || null);
      /* Sobrescrever o entrypoint sem dar um novo comando zera o CMD da
         imagem — senão `--entrypoint sh` receberia os argumentos do CMD
         antigo e o aluno veria um erro sem explicação. */
      if (spec.entrypoint !== undefined && (!spec.cmd || !spec.cmd.length)) cmd = null;

      const c = new Container({
        nome, imagemId: img.id, imagemRef: spec.imagem,
        cmd: cmd || [], entrypoint: entrypoint || [], env,
        labels: Object.assign({}, img.config.Labels, spec.labels || {}),
        portas: [], portasPedidas: spec.portas || [], publicarTudo: !!spec.publicarTudo,
        expostas: Object.assign({}, img.config.ExposedPorts, spec.expostas || {}),
        montagensPedidas: spec.montagens || [],
        montagens: [],
        redesPedidas: spec.redes && spec.redes.length ? spec.redes : null,
        hostname: spec.hostname || null,
        usuario: spec.usuario || img.config.User || 'root',
        workdir: spec.workdir || img.config.WorkingDir || '/',
        somenteLeitura: !!spec.somenteLeitura,
        tty: !!spec.tty, interativo: !!spec.interativo,
        autoRemover: !!spec.autoRemover,
        recursos: Object.assign({ cpus: null, memoria: null, memoriaReserva: null, pidsLimit: null }, spec.recursos || {}),
        restart: Object.assign({ politica: 'no', maxTentativas: 0 }, spec.restart || {}),
        saudeConfig: spec.saude !== undefined ? spec.saude : (img.config.Healthcheck || null),
        capAdd: spec.capAdd || [], capDrop: spec.capDrop || [],
        securityOpt: spec.securityOpt || [],
        privilegiado: !!spec.privilegiado,
        projeto: spec.projeto || null, servico: spec.servico || null,
        dependeDe: spec.dependeDe || [],
        stopSignal: spec.stopSignal || img.config.StopSignal || 'SIGTERM'
      });
      if (!c.hostname) c.hostname = c.curto;

      if (c.autoRemover && c.restart.politica !== 'no') {
        return { ok: false, erro: `docker: Error response from daemon: Conflicting options: --restart and --rm.` };
      }

      /* --- sistema de arquivos do container --- */
      const cm = new LX.Machine({ container: true, hostname: c.hostname, uptime: 0 });
      LX.installBinaries(cm);
      cm.docker = null;
      cm._container = c;
      cm._host = this.m;
      c.maquina = cm;
      img.semear(cm, this);
      this._escreverHosts(c);
      c.inventarioBase = this._inventario(cm);

      /* --- montagens --- */
      const errMont = this._montar(c, img);
      if (errMont) { return { ok: false, erro: errMont }; }

      /* --- redes --- */
      this.containers.set(c.id, c);
      const alvo = c.redesPedidas || ['bridge'];
      for (const r of alvo) {
        const nomeRede = typeof r === 'string' ? r : r.nome;
        const cfg = typeof r === 'string' ? {} : r;
        if (nomeRede === 'none' || nomeRede === 'host') { c.redes.set(nomeRede, { ip: '', aliases: [] }); continue; }
        const res = this.conectar(nomeRede, c, cfg);
        if (!res.ok) { this.containers.delete(c.id); return { ok: false, erro: res.erro }; }
      }
      this._sincronizarRede(c);
      this._escreverHosts(c);

      /* --- portas publicadas --- */
      for (const p of c.portasPedidas) {
        c.portas.push({
          hostIp: p.hostIp || '0.0.0.0',
          hostPort: p.hostPort || this._portaLivre(),
          contPort: p.contPort, proto: p.proto || 'tcp'
        });
      }
      if (c.publicarTudo) {
        for (const chave of Object.keys(c.expostas)) {
          const [cp, proto] = chave.split('/');
          if (c.portas.some(x => x.contPort === +cp)) continue;
          c.portas.push({ hostIp: '0.0.0.0', hostPort: this._portaLivre(), contPort: +cp, proto: proto || 'tcp' });
        }
      }

      /* pasta do container no host, como o Docker faz de verdade */
      try {
        const d = `/var/lib/docker/containers/${c.id}`;
        this.m.fs.mkdirp(d, { ctx: this.m.ctxRoot() });
        this.m.fs.writeFile(`${d}/hostname`, c.hostname + '\n', { ctx: this.m.ctxRoot() });
      } catch (e) { }

      this.evento('container', 'create', c.nome, { image: c.imagemRef });
      return { ok: true, container: c };
    }

    _portaLivre() {
      for (let p = 32768; p < 61000; p++) if (!this.m.portInUse(p)) return p;
      return 32768;
    }

    /* /etc/hosts do container: ele mesmo e o gateway */
    _escreverHosts(c) {
      if (!c.maquina) return;
      const linhas = ['127.0.0.1\tlocalhost', '::1\tlocalhost ip6-localhost ip6-loopback',
        'fe00::0\tip6-localnet', 'ff00::0\tip6-mcastprefix', 'ff02::1\tip6-allnodes', 'ff02::2\tip6-allrouters'];
      if (c.ip) linhas.push(`${c.ip}\t${c.hostname}`);
      try { c.maquina.fs.writeFile('/etc/hosts', linhas.join('\n') + '\n', { ctx: c.maquina.ctxRoot() }).mode = 0o644; } catch (e) { }
    }

    /* Aplica volumes, bind mounts e tmpfs no sistema de arquivos do container */
    _montar(c, img) {
      const cm = c.maquina, ctxC = cm.ctxRoot(), ctxH = this.m.ctxRoot();
      const pedidas = c.montagensPedidas.slice();

      /* VOLUME declarado no Dockerfile e não coberto por uma montagem
         explícita vira volume anônimo — é assim que um `docker run mariadb`
         sem -v ainda guarda os dados em algum lugar. */
      for (const dest of Object.keys(img.config.Volumes || {})) {
        if (pedidas.some(mo => FileSystem.normalize(mo.destino) === FileSystem.normalize(dest))) continue;
        pedidas.push({ tipo: 'volume', nome: null, destino: dest, anonimo: true });
      }

      for (const mo of pedidas) {
        const destino = FileSystem.normalize(mo.destino);
        if (destino === '/') return `docker: Error response from daemon: invalid mount config: destination can't be '/'.`;

        if (mo.tipo === 'tmpfs') {
          try { cm.fs.mkdirp(destino, { ctx: ctxC }); } catch (e) { }
          cm.fs.mounts.push({ dev: 'tmpfs', mount: destino, type: 'tmpfs', opts: 'rw,nosuid,nodev,noexec,relatime', sizeKb: mo.tamanhoKb || 65536, usedKb: 0 });
          c.montagens.push({ tipo: 'tmpfs', destino, ro: false });
          /* tmpfs continua gravável mesmo com a raiz somente leitura */
          (cm.fs.tmpfs || (cm.fs.tmpfs = [])).push(destino);
          continue;
        }

        if (mo.tipo === 'bind') {
          const origem = FileSystem.normalize(mo.origem);
          let st = null;
          try { st = this.m.fs.lstat(origem, { ctx: ctxH }); } catch (e) { }
          if (!st) {
            /* -v cria o diretório que falta; --mount recusa. A diferença
               é real e responde pelo clássico "apareceu uma pasta vazia". */
            if (mo.criarSeFaltar === false) {
              return `docker: Error response from daemon: invalid mount config for type "bind": ` +
                `bind source path does not exist: ${origem}`;
            }
            try { this.m.fs.mkdirp(origem, { ctx: ctxH }); st = this.m.fs.lstat(origem, { ctx: ctxH }); } catch (e) { }
          }
          if (st && st.type === 'dir') {
            try { cm.fs.mkdirp(destino, { ctx: ctxC }); } catch (e) { }
            cm.fs.montarGraft(destino, this.m.fs, origem, { ro: !!mo.ro, tipo: 'bind', origem });
          } else {
            /* bind de arquivo único: caso comum de nginx.conf e compose.yaml */
            try { cm.fs.mkdirp(FileSystem.dirname(destino), { ctx: ctxC }); } catch (e) { }
            cm.fs.montarGraft(destino, this.m.fs, origem, { ro: !!mo.ro, tipo: 'bind', origem, arquivo: true });
          }
          cm.fs.mounts.push({ dev: '/dev/vda2', mount: destino, type: 'ext4', opts: (mo.ro ? 'ro' : 'rw') + ',relatime', sizeKb: 20508296, usedKb: 3150000 });
          c.montagens.push({ tipo: 'bind', origem, destino, ro: !!mo.ro });
          continue;
        }

        /* volume nomeado (ou anônimo) */
        let nome = mo.nome;
        if (!nome) nome = hex(64);
        const novo = !this.volumes.has(nome);
        const v = this.criarVolume(nome, { anonimo: !!mo.anonimo || !mo.nome, projeto: c.projeto });
        const dirHost = v.montagem;
        /* Volume NOVO e vazio montado sobre um diretório que tem conteúdo:
           o Docker copia o conteúdo para dentro do volume. É por isso que
           um mariadb novo já sobe com o banco de sistema pronto. */
        if (novo) this._copiarParaVolume(cm, destino, dirHost);
        try { cm.fs.mkdirp(destino, { ctx: ctxC }); } catch (e) { }
        cm.fs.montarGraft(destino, this.m.fs, dirHost, { ro: !!mo.ro, tipo: 'volume', nome, origem: dirHost });
        cm.fs.mounts.push({ dev: '/dev/vda2', mount: destino, type: 'ext4', opts: (mo.ro ? 'ro' : 'rw') + ',relatime', sizeKb: 20508296, usedKb: 3150000 });
        c.montagens.push({ tipo: 'volume', nome, origem: dirHost, destino, ro: !!mo.ro, anonimo: v.anonimo });
      }
      return null;
    }

    _copiarParaVolume(cm, dentro, dirHost) {
      const ctxC = cm.ctxRoot(), ctxH = this.m.ctxRoot();
      let st = null;
      try { st = cm.fs.lstat(dentro, { ctx: ctxC }); } catch (e) { return; }
      if (!st || st.type !== 'dir') return;
      const copia = (de, para) => {
        let itens = [];
        try { itens = cm.fs.readdir(de, { ctx: ctxC }); } catch (e) { return; }
        for (const it of itens) {
          const nm = typeof it === 'string' ? it : it.name;
          if (nm === '.' || nm === '..') continue;
          let s; try { s = cm.fs.lstat(de + '/' + nm, { ctx: ctxC }); } catch (e) { continue; }
          if (s.type === 'dir') {
            try { const n = this.m.fs.mkdirp(para + '/' + nm, { ctx: ctxH }); n.mode = s.mode; n.uid = s.uid; n.gid = s.gid; } catch (e) { }
            copia(de + '/' + nm, para + '/' + nm);
          } else if (s.type === 'file') {
            try {
              const n = this.m.fs.writeFile(para + '/' + nm, cm.fs.readFile(de + '/' + nm, { ctx: ctxC }), { ctx: ctxH });
              n.mode = s.mode; n.uid = s.uid; n.gid = s.gid;
            } catch (e) { }
          }
        }
      };
      copia(dentro, dirHost);
    }

    /* Inventário do sistema de arquivos, para o `docker diff` */
    _inventario(cm) {
      const inv = new Map();
      const ctx = cm.ctxRoot();
      const pular = new Set(['/proc', '/sys', '/dev']);
      const anda = (p) => {
        if (pular.has(p)) return;
        let itens = [];
        try { itens = cm.fs.readdir(p, { ctx }); } catch (e) { return; }
        for (const it of itens) {
          const nm = typeof it === 'string' ? it : it.name;
          if (nm === '.' || nm === '..') continue;
          const full = p === '/' ? '/' + nm : p + '/' + nm;
          let s; try { s = cm.fs.lstat(full, { ctx }); } catch (e) { continue; }
          inv.set(full, s.type === 'dir' ? 'D' : (s.size || 0) + ':' + s.mode);
          if (s.type === 'dir') anda(full);
        }
      };
      anda('/');
      return inv;
    }

    diff(c) {
      if (!c.maquina || !c.inventarioBase) return [];
      const agora = this._inventario(c.maquina);
      const saida = [];
      /* diretórios cobertos por montagem não contam: não fazem parte da
         camada gravável do container */
      const montados = c.montagens.map(mo => mo.destino);
      const emMontagem = (p) => montados.some(mo => p === mo || p.startsWith(mo + '/'));
      for (const [p, v] of agora) {
        if (emMontagem(p)) continue;
        if (!c.inventarioBase.has(p)) saida.push({ tipo: 'A', caminho: p });
        else if (c.inventarioBase.get(p) !== v && v !== 'D') saida.push({ tipo: 'C', caminho: p });
      }
      for (const [p] of c.inventarioBase) {
        if (emMontagem(p)) continue;
        if (!agora.has(p)) saida.push({ tipo: 'D', caminho: p });
      }
      /* o Docker também marca como alterado o diretório de um arquivo novo */
      const dirs = new Set();
      for (const s of saida) if (s.tipo === 'A') { let d = FileSystem.dirname(s.caminho); if (d !== '/') dirs.add(d); }
      for (const d of dirs) if (!saida.some(s => s.caminho === d)) saida.push({ tipo: 'C', caminho: d });
      saida.sort((a, b) => a.caminho.localeCompare(b.caminho));
      return saida;
    }

    /* ---------------------------------------------------------------- */
    iniciar(c) {
      if (c.estado === 'running') return { ok: true, jaRodava: true };
      if (c.estado === 'paused') return { ok: false, erro: `Error response from daemon: cannot start a paused container, try unpause instead` };

      /* conflito de porta: mesma mensagem que o Docker dá */
      for (const p of c.portas) {
        const uso = this.m.portInUse(p.hostPort, p.proto, p.hostIp);
        if (uso && uso.container !== c.id) {
          return {
            ok: false,
            erro: `Error response from daemon: driver failed programming external connectivity on endpoint ${c.nome} ` +
              `(${hex(64)}): failed to bind host port for ${p.hostIp}:${p.hostPort}:${c.ip}:${p.contPort}/${p.proto}: address already in use`
          };
        }
      }

      const img = this.imagens.get(c.imagemId);
      if (!img) return { ok: false, erro: `Error response from daemon: No such image: ${c.imagemRef}` };

      const argv = (c.entrypoint || []).concat(c.cmd || []);
      if (!argv.length) {
        return { ok: false, erro: `docker: Error response from daemon: no command specified` };
      }

      /* o binário existe dentro da imagem? */
      const cm = c.maquina;
      const exe = argv[0];
      if (!this._existeExecutavel(cm, exe)) {
        c.estado = 'exited'; c.saida = 127; c.terminadoEm = Date.now();
        c.erro = `exec: "${exe}": executable file not found in $PATH`;
        return {
          ok: false, iniciouEFalhou: true,
          erro: `docker: Error response from daemon: failed to create task for container: failed to create shim task: ` +
            `OCI runtime create failed: runc create failed: unable to start container process: ` +
            `exec: "${exe}": executable file not found in $PATH: unknown`
        };
      }
      if (c.usuario && c.usuario !== 'root' && !this._usuarioExiste(cm, c.usuario)) {
        c.estado = 'exited'; c.saida = 126; c.terminadoEm = Date.now();
        return {
          ok: false, iniciouEFalhou: true,
          erro: `docker: Error response from daemon: unable to find user ${c.usuario}: no matching entries in passwd file`
        };
      }

      c.estado = 'running';
      c.iniciadoEm = Date.now();
      c.terminadoEm = null;
      c.erro = '';
      c.escutas = [];
      cm.bootTime = Date.now();
      cm.processes.clear();
      cm.listeners.length = 0;
      cm.nextPid = 1;
      this._sincronizarRede(c);
      this._escreverHosts(c);

      /* PID 1 é o processo do container. Não existe systemd aqui. */
      const p1 = new LX.Process({
        pid: 1, ppid: 0, cmd: argv.join(' '), comm: FileSystem.basename(exe).slice(0, 15),
        user: c.usuario, uid: c.usuario === 'root' ? 0 : 1000, cpu: 0.4, mem: 1.2,
        rss: 24000, vsz: 210000, state: 'S'
      });
      cm.processes.set(1, p1);
      cm.nextPid = 1;
      c.pid1 = p1;

      /* --read-only: a raiz do container passa a recusar escrita, e só os
         pontos de montagem continuam graváveis. Ligado depois de montar. */
      cm.fs.somenteLeitura = !!c.somenteLeitura;

      /* Capabilities: o conjunto padrão do Docker, menos o que foi tirado
         com --cap-drop, mais o que foi devolvido com --cap-add. Container
         --privileged tem tudo. */
      if (c.privilegiado) c.capacidades = null;
      else {
        const padrao = ['CHOWN', 'DAC_OVERRIDE', 'FSETID', 'FOWNER', 'MKNOD', 'NET_RAW',
          'SETGID', 'SETUID', 'SETFCAP', 'SETPCAP', 'NET_BIND_SERVICE', 'SYS_CHROOT',
          'KILL', 'AUDIT_WRITE'];
        const conj = new Set(padrao);
        for (const cap of (c.capDrop || [])) {
          const nome = String(cap).toUpperCase().replace(/^CAP_/, '');
          if (nome === 'ALL') conj.clear(); else conj.delete(nome);
        }
        for (const cap of (c.capAdd || [])) {
          const nome = String(cap).toUpperCase().replace(/^CAP_/, '');
          if (nome === 'ALL') for (const x of padrao) conj.add(x); else conj.add(nome);
        }
        c.capacidades = conj;
      }
      cm.capacidades = c.capacidades;

      c.saude = { estado: c.saudeConfig ? 'starting' : 'none', falhas: 0, log: [] };
      this.evento('container', 'start', c.nome, { image: c.imagemRef });

      /* Convenção `_FILE` das imagens oficiais: SENHA_FILE=/run/secrets/x faz
         o entrypoint ler o arquivo e definir SENHA. É assim que segredos em
         arquivo chegam ao processo sem passar por variável de ambiente. */
      for (const chave of Object.keys(c.env)) {
        if (!/_FILE$/.test(chave)) continue;
        const base = chave.replace(/_FILE$/, '');
        if (c.env[base] !== undefined && c.env[base] !== '') continue;
        try {
          const txt = cm.fs.readFile(String(c.env[chave]), { ctx: cm.ctxRoot() });
          c.env[base] = String(txt).replace(/\n+$/, '');
          /* valor lido em tempo de execução: não faz parte da configuração
             do container e, por isso, não aparece no `docker inspect` */
          (c.envDeArquivo || (c.envDeArquivo = new Set())).add(base);
        } catch (err) { /* arquivo ausente: a imagem reclama sozinha */ }
      }

      /* Comportamento da imagem: abrir portas, escrever logs, subir daemons.
         Só vale quando o container roda o comando que a imagem definiu —
         `docker run -d minha-nginx sh` não deve subir o nginx. */
      const cmdImagem = img.config.Cmd || [];
      const programaDaImagem = cmdImagem.length ? FileSystem.basename(String(cmdImagem[0])) : null;
      const mesmoEntrypoint = JSON.stringify(c.entrypoint || []) === JSON.stringify(img.config.Entrypoint || []);
      const primeiro = (c.cmd || [])[0];
      /* Passar só flags (`command: ["--api.dashboard=true"]`) continua sendo
         o programa da imagem; trocar por `sh` não é. */
      const rodaOComandoDaImagem = mesmoEntrypoint && (
        !primeiro || String(primeiro).startsWith('-') ||
        (programaDaImagem && FileSystem.basename(String(primeiro)) === programaDaImagem)
      );
      if (img.aoIniciar && rodaOComandoDaImagem) {
        try { img.aoIniciar(c, this, argv); }
        catch (e) {
          c.registrar('erro ao iniciar: ' + e.message, 'stderr');
          this._encerrar(c, 1);
          return { ok: true, container: c, encerrouSozinho: true };
        }
      }
      /* Imagem sem daemon: o container vive só enquanto o comando dele
         viver. Quem executa o comando é o CLI (para poder mostrar a saída
         em tempo real), então aqui apenas marcamos a natureza dele. */
      c.efemera = (!!img.encerraSozinha || !rodaOComandoDaImagem) && !c.escutas.length;
      return { ok: true, container: c };
    }

    /* O comando fica no ar ou termina logo? É o que separa
       `docker run -d alpine sleep 3600` de `docker run -d alpine ls`. */
    comandoLongo(c) {
      const argv = (c.entrypoint || []).concat(c.cmd || []);
      if (!argv.length) return false;
      if (c.tty && c.interativo) return true;
      const base = FileSystem.basename(argv[0]);
      if (['sleep', 'tail', 'top', 'watch', 'yes'].includes(base)) return true;
      const linha = argv.join(' ');
      if (/\bwhile\s+(true|:)/.test(linha)) return true;
      if (/\btail\s+-f\b/.test(linha)) return true;
      if (/\bsleep\s+(infinity|\d{3,})/.test(linha)) return true;
      return false;
    }

    /* Roda o processo principal de um container efêmero e o encerra com o
       código de saída dele — como o runtime faz quando o PID 1 termina. */
    async rodarPrincipal(c, io) {
      const argv = (c.entrypoint || []).concat(c.cmd || []);
      const semEntrypoint = /entrypoint/.test(argv[0] || '') ? argv.slice(1) : argv;
      if (!semEntrypoint.length) { this._encerrar(c, 0); return 0; }
      const alvo = semEntrypoint;
      const citar = (a) => /^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : "'" + String(a).replace(/'/g, `'\\''`) + "'";
      const sh = this.shellDe(c, {});
      let status = 0;
      try { status = await LX.rodarLinha(sh, io, alvo.map(citar).join(' ')); }
      catch (e) { io.stderr.write(String(e.message || e) + '\n'); status = 1; }
      if (this.containers.has(c.id) && c.rodando) this._encerrar(c, status);
      else c.saida = status;
      return status;
    }

    _existeExecutavel(cm, exe) {
      const ctx = cm.ctxRoot();
      if (exe.includes('/')) { try { return !!cm.fs.stat(exe, { ctx }); } catch (e) { return false; } }
      for (const d of ['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin']) {
        try { cm.fs.stat(d + '/' + exe, { ctx }); return true; } catch (e) { }
      }
      return false;
    }
    _usuarioExiste(cm, u) {
      if (/^\d+(:\d+)?$/.test(u)) return true;
      const nome = u.split(':')[0];
      try { return cm.fs.readFile('/etc/passwd', { ctx: cm.ctxRoot() }).split('\n').some(l => l.split(':')[0] === nome); }
      catch (e) { return false; }
    }

    /* Abre uma porta dentro do container (usado pelas imagens) */
    escutar(c, porta, opts = {}) {
      if (!c.maquina) return null;
      const l = {
        addr: '0.0.0.0', port: +porta, proto: opts.proto || 'tcp',
        pid: 1, process: opts.processo || 'app', container: c.id, http: opts.http || null
      };
      c.maquina.listeners.push(l);
      c.escutas.push(l);
      return l;
    }

    _encerrar(c, codigo, sinal) {
      c.estado = 'exited';
      c.saida = codigo;
      c.terminadoEm = Date.now();
      if (c.maquina) { c.maquina.processes.clear(); c.maquina.listeners.length = 0; }
      c.escutas = [];
      c.pid1 = null;
      c.saude.estado = c.saudeConfig ? 'starting' : 'none';
      this.evento('container', 'die', c.nome, { exitCode: String(codigo) });
      /* política de reinício: por isso "matar o processo" não resolve */
      const pol = c.restart.politica;
      const deve = pol === 'always' || pol === 'unless-stopped' ||
        (pol === 'on-failure' && codigo !== 0 &&
          (!c.restart.maxTentativas || c.reinicios < c.restart.maxTentativas));
      if (deve && !sinal && !this._reiniciando) {
        this._reiniciando = true;
        try {
          /* O supervisor tenta de novo enquanto a política permitir. Um
             container que morre na largada e tem restart: always entra
             exatamente neste laço — é o "reiniciando infinitamente". */
          let voltas = 0;
          while (voltas < 25) {
            const limite = c.restart.maxTentativas;
            if (limite && c.reinicios >= limite) break;
            c.reinicios++;
            voltas++;
            this.evento('container', 'restart', c.nome, {});
            const r = this.iniciar(c);
            if (!r.ok) break;
            if (c.estado === 'running' && (c.escutas.length || this.comandoLongo(c))) break;
            if (c.estado === 'running' && !c.efemera) break;
            if (c.estado === 'running') break;
            const pol2 = c.restart.politica;
            if (pol2 === 'on-failure' && c.saida === 0) break;
          }
        }
        finally { this._reiniciando = false; }
      }
      if (c.autoRemover && c.estado === 'exited') this.remover(c, { force: true, silencioso: true });
    }

    parar(c, opts = {}) {
      if (c.estado !== 'running' && c.estado !== 'paused') return { ok: true, jaParado: true };
      const pol = c.restart.politica;
      /* parar à mão desliga o restart até o próximo start explícito */
      c.estado = 'exited';
      c.saida = opts.sinal === 'SIGKILL' ? 137 : 0;
      c.terminadoEm = Date.now();
      if (c.maquina) { c.maquina.processes.clear(); c.maquina.listeners.length = 0; }
      c.escutas = [];
      c.pid1 = null;
      c.saude.estado = c.saudeConfig ? 'starting' : 'none';
      this.evento('container', opts.sinal === 'SIGKILL' ? 'kill' : 'stop', c.nome, {});
      if (c.autoRemover) this.remover(c, { force: true, silencioso: true });
      return { ok: true, politica: pol };
    }

    reiniciar(c) {
      if (c.estado === 'running' || c.estado === 'paused') this.parar(c);
      if (!this.containers.has(c.id)) return { ok: true, removido: true };
      const r = this.iniciar(c);
      this.evento('container', 'restart', c.nome, {});
      return r;
    }

    pausar(c) {
      if (c.estado !== 'running') return { ok: false, erro: `Error response from daemon: Container ${c.id} is not running` };
      c.estado = 'paused';
      this.evento('container', 'pause', c.nome, {});
      return { ok: true };
    }
    despausar(c) {
      if (c.estado !== 'paused') return { ok: false, erro: `Error response from daemon: Container ${c.id} is not paused` };
      c.estado = 'running';
      this.evento('container', 'unpause', c.nome, {});
      return { ok: true };
    }

    remover(c, opts = {}) {
      if (c.estado === 'running' && !opts.force) {
        return {
          ok: false,
          erro: `Error response from daemon: cannot remove container "/${c.nome}": container is running: ` +
            `stop the container before removing or force remove`
        };
      }
      if (c.estado === 'running') this.parar(c, { sinal: 'SIGKILL' });
      for (const [nomeRede] of c.redes) {
        const r = this.networks.get(nomeRede);
        if (r) r.containers.delete(c.id);
      }
      this.containers.delete(c.id);
      /* volumes anônimos só somem com -v; nomeados sobrevivem sempre.
         É exatamente aqui que mora "apagar o container não apaga os dados". */
      if (opts.volumes) {
        for (const mo of c.montagens) {
          if (mo.tipo === 'volume' && mo.anonimo) this.removerVolume(mo.nome, { force: true });
        }
      }
      try { this.m.fs.rmrf(`/var/lib/docker/containers/${c.id}`, { ctx: this.m.ctxRoot() }); } catch (e) { }
      if (!opts.silencioso) this.evento('container', 'destroy', c.nome, {});
      return { ok: true };
    }

    renomear(c, novo) {
      if (this.containerPorNome(novo)) {
        return { ok: false, erro: `Error response from daemon: rename: container name "/${novo}" is already in use by container "${this.containerPorNome(novo).id}"` };
      }
      c.nome = novo;
      this.evento('container', 'rename', novo, {});
      return { ok: true };
    }

    /* ================================================================
       SAÚDE
       ================================================================ */
    /* O healthcheck roda DENTRO do container, de verdade: é o mesmo
       interpretador Bash do curso de Linux, no sistema de arquivos dele. */
    async avaliarSaude(c) {
      if (!c.saudeConfig || !c.rodando) return c.saude.estado;
      const teste = c.saudeConfig.Test || c.saudeConfig.test || [];
      if (!teste.length || teste[0] === 'NONE') { c.saude.estado = 'none'; return 'none'; }
      let linha;
      if (teste[0] === 'CMD-SHELL') linha = teste.slice(1).join(' ');
      else if (teste[0] === 'CMD') linha = teste.slice(1).map(a => /[ "']/.test(a) ? JSON.stringify(a) : a).join(' ');
      else linha = teste.join(' ');
      const r = await this.execSilencioso(c, linha);
      const saidaTexto = (r.out || '').slice(0, 400);
      c.saude.log.push({ ts: Date.now(), codigo: r.status, saida: saidaTexto });
      if (c.saude.log.length > 5) c.saude.log.shift();
      if (r.status === 0) { c.saude.estado = 'healthy'; c.saude.falhas = 0; }
      else {
        c.saude.falhas++;
        const limite = c.saudeConfig.Retries || c.saudeConfig.retries || 3;
        c.saude.estado = c.saude.falhas >= limite ? 'unhealthy' : 'starting';
      }
      return c.saude.estado;
    }

    /* ================================================================
       EXECUÇÃO DENTRO DO CONTAINER
       ================================================================ */
    shellDe(c, opts = {}) {
      const cm = c.maquina;
      const usuario = opts.usuario || c.usuario || 'root';
      let uid = 0, gid = 0, nome = 'root';
      if (/^\d+/.test(usuario)) { uid = parseInt(usuario, 10); gid = parseInt(usuario.split(':')[1] || uid, 10); nome = String(uid); }
      else if (usuario !== 'root') {
        try {
          const l = cm.fs.readFile('/etc/passwd', { ctx: cm.ctxRoot() }).split('\n').find(x => x.split(':')[0] === usuario);
          if (l) { const p = l.split(':'); uid = +p[2]; gid = +p[3]; nome = usuario; }
        } catch (e) { }
      }
      /* imagem sem bash (alpine, busybox) reclama como "sh:", não "bash:" */
      let temBash = false;
      try { cm.fs.stat('/bin/bash', { ctx: cm.ctxRoot() }); temBash = true; } catch (e) { }
      const sh = new LX.Shell(cm, {
        cwd: opts.workdir || c.workdir || '/', uid, gid, user: nome,
        container: c.curto, nomeShell: temBash ? 'bash' : 'sh'
      });
      for (const k in c.env) sh.setVar(k, c.env[k], true);
      sh.setVar('HOSTNAME', c.hostname, true);
      sh.setVar('HOME', uid === 0 ? '/root' : '/home/' + nome, true);
      if (!c.env.PATH) sh.setVar('PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', true);
      return sh;
    }

    /* Roda um comando no container e devolve {status, out} sem imprimir */
    async execSilencioso(c, linha, opts = {}) {
      if (!c.maquina) return { status: 1, out: '' };
      const sh = this.shellDe(c, opts);
      const pedacos = [];
      const io = {
        stdin: new LX.InStream(opts.stdin || ''),
        stdout: new LX.Stream({ onWrite: s => pedacos.push(s) }),
        stderr: new LX.Stream({ onWrite: s => pedacos.push(s) }),
        term: { readLine: async () => '', clear() { }, pager: async () => { }, editor: async () => { }, liveView: async () => { }, follow: async () => { } }
      };
      let status = 0;
      try { status = await LX.rodarLinha(sh, io, linha); }
      catch (e) { status = 1; pedacos.push(String(e.message || e) + '\n'); }
      return { status, out: pedacos.join('') };
    }

    /* ================================================================
       REDE VISTA DE FORA (contratos usados pelo kernel e pelo ss/curl)
       ================================================================ */
    /* Portas publicadas aparecem como portas abertas do HOST */
    hostListeners() {
      const out = [];
      for (const c of this.containers.values()) {
        if (!c.rodando) continue;
        for (const p of c.portas) {
          const alvo = c.escutas.find(l => l.port === p.contPort && l.proto === p.proto);
          out.push({
            addr: p.hostIp, port: p.hostPort, proto: p.proto,
            pid: 0, process: 'docker-proxy', container: c.id,
            contPort: p.contPort, http: alvo ? alvo.http : null
          });
        }
        /* --network host: as portas do container SÃO as do host */
        if (c.redes.has('host')) {
          for (const l of c.escutas) {
            out.push({ addr: '0.0.0.0', port: l.port, proto: l.proto, pid: 1, process: l.process, container: c.id, contPort: l.port, http: l.http });
          }
        }
      }
      return out;
    }

    /* Processos dos containers aparecem em `ps aux` no host, como acontece
       de verdade: o container não esconde o processo do host. */
    hostProcesses() {
      const out = [];
      let base = 4000;
      for (const c of this.containers.values()) {
        if (!c.rodando || !c.maquina) continue;
        for (const p of c.maquina.processes.values()) {
          out.push(Object.assign(Object.create(Object.getPrototypeOf(p)), p, {
            pid: base + p.pid, ppid: p.pid === 1 ? 1 : base + p.ppid,
            _container: c.nome
          }));
        }
        base += 1000;
      }
      return out;
    }

    /* Um IP ou nome pertence a algum container? (ping, traceroute) */
    resolveAny(x) {
      if (!x) return null;
      for (const c of this.containers.values()) {
        if (!c.rodando) continue;
        for (const [, cfg] of c.redes) if (cfg.ip === x) return cfg.ip;
      }
      for (const [, r] of this.networks) if (r.gateway === x) return x;
      return null;
    }

    /* Resolução de nome DENTRO de uma rede do Docker */
    resolverNaRede(nomeRede, nome) {
      const r = this.networks.get(nomeRede);
      if (!r || !r.dnsInterno) return null;
      for (const [cid, cfg] of r.containers) {
        const c = this.containers.get(cid);
        if (!c || !c.rodando) continue;
        if (c.nomesNaRede(nomeRede).includes(nome)) return { container: c, ip: cfg.ip };
      }
      return null;
    }

    /* Conexão saindo do host (deCont = null) ou de dentro de um container */
    connectFrom(deCont, host, porta) {
      /* host → IP de container */
      for (const c of this.containers.values()) {
        if (!c.rodando) continue;
        for (const [, cfg] of c.redes) {
          if (cfg.ip && cfg.ip === host) {
            if (deCont && !this._compartilhamRede(deCont, c)) return null;
            const l = c.escutas.find(x => x.port === +porta && x.proto === 'tcp');
            if (!l) throw new SysError('ECONNREFUSED');
            return { ok: true, listener: l, ip: cfg.ip, container: c };
          }
        }
      }
      if (!deCont) return null;

      /* de dentro de um container: nome de serviço nas redes compartilhadas */
      for (const [nomeRede] of deCont.redes) {
        const achado = this.resolverNaRede(nomeRede, host);
        if (achado) {
          const l = achado.container.escutas.find(x => x.port === +porta && x.proto === 'tcp');
          if (!l) throw new SysError('ECONNREFUSED');
          return { ok: true, listener: l, ip: achado.ip, container: achado.container };
        }
      }
      /* gateway da rede = o host, o "host.docker.internal" dos exemplos */
      if (host === 'host.docker.internal' || host === 'gateway.docker.internal') {
        for (const [, cfg] of deCont.redes) if (cfg.gateway) return this._doHost(porta);
      }
      for (const [, r] of this.networks) if (r.gateway === host) return this._doHost(porta);
      return null;
    }
    _doHost(porta) {
      const l = this.m.todosListeners().find(x => x.port === +porta && x.proto === 'tcp');
      if (!l) throw new SysError('ECONNREFUSED');
      return { ok: true, listener: l, ip: '172.17.0.1' };
    }
    _compartilhamRede(a, b) {
      for (const [nome] of a.redes) if (b.redes.has(nome)) return true;
      return false;
    }

    /* Uma porta publicada respondendo HTTP no host */
    serve(l, path, method, req) {
      const c = this.containers.get(l.container);
      if (!c || !c.rodando) throw new SysError('ECONNREFUSED');
      const alvo = c.escutas.find(x => x.port === (l.contPort || l.port) && x.proto === (l.proto || 'tcp'));
      if (!alvo) throw new SysError('ECONNREFUSED');
      if (!alvo.http) return { status: 200, type: 'text/plain', body: `resposta de ${c.nome} na porta ${alvo.port}\n`, server: alvo.process };
      return alvo.http(path, method, req);
    }

    /* ================================================================
       ESTATÍSTICAS E ESPAÇO
       ================================================================ */
    stats(c) {
      if (!c.rodando) return { cpu: 0, mem: 0, memLimite: 0, memPct: 0, redeRx: 0, redeTx: 0, blocoR: 0, blocoW: 0, pids: 0 };
      const semente = c.id.charCodeAt(0) + c.id.charCodeAt(5) + Math.floor(Date.now() / 4000);
      const osc = (semente * 37 % 100) / 100;
      const base = c.perfilCarga || { cpu: 0.4, mem: 42 * 1024 * 1024 };
      const limite = c.recursos.memoria || this.m.mem.total * 1024 * 1024;
      const mem = Math.min(base.mem * (0.85 + osc * 0.35), limite * 0.98);
      return {
        cpu: +(base.cpu * (0.6 + osc)).toFixed(2),
        mem, memLimite: limite, memPct: +(mem / limite * 100).toFixed(2),
        redeRx: 1024 * (120 + Math.floor(osc * 900)), redeTx: 1024 * (80 + Math.floor(osc * 500)),
        blocoR: 1024 * 1024 * (2 + Math.floor(osc * 9)), blocoW: 1024 * 512 * (1 + Math.floor(osc * 6)),
        pids: c.maquina ? c.maquina.processes.size : 1
      };
    }

    df() {
      const camadasVistas = new Map();
      for (const img of this.imagens.values()) for (const cam of img.camadas) camadasVistas.set(cam.id, cam.tamanho);
      const totalReal = Array.from(camadasVistas.values()).reduce((a, b) => a + b, 0);
      const emUso = new Set(Array.from(this.containers.values()).map(c => c.imagemId));
      let recuperavelImg = 0;
      for (const img of this.imagens.values()) if (!emUso.has(img.id)) recuperavelImg += img.tamanho;

      const contAtivos = Array.from(this.containers.values()).filter(c => c.rodando).length;
      let tamCont = 0, recCont = 0;
      for (const c of this.containers.values()) {
        const t = this.diff(c).filter(d => d.tipo !== 'D').length * 4096 + 512;
        tamCont += t;
        if (!c.rodando) recCont += t;
      }
      let tamVol = 0, recVol = 0, volAtivos = 0;
      for (const [nome] of this.volumes) {
        const t = this.tamanhoVolume(nome);
        tamVol += t;
        if (this.volumeEmUso(nome).length) volAtivos++; else recVol += t;
      }
      const cache = (this.buildCacheTam || 0);
      return {
        imagens: { total: this.imagens.size, ativos: emUso.size, tamanho: totalReal, recuperavel: recuperavelImg },
        containers: { total: this.containers.size, ativos: contAtivos, tamanho: tamCont, recuperavel: recCont },
        volumes: { total: this.volumes.size, ativos: volAtivos, tamanho: tamVol, recuperavel: recVol },
        cache: { total: this.buildCacheItens || 0, ativos: 0, tamanho: cache, recuperavel: cache }
      };
    }

    limpar(opts = {}) {
      const r = { containers: [], redes: [], imagens: [], volumes: [], bytes: 0 };
      for (const c of Array.from(this.containers.values())) {
        if (!c.rodando && c.estado !== 'paused') { r.bytes += 512; r.containers.push(c.id); this.remover(c, {}); }
      }
      for (const [nome, rede] of Array.from(this.networks)) {
        if (rede.padrao || rede.containers.size) continue;
        this.networks.delete(nome); r.redes.push(nome);
      }
      const emUso = new Set(Array.from(this.containers.values()).map(c => c.imagemId));
      for (const img of Array.from(this.imagens.values())) {
        if (emUso.has(img.id)) continue;
        const semTag = img.tags.size === 0 || Array.from(img.tags).every(t => t.startsWith('<none>'));
        if (opts.todas || semTag) { r.bytes += img.tamanho; r.imagens.push(Array.from(img.tags)[0] || img.idCurto); this.imagens.delete(img.id); }
      }
      if (opts.volumes) {
        for (const [nome] of Array.from(this.volumes)) {
          if (this.volumeEmUso(nome).length) continue;
          const v = this.volumes.get(nome);
          if (!opts.todosVolumes && !v.anonimo) continue;
          r.bytes += this.tamanhoVolume(nome); r.volumes.push(nome); this.removerVolume(nome, { force: true });
        }
      }
      r.bytes += this.buildCacheTam || 0;
      this.buildCacheTam = 0; this.buildCacheItens = 0;
      return r;
    }
  }

  LX.DockerEngine = DockerEngine;
})();
