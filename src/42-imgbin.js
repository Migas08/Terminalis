/* =========================================================================
   TERMINALIS — binários que existem DENTRO das imagens
   nginx, node, npm, apk, clientes de MariaDB e PostgreSQL, redis-cli,
   traefik. Ficam marcados com soImagem: true, então não são instalados no
   host: só aparecem no container cuja imagem os traz.
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, defcmd, getopt } = LX;

  /* Coloca (ou tira) um binário do sistema de arquivos de um container */
  LX.instalarBin = function (cm, nomes) {
    const ctx = cm.ctxRoot();
    for (const nome of [].concat(nomes)) {
      const c = LX.COMMANDS[nome];
      if (!c) continue;
      try {
        cm.fs.mkdirp(FileSystem.dirname(c.path), { ctx });
        const n = cm.fs.writeFile(c.path, `\x7fELF binário: ${nome}\n`, { ctx });
        n.mode = 0o755;
      } catch (e) { }
    }
  };
  LX.removerBin = function (cm, nomes) {
    const ctx = cm.ctxRoot();
    for (const nome of [].concat(nomes)) {
      const c = LX.COMMANDS[nome];
      const caminhos = c ? [c.path] : [];
      caminhos.push('/usr/bin/' + nome, '/bin/' + nome, '/usr/sbin/' + nome, '/sbin/' + nome, '/usr/local/bin/' + nome);
      for (const p of caminhos) { try { cm.fs.unlink(p, { ctx }); } catch (e) { } }
    }
  };

  /* /usr/bin/true e /usr/bin/false existem de verdade no sistema, além de
     serem builtins do shell. Um HEALTHCHECK ou um CMD podem chamá-los pelo
     caminho, e aí precisa haver um arquivo executável ali. */
  defcmd({ name: 'true', run: async () => 0 });
  defcmd({ name: 'false', run: async () => 1 });

  /* O container em que este shell está rodando (null se for o host) */
  function containerDoShell(sh) { return sh.m._container || null; }
  function motorDoShell(sh) {
    if (sh.m._host && sh.m._host.docker) return sh.m._host.docker;
    return sh.m.docker || null;
  }

  /* -------------------------------------------------------------------
     Encontra um servidor de banco alcançável a partir daqui
     ------------------------------------------------------------------- */
  function servidorBanco(sh, host, porta, motorEsperado) {
    const c = containerDoShell(sh);
    const local = !host || host === 'localhost' || host === '127.0.0.1' || (c && host === c.hostname);
    if (local) {
      if (c && c.banco) return { banco: c.banco, container: c };
      return { erro: 'local' };
    }
    const eng = motorDoShell(sh);
    if (!eng) return { erro: 'rede' };
    let r = null;
    try { r = eng.connectFrom(c, host, porta); }
    catch (e) { return { erro: 'recusada' }; }
    if (!r) return { erro: 'nome' };
    if (!r.listener || !r.listener.banco) return { erro: 'recusada' };
    return { banco: r.listener.banco, container: r.container };
  }

  /* =====================================================================
     CLIENTE MARIADB / MYSQL
     ===================================================================== */
  const OPTS_MYSQL = { u: 1, h: 1, P: 1, D: 1, e: 1, '--user': 1, '--host': 1, '--port': 1, '--database': 1, '--execute': 1, '--batch': 0, '--skip-column-names': 0, N: 0, B: 0, s: 0, t: 0, '--table': 0, '--version': 0, V: 0, '--protocol': 1, '--ssl': 0, '--no-defaults': 0, f: 0, '--force': 0 };

  /* A senha do MySQL/MariaDB é o caso especial da linha de comando:
     `-p` sozinho pergunta a senha; `-pSENHA` (colado, sem espaço) passa
     direto — e fica visível no `ps`, que é justamente o motivo de a
     documentação desaconselhar. getopt genérico não dá conta disso. */
  function separarSenha(args) {
    const limpos = [];
    let senha;
    for (const a of args) {
      if (a === '-p' || a === '--password') { senha = true; continue; }
      let mm = /^-p(.+)$/.exec(a);
      if (mm) { senha = mm[1]; continue; }
      mm = /^--password=(.*)$/.exec(a);
      if (mm) { senha = mm[1]; continue; }
      limpos.push(a);
    }
    return { args: limpos, senha };
  }

  function saidaConsulta(io, r, opts) {
    if (r.colunas) {
      if (!r.linhas.length) { io.stdout.write(''); return; }
      const semCabecalho = opts.N || opts['--skip-column-names'];
      const tabela = opts.t || opts['--table'] || (io.stdout.isTTY && !opts.B && !opts['--batch']);
      if (tabela) io.stdout.write(LX.tabelaMySQL(r.colunas, r.linhas) + '\n');
      else {
        const linhas = [];
        if (!semCabecalho) linhas.push(r.colunas.join('\t'));
        for (const l of r.linhas) linhas.push(r.colunas.map(c => l[c] === null || l[c] === undefined ? 'NULL' : String(l[c])).join('\t'));
        io.stdout.write(linhas.join('\n') + '\n');
      }
    }
  }

  defcmd({
    name: ['mariadb', 'mysql'], soImagem: true, pkg: 'mariadb-client',
    run: async ({ sh, io, args }) => {
      const sep = separarSenha(args);
      const { opts, rest } = getopt(sep.args, OPTS_MYSQL);
      if (opts.V || opts['--version']) {
        io.stdout.write(`mariadb  Ver 15.1 Distrib 11.4.4-MariaDB, for debian-linux-gnu (x86_64) using  EditLine wrapper\n`);
        return 0;
      }
      const host = opts.h || opts['--host'] || '';
      const porta = +(opts.P || opts['--port'] || 3306);
      const s = servidorBanco(sh, host, porta, 'mariadb');
      if (s.erro === 'nome') {
        io.stderr.write(`ERROR 2005 (HY000): Unknown server host '${host}' (-2)\n`);
        return 1;
      }
      if (s.erro === 'recusada' || s.erro === 'rede') {
        io.stderr.write(`ERROR 2002 (HY000): Can't connect to server on '${host || 'localhost'}' (115)\n`);
        return 1;
      }
      if (s.erro === 'local') {
        io.stderr.write(`ERROR 2002 (HY000): Can't connect to local server through socket '/run/mysqld/mysqld.sock' (2)\n`);
        return 1;
      }
      const banco = s.banco;
      const usuario = opts.u || opts['--user'] || 'root';
      let senha = sep.senha;
      if (senha === true || senha === '') {
        io.stdout.write('Enter password: ');
        senha = await io.term.readLine({ senha: true });
      }
      const cont = s.container;
      const esperada = cont && cont.env ? (cont.env.MARIADB_ROOT_PASSWORD || cont.env.MYSQL_ROOT_PASSWORD || '') : '';
      if (usuario === 'root' && esperada && String(senha || '') !== String(esperada)) {
        io.stderr.write(`ERROR 1045 (28000): Access denied for user '${usuario}'@'localhost' (using password: ${senha ? 'YES' : 'NO'})\n`);
        return 1;
      }

      /* banco escolhido: -D, primeiro argumento posicional, ou nenhum */
      const nomeBanco = opts.D || opts['--database'] || rest[0] || null;
      const estado = Object.create(banco);
      if (nomeBanco) {
        const u = banco.usar(nomeBanco);
        if (u.erro) { io.stderr.write(u.erro + '\n'); return 1; }
      }

      const consulta = opts.e || opts['--execute'];
      if (consulta) {
        for (const parte of LX.separarSQL(consulta)) {
          if (!parte.trim()) continue;
          const rr = banco.executar(parte);
          if (rr.erro) { io.stderr.write(rr.erro + '\n'); return 1; }
          saidaConsulta(io, rr, opts);
        }
        return 0;
      }

      /* SQL vindo da entrada padrão: `mariadb banco < dump.sql` */
      const entrada = io.stdin && io.stdin.readAll ? io.stdin.readAll() : '';
      if (entrada && entrada.trim()) {
        const r = banco.executarLote(entrada);
        if (r.erro) {
          io.stderr.write(`ERROR ${r.erro.replace(/^ERROR /, '')} at line ${r.executados + 1}\n`);
          return 1;
        }
        return 0;
      }

      /* sessão interativa */
      if (!io.stdout.isTTY) return 0;
      io.stdout.write(`Welcome to the MariaDB monitor.  Commands end with ; or \\g.\n`);
      io.stdout.write(`Your MariaDB connection id is 3\nServer version: ${banco.versao} Ubuntu 24.04\n\n`);
      io.stdout.write(`Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.\n\n`);
      io.stdout.write(`Type 'help;' or '\\h' for help. Type '\\c' to clear the current input statement.\n\n`);
      let acumulado = '';
      for (;;) {
        const prompt = acumulado ? '    -> ' : `MariaDB [${banco.atual || '(none)'}]> `;
        io.stdout.write(prompt);
        let linha;
        try { linha = await io.term.readLine(); } catch (e) { break; }
        if (linha === null || linha === undefined) break;
        const t = linha.trim();
        if (!acumulado && (t === 'exit' || t === 'quit' || t === '\\q' || t === 'exit;' || t === 'quit;')) { io.stdout.write('Bye\n'); break; }
        if (!acumulado && !t) continue;
        acumulado += (acumulado ? '\n' : '') + linha;
        if (!/;\s*$|\\g\s*$/.test(acumulado.trim())) continue;
        const sql = acumulado.replace(/;\s*$/, '').replace(/\\g\s*$/, '');
        acumulado = '';
        const t0 = Date.now();
        const r = banco.executar(sql);
        if (r.erro) { io.stdout.write(r.erro + '\n'); continue; }
        if (r.colunas) {
          if (!r.linhas.length) io.stdout.write('Empty set (0.001 sec)\n\n');
          else {
            io.stdout.write(LX.tabelaMySQL(r.colunas, r.linhas) + '\n');
            io.stdout.write(`${r.linhas.length} row${r.linhas.length === 1 ? '' : 's'} in set (0.00${1 + (Date.now() - t0) % 3} sec)\n\n`);
          }
        } else if (r.mensagem) io.stdout.write(r.mensagem + '\n');
        else io.stdout.write(`Query OK, ${r.afetadas || 0} row${(r.afetadas || 0) === 1 ? '' : 's'} affected (0.001 sec)\n\n`);
      }
      return 0;
    }
  });

  defcmd({
    name: ['mariadb-dump', 'mysqldump'], soImagem: true, pkg: 'mariadb-client',
    run: async ({ sh, io, args }) => {
      const sep = separarSenha(args);
      const { opts, rest } = getopt(sep.args, Object.assign({}, OPTS_MYSQL, { '--all-databases': 0, A: 0, '--no-data': 0, d: 0, '--single-transaction': 0, '--quick': 0 }));
      const host = opts.h || opts['--host'] || '';
      const s = servidorBanco(sh, host, +(opts.P || 3306), 'mariadb');
      if (s.erro) {
        io.stderr.write(`mysqldump: Got error: 2002: "Can't connect to server on '${host || 'localhost'}'" when trying to connect\n`);
        return 2;
      }
      const usuario = opts.u || opts['--user'] || 'root';
      let senha = sep.senha;
      if (senha === true || senha === '') { io.stdout.write('Enter password: '); senha = await io.term.readLine({ senha: true }); }
      const cont = s.container;
      const esperada = cont && cont.env ? (cont.env.MARIADB_ROOT_PASSWORD || cont.env.MYSQL_ROOT_PASSWORD || '') : '';
      if (usuario === 'root' && esperada && String(senha || '') !== String(esperada)) {
        io.stderr.write(`mysqldump: Got error: 1045: "Access denied for user '${usuario}'@'localhost' (using password: ${senha ? 'YES' : 'NO'})" when trying to connect\n`);
        return 2;
      }
      const todos = opts.A || opts['--all-databases'];
      const alvos = todos ? Array.from(s.banco.bancos.keys()).filter(n => !s.banco.bancos.get(n).sistema) : rest;
      if (!alvos.length) {
        io.stderr.write('Usage: mariadb-dump [OPTIONS] database [tables]\nFor more options, use mariadb-dump --help\n');
        return 1;
      }
      const partes = [];
      for (const nome of alvos) {
        const d = s.banco.dump(nome, { semDados: !!(opts.d || opts['--no-data']) });
        if (d === null) {
          io.stderr.write(`mysqldump: Got error: 1049: "Unknown database '${nome}'" when selecting the database\n`);
          return 2;
        }
        partes.push(d);
      }
      io.stdout.write(partes.join('\n'));
      return 0;
    }
  });

  defcmd({
    name: ['mariadb-admin', 'mysqladmin'], soImagem: true, pkg: 'mariadb-client',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(separarSenha(args).args, OPTS_MYSQL);
      const s = servidorBanco(sh, opts.h || '', +(opts.P || 3306));
      const acao = (rest[0] || '').toLowerCase();
      if (s.erro) {
        if (acao === 'ping') { io.stderr.write(`mysqladmin: connect to server at '${opts.h || 'localhost'}' failed\nerror: 'Can't connect to server'\n`); return 1; }
        io.stderr.write(`mysqladmin: connect to server failed\n`);
        return 1;
      }
      if (acao === 'ping') { io.stdout.write('mysqld is alive\n'); return 0; }
      if (acao === 'status') {
        io.stdout.write(`Uptime: 420  Threads: 1  Questions: 12  Slow queries: 0  Opens: 18  Open tables: 11  Queries per second avg: 0.028\n`);
        return 0;
      }
      if (acao === 'version') { io.stdout.write(`mysqladmin  Ver 9.1 Distrib ${s.banco.versao}\n`); return 0; }
      io.stdout.write('mysqld is alive\n');
      return 0;
    }
  });

  /* =====================================================================
     CLIENTE POSTGRESQL
     ===================================================================== */
  defcmd({
    name: 'psql', soImagem: true, pkg: 'postgresql-client',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { U: 1, d: 1, h: 1, p: 1, c: 1, f: 1, l: 0, t: 0, A: 0, '--command': 1, '--dbname': 1, '--username': 1, '--host': 1, '--list': 0, V: 0, '--version': 0 });
      if (opts.V || opts['--version']) { io.stdout.write('psql (PostgreSQL) 17.2\n'); return 0; }
      const host = opts.h || opts['--host'] || '';
      const s = servidorBanco(sh, host, +(opts.p || 5432), 'postgres');
      if (s.erro === 'nome') { io.stderr.write(`psql: error: could not translate host name "${host}" to address: Name or service not known\n`); return 2; }
      if (s.erro) {
        io.stderr.write(`psql: error: connection to server at "${host || 'localhost'}", port ${opts.p || 5432} failed: Connection refused\n\tIs the server running on that host and accepting TCP/IP connections?\n`);
        return 2;
      }
      const banco = s.banco;
      const nomeBanco = opts.d || opts['--dbname'] || rest[0] || opts.U || 'postgres';
      if (opts.l || opts['--list']) {
        const linhas = Array.from(banco.bancos.keys()).sort().map(n => ({ Name: n, Owner: 'postgres', Encoding: 'UTF8' }));
        io.stdout.write(LX.tabelaPsql(['Name', 'Owner', 'Encoding'], linhas) + '\n');
        return 0;
      }
      const u = banco.usar(nomeBanco);
      if (u.erro) { io.stderr.write(`psql: error: connection to server failed: FATAL:  database "${nomeBanco}" does not exist\n`); return 2; }

      const roda = (sql) => {
        const r = banco.executar(sql);
        if (r.erro) { io.stderr.write(r.erro.replace(/^ERROR \d+ \([^)]*\): /, 'ERROR:  ') + '\n'); return 1; }
        if (r.colunas) {
          if (opts.t) io.stdout.write(r.linhas.map(l => r.colunas.map(c => l[c] === null ? '' : String(l[c])).join('|')).join('\n') + (r.linhas.length ? '\n' : ''));
          else io.stdout.write(LX.tabelaPsql(r.colunas, r.linhas) + '\n');
        } else if (r.afetadas !== undefined) {
          io.stdout.write((sql.trim().split(/\s+/)[0].toUpperCase()) + ' ' + r.afetadas + '\n');
        }
        return 0;
      };

      if (opts.c || opts['--command']) {
        const sql = opts.c || opts['--command'];
        let cod = 0;
        for (const parte of sql.split(';')) { if (parte.trim()) cod = roda(parte) || cod; }
        return cod;
      }
      if (opts.f) {
        let texto = '';
        try { texto = sh.m.fs.readFile(FileSystem.normalize(opts.f, sh.cwd), sh.fsopts()); }
        catch (e) { io.stderr.write(`psql: error: ${opts.f}: No such file or directory\n`); return 1; }
        const r = banco.executarLote(texto);
        if (r.erro) { io.stderr.write(r.erro + '\n'); return 1; }
        return 0;
      }
      const entrada = io.stdin && io.stdin.readAll ? io.stdin.readAll() : '';
      if (entrada && entrada.trim()) {
        const r = banco.executarLote(entrada);
        if (r.erro) { io.stderr.write(r.erro + '\n'); return 1; }
        return 0;
      }
      if (!io.stdout.isTTY) return 0;
      io.stdout.write(`psql (17.2 (Debian 17.2-1.pgdg120+1))\nType "help" for help.\n\n`);
      let acc = '';
      for (;;) {
        io.stdout.write(acc ? `${banco.atual}-# ` : `${banco.atual}=# `);
        let linha;
        try { linha = await io.term.readLine(); } catch (e) { break; }
        if (linha === null || linha === undefined) break;
        const t = linha.trim();
        if (!acc && (t === '\\q' || t === 'exit' || t === 'quit')) break;
        if (!acc && t === '\\l') { const ls = Array.from(banco.bancos.keys()).sort().map(n => ({ Name: n, Owner: 'postgres' })); io.stdout.write(LX.tabelaPsql(['Name', 'Owner'], ls) + '\n'); continue; }
        if (!acc && (t === '\\dt' || t === '\\d')) {
          const d = banco.db();
          const ls = Array.from(d.tabelas.keys()).sort().map(n => ({ Schema: 'public', Name: n, Type: 'table', Owner: 'postgres' }));
          if (!ls.length) io.stdout.write('Did not find any relations.\n');
          else io.stdout.write(LX.tabelaPsql(['Schema', 'Name', 'Type', 'Owner'], ls) + '\n');
          continue;
        }
        if (!acc && /^\\d\s+\S/.test(t)) {
          const r = banco._describe(t.split(/\s+/)[1]);
          if (r.erro) io.stdout.write(r.erro + '\n');
          else io.stdout.write(LX.tabelaPsql(r.colunas, r.linhas) + '\n');
          continue;
        }
        if (!acc && !t) continue;
        acc += (acc ? '\n' : '') + linha;
        if (!/;\s*$/.test(acc.trim())) continue;
        const sql = acc.replace(/;\s*$/, '');
        acc = '';
        roda(sql);
      }
      return 0;
    }
  });

  defcmd({
    name: 'pg_dump', soImagem: true, pkg: 'postgresql-client',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { U: 1, d: 1, h: 1, p: 1, '--dbname': 1, '--username': 1, '--host': 1 });
      const s = servidorBanco(sh, opts.h || '', +(opts.p || 5432));
      if (s.erro) { io.stderr.write(`pg_dump: error: connection to server failed: Connection refused\n`); return 1; }
      const nome = opts.d || opts['--dbname'] || rest[0];
      if (!nome) { io.stderr.write('pg_dump: error: no database name specified\n'); return 1; }
      const d = s.banco.dump(nome);
      if (d === null) { io.stderr.write(`pg_dump: error: database "${nome}" does not exist\n`); return 1; }
      io.stdout.write(d);
      return 0;
    }
  });

  defcmd({
    name: 'pg_isready', soImagem: true, pkg: 'postgresql-client',
    run: async ({ sh, io, args }) => {
      const { opts } = getopt(args, { h: 1, p: 1, U: 1, d: 1, q: 0 });
      const host = opts.h || 'localhost';
      const s = servidorBanco(sh, opts.h || '', +(opts.p || 5432));
      if (s.erro) { if (!opts.q) io.stdout.write(`${host}:${opts.p || 5432} - no response\n`); return 2; }
      if (!opts.q) io.stdout.write(`${host}:${opts.p || 5432} - accepting connections\n`);
      return 0;
    }
  });

  /* =====================================================================
     REDIS
     ===================================================================== */
  defcmd({
    name: 'redis-cli', soImagem: true, pkg: 'redis-tools',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { h: 1, p: 1, a: 1, n: 1 });
      const c = containerDoShell(sh);
      let alvo = c;
      if (opts.h && opts.h !== 'localhost' && opts.h !== '127.0.0.1') {
        const eng = motorDoShell(sh);
        let r = null;
        try { r = eng && eng.connectFrom(c, opts.h, +(opts.p || 6379)); } catch (e) { r = null; }
        if (!r || !r.container || !r.container.redis) {
          io.stderr.write(`Could not connect to Redis at ${opts.h}:${opts.p || 6379}: Connection refused\n`);
          return 1;
        }
        alvo = r.container;
      }
      if (!alvo || !alvo.redis) {
        io.stderr.write(`Could not connect to Redis at 127.0.0.1:6379: Connection refused\n`);
        return 1;
      }
      const loja = alvo.redis;
      const roda = (partes) => {
        const cmd = (partes[0] || '').toUpperCase();
        if (cmd === 'PING') return partes[1] ? `"${partes[1]}"` : 'PONG';
        if (cmd === 'SET') { loja.set(partes[1], partes.slice(2).join(' ')); return 'OK'; }
        if (cmd === 'GET') return loja.has(partes[1]) ? `"${loja.get(partes[1])}"` : '(nil)';
        if (cmd === 'DEL') { const t = loja.delete(partes[1]); return '(integer) ' + (t ? 1 : 0); }
        if (cmd === 'EXISTS') return '(integer) ' + (loja.has(partes[1]) ? 1 : 0);
        if (cmd === 'KEYS') {
          const ks = Array.from(loja.keys());
          if (!ks.length) return '(empty array)';
          return ks.map((k, i) => `${i + 1}) "${k}"`).join('\n');
        }
        if (cmd === 'DBSIZE') return '(integer) ' + loja.size;
        if (cmd === 'FLUSHALL' || cmd === 'FLUSHDB') { loja.clear(); return 'OK'; }
        if (cmd === 'INFO') return `# Server\nredis_version:7.4.1\nuptime_in_seconds:${Math.floor((Date.now() - alvo.iniciadoEm) / 1000)}\n# Keyspace\ndb0:keys=${loja.size},expires=0\n`;
        return `(error) ERR unknown command '${partes[0]}'`;
      };
      if (rest.length) { io.stdout.write(roda(rest) + '\n'); return 0; }
      if (!io.stdout.isTTY) return 0;
      for (;;) {
        io.stdout.write(`127.0.0.1:6379> `);
        let l; try { l = await io.term.readLine(); } catch (e) { break; }
        if (l === null || l === undefined) break;
        const t = l.trim();
        if (t === 'exit' || t === 'quit') break;
        if (!t) continue;
        io.stdout.write(roda(t.split(/\s+/)) + '\n');
      }
      return 0;
    }
  });

  /* =====================================================================
     NGINX (dentro da imagem)
     ===================================================================== */
  defcmd({
    name: 'nginx', soImagem: true, pkg: 'nginx', path: '/usr/sbin/nginx',
    run: async ({ sh, io, args }) => {
      const { opts } = getopt(args, { t: 0, T: 0, v: 0, V: 0, s: 1, g: 1, c: 1, p: 1 });
      if (opts.v || opts.V) { io.stderr.write('nginx version: nginx/1.27.4\n'); return 0; }
      const conf = opts.c || '/etc/nginx/nginx.conf';
      const erro = LX.validarNginx(sh.m, conf);
      if (opts.t || opts.T) {
        if (erro) {
          io.stderr.write(`nginx: [emerg] ${erro}\n`);
          io.stderr.write(`nginx: configuration file ${conf} test failed\n`);
          return 1;
        }
        io.stdout.write(`nginx: the configuration file ${conf} syntax is ok\n`);
        io.stdout.write(`nginx: configuration file ${conf} test is successful\n`);
        return 0;
      }
      if (opts.s) {
        const c = containerDoShell(sh);
        if (opts.s === 'reload') {
          if (erro) { io.stderr.write(`nginx: [emerg] ${erro}\n`); return 1; }
          if (c) c.registrar(`${new Date().toUTCString()} [notice] 1#1: signal process started`, 'stderr');
          return 0;
        }
        if (opts.s === 'stop' || opts.s === 'quit') {
          const eng = motorDoShell(sh);
          if (c && eng) eng.parar(c);
          return 0;
        }
        return 0;
      }
      if (erro) { io.stderr.write(`nginx: [emerg] ${erro}\n`); return 1; }
      io.stderr.write('nginx: [alert] nginx já está em execução neste container (PID 1)\n');
      return 1;
    }
  });

  /* Validação de verdade do nginx.conf: chaves e ponto e vírgula */
  LX.validarNginx = function (m, caminho) {
    let conf;
    try { conf = m.fs.readFile(caminho, { ctx: m.ctxRoot() }); }
    catch (e) { return `open() "${caminho}" failed (2: No such file or directory)`; }
    const abre = (conf.match(/\{/g) || []).length, fecha = (conf.match(/\}/g) || []).length;
    if (abre !== fecha) return `unexpected end of file, expecting "}" in ${caminho}:${conf.split('\n').length}`;
    const linhas = conf.split('\n');
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (/^\s*(#|$)/.test(l) || /[{}]/.test(l)) continue;
      if (!/;\s*(#.*)?$/.test(l)) {
        return `directive "${l.trim().split(/\s+/)[0]}" is not terminated by ";" in ${caminho}:${i + 1}`;
      }
    }
    /* include de arquivos que não existem */
    for (const l of linhas) {
      const inc = /^\s*include\s+([^;]+);/.exec(l);
      if (!inc) continue;
      const alvo = inc[1].trim();
      if (alvo.includes('*')) continue;
      try { m.fs.stat(alvo, { ctx: m.ctxRoot() }); }
      catch (e) { return `open() "${alvo}" failed (2: No such file or directory) in ${caminho}`; }
    }
    return null;
  };

  /* =====================================================================
     NODE E NPM
     ===================================================================== */
  defcmd({
    name: 'node', soImagem: true, pkg: 'nodejs',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { e: 1, p: 1, v: 0, '--version': 0, '--eval': 1, '--print': 1 });
      if (opts.v || opts['--version']) { io.stdout.write('v22.14.0\n'); return 0; }
      const codigo = opts.e || opts['--eval'] || opts.p || opts['--print'];
      if (codigo) return LX.rodarNode(sh, io, codigo, !!(opts.p || opts['--print']));
      if (rest[0]) {
        let texto;
        try { texto = sh.m.fs.readFile(FileSystem.normalize(rest[0], sh.cwd), sh.fsopts()); }
        catch (e) {
          io.stderr.write(`node:internal/modules/cjs/loader:1215\n  throw err;\n  ^\n\nError: Cannot find module '${FileSystem.normalize(rest[0], sh.cwd)}'\n`);
          return 1;
        }
        return LX.rodarNode(sh, io, texto, false, rest.slice(1));
      }
      io.stdout.write('Welcome to Node.js v22.14.0.\nType ".help" for more information.\n');
      return 0;
    }
  });

  /* Um Node muito reduzido: o suficiente para inspecionar o ambiente de
     dentro do container, que é o uso real na hora do diagnóstico. */
  LX.rodarNode = function (sh, io, codigo, imprimir, argv = []) {
    const c = containerDoShell(sh);
    const saida = [];
    const env = {};
    for (const k of sh.vars ? Object.keys(sh.vars) : []) env[k] = sh.getVar(k);
    if (c) Object.assign(env, c.env);
    const console_ = {
      log: (...a) => saida.push(a.map(v => typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v)).join(' ')),
      error: (...a) => saida.push(a.map(String).join(' ')),
      info: (...a) => saida.push(a.map(String).join(' '))
    };
    const processo = {
      env, argv: ['/usr/local/bin/node'].concat(argv),
      version: 'v22.14.0', platform: 'linux', arch: 'x64',
      pid: 1, cwd: () => sh.cwd, uptime: () => 42,
      memoryUsage: () => ({ rss: 42123264, heapTotal: 20971520, heapUsed: 12582912, external: 1638400 }),
      exit: (n) => { const e = new Error('exit'); e.codigoSaida = n || 0; throw e; }
    };
    const os_ = { hostname: () => sh.m.hostname, platform: () => 'linux', totalmem: () => sh.m.mem.total * 1024 * 1024, cpus: () => new Array(sh.m.cpuCount).fill({ model: 'Virtual CPU' }), uptime: () => sh.m.uptimeSec };
    const fs_ = {
      readFileSync: (p, enc) => sh.m.fs.readFile(FileSystem.normalize(String(p), sh.cwd), sh.fsopts()),
      writeFileSync: (p, d) => { sh.m.fs.writeFile(FileSystem.normalize(String(p), sh.cwd), String(d), sh.fsopts()); },
      existsSync: (p) => sh.m.fs.exists(FileSystem.normalize(String(p), sh.cwd), sh.fsopts()),
      readdirSync: (p) => sh.m.fs.readdir(FileSystem.normalize(String(p), sh.cwd), sh.fsopts()).map(x => typeof x === 'string' ? x : x.name)
    };
    const require_ = (nome) => {
      if (nome === 'os') return os_;
      if (nome === 'fs') return fs_;
      if (nome === 'path') return { join: (...p) => FileSystem.join(...p), basename: (p) => FileSystem.basename(p), dirname: (p) => FileSystem.dirname(p) };
      const e = new Error(`Cannot find module '${nome}'`); e.code = 'MODULE_NOT_FOUND'; throw e;
    };
    try {
      const f = new Function('console', 'process', 'require', 'module', 'exports', '__dirname',
        imprimir ? `return (${codigo});` : codigo);
      const r = f(console_, processo, require_, { exports: {} }, {}, sh.cwd);
      if (imprimir) saida.push(typeof r === 'object' && r !== null ? JSON.stringify(r) : String(r));
    } catch (e) {
      if (e.codigoSaida !== undefined) { if (saida.length) io.stdout.write(saida.join('\n') + '\n'); return e.codigoSaida; }
      if (saida.length) io.stdout.write(saida.join('\n') + '\n');
      io.stderr.write(`${e.name || 'Error'}: ${e.message}\n`);
      io.stderr.write(`    at Object.<anonymous> (/app/index.js:1:1)\n    at Module._compile (node:internal/modules/cjs/loader:1356:14)\n`);
      return 1;
    }
    if (saida.length) io.stdout.write(saida.join('\n') + '\n');
    return 0;
  };

  defcmd({
    name: 'npm', soImagem: true, pkg: 'nodejs',
    run: async ({ sh, io, args }) => {
      const sub = args.find(a => !a.startsWith('-')) || '';
      if (args.includes('-v') || args.includes('--version')) { io.stdout.write('10.9.2\n'); return 0; }
      const pkgPath = FileSystem.normalize('package.json', sh.cwd);
      if (sub === 'install' || sub === 'ci' || sub === 'i') {
        if (!sh.m.fs.exists(pkgPath, sh.fsopts())) {
          io.stderr.write(`npm error code ENOENT\nnpm error syscall open\nnpm error path ${pkgPath}\nnpm error errno -2\nnpm error enoent Could not read package.json\n`);
          return 254;
        }
        try { sh.m.fs.mkdirp(FileSystem.normalize('node_modules', sh.cwd), sh.fsopts()); } catch (e) { }
        io.stdout.write('\nadded 57 packages, and audited 58 packages in 3s\n\nfound 0 vulnerabilities\n');
        return 0;
      }
      if (sub === 'run' || sub === 'start') {
        let pkg;
        try { pkg = JSON.parse(sh.m.fs.readFile(pkgPath, sh.fsopts())); }
        catch (e) { io.stderr.write(`npm error code ENOENT\nnpm error enoent Could not read package.json\n`); return 254; }
        const alvo = sub === 'start' ? 'start' : args[args.indexOf(sub) + 1];
        const script = (pkg.scripts || {})[alvo];
        if (!script) {
          io.stderr.write(`npm error Missing script: "${alvo}"\nnpm error\nnpm error To see a list of scripts, run:\nnpm error   npm run\n`);
          return 1;
        }
        io.stdout.write(`\n> ${pkg.name || 'app'}@${pkg.version || '1.0.0'} ${alvo}\n> ${script}\n\n`);
        return await LX.rodarLinha(sh, io, script);
      }
      io.stdout.write('npm <command>\n\nUsage:\n\nnpm install\nnpm run <script>\n');
      return 0;
    }
  });

  /* =====================================================================
     APK (Alpine)
     ===================================================================== */
  const APK = {
    curl: ['curl'], bash: ['bash'], wget: ['wget'], 'busybox-extras': ['telnet'],
    'mariadb-client': ['mariadb', 'mysql', 'mariadb-dump', 'mysqldump', 'mariadb-admin'],
    'postgresql-client': ['psql', 'pg_dump', 'pg_isready'],
    'redis': ['redis-cli'], 'bind-tools': ['dig', 'nslookup', 'host'],
    'iproute2': ['ip', 'ss'], 'procps': ['ps', 'top'], 'tzdata': [], 'ca-certificates': [],
    vim: ['vim'], nano: ['nano'], jq: ['jq'], tree: ['tree']
  };
  defcmd({
    name: 'apk', soImagem: true, pkg: 'apk-tools',
    run: async ({ sh, io, args }) => {
      const sub = args.find(a => !a.startsWith('-')) || '';
      const pacotes = args.filter(a => !a.startsWith('-') && a !== sub);
      if (sub === 'update') { io.stdout.write('fetch https://dl-cdn.alpinelinux.org/alpine/v3.21/main/x86_64/APKINDEX.tar.gz\nfetch https://dl-cdn.alpinelinux.org/alpine/v3.21/community/x86_64/APKINDEX.tar.gz\nOK: 25397 distinct packages available\n'); return 0; }
      if (sub === 'add') {
        if (sh.uid !== 0) { io.stderr.write('ERROR: Unable to lock database: Permission denied\nERROR: Failed to open apk database: Permission denied\n'); return 99; }
        const desconhecidos = pacotes.filter(p => !(p in APK));
        if (desconhecidos.length) {
          for (const p of desconhecidos) io.stderr.write(`ERROR: unable to select packages:\n  ${p} (no such package):\n    required by: world[${p}]\n`);
          return 1;
        }
        io.stdout.write('fetch https://dl-cdn.alpinelinux.org/alpine/v3.21/main/x86_64/APKINDEX.tar.gz\n');
        let n = 0;
        for (const p of pacotes) {
          LX.instalarBin(sh.m, APK[p]);
          sh.m.packages.set(p, { name: p, version: '1.0.0-r0', description: p, installed: true, size: 120000 });
          io.stdout.write(`(${++n}/${pacotes.length}) Installing ${p} (1.0.0-r0)\n`);
        }
        io.stdout.write(`Executing busybox-1.37.0-r12.trigger\nOK: 12 MiB in ${18 + pacotes.length} packages\n`);
        return 0;
      }
      if (sub === 'del') {
        for (const p of pacotes) { LX.removerBin(sh.m, APK[p] || [p]); sh.m.packages.delete(p); }
        io.stdout.write(`OK: 8 MiB in ${Math.max(1, 18 - pacotes.length)} packages\n`);
        return 0;
      }
      if (sub === 'info') {
        io.stdout.write(Array.from(sh.m.packages.keys()).sort().join('\n') + '\n');
        return 0;
      }
      io.stdout.write('apk-tools 2.14.6, compiled for x86_64.\n');
      return 0;
    }
  });

  /* =====================================================================
     TRAEFIK (binário dentro da imagem)
     ===================================================================== */
  defcmd({
    name: 'traefik', soImagem: true, pkg: 'traefik',
    run: async ({ sh, io, args }) => {
      if (args.includes('version') || args.includes('--version')) {
        io.stdout.write('Version:      3.7.2\nCodename:     saintnectaire\nGo version:   go1.24.1\nBuilt:        2026-06-18T09:12:44Z\nOS/Arch:      linux/amd64\n');
        return 0;
      }
      if (args.includes('healthcheck')) {
        const c = containerDoShell(sh);
        if (c && c.rodando && c.traefik) { io.stdout.write('OK: http://:8080/ping\n'); return 0; }
        io.stderr.write('Error calling healthcheck: Get "http://:8080/ping": dial tcp: connection refused\n');
        return 1;
      }
      io.stderr.write('traefik: já está em execução neste container (PID 1)\n');
      return 1;
    }
  });

  /* =====================================================================
     Daemons das imagens. Existem como binário para que o ENTRYPOINT/CMD
     funcione; quem os coloca no ar é o próprio container ao subir.
     ===================================================================== */
  for (const [nome, texto] of [
    ['mariadbd', 'mariadbd'], ['mysqld', 'mysqld'], ['postgres', 'postgres'],
    ['redis-server', 'redis-server'], ['registry', 'registry'], ['php', 'php']
  ]) {
    defcmd({
      name: nome, soImagem: true, pkg: 'imagem',
      run: async ({ sh, io }) => {
        const c = containerDoShell(sh);
        if (c && c.rodando) { io.stderr.write(`${texto}: já está em execução neste container como PID 1\n`); return 1; }
        io.stderr.write(`${texto}: este processo é iniciado pelo entrypoint da imagem\n`);
        return 1;
      }
    });
  }

  /* Python: só o bastante para inspecionar o ambiente de dentro do container */
  defcmd({
    name: ['python3', 'python'], soImagem: true, pkg: 'python3',
    run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { c: 1, V: 0, '--version': 0, m: 1 });
      if (opts.V || opts['--version']) { io.stdout.write('Python 3.13.2\n'); return 0; }
      const codigo = opts.c;
      if (codigo) {
        /* subconjunto: print(...) com literais, os.environ e platform */
        const linhas = [];
        for (const trecho of codigo.split(/\n|;/)) {
          const mp = /^\s*print\s*\((.*)\)\s*$/.exec(trecho);
          if (!mp) continue;
          let arg = mp[1].trim();
          const ms = /^["'](.*)["']$/.exec(arg);
          if (ms) { linhas.push(ms[1]); continue; }
          if (/os\.environ\.get\(["']([^"']+)["']/.test(arg)) {
            const k = /os\.environ\.get\(["']([^"']+)["']/.exec(arg)[1];
            linhas.push(sh.getVar(k) || 'None');
            continue;
          }
          if (/platform\.node\(\)/.test(arg)) { linhas.push(sh.m.hostname); continue; }
          linhas.push(arg);
        }
        io.stdout.write(linhas.join('\n') + (linhas.length ? '\n' : ''));
        return 0;
      }
      if (rest[0]) {
        if (!sh.m.fs.exists(FileSystem.normalize(rest[0], sh.cwd), sh.fsopts())) {
          io.stderr.write(`python3: can't open file '${FileSystem.normalize(rest[0], sh.cwd)}': [Errno 2] No such file or directory\n`);
          return 2;
        }
        return 0;
      }
      io.stdout.write('Python 3.13.2 (main, Feb 12 2026, 09:41:22) [GCC 12.2.0] on linux\nType "help", "copyright", "credits" or "license" for more information.\n');
      return 0;
    }
  });
})();
