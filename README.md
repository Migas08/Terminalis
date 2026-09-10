# Terminalis

Plataforma interativa em português para aprender **Linux, Bash, Docker, Git & GitHub e administração de servidores**, com aulas escritas e exercícios no próprio navegador.

A aplicação é distribuída em **um único arquivo HTML** (`dist/terminalis.html`). O motor e a interface usam JavaScript, HTML e CSS, sem bibliotecas externas necessárias para a simulação. Comandos alteram arquivos, permissões, processos e serviços do ambiente virtual em memória. O projeto não executa uma máquina Linux nem containers Docker reais.

## Recursos

- **Linux:** sistema de arquivos com inodes, links e ACLs POSIX; usuários, grupos, processos, sinais, systemd, journald, rede e pacotes simulados.
- **Shell:** parser, expansões, variáveis, pipelines, redirecionamentos, funções, laços, scripts e jobs.
- **Docker:** imagens, containers, volumes, redes, portas publicadas, logs, healthchecks e execução de comandos nos containers simulados.
- **Dockerfile e Compose:** construção de imagens e operação de stacks, com variáveis, dependências, volumes e redes.
- **Serviços:** Traefik, roteamento HTTP e bancos de dados simulados para os exercícios.
- **Git & GitHub:** snapshots, staging, branches, merges e conflitos, remotos locais, PRs com revisão visual, Issues, tags, releases, stash, recuperação e CI educacional.
- **Interface monocromática:** dashboard com progresso e acessos recentes, leitura ajustável, navegação móvel entre aula e terminal e foco de teclado.
- **Interface:** terminal com histórico e autocompletar, editor, explorador de arquivos, anotações, dicas e soluções sob demanda.
- **Progressão:** aulas, etapas, pré-requisitos entre trilhas e registro permanente de desbloqueios.

## Conteúdo atual

Inventário conferido em **10 de setembro de 2026**: **78 módulos, 217 aulas, 651 tarefas e 233 comandos registrados** no motor.

| Trilha | Módulos no código | Situação |
|---|---|---|
| Linux | `m01` a `m16`, mais `m16d` — 17 módulos | Conteúdo implementado |
| Projeto final de Linux | `mpf1` | Implementado; requer Linux |
| Docker | `d01` a `d22` — 22 módulos | Implementado; requer projeto final de Linux |
| Projeto final de Docker | `mpf2` | Implementado; requer Docker |
| Git & GitHub | `g01` a `g34` — 34 capítulos | Implementado; requer Linux |
| Projeto final de Git & GitHub | `gpf` | Implementado; requer Git & GitHub |
| Operação integrada | `m25` e `m26` | Implementado; requer projeto final de Docker |

A jornada segue **Linux → projeto final de Linux → Docker → projeto final de Docker → operação integrada**. Git & GitHub abre após Linux e tem seu próprio projeto final. Os identificadores dos módulos são internos; a numeração exibida é definida no mapa do curso.

Python para automação, Redes, SQL e Kubernetes estão declarados como trilhas planejadas. As ferramentas de rede e SQL já presentes no simulador não significam que essas trilhas futuras estejam disponíveis.

Cada aula possui três tarefas, nesta ordem:

1. **Guiado:** executar comandos apresentados e observar o resultado.
2. **Pergunta:** responder um quiz ou completar uma resposta.
3. **Desafio:** produzir um resultado no ambiente virtual.

Os guiados podem verificar o histórico de comandos; os desafios práticos verificam o estado do ambiente. O padrão editorial e os exemplos de criação de aulas estão em [tools/PADRAO-TAREFAS.md](tools/PADRAO-TAREFAS.md).

## Estrutura

```text
src/
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
  35-git-core.js           repositório Git e snapshots no sistema virtual
  36-git-cli.js            comandos Git educacionais
  37-github.js             repositórios remotos e colaboração simulada
  40-docker.js              motor Docker
  41-sql.js                 bancos de dados simulados
  42-imgbin.js              programas disponíveis nas imagens
  43-docker-hub.js          catálogo de imagens simuladas
  44-yaml.js                interpretação de YAML
  45-traefik.js             proxy e roteamento simulados
  46-docker-cli.js          comandos docker
  47-dockerfile.js          interpretação e construção de Dockerfiles
  48-compose.js             operação de stacks Compose
  50-content-00-core.js     registro de aulas, helpers e cenário inicial
  50-content-01-modules.js  mapa dos módulos
  50-content-02-trilhas.js  trilhas, etapas e pré-requisitos
  51-*.js a 68-*.js         aulas Linux e projeto final de Linux
  70-styles.css            estilos e layout responsivo
  71-terminal.js           terminal, editor e sessões
  72-app.js                navegação, progresso e tarefas
  73-render.js             renderização dos blocos das aulas
  74-auth.js               contas, sessões e armazenamento
  75-shell.html            estrutura HTML e inicialização
  76-progressao.js         etapas, conclusões e desbloqueios
  77-authui.js             interface de autenticação
  78-jornada.js            páginas de cursos, jornada e projetos
  79-docker-helpers.js     cenários e verificações Docker
  80-d01.js a 80-d22.js    aulas Docker
  81-mpf2.js               projeto final de Docker
  82-m25.js e 83-m26.js    operação e projetos integrados
test/                    testes do motor, conteúdo e navegador
tools/                   ferramentas de edição e verificação
build.py                 montagem do HTML único
dist/terminalis.html      aplicação gerada
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

## Contas e persistência

A interface solicita uma conta. O código usa WebCrypto para derivar senhas com PBKDF2-SHA256, salt aleatório e 150 mil iterações. As sessões possuem token aleatório e validade de 30 dias.

Por padrão, contas e progresso são gravados no **localStorage do navegador**, associados à origem da página. Limpar esse armazenamento remove os dados locais. O ZIP não contém um backend próprio de autenticação.

Há uma integração opcional com `claude.use('db')`. Quando essa capacidade está disponível, o armazenamento usa o banco do ambiente hospedeiro. A sincronização entre dispositivos depende dessa integração; servir o HTML em um site comum não ativa sincronização automaticamente.

O progresso e as anotações são persistidos, mas a máquina virtual é reconstruída ao iniciar a aplicação ou trocar de usuário. Os arquivos criados no terminal não são preservados entre essas sessões.

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
| `git.js` | Semântica de snapshots, branches, integração e recuperação |
| `git-vocabulary.js` | Operações e flags ensinadas antes dos exercícios de Git |
| `interface.js` | Dashboard, PR visual, persistência e responsividade |
| `ui.js` | Inicialização e interação com a interface no navegador |
| `auth.js` | Login e progressão entre trilhas no navegador |
| `aluno.js` | Percurso de um aluno pela interface |

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

Em 10 de setembro de 2026, com Node.js 24.19.0 e Edge/Playwright:

- Linux e shell: **163 verificações aprovadas**; Docker: **160**; sem falhas.
- Git: **24 verificações semânticas**, incluindo conflitos, proteção de alterações, reset, stash, clone e autenticação simulada.
- Estrutura: **217 aulas** no padrão de três tarefas.
- Vocabulário: soluções revisadas sem depender das dicas para apresentar comandos; auditoria adicional das operações e flags de Git.
- Soluções: **449 verificações aprovadas, zero falhas, zero aprovações indevidas e zero exceções**; 202 tarefas sem verificador de estado, como quizzes, são contabilizadas separadamente.
- Navegador: inicialização, autenticação e progresso, percurso do aluno, revisão visual de PR, preferências persistidas, menus por teclado e layouts de 320 a 1440 px.

Esses testes cobrem os comportamentos declarados, sem afirmar compatibilidade integral com Linux, Docker ou Git reais.

## Limites do laboratório Git

Nenhuma operação Git/GitHub deste curso acessa a internet ou usa credenciais reais. Os repositórios vivem na memória da aba; progresso e anotações são persistidos separadamente. Fechar a aba reinicia os arquivos de treino.

O simulador cobre os comandos utilizados nas aulas, não toda a implementação de Git. Snapshots são de arquivos de texto; hashes são identificadores educacionais; o diff compara snapshots inteiros; a mesclagem de texto é conservadora. O rebase interativo tem uma prévia conceitual de pick/reword/squash/fixup. O terminal implementa rebase simples com continuação e cancelamento.

A CI local interpreta workflows didáticos e verifica apenas `test -f README.md` e `test -f index.html`. Ela não baixa actions nem executa código externo. O exemplo de workflow pode ser estudado como YAML; o laboratório não substitui a execução do GitHub Actions real.

## Licença

Uso pessoal e educacional.
