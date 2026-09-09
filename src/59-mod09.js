/* =========================================================================
   MÓDULO 9 — Redes
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 9.1 ============================== */
  LX.lesson('m09', {
    id: 'l9-1', n: '9.1', title: 'O caminho de um pacote',
    goal: 'Ter o modelo mental que transforma "a rede não funciona" em quatro perguntas com resposta objetiva.',
    body: [
      { lede: 'Quase todo problema de rede em um servidor cabe em quatro peças: endereço, máscara, gateway e DNS. Entender o papel de cada uma resolve mais do que decorar comandos.' },
      {
        ascii: `     você digita:  curl http://api.exemplo.com

  1. DNS       "api.exemplo.com" vira 203.0.113.42
               └─ /etc/hosts primeiro, depois o servidor de /etc/resolv.conf

  2. ROTA      203.0.113.42 está na minha rede?
               └─ compara com a máscara: 10.0.2.15/24 cobre 10.0.2.0 a 10.0.2.255
               └─ não está  →  manda para o GATEWAY (10.0.2.1)

  3. ARP       qual o endereço físico do gateway?
               └─ ip neigh guarda a resposta

  4. TCP       abre a conexão na PORTA 80 e faz o pedido HTTP
               └─ do outro lado, algum processo precisa estar escutando`
      },
      { p: 'Cada etapa falha de um jeito diferente — e a mensagem de erro diz qual etapa quebrou:' },
      {
        table: {
          head: ['Etapa', 'Erro típico', 'Onde investigar'],
          rows: [
            ['DNS', '<code>Could not resolve host</code>, <code>Name or service not known</code>', '<code>/etc/resolv.conf</code>, <code>dig</code>'],
            ['Rota', '<code>Network is unreachable</code>', '<code>ip route</code>, <code>ip a</code>'],
            ['Caminho', '<code>No route to host</code>, timeout', '<code>ping</code>, <code>traceroute</code>, firewall'],
            ['TCP', '<code>Connection refused</code>', 'o serviço do outro lado (<code>ss</code>)'],
            ['Aplicação', 'HTTP 500, 502, 404', 'o log da aplicação']
          ]
        }
      },
      {
        box: 'key', body: [
          { p: '<strong>Connection refused</strong> e <strong>timeout</strong> dizem coisas opostas e é vital não confundir. "Refused" significa que o pacote <em>chegou</em> e alguém respondeu "não tem ninguém nessa porta" — a rede está boa, o serviço é que não está lá. "Timeout" significa que o pacote sumiu no caminho: firewall descartando, rota errada, máquina desligada.' }
        ]
      },

      { h2: 'Endereço e máscara' },
      { p: 'O IP identifica a máquina; a máscara diz qual pedaço do IP é a <strong>rede</strong> e qual é a <strong>máquina</strong>.' },
      {
        ascii: `10.0.2.15/24
└────┬───┘ └┬┘
     │      └─ 24 bits são a REDE: 10.0.2.x
     └──────── esta máquina é a .15 dentro dela

  /24  →  255.255.255.0    →  254 endereços úteis (x.x.x.1 a x.x.x.254)
  /16  →  255.255.0.0      →  65.534 endereços
  /8   →  255.0.0.0        →  16 milhões
  /32  →  255.255.255.255  →  um único endereço (usado em regras e rotas)`
      },
      { p: 'A consequência prática: se o destino está <strong>dentro</strong> da sua rede, o pacote vai direto; se está fora, precisa do gateway. Uma máscara errada faz a máquina achar que o gateway é "local" e nunca conseguir sair.' },
      { code: ['$ ip -br a', '$ ip route', '$ ip route get 8.8.8.8', '$ ip route get 10.0.2.31'] },
      { p: 'Compare as duas últimas linhas: para o destino da rede local não aparece <code>via</code>; para o destino externo, o pacote vai <code>via</code> o gateway.' },

      { h2: 'Endereços que você precisa reconhecer' },
      {
        table: {
          head: ['Faixa', 'O que é'],
          rows: [
            ['<code>127.0.0.0/8</code>', 'loopback — a própria máquina; nunca sai pela rede'],
            ['<code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>', 'privadas (RFC 1918) — redes internas, não roteáveis na internet'],
            ['<code>169.254.0.0/16</code>', 'link-local: <strong>o DHCP falhou</strong> e a máquina se autoconfigurou'],
            ['<code>0.0.0.0</code>', 'em um serviço, significa "escutar em todas as interfaces"'],
            ['<code>::1</code>, <code>fe80::/10</code>', 'loopback e link-local do IPv6']
          ]
        }
      },
      {
        box: 'tip', body: [
          { p: 'Ver um IP <code>169.254.x.x</code> em uma interface é diagnóstico pronto: a máquina pediu endereço por DHCP e ninguém respondeu. Cabo, VLAN, ou o servidor DHCP fora do ar.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't9-1-a', kind: 'guiado', title: 'Leia a configuração da máquina',
        body: [
          { p: 'Levante as quatro peças: endereço, máscara, gateway e DNS.' },
          {
            code: [
              '$ ip -br a',
              '$ ip a show eth0',
              '$ ip route',
              '$ ip route get 8.8.8.8',
              '$ cat /etc/resolv.conf',
              '$ ip neigh'
            ]
          },
          { p: 'Responda para você: qual é o IP desta máquina? Qual a faixa da rede local? Qual o gateway? Qual o servidor DNS?' }
        ],
        hints: ['O gateway é o endereço que aparece depois de <code>via</code> na rota <code>default</code>.'],
        solution: '<div class="code"><pre>ip -br a\nip a show eth0\nip route\nip route get 8.8.8.8\ncat /etc/resolv.conf\nip neigh</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ip\s+(-br\s+)?a(ddr)?\b/), 'Veja os endereços com <code>ip -br a</code>.'],
          [() => H.usedCommand(ctx, /ip\s+r(oute)?\b/), 'Veja a tabela de rotas com <code>ip route</code>.'],
          [() => H.usedCommand(ctx, /resolv\.conf/), 'Confira o servidor DNS em <code>/etc/resolv.conf</code>.'],
          [() => H.usedCommand(ctx, /ip\s+neigh|arp/), 'Veja a tabela de vizinhos com <code>ip neigh</code>.']
        ])
      },
      {
        id: 't9-1-q', kind: 'quiz', title: 'Conceito: refused × timeout',
        body: [
          { p: 'Você tenta acessar uma API interna e recebe:' },
          { code: ['curl: (7) Failed to connect to api.interno port 8080: Connection refused'], run: false, mixed: false, lang: 'text' },
          { p: 'O que isso <strong>já</strong> permite concluir?' }
        ],
        options: [
          { text: 'A rede está funcionando até a máquina de destino: o nome resolveu, o pacote chegou e a máquina respondeu que nada escuta na porta 8080.', correct: true },
          { text: 'O firewall está bloqueando a porta 8080.', why: 'Firewall normalmente <em>descarta</em> o pacote, gerando timeout. Um "refused" indica resposta ativa da máquina.' },
          { text: 'O DNS não resolveu o nome <code>api.interno</code>.', why: 'Se o DNS falhasse, a mensagem seria <code>Could not resolve host</code> e nem haveria tentativa de conexão.' },
          { text: 'A máquina de destino está desligada.', why: 'Desligada não responde nada — daria timeout. Alguém respondeu.' }
        ],
        explain: 'A investigação continua <strong>na máquina de destino</strong>: o serviço está rodando (<code>systemctl status</code>)? Está escutando na porta certa e no endereço certo (<code>ss -tlnp</code>)? Um serviço configurado em <code>127.0.0.1:8080</code> aceita conexões locais e recusa as que vêm pela rede — causa clássica desse erro.'
      },
      {
        id: 't9-1-b', kind: 'desafio', title: 'Direto ou via gateway?',
        body: [
          { p: 'Usando <code>ip route get</code>, descubra se o pacote para cada um destes dois destinos sai <strong>direto</strong> (dentro da sua rede local) ou <strong>via gateway</strong> (para fora dela): <code>10.0.2.31</code> e <code>8.8.8.8</code>.' },
          { p: 'Grave a conclusão em <code>~/caminho.txt</code>, duas linhas, nesta ordem — primeiro <code>10.0.2.31</code>, depois <code>8.8.8.8</code> — cada uma no formato <code>IP: direto</code> ou <code>IP: via-gateway</code>, conforme o que você observar.' }
        ],
        hints: [
          'Rode <code>ip route get 10.0.2.31</code> e <code>ip route get 8.8.8.8</code> e veja se a palavra <code>via</code> aparece na saída de cada um.',
          'Se a saída trouxer <code>via ENDEREÇO</code>, escreva <code>via-gateway</code>; se não trouxer, escreva <code>direto</code>. Grave a primeira linha com <code>&gt;</code> e acrescente a segunda com <code>&gt;&gt;</code>.'
        ],
        solution: '<div class="code"><pre>ip route get 10.0.2.31\necho "10.0.2.31: direto" &gt; ~/caminho.txt\nip route get 8.8.8.8\necho "8.8.8.8: via-gateway" &gt;&gt; ~/caminho.txt\ncat ~/caminho.txt</pre></div><p style="margin-top:8px">10.0.2.31 está dentro da rede 10.0.2.0/24 desta máquina — o pacote vai direto, sem <code>via</code> na saída. 8.8.8.8 está fora dela, então precisa do gateway.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const c = H.read(ctx, '/home/aluno/caminho.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/caminho.txt</code> ainda não existe.' };
          const l = c.split('\n').map(x => x.trim()).filter(Boolean);
          const eth = m.interfaces.find(i => i.name !== 'lo');
          const emRedeLocal = (() => {
            if (!eth) return true;
            const [addr, bits] = eth.ipv4.split('/');
            const mascara = ~0 << (32 - (+bits || 24));
            const paraInt = (ip) => ip.split('.').reduce((acc, o) => ((acc << 8) + (+o)) >>> 0, 0);
            return (paraInt('10.0.2.31') & mascara) === (paraInt(addr) & mascara);
          })();
          const esperado0 = emRedeLocal ? 'direto' : 'via-gateway';
          return LX.H.checkAll([
            [l.length === 2, () => `O arquivo deve ter exatamente 2 linhas; tem ${l.length}.`],
            [/^10\.0\.2\.31:\s+\S+$/.test(l[0] || ''), () => `A primeira linha deve começar com <code>10.0.2.31:</code>. Obtive: "${l[0] || ''}".`],
            [() => new RegExp(`^10\\.0\\.2\\.31:\\s+${esperado0}$`).test(l[0] || ''), () => `10.0.2.31 está ${emRedeLocal ? 'dentro' : 'fora'} da rede desta máquina — deveria ser <code>${esperado0}</code>. Confira com <code>ip route get 10.0.2.31</code> (procure pela palavra <code>via</code>).`],
            [/^8\.8\.8\.8:\s+\S+$/.test(l[1] || ''), () => `A segunda linha deve começar com <code>8.8.8.8:</code>. Obtive: "${l[1] || ''}".`],
            [/^8\.8\.8\.8:\s+via-gateway$/.test(l[1] || ''), '8.8.8.8 está fora da rede local — o pacote sai <code>via-gateway</code> (aparece <code>via</code> na saída do <code>ip route get</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 9.2 ============================== */
  LX.lesson('m09', {
    id: 'l9-2', n: '9.2', title: 'Interfaces, endereços e rotas',
    goal: 'Inspecionar e alterar a configuração de rede com o comando atual — e saber onde a mudança precisa ser gravada para sobreviver ao boot.',
    body: [
      { cmd: 'ip' },
      { p: 'O <code>ip</code> substituiu três comandos antigos: <code>ifconfig</code> (endereços), <code>route</code> (rotas) e <code>arp</code> (vizinhos). Ele é organizado por <strong>objeto</strong> e <strong>ação</strong>.' },
      {
        cheat: [
          ['<code>ip a</code> / <code>ip addr show</code>', 'endereços de todas as interfaces'],
          ['<code>ip -br a</code>', 'versão resumida, uma linha por interface'],
          ['<code>ip link</code>', 'estado físico das interfaces'],
          ['<code>ip r</code> / <code>ip route</code>', 'tabela de rotas'],
          ['<code>ip route get IP</code>', 'por onde <em>este</em> destino sairia'],
          ['<code>ip neigh</code>', 'vizinhos (tabela ARP)'],
          ['<code>ip -s link</code>', 'estatísticas: pacotes, erros, descartes']
        ]
      },
      { code: ['$ ip -br a', '$ ip link show eth0', '$ ip neigh'] },
      { p: 'A linha do <code>ip link</code> traz três informações críticas:' },
      {
        ascii: `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 ... state UP
          │                    │     │                │            │
          │                    │     │                │            └─ estado operacional
          │                    │     │                └─ tamanho máximo do pacote
          │                    │     └─ LOWER_UP = há sinal no cabo/link
          │                    └─ UP = administrativamente ligada
          └─ NO-CARRIER apareceria aqui se o cabo estivesse solto`
      },
      {
        box: 'key', body: [
          { p: 'Distinga <strong>UP</strong> de <strong>LOWER_UP</strong>: a primeira é decisão do administrador ("ligue essa interface"), a segunda é fato físico ("existe sinal do outro lado"). Uma interface <code>UP</code> sem <code>LOWER_UP</code> é cabo desconectado, porta do switch desligada ou, em nuvem, interface não anexada.' }
        ]
      },

      { h2: 'Mudar agora (volátil)' },
      { p: 'Alterações com <code>ip</code> valem <strong>até o próximo reboot</strong> — e é exatamente por isso que são seguras para testar.' },
      {
        code: [
          '$ sudo ip addr add 192.168.50.10/24 dev eth0',
          '$ ip -br a',
          '$ sudo ip addr del 192.168.50.10/24 dev eth0',
          '$ sudo ip route add 10.99.0.0/24 via 10.0.2.1',
          '$ ip route',
          '$ sudo ip route del 10.99.0.0/24'
        ]
      },
      { p: 'Derrubar e levantar uma interface — e ver o efeito imediato na conectividade:' },
      {
        code: [
          '$ sudo ip link set eth0 down',
          '$ ip -br a',
          '$ ping -c 1 example.com',
          '$ sudo ip link set eth0 up',
          '$ ping -c 1 example.com'
        ]
      },
      {
        box: 'warn', body: [
          { p: 'Nunca rode <code>ip link set eth0 down</code> em um servidor onde você está conectado por SSH pela <strong>própria</strong> interface: a sessão morre e não há como levantá-la de volta. Se precisar mexer, use console fora de banda, ou agende a reversão automática (<code>sleep 60 && ip link set eth0 up</code> em segundo plano) antes de aplicar a mudança.' }
        ]
      },

      { h2: 'Mudar para sempre (persistente)' },
      { p: 'Onde a configuração é gravada depende da distribuição:' },
      {
        table: {
          head: ['Sistema', 'Onde configurar'],
          rows: [
            ['Ubuntu Server (atual)', '<strong>Netplan</strong>: arquivos YAML em <code>/etc/netplan/</code>'],
            ['Ubuntu Desktop / Fedora', '<strong>NetworkManager</strong>: <code>nmcli</code>'],
            ['Debian clássico', '<code>/etc/network/interfaces</code>'],
            ['RHEL/CentOS antigos', '<code>/etc/sysconfig/network-scripts/ifcfg-*</code>'],
            ['Containers', 'a rede é do runtime (módulo de networks do Docker)']
          ]
        }
      },
      {
        code: [
          '# exemplo de /etc/netplan/01-servidor.yaml',
          'network:',
          '  version: 2',
          '  ethernets:',
          '    eth0:',
          '      dhcp4: false',
          '      addresses: [10.0.2.15/24]',
          '      routes:',
          '        - to: default',
          '          via: 10.0.2.1',
          '      nameservers:',
          '        addresses: [1.1.1.1, 8.8.8.8]'
        ], run: false, lang: 'yaml'
      },
      { p: 'Depois de editar: <code>sudo netplan try</code> (aplica e <strong>desfaz sozinho em 120 segundos</strong> se você não confirmar — a rede de segurança contra se trancar para fora) e, quando estiver certo, <code>sudo netplan apply</code>.' },
      {
        box: 'old', body: [
          { p: '<code>ifconfig</code>, <code>route add</code> e <code>arp</code> ainda funcionam se o pacote <code>net-tools</code> estiver instalado, mas estão obsoletos há mais de uma década: não mostram múltiplos endereços por interface corretamente, não conhecem várias tabelas de roteamento e não recebem manutenção. <strong>Aprenda o <code>ip</code></strong>; reconheça os antigos porque eles aparecem em documentação velha.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't9-2-a', kind: 'guiado', title: 'Mexa na rede sem medo',
        body: [
          { p: 'Adicione um endereço, uma rota, derrube e levante a interface — tudo volátil.' },
          {
            code: [
              '$ sudo ip addr add 192.168.50.10/24 dev eth0 && ip -br a',
              '$ sudo ip addr del 192.168.50.10/24 dev eth0 && ip -br a',
              '$ sudo ip route add 10.99.0.0/24 via 10.0.2.1 && ip route',
              '$ sudo ip route del 10.99.0.0/24 && ip route',
              '$ sudo ip link set eth0 down && ip -br a',
              '$ ping -c 1 example.com',
              '$ sudo ip link set eth0 up && ping -c 1 -q example.com | tail -2'
            ]
          },
          { p: 'Repare na mensagem <code>Network is unreachable</code> com a interface derrubada: é o erro da etapa 2 do modelo da aula anterior.' }
        ],
        hints: ['Todas essas mudanças somem no reboot — pode experimentar à vontade.'],
        solution: '<div class="code"><pre>sudo ip addr add 192.168.50.10/24 dev eth0\nip -br a\nsudo ip addr del 192.168.50.10/24 dev eth0\nsudo ip route add 10.99.0.0/24 via 10.0.2.1\nip route\nsudo ip route del 10.99.0.0/24\nsudo ip link set eth0 down\nping -c 1 example.com\nsudo ip link set eth0 up\nping -c 1 example.com</pre></div>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const eth = m.interfaces.find(i => i.name !== 'lo');
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /ip\s+addr\s+add/), 'Adicione um endereço com <code>ip addr add</code>.'],
            [() => H.usedCommand(ctx, /ip\s+addr\s+del/), 'Remova o endereço com <code>ip addr del</code>.'],
            [() => H.usedCommand(ctx, /ip\s+route\s+add/), 'Adicione uma rota com <code>ip route add</code>.'],
            [() => H.usedCommand(ctx, /ip\s+link\s+set\s+\w+\s+down/), 'Derrube a interface para ver o efeito.'],
            [eth.state !== 'DOWN', 'A interface <code>eth0</code> ficou derrubada — levante-a de volta com <code>sudo ip link set eth0 up</code>.'],
            [!(eth.extras || []).length, 'Sobrou um endereço extra na interface — remova-o com <code>ip addr del</code>.'],
            [!m.routes.some(r => r.dst === '10.99.0.0/24'), 'A rota de teste ainda está na tabela — remova com <code>sudo ip route del 10.99.0.0/24</code>.']
          ]);
        }
      },
      {
        id: 't9-2-q', kind: 'quiz', title: 'Conceito: o endereço que sumiu no reboot',
        body: [
          { p: 'Você roda <code>sudo ip addr add 192.168.50.10/24 dev eth0</code> em um servidor Ubuntu, confirma com <code>ip -br a</code> que o endereço apareceu, e encerra a sessão satisfeito. No dia seguinte, depois de uma manutenção que reiniciou a máquina, o endereço sumiu. O que faltou?' }
        ],
        options: [
          { text: 'O <code>ip addr add</code> muda a configuração <strong>agora</strong>, na memória — para sobreviver ao boot, precisava estar também no Netplan, com <code>sudo netplan apply</code> depois.', correct: true },
          { text: 'Nada — o <code>ip addr add</code> já é permanente; o problema foi outra coisa, como uma falha de hardware.', why: 'O comando não grava em disco coisa nenhuma: é justamente por ser assim que ele é seguro para testar.' },
          { text: 'Faltou reiniciar o serviço de rede logo depois do <code>ip addr add</code>, para "salvar" a configuração.', why: 'O <code>ip addr add</code> já aplica na hora, e reiniciar serviço nenhum grava a mudança em arquivo — persistência é assunto do Netplan, não de reiniciar algo.' },
          { text: 'O <code>ip addr add</code> só funciona dentro de containers; em um servidor físico ou de nuvem ele não tem efeito real.', why: 'O comando funciona igual em qualquer Linux com o pacote <code>iproute2</code>; o <code>ip -br a</code> confirmando o endereço já mostra que ele fez efeito.' }
        ],
        explain: 'Mudar "agora" e mudar "para sempre" são coisas diferentes no Linux: <code>ip</code> resolve a primeira, e um arquivo (Netplan no Ubuntu Server, <code>/etc/network/interfaces</code> no Debian clássico, e por aí vai conforme a distribuição) resolve a segunda. Testar com <code>ip</code> antes de tornar permanente é, inclusive, a prática recomendada — reduz o risco de travar a rede com uma configuração errada gravada em disco.'
      },
      {
        id: 't9-2-b', kind: 'desafio', title: 'Documente a configuração de rede',
        body: [
          { p: 'Gere <code>~/rede.txt</code> com exatamente quatro linhas, nesta ordem e neste formato, com os valores reais desta máquina:' },
          {
            code: [
              'ip: 10.0.2.15/24',
              'gateway: 10.0.2.1',
              'interface: eth0',
              'dns: 127.0.0.53'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'Cada valor deve ser extraído com comandos, não digitado. Uma dica de método: <code>ip -br a</code> e <code>ip route</code> dão as três primeiras; o DNS sai do <code>/etc/resolv.conf</code>.' }
        ],
        hints: [
          'O <code>awk</code> é seu amigo aqui: <code>ip route | awk \'/default/ {print $3}\'</code> devolve o gateway.',
          'Para o IP com máscara: <code>ip -br a show eth0 | awk \'{print $3}\'</code>.',
          'DNS: <code>grep ^nameserver /etc/resolv.conf | awk \'{print $2}\' | head -1</code>.'
        ],
        solution: '<div class="code"><pre>echo "ip: $(ip -br a show eth0 | awk \'{print $3}\')" &gt; ~/rede.txt\necho "gateway: $(ip route | awk \'/^default/ {print $3}\')" &gt;&gt; ~/rede.txt\necho "interface: $(ip route | awk \'/^default/ {print $5}\')" &gt;&gt; ~/rede.txt\necho "dns: $(grep ^nameserver /etc/resolv.conf | awk \'{print $2}\' | head -1)" &gt;&gt; ~/rede.txt\ncat ~/rede.txt</pre></div><p style="margin-top:8px">Um arquivo desses, gerado automaticamente em cada servidor, é o inventário de rede que ninguém tem quando precisa.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/rede.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/rede.txt</code> ainda não existe.' };
          const m = ctx.machine || ctx.sh.m;
          const l = c.split('\n').map(x => x.trim()).filter(x => x);
          const val = (k) => { const li = l.find(x => x.startsWith(k + ':')); return li ? li.slice(k.length + 1).trim() : null; };
          const eth = m.interfaces.find(i => i.name !== 'lo');
          const gw = (m.routes.find(r => r.dst === 'default') || {}).via;
          return LX.H.checkAll([
            [l.length === 4, `O arquivo deve ter exatamente 4 linhas; tem ${l.length}.`],
            [l[0].startsWith('ip:') && l[1].startsWith('gateway:') && l[2].startsWith('interface:') && l[3].startsWith('dns:'),
              'As linhas devem estar na ordem <code>ip:</code>, <code>gateway:</code>, <code>interface:</code>, <code>dns:</code>.'],
            [val('ip') === eth.ipv4, `O IP deve ser <code>${eth.ipv4}</code> (com a máscara); está "${val('ip')}".`],
            [val('gateway') === gw, `O gateway deve ser <code>${gw}</code>; está "${val('gateway')}".`],
            [val('interface') === eth.name, `A interface deve ser <code>${eth.name}</code>; está "${val('interface')}".`],
            [/^\d+\.\d+\.\d+\.\d+$/.test(val('dns') || ''), `O DNS deve ser um endereço IP; está "${val('dns')}".`]
          ]);
        }
      }
    ]
  });

  /* ============================== 9.3 ============================== */
  LX.lesson('m09', {
    id: 'l9-3', n: '9.3', title: 'DNS: do nome ao endereço',
    goal: 'Saber exatamente em que ordem um nome é resolvido, testar cada etapa isoladamente e reconhecer os sintomas de DNS quebrado.',
    body: [
      { p: 'DNS é o suspeito favorito de todo problema de rede — e com razão: é a etapa com mais peças móveis.' },
      {
        ascii: `resolver "api.exemplo.com"

  1. /etc/hosts        ← tem prioridade sobre TUDO
  2. cache local       ← systemd-resolved (127.0.0.53)
  3. servidor DNS      ← o de /etc/resolv.conf
        └─ pergunta aos servidores raiz, .com, exemplo.com...
  4. resposta em cache por TTL segundos`
      },
      { p: 'A ordem entre <code>hosts</code> e DNS é configurável em <code>/etc/nsswitch.conf</code>, na linha <code>hosts:</code> — mas em servidores praticamente ninguém muda o padrão, que consulta os arquivos primeiro.' },
      { code: ['$ cat /etc/hosts', '$ cat /etc/resolv.conf', '$ grep ^hosts /etc/nsswitch.conf 2>/dev/null || echo "hosts: files dns"'] },

      { h2: 'Consultar o DNS diretamente' },
      { cmd: 'dig' },
      {
        code: [
          '$ dig example.com +short',
          '$ dig example.com',
          '$ dig @8.8.8.8 terminalis.dev +short',
          '$ host example.com',
          '$ resolvectl query example.com'
        ]
      },
      {
        table: {
          head: ['Comando', 'Quando usar'],
          rows: [
            ['<code>dig NOME +short</code>', 'só a resposta — perfeito para scripts'],
            ['<code>dig NOME</code>', 'resposta completa: TTL, servidor consultado, tempo'],
            ['<code>dig @SERVIDOR NOME</code>', '<strong>testar um servidor específico</strong>, ignorando o configurado'],
            ['<code>dig NOME MX</code> / <code>NS</code> / <code>TXT</code>', 'outros tipos de registro'],
            ['<code>dig -x IP</code>', 'DNS reverso: do IP para o nome'],
            ['<code>host</code> / <code>nslookup</code>', 'versões resumidas, boas para uma consulta rápida'],
            ['<code>resolvectl query</code>', 'passa pelo resolvedor do systemd — é o que a aplicação realmente usa']
          ]
        }
      },
      {
        box: 'key', label: 'O teste que separa o problema em dois', body: [
          { p: 'Quando um nome não resolve, compare:' },
          { code: ['$ dig meusite.com +short', '$ dig @8.8.8.8 meusite.com +short'], run: false },
          { p: 'Se o segundo funciona e o primeiro não, o problema é <strong>o seu servidor DNS</strong> (ou o <code>resolv.conf</code>). Se nenhum funciona, o problema é <strong>do domínio</strong> — nome errado, zona não publicada, registro removido.' }
        ]
      },

      { h2: '/etc/hosts: o atalho e a armadilha' },
      { p: 'Uma linha em <code>/etc/hosts</code> vence qualquer DNS. Isso é ótimo para testar antes de mudar o DNS de verdade — e é péssimo quando alguém deixa a linha lá e esquece.' },
      {
        code: [
          '$ echo "203.0.113.99 intranet.local" | sudo tee -a /etc/hosts > /dev/null',
          '$ ping -c 1 intranet.local | head -2',
          '$ getent hosts intranet.local'
        ]
      },
      { p: 'O <code>getent hosts</code> é a forma correta de perguntar "como <em>o sistema</em> resolve este nome", porque passa por toda a cadeia (arquivos, cache e DNS) — enquanto o <code>dig</code> fala direto com o servidor DNS e <strong>ignora o <code>/etc/hosts</code></strong>.' },
      {
        box: 'warn', label: 'Por que "o dig funciona mas a aplicação não"', body: [
          { p: 'Esse é o desencontro mais comum do módulo. O <code>dig</code> conversa com o servidor DNS diretamente; a aplicação usa a biblioteca do sistema, que consulta <code>/etc/hosts</code>, <code>nsswitch.conf</code> e o cache antes. Quando os dois discordam, a resposta que vale é a do <code>getent hosts</code>.' }
        ]
      },

      { h2: 'Quando o DNS está quebrado' },
      { p: 'O sintoma clássico: <strong>ping por IP funciona, ping por nome não</strong>. Reproduza:' },
      {
        code: [
          '$ echo "nameserver 10.1.1.1" | sudo tee /etc/resolv.conf > /dev/null',
          '$ ping -c 1 example.com',
          '$ ping -c 1 -q 185.125.190.21 | tail -2',
          '$ echo "nameserver 127.0.0.53" | sudo tee /etc/resolv.conf > /dev/null',
          '$ ping -c 1 -q example.com | tail -2'
        ]
      },
      {
        box: 'note', body: [
          { p: 'Em máquinas com <code>systemd-resolved</code> (o padrão no Ubuntu), o <code>/etc/resolv.conf</code> é um link para um arquivo gerado automaticamente e aponta para <code>127.0.0.53</code> — o resolvedor local. Editar o arquivo à mão funciona até o próximo <code>netplan apply</code>, que o sobrescreve. O lugar certo de configurar os servidores é o Netplan (ou o <code>resolved.conf</code>).' }
        ]
      }
    ],
    tasks: [
      {
        id: 't9-3-a', kind: 'guiado', title: 'Consulte de todas as formas',
        body: [
          { p: 'Compare <code>dig</code>, <code>getent</code> e <code>/etc/hosts</code>.' },
          {
            code: [
              '$ dig example.com +short',
              '$ dig @8.8.8.8 terminalis.dev +short',
              '$ getent hosts example.com',
              '$ echo "203.0.113.99 intranet.local" | sudo tee -a /etc/hosts > /dev/null',
              '$ getent hosts intranet.local',
              '$ dig intranet.local +short',
              '$ resolvectl query example.com'
            ]
          },
          { p: 'Repare no contraste das duas últimas linhas antes do <code>resolvectl</code>: o <code>getent</code> acha o nome do <code>/etc/hosts</code>; o <code>dig</code> não, porque fala só com o DNS.' }
        ],
        hints: ['<code>tee -a</code> acrescenta ao final do arquivo em vez de sobrescrever.'],
        solution: '<div class="code"><pre>dig example.com +short\ndig @8.8.8.8 terminalis.dev +short\ngetent hosts example.com\necho "203.0.113.99 intranet.local" | sudo tee -a /etc/hosts &gt; /dev/null\ngetent hosts intranet.local\ndig intranet.local +short\nresolvectl query example.com</pre></div>',
        check: async (ctx) => {
          const hosts = H.read(ctx, '/etc/hosts') || '';
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /dig\s+/), 'Consulte um nome com <code>dig</code>.'],
            [() => H.usedCommand(ctx, /dig\s+@/), 'Teste um servidor DNS específico com <code>dig @8.8.8.8 ...</code>.'],
            [() => H.usedCommand(ctx, /getent\s+hosts/), 'Compare com <code>getent hosts</code>, que passa por toda a cadeia.'],
            [/intranet\.local/.test(hosts), 'Acrescente a linha de <code>intranet.local</code> ao <code>/etc/hosts</code>.']
          ]);
        }
      },
      {
        id: 't9-3-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Uma aplicação em produção falha com <code>Could not resolve host: db.interno</code>. Você testa no mesmo servidor:' },
          {
            code: [
              '$ dig db.interno +short',
              '10.0.5.20',
              '$ getent hosts db.interno',
              '(sem saída)'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'O que explica a diferença?' }
        ],
        options: [
          { text: 'A resolução do sistema (nsswitch/resolved/cache) está quebrada — o <code>dig</code> fala direto com o DNS e não usa esse caminho.', correct: true },
          { text: 'O domínio <code>db.interno</code> não existe.', why: 'O <code>dig</code> obteve uma resposta válida: o registro existe.' },
          { text: 'A aplicação está com o nome escrito errado.', why: 'O mesmo nome foi testado nos dois comandos, com resultados diferentes.' },
          { text: 'O firewall bloqueia a porta 53.', why: 'Se a porta 53 estivesse bloqueada, o próprio <code>dig</code> falharia.' }
        ],
        explain: 'A aplicação usa a mesma cadeia do <code>getent</code>. Caminhos a investigar: <code>/etc/nsswitch.conf</code> com a linha <code>hosts:</code> alterada, o <code>systemd-resolved</code> parado (<code>systemctl status systemd-resolved</code>), ou um <code>/etc/resolv.conf</code> apontando para <code>127.0.0.53</code> sem que o serviço esteja de pé. A lição geral: <strong>teste com a mesma cadeia que a aplicação usa</strong>.'
      },
      {
        id: 't9-3-b', kind: 'desafio', title: 'Aponte um nome para outro servidor',
        body: [
          { p: 'A equipe vai migrar o site <code>terminalis.dev</code> para um servidor novo e quer testar <strong>antes</strong> de mexer no DNS público.' },
          { p: 'O servidor novo é o <code>web01</code>, que está na rede local. Sua tarefa:' },
          {
            ul: [
              'descubra o IP do <code>web01</code> (ele resolve pelo DNS interno);',
              'faça <code>terminalis.dev</code> resolver para esse IP <strong>somente nesta máquina</strong>, sem alterar nenhum servidor DNS;',
              'comprove com <code>getent hosts terminalis.dev</code>, que deve devolver o IP do <code>web01</code>.'
            ]
          },
          { p: 'Requisito: o <code>dig terminalis.dev +short</code> deve continuar devolvendo o IP <strong>antigo</strong> — prova de que você não mexeu no DNS, só na resolução local.' }
        ],
        hints: [
          'Resolver só nesta máquina, com prioridade sobre o DNS: existe um arquivo para isso.',
          'Descubra o IP com <code>dig web01 +short</code> ou <code>getent hosts web01</code>, e acrescente a linha ao <code>/etc/hosts</code>.',
          '<code>IP=$(dig web01 +short)</code>; <code>echo "$IP terminalis.dev" | sudo tee -a /etc/hosts</code>'
        ],
        solution: '<div class="code"><pre>dig web01 +short\nIP=$(dig web01 +short)\necho "$IP terminalis.dev" | sudo tee -a /etc/hosts &gt; /dev/null\ngetent hosts terminalis.dev\ndig terminalis.dev +short\ntail -2 /etc/hosts</pre></div><p style="margin-top:8px">É assim que se testa uma migração antes de mudar o DNS público: a sua máquina enxerga o servidor novo, o resto do mundo continua no antigo. Só não esqueça de remover a linha depois — um <code>/etc/hosts</code> esquecido gera horas de confusão meses adiante.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const hosts = H.read(ctx, '/etc/hosts') || '';
          const ipWeb = m.dns.get('web01');
          if (!ipWeb) return { ok: false, msg: 'Este ambiente não tem o host <code>web01</code> — recarregue a aula.' };
          const linha = hosts.split('\n').map(x => x.replace(/#.*/, '').trim()).filter(Boolean)
            .find(l => l.split(/\s+/).slice(1).includes('terminalis.dev'));
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /dig\s+web01|getent\s+hosts\s+web01|host\s+web01/), 'Descubra o IP do <code>web01</code> com <code>dig</code>, <code>host</code> ou <code>getent</code>.'],
            [!!linha, 'Falta a linha de <code>terminalis.dev</code> no <code>/etc/hosts</code>.'],
            [!!linha && linha.split(/\s+/)[0] === ipWeb, `A linha do <code>/etc/hosts</code> deve apontar para o IP do <code>web01</code> (<code>${ipWeb}</code>); está apontando para "${linha ? linha.split(/\s+/)[0] : '?'}".`],
            [m.dns.get('terminalis.dev') !== ipWeb, 'O DNS não deveria ter sido alterado — o desafio pede a mudança só nesta máquina.'],
            [() => H.usedCommand(ctx, /getent\s+hosts\s+terminalis/), 'Comprove o resultado com <code>getent hosts terminalis.dev</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 9.4 ============================== */
  LX.lesson('m09', {
    id: 'l9-4', n: '9.4', title: 'Portas, sockets e conexões',
    goal: 'Responder com precisão quem está escutando onde, e por que um serviço só responde em localhost.',
    body: [
      { p: 'Uma porta é o endereço da <strong>aplicação</strong> dentro da máquina. O par (IP, porta) identifica um serviço; o par de pares identifica uma conexão.' },
      { cmd: 'ss' },
      {
        cheat: [
          ['<code>ss -tuln</code>', 'o comando padrão: TCP + UDP, escutando, sem resolver nomes'],
          ['<code>ss -tlnp</code>', 'TCP escutando <strong>com o processo dono</strong> (precisa de sudo)'],
          ['<code>ss -tn</code>', 'conexões estabelecidas'],
          ['<code>ss -s</code>', 'resumo por protocolo'],
          ['<code>ss -tlnp \'sport = :22\'</code>', 'filtra por porta']
        ]
      },
      { p: 'As letras: <code>-t</code> TCP, <code>-u</code> UDP, <code>-l</code> apenas escutando, <code>-n</code> numérico (não resolve nomes — muito mais rápido), <code>-p</code> mostra o processo, <code>-a</code> tudo.' },
      { code: ['$ ss -tuln', '$ sudo ss -tlnp', '$ sudo lsof -i :22'] },

      { h2: 'A coluna que mais engana: o endereço local' },
      {
        table: {
          head: ['Local Address', 'Significa', 'Consequência'],
          rows: [
            ['<code>0.0.0.0:80</code>', 'escuta em <strong>todas</strong> as interfaces IPv4', 'acessível de fora'],
            ['<code>[::]:80</code>', 'todas as interfaces IPv6 (e normalmente IPv4 também)', 'acessível de fora'],
            ['<code>127.0.0.1:80</code>', '<strong>só</strong> loopback', '<code>curl localhost</code> funciona, de fora dá <em>connection refused</em>'],
            ['<code>10.0.2.15:80</code>', 'só naquela interface', 'acessível apenas por aquela rede']
          ]
        }
      },
      {
        box: 'key', label: 'O bug de configuração mais comum em servidores', body: [
          { p: 'Um serviço configurado para <code>bind 127.0.0.1</code> funciona perfeitamente nos seus testes locais e <strong>recusa</strong> qualquer conexão vinda da rede. O sintoma é exatamente o <code>Connection refused</code> da aula 9.1 — e a solução não é firewall nem rota: é trocar o endereço de bind para <code>0.0.0.0</code> na configuração da aplicação.' },
          { p: 'A recíproca também é verdadeira: bancos de dados devem ficar em <code>127.0.0.1</code> quando só a aplicação local os acessa. Deixar um PostgreSQL em <code>0.0.0.0</code> por descuido é um clássico de exposição acidental.' }
        ]
      },

      { h2: 'Testar uma porta' },
      { cmd: 'nc' },
      {
        code: [
          '$ nc -zv terminalis.dev 80',
          '$ nc -zv terminalis.dev 8080',
          '$ curl -sI http://terminalis.dev | head -3',
          '$ curl -s -o /dev/null -w "%{http_code}\\n" http://terminalis.dev'
        ]
      },
      { p: 'O <code>nc -z</code> (zero I/O) só testa se a porta aceita conexão — é o teste mais puro de "chego até lá?", sem envolver protocolo de aplicação. O <code>-v</code> mostra o resultado.' },
      {
        table: {
          head: ['Ferramenta', 'Testa', 'Use quando'],
          rows: [
            ['<code>ping</code>', 'a máquina responde ICMP', 'primeiro contato — mas ICMP pode ser bloqueado sem que o serviço esteja fora'],
            ['<code>nc -zv HOST PORTA</code>', 'a porta aceita conexão TCP', 'separar "rede" de "aplicação"'],
            ['<code>curl -I</code>', 'a aplicação HTTP responde', 'quando a porta abre mas o site não carrega'],
            ['<code>ss -tlnp</code>', 'quem escuta <strong>aqui</strong>', 'do lado do servidor']
          ]
        }
      },
      { p: 'E as portas que você precisa reconhecer de cabeça:' },
      {
        cheat: [
          ['22', 'SSH'], ['53', 'DNS'], ['80', 'HTTP'], ['443', 'HTTPS'],
          ['3306', 'MySQL/MariaDB'], ['5432', 'PostgreSQL'], ['6379', 'Redis'],
          ['27017', 'MongoDB'], ['8080', 'HTTP alternativo (aplicações)'], ['25 / 587', 'SMTP']
        ]
      },
      {
        box: 'old', body: [
          { p: 'O <code>netstat</code> faz parte do <code>net-tools</code>, obsoleto e nem sempre instalado. O <code>ss</code> é mais rápido (lê direto do kernel via netlink) e é o padrão atual. As opções são quase as mesmas: <code>netstat -tlnp</code> → <code>ss -tlnp</code>. <strong>Aprenda o <code>ss</code>.</strong>' }
        ]
      }
    ],
    tasks: [
      {
        id: 't9-4-a', kind: 'guiado', title: 'Quem escuta o quê',
        body: [
          { p: 'Liste as portas, identifique os processos e teste uma conexão.' },
          {
            code: [
              '$ ss -tuln',
              '$ sudo ss -tlnp',
              '$ sudo lsof -i :22',
              '$ nc -zv terminalis.dev 80',
              '$ nc -zv terminalis.dev 8080',
              '$ curl -s -o /dev/null -w "%{http_code}\\n" http://terminalis.dev'
            ]
          },
          { p: 'Compare as duas linhas de <code>nc</code>: uma porta que aceita e outra que recusa.' }
        ],
        hints: ['O <code>-p</code> do <code>ss</code> só mostra o processo quando você é root.'],
        solution: '<div class="code"><pre>ss -tuln\nsudo ss -tlnp\nsudo lsof -i :22\nnc -zv terminalis.dev 80\nnc -zv terminalis.dev 8080\ncurl -s -o /dev/null -w "%{http_code}\\n" http://terminalis.dev</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ss\s+-[a-z]*t[a-z]*l/), 'Liste as portas em escuta com <code>ss -tuln</code>.'],
          [() => H.usedCommand(ctx, /ss\s+-[a-z]*p|lsof\s+-i/), 'Descubra o processo dono da porta com <code>sudo ss -tlnp</code> ou <code>lsof -i</code>.'],
          [() => H.usedCommand(ctx, /nc\s+-z/), 'Teste uma porta com <code>nc -zv</code>.'],
          [() => H.usedCommand(ctx, /curl/), 'Teste a aplicação HTTP com <code>curl</code>.']
        ])
      },
      {
        id: 't9-4-q', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Do lado do servidor, <code>ss -tlnp</code> mostra:' },
          { code: ['LISTEN  0  128  127.0.0.1:5000  0.0.0.0:*  users:(("gunicorn",pid=1422,fd=5))'], run: false, mixed: false, lang: 'text' },
          { p: 'De outra máquina da mesma rede, um <code>curl http://10.0.2.15:5000</code> vai:' }
        ],
        options: [
          { text: 'Falhar com <code>Connection refused</code>: o serviço só aceita conexões pelo loopback.', correct: true },
          { text: 'Funcionar normalmente: a porta 5000 está aberta.', why: 'A porta está aberta apenas em <code>127.0.0.1</code>, que não é alcançável de outra máquina.' },
          { text: 'Dar timeout, porque o firewall está bloqueando.', why: 'Não há firewall envolvido; a própria máquina recusa, o que gera "refused", não timeout.' },
          { text: 'Retornar HTTP 403.', why: 'Um 403 viria da aplicação — mas nem chega a haver conexão.' }
        ],
        explain: 'A correção é no <strong>bind</strong> da aplicação: <code>gunicorn --bind 0.0.0.0:5000</code>. O padrão de produção, porém, costuma ser outro: deixar a aplicação em <code>127.0.0.1</code> e colocar um proxy reverso (nginx) escutando em <code>0.0.0.0:443</code> e repassando para ela. Assim a aplicação nunca fica exposta diretamente.'
      },
      {
        id: 't9-4-b', kind: 'desafio', title: 'Inventário de portas abertas',
        body: [
          { p: 'Gere <code>~/portas.txt</code> com a lista de <strong>portas TCP em escuta</strong> nesta máquina, uma por linha, apenas o <strong>número</strong>, ordenadas numericamente e sem repetição.' },
          { p: 'Exemplo do formato esperado (os números serão os desta máquina):' },
          { code: ['22', '53'], run: false, mixed: false, lang: 'text' },
          { p: 'Nada de cabeçalho, nada de endereço, nada de nome de processo — só os números.' }
        ],
        hints: [
          'Comece com <code>ss -tln</code> e observe qual coluna tem o endereço local.',
          'O número da porta vem depois do último <code>:</code> — o <code>awk</code> com <code>-F:</code> ou o <code>cut</code> resolvem.',
          '<code>ss -tln | awk \'NR&gt;1 {print $4}\' | awk -F: \'{print $NF}\' | sort -n -u &gt; ~/portas.txt</code>'
        ],
        solution: '<div class="code"><pre>ss -tln | awk \'NR&gt;1 {print $4}\' | awk -F: \'{print $NF}\' | sort -n -u &gt; ~/portas.txt\ncat ~/portas.txt</pre></div><p style="margin-top:8px">Esse inventário, comparado entre servidores ou ao longo do tempo, é uma das formas mais simples de detectar que algo novo (e possivelmente indesejado) começou a escutar na máquina.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/portas.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/portas.txt</code> ainda não existe.' };
          const linhas = c.split('\n').filter(l => l.trim());
          const nums = linhas.map(l => l.trim());
          const m = ctx.machine || ctx.sh.m;
          const esperadas = Array.from(new Set(m.listeners.filter(l => l.proto === 'tcp').map(l => String(l.port)))).sort((a, b) => a - b);
          return LX.H.checkAll([
            [linhas.length > 0, 'O arquivo está vazio.'],
            [nums.every(n => /^\d+$/.test(n)), 'Cada linha deve conter <strong>apenas</strong> o número da porta.'],
            [new Set(nums).size === nums.length, 'Há portas repetidas — use <code>sort -u</code>.'],
            [nums.every((n, i) => i === 0 || +nums[i - 1] <= +n), 'As portas devem estar em ordem numérica crescente (<code>sort -n</code>).'],
            [esperadas.every(p => nums.includes(p)), `Falta alguma porta em escuta. Esperadas: ${esperadas.join(', ')}.`],
            [nums.every(n => esperadas.includes(n)), 'Há portas na lista que não estão realmente em escuta — filtre apenas TCP em modo LISTEN.']
          ]);
        }
      }
    ]
  });

  /* ============================== 9.5 ============================== */
  LX.lesson('m09', {
    id: 'l9-5', n: '9.5', title: 'Firewall com ufw',
    goal: 'Abrir e fechar portas com segurança, entendendo o que cada regra faz — e sem se trancar para fora do servidor.',
    body: [
      { p: 'O firewall do Linux é o <strong>netfilter</strong>, dentro do kernel. O que muda é a ferramenta que escreve as regras nele:' },
      {
        table: {
          head: ['Ferramenta', 'Situação'],
          rows: [
            ['<code>iptables</code>', 'a clássica; ainda funciona, hoje traduzida para nftables'],
            ['<code>nftables</code> (<code>nft</code>)', 'o backend atual do kernel'],
            ['<code>ufw</code>', '<strong>camada simples</strong> por cima — o padrão no Ubuntu'],
            ['<code>firewalld</code>', 'equivalente ao ufw no mundo RHEL/Fedora'],
            ['grupos de segurança', 'na nuvem, muitas vezes o firewall que <em>de fato</em> importa está fora da máquina']
          ]
        }
      },
      { cmd: 'ufw' },
      {
        cheat: [
          ['<code>ufw status verbose</code>', 'estado e políticas padrão'],
          ['<code>ufw status numbered</code>', 'regras <strong>com número</strong> — necessário para apagar'],
          ['<code>ufw allow 22/tcp</code>', 'libera uma porta'],
          ['<code>ufw allow OpenSSH</code>', 'libera por perfil de aplicação'],
          ['<code>ufw allow from 10.0.2.0/24 to any port 22</code>', 'libera só para uma origem'],
          ['<code>ufw deny 23</code>', 'bloqueia (descarta em silêncio)'],
          ['<code>ufw reject 23</code>', 'bloqueia <em>respondendo</em> que recusou'],
          ['<code>ufw delete 3</code>', 'apaga a regra número 3'],
          ['<code>ufw enable</code> / <code>disable</code>', 'liga / desliga'],
          ['<code>ufw reset</code>', 'apaga tudo e volta ao padrão']
        ]
      },
      {
        box: 'warn', label: 'A regra de ouro', body: [
          { p: 'O padrão do ufw é <strong>negar tudo que entra</strong>. Se você habilitar o firewall em um servidor remoto sem antes liberar o SSH, <strong>perde o acesso na hora</strong> e só recupera pelo console do provedor.' },
          { p: 'A ordem é sempre: primeiro <code>sudo ufw allow 22/tcp</code>, depois <code>sudo ufw enable</code>. Sem exceção.' }
        ]
      },
      {
        code: [
          '$ sudo ufw status',
          '$ sudo ufw allow 22/tcp',
          '$ sudo ufw allow 80/tcp',
          '$ sudo ufw enable',
          '$ sudo ufw status numbered'
        ]
      },
      { p: 'A saída numerada é o que permite remover regras com precisão. Sem <code>numbered</code>, você teria que repetir a regra exata no <code>delete</code>.' },
      { code: ['$ sudo ufw delete 2', '$ sudo ufw status numbered'] },

      { h2: 'Entrada e saída' },
      { p: 'Por padrão o ufw bloqueia entrada e permite saída. Restringir a saída é menos comum, mas aparece em ambientes rígidos:' },
      {
        code: [
          '$ curl -sI http://terminalis.dev | head -1',
          '$ sudo ufw deny out 80/tcp',
          '$ curl -sI http://terminalis.dev 2>&1 | head -1',
          '$ sudo ufw status numbered'
        ]
      },
      { p: 'Repare no erro: <strong>timeout</strong>, não "refused". Firewall que descarta pacotes produz timeout — a assinatura da aula 9.1. Desfaça a regra antes de seguir:' },
      { code: ['$ sudo ufw status numbered', '$ sudo ufw delete 2 2>/dev/null || true', '$ curl -sI http://terminalis.dev | head -1'] },

      { h2: 'Limitar a origem' },
      { p: 'Abrir a porta 22 para o mundo inteiro é o convite padrão para tentativas de força bruta. Melhor abrir apenas para quem precisa:' },
      {
        code: [
          '$ sudo ufw allow from 10.0.2.0/24 to any port 22',
          '$ sudo ufw status numbered'
        ]
      },
      {
        box: 'tip', body: [
          { p: 'Em servidores expostos, a combinação usual é: SSH liberado apenas para a VPN ou para IPs conhecidos, autenticação só por chave (módulo 10), e <code>fail2ban</code> para bloquear temporariamente quem insiste. Firewall sozinho não é a única camada.' }
        ]
      },
      { code: ['$ sudo ufw disable', '$ sudo ufw status'] },
      {
        box: 'note', body: [
          { p: 'Em máquinas de nuvem, lembre-se de que existem <strong>dois</strong> firewalls: o da instância (ufw) e o do provedor (security group). Uma porta liberada no ufw e fechada no grupo de segurança continua inacessível — e a mensagem, do lado de fora, é timeout.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't9-5-a', kind: 'guiado', title: 'Ligue o firewall na ordem certa',
        body: [
          { p: 'Libere o SSH <strong>antes</strong> de ativar, confira, apague uma regra e desative ao final.' },
          {
            code: [
              '$ sudo ufw status',
              '$ sudo ufw allow 22/tcp',
              '$ sudo ufw allow 80/tcp',
              '$ sudo ufw enable',
              '$ sudo ufw status numbered',
              '$ sudo ufw delete 2',
              '$ sudo ufw status numbered',
              '$ sudo ufw disable'
            ]
          }
        ],
        hints: ['O número da regra vem da saída de <code>ufw status numbered</code> — confira antes de apagar.'],
        solution: '<div class="code"><pre>sudo ufw status\nsudo ufw allow 22/tcp\nsudo ufw allow 80/tcp\nsudo ufw enable\nsudo ufw status numbered\nsudo ufw delete 2\nsudo ufw status numbered\nsudo ufw disable</pre></div>',
        check: async (ctx) => {
          const fw = (ctx.machine || ctx.sh.m).firewall;
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /ufw\s+allow\s+22/), 'Libere o SSH com <code>ufw allow 22/tcp</code>.'],
            [() => H.usedCommand(ctx, /ufw\s+enable/), 'Ative o firewall com <code>ufw enable</code>.'],
            [() => H.usedCommand(ctx, /ufw\s+status\s+numbered/), 'Veja as regras numeradas com <code>ufw status numbered</code>.'],
            [() => H.usedCommand(ctx, /ufw\s+delete/), 'Apague uma regra pelo número com <code>ufw delete N</code>.'],
            [fw.enabled === false, 'Desative o firewall ao final do exercício (<code>sudo ufw disable</code>).']
          ]);
        }
      },
      {
        id: 't9-5-q', kind: 'quiz', title: 'Conceito: a ordem que tranca (ou não) o servidor',
        body: [
          { p: 'Um administrador conecta por SSH a um servidor novo, na nuvem, e roda direto <code>sudo ufw enable</code> — sem antes liberar nenhuma porta. O que acontece?' }
        ],
        options: [
          { text: 'A sessão SSH cai na hora e não é possível reconectar até acessar pelo console fora de banda do provedor — o padrão do ufw é negar toda entrada, porta 22 inclusa.', correct: true },
          { text: 'Nada acontece: o ufw sempre libera a porta 22 automaticamente antes de ativar.', why: 'O ufw não abre exceção nenhuma sozinho; a política padrão de entrada é negar tudo, sem esse tipo de proteção automática para SSH.' },
          { text: 'A sessão atual continua normalmente; só novas tentativas de conexão SSH ficam bloqueadas.', why: 'É exatamente esse risco que a aula chama de "perder o acesso na hora" — a regra de ouro existe porque o efeito é imediato, não só para conexões futuras.' },
          { text: 'Só o tráfego HTTP e HTTPS é bloqueado; SSH continua liberado por ser uma porta administrativa.', why: 'O ufw não trata porta nenhuma como especial — toda porta de entrada fica bloqueada até uma regra <code>allow</code> liberá-la, SSH incluído.' }
        ],
        explain: 'A ordem correta é sempre liberar antes: <code>sudo ufw allow 22/tcp</code> e só então <code>sudo ufw enable</code>. Sem exceção — é a regra de ouro da aula.'
      },
      {
        id: 't9-5-b', kind: 'desafio', title: 'Servidor web protegido',
        body: [
          { p: 'Configure o firewall desta máquina para um servidor web público, com acesso administrativo restrito:' },
          {
            ul: [
              '<strong>HTTP (80/tcp)</strong> e <strong>HTTPS (443/tcp)</strong> liberados para qualquer origem;',
              '<strong>SSH (22/tcp)</strong> liberado <strong>somente</strong> para a rede <code>10.0.2.0/24</code>;',
              'nenhuma outra porta liberada;',
              'firewall <strong>ativo</strong> ao final.'
            ]
          },
          { p: 'Cuidado com a ordem — e note que a regra de SSH com origem restrita não é a mesma coisa que <code>ufw allow 22</code>.' }
        ],
        hints: [
          'A sintaxe com origem é <code>ufw allow from REDE to any port PORTA</code>.',
          'Libere tudo o que precisa <strong>antes</strong> de dar <code>enable</code>.',
          '<code>sudo ufw allow from 10.0.2.0/24 to any port 22</code>; <code>sudo ufw allow 80/tcp</code>; <code>sudo ufw allow 443/tcp</code>; <code>sudo ufw enable</code>.'
        ],
        solution: '<div class="code"><pre>sudo ufw allow from 10.0.2.0/24 to any port 22\nsudo ufw allow 80/tcp\nsudo ufw allow 443/tcp\nsudo ufw enable\nsudo ufw status numbered</pre></div><p style="margin-top:8px">Repare que a regra do SSH aparece com a origem na coluna <em>From</em>. Em produção, essa origem seria a faixa da VPN ou o IP fixo do escritório.</p>',
        check: async (ctx) => {
          const fw = (ctx.machine || ctx.sh.m).firewall;
          const r = (porta) => fw.rules.find(x => x.port === String(porta) && x.action === 'allow' && (x.dir || 'in') === 'in');
          const ssh = r(22), http = r(80), https = r(443);
          const extras = fw.rules.filter(x => (x.dir || 'in') === 'in' && !['22', '80', '443'].includes(x.port));
          return LX.H.checkAll([
            [!!http, 'Falta liberar a porta 80 (HTTP).'],
            [!!https, 'Falta liberar a porta 443 (HTTPS).'],
            [!!ssh, 'Falta a regra para a porta 22 (SSH).'],
            [!!ssh && !!ssh.from, 'A regra do SSH deve restringir a origem — use <code>ufw allow from 10.0.2.0/24 to any port 22</code>.'],
            [!!ssh && /^10\.0\.2\.0\/24$/.test(ssh.from || ''), `A origem do SSH deve ser <code>10.0.2.0/24</code>; está "${ssh ? ssh.from : '?'}".`],
            [() => !!http && !!https && !http.from && !https.from, 'HTTP e HTTPS devem ficar liberados para qualquer origem.'],
            [extras.length === 0, `Há regras de entrada além das pedidas (${extras.map(x => x.port).join(', ')}). Remova-as com <code>ufw delete</code>.`],
            [fw.enabled === true, 'O firewall precisa estar ativo ao final (<code>sudo ufw enable</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 9.6 ============================== */
  LX.lesson('m09', {
    id: 'l9-6', n: '9.6', title: 'Diagnóstico: a escada de conectividade',
    goal: 'Localizar em qual degrau a conexão quebra, em vez de testar coisas ao acaso.',
    body: [
      { lede: 'Testar do mais perto para o mais longe transforma um problema difuso em uma resposta em quatro comandos.' },
      {
        ascii: ` 6. a APLICAÇÃO responde certo?   curl -v / logs do serviço
     ↑
 5. a PORTA aceita conexão?       nc -zv host porta
     ↑
 4. o DESTINO responde?           ping host / traceroute
     ↑
 3. o NOME resolve?               getent hosts nome / dig
     ↑
 2. o GATEWAY responde?           ping 10.0.2.1
     ↑
 1. eu tenho IP e rota?           ip a  /  ip route
     ↑
 0. a pilha de rede funciona?     ping 127.0.0.1`
      },
      { p: 'Suba um degrau de cada vez. O primeiro que falhar é onde está o problema — e todos acima dele são irrelevantes até que ele seja resolvido.' },
      {
        code: [
          '$ ping -c 1 -q 127.0.0.1 | tail -2',
          '$ ip -br a && ip route',
          '$ ping -c 1 -q 10.0.2.1 | tail -2',
          '$ getent hosts terminalis.dev',
          '$ ping -c 1 -q terminalis.dev | tail -2',
          '$ nc -zv terminalis.dev 80',
          '$ curl -sI http://terminalis.dev | head -1'
        ]
      },

      { h2: 'A tabela de sintomas' },
      {
        table: {
          head: ['Sintoma', 'Degrau', 'Causa provável'],
          rows: [
            ['<code>ping 127.0.0.1</code> falha', '0', 'algo muito errado no sistema (raríssimo)'],
            ['sem IP, ou IP <code>169.254.x.x</code>', '1', 'DHCP falhou; interface <code>DOWN</code>'],
            ['<code>Network is unreachable</code>', '1', 'sem rota default, ou interface derrubada'],
            ['gateway não responde', '2', 'cabo, VLAN, máscara errada'],
            ['<code>Name or service not known</code>', '3', 'DNS: <code>resolv.conf</code> ou servidor fora'],
            ['ping por IP funciona, por nome não', '3', 'confirma DNS'],
            ['<code>Destination Host Unreachable</code>', '4', 'destino desligado ou rota errada'],
            ['timeout ao conectar', '5', '<strong>firewall</strong> descartando'],
            ['<code>Connection refused</code>', '5', 'nada escutando naquela porta'],
            ['conecta mas erro 502/500', '6', 'a aplicação — leia o log dela']
          ]
        }
      },
      {
        box: 'key', body: [
          { p: 'Duas conclusões que economizam horas:' },
          { ul: [
            '<strong>timeout ≠ refused.</strong> Timeout aponta para firewall ou caminho; refused aponta para o serviço.',
            '<strong>ping falhar não prova nada sozinho.</strong> Muitos servidores e provedores bloqueiam ICMP por política. Se o <code>ping</code> falha mas o <code>nc -zv host 443</code> funciona, a rede está boa.'
          ] }
        ]
      },

      { h2: 'traceroute: onde o caminho morre' },
      { cmd: 'traceroute' },
      { code: ['$ traceroute example.com 2>&1 | head -6'] },
      { p: 'Cada linha é um roteador no caminho. Asteriscos consecutivos a partir de certo ponto sugerem onde o pacote para de avançar — embora muitos roteadores simplesmente não respondam por política, o que gera asteriscos inofensivos no meio do caminho.' },

      { h2: 'Um roteiro para o dia a dia' },
      {
        ol: [
          '<strong>Reproduza</strong> o erro exato e leia a mensagem — ela já indica o degrau.',
          '<strong>Teste do servidor</strong>: <code>curl localhost:PORTA</code>. Se falha aqui, é a aplicação, não a rede.',
          '<strong>Teste o bind</strong>: <code>ss -tlnp | grep PORTA</code>. Está em <code>127.0.0.1</code> ou <code>0.0.0.0</code>?',
          '<strong>Teste de fora</strong>: <code>nc -zv IP PORTA</code> de outra máquina.',
          '<strong>Firewall</strong>: <code>sudo ufw status</code> aqui — e o grupo de segurança, se for nuvem.',
          '<strong>Só então</strong> pense em DNS, proxy e certificado.'
        ]
      }
    ],
    setup: (m) => {
      // cenário: DNS apontando para um servidor que não responde
      try {
        m.fs.writeFile('/etc/resolv.conf',
          '# Gerenciado por systemd-resolved\nnameserver 10.1.1.53\noptions edns0 trust-ad\nsearch lan\n',
          { ctx: m.ctxRoot() });
      } catch (e) { }
    },
    tasks: [
      {
        id: 't9-6-a', kind: 'guiado', title: 'Suba a escada inteira',
        body: [
          { p: 'Rode os sete testes na ordem, mesmo com a rede boa — o objetivo é fixar a sequência.' },
          {
            code: [
              '$ ping -c 1 -q 127.0.0.1 | tail -2',
              '$ ip -br a',
              '$ ip route',
              '$ ping -c 1 -q 10.0.2.1 | tail -2',
              '$ getent hosts terminalis.dev',
              '$ nc -zv terminalis.dev 80',
              '$ curl -sI http://terminalis.dev | head -1'
            ]
          },
          { p: 'Note que um dos degraus vai falhar: este ambiente foi preparado com um problema. Você vai resolvê-lo no desafio.' }
        ],
        hints: ['Se o <code>getent hosts</code> não devolve nada, o problema está no degrau 3.'],
        solution: '<div class="code"><pre>ping -c 1 -q 127.0.0.1 | tail -2\nip -br a\nip route\nping -c 1 -q 10.0.2.1 | tail -2\ngetent hosts terminalis.dev\nnc -zv terminalis.dev 80\ncurl -sI http://terminalis.dev | head -1</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /ping\s+.*127\.0\.0\.1/), 'Degrau 0: <code>ping 127.0.0.1</code>.'],
          [() => H.usedCommand(ctx, /ip\s+r(oute)?\b/), 'Degrau 1: confira IP e rota com <code>ip route</code>.'],
          [() => H.usedCommand(ctx, /ping\s+.*10\.0\.2\.1/), 'Degrau 2: <code>ping</code> no gateway.'],
          [() => H.usedCommand(ctx, /getent\s+hosts|dig\s+/), 'Degrau 3: teste a resolução de nomes.'],
          [() => H.usedCommand(ctx, /nc\s+-z|curl/), 'Degraus 5 e 6: teste a porta e a aplicação.']
        ])
      },
      {
        id: 't9-6-q', kind: 'quiz', title: 'Conceito: o ping não prova nada sozinho',
        body: [
          { p: 'Um monitoramento externo reporta que a porta 443 do seu servidor está inacessível. Do seu notebook, você roda <code>ping meuservidor.com</code> e não recebe resposta nenhuma. É certo concluir que o servidor está fora do ar?' }
        ],
        options: [
          { text: 'Não necessariamente: muitos provedores bloqueiam ICMP por política, então o <code>ping</code> falhar não prova nada sozinho — o teste decisivo é <code>nc -zv meuservidor.com 443</code>.', correct: true },
          { text: 'Sim: se o <code>ping</code> não responde, a rede até o servidor está com problema.', why: 'O <code>ping</code> usa ICMP, que é frequentemente bloqueado por firewall enquanto a porta TCP real continua acessível — a aula lista esse caso explicitamente.' },
          { text: 'Sim, e a causa mais provável é o servidor estar desligado.', why: 'Servidor desligado é só uma das causas possíveis, e o <code>ping</code> bloqueado nem chega a testar isso de forma confiável.' },
          { text: 'Não dá para concluir nada sem rodar <code>traceroute</code> primeiro.', why: 'O <code>traceroute</code> ajuda a achar onde o caminho morre, mas não é o primeiro teste da escada — e já dá para perceber que o <code>ping</code> sozinho é inconclusivo aqui.' }
        ],
        explain: 'A regra da aula: "ping falhar não prova nada sozinho." Se o <code>ping</code> falha mas <code>nc -zv host 443</code> funciona, a rede e a porta estão boas — o problema (se houver) está em outro degrau, como o monitoramento externo testando de um lugar diferente ou um firewall filtrando só ICMP.'
      },
      {
        id: 't9-6-b', kind: 'desafio', title: 'Troubleshooting: o site que sumiu',
        body: [
          { p: 'Um colega avisa: "<em>o servidor perdeu a internet, nada resolve</em>". Antes de acreditar, investigue.' },
          { p: 'Comece pela escada:' },
          {
            code: [
              '$ ping -c 1 -q 127.0.0.1 | tail -2',
              '$ ip -br a && ip route',
              '$ ping -c 1 -q 10.0.2.1 | tail -2',
              '$ ping -c 1 terminalis.dev',
              '$ ping -c 1 -q 203.0.113.42 | tail -2',
              '$ cat /etc/resolv.conf'
            ]
          },
          { p: 'Descubra em qual degrau a coisa quebra e <strong>corrija</strong>. Ao final, o estado exigido é:' },
          {
            ul: [
              '<code>getent hosts terminalis.dev</code> volta a resolver;',
              'o <code>/etc/resolv.conf</code> aponta para um servidor DNS que funciona;',
              'grave em <code>~/diagnostico-rede.txt</code> uma única linha com o <strong>número do degrau</strong> em que estava o problema, no formato <code>degrau: N</code> (use a numeração da escada desta aula: 0 a 6).'
            ]
          },
          { p: 'A pista decisiva está na comparação entre pingar por nome e pingar por IP.' }
        ],
        hints: [
          'Pingar o IP funciona e pingar o nome falha. Pela tabela de sintomas, isso é o degrau 3.',
          'Olhe o <code>/etc/resolv.conf</code>: o <code>nameserver</code> configurado responde? Teste com <code>dig @IP terminalis.dev</code>.',
          'Troque o nameserver por um que funcione — <code>127.0.0.53</code> (o resolvedor local) ou <code>8.8.8.8</code>: <code>echo "nameserver 127.0.0.53" | sudo tee /etc/resolv.conf</code>.'
        ],
        solution: '<div class="code"><pre># o IP responde, o nome não → degrau 3 (DNS)\nping -c 1 -q 203.0.113.42 | tail -2\nping -c 1 terminalis.dev\ncat /etc/resolv.conf          # nameserver 10.1.1.53 — não responde\ndig @10.1.1.53 terminalis.dev +short   # nada\ndig @8.8.8.8 terminalis.dev +short     # resolve\n\n# correção\necho "nameserver 127.0.0.53" | sudo tee /etc/resolv.conf &gt; /dev/null\ngetent hosts terminalis.dev\n\necho "degrau: 3" &gt; ~/diagnostico-rede.txt</pre></div><p style="margin-top:8px">Em uma máquina real com systemd-resolved, a correção definitiva não seria editar o <code>resolv.conf</code> (que é regenerado), e sim configurar os servidores no Netplan e aplicar. Mas a identificação do degrau é a mesma — e é ela que economiza tempo.</p>',
        check: async (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          const c = H.read(ctx, '/home/aluno/diagnostico-rede.txt');
          const conf = H.read(ctx, '/etc/resolv.conf') || '';
          const resolveu = !!m.resolve('terminalis.dev');
          if (c === null) return { ok: false, msg: 'Falta o arquivo <code>~/diagnostico-rede.txt</code> com o degrau identificado.' };
          return LX.H.checkAll([
            [/^\s*degrau:\s*3\s*$/m.test(c), `O arquivo deve conter <code>degrau: N</code> com o degrau correto. O sintoma "IP responde, nome não" aponta para um degrau específico da escada. Conteúdo atual: "${c.trim()}".`],
            [/^\s*nameserver\s+\S+/m.test(conf), 'O <code>/etc/resolv.conf</code> precisa ter uma linha <code>nameserver</code>.'],
            [!/10\.1\.1\.53/.test(conf), 'O <code>nameserver 10.1.1.53</code> continua configurado — ele não responde.'],
            [resolveu, 'A resolução de nomes ainda não funciona: <code>getent hosts terminalis.dev</code> precisa devolver um IP.'],
            [() => H.usedCommand(ctx, /ping|dig|getent/), 'Investigue antes de corrigir: use <code>ping</code>, <code>dig</code> e <code>getent</code> para localizar o degrau.']
          ]);
        }
      }
    ]
  });

})();
