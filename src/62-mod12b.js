/* =========================================================================
   MÓDULO 12 — Pacotes (continuação: 12.4 e 12.5)
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const ler = (ctx, p) => H.read(ctx, p) || '';
  const rodar = async (ctx, cmd) => (ctx.run ? (await ctx.run(cmd)).out : '');

  /* ============================== 12.4 ============================== */
  LX.lesson('m12', {
    id: 'l12-4', n: '12.4', title: 'Repositórios: de onde os pacotes realmente vêm',
    goal: 'Ler e escrever a configuração de repositórios — e entender por que o apt confia (ou recusa) o que baixa.',
    body: [
      { h2: 'O apt não sabe nada sozinho' },
      { p: 'Quando você digita <code>apt install nginx</code>, o apt não sai procurando na internet. Ele consulta um <strong>índice local</strong>, baixado da última vez que alguém rodou <code>apt update</code>, que lista tudo que os repositórios configurados oferecem. Repositório é a lista de endereços de onde esse índice vem.' },
      { p: 'Isso explica dois comportamentos que confundem:' },
      {
        ul: [
          '<code>apt install</code> falha com "não encontrado" para um pacote que existe — o índice está velho, faltou <code>apt update</code>.',
          '<code>apt upgrade</code> diz "0 atualizados" num servidor abandonado há meses — de novo, o índice é antigo. O apt está comparando com uma foto velha do mundo.'
        ]
      },

      { h2: 'Onde a configuração mora' },
      { code: ['$ ls /etc/apt/', '$ cat /etc/apt/sources.list.d/ubuntu.sources'] },
      {
        table: {
          head: ['Caminho', 'O que é'],
          rows: [
            ['<code>/etc/apt/sources.list</code>', 'formato antigo, uma linha por repositório'],
            ['<code>/etc/apt/sources.list.d/*.sources</code>', 'formato <strong>deb822</strong>, um bloco por repositório — o atual'],
            ['<code>/etc/apt/keyrings/</code>', 'chaves públicas de repositórios <strong>de terceiros</strong>'],
            ['<code>/usr/share/keyrings/</code>', 'chaves que vieram de pacotes (a do próprio Ubuntu está aqui)'],
            ['<code>/var/lib/apt/lists/</code>', 'o índice baixado — o que o <code>apt update</code> atualiza'],
            ['<code>/etc/apt/preferences.d/</code>', 'regras de prioridade entre repositórios (<em>pinning</em>)']
          ]
        }
      },

      { h2: 'Lendo o formato deb822 campo a campo' },
      {
        code: [
          'Types: deb',
          'URIs: http://br.archive.ubuntu.com/ubuntu/',
          'Suites: resolute resolute-updates resolute-backports',
          'Components: main restricted universe multiverse',
          'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg'
        ], run: false, lang: 'text'
      },
      {
        table: {
          head: ['Campo', 'Significa'],
          rows: [
            ['<code>Types</code>', '<code>deb</code> = binários; <code>deb-src</code> = código-fonte'],
            ['<code>URIs</code>', 'o servidor (o <em>mirror</em>). Trocar por um mais perto acelera o download'],
            ['<code>Suites</code>', 'a versão da distribuição e suas variações — veja abaixo'],
            ['<code>Components</code>', 'as seções do repositório'],
            ['<code>Signed-By</code>', 'com <strong>qual chave</strong> este repositório deve estar assinado']
          ]
        }
      },
      {
        box: 'key', label: 'As três suítes que importam num servidor', body: [
          {
            ul: [
              '<code>resolute</code> — os pacotes como saíram no dia do lançamento. Congelados.',
              '<code>resolute-updates</code> — correções não urgentes acumuladas depois.',
              '<code>resolute-security</code> — <strong>correções de segurança</strong>. É a única que você não pode se dar ao luxo de desabilitar.'
            ]
          },
          { p: 'E os <code>Components</code>: <code>main</code> é software livre com suporte oficial da Canonical; <code>restricted</code> tem drivers proprietários; <code>universe</code> é mantido pela comunidade; <code>multiverse</code> tem restrição de licença. Em servidor, saber que um pacote veio do <code>universe</code> muda a expectativa de suporte.' }
        ]
      },

      { h2: 'apt policy: qual versão o apt escolheria, e por quê' },
      { code: ['$ apt policy', '$ apt policy nginx'] },
      { p: 'O <code>apt policy</code> sem argumento lista os repositórios com a <strong>prioridade</strong> de cada um (500 é o padrão). Com um pacote, mostra a versão instalada, a candidata e de qual repositório cada versão viria. É a resposta definitiva para "por que o apt insiste nessa versão".' },

      { h2: 'Assinatura: por que o apt confia' },
      { p: 'Todo índice de repositório vem assinado criptograficamente. O apt verifica a assinatura contra a chave pública indicada em <code>Signed-By</code> antes de acreditar em qualquer coisa. Sem isso, quem controlasse a rede entre você e o mirror poderia entregar um "nginx" com um backdoor.' },
      {
        box: 'warn', label: 'O erro NO_PUBKEY', body: [
          { p: 'Quando o apt reclama <code>NO_PUBKEY 1234ABCD</code>, ele está dizendo: "encontrei o repositório, o índice está assinado, e eu não tenho a chave para verificar essa assinatura". A correção é instalar a chave — <strong>nunca</strong> desabilitar a verificação com <code>[trusted=yes]</code>, que é o conselho ruim mais copiado da internet.' }
        ]
      },
      { p: 'A forma correta de acrescentar um repositório de terceiro tem três partes, e as três importam:' },
      {
        code: [
          '# 1. baixar a chave e convertê-la para o formato binário',
          'curl -fsSL https://exemplo.com/chave.asc | sudo gpg --dearmor -o /etc/apt/keyrings/exemplo.gpg',
          '',
          '# 2. declarar o repositório dizendo QUAL chave o assina',
          'sudo tee /etc/apt/sources.list.d/exemplo.sources << FIM',
          'Types: deb',
          'URIs: https://exemplo.com/apt',
          'Suites: stable',
          'Components: main',
          'Signed-By: /etc/apt/keyrings/exemplo.gpg',
          'FIM',
          '',
          '# 3. atualizar o índice',
          'sudo apt update'
        ], run: false
      },
      { p: 'O <code>Signed-By</code> apontando para <em>uma</em> chave específica é a parte que costuma ser omitida — e ela é justamente a que impede que a chave da Exemplo Ltda. sirva para validar pacotes de qualquer outro repositório da máquina.' },

      { h2: 'Resumo' },
      {
        ul: [
          'O apt consulta um índice local; <code>apt update</code> é o que o renova.',
          'Repositórios em <code>sources.list.d/*.sources</code>, formato deb822.',
          '<code>-security</code> é a suíte que não se desabilita.',
          '<code>apt policy</code> explica qual versão seria escolhida e de onde.',
          'Chave de terceiro em <code>/etc/apt/keyrings/</code>, apontada por <code>Signed-By</code>. Nunca <code>[trusted=yes]</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't12-4-a', kind: 'guiado', title: 'Leia os repositórios da máquina',
        body: [
          { p: 'Descubra de onde esta máquina baixa software:' },
          { code: ['$ ls /etc/apt/ /etc/apt/sources.list.d/', '$ cat /etc/apt/sources.list.d/ubuntu.sources', '$ apt policy', '$ apt policy nginx'] },
          { p: 'Repare no <code>Signed-By</code>: é ele que amarra este repositório a uma chave específica. E no <code>apt policy nginx</code>, na diferença entre "Installed" e "Candidate".' }
        ],
        hints: ['Nenhum desses comandos altera nada.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /sources\.list/), 'Leia a configuração de repositórios em <code>/etc/apt/sources.list.d/</code>.'],
          [() => H.usedCommand(ctx, /apt\s+policy/), 'Veja as prioridades com <code>apt policy</code>.']
        ])
      },
      {
        id: 't12-4-q', kind: 'quiz', title: 'Conceito: o servidor "em dia"',
        body: [
          { p: 'Um servidor está sem atualização há oito meses. O administrador roda:' },
          { code: ['$ sudo apt upgrade -y', '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'], run: false, lang: 'text' },
          { p: 'E conclui que está tudo em dia. Onde está o erro de raciocínio?' }
        ],
        options: [
          { text: 'O índice local também tem oito meses. Sem <code>apt update</code> antes, o apt está comparando o sistema com uma lista velha — e ela realmente não tem nada de novo.', correct: true },
          { text: 'O <code>apt upgrade</code> não aplica atualizações de segurança; só o <code>apt full-upgrade</code> aplica.', why: 'O <code>apt upgrade</code> aplica atualizações de segurança normalmente. A diferença do <code>full-upgrade</code> é aceitar remover pacotes para resolver dependências.' },
          { text: 'Faltou <code>sudo apt install --only-upgrade</code>.', why: 'Essa opção limita a atualização a pacotes específicos — não é o que faz o índice ser renovado.' },
          { text: 'O repositório <code>-security</code> exige um comando separado.', why: 'Ele é apenas mais uma suíte na mesma configuração; o <code>apt upgrade</code> considera todas as configuradas — desde que o índice esteja atualizado.' }
        ],
        explain: 'A sequência correta é sempre <code>sudo apt update &amp;&amp; sudo apt upgrade</code>: o primeiro renova o índice, o segundo compara e aplica. É por isso também que <code>apt list --upgradable</code> logo depois de um <code>update</code> é o comando honesto para responder "o que falta atualizar aqui?".'
      },
      {
        id: 't12-4-b', kind: 'desafio', title: 'Acrescente um repositório de terceiro',
        body: [
          { p: 'A equipe hospeda pacotes internos em <code>https://apt.exemplo.com.br</code>. Configure esse repositório do jeito certo:' },
          {
            ul: [
              'a chave pública em <code>/etc/apt/keyrings/exemplo.gpg</code> (simule com <code>echo</code>, o conteúdo não importa aqui);',
              'o repositório declarado em <code>/etc/apt/sources.list.d/exemplo.sources</code>, no formato deb822, com <code>Types: deb</code>, a URI acima, <code>Suites: stable</code>, <code>Components: main</code>;',
              'e o campo <code>Signed-By</code> apontando para a chave que você criou.'
            ]
          },
          { p: 'Não use <code>[trusted=yes]</code> nem o formato antigo de uma linha.' }
        ],
        hints: [
          'O diretório <code>/etc/apt/keyrings</code> já existe. Escreva a "chave" com <code>echo ... | sudo tee</code>.',
          'O arquivo <code>.sources</code> tem um campo por linha, no formato <code>Campo: valor</code>. Use um heredoc com <code>sudo tee</code>.'
        ],
        solution: '<div class="code"><pre>echo "chave-publica-simulada-da-equipe" | sudo tee /etc/apt/keyrings/exemplo.gpg &gt; /dev/null\n\nsudo tee /etc/apt/sources.list.d/exemplo.sources &gt; /dev/null &lt;&lt; \'EOF\'\nTypes: deb\nURIs: https://apt.exemplo.com.br\nSuites: stable\nComponents: main\nSigned-By: /etc/apt/keyrings/exemplo.gpg\nEOF\n\ncat /etc/apt/sources.list.d/exemplo.sources\nls -l /etc/apt/keyrings/</pre></div><p style="margin-top:8px">Repare que a chave fica em <code>/etc/apt/keyrings/</code> (terceiros) e não em <code>/usr/share/keyrings/</code> (que é território de pacotes). E o <code>Signed-By</code> amarra esta chave a este repositório — ela não vale para nenhum outro.</p>',
        check: async (ctx) => {
          const chave = ler(ctx, '/etc/apt/keyrings/exemplo.gpg');
          const src = ler(ctx, '/etc/apt/sources.list.d/exemplo.sources');
          return H.checkAll([
            [!!chave.trim(), 'Falta a chave em <code>/etc/apt/keyrings/exemplo.gpg</code>.'],
            [!!src, 'Falta o arquivo <code>/etc/apt/sources.list.d/exemplo.sources</code>.'],
            [() => /^Types:\s*deb\s*$/m.test(src), 'Falta o campo <code>Types: deb</code>.'],
            [() => /^URIs:\s*https:\/\/apt\.exemplo\.com\.br\/?\s*$/m.test(src), 'O campo <code>URIs:</code> deve ser <code>https://apt.exemplo.com.br</code>.'],
            [() => /^Suites:\s*stable\s*$/m.test(src), 'Falta <code>Suites: stable</code>.'],
            [() => /^Components:\s*main\s*$/m.test(src), 'Falta <code>Components: main</code>.'],
            [() => /^Signed-By:\s*\/etc\/apt\/keyrings\/exemplo\.gpg\s*$/m.test(src), 'Falta o <code>Signed-By:</code> apontando para <code>/etc/apt/keyrings/exemplo.gpg</code> — é ele que amarra o repositório a essa chave e só a ela.'],
            [() => !/trusted\s*=\s*yes/i.test(src), 'Nada de <code>[trusted=yes]</code>: isso desliga a verificação de assinatura, que é justamente a proteção que estamos configurando.'],
            [() => !/^deb\s+http/m.test(src), 'Use o formato deb822 (um campo por linha), não a linha antiga <code>deb http://…</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 12.5 ============================== */
  LX.lesson('m12', {
    id: 'l12-5', n: '12.5', title: 'Manter o servidor: versões, holds e o que instalar fora do apt',
    goal: 'Decidir conscientemente o que atualizar, o que travar e o que instalar por fora — e conhecer a dívida que cada escolha cria.',
    body: [
      { h2: 'A rotina de atualização' },
      { code: ['$ sudo apt update', '$ apt list --upgradable', '$ sudo apt upgrade -y', '$ sudo apt autoremove --purge -y'] },
      {
        table: {
          head: ['Comando', 'O que faz', 'Quando'],
          rows: [
            ['<code>apt update</code>', 'renova o índice; <strong>não instala nada</strong>', 'sempre antes de qualquer coisa'],
            ['<code>apt upgrade</code>', 'atualiza o que dá <strong>sem remover nada</strong>', 'rotina normal'],
            ['<code>apt full-upgrade</code>', 'atualiza aceitando remover pacotes', 'mudança de versão, com atenção'],
            ['<code>apt autoremove</code>', 'apaga dependências órfãs', 'de vez em quando; libera bastante disco'],
            ['<code>apt clean</code>', 'esvazia o cache de <code>.deb</code> baixados', 'quando o disco aperta']
          ]
        }
      },
      { p: 'O <code>autoremove</code> é o que impede um servidor antigo de acumular gigabytes de bibliotecas que nada mais usa. E o <code>--purge</code> junto apaga também os arquivos de configuração dos pacotes removidos.' },

      { h2: 'Atualizações automáticas de segurança' },
      { p: 'Num servidor, o risco de ficar meses com uma falha conhecida é maior que o de uma atualização de segurança quebrar algo. Por isso o <code>unattended-upgrades</code> existe e vem habilitado por padrão no Ubuntu Server — aplicando <strong>apenas</strong> o que vem da suíte <code>-security</code>.' },
      { p: 'O que ele não faz, e você precisa saber: <strong>reiniciar</strong>. Uma biblioteca atualizada em disco não substitui a que já está carregada na memória dos processos em execução. O <code>needrestart</code> aponta quais serviços precisam reiniciar; atualização de kernel exige reboot.' },

      { h2: 'Travar uma versão: apt-mark hold' },
      { p: 'Às vezes você precisa que um pacote específico <strong>não</strong> seja atualizado — a versão nova quebrou a aplicação, ou o fornecedor só homologou até certa versão.' },
      { code: ['$ sudo apt-mark hold nginx', '$ apt-mark showhold', '$ sudo apt-mark unhold nginx'] },
      {
        box: 'warn', label: 'Todo hold é uma dívida com prazo', body: [
          { p: 'Um pacote travado <strong>para de receber correção de segurança</strong>. Isso é aceitável por algumas semanas, enquanto se resolve a incompatibilidade; é perigoso por meses e indefensável por anos.' },
          { p: 'A prática que salva: sempre que travar, registre <em>por quê</em> e <em>até quando</em> — num comentário no repositório de configuração, num chamado, em qualquer lugar que alguém vá reler. <code>apt-mark showhold</code> mostra <em>o que</em> está travado; ele nunca vai mostrar o motivo.' }
        ]
      },

      { h2: 'Instalar fora do apt: as três formas e o preço de cada uma' },
      {
        table: {
          head: ['Forma', 'Como', 'A dívida que cria'],
          rows: [
            ['<code>.deb</code> avulso', '<code>sudo apt install ./pacote.deb</code>', 'não atualiza sozinho; você vira o responsável'],
            ['Tarball em <code>/usr/local</code>', 'extrair e ajustar o PATH', 'o <code>dpkg</code> não sabe que existe; some do inventário'],
            ['Snap / Flatpak', '<code>snap install</code>', 'atualiza sozinho, mas com regras próprias e mais disco']
          ]
        }
      },
      { p: 'Repare que <code>apt install ./pacote.deb</code> (com o <code>./</code>) é melhor que <code>dpkg -i pacote.deb</code>: o apt resolve as dependências do arquivo, enquanto o <code>dpkg</code> apenas falha e deixa o sistema num estado meio-instalado, que exige <code>sudo apt --fix-broken install</code> para sair.' },
      {
        box: 'key', label: 'A regra do /usr/local', body: [
          { p: 'Software instalado à mão vai em <code>/usr/local</code>. Nunca em <code>/usr/bin</code> — esse diretório pertence ao gerenciador de pacotes, e a próxima atualização vai sobrescrever ou conflitar com o que você colocou lá.' },
          { p: 'E o jeito de auditar isso depois é o que você viu na aula 12.3: qualquer binário que o <code>dpkg -S</code> não reconheça foi instalado por fora e merece uma explicação.' }
        ]
      },

      { h2: 'A lista de pacotes é parte do backup' },
      { p: 'Reinstalar um servidor do zero é muito mais rápido quando você tem a lista do que estava instalado:' },
      { code: ['$ dpkg --get-selections | head -5', '$ dpkg --get-selections > ~/pacotes.lista', '$ wc -l ~/pacotes.lista'] },
      { p: 'Esse arquivo, guardado junto com o <code>/etc</code>, é o que transforma "reinstalar o servidor" de uma arqueologia de dois dias numa tarde. Na máquina nova: <code>sudo dpkg --set-selections &lt; pacotes.lista</code> seguido de <code>sudo apt-get dselect-upgrade</code>.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>update</code> renova o índice; <code>upgrade</code> aplica; <code>autoremove</code> limpa.',
          'Atualização automática cobre segurança, mas não reinicia nada.',
          '<code>apt-mark hold</code> trava — e a versão travada para de receber correção de segurança. Registre o motivo e o prazo.',
          '<code>apt install ./x.deb</code> é melhor que <code>dpkg -i</code>: resolve dependências.',
          'Software manual vai em <code>/usr/local</code>, nunca em <code>/usr/bin</code>.',
          '<code>dpkg --get-selections</code> faz parte do backup.'
        ]
      }
    ],
    tasks: [
      {
        id: 't12-5-a', kind: 'guiado', title: 'Travar e destravar',
        body: [
          { p: 'Veja o ciclo completo de um hold:' },
          { code: ['$ sudo apt update', '$ sudo apt install -y nginx', '$ sudo apt-mark hold nginx', '$ apt-mark showhold', '$ sudo apt-mark unhold nginx', '$ apt-mark showhold'] },
          { p: 'Repare que o <code>showhold</code> lista apenas o nome. Ele nunca vai lhe dizer por que aquele pacote foi travado, nem quando — por isso o motivo tem que ficar registrado em outro lugar.' }
        ],
        hints: ['O <code>apt-mark showhold</code> não imprime nada quando não há nenhum pacote travado.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /apt-mark\s+hold/), 'Trave um pacote com <code>sudo apt-mark hold nginx</code>.'],
          [() => H.usedCommand(ctx, /apt-mark\s+showhold/), 'Liste os travados com <code>apt-mark showhold</code>.'],
          [() => H.usedCommand(ctx, /apt-mark\s+unhold/), 'Destrave com <code>sudo apt-mark unhold nginx</code>.']
        ])
      },
{
        id: 't12-5-q', kind: 'quiz', title: 'O pacote travado há oito meses',
        body: [
          { p: 'Você assume um servidor e roda <code>apt-mark showhold</code>: o <code>nginx</code> está travado. Ninguém sabe por quê, e o hold foi posto há oito meses. Qual é a leitura correta da situação?' }
        ],
        options: [
          { text: 'O <code>nginx</code> travado deixou de receber correções de segurança há oito meses — é uma dívida vencida que precisa ser investigada e resolvida, não algo a manter só porque está lá.', correct: true },
          { text: 'Está tudo bem: o hold protege o servidor congelando uma versão testada e estável.', why: 'Congelar a versão também congela as correções de segurança. Estável não é o mesmo que seguro — uma falha conhecida no nginx fica aberta enquanto o hold durar.' },
          { text: 'O <code>apt-mark showhold</code> vai mostrar o motivo do hold; basta ler.', why: 'O <code>showhold</code> só lista o nome do pacote. O motivo nunca fica registrado por ele — é justamente por isso que se deve anotar o porquê e o prazo em outro lugar.' },
          { text: 'Como está travado, o <code>apt upgrade</code> normal já resolve quando for a hora.', why: 'Um pacote em hold é ignorado pelo <code>upgrade</code> exatamente para não ser atualizado. Enquanto o hold existir, ele nunca sobe — nem em atualização de segurança.' }
        ],
        explain: 'Todo <code>hold</code> é uma dívida com prazo: aceitável por semanas enquanto se resolve uma incompatibilidade, perigoso por meses. Como o <code>apt-mark showhold</code> nunca diz o motivo, um hold sem registro de porquê e até-quando é um sinal de alerta — investigue se a incompatibilidade ainda existe e destrave assim que possível com <code>sudo apt-mark unhold nginx</code>.'
      },
      {
        id: 't12-5-b', kind: 'desafio', title: 'Inventário para reconstruir a máquina',
        body: [
          { p: 'Você vai migrar este servidor. Prepare o inventário que permite reconstruí-lo, em <code>~/inventario/</code>:' },
          {
            ul: [
              '<code>~/inventario/pacotes.lista</code> — a lista completa de pacotes instalados, no formato do <code>dpkg --get-selections</code>;',
              '<code>~/inventario/travados.txt</code> — os pacotes com hold (crie um hold em <code>nginx</code> antes, para o arquivo não sair vazio);',
              '<code>~/inventario/fora-do-apt.txt</code> — os executáveis de <code>/usr/local/bin</code> que <strong>não</strong> pertencem a nenhum pacote, um caminho por linha.'
            ]
          },
          { p: 'O cenário já tem um binário instalado por fora:' },
          { code: ['$ sudo mkdir -p /usr/local/bin', '$ echo \'#!/bin/bash\' | sudo tee /usr/local/bin/deploy > /dev/null', '$ sudo chmod +x /usr/local/bin/deploy'] },
          { p: 'O terceiro arquivo é o mais interessante: ele responde "o que existe nesta máquina que nenhuma reinstalação vai trazer de volta?".' }
        ],
        hints: [
          'A lista de pacotes é <code>dpkg --get-selections &gt; ~/inventario/pacotes.lista</code>. Os travados, <code>apt-mark showhold</code>.',
          'Para os binários sem pacote: percorra <code>/usr/local/bin/*</code> e teste cada um com <code>dpkg -S</code>, guardando os que falharem: <code>for b in /usr/local/bin/*; do dpkg -S "$b" &gt;/dev/null 2&gt;&amp;1 || echo "$b"; done</code>.'
        ],
        solution: '<div class="code"><pre>sudo mkdir -p /usr/local/bin\necho \'#!/bin/bash\' | sudo tee /usr/local/bin/deploy &gt; /dev/null\nsudo chmod +x /usr/local/bin/deploy\nsudo apt update &gt; /dev/null 2&gt;&amp;1\nsudo apt install -y nginx &gt; /dev/null 2&gt;&amp;1\nsudo apt-mark hold nginx\n\nmkdir -p ~/inventario\ndpkg --get-selections &gt; ~/inventario/pacotes.lista\napt-mark showhold &gt; ~/inventario/travados.txt\nfor b in /usr/local/bin/*; do dpkg -S "$b" &gt;/dev/null 2&gt;&amp;1 || echo "$b"; done &gt; ~/inventario/fora-do-apt.txt\n\nwc -l ~/inventario/*</pre></div><p style="margin-top:8px">Esses três arquivos, junto com um backup do <code>/etc</code>, são quase tudo o que se precisa para reconstruir um servidor. O terceiro é o que costuma faltar — e é o que dói na migração.</p>',
        check: async (ctx) => {
          const pac = ler(ctx, '/home/aluno/inventario/pacotes.lista');
          const hold = ler(ctx, '/home/aluno/inventario/travados.txt');
          const fora = ler(ctx, '/home/aluno/inventario/fora-do-apt.txt');
          const m = ctx.machine || ctx.sh.m;
          const instalados = Array.from(m.packages.keys());
          const linhasPac = pac.split('\n').map(x => x.trim()).filter(Boolean);
          const nomes = linhasPac.map(l => l.split(/\s+/)[0]).sort();
          const foraL = fora.split('\n').map(x => x.trim()).filter(Boolean);
          return H.checkAll([
            [!!pac.trim(), 'Falta o <code>~/inventario/pacotes.lista</code>.'],
            [() => linhasPac.every(l => /^\S+\s+(install|deinstall|hold|purge)$/.test(l)), 'Cada linha deve estar no formato do <code>dpkg --get-selections</code>: <code>pacote&lt;tab&gt;install</code>.'],
            [() => nomes.length === instalados.length, () => `A lista deveria ter ${instalados.length} pacotes (todos os instalados); tem ${nomes.length}. Deixe o <code>dpkg</code> gerar.`],
            [() => instalados.every(p => nomes.includes(p)), 'Algum pacote instalado não está na lista.'],
            [() => H.exists(ctx, '/usr/local/bin/deploy'), 'Monte o cenário: falta o binário <code>/usr/local/bin/deploy</code>.'],
            [!!hold.trim(), 'O <code>~/inventario/travados.txt</code> está vazio. Trave o <code>nginx</code> com <code>apt-mark hold</code> antes de gerá-lo.'],
            [() => /nginx/.test(hold), 'O <code>travados.txt</code> deve conter o <code>nginx</code>.'],
            [!!fora.trim(), 'Falta o <code>~/inventario/fora-do-apt.txt</code>.'],
            [() => foraL.includes('/usr/local/bin/deploy'), 'O <code>/usr/local/bin/deploy</code> deve aparecer na lista de binários sem pacote — é ele que nenhuma reinstalação traria de volta.'],
            [() => foraL.every(l => l.startsWith('/usr/local/bin/')), 'A lista deve conter só caminhos de <code>/usr/local/bin/</code>.']
          ]);
        }
      }
    ]
  });
})();
