/* =========================================================================
   MÓDULO 1 — Fundamentos
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 1.1 ============================== */
  LX.lesson('m01', {
    id: 'l1-1', n: '1.1', title: 'O que é Linux, de verdade',
    goal: 'Separar três coisas que quase sempre se misturam: o kernel, a distribuição e o shell. Sem isso, tudo o que vem depois vira decoreba.',
    brief: [
      { h2: 'Identifique o sistema e registre a resposta' },
      { p: '<strong>Linux</strong> é o kernel, que controla CPU, memória, discos e processos. A <strong>distribuição</strong> reúne esse kernel, programas e um gerenciador de pacotes. O <strong>shell</strong> interpreta os comandos digitados no terminal.' },
      { code: ['$ uname -r', '$ cat /etc/os-release', '$ hostname'] },
      { p: '<code>uname -r</code> mostra a versão do kernel, <code>/etc/os-release</code> identifica a distribuição e <code>hostname</code> mostra o nome da máquina. As atividades usam essas três informações.' },
      { p: 'Para guardá-las, <code>&gt;</code> cria ou substitui um arquivo; <code>&gt;&gt;</code> acrescenta sem apagar o que já existe. Use <code>cat</code> para conferir o resultado.' },
      { code: ['$ uname -r > ~/sistema.txt', '$ hostname >> ~/sistema.txt', '$ cat /etc/os-release >> ~/sistema.txt', '$ cat ~/sistema.txt'] }
    ],
    body: [
      { h2: 'O kernel é só o miolo' },
      { p: 'Estritamente falando, <strong>Linux é um kernel</strong> — um programa que fica entre o hardware e o resto do software. Ele foi publicado por Linus Torvalds em 1991 e continua sendo desenvolvido até hoje.' },
      { p: 'O trabalho do kernel é chato e essencial: decidir qual processo usa o processador agora, entregar memória a quem pede, falar com o disco e a placa de rede, e impedir que um programa leia a memória do outro. Quando você digita <code>ls</code>, quem lê o disco de verdade é o kernel — o <code>ls</code> só pede.' },
      {
        box: 'key', label: 'A ideia central', body: [
          { p: 'Programas não tocam no hardware. Eles fazem <strong>chamadas de sistema</strong> (<em>syscalls</em>) e o kernel executa. É por isso que o Linux consegue rodar mil programas ao mesmo tempo sem que um destrua o outro.' }
        ]
      },
      { p: 'Você pode ver a versão do kernel da máquina que está do lado:' },
      { code: ['$ uname -r', '$ uname -a'] },

      { h2: 'A distribuição é o sistema montado' },
      { p: 'Um kernel sozinho não faz nada de útil para você: não tem <code>ls</code>, não tem editor, não tem gerenciador de pacotes. Quem junta o kernel com as ferramentas GNU, um sistema de inicialização, um gerenciador de pacotes e milhares de programas é a <strong>distribuição</strong>.' },
      {
        table: {
          head: ['Distribuição', 'Base', 'Pacotes', 'Onde você encontra'],
          rows: [
            ['<strong>Debian</strong>', 'origem', '<code>apt</code> / <code>.deb</code>', 'servidores, base de muitas outras'],
            ['<strong>Ubuntu</strong>', 'Debian', '<code>apt</code> / <code>.deb</code>', 'nuvem, VPS, desktops, containers'],
            ['<strong>RHEL / Rocky</strong>', 'Red Hat', '<code>dnf</code> / <code>.rpm</code>', 'corporativo'],
            ['<strong>Alpine</strong>', 'própria', '<code>apk</code>', 'containers pequenos'],
            ['<strong>Arch</strong>', 'própria', '<code>pacman</code>', 'desktops, quem gosta de montar tudo']
          ]
        }
      },
      { p: 'Este curso usa <strong>Ubuntu 26.04 LTS</strong>, que é Debian por baixo. LTS significa <em>Long Term Support</em>: cinco anos de atualizações de segurança. É o que você mais vai encontrar em VPS, na nuvem e dentro de containers.' },
      { code: ['$ cat /etc/os-release'] },
      {
        box: 'note', body: [
          { p: 'Existe uma discussão antiga sobre chamar o sistema de "Linux" ou "GNU/Linux". O argumento é justo: boa parte das ferramentas que você vai usar (<code>bash</code>, <code>ls</code>, <code>grep</code>, <code>gcc</code>) vem do projeto GNU, não do kernel. Na prática, todo mundo fala Linux — e você agora sabe o que está sendo abreviado.' }
        ]
      },

      { h2: 'O shell é quem conversa com você' },
      { p: 'O terceiro personagem é o <strong>shell</strong>: o programa que lê o que você digita, interpreta e manda o kernel executar. O shell padrão do Ubuntu é o <strong>Bash</strong>.' },
      {
        ascii: `   você digita
        │
        ▼
   ┌──────────┐   interpreta a linha,      ┌──────────┐
   │   BASH   │   expande variáveis,       │  KERNEL  │
   │  (shell) │──────── syscalls ─────────▶│  (Linux) │
   └──────────┘   e pede para o kernel     └──────────┘
        ▲                                        │
        │              resultado                 ▼
        └────────────────────────────────  disco · rede · CPU`
      },
      { p: 'Repare que são três camadas independentes. Você pode trocar o shell (zsh, fish) sem trocar a distribuição. Pode trocar a distribuição (Ubuntu → Alpine) mantendo o mesmo kernel. É essa separação que faz o Linux ser tão flexível — e é ela que explica quase todo comportamento estranho que você vai encontrar.' },

      { h2: 'Onde o Linux realmente está' },
      { p: 'Vale saber por que estamos investindo tempo nisso. Linux roda em praticamente todos os servidores web do mundo, em toda a nuvem pública, dentro de cada container Docker, em roteadores, TVs, carros e no Android. Aprender a operar um terminal Linux não é um conhecimento de nicho: é a interface padrão da infraestrutura moderna.' },

      { h2: 'Guardando a resposta em um arquivo' },
      { p: 'Até aqui, tudo o que os comandos respondem aparece na tela e se perde. Dá para mandar essa resposta direto para dentro de um arquivo, e é uma das coisas mais usadas no dia a dia do terminal.' },
      { p: 'O símbolo <code>&gt;</code> desvia a saída de um comando para um arquivo. Se o arquivo não existe, ele é <strong>criado</strong>; se existe, o conteúdo antigo é <strong>substituído</strong>:' },
      { code: ['$ uname -r > kernel.txt', '$ cat kernel.txt'] },
      { p: 'O <code>cat</code> faz o contrário: mostra na tela o conteúdo de um arquivo. Foi ele que você usou há pouco para ler o <code>/etc/os-release</code>.' },
      { p: 'O símbolo <code>&gt;&gt;</code>, dobrado, <strong>acrescenta</strong> ao final em vez de substituir. É assim que se monta um arquivo com várias linhas, uma de cada comando:' },
      { code: ['$ uname -r > sistema.txt', '$ hostname >> sistema.txt', '$ cat sistema.txt'] },
      {
        table: {
          head: ['Escrita', 'O que faz com o arquivo'],
          rows: [
            ['<code>comando &gt; arquivo</code>', 'cria, ou <strong>apaga o conteúdo</strong> e escreve do zero'],
            ['<code>comando &gt;&gt; arquivo</code>', 'cria se não existir, e <strong>acrescenta</strong> ao final'],
            ['<code>cat arquivo</code>', 'mostra o conteúdo na tela']
          ]
        }
      },
      {
        box: 'warn', label: 'O <code>&gt;</code> apaga sem perguntar', body: [
          { p: 'Não existe confirmação e não existe desfazer: <code>echo teste &gt; importante.txt</code> substitui o arquivo inteiro por uma linha. Quando a intenção é acrescentar, é sempre <code>&gt;&gt;</code>. Na dúvida, dobre.' }
        ]
      },
      { p: 'Um detalhe de caminho que já vale usar: o til (<code>~</code>) é um atalho para o seu diretório pessoal. Assim, <code>~/sistema.txt</code> é o arquivo <code>sistema.txt</code> dentro da sua pasta, não importa em que diretório você esteja no momento. A aula 1.4 destrincha caminhos; por ora, basta saber disso.' },
      { p: 'Por fim, o <code>echo</code> apenas repete na tela o texto que você der a ele — o que o torna a maneira mais simples de escrever uma linha qualquer em um arquivo:' },
      { code: ['$ echo "primeira anotacao" > ~/nota.txt', '$ cat ~/nota.txt'] },

      { h2: 'Resumo' },
      {
        ul: [
          '<strong>Kernel</strong>: o programa que fala com o hardware e isola os processos. É o "Linux" propriamente dito.',
          '<strong>Distribuição</strong>: kernel + ferramentas + gerenciador de pacotes, montados e mantidos por alguém. Ex.: Ubuntu.',
          '<strong>Shell</strong>: o interpretador de comandos com o qual você conversa. Ex.: Bash.',
          'As três camadas são trocáveis de forma independente.',
          '<code>&gt;</code> manda a saída de um comando para um arquivo (substituindo), <code>&gt;&gt;</code> acrescenta ao final, e <code>cat</code> mostra o que ficou lá dentro.'
        ]
      }
    ],
    tasks: [
      {
        id: 't1-1-a', kind: 'guiado', title: 'Identifique a máquina',
        body: [
          { p: 'Antes de qualquer coisa, é bom saber onde você está. Rode os três comandos abaixo no terminal ao lado (pode clicar em <em>rodar</em>) e leia a saída com calma.' },
          { code: ['$ uname -r', '$ cat /etc/os-release', '$ hostname'] },
          { p: 'O primeiro mostra a versão do <strong>kernel</strong>. O segundo, a <strong>distribuição</strong>. O terceiro, o nome desta máquina. Três camadas, três respostas diferentes.' }
        ],
        hints: ['Clique no botão <em>rodar</em> que aparece quando você passa o mouse sobre o bloco de código.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /\buname\b/), 'Rode <code>uname -r</code> no terminal.'],
          [() => H.usedCommand(ctx, /os-release/), 'Rode <code>cat /etc/os-release</code>.'],
          [() => H.usedCommand(ctx, /\bhostname\b/), 'Rode <code>hostname</code>.']
        ])
      },
      {
        id: 't1-1-q', kind: 'quiz', title: 'Kernel, distribuição ou shell?',
        body: [{ p: 'Você digita <code>ls</code> e a lista de arquivos aparece. Quem foi <strong>fisicamente</strong> ler o diretório no disco?' }],
        options: [
          { text: 'O Bash, porque foi ele que recebeu o comando.', why: 'O Bash apenas interpretou a linha e disparou o programa <code>ls</code>. Ele não lê disco.' },
          { text: 'O programa <code>ls</code>, diretamente no disco.', why: 'O <code>ls</code> não tem permissão para tocar no hardware. Ele pede ao kernel através de chamadas de sistema.' },
          { text: 'O kernel, atendendo a uma chamada de sistema feita pelo <code>ls</code>.', correct: true },
          { text: 'A distribuição Ubuntu.', why: 'Distribuição é o conjunto empacotado; não é um programa que executa nada em tempo real.' }
        ],
        explain: 'O caminho completo é: Bash interpreta a linha → executa o binário <code>ls</code> → o <code>ls</code> faz syscalls (<code>openat</code>, <code>getdents64</code>) → o kernel lê o disco e devolve os dados → o <code>ls</code> formata e imprime.'
      },
      {
        id: 't1-1-b', kind: 'desafio', title: 'Deixe registrado o que você descobriu',
        body: [
          { p: 'Junte tudo o que esta aula mostrou em um arquivo. Crie <code>~/sistema.txt</code> com este conteúdo, <strong>nesta ordem</strong>:' },
          { ol: [
            'a versão do kernel;',
            'o nome desta máquina;',
            'o conteúdo inteiro do <code>/etc/os-release</code>, que identifica a distribuição.'
          ] },
          { p: 'Cada parte precisa vir de um <strong>comando</strong> — os três que você rodou na atividade guiada — e não ser digitada à mão. Use o <code>&gt;</code> para o primeiro (que cria o arquivo) e o <code>&gt;&gt;</code> para os outros dois (que acrescentam).' },
          { p: 'No fim, confira o resultado com <code>cat ~/sistema.txt</code>.' }
        ],
        hints: [
          'Comece com <code>uname -r &gt; ~/sistema.txt</code> e confira com <code>cat ~/sistema.txt</code>: deve ter uma linha só.',
          'As duas linhas seguintes usam <code>&gt;&gt;</code>, senão cada comando apaga o que o anterior escreveu: <code>hostname &gt;&gt; ~/sistema.txt</code> e depois <code>cat /etc/os-release &gt;&gt; ~/sistema.txt</code>.'
        ],
        solution: '<div class="code"><pre>uname -r &gt; ~/sistema.txt\nhostname &gt;&gt; ~/sistema.txt\ncat /etc/os-release &gt;&gt; ~/sistema.txt\ncat ~/sistema.txt</pre></div><p style="margin-top:8px">Repare no <code>&gt;</code> da primeira linha e no <code>&gt;&gt;</code> das seguintes: a primeira cria o arquivo do zero, as outras acrescentam ao final. Se você usar <code>&gt;</code> nas três, o arquivo termina só com a última.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/sistema.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>/home/aluno/sistema.txt</code> ainda não existe.' };
          const linhas = c.split('\n').filter(l => l.trim());
          const host = ctx.sh.m.hostname;
          return LX.H.checkAll([
            [() => linhas.length >= 3, () => `O arquivo tem ${linhas.length} linha(s) com conteúdo. Faltou alguma parte — ou você usou <code>&gt;</code> onde era <code>&gt;&gt;</code>, e cada comando apagou o anterior.`],
            [() => /6\.14\.0-27-generic/.test(c), 'Não encontrei a versão do kernel no arquivo. Ela sai de <code>uname -r</code>.'],
            [() => new RegExp(host).test(c), 'Não encontrei o nome da máquina no arquivo. Ele sai de <code>hostname</code>.'],
            [() => /Ubuntu 26\.04/.test(c), 'Não encontrei a identificação da distribuição. Ela está no <code>/etc/os-release</code>.'],
            [() => /^6\.14\.0-27-generic/.test(linhas[0] || ''), 'A primeira linha do arquivo deve ser a versão do kernel.'],
            [() => new RegExp('^' + host).test(linhas[1] || ''), 'A segunda linha do arquivo deve ser o nome da máquina.']
          ]);
        }
            }
    ]
  });

  /* ============================== 1.2 ============================== */
  LX.lesson('m01', {
    id: 'l1-2', n: '1.2', title: 'Terminal, shell e a anatomia de um comando',
    goal: 'Entender o que acontece entre você apertar Enter e o resultado aparecer — e aprender a ler qualquer comando, mesmo os que você nunca viu.',
    brief: [
      { h2: 'Leia, complete e descubra comandos' },
      { p: 'O <strong>terminal</strong> é a interface; o <strong>shell</strong> interpreta a linha. Um comando segue a forma <code>programa opções argumentos</code>. Em <code>ls -lah /etc</code>, <code>ls</code> é o programa, <code>-lah</code> reúne as opções e <code>/etc</code> é o argumento.' },
      { code: ['$ ls -lah /etc', '$ man ls', '$ history'] },
      { p: 'As opções <code>-l</code>, <code>-a</code> e <code>-h</code> significam formato longo, arquivos ocultos e tamanhos legíveis. Opções curtas podem ser agrupadas. A tecla <strong>Tab</strong> completa nomes; <code>history</code> mostra os comandos anteriores.' },
      { p: 'Quando souber o nome do comando, use <code>--help</code> ou <code>man</code>. Quando souber apenas o que precisa fazer, use <code>man -k PALAVRA</code>. A busca é em inglês.' },
      { code: ['$ man -k disk', '$ df -h'] },
      { p: 'A busca por <em>disk</em> apresenta <code>df</code>, que mostra o espaço livre. A opção <code>-h</code> deixa os tamanhos legíveis — a mesma ideia usada em <code>ls -lh</code>.' }
    ],
    body: [
      { h2: 'Terminal não é shell' },
      { p: 'Mais uma confusão comum, e vale desfazer agora:' },
      {
        ul: [
          '<strong>Terminal</strong> (ou emulador de terminal) é a <em>janela</em>: ela desenha o texto, captura o teclado, entende cores. É o painel preto aqui do lado.',
          '<strong>Shell</strong> é o <em>programa</em> que roda dentro dessa janela lendo os comandos. É o Bash.'
        ]
      },
      { p: 'A prova: você pode usar o mesmo Bash sem nenhuma janela — por SSH, num script agendado, dentro de um container. O shell é o que importa; o terminal é só o vidro.' },
      { p: '<strong>CLI</strong> (<em>Command Line Interface</em>) é o nome genérico dessa forma de interagir: você escreve, o sistema responde. Ela ganha da interface gráfica em três coisas — é repetível, é automatizável e funciona a 8 mil quilômetros de distância numa conexão ruim.' },

      { h2: 'O prompt' },
      { p: 'Aquela linha que fica te esperando é o <strong>prompt</strong>. O padrão do Ubuntu é assim:' },
      {
        ascii: `aluno@srv-aula:~$
│     │        │ │
│     │        │ └── $ = usuário comum   # = root (administrador)
│     │        └──── diretório atual (~ é o seu /home)
│     └───────────── nome da máquina
└─────────────────── seu usuário`
      },
      {
        box: 'tip', body: [
          { p: 'Aprenda a olhar para o último caractere. <code>$</code> significa que você é um usuário comum e tem poderes limitados. <code>#</code> significa que você é <strong>root</strong> e um comando errado pode destruir o sistema. Esse detalhe já evitou muito acidente.' }
        ]
      },

      { h2: 'A anatomia de um comando' },
      { p: 'Todo comando no shell segue a mesma estrutura. Depois que você enxerga o padrão, comandos desconhecidos deixam de ser intimidantes:' },
      {
        ascii: `   ls   -l  -h   /var/log
   │    │   │    │
   │    │   │    └── argumento (em quem o comando age)
   │    └───┴─────── opções / flags (como ele age)
   └────────────────  comando (o programa a executar)`
      },
      { p: 'As opções vêm em dois sabores:' },
      {
        table: {
          head: ['Forma', 'Exemplo', 'Observação'],
          rows: [
            ['Curta', '<code>-l</code>, <code>-h</code>, <code>-a</code>', 'uma letra, um hífen. Podem ser agrupadas: <code>-lha</code>'],
            ['Longa', '<code>--all</code>, <code>--human-readable</code>', 'palavra, dois hífens. Mais legível em scripts'],
            ['Com valor', '<code>-n 5</code> ou <code>--lines=5</code>', 'a opção recebe um argumento próprio']
          ]
        }
      },
      { p: 'Estas três linhas fazem exatamente a mesma coisa:' },
      { code: ['$ ls -l -a -h /etc', '$ ls -lah /etc', '$ ls --format=long --all --human-readable /etc'], run: false },
      { p: 'E o espaço é sagrado: <code>ls-l</code> não existe, <code>ls -l</code> existe. O shell separa as palavras por espaços.' },

      { h2: 'Quando você não sabe o que um comando faz' },
      { p: 'Você nunca vai decorar tudo — nem precisa. Existem três portas de saída, nesta ordem:' },
      { cmd: '--help' },
      { p: 'A mais rápida. Quase todo comando aceita e devolve um resumo em uma tela:' },
      { code: ['$ ls --help'] },
      { cmd: 'man' },
      { p: 'O manual completo, com todas as opções e detalhes de comportamento. Navegue com <span class="kbd">↓</span> <span class="kbd">↑</span>, avance com <span class="kbd">Espaço</span>, saia com <span class="kbd">q</span>:' },
      { code: ['$ man ls'] },
      { cmd: 'man -k' },
      { p: 'Quando você sabe o que quer mas não sabe o nome do comando, procure por palavra-chave. O índice do manual é em inglês, então busque em inglês (o mesmo que o comando <code>apropos</code> faz):' },
      { code: ['$ man -k copy', '$ man -k directory'] },
      {
        box: 'note', label: 'Como ler uma página de manual', body: [
          {
            ul: [
              '<code>[algo]</code> — colchetes significam <strong>opcional</strong>.',
              '<code>&lt;algo&gt;</code> ou <code>ALGO</code> — você deve substituir por um valor seu.',
              '<code>a|b</code> — a barra vertical significa "um ou outro".',
              '<code>...</code> — pode repetir quantas vezes quiser.'
            ]
          },
          { p: 'Então <code>ls [OPÇÃO]... [ARQUIVO]...</code> se lê como: "o comando <code>ls</code>, seguido de zero ou mais opções, seguido de zero ou mais arquivos".' }
        ]
      },

      { h2: 'Teclas que economizam horas' },
      {
        cheat: [
          ['Tab', 'Completa o que você começou a digitar. Aperte duas vezes para ver as opções.'],
          ['↑ / ↓', 'Percorre os comandos anteriores.'],
          ['Ctrl + C', 'Interrompe o que está rodando agora.'],
          ['Ctrl + L', 'Limpa a tela (o mesmo que <code>clear</code>).'],
          ['Ctrl + A / Ctrl + E', 'Pula para o início / fim da linha.'],
          ['Ctrl + U / Ctrl + K', 'Apaga do cursor para trás / para frente.'],
          ['Ctrl + W', 'Apaga a palavra anterior.'],
          ['Ctrl + D', 'Fim de entrada — encerra a sessão atual.']
        ]
      },
      {
        box: 'tip', label: 'A tecla mais importante', body: [
          { p: 'O <span class="kbd">Tab</span> não é só conforto: ele é sua rede de segurança contra erros de digitação. Se o Tab não completa, o caminho que você imaginou não existe. Use sempre.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Terminal é a janela; shell (Bash) é o programa que interpreta.',
          'O <code>$</code> no fim do prompt indica usuário comum; <code>#</code> indica root.',
          'Todo comando é <code>comando [opções] [argumentos]</code>, separados por espaço.',
          'Não saiu como esperava? <code>--help</code>, depois <code>man</code>, depois <code>man -k</code>.',
          '<span class="kbd">Tab</span> completa e valida ao mesmo tempo.'
        ]
      }
    ],
    tasks: [
      {
        id: 't1-2-a', kind: 'guiado', title: 'Leia um manual e use o Tab',
        body: [
          { p: 'Abra o manual do <code>ls</code>, role um pouco, e saia com <span class="kbd">q</span>:' },
          { code: ['$ man ls'] },
          { p: 'Agora experimente o Tab: digite <code>hist</code> no terminal e aperte <span class="kbd">Tab</span>. O shell completa para <code>history</code>. Aperte Enter e veja os comandos que você já rodou:' },
          { code: ['$ history'] }
        ],
        hints: ['Dentro do <code>man</code>, use <span class="kbd">Espaço</span> para avançar e <span class="kbd">q</span> para sair.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /^\s*man\s+/m), 'Abra alguma página de manual com <code>man</code>.'],
          [() => H.usedCommand(ctx, /^\s*history/m), 'Rode <code>history</code> no terminal.']
        ])
      },
      {
        id: 't1-2-f', kind: 'fill', title: 'Complete o comando',
        body: [{ p: 'Queremos listar o conteúdo de <code>/etc</code> em <strong>formato longo</strong>, incluindo <strong>arquivos ocultos</strong> e com <strong>tamanhos legíveis</strong>. Preencha as opções, agrupadas em um único argumento:' }],
        template: 'ls -___ /etc', sample: 'lah',
        answers: ['[lah]{3}'],
        hints: ['Formato longo é <code>-l</code>; ocultos é <code>-a</code>; legível para humanos é <code>-h</code>.'],
        solution: 'Qualquer ordem serve: <code>ls -lah /etc</code>, <code>ls -alh /etc</code>, <code>ls -hla /etc</code>. Opções curtas podem ser agrupadas atrás de um único hífen.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim();
          const set = new Set(v.split(''));
          if (v.length !== 3) return { ok: false, msg: 'São exatamente três letras, uma para cada requisito.' };
          return LX.H.checkAll([
            [set.has('l'), 'Falta a opção de formato longo.'],
            [set.has('a'), 'Falta a opção que mostra arquivos ocultos.'],
            [set.has('h'), 'Falta a opção que deixa os tamanhos legíveis.']
          ]);
        }
      },
      {
        id: 't1-2-b', kind: 'desafio', title: 'Use o manual para achar um comando',
        /* O objetivo é praticar o `man -k` ensinado nesta aula; o comando
           encontrado é o RESULTADO do exercício, não um pré-requisito. */
        descoberta: true,
        body: [
          { p: 'Este desafio é sobre a ferramenta que você acabou de ver: a <strong>busca por palavra-chave no manual</strong>, <code>man -k</code>. Ela existe justamente para as horas em que você sabe o que precisa fazer, mas não sabe o nome do comando.' },
          { p: 'Existe no sistema um comando que mostra quanto espaço em disco está livre. Ache-o com <code>man -k</code>, leia a descrição de uma linha que a busca devolve, e execute-o com a opção de tamanho legível — a mesma letra que você usou no <code>ls -lh</code> desta aula.' }
        ],
        hints: [
          'A busca por palavra-chave é <code>man -k &lt;palavra&gt;</code>. Em inglês, espaço em disco é <em>disk space</em>; tente <code>man -k disk</code>.',
          'O comando começa com a letra <strong>d</strong> e tem duas letras. A opção de tamanho legível é a mesma do <code>ls</code>.'
        ],
        solution: '<div class="code"><pre>man -k disk\ndf -h</pre></div><p style="margin-top:8px"><code>df</code> vem de <em>disk free</em>. Sem o <code>-h</code> ele mostra blocos de 1 KB, que ninguém consegue ler de cabeça.</p>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /man\s+-k|apropos/), 'Use a busca por palavra-chave no manual antes de adivinhar.'],
          [() => H.usedCommand(ctx, /^\s*df\b.*-h|^\s*df\s+-h/m), 'Ainda não vi o comando certo com a opção de tamanho legível.']
        ])
      }
    ]
  });

  /* ============================== 1.3 ============================== */
  LX.lesson('m01', {
    id: 'l1-3', n: '1.3', title: 'A árvore de diretórios',
    goal: 'Entender por que o Linux não tem C: nem D:, o que é a raiz / e como o FHS torna qualquer servidor Linux previsível.',
    brief: [
      { h2: 'Explore a árvore e transforme respostas em arquivo' },
      { p: 'No Linux, tudo parte da raiz <code>/</code>. O padrão FHS coloca configurações em <code>/etc</code>, arquivos dos usuários em <code>/home</code>, dados variáveis e logs em <code>/var</code> e programas em <code>/usr</code>.' },
      { code: ['$ ls /', '$ ls /etc | head -20', '$ ls /var/log', '$ ls /home'] },
      { p: 'O pipe <code>|</code> envia a saída da esquerda para o comando da direita; acima, <code>head -20</code> limita a listagem. <code>grep PALAVRA ARQUIVO</code> seleciona uma linha e <code>wc -l &lt; ARQUIVO</code> conta suas linhas imprimindo apenas o número.' },
      { p: 'A prática reúne dados de três arquivos do sistema. Use <code>&gt;</code> na primeira resposta e <code>&gt;&gt;</code> nas seguintes para não apagar o que já foi gravado.' },
      { code: ['$ grep VERSION_CODENAME /etc/os-release > ~/investigacao.txt', '$ wc -l < /etc/passwd >> ~/investigacao.txt', '$ cat /etc/timezone >> ~/investigacao.txt'] }
    ],
    body: [
      { h2: 'Uma única árvore' },
      { p: 'No Windows, cada disco ganha uma letra e vira uma árvore separada. No Linux existe <strong>uma árvore só</strong>, que começa em <code>/</code> — a raiz. Todo o resto pendura nela.' },
      { p: 'Um segundo disco não vira "D:". Ele é <strong>montado</strong> em algum ponto da árvore, por exemplo <code>/mnt/backup</code>, e a partir daí você usa esse caminho normalmente, sem pensar em qual hardware está por baixo.' },
      {
        ascii: `                      /
     ┌────────┬─────────┼─────────┬────────┬────────┐
   /bin     /etc      /home     /var     /usr     /tmp
                        │
                   ┌────┴────┐
                 aluno      maria
                   │
        ┌──────────┼──────────┐
   documentos  downloads   projetos`
      },
      { p: 'Essa unificação é o motivo de um script escrito para um servidor funcionar em outro: o caminho <code>/etc/ssh/sshd_config</code> significa a mesma coisa em qualquer máquina Linux, independentemente de quantos discos ela tem.' },

      { h2: 'FHS: o mapa combinado' },
      { p: 'O <strong>FHS</strong> (<em>Filesystem Hierarchy Standard</em>) é o acordo que define o que vai em cada diretório. Não é uma regra do kernel — é uma convenção que todas as distribuições seguem. Por causa dela, você sabe onde procurar as coisas mesmo em um servidor que nunca viu.' },
      {
        table: {
          head: ['Diretório', 'O que guarda', 'Você mexe?'],
          rows: [
            ['<code>/</code>', 'A raiz. Ponto de partida de tudo.', 'raramente'],
            ['<code>/home</code>', 'Pastas pessoais dos usuários (<code>/home/aluno</code>).', '<strong>o tempo todo</strong>'],
            ['<code>/root</code>', 'A pasta pessoal do usuário root. Não confunda com <code>/</code>.', 'só como root'],
            ['<code>/etc</code>', 'Arquivos de <strong>configuração</strong> do sistema, em texto puro.', '<strong>muito</strong>'],
            ['<code>/var</code>', 'Dados que <strong>variam</strong>: logs, filas, bancos, caches.', '<strong>muito</strong>'],
            ['<code>/tmp</code>', 'Temporários. Apagado no boot. Qualquer um escreve.', 'às vezes'],
            ['<code>/usr</code>', 'Programas e bibliotecas instalados pela distribuição.', 'via apt'],
            ['<code>/opt</code>', 'Software de terceiros instalado fora do apt.', 'às vezes'],
            ['<code>/bin</code>, <code>/sbin</code>', 'Executáveis essenciais / de administração.', 'não'],
            ['<code>/lib</code>', 'Bibliotecas compartilhadas.', 'não'],
            ['<code>/dev</code>', 'Dispositivos representados como arquivos.', 'raramente'],
            ['<code>/proc</code>', 'Janela viva para os processos e o kernel.', 'leitura'],
            ['<code>/sys</code>', 'Janela viva para dispositivos e drivers.', 'leitura'],
            ['<code>/mnt</code>, <code>/media</code>', 'Pontos de montagem manual / automática.', 'às vezes'],
            ['<code>/srv</code>', 'Dados servidos por serviços da máquina.', 'às vezes'],
            ['<code>/boot</code>', 'Kernel e carregador de boot.', 'quase nunca']
          ]
        }
      },
      { p: 'Vamos olhar de verdade:' },
      { code: ['$ ls /'] },
      {
        box: 'key', label: 'A regra de ouro', body: [
          { p: 'Configuração vai em <code>/etc</code>. Dado que muda vai em <code>/var</code>. Programa vai em <code>/usr</code>. Seus arquivos vão em <code>/home</code>. Noventa por cento das dúvidas de "onde fica isso?" morrem nessa frase.' }
        ]
      },

      { h2: 'Tudo é um arquivo' },
      { p: 'Esta é a ideia mais estranha e mais poderosa do Unix: quase tudo é exposto como um arquivo, com caminho, dono e permissões.' },
      {
        ul: [
          'Um documento de texto é um arquivo. Óbvio.',
          'Um <strong>diretório</strong> é um arquivo — que contém uma lista de nomes.',
          'Seu <strong>disco</strong> é um arquivo: <code>/dev/vda</code>.',
          'O <strong>terminal</strong> em que você está é um arquivo: <code>/dev/pts/0</code>.',
          'Um <strong>processo em execução</strong> aparece como diretório em <code>/proc/&lt;pid&gt;</code>.',
          '<code>/dev/null</code> é o buraco negro: tudo que você escrever ali some.'
        ]
      },
      { p: 'A consequência prática é enorme: as mesmas ferramentas (<code>cat</code>, <code>grep</code>, <code>&gt;</code>) servem para ler um texto, consultar a memória do sistema ou configurar um driver. Você aprende um vocabulário pequeno e ele funciona em todo lugar.' },

      { h2: 'Nomes: o que o Linux não perdoa' },
      {
        ul: [
          '<strong>Maiúsculas importam.</strong> <code>Notas.txt</code>, <code>notas.txt</code> e <code>NOTAS.TXT</code> são três arquivos distintos.',
          '<strong>Extensão não significa nada</strong> para o sistema. <code>.txt</code>, <code>.sh</code>, <code>.log</code> são convenções para humanos. Quem decide se um arquivo pode ser executado é a permissão, não o nome.',
          '<strong>Arquivos que começam com ponto são ocultos</strong> (<code>.bashrc</code>). Não é segurança, é só o <code>ls</code> escondendo; use <code>ls -a</code> para vê-los.',
          '<strong>Espaço no nome dá dor de cabeça.</strong> Prefira <code>meu-relatorio.txt</code> a <code>meu relatorio.txt</code>.'
        ]
      },
      {"h2": "Contar linhas e guardar uma investigação"},
      {"p": "<code>wc -l</code> conta quebras de linha. Em /etc/passwd, cada conta ocupa uma linha. <code>wc -l /etc/passwd</code> mostra a quantidade e o nome do arquivo; <code>wc -l &lt; /etc/passwd</code> fornece o arquivo pela entrada padrão e imprime apenas a quantidade. O símbolo &lt; é um redirecionamento de entrada, não faz parte do nome do arquivo."},
      {"p": "Para montar um relatório, <code>&gt;</code> grava a saída substituindo o destino; <code>&gt;&gt;</code> acrescenta ao fim. Use &gt; só na primeira linha e &gt;&gt; nas seguintes para preservar as respostas anteriores. Isso não altera os arquivos de sistema que você está lendo."},
      {"code": ["$ wc -l /etc/passwd", "$ wc -l < /etc/passwd"]},
    ],
    tasks: [
      {
        id: 't1-3-a', kind: 'guiado', title: 'Explore a raiz',
        body: [
          { p: 'Liste a raiz e depois espie três diretórios importantes. Repare que <code>/etc</code> é cheio de texto, <code>/var/log</code> é cheio de log e <code>/home</code> tem uma pasta por usuário.' },
          { code: ['$ ls /', '$ ls /etc | head -20', '$ ls /var/log', '$ ls /home'] }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ls\s+\/etc/), 'Liste o conteúdo de <code>/etc</code>.'],
          [() => H.usedCommand(ctx, /ls\s+\/var\/log/), 'Liste o conteúdo de <code>/var/log</code>.']
        ])
      },
      {
        id: 't1-3-q', kind: 'quiz', title: 'Onde isso deveria estar?',
        body: [{ p: 'Você instalou um servidor web. Ele tem um arquivo <code>servidor.conf</code> que define em qual porta escutar, e grava um <code>acesso.log</code> a cada requisição. Segundo o FHS, onde cada um deveria ficar?' }],
        options: [
          { text: '<code>servidor.conf</code> em <code>/etc</code> e <code>acesso.log</code> em <code>/var/log</code>.', correct: true },
          { text: 'Os dois em <code>/etc</code>, já que pertencem ao mesmo programa.', why: '<code>/etc</code> é só para configuração. Log é dado que cresce sem parar — encher o <code>/etc</code> é um problema clássico.' },
          { text: 'Os dois em <code>/home/aluno</code>, para ficarem à mão.', why: '<code>/home</code> é para arquivos pessoais. Um serviço do sistema não deve depender da pasta de um usuário, que pode até ser apagada.' },
          { text: '<code>servidor.conf</code> em <code>/usr</code> e <code>acesso.log</code> em <code>/tmp</code>.', why: '<code>/usr</code> guarda os binários e é tratado como somente leitura; <code>/tmp</code> é apagado no boot — seu log sumiria.' }
        ],
        explain: 'Configuração em <code>/etc</code>, dado variável em <code>/var</code>. É exatamente por isso que o nginx real guarda <code>/etc/nginx/nginx.conf</code> e <code>/var/log/nginx/access.log</code>.'
      },
      {
        id: 't1-3-b', kind: 'desafio', title: 'Descubra a máquina lendo o disco',
        body: [
          { p: 'Sem usar nenhum comando novo além dos que você já viu, responda a estas três perguntas <strong>lendo arquivos do sistema</strong> e grave as respostas em <code>~/investigacao.txt</code>, uma por linha:' },
          {
            ol: [
              'Qual é o <strong>codinome</strong> desta versão do Ubuntu? (está em <code>/etc/os-release</code>)',
              'Quantos <strong>usuários</strong> estão cadastrados na máquina? (uma linha por usuário em <code>/etc/passwd</code>)',
              'Qual o <strong>fuso horário</strong> configurado? (há um arquivo em <code>/etc</code> com exatamente esse nome)'
            ]
          },
          { p: 'A resposta 2 deve ser um número. Descubra como contar linhas sem contar no olho.' }
        ],
        hints: [
          'Para ver o conteúdo de um arquivo: <code>cat /caminho/arquivo</code>. Para filtrar uma linha: <code>grep PALAVRA arquivo</code>.',
          'Para contar linhas existe o <code>wc -l</code>. Ele pode receber um arquivo: <code>wc -l /etc/passwd</code>. E lembre do <code>&gt;&gt;</code> para acrescentar ao arquivo.'
        ],
        solution: '<div class="code"><pre>grep VERSION_CODENAME /etc/os-release &gt;  ~/investigacao.txt\nwc -l &lt; /etc/passwd                    &gt;&gt; ~/investigacao.txt\ncat /etc/timezone                      &gt;&gt; ~/investigacao.txt</pre></div><p style="margin-top:8px">O codinome é <code>resolute</code> e o fuso é <code>America/Sao_Paulo</code>. O <code>wc -l &lt; arquivo</code> imprime só o número, sem repetir o nome do arquivo.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/investigacao.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/investigacao.txt ainda não existe.' };
          const nUsers = (H.read(ctx, '/etc/passwd') || '').split('\n').filter(Boolean).length;
          return LX.H.checkAll([
            [/resolute/i.test(c), 'Não encontrei o codinome da versão. Procure por <code>VERSION_CODENAME</code> em /etc/os-release.'],
            [new RegExp('(^|\\s)' + nUsers + '(\\s|$)', 'm').test(c), `Não encontrei o número de usuários (deveria ser ${nUsers}). Conte as linhas de /etc/passwd com <code>wc -l</code>.`],
            [/America\/Sao_Paulo/.test(c), 'Não encontrei o fuso horário. Ele está em /etc/timezone.']
          ]);
        }
      }
    ]
  });

  /* ============================== 1.4 ============================== */
  LX.lesson('m01', {
    id: 'l1-4', n: '1.4', title: 'Caminhos: absolutos, relativos e atalhos',
    goal: 'Nunca mais se perder. Depois desta aula você sabe exatamente para onde um caminho aponta antes mesmo de apertar Enter.',
    brief: [
      { h2: 'Descubra de onde o caminho parte' },
      { p: 'Caminho <strong>absoluto</strong> começa com <code>/</code> e sempre parte da raiz. Caminho <strong>relativo</strong> parte do diretório atual, mostrado por <code>pwd</code>.' },
      { code: ['$ cd /', '$ cd var/log', '$ pwd', '$ cd ../..', '$ cd ~', '$ cd -'] },
      { p: '<code>.</code> significa o diretório atual, <code>..</code> sobe um nível, <code>~</code> representa seu diretório pessoal e <code>cd -</code> volta ao diretório anterior. Os atalhos podem ser encadeados: <code>../..</code> sobe dois níveis.' },
      { p: 'Para sair de <code>/home/aluno/projetos/site</code> e chegar a <code>/var/log</code> sem caminho absoluto, conte quatro níveis até a raiz e depois desça novamente:' },
      { code: ['$ cd /home/aluno/projetos/site', '$ cd ../../../../var/log', '$ pwd'] }
    ],
    body: [
      { h2: 'Duas formas de dizer onde algo está' },
      { p: 'Todo caminho no Linux é <strong>absoluto</strong> ou <strong>relativo</strong>, e a diferença é uma só: <strong>começa com <code>/</code> ou não</strong>.' },
      {
        table: {
          head: ['Tipo', 'Começa com', 'Ponto de partida', 'Exemplo'],
          rows: [
            ['<strong>Absoluto</strong>', '<code>/</code>', 'a raiz — sempre o mesmo lugar', '<code>/home/aluno/documentos/notas.txt</code>'],
            ['<strong>Relativo</strong>', 'qualquer outra coisa', 'o diretório onde você está agora', '<code>documentos/notas.txt</code>']
          ]
        }
      },
      { p: 'Pense em endereço postal. O absoluto é "Rua das Flores, 120, São Paulo, Brasil" — funciona de onde quer que você esteja. O relativo é "a terceira porta à direita" — só faz sentido se souberem onde você está parado.' },
      { p: 'Descubra onde você está com <code>pwd</code> (<em>print working directory</em>):' },
      { code: ['$ pwd'] },

      { h2: 'Os quatro atalhos' },
      {
        cheat: [
          ['.', 'O diretório atual. <code>./script.sh</code> = "o script aqui desta pasta".'],
          ['..', 'O diretório pai, um nível acima.'],
          ['~', 'Seu diretório pessoal. Para você é <code>/home/aluno</code>.'],
          ['-', 'O diretório <em>anterior</em>. <code>cd -</code> volta de onde você veio.']
        ]
      },
      { p: 'Eles se combinam livremente. Todos os caminhos abaixo levam ao mesmo arquivo, se você estiver em <code>/home/aluno/projetos</code>:' },
      {
        code: [
          '/home/aluno/documentos/notas.txt      # absoluto',
          '../documentos/notas.txt               # sobe um nível e desce',
          '~/documentos/notas.txt                # a partir do seu home',
          '/home/aluno/./documentos/notas.txt    # o "." no meio não muda nada'
        ], run: false, mixed: false
      },

      { h2: 'Andando pela árvore' },
      { p: 'O comando é <code>cd</code> (<em>change directory</em>). Vale a pena praticar até virar reflexo:' },
      {
        code: [
          '$ cd /var/log',
          '$ pwd',
          '$ cd ..',
          '$ pwd',
          '$ cd ~/documentos',
          '$ pwd',
          '$ cd -',
          '$ pwd',
          '$ cd',
          '$ pwd'
        ]
      },
      { p: 'Repare no penúltimo: <code>cd</code> sozinho, sem argumento nenhum, sempre te leva para casa. É a tecla de pânico quando você se perdeu.' },
      {
        box: 'tip', body: [
          { p: 'Enquanto você não tem o mapa na cabeça, use caminhos <strong>absolutos</strong>. Eles são mais longos, mas nunca dependem de onde você está — e é justamente a dúvida sobre "onde eu estou" que causa a maioria dos acidentes com <code>rm</code>.' }
        ]
      },

      { h2: 'Um detalhe que confunde todo mundo' },
      { p: 'Por que <code>./script.sh</code> e não simplesmente <code>script.sh</code>?' },
      { p: 'Porque quando você digita um nome sem barra, o Bash não procura na pasta atual: ele procura nas pastas listadas na variável <code>PATH</code> (que veremos no módulo 14). O diretório atual <strong>não</strong> está no PATH, de propósito — se estivesse, alguém poderia deixar um arquivo chamado <code>ls</code> numa pasta e sequestrar seu comando.' },
      { p: 'Então o <code>./</code> é você dizendo explicitamente: "execute este arquivo <strong>daqui</strong>, e não o programa de mesmo nome do sistema".' },

      { h2: 'Resumo' },
      {
        ul: [
          'Começa com <code>/</code>? É absoluto e vale de qualquer lugar. Não começa? É relativo ao <code>pwd</code>.',
          '<code>.</code> = aqui · <code>..</code> = acima · <code>~</code> = meu home · <code>-</code> = onde eu estava',
          '<code>cd</code> sem argumento volta para o home.',
          '<code>./programa</code> executa o arquivo local; <code>programa</code> procura no PATH.'
        ]
      }
    ],
    tasks: [
      {
        id: 't1-4-a', kind: 'guiado', title: 'Um passeio guiado',
        body: [
          { p: 'Rode a sequência abaixo prestando atenção ao <code>pwd</code> depois de cada movimento. Tente <strong>prever</strong> a resposta antes de ler.' },
          { code: ['$ cd /', '$ pwd', '$ cd var/log', '$ pwd', '$ cd ../..', '$ pwd', '$ cd ~', '$ pwd'] },
          { p: 'Na terceira linha usamos <code>var/log</code> sem barra inicial — caminho relativo, que funcionou porque estávamos exatamente em <code>/</code>. Do seu home ele daria erro.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /^\s*cd\s+\/\s*$/m), 'Vá até a raiz com <code>cd /</code>.'],
          [() => H.usedCommand(ctx, /^\s*cd\s+\.\.(\/\.\.)?\s*$/m), 'Use <code>cd ..</code> para subir um nível.'],
          [() => H.usedCommand(ctx, /^\s*pwd\s*$/m), 'Use <code>pwd</code> para confirmar onde você está.']
        ])
      },
      {
        id: 't1-4-p', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Você está em <code>/home/aluno/projetos/site</code> e executa:' },
          { code: ['cd ../../documentos'], run: false, mixed: false },
          { p: 'Onde você vai parar?' }
        ],
        options: [
          { text: '<code>/home/aluno/documentos</code>', correct: true },
          { text: '<code>/home/aluno/projetos/documentos</code>', why: 'Isso seria com um único <code>..</code>. São dois, então subimos dois níveis: de <code>site</code> para <code>projetos</code>, e de <code>projetos</code> para <code>aluno</code>.' },
          { text: '<code>/home/documentos</code>', why: 'Seriam necessários três <code>..</code> para chegar em <code>/home</code>.' },
          { text: 'Erro: não se pode usar <code>..</code> duas vezes.', why: 'Pode sim, e é bem comum. <code>../../..</code> também é válido.' }
        ],
        explain: 'Conte um nível por <code>..</code>: <code>site</code> → <code>projetos</code> → <code>aluno</code>. Depois desce em <code>documentos</code>. Resultado: <code>/home/aluno/documentos</code>.'
      },
      {
        id: 't1-4-b', kind: 'desafio', title: 'Chegue lá sem usar caminho absoluto',
        body: [
          { p: 'Vá até <code>/home/aluno/projetos/site</code>. A partir dali, e <strong>sem digitar nenhum caminho que comece com <code>/</code> ou com <code>~</code></strong>, faça o terminal terminar dentro de <code>/var/log</code>.' },
          { p: 'Depois confirme com <code>pwd</code>. O objetivo é você sentir na prática quantos níveis existem entre um ponto e outro.' }
        ],
        hints: [
          'De <code>/home/aluno/projetos/site</code> até a raiz são quatro níveis: site → projetos → aluno → home → /.',
          'Você pode encadear tudo em um comando só: <code>cd ../../../../var/log</code>.'
        ],
        solution: '<div class="code"><pre>cd /home/aluno/projetos/site\ncd ../../../../var/log\npwd</pre></div><p style="margin-top:8px">Quatro <code>..</code> levam de <code>site</code> até <code>/</code>; a partir dali, <code>var/log</code> é relativo e desce de novo.</p>',
        check: async (ctx) => {
          const usouRelativo = (ctx.term.history || []).some(h => /^\s*cd\s+(\.\.\/){3,}var\/log/.test(h));
          return LX.H.checkAll([
            [ctx.sh.cwd === '/var/log', `Você está em <code>${ctx.sh.cwd}</code>. O destino é <code>/var/log</code>.`],
            [usouRelativo, 'Você chegou lá, mas usando caminho absoluto. Refaça o percurso usando apenas <code>..</code> a partir de /home/aluno/projetos/site.']
          ]);
        }
      }
    ]
  });

  /* ============================== 1.5 ============================== */
  LX.lesson('m01', {
    id: 'l1-5', n: '1.5', title: 'Os diretórios do sistema, um por um',
    goal: 'Saber o que existe dentro de /etc, /var, /usr e /opt — e por que você vai passar boa parte da sua vida de administrador nesses quatro lugares.',
    brief: [
      { h2: 'Escolha o diretório e meça o servidor' },
      { ul: [
        '<code>/etc</code>: configurações do sistema e dos serviços.',
        '<code>/var</code>: dados que mudam, como logs e caches.',
        '<code>/usr</code>: programas, bibliotecas e arquivos compartilhados.',
        '<code>/opt</code>: aplicações instaladas fora do gerenciador de pacotes.'
      ] },
      { p: '<code>df -h /</code> mostra o uso do sistema de arquivos; <code>du -sh DIRETÓRIO</code> soma o tamanho de uma pasta. Assim, <code>df</code> responde “o disco está cheio?” e <code>du</code> ajuda a descobrir “cheio de quê?”.' },
      { code: ['$ df -h /', '$ du -sh /var', '$ du -sh /var/log', '$ du -sh /usr'] },
      { p: 'Para contar entradas, envie a listagem para <code>wc -l</code> com um pipe. Monte o relatório com <code>&gt;</code> na primeira linha e <code>&gt;&gt;</code> nas demais.' },
      { code: ['$ ls /usr/bin | wc -l > ~/retrato.txt', '$ du -sh /var /var/log >> ~/retrato.txt', '$ ls /lib/systemd/system | wc -l >> ~/retrato.txt', '$ df -h / >> ~/retrato.txt'] }
    ],
    body: [
      { h2: '/etc — a sala de controle' },
      { p: 'Tudo o que configura o comportamento do sistema mora aqui, em <strong>arquivos de texto puro</strong>. Não há registro binário, não há banco de configurações: você abre com um editor, muda uma linha, reinicia o serviço.' },
      {
        table: {
          head: ['Arquivo', 'Para que serve'],
          rows: [
            ['<code>/etc/passwd</code>', 'Lista de usuários (apesar do nome, sem senhas).'],
            ['<code>/etc/shadow</code>', 'As senhas, criptografadas. Só o root lê.'],
            ['<code>/etc/group</code>', 'Os grupos e quem pertence a cada um.'],
            ['<code>/etc/hosts</code>', 'Tradução manual de nomes para IPs, antes do DNS.'],
            ['<code>/etc/resolv.conf</code>', 'Quais servidores DNS a máquina consulta.'],
            ['<code>/etc/fstab</code>', 'O que montar automaticamente no boot.'],
            ['<code>/etc/ssh/sshd_config</code>', 'Configuração do servidor SSH.'],
            ['<code>/etc/sudoers</code>', 'Quem pode usar <code>sudo</code> e para quê.'],
            ['<code>/etc/crontab</code>', 'Tarefas agendadas do sistema.'],
            ['<code>/etc/os-release</code>', 'Identificação da distribuição.']
          ]
        }
      },
      { code: ['$ ls /etc | head -30', '$ cat /etc/hosts'] },
      {
        box: 'tip', label: 'Antes de editar', body: [
          { p: 'Faça uma cópia. <code>sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak</code> custa dois segundos e já salvou muita gente de perder acesso a um servidor remoto.' }
        ]
      },

      { h2: '/var — o que cresce' },
      { p: '<em>Variable</em>: dados que mudam de tamanho enquanto a máquina funciona. É o diretório que mais causa incidentes, porque enche.' },
      {
        table: {
          head: ['Caminho', 'Conteúdo'],
          rows: [
            ['<code>/var/log</code>', 'Todos os logs do sistema e dos serviços. <strong>Primeiro lugar para procurar quando algo quebra.</strong>'],
            ['<code>/var/lib</code>', 'Estado dos programas: bancos de dados, imagens Docker, cache do apt.'],
            ['<code>/var/www</code>', 'Convenção para arquivos de sites.'],
            ['<code>/var/cache</code>', 'Cache que pode ser descartado sem perder dados.'],
            ['<code>/var/spool</code>', 'Filas: impressão, e-mail, cron.'],
            ['<code>/var/tmp</code>', 'Temporários que sobrevivem ao reboot (diferente de <code>/tmp</code>).']
          ]
        }
      },
      { code: ['$ ls /var', '$ ls /var/log', '$ du -sh /var/log'] },
      {
        box: 'warn', label: 'O clássico', body: [
          { p: 'Serviço parou de funcionar do nada, sem ninguém ter mexido? Rode <code>df -h</code>. Em uma quantidade absurda de casos a resposta é <code>/var</code> a 100%, com um log que cresceu sem rotação. O programa não conseguiu escrever e morreu.' }
        ]
      },

      { h2: '/usr — os programas' },
      { p: 'Apesar do nome sugerir "user", hoje significa <em>Unix System Resources</em>. É onde vive quase todo o software instalado pela distribuição — e é tratado como somente leitura no dia a dia: quem escreve ali é o <code>apt</code>.' },
      {
        ul: [
          '<code>/usr/bin</code> — os programas que você usa: <code>ls</code>, <code>grep</code>, <code>python3</code>, <code>docker</code>.',
          '<code>/usr/sbin</code> — programas de administração: <code>useradd</code>, <code>sshd</code>, <code>nginx</code>.',
          '<code>/usr/lib</code> — bibliotecas compartilhadas.',
          '<code>/usr/share</code> — dados independentes de arquitetura: manuais, ícones, traduções.',
          '<code>/usr/local</code> — <strong>seu</strong> território: software compilado ou instalado à mão fica aqui, para não brigar com o apt.'
        ]
      },
      { code: ['$ ls /usr/bin | wc -l', '$ which ls', '$ which docker'] },
      {
        box: 'note', label: 'Por que /bin e /usr/bin são a mesma coisa', body: [
          { p: 'Historicamente <code>/bin</code> guardava o essencial para dar boot e <code>/usr/bin</code> o resto. Isso deixou de fazer sentido e, desde o Ubuntu 20.04, <code>/bin</code>, <code>/sbin</code> e <code>/lib</code> são apenas <strong>links simbólicos</strong> para os equivalentes dentro de <code>/usr</code>. É o chamado <em>usrmerge</em>. Se você ver os dois caminhos, não se assuste: apontam para o mesmo lugar.' }
        ]
      },

      { h2: '/opt, /srv, /tmp e o resto' },
      {
        ul: [
          '<code>/opt</code> — software de terceiros que vem em um pacotão próprio, geralmente em <code>/opt/nome-do-produto</code>. Não é gerenciado pelo apt.',
          '<code>/srv</code> — dados que a máquina <em>serve</em> para fora. Pouco usado na prática; muita gente prefere <code>/var/www</code>.',
          '<code>/tmp</code> — temporários. Qualquer usuário escreve, e o sistema limpa no boot. <strong>Nunca guarde nada importante aqui.</strong>',
          '<code>/mnt</code> — ponto de montagem manual, para quando você pluga um disco.',
          '<code>/media</code> — onde o sistema monta pendrives e mídias automaticamente.',
          '<code>/boot</code> — o kernel e o GRUB. Mexer errado aqui impede a máquina de ligar.'
        ]
      },

      { h2: 'Resumo' },
      {
        cheat: [
          ['/etc', 'configuração — texto puro, faça backup antes de editar'],
          ['/var/log', 'logs — seu primeiro destino quando algo quebra'],
          ['/var/lib', 'estado dos programas — bancos, docker, apt'],
          ['/usr/bin', 'os programas do sistema'],
          ['/usr/local', 'o que você instala à mão'],
          ['/opt', 'software de terceiros em pacote próprio'],
          ['/tmp', 'descartável, some no boot']
        ]
      },
      {"h2": "Comparar tamanhos sem adivinhar"},
      {"p": "Um pipe, escrito <code>|</code>, envia a saída de um comando para a entrada do seguinte. <code>ls /usr/bin | wc -l</code> lista as entradas e conta as linhas. Para ordenar tamanhos, <code>du -a /var/log</code> inclui arquivos, não somente diretórios; <code>sort -n</code> compara números em vez de ordenar como texto. <code>tail -3</code> mostra as três últimas linhas, que serão as maiores depois da ordenação crescente."},
      {"p": "A saída de du inclui totais de diretórios: escolha a maior linha que representa um arquivo, sem confundir /var/log com um arquivo individual. <code>df -h</code> mostra espaço dos sistemas de arquivos em unidades legíveis. A coluna Use% responde se algum disco ultrapassou 80%; um arquivo grande e um disco cheio são observações diferentes."},
      {"code": ["$ du -a /var/log | sort -n | tail -3", "$ df -h"]},
    ],
    tasks: [
      {
        id: 't1-5-a', kind: 'guiado', title: 'Meça o que ocupa espaço',
        body: [
          { p: 'Uma habilidade de administrador: descobrir rapidamente quem está ocupando o disco. Compare o total com os pedaços:' },
          { code: ['$ df -h /', '$ du -sh /var', '$ du -sh /var/log', '$ du -sh /usr'] },
          { p: '<code>df</code> pergunta ao sistema de arquivos quanto resta. <code>du</code> soma o tamanho dos arquivos de um diretório. Os dois juntos respondem "está cheio?" e "cheio de quê?".' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /^\s*df\b/m), 'Rode <code>df -h /</code>.'],
          [() => H.usedCommand(ctx, /^\s*du\b.*var/m), 'Rode <code>du -sh /var</code>.']
        ])
      },
      {
        id: 't1-5-q', kind: 'quiz', title: 'Instalação fora do apt',
        body: [{ p: 'Você baixou um programa comercial que vem como um pacotão com binário, bibliotecas e configuração próprios, e não está em nenhum repositório. Segundo a convenção, onde ele deveria ser instalado?' }],
        options: [
          { text: 'Em <code>/opt/nome-do-programa</code>.', correct: true },
          { text: 'Em <code>/usr/bin</code>, junto com os outros programas.', why: '<code>/usr</code> é território do gerenciador de pacotes. Um arquivo estranho ali pode ser sobrescrito ou apagado numa atualização.' },
          { text: 'Em <code>/etc</code>, porque tem arquivos de configuração.', why: '<code>/etc</code> guarda <em>apenas</em> configuração, nunca binários.' },
          { text: 'Em <code>/var/lib</code>.', why: '<code>/var/lib</code> guarda o <em>estado</em> gerado pelos programas, não o programa em si.' }
        ],
        explain: '<code>/opt</code> existe exatamente para isso: software de terceiros autocontido, que não segue a divisão bin/lib/share do FHS. Se você mesmo compilou algo, o lugar é <code>/usr/local</code>.'
      },
      {
        id: 't1-5-b', kind: 'desafio', title: 'Levante um retrato do servidor',
        body: [
          { p: 'Você acabou de receber acesso a um servidor desconhecido. Monte um arquivo <code>~/retrato.txt</code> respondendo, em qualquer formato legível:' },
          {
            ol: [
              'Quantos arquivos existem em <code>/usr/bin</code>?',
              'Quanto espaço <code>/var</code> ocupa e quanto desse total está em <code>/var/log</code>?',
              'Quantas entradas existem em <code>/lib/systemd/system</code>?',
              'Quanto do sistema de arquivos raiz está ocupado?'
            ]
          },
          { p: 'Use exatamente as peças apresentadas antes da atividade: <code>ls</code>, <code>wc</code>, <code>du</code>, <code>df</code>, <code>&gt;</code> e <code>&gt;&gt;</code>.' }
        ],
        hints: [
          'Para contar itens: <code>ls DIRETÓRIO | wc -l</code>. Use esse formato em <code>/usr/bin</code> e <code>/lib/systemd/system</code>.',
          'Um único <code>du -sh /var /var/log</code> mostra os dois tamanhos. Finalize com <code>df -h /</code>.'
        ],
        solution: '<div class="code"><pre>ls /usr/bin | wc -l                      &gt;  ~/retrato.txt\ndu -sh /var /var/log                     &gt;&gt; ~/retrato.txt\nls /lib/systemd/system | wc -l           &gt;&gt; ~/retrato.txt\ndf -h /                                  &gt;&gt; ~/retrato.txt</pre></div><p style="margin-top:8px">Cada resposta usa somente os comandos apresentados na leitura direta e na atividade guiada.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/retrato.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/retrato.txt ainda não existe.' };
          const n = (H.ls(ctx, '/usr/bin') || []).length;
          const servicos = (H.ls(ctx, '/lib/systemd/system') || []).length;
          const temNumeroBin = new RegExp('\\b' + n + '\\b').test(c) || new RegExp('\\b' + (n - 1) + '\\b').test(c) || new RegExp('\\b' + (n + 1) + '\\b').test(c);
          return LX.H.checkAll([
            [c.split('\n').filter(l => l.trim()).length >= 4, 'O arquivo tem poucas linhas. Ele deve conter as respostas das quatro perguntas.'],
            [temNumeroBin, `Não encontrei a contagem de arquivos de /usr/bin (deveria ser ${n}). Use <code>ls /usr/bin | wc -l</code>.`],
            [/\/var\b/.test(c) && /\/var\/log\b/.test(c), 'Não encontrei os tamanhos de /var e /var/log. Use <code>du -sh /var /var/log</code>.'],
            [new RegExp('\\b' + servicos + '\\b').test(c), `Não encontrei a contagem de /lib/systemd/system (deveria ser ${servicos}).`],
            [/%|\/dev\/vda|Filesystem/.test(c), 'Não encontrei a saída do <code>df</code> com o uso dos discos.']
          ]);
        }
      }
    ]
  });

  /* ============================== 1.6 ============================== */
  LX.lesson('m01', {
    id: 'l1-6', n: '1.6', title: '/proc, /sys e /dev: o kernel como arquivo',
    goal: 'Conhecer os três diretórios que não existem no disco — e usar isso para inspecionar a máquina sem instalar nada.',
    brief: [
      { h2: 'Leia o kernel e monte um relatório de saúde' },
      { p: '<code>/proc</code> e <code>/sys</code> são sistemas de arquivos virtuais: o kernel gera o conteúdo quando você lê. <code>/proc</code> expõe processos e métricas; <code>/sys</code>, dispositivos e drivers; <code>/dev</code>, interfaces para dispositivos.' },
      { code: ['$ cat /proc/uptime', '$ uptime', '$ cat /proc/meminfo | head -5', '$ free -m'] },
      { p: '<code>uptime</code> e <code>free</code> formatam dados disponíveis em <code>/proc</code>. Mesmo que <code>ls -l</code> mostre tamanho zero, um arquivo virtual pode produzir conteúdo porque ele não está armazenado no disco.' },
      { p: 'Para o relatório, leia a carga em <code>/proc/loadavg</code>, filtre as duas linhas de memória com <code>grep</code> e leia o endereço MAC em <code>/sys</code>. Use <code>&gt;</code> uma vez e depois <code>&gt;&gt;</code>.' },
      { code: ['$ cat /proc/loadavg > ~/saude.txt', '$ grep MemTotal /proc/meminfo >> ~/saude.txt', '$ grep MemAvailable /proc/meminfo >> ~/saude.txt', '$ cat /sys/class/net/eth0/address >> ~/saude.txt'] }
    ],
    body: [
      { h2: 'Diretórios que são mentira (do bom tipo)' },
      { p: 'Se você desligar a máquina e olhar o disco, não vai encontrar <code>/proc</code> nem <code>/sys</code>. Eles são <strong>sistemas de arquivos virtuais</strong>: existem apenas na memória e são gerados pelo kernel <em>no momento em que você lê</em>.' },
      { p: 'É a materialização do "tudo é um arquivo": em vez de inventar uma API só para consultar o sistema, o kernel expõe seu estado interno como texto, e você usa <code>cat</code>.' },

      { h2: '/proc — processos e kernel' },
      { p: 'Cada processo em execução ganha um diretório com o número do seu PID. Além deles, há dezenas de arquivos com o estado do sistema:' },
      { code: ['$ cat /proc/uptime', '$ cat /proc/loadavg', '$ cat /proc/version', '$ cat /proc/meminfo', '$ cat /proc/cpuinfo'] },
      {
        table: {
          head: ['Arquivo', 'O que revela'],
          rows: [
            ['<code>/proc/uptime</code>', 'Segundos desde o boot e segundos ocioso.'],
            ['<code>/proc/loadavg</code>', 'Carga média de 1, 5 e 15 minutos.'],
            ['<code>/proc/meminfo</code>', 'Memória total, livre, em cache, swap.'],
            ['<code>/proc/cpuinfo</code>', 'Modelo, núcleos e recursos do processador.'],
            ['<code>/proc/version</code>', 'Versão do kernel e do compilador usado.'],
            ['<code>/proc/mounts</code>', 'O que está montado agora.'],
            ['<code>/proc/&lt;pid&gt;/</code>', 'Tudo sobre um processo: linha de comando, ambiente, arquivos abertos.']
          ]
        }
      },
      { p: 'Ferramentas como <code>top</code>, <code>free</code> e <code>ps</code> não têm mágica nenhuma: elas leem <code>/proc</code> e formatam bonito. Saber isso te dá independência — mesmo num container mínimo sem <code>ps</code> instalado, o <code>/proc</code> está lá.' },
      {
        box: 'key', body: [
          { p: 'Faça a conta e confira: <code>cat /proc/uptime</code> devolve segundos. Divida por 3600 e compare com a saída do <code>uptime</code>. É a mesma informação, uma crua e outra formatada.' }
        ]
      },

      { h2: '/sys — dispositivos e drivers' },
      { p: 'Mais novo e mais organizado que o <code>/proc</code>, o <code>/sys</code> expõe o modelo de dispositivos do kernel. É onde você lê e às vezes <em>escreve</em> para mudar o comportamento do hardware.' },
      { code: ['$ ls /sys', '$ cat /sys/class/net/eth0/address', '$ cat /sys/block/vda/size'] },
      { p: 'Aquele endereço que apareceu é o MAC da placa de rede, lido diretamente do kernel — sem <code>ip</code>, sem <code>ifconfig</code>.' },

      { h2: '/dev — o hardware como arquivo' },
      { p: 'Aqui ficam os <strong>arquivos de dispositivo</strong>. Escrever neles é enviar dados ao hardware; ler é receber.' },
      {
        table: {
          head: ['Dispositivo', 'O que é'],
          rows: [
            ['<code>/dev/null</code>', 'Descarta tudo o que recebe. O ralo do sistema.'],
            ['<code>/dev/zero</code>', 'Fonte infinita de bytes zero.'],
            ['<code>/dev/random</code>, <code>/dev/urandom</code>', 'Fontes de números aleatórios.'],
            ['<code>/dev/vda</code>, <code>/dev/sda</code>', 'O disco inteiro. <code>vda1</code>, <code>vda2</code> são as partições.'],
            ['<code>/dev/pts/0</code>', 'Seu terminal atual.'],
            ['<code>/dev/stdin</code>, <code>/dev/stdout</code>', 'As entradas e saídas padrão do processo.']
          ]
        }
      },
      { code: ['$ ls -l /dev/null /dev/zero /dev/vda'] },
      { p: 'Repare na primeira letra de cada linha: <code>c</code> para dispositivo de caractere e <code>b</code> para bloco. E, no lugar do tamanho, dois números — <em>major</em> e <em>minor</em> — que dizem ao kernel qual driver atende aquele arquivo.' },
      {
        box: 'tip', label: 'O uso mais comum de todos', body: [
          { p: 'Você vai escrever <code>&gt; /dev/null</code> mil vezes na vida: é como se joga fora a saída de um comando que você não quer ver. Combinado com <code>2&gt;&amp;1</code>, silencia até os erros. Voltaremos a isso no módulo 4.' }
        ]
      },

      { h2: 'Por que isso importa' },
      { p: 'Três motivos práticos:' },
      {
        ol: [
          '<strong>Você nunca fica sem ferramenta.</strong> Container mínimo, sistema quebrado, disco cheio — o <code>/proc</code> continua respondendo.',
          '<strong>Você entende de onde vêm os números.</strong> Quando o monitoramento mostra "load 4.2", você sabe que ele leu <code>/proc/loadavg</code> e o que aquilo significa.',
          '<strong>Você desmistifica o sistema.</strong> Nada ali é caixa preta: é texto, e você sabe ler texto.'
        ]
      }
    ],
    tasks: [
      {
        id: 't1-6-a', kind: 'guiado', title: 'Leia o kernel com cat',
        body: [
          { p: 'Vamos comparar a versão crua com a versão formatada da mesma informação:' },
          { code: ['$ cat /proc/uptime', '$ uptime', '$ cat /proc/meminfo | head -5', '$ free -m'] },
          { p: 'O primeiro par mostra o tempo ligado; o segundo, a memória. Em ambos, o comando bonito é só um leitor de <code>/proc</code>.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /\/proc\/uptime/), 'Leia <code>/proc/uptime</code> com o <code>cat</code>.'],
          [() => H.usedCommand(ctx, /\/proc\/meminfo/), 'Leia <code>/proc/meminfo</code>.'],
          [() => H.usedCommand(ctx, /^\s*free\b/m), 'Compare com o comando <code>free -m</code>.']
        ])
      },
      {
        id: 't1-6-q', kind: 'quiz', title: 'Onde está esse arquivo?',
        body: [{ p: 'Você roda <code>ls -l /proc/uptime</code> e vê que o arquivo tem <strong>0 bytes</strong>. Mesmo assim, <code>cat /proc/uptime</code> mostra conteúdo. Por quê?' }],
        options: [
          { text: 'O arquivo não existe no disco: o conteúdo é gerado pelo kernel no instante da leitura.', correct: true },
          { text: 'O <code>ls</code> está errado; o arquivo tem tamanho, só não é exibido.', why: 'O <code>ls</code> está certo. Arquivos de <code>/proc</code> realmente têm tamanho zero declarado.' },
          { text: 'O conteúdo está comprimido e por isso ocupa zero.', why: 'Não há compressão envolvida. O conteúdo simplesmente não está armazenado em lugar nenhum.' },
          { text: 'É um link simbólico para outro arquivo.', why: 'Não é link — um <code>ls -l</code> em um link mostraria a seta <code>-&gt;</code> e a letra <code>l</code> no início.' }
        ],
        explain: 'O <code>/proc</code> é um <em>procfs</em>: um sistema de arquivos virtual. Quando um programa faz <code>read()</code> nesse caminho, o kernel executa uma função que monta o texto na hora. Por isso o tamanho é sempre 0 e o conteúdo muda a cada leitura.'
      },
      {
        id: 't1-6-b', kind: 'desafio', title: 'Monitor sem instalar nada',
        body: [
          { p: 'Imagine um servidor mínimo onde <code>top</code>, <code>free</code> e <code>ps</code> não estão instalados. Você só tem <code>cat</code>, <code>grep</code> e redirecionamento.' },
          { p: 'Produza um arquivo <code>~/saude.txt</code> contendo:' },
          {
            ol: [
              'a carga média do sistema (crua, direto do /proc);',
              'a linha da memória <strong>total</strong> e a linha da memória <strong>disponível</strong>, extraídas de <code>/proc/meminfo</code>;',
              'o endereço MAC da interface <code>eth0</code>, lido do <code>/sys</code>.'
            ]
          },
          { p: 'Nada de <code>free</code>, <code>uptime</code> ou <code>ip</code> — o desafio é justamente usar as fontes originais.' }
        ],
        hints: [
          'Para pegar linhas específicas de um arquivo, use <code>grep PALAVRA arquivo</code>. As linhas do meminfo começam com <code>MemTotal</code> e <code>MemAvailable</code>.',
          'O MAC da eth0 está em <code>/sys/class/net/eth0/address</code>. E lembre-se: <code>&gt;</code> cria, <code>&gt;&gt;</code> acrescenta.'
        ],
        solution: '<div class="code"><pre>cat /proc/loadavg                          &gt;  ~/saude.txt\ngrep MemTotal /proc/meminfo                &gt;&gt; ~/saude.txt\ngrep MemAvailable /proc/meminfo            &gt;&gt; ~/saude.txt\ncat /sys/class/net/eth0/address            &gt;&gt; ~/saude.txt</pre></div><p style="margin-top:8px">Você acabou de escrever um coletor de métricas rudimentar — que é, em essência, o que agentes de monitoramento fazem.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/saude.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/saude.txt ainda não existe.' };
          const mac = (H.read(ctx, '/sys/class/net/eth0/address') || '').trim();
          const usouProibido = (ctx.term.history || []).some(h => /(^|[|;&]\s*)(free|uptime|ip)\b/.test(h) && /saude\.txt/.test(h));
          return LX.H.checkAll([
            [/\d+\.\d\d \d+\.\d\d \d+\.\d\d/.test(c), 'Não encontrei a carga média crua. Ela vem de <code>/proc/loadavg</code>.'],
            [/MemTotal/.test(c), 'Falta a linha <code>MemTotal</code> do /proc/meminfo.'],
            [/MemAvailable/.test(c), 'Falta a linha <code>MemAvailable</code> do /proc/meminfo.'],
            [mac && c.includes(mac), 'Falta o endereço MAC da eth0, lido de <code>/sys/class/net/eth0/address</code>.'],
            [!usouProibido, 'Você usou <code>free</code>, <code>uptime</code> ou <code>ip</code>. O desafio pede as fontes originais em /proc e /sys.']
          ]);
        }
      }
    ]
  });
})();
