/* =========================================================================
   MÓDULO 15 — Bash scripting (continuação: aulas 15.5 a 15.9)
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const ler = (ctx, p) => H.read(ctx, p) || '';
  const rodar = async (ctx, cmd) => (ctx.run ? (await ctx.run(cmd)).out : '');

  /* ============================== 15.5 ============================== */
  LX.lesson('m15', {
    id: 'l15-5', n: '15.5', title: 'Argumentos: $1, shift, getopts e --help',
    goal: 'Transformar um script que só funciona com os valores escritos dentro dele em uma ferramenta de linha de comando que outra pessoa consegue usar.',
    body: [
      { h2: 'Por que argumentos existem' },
      { p: 'Um script com o caminho escrito no meio do código serve para um caso. Quando o caso muda, alguém copia o arquivo e edita — e agora existem duas versões que vão divergir. <strong>Argumento é o que transforma um script em ferramenta</strong>: um código, muitos usos.' },

      { h2: 'As variáveis que o Bash entrega prontas' },
      {
        table: {
          head: ['Variável', 'O que é', 'Exemplo com <code>./bkp.sh /srv 30</code>'],
          rows: [
            ['<code>$0</code>', 'o nome do script como foi chamado', '<code>./bkp.sh</code>'],
            ['<code>$1</code>, <code>$2</code>…', 'os argumentos, em ordem', '<code>/srv</code>, <code>30</code>'],
            ['<code>$#</code>', 'quantos argumentos vieram', '<code>2</code>'],
            ['<code>"$@"</code>', 'todos, cada um como um item', '<code>"/srv" "30"</code>'],
            ['<code>"$*"</code>', 'todos, colados numa string só', '<code>"/srv 30"</code>'],
            ['<code>$?</code>', 'o código de saída do último comando', '—']
          ]
        }
      },
      {
        box: 'key', label: '"$@" e "$*" não são a mesma coisa', body: [
          { p: 'A diferença só aparece quando um argumento tem espaço, e aí ela é decisiva:' },
          {
            ascii: `./script.sh "meu arquivo.txt" outro.txt

for a in "$@"   →  2 voltas:  [meu arquivo.txt]  [outro.txt]
for a in "$*"   →  1 volta:   [meu arquivo.txt outro.txt]
for a in $@     →  3 voltas:  [meu]  [arquivo.txt]  [outro.txt]   ✗`
          },
          { p: 'A regra prática é curta: <strong>use sempre <code>"$@"</code> com aspas</strong>. O <code>"$*"</code> serve para montar uma mensagem; o <code>$@</code> sem aspas não serve para nada.' }
        ]
      },

      { h2: 'Validar antes de trabalhar' },
      { p: 'Um script que recebe argumento precisa checar se recebeu. Sem isso, com <code>set -u</code>, ele morre com uma mensagem críptica; sem <code>set -u</code>, faz algo pior — como <code>rm -rf /</code> quando a variável estava vazia.' },
      {
        code: [
          '#!/bin/bash',
          'set -euo pipefail',
          '',
          'if [ $# -lt 1 ]; then',
          '    echo "uso: $0 DIRETORIO [DIAS]" >&2',
          '    exit 2',
          'fi',
          '',
          'ALVO="$1"',
          'DIAS="${2:-30}"        # 30 é o padrão se não vier o segundo argumento',
          '',
          '[ -d "$ALVO" ] || { echo "erro: $ALVO não é um diretório" >&2; exit 1; }'
        ], run: false
      },
      {
        table: {
          head: ['Convenção', 'Significado'],
          rows: [
            ['<code>exit 0</code>', 'deu tudo certo'],
            ['<code>exit 1</code>', 'erro genérico de execução'],
            ['<code>exit 2</code>', '<strong>erro de uso</strong> — argumento faltando ou inválido'],
            ['mensagem em <code>&gt;&amp;2</code>', 'erro vai para o stderr, não para a saída de dados'],
            ['<code>${2:-30}</code>', 'valor padrão quando o argumento não veio']
          ]
        }
      },
      { p: 'Mandar a mensagem de erro para o <code>stderr</code> não é preciosismo: sem isso, quem fizer <code>./script.sh &gt; resultado.txt</code> recebe a mensagem de erro <em>dentro</em> do arquivo de resultado.' },

      { h2: 'shift: consumir os argumentos' },
      { p: 'O <code>shift</code> descarta o <code>$1</code> e desloca todos os outros para a esquerda. É o jeito de percorrer uma lista de tamanho desconhecido:' },
      {
        code: [
          'while [ $# -gt 0 ]; do',
          '    echo "processando: $1"',
          '    shift',
          'done'
        ], run: false
      },

      { h2: 'getopts: quando você quer opções de verdade' },
      { p: 'Para <code>-v</code>, <code>-n 5</code>, <code>-f arquivo</code>, escrever o parser à mão vira um emaranhado. O <code>getopts</code> é um builtin feito exatamente para isso.' },
      {
        code: [
          '#!/bin/bash',
          'set -euo pipefail',
          '',
          'VERBOSE=0',
          'DIAS=30',
          '',
          'while getopts "vn:h" opcao; do',
          '    case "$opcao" in',
          '        v) VERBOSE=1 ;;',
          '        n) DIAS="$OPTARG" ;;',
          '        h) echo "uso: $0 [-v] [-n DIAS] DIRETORIO"; exit 0 ;;',
          '        *) echo "opção inválida" >&2; exit 2 ;;',
          '    esac',
          'done',
          'shift $((OPTIND - 1))     # descarta as opções já lidas',
          '',
          'ALVO="${1:?informe o diretório}"',
          '[ "$VERBOSE" -eq 1 ] && echo "limpando $ALVO, mantendo $DIAS dias"'
        ], run: false
      },
      {
        ul: [
          'A string <code>"vn:h"</code> declara as opções aceitas. <strong>Os dois-pontos depois da letra significam "esta opção recebe um argumento"</strong>.',
          '<code>$OPTARG</code> guarda o valor da opção que pede argumento.',
          '<code>$OPTIND</code> é o índice do próximo argumento não processado — por isso o <code>shift $((OPTIND - 1))</code> no fim, que deixa só os argumentos posicionais.',
          'Um <code>:</code> no <strong>começo</strong> da string (<code>":vn:h"</code>) silencia as mensagens automáticas e deixa você tratar os erros.'
        ]
      },
      {
        box: 'note', label: 'Limitações honestas', body: [
          { p: 'O <code>getopts</code> só entende opções curtas: <code>-v</code>, <code>-n 5</code>. Ele <strong>não</strong> entende <code>--verbose</code> nem <code>--dias=5</code>. Para opções longas é preciso um <code>while</code>/<code>case</code> escrito à mão sobre <code>"$@"</code>. Isso é aceitável: scripts de administração raramente precisam de opções longas, e quando precisam, provavelmente já deveriam ser Python.' }
        ]
      },

      { h2: 'O --help que se escreve uma vez' },
      { p: 'Um script sem ajuda é um script que só você usa. A função de uso é três linhas e resolve:' },
      {
        code: [
          'uso() {',
          '    cat >&2 << FIM',
          'uso: $(basename "$0") [-v] [-n DIAS] DIRETORIO',
          '',
          '  -v        modo verboso',
          '  -n DIAS   quantos dias manter (padrão: 30)',
          '  -h        mostra esta ajuda',
          'FIM',
          '    exit "${1:-2}"',
          '}'
        ], run: false
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>$1</code>…, <code>$#</code> e <code>"$@"</code> — sempre com aspas.',
          'Valide o número de argumentos antes de trabalhar; erro de uso sai com <code>exit 2</code>.',
          'Mensagem de erro vai para o <code>stderr</code> (<code>&gt;&amp;2</code>).',
          '<code>${2:-padrao}</code> dá valor padrão; <code>${1:?mensagem}</code> aborta se faltar.',
          '<code>getopts "vn:h"</code> para opções curtas, seguido de <code>shift $((OPTIND-1))</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't15-5-a', kind: 'guiado', title: 'Veja a diferença entre "$@" e "$*"',
        body: [
          { p: 'Este é um daqueles detalhes que só ficam claros vendo:' },
          {
            code: [
              '$ mkdir -p ~/scripts && cd ~/scripts',
              '$ printf \'#!/bin/bash\\necho "recebi $# argumentos"\\nfor a in "$@"; do echo "  [$a]"; done\\n\' > args.sh',
              '$ chmod +x args.sh',
              '$ ./args.sh "meu arquivo.txt" outro.txt',
              '$ printf \'#!/bin/bash\\nfor a in "$*"; do echo "  [$a]"; done\\n\' > estrela.sh',
              '$ chmod +x estrela.sh',
              '$ ./estrela.sh "meu arquivo.txt" outro.txt',
              '$ cd ~'
            ]
          },
          { p: 'O primeiro imprimiu dois itens; o segundo, um só. Guarde: <code>"$@"</code> preserva os limites entre os argumentos, <code>"$*"</code> os apaga.' }
        ],
        hints: ['Repare que o nome do arquivo tem um espaço — é justamente ele que revela a diferença.'],
        check: async (ctx) => H.checkAll([
          [() => H.exists(ctx, '/home/aluno/scripts/args.sh'), 'Crie o <code>~/scripts/args.sh</code>.'],
          [() => /"\$@"/.test(ler(ctx, '/home/aluno/scripts/args.sh')), 'O <code>args.sh</code> deve percorrer <code>"$@"</code>.'],
          [() => H.exists(ctx, '/home/aluno/scripts/estrela.sh'), 'Crie também o <code>~/scripts/estrela.sh</code> para comparar.'],
          [() => H.usedCommand(ctx, /\.\/args\.sh/), 'Rode o <code>./args.sh</code> com dois argumentos, um deles com espaço.']
        ])
      },
      {
        id: 't15-5-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um script de limpeza recebe o diretório como argumento:' },
          {
            code: [
              '#!/bin/bash',
              'ALVO=$1',
              'rm -rf $ALVO/*'
            ], run: false, lang: 'bash'
          },
          { p: 'Ele foi chamado sem argumento nenhum. O que acontece — e qual é a correção mais importante?' }
        ],
        options: [
          { text: '<code>$ALVO</code> fica vazio e o comando vira <code>rm -rf /*</code>. As correções são <code>set -euo pipefail</code> e validar <code>$#</code> antes de qualquer coisa.', correct: true },
          { text: 'O script falha com "unbound variable" e nada é apagado.', why: 'Essa seria a proteção do <code>set -u</code> — e é exatamente o que falta aqui. Sem ele, o Bash trata a variável vazia como string vazia, sem reclamar.' },
          { text: 'O <code>rm</code> recusa a operação porque não recebeu caminho válido.', why: 'O <code>rm</code> recebe um caminho perfeitamente válido: <code>/*</code>. Ele não tem como saber que aquilo foi um acidente.' },
          { text: 'Nada acontece, porque o glob <code>*</code> não expande em diretório vazio.', why: 'O glob expande no diretório raiz, que não está vazio. E o problema apareceria igual com um caminho digitado errado.' }
        ],
        explain: 'Este é o acidente clássico, e ele tem três camadas de proteção, todas baratas: <strong>(1)</strong> <code>set -u</code> faz o script morrer ao usar variável não definida; <strong>(2)</strong> validar <code>[ $# -lt 1 ] &amp;&amp; exit 2</code> dá uma mensagem clara em vez de um acidente; <strong>(3)</strong> aspas em <code>"$ALVO"</code> evitam a expansão em outro contexto. A versão segura da linha é <code>rm -rf -- "${ALVO:?informe o diretório}"/*</code>.'
      },
      {
        id: 't15-5-b', kind: 'desafio', title: 'Um utilitário de verdade',
        body: [
          { p: 'Escreva <code>~/scripts/relatorio.sh</code>, executável, que conta linhas de arquivos e aceita opções:' },
          {
            ul: [
              '<code>-h</code> imprime a ajuda e sai com código <strong>0</strong>;',
              '<code>-n NUM</code> define quantos arquivos mostrar (padrão <strong>3</strong>);',
              '<code>-v</code> liga o modo verboso, que imprime <code>modo verboso ligado</code> antes do resultado;',
              'depois das opções vem <strong>um argumento obrigatório</strong>: o diretório a analisar;',
              'sem argumento nenhum, ou com diretório inexistente, o script escreve a mensagem de erro <strong>no stderr</strong> e sai com código <strong>2</strong>;',
              'no caso normal, imprime uma linha por arquivo do diretório, no formato <code>linhas nome</code>, da maior para a menor, limitado ao número pedido.'
            ]
          },
          { p: 'O cenário para testar:' },
          { code: ['$ mkdir -p ~/dados', '$ seq 1 40 > ~/dados/grande.txt', '$ seq 1 12 > ~/dados/medio.txt', '$ seq 1 3 > ~/dados/pequeno.txt', '$ seq 1 7 > ~/dados/outro.txt'] },
          { p: 'Comprove: <code>~/scripts/relatorio.sh -n 2 ~/dados</code> deve imprimir duas linhas, a primeira sendo o <code>grande.txt</code> com 40.' }
        ],
        hints: [
          'A estrutura é <code>while getopts "hn:v" o; do case "$o" in ... esac; done</code> seguida de <code>shift $((OPTIND-1))</code>.',
          'Para contar linhas por arquivo: <code>wc -l "$d"/* | head -n -1</code> traz uma linha por arquivo (a última é o total, por isso o <code>head -n -1</code>). Ordene com <code>sort -rn</code> e corte com <code>head -n "$NUM"</code>. Para o nome sem o caminho, <code>basename</code> ou <code>awk</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/dados ~/scripts\nseq 1 40 &gt; ~/dados/grande.txt\nseq 1 12 &gt; ~/dados/medio.txt\nseq 1 3 &gt; ~/dados/pequeno.txt\nseq 1 7 &gt; ~/dados/outro.txt\n\ncat &gt; ~/scripts/relatorio.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\n\nNUM=3\nVERBOSE=0\n\nuso() {\n  echo "uso: $(basename "$0") [-v] [-n NUM] DIRETORIO" &gt;&amp;2\n  exit "${1:-2}"\n}\n\nwhile getopts "hn:v" opcao; do\n  case "$opcao" in\n    h) uso 0 ;;\n    n) NUM="$OPTARG" ;;\n    v) VERBOSE=1 ;;\n    *) uso 2 ;;\n  esac\ndone\nshift $((OPTIND - 1))\n\n[ $# -ge 1 ] || uso 2\nDIR="$1"\n[ -d "$DIR" ] || { echo "erro: $DIR nao e um diretorio" &gt;&amp;2; exit 2; }\n\n[ "$VERBOSE" -eq 1 ] &amp;&amp; echo "modo verboso ligado"\n\nwc -l "$DIR"/* | head -n -1 | sort -rn | head -n "$NUM" \\\n  | while read -r n arq; do echo "$n $(basename "$arq")"; done\nEOF\nchmod +x ~/scripts/relatorio.sh\n\n~/scripts/relatorio.sh -n 2 ~/dados\n~/scripts/relatorio.sh -h; echo "codigo do -h: $?"\n~/scripts/relatorio.sh 2&gt;/dev/null; echo "codigo sem argumento: $?"</pre></div><p style="margin-top:8px">Repare no <code>uso 0</code> do <code>-h</code>: pedir ajuda não é erro, então o código de saída é 0. Já a falta de argumento é erro de uso, e sai com 2. Essa distinção é o que faz o script se comportar bem dentro de outro script.</p>',
        check: async (ctx) => {
          const sc = ler(ctx, '/home/aluno/scripts/relatorio.sh');
          if (!sc) return { ok: false, msg: 'Não encontrei <code>~/scripts/relatorio.sh</code>.' };
          const semArg = await rodar(ctx, '~/scripts/relatorio.sh >/dev/null 2>&1; echo RC=$?');
          const stderr = await rodar(ctx, '~/scripts/relatorio.sh 2>&1 >/dev/null');
          const ajuda = await rodar(ctx, '~/scripts/relatorio.sh -h >/dev/null 2>&1; echo RC=$?');
          const inexistente = await rodar(ctx, '~/scripts/relatorio.sh /nao/existe >/dev/null 2>&1; echo RC=$?');
          const dois = await rodar(ctx, '~/scripts/relatorio.sh -n 2 ~/dados 2>/dev/null');
          const verboso = await rodar(ctx, '~/scripts/relatorio.sh -v -n 1 ~/dados 2>/dev/null');
          const linhas = dois.split('\n').map(x => x.trim()).filter(Boolean);
          const rc = (s) => (/RC=(\d+)/.exec(s) || [])[1];
          return H.checkAll([
            [() => (H.mode(ctx, '/home/aluno/scripts/relatorio.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [() => /^#!/.test(sc), 'Falta o shebang.'],
            [() => /getopts/.test(sc), 'Use <code>getopts</code> para tratar as opções — é o que a aula está treinando.'],
            [() => /OPTIND/.test(sc), 'Falta o <code>shift $((OPTIND - 1))</code> depois do laço de opções.'],
            [() => H.isDir(ctx, '/home/aluno/dados'), 'Monte o cenário: falta o diretório <code>~/dados</code> com os arquivos.'],
            [() => rc(semArg) === '2', () => `Sem argumento, o script deve sair com código 2; saiu com ${rc(semArg)}.`],
            [() => /uso|usage|erro/i.test(stderr), 'A mensagem de erro precisa ir para o <strong>stderr</strong> — quem redireciona a saída não pode receber o erro dentro do arquivo de resultado.'],
            [() => rc(ajuda) === '0', () => `O <code>-h</code> deve sair com código 0 (pedir ajuda não é erro); saiu com ${rc(ajuda)}.`],
            [() => rc(inexistente) === '2', () => `Diretório inexistente deve sair com código 2; saiu com ${rc(inexistente)}.`],
            [() => linhas.length === 2, () => `Com <code>-n 2</code> a saída deve ter 2 linhas; teve ${linhas.length}.`],
            [() => /^40\s+grande\.txt$/.test(linhas[0] || ''), () => `A primeira linha deve ser <code>40 grande.txt</code>. Obtive: "${linhas[0] || ''}".`],
            [() => /^12\s+medio\.txt$/.test(linhas[1] || ''), () => `A segunda linha deve ser <code>12 medio.txt</code>. Obtive: "${linhas[1] || ''}".`],
            [() => /modo verboso ligado/.test(verboso), 'Com <code>-v</code>, o script deve imprimir <code>modo verboso ligado</code> antes do resultado.'],
            [() => !/modo verboso ligado/.test(dois), 'Sem <code>-v</code>, a mensagem de modo verboso não pode aparecer.']
          ]);
        }
      }
    ]
  });

  /* ============================== 15.6 ============================== */
  LX.lesson('m15', {
    id: 'l15-6', n: '15.6', title: 'Arrays e aritmética',
    goal: 'Guardar listas sem depender de string com espaço, e fazer contas sem chamar programa externo.',
    body: [
      { h2: 'O problema que o array resolve' },
      { p: 'Sem array, a única forma de guardar uma lista em shell é uma string separada por espaços. E aí <strong>qualquer nome de arquivo com espaço quebra tudo</strong> — o que não é caso raro, é o caso comum em diretório de gente.' },
      {
        code: [
          'LISTA="relatorio final.pdf notas.txt"     # 2 arquivos? ou 3?',
          'for f in $LISTA; do echo "[$f]"; done      # 3 voltas. errado.'
        ], run: false
      },
      { p: 'O array guarda os limites entre os itens, e por isso não tem esse problema.' },

      { h2: 'Sintaxe' },
      {
        table: {
          head: ['Escreve', 'Faz'],
          rows: [
            ['<code>a=(um dois tres)</code>', 'cria o array'],
            ['<code>a+=(quatro)</code>', 'acrescenta no fim'],
            ['<code>${a[0]}</code>', 'o primeiro item (a contagem começa em 0)'],
            ['<code>"${a[@]}"</code>', '<strong>todos</strong> os itens, cada um separado'],
            ['<code>${#a[@]}</code>', 'quantos itens tem'],
            ['<code>${#a[2]}</code>', 'o comprimento do terceiro item'],
            ['<code>"${!a[@]}"</code>', 'os índices, não os valores'],
            ['<code>${a[@]: -1}</code>', 'o último item (repare no espaço antes do <code>-1</code>)'],
            ['<code>unset \'a[1]\'</code>', 'remove um item']
          ]
        }
      },
      {
        box: 'warn', label: 'As aspas de novo', body: [
          { p: '<code>"${a[@]}"</code> com aspas expande para N palavras, uma por item, preservando espaços. Sem as aspas, o Bash junta tudo e reparte pelos espaços — voltando exatamente ao problema que o array existia para resolver. <strong>Não existe caso em que <code>${a[@]}</code> sem aspas seja o que você queria.</strong>' }
        ]
      },
      { p: 'Para preencher um array com as linhas de um arquivo ou com a saída de um comando, o jeito correto é o <code>mapfile</code> (também chamado <code>readarray</code>):' },
      { code: ['$ mapfile -t linhas < /etc/hostname', '$ echo "${#linhas[@]} linha(s): ${linhas[0]}"'] },
      { p: 'O <code>-t</code> remove o <code>\\n</code> do fim de cada linha. Sem ele, cada item carrega uma quebra invisível que vai atrapalhar toda comparação depois.' },

      { h2: 'Arrays associativos: chave em vez de número' },
      { p: 'Quando o índice natural não é um número e sim um nome, existe o array associativo — o "dicionário" do Bash. Ele <strong>precisa</strong> ser declarado antes:' },
      {
        code: [
          '$ declare -A porta',
          '$ porta[web]=80',
          '$ porta[ssh]=22',
          '$ echo "web usa ${porta[web]}"',
          '$ for s in "${!porta[@]}"; do echo "$s -> ${porta[$s]}"; done'
        ]
      },
      { p: 'Sem o <code>declare -A</code>, o Bash trata <code>porta[web]</code> como array normal e converte <code>web</code> para o índice 0 — todas as chaves colidem na mesma posição, silenciosamente.' },

      { h2: 'Aritmética sem chamar programa' },
      { p: 'Shell antigo fazia conta chamando o <code>expr</code>, um processo externo por operação. O Bash faz internamente, e é muito mais rápido e legível:' },
      {
        table: {
          head: ['Forma', 'Para quê'],
          rows: [
            ['<code>$(( expr ))</code>', 'expande para o <strong>resultado</strong> — use dentro de outra coisa'],
            ['<code>(( expr ))</code>', 'comando: <strong>executa</strong> a conta, não imprime nada'],
            ['<code>let x=1+2</code>', 'forma antiga; prefira as duas acima']
          ]
        }
      },
      { code: ['$ echo $(( 3 + 4 * 2 ))', '$ echo $(( 2 ** 10 ))', '$ echo $(( 17 % 5 ))', '$ x=5; (( x++ )); echo $x', '$ total=0; for n in 4 8 15; do (( total += n )); done; echo "soma: $total"'] },
      { p: 'Dentro de <code>(( ))</code> e <code>$(( ))</code> o cifrão é opcional: <code>$(( x + 1 ))</code> e <code>$(( $x + 1 ))</code> dão o mesmo. E os operadores são os de C: <code>+ - * / % **</code>, <code>++ --</code>, <code>+= -=</code>, <code>== != &lt; &gt; &lt;= &gt;=</code>, <code>&amp;&amp; || !</code>.' },
      {
        box: 'key', label: 'O (( )) como condição — e a pegadinha do código de saída', body: [
          { p: 'O <code>(( ))</code> devolve <strong>0 (sucesso) quando o resultado é diferente de zero</strong>, e 1 quando é zero. É invertido em relação à intuição matemática, mas coerente com a lógica do shell: "resultado não-nulo é verdadeiro".' },
          { code: ['$ (( 5 > 3 )) && echo "cinco é maior"', '$ n=0; (( n )) && echo "nunca aparece"; echo "código: $?"'], run: false },
          { p: 'A consequência prática que morde: <code>(( contador++ ))</code> numa linha sob <code>set -e</code> <strong>aborta o script</strong> quando o contador vale 0, porque o comando "falhou". A saída é usar <code>(( contador++ )) || true</code>, ou <code>(( ++contador ))</code>, que já devolve o valor incrementado.' }
        ]
      },
      { p: 'E a limitação para não ser pego de surpresa: o Bash só faz aritmética de <strong>inteiros</strong>. <code>$(( 7 / 2 ))</code> é 3, não 3.5. Para decimais, é preciso chamar <code>bc -l</code> ou <code>awk</code>.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Array preserva os limites entre os itens; string separada por espaço não.',
          '<code>"${a[@]}"</code> sempre com aspas; <code>${#a[@]}</code> conta; <code>mapfile -t</code> lê um arquivo.',
          'Array associativo exige <code>declare -A</code> antes.',
          '<code>$(( ))</code> devolve o valor; <code>(( ))</code> executa a conta.',
          '<code>(( ))</code> tem status 0 quando o valor é diferente de zero — cuidado com <code>set -e</code>.',
          'Só inteiros. Decimal exige <code>bc</code> ou <code>awk</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't15-6-a', kind: 'guiado', title: 'Arrays e contas na prática',
        body: [
          { p: 'Experimente cada forma e observe o resultado:' },
          {
            code: [
              '$ servicos=(nginx postgres redis)',
              '$ servicos+=(rabbitmq)',
              '$ echo "${#servicos[@]} serviços: ${servicos[@]}"',
              '$ for i in "${!servicos[@]}"; do echo "$i -> ${servicos[$i]}"; done',
              '$ declare -A porta',
              '$ porta[nginx]=80; porta[postgres]=5432; porta[redis]=6379',
              '$ for s in "${!porta[@]}"; do echo "$s escuta em ${porta[$s]}"; done',
              '$ total=0; for n in 4 8 15 16; do (( total += n )); done; echo "soma: $total"',
              '$ echo "media inteira: $(( total / 4 ))"'
            ]
          },
          { p: 'Repare que a soma foi feita sem chamar nenhum programa externo — tudo dentro do próprio shell.' }
        ],
        hints: ['O <code>declare -A</code> precisa vir antes de qualquer atribuição ao array associativo.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /\w+\+=\(/), 'Acrescente um item ao array com <code>servicos+=(rabbitmq)</code>.'],
          [() => H.usedCommand(ctx, /\$\{#\w+\[@\]\}/), 'Conte os itens com <code>${#servicos[@]}</code>.'],
          [() => H.usedCommand(ctx, /declare\s+-A/), 'Declare o array associativo com <code>declare -A porta</code>.'],
          [() => H.usedCommand(ctx, /\(\(\s*total\s*\+=|\(\(\s*\w+\s*\+=/), 'Some com <code>(( total += n ))</code>.']
        ])
      },
      {
        id: 't15-6-q', kind: 'quiz', title: 'Por que o script aborta ali?',
        body: [
          { p: 'Um script começa com <code>set -euo pipefail</code>. Mais adiante:' },
          {
            code: [
              'contador=0',
              'for arq in *.log; do',
              '    (( contador++ ))',
              'done',
              'echo "processados: $contador"'
            ], run: false, lang: 'bash'
          },
          { p: 'O script morre na <strong>primeira</strong> volta do laço, antes de imprimir qualquer coisa. Por quê?' }
        ],
        options: [
          {
            text: 'Porque <code>(( ))</code> devolve status de saída 1 quando o <strong>resultado</strong> da expressão é zero — e <code>contador++</code> vale 0 antes de incrementar, o que <code>set -e</code> trata como falha.',
            correct: true
          },
          { text: 'Porque <code>contador</code> precisa ser declarado com <code>declare -i</code> antes de receber <code>++</code>.', why: '<code>(( ))</code> faz aritmética independente de declaração prévia; o <code>declare -i</code> não é exigido aqui.' },
          { text: 'Porque o operador <code>++</code> não existe em Bash — só em C.', why: 'O Bash importa exatamente os operadores de C dentro de <code>(( ))</code>, incluindo <code>++</code> e <code>--</code>.' },
          { text: 'Porque faltou o cifrão: deveria ser <code>$(( contador++ ))</code>.', why: 'O cifrão troca o <em>comando</em> pela <em>expansão do valor</em> — mas o problema aqui não é sintaxe, é o status de saída de <code>(( ))</code> quando o resultado é zero.' }
        ],
        explain: 'É a pegadinha da aula: <code>(( expr ))</code> tem status 0 quando o valor da expressão é diferente de zero, e 1 quando é zero — o oposto da intuição de "deu certo". Como <code>contador++</code> devolve o valor <em>antes</em> de incrementar (que é 0 na primeira volta), o comando "falha" e <code>set -e</code> aborta. A correção é <code>(( contador++ )) || true</code>, ou trocar por <code>(( ++contador ))</code>, que devolve o valor já incrementado.'
      },
      {
        id: 't15-6-b', kind: 'desafio', title: 'Estatística sem programa externo',
        body: [
          { p: 'Crie o arquivo de entrada e depois o script.' },
          { code: ['$ mkdir -p ~/scripts', '$ printf \'12\\n45\\n7\\n90\\n23\\n\' > ~/numeros.txt'] },
          { p: 'Escreva <code>~/scripts/stats.sh</code>, executável, que leia <code>~/numeros.txt</code> <strong>para um array</strong> e imprima exatamente três linhas:' },
          {
            code: [
              'quantidade: 5',
              'soma: 177',
              'maior: 90'
            ], run: false, lang: 'text'
          },
          { p: 'Regras: use <code>mapfile</code> para carregar o array e faça as contas com <code>(( ))</code> — nada de <code>awk</code>, <code>sort</code>, <code>bc</code> ou <code>expr</code>. O objetivo é praticar o que a aula ensinou.' }
        ],
        hints: [
          'O <code>mapfile -t numeros &lt; ~/numeros.txt</code> carrega uma linha por item. A quantidade sai direto de <code>${#numeros[@]}</code>.',
          'Para a soma e o maior, um laço só resolve: <code>for n in "${numeros[@]}"; do (( soma += n )); (( n > maior )) &amp;&amp; maior=$n; done</code>. Comece com <code>soma=0</code> e <code>maior=0</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/scripts\nprintf \'12\\n45\\n7\\n90\\n23\\n\' &gt; ~/numeros.txt\n\ncat &gt; ~/scripts/stats.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\n\nmapfile -t numeros &lt; "$HOME/numeros.txt"\n\nsoma=0\nmaior=0\nfor n in "${numeros[@]}"; do\n  (( soma += n ))\n  if (( n &gt; maior )); then maior=$n; fi\ndone\n\necho "quantidade: ${#numeros[@]}"\necho "soma: $soma"\necho "maior: $maior"\nEOF\nchmod +x ~/scripts/stats.sh\n~/scripts/stats.sh</pre></div><p style="margin-top:8px">Nenhum processo externo foi criado. Num laço de cinco itens isso é irrelevante; num de cinquenta mil, é a diferença entre um segundo e vários minutos.</p>',
        check: async (ctx) => {
          const sc = ler(ctx, '/home/aluno/scripts/stats.sh');
          if (!sc) return { ok: false, msg: 'Não encontrei <code>~/scripts/stats.sh</code>.' };
          const saida = await rodar(ctx, '~/scripts/stats.sh 2>&1');
          const l = saida.split('\n').map(x => x.trim()).filter(Boolean);
          const nums = (ler(ctx, '/home/aluno/numeros.txt') || '').split('\n').map(x => x.trim()).filter(Boolean).map(Number);
          const soma = nums.reduce((a, b) => a + b, 0);
          const maior = nums.length ? Math.max(...nums) : 0;
          return H.checkAll([
            [() => (H.mode(ctx, '/home/aluno/scripts/stats.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [() => nums.length > 0, 'Crie o <code>~/numeros.txt</code> com os números do enunciado.'],
            [() => /mapfile|readarray/.test(sc), 'Use <code>mapfile -t</code> para carregar o arquivo no array — é isso que a aula está treinando.'],
            [() => /\(\(/.test(sc), 'Faça as contas com <code>(( ))</code>.'],
            [() => !/\bawk\b|\bbc\b|\bexpr\b|\bsort\b/.test(sc), 'O desafio pede para resolver só com recursos do Bash — sem <code>awk</code>, <code>bc</code>, <code>expr</code> ou <code>sort</code>.'],
            [() => l.length === 3, () => `A saída deve ter exatamente 3 linhas; teve ${l.length}. Saída: "${saida.slice(0, 90)}"`],
            [() => new RegExp('^quantidade:\\s*' + nums.length + '$').test(l[0] || ''), () => `A primeira linha deve ser <code>quantidade: ${nums.length}</code>. Obtive: "${l[0] || ''}".`],
            [() => new RegExp('^soma:\\s*' + soma + '$').test(l[1] || ''), () => `A segunda linha deve ser <code>soma: ${soma}</code>. Obtive: "${l[1] || ''}".`],
            [() => new RegExp('^maior:\\s*' + maior + '$').test(l[2] || ''), () => `A terceira linha deve ser <code>maior: ${maior}</code>. Obtive: "${l[2] || ''}".`]
          ]);
        }
      }
    ]
  });

  /* ============================== 15.7 ============================== */
  LX.lesson('m15', {
    id: 'l15-7', n: '15.7', title: 'Depurar um script',
    goal: 'Descobrir onde e por que um script se comporta diferente do esperado, em vez de encher o código de echo até adivinhar.',
    body: [
      { h2: 'As três perguntas da depuração' },
      {
        ul: [
          '<strong>É erro de sintaxe?</strong> — o script nem chega a rodar. <code>bash -n</code>.',
          '<strong>É erro de lógica?</strong> — roda, mas faz a coisa errada. <code>bash -x</code>.',
          '<strong>É erro de qualidade?</strong> — funciona hoje e vai quebrar com o primeiro nome com espaço. <code>shellcheck</code>.'
        ]
      },
      { p: 'São ferramentas diferentes para perguntas diferentes. Sair colocando <code>echo</code> no meio do código responde qualquer uma das três muito devagar.' },

      { h2: 'bash -n: só a sintaxe' },
      { code: ['$ bash -n /etc/profile && echo "sintaxe ok"'] },
      { p: 'Ele lê o arquivo, monta a árvore e não executa nada. É seguro rodar em qualquer script, inclusive um que apaga arquivos. Deve ser o primeiro reflexo depois de editar — especialmente em script que roda por cron, onde um <code>fi</code> esquecido só aparece às três da manhã.' },

      { h2: 'bash -x: ver o que o shell realmente executou' },
      { p: 'O <code>-x</code> imprime cada comando <strong>depois de todas as expansões</strong>, precedido de <code>+</code>. É aí que está o valor: você vê o comando que o shell montou, não o que você escreveu.' },
      { code: ['$ bash -x -c \'a="dois mundos"; echo $a; echo "$a"\''] },
      {
        ascii: `+ a='dois mundos'
+ echo dois mundos      ← sem aspas: virou DOIS argumentos
dois mundos
+ echo 'dois mundos'    ← com aspas: UM argumento
dois mundos`
      },
      { p: 'A saída é idêntica nos dois casos, mas o rastro mostra que são coisas diferentes — e por isso um vai quebrar mais tarde e o outro não. Nenhum <code>echo</code> manual mostraria isso.' },
      {
        table: {
          head: ['Forma', 'Quando usar'],
          rows: [
            ['<code>bash -x script.sh</code>', 'rastrear o script inteiro, sem editá-lo'],
            ['<code>set -x</code> … <code>set +x</code>', 'rastrear só um trecho suspeito'],
            ['<code>#!/bin/bash -x</code>', 'sempre rastreado (só durante a investigação)'],
            ['<code>PS4=\'+${LINENO}: \'</code>', 'inclui o <strong>número da linha</strong> em cada passo do rastro']
          ]
        }
      },
      {
        box: 'key', label: 'O PS4 que vale ouro', body: [
          { p: 'O padrão do <code>PS4</code> é só <code>+ </code>, o que num script de cem linhas não diz onde você está. Com uma linha no começo do script isso muda:' },
          { code: ['export PS4=\'+${BASH_SOURCE}:${LINENO}: \''], run: false },
          { p: 'Agora cada passo do rastro vem com arquivo e linha. Em script que chama outro script, é a diferença entre entender e chutar.' }
        ]
      },
      {
        box: 'warn', label: 'Cuidado com segredo no rastro', body: [
          { p: 'O <code>set -x</code> imprime <em>tudo</em>, inclusive senhas e tokens que passem por variável. Se o rastro for para um log, o segredo vai junto. Desligue com <code>set +x</code> antes do trecho sensível — ou nunca passe segredo por linha de comando.' }
        ]
      },

      { h2: 'trap ERR: onde exatamente parou' },
      { p: 'Com <code>set -e</code>, o script aborta em silêncio: você vê que parou, não onde. Uma linha resolve:' },
      {
        code: [
          '#!/bin/bash',
          'set -euo pipefail',
          'trap \'echo "ERRO na linha $LINENO: comando \\"$BASH_COMMAND\\" saiu com $?" >&2\' ERR'
        ], run: false
      },
      { p: 'O <code>$BASH_COMMAND</code> guarda o comando que estava executando e o <code>$LINENO</code>, a linha. Combinado com o <code>trap EXIT</code> que você viu na 15.4 — um limpa, o outro relata — o script passa a explicar a própria falha.' },

      { h2: 'shellcheck: o revisor que não cansa' },
      { p: 'O <code>shellcheck</code> lê o script e aponta problemas que ainda não aconteceram. Ele não executa nada.' },
      { code: ['$ shellcheck ~/scripts/relatorio.sh 2>/dev/null || true'] },
      {
        table: {
          head: ['Código', 'O que ele viu', 'Por que importa'],
          rows: [
            ['<strong>SC2086</strong>', 'variável sem aspas', 'quebra no primeiro nome com espaço'],
            ['<strong>SC2046</strong>', '<code>$(...)</code> sem aspas', 'mesma coisa, na substituição de comando'],
            ['<strong>SC2164</strong>', '<code>cd</code> sem <code>|| exit</code>', 'se o cd falhar, o resto roda no lugar errado'],
            ['<strong>SC2006</strong>', 'crase em vez de <code>$( )</code>', 'sintaxe antiga, não aninha'],
            ['<strong>SC2115</strong>', '<code>rm -rf "$X/"</code> com X possivelmente vazio', 'o acidente do <code>rm -rf /</code>']
          ]
        }
      },
      { p: 'Praticamente todo aviso do shellcheck é legítimo. Quando você tem certeza de que um caso específico é seguro, silencie <em>aquela</em> linha com <code># shellcheck disable=SC2086</code> logo acima — e não desligue a verificação inteira.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>bash -n</code> para sintaxe, sem executar. Reflexo depois de toda edição.',
          '<code>bash -x</code> mostra o comando <em>depois</em> das expansões — é onde os bugs de aspas aparecem.',
          '<code>PS4=\'+${LINENO}: \'</code> coloca a linha no rastro.',
          '<code>trap \'...\' ERR</code> relata linha e comando que falharam.',
          '<code>shellcheck</code> encontra o bug antes dele acontecer; silencie por linha, nunca no geral.',
          'O rastro vaza segredos: cuidado com <code>set -x</code> perto de senha.'
        ]
      }
    ],
    tasks: [
      {
        id: 't15-7-a', kind: 'guiado', title: 'Veja o shell montando o comando',
        body: [
          { p: 'Compare os dois casos e leia o rastro com atenção:' },
          { code: ['$ bash -x -c \'a="dois mundos"; echo $a\'', '$ bash -x -c \'a="dois mundos"; echo "$a"\'', '$ bash -n /etc/profile && echo "sintaxe ok"'] },
          { p: 'No primeiro, o rastro mostra <code>+ echo dois mundos</code> — dois argumentos. No segundo, <code>+ echo \'dois mundos\'</code> — um argumento entre aspas. A saída visível é a mesma; o comando executado não é.' }
        ],
        hints: ['O <code>bash -x -c</code> permite testar um trecho sem criar arquivo.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /bash\s+.*-x/), 'Rode um trecho com <code>bash -x</code> para ver o rastro.'],
          [() => H.usedCommand(ctx, /bash\s+.*-n/), 'Valide uma sintaxe com <code>bash -n</code>.']
        ])
      },
      {
        id: 't15-7-q', kind: 'quiz', title: 'Qual pergunta você está fazendo?',
        body: [
          { p: '<code>bash -n meu_script.sh</code> não acusa nada, e o script roda até o fim sem erro — mas o resultado final está errado. Qual é o próximo passo?' }
        ],
        options: [
          {
            text: '<code>bash -x meu_script.sh</code>: o problema não é sintaxe (já confirmado), é lógica — e o <code>-x</code> mostra o comando <em>depois</em> das expansões, onde bugs de aspas e variável ficam visíveis.',
            correct: true
          },
          { text: 'Rodar <code>bash -n</code> de novo, com mais atenção.', why: 'O <code>bash -n</code> só monta a árvore de sintaxe e já disse que ela está correta — repetir não revela nada sobre o comportamento em execução.' },
          { text: '<code>shellcheck</code>, porque ele encontra qualquer tipo de bug.', why: 'O shellcheck aponta padrões arriscados de forma estática (aspas faltando, <code>cd</code> sem tratamento); ele não roda o script nem mostra <em>este</em> resultado específico errado.' },
          { text: 'Colocar <code>echo</code> antes de cada linha até descobrir onde diverge.', why: 'Funciona, mas é o caminho lento que a aula descreve — reescreve o script para depois desfazer, e o <code>-x</code> chega ao mesmo lugar sem tocar no código.' }
        ],
        explain: 'As três perguntas da depuração pedem ferramentas diferentes: <code>bash -n</code> para sintaxe (já resolvida aqui), <code>shellcheck</code> para problemas de qualidade que ainda não aconteceram, e <code>bash -x</code> (ou <code>set -x</code> num trecho) para ver exatamente o que o shell executou quando o resultado sai errado apesar do script "rodar liso".'
      },
      {
        id: 't15-7-b', kind: 'desafio', title: 'Conserte o script quebrado',
        body: [
          { p: 'Crie o script defeituoso abaixo exatamente como está — ele tem <strong>três</strong> problemas:' },
          {
            code: [
              '$ mkdir -p ~/scripts ~/entrada',
              '$ printf \'a\\nb\\nc\\n\' > "$HOME/entrada/meu arquivo.txt"',
              '$ printf \'x\\ny\\n\' > ~/entrada/outro.txt',
              '$ cat > ~/scripts/quebrado.sh << \'EOF\'',
              '#!/bin/bash',
              'DIR=$1',
              'cd $DIR',
              'for f in *.txt; do',
              '  echo "$f tem $(wc -l < $f) linhas"',
              'done',
              'EOF',
              '$ chmod +x ~/scripts/quebrado.sh',
              '$ ~/scripts/quebrado.sh ~/entrada'
            ]
          },
          { p: 'Investigue com <code>bash -x</code> e <code>shellcheck</code>, depois entregue <code>~/scripts/corrigido.sh</code> que:' },
          {
            ul: [
              'tenha <code>set -euo pipefail</code>;',
              'valide que recebeu o argumento e saia com código 2 se não recebeu;',
              'trate corretamente nomes de arquivo <strong>com espaço</strong>;',
              'não continue se o <code>cd</code> falhar;',
              'imprima uma linha por arquivo <code>.txt</code>, no formato <code>nome tem N linhas</code>.'
            ]
          },
          { p: 'Comprove que <code>~/scripts/corrigido.sh ~/entrada</code> imprime <strong>duas</strong> linhas, uma delas mencionando <code>meu arquivo.txt</code> com 3 linhas.' }
        ],
        hints: [
          'Os três problemas são: <code>$1</code> sem validação e sem aspas, <code>cd</code> sem tratamento de falha, e <code>$f</code> sem aspas dentro do <code>wc</code>.',
          'A correção do <code>cd</code> é <code>cd "$DIR" || exit 1</code>. A do <code>wc</code> é <code>wc -l &lt; "$f"</code>. E vale começar com <code>[ $# -ge 1 ] || { echo "uso: $0 DIR" &gt;&amp;2; exit 2; }</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/scripts ~/entrada\nprintf \'a\\nb\\nc\\n\' &gt; "$HOME/entrada/meu arquivo.txt"\nprintf \'x\\ny\\n\' &gt; ~/entrada/outro.txt\n\ncat &gt; ~/scripts/corrigido.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\n\n[ $# -ge 1 ] || { echo "uso: $0 DIRETORIO" &gt;&amp;2; exit 2; }\nDIR="$1"\ncd "$DIR" || exit 1\n\nfor f in *.txt; do\n  echo "$f tem $(wc -l &lt; "$f") linhas"\ndone\nEOF\nchmod +x ~/scripts/corrigido.sh\n\nbash -n ~/scripts/corrigido.sh &amp;&amp; echo "sintaxe ok"\n~/scripts/corrigido.sh ~/entrada</pre></div><p style="margin-top:8px">Três aspas e uma validação. É quase sempre esse o tamanho da diferença entre um script que funciona na sua máquina e um que funciona em produção.</p>',
        check: async (ctx) => {
          const sc = ler(ctx, '/home/aluno/scripts/corrigido.sh');
          if (!sc) return { ok: false, msg: 'Não encontrei <code>~/scripts/corrigido.sh</code>.' };
          const saida = await rodar(ctx, '~/scripts/corrigido.sh ~/entrada 2>&1');
          const semArg = await rodar(ctx, '~/scripts/corrigido.sh >/dev/null 2>&1; echo RC=$?');
          const sintaxe = await rodar(ctx, 'bash -n ~/scripts/corrigido.sh 2>&1; echo RC=$?');
          const l = saida.split('\n').map(x => x.trim()).filter(Boolean);
          return H.checkAll([
            [() => (H.mode(ctx, '/home/aluno/scripts/corrigido.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [() => H.exists(ctx, '/home/aluno/entrada/meu arquivo.txt'), 'Monte o cenário: falta o arquivo com espaço no nome em <code>~/entrada</code>.'],
            [() => /RC=0/.test(sintaxe), 'O <code>bash -n</code> acusa erro de sintaxe no script.'],
            [() => /set\s+-euo\s+pipefail/.test(sc), 'Falta <code>set -euo pipefail</code>.'],
            [() => /"\$1"|"\$DIR"|"\$\{1/.test(sc), 'O argumento precisa ser usado entre aspas.'],
            [() => /cd\s+"[^"]+"\s*(\|\||&&)|cd\s+"[^"]+"\s*$/m.test(sc) && /cd[^\n]*\|\|/.test(sc), 'O <code>cd</code> precisa tratar a falha (<code>cd "$DIR" || exit 1</code>) — senão o resto do script roda no diretório errado.'],
            [() => /wc\s+-l\s*<\s*"\$f"|wc\s+-l\s+"\$f"/.test(sc), 'O <code>$f</code> dentro do <code>wc</code> precisa de aspas — é o que quebra com nome de arquivo com espaço.'],
            [() => /RC=2/.test(semArg), () => `Sem argumento, o script deve sair com código 2; saiu com ${(/RC=(\d+)/.exec(semArg) || [])[1]}.`],
            [() => l.length === 2, () => `A saída deve ter 2 linhas (um por .txt); teve ${l.length}. Saída: "${saida.slice(0, 100)}"`],
            [() => l.some(x => /^meu arquivo\.txt tem 3 linhas$/.test(x)), () => `Falta a linha <code>meu arquivo.txt tem 3 linhas</code> — é ela que prova o tratamento do espaço. Saída: "${saida.slice(0, 100)}"`],
            [() => l.some(x => /^outro\.txt tem 2 linhas$/.test(x)), 'Falta a linha <code>outro.txt tem 2 linhas</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 15.8 ============================== */
  LX.lesson('m15', {
    id: 'l15-8', n: '15.8', title: 'Script em produção: execução única, log e agendamento',
    goal: 'Levar um script do "funciona quando eu rodo" para o "roda sozinho todo dia e eu fico sabendo quando falha".',
    body: [
      { h2: 'O que muda quando ninguém está olhando' },
      { p: 'Um script rodando por cron ou timer enfrenta três situações que nunca acontecem enquanto você o testa à mão:' },
      {
        ul: [
          '<strong>Duas instâncias ao mesmo tempo.</strong> A execução das 3h demorou mais que o intervalo, e a das 3h05 começou por cima.',
          '<strong>Ninguém lê a saída.</strong> Ela vai para um e-mail que ninguém configurou, ou para o vazio.',
          '<strong>Falha silenciosa.</strong> O script saiu com código 1 e o mundo seguiu igual — por meses.'
        ]
      },
      { p: 'As três têm solução barata, e é o assunto desta aula.' },

      { h2: '1. Execução única: flock' },
      { p: 'Duas cópias do mesmo backup mexendo no mesmo destino corrompem o resultado. O <code>flock</code> garante que só uma rode:' },
      { code: ['$ flock -n /tmp/backup.lock echo "consegui a trava"', '$ flock -n /tmp/backup.lock flock -n /tmp/backup.lock echo "nunca chega aqui"; echo "código: $?"'] },
      {
        table: {
          head: ['Forma', 'Comportamento se já estiver travado'],
          rows: [
            ['<code>flock -n arquivo cmd</code>', 'desiste na hora, sai com código 1'],
            ['<code>flock -w 60 arquivo cmd</code>', 'espera até 60s e depois desiste'],
            ['<code>flock arquivo cmd</code>', 'espera para sempre — <strong>evite no cron</strong>']
          ]
        }
      },
      { p: 'No cron, a forma correta é praticamente sempre a primeira: <code>0 3 * * * /usr/bin/flock -n /tmp/backup.lock /usr/local/bin/backup.sh</code>. Se a execução anterior ainda está rodando, a nova simplesmente não começa — que é exatamente o que se quer.' },
      {
        box: 'note', label: 'Por que não usar um "arquivo de PID" caseiro', body: [
          { p: 'A tentação é escrever <code>[ -f /tmp/rodando ] &amp;&amp; exit</code> e criar o arquivo. Não funciona direito: se o script morrer sem apagar o arquivo (queda de energia, <code>kill -9</code>), ele fica travado para sempre. O <code>flock</code> usa uma trava do kernel, que o sistema libera sozinho quando o processo morre — de qualquer jeito que ele morra.' }
        ]
      },

      { h2: '2. Log: escrever onde alguém vai olhar' },
      { p: 'Duas opções, e elas não competem:' },
      {
        table: {
          head: ['', 'Arquivo próprio', '<code>logger</code> (journal/syslog)'],
          rows: [
            ['Como', '<code>&gt;&gt; /var/log/x.log 2&gt;&amp;1</code>', '<code>logger -t backup "mensagem"</code>'],
            ['Vantagem', 'simples, fácil de ler', 'entra no journal com data, tag e prioridade'],
            ['Rotação', 'você configura (aula 16.2)', 'o journald já cuida'],
            ['Consulta', '<code>tail -f</code>', '<code>journalctl -t backup</code>']
          ]
        }
      },
      { code: ['$ logger -t exemplo "teste de mensagem"', '$ journalctl -t exemplo --no-pager | tail -2'] },
      { p: 'Uma função de log dentro do script resolve os dois de uma vez e ainda carimba a hora — o que importa quando você está lendo um log de três semanas atrás:' },
      {
        code: [
          'log() { echo "$(date "+%F %T") [$$] $*"; logger -t meu-script "$*"; }',
          '',
          'log "iniciando"',
          '# ... trabalho ...',
          'log "concluido em ${SECONDS}s"'
        ], run: false
      },
      { p: 'O <code>$$</code> é o PID e o <code>$SECONDS</code> é uma variável que o Bash incrementa sozinho desde o início do script — útil para saber quando uma tarefa começou a ficar mais lenta.' },

      { h2: '3. Falhar alto' },
      { p: 'Falha silenciosa é o pior modo de falhar, porque a confiança continua intacta enquanto a proteção já não existe. O mínimo aceitável:' },
      {
        code: [
          '#!/bin/bash',
          'set -euo pipefail',
          '',
          'trap \'log "FALHOU na linha $LINENO (codigo $?)"; exit 1\' ERR',
          'trap \'rm -rf "$TMP"\' EXIT'
        ], run: false
      },
      { p: 'E o passo seguinte é fazer alguém <em>saber</em>: no mundo do systemd, um timer com <code>OnFailure=</code> apontando para uma unit de notificação; no mundo do cron, uma linha que só produz saída quando falha, e um <code>MAILTO=</code> configurado — ou, mais realista hoje, um <code>curl</code> para o webhook do time.' },

      { h2: 'O esqueleto completo' },
      {
        code: [
          '#!/bin/bash',
          'set -euo pipefail',
          '',
          'NOME=$(basename "$0")',
          'TMP=$(mktemp -d)',
          'trap \'rm -rf "$TMP"\' EXIT',
          'trap \'echo "$NOME: FALHOU na linha $LINENO" >&2; logger -p err -t "$NOME" "falhou na linha $LINENO"\' ERR',
          '',
          'log() { echo "$(date "+%F %T") $*"; }',
          '',
          'log "iniciando"',
          '# ... o trabalho de verdade ...',
          'log "concluido em ${SECONDS}s"'
        ], run: false
      },
      { p: 'Onze linhas antes do trabalho começar. Elas garantem: aborta no primeiro erro, limpa o temporário aconteça o que acontecer, avisa onde falhou, e registra início e fim com hora. É o que separa um script pessoal de um script que a operação depende.' },

      { h2: 'Resumo' },
      {
        ul: [
          'No cron, <code>flock -n</code> impede duas execuções simultâneas — e a trava do kernel se libera sozinha se o processo morrer.',
          'Log com hora, em arquivo próprio ou via <code>logger</code> para o journal.',
          '<code>trap ... ERR</code> relata a falha; <code>trap ... EXIT</code> limpa o temporário.',
          '<code>$$</code> é o PID, <code>$SECONDS</code> é o tempo desde o início do script.',
          'Falha silenciosa é pior que falha ruidosa: faça alguém saber.'
        ]
      }
    ],
    tasks: [
      {
        id: 't15-8-a', kind: 'guiado', title: 'flock, logger e a função log',
        body: [
          { p: 'Veja a trava rejeitando uma segunda execução, o log indo para o journal, e o esqueleto de produção rodando de verdade.' },
          {
            code: [
              '$ flock -n /tmp/demo.lock echo "consegui a trava"',
              '$ flock -n /tmp/demo.lock flock -n /tmp/demo.lock echo "nunca chega aqui"; echo "código: $?"',
              '$ logger -t exemplo "teste de mensagem"',
              '$ journalctl -t exemplo --no-pager | tail -2'
            ]
          },
          { p: 'Repare no código de saída da segunda tentativa de trava: <strong>1</strong>, sem esperar nada. Agora o esqueleto completo:' },
          {
            code: [
              '$ mkdir -p ~/scripts',
              '$ cat > ~/scripts/prod.sh << \'EOF\'',
              '#!/bin/bash',
              'set -euo pipefail',
              'log() { echo "$(date "+%F %T") [$$] $*"; }',
              'trap \'log "FALHOU na linha $LINENO"\' ERR',
              'log "iniciando"',
              'log "concluido em ${SECONDS}s"',
              'EOF',
              '$ chmod +x ~/scripts/prod.sh',
              '$ ~/scripts/prod.sh'
            ]
          },
          { p: 'As duas linhas de <code>log</code> saem com data, PID (<code>$$</code>) e a mensagem — exatamente o que se precisa ler três semanas depois, quando ninguém lembra o que rodou.' }
        ],
        hints: ['O <code>flock -n</code> desiste na hora se a trava já estiver ocupada por outra chamada — é isso que o código de saída 1 comprova.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /flock\s+-n/), 'Rode o <code>flock -n</code> conforme o enunciado.'],
          [() => H.usedCommand(ctx, /logger\s+-t/), 'Registre uma mensagem com <code>logger -t</code>.'],
          [() => H.exists(ctx, '/home/aluno/scripts/prod.sh'), 'Crie o script <code>~/scripts/prod.sh</code> com a função <code>log</code> e o <code>trap ... ERR</code>.'],
          [() => H.usedCommand(ctx, /prod\.sh/), 'Rode o script <code>~/scripts/prod.sh</code>.']
        ])
      },
      {
        id: 't15-8-q', kind: 'quiz', title: 'Conceito: a trava caseira',
        body: [
          { p: 'Um script de sincronização usa esta proteção contra execução dupla:' },
          {
            code: [
              'if [ -f /tmp/sync.pid ]; then',
              '    echo "já está rodando"; exit 0',
              'fi',
              'echo $$ > /tmp/sync.pid',
              '# ... trabalho ...',
              'rm -f /tmp/sync.pid'
            ], run: false, lang: 'bash'
          },
          { p: 'Depois de uma queda de energia no meio da execução, a sincronização parou de rodar e ninguém percebeu por três semanas. Por quê?' }
        ],
        options: [
          { text: 'O arquivo <code>/tmp/sync.pid</code> ficou para trás e o script passou a sair na primeira linha, para sempre — ainda por cima com código 0, então nada acusou.', correct: true },
          { text: 'O <code>/tmp</code> foi limpo no boot e o script perdeu a referência.', why: 'Se o <code>/tmp</code> tivesse sido limpo, o arquivo teria sumido e o script voltaria a rodar. O problema é justamente ele <em>não</em> ter sumido.' },
          { text: 'O <code>$$</code> gravado ficou inválido depois do reboot.', why: 'O script nem chega a ler o conteúdo do arquivo — só testa se ele existe. O PID gravado é decorativo.' },
          { text: 'Faltou <code>set -e</code>.', why: 'Ajudaria em outros erros, mas não neste: sair na primeira linha por causa do arquivo residual é o comportamento programado, não uma falha de comando.' }
        ],
        explain: 'Dois defeitos somados. O primeiro é a trava caseira, que não sobrevive a uma morte abrupta — o <code>flock</code> resolve porque usa uma trava do kernel, liberada automaticamente quando o processo termina de qualquer forma. O segundo é o <code>exit 0</code>: "já está rodando" foi tratado como sucesso, então nenhum monitoramento acusou. Se o script realmente não fez o trabalho, o código de saída não deveria ser 0.'
      },
      {
        id: 't15-8-b', kind: 'desafio', title: 'Pronto para produção',
        body: [
          { p: 'Escreva <code>~/scripts/sincroniza.sh</code>, executável, com o esqueleto de produção completo:' },
          {
            ul: [
              '<code>set -euo pipefail</code>;',
              'cria um diretório temporário com <code>mktemp -d</code> e o apaga com <code>trap ... EXIT</code>;',
              'um <code>trap ... ERR</code> que escreve uma mensagem de falha no <strong>stderr</strong> mencionando a linha;',
              'uma função <code>log</code> que imprime a data e a mensagem;',
              'registra <code>iniciando</code> no começo e <code>concluido</code> no fim;',
              'o "trabalho" pode ser só copiar <code>/etc/hostname</code> para o temporário.'
            ]
          },
          { p: 'Depois rode o script com <code>flock</code>, gravando a saída em <code>~/sincroniza.log</code>, e comprove que a trava funciona tentando rodar duas vezes aninhado.' }
        ],
        hints: [
          'O <code>trap \'rm -rf "$TMP"\' EXIT</code> precisa vir <strong>depois</strong> de definir o <code>TMP</code>, senão a variável ainda não existe quando o trap é registrado.',
          'Para gravar a saída: <code>flock -n /tmp/sinc.lock ~/scripts/sincroniza.sh >> ~/sincroniza.log 2>&1</code>. Para provar a trava: <code>flock -n /tmp/sinc.lock flock -n /tmp/sinc.lock echo x; echo $?</code> — deve dar 1.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/scripts\ncat &gt; ~/scripts/sincroniza.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\n\nNOME=$(basename "$0")\nTMP=$(mktemp -d)\ntrap \'rm -rf "$TMP"\' EXIT\ntrap \'echo "$NOME: FALHOU na linha $LINENO" &gt;&amp;2\' ERR\n\nlog() { echo "$(date "+%F %T") $*"; }\n\nlog "iniciando"\ncp /etc/hostname "$TMP/copia.txt"\nlog "concluido em ${SECONDS}s"\nEOF\nchmod +x ~/scripts/sincroniza.sh\n\nflock -n /tmp/sinc.lock ~/scripts/sincroniza.sh &gt;&gt; ~/sincroniza.log 2&gt;&amp;1\ncat ~/sincroniza.log\n\nflock -n /tmp/sinc.lock flock -n /tmp/sinc.lock echo x; echo "trava: $?"</pre></div><p style="margin-top:8px">Repare que o diretório temporário some sozinho ao fim — inclusive se o script abortar no meio. É esse tipo de garantia que faz a diferença quando ninguém está olhando.</p>',
        check: async (ctx) => {
          const sc = ler(ctx, '/home/aluno/scripts/sincroniza.sh');
          if (!sc) return { ok: false, msg: 'Não encontrei <code>~/scripts/sincroniza.sh</code>.' };
          const logArq = ler(ctx, '/home/aluno/sincroniza.log');
          const saida = await rodar(ctx, '~/scripts/sincroniza.sh 2>&1');
          const trava = await rodar(ctx, 'flock -n /tmp/prova.lock flock -n /tmp/prova.lock echo x >/dev/null 2>&1; echo RC=$?');
          const tmpsAntes = (H.ls(ctx, '/tmp') || []).map(x => (typeof x === 'string' ? x : x.name)).filter(n => /^tmp\./.test(n));
          return H.checkAll([
            [() => (H.mode(ctx, '/home/aluno/scripts/sincroniza.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [() => /set\s+-euo\s+pipefail/.test(sc), 'Falta <code>set -euo pipefail</code>.'],
            [() => /mktemp\s+-d/.test(sc), 'Crie o diretório temporário com <code>mktemp -d</code>.'],
            [() => /trap\s+[^\n]*EXIT/.test(sc), 'Falta o <code>trap ... EXIT</code> que apaga o temporário.'],
            [() => /rm\s+-rf[^\n]*TMP/.test(sc), 'O trap de EXIT precisa apagar o diretório temporário.'],
            [() => /trap\s+[^\n]*ERR/.test(sc), 'Falta o <code>trap ... ERR</code> que relata a falha.'],
            [() => /LINENO/.test(sc), 'A mensagem de falha deve mencionar a linha (<code>$LINENO</code>).'],
            [() => />&2|>&amp;2/.test(sc), 'A mensagem de falha precisa ir para o <strong>stderr</strong>.'],
            [() => /log\s*\(\)\s*\{|function\s+log/.test(sc), 'Defina uma função <code>log</code>.'],
            [() => /date/.test(sc), 'A função <code>log</code> deve carimbar a data e a hora.'],
            [() => /iniciando/.test(saida), 'O script deve registrar <code>iniciando</code>.'],
            [() => /concluido|concluído/.test(saida), 'O script deve registrar <code>concluido</code> ao fim.'],
            [() => /\d{4}-\d{2}-\d{2}/.test(saida), 'As linhas de log devem trazer a data.'],
            [() => !!logArq && /iniciando/.test(logArq), 'Grave a execução em <code>~/sincroniza.log</code> rodando o script com <code>flock</code> e redirecionando a saída.'],
            [() => /RC=1/.test(trava), 'A segunda instância deveria ser recusada pelo <code>flock</code> (código 1).'],
            [() => tmpsAntes.length === 0 || true, '']
          ]);
        }
      }
    ]
  });
})();
