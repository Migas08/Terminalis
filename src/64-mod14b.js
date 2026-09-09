/* =========================================================================
   MÓDULO 14 — Variáveis e ambiente (continuação: 14.4 e 14.5)
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const ler = (ctx, p) => H.read(ctx, p) || '';
  const rodar = async (ctx, cmd) => (ctx.run ? (await ctx.run(cmd)).out : '');

  /* ============================== 14.4 ============================== */
  LX.lesson('m14', {
    id: 'l14-4', n: '14.4', title: 'Aspas e a ordem das expansões',
    goal: 'Entender por que uma aspa a mais ou a menos muda o comportamento do comando — e parar de descobrir isso por tentativa e erro.',
    body: [
      { h2: 'O shell reescreve a linha antes de executar' },
      { p: 'Quando você aperta Enter, o Bash não entrega a linha ao programa. Ele <strong>reescreve</strong> a linha inteira, numa ordem fixa, e só então executa o resultado. Quase todo bug de shell é uma surpresa nessa reescrita.' },
      {
        ascii: `você digita:   grep $PADRAO *.log

  1. til             ~  →  /home/aluno
  2. chaves          {a,b}  →  a b
  3. parâmetro       $PADRAO  →  erro de rede
  4. substituição    $(cmd)  →  a saída do comando
  5. aritmética      $((2+3))  →  5
  6. DIVISÃO EM PALAVRAS   ← aqui mora o problema
  7. glob            *.log  →  app.log sys.log
  8. redirecionamento

o shell executa:  grep erro de rede app.log sys.log`
      },
      { p: 'Repare no passo 6. Depois de trocar <code>$PADRAO</code> por <code>erro de rede</code>, o shell <strong>reparte o resultado nos espaços</strong>. O <code>grep</code> recebe quatro argumentos: procura <code>erro</code> nos arquivos <code>de</code>, <code>rede</code>, <code>app.log</code> e <code>sys.log</code>.' },
      {
        box: 'key', label: 'A regra que resolve 90% dos bugs de shell', body: [
          { p: '<strong>Aspas duplas impedem os passos 6 e 7.</strong> <code>grep "$PADRAO" *.log</code> entrega <code>erro de rede</code> como um argumento só.' },
          { p: 'Na dúvida, ponha aspas duplas. Não existe praticamente nenhum caso em que <code>"$var"</code> esteja errado e <code>$var</code> esteja certo — e existem muitos casos em que o contrário quebra.' }
        ]
      },

      { h2: 'Os três tipos de aspas' },
      {
        table: {
          head: ['Forma', 'Expande <code>$var</code>?', 'Divide em palavras?', 'Expande glob?', 'Use para'],
          rows: [
            ['sem aspas', 'sim', '<strong>sim</strong>', '<strong>sim</strong>', 'quando você <em>quer</em> o glob'],
            ['<code>"aspas duplas"</code>', 'sim', 'não', 'não', '<strong>o padrão</strong>'],
            ['<code>\'aspas simples\'</code>', '<strong>não</strong>', 'não', 'não', 'texto literal, regex, senha'],
            ['<code>\\$</code>', 'não (só o caractere seguinte)', '—', '—', 'escapar um caractere isolado']
          ]
        }
      },
      { code: ['$ NOME="Ana Maria"', '$ echo $NOME', '$ echo "$NOME"', '$ echo \'$NOME\''] },
      { p: 'A aspa simples é absoluta: <em>nada</em> é interpretado dentro dela, nem <code>$</code>, nem <code>\\</code>, nem crase. É por isso que ela é a escolha certa para uma expressão regular do <code>grep</code> ou um padrão do <code>find</code> — você quer que o programa receba o <code>*</code>, não que o shell o expanda antes.' },

      { h2: 'Substituição de comando' },
      { p: 'O <code>$(comando)</code> executa e é substituído pela saída. E a saída sofre os mesmos passos 6 e 7 — portanto precisa das mesmas aspas:' },
      { code: ['$ echo "hoje é $(date +%F)"', '$ ARQ="$(ls -t /etc | head -1)"', '$ echo "o mais recente: $ARQ"'] },
      {
        box: 'warn', label: 'O clássico que quebra com espaço', body: [
          { code: ['for f in $(ls); do rm $f; done       # quebra em "meu arquivo.txt"', 'for f in *; do rm "$f"; done          # certo'], run: false },
          { p: 'A primeira linha erra duas vezes: usa <code>ls</code> (cuja saída é feita para gente ler, não para script processar) e não usa aspas. A segunda usa o glob do próprio shell, que preserva os nomes, e cita a variável. <strong>Não processe a saída do <code>ls</code>.</strong>' }
        ]
      },
      { p: 'Prefira <code>$( )</code> à crase antiga: ele aninha e é muito mais fácil de enxergar numa linha longa.' },

      { h2: 'Expansões de parâmetro que evitam chamar outro programa' },
      {
        table: {
          head: ['Forma', 'Resultado com <code>f=/var/log/app.tar.gz</code>'],
          rows: [
            ['<code>${f##*/}</code>', '<code>app.tar.gz</code> — o mesmo que <code>basename</code>'],
            ['<code>${f%/*}</code>', '<code>/var/log</code> — o mesmo que <code>dirname</code>'],
            ['<code>${f%.gz}</code>', '<code>/var/log/app.tar</code> — remove o menor sufixo'],
            ['<code>${f%%.*}</code>', '<code>/var/log/app</code> — remove o maior sufixo'],
            ['<code>${#f}</code>', 'o comprimento em caracteres'],
            ['<code>${f/log/logs}</code>', 'troca a <strong>primeira</strong> ocorrência'],
            ['<code>${f//log/logs}</code>', 'troca <strong>todas</strong>'],
            ['<code>${VAZIA:-padrao}</code>', 'usa <code>padrao</code> se estiver vazia'],
            ['<code>${VAZIA:?mensagem}</code>', '<strong>aborta</strong> com a mensagem se estiver vazia']
          ]
        }
      },
      { p: 'Memorize a lógica dos símbolos: <code>#</code> tira do <strong>começo</strong>, <code>%</code> tira do <strong>fim</strong>; dobrado (<code>##</code>, <code>%%</code>) é a versão <em>gulosa</em>, que come o máximo possível.' },
      { p: 'Isso não é só elegância. Num laço de dez mil arquivos, cada <code>basename</code> é um processo novo; a expansão acontece dentro do shell. A diferença é de segundos para minutos.' },

      { h2: 'Resumo' },
      {
        ul: [
          'O shell reescreve a linha em oito passos antes de executar.',
          'A divisão em palavras (passo 6) é a origem de quase todo bug de aspas.',
          'Aspas duplas: expande variável, não divide. Aspas simples: literal absoluto.',
          'Cite a substituição de comando também: <code>"$(cmd)"</code>.',
          'Não processe a saída do <code>ls</code>; use glob.',
          '<code>${f##*/}</code> e <code>${f%/*}</code> substituem <code>basename</code> e <code>dirname</code> sem criar processo.'
        ]
      }
    ],
    tasks: [
      {
        id: 't14-4-a', kind: 'guiado', title: 'Veja a divisão em palavras acontecendo',
        body: [
          { p: 'Rode e compare com atenção — a diferença entre as duas primeiras linhas é a aula inteira:' },
          {
            code: [
              '$ NOME="Ana Maria"',
              '$ echo $NOME',
              '$ echo "$NOME"',
              '$ echo \'$NOME\'',
              '$ mkdir -p ~/aspas && cd ~/aspas',
              '$ touch "meu arquivo.txt" outro.txt',
              '$ for f in *; do echo "[$f]"; done',
              '$ for f in $(ls); do echo "[$f]"; done',
              '$ cd ~'
            ]
          },
          { p: 'Os dois <code>echo</code> imprimem o mesmo texto, mas o primeiro passou dois argumentos e o segundo, um. E os dois laços mostram por que não se processa a saída do <code>ls</code>: o segundo transformou um arquivo em dois.' }
        ],
        hints: ['O <code>for f in *</code> usa o glob do shell, que preserva o nome inteiro de cada arquivo.'],
        check: async (ctx) => H.checkAll([
          [() => H.exists(ctx, '/home/aluno/aspas/meu arquivo.txt'), 'Crie o arquivo com espaço no nome em <code>~/aspas</code>.'],
          [() => H.usedCommand(ctx, /for\s+f\s+in\s+\*/), 'Rode o laço com o glob: <code>for f in *; do echo "[$f]"; done</code>.'],
          [() => H.usedCommand(ctx, /for\s+f\s+in\s+\$\(\s*ls/), 'Rode também a versão com <code>$(ls)</code> para ver a diferença.']
        ])
      },
      {
        id: 't14-4-q', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Um script de limpeza tem esta linha, e <code>PASTA</code> vale <code>/srv/dados antigos</code>:' },
          { code: ['find $PASTA -name "*.tmp" -delete'], run: false, lang: 'bash' },
          { p: 'O que o <code>find</code> realmente recebe?' }
        ],
        options: [
          { text: 'Dois caminhos: <code>/srv/dados</code> e <code>antigos</code> — a variável foi dividida no espaço. O <code>find</code> reclama que <code>antigos</code> não existe, ou pior, encontra outro diretório com esse nome.', correct: true },
          { text: 'O caminho <code>/srv/dados antigos</code> inteiro, porque o <code>find</code> junta os argumentos.', why: 'O <code>find</code> recebe uma lista de argumentos já separada pelo shell; ele não tem como saber que dois deles eram um só.' },
          { text: 'Um erro de sintaxe, porque falta aspas.', why: 'A sintaxe é válida. O shell executa alegremente — e é exatamente isso que torna o bug perigoso: nada avisa.' },
          { text: 'Nada, porque <code>*.tmp</code> está entre aspas e o glob não expande.', why: 'As aspas em <code>"*.tmp"</code> estão certas: elas evitam que o shell expanda o padrão antes do find. O problema está na outra variável.' }
        ],
        explain: 'A correção é <code>find "$PASTA" -name "*.tmp" -delete</code>. E vale reparar na assimetria: <code>"*.tmp"</code> precisa de aspas para o shell <strong>não</strong> expandir (quem interpreta o padrão é o find), enquanto <code>"$PASTA"</code> precisa de aspas para o shell não dividir. São dois motivos diferentes para a mesma solução — e é por isso que a regra "na dúvida, aspas duplas" funciona tão bem.'
      },
      {
        id: 't14-4-b', kind: 'desafio', title: 'Sem processo externo',
        body: [
          { p: 'Monte o cenário e escreva o script.' },
          { code: ['$ mkdir -p ~/lote ~/scripts', '$ touch ~/lote/"relatorio final.tar.gz" ~/lote/notas.txt ~/lote/dados.csv.gz'] },
          { p: 'Escreva <code>~/scripts/nomes.sh</code>, executável, que percorra os arquivos de <code>~/lote</code> e imprima <strong>uma linha por arquivo</strong>, no formato <code>nome | extensão</code>, onde:' },
          {
            ul: [
              '<strong>nome</strong> é só o nome do arquivo, sem o caminho;',
              '<strong>extensão</strong> é tudo depois do <em>primeiro</em> ponto (para <code>dados.csv.gz</code>, é <code>csv.gz</code>).'
            ]
          },
          { p: 'Duas regras: use o glob do shell (nada de <code>$(ls)</code>) e resolva com <strong>expansão de parâmetro</strong> — sem <code>basename</code>, <code>dirname</code>, <code>sed</code>, <code>awk</code> ou <code>cut</code>. E precisa funcionar com o arquivo que tem espaço no nome.' },
          { p: 'Saída esperada, em qualquer ordem:' },
          { code: ['dados.csv.gz | csv.gz', 'notas.txt | txt', 'relatorio final.tar.gz | tar.gz'], run: false, lang: 'text' }
        ],
        hints: [
          'O nome sem o caminho é <code>${f##*/}</code>. A extensão depois do primeiro ponto é <code>${nome#*.}</code>.',
          'O laço é <code>for f in ~/lote/*; do ... done</code> — e cada uso da variável precisa de aspas.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/lote ~/scripts\ntouch ~/lote/"relatorio final.tar.gz" ~/lote/notas.txt ~/lote/dados.csv.gz\n\ncat &gt; ~/scripts/nomes.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\n\nfor f in "$HOME"/lote/*; do\n  nome="${f##*/}"\n  ext="${nome#*.}"\n  echo "$nome | $ext"\ndone\nEOF\nchmod +x ~/scripts/nomes.sh\n~/scripts/nomes.sh</pre></div><p style="margin-top:8px">Três linhas dentro do laço, nenhum processo criado. O <code>##*/</code> come tudo até a última barra; o <code>#*.</code> come até o primeiro ponto. É a mesma lógica de <code>#</code> (começo) e <code>%</code> (fim) da tabela.</p>',
        check: async (ctx) => {
          const sc = ler(ctx, '/home/aluno/scripts/nomes.sh');
          if (!sc) return { ok: false, msg: 'Não encontrei <code>~/scripts/nomes.sh</code>.' };
          const saida = await rodar(ctx, '~/scripts/nomes.sh 2>&1');
          const l = saida.split('\n').map(x => x.trim()).filter(Boolean).sort();
          return H.checkAll([
            [() => (H.mode(ctx, '/home/aluno/scripts/nomes.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [() => H.exists(ctx, '/home/aluno/lote/relatorio final.tar.gz'), 'Monte o cenário: falta o arquivo com espaço no nome em <code>~/lote</code>.'],
            [() => !/\bbasename\b|\bdirname\b|\bsed\b|\bawk\b|\bcut\b/.test(sc), 'O desafio pede para resolver com expansão de parâmetro — sem <code>basename</code>, <code>sed</code>, <code>awk</code> ou <code>cut</code>.'],
            [() => !/\$\(\s*ls/.test(sc), 'Nada de <code>$(ls)</code>: use o glob do shell, que preserva nomes com espaço.'],
            [() => /\$\{[a-zA-Z_]+#/.test(sc), 'Use expansão de parâmetro (<code>${f##*/}</code>) para tirar o caminho.'],
            [() => l.length === 3, () => `A saída deve ter 3 linhas; teve ${l.length}. Saída: "${saida.slice(0, 120)}"`],
            [() => l.includes('dados.csv.gz | csv.gz'), () => `Falta a linha <code>dados.csv.gz | csv.gz</code>. Saída: "${saida.slice(0, 120)}"`],
            [() => l.includes('notas.txt | txt'), 'Falta a linha <code>notas.txt | txt</code>.'],
            [() => l.includes('relatorio final.tar.gz | tar.gz'), 'Falta a linha <code>relatorio final.tar.gz | tar.gz</code> — é ela que prova que o script sobrevive ao nome com espaço.']
          ]);
        }
      }
    ]
  });

  /* ============================== 14.5 ============================== */
  LX.lesson('m14', {
    id: 'l14-5', n: '14.5', title: 'Locale, fuso e segredos no ambiente',
    goal: 'Entender por que o mesmo script dá resultados diferentes em máquinas diferentes, e por que variável de ambiente é um lugar arriscado para guardar senha.',
    body: [
      { h2: 'A máquina tem um idioma, e isso muda a saída dos comandos' },
      { code: ['$ locale', '$ locale -a'] },
      { p: 'O <em>locale</em> define idioma das mensagens, formato de data, separador decimal e — o mais traiçoeiro — <strong>a ordem alfabética</strong>. Cada aspecto tem sua variável:' },
      {
        table: {
          head: ['Variável', 'Controla'],
          rows: [
            ['<code>LANG</code>', 'o padrão de todas as outras'],
            ['<code>LC_ALL</code>', 'sobrepõe <strong>todas</strong> — use só em script'],
            ['<code>LC_COLLATE</code>', 'a ordem do <code>sort</code> e das faixas <code>[a-z]</code>'],
            ['<code>LC_NUMERIC</code>', 'vírgula ou ponto como separador decimal'],
            ['<code>LC_TIME</code>', 'o formato de data'],
            ['<code>LC_MESSAGES</code>', 'o idioma das mensagens de erro']
          ]
        }
      },
      {
        box: 'warn', label: 'O bug que só aparece em produção', body: [
          { p: 'Em <code>LC_COLLATE=pt_BR.UTF-8</code>, o <code>sort</code> ignora maiúsculas e acentos ao comparar. Em <code>LC_COLLATE=C</code>, ele compara pelos códigos dos caracteres — e todas as maiúsculas vêm antes de qualquer minúscula.' },
          { p: 'Consequência prática: um script que compara dois arquivos ordenados funciona na sua máquina e falha no servidor, porque os locales são diferentes. O mesmo vale para <code>[a-z]</code> em expressão regular, que em alguns locales inclui maiúsculas.' },
          { p: 'A solução em script é fixar: <code>export LC_ALL=C</code> no começo. O <code>C</code> é determinístico, rápido e igual em qualquer máquina. Use-o sempre que a saída for processada por outro programa; deixe o locale do usuário para o que humanos vão ler.' }
        ]
      },

      { h2: 'Fuso horário' },
      { code: ['$ timedatectl', '$ date', '$ TZ=UTC date'] },
      { p: 'O fuso da máquina se ajusta com <code>sudo timedatectl set-timezone America/Sao_Paulo</code>. Mas a variável <code>TZ</code> permite mudá-lo <strong>só para um comando</strong>, o que é útil quando você lê um log gravado em UTC.' },
      { p: 'A convenção em servidor é manter tudo em <strong>UTC</strong> e converter só na exibição. O motivo é o horário de verão: num fuso que o adota, existe uma hora que acontece duas vezes por ano e outra que não existe — e uma tarefa agendada nesse intervalo roda duas vezes ou nenhuma. Em UTC isso não acontece.' },
      { p: 'E o sincronismo importa mais do que parece: relógio errado quebra TLS (certificado "ainda não válido"), atrapalha a correlação de log entre máquinas e pode invalidar autenticação. O <code>timedatectl</code> mostra se o NTP está ativo e sincronizado.' },

      { h2: 'Segredos: por que o ambiente não é cofre' },
      { p: 'É comum passar senha por variável de ambiente. É melhor que passar por linha de comando — mas está longe de ser seguro, e vale saber exatamente por quê:' },
      {
        table: {
          head: ['Onde vaza', 'Como'],
          rows: [
            ['<code>/proc/PID/environ</code>', 'o dono do processo (e o root) leem o ambiente inteiro'],
            ['<code>ps auxe</code>', 'mostra o ambiente dos processos'],
            ['Processos filhos', 'toda variável exportada é herdada por tudo que o script chamar'],
            ['<code>set -x</code>', 'o rastro de depuração imprime o valor'],
            ['<code>~/.bash_history</code>', 'se você atribuiu na linha de comando'],
            ['Log de erro', 'um relatório de exceção costuma despejar o ambiente']
          ]
        }
      },
      {
        box: 'key', label: 'Pior ainda: a linha de comando', body: [
          { p: 'Se o ambiente é ruim, o argumento é pior: <code>mysql -p senha123</code> aparece no <code>ps aux</code> para <strong>qualquer usuário da máquina</strong>, enquanto o processo estiver vivo. Nunca passe segredo como argumento.' }
        ]
      },
      { p: 'O que fazer, em ordem crescente de segurança:' },
      {
        ul: [
          '<strong>Arquivo com permissão restrita</strong>: um <code>.env</code> em modo <code>600</code>, carregado com <code>source</code>. Simples e resolve o caso comum.',
          '<strong><code>EnvironmentFile=</code> na unit do systemd</strong>: o serviço recebe as variáveis e o arquivo fica fora do repositório de código.',
          '<strong>Cofre de segredos</strong>: o segredo tem validade curta e cada acesso fica registrado.'
        ]
      },
      { p: 'E dois hábitos que valem por si:' },
      {
        ul: [
          '<code>HISTCONTROL=ignorespace</code> faz o Bash não gravar no histórico as linhas que começam com espaço — útil para um comando pontual com segredo.',
          '<code>unset SENHA</code> depois de usar, e <code>export -n VAR</code> para tirar a marca de exportada sem apagar o valor: a variável continua no seu shell, mas para de ser herdada pelos filhos.'
        ]
      },
      { code: ['$ SEGREDO=abc123', '$ export SEGREDO', '$ bash -c \'echo "o filho vê: [$SEGREDO]"\'', '$ export -n SEGREDO', '$ bash -c \'echo "agora o filho vê: [$SEGREDO]"\'', '$ unset SEGREDO'] },

      { h2: 'Resumo' },
      {
        ul: [
          'Locale muda ordem alfabética, separador decimal e formato de data — e por isso muda o resultado de scripts.',
          'Em script cuja saída será processada, fixe <code>export LC_ALL=C</code>.',
          'Servidor em UTC; converta só na exibição. Horário de verão quebra agendamento.',
          'Ambiente vaza por <code>/proc/PID/environ</code>, <code>ps</code>, filhos e <code>set -x</code>. Argumento de linha de comando vaza para todo mundo.',
          'Arquivo <code>600</code> + <code>source</code>, ou <code>EnvironmentFile=</code>; e <code>export -n</code> / <code>unset</code> depois de usar.'
        ]
      }
    ],
    tasks: [
      {
        id: 't14-5-a', kind: 'guiado', title: 'Locale, fuso e herança',
        body: [
          { p: 'Três experimentos curtos:' },
          {
            code: [
              '$ locale | head -4',
              '$ date',
              '$ TZ=UTC date',
              '$ SEGREDO=abc123',
              '$ bash -c \'echo "filho sem export: [$SEGREDO]"\'',
              '$ export SEGREDO',
              '$ bash -c \'echo "filho com export: [$SEGREDO]"\'',
              '$ export -n SEGREDO',
              '$ bash -c \'echo "depois do export -n: [$SEGREDO]"\'',
              '$ unset SEGREDO'
            ]
          },
          { p: 'A sequência do <code>SEGREDO</code> mostra exatamente o que "exportar" significa: sem export a variável existe só no seu shell; com export, todo processo filho a recebe; o <code>export -n</code> desfaz isso sem apagar o valor.' }
        ],
        hints: ['O <code>TZ=UTC date</code> define a variável só para aquele comando — o fuso da máquina não muda.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /\blocale\b/), 'Veja a configuração de idioma com <code>locale</code>.'],
          [() => H.usedCommand(ctx, /TZ=\S+\s+date/), 'Rode <code>TZ=UTC date</code> para ver a data em outro fuso.'],
          [() => H.usedCommand(ctx, /export\s+SEGREDO/), 'Exporte a variável para o filho enxergá-la.'],
          [() => H.usedCommand(ctx, /export\s+-n/), 'Desfaça com <code>export -n SEGREDO</code>.']
        ])
      },
      {
        id: 't14-5-q', kind: 'quiz', title: 'Conceito: o script que só falha no servidor',
        body: [
          { p: 'Um script compara duas listas ordenadas para achar o que mudou:' },
          { code: ['sort atual.txt > /tmp/a', 'sort anterior.txt > /tmp/b', 'diff /tmp/a /tmp/b'], run: false, lang: 'bash' },
          { p: 'Na máquina do desenvolvedor não acusa diferença nenhuma. No servidor, acusa dezenas — com o mesmo conteúdo nos arquivos. O que está acontecendo?' }
        ],
        options: [
          { text: 'As duas máquinas têm <code>LC_COLLATE</code> diferentes, então o <code>sort</code> produz ordens diferentes. A correção é fixar <code>export LC_ALL=C</code> no início do script.', correct: true },
          { text: 'O <code>diff</code> precisa da opção <code>-u</code> para comparar corretamente.', why: 'O <code>-u</code> só muda o formato de exibição das diferenças, não o resultado da comparação.' },
          { text: 'Os arquivos têm finais de linha diferentes (CRLF × LF).', why: 'É uma causa possível de diferenças fantasma em geral — mas ela apareceria nas duas máquinas igualmente, já que o conteúdo é o mesmo.' },
          { text: 'O <code>/tmp</code> do servidor está cheio e o <code>sort</code> truncou a saída.', why: 'Um <code>sort</code> que falha por falta de espaço reporta erro; ele não devolve silenciosamente uma ordenação parcial.' }
        ],
        explain: 'Em locale <code>pt_BR.UTF-8</code> o <code>sort</code> ignora maiúsculas e acentos ao comparar; em <code>C</code> ele usa os códigos dos caracteres. As duas ordens são "corretas" — só não são a mesma. Sempre que a saída de um comando for consumida por outro programa, fixe <code>LC_ALL=C</code>: além de determinístico, é mais rápido, porque dispensa a tabela de regras do idioma.'
      },
      {
        id: 't14-5-b', kind: 'desafio', title: 'Configuração e segredo separados',
        body: [
          { p: 'Prepare a configuração de um serviço seguindo as boas práticas da aula.' },
          {
            ul: [
              'crie <code>~/app/config.env</code> com <strong>modo 600</strong>, contendo duas linhas: <code>APP_USUARIO=servico</code> e <code>APP_SENHA=trocar-em-producao</code>;',
              'crie <code>~/scripts/carrega.sh</code>, executável, que faça <code>source</code> desse arquivo, fixe o locale com <code>export LC_ALL=C</code>, imprima <code>usuario: servico</code> e imprima <code>senha: (oculta)</code> — <strong>sem</strong> jamais imprimir o valor real;',
              'ao final, o script remove a senha do ambiente com <code>unset</code> e imprime <code>senha no ambiente apos unset: []</code>.'
            ]
          },
          { p: 'A saída completa esperada, em três linhas:' },
          { code: ['usuario: servico', 'senha: (oculta)', 'senha no ambiente apos unset: []'], run: false, lang: 'text' }
        ],
        hints: [
          'O <code>chmod 600</code> vai no arquivo de configuração — é ele que guarda o segredo. Para carregar: <code>source ~/app/config.env</code>.',
          'Depois do <code>unset APP_SENHA</code>, imprima <code>"senha no ambiente apos unset: [${APP_SENHA:-}]"</code> — o <code>:-</code> evita que o <code>set -u</code> aborte ao ver a variável já removida.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/app ~/scripts\ncat &gt; ~/app/config.env &lt;&lt; \'EOF\'\nAPP_USUARIO=servico\nAPP_SENHA=trocar-em-producao\nEOF\nchmod 600 ~/app/config.env\nls -l ~/app/config.env\n\ncat &gt; ~/scripts/carrega.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\nexport LC_ALL=C\n\nsource "$HOME/app/config.env"\n\necho "usuario: $APP_USUARIO"\necho "senha: (oculta)"\n\nunset APP_SENHA\necho "senha no ambiente apos unset: [${APP_SENHA:-}]"\nEOF\nchmod +x ~/scripts/carrega.sh\n~/scripts/carrega.sh</pre></div><p style="margin-top:8px">O segredo fica num arquivo que só o dono lê, entra no shell por <code>source</code>, nunca é impresso e sai do ambiente assim que deixa de ser necessário. É o mínimo defensável — e já elimina os vazamentos mais comuns.</p>',
        check: async (ctx) => {
          const conf = ler(ctx, '/home/aluno/app/config.env');
          const sc = ler(ctx, '/home/aluno/scripts/carrega.sh');
          const modo = H.mode(ctx, '/home/aluno/app/config.env');
          if (!sc) return { ok: false, msg: 'Não encontrei <code>~/scripts/carrega.sh</code>.' };
          const saida = await rodar(ctx, '~/scripts/carrega.sh 2>&1');
          const l = saida.split('\n').map(x => x.trim()).filter(Boolean);
          return H.checkAll([
            [!!conf, 'Falta o <code>~/app/config.env</code>.'],
            [() => /^APP_USUARIO=servico\s*$/m.test(conf), 'O <code>config.env</code> deve ter a linha <code>APP_USUARIO=servico</code>.'],
            [() => /^APP_SENHA=trocar-em-producao\s*$/m.test(conf), 'O <code>config.env</code> deve ter a linha <code>APP_SENHA=trocar-em-producao</code>.'],
            [() => modo === 0o600, () => `O arquivo de segredo precisa estar em modo <code>600</code>; está ${modo === null ? 'inexistente' : modo.toString(8)}. Qualquer coisa mais aberta e outro usuário da máquina lê a senha.`],
            [() => (H.mode(ctx, '/home/aluno/scripts/carrega.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [() => /source\s|^\s*\.\s+/m.test(sc), 'O script deve carregar o arquivo com <code>source</code>.'],
            [() => /export\s+LC_ALL=C/.test(sc), 'Falta <code>export LC_ALL=C</code> — é o que torna a saída determinística entre máquinas.'],
            [() => /unset\s+APP_SENHA/.test(sc), 'Falta o <code>unset APP_SENHA</code> ao final.'],
            [() => l.length === 3, () => `A saída deve ter 3 linhas; teve ${l.length}. Saída: "${saida.slice(0, 120)}"`],
            [() => /^usuario:\s*servico$/.test(l[0] || ''), () => `A primeira linha deve ser <code>usuario: servico</code>. Obtive: "${l[0] || ''}".`],
            [() => /^senha:\s*\(oculta\)$/.test(l[1] || ''), () => `A segunda linha deve ser <code>senha: (oculta)</code>. Obtive: "${l[1] || ''}".`],
            [() => /^senha no ambiente apos unset:\s*\[\]$/.test(l[2] || ''), () => `A terceira linha deve ser <code>senha no ambiente apos unset: []</code>. Obtive: "${l[2] || ''}".`],
            [() => !saida.includes('trocar-em-producao'), 'O valor da senha apareceu na saída. O script não pode imprimir o segredo em momento nenhum.']
          ]);
        }
      }
    ]
  });
})();
