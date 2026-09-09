/* Protocolo de verificação do login + progressão entre trilhas.
   Roda a plataforma real em Chromium headless e executa os 12 passos. */
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ARQ = path.join(__dirname, '..', 'dist', 'terminalis.html');
let ok = 0, mau = 0;
const T = (nome, cond, extra) => {
  if (cond) { ok++; console.log('  ✓ ' + nome); }
  else { mau++; console.log('  ✗ ' + nome + (extra ? '  → ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const html = fs.readFileSync(ARQ);
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(html); });
  await new Promise(res => srv.listen(0, res));
  const url = 'http://127.0.0.1:' + srv.address().port + '/';

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--disable-features=Autofill,AutofillServerCommunication,PasswordManagerEnableAccountStore,PasswordLeakDetection',
           '--disable-save-password-bubble', '--password-store=basic']
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });

  /* escreve no campo sem depender do autofill do navegador */
  const preencher = async (sel, valor) => {
    await page.waitForSelector(sel);
    await page.evaluate(([s2, v]) => {
      const el = document.querySelector(s2);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, [sel, valor]);
  };
  const enviarForm = async () => {
    await page.evaluate(() => document.querySelector('#auth-enviar').click());
  };
  const irPara = async () => { await page.goto(url); await page.waitForFunction(() => !!window.LX && !!LX.AuthUI && !!LX.AuthUI.el, null, { timeout: 15000 }); };
  const telaLogin = () => page.evaluate(() => !document.getElementById('auth-screen').classList.contains('hidden'));
  const logado = () => page.evaluate(() => (LX.Auth.usuario ? LX.Auth.usuario.usuario : null));

  /* espera o formulário terminar o trabalho (PBKDF2 leva o tempo que levar) */
  async function esperarForm() {
    await page.waitForFunction(() => window.LX && LX.AuthUI && LX.AuthUI.ocupado === true, null, { timeout: 2500 }).catch(() => { });
    await page.waitForFunction(() => window.LX && LX.AuthUI && LX.AuthUI.ocupado === false, null, { timeout: 40000 });
    await page.waitForTimeout(350);
  }

  async function criarConta(usuario, email, senha) {
    await page.evaluate(() => document.querySelector('.auth-abas button[data-aba="criar"]').click());
    await page.waitForSelector('#c-usuario:not(.hidden)');
    await preencher('#f-usuario', usuario);
    await preencher('#f-email', email);
    await preencher('#f-senha', senha);
    await enviarForm();
    try { await page.waitForFunction(() => !!window.__app && !!LX.Auth.usuario, null, { timeout: 25000 }); }
    catch (e) {
      const diag = await page.evaluate(() => ({
        alerta: document.querySelector('#auth-alerta').textContent,
        aba: LX.AuthUI.aba, ocupado: LX.AuthUI.ocupado,
        erros: Array.from(document.querySelectorAll('.campo.erro')).map(c => c.id + ': ' + c.querySelector('.msg').textContent)
      }));
      throw new Error('criarConta(' + usuario + ') falhou → ' + JSON.stringify(diag));
    }
    await page.waitForTimeout(250);
  }
  async function entrar(login, senha) {
    await page.evaluate(() => document.querySelector('.auth-abas button[data-aba="entrar"]').click());
    await page.waitForSelector('#c-login:not(.hidden)');
    await preencher('#f-login', login);
    await preencher('#f-senha', senha);
    await enviarForm();
    await esperarForm();
  }
  async function sair() {
    page.once('dialog', d => d.accept());
    await page.evaluate(() => window.__app.sair());
    await page.waitForTimeout(500);
  }
  const status = (id) => page.evaluate((t) => {
    const st = LX.Progressao.status(t, LX.Auth.progresso);
    return { liberada: st.liberada, permanente: st.permanente, concluida: st.concluida };
  }, id);
  const contadores = () => page.evaluate(() => ({
    aulas: Object.keys(LX.Auth.progresso.lessons).length,
    tarefas: Object.keys(LX.Auth.progresso.tasks).length
  }));
  /* conclui, de verdade, todas as aulas e desafios de uma trilha */
  const concluirTrilha = (id) => page.evaluate(async (tid) => {
    const t = LX.trilhaPorId(tid);
    const mods = LX.COURSE.modules.filter(m => (t.mods || []).includes(m.id));
    for (const m of mods) for (const l of m.lessons) {
      for (const tk of (l.tasks || [])) LX.Progress.markTask(tk.id);
      LX.Progress.markLesson(l.id, true);
    }
    window.__app.avaliarProgressao(true);
    await new Promise(r => setTimeout(r, 200));
    return true;
  }, id);

  console.log('\n=== PROTOCOLO DE VERIFICAÇÃO ===\n');
  await irPara();

  console.log('1-2. criar o primeiro usuário');
  T('a tela de acesso aparece quando não há sessão', await telaLogin());
  await criarConta('ana', 'ana@exemplo.com', 'senhaSegura1');
  T('usuário 1 autenticado', (await logado()) === 'ana');
  T('a tela de acesso sumiu', !(await telaLogin()));
  T('progresso do usuário 1 começa zerado', (await contadores()).aulas === 0);

  console.log('\n3. avançar o usuário 1');
  await page.evaluate(() => { window.__app.goLesson('l1-1'); });
  await page.evaluate(() => { LX.Progress.markTask('t1-1-a'); LX.Progress.markLesson('l1-1', true); });
  await page.waitForTimeout(800);
  const c1 = await contadores();
  T('usuário 1 tem 1 aula e 1 desafio', c1.aulas === 1 && c1.tarefas === 1, c1);
  T('Docker bloqueado para o usuário 1', !(await status('docker')).liberada);
  T('Projeto final bloqueado para o usuário 1', !(await status('pf-linux')).liberada);

  console.log('\n4-6. sair, criar o usuário 2 e conferir o isolamento');
  await sair();
  T('a tela de acesso volta depois do logout', await telaLogin());
  T('nenhum usuário na memória', (await logado()) === null);
  await criarConta('bruno', 'bruno@exemplo.com', 'outraSenha9');
  T('usuário 2 autenticado', (await logado()) === 'bruno');
  const c2 = await contadores();
  T('usuário 2 NÃO herda o progresso do usuário 1', c2.aulas === 0 && c2.tarefas === 0, c2);

  console.log('\n7. Docker bloqueado para o usuário 2');
  T('Docker bloqueado', !(await status('docker')).liberada);
  const naLista = await page.evaluate(() => {
    window.__app.goCursos();
    const rows = Array.from(document.querySelectorAll('.crs-row'));
    const el = rows.find(n => /Docker na prática/.test(n.textContent));
    return el ? el.innerText.replace(/\s+/g, ' ').trim() : null;
  });
  T('o curso de Docker aparece bloqueado na lista de cursos', /Bloqueado/i.test(naLista || ''), naLista);
  const naJornada = await page.evaluate(() => {
    window.__app.goJornada();
    const pas = Array.from(document.querySelectorAll('.jn-painel'));
    const el = pas.find(n => /Docker na prática/.test(n.textContent));
    return { painel: el ? el.innerText.replace(/\s+/g, ' ').trim() : null, pagina: document.querySelector('#page').innerText.replace(/\s+/g, ' ') };
  });
  T('a jornada lista o que falta para o Docker, item por item', /Para desbloquear/i.test(naJornada.painel || ''), naJornada.painel);
  T('a jornada mostra a corrente inteira (Linux antes do projeto final)',
    /Linux e o terminal/.test(naJornada.pagina || '') && /Projeto final de Linux/.test(naJornada.pagina || ''), null);
  T('clicar num curso travado não abre o curso — leva para a jornada', await page.evaluate(async () => {
    window.__app.abrirTrilha('docker');
    await new Promise(r => setTimeout(r, 150));
    return window.__app.route.view === 'jornada' && window.__app.trilhaId !== 'docker';
  }));
  T('a página da jornada explica o motivo do bloqueio', await page.evaluate(() => {
    const p = document.querySelector('#jp-docker');
    return !!p && /abre sozinho/i.test(p.innerText);
  }));

  console.log('\n8. voltar para o usuário 1: progresso preservado');
  await sair();
  await entrar('ana', 'senhaSegura1');
  T('usuário 1 autenticado de novo', (await logado()) === 'ana');
  const c3 = await contadores();
  T('progresso do usuário 1 continua lá', c3.aulas === 1 && c3.tarefas === 1, c3);

  console.log('\n   senha errada e login inexistente');
  await sair();
  await entrar('ana', 'senhaErrada!');
  T('senha errada não autentica', (await logado()) === null);
  T('mensagem de erro visível', await page.evaluate(() => {
    const c = document.querySelector('#c-senha');
    return !!c && c.classList.contains('erro') && /incorretos/i.test(c.querySelector('.msg').textContent);
  }));
  await preencher('#f-senha', 'senhaSegura1');
  await enviarForm();
  await esperarForm();
  T('a senha certa entra depois do erro', (await logado()) === 'ana');

  console.log('\n9-10. concluir Linux e o projeto final');
  await concluirTrilha('linux');
  const pf = await status('pf-linux');
  T('o projeto final de Linux desbloqueia ao terminar o curso', pf.liberada, pf);
  T('Docker continua bloqueado antes do projeto final', !(await status('docker')).liberada);
  await concluirTrilha('pf-linux');
  const dk = await status('docker');
  T('Docker desbloqueia sozinho ao concluir o projeto final', dk.liberada, dk);
  T('o desbloqueio ficou registrado como permanente', dk.permanente);
  T('agora a trilha de Docker abre ao clicar', await page.evaluate(async () => {
    window.__app.goHome();
    window.__app.abrirTrilha('docker');
    await new Promise(r => setTimeout(r, 150));
    return window.__app.trilhaId === 'docker';
  }));

  console.log('\n11-12. o desbloqueio sobrevive a logout, login e recarga');
  await sair();
  await entrar('ana', 'senhaSegura1');
  T('desbloqueio preservado depois de sair e entrar', (await status('docker')).liberada);
  await irPara();
  await page.waitForFunction(() => !!window.__app, null, { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(400);
  T('a sessão é retomada sozinha ao recarregar a página', (await logado()) === 'ana');
  T('desbloqueio preservado depois de recarregar', (await status('docker')).liberada);

  console.log('\n   e o usuário 2 continua sem nada disso');
  await sair();
  await entrar('bruno', 'outraSenha9');
  const cb = await contadores();
  T('usuário 2 ainda com progresso zerado', cb.aulas === 0 && cb.tarefas === 0, cb);
  T('Docker ainda bloqueado para o usuário 2', !(await status('docker')).liberada);

  console.log('\n   armazenamento');
  const seg = await page.evaluate(() => {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); dump[k] = localStorage.getItem(k); }
    const bruto = JSON.stringify(dump);
    const sess = JSON.parse(dump['terminalis.sessao.v1'] || 'null');
    const conta = JSON.parse(dump['terminalis.dados.v1/contas/' + (sess ? sess.uid : 'ana')] || '{}');
    return {
      bruto,
      temSenha: /senhaSegura1|outraSenha9/.test(bruto),
      alg: conta.alg, iter: conta.iteracoes,
      hash: conta.hash, salt: conta.salt,
      senhaCrua: conta.senha === undefined && conta.password === undefined,
      sessoes: Object.keys(conta.sessoes || {}),
      tokenLocal: sess
    };
  });
  T('nenhuma senha em texto puro no armazenamento', !seg.temSenha);
  T('a conta não guarda campo de senha', seg.senhaCrua);
  T('a senha está derivada com PBKDF2-SHA256', seg.alg === 'PBKDF2-SHA256' && seg.iter === 150000, { alg: seg.alg, iter: seg.iter });
  T('salt de 16 bytes por conta', /^[0-9a-f]{32}$/.test(seg.salt || ''));
  T('hash de 256 bits', /^[0-9a-f]{64}$/.test(seg.hash || ''));
  T('o token da sessão só existe em hash na conta', (seg.sessoes[0] || '').length === 64);
  T('a sessão local guarda o token, não a senha', !!(seg.tokenLocal && seg.tokenLocal.token && seg.tokenLocal.token.length === 64));

  console.log('\n   erros de cadastro');
  await sair();
  await page.evaluate(() => document.querySelector('.auth-abas button[data-aba="criar"]').click());
  await preencher('#f-usuario', 'ana');
  await preencher('#f-email', 'outro@exemplo.com');
  await preencher('#f-senha', 'qualquerCoisa1');
  await enviarForm();
  await esperarForm();
  T('usuário duplicado é recusado', await page.evaluate(() => document.querySelector('#c-usuario').classList.contains('erro')));
  await preencher('#f-usuario', 'carla');
  await preencher('#f-senha', 'curta');
  await enviarForm();
  await esperarForm();
  T('senha curta é recusada antes de qualquer gravação', await page.evaluate(() => document.querySelector('#c-senha').classList.contains('erro')));
  T('e-mail inválido é recusado', await page.evaluate(async () => {
    document.querySelector('#f-email').value = 'nao-e-email';
    document.querySelector('#f-senha').value = 'senhaBoa123';
    document.querySelector('#auth-enviar').click();
    await new Promise(r => setTimeout(r, 300));
    return document.querySelector('#c-email').classList.contains('erro');
  }));

  console.log('\n   armazenamento na nuvem (documentos congelados, como o db do artifact)');
  await sair();
  const nuvem = await page.evaluate(async () => {
    /* db falso com a mesma regra do de verdade: o que sai do get é imutável */
    const docs = {};
    const congelar = (o) => {
      if (o && typeof o === 'object') { Object.values(o).forEach(congelar); Object.freeze(o); }
      return o;
    };
    LX.Store.db = {
      doc: (caminho) => ({
        get: async () => (docs[caminho] ? { data: () => congelar(JSON.parse(JSON.stringify(docs[caminho]))) } : null),
        set: async (d) => { docs[caminho] = JSON.parse(JSON.stringify(d)); }
      })
    };
    LX.Store.modo = 'nuvem';
    const saida = {};
    try {
      const u = await LX.Auth.criar({ usuario: 'joana', email: 'joana@exemplo.com', senha: 'xJ3pQ7mrKt2' });
      saida.criou = u.usuario;
      LX.Progress.markLesson('l1-1', true);
      await LX.Auth.gravarAgora(LX.Auth.progresso);
      await LX.Auth.sair();
      saida.saiu = LX.Auth.usuario === null;
      const v = await LX.Auth.entrar({ login: 'joana@exemplo.com', senha: 'xJ3pQ7mrKt2' });
      saida.entrou = v.usuario;
      saida.aulas = Object.keys(LX.Auth.progresso.lessons).length;
      saida.sessoes = Object.keys(docs['contas/joana'].sessoes || {}).length;
      saida.temSenha = JSON.stringify(docs).includes('xJ3pQ7mrKt2');
    } catch (e) { saida.erro = e.message; }
    return saida;
  });
  T('cria conta com documentos congelados', nuvem.criou === 'joana', nuvem);
  T('grava e encerra a sessão sem tentar mutar o documento', nuvem.saiu === true, nuvem);
  T('entra de novo pelo e-mail', nuvem.entrou === 'joana', nuvem);
  T('o progresso volta da nuvem', nuvem.aulas === 1, nuvem);
  T('a sessão nova foi registrada na conta', nuvem.sessoes === 1, nuvem);
  T('nenhuma senha em texto puro na nuvem', nuvem.temSenha === false, nuvem);

  await browser.close();
  srv.close();

  const ruido = erros.filter(e => !/favicon|ERR_/.test(e));
  if (ruido.length) { console.log('\nerros no console:'); ruido.slice(0, 10).forEach(e => console.log('  ' + e)); }
  console.log(`\n=== ${ok} passaram · ${mau} falharam${ruido.length ? ' · ' + ruido.length + ' erros de console' : ''} ===\n`);
  process.exit(mau || ruido.length ? 1 : 0);
})();
