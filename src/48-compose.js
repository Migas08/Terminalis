/* =========================================================================
   TERMINALIS — docker compose
   Lê o compose.yaml de verdade: interpolação com .env, env_file,
   depends_on com condição, healthcheck, redes e volumes do projeto,
   profiles, secrets e configs. Sobe a stack no motor real.
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, getopt } = LX;
  const P = (sh, p) => FileSystem.normalize(p, sh.cwd);

  const NOMES_PADRAO = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'];

  /* -------------------------------------------------------------------
     Interpolação: ${VAR}, ${VAR:-padrão}, ${VAR:?erro}, $$ literal
     ------------------------------------------------------------------- */
  function interpolar(texto, vars, erros) {
    return String(texto).replace(/\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)((?::?[-?+])([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (todo, k1, opDef, valor, k2) => {
        if (todo === '$$') return '$';
        const chave = k1 || k2;
        const v = vars[chave];
        const definida = v !== undefined && v !== null;
        const naoVazia = definida && v !== '';
        if (!opDef) return definida ? v : '';
        const op = opDef.replace(/[^-?+:]/g, '');
        const testeVazio = op.startsWith(':');
        const ok = testeVazio ? naoVazia : definida;
        if (op.endsWith('-')) return ok ? v : valor;
        if (op.endsWith('?')) {
          if (!ok) { erros.push(`required variable ${chave} is missing a value: ${valor || 'erro'}`); return ''; }
          return v;
        }
        if (op.endsWith('+')) return ok ? valor : '';
        return definida ? v : '';
      });
  }

  /* Lê um arquivo no formato chave=valor (.env e env_file) */
  function lerEnvFile(sh, caminho) {
    let texto;
    try { texto = sh.m.fs.readFile(caminho, sh.fsopts()); } catch (e) { return null; }
    const out = {};
    for (const bruta of texto.split('\n')) {
      const l = bruta.trim();
      if (!l || l.startsWith('#')) continue;
      const dp = l.indexOf('=');
      if (dp < 0) { out[l] = undefined; continue; }
      let v = l.slice(dp + 1);
      /* aspas ao redor do valor inteiro são removidas */
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[l.slice(0, dp).replace(/^export\s+/, '').trim()] = v;
    }
    return out;
  }

  /* -------------------------------------------------------------------
     Carregar o projeto
     ------------------------------------------------------------------- */
  function carregar(sh, io, opts) {
    const arquivos = opts.arquivos && opts.arquivos.length ? opts.arquivos.map(a => P(sh, a)) : null;
    let caminhos = arquivos;
    if (!caminhos) {
      caminhos = [];
      for (const n of NOMES_PADRAO) {
        const p = P(sh, n);
        if (sh.m.fs.exists(p, sh.fsopts())) {
          caminhos.push(p);
          /* o arquivo de sobreposição entra automaticamente, depois do base */
          const base = n.replace(/\.(ya?ml)$/, '');
          for (const ext of ['yaml', 'yml']) {
            const o = P(sh, `${base}.override.${ext}`);
            if (sh.m.fs.exists(o, sh.fsopts())) { caminhos.push(o); break; }
          }
          break;
        }
      }
      if (!caminhos.length) {
        return { erro: `no configuration file provided: not found` };
      }
    }
    for (const c of caminhos) {
      if (!sh.m.fs.exists(c, sh.fsopts())) return { erro: `stat ${c}: no such file or directory` };
    }
    const dirProjeto = FileSystem.dirname(caminhos[0]);

    /* variáveis para a interpolação: .env + ambiente do shell */
    const vars = {};
    const envPadrao = lerEnvFile(sh, opts.envFile ? P(sh, opts.envFile) : dirProjeto + '/.env');
    if (opts.envFile && envPadrao === null) return { erro: `env file ${P(sh, opts.envFile)} not found: stat ${P(sh, opts.envFile)}: no such file or directory` };
    if (envPadrao) for (const k in envPadrao) if (envPadrao[k] !== undefined) vars[k] = envPadrao[k];
    /* o ambiente do shell tem precedência sobre o .env */
    for (const k of (sh.vars ? Object.keys(sh.vars) : [])) {
      const v = sh.getVar(k);
      if (v !== undefined && /^[A-Z_][A-Z0-9_]*$/.test(k)) vars[k] = v;
    }

    const erros = [];
    let doc = {};
    const avisos = [];
    for (const c of caminhos) {
      let texto;
      try { texto = sh.m.fs.readFile(c, sh.fsopts()); } catch (e) { return { erro: `stat ${c}: no such file or directory` }; }
      if (/^\s*version\s*:/m.test(texto)) {
        avisos.push(`the attribute \`version\` is obsolete, it will be ignored, please remove it to avoid potential confusion`);
      }
      const interpolado = interpolar(texto, vars, erros);
      if (erros.length) return { erro: erros[0] };
      let y;
      try { y = LX.lerYaml(interpolado); }
      catch (err) {
        if (err.yaml) return { erro: `parsing ${c}: yaml: line ${err.linha}: ${err.message}` };
        return { erro: `parsing ${c}: ${err.message}` };
      }
      if (y === null) y = {};
      if (typeof y !== 'object' || Array.isArray(y)) return { erro: `${c}: top-level object must be a mapping` };
      doc = fundir(doc, y);
    }
    delete doc.version;

    if (!doc.services || typeof doc.services !== 'object') {
      return { erro: `validating ${caminhos[0]}: services must be a mapping` };
    }

    let nome = opts.projeto || doc.name ||
      FileSystem.basename(dirProjeto).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!nome) nome = 'projeto';

    return { ok: true, doc, nome, dir: dirProjeto, caminhos, vars, avisos };
  }

  function fundir(a, b) {
    const out = Object.assign({}, a);
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) {
        out[k] = fundir(a[k], b[k]);
      } else out[k] = b[k];
    }
    return out;
  }

  /* -------------------------------------------------------------------
     Traduzir um serviço para o formato do motor
     ------------------------------------------------------------------- */
  function montarSpec(sh, proj, nomeServico, svc, opts) {
    const spec = {
      nome: svc.container_name || `${proj.nome}-${nomeServico}-1`,
      servico: nomeServico, projeto: proj.nome,
      env: {}, portas: [], montagens: [], redes: [], labels: {}, recursos: {}, expostas: {},
      capAdd: [], capDrop: [], securityOpt: []
    };

    /* env_file antes de environment: environment vence */
    const arquivosEnv = [].concat(svc.env_file || []);
    for (const ef of arquivosEnv) {
      const caminho = typeof ef === 'string' ? ef : ef.path;
      const obrig = typeof ef === 'string' ? true : (ef.required !== false);
      const dados = lerEnvFile(sh, FileSystem.normalize(caminho, proj.dir));
      if (dados === null) {
        if (obrig) return { erro: `env file ${FileSystem.normalize(caminho, proj.dir)} not found: stat ${FileSystem.normalize(caminho, proj.dir)}: no such file or directory` };
        continue;
      }
      for (const k in dados) spec.env[k] = dados[k] === undefined ? (sh.getVar(k) || '') : dados[k];
    }
    if (Array.isArray(svc.environment)) {
      for (const item of svc.environment) {
        const s = String(item);
        const dp = s.indexOf('=');
        if (dp < 0) spec.env[s] = sh.getVar(s) || '';
        else spec.env[s.slice(0, dp)] = s.slice(dp + 1);
      }
    } else if (svc.environment && typeof svc.environment === 'object') {
      for (const k in svc.environment) {
        const v = svc.environment[k];
        spec.env[k] = v === null || v === undefined ? (sh.getVar(k) || '') : String(v);
      }
    }

    /* ports */
    for (const p of [].concat(svc.ports || [])) {
      if (typeof p === 'object' && p !== null) {
        spec.portas.push({
          hostIp: p.host_ip || '0.0.0.0', hostPort: p.published ? parseInt(p.published, 10) : null,
          contPort: parseInt(p.target, 10), proto: p.protocol || 'tcp'
        });
        continue;
      }
      const analisado = LX.dockerAnalisarPorta(String(p));
      if (!analisado) return { erro: `services.${nomeServico}.ports: invalid port specification: "${p}"` };
      spec.portas.push(analisado);
    }
    for (const x of [].concat(svc.expose || [])) {
      const [porta, proto] = String(x).split('/');
      spec.expostas[`${parseInt(porta, 10)}/${proto || 'tcp'}`] = {};
    }

    /* volumes */
    for (const v of [].concat(svc.volumes || [])) {
      if (typeof v === 'object' && v !== null) {
        if (v.type === 'bind') spec.montagens.push({ tipo: 'bind', origem: FileSystem.normalize(v.source, proj.dir), destino: v.target, ro: !!v.read_only, criarSeFaltar: true });
        else if (v.type === 'tmpfs') spec.montagens.push({ tipo: 'tmpfs', destino: v.target, tamanhoKb: v.tmpfs && v.tmpfs.size ? Math.round(v.tmpfs.size / 1024) : undefined });
        else spec.montagens.push({ tipo: 'volume', nome: nomeVolume(proj, v.source), destino: v.target, ro: !!v.read_only });
        continue;
      }
      const mo = LX.dockerAnalisarVolume(String(v));
      if (!mo) return { erro: `services.${nomeServico}.volumes: invalid mount config: "${v}"` };
      if (mo.tipo === 'bind') mo.origem = FileSystem.normalize(mo.origem, proj.dir);
      else if (mo.nome) mo.nome = nomeVolume(proj, mo.nome);
      spec.montagens.push(mo);
    }

    /* networks */
    const redesDeclaradas = svc.networks;
    if (Array.isArray(redesDeclaradas)) {
      for (const n of redesDeclaradas) spec.redes.push({ nome: nomeRede(proj, n), aliases: [nomeServico] });
    } else if (redesDeclaradas && typeof redesDeclaradas === 'object') {
      for (const n in redesDeclaradas) {
        const cfg = redesDeclaradas[n] || {};
        spec.redes.push({ nome: nomeRede(proj, n), aliases: [nomeServico].concat(cfg.aliases || []), ip: cfg.ipv4_address });
      }
    } else {
      spec.redes.push({ nome: proj.nome + '_default', aliases: [nomeServico] });
    }

    if (svc.labels) {
      if (Array.isArray(svc.labels)) for (const l of svc.labels) { const dp = String(l).indexOf('='); if (dp > 0) spec.labels[String(l).slice(0, dp)] = String(l).slice(dp + 1); else spec.labels[l] = ''; }
      else for (const k in svc.labels) spec.labels[k] = String(svc.labels[k]);
    }
    spec.labels['com.docker.compose.project'] = proj.nome;
    spec.labels['com.docker.compose.service'] = nomeServico;
    spec.labels['com.docker.compose.container-number'] = '1';

    if (svc.command !== undefined) spec.cmd = Array.isArray(svc.command) ? svc.command.map(String) : (svc.command === null ? [] : String(svc.command).split(/\s+/));
    if (svc.entrypoint !== undefined) spec.entrypoint = Array.isArray(svc.entrypoint) ? svc.entrypoint.map(String) : (svc.entrypoint === null ? [] : String(svc.entrypoint).split(/\s+/));
    if (svc.restart) {
      const m = /^(no|always|unless-stopped|on-failure)(?::(\d+))?$/.exec(String(svc.restart));
      if (!m) return { erro: `services.${nomeServico}.restart: invalid restart policy: ${svc.restart}` };
      spec.restart = { politica: m[1], maxTentativas: m[2] ? +m[2] : 0 };
    }
    if (svc.user) spec.usuario = String(svc.user);
    if (svc.working_dir) spec.workdir = svc.working_dir;
    if (svc.hostname) spec.hostname = svc.hostname;
    if (svc.read_only) spec.somenteLeitura = true;
    if (svc.privileged) spec.privilegiado = true;
    if (svc.tty) spec.tty = true;
    if (svc.stdin_open) spec.interativo = true;
    if (svc.stop_signal) spec.stopSignal = svc.stop_signal;
    if (svc.cap_add) spec.capAdd = [].concat(svc.cap_add).map(String);
    if (svc.cap_drop) spec.capDrop = [].concat(svc.cap_drop).map(String);
    if (svc.security_opt) spec.securityOpt = [].concat(svc.security_opt).map(String);
    if (svc.deploy && svc.deploy.resources && svc.deploy.resources.limits) {
      const l = svc.deploy.resources.limits;
      if (l.cpus !== undefined) spec.recursos.cpus = parseFloat(l.cpus);
      if (l.memory !== undefined) spec.recursos.memoria = LX.dockerBytes(String(l.memory));
    }
    if (svc.deploy && svc.deploy.resources && svc.deploy.resources.reservations) {
      const r = svc.deploy.resources.reservations;
      if (r.memory !== undefined) spec.recursos.memoriaReserva = LX.dockerBytes(String(r.memory));
    }
    if (svc.mem_limit) spec.recursos.memoria = LX.dockerBytes(String(svc.mem_limit));

    /* healthcheck */
    if (svc.healthcheck) {
      const h = svc.healthcheck;
      if (h.disable) spec.saude = { Test: ['NONE'] };
      else {
        const teste = Array.isArray(h.test) ? h.test.map(String) : ['CMD-SHELL', String(h.test)];
        spec.saude = {
          Test: teste,
          Retries: h.retries !== undefined ? parseInt(h.retries, 10) : 3,
          IntervalTexto: h.interval, TimeoutTexto: h.timeout, StartPeriodTexto: h.start_period
        };
      }
    }

    /* secrets: montados em /run/secrets/<nome> */
    for (const s of [].concat(svc.secrets || [])) {
      const nomeS = typeof s === 'string' ? s : s.source;
      const alvo = typeof s === 'string' ? `/run/secrets/${nomeS}` : (s.target && s.target.startsWith('/') ? s.target : `/run/secrets/${s.target || nomeS}`);
      const def = (proj.doc.secrets || {})[nomeS];
      if (!def) return { erro: `service "${nomeServico}" refers to undefined secret "${nomeS}"` };
      if (def.file) spec.montagens.push({ tipo: 'bind', origem: FileSystem.normalize(def.file, proj.dir), destino: alvo, ro: true, criarSeFaltar: false });
      else spec.segredos = (spec.segredos || []).concat([{ nome: nomeS, alvo, conteudo: def.environment ? (sh.getVar(def.environment) || '') : (def.content || '') }]);
    }
    for (const cfgItem of [].concat(svc.configs || [])) {
      const nomeC = typeof cfgItem === 'string' ? cfgItem : cfgItem.source;
      const alvo = typeof cfgItem === 'string' ? `/${nomeC}` : (cfgItem.target || `/${nomeC}`);
      const def = (proj.doc.configs || {})[nomeC];
      if (!def) return { erro: `service "${nomeServico}" refers to undefined config "${nomeC}"` };
      if (def.file) spec.montagens.push({ tipo: 'bind', origem: FileSystem.normalize(def.file, proj.dir), destino: alvo, ro: true, criarSeFaltar: false });
      else spec.segredos = (spec.segredos || []).concat([{ nome: nomeC, alvo, conteudo: def.content || '' }]);
    }

    spec.imagem = svc.image;
    spec.build = svc.build;
    spec.pullPolicy = svc.pull_policy;
    return { spec };
  }

  function nomeVolume(proj, nome) {
    const def = (proj.doc.volumes || {})[nome];
    if (def && def.external) return def.name || nome;
    if (def && def.name) return def.name;
    return `${proj.nome}_${nome}`;
  }
  function nomeRede(proj, nome) {
    const def = (proj.doc.networks || {})[nome];
    if (def && def.external) return def.name || nome;
    if (def && def.name) return def.name;
    return `${proj.nome}_${nome}`;
  }

  /* depends_on em forma curta ou longa */
  function dependencias(svc) {
    const d = svc.depends_on;
    if (!d) return [];
    if (Array.isArray(d)) return d.map(n => ({ servico: n, condicao: 'service_started' }));
    return Object.keys(d).map(n => ({
      servico: n,
      condicao: (d[n] && d[n].condition) || 'service_started',
      obrigatorio: !(d[n] && d[n].required === false)
    }));
  }

  /* ordenação topológica pelas dependências */
  function ordenar(nomes, doc) {
    const feitos = [], visto = new Set(), naPilha = new Set();
    const visita = (n) => {
      if (visto.has(n)) return;
      if (naPilha.has(n)) return;
      naPilha.add(n);
      for (const d of dependencias(doc.services[n] || {})) {
        if (doc.services[d.servico] && nomes.includes(d.servico)) visita(d.servico);
      }
      naPilha.delete(n);
      visto.add(n);
      feitos.push(n);
    };
    for (const n of nomes) visita(n);
    return feitos;
  }

  /* serviços ativos considerando profiles */
  function servicosAtivos(doc, perfis) {
    const out = [];
    for (const n in doc.services) {
      const p = doc.services[n].profiles;
      if (!p || !p.length) { out.push(n); continue; }
      if ([].concat(p).some(x => perfis.includes(x))) out.push(n);
    }
    return out;
  }

  /* =====================================================================
     O subcomando
     ===================================================================== */
  LX.cmdDockerCompose = async function (sh, io, args) {
    const e = sh.m.docker;
    const opts = { arquivos: [], perfis: [] };
    let i = 0;
    for (; i < args.length; i++) {
      let a = args[i], v = null;
      const eq = a.indexOf('=');
      if (a.startsWith('--') && eq > 0) { v = a.slice(eq + 1); a = a.slice(0, eq); }
      if (a === '-f' || a === '--file') { opts.arquivos.push(v !== null ? v : args[++i]); continue; }
      if (a === '-p' || a === '--project-name') { opts.projeto = v !== null ? v : args[++i]; continue; }
      if (a === '--env-file') { opts.envFile = v !== null ? v : args[++i]; continue; }
      if (a === '--profile') { opts.perfis.push(v !== null ? v : args[++i]); continue; }
      if (a === '--project-directory') { opts.dir = v !== null ? v : args[++i]; continue; }
      if (a === '--progress' || a === '--parallel' || a === '--ansi') { i++; continue; }
      if (a === '--dry-run' || a === '--compatibility') continue;
      if (a === 'version' || a === '--version' || a === '-v') {
        io.stdout.write(`Docker Compose version ${e.versao.compose}\n`);
        return 0;
      }
      break;
    }
    const sub = args[i];
    const resto = args.slice(i + 1);
    if (!sub || sub === 'help' || sub === '--help') return ajudaCompose(io);

    const proj = carregar(sh, io, opts);
    if (proj.erro) {
      io.stderr.write(proj.erro.startsWith('no configuration')
        ? `no configuration file provided: not found\n`
        : `${proj.erro}\n`);
      return 1;
    }
    for (const a of proj.avisos) io.stderr.write(`WARN[0000] ${a} \n`);

    switch (sub) {
      case 'up': return await composeUp(sh, io, proj, resto, opts);
      case 'down': return composeDown(sh, io, proj, resto);
      case 'ps': return await composePs(sh, io, proj, resto);
      case 'logs': return await composeLogs(sh, io, proj, resto);
      case 'stop': return composeSimples(sh, io, proj, resto, 'stop');
      case 'start': return composeSimples(sh, io, proj, resto, 'start');
      case 'restart': return composeSimples(sh, io, proj, resto, 'restart');
      case 'kill': return composeSimples(sh, io, proj, resto, 'kill');
      case 'rm': return composeRm(sh, io, proj, resto);
      case 'pull': return composePull(sh, io, proj, resto);
      case 'build': return await composeBuild(sh, io, proj, resto, opts);
      case 'exec': return await composeExec(sh, io, proj, resto);
      case 'run': return await composeRun(sh, io, proj, resto, opts);
      case 'config': return composeConfig(sh, io, proj, resto, opts);
      case 'images': return composeImages(sh, io, proj);
      case 'top': return composeTop(sh, io, proj);
      case 'version': io.stdout.write(`Docker Compose version ${e.versao.compose}\n`); return 0;
      default:
        io.stderr.write(`unknown docker command: compose ${sub}\n`);
        return 1;
    }
  };

  function ajudaCompose(io) {
    io.stdout.write(
      `Usage:  docker compose [OPTIONS] COMMAND\n\nDefine and run multi-container applications with Docker\n\n` +
      `Options:\n      --env-file stringArray   Specify an alternate environment file\n` +
      `  -f, --file stringArray       Compose configuration files\n` +
      `  -p, --project-name string    Project name\n` +
      `      --profile stringArray    Specify a profile to enable\n\n` +
      `Commands:\n  build       Build or rebuild services\n  config      Parse, resolve and render compose file in canonical format\n` +
      `  down        Stop and remove containers, networks\n  exec        Execute a command in a running container\n` +
      `  images      List images used by the created containers\n  kill        Force stop service containers\n` +
      `  logs        View output from containers\n  ps          List containers\n  pull        Pull service images\n` +
      `  restart     Restart service containers\n  rm          Removes stopped service containers\n` +
      `  run         Run a one-off command on a service\n  start       Start services\n  stop        Stop services\n` +
      `  top         Display the running processes\n  up          Create and start containers\n\n`);
    return 0;
  }

  function containersDoProjeto(e, proj, servicos) {
    return Array.from(e.containers.values())
      .filter(c => c.projeto === proj.nome && (!servicos || !servicos.length || servicos.includes(c.servico)));
  }

  /* --------------------------------- up --------------------------------- */
  async function composeUp(sh, io, proj, args, gopts) {
    const e = sh.m.docker;
    const { opts, rest } = getopt(args, {
      d: 0, '--detach': 0, '--build': 0, '--force-recreate': 0, '--no-deps': 0, '--no-recreate': 0,
      '--remove-orphans': 0, '--wait': 0, '--pull': 1, '--no-build': 0, '--scale': 1, '--abort-on-container-exit': 0, '--wait-timeout': 1
    });
    const detach = opts.d || opts['--detach'] || opts['--wait'];
    let alvos = rest.length ? rest : servicosAtivos(proj.doc, gopts.perfis);
    for (const s of alvos) {
      if (!proj.doc.services[s]) { io.stderr.write(`no such service: ${s}\n`); return 1; }
    }
    if (!opts['--no-deps']) {
      const fila = alvos.slice();
      while (fila.length) {
        const n = fila.shift();
        for (const d of dependencias(proj.doc.services[n] || {})) {
          if (!alvos.includes(d.servico) && proj.doc.services[d.servico]) { alvos.push(d.servico); fila.push(d.servico); }
        }
      }
    }
    const ordem = ordenar(alvos, proj.doc);

    /* redes do projeto */
    const redesUsadas = new Set();
    for (const s of ordem) {
      const svc = proj.doc.services[s];
      if (Array.isArray(svc.networks)) svc.networks.forEach(n => redesUsadas.add(n));
      else if (svc.networks && typeof svc.networks === 'object') Object.keys(svc.networks).forEach(n => redesUsadas.add(n));
      else redesUsadas.add('__default__');
    }
    for (const n of redesUsadas) {
      const nomeReal = n === '__default__' ? proj.nome + '_default' : nomeRede(proj, n);
      const def = n === '__default__' ? {} : ((proj.doc.networks || {})[n] || {});
      if (def.external) {
        if (!e.redePorNome(nomeReal)) {
          io.stderr.write(`network ${nomeReal} declared as external, but could not be found\n`);
          return 1;
        }
        continue;
      }
      if (!e.networks.has(nomeReal)) {
        io.stdout.write(` Network ${nomeReal}  Creating\n`);
        e.criarRede(nomeReal, { driver: def.driver || 'bridge', interno: !!def.internal, projeto: proj.nome, subnet: def.ipam && def.ipam.config && def.ipam.config[0] && def.ipam.config[0].subnet });
        io.stdout.write(` Network ${nomeReal}  Created\n`);
      }
    }
    /* volumes nomeados declarados */
    for (const nomeV in (proj.doc.volumes || {})) {
      const def = proj.doc.volumes[nomeV] || {};
      const real = nomeVolume(proj, nomeV);
      if (def.external) {
        if (!e.volumes.has(real)) { io.stderr.write(`external volume "${real}" not found\n`); return 1; }
        continue;
      }
      if (!e.volumes.has(real)) {
        io.stdout.write(` Volume "${real}"  Creating\n`);
        e.criarVolume(real, { projeto: proj.nome });
        io.stdout.write(` Volume "${real}"  Created\n`);
      }
    }

    if (opts['--remove-orphans']) {
      for (const c of containersDoProjeto(e, proj)) {
        if (!proj.doc.services[c.servico]) {
          io.stdout.write(` Container ${c.nome}  Removing\n`);
          e.remover(c, { force: true });
        }
      }
    }

    const criados = [];
    for (const nomeServico of ordem) {
      const svc = proj.doc.services[nomeServico];
      const m = montarSpec(sh, proj, nomeServico, svc, opts);
      if (m.erro) { io.stderr.write(`${m.erro}\n`); return 1; }
      const spec = m.spec;

      /* build quando o serviço declara build: */
      if (svc.build && (opts['--build'] || !spec.imagem || !e.imagemPorRef(spec.imagem))) {
        if (opts['--no-build'] && !e.imagemPorRef(spec.imagem)) {
          io.stderr.write(`service "${nomeServico}" needs to be built, but --no-build was set\n`);
          return 1;
        }
        const b = svc.build;
        const ctxDir = typeof b === 'string' ? b : (b.context || '.');
        const tag = spec.imagem || `${proj.nome}-${nomeServico}`;
        const argsBuild = ['-t', tag];
        if (typeof b === 'object') {
          if (b.dockerfile) argsBuild.push('-f', FileSystem.normalize(b.dockerfile, FileSystem.normalize(ctxDir, proj.dir)));
          if (b.target) argsBuild.push('--target', b.target);
          const bargs = b.args;
          if (Array.isArray(bargs)) for (const x of bargs) argsBuild.push('--build-arg', String(x));
          else if (bargs) for (const k in bargs) argsBuild.push('--build-arg', `${k}=${bargs[k]}`);
        }
        argsBuild.push(FileSystem.normalize(ctxDir, proj.dir));
        io.stdout.write(`[+] Building 0.0s (0/0)\n`);
        const cod = await LX.cmdDockerBuild(sh, io, argsBuild);
        if (cod !== 0) return cod;
        spec.imagem = tag;
      }
      if (!spec.imagem) {
        io.stderr.write(`service "${nomeServico}" has neither an image nor a build context specified: invalid compose project\n`);
        return 1;
      }

      /* recriar se já existe */
      const existente = e.containerPorNome(spec.nome);
      if (existente) {
        const mudou = opts['--force-recreate'] || opts['--build'] ||
          existente.imagemRef !== spec.imagem ||
          JSON.stringify(existente.env) !== JSON.stringify(spec.env) ||
          existente.portas.length !== spec.portas.length;
        if (!mudou && !opts['--force-recreate']) {
          if (!existente.rodando) { io.stdout.write(` Container ${spec.nome}  Starting\n`); e.iniciar(existente); io.stdout.write(` Container ${spec.nome}  Started\n`); }
          else io.stdout.write(` Container ${spec.nome}  Running\n`);
          criados.push(existente);
          continue;
        }
        io.stdout.write(` Container ${spec.nome}  Recreate\n`);
        e.remover(existente, { force: true });
      }

      /* depends_on: esperar a condição antes de subir */
      for (const d of dependencias(svc)) {
        if (!proj.doc.services[d.servico]) continue;
        const alvo = e.containerPorNome((proj.doc.services[d.servico].container_name) || `${proj.nome}-${d.servico}-1`);
        if (!alvo) continue;
        if (d.condicao === 'service_healthy') {
          let saudavel = false;
          for (let t = 0; t < 12 && alvo.rodando; t++) {
            const est = await e.avaliarSaude(alvo);
            if (est === 'healthy') { saudavel = true; break; }
            if (est === 'none') { saudavel = true; break; }
            alvo.saude.falhas = Math.max(0, alvo.saude.falhas - 1);
          }
          if (!saudavel) {
            io.stderr.write(`dependency failed to start: container ${alvo.nome} is unhealthy\n`);
            return 1;
          }
        } else if (d.condicao === 'service_completed_successfully') {
          if (alvo.rodando) { io.stderr.write(`dependency failed to start: container ${alvo.nome} did not complete successfully\n`); return 1; }
          if (alvo.saida !== 0) { io.stderr.write(`dependency failed to start: container ${alvo.nome} exited (${alvo.saida})\n`); return 1; }
        }
      }

      io.stdout.write(` Container ${spec.nome}  Creating\n`);
      const criacao = e.criarContainer(spec);
      if (!criacao.ok) { io.stderr.write(criacao.erro.replace(/^docker: /, '') + '\n'); return 1; }
      const c = criacao.container;
      /* segredos e configs vindos de content:/environment: */
      for (const s of (spec.segredos || [])) {
        try {
          c.maquina.fs.mkdirp(FileSystem.dirname(s.alvo), { ctx: c.maquina.ctxRoot() });
          const n = c.maquina.fs.writeFile(s.alvo, s.conteudo, { ctx: c.maquina.ctxRoot() });
          n.mode = 0o444;
        } catch (err) { }
      }
      io.stdout.write(` Container ${spec.nome}  Created\n`);
      io.stdout.write(` Container ${spec.nome}  Starting\n`);
      const ini = e.iniciar(c);
      if (!ini.ok) {
        io.stdout.write(` Container ${spec.nome}  Error\n`);
        io.stderr.write(ini.erro.replace(/^docker: /, '') + '\n');
        return 1;
      }
      /* Serviço cujo comando termina (uma migração, um `seed`) não fica de
         pé: o processo roda, escreve no log e o container vai para Exited.
         É o que permite `depends_on: condition: service_completed_successfully`. */
      if (c.efemera && !e.comandoLongo(c)) {
        const pedacos = [];
        const ioLog = {
          stdin: new LX.InStream(''),
          stdout: new LX.Stream({ onWrite: t => pedacos.push(t) }),
          stderr: new LX.Stream({ onWrite: t => pedacos.push(t) }),
          term: io.term
        };
        await e.rodarPrincipal(c, ioLog);
        const texto = pedacos.join('');
        if (texto) c.registrar(texto.replace(/\n$/, ''));
        io.stdout.write(` Container ${spec.nome}  Exited\n`);
        criados.push(c);
        continue;
      }
      io.stdout.write(` Container ${spec.nome}  Started\n`);
      criados.push(c);
    }

    if (opts['--wait']) {
      for (const c of criados) {
        if (!c.saudeConfig) continue;
        for (let t = 0; t < 12; t++) { const est = await e.avaliarSaude(c); if (est === 'healthy' || est === 'none') break; }
        io.stdout.write(` Container ${c.nome}  Healthy\n`);
      }
    }
    if (detach) return 0;

    /* primeiro plano: logs de todos, com prefixo por serviço */
    for (const c of criados) LX.dockerImprimirLogs(io, c, {}, `${c.servico}-1  | `);
    if (io.term && io.term.follow) {
      const vistos = new Map(criados.map(c => [c.id, c.logs.length]));
      await io.term.follow(async () => {
        let saida = '';
        for (const c of criados) {
          const v = vistos.get(c.id) || 0;
          const novos = c.logs.slice(v);
          vistos.set(c.id, c.logs.length);
          for (const l of novos) saida += `${c.servico}-1  | ${l.texto}\n`;
        }
        return saida;
      });
      io.stdout.write('^CGracefully stopping... (press Ctrl+C again to force)\n');
      for (const c of criados) if (e.containers.has(c.id) && c.rodando) { io.stdout.write(` Container ${c.nome}  Stopping\n`); e.parar(c); io.stdout.write(` Container ${c.nome}  Stopped\n`); }
      return 130;
    }
    return 0;
  }

  /* -------------------------------- down -------------------------------- */
  function composeDown(sh, io, proj, args) {
    const e = sh.m.docker;
    const { opts } = getopt(args, { v: 0, '--volumes': 0, '--rmi': 1, '--remove-orphans': 0, t: 1, '--timeout': 1 });
    const cont = containersDoProjeto(e, proj);
    for (const c of cont) {
      if (c.rodando) { io.stdout.write(` Container ${c.nome}  Stopping\n`); e.parar(c); io.stdout.write(` Container ${c.nome}  Stopped\n`); }
      io.stdout.write(` Container ${c.nome}  Removing\n`);
      e.remover(c, { force: true, volumes: opts.v || opts['--volumes'] });
      io.stdout.write(` Container ${c.nome}  Removed\n`);
    }
    /* volumes NOMEADOS só somem com -v — é a diferença que salva os dados */
    if (opts.v || opts['--volumes']) {
      for (const nomeV in (proj.doc.volumes || {})) {
        const def = proj.doc.volumes[nomeV] || {};
        if (def.external) continue;
        const real = nomeVolume(proj, nomeV);
        if (!e.volumes.has(real)) continue;
        io.stdout.write(` Volume ${real}  Removing\n`);
        const r = e.removerVolume(real, { force: true });
        io.stdout.write(` Volume ${real}  ${r.ok ? 'Removed' : 'Error'}\n`);
      }
    }
    const redes = new Set([proj.nome + '_default']);
    for (const n in (proj.doc.networks || {})) { if (!(proj.doc.networks[n] || {}).external) redes.add(nomeRede(proj, n)); }
    for (const n of redes) {
      if (!e.networks.has(n)) continue;
      io.stdout.write(` Network ${n}  Removing\n`);
      const r = e.removerRede(n);
      io.stdout.write(` Network ${n}  ${r.ok ? 'Removed' : 'Resource is still in use'}\n`);
    }
    if (opts['--rmi']) {
      for (const c of cont) {
        const img = e.imagens.get(c.imagemId);
        if (!img) continue;
        if (opts['--rmi'] === 'local' && !img.local) continue;
        e.removerImagem(Array.from(img.tags)[0] || img.id, { force: true });
        io.stdout.write(` Image ${Array.from(img.tags)[0] || img.idCurto}  Removed\n`);
      }
    }
    return 0;
  }

  /* --------------------------------- ps --------------------------------- */
  async function composePs(sh, io, proj, args) {
    const e = sh.m.docker;
    const { opts, rest } = getopt(args, { a: 0, q: 0, '--all': 0, '--quiet': 0, '--format': 1, '--services': 0, '--status': 1 });
    let lista = containersDoProjeto(e, proj, rest);
    if (!(opts.a || opts['--all'])) lista = lista.filter(c => c.rodando || c.estado === 'paused' || c.estado === 'restarting');
    for (const c of lista) if (c.saudeConfig && c.rodando) { try { await e.avaliarSaude(c); } catch (err) { } }
    if (opts['--services']) { for (const c of lista) io.stdout.write(c.servico + '\n'); return 0; }
    if (opts.q || opts['--quiet']) { for (const c of lista) io.stdout.write(c.id + '\n'); return 0; }
    if (opts['--format']) {
      for (const c of lista) io.stdout.write(LX.dockerFormato(opts['--format'], { Name: c.nome, Service: c.servico, State: c.estado, Status: c.status, Image: c.imagemRef, Ports: c.portasTexto }) + '\n');
      return 0;
    }
    LX.dockerTabela(io, ['NAME', 'IMAGE', 'COMMAND', 'SERVICE', 'CREATED', 'STATUS', 'PORTS'],
      lista.map(c => {
        const argv = c.entrypoint.concat(c.cmd).join(' ');
        return [c.nome, c.imagemRef, `"${argv.length > 18 ? argv.slice(0, 17) + '…' : argv}"`, c.servico,
        LX.dockerIdade(c.criadoEm), c.status, c.portasTexto];
      }));
    return 0;
  }

  async function composeLogs(sh, io, proj, args) {
    const e = sh.m.docker;
    const { opts, rest } = getopt(args, { f: 0, '--follow': 0, n: 1, '--tail': 1, t: 0, '--timestamps': 0, '--no-color': 0, '--no-log-prefix': 0 });
    const lista = containersDoProjeto(e, proj, rest);
    if (!lista.length) { return 0; }
    const largura = Math.max(...lista.map(c => (c.servico || c.nome).length + 2));
    for (const c of lista) {
      const rot = opts['--no-log-prefix'] ? '' : `${(c.servico || c.nome) + '-1'}`.padEnd(largura + 2) + '| ';
      LX.dockerImprimirLogs(io, c, { tail: opts.n || opts['--tail'], timestamps: opts.t || opts['--timestamps'] }, rot);
    }
    if ((opts.f || opts['--follow']) && io.term && io.term.follow) {
      const vistos = new Map(lista.map(c => [c.id, c.logs.length]));
      await io.term.follow(async () => {
        let saida = '';
        for (const c of lista) {
          const v = vistos.get(c.id) || 0;
          const novos = c.logs.slice(v);
          vistos.set(c.id, c.logs.length);
          const rot = `${(c.servico || c.nome) + '-1'}`.padEnd(largura + 2) + '| ';
          for (const l of novos) saida += rot + l.texto + '\n';
        }
        return saida;
      });
    }
    return 0;
  }

  function composeSimples(sh, io, proj, args, acao) {
    const e = sh.m.docker;
    const rest = args.filter(a => !a.startsWith('-'));
    const lista = containersDoProjeto(e, proj, rest);
    for (const c of lista) {
      if (acao === 'stop') { if (c.rodando) { io.stdout.write(` Container ${c.nome}  Stopping\n`); e.parar(c); io.stdout.write(` Container ${c.nome}  Stopped\n`); } }
      else if (acao === 'kill') { e.parar(c, { sinal: 'SIGKILL' }); io.stdout.write(` Container ${c.nome}  Killed\n`); }
      else if (acao === 'start') { io.stdout.write(` Container ${c.nome}  Starting\n`); e.iniciar(c); io.stdout.write(` Container ${c.nome}  Started\n`); }
      else if (acao === 'restart') { io.stdout.write(` Container ${c.nome}  Restarting\n`); e.reiniciar(c); io.stdout.write(` Container ${c.nome}  Started\n`); }
    }
    return 0;
  }

  function composeRm(sh, io, proj, args) {
    const e = sh.m.docker;
    const { opts, rest } = getopt(args, { f: 0, s: 0, v: 0, '--force': 0, '--stop': 0, '--volumes': 0 });
    for (const c of containersDoProjeto(e, proj, rest)) {
      if (c.rodando && !(opts.s || opts['--stop'])) continue;
      if (c.rodando) e.parar(c);
      e.remover(c, { force: true, volumes: opts.v || opts['--volumes'] });
      io.stdout.write(` Container ${c.nome}  Removed\n`);
    }
    return 0;
  }

  function composePull(sh, io, proj, args) {
    const e = sh.m.docker;
    const rest = args.filter(a => !a.startsWith('-'));
    for (const nome in proj.doc.services) {
      if (rest.length && !rest.includes(nome)) continue;
      const svc = proj.doc.services[nome];
      if (!svc.image) continue;
      io.stdout.write(` ${nome} Pulling\n`);
      const r = e.puxar(svc.image, { forcar: true });
      if (!r.ok) { io.stderr.write(` ${nome} Error   ${r.erro.replace('Error response from daemon: ', '')}\n`); return 1; }
      io.stdout.write(` ${nome} Pulled\n`);
    }
    return 0;
  }

  async function composeBuild(sh, io, proj, args, gopts) {
    const { opts, rest } = getopt(args, { '--no-cache': 0, '--pull': 0, q: 0, '--quiet': 0, '--build-arg': 1 });
    for (const nome in proj.doc.services) {
      if (rest.length && !rest.includes(nome)) continue;
      const svc = proj.doc.services[nome];
      if (!svc.build) continue;
      const b = svc.build;
      const ctxDir = typeof b === 'string' ? b : (b.context || '.');
      const tag = svc.image || `${proj.nome}-${nome}`;
      const argsBuild = ['-t', tag];
      if (opts['--no-cache']) argsBuild.push('--no-cache');
      if (typeof b === 'object') {
        if (b.dockerfile) argsBuild.push('-f', FileSystem.normalize(b.dockerfile, FileSystem.normalize(ctxDir, proj.dir)));
        if (b.target) argsBuild.push('--target', b.target);
        const bargs = b.args;
        if (Array.isArray(bargs)) for (const x of bargs) argsBuild.push('--build-arg', String(x));
        else if (bargs) for (const k in bargs) argsBuild.push('--build-arg', `${k}=${bargs[k]}`);
      }
      argsBuild.push(FileSystem.normalize(ctxDir, proj.dir));
      const cod = await LX.cmdDockerBuild(sh, io, argsBuild);
      if (cod !== 0) return cod;
    }
    return 0;
  }

  async function composeExec(sh, io, proj, args) {
    const e = sh.m.docker;
    let i = 0;
    const o = { interativo: true, tty: true };
    for (; i < args.length; i++) {
      const a = args[i];
      if (!a.startsWith('-')) break;
      if (a === '-T') { o.tty = false; continue; }
      if (a === '-it' || a === '-i' || a === '-t') continue;
      if (a === '-u' || a === '--user') { o.usuario = args[++i]; continue; }
      if (a === '-w' || a === '--workdir') { o.workdir = args[++i]; continue; }
      if (a === '-e' || a === '--env') { i++; continue; }
      if (a === '--index') { i++; continue; }
    }
    const servico = args[i];
    const comando = args.slice(i + 1);
    if (!servico) { io.stderr.write(`"docker compose exec" requires at least 2 arguments.\n`); return 1; }
    const c = containersDoProjeto(e, proj, [servico])[0];
    if (!c) { io.stderr.write(`service "${servico}" is not running container\n`); return 1; }
    if (!c.rodando) { io.stderr.write(`service "${servico}" is not running container\n`); return 1; }
    return await LX.dockerRodarNoContainer(e, c, comando, io, o);
  }

  async function composeRun(sh, io, proj, args, gopts) {
    const e = sh.m.docker;
    let i = 0;
    const o = { interativo: true, tty: true, rm: false };
    for (; i < args.length; i++) {
      const a = args[i];
      if (!a.startsWith('-')) break;
      if (a === '--rm') { o.rm = true; continue; }
      if (a === '-T') { o.tty = false; continue; }
      if (a === '--no-deps') { o.semDeps = true; continue; }
      if (a === '-e' || a === '--env' || a === '-u' || a === '--user' || a === '-w' || a === '--workdir' || a === '-p' || a === '--publish' || a === '-v' || a === '--volume') { i++; continue; }
    }
    const servico = args[i];
    const comando = args.slice(i + 1);
    const svc = proj.doc.services[servico];
    if (!svc) { io.stderr.write(`no such service: ${servico}\n`); return 1; }
    const m = montarSpec(sh, proj, servico, svc, {});
    if (m.erro) { io.stderr.write(m.erro + '\n'); return 1; }
    /* run cria um container NOVO e efêmero — não entra no existente */
    m.spec.nome = `${proj.nome}-${servico}-run-${LX.dockerHex(8)}`;
    m.spec.portas = [];
    if (comando.length) m.spec.cmd = comando;
    m.spec.autoRemover = o.rm;
    const criacao = e.criarContainer(m.spec);
    if (!criacao.ok) { io.stderr.write(criacao.erro.replace(/^docker: /, '') + '\n'); return 1; }
    const c = criacao.container;
    const ini = e.iniciar(c);
    if (!ini.ok) { io.stderr.write(ini.erro.replace(/^docker: /, '') + '\n'); return 1; }
    const argv = (c.entrypoint || []).concat(c.cmd || []);
    const argvReal = /entrypoint/.test(argv[0] || '') ? argv.slice(1) : argv;
    let cod = 0;
    if (argvReal.length) cod = await LX.dockerRodarNoContainer(e, c, argvReal, io, o);
    else LX.dockerImprimirLogs(io, c, {});
    if (e.containers.has(c.id)) { if (c.rodando) e.parar(c); if (o.rm && e.containers.has(c.id)) e.remover(c, { force: true }); }
    return cod;
  }

  /* config: a ferramenta de depuração número um */
  function composeConfig(sh, io, proj, args, gopts) {
    const { opts } = getopt(args, { q: 0, '--quiet': 0, '--services': 0, '--volumes': 0, '--format': 1, '--no-interpolate': 0, '--images': 0, '--profiles': 0 });
    if (opts.q || opts['--quiet']) return 0;
    if (opts['--services']) { for (const n of Object.keys(proj.doc.services)) io.stdout.write(n + '\n'); return 0; }
    if (opts['--volumes']) { for (const n of Object.keys(proj.doc.volumes || {})) io.stdout.write(n + '\n'); return 0; }
    if (opts['--images']) {
      for (const n in proj.doc.services) io.stdout.write((proj.doc.services[n].image || `${proj.nome}-${n}`) + '\n');
      return 0;
    }
    /* forma canônica: nome do projeto, serviços normalizados, redes e volumes */
    const canonico = { name: proj.nome, services: {} };
    for (const n of Object.keys(proj.doc.services).sort()) {
      const svc = proj.doc.services[n];
      const m = montarSpec(sh, proj, n, svc, {});
      if (m.erro) { io.stderr.write(m.erro + '\n'); return 1; }
      const s = {};
      if (svc.build) s.build = typeof svc.build === 'string' ? { context: FileSystem.normalize(svc.build, proj.dir) } : Object.assign({}, svc.build, { context: FileSystem.normalize(svc.build.context || '.', proj.dir) });
      if (svc.image) s.image = svc.image;
      if (svc.container_name) s.container_name = svc.container_name;
      if (Object.keys(m.spec.env).length) s.environment = m.spec.env;
      if (m.spec.portas.length) s.ports = m.spec.portas.map(p => ({ mode: 'ingress', target: p.contPort, published: String(p.hostPort || ''), protocol: p.proto }));
      if (m.spec.montagens.length) s.volumes = m.spec.montagens.map(mo => ({ type: mo.tipo, source: mo.tipo === 'volume' ? mo.nome : mo.origem, target: mo.destino, read_only: !!mo.ro }));
      if (svc.depends_on) s.depends_on = dependencias(svc).reduce((a, d) => { a[d.servico] = { condition: d.condicao, required: d.obrigatorio !== false }; return a; }, {});
      if (svc.restart) s.restart = String(svc.restart);
      if (m.spec.cmd) s.command = m.spec.cmd;
      if (m.spec.entrypoint) s.entrypoint = m.spec.entrypoint;
      if (m.spec.saude) s.healthcheck = { test: m.spec.saude.Test, retries: m.spec.saude.Retries };
      if (Object.keys(m.spec.labels).length) s.labels = m.spec.labels;
      s.networks = m.spec.redes.reduce((a, r) => { a[r.nome.replace(new RegExp('^' + proj.nome + '_'), '')] = { aliases: r.aliases }; return a; }, {});
      canonico.services[n] = s;
    }
    if (proj.doc.networks || true) {
      canonico.networks = {};
      const nomes = Object.keys(proj.doc.networks || {});
      if (!nomes.length) canonico.networks.default = { name: proj.nome + '_default' };
      for (const n of nomes) {
        const def = proj.doc.networks[n] || {};
        canonico.networks[n] = Object.assign({ name: nomeRede(proj, n) }, def.driver ? { driver: def.driver } : {}, def.external ? { external: true } : {});
      }
    }
    if (proj.doc.volumes) {
      canonico.volumes = {};
      for (const n in proj.doc.volumes) {
        const def = proj.doc.volumes[n] || {};
        canonico.volumes[n] = Object.assign({ name: nomeVolume(proj, n) }, def.external ? { external: true } : {});
      }
    }
    if (opts['--format'] === 'json') { io.stdout.write(JSON.stringify(canonico, null, 2) + '\n'); return 0; }
    io.stdout.write(LX.yamlDocumento(canonico));
    return 0;
  }

  function composeImages(sh, io, proj) {
    const e = sh.m.docker;
    LX.dockerTabela(io, ['CONTAINER', 'REPOSITORY', 'TAG', 'IMAGE ID', 'SIZE'],
      containersDoProjeto(e, proj).map(c => {
        const img = e.imagens.get(c.imagemId);
        const ref = c.imagemRef || '';
        const dp = ref.lastIndexOf(':');
        return [c.nome, dp > 0 ? ref.slice(0, dp) : ref, dp > 0 ? ref.slice(dp + 1) : 'latest',
        img ? img.idCurto : '', img ? LX.dockerHumano(img.tamanho) : ''];
      }));
    return 0;
  }

  function composeTop(sh, io, proj) {
    const e = sh.m.docker;
    for (const c of containersDoProjeto(e, proj)) {
      if (!c.rodando) continue;
      io.stdout.write(c.nome + '\n');
      LX.dockerTabela(io, ['UID', 'PID', 'PPID', 'C', 'STIME', 'TTY', 'TIME', 'CMD'],
        Array.from(c.maquina.processes.values()).map(p => [p.user || 'root', String(4000 + p.pid), '3985', '0',
        new Date(c.iniciadoEm).toTimeString().slice(0, 5), '?', '00:00:00', p.cmd]));
      io.stdout.write('\n');
    }
    return 0;
  }

  LX.composeCarregar = carregar;
  LX.composeMontarSpec = montarSpec;
  LX.composeInterpolar = interpolar;
})();
