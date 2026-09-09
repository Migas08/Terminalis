/* =========================================================================
   MÓDULO 13 — Compactação e arquivamento
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 13.1 ============================== */
  LX.lesson('m13', {
    id: 'l13-1', n: '13.1', title: 'Arquivar não é compactar',
    goal: 'Separar dois conceitos que o Windows juntou — e entender por que no Linux eles são ferramentas diferentes.',
    body: [
      { lede: 'No Windows, "zipar" faz as duas coisas de uma vez. No Linux elas são separadas, e essa separação explica a sintaxe estranha do <code>tar</code>.' },
      {
        ascii: `  ARQUIVAR  (tar)            COMPACTAR  (gzip, bzip2, xz, zstd)

  vários arquivos            um arquivo grande
       ↓                            ↓
  um arquivo só              o mesmo arquivo, menor
  (preserva permissões,      (não sabe nada sobre
   donos, links, datas)       nomes ou permissões)

              tar + gzip  =  arquivo.tar.gz`
      },
      {
        table: {
          head: ['Ferramenta', 'Faz', 'Não faz'],
          rows: [
            ['<code>tar</code>', 'junta arquivos preservando metadados', 'não comprime sozinho'],
            ['<code>gzip</code>', 'comprime <strong>um</strong> arquivo', 'não junta vários'],
            ['<code>zip</code>', 'junta <strong>e</strong> comprime', 'não preserva dono e grupo; as permissões dependem da ferramenta que extrair'],
            ['<code>tar + gzip</code>', 'junta e comprime, preservando tudo', '—']
          ]
        }
      },
      {
        box: 'key', body: [
          { p: 'A ordem importa: o <code>tar</code> junta primeiro, e o compressor trabalha em cima do resultado. Como o compressor vê um arquivo só, ele aproveita repetições <strong>entre</strong> os arquivos — por isso <code>.tar.gz</code> costuma ficar menor que um <code>.zip</code> com os mesmos arquivos, que comprime cada um isoladamente.' },
          { p: 'O preço: para extrair um único arquivo de um <code>.tar.gz</code> é preciso descomprimir tudo até chegar nele. O <code>.zip</code>, por comprimir cada arquivo separadamente, permite acesso direto. Cada formato ganha em um cenário.' }
        ]
      },

      { h2: 'Os compressores' },
      {
        table: {
          head: ['Formato', 'Comando', 'Compressão', 'Velocidade', 'Uso típico'],
          rows: [
            ['<code>.gz</code>', '<code>gzip</code>', 'boa', '<strong>rápida</strong>', 'o padrão universal — logs, transferência'],
            ['<code>.bz2</code>', '<code>bzip2</code>', 'melhor', 'lenta', 'legado; hoje perdeu espaço para o xz'],
            ['<code>.xz</code>', '<code>xz</code>', '<strong>a melhor</strong>', 'muito lenta', 'distribuição de software, backup de arquivar'],
            ['<code>.zst</code>', '<code>zstd</code>', 'quase igual ao xz', '<strong>muito rápida</strong>', '<strong>a escolha moderna</strong> — Docker, kernel, pacotes'],
            ['<code>.zip</code>', '<code>zip</code>', 'razoável', 'rápida', 'quando o destinatário usa Windows']
          ]
        }
      },
      { p: 'Compare na prática — o mesmo conteúdo em quatro formatos:' },
      {
        code: [
          '$ mkdir -p ~/lab-comp && cd ~/lab-comp',
          '$ for i in $(seq 1 6000); do echo "2026-09-02 03:12:44 srv-aula app[$i]: requisicao $i em $((i%400))ms"; done > $HOME/lab-comp/grande.log',
          '$ ls -lh grande.log',
          '$ gzip -k grande.log && bzip2 -k grande.log && xz -k grande.log && zstd -k grande.log 2>/dev/null',
          '$ ls -lh grande.log*',
          '$ cd ~'
        ]
      },
      {
        box: 'tip', label: 'Como escolher', body: [
          { ul: [
            '<strong>transferir agora</strong>, rede boa: <code>zstd</code> ou <code>gzip</code> — o tempo de CPU custa mais que os bytes;',
            '<strong>guardar por anos</strong>: <code>xz</code> — comprime uma vez, economiza espaço para sempre;',
            '<strong>compatibilidade máxima</strong>: <code>gzip</code> — existe em qualquer lugar, inclusive em sistemas antigos;',
            '<strong>mandar para alguém no Windows</strong>: <code>zip</code>.'
          ] }
        ]
      },
      { p: 'E note: comprimir o que já está comprimido não adianta nada. Um <code>.jpg</code>, <code>.mp4</code>, <code>.zip</code> ou <code>.gz</code> dentro de um <code>tar.gz</code> praticamente não encolhe — e ainda gasta CPU.' }
    ],
    tasks: [
      {
        id: 't13-1-a', kind: 'guiado', title: 'Compare os formatos',
        body: [
          { p: 'Crie um arquivo e comprima nos quatro formatos.' },
          {
            code: [
              '$ mkdir -p ~/lab-comp',
              '$ for i in $(seq 1 6000); do echo "2026-09-02 03:12:44 srv-aula app[$i]: requisicao $i em $((i%400))ms"; done > $HOME/lab-comp/grande.log',
              '$ ls -lh ~/lab-comp/grande.log',
              '$ cd ~/lab-comp',
              '$ gzip -k grande.log',
              '$ bzip2 -k grande.log',
              '$ xz -k grande.log',
              '$ ls -lh grande.log*',
              '$ cd ~'
            ]
          },
          { p: 'O <code>-k</code> (keep) preserva o original — sem ele, o compressor <strong>substitui</strong> o arquivo.' }
        ],
        hints: ['Sem <code>-k</code>, o <code>gzip arquivo</code> apaga o original e deixa só o <code>.gz</code>. É a pegadinha número um do módulo.'],
        solution: '<div class="code"><pre>mkdir -p ~/lab-comp\nfor i in $(seq 1 6000); do echo "2026-09-02 03:12:44 srv-aula app[$i]: requisicao $i em $((i%400))ms"; done > $HOME/lab-comp/grande.log\ncd ~/lab-comp\ngzip -k grande.log\nbzip2 -k grande.log\nxz -k grande.log\nls -lh grande.log*\ncd ~</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [H.exists(ctx, '/home/aluno/lab-comp/grande.log'), 'Crie o arquivo <code>~/lab-comp/grande.log</code> — e mantenha o original (use <code>-k</code>).'],
          [H.exists(ctx, '/home/aluno/lab-comp/grande.log.gz'), 'Comprima com <code>gzip -k</code>.'],
          [H.exists(ctx, '/home/aluno/lab-comp/grande.log.bz2'), 'Comprima também com <code>bzip2 -k</code>.'],
          [H.exists(ctx, '/home/aluno/lab-comp/grande.log.xz'), 'E com <code>xz -k</code>.']
        ])
      },
      {
        id: 't13-1-q', kind: 'quiz', title: 'Conceito: tar sem compressão',
        body: [
          { p: 'Você recebe um arquivo chamado <code>backup.tar</code> (sem <code>.gz</code>). O que isso significa?' }
        ],
        options: [
          { text: 'É um arquivamento <strong>sem compressão</strong>: vários arquivos juntos, preservando permissões e donos, mas do mesmo tamanho do conteúdo original.', correct: true },
          { text: 'É um arquivo corrompido — todo <code>.tar</code> deveria ter <code>.gz</code>.', why: 'O <code>.tar</code> puro é perfeitamente válido; a compressão é opcional.' },
          { text: 'É um arquivo comprimido com o algoritmo próprio do tar.', why: 'O <code>tar</code> não tem algoritmo de compressão próprio — ele apenas junta.' },
          { text: 'É um arquivo de texto com a lista dos arquivos.', why: 'Ele contém os arquivos em si, com os metadados.' }
        ],
        explain: '<code>.tar</code> puro é comum em dois casos: quando o conteúdo já está comprimido (não adiantaria comprimir de novo) e quando a velocidade importa mais que o tamanho — por exemplo, ao canalizar direto por SSH: <code>tar -cf - pasta | ssh servidor "tar -xf - -C /destino"</code>.'
      },
      {
        id: 't13-1-b', kind: 'desafio', title: 'Prove que o xz comprime melhor',
        body: [
          { p: 'Você quer decidir com que compressor guardar um log grande. Em vez de acreditar na tabela, meça.' },
          { p: 'Crie a pasta <code>~/medir</code> e, dentro dela, um arquivo <code>app.log</code> com <strong>4000</strong> linhas repetitivas de log (use um laço). Depois comprima o mesmo arquivo em dois formatos, <strong>mantendo o original</strong>: um <code>.gz</code> e um <code>.xz</code>.' },
          { p: 'No fim, a pasta precisa ter os três arquivos — <code>app.log</code>, <code>app.log.gz</code> e <code>app.log.xz</code> — e o <code>.xz</code> tem que ser menor que o <code>.gz</code>, que por sua vez é menor que o original.' }
        ],
        hints: [
          'Gere o arquivo com o mesmo padrão da aula: <code>for i in $(seq 1 4000); do echo "linha de log $i"; done &gt; ~/medir/app.log</code>.',
          'Comprima preservando o original com o <code>-k</code>: <code>cd ~/medir &amp;&amp; gzip -k app.log &amp;&amp; xz -k app.log</code>. Confira os tamanhos com <code>ls -lh</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/medir\nfor i in $(seq 1 4000); do echo "linha de log $i"; done &gt; ~/medir/app.log\ncd ~/medir\ngzip -k app.log\nxz -k app.log\nls -lh ~/medir\ncd ~</pre></div>',
        check: async (ctx) => {
          const orig = H.stat(ctx, '/home/aluno/medir/app.log');
          const gz = H.stat(ctx, '/home/aluno/medir/app.log.gz');
          const xz = H.stat(ctx, '/home/aluno/medir/app.log.xz');
          return LX.H.checkAll([
            [() => !!orig, 'Crie o arquivo <code>~/medir/app.log</code> — e mantenha o original ao comprimir (use <code>-k</code>).'],
            [() => (orig.size || 0) > 0, 'O <code>app.log</code> está vazio. Gere as 4000 linhas com o laço.'],
            [() => !!gz, 'Falta o <code>app.log.gz</code>. Comprima com <code>gzip -k app.log</code>.'],
            [() => !!xz, 'Falta o <code>app.log.xz</code>. Comprima com <code>xz -k app.log</code>.'],
            [() => gz.size < orig.size, 'O <code>.gz</code> deveria ser menor que o original. Você comprimiu o arquivo certo?'],
            [() => xz.size < gz.size, () => `O <code>.xz</code> (${xz.size} bytes) deveria ficar menor que o <code>.gz</code> (${gz.size} bytes) — é justamente o que a aula mostra.`]
          ]);
        }
      },

    ]
  });

  /* ============================== 13.2 ============================== */
  LX.lesson('m13', {
    id: 'l13-2', n: '13.2', title: 'tar: criar, listar, extrair',
    goal: 'Dominar as três operações do tar e nunca mais confundir as letras.',
    body: [
      { cmd: 'tar' },
      { p: 'O <code>tar</code> tem fama de sintaxe difícil porque as letras parecem aleatórias. Elas não são: você escolhe <strong>uma ação</strong> e acrescenta <strong>modificadores</strong>.' },
      {
        ascii: `  tar  -c z v f  arquivo.tar.gz  pasta/
        │ │ │ │
        │ │ │ └─ f = File: o próximo argumento é o NOME do arquivo (sempre por último)
        │ │ └─── v = Verbose: mostra o que está fazendo (opcional)
        │ └───── z = compressão gzip   (j = bzip2   J = xz   --zstd)
        └─────── AÇÃO:  c = Create   x = eXtract   t = lisT

     Criar:    tar -czvf pacote.tar.gz pasta/
     Listar:   tar -tzvf pacote.tar.gz
     Extrair:  tar -xzvf pacote.tar.gz`
      },
      {
        box: 'key', label: 'A regra de memorização', body: [
          { p: 'Uma frase resolve para sempre: <strong>"Criar Ze Vê o File"</strong> (<code>czvf</code>), <strong>"eXtrair Ze Vê o File"</strong> (<code>xzvf</code>), <strong>"lisTar Ze Vê o File"</strong> (<code>tzvf</code>). A única letra que muda é a primeira — a ação.' },
          { p: 'E o <code>f</code> é sempre o <strong>último</strong>, porque o nome do arquivo vem logo depois dele.' }
        ]
      },
      { p: 'Monte um material de teste e percorra as três operações:' },
      {
        code: [
          '$ rm -rf ~/projeto-x && mkdir -p ~/projeto-x/src ~/projeto-x/docs',
          '$ echo "codigo" > ~/projeto-x/src/app.py',
          '$ echo "manual" > ~/projeto-x/docs/leia.md',
          '$ echo "temporario" > ~/projeto-x/cache.tmp',
          '$ cd ~ && tar -czvf projeto-x.tar.gz projeto-x',
          '$ ls -lh projeto-x.tar.gz',
          '$ tar -tzf projeto-x.tar.gz'
        ]
      },
      { p: 'Extrair — sempre <strong>liste antes</strong>, para saber onde os arquivos vão cair:' },
      {
        code: [
          '$ mkdir -p ~/restaurado',
          '$ tar -xzf ~/projeto-x.tar.gz -C ~/restaurado',
          '$ find ~/restaurado'
        ]
      },
      {
        box: 'warn', label: 'A tarbomb', body: [
          { p: 'Um arquivo bem feito contém um diretório único na raiz (<code>projeto-x/...</code>). Um arquivo mal feito despeja dezenas de itens direto no diretório atual — é a chamada <em>tarbomb</em>, e limpar a bagunça é doloroso.' },
          { p: 'Por isso: <code>tar -tzf arquivo.tar.gz | head</code> <strong>antes</strong> de extrair. Se a listagem não começar com um diretório único, extraia dentro de uma pasta nova com <code>-C</code>.' }
        ]
      },

      { h2: 'Opções que valem a pena' },
      {
        table: {
          head: ['Opção', 'Efeito'],
          rows: [
            ['<code>-C DIR</code>', 'muda para o diretório antes de criar/extrair — <strong>a mais útil</strong>'],
            ['<code>--exclude=PADRÃO</code>', 'deixa de fora o que casar (pode repetir)'],
            ['<code>-p</code>', 'preserva permissões (padrão ao extrair como root)'],
            ['<code>--strip-components=1</code>', 'descarta o primeiro nível de diretório ao extrair'],
            ['<code>-t</code> com <code>-v</code>', 'listagem detalhada, com permissões e datas'],
            ['<code>-z / -j / -J / --zstd</code>', 'escolhe o compressor']
          ]
        }
      },
      { p: 'O <code>-C</code> na criação evita caminhos absolutos dentro do arquivo:' },
      {
        code: [
          '$ tar -czf ~/limpo.tar.gz -C ~ projeto-x',
          '$ tar -tzf ~/limpo.tar.gz | head -3',
          '$ tar --exclude="*.tmp" -czf ~/sem-tmp.tar.gz -C ~ projeto-x',
          '$ tar -tzf ~/sem-tmp.tar.gz'
        ]
      },
      { p: 'Compare as duas listagens: o segundo arquivo não tem o <code>cache.tmp</code>.' },
      {
        box: 'old', body: [
          { p: 'Versões antigas do tar exigiam a sintaxe sem traço (<code>tar czf</code>). O GNU tar atual aceita as duas formas, e a documentação usa a forma com traço. Você vai encontrar as duas por aí — <strong>use <code>-czf</code></strong>, é a que combina com o resto dos comandos Unix.' },
          { p: 'Outra herança: o tar antigo guardava caminhos absolutos e podia sobrescrever <code>/etc</code> ao extrair. O GNU tar moderno remove o <code>/</code> inicial automaticamente e avisa: <em>Removing leading slash from member names</em>.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't13-2-a', kind: 'guiado', title: 'As três operações',
        body: [
          { p: 'Crie, liste e extraia — e observe o efeito do <code>--exclude</code>.' },
          {
            code: [
              '$ rm -rf ~/projeto-x && mkdir -p ~/projeto-x/src ~/projeto-x/docs',
              '$ echo "codigo" > ~/projeto-x/src/app.py',
              '$ echo "manual" > ~/projeto-x/docs/leia.md',
              '$ echo "temporario" > ~/projeto-x/cache.tmp'
            ]
          },
          {
            code: [
              '$ cd ~ && tar -czvf projeto-x.tar.gz projeto-x',
              '$ tar -tzf projeto-x.tar.gz',
              '$ mkdir -p ~/restaurado && tar -xzf ~/projeto-x.tar.gz -C ~/restaurado',
              '$ find ~/restaurado',
              '$ tar --exclude="*.tmp" -czf ~/sem-tmp.tar.gz -C ~ projeto-x',
              '$ tar -tzf ~/sem-tmp.tar.gz'
            ]
          }
        ],
        hints: ['O <code>-C ~</code> na criação faz o tar entrar no seu diretório pessoal antes de empacotar — os caminhos dentro do arquivo ficam relativos.'],
        solution: '<div class="code"><pre>rm -rf ~/projeto-x &amp;&amp; mkdir -p ~/projeto-x/src ~/projeto-x/docs\necho "codigo" &gt; ~/projeto-x/src/app.py\necho "manual" &gt; ~/projeto-x/docs/leia.md\necho "temporario" &gt; ~/projeto-x/cache.tmp\ncd ~ &amp;&amp; tar -czvf projeto-x.tar.gz projeto-x\ntar -tzf projeto-x.tar.gz\nmkdir -p ~/restaurado\ntar -xzf ~/projeto-x.tar.gz -C ~/restaurado\nfind ~/restaurado\ntar --exclude="*.tmp" -czf ~/sem-tmp.tar.gz -C ~ projeto-x\ntar -tzf ~/sem-tmp.tar.gz</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [H.exists(ctx, '/home/aluno/projeto-x.tar.gz'), 'Crie o arquivo <code>~/projeto-x.tar.gz</code>.'],
          [() => H.usedCommand(ctx, /tar\s+-?[a-z]*t[a-z]*z?f/), 'Liste o conteúdo com <code>tar -tzf</code> antes de extrair.'],
          [H.exists(ctx, '/home/aluno/restaurado/projeto-x/src/app.py'), 'Extraia o arquivo dentro de <code>~/restaurado</code> com <code>-C</code>.'],
          [H.exists(ctx, '/home/aluno/sem-tmp.tar.gz'), 'Crie também a versão com <code>--exclude="*.tmp"</code>.']
        ])
      },
      {
        id: 't13-2-f', kind: 'fill', title: 'Complete o tar',
        body: [
          { p: 'Você recebeu <code>entrega.tar.gz</code> e quer <strong>extrair</strong> o conteúdo dentro do diretório <code>/opt/app</code>, mostrando os arquivos na tela conforme saem.' },
          { p: 'Complete as opções:' }
        ],
        template: 'tar ___ entrega.tar.gz -C /opt/app', sample: '-xzvf',
        answers: ['-xzvf'],
        hints: ['A ação é extrair; o arquivo é <code>.gz</code>; você quer ver os nomes; e o <code>f</code> vem por último.', 'eXtrair + Ze + Vê + File = <code>-xzvf</code>.'],
        solution: 'A resposta é <code>-xzvf</code>. Ordem das letras: <code>x</code> (extrair), <code>z</code> (gzip), <code>v</code> (verboso), <code>f</code> (o próximo argumento é o arquivo). O <code>-C /opt/app</code> pode vir antes ou depois — o tar aceita as duas posições.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim().replace(/^-+/, '');
          return LX.H.checkAll([
            [/x/.test(v), 'A ação de extrair é o <code>x</code>.'],
            [/z/.test(v), 'O arquivo é <code>.gz</code> — falta o <code>z</code>.'],
            [/v/.test(v), 'Para ver os nomes na tela, falta o <code>v</code>.'],
            [/f$/.test(v), 'O <code>f</code> precisa ser a <strong>última</strong> letra, porque o nome do arquivo vem logo depois.']
          ]);
        }
      },
      {
        id: 't13-2-b', kind: 'desafio', title: 'Empacote sem o lixo',
        body: [
          { p: 'Monte o material:' },
          {
            code: [
              '$ rm -rf ~/site-entrega && mkdir -p ~/site-entrega/css ~/site-entrega/tmp',
              '$ echo "<h1>oi</h1>" > ~/site-entrega/index.html',
              '$ echo "body{}" > ~/site-entrega/css/estilo.css',
              '$ echo "lixo" > ~/site-entrega/tmp/cache.tmp',
              '$ echo "log" > ~/site-entrega/debug.log'
            ]
          },
          { p: 'Gere <code>~/entrega.tar.gz</code> contendo o diretório <code>site-entrega</code> <strong>sem</strong> os arquivos <code>.tmp</code> e <code>.log</code>, e sem caminhos absolutos dentro do arquivo (a listagem deve começar com <code>site-entrega/</code>, não com <code>/home/...</code>).' },
          { p: 'Depois comprove extraindo em <code>~/conferencia</code> e confirmando que os arquivos indesejados não estão lá.' }
        ],
        hints: [
          'O <code>--exclude</code> pode ser repetido: um para cada padrão.',
          'Para caminhos relativos, use <code>-C ~</code> e passe só o nome do diretório.',
          '<code>tar --exclude="*.tmp" --exclude="*.log" -czf ~/entrega.tar.gz -C ~ site-entrega</code>'
        ],
        solution: '<div class="code"><pre>tar --exclude="*.tmp" --exclude="*.log" -czf ~/entrega.tar.gz -C ~ site-entrega\ntar -tzf ~/entrega.tar.gz\nmkdir -p ~/conferencia\ntar -xzf ~/entrega.tar.gz -C ~/conferencia\nfind ~/conferencia</pre></div><p style="margin-top:8px">Empacotar sem lixo é o que separa um pacote de entrega de 2 MB de um de 200 MB: caches, logs e <code>node_modules</code> quase nunca precisam ir junto.</p>',
        check: async (ctx) => {
          if (!H.exists(ctx, '/home/aluno/entrega.tar.gz')) return { ok: false, msg: 'O arquivo <code>~/entrega.tar.gz</code> ainda não existe.' };
          const conteudo = H.read(ctx, '/home/aluno/entrega.tar.gz') || '';
          const json = conteudo.slice(conteudo.indexOf('{'));
          let entradas = {};
          try { entradas = JSON.parse(json); } catch (e) { }
          const chaves = Object.keys(entradas);
          return LX.H.checkAll([
            [chaves.length > 0, 'Não consegui ler o conteúdo do arquivo — recrie-o com <code>tar -czf</code>.'],
            [chaves.some(k => /site-entrega\/index\.html$/.test(k)), 'O <code>index.html</code> deve estar dentro do arquivo.'],
            [chaves.some(k => /site-entrega\/css\/estilo\.css$/.test(k)), 'O <code>css/estilo.css</code> deve estar dentro do arquivo.'],
            [!chaves.some(k => /\.tmp$/.test(k)), 'Ainda há arquivos <code>.tmp</code> dentro do pacote — use <code>--exclude="*.tmp"</code>.'],
            [!chaves.some(k => /\.log$/.test(k)), 'Ainda há arquivos <code>.log</code> dentro do pacote — acrescente <code>--exclude="*.log"</code>.'],
            [chaves.every(k => !k.startsWith('/')), 'Os caminhos dentro do arquivo não podem ser absolutos — use <code>-C ~</code> e passe apenas <code>site-entrega</code>.'],
            [H.exists(ctx, '/home/aluno/conferencia/site-entrega/index.html'), 'Comprove extraindo em <code>~/conferencia</code>.'],
            [!H.exists(ctx, '/home/aluno/conferencia/site-entrega/debug.log'), 'O <code>debug.log</code> apareceu na extração — ele não deveria estar no pacote.']
          ]);
        }
      }
    ]
  });

  /* ============================== 13.3 ============================== */
  LX.lesson('m13', {
    id: 'l13-3', n: '13.3', title: 'Backup na prática',
    goal: 'Montar uma rotina de backup real: o que copiar, como nomear, como restaurar e como saber que funciona.',
    body: [
      { lede: 'Backup que ninguém testou não é backup — é esperança com nome técnico.' },
      { h2: 'A regra 3-2-1' },
      {
        ascii: `  3  cópias dos dados (a original + duas)
  2  mídias diferentes (disco local + nuvem, por exemplo)
  1  cópia FORA do local físico

  + teste de restauração periódico  ← a parte que quase ninguém faz`
      },
      { p: 'Em um servidor, o backup típico junta três coisas: <strong>dados da aplicação</strong>, <strong>banco de dados</strong> e <strong>configuração</strong> (<code>/etc</code>). Binários não precisam: eles voltam com <code>apt install</code>.' },

      { h2: 'Um backup nomeado por data' },
      { p: 'A data no nome é o que permite manter várias gerações e saber o que apagar:' },
      {
        code: [
          '$ rm -rf ~/app-dados ~/backups && mkdir -p ~/app-dados ~/backups',
          '$ echo "dados do cliente" > ~/app-dados/clientes.csv',
          '$ echo "config=1" > ~/app-dados/app.conf',
          '$ tar -czf ~/backups/app-$(date +%Y%m%d).tar.gz -C ~ app-dados',
          '$ ls -lh ~/backups/'
        ]
      },
      { p: 'O formato <code>%Y%m%d</code> (ano-mês-dia, sem separadores) tem uma vantagem prática: a ordem alfabética é a ordem cronológica. Um <code>ls</code> simples já lista do mais antigo ao mais novo.' },
      {
        table: {
          head: ['Formato do <code>date</code>', 'Resultado', 'Quando usar'],
          rows: [
            ['<code>%Y%m%d</code>', '20260902', 'backup diário'],
            ['<code>%Y%m%d-%H%M</code>', '20260902-1430', 'várias vezes ao dia'],
            ['<code>%Y-%m-%d</code>', '2026-09-02', 'quando humanos vão ler'],
            ['<code>%s</code>', '1788307200', 'quando só a máquina lê']
          ]
        }
      },

      { h2: 'Verificar e restaurar' },
      { p: 'Um backup só existe depois de restaurado com sucesso. O teste mínimo, sempre:' },
      {
        code: [
          '$ tar -tzf ~/backups/app-$(date +%Y%m%d).tar.gz',
          '$ mkdir -p ~/teste-restauro',
          '$ tar -xzf ~/backups/app-$(date +%Y%m%d).tar.gz -C ~/teste-restauro',
          '$ diff -r ~/app-dados ~/teste-restauro/app-dados && echo "restauração idêntica"'
        ]
      },
      {
        box: 'key', body: [
          { p: 'O <code>diff -r</code> entre o original e o restaurado é o teste que converte "acho que funciona" em "funciona". Em uma rotina real, ele roda no fim do script de backup e avisa se algo divergir.' }
        ]
      },
      { p: 'Para conferir a integridade sem extrair, existe a soma de verificação:' },
      {
        code: [
          '$ cd ~/backups && sha256sum app-$(date +%Y%m%d).tar.gz > SHA256SUMS',
          '$ cat SHA256SUMS',
          '$ sha256sum -c SHA256SUMS',
          '$ cd ~'
        ]
      },

      { h2: 'Rotação: apagar o que não serve mais' },
      { p: 'Backup que nunca é apagado enche o disco — e disco cheio derruba o servidor que você queria proteger. A rotação clássica usa <code>find</code> com <code>-mtime</code>:' },
      {
        code: [
          '# apaga backups com mais de 30 dias',
          'find /backups -name "app-*.tar.gz" -mtime +30 -delete',
          '',
          '# mantém apenas os 7 mais recentes',
          'ls -t /backups/app-*.tar.gz | tail -n +8 | xargs -r rm --'
        ], run: false, lang: 'text'
      },
      {
        box: 'warn', body: [
          { p: 'Antes de rodar qualquer rotação com <code>-delete</code>, rode a mesma linha <strong>sem</strong> o <code>-delete</code> e leia a lista. Um padrão errado em um comando de exclusão automática é a receita perfeita para perder justamente os backups.' }
        ]
      },
      {
        box: 'old', label: 'Prática antiga × atual', body: [
          { p: '<strong>Antigo:</strong> um <code>tar</code> completo todo dia, ocupando espaço proporcional ao número de dias.' },
          { p: '<strong>Atual:</strong> ferramentas com <em>deduplicação</em> e backup incremental — <code>restic</code>, <code>borg</code>, <code>rsync --link-dest</code>. Elas guardam só o que mudou, cifram, verificam integridade e sabem podar gerações antigas sozinhas.' },
          { p: 'Continue aprendendo <code>tar</code>: é a base, funciona em qualquer lugar e é o que você vai usar para mover coisas entre servidores. Mas, para uma rotina de backup de produção, escolha uma ferramenta dedicada. <strong>Saiba que ela existe.</strong>' }
        ]
      }
    ],
    tasks: [
      {
        id: 't13-3-a', kind: 'guiado', title: 'Backup, verificação e restauro',
        body: [
          { p: 'Faça o ciclo inteiro, incluindo o teste que quase ninguém faz.' },
          {
            code: [
              '$ rm -rf ~/app-dados ~/backups ~/teste-restauro',
              '$ mkdir -p ~/app-dados ~/backups',
              '$ echo "dados do cliente" > ~/app-dados/clientes.csv',
              '$ echo "config=1" > ~/app-dados/app.conf'
            ]
          },
          {
            code: [
              '$ tar -czf ~/backups/app-$(date +%Y%m%d).tar.gz -C ~ app-dados',
              '$ ls -lh ~/backups/',
              '$ tar -tzf ~/backups/app-$(date +%Y%m%d).tar.gz',
              '$ mkdir -p ~/teste-restauro',
              '$ tar -xzf ~/backups/app-$(date +%Y%m%d).tar.gz -C ~/teste-restauro',
              '$ diff -r ~/app-dados ~/teste-restauro/app-dados && echo "restauração idêntica"'
            ]
          }
        ],
        hints: ['<code>$(date +%Y%m%d)</code> é substituição de comando: o shell troca pela data antes de o tar rodar.'],
        solution: '<div class="code"><pre>rm -rf ~/app-dados ~/backups ~/teste-restauro\nmkdir -p ~/app-dados ~/backups\necho "dados do cliente" &gt; ~/app-dados/clientes.csv\necho "config=1" &gt; ~/app-dados/app.conf\ntar -czf ~/backups/app-$(date +%Y%m%d).tar.gz -C ~ app-dados\ntar -tzf ~/backups/app-$(date +%Y%m%d).tar.gz\nmkdir -p ~/teste-restauro\ntar -xzf ~/backups/app-$(date +%Y%m%d).tar.gz -C ~/teste-restauro\ndiff -r ~/app-dados ~/teste-restauro/app-dados &amp;&amp; echo "restauração idêntica"</pre></div>',
        check: async (ctx) => {
          const backups = (H.ls(ctx, '/home/aluno/backups') || []).map(e => e.name || e);
          return LX.H.checkAll([
            [backups.length > 0, 'Crie o backup em <code>~/backups/</code>.'],
            [backups.some(n => /^app-\d{8}\.tar\.gz$/.test(n)), `O backup deve se chamar <code>app-AAAAMMDD.tar.gz</code>. Encontrei: ${backups.join(', ') || '(nada)'}.`],
            [H.exists(ctx, '/home/aluno/teste-restauro/app-dados/clientes.csv'), 'Teste a restauração extraindo em <code>~/teste-restauro</code>.'],
            [() => H.usedCommand(ctx, /diff\s+-r/), 'Compare o original com o restaurado usando <code>diff -r</code> — é o teste que valida o backup.']
          ]);
        }
      },
      {
        id: 't13-3-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um script de backup roda há dois anos sem falhar. Quando o servidor pega fogo e o backup é restaurado, descobre-se que os arquivos do banco estão corrompidos — o dump era feito com o banco em uso, sem consistência.' },
          { p: 'Qual prática teria revelado o problema antes?' }
        ],
        options: [
          { text: '<strong>Testar a restauração periodicamente</strong> em uma máquina separada, subindo a aplicação a partir do backup.', correct: true },
          { text: 'Guardar mais gerações de backup.', why: 'Mais cópias do mesmo backup defeituoso não ajudam.' },
          { text: 'Usar <code>xz</code> em vez de <code>gzip</code>, por ser mais confiável.', why: 'O problema não era compressão nem integridade do arquivo — era o conteúdo, capturado em estado inconsistente.' },
          { text: 'Aumentar a frequência para de hora em hora.', why: 'Backups defeituosos com mais frequência continuam defeituosos.' }
        ],
        explain: 'Dois aprendizados: bancos de dados precisam de <strong>dump próprio</strong> (<code>pg_dump</code>, <code>mysqldump</code>) ou snapshot consistente, nunca de um <code>tar</code> em cima dos arquivos com o serviço rodando; e a restauração precisa ser <strong>ensaiada</strong>. Muitas equipes agendam um "teste de restauro" trimestral exatamente por isso.'
      },
      {
        id: 't13-3-b', kind: 'desafio', title: 'Rotina de backup com verificação',
        body: [
          { p: 'Monte o cenário:' },
          {
            code: [
              '$ rm -rf ~/producao ~/bkp && mkdir -p ~/producao/uploads ~/bkp',
              '$ echo "clientes" > ~/producao/base.csv',
              '$ echo "config" > ~/producao/app.conf',
              '$ echo "cache" > ~/producao/uploads/tmp.cache',
              '$ dd if=/dev/zero of=$HOME/producao/uploads/foto.jpg bs=1M count=1 status=none'
            ]
          },
          { p: 'Produza um backup completo, verificável, atendendo a <strong>todos</strong> os requisitos:' },
          {
            ul: [
              'o arquivo se chama <code>~/bkp/producao-AAAAMMDD.tar.gz</code>, com a data de hoje;',
              'contém o diretório <code>producao</code> com caminhos relativos (a listagem começa em <code>producao/</code>);',
              'os arquivos <code>.cache</code> ficam de fora;',
              'existe um <code>~/bkp/SHA256SUMS</code> com a soma do arquivo, e <code>sha256sum -c</code> valida com sucesso;',
              'a restauração foi testada em <code>~/restauro</code>, e o <code>base.csv</code> está lá.'
            ]
          }
        ],
        hints: [
          'A data vem de <code>$(date +%Y%m%d)</code> — o mesmo nome precisa ser usado nos três passos (criar, somar, restaurar).',
          'Guarde o nome em uma variável para não repetir: <code>ARQ=~/bkp/producao-$(date +%Y%m%d).tar.gz</code>.',
          'O <code>sha256sum</code> grava o caminho como você o passou; gere a soma dentro de <code>~/bkp</code> (<code>cd ~/bkp</code>) para que o <code>-c</code> funcione.'
        ],
        solution: '<div class="code"><pre>D=$(date +%Y%m%d)\ntar --exclude="*.cache" -czf ~/bkp/producao-$D.tar.gz -C ~ producao\ntar -tzf ~/bkp/producao-$D.tar.gz\n\ncd ~/bkp\nsha256sum producao-$D.tar.gz &gt; SHA256SUMS\nsha256sum -c SHA256SUMS\ncd ~\n\nmkdir -p ~/restauro\ntar -xzf ~/bkp/producao-$D.tar.gz -C ~/restauro\ndiff -r ~/producao/base.csv ~/restauro/producao/base.csv &amp;&amp; echo ok</pre></div><p style="margin-top:8px">Esse é o esqueleto do script que você vai escrever no módulo 15: variáveis para a data, exclusões, soma de verificação e teste de restauro — tudo o que separa um backup de verdade de um <code>tar</code> solto no cron.</p>',
        check: async (ctx) => {
          const arquivos = (H.ls(ctx, '/home/aluno/bkp') || []).map(e => e.name || e);
          const bkp = arquivos.find(n => /^producao-\d{8}\.tar\.gz$/.test(n));
          if (!bkp) return { ok: false, msg: `Falta o backup <code>~/bkp/producao-AAAAMMDD.tar.gz</code>. Encontrei: ${arquivos.join(', ') || '(nada)'}.` };
          const hoje = new Date();
          const esperado = 'producao-' + hoje.getFullYear() + String(hoje.getMonth() + 1).padStart(2, '0') + String(hoje.getDate()).padStart(2, '0') + '.tar.gz';
          const conteudo = H.read(ctx, '/home/aluno/bkp/' + bkp) || '';
          let entradas = {};
          try { entradas = JSON.parse(conteudo.slice(conteudo.indexOf('{'))); } catch (e) { }
          const chaves = Object.keys(entradas);
          const sums = H.read(ctx, '/home/aluno/bkp/SHA256SUMS');
          const confere = (sums !== null && ctx.run)
            ? (await ctx.run('cd ~/bkp && sha256sum -c SHA256SUMS 2>&1')).out : null;
          return LX.H.checkAll([
            [bkp === esperado, `O nome deve usar a data de hoje: <code>${esperado}</code>. Está: <code>${bkp}</code>.`],
            [chaves.length > 0, 'Não consegui ler o conteúdo do backup — recrie com <code>tar -czf</code>.'],
            [chaves.some(k => /producao\/base\.csv$/.test(k)), 'O <code>base.csv</code> precisa estar dentro do backup.'],
            [chaves.some(k => /producao\/uploads\/foto\.jpg$/.test(k)), 'O <code>uploads/foto.jpg</code> precisa estar dentro do backup.'],
            [!chaves.some(k => /\.cache$/.test(k)), 'Os arquivos <code>.cache</code> não podem entrar — use <code>--exclude="*.cache"</code>.'],
            [chaves.every(k => !k.startsWith('/')), 'Os caminhos devem ser relativos — use <code>-C ~ producao</code>.'],
            [sums !== null, 'Falta o arquivo <code>~/bkp/SHA256SUMS</code>.'],
            [(sums || '').includes(bkp), 'O <code>SHA256SUMS</code> deve conter a linha do arquivo de backup.'],
            [/^[0-9a-f]{64}\s/m.test(sums || ''), 'A soma no <code>SHA256SUMS</code> não tem o formato de um hash SHA-256.'],
            /* o verificador manda o próprio sha256sum conferir: hash inventado reprova */
            [() => confere === null || /: OK$/m.test(confere), 'O <code>sha256sum -c</code> não valida esse arquivo — a soma gravada não corresponde ao backup. Gere-a com <code>sha256sum arquivo.tar.gz &gt; SHA256SUMS</code>, sem digitar nada.'],
            [H.exists(ctx, '/home/aluno/restauro/producao/base.csv'), 'Teste a restauração em <code>~/restauro</code>.']
          ]);
        }
      }
    ]
  });

})();
