/* =========================================================================
   MÓDULO 15 — Bash scripting
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 15.1 ============================== */
  LX.lesson('m15', {
    id: 'l15-1', n: '15.1', title: 'Do comando ao script',
    goal: 'Escrever, tornar executável e rodar o primeiro script — entendendo o shebang e por que ele importa.',
    body: [
      { lede: 'Script é só uma sequência de comandos em um arquivo. Tudo que você aprendeu nos catorze módulos anteriores já é linguagem de programação — falta só guardar em disco.' },
      {
        code: [
          '$ mkdir -p ~/scripts && cd ~/scripts',
          '$ cat > ola.sh << \'EOF\'',
          '#!/bin/bash',
          'echo "Olá, $USER!"',
          'echo "Hoje é $(date +%d/%m/%Y)"',
          'echo "Você está em $PWD"',
          'EOF',
          '$ cat ola.sh',
          '$ ./ola.sh'
        ]
      },
      { p: 'O erro <code>Permission denied</code> é esperado: o arquivo existe e o conteúdo está certo, mas falta o bit de execução (módulo 5).' },
      { code: ['$ chmod +x ola.sh', '$ ./ola.sh', '$ ls -l ola.sh'] },

      { h2: 'O shebang' },
      { p: 'A primeira linha — <code>#!/bin/bash</code> — não é comentário. É a instrução que diz ao kernel <strong>qual interpretador</strong> deve ler o arquivo.' },
      {
        ascii: `  #!/bin/bash
  ││ └────────┬────────┘
  ││          └─ caminho ABSOLUTO do interpretador
  │└─ "bang"
  └── "she"        →  juntos: she-bang

  Sem shebang, o comportamento depende de quem chamou —
  e você não controla isso.`
      },
      {
        table: {
          head: ['Shebang', 'Quando usar'],
          rows: [
            ['<code>#!/bin/bash</code>', 'você usa recursos do Bash (arrays, <code>[[ ]]</code>, <code>${var^^}</code>)'],
            ['<code>#!/bin/sh</code>', 'script portátil, POSIX puro — roda em qualquer Unix'],
            ['<code>#!/usr/bin/env bash</code>', '<strong>mais portátil</strong>: acha o bash pelo PATH (útil no macOS e BSD)'],
            ['<code>#!/usr/bin/env python3</code>', 'o mesmo vale para qualquer linguagem']
          ]
        }
      },
      {
        box: 'key', body: [
          { p: 'Três formas de rodar um script, com efeitos diferentes:' },
          { ul: [
            '<code>./script.sh</code> — usa o <strong>shebang</strong>; exige bit de execução;',
            '<code>bash script.sh</code> — força o bash; <strong>ignora</strong> o shebang; não exige <code>chmod +x</code>;',
            '<code>source script.sh</code> — roda <strong>no shell atual</strong>: as variáveis e o <code>cd</code> permanecem (módulo 14).'
          ] }
        ]
      },
      { code: ['$ bash ola.sh', '$ source ola.sh', '$ cd ~'] },

      { h2: 'Argumentos' },
      {
        table: {
          head: ['Variável', 'Contém'],
          rows: [
            ['<code>$0</code>', 'o nome do script'],
            ['<code>$1</code>, <code>$2</code>, …', 'os argumentos, em ordem'],
            ['<code>$#</code>', 'a quantidade de argumentos'],
            ['<code>"$@"</code>', '<strong>todos</strong>, cada um como palavra separada — o que você quase sempre quer'],
            ['<code>"$*"</code>', 'todos juntos em uma única palavra'],
            ['<code>$?</code>', 'o código de saída do último comando'],
            ['<code>$$</code>', 'o PID do próprio script']
          ]
        }
      },
      {
        code: [
          '$ cd ~/scripts && cat > args.sh << \'EOF\'',
          '#!/bin/bash',
          'echo "script: $0"',
          'echo "quantidade: $#"',
          'echo "primeiro: $1"',
          'echo "todos: $@"',
          'for a in "$@"; do echo "  - [$a]"; done',
          'EOF',
          '$ chmod +x args.sh',
          '$ ./args.sh alfa "beta gama" delta'
        ]
      },
      { p: 'Repare no último argumento: <code>"beta gama"</code> chegou inteiro porque o laço usa <code>"$@"</code> com aspas. Sem elas, viraria duas palavras — o mesmo problema de aspas do módulo 14, agora com argumentos.' },
      {
        box: 'tip', body: [
          { p: 'Terminou o script? Marque o padrão de saída: <code>exit 0</code> para sucesso, <code>exit 1</code> (ou outro número) para erro. Quem chamar o seu script — um <code>&&</code>, um cron, uma unit do systemd — vai olhar esse número para decidir o que fazer.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't15-1-a', kind: 'guiado', title: 'Seu primeiro script',
        body: [
          { p: 'Crie, torne executável, rode das três formas e trabalhe com argumentos.' },
          {
            code: [
              '$ mkdir -p ~/scripts && cd ~/scripts',
              '$ cat > ola.sh << \'EOF\'',
              '#!/bin/bash',
              'echo "Olá, $USER!"',
              'echo "Hoje é $(date +%d/%m/%Y)"',
              'EOF',
              '$ ./ola.sh',
              '$ chmod +x ola.sh && ./ola.sh',
              '$ bash ola.sh'
            ]
          },
          {
            code: [
              '$ cat > args.sh << \'EOF\'',
              '#!/bin/bash',
              'echo "script: $0"',
              'echo "quantidade: $#"',
              'for a in "$@"; do echo "  - [$a]"; done',
              'EOF',
              '$ chmod +x args.sh',
              '$ ./args.sh alfa "beta gama" delta',
              '$ cd ~'
            ]
          }
        ],
        hints: ['O <code>&lt;&lt; \'EOF\'</code> com aspas simples impede que o shell expanda <code>$USER</code> na hora de <em>criar</em> o arquivo — você quer que a expansão aconteça quando o script <em>rodar</em>.'],
        solution: '<div class="code"><pre>mkdir -p ~/scripts &amp;&amp; cd ~/scripts\ncat &gt; ola.sh &lt;&lt; \'EOF\'\n#!/bin/bash\necho "Olá, $USER!"\necho "Hoje é $(date +%d/%m/%Y)"\nEOF\nchmod +x ola.sh\n./ola.sh\nbash ola.sh\ncat &gt; args.sh &lt;&lt; \'EOF\'\n#!/bin/bash\necho "script: $0"\necho "quantidade: $#"\nfor a in "$@"; do echo "  - [$a]"; done\nEOF\nchmod +x args.sh\n./args.sh alfa "beta gama" delta\ncd ~</pre></div>',
        check: async (ctx) => {
          const ola = H.read(ctx, '/home/aluno/scripts/ola.sh');
          const args = H.read(ctx, '/home/aluno/scripts/args.sh');
          return LX.H.checkAll([
            [ola !== null, 'Crie o script <code>~/scripts/ola.sh</code>.'],
            [/^#!\/(bin\/bash|usr\/bin\/env bash)/.test(ola || ''), 'O script precisa começar com o shebang <code>#!/bin/bash</code>.'],
            [(H.mode(ctx, '/home/aluno/scripts/ola.sh') & 0o100) !== 0, 'Torne o <code>ola.sh</code> executável com <code>chmod +x</code>.'],
            [args !== null, 'Crie também o <code>~/scripts/args.sh</code>.'],
            [/"\$@"/.test(args || ''), 'O <code>args.sh</code> deve percorrer os argumentos com <code>"$@"</code> (com aspas).'],
            [() => H.usedCommand(ctx, /\.\/args\.sh\s+/), 'Rode o <code>./args.sh</code> passando argumentos.']
          ]);
        }
      },
      {
        id: 't15-1-q', kind: 'quiz', title: 'Conceito: as três formas de rodar',
        body: [
          { p: 'Um script <code>entrar.sh</code> contém só <code>cd /var/log</code>. Você quer que, depois de rodá-lo, o <strong>seu</strong> terminal esteja em <code>/var/log</code>. Qual forma funciona?' }
        ],
        options: [
          { text: '<code>source entrar.sh</code> (ou <code>. entrar.sh</code>) — executa no shell atual, então o <code>cd</code> permanece.', correct: true },
          { text: '<code>./entrar.sh</code>, desde que tenha <code>chmod +x</code>.', why: 'Roda em um processo filho: o <code>cd</code> muda o diretório <em>dele</em>, que morre em seguida.' },
          { text: '<code>bash entrar.sh</code>.', why: 'Também cria um processo filho — mesmo resultado.' },
          { text: 'Qualquer uma: o <code>cd</code> sempre afeta o terminal.', why: 'Só afeta quando o script é lido pelo próprio shell.' }
        ],
        explain: 'É a mesma regra do módulo 14: processo filho recebe cópia do ambiente e nada volta. Por isso scripts que <em>configuram</em> a sessão (ativar um ambiente virtual de Python, carregar variáveis) são sempre "sourced" — e por isso o <code>.bashrc</code> também é.'
      },
      {
        id: 't15-1-b', kind: 'desafio', title: 'Um script que presta contas de si mesmo',
        body: [
          { p: 'Crie <code>~/scripts/relatorio.sh</code>, executável, que ao rodar imprime, nesta ordem:' },
          {
            ol: [
              'uma linha com o nome do script, usando <code>$0</code>;',
              'uma linha no formato <code>argumentos: N</code>, usando <code>$#</code>;',
              'uma linha <code>arg: X</code> para <strong>cada</strong> argumento recebido, na ordem em que chegaram — percorra <code>"$@"</code> com um laço, como na tarefa guiada.'
            ]
          },
          { p: 'Termine o script com <code>exit 0</code>. Teste com <code>./relatorio.sh um dois tres</code> antes de considerar pronto.' }
        ],
        hints: [
          'É a mesma estrutura do <code>args.sh</code> da tarefa guiada: <code>cat &gt; relatorio.sh &lt;&lt; \'EOF\'</code> … <code>EOF</code>, depois <code>chmod +x</code>.',
          'Três linhas de <code>echo</code> e um laço: <code>echo "script: $0"</code>, <code>echo "argumentos: $#"</code>, <code>for a in "$@"; do echo "arg: $a"; done</code>, <code>exit 0</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/scripts &amp;&amp; cd ~/scripts\ncat &gt; relatorio.sh &lt;&lt; \'EOF\'\n#!/bin/bash\necho "script: $0"\necho "argumentos: $#"\nfor a in "$@"; do\n  echo "arg: $a"\ndone\nexit 0\nEOF\nchmod +x relatorio.sh\n./relatorio.sh um dois tres\ncd ~</pre></div>',
        check: async (ctx) => {
          const caminho = '/home/aluno/scripts/relatorio.sh';
          const src = H.read(ctx, caminho);
          if (src === null) return { ok: false, msg: 'Crie o script <code>~/scripts/relatorio.sh</code>.' };
          const modo = H.mode(ctx, caminho);
          let saida = '', rc = null;
          if (ctx.run) {
            const r = await ctx.run(`bash ${caminho} um dois tres; echo "RC=$?"`);
            saida = r.out || '';
            rc = (/RC=(\d+)/.exec(saida) || [])[1];
          }
          return LX.H.checkAll([
            [/^#!\/(bin\/bash|usr\/bin\/env bash)/.test(src), 'O script precisa começar com o shebang <code>#!/bin/bash</code>.'],
            [(modo & 0o100) !== 0, 'Torne o script executável com <code>chmod +x</code>.'],
            [() => saida.includes('relatorio.sh'), 'A primeira linha deve mostrar o nome do script — imprima <code>$0</code>.'],
            [() => /argumentos:\s*3/.test(saida), 'Falta a linha <code>argumentos: 3</code> — imprima <code>$#</code>.'],
            [() => ['um', 'dois', 'tres'].every(a => new RegExp('arg:\\s*' + a).test(saida)), 'Falta uma linha <code>arg: X</code> para cada argumento — percorra <code>"$@"</code> com um laço.'],
            [() => rc === '0', 'O script deve terminar com <code>exit 0</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 15.2 ============================== */
  LX.lesson('m15', {
    id: 'l15-2', n: '15.2', title: 'Decisões: if, test e case',
    goal: 'Escrever condições corretas — inclusive as que testam arquivos e as que ninguém acerta de primeira.',
    body: [
      {
        code: [
          'if CONDIÇÃO; then',
          '    comandos',
          'elif OUTRA; then',
          '    comandos',
          'else',
          '    comandos',
          'fi'
        ], run: false, lang: 'bash'
      },
      {
        box: 'key', label: 'O que é uma "condição" no shell', body: [
          { p: 'O <code>if</code> não avalia verdadeiro/falso: ele executa um <strong>comando</strong> e olha o <strong>código de saída</strong>. Zero é sucesso (verdadeiro); qualquer outro número é falso — o inverso da maioria das linguagens.' },
          { p: 'Por isso <code>if grep -q erro log.txt; then</code> funciona: o <code>grep</code> devolve 0 quando encontra. Qualquer comando serve como condição.' }
        ]
      },
      { code: ['$ if true; then echo "true → 0 → executa"; fi', '$ if false; then echo "não aparece"; else echo "false → 1"; fi', '$ if grep -q root /etc/passwd; then echo "root existe"; fi'] },

      { h2: 'Testes: [[ ]] é o que você usa' },
      {
        table: {
          head: ['Forma', 'O que é', 'Recomendação'],
          rows: [
            ['<code>[[ ... ]]</code>', 'construção do Bash', '<strong>use esta</strong>: mais segura e com mais recursos'],
            ['<code>[ ... ]</code>', 'o comando <code>test</code>, herança POSIX', 'só quando o shebang for <code>#!/bin/sh</code>'],
            ['<code>(( ... ))</code>', 'aritmética', 'para comparar números'],
            ['<code>test ...</code>', 'o mesmo que <code>[ ]</code>', 'raro na prática']
          ]
        }
      },
      {
        table: {
          head: ['Teste', 'Verdadeiro quando'],
          rows: [
            ['<code>-e arquivo</code>', 'existe (qualquer tipo)'],
            ['<code>-f arquivo</code>', 'existe e é arquivo comum'],
            ['<code>-d caminho</code>', 'é diretório'],
            ['<code>-r</code> / <code>-w</code> / <code>-x</code>', 'você pode ler / escrever / executar'],
            ['<code>-s arquivo</code>', 'existe e <strong>não</strong> está vazio'],
            ['<code>-z "$var"</code>', 'a string está vazia'],
            ['<code>-n "$var"</code>', 'a string <strong>não</strong> está vazia'],
            ['<code>"$a" == "$b"</code>', 'strings iguais (em <code>[[ ]]</code>)'],
            ['<code>"$a" =~ regex</code>', 'casa a expressão regular'],
            ['<code>$a -eq $b</code>', 'números iguais (<code>-ne -lt -le -gt -ge</code>)']
          ]
        }
      },
      {
        box: 'warn', label: 'Texto e número usam operadores diferentes', body: [
          { p: '<code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&gt;</code> comparam <strong>texto</strong>. <code>-eq</code>, <code>-lt</code>, <code>-gt</code> comparam <strong>números</strong>.' },
          { p: 'Confundir gera bugs silenciosos: <code>[[ "10" &lt; "9" ]]</code> é <strong>verdadeiro</strong>, porque em ordem alfabética "1" vem antes de "9". Já <code>[[ 10 -lt 9 ]]</code> é falso, como esperado.' }
        ]
      },
      {
        code: [
          '$ mkdir -p ~/scripts && cd ~/scripts',
          '$ if [[ "10" < "9" ]]; then echo "texto: 10 < 9 (!)"; fi',
          '$ if (( 10 < 9 )); then echo "num: 10 < 9"; else echo "num: 10 não é < 9"; fi',
          '$ if [[ -f ola.sh ]]; then echo "ola.sh é arquivo"; fi',
          '$ if [[ -d /etc && -r /etc/passwd ]]; then echo "/etc ok"; fi',
          '$ nome=""; if [[ -z "$nome" ]]; then echo "nome vazio"; fi'
        ]
      },
      {
        box: 'tip', body: [
          { p: 'Dentro de <code>[[ ]]</code> você pode dispensar as aspas com segurança, porque não há divisão em palavras. Mas <strong>mantenha o hábito</strong> de usá-las: quando o mesmo teste for parar em um <code>[ ]</code> (POSIX), as aspas passam a ser obrigatórias — e um <code>[ -z $var ]</code> sem aspas com variável vazia vira erro de sintaxe.' }
        ]
      },

      { h2: 'case: quando há vários caminhos' },
      {
        code: [
          'case "$1" in',
          '    start)   echo "iniciando"    ;;',
          '    stop)    echo "parando"      ;;',
          '    restart) echo "reiniciando"  ;;',
          '    *.log)   echo "é um log"     ;;',
          '    "")      echo "sem argumento";;',
          '    *)       echo "uso: $0 {start|stop|restart}"; exit 1 ;;',
          'esac'
        ], run: false, lang: 'bash'
      },
      { p: 'O <code>case</code> usa <strong>padrões glob</strong> (como o <code>*</code> do módulo 2), não regex. Cada ramo termina com <code>;;</code>, e o <code>*)</code> final é o "senão" — sempre inclua um, com mensagem de uso.' },
      {
        code: [
          '$ cat > svc.sh << \'EOF\'',
          '#!/bin/bash',
          'case "${1:-}" in',
          '  start)   echo "iniciando serviço" ;;',
          '  stop)    echo "parando serviço"   ;;',
          '  status)  echo "tudo certo"        ;;',
          '  *)       echo "uso: $0 {start|stop|status}" >&2; exit 1 ;;',
          'esac',
          'EOF',
          '$ chmod +x svc.sh',
          '$ ./svc.sh start',
          '$ ./svc.sh voar; echo "código: $?"',
          '$ cd ~'
        ]
      }
    ],
    tasks: [
      {
        id: 't15-2-a', kind: 'guiado', title: 'Condições na prática',
        body: [
          { p: 'Teste arquivos, compare texto e número, e escreva um <code>case</code>.' },
          {
            code: [
              '$ mkdir -p ~/scripts && cd ~/scripts',
              '$ if [[ "10" < "9" ]]; then echo "texto: 10 < 9 (!)"; fi',
              '$ if (( 10 < 9 )); then echo "num: sim"; else echo "num: nao"; fi',
              '$ if [[ -f ola.sh && -x ola.sh ]]; then echo "ola.sh existe e é executável"; fi',
              '$ nome=""; if [[ -z "$nome" ]]; then echo "vazio"; fi'
            ]
          },
          {
            code: [
              '$ cat > svc.sh << \'EOF\'',
              '#!/bin/bash',
              'case "${1:-}" in',
              '  start)  echo "iniciando" ;;',
              '  stop)   echo "parando" ;;',
              '  *)      echo "uso: $0 {start|stop}" >&2; exit 1 ;;',
              'esac',
              'EOF',
              '$ chmod +x svc.sh && ./svc.sh start',
              '$ ./svc.sh voar; echo "código: $?"',
              '$ cd ~'
            ]
          }
        ],
        hints: ['O <code>&gt;&amp;2</code> manda a mensagem de uso para o canal de erro (módulo 4) — é onde mensagens de uso devem ir.'],
        solution: '<div class="code"><pre>mkdir -p ~/scripts &amp;&amp; cd ~/scripts\nif [[ "10" &lt; "9" ]]; then echo "texto: 10 &lt; 9 (!)"; fi\nif (( 10 &lt; 9 )); then echo "num: sim"; else echo "num: nao"; fi\nif [[ -f ola.sh &amp;&amp; -x ola.sh ]]; then echo "existe e executa"; fi\ncat &gt; svc.sh &lt;&lt; \'EOF\'\n#!/bin/bash\ncase "${1:-}" in\n  start)  echo "iniciando" ;;\n  stop)   echo "parando" ;;\n  *)      echo "uso: $0 {start|stop}" &gt;&amp;2; exit 1 ;;\nesac\nEOF\nchmod +x svc.sh\n./svc.sh start\n./svc.sh voar; echo "código: $?"\ncd ~</pre></div>',
        check: async (ctx) => {
          const svc = H.read(ctx, '/home/aluno/scripts/svc.sh');
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /\[\[/), 'Use a construção <code>[[ ... ]]</code> em um teste.'],
            [() => H.usedCommand(ctx, /\(\(/), 'Compare números com <code>(( ... ))</code>.'],
            [svc !== null, 'Crie o script <code>~/scripts/svc.sh</code>.'],
            [/case\s/.test(svc || '') && /esac/.test(svc || ''), 'O <code>svc.sh</code> deve usar <code>case ... esac</code>.'],
            [/\*\)/.test(svc || ''), 'O <code>case</code> precisa de um ramo padrão <code>*)</code> com a mensagem de uso.'],
            [/exit\s+1/.test(svc || ''), 'O ramo padrão deve sair com <code>exit 1</code>.']
          ]);
        }
      },
      {
        id: 't15-2-f', kind: 'fill', title: 'Complete a condição',
        body: [
          { p: 'Você quer executar um bloco apenas se o arquivo <code>/etc/app.conf</code> <strong>existir e não estiver vazio</strong>.' },
          { p: 'Complete o teste:' }
        ],
        template: 'if [[ ___ /etc/app.conf ]]; then echo ok; fi', sample: '-s',
        answers: ['-s'],
        hints: ['Existe um teste específico para "existe e tem tamanho maior que zero".', 'É o <code>-s</code> (size).'],
        solution: 'A resposta é <code>-s</code>. O <code>-e</code> diria apenas que existe (mesmo vazio) e o <code>-f</code> que é um arquivo comum. O <code>-s</code> junta as duas coisas que interessam ao ler configuração: existe <em>e</em> tem conteúdo.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim();
          if (/^-f\s+.*&&.*-s$/.test(v)) return { ok: true, msg: 'Também vale — mas o <code>-s</code> sozinho já garante que existe.' };
          return LX.H.checkAll([
            [/^-s$/.test(v), 'O teste que verifica "existe e não está vazio" é <code>-s</code>.']
          ]);
        }
      },
      {
        id: 't15-2-b', kind: 'desafio', title: 'Validador de argumentos',
        body: [
          { p: 'Escreva <code>~/scripts/verifica.sh</code>, executável, que receba <strong>um</strong> argumento — um caminho — e imprima <strong>exatamente uma</strong> das linhas abaixo, conforme o caso:' },
          {
            code: [
              'uso: verifica.sh CAMINHO       (quando não recebe argumento; sai com código 1)',
              'diretorio                      (quando o caminho é um diretório)',
              'arquivo vazio                  (quando é arquivo comum e está vazio)',
              'arquivo com conteudo           (quando é arquivo comum e tem conteúdo)',
              'inexistente                    (quando não existe; sai com código 2)'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Teste com os quatro casos:' },
          {
            code: [
              '$ mkdir -p ~/scripts && cd ~/scripts',
              '$ mkdir -p /tmp/dir-teste && : > /tmp/vazio.txt && echo x > /tmp/cheio.txt'
            ]
          },
          { p: 'Depois de escrever, rode: <code>./verifica.sh</code>, <code>./verifica.sh /tmp/dir-teste</code>, <code>./verifica.sh /tmp/vazio.txt</code>, <code>./verifica.sh /tmp/cheio.txt</code> e <code>./verifica.sh /nao/existe</code>.' }
        ],
        hints: [
          'A ordem dos testes importa: verifique primeiro se recebeu argumento, depois se existe, depois o tipo.',
          'Os testes necessários: <code>$#</code> para a contagem, <code>-e</code> para existência, <code>-d</code> para diretório e <code>-s</code> para conteúdo.',
          'Esqueleto: <code>if [[ $# -eq 0 ]]; then ... exit 1; fi</code>; <code>if [[ ! -e "$1" ]]; then echo inexistente; exit 2; fi</code>; depois <code>-d</code> e <code>-s</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/scripts &amp;&amp; cd ~/scripts\ncat &gt; verifica.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nif [[ $# -eq 0 ]]; then\n  echo "uso: $(basename "$0") CAMINHO" &gt;&amp;2\n  exit 1\nfi\n\nif [[ ! -e "$1" ]]; then\n  echo "inexistente"\n  exit 2\nfi\n\nif [[ -d "$1" ]]; then\n  echo "diretorio"\nelif [[ -s "$1" ]]; then\n  echo "arquivo com conteudo"\nelse\n  echo "arquivo vazio"\nfi\nEOF\nchmod +x verifica.sh\n\n./verifica.sh; echo "rc=$?"\n./verifica.sh /tmp/dir-teste\n./verifica.sh /tmp/vazio.txt\n./verifica.sh /tmp/cheio.txt\n./verifica.sh /nao/existe; echo "rc=$?"</pre></div>',
        check: async (ctx) => {
          const caminho = '/home/aluno/scripts/verifica.sh';
          if (!H.exists(ctx, caminho)) return { ok: false, msg: 'Crie o script <code>~/scripts/verifica.sh</code>.' };
          if ((H.mode(ctx, caminho) & 0o100) === 0) return { ok: false, msg: 'O script precisa ser executável (<code>chmod +x</code>).' };
          const rodar = ctx.run;
          const casos = [
            { args: '', espera: /uso:/i, rc: 1, desc: 'sem argumento deve imprimir a linha de uso e sair com 1' },
            { args: '/tmp/dir-teste', espera: /^diretorio$/m, rc: 0, desc: 'um diretório deve imprimir <code>diretorio</code>' },
            { args: '/tmp/vazio.txt', espera: /^arquivo vazio$/m, rc: 0, desc: 'um arquivo vazio deve imprimir <code>arquivo vazio</code>' },
            { args: '/tmp/cheio.txt', espera: /^arquivo com conteudo$/m, rc: 0, desc: 'um arquivo com conteúdo deve imprimir <code>arquivo com conteudo</code>' },
            { args: '/nao/existe', espera: /^inexistente$/m, rc: 2, desc: 'um caminho inexistente deve imprimir <code>inexistente</code> e sair com 2' }
          ];
          await rodar('mkdir -p /tmp/dir-teste; : > /tmp/vazio.txt; echo x > /tmp/cheio.txt');
          for (const c of casos) {
            const r = await rodar(`bash ${caminho} ${c.args} 2>&1; echo "RC=$?"`);
            const saida = (r.out || '');
            const rc = /RC=(\d+)/.exec(saida);
            if (!c.espera.test(saida)) return { ok: false, msg: `Caso <code>${c.args || '(sem argumento)'}</code>: ${c.desc}. Saída obtida: "${saida.replace(/RC=\d+/, '').trim()}".` };
            if (rc && +rc[1] !== c.rc) return { ok: false, msg: `Caso <code>${c.args || '(sem argumento)'}</code>: o código de saída deveria ser ${c.rc}; foi ${rc[1]}.` };
          }
          return { ok: true };
        }
      }
    ]
  });

  /* ============================== 15.3 ============================== */
  LX.lesson('m15', {
    id: 'l15-3', n: '15.3', title: 'Repetição e funções',
    goal: 'Percorrer listas e arquivos com segurança, e organizar o script em funções reutilizáveis.',
    body: [
      { h2: 'for: quando você sabe a lista' },
      {
        code: [
          'for item in lista; do',
          '    comandos com "$item"',
          'done'
        ], run: false, lang: 'bash'
      },
      {
        code: [
          '$ for n in 1 2 3; do echo "número $n"; done',
          '$ for i in {1..5}; do echo -n "$i "; done; echo',
          '$ for f in /etc/*.conf; do echo "conf: $(basename "$f")"; done',
          '$ for u in $(cut -d: -f1 /etc/passwd | head -3); do echo "usuário: $u"; done',
          '$ for ((i=0; i<3; i++)); do echo "c: $i"; done'
        ]
      },
      {
        box: 'warn', label: 'Nunca faça for em saída de ls', body: [
          { p: '<code>for f in $(ls)</code> quebra em qualquer nome com espaço, e ainda expande coringas por acidente. O glob resolve melhor e com segurança:' },
          { code: ['# errado:  for f in $(ls *.txt)', '# certo:   for f in *.txt'], run: false },
          { p: 'E sempre com aspas ao usar: <code>echo "$f"</code>.' }
        ]
      },

      { h2: 'while: quando você não sabe quantas vezes' },
      {
        code: [
          '$ i=0; while (( i < 3 )); do echo "i=$i"; i=$((i+1)); done',
          '$ printf "alfa\\nbeta\\ngama\\n" | while read -r linha; do echo "linha: $linha"; done'
        ]
      },
      {
        box: 'key', label: 'O jeito certo de ler um arquivo linha a linha', body: [
          { code: ['while IFS= read -r linha; do', '    echo "[$linha]"', 'done < arquivo.txt'], run: false, lang: 'bash' },
          { ul: [
            '<code>IFS=</code> impede que espaços do começo e do fim sejam removidos;',
            '<code>-r</code> impede que <code>\\</code> seja interpretado;',
            '<code>&lt; arquivo</code> no fim do <code>done</code> alimenta o laço.'
          ] },
          { p: 'Essa linha, exatamente assim, é a forma canônica. Vale memorizar.' }
        ]
      },
      {
        code: [
          '$ mkdir -p ~/scripts && cd ~/scripts',
          '$ printf "  alfa  \\nbeta\\n" > entrada.txt',
          '$ while IFS= read -r l; do echo "[$l]"; done < entrada.txt',
          '$ while read -r l; do echo "[$l]"; done < entrada.txt'
        ]
      },
      { p: 'Compare: sem o <code>IFS=</code>, os espaços em volta de "alfa" desapareceram.' },
      {
        table: {
          head: ['Controle', 'Faz'],
          rows: [
            ['<code>break</code>', 'sai do laço'],
            ['<code>continue</code>', 'pula para a próxima repetição'],
            ['<code>break 2</code>', 'sai de dois laços aninhados'],
            ['<code>until COND</code>', 'como o <code>while</code>, mas repete enquanto for <em>falso</em>']
          ]
        }
      },

      { h2: 'Funções' },
      {
        code: [
          'nome_da_funcao() {',
          '    local var="$1"        # local: só existe dentro da função',
          '    echo "recebi: $var"',
          '    return 0              # código de saída (0 a 255)',
          '}',
          '',
          'nome_da_funcao "argumento"'
        ], run: false, lang: 'bash'
      },
      {
        box: 'key', body: [
          { p: 'Duas regras que evitam bugs difíceis:' },
          { ul: [
            '<strong>declare antes de usar</strong>: o Bash lê o arquivo de cima para baixo; uma função só existe depois da linha em que foi definida;',
            '<strong>use <code>local</code></strong> em toda variável interna. Sem ele, a variável é global e pode sobrescrever outra do script — inclusive a variável do laço que chamou a função.'
          ] },
          { p: 'E lembre: <code>return</code> devolve <strong>código de saída</strong>, não valor. Para devolver um texto, imprima com <code>echo</code> e capture com <code>$(...)</code>.' }
        ]
      },
      {
        code: [
          '$ cat > func.sh << \'EOF\'',
          '#!/bin/bash',
          'contar_linhas() {',
          '    local arquivo="$1"',
          '    if [[ ! -f "$arquivo" ]]; then',
          '        echo "0"',
          '        return 1',
          '    fi',
          '    wc -l < "$arquivo"',
          '}',
          '',
          'total=$(contar_linhas /etc/passwd)',
          'echo "passwd tem $total linhas"',
          '',
          'if ! contar_linhas /nao/existe > /dev/null; then',
          '    echo "arquivo inexistente detectado pelo return"',
          'fi',
          'EOF',
          '$ chmod +x func.sh && ./func.sh',
          '$ cd ~'
        ]
      },
      { p: 'Repare nas duas formas de usar o resultado: <code>$(funcao)</code> captura o que ela <em>imprimiu</em>; <code>if ! funcao</code> testa o que ela <em>retornou</em>.' }
    ],
    tasks: [
      {
        id: 't15-3-a', kind: 'guiado', title: 'Laços e funções',
        body: [
          { p: 'Percorra listas, leia um arquivo do jeito certo e escreva uma função.' },
          {
            code: [
              '$ mkdir -p ~/scripts && cd ~/scripts',
              '$ for i in {1..5}; do echo -n "$i "; done; echo',
              '$ for f in /etc/*.conf; do echo "conf: $(basename "$f")"; done | head -3',
              '$ printf "  alfa  \\nbeta\\n" > entrada.txt',
              '$ while IFS= read -r l; do echo "[$l]"; done < entrada.txt',
              '$ while read -r l; do echo "[$l]"; done < entrada.txt'
            ]
          },
          {
            code: [
              '$ cat > func.sh << \'EOF\'',
              '#!/bin/bash',
              'contar_linhas() {',
              '    local arquivo="$1"',
              '    [[ -f "$arquivo" ]] || { echo 0; return 1; }',
              '    wc -l < "$arquivo"',
              '}',
              'total=$(contar_linhas /etc/passwd)',
              'echo "passwd tem $total linhas"',
              'EOF',
              '$ chmod +x func.sh && ./func.sh',
              '$ cd ~'
            ]
          }
        ],
        hints: ['O <code>|| { comandos; }</code> é uma forma compacta de "se falhou, faça isto" — as chaves precisam de espaço e do ponto e vírgula final.'],
        solution: '<div class="code"><pre>mkdir -p ~/scripts &amp;&amp; cd ~/scripts\nfor i in {1..5}; do echo -n "$i "; done; echo\nprintf "  alfa  \\nbeta\\n" &gt; entrada.txt\nwhile IFS= read -r l; do echo "[$l]"; done &lt; entrada.txt\ncat &gt; func.sh &lt;&lt; \'EOF\'\n#!/bin/bash\ncontar_linhas() {\n    local arquivo="$1"\n    [[ -f "$arquivo" ]] || { echo 0; return 1; }\n    wc -l &lt; "$arquivo"\n}\ntotal=$(contar_linhas /etc/passwd)\necho "passwd tem $total linhas"\nEOF\nchmod +x func.sh\n./func.sh\ncd ~</pre></div>',
        check: async (ctx) => {
          const func = H.read(ctx, '/home/aluno/scripts/func.sh');
          return LX.H.checkAll([
            [H.exists(ctx, '/home/aluno/scripts/entrada.txt'), 'Crie o arquivo <code>~/scripts/entrada.txt</code>.'],
            [() => H.usedCommand(ctx, /while\s+IFS=\s*read\s+-r/), 'Leia o arquivo com a forma canônica <code>while IFS= read -r linha; do ... done &lt; arquivo</code>.'],
            [func !== null, 'Crie o script <code>~/scripts/func.sh</code>.'],
            [/contar_linhas\s*\(\s*\)/.test(func || ''), 'O script deve definir a função <code>contar_linhas</code>.'],
            [/\blocal\b/.test(func || ''), 'Use <code>local</code> para a variável interna da função.'],
            [/\$\(contar_linhas/.test(func || ''), 'Capture o resultado da função com <code>$(contar_linhas ...)</code>.']
          ]);
        }
      },
      {
        id: 't15-3-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Este script deveria processar todos os arquivos <code>.txt</code> do diretório:' },
          {
            code: [
              'for arquivo in $(ls *.txt); do',
              '    echo "processando $arquivo"',
              '    wc -l $arquivo',
              'done'
            ], run: false, lang: 'bash'
          },
          { p: 'Ele funciona nos testes e falha em produção, onde há um arquivo chamado <code>relatorio final.txt</code>. Quais são os problemas?' }
        ],
        options: [
          {
            text: 'Usar <code>$(ls)</code> em vez do glob, e não usar aspas em <code>$arquivo</code> — o nome com espaço vira duas palavras.',
            correct: true
          },
          { text: 'Falta <code>#!/bin/bash</code> no início.', why: 'Importa, mas não é a causa da falha descrita.' },
          { text: 'O <code>wc -l</code> não aceita nomes com espaço.', why: 'Aceita perfeitamente — desde que receba o nome como <strong>um</strong> argumento.' },
          { text: 'O <code>for</code> não funciona com arquivos; deveria ser <code>while</code>.', why: 'O <code>for</code> com glob é a forma correta e idiomática.' }
        ],
        explain: 'A versão correta é <code>for arquivo in *.txt; do wc -l "$arquivo"; done</code> — glob em vez de <code>$(ls)</code>, e aspas na expansão. Se ainda precisar de <code>find</code> (para descer em subdiretórios), a forma segura é <code>find . -name "*.txt" -print0 | while IFS= read -r -d "" f; do ...</code>, que separa por byte nulo e aguenta qualquer nome.'
      },
      {
        id: 't15-3-b', kind: 'desafio', title: 'Relatório de diretório',
        body: [
          { p: 'Escreva <code>~/scripts/relatorio.sh</code>, executável, que receba um diretório como argumento e produza um relatório.' },
          { p: 'Monte o material de teste:' },
          {
            code: [
              '$ rm -rf /tmp/alvo && mkdir -p /tmp/alvo/sub',
              '$ echo "a" > /tmp/alvo/um.txt',
              '$ echo "bb" > /tmp/alvo/dois.txt',
              '$ echo "ccc" > /tmp/alvo/sub/tres.txt'
            ]
          },
          { p: 'O script deve imprimir <strong>exatamente</strong> três linhas, nesta ordem:' },
          {
            code: [
              'diretorio: /tmp/alvo',
              'arquivos: 2',
              'linhas: 2'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Onde <code>arquivos</code> é a contagem de <strong>arquivos comuns no primeiro nível</strong> (sem entrar em subdiretórios) e <code>linhas</code> é a soma das linhas desses arquivos.' },
          { p: 'Requisitos: se não receber argumento, imprimir uma linha começando com <code>uso:</code> e sair com código 1; se o caminho não for um diretório, imprimir <code>nao e diretorio</code> e sair com código 2. Use ao menos uma <strong>função</strong> e um <strong>laço</strong>.' }
        ],
        hints: [
          'Percorra o primeiro nível com o glob <code>"$dir"/*</code> e teste cada item com <code>[[ -f "$item" ]]</code>.',
          'Some as linhas de cada arquivo com <code>wc -l &lt; "$item"</code> acumulando em uma variável: <code>total=$((total + n))</code>.',
          'Esqueleto: valide os argumentos, defina <code>contar() { ... }</code>, e depois o laço <code>for item in "$dir"/*; do ... done</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/scripts &amp;&amp; cd ~/scripts\ncat &gt; relatorio.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -u\n\nif [[ $# -eq 0 ]]; then\n  echo "uso: $(basename "$0") DIRETORIO" &gt;&amp;2\n  exit 1\nfi\n\ndir="$1"\nif [[ ! -d "$dir" ]]; then\n  echo "nao e diretorio"\n  exit 2\nfi\n\ncontar_linhas() {\n  local arq="$1"\n  wc -l &lt; "$arq"\n}\n\narquivos=0\nlinhas=0\nfor item in "$dir"/*; do\n  [[ -f "$item" ]] || continue\n  arquivos=$((arquivos + 1))\n  n=$(contar_linhas "$item")\n  linhas=$((linhas + n))\ndone\n\necho "diretorio: $dir"\necho "arquivos: $arquivos"\necho "linhas: $linhas"\nEOF\nchmod +x relatorio.sh\n\n./relatorio.sh /tmp/alvo\n./relatorio.sh; echo "rc=$?"\n./relatorio.sh /etc/passwd; echo "rc=$?"</pre></div>',
        check: async (ctx) => {
          const caminho = '/home/aluno/scripts/relatorio.sh';
          const fonte = H.read(ctx, caminho);
          if (fonte === null) return { ok: false, msg: 'Crie o script <code>~/scripts/relatorio.sh</code>.' };
          if ((H.mode(ctx, caminho) & 0o100) === 0) return { ok: false, msg: 'O script precisa ser executável.' };
          if (!/\(\s*\)\s*\{/.test(fonte)) return { ok: false, msg: 'O script deve definir ao menos uma função.' };
          if (!/\b(for|while)\b/.test(fonte)) return { ok: false, msg: 'O script deve usar ao menos um laço (<code>for</code> ou <code>while</code>).' };
          const rodar = ctx.run;
          await rodar('rm -rf /tmp/alvo && mkdir -p /tmp/alvo/sub && echo a > /tmp/alvo/um.txt && echo bb > /tmp/alvo/dois.txt && echo ccc > /tmp/alvo/sub/tres.txt');
          const r1 = await rodar(`bash ${caminho} /tmp/alvo 2>&1`);
          const linhas = (r1.out || '').split('\n').map(x => x.trim()).filter(x => x);
          const r2 = await rodar(`bash ${caminho} 2>&1; echo "RC=$?"`);
          const r3 = await rodar(`bash ${caminho} /etc/passwd 2>&1; echo "RC=$?"`);
          return LX.H.checkAll([
            [linhas.length === 3, `Com um diretório válido, o script deve imprimir exatamente 3 linhas; imprimiu ${linhas.length}: "${linhas.join(' | ')}".`],
            [/^diretorio:\s*\/tmp\/alvo$/.test(linhas[0] || ''), `A primeira linha deve ser <code>diretorio: /tmp/alvo</code>; foi "${linhas[0]}".`],
            [/^arquivos:\s*2$/.test(linhas[1] || ''), `A segunda linha deve ser <code>arquivos: 2</code> (só o primeiro nível); foi "${linhas[1]}".`],
            [/^linhas:\s*2$/.test(linhas[2] || ''), `A terceira linha deve ser <code>linhas: 2</code> (soma das linhas dos arquivos do primeiro nível); foi "${linhas[2]}".`],
            [/uso:/i.test(r2.out || ''), 'Sem argumento, o script deve imprimir uma linha começando com <code>uso:</code>.'],
            [/RC=1/.test(r2.out || ''), 'Sem argumento, o código de saída deve ser 1.'],
            [/nao e diretorio/.test(r3.out || ''), 'Com um caminho que não é diretório, o script deve imprimir <code>nao e diretorio</code>.'],
            [/RC=2/.test(r3.out || ''), 'Com um caminho que não é diretório, o código de saída deve ser 2.']
          ]);
        }
      }
    ]
  });

  /* ============================== 15.4 ============================== */
  LX.lesson('m15', {
    id: 'l15-4', n: '15.4', title: 'Scripts que não quebram',
    goal: 'Aplicar o cabeçalho defensivo, tratar erros e sinais, e validar o script antes de confiar nele.',
    body: [
      { lede: 'A diferença entre um script de teste e um script de produção cabe em quatro linhas de cabeçalho e um hábito de validação.' },
      { h2: 'O cabeçalho que todo script deveria ter' },
      {
        code: [
          '#!/usr/bin/env bash',
          'set -euo pipefail',
          'IFS=$\'\\n\\t\''
        ], run: false, lang: 'bash'
      },
      {
        table: {
          head: ['Opção', 'Faz', 'Evita'],
          rows: [
            ['<code>set -e</code>', 'aborta no primeiro comando que falhar', 'seguir em frente depois de um erro'],
            ['<code>set -u</code>', 'aborta se uma variável não definida for usada', '<code>rm -rf "$DIR/"</code> com <code>DIR</code> vazio'],
            ['<code>set -o pipefail</code>', 'o pipeline falha se <strong>qualquer</strong> etapa falhar', 'o problema do módulo 4: <code>curl | jq</code> "com sucesso"'],
            ['<code>IFS=$\'\\n\\t\'</code>', 'divide só por quebra de linha e tabulação', 'quebrar em nomes com espaço']
          ]
        }
      },
      {
        code: [
          '$ mkdir -p ~/scripts && cd ~/scripts',
          '$ cat > frageis.sh << \'EOF\'',
          '#!/bin/bash',
          'echo "linha 1"',
          'cat /arquivo/que/nao/existe',
          'echo "linha 3 — eu não deveria aparecer"',
          'EOF',
          '$ chmod +x frageis.sh && ./frageis.sh; echo "código: $?"'
        ]
      },
      { p: 'Sem <code>set -e</code>, o script continuou depois do erro e ainda terminou com código 0 — mentindo para quem o chamou. Agora com o cabeçalho:' },
      {
        code: [
          '$ cat > robusto.sh << \'EOF\'',
          '#!/bin/bash',
          'set -euo pipefail',
          'echo "linha 1"',
          'cat /arquivo/que/nao/existe',
          'echo "linha 3 — eu não deveria aparecer"',
          'EOF',
          '$ chmod +x robusto.sh && ./robusto.sh; echo "código: $?"'
        ]
      },
      {
        box: 'warn', label: 'set -e tem limites', body: [
          { p: 'Ele <strong>não</strong> aborta quando o comando faz parte de um <code>if</code>, de um <code>&&</code>/<code>||</code>, ou está negado com <code>!</code> — o que é ótimo, porque nesses casos a falha é esperada.' },
          { p: 'A consequência prática: <code>comando || true</code> é a forma explícita de dizer "aqui a falha é aceitável". E, para checar algo sem abortar, use <code>if ! comando; then ... fi</code>.' }
        ]
      },

      { h2: 'Mensagens e códigos de saída' },
      {
        code: [
          'erro() {',
          '    echo "ERRO: $*" >&2',
          '    exit 1',
          '}',
          '',
          'aviso() { echo "AVISO: $*" >&2; }',
          'info()  { echo "$*"; }',
          '',
          '[[ -f "$CONFIG" ]] || erro "arquivo de configuração não encontrado: $CONFIG"'
        ], run: false, lang: 'bash'
      },
      { p: 'Duas regras que fazem o script conviver bem com o resto do sistema: <strong>mensagens de erro vão para o canal 2</strong> (<code>&gt;&amp;2</code>), e <strong>o código de saída é a resposta oficial</strong> — 0 para sucesso, diferente de zero para falha.' },

      { h2: 'trap: limpar antes de sair' },
      { p: 'O <code>trap</code> registra um comando para rodar quando o script termina ou recebe um sinal (módulo 7) — é como se garante que arquivos temporários não fiquem para trás:' },
      {
        code: [
          '$ cat > limpa.sh << \'EOF\'',
          '#!/bin/bash',
          'set -euo pipefail',
          '',
          'TMP=$(mktemp -d)',
          'trap \'rm -rf "$TMP"; echo "limpei $TMP"\' EXIT',
          '',
          'echo "trabalhando em $TMP"',
          'echo dados > "$TMP/arquivo.txt"',
          'ls "$TMP"',
          'EOF',
          '$ chmod +x limpa.sh && ./limpa.sh',
          '$ ls /tmp | grep -c tmp || echo "nada ficou para trás"'
        ]
      },
      {
        table: {
          head: ['Sinal', 'Quando dispara'],
          rows: [
            ['<code>EXIT</code>', 'sempre que o script termina — <strong>o mais usado</strong>'],
            ['<code>INT</code>', 'Ctrl+C'],
            ['<code>TERM</code>', '<code>kill</code> padrão'],
            ['<code>ERR</code>', 'em qualquer comando que falhe (com <code>set -e</code>)']
          ]
        }
      },

      { h2: 'Validar antes de confiar' },
      { cmd: 'shellcheck' },
      { p: 'O <code>shellcheck</code> lê o script e aponta os erros clássicos — variáveis sem aspas, <code>$(ls)</code>, comparações trocadas — antes de você descobrir em produção:' },
      {
        code: [
          '$ cat > suspeito.sh << \'EOF\'',
          '#!/bin/bash',
          'ARQ=$1',
          'rm -rf $ARQ/*',
          'for f in $(ls *.txt); do echo $f; done',
          'EOF',
          '$ shellcheck suspeito.sh',
          '$ bash -n suspeito.sh && echo "sintaxe ok"',
          '$ cd ~'
        ]
      },
      {
        cheat: [
          ['<code>bash -n script.sh</code>', 'só checa a <strong>sintaxe</strong>, não executa'],
          ['<code>bash -x script.sh</code>', 'mostra cada comando conforme executa (depuração)'],
          ['<code>set -x</code> / <code>set +x</code>', 'liga e desliga o rastreamento em um trecho'],
          ['<code>shellcheck script.sh</code>', 'análise estática — pega o que os olhos não pegam'],
          ['<code>PS4=\'+${LINENO}: \'</code>', 'faz o <code>-x</code> mostrar o número da linha']
        ]
      },
      {
        box: 'key', label: 'A rotina antes de colocar em produção', body: [
          { ol: [
            'cabeçalho <code>set -euo pipefail</code>;',
            '<code>bash -n</code> para a sintaxe;',
            '<code>shellcheck</code> e resolver o que ele apontar;',
            'testar com entradas ruins — sem argumento, caminho inexistente, nome com espaço;',
            'conferir o código de saída em cada caso;',
            'só então agendar no cron ou no systemd.'
          ] }
        ]
      }
    ],
    tasks: [
      {
        id: 't15-4-a', kind: 'guiado', title: 'Frágil × robusto',
        body: [
          { p: 'Compare o mesmo script com e sem o cabeçalho, e experimente o <code>trap</code>.' },
          {
            code: [
              '$ mkdir -p ~/scripts && cd ~/scripts',
              '$ printf \'#!/bin/bash\\necho "linha 1"\\ncat /nao/existe\\necho "linha 3"\\n\' > frageis.sh',
              '$ chmod +x frageis.sh && ./frageis.sh; echo "código: $?"',
              '$ printf \'#!/bin/bash\\nset -euo pipefail\\necho "linha 1"\\ncat /nao/existe\\necho "linha 3"\\n\' > robusto.sh',
              '$ chmod +x robusto.sh && ./robusto.sh; echo "código: $?"'
            ]
          },
          {
            code: [
              '$ cat > limpa.sh << \'EOF\'',
              '#!/bin/bash',
              'set -euo pipefail',
              'TMP=$(mktemp -d)',
              'trap \'rm -rf "$TMP"; echo "limpei $TMP"\' EXIT',
              'echo "trabalhando em $TMP"',
              'EOF',
              '$ chmod +x limpa.sh && ./limpa.sh',
              '$ bash -n limpa.sh && echo "sintaxe ok"',
              '$ cd ~'
            ]
          }
        ],
        hints: ['Compare os dois códigos de saída: o script frágil termina com 0 mesmo tendo falhado.'],
        solution: '<div class="code"><pre>mkdir -p ~/scripts &amp;&amp; cd ~/scripts\nprintf \'#!/bin/bash\\necho "linha 1"\\ncat /nao/existe\\necho "linha 3"\\n\' &gt; frageis.sh\nchmod +x frageis.sh &amp;&amp; ./frageis.sh; echo "código: $?"\nprintf \'#!/bin/bash\\nset -euo pipefail\\necho "linha 1"\\ncat /nao/existe\\necho "linha 3"\\n\' &gt; robusto.sh\nchmod +x robusto.sh &amp;&amp; ./robusto.sh; echo "código: $?"\ncat &gt; limpa.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\nTMP=$(mktemp -d)\ntrap \'rm -rf "$TMP"; echo "limpei $TMP"\' EXIT\necho "trabalhando em $TMP"\nEOF\nchmod +x limpa.sh &amp;&amp; ./limpa.sh\nbash -n limpa.sh &amp;&amp; echo "sintaxe ok"\ncd ~</pre></div>',
        check: async (ctx) => {
          const rob = H.read(ctx, '/home/aluno/scripts/robusto.sh');
          const limpa = H.read(ctx, '/home/aluno/scripts/limpa.sh');
          /* não basta o texto conter "set -e": o script tem de realmente
             abortar. O verificador roda os dois e compara os códigos. */
          let rcFragil = null, rcRobusto = null, saidaLimpa = '';
          if (ctx.run) {
            if (H.exists(ctx, '/home/aluno/scripts/frageis.sh')) {
              const r = await ctx.run('bash ~/scripts/frageis.sh >/dev/null 2>&1; echo RC=$?');
              rcFragil = (/RC=(\d+)/.exec(r.out) || [])[1];
            }
            if (rob !== null) {
              const r = await ctx.run('bash ~/scripts/robusto.sh >/dev/null 2>&1; echo RC=$?');
              rcRobusto = (/RC=(\d+)/.exec(r.out) || [])[1];
            }
            if (limpa !== null) saidaLimpa = (await ctx.run('bash ~/scripts/limpa.sh 2>&1')).out || '';
          }
          return LX.H.checkAll([
            [H.exists(ctx, '/home/aluno/scripts/frageis.sh'), 'Crie o script frágil para comparar.'],
            [rob !== null && /set\s+-euo\s+pipefail/.test(rob), 'O <code>robusto.sh</code> deve ter <code>set -euo pipefail</code>.'],
            [() => rcFragil === null || rcFragil === '0', () => `O <code>frageis.sh</code> deveria terminar com código 0 apesar da falha (é esse o problema que ele demonstra); terminou com ${rcFragil}.`],
            [() => rcRobusto === null || rcRobusto !== '0', 'O <code>robusto.sh</code> ainda termina com código 0. Com <code>set -e</code> ele precisa abortar no <code>cat</code> que falha e sair com código diferente de zero.'],
            [limpa !== null && /trap\s/.test(limpa), 'O <code>limpa.sh</code> deve registrar um <code>trap</code>.'],
            [limpa !== null && /EXIT/.test(limpa), 'O <code>trap</code> deve disparar no <code>EXIT</code>.'],
            [() => !ctx.run || /limpei/.test(saidaLimpa), 'Ao rodar o <code>limpa.sh</code>, o <code>trap</code> deveria imprimir a mensagem de limpeza. Ele não disparou.'],
            [() => H.usedCommand(ctx, /bash\s+-n/), 'Valide a sintaxe com <code>bash -n</code>.']
          ]);
        }
      },
      {
        id: 't15-4-q', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Um script de limpeza contém:' },
          {
            code: [
              '#!/bin/bash',
              'DESTINO="$1"',
              'rm -rf "$DESTINO"/cache/*'
            ], run: false, lang: 'bash'
          },
          { p: 'Ele é chamado <strong>sem argumento</strong> por um cron mal configurado. O que acontece, e qual linha teria evitado?' }
        ],
        options: [
          {
            text: 'O comando vira <code>rm -rf /cache/*</code> — apagando na raiz do sistema. Um <code>set -u</code> teria abortado o script antes, ao expandir a variável não definida.',
            correct: true
          },
          { text: 'Nada acontece: o <code>rm</code> reclama de argumento vazio.', why: 'O <code>rm</code> recebe um caminho perfeitamente válido — só que não é o pretendido.' },
          { text: 'O script falha com erro de sintaxe.', why: 'A sintaxe é válida; esse é justamente o perigo.' },
          { text: 'As aspas em <code>"$DESTINO"</code> já protegem contra isso.', why: 'As aspas protegem contra divisão em palavras, não contra a variável estar vazia.' }
        ],
        explain: 'Duas defesas somadas resolvem: <code>set -u</code> aborta em variável indefinida, e uma validação explícita torna a intenção clara — <code>DESTINO="${1:?informe o destino}"</code>. Bugs dessa família já apagaram diretórios inteiros em incidentes públicos famosos; o custo da prevenção é uma linha.'
      },
      {
        id: 't15-4-b', kind: 'desafio', title: 'Script de backup de produção',
        body: [
          { p: 'Junte tudo: escreva <code>~/scripts/backup.sh</code>, executável, que faça um backup de verdade — com validação, tratamento de erro e limpeza.' },
          { p: 'Prepare o material:' },
          {
            code: [
              '$ rm -rf /tmp/origem /tmp/destino && mkdir -p /tmp/origem/logs /tmp/destino',
              '$ echo "dados" > /tmp/origem/base.csv',
              '$ echo "log" > /tmp/origem/logs/app.log'
            ]
          },
          { p: 'Especificação:' },
          {
            ul: [
              'uso: <code>backup.sh ORIGEM DESTINO</code>;',
              'cabeçalho com <code>set -euo pipefail</code>;',
              'sem os dois argumentos: imprime linha começando com <code>uso:</code> no <strong>canal de erro</strong> e sai com <strong>1</strong>;',
              'se a origem não existir ou não for diretório: imprime mensagem contendo <code>origem</code> no canal de erro e sai com <strong>2</strong>;',
              'cria em DESTINO um arquivo <code>backup-AAAAMMDD.tar.gz</code> com o conteúdo da origem;',
              'ao final, imprime na saída padrão uma linha começando com <code>ok:</code> seguida do caminho do arquivo criado;',
              'usa <code>trap</code> para garantir limpeza (mesmo que só imprima algo no EXIT).'
            ]
          },
          { p: 'Teste os três casos antes de concluir: sem argumentos, com origem inválida, e o caso feliz.' }
        ],
        hints: [
          'Comece pela validação: <code>[[ $# -eq 2 ]] || { echo "uso: ..." &gt;&amp;2; exit 1; }</code>.',
          'A data vai em uma variável: <code>data=$(date +%Y%m%d)</code>; o arquivo é <code>"$destino/backup-$data.tar.gz"</code>.',
          'Para empacotar com caminhos relativos: <code>tar -czf "$arquivo" -C "$(dirname "$origem")" "$(basename "$origem")"</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/scripts &amp;&amp; cd ~/scripts\ncat &gt; backup.sh &lt;&lt; \'EOF\'\n#!/usr/bin/env bash\nset -euo pipefail\n\nerro() { echo "ERRO: $*" &gt;&amp;2; exit "${2:-1}"; }\n\nif [[ $# -ne 2 ]]; then\n  echo "uso: $(basename "$0") ORIGEM DESTINO" &gt;&amp;2\n  exit 1\nfi\n\norigem="$1"\ndestino="$2"\n\nif [[ ! -d "$origem" ]]; then\n  echo "ERRO: origem invalida: $origem" &gt;&amp;2\n  exit 2\nfi\n\nmkdir -p "$destino"\ntrap \'echo "finalizado" &gt; /dev/null\' EXIT\n\ndata=$(date +%Y%m%d)\narquivo="$destino/backup-$data.tar.gz"\n\ntar -czf "$arquivo" -C "$(dirname "$origem")" "$(basename "$origem")"\n\necho "ok: $arquivo"\nEOF\nchmod +x backup.sh\n\nbash -n backup.sh &amp;&amp; echo "sintaxe ok"\n./backup.sh; echo "rc=$?"\n./backup.sh /nao/existe /tmp/destino; echo "rc=$?"\n./backup.sh /tmp/origem /tmp/destino; echo "rc=$?"\nls -l /tmp/destino</pre></div><p style="margin-top:8px">Compare com o backup manual do módulo 13: é o mesmo trabalho, agora com validação, código de saída honesto e um nome de arquivo que a máquina calcula. É isso que permite agendar no cron (módulo 8) e dormir tranquilo.</p>',
        check: async (ctx) => {
          const caminho = '/home/aluno/scripts/backup.sh';
          const fonte = H.read(ctx, caminho);
          if (fonte === null) return { ok: false, msg: 'Crie o script <code>~/scripts/backup.sh</code>.' };
          if ((H.mode(ctx, caminho) & 0o100) === 0) return { ok: false, msg: 'O script precisa ser executável.' };
          const rodar = ctx.run;
          await rodar('rm -rf /tmp/origem /tmp/destino && mkdir -p /tmp/origem/logs /tmp/destino && echo dados > /tmp/origem/base.csv && echo log > /tmp/origem/logs/app.log');
          const semArgs = await rodar(`bash ${caminho} 2>&1; echo "RC=$?"`);
          const origemRuim = await rodar(`bash ${caminho} /nao/existe /tmp/destino 2>&1; echo "RC=$?"`);
          const feliz = await rodar(`bash ${caminho} /tmp/origem /tmp/destino 2>&1; echo "RC=$?"`);
          const hoje = new Date();
          const nomeEsperado = 'backup-' + hoje.getFullYear() + String(hoje.getMonth() + 1).padStart(2, '0') + String(hoje.getDate()).padStart(2, '0') + '.tar.gz';
          const criados = (H.ls(ctx, '/tmp/destino') || []).map(e => e.name || e);
          const pacote = H.read(ctx, '/tmp/destino/' + nomeEsperado) || '';
          let entradas = {};
          try { entradas = JSON.parse(pacote.slice(pacote.indexOf('{'))); } catch (e) { }
          const chaves = Object.keys(entradas);
          return LX.H.checkAll([
            [/set\s+-euo\s+pipefail/.test(fonte), 'O script precisa do cabeçalho <code>set -euo pipefail</code>.'],
            [/\btrap\b/.test(fonte), 'O script precisa registrar um <code>trap</code>.'],
            [/uso:/i.test(semArgs.out || ''), 'Sem argumentos, o script deve imprimir uma linha começando com <code>uso:</code>.'],
            [/RC=1/.test(semArgs.out || ''), `Sem argumentos, o código de saída deve ser 1. Saída: "${(semArgs.out || '').trim().slice(0, 80)}".`],
            [/origem/i.test(origemRuim.out || ''), 'Com origem inválida, a mensagem de erro deve mencionar a origem.'],
            [/RC=2/.test(origemRuim.out || ''), 'Com origem inválida, o código de saída deve ser 2.'],
            [/RC=0/.test(feliz.out || ''), `No caso feliz o script deve terminar com 0. Saída: "${(feliz.out || '').trim().slice(0, 120)}".`],
            [/^ok:/m.test(feliz.out || ''), 'No caso feliz, o script deve imprimir uma linha começando com <code>ok:</code>.'],
            [criados.includes(nomeEsperado), `O backup deve se chamar <code>${nomeEsperado}</code>. Em /tmp/destino: ${criados.join(', ') || '(nada)'}.`],
            [chaves.some(k => /base\.csv$/.test(k)), 'O pacote deve conter o <code>base.csv</code> da origem.'],
            [chaves.some(k => /logs\/app\.log$/.test(k)), 'O pacote deve conter também o <code>logs/app.log</code>.']
          ]);
        }
      }
    ]
  });

})();
