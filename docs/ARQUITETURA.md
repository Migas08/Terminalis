# Arquitetura do Terminalis

O Terminalis é uma aplicação web estática. Não existe um servidor de aplicação neste repositório: Linux, Bash, Docker, Git e GitHub são simulados em JavaScript dentro do navegador. O build reúne os fontes em `dist/terminalis.html`, que pode ser servido por qualquer servidor HTTP estático.

## Fluxo de execução

1. `75-shell.html` fornece a estrutura da página e inicia autenticação e aplicação.
2. `09-runtime.js` cria o namespace `LX` e os utilitários compartilhados.
3. Os módulos `10-*` a `48-*` implementam a máquina, o shell e os simuladores.
4. Os módulos `50-*` a `68-*` registram o curso de Linux; `79-*` a `83-*`, Docker e operação; `84-*` a `86-*`, Git e GitHub.
5. `70-styles.css` mantém todo o sistema visual.
6. `71-*` a `78-*` e `87-*` a `88-*` implementam interface, autenticação, progresso e diagramas.
7. `49-workspace-*` define o codec versionado e a serialização dos domínios; `74-cloud-*` conecta o armazenamento ao Supabase sem acoplar a interface ao SDK.

`build.py` ordena os arquivos JavaScript pelo nome. Por isso, o prefixo numérico também declara a dependência de carregamento. Módulos novos devem entrar depois das APIs que consomem e antes da inicialização em `75-shell.html` quando forem necessários no primeiro carregamento.

## Limites dos módulos

| Área | Arquivos principais | Responsabilidade |
|---|---|---|
| Runtime | `09-runtime.js` | Namespace e operações comuns de DOM, escape, cópia e igualdade |
| Máquina Linux | `10-vfs.js` a `34-manpages.js` | Sistema de arquivos, kernel, shell, comandos e manuais |
| Git | `35-git-core.js`, `36-git-cli.js` | Estado do repositório e interface de comandos |
| GitHub | `37-github-service.js`, `38-github-cli.js` | Remotos, colaboração, CI didática e comando `gh` |
| Runner JS/TS | `39-js-protocol.js`, `39-js-runner.js`, `39-js-sandbox.js`, `39-js-typescript.js`, `72-js-workspace.js` | Protocolo, coordenador de sessões, sandbox isolada, adaptador de TypeScript e painel de interface (editor multi-arquivo) para executar código do aluno |
| Docker | `40-docker.js` a `48-compose.js` | Motor, imagens, YAML, Dockerfile, Compose e CLI |
| Conteúdo | `50-*` a `68-*`, `80-*` a `86-*` | Catálogo editorial, cenários e verificadores das aulas |
| Interface | `71-terminal.js`, `72-app.js`, `72-task-ui.js`, `72-file-browser.js`, `73-render.js` | Terminal, navegação, atividades, arquivos e blocos das aulas |
| Conta e jornada | `74-auth.js`, `76-progressao.js` a `78-jornada.js` | Persistência por usuário, pré-requisitos e páginas de curso |
| Workspace | `49-workspace-00-codec.js`, `49-workspace-10-domains.js` | Exportação, validação e restauração do laboratório completo |
| Nuvem | `74-cloud-10-config.js` a `74-cloud-40-sync.js` | Configuração Supabase, Auth, armazenamento, cache offline e sincronização |
| Apresentação | `70-styles.css`, `75-shell.html`, `87-git-visual.js`, `88-settings.js` | Layout, shell da página, diagramas e preferências |

O código de domínio não deve acessar elementos da página. A camada de interface pode consultar os simuladores por meio do namespace `LX`. Conteúdo pode preparar cenários e verificar estado, mas não deve duplicar regras do motor.

## Dados e segurança

No modo padrão, contas, hashes de senha, sessões, progresso e anotações ficam no `localStorage` da origem. A integração opcional `claude.use('db')` troca apenas o armazenamento. Quando `TERMINALIS_CONFIG.supabase` está preenchido e o SDK CDN carrega, `LX.Auth` usa o Supabase Auth e `LX.Storage` grava `profiles`, `user_progress` e `workspaces` no PostgreSQL.

Senhas locais são derivadas com PBKDF2-SHA256, salt aleatório por conta e o número de iterações gravado junto ao hash. No modo Supabase, a senha é tratada apenas pelo Supabase Auth. O token de sessão fica no navegador. No modo local, a máquina virtual vive na memória da aba; no modo Supabase, `LX.Workspace.exportState` produz um snapshot JSON versionado e `LX.Sync` o mantém em cache local e na tabela `workspaces` quando há rede. A revisão otimista impede que uma gravação baseada em estado antigo apague alterações de outro dispositivo. Em conflito, o snapshot local é copiado para `terminalis.backup.workspace/<uid>.<timestamp>` e o remoto permanece intacto.

O SQL de produção está em [docs/SUPABASE_SCHEMA.sql](SUPABASE_SCHEMA.sql). Ele cria as tabelas, índices, trigger de perfil após `auth.users` e políticas RLS de leitura, inserção, atualização e remoção apenas da própria linha. A única função `SECURITY DEFINER` é o trigger de criação de perfil; ela fixa `search_path`, não recebe `user_id` do cliente e tem execução revogada para os papéis públicos.

HTML escrito pelos autores das aulas é renderizado como conteúdo confiável do pacote. Mensagens produzidas a partir do estado do aluno passam por `LX.feedbackHtml`, que escapa texto e libera somente a marcação didática prevista. Dados de formulário e nomes apresentados pela interface devem passar por `LX.Util.escapeHtml` ou por `textContent`.

## Runner JavaScript/TypeScript

A fase JS/TS executa código do aluno **fora do realm da aplicação**. A camada é dividida em três módulos sem dependência de DOM no domínio:

- `39-js-protocol.js` define o contrato do canal: nomes de eventos e comandos, limites numéricos (saída, tamanho de mensagem, número e tamanho de arquivos, tempo de execução), inspeção de console à prova de ciclos e as funções que garantem serialização. Nada de `Error`, função, nó de DOM ou objeto `LX` cru atravessa o canal; chaves `__proto__`/`prototype`/`constructor` são recusadas em qualquer profundidade.
- `39-js-runner.js` é o coordenador (`LX.JS.createRunner`). Ele gerencia sessões e execuções (`createSession`, `putFiles`, `run`, `cancel`, `resetSession`, `subscribe`, `dispose`), aplica o tempo limite, contabiliza a saída e emite eventos estruturados. Não usa `eval`/`new Function` e não conhece a implementação da sandbox: conversa com a fronteira por um `transport` injetado.
- `39-js-sandbox.js` fornece `WORKER_SOURCE` (o script do Worker, como string) e `createBrowserTransport`. Em produção, o transport monta um `iframe` `sandbox="allow-scripts"` sem `allow-same-origin` (origem opaca, CSP `connect-src 'none'`) e, dentro dele, um `Worker` descartável criado de um Blob. A CSP do iframe libera `'unsafe-eval'` **apenas dentro dessa origem opaca**, que é como o Worker compila o código do aluno; isso nunca alcança o realm principal. A mesma `WORKER_SOURCE` é exercida nos testes de Node dentro de um contexto `vm` isolado.
- `39-js-typescript.js` (`LX.JS.TypeScript`) é o adaptador de TypeScript (Fase 4, opção 1): carrega o compilador oficial **sob demanda de uma CDN** só quando o aluno roda um arquivo `.ts`, e o usa para transpilar o código para JavaScript, que roda na **mesma** sandbox isolada dos `.js`. O compilador nunca alcança o realm da aplicação — ele apenas transforma texto em texto. O carregador é **injetável** (`configureLoader`), então toda a lógica de transpilação e mapeamento de diagnósticos é exercitada nos testes com um compilador de mentira, sem rede.
- `72-js-workspace.js` (`LX.JSWorkspace`) é a camada de interface: um **editor multi-arquivo** (faixa de abas para criar, renomear, excluir e alternar entre arquivos `.js`/`.ts` do projeto, tudo persistido no VFS), que dispara a execução e desenha os eventos no painel "JS" do laboratório. Ao rodar um projeto com TypeScript, ele chama o adaptador para compilar antes de entregar à sandbox. Só orquestra e renderiza; não executa código do aluno.

**Modelo de ameaça (Fase 1).** O código do aluno roda apenas dentro do Worker/iframe. Ele não alcança `window`, `parent`, `top`, `LX`, o DOM principal, `localStorage`, cookies, token nem o cliente Supabase — nem capturando o global do Worker; rede e filesystem são capabilities negadas por padrão (não existem nesta fase). Um laço infinito é encerrado pelo coordenador via `terminate()` no estouro do tempo, sem travar a interface. Toda saída passa por um teto de bytes e toda mensagem por validação de esquema e tamanho.

**Estado e limites.** A Fase 1 (fatia vertical) e a Fase 2 (assíncrono, test runner e módulos) estão fechadas:

- Fase 1: um arquivo JS no VFS abre no laboratório, a ação "rodar" executa isolado, console e erros têm localização, o laço infinito é terminável e o workspace continua restaurável (só os arquivos são persistidos, nunca objetos vivos da sandbox).
- Fase 2: o Worker roda o event loop — `promises`, `async/await`, microtasks e `setTimeout/setInterval` — e a execução só termina quando a fila esvazia; erros assíncronos e `unhandledrejection` viram eventos. Um test runner didático (`describe/it/expect/beforeEach/afterEach`, com async) emite `test-start`/`test-result` e um resumo. Módulos ESM multi-arquivo funcionam por um grafo de Blobs com imports relativos reescritos (grafos acíclicos; imports de pacotes externos e ciclos falham com erro claro). O painel JS envia o diretório do projeto para a sandbox.

A Fase 3 (capabilities) está avançada:

- **Módulos Node embutidos** — `process` (argv/env vazio/platform), `path`, `EventEmitter` (`require('events')`) e `Buffer` — como globais e via `require`; pacotes externos falham com erro claro (sem npm).
- **Canal RPC de capabilities** — a sandbox pede `{cap, method, args}` e o coordenador chama o handler injetado (negado por padrão), devolvendo uma resposta serializável; a execução espera as RPCs pendentes antes de terminar.
- **`fs` sobre o VFS** (assíncrono, `require('fs')`/`fs/promises`) — o painel liga a capability ao VFS como o aluno e restrita a `/home/aluno`; caminhos que tentam escapar são barrados. `fs` síncrono exigiria SharedArrayBuffer e está documentado como ausente.
- **`fetch`/`Headers`/`Request`/`Response`/`AbortController`** — didáticos, roteados por uma capability `fetch` negada por padrão (rede desligada); um handler de fixtures habilita a rede simulada por aula.

A **Fase 4 (TypeScript, opção 1)** está entregue: o adaptador transpila `.ts` para JS pelo compilador oficial carregado sob demanda de CDN e roda o resultado na sandbox; diagnósticos de sintaxe do compilador viram linhas no console. Falta o **DOM isolado** (decisão de projeto ainda aberta: shim de DOM virtual no Worker vs. executar no documento do iframe) e o **checador de tipos semântico completo** (o `transpileModule` atual cobre a sintaxe; a verificação de tipos cruzando arquivos exige um `Program` com as libs, um passo futuro).

Matriz atual — **real:** execução JS, console, erros localizados, async/event loop, ESM, test runner, edição multi-arquivo, transpilação de TypeScript. **Simulado/didático:** `process`/`path`/`Buffer`/`EventEmitter`, `fs` sobre o VFS, `fetch` por fixtures. **Ausente (falha explícita):** pacotes npm, rede real, `fs` síncrono, DOM (por enquanto), checagem semântica de tipos entre arquivos. O escape de realm no navegador é coberto por `test/javascript-ui.js` (Playwright, que inclui o fluxo multi-arquivo e a compilação de TypeScript com um compilador injetado); os testes de Node (`test/javascript-runtime.js`, `test/javascript-security.js`, `test/javascript-typescript.js`) usam o contexto `vm` como fronteira e provam protocolo, limites, negação de capabilities (sync e async), o ciclo assíncrono, o test runner e o adaptador de TypeScript.

## Verificação

`npm test` verifica a sintaxe de todos os módulos e executa testes de Linux, Docker, Git, estrutura editorial, vocabulário e soluções. `npm run test:browser` cobre autenticação, isolamento de progresso, navegação, responsividade, atividades, mensagens e fluxos visuais de GitHub.

O arquivo em `dist/` é gerado. Toda mudança em `src/` deve ser seguida por `python build.py` antes do commit.
