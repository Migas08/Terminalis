# Terminalis

Plataforma interativa em português para aprender **Linux, Bash, Docker, Git & GitHub, JavaScript e administração de servidores**, com aulas escritas e exercícios no próprio navegador.

A aplicação é distribuída em **um único arquivo HTML** (`dist/terminalis.html`). O motor e a interface usam JavaScript, HTML e CSS, sem bibliotecas externas necessárias para a simulação. Comandos alteram arquivos, permissões, processos e serviços do ambiente virtual em memória. O projeto não executa uma máquina Linux nem containers Docker reais.

## Recursos

- **Linux:** sistema de arquivos com inodes, links e ACLs POSIX; usuários, grupos, processos, sinais, systemd, journald, rede e pacotes simulados.
- **Shell:** parser, expansões, variáveis, pipelines, redirecionamentos, funções, laços, scripts e jobs.
- **Docker:** imagens, containers, volumes, redes, portas publicadas, logs, healthchecks e execução de comandos nos containers simulados.
- **Dockerfile e Compose:** construção de imagens e operação de stacks, com variáveis, dependências, volumes e redes.
- **Serviços:** Traefik, roteamento HTTP e bancos de dados simulados para os exercícios.
- **Git & GitHub:** snapshots, staging, branches, merges e conflitos, remotos locais, PRs com revisão visual, Issues, tags, releases, stash, recuperação e CI educacional.
- **JavaScript:** runner isolado, editor multi-arquivo e currículo progressivo de fundamentos a browser, Node, backend, segurança e produção.
- **Interface monocromática:** dashboard com progresso e acessos recentes, leitura ajustável, navegação móvel entre aula e terminal e foco de teclado.
- **Interface:** terminal com histórico e autocompletar, editor, explorador de arquivos, anotações, dicas e soluções sob demanda.
- **Progressão:** aulas, etapas, pré-requisitos entre trilhas e registro permanente de desbloqueios.

## Conteúdo atual

Inventário conferido em **17 de setembro de 2026**: **91 módulos, 282 aulas, 846 tarefas e 233 comandos registrados** no motor.

| Trilha | Módulos no código | Situação |
|---|---|---|
| Linux | `m01` a `m16`, mais `m16d` — 17 módulos | Conteúdo implementado |
| Projeto final de Linux | `mpf1` | Implementado; requer Linux |
| Docker | `d01` a `d22` — 22 módulos | Implementado; requer projeto final de Linux |
| Projeto final de Docker | `mpf2` | Implementado; requer Docker |
| Git & GitHub | `g01` a `g34` — 34 capítulos | Implementado; requer Linux |
| Projeto final de Git & GitHub | `gpf` | Implementado; requer Git & GitHub |
| Operação integrada | `m25` e `m26` | Implementado; requer projeto final de Docker |
| JavaScript | `js01` a `js12`, mais `jspf` — 13 módulos e 65 aulas | Implementado; disponível desde o início |
| TypeScript | Pesquisa técnica e currículo proposto | Curso ainda não implementado |

A jornada segue **Linux → projeto final de Linux → Docker → projeto final de Docker → operação integrada**. Git & GitHub abre após Linux e tem seu próprio projeto final. Os identificadores dos módulos são internos; a numeração exibida é definida no mapa do curso.

A trilha JavaScript possui runner isolado, editor multi-arquivo, 65 aulas e projeto final integrado. TypeScript já possui suporte de execução no laboratório, mas sua trilha de conteúdo ainda está em planejamento. Python para automação, Redes, SQL e Kubernetes continuam declarados como trilhas planejadas.

Cada aula possui três tarefas, nesta ordem:

1. **Guiado:** executar comandos apresentados e observar o resultado.
2. **Pergunta:** responder um quiz ou completar uma resposta.
3. **Desafio:** produzir um resultado no ambiente virtual.

Os guiados podem verificar o histórico de comandos; os desafios práticos verificam o estado do ambiente. O padrão editorial e os exemplos de criação de aulas estão em [tools/PADRAO-TAREFAS.md](tools/PADRAO-TAREFAS.md).

## JavaScript e próxima fase TypeScript

A base técnica das duas trilhas foi pesquisada antes da criação de conteúdo:

- [Pesquisa profissional de JavaScript](docs/pesquisa-javascript.txt): linguagem, runtime, browser, Node.js, assíncrono, módulos, segurança, testes, performance e arquitetura.
- [Pesquisa profissional de TypeScript](docs/pesquisa-typescript.txt): type system, inference, narrowing, generics, tipos derivados, compilador, configuração, runtime boundaries e sistemas grandes.
- [Proposta inicial das trilhas](docs/proposta-inicial-trilhas-js-ts.txt): currículo, projetos, dependências, APIs necessárias e análise de GAP do simulador.

JavaScript já conta com a vertical slice segura, módulos, console, testes, integração com o VFS e o [currículo completo](docs/CURRICULO-JAVASCRIPT.md). A próxima etapa de conteúdo é TypeScript, aproveitando o mesmo laboratório e o adaptador de compilação existente. O executor reduzido de `node` usado em imagens Docker não é uma sandbox e não deve ser reutilizado para executar código arbitrário do aluno.

Para transferir contexto a outro agente, consulte [Contexto do projeto para o Claude](docs/CONTEXTO-PROJETO-CLAUDE.md). Para trabalhar exclusivamente nessa nova fase, use o [briefing de implementação JavaScript e TypeScript](docs/BRIEFING-IMPLEMENTACAO-JS-TS-CLAUDE.md).

## Estrutura

Uma descrição dos limites entre as camadas e do fluxo de carregamento está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

```text
src/
  09-runtime.js             namespace LX e utilitários compartilhados
  10-vfs.js                 arquivos virtuais, inodes, links e permissões
  11-kernel.js              máquina, processos, serviços e rede
  12-catalog.js             catálogo de pacotes e recursos simulados
  20-shell-lex.js           tokenizer e parser do shell
  21-shell-exec.js          estado do shell, streams e expansões
  22-shell-run.js           executor, redirecionamentos e builtins
  30-coreutils.js           comandos de arquivos e diretórios
  31-textutils.js           processamento de texto
  32-admin.js               administração do sistema
  33-net.js                 comandos de rede
  34-manpages.js            manuais integrados
  35-git-core.js            repositório Git e snapshots no sistema virtual
  36-git-cli.js             comandos Git educacionais
  37-github-service.js      remotos, colaboração e CI simulada
  38-github-cli.js          interface educacional do comando gh
  39-js-*.js                protocolo, runner, sandbox e adaptador TypeScript
  40-docker.js              motor Docker
  41-sql.js                 bancos de dados simulados
  42-imgbin.js              programas disponíveis nas imagens
  43-docker-hub.js          catálogo de imagens simuladas
  44-yaml.js                interpretação de YAML
  45-traefik.js             proxy e roteamento simulados
  46-docker-cli.js          comandos docker
  47-dockerfile.js          interpretação e construção de Dockerfiles
  48-compose.js             operação de stacks Compose
  49-workspace-00-codec.js  codec versionado de snapshots do laboratório
  49-workspace-10-domains.js serialização e restauração por domínios
  50-content-00-core.js     registro de aulas, helpers e cenário inicial
  50-content-01-modules.js  mapa dos módulos
  50-content-02-trilhas.js  trilhas, etapas e pré-requisitos
  51-*.js a 68-*.js         aulas Linux e projeto final de Linux
  70-styles.css             estilos e layout responsivo
  71-terminal.js            terminal, editor e sessões
  72-app.js                 navegação e páginas principais
  72-task-ui.js             atividades e verificações na interface
  72-file-browser.js        navegador de arquivos virtuais
  73-render.js              renderização dos blocos das aulas
  74-auth.js                contas, sessões e armazenamento
  74-cloud-10-config.js    configuração pública do Supabase
  74-cloud-20-supabase.js  Auth e persistência PostgreSQL via Supabase
  74-cloud-30-storage.js   interface única de armazenamento
  74-cloud-40-sync.js      cache offline, debounce e revisão otimista
  75-shell.html             estrutura HTML e inicialização
  76-progressao.js          etapas, conclusões e desbloqueios
  77-authui.js              interface de autenticação
  78-jornada.js             páginas de cursos, jornada e projetos
  79-docker-helpers.js      cenários e verificações Docker
  80-d01.js a 80-d22.js     aulas Docker
  81-mpf2.js                projeto final de Docker
  82-m25.js e 83-m26.js     operação e projetos integrados
  84-*.js a 86-*.js         curso e projeto final de Git & GitHub
  87-git-visual.js          diagramas de branches, PRs e commits
  88-settings.js            preferências de leitura e terminal
  89-js-course.js           módulos e aulas-base da trilha JavaScript
  89-z-js-course-extended.js expansão para 65 aulas e projeto final
docs/                       arquitetura e pesquisa técnica preservada
  CURRICULO-JAVASCRIPT.md    matriz das 65 aulas e critérios de qualidade
  CONTEXTO-PROJETO-CLAUDE.md contexto geral e regras para handoff
  BRIEFING-IMPLEMENTACAO-JS-TS-CLAUDE.md escopo específico da nova fase
  pesquisa-javascript.txt    base técnica da futura trilha JavaScript
  pesquisa-typescript.txt    base técnica da futura trilha TypeScript
  proposta-inicial-trilhas-js-ts.txt currículo e análise de GAP
test/                       testes do motor, conteúdo e navegador
tools/                      ferramentas de edição e verificação
build.py                    montagem do HTML único
dist/terminalis.html        aplicação gerada
```

Os componentes compartilham o namespace `LX`. O build concatena os arquivos JavaScript em ordem alfabética, insere o CSS e substitui os ícones no HTML. A ordem dos nomes dos arquivos faz parte da organização das dependências.

## Construir e executar

O build requer **Python 3**, usando apenas a biblioteca padrão. Execute na raiz do projeto:

```sh
python build.py
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Em ambientes que usam `python3`, substitua `python` por `python3`. Abra [http://localhost:8000/terminalis.html](http://localhost:8000/terminalis.html). O ZIP também contém um HTML já gerado; reconstrua-o após modificar os fontes.

Servir por localhost oferece uma origem adequada para armazenamento local e WebCrypto, usados pelas contas. Não é necessário instalar Docker para utilizar o simulador.

## Publicar na web

O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) gera o bundle e publica o site automaticamente a cada push na branch `main`.

1. No GitHub, abra **Settings → Pages** e selecione **Source: GitHub Actions**.
2. Aguarde a execução **Publicar Terminalis** terminar em **Actions**.
3. Acesse [https://migas08.github.io/Terminalis/](https://migas08.github.io/Terminalis/).
4. No Supabase, em **Authentication → URL Configuration**, use essa URL em **Site URL** e adicione `https://migas08.github.io/Terminalis/**` em **Redirect URLs**.

O repositório pode continuar privado quando o plano da conta oferecer GitHub Pages para repositórios privados. Em contas gratuitas, o GitHub exige que o repositório seja público para usar Pages; não altere a visibilidade sem avaliar essa decisão.

## Contas e persistência

A interface solicita uma conta. O código usa WebCrypto para derivar senhas com PBKDF2-SHA256, salt aleatório e 150 mil iterações. As sessões possuem token aleatório e validade de 30 dias.

Por padrão, contas e progresso são gravados no **localStorage do navegador**, associados à origem da página. Limpar esse armazenamento remove os dados locais. O modo local continua disponível para estudar offline.

Para sincronizar a mesma conta entre computadores, configure um projeto Supabase e execute [docs/SUPABASE_SCHEMA.sql](docs/SUPABASE_SCHEMA.sql) no SQL Editor. Copie [config.example.js](config.example.js) para `config.local.js`, preencha a URL do projeto e a chave pública `anon`, e inclua esse script antes do bundle:

```html
<script>
  window.TERMINALIS_CONFIG = {
    supabase: {
      url: 'https://seu-projeto.supabase.co',
      anonKey: 'sua-chave-anon-publica'
    }
  };
</script>
```

Nunca coloque a chave `service_role` no HTML. As tabelas `profiles`, `user_progress` e `workspaces` usam RLS e só aceitam linhas pertencentes a `auth.uid()`. O login, confirmação de e-mail e recuperação de senha são feitos pelo Supabase Auth.

O workspace inteiro do laboratório (arquivos, shell, processos, serviços, Git, Docker, remotos e histórico necessário) é exportado por um codec versionado e salvo com cache offline. Alterações aguardam um debounce curto e usam revisão otimista; se outro dispositivo gravar antes, o estado local é preservado em um backup e a gravação não sobrescreve o remoto silenciosamente. O indicador da barra mostra `salvando`, `salvo`, `offline` ou erro.

O modo `claude.use('db')` continua como fallback de armazenamento para ambientes que já oferecem essa capacidade, sem alterar a API usada pela aplicação.

## Testes

Os testes do motor e do conteúdo usam **Node.js** e não precisam de Playwright:

```sh
node test/smoke.js
node test/docker.js
node test/estrutura.js
node test/vocabulario.js
node test/solutions.js
```

| Teste | O que verifica |
|---|---|
| `smoke.js` | Comportamentos do motor Linux e shell |
| `docker.js` | Motor Docker e integrações simuladas |
| `estrutura.js` | Três tarefas por aula e sua ordem |
| `vocabulario.js` | Comandos das soluções apresentados no conteúdo acumulado |
| `solutions.js` | Soluções executadas no simulador e discriminação dos verificadores |
| `javascript-curriculum.js` | 65 aulas, 195 atividades, IDs estáveis, cobertura e correções técnicas |
| `git.js` | Semântica de snapshots, branches, integração e recuperação |
| `git-vocabulary.js` | Operações e flags ensinadas antes dos exercícios de Git |
| `interface.js` | Dashboard, PR visual, persistência e responsividade |
| `ui.js` | Inicialização e interação com a interface no navegador |
| `auth.js` | Login e progressão entre trilhas no navegador |
| `aluno.js` | Percurso de um aluno pela interface |
| `workspace.js` | Codec e restauração do estado completo do laboratório |
| `cloud.js` | Cache offline, migração e bloqueio otimista entre dispositivos |

Para conferir uma aula isoladamente:

```sh
node --check src/51-mod01.js
node tools/checar-aula.js l1-1
```

Os testes de navegador usam a dependência Playwright declarada no projeto:

```sh
npm ci
npx playwright install chromium
```

Os testes usam Edge instalado no Windows e Chromium gerenciado pelo Playwright nos demais sistemas. Para outro navegador, defina `TERMINALIS_BROWSER` com o caminho do executável. Depois de gerar o HTML atualizado:

```sh
npm test
npm run test:browser
```

`npm test` verifica a sintaxe de todos os arquivos JavaScript antes das suítes do motor e conteúdo. Não há TypeScript nem linter configurado.

### Última verificação local

Em 17 de setembro de 2026, com Node.js 24.19.0 e Edge/Playwright:

- Linux e shell: **163 verificações aprovadas**; Docker: **160**; sem falhas.
- Git: **24 verificações semânticas**, incluindo conflitos, proteção de alterações, reset, stash, clone e autenticação simulada.
- Estrutura: **282 aulas** no padrão de três tarefas.
- Vocabulário: soluções revisadas sem depender das dicas para apresentar comandos; auditoria adicional das operações e flags de Git.
- Currículo JavaScript: **13 módulos, 65 aulas e 195 atividades**, com IDs anteriores preservados e cobertura temática validada.
- Soluções: **514 verificações aprovadas, zero falhas, zero aprovações indevidas e zero exceções**; 332 tarefas sem verificador de estado, como quizzes, são contabilizadas separadamente.
- Navegador JavaScript: 65 aulas carregadas, módulos visíveis e execução no playground isolado.
- Dependências: nenhuma dependência de execução; Playwright e seus dois pacotes transitivos são usados apenas nos testes. A consulta ao banco OSV não encontrou vulnerabilidades conhecidas nessas versões.

Esses testes cobrem os comportamentos declarados, sem afirmar compatibilidade integral com Linux, Docker ou Git reais.

## Limites do laboratório Git

Nenhuma operação Git/GitHub deste curso acessa a internet ou usa credenciais reais. Os repositórios vivem na memória da aba; progresso e anotações são persistidos separadamente. Fechar a aba reinicia os arquivos de treino.

O simulador cobre os comandos utilizados nas aulas, não toda a implementação de Git. Snapshots são de arquivos de texto; hashes são identificadores educacionais; o diff compara snapshots inteiros; a mesclagem de texto é conservadora. O rebase interativo tem uma prévia conceitual de pick/reword/squash/fixup. O terminal implementa rebase simples com continuação e cancelamento.

A CI local interpreta workflows didáticos e verifica apenas `test -f README.md` e `test -f index.html`. Ela não baixa actions nem executa código externo. O exemplo de workflow pode ser estudado como YAML; o laboratório não substitui a execução do GitHub Actions real.

## Licença

Uso pessoal e educacional.

