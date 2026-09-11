/* =========================================================================
   MÓDULO 13 — Compactação e arquivos (continuação: 13.4 e 13.5)
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 13.4 ============================== */
  LX.lesson('m13', {
    id: 'l13-4', n: '13.4', title: 'zip, e trabalhar dentro do arquivo sem extrair tudo',
    goal: 'Trocar arquivos com quem não usa Linux, e inspecionar ou extrair um pedaço de um pacote de vários gigabytes sem descompactar o resto.',
    body: [
      { h2: 'Por que o zip ainda existe' },
      { p: 'O <code>tar</code> resolve tudo no mundo Unix. O <code>zip</code> existe pelo motivo mais prático possível: <strong>é o formato que qualquer Windows e qualquer macOS abrem com dois cliques</strong>. Quando o arquivo vai sair do seu mundo, ele costuma ser a escolha certa.' },
      {
        table: {
          head: ['', '<code>tar.gz</code>', '<code>zip</code>'],
          rows: [
            ['Como funciona', 'empacota <strong>e depois</strong> comprime tudo junto', 'comprime <strong>cada arquivo</strong> e junta'],
            ['Compressão', 'melhor (aproveita repetição entre arquivos)', 'pior, mas cada item é independente'],
            ['Extrair um item só', 'precisa varrer até chegar nele', 'vai direto — tem índice'],
            ['Dono e grupo', 'preserva', '<strong>não preserva</strong>'],
            ['Permissões', 'preserva', 'guarda, mas depende da ferramenta que extrair'],
            ['Fora do Linux', 'precisa de programa extra', 'abre em qualquer lugar']
          ]
        }
      },
      { p: 'A diferença de arquitetura explica todo o resto: como o <code>tar.gz</code> é um fluxo comprimido de ponta a ponta, ele comprime melhor mas não tem índice; o zip mantém um catálogo no fim do arquivo, e por isso extrai um item isolado instantaneamente.' },

      { h2: 'zip e unzip na prática' },
      {
        table: {
          head: ['Comando', 'Faz'],
          rows: [
            ['<code>zip -r pacote.zip pasta/</code>', 'compacta a pasta inteira (<code>-r</code> = recursivo)'],
            ['<code>zip -r pacote.zip pasta/ -x "*.log"</code>', 'excluindo um padrão'],
            ['<code>unzip -l pacote.zip</code>', '<strong>lista</strong> o conteúdo sem extrair'],
            ['<code>unzip pacote.zip</code>', 'extrai no diretório atual'],
            ['<code>unzip pacote.zip -d /destino</code>', 'extrai em outro lugar'],
            ['<code>unzip pacote.zip \'*.csv\'</code>', 'extrai só o que casa com o padrão'],
            ['<code>unzip -o pacote.zip</code>', 'sobrescreve sem perguntar']
          ]
        }
      },
      {
        box: 'warn', label: 'O erro que enche o diretório de lixo', body: [
          { p: 'O <code>tar</code> costuma trazer tudo dentro de uma pasta; o <code>zip</code>, com frequência, <strong>não</strong>. Extrair um zip "plano" no lugar errado espalha duzentos arquivos no seu <code>~</code>.' },
          { p: 'O reflexo que evita isso é sempre o mesmo: <code>unzip -l</code> <em>antes</em> de <code>unzip</code>. Vale igual para o tar, com <code>tar -tzf</code>.' }
        ]
      },

      { h2: 'Olhar dentro sem extrair' },
      { p: 'Metade do trabalho com arquivos compactados é responder "o que tem aqui dentro?" — e para isso não é preciso extrair nada:' },
      { code: ['$ tar -tzf ~/pacote.tar.gz | head', '$ tar -tzf ~/pacote.tar.gz | grep -c ".txt"', '$ zcat ~/log.gz | tail -20', '$ zgrep -i "erro" ~/log.gz'] },
      {
        table: {
          head: ['Ferramenta', 'É o equivalente a'],
          rows: [
            ['<code>zcat</code>', '<code>cat</code>, para <code>.gz</code>'],
            ['<code>zgrep</code>', '<code>grep</code>, para <code>.gz</code>'],
            ['<code>zless</code>', '<code>less</code>, para <code>.gz</code>'],
            ['<code>tar -tzf</code>', '<code>ls</code>, para <code>.tar.gz</code>']
          ]
        }
      },
      { p: 'Isso importa mais do que parece: logs rotacionados ficam comprimidos (<code>syslog.2.gz</code>), e procurar um erro de três semanas atrás significa <code>zgrep</code> — não descompactar 4 GB para depois apagar.' },

      { h2: 'Extrair só uma parte' },
      { code: ['$ tar -xzf ~/pacote.tar.gz projeto/config.yml', '$ tar -xzf ~/pacote.tar.gz --wildcards "*.conf"'] },
      { p: 'E a opção que resolve o caso mais comum de todos — o tarball baixado do GitHub, onde tudo está dentro de uma pasta com o nome da versão:' },
      {
        ascii: `app-v2.1.4/
├── src/
├── README.md
└── config.yml

tar -xzf app.tar.gz                      →  cria app-v2.1.4/ e o resto dentro
tar -xzf app.tar.gz --strip-components=1 →  joga src/, README.md, config.yml
                                            direto no diretório atual`
      },
      { p: 'O <code>--strip-components=1</code> descarta o primeiro nível de diretório de cada caminho. É o que permite extrair uma release direto em <code>/opt/app</code> sem ficar com <code>/opt/app/app-v2.1.4/</code>.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Use <code>tar.gz</code> no mundo Linux; <code>zip</code> quando o arquivo vai sair dele.',
          'zip não preserva dono e grupo; tar preserva.',
          'Sempre <code>unzip -l</code> / <code>tar -tzf</code> antes de extrair.',
          '<code>zcat</code>, <code>zgrep</code>, <code>zless</code> leem <code>.gz</code> sem descompactar — é assim que se procura em log rotacionado.',
          '<code>--strip-components=1</code> remove o diretório de versão dos tarballs.'
        ]
      }
    ],
    tasks: [
      {
        id: 't13-4-a', kind: 'guiado', title: 'Olhe antes de extrair',
        body: [
          { p: 'Monte um cenário e pratique a inspeção:' },
          {
            code: [
              '$ mkdir -p ~/pacote/src ~/saida',
              '$ echo "config" > ~/pacote/config.yml',
              '$ echo "codigo" > ~/pacote/src/main.py',
              '$ echo "log antigo" > ~/pacote/app.log',
              '$ tar -czf ~/pacote.tar.gz -C ~ pacote',
              '$ tar -tzf ~/pacote.tar.gz',
              '$ zip -r ~/pacote.zip ~/pacote > /dev/null',
              '$ unzip -l ~/pacote.zip'
            ]
          },
          { p: 'Repare que os dois listam o mesmo conteúdo, mas o zip mostra tamanho e data de cada item — porque ele tem um índice; o tar precisou percorrer o fluxo inteiro para montar a lista.' }
        ],
        hints: ['O <code>-tzf</code> do tar quer dizer: listar (<code>t</code>), com gzip (<code>z</code>), do arquivo (<code>f</code>).'],
        check: async (ctx) => H.checkAll([
          [() => H.exists(ctx, '/home/aluno/pacote.tar.gz'), 'Crie o <code>~/pacote.tar.gz</code>.'],
          [() => H.exists(ctx, '/home/aluno/pacote.zip'), 'Crie também o <code>~/pacote.zip</code> para comparar.'],
          [() => H.usedCommand(ctx, /tar\s+-?tzf|tar\s+.*-t/), 'Liste o conteúdo do tar com <code>tar -tzf</code> antes de extrair.'],
          [() => H.usedCommand(ctx, /unzip\s+-l/), 'Liste o conteúdo do zip com <code>unzip -l</code>.']
        ])
      },
{
        id: 't13-4-q', kind: 'quiz', title: 'zip ou tar.gz para este caso',
        body: [
          { p: 'Um pacote de 8 GB tem milhares de arquivos, e você precisa recuperar <strong>um único</strong> deles, o mais rápido possível. Sobre a escolha do formato, o que é verdade?' }
        ],
        options: [
          { text: 'Num <code>.zip</code> a extração de um item é imediata, porque ele mantém um índice e comprime cada arquivo isoladamente; num <code>.tar.gz</code> é preciso varrer o fluxo comprimido até chegar no item.', correct: true },
          { text: 'Tanto faz: os dois têm índice e vão direto ao arquivo pedido.', why: 'O <code>.tar.gz</code> é um fluxo comprimido de ponta a ponta, sem índice — é justamente por isso que comprime melhor, mas paga na hora de extrair um item só.' },
          { text: 'O <code>.tar.gz</code> é mais rápido para um item porque comprime melhor.', why: 'Comprimir melhor reduz o tamanho, não o tempo de localizar um item. A compressão de ponta a ponta é o que obriga a varrer até o alvo.' },
          { text: 'Nenhum dos dois extrai um item isolado; sempre é preciso descompactar tudo.', why: 'O <code>tar</code> aceita o caminho do item (<code>tar -xzf pacote.tar.gz projeto/config.yml</code>) e o <code>unzip</code> também — a diferença está na velocidade, não na possibilidade.' }
        ],
        explain: 'A arquitetura decide: o <code>zip</code> comprime cada arquivo e guarda um catálogo no fim, então vai direto ao item; o <code>tar.gz</code> comprime tudo junto e não tem índice, aproveitando a repetição entre arquivos para comprimir melhor. Para acesso frequente a itens isolados, zip; para guardar compacto, tar.gz.'
      },
      {
        id: 't13-4-b', kind: 'desafio', title: 'Extração cirúrgica',
        body: [
          { p: 'Usando o <code>~/pacote.tar.gz</code> do exercício anterior (recrie se precisar), faça três coisas <strong>sem extrair o pacote inteiro</strong>:' },
          {
            ul: [
              'grave em <code>~/saida/conteudo.txt</code> a listagem completa do arquivo, uma entrada por linha;',
              'extraia <strong>somente</strong> o <code>pacote/config.yml</code> para dentro de <code>~/saida/</code>, de modo que ele fique em <code>~/saida/pacote/config.yml</code>;',
              'extraia o pacote em <code>~/app/</code> usando <code>--strip-components=1</code>, de modo que o <code>config.yml</code> fique em <code>~/app/config.yml</code> — sem o diretório <code>pacote/</code> no meio.'
            ]
          },
          { p: 'Nenhum arquivo <code>app.log</code> deve aparecer em <code>~/saida/pacote/</code>: a extração seletiva traz só o que você pediu.' }
        ],
        hints: [
          'Para extrair um item só, passe o caminho dele exatamente como aparece no <code>tar -tzf</code>: <code>tar -xzf ~/pacote.tar.gz -C ~/saida pacote/config.yml</code>.',
          'O <code>--strip-components=1</code> vai junto com o <code>-x</code>: <code>tar -xzf ~/pacote.tar.gz -C ~/app --strip-components=1</code>. Crie o <code>~/app</code> antes.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/pacote/src ~/saida ~/app\necho "config" &gt; ~/pacote/config.yml\necho "codigo" &gt; ~/pacote/src/main.py\necho "log antigo" &gt; ~/pacote/app.log\ntar -czf ~/pacote.tar.gz -C ~ pacote\n\ntar -tzf ~/pacote.tar.gz &gt; ~/saida/conteudo.txt\ncat ~/saida/conteudo.txt\n\ntar -xzf ~/pacote.tar.gz -C ~/saida pacote/config.yml\nls -R ~/saida\n\ntar -xzf ~/pacote.tar.gz -C ~/app --strip-components=1\nls ~/app</pre></div><p style="margin-top:8px">Três operações, nenhuma delas descompactou o arquivo inteiro. Num pacote de alguns gigabytes essa diferença deixa de ser elegância e vira o único jeito viável.</p>',
        check: async (ctx) => {
          const lista = H.readText(ctx, '/home/aluno/saida/conteudo.txt');
          const saidaLs = (H.ls(ctx, '/home/aluno/saida/pacote') || []).map(x => (typeof x === 'string' ? x : x.name));
          return H.checkAll([
            [() => H.exists(ctx, '/home/aluno/pacote.tar.gz'), 'Falta o <code>~/pacote.tar.gz</code> — recrie o cenário.'],
            [!!lista.trim(), 'Falta o <code>~/saida/conteudo.txt</code> com a listagem do arquivo.'],
            [() => /pacote\/config\.yml/.test(lista) && /pacote\/src\/main\.py/.test(lista), 'A listagem deve conter todas as entradas do pacote — ela sai de <code>tar -tzf</code>.'],
            [() => H.exists(ctx, '/home/aluno/saida/pacote/config.yml'), 'Falta a extração seletiva: o <code>config.yml</code> deveria estar em <code>~/saida/pacote/config.yml</code>.'],
            [() => !saidaLs.includes('app.log'), 'O <code>app.log</code> apareceu em <code>~/saida/pacote/</code> — você extraiu o pacote inteiro em vez de só o arquivo pedido.'],
            [() => !H.exists(ctx, '/home/aluno/saida/pacote/src'), 'O diretório <code>src</code> também não deveria ter sido extraído para <code>~/saida</code>.'],
            [() => H.exists(ctx, '/home/aluno/app/config.yml'), 'Falta a extração com <code>--strip-components=1</code>: o <code>config.yml</code> deveria estar direto em <code>~/app/</code>.'],
            [() => !H.exists(ctx, '/home/aluno/app/pacote'), 'O <code>~/app</code> ainda tem o diretório <code>pacote/</code> dentro — foi isso que o <code>--strip-components=1</code> deveria remover.'],
            [() => H.exists(ctx, '/home/aluno/app/src/main.py'), 'A extração em <code>~/app</code> deve trazer o pacote inteiro (inclusive <code>src/main.py</code>), só que sem o diretório de topo.']
          ]);
        }
      }
    ]
  });

  /* ============================== 13.5 ============================== */
  LX.lesson('m13', {
    id: 'l13-5', n: '13.5', title: 'Integridade e transporte: checksums e split',
    goal: 'Provar que um arquivo chegou inteiro do outro lado, e transportar um pacote grande por um canal que não aceita arquivos grandes.',
    body: [
      { h2: 'O problema: "o arquivo chegou?"' },
      { p: 'Você copiou um backup de 8 GB para outra máquina. O tamanho bate. Isso prova alguma coisa? <strong>Não.</strong> Um bit trocado no meio da transferência, um disco com setor defeituoso, um download interrompido e retomado errado — tudo isso produz arquivo do tamanho certo e conteúdo errado.' },
      { p: 'O <em>checksum</em> resolve: uma função lê o arquivo inteiro e produz uma sequência curta e determinística. Mesmo conteúdo, mesma soma. Um bit diferente, soma completamente diferente.' },

      { h2: 'sha256sum na prática' },
      { code: ['$ echo "conteudo importante" > ~/dado.txt', '$ sha256sum ~/dado.txt', '$ sha256sum ~/dado.txt > ~/dado.sha256', '$ sha256sum -c ~/dado.sha256'] },
      { p: 'O formato do arquivo de somas é simples: <code>hash  nome</code>, uma linha por arquivo. O <code>-c</code> lê esse arquivo, recalcula cada soma e compara, imprimindo <code>OK</code> ou <code>FAILED</code> por item — e saindo com código diferente de zero se algo não bater, o que é o que importa dentro de um script.' },
      {
        box: 'warn', label: 'O detalhe do caminho', body: [
          { p: 'O <code>sha256sum</code> grava o nome <strong>exatamente como você o passou</strong>. Se você gerar com <code>sha256sum /home/aluno/bkp/x.tar.gz</code>, o arquivo de somas guarda o caminho absoluto — e o <code>-c</code> vai procurar exatamente ali, mesmo que você tenha movido tudo para outra máquina.' },
          { p: 'A prática correta é entrar no diretório antes: <code>cd bkp &amp;&amp; sha256sum x.tar.gz &gt; SHA256SUMS</code>. Aí o arquivo guarda o nome relativo e a verificação funciona em qualquer lugar.' }
        ]
      },
      { p: 'É por isso que as distribuições publicam um arquivo <code>SHA256SUMS</code> ao lado das imagens ISO. Você baixa os dois, roda <code>sha256sum -c SHA256SUMS</code> e sabe se o download veio inteiro.' },
      {
        box: 'note', label: 'Integridade não é autenticidade', body: [
          { p: 'O checksum prova que o arquivo não mudou <em>desde que a soma foi calculada</em>. Ele não prova <strong>quem</strong> calculou. Se um atacante substitui o arquivo e o <code>SHA256SUMS</code>, a verificação passa alegremente.' },
          { p: 'Quem resolve isso é a <strong>assinatura</strong> — o mesmo mecanismo do <code>Signed-By</code> que você viu nos repositórios apt. Por isso as distribuições publicam <code>SHA256SUMS</code> e <code>SHA256SUMS.gpg</code>: o primeiro dá integridade, o segundo dá autenticidade.' }
        ]
      },
      { p: 'E sobre qual algoritmo usar: <code>md5sum</code> ainda aparece muito, e serve para detectar corrupção acidental. Ele <strong>não</strong> serve contra alguém mal-intencionado — é possível construir dois arquivos diferentes com o mesmo MD5. Para qualquer coisa nova, <code>sha256sum</code>.' },

      { h2: 'split: quando o arquivo não cabe no canal' },
      { p: 'Anexo de e-mail com limite de 25 MB, pendrive com sistema de arquivos que não aceita arquivo acima de 4 GB, upload que sempre cai no meio. O <code>split</code> corta em pedaços e o <code>cat</code> junta de volta.' },
      { code: ['$ seq 1 20 > ~/lista.txt', '$ split -l 8 ~/lista.txt ~/pedaco-', '$ ls ~/pedaco-*', '$ cat ~/pedaco-* > ~/remontado.txt', '$ diff ~/lista.txt ~/remontado.txt && echo "idêntico"'] },
      {
        table: {
          head: ['Opção', 'Faz'],
          rows: [
            ['<code>-b 100M</code>', 'corta por <strong>tamanho</strong>'],
            ['<code>-l 5000</code>', 'corta por <strong>número de linhas</strong>'],
            ['<code>-d</code>', 'sufixos numéricos (<code>-00</code>, <code>-01</code>) em vez de letras'],
            ['<code>-a 3</code>', 'sufixo de 3 caracteres, para mais de 676 pedaços']
          ]
        }
      },
      { p: 'O detalhe que faz a remontagem funcionar: o <code>cat pedaco-*</code> depende da <strong>expansão em ordem alfabética</strong> do glob. É por isso que os sufixos são <code>aa</code>, <code>ab</code>, <code>ac</code> — e por isso a ordem alfabética coincide com a ordem correta. Com <code>-d</code> e mais de dez pedaços, o mesmo vale porque os números são preenchidos com zero à esquerda.' },
      {
        box: 'key', label: 'A sequência completa de transporte', body: [
          {
            code: [
              '# na origem',
              'tar -czf backup.tar.gz /srv/dados',
              'sha256sum backup.tar.gz > backup.sha256',
              'split -b 100M backup.tar.gz backup.parte-',
              '',
              '# no destino, depois de transferir todos os pedaços',
              'cat backup.parte-* > backup.tar.gz',
              'sha256sum -c backup.sha256        # ← a prova de que chegou inteiro',
              'tar -xzf backup.tar.gz'
            ], run: false
          },
          { p: 'Repare que a soma é calculada <strong>antes</strong> de dividir e conferida <strong>depois</strong> de remontar. Ela cobre o processo inteiro: a divisão, cada transferência e a remontagem.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Tamanho igual não prova nada; checksum prova.',
          '<code>sha256sum arquivo &gt; SHA256SUMS</code> e <code>sha256sum -c SHA256SUMS</code> — gerado de dentro do diretório.',
          'Checksum dá integridade; assinatura dá autenticidade. São coisas diferentes.',
          'MD5 só para corrupção acidental; SHA-256 para o resto.',
          '<code>split -b</code> / <code>-l</code> corta, <code>cat parte-*</code> remonta — e a soma confere o caminho inteiro.'
        ]
      }
    ],
    tasks: [
{
        id: 't13-5-a', kind: 'guiado', title: 'Gere e confira uma soma',
        body: [
          { p: 'Veja o ciclo do checksum de ponta a ponta: gerar, guardar, conferir.' },
          {
            code: [
              '$ mkdir -p ~/integridade && cd ~/integridade',
              '$ echo "conteudo importante do backup" > dado.txt',
              '$ sha256sum dado.txt',
              '$ sha256sum dado.txt > SHA256SUMS',
              '$ sha256sum -c SHA256SUMS',
              '$ cd ~'
            ]
          },
          { p: 'Repare que geramos o <code>SHA256SUMS</code> de <strong>dentro</strong> do diretório, com o nome relativo — é o que faz a conferência funcionar em qualquer máquina. O <code>-c</code> imprime <code>dado.txt: OK</code> quando a soma bate.' }
        ],
        hints: ['O <code>sha256sum -c</code> lê o arquivo de somas, recalcula e compara; ele sai com código diferente de zero se algo não bater.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /sha256sum\s+[^-]/), 'Gere a soma de um arquivo com <code>sha256sum dado.txt</code>.'],
          [() => H.usedCommand(ctx, /sha256sum\s+.*>\s*SHA256SUMS|sha256sum.*>.*sha256/i), 'Grave a soma num arquivo (<code>sha256sum dado.txt &gt; SHA256SUMS</code>).'],
          [() => H.usedCommand(ctx, /sha256sum\s+-c/), 'Confira com <code>sha256sum -c SHA256SUMS</code>.']
        ])
      },
      {
        id: 't13-5-q', kind: 'quiz', title: 'Conceito: o download verificado',
        body: [
          { p: 'Você baixa uma imagem ISO de um site e, ao lado dela, o arquivo <code>SHA256SUMS</code> publicado no mesmo servidor. Roda a verificação e recebe <code>ubuntu.iso: OK</code>.' },
          { p: 'O que exatamente isso prova?' }
        ],
        options: [
          { text: 'Que o arquivo que você tem é idêntico ao que gerou aquela soma — mas não que a soma tenha sido publicada por quem você pensa.', correct: true },
          { text: 'Que a ISO é oficial e não foi adulterada.', why: 'Se alguém comprometeu o servidor, pode ter trocado a ISO <em>e</em> o SHA256SUMS. A verificação passaria igual. É preciso a assinatura GPG para responder "quem publicou".' },
          { text: 'Que o download não foi interceptado no caminho.', why: 'Cobre corrupção e troca no transporte, desde que o SHA256SUMS tenha vindo por um canal íntegro — o que, vindo do mesmo servidor, não é garantido.' },
          { text: 'Nada, porque SHA-256 tem colisões conhecidas.', why: 'Não há colisões práticas conhecidas em SHA-256. Quem tem esse problema é o MD5, e é por isso que ele não deve mais ser usado para verificação com adversário.' }
        ],
        explain: 'Integridade e autenticidade são propriedades distintas. O checksum entrega a primeira: o conteúdo é exatamente aquele. A segunda vem da assinatura: as distribuições publicam <code>SHA256SUMS.gpg</code> justamente para você poder verificar, com a chave pública delas, que aquele arquivo de somas foi assinado por elas. É o mesmo raciocínio do <code>Signed-By</code> nos repositórios apt.'
      },
      {
        id: 't13-5-b', kind: 'desafio', title: 'Transporte com prova de integridade',
        body: [
          { p: 'Simule o envio de um pacote grande por um canal com limite de tamanho.' },
          { code: ['$ mkdir -p ~/envio ~/recebido', '$ seq 1 500 > ~/envio/dados.txt', '$ echo "config da equipe" > ~/envio/config.ini'] },
          { p: 'Na "origem":' },
          {
            ul: [
              'empacote <code>~/envio</code> em <code>~/transporte.tar.gz</code>;',
              'gere <code>~/transporte.sha256</code> com a soma do pacote, no formato do <code>sha256sum</code>;',
              'divida o pacote em pedaços de <strong>400 bytes</strong>, com prefixo <code>~/parte-</code> (devem sair vários).'
            ]
          },
          { p: 'No "destino":' },
          {
            ul: [
              'remonte os pedaços em <code>~/recebido/transporte.tar.gz</code>;',
              'comprove com <code>sha256sum -c</code> que a soma bate;',
              'extraia em <code>~/recebido/</code> e confirme que <code>~/recebido/envio/config.ini</code> voltou.'
            ]
          }
        ],
        hints: [
          'Gere a soma de dentro do diretório do arquivo (<code>cd ~</code> e depois <code>sha256sum transporte.tar.gz</code>), senão o caminho gravado atrapalha o <code>-c</code>.',
          'A divisão é <code>split -b 400 ~/transporte.tar.gz ~/parte-</code> e a remontagem, <code>cat ~/parte-* &gt; ~/recebido/transporte.tar.gz</code>. A ordem alfabética dos sufixos é o que faz o <code>cat</code> juntar na sequência certa.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/envio ~/recebido\nseq 1 500 &gt; ~/envio/dados.txt\necho "config da equipe" &gt; ~/envio/config.ini\n\ncd ~\ntar -czf transporte.tar.gz envio\nsha256sum transporte.tar.gz &gt; transporte.sha256\ncat transporte.sha256\n\nsplit -b 400 transporte.tar.gz parte-\nls parte-*\n\ncat parte-* &gt; ~/recebido/transporte.tar.gz\ncd ~/recebido &amp;&amp; cp ~/transporte.sha256 . &amp;&amp; sha256sum -c transporte.sha256\ntar -xzf transporte.tar.gz\nls -R ~/recebido\ncd ~</pre></div><p style="margin-top:8px">A soma foi calculada antes de dividir e conferida depois de remontar — então ela cobre a divisão, cada pedaço transferido e a junção. Se qualquer etapa tivesse falhado, o <code>-c</code> acusaria.</p>',
        check: async (ctx) => {
          const soma = H.readText(ctx, '/home/aluno/transporte.sha256');
          const raiz = (H.ls(ctx, '/home/aluno') || []).map(x => (typeof x === 'string' ? x : x.name));
          const partes = raiz.filter(n => /^parte-/.test(n));
          const original = H.readText(ctx, '/home/aluno/transporte.tar.gz');
          const remontado = H.readText(ctx, '/home/aluno/recebido/transporte.tar.gz');
          const confere = await H.runOutput(ctx, 'cd ~/recebido && cp ~/transporte.sha256 . 2>/dev/null; sha256sum -c transporte.sha256 2>&1');
          return H.checkAll([
            [!!original, 'Falta o <code>~/transporte.tar.gz</code>.'],
            [() => /envio\/config\.ini/.test(original) && /envio\/dados\.txt/.test(original), 'O pacote deve conter o conteúdo de <code>~/envio</code>.'],
            [!!soma.trim(), 'Falta o <code>~/transporte.sha256</code>.'],
            [() => /^[0-9a-f]{64}\s+\S+/m.test(soma), 'O arquivo de soma deve estar no formato do <code>sha256sum</code>: <code>hash  nome</code>.'],
            [() => !/^[0-9a-f]{64}\s+\//m.test(soma), 'A soma gravou um caminho absoluto. Gere-a de dentro do diretório do arquivo, senão a verificação não funciona em outra máquina.'],
            [() => partes.length >= 2, () => `A divisão deveria produzir vários pedaços <code>~/parte-*</code>; encontrei ${partes.length}. Confira o <code>-b 400</code>.`],
            [!!remontado, 'Falta o arquivo remontado em <code>~/recebido/transporte.tar.gz</code>.'],
            [() => remontado === original, 'O arquivo remontado não é idêntico ao original — a junção saiu fora de ordem ou faltou um pedaço.'],
            [() => /: OK$/m.test(confere), 'O <code>sha256sum -c</code> não confirma o arquivo remontado.'],
            [() => H.exists(ctx, '/home/aluno/recebido/envio/config.ini'), 'Falta extrair o pacote no destino: o <code>~/recebido/envio/config.ini</code> deveria existir.'],
            [() => H.exists(ctx, '/home/aluno/recebido/envio/dados.txt'), 'O <code>dados.txt</code> também deveria ter voltado na extração.']
          ]);
        }
      }
    ]
  });
})();
