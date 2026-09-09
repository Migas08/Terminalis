/* =========================================================================
   MÓDULO 8 — Serviços e systemd
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const unidade = (ctx, nome) => (ctx.machine || ctx.sh.m).unit(nome);

  /* ============================== 8.1 ============================== */
  LX.lesson('m08', {
    id: 'l8-1', n: '8.1', title: 'O que o systemd faz',
    goal: 'Entender por que existe um supervisor de serviços e qual é o vocabulário dele — unit, target, estado ativo e habilitado.',
    body: [
      { lede: 'Um serviço não é só um processo rodando. É um processo que precisa subir no boot, reiniciar quando cair, escrever log em algum lugar, esperar a rede estar pronta e ser desligado na ordem certa. Quem cuida disso é o systemd.' },
      { p: 'O <code>systemd</code> é o <strong>PID 1</strong>: o primeiro processo que o kernel inicia e o pai (direto ou adotivo) de todos os outros. Ele substituiu os scripts do SysV init na maioria das distribuições porque resolve, de forma padronizada, problemas que cada script resolvia à sua maneira:' },
      {
        ul: [
          'iniciar serviços <strong>em paralelo</strong>, respeitando dependências reais;',
          'reiniciar automaticamente o que morre;',
          'capturar a saída dos serviços em um log central (o <strong>journal</strong>);',
          'limitar recursos (CPU, memória, arquivos abertos) por serviço;',
          'oferecer o mesmo conjunto de comandos para qualquer serviço.'
        ]
      },
      { code: ['$ ps -p 1 -o pid,comm,args', '$ systemctl --version 2>/dev/null | head -1 || systemctl show -p Version'] },

      { h2: 'Unit: a unidade de trabalho' },
      { p: 'Tudo que o systemd gerencia é uma <strong>unit</strong>, identificada pelo nome e por um sufixo que diz o tipo:' },
      {
        table: {
          head: ['Sufixo', 'O que é', 'Exemplo'],
          rows: [
            ['<code>.service</code>', 'um serviço (o tipo mais comum)', '<code>ssh.service</code>'],
            ['<code>.socket</code>', 'um socket que ativa um serviço sob demanda', '<code>docker.socket</code>'],
            ['<code>.timer</code>', 'agendamento (o substituto moderno do cron)', '<code>apt-daily.timer</code>'],
            ['<code>.mount</code>', 'um ponto de montagem', '<code>srv-dados.mount</code>'],
            ['<code>.target</code>', 'um agrupamento de units (equivale ao "runlevel")', '<code>multi-user.target</code>'],
            ['<code>.path</code>', 'dispara quando um arquivo aparece ou muda', '<code>fila.path</code>']
          ]
        }
      },
      { p: 'Quando você escreve <code>systemctl status ssh</code>, o systemd completa para <code>ssh.service</code>. Só é preciso escrever o sufixo quando há ambiguidade.' },
      { code: ['$ systemctl list-units --type=service | head -10'] },

      { h2: 'Os dois estados que todo mundo confunde' },
      {
        ascii: `ACTIVE   →  está rodando AGORA
              systemctl start / stop     ·   systemctl is-active

ENABLED  →  vai subir no PRÓXIMO BOOT
              systemctl enable / disable ·   systemctl is-enabled

   ┌──────────────┬───────────────────────────────────────────┐
   │ active +     │ situação normal de um serviço em produção  │
   │ enabled      │                                            │
   ├──────────────┼───────────────────────────────────────────┤
   │ active +     │ subiu na mão; some no próximo reboot       │
   │ disabled     │ ← a pegadinha clássica                     │
   ├──────────────┼───────────────────────────────────────────┤
   │ inactive +   │ vai voltar sozinho no reboot                │
   │ enabled      │                                            │
   └──────────────┴───────────────────────────────────────────┘`
      },
      { code: ['$ systemctl is-active ssh', '$ systemctl is-enabled ssh', '$ systemctl list-unit-files | head -6'] },
      {
        box: 'key', body: [
          { p: 'A maior parte dos "funcionou até o servidor reiniciar" é exatamente isto: alguém rodou <code>start</code> e esqueceu do <code>enable</code>. O atalho para os dois de uma vez é <code>systemctl enable --now servico</code>.' }
        ]
      },

      { h2: 'Targets: o que substituiu os runlevels' },
      { p: 'Um <strong>target</strong> agrupa units que devem estar de pé em determinado estado do sistema. É o equivalente moderno dos runlevels do SysV:' },
      {
        table: {
          head: ['Target', 'Equivalente antigo', 'Significa'],
          rows: [
            ['<code>multi-user.target</code>', 'runlevel 3', 'sistema com rede, sem interface gráfica — <strong>o padrão em servidores</strong>'],
            ['<code>graphical.target</code>', 'runlevel 5', 'multi-user + interface gráfica'],
            ['<code>rescue.target</code>', 'runlevel 1', 'modo monousuário para manutenção'],
            ['<code>emergency.target</code>', '—', 'só o shell, sem quase nada montado'],
            ['<code>reboot.target</code>', 'runlevel 6', 'reiniciar']
          ]
        }
      },
      { p: 'Quando um serviço é habilitado com <code>WantedBy=multi-user.target</code>, o systemd cria um link simbólico dentro do diretório <code>multi-user.target.wants</code> — é literalmente assim que o "habilitado" é gravado no disco. Você vai ver esse link acontecendo na aula 8.4.' },
      {
        box: 'old', label: 'Prática antiga × atual', body: [
          { p: 'Comandos como <code>service nginx restart</code>, <code>/etc/init.d/nginx restart</code> e <code>chkconfig</code> ainda funcionam em muitas máquinas — por compatibilidade, eles são redirecionados para o systemd. Mas eles escondem informação (não mostram log, nem estado detalhado, nem falhas de dependência).' },
          { p: 'Use <code>systemctl</code> e <code>journalctl</code>. <strong>Aprenda essa versão</strong>; reconheça a antiga porque ela aparece em documentação e em scripts herdados.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't8-1-a', kind: 'guiado', title: 'Reconheça o terreno',
        body: [
          { p: 'Veja o PID 1, liste os serviços e compare os dois estados.' },
          {
            code: [
              '$ ps -p 1 -o pid,comm,args',
              '$ systemctl list-units --type=service | head -8',
              '$ systemctl is-active ssh && systemctl is-enabled ssh',
              '$ systemctl list-unit-files | head -6',
              '$ systemctl status | head -5'
            ]
          }
        ],
        hints: ['<code>systemctl status</code> sem nome de unit mostra o estado geral da máquina.'],
        solution: '<div class="code"><pre>ps -p 1 -o pid,comm,args\nsystemctl list-units --type=service | head -8\nsystemctl is-active ssh\nsystemctl is-enabled ssh\nsystemctl list-unit-files | head -6\nsystemctl status | head -5</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ps\s+-p\s+1/), 'Confirme quem é o PID 1 com <code>ps -p 1</code>.'],
          [() => H.usedCommand(ctx, /list-units/), 'Liste os serviços com <code>systemctl list-units --type=service</code>.'],
          [() => H.usedCommand(ctx, /is-active/), 'Consulte o estado atual com <code>systemctl is-active</code>.'],
          [() => H.usedCommand(ctx, /is-enabled/), 'Consulte o estado de boot com <code>systemctl is-enabled</code>.']
        ])
      },
      {
        id: 't8-1-q', kind: 'quiz', title: 'Conceito: sumiu depois do reboot',
        body: [
          { p: 'Você instalou e configurou um serviço, rodou <code>sudo systemctl start meuapp</code>, testou e funcionou. Uma semana depois o servidor reinicia por manutenção e o serviço não volta. O que faltou?' }
        ],
        options: [
          { text: '<code>sudo systemctl enable meuapp</code> — o <code>start</code> só vale para a sessão atual do sistema.', correct: true },
          { text: 'Faltou <code>daemon-reload</code> depois do start.', why: 'O <code>daemon-reload</code> recarrega arquivos de unit alterados; não tem relação com iniciar no boot.' },
          { text: 'O serviço travou no boot e por isso não subiu.', why: 'Possível, mas o <code>systemctl status</code> mostraria falha. O caso descrito é o clássico "nunca foi habilitado".' },
          { text: 'É preciso adicionar o comando ao <code>/etc/rc.local</code>.', why: 'Prática antiga e desnecessária: o systemd resolve isso com <code>enable</code>.' }
        ],
        explain: 'O <code>enable</code> cria o link em <code>multi-user.target.wants/</code>, que é o que faz o systemd iniciar a unit no boot. Para os dois de uma vez existe <code>systemctl enable --now meuapp</code>. E, para conferir: <code>systemctl is-enabled meuapp</code>.'
      },
      {
        id: 't8-1-b', kind: 'desafio', title: 'A pegadinha: ativo sem estar habilitado',
        body: [
          { p: 'Reproduza o erro mais comum descrito nesta aula: um serviço rodando agora que vai sumir no próximo boot porque ninguém o habilitou.' },
          { p: 'Deixe o <code>ssh</code> exatamente nesse estado — <strong>ativo</strong>, mas <strong>não habilitado</strong> para o boot — e registre a prova em <code>~/estado-ssh.txt</code>, com estas duas linhas, valores tirados dos próprios comandos:' },
          { code: ['ativo: active', 'boot: disabled'], run: false, mixed: false, lang: 'text' }
        ],
        hints: [
          'Dois verbos diferentes cuidam de "agora" e de "boot" — mas o <code>ssh</code> já está ativo, então você só precisa mexer no do boot.',
          '<code>systemctl disable</code> tira do boot sem tocar no estado atual. Depois leia os dois estados com <code>is-active</code> e <code>is-enabled</code>.'
        ],
        solution: '<div class="code"><pre>sudo systemctl disable ssh\necho "ativo: $(systemctl is-active ssh)" &gt; ~/estado-ssh.txt\necho "boot: $(systemctl is-enabled ssh)" &gt;&gt; ~/estado-ssh.txt\ncat ~/estado-ssh.txt</pre></div><p style="margin-top:8px">É exatamente o cenário do quiz anterior, só que ao contrário: aqui o serviço já nasceu <code>active + enabled</code>, e o <code>disable</code> sozinho — sem <code>stop</code> — produz o estado "ativo agora, ausente no próximo boot".</p>',
        check: async (ctx) => {
          const u = unidade(ctx, 'ssh');
          if (!u) return { ok: false, msg: 'A unit <code>ssh.service</code> não foi encontrada nesta máquina.' };
          const c = H.read(ctx, '/home/aluno/estado-ssh.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/estado-ssh.txt</code> ainda não existe.' };
          const l = c.split('\n').map(x => x.trim()).filter(x => x);
          return LX.H.checkAll([
            [u.state === 'active', 'O <code>ssh</code> deve continuar ativo — não pare o serviço, só tire ele do boot.'],
            [u.enabled === false, 'O <code>ssh</code> ainda está habilitado para o boot — use <code>systemctl disable</code>.'],
            [() => !u.masked, 'A unit está mascarada; o enunciado pede só <code>disable</code>. Desfaça com <code>sudo systemctl unmask ssh</code>.'],
            [l.length === 2, () => `O arquivo deve ter exatamente 2 linhas; tem ${l.length}.`],
            [/^ativo:\s+active$/.test(l[0] || ''), () => `A primeira linha deve ser <code>ativo: active</code>. Obtive: "${l[0] || ''}".`],
            [/^boot:\s+disabled$/.test(l[1] || ''), () => `A segunda linha deve ser <code>boot: disabled</code>. Obtive: "${l[1] || ''}".`]
          ]);
        }
      }
    ]
  });

  /* ============================== 8.2 ============================== */
  LX.lesson('m08', {
    id: 'l8-2', n: '8.2', title: 'systemctl no dia a dia',
    goal: 'Operar serviços com segurança: iniciar, parar, recarregar, inspecionar e entender a diferença entre restart e reload.',
    body: [
      { cmd: 'systemctl' },
      {
        cheat: [
          ['<code>systemctl status X</code>', 'estado, PID, uso de memória e últimas linhas do log'],
          ['<code>systemctl start X</code>', 'inicia agora'],
          ['<code>systemctl stop X</code>', 'para agora'],
          ['<code>systemctl restart X</code>', 'para e inicia (derruba conexões)'],
          ['<code>systemctl reload X</code>', 'relê a configuração <strong>sem derrubar</strong>'],
          ['<code>systemctl reload-or-restart X</code>', 'recarrega se der, senão reinicia'],
          ['<code>systemctl enable X</code>', 'passa a subir no boot'],
          ['<code>systemctl disable X</code>', 'deixa de subir no boot'],
          ['<code>systemctl enable --now X</code>', 'habilita <em>e</em> inicia'],
          ['<code>systemctl mask X</code>', 'proíbe iniciar — nem manualmente, nem por dependência'],
          ['<code>systemctl cat X</code>', 'mostra o arquivo da unit'],
          ['<code>systemctl show X</code>', 'todas as propriedades, formato chave=valor']
        ]
      },
      { p: 'O <code>status</code> é onde se começa qualquer investigação. Leia cada linha:' },
      { code: ['$ systemctl status ssh --no-pager'] },
      {
        ascii: `● ssh.service - OpenBSD Secure Shell server
│    │                    └─ Description= do arquivo da unit
│    └─ nome da unit
└─ ● verde = ativo   ● vermelho = falhou   ○ = parado

  Loaded: loaded (/lib/systemd/system/ssh.service; enabled; preset: enabled)
          │                │                        └─ vai subir no boot?
          │                └─ CAMINHO do arquivo (útil para editar)
          └─ o arquivo foi lido com sucesso

  Active: active (running) since Tue 2026-09-01 15:22:17; 3h ago
          │       │              └─ desde quando (reinícios recentes = suspeita)
          │       └─ sub-estado: running, exited, dead, failed
          └─ estado: active, inactive, failed, activating

Main PID: 640 (sshd)     ← o processo principal; útil para ps, lsof, /proc`
      },

      { h2: 'restart × reload: a diferença que os usuários sentem' },
      {
        table: {
          head: ['', '<code>restart</code>', '<code>reload</code>'],
          rows: [
            ['O processo', 'morre e nasce outro (PID novo)', 'continua o mesmo (PID igual)'],
            ['Conexões abertas', '<strong>caem</strong>', 'preservadas'],
            ['Configuração', 'relida', 'relida'],
            ['Quando usar', 'mudou algo que exige reinício', 'ajuste de configuração em serviço com tráfego'],
            ['Disponível?', 'sempre', 'só se a unit definir <code>ExecReload=</code>']
          ]
        }
      },
      { code: ['$ systemctl show -p MainPID ssh', '$ sudo systemctl reload ssh', '$ systemctl show -p MainPID ssh', '$ sudo systemctl restart ssh', '$ systemctl show -p MainPID ssh'] },
      { p: 'Repare: depois do <code>reload</code> o PID é o mesmo; depois do <code>restart</code>, é outro. Em um servidor web com milhares de conexões, essa diferença é a diferença entre "ninguém percebeu" e "todo mundo tomou erro".' },
      {
        box: 'tip', body: [
          { p: 'Antes de recarregar um serviço, valide a configuração: <code>nginx -t</code>, <code>sshd -t</code>, <code>apachectl configtest</code>. Um <code>reload</code> com configuração inválida pode derrubar o serviço — e aí o restart também falha.' }
        ]
      },

      { h2: 'mask: quando disable não basta' },
      { p: 'Um serviço <code>disabled</code> ainda pode ser iniciado por outro serviço que dependa dele. O <code>mask</code> aponta a unit para <code>/dev/null</code>, tornando-a impossível de iniciar por qualquer caminho.' },
      { code: ['$ sudo systemctl mask cron 2>/dev/null; systemctl is-enabled cron', '$ sudo systemctl start cron 2>&1 | head -2', '$ sudo systemctl unmask cron && systemctl is-enabled cron'] },
      { p: 'Uso típico: garantir que um serviço concorrente (por exemplo, o <code>apache2</code> em uma máquina que vai rodar <code>nginx</code>) não suba de jeito nenhum.' },

      { h2: 'Ver o que está quebrado' },
      { code: ['$ systemctl --failed', '$ systemctl list-units --type=service --all | head -8'] },
      { p: 'O <code>systemctl --failed</code> deveria ser o primeiro comando ao entrar em um servidor com problema: em uma linha, ele mostra tudo que não conseguiu subir.' }
    ],
    tasks: [
      {
        id: 't8-2-a', kind: 'guiado', title: 'Opere um serviço',
        body: [
          { p: 'Pare, inicie, recarregue e observe o PID em cada operação.' },
          {
            code: [
              '$ systemctl status ssh --no-pager | head -6',
              '$ systemctl show -p MainPID ssh',
              '$ sudo systemctl reload ssh && systemctl show -p MainPID ssh',
              '$ sudo systemctl restart ssh && systemctl show -p MainPID ssh',
              '$ sudo systemctl stop ssh && systemctl is-active ssh',
              '$ sudo systemctl start ssh && systemctl is-active ssh',
              '$ systemctl --failed'
            ]
          },
          { p: 'Compare os PIDs: o <code>reload</code> preserva, o <code>restart</code> troca.' }
        ],
        hints: ['<code>systemctl show -p MainPID</code> imprime só a propriedade pedida.'],
        solution: '<div class="code"><pre>systemctl status ssh --no-pager | head -6\nsystemctl show -p MainPID ssh\nsudo systemctl reload ssh\nsystemctl show -p MainPID ssh\nsudo systemctl restart ssh\nsystemctl show -p MainPID ssh\nsudo systemctl stop ssh\nsystemctl is-active ssh\nsudo systemctl start ssh\nsystemctl is-active ssh</pre></div>',
        check: async (ctx) => {
          const u = unidade(ctx, 'ssh');
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /systemctl\s+status\s+ssh/), 'Comece pelo <code>systemctl status ssh</code>.'],
            [() => H.usedCommand(ctx, /show\s+-p\s+MainPID/), 'Compare o PID antes e depois com <code>systemctl show -p MainPID ssh</code>.'],
            [() => H.usedCommand(ctx, /systemctl\s+reload/), 'Experimente o <code>reload</code>.'],
            [() => H.usedCommand(ctx, /systemctl\s+restart/), 'Experimente o <code>restart</code>.'],
            [() => H.usedCommand(ctx, /systemctl\s+stop\s+ssh/), 'Pare o serviço para ver o <code>inactive</code>.'],
            [!!u && u.state === 'active', 'Deixe o <code>ssh</code> ativo ao final — você ainda vai precisar dele.']
          ]);
        }
      },
      {
        id: 't8-2-q', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Um servidor web com 800 conexões ativas precisa passar a aceitar um novo domínio. Você já editou a configuração e validou com <code>nginx -t</code> (saída: <code>syntax is ok</code>). Qual comando causa menos impacto?' }
        ],
        options: [
          { text: '<code>sudo systemctl reload nginx</code> — o processo principal relê a configuração e os trabalhadores antigos terminam suas conexões.', correct: true },
          { text: '<code>sudo systemctl restart nginx</code> — mais garantido, já que reinicia tudo.', why: 'Derruba as 800 conexões. Só é necessário quando o reload não dá conta (mudança de usuário, de limites, do binário).' },
          { text: '<code>sudo systemctl stop nginx</code> e depois <code>start</code>.', why: 'É o restart em duas etapas, com uma janela de indisponibilidade ainda maior.' },
          { text: '<code>sudo kill -9 $(pidof nginx)</code> e deixar o systemd reiniciar.', why: 'Encerramento abrupto, conexões cortadas e possível estado inconsistente — o pior dos quatro.' }
        ],
        explain: 'Nem toda mudança pode ser aplicada com <code>reload</code>: alterações em <code>User=</code>, <code>LimitNOFILE=</code> ou em portas privilegiadas costumam exigir <code>restart</code>. A regra é: valide a configuração, tente o <code>reload</code>, e reserve o <code>restart</code> para uma janela de manutenção.'
      },
      {
        id: 't8-2-b', kind: 'desafio', title: 'Deixe o cron do jeito pedido',
        body: [
          { p: 'A política desta máquina mudou: o serviço <code>cron</code> deve ficar <strong>parado agora e não pode subir no próximo boot</strong> — mas sem ser mascarado, porque a equipe pretende reativá-lo no mês que vem.' },
          { p: 'Depois de ajustar, grave em <code>~/estado-cron.txt</code> duas linhas exatamente neste formato, com os valores lidos do sistema:' },
          {
            code: [
              'ativo: inactive',
              'boot: disabled'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Os valores devem vir dos próprios comandos do systemd, não digitados à mão.' }
        ],
        hints: [
          'São dois verbos diferentes: um para "agora" e outro para "no boot".',
          '<code>systemctl is-active</code> e <code>systemctl is-enabled</code> imprimem exatamente as palavras que o arquivo espera.',
          '<code>sudo systemctl disable --now cron</code>; depois <code>echo "ativo: $(systemctl is-active cron)" &gt; ~/estado-cron.txt</code> e a linha do <code>is-enabled</code> com <code>&gt;&gt;</code>.'
        ],
        solution: '<div class="code"><pre>sudo systemctl disable --now cron\necho "ativo: $(systemctl is-active cron)" &gt; ~/estado-cron.txt\necho "boot: $(systemctl is-enabled cron)" &gt;&gt; ~/estado-cron.txt\ncat ~/estado-cron.txt</pre></div><p style="margin-top:8px">O <code>--now</code> aplica a ação também ao estado atual: <code>disable --now</code> é <code>disable</code> + <code>stop</code>, e <code>enable --now</code> é <code>enable</code> + <code>start</code>.</p>',
        check: async (ctx) => {
          const u = unidade(ctx, 'cron');
          if (!u) return { ok: false, msg: 'A unit <code>cron.service</code> não foi encontrada nesta máquina.' };
          const c = H.read(ctx, '/home/aluno/estado-cron.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/estado-cron.txt</code> ainda não existe.' };
          const l = c.split('\n').map(x => x.trim()).filter(x => x);
          return LX.H.checkAll([
            [u.state !== 'active', 'O <code>cron</code> ainda está ativo — pare o serviço.'],
            [u.enabled === false, 'O <code>cron</code> ainda está habilitado para o boot — use <code>systemctl disable</code>.'],
            /* estado da unit, não histórico: quem rodou o exemplo de mask
               desta mesma aula tem de conseguir passar depois do unmask */
            [() => !u.masked, 'A unit está <strong>mascarada</strong>. O enunciado pede desligar sem mascarar: desfaça com <code>sudo systemctl unmask cron</code> e use apenas <code>disable</code>.'],
            [l.length === 2, () => `O arquivo deve ter exatamente 2 linhas; tem ${l.length}.`],
            [/^ativo:\s+inactive$/.test(l[0] || ''), () => `A primeira linha deve ser <code>ativo: inactive</code>. Obtive: "${l[0] || ''}".`],
            [/^boot:\s+disabled$/.test(l[1] || ''), () => `A segunda linha deve ser <code>boot: disabled</code>. Obtive: "${l[1] || ''}".`]
          ]);
        }
      }
    ]
  });

  /* ============================== 8.3 ============================== */
  LX.lesson('m08', {
    id: 'l8-3', n: '8.3', title: 'journalctl: o log de tudo',
    goal: 'Encontrar rapidamente a mensagem que explica a falha, filtrando por unit, prioridade, tempo e conteúdo.',
    body: [
      { p: 'Serviços gerenciados pelo systemd têm a saída capturada pelo <strong>journald</strong>. Em vez de procurar em qual arquivo de <code>/var/log</code> cada programa resolveu escrever, você consulta um único lugar — com filtros.' },
      { cmd: 'journalctl' },
      {
        cheat: [
          ['<code>journalctl -u ssh</code>', 'só de um serviço'],
          ['<code>journalctl -u ssh -n 20</code>', 'as últimas 20 linhas'],
          ['<code>journalctl -u ssh -f</code>', 'acompanha em tempo real (como <code>tail -f</code>)'],
          ['<code>journalctl -xeu ssh</code>', '<strong>o comando da investigação</strong>: fim do log, com explicações'],
          ['<code>journalctl -p err</code>', 'só erros (prioridade err ou pior)'],
          ['<code>journalctl -b</code>', 'apenas o boot atual'],
          ['<code>journalctl -k</code>', 'mensagens do kernel (o <code>dmesg</code>)'],
          ['<code>journalctl --since "10 min ago"</code>', 'janela de tempo'],
          ['<code>journalctl --grep "erro"</code>', 'filtra por conteúdo'],
          ['<code>journalctl --no-pager</code>', 'sem paginador — para scripts e pipes']
        ]
      },
      { code: ['$ journalctl -n 8 --no-pager', '$ journalctl -u ssh -n 5 --no-pager', '$ journalctl -b --no-pager | head -8'] },

      { h2: 'Prioridades' },
      {
        table: {
          head: ['Nº', 'Nome', 'Quando aparece'],
          rows: [
            ['0', '<code>emerg</code>', 'sistema inutilizável'],
            ['1', '<code>alert</code>', 'ação imediata necessária'],
            ['2', '<code>crit</code>', 'condição crítica'],
            ['3', '<code>err</code>', '<strong>erro</strong> — o filtro que você mais vai usar'],
            ['4', '<code>warning</code>', 'aviso'],
            ['5', '<code>notice</code>', 'evento normal, porém significativo'],
            ['6', '<code>info</code>', 'informativo — o padrão'],
            ['7', '<code>debug</code>', 'depuração']
          ]
        }
      },
      { p: 'O filtro é acumulativo para baixo: <code>-p err</code> traz <code>err</code>, <code>crit</code>, <code>alert</code> e <code>emerg</code>.' },
      { code: ['$ journalctl -p err -n 10 --no-pager', '$ journalctl -p warning --since "1 hour ago" --no-pager | tail -5'] },

      { h2: 'Combinando filtros' },
      { p: 'É aqui que o journal ganha do <code>grep</code> em arquivos: os filtros se somam.' },
      {
        code: [
          '$ journalctl -u ssh -p err --no-pager | tail -5',
          '$ journalctl -u ssh --since "2 hours ago" --no-pager | tail -5',
          '$ journalctl --grep "Started" -n 5 --no-pager'
        ]
      },
      {
        box: 'tip', label: 'A sequência de investigação', body: [
          { ol: [
            '<code>systemctl --failed</code> — o que está quebrado?',
            '<code>systemctl status X</code> — o resumo e as últimas linhas;',
            '<code>journalctl -xeu X</code> — o log completo daquele serviço, com contexto;',
            '<code>journalctl -u X --since "10 min ago"</code> — o que aconteceu na janela do incidente.'
          ] }
        ]
      },

      { h2: 'Persistência: o log que some no reboot' },
      { p: 'Por padrão, em algumas instalações o journal fica em <code>/run/log/journal</code> — memória volátil — e desaparece ao reiniciar. Para investigar um problema que derrubou a máquina, isso é fatal.' },
      { code: ['$ ls -ld /var/log/journal 2>/dev/null || echo "journal volátil"', '$ df -h /var/log 2>/dev/null | tail -1'] },
      { p: 'A configuração fica em <code>/etc/systemd/journald.conf</code>: <code>Storage=persistent</code> grava em <code>/var/log/journal</code>, e <code>SystemMaxUse=500M</code> limita o tamanho. Depois de alterar, <code>sudo systemctl restart systemd-journald</code>.' },
      {
        box: 'note', body: [
          { p: 'Muitos serviços ainda escrevem também em arquivos de <code>/var/log</code> (o <code>/var/log/auth.log</code> do módulo 5, por exemplo). Não é contradição: o journal captura a saída padrão do serviço, enquanto o rsyslog copia parte dessas mensagens para arquivos, por compatibilidade. Saber ler os dois é o que resolve.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't8-3-a', kind: 'guiado', title: 'Navegue pelo journal',
        body: [
          { p: 'Filtre por unit, por tempo, por prioridade e por conteúdo.' },
          {
            code: [
              '$ journalctl -n 8 --no-pager',
              '$ journalctl -u ssh -n 5 --no-pager',
              '$ journalctl -b --no-pager | head -6',
              '$ journalctl --grep "Started" -n 5 --no-pager',
              '$ journalctl -p err -n 5 --no-pager'
            ]
          },
          { p: 'A última linha pode não trazer nada: uma máquina saudável não tem erros no journal.' }
        ],
        hints: ['O <code>--no-pager</code> evita que a saída abra em modo paginado, o que atrapalha em pipes.'],
        solution: '<div class="code"><pre>journalctl -n 8 --no-pager\njournalctl -u ssh -n 5 --no-pager\njournalctl -b --no-pager | head -6\njournalctl --grep "Started" -n 5 --no-pager\njournalctl -p err -n 5 --no-pager</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /journalctl\s+.*-u\s+ssh/), 'Filtre por unit com <code>journalctl -u ssh</code>.'],
          [() => H.usedCommand(ctx, /journalctl\s+.*-p\s+err/), 'Filtre por prioridade com <code>journalctl -p err</code>.'],
          [() => H.usedCommand(ctx, /--grep/), 'Filtre por conteúdo com <code>--grep</code>.'],
          [() => H.usedCommand(ctx, /journalctl\s+.*-b/), 'Veja o boot atual com <code>journalctl -b</code>.']
        ])
      },
      {
        id: 't8-3-q', kind: 'quiz', title: 'Monte o comando certo',
        body: [
          { p: 'Você quer ver, do serviço <code>nginx</code>, apenas o que for <strong>erro ou pior</strong>, dos últimos 10 minutos, sem que a saída pare esperando você apertar espaço (o script que vai rodar isso não tem terminal interativo). Qual comando faz exatamente isso?' }
        ],
        options: [
          { text: '<code>journalctl -u nginx -p err --since "10 min ago" --no-pager</code>', correct: true },
          { text: '<code>journalctl -u nginx -p warning --since "10 min ago" --no-pager</code>', why: 'O filtro é acumulativo para baixo: <code>-p warning</code> traz também <code>warning</code>, <code>notice</code> e <code>info</code> — mais barulho do que "erro ou pior".' },
          { text: '<code>journalctl -u nginx -p err --since "10 min ago"</code>', why: 'Sem <code>--no-pager</code> a saída abre paginada; em um script sem terminal interativo isso trava esperando uma entrada que nunca vem.' },
          { text: '<code>journalctl -p err --since "10 min ago" --no-pager</code>', why: 'Sem <code>-u nginx</code> o filtro traz erros da máquina inteira, não só do serviço que interessa.' }
        ],
        explain: 'Os filtros do <code>journalctl</code> se somam: unit, prioridade e janela de tempo, cada um restringindo mais a busca. E <code>--no-pager</code> é obrigatório sempre que a saída for para um script ou um pipe.'
      },
      {
        id: 't8-3-b', kind: 'desafio', title: 'Extraia a linha da largada',
        body: [
          { p: 'Grave em <code>~/log-ssh.txt</code> <strong>somente</strong> as linhas do journal que se referem ao serviço <code>ssh</code> e contêm a palavra <code>listening</code> (a mensagem em que o servidor anuncia a porta em que começou a escutar).' },
          { p: 'O arquivo deve conter pelo menos uma linha, nenhuma linha de outro serviço, e não pode ter a linha de cabeçalho <code>-- Journal begins at ... --</code>.' }
        ],
        hints: [
          'Dois filtros se combinam: um por unit e outro por conteúdo.',
          'O <code>--grep</code> é insensível a maiúsculas por padrão nesse ambiente; o <code>--no-pager</code> evita paginação.',
          '<code>journalctl -u ssh --grep listening --no-pager | grep -v "^-- " &gt; ~/log-ssh.txt</code>'
        ],
        solution: '<div class="code"><pre>journalctl -u ssh --grep listening --no-pager | grep -v "^-- " &gt; ~/log-ssh.txt\ncat ~/log-ssh.txt</pre></div><p style="margin-top:8px">A linha "Server listening on 0.0.0.0 port 22" é a prova de que o serviço realmente abriu a porta — diferente de "Started", que apenas diz que o systemd conseguiu executá-lo.</p>',
        forja: ["echo 'jan 01 09:15:22 srv-aula sshd[640]: Server listening on 0.0.0.0 port 2200.' > ~/log-ssh.txt"],
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/log-ssh.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/log-ssh.txt</code> ainda não existe.' };
          const m = ctx.machine || ctx.sh.m;
          const linhas = c.split('\n').filter(l => l.trim());
          /* cada linha do arquivo tem de existir mesmo no journal desta máquina */
          const doJournal = (m.journal || []).filter(e => /listening/i.test(e.msg || ''))
            .map(e => String(e.msg).trim());
          const bate = (l) => doJournal.some(j => l.includes(j) || j.includes(l.trim()));
          return LX.H.checkAll([
            [linhas.length >= 1, 'O arquivo está vazio — confira os filtros do <code>journalctl</code>.'],
            [!linhas.some(l => /^-- /.test(l)), 'O cabeçalho <code>-- Journal begins at ... --</code> não deve entrar no arquivo.'],
            [linhas.every(l => /listening/i.test(l)), 'Todas as linhas devem conter a palavra <code>listening</code>.'],
            [linhas.every(l => /ssh/i.test(l)), 'Alguma linha não é do serviço <code>ssh</code> — filtre com <code>-u ssh</code>.'],
            [() => doJournal.length > 0 && linhas.every(bate), 'Alguma linha do arquivo não existe no journal desta máquina. Ela precisa ser redirecionada do <code>journalctl</code>, não digitada.']
          ]);
        }
      }
    ]
  });

  /* ============================== 8.4 ============================== */
  LX.lesson('m08', {
    id: 'l8-4', n: '8.4', title: 'Escrever a sua própria unit',
    goal: 'Transformar um script em um serviço de verdade: com reinício automático, log no journal e início no boot.',
    body: [
      { lede: 'Este é o momento em que você deixa de operar serviços dos outros e passa a criar os seus.' },
      { p: 'Um arquivo de unit é um INI com três seções. O mínimo que funciona:' },
      {
        code: [
          '[Unit]',
          'Description=Minha aplicação',
          'After=network.target',
          '',
          '[Service]',
          'Type=simple',
          'ExecStart=/opt/minhaapp/run.sh',
          'Restart=always',
          '',
          '[Install]',
          'WantedBy=multi-user.target'
        ], run: false, lang: 'ini'
      },
      {
        table: {
          head: ['Seção', 'Responde'],
          rows: [
            ['<code>[Unit]</code>', 'o que é e de quem depende (<code>Description</code>, <code>After</code>, <code>Requires</code>)'],
            ['<code>[Service]</code>', 'como executar (<code>ExecStart</code>, <code>User</code>, <code>Restart</code>, <code>Environment</code>)'],
            ['<code>[Install]</code>', 'o que acontece no <code>enable</code> (<code>WantedBy</code>)']
          ]
        }
      },

      { h2: 'As diretivas que importam' },
      {
        table: {
          head: ['Diretiva', 'Efeito', 'Cuidado'],
          rows: [
            ['<code>ExecStart=</code>', 'o comando principal', '<strong>caminho absoluto obrigatório</strong>; não é shell (sem <code>|</code>, <code>&gt;</code>, <code>*</code>)'],
            ['<code>Type=simple</code>', 'o processo do ExecStart <em>é</em> o serviço', 'padrão; o programa não pode ir para segundo plano'],
            ['<code>Type=forking</code>', 'o programa se duplica e o pai sai', 'exige <code>PIDFile=</code>; evite quando houver opção'],
            ['<code>Type=oneshot</code>', 'roda, termina, e a unit fica "active (exited)"', 'ideal para tarefas de manutenção com timer'],
            ['<code>Restart=</code>', '<code>no</code>, <code>on-failure</code>, <code>always</code>', '<code>always</code> + programa que sai sozinho = loop de reinício'],
            ['<code>RestartSec=</code>', 'espera antes de reiniciar', 'evita martelar a máquina em um loop'],
            ['<code>User=</code> / <code>Group=</code>', 'identidade do serviço', '<strong>nunca root</strong> sem necessidade real'],
            ['<code>WorkingDirectory=</code>', 'diretório inicial', 'precisa existir, senão <code>200/CHDIR</code>'],
            ['<code>Environment=</code>', 'variáveis de ambiente', 'use <code>EnvironmentFile=</code> para segredos'],
            ['<code>ExecReload=</code>', 'o que <code>systemctl reload</code> faz', 'sem ela, não existe reload']
          ]
        }
      },
      {
        box: 'key', label: 'ExecStart não é um shell', body: [
          { p: 'O systemd executa o comando diretamente, sem passar por um shell. Isso significa que <code>ExecStart=/usr/bin/app &gt; /var/log/app.log</code> <strong>não redireciona nada</strong> — o <code>&gt;</code> vira um argumento do programa. Coringas (<code>*</code>), pipes e <code>$VARIAVEL</code> também não funcionam.' },
          { p: 'Quando você precisar mesmo de shell: <code>ExecStart=/bin/bash -c \'comando | outro &gt; arquivo\'</code>. Mas, quase sempre, a resposta certa é deixar o serviço escrever na saída padrão e o journal cuidar do resto.' }
        ]
      },

      { h2: 'O ciclo completo' },
      { p: 'Vamos criar um serviço de verdade agora. Primeiro o programa:' },
      {
        code: [
          '$ sudo mkdir -p /opt/relogio',
          '$ printf \'#!/bin/bash\\nwhile true; do echo "tick $(date +%%T)"; sleep 60; done\\n\' | sudo tee /opt/relogio/run.sh > /dev/null',
          '$ sudo chmod +x /opt/relogio/run.sh',
          '$ ls -l /opt/relogio/run.sh'
        ]
      },
      { p: 'Agora o arquivo da unit, em <code>/etc/systemd/system/</code> — é lá que ficam as units criadas por você (as do sistema ficam em <code>/lib/systemd/system/</code> e não devem ser editadas diretamente):' },
      {
        code: [
          '$ sudo tee /etc/systemd/system/relogio.service > /dev/null << \'EOF\'',
          '[Unit]',
          'Description=Relogio de exemplo',
          'After=network.target',
          '',
          '[Service]',
          'Type=simple',
          'ExecStart=/opt/relogio/run.sh',
          'Restart=always',
          'RestartSec=3',
          '',
          '[Install]',
          'WantedBy=multi-user.target',
          'EOF',
          '$ cat /etc/systemd/system/relogio.service'
        ]
      },
      { p: 'E o ritual de três passos que todo mundo esquece pelo menos uma vez:' },
      {
        code: [
          '$ sudo systemctl daemon-reload',
          '$ sudo systemctl enable --now relogio',
          '$ systemctl status relogio --no-pager | head -6'
        ]
      },
      {
        box: 'warn', label: 'daemon-reload: o passo esquecido', body: [
          { p: 'O systemd mantém as units em memória. Depois de <strong>criar ou editar</strong> qualquer arquivo <code>.service</code>, é obrigatório rodar <code>sudo systemctl daemon-reload</code> — caso contrário ele continua usando a versão antiga, e você fica "consertando" um arquivo que não está sendo lido.' }
        ]
      },
      { p: 'Confirme que o link de habilitação foi criado — é assim que o "enabled" existe no disco:' },
      { code: ['$ ls -l /etc/systemd/system/multi-user.target.wants/ | grep relogio', '$ systemctl is-enabled relogio'] },
      {
        box: 'tip', body: [
          { p: 'Para editar uma unit do sistema sem tocar no arquivo original, o caminho certo é o <strong>drop-in</strong>: um arquivo em <code>/etc/systemd/system/nome.service.d/override.conf</code> com apenas as diretivas que você quer mudar. Assim, uma atualização do pacote não sobrescreve sua alteração. O comando <code>systemctl edit nome</code> cria esse arquivo para você.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't8-4-a', kind: 'guiado', title: 'Crie o seu primeiro serviço',
        body: [
          { p: 'Programa, unit, daemon-reload, enable — o ciclo inteiro.' },
          {
            code: [
              '$ sudo mkdir -p /opt/relogio',
              '$ printf \'#!/bin/bash\\nwhile true; do echo tick; sleep 60; done\\n\' | sudo tee /opt/relogio/run.sh > /dev/null',
              '$ sudo chmod +x /opt/relogio/run.sh'
            ]
          },
          {
            code: [
              '$ sudo tee /etc/systemd/system/relogio.service > /dev/null << \'EOF\'',
              '[Unit]',
              'Description=Relogio de exemplo',
              'After=network.target',
              '',
              '[Service]',
              'Type=simple',
              'ExecStart=/opt/relogio/run.sh',
              'Restart=always',
              'RestartSec=3',
              '',
              '[Install]',
              'WantedBy=multi-user.target',
              'EOF'
            ]
          },
          {
            code: [
              '$ sudo systemctl daemon-reload',
              '$ sudo systemctl enable --now relogio',
              '$ systemctl status relogio --no-pager | head -6',
              '$ systemctl is-active relogio && systemctl is-enabled relogio'
            ]
          }
        ],
        hints: ['O <code>tee</code> com <code>sudo</code> é a forma de escrever em um diretório do root usando redirecionamento — <code>sudo echo x &gt; arquivo</code> não funciona, porque quem redireciona é o seu shell.'],
        solution: '<div class="code"><pre>sudo mkdir -p /opt/relogio\nprintf \'#!/bin/bash\\nwhile true; do echo tick; sleep 60; done\\n\' | sudo tee /opt/relogio/run.sh &gt; /dev/null\nsudo chmod +x /opt/relogio/run.sh\nsudo tee /etc/systemd/system/relogio.service &gt; /dev/null &lt;&lt; \'EOF\'\n[Unit]\nDescription=Relogio de exemplo\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=/opt/relogio/run.sh\nRestart=always\nRestartSec=3\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsudo systemctl daemon-reload\nsudo systemctl enable --now relogio\nsystemctl status relogio --no-pager | head -6</pre></div>',
        check: async (ctx) => {
          const u = unidade(ctx, 'relogio');
          return LX.H.checkAll([
            [H.exists(ctx, '/opt/relogio/run.sh'), 'Crie o programa <code>/opt/relogio/run.sh</code>.'],
            [(H.mode(ctx, '/opt/relogio/run.sh') & 0o111) !== 0, 'O script precisa ser executável (<code>chmod +x</code>).'],
            [H.exists(ctx, '/etc/systemd/system/relogio.service'), 'Crie o arquivo <code>/etc/systemd/system/relogio.service</code>.'],
            [!!u, 'A unit não foi carregada — rodou <code>sudo systemctl daemon-reload</code>?'],
            [() => !!u && u.state === 'active', () => `O serviço deveria estar ativo; está <code>${u ? u.state : '—'}</code>. Veja <code>systemctl status relogio</code>.`],
            [() => !!u && u.enabled === true, 'O serviço ainda não está habilitado para o boot (<code>systemctl enable relogio</code>).']
          ]);
        }
      },
      {
        id: 't8-4-q', kind: 'quiz', title: 'Encontre o erro na unit',
        body: [
          { p: 'Um colega escreveu esta unit e o serviço falha com <code>status=203/EXEC</code>:' },
          {
            code: [
              '[Unit]',
              'Description=Coletor',
              '',
              '[Service]',
              'ExecStart=coletor.py --intervalo 30 > /var/log/coletor.log',
              'Restart=always',
              '',
              '[Install]',
              'WantedBy=multi-user.target'
            ], run: false, lang: 'ini'
          },
          { p: 'Qual é o problema <strong>principal</strong>?' }
        ],
        options: [
          { text: 'O <code>ExecStart</code> precisa de caminho absoluto e não aceita redirecionamento — não há shell interpretando a linha.', correct: true },
          { text: 'Falta <code>Type=simple</code> na seção <code>[Service]</code>.', why: '<code>simple</code> é o padrão quando <code>Type</code> é omitido; não é o que causa o 203/EXEC.' },
          { text: 'Falta <code>After=network.target</code>.', why: 'Isso afeta a ordem de inicialização, não a execução do binário.' },
          { text: 'O nome do arquivo deveria terminar em <code>.unit</code>.', why: 'O sufixo correto é <code>.service</code>; <code>.unit</code> não existe.' }
        ],
        explain: 'O <code>203/EXEC</code> significa "não consegui executar o programa". Aqui há dois motivos somados: caminho relativo e um <code>&gt;</code> que virou argumento. A correção: <code>ExecStart=/usr/bin/python3 /opt/coletor/coletor.py --intervalo 30</code>, deixando a saída ir para o journal (<code>journalctl -u coletor</code>). Se o redirecionamento fosse mesmo necessário, seria <code>ExecStart=/bin/bash -c \'...\'</code>.'
      },
      {
        id: 't8-4-b', kind: 'desafio', title: 'Serviço com usuário próprio',
        body: [
          { p: 'Transforme um script em serviço seguindo as boas práticas de produção.' },
          { p: 'Prepare o programa:' },
          {
            code: [
              '$ sudo mkdir -p /opt/coletor',
              '$ printf \'#!/bin/bash\\nwhile true; do echo "coletando"; sleep 30; done\\n\' | sudo tee /opt/coletor/coletor.sh > /dev/null',
              '$ sudo chmod +x /opt/coletor/coletor.sh'
            ]
          },
          { p: 'Agora crie o serviço <code>coletor.service</code> atendendo a <strong>todos</strong> estes requisitos:' },
          {
            ul: [
              'descrição <code>Coletor de metricas</code>;',
              'roda como o usuário <strong><code>coletor</code></strong> — uma conta de sistema, sem shell de login, que você também precisa criar;',
              'inicia depois da rede (<code>After=network.target</code>);',
              'reinicia sozinho <strong>sempre</strong> que sair, esperando 5 segundos entre as tentativas;',
              'diretório de trabalho <code>/opt/coletor</code>;',
              'está <strong>ativo agora</strong> e <strong>habilitado</strong> para o boot.'
            ]
          },
          { p: 'Lembre que o script precisa ser executável pelo usuário do serviço.' }
        ],
        hints: [
          'Comece pela conta: <code>sudo useradd -r -s /usr/sbin/nologin coletor</code>. Sem ela, a unit falha com <code>217/USER</code>.',
          'As diretivas pedidas são <code>User=</code>, <code>After=</code>, <code>Restart=always</code>, <code>RestartSec=5</code> e <code>WorkingDirectory=</code>.',
          'Depois de escrever o arquivo: <code>sudo systemctl daemon-reload</code> e <code>sudo systemctl enable --now coletor</code>.'
        ],
        solution: '<div class="code"><pre>sudo useradd -r -s /usr/sbin/nologin coletor\n\nsudo tee /etc/systemd/system/coletor.service &gt; /dev/null &lt;&lt; \'EOF\'\n[Unit]\nDescription=Coletor de metricas\nAfter=network.target\n\n[Service]\nType=simple\nUser=coletor\nWorkingDirectory=/opt/coletor\nExecStart=/opt/coletor/coletor.sh\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\nEOF\n\nsudo systemctl daemon-reload\nsudo systemctl enable --now coletor\nsystemctl status coletor --no-pager | head -6\njournalctl -u coletor -n 5 --no-pager</pre></div><p style="margin-top:8px">Esse arquivo é o esqueleto de praticamente qualquer serviço de aplicação: usuário próprio sem privilégio, diretório de trabalho definido, reinício automático com intervalo e log indo para o journal.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const u = unidade(ctx, 'coletor');
          const conta = m.userByName('coletor');
          if (!H.exists(ctx, '/etc/systemd/system/coletor.service')) return { ok: false, msg: 'O arquivo <code>/etc/systemd/system/coletor.service</code> ainda não existe.' };
          if (!u) return { ok: false, msg: 'A unit não foi carregada — rode <code>sudo systemctl daemon-reload</code>.' };
          return LX.H.checkAll([
            [!!conta, 'A conta de sistema <code>coletor</code> ainda não existe (<code>useradd -r -s /usr/sbin/nologin coletor</code>).'],
            [!!conta && conta.uid < 1000, `A conta <code>coletor</code> deve ser de sistema (UID &lt; 1000); tem ${conta ? conta.uid : '?'}.`],
            [!!conta && /nologin|false/.test(conta.shell), 'A conta de serviço não pode ter shell de login.'],
            [/Coletor de metricas/i.test(u.description), `A descrição deve ser <code>Coletor de metricas</code>; está "${u.description}".`],
            [u.user === 'coletor', `O serviço deve rodar como <code>coletor</code>; está como <code>${u.user}</code>.`],
            [(u.after || []).some(a => /network/.test(a)), 'Falta <code>After=network.target</code> na seção <code>[Unit]</code>.'],
            [u.restart === 'always', `A política de reinício deve ser <code>always</code>; está <code>${u.restart}</code>.`],
            [u.restartSec === 5, `O <code>RestartSec</code> deve ser 5; está ${u.restartSec}.`],
            [u.workingDirectory === '/opt/coletor', `O <code>WorkingDirectory</code> deve ser <code>/opt/coletor</code>; está "${u.workingDirectory || '(vazio)'}".`],
            [u.state === 'active', `O serviço deveria estar ativo; está <code>${u.state}</code>${u.lastError ? ' — ' + u.lastError : ''}.`],
            [u.enabled === true, 'O serviço ainda não está habilitado para o boot.']
          ]);
        }
      }
    ]
  });

  /* ============================== 8.5 ============================== */
  LX.lesson('m08', {
    id: 'l8-5', n: '8.5', title: 'Quando o serviço não sobe',
    goal: 'Traduzir os códigos de falha do systemd em causa concreta e corrigir sem tentativa e erro.',
    body: [
      { lede: 'O systemd quase sempre já te disse o que houve. O problema é que a mensagem está em duas linhas do journal, entre trinta.' },
      { h2: 'O método' },
      {
        ol: [
          '<code>systemctl status NOME</code> — leia a linha <code>Active:</code> e o <code>Process:</code>;',
          '<code>journalctl -xeu NOME</code> — as últimas linhas daquela unit, com contexto;',
          'traduza o <strong>código de saída</strong> (a tabela abaixo);',
          'reproduza o <code>ExecStart</code> à mão, com o usuário do serviço: <code>sudo -u USUARIO /caminho/do/comando</code>;',
          'corrija, <code>daemon-reload</code> se mexeu no arquivo, e <code>start</code> de novo.'
        ]
      },
      {
        table: {
          head: ['Código', 'Significa', 'Causa típica'],
          rows: [
            ['<code>203/EXEC</code>', 'não conseguiu executar', 'caminho errado, falta <code>chmod +x</code>, shebang inválido, caminho relativo'],
            ['<code>200/CHDIR</code>', 'não conseguiu entrar no diretório', '<code>WorkingDirectory=</code> não existe'],
            ['<code>217/USER</code>', 'usuário inexistente', '<code>User=</code> aponta para conta que ninguém criou'],
            ['<code>226/NAMESPACE</code>', 'falha de isolamento', 'diretiva de sandbox (<code>ProtectHome</code>, <code>ReadOnlyPaths</code>) impossível'],
            ['<code>status=1</code>', 'o programa rodou e saiu com erro', 'erro da aplicação — leia o log <em>dela</em>'],
            ['<code>signal=SEGV</code>', 'estourou', 'bug ou biblioteca incompatível'],
            ['<code>Address already in use</code>', 'porta ocupada', 'outro processo já escuta naquela porta']
          ]
        }
      },
      { p: 'Veja um caso completo. Primeiro, a unit quebrada:' },
      {
        code: [
          '$ sudo tee /etc/systemd/system/quebrado.service > /dev/null << \'EOF\'',
          '[Unit]',
          'Description=Servico com defeito',
          '',
          '[Service]',
          'ExecStart=/opt/naoexiste/programa.sh',
          '',
          '[Install]',
          'WantedBy=multi-user.target',
          'EOF',
          '$ sudo systemctl daemon-reload',
          '$ sudo systemctl start quebrado',
          '$ systemctl status quebrado --no-pager | head -6',
          '$ journalctl -xeu quebrado --no-pager | tail -5'
        ]
      },
      { p: 'A linha <code>Failed at step EXEC spawning /opt/naoexiste/programa.sh: No such file or directory</code> é o diagnóstico inteiro. Não há o que adivinhar.' },

      { h2: 'Os três erros que respondem por quase tudo' },
      {
        table: {
          head: ['Sintoma', 'Verificação', 'Correção'],
          rows: [
            ['a unit "não existe"', '<code>systemctl status nome</code> diz <em>could not be found</em>', 'faltou <code>daemon-reload</code>, ou o arquivo está no diretório errado'],
            ['editei e nada mudou', 'o comportamento é o antigo', '<code>daemon-reload</code> — o systemd usa a versão em memória'],
            ['funciona na mão, falha como serviço', 'roda no seu shell, quebra na unit', 'ambiente: <code>PATH</code>, variáveis, <code>WorkingDirectory</code>, e o <code>User=</code> diferente do seu']
          ]
        }
      },
      {
        box: 'key', label: 'Por que "funciona no meu shell"', body: [
          { p: 'Seu shell tem <code>PATH</code> completo, variáveis do <code>.bashrc</code>, o seu usuário e o seu diretório atual. O serviço não tem <strong>nada disso</strong>: <code>PATH</code> mínimo, ambiente vazio, outro usuário, outro diretório.' },
          { p: 'O teste que elimina a dúvida em um comando:' },
          { code: ['$ sudo -u USUARIO env -i /caminho/absoluto/do/programa'], run: false },
          { p: 'Se falhar aí, você reproduziu a condição do serviço.' }
        ]
      },

      { h2: 'Loop de reinício' },
      { p: 'Um serviço com <code>Restart=always</code> que sai imediatamente entra em ciclo. O systemd protege a máquina com um limite: por padrão, 5 tentativas em 10 segundos e a unit vai para <code>failed</code> com a mensagem <em>start request repeated too quickly</em>.' },
      { code: ['$ systemctl show -p NRestarts relogio 2>/dev/null || echo "sem a unit relogio aqui"'] },
      { p: 'Nesse caso, o <code>RestartSec=</code> maior ajuda a investigar (dá tempo de ler o log), mas a correção real é descobrir por que o programa termina — quase sempre o próprio log da aplicação responde.' },
      {
        box: 'tip', body: [
          { p: 'Depois de corrigir uma unit que entrou em <code>failed</code>, o contador de falhas continua lá e pode bloquear novos <code>start</code>. Limpe com <code>sudo systemctl reset-failed NOME</code> antes de tentar de novo.' }
        ]
      }
    ],
    setup: (m) => {
      const ctx = m.ctxRoot();
      const fs = m.fs;
      try { fs.rmrf('/etc/systemd/system/inventario.service', { ctx }); } catch (e) { }
      fs.mkdirp('/opt/inventario', { ctx });
      const s = fs.writeFile('/opt/inventario/inventario.sh',
        '#!/bin/bash\nwhile true; do echo "inventario rodando"; sleep 45; done\n', { ctx });
      s.mode = 0o644;      // defeito 1: sem permissão de execução
      s.uid = 0; s.gid = 0;
      const u = fs.writeFile('/etc/systemd/system/inventario.service',
        '[Unit]\nDescription=Inventario da frota\nAfter=network.target\n\n' +
        '[Service]\nType=simple\nUser=inventario\n' +      // defeito 2: usuário não existe
        'WorkingDirectory=/opt/inventario/dados\n' +        // defeito 3: diretório não existe
        'ExecStart=/opt/inventario/inventario.sh\nRestart=always\nRestartSec=5\n\n' +
        '[Install]\nWantedBy=multi-user.target\n', { ctx });
      u.mode = 0o644;
      try { m.daemonReload(); } catch (e) { }
      const un = m.unit('inventario');
      if (un) { un.state = 'failed'; un.sub = 'failed'; un.enabled = false; un.lastError = 'nunca subiu'; }
    },
    tasks: [
      {
        id: 't8-5-a', kind: 'guiado', title: 'Leia um erro de verdade',
        body: [
          { p: 'Crie uma unit propositalmente quebrada e acompanhe o diagnóstico.' },
          {
            code: [
              '$ sudo tee /etc/systemd/system/quebrado.service > /dev/null << \'EOF\'',
              '[Unit]',
              'Description=Servico com defeito',
              '',
              '[Service]',
              'ExecStart=/opt/naoexiste/programa.sh',
              '',
              '[Install]',
              'WantedBy=multi-user.target',
              'EOF',
              '$ sudo systemctl daemon-reload',
              '$ sudo systemctl start quebrado',
              '$ systemctl status quebrado --no-pager | head -6',
              '$ journalctl -xeu quebrado --no-pager | tail -4',
              '$ systemctl --failed'
            ]
          },
          { p: 'Identifique no log a linha que diz exatamente o que falhou e qual o código.' }
        ],
        hints: ['O <code>start</code> vai falhar — é esperado. O objetivo é ler o motivo.'],
        solution: '<div class="code"><pre>sudo tee /etc/systemd/system/quebrado.service &gt; /dev/null &lt;&lt; \'EOF\'\n[Unit]\nDescription=Servico com defeito\n\n[Service]\nExecStart=/opt/naoexiste/programa.sh\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsudo systemctl daemon-reload\nsudo systemctl start quebrado\nsystemctl status quebrado --no-pager | head -6\njournalctl -xeu quebrado --no-pager | tail -4\nsystemctl --failed</pre></div>',
        check: async (ctx) => {
          const u = unidade(ctx, 'quebrado');
          return LX.H.checkAll([
            [H.exists(ctx, '/etc/systemd/system/quebrado.service'), 'Crie a unit <code>quebrado.service</code>.'],
            [!!u, 'A unit não foi carregada — faltou o <code>daemon-reload</code>.'],
            [() => H.usedCommand(ctx, /systemctl\s+start\s+quebrado/), 'Tente iniciar o serviço para ver a falha.'],
            [() => !!u && u.state === 'failed', 'A unit deveria estar em <code>failed</code> — tente iniciá-la.'],
            [() => H.usedCommand(ctx, /journalctl.*quebrado/), 'Leia o motivo no journal: <code>journalctl -xeu quebrado</code>.']
          ]);
        }
      },
      {
        id: 't8-5-q', kind: 'quiz', title: 'Traduza o código de falha',
        body: [
          { p: 'Um serviço novo falha ao subir. O <code>journalctl -xeu meuapp</code> mostra:' },
          { code: ['meuapp.service: Main process exited, code=exited, status=203/EXEC'], run: false, mixed: false, lang: 'text' },
          { p: 'A unit tem <code>ExecStart=/opt/meuapp/app.sh</code>, e o arquivo existe nesse caminho exato. Qual é a causa mais provável?' }
        ],
        options: [
          { text: 'O <code>/opt/meuapp/app.sh</code> não tem permissão de execução — falta um <code>chmod +x</code>.', correct: true },
          { text: 'O usuário definido em <code>User=</code> não existe.', why: 'Usuário inexistente gera <code>217/USER</code>, um código diferente do que apareceu aqui.' },
          { text: 'O <code>WorkingDirectory=</code> da unit aponta para uma pasta que não existe.', why: 'Isso produz <code>200/CHDIR</code>, não <code>203/EXEC</code>.' },
          { text: 'Outro processo já está usando a porta que o serviço tentaria abrir.', why: 'Porta ocupada aparece como <code>Address already in use</code> na mensagem, não como <code>203/EXEC</code> — e o systemd nem chegaria a executar o programa para descobrir isso.' }
        ],
        explain: '<code>203/EXEC</code> significa "o kernel não conseguiu executar esse binário". Com caminho absoluto correto e arquivo existente, a causa típica é permissão de execução ausente (também pode ser shebang inválido). A correção: <code>sudo chmod +x /opt/meuapp/app.sh</code> e <code>sudo systemctl restart meuapp</code>.'
      },
      {
        id: 't8-5-b', kind: 'desafio', title: 'Troubleshooting: o inventário que nunca subiu',
        body: [
          { p: 'Alguém deixou pronto o serviço <code>inventario.service</code> antes de sair de férias. Ele nunca funcionou. O arquivo já está em <code>/etc/systemd/system/</code> e o programa em <code>/opt/inventario/</code>.' },
          { p: 'Comece investigando — <strong>não</strong> reescreva a unit do zero:' },
          {
            code: [
              '$ systemctl status inventario --no-pager | head -6',
              '$ systemctl cat inventario',
              '$ sudo systemctl start inventario',
              '$ journalctl -xeu inventario --no-pager | tail -5',
              '$ ls -l /opt/inventario/'
            ]
          },
          { p: 'São <strong>três defeitos independentes</strong>, e o systemd só revela um de cada vez: cada correção descobre o próximo. Ao final, o serviço deve estar <strong>ativo</strong> e <strong>habilitado</strong>.' },
          { p: 'Regras: mantenha o <code>User=</code> como está (a conta deve passar a existir, como conta de sistema sem shell de login) e mantenha o <code>WorkingDirectory=</code> apontando para onde aponta.' }
        ],
        hints: [
          'Rode <code>sudo systemctl start inventario</code> e leia o journal. O primeiro código de falha aponta o primeiro defeito — conserte, tente de novo e leia o próximo.',
          'Os três códigos que vão aparecer, em alguma ordem: <code>217/USER</code> (conta ausente), <code>200/CHDIR</code> (diretório ausente) e <code>203/EXEC</code> (script sem permissão de execução).',
          '<code>sudo useradd -r -s /usr/sbin/nologin inventario</code>; <code>sudo mkdir -p /opt/inventario/dados</code>; <code>sudo chmod +x /opt/inventario/inventario.sh</code>; depois <code>sudo systemctl enable --now inventario</code>.'
        ],
        solution: '<div class="code"><pre># 1. investigação\nsystemctl cat inventario\nsudo systemctl start inventario\njournalctl -xeu inventario --no-pager | tail -5\n\n# 2. defeito: User=inventario não existe  (217/USER)\nsudo useradd -r -s /usr/sbin/nologin inventario\n\n# 3. defeito: WorkingDirectory não existe  (200/CHDIR)\nsudo mkdir -p /opt/inventario/dados\n\n# 4. defeito: o script não é executável    (203/EXEC)\nsudo chmod +x /opt/inventario/inventario.sh\n\n# 5. subir e habilitar\nsudo systemctl reset-failed inventario\nsudo systemctl enable --now inventario\nsystemctl status inventario --no-pager | head -6</pre></div><p style="margin-top:8px">Repare que nenhuma linha do arquivo da unit precisou ser alterada: os três defeitos estavam no <em>ambiente</em> que a unit pressupunha. É o padrão mais comum de "o serviço não sobe".</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const u = unidade(ctx, 'inventario');
          if (!u) return { ok: false, msg: 'A unit <code>inventario.service</code> não está carregada — recarregue a aula para restaurar o cenário.' };
          const conta = m.userByName('inventario');
          return LX.H.checkAll([
            [!!conta, 'A conta <code>inventario</code>, exigida pelo <code>User=</code> da unit, ainda não existe.'],
            [!!conta && conta.uid < 1000, `A conta <code>inventario</code> deve ser de sistema (UID &lt; 1000); tem ${conta ? conta.uid : '?'}.`],
            [!!conta && /nologin|false/.test(conta.shell), 'A conta de serviço não pode ter shell de login.'],
            [H.isDir(ctx, '/opt/inventario/dados'), 'O <code>WorkingDirectory</code> da unit aponta para <code>/opt/inventario/dados</code>, que ainda não existe.'],
            [(H.mode(ctx, '/opt/inventario/inventario.sh') & 0o111) !== 0, 'O script <code>/opt/inventario/inventario.sh</code> ainda não tem permissão de execução.'],
            [u.user === 'inventario', 'O <code>User=</code> da unit deveria continuar sendo <code>inventario</code> — o enunciado pede para não alterá-lo.'],
            [u.workingDirectory === '/opt/inventario/dados', 'O <code>WorkingDirectory=</code> deveria continuar apontando para <code>/opt/inventario/dados</code>.'],
            [u.state === 'active', `O serviço ainda não está ativo (estado <code>${u.state}</code>${u.lastError ? ': ' + u.lastError : ''}). Tente <code>sudo systemctl start inventario</code> e leia o journal.`],
            [u.enabled === true, 'Falta habilitar o serviço para o boot (<code>systemctl enable inventario</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 8.6 ============================== */
  LX.lesson('m08', {
    id: 'l8-6', n: '8.6', title: 'Agendamento: timers e cron',
    goal: 'Agendar tarefas repetitivas com as duas ferramentas que você vai encontrar, sabendo quando cada uma é a melhor escolha.',
    body: [
      { p: 'Duas gerações convivem: o <strong>cron</strong>, de 1975, simples e onipresente; e os <strong>timers do systemd</strong>, mais verbosos e muito mais observáveis.' },

      { h2: 'cron: a forma clássica' },
      { cmd: 'crontab' },
      {
        ascii: `┌──────── minuto (0-59)
│ ┌────── hora (0-23)
│ │ ┌──── dia do mês (1-31)
│ │ │ ┌── mês (1-12)
│ │ │ │ ┌ dia da semana (0-7, 0 e 7 = domingo)
│ │ │ │ │
* * * * *  comando

30 3 * * *        todo dia às 03:30
0 */4 * * *       a cada 4 horas, no minuto 0
*/15 * * * *      a cada 15 minutos
0 9 * * 1-5       09:00, de segunda a sexta
0 0 1 * *         no primeiro dia de cada mês`
      },
      {
        table: {
          head: ['Comando', 'Efeito'],
          rows: [
            ['<code>crontab -l</code>', 'lista as suas tarefas'],
            ['<code>crontab -e</code>', 'edita as suas tarefas'],
            ['<code>crontab -r</code>', '<strong>apaga todas</strong> — cuidado com a tecla vizinha do <code>-e</code>'],
            ['<code>sudo crontab -l -u ana</code>', 'lista as tarefas de outro usuário'],
            ['<code>/etc/crontab</code>', 'tabela do sistema (tem uma coluna a mais: o usuário)'],
            ['<code>/etc/cron.d/</code>', 'arquivos avulsos — o lugar certo para tarefas de pacotes']
          ]
        }
      },
      { code: ['$ crontab -l 2>/dev/null || echo "nenhuma tarefa para o aluno"', '$ cat /etc/crontab 2>/dev/null | tail -6', '$ ls /etc/cron.daily 2>/dev/null | head -5'] },
      {
        box: 'warn', label: 'As três pegadinhas do cron', body: [
          { ol: [
            '<strong>PATH mínimo:</strong> o cron roda com um <code>PATH</code> curtíssimo. Use caminhos absolutos sempre — é a causa número 1 de "funciona no terminal, não funciona no cron".',
            '<strong>Sem ambiente:</strong> nada de <code>.bashrc</code>, nada de variáveis da sua sessão.',
            '<strong>O <code>%</code> é especial:</strong> dentro do crontab, <code>%</code> vira quebra de linha. Um <code>date +%Y</code> precisa virar <code>date +\\%Y</code>.'
          ] },
          { p: 'E redirecione a saída: sem isso, o cron tenta enviar e-mail e a mensagem se perde. O padrão é <code>&gt;&gt; /var/log/tarefa.log 2&gt;&amp;1</code>.' }
        ]
      },

      { h2: 'Timers do systemd: a forma atual' },
      { p: 'Um timer é um par de arquivos: <code>tarefa.service</code> (o que fazer) e <code>tarefa.timer</code> (quando fazer).' },
      {
        code: [
          '# /etc/systemd/system/limpeza.service',
          '[Unit]',
          'Description=Limpeza de arquivos temporarios',
          '',
          '[Service]',
          'Type=oneshot',
          'ExecStart=/opt/limpeza/limpar.sh'
        ], run: false, lang: 'ini'
      },
      {
        code: [
          '# /etc/systemd/system/limpeza.timer',
          '[Unit]',
          'Description=Executa a limpeza diariamente',
          '',
          '[Timer]',
          'OnCalendar=daily',
          'Persistent=true',
          '',
          '[Install]',
          'WantedBy=timers.target'
        ], run: false, lang: 'ini'
      },
      { p: 'Habilita-se o <strong>timer</strong>, não o service: <code>sudo systemctl enable --now limpeza.timer</code>.' },
      { code: ['$ systemctl list-timers | head -5'] },
      {
        table: {
          head: ['', 'cron', 'systemd timer'],
          rows: [
            ['Sintaxe', 'uma linha', 'dois arquivos'],
            ['Log', 'você redireciona', '<strong>vai para o journal automaticamente</strong>'],
            ['Perdeu a hora (máquina desligada)', 'a execução é pulada', '<code>Persistent=true</code> executa ao ligar'],
            ['Dependências', 'não tem', '<code>After=</code>, <code>Requires=</code>'],
            ['Limitar recursos', 'não', '<code>MemoryMax=</code>, <code>CPUQuota=</code>'],
            ['Ver o histórico', 'só pelo seu log', '<code>systemctl status limpeza</code>'],
            ['Aleatorizar o horário', 'na mão', '<code>RandomizedDelaySec=</code>']
          ]
        }
      },
      {
        box: 'old', label: 'Qual aprender', body: [
          { p: 'Aprenda os <strong>dois</strong>, por motivos diferentes. O cron está em toda máquina, é mais rápido de escrever e continua adequado para tarefas simples de um usuário. Os timers são a escolha atual para tarefas de sistema: log unificado, execução perdida recuperável, dependências e limites de recurso.' },
          { p: 'Na prática: tarefa pessoal e simples → cron; tarefa de infraestrutura que alguém vai precisar depurar em um incidente → timer.' }
        ]
      },
      {
        box: 'tip', body: [
          { p: 'Para testar uma tarefa agendada sem esperar a hora, rode o service diretamente: <code>sudo systemctl start limpeza.service</code>. E confira quando cada timer vai disparar com <code>systemctl list-timers --all</code>.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't8-6-a', kind: 'guiado', title: 'Veja os dois mundos',
        body: [
          { p: 'Inspecione o cron do sistema e os timers ativos.' },
          {
            code: [
              '$ crontab -l 2>/dev/null || echo "sem tarefas para o aluno"',
              '$ cat /etc/crontab | tail -6',
              '$ ls /etc/cron.daily | head -5',
              '$ systemctl list-timers | head -5'
            ]
          }
        ],
        hints: ['O <code>/etc/crontab</code> tem uma coluna a mais que o crontab de usuário: o usuário que executa.'],
        solution: '<div class="code"><pre>crontab -l\ncat /etc/crontab | tail -6\nls /etc/cron.daily\nsystemctl list-timers | head -5</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /crontab\s+-l/), 'Liste as tarefas do seu usuário com <code>crontab -l</code>.'],
          [() => H.usedCommand(ctx, /\/etc\/crontab|cron\.daily/), 'Inspecione o cron do sistema em <code>/etc/crontab</code> ou <code>/etc/cron.daily</code>.'],
          [() => H.usedCommand(ctx, /list-timers/), 'Veja os timers com <code>systemctl list-timers</code>.']
        ])
      },
      {
        id: 't8-6-f', kind: 'fill', title: 'Complete o agendamento',
        body: [
          { p: 'Você quer rodar <code>/opt/backup/backup.sh</code> <strong>todos os dias às 03:30 da manhã</strong>, guardando a saída (e os erros) em <code>/var/log/backup.log</code>.' },
          { p: 'Complete os cinco campos de tempo da linha do crontab:' }
        ],
        template: '___ /opt/backup/backup.sh >> /var/log/backup.log 2>&1', sample: '30 3 * * *',
        answers: ['30 3 \\* \\* \\*'],
        hints: ['A ordem é: minuto, hora, dia do mês, mês, dia da semana.', 'Minuto 30, hora 3, e asterisco nos três últimos campos.'],
        solution: 'A resposta é <code>30 3 * * *</code>. Cuidado com a ordem: <code>3 30 * * *</code> seria "às 3 minutos da hora 30", que nem existe. E note o <code>2&gt;&amp;1</code> no fim: sem ele, os erros não entrariam no arquivo de log.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim().replace(/\s+/g, ' ');
          const campos = v.split(' ');
          return LX.H.checkAll([
            [campos.length === 5, `Um agendamento de cron tem 5 campos; você escreveu ${campos.length}.`],
            [campos[0] === '30', `O primeiro campo é o <strong>minuto</strong>: deveria ser 30, está "${campos[0]}".`],
            [campos[1] === '3', `O segundo campo é a <strong>hora</strong>: deveria ser 3, está "${campos[1]}".`],
            [campos.slice(2).every(x => x === '*'), 'Os três últimos campos (dia do mês, mês, dia da semana) devem ser <code>*</code>.']
          ]);
        }
      },
      {
        id: 't8-6-b', kind: 'desafio', title: 'Um timer que roda de hora em hora',
        body: [
          { p: 'Crie uma tarefa agendada pelo systemd que rode um script a cada hora.' },
          { p: 'Prepare o script:' },
          {
            code: [
              '$ sudo mkdir -p /opt/higiene',
              '$ printf \'#!/bin/bash\\necho "limpando temporarios"\\n\' | sudo tee /opt/higiene/limpar.sh > /dev/null',
              '$ sudo chmod +x /opt/higiene/limpar.sh'
            ]
          },
          { p: 'Agora crie os <strong>dois</strong> arquivos:' },
          {
            ul: [
              '<code>/etc/systemd/system/higiene.service</code> — descrição <code>Higiene do sistema</code>, <code>Type=oneshot</code>, executando <code>/opt/higiene/limpar.sh</code>;',
              '<code>/etc/systemd/system/higiene.timer</code> — com <code>OnCalendar=hourly</code>, <code>Persistent=true</code> e <code>WantedBy=timers.target</code>.'
            ]
          },
          { p: 'Depois recarregue o systemd e comprove que o service funciona rodando-o na mão uma vez, com <code>sudo systemctl start higiene.service</code>. Um service <code>oneshot</code> bem-sucedido fica em <code>active (exited)</code>.' }
        ],
        hints: [
          'O timer não roda nada sozinho: ele dispara o service de mesmo nome. Por isso são dois arquivos.',
          'No <code>.service</code>, <code>Type=oneshot</code> é o que faz a unit terminar em vez de ficar rodando.',
          'Não esqueça do <code>sudo systemctl daemon-reload</code> depois de criar os arquivos.'
        ],
        solution: '<div class="code"><pre>sudo mkdir -p /opt/higiene\nprintf \'#!/bin/bash\\necho "limpando temporarios"\\n\' | sudo tee /opt/higiene/limpar.sh &gt; /dev/null\nsudo chmod +x /opt/higiene/limpar.sh\n\nsudo tee /etc/systemd/system/higiene.service &gt; /dev/null &lt;&lt; \'EOF\'\n[Unit]\nDescription=Higiene do sistema\n\n[Service]\nType=oneshot\nExecStart=/opt/higiene/limpar.sh\nEOF\n\nsudo tee /etc/systemd/system/higiene.timer &gt; /dev/null &lt;&lt; \'EOF\'\n[Unit]\nDescription=Executa a higiene de hora em hora\n\n[Timer]\nOnCalendar=hourly\nPersistent=true\n\n[Install]\nWantedBy=timers.target\nEOF\n\nsudo systemctl daemon-reload\nsudo systemctl start higiene.service\nsystemctl status higiene --no-pager | head -5</pre></div><p style="margin-top:8px">O <code>Persistent=true</code> é a vantagem sobre o cron: se a máquina estiver desligada na hora marcada, a tarefa roda assim que ela voltar, em vez de simplesmente ser pulada.</p>',
        check: async (ctx) => {
          const u = unidade(ctx, 'higiene');
          const timer = H.read(ctx, '/etc/systemd/system/higiene.timer');
          if (!H.exists(ctx, '/etc/systemd/system/higiene.service')) return { ok: false, msg: 'Crie o arquivo <code>/etc/systemd/system/higiene.service</code>.' };
          if (timer === null) return { ok: false, msg: 'Crie o arquivo <code>/etc/systemd/system/higiene.timer</code>.' };
          return LX.H.checkAll([
            [H.exists(ctx, '/opt/higiene/limpar.sh'), 'Crie o script <code>/opt/higiene/limpar.sh</code>.'],
            [(H.mode(ctx, '/opt/higiene/limpar.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [!!u, 'A unit não foi carregada — faltou o <code>sudo systemctl daemon-reload</code>.'],
            [/Higiene do sistema/i.test(u.description), `A descrição do service deve ser <code>Higiene do sistema</code>; está "${u.description}".`],
            [u.serviceType === 'oneshot', `O service deve ser <code>Type=oneshot</code>; está <code>${u.serviceType}</code>.`],
            [/OnCalendar\s*=\s*hourly/i.test(timer), 'O timer precisa de <code>OnCalendar=hourly</code>.'],
            [/Persistent\s*=\s*true/i.test(timer), 'O timer precisa de <code>Persistent=true</code>.'],
            [/WantedBy\s*=\s*timers\.target/i.test(timer), 'O timer precisa de <code>WantedBy=timers.target</code> na seção <code>[Install]</code>.'],
            [u.state === 'active' && u.sub === 'exited', `Rode o service uma vez com <code>sudo systemctl start higiene.service</code> — um <code>oneshot</code> bem-sucedido termina em <code>active (exited)</code>. Estado atual: <code>${u.state} (${u.sub})</code>.`]
          ]);
        }
      }
    ]
  });

})();
