/* =========================================================================
   MÓDULO 25 — Troubleshooting avançado
   Três incidentes em que a causa cruza Linux e Docker: a pista aparece de um
   lado e o conserto está do outro. O método continua o mesmo — estado, log,
   configuração — mas agora ele atravessa a fronteira entre o host e o container.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 25.1 ============================== */
  LX.lesson('m25', {
    id: 'lm25-1', n: '25.1', title: 'A porta que o Docker não tomou',
    goal: 'Diagnosticar um "address already in use" quando nenhum container está usando a porta — o culpado é um processo do próprio host — e liberá-la.',
    setup: (m) => {
      /* um servidor de testes que alguém deixou rodando na porta 8080 */
      const p = new LX.Process({ pid: 741, ppid: 1, cmd: 'python3 -m http.server 8080', comm: 'python3', user: 'root', uid: 0, cpu: 0.1, mem: 0.8 });
      m.processes.set(741, p);
      try { m.listen({ port: 8080, proto: 'tcp', pid: 741, process: 'python3' }); } catch (e) { }
      if (!m.docker) return;
      D.pasta(m, '/home/aluno/api');
      D.arquivo(m, '/home/aluno/api/compose.yaml',
        'services:\n' +
        '  web:\n' +
        '    image: nginx:alpine\n' +
        '    restart: unless-stopped\n' +
        '    ports:\n' +
        '      - "8080:80"\n');
    },
    body: [
      { h2: 'O erro é do Docker, a causa não é' },
      { p: 'Você sobe a stack em <code>~/api</code> e o Compose reclama: <code>address already in use</code> na porta 8080. O reflexo é procurar outro container usando a porta — mas o <code>docker ps</code> não mostra ninguém nela. E aí? A porta é do <strong>host</strong>, não do Docker: qualquer processo da máquina pode tê-la tomado, container ou não.' },
      {
        code: [
          '$ docker compose up -d',
          ' Container api-web-1  Error',
          'Error response from daemon: ... failed to bind host port for 0.0.0.0:8080 ... address already in use',
          '',
          '$ docker ps',
          'CONTAINER ID   IMAGE   ...   (nada usando a 8080)'
        ], run: false
      },
      { p: 'Quando o Docker não é o dono do problema, você desce para as ferramentas do host. Quem está escutando numa porta é uma pergunta de Linux, e a resposta vem do <code>ss</code> — o mesmo que você viu no módulo de processos:' },
      {
        code: [
          '$ ss -tlnp',
          'State    Recv-Q  Local Address:Port   Process',
          'LISTEN   0       0.0.0.0:8080         users:(("python3",pid=741,fd=3))'
        ], run: false
      },
      {
        box: 'key', label: 'A ponte entre os dois mundos', body: [
          { p: 'O <code>ss -tlnp</code> lista o que escuta em cada porta do host <em>e</em> o processo dono, com o PID. Aqui é um <code>python3</code> (PID 741) — provavelmente um servidor de testes que alguém deixou rodando. Não é um container; o <code>docker</code> nunca ia mostrá-lo. Com o PID na mão, liberar a porta é um <code>kill</code>, e a stack sobe.' }
        ]
      },
      {
        box: 'note', label: 'Por que o docker ps enganava', body: [
          { p: 'O <code>docker ps</code> só enxerga containers. Uma porta do host pode ser tomada por um serviço do sistema, um processo solto, outro container de um projeto diferente — e só o primeiro caso apareceria no <code>docker ps</code>. O <code>ss</code> vê todos, porque olha o host inteiro. Quando o erro é de porta e o <code>docker ps</code> está limpo, o próximo passo é sempre o <code>ss</code>.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tm25-1-a', kind: 'guiado', title: 'Ache quem está na porta',
        body: [
          { p: 'A stack em <code>~/api</code> não sobe. Faça o diagnóstico que cruza os dois mundos — sem consertar ainda:' },
          {
            code: [
              '$ cd ~/api',
              '$ docker compose up -d',
              '$ docker ps',
              '$ ss -tlnp'
            ]
          },
          { p: 'O <code>up</code> falha com <code>address already in use</code>; o <code>docker ps</code> não mostra ninguém na 8080; o <code>ss -tlnp</code> revela o <code>python3</code> (PID 741) escutando ali. O culpado é do host, não do Docker.' }
        ],
        hints: ['Depois do erro do <code>up</code>, olhe o <code>docker ps</code> (vazio na 8080) e então o <code>ss -tlnp</code> para achar o processo dono da porta.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /\bss\b/), 'Descubra quem ocupa a porta com <code>ss -tlnp</code>.']
        ])
      },
      {
        id: 'tm25-1-q', kind: 'quiz', title: 'Erro de porta, docker ps limpo',
        body: [{ p: 'O <code>docker compose up -d</code> falha com <code>address already in use</code> na 8080, mas <code>docker ps</code> não mostra nenhum container nessa porta. O que isso indica?' }],
        options: [
          { text: 'A porta do host está tomada por um processo que não é container — o <code>docker ps</code> não o veria. Um <code>ss -tlnp</code> mostra qual processo (e o PID) está escutando na 8080, e daí você o encerra ou escolhe outra porta.', correct: true },
          { text: 'É um bug do Compose; basta rodar <code>up</code> de novo que passa.', why: 'Repetir o <code>up</code> não muda nada: a porta continua ocupada. O erro é real e vem de algo escutando na 8080 no host.' },
          { text: 'A imagem <code>nginx:alpine</code> está corrompida.', why: 'O erro é de <em>porta</em>, não de imagem. A imagem nem chega a subir porque a publicação da porta falha antes.' },
          { text: 'O <code>docker ps</code> está com defeito e deveria mostrar o container.', why: 'O <code>docker ps</code> está certo: não há container na porta. Quem a ocupa é um processo comum do host, fora do alcance do <code>docker ps</code> — por isso se recorre ao <code>ss</code>.' }
        ],
        hints: ['Pense em tudo o que pode escutar numa porta do host além de containers.'],
        explain: 'Uma porta do host é única e pode ser tomada por qualquer processo da máquina — não só por containers. Quando o <code>docker ps</code> está limpo e a publicação falha por porta ocupada, a investigação sai do Docker e entra no Linux: <code>ss -tlnp</code> mostra o processo e o PID que seguram a porta. Encerrá-lo (ou publicar em outra porta) resolve.'
      },
      {
        id: 'tm25-1-b', kind: 'desafio', title: 'Libere a porta e suba a stack',
        body: [
          { p: 'Um processo do host está segurando a porta 8080 e impedindo a stack em <code>~/api</code> de subir. Descubra qual é, encerre-o e coloque a stack no ar.' },
          { p: 'Ao final: o serviço <code>web</code> precisa estar rodando e publicando a porta 8080.' }
        ],
        hints: [
          'O <code>ss -tlnp</code> mostra o PID do processo que escuta na 8080. Encerre-o com <code>sudo kill &lt;pid&gt;</code>.',
          'Com a porta livre, <code>docker compose up -d</code> em <code>~/api</code> finalmente sobe o <code>web</code>.'
        ],
        solution: '<div class="code"><pre>$ cd ~/api\n$ docker compose up -d\n$ ss -tlnp\n$ sudo kill 741\n$ docker compose up -d\n$ docker compose ps</pre></div><p style="margin-top:8px">O PID vem do <code>ss</code> (aqui, 741). Encerrado o processo do host, a porta 8080 fica livre e o Compose sobe o <code>web</code>. Em vez de matar o processo, escolher outra porta de host no <code>compose.yaml</code> também resolveria.</p>',
        check: (ctx) => {
          const web = D.doProjeto(ctx, 'api', 'web');
          return H.checkAll([
            [() => !!web && web.rodando, () => 'O serviço <code>web</code> ainda não está no ar (estado <code>' + (web ? web.estado : '?') + '</code>). Libere a porta 8080 e rode <code>docker compose up -d</code>.'],
            [() => !!web && D.publicada(ctx, web.nome, 8080), 'O <code>web</code> precisa publicar a porta 8080.']
          ]);
        }
      }
    ]
  });

  /* ============================== 25.2 ============================== */
  LX.lesson('m25', {
    id: 'lm25-2', n: '25.2', title: 'O container responde, o nome não',
    goal: 'Diagnosticar um serviço que funciona por IP mas "não abre" por um domínio local — o container está certo; quem não resolve o nome é o host.',
    setup: (m) => {
      if (!m.docker) return;
      D.montar(m, { nome: 'web', imagem: 'nginx:alpine', portas: [{ hostPort: 80, contPort: 80, proto: 'tcp' }] });
    },
    body: [
      { h2: 'Dois testes que discordam' },
      { p: 'O site está publicado no container <code>web</code>, na porta 80. Você testa por <code>localhost</code> e responde; testa pelo domínio combinado com a equipe, <code>loja.local</code>, e o navegador nem chega a conectar. O container está no ar e servindo — então o problema está <em>antes</em> de chegar nele: na tradução do nome <code>loja.local</code> para um endereço.' },
      {
        code: [
          '$ curl -sI http://localhost/',
          'HTTP/1.1 200 OK',
          '',
          '$ curl -sI http://loja.local/',
          'curl: (6) Could not resolve host: loja.local'
        ], run: false
      },
      {
        box: 'key', label: 'A mensagem separa os dois mundos', body: [
          { p: 'Repare no erro: <code>(6) Could not resolve host</code>. Não é <em>connection refused</em> (a conexão nem foi tentada) — é a <strong>resolução de nome</strong> que falhou. Ou seja: não é o Docker, não é o container, não é a porta. É o host que não sabe para qual endereço <code>loja.local</code> aponta. O container respondeu 200 por <code>localhost</code>: ele está perfeito.' }
        ]
      },

      { h2: 'Onde o host resolve nomes' },
      { p: 'Antes de consultar qualquer DNS, o Linux olha o arquivo <code>/etc/hosts</code>. É onde se mapeia um nome a um endereço na própria máquina — perfeito para um domínio de desenvolvimento que só existe ali. Uma linha resolve:' },
      {
        code: [
          '# aponta loja.local para a própria máquina',
          'echo "127.0.0.1 loja.local" | sudo tee -a /etc/hosts'
        ], run: false
      },
      {
        box: 'note', label: 'Por que não é problema do Docker', body: [
          { p: 'O Docker publicou a porta 80 no host, e é só isso que ele precisa fazer: qualquer nome que <em>resolva</em> para o host (<code>localhost</code>, <code>127.0.0.1</code>, <code>loja.local</code> depois do <code>/etc/hosts</code>) chega ao container. Escolher <em>como</em> a máquina traduz um nome é responsabilidade do sistema operacional, não do contêiner. Por isso a correção mora em <code>/etc/hosts</code>, não no <code>compose.yaml</code>.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tm25-2-a', kind: 'guiado', title: 'Confirme que o container está bem',
        body: [
          { p: 'O container <code>web</code> já está no ar. Reúna as duas evidências que apontam o culpado:' },
          {
            code: [
              '$ curl -sI http://localhost/',
              '$ curl -sI http://loja.local/',
              '$ cat /etc/hosts'
            ]
          },
          { p: 'Por <code>localhost</code> vem 200 — o container serve. Por <code>loja.local</code> vem <code>Could not resolve host</code>. E o <code>/etc/hosts</code> não tem o nome. O container está certo; falta o host saber resolver <code>loja.local</code>.' }
        ],
        hints: ['Compare o <code>curl</code> por <code>localhost</code> (funciona) com o por <code>loja.local</code> (não resolve) e olhe o <code>/etc/hosts</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /curl/), 'Teste o serviço com <code>curl</code> por <code>localhost</code> e por <code>loja.local</code>.']
        ])
      },
      {
        id: 'tm25-2-q', kind: 'quiz', title: 'Resolver não é conectar',
        body: [{ p: '<code>curl http://localhost/</code> devolve 200, mas <code>curl http://loja.local/</code> dá <code>Could not resolve host</code>. O que isso diz sobre onde está o problema?' }],
        options: [
          { text: 'O container e a porta estão bem (o 200 por localhost prova). A falha é anterior à conexão: o host não sabe traduzir o nome <code>loja.local</code> para um endereço. A correção é ensinar o host a resolvê-lo — em <code>/etc/hosts</code>, por exemplo.', correct: true },
          { text: 'O container não está publicando a porta corretamente.', why: 'Se a publicação estivesse errada, o <code>curl</code> por <code>localhost</code> também falharia — e ele deu 200. O problema é só a tradução do nome <code>loja.local</code>.' },
          { text: 'O <code>loja.local</code> precisa ser configurado dentro do container.', why: 'A resolução do nome acontece no <em>host</em>, antes de a requisição chegar ao container. Configurar algo dentro do container não muda como a sua máquina traduz <code>loja.local</code>.' },
          { text: 'É um erro de firewall bloqueando a porta.', why: 'Firewall bloqueado daria uma conexão recusada ou travada, não <code>Could not resolve host</code>. Esse erro é específico de resolução de nome: a conexão nem começou.' }
        ],
        hints: ['<code>Could not resolve host</code> é uma etapa antes de <em>connection refused</em>. O que acontece antes de conectar?'],
        explain: 'Antes de conectar, o cliente precisa traduzir o nome num endereço. <code>Could not resolve host</code> é a falha dessa tradução — nada a ver com o container, a porta ou o Docker, que já provaram funcionar pelo 200 em <code>localhost</code>. A resolução é do sistema operacional; para um nome local, o lugar de resolvê-la é o <code>/etc/hosts</code>.'
      },
      {
        id: 'tm25-2-b', kind: 'desafio', title: 'Faça o host resolver o nome',
        body: [
          { p: 'O container <code>web</code> serve normalmente por <code>localhost</code>, mas a equipe acessa por <code>loja.local</code> e o nome não resolve. Faça a máquina resolver <code>loja.local</code> para ela mesma (<code>127.0.0.1</code>), sem tocar no container.' },
          { p: 'Ao final: uma requisição a <code>http://loja.local/</code> precisa responder com sucesso.' }
        ],
        hints: [
          'O host resolve nomes locais pelo <code>/etc/hosts</code>. Acrescente a linha <code>127.0.0.1 loja.local</code> a ele.',
          'Como o arquivo é do sistema, use <code>echo "127.0.0.1 loja.local" | sudo tee -a /etc/hosts</code> e confira com <code>curl -sI http://loja.local/</code>.'
        ],
        solution: '<div class="code"><pre>$ echo "127.0.0.1 loja.local" | sudo tee -a /etc/hosts\n$ curl -sI http://loja.local/</pre></div><p style="margin-top:8px">Uma linha em <code>/etc/hosts</code> resolve o nome para a própria máquina, e a requisição por <code>loja.local</code> passa a chegar ao container que já estava no ar. O <code>compose.yaml</code> nunca precisou mudar.</p>',
        check: (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          let hosts = '';
          try { hosts = m.fs.readFile('/etc/hosts', { ctx: m.ctxRoot() }); } catch (e) { }
          const r = D.http(ctx, 'loja.local', 80, '/');
          return H.checkAll([
            [() => /(^|\s)127\.0\.0\.1\s+.*loja\.local/m.test(hosts) || /loja\.local/.test(hosts),
              'O <code>/etc/hosts</code> ainda não mapeia <code>loja.local</code>. Acrescente <code>127.0.0.1 loja.local</code>.'],
            [() => !!r && r.status === 200, 'Uma requisição a <code>http://loja.local/</code> ainda não respondeu. Confira a linha no <code>/etc/hosts</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 25.3 ============================== */
  LX.lesson('m25', {
    id: 'lm25-3', n: '25.3', title: 'O container que morre sozinho',
    goal: 'Reconhecer a assinatura do OOM killer (Exited 137) num container que reinicia sem parar, e devolvê-lo à vida com o limite de memória certo.',
    setup: (m) => {
      if (!m.docker) return;
      const c = D.montar(m, { nome: 'api', imagem: 'nginx:alpine' });
      if (c) {
        c.recursos = c.recursos || {};
        c.recursos.memoria = 64 * 1024 * 1024; /* limite apertado demais */
        c.oom = true; c.saida = 137; c.estado = 'exited'; c.rodando = false;
      }
    },
    body: [
      { h2: 'Um número que já é diagnóstico' },
      { p: 'O container <code>api</code> não para de reiniciar. O <code>docker ps -a</code> mostra sempre <code>Exited (137)</code> pouco antes de voltar. Esse 137 não é aleatório: é a assinatura de uma morte por <strong>SIGKILL</strong> — e a causa número um de SIGKILL num container é o <strong>OOM killer</strong> do kernel, que mata o processo quando ele estoura o limite de memória.' },
      {
        code: [
          '$ docker ps -a',
          'NAME   IMAGE          STATUS',
          'api    nginx:alpine   Exited (137) 8 seconds ago',
          '',
          '$ docker inspect api --format "{{.State.OOMKilled}} {{.State.ExitCode}}"',
          'true 137'
        ], run: false
      },
      {
        box: 'key', label: 'Memória é um recurso do host', body: [
          { p: 'Aqui os dois mundos se encontram: o limite é uma configuração do <em>Docker</em> (<code>--memory</code>), mas a memória é um recurso do <em>host</em>. Você confirma o veredito com <code>docker inspect</code> (<code>.State.OOMKilled: true</code>) e entende o cenário com as ferramentas de Linux — <code>free -h</code> mostra a memória da máquina, <code>docker stats</code> mostra o consumo do container contra o limite. Um limite apertado demais para a carga real mata o processo repetidamente.' }
        ]
      },
      { h2: 'O conserto: um limite condizente' },
      { p: 'Se o limite está apertado demais para o que a aplicação realmente usa, a correção é dar a ela um limite condizente — e recriar o container para aplicá-lo:' },
      {
        code: [
          '$ docker rm api',
          '$ docker run -d --name api --memory 512m nginx:alpine',
          '$ docker inspect api --format "{{.State.OOMKilled}}"',
          'false'
        ], run: false
      },
      {
        box: 'warn', label: '137 nem sempre é limite apertado', body: [
          { p: 'Um <code>Exited (137)</code> recorrente pode ser das duas coisas: um limite baixo demais para uma carga legítima, ou um <strong>vazamento de memória</strong> na aplicação (que vai estourar qualquer limite, só demorando mais). Subir o limite resolve o primeiro caso; no segundo, ele só adia o problema — a correção real está no código. O <code>docker stats</code> acompanhando o consumo ao longo do tempo distingue os dois.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'tm25-3-a', kind: 'guiado', title: 'Leia a causa da morte',
        body: [
          { p: 'O container <code>api</code> vive caindo. Confirme o diagnóstico cruzando Docker e host:' },
          {
            code: [
              '$ docker ps -a',
              '$ docker inspect api --format "{{.State.OOMKilled}} {{.State.ExitCode}}"',
              '$ free -h'
            ]
          },
          { p: 'O <code>ps -a</code> mostra <code>Exited (137)</code>; o <code>inspect</code> confirma <code>OOMKilled: true</code>; o <code>free -h</code> mostra a memória do host. O 137 com <code>OOMKilled</code> verdadeiro fecha o caso: foi o OOM killer.' }
        ],
        hints: ['Confirme o OOM com <code>docker inspect api --format "{{.State.OOMKilled}}"</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+inspect/), 'Confirme a causa com <code>docker inspect api --format "{{.State.OOMKilled}}"</code>.']
        ])
      },
      {
        id: 'tm25-3-q', kind: 'quiz', title: 'Exited (137) que se repete',
        body: [{ p: 'Um container reinicia sozinho a cada poucos minutos, sempre com <code>Exited (137)</code>, e o <code>docker inspect</code> mostra <code>OOMKilled: true</code>. Qual é a leitura correta?' }],
        options: [
          { text: 'O kernel matou o processo por estouro de memória (137 = SIGKILL, e OOMKilled confirma). Ou o limite está apertado demais para a carga real, ou há vazamento de memória. Subir o limite resolve o primeiro; o segundo exige corrigir a aplicação.', correct: true },
          { text: 'É um crash comum de código; o 137 é o erro que a aplicação retornou.', why: 'O 137 não vem da aplicação: é morte por SIGKILL vinda de fora, e o <code>OOMKilled: true</code> aponta o OOM killer como a mão. Não é um <code>return</code> do programa.' },
          { text: 'O disco encheu; 137 é o código de disco cheio.', why: 'Disco cheio dá erros de escrita (<code>no space left</code>), não 137. O 137 com <code>OOMKilled</code> é especificamente memória.' },
          { text: 'A imagem está corrompida e precisa ser baixada de novo.', why: 'Imagem corrompida nem iniciaria, ou falharia de outra forma. O container <em>roda</em> e depois é morto por memória — é um problema de recurso, não de imagem.' }
        ],
        hints: ['137 = 128 + 9, e o sinal 9 é o SIGKILL. Quem manda SIGKILL por memória?'],
        explain: 'O código 137 é 128 + 9: morte por SIGKILL. Num container, a causa clássica é o OOM killer, e <code>.State.OOMKilled: true</code> confirma. A partir daí há dois caminhos: limite baixo demais para a carga (sobe-se o limite) ou vazamento de memória (corrige-se o código). O <code>docker stats</code> ao longo do tempo separa um do outro.'
      },
      {
        id: 'tm25-3-b', kind: 'desafio', title: 'Devolva a memória e o container à vida',
        body: [
          { p: 'O container <code>api</code> foi morto pelo OOM killer: o limite de memória estava apertado demais. Recrie-o com um limite condizente, para ele ficar no ar em vez de morrer.' },
          { p: 'Ao final: o container <code>api</code> precisa estar rodando, com um limite de memória de <strong>pelo menos 256&nbsp;MB</strong>.' }
        ],
        hints: [
          'Remova o container morto com <code>docker rm api</code> e recrie com um limite maior: <code>docker run -d --name api --memory 512m nginx:alpine</code>.',
          'Confira com <code>docker inspect api --format "{{.State.OOMKilled}}"</code> (deve ser <code>false</code>) e <code>docker stats</code>.'
        ],
        solution: '<div class="code"><pre>$ docker rm api\n$ docker run -d --name api --memory 512m nginx:alpine\n$ docker ps\n$ docker inspect api --format "{{.State.OOMKilled}} {{.State.ExitCode}}"</pre></div><p style="margin-top:8px">Removido o container morto e recriado com <code>--memory 512m</code>, o limite deixa de ser o gargalo e o <code>api</code> fica no ar. Qualquer limite condizente com a carga serve; 512&nbsp;MB é folgado para um nginx.</p>',
        check: (ctx) => {
          const c = D.container(ctx, 'api');
          return H.checkAll([
            [() => !!c && c.rodando, () => 'O container <code>api</code> ainda não está no ar (estado <code>' + (c ? c.estado : '?') + '</code>). Recrie-o com um limite de memória maior.'],
            [() => !!c && c.recursos && (c.recursos.memoria || 0) >= 256 * 1024 * 1024,
              'O <code>api</code> precisa de um limite de memória de pelo menos 256&nbsp;MB (<code>--memory 512m</code>, por exemplo).']
          ]);
        }
      }
    ]
  });
})();
