/* Testa a plataforma em navegador headless */
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const shots = path.join(__dirname, '..', 'work');
  fs.mkdirSync(shots, { recursive: true });
  /* servido por http para ter localStorage e WebCrypto como no artifact */
  const htmlBuf = fs.readFileSync(path.join(__dirname, '..', 'dist', 'terminalis.html'));
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(htmlBuf); });
  await new Promise(res => srv.listen(0, res));
  const alvo = 'http://127.0.0.1:' + srv.address().port + '/';

  const browser = await chromium.launch({
    ...require('./browser-options'),
    args: ['--disable-features=Autofill,AutofillServerCommunication', '--disable-save-password-bubble', '--password-store=basic']
  });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(alvo);
  await page.waitForFunction(() => !!window.LX && !!LX.AuthUI && !!LX.AuthUI.el, null, { timeout: 15000 });

  /* a plataforma agora exige conta: cria uma para o teste */
  await page.evaluate(async () => {
    await LX.Auth.criar({ usuario: 'teste', email: 'teste@exemplo.com', senha: 'umaSenhaBoa9' });
    LX.AuthUI.esconder();
    window.__app = new LX.App();
    window.__app.start();
  });
  await page.waitForTimeout(900);

  const boot = await page.evaluate(() => ({
    app: !!window.__app,
    mods: window.LX && LX.COURSE ? LX.COURSE.modules.length : -1,
    lessons: window.LX && LX.COURSE ? LX.COURSE.modules.reduce((s, m) => s + m.lessons.length, 0) : -1,
    railHtml: document.getElementById('sb-cursos').innerHTML.length,
    pageHtml: document.getElementById('page').innerHTML.length
  }));
  console.log('boot:', JSON.stringify(boot));

  // abre a primeira aula
  await page.evaluate(() => window.__app.goLesson('l1-1'));
  await page.waitForTimeout(400);
  const title = await page.textContent('h1.title');
  console.log('aula:', title);

  // executa comandos no terminal
  const runTerm = async (cmd) => await page.evaluate(async (c) => {
    await window.__app.term.runVisible(c);
    return document.getElementById('term-out').innerText.slice(-500);
  }, cmd);

  console.log('--- ls ---');
  console.log(await runTerm('ls'));
  console.log('--- pwd + uname ---');
  console.log(await runTerm('pwd && uname -r'));

  // verifica desafio 1.1-a
  const v1 = await page.evaluate(async () => {
    await window.__app.term.runVisible('uname -r');
    await window.__app.term.runVisible('cat /etc/os-release');
    await window.__app.term.runVisible('hostname');
    const t = window.__app.taskById('t1-1-a');
    return await t.check({ app: __app, machine: __app.machine, term: __app.term, sh: __app.term.sh });
  });
  console.log('check t1-1-a:', JSON.stringify(v1));

  const v2 = await page.evaluate(async () => {
    await window.__app.term.runVisible('uname -r > ~/sistema.txt');
    await window.__app.term.runVisible('grep PRETTY_NAME /etc/os-release >> ~/sistema.txt');
    await window.__app.term.runVisible('hostname >> ~/sistema.txt');
    const t = window.__app.taskById('t1-1-b');
    return await t.check({ app: __app, machine: __app.machine, term: __app.term, sh: __app.term.sh });
  });
  console.log('check t1-1-b:', JSON.stringify(v2));

  // aba arquivos
  await page.evaluate(() => window.__app.switchTab('files'));
  await page.waitForTimeout(300);
  const files = await page.evaluate(() => document.getElementById('fb-list').innerText.split('\n').slice(0, 6));
  console.log('arquivos:', JSON.stringify(files));
  await page.evaluate(() => window.__app.switchTab('term'));

  await page.screenshot({ path: path.join(shots, 'ui-lesson.png') });
  await page.evaluate(() => window.__app.goRoadmap());
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'ui-roadmap.png') });

  await page.setViewportSize({ width: 420, height: 860 });
  await page.evaluate(() => window.__app.goLesson('l1-2'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'ui-mobile.png') });


  // conta autenticada
  await page.setViewportSize({ width: 1536, height: 1000 });
  const conta = await page.evaluate(() => ({
    usuario: LX.Auth.usuario && LX.Auth.usuario.usuario,
    modo: LX.Store.modo,
    chip: document.getElementById('conta-chip').innerText.trim()
  }));
  console.log('conta:', JSON.stringify(conta));
  await page.evaluate(() => { document.getElementById('conta-chip').click(); });
  await page.waitForTimeout(200);
  const menuLen = await page.evaluate(() => document.getElementById('conta-menu').innerHTML.length);
  console.log('menu de conta html:', menuLen);
  await page.screenshot({ path: path.join(shots, 'ui-accounts.png') });

  // página inicial: a jornada em pé
  await page.evaluate(() => { document.body.click(); window.__app.goHome(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'ui-home.png'), fullPage: true });

  // página "Sua jornada", com algum progresso para não ficar tudo zerado
  await page.evaluate(() => {
    const t = LX.trilhaPorId('linux');
    const mods = LX.COURSE.modules.filter(m => t.mods.includes(m.id)).slice(0, 4);
    for (const m of mods) for (const l of m.lessons) {
      for (const k of (l.tasks || [])) LX.Progress.markTask(k.id);
      LX.Progress.markLesson(l.id, true);
    }
    window.__app.avaliarProgressao(false);
    window.__app.goJornada();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, 'ui-journey.png'), fullPage: true });
  await page.evaluate(() => window.__app.goHome());
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'ui-home-return.png'), fullPage: true });

  // tela de acesso
  await page.evaluate(() => { LX.AuthUI.mostrar('entrar'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'ui-login.png') });
  await page.evaluate(() => { LX.AuthUI.trocarAba('criar'); });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(shots, 'ui-signup.png') });
  await page.setViewportSize({ width: 420, height: 860 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(shots, 'ui-login-mobile.png') });
  await page.setViewportSize({ width: 1536, height: 1000 });

  console.log('\nerros:', errors.length);
  errors.slice(0, 12).forEach(e => console.log('  ' + e));
  await browser.close();
  srv.close();
  process.exit(errors.length ? 1 : 0);
})();
