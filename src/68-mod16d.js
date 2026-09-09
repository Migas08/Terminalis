/* =========================================================================
   MÓDULO 17 — Diagnóstico e troubleshooting
   Não é uma lista de comandos: é um método. Cada aula planta um defeito
   real na máquina e o desafio só passa quando a máquina volta a funcionar.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const ler = (ctx, p) => H.read(ctx, p) || '';
  const unidade = (ctx, nome) => {
    const m = ctx.machine || ctx.sh.m;
    const n = nome.includes('.') ? nome : nome + '.service';
    return m.units && (m.units.get ? m.units.get(n) : m.units[n]);
  };

  /* ============================== 17.1 ============================== */
  LX.lesson('m16d', {
    id: 'l17-1', n: '17.1', title: 'O método: como pensar quando quebra',
    goal: 'Trocar "tentar coisas até funcionar" por um procedimento que converge — e que funciona igual em Linux, em Docker e em qualquer sistema que você ainda vai conhecer.',
    body: [
      { h2: 'Por que existe um método' },
      { p: 'Quando algo quebra, a reação natural é começar a mexer: reiniciar o serviço, reiniciar a máquina, mudar uma permissão, comentar uma linha. Às vezes funciona. O problema é que, quando funciona, <strong>você não sabe o que consertou</strong> — e portanto não sabe se vai voltar a acontecer, nem consegue explicar para ninguém.' },
      { p: 'Um método existe por três motivos concretos: <strong>converge</strong> (cada passo elimina possibilidades em vez de sortear), <strong>não estraga mais</strong> (você mede antes de mexer) e <strong>deixa rastro</strong> (no fim existe uma explicação, não uma superstição).' },

      { h2: 'Os sete passos' },
      {
        ascii: `1. SINTOMA     o que exatamente não funciona? para quem? desde quando?
      ↓
2. ESCOPO      é geral ou específico? um usuário ou todos?
      ↓            uma máquina ou várias? sempre ou às vezes?
3. CAMADA      onde na pilha está o problema?
      ↓
4. HIPÓTESE    "acho que é X, porque Y"
      ↓
5. TESTE       o menor comando que confirma ou derruba a hipótese
      ↓            (derrubou? volta ao 4 com o que você aprendeu)
6. CORREÇÃO    a menor mudança que resolve
      ↓
7. REGISTRO    o que era, como se descobriu, como se corrigiu`
      },

      { h2: '1. Sintoma: "está fora do ar" não é sintoma' },
      { p: 'A primeira tarefa é transformar a reclamação em uma frase verificável. Compare:' },
      {
        table: {
          head: ['Reclamação', 'Sintoma utilizável'],
          rows: [
            ['"o site caiu"', '"<code>curl http://localhost</code> devolve <em>connection refused</em> desde as 14h20"'],
            ['"o servidor está lento"', '"a resposta passou de 80 ms para 4 s, começando ontem à noite"'],
            ['"não consigo entrar"', '"o SSH pede senha, e antes entrava por chave"'],
            ['"o backup falhou"', '"o cron das 3h saiu com código 1 e o log diz <em>No space left on device</em>"']
          ]
        }
      },
      { p: 'A diferença é que a coluna da direita <strong>pode ser reproduzida</strong>. E "desde quando" costuma valer mais que todo o resto, porque leva direto à pergunta seguinte.' },

      { h2: 'A pergunta que resolve metade dos casos' },
      {
        box: 'key', label: 'O que mudou?', body: [
          { p: 'Sistemas não se deterioram sozinhos de um dia para o outro. Se funcionava ontem e não funciona hoje, alguma coisa mudou: um deploy, uma atualização de pacote, uma edição de configuração, um certificado que venceu, um disco que encheu.' },
          { p: 'E o Linux registra quase todas essas mudanças:' },
          {
            ul: [
              '<code>ls -lt /etc | head</code> — o que foi editado por último',
              '<code>grep " install \\| upgrade " /var/log/dpkg.log | tail</code> — o que foi instalado ou atualizado',
              '<code>journalctl --since "2 hours ago" -p warning</code> — o que a máquina reclamou',
              '<code>last -n 10</code> e <code>grep sudo /var/log/auth.log</code> — quem entrou e o que fez',
              '<code>uptime</code> — houve reboot?'
            ]
          }
        ]
      },

      { h2: '3. Camada: dividir para reduzir' },
      { p: 'A técnica que mais economiza tempo é a <strong>busca binária</strong>: em vez de testar a pilha inteira, teste no meio e descubra em qual metade está o problema.' },
      {
        ascii: `navegador  →  DNS  →  rede  →  firewall  →  serviço  →  aplicação  →  banco
                              │
                   teste aqui primeiro:
              "a porta responde da própria máquina?"

  responde  →  o problema está À ESQUERDA (rede, firewall, DNS)
  não responde → o problema está À DIREITA (serviço, app, banco)`
      },
      { p: 'Um comando elimina metade das possibilidades. Depois repita dentro da metade que sobrou. Três ou quatro testes chegam ao ponto exato — contra dezenas de tentativas aleatórias.' },
      {
        table: {
          head: ['Camada', 'Pergunta', 'Teste'],
          rows: [
            ['Processo', 'está rodando?', '<code>systemctl status X</code>, <code>ps aux | grep X</code>'],
            ['Porta', 'está escutando?', '<code>sudo ss -tlnp | grep :PORTA</code>'],
            ['Local', 'responde na própria máquina?', '<code>curl -sv http://localhost:PORTA</code>'],
            ['Firewall', 'a regra existe?', '<code>sudo ufw status verbose</code>'],
            ['Rede', 'o host é alcançável?', '<code>ping</code>, <code>traceroute</code>'],
            ['DNS', 'o nome resolve?', '<code>dig +short nome</code>, <code>getent hosts nome</code>'],
            ['Permissão', 'o processo consegue ler?', '<code>sudo -u www-data cat arquivo</code>, <code>namei -l caminho</code>'],
            ['Recurso', 'acabou algo?', '<code>df -h</code>, <code>df -i</code>, <code>free -h</code>']
          ]
        }
      },

      { h2: 'Ler o erro — de verdade' },
      { p: 'Mensagens de erro são desprezadas porque parecem crípticas. Quase sempre elas dizem exatamente o que houve, se você separar as partes:' },
      { code: ['cp: cannot create regular file \'/etc/app.conf\': Permission denied'], run: false, lang: 'text' },
      {
        ul: [
          '<strong>quem falou</strong>: <code>cp</code> — o erro é do comando, não do arquivo',
          '<strong>o que tentou</strong>: <code>cannot create regular file</code> — criar, não ler',
          '<strong>onde</strong>: <code>/etc/app.conf</code>',
          '<strong>por quê</strong>: <code>Permission denied</code> — o kernel recusou'
        ]
      },
      { p: 'Um pequeno vocabulário resolve a maioria dos casos:' },
      {
        table: {
          head: ['Mensagem', 'Quase sempre significa'],
          rows: [
            ['<code>Permission denied</code>', 'falta permissão <em>em algum ponto do caminho</em>, não só no arquivo final'],
            ['<code>No such file or directory</code>', 'o caminho não existe — ou é um link quebrado, ou você está em outro diretório'],
            ['<code>Connection refused</code>', 'chegou até a máquina e <strong>não tem ninguém escutando</strong> naquela porta'],
            ['<code>Connection timed out</code>', 'não chegou resposta — firewall descartando ou host inalcançável'],
            ['<code>No space left on device</code>', 'bytes <strong>ou</strong> inodes acabaram (<code>df -h</code> e <code>df -i</code>)'],
            ['<code>Address already in use</code>', 'outro processo já ocupa a porta'],
            ['<code>command not found</code>', 'não está instalado, ou o <code>PATH</code> não o alcança']
          ]
        }
      },
      {
        box: 'note', label: 'Refused × timeout: a distinção mais útil da lista', body: [
          { p: '<code>refused</code> é uma resposta: o pacote chegou, a máquina existe, e o sistema operacional respondeu "aqui não tem nada nessa porta". O problema está no <strong>serviço</strong>.' },
          { p: '<code>timeout</code> é silêncio: nada voltou. O problema está <strong>no caminho</strong> — firewall, rota, host errado. Só essa distinção já corta a investigação pela metade.' }
        ]
      },

      { h2: 'Regras de higiene' },
      {
        ul: [
          '<strong>Uma mudança de cada vez.</strong> Mexeu em três coisas e voltou a funcionar? Você não sabe qual foi, e provavelmente introduziu dois problemas novos.',
          '<strong>Guarde o estado antes.</strong> <code>cp arquivo arquivo.bak</code> custa dois segundos.',
          '<strong>Reiniciar é diagnóstico ruim.</strong> Às vezes resolve, e sempre destrói a evidência. Colete antes: <code>systemctl status</code>, <code>journalctl -xeu</code>, <code>ss -tlnp</code>.',
          '<strong>Anote enquanto faz.</strong> Duas horas depois você não lembra o que já testou — e vai testar de novo.'
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Sintoma verificável primeiro: o quê, para quem, desde quando.',
          '"O que mudou?" resolve metade dos casos, e o sistema registra as mudanças.',
          'Busca binária pela pilha: cada teste elimina metade.',
          'A mensagem de erro tem quatro partes; <code>refused</code> e <code>timeout</code> apontam lados opostos.',
          'Uma mudança por vez, com backup e anotação.'
        ]
      }
    ],
    tasks: [
      {
        id: 't17-1-a', kind: 'guiado', title: 'O que mudou nesta máquina?',
        body: [
          { p: 'Antes de qualquer diagnóstico, treine o levantamento de mudanças:' },
          { code: ['$ ls -lt /etc | head -8', '$ grep " install \\| upgrade " /var/log/dpkg.log | tail -5', '$ journalctl --since "3 hours ago" -p warning --no-pager | tail -8', '$ last -n 5', '$ uptime'] },
          { p: 'Cinco comandos, cinco fontes independentes. Em um servidor real, é comum que um deles já entregue a resposta antes de você olhar o serviço quebrado.' }
        ],
        hints: ['Nenhum desses comandos altera nada — pode rodar sempre.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /ls\s+-[a-z]*lt|ls\s+.*-t\b/), 'Veja o que foi editado por último com <code>ls -lt /etc</code>.'],
          [() => H.usedCommand(ctx, /dpkg\.log/), 'Consulte o histórico de pacotes em <code>/var/log/dpkg.log</code>.'],
          [() => H.usedCommand(ctx, /journalctl.*--since/), 'Veja o que a máquina reclamou recentemente com <code>journalctl --since</code>.'],
          [() => H.usedCommand(ctx, /\blast\b/), 'Veja quem entrou com <code>last</code>.']
        ])
      },
      {
        id: 't17-1-q', kind: 'quiz', title: 'Refused ou timeout?',
        body: [
          { p: 'Uma aplicação em outro servidor não consegue falar com o seu banco na porta 5432. Você testa da máquina da aplicação:' },
          { code: ['$ curl -v telnet://10.0.5.20:5432', '* connect to 10.0.5.20 port 5432 failed: Connection timed out'], run: false, lang: 'text' },
          { p: 'E, de dentro do próprio servidor de banco:' },
          { code: ['$ curl -v telnet://localhost:5432', '* Connected to localhost (127.0.0.1) port 5432'], run: false, lang: 'text' },
          { p: 'Onde está o problema?' }
        ],
        options: [
          { text: 'No caminho entre as duas máquinas — firewall descartando os pacotes, rota ausente ou o banco escutando só em <code>127.0.0.1</code>.', correct: true },
          { text: 'O serviço do banco está parado.', why: 'Ele responde em <code>localhost</code>: o processo está de pé e escutando. Se estivesse parado, o teste local também falharia.' },
          { text: 'O DNS não resolve o nome do servidor de banco.', why: 'O teste usou o IP diretamente, sem passar por DNS.' },
          { text: 'As credenciais do banco estão erradas.', why: 'Autenticação acontece <em>depois</em> da conexão TCP. Um erro de credencial produziria conexão aceita e depois recusa da aplicação — nunca um timeout.' }
        ],
        explain: 'Os dois testes juntos delimitam o problema com precisão: funciona dentro, não funciona fora. Isso deixa três suspeitos, nesta ordem de verificação: (1) o serviço escuta em <code>127.0.0.1</code> em vez de <code>0.0.0.0</code> — confira com <code>sudo ss -tlnp | grep 5432</code>; (2) o firewall do servidor de banco descarta a porta — <code>sudo ufw status</code>; (3) rota ou firewall no meio do caminho. Repare que o <em>timeout</em> (e não <em>refused</em>) já dizia que o problema estava no caminho, não no serviço.'
      },
      {
        id: 't17-1-b', kind: 'desafio', title: 'Aplique a pergunta que resolve metade dos casos',
        body: [
          { p: 'Um serviço começou a se comportar mal e a suspeita é de uma instalação recente. Antes de olhar o serviço, responda à pergunta que a aula chama de mais importante: <strong>o que mudou?</strong>' },
          { p: 'O Linux registra cada pacote instalado em <code>/var/log/dpkg.log</code>. Descubra o <strong>nome do último pacote instalado</strong> nesta máquina e grave-o, sozinho, em <code>~/mudanca.txt</code> — sem o <code>:amd64</code> e sem mais nada na linha.' },
          { p: 'Tem que sair de um comando lendo o log, não digitado à mão.' }
        ],
        hints: [
          'As instalações são as linhas com <code>install</code> no <code>/var/log/dpkg.log</code>. A última é <code>grep " install " /var/log/dpkg.log | tail -1</code>.',
          'Nessa linha, o nome do pacote é o 4º campo, no formato <code>nome:arquitetura</code>. Pegue o campo com <code>awk \'{print $4}\'</code> e corte o <code>:amd64</code> com <code>cut -d: -f1</code>, redirecionando com <code>&gt;</code>.'
        ],
        solution: '<div class="code"><pre>grep " install " /var/log/dpkg.log | tail -1 | awk \'{print $4}\' | cut -d: -f1 &gt; ~/mudanca.txt\ncat ~/mudanca.txt</pre></div>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/mudanca.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/mudanca.txt</code> ainda não existe.' };
          const esperado = ((await ctx.run("grep ' install ' /var/log/dpkg.log | tail -1 | awk '{print $4}' | cut -d: -f1")).out || '').trim();
          const escrito = c.trim().replace(/:amd64$/, '');
          return LX.H.checkAll([
            [() => escrito.length > 0, 'O arquivo está vazio. Extraia o nome do pacote do log.'],
            [() => !!esperado && escrito === esperado, () => `O último pacote instalado é <code>${esperado}</code>, mas o arquivo diz <code>${c.trim()}</code>. Confira a última linha de <code>install</code> do <code>/var/log/dpkg.log</code>.`]
          ]);
        }
      },

    ]
  });

  /* ============================== 17.2 ============================== */
  LX.lesson('m16d', {
    id: 'l17-2', n: '17.2', title: 'Ambiente quebrado: o serviço que não sobe',
    goal: 'Aplicar o método num defeito real plantado nesta máquina — e só concluir a aula quando o serviço estiver de pé.',
    setup: (m) => {
      /* Defeito plantado: a unit aponta para um caminho que não existe e
         roda como um usuário inexistente. Dois erros, um de cada vez. */
      try {
        const ctx = m.ctxRoot();
        m.fs.mkdirp('/opt/relatorios', { ctx });
        const s = m.fs.writeFile('/opt/relatorios/gerar.sh',
          '#!/bin/bash\nset -euo pipefail\necho "relatorio gerado em $(date)" >> /var/log/relatorios.log\n', { ctx });
        s.mode = 0o755;
        const log = m.fs.writeFile('/var/log/relatorios.log', '', { ctx });
        log.mode = 0o666;
        m.fs.writeFile('/etc/systemd/system/relatorios.service',
          '[Unit]\nDescription=Gerador de relatorios da equipe\nAfter=network.target\n\n' +
          '[Service]\nType=simple\nUser=relatorios\nExecStart=/opt/relatorio/gerar.sh\nRestart=on-failure\n\n' +
          '[Install]\nWantedBy=multi-user.target\n', { ctx });
        if (m.daemonReload) m.daemonReload();
      } catch (e) { }
    },
    body: [
      { h2: 'O chamado' },
      {
        box: 'note', label: 'Chamado #5120', body: [
          { p: '"Instalei o gerador de relatórios ontem e ele não sobe. Já rodei <code>systemctl start relatorios</code> várias vezes e não dá erro nenhum na tela. Consegue olhar?"' }
        ]
      },
      { p: 'Repare no detalhe: <em>"não dá erro nenhum na tela"</em>. O <code>systemctl start</code> de um serviço que falha imprime pouco de propósito — o motivo está no journal, e é lá que quase ninguém olha primeiro.' },

      { h2: 'Passo a passo, aplicando o método' },
      { p: '<strong>1. Sintoma verificável.</strong> Comece confirmando o que foi relatado, com o comando que mostra o estado real:' },
      { code: ['$ systemctl status relatorios --no-pager'] },
      { p: 'A saída traz três informações que importam: <code>Loaded</code> (o systemd conhece a unit?), <code>Active</code> (em que estado está) e as últimas linhas de log. Um serviço em <code>failed</code> costuma trazer também um <code>status=</code> numérico — que é a pista.' },

      { p: '<strong>2. O journal, que é onde o motivo está.</strong>' },
      { code: ['$ sudo systemctl start relatorios', '$ sudo journalctl -xeu relatorios --no-pager | tail -15'] },
      {
        box: 'key', label: 'Os códigos de saída do systemd', body: [
          { p: 'Quando uma unit falha antes mesmo de executar o programa, o systemd usa códigos próprios que dizem exatamente o que ele não conseguiu fazer:' },
          {
            table: {
              head: ['Código', 'Significa'],
              rows: [
                ['<code>200/CHDIR</code>', 'o <code>WorkingDirectory=</code> não existe'],
                ['<code>203/EXEC</code>', 'o binário do <code>ExecStart=</code> não existe, não é executável ou está sem shebang'],
                ['<code>207/STDOUT</code>', 'não conseguiu abrir a saída configurada'],
                ['<code>217/USER</code>', 'o usuário do <code>User=</code> não existe'],
                ['<code>226/NAMESPACE</code>', 'alguma diretiva de isolamento falhou'],
                ['<code>1/FAILURE</code>', 'o programa <strong>rodou</strong> e saiu com erro — aí o log é do programa']
              ]
            }
          },
          { p: 'Essa tabela sozinha resolve boa parte dos "meu serviço não sobe". Um <code>203/EXEC</code> nunca é problema do seu código: é caminho, permissão de execução ou shebang.' }
        ]
      },

      { p: '<strong>3. Hipótese e teste.</strong> Descoberto o código, teste a hipótese com o menor comando possível — não edite nada ainda:' },
      { code: ['$ grep ExecStart /etc/systemd/system/relatorios.service', '$ ls -l /opt/relatorio/gerar.sh', '$ ls -l /opt/relatorios/gerar.sh', '$ grep User /etc/systemd/system/relatorios.service', '$ getent passwd relatorios'] },
      { p: 'Um <code>ls</code> e um <code>getent</code> confirmam ou derrubam a hipótese em dois segundos. Repare que existem <strong>dois</strong> problemas aqui, e o systemd só mostra um de cada vez: ele para no primeiro. Corrigir um e ver o serviço falhar de novo, com outro código, é o comportamento esperado — não é sinal de que você errou.' },

      { p: '<strong>4. Correção mínima.</strong> Uma mudança de cada vez, e depois de editar a unit, sempre:' },
      { code: ['$ sudo systemctl daemon-reload'] },
      { p: 'O systemd trabalha com a cópia que carregou na memória. Editar o arquivo sem recarregar é o motivo número um de "corrigi e continua igual".' },

      { h2: 'Resumo do procedimento' },
      {
        ul: [
          '<code>systemctl status</code> para o estado, <code>journalctl -xeu</code> para o motivo.',
          'O código de saída (<code>203/EXEC</code>, <code>217/USER</code>…) nomeia o problema.',
          'Confirme a hipótese com <code>ls</code>/<code>getent</code> antes de editar.',
          'Uma correção por vez, e <code>daemon-reload</code> depois de cada edição.',
          'O systemd revela um erro de cada vez: falhar de novo com outro código é progresso.'
        ]
      }
    ],
    tasks: [
      {
        id: 't17-2-a', kind: 'guiado', title: 'Colete antes de mexer',
        body: [
          { p: 'Reproduza o sintoma e colete a evidência, sem corrigir nada ainda:' },
          { code: ['$ systemctl status relatorios --no-pager', '$ sudo systemctl start relatorios', '$ sudo journalctl -xeu relatorios --no-pager | tail -12'] },
          { p: 'Anote o código de saída que apareceu. É ele que nomeia o problema — e você vai ver que ele muda depois da primeira correção.' }
        ],
        hints: ['O <code>-xeu</code> combina três coisas: explicação estendida (<code>-x</code>), pular para o fim (<code>-e</code>) e filtrar pela unit (<code>-u</code>).'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /systemctl\s+status\s+relatorios/), 'Comece com <code>systemctl status relatorios</code>.'],
          [() => H.usedCommand(ctx, /systemctl\s+start\s+relatorios/), 'Reproduza o sintoma: tente iniciar o serviço.'],
          [() => H.usedCommand(ctx, /journalctl.*relatorios/), 'Leia o motivo no journal: <code>sudo journalctl -xeu relatorios</code>.']
        ])
      },
{
        id: 't17-2-q', kind: 'quiz', title: 'O código de saída do systemd',
        body: [
          { p: 'Um serviço não sobe. O <code>systemctl status</code> mostra <code>Active: failed</code> e, no journal, a linha:' },
          { code: ['relatorios.service: Failed at step EXEC spawning /opt/relatorio/gerar.sh: No such file or directory', 'relatorios.service: Main process exited, code=exited, status=203/EXEC'], run: false, lang: 'text' },
          { p: 'O que esse <code>203/EXEC</code> diz, antes mesmo de você olhar o script?' }
        ],
        options: [
          { text: 'O systemd não conseguiu nem <strong>executar</strong> o programa do <code>ExecStart=</code>: o caminho não existe, não é executável ou está sem shebang. O problema não é o código do script.', correct: true },
          { text: 'O script rodou e saiu com erro na linha 203.', why: 'O número não é uma linha do script. É um código do próprio systemd, na faixa 200-217, que sinaliza falha <em>antes</em> de o programa começar a rodar.' },
          { text: 'O usuário do <code>User=</code> não existe.', why: 'Esse caso tem código próprio: <code>217/USER</code>. O <code>203/EXEC</code> é especificamente sobre executar o binário.' },
          { text: 'A porta que o serviço usa já está ocupada.', why: 'Porta ocupada é um erro em tempo de execução (<code>Address already in use</code>), não uma falha de <em>spawn</em>. O <code>203/EXEC</code> acontece antes de qualquer porta ser aberta.' }
        ],
        explain: 'Os códigos 2xx do systemd descrevem falhas na preparação do processo: <code>200/CHDIR</code> (WorkingDirectory não existe), <code>203/EXEC</code> (ExecStart não executável/inexistente), <code>217/USER</code> (User não existe). Um <code>203/EXEC</code> manda você conferir o caminho e a permissão do <code>ExecStart=</code> — aqui, <code>/opt/relatorio/gerar.sh</code> não existe (o correto é <code>/opt/relatorios/</code>).'
      },
      {
        id: 't17-2-b', kind: 'desafio', title: 'Coloque o serviço de pé',
        body: [
          { p: 'Agora corrija. O estado final exigido:' },
          {
            ul: [
              'o serviço <code>relatorios</code> <strong>ativo</strong>;',
              'a unit executando o script que realmente existe;',
              'rodando como um usuário de serviço que existe, <strong>não como root</strong>;',
              'habilitado para subir no boot.'
            ]
          },
          { p: 'Você decide como resolver cada um dos dois defeitos: corrigir o caminho na unit ou mover o script; criar o usuário que falta ou apontar para outro que exista. Qualquer caminho que produza o estado final é aceito — mas troque <strong>uma coisa de cada vez</strong> e observe o código mudar.' },
          { p: 'Registre o que encontrou em <code>~/diagnostico-5120.txt</code>, com uma linha por defeito, no formato <code>DEFEITO: descrição</code> — pelo menos duas linhas.' }
        ],
        hints: [
          'O <code>ExecStart</code> aponta para <code>/opt/relatorio/gerar.sh</code> (singular). Confira com <code>ls</code> onde o script está de verdade.',
          'O segundo defeito só aparece depois de corrigir o primeiro: o <code>User=</code> da unit indica uma conta que não existe. Crie com <code>sudo useradd --system --shell /usr/sbin/nologin relatorios</code> e lembre que o script escreve num log — o usuário precisa poder escrever nele.'
        ],
        solution: '<div class="code"><pre>systemctl status relatorios --no-pager\nsudo systemctl start relatorios\nsudo journalctl -xeu relatorios --no-pager | tail -5\n\n# defeito 1: caminho errado no ExecStart\nsudo sed -i \'s|/opt/relatorio/gerar.sh|/opt/relatorios/gerar.sh|\' /etc/systemd/system/relatorios.service\nsudo systemctl daemon-reload\nsudo systemctl start relatorios\nsudo journalctl -xeu relatorios --no-pager | tail -3\n\n# defeito 2: o usuario do User= nao existe\nsudo useradd --system --shell /usr/sbin/nologin relatorios\nsudo chown relatorios /var/log/relatorios.log\nsudo systemctl start relatorios\nsudo systemctl enable relatorios\nsystemctl status relatorios --no-pager\n\nprintf \'DEFEITO: ExecStart apontava para /opt/relatorio (singular), caminho inexistente — 203/EXEC\\nDEFEITO: User=relatorios nao existia no sistema — 217/USER\\n\' &gt; ~/diagnostico-5120.txt</pre></div><p style="margin-top:8px">Dois defeitos, dois códigos diferentes, duas correções independentes. Se você tivesse mudado as duas coisas de uma vez, teria funcionado igual — e você não saberia que eram dois problemas.</p>',
        check: async (ctx) => {
          const u = unidade(ctx, 'relatorios');
          const unit = ler(ctx, '/etc/systemd/system/relatorios.service');
          const m = ctx.machine || ctx.sh.m;
          const usuario = (/^\s*User\s*=\s*(\S+)\s*$/m.exec(unit) || [])[1];
          const exec = (/^\s*ExecStart\s*=\s*(\S+)/m.exec(unit) || [])[1];
          const diag = ler(ctx, '/home/aluno/diagnostico-5120.txt');
          const defeitos = diag.split('\n').filter(l => /^DEFEITO:/.test(l.trim()));
          return H.checkAll([
            [!!unit, 'A unit <code>relatorios.service</code> sumiu — ela deveria existir em <code>/etc/systemd/system/</code>.'],
            [() => !!exec && H.exists(ctx, exec), () => `O <code>ExecStart=</code> aponta para <code>${exec || '?'}</code>, que não existe. Esse é o <code>203/EXEC</code>.`],
            [() => !!exec && (H.mode(ctx, exec) & 0o111) !== 0, 'O programa do <code>ExecStart=</code> existe mas não é executável.'],
            [() => !!usuario, 'A unit precisa continuar rodando com <code>User=</code> — um serviço exposto não deve rodar como root.'],
            [() => usuario !== 'root', 'O serviço não pode rodar como <code>root</code>. Use uma conta de serviço.'],
            [() => !!m.userByName(usuario), () => `O usuário <code>${usuario}</code> do <code>User=</code> não existe no sistema. Esse é o <code>217/USER</code>.`],
            [!!u, 'O systemd ainda não recarregou a unit — rode <code>sudo systemctl daemon-reload</code>.'],
            [() => !!u && (u.state === 'active' || u.active === true), () => `O serviço ainda não está ativo (está <code>${u ? u.state : '?'}</code>). Continue: cada correção revela o próximo erro.`],
            [() => !!u && u.enabled === true, 'Falta habilitar o serviço para o boot (<code>systemctl enable relatorios</code>).'],
            [() => defeitos.length >= 2, 'Registre os achados em <code>~/diagnostico-5120.txt</code>: pelo menos duas linhas começando com <code>DEFEITO:</code>.'],
            [() => /exec|caminho|path|opt\/relatorio/i.test(diag), 'Um dos registros deve descrever o problema do caminho do <code>ExecStart</code>.'],
            [() => /user|usu[aá]rio|217/i.test(diag), 'O outro registro deve descrever o problema do usuário inexistente.']
          ]);
        }
      }
    ]
  });

  /* ============================== 17.3 ============================== */
  LX.lesson('m16d', {
    id: 'l17-3', n: '17.3', title: 'Ambiente quebrado: disco cheio e permissão negada',
    goal: 'Investigar dois clássicos que se disfarçam um do outro — e aprender a diferença entre o que o df diz e o que o du encontra.',
    setup: (m) => {
      try {
        const ctx = m.ctxRoot();
        /* um diretório de log inchado e um diretório de dados com permissão errada */
        m.fs.mkdirp('/var/log/coletor', { ctx });
        for (let i = 1; i <= 6; i++) {
          const n = m.fs.writeFile(`/var/log/coletor/coleta-${i}.log`, ('linha de coleta repetida\n').repeat(900), { ctx });
          n.mode = 0o644;
        }
        const d = m.fs.mkdirp('/srv/dados', { ctx });
        d.mode = 0o700; d.uid = 0; d.gid = 0;
        const arq = m.fs.writeFile('/srv/dados/entrada.csv', 'id,valor\n1,10\n2,20\n', { ctx });
        arq.mode = 0o600; arq.uid = 0; arq.gid = 0;
        const g = m.groupByName('dados') || null;
        if (!g && m.addGroup) m.addGroup('dados');
      } catch (e) { }
    },
    body: [
      { h2: 'O chamado' },
      {
        box: 'note', label: 'Chamado #5133', body: [
          { p: '"Duas coisas: (1) o <code>/var/log</code> está enorme e ninguém sabe o quê; (2) o serviço de importação não consegue ler <code>/srv/dados/entrada.csv</code> e devolve <em>Permission denied</em>, mesmo o arquivo existindo. O serviço roda como o usuário <code>importador</code>, que está no grupo <code>dados</code>."' }
        ]
      },

      { h2: 'Parte 1: quem está ocupando o disco' },
      { p: 'A investigação de espaço é sempre a mesma descida, do geral para o específico:' },
      { code: ['$ df -h', '$ df -i', '$ sudo du -sh /var/* 2>/dev/null | sort -rh | head -5', '$ sudo du -sh /var/log/* 2>/dev/null | sort -rh | head -5'] },
      { p: 'Olhe o maior, entre nele, repita. Três ou quatro descidas chegam ao culpado. E rode sempre o <code>df -i</code> junto: <code>No space left on device</code> com o disco em 20% significa que acabaram os <strong>inodes</strong>, não os bytes.' },
      {
        box: 'warn', label: 'Quando o du e o df discordam', body: [
          { p: 'Se o <code>df</code> acusa 95% e a soma do <code>du</code> dá muito menos, existe arquivo <strong>apagado que ainda está aberto</strong>: alguém rodou <code>rm</code> num log que um processo mantém aberto. O nome sumiu do diretório, o espaço não foi liberado, e o <code>du</code> não o enxerga porque ele percorre nomes.' },
          { code: ['$ sudo lsof | grep deleted'], run: false },
          { p: 'A correção é reiniciar (ou mandar reabrir) o processo que segura o arquivo. E a prevenção é a aula 16.2: <code>truncate -s 0</code> em vez de <code>rm</code>, e logrotate configurado.' }
        ]
      },

      { h2: 'Parte 2: permissão negada em um arquivo que existe' },
      { p: 'O erro <code>Permission denied</code> engana porque a maioria olha só o arquivo final. Para chegar a <code>/srv/dados/entrada.csv</code> o processo precisa de permissão de <strong>travessia</strong> (<code>x</code>) em <em>cada</em> diretório do caminho: <code>/</code>, <code>/srv</code>, <code>/srv/dados</code> — e só então leitura no arquivo.' },
      { code: ['$ ls -l /srv/dados/entrada.csv', '$ ls -ld /srv /srv/dados', '$ namei -l /srv/dados/entrada.csv'] },
      { p: 'O <code>namei -l</code> é a ferramenta certa para isso: ele imprime dono, grupo e modo de <strong>cada componente</strong> do caminho, de uma vez. Se algum diretório do meio não tem <code>x</code> para quem está tentando, a leitura falha ali — e a mensagem aponta o arquivo final, não o diretório culpado.' },
      {
        box: 'key', label: 'O teste que encerra a discussão', body: [
          { p: 'Em vez de deduzir, pergunte ao sistema fazendo o teste <em>como o usuário do serviço</em>:' },
          { code: ['$ sudo -u importador cat /srv/dados/entrada.csv'], run: false },
          { p: 'Se falhar, você reproduziu o problema exatamente; se funcionar, o problema não é permissão de arquivo — é outra coisa (o serviço roda como outro usuário, ou há um caminho diferente na configuração).' }
        ]
      },
      { p: 'A correção certa quase nunca é <code>chmod 777</code>. É dar acesso <strong>ao grupo</strong> que precisa: dono e grupo corretos, <code>x</code> nos diretórios do caminho, leitura no arquivo. E, se arquivos novos precisam nascer com o grupo certo, SGID no diretório — como você viu no módulo 5.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Espaço: <code>df -h</code> e <code>df -i</code>, depois <code>du | sort -rh</code> descendo nível a nível.',
          '<code>du</code> muito menor que <code>df</code> = arquivo apagado ainda aberto (<code>lsof | grep deleted</code>).',
          'Permissão exige <code>x</code> em todos os diretórios do caminho; <code>namei -l</code> mostra a cadeia inteira.',
          'Reproduza como o usuário afetado: <code>sudo -u usuario cat arquivo</code>.',
          'A correção é grupo e travessia, não <code>chmod 777</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't17-3-a', kind: 'guiado', title: 'Desça até o culpado',
        body: [
          { p: 'Faça a descida completa e depois examine a cadeia de permissões:' },
          { code: ['$ df -h', '$ df -i', '$ sudo du -sh /var/log/* 2>/dev/null | sort -rh | head -5', '$ namei -l /srv/dados/entrada.csv'] },
          { p: 'A saída do <code>namei</code> é a resposta da segunda metade do chamado: leia linha por linha e identifique em qual componente do caminho o acesso morre.' }
        ],
        hints: ['O <code>namei -l</code> imprime uma linha por componente do caminho, com o modo de cada um.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /df\s+.*-i/), 'Confira também os inodes com <code>df -i</code>.'],
          [() => H.usedCommand(ctx, /du\s+.*\/var\/log/), 'Desça no <code>/var/log</code> com <code>du -sh /var/log/* | sort -rh</code>.'],
          [() => H.usedCommand(ctx, /namei|ls\s+-ld/), 'Examine a cadeia de permissões com <code>namei -l</code> (ou <code>ls -ld</code> em cada diretório).']
        ])
      },
{
        id: 't17-3-q', kind: 'quiz', title: 'Permission denied num arquivo que existe',
        body: [
          { p: 'O serviço roda como o usuário <code>importador</code> e devolve <code>Permission denied</code> ao ler <code>/srv/dados/entrada.csv</code>. Você confere e o arquivo existe e está com <code>rw-r--r--</code> — leitura liberada para todos. Por onde continuar a investigação?' }
        ],
        options: [
          { text: 'Conferir a permissão de <strong>travessia</strong> (<code>x</code>) em cada diretório do caminho — <code>/</code>, <code>/srv</code>, <code>/srv/dados</code> — porque sem <code>x</code> num deles o processo nem chega ao arquivo, por mais liberado que ele esteja.', correct: true },
          { text: 'Dar <code>chmod 777</code> no arquivo, já que a leitura parece o problema.', why: 'O arquivo já está legível para todos; abrir mais não muda nada. E <code>777</code> num arquivo de dados é um exagero perigoso que não toca na causa, que está no caminho.' },
          { text: 'O arquivo deve estar corrompido; recriá-lo resolve.', why: 'Corrupção não gera <code>Permission denied</code> — gera erro de leitura ou de formato. A mensagem é clara sobre ser permissão.' },
          { text: 'Reiniciar o serviço para ele reler o arquivo.', why: 'Reiniciar não altera permissão nenhuma; o erro voltaria idêntico. Reiniciar é diagnóstico ruim: às vezes mascara, nunca explica.' }
        ],
        explain: 'Para abrir <code>/srv/dados/entrada.csv</code> o processo precisa de <code>x</code> em cada diretório do caminho e de <code>r</code> no arquivo. Um <code>/srv/dados</code> sem <code>x</code> para o grupo/outros barra o acesso mesmo com o arquivo liberado. O <code>namei -l /srv/dados/entrada.csv</code> mostra as permissões de todo o caminho de uma vez — é a ferramenta certa para esse "Permission denied que engana".'
      },
      {
        id: 't17-3-b', kind: 'desafio', title: 'Resolva o chamado #5133',
        body: [
          { p: 'Entregue as duas metades.' },
          { p: '<strong>Metade 1 — espaço.</strong> Configure a rotação do diretório que está inchando: crie <code>/etc/logrotate.d/coletor</code> cobrindo <code>/var/log/coletor/*.log</code>, com <code>daily</code>, <code>rotate 5</code>, <code>compress</code>, <code>missingok</code> e <code>notifempty</code>. Force uma rotação para comprovar.' },
          { p: '<strong>Metade 2 — permissão.</strong> Faça o usuário <code>importador</code> conseguir ler <code>/srv/dados/entrada.csv</code>, <strong>sem</strong> deixar o diretório aberto para os demais usuários da máquina. Crie o que faltar:' },
          { code: ['$ sudo groupadd -f dados', '$ sudo useradd --system --shell /usr/sbin/nologin -G dados importador'] },
          {
            ul: [
              '<code>/srv/dados</code> e o arquivo pertencem ao grupo <code>dados</code>;',
              'o grupo consegue atravessar o diretório e ler o arquivo;',
              '<strong>outros</strong> continuam sem nenhuma permissão em <code>/srv/dados</code>;',
              'o teste <code>sudo -u importador cat /srv/dados/entrada.csv</code> funciona.'
            ]
          }
        ],
        hints: [
          'Para o grupo atravessar e listar um diretório, ele precisa de <code>r-x</code>; para ler o arquivo, de <code>r--</code>. Nada disso exige mexer nas permissões de "outros".',
          'Modo <code>750</code> no diretório e <code>640</code> no arquivo, com <code>chown root:dados</code> nos dois, atendem exatamente ao pedido.'
        ],
        solution: '<div class="code"><pre>sudo tee /etc/logrotate.d/coletor &gt; /dev/null &lt;&lt; \'EOF\'\n/var/log/coletor/*.log {\n    daily\n    rotate 5\n    compress\n    missingok\n    notifempty\n}\nEOF\nsudo logrotate -f /etc/logrotate.conf\nls -l /var/log/coletor/ | head\n\nsudo groupadd -f dados\nsudo useradd --system --shell /usr/sbin/nologin -G dados importador\nsudo chown -R root:dados /srv/dados\nsudo chmod 750 /srv/dados\nsudo chmod 640 /srv/dados/entrada.csv\nnamei -l /srv/dados/entrada.csv\nsudo -u importador cat /srv/dados/entrada.csv</pre></div><p style="margin-top:8px">Repare que a permissão de "outros" não foi tocada em momento algum. Foi tudo resolvido pelo grupo — que é o mecanismo que existe exatamente para isso.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const conf = ler(ctx, '/etc/logrotate.d/coletor');
          const lista = (H.ls(ctx, '/var/log/coletor') || []).map(x => (typeof x === 'string' ? x : x.name));
          const dirModo = H.mode(ctx, '/srv/dados');
          const arqModo = H.mode(ctx, '/srv/dados/entrada.csv');
          const dirDono = H.owner(ctx, '/srv/dados');
          const arqDono = H.owner(ctx, '/srv/dados/entrada.csv');
          const imp = m.userByName('importador');
          const grupos = imp ? m.groupsOfUser('importador').map(g => g.name) : [];
          return H.checkAll([
            [!!conf, 'Falta <code>/etc/logrotate.d/coletor</code>.'],
            [() => /\/var\/log\/coletor\/\*\.log\s*\{/.test(conf), 'O bloco deve cobrir <code>/var/log/coletor/*.log</code>.'],
            [() => /^\s*daily\s*$/m.test(conf) && /^\s*rotate\s+5\s*$/m.test(conf), 'Faltam <code>daily</code> e <code>rotate 5</code>.'],
            [() => /^\s*compress\s*$/m.test(conf) && /^\s*missingok\s*$/m.test(conf) && /^\s*notifempty\s*$/m.test(conf), 'Faltam <code>compress</code>, <code>missingok</code> ou <code>notifempty</code>.'],
            [() => lista.some(n => /\.log\.1(\.gz)?$/.test(n)), 'A rotação ainda não rodou. Force com <code>sudo logrotate -f /etc/logrotate.conf</code>.'],
            [!!m.groupByName('dados'), 'O grupo <code>dados</code> precisa existir.'],
            [!!imp, 'A conta de serviço <code>importador</code> precisa existir.'],
            [() => grupos.includes('dados'), 'O <code>importador</code> precisa pertencer ao grupo <code>dados</code>.'],
            [() => (dirDono || {}).group === 'dados', 'O grupo de <code>/srv/dados</code> deve ser <code>dados</code>.'],
            [() => (arqDono || {}).group === 'dados', 'O grupo de <code>/srv/dados/entrada.csv</code> deve ser <code>dados</code>.'],
            [() => (dirModo & 0o050) === 0o050, 'O grupo precisa de leitura e travessia (<code>r-x</code>) em <code>/srv/dados</code> — sem o <code>x</code> ele não atravessa o diretório.'],
            [() => (arqModo & 0o040) === 0o040, 'O grupo precisa de leitura no <code>entrada.csv</code>.'],
            [() => (dirModo & 0o007) === 0, () => `O diretório não pode ficar aberto para os demais usuários; o modo atual é ${dirModo.toString(8)}. Nada de <code>chmod 777</code>.`],
            [() => (arqModo & 0o007) === 0, 'O arquivo também não deve ficar legível por "outros".']
          ]);
        }
      }
    ]
  });

  /* ============================== 17.4 ============================== */
  LX.lesson('m16d', {
    id: 'l17-4', n: '17.4', title: 'Ambiente quebrado: a rede que não responde',
    goal: 'Percorrer a pilha de rede de baixo para cima com um comando por camada, num cenário com dois defeitos independentes.',
    setup: (m) => {
      try {
        const ctx = m.ctxRoot();
        /* DNS apontando para um resolvedor que não responde… */
        m.fs.writeFile('/etc/resolv.conf',
          '# Gerenciado por systemd-resolved\nnameserver 10.9.9.53\noptions edns0 trust-ad\nsearch lan\n', { ctx });
        /* …e um firewall ativo que bloqueia a porta do serviço web */
        m.firewall.enabled = true;
        m.firewall.defaultIn = 'deny';
        m.firewall.rules = [{ port: '22', proto: 'tcp', action: 'allow', dir: 'in', from: null }];
      } catch (e) { }
    },
    body: [
      { h2: 'O chamado' },
      {
        box: 'note', label: 'Chamado #5147', body: [
          { p: '"Depois da manutenção de ontem, a máquina não resolve nome nenhum — <code>apt update</code> falha, <code>curl</code> falha. E o time de fora diz que o serviço na porta 8080 parou de responder, mas quem está na própria máquina consegue acessar normalmente."' }
        ]
      },
      { p: 'São dois sintomas distintos. A tentação é tratar como um problema só ("a rede caiu"). O método manda separar: <strong>eles têm escopos diferentes</strong> — um afeta tudo que sai, outro afeta só o que entra numa porta.' },

      { h2: 'A escada da rede' },
      { p: 'Rede se investiga de baixo para cima, uma camada por vez, com um comando cada. Assim que uma camada falha, para: o resto depende dela.' },
      {
        ascii: `6. aplicação   curl -sv http://host:porta/       "o serviço responde?"
5. firewall    sudo ufw status verbose            "a regra existe?"
4. porta       sudo ss -tlnp | grep :8080         "tem alguém escutando?"
3. DNS         dig +short nome / getent hosts     "o nome vira IP?"
2. rota        ip route get 8.8.8.8               "sei o caminho?"
1. interface   ip -br addr                        "tenho IP?"`
      },
      { code: ['$ ip -br addr', '$ ip route', '$ cat /etc/resolv.conf', '$ getent hosts ubuntu.com', '$ ping -c 2 185.125.190.21'] },
      {
        box: 'key', label: 'O teste que separa DNS de conectividade', body: [
          { p: 'Este par de comandos é a coisa mais útil desta aula:' },
          { code: ['$ ping -c 2 1.1.1.1        # por IP', '$ ping -c 2 ubuntu.com     # por nome'], run: false },
          { p: 'Se o <strong>IP funciona e o nome não</strong>, o problema é DNS — a rede está boa. Se <strong>nenhum dos dois funciona</strong>, o problema é anterior: rota, interface ou firewall de saída. Trinta segundos que evitam uma hora de investigação na direção errada.' }
        ]
      },

      { h2: 'Onde o DNS realmente é decidido' },
      { p: 'Existem três camadas empilhadas, e é comum corrigir a errada:' },
      {
        ol: [
          '<code>/etc/hosts</code> — vence tudo. Uma linha esquecida aqui redireciona um nome silenciosamente, para sempre.',
          '<code>/etc/nsswitch.conf</code> — define a ordem de consulta (<code>hosts: files dns</code>).',
          '<code>/etc/resolv.conf</code> — os servidores DNS. Se o <code>nameserver</code> não responde, toda resolução dá timeout.'
        ]
      },
      { p: 'E o <code>getent hosts nome</code> é melhor que o <code>dig</code> para diagnosticar, porque ele percorre a mesma pilha que os programas de verdade percorrem — incluindo o <code>/etc/hosts</code>, que o <code>dig</code> ignora.' },

      { h2: 'Entrada bloqueada: o sintoma que se reconhece de longe' },
      { p: 'O segundo sintoma tem uma assinatura inconfundível: <strong>funciona de dentro, não funciona de fora</strong>. Isso elimina de saída "o serviço está parado" — ele está de pé, escutando e respondendo.' },
      { p: 'Restam três suspeitos, na ordem de verificação:' },
      {
        ol: [
          'o serviço escuta só em <code>127.0.0.1</code> em vez de <code>0.0.0.0</code> — veja a coluna de endereço no <code>sudo ss -tlnp</code>;',
          'o firewall local não tem regra para a porta — <code>sudo ufw status verbose</code>;',
          'algo no caminho entre as máquinas (fora do seu alcance a partir daqui).'
        ]
      },
      { p: 'Repare que o firewall produz <strong>timeout</strong>, não <em>refused</em>: ele descarta o pacote em silêncio. Se de fora viesse <em>refused</em>, o firewall estaria liberando e o problema seria o serviço.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Separe os sintomas antes de investigar: escopos diferentes, problemas diferentes.',
          'Suba a escada uma camada por vez: interface → rota → DNS → porta → firewall → aplicação.',
          '<code>ping</code> por IP × por nome separa DNS de conectividade em trinta segundos.',
          'DNS tem três camadas: <code>/etc/hosts</code>, <code>nsswitch.conf</code>, <code>resolv.conf</code>. Use <code>getent hosts</code>.',
          '"Funciona de dentro, não de fora" = endereço de escuta ou firewall — e firewall dá timeout, não refused.'
        ]
      }
    ],
    tasks: [
      {
        id: 't17-4-a', kind: 'guiado', title: 'Suba a escada',
        body: [
          { p: 'Percorra as camadas e observe onde a primeira falha acontece:' },
          { code: ['$ ip -br addr', '$ ip route', '$ ping -c 2 185.125.190.21', '$ getent hosts ubuntu.com', '$ cat /etc/resolv.conf', '$ sudo ufw status verbose'] },
          { p: 'O <code>ping</code> por IP deve funcionar e a resolução por nome deve falhar — a assinatura clássica de problema de DNS. E o <code>ufw status</code> mostra a segunda metade do chamado.' }
        ],
        hints: ['Se o <code>ping</code> por IP funciona e o nome não resolve, você já sabe que a rede está boa e o DNS não.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /\bip\s+(-br\s+)?addr|ifconfig/), 'Comece pela interface: <code>ip -br addr</code>.'],
          [() => H.usedCommand(ctx, /\bip\s+route|\broute\b/), 'Veja a rota com <code>ip route</code>.'],
          [() => H.usedCommand(ctx, /ping\s+.*\d+\.\d+\.\d+\.\d+/), 'Teste conectividade por <strong>IP</strong> com <code>ping</code>.'],
          [() => H.usedCommand(ctx, /getent\s+hosts|dig\b|nslookup/), 'Teste a resolução por <strong>nome</strong>.'],
          [() => H.usedCommand(ctx, /resolv\.conf/), 'Olhe o <code>/etc/resolv.conf</code>.'],
          [() => H.usedCommand(ctx, /ufw\s+status/), 'Confira o firewall com <code>sudo ufw status verbose</code>.']
        ])
      },
{
        id: 't17-4-q', kind: 'quiz', title: 'É DNS ou é a rede?',
        body: [
          { p: 'A máquina "não resolve nome nenhum": <code>apt update</code> e <code>curl https://exemplo.com</code> falham. Você quer separar, em trinta segundos, se o problema é DNS ou conectividade. Qual par de testes decide isso?' }
        ],
        options: [
          { text: 'Testar o alcance por <strong>IP</strong> e por <strong>nome</strong>: se o IP funciona e o nome não, é DNS (a rede está boa); se nenhum funciona, o problema é anterior — rota, interface ou firewall de saída.', correct: true },
          { text: 'Reiniciar a rede e ver se volta.', why: 'Reiniciar pode até resolver, mas não diz qual das duas coisas estava errada — e destrói a evidência. O método pede um teste que separe as hipóteses primeiro.' },
          { text: 'Rodar <code>ping</code> no nome do site; se falhar, é DNS.', why: 'Um <code>ping</code> no nome mistura as duas coisas: ele resolve o nome <em>e</em> testa a rede. Se falhar, você não sabe qual das duas quebrou. Por isso se testa IP e nome separadamente.' },
          { text: 'Conferir as credenciais de acesso à internet.', why: 'Não há "credencial de internet" nesse cenário; o problema é de resolução de nomes ou de caminho de rede, testável com IP vs nome.' }
        ],
        explain: 'O par decisivo é <code>ping 1.1.1.1</code> (ou <code>curl</code> num IP) contra <code>getent hosts exemplo.com</code> / <code>ping exemplo.com</code>. IP ok + nome falha = DNS: investigue <code>/etc/resolv.conf</code> e a pilha de resolução. Ambos falham = camada de baixo: interface, rota (<code>ip route</code>) ou firewall de saída. O <code>getent hosts</code> é melhor que o <code>dig</code> para isso, porque percorre a mesma pilha que os programas reais, incluindo o <code>/etc/hosts</code>.'
      },
      {
        id: 't17-4-b', kind: 'desafio', title: 'Resolva o chamado #5147',
        body: [
          { p: 'Corrija as duas metades e deixe registrado o diagnóstico.' },
          {
            ul: [
              '<strong>DNS</strong>: a máquina precisa voltar a resolver nomes. O resolvedor da rede desta máquina é <code>10.0.2.3</code>.',
              '<strong>Firewall</strong>: a porta <strong>8080</strong> precisa estar liberada para entrada, mantendo a política padrão de negar e a porta 22 aberta.',
              '<strong>Registro</strong>: <code>~/diagnostico-5147.txt</code> com duas linhas <code>DEFEITO: ...</code>, uma para cada problema.'
            ]
          },
          { p: 'Comprove o DNS resolvendo um nome real depois da correção.' }
        ],
        hints: [
          'O <code>/etc/resolv.conf</code> aponta para um <code>nameserver</code> que não responde. Substitua o endereço e teste com <code>getent hosts ubuntu.com</code>.',
          'Para o firewall, <code>sudo ufw allow 8080/tcp</code> basta — não mexa na política padrão nem remova a regra do SSH.'
        ],
        solution: '<div class="code"><pre>cat /etc/resolv.conf\nping -c 2 185.125.190.21\n\n# defeito 1: nameserver inalcançável\nsudo sed -i \'s/^nameserver .*/nameserver 10.0.2.3/\' /etc/resolv.conf\ngetent hosts ubuntu.com\n\n# defeito 2: porta 8080 bloqueada na entrada\nsudo ufw status verbose\nsudo ufw allow 8080/tcp\nsudo ufw status verbose\n\nprintf \'DEFEITO: /etc/resolv.conf apontava para o nameserver 10.9.9.53, que nao responde — resolucao de nomes em timeout\\nDEFEITO: firewall com politica deny e sem regra para a porta 8080 — conexoes de fora descartadas em silencio\\n\' &gt; ~/diagnostico-5147.txt\ncat ~/diagnostico-5147.txt</pre></div><p style="margin-top:8px">Dois defeitos, duas camadas diferentes, dois testes independentes. O erro que o método evita aqui é tratar os dois sintomas como "a rede caiu" e sair reiniciando serviço de rede — o que não corrigiria nenhum dos dois.</p>',
        check: async (ctx) => {
          const resolv = ler(ctx, '/etc/resolv.conf');
          const ns = (/^\s*nameserver\s+(\S+)/m.exec(resolv) || [])[1];
          const f = ctx.sh.m.firewall || {};
          const regras = (f.rules || []).filter(r => (r.dir || 'in') === 'in');
          const diag = ler(ctx, '/home/aluno/diagnostico-5147.txt');
          const defeitos = diag.split('\n').filter(l => /^DEFEITO:/.test(l.trim()));
          const resolveu = ctx.run ? (await ctx.run('getent hosts ubuntu.com')).out : '';
          return H.checkAll([
            [!!ns, 'O <code>/etc/resolv.conf</code> precisa ter uma linha <code>nameserver</code>.'],
            [() => ns !== '10.9.9.53', 'O <code>nameserver</code> continua sendo o que não responde. Troque pelo resolvedor da rede.'],
            [() => !!resolveu.trim(), 'A máquina ainda não resolve nomes. Teste com <code>getent hosts ubuntu.com</code> depois de corrigir.'],
            [() => f.enabled === true, 'O firewall deve continuar <strong>ativo</strong> — desligá-lo não é correção.'],
            [() => /^(deny|reject)$/i.test(String(f.defaultIn)), 'A política padrão de entrada deve continuar negando.'],
            [() => regras.some(r => String(r.port) === '22'), 'A regra do SSH (porta 22) não pode ser removida.'],
            [() => regras.some(r => String(r.port) === '8080' && /allow|limit/i.test(r.action || 'allow')), 'A porta 8080 ainda não está liberada para entrada.'],
            [() => defeitos.length >= 2, 'Registre os dois achados em <code>~/diagnostico-5147.txt</code>, com linhas começando por <code>DEFEITO:</code>.'],
            [() => /dns|nameserver|resolv/i.test(diag), 'Um dos registros deve descrever o problema de DNS.'],
            [() => /firewall|ufw|8080|porta/i.test(diag), 'O outro registro deve descrever o bloqueio da porta 8080.']
          ]);
        }
      }
    ]
  });
})();
