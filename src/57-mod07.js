/* =========================================================================
   MÓDULO 7 — Processos
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 7.1 ============================== */
  LX.lesson('m07', {
    id: 'l7-1', n: '7.1', title: 'O que é um processo',
    goal: 'Entender PID, PPID, a árvore de processos e os estados — a base para tudo que vem depois neste módulo.',
    body: [
      { lede: 'Um programa é um arquivo parado no disco. Um processo é esse programa vivo: com memória própria, um número, um pai e um estado.' },
      { p: 'Cada processo carrega:' },
      {
        ul: [
          '<strong>PID</strong> — o número que o identifica enquanto vive;',
          '<strong>PPID</strong> — o PID de quem o criou;',
          '<strong>UID/GID</strong> — a identidade com que ele age (é isso que decide as permissões da aula 5.1);',
          '<strong>cwd</strong> — o diretório atual <em>dele</em>, não o seu;',
          '<strong>descritores abertos</strong> — os canais da aula 3.1;',
          '<strong>estado</strong> — o que ele está fazendo neste instante.'
        ]
      },
      { code: ['$ echo "meu shell é o PID $$"', '$ ps -p $$ -o pid,ppid,user,comm', '$ ps -p $PPID -o pid,comm'] },

      { h2: 'Todo processo nasce de outro' },
      { p: 'Não existe geração espontânea: um processo é criado por outro, através de <code>fork()</code> (duplica o processo atual) seguido de <code>exec()</code> (substitui o programa carregado). O resultado é uma árvore com raiz única.' },
      {
        ascii: `systemd (PID 1)
   ├── sshd (640)
   │     └── sshd: aluno (812)
   │            └── bash (830)          ← seu shell
   │                   ├── ps (901)     ← comandos que você roda
   │                   └── sleep (902)
   ├── cron (511)
   └── systemd-journald (254)`
      },
      { code: ['$ pstree -p | head -12', '$ ps -eo pid,ppid,comm --sort=pid | head -10'] },
      {
        box: 'key', body: [
          { p: 'O PID 1 é especial: é o primeiro processo que o kernel inicia e o único que não pode ser morto. Hoje ele é o <code>systemd</code> na maioria das distribuições. Quando um processo morre deixando filhos, esses filhos são <strong>adotados pelo PID 1</strong> — é por isso que serviços "órfãos" aparecem pendurados nele.' }
        ]
      },
      { p: 'Uma consequência prática do <code>fork</code>: quando você roda um comando, ele acontece em um processo <strong>filho</strong>. Por isso um <code>cd</code> dentro de um script não muda o diretório do seu shell — o script rodou em outro processo, e o que ele mudou morreu junto com ele.' },
      {
        code: [
          '$ cd ~ && printf \'#!/bin/bash\\ncd /tmp\\necho "dentro do script: $PWD"\\n\' > testecd.sh',
          '$ chmod +x testecd.sh && ./testecd.sh',
          '$ pwd'
        ]
      },
      { p: 'Você continua onde estava. Para que um script altere o <em>seu</em> shell, ele precisa ser lido pelo próprio shell com <code>source script.sh</code> (ou <code>. script.sh</code>) — assunto do módulo 14.' },

      { h2: 'Os estados' },
      {
        table: {
          head: ['Letra', 'Estado', 'O que significa na prática'],
          rows: [
            ['<code>R</code>', 'running/runnable', 'usando CPU ou pronto para usar'],
            ['<code>S</code>', 'sleeping', 'esperando algo (rede, teclado, tempo) — <strong>o normal</strong>'],
            ['<code>D</code>', 'uninterruptible sleep', 'travado em E/S — <strong>não morre nem com kill -9</strong>'],
            ['<code>T</code>', 'stopped', 'suspenso (Ctrl+Z ou SIGSTOP)'],
            ['<code>Z</code>', 'zombie', 'já terminou; só resta a entrada esperando o pai ler o código de saída'],
            ['<code>I</code>', 'idle', 'thread do kernel ociosa']
          ]
        }
      },
      { p: 'Os sufixos também dizem coisas: <code>s</code> é líder de sessão, <code>+</code> está em primeiro plano, <code>&lt;</code> tem prioridade alta, <code>N</code> tem prioridade baixa, <code>l</code> tem múltiplas threads.' },
      { code: ['$ ps -eo pid,stat,comm | head -8', '$ ps aux | awk \'{print $8}\' | sort | uniq -c | sort -rn'] },
      {
        box: 'note', label: 'Zumbi não consome recursos', body: [
          { p: 'Um processo <code>Z</code> já liberou memória e CPU: sobrou apenas uma linha na tabela do kernel. Ele some quando o pai chama <code>wait()</code>. Matar o zumbi não adianta — ele já está morto. O que se faz é reiniciar (ou corrigir) o <strong>pai</strong>. Zumbis só viram problema quando são milhares, esgotando a tabela de PIDs.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't7-1-a', kind: 'guiado', title: 'Encontre-se na árvore',
        body: [
          { p: 'Descubra seu shell, quem é o pai dele e como a árvore chega até o PID 1.' },
          {
            code: [
              '$ echo $$',
              '$ ps -p $$ -o pid,ppid,user,stat,comm',
              '$ pstree -p | head -12',
              '$ ps -eo pid,ppid,stat,comm --sort=pid | head -8'
            ]
          },
          { p: 'Agora o experimento do <code>cd</code> em subprocesso:' },
          {
            code: [
              '$ cd ~ && printf \'#!/bin/bash\\ncd /tmp\\necho "dentro: $PWD"\\n\' > testecd.sh',
              '$ chmod +x testecd.sh && ./testecd.sh && pwd'
            ]
          }
        ],
        hints: ['<code>$$</code> é o PID do shell atual; <code>$PPID</code> é o do pai dele.'],
        solution: '<div class="code"><pre>echo $$\nps -p $$ -o pid,ppid,user,stat,comm\npstree -p | head -12\ncd ~ &amp;&amp; printf \'#!/bin/bash\\ncd /tmp\\necho "dentro: $PWD"\\n\' &gt; testecd.sh\nchmod +x testecd.sh\n./testecd.sh\npwd</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /pstree/), 'Veja a árvore de processos com <code>pstree -p</code>.'],
          [() => H.usedCommand(ctx, /ps\s+-p\s+\$\$|echo\s+\$\$/), 'Descubra o PID do seu shell com <code>echo $$</code> ou <code>ps -p $$</code>.'],
          [H.exists(ctx, '/home/aluno/testecd.sh'), 'Crie o script <code>~/testecd.sh</code> do experimento.'],
          [(H.mode(ctx, '/home/aluno/testecd.sh') & 0o100) !== 0, 'Torne o script executável com <code>chmod +x</code> e rode-o.']
        ])
      },
      {
        id: 't7-1-q', kind: 'quiz', title: 'Conceito: o processo que não morre',
        body: [
          { p: 'Um processo aparece no <code>ps</code> com estado <code>D</code>. Você tenta <code>kill -9</code> nele três vezes e ele continua lá. O que está acontecendo?' }
        ],
        options: [
          { text: 'Ele está em espera ininterrompível de E/S: o sinal fica pendente até a operação terminar — normalmente um disco ou um ponto de montagem de rede com problema.', correct: true },
          { text: 'O processo tem proteção contra sinais configurada pelo desenvolvedor.', why: 'Nenhum programa pode ignorar o SIGKILL. O que ocorre é que ele nem chega a ser entregue enquanto o processo está em <code>D</code>.' },
          { text: 'Falta <code>sudo</code>: como root o <code>kill -9</code> funcionaria.', why: 'Vale conferir o dono, mas em estado <code>D</code> nem o root consegue — a diferença não é de privilégio.' },
          { text: 'É um processo zumbi e precisa ser removido com <code>kill -18</code>.', why: 'Zumbi é <code>Z</code>, não <code>D</code>, e não pode ser morto porque já morreu.' }
        ],
        explain: 'Estado <code>D</code> quase sempre aponta para hardware ou rede: disco falhando, NFS fora do ar, volume travado. O caminho é investigar a causa (<code>dmesg</code>, <code>iostat</code>, o ponto de montagem) e, muitas vezes, reiniciar a máquina. É um dos poucos casos em que "reiniciar" é a resposta técnica correta.'
      },
      {
        id: 't7-1-b', kind: 'desafio', title: 'Prove com números que o script é outro processo',
        body: [
          { p: 'Não basta afirmar que um script roda em um processo filho — comprove com dois números diferentes.' },
          {
            ul: [
              'grave em <code>~/pid-shell.txt</code> o PID do seu shell atual, e só ele;',
              'crie o script executável <code>~/quempid.sh</code> que, ao rodar, grava o <strong>próprio</strong> PID em <code>~/pid-script.txt</code>;',
              'rode o script.'
            ]
          },
          { p: 'Ao final, os dois arquivos precisam trazer números diferentes — a prova de que o script vive em um processo próprio, não no seu.' }
        ],
        hints: [
          'A variável que devolve o PID do processo atual é <code>$$</code> — vale tanto no seu shell quanto dentro de um script.',
          'Grave o seu PID antes de criar o script: <code>echo $$ &gt; ~/pid-shell.txt</code>. Dentro do script, a mesma ideia (<code>echo $$ &gt; ~/pid-script.txt</code>) grava outro número, porque ali o <code>$$</code> é o PID do script.'
        ],
        solution: '<div class="code"><pre>echo $$ &gt; ~/pid-shell.txt\nprintf \'#!/bin/bash\\necho $$ &gt; ~/pid-script.txt\\n\' &gt; ~/quempid.sh\nchmod +x ~/quempid.sh\n./quempid.sh\ncat ~/pid-shell.txt\ncat ~/pid-script.txt</pre></div><p style="margin-top:8px">O mesmo <code>$$</code> devolve um número diferente dentro do script porque o <code>fork()</code>+<code>exec()</code> que o inicia cria um processo novo, com PID próprio — exatamente como o experimento do <code>cd</code> do guiado, agora medido em números.</p>',
        check: async (ctx) => {
          const pidShell = H.read(ctx, '/home/aluno/pid-shell.txt');
          const pidScript = H.read(ctx, '/home/aluno/pid-script.txt');
          const meuPid = String(ctx.sh.pid);
          const lShell = String(pidShell || '').trim();
          const lScript = String(pidScript || '').trim();
          return LX.H.checkAll([
            [pidShell !== null, 'Crie o arquivo <code>~/pid-shell.txt</code> com <code>echo $$ &gt; ~/pid-shell.txt</code>.'],
            [() => lShell === meuPid, () => `O <code>~/pid-shell.txt</code> deveria conter o PID do seu shell (<code>${meuPid}</code>); tem "${lShell}".`],
            [(H.mode(ctx, '/home/aluno/quempid.sh') & 0o100) !== 0, 'O script <code>~/quempid.sh</code> precisa existir e ser executável (<code>chmod +x</code>).'],
            [pidScript !== null, 'Rode o script (<code>./quempid.sh</code>) para gerar o <code>~/pid-script.txt</code>.'],
            [() => /^\d+$/.test(lScript), () => `O <code>~/pid-script.txt</code> deveria conter só um número; tem "${lScript}".`],
            [() => lScript !== meuPid, 'O PID do script não pode ser igual ao do seu shell — ele precisa ser gravado de <strong>dentro</strong> do script, rodado com <code>./quempid.sh</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 7.2 ============================== */
  LX.lesson('m07', {
    id: 'l7-2', n: '7.2', title: 'Ver processos: ps, pgrep e /proc',
    goal: 'Escolher a forma certa de listar processos e extrair exatamente as colunas que a investigação pede.',
    body: [
      { cmd: 'ps' },
      { p: 'O <code>ps</code> tem duas sintaxes históricas que convivem, e isso confunde: a <strong>BSD</strong> (sem traço) e a <strong>UNIX</strong> (com traço). As duas funcionam.' },
      {
        table: {
          head: ['Comando', 'Estilo', 'Mostra'],
          rows: [
            ['<code>ps</code>', '—', 'só os seus processos no terminal atual'],
            ['<code>ps aux</code>', 'BSD', '<strong>tudo</strong>, com CPU, memória e comando completo'],
            ['<code>ps -ef</code>', 'UNIX', 'tudo, com PPID em destaque'],
            ['<code>ps -eo ...</code>', 'UNIX', 'você escolhe as colunas — o mais útil'],
            ['<code>ps -p PID</code>', 'UNIX', 'um processo específico'],
            ['<code>ps -u ana</code>', 'UNIX', 'processos de um usuário']
          ]
        }
      },
      { code: ['$ ps aux | head -5', '$ ps -ef | head -5'] },
      { p: 'As colunas de <code>ps aux</code>, na ordem: usuário, PID, %CPU, %MEM, VSZ, RSS, TTY, STAT, START, TIME, COMMAND.' },
      {
        box: 'key', label: 'VSZ × RSS', body: [
          { p: '<strong>VSZ</strong> é a memória <em>virtual</em> reservada — inclui bibliotecas compartilhadas e áreas nunca tocadas. Costuma ser enorme e enganosa.' },
          { p: '<strong>RSS</strong> é a memória <em>residente</em>: o que está de fato na RAM. É o número que interessa em 95% das investigações — e mesmo ele conta bibliotecas compartilhadas mais de uma vez.' }
        ]
      },

      { h2: 'Escolher colunas: o modo profissional' },
      { p: 'O <code>-o</code> resolve quase tudo, e o <code>--sort</code> ordena:' },
      {
        code: [
          '$ ps -eo pid,ppid,user,stat,pcpu,pmem,rss,comm --sort=-pmem | head -6',
          '$ ps -eo pid,comm,etime --sort=start_time | head -6',
          '$ ps -eo user,comm --no-headers | sort | uniq -c | sort -rn | head -5'
        ]
      },
      { p: 'Colunas úteis: <code>pid</code>, <code>ppid</code>, <code>user</code>, <code>stat</code>, <code>pcpu</code>, <code>pmem</code>, <code>rss</code>, <code>vsz</code>, <code>etime</code> (tempo de vida), <code>ni</code> (nice), <code>comm</code> (nome curto) e <code>args</code> (linha completa).' },
      {
        box: 'tip', body: [
          { p: 'Um <code>=</code> depois do nome da coluna remove o cabeçalho — perfeito para usar dentro de scripts:' },
          { code: ['$ ps -p 1 -o comm=', '$ ps -eo pid= --sort=-pcpu | head -1'] }
        ]
      },

      { h2: 'Procurar por nome: pgrep e pidof' },
      { cmd: 'pgrep' },
      {
        code: [
          '$ pgrep sshd',
          '$ pgrep -a sshd',
          '$ pgrep -u root -a cron',
          '$ pidof sshd',
          '$ pgrep -c ssh'
        ]
      },
      {
        table: {
          head: ['Opção', 'Efeito'],
          rows: [
            ['<code>-a</code>', 'mostra a linha de comando junto'],
            ['<code>-f</code>', 'casa contra a <strong>linha inteira</strong>, não só o nome'],
            ['<code>-u USUÁRIO</code>', 'filtra por dono'],
            ['<code>-c</code>', 'conta em vez de listar'],
            ['<code>-x</code>', 'exige nome exato']
          ]
        }
      },
      { p: 'O <code>-f</code> é o que faz diferença no mundo real: um processo Java ou Python aparece como <code>java</code> ou <code>python3</code> no <code>comm</code>; o que distingue um do outro é o argumento.' },
      {
        box: 'old', body: [
          { p: 'Você vai ver muito <code>ps aux | grep nginx</code>. Funciona, mas traz o próprio <code>grep</code> na lista — daí a gambiarra <code>grep [n]ginx</code>. Hoje o certo é <code>pgrep -a nginx</code>: mais curto, sem falso positivo e com saída pronta para script. <strong>Aprenda essa versão.</strong>' }
        ]
      },

      { h2: '/proc: a fonte de tudo' },
      { p: 'O <code>ps</code> não tem poderes especiais: ele lê <code>/proc</code>. Cada processo tem um diretório com o próprio PID:' },
      {
        code: [
          '$ ls /proc/1',
          '$ cat /proc/1/status | head -8',
          '$ cat /proc/1/cmdline',
          '$ readlink /proc/1/exe',
          '$ readlink /proc/1/cwd'
        ]
      },
      {
        table: {
          head: ['Arquivo', 'Responde'],
          rows: [
            ['<code>/proc/PID/status</code>', 'estado, PPID, UID, memória, threads — legível por humanos'],
            ['<code>/proc/PID/cmdline</code>', 'a linha de comando exata que iniciou o processo'],
            ['<code>/proc/PID/exe</code>', 'link para o binário em execução (mesmo se o arquivo foi apagado!)'],
            ['<code>/proc/PID/cwd</code>', 'diretório atual do processo'],
            ['<code>/proc/PID/fd/</code>', 'todos os arquivos e sockets abertos'],
            ['<code>/proc/PID/limits</code>', 'limites de recursos em vigor']
          ]
        }
      },
      {
        box: 'tip', label: 'O truque do binário apagado', body: [
          { p: 'Se um processo está rodando e alguém apagou o executável, <code>/proc/PID/exe</code> ainda aponta para ele — e é possível recuperar o binário com <code>cp /proc/PID/exe /tmp/recuperado</code>. É também assim que se identifica um processo suspeito cujo arquivo "não existe mais".' }
        ]
      }
    ],
    tasks: [
      {
        id: 't7-2-a', kind: 'guiado', title: 'Três formas de olhar',
        body: [
          { p: 'Compare BSD, UNIX e colunas escolhidas — e depois vá direto ao <code>/proc</code>.' },
          {
            code: [
              '$ ps aux | head -5',
              '$ ps -ef | head -5',
              '$ ps -eo pid,ppid,user,stat,pcpu,pmem,rss,comm --sort=-pmem | head -6',
              '$ pgrep -a sshd',
              '$ ls /proc/1 && cat /proc/1/status | head -6',
              '$ readlink /proc/1/exe'
            ]
          }
        ],
        hints: ['<code>--sort=-pmem</code> ordena por memória decrescente (o traço inverte a ordem).'],
        solution: '<div class="code"><pre>ps aux | head -5\nps -ef | head -5\nps -eo pid,ppid,user,stat,pcpu,pmem,rss,comm --sort=-pmem | head -6\npgrep -a sshd\nls /proc/1\ncat /proc/1/status | head -6\nreadlink /proc/1/exe</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ps\s+aux/), 'Use a sintaxe BSD: <code>ps aux</code>.'],
          [() => H.usedCommand(ctx, /ps\s+-e[fo]/), 'Use também a sintaxe UNIX: <code>ps -ef</code> ou <code>ps -eo ...</code>.'],
          [() => H.usedCommand(ctx, /--sort/), 'Ordene a saída com <code>--sort=-pmem</code>.'],
          [() => H.usedCommand(ctx, /pgrep/), 'Procure um processo por nome com <code>pgrep -a</code>.'],
          [() => H.usedCommand(ctx, /\/proc\/1/), 'Leia direto da fonte: <code>/proc/1/status</code>.']
        ])
      },
      {
        id: 't7-2-f', kind: 'fill', title: 'Complete o ps',
        body: [
          { p: 'Você quer a lista de <strong>todos</strong> os processos com apenas PID, uso de memória e nome, ordenada do que <strong>mais consome memória</strong> para o que menos consome.' },
          { p: 'Complete a opção que define as colunas e a ordenação:' }
        ],
        template: 'ps -eo pid,pmem,comm ___ | head -5', sample: '--sort=-pmem',
        answers: ['--sort=-pmem'],
        hints: ['A opção começa com <code>--sort=</code>.', 'Um traço antes do nome da coluna inverte a ordem: <code>--sort=-pmem</code>.'],
        solution: 'A resposta é <code>--sort=-pmem</code>. Sem o traço (<code>--sort=pmem</code>) a lista viria do menor para o maior. Você também pode ordenar por <code>-pcpu</code>, <code>-rss</code> ou <code>start_time</code>.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim();
          return LX.H.checkAll([
            [/--sort/.test(v), 'Use a opção <code>--sort=</code>.'],
            [/-pmem|-rss/.test(v), 'Ordene por memória em ordem decrescente: <code>--sort=-pmem</code> (o traço inverte).']
          ]);
        }
      },
      {
        id: 't7-2-b', kind: 'desafio', title: 'Relatório dos maiores consumidores',
        body: [
          { p: 'Gere <code>~/top-mem.txt</code> com os <strong>cinco processos que mais consomem memória</strong>, uma linha por processo, contendo exatamente três campos separados por espaço:' },
          { code: ['PID %MEM COMANDO'], run: false, mixed: false, lang: 'text' },
          { p: 'Sem cabeçalho, sem linhas em branco, do maior consumo para o menor.' }
        ],
        hints: [
          'O <code>ps -eo</code> escolhe as colunas e o <code>--sort</code> ordena.',
          'Para tirar o cabeçalho, use <code>--no-headers</code> ou um <code>=</code> depois de cada coluna.',
          '<code>ps -eo pid=,pmem=,comm= --sort=-pmem | head -5 &gt; ~/top-mem.txt</code>'
        ],
        solution: '<div class="code"><pre>ps -eo pid=,pmem=,comm= --sort=-pmem | head -5 &gt; ~/top-mem.txt\ncat ~/top-mem.txt</pre></div><p style="margin-top:8px">Essa é a primeira linha de qualquer investigação de "o servidor está lento": quem está comendo a memória, e faz quanto tempo.</p>',
        forja: ["printf '1 9.9 systemd\\n2 8.8 sshd\\n3 7.7 cron\\n4 6.6 bash\\n5 5.5 nginx\\n' > ~/top-mem.txt"],
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/top-mem.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/top-mem.txt</code> ainda não existe.' };
          const m = ctx.machine || ctx.sh.m;
          const linhas = c.split('\n').filter(l => l.trim());
          const campos = linhas.map(l => l.trim().split(/\s+/));
          const mems = campos.map(f => parseFloat(f[1]));
          /* o relatório precisa descrever ESTA máquina, não cinco linhas plausíveis */
          const reais = Array.from(m.processes.values()).sort((a, b) => (b.mem || 0) - (a.mem || 0));
          const topReais = reais.slice(0, 5).map(p => p.pid);
          return LX.H.checkAll([
            [linhas.length === 5, () => `O relatório deve ter exatamente 5 linhas; tem ${linhas.length}.`],
            [!/PID|%MEM|COMMAND/i.test(c), 'O cabeçalho não deve aparecer — use <code>--no-headers</code> ou <code>pid=</code>.'],
            [linhas.every(l => /^\s*\d+\s+[\d.]+\s+\S+/.test(l)), 'Cada linha deve ter PID, %MEM e nome do comando, nessa ordem.'],
            [mems.every(x => !isNaN(x)), 'A segunda coluna deve ser o percentual de memória (<code>pmem</code>).'],
            [() => campos.every(f => !!m.procByPid(+f[0])), 'Algum PID do relatório não existe nesta máquina. Os números precisam sair do <code>ps</code>, não da sua cabeça.'],
            [() => campos.every(f => { const p = m.procByPid(+f[0]); return p && String(p.comm).slice(0, 15) === f[2].slice(0, 15); }), 'Algum PID não bate com o nome do processo ao lado. Confira com <code>ps -p PID -o comm=</code>.'],
            [() => campos.every(f => { const p = m.procByPid(+f[0]); return p && Math.abs((p.mem || 0) - parseFloat(f[1])) < 0.15; }), 'O percentual de memória de alguma linha não bate com o valor real do processo.'],
            [() => campos.map(f => +f[0]).every(pid => topReais.includes(pid)), 'Alguma linha não está entre os cinco maiores consumidores de memória da máquina.'],
            [mems.every((x, i) => i === 0 || mems[i - 1] >= x), 'As linhas devem estar do maior consumo de memória para o menor.']
          ]);
        }
      }
    ]
  });

  /* ============================== 7.3 ============================== */
  LX.lesson('m07', {
    id: 'l7-3', n: '7.3', title: 'Monitorar: top, load average e memória',
    goal: 'Ler um servidor em tempo real e interpretar corretamente os três números que todo mundo cita e quase ninguém explica.',
    body: [
      { cmd: 'top' },
      { p: 'O <code>ps</code> é uma foto; o <code>top</code> é o vídeo. Ele atualiza a cada poucos segundos e responde "o que está acontecendo <em>agora</em>".' },
      { code: ['$ top -b -n1 | head -12'] },
      { p: 'Dentro do <code>top</code> interativo (que você pode abrir aqui com <code>top</code> e sair com <code>q</code>):' },
      {
        cheat: [
          ['<code>P</code>', 'ordena por CPU'],
          ['<code>M</code>', 'ordena por memória'],
          ['<code>T</code>', 'ordena por tempo acumulado'],
          ['<code>k</code>', 'mata um processo (pergunta o PID)'],
          ['<code>u</code>', 'filtra por usuário'],
          ['<code>1</code>', 'mostra cada núcleo separadamente'],
          ['<code>c</code>', 'alterna nome curto / linha de comando completa'],
          ['<code>q</code>', 'sai']
        ]
      },
      { p: 'A opção <code>-b -n1</code> ("batch, uma iteração") é o que torna o <code>top</code> usável em scripts e redirecionamentos.' },

      { h2: 'Load average: os três números' },
      { code: ['$ uptime', '$ cat /proc/loadavg'] },
      { p: 'São as médias de 1, 5 e 15 minutos de processos <strong>rodando ou esperando</strong>. A leitura correta depende do número de núcleos:' },
      {
        ascii: `load 4.00 em uma máquina de 4 núcleos  →  100% ocupada, sem fila
load 4.00 em uma máquina de 1 núcleo   →  4x sobrecarregada
load 0.50 em uma máquina de 4 núcleos  →  ~12% ocupada

  regra:  load / núcleos ≈ 1.0  →  no limite saudável
          load / núcleos  > 1.0  →  há fila de espera`
      },
      { code: ['$ nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo', '$ uptime'] },
      {
        box: 'key', body: [
          { p: 'No Linux, o load average conta também processos em espera de <strong>disco</strong> (estado <code>D</code>) — diferente de outros Unix. Por isso um servidor com CPU ociosa pode ter load 20: não é a CPU, é o disco. A comparação entre <code>%Cpu(s) id</code> alto e load alto é o sinal clássico de gargalo de E/S.' }
        ]
      },
      { p: 'A tendência importa mais que o valor: comparar os três números diz se a situação está piorando (1min &gt; 15min) ou já passou (1min &lt; 15min).' },

      { h2: 'Memória: por que "quase toda usada" é normal' },
      { cmd: 'free' },
      { code: ['$ free -h', '$ free -m | head -2', '$ head -5 /proc/meminfo'] },
      {
        table: {
          head: ['Coluna', 'O que é'],
          rows: [
            ['<code>total</code>', 'RAM física'],
            ['<code>used</code>', 'em uso por processos'],
            ['<code>free</code>', 'completamente ociosa — <strong>número enganoso</strong>'],
            ['<code>buff/cache</code>', 'cache de disco: o kernel usando RAM livre para acelerar leituras'],
            ['<code>available</code>', '<strong>o número que importa</strong>: o quanto um novo programa poderia usar']
          ]
        }
      },
      {
        box: 'key', label: 'RAM livre é RAM desperdiçada', body: [
          { p: 'O Linux usa toda memória ociosa como cache de disco e a devolve imediatamente quando um processo precisa. Ver <code>free</code> baixo e <code>buff/cache</code> alto é <strong>saúde</strong>, não problema. O alarme é <code>available</code> baixo — aí sim falta memória de verdade.' }
        ]
      },
      { p: 'E o swap: um pouco de swap em uso é normal (páginas frias). O problema é <strong>swap ativo</strong> — entrando e saindo o tempo todo, o que derruba o desempenho. Isso se vê em <code>vmstat 1</code> nas colunas <code>si</code>/<code>so</code>.' },

      { h2: 'watch: transformar qualquer comando em monitor' },
      { cmd: 'watch' },
      { code: ['$ watch -n 2 "ps -eo pid,pcpu,comm --sort=-pcpu | head -5"'] },
      { p: 'O <code>watch</code> repete o comando a cada N segundos e limpa a tela entre as execuções. Com <code>-d</code>, ele ainda destaca o que mudou. É a forma mais simples de acompanhar um número enquanto você mexe em outra coisa.' }
    ],
    tasks: [
      {
        id: 't7-3-a', kind: 'guiado', title: 'Leia o servidor',
        body: [
          { p: 'Colete os três indicadores e interprete cada um.' },
          {
            code: [
              '$ uptime',
              '$ cat /proc/loadavg',
              '$ grep -c ^processor /proc/cpuinfo',
              '$ free -h',
              '$ top -b -n1 | head -10'
            ]
          },
          { p: 'Pergunte-se: o load está acima do número de núcleos? O <code>available</code> está confortável?' }
        ],
        hints: ['O load só faz sentido dividido pelo número de núcleos — daí o <code>grep -c ^processor</code>.'],
        solution: '<div class="code"><pre>uptime\ncat /proc/loadavg\ngrep -c ^processor /proc/cpuinfo\nfree -h\ntop -b -n1 | head -10</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /uptime|loadavg/), 'Veja o load average com <code>uptime</code> ou <code>cat /proc/loadavg</code>.'],
          [() => H.usedCommand(ctx, /processor|nproc/), 'Descubra quantos núcleos a máquina tem.'],
          [() => H.usedCommand(ctx, /free/), 'Veja a memória com <code>free -h</code>.'],
          [() => H.usedCommand(ctx, /top\s+-b/), 'Use o <code>top -b -n1</code> para uma leitura em modo batch.']
        ])
      },
      {
        id: 't7-3-q', kind: 'quiz', title: 'Preveja o diagnóstico',
        body: [
          { p: 'Um servidor de 4 núcleos apresenta:' },
          {
            code: [
              'load average: 12.40, 11.80, 9.30',
              '%Cpu(s):  2.1 us,  1.4 sy,  0.0 ni, 21.0 id, 75.3 wa,  0.0 hi,  0.2 si',
              'MiB Mem : 16000.0 total, 8200.0 free, 3100.0 used, 4700.0 buff/cache',
              '                                            9800.0 avail Mem'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Qual é o diagnóstico mais provável?' }
        ],
        options: [
          { text: 'Gargalo de disco: o <code>wa</code> (I/O wait) em 75% com CPU quase ociosa explica o load alto e crescente.', correct: true },
          { text: 'Falta de memória: o load subiu porque a RAM acabou.', why: 'Há 9,8 GB disponíveis — memória não é o problema.' },
          { text: 'CPU saturada: load 12 significa 12 processos usando os 4 núcleos.', why: 'Se fosse CPU, o <code>us</code>+<code>sy</code> estaria alto; estão em 3,5% somados, e 21% ocioso.' },
          { text: 'O servidor está normal: load alto é esperado em máquinas com muitos núcleos.', why: '12 dividido por 4 núcleos é 3× a capacidade, e a tendência é de piora (1min > 15min).' }
        ],
        explain: 'O <code>wa</code> alto é a assinatura de E/S: disco lento, RAID degradado, NFS travado ou um processo escrevendo demais. Os próximos passos seriam <code>iostat -x 1</code>, <code>iotop</code> e <code>dmesg</code> em busca de erros de disco. Lembre que no Linux processos em espera de disco (estado <code>D</code>) entram na conta do load.'
      },
      {
        id: 't7-3-b', kind: 'desafio', title: 'Snapshot de saúde',
        body: [
          { p: 'Monte um retrato do servidor em <code>~/retrato-servidor.txt</code>, com exatamente estas quatro linhas, nesta ordem e com estes rótulos:' },
          {
            code: [
              'load: 0.08 0.12 0.09',
              'nucleos: 2',
              'mem_disponivel_mb: 2960',
              'top_cpu: systemd'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Os valores serão os da sua máquina. A última linha é o <strong>nome</strong> do processo que mais consome CPU no momento.' }
        ],
        hints: [
          'O load está nos três primeiros campos de <code>/proc/loadavg</code>; os núcleos saem de <code>grep -c ^processor /proc/cpuinfo</code>.',
          'A memória disponível está na coluna 7 da linha <code>Mem:</code> do <code>free -m</code>.',
          'O processo campeão de CPU: <code>ps -eo comm= --sort=-pcpu | head -1</code>.'
        ],
        solution: '<div class="code"><pre>echo "load: $(cut -d\' \' -f1-3 /proc/loadavg)" &gt; ~/retrato-servidor.txt\necho "nucleos: $(grep -c ^processor /proc/cpuinfo)" &gt;&gt; ~/retrato-servidor.txt\necho "mem_disponivel_mb: $(free -m | awk \'/^Mem:/ {print $7}\')" &gt;&gt; ~/retrato-servidor.txt\necho "top_cpu: $(ps -eo comm= --sort=-pcpu | head -1)" &gt;&gt; ~/retrato-servidor.txt\ncat ~/retrato-servidor.txt</pre></div><p style="margin-top:8px">Quatro linhas, quatro fontes diferentes. Um script assim, rodando a cada minuto, é o embrião de qualquer sistema de monitoramento.</p>',
        forja: ["printf 'load: 1.00 2.00 3.00\\nnucleos: 8\\nmem_disponivel_mb: 1234\\ntop_cpu: systemd\\n' > ~/retrato-servidor.txt"],
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/retrato-servidor.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/retrato-servidor.txt</code> ainda não existe.' };
          const m = ctx.machine || ctx.sh.m;
          const l = c.split('\n').map(x => x.trim()).filter(x => x);
          const val = (i) => (l[i] || '').split(/:\s*/).slice(1).join(':').trim();
          /* os números têm de ser os DESTA máquina: o verificador vai buscá-los na fonte */
          const loadReal = m.loadavg.map(n => n.toFixed(2)).join(' ');
          const nucleos = (H.read(ctx, '/proc/cpuinfo') || '').split('\n').filter(x => /^processor/.test(x)).length;
          const memInfo = /MemAvailable:\s+(\d+)/.exec(H.read(ctx, '/proc/meminfo') || '');
          const memMb = memInfo ? Math.floor(+memInfo[1] / 1024) : null;
          const topCpu = Array.from(m.processes.values()).sort((a, b) => (b.cpu || 0) - (a.cpu || 0))[0];
          return LX.H.checkAll([
            [l.length === 4, () => `O arquivo deve ter exatamente 4 linhas; tem ${l.length}.`],
            [/^load:\s+[\d.]+\s+[\d.]+\s+[\d.]+$/.test(l[0] || ''), () => `A primeira linha deve ser <code>load:</code> seguido dos três valores. Obtive: "${l[0] || ''}".`],
            [() => val(0) === loadReal, () => `O load do arquivo (<code>${val(0)}</code>) não é o desta máquina (<code>${loadReal}</code>). Ele precisa sair de <code>/proc/loadavg</code>, não ser digitado.`],
            [/^nucleos:\s+\d+$/.test(l[1] || ''), () => `A segunda linha deve ser <code>nucleos:</code> seguido do número de núcleos. Obtive: "${l[1] || ''}".`],
            [() => +val(1) === nucleos, () => `Esta máquina tem ${nucleos} núcleos, e o arquivo diz ${val(1)}. Conte com <code>grep -c ^processor /proc/cpuinfo</code>.`],
            [/^mem_disponivel_mb:\s+\d+$/.test(l[2] || ''), () => `A terceira linha deve ser <code>mem_disponivel_mb:</code> seguido de um número. Obtive: "${l[2] || ''}".`],
            [() => memMb !== null && Math.abs(+val(2) - memMb) <= 2, () => `A memória disponível informada (${val(2)} MB) não bate com a real (~${memMb} MB).`],
            [/^top_cpu:\s+\S+$/.test(l[3] || ''), () => `A quarta linha deve ser <code>top_cpu:</code> seguido do nome do processo. Obtive: "${l[3] || ''}".`],
            [!/^top_cpu:\s+(COMMAND|COMM)$/i.test(l[3] || ''), 'A quarta linha capturou o cabeçalho em vez do processo — use <code>comm=</code> para suprimi-lo.'],
            [() => !!topCpu && val(3) === String(topCpu.comm), () => `O processo que mais consome CPU agora é <code>${topCpu ? topCpu.comm : '?'}</code>, e o arquivo diz <code>${val(3)}</code>.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 7.4 ============================== */
  LX.lesson('m07', {
    id: 'l7-4', n: '7.4', title: 'Sinais: conversar com um processo',
    goal: 'Encerrar processos do jeito certo, entender por que o -9 deve ser o último recurso e conhecer os sinais que não servem para matar.',
    body: [
      { p: 'Um sinal é uma mensagem curta que o kernel entrega a um processo. O nome <code>kill</code> é infeliz: o comando <strong>envia sinais</strong>, e só alguns deles encerram algo.' },
      { cmd: 'kill' },
      { code: ['$ kill -l | head -6'] },
      {
        table: {
          head: ['Nº', 'Nome', 'Efeito padrão', 'Pode ser ignorado?'],
          rows: [
            ['<strong>1</strong>', '<code>SIGHUP</code>', 'terminal fechou; muitos serviços <strong>recarregam a configuração</strong>', 'sim'],
            ['<strong>2</strong>', '<code>SIGINT</code>', 'interrupção do teclado (Ctrl+C)', 'sim'],
            ['<strong>9</strong>', '<code>SIGKILL</code>', 'morte imediata pelo kernel', '<strong>não</strong>'],
            ['<strong>15</strong>', '<code>SIGTERM</code>', 'pedido educado de encerramento — <strong>o padrão</strong>', 'sim'],
            ['<strong>18</strong>', '<code>SIGCONT</code>', 'continuar um processo parado', 'sim'],
            ['<strong>19</strong>', '<code>SIGSTOP</code>', 'pausar (Ctrl+Z envia o 20, SIGTSTP)', '<strong>não</strong>']
          ]
        }
      },

      { h2: 'SIGTERM × SIGKILL: a diferença que importa' },
      {
        ascii: `kill -15 (TERM)                    kill -9 (KILL)
   │                                  │
   ▼                                  ▼
o processo RECEBE o sinal         o kernel remove o processo
   ├─ salva o que estava fazendo     (o processo não é avisado)
   ├─ fecha arquivos e conexões       ├─ arquivos ficam abertos
   ├─ remove o arquivo de PID         ├─ locks e PIDs ficam para trás
   └─ sai com dignidade               └─ dados em buffer se perdem`
      },
      {
        box: 'key', body: [
          { p: 'Bancos de dados, filas e qualquer coisa com transação <strong>precisam</strong> do SIGTERM para gravar o que está em memória. Um <code>kill -9</code> em um PostgreSQL ou MySQL pode significar recuperação demorada na próxima inicialização — e, no pior caso, dados perdidos.' },
          { p: 'A sequência correta é sempre: <code>kill</code> (TERM) → esperar alguns segundos → conferir → e só então <code>kill -9</code>.' }
        ]
      },
      {
        code: [
          '$ sleep 300 &',
          '$ pgrep -a sleep',
          '$ kill %1',
          '$ jobs'
        ]
      },
      { p: 'Formas equivalentes de mandar o mesmo sinal:' },
      { code: ['# todas iguais:', '$ echo "kill PID    kill -15 PID    kill -TERM PID    kill -SIGTERM PID"'], run: false },

      { h2: 'SIGHUP: recarregar sem reiniciar' },
      { p: 'Historicamente, o SIGHUP avisava que a linha telefônica caiu. Serviços passaram a usá-lo para outra coisa: <strong>reler a configuração sem derrubar as conexões</strong>.' },
      { code: ['$ sudo systemctl reload ssh', '$ sudo journalctl -u ssh -n 3 --no-pager'] },
      { p: 'Nginx, sshd, rsyslog e muitos outros aceitam <code>kill -HUP PID</code> ou <code>systemctl reload</code> — que é o mesmo, com a vantagem de saber qual sinal aquele serviço espera.' },

      { h2: 'Matar por nome' },
      { cmd: 'pkill' },
      { cmd: 'killall' },
      {
        table: {
          head: ['Comando', 'Alvo', 'Cuidado'],
          rows: [
            ['<code>pkill nome</code>', 'casa o nome do processo', 'casa parcialmente por padrão!'],
            ['<code>pkill -x nome</code>', 'nome exato', 'o mais seguro'],
            ['<code>pkill -f "trecho"</code>', 'casa a <strong>linha inteira</strong>', 'ótimo para java/python, perigoso se genérico'],
            ['<code>pkill -u ana</code>', 'todos os processos de um usuário', 'encerra a sessão dela'],
            ['<code>killall nome</code>', 'nome exato (no Linux)', 'em alguns Unix antigos, matava tudo!']
          ]
        }
      },
      {
        box: 'warn', body: [
          { p: 'Sempre confirme antes com o <code>pgrep</code> equivalente. O <code>pgrep -f</code> e o <code>pkill -f</code> aceitam exatamente o mesmo padrão:' },
          { code: ['$ pgrep -af sleep', '# se a lista estiver certa, então:', '$ pkill -f "sleep 300"'], run: false },
          { p: 'Um <code>pkill -f java</code> em um servidor de aplicação derruba tudo de uma vez — inclusive o que você não queria.' }
        ]
      },
      {
        box: 'old', body: [
          { p: 'Em servidores gerenciados por systemd, prefira <code>systemctl stop servico</code> a matar o PID: o systemd encerra a árvore inteira (inclusive filhos que o <code>kill</code> deixaria órfãos), respeita o tempo de espera configurado e não confunde o supervisor, que poderia reiniciar o processo automaticamente. <strong>Aprenda essa versão</strong> — o <code>kill</code> direto fica para processos avulsos e para diagnóstico.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't7-4-a', kind: 'guiado', title: 'Envie sinais',
        body: [
          { p: 'Crie processos, confirme antes de matar e observe a diferença entre parar e continuar.' },
          {
            code: [
              '$ sleep 300 &',
              '$ sleep 400 &',
              '$ jobs',
              '$ pgrep -a sleep',
              '$ kill %1',
              '$ jobs',
              '$ pkill -f "sleep 400"',
              '$ pgrep -a sleep; echo "restaram: $?"'
            ]
          },
          { p: 'Repare que o <code>pgrep</code> devolve 1 quando não encontra nada — o que o torna útil dentro de <code>if</code>.' }
        ],
        hints: ['<code>%1</code> se refere ao job número 1 do shell atual; o <code>kill</code> aceita tanto <code>%N</code> quanto o PID.'],
        solution: '<div class="code"><pre>sleep 300 &amp;\nsleep 400 &amp;\njobs\npgrep -a sleep\nkill %1\njobs\npkill -f "sleep 400"\npgrep -a sleep; echo "restaram: $?"</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /sleep\s+\d+\s*&/), 'Coloque ao menos um <code>sleep</code> em segundo plano com <code>&</code>.'],
          [() => H.usedCommand(ctx, /pgrep/), 'Confirme os alvos com <code>pgrep -a</code> antes de matar.'],
          [() => H.usedCommand(ctx, /\bkill\b/), 'Encerre um deles com <code>kill</code>.'],
          [() => H.usedCommand(ctx, /pkill|killall/), 'Encerre o outro por nome, com <code>pkill -f</code>.'],
          [() => { const p = Array.from((ctx.machine || ctx.sh.m).processes.values()); return !p.some(x => /sleep\s+400/.test(x.cmd || '')); }, 'O <code>sleep 400</code> ainda está em execução — encerre-o com <code>pkill -f "sleep 400"</code>.']
        ])
      },
      {
        id: 't7-4-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um banco de dados parou de responder. O plantonista executa:' },
          { code: ['sudo pkill -9 -f postgres'], run: false, mixed: false },
          { p: 'O serviço volta, mas a inicialização demora vários minutos e o log fala em recuperação. O que deveria ter sido feito?' }
        ],
        options: [
          { text: 'Um <code>systemctl stop postgresql</code> (ou <code>kill -TERM</code>), esperar o encerramento limpo e só usar o <code>-9</code> se ele travasse.', correct: true },
          { text: 'Nada de diferente: <code>-9</code> é o jeito garantido de encerrar.', why: 'É garantido e é justamente por isso que é destrutivo: o processo não tem chance de gravar o que estava em memória.' },
          { text: 'Deveria ter usado <code>kill -1</code> (SIGHUP) para forçar o encerramento.', why: 'SIGHUP normalmente recarrega a configuração; não é um sinal de encerramento para a maioria dos serviços.' },
          { text: 'Deveria ter reiniciado o servidor inteiro.', why: 'Reiniciar a máquina causa o mesmo encerramento abrupto, com muito mais impacto.' }
        ],
        explain: 'O <code>-9</code> impede o banco de fechar transações e gravar os buffers, obrigando a recuperação pelo WAL na próxima inicialização. Em serviços sob systemd há ainda um detalhe: o supervisor pode reiniciar o processo automaticamente, e matar o PID à mão gera um estado inconsistente entre o que o systemd acha e o que existe.'
      },
      {
        id: 't7-4-b', kind: 'desafio', title: 'Encerre com critério',
        body: [
          { p: 'Prepare o cenário com três processos parecidos:' },
          {
            code: [
              '$ sleep 500 &',
              '$ sleep 600 &',
              '$ sleep 700 &',
              '$ pgrep -a sleep'
            ]
          },
          { p: 'Sua missão: encerrar <strong>apenas o <code>sleep 600</code></strong>, deixando os outros dois em execução. Depois, grave em <code>~/sobreviventes.txt</code> a saída de <code>pgrep -a sleep</code> — que deve conter exatamente duas linhas.' },
          { p: 'A dificuldade é justamente a precisão: <code>pkill sleep</code> mataria os três.' }
        ],
        hints: [
          'O que distingue os três é o <strong>argumento</strong>, não o nome do processo. Isso pede o <code>-f</code>.',
          'Confirme antes com <code>pgrep -af "sleep 600"</code>: se listar só um, o <code>pkill</code> com o mesmo padrão é seguro.',
          '<code>pkill -f "sleep 600"</code> e depois <code>pgrep -a sleep &gt; ~/sobreviventes.txt</code>'
        ],
        solution: '<div class="code"><pre>pgrep -af "sleep 600"\npkill -f "sleep 600"\npgrep -a sleep &gt; ~/sobreviventes.txt\ncat ~/sobreviventes.txt</pre></div><p style="margin-top:8px">O hábito de rodar o <code>pgrep</code> com o mesmo padrão antes do <code>pkill</code> evita a maioria dos acidentes: você vê a lista exata do que vai morrer.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/sobreviventes.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/sobreviventes.txt</code> ainda não existe.' };
          const linhas = c.split('\n').filter(l => l.trim());
          const m = ctx.machine || ctx.sh.m;
          const vivos = Array.from(m.processes.values()).filter(p => p.comm === 'sleep').map(p => p.cmd);
          return LX.H.checkAll([
            [linhas.length === 2, `O arquivo deve conter exatamente 2 linhas (os sobreviventes); tem ${linhas.length}.`],
            [!/sleep 600/.test(c), 'O <code>sleep 600</code> ainda aparece na lista — ele é o que deveria ter sido encerrado.'],
            [/sleep 500/.test(c) && /sleep 700/.test(c), 'Os processos <code>sleep 500</code> e <code>sleep 700</code> devem continuar vivos e aparecer no arquivo.'],
            [!vivos.some(v => /600/.test(v)), 'O processo <code>sleep 600</code> ainda está em execução.'],
            [vivos.length >= 2, 'Os outros dois processos não podem ser encerrados — recrie o cenário e mire só no 600.'],
            [() => H.usedCommand(ctx, /pkill\s+-f|kill\s+\d+/), 'Encerre o alvo com <code>pkill -f "sleep 600"</code> (ou <code>kill</code> no PID exato).']
          ]);
        }
      }
    ]
  });

  /* ============================== 7.5 ============================== */
  LX.lesson('m07', {
    id: 'l7-5', n: '7.5', title: 'Primeiro e segundo plano',
    goal: 'Controlar o que ocupa seu terminal, retomar o que foi suspenso e deixar um comando rodando depois que você desconectar.',
    body: [
      { p: 'Um comando comum ocupa o terminal até terminar: ele está em <strong>primeiro plano</strong> (foreground). O shell oferece um conjunto de controles para mudar isso.' },
      {
        cheat: [
          ['<code>comando &</code>', 'inicia já em segundo plano'],
          ['<code>Ctrl+Z</code>', 'suspende o que está em primeiro plano (estado <code>T</code>)'],
          ['<code>Ctrl+C</code>', 'envia SIGINT: encerra o que está em primeiro plano'],
          ['<code>jobs</code>', 'lista os trabalhos deste shell'],
          ['<code>fg %1</code>', 'traz o job 1 para o primeiro plano'],
          ['<code>bg %1</code>', 'faz o job 1 <strong>continuar</strong> em segundo plano'],
          ['<code>kill %1</code>', 'encerra o job 1'],
          ['<code>disown %1</code>', 'desliga o job do shell (não recebe SIGHUP ao sair)'],
          ['<code>wait</code>', 'espera todos os jobs terminarem']
        ]
      },
      {
        code: [
          '$ sleep 200 &',
          '$ sleep 300 &',
          '$ jobs',
          '$ kill %1',
          '$ jobs'
        ]
      },
      { p: 'O <code>$!</code> guarda o PID do último processo colocado em segundo plano — essencial em scripts:' },
      { code: ['$ sleep 120 & echo "iniciei o PID $!"', '$ jobs -l', '$ kill $!'] },
      {
        box: 'note', body: [
          { p: 'Os números <code>%1</code>, <code>%2</code> são do <strong>shell atual</strong>, não do sistema. Outro terminal não enxerga os seus jobs. Para agir sobre processos de outra sessão, é PID (ou <code>pkill</code>).' }
        ]
      },

      { h2: 'O problema: o processo morre quando você desconecta' },
      { p: 'Ao encerrar a sessão SSH, o shell envia <strong>SIGHUP</strong> aos jobs que ainda dependem dele. É por isso que aquele backup de 40 minutos morre junto com a conexão que caiu.' },
      {
        table: {
          head: ['Solução', 'Como', 'Quando usar'],
          rows: [
            ['<code>nohup</code>', '<code>nohup comando &</code>', 'imunidade ao SIGHUP; saída vai para <code>nohup.out</code>'],
            ['<code>disown</code>', '<code>comando &</code> e depois <code>disown</code>', 'quando você já iniciou e esqueceu do nohup'],
            ['<code>tmux</code> / <code>screen</code>', '<code>tmux new -s backup</code>', '<strong>o melhor para uso interativo</strong>: dá para reconectar e ver a tela'],
            ['<code>systemd-run</code>', '<code>systemd-run --user --scope comando</code>', 'tarefa longa sob supervisão do systemd'],
            ['unit do systemd', 'arquivo <code>.service</code>', 'quando é serviço de verdade, não uma tarefa avulsa']
          ]
        }
      },
      { code: ['$ cd ~ && nohup sleep 90 &', '$ jobs', '$ ls -l nohup.out'] },
      {
        box: 'key', body: [
          { p: 'O <code>nohup</code> resolve <em>sobreviver</em>, mas não deixa você <em>voltar</em>: a saída vai para um arquivo e não há como reanexar o terminal. Para um processo interativo, ou para acompanhar a saída depois, a resposta é <code>tmux</code>: você desconecta, reconecta de outra máquina e a tela está lá, intacta.' },
          { p: 'Regra prática: tarefa automática → <code>nohup</code> ou systemd; trabalho que você vai acompanhar → <code>tmux</code>.' }
        ]
      },
      {
        box: 'old', label: 'Prática antiga × atual', body: [
          { p: 'Muito tutorial ainda ensina <code>nohup ./app.sh &</code> como forma de "rodar um serviço". Isso não sobrevive a um reboot, não reinicia se cair, não tem log estruturado e ninguém sabe que existe.' },
          { p: 'Hoje, qualquer coisa que precise ficar de pé é uma <strong>unit do systemd</strong> (módulo 8): reinício automático, log no journal, dependências e início no boot. <strong>Aprenda essa versão</strong> — o <code>nohup</code> fica para tarefas pontuais.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't7-5-a', kind: 'guiado', title: 'Controle os jobs',
        body: [
          { p: 'Coloque tarefas em segundo plano, liste, encerre pelo número do job e depois pelo PID.' },
          {
            code: [
              '$ sleep 200 &',
              '$ sleep 300 &',
              '$ jobs -l',
              '$ kill %1 && jobs',
              '$ sleep 150 & echo "PID: $!"',
              '$ kill $! && jobs',
              '$ cd ~ && nohup sleep 90 &',
              '$ ls -l nohup.out'
            ]
          }
        ],
        hints: ['<code>jobs -l</code> mostra o PID de cada job ao lado do número.'],
        solution: '<div class="code"><pre>sleep 200 &amp;\nsleep 300 &amp;\njobs -l\nkill %1\nsleep 150 &amp; echo "PID: $!"\nkill $!\ncd ~ &amp;&amp; nohup sleep 90 &amp;\nls -l nohup.out\njobs</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /jobs/), 'Liste os trabalhos com <code>jobs</code>.'],
          [() => H.usedCommand(ctx, /kill\s+%\d/), 'Encerre um job pelo número, com <code>kill %1</code>.'],
          [() => H.usedCommand(ctx, /\$!/), 'Use a variável <code>$!</code> para capturar o PID do último processo em segundo plano.'],
          [() => H.usedCommand(ctx, /nohup/), 'Experimente o <code>nohup</code>.'],
          [H.exists(ctx, '/home/aluno/nohup.out'), 'O <code>nohup</code> deveria ter criado <code>~/nohup.out</code>.']
        ])
      },
      {
        id: 't7-5-q', kind: 'quiz', title: 'Conceito: sobreviver à desconexão',
        body: [
          { p: 'Você iniciou uma migração de banco que leva 3 horas, direto no terminal SSH, e percebeu que precisa fechar o notebook. O processo já está rodando em primeiro plano. Qual é a melhor saída <strong>agora</strong>?' }
        ],
        options: [
          { text: '<code>Ctrl+Z</code>, depois <code>bg</code>, depois <code>disown -h %1</code> — assim ele continua e deixa de receber o SIGHUP.', correct: true },
          { text: 'Fechar o notebook: o processo continua porque já está rodando.', why: 'Ao cair a sessão, o shell envia SIGHUP aos jobs — e a migração morre no meio.' },
          { text: '<code>Ctrl+C</code> e reiniciar tudo com <code>nohup</code>.', why: 'Funciona, mas joga fora o trabalho já feito. O <code>disown</code> salva o que está em andamento.' },
          { text: '<code>kill -STOP</code> no processo e retomar depois.', why: 'Ele ficaria pausado (não avança) e ainda morreria com a sessão.' }
        ],
        explain: 'A sequência <code>Ctrl+Z</code> → <code>bg</code> → <code>disown -h</code> é o resgate clássico. A lição para a próxima vez: começar dentro de um <code>tmux</code>, que resolve o problema antes de ele existir e ainda permite reconectar e ver a saída.'
      },
      {
        id: 't7-5-b', kind: 'desafio', title: 'Deixe rodando e registre',
        body: [
          { p: 'Coloque um processo longo para rodar de forma que ele <strong>sobreviva ao fim da sua sessão</strong>, e registre a prova disso.' },
          { p: 'Requisitos:' },
          {
            ul: [
              'inicie <code>sleep 900</code> em segundo plano usando <code>nohup</code>;',
              'grave em <code>~/processo-longo.txt</code> uma única linha no formato <code>pid=NNNN</code>, com o PID real desse processo;',
              'o processo deve continuar <strong>em execução</strong> ao final do desafio.'
            ]
          },
          { p: 'A parte interessante é capturar o PID sem consultar o <code>ps</code> depois.' }
        ],
        hints: [
          'O shell guarda o PID do último processo em segundo plano em uma variável especial.',
          'Essa variável é <code>$!</code>, e ela precisa ser lida <strong>imediatamente</strong> após o <code>&</code>.',
          '<code>nohup sleep 900 &</code> e, na linha seguinte, <code>echo "pid=$!" &gt; ~/processo-longo.txt</code>'
        ],
        solution: '<div class="code"><pre>cd ~\nnohup sleep 900 &amp;\necho "pid=$!" &gt; ~/processo-longo.txt\ncat ~/processo-longo.txt\nps -p $(cut -d= -f2 ~/processo-longo.txt) -o pid,stat,comm</pre></div><p style="margin-top:8px">Em um servidor real, o passo seguinte seria conferir o <code>nohup.out</code> para acompanhar a saída — ou, melhor ainda, ter começado dentro de um <code>tmux</code>.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/processo-longo.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/processo-longo.txt</code> ainda não existe.' };
          const m = ctx.machine || ctx.sh.m;
          const mm = /^pid=(\d+)\s*$/m.exec(c.trim());
          if (!mm) return { ok: false, msg: `O arquivo deve conter exatamente uma linha no formato <code>pid=NNNN</code>. Obtive: "${c.trim()}".` };
          const p = m.processes.get(+mm[1]);
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /nohup/), 'O processo deve ser iniciado com <code>nohup</code>.'],
            [() => H.usedCommand(ctx, /\$!/), 'Capture o PID com a variável <code>$!</code>, e não consultando o <code>ps</code> depois.'],
            [!!p, `O PID ${mm[1]} não corresponde a nenhum processo em execução — ele terminou ou o número está errado.`],
            [!!p && /sleep/.test(p.comm + ' ' + p.cmd), `O PID ${mm[1]} existe, mas não é o <code>sleep</code> — confira se capturou o <code>$!</code> logo após o comando.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 7.6 ============================== */
  LX.lesson('m07', {
    id: 'l7-6', n: '7.6', title: 'Prioridade e limites',
    goal: 'Decidir quem cede CPU para quem, e conhecer os limites que impedem um processo de derrubar a máquina.',
    body: [
      { p: 'Quando há mais trabalho do que CPU, o escalonador precisa escolher. A <strong>niceness</strong> é como você influencia essa escolha.' },
      { cmd: 'nice' },
      {
        ascii: `  -20  ────────────────  0  ────────────────  +19
   ↑                      ↑                      ↑
 máxima              padrão                 mínima
prioridade                                prioridade

 "nice" = quão BONZINHO o processo é com os outros.
 Mais nice  →  cede mais CPU  →  MENOS prioridade.`
      },
      { p: 'O nome confunde porque o número é invertido: <strong>quanto maior o nice, menor a prioridade</strong>.' },
      { code: ['$ nice -n 10 echo "rodei com prioridade baixa"', '$ ps -eo pid,ni,comm | head -5'] },
      {
        table: {
          head: ['Comando', 'Efeito'],
          rows: [
            ['<code>nice -n 10 comando</code>', 'inicia o comando com prioridade menor'],
            ['<code>nice -n -5 comando</code>', 'prioridade maior — <strong>só root</strong>'],
            ['<code>renice -n 5 -p 1234</code>', 'muda a prioridade de um processo já rodando'],
            ['<code>renice -n 5 -u ana</code>', 'muda de todos os processos de um usuário'],
            ['<code>ps -eo pid,ni,comm</code>', 'mostra o nice atual']
          ]
        }
      },
      { code: ['$ sleep 400 &', '$ ps -p $! -o pid,ni,comm', '$ renice -n 15 -p $! 2>&1', '$ ps -eo pid,ni,comm --sort=-ni | head -4', '$ pkill -f "sleep 400"'] },
      {
        box: 'key', body: [
          { p: 'Um usuário comum só pode <strong>aumentar</strong> o nice (reduzir a própria prioridade). Baixar exige root — caso contrário, qualquer pessoa poderia se colocar na frente das outras.' },
          { p: 'E lembre: nice só importa quando há <strong>disputa</strong>. Com CPU sobrando, o processo mais "bonzinho" roda na mesma velocidade.' }
        ]
      },
      { p: 'Casos de uso reais: um <code>rsync</code> ou <code>tar</code> de backup com <code>nice -n 19</code>, para não atrapalhar a aplicação; uma compilação demorada com <code>nice -n 10</code>; um processo de compressão de vídeo em uma máquina de trabalho.' },
      {
        box: 'note', label: 'Também existe prioridade de disco', body: [
          { p: 'O <code>nice</code> mexe só na CPU. Para E/S existe o <code>ionice</code>: <code>ionice -c 3 comando</code> roda o processo na classe "idle", só usando disco quando ninguém mais precisa. Em backups, a combinação <code>nice -n 19 ionice -c 3</code> é o padrão para não atrapalhar produção.' }
        ]
      },

      { h2: 'ulimit: o teto de cada processo' },
      { p: 'Os limites impedem que um processo (ou um usuário) consuma tudo. Eles são herdados pelos filhos.' },
      { code: ['$ ulimit -a | head -8', '$ ulimit -n', '$ ulimit -u'] },
      {
        table: {
          head: ['Limite', 'Opção', 'Por que importa'],
          rows: [
            ['arquivos abertos', '<code>-n</code>', 'a causa nº 1 de <code>Too many open files</code> em servidores web'],
            ['processos do usuário', '<code>-u</code>', 'contém fork bombs e vazamento de threads'],
            ['tamanho de arquivo', '<code>-f</code>', 'evita um log que enche o disco'],
            ['memória virtual', '<code>-v</code>', 'raro, mas útil para caixas de teste'],
            ['core dump', '<code>-c</code>', 'controla se um crash gera arquivo de despejo']
          ]
        }
      },
      { p: 'Cada limite tem um valor <strong>soft</strong> (o que vale agora, ajustável pelo usuário até o teto) e um <strong>hard</strong> (o teto, só o root aumenta). O permanente fica em <code>/etc/security/limits.conf</code> — e, para serviços, em <code>LimitNOFILE=</code> na unit do systemd.' },
      { code: ['$ cat /proc/1/limits | head -6'] },
      {
        box: 'old', body: [
          { p: 'Ajustar <code>/etc/security/limits.conf</code> para um serviço é prática antiga e muitas vezes <strong>não funciona</strong>: serviços iniciados pelo systemd não passam pelo PAM que lê aquele arquivo. O lugar certo é a unit: <code>LimitNOFILE=65535</code>. Para controle de CPU e memória de um serviço, a resposta moderna são as diretivas de cgroup — <code>CPUQuota=50%</code>, <code>MemoryMax=2G</code> —, não <code>nice</code> nem <code>ulimit</code>. <strong>Aprenda essa versão.</strong>' }
        ]
      }
    ],
    tasks: [
      {
        id: 't7-6-a', kind: 'guiado', title: 'Mexa na prioridade',
        body: [
          { p: 'Inicie um processo, veja o nice, mude e comprove.' },
          {
            code: [
              '$ sleep 400 &',
              '$ ps -p $! -o pid,ni,comm',
              '$ renice -n 15 -p $!',
              '$ ps -eo pid,ni,comm --sort=-ni | head -4',
              '$ nice -n -5 echo teste 2>&1',
              '$ ulimit -n && ulimit -u',
              '$ pkill -f "sleep 400"'
            ]
          },
          { p: 'A linha do <code>nice -n -5</code> falha de propósito: reduzir o nice exige root.' }
        ],
        hints: ['O <code>renice</code> aceita <code>-p PID</code>; combine com <code>$!</code> para pegar o processo recém-criado.'],
        solution: '<div class="code"><pre>sleep 400 &amp;\nps -p $! -o pid,ni,comm\nrenice -n 15 -p $!\nps -eo pid,ni,comm --sort=-ni | head -4\nnice -n -5 echo teste\nulimit -n\nulimit -u\npkill -f "sleep 400"</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /renice/), 'Mude a prioridade de um processo em execução com <code>renice</code>.'],
          [() => H.usedCommand(ctx, /ps\s+.*\bni\b/), 'Confira o nice na saída do <code>ps</code> (coluna <code>ni</code>).'],
          [() => H.usedCommand(ctx, /ulimit/), 'Consulte os limites com <code>ulimit -n</code> e <code>ulimit -u</code>.'],
          [() => H.usedCommand(ctx, /nice\s+-n\s+-\d/), 'Tente também baixar o nice sem ser root, para ver a recusa.']
        ])
      },
      {
        id: 't7-6-q', kind: 'quiz', title: 'Conceito: backup pesado em produção',
        body: [
          { p: 'Um backup noturno com <code>tar</code> + <code>rsync</code> está deixando a aplicação lenta, mesmo rodando de madrugada. A CPU fica em 30% e o <code>wa</code> em 60%. O que resolve melhor?' }
        ],
        options: [
          { text: '<code>nice -n 19 ionice -c 3 ...</code> — o problema é disputa de disco, e o <code>ionice</code> é quem trata disso.', correct: true },
          { text: 'Só <code>nice -n 19</code>: reduzir a prioridade de CPU já resolve.', why: 'O <code>nice</code> não influencia a fila de disco, e o <code>wa</code> em 60% mostra que o gargalo é E/S.' },
          { text: '<code>renice -n -20</code> na aplicação, para ela ganhar prioridade.', why: 'Ajuda um pouco na CPU (que não está saturada) e nada no disco — além de exigir root e mexer no serviço errado.' },
          { text: 'Aumentar o <code>ulimit -n</code> do processo de backup.', why: 'Arquivos abertos não têm relação com a lentidão descrita.' }
        ],
        explain: 'Diagnóstico antes de remédio: CPU ociosa + <code>wa</code> alto = disco. A dupla <code>nice</code> + <code>ionice</code> é o padrão para tarefas de manutenção. Em um servidor sob systemd, a alternativa mais robusta é rodar o backup como unit com <code>IOWeight=</code> e <code>CPUWeight=</code> reduzidos.'
      },
      {
        id: 't7-6-b', kind: 'desafio', title: 'Tarefa de manutenção comportada',
        body: [
          { p: 'Inicie um processo de "manutenção" que não atrapalhe ninguém e registre a prova.' },
          { p: 'Requisitos:' },
          {
            ul: [
              'o processo é <code>sleep 800</code>, em segundo plano;',
              'ele deve estar rodando com <strong>niceness 19</strong> (a menor prioridade possível);',
              'grave em <code>~/manutencao.txt</code> uma linha no formato <code>pid=NNNN ni=19</code>, com o PID real;',
              'o processo deve continuar vivo ao final.'
            ]
          },
          { p: 'Existem dois caminhos: iniciar já com a prioridade certa, ou ajustar depois. Os dois valem.' }
        ],
        hints: [
          'Para iniciar já com prioridade baixa: <code>nice -n 19 comando &</code>. Para ajustar depois: <code>renice</code>.',
          'Capture o PID com <code>$!</code> logo depois do <code>&</code>.',
          '<code>nice -n 19 sleep 800 &</code>; <code>P=$!</code>; <code>echo "pid=$P ni=$(ps -p $P -o ni=)" | tr -s " " &gt; ~/manutencao.txt</code>'
        ],
        solution: '<div class="code"><pre>sleep 800 &amp;\nP=$!\nrenice -n 19 -p $P\necho "pid=$P ni=19" &gt; ~/manutencao.txt\ncat ~/manutencao.txt\nps -p $P -o pid,ni,comm</pre></div><p style="margin-top:8px">Em produção, esse mesmo processo ganharia também <code>ionice -c 3</code> — e, se fosse recorrente, viraria uma unit com temporizador (módulo 8) em vez de um comando solto.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/manutencao.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/manutencao.txt</code> ainda não existe.' };
          const mm = /pid=(\d+)\s+ni=(-?\d+)/.exec(c);
          if (!mm) return { ok: false, msg: `O arquivo deve ter o formato <code>pid=NNNN ni=19</code>. Obtive: "${c.trim()}".` };
          const m = ctx.machine || ctx.sh.m;
          const p = m.processes.get(+mm[1]);
          return LX.H.checkAll([
            [!!p, `O PID ${mm[1]} não corresponde a nenhum processo vivo.`],
            [!!p && /sleep/.test(p.comm + ' ' + p.cmd), 'O PID registrado não é o processo <code>sleep</code> do enunciado.'],
            [+mm[2] === 19, `O arquivo diz <code>ni=${mm[2]}</code>; o exigido é 19.`],
            [!!p && (p.nice || 0) === 19, `O processo está rodando com nice ${p ? (p.nice || 0) : '?'}, não 19. Ajuste com <code>renice -n 19 -p ${mm[1]}</code>.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 7.7 ============================== */
  LX.lesson('m07', {
    id: 'l7-7', n: '7.7', title: 'Diagnóstico: o servidor está lento',
    goal: 'Ter uma sequência fixa para achar o culpado — CPU, memória, disco ou um processo específico — em menos de cinco minutos.',
    body: [
      { lede: 'A frase "o servidor está lento" não é um diagnóstico. É o começo de uma triagem de quatro perguntas.' },
      { h2: 'A sequência' },
      {
        ol: [
          '<strong>Está sobrecarregado?</strong> <code>uptime</code> — compare o load com o número de núcleos.',
          '<strong>É CPU, memória ou disco?</strong> <code>top -b -n1 | head -5</code> — olhe <code>us</code>, <code>wa</code> e <code>avail Mem</code>.',
          '<strong>Quem é o culpado?</strong> <code>ps -eo pid,user,pcpu,pmem,etime,comm --sort=-pcpu | head</code>.',
          '<strong>O que ele está fazendo?</strong> <code>/proc/PID/</code>, <code>ss</code>, <code>lsof</code>, e o log do serviço.'
        ]
      },
      {
        table: {
          head: ['Sintoma', 'Indício', 'Caminho'],
          rows: [
            ['load alto, <code>us</code> alto', 'CPU saturada', 'achar o processo, avaliar <code>nice</code> ou corrigir o código'],
            ['load alto, <code>wa</code> alto', 'gargalo de E/S', '<code>iostat -x 1</code>, disco, NFS, <code>dmesg</code>'],
            ['load alto, CPU e disco ociosos', 'muitos processos em <code>D</code>', 'montagem de rede travada'],
            ['<code>available</code> baixo, swap ativo', 'falta memória', 'achar o maior <code>RSS</code>; ver se o OOM killer agiu'],
            ['tudo normal, app lenta', 'não é a máquina', 'banco, rede, dependência externa']
          ]
        }
      },
      { code: ['$ uptime', '$ top -b -n1 | head -5', '$ ps -eo pid,user,pcpu,pmem,etime,comm --sort=-pcpu | head -6', '$ free -h'] },

      { h2: 'Quando a memória acaba: o OOM killer' },
      { p: 'Se a RAM esgota, o kernel escolhe um processo e o mata para salvar o sistema. Isso não aparece no log da aplicação — aparece no do kernel:' },
      { code: ['$ sudo dmesg | grep -i -E "killed process|out of memory" | tail -5', '$ sudo journalctl -k --no-pager | tail -5'] },
      {
        box: 'key', body: [
          { p: 'Quando um serviço "morre sozinho, sem erro no log", a primeira suspeita é o OOM killer. A vítima costuma ser o processo com maior consumo — que nem sempre é o causador. A correção é limitar quem vaza (<code>MemoryMax=</code> na unit) ou aumentar a memória, não reiniciar em loop.' }
        ]
      },

      { h2: 'Quem está usando esta porta? E este arquivo?' },
      { p: 'Duas perguntas que aparecem toda semana:' },
      {
        code: [
          '$ ss -tlnp | head -5',
          '$ sudo lsof -i :22',
          '$ sudo fuser -v 22/tcp'
        ]
      },
      { p: 'Para "não consigo desmontar, o dispositivo está ocupado", o mesmo raciocínio vale com caminhos: <code>sudo fuser -v /mnt/dados</code> ou <code>sudo lsof +D /mnt/dados</code> mostram quem segura o ponto de montagem.' },
      {
        box: 'tip', label: 'Arquivo apagado que não libera espaço', body: [
          { p: 'Clássico: o disco está cheio, você apaga um log de 20 GB e o espaço <strong>não volta</strong>. O motivo é que um processo ainda mantém o arquivo aberto — o espaço só é liberado quando o último descritor fecha.' },
          { code: ['$ sudo lsof | grep deleted'], run: false },
          { p: 'A solução é reiniciar (ou recarregar) o serviço dono, não apagar mais arquivos.' }
        ]
      },

      { h2: 'Processos que não morrem' },
      {
        table: {
          head: ['Situação', 'Como reconhecer', 'O que fazer'],
          rows: [
            ['<strong>zumbi</strong> (<code>Z</code>)', 'aparece no <code>ps</code>, não consome nada', 'reiniciar o processo <strong>pai</strong>; matar o zumbi não adianta'],
            ['<strong>estado D</strong>', 'ignora até o <code>kill -9</code>', 'investigar disco/NFS; muitas vezes só reiniciando'],
            ['<strong>reinicia sozinho</strong>', 'volta com PID novo em segundos', 'é o systemd com <code>Restart=</code>: use <code>systemctl stop</code>'],
            ['<strong>vira órfão</strong>', 'PPID passa a ser 1', 'normal quando o pai morre; o PID 1 adota']
          ]
        }
      },
      { code: ['$ ps -eo pid,ppid,stat,comm | awk \'$3 ~ /Z/ {print}\'', '$ ps -eo stat,comm | awk \'$1 ~ /^D/ {print}\''] },
      {
        box: 'warn', body: [
          { p: 'Antes de matar qualquer coisa em produção, responda: <strong>quem inicia esse processo?</strong> Se for o systemd, matar o PID faz o supervisor reiniciá-lo — e você conclui, erradamente, que "o processo é imortal". O comando certo é <code>systemctl stop</code> (módulo 8).' }
        ]
      }
    ],
    tasks: [
      {
        id: 't7-7-a', kind: 'guiado', title: 'Rode a triagem',
        body: [
          { p: 'Execute a sequência inteira, na ordem, mesmo com a máquina saudável — o objetivo é que ela vire automática.' },
          {
            code: [
              '$ uptime',
              '$ top -b -n1 | head -5',
              '$ ps -eo pid,user,pcpu,pmem,etime,comm --sort=-pcpu | head -6',
              '$ free -h',
              '$ ss -tlnp | head -5',
              '$ sudo lsof -i :22',
              '$ ps -eo pid,ppid,stat,comm | awk \'$3 ~ /Z/ {print}\''
            ]
          },
          { p: 'A última linha não deve devolver nada: não há zumbis por aqui.' }
        ],
        hints: ['O <code>ss -tlnp</code> mostra portas em escuta com o processo dono de cada uma.'],
        solution: '<div class="code"><pre>uptime\ntop -b -n1 | head -5\nps -eo pid,user,pcpu,pmem,etime,comm --sort=-pcpu | head -6\nfree -h\nss -tlnp | head -5\nsudo lsof -i :22\nps -eo pid,ppid,stat,comm | awk \'$3 ~ /Z/ {print}\'</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /uptime/), 'Passo 1: <code>uptime</code>.'],
          [() => H.usedCommand(ctx, /top\s+-b/), 'Passo 2: <code>top -b -n1</code>.'],
          [() => H.usedCommand(ctx, /ps\s+-eo.*--sort/), 'Passo 3: liste os maiores consumidores com <code>ps -eo ... --sort=-pcpu</code>.'],
          [() => H.usedCommand(ctx, /ss\s+-|lsof/), 'Passo 4: veja quem está nas portas com <code>ss -tlnp</code> ou <code>lsof</code>.']
        ])
      },
      {
        id: 't7-7-q', kind: 'quiz', title: 'Conceito: o serviço que morre sem explicação',
        body: [
          { p: 'Um processo de análise de dados morre sozinho, sem nenhuma mensagem de erro no próprio log, sempre que o servidor processa um lote grande. Pouco antes de cada queda, o <code>free -h</code> mostra <code>available</code> baixíssimo. Qual é a causa mais provável, e onde confirmar?' }
        ],
        options: [
          { text: 'O OOM killer: quando a RAM esgota, o kernel escolhe um processo e o mata sem avisar a aplicação — a confirmação está em <code>dmesg</code> ou <code>journalctl -k</code>, não no log do serviço.', correct: true },
          { text: 'O processo virou zumbi e foi removido automaticamente pelo kernel.', why: 'Zumbi (<code>Z</code>) já terminou sozinho e não some até o pai chamar <code>wait()</code> — e não tem relação com falta de memória.' },
          { text: 'O processo travou em estado <code>D</code> esperando disco, e por isso "morreu".', why: 'Estado <code>D</code> prende o processo, não o mata — ele continuaria aparecendo no <code>ps</code>, e o enunciado descreve um processo que desaparece.' },
          { text: 'O disco encheu e o processo travou por falta de espaço.', why: 'Disco cheio apareceria como erro de "no space left" no próprio log do serviço — e o enunciado diz que não há mensagem alguma ali.' }
        ],
        explain: 'Quando um serviço "morre sozinho, sem erro no log dele", a primeira suspeita é o OOM killer — e a vítima escolhida costuma ser o processo de maior consumo, que nem sempre é o causador do vazamento. A correção é limitar quem consome demais (<code>MemoryMax=</code> na unit) ou aumentar a memória, não reiniciar em loop.'
      },
      {
        id: 't7-7-b', kind: 'desafio', title: 'Investigação: quem está na porta',
        body: [
          { p: 'Um colega diz que não consegue subir um serviço novo na porta 22 porque "já tem algo lá". Sua tarefa é identificar exatamente o quê, sem matar nada.' },
          { p: 'Gere <code>~/porta22.txt</code> com <strong>três linhas</strong>, nesta ordem:' },
          {
            code: [
              'pid=640',
              'comando=sshd',
              'usuario=root'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Os valores devem ser os reais desta máquina, obtidos investigando quem escuta a porta 22 — e não digitados de memória.' }
        ],
        hints: [
          'Comece por <code>ss -tlnp | grep :22</code> ou <code>sudo lsof -i :22</code>: os dois mostram o PID de quem escuta.',
          'Com o PID em mãos, o resto sai do <code>ps</code> ou do <code>/proc/PID/status</code>: <code>ps -p PID -o comm=</code> e <code>ps -p PID -o user=</code>.',
          'Exemplo: <code>P=$(sudo fuser 22/tcp 2>/dev/null)</code> ou pegue o PID no <code>ss</code>; depois <code>echo "pid=$P" &gt; ~/porta22.txt</code> e acrescente as outras duas linhas com <code>&gt;&gt;</code>.'
        ],
        solution: '<div class="code"><pre>ss -tlnp | grep ":22 "\nsudo lsof -i :22\n\nP=$(pgrep -x sshd | head -1)\necho "pid=$P" &gt; ~/porta22.txt\necho "comando=$(ps -p $P -o comm=)" &gt;&gt; ~/porta22.txt\necho "usuario=$(ps -p $P -o user=)" &gt;&gt; ~/porta22.txt\ncat ~/porta22.txt</pre></div><p style="margin-top:8px">Esse é o padrão de investigação de <code>Address already in use</code>: da porta para o PID, do PID para o processo, do processo para a unit que o iniciou. O módulo 9 aprofunda o lado da rede.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/porta22.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/porta22.txt</code> ainda não existe.' };
          const l = c.split('\n').map(x => x.trim()).filter(x => x);
          const m = ctx.machine || ctx.sh.m;
          const ouvinte = (m.listeners || []).find(x => x.port === 22);
          if (!ouvinte) return { ok: false, msg: 'Nada está escutando na porta 22 nesta máquina — reinicie o ambiente para restaurar o cenário.' };
          const p = m.processes.get(ouvinte.pid);
          const val = (chave) => { const li = l.find(x => x.startsWith(chave + '=')); return li ? li.slice(chave.length + 1).trim() : null; };
          return LX.H.checkAll([
            [l.length === 3, `O arquivo deve ter exatamente 3 linhas; tem ${l.length}.`],
            [l[0].startsWith('pid=') && l[1].startsWith('comando=') && l[2].startsWith('usuario='), 'As linhas devem estar na ordem <code>pid=</code>, <code>comando=</code>, <code>usuario=</code>.'],
            [+val('pid') === ouvinte.pid, `O PID que escuta a porta 22 é ${ouvinte.pid}; o arquivo diz "${val('pid')}".`],
            [!!p && val('comando') === p.comm, `O comando deveria ser <code>${p ? p.comm : '?'}</code>; o arquivo diz "${val('comando')}".`],
            [!!p && val('usuario') === p.user, `O usuário deveria ser <code>${p ? p.user : '?'}</code>; o arquivo diz "${val('usuario')}".`],
            [() => H.usedCommand(ctx, /ss\s+-|lsof|fuser/), 'A investigação deve partir de quem escuta a porta: use <code>ss -tlnp</code>, <code>lsof -i :22</code> ou <code>fuser 22/tcp</code>.']
          ]);
        }
      }
    ]
  });

})();
