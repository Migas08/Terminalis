/* =========================================================================
   MÓDULO D03 — Investigar um container
   logs, exec, inspect, top, stats, diff, cp, port. As ferramentas que
   respondem "o que está acontecendo aí dentro?".
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 3.1 ============================== */
  LX.lesson('d03', {
    id: 'ld3-1', n: '3.1', title: 'docker logs: a primeira coisa a olhar',
    goal: 'Usar os logs como instrumento de diagnóstico, e entender de onde eles vêm.',
    setup: (m) => {
      /* Um MariaDB que tentou subir sem senha e caiu. O log dele é a
         evidência que o desafio pede para o aluno ler. */
      const e = m.docker;
      if (!e || e.containerPorNome('banco-caido')) return;
      const r = e.criarContainer({ imagem: 'mariadb:11.4', nome: 'banco-caido' });
      if (r.ok) e.iniciar(r.container);
    },
    body: [
      { h2: 'De onde vêm os logs de um container' },
      { p: 'O Docker captura a <strong>saída padrão</strong> e a <strong>saída de erro</strong> do processo 1. Só isso. Aqueles mesmos <code>stdout</code> e <code>stderr</code> do módulo de pipes do curso de Linux.' },
      {
        box: 'key', label: 'A regra que muda como aplicações são escritas', body: [
          { p: 'Uma aplicação em container <strong>não deve escrever log em arquivo</strong>. Deve escrever em <code>stdout</code> e <code>stderr</code>, e deixar a plataforma coletar.' },
          { p: 'Se a aplicação grava em <code>/var/log/app.log</code> dentro do container, <code>docker logs</code> não mostra nada — o arquivo morre com o container e ninguém consegue acompanhar de fora. É por isso que a imagem oficial do nginx faz um link do log de acesso para <code>/dev/stdout</code>.' }
        ]
      },

      { h2: 'As opções que você vai usar todo dia' },
      { code: ['$ docker logs web', '$ docker logs --tail 20 web', '$ docker logs -f web',
        '$ docker logs --since 10m web', '$ docker logs -t --tail 5 web'] },
      {
        table: {
          head: ['Opção', 'Para quê'],
          rows: [
            ['<code>--tail N</code>', 'só as últimas N linhas — essencial em log grande'],
            ['<code>-f</code>', 'acompanha em tempo real (como <code>tail -f</code>); sai com <kbd>Ctrl+C</kbd>'],
            ['<code>--since</code>', 'a partir de um instante: <code>10m</code>, <code>1h</code>, ou uma data'],
            ['<code>--until</code>', 'até um instante — combinado com <code>--since</code>, recorta uma janela'],
            ['<code>-t</code>', 'carimba cada linha com o horário']
          ]
        }
      },
      { p: 'A combinação mais útil no dia a dia é <code>docker logs -f --tail 50 servico</code>: mostra o contexto recente e passa a acompanhar.' },

      { h2: 'stdout e stderr continuam separados' },
      { p: 'O <code>docker logs</code> mostra os dois misturados, mas eles continuam sendo fluxos diferentes. Dá para separar com o mesmo redirecionamento de sempre:' },
      { code: ['$ docker logs web 2>/dev/null', '$ docker logs web 1>/dev/null'] },
      { p: 'O primeiro mostra só o que foi para <code>stdout</code>; o segundo, só o que foi para <code>stderr</code>. O nginx, por exemplo, manda acesso para <code>stdout</code> e erro para <code>stderr</code>.' },

      { h2: 'Encontrar coisas no log' },
      { p: 'Log é texto, e você já sabe processar texto:' },
      { code: ['$ docker logs api 2>&1 | grep -i error',
        '$ docker logs api 2>&1 | grep -ci "connection refused"',
        '$ docker logs api 2>&1 | tail -100 | grep -A5 -i exception'] },
      { p: 'O <code>2&gt;&1</code> junta os dois fluxos antes do pipe — sem ele, o <code>grep</code> receberia só o <code>stdout</code> e você perderia justamente as mensagens de erro.' },

      { h2: 'O log de um container que morreu' },
      { p: 'Esta é a razão mais forte para não sair apagando containers parados:' },
      { code: ['$ docker ps -a --filter status=exited', '$ docker logs nome-do-container-morto'] },
      { p: 'O log sobrevive ao processo. Um container que subiu e caiu em dois segundos deixou, nesses dois segundos, a explicação do que deu errado. Se você fizer <code>docker rm</code> antes de ler, perdeu a evidência.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>docker logs</code> mostra o <code>stdout</code> e o <code>stderr</code> do processo 1 — nada além disso.',
          'Aplicação em container escreve log na saída padrão, não em arquivo.',
          '<code>-f --tail N</code> é a combinação do dia a dia.',
          '<code>2&gt;&1</code> antes do pipe, senão o <code>grep</code> perde os erros.',
          'Container parado guarda o log: leia antes de remover.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td3-1-a', kind: 'guiado', title: 'Ler o log de um serviço',
        body: [
          { p: 'Suba um nginx, faça uma requisição e veja o registro aparecer:' },
          { code: ['$ docker run -d --name diario -p 8080:80 nginx:alpine',
            '$ docker logs diario',
            '$ curl -s -o /dev/null localhost:8080',
            '$ curl -s -o /dev/null localhost:8080/nao-existe',
            '$ docker logs --tail 5 diario'] },
          { p: 'As duas últimas linhas do log são as suas requisições: uma com 200 e outra com 404.' }
        ],
        hints: ['O <code>-o /dev/null</code> descarta o corpo da resposta; interessa só provocar o registro no log.'],
        solution: '<pre>$ docker run -d --name diario -p 8080:80 nginx:alpine\n$ docker logs diario\n$ curl -s -o /dev/null localhost:8080\n$ curl -s -o /dev/null localhost:8080/nao-existe\n$ docker logs --tail 5 diario</pre>',
        check: async (ctx) => {
          const logs = D.logs(ctx, 'diario');
          return H.checkAll([
            [() => D.rodando(ctx, 'diario'), 'Suba o container com <code>docker run -d --name diario -p 8080:80 nginx:alpine</code>.'],
            [() => / 200 /.test(logs), 'Faça uma requisição bem-sucedida com <code>curl -s -o /dev/null localhost:8080</code> — ela precisa aparecer no log.'],
            [() => / 404 /.test(logs), 'Peça também um caminho que não existe (<code>localhost:8080/nao-existe</code>) para ver um 404 no log.'],
            [() => H.usedCommand(ctx, /docker\s+logs/), 'Leia o log com <code>docker logs --tail 5 diario</code>.']
          ]);
        }
      },
      {
        id: 'td3-1-q', kind: 'quiz', title: 'O log que não aparece',
        body: [
          { p: 'A equipe reclama que <code>docker logs api</code> não mostra nada, mesmo com a aplicação certamente registrando erros. Qual é a causa mais provável?' }
        ],
        options: [
          { text: 'A aplicação está escrevendo em um arquivo dentro do container (como <code>/var/log/app.log</code>) em vez de em <code>stdout</code>/<code>stderr</code> — e o Docker só captura esses dois fluxos.', correct: true },
          { text: 'O container está sem espaço em disco.', why: 'Disco cheio costuma travar a escrita e gerar erro visível na aplicação, não um log silenciosamente vazio.' },
          { text: 'Falta <code>sudo</code> para ver os logs.', why: '<code>docker logs</code> não pede privilégio além do que já vem de estar no grupo <code>docker</code> — que dá acesso ao daemon inteiro.' },
          { text: 'O comando certo é <code>docker logs -f api</code>; sem <code>-f</code> não mostra nada.', why: '<code>-f</code> só acompanha em tempo real. Sem ele, o que já foi capturado aparece do mesmo jeito — o problema aqui é que nada foi capturado.' }
        ],
        explain: 'O Docker só enxerga <code>stdout</code> e <code>stderr</code> do processo 1. Se a aplicação grava em arquivo, esse arquivo mora na camada gravável do container — invisível para <code>docker logs</code> e perdido quando o container for removido. A correção é do lado da aplicação: mandar o log para a saída padrão, não para um arquivo.'
      },
      {
        id: 'td3-1-b', kind: 'desafio', title: 'Descobrir por que o banco não subiu',
        body: [
          { p: 'Alguém tentou subir um MariaDB e ele não ficou de pé. O container ainda está na máquina, parado.' },
          { ol: [
            'Encontre o container parado.',
            'Leia o log dele e descubra o motivo exato da recusa.',
            'Grave a linha do log que explica o problema em <code>~/motivo.txt</code>.'
          ] },
          { p: 'Não recrie o container ainda — o objetivo aqui é <strong>ler</strong>.' }
        ],
        hints: [
          'Liste os parados com <code>docker ps -a --filter status=exited</code>.',
          'O log de um container parado continua acessível: <code>docker logs nome</code>.',
          'Para gravar só a linha que interessa, filtre: <code>docker logs banco-caido 2>&1 | grep -i error > ~/motivo.txt</code>.'
        ],
        solution: '<pre>$ docker ps -a --filter status=exited\n$ docker logs banco-caido\n$ docker logs banco-caido 2>&amp;1 | grep -i "password option" &gt; ~/motivo.txt\n$ cat ~/motivo.txt</pre>',
        check: async (ctx) => {
          const texto = H.read(ctx, '/home/aluno/motivo.txt');
          const logs = D.logs(ctx, 'banco-caido');
          return H.checkAll([
            [() => !!D.container(ctx, 'banco-caido'), 'O container <code>banco-caido</code> sumiu do ambiente. Ele era o objeto da investigação.'],
            [() => H.usedCommand(ctx, /docker\s+logs/), 'Leia o log do container com <code>docker logs banco-caido</code>.'],
            [() => texto !== null, 'Grave a linha explicativa em <code>~/motivo.txt</code>.'],
            [() => /password option is not specified|MARIADB_ROOT_PASSWORD/i.test(texto || ''),
              'O arquivo não contém a linha certa. O log diz literalmente qual variável faltou — é essa linha que precisa estar em <code>~/motivo.txt</code>.'],
            [() => logs.includes(String(texto).trim().split('\n')[0].trim()) || String(texto).trim().split('\n').every(l => logs.includes(l.trim())),
              'O conteúdo de <code>~/motivo.txt</code> não bate com o que está no log. Gere o arquivo a partir da saída do <code>docker logs</code>, sem digitar à mão.']
          ]);
        },
        forja: ['echo "algo sobre MARIADB_ROOT_PASSWORD que eu inventei" > ~/motivo.txt']
      }
    ]
  });

  /* ============================== 3.2 ============================== */
  LX.lesson('d03', {
    id: 'ld3-2', n: '3.2', title: 'docker exec: entrar no container',
    goal: 'Executar comandos dentro de um container em execução, e nunca mais confundir "comando no servidor" com "comando dentro do container".',
    setup: (m) => {
      if (m.docker && !m.docker.containerPorNome('vitrine')) {
        LX.D.montar(m, {
          imagem: 'nginx:alpine', nome: 'vitrine',
          portas: [{ hostIp: '0.0.0.0', hostPort: 8080, contPort: 80, proto: 'tcp' }]
        });
      }
    },
    body: [
      { h2: 'A distinção mais importante deste módulo' },
      {
        ascii: `aluno@srv-aula:~$ ls /etc/nginx
            ↑
     ISTO roda no SERVIDOR


aluno@srv-aula:~$ docker exec web ls /etc/nginx
                  └──────────┘ └────────────┘
                   no servidor   DENTRO do container`
      },
      { p: 'A confusão entre os dois é a causa de metade dos "mas eu editei o arquivo e não mudou nada". Você editou o arquivo <em>do servidor</em>; a aplicação lê o arquivo <em>do container</em>. São sistemas de arquivos diferentes.' },

      { h2: 'Comando único' },
      { code: ['$ docker exec web ls /usr/share/nginx/html',
        '$ docker exec web cat /etc/nginx/conf.d/default.conf',
        '$ docker exec web nginx -t',
        '$ docker exec web env'] },
      { p: 'O container continua rodando o que já rodava; o <code>exec</code> apenas adiciona mais um processo lá dentro.' },

      { h2: 'Shell interativo: -it' },
      { code: ['$ docker exec -it web sh'] },
      { p: 'Duas letras, dois efeitos distintos:' },
      {
        table: {
          head: ['Flag', 'Nome', 'O que faz', 'Sem ela'],
          rows: [
            ['<code>-i</code>', '<em>interactive</em>', 'mantém a entrada padrão aberta', 'o que você digita não chega ao processo'],
            ['<code>-t</code>', '<em>tty</em>', 'aloca um terminal virtual', 'sem prompt, sem cores, sem histórico, sem <kbd>Ctrl+C</kbd>']
          ]
        }
      },
      { p: 'Por isso <code>-it</code> anda junto: um sem o outro dá uma experiência pela metade. Teste você mesmo: <code>docker exec -i web sh</code> funciona, mas não mostra prompt nenhum.' },

      { h2: 'sh ou bash?' },
      {
        box: 'warn', label: 'O erro mais comum de quem começa', body: [
          { code: ['$ docker exec -it web bash', 'OCI runtime exec failed: exec: "bash": executable file not found in $PATH'], run: false, lang: 'text' },
          { p: 'Não é problema de configuração: <strong>a imagem não tem bash</strong>. Imagens baseadas em Alpine trazem apenas <code>/bin/sh</code> (o <em>ash</em> do BusyBox), porque o bash pesa alguns megabytes que ninguém precisa em produção.' },
          {
            ul: [
              'Imagens <code>-alpine</code> — quase sempre só <code>sh</code>',
              'Imagens <code>-slim</code>, <code>debian</code>, <code>ubuntu</code> — normalmente têm <code>bash</code>',
              'Imagens <code>scratch</code> ou <em>distroless</em> — não têm shell nenhum'
            ]
          },
          { p: 'A regra prática: tente <code>sh</code> primeiro. Ele existe em quase tudo, e todo comando POSIX funciona nele.' }
        ]
      },
      { p: 'Se você precisa mesmo de bash em uma imagem Alpine, dá para instalar — mas só dentro daquele container, e some quando ele for recriado:' },
      { code: ['$ docker exec -it web sh', '/ # apk add --no-cache bash', '/ # bash', 'bash-5.2# exit'] },

      { h2: 'exec × attach: dois comandos parecidos, riscos diferentes' },
      {
        table: {
          head: ['', '<code>docker exec</code>', '<code>docker attach</code>'],
          rows: [
            ['O que faz', 'cria um <strong>novo</strong> processo dentro do container', 'liga o seu terminal ao processo <strong>1</strong>'],
            ['Ctrl+C', 'encerra só o processo que você abriu', '<strong>encerra o container inteiro</strong>'],
            ['Uso típico', 'investigar, depurar, rodar comandos', 'raro: ver a saída ao vivo de um processo interativo'],
            ['Risco', 'nenhum', 'derrubar o serviço sem querer']
          ]
        }
      },
      { p: 'Na prática: use <code>exec</code>. O <code>attach</code> existe, é legítimo, e é uma armadilha para quem está aprendendo. Para ver a saída ao vivo sem risco, <code>docker logs -f</code> faz o mesmo com segurança.' },

      { h2: 'Outras opções úteis do exec' },
      { code: ['$ docker exec -u root -it web sh',
        '$ docker exec -w /usr/share/nginx/html web ls -la',
        '$ docker exec -e DEBUG=1 web env | grep DEBUG'] },
      {
        ul: [
          '<code>-u</code> — executa como outro usuário. Útil quando o container roda como usuário sem privilégio e você precisa instalar algo',
          '<code>-w</code> — define o diretório de trabalho do comando',
          '<code>-e</code> — passa uma variável só para esse comando'
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>docker exec CONTAINER COMANDO</code> roda dentro; sem o <code>docker exec</code>, roda no servidor.',
          '<code>-i</code> mantém a entrada aberta, <code>-t</code> dá um terminal; juntos, <code>-it</code>.',
          'Alpine não tem bash. Tente <code>sh</code> primeiro.',
          '<code>exec</code> abre um processo novo; <code>attach</code> gruda no PID 1 e <kbd>Ctrl+C</kbd> mata o container.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td3-2-a', kind: 'guiado', title: 'Dentro e fora',
        body: [
          { p: 'Compare os dois lados com o mesmo comando:' },
          { code: ['$ docker run -d --name comparar nginx:alpine',
            '$ cat /etc/os-release | head -2',
            '$ docker exec comparar cat /etc/os-release | head -2',
            '$ hostname',
            '$ docker exec comparar hostname',
            '$ ls /usr/share/nginx/html',
            '$ docker exec comparar ls /usr/share/nginx/html'] },
          { p: 'O último par é o mais eloquente: o diretório existe dentro do container e não existe no servidor.' }
        ],
        hints: ['Rode em pares e compare cada resposta.'],
        solution: '<pre>$ docker run -d --name comparar nginx:alpine\n$ cat /etc/os-release | head -2\n$ docker exec comparar cat /etc/os-release | head -2\n$ hostname\n$ docker exec comparar hostname\n$ ls /usr/share/nginx/html\n$ docker exec comparar ls /usr/share/nginx/html</pre>',
        check: async (ctx) => H.checkAll([
          [() => D.rodando(ctx, 'comparar'), 'Suba o container com <code>docker run -d --name comparar nginx:alpine</code>.'],
          [() => H.usedCommand(ctx, /docker\s+exec\s+comparar\s+cat\s+\/etc\/os-release/), 'Leia o <code>/etc/os-release</code> de dentro do container com <code>docker exec</code>.'],
          [() => H.usedCommand(ctx, /docker\s+exec\s+comparar\s+hostname/), 'Compare o <code>hostname</code> dos dois lados.'],
          [() => H.usedCommand(ctx, /docker\s+exec\s+comparar\s+ls/), 'Liste um diretório de dentro do container com <code>docker exec comparar ls ...</code>.']
        ])
      },
      {
        id: 'td3-2-q', kind: 'quiz', title: 'O Ctrl+C que derrubou o serviço',
        body: [
          { p: 'Alguém quer acompanhar a saída ao vivo de um container chamado <code>api</code> e roda <code>docker attach api</code>. No meio da observação, aperta <kbd>Ctrl+C</kbd> para voltar ao prompt — e o serviço cai junto. O que houve, e qual seria o jeito seguro de acompanhar?' }
        ],
        options: [
          { text: '<code>attach</code> liga o terminal ao processo 1; o <kbd>Ctrl+C</kbd> manda <code>SIGINT</code> para ele e derruba o container. O jeito seguro é <code>docker logs -f api</code>, que só lê a saída sem se conectar ao processo.', correct: true },
          { text: '<code>docker attach</code> sempre mata o container ao ser usado, independente do <kbd>Ctrl+C</kbd>.', why: 'O <code>attach</code> sozinho não mata nada. O risco é especificamente o sinal que o <kbd>Ctrl+C</kbd> manda para o processo 1 ao qual ele está ligado.' },
          { text: 'Faltou usar <code>-it</code> no <code>attach</code>.', why: '<code>-it</code> é opção de <code>docker run</code> e <code>docker exec</code>; <code>attach</code> não tem essa flag, e ela não mudaria o comportamento do <kbd>Ctrl+C</kbd>.' },
          { text: 'O container caiu porque a imagem não suporta <code>attach</code>.', why: '<code>attach</code> funciona com qualquer imagem em execução; o risco é estrutural ao comando, não uma limitação da imagem.' }
        ],
        explain: '<code>exec</code> abre um processo novo dentro do container; <code>attach</code> conecta ao processo 1 que já está rodando. Um <kbd>Ctrl+C</kbd> em <code>attach</code> interrompe esse processo 1 — e como o container vive enquanto o PID 1 vive, ele morre junto. Para ver a saída ao vivo sem esse risco, <code>docker logs -f</code> faz o mesmo, com segurança.'
      },
      {
        id: 'td3-2-b', kind: 'desafio', title: 'Trocar a página do site por dentro',
        body: [
          { p: 'Existe um nginx rodando chamado <code>vitrine</code>, publicado na porta 8080 do servidor.' },
          { ol: [
            'Entre no container e substitua o conteúdo de <code>/usr/share/nginx/html/index.html</code> por uma página que contenha o texto <code>Terminalis</code>.',
            'Confirme, <strong>do servidor</strong>, que <code>curl localhost:8080</code> devolve a página nova.'
          ] },
          { p: 'A alteração precisa ser feita dentro do container — editar um arquivo do servidor não vai mudar nada.' }
        ],
        hints: [
          'Você pode entrar com <code>docker exec -it vitrine sh</code> e editar lá dentro, ou fazer em um comando só.',
          'Em um comando: <code>docker exec vitrine sh -c \'echo "&lt;h1&gt;Terminalis&lt;/h1&gt;" &gt; /usr/share/nginx/html/index.html\'</code>.',
          'As aspas simples são obrigatórias: sem elas, o <code>&gt;</code> é executado pelo shell do servidor e o arquivo é criado aqui fora.'
        ],
        solution: '<pre>$ docker exec vitrine sh -c \'echo "&lt;h1&gt;Terminalis&lt;/h1&gt;" &gt; /usr/share/nginx/html/index.html\'\n$ curl -s localhost:8080</pre>',
        check: async (ctx) => {
          const dentro = D.leNoContainer(ctx, 'vitrine', '/usr/share/nginx/html/index.html');
          const resp = D.http(ctx, 'localhost', 8080, '/');
          return H.checkAll([
            [() => D.rodando(ctx, 'vitrine'), 'O container <code>vitrine</code> precisa estar em execução.'],
            [() => dentro !== null, 'O arquivo <code>/usr/share/nginx/html/index.html</code> não existe mais dentro do container.'],
            [() => /Terminalis/.test(dentro || ''),
              'A página dentro do container ainda não contém o texto <code>Terminalis</code>. Lembre-se de que a alteração precisa acontecer <em>dentro</em> do container, com <code>docker exec</code>.'],
            [() => !!resp && resp.status === 200 && /Terminalis/.test(resp.body || ''),
              'O nginx ainda não está servindo a página nova. Confira o caminho: precisa ser exatamente <code>/usr/share/nginx/html/index.html</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 3.3 ============================== */
  LX.lesson('d03', {
    id: 'ld3-3', n: '3.3', title: 'inspect, top, stats, diff, cp e port',
    goal: 'Completar a caixa de ferramentas de investigação e aprender a extrair um campo específico do inspect.',
    setup: (m) => {
      if (m.docker && !m.docker.containerPorNome('producao')) {
        LX.D.montar(m, {
          imagem: 'nginx:alpine', nome: 'producao',
          portas: [{ hostIp: '0.0.0.0', hostPort: 9090, contPort: 80, proto: 'tcp' }]
        });
      }
    },
    body: [
      { h2: 'docker inspect: tudo o que o daemon sabe' },
      { p: 'O <code>inspect</code> devolve um JSON enorme com a configuração completa. Enorme mesmo — e é por isso que quase nunca se usa ele puro:' },
      { code: ['$ docker inspect web | head -30'] },
      { p: 'O jeito útil é pedir um campo. A sintaxe é a de <em>templates</em> do Go:' },
      { code: ['$ docker inspect web --format "{{.State.Status}}"',
        '$ docker inspect web --format "{{.NetworkSettings.IPAddress}}"',
        '$ docker inspect web --format "{{.Config.Image}}"',
        '$ docker inspect web --format "{{json .Config.Env}}"',
        '$ docker inspect web --format "{{.State.ExitCode}} {{.State.OOMKilled}}"'] },
      {
        table: {
          head: ['Caminho', 'Responde a pergunta'],
          rows: [
            ['<code>.State.Status</code>', 'em que estado está?'],
            ['<code>.State.ExitCode</code>', 'com que código terminou?'],
            ['<code>.State.OOMKilled</code>', 'foi morto por falta de memória?'],
            ['<code>.State.Health.Status</code>', 'o healthcheck aprovou?'],
            ['<code>.Config.Env</code>', 'quais variáveis de ambiente recebeu?'],
            ['<code>.Config.Cmd</code> e <code>.Config.Entrypoint</code>', 'que comando executa?'],
            ['<code>.NetworkSettings.Networks</code>', 'em que redes está, e com que IP?'],
            ['<code>.Mounts</code>', 'que volumes e bind mounts tem?'],
            ['<code>.HostConfig.RestartPolicy.Name</code>', 'qual a política de reinício?'],
            ['<code>.RestartCount</code>', 'quantas vezes já reiniciou?']
          ]
        }
      },
      { p: 'Para percorrer listas existe o <code>range</code>:' },
      { code: ['$ docker inspect web --format "{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{println}}{{end}}"'] },
      { p: 'E o <code>inspect</code> também funciona em imagens, redes e volumes — não só em containers.' },

      { h2: 'docker top: processos, sem entrar' },
      { code: ['$ docker top web'] },
      { p: 'Funciona mesmo em imagem que não tem <code>ps</code> instalado, porque quem lista é o daemon, de fora. Repare que os PIDs mostrados são os <strong>do host</strong> — o mesmo processo que dentro do container é o PID 1.' },

      { h2: 'docker stats: consumo em tempo real' },
      { code: ['$ docker stats --no-stream', '$ docker stats web api db --no-stream'] },
      {
        table: {
          head: ['Coluna', 'Leitura'],
          rows: [
            ['<code>CPU %</code>', '100% = um núcleo inteiro. Em máquina de 4 núcleos, o teto é 400%'],
            ['<code>MEM USAGE / LIMIT</code>', 'se não houver <code>--memory</code>, o limite é a RAM da máquina'],
            ['<code>MEM %</code>', 'proporção do limite — perto de 100% significa OOM próximo'],
            ['<code>NET I/O</code>', 'tráfego recebido / enviado desde que subiu'],
            ['<code>BLOCK I/O</code>', 'leitura / escrita em disco'],
            ['<code>PIDS</code>', 'processos lá dentro; crescendo sem parar, é vazamento']
          ]
        }
      },
      { p: 'Sem <code>--no-stream</code>, a tela se atualiza continuamente até você sair com <kbd>Ctrl+C</kbd>.' },

      { h2: 'docker diff: o que o container escreveu' },
      { code: ['$ docker diff web'] },
      { p: '<code>A</code> = adicionado, <code>C</code> = alterado, <code>D</code> = removido, sempre comparando com a imagem de origem. Serve para duas coisas muito concretas: descobrir se alguém alterou algo à mão em um container de produção, e descobrir onde a aplicação está gravando arquivos que deveriam estar em um volume.' },

      { h2: 'docker cp: atravessar a fronteira' },
      { code: ['$ docker cp web:/etc/nginx/nginx.conf ./nginx.conf',
        '$ docker cp ./nginx.conf web:/etc/nginx/nginx.conf',
        '$ docker cp web:/var/log/nginx ./logs-do-container'] },
      { p: 'A sintaxe é sempre <code>origem destino</code>, com <code>container:/caminho</code> de um dos lados.' },
      {
        box: 'warn', label: 'cp é para investigar, não para configurar', body: [
          { p: 'Copiar um arquivo de configuração para dentro de um container funciona — até o container ser recriado. Aí a alteração some, porque estava na camada gravável.' },
          { p: 'Configuração que precisa sobreviver vai por <strong>bind mount</strong> (módulo de volumes) ou entra na imagem via <strong>Dockerfile</strong>. O <code>cp</code> serve para tirar um arquivo de dentro e olhar, ou para um teste rápido que você sabe que é temporário.' }
        ]
      },

      { h2: 'docker port' },
      { code: ['$ docker port web', '$ docker port web 80'] },
      { p: 'Responde "essa porta de dentro saiu em qual porta do servidor?". Útil quando a publicação foi automática, com <code>-P</code>, e o Docker escolheu uma porta alta aleatória.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>inspect --format</code> extrai um campo; sem ele, o JSON é grande demais para ser útil.',
          '<code>top</code> lista processos de fora; <code>stats</code> mostra consumo.',
          '<code>diff</code> revela tudo que foi escrito por cima da imagem.',
          '<code>cp</code> atravessa a fronteira, mas o que ele copia morre com o container.',
          '<code>port</code> resolve o mapeamento de portas.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td3-3-a', kind: 'guiado', title: 'Extrair campos do inspect',
        body: [
          { p: 'Pare de rolar JSON. Peça exatamente o que você quer:' },
          { code: ['$ docker run -d --name alvo -p 8080:80 -e AMBIENTE=homologacao nginx:alpine',
            '$ docker inspect alvo --format "{{.State.Status}}"',
            '$ docker inspect alvo --format "{{.NetworkSettings.IPAddress}}"',
            '$ docker inspect alvo --format "{{json .Config.Env}}"',
            '$ docker top alvo',
            '$ docker stats alvo --no-stream',
            '$ docker port alvo'] }
        ],
        hints: ['Use aspas duplas ao redor do <code>--format</code>; as chaves duplas fazem parte da sintaxe.'],
        solution: '<pre>$ docker run -d --name alvo -p 8080:80 -e AMBIENTE=homologacao nginx:alpine\n$ docker inspect alvo --format "{{.State.Status}}"\n$ docker inspect alvo --format "{{.NetworkSettings.IPAddress}}"\n$ docker inspect alvo --format "{{json .Config.Env}}"\n$ docker top alvo\n$ docker stats alvo --no-stream\n$ docker port alvo</pre>',
        check: async (ctx) => H.checkAll([
          [() => D.rodando(ctx, 'alvo'), 'Suba o container <code>alvo</code> conforme o exemplo.'],
          [() => D.env(ctx, 'alvo', 'AMBIENTE') === 'homologacao', 'O container precisa ter recebido <code>-e AMBIENTE=homologacao</code>.'],
          [() => D.publicada(ctx, 'alvo', 8080), 'Publique a porta com <code>-p 8080:80</code>.'],
          [() => H.usedCommand(ctx, /docker\s+inspect.*--format/), 'Use <code>docker inspect --format</code> para extrair campos.'],
          [() => H.usedCommand(ctx, /docker\s+top/), 'Liste os processos com <code>docker top alvo</code>.'],
          [() => H.usedCommand(ctx, /docker\s+stats/), 'Veja o consumo com <code>docker stats alvo --no-stream</code>.']
        ])
      },
      {
        id: 'td3-3-q', kind: 'quiz', title: 'Sem rolar o JSON inteiro',
        body: [
          { p: 'Você quer saber apenas se um container foi morto por falta de memória, sem rolar um JSON enorme. Qual comando responde direto a essa pergunta?' }
        ],
        options: [
          { text: '<code>docker inspect NOME --format "{{.State.OOMKilled}}"</code> — devolve <code>true</code> ou <code>false</code>, sem mais nada.', correct: true },
          { text: '<code>docker top NOME</code>', why: '<code>top</code> lista os processos em execução dentro do container; não mostra código de saída nem motivo de encerramento.' },
          { text: '<code>docker diff NOME</code>', why: '<code>diff</code> mostra o que foi alterado no sistema de arquivos em relação à imagem — nada relacionado a memória.' },
          { text: '<code>docker stats NOME --no-stream</code>', why: '<code>stats</code> mostra o consumo atual de um container em execução. Um container já morto não aparece mais nele, e a saída não indica a causa histórica da morte.' }
        ],
        explain: 'O JSON do <code>inspect</code> é grande porque guarda tudo — configuração, rede, montagens, histórico. Pedir um campo específico com <code>--format</code> é a forma de usar isso no dia a dia. <code>.State.OOMKilled</code> responde exatamente à pergunta "foi o kernel que matou por falta de memória?".'
      },
      {
        id: 'td3-3-b', kind: 'desafio', title: 'Levantar a ficha de um container',
        body: [
          { p: 'Existe um container chamado <code>producao</code> rodando nesta máquina. Sem entrar nele, monte um arquivo <code>~/ficha.txt</code> com <strong>exatamente quatro linhas</strong>, nesta ordem:' },
          { code: ['<estado>', '<imagem>', '<IP na rede>', '<porta publicada no host>'], run: false, lang: 'text' },
          { p: 'Cada linha deve conter apenas o valor, sem rótulo. Use <code>docker inspect --format</code> para obter cada um.' }
        ],
        hints: [
          'Estado: <code>{{.State.Status}}</code>. Imagem: <code>{{.Config.Image}}</code>.',
          'IP: <code>{{.NetworkSettings.IPAddress}}</code>.',
          'Porta publicada: o <code>docker port producao</code> mostra; para pegar só o número, um <code>cut -d: -f2</code> resolve.',
          'Acumule com <code>&gt;</code> na primeira linha e <code>&gt;&gt;</code> nas seguintes.'
        ],
        solution: '<pre>$ docker inspect producao --format "{{.State.Status}}" &gt; ~/ficha.txt\n$ docker inspect producao --format "{{.Config.Image}}" &gt;&gt; ~/ficha.txt\n$ docker inspect producao --format "{{.NetworkSettings.IPAddress}}" &gt;&gt; ~/ficha.txt\n$ docker port producao 80 | cut -d: -f2 &gt;&gt; ~/ficha.txt\n$ cat ~/ficha.txt</pre>',
        check: async (ctx) => {
          const c = D.container(ctx, 'producao');
          const texto = H.read(ctx, '/home/aluno/ficha.txt');
          const linhas = (texto || '').trim().split('\n').map(l => l.trim());
          return H.checkAll([
            [() => !!c, 'O container <code>producao</code> precisa existir.'],
            [() => texto !== null, 'Crie o arquivo <code>~/ficha.txt</code>.'],
            [() => linhas.length === 4, () => `O arquivo tem ${linhas.length} linha(s); precisa ter exatamente 4.`],
            [() => linhas[0] === c.estado, () => `A primeira linha deveria ser o estado do container (<code>${c.estado}</code>).`],
            [() => linhas[1] === c.imagemRef, () => `A segunda linha deveria ser a imagem (<code>${c.imagemRef}</code>).`],
            [() => linhas[2] === c.ip, () => `A terceira linha deveria ser o IP do container (<code>${c.ip}</code>). Pegue com <code>{{.NetworkSettings.IPAddress}}</code>.`],
            [() => linhas[3] === String((c.portas[0] || {}).hostPort),
              () => `A quarta linha deveria ser a porta publicada no host (<code>${(c.portas[0] || {}).hostPort}</code>), só o número.`]
          ]);
        }
      }
    ]
  });
})();
