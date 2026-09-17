/* Trilha de JavaScript no navegador: valida o currículo completo e executa uma
   aula no playground isolado. O SDK do Supabase (CDN) vira um stub vazio para o
   teste rodar sem rede. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '../dist/terminalis.html');

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
      await LX.Auth.criar({ nome: 'Aluno JS', usuario: 'jscurso', email: 'jscurso@example.invalid', senha: 'TesteSeguro123' });
      LX.AuthUI.esconder();
      window.__app = new LX.App();
      await __app.start();
    });

    /* ---------- a trilha existe, disponível, com 12 módulos + projeto ---------- */
    const t = await page.evaluate(() => {
      const x = LX.trilhaPorId('js');
      return { nome: x && x.nome, estado: x && x.estado, mods: (x && x.mods || []).length };
    });
    assert.equal(t.nome, 'JavaScript do zero ao profissional');
    assert.equal(t.estado, 'disponivel');
    assert.equal(t.mods, 13, '12 módulos + projeto final');

    const curriculo = await page.evaluate(() => {
      const trilha = LX.trilhaPorId('js');
      const modulos = trilha.mods.map(id => LX.COURSE.modules.find(modulo => modulo.id === id));
      return {
        aulas: modulos.reduce((total, modulo) => total + modulo.lessons.length, 0),
        porModulo: modulos.map(modulo => [modulo.id, modulo.lessons.length]),
        ids: modulos.flatMap(modulo => modulo.lessons.map(aula => aula.id))
      };
    });
    assert.equal(curriculo.aulas, 65, 'currículo completo com 65 aulas');
    assert.ok(curriculo.porModulo.every(([, quantidade]) => quantidade === 5), 'cinco aulas por módulo');
    assert.equal(new Set(curriculo.ids).size, 65, 'IDs de aula únicos');

    /* ---------- a página do curso mostra os títulos e "em breve" ---------- */
    await page.evaluate(() => __app.goCurso('js'));
    await page.locator('#page').waitFor();
    const pageTxt = await page.evaluate(() => document.querySelector('#page').innerText);
    assert.ok(pageTxt.includes('O que executa JavaScript'), 'título do módulo 01');
    assert.ok(pageTxt.includes('Assíncrono, event loop'), 'título do módulo 07');
    /* todos os módulos agora têm ao menos uma aula: nenhum fica "em breve" */
    const emBreve = (pageTxt.match(/em breve/gi) || []).length;
    assert.equal(emBreve, 0, 'todos os módulos da trilha JS têm aula (nenhum "em breve")');

    /* cores neutras também nesta página */
    const colors = await page.evaluate(() => [...document.querySelectorAll('#app *')].flatMap(e => {
      const s = getComputedStyle(e);
      return ['color', 'backgroundColor', 'borderTopColor'].map(k => s[k]);
    }).filter(c => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return m && (m[1] !== m[2] || m[2] !== m[3]); }));
    assert.deepEqual([...new Set(colors)], [], 'cores neutras na página do curso JS');

    /* ---------- a aula-piloto abre e roda o exemplo no playground ---------- */
    await page.evaluate(() => __app.goLesson('js1-1'));
    await page.locator('h1.title').waitFor();
    assert.match(await page.textContent('h1.title'), /Rodar seu primeiro JavaScript/);
    await page.evaluate(() => { __app.switchTab('files'); __app.previewFile('/home/aluno/js/ola.js'); });
    assert.equal(await page.locator('#fb-prev-run').isVisible(), true, 'botão rodar no preview do .js');
    await page.locator('#fb-prev-run').click();
    await page.waitForFunction(() => {
      const c = document.querySelector('#js-console');
      return c && c.innerText.includes('Olá, JavaScript') && c.innerText.includes('concluído');
    }, null, { timeout: 8000 });
    const consoleTxt = await page.evaluate(() => document.querySelector('#js-console').innerText);
    assert.ok(consoleTxt.includes('4'), 'a saída mostra 2 + 2 = 4');

    assert.deepEqual(errors, [], 'nenhum erro de página');
    console.log('JavaScript course: 65 aulas visíveis, módulos completos, cores neutras e playground funcionando.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
