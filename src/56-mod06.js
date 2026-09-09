/* =========================================================================
   MÓDULO 6 — Usuários e grupos
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 6.1 ============================== */
  LX.lesson('m06', {
    id: 'l6-1', n: '6.1', title: 'O que é uma conta: UID, GID e identidade',
    goal: 'Entender que "usuário" é um número com uma linha de texto ao lado — e por que essa simplicidade explica tanto comportamento estranho.',
    body: [
      { lede: 'Para o kernel não existem nomes. Existe o número 1000 tentando abrir um arquivo cujo dono é o número 0. Os nomes existem para nós.' },
      { p: 'Uma conta no Linux é a combinação de:' },
      {
        ul: [
          'um <strong>UID</strong> (identificador numérico do usuário);',
          'um <strong>GID primário</strong> (o grupo que ele "carrega" ao criar arquivos);',
          'uma lista de <strong>grupos secundários</strong>;',
          'um diretório pessoal e um shell de login;',
          'uma credencial de autenticação (senha ou chave), guardada em outro lugar.'
        ]
      },
      { p: 'Confira a sua:' },
      { code: ['$ id', '$ id -u', '$ id -g', '$ id -G', '$ groups'] },

      { h2: 'A faixa de números diz o que a conta é' },
      {
        table: {
          head: ['Faixa de UID', 'Tipo', 'Exemplos'],
          rows: [
            ['<strong>0</strong>', 'superusuário', '<code>root</code>'],
            ['<strong>1–999</strong>', 'contas de sistema/serviço', '<code>daemon</code>, <code>www-data</code>, <code>sshd</code>, <code>systemd-network</code>'],
            ['<strong>1000+</strong>', 'pessoas', '<code>aluno</code>, <code>ana</code>'],
            ['<strong>65534</strong>', '<code>nobody</code>', 'identidade sem privilégio, usada em mapeamentos']
          ]
        }
      },
      { p: 'A faixa é convenção, definida em <code>/etc/login.defs</code> (<code>UID_MIN</code>, <code>UID_MAX</code>, <code>SYS_UID_MIN</code>). O kernel não se importa: o que ele trata de forma especial é apenas o UID 0.' },
      {
        box: 'key', body: [
          { p: 'Como a permissão é gravada como <strong>número</strong>, dois sistemas diferentes com o mesmo UID são "a mesma pessoa" para os arquivos. É por isso que um HD externo ou um volume de container pode aparecer com arquivos "do usuário errado": o UID 1000 daqui não é o UID 1000 de lá. Esse detalhe volta com força no módulo de volumes do Docker.' }
        ]
      },
      { p: 'Veja acontecendo — crie um arquivo, mude o dono para um UID que não existe e observe o <code>ls</code>:' },
      {
        code: [
          '$ cd ~ && touch orfao.txt && sudo chown 4242 orfao.txt',
          '$ ls -l orfao.txt',
          '$ stat -c "%u %U %n" orfao.txt'
        ]
      },
      { p: 'O <code>ls</code> mostra o número porque não achou nome correspondente. O arquivo não está corrompido: só não existe tradução para aquele UID nesta máquina.' },

      { h2: 'Grupo primário × grupos secundários' },
      {
        ascii: `usuário ana
  │
  ├── grupo PRIMÁRIO (GID em /etc/passwd) ── grava nos arquivos que ela cria
  │      └─ ana (1001)
  │
  └── grupos SECUNDÁRIOS (listados em /etc/group) ── só concedem acesso
         ├─ devs   (1500)
         └─ docker (999)`
      },
      { p: 'A diferença prática: o grupo <strong>primário</strong> é o que fica gravado nos arquivos novos; os <strong>secundários</strong> apenas ampliam o que você pode acessar. O <code>id</code> mostra os dois — o primário é o <code>gid=</code>, os demais aparecem em <code>groups=</code>.' },
      {
        box: 'note', label: 'UPG: um grupo por usuário', body: [
          { p: 'Debian, Ubuntu, Fedora e derivados criam, para cada pessoa, um grupo com o mesmo nome e apenas ela dentro. Parece redundante, mas permite usar <code>umask 002</code> com segurança: "grupo pode escrever" significa "só eu", até que alguém seja adicionado deliberadamente àquele grupo.' }
        ]
      },
      { p: 'Compare a diferença entre "o sistema todo" e "eu":' },
      { code: ['$ id -un && id -gn', '$ getent passwd aluno', '$ getent group aluno'] }
    ],
    tasks: [
      {
        id: 't6-1-a', kind: 'guiado', title: 'Descubra quem você é (numericamente)',
        body: [
          { p: 'Percorra os três níveis: você, as contas do sistema e um arquivo órfão.' },
          {
            code: [
              '$ id && groups',
              '$ getent passwd | awk -F: \'$3 >= 1000 && $3 < 60000 {print $1, $3}\'',
              '$ getent passwd | awk -F: \'$3 < 1000 {print $1, $3}\' | head -8',
              '$ cd ~ && touch orfao.txt && sudo chown 4242 orfao.txt && ls -l orfao.txt'
            ]
          },
          { p: 'Repare como as contas de serviço ocupam os números baixos e não têm shell de verdade.' }
        ],
        hints: ['O terceiro campo de <code>/etc/passwd</code> é o UID; o <code>awk -F:</code> separa por dois-pontos.'],
        solution: '<div class="code"><pre>id &amp;&amp; groups\ngetent passwd | awk -F: \'$3 &gt;= 1000 &amp;&amp; $3 &lt; 60000 {print $1, $3}\'\ngetent passwd | awk -F: \'$3 &lt; 1000 {print $1, $3}\' | head -8\ncd ~ &amp;&amp; touch orfao.txt\nsudo chown 4242 orfao.txt\nls -l orfao.txt</pre></div>',
        check: async (ctx) => {
          const o = H.owner(ctx, '/home/aluno/orfao.txt');
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /\bid\b/), 'Comece consultando sua identidade com <code>id</code>.'],
            [() => H.usedCommand(ctx, /getent\s+passwd/), 'Liste as contas com <code>getent passwd</code>.'],
            [o !== null, 'Crie o arquivo <code>~/orfao.txt</code>.'],
            [() => !!o && o.uid === 4242, () => `O arquivo deveria pertencer ao UID 4242 (sem nome correspondente); está com uid ${o ? o.uid : '—'}.`]
          ]);
        }
      },
      {
        id: 't6-1-q', kind: 'quiz', title: 'Conceito: por que o arquivo "mudou de dono"',
        body: [
          { p: 'Você copia arquivos de um servidor antigo para um novo usando <code>rsync -a</code>. No servidor antigo eles pertenciam a <code>joana</code> (UID 1001). No novo, aparecem como pertencentes a <code>carlos</code>. O que aconteceu?' }
        ],
        options: [
          { text: 'O <code>rsync -a</code> preserva o <strong>número</strong>, e no servidor novo o UID 1001 é do <code>carlos</code>.', correct: true },
          { text: 'O <code>rsync</code> corrompeu os metadados durante a transferência.', why: 'Não houve corrupção: o número foi preservado exatamente como estava.' },
          { text: 'O arquivo foi criado por <code>carlos</code>, porque foi ele quem rodou o comando.', why: 'Isso aconteceria sem o <code>-a</code>; com ele, a propriedade da origem é preservada (quando executado como root).' },
          { text: 'Os nomes de usuário são gravados dentro do arquivo e sofreram conflito.', why: 'Nomes nunca são gravados no inode — apenas UID e GID numéricos.' }
        ],
        explain: 'A solução em migrações é acertar os UIDs antes (com <code>usermod -u</code> e <code>chown -R</code>) ou usar <code>rsync --numeric-ids</code> conscientemente e mapear depois. O mesmo problema aparece em volumes de Docker e em pen drives formatados em ext4.'
      },
      {
        id: 't6-1-b', kind: 'desafio', title: 'Identidade em números',
        body: [
          { p: 'Deixe duas provas no seu diretório pessoal de que, para o sistema, identidade é número.' },
          {
            ul: [
              'o arquivo <code>~/identidade.txt</code> com <strong>duas linhas</strong>: na primeira o seu UID numérico, na segunda o seu GID primário numérico — só os números, sem nomes e sem rótulos;',
              'o arquivo <code>~/sem-dono.txt</code> pertencendo ao UID <strong>7000</strong> e ao GID <strong>7000</strong>, dois números que não têm nome nesta máquina.'
            ]
          },
          { p: 'Os números do primeiro arquivo têm que sair do sistema, não da sua memória. Depois olhe o segundo com <code>ls -l</code>: ele mostra os números crus, porque não existe tradução para eles aqui.' }
        ],
        hints: [
          'O <code>id</code> tem opções que imprimem apenas o número: uma para o usuário e outra para o grupo primário.',
          'Escreva a primeira linha com <code>&gt;</code> e acrescente a segunda com <code>&gt;&gt;</code>. Para a propriedade, a forma é <code>sudo chown UID:GID arquivo</code>.'
        ],
        solution: '<div class="code"><pre>id -u &gt; ~/identidade.txt\nid -g &gt;&gt; ~/identidade.txt\ncat ~/identidade.txt\ntouch ~/sem-dono.txt\nsudo chown 7000:7000 ~/sem-dono.txt\nls -l ~/sem-dono.txt</pre></div><p style="margin-top:8px">O <code>ls</code> imprime <code>7000 7000</code> onde normalmente apareceriam nomes. O arquivo não está corrompido: apenas não há conta com esse número por aqui.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const eu = m.userByName('aluno');
          const c = H.read(ctx, '/home/aluno/identidade.txt');
          const linhas = String(c || '').split('\n').map(l => l.trim()).filter(Boolean);
          const o = H.owner(ctx, '/home/aluno/sem-dono.txt');
          return LX.H.checkAll([
            [!!eu, 'Não consegui ler a conta <code>aluno</code> nesta máquina.'],
            [c !== null, 'O arquivo <code>~/identidade.txt</code> ainda não existe.'],
            [() => linhas.length === 2, () => `O <code>~/identidade.txt</code> deve ter exatamente duas linhas (UID e GID); tem ${linhas.length}.`],
            [() => linhas[0] === String(eu.uid), () => `A primeira linha deveria ser o seu UID (<code>${eu.uid}</code>); está <code>${linhas[0]}</code>. Tire o número do <code>id</code>, não de um <code>echo</code>.`],
            [() => linhas[1] === String(eu.gid), () => `A segunda linha deveria ser o seu GID primário (<code>${eu.gid}</code>); está <code>${linhas[1]}</code>.`],
            [o !== null, 'O arquivo <code>~/sem-dono.txt</code> ainda não existe.'],
            [() => o.uid === 7000, () => `O <code>~/sem-dono.txt</code> deveria pertencer ao UID 7000; está com o UID ${o.uid}.`],
            [() => o.gid === 7000, () => `O grupo do <code>~/sem-dono.txt</code> deveria ser o GID 7000; está com o GID ${o.gid}.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 6.2 ============================== */
  LX.lesson('m06', {
    id: 'l6-2', n: '6.2', title: 'Os arquivos: passwd, shadow, group',
    goal: 'Ler diretamente as bases de contas do sistema, campo por campo, e saber por que a senha não fica no /etc/passwd.',
    body: [
      { p: 'Toda ferramenta de gerenciamento de contas é, no fundo, um editor cuidadoso de três arquivos de texto.' },

      { h2: '/etc/passwd — quem existe' },
      { code: ['$ head -3 /etc/passwd', '$ getent passwd aluno'] },
      {
        ascii: `aluno:x:1000:1000:Aluno Terminalis:/home/aluno:/bin/bash
  │   │   │    │            │              │           │
  │   │   │    │            │              │           └─ shell de login
  │   │   │    │            │              └───────────── diretório pessoal
  │   │   │    │            └──────────────────────────── GECOS (nome, sala, telefones)
  │   │   │    └───────────────────────────────────────── GID primário
  │   │   └────────────────────────────────────────────── UID
  │   └────────────────────────────────────────────────── senha: "x" = está no shadow
  └────────────────────────────────────────────────────── nome de login`
      },
      { p: 'Esse arquivo é <strong>legível por todos</strong> (<code>644</code>) — e precisa ser, porque qualquer programa que traduza UID em nome o consulta. É exatamente por isso que a senha não pode morar aqui.' },

      { h2: '/etc/shadow — as credenciais' },
      { code: ['$ ls -l /etc/passwd /etc/shadow', '$ sudo getent shadow aluno'] },
      {
        ascii: `aluno:$y$j9T$...:20500:0:99999:7:::
  │        │        │   │   │   │ │ │
  │        │        │   │   │   │ │ └─ reservado
  │        │        │   │   │   │ └─── expiração da CONTA (dias desde 1970)
  │        │        │   │   │   └───── dias de inatividade tolerados após expirar
  │        │        │   │   └───────── aviso: dias antes de avisar
  │        │        │   └───────────── idade MÁXIMA da senha (dias)
  │        │        └───────────────── idade MÍNIMA (dias antes de poder trocar)
  │        └────────────────────────── última troca (dias desde 01/01/1970)
  └─────────────────────────────────── login`
      },
      { p: 'O campo da senha guarda um <strong>hash</strong>, não a senha. O prefixo diz qual algoritmo: <code>$y$</code> é yescrypt (padrão atual no Debian/Ubuntu), <code>$6$</code> é SHA-512 (ainda comum), <code>$2b$</code> é bcrypt. Dois marcadores importam:' },
      {
        table: {
          head: ['Campo da senha', 'Significa'],
          rows: [
            ['<code>$y$...</code>', 'senha definida (hash)'],
            ['<code>!</code> ou <code>!hash</code>', 'conta <strong>bloqueada</strong> para senha'],
            ['<code>*</code>', 'nunca terá senha — típico de conta de serviço'],
            ['(vazio)', '<strong>perigoso</strong>: login sem senha']
          ]
        }
      },
      {
        box: 'warn', body: [
          { p: 'Bloquear a senha (<code>!</code>) não impede login por <strong>chave SSH</strong>. Para desativar uma conta de verdade, bloqueie a senha <em>e</em> troque o shell para <code>/usr/sbin/nologin</code> <em>e</em> remova as chaves autorizadas. Ver aula 6.4.' }
        ]
      },

      { h2: '/etc/group e /etc/gshadow' },
      { code: ['$ getent group sudo', '$ tail -5 /etc/group'] },
      {
        ascii: `sudo:x:27:aluno,ana
  │  │  │     │
  │  │  │     └─ MEMBROS SECUNDÁRIOS (quem tem esse grupo como primário NÃO aparece aqui)
  │  │  └─────── GID
  │  └────────── senha do grupo (fica no gshadow; raríssimo de usar)
  └───────────── nome do grupo`
      },
      {
        box: 'key', body: [
          { p: 'A lista do <code>/etc/group</code> é incompleta de propósito: quem tem o grupo como <strong>primário</strong> não é listado ali. Por isso <code>getent group aluno</code> pode aparecer vazio enquanto <code>id aluno</code> mostra o grupo. Para saber os grupos de alguém, use <code>id</code> ou <code>groups</code>, nunca só o <code>grep</code> no arquivo.' }
        ]
      },

      { h2: 'A regra de ouro da edição' },
      { p: 'Nunca abra esses arquivos com um editor comum em um servidor: se dois processos gravarem ao mesmo tempo, ou se você errar um campo, o sistema pode ficar sem login. Existem ferramentas com trava e validação:' },
      {
        table: {
          head: ['Ferramenta', 'Para quê'],
          rows: [
            ['<code>vipw</code>', 'edita <code>/etc/passwd</code> com trava'],
            ['<code>vipw -s</code>', 'edita <code>/etc/shadow</code>'],
            ['<code>vigr</code>', 'edita <code>/etc/group</code>'],
            ['<code>pwck</code> / <code>grpck</code>', 'verifica a consistência das bases'],
            ['<code>getent</code>', '<strong>lê</strong> as bases (inclusive LDAP/AD, se configurado)']
          ]
        }
      },
      {
        box: 'tip', body: [
          { p: 'Prefira <code>getent passwd usuario</code> a <code>grep usuario /etc/passwd</code>. Em máquinas integradas a um diretório corporativo (LDAP, Active Directory, SSSD), o usuário existe mas <strong>não está no arquivo</strong> — e só o <code>getent</code> enxerga.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't6-2-a', kind: 'guiado', title: 'Leia as três bases',
        body: [
          { p: 'Compare permissões, campos e a diferença entre grupo primário e secundário.' },
          {
            code: [
              '$ ls -l /etc/passwd /etc/shadow /etc/group',
              '$ getent passwd aluno',
              '$ sudo getent shadow aluno',
              '$ getent group sudo',
              '$ getent group aluno',
              '$ id aluno'
            ]
          },
          { p: 'Repare: <code>getent group aluno</code> não lista você como membro, mas o <code>id</code> mostra o grupo. É a regra do grupo primário.' }
        ],
        hints: ['O <code>/etc/shadow</code> não é legível por usuários comuns — por isso o <code>sudo</code>.'],
        solution: '<div class="code"><pre>ls -l /etc/passwd /etc/shadow /etc/group\ngetent passwd aluno\nsudo getent shadow aluno\ngetent group sudo\nid aluno</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /getent\s+passwd/), 'Leia <code>/etc/passwd</code> com <code>getent passwd aluno</code>.'],
          [() => H.usedCommand(ctx, /sudo\s+getent\s+shadow|sudo\s+(cat|head|grep|tail).*shadow/), 'Leia o <code>/etc/shadow</code> como root.'],
          [() => H.usedCommand(ctx, /getent\s+group/), 'Leia um grupo com <code>getent group sudo</code>.'],
          [() => H.usedCommand(ctx, /\bid\b\s+aluno|\bid\b\s*$/m), 'Compare com a saída de <code>id aluno</code>.']
        ])
      },
      {
        id: 't6-2-f', kind: 'fill', title: 'Complete o campo',
        body: [
          { p: 'Você quer listar <strong>apenas os nomes</strong> das contas cujo shell é <code>/usr/sbin/nologin</code> — ou seja, as contas de serviço que não podem abrir sessão.' },
          { p: 'O shell é o <strong>sétimo</strong> campo e o nome é o primeiro. Complete a condição do awk:' }
        ],
        template: `getent passwd | awk -F: '___ {print $1}'`, sample: '$7=="/usr/sbin/nologin"',
        answers: ['\\$7\\s*==\\s*"/usr/sbin/nologin"'],
        hints: ['Os campos do <code>/etc/passwd</code> são separados por <code>:</code> — o sétimo é o shell.', 'Compare com igualdade e aspas: <code>$7=="/usr/sbin/nologin"</code>.'],
        solution: 'A resposta é <code>$7=="/usr/sbin/nologin"</code>. Também funcionaria <code>/nologin$/</code> como padrão de linha, mas comparar o campo exato é mais preciso.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim();
          if (/nologin/.test(v) && /~|match|\/nologin/.test(v)) return { ok: true, msg: 'Vale — casar o padrão também funciona, embora comparar o campo exato seja mais preciso.' };
          return LX.H.checkAll([
            [/\$7/.test(v), 'O shell é o <strong>sétimo</strong> campo: use <code>$7</code>.'],
            [/==/.test(v), 'Compare com <code>==</code> (igualdade), não com <code>=</code> (atribuição).'],
            [/nologin/.test(v), 'O valor comparado deve ser <code>"/usr/sbin/nologin"</code>.']
          ]);
        }
      },
      {
        id: 't6-2-b', kind: 'desafio', title: 'Inventário de contas',
        body: [
          { p: 'Produza <code>~/contas.txt</code> com um inventário das contas <strong>humanas</strong> desta máquina — as de UID entre 1000 e 59999 —, uma por linha, no formato exato:' },
          { code: ['aluno:1000:/bin/bash'], run: false, mixed: false, lang: 'text' },
          { p: 'Ou seja: <code>nome:UID:shell</code>, sem cabeçalho, ordenado por UID crescente.' },
          { p: 'Antes, crie mais duas contas para o inventário não ficar solitário:' },
          { code: ['$ sudo useradd -m -s /bin/bash ana', '$ sudo useradd -r -s /usr/sbin/nologin appsvc'] },
          { p: 'Repare que a segunda é de <strong>sistema</strong> (<code>-r</code>) e não deve aparecer no inventário.' }
        ],
        hints: [
          'O <code>awk -F:</code> separa os campos; o UID é o campo 3 e o shell é o 7.',
          'Monte a saída com <code>print $1":"$3":"$7</code> e filtre pela faixa de UID.',
          '<code>getent passwd | awk -F: \'$3&gt;=1000 &amp;&amp; $3&lt;60000 {print $1":"$3":"$7}\' | sort -t: -k2 -n &gt; ~/contas.txt</code>'
        ],
        solution: '<div class="code"><pre>sudo useradd -m -s /bin/bash ana\nsudo useradd -r -s /usr/sbin/nologin appsvc\ngetent passwd | awk -F: \'$3&gt;=1000 &amp;&amp; $3&lt;60000 {print $1":"$3":"$7}\' | sort -t: -k2 -n &gt; ~/contas.txt\ncat ~/contas.txt</pre></div><p style="margin-top:8px">Esse arquivo é o começo de qualquer auditoria: contas humanas que ninguém reconhece são o primeiro sinal de problema em um servidor herdado.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/contas.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/contas.txt</code> ainda não existe.' };
          const linhas = c.split('\n').filter(l => l.trim());
          const uids = linhas.map(l => +l.split(':')[1]);
          const m = ctx.machine || ctx.sh.m;
          const humanasReais = m.users().filter(u => u.uid >= 1000 && u.uid < 60000).map(u => u.name).sort();
          return LX.H.checkAll([
            [!!m.userByName('ana'), 'Crie a usuária <code>ana</code> como pede o enunciado.'],
            [!!m.userByName('appsvc'), 'Crie a conta de sistema <code>appsvc</code> como pede o enunciado.'],
            [linhas.length >= 2, () => `O inventário deveria ter pelo menos duas linhas (aluno e ana); tem ${linhas.length}.`],
            /* o relatório precisa descrever ESTE /etc/passwd, não um plausível */
            [() => linhas.every(l => { const [n, u, sh2] = l.split(':'); const real = m.userByName(n);
              return real && real.uid === +u && real.shell === sh2; }),
              'Alguma linha não bate com o <code>/etc/passwd</code> desta máquina (nome, UID ou shell). Os dados precisam sair do <code>getent passwd</code>.'],
            [() => { const nomes = linhas.map(l => l.split(':')[0]).sort();
              return nomes.length === humanasReais.length && nomes.every((n, i) => n === humanasReais[i]); },
              () => `O inventário deve conter exatamente as contas humanas da máquina: ${humanasReais.join(', ')}.`],
            [linhas.every(l => /^[^:]+:\d+:\S+$/.test(l)), 'Cada linha deve estar no formato <code>nome:UID:shell</code>, sem espaços e sem campos extras.'],
            [uids.every(u => u >= 1000 && u < 60000), 'Só contas humanas (UID entre 1000 e 59999) podem aparecer — a <code>appsvc</code> deve ficar de fora.'],
            [linhas.some(l => l.startsWith('aluno:')) && linhas.some(l => l.startsWith('ana:')), 'O inventário deve conter <code>aluno</code> e <code>ana</code>.'],
            [uids.every((u, i) => i === 0 || uids[i - 1] <= u), 'As linhas devem estar ordenadas por UID crescente.']
          ]);
        }
      }
    ]
  });

  /* ============================== 6.3 ============================== */
  LX.lesson('m06', {
    id: 'l6-3', n: '6.3', title: 'Criar contas: useradd, adduser e /etc/skel',
    goal: 'Criar contas de pessoas e de serviços do jeito certo, sabendo exatamente o que cada opção faz.',
    body: [
      { p: 'Existem duas ferramentas para criar contas no Debian/Ubuntu, e a confusão entre elas é responsável por metade dos "criei o usuário mas não funciona".' },
      {
        table: {
          head: ['', '<code>useradd</code>', '<code>adduser</code>'],
          rows: [
            ['Origem', 'padrão POSIX, existe em toda distribuição', 'script do Debian, por cima do <code>useradd</code>'],
            ['Diretório pessoal', '<strong>não cria</strong> sem <code>-m</code>', 'cria por padrão'],
            ['Shell', '<code>/bin/sh</code> por padrão', 'usa o <code>DSHELL</code> do <code>/etc/adduser.conf</code> (<code>/bin/bash</code>)'],
            ['Senha', 'não define (conta bloqueada)', 'pergunta interativamente'],
            ['Uso ideal', '<strong>scripts</strong> e automação', 'uso interativo no terminal']
          ]
        }
      },
      { cmd: 'useradd' },
      {
        code: [
          'useradd [opções] LOGIN',
          '  -m               cria o diretório pessoal (copiando /etc/skel)',
          '  -d /caminho      diretório pessoal alternativo',
          '  -s /bin/bash     shell de login',
          '  -G g1,g2         grupos SECUNDÁRIOS',
          '  -g grupo         grupo PRIMÁRIO (por padrão, cria um com o nome do usuário)',
          '  -u 1500          UID específico',
          '  -c "Nome Real"   campo GECOS',
          '  -r               conta de sistema (UID baixo, sem home, sem envelhecimento)',
          '  -e 2027-01-31    data de expiração da conta'
        ], run: false, lang: 'text'
      },
      { p: 'A receita para uma pessoa:' },
      {
        code: [
          '$ sudo useradd -m -s /bin/bash -c "Ana Souza" ana',
          '$ getent passwd ana',
          '$ ls -la /home/ana',
          '$ sudo passwd ana'
        ]
      },
      {
        box: 'warn', label: 'O erro mais comum de todos', body: [
          { p: 'Esquecer o <code>-m</code>. A conta é criada, o login até acontece, mas o usuário cai em um diretório que não existe: <em>"could not chdir to home directory"</em>, sem <code>.bashrc</code>, com prompt quebrado. O segundo erro mais comum é esquecer o <code>-s</code> e deixar a pessoa com <code>/bin/sh</code>, sem histórico nem autocompletar.' }
        ]
      },

      { h2: '/etc/skel: o molde do diretório pessoal' },
      { p: 'Com <code>-m</code>, tudo que está em <code>/etc/skel</code> é <strong>copiado</strong> para o novo diretório pessoal — e a cópia acontece uma única vez, na criação.' },
      { code: ['$ ls -la /etc/skel', '$ sudo useradd -m -s /bin/bash bruno && ls -a /home/bruno'] },
      { p: 'É onde entram configurações padrão da empresa: um <code>.bashrc</code> com aliases, um <code>.vimrc</code>, um <code>README-primeiros-passos.txt</code>. Alterar o <code>skel</code> depois não afeta quem já existe.' },

      { h2: 'Contas de serviço' },
      { p: 'Um serviço não precisa de diretório pessoal nem de shell — precisa apenas existir como identidade para ter arquivos e processos:' },
      {
        code: [
          '$ sudo useradd -r -s /usr/sbin/nologin -d /nonexistent appsvc',
          '$ getent passwd appsvc',
          '$ sudo -u appsvc whoami 2>&1'
        ]
      },
      {
        box: 'key', body: [
          { p: 'O shell <code>/usr/sbin/nologin</code> não é decorativo: se alguém obtiver a senha ou uma chave dessa conta, o login é recusado com uma mensagem e encerrado. Toda conta que não é de uma pessoa deveria tê-lo (ou <code>/bin/false</code>).' }
        ]
      },
      {
        box: 'old', label: 'Prática antiga × atual', body: [
          { p: 'Guias antigos criam contas de serviço com <code>useradd -m -s /bin/bash servico</code> e depois se surpreendem com o serviço sendo usado para acesso interativo.' },
          { p: 'Hoje: <code>-r</code>, sem home (ou home dedicado sem <code>/home</code>), <code>nologin</code>, e — quando o serviço roda sob systemd — muitas vezes nem isso: usa-se <code>DynamicUser=yes</code> na unit, e o systemd cria uma identidade efêmera só durante a execução. <strong>Aprenda essa versão.</strong>' }
        ]
      }
    ],
    tasks: [
      {
        id: 't6-3-a', kind: 'guiado', title: 'Crie uma pessoa e um serviço',
        body: [
          { p: 'Compare os dois tipos de conta lado a lado.' },
          {
            code: [
              '$ ls -la /etc/skel',
              '$ sudo useradd -m -s /bin/bash -c "Ana Souza" ana',
              '$ getent passwd ana && ls -a /home/ana',
              '$ sudo useradd -r -s /usr/sbin/nologin -d /nonexistent appsvc',
              '$ getent passwd appsvc',
              '$ getent passwd | awk -F: \'{print $1, $3, $7}\' | tail -4'
            ]
          },
          { p: 'Note as diferenças: UID, presença de diretório pessoal e shell.' }
        ],
        hints: ['Contas de sistema (<code>-r</code>) recebem UID abaixo de 1000.'],
        solution: '<div class="code"><pre>ls -la /etc/skel\nsudo useradd -m -s /bin/bash -c "Ana Souza" ana\ngetent passwd ana\nls -a /home/ana\nsudo useradd -r -s /usr/sbin/nologin -d /nonexistent appsvc\ngetent passwd appsvc</pre></div>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const ana = m.userByName('ana'), svc = m.userByName('appsvc');
          return LX.H.checkAll([
            [!!ana, 'Crie a usuária <code>ana</code>.'],
            [() => !!ana && ana.shell === '/bin/bash', () => `A <code>ana</code> deve ter <code>/bin/bash</code> como shell; está com <code>${ana ? ana.shell : '—'}</code>.`],
            [H.exists(ctx, '/home/ana'), 'O diretório <code>/home/ana</code> deveria existir — faltou o <code>-m</code>.'],
            [!!svc, 'Crie a conta de serviço <code>appsvc</code>.'],
            [() => !!svc && /nologin|false/.test(svc.shell), () => `A conta de serviço deve usar <code>/usr/sbin/nologin</code>; está com <code>${svc ? svc.shell : '—'}</code>.`],
            [() => !!svc && svc.uid < 1000, () => `A conta de serviço deveria ter UID abaixo de 1000 (opção <code>-r</code>); tem ${svc ? svc.uid : '—'}.`]
          ]);
        }
      },
      {
        id: 't6-3-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um administrador cria uma conta assim:' },
          { code: ['sudo useradd carla', 'sudo passwd carla'], run: false, mixed: false },
          { p: 'A Carla consegue autenticar por SSH, mas o terminal aparece quebrado: sem cores, sem histórico entre sessões, sem autocompletar, e com um aviso sobre o diretório. Qual é a causa?' }
        ],
        options: [
          { text: 'Faltaram <code>-m</code> e <code>-s /bin/bash</code>: ela não tem diretório pessoal (nem <code>.bashrc</code>) e caiu no <code>/bin/sh</code>.', correct: true },
          { text: 'A senha foi definida antes de a conta estar pronta.', why: 'A ordem não importa: <code>passwd</code> apenas grava o hash no shadow.' },
          { text: 'O SSH exige que o usuário esteja no grupo <code>ssh</code>.', why: 'Não existe essa exigência por padrão; e o login funcionou.' },
          { text: 'É preciso reiniciar o servidor para a conta funcionar direito.', why: 'Contas valem imediatamente; nada precisa reiniciar.' }
        ],
        explain: 'A correção sem recriar a conta: <code>sudo mkdir -p /home/carla</code>, copiar o <code>/etc/skel</code>, <code>sudo chown -R carla:carla /home/carla</code> e <code>sudo usermod -s /bin/bash -d /home/carla carla</code>. Mais simples ainda: usar <code>adduser carla</code> desde o início, que faz tudo isso.'
      },
      {
        id: 't6-3-b', kind: 'desafio', title: 'Provisione a equipe',
        body: [
          { p: 'Você recebeu a tarefa de preparar três acessos em um servidor novo:' },
          {
            ul: [
              '<strong>ana</strong> e <strong>bruno</strong>: pessoas, com diretório pessoal, shell <code>/bin/bash</code> e ambos no grupo secundário <code>devs</code>;',
              '<strong>appsvc</strong>: conta de serviço, UID de sistema, <strong>sem</strong> shell de login e sem diretório pessoal em <code>/home</code>;',
              'o grupo <code>devs</code> ainda não existe.'
            ]
          },
          { p: 'Ao final, comprove com <code>id ana</code>, <code>id bruno</code> e <code>getent passwd appsvc</code>.' }
        ],
        hints: [
          'A ordem importa: o grupo precisa existir antes de ser usado em <code>-G</code>.',
          'Para as pessoas: <code>-m -s /bin/bash -G devs</code>. Para o serviço: <code>-r -s /usr/sbin/nologin</code>.',
          '<code>sudo groupadd devs</code>; <code>sudo useradd -m -s /bin/bash -G devs ana</code>; idem para bruno; <code>sudo useradd -r -s /usr/sbin/nologin -d /nonexistent appsvc</code>.'
        ],
        solution: '<div class="code"><pre>sudo groupadd devs\nsudo useradd -m -s /bin/bash -G devs ana\nsudo useradd -m -s /bin/bash -G devs bruno\nsudo useradd -r -s /usr/sbin/nologin -d /nonexistent appsvc\nid ana\nid bruno\ngetent passwd appsvc</pre></div>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const g = m.groupByName('devs');
          if (!g) return { ok: false, msg: 'O grupo <code>devs</code> ainda não existe.' };
          const ana = m.userByName('ana'), bruno = m.userByName('bruno'), svc = m.userByName('appsvc');
          const nosDevs = (n) => m.groupsOfUser(n).some(x => x.name === 'devs');
          return LX.H.checkAll([
            [!!ana && !!bruno, 'Crie as contas <code>ana</code> e <code>bruno</code>.'],
            [ana.shell === '/bin/bash' && bruno.shell === '/bin/bash', 'As duas pessoas devem ter <code>/bin/bash</code> como shell.'],
            [H.exists(ctx, '/home/ana') && H.exists(ctx, '/home/bruno'), 'Ambas precisam de diretório pessoal (opção <code>-m</code>).'],
            [nosDevs('ana') && nosDevs('bruno'), 'As duas precisam estar no grupo secundário <code>devs</code>.'],
            [!!svc, 'Crie a conta de serviço <code>appsvc</code>.'],
            [svc.uid < 1000, `A <code>appsvc</code> deve ser conta de sistema (UID &lt; 1000); tem ${svc.uid}.`],
            [/nologin|false/.test(svc.shell), 'A <code>appsvc</code> não pode ter shell de login.'],
            [!H.exists(ctx, '/home/appsvc'), 'A conta de serviço não deve ter diretório em <code>/home</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 6.4 ============================== */
  LX.lesson('m06', {
    id: 'l6-4', n: '6.4', title: 'Modificar, bloquear e remover contas',
    goal: 'Alterar contas existentes sem quebrá-las e executar um desligamento de acesso completo, na ordem certa.',
    body: [
      { cmd: 'usermod' },
      {
        code: [
          'usermod [opções] LOGIN',
          '  -aG g1,g2      ADICIONA grupos secundários  ← o -a é obrigatório!',
          '  -G g1,g2       SUBSTITUI toda a lista de grupos secundários',
          '  -g grupo       muda o grupo primário',
          '  -s /bin/bash   muda o shell',
          '  -d /novo -m    muda o diretório pessoal (-m move o conteúdo)',
          '  -l novo_nome   renomeia o login',
          '  -u 1500        muda o UID (ver aviso abaixo sobre os arquivos)',
          '  -L / -U        bloqueia / desbloqueia a senha',
          '  -e 2027-01-31  define expiração da conta'
        ], run: false, lang: 'text'
      },
      {
        box: 'warn', label: 'Trocar o UID e os arquivos que ficam para trás', body: [
          { p: 'O <code>usermod -u</code> <strong>atualiza automaticamente</strong> a propriedade dos arquivos que estão dentro do diretório pessoal do usuário. O que ele não toca é o que está <em>fora</em> dele — <code>/srv</code>, <code>/var</code>, <code>/opt</code>, um diretório compartilhado.' },
          { p: 'Esses arquivos continuam apontando para o UID antigo, que um dia será reciclado por outra conta — e aí a pessoa nova herda arquivos que nunca foram dela. Depois de trocar um UID, o passo obrigatório é procurar os órfãos:' },
          { code: ['sudo find / -xdev -uid 1001 -not -path "/proc/*" 2>/dev/null'], run: false }
        ]
      },
      {
        box: 'warn', label: 'O erro que quebra servidores', body: [
          { p: '<code>usermod -G docker ana</code> — sem o <code>-a</code> — <strong>remove a ana de todos os outros grupos</strong> e deixa apenas <code>docker</code>. É assim que alguém sai do grupo <code>sudo</code> sem perceber e perde o acesso administrativo.' },
          { p: 'Grave a regra: <strong>ao adicionar, sempre <code>-aG</code></strong>. Antes de mexer, guarde a lista atual com <code>id -nG usuario</code>.' }
        ]
      },
      { code: ['$ sudo useradd -m -s /bin/bash ana 2>/dev/null; id -nG ana', '$ sudo groupadd devs 2>/dev/null; sudo usermod -aG devs ana', '$ id -nG ana'] },

      { h2: 'Bloquear ≠ remover' },
      { p: 'Quando alguém sai da equipe, remover a conta imediatamente costuma ser errado: processos podem estar rodando com ela, e arquivos ficam órfãos. O procedimento maduro é <strong>desativar primeiro, remover depois</strong>.' },
      {
        table: {
          head: ['Passo', 'Comando', 'Efeito'],
          rows: [
            ['1. bloquear a senha', '<code>sudo usermod -L ana</code>', 'põe <code>!</code> no shadow'],
            ['2. tirar o shell', '<code>sudo usermod -s /usr/sbin/nologin ana</code>', 'impede sessão interativa'],
            ['3. expirar a conta', '<code>sudo chage -E 0 ana</code>', 'nega o login em qualquer forma'],
            ['4. remover chaves SSH', '<code>sudo mv ~ana/.ssh/authorized_keys ...</code>', '<strong>o passo esquecido</strong>'],
            ['5. encerrar sessões', '<code>sudo pkill -u ana</code>', 'derruba o que estiver em execução'],
            ['6. só então remover', '<code>sudo userdel -r ana</code>', 'apaga conta e diretório pessoal']
          ]
        }
      },
      {
        box: 'key', body: [
          { p: 'Os passos 1 e 4 são independentes: bloquear a senha <strong>não</strong> impede o login por chave SSH. Uma conta "desativada" que ainda tem <code>authorized_keys</code> continua entrando normalmente. Esse é um achado clássico de auditoria.' }
        ]
      },
      { cmd: 'userdel' },
      { code: ['$ sudo useradd -m bruno 2>/dev/null; sudo userdel -r bruno', '$ getent passwd bruno; echo "rc=$?"', '$ ls /home'] },
      {
        box: 'warn', body: [
          { p: 'O <code>userdel -r</code> apaga o diretório pessoal, mas <strong>não</strong> apaga arquivos que a pessoa deixou fora dele — em <code>/srv</code>, <code>/var/www</code>, <code>/tmp</code>. Eles ficam com o UID órfão e serão "herdados" pelo próximo usuário que receber aquele número. Encontre-os antes:' },
          { code: ['$ sudo find / -xdev -user ana 2>/dev/null'], run: false }
        ]
      },

      { h2: 'Renomear e mudar o diretório pessoal' },
      { code: ['$ sudo usermod -l ana2 -d /home/ana2 -m ana 2>&1', '$ getent passwd ana2 2>/dev/null || getent passwd ana'] },
      { p: 'O <code>-m</code> move o conteúdo do diretório antigo. O que <strong>não</strong> se move sozinho: entradas em <code>/etc/sudoers.d</code>, jobs de cron, unidades do systemd e qualquer script que cite o nome antigo. Renomear conta é uma operação de manutenção, não um atalho.' }
    ],
    tasks: [
      {
        id: 't6-4-a', kind: 'guiado', title: 'Adicione a grupo sem destruir a lista',
        body: [
          { p: 'Veja a diferença entre <code>-aG</code> e <code>-G</code> na prática — e por que a segunda forma assusta.' },
          {
            code: [
              '$ sudo useradd -m -s /bin/bash ana 2>/dev/null',
              '$ sudo groupadd devs 2>/dev/null; sudo groupadd deploy 2>/dev/null',
              '$ sudo usermod -aG devs ana && id -nG ana',
              '$ sudo usermod -aG deploy ana && id -nG ana',
              '# agora a forma perigosa:',
              '$ sudo usermod -G deploy ana && id -nG ana'
            ]
          },
          { p: 'A última linha apagou o <code>devs</code> da lista. Devolva com <code>sudo usermod -aG devs ana</code> e confirme.' }
        ],
        hints: ['<code>id -nG</code> mostra apenas os nomes dos grupos, o que facilita comparar antes e depois.'],
        solution: '<div class="code"><pre>sudo useradd -m -s /bin/bash ana\nsudo groupadd devs\nsudo groupadd deploy\nsudo usermod -aG devs ana\nsudo usermod -aG deploy ana\nid -nG ana\nsudo usermod -G deploy ana\nid -nG ana\nsudo usermod -aG devs ana\nid -nG ana</pre></div>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          if (!m.userByName('ana')) return { ok: false, msg: 'Crie a usuária <code>ana</code>.' };
          const gs = m.groupsOfUser('ana').map(g => g.name);
          return LX.H.checkAll([
            [!!m.groupByName('devs') && !!m.groupByName('deploy'), 'Crie os grupos <code>devs</code> e <code>deploy</code>.'],
            [() => H.usedCommand(ctx, /usermod\s+-G\s/), 'Experimente também a forma perigosa (<code>usermod -G</code>) para ver o efeito.'],
            [gs.includes('deploy'), 'A <code>ana</code> deve estar em <code>deploy</code>.'],
            [gs.includes('devs'), 'Depois do <code>usermod -G</code>, a <code>ana</code> saiu do <code>devs</code>. Devolva com <code>sudo usermod -aG devs ana</code>.']
          ]);
        }
      },
      {
        id: 't6-4-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um administrador precisa colocar a <code>ana</code> também no grupo <code>docker</code>, sem tirá-la de nenhum grupo que já tinha. Ele roda:' },
          { code: ['sudo usermod -G docker ana'], run: false, mixed: false },
          { p: 'No dia seguinte, a <code>ana</code> reclama que perdeu o acesso ao <code>sudo</code>. O que aconteceu?' }
        ],
        options: [
          { text: 'Faltou o <code>-a</code>: <code>usermod -G</code> sozinho <strong>substitui</strong> toda a lista de grupos secundários, e ela ficou só com <code>docker</code>.', correct: true },
          { text: 'O grupo <code>sudo</code> foi removido do sistema quando o <code>docker</code> foi adicionado.', why: 'Grupos não desaparecem sozinhos; o que mudou foi a lista de grupos <em>da ana</em>, não a existência do grupo <code>sudo</code>.' },
          { text: 'A ana precisa fazer login de novo para o <code>docker</code> valer, e é isso que parece ter tirado o <code>sudo</code>.', why: 'Reabrir a sessão atualiza a lista que o processo enxerga, mas não apaga grupos do <code>/etc/group</code> — o problema aqui é outro.' },
          { text: '<code>usermod -G</code> exige que os grupos antigos sejam citados de novo, e isso é só um aviso, não perda real de acesso.', why: 'Não é aviso: o <code>/etc/group</code> foi de fato reescrito sem a ana nos grupos antigos, inclusive o <code>sudo</code>.' }
        ],
        explain: 'A correção é <code>sudo usermod -aG sudo,docker ana</code> (ou <code>gpasswd -a ana sudo</code> para devolver o grupo perdido). A regra vista na aula vale sempre: ao <strong>adicionar</strong> um grupo, use <code>-aG</code>; sem o <code>-a</code>, é uma substituição completa da lista.'
      },
      {
        id: 't6-4-b', kind: 'desafio', title: 'Desligamento de acesso',
        body: [
          { p: 'A <strong>ana</strong> saiu da empresa hoje. Monte o cenário e execute o desligamento correto — <strong>sem apagar a conta</strong>, porque o time jurídico pediu para preservar os arquivos por 30 dias.' },
          {
            code: [
              '$ sudo useradd -m -s /bin/bash ana 2>/dev/null',
              '$ sudo mkdir -p /home/ana/.ssh',
              '$ echo "ssh-ed25519 AAAAC3Nz chave-da-ana" | sudo tee /home/ana/.ssh/authorized_keys > /dev/null',
              '$ sudo chown -R ana:ana /home/ana/.ssh'
            ]
          },
          { p: 'Estado final exigido:' },
          {
            ul: [
              'a senha da <code>ana</code> está <strong>bloqueada</strong> (campo do shadow começa com <code>!</code>);',
              'o shell dela é <code>/usr/sbin/nologin</code>;',
              'o arquivo <code>authorized_keys</code> <strong>não está mais no lugar</strong> — renomeie para <code>authorized_keys.revogado</code> em vez de apagar;',
              'a conta e o diretório pessoal continuam existindo.'
            ]
          },
          { p: 'Pense na ordem: o que adianta bloquear a senha se a chave continua ativa?' }
        ],
        hints: [
          'Três comandos: um <code>usermod</code> para a senha, um <code>usermod</code> para o shell e um <code>mv</code> para a chave.',
          'Bloqueio de senha é <code>usermod -L</code>; o shell é <code>usermod -s /usr/sbin/nologin</code>.',
          '<code>sudo usermod -L ana</code>; <code>sudo usermod -s /usr/sbin/nologin ana</code>; <code>sudo mv /home/ana/.ssh/authorized_keys /home/ana/.ssh/authorized_keys.revogado</code>'
        ],
        solution: '<div class="code"><pre>sudo useradd -m -s /bin/bash ana\nsudo mkdir -p /home/ana/.ssh\necho "ssh-ed25519 AAAAC3Nz chave-da-ana" | sudo tee /home/ana/.ssh/authorized_keys &gt; /dev/null\nsudo chown -R ana:ana /home/ana/.ssh\nsudo usermod -L ana\nsudo usermod -s /usr/sbin/nologin ana\nsudo mv /home/ana/.ssh/authorized_keys /home/ana/.ssh/authorized_keys.revogado\nsudo getent shadow ana | cut -c1-20\ngetent passwd ana\nsudo ls -l /home/ana/.ssh</pre></div><p style="margin-top:8px">Em um servidor real, faltariam ainda dois passos: <code>sudo pkill -u ana</code> para encerrar sessões abertas e <code>sudo chage -E 0 ana</code> para expirar a conta. Nenhum deles substitui a remoção da chave.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const ana = m.userByName('ana');
          if (!ana) return { ok: false, msg: 'A conta <code>ana</code> precisa existir — monte o cenário do enunciado.' };
          const shadow = H.read(ctx, '/etc/shadow') || '';
          const linha = shadow.split('\n').find(l => l.startsWith('ana:')) || '';
          return LX.H.checkAll([
            [/^ana:!/.test(linha), 'A senha da <code>ana</code> ainda não está bloqueada (<code>usermod -L</code>).'],
            [/nologin|false/.test(ana.shell), `O shell deve ser <code>/usr/sbin/nologin</code>; está <code>${ana.shell}</code>.`],
            [!H.exists(ctx, '/home/ana/.ssh/authorized_keys'), 'A chave SSH continua ativa em <code>authorized_keys</code> — bloquear a senha não impede login por chave.'],
            [H.exists(ctx, '/home/ana/.ssh/authorized_keys.revogado'), 'A chave deveria ter sido <strong>renomeada</strong> para <code>authorized_keys.revogado</code>, não apagada.'],
            [H.exists(ctx, '/home/ana'), 'O diretório pessoal deve ser preservado — não remova a conta.']
          ]);
        }
      },

    ]
  });

  /* ============================== 6.5 ============================== */
  LX.lesson('m06', {
    id: 'l6-5', n: '6.5', title: 'Senhas e validade: passwd e chage',
    goal: 'Definir, trocar e expirar credenciais — e saber quando política de senha ajuda e quando atrapalha.',
    body: [
      { cmd: 'passwd' },
      {
        code: [
          'passwd                 troca a SUA senha (pede a atual antes)',
          'sudo passwd ana        define a senha de outra pessoa (não pede a antiga)',
          'sudo passwd -l ana     bloqueia (mesmo efeito de usermod -L)',
          'sudo passwd -u ana     desbloqueia',
          'sudo passwd -e ana     expira: obriga a trocar no próximo login',
          'sudo passwd -S ana     mostra o status da senha',
          'sudo passwd -d ana     remove a senha  ← perigoso, quase nunca é o que se quer'
        ], run: false, lang: 'text'
      },
      { p: 'O <code>passwd</code> é um binário SUID (aula 5.6): é ele que consegue escrever no <code>/etc/shadow</code> em seu nome, validando antes que você só altere a própria linha.' },
      { code: ['$ ls -l /usr/bin/passwd', '$ sudo useradd -m ana 2>/dev/null; sudo passwd -S ana'] },

      { h2: 'Envelhecimento de senha' },
      { cmd: 'chage' },
      {
        table: {
          head: ['Opção', 'Significa'],
          rows: [
            ['<code>chage -l ana</code>', 'lista a política atual da conta'],
            ['<code>chage -M 90 ana</code>', 'senha expira a cada 90 dias'],
            ['<code>chage -m 7 ana</code>', 'não pode trocar antes de 7 dias (evita ciclar de volta)'],
            ['<code>chage -W 14 ana</code>', 'avisa 14 dias antes'],
            ['<code>chage -I 30 ana</code>', 'desativa a conta 30 dias após a senha expirar'],
            ['<code>chage -E 2027-01-31 ana</code>', 'a <strong>conta</strong> expira nessa data (ótimo para estagiários e terceiros)'],
            ['<code>chage -d 0 ana</code>', 'força a troca no próximo login']
          ]
        }
      },
      {
        code: [
          '$ sudo chage -l ana',
          '$ sudo chage -M 90 -W 14 ana',
          '$ sudo chage -l ana',
          '$ sudo chage -E 2027-01-31 ana && sudo chage -l ana | head -4'
        ]
      },
      {
        box: 'key', label: 'A diferença que confunde todo mundo', body: [
          { p: 'Expiração de <strong>senha</strong> (<code>-M</code>) obriga a trocar e o acesso continua. Expiração de <strong>conta</strong> (<code>-E</code>) encerra o acesso, ponto. Para um contrato com data para acabar, o certo é <code>-E</code>.' }
        ]
      },

      { h2: 'Política de senha: o que mudou' },
      {
        box: 'old', label: 'Prática antiga × recomendação atual', body: [
          { p: '<strong>Antigo:</strong> trocar a senha a cada 30–90 dias, exigir maiúscula + número + símbolo, proibir reutilização das últimas cinco.' },
          { p: '<strong>Atual</strong> (NIST SP 800-63B, e a orientação da maioria das distribuições): <strong>não</strong> forçar troca periódica sem motivo — isso empurra as pessoas para <code>Senha1!</code>, <code>Senha2!</code>, <code>Senha3!</code>. Em vez disso: senhas <strong>longas</strong> (frases), verificação contra listas de senhas vazadas, segundo fator, e troca obrigatória <em>apenas</em> quando há suspeita de comprometimento.' },
          { p: 'Onde a troca periódica ainda aparece é em ambientes regulados que exigem por contrato. Saiba configurar (<code>chage -M</code>, <code>/etc/login.defs</code>, <code>pam_pwquality</code>), mas saiba também que a recomendação técnica mudou.' }
        ]
      },
      { p: 'Os padrões de novas contas ficam em <code>/etc/login.defs</code>:' },
      { code: ['$ grep -E "^(PASS_MAX_DAYS|PASS_MIN_DAYS|PASS_WARN_AGE|UID_MIN|UID_MAX)" /etc/login.defs'] },
      {
        box: 'tip', body: [
          { p: 'Em servidores modernos, a resposta melhor que "política de senha forte" é <strong>não usar senha para login remoto</strong>: só chave SSH, com <code>PasswordAuthentication no</code> no <code>sshd_config</code> (módulo 10). A senha passa a servir apenas para o <code>sudo</code> local.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't6-5-a', kind: 'guiado', title: 'Leia e ajuste a política de uma conta',
        body: [
          { p: 'Veja o estado da senha, aplique uma política e confira a mudança.' },
          {
            code: [
              '$ sudo useradd -m -s /bin/bash ana 2>/dev/null',
              '$ sudo passwd -S ana',
              '$ sudo chage -l ana',
              '$ sudo chage -M 90 -W 14 ana',
              '$ sudo chage -l ana',
              '$ grep -E "^PASS_" /etc/login.defs'
            ]
          }
        ],
        hints: ['<code>-M</code> é a idade máxima da senha em dias; <code>-W</code> é o aviso prévio.'],
        solution: '<div class="code"><pre>sudo useradd -m -s /bin/bash ana\nsudo passwd -S ana\nsudo chage -l ana\nsudo chage -M 90 -W 14 ana\nsudo chage -l ana\ngrep -E "^PASS_" /etc/login.defs</pre></div>',
        check: async (ctx) => {
          const shadow = H.read(ctx, '/etc/shadow') || '';
          const l = (shadow.split('\n').find(x => x.startsWith('ana:')) || '').split(':');
          return LX.H.checkAll([
            [l.length > 5, 'Crie a usuária <code>ana</code> antes de ajustar a política.'],
            [() => H.usedCommand(ctx, /chage\s+-l/), 'Consulte a política atual com <code>sudo chage -l ana</code>.'],
            [l[4] === '90', `A idade máxima da senha deveria ser 90 dias; está "${l[4]}".`],
            [l[5] === '14', `O aviso prévio deveria ser de 14 dias; está "${l[5]}".`]
          ]);
        }
      },
      {
        id: 't6-5-q', kind: 'quiz', title: 'Conceito: qual expiração usar',
        body: [
          { p: 'Uma consultora externa terá acesso ao servidor até <strong>31 de janeiro de 2027</strong>, e depois disso não deve mais conseguir entrar de forma alguma. Qual é a configuração correta?' }
        ],
        options: [
          { text: '<code>sudo chage -E 2027-01-31 consultora</code> — expira a <strong>conta</strong> na data.', correct: true },
          { text: '<code>sudo chage -M 90 consultora</code> — a senha expira em 90 dias.', why: 'Isso apenas obriga a trocar a senha; o acesso continua, e a data não é a pedida.' },
          { text: '<code>sudo passwd -e consultora</code> — força a troca no próximo login.', why: 'Força a troca, não encerra o acesso.' },
          { text: 'Anotar no calendário e remover a conta manualmente no dia.', why: 'Funciona se ninguém esquecer — e é exatamente por isso que existe o <code>-E</code>: a máquina não esquece.' }
        ],
        explain: 'Depois da data, o login é recusado mesmo com senha correta <strong>e mesmo com chave SSH válida</strong>, porque a checagem de expiração de conta acontece antes da sessão abrir. É o controle mais confiável para acessos com prazo.'
      },
      {
        id: 't6-5-b', kind: 'desafio', title: 'Onboarding com troca obrigatória',
        body: [
          { p: 'Crie a conta do novo estagiário <strong>bruno</strong> seguindo a política da empresa:' },
          {
            ul: [
              'conta de pessoa: diretório pessoal e <code>/bin/bash</code>;',
              'ele deve ser <strong>obrigado a trocar a senha no primeiro login</strong>;',
              'a senha deve expirar a cada <strong>60 dias</strong>, com aviso <strong>7 dias</strong> antes;',
              'a <strong>conta</strong> deve expirar em <strong>31 de dezembro de 2026</strong>, fim do estágio.'
            ]
          },
          { p: 'Comprove ao final com <code>sudo chage -l bruno</code>.' }
        ],
        hints: [
          'São dois comandos: um <code>useradd</code> e um (ou dois) <code>chage</code>.',
          'Forçar a troca no primeiro login é <code>chage -d 0</code>. As demais regras são <code>-M</code>, <code>-W</code> e <code>-E</code>.',
          '<code>sudo useradd -m -s /bin/bash bruno</code>; <code>sudo chage -d 0 -M 60 -W 7 -E 2026-12-31 bruno</code>'
        ],
        solution: '<div class="code"><pre>sudo useradd -m -s /bin/bash bruno\nsudo chage -d 0 -M 60 -W 7 -E 2026-12-31 bruno\nsudo chage -l bruno\ngetent passwd bruno</pre></div><p style="margin-top:8px">O <code>-d 0</code> zera a data da última troca, o que o sistema interpreta como "senha vencida agora" — daí a obrigação de trocar no primeiro login.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const b = m.userByName('bruno');
          if (!b) return { ok: false, msg: 'Crie a conta <code>bruno</code>.' };
          const shadow = H.read(ctx, '/etc/shadow') || '';
          const l = (shadow.split('\n').find(x => x.startsWith('bruno:')) || '').split(':');
          const diasFim = Math.floor(Date.parse('2026-12-31') / 86400000);
          return LX.H.checkAll([
            [b.shell === '/bin/bash', 'O <code>bruno</code> deve usar <code>/bin/bash</code>.'],
            [H.exists(ctx, '/home/bruno'), 'Faltou o diretório pessoal (opção <code>-m</code>).'],
            [l[2] === '0', 'A troca no primeiro login não foi forçada: use <code>chage -d 0 bruno</code>.'],
            [l[4] === '60', `A senha deve expirar a cada 60 dias; está "${l[4]}".`],
            [l[5] === '7', `O aviso deve ser de 7 dias; está "${l[5]}".`],
            [Math.abs(+l[7] - diasFim) <= 1, 'A conta deve expirar em 31/12/2026 (<code>chage -E 2026-12-31</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 6.6 ============================== */
  LX.lesson('m06', {
    id: 'l6-6', n: '6.6', title: 'Grupos na prática',
    goal: 'Usar grupos como a ferramenta principal de organização de acesso, sem cair nas armadilhas do grupo primário e da sessão antiga.',
    body: [
      { p: 'Grupo é a resposta certa para quase toda pergunta que começa com "como dar acesso a essas três pessoas...". Vale a pena dominar os quatro comandos.' },
      {
        cheat: [
          ['<code>groupadd devs</code>', 'cria o grupo'],
          ['<code>groupdel devs</code>', 'remove o grupo (se não for primário de ninguém)'],
          ['<code>usermod -aG devs ana</code>', 'adiciona ao grupo (o <code>-a</code> é vital)'],
          ['<code>gpasswd -a ana devs</code>', 'adiciona (forma equivalente, mais explícita)'],
          ['<code>gpasswd -d ana devs</code>', '<strong>remove</strong> do grupo'],
          ['<code>gpasswd -A ana devs</code>', 'faz a ana administradora do grupo'],
          ['<code>id -nG ana</code>', 'lista os grupos da ana'],
          ['<code>getent group devs</code>', 'lista os membros do grupo'],
          ['<code>newgrp devs</code>', 'troca o grupo primário da sessão atual']
        ]
      },
      { code: ['$ sudo groupadd devs 2>/dev/null; sudo useradd -m ana 2>/dev/null', '$ sudo gpasswd -a ana devs', '$ getent group devs', '$ id -nG ana', '$ sudo gpasswd -d ana devs && getent group devs'] },

      { h2: 'Os grupos que já existem e o que eles concedem' },
      {
        table: {
          head: ['Grupo', 'Poder que concede'],
          rows: [
            ['<code>sudo</code> (ou <code>wheel</code>)', 'usar <code>sudo</code> — na prática, virar root'],
            ['<code>adm</code>', 'ler os logs de <code>/var/log</code>'],
            ['<code>docker</code>', '<strong>equivalente a root</strong>: quem fala com o daemon monta o disco inteiro dentro de um container'],
            ['<code>www-data</code>', 'identidade dos servidores web'],
            ['<code>dialout</code>, <code>plugdev</code>', 'portas seriais e dispositivos removíveis']
          ]
        }
      },
      {
        box: 'warn', body: [
          { p: 'Colocar alguém no grupo <code>docker</code> é conceder root sem passar pelo <code>sudo</code> e sem registro em log. É uma decisão de segurança, não uma conveniência — o módulo de Docker volta a esse ponto com o exemplo concreto.' }
        ]
      },

      { h2: 'A armadilha da sessão antiga' },
      { p: 'A lista de grupos de um processo é definida no <strong>login</strong> e nunca mais é reconsultada. Por isso:' },
      {
        ascii: `sudo usermod -aG devs ana
         │
         ├─ /etc/group atualizado          ← já mudou
         └─ sessão da ana ainda aberta     ← continua com a lista antiga

       id ana        → mostra devs   (lê o arquivo)
       (na sessão) id → NÃO mostra   (lê o processo)`
      },
      { p: 'Três formas de resolver, da mais correta à mais imediata:' },
      {
        ol: [
          'sair e entrar de novo (o único jeito que atualiza tudo);',
          '<code>newgrp devs</code> — abre um shell com o grupo já valendo;',
          '<code>sudo -u ana -i</code> — inicia uma sessão nova para testar.'
        ]
      },
      { code: ['$ id -nG', '$ sudo usermod -aG adm aluno', '$ id -nG', '$ newgrp adm', '$ id -gn'] },
      {
        box: 'key', body: [
          { p: 'Quando alguém diz "adicionei ao grupo e continua dando permission denied", a primeira pergunta é: <strong>a sessão foi reaberta?</strong> Confirme comparando <code>id -nG usuario</code> (lê o arquivo) com <code>id -nG</code> dentro da sessão dele (lê o processo).' }
        ]
      },

      { h2: 'Trocar o grupo primário' },
      { p: 'Mudar o grupo primário com <code>usermod -g</code> afeta os arquivos <strong>criados dali em diante</strong> — os antigos continuam com o grupo antigo. Se a intenção é reorganizar um diretório existente, o <code>chgrp -R</code> continua sendo necessário. E, para que os arquivos novos herdem o grupo do diretório em vez do grupo primário de quem criou, o instrumento é o SGID (aula 5.6), não o <code>usermod</code>.' }
    ],
    tasks: [
      {
        id: 't6-6-a', kind: 'guiado', title: 'Entra, sai e confere',
        body: [
          { p: 'Adicione, liste, remova e observe a diferença entre o arquivo e a sessão.' },
          {
            code: [
              '$ sudo groupadd devs 2>/dev/null; sudo useradd -m ana 2>/dev/null',
              '$ sudo gpasswd -a ana devs && getent group devs',
              '$ id -nG ana',
              '$ sudo gpasswd -d ana devs && getent group devs',
              '$ sudo usermod -aG devs ana && id -nG ana'
            ]
          },
          { p: 'Agora a armadilha da sessão, com você mesmo:' },
          { code: ['$ id -nG', '$ sudo usermod -aG devs aluno', '$ id -nG', '$ newgrp devs && id -gn'] }
        ],
        hints: ['O <code>gpasswd -d</code> é a forma direta de remover alguém de um grupo — o <code>usermod</code> não tem opção para isso.'],
        solution: '<div class="code"><pre>sudo groupadd devs\nsudo useradd -m ana\nsudo gpasswd -a ana devs\ngetent group devs\nsudo gpasswd -d ana devs\nsudo usermod -aG devs ana\nsudo usermod -aG devs aluno\nid -nG ana\nnewgrp devs\nid -gn</pre></div>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          if (!m.groupByName('devs')) return { ok: false, msg: 'Crie o grupo <code>devs</code>.' };
          return LX.H.checkAll([
            [!!m.userByName('ana'), 'Crie a usuária <code>ana</code>.'],
            [() => H.usedCommand(ctx, /gpasswd\s+-a/), 'Adicione a <code>ana</code> ao grupo com <code>gpasswd -a</code>.'],
            [() => H.usedCommand(ctx, /gpasswd\s+-d/), 'Remova a <code>ana</code> do grupo com <code>gpasswd -d</code> para ver a diferença.'],
            [m.groupsOfUser('ana').some(g => g.name === 'devs'), 'Ao final, a <code>ana</code> deve estar de volta no grupo <code>devs</code>.'],
            [m.groupsOfUser('aluno').some(g => g.name === 'devs'), 'Adicione também o <code>aluno</code> ao grupo <code>devs</code>.']
          ]);
        }
      },
      {
        id: 't6-6-q', kind: 'quiz', title: 'Conceito: adicionou e continua sem acesso',
        body: [
          { p: 'Você roda <code>sudo usermod -aG devs ana</code>, confere com <code>getent group devs</code> e a <code>ana</code> aparece listada. Mesmo assim, na sessão dela, um <code>ls</code> em uma pasta do grupo <code>devs</code> continua dando "Permission denied". O que falta?' }
        ],
        options: [
          { text: 'A lista de grupos de um processo é fixada no login e não é reconsultada — a sessão da ana precisa ser reaberta (ou usar <code>newgrp devs</code>) para valer.', correct: true },
          { text: 'O <code>usermod -aG</code> não gravou de verdade: é preciso repetir o comando duas vezes.', why: 'O <code>getent group devs</code> já mostra que gravou — o arquivo está certo, o que está desatualizado é a sessão.' },
          { text: 'A pasta precisa ganhar permissão de outros (<code>o+rwx</code>), porque grupo secundário não dá acesso de leitura.', why: 'Grupo secundário concede acesso normalmente; abrir para "outros" seria liberar geral, o oposto do que se quer.' },
          { text: 'Só o grupo primário conta para permissões de arquivo; grupos secundários são só para exibição no <code>id</code>.', why: 'Os grupos secundários contam sim para permissão — é exatamente o mecanismo usado para dar acesso compartilhado.' }
        ],
        explain: 'É a armadilha da sessão antiga: <code>/etc/group</code> mudou na hora, mas o processo da sessão aberta continua com a lista de grupos que carregou no login. Confirme comparando <code>id -nG ana</code> (lê o arquivo) com um <code>id -nG</code> rodado dentro da sessão dela (lê o processo).'
      },
      {
        id: 't6-6-b', kind: 'desafio', title: 'Área compartilhada de ponta a ponta',
        body: [
          { p: 'Este desafio junta o módulo 5 e o 6. A equipe de dados precisa de uma área em <code>/srv/dados-eq</code> com estas propriedades:' },
          {
            ul: [
              'existe um grupo <code>dados</code> com <strong>ana</strong> e <strong>bruno</strong> como membros (ambos são contas de pessoa, com home e bash);',
              'o diretório pertence a <code>root:dados</code>;',
              'membros do grupo leem, criam e apagam ali dentro;',
              'arquivos criados lá <strong>herdam o grupo <code>dados</code></strong>;',
              'um membro não pode apagar arquivo de outro;',
              'quem não é do grupo não tem acesso nenhum.'
            ]
          },
          { p: 'Comprove criando um arquivo como a <code>ana</code> e conferindo o grupo com <code>ls -l</code>.' }
        ],
        hints: [
          'A parte de contas é <code>groupadd</code> + <code>useradd -m -s /bin/bash</code> + <code>usermod -aG</code>. A parte de permissões você já viu na aula 5.6.',
          'Herança de grupo é SGID (2), proteção contra apagar o do outro é sticky (1): modo <code>3770</code>.',
          '<code>sudo groupadd dados</code>; <code>sudo useradd -m -s /bin/bash ana</code>; <code>sudo useradd -m -s /bin/bash bruno</code>; <code>sudo usermod -aG dados ana</code>; <code>sudo usermod -aG dados bruno</code>; <code>sudo mkdir -p /srv/dados-eq</code>; <code>sudo chown root:dados /srv/dados-eq</code>; <code>sudo chmod 3770 /srv/dados-eq</code>; <code>sudo -u ana touch /srv/dados-eq/nota-ana.txt</code>'
        ],
        solution: '<div class="code"><pre>sudo groupadd dados\nsudo useradd -m -s /bin/bash ana\nsudo useradd -m -s /bin/bash bruno\nsudo usermod -aG dados ana\nsudo usermod -aG dados bruno\nsudo mkdir -p /srv/dados-eq\nsudo chown root:dados /srv/dados-eq\nsudo chmod 3770 /srv/dados-eq\nsudo -u ana touch /srv/dados-eq/nota-ana.txt\nls -ld /srv/dados-eq\nsudo ls -l /srv/dados-eq</pre></div><p style="margin-top:8px">Esse conjunto — grupo + SGID + sticky + nada para outros — é o padrão de área compartilhada em servidores Linux há décadas. Vale memorizar como receita.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const g = m.groupByName('dados');
          if (!g) return { ok: false, msg: 'O grupo <code>dados</code> ainda não existe.' };
          const dir = H.mode(ctx, '/srv/dados-eq');
          if (dir === null) return { ok: false, msg: 'O diretório <code>/srv/dados-eq</code> ainda não existe.' };
          const o = H.owner(ctx, '/srv/dados-eq');
          const membros = ['ana', 'bruno'].filter(u => m.userByName(u) && m.groupsOfUser(u).some(x => x.name === 'dados'));
          const conteudo = H.ls(ctx, '/srv/dados-eq') || [];
          const criado = conteudo.map(e => H.owner(ctx, '/srv/dados-eq/' + (e.name || e))).filter(Boolean);
          return LX.H.checkAll([
            [membros.length === 2, `Ana e bruno precisam existir e estar no grupo <code>dados</code>. No grupo agora: ${membros.join(', ') || 'ninguém'}.`],
            [o.user === 'root' && o.group === 'dados', `O diretório deve pertencer a <code>root:dados</code>; está <code>${o.user}:${o.group}</code>.`],
            [(dir & 0o070) === 0o070, `O grupo precisa de <code>rwx</code>. Modo atual: ${dir.toString(8)}.`],
            [(dir & 0o007) === 0, `Outros não podem ter acesso. Modo atual: ${dir.toString(8)}.`],
            [(dir & 0o2000) !== 0, 'Falta o SGID para a herança de grupo.'],
            [(dir & 0o1000) !== 0, 'Falta o sticky bit para impedir que um membro apague o arquivo do outro.'],
            [criado.length > 0, 'Crie um arquivo lá dentro (por exemplo como a <code>ana</code>) para comprovar a herança.'],
            [criado.every(x => x.group === 'dados'), 'O arquivo criado não herdou o grupo <code>dados</code> — ligue o SGID <strong>antes</strong> de criá-lo.']
          ]);
        }
      }
    ]
  });

  /* ============================== 6.7 ============================== */
  LX.lesson('m06', {
    id: 'l6-7', n: '6.7', title: 'Auditoria de contas',
    goal: 'Responder, em um servidor herdado, quem tem acesso, com qual poder, e o que está fora do padrão.',
    body: [
      { p: 'Assumir a administração de uma máquina que você não configurou começa sempre pelas mesmas perguntas. Cada uma tem um comando.' },

      { h2: 'Quem existe e quem pode entrar' },
      {
        code: [
          '$ getent passwd | awk -F: \'$3>=1000 && $3<60000 {print $1, $3, $7}\'',
          '$ getent passwd | awk -F: \'$7 ~ /(bash|sh|zsh)$/ {print $1, $7}\'',
          '$ sudo getent shadow | awk -F: \'$2=="" {print "SEM SENHA:", $1}\'',
          '$ sudo getent shadow | awk -F: \'$2 ~ /^!/ {print "bloqueada:", $1}\''
        ]
      },
      { p: 'A segunda linha é a mais reveladora: uma <strong>conta de serviço com shell de verdade</strong> é um caminho de acesso que ninguém está monitorando.' },

      { h2: 'Quem é administrador' },
      { code: ['$ getent group sudo', '$ getent group adm', '$ sudo grep -rv "^#" /etc/sudoers.d/ 2>/dev/null | grep .', '$ sudo cat /etc/sudoers | grep -v "^#" | grep .'] },
      { p: 'Não basta olhar o grupo <code>sudo</code>: regras avulsas em <code>/etc/sudoers.d/</code> podem dar poder a quem não está em grupo nenhum.' },

      { h2: 'Quem entrou, e quando' },
      {
        table: {
          head: ['Comando', 'Responde'],
          rows: [
            ['<code>last</code>', 'histórico de logins (de <code>/var/log/wtmp</code>)'],
            ['<code>last -f /var/log/btmp</code>', 'tentativas <strong>falhas</strong>'],
            ['<code>lastlog</code>', 'último login de <em>cada</em> conta — inclusive "nunca"'],
            ['<code>who</code> / <code>w</code>', 'quem está conectado agora'],
            ['<code>grep sudo /var/log/auth.log</code>', 'o que foi elevado, por quem']
          ]
        }
      },
      { code: ['$ last | head -5', '$ lastlog | head -8', '$ who', '$ sudo grep "sudo:" /var/log/auth.log | tail -5'] },
      {
        box: 'tip', body: [
          { p: 'Contas com <code>**Never logged in**</code> no <code>lastlog</code> e shell de login são as primeiras candidatas a desativação: alguém criou e ninguém usa.' }
        ]
      },

      { h2: 'Chaves SSH esquecidas' },
      { p: 'A auditoria que quase ninguém faz — e que costuma render as descobertas mais desconfortáveis:' },
      { code: ['$ sudo find /home /root -name authorized_keys 2>/dev/null', '$ sudo find /home -name authorized_keys -exec ls -l {} \\; 2>/dev/null'] },
      { p: 'Cada linha desses arquivos é um acesso permanente que não depende de senha, não expira e não aparece em nenhuma lista de usuários.' },

      { h2: 'Uma rotina de revisão' },
      {
        ol: [
          'listar contas humanas e comparar com a lista real da equipe;',
          'conferir quem está em <code>sudo</code>, <code>adm</code> e <code>docker</code>;',
          'procurar contas de serviço com shell interativo;',
          'procurar contas sem senha e sem expiração;',
          'listar <code>authorized_keys</code> e confirmar cada chave com seu dono;',
          'desativar (não apagar) o que sobrar sem explicação, e revisar de novo em 30 dias.'
        ]
      }
    ],
    tasks: [
      {
        id: 't6-7-a', kind: 'guiado', title: 'Rode a revisão',
        body: [
          { p: 'Percorra a rotina em uma máquina que você não configurou — esta.' },
          {
            code: [
              '$ getent passwd | awk -F: \'$3>=1000 && $3<60000 {print $1, $3, $7}\'',
              '$ getent group sudo && getent group adm',
              '$ getent passwd | awk -F: \'$3<1000 && $7 ~ /(bash|sh)$/ {print $1, $7}\'',
              '$ lastlog | head -8',
              '$ sudo find /home /root -name authorized_keys 2>/dev/null',
              '$ sudo grep "sudo:" /var/log/auth.log | tail -5'
            ]
          }
        ],
        hints: ['O terceiro comando procura contas de sistema com shell interativo — é o achado mais comum.'],
        solution: '<div class="code"><pre>getent passwd | awk -F: \'$3&gt;=1000 &amp;&amp; $3&lt;60000 {print $1, $3, $7}\'\ngetent group sudo\ngetent group adm\nlastlog | head -8\nsudo find /home /root -name authorized_keys 2&gt;/dev/null\nsudo grep "sudo:" /var/log/auth.log | tail -5</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /getent\s+passwd/), 'Liste as contas com <code>getent passwd</code>.'],
          [() => H.usedCommand(ctx, /getent\s+group\s+(sudo|adm)/), 'Confira quem é administrador com <code>getent group sudo</code>.'],
          [() => H.usedCommand(ctx, /lastlog|last\b/), 'Veja o histórico de logins com <code>lastlog</code> ou <code>last</code>.'],
          [() => H.usedCommand(ctx, /authorized_keys/), 'Procure chaves SSH esquecidas com <code>find ... -name authorized_keys</code>.']
        ])
      },
      {
        id: 't6-7-q', kind: 'quiz', title: 'Conceito: o achado que interessa',
        body: [
          { p: 'Você audita um servidor herdado e encontra isto:' },
          { code: ['legado:x:850:850::/home/legado:/bin/bash'], run: false, mixed: false, lang: 'text' },
          { p: 'UID 850, shell <code>/bin/bash</code>. Por que essa linha, sozinha, já é motivo de atenção?' }
        ],
        options: [
          { text: 'É uma conta de sistema (UID abaixo de 1000) com shell interativo — um caminho de acesso que ninguém costuma monitorar como se monitora uma conta de pessoa.', correct: true },
          { text: 'O UID 850 é inválido; contas de sistema têm que estar entre 1 e 100.', why: 'A faixa de sistema no Debian/Ubuntu vai até 999; 850 é um UID de sistema perfeitamente válido — o problema é o shell, não o número.' },
          { text: 'O diretório pessoal deveria ser <code>/home/legado</code> mesmo sendo conta de sistema, e isso está certo.', why: 'O diretório em si não é o achado da auditoria; contas de serviço frequentemente nem deveriam ter diretório em <code>/home</code>, mas o que a pergunta destaca é outra coisa.' },
          { text: 'Nada de errado: toda conta do <code>/etc/passwd</code> precisa ter um shell de login.', why: 'Contas de serviço deveriam ter <code>/usr/sbin/nologin</code> ou <code>/bin/false</code> — um shell de verdade nelas é exatamente o que a auditoria procura.' }
        ],
        explain: 'Uma conta de serviço com shell interativo pode ser usada para login como qualquer conta de pessoa, mas ninguém a inclui na revisão de "quem tem acesso" porque tecnicamente não é uma conta humana. É o tipo de achado que a seção <code>SERVICO-COM-SHELL</code> do relatório existe para revelar.'
      },
      {
        id: 't6-7-b', kind: 'desafio', title: 'Relatório de acesso',
        body: [
          { p: 'Primeiro, plante três problemas típicos em um servidor herdado:' },
          {
            code: [
              '$ sudo useradd -m -s /bin/bash ana 2>/dev/null',
              '$ sudo useradd -r -s /bin/bash legado 2>/dev/null',
              '$ sudo useradd -r -s /usr/sbin/nologin appsvc 2>/dev/null',
              '$ sudo usermod -aG sudo ana'
            ]
          },
          { p: 'Agora produza <code>~/auditoria-contas.txt</code> com exatamente três seções, nesta ordem e com estes títulos:' },
          {
            code: [
              '== HUMANAS ==',
              '(uma linha por conta de UID entre 1000 e 59999, só o nome)',
              '== ADMINS ==',
              '(uma linha por membro do grupo sudo, só o nome)',
              '== SERVICO-COM-SHELL ==',
              '(uma linha por conta de sistema — UID entre 1 e 999 — cujo shell termina em sh, só o nome;',
              ' o root fica de fora: ele obviamente tem shell, e não é isso que estamos procurando)'
            ], run: false, lang: 'text'
          },
          { p: 'A terceira seção é o achado que interessa: uma conta de sistema com shell interativo.' }
        ],
        hints: [
          'Use <code>echo</code> para os títulos e <code>>></code> para acumular no mesmo arquivo.',
          'Para os membros do grupo sudo: <code>getent group sudo | cut -d: -f4 | tr "," "\\n"</code>.',
          'Monte em etapas: <code>echo "== HUMANAS ==" > ~/auditoria-contas.txt</code>, depois cada bloco com <code>>></code>.'
        ],
        solution: '<div class="code"><pre>sudo useradd -m -s /bin/bash ana\nsudo useradd -r -s /bin/bash legado\nsudo useradd -r -s /usr/sbin/nologin appsvc\nsudo usermod -aG sudo ana\n\necho "== HUMANAS ==" &gt; ~/auditoria-contas.txt\ngetent passwd | awk -F: \'$3&gt;=1000 &amp;&amp; $3&lt;60000 {print $1}\' &gt;&gt; ~/auditoria-contas.txt\n\necho "== ADMINS ==" &gt;&gt; ~/auditoria-contas.txt\ngetent group sudo | cut -d: -f4 | tr "," "\\n" | grep . &gt;&gt; ~/auditoria-contas.txt\n\necho "== SERVICO-COM-SHELL ==" &gt;&gt; ~/auditoria-contas.txt\ngetent passwd | awk -F: \'$3&gt;0 &amp;&amp; $3&lt;1000 &amp;&amp; $7 ~ /sh$/ {print $1}\' &gt;&gt; ~/auditoria-contas.txt\n\ncat ~/auditoria-contas.txt</pre></div><p style="margin-top:8px">O relatório sozinho não resolve nada — mas transforma "acho que está tudo certo" em três listas que dá para discutir com o time.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/auditoria-contas.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/auditoria-contas.txt</code> ainda não existe.' };
          const m = ctx.machine || ctx.sh.m;
          if (!m.userByName('legado')) return { ok: false, msg: 'Monte o cenário do enunciado (as contas <code>ana</code>, <code>legado</code> e <code>appsvc</code>).' };
          const linhas = c.split('\n').map(x => x.trim());
          const iH = linhas.indexOf('== HUMANAS ==');
          const iA = linhas.indexOf('== ADMINS ==');
          const iS = linhas.indexOf('== SERVICO-COM-SHELL ==');
          const bloco = (a, b) => linhas.slice(a + 1, b < 0 ? linhas.length : b).filter(x => x);
          if (iH < 0 || iA < 0 || iS < 0) return { ok: false, msg: 'As três seções precisam aparecer com os títulos exatos <code>== HUMANAS ==</code>, <code>== ADMINS ==</code> e <code>== SERVICO-COM-SHELL ==</code>.' };
          const humanas = bloco(iH, iA), admins = bloco(iA, iS), servico = bloco(iS, -1);
          /* as três listas corretas saem do estado real da máquina */
          /* shell interativo de verdade: bash, sh, zsh… — nem nologin, nem
             /bin/false, nem casos especiais como /bin/sync */
          const interativo = (u) => /sh$/.test(u.shell || '');
          const humanasR = m.users().filter(u => u.uid >= 1000 && u.uid < 60000).map(u => u.name).sort();
          const adminsR = (m.groupByName('sudo') || { members: [] }).members.slice().sort();
          const servicoR = m.users().filter(u => u.uid > 0 && u.uid < 1000 && interativo(u)).map(u => u.name).sort();
          const igual = (a, b) => { const x = a.slice().sort(), y = b.slice().sort();
            return x.length === y.length && x.every((v, i) => v === y[i]); };
          return LX.H.checkAll([
            [iH < iA && iA < iS, 'As seções devem aparecer nesta ordem: HUMANAS, ADMINS, SERVICO-COM-SHELL.'],
            [() => igual(humanas, humanasR), () => `A seção HUMANAS não bate com a máquina. As contas humanas aqui são: ${humanasR.join(', ')}.`],
            [() => igual(admins, adminsR), () => `A seção ADMINS não bate com os membros reais do grupo <code>sudo</code>: ${adminsR.join(', ') || '(nenhum)'}.`],
            [() => igual(servico, servicoR), () => `A seção SERVICO-COM-SHELL não bate. Contas de sistema com shell interativo: ${servicoR.join(', ') || '(nenhuma)'}.`]
          ]);
        }
      }
    ]
  });

})();
