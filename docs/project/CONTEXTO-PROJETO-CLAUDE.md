# Terminalis — contexto completo para continuar o projeto

Este documento foi preparado para ser entregue ao Claude ou a outro agente antes
de qualquer mudança. Ele descreve o produto, a arquitetura, as regras de trabalho
e o estado conhecido. Leia também o README e os documentos indicados no fim.

## 1. O que é o Terminalis

Terminalis é uma plataforma educacional em português que simula um laboratório
Linux dentro do navegador. O aluno lê aulas, executa comandos no terminal,
altera uma máquina virtual em memória e resolve atividades verificadas pelo
estado real do simulador.

O produto é uma aplicação web estática. O build concatena JavaScript, CSS e HTML
em um único arquivo: **dist/terminalis.html**. Não existe uma máquina Linux,
Docker daemon, Git remoto ou servidor Node real por trás dos exercícios.

Áreas atualmente implementadas:

- Linux e Bash;
- administração de servidor;
- Docker, Dockerfile e Compose;
- Traefik e serviços simulados;
- Git e GitHub educacionais;
- SQL e rede como capacidades do motor;
- contas locais e autenticação opcional pelo Supabase;
- persistência e sincronização do workspace;
- interface, jornada, progresso, tarefas e projetos finais.

JavaScript e TypeScript estão somente na fase de pesquisa e planejamento.
Não trate essas trilhas como implementadas.

## 2. Restrições centrais do produto

1. A aplicação deve continuar utilizável como site estático.
2. O bundle principal é construído por **build.py** e a ordem alfabética dos
   arquivos de src também define a ordem das dependências.
3. Os módulos compartilham o namespace global **LX**.
4. Código de domínio não deve manipular a interface diretamente.
5. A interface pode consumir os simuladores por meio de LX.
6. Conteúdo prepara cenários e verifica estado; não duplica regras do motor.
7. O arquivo em dist é gerado. Mudança em src exige reconstrução.
8. Não afirmar compatibilidade integral com sistemas reais. Toda simulação deve
   declarar seus limites.
9. Não adicionar dependência sem justificar tamanho, licença, manutenção,
   funcionamento offline e impacto no HTML único.
10. Não colocar segredos, service_role do Supabase ou credenciais reais no
    bundle, documentação, testes ou fixtures.

## 3. Mapa da arquitetura

### Runtime e máquina

- **src/09-runtime.js**: cria LX e utilitários compartilhados.
- **src/10-vfs.js**: filesystem virtual, inodes, permissões, links e mounts.
- **src/11-kernel.js**: máquina, usuários, processos, serviços e rede.
- **src/12-catalog.js**: pacotes e recursos simulados.

### Shell

- **src/20-shell-lex.js**: tokenizer e parser.
- **src/21-shell-exec.js**: shell state, streams e expansões.
- **src/22-shell-run.js**: executor, redirecionamentos e builtins.
- **src/30-coreutils.js a src/34-manpages.js**: comandos e manuais.

### Git, GitHub, Docker e serviços

- **src/35-git-core.js e src/36-git-cli.js**: Git.
- **src/37-github-service.js e src/38-github-cli.js**: colaboração remota local.
- **src/40-docker.js a src/48-compose.js**: Docker, SQL, imagens, YAML,
  Traefik, Dockerfile e Compose.

### Workspace e nuvem

- **src/49-workspace-00-codec.js**: envelope e versionamento do snapshot.
- **src/49-workspace-10-domains.js**: serialização/restauração por domínio.
- **src/74-cloud-10-config.js a src/74-cloud-40-sync.js**: Supabase, storage,
  cache offline, debounce e controle otimista.

### Conteúdo

- **src/50-content-00-core.js**: registro de módulos/aulas e helpers.
- **src/50-content-01-modules.js**: mapa de módulos.
- **src/50-content-02-trilhas.js**: trilhas, etapas e pré-requisitos.
- **src/51-* a src/68-***: Linux e projeto final.
- **src/79-* a src/83-***: Docker e operação integrada.
- **src/84-* a src/86-***: Git/GitHub e projeto final.

### Interface

- **src/70-styles.css**: design e responsividade.
- **src/71-terminal.js**: terminal, sessões, overlays e editor.
- **src/72-app.js**: aplicação e páginas.
- **src/72-file-browser.js**: arquivos e preview.
- **src/72-task-ui.js**: interação com atividades.
- **src/73-render.js**: blocos editoriais.
- **src/74-auth.js**: conta e sessão.
- **src/75-shell.html**: estrutura da página.
- **src/76-progressao.js a src/78-jornada.js**: progresso, autenticação visual
  e jornada.
- **src/87-git-visual.js e src/88-settings.js**: visualizações e preferências.

## 4. Modelo de conteúdo

Cada aula possui três tarefas, nesta ordem:

1. Guiado: executar comandos apresentados e observar.
2. Pergunta: interpretar e responder.
3. Desafio: produzir estado verificável no laboratório.

Verificadores devem preferir estado real a procurar texto no histórico. O
histórico serve quando o ato de executar um comando é o objetivo. Os helpers
ficam em **LX.H**. Consulte **docs/development/PADRAO-TAREFAS.md** antes de criar conteúdo.

Não criar dezenas de aulas antes de provar que o motor suporta os conceitos.
Uma vertical slice executável e testada deve preceder produção editorial em
escala.

## 5. Persistência e segurança

No modo local, conta, progresso e workspace usam armazenamento do navegador.
Quando configurado, Supabase fornece autenticação e sincronização. O schema usa
RLS por auth.uid. O workspace tem codec versionado, cache local e revisão
otimista; conflitos preservam backup em vez de sobrescrever silenciosamente.

HTML das aulas é conteúdo confiável do pacote. Dado produzido pelo aluno deve
usar textContent, escapeHtml ou feedbackHtml conforme o caso.

Código do aluno é dado não confiável. Nunca o execute no mesmo realm que
Terminalis, LX, tokens, localStorage ou cliente Supabase.

## 6. Build e testes

Requisitos: Python 3 e Node.js. Playwright só é necessário para testes de
navegador.

~~~sh
python build.py
npm test
npm run test:browser
~~~

Testes principais:

- **test/smoke.js**: Linux e shell;
- **test/docker.js**: Docker e integrações;
- **test/git.js**: Git;
- **test/estrutura.js**: formato editorial;
- **test/vocabulario.js** e **test/git-vocabulary.js**: pré-requisitos de
  comandos;
- **test/solutions.js**: soluções e força dos verificadores;
- **test/workspace.js** e **test/cloud.js**: persistência/sync;
- **test/interface.js**, **test/ui.js**, **test/auth.js** e **test/aluno.js**:
  navegador.

Para mudanças pequenas, rode primeiro checks focados e depois a suíte completa.
Sempre execute **python build.py** depois de alterar src e confirme que dist foi
atualizado apenas pelo build.

## 7. Convenções de implementação

- Preserve código e alterações não relacionados.
- Pesquise com rg/rg --files.
- Faça mudanças pequenas, com nomes coerentes com os prefixos numéricos.
- Evite acoplamento DOM → domínio e conteúdo → detalhes internos.
- Qualquer estado novo persistente precisa entrar no codec versionado, com
  migração/validação e testes de round-trip.
- Qualquer comando novo precisa de registro, binário quando aplicável, ajuda,
  comportamento de erro e testes.
- Toda saída derivada do usuário deve ser escapada.
- Cenários devem ser determinísticos ou declarar onde há clock/random.
- Não silencie erro para “fazer o teste passar”.
- Não edite dist manualmente.

## 8. Git e escopo

O checkout pode conter trabalho não commitado de outras fases. Antes de editar:

~~~sh
git status --short
git diff -- caminho
~~~

Não use reset --hard, checkout para descartar arquivos ou limpeza recursiva.
Stage apenas os arquivos da tarefa. Commits devem explicar a intenção.

O Git/GitHub dentro do Terminalis é uma simulação local e não deve acessar
credenciais ou repositórios reais.

## 9. Nova fase JavaScript e TypeScript

Foram produzidos três documentos de base:

- **docs/research/pesquisa-javascript.txt**
- **docs/research/pesquisa-typescript.txt**
- **docs/research/proposta-inicial-trilhas-js-ts.txt**

Baseline de pesquisa:

- ECMAScript 2026, ECMA-262 17ª edição;
- Node.js 26.8.2 Current, observando Node 24.21.0 LTS;
- TypeScript 7.0.2;
- TypeScript 6.0.3 apenas como possível compatibilidade programática temporária,
  pois TypeScript 7.0 não oferece API programática estável.

O comando node existente em **src/42-imgbin.js** é um utilitário reduzido para
containers didáticos. Ele usa new Function no contexto da aplicação e injeta
subsets de console, process, fs, os e path. Não é sandbox, não implementa Node
completo e não pode ser promovido a runner geral.

O menor núcleo futuro correto é:

- runner JavaScript isolado e terminável;
- module loader;
- scheduler observável;
- adapters por capability para VFS/rede;
- console e erros estruturados;
- test runner;
- checker/emitter TypeScript.

Consulte o briefing específico antes de tocar nessa área:
**docs/project/BRIEFING-IMPLEMENTACAO-JS-TS-CLAUDE.md**.

## 10. Ordem de leitura para um novo agente

1. **README.md**
2. **docs/architecture/ARQUITETURA.md**
3. este documento;
4. arquivos de pesquisa relacionados à tarefa;
5. módulos de código diretamente envolvidos;
6. testes correspondentes;
7. **docs/development/PADRAO-TAREFAS.md** se houver conteúdo educacional.

Não comece alterando código apenas com base neste resumo. Confira a
implementação atual, alterações locais e testes.

## 11. Definição geral de pronto

Uma mudança está pronta quando:

- atende ao escopo sem alterações incidentais;
- mantém as fronteiras arquiteturais;
- possui testes proporcionais ao risco;
- build é reproduzido;
- documentação e limites da simulação estão corretos;
- segurança e persistência foram revisadas;
- diff foi conferido;
- nenhuma credencial ou dado privado foi introduzido;
- o relatório final informa arquivos, verificações e limitações.

