/* =========================================================================
   MÓDULO D09 — Redes do Docker
   Como um container fala com outro, e por que às vezes não fala.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 9.1 ============================== */
  LX.lesson('d09', {
    id: 'ld9-1', n: '9.1', title: 'Os quatro "localhost"',
    goal: 'Nunca mais confundir o localhost do servidor, o localhost do container, o IP do container e o nome do serviço.',
    body: [
      { h2: 'A confusão que trava todo mundo' },
      { p: 'Cada container tem a própria pilha de rede: o próprio <code>127.0.0.1</code>, o próprio IP, as próprias portas. Quando alguém escreve <code>localhost</code> em um arquivo de configuração, a pergunta que importa é: <strong>localhost de quem?</strong>' },
      {
        table: {
          head: ['Endereço', 'Significa', 'Usar quando'],
          rows: [
            ['<code>localhost</code> <em>no servidor</em>', 'o próprio servidor', 'você está no terminal do servidor, testando uma <strong>porta publicada</strong>'],
            ['<code>localhost</code> <em>dentro do container</em>', 'o próprio container', 'um processo fala com outro processo <strong>do mesmo container</strong>'],
            ['<code>172.18.0.3</code> (IP do container)', 'aquele container na rede do Docker', 'quase nunca: o IP muda a cada recriação'],
            ['<code>db</code> (nome do serviço)', 'resolvido pelo DNS do Docker', '<strong>sempre</strong>, entre containers de uma mesma rede definida por você']
          ]
        }
      },
      {
        box: 'key', label: 'O erro nº 1 de configuração', body: [
          { p: 'A API tem <code>DATABASE_URL=mysql://app:SENHA_DO_BANCO@localhost:3306/loja</code> e não conecta. O motivo: dentro do container da API, <code>localhost</code> é <em>a própria API</em> — e ali não tem banco nenhum.' },
          { p: 'A correção é trocar <code>localhost</code> pelo <strong>nome do serviço</strong>: <code>@db:3306</code>. E a porta é a <strong>interna</strong> do banco (3306), não a publicada no servidor.' }
        ]
      },
      {
        ascii: `                    SERVIDOR
   ┌────────────────────────────────────────────────┐
   │  localhost:8080  ──┐                           │
   │                    │  (porta publicada)        │
   │   ┌────────────────▼───────┐   ┌────────────┐  │
   │   │ api    172.18.0.3      │   │ db         │  │
   │   │  escuta na 3000        │──▶│ 172.18.0.2 │  │
   │   │  localhost = ela mesma │ db│ escuta 3306│  │
   │   └────────────────────────┘   └────────────┘  │
   │            rede "interna" (DNS do Docker)      │
   └────────────────────────────────────────────────┘

  do servidor  → localhost:8080   (porta publicada)
  api  →  db   → db:3306          (nome + porta INTERNA)
  api  →  api  → localhost:3000`
      },

      { h2: 'Porta interna e porta publicada' },
      { p: 'A porta que o processo escuta dentro do container é <strong>interna</strong>. Ela é alcançável por qualquer container da mesma rede, sempre, sem precisar de <code>-p</code>.' },
      { p: 'O <code>-p</code> cria uma segunda coisa: um mapeamento entre uma porta do <strong>servidor</strong> e essa porta interna. Só serve para acesso de fora da rede do Docker.' },
      {
        box: 'note', label: 'Consequência prática de segurança', body: [
          { p: 'Um banco de dados em uma stack <strong>não precisa</strong> de <code>-p</code>. A API alcança <code>db:3306</code> pela rede interna. Publicar a porta do banco no servidor é expor um serviço que ninguém de fora deveria alcançar.' },
          { p: 'Quando você precisa mesmo acessar o banco de fora para depurar, publique preso ao loopback: <code>-p 127.0.0.1:3306:3306</code>.' }
        ]
      },

      { h2: 'As três redes que já existem' },
      { code: ['$ docker network ls'] },
      {
        table: {
          head: ['Rede', 'Driver', 'Comportamento'],
          rows: [
            ['<code>bridge</code>', 'bridge', 'a padrão. Containers têm IP, mas <strong>não há DNS por nome</strong>'],
            ['<code>host</code>', 'host', 'o container usa a pilha de rede do servidor: sem isolamento, sem <code>-p</code>'],
            ['<code>none</code>', 'null', 'sem rede nenhuma — só o loopback interno']
          ]
        }
      },
      {
        box: 'warn', label: 'A bridge padrão não resolve nomes', body: [
          { p: 'Este é o comportamento que mais confunde. Dois containers subidos sem <code>--network</code> ficam na bridge padrão, enxergam-se por IP e <strong>não</strong> se enxergam por nome:' },
          { code: ['$ docker run -d --name a nginx:alpine', '$ docker run -d --name b nginx:alpine',
            '$ docker exec b wget -qO- http://a/', 'wget: unable to resolve host address \'a\''], run: false, lang: 'text' },
          { p: 'Não é bug: a resolução por nome é um recurso das <strong>redes definidas pelo usuário</strong>. Criar uma rede resolve na hora.' }
        ]
      },
      { p: '<code>--network host</code> merece um parágrafo próprio: ele elimina o isolamento de rede. O container passa a escutar diretamente nas portas do servidor, <code>-p</code> deixa de fazer efeito, e um conflito de porta derruba o serviço do host. Existe para casos específicos de desempenho e para ferramentas de rede — não é atalho para "resolver problema de conectividade".' },

      { h2: 'Rede definida pelo usuário: o padrão certo' },
      { code: ['$ docker network create interna',
        '$ docker run -d --name db --network interna -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO mariadb:11.4',
        '$ docker run -d --name api --network interna -p 8080:80 nginx:alpine',
        '$ docker exec api ping -c1 db',
        '$ docker exec api getent hosts db'] },
      { p: 'O que você ganha ao criar uma rede:' },
      {
        ul: [
          '<strong>DNS interno.</strong> O nome do container vira um nome de host, resolvido pelo resolvedor do Docker em <code>127.0.0.11</code>.',
          '<strong>Isolamento.</strong> Containers de redes diferentes não se alcançam.',
          '<strong>Conexão a quente.</strong> Dá para conectar e desconectar container de rede sem recriar.',
          '<strong>Nomes estáveis.</strong> O IP muda a cada recriação; o nome, não.'
        ]
      },
      { code: ['$ docker exec api cat /etc/resolv.conf'] },
      { p: 'A saída mostra <code>nameserver 127.0.0.11</code>: é o DNS embutido do Docker. Ele resolve os nomes dos containers da rede e repassa o resto para o DNS do servidor.' },

      { h2: 'Um container em várias redes' },
      { code: ['$ docker network create frente', '$ docker network create fundo',
        '$ docker run -d --name web --network frente nginx:alpine',
        '$ docker network connect fundo web',
        '$ docker inspect web --format "{{range $rede, $cfg := .NetworkSettings.Networks}}{{$rede}} {{$cfg.IPAddress}}{{println}}{{end}}"'] },
      { p: 'É assim que se monta uma stack segura: o proxy fica na rede de frente <em>e</em> na de trás; o banco fica só na de trás. O banco então é inalcançável de fora, mesmo que alguém publique alguma porta por engano.' },
      {
        ascii: `   internet ──▶ [traefik] ──▶ [api] ──▶ [db]
                    │           │         │
                rede "web"   web+interna  interna
                                          (só isso)`
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>localhost</code> dentro do container é o próprio container.',
          'Entre containers: nome do serviço + porta <strong>interna</strong>.',
          'A bridge padrão não resolve nomes; rede criada por você, sim.',
          'Serviço interno não precisa de <code>-p</code>.',
          'Um container pode estar em várias redes — é assim que se isola o banco.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td9-1-a', kind: 'guiado', title: 'Ver a bridge padrão falhar e a rede criada funcionar',
        body: [
          { p: 'Primeiro na rede padrão:' },
          { code: ['$ docker run -d --name um nginx:alpine', '$ docker run -d --name dois nginx:alpine',
            '$ docker exec dois wget -qO- http://um/ | head -2'] },
          { p: 'Falha com <em>unable to resolve host address</em>. Agora com uma rede sua:' },
          { code: ['$ docker network create lab',
            '$ docker run -d --name tres --network lab nginx:alpine',
            '$ docker run -d --name quatro --network lab nginx:alpine',
            '$ docker exec quatro wget -qO- http://tres/ | head -2',
            '$ docker exec quatro cat /etc/resolv.conf'] }
        ],
        hints: ['A única diferença entre os dois blocos é o <code>--network lab</code>.'],
        solution: '<pre>$ docker run -d --name um nginx:alpine\n$ docker run -d --name dois nginx:alpine\n$ docker exec dois wget -qO- http://um/ | head -2\n$ docker network create lab\n$ docker run -d --name tres --network lab nginx:alpine\n$ docker run -d --name quatro --network lab nginx:alpine\n$ docker exec quatro wget -qO- http://tres/ | head -2\n$ docker exec quatro cat /etc/resolv.conf</pre>',
        check: async (ctx) => {
          const r = await D.exec(ctx, 'quatro', 'wget -qO- http://tres/');
          return H.checkAll([
            [() => !!D.rede(ctx, 'lab'), 'Crie a rede com <code>docker network create lab</code>.'],
            [() => D.naRede(ctx, 'tres', 'lab') && D.naRede(ctx, 'quatro', 'lab'),
              'Os containers <code>tres</code> e <code>quatro</code> precisam estar na rede <code>lab</code>.'],
            [() => H.usedCommand(ctx, /docker\s+exec\s+dois/), 'Tente primeiro a comunicação na rede padrão, com <code>docker exec dois wget -qO- http://um/</code> — é o contraste que a aula mostra.'],
            [() => r.status === 0 && /DOCTYPE|html/i.test(r.out),
              'A comunicação por nome dentro da rede <code>lab</code> ainda não funciona. Confira se os dois containers estão mesmo na rede.']
          ]);
        }
      },
      {
        id: 'td9-1-q', kind: 'quiz', title: 'A API que não acha o banco',
        body: [
          { p: 'Uma stack tem um banco e uma API, ambos na rede <code>interna</code>. O banco publica <code>-p 5432:5432</code>. A API está configurada assim:' },
          { code: ['DATABASE_URL=postgres://app:SENHA_DO_BANCO@localhost:5432/loja'], run: false, lang: 'text' },
          { p: 'E o log da API diz <em>connection refused</em>. Qual é a correção?' }
        ],
        options: [
          { text: 'Trocar <code>localhost</code> pelo nome do serviço: <code>@db:5432</code>. Dentro do container da API, <code>localhost</code> é a própria API.', correct: true },
          { text: 'Trocar <code>localhost</code> pelo IP do servidor.', why: 'Funcionaria por acidente, já que a porta está publicada — mas amarra a configuração a um IP e depende da publicação existir. E some no momento em que alguém, corretamente, tirar o <code>-p</code> do banco.' },
          { text: 'Publicar também a porta da API.', why: 'Publicar porta da API não muda nada na comunicação entre os dois containers.' },
          { text: 'Usar <code>--network host</code> nos dois containers.', why: 'Faria funcionar eliminando o isolamento de rede — o remédio é pior que a doença, e cria conflito de portas com o servidor.' }
        ],
        explain: 'Este é o erro de configuração mais comum ao passar de "tudo na mesma máquina" para "cada serviço em um container". A regra: <strong>entre containers, use o nome do serviço e a porta interna</strong>. O <code>-p 5432:5432</code> do banco, aliás, é outro problema: expõe o banco no servidor sem necessidade. A stack correta tira o <code>-p</code> do banco e deixa só a comunicação interna.'
      },
      {
        id: 'td9-1-b', kind: 'desafio', title: 'Dois serviços na mesma rede, sem publicar porta nenhuma',
        body: [
          { p: 'Crie uma rede chamada <code>loja</code>. Nela, suba dois containers <code>nginx:alpine</code>: um chamado <code>web</code> e outro <code>estoque</code> — sem publicar nenhuma porta no servidor.' },
          { p: 'De dentro do <code>web</code>, confirme que <code>http://estoque/</code> responde. Use o nome do serviço, não o IP.' }
        ],
        hints: [
          'A rede se cria com <code>docker network create loja</code>, e cada container entra nela com <code>--network loja</code>.',
          'Para testar de dentro do container: <code>docker exec web wget -qO- http://estoque/</code>.'
        ],
        solution: '<pre>$ docker network create loja\n$ docker run -d --name web --network loja nginx:alpine\n$ docker run -d --name estoque --network loja nginx:alpine\n$ docker exec web wget -qO- http://estoque/</pre>',
        check: async (ctx) => {
          const web = D.container(ctx, 'web'), estoque = D.container(ctx, 'estoque');
          const naRede = !!web && !!estoque && D.naRede(ctx, 'web', 'loja') && D.naRede(ctx, 'estoque', 'loja');
          const r = (web && estoque) ? await D.exec(ctx, 'web', 'wget -qO- http://estoque/') : { status: 1, out: '' };
          return H.checkAll([
            [() => !!D.rede(ctx, 'loja'), 'Crie a rede com <code>docker network create loja</code>.'],
            [() => !!web && !!estoque, 'Suba os containers <code>web</code> e <code>estoque</code>, ambos <code>nginx:alpine</code>.'],
            [() => naRede, 'Os dois containers precisam estar na rede <code>loja</code>.'],
            [() => (web ? (web.portas || []).length : 0) === 0 && (estoque ? (estoque.portas || []).length : 0) === 0,
              'Nenhum dos dois precisa publicar porta no servidor — é comunicação só entre containers, pela rede interna.'],
            [() => r.status === 0 && /DOCTYPE|html/i.test(r.out),
              'De dentro do <code>web</code>, <code>http://estoque/</code> ainda não responde. Confira se os dois estão na mesma rede e se o nome usado é o do serviço.']
          ]);
        }
      }
    ]
  });

  /* ============================== 9.2 ============================== */
  LX.lesson('d09', {
    id: 'ld9-2', n: '9.2', title: 'Diagnosticar rede entre containers',
    goal: 'Ter um roteiro que encontra a causa de "um container não fala com o outro" em poucos comandos.',
    setup: (m) => {
      /* Defeito plantado: a API está numa rede e o banco em outra. O
         sintoma é o clássico "não resolve o nome". */
      const e = m.docker;
      if (!e) return;
      LX.D.garantirRede(m, 'frente');
      LX.D.garantirRede(m, 'fundo');
      if (!e.containerPorNome('loja-db')) {
        LX.D.montar(m, {
          imagem: 'mariadb:11.4', nome: 'loja-db', redes: ['fundo'],
          env: { MARIADB_ROOT_PASSWORD: 'SENHA_DO_BANCO', MARIADB_DATABASE: 'loja' }
        });
      }
      if (!e.containerPorNome('loja-api')) {
        LX.D.montar(m, {
          imagem: 'nginx:alpine', nome: 'loja-api', redes: ['frente'],
          portas: [{ hostIp: '0.0.0.0', hostPort: 8095, contPort: 80, proto: 'tcp' }]
        });
      }
    },
    body: [
      { h2: 'O roteiro' },
      { p: 'Quando dois containers não se falam, a resposta está em uma destas quatro camadas. Teste na ordem — cada passo elimina uma:' },
      {
        ascii: `1. os dois estão RODANDO?          docker ps
        │
2. estão na MESMA REDE?            docker inspect --format ... .NetworkSettings.Networks
        │
3. o NOME RESOLVE?                 docker exec origem getent hosts destino
        │
4. a PORTA ACEITA conexão?         docker exec origem wget -qO- http://destino:PORTA/`
      },

      { h2: '1. Estão rodando?' },
      { code: ['$ docker ps -a --format "{{.Names}}\\t{{.Status}}"'] },
      { p: 'Óbvio, e mesmo assim é onde metade dos casos termina. Um container em <code>Restarting</code> ou <code>Exited</code> não atende ninguém — e a causa dele está no <code>docker logs</code>, não na rede.' },

      { h2: '2. Estão na mesma rede?' },
      { code: ['$ docker inspect loja-api --format "{{range $r, $c := .NetworkSettings.Networks}}{{$r}} {{end}}"',
        '$ docker inspect loja-db --format "{{range $r, $c := .NetworkSettings.Networks}}{{$r}} {{end}}"',
        '$ docker network inspect fundo --format "{{range .Containers}}{{.Name}} {{end}}"'] },
      { p: 'Se as listas não têm nenhuma rede em comum, o diagnóstico acabou. É a causa mais frequente em stack montada à mão, e a correção é conectar um dos dois:' },
      { code: ['$ docker network connect fundo loja-api'], run: false, lang: 'bash' },
      { p: 'A conexão vale imediatamente, sem recriar o container.' },

      { h2: '3. O nome resolve?' },
      { code: ['$ docker exec loja-api getent hosts loja-db',
        '$ docker exec loja-api cat /etc/resolv.conf'] },
      { p: 'Resolve e devolve um IP? Então o problema é da porta ou da aplicação, não do DNS. Não resolve?' },
      {
        table: {
          head: ['Sintoma', 'Causa provável'],
          rows: [
            ['nada volta do <code>getent</code>', 'não estão na mesma rede, ou a rede é a bridge padrão'],
            ['<code>resolv.conf</code> sem <code>127.0.0.11</code>', 'o container está na bridge padrão ou em <code>--network host</code>'],
            ['resolve, mas para o IP errado', 'existe outro container com o mesmo alias na rede']
          ]
        }
      },

      { h2: '4. A porta aceita conexão?' },
      { code: ['$ docker exec loja-api wget -qO- --timeout=3 http://loja-db:3306/ ; echo "codigo: $?"',
        '$ docker exec loja-db ss -tln'] },
      { p: 'Aqui a distinção do curso de Linux volta inteira:' },
      {
        table: {
          head: ['Resultado', 'Leitura'],
          rows: [
            ['<em>connection refused</em>', 'chegou até o container e <strong>ninguém escuta</strong> naquela porta — porta errada, ou o serviço não subiu'],
            ['<em>timeout</em>', 'não chegou resposta — rede errada, ou o serviço escuta em <code>127.0.0.1</code> em vez de <code>0.0.0.0</code>'],
            ['<em>unable to resolve</em>', 'parou no passo 3: é DNS'],
            ['resposta estranha mas <em>chegou</em>', 'a rede está boa; o problema é do protocolo ou da aplicação']
          ]
        }
      },
      {
        box: 'key', label: 'O serviço que escuta só em 127.0.0.1', body: [
          { p: 'Uma aplicação configurada para escutar em <code>127.0.0.1</code> funciona quando testada <em>de dentro do próprio container</em> e é inalcançável de qualquer outro. Dentro de um container, o endereço certo é <code>0.0.0.0</code> — o isolamento já é feito pela rede do Docker, não pelo bind.' },
          { p: 'O <code>ss -tln</code> de dentro do container mostra a diferença: <code>127.0.0.1:3306</code> é o problema; <code>0.0.0.0:3306</code> está certo.' }
        ]
      },

      { h2: 'Ferramentas quando a imagem é enxuta' },
      { p: 'Imagem de produção não tem <code>ping</code>, <code>curl</code> nem <code>dig</code>. Duas saídas:' },
      { code: ['$ docker exec api sh -c "apk add --no-cache curl bind-tools"',
        '$ docker run --rm -it --network interna alpine sh'], run: false, lang: 'bash' },
      { p: 'A segunda é melhor: sobe um container descartável <strong>na mesma rede</strong>, com as ferramentas que você quiser, sem sujar a imagem de produção. Quando terminar, ele some.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Roteiro: rodando → mesma rede → nome resolve → porta aceita.',
          '<em>refused</em> aponta para o serviço; <em>timeout</em> aponta para o caminho.',
          '<code>network connect</code> resolve sem recriar o container.',
          'Serviço deve escutar em <code>0.0.0.0</code> dentro do container.',
          'Container descartável na mesma rede é a melhor caixa de ferramentas.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td9-2-a', kind: 'guiado', title: 'Aplicar o roteiro de diagnóstico',
        body: [
          { p: 'Os containers <code>loja-api</code> e <code>loja-db</code> já existem nesta máquina. Siga os três primeiros passos do roteiro e veja onde o problema está.' },
          {
            code: [
              '$ docker ps -a --format "{{.Names}}\\t{{.Status}}"',
              '$ docker inspect loja-api --format "{{range $r, $c := .NetworkSettings.Networks}}{{$r}} {{end}}"',
              '$ docker inspect loja-db --format "{{range $r, $c := .NetworkSettings.Networks}}{{$r}} {{end}}"',
              '$ docker exec loja-api getent hosts loja-db'
            ]
          },
          { p: 'O último comando não devolve nada: os dois containers não têm nenhuma rede em comum, então o nome não resolve. A correção fica para o próximo exercício.' }
        ],
        hints: ['Compare a lista de redes de cada <code>docker inspect</code> — se não houver nenhum nome repetido entre as duas, aí está o problema.'],
        check: async (ctx) => {
          const api = D.container(ctx, 'loja-api'), db = D.container(ctx, 'loja-db');
          return H.checkAll([
            [() => !!api && !!db, 'Os containers <code>loja-api</code> e <code>loja-db</code> devem existir.'],
            [() => H.usedCommand(ctx, /docker\s+ps/), 'Comece confirmando que os dois estão rodando: <code>docker ps -a</code>.'],
            [() => H.usedCommand(ctx, /docker\s+inspect\s+loja-api/), 'Veja as redes do <code>loja-api</code> com <code>docker inspect loja-api --format ...</code>.'],
            [() => H.usedCommand(ctx, /docker\s+inspect\s+loja-db/), 'Veja também as redes do <code>loja-db</code>.'],
            [() => H.usedCommand(ctx, /getent\s+hosts\s+loja-db/), 'Teste a resolução de nome: <code>docker exec loja-api getent hosts loja-db</code>.']
          ]);
        }
      },
      {
        id: 'td9-2-q', kind: 'quiz', title: 'Refused ou timeout: qual é a pista',
        body: [
          { p: 'Dentro do container <code>api</code>, você roda <code>wget -qO- --timeout=3 http://db:5432/</code> e a resposta demora os três segundos inteiros até estourar o timeout — sem <em>connection refused</em>, sem erro de resolução de nome. O nome resolveu: você já confirmou com <code>getent hosts db</code>, que devolveu um IP. O que esse resultado indica?' }
        ],
        options: [
          { text: 'A rede não está entregando o pacote até o destino certo — API e banco podem estar em redes diferentes apesar do nome ter resolvido, ou o serviço escuta só em <code>127.0.0.1</code> dentro do próprio container, inacessível de fora dele.', correct: true },
          { text: 'A porta está certa e o serviço recusou a conexão de propósito.', why: 'Uma recusa ativa dá <em>connection refused</em>, quase imediato — não um timeout de três segundos inteiros.' },
          { text: 'O nome não resolveu.', why: 'O enunciado já diz que o <code>getent hosts db</code> devolveu um IP — a resolução funcionou; o problema está depois dela, na camada da porta.' },
          { text: 'O container <code>db</code> não está rodando.', why: 'Se estivesse parado, isso apareceria no passo 1 do roteiro (<code>docker ps</code>), e normalmente aparece como <em>connection refused</em> quando algo mais responde na porta do host — não como timeout.' }
        ],
        explain: '<em>Refused</em> aponta para o serviço (chegou até ele e ninguém escuta ali); <em>timeout</em> aponta para o caminho (o pacote nunca chegou). Os dois suspeitos clássicos de timeout são: containers em redes diferentes com um alias coincidindo, ou uma aplicação escutando em <code>127.0.0.1</code> em vez de <code>0.0.0.0</code>.'
      },
      {
        id: 'td9-2-b', kind: 'desafio', title: 'A API não enxerga o banco',
        body: [
          { p: 'Existem dois containers nesta máquina: <code>loja-api</code> e <code>loja-db</code>. A API não consegue falar com o banco.' },
          { ol: [
            'Aplique o roteiro e descubra em qual das quatro camadas está o problema.',
            'Corrija <strong>sem recriar nenhum dos dois containers</strong>.',
            'Prove que funcionou: de dentro da <code>loja-api</code>, o nome <code>loja-db</code> precisa resolver.'
          ] },
          { p: 'Os dois containers precisam continuar existindo com os mesmos nomes no fim.' }
        ],
        hints: [
          'Comece pelo passo 2 do roteiro: veja em quais redes cada um está, com <code>docker inspect ... .NetworkSettings.Networks</code>.',
          'Eles estão em redes diferentes — não têm como se enxergar.',
          'Dá para conectar um container a uma rede a quente: <code>docker network connect NOME_DA_REDE NOME_DO_CONTAINER</code>. Não precisa recriar nada.'
        ],
        solution: '<pre>$ docker ps --format "{{.Names}} {{.Status}}"\n$ docker inspect loja-api --format "{{range $r, $c := .NetworkSettings.Networks}}{{$r}} {{end}}"\n$ docker inspect loja-db --format "{{range $r, $c := .NetworkSettings.Networks}}{{$r}} {{end}}"\n$ docker network connect fundo loja-api\n$ docker exec loja-api getent hosts loja-db</pre>',
        check: async (ctx) => {
          const api = D.container(ctx, 'loja-api'), db = D.container(ctx, 'loja-db');
          const comum = api && db && Array.from(api.redes.keys()).some(r => db.redes.has(r));
          const r = api && db ? await D.exec(ctx, 'loja-api', 'getent hosts loja-db') : { status: 1, out: '' };
          return H.checkAll([
            [() => !!api && !!db, 'Os containers <code>loja-api</code> e <code>loja-db</code> precisam continuar existindo — a tarefa era corrigir sem recriar.'],
            [() => api.rodando && db.rodando, 'Os dois containers precisam estar em execução.'],
            [() => H.usedCommand(ctx, /docker\s+inspect|docker\s+network\s+inspect/),
              'Investigue antes de corrigir: use <code>docker inspect</code> para descobrir em que redes cada container está.'],
            [() => comum, 'Os dois ainda não têm nenhuma rede em comum. Conecte um deles à rede do outro com <code>docker network connect</code>.'],
            [() => r.status === 0 && /\d+\.\d+\.\d+\.\d+/.test(r.out),
              'O nome <code>loja-db</code> ainda não resolve de dentro da <code>loja-api</code>. Confirme com <code>docker exec loja-api getent hosts loja-db</code>.']
          ]);
        }
      },

    ]
  });
})();
