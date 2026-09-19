# Currículo JavaScript

A trilha “JavaScript do zero ao profissional” possui 12 módulos e um projeto final, com cinco aulas por módulo. São 65 aulas e 195 atividades na sequência guiado, quiz e desafio.

## Progressão

| Módulo | Aulas e competências |
|---|---|
| JS01 — Execução e fundamentos | Engine e host; `let`/`const`; operadores; decisões; laços e depuração |
| JS02 — Valores e contratos | Tipos e igualdade; conversões; strings; ausência de dados; validação externa |
| JS03 — Funções e escopo | Closures; formas de função; hoisting/TDZ; callbacks e `this`; factories e memoização |
| JS04 — Objetos | Classes e `this`; cópia/desestruturação; prototype chain; descritores/freeze; composição |
| JS05 — Coleções | `map/filter/reduce`; arrays e mutação; Map/Set; generators; iteração assíncrona |
| JS06 — Módulos e pacotes | ESM; live bindings; import dinâmico; CommonJS; `package.json`, semver e API pública |
| JS07 — Assincronismo | `async/await`; cadeias de Promise; combinadores; event loop; cancelamento e concorrência |
| JS08 — Browser | JSON; DOM; eventos e formulários acessíveis; Fetch/URL; storage, workers, performance e crypto |
| JS09 — Node.js | `fs`; processo e caminhos; Buffer/EventEmitter; streams/backpressure; shutdown e contexto |
| JS10 — Backend | Repositório; HTTP; REST/idempotência/paginação; autenticação; middleware e persistência |
| JS11 — Qualidade | Testes; pirâmide e dublês; XSS/CSRF/CORS/CSP; ataques de backend; observabilidade |
| JS12 — Produção | Imutabilidade; DIP; ports and adapters; profiling/GC; configuração, health e deploy |
| Projeto final | Módulo testado; contrato; domínio/persistência; API/segurança/observabilidade; suíte de aceite |

## Compatibilidade de progresso

Os 14 IDs publicados antes da expansão foram preservados. Cada módulo mantém sua aula original e recebe aulas de numeração subsequente. Novos IDs não reutilizam identificadores existentes.

## Verificação dos desafios

Os desafios novos:

- exigem um arquivo criado pelo aluno, separado do arquivo semeado;
- rejeitam arquivos curtos, `TODO` e delimitadores ou aspas incompletos;
- verificam estruturas específicas do comportamento pedido;
- podem exigir quantidade mínima de casos, como dois ou quatro testes;
- rejeitam padrões explicitamente perigosos, como `innerHTML` para entrada variável;
- mantêm a execução do código no runner isolado, fora do domínio da aplicação.

As soluções oficiais são executadas por `test/solutions.js`. O contrato curricular completo é verificado por `test/javascript-curriculum.js`, e o percurso real no navegador por `test/javascript-course.js`.

## Precisão técnica

O conteúdo explicita que:

- falsy inclui zero numérico, `-0`, `0n`, string vazia, `false`, `null`, `undefined` e `NaN`;
- `Map` oferece acesso médio eficiente, sem promessa absoluta de O(1);
- `JSON.parse` não executa código, mas dados externos ainda exigem limite e validação;
- leitura textual com `fs.promises.readFile` declara o encoding `utf8`;
- `Object.freeze` é raso;
- ESM e CommonJS são sistemas diferentes e não devem ser misturados acidentalmente;
- métodos de array podem preservar o array e ainda assim ter callbacks com efeitos colaterais.
