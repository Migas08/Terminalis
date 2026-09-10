Pesquisa concluída. Segue o relatório factual.

---

# RELATÓRIO TÉCNICO — Docker Compose e Traefik (setembro/2026)

> Todas as afirmações abaixo foram extraídas das docs oficiais (`docs.docker.com`, `compose-spec/compose-spec`, `doc.traefik.io` e o repositório `traefik/traefik`). Onde a doc **não** confirma algo comumente repetido na internet, isso está explicitamente sinalizado com ⚠️.

---

# PARTE A — DOCKER COMPOSE

## A.0 Versões vigentes (verificado)

| Item | Estado em set/2026 |
|---|---|
| Última release do Compose CLI | **v5.5.0**, de **17/08/2026** ([releases](https://github.com/docker/compose/releases)) |
| Versão instalada no ambiente de teste | `Docker Compose version v5.1.3` |
| Linhas suportadas | "Today, the supported Docker Compose CLI versions are **Compose v2 and Compose v5**, both of which are defined by the Compose Specification" — [History](https://docs.docker.com/compose/intro/history/) |

⚠️ **Atenção didática:** a numeração pulou de v2.x para v5.x. Materiais de curso que dizem "Compose v2 é a versão atual" estão defasados; o correto é "**plugin `docker compose` (Go)**, hoje na linha v5, especificado pela Compose Specification".

---

## A.1 Nome canônico do arquivo e ordem de precedência

Fonte: [Compose application model](https://docs.docker.com/compose/intro/compose-application-model/)

> "The default path for a Compose file is `compose.yaml` (preferred) or `compose.yml` that is placed in the working directory. Compose also supports `docker-compose.yaml` and `docker-compose.yml` for backwards compatibility of earlier versions. If both files exist, Compose prefers the canonical `compose.yaml`."

**Ordem de precedência (maior → menor):**

1. `compose.yaml` ← **canônico, ensinar este**
2. `compose.yml`
3. `docker-compose.yaml`
4. `docker-compose.yml` ← só retrocompatibilidade

---

## A.2 A chave `version:` — OBSOLETA

Fonte: [Version and name top-level elements](https://docs.docker.com/reference/compose-file/version-and-name/)

> "The top-level `version` property is defined by the Compose Specification for backward compatibility. It is only informative and **you'll receive a warning message that it is obsolete if used**."

E na [FAQ](https://docs.docker.com/compose/support-and-feedback/faq/): "Compose v2 ignores the `version` top-level element in the `compose.yaml` file."

🚩 **Sintaxe obsoleta:** `version: "3.8"` / `version: "3"` / `version: "2"` no topo do arquivo. **Remover.** Gera warning e não tem efeito algum.

Ainda existe a página [Legacy versions](https://docs.docker.com/reference/compose-file/legacy-versions/) apenas como referência histórica: "Legacy versions 2.x and 3.x of the Compose file format were merged into the Compose Specification."

---

## A.3 `docker compose` (plugin) vs `docker-compose` (V1 Python)

Fonte: [History](https://docs.docker.com/compose/intro/history/) e [Deprecated and retired features](https://docs.docker.com/retired/)

> "Compose v1 was first released in 2014. It was written in Python and invoked with `docker-compose`. Compose v2, announced in 2020, is written in Go and is invoked with `docker compose`."

> "Docker Compose v1 (`docker-compose`), a Python-based tool for defining multi-container applications, has been superseded by Compose v2 (`docker compose`), which is written in Go and integrates with the Docker CLI. **Compose v1 is no longer maintained, and users should migrate to Compose v2.**"

⚠️ A doc **não publica uma data exata de EOL/remoção** do V1 — apenas "no longer maintained". Não afirme datas em aula.

**Diferenças práticas a ensinar (do [guia de migração](https://docs.docker.com/compose/releases/migrate/)):**
- Comando: `docker-compose` → `docker compose` (subcomando, sem hífen).
- Separador nos nomes de contêiner/rede: V1 usava `_` (`projeto_web_1`); V2+ usa `-` (`projeto-web-1`).
- V2+ ignora `version:`.

---

## A.4 Atributos de serviço (sintaxe atual)

Fonte primária: [Services top-level element](https://docs.docker.com/reference/compose-file/services/)

### image / build

```yaml
services:
  app:
    image: minha-org/app:1.4.2

  api:
    build:
      context: ./backend        # obrigatório; caminho ou URL git
      dockerfile: Dockerfile.prod   # relativo ao context
      target: builder           # estágio do multi-stage build
      args:                     # aceita lista OU mapa
        - BUILD_ENV=production
        - VERSION=1.0
```

Forma curta: `build: ./backend` (equivale a `context: ./backend`).

### container_name

```yaml
container_name: my-web-container
```
Regex aceito: `[a-zA-Z0-9][a-zA-Z0-9_.-]+`. **Impede escalar além de 1 réplica** (nome deve ser único).

### ports — forma curta e longa

```yaml
# curta
ports:
  - "8080:80"
  - "443:443/tcp"
  - "127.0.0.1:8001:8001"   # bind só no loopback
  - "3000"                  # porta aleatória no host → 3000 no container

# longa
ports:
  - target: 80        # porta DENTRO do container
    published: 8080   # porta no host (pode ser range "8000-8010")
    protocol: tcp
    app_protocol: http
    mode: host
```

### expose

```yaml
expose:
  - "3000"
  - "8000"
```
Declara portas acessíveis apenas às **redes conectadas** — não publica no host.

### volumes — forma curta e longa

```yaml
# curta:  [SOURCE:]TARGET[:MODE]
volumes:
  - /var/lib/mysql            # volume anônimo
  - ./cache:/data/cache       # bind mount (relativo ⇒ precisa começar com ./ ou ../)
  - ./config:/etc/config:ro   # somente leitura
  - db-data:/var/lib/postgresql/data   # volume nomeado

# longa
volumes:
  - type: bind
    source: ./nginx.conf
    target: /etc/nginx/conf.d/default.conf
    read_only: true
  - type: volume
    source: db-data
    target: /var/lib/postgresql/data
  - type: tmpfs
    target: /run
    tmpfs:
      size: 1000000
```
`type` aceita: `volume`, `bind`, `tmpfs`, `npipe`, `cluster`, `image`.

### networks

```yaml
services:
  web:
    networks:
      - frontend
      - backend
  db:
    networks:
      backend:
        aliases:
          - database
        ipv4_address: 172.16.238.10

networks:
  frontend:
  backend:
```

### environment — duas formas

```yaml
# mapa (recomendado — mais legível)
environment:
  POSTGRES_USER: example
  POSTGRES_DB: exampledb
  DEBUG: "true"        # aspas! senão vira booleano YAML

# lista
environment:
  - POSTGRES_USER=example
  - POSTGRES_DB=exampledb
  - DEBUG              # sem "=" ⇒ repassa o valor do shell do host
```

### env_file

```yaml
env_file: .env

env_file:                # múltiplos: processados de cima para baixo
  - ./default.env
  - ./override.env

env_file:                # forma longa
  - path: ./default.env
    required: true
  - path: ./override.env
    required: false
    format: raw          # passa valores literalmente, sem interpolação
```

### depends_on — curta e longa

```yaml
# curta: só ordem de inicialização
depends_on:
  - db
  - redis

# longa: com condição
depends_on:
  db:
    condition: service_healthy                    # exige healthcheck no serviço db
    restart: true                                 # reinicia este serviço se db reiniciar
  redis:
    condition: service_started                    # padrão da forma curta
  migracao:
    condition: service_completed_successfully     # exit code 0
    required: false
```

Os três valores de `condition`: **`service_started`**, **`service_healthy`**, **`service_completed_successfully`**.

⚠️ Ponto crítico para o curso: `depends_on` na forma curta **não espera o serviço ficar pronto**, apenas iniciado. Só `service_healthy` (que exige `healthcheck`) garante prontidão.

### restart

```yaml
restart: unless-stopped
```
Valores: `no` (padrão), `always`, `on-failure[:max-retries]`, `unless-stopped`.

⚠️ `restart: no` — em YAML, `no` sem aspas é interpretado como booleano `false` por parsers YAML 1.1. Ensinar `restart: "no"`.

### command / entrypoint

```yaml
command: bundle exec thin -p 3000                  # string (shell form)
command: ["bundle", "exec", "thin", "-p", "3000"]  # lista (exec form — preferir)
command: []                                        # zera o CMD da imagem

entrypoint: /code/entrypoint.sh
entrypoint:
  - php
  - -d
  - zend_extension=/usr/local/lib/php/extensions/xdebug.so
```

### healthcheck

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost"]        # exec direto, sem shell
  # ou
  test: ["CMD-SHELL", "curl -f http://localhost || exit 1"]  # via /bin/sh -c
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s      # período de graça inicial: falhas não contam
  start_interval: 5s     # intervalo mais curto durante o start_period
```

- `["CMD", ...]` → executa o binário diretamente (sem shell; `||`, `>`, `$VAR` **não** funcionam).
- `["CMD-SHELL", "..."]` → executa via shell do container (permite pipes, `||`, etc.).
- Uma string simples (`test: curl -f http://localhost`) equivale a `CMD-SHELL`.
- `test: ["NONE"]` desabilita o healthcheck herdado da imagem.

### deploy.resources.limits

```yaml
deploy:
  resources:
    limits:
      cpus: "0.50"
      memory: 50M
    reservations:
      cpus: "0.25"
      memory: 20M
```

Da [Compose Deploy Specification](https://github.com/compose-spec/compose-spec/blob/main/deploy.md):
> "`resources` configures physical resource constraints for container to run on platform." / "`limits`: The platform must prevent the container to allocate more."
> "**Deploy is an optional part of the Compose Specification**."

⚠️ **Funciona sem Swarm?** A documentação oficial **é silenciosa** sobre isso — a página [deploy](https://docs.docker.com/reference/compose-file/deploy/) não distingue Compose standalone de Swarm. Na prática o `docker compose` aplica `resources.limits` (cpus/memory) como limites de cgroup no contêiner, enquanto chaves como `replicas`, `placement`, `endpoint_mode` e `update_config` são específicas de orquestrador. **Recomendo demonstrar ao vivo com `docker stats` em vez de afirmar categoricamente**, já que não há citação oficial.

### configs e secrets (nível de serviço)

```yaml
services:
  redis:
    image: redis:latest
    # curta — monta em /run/secrets/<nome> e /<nome> respectivamente
    secrets:
      - my_secret
    configs:
      - my_config

    # longa
    secrets:
      - source: my_secret
        target: /redis_secret
        uid: "103"
        gid: "103"
        mode: 0440
```
Fonte: [services#secrets](https://docs.docker.com/reference/compose-file/services/#secrets). Caminho padrão do secret: **`/run/secrets/<source>`**.

### profiles

```yaml
services:
  frontend:
    image: frontend
  phpmyadmin:
    image: phpmyadmin
    profiles:
      - debug
      - dev
```
Serviços com `profiles` só são criados quando o perfil é ativado (`--profile debug` ou `COMPOSE_PROFILES=debug`). Serviços **sem** `profiles` sempre sobem. Fonte: [profiles](https://docs.docker.com/reference/compose-file/profiles/).

### pull_policy

```yaml
pull_policy: always
```
Valores: `always`, `never`, `missing` / `if_not_present`, `build`, `daily`, `weekly`, `every_<duração>`.

### develop / watch

Fonte: [develop](https://docs.docker.com/reference/compose-file/develop/)

```yaml
services:
  frontend:
    image: example/webapp
    build: ./webapp
    develop:
      watch:
        - path: ./webapp/html
          action: sync
          target: /var/www
          ignore:
            - node_modules/
  backend:
    image: example/backend
    build: ./backend
    develop:
      watch:
        - path: ./backend/src
          action: rebuild
```

Ações: `sync`, `rebuild`, `restart` (2.32.0+), `sync+restart` (2.23.0+), `sync+exec` (2.32.0+). Usado com `docker compose watch` (ou `up --watch`).

---

## A.5 Elementos top-level

| Chave | Função | Doc |
|---|---|---|
| `services` | **Obrigatório na prática.** Define os contêineres. | [services](https://docs.docker.com/reference/compose-file/services/) |
| `networks` | Redes a criar/usar (`driver`, `external: true`, `name`, `ipam`). | [networks](https://docs.docker.com/reference/compose-file/networks/) |
| `volumes` | Volumes nomeados (`driver`, `external: true`, `name`). | [volumes](https://docs.docker.com/reference/compose-file/volumes/) |
| `configs` | Config não-sensível (`file:`, `content:`, `environment:`, `external:`). | [configs](https://docs.docker.com/reference/compose-file/configs/) |
| `secrets` | Dado sensível. Fontes: `file:`, `environment:`, `external:`. | [secrets](https://docs.docker.com/reference/compose-file/secrets/) |
| `name` | Nome do projeto. Disponível na interpolação como `COMPOSE_PROJECT_NAME`. | [version-and-name](https://docs.docker.com/reference/compose-file/version-and-name/) |
| `include` | Inclui outros arquivos Compose. | [include](https://docs.docker.com/reference/compose-file/include/) |
| ~~`version`~~ | 🚩 **Obsoleto** (warning). | acima |

Extras úteis: `x-*` ([extensions/fragments](https://docs.docker.com/reference/compose-file/fragments/)) para âncoras YAML reutilizáveis, e `models` (novo, para model runners).

### include

```yaml
# curta
include:
  - ../commons/compose.yaml
  - ../another_domain/compose.yaml

# longa
include:
  - path: ../commons/compose.yaml
    project_directory: ..
    env_file: ../another/.env
```
> "Compose displays a warning if resource names conflict and doesn't try to merge them."

### extends (atributo de serviço, não top-level)

Fonte: [Extend your Compose file](https://docs.docker.com/compose/how-tos/multiple-compose-files/extends/)

```yaml
services:
  web:
    extends:
      file: common-services.yml
      service: webapp
    command: /code/run_web_app
```

> "Relative paths declared by the service being extended are converted so they still point to the same file when used by the extending service."
> "the `webapp` service itself is not part of the final project" (o serviço-base do arquivo externo não é criado).

**⚠️ Não confundir com `include`:** `extends` herda *um serviço*; `include` traz *o modelo inteiro* de outro arquivo.

---

## A.6 Interpolação de variáveis

Fonte: [Interpolation](https://docs.docker.com/reference/compose-file/interpolation/)

| Sintaxe | Comportamento |
|---|---|
| `${VAR}` / `$VAR` | Substitui pelo valor; vazio se indefinida |
| `${VAR:-default}` | `default` se **indefinida OU vazia** |
| `${VAR-default}` | `default` só se **indefinida** |
| `${VAR:?erro}` | **Aborta** com a mensagem `erro` se indefinida ou vazia |
| `${VAR?erro}` | Aborta só se indefinida |
| `${VAR:+repl}` | Usa `repl` se VAR estiver **definida e não vazia** |
| `${VAR+repl}` | Usa `repl` se VAR estiver definida (mesmo vazia) |
| `$$` | Escapa: produz um `$` literal, sem interpolação |

Aninhamento é suportado: `${VARIABLE:-${FOO:-default}}`.

### `.env` vs `env_file` — a distinção central

Fonte: [Variable interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

| | `.env` (arquivo na raiz do projeto) | `env_file:` (atributo de serviço) |
|---|---|---|
| Onde atua | **No próprio compose.yaml**, em tempo de parsing | **Dentro do contêiner** |
| Para que serve | Interpolar `${VAR}` no YAML | Injetar variáveis de ambiente no processo |
| Lido por | CLI do Compose | Compose → daemon → contêiner |
| Nome | Fixo `.env` (mudável com `--env-file`) | Qualquer caminho declarado |

> "`.env` … a text file used to define variables that should be made available for interpolation when running `docker compose up`."
> "Substitution from `.env` files is a Docker Compose CLI feature. It is not supported by Swarm when running `docker stack deploy`."

⚠️ Armadilha clássica de curso: variável definida só no `.env` **não aparece dentro do contêiner** a menos que seja repassada via `environment:` ou `env_file:`.

### Precedência de variáveis de ambiente

Fonte: [Environment variables precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/) — do **maior** para o **menor**:

1. `docker compose run -e VAR=valor` (flag CLI com valor explícito)
2. Valores interpolados em `environment:`/`env_file:` a partir do shell ou de arquivos `.env`
3. Atributo `environment:` do compose file
4. Atributo `env_file:` do compose file
5. Diretiva `ENV` da imagem (Dockerfile)

> "Having any `ARG` or `ENV` setting in a Dockerfile evaluates only if there is no Docker Compose entry for `environment`, `env_file` or `run --env`."

---

## A.7 Comandos essenciais

Fonte: [docker compose CLI](https://docs.docker.com/reference/cli/docker/compose/)

### Opções globais (vêm **antes** do subcomando)

| Flag | Descrição (verbatim) |
|---|---|
| `-f, --file` | "Compose configuration files" (repetível — múltiplos arquivos são mesclados) |
| `-p, --project-name` | "Project name" |
| `--profile` | "Specify a profile to enable" |
| `--env-file` | "Specify an alternate environment file" |
| `--project-directory` | "Specify an alternate working directory (default: the path of the first specified Compose file)" |
| `--parallel` | "Control max parallelism, -1 for unlimited" |
| `--progress` | "Set type of progress output (auto, tty, plain, json, quiet)" |

Exemplo: `docker compose -f compose.yaml -f compose.prod.yaml -p meuprojeto up -d`

### `up`

Fonte: [docker compose up](https://docs.docker.com/reference/cli/docker/compose/up/)

| Flag | Descrição |
|---|---|
| `-d, --detach` | "Detached mode: Run containers in the background" |
| `--build` | "Build images before starting containers" |
| `--force-recreate` | "Recreate containers even if their configuration and image haven't changed" |
| `--no-deps` | "Don't start linked services" |
| `--wait` | "Wait for services to be running\|healthy. Implies detached mode." |
| `--pull` | "Pull image before running (\"always\"\|\"missing\"\|\"never\")" |
| `--remove-orphans` | "Remove containers for services not defined in the Compose file" |
| `--scale SERVICE=N` | "Scale SERVICE to NUM instances." |
| `--abort-on-container-exit` | "Stops all containers if any container was stopped. Incompatible with -d" |
| `--watch` | Ativa o modo watch |

### `down` — o que remove por padrão

Fonte: [docker compose down](https://docs.docker.com/reference/cli/docker/compose/down/)

**Remove por padrão:**
- "Containers for services defined in the Compose file"
- "Networks defined in the `networks` section of the Compose file"
- "The default network, if one is used"

**NÃO remove por padrão:** redes e volumes marcados como `external`, **volumes nomeados** e volumes anônimos, imagens.

| Flag | Efeito |
|---|---|
| `-v, --volumes` | Remove "named volumes declared in the `volumes` section of the Compose file and anonymous volumes attached to containers" — ⚠️ **destrói dados** |
| `--rmi local` / `--rmi all` | `local` = só imagens sem tag customizada; `all` = todas as imagens dos serviços |
| `--remove-orphans` | Remove "containers for services not defined in the Compose file" |
| `-t, --timeout` | Segundos antes do SIGKILL |

### Demais comandos

| Comando | O que faz |
|---|---|
| `stop` | Para os contêineres **sem removê-los** (`start` retoma) |
| `start` | Inicia contêineres já criados |
| `restart` | Reinicia contêineres — ⚠️ **não relê o compose.yaml**; para aplicar mudanças use `up -d` |
| `ps` | Lista os contêineres do projeto (`-a` inclui parados) |
| `logs` / `logs -f` | Mostra a saída; `-f` acompanha em tempo real. Úteis: `--tail=100`, `--since`, `--timestamps` |
| `pull` | Baixa as imagens dos serviços |
| `build` | Constrói/reconstrói (`--no-cache`, `--pull`) |
| `exec SERVICO CMD` | Executa comando em contêiner **já rodando** |
| `run SERVICO CMD` | Cria um contêiner **novo e efêmero**; sobe as dependências (evite com `--no-deps`), use `--rm` |
| `config` | "Parse and render compose file in canonical format" — valida e mostra o YAML final interpolado. **Ferramenta de depuração nº 1.** Variantes: `--services`, `--volumes`, `--format json`, `--no-interpolate` |

⚠️ `exec` vs `run`: `exec` entra no contêiner existente; `run` cria outro. Confusão frequente em turmas.

---

## A.8 YAML — o que mais quebra um Compose

Estas são regras da especificação YAML e do parser usado pelo Compose (não há uma página única do Docker sobre isso; são as causas empíricas de erro):

1. **Indentação apenas com ESPAÇOS.** Tabulação (`\t`) é **proibida** em YAML e gera erro de parsing. Configure o editor: 2 espaços, `expandtab`.

2. **Indentação é semântica.** Um nível a mais ou a menos muda o dono da chave. Padrão: 2 espaços por nível.

3. **Listas com `- ` (hífen + espaço).** `-item` sem espaço não é lista.

4. **Booleanos implícitos (YAML 1.1):** `yes`, `no`, `on`, `off`, `true`, `false`, `y`, `n` sem aspas viram booleanos.
   - `restart: no` → interpretado como `false`. Escreva `restart: "no"`.
   - `environment: { DEBUG: no }` → o contêiner recebe `DEBUG=false`.
   - Regra prática: **todo valor de `environment:` deve ir entre aspas.**

5. **Portas devem ir entre aspas.** `"8080:80"`. Sem aspas, `22:22` é lido como notação sexagesimal (base 60) e vira o número `1342`. Por isso todos os exemplos oficiais usam `- "8080:80"`.

6. **Versões de imagem entre aspas.** `image: mysql:5.7` funciona (é string por causa do `:`), mas `POSTGRES_VERSION: 16.0` vira o float `16.0`; use `"16.0"`.

7. **Cifrão precisa de escape.** `$` no YAML é interpolação do Compose. Para um `$` literal, use `$$` — essencial no hash do BasicAuth do Traefik (ver Parte B).

8. **`#` inicia comentário** em qualquer ponto após espaço; dentro de string com aspas, não.

9. **Chaves duplicadas:** a última vence silenciosamente em muitos casos — difícil de depurar.

10. **Caminhos relativos de bind mount** devem começar com `./` ou `../`; `config:/etc/config` seria lido como **volume nomeado** chamado `config`, não como pasta local.

**Ferramenta de verificação:** `docker compose config` renderiza o YAML final já interpolado — ensine isso como primeiro passo de depuração.

---

# PARTE B — TRAEFIK

## B.0 Versão vigente

**Traefik v3.7** é a versão documentada em `doc.traefik.io/traefik` (confirmado tanto no rodapé de edição da doc quanto no exemplo oficial de setup Docker, que usa `image: traefik:v3.7`).

🚩 **Toda a sintaxe abaixo é v3.** Marcações v2 obsoletas estão sinalizadas.

---

## B.1 Conceitos e configuração estática vs dinâmica

Fonte: [Configuration Introduction](https://doc.traefik.io/traefik/getting-started/configuration-overview/)

### Componentes

Da [página inicial da doc](https://doc.traefik.io/traefik/):

- **EntryPoints** — "Network entry points into Traefik. They define the port that will receive the packets and whether to listen for TCP or UDP."
- **Routers** — "connecting incoming requests to the services that can handle them"; podem aplicar middlewares antes de encaminhar.
- **Services** — "Responsible for configuring how to reach the actual services that will eventually handle the incoming requests." (load balancer, portas dos backends)
- **Middlewares** — transformam a requisição/resposta entre router e service (auth, redirect, strip prefix, rate limit…).
- **Providers** — "Infrastructure components, whether orchestrators, container engines, cloud providers, or key-value stores" que Traefik consulta para atualizar rotas dinamicamente.

### Estática vs dinâmica

| | **Estática** (*install configuration*) | **Dinâmica** (*routing configuration*) |
|---|---|---|
| Definição oficial | "Elements in the *install configuration* set up connections to providers and define the entrypoints Traefik will listen to (these elements don't change often)." | "The *routing configuration* contains everything that defines how the requests are handled by your system. This configuration can change and is seamlessly **hot-reloaded, without any request interruption or connection loss**." |
| Onde vive | 1) Arquivo `traefik.yml`/`traefik.yaml`/`traefik.toml`; 2) argumentos de linha de comando; 3) variáveis de ambiente | Labels Docker, arquivo dinâmico (file provider), CRDs Kubernetes, KV store… |
| Aplicar mudanças | **Exige reiniciar** o Traefik | Recarregada a quente |
| Contém | `entryPoints`, `providers`, `certificatesResolvers`, `api`, `log`, `metrics`, `tracing` | `http.routers`, `http.services`, `http.middlewares`, `tls.certificates`, `tls.options` |

> "These three ways are **mutually exclusive** (i.e. you can use only one at the same time)" e "are evaluated in the order listed above" (arquivo → CLI → env).

⚠️ Erro clássico de aluno: tentar declarar `entryPoints` em labels Docker, ou `routers` no `traefik.yml` estático. **Não funciona.**

---

## B.2 Provider Docker

Fonte: [Docker provider (static configuration)](https://doc.traefik.io/traefik/reference/install-configuration/providers/docker/)

### Habilitar

```yaml
# traefik.yml (estático)
providers:
  docker:
    exposedByDefault: false
    network: web
    endpoint: "unix:///var/run/docker.sock"
```
```bash
# equivalente em CLI
--providers.docker=true
--providers.docker.exposedByDefault=false
--providers.docker.network=web
```

### Opções principais (verbatim da tabela oficial)

| Opção | Descrição | Default |
|---|---|---|
| `providers.docker.endpoint` | Endpoint da API Docker | `unix:///var/run/docker.sock` |
| `providers.docker.exposedByDefault` | "Expose containers by default through Traefik. **If set to _false_, containers that do not have a `traefik.enable=true` label are ignored** from the resulting routing configuration" | `true` |
| `providers.docker.network` | "Defines a default docker network to use for connections to all containers. This option can be overridden on a per-container basis with the `traefik.docker.network` label." | `""` |
| `providers.docker.defaultRule` | Regra padrão para contêineres sem label de rule | ``Host(`{{ normalize .Name }}`)`` |
| `providers.docker.watch` | Observa eventos do Docker | `true` |
| `providers.docker.useBindPortIP` | Usa o IP/porta do *binding* em vez do IP interno | `false` |

✅ **Boa prática de curso:** sempre `exposedByDefault: false`. Caso contrário todo contêiner do host vira rota pública automaticamente.

### O socket `/var/run/docker.sock` e seus riscos

Fonte verbatim da seção **"Docker API Access → Security Note"** ([docker.md](https://doc.traefik.io/traefik/reference/install-configuration/providers/docker/)):

> "Traefik requires access to the docker socket to get its dynamic configuration."
>
> ⚠️ **Security Note:**
> "**Accessing the Docker API without any restriction is a security concern: If Traefik is attacked, then the attacker might get access to the underlying host.**"
>
> "As explained in the [Docker Daemon Attack Surface documentation](https://docs.docker.com/engine/security/#docker-daemon-attack-surface):
> > *[...] only **trusted** users should be allowed to control your Docker daemon [...]*"

**Soluções que a própria doc lista** (seção "Solutions"): expor o socket via TCP ou SSH em vez do arquivo Unix, e aplicar os conceitos de AAA (Authentication, Authorization, Accounting):
- Autenticação com certificados de cliente ("Protect the Docker daemon socket");
- Autorizar e filtrar requisições com o **[Docker Socket Proxy da Tecnativa](https://github.com/Tecnativa/docker-socket-proxy)**;
- Docker Authorization Plugin Mechanism;
- *Accounting* em nível de rede (socket exposto só numa rede Docker privada acessível ao Traefik);
- *Accounting* em nível de contêiner (expor o socket em outro contêiner que não o do Traefik);
- *Accounting* em nível de kernel (SELinux restringindo as chamadas do processo);
- Autenticação por chave pública SSH (Docker > 18.09);
- HTTP Basic auth através de um proxy HTTP.

**Mitigação mínima e barata para o curso:** montar o socket **read-only** — `- /var/run/docker.sock:/var/run/docker.sock:ro` — e usar `security_opt: [no-new-privileges:true]`. Deixe claro que `:ro` **reduz**, mas não elimina o risco (a API Docker é acessada por escrita no socket; `:ro` impede substituir o arquivo, não os comandos). A solução robusta é o socket-proxy.

### Aviso sobre labels e dados sensíveis

Da [doc de routing Docker](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/docker/):
> "We recommend to *not* use labels to store sensitive data (certificates, credentials, etc). Instead, we recommend to store sensitive data in a safer storage (secrets, file, etc)."

---

## B.3 Labels v3 — referência completa

Fonte: [Traefik & Docker routing](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/docker/)

### Labels de router (`traefik.http.routers.<router_name>.*`)

| Label | Exemplo oficial |
|---|---|
| `traefik.enable` | `true` (obrigatório quando `exposedByDefault=false`) |
| `.rule` | ``Host(`example.com`)`` |
| `.entrypoints` | `ep1,ep2` (lista separada por vírgula) |
| `.middlewares` | `auth,prefix,cb` |
| `.service` | `myservice` |
| `.tls` | `true` |
| `.tls.certresolver` | `myresolver` |
| `.tls.domains[n].main` | `example.org` |
| `.tls.domains[n].sans` | `test.example.org,dev.example.org` |
| `.tls.options` | `foobar` |
| `.priority` | `42` |
| `.observability.accesslogs` / `.metrics` / `.tracing` | `true` |
| `.ruleSyntax` | `v3` — 🚩 **"RuleSyntax option is deprecated and will be removed in the next major version. Please do not use this field and rewrite the router rules to use the v3 syntax."** |

### Labels de service (`traefik.http.services.<service_name>.*`)

| Label | Descrição verbatim | Exemplo |
|---|---|---|
| `.loadbalancer.server.port` | "Registers a port. Useful when the container exposes multiples ports." | `8080` |
| `.loadbalancer.server.scheme` | "Overrides the default scheme." | `http` |
| `.loadbalancer.server.url` | "Defines the service URL. This option cannot be used in combination with `port` or `scheme` definition." | `http://foobar:8080` |
| `.loadbalancer.passhostheader` | | `true` |
| `.loadbalancer.healthcheck.path` / `.interval` / `.timeout` / `.status` | health check ativo | `/foo`, `10s`, `10s`, `42` |
| `.loadbalancer.sticky.cookie` (+ `.name`, `.secure`, `.httponly`, `.samesite`, `.maxage`) | sessão fixa | `true` |

> **"Traefik Connecting to the Wrong Port: `HTTP/502 Gateway Error`** — By default, Traefik uses the first exposed port of a container. Setting the label `traefik.http.services.xxx.loadbalancer.server.port` overrides that behavior."

⚠️ Esse é o erro mais comum em turmas: 502 porque a imagem expõe várias portas. Solução: sempre declarar `loadbalancer.server.port`.

### Label específica do provider Docker

| Label | Descrição verbatim |
|---|---|
| `traefik.docker.network` | "Overrides the default docker network to use for connections to the container. If a container is linked to several networks, be sure to set the proper network name (you can check this with `docker inspect <container_id>`), **otherwise it will randomly pick one** (depending on how docker is returning them). When deploying a stack from a compose file `stack`, the networks defined are prefixed with `stack`." |

### Middlewares por label

> "You can declare pieces of middleware using labels starting with `traefik.http.middlewares.<name-of-your-choice>.`, followed by the middleware type/options."
> "For example, to declare a middleware named `my-redirect` with the `redirectscheme` type … you'd write `traefik.http.middlewares.my-redirect.redirectscheme.scheme=https`."

Exemplo verbatim da doc:
```yaml
labels:
  - traefik.http.middlewares.my-redirect.redirectscheme.scheme=https
  - traefik.http.routers.my-container.middlewares=my-redirect
```

**Catálogo dos cinco pedidos** (sintaxe de label, verbatim das docs de cada middleware):

```yaml
# redirectScheme — https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/redirectscheme/
- "traefik.http.middlewares.test-redirectscheme.redirectscheme.scheme=https"
- "traefik.http.middlewares.test-redirectscheme.redirectscheme.permanent=true"

# basicAuth — https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/basicauth/
- "traefik.http.middlewares.test-auth.basicauth.users=test:$$apr1$$H6uskkkW$$IgXLP6ewTrSuBkTrqE8wj/,test2:$$apr1$$d9hr9HBB$$4HxwgUir3HP4EsggP/QNo0"

# stripPrefix — https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/stripprefix/
- "traefik.http.middlewares.test-stripprefix.stripprefix.prefixes=/foobar,/fiibar"

# headers — https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/
- "traefik.http.middlewares.testHeader.headers.customrequestheaders.X-Script-Name=test"
- "traefik.http.middlewares.testHeader.headers.customresponseheaders.X-Custom-Response-Header=value"

# rateLimit — https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/ratelimit/
- "traefik.http.middlewares.test-ratelimit.ratelimit.average=100"
- "traefik.http.middlewares.test-ratelimit.ratelimit.period=1s"
- "traefik.http.middlewares.test-ratelimit.ratelimit.burst=200"
```

⚠️ **Escape do BasicAuth — ponto de aula obrigatório.** A doc oficial do BasicAuth diz, verbatim:
> "Note: when used in `docker-compose.yml` **all dollar signs in the hash need to be doubled for escaping**. To create user:password pair, it's possible to use this command: `echo $(htpasswd -nB user) | sed -e s/\\$/\\$\\$/g`"
> "Also, note that dollar signs should **NOT** be doubled when not evaluated (e.g. Ansible `docker_container` module)."

O guia oficial de setup usa: `htpasswd -nb admin "P@ssw0rd" | sed -e 's/\$/\$\$/g'`

Detalhe importante: `stripPrefix` "strips the matching path prefix and **stores it in an `X-Forwarded-Prefix` header**".

E `redirectScheme` traz um aviso: "When there is at least one other reverse-proxy between the client and Traefik, the other reverse-proxy (i.e. the last hop) needs to be a **trusted** one. Otherwise, Traefik would clean up the `X-Forwarded` headers coming from this last hop, and as the RedirectScheme middleware relies on them to determine the scheme used, it would not function as intended."

**Middlewares disponíveis em v3** ([overview](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/overview/)): BasicAuth, DigestAuth, ForwardAuth, IPAllowList, Headers, PassTLSClientCert, RateLimit, CircuitBreaker, Retry, InFlightReq, StripPrefix, StripPrefixRegex, AddPrefix, RedirectScheme, RedirectRegex, ReplacePath, ReplacePathRegex, Compress, Buffering, Errors, GrpcWeb.

---

## B.4 Regras de roteamento: v2 → v3 (mudança crítica)

Fonte: [Rules & Priority](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/) e [Configuration changes for v3](https://doc.traefik.io/traefik/migrate/v2-to-v3-details/)

### Matchers HTTP em v3

| Matcher | Sintaxe |
|---|---|
| ``Header(`chave`, `valor`)`` | Header exato |
| ``HeaderRegexp(`chave`, `regexp`)`` | Header por regex Go |
| ``Host(`dominio`)`` | Domínio; aceita curinga `*.example.com` |
| ``HostRegexp(`regexp`)`` | Host por regex Go |
| ``Method(`GET`)`` | Verbo HTTP |
| ``Path(`/caminho`)`` | Caminho **exato** |
| ``PathPrefix(`/prefixo`)`` | Prefixo e tudo abaixo dele |
| ``PathRegexp(`regexp`)`` | Caminho por regex Go |
| ``Query(`chave`, `valor`)`` | Parâmetro de query |
| ``QueryRegexp(`chave`, `regexp`)`` | Query por regex Go |
| ``ClientIP(`ip`)`` | IPv4, IPv6 ou CIDR |

### Combinação

> "The usual AND (`&&`) and OR (`||`) logical operators can be used, with the expected precedence rules, as well as **parentheses** to express complex rules. The **NOT (`!`)** operator allows you to invert the matcher."

> "To set the value of a rule, use **backticks** or escaped double-quotes. **Single quotes are not accepted.**"

### Prioridade

> Prioridade padrão = **comprimento da regra em caracteres**. "The longest length has the highest priority."
> "A value of `0` for the priority is ignored: `priority: 0` means that the default rules length sorting is used."

Prioridade explícita (`.priority=100`) sobrescreve; número maior vence.

### 🚩 Diferenças v2 → v3 (o que ficou OBSOLETO)

Verbatim do [guia de migração](https://doc.traefik.io/traefik/migrate/v2-to-v3-details/):

> "In v3, a **new rule matchers syntax** has been introduced for HTTP and TCP routers."

| # | v2 (obsoleto) 🚩 | v3 (correto) ✅ | Fonte |
|---|---|---|---|
| 1 | `Headers(...)`, `HeadersRegexp(...)` | `Header(...)`, `HeaderRegexp(...)` (singular) | "`Headers` and `HeadersRegexp` become `Header` and `HeaderRegexp`" |
| 2 | ``PathPrefix(`/api/{v:[0-9]+}`)`` (regex no prefixo) | ``PathPrefix(`/api`)`` ou ``PathRegexp(`^/api/[0-9]+`)`` | "`PathPrefix` **no longer uses regular expressions** to match path prefixes." |
| 3 | ``Path(`/products/{id}`)`` (placeholders) | ``PathRegexp(`^/products/[^/]+$`)`` | exemplo before/after literal da doc |
| 4 | Regex estilo `{name:regex}` | **Sintaxe regexp do Go** | "`HeaderRegexp`, `HostRegexp`, `PathRegexp`, `QueryRegexp`, and `HostSNIRegexp` matchers now uses the **Go regexp syntax**." |
| 5 | `HostHeader(...)` | `Host(...)` | "**`HostHeader` has been removed, use `Host` instead.**" |
| 6 | ``Host(`a.com`, `b.com`)`` (múltiplos valores) | ``Host(`a.com`) \|\| Host(`b.com`)`` | "**All matchers now take a single value** (except `Header`, `HeaderRegexp`, `Query`, and `QueryRegexp` which take two) and should be **explicitly combined using logical operators**." |
| 7 | — | Novos matchers v3: `PathRegexp`, `QueryRegexp` | "`QueryRegexp` … introduced to match query values using a regular expression" |
| 8 | — | 🚩 `ruleSyntax: v2` (modo compatibilidade) está **deprecated** e "will be removed in the next major version" |

**Exemplo comparativo para slides:**

```yaml
# ❌ v2 — NÃO usar
- "traefik.http.routers.app.rule=Host(`a.com`, `b.com`) && PathPrefix(`/api/{v:[0-9]+}`)"
- "traefik.http.routers.app.rule=Headers(`X-Env`, `prod`)"

# ✅ v3 — correto
- "traefik.http.routers.app.rule=(Host(`a.com`) || Host(`b.com`)) && PathRegexp(`^/api/[0-9]+`)"
- "traefik.http.routers.app.rule=Header(`X-Env`, `prod`)"
```

---

## B.5 EntryPoints e redirecionamento HTTP → HTTPS

Fonte: [EntryPoints](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/) — **configuração ESTÁTICA**

```yaml
# traefik.yml
entryPoints:
  web:
    address: :80
  websecure:
    address: :443
    http:
      tls: {}
```

### Forma 1 — redirecionamento no entryPoint (recomendada, global)

```yaml
entryPoints:
  web:
    address: :80
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
```
```bash
--entryPoints.web.address=:80
--entryPoints.web.http.redirections.entryPoint.to=websecure
--entryPoints.web.http.redirections.entryPoint.scheme=https
--entryPoints.web.http.redirections.entryPoint.permanent=true
```

Opções (verbatim):
- `to`: "The target element to enable (permanent) redirecting of all incoming requests on an entry point to another one. The target element can be an entry point name (ex: `websecure`), or a port (`:443`)."
- `scheme`: default `https`.
- `permanent`: default `true` → HTTP 301.

✅ Vantagem: vale para **todos** os routers; nenhum label necessário nos serviços.

### Forma 2 — middleware `redirectScheme` (por router, dinâmica)

```yaml
labels:
  - "traefik.http.middlewares.redirect-https.redirectscheme.scheme=https"
  - "traefik.http.middlewares.redirect-https.redirectscheme.permanent=true"
  # router HTTP que só redireciona
  - "traefik.http.routers.app-http.rule=Host(`exemplo.com.br`)"
  - "traefik.http.routers.app-http.entrypoints=web"
  - "traefik.http.routers.app-http.middlewares=redirect-https"
  # router HTTPS de verdade
  - "traefik.http.routers.app.rule=Host(`exemplo.com.br`)"
  - "traefik.http.routers.app.entrypoints=websecure"
  - "traefik.http.routers.app.tls.certresolver=le"
```

**Quando usar cada uma:** forma 1 para política global (mais simples, menos labels); forma 2 quando só alguns hosts devem redirecionar, ou quando o entryPoint `web` também precisa servir o desafio ACME HTTP-01 de forma seletiva.

⚠️ **Se usar a Forma 1 junto com `httpChallenge`**, o Traefik trata internamente o path `/.well-known/acme-challenge/` antes do redirecionamento — a combinação funciona.

---

## B.6 ACME / Let's Encrypt

Fonte: [ACME Certificates Resolver](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/) — **configuração ESTÁTICA**

### Exemplo básico (verbatim)

```yaml
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

certificatesResolvers:
  myresolver:
    acme:
      email: your-email@example.com
      storage: acme.json
      httpChallenge:
        # used during the challenge
        entryPoint: web
```
```bash
--certificatesresolvers.myresolver.acme.email=your-email@example.com
--certificatesresolvers.myresolver.acme.storage=acme.json
--certificatesresolvers.myresolver.acme.httpchallenge.entrypoint=web
```

### Opções (verbatim da tabela oficial)

| Opção | Descrição | Default | Obrigatória |
|---|---|---|---|
| `acme.email` | "Email address used for registration." | `""` | **Sim** |
| `acme.storage` | "File path used for certificates storage." | `"acme.json"` | **Sim** |
| `acme.caServer` | "CA server to use." | `https://acme-v02.api.letsencrypt.org/directory` | Não |
| `acme.caCertificates` | "Specify the paths to PEM encoded CA Certificates that can be used to authenticate an ACME server with an HTTPS certificate not issued by a CA in the system-wide trusted root list." | `[]` | Não |
| `acme.caServerName` | idem, para o nome do servidor | `""` | Não |
| `acme.caSystemCertPool` | "Defines if the certificates pool must use a copy of the system cert pool." | `false` | Não |
| `acme.keyType` | | `RSA4096` | Não |
| `acme.preferredChain` | cadeia preferida do CA | `""` | Não |
| `acme.certificatesDuration` | "The certificates' duration in hours, exclusively used to determine renewal dates." | `2160` (90 dias) | Não |
| `acme.eab.kid` / `acme.eab.hmacEncoded` | External Account Binding | `""` | Não |
| **`acme.httpChallenge.entryPoint`** | "EntryPoint to use for the HTTP-01 challenges. **Must be reachable by Let's Encrypt through port 80**" | `""` | **Sim** (se usar httpChallenge) |
| `acme.httpChallenge.delay` | atraso entre criação e validação do desafio | `0` | Não |
| **`acme.tlsChallenge`** | "Enable TLS-ALPN-01 challenge. **Traefik must be reachable by Let's Encrypt through port 443.**" | — | Não |
| **`acme.dnsChallenge.provider`** | "DNS provider to use." | `""` | Não |
| `acme.dnsChallenge.resolvers` | "DNS servers to resolve the FQDN authority." | `[]` | Não |
| `acme.dnsChallenge.propagation.delayBeforeChecks` | "By default, the provider will verify the TXT DNS challenge record before letting ACME verify. If `delayBeforeCheck` is greater than zero, this check is delayed for the configured duration in seconds. Useful if internal networks block external DNS queries." | `0s` | Não |
| `acme.dnsChallenge.propagation.disableChecks` | desativa checagem de propagação | `false` | Não |

### Os três desafios — quando usar cada um

| Desafio | Requisito de rede | Wildcard? |
|---|---|---|
| **HTTP-01** (`httpChallenge`) | porta **80** alcançável pela internet | ❌ |
| **TLS-ALPN-01** (`tlsChallenge: {}`) | porta **443** alcançável pela internet | ❌ |
| **DNS-01** (`dnsChallenge`) | credenciais do provedor DNS (via env vars) | ✅ **Único que emite wildcard** |

Verbatim: "As described in [Let's Encrypt's post](https://community.letsencrypt.org/t/staging-endpoint-for-acme-v2/49605) **wildcard certificates can only be generated through a `DNS-01` challenge**."

### Servidor de staging (para testes/aulas — **essencial**)

```yaml
certificatesResolvers:
  le:
    acme:
      caServer: https://acme-staging-v02.api.letsencrypt.org/directory
```
```bash
--certificatesresolvers.le.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory
```

✅ **Sempre use staging durante o curso.** O Let's Encrypt de produção tem *rate limits* rígidos (ex.: 5 falhas de validação por conta/host/hora, 50 certs por domínio registrado por semana). Alunos repetindo `up`/`down` esgotam a cota. Certificados de staging não são confiáveis pelo navegador (avisar; usar `curl -k`).

### Renovação automática

> "Traefik automatically tracks the expiry date of certificates it generates."
> "By default, Traefik manages **90-day certificates and starts renewing them 30 days before their expiry**."
> ⚠️ "Certificates that are no longer used may still be renewed, as Traefik does not currently check if the certificate is being used before renewing."

### ⚠️ `acme.json` e permissão 600 — SINALIZAÇÃO IMPORTANTE

**A página de referência v3.7 do ACME NÃO menciona a permissão `600`.** A única coisa documentada é `acme.storage` = caminho do arquivo.

Contudo, **o binário do Traefik recusa carregar o arquivo se as permissões forem mais abertas que `600`**, emitindo o erro (registrado em [traefik-helm-chart#164](https://github.com/traefik/traefik-helm-chart/issues/164)):

```
The ACME resolver "le" is skipped from the resolvers list because:
unable to get ACME account: permissions 660 for /data/acme.json are too open, please use 600
```

**Como ensinar honestamente:** "requisito enforçado em runtime pelo binário (mensagem de erro explícita); a documentação de referência v3 não o registra na tabela de opções."

**Duas abordagens práticas:**

```bash
# A) bind mount de arquivo — exige criar e ajustar antes de subir
touch acme.json && chmod 600 acme.json
```
```yaml
volumes:
  - ./acme.json:/acme.json
```

```yaml
# B) volume nomeado — RECOMENDADO em curso: o Traefik cria o arquivo
#    com as permissões corretas sozinho, eliminando a pegadinha do chmod
volumes:
  - letsencrypt:/letsencrypt
# e --certificatesresolvers.le.acme.storage=/letsencrypt/acme.json
```

⚠️ Outra armadilha: `docker compose down -v` **apaga o volume** e com ele todos os certificados → nova emissão → risco de rate limit.

---

## B.7 Dashboard

Fonte: [API & Dashboard](https://doc.traefik.io/traefik/reference/install-configuration/api-dashboard/)

### Habilitar

```yaml
api:
  dashboard: true
  insecure: false
```
```bash
--api.dashboard=true
--api.insecure=false
```

### 🚨 Por que NÃO usar `api.insecure` em produção

Verbatim da doc:
> "**Enabling the API and the dashboard in production is not recommended, because it will expose all configuration elements, including sensitive data, for which access should be reserved to administrators.**"
>
> Recomendação: "**NOT publicly exposing the API's port, keeping it restricted to internal networks**"

`--api.insecure=true` publica o dashboard **sem qualquer autenticação** num entryPoint interno chamado `traefik` (porta 8080). Qualquer um que alcance essa porta lê toda a configuração — incluindo nomes de serviços, redes internas e regras. **Só para laboratório local, nunca em servidor exposto.**

O guia oficial de setup Docker reforça: "The `--api.insecure=false` flag is used to secure the API and prevent the dashboard from being exposed on port 8080."

### Forma correta: router + TLS + basicAuth

Acesso em `/dashboard/` — **a barra final é obrigatória**; `/` redireciona para `/dashboard/`.

Configuração dinâmica (arquivo):
```yaml
http:
  routers:
    dashboard:
      rule: "Host(`traefik.exemplo.com.br`) && (PathPrefix(`/api`) || PathPrefix(`/dashboard`))"
      service: api@internal
      middlewares:
        - auth
  middlewares:
    auth:
      basicAuth:
        users:
          - "test:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/"
```

Por labels Docker (exemplo verbatim do guia oficial de setup):
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.dashboard.rule=Host(`dashboard.docker.localhost`)"
  - "traefik.http.routers.dashboard.entrypoints=websecure"
  - "traefik.http.routers.dashboard.service=api@internal"
  - "traefik.http.routers.dashboard.tls=true"
  - "traefik.http.middlewares.dashboard-auth.basicauth.users=<PASTE_HASH_HERE>"
  - "traefik.http.routers.dashboard.middlewares=dashboard-auth@docker"
```

Notas: `api@internal` é o service interno (o sufixo `@internal` identifica o provider). O sufixo `@docker` no middleware é opcional dentro do mesmo provider, mas explícito é mais claro didaticamente. **O caractere `@` é proibido em nomes de routers, services e middlewares** que você mesmo cria.

---

## B.8 Exemplo COMPLETO — Traefik v3 + 2 serviços web + rede + HTTPS

✅ **Este arquivo foi validado com `docker compose config` (Compose v5.1.3) e passou sem erros nem warnings.** Credenciais e domínios são fictícios.

```yaml
# compose.yaml
name: curso-traefik

services:
  traefik:
    image: traefik:v3.7
    container_name: traefik
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true

    # ---------- CONFIGURAÇÃO ESTÁTICA (via CLI) ----------
    command:
      # API e Dashboard
      - "--api.dashboard=true"
      - "--api.insecure=false"          # NUNCA true em produção

      # Provider Docker
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"   # opt-in explícito
      - "--providers.docker.network=web"

      # EntryPoints + redirect HTTP->HTTPS global (Forma 1)
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--entrypoints.web.http.redirections.entrypoint.permanent=true"
      - "--entrypoints.websecure.address=:443"

      # ACME / Let's Encrypt (HTTP-01) — STAGING para aulas
      - "--certificatesresolvers.le.acme.email=admin@exemplo.com.br"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory"
      # ^^^ REMOVER esta linha para emitir certificados de PRODUÇÃO

      # Observabilidade
      - "--log.level=INFO"
      - "--accesslog=true"

    ports:
      - "80:80"
      - "443:443"

    volumes:
      # :ro reduz (não elimina) o risco — ver Security Note da doc
      - /var/run/docker.sock:/var/run/docker.sock:ro
      # volume nomeado: o Traefik cria acme.json com permissão 600 sozinho
      - letsencrypt:/letsencrypt

    networks:
      - web

    healthcheck:
      test: ["CMD", "traefik", "healthcheck", "--ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s

    # ---------- CONFIGURAÇÃO DINÂMICA (labels) ----------
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.exemplo.com.br`)"
      - "traefik.http.routers.dashboard.entrypoints=websecure"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.tls=true"
      - "traefik.http.routers.dashboard.tls.certresolver=le"
      - "traefik.http.routers.dashboard.middlewares=dashboard-auth@docker"
      # admin / senha-fake-123  — gerar com:
      #   htpasswd -nb admin 'senha' | sed -e 's/\$/\$\$/g'
      - "traefik.http.middlewares.dashboard-auth.basicauth.users=admin:$$apr1$$H6uskkkW$$IgXLP6ewTrSuBkTrqE8wj/"

  # ---------- SERVIÇO 1: site institucional ----------
  site:
    image: traefik/whoami:v1.10
    container_name: site
    restart: unless-stopped
    networks:
      - web
    labels:
      - "traefik.enable=true"
      # v3: um valor por matcher, combinados com ||
      - "traefik.http.routers.site.rule=Host(`exemplo.com.br`) || Host(`www.exemplo.com.br`)"
      - "traefik.http.routers.site.entrypoints=websecure"
      - "traefik.http.routers.site.tls=true"
      - "traefik.http.routers.site.tls.certresolver=le"
      - "traefik.http.routers.site.middlewares=sec-headers@docker"
      - "traefik.http.services.site.loadbalancer.server.port=80"
      # middleware de cabeçalhos de segurança
      - "traefik.http.middlewares.sec-headers.headers.stsseconds=31536000"
      - "traefik.http.middlewares.sec-headers.headers.framedeny=true"
      - "traefik.http.middlewares.sec-headers.headers.contenttypenosniff=true"

  # ---------- SERVIÇO 2: API sob /api ----------
  api:
    image: traefik/whoami:v1.10
    container_name: api
    restart: unless-stopped
    networks:
      - web
    environment:
      WHOAMI_PORT_NUMBER: "8080"
    labels:
      - "traefik.enable=true"
      # && em v3; priority alta para vencer o router "site" no mesmo host
      - "traefik.http.routers.api.rule=Host(`exemplo.com.br`) && PathPrefix(`/api`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.priority=100"
      - "traefik.http.routers.api.tls=true"
      - "traefik.http.routers.api.tls.certresolver=le"
      - "traefik.http.routers.api.middlewares=api-strip@docker,api-ratelimit@docker"
      - "traefik.http.services.api.loadbalancer.server.port=8080"
      # remove /api antes de repassar ao backend
      - "traefik.http.middlewares.api-strip.stripprefix.prefixes=/api"
      # 100 req/s em média, burst de 200
      - "traefik.http.middlewares.api-ratelimit.ratelimit.average=100"
      - "traefik.http.middlewares.api-ratelimit.ratelimit.burst=200"
      - "traefik.http.middlewares.api-ratelimit.ratelimit.period=1s"

networks:
  web:
    name: web

volumes:
  letsencrypt:
```

**Pontos didáticos deste arquivo:**
1. **Sem `version:`** — obsoleto.
2. `name:` define o nome do projeto (evita depender do nome da pasta).
3. Todo `command:` é **configuração estática**; todo `labels:` é **dinâmica**.
4. `exposedByDefault=false` + `traefik.enable=true` em cada serviço = opt-in explícito.
5. Redirect HTTP→HTTPS feito **uma vez** no entryPoint, não repetido por serviço.
6. Sintaxe v3 pura: `||`, `&&`, backticks, um valor por matcher.
7. `priority=100` no router `api` — sem isso, a prioridade é o comprimento da regra e a ordem entre `site` e `api` fica implícita.
8. `loadbalancer.server.port` explícito nos dois serviços — previne o 502.
9. `$$` no hash do BasicAuth.
10. `caserver` de staging — trocar só ao ir para produção.

**Comandos de aula:**
```bash
docker compose config          # valida e mostra o YAML final
docker compose up -d
docker compose logs -f traefik
docker compose ps
curl -k -H "Host: exemplo.com.br" https://localhost/
docker compose down            # mantém o volume letsencrypt
docker compose down -v         # ⚠️ APAGA os certificados
```

---

# APÊNDICE — Checklist de erros a demonstrar em aula

| Sintoma | Causa provável |
|---|---|
| `version is obsolete` | chave `version:` no topo — remover |
| Serviço não aparece no dashboard | falta `traefik.enable=true` com `exposedByDefault=false` |
| **404 page not found** | regra não casa (host errado, DNS não resolve) ou router em entryPoint diferente |
| **502 Bad Gateway** | falta `loadbalancer.server.port`, ou serviços em redes Docker diferentes |
| Traefik pega a rede errada | contêiner em várias redes → definir `providers.docker.network` ou `traefik.docker.network` |
| BasicAuth sempre rejeita | `$` não duplicado no hash dentro do compose.yaml |
| `ACME resolver skipped ... too open, please use 600` | permissão do `acme.json` |
| `too many failed authorizations` (Let's Encrypt) | esqueceu o `caServer` de staging durante os testes |
| Erro de sintaxe YAML incompreensível | TAB no lugar de espaço |
| Container recebe `DEBUG=false` sendo que escrevi `no` | booleano YAML implícito — usar aspas |
| Porta publicada errada | `22:22` sem aspas → sexagesimal |
| Mudança no compose.yaml não aplicada | usou `restart` em vez de `up -d` |
| Serviço sobe antes do banco estar pronto | `depends_on` curto não espera prontidão — usar `condition: service_healthy` |

---

## Fontes

**Docker Compose**
- [Compose file reference](https://docs.docker.com/reference/compose-file/)
- [Compose application model](https://docs.docker.com/compose/intro/compose-application-model/)
- [Version and name top-level elements](https://docs.docker.com/reference/compose-file/version-and-name/)
- [Legacy versions](https://docs.docker.com/reference/compose-file/legacy-versions/)
- [Services top-level element](https://docs.docker.com/reference/compose-file/services/)
- [Networks](https://docs.docker.com/reference/compose-file/networks/) · [Volumes](https://docs.docker.com/reference/compose-file/volumes/) · [Configs](https://docs.docker.com/reference/compose-file/configs/) · [Secrets](https://docs.docker.com/reference/compose-file/secrets/)
- [Include](https://docs.docker.com/reference/compose-file/include/) · [Merge](https://docs.docker.com/reference/compose-file/merge/) · [Fragments](https://docs.docker.com/reference/compose-file/fragments/) · [Profiles](https://docs.docker.com/reference/compose-file/profiles/) · [Develop](https://docs.docker.com/reference/compose-file/develop/) · [Deploy](https://docs.docker.com/reference/compose-file/deploy/)
- [Interpolation](https://docs.docker.com/reference/compose-file/interpolation/)
- [Variable interpolation (.env)](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Environment variables precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)
- [Extend your Compose file](https://docs.docker.com/compose/how-tos/multiple-compose-files/extends/)
- [History and development of Docker Compose](https://docs.docker.com/compose/intro/history/) · [Migrate to Compose V2](https://docs.docker.com/compose/releases/migrate/) · [FAQ](https://docs.docker.com/compose/support-and-feedback/faq/) · [Deprecated and retired features](https://docs.docker.com/retired/)
- [docker compose CLI](https://docs.docker.com/reference/cli/docker/compose/) · [up](https://docs.docker.com/reference/cli/docker/compose/up/) · [down](https://docs.docker.com/reference/cli/docker/compose/down/)
- [Compose Specification — deploy.md](https://github.com/compose-spec/compose-spec/blob/main/deploy.md) · [Releases do docker/compose](https://github.com/docker/compose/releases)

**Traefik v3.7**
- [Traefik docs (index)](https://doc.traefik.io/traefik/) · [Configuration Introduction](https://doc.traefik.io/traefik/getting-started/configuration-overview/) · [Setup Traefik in Docker](https://doc.traefik.io/traefik/setup/docker/)
- [Docker provider — install configuration](https://doc.traefik.io/traefik/reference/install-configuration/providers/docker/)
- [Traefik & Docker routing (labels)](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/docker/)
- [HTTP Routers — Rules & Priority](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/)
- [Migrate v2 → v3](https://doc.traefik.io/traefik/migrate/v2-to-v3/) · [Configuration changes for v3](https://doc.traefik.io/traefik/migrate/v2-to-v3-details/)
- [EntryPoints](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/)
- [ACME Certificates Resolver](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/)
- [API & Dashboard](https://doc.traefik.io/traefik/reference/install-configuration/api-dashboard/)
- Middlewares: [overview](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/overview/) · [basicAuth](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/basicauth/) · [redirectScheme](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/redirectscheme/) · [stripPrefix](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/stripprefix/) · [rateLimit](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/ratelimit/) · [headers](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/)
- [traefik-helm-chart#164 — erro de permissão do acme.json](https://github.com/traefik/traefik-helm-chart/issues/164)