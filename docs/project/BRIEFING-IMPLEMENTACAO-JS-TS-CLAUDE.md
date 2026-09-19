# Briefing para o Claude — implementar JavaScript e TypeScript no Terminalis

## Missão

Trabalhe exclusivamente na nova fase JavaScript e TypeScript do Terminalis.
Não refatore Linux, Docker, Git/GitHub, autenticação ou nuvem fora do necessário
para integrar essa capacidade.

O objetivo final é permitir que o aluno:

1. crie e edite projetos JavaScript/TypeScript no VFS;
2. execute JavaScript em ambiente isolado;
3. veja console, erros e resultados no Terminalis;
4. rode testes;
5. use módulos e APIs didáticas;
6. receba diagnósticos TypeScript;
7. transpile TypeScript e execute o JavaScript resultante;
8. resolva tarefas verificadas por estado e testes;
9. percorra trilhas profissionais de JavaScript e TypeScript.

Não tente entregar tudo num único bloco opaco. Implemente por fases verificáveis,
começando por uma vertical slice segura.

## Leitura obrigatória

Antes de mudar qualquer arquivo, leia integralmente:

- **README.md**
- **docs/architecture/ARQUITETURA.md**
- **docs/project/CONTEXTO-PROJETO-CLAUDE.md**
- **docs/research/pesquisa-javascript.txt**
- **docs/research/pesquisa-typescript.txt**
- **docs/research/proposta-inicial-trilhas-js-ts.txt**
- **docs/development/PADRAO-TAREFAS.md**

Depois inspecione:

- **src/09-runtime.js**
- **src/10-vfs.js**
- **src/20-shell-lex.js a src/22-shell-run.js**
- **src/33-net.js**
- **src/41-sql.js**
- **src/42-imgbin.js**, principalmente LX.rodarNode
- **src/49-workspace-*.js**
- **src/50-content-*.js**
- **src/71-terminal.js**
- **src/72-file-browser.js**
- **src/72-task-ui.js**
- **src/73-render.js**
- testes e build.py

Confira git status e preserve mudanças existentes.

## Regras inegociáveis

### Segurança

- Não execute código do aluno no mesmo realm da aplicação.
- O aluno não pode acessar window do Terminalis, LX, DOM principal,
  localStorage, cookies, token, cliente Supabase ou objetos internos.
- Não reutilize LX.rodarNode como sandbox. Ele usa new Function no contexto da
  aplicação e foi criado apenas para diagnósticos simples em containers.
- Um loop infinito deve poder ser encerrado sem travar a interface.
- Limite tempo, saída, mensagens, tamanho de arquivos e operações.
- Rede e filesystem devem ser capabilities explícitas e negadas por padrão.
- Mensagens entre aplicação e sandbox precisam de schema/validação.

### Arquitetura

- JavaScript e TypeScript usam o mesmo runtime final: TS emite JS.
- Domínio do runner não acessa DOM.
- UI conversa com o runner por uma API pequena e estruturada.
- VFS é acessado por adapter/RPC, nunca transferido como objeto.
- Resultados são eventos estruturados: console, exception, rejection,
  diagnostic, test result, module loaded e lifecycle.
- Estado persistente novo entra no codec versionado e nos testes de round-trip.
- A ordem numérica dos arquivos src deve respeitar dependências.
- Não editar dist diretamente; sempre gerar com build.py.

### Produto

- Marcar claramente o que é JavaScript real, API do browser, API Node simulada
  ou visualização conceitual.
- Não prometer Node completo se houver apenas subset.
- Exercícios precisam declarar baseline de versão.
- O simulador deve funcionar offline quando os assets já estiverem disponíveis.
- Dependência nova exige análise de licença, tamanho, cache, manutenção e impacto
  no HTML único.

## Baselines

- ECMAScript: edição 2026.
- Node curricular: APIs suportadas pela linha LTS; novidades de Node 26 devem
  ser rotuladas.
- TypeScript: 7.0.2 para linguagem e CLI.
- Integração programática: avaliar versão estável mais recente no momento da
  implementação. TypeScript 7.0 não expõe API; TypeScript 6.0.3 pode ser fallback
  temporário apenas se documentado e isolado atrás de adapter.

Não altere essas versões silenciosamente.

## Arquitetura-alvo

~~~text
Editor e VFS
    |
    v
JS/TS Workspace Controller
    |------------------------------|
    v                              v
TypeScript Worker              Runner Coordinator
diagnostics/emit                   |
    |                              v
    +----------------------> sandboxed iframe
                                   |
                                   v
                            disposable Worker
                                   |
             +---------------------+--------------------+
             v                     v                    v
         module loader        scheduler/console    capabilities RPC
                                                      |
                                   +------------------+----------------+
                                   v                  v                v
                                  VFS              network            clock
~~~

Sugestão de isolamento:

- iframe com sandbox allow-scripts, sem allow-same-origin;
- origem opaca e CSP restritiva;
- Worker descartável dentro da fronteira;
- MessageChannel;
- teardown por execução/sessão;
- timeout no coordenador;
- nenhum acesso direto a objetos do app.

Se outra arquitetura for escolhida, documente threat model e prove por teste
que código do aluno não atravessa a fronteira.

## Fases obrigatórias

### Fase 1 — vertical slice do runner

Entregar primeiro:

- projeto JS no VFS;
- editor existente abrindo o arquivo;
- ação Run;
- execução isolada;
- console.log/info/warn/error estruturado;
- syntax/runtime error com arquivo, linha e coluna;
- limite de saída;
- timeout e encerramento de loop infinito;
- reset da sandbox;
- teste de segurança que tenta acessar LX, parent DOM, storage e rede;
- teste de interface do fluxo editar → executar → ver resultado;
- persistência apenas dos arquivos, não de objetos vivos da sandbox.

Critério de aceite: um programa “Olá”, um throw e um loop infinito produzem
resultados corretos sem travar ou expor o Terminalis.

Não criar a trilha inteira antes desse gate.

### Fase 2 — módulos, testes e scheduler

- ESM multi-arquivo;
- imports relativos no VFS;
- erros de resolução;
- live bindings e ciclos nos limites suportados;
- promises e async/await;
- timers/fake clock;
- timeline task/microtask;
- unhandled rejection;
- test runner com suite/test/assertions/hooks/async;
- resultados de teste estruturados;
- helpers para verificadores de aula.

Critério de aceite: projeto multi-arquivo executa e suíte async detecta sucesso,
falha e timeout deterministicamente.

### Fase 3 — capabilities browser e Node

Browser:

- DOM isolado;
- events/capture/bubble/delegation;
- URL/URLSearchParams;
- fetch com Request/Response/Headers e AbortSignal;
- storage isolado;
- Worker/message passing conforme necessário.

Node didático:

- process/argv/env;
- fs sync/promises sobre VFS;
- path e URL;
- Buffer;
- EventEmitter;
- streams e pipeline/backpressure;
- timers e sinais;
- HTTP ligado ao motor de rede;
- SQL por adapter quando o exercício pedir.

Cada API deve ter matriz “real/simulada/não suportada”. Unsupported deve falhar
explicitamente, não fingir sucesso.

### Fase 4 — TypeScript

- checker em Worker;
- diagnostics por arquivo/linha/coluna/código;
- tsconfig virtual;
- libs selecionadas conforme ambiente;
- module resolution coerente com o runner;
- import type/export type e verbatimModuleSyntax;
- emit e source maps;
- execução no runner JS;
- type tests, inclusive erro esperado;
- declaration emit quando suportado;
- painel/ação “Verificar tipos” separado de “Executar”.

Critério de aceite: erro de tipo não é confundido com erro runtime; um programa
válido é emitido e executado; dados externos continuam exigindo validação.

### Fase 5 — conteúdo piloto

Somente depois das fases anteriores:

- um módulo piloto JavaScript com três aulas;
- um módulo piloto TypeScript com três aulas;
- cada aula no padrão guiado → pergunta → desafio;
- soluções executáveis;
- verificadores fortes;
- testes de vocabulário e estrutura;
- feedback que explica causa, não apenas “errado”.

Use os currículos propostos, mas não gere todos os módulos até o piloto ser
revisado.

### Fase 6 — expansão das trilhas

Após aprovação do piloto, implementar gradualmente:

- JavaScript: 12 módulos + projeto final;
- TypeScript: 10 módulos + projeto final;
- dependência da trilha TS sobre o núcleo de JS;
- módulos/etapas em arquivos de conteúdo;
- progresso, desbloqueios e cards da jornada;
- projetos finais sem passo a passo;
- documentação e inventário atualizados.

## Estrutura de arquivos sugerida

Os nomes finais dependem da ordem real do build. Uma divisão possível:

~~~text
src/
  39-js-protocol.js
  39-js-workspace.js
  39-js-runner.js
  39-js-capabilities.js
  39-js-modules.js
  39-js-tests.js
  39-ts-service.js
  39-ts-diagnostics.js
  39-ts-emit.js
  69-js-ts-content-core.js
  89-js-course.js
  90-js-lessons-*.js
  91-ts-course.js
  92-ts-lessons-*.js
test/
  javascript-runtime.js
  javascript-security.js
  javascript-modules.js
  javascript-tests.js
  typescript.js
  js-ts-interface.js
~~~

Não copie esses números cegamente. Verifique colisões e dependências no build.
Prefira poucos módulos coesos a um arquivo gigante ou fragmentação artificial.

## Contrato mínimo do runner

Defina uma API equivalente a:

~~~text
createSession(options) -> sessionId
putFiles(sessionId, files)
run(sessionId, entrypoint, options) -> runId
runTests(sessionId, pattern, options) -> runId
cancel(runId)
resetSession(sessionId)
subscribe(listener)
dispose(sessionId)
~~~

Eventos precisam incluir:

~~~text
run-start
console
diagnostic
test-start
test-result
uncaught-error
unhandled-rejection
run-timeout
run-cancelled
run-complete
~~~

Todo evento tem sessionId, runId, timestamp lógico e payload serializável.
Nunca envie Error, DOM node, function ou objeto LX cru pelo canal.

## Testes mínimos de segurança

Crie testes que tentem:

- acessar globalThis.LX;
- acessar parent/top e DOM principal;
- ler localStorage/cookies;
- chamar fetch real quando a capability está negada;
- importar URL remota;
- escapar path permitido no VFS;
- inundar console;
- enviar mensagem gigante;
- executar loop infinito;
- criar timers infinitos;
- usar prototype pollution no protocolo;
- reutilizar sessionId/runId inválido;
- acessar estado de outro usuário/sessão.

Todos devem falhar de forma controlada e sem comprometer o app.

## Testes funcionais mínimos

- execução síncrona e async;
- ordem de microtasks/timers;
- syntax error com localização;
- stack multi-arquivo;
- ESM e erro de import;
- console com objetos/ciclos;
- cancelamento e AbortSignal;
- leitura/escrita VFS autorizada;
- test runner e fake clock;
- diagnostics TS e emit;
- source map;
- persistência/restauração do projeto;
- navegação responsiva e teclado.

## Não fazer

- Não usar eval/new Function no realm principal.
- Não expor VFS inteiro ou LX à sandbox.
- Não buscar packages arbitrários da internet.
- Não fingir npm install real.
- Não usar setTimeout como mecanismo de sincronização de testes.
- Não criar parser JavaScript próprio como substituto da engine.
- Não adicionar frameworks ao currículo base.
- Não criar todas as aulas antes do runtime/testes.
- Não misturar TypeScript 6 e 7 sem adapter e explicação.
- Não alterar cursos existentes para encaixar a nova fase.

## Estratégia de commits

Faça commits por capacidade verificável, por exemplo:

1. runner: adiciona protocolo e sandbox isolada
2. runner: integra console, cancelamento e limites
3. runner: adiciona módulos e test runner
4. runtime: conecta VFS e rede por capabilities
5. typescript: adiciona diagnósticos e emissão
6. content: adiciona módulos piloto de JavaScript e TypeScript
7. docs: documenta APIs, limites e currículo

Não misture bundle gerado, motor, conteúdo completo e refactor incidental em
um commit impossível de revisar.

## Relatório esperado

Ao terminar cada fase, informe:

1. arquivos criados/alterados;
2. decisões arquiteturais;
3. threat model e isolamento;
4. APIs reais, simuladas e ausentes;
5. dependências e impacto no bundle;
6. testes executados e resultados;
7. tamanho do dist antes/depois;
8. limitações conhecidas;
9. migrations de workspace;
10. próxima fase recomendada.

## Definição de pronto da vertical slice

A primeira entrega só está pronta quando:

- roda código JS sem acesso ao app;
- loop infinito é terminável;
- console e erros têm localização;
- VFS só é acessado por capability;
- fluxo funciona no navegador e em tela pequena;
- testes de segurança e interface passam;
- workspace continua restaurável;
- build gera o HTML;
- README/arquitetura documentam limites;
- nenhuma aula promete API ausente.

Se algum item não puder ser cumprido, pare e documente o bloqueio em vez de
reduzir silenciosamente a segurança.

