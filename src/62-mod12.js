/* =========================================================================
   MÓDULO 12 — Gerenciamento de pacotes
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const temPacote = (ctx, nome) => {
    const m = ctx.machine || ctx.sh.m;
    return m.packages.has(nome);
  };

  /* ============================== 12.1 ============================== */
  LX.lesson('m12', {
    id: 'l12-1', n: '12.1', title: 'Como o Linux instala software',
    goal: 'Entender o modelo de repositórios e dependências — e por que baixar instaladores de sites não é o jeito Linux de fazer as coisas.',
    body: [
      { lede: 'No Windows você procura o site, baixa um .exe e clica em avançar. No Linux, o sistema já sabe onde ficam dezenas de milhares de programas, com assinatura criptográfica e atualização centralizada.' },
      {
        ascii: `  REPOSITÓRIO                 SUA MÁQUINA

  servidor da distribuição      apt update      lista local de
  ┌────────────────────┐  ──────────────────▶  pacotes e versões
  │ nginx 1.28.0       │                              │
  │ curl 8.14.1        │       apt install nginx      ▼
  │ python3 3.13       │  ◀────────────────────  resolve dependências
  │ ...50.000 pacotes  │                         baixa, verifica
  └────────────────────┘                         assinatura, instala`
      },
      {
        table: {
          head: ['Conceito', 'O que é'],
          rows: [
            ['<strong>pacote</strong>', 'um arquivo <code>.deb</code> (Debian/Ubuntu) ou <code>.rpm</code> (RHEL/Fedora) com binários, configuração e metadados'],
            ['<strong>repositório</strong>', 'servidor com milhares de pacotes, assinado criptograficamente'],
            ['<strong>dependência</strong>', 'outro pacote que este precisa para funcionar — resolvida automaticamente'],
            ['<strong>índice local</strong>', 'a cópia da lista do repositório na sua máquina (<code>apt update</code> atualiza)'],
            ['<strong>gerenciador</strong>', '<code>apt</code>, <code>dnf</code>, <code>pacman</code>, <code>zypper</code> — a ferramenta de alto nível']
          ]
        }
      },
      {
        table: {
          head: ['Família', 'Formato', 'Alto nível', 'Baixo nível'],
          rows: [
            ['Debian / Ubuntu', '<code>.deb</code>', '<code>apt</code>', '<code>dpkg</code>'],
            ['RHEL / Fedora / Rocky', '<code>.rpm</code>', '<code>dnf</code> (antes <code>yum</code>)', '<code>rpm</code>'],
            ['Arch', '<code>.pkg.tar.zst</code>', '<code>pacman</code>', '—'],
            ['Alpine (containers)', '<code>.apk</code>', '<code>apk</code>', '—'],
            ['SUSE', '<code>.rpm</code>', '<code>zypper</code>', '<code>rpm</code>']
          ]
        }
      },
      { p: 'Este curso usa Ubuntu, então <code>apt</code> e <code>dpkg</code>. Os conceitos são idênticos nas outras famílias — muda a sintaxe.' },
      { code: ['$ cat /etc/os-release | head -3', '$ apt --version 2>/dev/null | head -1', '$ ls /etc/apt/sources.list.d/'] },

      { h2: 'De onde vêm os pacotes' },
      { p: 'A lista de repositórios do Ubuntu moderno fica em <code>/etc/apt/sources.list.d/ubuntu.sources</code>, no formato <strong>deb822</strong> — o <code>/etc/apt/sources.list</code> de uma linha por repositório é o formato antigo.' },
      { code: ['$ cat /etc/apt/sources.list', '$ cat /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null | head -12'] },
      {
        table: {
          head: ['Componente', 'O que contém'],
          rows: [
            ['<code>main</code>', 'software livre com suporte oficial da Canonical'],
            ['<code>universe</code>', 'software livre mantido pela comunidade'],
            ['<code>restricted</code>', 'drivers proprietários com suporte'],
            ['<code>multiverse</code>', 'software com restrições de licença'],
            ['<code>-updates</code>', 'atualizações depois do lançamento'],
            ['<code>-security</code>', '<strong>correções de segurança</strong> — nunca desabilite']
          ]
        }
      },
      {
        box: 'key', body: [
          { p: 'Os pacotes são <strong>assinados</strong>. O apt verifica a assinatura de cada índice contra as chaves em <code>/etc/apt/keyrings/</code> antes de instalar qualquer coisa. É por isso que um <code>curl | sudo bash</code> baixado de um site aleatório é uma prática pior do que instalar do repositório: no segundo caso você tem cadeia de confiança, no primeiro tem esperança.' }
        ]
      },
      {
        box: 'old', label: 'Prática antiga × atual', body: [
          { p: '<strong>Antigo:</strong> <code>apt-key add</code> para acrescentar a chave de um repositório de terceiros. Foi descontinuado porque a chave passava a valer para <em>todos</em> os repositórios — um repositório de terceiros comprometido poderia servir pacotes falsos do sistema.' },
          { p: '<strong>Atual:</strong> a chave vai em <code>/etc/apt/keyrings/nome.gpg</code> e o repositório declara <code>Signed-By:</code> apontando só para ela. Assim, cada repositório só pode assinar os próprios pacotes. <strong>Aprenda essa versão</strong> — é o formato que aparece na documentação de Docker, PostgreSQL e afins (e você vai usá-lo no módulo de instalação do Docker).' }
        ]
      }
    ],
    tasks: [
      {
        id: 't12-1-a', kind: 'guiado', title: 'Reconheça a distribuição e os repositórios',
        body: [
          { p: 'Descubra qual sistema é este e de onde ele instala software.' },
          {
            code: [
              '$ cat /etc/os-release | head -4',
              '$ apt --version | head -1',
              '$ ls /etc/apt/sources.list.d/',
              '$ cat /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null | head -12',
              '$ apt list --installed 2>/dev/null | head -6'
            ]
          }
        ],
        hints: ['O <code>/etc/os-release</code> é o arquivo padrão para identificar a distribuição em qualquer Linux moderno.'],
        solution: '<div class="code"><pre>cat /etc/os-release | head -4\napt --version | head -1\nls /etc/apt/sources.list.d/\ncat /etc/apt/sources.list.d/ubuntu.sources | head -12\napt list --installed 2>/dev/null | head -6</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /os-release/), 'Identifique a distribuição com <code>cat /etc/os-release</code>.'],
          [() => H.usedCommand(ctx, /sources\.list/), 'Veja os repositórios em <code>/etc/apt/sources.list.d/</code>.'],
          [() => H.usedCommand(ctx, /apt\s+list/), 'Liste os pacotes instalados com <code>apt list --installed</code>.']
        ])
      },
      {
        id: 't12-1-q', kind: 'quiz', title: 'Conceito: por que não baixar do site',
        body: [
          { p: 'Você precisa instalar o <code>curl</code> em um servidor. Qual abordagem é a correta em Linux, e por quê?' }
        ],
        options: [
          {
            text: '<code>sudo apt install curl</code> — vem assinado, com dependências resolvidas, e passa a receber atualizações de segurança automaticamente.',
            correct: true
          },
          { text: 'Baixar o código-fonte do site oficial e compilar com <code>make install</code>.', why: 'Funciona, mas o binário fica fora do controle do gerenciador: não recebe atualização de segurança e ninguém sabe que ele existe.' },
          { text: 'Baixar um <code>.deb</code> avulso de um site de downloads e instalar com <code>dpkg -i</code>.', why: 'Sem assinatura verificada e sem resolução de dependências — é o pior dos dois mundos.' },
          { text: 'Rodar <code>curl https://site/instalar.sh | sudo bash</code>.', why: 'Executa código arbitrário como root, sem verificação de assinatura e sem forma de desinstalar.' }
        ],
        explain: 'A regra prática: <strong>primeiro o repositório da distribuição</strong>; se não houver, o repositório oficial do fabricante (com chave em <code>/etc/apt/keyrings/</code>); e só em último caso compilar — nesse caso, use <code>/usr/local</code> e documente. O que você instala fora do gerenciador vira dívida: ninguém atualiza o que ninguém sabe que existe.'
      },
      {
        id: 't12-1-b', kind: 'desafio', title: 'Levante um retrato dos repositórios',
        body: [
          { p: 'Reúna em um arquivo o essencial sobre de onde esta máquina instala software. Crie <code>~/repos.txt</code> com <strong>exatamente duas linhas</strong>, nesta ordem:' },
          { ol: [
            'a linha <code>VERSION_CODENAME=...</code> extraída do <code>/etc/os-release</code>;',
            'o <strong>número</strong> de pacotes instalados (só o número).'
          ] },
          { p: 'Cada linha precisa vir de um comando — nada digitado à mão. Você já tem tudo do que precisa: <code>grep</code> para pescar a linha certa, <code>apt list --installed</code> para os pacotes e <code>wc -l</code> para contar.' }
        ],
        hints: [
          'A primeira linha sai de <code>grep VERSION_CODENAME /etc/os-release &gt; ~/repos.txt</code>.',
          'A segunda acrescenta (<code>&gt;&gt;</code>) a contagem: <code>apt list --installed 2&gt;/dev/null | wc -l &gt;&gt; ~/repos.txt</code>.'
        ],
        solution: '<div class="code"><pre>grep VERSION_CODENAME /etc/os-release &gt; ~/repos.txt\napt list --installed 2&gt;/dev/null | wc -l &gt;&gt; ~/repos.txt\ncat ~/repos.txt</pre></div>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/repos.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/repos.txt</code> ainda não existe.' };
          const linhas = c.split('\n').filter(l => l.trim());
          const esperado = ((await ctx.run('apt list --installed 2>/dev/null | wc -l')).out || '').trim();
          return LX.H.checkAll([
            [() => linhas.length >= 2, () => `O arquivo tem ${linhas.length} linha(s) com conteúdo; são esperadas 2.`],
            [() => /VERSION_CODENAME=/.test(linhas[0] || ''), 'A primeira linha deve ser a <code>VERSION_CODENAME=...</code> do <code>/etc/os-release</code>.'],
            [() => /^\d+$/.test((linhas[1] || '').trim()), 'A segunda linha deve ser só o número de pacotes instalados.'],
            [() => (linhas[1] || '').trim() === esperado, () => `A contagem não bate: <code>apt list --installed</code> conta ${esperado} pacotes, e o arquivo diz ${(linhas[1] || '').trim()}.`]
          ]);
        }
      },

    ]
  });

  /* ============================== 12.2 ============================== */
  LX.lesson('m12', {
    id: 'l12-2', n: '12.2', title: 'apt no dia a dia',
    goal: 'Instalar, atualizar, remover e pesquisar com segurança — sabendo o que cada comando faz por baixo.',
    body: [
      { cmd: 'apt' },
      {
        cheat: [
          ['<code>apt update</code>', '<strong>atualiza a lista</strong> de pacotes disponíveis (não instala nada)'],
          ['<code>apt upgrade</code>', 'atualiza os pacotes instalados'],
          ['<code>apt full-upgrade</code>', 'atualiza mesmo que precise remover algo'],
          ['<code>apt install pacote</code>', 'instala'],
          ['<code>apt remove pacote</code>', 'remove, <strong>mantendo</strong> a configuração'],
          ['<code>apt purge pacote</code>', 'remove <strong>inclusive</strong> a configuração'],
          ['<code>apt autoremove</code>', 'remove dependências que ninguém mais usa'],
          ['<code>apt search termo</code>', 'procura por nome e descrição'],
          ['<code>apt show pacote</code>', 'detalhes: versão, tamanho, dependências'],
          ['<code>apt list --installed</code>', 'o que está instalado'],
          ['<code>apt list --upgradable</code>', 'o que tem versão nova esperando']
        ]
      },
      {
        box: 'key', label: 'update ≠ upgrade', body: [
          { p: 'Esta é a confusão número um de quem vem do Windows.' },
          { ul: [
            '<code>apt update</code> — baixa a <strong>lista</strong> do que existe nos repositórios. Não instala nem atualiza nada.',
            '<code>apt upgrade</code> — instala as versões novas dos pacotes que você já tem.'
          ] },
          { p: 'Por isso a dupla é sempre nesta ordem: <code>sudo apt update && sudo apt upgrade</code>. Sem o <code>update</code> antes, o <code>upgrade</code> trabalha com uma lista possivelmente velha e conclui que não há nada a fazer.' }
        ]
      },
      { code: ['$ sudo apt update', '$ apt list --upgradable', '$ sudo apt upgrade -y | tail -5'] },

      { h2: 'Instalar e inspecionar' },
      { code: ['$ apt search nginx | head -5', '$ apt show nginx | head -10', '$ sudo apt install -y nginx | tail -5'] },
      { p: 'Repare no que a instalação fez sozinha: baixou as dependências (<code>nginx-common</code>, módulos), criou a unit do systemd e <strong>habilitou o serviço</strong>. Confirme:' },
      { code: ['$ systemctl is-enabled nginx', '$ systemctl is-active nginx', '$ curl -sI http://localhost | head -1'] },
      {
        box: 'note', body: [
          { p: 'Em Debian e Ubuntu, instalar um serviço <strong>já o inicia e habilita</strong>. Em RHEL/Fedora, não: você precisa de <code>systemctl enable --now</code>. É uma diferença cultural entre as famílias que pega muita gente desprevenida.' }
        ]
      },

      { h2: 'remove × purge × autoremove' },
      {
        table: {
          head: ['Comando', 'Binários', 'Configuração em <code>/etc</code>', 'Dependências órfãs'],
          rows: [
            ['<code>apt remove</code>', 'removidos', '<strong>mantida</strong>', 'ficam'],
            ['<code>apt purge</code>', 'removidos', '<strong>apagada</strong>', 'ficam'],
            ['<code>apt autoremove</code>', '—', '—', '<strong>removidas</strong>'],
            ['<code>apt purge --auto-remove</code>', 'removidos', 'apagada', 'removidas']
          ]
        }
      },
      { code: ['$ sudo apt remove -y nginx | tail -3', '$ apt list --installed 2>/dev/null | grep -c nginx', '$ sudo apt autoremove -y | tail -2'] },
      { p: 'O <code>remove</code> mantém a configuração de propósito: se você reinstalar depois, seus ajustes continuam lá. Quando quiser mesmo começar do zero, é <code>purge</code>.' },

      { h2: 'Segurando versões' },
      { p: 'Às vezes você <em>não quer</em> que um pacote seja atualizado — porque a versão nova quebra a aplicação, ou porque a janela de manutenção ainda não chegou:' },
      { code: ['$ sudo apt-mark hold curl', '$ apt-mark showhold', '$ sudo apt-mark unhold curl && apt-mark showhold'] },
      {
        box: 'warn', body: [
          { p: 'Um pacote "segurado" para de receber <strong>correções de segurança</strong>. É uma medida temporária, e alguém precisa lembrar de soltar. Anote em algum lugar que não seja a sua memória.' }
        ]
      },
      {
        box: 'tip', label: 'Atualizações automáticas de segurança', body: [
          { p: 'Ubuntu instala o <code>unattended-upgrades</code>, que aplica correções de segurança sozinho — em servidor, isso costuma ser desejável. Confira o estado com <code>systemctl status unattended-upgrades</code> e a configuração em <code>/etc/apt/apt.conf.d/50unattended-upgrades</code>.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't12-2-a', kind: 'guiado', title: 'O ciclo completo',
        body: [
          { p: 'Atualize a lista, instale, inspecione, remova.' },
          {
            code: [
              '$ sudo apt update | tail -2',
              '$ apt list --upgradable',
              '$ apt search nginx | head -4',
              '$ apt show nginx | head -8',
              '$ sudo apt install -y nginx | tail -4',
              '$ systemctl is-active nginx && systemctl is-enabled nginx',
              '$ curl -sI http://localhost | head -1'
            ]
          },
          { p: 'Agora remova e observe a diferença:' },
          { code: ['$ sudo apt remove -y nginx | tail -2', '$ systemctl is-active nginx 2>&1', '$ sudo apt autoremove -y | tail -2'] }
        ],
        hints: ['O <code>-y</code> responde "sim" automaticamente — em produção, rode sem ele na primeira vez e leia o que será alterado.'],
        solution: '<div class="code"><pre>sudo apt update\napt list --upgradable\napt search nginx | head -4\napt show nginx | head -8\nsudo apt install -y nginx\nsystemctl is-active nginx\ncurl -sI http://localhost | head -1\nsudo apt remove -y nginx\nsudo apt autoremove -y</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /apt\s+update/), 'Atualize a lista com <code>sudo apt update</code>.'],
          [() => H.usedCommand(ctx, /apt\s+(search|show)/), 'Pesquise um pacote com <code>apt search</code> ou <code>apt show</code>.'],
          [() => H.usedCommand(ctx, /apt\s+install\s+.*nginx/), 'Instale o <code>nginx</code>.'],
          [() => H.usedCommand(ctx, /apt\s+remove\s+.*nginx|apt\s+purge\s+.*nginx/), 'Remova o <code>nginx</code> ao final.'],
          /* o ciclo é instalar E remover; se uma aula posterior reinstalar o
             nginx, este exercício não pode voltar a ficar "não concluído" */
          [() => !temPacote(ctx, 'nginx') || H.usedCommand(ctx, /apt\s+(remove|purge)\s+.*nginx/),
            'O <code>nginx</code> ainda está instalado — remova-o para fechar o ciclo.']
        ])
      },
      {
        id: 't12-2-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um servidor não recebe atualização há meses. O administrador roda:' },
          { code: ['sudo apt upgrade -y'], run: false, mixed: false },
          { p: 'A saída diz <code>0 upgraded, 0 newly installed</code>. Ele conclui que o servidor está em dia. Onde está o erro?' }
        ],
        options: [
          { text: 'Faltou <code>sudo apt update</code> antes: o <code>upgrade</code> comparou com uma lista local desatualizada.', correct: true },
          { text: 'O comando correto seria <code>apt full-upgrade</code>.', why: 'O <code>full-upgrade</code> também compara com a mesma lista local; sem <code>update</code> daria o mesmo resultado.' },
          { text: 'Faltou o <code>-y</code>, que ele já usou.', why: 'O <code>-y</code> só evita a pergunta de confirmação.' },
          { text: 'Nada está errado: se ele diz 0, é porque está em dia.', why: 'O "0" reflete o que a lista <em>local</em> conhece — e ela pode ter meses de idade.' }
        ],
        explain: 'A dupla certa é <code>sudo apt update && sudo apt upgrade</code>. Em servidores, o hábito recomendável é conferir antes o que vai mudar: <code>apt list --upgradable</code>, e olhar com atenção quando aparecerem kernel, libc ou o banco de dados — esses pedem janela de manutenção.'
      },
      {
        id: 't12-2-b', kind: 'desafio', title: 'Prepare o servidor web',
        body: [
          { p: 'Deixe esta máquina servindo uma página em HTTP, do jeito que um provisionamento faria.' },
          { p: 'Estado final exigido:' },
          {
            ul: [
              'o pacote <code>nginx</code> instalado;',
              'o serviço <code>nginx</code> <strong>ativo</strong> e <strong>habilitado</strong> no boot;',
              'o pacote <code>curl</code> instalado e <strong>segurado</strong> (<code>hold</code>), porque a aplicação depende desta versão exata;',
              'grave em <code>~/verificacao.txt</code> a primeira linha da resposta de <code>curl -sI http://localhost</code> — deve conter <code>200 OK</code>.'
            ]
          }
        ],
        hints: [
          'Comece por <code>sudo apt update</code> e depois <code>sudo apt install -y nginx</code>.',
          'Para segurar uma versão: <code>sudo apt-mark hold curl</code>. Confira com <code>apt-mark showhold</code>.',
          '<code>curl -sI http://localhost | head -1 &gt; ~/verificacao.txt</code>'
        ],
        solution: '<div class="code"><pre>sudo apt update\nsudo apt install -y nginx\nsystemctl is-active nginx\nsystemctl is-enabled nginx\nsudo apt install -y curl\nsudo apt-mark hold curl\napt-mark showhold\ncurl -sI http://localhost | head -1 &gt; ~/verificacao.txt\ncat ~/verificacao.txt</pre></div>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const u = m.unit('nginx');
          const c = H.read(ctx, '/home/aluno/verificacao.txt');
          const segurados = m.pacotesSegurados || new Set();
          return LX.H.checkAll([
            [temPacote(ctx, 'nginx'), 'Instale o pacote <code>nginx</code>.'],
            [!!u && u.state === 'active', 'O serviço <code>nginx</code> precisa estar ativo.'],
            [!!u && u.enabled, 'O serviço <code>nginx</code> precisa estar habilitado no boot.'],
            [temPacote(ctx, 'curl'), 'Instale o pacote <code>curl</code>.'],
            [segurados.has('curl'), 'O pacote <code>curl</code> precisa estar segurado (<code>sudo apt-mark hold curl</code>).'],
            [c !== null, 'Falta o arquivo <code>~/verificacao.txt</code>.'],
            [/200 OK/.test(c || ''), `O arquivo deve conter a linha de status com <code>200 OK</code>. Conteúdo: "${(c || '').trim()}".`]
          ]);
        }
      }
    ]
  });

  /* ============================== 12.3 ============================== */
  LX.lesson('m12', {
    id: 'l12-3', n: '12.3', title: 'dpkg e investigação de pacotes',
    goal: 'Descobrir de onde veio um arquivo, o que um pacote instalou e como resolver uma instalação quebrada.',
    body: [
      { p: 'O <code>apt</code> resolve dependências e fala com o repositório. Quem de fato desempacota e registra é o <strong><code>dpkg</code></strong> — e é a ele que você recorre quando precisa investigar.' },
      { cmd: 'dpkg' },
      {
        table: {
          head: ['Comando', 'Responde'],
          rows: [
            ['<code>dpkg -l</code>', 'tudo que está instalado (com estado)'],
            ['<code>dpkg -l nginx</code>', 'o estado de um pacote'],
            ['<code>dpkg -L nginx</code>', '<strong>quais arquivos</strong> esse pacote instalou'],
            ['<code>dpkg -S /caminho/arquivo</code>', '<strong>de qual pacote</strong> veio esse arquivo'],
            ['<code>dpkg -s nginx</code>', 'metadados completos'],
            ['<code>dpkg -i pacote.deb</code>', 'instala um .deb local (sem resolver dependências)'],
            ['<code>dpkg --configure -a</code>', 'termina instalações interrompidas']
          ]
        }
      },
      { code: ['$ sudo apt install -y nginx > /dev/null 2>&1; dpkg -l | head -6', '$ dpkg -L nginx | head -10', '$ dpkg -S /usr/sbin/nginx'] },
      {
        box: 'key', label: 'As duas perguntas que salvam o dia', body: [
          { ul: [
            '<strong>"de onde veio este arquivo?"</strong> → <code>dpkg -S /caminho</code>. Essencial ao investigar um binário estranho ou descobrir qual pacote reinstalar.',
            '<strong>"o que este pacote colocou na máquina?"</strong> → <code>dpkg -L pacote</code>. Ótimo para achar o arquivo de configuração ou a unit do systemd que veio junto.'
          ] },
          { p: 'Combinadas com <code>grep</code>, respondem quase tudo: <code>dpkg -L nginx | grep systemd</code>, <code>dpkg -L nginx | grep etc</code>.' }
        ]
      },
      { code: ['$ dpkg -L nginx | grep -E "etc|systemd" | head -5', '$ dpkg -s nginx | head -8'] },

      { h2: 'Os estados do dpkg -l' },
      {
        ascii: `ii  nginx  1.28.0-1ubuntu2  amd64  small, powerful, scalable web/proxy server
││
│└─ estado atual:  i = instalado   c = só configuração   n = ausente
└── estado desejado: i = install  r = remove  h = hold

  ii  → instalado e configurado (o normal)
  rc  → removido, configuração ainda presente (apt remove)
  iU  → desempacotado mas NÃO configurado (instalação interrompida)
  iF  → meio configurado — precisa de "dpkg --configure -a"`
      },
      { code: ['$ dpkg -l | awk \'$1 != "ii" && NF > 3 {print}\' | head -5'] },

      { h2: 'Quando a instalação quebra' },
      {
        table: {
          head: ['Sintoma', 'O que fazer'],
          rows: [
            ['<code>dpkg was interrupted</code>', '<code>sudo dpkg --configure -a</code>'],
            ['<code>unmet dependencies</code>', '<code>sudo apt --fix-broken install</code>'],
            ['<code>Could not get lock /var/lib/dpkg/lock</code>', 'outro apt está rodando — espere; se travou, veja o processo com <code>ps aux | grep apt</code>'],
            ['<code>Unable to locate package</code>', 'faltou <code>apt update</code>, ou o pacote está em outro componente (universe)'],
            ['<code>NO_PUBKEY</code>', 'a chave do repositório não está em <code>/etc/apt/keyrings/</code>']
          ]
        }
      },
      {
        box: 'warn', body: [
          { p: 'Nunca apague <code>/var/lib/dpkg/lock</code> à mão porque um tutorial mandou. Se houver mesmo um <code>apt</code> rodando (inclusive o <code>unattended-upgrades</code> automático), remover o lock corrompe o banco de pacotes. Verifique antes: <code>ps aux | grep -E "apt|dpkg"</code>.' }
        ]
      },
      { p: 'Instalar um <code>.deb</code> avulso é o caso em que os dois se combinam:' },
      {
        code: [
          '# dpkg instala, mas não resolve dependências:',
          'sudo dpkg -i pacote.deb',
          '# se reclamar de dependências, o apt conserta:',
          'sudo apt --fix-broken install'
        ], run: false, lang: 'text'
      },
      {
        box: 'tip', body: [
          { p: 'Prefira <code>sudo apt install ./pacote.deb</code> (com o <code>./</code>): o apt instala o arquivo local <em>e</em> resolve as dependências pelo repositório, em um passo. É a forma moderna do velho par <code>dpkg -i</code> + <code>--fix-broken</code>.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't12-3-a', kind: 'guiado', title: 'Investigue um pacote',
        body: [
          { p: 'Descubra o que o nginx instalou e de onde veio cada arquivo.' },
          {
            code: [
              '$ sudo apt install -y nginx > /dev/null 2>&1',
              '$ dpkg -l | grep nginx',
              '$ dpkg -L nginx | head -12',
              '$ dpkg -L nginx | grep -E "etc|systemd"',
              '$ dpkg -S /usr/sbin/nginx',
              '$ dpkg -s nginx | head -6'
            ]
          }
        ],
        hints: ['<code>dpkg -L</code> lista os arquivos <strong>de um pacote</strong>; <code>dpkg -S</code> faz o caminho inverso, de um arquivo para o pacote.'],
        solution: '<div class="code"><pre>sudo apt install -y nginx\ndpkg -l | grep nginx\ndpkg -L nginx | head -12\ndpkg -L nginx | grep -E "etc|systemd"\ndpkg -S /usr/sbin/nginx\ndpkg -s nginx | head -6</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [temPacote(ctx, 'nginx'), 'Instale o <code>nginx</code> para investigar.'],
          [() => H.usedCommand(ctx, /dpkg\s+-L/), 'Liste os arquivos do pacote com <code>dpkg -L nginx</code>.'],
          [() => H.usedCommand(ctx, /dpkg\s+-S/), 'Descubra a origem de um arquivo com <code>dpkg -S</code>.'],
          [() => H.usedCommand(ctx, /dpkg\s+-[ls]\b/), 'Consulte o estado do pacote com <code>dpkg -l</code> ou <code>dpkg -s</code>.']
        ])
      },
      {
        id: 't12-3-q', kind: 'quiz', title: 'Conceito: instalação interrompida',
        body: [
          { p: 'Uma queda de energia interrompeu um <code>apt upgrade</code>. Ao voltar, qualquer <code>apt install</code> falha com:' },
          { code: ['E: dpkg was interrupted, you must manually run \'sudo dpkg --configure -a\' to correct the problem.'], run: false, mixed: false, lang: 'text' },
          { p: 'O que fazer?' }
        ],
        options: [
          { text: 'Rodar exatamente o que a mensagem pede: <code>sudo dpkg --configure -a</code>, que termina a configuração dos pacotes desempacotados.', correct: true },
          { text: 'Apagar <code>/var/lib/dpkg/lock</code> e tentar de novo.', why: 'O lock não é o problema aqui, e removê-lo com um apt em andamento corrompe o banco de pacotes.' },
          { text: 'Reinstalar o sistema operacional.', why: 'Desproporcional: o estado é recuperável com um comando.' },
          { text: '<code>sudo apt remove --purge</code> em todos os pacotes pendentes.', why: 'Removeria software em uso; o correto é concluir a configuração pendente.' }
        ],
        explain: 'O dpkg trabalha em duas fases: <em>unpack</em> (coloca os arquivos no lugar) e <em>configure</em> (roda os scripts de pós-instalação). Uma interrupção deixa pacotes no estado <code>iU</code>, visível em <code>dpkg -l</code>. O <code>--configure -a</code> retoma a segunda fase de todos eles. Se ainda restarem dependências quebradas, o complemento é <code>sudo apt --fix-broken install</code>.'
      },
      {
        id: 't12-3-b', kind: 'desafio', title: 'De qual pacote veio?',
        body: [
          { p: 'Você está auditando um servidor herdado. Alguém, em algum momento, instalou coisas fora do gerenciador de pacotes — e a primeira tarefa da auditoria é descobrir o quê.' },
          { p: 'O cenário já tem um binário suspeito plantado:' },
          { code: ['$ sudo mkdir -p /usr/local/bin', '$ echo \'#!/bin/bash\' | sudo tee /usr/local/bin/deploy > /dev/null', '$ sudo chmod +x /usr/local/bin/deploy'] },
          { p: 'Gere <code>~/origens.txt</code> com <strong>uma linha por binário</strong>, no formato exato <code>binário:pacote</code>, para estes quatro caminhos, nesta ordem:' },
          {
            code: [
              '/usr/sbin/nginx',
              '/usr/bin/curl',
              '/bin/bash',
              '/usr/local/bin/deploy'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Exemplo de uma linha: <code>/bin/bash:bash</code>. Os nomes dos pacotes precisam vir do <code>dpkg</code>, não da sua memória.' },
          { p: 'Um dos quatro não vai ter pacote. Para ele, escreva <code>(nenhum)</code> no lugar do nome — e é justamente essa linha que interessa a uma auditoria: um executável que ninguém sabe de onde veio, que nenhuma atualização de segurança vai corrigir.' },
          { p: 'Instale o que faltar antes de consultar.' }
        ],
        hints: [
          'O <code>dpkg -S CAMINHO</code> devolve algo como <code>nginx: /usr/sbin/nginx</code> — você precisa inverter e trocar o separador.',
          'O <code>cut -d: -f1</code> extrai o nome do pacote da saída do <code>dpkg -S</code>.',
          'Quando o <code>dpkg -S</code> não encontra o arquivo, ele escreve o erro no <strong>stderr</strong> e sai com código diferente de zero — dá para tratar com <code>|| echo "(nenhum)"</code>.',
          'Um laço resolve: <code>for b in /usr/sbin/nginx /usr/bin/curl /bin/bash /usr/local/bin/deploy; do p=$(dpkg -S "$b" 2>/dev/null | cut -d: -f1); echo "$b:${p:-(nenhum)}"; done &gt; ~/origens.txt</code>'
        ],
        solution: '<div class="code"><pre>sudo apt install -y nginx curl &gt; /dev/null 2&gt;&amp;1\nfor b in /usr/sbin/nginx /usr/bin/curl /bin/bash /usr/local/bin/deploy; do p=$(dpkg -S "$b" 2&gt;/dev/null | cut -d: -f1); echo "$b:${p:-(nenhum)}"; done &gt; ~/origens.txt\ncat ~/origens.txt</pre></div><p style="margin-top:8px">Esse mapeamento é a base de uma auditoria: qualquer binário em <code>/usr/bin</code> que o <code>dpkg -S</code> não reconheça foi instalado fora do gerenciador — e merece uma explicação.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/origens.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/origens.txt</code> ainda não existe.' };
          const l = c.split('\n').map(x => x.trim()).filter(x => x);
          const par = (i) => (l[i] || '').split(':');
          return LX.H.checkAll([
            [temPacote(ctx, 'nginx'), 'Instale o <code>nginx</code> antes de consultar a origem do binário.'],
            [H.exists(ctx, '/usr/local/bin/deploy'), 'Monte o cenário do enunciado: falta o binário avulso em <code>/usr/local/bin/deploy</code>.'],
            [l.length === 4, () => `O arquivo deve ter exatamente 4 linhas; tem ${l.length}.`],
            [l.every(x => /^\/\S+:\S+$/.test(x)), 'Cada linha deve estar no formato <code>/caminho/do/binario:pacote</code>, sem espaços.'],
            [() => par(0)[0] === '/usr/sbin/nginx' && par(0)[1] === 'nginx', () => `A primeira linha deve ser <code>/usr/sbin/nginx:nginx</code>; está "${l[0]}".`],
            [() => par(1)[0] === '/usr/bin/curl' && par(1)[1] === 'curl', () => `A segunda linha deve ser <code>/usr/bin/curl:curl</code>; está "${l[1]}".`],
            [() => par(2)[0] === '/bin/bash' && par(2)[1] === 'bash', () => `A terceira linha deve ser <code>/bin/bash:bash</code>; está "${l[2]}".`],
            /* o achado que interessa: um binário que não veio de pacote nenhum */
            [() => par(3)[0] === '/usr/local/bin/deploy' && par(3)[1] === '(nenhum)', () => `A quarta linha deve ser <code>/usr/local/bin/deploy:(nenhum)</code> — esse binário não veio de pacote algum. Está "${l[3] || ''}".`],
            [() => H.usedCommand(ctx, /dpkg\s+-S/), 'A origem deve vir do <code>dpkg -S</code>.']
          ]);
        }
      },

    ]
  });

})();
