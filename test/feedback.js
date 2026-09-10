const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync(path.join(__dirname, '../work'), { recursive: true });
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(__dirname, '../dist/terminalis.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch(require('./browser-options'));
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.evaluate(async () => {
      await LX.Auth.criar({ usuario: 'feedback', email: 'feedback@example.invalid', senha: 'TesteSeguro123' });
      LX.AuthUI.esconder();
      window.__app = new LX.App();
      await __app.start();
      __app.goHome();
      __app.trilhaId = null;
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await page.evaluate(() => {
        const tasks = LX.COURSE.modules.flatMap(m => m.lessons).flatMap(l => l.tasks).filter(t => t.kind === 'quiz');
        const failures = [];
        for (const task of tasks) for (const correct of [true, false]) {
          const index = task.options.findIndex(o => !!o.correct === correct);
          document.querySelector('#page').innerHTML = '<div class="doc">' + __app.renderTask(task) + '</div>';
          const card = document.querySelector('.task');
          __app.wireTask(card);
          card.querySelector(`[data-opt="${index}"]`).click();
          const explanation = card.querySelector('.explain');
          const style = getComputedStyle(explanation);
          if (parseFloat(style.marginLeft) < 16 || parseFloat(style.paddingLeft) < 14 || getComputedStyle(explanation.firstElementChild).display !== 'block') failures.push(task.id);
          if (explanation.scrollWidth > explanation.clientWidth + 1) failures.push(task.id + ': overflow');
          if (!explanation.textContent.startsWith(correct ? 'Correto.' : 'Não é essa.')) failures.push(task.id + ': verdict');
        }
        return { count: tasks.length, failures };
      });
      assert.deepEqual(result.failures, []);
      console.log(`${width}px: ${result.count} quizzes, correct and incorrect explanations passed.`);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
