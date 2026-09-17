/* =========================================================================
   TERMINALIS — adaptador de TypeScript (Fase 4, opção 1)

   Carrega o compilador oficial do TypeScript SOB DEMANDA de uma CDN (só quando
   o aluno roda um arquivo .ts) e o usa para transpilar o código para JavaScript,
   que então roda na MESMA sandbox isolada dos módulos .js. O compilador nunca
   toca no realm da aplicação: ele apenas transforma texto em texto; a execução
   continua fora, no Worker/iframe.

   O módulo é pura orquestração de texto — não executa código do aluno. O
   carregador é INJETÁVEL (`configureLoader`), o que permite exercitar toda a
   lógica de transpilação e diagnósticos com um compilador de mentira nos testes,
   sem depender de rede. Em produção, o carregador padrão insere o script da CDN.
   ========================================================================= */
'use strict';
(function () {
  LX.JS = LX.JS || {};
  const TS = {};

  const CDN = 'https://cdn.jsdelivr.net/npm/typescript@5.6.3/lib/typescript.min.js';
  const RE_TS = /\.(ts|mts|cts)$/i;

  let cache = null;
  let loader = null;

  TS.isTypeScript = (name) => RE_TS.test(String(name));
  /* Nome de saída: troca a extensão TypeScript por .js (o que a sandbox roda). */
  TS.jsName = (name) => String(name).replace(RE_TS, '.js');

  /* Injeta um carregador alternativo (testes, ambientes sem CDN). Devolve — ou
     resolve para — o objeto `ts`. Limpa o cache para a próxima carga. */
  TS.configureLoader = function (fn) { loader = fn; cache = null; };

  /* Carrega o compilador uma única vez; devolve uma Promise para o objeto `ts`.
     Em falha, o cache é limpo para permitir nova tentativa. */
  TS.load = function () {
    if (cache) return cache;
    const fn = loader || defaultLoader;
    const p = Promise.resolve().then(fn).then((ts) => {
      if (!ts || typeof ts.transpileModule !== 'function') throw new Error('Compilador TypeScript inválido.');
      return ts;
    });
    p.catch(() => { if (cache === p) cache = null; });
    cache = p;
    return p;
  };

  function defaultLoader() {
    if (typeof window !== 'undefined' && window.ts) return window.ts;
    if (typeof document === 'undefined') throw new Error('TypeScript exige um navegador (sem DOM disponível aqui).');
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.onload = () => (window.ts ? resolve(window.ts) : reject(new Error('TypeScript não ficou disponível após carregar.')));
      s.onerror = () => reject(new Error('Falha ao baixar o compilador TypeScript (rede indisponível?).'));
      document.head.appendChild(s);
    });
  }

  /* Opções didáticas: ESM moderno, um arquivo por vez (isolatedModules). */
  function compilerOptions(ts) {
    const K = ts.ModuleKind || {};
    const T = ts.ScriptTarget || {};
    return {
      module: K.ESNext != null ? K.ESNext : 99,
      target: T.ES2020 != null ? T.ES2020 : 7,
      isolatedModules: true,
      esModuleInterop: true,
      inlineSourceMap: false
    };
  }

  function mapDiagnostics(ts, list, fileName) {
    const out = [];
    for (const d of (list || [])) {
      let line = null, column = null;
      if (d.file && typeof d.start === 'number' && typeof d.file.getLineAndCharacterOfPosition === 'function') {
        const pos = d.file.getLineAndCharacterOfPosition(d.start);
        line = pos.line + 1;
        column = pos.character + 1;
      }
      const message = typeof ts.flattenDiagnosticMessageText === 'function'
        ? ts.flattenDiagnosticMessageText(d.messageText, '\n')
        : String(d.messageText);
      out.push({ file: (d.file && d.file.fileName) || fileName || null, line, column, message, code: d.code != null ? d.code : null });
    }
    return out;
  }

  /* Transpila UM arquivo .ts para JS. Puro: recebe o `ts` já carregado.
     Devolve { code, diagnostics:[{file,line,column,message,code}] }. */
  TS.transpile = function (ts, source, fileName) {
    const out = ts.transpileModule(String(source), {
      compilerOptions: compilerOptions(ts),
      fileName: fileName || 'arquivo.ts',
      reportDiagnostics: true
    });
    return { code: out.outputText, diagnostics: mapDiagnostics(ts, out.diagnostics, fileName) };
  };

  /* Transpila um projeto {nome: fonte}: só os .ts são compilados (renomeados
     para .js), os demais passam intactos. Os especificadores de import não são
     tocados — o carregador da sandbox resolve `./x` para `x.js` sozinho.
     Devolve { files:{...}, diagnostics:[...] }. */
  TS.transpileProject = function (ts, files) {
    const outFiles = {};
    let diagnostics = [];
    for (const name of Object.keys(files || {})) {
      if (TS.isTypeScript(name)) {
        const r = TS.transpile(ts, files[name], name);
        outFiles[TS.jsName(name)] = r.code;
        diagnostics = diagnostics.concat(r.diagnostics);
      } else {
        outFiles[name] = files[name];
      }
    }
    return { files: outFiles, diagnostics };
  };

  /* Há algum arquivo TypeScript no conjunto? */
  TS.projectHasTypeScript = (files) => Object.keys(files || {}).some(TS.isTypeScript);

  TS.CDN = CDN;
  LX.JS.TypeScript = TS;
})();
