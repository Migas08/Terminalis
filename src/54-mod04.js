/* =========================================================================
   MÓDULO 4 — Pipes e redirecionamentos
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 3.1 ============================== */
  LX.lesson('m04', {
    id: 'l4-1', n: '3.1', title: 'Os três canais: stdin, stdout e stderr',
    goal: 'Entender o modelo que sustenta todo o resto do terminal. Depois desta aula, redirecionamento deixa de ser decoreba e vira consequência.',
    body: [
      { p: 'Todo processo no Linux nasce com três canais de comunicação já abertos. Eles são numerados, e é esse número que aparece nos comandos que você vai escrever.' },
      {
        table: {
          head: ['Nº', 'Nome', 'Descritor', 'Para que serve'],
          rows: [
            ['<strong>0</strong>', '<code>stdin</code>', 'entrada padrão', 'por onde o programa <em>recebe</em> dados'],
            ['<strong>1</strong>', '<code>stdout</code>', 'saída padrão', 'por onde ele <em>devolve</em> o resultado'],
            ['<strong>2</strong>', '<code>stderr</code>', 'saída de erro', 'por onde ele <em>reclama</em>']
          ]
        }
      },
      {
        ascii: `                    ┌─────────────────┐
   stdin  (0) ─────▶│                 │─────▶ stdout (1)   resultado
   teclado          │    PROGRAMA     │       tela
                    │                 │─────▶ stderr (2)   erros
                    └─────────────────┘       tela`
      },
      { p: 'Por padrão, os três estão ligados ao seu terminal: o 0 vem do teclado, o 1 e o 2 vão para a tela. <strong>Redirecionar é trocar a ponta de um desses canais</strong> — nada além disso.' },

      { h2: 'Por que separar saída de erro?' },
      { p: 'Esta é a pergunta que revela o design. Se erro e resultado saíssem pelo mesmo canal, seria impossível processar o resultado de um comando sem que uma mensagem de erro contaminasse os dados.' },
      { p: 'Veja acontecendo. O comando abaixo tenta listar dois diretórios, um que existe e um que não:' },
      { code: ['$ ls /etc /naoexiste'] },
      { p: 'Na tela, as duas coisas aparecem misturadas. Mas elas viajaram por canais diferentes — e você pode separá-las:' },
      {
        code: [
          '# só o resultado (o erro vai para a tela)',
          '$ ls /etc /naoexiste 2>/dev/null | head -5',
          '# só o erro (o resultado vai para o buraco)',
          '$ ls /etc /naoexiste 1>/dev/null'
        ]
      },
      {
        box: 'key', body: [
          { p: 'A tela mistura; os canais não. Sempre que um comando "sujar" seu pipeline com mensagens, lembre que a sujeira provavelmente está no canal 2, e você pode mandá-la para outro lugar.' }
        ]
      },

      { h2: 'Quem escreve em qual canal?' },
      { p: 'A convenção é firme e quase sempre respeitada:' },
      {
        ul: [
          '<strong>stdout</strong>: aquilo que o comando existe para produzir — a lista de arquivos, o conteúdo, o resultado do cálculo.',
          '<strong>stderr</strong>: mensagens de erro, avisos e barras de progresso. Tudo o que é <em>sobre</em> a execução, não o produto dela.'
        ]
      },
      { p: 'É por isso que <code>wget</code> e <code>curl</code> mostram o progresso mesmo quando você redireciona a saída para um arquivo: o progresso vai pelo canal 2, o arquivo pelo canal 1.' },

      { h2: 'O código de saída: o quarto sinal' },
      { p: 'Além dos três canais, todo processo devolve um <strong>número</strong> ao terminar. Ele não aparece na tela; fica guardado na variável <code>$?</code>.' },
      { code: ['$ ls /etc > /dev/null', '$ echo $?', '$ ls /naoexiste 2>/dev/null', '$ echo $?'] },
      {
        table: {
          head: ['Código', 'Significa'],
          rows: [
            ['<strong>0</strong>', 'sucesso — e é sempre 0, qualquer outro valor é falha'],
            ['<strong>1</strong>', 'erro genérico'],
            ['<strong>2</strong>', 'erro de uso (opção inválida, argumento faltando)'],
            ['<strong>126</strong>', 'encontrado mas não executável (falta o bit x)'],
            ['<strong>127</strong>', 'comando não encontrado'],
            ['<strong>130</strong>', 'interrompido com <span class="kbd">Ctrl+C</span>'],
            ['<strong>137</strong>', 'morto com <code>kill -9</code>']
          ]
        }
      },
      {
        box: 'tip', body: [
          { p: 'Guarde o 127 e o 126: os dois erros mais confusos de diagnosticar. <strong>127</strong> quer dizer "não achei esse programa" — quase sempre um problema de <code>$PATH</code> ou de digitação. <strong>126</strong> quer dizer "achei, mas não pude executar" — quase sempre falta de permissão <code>x</code>.' }
        ]
      },
      { p: 'É esse número que faz o <code>&amp;&amp;</code> e o <code>||</code> funcionarem — eles simplesmente olham o <code>$?</code> do comando anterior.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Todo processo tem <strong>0</strong> (entrada), <strong>1</strong> (saída) e <strong>2</strong> (erro).',
          'Erro é separado de resultado <em>de propósito</em>, para o resultado poder ser processado limpo.',
          'Redirecionar = trocar a ponta de um canal.',
          '<code>$?</code> guarda o código de saída: 0 é sucesso; 127 é comando não encontrado; 126 é sem permissão de execução.'
        ]
      }
    ],
    tasks: [
      {
        id: 't4-1-a', kind: 'guiado', title: 'Separe o joio do trigo',
        body: [
          { p: 'Rode os quatro e observe o que aparece em cada caso:' },
          {
            code: [
              '$ ls /etc /naoexiste',
              '$ ls /etc /naoexiste 2>/dev/null | wc -l',
              '$ ls /etc /naoexiste 1>/dev/null',
              '$ ls /naoexiste; echo "codigo: $?"'
            ]
          },
          { p: 'No segundo, a contagem saiu limpa. No terceiro, sobrou só a reclamação. Mesmo comando, canais diferentes.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /2>\s*\/dev\/null/), 'Descarte os erros com <code>2>/dev/null</code>.'],
          [() => H.usedCommand(ctx, /1>\s*\/dev\/null|>\s*\/dev\/null/), 'Descarte a saída normal com <code>1>/dev/null</code>.'],
          [() => H.usedCommand(ctx, /\$\?/), 'Consulte o código de saída com <code>echo $?</code>.']
        ])
      },
      {
        id: 't4-1-q', kind: 'quiz', title: 'Qual é o código?',
        body: [
          { p: 'Você criou um script <code>backup.sh</code>, mas esqueceu de dar permissão de execução. Ao rodar <code>./backup.sh</code>, qual código de saída o shell devolve?' }
        ],
        options: [
          { text: '126 — o arquivo foi encontrado, mas não pôde ser executado.', correct: true },
          { text: '127 — comando não encontrado.', why: '127 é quando o shell não encontra o arquivo. Aqui ele encontrou; o problema é a permissão.' },
          { text: '1 — erro genérico.', why: 'O shell usa códigos específicos para os problemas de execução, justamente para você poder distinguir.' },
          { text: '0 — o script simplesmente não faz nada.', why: '0 significa sucesso. Nada foi executado, então não houve sucesso.' }
        ],
        explain: 'A dupla <strong>126</strong> / <strong>127</strong> economiza muito tempo de diagnóstico. <em>127</em>: revise o nome e o <code>$PATH</code>. <em>126</em>: rode <code>ls -l</code> e provavelmente falta o bit <code>x</code> — corrija com <code>chmod +x</code>.'
      },
      {
        id: 't4-1-b', kind: 'desafio', title: 'Registre o que deu certo e o que deu errado',
        body: [
          { p: 'Execute um comando que tenta listar três caminhos: <code>/etc</code>, <code>/tmp</code> e <code>/naoexiste-mesmo</code>.' },
          { p: 'Grave <strong>a saída normal</strong> em <code>~/ok.txt</code> e <strong>as mensagens de erro</strong> em <code>~/falhas.txt</code>, em um único comando. Nada deve aparecer na tela.' },
          { p: 'Depois grave o código de saída desse comando em <code>~/codigo.txt</code>.' }
        ],
        hints: [
          'Você pode redirecionar os dois canais no mesmo comando: <code>comando &gt; arquivo1 2&gt; arquivo2</code>.',
          'O <code>$?</code> precisa ser consultado <strong>logo depois</strong> — qualquer outro comando no meio o sobrescreve. Use <code>echo $? &gt; ~/codigo.txt</code> na linha seguinte.'
        ],
        solution: '<div class="code"><pre>ls /etc /tmp /naoexiste-mesmo &gt; ~/ok.txt 2&gt; ~/falhas.txt\necho $? &gt; ~/codigo.txt\n\ncat ~/falhas.txt\ncat ~/codigo.txt</pre></div><p style="margin-top:8px">A ordem dos redirecionamentos na linha não importa: <code>2&gt; a &gt; b</code> funciona igual a <code>&gt; b 2&gt; a</code>.</p>',
        check: async (ctx) => {
          const ok = H.read(ctx, '/home/aluno/ok.txt');
          const falhas = H.read(ctx, '/home/aluno/falhas.txt');
          const cod = H.read(ctx, '/home/aluno/codigo.txt');
          return LX.H.checkAll([
            [ok !== null, 'O arquivo ~/ok.txt ainda não existe.'],
            [falhas !== null, 'O arquivo ~/falhas.txt ainda não existe.'],
            [cod !== null, 'O arquivo ~/codigo.txt ainda não existe.'],
            [ok && /passwd|hosts|ssh/.test(ok), 'O ~/ok.txt não parece ter a listagem de /etc.'],
            [falhas && /naoexiste-mesmo/.test(falhas), 'O ~/falhas.txt deveria conter a mensagem de erro sobre <code>/naoexiste-mesmo</code>.'],
            [falhas && !/passwd/.test(falhas), 'A listagem normal vazou para o arquivo de erros. Separe os canais 1 e 2.'],
            [ok && !/No such file/.test(ok), 'A mensagem de erro vazou para o arquivo de saída normal.'],
            [cod && /^\s*2\s*$/.test(cod), `O código de saída gravado é "${(cod || '').trim()}". O <code>ls</code> devolve 2 quando algum caminho não existe — confira se você consultou o <code>$?</code> imediatamente depois.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 3.2 ============================== */
  LX.lesson('m04', {
    id: 'l4-2', n: '3.2', title: 'Redirecionar a saída: > e >>',
    goal: 'Gravar resultados em arquivos sem esquecer que um dos dois operadores apaga tudo antes de escrever.',
    body: [
      { cmd: '>' },
      { p: 'Manda o <strong>canal 1</strong> para um arquivo. Se o arquivo não existe, cria. Se existe, <strong>esvazia primeiro</strong>.' },
      { code: ['$ echo "primeira linha" > ~/teste.txt', '$ cat ~/teste.txt', '$ echo "segunda linha" > ~/teste.txt', '$ cat ~/teste.txt'] },
      { p: 'A primeira linha sumiu. Não foi um bug — é exatamente o que o <code>&gt;</code> promete fazer.' },
      { cmd: '>>' },
      { p: 'Acrescenta ao final, preservando o que já estava lá.' },
      { code: ['$ echo "terceira linha" >> ~/teste.txt', '$ cat ~/teste.txt'] },
      {
        box: 'warn', label: 'O acidente mais comum do terminal', body: [
          { p: 'Digitar <code>&gt;</code> onde se queria <code>&gt;&gt;</code>. E há uma versão pior:' },
          { code: ['sort arquivo.txt > arquivo.txt'], run: false, mixed: false, lang: 'text' },
          { p: 'Parece razoável: "ordene o arquivo e grave nele mesmo". Mas o shell <strong>abre e esvazia o destino antes</strong> de o <code>sort</code> começar a ler. Resultado: arquivo vazio, conteúdo perdido.' },
          { p: 'A forma correta é usar um intermediário — ou uma ferramenta que saiba editar no lugar: <code>sort arquivo.txt -o arquivo.txt</code>, <code>sed -i</code>.' }
        ]
      },

      { h2: 'Um detalhe que explica muita coisa' },
      { p: 'O redirecionamento é feito pelo <strong>shell</strong>, antes de o comando existir. A sequência real é:' },
      {
        ol: [
          'O Bash lê a linha e vê o <code>&gt;</code>.',
          'O Bash <strong>abre o arquivo de destino</strong> (criando ou esvaziando).',
          'O Bash cria o processo do comando com o canal 1 já apontando para esse arquivo.',
          'O comando roda, sem nem saber que não está escrevendo na tela.'
        ]
      },
      { p: 'Três consequências práticas disso:' },
      {
        ul: [
          'O arquivo é esvaziado <strong>mesmo que o comando falhe</strong>.',
          '<code>sudo comando &gt; /etc/arquivo</code> não funciona: quem abre o arquivo é o seu shell, não o sudo (a solução é o <code>tee</code>, visto no módulo 4).',
          'O comando não tem como saber se está escrevendo na tela ou em arquivo — por isso alguns desligam as cores automaticamente quando detectam que a saída não é um terminal.'
        ]
      },

      { h2: 'Redirecionar canais específicos' },
      { p: 'O número antes do <code>&gt;</code> escolhe o canal. Sem número, o padrão é 1.' },
      {
        cheat: [
          ['cmd > arq', 'saída normal, substituindo'],
          ['cmd >> arq', 'saída normal, acrescentando'],
          ['cmd 1> arq', 'idêntico ao primeiro (explícito)'],
          ['cmd 2> arq', 'só os erros'],
          ['cmd 2>> arq', 'só os erros, acrescentando'],
          ['cmd > /dev/null', 'descarta a saída'],
          ['cmd 2> /dev/null', 'descarta os erros']
        ]
      },
      {
        code: [
          '$ ls /etc /naoexiste > ~/saida.txt 2> ~/erro.txt',
          '$ cat ~/erro.txt',
          '$ wc -l ~/saida.txt'
        ]
      },

      { h2: 'Criar arquivos sem comando nenhum' },
      { p: 'Você pode redirecionar "nada" para um arquivo. É a forma mais rápida de criar um arquivo vazio ou de <strong>zerar</strong> um log grande sem apagá-lo:' },
      { code: ['$ > ~/vazio.txt', '$ ls -l ~/vazio.txt'] },
      {
        box: 'tip', label: 'Zerar um log em produção', body: [
          { p: 'Se um log está enchendo o disco, <strong>não apague o arquivo</strong> — o processo que escreve nele continua com o arquivo antigo aberto e o espaço não é liberado. Zere o conteúdo:' },
          { code: ['sudo truncate -s 0 /var/log/enorme.log', '# ou', ': | sudo tee /var/log/enorme.log'], run: false, mixed: false, lang: 'text' },
          { p: 'Assim o mesmo arquivo continua existindo e o serviço segue escrevendo sem precisar reiniciar.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>&gt;</code> substitui o conteúdo; <code>&gt;&gt;</code> acrescenta.',
          'O shell abre e esvazia o destino <em>antes</em> de rodar o comando.',
          '<code>cmd &gt; arq 2&gt; erro</code> separa resultado de erro em arquivos diferentes.',
          'Nunca redirecione um arquivo para ele mesmo.',
          '<code>&gt; arquivo</code> sozinho cria ou zera — sem apagar o inode.'
        ]
      }
    ],
    tasks: [
      {
        id: 't4-2-a', kind: 'guiado', title: 'Substituir versus acrescentar',
        body: [
          { p: 'Sinta a diferença na prática — a terceira linha é a que costuma doer:' },
          {
            code: [
              '$ echo "linha A" > ~/demo.txt',
              '$ echo "linha B" >> ~/demo.txt',
              '$ cat ~/demo.txt',
              '$ echo "linha C" > ~/demo.txt',
              '$ cat ~/demo.txt'
            ]
          }
        ],
        check: async (ctx) => LX.H.checkAll([
          [H.isFile(ctx, '/home/aluno/demo.txt'), 'Crie o arquivo <code>~/demo.txt</code>.'],
          [() => H.usedCommand(ctx, />>\s*~?\/?.*demo\.txt/), 'Use o operador <code>&gt;&gt;</code> em algum momento.'],
          [(H.read(ctx, '/home/aluno/demo.txt') || '').trim() === 'linha C', 'Depois do último <code>&gt;</code>, o arquivo deveria conter apenas <code>linha C</code>.']
        ])
      },
      {
        id: 't4-2-p', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'O arquivo <code>dados.txt</code> tem 500 linhas. Você executa:' },
          { code: ['grep erro dados.txt > dados.txt'], run: false, mixed: false },
          { p: 'O que acontece com o <code>dados.txt</code>?' }
        ],
        options: [
          { text: 'Fica vazio: o shell esvaziou o arquivo antes de o <code>grep</code> conseguir ler.', correct: true },
          { text: 'Fica só com as linhas que contêm "erro".', why: 'Seria o esperado, mas o esvaziamento acontece <em>antes</em> da leitura. O <code>grep</code> abre um arquivo já vazio.' },
          { text: 'O <code>grep</code> avisa que origem e destino são iguais e aborta.', why: 'O <code>grep</code> não tem como saber: para ele, o canal 1 é apenas um canal. Quem fez o redirecionamento foi o shell.' },
          { text: 'Nada muda, porque o arquivo está em uso.', why: 'O Linux não bloqueia arquivos em uso como o Windows faz.' }
        ],
        explain: 'A ordem é: shell abre o destino (truncando) → shell inicia o <code>grep</code> → <code>grep</code> lê um arquivo de 0 bytes. Para filtrar no lugar, use um intermediário (<code>grep erro dados.txt &gt; tmp &amp;&amp; mv tmp dados.txt</code>) ou <code>sed -i \'/erro/!d\' dados.txt</code>.'
      },
      {
        id: 't4-2-b', kind: 'desafio', title: 'Monte um relatório em camadas',
        body: [
          { p: 'Construa <code>~/relatorio.txt</code> com <strong>quatro seções</strong>, nesta ordem, usando um comando por seção:' },
          {
            ol: [
              'a linha <code>=== RELATORIO ===</code>;',
              'a data e hora atuais;',
              'a linha <code>--- disco ---</code> seguida da saída de <code>df -h /</code>;',
              'a linha <code>--- memoria ---</code> seguida da saída de <code>free -m</code>.'
            ]
          },
          { p: 'A primeira linha deve usar <code>&gt;</code> (para começar do zero) e todas as outras <code>&gt;&gt;</code>. Se você errar e usar <code>&gt;</code> no meio, vai perceber na hora.' }
        ],
        hints: [
          'A estrutura é sempre a mesma: <code>echo "texto" &gt;&gt; ~/relatorio.txt</code> e <code>comando &gt;&gt; ~/relatorio.txt</code>.',
          'Só o primeiro comando usa <code>&gt;</code>. Todos os outros, <code>&gt;&gt;</code>.'
        ],
        solution: '<div class="code"><pre>echo "=== RELATORIO ===" &gt;  ~/relatorio.txt\ndate                     &gt;&gt; ~/relatorio.txt\necho "--- disco ---"     &gt;&gt; ~/relatorio.txt\ndf -h /                  &gt;&gt; ~/relatorio.txt\necho "--- memoria ---"   &gt;&gt; ~/relatorio.txt\nfree -m                  &gt;&gt; ~/relatorio.txt\n\ncat ~/relatorio.txt</pre></div>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/relatorio.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/relatorio.txt ainda não existe.' };
          const iCab = c.indexOf('=== RELATORIO ===');
          const iDisco = c.indexOf('--- disco ---');
          const iMem = c.indexOf('--- memoria ---');
          return LX.H.checkAll([
            [iCab === 0, 'A primeira linha deve ser exatamente <code>=== RELATORIO ===</code>.'],
            [/\d{2}:\d{2}:\d{2}|\d{4}/.test(c.split('\n')[1] || ''), 'A segunda linha deveria ser a data (saída do comando <code>date</code>).'],
            [iDisco > 0, 'Falta a seção <code>--- disco ---</code>.'],
            [/Filesystem|\/dev\/vda2/.test(c), 'Falta a saída do <code>df -h /</code>.'],
            [iMem > iDisco, 'A seção de memória deve vir depois da de disco.'],
            [/Mem:|total\s+used/.test(c), 'Falta a saída do <code>free -m</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 3.3 ============================== */
  LX.lesson('m04', {
    id: 'l4-3', n: '3.3', title: 'Erros: 2>, 2>&1 e /dev/null',
    goal: 'Dominar a notação que mais confunde iniciantes — e entender por que a ordem dos redirecionamentos muda o resultado.',
    body: [
      { h2: 'Descartar erros' },
      { p: 'Comandos que percorrem o sistema quase sempre esbarram em diretórios sem permissão, e enchem a tela de "Permission denied". Como o que interessa é o resultado, manda-se o canal 2 para o buraco:' },
      { code: ['$ find /etc -name "*.conf" 2>/dev/null | head -5'] },
      { p: '<code>/dev/null</code> é um arquivo especial que descarta tudo o que recebe e nunca devolve nada. O apelido "buraco negro" é literal.' },

      { h2: 'Juntar os dois canais: 2>&1' },
      { p: 'Esta é a notação que trava todo mundo. Leia devagar:' },
      {
        ascii: `        2  >  &1
        │  │  │└──── o canal 1
        │  │  └───── "&" significa: um CANAL, não um arquivo
        │  └──────── redirecione
        └─────────── o canal 2`
      },
      { p: 'Ou seja: <strong>"mande o canal 2 para onde o canal 1 estiver apontando agora"</strong>.' },
      { p: 'Sem o <code>&amp;</code>, o significado muda completamente: <code>2&gt;1</code> criaria um arquivo chamado literalmente <code>1</code>. O <code>&amp;</code> é o que diz "isto é um canal, não um nome".' },
      { code: ['$ ls /etc /naoexiste > ~/tudo.txt 2>&1', '$ cat ~/tudo.txt | tail -3'] },

      { h2: 'A ordem importa — e muito' },
      {
        box: 'key', label: 'O ponto mais sutil do módulo', body: [
          { p: 'Compare os dois:' },
          {
            code: [
              'cmd > arq 2>&1     # ✅ os dois vão para arq',
              'cmd 2>&1 > arq     # ❌ só a saída normal vai para arq'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'A razão é que <code>2&gt;&amp;1</code> copia <em>o destino atual</em> do canal 1, e não cria um vínculo permanente.' },
          {
            ol: [
              'Na primeira linha: o canal 1 é apontado para <code>arq</code>; depois o canal 2 é apontado para "onde o 1 está" — ou seja, <code>arq</code>. Os dois no arquivo.',
              'Na segunda: o canal 2 é apontado para "onde o 1 está" — que ainda é a <strong>tela</strong>; só depois o canal 1 é movido para <code>arq</code>. O canal 2 fica na tela.'
            ]
          },
          { p: 'Leia sempre da esquerda para a direita, como o shell faz.' }
        ]
      },
      { code: ['$ ls /naoexiste > ~/a.txt 2>&1; echo "--- a.txt:"; cat ~/a.txt', '$ ls /naoexiste 2>&1 > ~/b.txt; echo "--- b.txt:"; cat ~/b.txt'] },

      { h2: 'O atalho moderno: &>' },
      { p: 'O Bash tem uma forma curta que manda os dois canais de uma vez, sem ambiguidade de ordem:' },
      {
        cheat: [
          ['cmd &> arq', 'os dois canais para arq (substituindo)'],
          ['cmd &>> arq', 'os dois canais, acrescentando'],
          ['cmd > arq 2>&1', 'equivalente, forma clássica'],
          ['cmd &> /dev/null', 'silêncio total']
        ]
      },
      {
        box: 'note', body: [
          { p: 'O <code>&amp;&gt;</code> é uma extensão do Bash. Em scripts que precisam rodar em <code>sh</code>/<code>dash</code> puro (como os que usam <code>#!/bin/sh</code>), use a forma clássica <code>&gt; arq 2&gt;&amp;1</code>, que é POSIX e funciona em qualquer shell.' }
        ]
      },
      { code: ['$ ls /etc /naoexiste &> ~/completo.txt', '$ tail -2 ~/completo.txt'] },

      { h2: 'Silêncio total' },
      { p: 'A combinação que aparece em todo script de produção e em toda crontab:' },
      { code: ['$ comando-qualquer > /dev/null 2>&1'], run: false, mixed: false },
      { p: 'Ela diz: "rode isto, não quero ver nada, nem resultado nem erro". É comum em tarefas agendadas, onde a saída iria virar e-mail para o root.' },
      {
        box: 'warn', body: [
          { p: 'Silenciar erros é conveniente e perigoso. Se um script agendado falha todo dia e a saída vai para <code>/dev/null</code>, ninguém descobre. Prefira mandar para um arquivo de log:' },
          { code: ['comando >> /var/log/minha-tarefa.log 2>&1'], run: false, mixed: false, lang: 'text' }
        ]
      },

      { h2: 'Resumo' },
      {
        cheat: [
          ['2>/dev/null', 'descarta os erros'],
          ['2>&1', 'manda o canal 2 para onde o 1 estiver'],
          ['> arq 2>&1', 'os dois no arquivo (ordem correta)'],
          ['2>&1 > arq', 'ARMADILHA: o erro fica na tela'],
          ['&> arq', 'forma curta do Bash para os dois'],
          ['> /dev/null 2>&1', 'silêncio completo']
        ]
      }
    ],
    tasks: [
      {
        id: 't4-3-a', kind: 'guiado', title: 'A ordem que engana',
        body: [
          { p: 'Este é o experimento que fixa o conceito. Rode e compare o conteúdo dos dois arquivos:' },
          {
            code: [
              '$ ls /naoexiste > ~/certo.txt 2>&1',
              '$ ls /naoexiste 2>&1 > ~/errado.txt',
              '$ echo "--- certo.txt tem:"; cat ~/certo.txt',
              '$ echo "--- errado.txt tem:"; cat ~/errado.txt'
            ]
          },
          { p: 'O <code>certo.txt</code> capturou a mensagem. O <code>errado.txt</code> ficou vazio e o erro apareceu na tela — porque quando o canal 2 foi redirecionado, o canal 1 ainda apontava para lá.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [H.isFile(ctx, '/home/aluno/certo.txt'), 'Crie o <code>~/certo.txt</code> com a forma <code>&gt; arq 2&gt;&amp;1</code>.'],
          [H.isFile(ctx, '/home/aluno/errado.txt'), 'Crie o <code>~/errado.txt</code> com a forma <code>2&gt;&amp;1 &gt; arq</code>.'],
          [(H.read(ctx, '/home/aluno/certo.txt') || '').includes('No such file'), 'O <code>certo.txt</code> deveria conter a mensagem de erro.'],
          [(H.read(ctx, '/home/aluno/errado.txt') || '').trim() === '', 'O <code>errado.txt</code> deveria estar vazio — é justamente esse o ponto do exercício.']
        ])
      },
      {
        id: 't4-3-f', kind: 'fill', title: 'Complete o comando',
        body: [{ p: 'Complete para que <strong>tudo</strong> — resultado e erros — seja descartado, sem aparecer nada na tela:' }],
        template: 'find / -name "*.conf" ___',
        answers: ['> ?/dev/null 2>&1'], sample: '> /dev/null 2>&1',
        hints: ['São dois redirecionamentos, e a ordem entre eles importa.'],
        solution: 'A resposta clássica é <code>&gt; /dev/null 2&gt;&amp;1</code>. A forma curta do Bash <code>&amp;&gt; /dev/null</code> também vale. O que <strong>não</strong> funciona é <code>2&gt;&amp;1 &gt; /dev/null</code>: aí os erros continuariam na tela.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim().replace(/\s+/g, ' ');
          if (/^&>>?\s*\/dev\/null$/.test(v)) return { ok: true, msg: 'A forma curta do Bash. Perfeito.' };
          if (/^2>&1\s*>\s*\/dev\/null$/.test(v)) return { ok: false, msg: 'Ordem invertida: assim os <strong>erros continuam na tela</strong>. Leia da esquerda para a direita.' };
          return LX.H.checkAll([
            [/>\s*\/dev\/null/.test(v), 'Falta mandar a saída normal para <code>/dev/null</code>.'],
            [/2>&1/.test(v), 'Falta juntar o canal de erro ao canal de saída com <code>2&gt;&amp;1</code>.'],
            [v.indexOf('/dev/null') < v.indexOf('2>&1'), 'A ordem está invertida — o <code>2&gt;&amp;1</code> precisa vir <strong>depois</strong>.']
          ]);
        }
      },
      {
        id: 't4-3-b', kind: 'desafio', title: 'Um script de tarefa agendada bem-comportado',
        body: [
          { p: 'Você vai preparar o comando que rodaria numa crontab. Ele precisa:' },
          {
            ol: [
              'varrer <code>/etc</code> procurando arquivos <code>*.conf</code>;',
              'gravar a lista encontrada em <code>~/tarefa.log</code>, <strong>acrescentando</strong> (a tarefa roda todo dia);',
              'gravar também no mesmo arquivo qualquer mensagem de erro;',
              'não imprimir absolutamente nada na tela.'
            ]
          },
          { p: 'Rode o comando <strong>duas vezes</strong> e confirme que o log cresceu — prova de que você usou o modo de acrescentar.' }
        ],
        hints: [
          'Para acrescentar os dois canais existem duas formas: <code>&gt;&gt; arq 2&gt;&amp;1</code> ou <code>&amp;&gt;&gt; arq</code>.',
          'O comando fica: <code>find /etc -name "*.conf" &gt;&gt; ~/tarefa.log 2&gt;&amp;1</code>. Rode duas vezes.'
        ],
        solution: '<div class="code"><pre>find /etc -name "*.conf" &gt;&gt; ~/tarefa.log 2&gt;&amp;1\nfind /etc -name "*.conf" &gt;&gt; ~/tarefa.log 2&gt;&amp;1\n\nwc -l ~/tarefa.log</pre></div><p style="margin-top:8px">Numa crontab de verdade a linha seria assim mesmo — e é bem melhor do que <code>&gt; /dev/null 2&gt;&amp;1</code>, porque quando algo falhar você terá o registro.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/tarefa.log');
          if (c === null) return { ok: false, msg: 'O arquivo ~/tarefa.log ainda não existe.' };
          const linhas = c.split('\n').filter(Boolean);
          const unicas = new Set(linhas);
          return LX.H.checkAll([
            [linhas.some(l => /\.conf$/.test(l)), 'O log não contém arquivos <code>.conf</code>. Confira o <code>find</code>.'],
            [linhas.length > unicas.size, 'O log tem cada caminho uma vez só — parece que você rodou uma vez, ou usou <code>&gt;</code> em vez de <code>&gt;&gt;</code>. Rode duas vezes acrescentando.'],
            [() => H.usedCommand(ctx, /(>>[^|]*2>&1|&>>)/), 'Use uma forma que <strong>acrescente</strong> os dois canais: <code>&gt;&gt; arq 2&gt;&amp;1</code> ou <code>&amp;&gt;&gt; arq</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 3.4 ============================== */
  LX.lesson('m04', {
    id: 'l4-4', n: '3.4', title: 'Entrada: <, << e <<<',
    goal: 'Alimentar comandos com dados de arquivos, blocos de texto ou strings — sem depender do teclado.',
    body: [
      { cmd: '<' },
      { p: 'Aponta o <strong>canal 0</strong> para um arquivo: o comando lê dali em vez de esperar você digitar.' },
      { code: ['$ wc -l < ~/documentos/servidores.csv', '$ sort < ~/documentos/tarefas.txt'] },
      { h3: 'Qual a diferença para passar o nome do arquivo?' },
      { p: 'Compare:' },
      { code: ['$ wc -l ~/documentos/servidores.csv', '$ wc -l < ~/documentos/servidores.csv'] },
      { p: 'O resultado numérico é o mesmo, mas na segunda forma <strong>o nome do arquivo não aparece</strong>. É que na primeira o <code>wc</code> recebeu um caminho e sabe de onde veio; na segunda ele só recebeu bytes por um canal, sem saber a origem.' },
      {
        box: 'tip', body: [
          { p: 'É por isso que <code>wc -l &lt; arquivo</code> é a forma certa quando você quer só o número para usar em um script: sem o nome grudado, o valor já sai limpo.' }
        ]
      },
      { p: 'Há ainda uma diferença importante: comandos como <code>grep</code> e <code>sed</code> aceitam vários arquivos como argumento, mas só um canal de entrada. <code>grep x a.txt b.txt</code> funciona; <code>grep x &lt; a.txt &lt; b.txt</code> não faz o que você espera.' },

      { cmd: '<<' },
      { p: 'O <strong>heredoc</strong>: em vez de um arquivo, você escreve o conteúdo ali mesmo, e o shell entrega tudo pelo canal 0.' },
      {
        code: [
          `$ cat > ~/servidor.conf << 'FIM'`,
          `porta 8080`,
          `usuario app`,
          `raiz /var/www`,
          `FIM`,
          `$ cat ~/servidor.conf`
        ], run: false, mixed: false
      },
      { p: 'Tudo entre a linha do <code>&lt;&lt;</code> e a linha que contém <strong>apenas</strong> o delimitador vira a entrada. O nome <code>FIM</code> é livre — <code>EOF</code> é só a convenção mais comum.' },
      { h3: 'Com ou sem aspas no delimitador' },
      {
        table: {
          head: ['Forma', 'Comportamento'],
          rows: [
            ['<code>&lt;&lt; EOF</code>', 'variáveis e <code>$(...)</code> <strong>são expandidos</strong>'],
            ["<code>&lt;&lt; 'EOF'</code>", 'nada é expandido — o texto vai literal'],
            ['<code>&lt;&lt;- EOF</code>', 'remove tabulações do início das linhas (para indentar dentro de scripts)']
          ]
        }
      },
      {
        code: [
          `$ cat << EOF`,
          `Voce e o usuario $USER`,
          `A pasta atual e $(pwd)`,
          `EOF`,
          `$ cat << 'EOF'`,
          `Voce e o usuario $USER`,
          `EOF`
        ], run: false, mixed: false
      },
      {
        box: 'warn', body: [
          { p: 'Esquecer as aspas no delimitador é um erro clássico ao gerar scripts ou configurações que <em>contêm</em> cifrões. Se o arquivo gerado precisa ter <code>$VARIAVEL</code> literal, use <code>&lt;&lt; \'EOF\'</code>.' }
        ]
      },

      { cmd: '<<<' },
      { p: 'O <strong>herestring</strong>: manda uma única string pela entrada padrão. É a forma curta e elegante de substituir <code>echo texto | comando</code>.' },
      {
        code: [
          '$ grep -o "[0-9]*" <<< "porta 8080"',
          '$ tr a-z A-Z <<< "isto vira maiusculo"',
          '$ wc -w <<< "quantas palavras tem aqui"'
        ]
      },
      { p: 'As duas linhas abaixo fazem o mesmo, e a segunda é preferível porque não cria um processo a mais:' },
      { code: ['echo "texto" | comando', 'comando <<< "texto"'], run: false, mixed: false, lang: 'text' },

      { h2: 'Combinando entrada e saída' },
      { p: 'Nada impede usar os dois lados no mesmo comando:' },
      { code: ['$ sort < ~/documentos/tarefas.txt > ~/tarefas-ordenadas.txt', '$ cat ~/tarefas-ordenadas.txt'] },
      { p: 'Leia como um encanamento: entra por um lado, sai pelo outro.' },

      { h2: 'Resumo' },
      {
        cheat: [
          ['cmd < arq', 'lê do arquivo pelo canal 0'],
          ['wc -l < arq', 'só o número, sem o nome do arquivo'],
          ["cmd << 'EOF' … EOF", 'bloco literal, sem expansão'],
          ['cmd << EOF … EOF', 'bloco com variáveis expandidas'],
          ['cmd <<< "texto"', 'uma string pela entrada padrão'],
          ['cmd < entrada > saida', 'os dois lados no mesmo comando']
        ]
      },
      {"h2": "Entenda o pequeno script antes de executá-lo"},
      {"p": "A primeira linha <code>#!/bin/bash</code> indica o interpretador. <code>ALVO=/tmp</code> e <code>DIAS=7</code> atribuem valores; $ALVO e $DIAS consultam esses valores durante a execução. Um delimitador de heredoc entre aspas preserva esses símbolos no arquivo, em vez de expandi-los enquanto você o cria."},
      {"p": "<code>chmod +x ~/limpar.sh</code> adiciona permissão de execução. <code>~/limpar.sh</code> executa o arquivo pelo caminho completo a partir de sua pasta pessoal; <code>./limpar.sh</code> só funciona se você estiver nessa pasta. As permissões serão aprofundadas no próximo módulo."},
      {"p": "A linha <code>find \"$ALVO\" -type f -mtime +$DIAS -delete</code> percorre a pasta indicada; -type f seleciona arquivos comuns, -mtime +7 seleciona arquivos cuja idade em dias completos é maior que sete e -delete remove os selecionados. Primeiro confira a seleção sem -delete. Nesta atividade, use somente /tmp na máquina simulada; não copie essa limpeza para um computador com dados importantes."},
    ],
    tasks: [
      {
        id: 't4-4-a', kind: 'guiado', title: 'As três formas de alimentar um comando',
        body: [
          { p: 'Compare arquivo, bloco e string:' },
          {
            code: [
              '$ wc -l < /etc/passwd',
              `$ cat << 'EOF' > ~/exemplo.txt`,
              `linha um`,
              `linha dois com $HOME literal`,
              `EOF`,
              '$ cat ~/exemplo.txt',
              '$ tr a-z A-Z <<< "vira tudo maiusculo"'
            ]
          },
          { p: 'Repare que o <code>$HOME</code> foi para o arquivo <strong>literalmente</strong>, porque o delimitador estava entre aspas.' }
        ],
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/exemplo.txt');
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /<\s*\/etc\/passwd/), 'Use <code>wc -l &lt; /etc/passwd</code>.'],
            [c !== null, 'Crie o arquivo <code>~/exemplo.txt</code> com um heredoc.'],
            [c && /\$HOME/.test(c), 'O <code>$HOME</code> deveria ter ido literal para o arquivo — use o delimitador entre aspas: <code>&lt;&lt; \'EOF\'</code>.'],
            [() => H.usedCommand(ctx, /<<</), 'Use uma herestring <code>&lt;&lt;&lt;</code>.']
          ]);
        }
      },
      {
        id: 't4-4-q', kind: 'quiz', title: 'Por que o arquivo saiu errado?',
        body: [
          { p: 'Você gerou um script com heredoc:' },
          {
            code: [
              'cat > backup.sh << EOF',
              '#!/bin/bash',
              'DESTINO=/backup',
              'cp -a $HOME $DESTINO',
              'EOF'
            ], run: false, mixed: false
          },
          { p: 'Ao abrir o <code>backup.sh</code>, a última linha virou <code>cp -a /home/aluno </code> — o <code>$DESTINO</code> sumiu. O que houve?' }
        ],
        options: [
          { text: 'Sem aspas no delimitador, o shell expandiu as variáveis na hora de criar o arquivo. <code>$DESTINO</code> ainda não existia, então virou vazio.', correct: true },
          { text: 'O <code>cp</code> apagou a variável.', why: 'O <code>cp</code> nunca chegou a rodar — o problema aconteceu na criação do arquivo.' },
          { text: 'Faltou exportar a variável <code>DESTINO</code>.', why: 'Exportar afeta processos filhos. O problema é o momento da expansão, não o escopo.' },
          { text: 'O heredoc não suporta a instrução <code>cp</code>.', why: 'O heredoc não interpreta nada do conteúdo — ele só entrega texto.' }
        ],
        explain: 'Com <code>&lt;&lt; EOF</code> (sem aspas), o shell expande <code>$HOME</code> e <code>$DESTINO</code> <strong>enquanto grava o arquivo</strong>. Como <code>$DESTINO</code> só existiria depois, quando o script fosse executado, ela foi substituída por nada. A correção é uma só: <code>cat &gt; backup.sh &lt;&lt; \'EOF\'</code>.'
      },
      {
        id: 't4-4-b', kind: 'desafio', title: 'Gere um script que preserva as variáveis',
        body: [
          { p: 'Crie, usando <strong>heredoc</strong>, o arquivo <code>~/limpar.sh</code> com exatamente este conteúdo:' },
          {
            code: [
              '#!/bin/bash',
              'ALVO=/tmp',
              'DIAS=7',
              'echo "Limpando $ALVO com mais de $DIAS dias"',
              'find "$ALVO" -type f -mtime +$DIAS -delete'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'As variáveis precisam chegar ao arquivo <strong>literais</strong> — se você abrir o arquivo e ver <code>echo "Limpando  com mais de  dias"</code>, o heredoc expandiu na hora errada.' },
          { p: 'Depois, torne o script executável e rode-o para conferir a mensagem.' }
        ],
        hints: [
          'A diferença entre funcionar e não funcionar é uma única coisa: aspas no delimitador.',
          '<code>cat &gt; ~/limpar.sh &lt;&lt; \'EOF\'</code> … <code>EOF</code>, depois <code>chmod +x ~/limpar.sh</code> e <code>./limpar.sh</code>.'
        ],
        solution: `<div class="code"><pre>cat &gt; ~/limpar.sh &lt;&lt; 'EOF'
#!/bin/bash
ALVO=/tmp
DIAS=7
echo "Limpando $ALVO com mais de $DIAS dias"
find "$ALVO" -type f -mtime +$DIAS -delete
EOF

chmod +x ~/limpar.sh
cat ~/limpar.sh
./limpar.sh</pre></div>`,
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/limpar.sh');
          if (c === null) return { ok: false, msg: 'O arquivo ~/limpar.sh ainda não existe.' };
          return LX.H.checkAll([
            [/^#!\/bin\/bash/m.test(c), 'Falta a linha do shebang <code>#!/bin/bash</code>.'],
            [/ALVO=\/tmp/.test(c), 'Falta a linha <code>ALVO=/tmp</code>.'],
            [/\$ALVO/.test(c), 'A variável <code>$ALVO</code> foi expandida na criação do arquivo. Use o delimitador entre aspas: <code>&lt;&lt; \'EOF\'</code>.'],
            [/\$DIAS/.test(c), 'A variável <code>$DIAS</code> foi expandida na criação do arquivo. Use <code>&lt;&lt; \'EOF\'</code>.'],
            [/find\s+"\$ALVO"/.test(c), 'Falta a linha do <code>find</code> com <code>"$ALVO"</code>.'],
            [(H.mode(ctx, '/home/aluno/limpar.sh') & 0o100) !== 0, 'O script ainda não é executável. Use <code>chmod +x</code>.'],
            [() => H.usedCommand(ctx, /\.\/limpar\.sh|bash\s+~?\/?.*limpar\.sh/), 'Execute o script para conferir a mensagem.']
          ]);
        }
      }
    ]
  });

  /* ============================== 3.5 ============================== */
  LX.lesson('m04', {
    id: 'l4-5', n: '3.5', title: 'Pipes: a ideia central do Unix',
    goal: 'Encaixar comandos como peças de encanamento — e entender o que acontece por baixo quando você digita uma barra vertical.',
    body: [
      { p: 'O pipe <code>|</code> conecta o <strong>stdout</strong> de um comando ao <strong>stdin</strong> do próximo. Só isso. E é a partir dessa regra simples que surge quase todo o poder do terminal.' },
      {
        ascii: `  ┌────────┐          ┌────────┐          ┌────────┐
  │   ls   │─ stdout ▶│  grep  │─ stdout ▶│  wc -l │──▶ tela
  └────────┘   pipe   └────────┘   pipe   └────────┘`
      },
      { code: ['$ ls /usr/bin | grep zip', '$ ls /usr/bin | grep zip | wc -l'] },

      { h2: 'O que acontece por dentro' },
      { p: 'Quando você digita <code>a | b</code>, o shell:' },
      {
        ol: [
          'cria um <strong>pipe</strong> no kernel — um buffer na memória com duas pontas;',
          'inicia os <strong>dois processos ao mesmo tempo</strong>;',
          'liga o stdout de <code>a</code> na ponta de escrita e o stdin de <code>b</code> na ponta de leitura;',
          'deixa os dois correrem em paralelo.'
        ]
      },
      {
        box: 'key', label: 'Eles rodam juntos, não em sequência', body: [
          { p: 'Este é o detalhe que quase ninguém percebe: o segundo comando <strong>não espera</strong> o primeiro terminar. Assim que o primeiro escreve algo, o segundo já processa.' },
          { p: 'Consequências práticas: um pipeline sobre um arquivo de 10 GB não precisa de 10 GB de memória — os dados fluem. E <code>comando-infinito | head -5</code> termina rápido: quando o <code>head</code> já tem suas cinco linhas, ele fecha o pipe e o primeiro comando recebe um sinal para parar.' }
        ]
      },
      { code: ['$ yes | head -3'] },
      { p: 'O <code>yes</code> imprimiria "y" para sempre. Ele parou porque o <code>head</code> fechou a ponta de leitura.' },

      { h2: 'Nem todo comando lê da entrada padrão' },
      { p: 'Um pipe só funciona se o comando da direita souber ler do stdin. Comandos que operam sobre <em>argumentos</em> ignoram o que chega pelo pipe:' },
      {
        table: {
          head: ['Leem stdin (funcionam com pipe)', 'Só aceitam argumentos'],
          rows: [
            ['<code>grep</code>, <code>sed</code>, <code>awk</code>', '<code>rm</code>, <code>cp</code>, <code>mv</code>'],
            ['<code>sort</code>, <code>uniq</code>, <code>cut</code>, <code>tr</code>', '<code>mkdir</code>, <code>chmod</code>, <code>chown</code>'],
            ['<code>wc</code>, <code>head</code>, <code>tail</code>', '<code>touch</code>, <code>ln</code>'],
            ['<code>tee</code>, <code>less</code>, <code>cat</code>', '<code>echo</code> (imprime o argumento)']
          ]
        }
      },
      { p: 'Para os da direita, existe o <code>xargs</code> (visto no módulo 4), que converte a entrada em argumentos:' },
      { code: ['$ ls ~/documentos | xargs -I {} echo "encontrei: {}"'] },

      { h2: 'O código de saída de um pipeline' },
      { p: 'Por padrão, o <code>$?</code> de um pipeline é o código do <strong>último</strong> comando. Isso esconde falhas no meio:' },
      { code: ['$ cat /naoexiste 2>/dev/null | wc -l', '$ echo $?'] },
      { p: 'O <code>cat</code> falhou, mas o <code>wc</code> terminou bem e devolveu 0. Para um script, isso é um desastre silencioso.' },
      { h3: 'Duas soluções' },
      {
        cheat: [
          ['echo ${PIPESTATUS[@]}', 'mostra o código de cada etapa do último pipeline'],
          ['set -o pipefail', 'faz o pipeline falhar se QUALQUER etapa falhar']
        ]
      },
      {
        code: [
          '$ cat /naoexiste 2>/dev/null | wc -l',
          '$ echo "cada etapa: ${PIPESTATUS[@]}"',
          '$ set -o pipefail',
          '$ cat /naoexiste 2>/dev/null | wc -l',
          '$ echo "com pipefail: $?"',
          '$ set +o pipefail'
        ]
      },
      {
        box: 'tip', body: [
          { p: 'Todo script sério começa com <code>set -euo pipefail</code>. O <code>pipefail</code> é justamente a parte que impede que uma falha no meio de um pipeline passe despercebida. Voltaremos a isso no módulo 15.' }
        ]
      },

      { h2: 'Construindo um pipeline: uma etapa por vez' },
      {
        box: 'key', label: 'O método', body: [
          { p: 'Não tente escrever um pipeline de cinco comandos de cabeça. Construa incrementalmente, olhando a saída a cada etapa. É assim que se faz na prática:' }
        ]
      },
      {
        code: [
          '$ cut -d: -f7 /etc/passwd | head -3',
          '$ cut -d: -f7 /etc/passwd | sort | head -3',
          '$ cut -d: -f7 /etc/passwd | sort | uniq -c',
          '$ cut -d: -f7 /etc/passwd | sort | uniq -c | sort -rn'
        ]
      },
      { p: 'Cada linha acrescenta uma etapa e você confere se o resultado ainda faz sentido. Quando algo quebra, você sabe exatamente onde.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>|</code> liga o stdout de um ao stdin do outro; os processos rodam <strong>em paralelo</strong>.',
          'Comandos que só aceitam argumentos precisam de <code>xargs</code>.',
          'O <code>$?</code> do pipeline é o do último comando — use <code>PIPESTATUS</code> ou <code>set -o pipefail</code>.',
          'Construa pipelines uma etapa por vez, conferindo a saída.'
        ]
      }
    ],
    tasks: [
      {
        id: 't4-5-a', kind: 'guiado', title: 'Construa por etapas',
        body: [
          { p: 'Responda "quais shells os usuários desta máquina usam, e quantos usam cada um?" acrescentando uma etapa de cada vez:' },
          {
            code: [
              '$ cut -d: -f7 /etc/passwd',
              '$ cut -d: -f7 /etc/passwd | sort',
              '$ cut -d: -f7 /etc/passwd | sort | uniq -c',
              '$ cut -d: -f7 /etc/passwd | sort | uniq -c | sort -rn'
            ]
          },
          { p: 'Agora veja o paralelismo em ação e o código de saída escondido:' },
          { code: ['$ yes | head -3', '$ cat /naoexiste 2>/dev/null | wc -l', '$ echo "PIPESTATUS: ${PIPESTATUS[@]}"'] }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /cut[^|]*\|\s*sort[^|]*\|\s*uniq/), 'Monte o pipeline <code>cut | sort | uniq -c</code>.'],
          [() => H.usedCommand(ctx, /PIPESTATUS/), 'Consulte o <code>${PIPESTATUS[@]}</code> depois de um pipeline com falha.']
        ])
      },
      {
        id: 't4-5-p', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'O que este comando devolve como código de saída?' },
          { code: ['grep "nao-existe-em-lugar-nenhum" /etc/passwd | wc -l; echo $?'], run: false, mixed: false }
        ],
        options: [
          { text: '0 — porque o <code>wc</code> terminou com sucesso, mesmo o <code>grep</code> não tendo encontrado nada.', correct: true },
          { text: '1 — porque o <code>grep</code> não encontrou nada.', why: 'O <code>grep</code> devolveu 1, mas o <code>$?</code> de um pipeline reflete apenas o <strong>último</strong> comando.' },
          { text: '2 — erro de uso.', why: 'A sintaxe está correta; não houve erro de uso.' },
          { text: 'Depende do conteúdo do arquivo.', why: 'Não depende: o <code>wc</code> sempre termina com sucesso, mesmo contando zero linhas.' }
        ],
        explain: 'Este é exatamente o problema que o <code>pipefail</code> resolve. Sem ele, um script que faz <code>curl ... | jq ...</code> considera tudo certo mesmo quando o <code>curl</code> falhou. Confirme com <code>echo ${PIPESTATUS[@]}</code>: você vai ver <code>1 0</code>.'
      },
      {
        id: 't4-5-b', kind: 'desafio', title: 'Quem mais consome espaço em /etc?',
        body: [
          { p: 'Monte um pipeline que responda: <strong>quais são os cinco maiores itens de primeiro nível dentro de <code>/etc</code></strong>, com tamanho legível, do maior para o menor.' },
          { p: 'Grave o resultado em <code>~/top-etc.txt</code>. Construa por etapas antes de redirecionar.' },
          { p: 'Cuidado com um detalhe: o <code>du</code> vai reclamar de alguns diretórios sem permissão. Esses erros não podem entrar no arquivo.' }
        ],
        hints: [
          '<code>du -sh /etc/*</code> mede cada item de primeiro nível. Os erros saem pelo canal 2.',
          'Junte tudo: <code>du -sh /etc/* 2&gt;/dev/null | sort -rh | head -5 &gt; ~/top-etc.txt</code>. O <code>sort -h</code> compara tamanhos legíveis corretamente.'
        ],
        solution: '<div class="code"><pre>du -sh /etc/* 2&gt;/dev/null | sort -rh | head -5 &gt; ~/top-etc.txt\ncat ~/top-etc.txt</pre></div><p style="margin-top:8px">Sem o <code>2&gt;/dev/null</code>, as mensagens de permissão apareceriam na tela (não no arquivo, porque vão pelo canal 2) — mas atrapalhariam a leitura.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/top-etc.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/top-etc.txt ainda não existe.' };
          const linhas = c.split('\n').filter(l => l.trim());
          return LX.H.checkAll([
            [linhas.length === 5, `O arquivo tem ${linhas.length} linha(s); são esperadas exatamente 5.`],
            [linhas.every(l => /\/etc\//.test(l)), 'Todas as linhas devem se referir a itens dentro de <code>/etc</code>.'],
            [linhas.every(l => /^\s*[\d.,]+[KMG]?\s/.test(l)), 'Cada linha deve começar com o tamanho legível. Use <code>du -sh</code>.'],
            [!/No such file|Permission denied|cannot/.test(c), 'Há mensagens de erro dentro do arquivo. Descarte-as com <code>2>/dev/null</code>.'],
            [() => H.usedCommand(ctx, /sort\s+-[a-z]*[rh]/), 'Ordene por tamanho com <code>sort -rh</code>.']
          ]);
        }
      },

    ]
  });
})();
