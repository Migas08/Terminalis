/* =========================================================================
   MÓDULO D17 — Segurança
   Menor privilégio na prática: não-root, capabilities, raiz somente leitura,
   o socket do Docker e de onde vem a imagem.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 17.1 ============================== */
  LX.lesson('d17', {
    id: 'ld17-1', n: '17.1', title: 'Rode como não-root',
    goal: 'Entender por que um processo dentro do container não deveria ser root, e fazer o container rodar como um usuário sem privilégio.',
    body: [
      { h2: 'O root do container é o root do host' },
      { p: 'Por padrão, o processo dentro de um container roda como <strong>root</strong> (UID 0). E aqui está o detalhe que quase ninguém percebe no começo: o UID 0 de dentro do container é o <strong>mesmo</strong> UID 0 do servidor. Não existe um "root de brinquedo" — é o kernel do host que executa tudo, e o isolamento é só uma cerca de namespaces.' },
      { p: 'Enquanto a cerca segura, tudo bem. O problema é o dia em que ela falha: uma falha no runtime, um bind mount mal feito, uma capability sobrando. Se o processo era root, quem escapa é root no servidor. Se o processo era um usuário comum, quem escapa é um usuário comum — e a diferença entre esses dois cenários é a diferença entre um susto e um desastre.' },
      {
        box: 'key', label: 'O princípio do menor privilégio', body: [
          { p: 'Um processo deve ter <strong>exatamente</strong> o poder de que precisa para fazer seu trabalho, e nada além. Um servidor web serve páginas na porta 8080 — ele não precisa ser root para isso. Rodar como não-root é a primeira e mais barata camada de defesa do container.' }
        ]
      },

      { h2: 'Quem é o processo, visto de fora e de dentro' },
      { p: 'Você confere o usuário de duas formas. De dentro, com <code>id</code>; e de fora, com <code>docker inspect</code>, que mostra a configuração declarada:' },
      {
        code: [
          '$ docker run --rm alpine:3.21 id',
          'uid=0(root) gid=0(root) groups=0(root),...',
          '',
          '$ docker run --rm --user 1000:1000 alpine:3.21 id',
          'uid=1000 gid=1000'
        ], run: false
      },
      { p: 'O <code>--user UID:GID</code> (ou <code>-u</code>) troca o usuário do processo no momento do <code>run</code>. Você pode passar números ou um nome que exista dentro da imagem.' },

      { h2: 'O jeito certo: USER no Dockerfile' },
      { p: 'Passar <code>--user</code> em todo <code>run</code> funciona, mas é fácil esquecer. O correto é a <strong>imagem já subir como não-root</strong>, declarando isso no Dockerfile — assim quem usa a imagem herda o comportamento seguro sem precisar lembrar.' },
      {
        code: [
          'FROM alpine:3.21',
          '# cria um usuário do sistema, sem shell de login e sem senha',
          'RUN addgroup -S app && adduser -S -G app app',
          'WORKDIR /app',
          'COPY --chown=app:app . .',
          '# a partir daqui, tudo roda como "app"',
          'USER app',
          'CMD ["./servidor"]'
        ], run: false, lang: 'dockerfile'
      },
      {
        table: {
          head: ['Instrução', 'O que faz'],
          rows: [
            ['<code>RUN adduser -S app</code>', 'cria um usuário de sistema (o <code>-S</code> do Alpine; em Debian é <code>useradd -r</code>)'],
            ['<code>COPY --chown=app:app</code>', 'os arquivos já entram pertencendo ao usuário, não ao root'],
            ['<code>USER app</code>', 'todo <code>RUN</code>, <code>CMD</code> e <code>ENTRYPOINT</code> daqui para baixo roda como <code>app</code>']
          ]
        }
      },
      {
        box: 'warn', label: 'A ordem importa', body: [
          { p: 'Tudo que precisa de root — instalar pacotes, criar diretórios do sistema — vem <strong>antes</strong> do <code>USER app</code>. Depois dele, o build perde o root. Um <code>apt-get install</code> depois do <code>USER app</code> falha com permissão negada.' }
        ]
      },
      {
        box: 'note', label: 'O caminho mais simples: um UID numérico', body: [
          { p: 'Criar um usuário com <code>adduser</code> deixa o <code>id</code> com um nome bonito, mas nem sempre é necessário. Um <strong>UID numérico</strong> funciona em qualquer imagem, sem criar usuário nenhum:' },
          { code: ['FROM alpine:3.21', 'USER 1000:1000', 'CMD ["./servidor"]'], run: false, lang: 'dockerfile' },
          { p: 'É o que muita imagem de produção usa. O processo roda como UID 1000, não-root, e pronto — a segurança vem de <em>não ser 0</em>, não de ter nome.' }
        ]
      },
      {
        box: 'note', label: 'A porta baixa é a exceção clássica', body: [
          { p: 'Um processo não-root não consegue escutar em portas abaixo de 1024. Por isso as imagens modernas do Nginx e afins escutam em 8080 dentro do container, e você mapeia <code>-p 80:8080</code> por fora. A porta privilegiada fica com o servidor, não com o container.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td17-1-a', kind: 'guiado', title: 'Veja quem o container é',
        body: [
          { p: 'Compare o usuário padrão com o usuário forçado, de dentro e de fora do container:' },
          {
            code: [
              '$ docker run --rm alpine:3.21 id',
              '$ docker run --rm --user 1000:1000 alpine:3.21 id',
              '$ docker run -d --name app-root nginx:alpine',
              '$ docker inspect app-root --format "usuário: {{.Config.User}}"',
              '$ docker exec app-root id'
            ]
          },
          { p: 'Repare que o <code>Config.User</code> do container padrão vem vazio — e vazio significa root. Um campo vazio ali é o sinal de que ninguém pensou no assunto.' }
        ],
        hints: ['O <code>id</code> mostra o UID efetivo do processo. UID 0 é root.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+run\s+--rm\s+alpine.*\bid\b/), 'Rode <code>docker run --rm alpine:3.21 id</code> para ver o usuário padrão.'],
          [() => H.usedCommand(ctx, /--user\s+1000/), 'Rode de novo com <code>--user 1000:1000</code> e compare.']
        ])
      },
      {
        id: 'td17-1-q', kind: 'quiz', title: 'Por que não-root?',
        body: [
          { p: 'Um colega diz: "o container é isolado, então não importa se o processo lá dentro é root". Onde está o erro?' }
        ],
        options: [
          { text: 'O root do container é o mesmo UID 0 do host; o isolamento é uma cerca de namespaces que, se falhar, deixa um processo root escapar como root no servidor. Não-root reduz o estrago de uma fuga.', correct: true },
          { text: 'Está certo: o root do container é um root falso, sem poder nenhum no host.', why: 'Não existe root falso. É o kernel do host que executa o processo, e o UID 0 é o mesmo dos dois lados — só os namespaces os separam.' },
          { text: 'Não importa mesmo, porque o Docker sempre roda os containers como usuário comum por padrão.', why: 'O padrão é o oposto: sem <code>USER</code> na imagem nem <code>--user</code> no run, o processo é root.' },
          { text: 'Importa só se o container publicar uma porta.', why: 'A superfície de risco não depende de publicar porta. Um container sem porta publicada que seja comprometido por outro caminho ainda escala melhor a partir de root.' }
        ],
        explain: 'Rodar como não-root é a camada de defesa mais barata que existe: não impede uma invasão, mas garante que quem entrar tenha o menor poder possível. Combine com a imagem declarando <code>USER</code> para que o comportamento seguro seja o padrão, não algo a lembrar em cada <code>run</code>.'
      },
      {
        id: 'td17-1-b', kind: 'desafio', title: 'Uma imagem que já sobe como não-root',
        body: [
          { p: 'Em <code>~/segura</code>, escreva um <code>Dockerfile</code> que parta de <code>alpine:3.21</code> e declare <code>USER 1000:1000</code>, de modo que o processo final rode como esse usuário — <strong>não</strong> como root.' },
          { p: 'O comando final (<code>CMD</code>) pode ser simplesmente <code>id</code>. Construa a imagem com a tag <code>segura:1.0</code> e prove, rodando um container a partir dela, que ele <strong>não</strong> é root.' }
        ],
        hints: [
          'O Dockerfile tem três linhas: <code>FROM alpine:3.21</code>, <code>USER 1000:1000</code> e <code>CMD ["id"]</code>. O UID numérico não exige criar usuário nenhum.',
          'Construa com <code>docker build -t segura:1.0 ~/segura</code> e confira com <code>docker run --rm segura:1.0</code> — a saída do <code>id</code> não pode mostrar <code>uid=0</code>.'
        ],
        solution: '<pre>$ mkdir -p ~/segura\n$ cat &gt; ~/segura/Dockerfile &lt;&lt;\'EOF\'\nFROM alpine:3.21\nUSER 1000:1000\nCMD ["id"]\nEOF\n$ docker build -t segura:1.0 ~/segura\n$ docker run --rm segura:1.0</pre>',
        check: (ctx) => {
          const img = D.imagem(ctx, 'segura:1.0');
          const inst = D.instrucao(ctx, '/home/aluno/segura/Dockerfile', 'USER');
          return H.checkAll([
            [() => D.instrucao(ctx, '/home/aluno/segura/Dockerfile', 'FROM').length > 0, 'Não encontrei um <code>Dockerfile</code> válido em <code>~/segura</code>.'],
            [() => inst.length > 0, 'O Dockerfile precisa de uma instrução <code>USER</code>.'],
            [() => !!img, 'A imagem <code>segura:1.0</code> não existe. Construa com <code>docker build -t segura:1.0 ~/segura</code>.'],
            [() => { const u = img.config && img.config.User; return !!u && u !== 'root' && u !== '0'; },
              () => 'A imagem ainda sobe como root (User = <code>' + ((img.config && img.config.User) || '(vazio)') + '</code>). Declare <code>USER 1000:1000</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 17.2 ============================== */
  LX.lesson('d17', {
    id: 'ld17-2', n: '17.2', title: 'Tirar poder: capabilities, raiz somente leitura e no-new-privileges',
    goal: 'Reduzir a superfície de um container tirando privilégios que ele não usa e travando o que ele pode escrever.',
    body: [
      { h2: 'Root não é tudo ou nada' },
      { p: 'O root do Linux não é um interruptor único. Ele é uma lista de <strong>capabilities</strong> — poderes separados: mudar o dono de um arquivo (<code>CHOWN</code>), abrir portas baixas (<code>NET_BIND_SERVICE</code>), montar sistemas de arquivos (<code>SYS_ADMIN</code>), e dezenas de outros. Ser root é ter todas.' },
      { p: 'O Docker já começa tirando as mais perigosas: um container comum <strong>não</strong> tem <code>SYS_ADMIN</code>, por exemplo. Mas ele ainda mantém um conjunto que a maioria das aplicações nunca usa. O endurecimento consiste em tirar o resto.' },
      {
        code: [
          '# tira TODAS as capabilities e devolve só a que o processo precisa',
          'docker run --cap-drop ALL --cap-add CHOWN minha-imagem'
        ], run: false
      },
      {
        table: {
          head: ['Flag', 'O que faz'],
          rows: [
            ['<code>--cap-drop ALL</code>', 'remove todas as capabilities — o ponto de partida seguro'],
            ['<code>--cap-add CHOWN</code>', 'devolve uma capability específica, só a necessária'],
            ['<code>--cap-drop NET_RAW</code>', 'tira uma capability específica, mantendo o resto']
          ]
        }
      },
      {
        box: 'key', label: 'A receita', body: [
          { p: 'Comece com <code>--cap-drop ALL</code> e rode. Se quebrar, o log diz qual permissão faltou; devolva só aquela com <code>--cap-add</code>. A maioria dos serviços web roda perfeitamente com <strong>nenhuma</strong> capability.' }
        ]
      },

      { h2: 'Raiz somente leitura' },
      { p: 'Um atacante que entra no container quase sempre precisa <strong>escrever</strong> — baixar uma ferramenta, deixar um script, plantar um binário. Se o sistema de arquivos do container for somente leitura, metade dos ataques trava na hora.' },
      {
        code: [
          'docker run --read-only --tmpfs /tmp minha-imagem'
        ], run: false
      },
      { p: 'O <code>--read-only</code> torna toda a raiz do container imutável. Mas quase todo processo precisa escrever em <em>algum</em> lugar — um diretório temporário, um socket, um cache. Para esses, você abre exceções explícitas:' },
      {
        table: {
          head: ['Onde escrever', 'Como liberar'],
          rows: [
            ['dados temporários', '<code>--tmpfs /tmp</code> — um espaço em memória, apagado quando o container morre'],
            ['dados que devem persistir', '<code>-v dados:/var/lib/...</code> — um volume continua gravável mesmo com <code>--read-only</code>'],
            ['um diretório de cache', '<code>--tmpfs /var/cache</code>']
          ]
        }
      },
      {
        box: 'note', label: 'O volume vence a raiz somente leitura', body: [
          { p: 'Um banco de dados com <code>--read-only</code> continua funcionando: o volume montado em <code>/var/lib/mysql</code> permanece gravável, porque a montagem é uma exceção à raiz travada. Você trava tudo o que o processo <em>não</em> deveria escrever e libera exatamente os pontos que ele precisa.' }
        ]
      },

      { h2: 'Impedir a escalada: no-new-privileges' },
      { p: 'Existe um mecanismo antigo do Linux, o <em>setuid</em>, que permite a um programa rodar com os privilégios do dono do arquivo, não de quem o executou (é como o <code>sudo</code> vira root). Dentro de um container endurecido, isso é uma porta de escalada: um binário setuid-root deixaria um processo não-root virar root de novo.' },
      {
        code: [
          'docker run --security-opt no-new-privileges minha-imagem'
        ], run: false
      },
      { p: 'O <code>--security-opt no-new-privileges</code> fecha essa porta: nenhum processo do container pode ganhar mais privilégio do que já tem, setuid nenhum funciona. É uma linha, e não tem contraindicação para uma aplicação normal.' },

      { h2: 'O container endurecido, junto' },
      {
        code: [
          'docker run -d --name api \\',
          '  --user 1000:1000 \\',
          '  --cap-drop ALL \\',
          '  --read-only --tmpfs /tmp \\',
          '  --security-opt no-new-privileges \\',
          '  --restart unless-stopped \\',
          '  minha-api:1.0'
        ], run: false
      },
      { p: 'Quatro linhas de endurecimento, cada uma independente: não-root, sem capabilities, raiz travada, sem escalada. Nenhuma delas atrapalha uma aplicação bem escrita — e juntas transformam uma fuga de container de catástrofe em inconveniente.' },
      {
        box: 'key', label: 'No Compose é igual', body: [
          {
            code: [
              'services:',
              '  api:',
              '    image: minha-api:1.0',
              '    user: "1000:1000"',
              '    read_only: true',
              '    tmpfs:',
              '      - /tmp',
              '    cap_drop:',
              '      - ALL',
              '    security_opt:',
              '      - no-new-privileges:true'
            ], run: false, lang: 'yaml'
          }
        ]
      }
    ],
    tasks: [
      {
        id: 'td17-2-a', kind: 'guiado', title: 'Tire as capabilities e veja o efeito',
        body: [
          { p: 'Um container comum consegue mudar o dono de um arquivo (usa a capability <code>CHOWN</code>). Tire todas as capabilities e veja o <code>chown</code> falhar — depois devolva só ela:' },
          {
            code: [
              '$ docker run --rm alpine:3.21 sh -c "touch /a && chown 1000 /a && echo mudou"',
              '$ docker run --rm --cap-drop ALL alpine:3.21 sh -c "touch /a && chown 1000 /a && echo mudou"',
              '$ docker run --rm --cap-drop ALL --cap-add CHOWN alpine:3.21 sh -c "touch /a && chown 1000 /a && echo mudou"'
            ]
          },
          { p: 'O primeiro muda o dono normalmente. O segundo falha com <em>Operation not permitted</em> — sem a capability, nem o root do container pode. O terceiro volta a funcionar porque devolvemos exatamente a permissão necessária.' }
        ],
        hints: ['<code>chown</code> exige a capability <code>CHOWN</code>. Sem ela, a operação é negada mesmo para o UID 0.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /--cap-drop\s+ALL/i), 'Rode um container com <code>--cap-drop ALL</code> e tente o <code>chown</code>.'],
          [() => H.usedCommand(ctx, /--cap-add\s+CHOWN/i), 'Devolva a capability com <code>--cap-add CHOWN</code> e veja voltar a funcionar.']
        ])
      },
      {
        id: 'td17-2-q', kind: 'quiz', title: 'Por que a raiz somente leitura ajuda',
        body: [
          { p: 'Você põe <code>--read-only</code> num container de aplicação web. Qual é o ganho de segurança concreto — e por que ele não impede o banco de dados de funcionar quando aplicado a ele?' }
        ],
        options: [
          { text: 'Com a raiz travada, um invasor não consegue baixar ferramentas nem plantar arquivos no container; e o banco continua funcionando porque o volume montado (ex.: <code>/var/lib/mysql</code>) é uma exceção que permanece gravável.', correct: true },
          { text: 'Impede qualquer escrita, então o banco de dados não pode ser usado com <code>--read-only</code>.', why: 'O volume montado continua gravável mesmo com a raiz somente leitura — é justamente o que permite um banco endurecido persistir dados.' },
          { text: 'Criptografa o sistema de arquivos do container.', why: '<code>--read-only</code> não tem nada a ver com criptografia; ele apenas impede escrita na camada da raiz.' },
          { text: 'Torna o container mais rápido por não gravar em disco.', why: 'O ganho é de segurança, não de desempenho. E o container ainda escreve nos pontos liberados (tmpfs, volumes).' }
        ],
        explain: 'A raiz somente leitura remove a capacidade de escrita de onde o processo não deveria escrever, e você reabre só os pontos necessários com <code>--tmpfs</code> (efêmero) e <code>-v</code> (persistente). Boa parte das cadeias de ataque depende de escrever no sistema de arquivos — travar isso corta o ataque no meio.'
      },
      {
        id: 'td17-2-b', kind: 'desafio', title: 'Endureça um container',
        body: [
          { p: 'Suba um container chamado <code>cofre</code> a partir de <code>nginx:alpine</code> aplicando as quatro camadas de endurecimento da aula, todas de uma vez:' },
          { ul: [
            'roda como o usuário <strong>101:101</strong> (não-root), com <code>--user</code>;',
            'com <strong>todas</strong> as capabilities removidas (<code>--cap-drop ALL</code>);',
            'com a <strong>raiz somente leitura</strong>, liberando <code>/tmp</code> como <code>tmpfs</code>;',
            'com <code>no-new-privileges</code> ligado.'
          ] },
          { p: 'Ao final, o container precisa estar rodando com as quatro proteções ativas.' }
        ],
        hints: [
          'É um único <code>docker run -d --name cofre</code> encadeando as flags: <code>--user 101:101 --cap-drop ALL --read-only --tmpfs /tmp --security-opt no-new-privileges</code>.',
          'Se o container não ficar de pé, confira a ordem das flags; todas vêm antes do nome da imagem <code>nginx:alpine</code>.'
        ],
        solution: '<pre>$ docker run -d --name cofre \\\n    --user 101:101 \\\n    --cap-drop ALL \\\n    --read-only --tmpfs /tmp \\\n    --security-opt no-new-privileges \\\n    nginx:alpine\n$ docker inspect cofre --format "{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}}"</pre>',
        check: (ctx) => {
          const c = D.container(ctx, 'cofre');
          return H.checkAll([
            [() => !!c, 'O container <code>cofre</code> não existe. Suba-o a partir de <code>nginx:alpine</code>.'],
            [() => c.usuario === '101:101', () => 'O container precisa rodar como <code>101:101</code> (está como <code>' + (c.usuario || 'root') + '</code>).'],
            [() => c.somenteLeitura === true, 'Falta a raiz somente leitura (<code>--read-only</code>).'],
            [() => (c.montagens || []).some(m => m.tipo === 'tmpfs' && m.destino === '/tmp'), 'Falta liberar <code>/tmp</code> como <code>--tmpfs /tmp</code>.'],
            [() => (c.capDrop || []).map(x => String(x).toUpperCase()).includes('ALL'), 'Falta <code>--cap-drop ALL</code>.'],
            [() => (c.securityOpt || []).some(o => /no-new-privileges/.test(String(o))), 'Falta <code>--security-opt no-new-privileges</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 17.3 ============================== */
  LX.lesson('d17', {
    id: 'ld17-3', n: '17.3', title: 'O socket do Docker e imagens confiáveis',
    goal: 'Entender por que montar o socket do Docker é dar root no servidor, e por que a origem e a fixação da imagem importam.',
    body: [
      { h2: 'O risco de montar /var/run/docker.sock' },
      { p: 'O socket <code>/var/run/docker.sock</code> é por onde o cliente <code>docker</code> fala com o daemon. Quem alcança esse socket <strong>manda no daemon</strong> — e o daemon roda como root no servidor. Dar o socket a um container é, na prática, dar root no host a esse container.' },
      {
        ascii: `  container com o socket montado
        │
        │  "daemon, sobe um container privilegiado
        │   que monta a raiz do servidor em /host"
        ▼
   ┌──────────┐        ┌─────────────────────────┐
   │  daemon  │ ─────▶ │ novo container com /host │  ← disco inteiro do host
   │  (root)  │        │ montado e --privileged   │     agora gravável
   └──────────┘        └─────────────────────────┘`
      },
      { p: 'Não é teoria: quem fala com o socket pode pedir ao daemon um container <code>--privileged</code> com a raiz do host montada dentro, e a partir daí ler qualquer arquivo, plantar qualquer coisa, virar root de verdade. Por isso o socket é um dos itens mais sensíveis de todo o Docker.' },
      {
        box: 'warn', label: 'Quando você precisa mesmo do socket', body: [
          { p: 'Alguns serviços legítimos precisam falar com o daemon — o Traefik, para descobrir containers; ferramentas de monitoramento. Para esses, aplique sempre duas defesas:' },
          { ol: [
            'monte <strong>somente leitura</strong>: <code>-v /var/run/docker.sock:/var/run/docker.sock:ro</code>. Reduz o estrago, ainda que não elimine — o <code>:ro</code> impede algumas operações, mas quem lê o socket ainda descobre muita coisa.',
            'não exponha esse container a tráfego não confiável, e prefira um <strong>proxy de socket</strong> (um intermediário que só deixa passar as chamadas necessárias, como listar containers) em vez do socket cru.'
          ] }
        ]
      },
      {
        box: 'key', label: 'A regra prática', body: [
          { p: 'Trate <code>docker.sock</code> como você trataria a senha de root do servidor. Só monte quando for realmente necessário, sempre <code>:ro</code>, e nunca em um container que receba requisições do mundo.' }
        ]
      },

      { h2: 'De onde vem a imagem' },
      { p: 'A segunda superfície de risco é a própria imagem. Você está rodando o código de outra pessoa como se fosse seu. Três hábitos reduzem esse risco:' },
      {
        table: {
          head: ['Hábito', 'Por quê'],
          rows: [
            ['<strong>imagens oficiais ou verificadas</strong>', 'a imagem <code>nginx</code> oficial é auditada e atualizada; <code>joao123/nginx-turbo</code> de um perfil qualquer não'],
            ['<strong>tag fixa, não <code>latest</code></strong>', '<code>latest</code> muda sem aviso; <code>nginx:1.28.0-alpine</code> é reproduzível — a mesma tag hoje e daqui a um ano'],
            ['<strong>imagem mínima</strong>', 'menos coisa dentro é menos coisa vulnerável; uma imagem <code>alpine</code> tem uma fração da superfície de uma <code>ubuntu</code> cheia'],
            ['<strong>fixar o digest</strong>', 'a prova criptográfica de que é exatamente aquele conteúdo']
          ]
        }
      },
      { p: 'A tag é um apelido que pode ser reapontado; o <strong>digest</strong> é o endereço imutável do conteúdo. Para o máximo de reprodutibilidade e segurança, você fixa o digest:' },
      {
        code: [
          '# a tag pode mudar de conteúdo amanhã',
          'image: nginx:1.28.0-alpine',
          '',
          '# o digest é imutável — é o sha256 do conteúdo exato',
          'image: nginx:1.28.0-alpine@sha256:abc123...'
        ], run: false, lang: 'yaml'
      },
      {
        box: 'note', label: 'latest é o padrão traiçoeiro', body: [
          { p: 'Quando você escreve <code>nginx</code> sem tag, o Docker assume <code>nginx:latest</code> — e <code>latest</code> é só o nome que o mantenedor deu à versão mais recente <em>no momento do pull</em>. Dois servidores que fizeram pull em datas diferentes podem estar rodando código diferente sob o mesmo nome. Em produção, sempre uma tag de versão explícita.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td17-3-a', kind: 'guiado', title: 'Veja a origem e a fixação de uma imagem',
        body: [
          { p: 'Baixe uma imagem por uma tag de versão e observe o digest — o endereço imutável do conteúdo:' },
          {
            code: [
              '$ docker pull nginx:alpine',
              '$ docker images --digests | grep nginx',
              '$ docker inspect nginx:alpine --format "{{.RepoTags}} {{.RepoDigests}}"'
            ]
          },
          { p: 'O <code>RepoTags</code> é o apelido (pode ser reapontado); o <code>RepoDigests</code> traz o <code>sha256</code> do conteúdo — é o que você fixa quando quer garantir que está rodando exatamente aquele bit, hoje e sempre.' }
        ],
        hints: ['O <code>--digests</code> no <code>docker images</code> acrescenta a coluna do digest.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+images.*--digests|docker\s+inspect\s+nginx/), 'Use <code>docker images --digests</code> ou <code>docker inspect</code> para ver o digest da imagem.']
        ])
      },
      {
        id: 'td17-3-q', kind: 'quiz', title: 'O socket montado',
        body: [
          { p: 'Uma stack expõe ao mundo um container de aplicação que, "para facilitar o deploy", monta <code>/var/run/docker.sock</code>. Por que isso é grave?' }
        ],
        options: [
          { text: 'Quem alcançar o socket manda no daemon, que é root no servidor — pode subir um container privilegiado com a raiz do host montada e assumir a máquina. Um container exposto ao mundo com o socket é um caminho direto do atacante ao root do servidor.', correct: true },
          { text: 'Não é grave: o socket só deixa listar containers.', why: 'O socket é a API completa do daemon — cria, remove, monta volumes, sobe container privilegiado. Listar é a menor das coisas que ele permite.' },
          { text: 'É grave só porque ocupa uma porta a mais.', why: 'O socket não é uma porta de rede publicada; o risco não é de exposição de porta, é de controle total do daemon.' },
          { text: 'Só seria um problema se o container rodasse como root.', why: 'O poder vem de falar com o daemon, não do usuário do container: quem alcança o socket comanda o daemon (root) independentemente de quem seja o processo local.' }
        ],
        explain: 'Montar o <code>docker.sock</code> é entregar o daemon, e o daemon é root no host. Se for inevitável (Traefik, monitoramento), monte <code>:ro</code>, nunca em um container que receba tráfego não confiável, e prefira um proxy de socket que filtre as chamadas.'
      },
      {
        id: 'td17-3-b', kind: 'desafio', title: 'Conserte a montagem perigosa',
        body: [
          { p: 'A pasta <code>~/proxy-inseguro</code> tem um <code>compose.yaml</code> que sobe um Traefik montando o socket do Docker em modo <strong>leitura e escrita</strong> (sem <code>:ro</code>). Reescreva o arquivo para montar o socket <strong>somente leitura</strong>, mantendo todo o resto igual.' },
          { p: 'Depois suba a stack. Ao final, o container do Traefik precisa estar rodando e a montagem do socket precisa ser somente leitura.' }
        ],
        hints: [
          'A única mudança é acrescentar <code>:ro</code> ao fim da linha de volume do socket: <code>/var/run/docker.sock:/var/run/docker.sock:ro</code>.',
          'Depois de editar, <code>docker compose up -d</code> na pasta <code>~/proxy-inseguro</code> recria o container com a montagem corrigida.'
        ],
        solution: '<pre>$ cd ~/proxy-inseguro\n$ cat &gt; compose.yaml &lt;&lt;\'EOF\'\nservices:\n  traefik:\n    image: traefik:v3.7\n    command:\n      - "--providers.docker=true"\n      - "--entrypoints.web.address=:80"\n    ports:\n      - "80:80"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\nEOF\n$ docker compose up -d</pre>',
        setup: null,
        check: (ctx) => {
          const c = D.doProjeto(ctx, 'proxy-inseguro', 'traefik');
          const doc = D.compose(ctx, '/home/aluno/proxy-inseguro/compose.yaml');
          const sock = c ? (c.montagens || []).find(m => /docker\.sock$/.test(m.destino || '')) : null;
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/proxy-inseguro/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => !!c && c.rodando, 'O container do <code>traefik</code> não está rodando. Suba com <code>docker compose up -d</code>.'],
            [() => !!sock, 'O Traefik precisa continuar montando o <code>/var/run/docker.sock</code>.'],
            [() => !!sock && sock.ro === true, 'A montagem do socket ainda é leitura e escrita. Acrescente <code>:ro</code> ao fim da linha do volume.']
          ]);
        }
      }
    ],
    setup: (m) => {
      D.pasta(m, '/home/aluno/proxy-inseguro');
      D.arquivo(m, '/home/aluno/proxy-inseguro/compose.yaml',
        'services:\n' +
        '  traefik:\n' +
        '    image: traefik:v3.7\n' +
        '    command:\n' +
        '      - "--providers.docker=true"\n' +
        '      - "--entrypoints.web.address=:80"\n' +
        '    ports:\n' +
        '      - "80:80"\n' +
        '    volumes:\n' +
        '      - /var/run/docker.sock:/var/run/docker.sock\n');
    }
  });
})();
