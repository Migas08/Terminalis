# Documentação do Terminalis

A documentação do repositório é separada por responsabilidade para manter a raiz enxuta e facilitar a navegação.

## Arquitetura

- [Arquitetura do sistema](architecture/ARQUITETURA.md)

## Desenvolvimento

- [Fluxo Git e convenções](development/GIT-WORKFLOW.md)
- [Padrão de tarefas e conteúdo](development/PADRAO-TAREFAS.md)

## Currículo

- [Currículo JavaScript](curriculum/CURRICULO-JAVASCRIPT.md)

## Projeto

- [Contexto geral para IA](project/PROJECT_CONTEXT_TERMINALIS.md)
- [Contexto de projeto para Claude](project/CONTEXTO-PROJETO-CLAUDE.md)
- [Briefing JavaScript e TypeScript](project/BRIEFING-IMPLEMENTACAO-JS-TS-CLAUDE.md)
- [Plano Terminalis V2](project/TERMINALIS_V2_PLANO.md)

## Pesquisa

- [Compose e Traefik](research/pesquisa-compose-traefik.md)
- [JavaScript](research/pesquisa-javascript.txt)
- [TypeScript](research/pesquisa-typescript.txt)
- [Proposta inicial das trilhas JS/TS](research/proposta-inicial-trilhas-js-ts.txt)

## Banco de dados

O schema de produção do Supabase fica fora de `docs/`, em [`database/supabase/schema.sql`](../database/supabase/schema.sql).

## Estrutura de código

O diretório `src/` mantém prefixos numéricos porque a ordem dos módulos faz parte do contrato de build. Ele não deve ser reorganizado em subpastas sem atualizar o carregamento, os testes e o processo de build em conjunto.

Ferramentas executáveis e scripts auxiliares permanecem em `tools/`; documentação de processo fica em `docs/development/`.
