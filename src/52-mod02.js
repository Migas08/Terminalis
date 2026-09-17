/* =========================================================================
   MÓDULO 2 — Terminal e comandos básicos
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 2.1 ============================== */
  LX.lesson('m02', {
    id: 'l2-1', n: '2.1', title: 'Navegar: pwd, ls e cd',
    goal: 'Os três comandos que você mais vai digitar na vida. Aqui eles deixam de ser "olhar a pasta" e viram uma ferramenta de investigação.',
    brief: [
      { p: '<code>pwd</code> mostra onde você está, <code>ls</code> lista o conteúdo e <code>cd</code> troca de diretório. Antes de alterar ou apagar algo, confirme o caminho com <code>pwd</code> e veja os arquivos com <code>ls -lah</code>.' },
      { code: ['$ pwd', '$ ls -lah', '$ cd ~/projetos', '$ cd -'] },
      { p: 'Use <code>ls -lt</code> para colocar os itens mais recentes primeiro. Caminhos iniciados por <code>/</code> são absolutos; os demais partem do diretório atual. <code>cd -</code> volta ao diretório anterior.' }
    ],
    body: [
      { cmd: 'pwd' },
      { p: 'Responde a única pergunta que importa antes de qualquer comando destrutivo: <strong>onde eu estou?</strong> Sem opções relevantes, sem surpresas.' },
      { code: ['$ pwd'] },

      { cmd: 'ls' },
      { p: 'Lista o conteúdo de um diretório. Sozinho, mostra o diretório atual; com um argumento, mostra outro lugar sem sair de onde você está.' },
      { code: ['$ ls', '$ ls /etc', '$ ls /var/log /home'] },
      { h3: 'As opções que valem a pena decorar' },
      {
        table: {
          head: ['Opção', 'Efeito'],
          rows: [
            ['<code>-l</code>', 'Formato longo: permissões, dono, grupo, tamanho, data.'],
            ['<code>-a</code>', 'Mostra os ocultos (os que começam com ponto).'],
            ['<code>-h</code>', '<em>Human readable</em>: 4,0K em vez de 4096. Só faz sentido junto com <code>-l</code>.'],
            ['<code>-t</code>', 'Ordena por data, do mais recente para o mais antigo.'],
            ['<code>-r</code>', 'Inverte a ordem.'],
            ['<code>-S</code>', 'Ordena por tamanho, do maior para o menor.'],
            ['<code>-R</code>', 'Entra recursivamente nos subdiretórios.'],
            ['<code>-i</code>', 'Mostra o número do inode.'],
            ['<code>-d</code>', 'Mostra o próprio diretório, não o conteúdo dele.']
          ]
        }
      },
      { p: 'Na prática, três combinações resolvem quase tudo:' },
      {
        code: [
          '$ ls -lh',
          '$ ls -lat',
          '$ ls -lhS /var/log'
        ]
      },
      { p: 'A primeira é o dia a dia. A segunda responde "o que mudou por último aqui?" — ótima para investigar. A terceira responde "quem está enchendo meu disco?".' },

      { h3: 'Lendo a saída do ls -l' },
      { p: 'Aquela linha aparentemente críptica tem sete campos bem definidos:' },
      {
        ascii: `-rw-r--r--  1 aluno aluno  1240 Sep  1 09:14 notas.txt
│└───┬───┘  │  │     │      │      │          │
│    │      │  │     │      │      │          └── nome
│    │      │  │     │      │      └───────────── data da última modificação
│    │      │  │     │      └──────────────────── tamanho em bytes
│    │      │  │     └─────────────────────────── grupo
│    │      │  └───────────────────────────────── dono
│    │      └──────────────────────────────────── nº de links
│    └─────────────────────────────────────────── permissões (módulo 5)
└──────────────────────────────────────────────── tipo`
      },
      { p: 'O primeiro caractere é o mais útil de todos para bater o olho:' },
      {
        cheat: [
          ['-', 'arquivo comum'],
          ['d', 'diretório'],
          ['l', 'link simbólico (atalho)'],
          ['c', 'dispositivo de caractere (ex.: /dev/null)'],
          ['b', 'dispositivo de bloco (ex.: /dev/vda)'],
          ['p', 'pipe nomeado'],
          ['s', 'socket']
        ]
      },

      { cmd: 'cd' },
      { p: 'Troca o diretório atual. É um comando <strong>interno do shell</strong> — não existe um programa <code>/usr/bin/cd</code>, porque um programa externo não conseguiria mudar o diretório do shell que o chamou.' },
      {
        code: [
          '$ cd /var/log',
          '$ cd ..',
          '$ cd ~/documentos',
          '$ cd -',
          '$ cd'
        ]
      },
      {
        box: 'tip', label: 'O par que salva vidas', body: [
          { p: '<code>cd -</code> alterna entre os dois últimos diretórios, como o Alt+Tab do terminal. Quando você precisa comparar dois lugares distantes na árvore, é o que evita digitar caminhos gigantes.' }
        ]
      },

      { h2: 'Globbing: o asterisco é do shell, não do comando' },
      { p: 'Quando você digita <code>ls *.txt</code>, o <code>ls</code> nunca vê o asterisco. Quem expande é o <strong>Bash</strong>, antes de executar: ele olha o diretório, encontra os arquivos que casam e passa a lista pronta.' },
      {
        table: {
          head: ['Padrão', 'Casa com', 'Exemplo'],
          rows: [
            ['<code>*</code>', 'qualquer sequência, inclusive vazia', '<code>*.log</code> · <code>rel*</code>'],
            ['<code>?</code>', 'exatamente um caractere', '<code>arquivo?.txt</code>'],
            ['<code>[abc]</code>', 'um caractere entre os listados', '<code>foto[123].png</code>'],
            ['<code>[a-z]</code>', 'um caractere no intervalo', '<code>log[0-9].txt</code>'],
            ['<code>[!a]</code>', 'qualquer um <em>exceto</em>', '<code>[!t]*.txt</code>'],
            ['<code>{a,b}</code>', 'expansão de chaves (não é glob)', '<code>arq{1,2,3}.txt</code>']
          ]
        }
      },
      { code: ['$ ls ~/documentos/*.txt', '$ ls /etc/*.conf', '$ echo relatorio-{01..03}.csv'] },
      {
        box: 'warn', label: 'Por que isso importa muito', body: [
          { p: 'Como quem expande é o shell, se <strong>nenhum arquivo casar</strong>, o Bash entrega o padrão literalmente para o comando. É por isso que <code>ls *.xyz</code> em um diretório sem arquivos <code>.xyz</code> retorna <em>"cannot access \'*.xyz\'"</em>. O comando recebeu o asterisco cru.' },
          { p: 'E é por isso também que <code>rm *</code> é tão perigoso: o shell expande para <em>tudo o que existe ali</em> e o <code>rm</code> obedece sem perguntar.' }
        ]
      },
      { h3: 'Teste antes de agir' },
      { p: 'Regra de ouro para não se arrepender: troque o comando perigoso por <code>echo</code> ou <code>ls</code> e veja o que o shell vai realmente expandir.' },
      {
        code: [
          '# antes de "rm *.tmp", confira o que isso significa:',
          '$ ls *.tmp',
          '$ echo *.tmp'
        ], run: false, mixed: false
      },

      { h2: 'Duas ferramentas que você vai precisar já' },
      { p: 'O módulo 3 é inteiro sobre isto, mas dois símbolos aparecem tanto que vale conhecê-los agora — inclusive porque os desafios desta aula pedem os dois.' },
      {
        table: {
          head: ['Símbolo', 'Nome', 'O que faz'],
          rows: [
            ['<code>&gt;</code>', 'redirecionamento', 'manda a saída do comando para um <strong>arquivo</strong>, em vez da tela. <strong>Substitui</strong> o conteúdo anterior.'],
            ['<code>&gt;&gt;</code>', 'redirecionamento', 'o mesmo, mas <strong>acrescenta</strong> no fim em vez de substituir.'],
            ['<code>|</code>', 'pipe', 'liga dois comandos: a saída do primeiro vira a <strong>entrada</strong> do segundo.']
          ]
        }
      },
      {
        code: [
          '$ ls -lh > /tmp/lista.txt',
          '$ cat /tmp/lista.txt',
          '$ ls /etc | head -5',
          '$ ls /etc | wc -l'
        ]
      },
      { p: 'A ideia do pipe é a que organiza todo o resto do curso: cada programa faz uma coisa só, e você <strong>encaixa</strong> os programas para resolver o problema. O <code>ls /etc | wc -l</code> não é um comando que conta arquivos — são dois comandos, um listando e outro contando, ligados por um cano.' },
      {
        box: 'warn', body: [
          { p: 'Cuidado com o <code>&gt;</code>: ele <strong>apaga o conteúdo anterior do arquivo antes de escrever</strong>, sem perguntar. Um <code>&gt;</code> onde você queria <code>&gt;&gt;</code> destrói o arquivo. É um dos erros mais comuns de quem está começando.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>pwd</code> antes de qualquer comando destrutivo.',
          '<code>ls -lh</code> no dia a dia; <code>ls -lat</code> para investigar mudanças; <code>ls -lhS</code> para achar arquivos grandes.',
          'A primeira letra do <code>ls -l</code> diz o tipo: <code>-</code>, <code>d</code>, <code>l</code>...',
          '<code>cd -</code> alterna entre dois diretórios; <code>cd</code> sozinho volta para casa.',
          'O glob é expandido pelo <strong>shell</strong>. Teste com <code>echo</code> antes de usar com <code>rm</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't2-1-a', kind: 'guiado', title: 'Investigue como um administrador',
        body: [
          { p: 'Estas quatro perguntas aparecem toda semana na vida de quem cuida de servidor. Rode e leia a saída:' },
          { code: ['$ ls -lh ~/documentos', '$ ls -lat /var/log', '$ ls -lhS /var/log', '$ ls -ld /tmp'] },
          { p: 'A última usa <code>-d</code> para mostrar as permissões do <em>próprio</em> <code>/tmp</code>. Repare no <code>t</code> no final — é o sticky bit, que veremos no módulo 5.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ls\s+-[a-z]*l[a-z]*\s*.*documentos/), 'Liste <code>~/documentos</code> em formato longo.'],
          [() => H.usedCommand(ctx, /ls\s+-[a-z]*t[a-z]*/), 'Use a opção <code>-t</code> para ordenar por data.'],
          [() => H.usedCommand(ctx, /ls\s+-[a-z]*d[a-z]*\s+\/tmp/), 'Use <code>ls -ld /tmp</code>.']
        ])
      },
      {
        id: 't2-1-p', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'O diretório atual contém exatamente: <code>a.txt</code>, <code>b.txt</code>, <code>ab.log</code> e <code>relatorio.txt</code>. Você digita:' },
          { code: ['echo ?.txt'], run: false, mixed: false },
          { p: 'O que aparece na tela?' }
        ],
        options: [
          { text: '<code>a.txt b.txt</code>', correct: true },
          { text: '<code>a.txt b.txt relatorio.txt</code>', why: 'O <code>?</code> casa com <strong>exatamente um</strong> caractere. <code>relatorio</code> tem dez.' },
          { text: '<code>?.txt</code>', why: 'Isso só aconteceria se nenhum arquivo casasse. Dois casam.' },
          { text: '<code>a.txt b.txt ab.log</code>', why: 'O padrão termina em <code>.txt</code>, então <code>ab.log</code> está fora — e ele também tem dois caracteres antes do ponto.' }
        ],
        explain: 'O shell expande <code>?.txt</code> em ordem alfabética para os arquivos com exatamente um caractere antes de <code>.txt</code>. O <code>echo</code> só imprime o que recebeu — o que faz dele a melhor ferramenta para testar um glob antes de usá-lo com um comando perigoso.'
      },
      {
        id: 't2-1-b', kind: 'desafio', title: 'Encontre o que mudou por último',
        body: [
          { p: 'Você recebeu um chamado: "alguém mexeu na configuração do servidor e algo quebrou, mas ninguém lembra o quê".' },
          { p: 'Descubra qual é o arquivo <strong>modificado mais recentemente</strong> dentro de <code>/etc</code> (apenas o primeiro nível, sem entrar em subdiretórios) e grave <strong>apenas o nome dele</strong> em <code>~/suspeito.txt</code>.' },
          { p: 'Dica de método: o <code>ls</code> sabe ordenar por data e o <code>head</code> sabe pegar as primeiras linhas.' }
        ],
        hints: [
          '<code>ls -t /etc</code> ordena por data, mais recente primeiro. Sem o <code>-l</code>, a saída é só o nome.',
          'Encadeie com um pipe e limite a saída: <code>ls -t /etc | head -1 &gt; ~/suspeito.txt</code>'
        ],
        solution: '<div class="code"><pre>ls -t /etc | head -1 &gt; ~/suspeito.txt</pre></div><p style="margin-top:8px">Sem o <code>-l</code>, o <code>ls</code> imprime só os nomes — exatamente o que o desafio pediu. Com <code>-l</code> viria a linha inteira.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/suspeito.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/suspeito.txt ainda não existe.' };
          const nomes = H.ls(ctx, '/etc') || [];
          let maisNovo = null, t = -1;
          for (const n of nomes) {
            const s = H.lstat(ctx, '/etc/' + n);
            if (s && s.mtime > t) { t = s.mtime; maisNovo = n; }
          }
          const linha = c.trim().split('\n')[0].trim();
          return LX.H.checkAll([
            [c.trim().split('\n').filter(Boolean).length === 1, 'O arquivo deve ter uma única linha, com apenas o nome.'],
            [linha === maisNovo, `Encontrei "<code>${linha}</code>", mas o mais recente em /etc é "<code>${maisNovo}</code>". Confira a ordenação por data.`],
            [!/\s(root|rw-)/.test(c), 'Parece que você gravou a linha inteira do <code>ls -l</code>. O desafio pede só o nome.']
          ]);
        }
      },

    ]
  });

  /* ============================== 2.2 ============================== */
  LX.lesson('m02', {
    id: 'l2-2', n: '2.2', title: 'Criar: mkdir e touch',
    goal: 'Criar estruturas de diretórios inteiras em um comando e entender o que o touch realmente faz (não é "criar arquivo").',
    brief: [
      { p: '<code>mkdir</code> cria diretórios. Com <code>-p</code>, ele também cria os diretórios intermediários e não falha se eles já existirem. <code>touch</code> cria um arquivo vazio quando ele não existe; se existir, apenas atualiza suas datas.' },
      { code: ['$ mkdir -p app/{src,tests,docs}', '$ touch app/README.md', '$ ls -R app'] },
      { p: 'Para montar estruturas em scripts, prefira <code>mkdir -p</code>. Antes de usar <code>touch</code> em um arquivo existente, lembre que a data de modificação será alterada.' }
    ],
    body: [
      { cmd: 'mkdir' },
      { p: '<em>Make directory</em>. Cria um diretório vazio.' },
      { code: ['$ mkdir teste', '$ ls'] },
      { p: 'Se você pedir para criar <code>a/b/c</code> e <code>a</code> não existir, ele reclama — porque, por padrão, o <code>mkdir</code> cria <strong>um</strong> nível:' },
      { code: ['$ mkdir projeto/src'] },
      { h3: 'A opção que muda tudo: -p' },
      { p: '<code>-p</code> (de <em>parents</em>) cria toda a cadeia de diretórios que faltar, e não reclama se o diretório já existir:' },
      { code: ['$ mkdir -p projeto/src/componentes', '$ ls -R projeto'] },
      { p: 'Combinado com expansão de chaves, você monta um esqueleto de projeto inteiro numa linha:' },
      { code: ['$ mkdir -p app/{src,tests,docs,config}', '$ ls app'] },
      {
        box: 'tip', body: [
          { p: 'Em scripts, use <code>mkdir -p</code> sempre. Sem o <code>-p</code>, o script quebra na segunda execução porque o diretório já existe. Com <code>-p</code>, ele simplesmente segue em frente.' }
        ]
      },
      { p: 'Outras opções úteis:' },
      {
        cheat: [
          ['mkdir -m 700 secreto', 'já cria com a permissão definida'],
          ['mkdir -v pasta', 'imprime o que criou (útil em scripts)']
        ]
      },

      { cmd: 'touch' },
      { p: 'Aqui mora um mal-entendido comum. O <code>touch</code> <strong>não foi feito para criar arquivos</strong>: ele foi feito para <strong>atualizar a data</strong> de um arquivo. Criar um arquivo vazio quando ele não existe é só um efeito colateral — que virou o uso mais popular.' },
      { code: ['$ touch relatorio.txt', '$ ls -l relatorio.txt'] },
      { p: 'Agora veja o comportamento real. Rode duas vezes com uma pausa e compare a hora:' },
      { code: ['$ ls -l --full-time relatorio.txt', '$ touch relatorio.txt', '$ ls -l --full-time relatorio.txt'] },
      { p: 'O conteúdo não mudou. A data, sim. Todo arquivo no Linux carrega três marcas de tempo:' },
      {
        table: {
          head: ['Marca', 'Significa', 'Muda quando'],
          rows: [
            ['<strong>atime</strong>', '<em>access</em>', 'alguém lê o conteúdo — mas veja o aviso abaixo'],
            ['<strong>mtime</strong>', '<em>modify</em>', 'o conteúdo é alterado'],
            ['<strong>ctime</strong>', '<em>change</em>', 'os metadados mudam (permissão, dono, nome)']
          ]
        }
      },
      { p: 'Você vê os três com o <code>stat</code>:' },
      { code: ['$ stat relatorio.txt'] },
      {
        box: 'note', label: 'Por que o atime quase nunca muda', body: [
          { p: 'Se você ler um arquivo e rodar <code>stat</code> de novo, provavelmente o <em>atime</em> não vai ter mudado — e a conclusão apressada é que a tabela acima está errada.' },
          { p: 'Atualizar o atime a cada leitura significa <strong>escrever no disco toda vez que alguém lê</strong>, o que é caro. Por isso os sistemas modernos montam os discos com <code>relatime</code>: o atime só é atualizado se estiver mais antigo que o mtime, ou se já tiver mais de 24 horas. Alguns servidores vão além e usam <code>noatime</code>, desligando de vez.' },
          { p: 'Confira como está a sua montagem com <code>findmnt /</code> e procure a opção na coluna de opções.' }
        ]
      },
      {
        cheat: [
          ['touch -a arq', 'atualiza só o atime'],
          ['touch -m arq', 'atualiza só o mtime'],
          ['touch -c arq', 'não cria o arquivo se ele não existir'],
          ['touch -d "2020-01-01" arq', 'define uma data específica'],
          ['touch -r modelo.txt arq', 'copia a data de outro arquivo']
        ]
      },
      {
        box: 'note', label: 'Onde isso é usado de verdade', body: [
          { p: 'Sistemas de build (como o <code>make</code>) decidem o que recompilar comparando <em>mtimes</em>. Rotinas de backup incremental copiam só o que tem mtime mais novo que o último backup. E o <code>find -mtime</code> — que você verá no módulo 3 — é a base de toda limpeza automática de arquivos antigos.' }
        ]
      },

      { h2: 'Criando arquivos com conteúdo' },
      { p: 'Para arquivos que já nascem com texto, existem três caminhos, do mais rápido ao mais confortável:' },
      { h4: 'redirecionamento simples' },
      { code: ['$ echo "porta=8080" > config.txt', '$ cat config.txt'] },
      { h4: 'heredoc — várias linhas de uma vez' },
      {
        code: [
          `$ cat > servidor.conf << 'EOF'`,
          `porta 8080`,
          `usuario app`,
          `log /var/log/app.log`,
          `EOF`,
          `$ cat servidor.conf`
        ], run: false, mixed: false
      },
      { p: 'Tudo entre a linha do <code>&lt;&lt; \'EOF\'</code> e a linha que contém só <code>EOF</code> vira conteúdo do arquivo. O nome <code>EOF</code> é só uma convenção — poderia ser <code>FIM</code>.' },
      { h4: 'um editor' },
      { code: ['$ nano notas-aula.txt'] },
      { p: 'O <code>nano</code> abre em tela cheia. Grave com <span class="kbd">Ctrl+O</span> (de <em>write Out</em>) e confirme o nome com <span class="kbd">Enter</span>; saia com <span class="kbd">Ctrl+X</span>. Se você sair com alterações pendentes, ele pergunta <em>"Save modified buffer?"</em> — responda <span class="kbd">Y</span> ou <span class="kbd">N</span>.' },
      { p: 'Versões recentes também aceitam <span class="kbd">Ctrl+S</span> para gravar, mas em alguns terminais essa combinação é engolida pelo controle de fluxo e parece que travou. O <span class="kbd">Ctrl+O</span> funciona em qualquer lugar.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>mkdir -p</code> cria a árvore inteira e é idempotente — use sempre em scripts.',
          '<code>mkdir -p base/{a,b,c}</code> monta estruturas em um comando.',
          '<code>touch</code> atualiza datas; criar arquivo vazio é efeito colateral.',
          'Todo arquivo tem <strong>atime</strong>, <strong>mtime</strong> e <strong>ctime</strong>; veja com <code>stat</code>.',
          'Para criar com conteúdo: <code>&gt;</code>, heredoc <code>&lt;&lt; EOF</code> ou <code>nano</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't2-2-a', kind: 'guiado', title: 'Monte um esqueleto de projeto',
        body: [
          { p: 'Crie uma estrutura completa em um único comando e confirme com o <code>tree</code>:' },
          { code: ['$ mkdir -p ~/api/{src/{rotas,modelos},testes,docs,config}', '$ find ~/api -type d | sort'] },
          { p: 'Existe um comando feito para desenhar essa árvore de forma bonita — o <code>tree</code> — mas ele não vem instalado por padrão. Você o instala na aula 2.6; até lá, o <code>find</code> dá a mesma informação.' },
          { p: 'Repare que as chaves podem ser aninhadas. O shell expande tudo antes do <code>mkdir</code> receber a lista.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [H.isDir(ctx, '/home/aluno/api/src/rotas'), 'Falta o diretório <code>~/api/src/rotas</code>.'],
          [H.isDir(ctx, '/home/aluno/api/src/modelos'), 'Falta o diretório <code>~/api/src/modelos</code>.'],
          [H.isDir(ctx, '/home/aluno/api/testes'), 'Falta o diretório <code>~/api/testes</code>.'],
          [H.isDir(ctx, '/home/aluno/api/config'), 'Falta o diretório <code>~/api/config</code>.']
        ])
      },
      {
        id: 't2-2-q', kind: 'quiz', title: 'O que o touch faz mesmo?',
        body: [{ p: 'Um arquivo <code>dados.csv</code> existe e tem 5 MB de conteúdo. Você executa <code>touch dados.csv</code>. O que acontece?' }],
        options: [
          { text: 'A data de modificação passa a ser agora; o conteúdo permanece intacto.', correct: true },
          { text: 'O arquivo é esvaziado e passa a ter 0 bytes.', why: 'Isso é o que <code>&gt; dados.csv</code> faria. O <code>touch</code> nunca apaga conteúdo.' },
          { text: 'Nada acontece, porque o arquivo já existe.', why: 'Acontece sim — só não é visível no conteúdo. As marcas de tempo são atualizadas.' },
          { text: 'O comando falha com "File exists".', why: 'O <code>touch</code> foi feito justamente para agir em arquivos existentes.' }
        ],
        explain: 'O propósito original do <code>touch</code> é ajustar <em>atime</em> e <em>mtime</em>. Confirme com <code>stat dados.csv</code> antes e depois: o tamanho continua igual, os horários mudam. É por isso que ele é seguro de usar em arquivos com dados.'
      },
      {
        id: 't2-2-b', kind: 'desafio', title: 'Prepare um ambiente de deploy',
        body: [
          { p: 'Monte, dentro do seu home, a seguinte estrutura para uma aplicação chamada <code>loja</code>:' },
          {
            ascii: `loja/
├── app/
│   ├── src/
│   └── public/
├── config/
│   └── producao/
├── logs/
└── backups/`
          },
          { p: 'Além dos diretórios, crie três arquivos vazios: <code>loja/config/producao/app.conf</code>, <code>loja/logs/acesso.log</code> e <code>loja/README.md</code>.' },
          { p: 'Faça isso no <strong>menor número de comandos</strong> que conseguir — dois bastam.' }
        ],
        hints: [
          'Um único <code>mkdir -p</code> com chaves aninhadas cria todos os diretórios: <code>mkdir -p loja/{app/{src,public},config/producao,logs,backups}</code>.',
          'O <code>touch</code> aceita vários arquivos de uma vez: <code>touch a b c</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/loja/{app/{src,public},config/producao,logs,backups}\ntouch ~/loja/config/producao/app.conf ~/loja/logs/acesso.log ~/loja/README.md</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [H.isDir(ctx, '/home/aluno/loja/app/src'), 'Falta <code>loja/app/src</code>.'],
          [H.isDir(ctx, '/home/aluno/loja/app/public'), 'Falta <code>loja/app/public</code>.'],
          [H.isDir(ctx, '/home/aluno/loja/config/producao'), 'Falta <code>loja/config/producao</code>.'],
          [H.isDir(ctx, '/home/aluno/loja/logs'), 'Falta <code>loja/logs</code>.'],
          [H.isDir(ctx, '/home/aluno/loja/backups'), 'Falta <code>loja/backups</code>.'],
          [H.isFile(ctx, '/home/aluno/loja/config/producao/app.conf'), 'Falta o arquivo <code>loja/config/producao/app.conf</code>.'],
          [H.isFile(ctx, '/home/aluno/loja/logs/acesso.log'), 'Falta o arquivo <code>loja/logs/acesso.log</code>.'],
          [H.isFile(ctx, '/home/aluno/loja/README.md'), 'Falta o arquivo <code>loja/README.md</code>.']
        ])
      },

    ]
  });

  /* ============================== 2.3 ============================== */
  LX.lesson('m02', {
    id: 'l2-3', n: '2.3', title: 'Ler arquivos: cat, less, head e tail',
    goal: 'Escolher a ferramenta certa para cada tamanho de arquivo — e nunca mais travar o terminal tentando dar cat em um log de 2 GB.',
    brief: [
      { p: 'Escolha pelo tamanho e pela parte que interessa: <code>cat</code> mostra um arquivo pequeno inteiro; <code>less</code> permite navegar e buscar em arquivos grandes; <code>head</code> mostra o começo; <code>tail</code> mostra o fim.' },
      { code: ['$ less /var/log/syslog', '$ head -n 5 arquivo.csv', '$ tail -n 20 app.log', '$ tail -f app.log'] },
      { p: 'Use <code>tail -f</code> para acompanhar novas linhas de um log em tempo real e pressione <code>Ctrl+C</code> para sair. Evite <code>cat</code> em arquivos grandes.' }
    ],
    body: [
      { p: 'Ler arquivo é a operação mais frequente na administração de sistemas. Existem quatro comandos e a escolha entre eles depende de uma única pergunta: <strong>quanto do arquivo você precisa ver?</strong>' },
      {
        table: {
          head: ['Quero…', 'Use', 'Por quê'],
          rows: [
            ['ver um arquivo pequeno inteiro', '<code>cat</code>', 'joga tudo na tela de uma vez'],
            ['navegar em um arquivo grande', '<code>less</code>', 'carrega sob demanda, busca, rola'],
            ['ver o começo', '<code>head</code>', 'cabeçalho de CSV, início de config'],
            ['ver o fim', '<code>tail</code>', 'os eventos mais recentes de um log'],
            ['acompanhar em tempo real', '<code>tail -f</code>', 'mostra o que for escrito de agora em diante']
          ]
        }
      },

      { cmd: 'cat' },
      { p: '<em>Concatenate</em>. O nome entrega: o propósito original é <strong>juntar</strong> arquivos, e mostrar um só é o caso mais simples.' },
      { code: ['$ cat ~/documentos/notas.txt'] },
      { p: 'Juntando dois:' },
      { code: ['$ cat ~/documentos/notas.txt ~/documentos/tarefas.txt'] },
      {
        cheat: [
          ['cat -n arq', 'numera todas as linhas'],
          ['cat -b arq', 'numera só as linhas não vazias'],
          ['cat -A arq', 'mostra caracteres invisíveis (tab, fim de linha)'],
          ['cat -s arq', 'colapsa linhas em branco repetidas']
        ]
      },
      { p: 'O <code>-A</code> resolve um mistério clássico: "por que meu script não funciona se está idêntico?". Muitas vezes há um espaço no fim da linha ou um tab onde deveria haver espaço.' },
      { code: ['$ cat -A ~/documentos/tarefas.txt | head -3'] },
      {
        box: 'warn', body: [
          { p: 'Nunca dê <code>cat</code> em um arquivo grande ou binário. Um log de 2 GB vai despejar tudo no terminal por vários minutos, e um binário pode embaralhar a tela com códigos de controle. Se acontecer, <span class="kbd">Ctrl+C</span> interrompe e <code>reset</code> conserta a tela.' }
        ]
      },

      { cmd: 'less' },
      { p: 'O leitor de arquivos grandes. Ele carrega o conteúdo por pedaços, então abre instantaneamente mesmo em arquivos enormes.' },
      { code: ['$ less /var/log/app/acesso.log'] },
      { h4: 'teclas dentro do less' },
      {
        cheat: [
          ['Espaço / f', 'avança uma tela'],
          ['b', 'volta uma tela'],
          ['↓ ↑ ou j k', 'linha a linha'],
          ['g / G', 'início / fim do arquivo'],
          ['/palavra', 'busca para frente'],
          ['n / N', 'próxima / anterior ocorrência'],
          ['q', 'sai']
        ]
      },
      {
        box: 'note', label: 'less é o more melhorado', body: [
          { p: 'Existe também o <code>more</code>, mais antigo, que só rola para frente. O <code>less</code> nasceu como resposta e ficou melhor em tudo — daí a piada do nome (<em>less is more</em>). Na prática, use <code>less</code>.' }
        ]
      },

      { cmd: 'head' },
      { p: 'As primeiras 10 linhas por padrão. Perfeito para conferir o cabeçalho de um CSV sem abrir o arquivo inteiro:' },
      { code: ['$ head ~/documentos/servidores.csv', '$ head -3 ~/documentos/servidores.csv', '$ head -c 100 ~/documentos/notas.txt'] },

      { cmd: 'tail' },
      { p: 'As últimas 10 linhas. Em logs, é quase sempre o que você quer — o que acabou de acontecer está no fim.' },
      { code: ['$ tail /var/log/app/erro.log', '$ tail -20 /var/log/app/acesso.log', '$ tail -n +5 ~/documentos/servidores.csv'] },
      { p: 'Repare no último: <code>-n +5</code> significa "a partir da linha 5", não "as últimas 5". É o jeito de pular o cabeçalho de um arquivo.' },
      { h3: 'tail -f: o comando que você vai usar todo dia' },
      { p: 'Com <code>-f</code> (<em>follow</em>), o <code>tail</code> não termina: ele fica esperando e imprime cada nova linha que for escrita no arquivo. É assim que se acompanha um serviço enquanto ele trabalha.' },
      { code: ['$ tail -f /var/log/app/acesso.log'] },
      { p: 'Saia com <span class="kbd">Ctrl+C</span>. Uma variação útil é <code>tail -F</code>, que continua funcionando mesmo se o arquivo for rotacionado e recriado.' },

      { h2: 'Combinando com pipes' },
      { p: 'Estes comandos brilham mesmo quando encaixados. Um aperitivo do módulo 4:' },
      {
        code: [
          '# as 20 linhas mais recentes, e dentre elas só os erros 500',
          '$ tail -20 /var/log/app/acesso.log | grep " 500 "',
          '# linhas 10 a 15 de um arquivo',
          '$ head -15 ~/documentos/servidores.csv | tail -6'
        ]
      },
      { p: 'O segundo é um truque clássico: <code>head</code> corta até onde você quer, <code>tail</code> descarta o que veio antes. Fatiar arquivo sem editor.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>cat</code> para arquivos pequenos; <code>cat -A</code> para caçar caracteres invisíveis.',
          '<code>less</code> para arquivos grandes: <code>/</code> busca, <code>G</code> vai ao fim, <code>q</code> sai.',
          '<code>head -N</code> pega o começo; <code>tail -N</code> pega o fim; <code>tail -n +N</code> pula as primeiras.',
          '<code>tail -f</code> acompanha um log em tempo real. <span class="kbd">Ctrl+C</span> encerra.'
        ]
      }
    ],
    tasks: [
      {
        id: 't2-3-a', kind: 'guiado', title: 'A ferramenta certa para cada arquivo',
        body: [
          { p: 'Compare os quatro comandos no mesmo conjunto de dados e sinta a diferença:' },
          { code: ['$ cat ~/documentos/notas.txt', '$ head -3 ~/documentos/servidores.csv', '$ tail -3 ~/documentos/servidores.csv', '$ wc -l /var/log/app/acesso.log', '$ less /var/log/app/acesso.log'] },
          { p: 'Repare no <code>wc -l</code>: o log tem centenas de linhas. Dar <code>cat</code> nele encheria a tela — por isso o <code>less</code>.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /^\s*head\b/m), 'Use o <code>head</code> em algum arquivo.'],
          [() => H.usedCommand(ctx, /^\s*tail\b/m), 'Use o <code>tail</code> em algum arquivo.'],
          [() => H.usedCommand(ctx, /^\s*less\b/m), 'Abra um arquivo com o <code>less</code> (saia com <kbd>q</kbd>).']
        ])
      },
      {
        id: 't2-3-f', kind: 'fill', title: 'Complete o comando',
        body: [{ p: 'Você quer ver as <strong>últimas 50 linhas</strong> do log de acesso e continuar acompanhando as novas em tempo real. Complete:' }],
        template: 'tail ___ /var/log/app/acesso.log', sample: '-50f',
        answers: ['-50f|-f -50|-n 50 -f|-fn 50|-n50 -f'],
        hints: ['São duas coisas: a quantidade de linhas e o modo "seguir".'],
        solution: 'Formas equivalentes: <code>tail -50f arquivo</code>, <code>tail -f -n 50 arquivo</code> ou <code>tail -n 50 -f arquivo</code>. Opções curtas podem ser agrupadas.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim().replace(/\s+/g, ' ');
          const temF = /(^|[^\w])-\w*f/.test(v);
          const tem50 = /50/.test(v);
          return LX.H.checkAll([
            [tem50, 'Falta indicar as 50 linhas.'],
            [temF, 'Falta a opção que faz o <code>tail</code> continuar acompanhando o arquivo.']
          ]);
        }
      },
      {
        id: 't2-3-b', kind: 'desafio', title: 'Fatie o arquivo',
        body: [
          { p: 'O arquivo <code>~/documentos/servidores.csv</code> tem um cabeçalho e uma linha por servidor.' },
          { p: 'Grave em <code>~/homolog.txt</code> <strong>apenas as linhas 6 e 7</strong> do arquivo (que são, respectivamente, os servidores de homologação) — sem o cabeçalho e sem as outras linhas.' },
          { p: 'Você não pode usar <code>grep</code>: o exercício é sobre recortar por posição, não por conteúdo.' }
        ],
        hints: [
          'Pense em dois passos: primeiro corte tudo depois da linha 7, depois descarte tudo antes da linha 6.',
          '<code>head -7 arquivo</code> te dá as sete primeiras. Dessas sete, as duas últimas são exatamente o que você quer — e <code>tail -2</code> pega as duas últimas.'
        ],
        solution: '<div class="code"><pre>head -7 ~/documentos/servidores.csv | tail -2 &gt; ~/homolog.txt\ncat ~/homolog.txt</pre></div><p style="margin-top:8px">Esse par <code>head N | tail M</code> é a maneira canônica de extrair um intervalo de linhas sem abrir editor.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/homolog.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/homolog.txt ainda não existe.' };
          const linhas = c.split('\n').filter(l => l.trim());
          const usouGrep = (ctx.term.history || []).some(h => /grep/.test(h) && /homolog\.txt/.test(h));
          return LX.H.checkAll([
            [!usouGrep, 'Você usou <code>grep</code>. O desafio pede recorte por posição — use <code>head</code> e <code>tail</code>.'],
            [linhas.length === 2, `O arquivo tem ${linhas.length} linha(s); são esperadas exatamente 2.`],
            [linhas.some(l => /web03/.test(l)), 'Falta a linha do servidor <code>web03</code> (linha 6).'],
            [linhas.some(l => /db02/.test(l)), 'Falta a linha do servidor <code>db02</code> (linha 7).'],
            [!/^nome,ip/m.test(c), 'O cabeçalho não deveria estar no arquivo.']
          ]);
        }
      },

    ]
  });

  /* ============================== 2.4 ============================== */
  LX.lesson('m02', {
    id: 'l2-4', n: '2.4', title: 'Copiar e mover: cp e mv',
    goal: 'Dominar as duas operações que mais causam acidentes — e entender por que renomear e mover são a mesma coisa no Linux.',
    brief: [
      { p: '<code>cp ORIGEM DESTINO</code> copia arquivos; para diretórios, use <code>cp -r</code>. <code>mv</code> move um item ou o renomeia quando origem e destino ficam no mesmo diretório.' },
      { code: ['$ cp -i config.ini config.backup.ini', '$ cp -r site site-backup', '$ mv rascunho.txt relatorio.txt'] },
      { p: 'Um destino existente pode ser sobrescrito. Enquanto estiver aprendendo, use <code>-i</code> para pedir confirmação e confira origem e destino com <code>ls</code> antes da operação.' }
    ],
    body: [
      { cmd: 'cp' },
      { p: 'Copia. A forma é sempre <code>cp ORIGEM DESTINO</code>.' },
      { code: ['$ cd ~/documentos', '$ cp notas.txt notas-backup.txt', '$ ls'] },
      { p: 'Se o destino for um <strong>diretório existente</strong>, o arquivo é copiado <em>para dentro</em> dele mantendo o nome:' },
      { code: ['$ cp notas.txt ~/projetos/', '$ ls ~/projetos'] },
      { p: 'E você pode copiar vários de uma vez — nesse caso o último argumento <strong>tem</strong> que ser um diretório:' },
      { code: ['$ cp notas.txt tarefas.txt ~/projetos/'] },

      { h3: 'Diretórios exigem -r' },
      { p: 'Por segurança, o <code>cp</code> se recusa a copiar um diretório sem que você peça explicitamente:' },
      { code: ['$ cp ~/projetos ~/projetos-copia', '$ cp -r ~/projetos ~/projetos-copia', '$ ls ~/projetos-copia'] },

      { h3: 'As opções que importam' },
      {
        table: {
          head: ['Opção', 'O que faz', 'Quando usar'],
          rows: [
            ['<code>-r</code>', 'copia diretórios recursivamente', 'sempre que a origem for pasta'],
            ['<code>-i</code>', 'pergunta antes de sobrescrever', 'quando você tem dúvida'],
            ['<code>-n</code>', 'nunca sobrescreve', 'scripts que não podem perder dados'],
            ['<code>-u</code>', 'copia só se a origem for mais nova', 'sincronização simples'],
            ['<code>-v</code>', 'mostra o que está copiando', 'scripts e cópias longas'],
            ['<code>-p</code>', 'preserva dono, permissões e datas', 'backup'],
            ['<code>-a</code>', 'modo arquivo: <code>-r</code> + <code>-p</code> + links', '<strong>backup de verdade</strong>']
          ]
        }
      },
      {
        box: 'tip', label: 'A que você deve memorizar', body: [
          { p: '<code>cp -a origem destino</code>. O <code>-a</code> preserva tudo: permissões, donos, datas e links simbólicos. Uma cópia com <code>cp -r</code> comum pode chegar do outro lado com dono errado e permissões diferentes — e aí o serviço não sobe.' }
        ]
      },
      {
        box: 'warn', label: 'O destino existir ou não muda tudo', body: [
          { p: 'O mesmo <code>cp -r origem destino</code> faz duas coisas diferentes:' },
          {
            ascii: `destino NÃO existe   →  cria destino/ como cópia de origem/
                        destino/arquivo.txt

destino JÁ existe    →  põe origem DENTRO dele
                        destino/origem/arquivo.txt`
          },
          { p: 'Rodar o mesmo comando duas vezes seguidas produz resultados diferentes na primeira e na segunda vez. Confira com <code>ls</code> antes — ou use <code>-T</code>, que trata o destino sempre como o nome final e nunca entra nele.' }
        ]
      },

      { cmd: 'mv' },
      { p: 'Move. E, como efeito da forma como o Linux guarda arquivos, <strong>renomear é mover</strong>: o conteúdo fica no mesmo lugar do disco, só a entrada no diretório muda de nome.' },
      { code: ['$ cd ~/documentos', '$ mv notas-backup.txt notas-antigas.txt', '$ ls'] },
      { p: 'Mover para outro diretório:' },
      { code: ['$ mv notas-antigas.txt ~/projetos/', '$ ls ~/projetos'] },
      { p: 'Mover <strong>e</strong> renomear no mesmo comando:' },
      { code: ['$ mv ~/projetos/notas-antigas.txt ~/documentos/arquivo-morto.txt'] },
      { p: 'O <code>mv</code> não precisa de <code>-r</code> para diretórios — mover uma pasta é só trocar o nome dela na árvore, não copiar conteúdo.' },
      {
        cheat: [
          ['mv -i a b', 'pergunta antes de sobrescrever'],
          ['mv -n a b', 'nunca sobrescreve'],
          ['mv -v a b', 'mostra o que fez'],
          ['mv -b a b', 'cria backup do destino antes de sobrescrever']
        ]
      },
      {
        box: 'warn', label: 'O acidente clássico', body: [
          { p: 'Se <code>destino</code> já for um arquivo existente, o <code>mv</code> <strong>sobrescreve sem avisar</strong>. Não há lixeira, não há desfazer.' },
          { p: 'Em máquina que você não conhece, use <code>mv -i</code> até criar confiança no que está fazendo.' }
        ]
      },

      { h2: 'cp ou mv?' },
      {
        table: {
          head: ['Situação', 'Comando'],
          rows: [
            ['Guardar uma versão antes de editar', '<code>cp arquivo arquivo.bak</code>'],
            ['Renomear', '<code>mv antigo novo</code>'],
            ['Organizar arquivos em pastas', '<code>mv *.log logs/</code>'],
            ['Backup preservando tudo', '<code>cp -a origem destino</code>'],
            ['Levar para outra partição/disco', '<code>mv</code> (copia e apaga, mais lento)']
          ]
        }
      },
      {
        box: 'note', body: [
          { p: 'Dentro do mesmo sistema de arquivos, o <code>mv</code> é instantâneo mesmo para arquivos de 50 GB — porque nada é copiado. Entre discos diferentes, ele copia e depois apaga, e aí demora. Se um <code>mv</code> estiver lento, é sinal de que você atravessou uma fronteira de sistema de arquivos.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>cp ORIGEM DESTINO</code>; diretórios exigem <code>-r</code>.',
          '<code>cp -a</code> é a forma correta de copiar preservando permissões e donos.',
          '<code>mv</code> renomeia e move — é a mesma operação.',
          'Ambos sobrescrevem sem perguntar. <code>-i</code> pergunta, <code>-n</code> nunca sobrescreve.',
          'Antes de mexer em configuração: <code>cp arquivo arquivo.bak</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't2-4-a', kind: 'guiado', title: 'O reflexo do backup',
        body: [
          { p: 'Antes de editar qualquer configuração, copie. Pratique o reflexo:' },
          { code: ['$ cd ~/projetos/site', '$ cp index.html index.html.bak', '$ ls -l', '$ cp -a ~/projetos/site ~/projetos/site-v2', '$ ls ~/projetos'] },
          { p: 'Repare que o <code>-a</code> trouxe também as datas originais dos arquivos — compare com <code>ls -l ~/projetos/site-v2</code>.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [H.isFile(ctx, '/home/aluno/projetos/site/index.html.bak'), 'Falta a cópia <code>index.html.bak</code>.'],
          [H.isDir(ctx, '/home/aluno/projetos/site-v2'), 'Falta o diretório <code>~/projetos/site-v2</code>.'],
          [H.isFile(ctx, '/home/aluno/projetos/site-v2/index.html'), 'A cópia do diretório parece incompleta.']
        ])
      },
      {
        id: 't2-4-p', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Existe o diretório <code>~/backup</code> (vazio) e o arquivo <code>~/dados.txt</code>. Você executa duas vezes seguidas:' },
          { code: ['cp ~/dados.txt ~/backup'], run: false, mixed: false },
          { p: 'O que existe em <code>~/backup</code> no final?' }
        ],
        options: [
          { text: 'Um único arquivo, <code>~/backup/dados.txt</code> — a segunda cópia sobrescreveu a primeira.', correct: true },
          { text: 'Dois arquivos: <code>dados.txt</code> e <code>dados.txt.1</code>.', why: 'O <code>cp</code> não numera cópias automaticamente. Isso é comportamento de navegadores, não do shell.' },
          { text: 'Um arquivo chamado <code>backup</code>, sem extensão.', why: 'Isso aconteceria se <code>~/backup</code> <em>não existisse</em> como diretório: aí o <code>cp</code> criaria um arquivo com esse nome.' },
          { text: 'Erro na segunda execução: "File exists".', why: 'O <code>cp</code> sobrescreve silenciosamente. Só com <code>-n</code> ou <code>-i</code> ele muda esse comportamento.' }
        ],
        explain: 'Quando o destino é um diretório <strong>que existe</strong>, o <code>cp</code> coloca o arquivo dentro dele mantendo o nome. Rodar de novo simplesmente sobrescreve. Se <code>~/backup</code> não existisse, a primeira execução criaria um <em>arquivo</em> com esse nome — um erro comum e silencioso.'
      },
      {
        id: 't2-4-b', kind: 'desafio', title: 'Organize a bagunça',
        body: [
          { p: 'Prepare o cenário rodando isto no terminal:' },
          {
            code: [
              '$ mkdir -p ~/bagunca && cd ~/bagunca',
              '$ touch relatorio1.csv relatorio2.csv notas.txt leiame.txt app.log erro.log',
              '$ ls'
            ]
          },
          { p: 'Agora organize: crie três subdiretórios — <code>planilhas</code>, <code>textos</code> e <code>logs</code> — e mova cada arquivo para o lugar certo <strong>de acordo com a extensão</strong>.' },
          { p: 'Faça isso usando <strong>globbing</strong>, não listando os arquivos um por um. Devem sobrar apenas os três diretórios em <code>~/bagunca</code>.' }
        ],
        hints: [
          'Crie os três de uma vez: <code>mkdir -p planilhas textos logs</code> — ou com chaves.',
          'O <code>mv</code> aceita glob e vários arquivos: <code>mv *.csv planilhas/</code>. Faça um para cada extensão.'
        ],
        solution: '<div class="code"><pre>cd ~/bagunca\nmkdir -p planilhas textos logs\nmv *.csv planilhas/\nmv *.txt textos/\nmv *.log logs/\nls</pre></div><p style="margin-top:8px">Antes de um <code>mv *</code> em pasta desconhecida, rode <code>ls *.csv</code> primeiro para ver o que o shell vai expandir.</p>',
        check: async (ctx) => {
          const base = '/home/aluno/bagunca';
          const restante = (H.ls(ctx, base) || []).filter(n => !['planilhas', 'textos', 'logs'].includes(n));
          return LX.H.checkAll([
            [H.isDir(ctx, base + '/planilhas'), 'Falta o diretório <code>planilhas</code>.'],
            [H.isDir(ctx, base + '/textos'), 'Falta o diretório <code>textos</code>.'],
            [H.isDir(ctx, base + '/logs'), 'Falta o diretório <code>logs</code>.'],
            [H.isFile(ctx, base + '/planilhas/relatorio1.csv') && H.isFile(ctx, base + '/planilhas/relatorio2.csv'), 'Os arquivos <code>.csv</code> ainda não estão em <code>planilhas/</code>.'],
            [H.isFile(ctx, base + '/textos/notas.txt') && H.isFile(ctx, base + '/textos/leiame.txt'), 'Os arquivos <code>.txt</code> ainda não estão em <code>textos/</code>.'],
            [H.isFile(ctx, base + '/logs/app.log') && H.isFile(ctx, base + '/logs/erro.log'), 'Os arquivos <code>.log</code> ainda não estão em <code>logs/</code>.'],
            [restante.length === 0, `Ainda sobrou fora dos diretórios: ${restante.join(', ')}.`],
            [() => H.usedCommand(ctx, /mv\s+\*\./), 'Você moveu os arquivos um a um. Refaça usando glob, por exemplo <code>mv *.csv planilhas/</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 2.5 ============================== */
  LX.lesson('m02', {
    id: 'l2-5', n: '2.5', title: 'Apagar sem se arrepender: rm e rmdir',
    goal: 'Aprender o comando mais perigoso do Linux junto com os hábitos que impedem você de destruir um servidor às três da manhã.',
    brief: [
      { p: '<code>rm</code> apaga arquivos sem passar pela lixeira. <code>rmdir</code> remove apenas diretórios vazios. Para apagar uma árvore, <code>rm</code> exige <code>-r</code>, o que torna a conferência do caminho essencial.' },
      { code: ['$ ls -lah ./temporarios', '$ rm -i ./temporarios/rascunho.txt', '$ rmdir ./temporarios'] },
      { p: 'Antes de apagar, rode <code>pwd</code> e <code>ls</code> no destino. Prefira caminhos explícitos e <code>-i</code> durante o aprendizado. Use <code>rmdir</code> quando a pasta deveria estar vazia: ele falha se ainda houver conteúdo.' }
    ],
    body: [
      {
        box: 'warn', label: 'Leia antes de tudo', body: [
          { p: 'No Linux, <strong>não existe lixeira no terminal</strong>. O que o <code>rm</code> apaga, some. Não há Ctrl+Z, não há "restaurar". Recuperação só com backup — ou com ferramentas forenses caras e sem garantia.' },
          { p: 'Isso não é motivo para ter medo. É motivo para desenvolver dois ou três hábitos que tornam o acidente improvável.' }
        ]
      },

      { cmd: 'rm' },
      { p: '<em>Remove</em>. Apaga arquivos.' },
      { code: ['$ cd ~/bagunca 2>/dev/null || mkdir -p ~/bagunca && cd ~/bagunca', '$ touch temp1.txt temp2.txt', '$ rm temp1.txt', '$ ls'] },
      {
        table: {
          head: ['Opção', 'O que faz', 'Risco'],
          rows: [
            ['<code>-i</code>', 'pergunta antes de cada remoção', 'nenhum — é a rede de segurança'],
            ['<code>-v</code>', 'mostra o que apagou', 'nenhum'],
            ['<code>-r</code>', 'apaga diretórios e todo o conteúdo', '<strong>alto</strong>'],
            ['<code>-f</code>', 'força: não pergunta, ignora inexistentes', '<strong>alto</strong>'],
            ['<code>-d</code>', 'apaga diretório vazio', 'baixo']
          ]
        }
      },
      { p: 'Sem <code>-r</code>, o <code>rm</code> se recusa a apagar diretórios:' },
      { code: ['$ mkdir pasta && touch pasta/a.txt', '$ rm pasta', '$ rm -r pasta', '$ ls'] },

      { cmd: 'rmdir' },
      { p: 'Apaga diretórios — mas <strong>só se estiverem vazios</strong>. Essa limitação é a virtude dele: é impossível apagar dados por engano.' },
      { code: ['$ mkdir vazia', '$ rmdir vazia', '$ mkdir -p cheia && touch cheia/arquivo', '$ rmdir cheia'] },
      { p: 'Quando você quer garantir que está apagando algo realmente vazio, <code>rmdir</code> é mais seguro que <code>rm -r</code>.' },

      { h2: 'Os comandos que destroem servidores' },
      { p: 'Vale conhecer os erros clássicos <strong>para reconhecê-los antes de apertar Enter</strong>:' },
      {
        code: [
          'rm -rf /              # apaga o sistema inteiro',
          'rm -rf ~             # apaga todos os seus arquivos',
          'rm -rf /*            # idem, sem a proteção do primeiro',
          'rm -rf $DIRETORIO/*  # se a variável estiver vazia, vira "rm -rf /*"',
          'rm -rf . /caminho    # o espaço extra apaga o diretório atual também'
        ], run: false, mixed: false, lang: 'text'
      },
      { p: 'O quarto é o mais insidioso e o mais comum em scripts reais. Se <code>$DIRETORIO</code> não estiver definida, o shell expande para nada e sobra <code>rm -rf /*</code>. É exatamente por isso que o módulo 15 vai insistir tanto no <code>set -u</code>, que aborta o script ao usar uma variável não definida em vez de seguir em frente com ela vazia.' },
      { p: 'Distribuições modernas protegem o caso de <code>rm -rf /</code> exigindo <code>--no-preserve-root</code>, mas <strong>não protegem</strong> os outros quatro.' },

      { h2: 'Cinco hábitos que evitam o desastre' },
      {
        ol: [
          '<strong>Rode <code>pwd</code> antes.</strong> Metade dos acidentes é apagar a coisa certa no diretório errado.',
          '<strong>Troque o <code>rm</code> por <code>ls</code> primeiro.</strong> Se <code>ls *.tmp</code> mostra o que você espera, então <code>rm *.tmp</code> vai fazer o certo.',
          '<strong>Prefira caminhos absolutos.</strong> <code>rm -rf /home/aluno/temp</code> não depende de onde você está.',
          '<strong>Nunca combine <code>-f</code> com glob em pasta desconhecida.</strong> O <code>-f</code> remove justamente os avisos que te salvariam.',
          '<strong>Em scripts, valide a variável.</strong> <code>rm -rf "${DIR:?variavel vazia}"/*</code> aborta com erro se <code>DIR</code> estiver vazia.'
        ]
      },
      {
        box: 'tip', label: 'Uma alternativa mais calma', body: [
          { p: 'Quando estiver em dúvida, <strong>mova em vez de apagar</strong>: <code>mkdir -p ~/.lixeira &amp;&amp; mv arquivos ~/.lixeira/</code>. Você libera o espaço mentalmente e ainda pode voltar atrás. Depois de uma semana sem sentir falta, aí sim apague.' }
        ]
      },
      {
        box: 'note', label: 'E o alias rm -i?', body: [
          { p: 'Muita gente coloca <code>alias rm=\'rm -i\'</code> no <code>.bashrc</code>. Funciona, mas cria um hábito perigoso: você se acostuma a receber a pergunta e, no dia em que estiver em um servidor sem o alias, vai apertar Enter no automático. Prefira o hábito de conferir com <code>ls</code>.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>rm</code> apaga para sempre. Não há lixeira.',
          '<code>rm -r</code> para diretórios; <code>rmdir</code> só apaga se estiver vazio — e por isso é mais seguro.',
          '<code>-f</code> desliga os avisos; combine com cuidado extremo.',
          'Confira com <code>ls</code> o mesmo padrão antes de usar no <code>rm</code>.',
          'Em scripts, valide variáveis antes de apagar caminhos montados com elas.'
        ]
      }
    ],
    tasks: [
      {
        id: 't2-5-a', kind: 'guiado', title: 'Sinta a diferença entre rm e rmdir',
        body: [
          { p: 'Crie um cenário e observe cada recusa do sistema — as recusas são o mecanismo de proteção funcionando:' },
          {
            code: [
              '$ mkdir -p ~/lab/{vazia,cheia}',
              '$ touch ~/lab/cheia/dado.txt',
              '$ rmdir ~/lab/vazia',
              '$ rmdir ~/lab/cheia',
              '$ rm ~/lab/cheia',
              '$ rm -r ~/lab/cheia',
              '$ ls ~/lab'
            ]
          },
          { p: 'Três comandos falharam de propósito. Leia cada mensagem de erro: elas dizem exatamente qual proteção foi acionada.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /^\s*rmdir\b/m), 'Use o <code>rmdir</code> em algum diretório.'],
          [() => H.usedCommand(ctx, /rm\s+-r/), 'Use <code>rm -r</code> para apagar o diretório com conteúdo.'],
          [!H.exists(ctx, '/home/aluno/lab/cheia'), 'O diretório <code>~/lab/cheia</code> ainda existe.']
        ])
      },
      {
        id: 't2-5-q', kind: 'quiz', title: 'Qual destes é o mais perigoso?',
        body: [
          { p: 'Você está escrevendo um script de limpeza. Qual das linhas abaixo pode apagar o sistema inteiro se algo der errado?' }
        ],
        options: [
          { text: '<code>rm -rf $TEMPDIR/*</code>', correct: true },
          { text: '<code>rm -rf /tmp/build/*</code>', why: 'É explícito e limitado a um caminho fixo. Se o caminho não existir, não apaga nada além dali.' },
          { text: '<code>rm -i *.log</code>', why: 'O <code>-i</code> pergunta a cada arquivo e o padrão é restrito a <code>.log</code>. É a versão mais cautelosa possível.' },
          { text: '<code>rmdir /tmp/build</code>', why: 'O <code>rmdir</code> só funciona em diretório vazio. É praticamente impossível causar dano com ele.' }
        ],
        explain: 'Se <code>$TEMPDIR</code> não estiver definida — erro de digitação no nome, variável não exportada, script rodando em outro contexto — o shell a expande para nada e a linha vira literalmente <code>rm -rf /*</code>. A defesa é <code>rm -rf "${TEMPDIR:?TEMPDIR nao definida}"/*</code>, que aborta o script em vez de apagar a raiz.'
      },
      {
        id: 't2-5-b', kind: 'desafio', title: 'Limpeza seletiva com conferência',
        body: [
          { p: 'Monte o cenário:' },
          {
            code: [
              '$ mkdir -p ~/limpeza && cd ~/limpeza',
              '$ touch dados.csv relatorio.csv config.yml app.log app.log.1 app.log.2 cache.tmp sessao.tmp importante.txt',
              '$ ls'
            ]
          },
          { p: 'Sua missão: apagar <strong>apenas</strong> os arquivos <code>.tmp</code> e os logs rotacionados (<code>app.log.1</code> e <code>app.log.2</code>), preservando <code>app.log</code> e todo o resto.' },
          { p: 'Regra do exercício: <strong>antes de cada <code>rm</code>, rode o mesmo padrão com <code>ls</code></strong> para conferir. É esse hábito que o desafio quer instalar em você.' }
        ],
        hints: [
          'Os <code>.tmp</code> saem com <code>*.tmp</code>. Confira antes: <code>ls *.tmp</code>.',
          'Cuidado com os logs: <code>app.log*</code> pegaria também o <code>app.log</code>. Você precisa de um padrão que exija algo depois do <code>.log</code> — por exemplo <code>app.log.*</code>.'
        ],
        solution: '<div class="code"><pre>cd ~/limpeza\nls *.tmp          # confere\nrm *.tmp\nls app.log.*      # confere\nrm app.log.*\nls</pre></div><p style="margin-top:8px">O detalhe fino é o ponto: <code>app.log.*</code> exige um ponto depois de <code>log</code>, então o <code>app.log</code> puro fica de fora. Com <code>app.log*</code> você teria apagado o log ativo.</p>',
        check: async (ctx) => {
          const base = '/home/aluno/limpeza';
          const restante = H.ls(ctx, base);
          if (!restante) return { ok: false, msg: 'O diretório <code>~/limpeza</code> ainda não existe. Monte o cenário primeiro.' };
          const conferiu = (ctx.term.history || []).some(h => /^\s*ls\s+.*\*\.tmp/.test(h) || /^\s*ls\s+.*app\.log\./.test(h));
          return LX.H.checkAll([
            [!restante.includes('cache.tmp') && !restante.includes('sessao.tmp'), 'Os arquivos <code>.tmp</code> ainda estão lá.'],
            [!restante.includes('app.log.1') && !restante.includes('app.log.2'), 'Os logs rotacionados <code>app.log.1</code> e <code>app.log.2</code> ainda estão lá.'],
            [restante.includes('app.log'), 'Você apagou o <code>app.log</code> — ele deveria ser preservado. O padrão <code>app.log*</code> é largo demais; use <code>app.log.*</code>.'],
            [restante.includes('importante.txt'), 'O arquivo <code>importante.txt</code> foi apagado. Ele deveria permanecer.'],
            [restante.includes('dados.csv') && restante.includes('relatorio.csv') && restante.includes('config.yml'), 'Algum arquivo que deveria ser preservado sumiu.'],
            [conferiu, 'Você apagou sem conferir antes. Rode o mesmo padrão com <code>ls</code> primeiro — é a parte mais importante deste desafio.']
          ]);
        }
      }
    ]
  });

  /* ============================== 2.6 ============================== */
  LX.lesson('m02', {
    id: 'l2-6', n: '2.6', title: 'Investigar: file, stat, tree, which, whereis e type',
    goal: 'Descobrir o que é um arquivo sem abri-lo, e descobrir exatamente qual programa o shell vai executar quando você digita um nome.',
    brief: [
      { p: '<code>file</code> identifica o tipo real pelo conteúdo; <code>stat</code> mostra tamanho, dono, permissões e datas; <code>tree</code> exibe a hierarquia de uma pasta.' },
      { code: ['$ file relatorio', '$ stat relatorio', '$ type ls', '$ which python3'] },
      { p: 'Para descobrir o que o shell executará, prefira <code>type</code>: ele reconhece aliases, funções, comandos internos e programas. <code>which</code> procura executáveis no <code>PATH</code>; <code>whereis</code> também busca páginas de manual e caminhos relacionados.' }
    ],
    body: [
      { h2: 'O que é este arquivo?' },
      { cmd: 'file' },
      { p: 'Lembre que <strong>extensão não significa nada</strong> no Linux. O <code>file</code> descobre o tipo real olhando os primeiros bytes do conteúdo — os chamados <em>magic numbers</em>.' },
      { code: ['$ file ~/documentos/notas.txt', '$ file /usr/bin/ls', '$ file /etc', '$ file /dev/null', '$ file ~/documentos'] },
      { p: 'Isso é útil de verdade quando alguém te manda um <code>relatorio.pdf</code> que na verdade é um ZIP, ou quando você precisa saber se um arquivo sem extensão é um script ou um binário.' },

      { cmd: 'stat' },
      { p: 'O raio-X completo de um arquivo: tamanho exato, inode, número de links, permissões em duas notações, dono, grupo e as três marcas de tempo.' },
      { code: ['$ stat ~/documentos/notas.txt'] },
      { p: 'A linha mais útil é a <code>Access: (0644/-rw-r--r--)</code>: ela mostra a permissão em octal e em simbólico ao mesmo tempo, o que ajuda muito enquanto você ainda está aprendendo a converter uma na outra (módulo 5).' },
      { p: 'O <code>-c</code> permite extrair só o que você quer, o que é ouro em scripts:' },
      {
        cheat: [
          ['stat -c %s arq', 'tamanho em bytes'],
          ['stat -c %a arq', 'permissão em octal (644)'],
          ['stat -c %U arq', 'nome do dono'],
          ['stat -c %G arq', 'nome do grupo'],
          ['stat -c %i arq', 'número do inode'],
          ['stat -c "%n %s %U" arq', 'vários de uma vez']
        ]
      },
      { code: ['$ stat -c "%n tem %s bytes e pertence a %U" ~/documentos/notas.txt'] },

      { cmd: 'tree' },
      { p: 'Mostra a hierarquia de diretórios em forma de árvore. Não vem instalado por padrão no Ubuntu:' },
      { code: ['$ sudo apt install -y tree', '$ tree ~/projetos'] },
      {
        cheat: [
          ['tree -L 2', 'limita a dois níveis de profundidade'],
          ['tree -d', 'só diretórios'],
          ['tree -a', 'inclui ocultos'],
          ['tree -h', 'mostra tamanhos'],
          ['tree -f', 'mostra o caminho completo']
        ]
      },
      { p: 'Em servidor sem <code>tree</code>, o substituto imediato é <code>ls -R</code> — menos bonito, mesma informação.' },

      { h2: 'Qual programa vai rodar?' },
      { p: 'Quando você digita <code>ls</code>, o shell precisa decidir <em>o que</em> executar. E a ordem de decisão dele não é óbvia:' },
      {
        ol: [
          '<strong>Alias</strong> — apelidos que você ou a distribuição definiram.',
          '<strong>Função</strong> do shell, se existir uma com esse nome.',
          '<strong>Builtin</strong> — comandos internos do próprio Bash (<code>cd</code>, <code>echo</code>, <code>export</code>).',
          '<strong>Programa no PATH</strong> — o primeiro arquivo executável encontrado, na ordem dos diretórios do <code>$PATH</code>.'
        ]
      },
      { cmd: 'type' },
      { p: 'Responde exatamente qual das quatro opções o shell escolheu. É o comando definitivo para essa dúvida:' },
      { code: ['$ type ls', '$ type cd', '$ type type', '$ type grep'] },
      { p: 'Repare que <code>ls</code> costuma ser um <em>alias</em> para <code>ls --color=auto</code>. É por isso que a saída vem colorida sem você pedir.' },
      { cmd: 'which' },
      { p: 'Mostra o caminho do <strong>programa</strong> que seria executado. Não sabe sobre aliases nem builtins:' },
      { code: ['$ which ls', '$ which python3', '$ which cd'] },
      { p: 'O último não devolve nada — porque <code>cd</code> é builtin, não existe arquivo.' },
      { cmd: 'whereis' },
      { p: 'Procura o binário, o código-fonte e a página de manual de uma vez:' },
      { code: ['$ whereis ls', '$ whereis bash'] },
      {
        table: {
          head: ['Comando', 'Responde', 'Enxerga alias/builtin?'],
          rows: [
            ['<code>type</code>', 'o que o shell realmente vai executar', '<strong>sim</strong>'],
            ['<code>which</code>', 'o caminho do programa no PATH', 'não'],
            ['<code>whereis</code>', 'binário + fonte + manual', 'não']
          ]
        }
      },
      {
        box: 'tip', label: 'Na dúvida, type', body: [
          { p: 'Se um comando está se comportando de forma estranha, <code>type -a nome</code> mostra <em>todas</em> as definições encontradas, em ordem. Muitas vezes a resposta é um alias esquecido ou uma versão antiga em <code>/usr/local/bin</code> ganhando da versão nova em <code>/usr/bin</code>.' }
        ]
      },

      { h2: 'Resumo' },
      {
        cheat: [
          ['file arq', 'que tipo de arquivo é, de verdade'],
          ['stat arq', 'tudo sobre o arquivo: tamanho, inode, datas, permissões'],
          ['stat -c %s arq', 'extrai um campo só — ideal para scripts'],
          ['tree -L 2 dir', 'a estrutura em árvore'],
          ['type cmd', 'o que o shell vai executar (a resposta definitiva)'],
          ['which cmd', 'o caminho do binário'],
          ['whereis cmd', 'binário, fonte e manual']
        ]
      }
    ],
    tasks: [
      {
        id: 't2-6-a', kind: 'guiado', title: 'Identifique sem abrir',
        body: [
          { p: 'Descubra o tipo de cinco coisas bem diferentes e repare que o <code>file</code> acerta todas sem depender do nome:' },
          { code: ['$ file /etc/passwd', '$ file /usr/bin/ls', '$ file /dev/vda', '$ file /etc/ssh', '$ file /proc/uptime'] },
          { p: 'Agora compare as três formas de localizar um comando:' },
          { code: ['$ type ls', '$ which ls', '$ whereis ls'] }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /^\s*file\b/m), 'Use o comando <code>file</code>.'],
          [() => H.usedCommand(ctx, /^\s*type\b/m), 'Use o comando <code>type</code>.'],
          [() => H.usedCommand(ctx, /^\s*which\b/m), 'Use o comando <code>which</code>.']
        ])
      },
      {
        id: 't2-6-q', kind: 'quiz', title: 'Por que which não achou?',
        body: [
          { p: 'Você roda <code>which cd</code> e não sai nada. Mas <code>cd</code> claramente funciona. Qual é a explicação?' }
        ],
        options: [
          { text: '<code>cd</code> é um builtin do Bash — não existe um arquivo executável para o <code>which</code> encontrar.', correct: true },
          { text: 'O <code>cd</code> não está no <code>$PATH</code> e precisa ser instalado.', why: 'Não há o que instalar: o <code>cd</code> faz parte do próprio shell.' },
          { text: 'O <code>which</code> está quebrado nessa máquina.', why: 'Está funcionando normalmente — ele só procura arquivos, e não há arquivo nenhum.' },
          { text: 'Você não tem permissão para ver o binário do <code>cd</code>.', why: 'Não é permissão: o binário simplesmente não existe.' }
        ],
        explain: 'O <code>cd</code> <strong>precisa</strong> ser builtin. Um programa externo roda em um processo filho e mudaria apenas o diretório dele, que morre em seguida — o shell pai continuaria onde estava. Confirme com <code>type cd</code>, que responde "<em>is a shell builtin</em>".'
      },
      {
        id: 't2-6-b', kind: 'desafio', title: 'Fichas técnicas automáticas',
        body: [
          { p: 'Monte um arquivo <code>~/ficha.txt</code> com uma linha para cada um destes três arquivos — <code>/etc/passwd</code>, <code>/usr/bin/ls</code> e <code>~/documentos/notas.txt</code> — no formato exato:' },
          { code: ['CAMINHO | TAMANHO bytes | dono DONO | permissao OCTAL'], run: false, mixed: false, lang: 'text' },
          { p: 'Por exemplo: <code>/etc/passwd | 812 bytes | dono root | permissao 644</code>.' },
          { p: 'Todos os valores devem vir de comandos, não digitados à mão.' }
        ],
        hints: [
          'O <code>stat -c</code> aceita um formato livre com os marcadores: <code>%n</code> nome, <code>%s</code> tamanho, <code>%U</code> dono, <code>%a</code> permissão octal.',
          'Monte o formato inteiro em um comando só: <code>stat -c "%n | %s bytes | dono %U | permissao %a" arquivo1 arquivo2 arquivo3 &gt; ~/ficha.txt</code> — o <code>stat</code> aceita vários arquivos.'
        ],
        solution: '<div class="code"><pre>stat -c "%n | %s bytes | dono %U | permissao %a" \\\n  /etc/passwd /usr/bin/ls ~/documentos/notas.txt &gt; ~/ficha.txt\n\ncat ~/ficha.txt</pre></div><p style="margin-top:8px">A contrabarra no fim da linha permite quebrar um comando longo em várias linhas.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/ficha.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/ficha.txt ainda não existe.' };
          const alvos = ['/etc/passwd', '/usr/bin/ls', '/home/aluno/documentos/notas.txt'];
          const linhas = c.split('\n').filter(l => l.trim());
          const checks = [[linhas.length >= 3, `O arquivo tem ${linhas.length} linha(s); são esperadas 3.`]];
          for (const a of alvos) {
            const s = H.lstat(ctx, a);
            const nome = a === '/home/aluno/documentos/notas.txt' ? /(notas\.txt)/ : new RegExp(a.replace(/\//g, '\\/'));
            const linha = linhas.find(l => nome.test(l));
            checks.push([!!linha, `Não encontrei a linha de <code>${a}</code>.`]);
            if (linha && s) {
              checks.push([new RegExp('\\b' + s.size + '\\b').test(linha), `O tamanho de <code>${a}</code> está errado (deveria ser ${s.size}).`]);
              const dono = (ctx.sh.m.userByUid(s.uid) || {}).name;
              checks.push([new RegExp('dono\\s+' + dono).test(linha), `O dono de <code>${a}</code> deveria ser <code>${dono}</code>.`]);
              checks.push([new RegExp('permissao\\s+0?' + (s.mode & 0o777).toString(8)).test(linha), `A permissão octal de <code>${a}</code> está errada.`]);
            }
          }
          return LX.H.checkAll(checks);
        }
      }
    ]
  });

  /* ============================== 2.7 ============================== */
  LX.lesson('m02', {
    id: 'l2-7', n: '2.7', title: 'Histórico, ajuda e o fluxo de trabalho',
    goal: 'Parar de redigitar. Aproveitar tudo o que você já escreveu e transformar o terminal numa ferramenta rápida.',
    brief: [
      { p: '<code>history</code> mostra comandos anteriores. A seta para cima recupera os mais recentes e <code>Ctrl+R</code> busca por um trecho. Revise sempre a linha recuperada antes de executá-la.' },
      { code: ['$ history 10', '$ history | grep docker', '$ comando1 && comando2', '$ echo $?'] },
      { p: '<code>&&</code> executa o segundo comando apenas se o primeiro funcionar; <code>||</code>, apenas se falhar; <code>;</code>, sempre. <code>$?</code> contém o código de saída do último comando: zero indica sucesso.' }
    ],
    body: [
      { cmd: 'history' },
      { p: 'O Bash guarda tudo o que você digita. Por padrão, mil comandos na memória e dois mil no arquivo <code>~/.bash_history</code>.' },
      { code: ['$ history', '$ history 10'] },
      { p: 'A verdadeira utilidade aparece quando você combina com uma busca:' },
      { code: ['$ history | grep docker', '$ history | grep "chmod"'] },
      { p: 'Aquele comando complicado que você montou semana passada está lá — não precisa reconstruir do zero.' },
      { h3: 'Reexecutando' },
      {
        cheat: [
          ['!!', 'repete o último comando'],
          ['!42', 'executa o comando número 42 do histórico'],
          ['!ssh', 'executa o último comando que começou com "ssh"'],
          ['!$', 'o último argumento do comando anterior'],
          ['!*', 'todos os argumentos do comando anterior'],
          ['^errado^certo', 'repete o último comando trocando um trecho']
        ]
      },
      { p: 'O <code>!!</code> tem um uso quase diário:' },
      {
        code: [
          '$ apt install tree',
          '$ sudo !!'
        ], run: false, mixed: false
      },
      { p: 'Esqueceu o <code>sudo</code>? <code>sudo !!</code> repete a linha inteira com privilégio. E o <code>!$</code> economiza digitação de caminhos longos:' },
      {
        code: [
          '$ mkdir -p /home/aluno/projetos/api/config',
          '$ cd !$'
        ], run: false, mixed: false
      },
      { h3: 'Busca interativa: Ctrl+R' },
      { p: 'O melhor dos atalhos. Aperte <span class="kbd">Ctrl+R</span> e comece a digitar qualquer pedaço de um comando antigo — o Bash vai encontrando enquanto você digita. Aperte <span class="kbd">Ctrl+R</span> de novo para ver ocorrências anteriores, <span class="kbd">Enter</span> para executar, <span class="kbd">Esc</span> para editar antes.' },
      {
        box: 'note', body: [
          { p: 'Neste ambiente de estudo, use <span class="kbd">↑</span> e <span class="kbd">↓</span> ou <code>history | grep palavra</code> para o mesmo efeito.' }
        ]
      },

      { h2: 'Onde procurar ajuda, em ordem' },
      {
        table: {
          head: ['Recurso', 'Comando', 'Quando usar'],
          rows: [
            ['Resumo rápido', '<code>comando --help</code>', 'lembrar uma opção'],
            ['Manual completo', '<code>man comando</code>', 'entender comportamento e casos de borda'],
            ['Busca por assunto', '<code>man -k assunto</code>', 'não sei o nome do comando'],
            ['Ajuda de builtins', '<code>help comando</code>', '<code>cd</code>, <code>export</code>, <code>test</code>… que não têm man próprio'],
            ['Lista de builtins', '<code>help</code>', 'ver tudo que o Bash faz por conta própria']
          ]
        }
      },
      { code: ['$ help cd', '$ help export', '$ help | head -20'] },
      {
        box: 'tip', label: 'Por que help e não man', body: [
          { p: 'Comandos internos do Bash não têm página de manual individual — eles estão todos dentro do <code>man bash</code>, que é gigantesco. O <code>help cd</code> te dá em cinco linhas o que levaria minutos para achar no manual do Bash.' }
        ]
      },

      { cmd: 'clear' },
      { p: 'Limpa a tela. O atalho <span class="kbd">Ctrl+L</span> faz o mesmo e é mais rápido. Nenhum dos dois apaga o histórico — só limpa o visual.' },

      { h2: 'Encadeando comandos' },
      { p: 'Três operadores que você vai usar o tempo todo, e a diferença entre eles é importante:' },
      {
        table: {
          head: ['Operador', 'Significado', 'Executa o segundo quando…'],
          rows: [
            ['<code>;</code>', 'faça isto, depois aquilo', '<strong>sempre</strong>, deu certo ou não'],
            ['<code>&amp;&amp;</code>', 'faça isto <em>e então</em> aquilo', 'apenas se o primeiro <strong>deu certo</strong>'],
            ['<code>||</code>', 'faça isto <em>ou senão</em> aquilo', 'apenas se o primeiro <strong>falhou</strong>']
          ]
        }
      },
      {
        code: [
          '$ mkdir ~/teste-enc ; echo "sempre executa"',
          '$ mkdir ~/teste-enc && echo "só se o mkdir der certo"',
          '$ mkdir ~/teste-enc || echo "só se o mkdir falhar"'
        ]
      },
      { p: 'O segundo comando falhou na segunda execução (o diretório já existia), então a mensagem do <code>&amp;&amp;</code> não apareceu — mas a do <code>||</code> apareceu. Essa lógica é a base de todo script robusto.' },
      { p: 'O padrão mais comum na prática:' },
      { code: ['$ cd ~/projetos && ls'], run: false, mixed: false },
      { p: 'Se o <code>cd</code> falhar, o <code>ls</code> não roda — e você não lista, por engano, o conteúdo do diretório errado.' },
      { h3: 'Como o shell sabe se deu certo?' },
      { p: 'Todo comando devolve um número ao terminar: o <strong>código de saída</strong>. Zero significa sucesso; qualquer outro valor significa algum tipo de erro. Você o consulta na variável <code>$?</code>:' },
      { code: ['$ ls /etc > /dev/null', '$ echo $?', '$ ls /naoexiste 2>/dev/null', '$ echo $?'] },
      { p: 'Guarde essa ideia: ela reaparece no módulo 4, é a base do <code>&amp;&amp;</code> e do <code>||</code>, e é o que torna possível escrever scripts que reagem a falhas (módulo 15).' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>history | grep palavra</code> recupera qualquer comando antigo.',
          '<code>!!</code> repete o último; <code>sudo !!</code> repete com privilégio; <code>!$</code> reaproveita o último argumento.',
          '<code>help</code> para builtins, <code>man</code> para programas, <code>man -k</code> quando não sabe o nome.',
          '<code>;</code> sempre · <code>&amp;&amp;</code> se deu certo · <code>||</code> se falhou.',
          '<code>echo $?</code> mostra o código de saída: 0 é sucesso.'
        ]
      },
      {"h2": "Registrar quando uma operação aconteceu"},
      {"p": "<code>date</code>, sem opções, imprime a data, a hora e o fuso da máquina. <code>date &gt; ~/registro-data.txt</code> guarda essa saída num arquivo. Num encadeamento com &amp;&amp;, a gravação só ocorre se o passo anterior terminar com sucesso; com ||, você pode apresentar uma mensagem se a operação falhar."},
      {"code": ["$ date"]},
    ],
    tasks: [
      {
        id: 't2-7-a', kind: 'guiado', title: 'Encadeamento e código de saída',
        body: [
          { p: 'Observe a diferença entre os três operadores na prática:' },
          {
            code: [
              '$ cd /etc && pwd',
              '$ cd /naoexiste && pwd',
              '$ cd /naoexiste || echo "não consegui entrar"',
              '$ ls /etc/passwd > /dev/null; echo "saida: $?"',
              '$ ls /naoexiste 2>/dev/null; echo "saida: $?"'
            ]
          },
          { p: 'Repare: no segundo comando o <code>pwd</code> nem rodou. No terceiro, a mensagem apareceu justamente porque houve falha.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /&&/), 'Use o operador <code>&amp;&amp;</code>.'],
          [() => H.usedCommand(ctx, /\|\|/), 'Use o operador <code>||</code>.'],
          [() => H.usedCommand(ctx, /\$\?/), 'Consulte o código de saída com <code>echo $?</code>.']
        ])
      },
      {
        id: 't2-7-p', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'O diretório <code>~/relatorios</code> <strong>não existe</strong>. Você executa:' },
          { code: ['cd ~/relatorios && rm *.tmp'], run: false, mixed: false },
          { p: 'O que acontece?' }
        ],
        options: [
          { text: 'O <code>cd</code> falha e o <code>rm</code> não é executado. Nada é apagado.', correct: true },
          { text: 'O <code>cd</code> falha e o <code>rm</code> apaga os <code>.tmp</code> do diretório atual.', why: 'Esse seria o comportamento com <code>;</code> no lugar do <code>&amp;&amp;</code> — e é exatamente o acidente que o <code>&amp;&amp;</code> previne.' },
          { text: 'O <code>cd</code> cria o diretório e depois o <code>rm</code> roda nele.', why: 'O <code>cd</code> nunca cria diretórios. Quem cria é o <code>mkdir</code>.' },
          { text: 'O shell aborta a sessão inteira.', why: 'Um comando que falha não encerra o shell interativo. Ele apenas devolve um código de saída diferente de zero.' }
        ],
        explain: 'É justamente por isso que se escreve <code>cd destino && comando</code> e não <code>cd destino; comando</code>. Com o ponto e vírgula, se o <code>cd</code> falhar você acaba executando um comando destrutivo no diretório errado — provavelmente o seu home.'
      },
      {
        id: 't2-7-b', kind: 'desafio', title: 'Um pipeline seguro de arquivamento',
        body: [
          { p: 'Escreva <strong>uma única linha</strong> de comando que faça, em sequência e com segurança:' },
          {
            ol: [
              'criar o diretório <code>~/arquivo-morto</code> (sem falhar se já existir);',
              '<strong>somente se</strong> isso der certo, entrar nele;',
              '<strong>somente se</strong> isso der certo, criar ali um arquivo <code>indice.txt</code> contendo a data de hoje;',
              '<strong>se qualquer etapa falhar</strong>, imprimir a mensagem <code>falha no arquivamento</code>.'
            ]
          },
          { p: 'Depois confirme que funcionou com <code>cat ~/arquivo-morto/indice.txt</code>.' }
        ],
        hints: [
          'Você vai encadear com <code>&amp;&amp;</code> as três primeiras etapas e usar <code>||</code> no final para a mensagem de falha.',
          'Para gravar a data: <code>date &gt; indice.txt</code>. Agrupe as etapas de sucesso entre chaves ou apenas encadeie: <code>a &amp;&amp; b &amp;&amp; c || echo "..."</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/arquivo-morto &amp;&amp; cd ~/arquivo-morto &amp;&amp; date &gt; indice.txt || echo "falha no arquivamento"\n\ncat ~/arquivo-morto/indice.txt</pre></div><p style="margin-top:8px">Uma sutileza: em <code>a &amp;&amp; b || c</code>, o <code>c</code> roda se <em>qualquer</em> parte anterior falhar. Para casos mais complexos, agrupe: <code>{ a &amp;&amp; b; } || c</code>.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/arquivo-morto/indice.txt');
          const usouEncadeado = (ctx.term.history || []).some(h => /mkdir[^\n]*&&[^\n]*cd[^\n]*&&/.test(h) && /\|\|/.test(h));
          return LX.H.checkAll([
            [H.isDir(ctx, '/home/aluno/arquivo-morto'), 'O diretório <code>~/arquivo-morto</code> ainda não existe.'],
            [c !== null, 'O arquivo <code>~/arquivo-morto/indice.txt</code> ainda não existe.'],
            [c && c.trim().length > 5, 'O arquivo <code>indice.txt</code> está vazio — ele deve conter a data.'],
            [usouEncadeado, 'Faça tudo em <strong>uma única linha</strong>, encadeando com <code>&amp;&amp;</code> e terminando com <code>|| echo "falha no arquivamento"</code>.']
          ]);
        }
      }
    ]
  });
})();
