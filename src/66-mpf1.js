/* =========================================================================
   PROJETO FINAL DE LINUX — entrega de um servidor completo
   Sete etapas, sem passo a passo: só o requisito, os critérios de aceite
   e o verificador olhando o estado real da máquina.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const ler = (ctx, p) => H.read(ctx, p) || '';
  const rodar = async (ctx, cmd) => (ctx.run ? (await ctx.run(cmd)).out : '');
  const unidade = (ctx, nome) => {
    const m = ctx.machine || ctx.sh.m;
    const n = nome.includes('.') ? nome : nome + '.service';
    return m.units && (m.units.get ? m.units.get(n) : m.units[n]);
  };

  /* ============================== PF.1 ============================== */
  LX.lesson('mpf1', {
    id: 'lpf-1', n: 'PF.1', title: 'O briefing: contas, grupo e o diretório da equipe',
    goal: 'Receber uma especificação escrita como um chamado real e transformá-la em contas, grupos e permissões corretas — sem que ninguém dite os comandos.',
    body: [
      { h2: 'O que muda daqui para frente' },
      { p: 'Nos dezessete módulos anteriores cada aula tinha um assunto e um desafio sobre aquele assunto. Aqui não. Você recebe <strong>a especificação de um servidor</strong> e precisa entregá-lo funcionando. Qual comando usar, em que ordem, com quais opções — é decisão sua.' },
      { p: 'É assim que o trabalho realmente chega: alguém descreve o resultado esperado, não o caminho. Este projeto vale como avaliação final da trilha de Linux, e é ele que libera a trilha de Docker.' },
      {
        box: 'key', label: 'Regra do projeto', body: [
          { p: 'Os verificadores <strong>não olham o que você digitou</strong>. Eles inspecionam o estado da máquina: se o grupo existe, se o modo do diretório é o pedido, se a partição está montada por UUID, se a unidade subiu, se o backup restaura. Qualquer caminho que produza o estado correto é aceito.' },
          { p: 'E onde a entrega for um relatório, o verificador <strong>reexecuta os comandos</strong> e compara com o que você escreveu. Texto plausível não passa.' }
        ]
      },

      { h2: 'As sete etapas' },
      {
        table: {
          head: ['Etapa', 'Assunto', 'Módulos que ela cobra'],
          rows: [
            ['<strong>PF.1</strong>', 'contas, grupo e diretório compartilhado', '5, 6'],
            ['<strong>PF.2</strong>', 'volume de dados e variável de ambiente', '11, 14'],
            ['<strong>PF.3</strong>', 'serviço próprio no systemd e firewall', '8, 9'],
            ['<strong>PF.4</strong>', 'acesso da equipe por SSH', '6, 10'],
            ['<strong>PF.5</strong>', 'backup com retenção e restauração testada', '13, 15, 16'],
            ['<strong>PF.6</strong>', 'diagnóstico de um incidente plantado', '3, 4, 7, 12, 17'],
            ['<strong>PF.7</strong>', 'relatório de entrega com evidência real', 'todos']
          ]
        }
      },

      { h2: 'O chamado' },
      { p: 'Você assumiu a administração de <code>srv-aula</code>. A equipe de dados vai começar a usar a máquina na semana que vem e mandou o seguinte pedido:' },
      {
        box: 'note', label: 'Chamado #4471 — preparar srv-aula para a equipe de dados', body: [
          {
            ul: [
              'Duas pessoas vão acessar: <strong>ana</strong> (líder técnica) e <strong>bruno</strong> (analista). Cada uma com sua conta e seu diretório pessoal.',
              'As duas trabalham nos mesmos arquivos, então precisam de um <strong>grupo em comum chamado <code>dados</code></strong>.',
              'A ana também precisa poder administrar a máquina.',
              'O material compartilhado fica em <strong><code>/srv/projeto</code></strong>. Tudo que for criado lá dentro precisa <strong>nascer pertencendo ao grupo <code>dados</code></strong>, mesmo que quem criou tenha outro grupo primário — hoje isso não acontece e vive dando problema.',
              'Ninguém de fora do grupo pode nem <em>listar</em> <code>/srv/projeto</code>.',
              'Dentro dele, um subdiretório <code>publico</code> que qualquer usuário da máquina possa ler (mas só o grupo escreve) e um subdiretório <code>segredo</code> onde só o grupo entra.'
            ]
          }
        ]
      },

      { h2: 'Traduzindo o chamado' },
      { p: 'Antes de digitar qualquer coisa, vale fazer o que um administrador experiente faz: reler o pedido transformando cada frase em um requisito técnico verificável.' },
      {
        table: {
          head: ['Frase do chamado', 'O que isso significa tecnicamente'],
          rows: [
            ['"cada uma com sua conta e seu diretório pessoal"', 'usuários com <code>/home/&lt;nome&gt;</code> criado'],
            ['"grupo em comum chamado dados"', 'um grupo suplementar, e as duas contas nele'],
            ['"precisa poder administrar a máquina"', 'ana no grupo <code>sudo</code>'],
            ['"nascer pertencendo ao grupo dados"', '<strong>SGID</strong> no diretório'],
            ['"ninguém de fora pode nem listar"', 'nada de permissão para <em>outros</em> em <code>/srv/projeto</code>'],
            ['"qualquer usuário possa ler"', 'leitura e travessia para <em>outros</em> no subdiretório <code>publico</code>']
          ]
        }
      },
      { p: 'Repare que o chamado nunca disse "use <code>chmod 2770</code>". Ele descreveu um comportamento — arquivos nascendo com o grupo certo — e cabe a você lembrar qual bit produz esse comportamento. Se travar, o módulo 5 tem a resposta; consultar a documentação é parte do trabalho, não trapaça.' }
    ],
    tasks: [
      {
        id: 'tpf-1-g', kind: 'guiado', title: 'Confira o terreno antes de mexer',
        body: [
          { p: 'Antes de criar qualquer coisa, confirme o que <code>srv-aula</code> já tem. É assim que se evita recriar algo que já existe ou, pior, descobrir depois que um nome já está em uso.' },
          { code: ['$ getent group dados', '$ getent passwd ana', '$ getent passwd bruno', '$ ls -ld /srv'] },
          { p: 'Se os dois primeiros comandos não devolvem nada, o grupo e as contas ainda não existem — é exatamente o que o chamado pede para criar. O <code>ls -ld /srv</code> mostra se o diretório pai já existe (ele existe por padrão em qualquer Ubuntu; quem falta é o <code>/srv/projeto</code> dentro dele).' }
        ],
        hints: ['Clique no botão <em>rodar</em> ao lado de cada linha, um comando por vez.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /getent\s+group\s+dados/), 'Rode <code>getent group dados</code> para conferir se o grupo já existe.'],
          [() => H.usedCommand(ctx, /getent\s+passwd\s+ana/), 'Rode <code>getent passwd ana</code>.'],
          [() => H.usedCommand(ctx, /getent\s+passwd\s+bruno/), 'Rode <code>getent passwd bruno</code>.'],
          [() => H.usedCommand(ctx, /ls\s+-ld?\s+\/srv/), 'Rode <code>ls -ld /srv</code> para ver o diretório pai.']
        ])
      },
      {
        id: 'tpf-1-q', kind: 'quiz', title: 'Por que um grupo, e não permissão de cada arquivo',
        body: [{ p: 'O chamado pede um grupo <code>dados</code> em comum para a <code>ana</code> e o <code>bruno</code>. Em vez de criar o grupo, seria possível deixar os dois arquivos e diretórios do projeto com permissão de leitura e escrita liberada para "outros" (o <code>o</code> de <code>rwx</code>). Por que isso é uma escolha pior?' }],
        options: [
          { text: 'Um grupo é gerenciado num lugar só: adicionar ou remover alguém da equipe é um <code>usermod</code>, sem tocar em nenhum arquivo. Liberar para "outros" também abriria o acesso a qualquer conta futura da máquina, não só à equipe de dados.', correct: true },
          { text: 'Permissão para "outros" não é aceita pelo <code>chmod</code> em diretórios, só em arquivos.', why: 'O <code>chmod</code> aceita o bit de "outros" em diretórios normalmente — o problema não é técnico, é de segurança e de manutenção.' },
          { text: 'Sem grupo, o Linux não deixa duas contas diferentes lerem o mesmo arquivo.', why: 'Duas contas sempre puderam ler o mesmo arquivo por permissão de "outros" — é exatamente essa a alternativa ruim que a pergunta está comparando.' },
          { text: 'O grupo é só uma questão de organização visual no <code>ls -l</code>; na prática o resultado de acesso seria idêntico.', why: 'Não é só estética: com "outros" liberado, <strong>qualquer</strong> conta futura na máquina ganharia acesso, não apenas quem estiver no grupo <code>dados</code>.' }
        ],
        hints: ['Pense no dia em que uma terceira pessoa entrar na equipe — ou em uma conta de serviço qualquer criada meses depois.'],
        explain: 'Um grupo separa "quem pode" de "onde está guardado". Trocar a lista de membros de <code>dados</code> não exige tocar em um único arquivo do projeto, e o acesso fica restrito a quem está explicitamente naquele grupo — nunca à máquina inteira.'
      },
      {
        id: 'tpf-1-a', kind: 'desafio', title: 'Contas e grupo da equipe',
        body: [
          { p: 'Entregue o primeiro pedaço do chamado:' },
          {
            ul: [
              'o grupo <code>dados</code> existe;',
              'os usuários <code>ana</code> e <code>bruno</code> existem, cada um com seu diretório pessoal em <code>/home</code>;',
              'os dois pertencem ao grupo <code>dados</code>;',
              'a <code>ana</code> também pertence ao grupo <code>sudo</code>.'
            ]
          },
          { p: 'Nenhuma senha precisa ser definida — o acesso será por chave, e isso é a etapa PF.4.' }
        ],
        hints: [
          'Grupo primeiro, contas depois: criar o usuário já apontando o grupo suplementar evita um segundo comando. O <code>useradd</code> tem uma opção para diretório pessoal e outra para grupos suplementares.',
          'A opção <code>-m</code> cria o <code>/home</code>. A opção <code>-G</code> aceita vários grupos separados por vírgula: <code>-G dados,sudo</code>. Consulte com <code>useradd --help</code>.'
        ],
        solution: '<div class="code"><pre>$ sudo groupadd dados\n$ sudo useradd -m -G dados,sudo ana\n$ sudo useradd -m -G dados bruno\n$ id ana\n$ id bruno</pre></div><p style="margin-top:8px">Havia outros caminhos igualmente corretos: criar as contas com <code>useradd -m</code> e depois <code>sudo usermod -aG dados ana</code>. O que importa é o estado final. O <code>-a</code> do <code>usermod</code> é obrigatório — sem ele você <em>substitui</em> a lista de grupos em vez de acrescentar.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const g = m.groupByName('dados');
          const membros = (n) => (m.userByName(n) ? m.groupsOfUser(n).map(x => x.name) : []);
          return H.checkAll([
            [!!g, 'O grupo <code>dados</code> ainda não existe. Confira com <code>getent group dados</code>.'],
            [!!m.userByName('ana'), 'O usuário <code>ana</code> não existe.'],
            [!!m.userByName('bruno'), 'O usuário <code>bruno</code> não existe.'],
            [() => H.isDir(ctx, '/home/ana'), 'A <code>ana</code> existe, mas não tem diretório pessoal em <code>/home/ana</code>. Veja a opção que cria o home no <code>useradd</code>.'],
            [() => H.isDir(ctx, '/home/bruno'), 'O <code>bruno</code> não tem diretório pessoal em <code>/home/bruno</code>.'],
            [() => membros('ana').includes('dados'), 'A <code>ana</code> não está no grupo <code>dados</code>. Verifique com <code>id ana</code>.'],
            [() => membros('bruno').includes('dados'), 'O <code>bruno</code> não está no grupo <code>dados</code>.'],
            [() => membros('ana').includes('sudo'), 'A <code>ana</code> precisa administrar a máquina: falta o grupo <code>sudo</code>.']
          ]);
        }
      },

    ]
  });

  /* ============================== PF.2 ============================== */
  LX.lesson('mpf1', {
    id: 'lpf-2', n: 'PF.2', title: 'O volume de dados e o ambiente da equipe',
    goal: 'Colocar os dados do projeto num disco próprio, montado por UUID e endurecido — e publicar a configuração da equipe para todos os shells da máquina.',
    body: [
      { h2: 'Continuação do chamado' },
      {
        box: 'note', label: 'Chamado #4471 — parte 2', body: [
          {
            ul: [
              'O <code>/srv/projeto</code> não pode ficar na partição raiz: se os dados crescerem, derrubam o sistema inteiro. Coloquem num disco separado — a máquina tem um <code>/dev/vdb</code> livre.',
              'Esse volume precisa <strong>voltar sozinho depois de um reboot</strong>, e o time de infraestrutura exige montagem <strong>por UUID</strong>, nunca por <code>/dev/vdb1</code>: a ordem dos discos muda.',
              'O volume guarda dado de gente, não programa: não deve permitir executar nada nem honrar bits especiais.',
              'E todo mundo na máquina precisa ter a variável <code>PROJETO_DIR</code> apontando para <code>/srv/projeto</code> — sem cada um editar o próprio <code>.bashrc</code>.'
            ]
          }
        ]
      },

      { h2: 'Por que UUID e não /dev/vdb1' },
      { p: 'Nomes como <code>/dev/vdb1</code> são atribuídos na ordem em que o kernel enxerga os dispositivos no boot. Acrescente um disco, troque uma controladora, mova a VM de servidor — e o que era <code>vdb</code> vira <code>vdc</code>. Se o <code>/etc/fstab</code> aponta para o nome, o sistema monta o disco errado ou não monta nada.' },
      { p: 'O <strong>UUID</strong> é gravado dentro do sistema de arquivos, no momento do <code>mkfs</code>. Ele viaja com os dados, não com a posição. Por isso é a referência correta — e por isso <strong>formatar de novo gera um UUID novo</strong>, o que quebra a linha do fstab que você já tinha escrito.' },
      {
        ascii: `ordem certa:
  parted mklabel → parted mkpart → mkfs (-L rótulo)
                                      ↓
                            blkid -s UUID -o value
                                      ↓
                        escrever a linha no /etc/fstab
                                      ↓
                                  mount -a`
      },
      {
        box: 'warn', label: 'A linha de fstab que impede o boot', body: [
          { p: 'Uma linha errada no <code>/etc/fstab</code> pode deixar a máquina sem subir — ela para no modo de emergência esperando alguém digitar a senha do root num console que talvez você não tenha.' },
          { p: 'Duas proteções: <code>nofail</code> na linha, que faz o boot continuar se o dispositivo não aparecer; e <strong>testar com <code>sudo mount -a</code> antes de confiar</strong>. O <code>mount -a</code> monta tudo que está no fstab e ainda não está montado — se ele reclama agora, o boot também reclamaria.' }
        ]
      },

      { h2: 'Opções de montagem que endurecem um volume de dados' },
      {
        table: {
          head: ['Opção', 'Impede'],
          rows: [
            ['<code>noexec</code>', 'executar qualquer binário ou script daquele volume'],
            ['<code>nosuid</code>', 'que os bits SUID/SGID de arquivos ali tenham efeito'],
            ['<code>nodev</code>', 'que arquivos de dispositivo ali sejam interpretados'],
            ['<code>nofail</code>', 'que o boot pare se o dispositivo faltar']
          ]
        }
      },
      { p: 'As três primeiras são a defesa padrão de qualquer área onde usuários escrevem: mesmo que alguém consiga gravar um script malicioso lá, o kernel se recusa a executá-lo. Custa nada e fecha uma classe inteira de ataque.' },

      { h2: 'Configuração para todo mundo: /etc/profile.d' },
      { p: 'Pedir para cada pessoa editar o próprio <code>~/.bashrc</code> não escala e não sobrevive a contas novas. Todo shell de login lê o <code>/etc/profile</code>, e ele carrega <strong>todos os arquivos <code>.sh</code> de <code>/etc/profile.d/</code></strong>.' },
      { p: 'É o mesmo padrão de <code>/etc/sudoers.d</code>, <code>/etc/logrotate.d</code> e <code>/etc/apt/sources.list.d</code> que você já viu três vezes neste curso: <strong>um arquivo por assunto, em vez de todos editando o mesmo arquivo</strong>. Aqui ele resolve "todo mundo precisa dessa variável" com um arquivo só.' }
    ],
    tasks: [
      {
        id: 'tpf-2-g', kind: 'guiado', title: 'Veja o disco cru e o fstab atual',
        body: [
          { p: 'Antes de particionar, confirme o que já está aí: o disco sem uso, sem sistema de arquivos, e a linha que ainda não existe no fstab.' },
          { code: ['$ lsblk', '$ lsblk -f', '$ cat /etc/fstab', '$ findmnt /srv/projeto'] },
          { p: 'No <code>lsblk -f</code>, o <code>vdb</code> aparece sem nada nas colunas FSTYPE, LABEL e UUID — é um disco em branco. E o <code>findmnt /srv/projeto</code> não deve devolver nada ainda: nada está montado ali.' }
        ],
        hints: ['Um comando por vez, e leia a saída antes do próximo.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /^\s*lsblk\s*$/m), 'Rode <code>lsblk</code> sem opções primeiro.'],
          [() => H.usedCommand(ctx, /lsblk\s+-f/), 'Rode <code>lsblk -f</code> para ver os sistemas de arquivos.'],
          [() => H.usedCommand(ctx, /(cat|less|head|tail)\s+.*fstab/), 'Leia o <code>/etc/fstab</code> atual.'],
          [() => H.usedCommand(ctx, /findmnt\s+\/srv\/projeto/), 'Confira com <code>findmnt /srv/projeto</code> se já existe montagem ali.']
        ])
      },
      {
        id: 'tpf-2-q', kind: 'quiz', title: 'Por que não montar por /dev/vdb1',
        body: [{ p: 'O chamado exige que a linha do <code>/etc/fstab</code> referencie a partição por UUID, e proíbe usar <code>/dev/vdb1</code>. Por quê?' }],
        options: [
          { text: 'O nome <code>/dev/vdb1</code> depende da ordem em que o kernel enxerga os discos no boot; ela pode mudar (disco novo, controladora trocada), e o UUID é gravado dentro do sistema de arquivos e viaja com os dados.', correct: true },
          { text: '<code>/dev/vdb1</code> não é aceito na sintaxe do <code>/etc/fstab</code>.', why: 'A sintaxe aceita normalmente um caminho de dispositivo — o problema não é o fstab recusar a linha, é ela apontar para o disco errado depois de uma mudança na ordem dos discos.' },
          { text: 'O UUID monta mais rápido no boot do que um caminho de dispositivo.', why: 'Não há diferença de desempenho entre as duas formas; a vantagem do UUID é identificar o disco certo, não a velocidade.' },
          { text: 'Só é possível usar <code>noexec</code>, <code>nosuid</code> e <code>nodev</code> em linhas que referenciam por UUID.', why: 'As opções de montagem funcionam com qualquer forma de referenciar o dispositivo — UUID ou caminho. Isso não tem relação com a exigência do chamado.' }
        ],
        hints: ['Pense no que acontece se, um dia, alguém acrescentar outro disco a essa máquina.'],
        explain: 'O UUID é gerado no <code>mkfs</code> e gravado dentro do próprio sistema de arquivos — ele identifica a partição onde quer que ela esteja. Um nome como <code>/dev/vdb1</code> é atribuído pela ordem de detecção no boot, que pode mudar; se o fstab apontar para o nome, um disco novo pode fazer o sistema montar a coisa errada no lugar errado.'
      },
      {
        id: 'tpf-2-a', kind: 'desafio', title: 'Volume de dados montado por UUID',
        body: [
          { p: 'Prepare o <code>/dev/vdb</code> e coloque o <code>/srv/projeto</code> em cima dele. Critérios de aceite:' },
          {
            ul: [
              'o disco <code>/dev/vdb</code> com tabela <strong>gpt</strong> e uma partição <code>vdb1</code>;',
              'a partição formatada em <strong>ext4</strong> com o rótulo <strong><code>PROJETO</code></strong>;',
              'montada em <code>/srv/projeto</code> com as opções <code>noexec</code>, <code>nosuid</code> e <code>nodev</code>;',
              'uma linha no <code>/etc/fstab</code> referenciando a partição <strong>por UUID</strong> (não por <code>/dev/vdb1</code>), com <code>nofail</code>, montando em <code>/srv/projeto</code>;',
              'a montagem atual precisa vir do próprio fstab — ou seja, funcionar com <code>sudo mount -a</code>;',
              'depois de montado, o diretório continua sendo <code>root:dados</code>, modo <code>2770</code>, com os subdiretórios <code>publico</code> e <code>segredo</code> dentro dele.'
            ]
          },
          {
            box: 'warn', label: 'Atenção à ordem', body: [
              { p: 'Montar um volume em cima de <code>/srv/projeto</code> <strong>esconde</strong> o que estava lá embaixo. Então dono, permissões e subdiretórios da PF.1 precisam ser recriados <em>depois</em> da montagem — é o volume novo que passa a ser o <code>/srv/projeto</code>.' }
            ]
          }
        ],
        hints: [
          'A sequência é: <code>parted mklabel</code> → <code>parted mkpart</code> → <code>mkfs.ext4 -L PROJETO</code> → pegar o UUID → escrever no fstab → <code>mount -a</code> → só então <code>chown</code>/<code>chmod</code>/<code>mkdir</code>.',
          'Pegue só o UUID com <code>sudo blkid -s UUID -o value /dev/vdb1</code> e guarde numa variável. A linha do fstab tem seis campos: <code>UUID=... /srv/projeto ext4 defaults,nofail,noexec,nosuid,nodev 0 2</code>.'
        ],
        solution: '<div class="code"><pre>$ sudo groupadd -f dados\n$ sudo parted -s /dev/vdb mklabel gpt\n$ sudo parted -s /dev/vdb mkpart projeto ext4 0% 100%\n$ sudo mkfs.ext4 -L PROJETO /dev/vdb1\n\n$ sudo mkdir -p /srv/projeto\n$ U=$(sudo blkid -s UUID -o value /dev/vdb1)\n$ echo "UUID=$U /srv/projeto ext4 defaults,nofail,noexec,nosuid,nodev 0 2" | sudo tee -a /etc/fstab\n$ sudo mount -a\n$ findmnt /srv/projeto\n\n$ sudo mkdir -p /srv/projeto/publico /srv/projeto/segredo\n$ sudo chown -R root:dados /srv/projeto\n$ sudo chmod 2770 /srv/projeto\n$ sudo chmod 2775 /srv/projeto/publico\n$ sudo chmod 2770 /srv/projeto/segredo\n$ ls -ld /srv/projeto /srv/projeto/publico</pre></div><p style="margin-top:8px">Repare que o <code>chown</code> e os <code>mkdir</code> vieram <strong>depois</strong> do <code>mount</code>. Antes disso você estaria configurando o diretório de baixo, que a montagem esconde — um erro que só aparece no próximo reboot, quando "as permissões voltaram sozinhas".</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const disco = (m.blockDevices || []).find(d => d.name === 'vdb');
          const p1 = disco && (disco.children || []).find(x => x.name === 'vdb1');
          const fstab = ler(ctx, '/etc/fstab');
          const mnt = ((m.fs && m.fs.mounts) || m.mounts || []).find(x => x.mount === '/srv/projeto');
          const linha = fstab.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean)
            .find(l => l.split(/\s+/)[1] === '/srv/projeto');
          const md = H.mode(ctx, '/srv/projeto');
          const dono = H.owner(ctx, '/srv/projeto');
          return H.checkAll([
            [!!disco, 'Este ambiente não tem o disco <code>/dev/vdb</code>.'],
            [() => !!disco.tabela, 'O disco ainda não tem tabela de partições (<code>parted -s /dev/vdb mklabel gpt</code>).'],
            [() => disco.tabela === 'gpt', 'A tabela deve ser <code>gpt</code>.'],
            [!!p1, 'Falta a partição <code>/dev/vdb1</code>.'],
            [() => p1.fstype === 'ext4', 'A partição precisa estar formatada em <code>ext4</code>.'],
            [() => p1.label === 'PROJETO', () => `O rótulo deve ser <code>PROJETO</code>; está "${(p1 && p1.label) || '(nenhum)'}". Use <code>mkfs.ext4 -L PROJETO</code>.`],
            [!!linha, 'Falta a linha no <code>/etc/fstab</code> montando em <code>/srv/projeto</code>.'],
            [() => /^UUID=/.test(linha || ''), () => `A linha do fstab deve referenciar a partição por <strong>UUID</strong>, não por caminho de dispositivo. Linha atual: "${linha}".`],
            [() => (linha || '').startsWith('UUID=' + p1.uuid), 'O UUID do fstab não é o da partição atual — se você formatou depois de escrever a linha, o UUID mudou.'],
            [() => /nofail/.test(linha || ''), 'A linha do fstab precisa da opção <code>nofail</code>, para uma falha do disco não impedir o boot.'],
            [!!mnt, 'A partição não está montada em <code>/srv/projeto</code>. Teste com <code>sudo mount -a</code>.'],
            [() => /noexec/.test(mnt.opts) && /nosuid/.test(mnt.opts) && /nodev/.test(mnt.opts), () => `A montagem precisa de <code>noexec</code>, <code>nosuid</code> e <code>nodev</code>. Atuais: ${mnt.opts}.`],
            [() => H.usedCommand(ctx, /mount\s+-a/), 'Comprove que o fstab funciona rodando <code>sudo mount -a</code>.'],
            [() => (dono || {}).group === 'dados', 'Depois de montar, o <code>/srv/projeto</code> precisa voltar a ser do grupo <code>dados</code> — a montagem escondeu o diretório antigo.'],
            [() => (md & 0o2770) === 0o2770 && (md & 0o007) === 0, () => `O modo deve continuar <code>2770</code>; está ${md === null ? 'inexistente' : md.toString(8)}.`],
            [() => H.isDir(ctx, '/srv/projeto/publico') && H.isDir(ctx, '/srv/projeto/segredo'), 'Os subdiretórios <code>publico</code> e <code>segredo</code> precisam existir dentro do volume montado.']
          ]);
        }
      },

    ]
  });

  /* ============================== PF.3 ============================== */
  LX.lesson('mpf1', {
    id: 'lpf-3', n: 'PF.3', title: 'Um serviço seu e o firewall fechado',
    goal: 'Escrever uma unidade systemd do zero para um programa próprio, colocá-la para subir no boot e deixar a máquina exposta apenas no que precisa.',
    body: [
      { h2: 'Continuação do chamado' },
      {
        box: 'note', label: 'Chamado #4471 — parte 3', body: [
          {
            ul: [
              'A equipe escreveu um coletor que precisa ficar <strong>rodando o tempo todo</strong>, gravando um registro periódico. O programa fica em <code>/opt/coletor/coletar.sh</code> e é responsabilidade de vocês.',
              'Esse coletor <strong>não pode rodar como root</strong> — use uma conta de serviço sem shell de login.',
              'O serviço precisa se chamar <code>coletor</code>, subir sozinho depois de um reboot e voltar caso morra.',
              'A máquina fica exposta na internet: deixe o firewall ativo permitindo apenas <strong>SSH (22)</strong> e a porta <strong>8080</strong>, e negando o resto por padrão.'
            ]
          }
        ]
      },

      { h2: 'A anatomia de uma unidade, revisada' },
      { p: 'No módulo 8 você leu unidades prontas. Agora escreve uma. As três seções e o mínimo que cada uma precisa:' },
      {
        table: {
          head: ['Seção', 'Serve para', 'Chaves que você vai usar'],
          rows: [
            ['<code>[Unit]</code>', 'descrever e ordenar', '<code>Description=</code>, <code>After=</code>'],
            ['<code>[Service]</code>', 'dizer o que executar e como', '<code>Type=</code>, <code>ExecStart=</code>, <code>User=</code>, <code>Restart=</code>'],
            ['<code>[Install]</code>', 'onde ela se pendura no boot', '<code>WantedBy=multi-user.target</code>']
          ]
        }
      },
      {
        box: 'key', label: 'Serviço que fica de pé × tarefa que roda e sai', body: [
          { p: 'Esta distinção decide metade das escolhas de uma unit, e errá-la produz um serviço que "falha" sem nada estar quebrado:' },
          {
            table: {
              head: ['', 'Programa que <strong>fica rodando</strong>', 'Tarefa que <strong>roda e termina</strong>'],
              rows: [
                ['<code>Type=</code>', '<code>simple</code> (ou <code>notify</code>)', '<code>oneshot</code>'],
                ['<code>Restart=</code>', '<code>always</code> ou <code>on-failure</code>', '<strong>nenhum</strong>'],
                ['Como agendar', 'não se agenda: fica de pé', 'um <code>.timer</code> ao lado'],
                ['Estado normal', '<code>active (running)</code>', '<code>inactive (dead)</code> entre execuções']
              ]
            }
          },
          { p: 'Um script que grava uma linha e sai, com <code>Type=simple</code> e <code>Restart=always</code>, entra num laço: o systemd o reinicia, ele sai de novo, e em segundos a unit bate no limite de reinícios e termina em <code>failed</code>. Se o trabalho é pontual, o par correto é <code>Type=oneshot</code> + um timer — como você viu na aula 16.4.' },
          { p: 'Neste chamado o coletor <strong>fica rodando</strong>: o programa tem um laço com pausa. Então <code>Type=simple</code> e <code>Restart=always</code> são as escolhas certas.' }
        ]
      },
      {
        box: 'warn', label: 'Três erros que custam meia hora', body: [
          {
            ul: [
              '<strong>Sem <code>[Install]</code></strong> o <code>systemctl enable</code> não tem onde criar o link e falha. Unidade sem essa seção só sobe manualmente.',
              '<strong><code>ExecStart</code> precisa de caminho absoluto.</strong> O systemd não tem <code>PATH</code> de shell interativo.',
              '<strong>Editou o arquivo? <code>systemctl daemon-reload</code>.</strong> O systemd trabalha com a versão que carregou na memória, não com a que está no disco.'
            ]
          }
        ]
      },

      { h2: 'Contas de serviço' },
      { p: 'Um processo exposto deve rodar com o menor privilégio possível. A convenção é uma conta dedicada, sem diretório pessoal útil e <strong>sem shell de login</strong> — assim, mesmo que alguém consiga executar comandos como esse usuário, não ganha um shell interativo.' },
      { code: ['$ sudo useradd --system --shell /usr/sbin/nologin coletor', '$ getent passwd coletor'] },
      { p: 'O <code>--system</code> pede um UID da faixa reservada a serviços (abaixo de 1000), que não aparece em tela de login.' },

      { h2: 'Firewall: a ordem importa' },
      { p: 'A regra de ouro do <code>ufw</code>: <strong>libere o SSH antes de ativar</strong>. Se você ativar um firewall com política de negação sem ter liberado a porta pela qual está conectado, a sessão cai e a máquina fica inacessível. Em um servidor remoto de verdade isso significa abrir um chamado no provedor.' },
      { code: ['$ sudo ufw default deny incoming', '$ sudo ufw default allow outgoing', '$ sudo ufw allow 22/tcp', '$ sudo ufw allow 8080/tcp', '$ sudo ufw enable', '$ sudo ufw status verbose'] }
    ],
    tasks: [
      {
        id: 'tpf-3-g', kind: 'guiado', title: 'Confira o systemd e o firewall antes de mexer',
        body: [
          { p: 'Antes de escrever a unidade, veja que ela ainda não existe, e confirme em que estado o firewall está.' },
          { code: ['$ systemctl status coletor', '$ ls /etc/systemd/system/', '$ sudo ufw status verbose'] },
          { p: 'O primeiro comando deve reclamar que a unidade <code>coletor</code> não é conhecida — é o que você vai criar. O <code>ufw status verbose</code> mostra se o firewall já está ativo e quais portas, se houver alguma, já estão liberadas; libere sempre o SSH antes de ativar.' }
        ],
        hints: ['<code>systemctl status</code> de uma unidade inexistente também é uma resposta útil: ela confirma que ainda não foi criada.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /systemctl\s+status\s+coletor/), 'Rode <code>systemctl status coletor</code> e veja que ela ainda não existe.'],
          [() => H.usedCommand(ctx, /ls\s+.*\/etc\/systemd\/system/), 'Liste <code>/etc/systemd/system/</code> com <code>ls</code>.'],
          [() => H.usedCommand(ctx, /ufw\s+status/), 'Rode <code>sudo ufw status verbose</code> para ver o estado atual do firewall.']
        ])
      },
      {
        id: 'tpf-3-q', kind: 'quiz', title: 'oneshot ou simple?',
        body: [{ p: 'O coletor tem um laço interno com <code>sleep</code> que nunca termina sozinho. Por que a unidade precisa de <code>Type=simple</code> (com <code>Restart=always</code>), e não <code>Type=oneshot</code>?' }],
        options: [
          { text: 'Um <code>oneshot</code> é para um comando que roda e termina; a unidade fica <code>inactive (dead)</code> entre execuções e precisa de um <code>.timer</code> ao lado para ser reagendada. Um programa que fica de pé, como este, é <code>simple</code>.', correct: true },
          { text: '<code>oneshot</code> é mais rápido para o systemd iniciar do que <code>simple</code>.', why: 'A diferença entre os tipos não é velocidade de início — é o que o systemd espera do processo depois que ele começa a rodar.' },
          { text: 'Só unidades <code>Type=simple</code> podem ter a seção <code>[Install]</code>.', why: 'A seção <code>[Install]</code> (com <code>WantedBy=</code>) é independente do <code>Type=</code>; qualquer tipo de unidade pode tê-la.' },
          { text: '<code>oneshot</code> não aceita <code>User=</code>, então o serviço teria que rodar como root.', why: 'Unidades <code>oneshot</code> aceitam <code>User=</code> normalmente. O problema de usar <code>oneshot</code> aqui não é sobre o usuário, é sobre o processo nunca terminar.' }
        ],
        hints: ['Pense no que o systemd faz quando o processo de um <code>Type=simple</code> termina sozinho e a unidade tem <code>Restart=always</code>.'],
        explain: 'O par certo depende de o programa <strong>ficar rodando</strong> ou <strong>rodar e terminar</strong>. O coletor tem um laço com <code>sleep</code> e nunca sai sozinho, então é <code>Type=simple</code> com <code>Restart=always</code>. Um <code>oneshot</code> combinado com um script que fica em laço nunca chega a "terminar com sucesso", e o systemd não tem como saber que ele está funcionando normalmente.'
      },
      {
        id: 'tpf-3-a', kind: 'desafio', title: 'O serviço coletor',
        body: [
          { p: 'Critérios de aceite:' },
          {
            ul: [
              'existe o script <code>/opt/coletor/coletar.sh</code>, <strong>executável</strong>, com shebang, que fica em execução num laço e acrescenta uma linha em <code>/var/log/coletor.log</code> a cada volta;',
              'existe a conta de serviço <code>coletor</code>, com shell <code>/usr/sbin/nologin</code> e UID abaixo de 1000;',
              'existe a unidade <code>/etc/systemd/system/coletor.service</code>, executando esse script <strong>como o usuário <code>coletor</code></strong>, com <code>Type=simple</code>, reinício automático e seção <code>[Install]</code>;',
              'o serviço está <strong>ativo</strong> e <strong>habilitado</strong> para o boot.'
            ]
          },
          { p: 'O script pode ser simples — o que está sendo avaliado é a unidade. Mas ele precisa ter a forma de um programa que <em>fica de pé</em>, e precisa conseguir escrever no log rodando como <code>coletor</code>.' }
        ],
        hints: [
          'Ordem que evita retrabalho: criar o usuário → criar o diretório e o script → dar permissão de escrita no log ao usuário do serviço → escrever a unidade → <code>daemon-reload</code> → <code>enable --now</code>.',
          'O laço é <code>while true; do echo ... &gt;&gt; /var/log/coletor.log; sleep 60; done</code>. Para criar o script sem editor, use um heredoc com <code>sudo tee</code>. E o log: <code>touch</code> o arquivo e <code>chown coletor</code> nele — o usuário do serviço não pode escrever em <code>/var/log</code> por conta própria.'
        ],
        solution: '<div class="code"><pre>$ sudo useradd --system --shell /usr/sbin/nologin coletor\n$ sudo mkdir -p /opt/coletor\n$ sudo tee /opt/coletor/coletar.sh &gt; /dev/null &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\nwhile true; do\n  echo "$(date +%F) coleta executada" &gt;&gt; /var/log/coletor.log\n  sleep 60\ndone\nEOF\n$ sudo chmod 755 /opt/coletor/coletar.sh\n$ sudo touch /var/log/coletor.log\n$ sudo chown coletor:coletor /var/log/coletor.log\n$ sudo tee /etc/systemd/system/coletor.service &gt; /dev/null &lt;&lt; \'EOF\'\n[Unit]\nDescription=Coletor da equipe de dados\nAfter=network.target\n\n[Service]\nType=simple\nUser=coletor\nExecStart=/opt/coletor/coletar.sh\nRestart=always\n\n[Install]\nWantedBy=multi-user.target\nEOF\n$ sudo systemctl daemon-reload\n$ sudo systemctl enable --now coletor\n$ systemctl status coletor</pre></div><p style="margin-top:8px">O <code>enable --now</code> faz as duas coisas de uma vez: cria o link no <code>multi-user.target.wants</code> e inicia o serviço agora.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const u = m.userByName('coletor');
          const script = ler(ctx, '/opt/coletor/coletar.sh');
          const unit = ler(ctx, '/etc/systemd/system/coletor.service');
          const un = unidade(ctx, 'coletor');
          return H.checkAll([
            [() => H.isFile(ctx, '/opt/coletor/coletar.sh'), 'Não encontrei <code>/opt/coletor/coletar.sh</code>.'],
            [() => (H.mode(ctx, '/opt/coletor/coletar.sh') & 0o111) !== 0, 'O script existe mas não está executável. Falta <code>chmod +x</code>.'],
            [() => /^#!/.test(script), 'O script precisa começar com um shebang (<code>#!/bin/bash</code>).'],
            [() => /while\s|until\s|for\s*\(\(/.test(script), 'O chamado pede um coletor que <strong>fica rodando</strong>. Um script que grava uma linha e sai, com <code>Restart=always</code>, entra em laço de reinício e termina em <code>failed</code>. Coloque o trabalho dentro de um laço com <code>sleep</code>.'],
            [() => /coletor\.log/.test(script), 'O script deve gravar em <code>/var/log/coletor.log</code>.'],
            [!!u, 'A conta de serviço <code>coletor</code> não existe.'],
            [() => !!u && /nologin|false/.test(u.shell || ''), 'A conta <code>coletor</code> não pode ter shell de login. Use <code>/usr/sbin/nologin</code>.'],
            [() => !!u && u.uid < 1000, 'A conta de serviço deve ter UID abaixo de 1000 (opção <code>--system</code>).'],
            [!!unit, 'Não encontrei <code>/etc/systemd/system/coletor.service</code>.'],
            [() => /\[Service\]/.test(unit) && /\[Unit\]/.test(unit), 'A unidade precisa das seções <code>[Unit]</code> e <code>[Service]</code>.'],
            [() => /ExecStart\s*=\s*\/opt\/coletor\/coletar\.sh/.test(unit), 'O <code>ExecStart=</code> precisa apontar para o caminho absoluto do script.'],
            [() => /^\s*Type\s*=\s*simple\s*$/m.test(unit), 'Falta <code>Type=simple</code> — é o tipo de um programa que fica em execução.'],
            [() => /^\s*User\s*=\s*coletor\s*$/m.test(unit), 'O serviço ainda rodaria como root. Falta <code>User=coletor</code>.'],
            [() => /^\s*Restart\s*=\s*(always|on-failure)\s*$/m.test(unit), 'Falta <code>Restart=</code> — o chamado pede que o serviço volte sozinho se morrer.'],
            [() => /\[Install\]/.test(unit) && /WantedBy\s*=/.test(unit), 'Sem a seção <code>[Install]</code> com <code>WantedBy=</code>, o <code>enable</code> não tem onde se pendurar.'],
            [!!un, 'O systemd ainda não conhece a unidade. Depois de criar o arquivo, rode <code>sudo systemctl daemon-reload</code>.'],
            [() => !!un && un.enabled, 'A unidade existe mas não está habilitada para o boot (<code>systemctl enable coletor</code>).'],
            [() => !!un && (un.active === true || un.state === 'active'), 'A unidade não está ativa. Suba com <code>systemctl start coletor</code> e investigue com <code>systemctl status coletor</code> se falhar.']
          ]);
        }
      },

    ]
  });

  /* ============================== PF.4 ============================== */
  LX.lesson('mpf1', {
    id: 'lpf-4', n: 'PF.4', title: 'O acesso da equipe',
    goal: 'Dar acesso remoto às duas pessoas por chave, e fechar o SSH do jeito que um servidor exposto exige.',
    body: [
      { h2: 'Continuação do chamado' },
      {
        box: 'note', label: 'Chamado #4471 — parte 4', body: [
          {
            ul: [
              'A <strong>ana</strong> precisa entrar por SSH usando chave. A chave pública dela está com vocês.',
              'Ninguém entra como <strong>root</strong> pelo SSH, e <strong>senha não é aceita</strong> — só chave.',
              'Essas duas regras precisam ficar num arquivo separado, para uma atualização de pacote não desfazer a configuração.',
              'E, obviamente: se vocês derrubarem o acesso SSH, ninguém entra mais na máquina. Testem antes de aplicar.'
            ]
          }
        ]
      },

      { h2: 'Onde a chave pública mora e por que as permissões importam' },
      { p: 'A chave pública de quem pode entrar como um usuário fica em <code>~/.ssh/authorized_keys</code> <strong>do próprio usuário</strong>. O servidor lê esse arquivo no momento do login.' },
      {
        table: {
          head: ['Caminho', 'Modo exigido', 'Dono'],
          rows: [
            ['<code>~</code> (o home)', 'sem escrita para grupo/outros', 'o usuário'],
            ['<code>~/.ssh</code>', '<code>700</code>', 'o usuário'],
            ['<code>~/.ssh/authorized_keys</code>', '<code>600</code>', 'o usuário']
          ]
        }
      },
      {
        box: 'key', label: 'Por que o sshd é tão exigente', body: [
          { p: 'Se o <code>authorized_keys</code> pudesse ser editado por outra pessoa, ela acrescentaria a própria chave e entraria como você. Por isso o servidor <strong>recusa a autenticação em silêncio</strong> quando as permissões estão frouxas — do lado do cliente aparece só "Permission denied (publickey)", sem explicação.' },
          { p: 'É o erro de SSH mais comum e o mais difícil de diagnosticar por adivinhação. A resposta está sempre no log do servidor: <code>sudo journalctl -u ssh -n 20</code> diz literalmente <em>"Authentication refused: bad ownership or modes"</em>.' }
        ]
      },

      { h2: 'Endurecer o sshd sem se trancar do lado de fora' },
      { p: 'As duas diretivas do chamado:' },
      {
        ul: [
          '<code>PermitRootLogin no</code> — ninguém entra como root; entra como gente e escala com <code>sudo</code>, o que deixa rastro no <code>auth.log</code>.',
          '<code>PasswordAuthentication no</code> — só chave. Elimina de uma vez a força bruta, que é a maior parte do tráfego hostil que qualquer servidor exposto recebe.'
        ]
      },
      { p: 'E o lugar certo para elas é um <em>drop-in</em> em <code>/etc/ssh/sshd_config.d/</code>, não o arquivo principal — mesmo padrão de <code>/etc/profile.d</code> e <code>/etc/logrotate.d</code>. Assim uma atualização do pacote <code>openssh-server</code> não sobrescreve a sua configuração.' },
      {
        box: 'warn', label: 'O procedimento que evita perder a máquina', body: [
          {
            ol: [
              'Escreva a configuração.',
              '<strong><code>sudo sshd -t</code></strong> — valida a sintaxe. Se houver erro, ele aparece <em>aqui</em>, e não no momento em que o serviço não sobe mais.',
              '<code>sudo systemctl reload ssh</code> — recarrega sem derrubar as sessões abertas.',
              '<strong>Abra uma segunda sessão</strong> e confirme que ainda entra, <em>antes</em> de fechar a primeira.'
            ]
          },
          { p: 'O passo 4 parece paranoia até a primeira vez que salva uma madrugada.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tpf-4-g', kind: 'guiado', title: 'Confira o home da ana e a configuração do sshd',
        body: [
          { p: 'Antes de instalar a chave, veja o que já existe no home da <code>ana</code> e como o <code>sshd</code> está configurado hoje.' },
          { code: ['$ ls -la /home/ana', '$ ls /etc/ssh/sshd_config.d/', '$ sudo sshd -t'] },
          { p: 'Se ainda não existe <code>/home/ana/.ssh</code>, o <code>ls -la</code> simplesmente não mostra essa entrada. O <code>sudo sshd -t</code> valida a configuração atual — vale rodar agora, antes de qualquer mudança, para saber que ela já está válida.' }
        ],
        hints: ['<code>ls -la</code> mostra também os arquivos que começam com ponto, como <code>.ssh</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ls\s+-la?\s+\/home\/ana/), 'Rode <code>ls -la /home/ana</code>.'],
          [() => H.usedCommand(ctx, /ls\s+.*sshd_config\.d/), 'Liste <code>/etc/ssh/sshd_config.d/</code>.'],
          [() => H.usedCommand(ctx, /sshd\s+-t/), 'Valide a configuração atual com <code>sudo sshd -t</code>.']
        ])
      },
      {
        id: 'tpf-4-q', kind: 'quiz', title: 'A permissão errada e o erro que ela não mostra',
        body: [{ p: 'Você instalou a chave da <code>ana</code>, mas deixou o <code>/home/ana/.ssh/authorized_keys</code> com modo <code>644</code> (leitura para todo mundo) em vez de <code>600</code>. O que acontece quando ela tenta entrar?' }],
        options: [
          { text: 'O <code>sshd</code> recusa a autenticação por chave em silêncio: do lado do cliente aparece só "Permission denied (publickey)", sem dizer que o motivo é a permissão do arquivo.', correct: true },
          { text: 'O login funciona normalmente; <code>644</code> ainda dá permissão de leitura ao dono.', why: 'O <code>sshd</code> não aceita <code>authorized_keys</code> com permissão de escrita ou leitura frouxa para grupo/outros, mesmo que o dono continue podendo ler o arquivo.' },
          { text: 'O <code>sshd</code> corrige o modo sozinho na primeira tentativa de login.', why: 'O servidor não altera permissões de arquivo do usuário; ele só recusa autenticar enquanto elas estiverem frouxas.' },
          { text: 'O login funciona, mas fica registrado como inseguro no <code>journalctl</code>.', why: 'Não é um aviso: com permissão frouxa o login por chave simplesmente falha, sem opção de "funcionar com ressalva".' }
        ],
        hints: ['Pense em por que o <code>sshd</code> é tão rígido com quem pode escrever no <code>authorized_keys</code>.'],
        explain: 'Se qualquer pessoa além do dono pudesse ler ou editar o <code>authorized_keys</code>, poderia acrescentar a própria chave e entrar como <code>ana</code>. Por isso o <code>sshd</code> recusa a chave quando o modo é mais frouxo que <code>600</code> — e faz isso sem avisar o motivo no cliente. O diagnóstico mora no log do servidor: <code>sudo journalctl -u ssh -n 20</code>.'
      },
      {
        id: 'tpf-4-a', kind: 'desafio', title: 'A chave da ana',
        body: [
          { p: 'Instale o acesso por chave da <code>ana</code>. Esta é a chave pública dela:' },
          { code: ['ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKprojetofinalanadados2026 ana@notebook'], run: false, lang: 'text' },
          { p: 'Critérios de aceite:' },
          {
            ul: [
              'existe <code>/home/ana/.ssh</code>, com modo <strong>700</strong>, pertencendo à <code>ana</code>;',
              'existe <code>/home/ana/.ssh/authorized_keys</code>, com modo <strong>600</strong>, pertencendo à <code>ana</code>;',
              'o arquivo contém a chave acima, exatamente.'
            ]
          },
          { p: 'Repare que dono e modo fazem parte dos critérios: um <code>authorized_keys</code> com permissão frouxa é ignorado pelo servidor, e o erro que a pessoa recebe não diz nada sobre isso.' }
        ],
        hints: [
          'Você está criando arquivos dentro do home de outra pessoa: eles vão nascer pertencendo ao root se você usar <code>sudo</code>. Corrija com <code>chown -R ana:ana</code> depois.',
          'A sequência é: <code>sudo mkdir -p /home/ana/.ssh</code>, escrever a chave com <code>sudo tee</code>, <code>sudo chown -R ana:ana /home/ana/.ssh</code>, <code>sudo chmod 700</code> no diretório e <code>600</code> no arquivo.'
        ],
        solution: '<p><em>Partindo de uma máquina zerada:</em></p><div class="code"><pre>$ sudo groupadd -f dados\n$ sudo useradd -m -G dados,sudo ana\n$ sudo mkdir -p /home/ana/.ssh\n$ echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKprojetofinalanadados2026 ana@notebook" \\\n    | sudo tee /home/ana/.ssh/authorized_keys &gt; /dev/null\n$ sudo chown -R ana:ana /home/ana/.ssh\n$ sudo chmod 700 /home/ana/.ssh\n$ sudo chmod 600 /home/ana/.ssh/authorized_keys\n$ sudo ls -ld /home/ana/.ssh\n$ sudo ls -l /home/ana/.ssh/authorized_keys</pre></div><p style="margin-top:8px">Três comandos de conteúdo e três de permissão. Na prática, os três últimos são os que decidem se vai funcionar.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const ana = m.userByName('ana');
          const dirModo = H.mode(ctx, '/home/ana/.ssh');
          const arqModo = H.mode(ctx, '/home/ana/.ssh/authorized_keys');
          const dirDono = H.owner(ctx, '/home/ana/.ssh');
          const arqDono = H.owner(ctx, '/home/ana/.ssh/authorized_keys');
          const chaves = ler(ctx, '/home/ana/.ssh/authorized_keys');
          return H.checkAll([
            [!!ana, 'A usuária <code>ana</code> precisa existir (etapa PF.1).'],
            [() => H.isDir(ctx, '/home/ana/.ssh'), 'Falta o diretório <code>/home/ana/.ssh</code>.'],
            [() => (dirDono || {}).user === 'ana', () => `O <code>.ssh</code> precisa pertencer à <code>ana</code>; está com <code>${(dirDono || {}).user}</code>. Provavelmente ele nasceu do <code>sudo</code> — corrija com <code>chown</code>.`],
            [() => dirModo === 0o700, () => `O <code>~/.ssh</code> precisa estar em <code>700</code>; está ${dirModo === null ? 'inexistente' : dirModo.toString(8)}.`],
            [!!chaves.trim(), 'Falta o <code>/home/ana/.ssh/authorized_keys</code>.'],
            [() => (arqDono || {}).user === 'ana', 'O <code>authorized_keys</code> precisa pertencer à <code>ana</code>.'],
            [() => arqModo === 0o600, () => `O <code>authorized_keys</code> precisa estar em <code>600</code>; está ${arqModo === null ? 'inexistente' : arqModo.toString(8)}. Com permissão mais frouxa o servidor ignora a chave em silêncio.`],
            [() => /ssh-ed25519\s+AAAAC3NzaC1lZDI1NTE5AAAAIKprojetofinalanadados2026/.test(chaves), 'A chave pública da ana não está no arquivo — confira se copiou a linha inteira.']
          ]);
        }
      },

    ]
  });

  /* ============================== PF.5 ============================== */
  LX.lesson('mpf1', {
    id: 'lpf-5', n: 'PF.5', title: 'Backup com retenção e restauração testada',
    goal: 'Escrever a rotina que a operação vai depender — e provar que ela restaura, que é a única coisa que importa.',
    body: [
      { h2: 'Continuação do chamado' },
      {
        box: 'note', label: 'Chamado #4471 — parte 5', body: [
          {
            ul: [
              'Precisamos de um <strong>script de backup</strong> em <code>/opt/backup/backup.sh</code> que empacote <code>/srv/projeto</code> em <code>/var/backups/</code>, com a data no nome do arquivo.',
              'O script tem que <strong>parar no primeiro erro</strong> — backup que falha em silêncio é pior que backup nenhum, porque cria confiança falsa.',
              'Precisa de <strong>retenção</strong>: manter no máximo os últimos 7 dias e apagar o resto sozinho. Já tivemos disco cheio por causa de backup.',
              'E precisa gerar uma <strong>soma de verificação</strong> junto, para conferirmos a integridade.',
              'Rodem, confiram a soma e <strong>testem a restauração</strong>.'
            ]
          }
        ]
      },

      { h2: 'Por que <code>set -euo pipefail</code> não é enfeite' },
      { p: 'Um script de backup sem tratamento de erro é o exemplo clássico do problema. Imagine:' },
      {
        code: ['#!/bin/bash', 'cd /srv/projeto', 'tar -czf /var/backups/projeto.tar.gz .'], run: false
      },
      { p: 'Se o <code>cd</code> falhar (diretório renomeado, volume desmontado), o script <strong>continua</strong> e empacota o diretório em que estava. Você fica com um arquivo de backup do tamanho certo, com o nome certo, e conteúdo errado. Só vai descobrir no dia da restauração.' },
      {
        table: {
          head: ['Opção', 'O que faz', 'Por que importa aqui'],
          rows: [
            ['<code>set -e</code>', 'aborta no primeiro comando que retorna erro', 'o <code>cd</code> que falha derruba o script'],
            ['<code>set -u</code>', 'aborta ao usar variável não definida', 'evita <code>rm -rf $DIR/</code> virar <code>rm -rf /</code>'],
            ['<code>set -o pipefail</code>', 'o pipeline falha se qualquer etapa falhar', 'sem isso, só o último comando do pipe conta']
          ]
        }
      },

      { h2: 'A data no nome, e a retenção' },
      { p: 'Backup com nome fixo sobrescreve o anterior — na prática você tem uma cópia só, e ela pode estar corrompida. Com a data no nome você mantém histórico; com retenção, o histórico não cresce para sempre.' },
      { code: ['$ date +%F', '$ echo "/var/backups/projeto-$(date +%F).tar.gz"'] },
      { p: 'O formato <code>%F</code> é <code>AAAA-MM-DD</code>, que tem uma vantagem prática: ordenar alfabeticamente é o mesmo que ordenar cronologicamente. E a retenção é uma linha:' },
      { code: ['$ find /var/backups -name "projeto-*.tar.gz" -mtime +7 -delete'], run: false },
      {
        box: 'key', label: 'A pergunta que fecha a rotina', body: [
          { p: 'Toda rotina de backup precisa responder três coisas: com que frequência, por quanto tempo guardamos, e <strong>quando foi a última vez que testamos restaurar</strong>. As duas primeiras estão no script. A terceira é um passo separado, e é a que quase todo mundo pula.' },
          { p: 'Testar restauração é extrair em um diretório temporário e <strong>comparar com o original</strong>. Se o <code>diff -r</code> não acusa diferença, você tem um backup. Antes disso, você tem um arquivo.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tpf-5-g', kind: 'guiado', title: 'Veja o que já existe em /var/backups e /opt',
        body: [
          { p: 'Antes de escrever o script, confirme que ele ainda não existe e veja o estado atual da pasta de destino.' },
          { code: ['$ ls -la /opt', '$ ls -la /var/backups', '$ ls -ld /srv/projeto'] },
          { p: 'Numa máquina zerada, <code>/var/backups</code> pode nem existir ainda — o próprio script vai criá-la. O <code>ls -ld /srv/projeto</code> confirma que há algo ali para empacotar (das etapas anteriores).' }
        ],
        hints: ['Se um <code>ls</code> reclamar que o caminho não existe, essa é a resposta: ele ainda não foi criado.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ls\s+-la?\s+\/opt/), 'Rode <code>ls -la /opt</code>.'],
          [() => H.usedCommand(ctx, /ls\s+-la?\s+\/var\/backups/), 'Rode <code>ls -la /var/backups</code>.'],
          [() => H.usedCommand(ctx, /ls\s+-ld?\s+\/srv\/projeto/), 'Rode <code>ls -ld /srv/projeto</code>.']
        ])
      },
      {
        id: 'tpf-5-q', kind: 'quiz', title: 'Uma última decisão',
        body: [{ p: 'Seis meses depois, o disco de <code>srv-aula</code> enche. Você descobre que <code>/var/backups</code> tem 180 arquivos <code>projeto-AAAA-MM-DD.tar.gz</code> — a retenção nunca foi aplicada. Qual é a correção certa?' }],
        options: [
          { text: 'Aplicar a política de retenção que já estava especificada: manter N gerações e apagar o resto automaticamente, dentro do script ou via logrotate.', correct: true },
          { text: 'Apagar os backups antigos manualmente sempre que o disco encher.', why: 'Resolve hoje e volta a acontecer. Trabalho manual recorrente é sintoma de automação faltando.' },
          { text: 'Tirar a data do nome, para o arquivo ser sobrescrito todo dia.', why: 'Isso troca um problema de espaço por um muito pior: você passa a ter uma cópia só, e se ela estiver corrompida não há para onde voltar.' },
          { text: 'Parar de fazer backup de <code>/srv/projeto</code>, já que a equipe tem cópias locais.', why: 'Cópia local na máquina de alguém não é backup: não tem histórico, não é verificada e some junto com o notebook.' }
        ],
        explain: 'Backup sem política de retenção é backup pela metade — e o mais irônico é que ele acaba derrubando o servidor que deveria proteger. As três perguntas que toda rotina precisa responder são: por quanto tempo guardamos, onde a cópia fica (de preferência <strong>fora desta máquina</strong>) e quando foi a última vez que testamos restaurar. Repare que o chamado desta etapa cobriu as três — inclusive a terceira, que é a que quase todo projeto real esquece.'
      },
      {
        id: 'tpf-5-a', kind: 'desafio', title: 'A rotina de backup',
        body: [
          { p: 'Critérios de aceite:' },
          {
            ul: [
              'existe <code>/opt/backup/backup.sh</code>, executável, com shebang;',
              'o script usa <code>set -euo pipefail</code>;',
              'ele gera um <code>.tar.gz</code> em <code>/var/backups/</code> cujo nome contém a data no formato <code>AAAA-MM-DD</code> e o conteúdo de <code>/srv/projeto</code>;',
              'ele gera também <code>/var/backups/SHA256SUMS</code> com a soma do arquivo criado;',
              'ele aplica retenção, apagando os backups com mais de 7 dias;',
              'você rodou o script e o arquivo está lá.'
            ]
          },
          { p: 'Antes de rodar, garanta que há algo dentro de <code>/srv/projeto</code> para empacotar.' }
        ],
        hints: [
          'O nome do arquivo precisa ser calculado dentro do script, com substituição de comando — não escrito fixo.',
          'Uma variável ajuda: <code>DESTINO="/var/backups/projeto-$(date +%F).tar.gz"</code> e depois <code>tar -czf "$DESTINO" -C /srv projeto</code>. O <code>-C /srv projeto</code> guarda o caminho relativo, e não <code>/srv/projeto</code> — restauração fica muito mais simples. Gere a soma de dentro de <code>/var/backups</code>.'
        ],
        solution: '<p><em>Garantindo que há conteúdo para empacotar:</em></p><div class="code"><pre>$ sudo mkdir -p /srv/projeto/publico /var/backups /opt/backup\n$ echo "dados da equipe" | sudo tee /srv/projeto/publico/leiame.txt &gt; /dev/null</pre></div><p>E a rotina:</p><div class="code"><pre>$ sudo tee /opt/backup/backup.sh &gt; /dev/null &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\n\nORIGEM=/srv/projeto\nDESTINO=/var/backups\nD=$(date +%F)\nARQ="$DESTINO/projeto-$D.tar.gz"\n\nmkdir -p "$DESTINO"\ntar -czf "$ARQ" -C "$(dirname "$ORIGEM")" "$(basename "$ORIGEM")"\n\ncd "$DESTINO"\nsha256sum "projeto-$D.tar.gz" &gt; SHA256SUMS\n\nfind "$DESTINO" -name "projeto-*.tar.gz" -mtime +7 -delete\necho "backup gerado: $ARQ"\nEOF\n$ sudo chmod 755 /opt/backup/backup.sh\n$ sudo /opt/backup/backup.sh\n$ ls -lh /var/backups/</pre></div><p style="margin-top:8px">Ordem: gerar, somar, expirar. O <code>-C</code> troca o diretório antes de empacotar, então o arquivo guarda <code>projeto/…</code> em vez de <code>srv/projeto/…</code>.</p>',
        check: async (ctx) => {
          const s = ler(ctx, '/opt/backup/backup.sh');
          const lista = (H.ls(ctx, '/var/backups') || []).map(x => (typeof x === 'string' ? x : x.name));
          const backup = lista.find(n => /^projeto-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(n));
          const sums = ler(ctx, '/var/backups/SHA256SUMS');
          const confere = (sums && ctx.run) ? await rodar(ctx, 'cd /var/backups && sha256sum -c SHA256SUMS 2>&1') : '';
          return H.checkAll([
            [() => H.isFile(ctx, '/opt/backup/backup.sh'), 'Não encontrei <code>/opt/backup/backup.sh</code>.'],
            [() => (H.mode(ctx, '/opt/backup/backup.sh') & 0o111) !== 0, 'O script não está executável.'],
            [() => /^#!/.test(s), 'Falta o shebang na primeira linha.'],
            [() => /set\s+-[a-z]*e/.test(s), 'O chamado pede que o script pare no primeiro erro: falta <code>set -e</code>.'],
            [() => /pipefail/.test(s), 'Falta <code>set -o pipefail</code> (pode vir junto: <code>set -euo pipefail</code>).'],
            [() => /set\s+-[a-z]*u/.test(s), 'Falta o <code>-u</code>, que aborta ao usar variável não definida.'],
            [() => /srv\/projeto/.test(s), 'O script não menciona <code>/srv/projeto</code> — é isso que precisa ser empacotado.'],
            [() => /date/.test(s), 'O nome do arquivo precisa ser calculado com a data, não escrito fixo.'],
            [() => /sha256sum/.test(s), 'O script precisa gerar a soma de verificação.'],
            [() => /-mtime\s*\+7/.test(s) && /(-delete|rm\b)/.test(s), 'Falta a retenção: apagar os backups com mais de 7 dias (<code>find ... -mtime +7 -delete</code>).'],
            [!!backup, 'Não achei nenhum <code>/var/backups/projeto-AAAA-MM-DD.tar.gz</code>. Rode o script: <code>sudo /opt/backup/backup.sh</code>.'],
            [() => { const c = ler(ctx, '/var/backups/' + backup); return /projeto/.test(c); }, 'O arquivo de backup existe mas parece vazio ou sem o conteúdo de <code>/srv/projeto</code>.'],
            [!!sums, 'Falta o <code>/var/backups/SHA256SUMS</code>.'],
            [() => /: OK$/m.test(confere), 'O <code>sha256sum -c</code> não valida o backup. Gere a soma com o comando, de dentro de <code>/var/backups</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== PF.6 ============================== */
  LX.lesson('mpf1', {
    id: 'lpf-6', n: 'PF.6', title: 'O incidente',
    goal: 'Aplicar o método de diagnóstico num problema que você não plantou, usando texto, pipes, processos e pacotes — e deixar a máquina funcionando.',
    setup: (m) => {
      try {
        const ctx = m.ctxRoot();
        /* três defeitos plantados, de naturezas diferentes */
        m.fs.mkdirp('/var/log/coletor', { ctx });
        for (let i = 1; i <= 8; i++) {
          const n = m.fs.writeFile(`/var/log/coletor/coleta-${i}.log`,
            Array.from({ length: 400 }, (_, k) =>
              `2026-09-0${(i % 9) + 1} 03:1${k % 10}:22 coletor ${k % 7 === 0 ? 'ERROR conexao recusada pelo destino' : (k % 5 === 0 ? 'WARN latencia alta' : 'INFO coleta ok')}`
            ).join('\n') + '\n', { ctx });
          n.mode = 0o644;
        }
        /* um binário SUID que não veio de pacote nenhum */
        m.fs.mkdirp('/usr/local/bin', { ctx });
        const b = m.fs.writeFile('/usr/local/bin/atalho', '#!/bin/bash\nexec /bin/bash "$@"\n', { ctx });
        b.mode = 0o4755; b.uid = 0; b.gid = 0;
      } catch (e) { }
    },
    body: [
      { h2: 'O chamado de madrugada' },
      {
        box: 'note', label: 'Chamado #4488 — urgente', body: [
          { p: '"O monitoramento acusou <code>/var</code> passando de 80%. Além disso, alguém comentou que apareceu um executável estranho em <code>/usr/local/bin</code> e ninguém sabe de onde veio. Investiga e resolve?"' }
        ]
      },
      { p: 'Duas queixas, dois escopos diferentes. Pelo método da aula 17.1, elas se investigam <strong>separadamente</strong> — tratar como "a máquina está estranha" leva a mexer em tudo e entender nada.' },

      { h2: 'O que você já sabe fazer' },
      { p: 'Esta etapa não ensina nada novo. Ela cobra, junto, o que está espalhado por seis módulos:' },
      {
        table: {
          head: ['Pergunta', 'Ferramenta', 'Módulo'],
          rows: [
            ['Quem está ocupando o disco?', '<code>du | sort -rh | head</code>', '11, 16'],
            ['Que tipos de mensagem tem no log, e quantas?', '<code>grep</code>, <code>awk</code>, <code>sort</code>, <code>uniq -c</code>', '3, 4'],
            ['Este binário veio de algum pacote?', '<code>dpkg -S</code>', '12'],
            ['Ele tem bit especial?', '<code>ls -l</code>, <code>find -perm</code>', '5'],
            ['O que impede o log de crescer de novo?', '<code>logrotate</code>', '16'],
            ['Como registrar o que foi feito?', 'o relatório', '17']
          ]
        }
      },
      {
        box: 'key', label: 'Sobre o binário SUID', body: [
          { p: 'Um executável com o bit <strong>SUID</strong> roda com os privilégios do <em>dono</em>, não de quem o executou. Um <code>/usr/local/bin/atalho</code> SUID de root que abre um shell é, literalmente, uma porta dos fundos: qualquer usuário da máquina vira root chamando ele.' },
          { p: 'Dois sinais deveriam ter disparado o alarme: ele está em <code>/usr/local/bin</code> (território de instalação manual, fora do <code>dpkg</code>) e tem SUID. Nenhum dos dois é prova de malícia isolado — juntos, exigem explicação.' },
          { p: 'A correção mínima e segura é <strong>tirar o SUID</strong> (<code>chmod u-s</code>), não apagar: preserva-se a evidência para investigar depois de onde veio.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tpf-6-g', kind: 'guiado', title: 'Separe as duas queixas e olhe cada uma',
        body: [
          { p: 'O chamado tem duas queixas de naturezas diferentes. Investigue cada uma isoladamente, sem tentar resolver ainda.' },
          { code: ['$ sudo du -sh /var/log/* | sort -rh | head -5', '$ sudo find /usr/local/bin -perm -4000 -type f', '$ dpkg -S /usr/local/bin/atalho'] },
          { p: 'O <code>du</code> mostra qual subdiretório de <code>/var/log</code> está pesando. O <code>find -perm -4000</code> lista executáveis com o bit SUID ligado. E o <code>dpkg -S</code> nesse caminho específico não encontra nenhum pacote — é o sinal de que ele não veio de uma instalação normal.' }
        ],
        hints: ['Rode um comando de cada vez e leia a saída antes do próximo — é assim que o método da aula 17.1 funciona.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /du\s+-sh\s+\/var\/log/), 'Rode <code>sudo du -sh /var/log/* | sort -rh</code> para ver quem pesa em <code>/var/log</code>.'],
          [() => H.usedCommand(ctx, /find\s+\/usr\/local\/bin\s+-perm\s+-4000/), 'Rode <code>sudo find /usr/local/bin -perm -4000 -type f</code> para achar binários SUID.'],
          [() => H.usedCommand(ctx, /dpkg\s+-S/), 'Rode <code>dpkg -S</code> no caminho do executável suspeito para ver se ele veio de algum pacote.']
        ])
      },
      {
        id: 'tpf-6-q', kind: 'quiz', title: 'Por que não apagar o binário suspeito',
        body: [{ p: 'Você achou o <code>/usr/local/bin/atalho</code>, um binário SUID de root que não pertence a nenhum pacote. A correção recomendada é tirar o bit SUID (<code>chmod u-s</code>), e não apagar o arquivo. Por quê?' }],
        options: [
          { text: 'Tirar o SUID já neutraliza o risco — ninguém mais vira root ao executá-lo — e preserva o arquivo como evidência, para investigar depois de onde ele veio e quem o colocou lá.', correct: true },
          { text: 'Apagar o arquivo quebraria pacotes que dependem dele.', why: 'O próprio <code>dpkg -S</code> mostrou que esse caminho não pertence a nenhum pacote — não há dependência de pacote nenhum ali.' },
          { text: '<code>chmod u-s</code> também impede que o arquivo seja lido ou copiado depois, o que apagar não faria.', why: 'Tirar o SUID só afeta o bit especial de execução com privilégio; o arquivo continua legível e copiável normalmente.' },
          { text: 'Sem o arquivo no disco, o <code>systemctl</code> teria que ser reiniciado para a máquina voltar ao normal.', why: 'Esse binário não é gerenciado pelo systemd; removê-lo ou alterar seu modo não tem relação com reiniciar serviços.' }
        ],
        hints: ['Pense na diferença entre "conter o risco agora" e "investigar a causa depois" — apagar a evidência dificulta a segunda parte.'],
        explain: 'O bit SUID é o que torna o binário perigoso: com ele, qualquer usuário que o executa vira root. Removê-lo (<code>chmod u-s</code>) elimina esse risco imediatamente. Apagar o arquivo resolveria o sintoma, mas destruiria a evidência — de onde veio, quando foi criado, o que mais ele faz — que uma investigação de segurança de verdade precisa preservar.'
      },
      {
        id: 'tpf-6-a', kind: 'desafio', title: 'Diagnóstico do incidente',
        body: [
          { p: 'Investigue e produza <code>~/incidente-4488.txt</code> com <strong>exatamente estas quatro linhas</strong>, nesta ordem:' },
          {
            code: [
              'DIRETORIO: <o caminho do maior consumidor dentro de /var/log>',
              'ERROS: <quantas linhas contêm ERROR nos logs desse diretório>',
              'AVISOS: <quantas linhas contêm WARN nos logs desse diretório>',
              'SUID: <o caminho do executável SUID que não pertence a nenhum pacote>'
            ], run: false, lang: 'text'
          },
          { p: 'Todos os números precisam sair de comando. O verificador vai recontar tudo.' }
        ],
        hints: [
          'Para o maior consumidor: <code>sudo du -sh /var/log/* | sort -rh | head -1</code> — mas a linha do relatório quer só o caminho, não o tamanho.',
          'Para contar ocorrências em vários arquivos de uma vez: <code>grep -rc</code> soma por arquivo, então prefira <code>grep -rh ERROR /var/log/coletor | wc -l</code>. Para o SUID: <code>find /usr/local/bin -perm -4000 -type f</code>.'
        ],
        solution: '<div class="code"><pre>$ sudo du -sh /var/log/* | sort -rh | head -3\n$ sudo find /usr/local/bin -perm -4000 -type f\n$ dpkg -S /usr/local/bin/atalho\n\n$ D=/var/log/coletor\n$ E=$(sudo grep -rh "ERROR" "$D" | wc -l)\n$ W=$(sudo grep -rh "WARN" "$D" | wc -l)\n$ S=$(sudo find /usr/local/bin -perm -4000 -type f | head -1)\n\n$ printf \'DIRETORIO: %s\\nERROS: %s\\nAVISOS: %s\\nSUID: %s\\n\' "$D" "$E" "$W" "$S" &gt; ~/incidente-4488.txt\n$ cat ~/incidente-4488.txt</pre></div><p style="margin-top:8px">Repare que nenhum número foi digitado: cada um veio de um comando guardado numa variável. É isso que faz o relatório continuar verdadeiro amanhã, quando os números mudarem.</p>',
        forja: ["printf 'DIRETORIO: /var/log/coletor\\nERROS: 100\\nAVISOS: 100\\nSUID: /usr/local/bin/atalho\\n' > ~/incidente-4488.txt"],
        check: async (ctx) => {
          const rel = ler(ctx, '/home/aluno/incidente-4488.txt');
          if (!rel.trim()) return { ok: false, msg: 'O arquivo <code>~/incidente-4488.txt</code> ainda não existe.' };
          const l = rel.split('\n').map(x => x.trim()).filter(Boolean);
          const val = (i) => (l[i] || '').split(/:\s*/).slice(1).join(':').trim();
          /* o verificador reconta tudo na máquina */
          const erros = (await rodar(ctx, 'sudo grep -rh "ERROR" /var/log/coletor 2>/dev/null | wc -l')).trim();
          const avisos = (await rodar(ctx, 'sudo grep -rh "WARN" /var/log/coletor 2>/dev/null | wc -l')).trim();
          const suid = (await rodar(ctx, 'sudo find /usr/local/bin -perm -4000 -type f 2>/dev/null')).trim().split('\n')[0];
          return H.checkAll([
            [() => l.length === 4, () => `O relatório deve ter exatamente 4 linhas; tem ${l.length}.`],
            [() => /^DIRETORIO:/.test(l[0] || ''), 'A primeira linha deve começar com <code>DIRETORIO:</code>.'],
            [() => val(0) === '/var/log/coletor', () => `O maior consumidor de <code>/var/log</code> é <code>/var/log/coletor</code>; o relatório diz <code>${val(0)}</code>. Desça com <code>du -sh /var/log/* | sort -rh</code>.`],
            [() => /^ERROS:\s*\d+$/.test(l[1] || ''), 'A segunda linha deve ser <code>ERROS: &lt;número&gt;</code>.'],
            [() => val(1) === erros, () => `A contagem de erros não bate: o <code>grep</code> encontra ${erros} linhas com ERROR, e o relatório diz ${val(1)}.`],
            [() => /^AVISOS:\s*\d+$/.test(l[2] || ''), 'A terceira linha deve ser <code>AVISOS: &lt;número&gt;</code>.'],
            [() => val(2) === avisos, () => `A contagem de avisos não bate: são ${avisos} linhas com WARN, e o relatório diz ${val(2)}.`],
            [() => /^SUID:/.test(l[3] || ''), 'A quarta linha deve começar com <code>SUID:</code>.'],
            [() => !!suid && val(3) === suid, () => `O executável SUID sem pacote é <code>${suid || '(nenhum encontrado)'}</code>; o relatório diz <code>${val(3)}</code>. Procure com <code>find /usr/local/bin -perm -4000 -type f</code>.`]
          ]);
        }
      }
    ]
  });

  /* ============================== PF.7 ============================== */
  LX.lesson('mpf1', {
    id: 'lpf-7', n: 'PF.7', title: 'A entrega',
    goal: 'Fechar o chamado com um relatório que prova cada item — com saída de comando, não com afirmação.',
    body: [
      { h2: 'Por que o relatório importa' },
      { p: 'Todo trabalho de infraestrutura termina em um registro do que mudou. Não é burocracia: é o que a pessoa do plantão vai ler às três da manhã quando algo quebrar, e é o que permite a outra pessoa <em>verificar</em> o que você fez sem refazer tudo.' },
      { p: 'A regra que separa um relatório útil de um inútil: <strong>evidência, não afirmação</strong>. "Configurei o firewall corretamente" não é verificável. A saída de <code>ufw status verbose</code> é.' },
      {
        box: 'key', label: 'Este relatório é conferido de verdade', body: [
          { p: 'O verificador desta etapa não procura palavras-chave. Ele <strong>reexecuta os comandos</strong> na máquina e compara a saída com o que está no seu arquivo. Um relatório escrito à mão, por mais correto que pareça, não passa — e é exatamente essa a diferença entre dizer e provar.' }
        ]
      },

      { h2: 'O sudo e o redirecionamento' },
      { p: 'Você vai gravar em um arquivo do <code>root</code>, e aí aparece a pegadinha clássica:' },
      { code: ['# NÃO funciona: quem abre o arquivo é o SEU shell, sem privilégio', 'sudo comando > /root/entrega.txt', '', '# funciona: o tee roda com sudo, e é ele que abre o arquivo', 'comando | sudo tee -a /root/entrega.txt'], run: false },
      { p: 'O redirecionamento <code>&gt;</code> é interpretado pelo shell <em>antes</em> de o <code>sudo</code> sequer existir. O <code>sudo</code> se aplica ao comando, nunca ao redirecionamento.' }
    ],
    tasks: [
      {
        id: 'tpf-7-g', kind: 'guiado', title: 'Rode os seis comandos do relatório, ainda soltos',
        body: [
          { p: 'Antes de montar o arquivo, rode os seis comandos que vão compor o relatório e veja a saída de cada um isoladamente — é assim que você percebe se algum item ainda não está pronto.' },
          {
            code: [
              '$ getent group dados',
              '$ findmnt -n /srv/projeto',
              '$ systemctl is-enabled coletor',
              '$ sudo ufw status verbose',
              '$ ls -l /var/backups',
              '$ ls -l /usr/local/bin/atalho'
            ]
          },
          { p: 'Se algum desses comandos vier vazio ou com erro, essa etapa do chamado ainda não está fechada — volte para ela antes de montar o relatório.' }
        ],
        hints: ['Rode um comando por vez; o objetivo aqui é só conferir, não montar o arquivo ainda.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /getent\s+group\s+dados/), 'Rode <code>getent group dados</code>.'],
          [() => H.usedCommand(ctx, /findmnt\s+-n\s+\/srv\/projeto/), 'Rode <code>findmnt -n /srv/projeto</code>.'],
          [() => H.usedCommand(ctx, /systemctl\s+is-enabled\s+coletor/), 'Rode <code>systemctl is-enabled coletor</code>.'],
          [() => H.usedCommand(ctx, /ufw\s+status\s+verbose/), 'Rode <code>sudo ufw status verbose</code>.'],
          [() => H.usedCommand(ctx, /ls\s+-l\s+\/var\/backups/), 'Rode <code>ls -l /var/backups</code>.'],
          [() => H.usedCommand(ctx, /ls\s+-l\s+\/usr\/local\/bin\/atalho/), 'Rode <code>ls -l /usr/local/bin/atalho</code>.']
        ])
      },
      {
        id: 'tpf-7-q', kind: 'quiz', title: 'Fechando o chamado',
        body: [
          { p: 'O servidor está entregue e funcionando. Qual destes itens ainda <strong>não</strong> foi resolvido por nada do que você fez neste projeto?' }
        ],
        options: [
          { text: 'O backup continua na mesma máquina: se ela for perdida, os backups vão junto. Falta uma cópia fora do servidor.', correct: true },
          { text: 'O serviço <code>coletor</code> pode morrer e não voltar.', why: 'O <code>Restart=</code> na unit cobre exatamente isso — e o <code>enable</code> garante que ele volta depois de um reboot.' },
          { text: 'Uma pessoa fora do grupo <code>dados</code> pode ler os arquivos do projeto.', why: 'O modo <code>2770</code> em <code>/srv/projeto</code> fecha o diretório para outros, e a montagem com <code>noexec,nosuid</code> ainda reduz o estrago de um arquivo malicioso ali.' },
          { text: 'O log do coletor pode encher o disco de novo.', why: 'A regra de logrotate criada na PF.6 limita a cinco gerações comprimidas. É justamente o controle que faltava quando o incidente aconteceu.' }
        ],
        explain: 'Este é o limite honesto do projeto — e vale terminar sabendo dele. A regra 3-2-1 pede três cópias, em dois lugares e <strong>uma fora do site</strong>. Tudo o que foi construído aqui vive em <code>srv-aula</code>: se a máquina for destruída, comprometida por ransomware ou simplesmente perdida, o backup vai junto. O próximo chamado, na vida real, seria enviar as cópias para outro destino — e depois testar a restauração <em>a partir de lá</em>.'
      },
      {
        id: 'tpf-7-a', kind: 'desafio', title: 'Relatório de entrega',
        body: [
          { p: 'Gere <code>/root/entrega.txt</code> reunindo a <strong>saída real</strong> destes seis comandos, nesta ordem, sem editar nada à mão:' },
          {
            code: [
              'getent group dados',
              'findmnt -n /srv/projeto',
              'systemctl is-enabled coletor',
              'ufw status verbose',
              'ls -l /var/backups',
              'ls -l /usr/local/bin/atalho'
            ], run: false, lang: 'text'
          },
          { p: 'Cada bloco precisa aparecer inteiro. O verificador vai rodar os mesmos comandos e conferir se o conteúdo bate — inclusive o GID do grupo, o UUID da montagem e o nome exato do arquivo de backup.' }
        ],
        hints: [
          'O primeiro comando cria o arquivo, os demais acrescentam: <code>comando | sudo tee /root/entrega.txt</code> e depois <code>comando | sudo tee -a /root/entrega.txt</code> — repare no <code>-a</code>.',
          'Alguns comandos precisam de sudo para produzir a saída completa (<code>ufw status</code>, por exemplo). Nesse caso são dois sudos na mesma linha: <code>sudo ufw status verbose | sudo tee -a /root/entrega.txt</code>.'
        ],
        solution: '<p><em>O relatório só faz sentido com o servidor inteiro de pé. Este bloco reconstrói as seis etapas anteriores — é, na prática, o projeto todo:</em></p><div class="code"><pre>$ sudo groupadd -f dados\n$ sudo useradd -m -G dados,sudo ana\n$ sudo useradd -m -G dados bruno\n$ sudo parted -s /dev/vdb mklabel gpt\n$ sudo parted -s /dev/vdb mkpart projeto ext4 0% 100%\n$ sudo mkfs.ext4 -L PROJETO /dev/vdb1\n$ sudo mkdir -p /srv/projeto\n$ U=$(sudo blkid -s UUID -o value /dev/vdb1); echo "UUID=$U /srv/projeto ext4 defaults,nofail,noexec,nosuid,nodev 0 2" | sudo tee -a /etc/fstab &gt; /dev/null\n$ sudo mount -a\n$ sudo mkdir -p /srv/projeto/publico /srv/projeto/segredo /opt/coletor /opt/backup /var/backups /usr/local/bin\n$ echo dados | sudo tee /srv/projeto/publico/leiame.txt &gt; /dev/null\n$ sudo chown -R root:dados /srv/projeto\n$ sudo chmod 2770 /srv/projeto\n$ sudo useradd --system --shell /usr/sbin/nologin coletor\n$ printf \'#!/bin/bash\\nwhile true; do echo coleta &gt;&gt; /var/log/coletor.log; sleep 60; done\\n\' | sudo tee /opt/coletor/coletar.sh &gt; /dev/null\n$ sudo chmod 755 /opt/coletor/coletar.sh\n$ printf \'[Unit]\\nDescription=Coletor\\n\\n[Service]\\nType=simple\\nUser=coletor\\nExecStart=/opt/coletor/coletar.sh\\nRestart=always\\n\\n[Install]\\nWantedBy=multi-user.target\\n\' | sudo tee /etc/systemd/system/coletor.service &gt; /dev/null\n$ sudo systemctl daemon-reload\n$ sudo systemctl enable --now coletor\n$ sudo ufw default deny incoming\n$ sudo ufw allow 22/tcp\n$ sudo ufw allow 8080/tcp\n$ sudo ufw enable\n$ printf \'#!/bin/bash\\nset -euo pipefail\\nD=$(date +%F)\\ntar -czf "/var/backups/projeto-$D.tar.gz" -C /srv projeto\\n\' | sudo tee /opt/backup/backup.sh &gt; /dev/null\n$ sudo chmod 755 /opt/backup/backup.sh\n$ sudo /opt/backup/backup.sh\n$ printf \'#!/bin/bash\\n\' | sudo tee /usr/local/bin/atalho &gt; /dev/null\n$ sudo chmod 755 /usr/local/bin/atalho</pre></div><p>E o relatório:</p><div class="code"><pre>$ getent group dados | sudo tee /root/entrega.txt\n$ findmnt -n /srv/projeto | sudo tee -a /root/entrega.txt\n$ systemctl is-enabled coletor | sudo tee -a /root/entrega.txt\n$ sudo ufw status verbose | sudo tee -a /root/entrega.txt\n$ ls -l /var/backups | sudo tee -a /root/entrega.txt\n$ ls -l /usr/local/bin/atalho | sudo tee -a /root/entrega.txt\n$ sudo cat /root/entrega.txt</pre></div><p style="margin-top:8px">Seis comandos, seis evidências. Quem receber esse arquivo consegue conferir cada item do chamado sem precisar entrar na máquina — e, se precisar entrar, sabe exatamente o que esperar encontrar.</p>',
        forja: ["printf 'dados:x:1002:ana,bruno\\n/srv/projeto /dev/vdb1 ext4 rw\\nenabled\\nStatus: active\\ntotal 4\\n-rwxr-xr-x 1 root root 0 atalho\\n' | sudo tee /root/entrega.txt > /dev/null"],
        check: async (ctx) => {
          const rel = ler(ctx, '/root/entrega.txt');
          if (!rel.trim()) return { ok: false, msg: 'O arquivo <code>/root/entrega.txt</code> ainda não existe.' };
          const m = ctx.machine || ctx.sh.m;
          /* o verificador roda os mesmos comandos e compara com o relatório */
          const grupo = (await rodar(ctx, 'getent group dados')).trim();
          const montagem = (await rodar(ctx, 'findmnt -n /srv/projeto 2>/dev/null')).trim();
          const backups = (H.ls(ctx, '/var/backups') || []).map(x => (typeof x === 'string' ? x : x.name))
            .filter(n => /^projeto-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(n));
          const un = unidade(ctx, 'coletor');
          const f = m.firewall || {};
          const modoAtalho = H.mode(ctx, '/usr/local/bin/atalho');
          const semEspaco = (s) => String(s).replace(/\s+/g, ' ').trim();
          const relLimpo = semEspaco(rel);
          return H.checkAll([
            [!!grupo, 'O grupo <code>dados</code> precisa existir (etapa PF.1).'],
            [() => relLimpo.includes(semEspaco(grupo)), () => `A linha do grupo não bate com a máquina. O <code>getent group dados</code> devolve: <code>${grupo}</code>. Redirecione a saída do comando em vez de escrever.`],
            [!!montagem, 'O <code>/srv/projeto</code> não está montado (etapa PF.2) — o <code>findmnt</code> não devolve nada.'],
            [() => relLimpo.includes(semEspaco(montagem.split('\n')[0])), 'A linha da montagem não bate com a saída real do <code>findmnt -n /srv/projeto</code>.'],
            [() => !!un && un.enabled === true, 'O serviço <code>coletor</code> precisa estar habilitado (etapa PF.3).'],
            [() => /\benabled\b/.test(rel), 'Falta a saída de <code>systemctl is-enabled coletor</code> no relatório.'],
            [() => f.enabled === true, 'O firewall precisa estar ativo (etapa PF.3).'],
            [() => /Status:\s*active/.test(rel), 'Falta a saída de <code>ufw status verbose</code> mostrando <code>Status: active</code>.'],
            [() => new RegExp('Default:\\s*' + String(f.defaultIn)).test(rel), () => `A linha de política padrão do firewall não bate. O <code>ufw status verbose</code> mostra <code>Default: ${f.defaultIn} (incoming)</code>.`],
            [() => /\b22\b/.test(rel) && /\b8080\b/.test(rel), 'O relatório deve conter as regras das portas 22 e 8080 vindas do <code>ufw status</code>.'],
            [() => backups.length > 0, 'Não há backup em <code>/var/backups</code> (etapa PF.5).'],
            [() => backups.some(n => rel.includes(n)), () => `O relatório deve conter a listagem de <code>/var/backups</code> com o arquivo <code>${backups[0]}</code>.`],
            [() => modoAtalho !== null, 'O <code>/usr/local/bin/atalho</code> precisa continuar existindo (etapa PF.6).'],
            [() => (modoAtalho & 0o4000) === 0, 'O bit SUID do <code>/usr/local/bin/atalho</code> ainda está ligado (etapa PF.6).'],
            [() => /atalho/.test(rel) && /-rwx/.test(rel), 'Falta a listagem <code>ls -l /usr/local/bin/atalho</code> no relatório — é ela que prova que o SUID foi removido e o arquivo preservado.'],
            [() => !/rws/.test(rel.split('\n').filter(x => /atalho/.test(x)).join('')), 'A listagem do <code>atalho</code> ainda mostra <code>rws</code> — gere o relatório <em>depois</em> de remover o SUID.']
          ]);
        }
      }
    ]
  });
})();
