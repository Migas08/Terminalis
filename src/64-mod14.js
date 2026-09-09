/* =========================================================================
   MÓDULO 14 — Variáveis e ambiente
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 14.1 ============================== */
  LX.lesson('m14', {
    id: 'l14-1', n: '14.1', title: 'Variáveis do shell',
    goal: 'Criar, usar e manipular variáveis sem cair nas armadilhas de espaço, aspas e expansão.',
    body: [
      { p: 'Uma variável no shell é um nome guardando um texto. Simples assim — e é justamente a simplicidade que gera as armadilhas.' },
      {
        code: [
          '$ NOME="Ana Souza"',
          '$ echo $NOME',
          '$ echo "Olá, $NOME!"',
          '$ echo ${NOME}Silva'
        ]
      },
      {
        box: 'warn', label: 'As três regras que quebram todo iniciante', body: [
          { ol: [
            '<strong>Sem espaços ao redor do <code>=</code></strong>. <code>NOME = "Ana"</code> não é atribuição: o shell entende "execute o comando <code>NOME</code> com os argumentos <code>=</code> e <code>Ana</code>".',
            '<strong>Sem <code>$</code> ao atribuir, com <code>$</code> ao usar.</strong> <code>NOME="Ana"</code> para criar; <code>echo $NOME</code> para ler.',
            '<strong>Valor com espaço exige aspas.</strong> <code>NOME=Ana Souza</code> tenta rodar <code>Souza</code> com a variável <code>NOME</code> definida só para aquele comando.'
          ] }
        ]
      },
      { p: 'Veja os erros acontecendo — é mais didático do que ler sobre eles:' },
      {
        code: [
          '$ NOME = "Ana"',
          '$ NOME=Ana Souza',
          '$ NOME="Ana Souza" && echo "certo: $NOME"'
        ]
      },

      { h2: 'Aspas: a diferença que decide tudo' },
      {
        table: {
          head: ['Forma', 'Expande variáveis?', 'Quando usar'],
          rows: [
            ['<code>"$VAR"</code>', '<strong>sim</strong>', 'quase sempre — o padrão'],
            ['<code>\'$VAR\'</code>', 'não (texto literal)', 'quando você quer o cifrão mesmo'],
            ['<code>$VAR</code> sem aspas', 'sim, e ainda <strong>divide em palavras</strong>', 'só quando você <em>quer</em> a divisão'],
            ['<code>${VAR}</code>', 'sim', 'quando o nome cola em outro texto']
          ]
        }
      },
      {
        code: [
          '$ ARQ="meu relatorio.txt"',
          '$ touch "$ARQ" && ls -l "$ARQ"',
          '$ rm $ARQ',
          '$ ls',
          '$ rm "$ARQ" 2>/dev/null; ls'
        ]
      },
      {
        box: 'key', body: [
          { p: 'O <code>rm $ARQ</code> sem aspas virou <code>rm meu relatorio.txt</code> — <strong>dois</strong> argumentos. Em um script que apaga arquivos, esse detalhe é a diferença entre remover o arquivo certo e remover dois arquivos errados.' },
          { p: 'A regra que evita 90% dos bugs de script: <strong>toda expansão de variável entre aspas duplas</strong>, a menos que você tenha um motivo consciente para não usar.' }
        ]
      },

      { h2: 'Manipular o valor' },
      { p: 'O Bash tem uma sintaxe compacta para operações comuns, sem precisar chamar programas externos:' },
      {
        table: {
          head: ['Expressão', 'Faz', 'Exemplo com <code>f=/var/log/app.log</code>'],
          rows: [
            ['<code>${#var}</code>', 'comprimento', '<code>16</code>'],
            ['<code>${var#pad}</code>', 'remove do início (menor)', '<code>${f#*/}</code> → <code>var/log/app.log</code>'],
            ['<code>${var##pad}</code>', 'remove do início (maior)', '<code>${f##*/}</code> → <code>app.log</code>'],
            ['<code>${var%pad}</code>', 'remove do fim (menor)', '<code>${f%.log}</code> → <code>/var/log/app</code>'],
            ['<code>${var%%pad}</code>', 'remove do fim (maior)', '—'],
            ['<code>${var/a/b}</code>', 'substitui a primeira', '<code>${f/log/LOG}</code>'],
            ['<code>${var//a/b}</code>', 'substitui todas', '—'],
            ['<code>${var:0:3}</code>', 'fatia (início, tamanho)', '<code>/va</code>'],
            ['<code>${var^^}</code> / <code>${var,,}</code>', 'maiúsculas / minúsculas', '—']
          ]
        }
      },
      {
        code: [
          '$ f=/var/log/app.log',
          '$ echo "nome: ${f##*/}"',
          '$ echo "diretorio: ${f%/*}"',
          '$ echo "sem extensao: ${f%.log}"',
          '$ echo "tamanho: ${#f}"',
          '$ echo "maiusculo: ${f^^}"'
        ]
      },
      { p: 'As duas primeiras substituem <code>basename</code> e <code>dirname</code> — sem criar processo, o que importa quando o script roda mil vezes.' },

      { h2: 'Valores padrão' },
      {
        table: {
          head: ['Expressão', 'Significa'],
          rows: [
            ['<code>${VAR:-padrão}</code>', 'usa <code>padrão</code> se vazia — <strong>não altera</strong> a variável'],
            ['<code>${VAR:=padrão}</code>', 'usa e <strong>define</strong> a variável'],
            ['<code>${VAR:?mensagem}</code>', '<strong>aborta</strong> com erro se estiver vazia'],
            ['<code>${VAR:+alternativo}</code>', 'usa <code>alternativo</code> apenas se a variável <em>estiver</em> definida']
          ]
        }
      },
      {
        code: [
          '$ unset PORTA',
          '$ echo "porta: ${PORTA:-8080}"',
          '$ echo "ainda vazia: [$PORTA]"',
          '$ echo "porta: ${PORTA:=8080}"',
          '$ echo "agora definida: [$PORTA]"'
        ]
      },
      {
        box: 'tip', body: [
          { p: 'O <code>${VAR:?}</code> é a melhor forma de exigir uma variável em um script: <code>DB_HOST="${DB_HOST:?defina DB_HOST antes de rodar}"</code>. O script para na hora, com uma mensagem clara, em vez de seguir com um valor vazio e falhar dez linhas depois de forma misteriosa.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't14-1-a', kind: 'guiado', title: 'Aspas, expansões e padrões',
        body: [
          { p: 'Veja os erros clássicos e as expansões que economizam comandos.' },
          {
            code: [
              '$ NOME = "Ana"',
              '$ NOME=Ana Souza',
              '$ NOME="Ana Souza"; echo "Olá, $NOME!"',
              '$ echo \'literal: $NOME\''
            ]
          },
          {
            code: [
              '$ f=/var/log/app.log',
              '$ echo "${f##*/}"',
              '$ echo "${f%/*}"',
              '$ echo "${f%.log}.old"',
              '$ echo "${#f}"',
              '$ unset PORTA; echo "${PORTA:-8080}"; echo "${PORTA:=9090}"; echo "$PORTA"'
            ]
          }
        ],
        hints: ['As duas primeiras linhas <strong>vão dar erro</strong> — é esse o ponto.'],
        solution: '<div class="code"><pre>NOME="Ana Souza"\necho "Olá, $NOME!"\necho \'literal: $NOME\'\nf=/var/log/app.log\necho "${f##*/}"\necho "${f%/*}"\necho "${f%.log}.old"\necho "${#f}"\nunset PORTA\necho "${PORTA:-8080}"\necho "${PORTA:=9090}"\necho "$PORTA"</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /NOME\s*=\s*"?Ana/), 'Defina a variável <code>NOME</code>.'],
          [() => H.usedCommand(ctx, /\$\{[a-zA-Z_]+##/), 'Experimente a expansão <code>${f##*/}</code>.'],
          [() => H.usedCommand(ctx, /\$\{[a-zA-Z_]+%/), 'Experimente também <code>${f%...}</code>.'],
          [() => H.usedCommand(ctx, /:-|:=/), 'Use um valor padrão com <code>${VAR:-padrão}</code>.'],
          [() => { const v = ctx.sh.getVar('PORTA'); return v === '9090'; }, 'Ao final, a variável <code>PORTA</code> deveria valer <code>9090</code> (efeito do <code>${PORTA:=9090}</code>).']
        ])
      },
      {
        id: 't14-1-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um script de limpeza contém:' },
          {
            code: [
              'PASTA="/var/log/meu app"',
              'rm -rf $PASTA/*.log'
            ], run: false, mixed: false
          },
          { p: 'O que acontece quando ele roda?' }
        ],
        options: [
          { text: 'O shell divide o valor em duas palavras e o comando vira <code>rm -rf /var/log/meu app/*.log</code> — apagando o que casar em <code>/var/log/meu</code> e em <code>app/*.log</code> a partir do diretório atual.', correct: true },
          { text: 'Funciona normalmente: as aspas na atribuição bastam.', why: 'As aspas protegem a <em>atribuição</em>; a divisão em palavras acontece depois, na <em>expansão</em>.' },
          { text: 'O script falha com erro de sintaxe.', why: 'Não há erro de sintaxe — é justamente por isso que o bug passa despercebido.' },
          { text: 'O <code>rm</code> ignora caminhos com espaço por segurança.', why: 'O <code>rm</code> recebe apenas os argumentos já divididos; ele não tem como saber que eram um caminho só.' }
        ],
        explain: 'A correção é <code>rm -rf "$PASTA"/*.log</code> — aspas na expansão, com o coringa <strong>fora</strong> delas (dentro das aspas o <code>*</code> não expandiria). Essa classe de bug já apagou diretórios inteiros em produção; é o motivo de o <code>shellcheck</code> (módulo 15) reclamar de toda variável sem aspas.'
      },
      {
        id: 't14-1-b', kind: 'desafio', title: 'Renomeie em lote sem chamar programa nenhum',
        body: [
          { p: 'Monte os arquivos:' },
          {
            code: [
              '$ rm -rf ~/relatorios && mkdir -p ~/relatorios && cd ~/relatorios',
              '$ touch vendas-2026.log estoque-2026.log rh-2026.log',
              '$ ls'
            ]
          },
          { p: 'Renomeie os três para a extensão <code>.txt</code>, mantendo o resto do nome — usando <strong>apenas expansão de variável</strong>, sem <code>basename</code>, <code>sed</code>, <code>awk</code> ou <code>rename</code>.' },
          { p: 'Ao final, o diretório deve conter <code>vendas-2026.txt</code>, <code>estoque-2026.txt</code> e <code>rh-2026.txt</code>, e nenhum <code>.log</code>.' }
        ],
        hints: [
          'Um laço <code>for</code> percorre os arquivos; dentro dele, uma expansão remove a extensão antiga.',
          '<code>${arquivo%.log}</code> devolve o nome sem o <code>.log</code> — some com <code>.txt</code> no fim.',
          '<code>for a in *.log; do mv "$a" "${a%.log}.txt"; done</code>'
        ],
        solution: '<div class="code"><pre>cd ~/relatorios\nfor a in *.log; do mv "$a" "${a%.log}.txt"; done\nls</pre></div><p style="margin-top:8px">Repare nas aspas em <code>"$a"</code> e <code>"${a%.log}.txt"</code>: sem elas, qualquer arquivo com espaço no nome quebraria o <code>mv</code>. E note que nenhum processo externo foi criado — a expansão do Bash resolveu tudo.</p>',
        check: async (ctx) => {
          const arquivos = (H.ls(ctx, '/home/aluno/relatorios') || []).map(e => e.name || e);
          if (!arquivos.length) return { ok: false, msg: 'O diretório <code>~/relatorios</code> está vazio — monte o cenário do enunciado.' };
          return LX.H.checkAll([
            [arquivos.includes('vendas-2026.txt'), 'Falta o <code>vendas-2026.txt</code>.'],
            [arquivos.includes('estoque-2026.txt'), 'Falta o <code>estoque-2026.txt</code>.'],
            [arquivos.includes('rh-2026.txt'), 'Falta o <code>rh-2026.txt</code>.'],
            [!arquivos.some(n => n.endsWith('.log')), `Ainda há arquivos <code>.log</code>: ${arquivos.filter(n => n.endsWith('.log')).join(', ')}.`],
            /* A restrição de método é conferida no comando que realmente fez o
               renomeio, e não no histórico inteiro da sessão: quem usou sed em
               outra aula não pode ser reprovado aqui. */
            [() => (ctx.term.history || []).some(h => /\$\{[a-zA-Z_]+%/.test(h) && /\bmv\b/.test(h)),
              'Use expansão de variável no próprio <code>mv</code> (<code>mv "$a" "${a%.log}.txt"</code>) — é isso que a aula está treinando.']
          ]);
        }
      }
    ]
  });

  /* ============================== 14.2 ============================== */
  LX.lesson('m14', {
    id: 'l14-2', n: '14.2', title: 'Ambiente: export e herança',
    goal: 'Entender por que uma variável "some" dentro de um script — e quando ela precisa mesmo ser exportada.',
    body: [
      { lede: 'Esta é a aula que explica metade dos "funciona no meu terminal e não funciona no script".' },
      { p: 'Existem <strong>dois conjuntos</strong> de variáveis:' },
      {
        ascii: `  VARIÁVEIS DO SHELL              AMBIENTE (exportadas)
  ┌──────────────────┐            ┌──────────────────┐
  │ X=5              │  export X  │ PATH=...         │
  │ TEMP=/tmp/x      │ ─────────▶ │ HOME=/home/aluno │
  │ (só neste shell) │            │ X=5              │
  └──────────────────┘            └────────┬─────────┘
                                           │ herdado
                            ┌──────────────▼──────────────┐
                            │ processos FILHOS            │
                            │ (scripts, comandos, subshell)│
                            └─────────────────────────────┘

  A herança é de mão única: o filho recebe cópia, e nada
  que ele mude volta para o pai.`
      },
      {
        code: [
          '$ SEGREDO=abc',
          '$ bash -c \'echo "no filho: [$SEGREDO]"\'',
          '$ export SEGREDO',
          '$ bash -c \'echo "no filho: [$SEGREDO]"\''
        ]
      },
      { p: 'Antes do <code>export</code>, o filho não enxerga nada. Depois, enxerga. É essa a diferença inteira entre "variável do shell" e "variável de ambiente".' },
      {
        table: {
          head: ['Comando', 'Faz'],
          rows: [
            ['<code>VAR=valor</code>', 'cria só neste shell'],
            ['<code>export VAR</code>', 'promove a existente para o ambiente'],
            ['<code>export VAR=valor</code>', 'cria já exportada'],
            ['<code>VAR=valor comando</code>', 'define <strong>apenas para aquele comando</strong>'],
            ['<code>env</code>', 'lista o ambiente (só as exportadas)'],
            ['<code>set</code>', 'lista <strong>tudo</strong>: shell + ambiente + funções'],
            ['<code>declare -p VAR</code>', 'mostra o estado e os atributos de uma variável'],
            ['<code>unset VAR</code>', 'remove'],
            ['<code>readonly VAR=x</code>', 'trava: não pode mais mudar nem ser removida']
          ]
        }
      },
      { code: ['$ env | head -8', '$ declare -p HOME', '$ X=1; declare -p X', '$ export X; declare -p X'] },
      { p: 'Repare no <code>declare -p</code>: <code>declare --</code> é variável comum; <code>declare -x</code> é exportada. É a forma mais direta de responder "essa variável está no ambiente?".' },

      { h2: 'Definir só para um comando' },
      { p: 'Colocar a atribuição <em>antes</em> do comando cria uma variável que existe apenas durante aquela execução:' },
      {
        code: [
          '$ printf \'#!/bin/bash\\necho "MODO=[$MODO]"\\n\' > ~/mostra.sh && chmod +x ~/mostra.sh',
          '$ MODO=debug ~/mostra.sh',
          '$ ~/mostra.sh',
          '$ echo "no shell: [$MODO]"'
        ]
      },
      { p: 'É o padrão para rodar algo em outro idioma (<code>LC_ALL=C comando</code>), com outra configuração (<code>ENV=teste ./app</code>) ou para depurar sem sujar a sessão.' },

      { h2: 'A variável mais importante: PATH' },
      { p: 'O <code>PATH</code> é a lista de diretórios que o shell percorre, <strong>na ordem</strong>, procurando o comando que você digitou.' },
      { code: ['$ echo $PATH', '$ echo $PATH | tr ":" "\\n"', '$ which ls', '$ type ls'] },
      {
        box: 'key', body: [
          { p: 'A ordem importa: o <strong>primeiro</strong> diretório que contiver o comando vence. É por isso que acrescentar um diretório no <em>início</em> do PATH permite sobrescrever comandos do sistema — poderoso e perigoso na mesma medida.' },
          { p: 'E é por isso que o diretório atual (<code>.</code>) <strong>não</strong> está no PATH por padrão: se estivesse, um arquivo chamado <code>ls</code> em uma pasta qualquer poderia ser executado no lugar do comando real. Daí a necessidade do <code>./script.sh</code>.' }
        ]
      },
      {
        code: [
          '$ mkdir -p ~/bin',
          '$ printf \'#!/bin/bash\\necho "meu comando pessoal"\\n\' > ~/bin/ola && chmod +x ~/bin/ola',
          '$ ola',
          '$ export PATH="$HOME/bin:$PATH"',
          '$ ola',
          '$ which ola'
        ]
      },
      {
        box: 'warn', body: [
          { p: 'Ao alterar o PATH, <strong>sempre inclua o valor antigo</strong>: <code>export PATH="$HOME/bin:$PATH"</code>. Um <code>export PATH="$HOME/bin"</code> sem o <code>:$PATH</code> destrói a lista e a sessão perde acesso a <code>ls</code>, <code>cat</code> e todo o resto — o sintoma é <code>command not found</code> para tudo, e a recuperação é fechar e abrir o terminal.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't14-2-a', kind: 'guiado', title: 'Exportar, herdar e sobrescrever',
        body: [
          { p: 'Comprove a herança e brinque com o PATH.' },
          {
            code: [
              '$ SEGREDO=abc',
              '$ bash -c \'echo "filho: [$SEGREDO]"\'',
              '$ export SEGREDO',
              '$ bash -c \'echo "filho: [$SEGREDO]"\'',
              '$ declare -p SEGREDO'
            ]
          },
          {
            code: [
              '$ printf \'#!/bin/bash\\necho "MODO=[$MODO]"\\n\' > ~/mostra.sh && chmod +x ~/mostra.sh',
              '$ MODO=debug ~/mostra.sh',
              '$ ~/mostra.sh',
              '$ mkdir -p ~/bin && printf \'#!/bin/bash\\necho "meu comando"\\n\' > ~/bin/ola && chmod +x ~/bin/ola',
              '$ ola',
              '$ export PATH="$HOME/bin:$PATH" && ola && which ola'
            ]
          }
        ],
        hints: ['Use aspas <strong>simples</strong> no <code>bash -c</code>: assim a variável é expandida pelo filho, não pelo shell atual.'],
        solution: '<div class="code"><pre>SEGREDO=abc\nbash -c \'echo "filho: [$SEGREDO]"\'\nexport SEGREDO\nbash -c \'echo "filho: [$SEGREDO]"\'\ndeclare -p SEGREDO\nprintf \'#!/bin/bash\\necho "MODO=[$MODO]"\\n\' &gt; ~/mostra.sh &amp;&amp; chmod +x ~/mostra.sh\nMODO=debug ~/mostra.sh\n~/mostra.sh\nmkdir -p ~/bin\nprintf \'#!/bin/bash\\necho "meu comando"\\n\' &gt; ~/bin/ola &amp;&amp; chmod +x ~/bin/ola\nexport PATH="$HOME/bin:$PATH"\nola\nwhich ola</pre></div>',
        check: async (ctx) => {
          const path = ctx.sh.getVar('PATH') || '';
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /bash\s+-c/), 'Rode um shell filho com <code>bash -c</code> para ver a herança.'],
            [() => H.usedCommand(ctx, /export\s+SEGREDO/), 'Exporte a variável e compare o resultado.'],
            [H.exists(ctx, '/home/aluno/bin/ola'), 'Crie o comando pessoal <code>~/bin/ola</code>.'],
            [(H.mode(ctx, '/home/aluno/bin/ola') & 0o100) !== 0, 'O <code>~/bin/ola</code> precisa ser executável.'],
            [/\/home\/aluno\/bin/.test(path), 'Acrescente <code>~/bin</code> ao <code>PATH</code> com <code>export PATH="$HOME/bin:$PATH"</code>.'],
            [/\/usr\/bin/.test(path), 'O <code>PATH</code> perdeu os diretórios do sistema — inclua o valor antigo: <code>export PATH="$HOME/bin:$PATH"</code>.']
          ]);
        }
      },
      {
        id: 't14-2-q', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Um script <code>config.sh</code> contém apenas:' },
          { code: ['export APP_PORT=3000'], run: false, mixed: false },
          { p: 'Você roda <code>./config.sh</code> e em seguida <code>echo $APP_PORT</code>. O que aparece?' }
        ],
        options: [
          { text: 'Nada — o script rodou em um processo filho, e o ambiente dele morreu junto com ele.', correct: true },
          { text: '<code>3000</code> — o <code>export</code> torna a variável global.', why: 'O <code>export</code> envia a variável para os <strong>filhos</strong> daquele processo, nunca para o pai.' },
          { text: 'Erro de permissão.', why: 'Supondo o bit de execução, o script roda normalmente; o que não acontece é a variável voltar.' },
          { text: '<code>3000</code>, mas só até fechar o terminal.', why: 'Ela não chega nem a existir no shell atual.' }
        ],
        explain: 'Para que as variáveis fiquem no <strong>seu</strong> shell, o script precisa ser lido pelo próprio shell, não executado: <code>source config.sh</code> (ou <code>. config.sh</code>). É exatamente isso que o <code>.bashrc</code> faz — e por isso arquivos de configuração de ambiente são sempre "sourced", nunca executados.'
      },
      {
        id: 't14-2-b', kind: 'desafio', title: 'Um comando que sobrescreve outro',
        body: [
          { p: 'Você quer que todo <code>ls</code> nesta sessão passe por um script seu, que avisa antes de listar — sem alterar o <code>ls</code> do sistema e sem usar <code>alias</code>.' },
          { p: 'Requisitos:' },
          {
            ul: [
              'crie <code>~/bin/ls</code>, executável, que imprima a linha <code>usando o ls personalizado</code> e depois chame o <code>ls</code> real (<code>/usr/bin/ls</code>) repassando os argumentos;',
              'ajuste o <code>PATH</code> para que <strong>o seu</strong> venha primeiro, sem perder os diretórios do sistema;',
              'comprove que <code>which ls</code> devolve <code>/home/aluno/bin/ls</code>;',
              'grave a saída de <code>which ls</code> em <code>~/qual-ls.txt</code>.'
            ]
          },
          { p: 'Dica de segurança: dentro do script, chame o <code>ls</code> pelo caminho absoluto — senão ele chama a si mesmo em laço infinito.' }
        ],
        hints: [
          'O script precisa repassar os argumentos: <code>"$@"</code> expande todos, preservando aspas.',
          'Conteúdo do script: <code>#!/bin/bash</code>, <code>echo "usando o ls personalizado"</code>, <code>/usr/bin/ls "$@"</code>.',
          'PATH: <code>export PATH="$HOME/bin:$PATH"</code> — o seu diretório <strong>antes</strong> do resto.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/bin\ncat &gt; ~/bin/ls &lt;&lt; \'EOF\'\n#!/bin/bash\necho "usando o ls personalizado"\n/usr/bin/ls "$@"\nEOF\nchmod +x ~/bin/ls\nexport PATH="$HOME/bin:$PATH"\nwhich ls\nwhich ls &gt; ~/qual-ls.txt\nls</pre></div><p style="margin-top:8px">Esse é o mecanismo por trás de "empacotadores" como <code>ccache</code> e das armadilhas de segurança em que um PATH mal configurado faz o sistema executar o binário errado. Poderoso — e um bom motivo para nunca colocar <code>.</code> no PATH.</p>',
        check: async (ctx) => {
          const script = H.read(ctx, '/home/aluno/bin/ls');
          if (script === null) return { ok: false, msg: 'Crie o script <code>~/bin/ls</code>.' };
          const path = ctx.sh.getVar('PATH') || '';
          const qual = H.read(ctx, '/home/aluno/qual-ls.txt');
          const dirs = path.split(':');
          return LX.H.checkAll([
            [(H.mode(ctx, '/home/aluno/bin/ls') & 0o100) !== 0, 'O script precisa ser executável (<code>chmod +x</code>).'],
            [/usando o ls personalizado/.test(script), 'O script deve imprimir a linha <code>usando o ls personalizado</code>.'],
            [/\/usr\/bin\/ls/.test(script), 'O script deve chamar o <code>ls</code> real pelo caminho absoluto <code>/usr/bin/ls</code> — senão chamaria a si mesmo.'],
            [/"\$@"/.test(script), 'Repasse os argumentos com <code>"$@"</code>.'],
            [dirs.indexOf('/home/aluno/bin') === 0, 'O diretório <code>~/bin</code> precisa ser o <strong>primeiro</strong> do <code>PATH</code>.'],
            [/\/usr\/bin/.test(path), 'Os diretórios do sistema devem continuar no <code>PATH</code>.'],
            [qual !== null && /\/home\/aluno\/bin\/ls/.test(qual), 'Grave a saída de <code>which ls</code> em <code>~/qual-ls.txt</code> — ela deve apontar para o seu script.']
          ]);
        }
      }
    ]
  });

  /* ============================== 14.3 ============================== */
  LX.lesson('m14', {
    id: 'l14-3', n: '14.3', title: 'Arquivos de inicialização',
    goal: 'Saber exatamente em qual arquivo colocar cada configuração — e por que a sua nunca é lida.',
    body: [
      { p: 'O Bash lê arquivos diferentes conforme o <em>tipo</em> de sessão. Errar o arquivo é a causa de "coloquei no .bashrc e não funciona".' },
      {
        table: {
          head: ['Tipo de sessão', 'Quando acontece', 'Lê'],
          rows: [
            ['<strong>login</strong>', 'SSH, console, <code>su -</code>', '<code>/etc/profile</code> → <code>~/.bash_profile</code> ou <code>~/.profile</code>'],
            ['<strong>interativa não-login</strong>', 'abrir um terminal no desktop, <code>bash</code>', '<code>/etc/bash.bashrc</code> → <code>~/.bashrc</code>'],
            ['<strong>não interativa</strong>', 'um script', '<strong>nenhum</strong> (só <code>$BASH_ENV</code>, se definida)']
          ]
        }
      },
      {
        ascii: `  ssh servidor         →  login       →  ~/.profile
                                            └─ que normalmente faz: source ~/.bashrc

  abrir terminal       →  não-login   →  ~/.bashrc

  ./script.sh          →  não interativa → NENHUM arquivo
                          (por isso o PATH do cron é curto!)`
      },
      {
        box: 'key', body: [
          { p: 'A regra prática que resolve:' },
          { ul: [
            '<strong>aliases, prompt, funções, cores</strong> → <code>~/.bashrc</code> (só fazem sentido em sessão interativa);',
            '<strong>variáveis de ambiente</strong> (PATH, EDITOR, JAVA_HOME) → <code>~/.profile</code>, porque são herdadas por tudo;',
            'e o <code>~/.profile</code> quase sempre carrega o <code>~/.bashrc</code> — é por isso que, na prática, o <code>.bashrc</code> parece valer para tudo.'
          ] }
        ]
      },
      { code: ['$ ls -a ~ | head -8', '$ head -12 ~/.bashrc', '$ grep -n "bashrc" ~/.profile 2>/dev/null'] },

      { h2: 'Editar e aplicar' },
      { p: 'Alterações nesses arquivos só valem em <strong>novas</strong> sessões — a menos que você as carregue na atual:' },
      { cmd: 'source' },
      {
        code: [
          '$ echo \'export EDITOR=nano\' >> ~/.bashrc',
          '$ echo \'alias ll="ls -alF"\' >> ~/.bashrc',
          '$ tail -3 ~/.bashrc',
          '$ source ~/.bashrc',
          '$ echo "$EDITOR"',
          '$ type ll'
        ]
      },
      { p: 'O <code>source arquivo</code> (ou <code>. arquivo</code>) lê o arquivo <strong>no shell atual</strong>, em vez de criar um processo filho — é exatamente por isso que ele consegue mudar o seu ambiente, como visto na aula anterior.' },
      {
        table: {
          head: ['Arquivo', 'Escopo', 'Para quê'],
          rows: [
            ['<code>~/.bashrc</code>', 'seu usuário, sessões interativas', 'aliases, prompt, funções'],
            ['<code>~/.profile</code>', 'seu usuário, no login', 'PATH e variáveis de ambiente'],
            ['<code>/etc/profile</code>', '<strong>todos</strong> os usuários, no login', 'políticas da máquina'],
            ['<code>/etc/profile.d/*.sh</code>', 'todos, no login', '<strong>o lugar certo</strong> para acrescentar algo global'],
            ['<code>/etc/environment</code>', 'todos, inclusive não-shell', 'variáveis simples (sem <code>export</code>, sem lógica)'],
            ['<code>/etc/skel/</code>', 'novos usuários', 'o molde copiado na criação da conta (módulo 6)']
          ]
        }
      },
      {
        box: 'warn', body: [
          { p: 'Nunca edite <code>/etc/profile</code> diretamente para acrescentar algo: uma atualização do sistema pode sobrescrevê-lo. Crie um arquivo em <code>/etc/profile.d/</code> — mesma lógica dos drop-ins do systemd (módulo 8) e do <code>sshd_config.d</code> (módulo 10). O padrão se repete: <strong>não altere o arquivo do sistema, acrescente um seu ao lado</strong>.' }
        ]
      },
      {
        box: 'tip', label: 'Por que o cron não acha seus comandos', body: [
          { p: 'Tarefas do cron e serviços do systemd rodam em sessão <strong>não interativa</strong>: nenhum desses arquivos é lido. O <code>PATH</code> é mínimo e as suas variáveis não existem.' },
          { p: 'A solução não é "carregar o .bashrc no cron" — é usar <strong>caminhos absolutos</strong> no script e declarar as variáveis de que ele precisa dentro dele (ou em <code>EnvironmentFile=</code>, na unit). Um script bem escrito não depende do ambiente de ninguém.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't14-3-a', kind: 'guiado', title: 'Configure a sua sessão',
        body: [
          { p: 'Acrescente configurações e aplique-as sem abrir outro terminal.' },
          {
            code: [
              '$ ls -a ~ | head -8',
              '$ tail -5 ~/.bashrc',
              '$ echo \'export EDITOR=nano\' >> ~/.bashrc',
              '$ echo \'alias ll="ls -alF"\' >> ~/.bashrc',
              '$ echo \'export PATH="$HOME/bin:$PATH"\' >> ~/.bashrc',
              '$ source ~/.bashrc',
              '$ echo "$EDITOR"',
              '$ type ll'
            ]
          }
        ],
        hints: ['Use <code>&gt;&gt;</code> (acrescenta) e não <code>&gt;</code> (sobrescreve) — um <code>&gt;</code> aqui apagaria o seu <code>.bashrc</code> inteiro.'],
        solution: '<div class="code"><pre>tail -5 ~/.bashrc\necho \'export EDITOR=nano\' &gt;&gt; ~/.bashrc\necho \'alias ll="ls -alF"\' &gt;&gt; ~/.bashrc\necho \'export PATH="$HOME/bin:$PATH"\' &gt;&gt; ~/.bashrc\nsource ~/.bashrc\necho "$EDITOR"\ntype ll</pre></div>',
        check: async (ctx) => {
          const rc = H.read(ctx, '/home/aluno/.bashrc') || '';
          return LX.H.checkAll([
            [/export\s+EDITOR/.test(rc), 'Acrescente <code>export EDITOR=nano</code> ao <code>~/.bashrc</code>.'],
            [/alias\s+ll=/.test(rc), 'Acrescente o alias <code>ll</code> ao <code>~/.bashrc</code>.'],
            [/PATH=/.test(rc), 'Acrescente também a linha do <code>PATH</code>.'],
            [() => H.usedCommand(ctx, /source\s+~\/\.bashrc|\.\s+~\/\.bashrc/), 'Aplique as mudanças na sessão atual com <code>source ~/.bashrc</code>.'],
            /* o .bashrc original tem estas marcas; se sumiram, houve `>` no
               lugar de `>>` e o arquivo foi destruído */
            [/# ~\/\.bashrc|HISTSIZE|PS1=/.test(rc), 'O <code>~/.bashrc</code> perdeu o conteúdo original — você usou <code>&gt;</code> em vez de <code>&gt;&gt;</code>. Restaure com <code>cp /etc/skel/.bashrc ~/.bashrc</code> e refaça acrescentando.']
          ]);
        }
      },
      {
        id: 't14-3-q', kind: 'quiz', title: 'Conceito: o cron que não acha o comando',
        body: [
          { p: 'Um script funciona perfeitamente quando você o roda no terminal, mas no cron falha com <code>node: command not found</code>. O <code>node</code> está instalado em <code>/usr/local/bin/node</code> e o seu <code>~/.bashrc</code> acrescenta esse diretório ao PATH.' },
          { p: 'Qual é a melhor correção?' }
        ],
        options: [
          { text: 'Usar o caminho absoluto no script (<code>/usr/local/bin/node</code>) ou definir o <code>PATH</code> dentro do próprio script.', correct: true },
          { text: 'Acrescentar <code>source ~/.bashrc</code> no início do script.', why: 'Funciona por acaso e cria dependência do ambiente de um usuário específico — se outra pessoa rodar o script, quebra de novo.' },
          { text: 'Mover a linha do PATH do <code>.bashrc</code> para o <code>.profile</code>.', why: 'O cron não lê nenhum dos dois: a sessão não é interativa nem de login.' },
          { text: 'Reinstalar o <code>node</code> em <code>/usr/bin</code>.', why: 'Mexe no sistema para contornar um problema que é do script.' }
        ],
        explain: 'O princípio: <strong>um script não deve depender do ambiente de quem o chama</strong>. Caminhos absolutos, variáveis declaradas no topo, e nada de assumir aliases ou funções do seu <code>.bashrc</code>. Vale igual para units do systemd, que também rodam com ambiente mínimo (módulo 8).'
      },
      {
        id: 't14-3-b', kind: 'desafio', title: 'Configuração para toda a máquina',
        body: [
          { p: 'A empresa quer que <strong>todos</strong> os usuários desta máquina tenham a variável <code>AMBIENTE=producao</code> definida ao fazer login, e que a alteração sobreviva a atualizações do sistema.' },
          { p: 'Requisitos:' },
          {
            ul: [
              'a configuração fica em <code>/etc/profile.d/empresa.sh</code> (não em <code>/etc/profile</code>);',
              'o arquivo exporta <code>AMBIENTE=producao</code>;',
              'o arquivo pertence ao <code>root</code> e tem modo <code>644</code>;',
              'aplique no seu shell atual e comprove: grave a saída de <code>echo "$AMBIENTE"</code> em <code>~/ambiente.txt</code>.'
            ]
          },
          { p: 'Por que <code>644</code> e não <code>755</code>? Arquivos em <code>profile.d</code> são <em>lidos</em> (sourced), não executados — não precisam do bit <code>x</code>.' }
        ],
        hints: [
          'Escrever em <code>/etc</code> exige root: use <code>sudo tee</code>, já que o redirecionamento comum é feito pelo <em>seu</em> shell.',
          'O conteúdo é uma linha: <code>export AMBIENTE=producao</code>.',
          'Para aplicar agora: <code>source /etc/profile.d/empresa.sh</code>.'
        ],
        solution: '<div class="code"><pre>echo \'export AMBIENTE=producao\' | sudo tee /etc/profile.d/empresa.sh &gt; /dev/null\nsudo chmod 644 /etc/profile.d/empresa.sh\nls -l /etc/profile.d/empresa.sh\nsource /etc/profile.d/empresa.sh\necho "$AMBIENTE"\necho "$AMBIENTE" &gt; ~/ambiente.txt</pre></div><p style="margin-top:8px">O padrão <code>/etc/profile.d/</code> vale para qualquer configuração global de shell: uma atualização do pacote base pode substituir o <code>/etc/profile</code>, mas nunca vai mexer no seu arquivo.</p>',
        check: async (ctx) => {
          const arq = H.read(ctx, '/etc/profile.d/empresa.sh');
          if (arq === null) return { ok: false, msg: 'Crie o arquivo <code>/etc/profile.d/empresa.sh</code>.' };
          const dono = H.owner(ctx, '/etc/profile.d/empresa.sh');
          const modo = H.mode(ctx, '/etc/profile.d/empresa.sh');
          const saida = H.read(ctx, '/home/aluno/ambiente.txt');
          return LX.H.checkAll([
            [/export\s+AMBIENTE=producao/.test(arq), 'O arquivo deve conter <code>export AMBIENTE=producao</code>.'],
            [dono.user === 'root', `O arquivo deve pertencer ao <code>root</code>; está com <code>${dono.user}</code>.`],
            [modo === 0o644, `O modo deve ser <code>644</code>; está ${modo.toString(8)}.`],
            [ctx.sh.getVar('AMBIENTE') === 'producao', 'Aplique no shell atual com <code>source /etc/profile.d/empresa.sh</code>.'],
            [saida !== null && /producao/.test(saida), 'Grave a saída de <code>echo "$AMBIENTE"</code> em <code>~/ambiente.txt</code>.']
          ]);
        }
      }
    ]
  });

})();
