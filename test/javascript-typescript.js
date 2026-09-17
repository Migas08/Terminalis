/* Fase 4 do runner JS — adaptador de TypeScript.

   Prova, sem rede e sem navegador, que a camada que liga o TypeScript à sandbox
   funciona: o carregador é injetável (aqui usamos um compilador de mentira),
   a transpilação devolve o JS e os diagnósticos mapeados, e um projeto misto
   .ts/.js é convertido corretamente (só os .ts viram .js).

   Em produção, o mesmo adaptador carrega o compilador OFICIAL do TypeScript de
   uma CDN sob demanda; a lógica exercitada aqui é idêntica. */
const assert = require('node:assert/strict');
const { loadEngine } = require('./harness');

const LX = loadEngine();
const TS = LX.JS.TypeScript;

/* Compilador de mentira: remove anotações `: tipo` simples (basta para provar a
   ida e volta) e emite um diagnóstico quando encontra a palavra ERRO. */
function mockTs() {
  return {
    ModuleKind: { ESNext: 99 },
    ScriptTarget: { ES2020: 7 },
    flattenDiagnosticMessageText: (m) => String(m),
    transpileModule(source, opts) {
      const outputText = String(source).replace(/:\s*(number|string|boolean)\b/g, '');
      const diagnostics = [];
      const pos = String(source).indexOf('ERRO');
      if (pos >= 0) {
        diagnostics.push({
          code: 9999,
          messageText: 'tipo inválido de exemplo',
          start: pos,
          file: { fileName: opts.fileName, getLineAndCharacterOfPosition: (p) => ({ line: 0, character: p }) }
        });
      }
      return { outputText, diagnostics };
    }
  };
}

(async () => {
  /* ---------------- reconhecimento de extensões ---------------- */
  assert.equal(TS.isTypeScript('a.ts'), true);
  assert.equal(TS.isTypeScript('a.mts'), true);
  assert.equal(TS.isTypeScript('a.js'), false);
  assert.equal(TS.jsName('a.ts'), 'a.js');
  assert.equal(TS.jsName('dir/b.mts'), 'dir/b.js');
  assert.equal(TS.jsName('c.js'), 'c.js', 'arquivo .js não é renomeado');

  /* ---------------- carregador injetável e cache ---------------- */
  let cargas = 0;
  TS.configureLoader(() => { cargas++; return mockTs(); });
  const ts = await TS.load();
  assert.equal(typeof ts.transpileModule, 'function');
  await TS.load();
  assert.equal(cargas, 1, 'o compilador é carregado uma única vez (cache)');

  /* ---------------- transpilação e diagnósticos ---------------- */
  const ok = TS.transpile(ts, 'const x: number = 1;\n', 'a.ts');
  assert.equal(ok.code, 'const x = 1;\n', 'anotação de tipo removida');
  assert.equal(ok.diagnostics.length, 0, 'sem diagnósticos no código válido');

  const bad = TS.transpile(ts, 'const ERRO: number = 1;\n', 'a.ts');
  assert.equal(bad.diagnostics.length, 1, 'um diagnóstico emitido');
  assert.equal(bad.diagnostics[0].message, 'tipo inválido de exemplo');
  assert.equal(bad.diagnostics[0].line, 1, 'linha 1 (base 1)');
  assert.equal(bad.diagnostics[0].code, 9999);
  assert.equal(bad.diagnostics[0].file, 'a.ts');

  /* ---------------- projeto misto .ts + .js ---------------- */
  assert.equal(TS.projectHasTypeScript({ 'a.ts': '', 'b.js': '' }), true);
  assert.equal(TS.projectHasTypeScript({ 'b.js': '' }), false);

  const proj = TS.transpileProject(ts, {
    'main.ts': 'const n: number = 2;\nexport const dobro = (v: number) => v * 2;\n',
    'lib.js': 'export const um = 1;\n'
  });
  assert.ok(Object.prototype.hasOwnProperty.call(proj.files, 'main.js'), 'main.ts virou main.js');
  assert.ok(!Object.prototype.hasOwnProperty.call(proj.files, 'main.ts'), 'a chave .ts sumiu');
  assert.equal(proj.files['lib.js'], 'export const um = 1;\n', 'arquivos .js passam intactos');
  assert.match(proj.files['main.js'], /const n = 2;/, 'os tipos foram removidos no .ts');

  /* ---------------- nova tentativa após falha de carga ---------------- */
  TS.configureLoader(() => { throw new Error('rede caiu'); });
  await assert.rejects(() => TS.load(), /rede caiu/);
  TS.configureLoader(() => mockTs());
  const ts2 = await TS.load();
  assert.equal(typeof ts2.transpileModule, 'function', 'recarrega após uma falha (cache limpo)');

  console.log('JavaScript TypeScript: extensões, carregador injetável com cache, transpilação, diagnósticos mapeados, projeto misto e recarga após falha passaram.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
