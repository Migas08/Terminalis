/* =========================================================================
   TERMINALIS — Traefik v3
   Configuração estática (flags/arquivo) separada da dinâmica (labels dos
   containers), provider Docker com descoberta automática, entryPoints,
   routers com a sintaxe de regras da v3, middlewares, services, TLS e
   resolvedor ACME. Roteia de verdade: quem responde é o container certo.

   Arquitetura:  Internet → entryPoint → Router → Middleware → Service → Container
   ========================================================================= */
'use strict';
(function () {

  /* -------------------------------------------------------------------
     Configuração estática: a partir do command (flags) e/ou do arquivo
     ------------------------------------------------------------------- */
  function porFlags(argv) {
    const cfg = {};
    for (const a of argv) {
      const m = /^--([^=]+)(?:=(.*))?$/.exec(String(a));
      if (!m) continue;
      const caminho = m[1].toLowerCase().split('.');
      const valor = m[2] === undefined ? true : m[2];
      let no = cfg;
      for (let i = 0; i < caminho.length - 1; i++) {
        const k = caminho[i];
        /* `--providers.docker=true` e `--providers.docker.network=web`
           convivem: o valor do nó intermediário vai para __valor em vez
           de ser jogado fora quando o filho chega. */
        if (typeof no[k] !== 'object' || no[k] === null) {
          const anterior = no[k];
          no[k] = {};
          if (anterior !== undefined) no[k].__valor = anterior;
        }
        no = no[k];
      }
      const folha = caminho[caminho.length - 1];
      const convertido = valor === 'true' ? true : valor === 'false' ? false : valor;
      if (no[folha] && typeof no[folha] === 'object') no[folha].__valor = convertido;
      else no[folha] = convertido;
    }
    return cfg;
  }
  function achatar(obj, prefixo = '', saida = {}) {
    for (const k in obj) {
      const v = obj[k];
      if (k === '__valor') { saida[prefixo] = v; continue; }
      const chave = prefixo ? prefixo + '.' + k.toLowerCase() : k.toLowerCase();
      if (v && typeof v === 'object' && !Array.isArray(v)) achatar(v, chave, saida);
      else saida[chave] = v;
    }
    return saida;
  }

  function lerEstatica(c) {
    const argv = (c.entrypoint || []).concat(c.cmd || []);
    let plano = achatar(porFlags(argv));
    /* traefik.yml montado por bind mount é o outro caminho documentado */
    for (const arq of ['/etc/traefik/traefik.yml', '/etc/traefik/traefik.yaml', '/traefik.yml', '/traefik.yaml']) {
      try {
        const texto = c.maquina.fs.readFile(arq, { ctx: c.maquina.ctxRoot() });
        const y = LX.lerYaml(texto);
        if (y && typeof y === 'object') plano = Object.assign(achatar(y), plano);
        break;
      } catch (e) { }
    }
    /* variáveis de ambiente TRAEFIK_* também valem (a terceira via) */
    for (const k in c.env) {
      if (!/^TRAEFIK_/.test(k)) continue;
      plano[k.replace(/^TRAEFIK_/, '').toLowerCase().replace(/_/g, '.')] = c.env[k];
    }

    const cfg = {
      entryPoints: {}, providers: { docker: false, exposedByDefault: true, network: null },
      api: { dashboard: false, insecure: false },
      certResolvers: {}, log: { level: 'ERROR' }, accessLog: false
    };
    for (const chave in plano) {
      const v = plano[chave];
      let m;
      if ((m = /^entrypoints\.([^.]+)\.address$/.exec(chave))) {
        const porta = parseInt(String(v).replace(/^[^:]*:/, ''), 10);
        cfg.entryPoints[m[1]] = Object.assign({ nome: m[1], porta }, cfg.entryPoints[m[1]]);
        continue;
      }
      if ((m = /^entrypoints\.([^.]+)\.http\.redirections\.entrypoint\.(to|scheme|permanent)$/.exec(chave))) {
        const ep = cfg.entryPoints[m[1]] = cfg.entryPoints[m[1]] || { nome: m[1] };
        ep.redir = ep.redir || {};
        ep.redir[m[2]] = v;
        continue;
      }
      if ((m = /^entrypoints\.([^.]+)\.http\.tls(\..*)?$/.exec(chave))) {
        const ep = cfg.entryPoints[m[1]] = cfg.entryPoints[m[1]] || { nome: m[1] };
        ep.tls = true;
        if (/certresolver$/.test(chave)) ep.certResolver = v;
        continue;
      }
      /* qualquer opção de providers.docker liga o provider */
      if (/^providers\.docker(\.|$)/.test(chave)) cfg.providers.docker = true;
      if (chave === 'providers.docker' || chave === 'providers.docker.endpoint') continue;
      if (chave === 'providers.docker.exposedbydefault') { cfg.providers.exposedByDefault = v === true || v === 'true'; continue; }
      if (chave === 'providers.docker.network') { cfg.providers.network = v; continue; }
      if (chave === 'api' || chave === 'api.dashboard') { cfg.api.dashboard = v !== false && v !== 'false'; continue; }
      if (chave === 'api.insecure') { cfg.api.insecure = v === true || v === 'true'; if (cfg.api.insecure) cfg.api.dashboard = true; continue; }
      if ((m = /^certificatesresolvers\.([^.]+)\.acme\.(.+)$/.exec(chave))) {
        const r = cfg.certResolvers[m[1]] = cfg.certResolvers[m[1]] || { nome: m[1] };
        const campo = m[2];
        if (campo === 'email') r.email = v;
        else if (campo === 'storage') r.storage = v;
        else if (campo === 'caserver') r.caServer = v;
        else if (/^httpchallenge/.test(campo)) { r.desafio = 'http'; if (/entrypoint$/.test(campo)) r.entryPoint = v; }
        else if (/^tlschallenge/.test(campo)) r.desafio = 'tls';
        else if (/^dnschallenge/.test(campo)) { r.desafio = 'dns'; if (/provider$/.test(campo)) r.provedor = v; }
        continue;
      }
      if (chave === 'log.level') { cfg.log.level = String(v).toUpperCase(); continue; }
      if (chave === 'accesslog' || chave === 'accesslog.filepath') { cfg.accessLog = true; continue; }
    }
    /* sem entryPoint declarado, o Traefik ainda tem o padrão :80 */
    if (!Object.keys(cfg.entryPoints).length) cfg.entryPoints.web = { nome: 'web', porta: 80 };
    if (cfg.api.insecure) cfg.entryPoints.traefik = { nome: 'traefik', porta: 8080 };
    return cfg;
  }

  /* -------------------------------------------------------------------
     Configuração dinâmica: lida das labels dos containers em execução
     ------------------------------------------------------------------- */
  function lerDinamica(traefikCont, eng, cfg) {
    const routers = new Map(), services = new Map(), middlewares = new Map();
    const avisos = [];

    const registrar = (c) => {
      const labels = c.labels || {};
      const habilitado = labels['traefik.enable'];
      if (cfg.providers.exposedByDefault) { if (habilitado === 'false' || habilitado === false) return; }
      else if (habilitado !== 'true' && habilitado !== true) return;

      /* a rede pela qual o Traefik alcança este container */
      let rede = labels['traefik.docker.network'] || cfg.providers.network;
      if (!rede) rede = Array.from(c.redes.keys()).find(n => traefikCont.redes.has(n)) || Array.from(c.redes.keys())[0];
      const compartilha = traefikCont.redes.has(rede) && c.redes.has(rede);

      for (const chave in labels) {
        let m;
        if ((m = /^traefik\.http\.routers\.([^.]+)\.(.+)$/.exec(chave))) {
          const r = routers.get(m[1]) || { nome: m[1], container: c, rede, entrypoints: [], middlewares: [], prioridade: null, tls: false };
          const campo = m[2].toLowerCase();
          const v = labels[chave];
          if (campo === 'rule') r.rule = v;
          else if (campo === 'entrypoints') r.entrypoints = String(v).split(',').map(x => x.trim()).filter(Boolean);
          else if (campo === 'service') r.service = v;
          else if (campo === 'middlewares') r.middlewares = String(v).split(',').map(x => x.trim().replace(/@.*$/, '')).filter(Boolean);
          else if (campo === 'priority') r.prioridade = parseInt(v, 10);
          else if (campo === 'tls') r.tls = v === 'true' || v === true;
          else if (campo === 'tls.certresolver') { r.tls = true; r.certResolver = v; }
          r.container = c; r.rede = rede; r.compartilha = compartilha;
          routers.set(m[1], r);
          continue;
        }
        if ((m = /^traefik\.http\.services\.([^.]+)\.(.+)$/.exec(chave))) {
          const s = services.get(m[1]) || { nome: m[1], container: c, rede, porta: null, esquema: 'http' };
          const campo = m[2].toLowerCase();
          if (campo === 'loadbalancer.server.port') s.porta = parseInt(labels[chave], 10);
          else if (campo === 'loadbalancer.server.scheme') s.esquema = labels[chave];
          else if (campo === 'loadbalancer.server.url') s.url = labels[chave];
          s.container = c; s.rede = rede;
          services.set(m[1], s);
          continue;
        }
        if ((m = /^traefik\.http\.middlewares\.([^.]+)\.([^.]+)\.(.+)$/.exec(chave))) {
          const mw = middlewares.get(m[1]) || { nome: m[1], tipo: m[2].toLowerCase(), opcoes: {} };
          mw.opcoes[m[3].toLowerCase()] = labels[chave];
          middlewares.set(m[1], mw);
          continue;
        }
      }
    };

    for (const c of eng.containers.values()) if (c.rodando) registrar(c);

    /* Cada router precisa de um service. Sem label de service, o Traefik
       cria um com o nome do container e a primeira porta exposta — e é
       aí que nasce o 502 quando a imagem expõe mais de uma porta. */
    for (const r of routers.values()) {
      let s = r.service ? services.get(r.service) : services.get(r.nome);
      if (!s) {
        const c = r.container;
        const expostas = Object.keys(c.expostas || {}).map(k => parseInt(k, 10)).filter(Boolean).sort((a, b) => a - b);
        const escutando = (c.escutas || []).map(l => l.port);
        const porta = expostas[0] || escutando[0] || null;
        s = { nome: r.service || r.nome, container: c, rede: r.rede, porta, esquema: 'http', implicito: true };
        if (expostas.length > 1) avisos.push({ router: r.nome, tipo: 'multiplas-portas', portas: expostas });
        services.set(s.nome, s);
      }
      r.servico = s;
      if (!s.container) s.container = r.container;
      if (!s.rede) s.rede = r.rede;
    }
    return { routers, services, middlewares, avisos };
  }

  /* -------------------------------------------------------------------
     Regras de roteamento — sintaxe v3
     Host(`a`) && PathPrefix(`/api`)   |  (Host(`a`) || Host(`b`))  |  !Path(`/x`)
     ------------------------------------------------------------------- */
  function avaliarRegra(regra, req) {
    if (!regra) return false;
    const tk = [];
    let i = 0;
    while (i < regra.length) {
      const ch = regra[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '(' || ch === ')') { tk.push({ t: ch }); i++; continue; }
      if (regra.startsWith('&&', i)) { tk.push({ t: '&&' }); i += 2; continue; }
      if (regra.startsWith('||', i)) { tk.push({ t: '||' }); i += 2; continue; }
      if (ch === '!') { tk.push({ t: '!' }); i++; continue; }
      const m = /^([A-Za-z]+)\s*\(/.exec(regra.slice(i));
      if (m) {
        const nome = m[1];
        let j = i + m[0].length, prof = 1, arg = '';
        while (j < regra.length && prof > 0) {
          if (regra[j] === '(') prof++;
          if (regra[j] === ')') { prof--; if (!prof) break; }
          arg += regra[j]; j++;
        }
        tk.push({ t: 'm', nome, arg });
        i = j + 1;
        continue;
      }
      i++;
    }

    const valores = (arg) => {
      /* v3 exige crase; aspas simples são recusadas pelo Traefik */
      const partes = [];
      const re = /`([^`]*)`|"([^"]*)"/g;
      let m;
      while ((m = re.exec(arg))) partes.push(m[1] !== undefined ? m[1] : m[2]);
      return partes;
    };
    const casa = (nome, arg) => {
      const v = valores(arg);
      const host = String((req.cabecalhos && (req.cabecalhos.Host || req.cabecalhos.host)) || req.host || '').split(':')[0];
      const caminho = req.caminho || '/';
      switch (nome) {
        case 'Host': {
          const alvo = v[0] || '';
          if (alvo.startsWith('*.')) return host.endsWith(alvo.slice(1));
          return host.toLowerCase() === alvo.toLowerCase();
        }
        case 'HostRegexp': { try { return new RegExp(v[0]).test(host); } catch (e) { return false; } }
        case 'Path': return caminho === v[0];
        case 'PathPrefix': return caminho === v[0] || caminho.startsWith(v[0].replace(/\/$/, '') + '/') || caminho.startsWith(v[0]);
        case 'PathRegexp': { try { return new RegExp(v[0]).test(caminho); } catch (e) { return false; } }
        case 'Method': return (req.metodo || 'GET').toUpperCase() === String(v[0]).toUpperCase();
        case 'Header': return String((req.cabecalhos || {})[v[0]] || '') === v[1];
        case 'HeaderRegexp': { try { return new RegExp(v[1]).test(String((req.cabecalhos || {})[v[0]] || '')); } catch (e) { return false; } }
        case 'Query': return false;
        case 'ClientIP': return true;
        default: return false;
      }
    };

    let pos = 0;
    function expr() {
      let v = termo();
      while (pos < tk.length && (tk[pos].t === '&&' || tk[pos].t === '||')) {
        const op = tk[pos++].t;
        const d = termo();
        v = op === '&&' ? (v && d) : (v || d);
      }
      return v;
    }
    function termo() {
      if (pos < tk.length && tk[pos].t === '!') { pos++; return !termo(); }
      if (pos < tk.length && tk[pos].t === '(') { pos++; const v = expr(); if (tk[pos] && tk[pos].t === ')') pos++; return v; }
      if (pos < tk.length && tk[pos].t === 'm') { const t = tk[pos++]; return casa(t.nome, t.arg); }
      pos++;
      return false;
    }
    try { return !!expr(); } catch (e) { return false; }
  }
  LX.traefikCasaRegra = avaliarRegra;

  /* -------------------------------------------------------------------
     Middlewares
     Devolve {resposta} para interromper, ou {req} para seguir adiante.
     ------------------------------------------------------------------- */
  function aplicarMiddleware(mw, req, c) {
    const o = mw.opcoes || {};
    if (mw.tipo === 'redirectscheme') {
      const esquema = o.scheme || 'https';
      const permanente = o.permanent === 'true' || o.permanent === true;
      const host = (req.cabecalhos.Host || req.host || '').split(':')[0];
      return {
        resposta: {
          status: permanente ? 301 : 302, type: 'text/html',
          cabecalhos: { Location: `${esquema}://${host}${req.caminho}` },
          body: `<a href="${esquema}://${host}${req.caminho}">${permanente ? 'Moved Permanently' : 'Found'}</a>.\n\n`
        }
      };
    }
    if (mw.tipo === 'stripprefix') {
      const prefixos = String(o.prefixes || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const p of prefixos) {
        if (req.caminho === p || req.caminho.startsWith(p.replace(/\/$/, '') + '/')) {
          req.cabecalhos['X-Forwarded-Prefix'] = p;
          req.caminho = req.caminho.slice(p.length) || '/';
          break;
        }
      }
      return { req };
    }
    if (mw.tipo === 'addprefix') {
      req.caminho = (o.prefix || '') + req.caminho;
      return { req };
    }
    if (mw.tipo === 'basicauth') {
      const enviado = req.cabecalhos.Authorization || req.cabecalhos.authorization || '';
      if (!enviado) {
        return {
          resposta: {
            status: 401, type: 'text/plain',
            cabecalhos: { 'WWW-Authenticate': 'Basic realm="traefik"' },
            body: '401 Unauthorized\n'
          }
        };
      }
      return { req };
    }
    if (mw.tipo === 'headers') {
      for (const k in o) {
        const m = /^customresponseheaders\.(.+)$/.exec(k);
        if (m) { req.respostaCabecalhos = req.respostaCabecalhos || {}; req.respostaCabecalhos[m[1]] = o[k]; }
        const m2 = /^customrequestheaders\.(.+)$/.exec(k);
        if (m2) req.cabecalhos[m2[1]] = o[k];
      }
      if (o.stsseconds) { req.respostaCabecalhos = req.respostaCabecalhos || {}; req.respostaCabecalhos['Strict-Transport-Security'] = `max-age=${o.stsseconds}`; }
      if (o.framedeny === 'true') { req.respostaCabecalhos = req.respostaCabecalhos || {}; req.respostaCabecalhos['X-Frame-Options'] = 'DENY'; }
      if (o.contenttypenosniff === 'true') { req.respostaCabecalhos = req.respostaCabecalhos || {}; req.respostaCabecalhos['X-Content-Type-Options'] = 'nosniff'; }
      return { req };
    }
    if (mw.tipo === 'ratelimit') return { req };
    if (mw.tipo === 'compress') return { req };
    if (mw.tipo === 'ipallowlist' || mw.tipo === 'ipwhitelist') return { req };
    return { req };
  }

  /* -------------------------------------------------------------------
     O container do Traefik em execução
     ------------------------------------------------------------------- */
  LX.iniciarTraefik = function (c, eng) {
    const cfg = lerEstatica(c);
    c.traefik = cfg;
    c.perfilCarga = { cpu: 0.35, mem: 58 * 1024 * 1024 };

    /* O provider Docker precisa do socket. Sem ele montado, o Traefik
       sobe e não descobre nada — sintoma clássico de "não aparece rota". */
    let temSocket = false;
    for (const mo of c.montagens) if (/docker\.sock$/.test(mo.destino)) temSocket = true;
    cfg.socketMontado = temSocket;

    const nivel = cfg.log.level;
    const log = (msg, lv = 'INFO') => {
      const ordem = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
      if ((ordem[lv] || 1) >= (ordem[nivel] !== undefined ? ordem[nivel] : 3)) {
        c.registrar(`${new Date().toISOString()} ${lv} ${msg}`, 'stderr');
      }
    };
    c._traefikLog = log;
    log(`Traefik version 3.7.2 built on 2026-06-18T09:12:44Z`);
    if (cfg.providers.docker && !temSocket) {
      c.registrar(`${new Date().toISOString()} ERROR Provider connection error Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?, retrying in 1s`, 'stderr');
    }
    if (cfg.api.insecure) {
      c.registrar(`${new Date().toISOString()} WARN Insecure API is enabled: the dashboard is exposed without authentication`, 'stderr');
    }
    for (const nome in cfg.certResolvers) {
      const r = cfg.certResolvers[nome];
      if (!r.email) log(`The ACME resolver "${nome}" is skipped from the resolvers list because: unable to get ACME account: email is missing`, 'ERROR');
      else if (/staging/.test(r.caServer || '')) log(`Using ACME staging server for resolver "${nome}"`, 'WARN');
    }

    /* uma escuta por entryPoint declarado */
    for (const nome in cfg.entryPoints) {
      const ep = cfg.entryPoints[nome];
      log(`Starting provider aggregator aggregator.ProviderAggregator`);
      eng.escutar(c, ep.porta, {
        processo: 'traefik',
        http: (caminho, metodo, req) => atender(c, eng, ep, caminho, metodo, req || {})
      });
    }
  };

  /* -------------------------------------------------------------------
     Atender uma requisição
     ------------------------------------------------------------------- */
  function atender(c, eng, ep, caminho, metodo, pedido) {
    const cfg = c.traefik;
    const req = {
      caminho: caminho || '/', metodo: metodo || 'GET',
      cabecalhos: Object.assign({}, pedido.cabecalhos || {}),
      host: pedido.host || ''
    };
    const hostPedido = String(req.cabecalhos.Host || req.host || '').split(':')[0];
    const acesso = (status, servico) => {
      if (cfg.accessLog) {
        c.registrar(`172.17.0.1 - - [${new Date().toUTCString()}] "${req.metodo} ${caminho} HTTP/1.1" ${status} - "-" "-" 1 "${servico || '-'}" "-" 0ms`, 'stdout');
      }
    };
    const resposta404 = () => {
      acesso(404);
      return { status: 404, type: 'text/plain', body: '404 page not found\n', server: 'traefik' };
    };

    /* TLS: um entryPoint sem TLS não atende HTTPS, e vice-versa */
    if (pedido.tls && !(ep.tls || ep.porta === 443)) {
      return { status: 400, type: 'text/plain', body: 'Client sent an HTTP request to an HTTPS server.\n', server: 'traefik' };
    }
    /* Qual certificado o Traefik apresenta — e se o cliente confia nele */
    if (pedido.tls) {
      const cert = certificadoPara(cfg, hostPedido, ep);
      if (!cert.confiavel && !pedido.inseguro) {
        const err = new Error(cert.motivo);
        err.code = 'ECERT';
        return { status: 0, erroTls: true, motivo: cert.motivo, __erro: err, type: 'text/plain', body: '', server: 'traefik' };
      }
    }

    /* redirecionamento declarado no entryPoint (a forma global) */
    if (ep.redir && ep.redir.to) {
      const esquema = ep.redir.scheme || 'https';
      const permanente = ep.redir.permanent === undefined ? true : (ep.redir.permanent === true || ep.redir.permanent === 'true');
      acesso(permanente ? 301 : 302);
      return {
        status: permanente ? 301 : 302, type: 'text/html',
        cabecalhos: { Location: `${esquema}://${hostPedido}${req.caminho}` },
        body: `<a href="${esquema}://${hostPedido}${req.caminho}">${permanente ? 'Moved Permanently' : 'Found'}</a>.\n\n`,
        server: 'traefik'
      };
    }

    if (!cfg.providers.docker || !cfg.socketMontado) return resposta404();

    const din = lerDinamica(c, eng, cfg);
    c._traefikDinamica = din;

    /* candidatos: routers deste entryPoint cuja regra casa.
       Sem entrypoints declarados, o router atende todos. */
    const candidatos = [];
    for (const r of din.routers.values()) {
      if (r.entrypoints.length && !r.entrypoints.includes(ep.nome)) continue;
      if (!avaliarRegra(r.rule, req)) continue;
      candidatos.push(r);
    }
    /* dashboard interno */
    if (cfg.api.dashboard) {
      for (const r of din.routers.values()) {
        if (r.service === 'api@internal' && avaliarRegra(r.rule, req) &&
          (!r.entrypoints.length || r.entrypoints.includes(ep.nome))) {
          const bloqueio = executarMiddlewares(r, din, req, c);
          if (bloqueio) { acesso(bloqueio.status, 'api@internal'); return Object.assign({ server: 'traefik' }, bloqueio); }
          acesso(200, 'api@internal');
          return paginaDashboard(c, din);
        }
      }
      if (cfg.api.insecure && ep.nome === 'traefik') {
        acesso(200, 'api@internal');
        return paginaDashboard(c, din);
      }
    }
    if (!candidatos.length) return resposta404();

    /* prioridade: explícita vence; senão o comprimento da regra */
    candidatos.sort((a, b) => {
      const pa = a.prioridade || (a.rule || '').length;
      const pb = b.prioridade || (b.rule || '').length;
      return pb - pa;
    });
    const r = candidatos[0];

    const bloqueio = executarMiddlewares(r, din, req, c);
    if (bloqueio) { acesso(bloqueio.status, r.servico && r.servico.nome); return Object.assign({ server: 'traefik' }, bloqueio); }

    const s = r.servico;
    const alvo = s && s.container;
    const erro502 = (motivo) => {
      c.registrar(`${new Date().toISOString()} ERROR ${motivo}`, 'stderr');
      acesso(502, s ? s.nome : '-');
      return { status: 502, type: 'text/plain', body: 'Bad Gateway\n', server: 'traefik' };
    };
    if (!alvo || !alvo.rodando) return erro502(`Cannot dial backend for service ${s ? s.nome : '?'}: container is not running`);
    if (!r.compartilha) {
      return erro502(`Cannot dial backend: no network in common between traefik and ${alvo.nome} (defina traefik.docker.network ou conecte o container na rede do proxy)`);
    }
    const porta = s.porta;
    if (!porta) return erro502(`Could not find the port for service ${s.nome}: define traefik.http.services.${s.nome}.loadbalancer.server.port`);
    const escuta = alvo.escutas.find(l => l.port === porta && l.proto === 'tcp');
    if (!escuta) return erro502(`dial tcp ${alvo.ip}:${porta}: connect: connection refused`);
    if (!escuta.http) { acesso(200, s.nome); return { status: 200, type: 'text/plain', body: `resposta de ${alvo.nome}\n`, server: 'traefik' }; }

    const resp = escuta.http(req.caminho, req.metodo, {
      cabecalhos: Object.assign({}, req.cabecalhos, {
        'X-Forwarded-For': '172.17.0.1', 'X-Forwarded-Host': hostPedido,
        'X-Forwarded-Proto': pedido.tls ? 'https' : 'http', 'X-Real-Ip': '172.17.0.1'
      }),
      host: hostPedido, metodo: req.metodo
    });
    acesso(resp.status, s.nome);
    const saida = Object.assign({ server: 'traefik' }, resp);
    if (req.respostaCabecalhos) saida.cabecalhos = Object.assign({}, resp.cabecalhos, req.respostaCabecalhos);
    return saida;
  }

  /* Que certificado o Traefik serve para este host, e ele é confiável?
     Sem resolvedor ACME configurado, a v3 serve um certificado autoassinado
     próprio — é por isso que o navegador reclama mesmo com o HTTPS "funcionando". */
  function certificadoPara(cfg, host, ep) {
    const nomes = Object.keys(cfg.certResolvers);
    const nome = ep.certResolver && cfg.certResolvers[ep.certResolver] ? ep.certResolver : nomes[0];
    const r = nome ? cfg.certResolvers[nome] : null;
    if (!r) return { confiavel: false, motivo: 'TRAEFIK DEFAULT CERT: certificado autoassinado (nenhum certificatesResolvers configurado)' };
    if (!r.email) return { confiavel: false, motivo: `o resolvedor "${nome}" foi ignorado por falta de email; o Traefik serviu o certificado autoassinado` };
    if (/staging/.test(r.caServer || '')) return { confiavel: false, motivo: `certificado emitido pela CA de teste (staging) do Let's Encrypt — não é confiável por design` };
    if (!/\./.test(host) || /\.(local|localhost|internal|test|lan|home|invalid|example)$/.test(host)) {
      return { confiavel: false, motivo: `o Let's Encrypt não emite certificado para "${host}" (domínio não público); o Traefik serviu o certificado autoassinado` };
    }
    return { confiavel: true, motivo: `certificado válido emitido por "${nome}"` };
  }

  function executarMiddlewares(r, din, req, c) {
    for (const nome of (r.middlewares || [])) {
      const mw = din.middlewares.get(nome);
      if (!mw) {
        c.registrar(`${new Date().toISOString()} ERROR middleware "${nome}@docker" does not exist`, 'stderr');
        return { status: 500, type: 'text/plain', body: 'Internal Server Error\n' };
      }
      const passo = aplicarMiddleware(mw, req, c);
      if (passo.resposta) return passo.resposta;
    }
    return null;
  }

  function paginaDashboard(c, din) {
    const linhas = [];
    for (const r of din.routers.values()) {
      linhas.push(`<tr><td>${r.nome}@docker</td><td><code>${(r.rule || '').replace(/</g, '&lt;')}</code></td>` +
        `<td>${r.entrypoints.join(', ') || '(todos)'}</td><td>${r.servico ? r.servico.nome : '-'}</td>` +
        `<td>${(r.middlewares || []).join(', ') || '-'}</td></tr>`);
    }
    return {
      status: 200, type: 'text/html', server: 'traefik',
      body: `<!DOCTYPE html>\n<html><head><title>Traefik</title></head><body>\n` +
        `<h1>Traefik 3.7.2 — Dashboard</h1>\n<h2>HTTP Routers (${din.routers.size})</h2>\n` +
        `<table border="1">\n<tr><th>Nome</th><th>Rule</th><th>EntryPoints</th><th>Service</th><th>Middlewares</th></tr>\n` +
        linhas.join('\n') + `\n</table>\n<h2>HTTP Services (${din.services.size})</h2>\n` +
        Array.from(din.services.values()).map(s => `<p>${s.nome}@docker → ${s.container ? s.container.ip : '?'}:${s.porta || '?'}</p>`).join('\n') +
        `\n</body></html>\n`
    };
  }

  /* Exposto para os desafios: qual rota o Traefik escolheria? */
  LX.traefikRotas = function (c, eng) {
    if (!c || !c.traefik) return null;
    return lerDinamica(c, eng, c.traefik);
  };
})();
