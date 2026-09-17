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
    assert.ok(await page.locator('body').evaluate(el => el.classList.contains('lab-code')), 'curso JS ativa a experiência Code Lab');
    assert.equal(await page.locator('#lab-kind').textContent(), 'Code Lab', 'topbar identifica o tipo de laboratório');
    assert.equal(await page.locator('#js-save').isVisible(), true, 'Code Lab oferece ação explícita de salvar');
    assert.equal(await page.locator('#workspace-resizer').isVisible(), true, 'aula e Code Lab podem ser redimensionados no desktop');
    assert.match(await page.locator('#sb-cursos').innerText(), /JavaScript/, 'JavaScript aparece na navegação principal de cursos');

    const openExample = page.locator('[data-open-editor]').first();
    assert.equal(await openExample.isVisible(), true, 'exemplos da aula podem ser abertos no editor');
    await openExample.click();
    assert.match(await page.locator('#js-editor').inputValue(), /Olá, JavaScript/, 'exemplo da aula chega ao Code Lab');

    await page.fill('#js-editor', 'const um = 1;\nconst dois = 2;\nconsole.log(um + dois);');
    await page.waitForFunction(() => document.querySelector('#js-gutter').textContent.trim().endsWith('3'));
    assert.equal((await page.locator('#js-gutter').innerText()).trim(), '1\n2\n3', 'editor mostra numeração de linhas sincronizada');

    /* Provider em memória no mesmo caminho usado pelo Supabase: prova que uma
       alteração feita só no editor agenda o snapshot remoto, sem comando no terminal. */
    await page.evaluate(() => {
      window.__workspaceRemoto = null;
      LX.Store.provider = {
        async saveWorkspace(uid, doc) {
          window.__workspaceRemoto = { uid, doc };
          return { ok: true, revision: Number(doc.baseRevision || 0) + 1 };
        }
      };
      LX.Store.modo = 'supabase';
      LX.Sync.iniciar(__app);
    });

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
    await page.waitForFunction(() => window.__workspaceRemoto !== null, null, { timeout: 5000 });
    const salvoNaNuvem = await page.evaluate(() => {
      const restaurado = LX.Workspace.importState(window.__workspaceRemoto.doc.snapshot);
      return restaurado.machine.fs.readFile('/home/aluno/js/rascunho.js');
    });
    assert.match(salvoNaNuvem, /console\.log\('Olá'/, 'o editor agenda e envia o workspace pelo provider Supabase');

    /* Logout/reload pode ocorrer antes dos 700 ms do autosave. capturarAgora
       força esse buffer para o VFS e para o provider antes de encerrar. */
    await page.fill('#js-editor', "console.log('buffer imediato');");
    await page.evaluate(async () => { window.__workspaceRemoto = null; await LX.Sync.capturarAgora(); });
    const bufferCapturado = await page.evaluate(() => {
      const restaurado = LX.Workspace.importState(window.__workspaceRemoto.doc.snapshot);
      return restaurado.machine.fs.readFile('/home/aluno/js/rascunho.js');
    });
    assert.match(bufferCapturado, /buffer imediato/, 'capturarAgora inclui o buffer ainda dentro do debounce');

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

    /* ---------- editor multi-arquivo: criar, alternar e importar entre arquivos ---------- */
    await page.evaluate(() => LX.JSWorkspace.onShow(__app));           // garante a faixa desenhada
    await page.click('#js-file-new');                                 // botão "+"
    await page.fill('.js-file-input', 'util.js');
    await page.press('.js-file-input', 'Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('#js-files .js-file-name')].some(b => b.textContent === 'util.js'));
    assert.equal(await page.locator('#js-files .js-file.active .js-file-name').textContent(), 'util.js', 'o arquivo recém-criado fica ativo');
    await page.fill('#js-editor', 'export const soma = function (a, b) { return a + b; };\n');
    // alternar de aba salva o arquivo inativo no VFS
    await page.locator('#js-files .js-file-name', { hasText: 'rascunho.js' }).click();
    assert.equal(await page.locator('#js-files .js-file.active .js-file-name').textContent(), 'rascunho.js', 'clicar em outra aba troca o arquivo ativo');
    const utilSalvo = await page.evaluate(() => __app.term.sh.m.fs.readFile('/home/aluno/js/util.js', __app.term.sh.fsopts()));
    assert.match(utilSalvo, /export const soma/, 'o arquivo aberto antes foi salvo no VFS ao alternar');
    // importar do arquivo criado pela interface
    await runEditor(page, "import { soma } from './util.js';\nconsole.log('soma', soma(2, 3));");
    await waitConsole(page, 'soma 5');
    // excluir um arquivo pela faixa e conferir que sumiu do VFS
    await page.click('.js-file-x[title="Excluir util.js"]');
    await page.waitForFunction(() => ![...document.querySelectorAll('#js-files .js-file-name')].some(b => b.textContent === 'util.js'));
    const utilApagado = await page.evaluate(() => { try { __app.term.sh.m.fs.readFile('/home/aluno/js/util.js', __app.term.sh.fsopts()); return true; } catch (e) { return false; } });
    assert.equal(utilApagado, false, 'o arquivo excluído sumiu do VFS');
    // a próxima execução usa um retrato novo; o módulo apagado não pode sobreviver na sessão
    await page.evaluate(() => LX.JSWorkspace.clear());
    await page.click('#js-run');
    await waitConsole(page, 'Módulo não encontrado');
    text = await consoleText(page);
    assert.match(text, /\.\/util\.js/, 'o runner não reutiliza um módulo removido de uma execução anterior');

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

    /* ---------- TypeScript: compila (compilador injetado) e roda na sandbox ----------
       O compilador real é carregado de uma CDN em produção; aqui injetamos um
       compilador de mentira que remove as anotações de tipo, para provar toda a
       ligação editor → transpilação → execução isolada sem depender de rede. */
    await page.evaluate(() => {
      LX.JS.TypeScript.configureLoader(() => ({
        ModuleKind: { ESNext: 99 }, ScriptTarget: { ES2020: 7 },
        flattenDiagnosticMessageText: (m) => String(m),
        transpileModule(source) {
          return { outputText: String(source).replace(/:\s*(number|string|boolean)\b/g, ''), diagnostics: [] };
        }
      }));
      LX.JSWorkspace.clear();
      __app.switchTab('js');
      LX.JSWorkspace.onShow(__app);
    });
    await page.click('#js-file-new');
    await page.fill('.js-file-input', 'soma.ts');
    await page.press('.js-file-input', 'Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('#js-files .js-file-name')].some(b => b.textContent === 'soma.ts'));
    await page.fill('#js-editor', "const soma = (a: number, b: number): number => a + b;\nconsole.log('soma', soma(2, 3));");
    await page.click('#js-run');
    await waitConsole(page, 'compilando TypeScript');
    await waitConsole(page, 'soma 5');
    await waitConsole(page, 'concluído');
    const salvoTs = await page.evaluate(() => __app.term.sh.m.fs.readFile('/home/aluno/js/soma.ts', __app.term.sh.fsopts()));
    assert.match(salvoTs, /: number/, 'o arquivo .ts guarda o código com tipos no VFS');

    /* ---------- navegação responsiva entre aula e Code Lab ---------- */
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.mobile-tabs [data-m="term"] span').textContent(), 'Código', 'atalho móvel identifica o Code Lab');
    assert.equal(await page.locator('#workspace-resizer').isVisible(), false, 'divisor de desktop não aparece no celular');
    await page.click('.mobile-tabs [data-m="term"]');
    assert.equal(await page.locator('#side-panel').isVisible(), true, 'atalho Código abre o Code Lab no celular');
    assert.equal(await page.locator('#lesson-panel').isVisible(), false, 'a aula sai de cena enquanto o Code Lab está aberto');
    await page.click('.mobile-tabs [data-m="lesson"]');
    assert.equal(await page.locator('#lesson-panel').isVisible(), true, 'atalho Aula retorna ao conteúdo');

    assert.deepEqual(errors, [], 'nenhum erro de página');
    console.log('JavaScript UI: aba condicional ao curso, editor multi-arquivo (criar/alternar/excluir), async, test runner, módulos ESM, TypeScript compilado e rodando, erro localizado, isolamento de realm, timeout com UI viva e ação rodar do preview passaram.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
