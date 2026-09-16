/* Fase 1 do runner JS — teste de interface no navegador real.

   Dirige o playground JavaScript dentro de um Chromium: abre um arquivo do VFS,
   executa na sandbox (iframe + Worker descartável) e confere console, erros
   localizados, limite de saída, timeout de laço infinito e — o ponto central —
   o ISOLAMENTO DE REALM: código do aluno não alcança window, parent, top,
   document, localStorage nem LX, mesmo capturando o global do Worker.

   O SDK do Supabase (CDN) é substituído por um stub vazio para o teste rodar sem
   rede; o app já cai para o modo local quando ele falta. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '../dist/terminalis.html');

async function waitConsole(page, needle, timeout) {
  await page.waitForFunction(
    text => document.querySelector('#js-console') && document.querySelector('#js-console').innerText.includes(text),
    needle, { timeout: timeout || 8000 }
  );
}
function consoleText(page) {
  return page.evaluate(() => document.querySelector('#js-console').innerText);
}

(async () => {
  const server = http.createServer((q, r) => {
    r.setHeader('Content-Type', 'text/html; charset=utf-8');
    r.end(fs.readFileSync(DIST));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));

  let browser;
  const errors = [];
  try {
    browser = await chromium.launch(require('./browser-options'));
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    // Sem rede no teste: o SDK do Supabase vira um stub vazio.
    await page.route('**/@supabase/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.evaluate(async () => {
      await LX.Auth.criar({ nome: 'Aluno JS', usuario: 'jsui', email: 'jsui@example.invalid', senha: 'TesteSeguro123' });
      LX.AuthUI.esconder();
      window.__app = new LX.App();
      await __app.start();
      // O painel lateral (onde vive o playground) só aparece em rota de aula.
      for (const m of LX.COURSE.modules) for (const l of m.lessons) {
        LX.Progress.data.lessons[l.id] = 1;
        for (const t of (l.tasks || [])) LX.Progress.data.tasks[t.id] = 1;
      }
      __app.goLesson(LX.COURSE.modules[0].lessons[0].id);
    });
    assert.equal(await page.evaluate(() => __app.route.view), 'lesson', 'entrou numa aula');

    /* Prepara arquivos JS no VFS do aluno. */
    await page.evaluate(() => {
      const fs = __app.machine.fs;
      fs.writeFile('/home/aluno/ola.js', "console.log('Ola', 1 + 1, { a: [1, 2] });\nconsole.warn('cuidado');");
      fs.writeFile('/home/aluno/erro.js', "const x = 1;\nthrow new Error('explodiu');");
      fs.writeFile('/home/aluno/loop.js', 'while (true) {}');
      fs.writeFile('/home/aluno/escape.js', [
        "var t = [];",
        "t.push('window=' + typeof window);",
        "t.push('parent=' + typeof parent);",
        "t.push('top=' + typeof top);",
        "t.push('document=' + typeof document);",
        "t.push('localStorage=' + typeof localStorage);",
        "t.push('LX=' + typeof LX);",
        "t.push('globalDoc=' + typeof (Function('return this')().document));",
        "console.log(t.join(' '));"
      ].join('\n'));
    });

    /* ---------- console estruturado ---------- */
    await page.evaluate(() => LX.JSWorkspace.openAndRun(__app, '/home/aluno/ola.js'));
    assert.equal(await page.locator('.sp-view[data-view="js"]').isVisible(), true, 'o painel JS abre ao rodar');
    await waitConsole(page, 'Ola 2 {a: [1, 2]}');
    await waitConsole(page, 'concluído');
    let text = await consoleText(page);
    assert.match(text, /executando ola\.js/);
    assert.match(text, /cuidado/, 'console.warn aparece');
    assert.equal(await page.locator('#js-console .js-warn').count() >= 1, true, 'warn tem estilo próprio');

    /* ---------- erro com localização ---------- */
    await page.evaluate(() => { LX.JSWorkspace.clear(); LX.JSWorkspace.openAndRun(__app, '/home/aluno/erro.js'); });
    await waitConsole(page, 'Error: explodiu');
    text = await consoleText(page);
    assert.match(text, /erro\.js:2/, 'a linha do erro é mostrada');

    /* ---------- ISOLAMENTO DE REALM ---------- */
    await page.evaluate(() => { LX.JSWorkspace.clear(); LX.JSWorkspace.openAndRun(__app, '/home/aluno/escape.js'); });
    await waitConsole(page, 'window=undefined');
    text = await consoleText(page);
    assert.match(text, /window=undefined parent=undefined top=undefined document=undefined localStorage=undefined LX=undefined globalDoc=undefined/,
      'código do aluno não alcança window, parent, top, document, localStorage nem LX');

    /* ---------- laço infinito é encerrado e a interface continua viva ---------- */
    await page.evaluate(() => { LX.JSWorkspace.clear(); LX.JSWorkspace.openAndRun(__app, '/home/aluno/loop.js'); });
    await waitConsole(page, 'tempo esgotado', 12000);
    // A interface responde: trocar de aba e voltar funciona após o timeout.
    await page.evaluate(() => __app.switchTab('term'));
    assert.equal(await page.locator('.sp-view[data-view="term"]').isVisible(), true, 'a UI continua respondendo após o timeout');
    await page.evaluate(() => __app.switchTab('js'));

    /* ---------- ação "rodar" a partir do preview de Arquivos ---------- */
    await page.evaluate(() => { LX.JSWorkspace.clear(); __app.switchTab('files'); __app.previewFile('/home/aluno/ola.js'); });
    assert.equal(await page.locator('#fb-prev-run').isVisible(), true, 'o preview de um .js mostra o botão rodar');
    await page.locator('#fb-prev-run').click();
    await waitConsole(page, 'Ola 2');

    assert.deepEqual(errors, [], 'nenhum erro de página');
    console.log('JavaScript UI: console estruturado, erro localizado, isolamento de realm, timeout de laço infinito, UI viva e ação rodar do preview passaram.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
