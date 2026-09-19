# Terminalis V2 — plano técnico de evolução

## Decisão arquitetural

A V2 continuará sendo uma aplicação web estática, distribuída como um HTML único, e reutilizará os motores já existentes. O novo produto será uma camada de desafios orientada a dados sobre o laboratório atual; não haverá uma segunda implementação de Linux, Docker ou Git.

O acervo de aulas continuará disponível como documentação e apoio contextual. Ele deixa de ser a rota principal, mas seus textos, exemplos e referências podem ser ligados a desafios por `referenceLessonIds`.

## Inventário atual

| Capacidade existente | Estado | Uso na V2 |
|---|---|---|
| VFS, shell, processos, serviços e rede | Maduro e testado | Ambiente dos desafios de comando e incidentes |
| Docker, Compose, SQL e Traefik simulados | Maduro e testado | Ambientes Docker, configuração e troubleshooting |
| Git e GitHub simulados | Implementado | Desafios de fluxo, conflitos e colaboração |
| Verificadores por estado real | Implementado em `LX.H` e nas aulas | Critério de sucesso independente do comando exato |
| Terminal, editor e navegador de arquivos | Implementados | Workspace do desafio |
| Catálogo editorial | Centenas de aulas em dados JavaScript | Documentação opcional e fonte de migração gradual |
| Autenticação local | Implementada | Fallback de desenvolvimento e uso offline |
| Supabase Auth, RLS e sincronização | Implementados de forma opcional | Identidade, progresso, perfil e workspace em produção |
| Progresso atual | Aula/tarefa por usuário | Mantido e migrado sem perda; não será convertido em XP automaticamente |
| UI | Dark, monocromática e responsiva | Identidade preservada; navegação e hierarquia serão reformuladas |

O acoplamento principal está em `LX.App`: a rota, a home e a conclusão são centradas em aulas. A regra editorial de “três tarefas por aula” também está codificada em testes. A V2 deve acrescentar um domínio paralelo de desafios antes de migrar ou remover qualquer regra antiga.

## Domínios da V2

### Tecnologia

`Technology` descreve uma área extensível: `id`, `slug`, `name`, `description`, `icon`, `status` e ordenação. O contador de desafios é derivado do catálogo, não armazenado.

### Desafio

`Challenge` é registrado como dado e validado ao iniciar a aplicação:

- identidade: `id`, `slug`, `title`, `summary`;
- descoberta: `technology`, `difficulty`, `type`, `xp`, `tags`;
- experiência: `situation`, `objectives`, `hints`, `concepts`, `extraChallenge`;
- laboratório: `environment`, `setup(context)` e `validate(context)`;
- encerramento: `explanation`, `possibleSolution`, `alternatives`;
- apoio: `referenceLessonIds`;
- publicação: `status`, `version` e pré-requisitos opcionais.

O callback de validação inspeciona o estado da máquina simulada. Ele não exige uma sequência literal de comandos quando mais de uma solução é válida.

### Tentativa e conclusão

Uma tentativa registra início, término, duração, comandos executados, número de validações e dicas abertas. O progresso local é compatível com contas existentes e fica em novos campos (`challengeProgress`, `challengeCompletions`, `favorites` e `v2`).

Em modo local, a concessão de XP é apenas educacional. Em produção, o cliente envia evidências da conclusão e uma função autoritativa concede XP, badges e atividade em uma transação idempotente. O frontend nunca escreve diretamente no total de XP.

### Progressão

O XP global é a soma de concessões imutáveis. Os níveis usam uma curva explícita e versionada, com crescimento progressivo; não são salvos como um número editável. XP por tecnologia é agregado das mesmas concessões.

Badges são definidos em catálogo e conquistados por regras avaliadas no backend. O destaque de até seis badges é uma preferência do perfil e só pode referenciar badges já conquistados.

## Persistência e segurança

A evolução do schema Supabase será aditiva. As tabelas propostas são:

- `public_profiles`: somente campos públicos, com username único, bio e links validados;
- `challenge_attempts`: tentativas do próprio usuário, métricas e evidências limitadas;
- `challenge_completions`: uma conclusão premiada por usuário/desafio/versão;
- `xp_ledger`: razão imutável de cada concessão de XP;
- `badge_awards`: conquistas únicas e data de concessão;
- `featured_badges`: seleção e ordem públicas;
- `challenge_favorites`: relação privada do usuário;
- `public_activity`: eventos explicitamente públicos e sem email ou dados do workspace.

Regras obrigatórias:

1. RLS restringe tentativas, favoritos e dados privados ao proprietário.
2. Perfis públicos expõem uma view/lista de colunas permitidas, nunca `auth.users`.
3. `xp_ledger`, `challenge_completions` e `badge_awards` não aceitam inserção direta do cliente.
4. Uma função `SECURITY DEFINER`, com `search_path` fixo e entradas validadas, realiza conclusão idempotente e concessões.
5. Avatar e banner ficam em buckets separados, com MIME permitido, limite de bytes, chave prefixada pelo `auth.uid()` e substituição controlada.
6. A validação local melhora a UX, mas não substitui a validação autoritativa para ranking, perfil público ou recompensas.

Até esse backend existir, a UI identifica progresso local como tal e não publica ranking nem afirma que XP local é inviolável.

## Compatibilidade e migração

- Contas, sessões, notas, aulas, tarefas e workspaces atuais permanecem válidos.
- O codec de workspace continuará versionado; mudanças serão aditivas.
- A home V2 passa a priorizar desafios. “Biblioteca” mantém o acesso aos cursos existentes.
- Conclusões antigas não geram XP retroativo automaticamente, evitando premiação sem uma política revisada.
- Desafios podem apontar para aulas existentes em “Entender melhor”.
- Remoções só ocorrerão depois de telemetria/testes confirmarem que não há dependências.

## Sequência incremental

### Fase 1 — fundação

1. Catálogo e validação de tecnologias/desafios.
2. Modelo compatível de tentativas e métricas locais.
3. Testes do catálogo, progressão e idempotência.

### Fase 2 — experiência principal

1. Página de exploração com pesquisa e filtros.
2. Página de desafio com situação, objetivos e laboratório.
3. Dicas progressivas, modo realista, validação e debriefing.
4. Favoritos e retomada de tentativa.

### Fase 3 — dashboard e progressão

1. Home focada em continuar, recomendados e desafio diário.
2. XP e níveis calculados por ledger local/servidor.
3. Progresso por tecnologia e estatísticas profissionais.

### Fase 4 — badges e perfil

1. Catálogo e regras de badges.
2. Perfil privado editável e perfil público seguro.
3. Badges em destaque e atividade pública.
4. Avatar/banner com Storage e validação ponta a ponta.

### Fase 5 — conteúdo

Migração gradual de Linux, Docker e Git para cenários. JavaScript e TypeScript entram somente depois de existir um runner isolado e verificável; o executor reduzido das imagens Docker não é uma sandbox para código arbitrário.

## Critérios de qualidade por incremento

Cada commit funcional precisa manter:

- sintaxe de todos os módulos;
- testes de motor e conteúdo existentes;
- testes novos do domínio V2;
- build do HTML único;
- smoke test de autenticação e isolamento de progresso;
- verificação visual desktop e mobile das rotas alteradas;
- ausência de escrita direta de XP/badges em fluxos conectados ao Supabase.

## Primeira fatia vertical

A primeira entrega funcional contém catálogo extensível, exploração, página de desafio, dicas progressivas, modo realista, conclusão por estado, métricas, favoritos, XP/nível local claramente identificado e desafios iniciais de Linux. Ela prova o novo fluxo sem apagar o curso atual e estabelece os contratos necessários para o backend autoritativo.
