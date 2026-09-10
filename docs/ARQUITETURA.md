# Arquitetura do Terminalis

O Terminalis é uma aplicação web estática. Não existe um servidor de aplicação neste repositório: Linux, Bash, Docker, Git e GitHub são simulados em JavaScript dentro do navegador. O build reúne os fontes em `dist/terminalis.html`, que pode ser servido por qualquer servidor HTTP estático.

## Fluxo de execução

1. `75-shell.html` fornece a estrutura da página e inicia autenticação e aplicação.
2. `09-runtime.js` cria o namespace `LX` e os utilitários compartilhados.
3. Os módulos `10-*` a `48-*` implementam a máquina, o shell e os simuladores.
4. Os módulos `50-*` a `68-*` registram o curso de Linux; `79-*` a `83-*`, Docker e operação; `84-*` a `86-*`, Git e GitHub.
5. `70-styles.css` mantém todo o sistema visual.
6. `71-*` a `78-*` e `87-*` a `88-*` implementam interface, autenticação, progresso e diagramas.

`build.py` ordena os arquivos JavaScript pelo nome. Por isso, o prefixo numérico também declara a dependência de carregamento. Módulos novos devem entrar depois das APIs que consomem e antes da inicialização em `75-shell.html` quando forem necessários no primeiro carregamento.

## Limites dos módulos

| Área | Arquivos principais | Responsabilidade |
|---|---|---|
| Runtime | `09-runtime.js` | Namespace e operações comuns de DOM, escape, cópia e igualdade |
| Máquina Linux | `10-vfs.js` a `34-manpages.js` | Sistema de arquivos, kernel, shell, comandos e manuais |
| Git | `35-git-core.js`, `36-git-cli.js` | Estado do repositório e interface de comandos |
| GitHub | `37-github-service.js`, `38-github-cli.js` | Remotos, colaboração, CI didática e comando `gh` |
| Docker | `40-docker.js` a `48-compose.js` | Motor, imagens, YAML, Dockerfile, Compose e CLI |
| Conteúdo | `50-*` a `68-*`, `80-*` a `86-*` | Catálogo editorial, cenários e verificadores das aulas |
| Interface | `71-terminal.js`, `72-app.js`, `72-task-ui.js`, `72-file-browser.js`, `73-render.js` | Terminal, navegação, atividades, arquivos e blocos das aulas |
| Conta e jornada | `74-auth.js`, `76-progressao.js` a `78-jornada.js` | Persistência por usuário, pré-requisitos e páginas de curso |
| Apresentação | `70-styles.css`, `75-shell.html`, `87-git-visual.js`, `88-settings.js` | Layout, shell da página, diagramas e preferências |

O código de domínio não deve acessar elementos da página. A camada de interface pode consultar os simuladores por meio do namespace `LX`. Conteúdo pode preparar cenários e verificar estado, mas não deve duplicar regras do motor.

## Dados e segurança

No modo padrão, contas, hashes de senha, sessões, progresso e anotações ficam no `localStorage` da origem. A integração opcional `claude.use('db')` troca apenas o armazenamento e não transforma este projeto em um backend independente.

Senhas são derivadas com PBKDF2-SHA256, salt aleatório por conta e o número de iterações gravado junto ao hash. O token de sessão bruto fica no navegador; a conta guarda seu SHA-256. A máquina virtual e seus arquivos vivem apenas na memória da aba.

HTML escrito pelos autores das aulas é renderizado como conteúdo confiável do pacote. Mensagens produzidas a partir do estado do aluno passam por `LX.feedbackHtml`, que escapa texto e libera somente a marcação didática prevista. Dados de formulário e nomes apresentados pela interface devem passar por `LX.Util.escapeHtml` ou por `textContent`.

## Verificação

`npm test` verifica a sintaxe de todos os módulos e executa testes de Linux, Docker, Git, estrutura editorial, vocabulário e soluções. `npm run test:browser` cobre autenticação, isolamento de progresso, navegação, responsividade, atividades, mensagens e fluxos visuais de GitHub.

O arquivo em `dist/` é gerado. Toda mudança em `src/` deve ser seguida por `python build.py` antes do commit.
