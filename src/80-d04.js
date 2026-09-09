/* =========================================================================
   MÓDULO D04 — As flags do docker run
   Cada flag explicada por inteiro: o que faz, quando usar, quando não
   usar, o erro que ela causa e a opção parecida com que se confunde.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 4.1 ============================== */
  LX.lesson('d04', {
    id: 'ld4-1', n: '4.1', title: 'Dissecando um comando inteiro',
    goal: 'Ler qualquer linha de `docker run` sabendo o papel de cada pedaço, e entender -i, -t e -d a fundo.',
    body: [
      { h2: 'A linha que todo tutorial mostra' },
      { code: ['docker run -d -p 8080:80 --name nginx nginx'], run: false, lang: 'bash' },
      { p: 'Ela tem seis partes, e uma delas engana:' },
      {
        table: {
          head: ['Pedaço', 'O que é'],
          rows: [
            ['<code>docker</code>', 'o cliente de linha de comando'],
            ['<code>run</code>', 'o subcomando: criar e iniciar um container'],
            ['<code>-d</code>', 'em segundo plano; devolve o terminal'],
            ['<code>-p 8080:80</code>', 'porta 8080 do <strong>servidor</strong> → porta 80 <strong>do container</strong>'],
            ['<code>--name nginx</code>', 'o nome do <strong>container</strong>'],
            ['<code>nginx</code>', 'a <strong>imagem</strong> — o último <code>nginx</code> é outra coisa']
          ]
        }
      },
      {
        box: 'note', label: 'Os dois "nginx" não são a mesma coisa', body: [
          { p: 'O primeiro é nome de container (escolha sua). O segundo é nome de imagem (existe no Docker Hub). Coincidem no exemplo porque o autor não teve imaginação — e isso confunde muita gente. Escreva <code>--name meu-site nginx:alpine</code> e a confusão some.' }
        ]
      },

      { h2: '-i, -t e -it: as três letras mais mal explicadas' },
      { p: 'Elas não são a mesma coisa nem dependem uma da outra. Cada uma resolve um problema separado.' },
      {
        table: {
          head: ['Flag', 'Significa', 'Sem ela'],
          rows: [
            ['<code>-i</code>', '<em>interactive</em>: mantém o <code>stdin</code> aberto e conectado', 'o processo lê EOF na primeira leitura e encerra'],
            ['<code>-t</code>', '<em>tty</em>: aloca um terminal virtual', 'sem prompt, sem cores, sem edição de linha, sem <kbd>Ctrl+C</kbd>'],
            ['<code>-d</code>', '<em>detach</em>: solta o container em segundo plano', 'o terminal fica preso mostrando a saída']
          ]
        }
      },
      { p: 'Experimente a diferença, é a melhor forma de gravar:' },
      { code: ['$ docker run --rm alpine sh', '$ docker run --rm -i alpine sh', '$ docker run --rm -it alpine sh'] },
      {
        ul: [
          'O primeiro sai na hora: sem <code>-i</code>, o <code>sh</code> não tem de onde ler.',
          'O segundo aceita comandos digitados, mas sem prompt e sem eco — parece travado.',
          'O terceiro dá um shell de verdade. Saia com <code>exit</code>.'
        ]
      },
      {
        box: 'key', label: '-d e -it são opostos', body: [
          { p: '<code>-d</code> quer dizer "não me prenda ao container". <code>-it</code> quer dizer "me conecte ao container". Usar <code>-dit</code> não é erro — cria um container em segundo plano <em>com</em> terminal alocado, para você entrar depois com <code>docker attach</code>. Mas em servidor isso é raro: para entrar depois, o certo é <code>docker exec -it</code>.' }
        ]
      },

      { h2: '/bin/sh, /bin/bash e o que a imagem tem' },
      { p: 'Quando você escreve <code>docker run -it ubuntu bash</code>, o <code>bash</code> não é uma palavra mágica: é o caminho de um executável que precisa existir dentro daquela imagem.' },
      {
        table: {
          head: ['Base da imagem', 'Shells disponíveis'],
          rows: [
            ['<code>alpine</code> e derivadas (<code>-alpine</code>)', 'apenas <code>/bin/sh</code> (BusyBox ash)'],
            ['<code>debian</code>, <code>ubuntu</code>, <code>-slim</code>', '<code>/bin/sh</code> (dash) e <code>/bin/bash</code>'],
            ['<code>scratch</code>, distroless', 'nenhum — não há shell'],
          ]
        }
      },
      { p: 'E há uma diferença real entre os dois shells: <code>sh</code> é POSIX puro. Coisas do bash como <code>[[ ]]</code>, arrays e <code>${var,,}</code> não funcionam nele. Se um script começa com <code>#!/bin/bash</code> e a imagem só tem <code>sh</code>, ele quebra — sintoma clássico em imagem Alpine.' },

      { h2: '--rm: containers descartáveis' },
      { code: ['$ docker run --rm alpine echo teste', '$ docker ps -a | grep alpine'] },
      { p: 'Sem <code>--rm</code>, cada execução de teste deixa um container parado para trás. Com <code>--rm</code>, o container é removido assim que o processo termina — junto com os volumes <em>anônimos</em> dele.' },
      {
        ul: [
          '<strong>Use</strong> em comandos pontuais, testes e ferramentas de uso único.',
          '<strong>Não use</strong> em serviço: se você precisar do log depois que ele cair, o container já terá sumido — e o log com ele.',
          '<strong>Não combine</strong> com <code>--restart</code>: o Docker recusa, porque as duas intenções se contradizem.'
        ]
      },

      { h2: '--name' },
      { p: 'Sem nome, o Docker inventa um. Em servidor, isso é inaceitável: todo script, todo comando de investigação e todo <code>docker exec</code> precisa de um nome estável.' },
      { p: 'Um nome é único na máquina — inclusive contra containers parados. É por isso que recriar um serviço exige remover o antigo primeiro, e é por isso que a mensagem de conflito diz exatamente qual container está segurando o nome.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Opções do Docker antes da imagem; comando do container depois.',
          '<code>-i</code> mantém a entrada; <code>-t</code> dá terminal; <code>-d</code> solta em segundo plano.',
          'Alpine só tem <code>sh</code>. Um script com <code>#!/bin/bash</code> quebra lá.',
          '<code>--rm</code> para descartáveis; nunca em serviço, e nunca com <code>--restart</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td4-1-a', kind: 'guiado', title: 'Sentir a diferença entre -i, -t e -it',
        body: [
          { p: 'Rode os três e observe o comportamento de cada um:' },
          { code: ['$ docker run --rm alpine sh', '$ docker run --rm -it alpine sh'] },
          { p: 'No segundo você entra num shell. Digite <code>ls /</code>, depois <code>hostname</code>, e saia com <code>exit</code>.' },
          { p: 'Agora veja o que acontece quando o shell não existe:' },
          { code: ['$ docker run --rm -it alpine bash'] },
          { p: 'A mensagem é <code>executable file not found in $PATH</code> — não é bug, é a imagem não ter bash.' }
        ],
        hints: ['Dentro do shell do container, <code>exit</code> volta para o servidor.'],
        solution: '<pre>$ docker run --rm alpine sh\n$ docker run --rm -it alpine sh\n/ # ls /\n/ # hostname\n/ # exit\n$ docker run --rm -it alpine bash</pre>',
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+run\s+.*-it.*\balpine\b.*\bsh\b/), 'Abra um shell interativo com <code>docker run --rm -it alpine sh</code>.'],
          [() => H.usedCommand(ctx, /docker\s+run\s+.*\balpine\b.*\bbash\b/), 'Tente também <code>docker run --rm -it alpine bash</code> para ver o erro de shell inexistente.']
        ])
      },
      {
        id: 'td4-1-q', kind: 'quiz', title: 'O script que só quebra no container',
        body: [
          { p: 'Um script funciona no servidor e falha dentro de uma imagem <code>node:22-alpine</code>:' },
          { code: ['#!/bin/bash', 'if [[ -f /app/config.json ]]; then', '  echo "configuração encontrada"', 'fi'], run: false, lang: 'bash' },
          { code: ['$ docker exec app /app/checar.sh', '/app/checar.sh: no such file or directory'], run: false, lang: 'text' },
          { p: 'Por que o erro diz que o arquivo não existe, se ele está lá?' }
        ],
        options: [
          { text: 'O erro é sobre o interpretador, não sobre o script: o <em>shebang</em> aponta para <code>/bin/bash</code>, que não existe na imagem Alpine. Trocar para <code>#!/bin/sh</code> e usar <code>[ -f ... ]</code> resolve.', correct: true },
          { text: 'Falta permissão de execução no script.', why: 'Isso daria <em>Permission denied</em>, não <em>no such file or directory</em>.' },
          { text: 'O caminho <code>/app/checar.sh</code> está errado dentro do container.', why: 'É possível, mas o cenário diz que o arquivo está lá. E este erro específico, com um script que existe, aponta para o interpretador do shebang.' },
          { text: 'A imagem <code>node:22-alpine</code> não permite executar scripts.', why: 'Permite normalmente — desde que o interpretador declarado exista.' }
        ],
        explain: 'Essa mensagem confunde porque o kernel reclama do <em>interpretador</em> usando o nome do <em>script</em>. Ao executar um arquivo com shebang, o kernel tenta abrir o programa indicado; se ele não existe, o erro sai como ENOENT. Em imagem Alpine, a correção é dupla: mudar o shebang para <code>#!/bin/sh</code> e trocar as construções exclusivas do bash — <code>[[ ]]</code> vira <code>[ ]</code>. A alternativa é instalar bash na imagem (<code>RUN apk add --no-cache bash</code>), mas isso engorda a imagem por uma conveniência de sintaxe.'
      },
      {
        id: 'td4-1-b', kind: 'desafio', title: 'Montar a linha inteira, na ordem certa',
        body: [
          { p: 'Suba, em um único comando, um container chamado <code>loja</code> que:' },
          { ul: ['rode em segundo plano;', 'publique a porta 8090 do servidor na porta 80 do container;', 'venha da imagem <code>nginx:alpine</code>.'] },
          { p: 'Preste atenção à ordem: opções do Docker antes do nome da imagem.' }
        ],
        hints: [
          'São três flags antes do nome da imagem: uma para segundo plano, uma para o nome, uma para a porta.',
          'A forma é <code>docker run -d --name loja -p 8090:80 nginx:alpine</code>.'
        ],
        solution: '<pre>$ docker run -d --name loja -p 8090:80 nginx:alpine</pre>',
        check: async (ctx) => {
          const c = D.container(ctx, 'loja');
          return H.checkAll([
            [() => !!c, 'Crie o container <code>loja</code>.'],
            [() => !!c && c.rodando, 'O container <code>loja</code> precisa estar em execução — use <code>-d</code>.'],
            [() => D.publicada(ctx, 'loja', 8090), 'Publique a porta 8090 do servidor apontando para a 80 do container.'],
            [() => !!c && /nginx/.test(c.imagemRef || ''), 'A imagem precisa ser <code>nginx:alpine</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 4.2 ============================== */
  LX.lesson('d04', {
    id: 'ld4-2', n: '4.2', title: 'Portas: -p, -P e a diferença para EXPOSE',
    goal: 'Publicar portas com precisão e entender por que um container pode estar rodando sem ser alcançável.',
    body: [
      { h2: 'Toda porta é interna até você publicar' },
      { p: 'Um container tem a própria pilha de rede: o próprio IP e as próprias 65535 portas. O nginx dentro dele escuta na porta 80 <em>dele</em>. Isso não tem nenhuma relação com a porta 80 do servidor.' },
      {
        ascii: `                SERVIDOR (host)
   ┌────────────────────────────────────────────┐
   │  porta 8080  ◀── você publicou             │
   │      │                                     │
   │      │  ┌──────────────────────────────┐   │
   │      └─▶│ CONTAINER  172.18.0.2        │   │
   │         │   porta 80  ← nginx escuta   │   │
   │         └──────────────────────────────┘   │
   │                                            │
   │  porta 5432 do postgres: NÃO publicada     │
   │      → só quem está na mesma rede alcança  │
   └────────────────────────────────────────────┘`
      },
      { code: ['docker run -d -p 8080:80 nginx:alpine',
        '                 └┬─┘ └┬┘',
        '                  │    └── porta DENTRO do container',
        '                  └─────── porta NO SERVIDOR'], run: false, lang: 'text' },
      { p: 'A ordem é <strong>host:container</strong>, sempre. Inverter é o erro clássico: <code>-p 80:8080</code> publica a 80 do servidor apontando para a 8080 do container — onde não tem ninguém escutando. Resultado: <em>Connection reset</em> ou 502.' },

      { h2: 'As formas de -p' },
      {
        table: {
          head: ['Forma', 'Efeito'],
          rows: [
            ['<code>-p 8080:80</code>', 'porta 8080 de <strong>todas</strong> as interfaces do host'],
            ['<code>-p 127.0.0.1:8080:80</code>', 'só do próprio servidor — não é acessível de fora'],
            ['<code>-p 80</code>', 'porta 80 do container em uma porta alta aleatória do host'],
            ['<code>-p 8080:80/udp</code>', 'protocolo UDP em vez de TCP'],
            ['<code>-p 8000-8010:8000-8010</code>', 'uma faixa de portas'],
            ['<code>-P</code>', 'publica todas as portas do <code>EXPOSE</code> em portas altas aleatórias']
          ]
        }
      },
      {
        box: 'key', label: 'A forma que mais importa em servidor', body: [
          { p: '<code>-p 127.0.0.1:8080:80</code> deixa o serviço acessível <strong>apenas localmente</strong>. É assim que se expõe um banco de dados ou um painel administrativo em um servidor com IP público: o Traefik ou o nginx do próprio servidor alcança, mas a internet não.' },
          { p: 'Sem o IP, o Docker publica em <code>0.0.0.0</code> — e, dependendo da configuração do firewall, isso pode ficar aberto para a internet inteira sem você perceber.' }
        ]
      },
      {
        box: 'warn', label: 'O Docker e o UFW', body: [
          { p: 'Em um servidor real, o Docker manipula o <code>iptables</code> diretamente e as regras dele são avaliadas <strong>antes</strong> das do UFW. Ou seja: uma porta publicada com <code>-p 0.0.0.0:5432:5432</code> pode ficar acessível de fora mesmo com <code>ufw deny 5432</code>.' },
          { p: 'A defesa correta é não publicar: prenda no <code>127.0.0.1</code>, ou deixe o serviço apenas na rede interna do Docker, sem <code>-p</code> nenhum.' }
        ]
      },

      { h2: 'EXPOSE não publica nada' },
      { p: 'A instrução <code>EXPOSE 80</code> em um Dockerfile é <strong>documentação</strong>. Ela declara "esta imagem escuta na porta 80" — e só. Não abre porta no servidor.' },
      {
        table: {
          head: ['', '<code>EXPOSE</code> (Dockerfile)', '<code>-p</code> (docker run)'],
          rows: [
            ['O que faz', 'anota metadado na imagem', 'cria o mapeamento de verdade'],
            ['Abre porta no host?', 'não', 'sim'],
            ['Serve para', 'documentar; alimentar o <code>-P</code>', 'tornar o serviço alcançável'],
            ['Precisa dele?', 'não, mas ajuda quem lê', 'sim, para acesso de fora']
          ]
        }
      },
      { p: 'Onde <code>EXPOSE</code> tem efeito real: o <code>-P</code> publica exatamente as portas declaradas nele, e o Traefik usa a primeira porta exposta quando você não informa a porta do serviço.' },

      { h2: 'Container sem porta publicada não é container inútil' },
      { p: 'Um banco de dados em uma stack não precisa de <code>-p</code> nenhum: quem fala com ele é a API, e as duas estão na mesma rede do Docker. Publicar a porta do banco é uma decisão de segurança — e quase sempre errada.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Ordem sempre <code>host:container</code>.',
          '<code>-p 127.0.0.1:PORTA:PORTA</code> restringe ao próprio servidor.',
          '<code>EXPOSE</code> documenta; <code>-p</code> publica.',
          'O Docker escreve regras de firewall antes do UFW: não confie no UFW para fechar porta publicada.',
          'Serviço interno não precisa de porta publicada.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td4-2-a', kind: 'guiado', title: 'Publicar, conferir e derrubar',
        body: [
          { p: 'Suba dois nginx, um publicado e outro não, e compare:' },
          { code: ['$ docker run -d --name publicado -p 8080:80 nginx:alpine',
            '$ docker run -d --name interno nginx:alpine',
            '$ docker ps --format "{{.Names}}  {{.Ports}}"',
            '$ curl -s -o /dev/null -w "%{http_code}\\n" localhost:8080',
            '$ sudo ss -tlnp | grep 8080'] },
          { p: 'O container <code>interno</code> está rodando e servindo — só não há caminho até ele a partir do servidor.' }
        ],
        hints: ['O <code>ss -tlnp</code> é o mesmo do módulo de redes do curso de Linux.'],
        solution: '<pre>$ docker run -d --name publicado -p 8080:80 nginx:alpine\n$ docker run -d --name interno nginx:alpine\n$ docker ps --format "{{.Names}}  {{.Ports}}"\n$ curl -s -o /dev/null -w "%{http_code}\\n" localhost:8080\n$ sudo ss -tlnp | grep 8080</pre>',
        check: async (ctx) => {
          const resp = D.http(ctx, 'localhost', 8080, '/');
          return H.checkAll([
            [() => D.rodando(ctx, 'publicado'), 'Suba o container <code>publicado</code> com <code>-p 8080:80</code>.'],
            [() => D.publicada(ctx, 'publicado', 8080), 'O container <code>publicado</code> precisa ter a porta 8080 publicada.'],
            [() => D.rodando(ctx, 'interno'), 'Suba também o container <code>interno</code>, sem publicar porta.'],
            [() => D.container(ctx, 'interno').portas.length === 0, 'O container <code>interno</code> não deveria publicar porta nenhuma — é esse o contraste do exercício.'],
            [() => !!resp && resp.status === 200, 'A porta 8080 do servidor ainda não responde. Confira o mapeamento.'],
            [() => H.usedCommand(ctx, /\bss\b|netstat/), 'Confirme a porta aberta no servidor com <code>sudo ss -tlnp | grep 8080</code>.']
          ]);
        }
      },
      {
        id: 'td4-2-q', kind: 'quiz', title: 'O UFW que não bloqueou nada',
        body: [
          { p: 'Um banco de dados foi publicado com <code>-p 5432:5432</code> em vez de <code>-p 127.0.0.1:5432:5432</code>. O servidor tem uma regra <code>ufw deny 5432</code> ativa. Mesmo assim, a porta continua acessível pela internet. Por quê?' }
        ],
        options: [
          { text: 'O Docker escreve as próprias regras no <code>iptables</code>, avaliadas <strong>antes</strong> das do UFW. Uma porta publicada sem IP fica em <code>0.0.0.0</code>, e o UFW nunca chega a ver esse tráfego. A correção é publicar com <code>127.0.0.1</code>, não confiar no firewall.', correct: true },
          { text: 'Faltou <code>sudo systemctl restart ufw</code> depois de criar a regra.', why: 'Reiniciar o UFW não muda a ordem em que o kernel avalia as regras do Docker antes das dele.' },
          { text: '<code>docker run</code> ignora o firewall só na primeira execução depois do boot.', why: 'Não existe essa exceção temporária; o comportamento é sempre o mesmo enquanto a porta estiver publicada sem restrição de IP.' },
          { text: '<code>-p 5432:5432</code> não expõe a porta de verdade, só documenta — quem expõe é o <code>EXPOSE</code>.', why: 'Isso descreve o <code>EXPOSE</code> do Dockerfile. O <code>-p</code> do <code>docker run</code> sempre cria o mapeamento real, abrindo a porta no host.' }
        ],
        explain: 'É a armadilha descrita na aula: o Docker manipula o <code>iptables</code> diretamente, e essas regras entram antes das do UFW. Uma porta publicada com <code>-p PORTA:PORTA</code> (sem IP) escuta em todas as interfaces, inclusive a pública, e o UFW não consegue bloqueá-la. A defesa correta é não publicar sem necessidade, ou prender a publicação em <code>127.0.0.1</code>.'
      },
      {
        id: 'td4-2-b', kind: 'desafio', title: 'Fechar um painel exposto',
        body: [
          { p: 'Alguém subiu um painel administrativo assim:' },
          { code: ['docker run -d --name painel -p 8081:80 nginx:alpine'], run: false, lang: 'bash' },
          { p: 'Isso deixa a porta 8081 aberta em <strong>todas</strong> as interfaces do servidor — inclusive na pública. A política da equipe é que painéis administrativos só podem ser alcançados a partir do próprio servidor.' },
          { p: 'Recrie o container de forma que:' },
          { ul: [
            'ele continue se chamando <code>painel</code>;',
            'a porta 8081 seja alcançável <strong>apenas</strong> em <code>127.0.0.1</code>;',
            '<code>curl localhost:8081</code> continue funcionando.'
          ] }
        ],
        hints: [
          'Não dá para mudar o mapeamento de porta de um container existente: é preciso remover e criar de novo.',
          'A forma completa do <code>-p</code> aceita um IP na frente: <code>-p IP:HOST:CONTAINER</code>.',
          'A linha final é <code>docker run -d --name painel -p 127.0.0.1:8081:80 nginx:alpine</code> — depois de remover o antigo com <code>docker rm -f painel</code>.'
        ],
        solution: '<pre>$ docker rm -f painel\n$ docker run -d --name painel -p 127.0.0.1:8081:80 nginx:alpine\n$ docker port painel\n80/tcp -&gt; 127.0.0.1:8081\n$ curl -s -o /dev/null -w "%{http_code}\\n" localhost:8081\n200</pre>',
        setup: (m) => {
          if (m.docker && !m.docker.containerPorNome('painel')) {
            LX.D.montar(m, {
              imagem: 'nginx:alpine', nome: 'painel',
              portas: [{ hostIp: '0.0.0.0', hostPort: 8081, contPort: 80, proto: 'tcp' }]
            });
          }
        },
        check: async (ctx) => {
          const c = D.container(ctx, 'painel');
          const p = c && c.portas.find(x => x.hostPort === 8081);
          const resp = D.http(ctx, 'localhost', 8081, '/');
          return H.checkAll([
            [() => !!c, 'O container <code>painel</code> precisa continuar existindo.'],
            [() => !!c && c.rodando, 'O container <code>painel</code> precisa estar em execução.'],
            [() => !!p, 'A porta 8081 do servidor precisa continuar levando ao container.'],
            [() => !!p && p.hostIp === '127.0.0.1',
              () => `A porta 8081 ainda está publicada em <code>${p ? p.hostIp : '?'}</code>. Recrie o container com <code>-p 127.0.0.1:8081:80</code>.`],
            [() => !!p && p.contPort === 80, 'A porta de destino dentro do container é a 80, onde o nginx escuta.'],
            [() => !!resp && resp.status === 200, 'O <code>curl localhost:8081</code> precisa continuar respondendo 200.']
          ]);
        }
      }
    ]
  });

  /* ============================== 4.3 ============================== */
  LX.lesson('d04', {
    id: 'ld4-3', n: '4.3', title: 'Variáveis, usuário, diretório e entrypoint',
    goal: 'Configurar um container sem reconstruir a imagem, e conhecer as flags que mudam quem e onde o processo roda.',
    body: [
      { h2: 'Variáveis de ambiente: -e e --env-file' },
      { p: 'É o principal canal de configuração de um container. A mesma imagem vira desenvolvimento ou produção só trocando as variáveis.' },
      { code: ['$ docker run -d --name db -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja mariadb:11.4',
        '$ docker exec db env | grep MARIADB'] },
      { p: 'Três formas de passar:' },
      {
        table: {
          head: ['Forma', 'Comportamento'],
          rows: [
            ['<code>-e CHAVE=valor</code>', 'define explicitamente'],
            ['<code>-e CHAVE</code>', 'copia o valor da variável de mesmo nome do <em>seu</em> shell'],
            ['<code>--env-file arquivo</code>', 'lê um arquivo com uma linha <code>CHAVE=valor</code> por variável']
          ]
        }
      },
      {
        box: 'warn', label: 'O arquivo do --env-file não é um script', body: [
          { p: 'Ele parece um shell script, mas não é. Não há expansão de variáveis, não se usa <code>export</code>, e as aspas <strong>fazem parte do valor</strong>:' },
          { code: ['# certo', 'SENHA_DO_BANCO=abc123', 'MODO=producao', '', '# errado — vira parte do valor ou não funciona',
            'export SENHA_DO_BANCO=abc123', 'SENHA_DO_BANCO="abc123"', 'URL=http://$HOST/api'], run: false, lang: 'text' },
          { p: 'Linhas começando com <code>#</code> são comentários; um <code>#</code> no meio da linha faz parte do valor.' }
        ]
      },
      {
        box: 'key', label: 'Variável de ambiente não é lugar para segredo', body: [
          { p: 'Qualquer pessoa com acesso ao daemon lê tudo com <code>docker inspect</code>. As variáveis também aparecem em <code>docker exec CONTAINER env</code> e no <code>/proc</code> do host.' },
          { p: 'Para desenvolvimento e para credenciais internas, funciona. Para segredo de verdade em produção, existe o mecanismo de <em>secrets</em> — módulo de ambiente e segredos, mais adiante.' },
          { p: 'Neste curso, toda credencial é fictícia: <code>SENHA_DO_BANCO</code>, <code>HASH_KEY</code>, <code>DATABASE_URL</code>. Nunca escreva uma senha real em exemplo, histórico de shell ou repositório.' }
        ]
      },

      { h2: '--user: não rodar como root' },
      { p: 'Por padrão, o processo dentro do container roda como <code>root</code>. É root de dentro do namespace, com poderes reduzidos — mas ainda assim é a conta mais poderosa daquele ambiente, e um dos primeiros itens de qualquer revisão de segurança.' },
      { code: ['$ docker run --rm alpine id', '$ docker run --rm -u 1000:1000 alpine id', '$ docker run --rm -u nobody alpine id'] },
      { p: 'O ideal é a própria imagem já definir <code>USER</code> no Dockerfile. O <code>-u</code> serve para forçar em uma imagem que não fez isso, e para o caso oposto: entrar como root em um container que roda sem privilégio, para instalar uma ferramenta de diagnóstico.' },
      { code: ['$ docker exec -u root -it app sh'] },

      { h2: '-w: diretório de trabalho' },
      { code: ['$ docker run --rm alpine pwd', '$ docker run --rm -w /etc alpine pwd', '$ docker run --rm -w /etc alpine ls'] },
      { p: 'Equivale ao <code>WORKDIR</code> do Dockerfile, aplicado só naquela execução. Se o diretório não existir, o Docker cria.' },

      { h2: '--entrypoint: trocar o programa principal' },
      { p: 'Toda imagem tem um <code>ENTRYPOINT</code> (o executável) e um <code>CMD</code> (os argumentos padrão). O que você escreve depois do nome da imagem substitui o <code>CMD</code>. Para substituir o <code>ENTRYPOINT</code>, é preciso a flag:' },
      { code: ['$ docker run --rm --entrypoint sh mariadb:11.4 -c "echo entrei sem subir o banco"'] },
      { p: 'Esse é o truque para <strong>investigar uma imagem que não sobe</strong>: em vez de deixar o entrypoint rodar e falhar, você o substitui por um shell e olha o que tem lá dentro.' },
      {
        box: 'note', label: 'Ver o que a imagem define', body: [
          { code: ['$ docker inspect nginx:alpine --format "ENTRYPOINT={{json .Config.Entrypoint}} CMD={{json .Config.Cmd}}"'], run: false, lang: 'bash' },
          { p: 'Vale o hábito: antes de discutir por que um container não sobe, olhe qual é o comando dele.' }
        ]
      },

      { h2: '--hostname e --read-only' },
      { code: ['$ docker run --rm -h servidor-fake alpine hostname',
        '$ docker run --rm --read-only alpine sh -c \'echo teste > /arquivo\''] },
      { p: 'O <code>--read-only</code> monta o sistema de arquivos raiz como somente leitura. É uma das medidas de segurança mais eficazes e mais baratas: se a aplicação não precisa escrever, ela não deveria poder. Quando ela precisa de um diretório temporário, combine com <code>--tmpfs /tmp</code>.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>-e</code>, <code>--env-file</code>: configuração sem reconstruir a imagem.',
          'O <code>--env-file</code> não é script: sem <code>export</code>, sem expansão, aspas contam.',
          'Variável de ambiente é legível por qualquer um com acesso ao daemon.',
          '<code>-u</code> troca o usuário; <code>-w</code> troca o diretório.',
          '<code>--entrypoint sh</code> é o jeito de investigar uma imagem que não sobe.',
          '<code>--read-only</code> impede escrita no sistema de arquivos raiz.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td4-3-a', kind: 'guiado', title: 'Configurar pela linha de comando',
        body: [
          { p: 'Crie um arquivo de variáveis e use-o:' },
          { code: ['$ printf "MODO=homologacao\\nDATABASE_URL=mysql://app:SENHA_DO_BANCO@db:3306/loja\\n" > ~/app.env',
            '$ cat ~/app.env',
            '$ docker run --rm --env-file ~/app.env alpine env | grep -E "MODO|DATABASE"',
            '$ docker run --rm -e MODO=producao --env-file ~/app.env alpine env | grep MODO'] },
          { p: 'Repare no último: o <code>-e</code> na linha de comando vence o arquivo. Essa precedência é a base de "o mesmo compose, com um ajuste por ambiente".' }
        ],
        hints: ['O <code>printf</code> com <code>\\n</code> cria as duas linhas de uma vez.'],
        solution: '<pre>$ printf "MODO=homologacao\\nDATABASE_URL=mysql://app:SENHA_DO_BANCO@db:3306/loja\\n" &gt; ~/app.env\n$ docker run --rm --env-file ~/app.env alpine env | grep -E "MODO|DATABASE"\n$ docker run --rm -e MODO=producao --env-file ~/app.env alpine env | grep MODO</pre>',
        check: async (ctx) => {
          const arq = H.read(ctx, '/home/aluno/app.env');
          return H.checkAll([
            [() => arq !== null, 'Crie o arquivo <code>~/app.env</code> com as variáveis.'],
            [() => /MODO=/.test(arq || '') && /DATABASE_URL=/.test(arq || ''), 'O arquivo precisa ter as duas variáveis, no formato <code>CHAVE=valor</code>.'],
            [() => H.usedCommand(ctx, /--env-file/), 'Use o arquivo com <code>docker run --rm --env-file ~/app.env alpine env</code>.'],
            [() => H.usedCommand(ctx, /-e\s+MODO=/), 'Teste também a precedência, passando <code>-e MODO=producao</code> junto com o <code>--env-file</code>.']
          ]);
        }
      },
      {
        id: 'td4-3-q', kind: 'quiz', title: 'O $HOST que não virou nada',
        body: [
          { p: 'Alguém escreve num arquivo de <code>--env-file</code> a linha <code>URL=http://$HOST/api</code>, esperando que o Docker substitua <code>$HOST</code> pelo valor de uma variável definida antes com <code>-e HOST=api.interno</code>. O container recebe a URL com <code>$HOST</code> escrito ao pé da letra. Por quê?' }
        ],
        options: [
          { text: 'O arquivo de <code>--env-file</code> não é um shell script: não há expansão de variáveis nem processamento de <code>$</code> ali dentro. Cada linha é lida literalmente, como <code>CHAVE=valor</code>.', correct: true },
          { text: 'Faltou colocar <code>export</code> na frente da variável no arquivo.', why: '<code>export</code> também não funciona nesse arquivo — vira parte literal do valor, não uma instrução executada.' },
          { text: 'A variável <code>HOST</code> precisava vir depois de <code>URL</code> no arquivo, na ordem certa.', why: 'Ordem não importa, porque não há processamento nenhum: o arquivo não expande <code>$HOST</code> em nenhuma posição.' },
          { text: 'Faltaram aspas ao redor do valor: <code>URL="http://$HOST/api"</code>.', why: 'Aspas em <code>--env-file</code> viram parte literal do valor — elas não ajudam a expandir nada, porque o arquivo não é interpretado como shell.' }
        ],
        explain: 'O <code>--env-file</code> parece um shell script, mas não é: não existe <code>export</code>, não existe expansão de <code>$VAR</code>, e as aspas entram no valor tal como escritas. Para compor uma URL com uma variável, a alternativa é montar o valor já pronto — direto no arquivo, ou passando o valor final com <code>-e URL=http://api.interno/api</code>.'
      },
      {
        id: 'td4-3-b', kind: 'desafio', title: 'Espiar dentro de uma imagem que não sobe',
        body: [
          { p: 'A imagem <code>mariadb:11.4</code> encerra imediatamente quando você a roda sem senha. Você precisa descobrir <strong>o que existe dentro dela</strong> sem deixar o banco tentar subir.' },
          { ol: [
            'Rode um container dessa imagem substituindo o programa principal por um shell.',
            'Liste o conteúdo de <code>/docker-entrypoint-initdb.d</code>.',
            'Grave em <code>~/entrypoint.txt</code> qual é o <code>ENTRYPOINT</code> e qual é o <code>CMD</code> da imagem.'
          ] },
          { p: 'O arquivo pode ter o formato que você quiser, desde que contenha os dois valores.' }
        ],
        hints: [
          'Para trocar o programa principal existe uma flag do <code>docker run</code>: <code>--entrypoint</code>.',
          '<code>docker run --rm --entrypoint sh mariadb:11.4 -c "ls -la /docker-entrypoint-initdb.d"</code>.',
          'Para os metadados: <code>docker inspect mariadb:11.4 --format "{{json .Config.Entrypoint}} {{json .Config.Cmd}}" &gt; ~/entrypoint.txt</code>.'
        ],
        solution: '<pre>$ docker run --rm --entrypoint sh mariadb:11.4 -c "ls -la /docker-entrypoint-initdb.d"\n$ docker inspect mariadb:11.4 --format "{{json .Config.Entrypoint}} {{json .Config.Cmd}}" &gt; ~/entrypoint.txt\n$ cat ~/entrypoint.txt</pre>',
        check: async (ctx) => {
          const texto = H.read(ctx, '/home/aluno/entrypoint.txt') || '';
          return H.checkAll([
            [() => H.usedCommand(ctx, /--entrypoint/), 'Use <code>--entrypoint</code> para substituir o programa principal por um shell.'],
            [() => H.usedCommand(ctx, /docker-entrypoint-initdb\.d/), 'Liste o conteúdo de <code>/docker-entrypoint-initdb.d</code> dentro do container.'],
            [() => texto.trim() !== '', 'Grave os metadados em <code>~/entrypoint.txt</code>.'],
            [() => /docker-entrypoint\.sh/.test(texto), 'O arquivo precisa conter o <code>ENTRYPOINT</code> real da imagem. Pegue com <code>docker inspect --format "{{json .Config.Entrypoint}}"</code>.'],
            [() => /mariadbd/.test(texto), 'Falta o <code>CMD</code> da imagem no arquivo. Ele está em <code>{{json .Config.Cmd}}</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 4.4 ============================== */
  LX.lesson('d04', {
    id: 'ld4-4', n: '4.4', title: 'restart, limites e o resto das flags',
    goal: 'Fechar o repertório de flags do run: políticas de reinício, limites de recursos e as opções de segurança.',
    body: [
      { h2: '--restart: o que fazer quando o processo morre' },
      {
        table: {
          head: ['Política', 'Comportamento'],
          rows: [
            ['<code>no</code>', 'padrão: não reinicia nunca'],
            ['<code>on-failure[:N]</code>', 'reinicia só se o código de saída for diferente de zero; com <code>:N</code>, no máximo N vezes'],
            ['<code>always</code>', 'reinicia sempre, inclusive quando o daemon é reiniciado — mesmo se você tiver parado o container à mão'],
            ['<code>unless-stopped</code>', 'como <code>always</code>, mas respeita a sua decisão: se você parou, continua parado depois de um reboot']
          ]
        }
      },
      {
        box: 'key', label: 'Qual usar em servidor', body: [
          { p: '<code>unless-stopped</code>, quase sempre. A diferença para <code>always</code> aparece exatamente no pior momento: você parou um serviço para investigar, o servidor reinicia por qualquer motivo, e com <code>always</code> ele volta sozinho no meio da manutenção.' },
          { p: '<code>on-failure:3</code> é a escolha certa para tarefas que devem tentar algumas vezes e depois desistir — sem virar um laço infinito.' }
        ]
      },
      { p: 'Repare em duas regras do daemon:' },
      {
        ul: [
          '<code>--restart</code> e <code>--rm</code> são incompatíveis, e o Docker recusa a combinação.',
          'Se você parar o container com <code>docker stop</code>, a política é ignorada até você iniciá-lo de novo ou o daemon reiniciar.'
        ]
      },
      {
        box: 'warn', label: 'Restart não conserta nada', body: [
          { p: 'Um container que sobe e morre em dois segundos, com <code>--restart always</code>, entra em laço: sobe, morre, sobe. O <code>docker ps</code> mostra <code>Restarting (1)</code> e o <code>RestartCount</code> cresce sem parar.' },
          { p: 'A política de reinício é para falhas <em>transitórias</em>. Para falha de configuração, ela só transforma um erro visível em um erro que se repete para sempre. Quando ver um laço de reinício, o comando é <code>docker logs</code> — não aumentar o número de tentativas.' }
        ]
      },

      { h2: 'Limites de recursos' },
      { code: ['$ docker run -d --name limitado --memory 256m --cpus 0.5 nginx:alpine',
        '$ docker inspect limitado --format "{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}"',
        '$ docker stats limitado --no-stream'] },
      {
        table: {
          head: ['Flag', 'Efeito'],
          rows: [
            ['<code>--memory 512m</code>', 'teto de memória. Ultrapassou, o kernel mata o processo (exit 137)'],
            ['<code>--memory-reservation 256m</code>', 'limite <em>flexível</em>: sob pressão de memória, o kernel cobra deste primeiro'],
            ['<code>--cpus 1.5</code>', 'no máximo 1,5 núcleo de tempo de CPU'],
            ['<code>--pids-limit 100</code>', 'teto de processos, contra <em>fork bombs</em>'],
            ['<code>--restart</code>', 'política de reinício (acima)']
          ]
        }
      },
      { p: 'Em servidor compartilhado, limitar memória não é otimização — é isolamento de falha. Sem limite, um vazamento em um container derruba todos os outros junto.' },

      { h2: 'Segurança em uma linha' },
      { code: ['$ docker run -d --name seguro \\',
        '    --read-only --tmpfs /tmp \\',
        '    --cap-drop ALL --cap-add NET_BIND_SERVICE \\',
        '    --security-opt no-new-privileges:true \\',
        '    -u 1000:1000 \\',
        '    nginx:alpine'], run: false, lang: 'bash' },
      {
        ul: [
          '<code>--read-only</code> — a raiz não aceita escrita',
          '<code>--tmpfs /tmp</code> — mas há um diretório temporário em memória, que some junto com o container',
          '<code>--cap-drop ALL</code> — remove todas as capabilities do root e devolve só a necessária',
          '<code>--security-opt no-new-privileges:true</code> — nenhum processo lá dentro consegue escalar privilégio',
          '<code>-u</code> — não roda como root'
        ]
      },
      { p: 'Cada uma dessas será destrinchada no módulo de segurança. Guarde por enquanto a ideia: <strong>tirar poder é barato</strong>, e a maioria das aplicações não sente falta.' },

      { h2: 'Onde encontrar o resto' },
      { p: 'O <code>docker run</code> tem mais de cem opções. Você não precisa decorá-las — precisa saber consultar:' },
      { code: ['$ docker run --help | head -40', '$ docker run --help | grep -i memory'] },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>unless-stopped</code> é a política padrão sensata em servidor.',
          'Laço de reinício é sintoma; a resposta está no <code>docker logs</code>.',
          '<code>--memory</code> e <code>--cpus</code> impedem que um container derrube a máquina.',
          'Tirar privilégio (<code>--read-only</code>, <code>--cap-drop</code>, <code>-u</code>) custa pouco e protege muito.'
        ]
      },
      { h2: 'Próximo passo' },
      { p: 'Você já sabe rodar e investigar containers. O próximo módulo entra no que está por trás deles: as imagens.' }
    ],
    tasks: [
      {
        id: 'td4-4-a', kind: 'guiado', title: 'Ver a política e os limites aplicados',
        body: [
          { p: 'Suba dois containers com flags diferentes e confira, sem rolar o JSON inteiro, que cada uma foi aplicada:' },
          { code: ['$ docker run -d --name resiliente --restart unless-stopped nginx:alpine',
            '$ docker inspect resiliente --format "{{.HostConfig.RestartPolicy.Name}}"',
            '$ docker run -d --name limitado --memory 128m --cpus 0.5 nginx:alpine',
            '$ docker inspect limitado --format "{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}"'] },
          { p: 'Os valores batem exatamente com o que você pediu: a política de reinício, e os limites já convertidos para bytes e nanocpus.' }
        ],
        hints: ['Rode em pares: primeiro cria o container com a flag, depois confira com <code>docker inspect --format</code>.'],
        solution: '<pre>$ docker run -d --name resiliente --restart unless-stopped nginx:alpine\n$ docker inspect resiliente --format "{{.HostConfig.RestartPolicy.Name}}"\n$ docker run -d --name limitado --memory 128m --cpus 0.5 nginx:alpine\n$ docker inspect limitado --format "{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}"</pre>',
        check: async (ctx) => {
          const c1 = D.container(ctx, 'resiliente'), c2 = D.container(ctx, 'limitado');
          return H.checkAll([
            [() => !!c1 && c1.restart && c1.restart.politica === 'unless-stopped', 'Suba o <code>resiliente</code> com <code>--restart unless-stopped</code>.'],
            [() => !!c2 && c2.recursos && c2.recursos.memoria === 128 * 1024 * 1024, 'Suba o <code>limitado</code> com <code>--memory 128m</code>.'],
            [() => !!c2 && Math.abs((c2.recursos.cpus || 0) - 0.5) < 0.001, 'Aplique também <code>--cpus 0.5</code> no <code>limitado</code>.'],
            [() => H.usedCommand(ctx, /docker\s+inspect.*--format/), 'Confira os valores com <code>docker inspect --format</code>, sem rolar o JSON inteiro.']
          ]);
        }
      },
      {
        id: 'td4-4-q', kind: 'quiz', title: 'always ou unless-stopped',
        body: [
          { p: 'Você para um container para investigar um problema:' },
          { code: ['$ docker stop api'], run: false, lang: 'bash' },
          { p: 'Enquanto você investiga, o servidor reinicia por causa de uma atualização de kernel. Com <code>--restart always</code>, o que acontece com o <code>api</code>?' }
        ],
        options: [
          { text: 'Ele volta sozinho, porque <code>always</code> reinicia o container quando o daemon sobe, mesmo que você o tivesse parado à mão. Com <code>unless-stopped</code>, ele continuaria parado.', correct: true },
          { text: 'Continua parado nos dois casos: parada manual sempre vence.', why: 'Isso vale para <code>unless-stopped</code>. Com <code>always</code>, o reinício do daemon ressuscita o container.' },
          { text: 'Depende do código de saída da parada.', why: 'Código de saída importa para <code>on-failure</code>, não para <code>always</code> nem para <code>unless-stopped</code>.' },
          { text: 'O Docker pergunta antes de subir.', why: 'O daemon não faz perguntas ao aplicar políticas de reinício.' }
        ],
        explain: 'É exatamente essa a diferença entre as duas políticas, e ela só aparece na pior hora. <code>always</code> ignora que você parou o container de propósito; <code>unless-stopped</code> guarda essa informação e a respeita depois do reboot. Por isso a recomendação prática em servidor é <code>unless-stopped</code> para serviços e <code>on-failure:N</code> para tarefas que podem desistir.'
      },
      {
        id: 'td4-4-b', kind: 'desafio', title: 'Um container com política e limites',
        body: [
          { p: 'Suba um container chamado <code>servico-web</code> que atenda a todos estes requisitos ao mesmo tempo:' },
          { ul: [
            'imagem <code>nginx:alpine</code>, em segundo plano;',
            'porta 8082 do servidor levando à porta 80 do container;',
            'política de reinício <code>unless-stopped</code>;',
            'no máximo 256 MB de memória;',
            'no máximo meio núcleo de CPU;',
            'a variável de ambiente <code>AMBIENTE</code> com o valor <code>producao</code>.'
          ] },
          { p: 'Confirme no fim com <code>docker inspect</code> que tudo foi aplicado.' }
        ],
        hints: [
          'São cinco flags além do <code>-d</code> e do nome: <code>-p</code>, <code>--restart</code>, <code>--memory</code>, <code>--cpus</code> e <code>-e</code>.',
          '256 MB se escreve <code>256m</code>; meio núcleo se escreve <code>0.5</code>.',
          'Para conferir: <code>docker inspect servico-web --format "{{.HostConfig.RestartPolicy.Name}} {{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}"</code>.'
        ],
        solution: '<pre>$ docker run -d --name servico-web \\\n    -p 8082:80 \\\n    --restart unless-stopped \\\n    --memory 256m \\\n    --cpus 0.5 \\\n    -e AMBIENTE=producao \\\n    nginx:alpine\n$ docker inspect servico-web --format "{{.HostConfig.RestartPolicy.Name}} {{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}"\nunless-stopped 268435456 500000000</pre>',
        check: async (ctx) => {
          const c = D.container(ctx, 'servico-web');
          return H.checkAll([
            [() => !!c, 'Ainda não existe o container <code>servico-web</code>.'],
            [() => !!c && c.rodando, 'O container precisa estar em execução (<code>-d</code>).'],
            [() => !!c && /nginx/.test(c.imagemRef || ''), 'A imagem precisa ser <code>nginx:alpine</code>.'],
            [() => D.publicada(ctx, 'servico-web', 8082), 'Falta publicar a porta: <code>-p 8082:80</code>.'],
            [() => !!c && c.restart.politica === 'unless-stopped',
              () => `A política de reinício está como <code>${c.restart.politica}</code>; precisa ser <code>unless-stopped</code>.`],
            [() => !!c && c.recursos.memoria === 256 * 1024 * 1024,
              () => `O limite de memória está como <code>${c.recursos.memoria || 'nenhum'}</code>. Use <code>--memory 256m</code>.`],
            [() => !!c && Math.abs((c.recursos.cpus || 0) - 0.5) < 0.001,
              () => `O limite de CPU está como <code>${c.recursos.cpus || 'nenhum'}</code>. Use <code>--cpus 0.5</code>.`],
            [() => D.env(ctx, 'servico-web', 'AMBIENTE') === 'producao',
              'Falta a variável de ambiente: <code>-e AMBIENTE=producao</code>.']
          ]);
        }
      }
    ]
  });
})();
