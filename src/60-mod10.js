/* =========================================================================
   MÓDULO 10 — SSH e acesso remoto
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const remoto = (ctx, host) => {
    const m = ctx.machine || ctx.sh.m;
    return (m.remotes && m.remotes.get(host)) || null;
  };

  /* ============================== 10.1 ============================== */
  LX.lesson('m10', {
    id: 'l10-1', n: '10.1', title: 'Conectar: o básico do SSH',
    goal: 'Abrir uma sessão remota com segurança, entender o aviso de host key e executar comandos em outra máquina sem abrir sessão.',
    body: [
      { lede: 'SSH é como você administra qualquer servidor que não está fisicamente na sua frente. É o comando que você mais vai usar na carreira — e o que mais vale entender por dentro.' },
      { p: 'O SSH resolve três coisas ao mesmo tempo: <strong>autentica você</strong> perante o servidor, <strong>autentica o servidor</strong> perante você, e <strong>cifra tudo</strong> no caminho.' },
      { cmd: 'ssh' },
      {
        code: [
          'ssh usuario@servidor              abre uma sessão interativa',
          'ssh servidor                      usa o seu usuário local como nome',
          'ssh -p 2222 usuario@servidor      porta diferente da 22',
          'ssh usuario@servidor "comando"    executa e volta, sem abrir sessão',
          'ssh -i ~/.ssh/chave usuario@srv   usa uma chave específica',
          'ssh -v usuario@servidor           modo verboso (para diagnosticar)'
        ], run: false, lang: 'text'
      },
      { p: 'Este ambiente tem duas máquinas de laboratório: <code>web01</code> e <code>db01</code>. Conecte-se pela primeira vez:' },
      { code: ['$ ssh web01 hostname'] },
      { p: 'Você recebeu um aviso antes de conectar. Ele merece atenção.' },

      { h2: 'O aviso de autenticidade — e por que ele importa' },
      {
        code: [
          "The authenticity of host 'web01 (10.0.2.31)' can't be established.",
          'ED25519 key fingerprint is SHA256:9pQ+cKm1XyR0v2sT8dLw3nB6hJ4kU7fE1oIaZbY5cWQ.',
          'Are you sure you want to continue connecting (yes/no/[fingerprint])?'
        ], run: false, mixed: false, lang: 'text'
      },
      { p: 'Toda máquina com SSH tem um par de chaves próprio — a <strong>host key</strong>. Na primeira conexão, o cliente não tem como saber se aquela chave é mesmo do servidor certo, então pergunta. Ao responder <code>yes</code>, a chave é gravada em <code>~/.ssh/known_hosts</code>, e nas próximas conexões o cliente compara em silêncio.' },
      { code: ['$ ssh web01 hostname', '$ cat ~/.ssh/known_hosts'] },
      {
        box: 'key', label: 'Quando esse aviso vira alarme', body: [
          { p: 'Se um dia aparecer <code>WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!</code>, o SSH está dizendo que a chave do servidor <strong>mudou</strong>. Duas explicações: a máquina foi reinstalada (comum) ou alguém está no meio da conexão se passando por ela (raro, mas é exatamente contra isso que a verificação existe).' },
          { p: 'Nunca apague o <code>known_hosts</code> por reflexo. Confirme com quem administra o servidor <em>por outro canal</em> e, se for legítimo, remova só aquela entrada: <code>ssh-keygen -R web01</code>.' }
        ]
      },
      { p: 'Para automação, existe a opção que aceita a chave sem perguntar — útil em scripts, mas com o custo de abrir mão da verificação na primeira conexão:' },
      { code: ['$ ssh -o StrictHostKeyChecking=accept-new db01 hostname'] },

      { h2: 'Executar sem abrir sessão' },
      { p: 'Um comando entre aspas depois do host executa lá e devolve a saída aqui — é assim que se faz automação e verificação rápida:' },
      {
        code: [
          '$ ssh web01 uptime',
          '$ ssh web01 "df -h / | tail -1"',
          '$ ssh web01 "systemctl is-active nginx"',
          '$ ssh web01 "ss -tlnp | head -3"'
        ]
      },
      {
        box: 'tip', body: [
          { p: 'As aspas importam. Sem elas, o <strong>seu</strong> shell interpreta o pipe e o redirecionamento antes de enviar:' },
          { code: ['# roda o "ss" lá e o "grep" AQUI:', 'ssh web01 ss -tln | grep 80', '# roda os dois LÁ:', 'ssh web01 "ss -tln | grep 80"'], run: false },
          { p: 'A diferença fica óbvia quando o comando escreve arquivos: <code>ssh web01 "echo x &gt; /tmp/a"</code> cria o arquivo lá; sem aspas, cria aqui.' }
        ]
      },
      { p: 'E a saída pode entrar em um pipe local normalmente — é uma das combinações mais úteis do SSH:' },
      { code: ['$ ssh web01 "cat /etc/os-release" | grep PRETTY', '$ ssh web01 "ls /var/log" | head -5'] }
    ],
    tasks: [
      {
        id: 't10-1-a', kind: 'guiado', title: 'Primeira conexão',
        body: [
          { p: 'Conecte, aceite a host key e execute comandos remotos.' },
          {
            code: [
              '$ ssh -o StrictHostKeyChecking=accept-new web01 hostname',
              '$ cat ~/.ssh/known_hosts',
              '$ ssh web01 uptime',
              '$ ssh web01 "df -h / | tail -1"',
              '$ ssh web01 "cat /etc/os-release" | grep PRETTY'
            ]
          },
          { p: 'Repare que a segunda conexão não perguntou mais nada: a chave já está no <code>known_hosts</code>.' }
        ],
        hints: ['O <code>-o StrictHostKeyChecking=accept-new</code> aceita a chave na primeira vez sem perguntar.'],
        solution: '<div class="code"><pre>ssh -o StrictHostKeyChecking=accept-new web01 hostname\ncat ~/.ssh/known_hosts\nssh web01 uptime\nssh web01 "df -h / | tail -1"\nssh web01 "cat /etc/os-release" | grep PRETTY</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [H.exists(ctx, '/home/aluno/.ssh/known_hosts'), 'Conecte-se ao <code>web01</code> para que a chave dele entre no <code>~/.ssh/known_hosts</code>.'],
          [() => { const k = H.read(ctx, '/home/aluno/.ssh/known_hosts') || ''; return /web01/.test(k); }, 'O <code>known_hosts</code> deveria conter a entrada do <code>web01</code>.'],
          [() => H.usedCommand(ctx, /ssh\s+.*web01\s+.*(uptime|df|hostname)/), 'Execute um comando remoto com <code>ssh web01 "comando"</code>.'],
          [() => H.usedCommand(ctx, /ssh\s+web01\s+"[^"]*\|/), 'Experimente também um comando com pipe <strong>dentro</strong> das aspas.']
        ])
      },
      {
        id: 't10-1-q', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Você roda, da sua máquina:' },
          { code: ['ssh web01 ls /var/log > lista.txt'], run: false, mixed: false },
          { p: 'Onde o arquivo <code>lista.txt</code> é criado, e com qual conteúdo?' }
        ],
        options: [
          { text: 'Na <strong>sua</strong> máquina, com a listagem de <code>/var/log</code> do <code>web01</code> — o redirecionamento é interpretado pelo seu shell.', correct: true },
          { text: 'No <code>web01</code>, com a listagem de lá.', why: 'Para isso o redirecionamento teria que ir dentro das aspas: <code>ssh web01 "ls /var/log &gt; lista.txt"</code>.' },
          { text: 'Nas duas máquinas.', why: 'O redirecionamento acontece em um lugar só — o do shell que o interpretou.' },
          { text: 'Em lugar nenhum: a sintaxe é inválida.', why: 'A sintaxe é válida e muito usada; a questão é apenas <em>onde</em> cada parte é interpretada.' }
        ],
        explain: 'Regra geral: tudo que está <strong>fora</strong> das aspas é do shell local; tudo que está <strong>dentro</strong> vai para o shell remoto. Isso vale para pipes, redirecionamentos, coringas e variáveis — <code>ssh web01 "echo $HOSTNAME"</code> com aspas duplas expande a variável <em>aqui</em>; com aspas simples, expande <em>lá</em>.'
      },
      {
        id: 't10-1-b', kind: 'desafio', title: 'Relatório do db01, sem abrir sessão',
        body: [
          { p: 'Esta é a sua primeira conexão ao <code>db01</code>. Sem abrir uma sessão interativa (nada de <code>ssh db01</code> sozinho, sempre com um comando depois), produza dois arquivos <strong>aqui</strong>, na sua máquina:' },
          {
            ul: [
              '<code>~/uptime-db01.txt</code> com a saída de <code>uptime</code> rodado no <code>db01</code>;',
              '<code>~/os-db01.txt</code> contendo <strong>só</strong> a linha <code>PRETTY_NAME</code> do <code>/etc/os-release</code> do <code>db01</code>.'
            ]
          },
          { p: 'Aceite a host key sem que ela pergunte nada.' }
        ],
        hints: [
          'Para aceitar a chave na primeira conexão sem perguntar: <code>ssh -o StrictHostKeyChecking=accept-new db01 ...</code>.',
          'Redirecionamento <strong>fora</strong> das aspas grava aqui: <code>ssh db01 "comando" &gt; arquivo</code>. Para filtrar só a linha certa, um pipe depois do fecha-aspas também roda aqui: <code>ssh db01 "cat /etc/os-release" | grep PRETTY &gt; arquivo</code>.'
        ],
        solution: '<pre>ssh -o StrictHostKeyChecking=accept-new db01 uptime > ~/uptime-db01.txt\ncat ~/uptime-db01.txt\nssh db01 "cat /etc/os-release" | grep PRETTY > ~/os-db01.txt\ncat ~/os-db01.txt</pre>',
        check: async (ctx) => {
          const db = remoto(ctx, 'db01');
          const up = H.read(ctx, '/home/aluno/uptime-db01.txt');
          const os = H.read(ctx, '/home/aluno/os-db01.txt');
          return LX.H.checkAll([
            [!!db, 'Conecte-se ao <code>db01</code> ao menos uma vez.'],
            [up !== null && up.trim().length > 0, 'Grave em <code>~/uptime-db01.txt</code> a saída de <code>ssh db01 uptime</code>.'],
            [os !== null && /PRETTY_NAME/.test(os), 'Grave em <code>~/os-db01.txt</code> a linha <code>PRETTY_NAME</code> de <code>/etc/os-release</code> do <code>db01</code>.'],
            [() => os === null || os.split('\n').filter(l => l.trim()).length === 1, 'O <code>~/os-db01.txt</code> deve conter <strong>só</strong> a linha do <code>PRETTY_NAME</code> — filtre com <code>grep</code>.'],
            [() => H.usedCommand(ctx, /ssh\s+.*db01\s+.*uptime/), 'Rode <code>ssh db01 uptime</code>, sem abrir sessão interativa.'],
            [() => H.usedCommand(ctx, /ssh\s+db01\s+"[^"]*os-release/), 'Rode um comando remoto que leia o <code>/etc/os-release</code> do <code>db01</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 10.2 ============================== */
  LX.lesson('m10', {
    id: 'l10-2', n: '10.2', title: 'Chaves: o jeito certo de autenticar',
    goal: 'Gerar um par de chaves, instalá-lo no servidor e entender por que senha em SSH é prática ultrapassada.',
    body: [
      { p: 'Autenticação por senha tem três problemas: pode ser adivinhada por força bruta, precisa ser digitada (ou guardada em algum lugar) e é a mesma para qualquer um que a descubra. Chaves resolvem os três.' },
      {
        ascii: `  SUA MÁQUINA                          SERVIDOR

  ~/.ssh/id_ed25519      (privada)     ~/.ssh/authorized_keys
      │  nunca sai daqui                     ▲  (pública)
      │                                      │
      └── prova matemática ──────────────────┘
          "eu tenho a chave privada
           que corresponde a esta pública"

  A chave privada NUNCA é enviada. O servidor manda um desafio,
  o cliente responde com uma assinatura, e só o dono da privada
  consegue produzi-la.`
      },
      { cmd: 'ssh-keygen' },
      {
        code: [
          '$ ssh-keygen -t ed25519 -C "aluno@terminalis"',
          '$ ls -l ~/.ssh/',
          '$ cat ~/.ssh/id_ed25519.pub'
        ]
      },
      {
        table: {
          head: ['Opção', 'Significa'],
          rows: [
            ['<code>-t ed25519</code>', 'o algoritmo — <strong>a escolha atual</strong>: curto, rápido e seguro'],
            ['<code>-t rsa -b 4096</code>', 'alternativa quando o servidor é muito antigo'],
            ['<code>-C "comentário"</code>', 'rótulo que fica no fim da chave pública (use e-mail ou máquina)'],
            ['<code>-f arquivo</code>', 'nome do arquivo (para ter várias chaves)'],
            ['<code>-N "senha"</code>', 'passphrase que protege a chave privada']
          ]
        }
      },
      {
        box: 'key', body: [
          { p: 'Dois arquivos, dois destinos:' },
          { ul: [
            '<code>id_ed25519</code> — <strong>privada</strong>. Fica só na sua máquina, com modo <code>600</code>. Nunca é copiada para servidor nenhum, nunca vai para o Git, nunca é enviada por mensagem.',
            '<code>id_ed25519.pub</code> — <strong>pública</strong>. Pode ser espalhada à vontade: é o que vai para o <code>authorized_keys</code> de cada servidor.'
          ] },
          { p: 'A passphrase protege a chave privada <em>caso o arquivo vaze</em> — sem ela, quem copiar o arquivo entra em todos os seus servidores. Use passphrase e um agente (aula 10.3) para não digitá-la o tempo todo.' }
        ]
      },

      { h2: 'Instalar a chave no servidor' },
      { cmd: 'ssh-copy-id' },
      { p: 'O jeito fácil (pede a senha uma última vez e nunca mais):' },
      { code: ['$ ssh-copy-id aluno@web01', '$ ssh web01 whoami'] },
      { p: 'A segunda linha não pediu senha: a autenticação passou a ser por chave. Veja o que o comando fez do outro lado:' },
      { code: ['$ ssh web01 "ls -l ~/.ssh/ && cat ~/.ssh/authorized_keys"'] },
      { p: 'Quando não há <code>ssh-copy-id</code> (ou o acesso é por painel do provedor), o passo a passo manual é:' },
      {
        code: [
          'cat ~/.ssh/id_ed25519.pub                  # copie a linha inteira',
          'ssh usuario@servidor',
          'mkdir -p ~/.ssh && chmod 700 ~/.ssh',
          'echo "ssh-ed25519 AAAA... comentario" >> ~/.ssh/authorized_keys',
          'chmod 600 ~/.ssh/authorized_keys'
        ], run: false, lang: 'text'
      },
      {
        box: 'warn', label: 'As permissões que fazem o SSH recusar em silêncio', body: [
          { p: 'O OpenSSH <strong>ignora</strong> chaves quando as permissões estão frouxas — e o erro do lado do cliente é apenas "Permission denied (publickey)", sem explicar. Do lado do servidor, o log diz "Authentication refused: bad ownership or modes".' },
          { code: ['$ ssh web01 "chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys; ls -ld ~/.ssh"'] },
          { p: 'A regra: <code>~</code> não pode ter escrita para grupo/outros, <code>~/.ssh</code> é <code>700</code> e <code>authorized_keys</code> é <code>600</code>. Foi o módulo 5 inteiro virando requisito prático.' }
        ]
      },

      { h2: 'Várias chaves, vários servidores' },
      { p: 'É comum ter uma chave por contexto: trabalho, pessoal, um cliente específico. O <code>-f</code> nomeia, e o <code>~/.ssh/config</code> (aula 10.3) escolhe automaticamente qual usar para cada host.' },
      { code: ['$ ssh-keygen -t ed25519 -f ~/.ssh/id_deploy -N "" -C "deploy@terminalis"', '$ ls -l ~/.ssh/'] },
      {
        box: 'old', label: 'Prática antiga × atual', body: [
          { p: '<strong>Antigo:</strong> senha no SSH, muitas vezes com login direto de root; chaves RSA de 1024 ou 2048 bits.' },
          { p: '<strong>Atual:</strong> apenas chave (<code>PasswordAuthentication no</code> no servidor), <code>ed25519</code> como padrão, root sem login direto (<code>PermitRootLogin no</code>) e sudo para elevar. Em nuvem, muitas vezes nem isso: acesso por agente do provedor, sem porta 22 exposta. <strong>Aprenda essa versão</strong> — a próxima aula configura o servidor assim.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't10-2-a', kind: 'guiado', title: 'Gere e instale sua chave',
        body: [
          { p: 'Crie o par, copie para o servidor e comprove que a senha não é mais pedida.' },
          {
            code: [
              '$ ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -C "aluno@terminalis"',
              '$ ls -l ~/.ssh/',
              '$ cat ~/.ssh/id_ed25519.pub',
              '$ ssh-copy-id aluno@web01',
              '$ ssh web01 whoami',
              '$ ssh web01 "cat ~/.ssh/authorized_keys"'
            ]
          },
          { p: 'Compare os modos dos dois arquivos gerados: a privada nasce <code>600</code>, a pública <code>644</code>.' }
        ],
        hints: ['O <code>-N ""</code> cria a chave sem passphrase — aceitável em laboratório, não em produção.'],
        solution: '<div class="code"><pre>ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -C "aluno@terminalis"\nls -l ~/.ssh/\ncat ~/.ssh/id_ed25519.pub\nssh-copy-id aluno@web01\nssh web01 whoami\nssh web01 "cat ~/.ssh/authorized_keys"</pre></div>',
        check: async (ctx) => {
          const priv = H.mode(ctx, '/home/aluno/.ssh/id_ed25519');
          const pub = H.read(ctx, '/home/aluno/.ssh/id_ed25519.pub');
          const web = remoto(ctx, 'web01');
          return LX.H.checkAll([
            [priv !== null, 'Gere o par de chaves com <code>ssh-keygen</code>.'],
            [pub !== null && /^ssh-ed25519\s+/.test(pub.trim()), 'A chave pública <code>~/.ssh/id_ed25519.pub</code> deve existir e ser do tipo <code>ed25519</code>.'],
            [priv === 0o600, () => `A chave privada deve estar em <code>600</code>; está ${(priv || 0).toString(8)}.`],
            [!!web, 'Conecte-se ao <code>web01</code> ao menos uma vez.'],
            [!!web && web.sshKeysAuthorized.has('aluno'), 'Instale sua chave no servidor com <code>ssh-copy-id aluno@web01</code>.'],
            [() => H.usedCommand(ctx, /ssh\s+web01/), 'Comprove o acesso sem senha com <code>ssh web01 whoami</code>.']
          ]);
        }
      },
      {
        id: 't10-2-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um colega instalou a chave e mesmo assim continua recebendo <code>Permission denied (publickey)</code>. No servidor:' },
          {
            code: [
              'drwxrwxr-x  2 ana ana 4096 Sep  1 10:12 /home/ana/.ssh',
              '-rw-rw-r--  1 ana ana  110 Sep  1 10:12 /home/ana/.ssh/authorized_keys'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Qual é a causa?' }
        ],
        options: [
          { text: 'As permissões estão frouxas: o OpenSSH ignora o <code>authorized_keys</code> quando o diretório ou o arquivo são graváveis por grupo/outros.', correct: true },
          { text: 'A chave pública foi colada errada.', why: 'Possível em geral, mas aqui há uma causa visível e clássica nas permissões.' },
          { text: 'Falta reiniciar o <code>sshd</code> depois de adicionar a chave.', why: 'O <code>authorized_keys</code> é lido a cada conexão; não há nada a reiniciar.' },
          { text: 'O usuário precisa estar no grupo <code>ssh</code>.', why: 'Não existe essa exigência por padrão.' }
        ],
        explain: 'A correção é <code>chmod 700 ~/.ssh</code> e <code>chmod 600 ~/.ssh/authorized_keys</code> — e conferir também que <code>~</code> não tem escrita para grupo. Do lado do servidor, <code>sudo journalctl -u ssh</code> mostra "Authentication refused: bad ownership or modes for directory /home/ana/.ssh", que entrega o diagnóstico de imediato.'
      },
      {
        id: 't10-2-b', kind: 'desafio', title: 'Chave dedicada para deploy',
        body: [
          { p: 'A equipe quer uma chave separada, usada <strong>apenas</strong> para publicar no servidor de aplicação — se ela vazar, revoga-se só ela, sem mexer na sua chave pessoal.' },
          { p: 'Requisitos:' },
          {
            ul: [
              'gere um par <code>ed25519</code> em <code>~/.ssh/id_deploy</code> (e <code>id_deploy.pub</code>), com o comentário <code>deploy@terminalis</code> e sem passphrase;',
              'a chave privada deve ficar com modo <code>600</code>;',
              'instale a chave <strong>pública</strong> no usuário <code>deploy</code> do servidor <code>web01</code>;',
              'comprove executando <code>ssh -i ~/.ssh/id_deploy deploy@web01 whoami</code>, que deve responder <code>deploy</code>.'
            ]
          }
        ],
        hints: [
          'O <code>-f</code> escolhe o nome do arquivo e o <code>-C</code> o comentário.',
          'O <code>ssh-copy-id</code> aceita <code>-i</code> para dizer <em>qual</em> chave instalar, e o destino é <code>usuario@host</code>.',
          '<code>ssh-keygen -t ed25519 -f ~/.ssh/id_deploy -N "" -C "deploy@terminalis"</code>; depois <code>ssh-copy-id -i ~/.ssh/id_deploy.pub deploy@web01</code>.'
        ],
        solution: '<div class="code"><pre>ssh-keygen -t ed25519 -f ~/.ssh/id_deploy -N "" -C "deploy@terminalis"\nls -l ~/.ssh/id_deploy*\nssh-copy-id -i ~/.ssh/id_deploy.pub deploy@web01\nssh -i ~/.ssh/id_deploy deploy@web01 whoami</pre></div><p style="margin-top:8px">Chaves por finalidade são o equivalente do "menor privilégio" do módulo 5 aplicado ao acesso remoto: cada chave tem um dono, um uso e pode ser revogada isoladamente.</p>',
        check: async (ctx) => {
          const priv = H.mode(ctx, '/home/aluno/.ssh/id_deploy');
          const pub = H.read(ctx, '/home/aluno/.ssh/id_deploy.pub');
          const web = remoto(ctx, 'web01');
          if (priv === null) return { ok: false, msg: 'A chave <code>~/.ssh/id_deploy</code> ainda não existe.' };
          return LX.H.checkAll([
            [pub !== null, 'Falta a chave pública <code>~/.ssh/id_deploy.pub</code>.'],
            [/^ssh-ed25519\s/.test((pub || '').trim()), 'A chave deve ser do tipo <code>ed25519</code>.'],
            [/deploy@terminalis/.test(pub || ''), 'A chave pública deve terminar com o comentário <code>deploy@terminalis</code> (opção <code>-C</code>).'],
            [priv === 0o600, `A chave privada deve estar em <code>600</code>; está ${priv.toString(8)}.`],
            [!!web, 'Conecte-se ao <code>web01</code> ao menos uma vez.'],
            [!!web && web.sshKeysAuthorized.has('deploy'), 'A chave ainda não está autorizada para o usuário <code>deploy</code> no <code>web01</code>.'],
            [() => { const k = web && web.sshKeysAuthorized.get('deploy'); return !!k && /deploy@terminalis/.test(k); }, 'A chave instalada no <code>deploy</code> não é a <code>id_deploy</code> — instale a chave certa com <code>ssh-copy-id -i ~/.ssh/id_deploy.pub deploy@web01</code>.'],
            [() => H.usedCommand(ctx, /ssh\s+.*-i\s+\S*id_deploy\s+deploy@web01/), 'Comprove com <code>ssh -i ~/.ssh/id_deploy deploy@web01 whoami</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 10.3 ============================== */
  LX.lesson('m10', {
    id: 'l10-3', n: '10.3', title: 'Config, agente e cópia de arquivos',
    goal: 'Parar de digitar comandos longos, guardar a passphrase na sessão e transferir arquivos entre máquinas.',
    body: [
      { h2: '~/.ssh/config: apelidos para servidores' },
      { p: 'Em vez de <code>ssh -i ~/.ssh/id_deploy -p 2222 deploy@10.0.2.31</code>, você escreve <code>ssh app</code>.' },
      {
        code: [
          '# ~/.ssh/config',
          'Host web',
          '    HostName web01',
          '    User aluno',
          '    IdentityFile ~/.ssh/id_ed25519',
          '',
          'Host app',
          '    HostName web01',
          '    User deploy',
          '    IdentityFile ~/.ssh/id_deploy',
          '',
          'Host *',
          '    ServerAliveInterval 60',
          '    ServerAliveCountMax 3'
        ], run: false, lang: 'ini'
      },
      {
        table: {
          head: ['Diretiva', 'Efeito'],
          rows: [
            ['<code>HostName</code>', 'o endereço real (o <code>Host</code> é só o apelido)'],
            ['<code>User</code>', 'usuário padrão para esse host'],
            ['<code>Port</code>', 'porta, quando não é a 22'],
            ['<code>IdentityFile</code>', 'qual chave usar'],
            ['<code>ServerAliveInterval</code>', 'manda um sinal a cada N segundos — <strong>evita a sessão cair sozinha</strong>'],
            ['<code>ProxyJump</code>', 'passa por um servidor intermediário (bastion)'],
            ['<code>Host *</code>', 'vale para todos — coloque no fim do arquivo']
          ]
        }
      },
      { p: 'Crie o seu e teste:' },
      {
        code: [
          '$ mkdir -p ~/.ssh && chmod 700 ~/.ssh',
          '$ cat > ~/.ssh/config << \'EOF\'',
          'Host web',
          '    HostName web01',
          '    User aluno',
          'EOF',
          '$ chmod 600 ~/.ssh/config',
          '$ ssh web hostname'
        ]
      },
      {
        box: 'tip', body: [
          { p: 'O <code>ProxyJump</code> merece destaque: em ambientes com bastion, ele substitui aquela sequência de "entro no bastion, de lá entro no servidor". Com <code>ProxyJump bastion</code> na configuração do host, um único <code>ssh app</code> atravessa os dois — e o <code>scp</code> também.' }
        ]
      },

      { h2: 'ssh-agent: digitar a passphrase uma vez só' },
      { p: 'Chave com passphrase é o correto — e digitá-la a cada conexão é insuportável. O <strong>agente</strong> guarda a chave destravada na memória da sua sessão.' },
      {
        code: [
          '$ eval "$(ssh-agent)"',
          '$ ssh-add ~/.ssh/id_ed25519',
          '$ ssh-add -l',
          '$ ssh web hostname'
        ]
      },
      {
        table: {
          head: ['Comando', 'Faz'],
          rows: [
            ['<code>eval "$(ssh-agent)"</code>', 'inicia o agente e exporta as variáveis para o shell atual'],
            ['<code>ssh-add chave</code>', 'destrava e carrega a chave (pede a passphrase aqui)'],
            ['<code>ssh-add -l</code>', 'lista o que está carregado'],
            ['<code>ssh-add -d chave</code>', 'remove uma chave'],
            ['<code>ssh-add -D</code>', 'remove todas'],
            ['<code>ssh -A</code>', '<strong>encaminha</strong> o agente para o servidor — use com parcimônia']
          ]
        }
      },
      {
        box: 'warn', body: [
          { p: 'O <code>ssh -A</code> (agent forwarding) permite que, de dentro do servidor, você use suas chaves para pular para outra máquina. O risco: quem for root naquele servidor pode usar o socket do agente e se autenticar <strong>como você</strong> em qualquer lugar. Prefira <code>ProxyJump</code>, que não expõe o agente.' }
        ]
      },

      { h2: 'Copiar arquivos' },
      { cmd: 'scp' },
      {
        code: [
          '$ scp ~/documentos/notas.txt web01:/tmp/',
          '$ ssh web01 "ls -l /tmp/notas.txt"',
          '$ scp web01:/etc/os-release ~/os-remoto.txt',
          '$ head -2 ~/os-remoto.txt'
        ]
      },
      {
        table: {
          head: ['Comando', 'Direção'],
          rows: [
            ['<code>scp arquivo host:/destino/</code>', 'daqui para lá'],
            ['<code>scp host:/arquivo .</code>', 'de lá para cá'],
            ['<code>scp -r pasta host:/destino/</code>', 'diretório inteiro'],
            ['<code>scp -P 2222 ...</code>', 'porta diferente (<strong>P maiúsculo</strong>, diferente do ssh)'],
            ['<code>rsync -avz pasta/ host:/destino/</code>', '<strong>melhor para sincronizar</strong>: copia só o que mudou']
          ]
        }
      },
      { p: 'Compare com o <code>rsync</code>, que é o que se usa no dia a dia para pastas grandes ou repetidas:' },
      { code: ['$ rsync -av ~/projetos/site/ web01:/tmp/site/', '$ ssh web01 "ls /tmp/site"'] },
      {
        box: 'old', body: [
          { p: 'O <code>scp</code> é simples e continua funcionando, mas o protocolo antigo dele foi descontinuado no OpenSSH — hoje ele roda por cima do SFTP e teve várias falhas históricas de tratamento de nomes. Para cópias de verdade, <strong>use <code>rsync</code></strong> (retoma transferências, copia só diferenças, preserva permissões com <code>-a</code>) ou <code>sftp</code>. Guarde o <code>scp</code> para um arquivo solto e rápido.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't10-3-a', kind: 'guiado', title: 'Apelido, agente e cópia',
        body: [
          { p: 'Configure um apelido, carregue a chave no agente e mova arquivos nos dois sentidos.' },
          {
            code: [
              '$ mkdir -p ~/.ssh && chmod 700 ~/.ssh',
              '$ cat > ~/.ssh/config << \'EOF\'',
              'Host web',
              '    HostName web01',
              '    User aluno',
              'EOF',
              '$ chmod 600 ~/.ssh/config',
              '$ ssh web hostname'
            ]
          },
          {
            code: [
              '$ eval "$(ssh-agent)"',
              '$ ssh-add ~/.ssh/id_ed25519',
              '$ ssh-add -l',
              '$ scp ~/documentos/notas.txt web01:/tmp/',
              '$ ssh web01 "ls -l /tmp/notas.txt"'
            ]
          }
        ],
        hints: ['Se a chave ainda não existe, gere-a antes com <code>ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""</code>.'],
        solution: '<div class="code"><pre>ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" 2&gt;/dev/null\nmkdir -p ~/.ssh &amp;&amp; chmod 700 ~/.ssh\ncat &gt; ~/.ssh/config &lt;&lt; \'EOF\'\nHost web\n    HostName web01\n    User aluno\nEOF\nchmod 600 ~/.ssh/config\nssh web hostname\neval "$(ssh-agent)"\nssh-add ~/.ssh/id_ed25519\nssh-add -l\nscp ~/documentos/notas.txt web01:/tmp/\nssh web01 "ls -l /tmp/notas.txt"</pre></div>',
        check: async (ctx) => {
          const cfg = H.read(ctx, '/home/aluno/.ssh/config');
          const web = remoto(ctx, 'web01');
          return LX.H.checkAll([
            [cfg !== null, 'Crie o arquivo <code>~/.ssh/config</code>.'],
            [/^\s*Host\s+web\s*$/mi.test(cfg || ''), 'O config precisa de um bloco <code>Host web</code>.'],
            [/HostName\s+web01/i.test(cfg || ''), 'O bloco precisa de <code>HostName web01</code>.'],
            [() => H.usedCommand(ctx, /ssh\s+web\b/), 'Teste o apelido com <code>ssh web hostname</code>.'],
            [() => H.usedCommand(ctx, /ssh-add/), 'Carregue a chave no agente com <code>ssh-add</code>.'],
            [!!web && H.exists({ sh: { m: web } }, '/tmp/notas.txt'), 'Copie o arquivo para o servidor com <code>scp ~/documentos/notas.txt web01:/tmp/</code>.']
          ]);
        }
      },
      {
        id: 't10-3-q', kind: 'quiz', title: 'Bastion: encaminhar o agente ou pular direto?',
        body: [
          { p: 'Para chegar ao servidor de aplicação, você primeiro precisa entrar num bastion. Um colega sugere usar <code>ssh -A</code> para levar as chaves carregadas no seu agente até o bastion, e de lá pular para o destino. Qual é a alternativa mais segura, e por quê?' }
        ],
        options: [
          { text: 'Configurar <code>ProxyJump</code> no <code>~/.ssh/config</code>, que atravessa o bastion sem nunca expor o agente lá.', correct: true },
          { text: 'Usar mesmo o <code>ssh -A</code>: é para isso que o encaminhamento de agente existe.', why: 'Ele funciona, mas expõe o socket do agente no bastion: quem for root nele pode se autenticar como você em qualquer servidor que sua chave abra.' },
          { text: 'Copiar a chave privada para o bastion, para autenticar localmente a partir de lá.', why: 'A chave privada nunca deve sair da sua máquina — copiá-la joga fora a proteção que o par de chaves existe para dar.' },
          { text: 'Trocar para autenticação por senha só nesse pulo, já que é mais simples de configurar.', why: 'Senha é o método menos seguro dos três, não uma alternativa mais segura ao agent forwarding.' }
        ],
        explain: 'O <code>ProxyJump</code> faz o cliente SSH abrir a conexão com o bastion e, por dentro dela, encaminhar o tráfego até o destino — as suas chaves continuam sendo usadas só pela sua máquina, nunca residem (nem passam a residir) no bastion.'
      },
      {
        id: 't10-3-b', kind: 'desafio', title: 'Publique o site no servidor',
        body: [
          { p: 'Você precisa enviar o conteúdo de <code>~/projetos/site/</code> para o <code>web01</code> e confirmar que chegou inteiro.' },
          { p: 'Requisitos:' },
          {
            ul: [
              'os arquivos devem ficar em <code>/tmp/publicado/</code> no <code>web01</code> (o diretório pode não existir);',
              'use <code>rsync</code> ou <code>scp -r</code> — o conteúdo do diretório precisa ir todo, não só um arquivo;',
              'grave em <code>~/publicacao.txt</code> a saída de <code>ssh web01 "ls /tmp/publicado"</code>, com um nome de arquivo por linha.'
            ]
          },
          { p: 'Confira antes o que existe localmente com <code>ls ~/projetos/site/</code>.' }
        ],
        hints: [
          'A barra final na origem muda o comportamento do <code>rsync</code>: <code>site/</code> copia o <em>conteúdo</em>, <code>site</code> copia o diretório dentro do destino.',
          'Crie o destino antes se preferir: <code>ssh web01 "mkdir -p /tmp/publicado"</code>.',
          '<code>rsync -av ~/projetos/site/ web01:/tmp/publicado/</code> e depois <code>ssh web01 "ls /tmp/publicado" &gt; ~/publicacao.txt</code>.'
        ],
        solution: '<div class="code"><pre>ls ~/projetos/site/\nssh web01 "mkdir -p /tmp/publicado"\nrsync -av ~/projetos/site/ web01:/tmp/publicado/\nssh web01 "ls /tmp/publicado" &gt; ~/publicacao.txt\ncat ~/publicacao.txt</pre></div><p style="margin-top:8px">Em um deploy real, o passo seguinte seria mover para o diretório servido pelo nginx e recarregar o serviço — tudo em um script, com a chave <code>id_deploy</code> da aula anterior.</p>',
        check: async (ctx) => {
          const web = remoto(ctx, 'web01');
          if (!web) return { ok: false, msg: 'Conecte-se ao <code>web01</code> ao menos uma vez.' };
          const ctxWeb = { sh: { m: web, fsopts: () => ({ cwd: '/', ctx: web.ctxRoot() }) }, machine: web };
          const locais = (H.ls(ctx, '/home/aluno/projetos/site') || []).map(e => e.name || e);
          const remotos = (H.ls(ctxWeb, '/tmp/publicado') || []).map(e => e.name || e);
          const c = H.read(ctx, '/home/aluno/publicacao.txt');
          return LX.H.checkAll([
            [locais.length > 0, 'O diretório <code>~/projetos/site</code> deveria ter arquivos — recarregue o ambiente se estiver vazio.'],
            [remotos.length > 0, 'O diretório <code>/tmp/publicado</code> no <code>web01</code> está vazio ou não existe.'],
            [locais.every(n => remotos.includes(n)), `Faltam arquivos no servidor. Locais: ${locais.join(', ')}. No servidor: ${remotos.join(', ') || '(nenhum)'}.`],
            [c !== null, 'Falta o arquivo <code>~/publicacao.txt</code> com a listagem remota.'],
            [() => { const l = (c || '').split('\n').filter(x => x.trim()); return l.length >= locais.length && locais.every(n => l.some(x => x.trim() === n)); },
              'O <code>~/publicacao.txt</code> deve conter a listagem de <code>/tmp/publicado</code>, um nome por linha.'],
            [() => H.usedCommand(ctx, /rsync|scp\s+-r/), 'Use <code>rsync</code> ou <code>scp -r</code> para enviar o diretório.']
          ]);
        }
      }
    ]
  });

  /* ============================== 10.4 ============================== */
  LX.lesson('m10', {
    id: 'l10-4', n: '10.4', title: 'Endurecer o servidor SSH',
    goal: 'Configurar o sshd como se faz em produção — e testar a mudança sem correr o risco de se trancar para fora.',
    body: [
      { p: 'Até aqui você foi <strong>cliente</strong>. Esta aula é sobre o outro lado: o <code>sshd</code>, o serviço que aceita as conexões. A configuração fica em <code>/etc/ssh/sshd_config</code>.' },
      { code: ['$ sudo grep -vE "^\\s*#|^\\s*$" /etc/ssh/sshd_config | head -20'] },
      {
        table: {
          head: ['Diretiva', 'Recomendado', 'Por quê'],
          rows: [
            ['<code>PermitRootLogin</code>', '<code>no</code>', 'força contas nominais + sudo; acaba com o ataque a "root"'],
            ['<code>PasswordAuthentication</code>', '<code>no</code>', 'só chave: elimina força bruta de senha'],
            ['<code>PubkeyAuthentication</code>', '<code>yes</code>', 'o método que fica'],
            ['<code>AllowUsers</code> / <code>AllowGroups</code>', 'lista curta', 'só quem precisa entra'],
            ['<code>Port</code>', '22 (ou outra)', 'mudar reduz ruído de bots, <strong>não</strong> é segurança de verdade'],
            ['<code>X11Forwarding</code>', '<code>no</code>', 'superfície a menos em servidor'],
            ['<code>MaxAuthTries</code>', '<code>3</code>', 'corta tentativas por conexão'],
            ['<code>ClientAliveInterval</code>', '<code>300</code>', 'derruba sessões mortas']
          ]
        }
      },
      {
        box: 'key', label: 'A ordem que evita o desastre', body: [
          { ol: [
            'instale e <strong>teste</strong> sua chave (<code>ssh servidor</code> entra sem pedir senha);',
            'edite o <code>sshd_config</code>;',
            'valide a sintaxe: <code>sudo sshd -t</code>;',
            'recarregue: <code>sudo systemctl reload ssh</code>;',
            '<strong>abra uma segunda sessão</strong> em outro terminal e confirme que entra;',
            'só então feche a primeira.'
          ] },
          { p: 'O passo 5 é o que salva: se a nova configuração quebrou o acesso, você ainda tem a sessão antiga aberta para desfazer. Sem ela, resta o console do provedor.' }
        ]
      },
      { p: 'Na prática, no servidor:' },
      {
        code: [
          '$ ssh web01 "sudo grep -E \'^#?(PermitRootLogin|PasswordAuthentication)\' /etc/ssh/sshd_config"',
          '$ ssh web01 "sudo sshd -t && echo \'sintaxe ok\'"'
        ]
      },
      {
        box: 'tip', label: 'Onde editar hoje', body: [
          { p: 'Distribuições atuais incluem <code>/etc/ssh/sshd_config.d/*.conf</code> no início do arquivo principal. O jeito moderno e mais seguro é criar <code>/etc/ssh/sshd_config.d/99-endurecimento.conf</code> com as suas diretivas: uma atualização do pacote não sobrescreve, e reverter é apagar um arquivo.' },
          { p: 'Atenção a uma pegadinha: nesses arquivos, <strong>a primeira ocorrência de cada diretiva vence</strong>. Por isso os <code>Include</code> ficam no topo — o que você põe lá tem prioridade sobre o resto do arquivo.' }
        ]
      },

      { h2: 'Camadas além do sshd' },
      {
        ul: [
          '<strong>Firewall</strong> (módulo 9): liberar a 22 só para a VPN ou IPs conhecidos é mais eficaz do que qualquer ajuste no sshd.',
          '<strong>fail2ban</strong>: bloqueia temporariamente IPs que erram repetidamente — reduz o ruído nos logs e a chance de força bruta.',
          '<strong>Chaves com passphrase + agente</strong>: protege quando o notebook é roubado.',
          '<strong>2FA</strong> (<code>pam_google_authenticator</code>): segundo fator para acessos administrativos.',
          '<strong>Auditar</strong>: <code>journalctl -u ssh</code> mostra cada tentativa, com IP e usuário.'
        ]
      },
      { code: ['$ ssh web01 "sudo journalctl -u ssh -n 5 --no-pager" 2>/dev/null || journalctl -u ssh -n 5 --no-pager'] },
      {
        box: 'warn', label: 'Mudar a porta não é segurança', body: [
          { p: 'Trocar a 22 por 2222 reduz o <em>volume</em> de tentativas automatizadas nos logs — e nada mais. Um atacante que faça uma varredura acha a porta em segundos. Trate a mudança de porta como higiene de log, nunca como proteção; a proteção é chave + firewall.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't10-4-a', kind: 'guiado', title: 'Inspecione a configuração do servidor',
        body: [
          { p: 'Leia a configuração ativa, valide a sintaxe e veja o log de autenticação.' },
          {
            code: [
              '$ sudo grep -vE "^\\s*#|^\\s*$" /etc/ssh/sshd_config | head -15',
              '$ sudo grep -E "^#?(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|Port)" /etc/ssh/sshd_config',
              '$ sudo sshd -t && echo "sintaxe ok"',
              '$ systemctl status ssh --no-pager | head -4',
              '$ journalctl -u ssh -n 5 --no-pager'
            ]
          }
        ],
        hints: ['O <code>grep -vE "^\\s*#|^\\s*$"</code> remove comentários e linhas em branco — ótimo para ler qualquer arquivo de configuração.'],
        solution: '<div class="code"><pre>sudo grep -vE "^\\s*#|^\\s*$" /etc/ssh/sshd_config | head -15\nsudo grep -E "^#?(PermitRootLogin|PasswordAuthentication)" /etc/ssh/sshd_config\nsudo sshd -t &amp;&amp; echo "sintaxe ok"\nsystemctl status ssh --no-pager | head -4\njournalctl -u ssh -n 5 --no-pager</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /sshd_config/), 'Leia o <code>/etc/ssh/sshd_config</code>.'],
          [() => H.usedCommand(ctx, /sshd\s+-t/), 'Valide a sintaxe com <code>sudo sshd -t</code>.'],
          [() => H.usedCommand(ctx, /systemctl\s+status\s+ssh|systemctl\s+is-active\s+ssh/), 'Confira o estado do serviço <code>ssh</code>.'],
          [() => H.usedCommand(ctx, /journalctl.*ssh/), 'Veja o log do serviço com <code>journalctl -u ssh</code>.']
        ])
      },
      {
        id: 't10-4-q', kind: 'quiz', title: 'Conceito: a ordem das operações',
        body: [
          { p: 'Você vai desativar a autenticação por senha em um servidor de produção ao qual só tem acesso remoto. Qual sequência é segura?' }
        ],
        options: [
          {
            text: 'Instalar e testar a chave → editar → <code>sshd -t</code> → <code>reload</code> → abrir uma <strong>segunda</strong> sessão para confirmar → só então fechar a primeira.',
            correct: true
          },
          { text: 'Editar, reiniciar o servidor inteiro e testar depois.', why: 'Reiniciar aumenta o tempo de indisponibilidade e não valida nada antes — se a configuração estiver errada, você fica sem acesso.' },
          { text: 'Editar e reconectar imediatamente para testar, fechando a sessão atual.', why: 'Fechar a sessão que funciona antes de confirmar a nova é exatamente como as pessoas se trancam para fora.' },
          { text: 'Desativar senha e chave ao mesmo tempo, para forçar o uso do console.', why: 'Isso elimina todos os caminhos de acesso remoto de uma vez.' }
        ],
        explain: 'Vale ainda a rede de segurança extra: antes de recarregar, agendar uma reversão automática — algo como <code>sudo sh -c \'sleep 300 && cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config && systemctl reload ssh\' &</code>. Se você confirmar que está tudo bem, cancela o agendamento; se travar, a configuração volta sozinha em cinco minutos.'
      },
      {
        id: 't10-4-b', kind: 'desafio', title: 'Endureça o web01',
        body: [
          { p: 'Aplique no servidor <code>web01</code> a configuração recomendada — sem perder o seu acesso.' },
          { p: 'Antes de qualquer coisa, garanta que sua chave funciona (aula 10.2). Depois, no <code>/etc/ssh/sshd_config</code> do <code>web01</code>, o estado final deve conter, em linhas <strong>ativas</strong> (sem <code>#</code>):' },
          {
            code: [
              'PermitRootLogin no',
              'PasswordAuthentication no',
              'PubkeyAuthentication yes'
            ], run: false, mixed: false, lang: 'ini'
          },
          { p: 'Requisitos:' },
          {
            ul: [
              'as três linhas presentes e sem comentário;',
              'a sintaxe validada (<code>sshd -t</code>) e o serviço recarregado no <code>web01</code>;',
              'seu acesso por chave continua funcionando ao final — comprove com <code>ssh web01 whoami</code>.'
            ]
          },
          { p: 'Dica de método: use <code>sed -i</code> para trocar as linhas existentes, ou acrescente as diretivas ao final do arquivo (a última ocorrência de uma diretiva no arquivo principal é ignorada se já houver uma ativa antes — por isso, prefira o <code>sed</code>).' }
        ],
        hints: [
          'Você pode rodar comandos no servidor sem abrir sessão: <code>ssh web01 "sudo ..."</code>.',
          'Para trocar uma linha comentada por uma ativa: <code>sudo sed -i \'s/^#*PermitRootLogin.*/PermitRootLogin no/\' /etc/ssh/sshd_config</code>.',
          'Sequência: os três <code>sed</code>, depois <code>sudo sshd -t</code> e <code>sudo systemctl reload ssh</code> — tudo dentro de <code>ssh web01 "..."</code>.'
        ],
        solution: '<div class="code"><pre>ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" 2&gt;/dev/null\nssh-copy-id aluno@web01\nssh web01 whoami\n\nssh web01 "sudo sed -i \'s/^#*PermitRootLogin.*/PermitRootLogin no/\' /etc/ssh/sshd_config"\nssh web01 "sudo sed -i \'s/^#*PasswordAuthentication.*/PasswordAuthentication no/\' /etc/ssh/sshd_config"\nssh web01 "sudo sed -i \'s/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/\' /etc/ssh/sshd_config"\n\nssh web01 "sudo sshd -t &amp;&amp; echo sintaxe-ok"\nssh web01 "sudo systemctl reload ssh"\nssh web01 "sudo grep -E \'^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)\' /etc/ssh/sshd_config"\nssh web01 whoami</pre></div><p style="margin-top:8px">Em um servidor real, o mesmo resultado sairia mais limpo em <code>/etc/ssh/sshd_config.d/99-endurecimento.conf</code>: três linhas em um arquivo próprio, que uma atualização do pacote não sobrescreve.</p>',
        check: async (ctx) => {
          const web = remoto(ctx, 'web01');
          if (!web) return { ok: false, msg: 'Conecte-se ao <code>web01</code> ao menos uma vez.' };
          let conf = '';
          try { conf = web.fs.readFile('/etc/ssh/sshd_config', { ctx: web.ctxRoot() }); } catch (e) { }
          const ativa = (re) => conf.split('\n').some(l => re.test(l.trim()) && !l.trim().startsWith('#'));
          return LX.H.checkAll([
            [!!conf, 'Não consegui ler o <code>/etc/ssh/sshd_config</code> do <code>web01</code>.'],
            [web.sshKeysAuthorized.has('aluno'), 'Instale sua chave no <code>web01</code> <strong>antes</strong> de desativar a senha (<code>ssh-copy-id aluno@web01</code>).'],
            [ativa(/^PermitRootLogin\s+no$/i), 'Falta a linha ativa <code>PermitRootLogin no</code>.'],
            [ativa(/^PasswordAuthentication\s+no$/i), 'Falta a linha ativa <code>PasswordAuthentication no</code>.'],
            [ativa(/^PubkeyAuthentication\s+yes$/i), 'Falta a linha ativa <code>PubkeyAuthentication yes</code>.'],
            [() => H.usedCommand(ctx, /sshd\s+-t/), 'Valide a sintaxe com <code>sshd -t</code> antes de recarregar.'],
            [() => H.usedCommand(ctx, /systemctl\s+reload\s+ssh|systemctl\s+restart\s+ssh/), 'Recarregue o serviço no <code>web01</code> para aplicar.'],
            [() => H.usedCommand(ctx, /ssh\s+web01/), 'Comprove que seu acesso continua funcionando.']
          ]);
        }
      }
    ]
  });

})();
