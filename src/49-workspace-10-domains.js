'use strict';
(function () {
  const W = LX.Workspace;
  const { fields, hydrate, data } = W;
  const machineFields = 'hostname bootTime packages dns interfaces routes arp sshKeysAuthorized crontabs mem cpuCount loadavg diskUsedKb diskTotalKb firewall nextPid container devSizes blockDevices aptUpdated pacotesSegurados locateDb sshAgent';
  const processFields = 'pid ppid uid gid user cmd comm state cpu mem rss vsz tty start nice threads unit container unkillable ignoresTerm cwd';
  const unitFields = 'name description type state sub enabled execStart mainPid ports after wants restart user configFiles broken workingDirectory environment execStartPre restartSec wantedBy serviceType fromFile unitFile restartCount';
  const listenerFields = 'addr port proto pid process container';
  const imageFields = 'id tags digest criadaEm camadas os arch autor base local config encerraSozinha tamanhoExtra _defChave arvore';
  const containerFields = 'id nome imagemId imagemRef cmd entrypoint env labels portas portasPedidas publicarTudo expostas montagensPedidas montagens redesPedidas hostname usuario workdir somenteLeitura tty interativo autoRemover recursos restart saudeConfig capAdd capDrop securityOpt privilegiado projeto servico dependeDe stopSignal criadoEm iniciadoEm terminadoEm estado saida erro oom logs reinicios redes saude inventarioBase perfilCarga bancoIniciado redis registroPrivado capacidades envDeArquivo efemera';
  const engineFields = 'volumes networks eventos projetos login versao _nomeSeq _subrede buildCacheItens buildCacheTam';
  const databaseFields = 'motor versao bancos usuarios atual';

  LX.Machine.prototype.exportState = function () {
    return {
      environment: fields(this, machineFields),
      filesystem: this.fs.exportState(),
      processes: Array.from(this.processes, ([id, p]) => [id, fields(p, processFields)]),
      units: Array.from(this.units, ([name, u]) => [name, fields(u, unitFields)]),
      journal: data(this.journal),
      listeners: this.listeners.map(l => fields(l, listenerFields)),
      github: LX.Github.exportState(this)
    };
  };

  LX.Machine.prototype.importState = function (state) {
    Object.assign(this, hydrate(fields(state.environment, machineFields)));
    this.fs.importState(state.filesystem);
    this.processes = new Map(state.processes.map(([id, p]) => [id, Object.assign(new LX.Process({ pid: id }), hydrate(fields(p, processFields)))]));
    const base = this.units;
    this.units = new Map(state.units.map(([name, u]) => [name, Object.assign(base.get(name) || new LX.Unit({ name }), hydrate(fields(u, unitFields)))]));
    this.journal = hydrate(state.journal);
    this.listeners = hydrate(state.listeners);
    LX.Github.importState(this, state.github);
    return this;
  };

  LX.DockerEngine.prototype.exportState = function (machineId) {
    return {
      metadata: fields(this, engineFields),
      images: Array.from(this.imagens, ([id, image]) => {
        const callback = Array.from(LX.HUB).find(([, spec]) => spec.aoIniciar && spec.aoIniciar === image.aoIniciar)?.[0] || null;
        return [id, { data: fields(image, imageFields), callback }];
      }),
      containers: Array.from(this.containers, ([id, c]) => [id, {
        data: fields(c, containerFields), machine: c.maquina ? machineId(c.maquina) : null,
        pid: c.pid1?.pid || null, listeners: c.escutas.map(l => fields(l, listenerFields)),
        database: c.banco ? fields(c.banco, databaseFields) : null,
        registry: c.registroBlobs ? Array.from(c.registroBlobs, ([tag, image]) => [tag, image.id]) : null
      }])
    };
  };

  LX.DockerEngine.prototype.importState = function (state, machines) {
    Object.assign(this, hydrate(state.metadata));
    this.imagens = new Map(state.images.map(([id, row]) => {
      const d = hydrate(row.data);
      const spec = LX.HUB.get(d._defChave) || {};
      const image = Object.assign(new LX.ImagemDocker({ id }), d);
      image._semear = d.arvore ? cm => LX.aplicarArvore(cm.fs, cm.ctxRoot(), image.arvore) : spec.semear || null;
      image.aoIniciar = row.callback ? LX.HUB.get(row.callback)?.aoIniciar : null;
      if (row.callback && !image.aoIniciar) throw new Error('Imagem incompatível com esta versão.');
      return [id, image];
    }));
    this.containers = new Map(state.containers.map(([id, row]) => {
      const c = Object.assign(new LX.ContainerDocker({ id }), hydrate(row.data));
      c.maquina = row.machine === null ? null : machines[row.machine];
      if (row.machine !== null && !c.maquina) throw new Error('Máquina de container ausente.');
      if (c.maquina) { c.maquina._container = c; c.maquina._host = this.m; }
      c.pid1 = c.maquina?.processes.get(row.pid) || null;
      c.escutas = [];
      c._savedWorkspace = row;
      return [id, c];
    }));
  };

  W.exportState = function (machine, terminal = null, environment = {}) {
    const machines = [], ids = new Map();
    const machineId = m => {
      if (ids.has(m)) return ids.get(m);
      if (machines.length >= 64) throw new Error('Muitas máquinas no laboratório.');
      const id = machines.length;
      ids.set(m, id);
      const row = m.exportState();
      machines.push(row);
      row.remotes = Array.from(m.remotes || [], ([host, remote]) => [host, machineId(remote)]);
      row.docker = m.docker ? m.docker.exportState(machineId) : null;
      row.grafts = (m.fs.grafts || []).map(g => {
        const source = Array.from(ids.keys()).find(other => other.fs === g.fs);
        if (!source) throw new Error('Montagem sem máquina de origem.');
        return { source: machineId(source), data: fields(g, 'prefix target ro tipo origem arquivo nome') };
      });
      return id;
    };
    machineId(machine);
    const session = sh => ({ machine: machineId(sh.m), data: sh.exportState() });
    const shell = terminal instanceof LX.Shell ? terminal : terminal?.sh;
    const snapshot = {
      version: W.VERSION, updatedAt: new Date().toISOString(), machines,
      git: LX.Git.exportState(),
      shell: shell ? session(shell) : null,
      stack: (terminal?.stack || []).map(item => ({ ...session(item.sh), label: item.label || null })),
      label: terminal?.label || null, history: data(terminal?.history || shell?.history || []),
      environment: data(environment)
    };
    if (new TextEncoder().encode(JSON.stringify(snapshot)).length > W.MAX_BYTES) throw new Error('Ambiente excede o limite de 8 MB. Exporte uma cópia antes de remover arquivos.');
    return snapshot;
  };

  W.validate = function (snapshot) {
    // Sobe formatos antigos até a versão atual (rejeita versão mais nova/desconhecida).
    snapshot = W.migrar(snapshot);
    if (snapshot.version !== W.VERSION) throw new Error('Versão de ambiente não suportada. Os dados foram preservados.');
    if (new TextEncoder().encode(JSON.stringify(snapshot)).length > W.MAX_BYTES) throw new Error('Snapshot excede o limite de tamanho.');
    data(snapshot); // rejects executable values and prototype pollution keys
    if (!Array.isArray(snapshot.machines) || !snapshot.machines.length || snapshot.machines.length > 64) throw new Error('Snapshot de máquinas inválido.');
    LX.Git.importState(snapshot.git);
    return snapshot;
  };

  W.importState = function (snapshot) {
    snapshot = W.validate(snapshot);   // usa o snapshot já migrado para a versão atual
    // Construct independently: a failed import never replaces the live workspace.
    const machines = snapshot.machines.map(row => {
      const m = new LX.Machine({ container: !!row.environment.container });
      LX.installBinaries(m);
      return m;
    });
    snapshot.machines.forEach((row, id) => {
      const m = machines[id];
      if (row.docker) m.docker = new LX.DockerEngine(m);
      m.importState(row);
    });
    snapshot.machines.forEach((row, id) => {
      const m = machines[id];
      m.remotes = new Map(row.remotes.map(([host, ref]) => {
        if (!machines[ref]) throw new Error('Host remoto ausente.');
        return [host, machines[ref]];
      }));
      if (row.docker) m.docker.importState(row.docker, machines);
      m.fs.grafts = row.grafts.map(g => {
        if (!machines[g.source]) throw new Error('Origem da montagem ausente.');
        return { ...hydrate(g.data), fs: machines[g.source].fs };
      });
    });
    for (const m of machines) if (m.docker) for (const c of m.docker.containers.values()) {
      const row = c._savedWorkspace;
      const image = m.docker.imagens.get(c.imagemId);
      if (!image) throw new Error('Imagem do container ausente.');
      if (row.listeners.length && image.aoIniciar) {
        c.maquina.listeners = [];
        image.aoIniciar(c, m.docker, c.entrypoint.concat(c.cmd));
      }
      if (row.database) {
        if (!c.banco) throw new Error('Banco do container não pôde ser restaurado.');
        Object.assign(c.banco, hydrate(row.database));
      }
      if (row.registry) c.registroBlobs = new Map(row.registry.map(([tag, id]) => [tag, m.docker.imagens.get(id)]));
      Object.assign(c, hydrate(row.data));
      delete c._savedWorkspace;
    }
    // Service constructors may initialize files/logs. Restore persisted bytes last.
    snapshot.machines.forEach((row, id) => {
      machines[id].fs.importState(row.filesystem);
      machines[id].journal = hydrate(row.journal);
    });
    const shell = row => {
      if (!machines[row.machine]) throw new Error('Sessão sem máquina.');
      return new LX.Shell(machines[row.machine]).importState(row.data);
    };
    return {
      machine: machines[0], shell: snapshot.shell ? shell(snapshot.shell) : new LX.Shell(machines[0]),
      stack: snapshot.stack.map(row => ({ sh: shell(row), label: row.label })),
      label: snapshot.label, history: hydrate(snapshot.history), environment: hydrate(snapshot.environment)
    };
  };

  /* Reconstruir a VM a partir de um snapshot é um monte de escritas no FS/subsistemas
     que NÃO representam trabalho novo do aluno. Suspende o dirty tracking durante a
     importação para não agendar um save falso logo após restaurar. */
  const _importOriginal = W.importState;
  W.importState = function (snapshot) {
    return LX.WorkspaceMutation
      ? LX.WorkspaceMutation.suspender(() => _importOriginal.call(this, snapshot))
      : _importOriginal.call(this, snapshot);
  };
})();
