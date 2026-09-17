/* Fase 1 do runner JS — teste de interface no navegador real.

   Dirige o playground JavaScript dentro de um Chromium: o aluno PROGRAMA no
   editor da aba JS (que só existe no curso de JavaScript), roda, e o código é
   salvo como arquivo no laboratório. Confere console, erro localizado, timeout
   de laço infinito e — o ponto central — o ISOLAMENTO DE REALM: código do aluno
   não alcança window, parent, top, document, localStorage nem LX.

   O SDK do Supabase (CDN) é substituído por um stub vazio para rodar sem rede. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '../dist/terminalis.html');

async function runEditor(page, code) {
  await page.evaluate(() => { LX.JSWorkspace.clear(); });
  await page.fill('#js-editor', code);
  await page.click('#js-run');
}
async function waitConsole(page, needle, timeout) {
  await page.waitForFunction(
    text => document.querySelector('#js-console') && document.querySelector('#js-console').innerText.includes(text),
    needle, { timeout: timeout || 8000 }
  );
}
const consoleText = page => page.evaluate(() => document.querySelector('#js-console').innerText);

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
    await page.route('**/@supabase/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.evaluate(async () => {
      await LX.Auth.criar({ nome: 'Aluno JS', usuario: 'jsui', email: 'jsui@example.invalid', senha: 'TesteSeguro123' });
      LX.AuthUI.esconder();
      window.__app = new LX.App();
      await __app.start();
      for (const m of LX.COURSE.modules) for (const l of m.lessons) {
        LX.Progress.data.lessons[l.id] = 1;
        for (const t of (l.tasks || [])) LX.Progress.data.tasks[t.id] = 1;
      }
    });

    /* ---------- aba JS só no curso de JavaScript; terminal só fora dele ---------- */
    await page.evaluate(() => __app.goLesson('l1-1'));      // aula de Linux
    assert.equal(await page.locator('.sp-tab[data-tab="js"]').isVisible(), false, 'aba JS escondida fora do curso JS');
    assert.equal(await page.locator('.sp-tab[data-tab="term"]').isVisible(), true, 'terminal visível fora do curso JS');
    await page.evaluate(() => __app.goLesson('js1-1'));      // aula de JavaScript
    assert.equal(await page.locator('.sp-tab[data-tab="js"]').isVisible(), true, 'aba JS visível no curso JS');
    assert.equal(await page.locator('.sp-tab[data-tab="term"]').isVisible(), false, 'terminal escondido no curso JS');
    assert.equal(await page.locator('#js-editor').isVisible(), true, 'o editor é o painel padrão no curso JS');

    /* ---------- programar no editor e rodar ---------- */
    await runEditor(page, "console.log('Olá', 1 + 1, { a: [1, 2] });\nconsole.warn('cuidado');");
    await waitConsole(page, 'Olá 2 {a: [1, 2]}');
    await waitConsole(page, 'concluído');
    let text = await consoleText(page);
    assert.match(text, /cuidado/, 'console.warn aparece');
    assert.ok(await page.locator('#js-console .js-warn').count() >= 1, 'warn tem estilo próprio');

    /* o programa foi salvo como arquivo no laboratório */
    const salvo = await page.evaluate(() => __app.term.sh.m.fs.readFile('/home/aluno/js/rascunho.js', __app.term.sh.fsopts()));
    assert.match(salvo, /console\.log\('Olá'/, 'o editor salvou o código no VFS');

    /* ---------- assíncrono real no navegador: promise + timer drenam antes do fim ---------- */
    await runEditor(page, [
      "console.log('a');",
      "Promise.resolve().then(function () { console.log('b'); });",
      "setTimeout(function () { console.log('c'); }, 10);",
      "console.log('d');"
    ].join('\n'));
    await waitConsole(page, 'concluído');
    const linhas = await page.evaluate(() => [...document.querySelectorAll('#js-console .js-line')].map(l => l.textContent));
    const so = linhas.filter(t => /^[abcd]$/.test(t));
    assert.deepEqual(so, ['a', 'd', 'b', 'c'], 'ordem sync, resto do script, microtask, timer');
    assert.ok(linhas.indexOf('c') < linhas.findIndex(t => /concluído/.test(t)), 'concluído só depois do timer');

    /* ---------- módulos ESM multi-arquivo ---------- */
    await page.evaluate(() => {
      __app.term.sh.m.fs.writeFile('/home/aluno/js/lib.js', 'export const dobro = function (n) { return n * 2; };\n', __app.term.sh.fsopts());
    });
    await runEditor(page, "import { dobro } from './lib.js';\nconsole.log('dobro de 21 é', dobro(21));");
    await waitConsole(page, 'dobro de 21 é 42');
    await waitConsole(page, 'concluído');

    /* ---------- módulos Node embutidos no editor ---------- */
    await runEditor(page, "const path = require('path');\nconsole.log('base', path.basename('/a/b/c.js'), 'plataforma', process.platform);");
    await waitConsole(page, 'base c.js plataforma browser');

    /* ---------- fs sobre o VFS por capability ---------- */
    await runEditor(page, [
      "const fs = require('fs');",
      "async function main() {",
      "  await fs.promises.writeFile('anotacao.txt', 'salvo pelo aluno');",
      "  const c = await fs.promises.readFile('anotacao.txt');",
      "  console.log('conteudo:', c);",
      "}",
      "main();"
    ].join('\n'));
    await waitConsole(page, 'conteudo: salvo pelo aluno');
    const gravado = await page.evaluate(() => __app.term.sh.m.fs.readFile('/home/aluno/js/anotacao.txt', __app.term.sh.fsopts()));
    assert.equal(gravado, 'salvo pelo aluno', 'fs.writeFile persistiu no VFS');

    /* rede negada por padrão no editor (nenhuma capability fetch) */
    await runEditor(page, "fetch('https://exemplo.com').then(function () { console.log('CONECTOU'); }, function (e) { console.log('rede:', e.message); });");
    await waitConsole(page, 'rede:');
    text = await consoleText(page);
    assert.ok(!/CONECTOU/.test(text), 'sem rede real');
    assert.match(text, /negada/i, 'fetch negado por padrão');

    /* fuga de path é barrada */
    await runEditor(page, "require('fs').promises.readFile('../../../etc/passwd').then(function () { console.log('VAZOU'); }, function (e) { console.log('bloqueado:', e.message); });");
    await waitConsole(page, 'bloqueado:');
    text = await consoleText(page);
    assert.ok(!/VAZOU/.test(text), 'não vazou arquivo fora da área');
    assert.match(text, /fora da área permitida/, 'escape de path barrado');

    /* ---------- test runner no editor ---------- */
    await runEditor(page, [
      "describe('grupo', function () {",
      "  it('passa', function () { expect(1 + 1).toBe(2); });",
      "  it('quebra', function () { expect(1).toBe(2); });",
      "});"
    ].join('\n'));
    await waitConsole(page, 'testes: 1 passaram, 1 falharam');
    assert.ok(await page.locator('#js-console .js-ok').count() >= 1, 'um teste passou (estilo próprio)');
    text = await consoleText(page);
    assert.match(text, /✓ grupo/, 'teste que passou aparece com ✓');
    assert.match(text, /✗ grupo/, 'teste que falhou aparece com ✗');

    /* ---------- erro com localização ---------- */
    await runEditor(page, "const x = 1;\nthrow new Error('explodiu');");
    await waitConsole(page, 'Error: explodiu');
    text = await consoleText(page);
    assert.match(text, /linha 2/, 'a linha do erro é mostrada');

    /* ---------- ISOLAMENTO DE REALM ---------- */
    await runEditor(page, [
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
    await waitConsole(page, 'window=undefined');
    text = await consoleText(page);
    assert.match(text, /window=undefined parent=undefined top=undefined document=undefined localStorage=undefined LX=undefined globalDoc=undefined/,
      'código do aluno não alcança window, parent, top, document, localStorage nem LX');

    /* ---------- laço infinito é encerrado e a interface continua viva ---------- */
    await runEditor(page, 'while (true) {}');
    await waitConsole(page, 'tempo esgotado', 12000);
    await page.evaluate(() => __app.switchTab('files'));   // terminal não existe no curso JS
    assert.equal(await page.locator('.sp-view[data-view="files"]').isVisible(), true, 'a UI continua respondendo após o timeout');
    await page.click('.sp-tab[data-tab="js"]');

    /* ---------- ação "rodar" a partir do preview de Arquivos ---------- */
    await page.evaluate(() => { LX.JSWorkspace.clear(); __app.switchTab('files'); __app.previewFile('/home/aluno/js/ola.js'); });
    assert.equal(await page.locator('#fb-prev-run').isVisible(), true, 'o preview de um .js mostra o botão rodar no curso JS');
    await page.locator('#fb-prev-run').click();
    await waitConsole(page, 'Olá, JavaScript');

    assert.deepEqual(errors, [], 'nenhum erro de página');
    console.log('JavaScript UI: aba condicional ao curso, editor que salva arquivo, async, test runner, módulos ESM, erro localizado, isolamento de realm, timeout com UI viva e ação rodar do preview passaram.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
