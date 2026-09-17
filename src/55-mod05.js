/* =========================================================================
   MÓDULO 5 — Permissões
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 5.1 ============================== */
  LX.lesson('m05', {
    id: 'l5-1', n: '5.1', title: 'O modelo: dono, grupo e outros',
    goal: 'Ler qualquer linha de ls -l sem hesitar e entender por que o mesmo bit significa coisas diferentes em arquivos e em diretórios.',
    brief: [
      { p: '<code>ls -l</code> mostra três blocos de permissões: dono, grupo e outros. Em cada bloco, <code>r</code> permite ler, <code>w</code> escrever e <code>x</code> executar. O kernel usa apenas a primeira classe que corresponde ao usuário.' },
      { code: ['$ ls -l /etc/passwd', '$ stat -c "%A %U %G %n" /etc/passwd'] },
      { p: 'Em diretórios, <code>r</code> lista nomes, <code>w</code> altera entradas e <code>x</code> permite atravessar o caminho. Apagar um arquivo depende da permissão do diretório que o contém, não do próprio arquivo.' }
    ],
    body: [
      { lede: 'Linux não pergunta "você tem permissão?". Ele pergunta "quem é você em relação a este arquivo?" — e a resposta só pode ser uma de três: dono, membro do grupo, ou o resto do mundo.' },
      { p: 'Todo arquivo carrega três informações de segurança gravadas junto com ele: um <strong>UID</strong> (o dono), um <strong>GID</strong> (o grupo) e doze bits de permissão. Nada mais. Não existe lista de usuários autorizados por arquivo — essa é justamente a limitação que as ACLs, no fim deste módulo, vieram resolver.' },

      { h2: 'Anatomia de uma linha de ls -l' },
      { p: 'Rode e acompanhe:' },
      { code: ['$ ls -l /etc/passwd'] },
      {
        ascii: `-rw-r--r-- 1 root root 2891 Aug 30 09:14 /etc/passwd
│└┬┘└┬┘└┬┘   │    │
│ │  │  │    │    └─ grupo do arquivo
│ │  │  │    └────── dono do arquivo
│ │  │  └─────────── permissões de OUTROS   (r--)
│ │  └────────────── permissões do GRUPO    (r--)
│ └───────────────── permissões do DONO     (rw-)
└─────────────────── tipo:  -  arquivo comum
                     d  diretório      l  link simbólico
                     c  dispositivo de caractere   b  de bloco
                     s  socket         p  pipe nomeado`
      },
      { p: 'São três blocos de três letras, sempre na mesma ordem: <code>r</code> (read), <code>w</code> (write), <code>x</code> (execute). Um traço no lugar da letra significa "não pode".' },

      { h2: 'A regra que decide' },
      { p: 'Quando você toca um arquivo, o kernel avalia <strong>na ordem</strong> e para na primeira que casar:' },
      {
        ol: [
          'Você é o dono? → valem os bits do dono. <strong>Fim.</strong>',
          'Você pertence ao grupo do arquivo? → valem os bits do grupo. <strong>Fim.</strong>',
          'Nenhum dos dois? → valem os bits de outros.'
        ]
      },
      {
        box: 'key', body: [
          { p: 'Ele para na primeira que casar — e isso tem uma consequência que surpreende quase todo mundo: se o arquivo for <code>----rwxrwx</code> e você for o <strong>dono</strong>, você não pode ler nada. Os bits do dono são <code>---</code>, e o kernel nem chega a olhar os do grupo.' },
          { p: 'Ser dono não é ser privilegiado. Ser dono é apenas ser avaliado primeiro — e poder mudar as permissões depois.' }
        ]
      },
      { p: 'Veja com seus próprios olhos:' },
      {
        code: [
          '$ cd ~ && echo teste > invertido.txt',
          '$ chmod 077 invertido.txt',
          '$ ls -l invertido.txt',
          '$ cat invertido.txt'
        ]
      },
      { p: 'Você é o dono, o arquivo está aberto para o mundo inteiro, e mesmo assim você levou <code>Permission denied</code>. Corrija com <code>chmod 644 invertido.txt</code>.' },

      { h2: 'Em arquivos, rwx significa uma coisa. Em diretórios, outra.' },
      { p: 'Esta é a fonte de metade da confusão com permissões. Um diretório, para o kernel, é um arquivo que contém uma tabela de "nome → inode". Os bits se aplicam a essa tabela:' },
      {
        table: {
          head: ['Bit', 'Em um arquivo', 'Em um diretório'],
          rows: [
            ['<code>r</code>', 'ler o conteúdo', 'listar os <strong>nomes</strong> que estão dentro (<code>ls</code>)'],
            ['<code>w</code>', 'alterar o conteúdo', 'criar, renomear e <strong>apagar</strong> entradas dentro'],
            ['<code>x</code>', 'executar como programa', '<strong>atravessar</strong>: entrar nele e acessar o que está dentro']
          ]
        }
      },
      {
        box: 'key', label: 'A consequência mais importante do curso', body: [
          { p: 'Apagar um arquivo <strong>não depende das permissões do arquivo</strong>. Depende do bit <code>w</code> do <em>diretório</em> que o contém — porque apagar é remover uma linha da tabela do diretório, não mexer no arquivo.' },
          { p: 'É por isso que você consegue apagar um arquivo <code>444</code> que nem é seu, desde que o diretório seja seu. E é por isso que <code>/tmp</code> precisa do sticky bit (aula 5.6).' }
        ]
      },
      { p: 'O par <code>r</code> e <code>x</code> em diretórios também gera situações estranhas, e vale experimentar:' },
      {
        code: [
          '$ mkdir -p ~/lab/segredo && echo conteudo > ~/lab/segredo/arquivo.txt',
          '# só x (não pode listar, mas pode atravessar se souber o nome)',
          '$ chmod 100 ~/lab/segredo',
          '$ ls ~/lab/segredo',
          '$ cat ~/lab/segredo/arquivo.txt',
          '# só r (pode listar os nomes, mas não pode chegar em nada)',
          '$ chmod 400 ~/lab/segredo',
          '$ ls ~/lab/segredo',
          '$ cat ~/lab/segredo/arquivo.txt',
          '$ chmod 755 ~/lab/segredo'
        ]
      },
      { p: 'Guarde o caso <code>--x</code>: é assim que se monta um diretório "público por convite" — quem sabe o nome exato entra, quem não sabe não descobre. É uma escolha de endurecimento: o padrão do Debian/Ubuntu para <code>/home/usuario</code> é <code>755</code> (e <code>750</code> nas versões recentes do <code>adduser</code>), e quem quer esconder a listagem troca para <code>711</code> deliberadamente.' },

      { h2: 'E você, quem é?' },
      { p: 'Suas credenciais são numéricas; os nomes são só uma tradução feita a partir de <code>/etc/passwd</code> e <code>/etc/group</code>.' },
      { code: ['$ id', '$ groups', '$ id -u', '$ id -un'] },
      { p: 'O <code>id</code> mostra seu UID, seu grupo primário (GID) e todos os grupos secundários. Quando um arquivo pertence a um grupo que aparece nessa lista, você é avaliado pela faixa do meio.' },
      {
        box: 'warn', label: 'Pegadinha clássica', body: [
          { p: 'Adicionar um usuário a um grupo (<code>usermod -aG</code>) <strong>não muda a sessão que já está aberta</strong>. A lista de grupos é copiada quando você faz login e não é reconsultada. É preciso sair e entrar de novo — ou abrir uma nova sessão. Muita gente conclui que "a permissão não funcionou" quando na verdade só faltou relogar.' }
        ]
      },
      { p: 'O usuário <code>root</code> (UID 0) é a exceção a tudo: o kernel pula a checagem de <code>r</code> e <code>w</code>. Para <code>x</code> ele ainda exige que exista <em>pelo menos um</em> bit de execução, para não sair executando arquivos de texto por engano.' }
    ],
    tasks: [
      {
        id: 't5-1-a', kind: 'guiado', title: 'Leia e comprove',
        body: [
          { p: 'Vamos confirmar as três regras na prática. Rode os blocos abaixo e observe cada resultado antes de seguir.' },
          { code: ['$ ls -l /etc/passwd /etc/shadow', '$ ls -ld /tmp /home /home/aluno'] },
          { p: 'Repare que <code>/etc/shadow</code> não tem nenhum bit para "outros" — é onde ficam as senhas.' },
          { p: 'Agora o experimento do dono sem permissão:' },
          {
            code: [
              '$ cd ~ && echo teste > invertido.txt',
              '$ chmod 077 invertido.txt',
              '$ cat invertido.txt',
              '$ ls -l invertido.txt'
            ]
          },
          { p: 'Depois de ver o erro, devolva o arquivo ao normal com <code>chmod 644 invertido.txt</code>.' }
        ],
        hints: ['O <code>ls -ld</code> mostra o diretório em si, e não o que está dentro dele.'],
        solution: '<div class="code"><pre>ls -l /etc/passwd /etc/shadow\nls -ld /tmp /home /home/aluno\ncd ~ &amp;&amp; echo teste &gt; invertido.txt\nchmod 077 invertido.txt\ncat invertido.txt\nchmod 644 invertido.txt\nls -l invertido.txt</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ls\s+-l?d/), 'Use <code>ls -ld</code> para inspecionar diretórios.'],
          [H.exists(ctx, '/home/aluno/invertido.txt'), 'Crie o arquivo <code>~/invertido.txt</code>.'],
          [() => H.usedCommand(ctx, /chmod\s+077/), 'Aplique <code>chmod 077 invertido.txt</code> e tente ler o arquivo.'],
          [H.mode(ctx, '/home/aluno/invertido.txt') === 0o644, 'Devolva o arquivo ao normal com <code>chmod 644 invertido.txt</code>.']
        ])
      },
      {
        id: 't5-1-q', kind: 'quiz', title: 'Quem consegue apagar?',
        body: [
          { p: 'O arquivo <code>/dados/relatorio.txt</code> tem permissões <code>-r--r--r--</code> e pertence a <code>root:root</code>.' },
          { p: 'O diretório <code>/dados</code> tem permissões <code>drwxrwxrwx</code> e também pertence a <code>root:root</code>.' },
          { p: 'A usuária <strong>ana</strong>, que não é root e não está em nenhum grupo especial, tenta <code>rm /dados/relatorio.txt</code>. O que acontece?' }
        ],
        options: [
          { text: 'O arquivo é apagado — apagar depende do bit <code>w</code> do diretório, e ele está aberto para todos.', correct: true },
          { text: 'Ela recebe <code>Permission denied</code>, porque o arquivo é somente leitura.', why: 'O modo do arquivo controla o <em>conteúdo</em>. Remover o nome é uma alteração no diretório, não no arquivo.' },
          { text: 'Ela recebe <code>Operation not permitted</code>, porque o arquivo é do root.', why: 'A propriedade do arquivo importa para <code>chmod</code> e <code>chown</code>, não para a remoção da entrada no diretório.' },
          { text: 'O arquivo é apagado, mas só depois de confirmar com <code>y</code>.', why: 'O <code>rm</code> só pergunta em modo interativo (<code>-i</code>) — e mesmo assim isso seria uma pergunta, não uma permissão.' }
        ],
        explain: 'Um <code>rm</code> bem-sucedido remove uma entrada da tabela do diretório. Por isso o teste é <code>w</code> + <code>x</code> no diretório. O <code>rm</code> interativo até avisa "remove write-protected file?" quando o arquivo não tem <code>w</code>, mas é só um aviso de cortesia: responder <code>y</code> apaga.'
      },
      {
        id: 't5-1-b', kind: 'desafio', title: 'O diretório por convite',
        body: [
          { p: 'Monte em <code>~/entrega</code> um diretório com o seguinte comportamento, todos verificáveis por você:' },
          {
            ul: [
              'quem <strong>não é você</strong> não consegue listar o que há dentro;',
              'quem não é você <strong>consegue ler</strong> um arquivo lá dentro, desde que saiba o nome exato;',
              'o arquivo <code>~/entrega/chave.txt</code> deve existir e conter a palavra <code>ok</code>.'
            ]
          },
          { p: 'Descubra que combinação de bits produz esse resultado. Pense em cada bit separadamente para o diretório e para o arquivo.' }
        ],
        hints: [
          'Para "outros": listar é <code>r</code>, atravessar é <code>x</code>. Você quer negar um e conceder o outro.',
          'O diretório fica <code>drwx--x--x</code> (711) e o arquivo precisa ser legível por outros (<code>644</code>).'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/entrega\necho ok &gt; ~/entrega/chave.txt\nchmod 711 ~/entrega\nchmod 644 ~/entrega/chave.txt\nls -ld ~/entrega\nls -l ~/entrega/chave.txt</pre></div><p style="margin-top:8px">Esse é o modo clássico de um diretório de entrega de arquivos: o conteúdo não é enumerável, mas é acessível por quem já sabe o nome. Não é o padrão de um home — é uma escolha para este caso.</p>',
        check: async (ctx) => {
          const d = H.mode(ctx, '/home/aluno/entrega');
          if (d === null) return { ok: false, msg: 'O diretório <code>~/entrega</code> ainda não existe.' };
          const f = H.mode(ctx, '/home/aluno/entrega/chave.txt');
          const c = H.read(ctx, '/home/aluno/entrega/chave.txt');
          return LX.H.checkAll([
            [f !== null, 'Crie o arquivo <code>~/entrega/chave.txt</code>.'],
            [c !== null && /\bok\b/.test(c), 'O arquivo <code>chave.txt</code> deve conter a palavra <code>ok</code>.'],
            [(d & 0o001) !== 0, `Outros precisam poder <strong>atravessar</strong> o diretório (bit x). Modo atual: ${d.toString(8)}.`],
            [(d & 0o004) === 0, `Outros não podem <strong>listar</strong> o diretório (bit r deve estar desligado). Modo atual: ${d.toString(8)}.`],
            [(d & 0o700) === 0o700, 'Você, como dono, precisa continuar com <code>rwx</code> no diretório.'],
            [(f & 0o004) !== 0, `O arquivo precisa ser legível por outros. Modo atual: ${f.toString(8)}.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 5.2 ============================== */
  LX.lesson('m05', {
    id: 'l5-2', n: '5.2', title: 'chmod simbólico: dizer o que muda',
    goal: 'Alterar permissões descrevendo a mudança, sem precisar recalcular o modo inteiro — e entender quando essa é a forma mais segura.',
    brief: [
      { p: '<code>chmod</code> simbólico descreve quem muda, a operação e a permissão. <code>u</code> é o dono, <code>g</code> o grupo, <code>o</code> os outros e <code>a</code> todos; <code>+</code> adiciona, <code>-</code> remove e <code>=</code> define exatamente.' },
      { code: ['$ chmod u+x script.sh', '$ chmod g+w,o-rwx relatorio.txt', '$ chmod -R g+rwX projeto'] },
      { p: 'A letra <code>X</code> adiciona execução somente a diretórios ou itens que já eram executáveis. Ela é mais segura que <code>x</code> em alterações recursivas, pois não transforma arquivos comuns em programas.' }
    ],
    body: [
      { p: 'O <code>chmod</code> tem duas linguagens. A simbólica descreve <strong>uma mudança</strong>; a octal (próxima aula) descreve <strong>o estado final</strong>. As duas são úteis, e escolher errado é uma fonte real de acidentes.' },
      { cmd: 'chmod' },
      {
        code: [
          'chmod [OPÇÕES] MODO ARQUIVO...',
          '',
          'MODO simbólico =  [quem][operador][permissões]',
          '   quem:       u  dono     g  grupo    o  outros    a  todos (u+g+o)',
          '   operador:   +  adiciona   -  remove   =  define exatamente',
          '   permissões: r  leitura    w  escrita  x  execução',
          '               X  x só se for diretório ou já tiver algum x',
          '               s  SUID/SGID  t  sticky bit'
        ], run: false, lang: 'text'
      },
      { h2: 'Os três operadores' },
      { p: 'A diferença entre eles é o que acontece com o que você <em>não</em> mencionou:' },
      {
        table: {
          head: ['Comando', 'Efeito', 'O resto'],
          rows: [
            ['<code>chmod g+w a.txt</code>', 'liga o <code>w</code> do grupo', 'intocado'],
            ['<code>chmod o-rwx a.txt</code>', 'desliga tudo para outros', 'intocado'],
            ['<code>chmod g=r a.txt</code>', 'grupo passa a ter <strong>exatamente</strong> <code>r--</code>', 'intocado'],
            ['<code>chmod a=rw a.txt</code>', 'todos passam a ter exatamente <code>rw-</code>', 'nada sobra'],
            ['<code>chmod =r a.txt</code>', 'sem "quem": vale <code>a</code>', 'nada sobra']
          ]
        }
      },
      { p: 'Você pode encadear várias cláusulas separadas por vírgula, sem espaços:' },
      {
        code: [
          '$ cd ~ && touch script.sh',
          '$ chmod u+rwx,g+rx,o-rwx script.sh',
          '$ ls -l script.sh'
        ]
      },

      { h2: 'O caso mais comum de todos' },
      { p: 'Tornar um script executável:' },
      { code: ['$ printf \'#!/bin/bash\\necho "oi do script"\\n\' > ~/oi.sh', '$ ./oi.sh', '$ chmod +x ~/oi.sh', '$ ./oi.sh'] },
      { p: 'Antes do <code>chmod</code>, o erro é <code>Permission denied</code> — o arquivo existe, o conteúdo está certo, falta apenas o bit que autoriza o kernel a carregá-lo como programa.' },
      {
        box: 'tip', label: 'Escolha consciente', body: [
          { p: '<code>chmod +x</code> respeita a sua <code>umask</code> e costuma ligar o <code>x</code> para todo mundo. Se o script tiver algo sensível, prefira <code>chmod u+x</code> — só você executa.' }
        ]
      },

      { h2: 'O X maiúsculo: o detalhe que salva um dia de trabalho' },
      { p: 'Você quer dar acesso de leitura a um projeto inteiro. O reflexo é <code>chmod -R a+rx projeto/</code> — e o efeito colateral é que <strong>todo arquivo de texto vira executável</strong>. Fica feio, atrapalha o autocomplete e confunde ferramentas.' },
      { p: 'O <code>X</code> maiúsculo liga o <code>x</code> apenas onde ele faz sentido: diretórios, ou arquivos que já tinham algum bit de execução.' },
      {
        code: [
          '$ mkdir -p ~/proj/bin && touch ~/proj/leia.txt ~/proj/bin/rodar.sh',
          '$ chmod 755 ~/proj/bin/rodar.sh && chmod 644 ~/proj/leia.txt',
          '$ chmod -R a+rX ~/proj',
          '$ ls -l ~/proj ~/proj/bin'
        ]
      },
      { p: 'O <code>leia.txt</code> continuou <code>rw-r--r--</code>; o <code>rodar.sh</code> e os diretórios ganharam o <code>x</code>. Compare mentalmente com o que <code>a+rx</code> teria feito.' },

      { h2: 'Copiar de outra faixa' },
      { p: 'Menos conhecido, mas útil: as letras <code>u</code>, <code>g</code> e <code>o</code> também valem como <em>origem</em>.' },
      { code: ['$ chmod g=u ~/proj/leia.txt   # grupo passa a ter o mesmo que o dono', '$ ls -l ~/proj/leia.txt', '$ chmod g=r ~/proj/leia.txt'] },
      { p: 'E o <code>--reference</code> copia o modo inteiro de outro arquivo, o que é excelente para restaurar algo que você bagunçou:' },
      { code: ['$ chmod --reference=/etc/hostname ~/proj/leia.txt && ls -l ~/proj/leia.txt'] },

      { h2: 'Opções que importam' },
      {
        table: {
          head: ['Opção', 'O que faz', 'Quando usar'],
          rows: [
            ['<code>-R</code>', 'aplica recursivamente', 'árvores inteiras — com <code>X</code>, quase sempre'],
            ['<code>-v</code>', 'mostra cada alteração', 'quando quiser conferir o que mudou'],
            ['<code>-c</code>', 'mostra só o que <em>de fato</em> mudou', 'auditoria em scripts'],
            ['<code>--reference=ARQ</code>', 'copia o modo de outro arquivo', 'restaurar um padrão conhecido'],
            ['<code>-f</code>', 'silencia erros', 'scripts que varrem caminhos opcionais']
          ]
        }
      },
      {
        box: 'warn', label: 'Antes de qualquer chmod -R', body: [
          { p: 'Guarde o estado atual. Um <code>chmod -R</code> errado em <code>/etc</code> ou em <code>~/.ssh</code> não tem desfazer:' },
          { code: ['$ find ~/proj -printf "%m %p\\n" > ~/modos-antes.txt'], run: false },
          { p: 'Com esse arquivo você reconstrói qualquer permissão depois. Nos módulos de scripting você vai transformar isso em um script de restauração.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't5-2-a', kind: 'guiado', title: 'Simbólico na prática',
        body: [
          { p: 'Crie um script, veja o erro, corrija com o bit certo e observe a diferença entre <code>x</code> e <code>X</code>.' },
          {
            code: [
              '$ cd ~ && printf \'#!/bin/bash\\necho "oi do script"\\n\' > oi.sh',
              '$ ./oi.sh',
              '$ chmod u+x oi.sh && ls -l oi.sh',
              '$ ./oi.sh'
            ]
          },
          { p: 'Agora o experimento do <code>X</code>:' },
          {
            code: [
              '$ mkdir -p ~/proj/bin && touch ~/proj/leia.txt ~/proj/bin/rodar.sh',
              '$ chmod 755 ~/proj/bin/rodar.sh',
              '$ chmod -R a+rX ~/proj',
              '$ ls -l ~/proj ~/proj/bin'
            ]
          }
        ],
        hints: ['O <code>./</code> antes do nome é obrigatório: o diretório atual não está no <code>PATH</code>.'],
        solution: '<div class="code"><pre>cd ~ &amp;&amp; printf \'#!/bin/bash\\necho "oi do script"\\n\' &gt; oi.sh\nchmod u+x oi.sh\n./oi.sh\nmkdir -p ~/proj/bin &amp;&amp; touch ~/proj/leia.txt ~/proj/bin/rodar.sh\nchmod 755 ~/proj/bin/rodar.sh\nchmod -R a+rX ~/proj\nls -l ~/proj ~/proj/bin</pre></div>',
        check: async (ctx) => {
          const oi = H.mode(ctx, '/home/aluno/oi.sh');
          const leia = H.mode(ctx, '/home/aluno/proj/leia.txt');
          const bin = H.mode(ctx, '/home/aluno/proj/bin');
          return LX.H.checkAll([
            [oi !== null, 'Crie o script <code>~/oi.sh</code>.'],
            [(oi & 0o100) !== 0, 'Torne o <code>~/oi.sh</code> executável para o dono.'],
            [leia !== null && bin !== null, 'Crie a árvore <code>~/proj</code> com <code>bin/rodar.sh</code> e <code>leia.txt</code>.'],
            [() => H.usedCommand(ctx, /chmod\s+-R\s+a\+rX|chmod\s+-R\s+[ugoa]*\+[rw]*X/), 'Aplique <code>chmod -R a+rX ~/proj</code>.'],
            [(leia & 0o111) === 0, `O <code>leia.txt</code> não deveria ter ganhado bit de execução — esse é o ponto do <code>X</code> maiúsculo. Modo atual: ${leia === null ? '?' : leia.toString(8)}.`],
            [(bin & 0o111) !== 0, 'O diretório <code>bin</code> deveria ter ganhado o bit <code>x</code>.']
          ]);
        }
      },
      {
        id: 't5-2-f', kind: 'fill', title: 'Complete o chmod',
        body: [
          { p: 'Um arquivo de configuração está como <code>-rw-rw-r--</code>. Você quer, <strong>em um único comando simbólico</strong>, que o grupo perca a escrita e que outros percam tudo — sem tocar nas permissões do dono.' },
          { p: 'Complete o modo:' }
        ],
        template: 'chmod ___ config.conf', sample: 'g-w,o-rwx',
        answers: ['g-w,o-rwx'],
        hints: ['São duas cláusulas separadas por vírgula, sem espaço entre elas.', 'A primeira remove <code>w</code> do grupo; a segunda remove <code>rwx</code> de outros.'],
        solution: 'A resposta é <code>g-w,o-rwx</code>. O resultado é <code>-rw-r-----</code>. Também funcionaria <code>g=r,o=</code> — mas repare que essa versão <em>define</em> em vez de remover, o que sobrescreveria bits que existissem.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim().replace(/\s+/g, '');
          if (/^g=r,o=$/.test(v)) return { ok: true, msg: 'Também vale — <code>=</code> define o estado final em vez de remover.' };
          return LX.H.checkAll([
            [/g-w/.test(v), 'Falta remover a escrita do grupo: <code>g-w</code>.'],
            [/o-rwx|o-wrx|o-rw|o=/.test(v), 'Falta remover tudo de outros: <code>o-rwx</code>.'],
            [/,/.test(v), 'Junte as duas cláusulas com uma vírgula, sem espaço: <code>g-w,o-rwx</code>.']
          ]);
        }
      },
      {
        id: 't5-2-b', kind: 'desafio', title: 'Arrume a bagunça sem estragar os scripts',
        body: [
          { p: 'Alguém rodou <code>chmod -R 777</code> em um projeto. Recrie a cena e depois conserte:' },
          {
            code: [
              '$ rm -rf ~/site-app && mkdir -p ~/site-app/bin ~/site-app/conf',
              '$ printf \'#!/bin/bash\\necho deploy\\n\' > ~/site-app/bin/deploy.sh',
              '$ echo "senha=1234" > ~/site-app/conf/secreto.conf',
              '$ echo "<h1>oi</h1>" > ~/site-app/index.html',
              '$ chmod -R 777 ~/site-app',
              '$ ls -lR ~/site-app'
            ]
          },
          { p: 'Deixe a árvore assim, usando <strong>modos simbólicos</strong>:' },
          {
            ul: [
              'ninguém fora de você e do seu grupo enxerga qualquer coisa (nenhum bit para "outros" em nada);',
              'o <code>deploy.sh</code> continua executável por você;',
              '<code>index.html</code> e <code>secreto.conf</code> <strong>não</strong> podem ser executáveis;',
              'o <code>secreto.conf</code> só pode ser lido e escrito por você — nem o grupo lê;',
              'os diretórios continuam navegáveis por você e pelo grupo.'
            ]
          }
        ],
        hints: [
          'Comece removendo tudo de outros na árvore inteira: <code>chmod -R o-rwx ~/site-app</code>.',
          'Depois tire o <code>x</code> de todos os arquivos e devolva só onde precisa: <code>chmod -R a-x ~/site-app</code> quebraria os diretórios — use <code>chmod -R o-rwx</code>, depois ajuste arquivo por arquivo com <code>chmod ug-x</code> e <code>chmod u+x</code>.',
          'Sequência completa: <code>chmod -R o-rwx ~/site-app</code>; <code>chmod ug-x ~/site-app/index.html ~/site-app/conf/secreto.conf</code>; <code>chmod g-rwx ~/site-app/conf/secreto.conf</code>; <code>chmod u+x ~/site-app/bin/deploy.sh</code>.'
        ],
        solution: '<div class="code"><pre>chmod -R o-rwx ~/site-app\nchmod ug-x ~/site-app/index.html ~/site-app/conf/secreto.conf\nchmod g-rwx ~/site-app/conf/secreto.conf\nchmod u+x ~/site-app/bin/deploy.sh\nls -lR ~/site-app</pre></div><p style="margin-top:8px">Repare que nenhum comando precisou saber o modo atual — é essa a vantagem do simbólico em cima de uma bagunça: você descreve a diferença, não o destino.</p>',
        check: async (ctx) => {
          const base = '/home/aluno/site-app';
          const d = H.mode(ctx, base);
          if (d === null) return { ok: false, msg: 'Recrie a árvore <code>~/site-app</code> com o bloco do enunciado.' };
          const dep = H.mode(ctx, base + '/bin/deploy.sh');
          const idx = H.mode(ctx, base + '/index.html');
          const sec = H.mode(ctx, base + '/conf/secreto.conf');
          const bin = H.mode(ctx, base + '/bin');
          const conf = H.mode(ctx, base + '/conf');
          const semOutros = [d, dep, idx, sec, bin, conf].every(m => m !== null && (m & 0o007) === 0);
          return LX.H.checkAll([
            [dep !== null && idx !== null && sec !== null, 'A árvore precisa ter <code>bin/deploy.sh</code>, <code>index.html</code> e <code>conf/secreto.conf</code>.'],
            [semOutros, 'Ainda há bits para "outros" em algum item da árvore. Comece por <code>chmod -R o-rwx ~/site-app</code>.'],
            [(dep & 0o100) !== 0, 'O <code>deploy.sh</code> precisa continuar executável por você.'],
            [(idx & 0o111) === 0, `O <code>index.html</code> não pode ter bit de execução. Modo atual: ${idx.toString(8)}.`],
            [(sec & 0o111) === 0, `O <code>secreto.conf</code> não pode ter bit de execução. Modo atual: ${sec.toString(8)}.`],
            [(sec & 0o070) === 0, `O grupo ainda enxerga o <code>secreto.conf</code>. Modo atual: ${sec.toString(8)}.`],
            [(sec & 0o600) === 0o600, 'Você precisa continuar podendo ler e escrever o <code>secreto.conf</code>.'],
            [(bin & 0o050) === 0o050 && (conf & 0o050) === 0o050, 'Os diretórios devem continuar legíveis e navegáveis pelo grupo (<code>r-x</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 5.3 ============================== */
  LX.lesson('m05', {
    id: 'l5-3', n: '5.3', title: 'chmod octal: dizer como fica',
    goal: 'Converter rwx em números sem tabela de consulta, reconhecer os modos padrão de cabeça e saber quando o octal é perigoso.',
    brief: [
      { p: 'No modo octal, <code>r=4</code>, <code>w=2</code> e <code>x=1</code>. Some os bits de cada classe e escreva os três resultados na ordem dono, grupo e outros.' },
      { code: ['$ chmod 644 relatorio.txt', '$ chmod 755 script.sh', '$ chmod 600 .env'] },
      { p: '<code>644</code> serve para arquivos públicos de leitura, <code>755</code> para diretórios e programas públicos, <code>600</code> para segredos e <code>700</code> para diretórios privados. O octal substitui o modo inteiro; confira antes de aplicá-lo recursivamente.' }
    ],
    body: [
      { p: 'Cada faixa de três bits é um número de 0 a 7. A conta é sempre a mesma:' },
      {
        ascii: `   r   w   x
   4 + 2 + 1  =  7   rwx      leitura, escrita e execução
   4 + 2 + 0  =  6   rw-      leitura e escrita
   4 + 0 + 1  =  5   r-x      leitura e execução
   4 + 0 + 0  =  4   r--      só leitura
   0 + 2 + 0  =  2   -w-      só escrita (raríssimo)
   0 + 0 + 1  =  1   --x      só atravessar/executar
   0 + 0 + 0  =  0   ---      nada`
      },
      { p: 'Três dígitos, na ordem <strong>dono, grupo, outros</strong>. <code>chmod 640 x</code> quer dizer: dono <code>rw-</code>, grupo <code>r--</code>, outros <code>---</code>.' },
      {
        box: 'tip', label: 'Como converter de cabeça', body: [
          { p: 'Não decore a tabela toda. Faça a leitura direta: cada bit ligado vale 4, 2 ou 1 da esquerda para a direita. <code>rw-</code> é "4 mais 2, sem o 1" = 6. <code>r-x</code> é "4, sem o 2, mais 1" = 5. Em uma semana você lê <code>755</code> como <code>rwxr-xr-x</code> sem pensar.' }
        ]
      },

      { h2: 'Os modos que você vai usar 95% do tempo' },
      {
        table: {
          head: ['Octal', 'rwx', 'Para quê'],
          rows: [
            ['<strong>644</strong>', '<code>rw-r--r--</code>', 'arquivos comuns: você edita, o resto lê'],
            ['<strong>755</strong>', '<code>rwxr-xr-x</code>', 'diretórios e programas/scripts públicos'],
            ['<strong>600</strong>', '<code>rw-------</code>', 'segredos: chaves, <code>.env</code>, tokens'],
            ['<strong>700</strong>', '<code>rwx------</code>', 'diretórios privados, como <code>~/.ssh</code>'],
            ['<strong>640</strong>', '<code>rw-r-----</code>', 'config que o grupo (ou um serviço) precisa ler'],
            ['<strong>664</strong>', '<code>rw-rw-r--</code>', 'arquivo editado por uma equipe'],
            ['<strong>775</strong>', '<code>rwxrwxr-x</code>', 'diretório de trabalho compartilhado'],
            ['<strong>440</strong>', '<code>r--r-----</code>', 'arquivo que nem o dono deve alterar por engano']
          ]
        }
      },
      { p: 'Confirme lendo o mundo real:' },
      { code: ['$ stat -c "%a %A %n" /etc/passwd /etc/shadow /tmp /usr/bin/passwd', '$ stat -c "%a %A %n" ~/.ssh 2>/dev/null'] },
      { p: 'O <code>stat -c</code> é a forma mais direta de ver o octal; o <code>%A</code> mostra a versão em letras ao lado, ótimo para treinar a conversão.' },

      { h2: 'O quarto dígito' },
      { p: 'Você vai ver modos com quatro dígitos: <code>4755</code>, <code>2775</code>, <code>1777</code>. O primeiro é a faixa dos bits especiais — SUID (4), SGID (2) e sticky (1) — assunto da aula 5.6. Quando você escreve só três dígitos, o quarto é assumido como zero, e é por isso que:' },
      {
        box: 'warn', body: [
          { p: 'Um <code>chmod 755</code> em um arquivo que era <code>4755</code> <strong>apaga o SUID silenciosamente</strong>. É um jeito clássico de quebrar um binário do sistema sem perceber. Use <code>chmod u+x</code> ou repita o quarto dígito quando o arquivo já tiver bits especiais.' }
        ]
      },

      { h2: 'O 777 e por que ele quase nunca é a resposta' },
      { p: 'Quando algo dá <code>Permission denied</code>, existe uma tentação enorme de rodar <code>chmod 777</code> e seguir a vida. O comando resolve o sintoma e cria três problemas:' },
      {
        ul: [
          '<strong>qualquer</strong> usuário ou processo da máquina passa a poder alterar o arquivo — incluindo um serviço comprometido;',
          'em diretórios, qualquer um passa a poder apagar o que está dentro (a menos que haja sticky bit);',
          'vários programas <strong>se recusam a funcionar</strong> com permissões frouxas: o OpenSSH ignora chaves privadas legíveis por outros, e o cron ignora crontabs com escrita para grupo.'
        ]
      },
      { p: 'Veja o SSH recusando na prática:' },
      {
        code: [
          '$ mkdir -p ~/.ssh && printf -- "-----BEGIN OPENSSH PRIVATE KEY-----\\nfake\\n" > ~/.ssh/id_teste',
          '$ chmod 777 ~/.ssh/id_teste',
          '$ ssh -i ~/.ssh/id_teste web01 "echo conectou" 2>&1 | head -8'
        ]
      },
      { p: 'A mensagem é longa e clara: <code>UNPROTECTED PRIVATE KEY FILE</code>. Corrija com <code>chmod 600 ~/.ssh/id_teste</code> e repita — o erro muda de natureza (agora vira autenticação, que é outro assunto).' },
      {
        box: 'key', body: [
          { p: 'A pergunta certa diante de um <code>Permission denied</code> não é "como abrir tudo?", e sim "<strong>qual identidade</strong> precisa de <strong>qual acesso</strong> a <strong>qual caminho</strong>?". Quase sempre a resposta correta é ajustar o grupo (aula 5.4) e usar <code>640</code>/<code>750</code>.' }
        ]
      },

      { h2: 'Octal ou simbólico?' },
      {
        table: {
          head: ['Situação', 'Prefira', 'Por quê'],
          rows: [
            ['Definir um padrão conhecido (<code>600</code>, <code>755</code>)', 'octal', 'você declara o estado final, sem depender do que estava lá'],
            ['Ligar ou desligar um bit específico', 'simbólico', 'não mexe no que você não citou'],
            ['Arquivo que pode ter SUID/SGID', 'simbólico', 'octal de três dígitos zera os bits especiais'],
            ['<code>-R</code> em uma árvore mista', 'simbólico com <code>X</code>', 'preserva a distinção entre diretório e arquivo'],
            ['Scripts de instalação', 'octal', 'idempotente: rodar duas vezes dá o mesmo resultado']
          ]
        }
      }
    ],
    tasks: [
      {
        id: 't5-3-a', kind: 'guiado', title: 'Leia os modos do sistema',
        body: [
          { p: 'Treine a conversão nos dois sentidos com arquivos reais.' },
          { code: ['$ stat -c "%a %A %U:%G %n" /etc/passwd /etc/shadow /tmp /usr/bin/passwd /home/aluno'] },
          { p: 'Antes de rodar o próximo bloco, tente prever cada octal:' },
          {
            code: [
              '$ cd ~ && touch m1 m2 m3',
              '$ chmod 600 m1 && chmod 754 m2 && chmod 444 m3',
              '$ stat -c "%a %A %n" m1 m2 m3'
            ]
          },
          { p: 'Agora o inverso: o que é <code>-rwxr-x---</code> em octal? Confirme:' },
          { code: ['$ chmod 750 m1 && stat -c "%a %A %n" m1'] }
        ],
        hints: ['<code>%a</code> é o modo em octal, <code>%A</code> em letras — o <code>stat</code> é sua tabela de conversão viva.'],
        solution: '<div class="code"><pre>stat -c "%a %A %U:%G %n" /etc/passwd /etc/shadow /tmp /usr/bin/passwd /home/aluno\ncd ~ &amp;&amp; touch m1 m2 m3\nchmod 600 m1 &amp;&amp; chmod 754 m2 &amp;&amp; chmod 444 m3\nstat -c "%a %A %n" m1 m2 m3\nchmod 750 m1 &amp;&amp; stat -c "%a %A %n" m1</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /stat\s+-c/), 'Use <code>stat -c "%a %A %n"</code> para ver os modos.'],
          [H.mode(ctx, '/home/aluno/m2') === 0o754, 'Crie <code>~/m2</code> com modo <code>754</code>.'],
          [H.mode(ctx, '/home/aluno/m3') === 0o444, 'Crie <code>~/m3</code> com modo <code>444</code>.'],
          [H.mode(ctx, '/home/aluno/m1') === 0o750, 'Termine com <code>~/m1</code> em <code>750</code> (<code>-rwxr-x---</code>).']
        ])
      },
      {
        id: 't5-3-f', kind: 'fill', title: 'Traduza para octal',
        body: [
          { p: 'Um arquivo de credenciais deve ficar assim: o dono lê e escreve; o grupo apenas lê; outros não têm nada.' },
          { p: 'Complete com o modo octal de três dígitos:' }
        ],
        template: 'chmod ___ ~/credenciais.env', sample: '640',
        answers: ['640'],
        hints: ['Dono: <code>rw-</code>. Grupo: <code>r--</code>. Outros: <code>---</code>.', '4+2=6 para o dono, 4 para o grupo, 0 para outros.'],
        solution: 'A resposta é <code>640</code> — <code>rw-r-----</code>. Se nem o grupo pudesse ler, seria <code>600</code>, o modo correto para um <code>.env</code> de produção que só o serviço dono acessa.',
        check: async (ctx) => LX.H.checkAll([
          [/^0?640$/.test((ctx.vals[0] || '').trim()), 'Some 4 (r) + 2 (w) para o dono, 4 para o grupo e 0 para outros.']
        ])
      },
      {
        id: 't5-3-b', kind: 'desafio', title: 'Endureça o diretório de segredos',
        body: [
          { p: 'Monte a estrutura abaixo e deixe-a nas permissões que um servidor de produção exigiria.' },
          {
            code: [
              '$ rm -rf ~/segredos && mkdir -p ~/segredos',
              '$ echo "DB_PASS=trocar" > ~/segredos/.env',
              '$ echo "chave-privada-falsa" > ~/segredos/id_app',
              '$ printf \'#!/bin/bash\\necho rodando\\n\' > ~/segredos/start.sh',
              '$ chmod -R 777 ~/segredos',
              '$ ls -la ~/segredos'
            ]
          },
          { p: 'Objetivo final, usando <strong>modos octais</strong>:' },
          {
            ul: [
              'o diretório <code>~/segredos</code>: só você entra (<code>700</code>);',
              '<code>.env</code> e <code>id_app</code>: só você lê e escreve, sem execução;',
              '<code>start.sh</code>: só você lê, escreve e executa.'
            ]
          },
          { p: 'Depois comprove com <code>stat</code> que nenhum arquivo tem qualquer bit para grupo ou outros.' }
        ],
        hints: [
          'São dois modos: <code>600</code> para os dados e <code>700</code> para o que executa e para o diretório.',
          '<code>chmod 700 ~/segredos</code>; <code>chmod 600 ~/segredos/.env ~/segredos/id_app</code>; <code>chmod 700 ~/segredos/start.sh</code>.'
        ],
        solution: '<div class="code"><pre>chmod 700 ~/segredos\nchmod 600 ~/segredos/.env ~/segredos/id_app\nchmod 700 ~/segredos/start.sh\nstat -c "%a %n" ~/segredos ~/segredos/.env ~/segredos/id_app ~/segredos/start.sh</pre></div><p style="margin-top:8px">Esse é literalmente o conjunto que o OpenSSH exige de <code>~/.ssh</code>: <code>700</code> no diretório, <code>600</code> nas chaves privadas.</p>',
        check: async (ctx) => {
          const d = H.mode(ctx, '/home/aluno/segredos');
          if (d === null) return { ok: false, msg: 'Crie a estrutura <code>~/segredos</code> com o bloco do enunciado.' };
          const env = H.mode(ctx, '/home/aluno/segredos/.env');
          const key = H.mode(ctx, '/home/aluno/segredos/id_app');
          const sh = H.mode(ctx, '/home/aluno/segredos/start.sh');
          return LX.H.checkAll([
            [env !== null && key !== null && sh !== null, 'Os três arquivos (<code>.env</code>, <code>id_app</code>, <code>start.sh</code>) precisam existir.'],
            [d === 0o700, `O diretório deve ficar em <code>700</code>. Modo atual: ${d.toString(8)}.`],
            [env === 0o600, `O <code>.env</code> deve ficar em <code>600</code>. Modo atual: ${env.toString(8)}.`],
            [key === 0o600, `O <code>id_app</code> deve ficar em <code>600</code>. Modo atual: ${key.toString(8)}.`],
            [sh === 0o700, `O <code>start.sh</code> deve ficar em <code>700</code>. Modo atual: ${sh.toString(8)}.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 5.4 ============================== */
  LX.lesson('m05', {
    id: 'l5-4', n: '5.4', title: 'Dono e grupo: chown e chgrp',
    goal: 'Mudar a identidade de um arquivo, entender por que só o root pode doar arquivos e usar grupos para resolver acesso compartilhado sem abrir tudo.',
    brief: [
      { p: '<code>chown</code> muda o dono e, opcionalmente, o grupo; <code>chgrp</code> muda apenas o grupo. Trocar o dono exige privilégio administrativo. Um usuário só pode apontar seus arquivos para grupos dos quais participa.' },
      { code: ['$ sudo chown ana:devs relatorio.txt', '$ chgrp devs relatorio.txt', '$ sudo chown -R ana:devs /srv/projeto'] },
      { p: 'Para compartilhar uma pasta, crie um grupo, adicione os usuários e dê acesso ao grupo. Isso preserva o controle e evita abrir escrita para todos com <code>chmod 777</code>.' }
    ],
    body: [
      { p: 'Permissão sem identidade não significa nada. <code>rw-r-----</code> só é útil quando se sabe <em>quem</em> é o dono e <em>qual</em> é o grupo — e é isso que <code>chown</code> e <code>chgrp</code> definem.' },
      { cmd: 'chown' },
      {
        code: [
          'chown [OPÇÕES] DONO[:GRUPO] ARQUIVO...',
          '',
          '  chown ana arq          muda só o dono',
          '  chown ana:devs arq     muda dono e grupo',
          '  chown :devs arq        muda só o grupo (igual a chgrp devs arq)',
          '  chown ana: arq         dono ana + grupo primário de ana',
          '',
          '  -R                     recursivo',
          '  --reference=OUTRO      copia dono e grupo de outro arquivo',
          '  --from=dono:grupo      só muda se o atual for esse (seguro em scripts)',
          '  -h                     age no link simbólico, não no destino'
        ], run: false, lang: 'text'
      },

      { h2: 'Por que você não pode dar um arquivo para outra pessoa' },
      { p: 'Tente:' },
      { code: ['$ cd ~ && echo teste > meu.txt', '$ chown root meu.txt'] },
      { p: 'O erro é <code>Operation not permitted</code> — e não é frescura. Se qualquer usuário pudesse doar arquivos, seria trivial burlar cotas de disco (crio um arquivo de 10 GB e "dou" para outro) e plantar arquivos armadilhados com o nome de terceiros. Em Linux, <strong>doar exige root</strong>.' },
      { code: ['$ sudo chown root meu.txt && ls -l meu.txt', '$ sudo chown aluno:aluno meu.txt && ls -l meu.txt'] },
      {
        box: 'note', body: [
          { p: 'Mudar apenas o <strong>grupo</strong> é diferente: você pode, desde que seja o dono do arquivo <em>e</em> membro do grupo de destino. Faz sentido — você não está transferindo nada para fora do seu alcance.' }
        ]
      },

      { h2: 'Grupos: a solução para "preciso compartilhar, mas não com todo mundo"' },
      { p: 'Este é o padrão que resolve a maioria dos casos em que alguém acabaria digitando <code>chmod 777</code>:' },
      {
        ol: [
          'crie um grupo para a necessidade (<code>sudo groupadd projeto</code> ou <code>sudo addgroup projeto</code>);',
          'coloque as pessoas nele (<code>sudo usermod -aG projeto ana</code>);',
          'aponte o diretório para o grupo (<code>sudo chgrp -R projeto /srv/projeto</code>);',
          'dê ao grupo o que ele precisa e nada a outros (<code>chmod -R 770</code>);',
          'garanta que arquivos novos herdem o grupo (SGID, aula 5.6).'
        ]
      },
      { p: 'O curso trata a criação de usuários e grupos em detalhe no módulo 6; aqui interessa o efeito nas permissões. Experimente o ciclo completo:' },
      {
        code: [
          '$ sudo groupadd projeto 2>/dev/null; sudo useradd -m -G projeto ana 2>/dev/null',
          '$ sudo usermod -aG projeto aluno',
          '$ sudo mkdir -p /srv/projeto',
          '$ sudo chgrp -R projeto /srv/projeto',
          '$ sudo chmod -R 770 /srv/projeto',
          '$ ls -ld /srv/projeto',
          '$ getent group projeto'
        ]
      },
      {
        box: 'warn', label: 'Por que ainda dá Permission denied depois disso', body: [
          { p: 'Sua sessão atual continua com a lista de grupos antiga. Confirme com <code>id</code>: o grupo novo não aparece. Numa máquina real você faria logout/login ou <code>newgrp projeto</code>. Nos desafios deste curso, quando for necessário, use <code>sudo</code> para agir com a lista atualizada.' }
        ]
      },

      { h2: 'chgrp e as formas equivalentes' },
      { cmd: 'chgrp' },
      { code: ['$ sudo chgrp projeto ~/meu.txt && ls -l ~/meu.txt', '$ sudo chown :aluno ~/meu.txt && ls -l ~/meu.txt'] },
      { p: '<code>chgrp X arq</code> e <code>chown :X arq</code> fazem exatamente a mesma coisa. Use o que ficar mais legível no seu script.' },

      { h2: 'Recursão e links: dois detalhes que mordem' },
      { p: 'O <code>-R</code> segue a árvore, mas o comportamento com links simbólicos merece atenção:' },
      {
        table: {
          head: ['Forma', 'Efeito'],
          rows: [
            ['<code>chown -R</code>', 'não segue links dentro da árvore (padrão seguro)'],
            ['<code>chown -h</code>', 'muda o dono do <strong>link</strong>, não do destino'],
            ['<code>chown -RL</code>', 'segue links — perigoso: pode escapar da árvore que você quis alterar']
          ]
        }
      },
      { p: 'E o <code>--from</code> é a rede de segurança para scripts:' },
      { code: ['$ sudo chown --from=root aluno ~/meu.txt 2>&1; ls -l ~/meu.txt'] },
      { p: 'Se o dono atual não for <code>root</code>, o comando não faz nada — em vez de aplicar às cegas em uma árvore inteira.' },
      {
        box: 'old', label: 'Prática antiga × prática atual', body: [
          { p: 'Você vai encontrar tutoriais antigos resolvendo problemas de acesso com <code>chown -R www-data:www-data /var/www</code> seguido de <code>chmod -R 777</code>. Hoje isso é considerado errado por dois motivos: o serviço web passa a poder <strong>reescrever o próprio código</strong> (um bug de upload vira execução remota), e qualquer usuário da máquina também.' },
          { p: 'O padrão atual: os arquivos pertencem ao usuário que faz o deploy, o grupo é o do serviço, o serviço só <strong>lê</strong> (<code>640</code>/<code>750</code>), e apenas os poucos diretórios que precisam gravar (uploads, cache) recebem escrita. <strong>Aprenda essa versão.</strong>' }
        ]
      }
    ],
    tasks: [
      {
        id: 't5-4-a', kind: 'guiado', title: 'Doe, receba e devolva',
        body: [
          { p: 'Veja a recusa, o efeito do root e a diferença entre dono e grupo.' },
          {
            code: [
              '$ cd ~ && echo teste > meu.txt',
              '$ chown root meu.txt',
              '$ sudo chown root:root meu.txt && ls -l meu.txt',
              '$ cat meu.txt',
              '$ echo "nova linha" >> meu.txt'
            ]
          },
          { p: 'Repare: você ainda <em>lê</em> (o modo permite a outros), mas não escreve mais. Devolva o arquivo para você:' },
          { code: ['$ sudo chown aluno:aluno meu.txt && ls -l meu.txt', '$ echo "nova linha" >> meu.txt && cat meu.txt'] }
        ],
        hints: ['<code>sudo</code> executa o comando como root; sem ele, a doação é recusada.'],
        solution: '<div class="code"><pre>cd ~ &amp;&amp; echo teste &gt; meu.txt\nchown root meu.txt\nsudo chown root:root meu.txt\nls -l meu.txt\nsudo chown aluno:aluno meu.txt\necho "nova linha" &gt;&gt; meu.txt\nls -l meu.txt</pre></div>',
        check: async (ctx) => {
          const o = H.owner(ctx, '/home/aluno/meu.txt');
          return LX.H.checkAll([
            [o !== null, 'Crie o arquivo <code>~/meu.txt</code>.'],
            [() => H.usedCommand(ctx, /sudo\s+chown\s+root/), 'Passe o arquivo para o root com <code>sudo chown root:root meu.txt</code>.'],
            [() => H.usedCommand(ctx, /sudo\s+chown\s+aluno/), 'Devolva o arquivo para você com <code>sudo chown aluno:aluno meu.txt</code>.'],
            [() => o && o.user === 'aluno', () => `O arquivo precisa terminar pertencendo a <code>aluno</code>. Dono atual: <code>${o ? o.user : '—'}</code>.`]
          ]);
        }
      },
      {
        id: 't5-4-q', kind: 'quiz', title: 'Encontre o erro no raciocínio',
        body: [
          { p: 'Um serviço web roda como o usuário <code>www-data</code> e precisa <strong>ler</strong> os arquivos de <code>/var/www/site</code>, além de <strong>gravar</strong> apenas em <code>/var/www/site/uploads</code>. Qual configuração é a adequada hoje?' }
        ],
        options: [
          {
            text: 'Arquivos <code>deploy:www-data</code> com <code>640</code>, diretórios <code>750</code>, e só <code>uploads</code> como <code>www-data:www-data</code> com <code>750</code>.',
            correct: true
          },
          { text: '<code>chown -R www-data:www-data /var/www/site</code> e <code>chmod -R 755</code>.', why: 'O serviço passa a ser dono do próprio código: qualquer falha que permita escrever um arquivo vira execução de código no servidor.' },
          { text: '<code>chmod -R 777 /var/www/site</code>, que é o que a maioria dos tutoriais manda.', why: 'Além do problema acima, qualquer usuário ou processo da máquina pode alterar o site.' },
          { text: 'Rodar o serviço como <code>root</code> — assim não há problema de permissão nenhum.', why: 'É a pior opção: uma falha no serviço passa a ser controle total da máquina. Serviços rodam com usuário próprio e sem privilégio justamente por isso.' }
        ],
        explain: 'O princípio é o do <strong>menor privilégio</strong>: cada identidade recebe o mínimo necessário. Dono é quem publica, grupo é quem lê, escrita existe apenas onde é indispensável. Esse desenho transforma uma falha grave (escrever no código) em uma falha contornável (escrever numa pasta de uploads que não executa nada).'
      },
      {
        id: 't5-4-b', kind: 'desafio', title: 'Compartilhe sem abrir para o mundo',
        body: [
          { p: 'A equipe precisa de um diretório em <code>/srv/relatorios</code> que atenda a três exigências:' },
          {
            ul: [
              'pertence ao usuário <code>root</code> e ao grupo <code>projeto</code>;',
              'membros do grupo podem ler, criar e apagar arquivos lá dentro;',
              'quem não é do grupo <strong>não vê nem entra</strong> — nenhum bit para "outros".'
            ]
          },
          { p: 'O grupo <code>projeto</code> pode ainda não existir; crie-o se for o caso. Depois grave dentro um arquivo <code>leia.txt</code> com qualquer conteúdo e confirme o resultado com <code>ls -ld</code>.' }
        ],
        hints: [
          'Crie o grupo com <code>sudo groupadd projeto</code> (ou confira com <code>getent group projeto</code>).',
          'Dono e grupo: <code>sudo chown root:projeto /srv/relatorios</code>. Bits: <code>770</code>.',
          'Sequência: <code>sudo groupadd projeto</code>; <code>sudo mkdir -p /srv/relatorios</code>; <code>sudo chown root:projeto /srv/relatorios</code>; <code>sudo chmod 770 /srv/relatorios</code>; <code>sudo touch /srv/relatorios/leia.txt</code>.'
        ],
        solution: '<div class="code"><pre>sudo groupadd projeto\nsudo mkdir -p /srv/relatorios\nsudo chown root:projeto /srv/relatorios\nsudo chmod 770 /srv/relatorios\necho "relatorios da equipe" | sudo tee /srv/relatorios/leia.txt &gt; /dev/null\nls -ld /srv/relatorios\nls -l /srv/relatorios</pre></div><p style="margin-top:8px">Esse é o esqueleto de qualquer diretório compartilhado. Falta um detalhe que você vai resolver na aula 5.6: garantir que <em>arquivos novos</em> nasçam com o grupo <code>projeto</code>, e não com o grupo de quem criou.</p>',
        check: async (ctx) => {
          const d = H.mode(ctx, '/srv/relatorios');
          if (d === null) return { ok: false, msg: 'O diretório <code>/srv/relatorios</code> ainda não existe.' };
          const o = H.owner(ctx, '/srv/relatorios');
          return LX.H.checkAll([
            [o.user === 'root', `O diretório deve pertencer ao <code>root</code>. Dono atual: <code>${o.user}</code>.`],
            [o.group === 'projeto', `O grupo deve ser <code>projeto</code>. Grupo atual: <code>${o.group}</code>.`],
            [(d & 0o070) === 0o070, `O grupo precisa de <code>rwx</code> (ler, criar e apagar). Modo atual: ${d.toString(8)}.`],
            [(d & 0o007) === 0, `Outros não podem ter nenhum bit. Modo atual: ${d.toString(8)}.`],
            [H.exists(ctx, '/srv/relatorios/leia.txt'), 'Crie o arquivo <code>/srv/relatorios/leia.txt</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 5.5 ============================== */
  LX.lesson('m05', {
    id: 'l5-5', n: '5.5', title: 'umask: por que os arquivos nascem 644',
    goal: 'Entender de onde vem a permissão de um arquivo recém-criado e como mudá-la para a sessão inteira ou permanentemente.',
    brief: [
      { p: '<code>umask</code> remove permissões do modo pedido pelo programa. Arquivos partem de <code>666</code> e diretórios de <code>777</code>; com a máscara <code>022</code>, eles normalmente nascem como <code>644</code> e <code>755</code>.' },
      { code: ['$ umask', '$ umask 077', '$ touch segredo.txt', '$ stat -c "%a %n" segredo.txt'] },
      { p: 'A máscara <code>077</code> cria itens privados; <code>002</code> permite escrita do grupo. A mudança vale para a sessão e seus processos filhos. Arquivos comuns não ganham execução pela umask, pois o modo base <code>666</code> não contém <code>x</code>.' }
    ],
    body: [
      { p: 'Ninguém roda <code>chmod</code> depois de cada <code>touch</code>, e mesmo assim seus arquivos nascem <code>rw-r--r--</code> e seus diretórios <code>rwxr-xr-x</code>. Quem decide isso é a <strong>umask</strong>.' },
      { p: 'A ideia é o inverso do <code>chmod</code>: a umask é uma <strong>máscara de remoção</strong>. Os programas pedem ao kernel um modo generoso, e a umask apaga bits desse pedido.' },
      {
        ascii: `pedido do programa      arquivos: 666  (rw-rw-rw-)   nunca 777: quem cria um
                        diretórios: 777 (rwxrwxrwx)   arquivo já executável?

        umask 022    →  apaga o w de grupo e de outros

resultado               arquivos: 666 - 022 = 644  (rw-r--r--)
                        diretórios: 777 - 022 = 755 (rwxr-xr-x)`
      },
      {
        box: 'key', body: [
          { p: 'É por isso que <code>touch script.sh</code> nunca cria um arquivo executável, por mais que a umask seja <code>000</code>: o pedido base para arquivos é <strong>666</strong>, e o bit <code>x</code> simplesmente não está lá para ser preservado. O <code>x</code> é sempre uma decisão explícita.' }
        ]
      },
      { p: 'Veja a conta acontecendo:' },
      { cmd: 'umask' },
      {
        code: [
          '$ umask',
          '$ umask -S',
          '$ cd ~ && touch padrao.txt && mkdir -p padrao.d && ls -ld padrao.txt padrao.d',
          '$ umask 077',
          '$ touch privado.txt && mkdir -p privado.d && ls -ld privado.txt privado.d',
          '$ umask 002',
          '$ touch equipe.txt && ls -l equipe.txt',
          '$ umask 022'
        ]
      },
      { p: 'A saída de <code>umask</code> sem argumentos é octal (<code>0022</code>); com <code>-S</code> ela mostra o que <em>fica permitido</em>, em formato simbólico — repare que a leitura é oposta.' },

      { h2: 'As três umasks que existem na prática' },
      {
        table: {
          head: ['umask', 'Arquivo', 'Diretório', 'Uso'],
          rows: [
            ['<code>022</code>', '644', '755', 'padrão da maioria das distribuições; o mundo lê'],
            ['<code>002</code>', '664', '775', 'servidores de equipe com grupo por usuário; o grupo escreve'],
            ['<code>027</code>', '640', '750', 'endurecido: grupo lê, outros não veem nada'],
            ['<code>077</code>', '600', '700', 'máquinas com dados sensíveis; só você']
          ]
        }
      },
      { p: 'Debian e Ubuntu usam <code>022</code> para o root e <code>002</code> para usuários comuns quando o esquema UPG (um grupo privado por usuário) está ativo — como cada usuário é o único membro do próprio grupo, permitir escrita ao grupo não expõe nada.' },

      { h2: 'Onde ela é definida' },
      {
        table: {
          head: ['Escopo', 'Onde', 'Vale para'],
          rows: [
            ['sessão atual', '<code>umask 027</code> no terminal', 'só até você fechar o shell'],
            ['seu usuário', '<code>~/.bashrc</code> ou <code>~/.profile</code>', 'todos os seus shells'],
            ['todos os usuários', '<code>/etc/profile</code>, <code>/etc/login.defs</code> (<code>UMASK</code>)', 'logins interativos'],
            ['um serviço', '<code>UMask=0027</code> na unit do systemd', 'apenas aquele serviço']
          ]
        }
      },
      {
        box: 'warn', body: [
          { p: 'A umask é herdada pelos processos filhos, mas <strong>não vale para arquivos copiados</strong>: <code>cp</code> preserva o modo da origem (a menos que a origem seja mais permissiva que a umask), e <code>cp -p</code>/<code>rsync -a</code> preservam tudo. Alterar a umask não conserta arquivos que já existem — para isso é <code>chmod</code>.' }
        ]
      },
      {
        box: 'old', label: 'Prática antiga × atual', body: [
          { p: 'Tutoriais antigos ensinam a colocar <code>umask 002</code> em <code>/etc/profile</code> para diretórios compartilhados. Isso mexe na máquina inteira por causa de um diretório.' },
          { p: 'Hoje a solução é local ao diretório: <strong>SGID</strong> (próxima aula) para herdar o grupo e, se necessário, uma <strong>ACL padrão</strong> para herdar as permissões. <strong>Aprenda essa versão</strong> — a umask fica como ajuste de perfil pessoal.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't5-5-a', kind: 'guiado', title: 'Veja a subtração acontecer',
        body: [
          { p: 'Compare o mesmo <code>touch</code> sob três umasks diferentes.' },
          {
            code: [
              '$ cd ~ && mkdir -p mascara && cd mascara',
              '$ umask 022 && touch a022.txt && mkdir -p d022',
              '$ umask 077 && touch a077.txt && mkdir -p d077',
              '$ umask 002 && touch a002.txt && mkdir -p d002',
              '$ umask 022',
              '$ stat -c "%a %A %n" a*.txt d0*',
              '$ cd ~'
            ]
          },
          { p: 'Confirme mentalmente cada conta: 666 menos a máscara para arquivos, 777 menos a máscara para diretórios.' }
        ],
        hints: ['A umask vale a partir do momento em que é definida — arquivos criados antes não mudam.'],
        solution: '<div class="code"><pre>cd ~ &amp;&amp; mkdir -p mascara &amp;&amp; cd mascara\numask 022 &amp;&amp; touch a022.txt &amp;&amp; mkdir -p d022\numask 077 &amp;&amp; touch a077.txt &amp;&amp; mkdir -p d077\numask 002 &amp;&amp; touch a002.txt &amp;&amp; mkdir -p d002\numask 022\nstat -c "%a %A %n" a*.txt d0*\ncd ~</pre></div>',
        check: async (ctx) => {
          const b = '/home/aluno/mascara/';
          const a22 = H.mode(ctx, b + 'a022.txt'), a77 = H.mode(ctx, b + 'a077.txt'), a02 = H.mode(ctx, b + 'a002.txt');
          const d77 = H.mode(ctx, b + 'd077');
          return LX.H.checkAll([
            [a22 !== null && a77 !== null && a02 !== null, 'Crie os três arquivos dentro de <code>~/mascara</code>, cada um sob uma umask diferente.'],
            [a22 === 0o644, () => `Com <code>umask 022</code> o arquivo deveria nascer <code>644</code>; nasceu ${(a22 || 0).toString(8)}.`],
            [a77 === 0o600, () => `Com <code>umask 077</code> o arquivo deveria nascer <code>600</code>; nasceu ${(a77 || 0).toString(8)}.`],
            [a02 === 0o664, () => `Com <code>umask 002</code> o arquivo deveria nascer <code>664</code>; nasceu ${(a02 || 0).toString(8)}.`],
            [d77 === 0o700, `Com <code>umask 077</code> o diretório deveria nascer <code>700</code>; nasceu ${d77 === null ? 'inexistente' : d77.toString(8)}.`]
          ]);
        }
      },
      {
        id: 't5-5-q', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Com <code>umask 077</code> ativa, você roda:' },
          { code: ['touch novo.sh'], run: false, mixed: false },
          { p: 'Qual é o modo do <code>novo.sh</code>?' }
        ],
        options: [
          { text: '<code>600</code> — o pedido base para arquivos é 666, e a máscara apaga tudo de grupo e de outros.', correct: true },
          { text: '<code>700</code> — porque o nome termina em <code>.sh</code>.', why: 'A extensão não significa nada para o kernel. O bit de execução só entra com <code>chmod</code>.' },
          { text: '<code>777</code> menos <code>077</code> = <code>700</code>.', why: 'O 777 é o pedido base de <strong>diretórios</strong>. Arquivos pedem 666.' },
          { text: '<code>644</code> — a umask não afeta o <code>touch</code>.', why: 'A umask afeta qualquer criação de arquivo, inclusive a do <code>touch</code>.' }
        ],
        explain: 'Base 666, máscara 077 → 600. E como 666 não tem bits de execução, nenhuma umask consegue criar um arquivo executável: essa é uma proteção deliberada do sistema.'
      },
      {
        id: 't5-5-b', kind: 'desafio', title: 'Um shell que só cria coisas privadas',
        body: [
          { p: 'Você vai trabalhar por alguns minutos com dados sensíveis e quer que <strong>tudo</strong> que criar nasça inacessível para grupo e outros — sem precisar lembrar de <code>chmod</code> a cada arquivo.' },
          { p: 'Configure a sessão para isso e comprove criando a estrutura <code>~/sigilo/dados.txt</code> (com qualquer conteúdo) e o diretório <code>~/sigilo/arquivo-morto</code>.' },
          { p: 'Requisito: os arquivos e diretórios criados dentro de <code>~/sigilo</code> devem sair de fábrica em <code>600</code> e <code>700</code> — <strong>sem</strong> usar <code>chmod</code> em nenhum momento.' }
        ],
        hints: [
          'Existe uma máscara que apaga todos os bits de grupo e de outros.',
          'Defina <code>umask 077</code> <em>antes</em> de criar qualquer coisa; a ordem importa.'
        ],
        solution: '<div class="code"><pre>umask 077\nmkdir -p ~/sigilo/arquivo-morto\necho "dados sensiveis" &gt; ~/sigilo/dados.txt\nstat -c "%a %n" ~/sigilo ~/sigilo/dados.txt ~/sigilo/arquivo-morto\numask 022</pre></div><p style="margin-top:8px">Repare que o próprio <code>~/sigilo</code> também nasceu <code>700</code>. Em um servidor real, a linha <code>umask 077</code> entraria no <code>~/.bashrc</code> do usuário responsável.</p>',
        check: async (ctx) => {
          const d = H.mode(ctx, '/home/aluno/sigilo');
          if (d === null) return { ok: false, msg: 'Crie o diretório <code>~/sigilo</code>.' };
          const f = H.mode(ctx, '/home/aluno/sigilo/dados.txt');
          const sub = H.mode(ctx, '/home/aluno/sigilo/arquivo-morto');
          return LX.H.checkAll([
            [f !== null, 'Crie o arquivo <code>~/sigilo/dados.txt</code>.'],
            [sub !== null, 'Crie o diretório <code>~/sigilo/arquivo-morto</code>.'],
            [() => H.usedCommand(ctx, /umask\s+0?77/), 'Defina a máscara com <code>umask 077</code> antes de criar os arquivos.'],
            [!H.usedCommand(ctx, /chmod\s+[0-7]*\s*.*sigilo/), 'O desafio pede para não usar <code>chmod</code> nos itens de <code>~/sigilo</code> — refaça a partir da umask (apague com <code>rm -rf ~/sigilo</code> e recomece).'],
            [f === 0o600, `O <code>dados.txt</code> deveria ter nascido <code>600</code>; está ${f.toString(8)}. Defina a umask <strong>antes</strong> de criar o arquivo.`],
            [sub === 0o700, `O <code>arquivo-morto</code> deveria ter nascido <code>700</code>; está ${sub.toString(8)}.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 5.6 ============================== */
  LX.lesson('m05', {
    id: 'l5-6', n: '5.6', title: 'Bits especiais: SUID, SGID e sticky',
    goal: 'Entender os três bits que quebram as regras normais — por que existem, onde são indispensáveis e por que são o primeiro lugar que um invasor olha.',
    brief: [
      { p: 'SUID (<code>4000</code>) executa um programa com a identidade do dono. SGID (<code>2000</code>) faz arquivos novos em um diretório herdarem seu grupo. Sticky (<code>1000</code>) impede que usuários apaguem arquivos alheios em uma pasta compartilhada.' },
      { code: ['$ stat -c "%a %A %n" /usr/bin/passwd /tmp', '$ chmod 2770 /srv/equipe', '$ chmod 1777 /srv/publico'] },
      { p: 'SUID em programas do root exige auditoria rigorosa. Para diretórios de equipe, SGID mantém o grupo correto; para áreas públicas como <code>/tmp</code>, sticky permite criação sem liberar a remoção dos arquivos dos outros.' }
    ],
    body: [
      { p: 'Os nove bits de <code>rwx</code> resolvem quase tudo. Sobram três problemas que eles não conseguem resolver, e para cada um existe um bit especial — o quarto dígito do <code>chmod</code>.' },
      {
        table: {
          head: ['Bit', 'Octal', 'Aparece como', 'Onde faz sentido'],
          rows: [
            ['<strong>SUID</strong>', '4000', '<code>s</code> no lugar do <code>x</code> do dono', 'programas que precisam de poder do dono'],
            ['<strong>SGID</strong>', '2000', '<code>s</code> no lugar do <code>x</code> do grupo', 'programas e, principalmente, <strong>diretórios</strong> compartilhados'],
            ['<strong>sticky</strong>', '1000', '<code>t</code> no lugar do <code>x</code> de outros', 'diretórios públicos de escrita, como <code>/tmp</code>']
          ]
        }
      },
      {
        box: 'note', body: [
          { p: 'Se a letra aparecer <strong>maiúscula</strong> (<code>S</code> ou <code>T</code>), o bit especial está ligado mas o <code>x</code> correspondente <strong>não</strong> — quase sempre um engano. <code>-rwSr--r--</code> é um SUID que nunca vai disparar.' }
        ]
      },

      { h2: 'SUID: o problema da troca de senha' },
      { p: 'Sua senha fica em <code>/etc/shadow</code>. Olhe as permissões desse arquivo e do programa que o altera:' },
      { code: ['$ ls -l /etc/shadow /usr/bin/passwd'] },
      { p: 'O <code>shadow</code> é <code>640 root:shadow</code>: você não pode nem ler. Mesmo assim, <code>passwd</code> funciona para trocar a <em>sua</em> senha. Como?' },
      { p: 'O <code>passwd</code> tem SUID e pertence ao root. Quando <strong>você</strong> o executa, o processo roda com os privilégios do <strong>dono do arquivo</strong>, e não com os seus. O programa então checa internamente quem chamou e só deixa alterar a linha daquele usuário.' },
      {
        ascii: `sem SUID                          com SUID (dono = root)

você ──▶ programa (roda como você) você ──▶ programa (roda como ROOT)
              │                                  │
              ▼                                  ▼
        /etc/shadow  ✗ negado             /etc/shadow  ✓ permitido
                                          (o programa decide o que liberar)`
      },
      { p: 'Procure os SUID da máquina — é um bom hábito de auditoria:' },
      { code: ['$ find /usr/bin /usr/sbin -perm -4000 -type f 2>/dev/null'] },
      {
        box: 'warn', label: 'Por que SUID é território minado', body: [
          { p: 'Um programa SUID de root com uma falha é uma escalada de privilégio pronta. Por isso: nunca coloque SUID em algo que você escreveu sem uma revisão séria, e saiba que <strong>o kernel ignora SUID em scripts</strong> (arquivos com <code>#!</code>) — a condição de corrida entre ler o cabeçalho e executar o interpretador era explorável, então essa porta foi fechada há décadas.' },
          { p: 'A alternativa moderna para "este comando precisa de um poder específico" é <code>sudo</code> com uma regra restrita, ou <strong>capabilities</strong> (<code>setcap cap_net_bind_service=+ep</code>), que concedem um poder pontual em vez de virar root inteiro.' }
        ]
      },

      { h2: 'SGID em diretórios: o bit que resolve o compartilhamento' },
      { p: 'Em um programa, SGID faz ele rodar com o grupo do arquivo. Em um <strong>diretório</strong>, ele faz algo muito mais útil no dia a dia: <strong>tudo que nasce dentro herda o grupo do diretório</strong>, em vez do grupo primário de quem criou. E subdiretórios herdam também o próprio bit.' },
      { p: 'Sem SGID, o diretório da equipe estraga sozinho: cada pessoa cria arquivos com o próprio grupo, e os colegas param de conseguir editar. Compare os dois casos:' },
      {
        code: [
          '$ sudo groupadd equipe 2>/dev/null; sudo usermod -aG equipe aluno',
          '$ sudo mkdir -p /srv/sem-sgid /srv/com-sgid',
          '$ sudo chown root:equipe /srv/sem-sgid /srv/com-sgid',
          '$ sudo chmod 770 /srv/sem-sgid',
          '$ sudo chmod 2770 /srv/com-sgid',
          '$ sudo touch /srv/sem-sgid/arq.txt /srv/com-sgid/arq.txt',
          '$ sudo ls -l /srv/sem-sgid /srv/com-sgid'
        ]
      },
      { p: 'O arquivo em <code>sem-sgid</code> saiu com o grupo de quem criou (<code>root</code>); em <code>com-sgid</code>, saiu com <code>equipe</code>. É essa diferença que mantém um diretório colaborativo funcionando por meses.' },

      { h2: 'Sticky bit: escrita pública sem terra de ninguém' },
      { p: 'Lembre da aula 5.1: apagar depende do <code>w</code> do <em>diretório</em>. Em <code>/tmp</code>, que é <code>rwxrwxrwx</code>, isso significaria que qualquer usuário poderia apagar os arquivos temporários de qualquer outro — inclusive os de serviços em execução.' },
      { p: 'O sticky bit muda a regra dentro daquele diretório: <strong>só o dono do arquivo, o dono do diretório ou o root podem remover ou renomear</strong>.' },
      { code: ['$ ls -ld /tmp /var/tmp', '$ stat -c "%a %A %n" /tmp'] },
      { p: 'O <code>t</code> final e o <code>1</code> na frente do <code>777</code> são o mesmo bit. Sem ele, <code>/tmp</code> seria inutilizável em uma máquina com vários usuários.' },
      {
        cheat: [
          ['<code>chmod u+s arq</code> / <code>chmod 4755 arq</code>', 'liga o SUID'],
          ['<code>chmod g+s dir</code> / <code>chmod 2775 dir</code>', 'liga o SGID (herança de grupo)'],
          ['<code>chmod +t dir</code> / <code>chmod 1777 dir</code>', 'liga o sticky bit'],
          ['<code>find / -perm -4000 -type f</code>', 'audita todos os SUID'],
          ['<code>find / -perm -2000 -type d</code>', 'lista diretórios com SGID'],
          ['<code>find /dir -perm -002 -type f</code>', 'acha arquivos graváveis por qualquer um']
        ]
      }
    ],
    tasks: [
      {
        id: 't5-6-a', kind: 'guiado', title: 'Os três bits, um de cada vez',
        body: [
          { p: 'Observe o SUID no sistema, a herança do SGID e o sticky do <code>/tmp</code>.' },
          {
            code: [
              '$ ls -l /etc/shadow /usr/bin/passwd /usr/bin/sudo',
              '$ find /usr/bin /usr/sbin -perm -4000 -type f 2>/dev/null',
              '$ ls -ld /tmp',
              '$ sudo groupadd equipe 2>/dev/null; sudo mkdir -p /srv/sem-sgid /srv/com-sgid',
              '$ sudo chown root:equipe /srv/sem-sgid /srv/com-sgid',
              '$ sudo chmod 770 /srv/sem-sgid && sudo chmod 2770 /srv/com-sgid',
              '$ sudo touch /srv/sem-sgid/arq.txt /srv/com-sgid/arq.txt',
              '$ sudo ls -l /srv/sem-sgid /srv/com-sgid'
            ]
          },
          { p: 'Compare a coluna do grupo nos dois últimos resultados: é o efeito inteiro do SGID em uma linha.' }
        ],
        hints: ['<code>-perm -4000</code> significa "tenha ao menos esse bit"; sem o traço seria "seja exatamente esse modo".'],
        solution: '<div class="code"><pre>ls -l /etc/shadow /usr/bin/passwd\nfind /usr/bin /usr/sbin -perm -4000 -type f 2&gt;/dev/null\nls -ld /tmp\nsudo groupadd equipe\nsudo mkdir -p /srv/sem-sgid /srv/com-sgid\nsudo chown root:equipe /srv/sem-sgid /srv/com-sgid\nsudo chmod 770 /srv/sem-sgid\nsudo chmod 2770 /srv/com-sgid\nsudo touch /srv/sem-sgid/arq.txt /srv/com-sgid/arq.txt\nsudo ls -l /srv/sem-sgid /srv/com-sgid</pre></div>',
        check: async (ctx) => {
          const semS = H.owner(ctx, '/srv/sem-sgid/arq.txt');
          const comS = H.owner(ctx, '/srv/com-sgid/arq.txt');
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /find.*-perm\s+-4000/), 'Audite os binários SUID com <code>find ... -perm -4000 -type f</code>.'],
            [semS !== null && comS !== null, 'Crie os dois diretórios e um arquivo dentro de cada um, como no bloco.'],
            [H.mode(ctx, '/srv/com-sgid') & 0o2000, 'O diretório <code>/srv/com-sgid</code> precisa estar com o SGID ligado (<code>chmod 2770</code>).'],
            [() => !!comS && comS.group === 'equipe', () => `O arquivo em <code>/srv/com-sgid</code> deveria ter herdado o grupo <code>equipe</code>; está com <code>${comS ? comS.group : '—'}</code>.`],
            [() => !!semS && semS.group !== 'equipe', 'O arquivo em <code>/srv/sem-sgid</code> deveria ter saído com o grupo de quem criou — recrie o cenário do zero.']
          ]);
        }
      },
      {
        id: 't5-6-q', kind: 'quiz', title: 'Conceito: por que /tmp precisa do t',
        body: [
          { p: 'Imagine <code>/tmp</code> com modo <code>0777</code> (sem sticky). O usuário <strong>bruno</strong> quer sabotar um serviço que mantém <code>/tmp/sessao-app.sock</code>, criado pelo usuário <code>app</code>. O que ele consegue fazer?' }
        ],
        options: [
          { text: 'Apagar o arquivo, mesmo sem nenhuma permissão sobre ele — porque remover uma entrada depende do <code>w</code> do diretório.', correct: true },
          { text: 'Nada: o arquivo pertence a <code>app</code>, então só <code>app</code> pode removê-lo.', why: 'A propriedade do arquivo não é consultada na remoção; o que vale é o <code>w</code> do diretório.' },
          { text: 'Apenas ler o conteúdo, se o modo do arquivo permitir.', why: 'Ler realmente depende do modo do arquivo — mas a remoção, não. É exatamente esse o problema.' },
          { text: 'Nada, porque o kernel protege sockets automaticamente.', why: 'Não existe proteção especial por tipo de arquivo; a proteção é o sticky bit.' }
        ],
        explain: 'Com <code>1777</code>, o kernel passa a exigir que quem remove seja o dono do arquivo, o dono do diretório ou o root. Esse é o único caso em que a propriedade do arquivo entra na decisão de remoção — e é a razão de o <code>t</code> existir.'
      },
      {
        id: 't5-6-b', kind: 'desafio', title: 'Um diretório de equipe que não se estraga sozinho',
        body: [
          { p: 'Monte <code>/srv/comum</code> para o grupo <code>equipe</code> com estas três garantias:' },
          {
            ul: [
              'pertence a <code>root</code> e ao grupo <code>equipe</code>; membros do grupo leem, criam e apagam;',
              'todo arquivo criado lá dentro <strong>nasce com o grupo <code>equipe</code></strong>, independentemente de quem criou;',
              'um membro <strong>não</strong> pode apagar o arquivo de outro membro;',
              'quem não é do grupo não tem nenhum acesso.'
            ]
          },
          { p: 'Depois comprove: crie <code>/srv/comum/teste.txt</code> como root e confira o grupo resultante com <code>ls -l</code>.' },
          { p: 'Dica de leitura: cada garantia acima corresponde a um bit diferente.' }
        ],
        hints: [
          'Herança de grupo é SGID (2). Impedir que um apague o arquivo do outro é sticky (1). Some os dois no quarto dígito.',
          'O modo final é <code>3770</code>: SGID + sticky + <code>rwx</code> para dono e grupo, nada para outros.',
          'Sequência: <code>sudo groupadd equipe</code>; <code>sudo mkdir -p /srv/comum</code>; <code>sudo chown root:equipe /srv/comum</code>; <code>sudo chmod 3770 /srv/comum</code>.'
        ],
        solution: '<div class="code"><pre>sudo groupadd equipe\nsudo mkdir -p /srv/comum\nsudo chown root:equipe /srv/comum\nsudo chmod 3770 /srv/comum\nsudo touch /srv/comum/teste.txt\nls -ld /srv/comum\nsudo ls -l /srv/comum</pre></div><p style="margin-top:8px">O <code>ls -ld</code> mostra <code>drwxrws--T</code>. O <code>T</code> maiúsculo aqui está correto: outros não têm <code>x</code>, então o sticky aparece em maiúscula — e é exatamente o que queremos, já que ninguém de fora entra.</p>',
        check: async (ctx) => {
          const m = H.mode(ctx, '/srv/comum');
          if (m === null) return { ok: false, msg: 'O diretório <code>/srv/comum</code> ainda não existe.' };
          const o = H.owner(ctx, '/srv/comum');
          const arq = H.owner(ctx, '/srv/comum/teste.txt');
          return LX.H.checkAll([
            [o.group === 'equipe', `O grupo do diretório deve ser <code>equipe</code>; está <code>${o.group}</code>.`],
            [(m & 0o070) === 0o070, `O grupo precisa de <code>rwx</code>. Modo atual: ${m.toString(8)}.`],
            [(m & 0o007) === 0, `Outros não podem ter acesso nenhum. Modo atual: ${m.toString(8)}.`],
            [(m & 0o2000) !== 0, `Falta o SGID, que faz os arquivos herdarem o grupo. Modo atual: ${m.toString(8)}.`],
            [(m & 0o1000) !== 0, `Falta o sticky bit, que impede um membro de apagar o arquivo do outro. Modo atual: ${m.toString(8)}.`],
            [arq !== null, 'Crie o arquivo <code>/srv/comum/teste.txt</code> para comprovar a herança.'],
            [arq.group === 'equipe', `O arquivo criado deveria ter herdado o grupo <code>equipe</code>; saiu com <code>${arq.group}</code>. Ligue o SGID <strong>antes</strong> de criar o arquivo.`]
          ]);
        }
      },

    ]
  });

  /* ============================== 5.7 ============================== */
  LX.lesson('m05', {
    id: 'l5-7', n: '5.7', title: 'sudo, su e o root',
    goal: 'Usar privilégio administrativo do jeito atual: pontual, registrado e reversível — e entender por que "virar root" é a última opção.',
    brief: [
      { p: '<code>sudo COMANDO</code> eleva apenas uma operação, verifica a política e registra o uso. <code>sudo -u USUÁRIO</code> executa com outra identidade; isso ajuda a reproduzir problemas de serviços.' },
      { code: ['$ sudo -l', '$ sudo systemctl restart nginx', '$ sudo -u www-data cat /var/www/site/index.html'] },
      { p: 'Prefira comandos pontuais. Use <code>sudo -i</code> somente quando uma sequência realmente exigir um shell administrativo e saia assim que terminar. Confira caminhos e argumentos antes de executar algo como root.' }
    ],
    body: [
      { p: 'O root não passa por checagem de permissão. Isso resolve qualquer problema e cria outro: um comando errado como root não tem rede de proteção. A prática atual é passar o menor tempo possível com esse poder na mão.' },

      { h2: 'sudo: um comando de cada vez' },
      { cmd: 'sudo' },
      {
        code: [
          'sudo COMANDO              executa um comando como root',
          'sudo -u ana COMANDO       executa como outro usuário',
          'sudo -l                   lista o que você pode rodar',
          'sudo -i                   shell de login como root (ambiente do root)',
          'sudo -s                   shell como root mantendo seu ambiente',
          'sudo -k                   esquece a senha em cache agora'
        ], run: false, lang: 'text'
      },
      { p: 'O <code>sudo</code> pede <strong>a sua</strong> senha, não a do root, consulta <code>/etc/sudoers</code> para decidir e registra cada uso em <code>/var/log/auth.log</code>. Esses três fatos são a diferença inteira entre <code>sudo</code> e virar root.' },
      { code: ['$ sudo -l', '$ sudo whoami', '$ whoami', '$ sudo tail -3 /var/log/auth.log'] },
      { p: 'Repare no <code>auth.log</code>: quem chamou, de onde, e o comando exato. Em uma máquina compartilhada, esse registro é o que permite reconstruir o que aconteceu.' },

      { h2: 'Rodar como outro usuário (não só root)' },
      { p: 'Metade dos problemas de permissão em servidores se resolve testando com a identidade certa:' },
      { code: ['$ sudo useradd -m -s /bin/bash ana 2>/dev/null; sudo -u ana whoami', '$ sudo -u ana id', '$ sudo -u ana ls -la /home/ana'] },
      {
        box: 'tip', label: 'A ferramenta de diagnóstico mais subestimada', body: [
          { p: 'Quando um serviço reclama de acesso, não deduza: <strong>reproduza como o usuário do serviço</strong>.' },
          { code: ['$ sudo -u www-data cat /var/www/site/config.php'], run: false },
          { p: 'Se falhar, você achou o problema em um comando. Se funcionar, o problema não era permissão de arquivo — é outra coisa (SELinux/AppArmor, unit do systemd, caminho errado).' }
        ]
      },

      { h2: 'su: o jeito antigo' },
      { cmd: 'su' },
      {
        table: {
          head: ['Comando', 'O que faz', 'Situação hoje'],
          rows: [
            ['<code>su -</code>', 'vira root com o ambiente do root; pede a <strong>senha do root</strong>', 'no Ubuntu a conta root vem sem senha; falha por padrão'],
            ['<code>su - ana</code>', 'vira a ana, com o ambiente dela', 'útil quando você tem a senha dela'],
            ['<code>sudo -i</code>', 'shell de root pedindo a <strong>sua</strong> senha', '<strong>preferido</strong>: rastreável e sem senha compartilhada'],
            ['<code>sudo su -</code>', 'sudo chamando su', 'funciona, mas é redundante — use <code>sudo -i</code>']
          ]
        }
      },
      { code: ['$ su - 2>&1 | tail -2'] },
      { p: 'A falha acima é esperada: em Debian/Ubuntu a conta root é bloqueada de propósito. O caminho é o <code>sudo</code>.' },
      {
        box: 'old', label: 'Prática antiga × atual', body: [
          { p: 'Guias antigos começam com "faça login como root e execute...". Isso implica <strong>uma senha compartilhada</strong> entre administradores, sem rastro de quem fez o quê, e sessões inteiras rodando com poder total.' },
          { p: 'O padrão atual: contas nominais, grupo <code>sudo</code>, autenticação com a própria senha (ou chave SSH), registro em log e, em ambientes mais rígidos, regras que limitam <em>quais</em> comandos cada pessoa pode elevar. <strong>Aprenda essa versão.</strong>' }
        ]
      },

      { h2: 'sudoers: quem pode o quê' },
      { p: 'A regra é lida de <code>/etc/sudoers</code> e dos arquivos em <code>/etc/sudoers.d/</code>. Nunca edite com um editor comum — use <code>visudo</code>, que valida a sintaxe antes de salvar. Um erro nesse arquivo pode trancar todo mundo para fora da administração.' },
      { code: ['$ sudo cat /etc/sudoers | grep -v "^#" | grep .'] },
      {
        code: [
          '# formato:  usuário  MÁQUINA=(USUÁRIO_ALVO:GRUPO_ALVO)  COMANDOS',
          'root      ALL=(ALL:ALL) ALL          # root pode tudo, de qualquer host',
          '%sudo     ALL=(ALL:ALL) ALL          # % = grupo: todo o grupo sudo pode tudo',
          '',
          '# regra restrita: só reiniciar um serviço, sem pedir senha',
          'deploy    ALL=(root) NOPASSWD: /usr/bin/systemctl restart app.service'
        ], run: false, lang: 'text'
      },
      { p: 'A última linha é o padrão para automação: o usuário do CI consegue exatamente uma ação e nada além dela.' },
      {
        box: 'warn', body: [
          { p: 'Cuidado com <code>NOPASSWD</code> em comandos que abrem shell. Autorizar <code>vim</code>, <code>find</code>, <code>less</code> ou <code>tar</code> via sudo é equivalente a dar root completo — todos eles conseguem executar comandos arbitrários por dentro.' }
        ]
      },
      {
        cheat: [
          ['<code>sudo -l</code>', 'o que eu posso elevar?'],
          ['<code>sudo -u ana cmd</code>', 'testar como outro usuário'],
          ['<code>sudo -i</code>', 'shell de root (preferido a <code>su -</code>)'],
          ['<code>sudo !!</code>', 'repetir o último comando com sudo'],
          ['<code>sudo -k</code>', 'encerrar o cache de senha'],
          ['<code>visudo</code>', 'editar sudoers com validação']
        ]
      }
    ],
    tasks: [
      {
        id: 't5-7-a', kind: 'guiado', title: 'Elevação com rastro',
        body: [
          { p: 'Compare identidades, veja o registro em log e teste o acesso de outro usuário.' },
          {
            code: [
              '$ whoami && sudo whoami',
              '$ sudo -l | head -6',
              '$ sudo useradd -m -s /bin/bash ana 2>/dev/null; sudo -u ana whoami',
              '$ sudo -u ana id',
              '$ sudo tail -5 /var/log/auth.log'
            ]
          },
          { p: 'Agora tente ler um arquivo do root como você, e depois como ele:' },
          { code: ['$ cat /etc/shadow', '$ sudo head -2 /etc/shadow'] }
        ],
        hints: ['Todo uso do <code>sudo</code> aparece em <code>/var/log/auth.log</code> — inclusive as tentativas negadas.'],
        solution: '<div class="code"><pre>whoami &amp;&amp; sudo whoami\nsudo -l | head -6\nsudo useradd -m -s /bin/bash ana\nsudo -u ana whoami\nsudo -u ana id\ncat /etc/shadow\nsudo head -2 /etc/shadow\nsudo tail -5 /var/log/auth.log</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /sudo\s+(-\w+\s+)*whoami/), 'Compare <code>whoami</code> com <code>sudo whoami</code>.'],
          [() => H.usedCommand(ctx, /sudo\s+-u\s+ana/), 'Execute algo como a usuária <code>ana</code> usando <code>sudo -u ana</code>.'],
          [H.exists(ctx, '/home/ana'), 'Crie a usuária <code>ana</code> com <code>sudo useradd -m -s /bin/bash ana</code>.'],
          [() => H.usedCommand(ctx, /auth\.log/), 'Leia o registro em <code>/var/log/auth.log</code>.'],
          [() => { const l = H.read(ctx, '/var/log/auth.log'); return !!l && /sudo/.test(l); }, 'O log de autenticação deveria conter suas chamadas de <code>sudo</code>.']
        ])
      },
      {
        id: 't5-7-q', kind: 'quiz', title: 'Conceito: por que não fazer tudo como root',
        body: [
          { p: 'Um administrador argumenta: "<em>eu sou o único usuário do servidor, então faço login como root e economizo digitação</em>". Qual é a objeção mais forte?' }
        ],
        options: [
          {
            text: 'Sem privilégio permanente, um erro de digitação ou um script malicioso atinge só os seus arquivos; como root, atinge a máquina inteira — e não há registro de qual ação foi feita quando.',
            correct: true
          },
          { text: 'Nenhuma: com um único usuário, root é equivalente e mais prático.', why: 'A maioria dos incidentes graves não envolve outro usuário — envolve um comando errado ou um processo comprometido rodando com poder demais.' },
          { text: 'Porque o root não consegue usar <code>sudo</code>.', why: 'O root não precisa de sudo. Não é essa a questão.' },
          { text: 'Porque comandos rodados como root ficam mais lentos.', why: 'Não há diferença de desempenho; a diferença é de risco e rastreabilidade.' }
        ],
        explain: 'O ganho do <code>sudo</code> é o <strong>momento de atenção</strong> antes de cada ação privilegiada, mais o registro do que foi feito. Um <code>rm -rf /caminho/errado</code> como usuário comum falha com <code>Permission denied</code>; como root, executa.'
      },
      {
        id: 't5-7-b', kind: 'desafio', title: 'Diagnostique com a identidade certa',
        body: [
          { p: 'Prepare o cenário: um diretório de aplicação que só o usuário <code>ana</code> deveria conseguir ler.' },
          {
            code: [
              '$ sudo useradd -m -s /bin/bash ana 2>/dev/null; sudo mkdir -p /srv/app-ana',
              '$ echo "config secreta" | sudo tee /srv/app-ana/config.ini > /dev/null',
              '$ sudo chown -R ana:ana /srv/app-ana',
              '$ sudo chmod 700 /srv/app-ana && sudo chmod 600 /srv/app-ana/config.ini'
            ]
          },
          { p: 'Agora, <strong>sem alterar nenhuma permissão</strong>, produza um arquivo <code>~/diagnostico.txt</code> contendo:' },
          {
            ol: [
              'na primeira linha, o nome do usuário que <em>você</em> é (saída de <code>whoami</code>);',
              'na segunda linha, o nome do usuário que consegue ler o arquivo (comprovado, não deduzido);',
              'na terceira linha, o conteúdo de <code>/srv/app-ana/config.ini</code>, lido com a identidade correta.'
            ]
          },
          { p: 'A regra do desafio: nada de <code>chmod</code> e nada de <code>sudo cat</code> como root. A leitura precisa ser feita <strong>como ana</strong>.' }
        ],
        hints: [
          'O <code>sudo -u USUÁRIO</code> executa um comando com a identidade de outra pessoa — é assim que se testa acesso de serviço.',
          'Use <code>>></code> para ir acumulando linhas no mesmo arquivo.',
          '<code>whoami > ~/diagnostico.txt</code>; <code>sudo -u ana whoami >> ~/diagnostico.txt</code>; <code>sudo -u ana cat /srv/app-ana/config.ini >> ~/diagnostico.txt</code>'
        ],
        solution: '<div class="code"><pre>whoami &gt; ~/diagnostico.txt\nsudo -u ana whoami &gt;&gt; ~/diagnostico.txt\nsudo -u ana cat /srv/app-ana/config.ini &gt;&gt; ~/diagnostico.txt\ncat ~/diagnostico.txt</pre></div><p style="margin-top:8px">Esse é o método real: em vez de afrouxar permissões até funcionar, você assume a identidade que deveria ter acesso e confirma se ela tem. Se tiver, o problema está em outro lugar.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/diagnostico.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/diagnostico.txt</code> ainda não existe.' };
          const l = c.split('\n').map(x => x.trim()).filter(x => x);
          return LX.H.checkAll([
            [H.exists(ctx, '/srv/app-ana/config.ini'), 'Monte primeiro o cenário do enunciado.'],
            [H.mode(ctx, '/srv/app-ana') === 0o700, 'As permissões de <code>/srv/app-ana</code> foram alteradas — o desafio pede para resolver sem <code>chmod</code>. Refaça o cenário.'],
            [l.length >= 3, `O arquivo deve ter três linhas; tem ${l.length}.`],
            [l[0] === 'aluno', `A primeira linha deve ser o seu usuário (<code>aluno</code>); está "${l[0]}".`],
            [l[1] === 'ana', `A segunda linha deve ser <code>ana</code>, comprovada com <code>sudo -u ana whoami</code>; está "${l[1]}".`],
            [/config secreta/.test(l[2] || ''), 'A terceira linha deve conter o conteúdo do <code>config.ini</code>.'],
            [() => H.usedCommand(ctx, /sudo\s+-u\s+ana\s+cat/), 'A leitura precisa ser feita como <code>ana</code>: <code>sudo -u ana cat ...</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 5.8 ============================== */
  LX.lesson('m05', {
    id: 'l5-8', n: '5.8', title: 'ACLs: quando três classes não bastam',
    goal: 'Conceder acesso a um usuário específico sem inventar grupos nem afrouxar o modo — e ler a saída de getfacl sem se perder na máscara.',
    brief: [
      { p: 'ACLs dão permissão a usuários ou grupos específicos sem trocar dono, grupo principal ou acesso de outros. Um <code>+</code> no fim de <code>ls -l</code> indica que o modo tradicional não conta toda a história.' },
      { code: ['$ setfacl -m u:ana:r relatorio.txt', '$ getfacl relatorio.txt', '$ setfacl -x u:ana relatorio.txt'] },
      { p: 'A entrada <code>mask</code> limita as permissões efetivas dos usuários nomeados e grupos. Para herança em diretórios, configure uma ACL padrão com <code>setfacl -d</code>. Ao diagnosticar acesso, sempre leia <code>getfacl</code> quando houver o sinal <code>+</code>.' }
    ],
    body: [
      { p: 'O modelo dono/grupo/outros é elegante e resolve 90% dos casos. O restante costuma ser este pedido: "<em>a Ana, e só a Ana, precisa ler este arquivo</em>". Com três classes, as opções seriam trocar o dono, criar um grupo novo só para isso, ou abrir para todos.' },
      { p: 'As <strong>ACLs</strong> (listas de controle de acesso) resolvem: elas acrescentam entradas por usuário e por grupo, sem tocar no dono nem no grupo do arquivo. Estão disponíveis por padrão em ext4, XFS e Btrfs.' },
      { cmd: 'getfacl' },
      { cmd: 'setfacl' },
      {
        code: [
          'getfacl ARQUIVO                mostra as ACLs',
          'setfacl -m u:ana:rw ARQUIVO     dá rw para a usuária ana',
          'setfacl -m g:devs:rx DIR        dá rx para o grupo devs',
          'setfacl -x u:ana ARQUIVO        remove a entrada da ana',
          'setfacl -b ARQUIVO              remove todas as ACLs',
          'setfacl -R -m u:ana:rX DIR      aplica recursivamente'
        ], run: false, lang: 'text'
      },
      { p: 'Experimente o ciclo inteiro:' },
      {
        code: [
          '$ sudo useradd -m ana 2>/dev/null; cd ~ && echo "relatorio confidencial" > rel.txt',
          '$ chmod 640 rel.txt && ls -l rel.txt',
          '$ setfacl -m u:ana:rw rel.txt',
          '$ ls -l rel.txt',
          '$ getfacl rel.txt'
        ]
      },
      { p: 'Duas coisas mudaram. No <code>ls -l</code> apareceu um <strong><code>+</code></strong> no fim do modo — é o sinal de que existem ACLs. E o <code>getfacl</code> mostra a lista completa.' },
      {
        box: 'key', label: 'O + do ls é o aviso mais importante desta aula', body: [
          { p: 'Sem ele, você olharia <code>-rw-rw----</code> e concluiria que apenas dono e grupo têm acesso — e estaria errado. Sempre que investigar permissões e vir um <code>+</code>, o <code>ls -l</code> deixou de contar a história inteira: rode <code>getfacl</code>.' }
        ]
      },

      { h2: 'A máscara, e por que os bits de grupo "mentem"' },
      { p: 'Quando um arquivo tem ACL, os bits de grupo do modo deixam de significar "permissões do grupo dono" e passam a ser a <strong>máscara</strong>: um teto que limita todas as entradas nomeadas e o grupo dono.' },
      {
        ascii: `getfacl rel.txt

user::rw-        ← dono (sempre integral, a máscara não o afeta)
user:ana:rw-     ← entrada nomeada  ┐
group::r--       ← grupo dono       ├─ todos limitados pela máscara
group:devs:rwx   ← grupo nomeado    ┘
mask::rw-        ← TETO: o rwx do devs vira rw- na prática
other::---       ← outros (também não é afetado pela máscara)`
      },
      { p: 'Permissão efetiva = entrada <strong>E</strong> máscara. Se a máscara é <code>rw-</code>, uma entrada com <code>rwx</code> resulta em <code>rw-</code>. O <code>getfacl</code> de sistemas reais marca esses casos com um comentário <code>#effective:</code>.' },
      {
        box: 'warn', label: 'A armadilha clássica', body: [
          { p: 'Rodar <code>chmod g-w arquivo</code> em um arquivo com ACL <strong>reduz a máscara</strong> — e derruba silenciosamente a escrita de todas as entradas nomeadas. O contrário também: um <code>chmod</code> generoso reabre o teto.' },
          { p: 'Regra prática: em arquivo com ACL, ajuste com <code>setfacl</code>, não com <code>chmod</code>.' }
        ]
      },
      { p: 'Veja acontecendo:' },
      {
        code: [
          '$ setfacl -m u:ana:rw ~/rel.txt && getfacl ~/rel.txt | grep -E "ana|mask"',
          '$ chmod g-w ~/rel.txt',
          '$ getfacl ~/rel.txt | grep -E "ana|mask"',
          '$ setfacl -m m::rw ~/rel.txt && getfacl ~/rel.txt | grep mask'
        ]
      },

      { h2: 'Quando usar ACL e quando não usar' },
      {
        table: {
          head: ['Situação', 'Melhor ferramenta'],
          rows: [
            ['Várias pessoas com o mesmo papel', '<strong>grupo</strong> + SGID — mais simples de auditar'],
            ['Uma exceção pontual ("só a Ana")', '<strong>ACL</strong>'],
            ['Acesso temporário a um diretório', '<strong>ACL</strong> (fácil de remover com <code>-x</code>)'],
            ['Backup do serviço lendo tudo', '<strong>ACL</strong> de leitura para o usuário do backup'],
            ['Regra que vale para a máquina inteira', 'grupos e umask; ACL espalhada vira dívida técnica']
          ]
        }
      },
      {
        box: 'note', body: [
          { p: 'ACLs têm um custo real: elas são invisíveis para quem só olha o <code>ls -l</code> (fora o <code>+</code>), e nem toda ferramenta de cópia as preserva. Use <code>cp -a</code>, <code>rsync -A</code> ou <code>tar --acls</code> quando precisar levá-las junto — caso contrário, um backup restaurado "perde" acessos sem avisar.' }
        ]
      },
      { p: 'Sistemas reais também suportam <strong>ACLs padrão</strong> em diretórios (<code>setfacl -d -m ...</code>), que fazem os arquivos novos herdarem entradas — o equivalente do SGID para ACLs. Este ambiente não simula esse recurso; a sintaxe fica registrada aqui para você reconhecê-la em documentação.' }
    ],
    tasks: [
      {
        id: 't5-8-a', kind: 'guiado', title: 'Conceda, leia, remova',
        body: [
          { p: 'Percorra o ciclo completo e observe o <code>+</code> e a máscara.' },
          {
            code: [
              '$ sudo useradd -m ana 2>/dev/null; cd ~ && echo "relatorio confidencial" > rel.txt',
              '$ chmod 640 rel.txt && ls -l rel.txt',
              '$ setfacl -m u:ana:rw rel.txt && ls -l rel.txt',
              '$ getfacl rel.txt',
              '$ chmod g-w rel.txt && getfacl rel.txt | grep mask',
              '$ setfacl -x u:ana rel.txt && ls -l rel.txt'
            ]
          },
          { p: 'Repare que o <code>+</code> some quando a última entrada é removida — o arquivo volta a ser um arquivo comum.' }
        ],
        hints: ['O <code>+</code> aparece logo depois dos nove caracteres de permissão, antes do número de links.'],
        solution: '<div class="code"><pre>sudo useradd -m ana\ncd ~ &amp;&amp; echo "relatorio confidencial" &gt; rel.txt\nchmod 640 rel.txt\nsetfacl -m u:ana:rw rel.txt\nls -l rel.txt\ngetfacl rel.txt\nsetfacl -x u:ana rel.txt\nls -l rel.txt</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [H.exists(ctx, '/home/aluno/rel.txt'), 'Crie o arquivo <code>~/rel.txt</code>.'],
          [() => H.usedCommand(ctx, /setfacl\s+-m\s+u:ana/), 'Conceda acesso à ana com <code>setfacl -m u:ana:rw rel.txt</code>.'],
          [() => H.usedCommand(ctx, /getfacl/), 'Leia a lista com <code>getfacl rel.txt</code>.'],
          [() => H.usedCommand(ctx, /setfacl\s+-x\s+u:ana|setfacl\s+-b/), 'Remova a entrada com <code>setfacl -x u:ana rel.txt</code>.'],
          [() => { const n = H.lstat(ctx, '/home/aluno/rel.txt'); return n && !LX.temACL(n); }, 'Ao final, o arquivo não deve mais ter ACLs — remova a entrada da ana.']
        ])
      },
      {
        id: 't5-8-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um arquivo tem esta ACL:' },
          { code: ['user::rw-', 'user:ana:rw-', 'group::r--', 'mask::r--', 'other::---'], run: false, mixed: false, lang: 'text' },
          { p: 'A Ana reclama que não consegue <strong>salvar</strong> alterações, embora a entrada dela diga <code>rw-</code>. Qual é a explicação?' }
        ],
        options: [
          { text: 'A máscara está em <code>r--</code> e limita todas as entradas nomeadas: a permissão efetiva da Ana é <code>r--</code>.', correct: true },
          { text: 'A entrada <code>group::r--</code> tem prioridade sobre a entrada nomeada.', why: 'A entrada nomeada é avaliada antes da do grupo dono; o que a limita é a máscara.' },
          { text: 'ACLs de usuário só funcionam em diretórios.', why: 'Funcionam em arquivos e diretórios.' },
          { text: 'Falta reiniciar o sistema para a ACL valer.', why: 'ACLs valem imediatamente; não há cache a invalidar.' }
        ],
        explain: 'A correção é elevar o teto: <code>setfacl -m m::rw arquivo</code> (ou <code>setfacl -m u:ana:rw</code>, que recalcula a máscara automaticamente). Provavelmente alguém rodou <code>chmod g-w</code> no arquivo — em arquivos com ACL, o <code>chmod</code> mexe na máscara.'
      },
      {
        id: 't5-8-b', kind: 'desafio', title: 'Acesso de leitura para o backup',
        body: [
          { p: 'O usuário <code>backup</code> precisa <strong>ler</strong> tudo em <code>/srv/dados</code>, que pertence a você e não pode ficar legível para os demais usuários da máquina.' },
          { p: 'Monte o cenário e resolva:' },
          {
            code: [
              '$ sudo useradd -m backup 2>/dev/null; sudo mkdir -p /srv/dados',
              '$ sudo chown aluno:aluno /srv/dados && sudo chmod 700 /srv/dados',
              '$ echo "linha 1" > /srv/dados/base.csv && chmod 600 /srv/dados/base.csv'
            ]
          },
          { p: 'Requisitos:' },
          {
            ul: [
              'o usuário <code>backup</code> deve conseguir <strong>atravessar</strong> o diretório e <strong>ler</strong> o arquivo;',
              'o modo de "outros" precisa continuar zerado no diretório e no arquivo;',
              'nenhum grupo novo pode ser criado, e o dono não muda.'
            ]
          },
          { p: 'Comprove ao final lendo o arquivo com a identidade do <code>backup</code>.' }
        ],
        hints: [
          'Um usuário específico, sem criar grupo e sem afrouxar o modo: esse é exatamente o caso de uso de ACL.',
          'O diretório precisa de <code>rx</code> (listar e atravessar) e o arquivo de <code>r</code>.',
          '<code>setfacl -m u:backup:rx /srv/dados</code> e <code>setfacl -m u:backup:r /srv/dados/base.csv</code>; confira com <code>sudo -u backup cat /srv/dados/base.csv</code>.'
        ],
        solution: '<div class="code"><pre>setfacl -m u:backup:rx /srv/dados\nsetfacl -m u:backup:r /srv/dados/base.csv\ngetfacl /srv/dados\nls -ld /srv/dados\nsudo -u backup cat /srv/dados/base.csv</pre></div><p style="margin-top:8px">Em produção, o passo seguinte seria uma ACL padrão (<code>setfacl -d -m u:backup:r /srv/dados</code>) para que arquivos futuros já nascessem legíveis pelo backup.</p>',
        check: async (ctx) => {
          const dir = H.lstat(ctx, '/srv/dados');
          if (!dir) return { ok: false, msg: 'Monte o cenário do enunciado: <code>/srv/dados</code> ainda não existe.' };
          const arq = H.lstat(ctx, '/srv/dados/base.csv');
          const m = ctx.machine || ctx.sh.m;
          const bu = m.userByName('backup');
          if (!bu) return { ok: false, msg: 'Crie o usuário <code>backup</code> com <code>sudo useradd -m backup</code>.' };
          const c = { uid: bu.uid, gid: bu.gid, groups: m.groupsOfUser('backup').map(g => g.gid) };
          const fs = ctx.sh.m.fs;
          return LX.H.checkAll([
            [!!arq, 'Crie o arquivo <code>/srv/dados/base.csv</code>.'],
            [(dir.mode & 0o007) === 0, `O diretório não pode ter bits para "outros". Modo atual: ${(dir.mode & 0o777).toString(8)}.`],
            [(arq.mode & 0o007) === 0, `O arquivo não pode ter bits para "outros". Modo atual: ${(arq.mode & 0o777).toString(8)}.`],
            [LX.temACL(dir), 'O diretório precisa de uma entrada de ACL para o usuário <code>backup</code>.'],
            [fs.can(dir, 'x', c) && fs.can(dir, 'r', c), 'O <code>backup</code> ainda não consegue listar e atravessar <code>/srv/dados</code>. Conceda <code>rx</code> a ele.'],
            [fs.can(arq, 'r', c), 'O <code>backup</code> ainda não consegue ler o <code>base.csv</code>. Conceda <code>r</code> a ele.'],
            [() => H.usedCommand(ctx, /sudo\s+-u\s+backup/), 'Comprove o acesso lendo o arquivo com <code>sudo -u backup cat /srv/dados/base.csv</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 5.9 ============================== */
  LX.lesson('m05', {
    id: 'l5-9', n: '5.9', title: 'Diagnóstico: por que "Permission denied"?',
    goal: 'Ter um método fixo para resolver qualquer erro de permissão em minutos, em vez de tentar coisas até funcionar.',
    brief: [
      { p: 'Diagnostique na mesma ordem: confirme a identidade com <code>id</code>, defina a operação que falhou, inspecione o caminho inteiro e procure camadas extras. Não tente corrigir com permissões mais abertas antes de encontrar a causa.' },
      { code: ['$ id', '$ namei -l /var/www/site/index.html', '$ getfacl /var/www/site/index.html', '$ mount | grep " /var "'] },
      { p: 'Cada diretório do caminho precisa de <code>x</code> para ser atravessado. Se o modo parece correto, verifique ACL, sistema de arquivos somente leitura, atributo imutável e controles como AppArmor ou SELinux.' }
    ],
    body: [
      { lede: 'O erro é sempre a mesma frase e quase nunca a mesma causa. Um método curto resolve mais rápido do que a intuição.' },
      { h2: 'As quatro perguntas, nesta ordem' },
      {
        ol: [
          '<strong>Quem</strong> está tentando? (<code>whoami</code>, <code>id</code> — e, para serviços, <code>ps -o user= -p PID</code> ou <code>systemctl show -p User</code>)',
          '<strong>O quê</strong> exatamente? (ler? escrever? executar? apagar?)',
          '<strong>Onde</strong>, no caminho inteiro? (o alvo <em>e</em> cada diretório até ele)',
          '<strong>Existe camada extra?</strong> (ACL com <code>+</code>, montagem <code>ro</code>, atributo imutável, AppArmor/SELinux)'
        ]
      },
      {
        box: 'key', body: [
          { p: 'A causa mais comum de todas não está no arquivo: está em <strong>um diretório do caminho</strong> sem o bit <code>x</code>. Você pode ter <code>rw</code> no arquivo e ainda assim não chegar nele.' }
        ]
      },

      { h2: 'A ferramenta que responde a pergunta 3 de uma vez' },
      { cmd: 'namei' },
      { p: 'O <code>namei -l</code> mostra as permissões de <strong>cada componente</strong> do caminho, de cima para baixo:' },
      {
        code: [
          '$ mkdir -p ~/cadeia/nivel1/nivel2 && echo dados > ~/cadeia/nivel1/nivel2/alvo.txt',
          '$ chmod 640 ~/cadeia/nivel1',
          '$ namei -l ~/cadeia/nivel1/nivel2/alvo.txt',
          '$ cat ~/cadeia/nivel1/nivel2/alvo.txt'
        ]
      },
      { p: 'O <code>640</code> tirou o <code>x</code> do <code>nivel1</code> até para o dono: o caminho está cortado ali, e o <code>namei</code> mostra em qual linha. Devolva com <code>chmod 750 ~/cadeia/nivel1</code> e repita.' },

      { h2: 'Tabela de sintomas' },
      {
        table: {
          head: ['Sintoma', 'Causa provável', 'Como confirmar'],
          rows: [
            ['<code>bash: ./x.sh: Permission denied</code>', 'falta o bit <code>x</code>', '<code>ls -l x.sh</code>'],
            ['<code>bash: ./x.sh: cannot execute: required file not found</code>', 'shebang errado ou fim de linha do Windows', '<code>head -1 x.sh | cat -A</code>'],
            ['<code>cd: Permission denied</code>', 'falta <code>x</code> no diretório', '<code>ls -ld dir</code>'],
            ['<code>ls: cannot open directory</code>', 'tem <code>x</code>, falta <code>r</code>', '<code>ls -ld dir</code>'],
            ['pode ler, não pode apagar', 'falta <code>w</code> no <strong>diretório</strong>, ou sticky bit', '<code>ls -ld dir</code>'],
            ['<code>Operation not permitted</code> (não "denied")', 'não é modo: é propriedade, atributo imutável ou capability', '<code>lsattr arq</code>, <code>ls -l</code>'],
            ['<code>Read-only file system</code>', 'a montagem está <code>ro</code>', '<code>mount | grep " /caminho "</code>'],
            ['modo parece certo e mesmo assim nega', 'ACL limitando (veja o <code>+</code>) ou grupo não recarregado', '<code>getfacl arq</code>, <code>id</code>'],
            ['funciona como você, falha no serviço', 'o serviço roda com outro usuário', '<code>sudo -u USUARIO cmd</code>']
          ]
        }
      },
      {
        box: 'tip', label: 'O teste decisivo', body: [
          { p: 'Reproduza com a identidade que falha, e não com a sua:' },
          { code: ['$ sudo -u www-data cat /var/www/site/index.html'], run: false },
          { p: 'Isso transforma "acho que é permissão" em uma resposta objetiva em um comando.' }
        ]
      },
      {
        box: 'warn', label: 'O que não fazer', body: [
          { ul: [
            '<code>chmod -R 777</code> — resolve o sintoma e abre a máquina;',
            '<code>sudo</code> em tudo para "passar" — esconde o problema e cria arquivos do root no meio dos seus, que depois falham para o serviço;',
            'mudar o dono do diretório inteiro sem entender qual identidade precisava de quê.'
          ] }
        ]
      },
      { p: 'E, quando o erro for <code>Operation not permitted</code> em um arquivo que é seu e com modo correto, olhe os atributos estendidos: um arquivo com <code>+i</code> (imutável) não pode ser alterado nem pelo root até que o atributo seja removido com <code>chattr -i</code>.' }
    ],
    setup: (m) => {
      const ctx = m.ctxRoot();
      const fs = m.fs;
      if (!m.userByName('ana')) {
        const uid = m.nextUid(), gid = m.nextGid();
        m.addGroupRecord({ name: 'ana', gid, members: [] });
        m.addUserRecord({ name: 'ana', uid, gid, gecos: '', home: '/home/ana', shell: '/bin/bash', locked: true });
        try { fs.mkdirp('/home/ana', { ctx }); const h = fs.stat('/home/ana', { ctx }); h.uid = uid; h.gid = gid; h.mode = 0o750; } catch (e) { }
      }
      try { fs.rmrf('/srv/site', { ctx }); } catch (e) { }
      fs.mkdirp('/srv/site/publico/assets', { ctx });
      fs.mkdirp('/srv/site/logs', { ctx });
      fs.writeFile('/srv/site/publico/index.html', '<h1>Site da equipe</h1>\n', { ctx });
      fs.writeFile('/srv/site/publico/assets/estilo.css', 'body { font-family: sans-serif; }\n', { ctx });
      fs.writeFile('/srv/site/logs/acesso.log', '2026-09-01 10:00:00 GET / 200\n', { ctx });
      fs.writeFile('/srv/site/publicar.sh', '#!/bin/bash\necho "publicando..."\n', { ctx });
      const set = (p, mode, uid, gid) => {
        const n = fs.lstat(p, { cwd: '/', ctx });
        n.mode = mode; if (uid !== undefined) n.uid = uid; if (gid !== undefined) n.gid = gid;
      };
      // a quebra: /srv/site sem x para outros, assets sem r, log sem w, script sem x
      set('/srv/site', 0o750, 0, 0);
      set('/srv/site/publico', 0o755, 0, 0);
      set('/srv/site/publico/index.html', 0o644, 0, 0);
      set('/srv/site/publico/assets', 0o330, 0, 0);
      set('/srv/site/publico/assets/estilo.css', 0o644, 0, 0);
      set('/srv/site/logs', 0o755, 0, 0);
      set('/srv/site/logs/acesso.log', 0o644, 0, 0);
      set('/srv/site/publicar.sh', 0o644, 1000, 1000);
    },
    tasks: [
      {
        id: 't5-9-a', kind: 'guiado', title: 'Siga a cadeia',
        body: [
          { p: 'Reproduza o corte no meio do caminho e localize-o com <code>namei</code>.' },
          {
            code: [
              '$ mkdir -p ~/cadeia/nivel1/nivel2 && echo dados > ~/cadeia/nivel1/nivel2/alvo.txt',
              '$ chmod 640 ~/cadeia/nivel1',
              '$ cat ~/cadeia/nivel1/nivel2/alvo.txt',
              '$ namei -l ~/cadeia/nivel1/nivel2/alvo.txt',
              '$ ls -ld ~/cadeia/nivel1'
            ]
          },
          { p: 'Agora conserte o elo quebrado e confirme que o acesso voltou:' },
          { code: ['$ chmod 750 ~/cadeia/nivel1', '$ cat ~/cadeia/nivel1/nivel2/alvo.txt'] }
        ],
        hints: ['Compare a linha do <code>nivel1</code> antes e depois: a diferença é um único bit.'],
        solution: '<div class="code"><pre>mkdir -p ~/cadeia/nivel1/nivel2 &amp;&amp; echo dados &gt; ~/cadeia/nivel1/nivel2/alvo.txt\nchmod 640 ~/cadeia/nivel1\ncat ~/cadeia/nivel1/nivel2/alvo.txt\nnamei -l ~/cadeia/nivel1/nivel2/alvo.txt\nchmod 750 ~/cadeia/nivel1\ncat ~/cadeia/nivel1/nivel2/alvo.txt</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [H.exists(ctx, '/home/aluno/cadeia/nivel1/nivel2/alvo.txt'), 'Monte a cadeia <code>~/cadeia/nivel1/nivel2/alvo.txt</code>.'],
          [() => H.usedCommand(ctx, /chmod\s+640\s+.*nivel1/), 'Quebre o caminho com <code>chmod 640 ~/cadeia/nivel1</code> para ver o erro.'],
          [() => H.usedCommand(ctx, /namei/), 'Use <code>namei -l</code> para localizar o elo quebrado.'],
          [(H.mode(ctx, '/home/aluno/cadeia/nivel1') & 0o100) !== 0, 'Conserte o <code>nivel1</code> devolvendo o bit <code>x</code> ao dono (<code>chmod 750</code>).']
        ])
      },
      {
        id: 't5-9-q', kind: 'quiz', title: 'Leia o namei',
        body: [
          { p: 'Você investiga por que o usuário <code>app</code> não lê <code>/srv/dados/rel/base.csv</code> e obtém:' },
          {
            code: [
              'f: /srv/dados/rel/base.csv',
              ' drwxr-xr-x root root /',
              '  drwxr-xr-x root root srv',
              '   drwxr-x--- root infra dados',
              '    drwxr-xr-x root root rel',
              '     -rw-r--r-- root root base.csv'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'O usuário <code>app</code> não pertence ao grupo <code>infra</code>. Qual é a correção mínima e mais segura?' }
        ],
        options: [
          { text: 'Dar ao <code>app</code> acesso ao diretório <code>dados</code> — por exemplo com <code>setfacl -m u:app:rx /srv/dados</code>.', correct: true },
          { text: '<code>chmod 644 /srv/dados/rel/base.csv</code> — o arquivo precisa ficar legível.', why: 'O arquivo já está <code>rw-r--r--</code>: legível por todos. O bloqueio está antes dele.' },
          { text: '<code>chmod -R 777 /srv/dados</code>, que resolve de uma vez.', why: 'Resolve e abre o diretório inteiro para toda a máquina, inclusive escrita.' },
          { text: 'Adicionar o <code>app</code> ao grupo <code>root</code>.', why: 'Daria acesso a muito mais do que este caminho — é o oposto de mínimo privilégio.' }
        ],
        explain: 'A linha <code>drwxr-x--- root infra dados</code> é o único elo em que "outros" não tem <code>x</code>. Duas correções mínimas competem: colocar o <code>app</code> no grupo <code>infra</code> (se fizer sentido de organização) ou uma ACL pontual. Alterar o arquivo final não muda nada, porque a barreira está acima dele.'
      },
      {
        id: 't5-9-b', kind: 'desafio', title: 'Troubleshooting: o site que ninguém consegue servir',
        body: [
          { p: 'O diretório <code>/srv/site</code> foi entregue quebrado. O objetivo é deixá-lo funcional para um servidor web que roda como o usuário <strong><code>ana</code></strong>, sem afrouxar nada além do necessário.' },
          { p: 'Investigue antes de corrigir. Comece por:' },
          {
            code: [
              '$ ls -lR /srv/site',
              '$ namei -l /srv/site/publico/assets/estilo.css',
              '$ sudo -u ana cat /srv/site/publico/index.html',
              '$ sudo -u ana ls /srv/site/publico/assets'
            ]
          },
          { p: 'Estado final exigido:' },
          {
            ul: [
              'a usuária <code>ana</code> consegue <strong>ler</strong> <code>/srv/site/publico/index.html</code> e <code>/srv/site/publico/assets/estilo.css</code>, e <strong>listar</strong> o diretório <code>assets</code>;',
              'a <code>ana</code> consegue <strong>escrever</strong> em <code>/srv/site/logs/acesso.log</code>;',
              '<code>/srv/site/publicar.sh</code> pode ser executado por você (o dono);',
              'nada em <code>/srv/site</code> pode ficar com escrita para "outros";',
              'a solução não pode usar <code>chmod 777</code> em lugar nenhum.'
            ]
          },
          { p: 'Existem pelo menos dois caminhos válidos (ACL ou grupo). Escolha um e justifique para você mesmo.' }
        ],
        hints: [
          'Faça o inventário: rode <code>namei -l</code> nos três caminhos e anote em qual linha o acesso morre. São problemas diferentes em pontos diferentes.',
          'O diretório <code>assets</code> está <code>330</code>: tem <code>w</code> e <code>x</code>, mas não tem <code>r</code> — dá para atravessar, não dá para listar. O <code>/srv/site</code> está <code>750 root:root</code>, então a ana nem entra. O <code>acesso.log</code> é <code>644 root</code>, sem escrita para ela. E o <code>publicar.sh</code> não tem bit de execução.',
          'Um caminho completo: <code>sudo chmod 755 /srv/site</code>; <code>sudo chmod 755 /srv/site/publico/assets</code>; <code>sudo setfacl -m u:ana:rw /srv/site/logs/acesso.log</code>; <code>chmod u+x /srv/site/publicar.sh</code>.'
        ],
        solution: '<div class="code"><pre># 1. inventário\nls -lR /srv/site\nnamei -l /srv/site/publico/assets/estilo.css\n\n# 2. a ana precisa atravessar /srv/site\nsudo chmod 755 /srv/site\n\n# 3. assets tem w+x mas nao tem r: nao da para listar\nsudo chmod 755 /srv/site/publico/assets\n\n# 4. escrita no log apenas para a ana, sem abrir para outros\nsudo setfacl -m u:ana:rw /srv/site/logs/acesso.log\n\n# 5. o script precisa do bit de execucao\nchmod u+x /srv/site/publicar.sh\n\n# 6. comprovação com a identidade certa\nsudo -u ana cat /srv/site/publico/assets/estilo.css\nsudo -u ana ls /srv/site/publico/assets\nsudo -u ana bash -c \'echo "2026-09-01 11:00:00 GET / 200" &gt;&gt; /srv/site/logs/acesso.log\'</pre></div><p style="margin-top:8px">Repare no método: primeiro o inventário (<code>ls -lR</code> + <code>namei</code>), depois uma correção por sintoma, e no fim a comprovação com <code>sudo -u ana</code>. Em nenhum momento foi preciso adivinhar.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const fs = m.fs;
          const ana = m.userByName('ana');
          if (!ana) return { ok: false, msg: 'A usuária <code>ana</code> não existe nesta máquina. Recarregue a aula para restaurar o cenário.' };
          const c = { uid: ana.uid, gid: ana.gid, groups: m.groupsOfUser('ana').map(g => g.gid) };
          const n = (p) => H.lstat(ctx, p);
          const site = n('/srv/site'), pub = n('/srv/site/publico'), assets = n('/srv/site/publico/assets');
          const css = n('/srv/site/publico/assets/estilo.css'), idx = n('/srv/site/publico/index.html');
          const logs = n('/srv/site/logs'), log = n('/srv/site/logs/acesso.log'), sh = n('/srv/site/publicar.sh');
          if (!site || !css || !log || !sh) return { ok: false, msg: 'O cenário de <code>/srv/site</code> não está completo. Recarregue a aula para restaurá-lo.' };
          const podeChegar = (dirs, alvo, want) => dirs.every(d => fs.can(d, 'x', c)) && fs.can(alvo, want, c);
          const todos = [site, pub, assets, css, idx, logs, log, sh];
          return LX.H.checkAll([
            [todos.every(x => (x.mode & 0o002) === 0), 'Algum item de <code>/srv/site</code> ficou com escrita para "outros". Nenhum pode ter o bit <code>w</code> em outros.'],
            [todos.every(x => (x.mode & 0o777) !== 0o777), 'Há algum item em <code>777</code> — o desafio proíbe essa saída.'],
            [fs.can(site, 'x', c), 'A <code>ana</code> ainda não consegue atravessar <code>/srv/site</code>. Comece por aí: <code>namei -l</code> mostra onde o caminho morre.'],
            [podeChegar([site, pub], idx, 'r'), 'A <code>ana</code> ainda não consegue ler <code>/srv/site/publico/index.html</code>.'],
            [fs.can(assets, 'r', c) && fs.can(assets, 'x', c), 'A <code>ana</code> precisa <strong>listar</strong> e atravessar <code>assets</code> — repare que ele tem <code>w</code> e <code>x</code>, mas não tem <code>r</code>.'],
            [podeChegar([site, pub, assets], css, 'r'), 'A <code>ana</code> ainda não consegue ler <code>assets/estilo.css</code>.'],
            [podeChegar([site, logs], log, 'w'), 'A <code>ana</code> ainda não consegue escrever em <code>/srv/site/logs/acesso.log</code>. Uma ACL resolve sem abrir o arquivo para todos.'],
            [(log.mode & 0o002) === 0, 'Não libere a escrita do log para "outros" — conceda apenas à <code>ana</code>.'],
            [(sh.mode & 0o100) !== 0, 'O <code>publicar.sh</code> ainda não é executável pelo dono.'],
            [() => H.usedCommand(ctx, /namei|ls\s+-lR|sudo\s+-u\s+ana/), 'Investigue antes de corrigir: use <code>namei -l</code>, <code>ls -lR</code> e <code>sudo -u ana</code> para comprovar cada sintoma.']
          ]);
        }
      }
    ]
  });

})();
