# Terminalis — Contexto do Projeto para IA

> Este arquivo existe para fornecer contexto suficiente a uma IA antes de qualquer alteração no projeto.
> Leia este documento inteiro antes de editar código.

---

# 1. Visão geral

**Terminalis** é uma plataforma interativa em português para aprender tecnologia na prática.

O projeto ensina principalmente:

- Linux
- Bash / Shell
- Docker
- Docker Compose
- Git
- GitHub
- administração de servidores
- conceitos de rede
- serviços simulados
- operação integrada

A proposta principal é:

- aulas 100% escritas;
- exercícios práticos no navegador;
- terminal integrado;
- ambiente Linux simulado;
- Docker simulado;
- Git e GitHub simulados;
- progressão por módulos;
- desafios verificáveis;
- funcionamento sem exigir uma máquina Linux real;
- funcionamento sem Docker real;
- distribuição em um único arquivo HTML.

O Terminalis é um projeto educacional, não um emulador perfeito de Linux, Docker ou Git.

---

# 2. Filosofia do projeto

O projeto deve continuar sendo:

- simples de executar;
- sem framework frontend pesado;
- fácil de distribuir;
- didático;
- modular;
- legível;
- testável;
- compatível com navegador;
- visualmente monocromático;
- focado em aprendizado real.

Não transformar o projeto em:

- React;
- Next.js;
- Vue;
- Angular;
- aplicação Node com servidor obrigatório;
- SPA dependente de bundler complexo;
- arquitetura excessivamente abstrata.

A aplicação final deve continuar podendo ser gerada como:

```text
dist/terminalis.html
```

---

# 3. Tecnologias

Principais tecnologias:

```text
JavaScript
HTML
CSS
Python
Node.js apenas para testes/ferramentas
Playwright para testes de navegador
```

Não existe TypeScript.

Não existe framework frontend.

Não existe backend obrigatório no funcionamento atual.

---

# 4. Build

O build principal é feito por:

```bash
python build.py
```

O resultado é:

```text
dist/terminalis.html
```

O `build.py`:

1. lê os arquivos em `src/`;
2. concatena JavaScript;
3. injeta CSS;
4. injeta HTML;
5. substitui ícones;
6. gera o HTML final.

O projeto depende atualmente da ordem lexical/numerada dos arquivos.

Exemplo:

```text
09-runtime.js
10-vfs.js
11-kernel.js
20-shell-lex.js
...
70-styles.css
71-terminal.js
72-app.js
...
```

Os prefixos numéricos ajudam a definir dependências.

Não alterar essa ordem sem compreender o impacto.

---

# 5. Estrutura principal

Estrutura aproximada:

```text
Terminalis/
├── README.md
├── build.py
├── package.json
├── package-lock.json
├── dist/
│   └── terminalis.html
├── docs/
│   ├── README.md
│   ├── architecture/
│   ├── curriculum/
│   ├── development/
│   ├── project/
│   └── research/
├── database/
│   └── supabase/
├── src/
├── test/
└── tools/
```

---

# 6. Arquitetura do src

## Runtime

```text
src/09-runtime.js
```

Responsável por:

- namespace global `LX`;
- utilitários compartilhados;
- helpers comuns.

Grande parte do projeto expõe funcionalidades por meio de:

```javascript
LX.*
```

---

# 7. Sistema de arquivos virtual

```text
src/10-vfs.js
```

Implementa o sistema de arquivos virtual.

O Terminalis possui conceitos como:

- arquivos;
- diretórios;
- inodes;
- permissões;
- links;
- ownership;
- metadados.

Os arquivos usados pelo aluno existem dentro desse VFS.

Exemplo conceitual:

```text
/home/aluno/
/etc/
/var/
/tmp/
```

Não são arquivos reais do sistema operacional do usuário.

---

# 8. Kernel / máquina virtual

```text
src/11-kernel.js
```

Representa a máquina Linux simulada.

Responsabilidades incluem partes de:

- processos;
- usuários;
- serviços;
- rede;
- sistema;
- estado da máquina.

---

# 9. Catálogo

```text
src/12-catalog.js
```

Contém recursos e catálogos utilizados pela simulação.

---

# 10. Shell

Arquivos principais:

```text
src/20-shell-lex.js
src/21-shell-exec.js
src/22-shell-run.js
```

Responsabilidades:

```text
20-shell-lex.js
    tokenizer
    parser

21-shell-exec.js
    estado do shell
    streams
    expansões

22-shell-run.js
    execução
    redirecionamentos
    builtins
```

O shell deve permanecer suficientemente compatível com o conteúdo ensinado nas aulas.

Não implementar mudanças que façam comandos já ensinados deixarem de funcionar.

---

# 11. Comandos Linux

Principais arquivos:

```text
src/30-coreutils.js
src/31-textutils.js
src/32-admin.js
src/33-net.js
src/34-manpages.js
```

## 30-coreutils.js

Comandos relacionados a arquivos, diretórios e manipulação básica.

## 31-textutils.js

Ferramentas de processamento de texto.

## 32-admin.js

Arquivo grande contendo administração Linux, incluindo áreas como:

- chmod;
- chown;
- usuários;
- grupos;
- processos;
- systemd;
- pacotes;
- administração do sistema.

Se for refatorado, dividir por domínio é preferível a simplesmente compactar código.

## 33-net.js

Comandos de rede.

## 34-manpages.js

Documentação/manuais integrados.

---

# 12. Git

Arquivos:

```text
src/35-git-core.js
src/36-git-cli.js
```

## 35-git-core.js

Responsável pelo modelo do repositório Git simulado:

- commits;
- snapshots;
- branches;
- HEAD;
- staging;
- histórico;
- merge;
- conflitos;
- reset;
- stash;
- reflog;
- operações internas.

## 36-git-cli.js

Implementa a interface educacional dos comandos Git.

O objetivo não é reimplementar Git inteiro. O simulador deve cobrir corretamente os comandos utilizados nas aulas.

---

# 13. GitHub simulado

Arquivos:

```text
src/37-github-service.js
src/38-github-cli.js
src/87-git-visual.js
```

## 37-github-service.js

Responsável pelo serviço GitHub simulado:

- repositórios remotos;
- Pull Requests;
- Issues;
- releases;
- colaboração;
- CI educacional;
- autenticação fictícia do laboratório.

## 38-github-cli.js

Implementa comandos educacionais `gh`.

## 87-git-visual.js

Responsável por elementos visuais do curso Git/GitHub:

- diagramas;
- branches;
- merges;
- rebase;
- PRs;
- Issues;
- releases;
- CI;
- painel visual do GitHub simulado.

Não misturar novamente regras do domínio Git com renderização visual.

---

# 14. Docker

Arquivos principais:

```text
src/40-docker.js
src/42-imgbin.js
src/43-docker-hub.js
src/44-yaml.js
src/45-traefik.js
src/46-docker-cli.js
src/47-dockerfile.js
src/48-compose.js
src/79-docker-helpers.js
```

## 40-docker.js

Motor principal Docker simulado.

## 42-imgbin.js

Programas disponíveis dentro de imagens simuladas.

## 43-docker-hub.js

Catálogo/registry educacional de imagens.

## 44-yaml.js

Parser/interpretação de YAML utilizado pelo projeto.

## 45-traefik.js

Simulação relacionada a proxy, roteamento e Traefik.

## 46-docker-cli.js

Implementa comandos Docker.

## 47-dockerfile.js

Interpretação de Dockerfile.

## 48-compose.js

Implementação de Docker Compose simulado.

## 79-docker-helpers.js

Helpers de cenários, aulas e verificadores relacionados ao Docker.

---

# 15. SQL

```text
src/41-sql.js
```

Há suporte de banco SQL no simulador.

Isso não significa necessariamente que uma trilha SQL completa já esteja liberada na interface.

---

# 16. Conteúdo educacional

O conteúdo é registrado por JavaScript.

Principais blocos:

```text
src/50-content-00-core.js
src/50-content-01-modules.js
src/50-content-02-trilhas.js
```

Linux:

```text
src/51-mod01.js
src/52-mod02.js
...
src/68-mod16d.js
```

Docker:

```text
src/80-d01.js
...
src/80-d22.js
```

Projeto final Docker:

```text
src/81-mpf2.js
```

Operação integrada:

```text
src/82-m25.js
src/83-m26.js
```

Git/GitHub:

```text
src/84-git-course.js
src/85-git-lessons.js
src/86-git-final.js
```

---

# 17. Estrutura pedagógica das aulas

Cada aula normalmente possui três tarefas:

1. Guiado
2. Pergunta
3. Desafio

Ordem esperada:

```text
guiado
quiz/pergunta
desafio
```

O projeto possui testes para garantir essa estrutura.

Não alterar o formato das aulas sem atualizar conscientemente renderização, progresso, verificadores, testes e ferramentas editoriais.

---

# 18. Git/GitHub — curso

A trilha Git/GitHub possui cerca de 34 capítulos.

Assuntos incluem:

- controle de versão;
- configuração;
- init;
- staging;
- commit;
- diff;
- .gitignore;
- branches;
- merge;
- conflitos;
- Git vs GitHub;
- repositórios;
- remote;
- push;
- clone;
- fetch;
- pull;
- autenticação;
- fluxo com branches;
- Pull Requests;
- Issues;
- README;
- tags;
- releases;
- HEAD;
- restore;
- amend;
- reset;
- revert;
- rebase;
- rebase interativo;
- cherry-pick;
- stash;
- reflog;
- forks;
- GitHub Actions;
- boas práticas profissionais.

Uma atividade não deve exigir conhecimento ainda não apresentado anteriormente.

---

# 19. Interface

Arquivos principais:

```text
src/70-styles.css
src/71-terminal.js
src/72-app.js
src/72-task-ui.js
src/72-file-browser.js
src/73-render.js
src/75-shell.html
src/77-authui.js
src/78-jornada.js
src/88-settings.js
```

---

# 20. Visual

O Terminalis possui identidade:

```text
dark
monocromática
preto
branco
cinza
```

Evitar:

- verde como cor principal;
- azul chamativo;
- gradientes coloridos;
- estética gamer;
- excesso de glow;
- cores saturadas.

A interface deve continuar sóbria, técnica, moderna, legível e minimalista.

---

# 21. CSS

Arquivo principal:

```text
src/70-styles.css
```

Apesar de existirem nomes históricos como `--green`, `--blue` e `--red`, os valores foram convertidos para tons monocromáticos.

Não reintroduzir paleta colorida sem solicitação explícita.

---

# 22. Terminal

```text
src/71-terminal.js
```

Responsável pela experiência do terminal:

- entrada;
- histórico;
- execução;
- sessões;
- editor;
- interação.

---

# 23. App

```text
src/72-app.js
```

Responsável por partes centrais da aplicação e navegação.

Recentemente algumas responsabilidades foram retiradas dele.

Não voltar a concentrar tudo dentro de `72-app.js`.

---

# 24. UI de tarefas

```text
src/72-task-ui.js
```

Responsável pela interface das atividades.

Foi separado do app principal para melhorar arquitetura.

Manter essa separação.

---

# 25. File browser

```text
src/72-file-browser.js
```

Navegador visual dos arquivos virtuais.

Foi separado recentemente do app principal.

---

# 26. Renderização de aula

```text
src/73-render.js
```

Renderiza os blocos de conteúdo das aulas.

---

# 27. Autenticação atual

```text
src/74-auth.js
src/77-authui.js
```

O sistema atual possui autenticação local.

Dados são normalmente armazenados no navegador.

O projeto usa WebCrypto para derivação de senha.

O README atual descreve:

```text
PBKDF2-SHA256
salt aleatório
150 mil iterações
```

Sessões também são locais.

---

# 28. Persistência atual

Hoje grande parte da persistência usa:

```text
localStorage
```

Isso significa que:

```text
PC A != PC B
```

O mesmo usuário em dois navegadores diferentes não compartilha automaticamente progresso.

Há uma integração opcional com:

```javascript
claude.use('db')
```

Essa integração não deve ser considerada backend universal do projeto.

---

# 29. Sincronização em nuvem — direção desejada

Existe interesse em permitir:

```text
PC da escola
↓
login
↓
estuda
↓
cria arquivos
↓
fecha

PC de casa
↓
login
↓
recupera progresso
↓
recupera arquivos
↓
continua de onde parou
```

A direção arquitetural desejada é utilizar Supabase.

Principalmente:

- Supabase Auth;
- PostgreSQL;
- RLS;
- sincronização de progresso;
- sincronização de workspace;
- funcionamento offline via cache local.

---

# 30. Workspace em nuvem

O objetivo futuro é persistir não apenas progresso, mas o ambiente virtual.

Exemplo:

```text
/home/aluno/projeto/index.html
/home/aluno/scripts/deploy.sh
```

Esses arquivos devem poder reaparecer em outro computador após login.

Também é desejável persistir:

- VFS;
- diretório atual;
- staging do Git;
- commits locais;
- branches;
- alterações não commitadas;
- estado relevante do Docker simulado;
- notas;
- configurações;
- progresso.

Não exigir `git commit` para que arquivos do laboratório sejam salvos.

---

# 31. Arquitetura recomendada para sincronização

A direção desejada é manter camadas separadas:

```text
Auth
Storage
Workspace
Sync
UI
```

Providers possíveis:

```text
LocalStorageProvider
SupabaseProvider
```

O `localStorage` não deve ser removido.

Ele deve funcionar como cache, fallback, offline e armazenamento temporário.

---

# 32. Snapshot do workspace

Não fazer:

```javascript
JSON.stringify(machine)
```

A máquina possui métodos, referências, estruturas internas, comportamento e objetos que não deveriam ser persistidos diretamente.

Preferir APIs explícitas:

```javascript
LX.Workspace.exportState()
LX.Workspace.importState()
```

E, se necessário:

```javascript
VFS.exportState()
Git.exportState()
Docker.exportState()
Shell.exportState()
```

O snapshot deve conter apenas dados.

---

# 33. Formato de snapshot

Formato conceitual recomendado:

```json
{
  "version": 1,
  "updatedAt": "...",
  "filesystem": {},
  "git": {},
  "docker": {},
  "shell": {},
  "environment": {}
}
```

O snapshot deve ser versionado para permitir migrações futuras.

---

# 34. Sincronização automática

A ideia desejada:

```text
alteração
↓
workspace dirty
↓
debounce
↓
salva local
↓
sincroniza nuvem
```

Não enviar requisição a cada tecla.

Exemplos de alterações relevantes:

- criar arquivo;
- editar;
- remover;
- mkdir;
- chmod;
- git add;
- commit;
- branch;
- merge;
- stash;
- reset;
- mudanças persistíveis de Docker.

---

# 35. Offline

O Terminalis deve continuar funcionando sem internet.

Fluxo desejado:

```text
offline
↓
salva local
↓
marca como pendente
↓
internet retorna
↓
sincroniza
```

Não perder trabalho por queda de conexão.

---

# 36. Conflitos entre dispositivos

Considerar:

```text
PC A aberto
PC B aberto
mesma conta
```

Evitar sobrescrita silenciosa.

Possíveis mecanismos:

```text
revision
updated_at
optimistic locking
```

---

# 37. Segurança futura com Supabase

Se Supabase for implementado:

- usar Supabase Auth;
- senha não deve ser armazenada manualmente;
- usar Row Level Security;
- cada usuário deve acessar apenas os próprios dados;
- nunca colocar `service_role` no frontend;
- nunca colocar segredos administrativos no HTML;
- usar apenas chaves públicas apropriadas ao cliente;
- não confiar apenas no `user_id` recebido do frontend.

Política conceitual:

```text
user_id = auth.uid()
```

---

# 38. Progresso

Arquivo importante:

```text
src/76-progressao.js
```

Responsável por:

- progresso;
- desbloqueios;
- pré-requisitos;
- conclusão.

Não alterar regras pedagógicas sem necessidade.

---

# 39. Jornada

```text
src/78-jornada.js
```

Responsável por páginas relacionadas a cursos, jornada, projetos e progressão visual.

---

# 40. Settings

```text
src/88-settings.js
```

Preferências do usuário.

---

# 41. Testes

Diretório:

```text
test/
```

Testes existentes incluem aproximadamente:

```text
test/aluno.js
test/auth.js
test/docker.js
test/estrutura.js
test/feedback.js
test/git.js
test/git-vocabulary.js
test/interface.js
test/smoke.js
test/solutions.js
test/ui.js
test/vocabulario.js
```

---

# 42. npm test

Comando:

```bash
npm test
```

O runner `test/run.js` faz:

1. `node --check` em todos os arquivos JS do `src`;
2. executa testes principais.

Suítes principais:

```text
smoke
docker
git
estrutura
vocabulario
git-vocabulary
solutions
```

Não alterar testes apenas para mascarar regressões.

---

# 43. Testes de navegador

Comando:

```bash
npm run test:browser
```

Utiliza Playwright.

Pode exigir:

```bash
npm ci
npx playwright install chromium
```

---

# 44. Build após alteração

Toda alteração relevante em `src/` deve terminar com:

```bash
python build.py
```

Depois verificar que:

```text
dist/terminalis.html
```

foi regenerado corretamente.

---

# 45. Comandos de validação recomendados

Antes de considerar uma tarefa concluída:

```bash
npm test
npm run test:browser
python build.py
```

Se alguma suíte não puder ser executada por dependência de ambiente, documentar claramente.

---

# 46. README

O `README.md` é importante e atualmente documenta recursos, estrutura, trilhas, build, autenticação, persistência, testes e limitações.

Atualizar o README quando mudanças arquiteturais relevantes forem feitas.

---

# 47. docs/architecture/ARQUITETURA.md

Arquivo obrigatório de referência:

```text
docs/architecture/ARQUITETURA.md
```

Ele define limites entre runtime, máquina, shell, Git, GitHub, Docker, conteúdo, interface, autenticação e progressão.

Sempre consultar antes de grandes refatorações.

---

# 48. Ferramentas editoriais

Diretório:

```text
tools/
```

Inclui ferramentas como:

```text
checar-aula.js
copia.py
shot.js
tarefas.py
```

O padrão das atividades está documentado em:

```text
docs/development/PADRAO-TAREFAS.md
```

Consultar ao criar ou alterar conteúdo educacional.

---

# 49. Tamanho e organização

O projeto possui muitos arquivos e bastante conteúdo.

Arquivos grandes não significam necessariamente código ruim.

Exemplo:

```text
85-git-lessons.js
```

é grande principalmente porque contém conteúdo pedagógico.

Não reduzir tamanho sacrificando legibilidade.

---

# 50. Refatoração

Priorizar refatorações que:

- reduzam acoplamento;
- separem responsabilidades;
- removam duplicação real;
- facilitem testes;
- mantenham comportamento.

Evitar:

- minificação manual;
- funções gigantes só para reduzir arquivos;
- abstrações genéricas sem necessidade;
- renomear tudo sem motivo;
- refatoração cosmética em massa.

---

# 51. Arquivos grandes que podem merecer atenção

Alguns arquivos historicamente grandes:

```text
src/32-admin.js
src/70-styles.css
src/85-git-lessons.js
src/46-docker-cli.js
```

Se precisar dividir:

- preservar APIs;
- preservar ordem de carregamento;
- atualizar build;
- atualizar testes;
- não alterar comportamento.

---

# 52. Regra importante de domínio vs UI

Código de domínio não deve depender de DOM.

Exemplo:

```text
Git core
Docker core
VFS
Shell
```

não devem acessar diretamente elementos HTML.

A camada de interface pode consumir APIs do namespace `LX`.

Conteúdo pode preparar cenário e verificar estado, mas não deve duplicar regras do motor.

---

# 53. Segurança de HTML

Conteúdo escrito pelos autores pode ser tratado como conteúdo confiável do pacote.

Dados produzidos pelo aluno devem ser escapados antes de entrar em HTML.

Utilizar helpers existentes, como:

```javascript
LX.Util.escapeHtml
```

ou `textContent`.

Não inserir dados do usuário diretamente via `innerHTML`.

---

# 54. Git simulado — limitações

O Git do Terminalis é educacional.

Não assumir compatibilidade integral com Git real.

Exemplos de simplificações possíveis:

- hashes educacionais;
- snapshots de texto;
- merge conservador;
- rebase educacional;
- CI simplificada.

As aulas devem ensinar conceitos corretos, mesmo que a implementação seja simulada.

---

# 55. GitHub Actions simulado

A CI do laboratório não executa código externo real.

É uma simulação didática.

Não permitir que conteúdos das aulas façam o navegador executar scripts arbitrários reais.

---

# 56. Estado atual aproximado do conteúdo

O projeto possui, aproximadamente:

```text
78 módulos
217 aulas
651 tarefas
233 comandos registrados
```

Esses números podem mudar conforme o projeto evolui.

Não hardcodar esses valores em lógica de aplicação.

---

# 57. Trilhas

Estrutura atual inclui:

```text
Linux
Projeto final Linux
Docker
Projeto final Docker
Git & GitHub
Projeto final Git & GitHub
Operação integrada
```

Outras trilhas podem estar planejadas.

---

# 58. Dependências entre trilhas

Fluxo conceitual:

```text
Linux
↓
Projeto final Linux
↓
Docker
↓
Projeto final Docker
↓
Operação integrada
```

Git/GitHub é liberado após Linux e possui seu próprio projeto final.

Não quebrar requisitos e desbloqueios.

---

# 59. Convenção de usuário nos laboratórios

Muitos cenários usam:

```text
usuário: aluno
home: /home/aluno
uid: 1000
gid: 1000
```

Não alterar isso globalmente sem revisar aulas e testes.

---

# 60. Comportamento esperado de uma IA ao trabalhar neste projeto

Antes de alterar código:

1. ler `README.md`;
2. ler `docs/architecture/ARQUITETURA.md`;
3. localizar arquivos envolvidos;
4. entender dependências;
5. verificar testes existentes;
6. fazer alteração mínima necessária.

Depois:

1. revisar diff;
2. rodar testes;
3. corrigir regressões;
4. rodar build;
5. atualizar documentação se necessário.

---

# 61. Não fazer

Não:

- reescrever o projeto inteiro;
- migrar para framework sem solicitação;
- remover localStorage sem motivo;
- remover testes;
- esconder falhas alterando testes;
- colocar segredos em código;
- misturar domínio com interface;
- quebrar funcionamento offline;
- alterar design monocromático;
- executar refatoração gigantesca sem necessidade;
- modificar conteúdo educacional sem verificar pré-requisitos;
- assumir que Git/Docker reais estão sendo executados.

---

# 62. Ao receber uma tarefa

A IA deve responder internamente a estas perguntas:

```text
Qual domínio será alterado?
Existe teste para isso?
Existe API pronta?
Qual arquivo é responsável?
Essa mudança afeta build?
Afeta conteúdo?
Afeta progresso?
Afeta persistência?
Afeta compatibilidade das aulas?
```

---

# 63. Ao criar uma nova funcionalidade

Preferir:

```text
API pequena
↓
teste
↓
integração
↓
UI
```

Evitar começar pela interface antes de modelar o comportamento.

---

# 64. Commits

Ao finalizar uma tarefa, se solicitado:

```bash
git status
git diff
npm test
npm run test:browser
python build.py
git add ...
git commit -m "Mensagem clara em português"
```

Não usar `git add .` cegamente se houver arquivos sensíveis ou temporários.

Sempre revisar `git status`.

---

# 65. Arquivos sensíveis

Nunca commitar:

```text
.env
tokens
service_role
senhas
credenciais
chaves privadas
arquivos temporários
```

O `.gitignore` atual inclui itens como:

```text
node_modules/
*.log
.DS_Store
__pycache__/
*.pyc
work/
```

---

# 66. Objetivo de qualidade

O Terminalis deve parecer:

```text
uma plataforma educacional séria
+
um laboratório técnico interativo
+
um ambiente seguro de prática
```

Não deve parecer apenas uma coleção de textos nem um terminal fake sem lógica.

---

# 67. Prioridades

Ao escolher entre alternativas, priorizar:

1. correção;
2. preservação de dados;
3. clareza;
4. experiência do aluno;
5. testabilidade;
6. manutenção;
7. performance;
8. redução de código.

Não reduzir linhas de código sacrificando os itens anteriores.

---

# 68. Resumo rápido para IA

Terminalis é uma aplicação web estática e educacional que simula Linux, Shell, Docker, Git e GitHub inteiramente no navegador.

Ela é construída a partir de arquivos JavaScript numerados em `src/`, CSS e HTML, gerando um único:

```text
dist/terminalis.html
```

O namespace central é:

```javascript
LX
```

As principais camadas são:

```text
Runtime
VFS
Kernel
Shell
Linux commands
Git
GitHub
Docker
Conteúdo
UI
Auth
Progressão
```

O projeto possui uma grande suíte de testes.

O design deve continuar monocromático.

Não introduzir frameworks pesados.

Não quebrar aulas existentes.

Não misturar domínio e DOM.

Não armazenar segredos no frontend.

Para persistência multi-dispositivo, a direção desejada é:

```text
Supabase Auth
+
Storage abstrato
+
snapshot versionado do workspace
+
localStorage como cache/offline
+
sincronização segura
```

---

# 69. Instrução final para qualquer IA

Antes de editar o Terminalis:

> Leia este arquivo, o README, a arquitetura e os arquivos diretamente envolvidos.
> Não assuma que uma refatoração ampla é necessária.
> Preserve o comportamento atual.
> Implemente da forma mais simples e consistente com a arquitetura existente.
> Rode os testes existentes.
> Gere novamente o `dist/terminalis.html`.
> Não declare a tarefa concluída sem revisar o diff e verificar regressões.


---

# 70. Estado publicado em 11 de setembro de 2026

A base mais nova do projeto integrou o conteúdo de `Terminalis.rar` sem descartar a refatoração anterior. O repositório agora contém:

- `src/49-workspace-00-codec.js` e `src/49-workspace-10-domains.js` para snapshots versionados e restauração do laboratório completo;
- `src/74-cloud-10-config.js` a `src/74-cloud-40-sync.js` para configuração, Auth, Storage, cache offline, revisão otimista e sincronização Supabase;
- `database/supabase/schema.sql` com tabelas canônicas (`profiles`, `user_progress`, `workspaces`), migração, trigger seguro de perfil e RLS por `auth.uid()`;
- `config.example.js` para deploy e `.gitignore` protegendo `config.local.js`;
- `.github/workflows/ci.yml` com build, testes Node e Playwright Chromium;
- `test/workspace.js` e `test/cloud.js`, incluindo restauração, offline, conflito, merge e isolamento.

O modo Supabase é ativado quando `window.TERMINALIS_CONFIG.supabase.url` e `anonKey` estão preenchidos e o SDK CDN está disponível. A chave `service_role` nunca deve ir para o frontend. O workspace é salvo como dados explícitos, com revisão otimista. Em conflito, a sincronização pausa, mantém backup local e exige escolher a versão remota ou local. O progresso usa merge determinístico para não perder conclusões feitas em dispositivos diferentes.

Commits incrementais publicados em `main`: `42f1b93`, `ad9c36a`, `4e70b65`, `0dd7dad`, `eb8bd98`, `af6a41a`, `d12b52f`, `f92edb4`, `979bbef` e `9d6f10c`. Não houve force push, reset destrutivo ou squash.

Última validação: build com 96 arquivos JS; testes de domínio com Linux 163, Docker 160, Git 24, estrutura 217, soluções 449, Workspace e Cloud aprovados; navegador com Auth 48, aluno 28, interface, feedback desktop/mobile e 449 componentes práticos aprovados.


# 71. Ajustes posteriores

Depois do addendum anterior, foram publicados mais dois commits incrementais:

- `b683597` — teste de sincronização entre dois dispositivos (PC A, PC B e conflito);
- `59354c4` — estado visual dedicado para conflito na barra de sincronização.

A assinatura usada para decidir se um workspace está sujo ignora somente metadados voláteis (`updatedAt`, `atime` e histórico), mas esses dados continuam no snapshot persistido. Assim, leituras não disparam upload sem necessidade, enquanto uma mutação posterior ainda salva o histórico completo.


# 72. Correção de overflow responsivo

O CI encontrou overflow horizontal de 5 px na rota `course` em viewport Chromium de 1024 px. A causa foi a coluna central do cabeçalho do curso sem `min-width: 0`; a correção foi publicada no commit `9b0c83f` e a suíte `test/interface.js` local passou.
