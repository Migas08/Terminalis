# Fluxo Git do Terminalis

Este documento mantém o histórico legível e evita branches antigas acumuladas no repositório.

## Branch principal

- `main` deve permanecer publicável e passar pelo workflow `Terminalis CI`.
- Mudanças entram por pull request; não reescreva o histórico público de `main`.
- Use squash merge e apague a branch remota depois que o PR for incorporado.

## Nomes de branches

Crie branches curtas a partir da `main` atualizada:

| Tipo | Prefixo | Exemplo |
|---|---|---|
| Funcionalidade | `feat/` | `feat/editor-js-busca` |
| Correção | `fix/` | `fix/js-workspace-sync` |
| Documentação | `docs/` | `docs/setup-supabase` |
| Testes | `test/` | `test/conflito-workspace` |
| Refatoração | `refactor/` | `refactor/storage-provider` |
| Manutenção | `chore/` | `chore/update-playwright` |

Branches criadas pelo Codex mantêm o prefixo obrigatório `codex/`, seguido de um nome descritivo.

## Commits

Prefira commits pequenos, coerentes e no imperativo. O assunto deve explicar o resultado, por exemplo:

```text
fix: sincroniza alterações do editor JavaScript
test: cobre remoção de módulo entre execuções
docs: documenta fluxo de contribuição
```

Não misture formatação geral, conteúdo de curso e correção funcional sem necessidade. Nunca inclua `config.local.js`, chaves privadas ou a chave `service_role` do Supabase.

## Antes de abrir o PR

```sh
npm ci
npm run lint
npm run format:check
npm run build
npm run check:dist
npm test
npm run test:browser
```

Confirme também que `git status --short` mostra somente arquivos intencionais. Se `src/` mudou, o bundle `dist/terminalis.html` deve acompanhar a alteração.

## Revisão e merge

O PR deve registrar:

- o problema e a solução;
- o risco ou impacto de compatibilidade;
- os testes executados;
- mudanças de banco ou configuração, quando existirem.

Depois do merge, remova a branch remota. Branches ainda abertas, não incorporadas ou com trabalho exclusivo nunca devem ser apagadas durante uma limpeza.
