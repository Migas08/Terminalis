/* Percorre a experiência principal como um aluno novo: entra, investiga um
   cenário, usa uma dica, resolve no terminal e desbloqueia o próximo treino. */
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { chromium } = require('playwright');

const FILE = path.join(__dirname, '..', 'dist', 'terminalis.html');
let passed = 0;
let failed = 0;
const test = (name, condition, extra) => {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra === undefined ? '' : '  → ' + JSON.stringify(extra).slice(0, 300))); }
};

(async () => {
  const shots = path.join(__dirname, '..', 'work');
  fs.mkdirSync(shots, { recursive: true });
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(fs.readFileSync(FILE));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    ...require('./browser-options'),
    args: ['--disable-features=Autofill,AutofillServerCommunication', '--disable-save-password-bubble', '--password-store=basic']
  });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push('PAGEERROR: ' + error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push('CONSOLE: ' + message.text()); });
  await page.route('**/@supabase/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.waitForFunction(() => !!window.LX && !!LX.AuthUI && !!LX.AuthUI.el, null, { timeout: 20000 });

    console.log('\n=== EXPERIÊNCIA ORIENTADA A EXERCÍCIOS ===\n');
    test('a plataforma pede autenticação antes de carregar o ambiente',
      await page.evaluate(() => !document.getElementById('auth-screen').classList.contains('hidden')));

    await page.evaluate(async () => {
      await LX.Auth.criar({ usuario: 'novato', email: 'novato@exemplo.invalid', senha: 'primeiraSenha9' });
      LX.AuthUI.esconder();
      window.__app = new LX.App();
      await window.__app.start();
    });
    await page.locator('.v2-hero').waitFor();

    const home = await page.locator('#page').innerText();
    test('a home comunica prática como caminho principal', /Aprenda resolvendo/.test(home) && /Exercícios recomendados/.test(home));
    test('a home mostra competências e métricas de exercícios', /Progresso por tecnologia/.test(home) && /exercícios concluídos/.test(home));
    test('Cursos e Jornada não aparecem na navegação', await page.locator('[data-nav="cursos"], [data-nav="jornada"]').count() === 0);
    test('Exercícios e Projetos são destinos principais',
      await page.locator('.sb-nav [data-nav="challenges"], .sb-nav [data-nav="projetos"]').count() === 2);

    await page.locator('#v2-explore-all').click();
    await page.locator('.v2-explore').waitFor();
    test('o catálogo contém os nove exercícios Linux iniciais', await page.locator('[data-challenge-card]').count() === 9);
    test('o primeiro treino está liberado', !(await page.locator('[data-challenge-card="LINUX-006"]').getAttribute('class')).includes('is-locked'));
    test('o exercício seguinte explica seu pré-requisito',
      (await page.locator('[data-challenge-card="LINUX-007"]').innerText()).includes('Conclua antes'));

    await page.locator('[data-challenge-card="LINUX-007"]').click();
    test('um cenário bloqueado não abre antes da prática necessária', await page.evaluate(() => __app.route.view) === 'challenges');

    await page.locator('[data-challenge-card="LINUX-006"]').click();
    await page.locator('.v2-challenge').waitFor();
    const exercise = await page.locator('#page').innerText();
    test('o exercício começa por situação, missão e objetivos', /SITUAÇÃO/.test(exercise) && /MISSÃO/.test(exercise) && /OBJETIVOS/.test(exercise));
    test('a teoria fica recolhida como apoio contextual', /Entender conceitos/.test(exercise) && /Entender melhor/.test(exercise));
    test('não existe chamada para abrir uma aula', !/Abrir aula/.test(exercise));

    await page.locator('#v2-next-hint').click();
    test('uma solicitação revela somente a primeira dica', await page.locator('.v2-hints article').count() === 1);

    await page.evaluate(async () => {
      await __app.term.runVisible('cd /srv/portal/releases/current');
      await __app.term.runVisible('pwd > /home/aluno/inspecao-deploy.txt');
      await __app.term.runVisible('ls -la >> /home/aluno/inspecao-deploy.txt');
    });
    await page.locator('#v2-validate').click();
    await page.locator('.v2-complete').waitFor();
    const completion = await page.locator('#page').innerText();
    test('a validação reconhece o estado real do ambiente', /CONCLUÍDO/.test(completion) && /\+40 XP/.test(completion));
    test('a conclusão explica o ocorrido e admite alternativas', /O QUE ACONTECEU/.test(completion) && /Outros caminhos válidos/.test(completion));
    test('o próximo treino é desbloqueado pela conclusão', await page.evaluate(() => LX.ChallengeCatalog.isUnlocked('LINUX-007', LX.Progress.data)));

    await page.evaluate(() => __app.goChallenges());
    test('o catálogo atualiza o bloqueio sem recarregar a página',
      !(await page.locator('[data-challenge-card="LINUX-007"]').getAttribute('class')).includes('is-locked'));

    await page.evaluate(() => __app.goProjects());
    const projects = await page.locator('#page').innerText();
    test('Projetos tem uma página própria com entregas completas', /Entregas completas/.test(projects) && /Entrega de backup verificável/.test(projects));
    test('o projeto final permanece bloqueado até as competências necessárias',
      (await page.locator('[data-challenge-card="LINUX-005"]').getAttribute('class')).includes('is-locked'));

    await page.locator('#conta-chip').click();
    const account = await page.locator('#conta-menu').innerText();
    test('a conta mede exercícios e resoluções sem dicas, não aulas',
      /Exercícios concluídos/.test(account) && /Resolvidos sem dicas/.test(account) && !/Aulas concluídas/.test(account));

    await page.evaluate(() => __app.goHome());
    await page.screenshot({ path: path.join(shots, 'student-home.png'), fullPage: true });
    await page.evaluate(() => __app.goChallenge('LINUX-007'));
    await page.screenshot({ path: path.join(shots, 'student-exercise.png'), fullPage: true });
  } finally {
    await browser.close();
    server.close();
  }

  const noise = errors.filter(error => !/favicon|ERR_|net::/.test(error));
  if (noise.length) noise.slice(0, 8).forEach(error => console.log('  ' + error));
  console.log(`\n=== ${passed} passaram · ${failed} falharam${noise.length ? ' · ' + noise.length + ' erros de console' : ''} ===\n`);
  process.exit(failed || noise.length ? 1 : 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
