/* =========================================================================
   TERMINALIS — estrutura do curso e utilitários de conteúdo
   ========================================================================= */
'use strict';
(function () {
  LX.COURSE = { modules: [], pages: [] };

  /* Registra um módulo. As aulas são adicionadas pelos arquivos de conteúdo. */
  LX.mod = function (spec) {
    const m = Object.assign({ lessons: [] }, spec);
    LX.COURSE.modules.push(m);
    return m;
  };
  LX.modById = (id) => LX.COURSE.modules.find(m => m.id === id);

  /* Adiciona uma aula a um módulo já registrado. */
  LX.lesson = function (modId, spec) {
    const m = LX.modById(modId);
    if (!m) { console.warn('módulo inexistente: ' + modId); return; }
    m.lessons.push(spec);
    return spec;
  };

  /* ---------- helpers de verificação de desafios ---------- */
  const H = {};
  LX.H = H;

  H.fs = (ctx) => ctx.sh.m.fs;
  H.opts = (ctx) => ctx.sh.fsopts();
  H.machine = (ctx) => ctx.machine || ctx.sh.m;

  /* A verificação enxerga o sistema como root: o desafio pode ter criado
     arquivos que o próprio aluno não consegue atravessar. */
  H.exists = (ctx, path) => {
    try { ctx.sh.m.fs.lstat(path, { cwd: '/', ctx: ctx.sh.m.ctxRoot() }); return true; } catch (e) { return false; }
  };
  H.stat = (ctx, path) => {
    try { return ctx.sh.m.fs.stat(path, { cwd: '/', ctx: ctx.sh.m.ctxRoot() }); } catch (e) { return null; }
  };
  H.lstat = (ctx, path) => {
    try { return ctx.sh.m.fs.lstat(path, { cwd: '/', ctx: ctx.sh.m.ctxRoot() }); } catch (e) { return null; }
  };
  H.isDir = (ctx, path) => { const s = H.stat(ctx, path); return !!s && s.type === 'dir'; };
  H.isFile = (ctx, path) => { const s = H.stat(ctx, path); return !!s && s.type === 'file'; };
  H.read = (ctx, path) => {
    try { return ctx.sh.m.fs.readFile(path, { cwd: '/', ctx: ctx.sh.m.ctxRoot() }); } catch (e) { return null; }
  };
  H.readText = (ctx, path) => H.read(ctx, path) || '';
  H.runOutput = async (ctx, command) => ctx.run ? (await ctx.run(command)).out : '';
  H.unit = (ctx, name) => {
    const machine = H.machine(ctx);
    const fullName = name.includes('.') ? name : name + '.service';
    const unit = machine.units && (machine.units.get ? machine.units.get(fullName) : machine.units[fullName]);
    return unit || (typeof machine.unit === 'function' ? machine.unit(name) : undefined);
  };
  H.mode = (ctx, path) => { const s = H.lstat(ctx, path); return s ? (s.mode & 0o7777) : null; };
  H.owner = (ctx, path) => {
    const s = H.lstat(ctx, path);
    if (!s) return null;
    const u = ctx.sh.m.userByUid(s.uid), g = ctx.sh.m.groupByGid(s.gid);
    return { user: u ? u.name : String(s.uid), group: g ? g.name : String(s.gid), uid: s.uid, gid: s.gid };
  };
  H.ls = (ctx, path) => {
    try { return ctx.sh.m.fs.readdir(path, { cwd: '/', ctx: ctx.sh.m.ctxRoot() }); } catch (e) { return null; }
  };
  /* Tamanho real de um diretório (soma recursiva), para conferir relatórios
     de du sem confiar no que o aluno escreveu. */
  H.du = (ctx, path) => {
    const fs = ctx.sh.m.fs, raiz = ctx.sh.m.ctxRoot();
    const soma = (p) => {
      let st; try { st = fs.lstat(p, { cwd: '/', ctx: raiz }); } catch (e) { return null; }
      if (st.type === 'dir') {
        let t = 4096;
        let itens; try { itens = fs.readdir(p, { cwd: '/', ctx: raiz }); } catch (e) { return t; }
        for (const it of itens) {
          const nome = typeof it === 'string' ? it : it.name;
          if (nome === '.' || nome === '..') continue;
          const sub = soma((p.endsWith('/') ? p : p + '/') + nome);
          if (sub !== null) t += sub;
        }
        return t;
      }
      return (st.size || 0);
    };
    return soma(path);
  };

  H.history = (ctx) => ctx.term.history.join('\n');
  H.usedCommand = (ctx, re) => (ctx.term.history || []).some(h => re.test(h));

  /* Falha padronizada: devolve a primeira pendência encontrada */
  /* A condição E a mensagem podem ser funções. Isso importa: a mensagem
     costuma interpolar o valor encontrado ("está com 640"), e avaliá-la
     antes da condição anterior rodar estoura quando o arquivo ainda nem
     existe — o aluno via "não consegui verificar" em vez da pendência. */
  H.checkAll = (checks) => {
    for (const [cond, msg] of checks) {
      let ok;
      try { ok = typeof cond === 'function' ? cond() : cond; }
      catch (e) { ok = false; }
      if (!ok) {
        let texto;
        try { texto = typeof msg === 'function' ? msg() : msg; }
        catch (e) { texto = 'Ainda falta este item.'; }
        return { ok: false, msg: texto };
      }
    }
    return { ok: true };
  };

  /* ---------- ambiente inicial de trabalho ---------- */
  LX.seedWorkspace = function (m) {
    const ctx = m.ctxRoot();
    const F = (p, c, mode, uid = 1000, gid = 1000) => {
      m.fs.mkdirp(LX.FileSystem.dirname(p), { ctx });
      const n = m.fs.writeFile(p, c, { ctx });
      n.uid = uid; n.gid = gid;
      if (mode !== undefined) n.mode = mode;
      return n;
    };
    const D = (p, mode = 0o755, uid = 1000, gid = 1000) => {
      const n = m.fs.mkdirp(p, { ctx });
      n.uid = uid; n.gid = gid; n.mode = mode;
      return n;
    };

    D('/home/aluno/documentos');
    D('/home/aluno/downloads');
    D('/home/aluno/projetos');

    F('/home/aluno/documentos/notas.txt',
      `Anotações de estudo — Linux\n` +
      `============================\n\n` +
      `O terminal não é um lugar assustador.\n` +
      `É só um programa que lê o que você escreve e executa.\n\n` +
      `Coisas para não esquecer:\n` +
      `- tudo no Linux é um arquivo\n` +
      `- o sistema diferencia maiúsculas de minúsculas\n` +
      `- a barra / separa diretórios\n`);

    F('/home/aluno/documentos/tarefas.txt',
      `[ ] revisar o modulo de permissoes\n[x] instalar o docker\n[ ] configurar chave ssh\n[ ] fazer backup do /etc\n[x] ler sobre systemd\n`);

    F('/home/aluno/documentos/servidores.csv',
      `nome,ip,ambiente,cpu,memoria_gb,status\n` +
      `web01,10.0.2.31,producao,4,8,ativo\n` +
      `web02,10.0.2.32,producao,4,8,ativo\n` +
      `db01,10.0.2.40,producao,8,32,ativo\n` +
      `cache01,10.0.2.50,producao,2,4,manutencao\n` +
      `web03,10.0.3.31,homologacao,2,4,ativo\n` +
      `db02,10.0.3.40,homologacao,4,8,parado\n` +
      `jenkins,10.0.4.10,ferramentas,4,16,ativo\n`);

    D('/home/aluno/projetos/site');
    F('/home/aluno/projetos/site/index.html',
      `<!doctype html>\n<html lang="pt-br">\n<head><meta charset="utf-8"><title>Meu site</title></head>\n<body>\n  <h1>Olá, mundo</h1>\n</body>\n</html>\n`);
    F('/home/aluno/projetos/site/estilo.css', `body { font-family: sans-serif; margin: 2rem; }\nh1 { color: #16A34A; }\n`);
    F('/home/aluno/projetos/README.md', `# Projetos\n\nPasta de trabalho do curso.\n`);

    D('/home/aluno/downloads');
    F('/home/aluno/downloads/relatorio-2026-08.csv',
      `data,servico,requisicoes,erros,latencia_ms\n` +
      `2026-08-25,api,18422,31,142\n2026-08-26,api,19511,12,138\n2026-08-27,api,17903,204,489\n` +
      `2026-08-28,api,21044,8,131\n2026-08-29,api,22190,17,145\n2026-08-30,api,20817,9,129\n2026-08-31,api,15002,3,118\n`);

    // um log realista para os módulos de texto e troubleshooting
    const dias = ['25', '26', '27', '28', '29', '30', '31'];
    let acc = '';
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const d of dias) {
      for (let h = 0; h < 24; h += 2) {
        const n = 3 + Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) {
          const codes = [200, 200, 200, 200, 200, 301, 304, 404, 404, 500, 502];
          const code = codes[Math.floor(rnd() * codes.length)];
          const paths = ['/', '/api/status', '/api/usuarios', '/login', '/static/app.js', '/imagens/logo.png', '/admin'];
          const ips = ['10.0.2.2', '187.45.220.14', '200.160.2.77', '10.0.2.2', '45.33.12.9', '10.0.2.2'];
          const ip = ips[Math.floor(rnd() * ips.length)];
          acc += `${ip} - - [${d}/Aug/2026:${String(h).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00 -0300] ` +
            `"GET ${paths[Math.floor(rnd() * paths.length)]} HTTP/1.1" ${code} ${300 + Math.floor(rnd() * 9000)} "-" "Mozilla/5.0"\n`;
        }
      }
    }
    m.fs.mkdirp('/var/log/app', { ctx });
    const lg = m.fs.writeFile('/var/log/app/acesso.log', acc, { ctx });
    lg.mode = 0o644;

    m.fs.writeFile('/var/log/app/erro.log',
      `2026-08-27 09:14:02 ERROR conexao recusada com o banco 10.0.2.40:5432\n` +
      `2026-08-27 09:14:03 WARN  tentando reconectar (1/5)\n` +
      `2026-08-27 09:14:08 WARN  tentando reconectar (2/5)\n` +
      `2026-08-27 09:14:18 ERROR timeout apos 10s\n` +
      `2026-08-27 09:14:19 ERROR pool de conexoes esgotado\n` +
      `2026-08-27 09:20:41 INFO  conexao restabelecida\n` +
      `2026-08-30 03:00:01 INFO  rotina de backup iniciada\n` +
      `2026-08-30 03:04:55 INFO  rotina de backup concluida (4m54s)\n` +
      `2026-08-31 22:10:07 ERROR disco cheio em /var/lib/app\n`, { ctx }).mode = 0o644;

    // histórico de comandos pré-existente (para a aula de history)
    m.fs.writeFile('/home/aluno/.bash_history',
      `ls -la\ncd /var/log\ntail -f syslog\nsudo systemctl status ssh\ndf -h\n`, { ctx });
  };
})();
