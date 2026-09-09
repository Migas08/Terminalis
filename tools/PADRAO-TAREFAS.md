# Padrão de tarefas do Terminalis

Toda aula do curso tem **exatamente três tarefas, nesta ordem**:

1. `kind: 'guiado'` — rode estes comandos e leia a saída.
2. `kind: 'quiz'` (ou `kind: 'fill'`) — uma pergunta sobre o que a aula explicou.
3. `kind: 'desafio'` — um exercício prático, verificado pelo estado real da máquina.

O arquivo `test/estrutura.js` reprova qualquer aula fora disso.

## Regra de ouro do conteúdo (a mais importante)

**Um exercício só pode exigir o que a aula — ou uma aula anterior — já ensinou.**
Nada de "descubra sozinho um comando novo", nada de comando que aparece pela
primeira vez na solução. Se o exercício precisa de uma ferramenta nova, ou você
a apresenta no corpo da aula, ou muda o exercício.

O teste `test/vocabulario.js` verifica isso automaticamente: ele monta o
vocabulário acumulado (comandos que apareceram em blocos `code`, em trechos
`<code>` de texto, tabelas, caixas, enunciados e dicas) e reprova a solução
oficial que usar um comando que nunca apareceu antes.

O texto em português do Brasil, tom direto, sem emoji, sem "vamos lá".

## Formato de um arquivo de conteúdo

```js
LX.lesson('<idDoModulo>', {
  id: 'l1-1', n: '1.1', title: '...',
  goal: '...',
  setup: (m, term) => { /* opcional, NÍVEL DE AULA (nunca dentro de uma tarefa) */ },
  body: [ /* blocos */ ],
  tasks: [ /* guiado, pergunta, prática */ ]
});
```

### Blocos de corpo aceitos

`{ h2 }` `{ h4 }` `{ p }` `{ ul: [] }` `{ ol: [] }` `{ ascii }`
`{ code: ['linha', ...], run: true|false, lang: 'bash'|'yaml'|'text'|'dockerfile' }`
`{ table: { head: [], rows: [[], []] } }`
`{ box: 'key'|'note'|'warn', label: '...', body: [ ...blocos... ] }`

Dentro de textos vale HTML simples: `<code>`, `<strong>`, `<em>`.

## As três tarefas

### 1. Guiado

```js
{
  id: 't1-1-a', kind: 'guiado', title: 'Título curto e concreto',
  body: [
    { p: 'Uma frase dizendo o que observar.' },
    { code: ['$ comando um', '$ comando dois'] },
    { p: 'Uma frase apontando o que a saída mostra.' }
  ],
  hints: ['Clique no botão <em>rodar</em> ao lado do bloco de código.'],
  check: async (ctx) => LX.H.checkAll([
    [() => H.usedCommand(ctx, /\bcomando\b/), 'Rode <code>comando um</code> no terminal.'],
    [() => H.usedCommand(ctx, /outro/), 'Rode <code>comando dois</code>.']
  ])
}
```

O guiado **não** tem `solution` (não precisa: o enunciado já traz os comandos).
Ele verifica só que o aluno rodou os comandos, com `H.usedCommand`.

### 2. Pergunta (quiz)

```js
{
  id: 't1-1-q', kind: 'quiz', title: 'Título que é a própria dúvida',
  body: [{ p: 'A situação, curta e concreta.' }],
  options: [
    { text: 'A alternativa certa, com o porquê embutido.', correct: true },
    { text: 'Uma errada plausível.', why: 'Por que não é essa — sem ironia, explicando o engano.' },
    { text: 'Outra errada plausível.', why: '...' },
    { text: 'Mais uma.', why: '...' }
  ],
  hints: ['Uma pista que reformula a pergunta, sem entregar.'],
  solution: 'A resposta explicada em uma ou duas frases, com <code>exemplo</code>.'
}
```

Regras: 3 a 5 alternativas, **exatamente uma** `correct: true`, e **toda**
alternativa errada precisa de `why`. As erradas têm que ser erros que alguém
comete de verdade, não absurdos.

### 3. Prática (desafio)

```js
{
  id: 't1-1-b', kind: 'desafio', title: 'O que se quer, em uma frase',
  body: [
    { p: 'O enunciado. Diga o resultado esperado, não o comando.' }
  ],
  hints: [
    'Dica 1: reorienta, não entrega.',
    'Dica 2: entrega a forma do comando, ainda sem os valores do exercício.'
  ],
  solution: '<pre>$ comando um\n$ comando dois</pre>',
  check: async (ctx) => LX.H.checkAll([
    [() => cond1, 'mensagem que diz o que falta'],
    [() => cond2, () => `mensagem lenta, calculada só se a anterior passou`]
  ])
}
```

Obrigatórios: `hints` (pelo menos 1), `solution`, `check`.

## Como escrever o `check`

`LX.H.checkAll([[condição, mensagem], ...])` devolve `{ok, msg}` na primeira que
falhar. Condição e mensagem podem ser funções (avaliação preguiçosa — use
funções sempre que a mensagem depender de algo que pode ser nulo).

Auxiliares em `LX.H` (Linux):
`exists(ctx,p)` `stat` `lstat` `isDir` `isFile` `read(ctx,p)` `mode` `owner`
`ls` `du` `history` `usedCommand(ctx, regex)` `checkAll`

Auxiliares em `LX.D` (Docker):
`container(ctx,nome)` `rodando` `containers` `porImagem` `logs` `env`
`publicada(ctx,nome,porta)` `montagem(ctx,nome,destino)` `naRede`
`leNoContainer` `existeNoContainer` `exec(ctx,nome,linha)` (async)
`imagem(ctx,ref)` `volume` `rede` `noVolume` `http(ctx,host,porta,caminho,cabecalhos)`
`saude` (async) `doProjeto(ctx,projeto,servico)` `compose(ctx,caminho)`
`dockerfile` `instrucao` `montar(m,spec)` `garantirRede(m,nome)` `limparTudo(m)`
`arquivo(m,caminho,conteudo,modo)` `pasta(m,caminho)`

`ctx` traz `{ machine, sh, term, app }`. O caminho da casa do aluno é
`/home/aluno`.

## O que o `test/solutions.js` exige de cada prática

1. A **solução oficial**, executada linha a linha, tem que fazer o `check` aprovar.
2. O `check` tem que **reprovar** um ambiente intocado (senão o desafio "aprova
   sem o aluno fazer nada").
3. O `check` não pode estourar exceção em ambiente vazio — proteja com funções
   preguiçosas e `|| ''`.

Cuidados com a `solution`:

- O `<pre>` é **executado linha a linha**. Não escreva linhas de saída dentro
  dele (elas viram comandos e quebram). Se quiser mostrar saída, ponha fora do
  `<pre>`, em um `<p>`.
- Linhas podem começar com `$ ` (é removido antes de executar).
- Heredoc (`cat > x <<'EOF' ... EOF`) funciona e é preservado.
- Use `&gt;` `&lt;` `&amp;` no HTML.

## Cuidado recorrente

`setup` é propriedade **da aula**, nunca de uma tarefa. Um `setup` dentro de um
objeto de tarefa jamais é executado.

## Como validar o que você escreveu

```
node --check src/<seu-arquivo>.js      # sintaxe
node tools/checar-aula.js <idDaAula>   # estrutura + solução + rejeição do vazio
```
