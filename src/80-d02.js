/* =========================================================================
   MÓDULO D02 — Primeiros containers
   O ciclo de vida completo, comando por comando, com o estado real do
   ambiente sendo verificado a cada desafio.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 2.1 ============================== */
  LX.lesson('d02', {
    id: 'ld2-1', n: '2.1', title: 'docker run: o comando que faz cinco coisas',
    goal: 'Entender que `docker run` é um atalho para uma sequência — e saber separar cada etapa quando precisar.',
    body: [
      { h2: 'O que o run faz por baixo' },
      { p: 'Uma única linha esconde cinco operações:' },
      {
        ascii: `docker run nginx:alpine
   │
   ├─ 1. a imagem está no disco?         → docker images
   ├─ 2. não está: baixa do registry     → docker pull
   ├─ 3. cria o container                → docker create
   ├─ 4. inicia o processo               → docker start
   └─ 5. conecta a saída ao terminal     → docker attach`
      },
      { p: 'Você pode executar os passos separados. Isso não é curiosidade acadêmica: em servidor, separar <em>baixar</em> de <em>subir</em> é justamente o que permite atualizar uma stack sem downtime.' },
      { code: ['$ docker pull nginx:alpine', '$ docker create --name separado nginx:alpine', '$ docker ps -a', '$ docker start separado', '$ docker ps'] },
      { p: 'Repare que depois do <code>create</code> o container aparece em <code>docker ps -a</code> com status <code>Created</code>: ele existe, tem sistema de arquivos, tem configuração — e nenhum processo rodando.' },

      { h2: 'Primeiro plano e segundo plano' },
      {
        table: {
          head: ['Forma', 'Comportamento', 'Quando usar'],
          rows: [
            ['<code>docker run imagem</code>', 'prende o terminal e mostra a saída', 'comandos rápidos, testes, ver o log de um serviço subindo'],
            ['<code>docker run -d imagem</code>', 'devolve o id e libera o terminal', 'serviços — praticamente sempre, em servidor'],
            ['<code>docker run -it imagem sh</code>', 'abre um shell interativo dentro do container', 'explorar uma imagem, depurar']
          ]
        }
      },
      { p: 'Em primeiro plano, <kbd>Ctrl+C</kbd> encerra o container junto. Em segundo plano, ele continua e você acompanha com <code>docker logs -f</code>.' },

      { h2: 'Dando um comando diferente ao container' },
      { p: 'Toda imagem traz um comando padrão. Você pode substituí-lo escrevendo outro depois do nome da imagem:' },
      { code: ['$ docker run --rm alpine', '$ docker run --rm alpine echo "eu escolhi o comando"', '$ docker run --rm alpine ls /etc', '$ docker run --rm alpine cat /etc/os-release'] },
      { p: 'O primeiro não imprime nada: o comando padrão do Alpine é <code>/bin/sh</code>, que sem terminal encerra na hora. Os outros substituem esse padrão.' },
      {
        box: 'note', label: 'A ordem importa', body: [
          { p: 'Tudo que vem <strong>antes</strong> do nome da imagem é opção do Docker. Tudo que vem <strong>depois</strong> é comando para dentro do container.' },
          { code: ['docker run  -d --name web  -p 8080:80   nginx:alpine   nginx -g "daemon off;"',
            '            └──── opções do Docker ────┘  └─ imagem ─┘  └──── comando ────┘'], run: false, lang: 'text' },
          { p: 'Escrever <code>docker run nginx -d</code> não roda em segundo plano: passa <code>-d</code> como argumento para o nginx lá dentro.' }
        ]
      },

      { h2: 'Nomes' },
      { p: 'Sem <code>--name</code>, o Docker inventa um nome como <code>vibrant_hopper</code>. Divertido, mas inútil em servidor: em uma stack real, todo container tem nome escolhido.' },
      { code: ['$ docker run -d --name meu-site nginx:alpine', '$ docker run -d --name meu-site nginx:alpine'] },
      { p: 'A segunda tentativa falha com <em>Conflict. The container name "/meu-site" is already in use</em>. Nome de container é único na máquina — mesmo que o outro esteja parado.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>run</code> = <code>pull</code> + <code>create</code> + <code>start</code> + <code>attach</code>.',
          '<code>-d</code> devolve o terminal; sem ele, o container prende a sessão.',
          'Antes da imagem: opções do Docker. Depois: comando de dentro.',
          'Nome de container é único, inclusive entre os parados.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td2-1-a', kind: 'guiado', title: 'Separar as etapas do run',
        body: [
          { p: 'Faça manualmente o que o <code>run</code> faz sozinho:' },
          { code: ['$ docker pull nginx:alpine', '$ docker create --name separado nginx:alpine', '$ docker ps -a --filter name=separado', '$ docker start separado', '$ docker ps --filter name=separado'] },
          { p: 'Compare o <code>STATUS</code> antes e depois do <code>start</code>.' }
        ],
        hints: ['O <code>--filter name=separado</code> limita a listagem a esse container.'],
        solution: '<pre>$ docker pull nginx:alpine\n$ docker create --name separado nginx:alpine\n$ docker ps -a --filter name=separado\n$ docker start separado\n$ docker ps --filter name=separado</pre>',
        check: async (ctx) => {
          const c = D.container(ctx, 'separado');
          return H.checkAll([
            [() => !!c, 'Crie o container com <code>docker create --name separado nginx:alpine</code>.'],
            [() => H.usedCommand(ctx, /docker\s+create/), 'Use <code>docker create</code> — o objetivo aqui é separar as etapas, não usar o <code>run</code>.'],
            [() => !!c && c.rodando, 'Agora inicie o container com <code>docker start separado</code>.']
          ]);
        }
      },
      {
        id: 'td2-1-q', kind: 'quiz', title: 'Onde vai o -d',
        body: [
          { p: 'Alguém escreveu:' },
          { code: ['$ docker run nginx:alpine -d'], run: false, lang: 'bash' },
          { p: 'e o container encerrou imediatamente com um erro. Por quê?' }
        ],
        options: [
          { text: 'O <code>-d</code> veio depois do nome da imagem, então virou argumento do processo de dentro. O nginx recebeu <code>-d</code> e reclamou.', correct: true },
          { text: 'A imagem <code>nginx:alpine</code> não aceita <code>-d</code>.', why: 'Toda imagem aceita <code>-d</code> — porque <code>-d</code> é opção do Docker, não da imagem. O problema é a posição.' },
          { text: 'Faltou <code>--name</code>.', why: 'O nome é opcional; sem ele o Docker gera um automaticamente.' },
          { text: '<code>-d</code> precisa vir junto com <code>-it</code>.', why: 'São opções independentes, e na prática opostas.' }
        ],
        explain: 'É a regra da ordem: opções do Docker antes da imagem, comando do container depois. A forma correta é <code>docker run -d nginx:alpine</code>. E este mesmo raciocínio explica por que <code>docker run alpine -it</code> também não funciona, e por que <code>docker run alpine ls -la</code> funciona (aí <code>-la</code> é mesmo argumento do <code>ls</code>).'
      },
      {
        id: 'td2-1-b', kind: 'desafio', title: 'Subir um serviço em passos separados',
        body: [
          { p: 'Sem usar <code>docker run</code>, monte um container chamado <code>catalogo</code> a partir da imagem <code>redis:7-alpine</code>, deixando-o em execução no fim.' },
          { p: 'Use as etapas separadas que a aula mostrou: primeiro criar, depois iniciar.' }
        ],
        hints: [
          'São dois comandos: um que cria o container parado, outro que o inicia.',
          'A forma é <code>docker create --name catalogo redis:7-alpine</code>, seguido de <code>docker start catalogo</code>.'
        ],
        solution: '<pre>$ docker create --name catalogo redis:7-alpine\n$ docker start catalogo\n$ docker ps --filter name=catalogo</pre>',
        check: async (ctx) => {
          const c = D.container(ctx, 'catalogo');
          return H.checkAll([
            [() => !!c, 'Crie o container com <code>docker create --name catalogo redis:7-alpine</code>.'],
            [() => H.usedCommand(ctx, /docker\s+create/), 'Use <code>docker create</code>, não <code>docker run</code> — o objetivo é separar as etapas.'],
            [() => H.usedCommand(ctx, /docker\s+start\s+catalogo/), 'Inicie o container já criado com <code>docker start catalogo</code>.'],
            [() => !!c && c.rodando, 'O container <code>catalogo</code> precisa terminar o exercício em execução.']
          ]);
        }
      }
    ]
  });

  /* ============================== 2.2 ============================== */
  LX.lesson('d02', {
    id: 'ld2-2', n: '2.2', title: 'Parar, iniciar, reiniciar, pausar e remover',
    goal: 'Conhecer cada estado de um container, o comando que leva a ele e a diferença entre parar e remover.',
    setup: (m) => {
      /* Um servidor de verdade acumula containers parados. Deixamos essa
         bagunça pronta para o desafio de limpeza ter o que limpar — e um
         container em execução no meio, que não pode ser removido junto. */
      const e = m.docker;
      if (!e) return;
      if (!e.containerPorNome('portal')) {
        LX.D.montar(m, { imagem: 'nginx:alpine', nome: 'portal' });
      }
      for (const [nome, cmd] of [['antigo-1', ['echo', 'tarefa concluida']],
      ['antigo-2', ['echo', 'outra tarefa']], ['antigo-3', ['echo', 'mais uma']]]) {
        if (e.containerPorNome(nome)) continue;
        const r = e.criarContainer({ imagem: 'alpine:3.21', nome, cmd });
        if (r.ok) { r.container.estado = 'exited'; r.container.saida = 0; r.container.terminadoEm = Date.now() - 3600000; }
      }
    },
    body: [
      { h2: 'Os estados' },
      {
        ascii: `                 docker create
                       │
                       ▼
                   ┌────────┐
                   │created │
                   └────┬───┘
        docker start    │
                        ▼
    ┌─── docker pause ──────────────┐
    ▼                               │
┌────────┐                    ┌──────────┐    docker stop    ┌────────┐
│ paused │◀── docker pause ───│ running  │──────────────────▶│ exited │
└────────┘── docker unpause ─▶└──────────┘◀── docker start ──└───┬────┘
                                    │                            │
                              docker kill                 docker rm
                                    │                            │
                                    └────────────▶ exited        ▼
                                                             (não existe mais)`
      },

      { h2: 'stop e kill: a diferença é a educação' },
      { p: 'Você já viu isso no módulo de processos do curso de Linux, e vale igual aqui:' },
      {
        table: {
          head: ['Comando', 'Sinal', 'O que acontece'],
          rows: [
            ['<code>docker stop</code>', '<code>SIGTERM</code>, e depois <code>SIGKILL</code>', 'pede para o processo encerrar; espera 10 segundos; se não sair, mata'],
            ['<code>docker kill</code>', '<code>SIGKILL</code> direto', 'mata na hora, sem chance de salvar nada']
          ]
        }
      },
      {
        box: 'warn', label: 'Por que isso importa em um banco de dados', body: [
          { p: 'Um <code>SIGTERM</code> dá ao processo a chance de gravar o que estava em memória e fechar os arquivos direito. Um <code>SIGKILL</code> não dá.' },
          { p: 'Em um banco de dados, <code>docker kill</code> pode deixar dados inconsistentes. Sempre prefira <code>docker stop</code>, e só use <code>kill</code> quando o container realmente travou.' },
          { p: 'O tempo de espera se ajusta com <code>-t</code>: <code>docker stop -t 30 banco</code> dá 30 segundos.' }
        ]
      },

      { h2: 'stop × rm: parar não é apagar' },
      { code: ['$ docker run -d --name teste nginx:alpine', '$ docker stop teste', '$ docker ps -a --filter name=teste', '$ docker start teste'] },
      { p: 'Depois do <code>stop</code>, o container continua ali: mesmo id, mesmo sistema de arquivos, mesmos logs, mesma configuração. O <code>start</code> devolve tudo. Só o <code>rm</code> apaga de verdade.' },
      { code: ['$ docker rm teste'] },
      { p: 'E o <code>rm</code> recusa container em execução — de propósito, para você não derrubar um serviço sem querer:' },
      { code: ['Error response from daemon: cannot remove container "/teste": container is running: stop the container before removing or force remove'], run: false, lang: 'text' },
      { p: 'O <code>-f</code> força (mata e remove em um passo). É prático e é perigoso: use com atenção.' },

      { h2: 'restart × stop + start' },
      { p: 'São quase a mesma coisa, com uma diferença que importa em servidor:' },
      {
        ul: [
          '<code>docker restart</code> para e sobe <strong>o mesmo container</strong>, com a mesma configuração e o mesmo sistema de arquivos',
          '<code>docker rm</code> + <code>docker run</code> cria um container <strong>novo</strong> — e é isso que faz uma imagem nova entrar em vigor'
        ]
      },
      {
        box: 'key', label: 'A pegadinha da atualização', body: [
          { p: 'Você faz <code>docker pull minha-api:2.0</code> e depois <code>docker restart api</code>. E a versão antiga continua rodando.' },
          { p: 'Motivo: o container já existente está amarrado à imagem com a qual foi criado. Reiniciar não troca a imagem. Para subir a nova versão é preciso <strong>recriar</strong> o container. Voltaremos a isso no módulo de servidor, com o comando exato.' }
        ]
      },

      { h2: 'pause: congelar sem encerrar' },
      { p: '<code>docker pause</code> congela todos os processos do container usando cgroups. A memória continua alocada, as conexões continuam abertas, o processo simplesmente não recebe tempo de CPU. É usado para tirar um retrato consistente do estado — não é uma forma de "desligar".' },

      { h2: 'Vários de uma vez' },
      { code: ['$ docker stop web api db', '$ docker rm $(docker ps -aq --filter status=exited)', '$ docker container prune'] },
      { p: 'O segundo usa substituição de comando, que você viu em Bash: <code>docker ps -aq --filter status=exited</code> lista só os ids dos parados, e o <code>rm</code> recebe essa lista. O terceiro faz o mesmo com um comando dedicado, e pede confirmação antes.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>stop</code> pede (SIGTERM); <code>kill</code> mata (SIGKILL). Em banco de dados, sempre <code>stop</code>.',
          'Parar não apaga: o container fica com tudo, e <code>start</code> devolve.',
          '<code>rm</code> recusa container em execução; <code>-f</code> força.',
          '<code>restart</code> reinicia o mesmo container — não troca a imagem.',
          '<code>container prune</code> limpa todos os parados de uma vez.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td2-2-a', kind: 'guiado', title: 'O ciclo inteiro',
        body: [
          { p: 'Percorra todos os estados de um container e observe o <code>STATUS</code> a cada passo:' },
          { code: ['$ docker run -d --name ciclo nginx:alpine', '$ docker ps --filter name=ciclo',
            '$ docker pause ciclo', '$ docker ps --filter name=ciclo', '$ docker unpause ciclo',
            '$ docker stop ciclo', '$ docker ps -a --filter name=ciclo', '$ docker start ciclo',
            '$ docker restart ciclo', '$ docker ps --filter name=ciclo'] },
          { p: 'Deixe o container <code>ciclo</code> rodando no fim.' }
        ],
        hints: ['Rode um comando por vez e leia a coluna STATUS depois de cada mudança.'],
        solution: '<pre>$ docker run -d --name ciclo nginx:alpine\n$ docker pause ciclo\n$ docker unpause ciclo\n$ docker stop ciclo\n$ docker start ciclo\n$ docker restart ciclo\n$ docker ps --filter name=ciclo</pre>',
        check: async (ctx) => H.checkAll([
          [() => !!D.container(ctx, 'ciclo'), 'Crie o container com <code>docker run -d --name ciclo nginx:alpine</code>.'],
          [() => H.usedCommand(ctx, /docker\s+pause\s+ciclo/), 'Falta passar pelo estado pausado: <code>docker pause ciclo</code>.'],
          [() => H.usedCommand(ctx, /docker\s+unpause\s+ciclo/), 'Despause com <code>docker unpause ciclo</code>.'],
          [() => H.usedCommand(ctx, /docker\s+stop\s+ciclo/), 'Pare o container com <code>docker stop ciclo</code>.'],
          [() => H.usedCommand(ctx, /docker\s+start\s+ciclo/), 'Suba de novo com <code>docker start ciclo</code>.'],
          [() => H.usedCommand(ctx, /docker\s+restart\s+ciclo/), 'Use também <code>docker restart ciclo</code>.'],
          [() => D.rodando(ctx, 'ciclo'), 'O container <code>ciclo</code> precisa terminar o exercício em execução.']
        ])
      },
      {
        id: 'td2-2-q', kind: 'quiz', title: 'A versão nova não entrou em vigor',
        body: [
          { p: 'Você roda <code>docker pull minha-api:2.0</code> para baixar a versão nova e depois <code>docker restart api</code>. Mas o container continua respondendo com o comportamento da versão antiga. O que falta?' }
        ],
        options: [
          { text: 'O container <code>api</code> já existente está amarrado à imagem com que foi criado; <code>restart</code> para e sobe o <strong>mesmo</strong> container, sem trocar a imagem. É preciso recriá-lo — remover e rodar de novo — para a versão nova entrar em vigor.', correct: true },
          { text: '<code>docker restart</code> não existe; o comando certo seria <code>docker reload</code>.', why: '<code>docker restart</code> existe e funciona — só que ele reinicia o processo, não troca a imagem de origem do container.' },
          { text: 'Faltou rodar <code>docker pull</code> de novo depois do restart.', why: 'O pull já trouxe a imagem nova para o disco. O problema não é a imagem estar ausente, é o container antigo continuar amarrado à imagem antiga.' },
          { text: 'O <code>restart</code> só funciona em containers criados com <code>--restart always</code>.', why: '<code>docker restart</code> funciona em qualquer container, independente da política de reinício — que é outra configuração, sobre o que fazer quando o processo morre sozinho.' }
        ],
        explain: 'Esta é a "pegadinha da atualização" do resumo da aula: um container fica preso à imagem com que nasceu. <code>restart</code> só para e sobe de novo esse mesmo container — mesma configuração, mesma imagem. Para trocar de versão, o caminho é <code>docker rm</code> (ou <code>stop</code> + <code>rm</code>) seguido de um novo <code>docker run</code> apontando para a imagem nova.'
      },
      {
        id: 'td2-2-b', kind: 'desafio', title: 'Limpar a bagunça',
        body: [
          { p: 'O ambiente está com containers parados acumulados de aulas anteriores. Seu trabalho:' },
          { ol: [
            'Liste todos os containers, inclusive os parados, e veja quantos existem.',
            'Remova <strong>todos os parados</strong>, sem tocar nos que estão em execução.',
            'Confirme que sobrou apenas o que estava rodando.'
          ] },
          { p: 'Existe um comando que faz isso sozinho. Encontre-o.' }
        ],
        hints: [
          'Rode <code>docker system --help</code> ou <code>docker container --help</code> e procure por algo que "remove unused".',
          'O comando é <code>docker container prune</code>. Ele pede confirmação; responda <code>y</code>, ou use <code>-f</code> para pular a pergunta.',
          'Alternativa manual: <code>docker rm $(docker ps -aq --filter status=exited)</code>.'
        ],
        solution: '<pre>$ docker ps -a\n$ docker container prune -f\nDeleted Containers:\n...\n$ docker ps -a</pre>',
        check: async (ctx) => {
          const parados = D.containers(ctx, c => !c.rodando && c.estado !== 'paused');
          return H.checkAll([
            [() => H.usedCommand(ctx, /docker\s+(ps\s+-a|container\s+ls\s+-a)/), 'Comece listando tudo com <code>docker ps -a</code>.'],
            [() => H.usedCommand(ctx, /prune|docker\s+rm\s/), 'Agora remova os containers parados.'],
            [() => parados.length === 0,
              () => `Ainda existem ${parados.length} container(es) parado(s): ${parados.map(c => c.nome).join(', ')}. Use <code>docker container prune -f</code>.`],
            [() => D.containers(ctx, c => c.rodando).length > 0,
              'Você removeu também os containers que estavam em execução. A tarefa era limpar só os parados — suba um container de novo e refaça a limpeza com <code>prune</code>, que não toca nos ativos.']
          ]);
        }
      }
    ]
  });

  /* ============================== 2.3 ============================== */
  LX.lesson('d02', {
    id: 'ld2-3', n: '2.3', title: 'Ler a saída do docker ps',
    goal: 'Extrair informação de cada coluna do `docker ps`, filtrar e formatar a saída para responder perguntas específicas.',
    body: [
      { h2: 'As sete colunas' },
      { code: ['$ docker run -d --name web -p 8080:80 nginx:alpine', '$ docker ps'] },
      {
        table: {
          head: ['Coluna', 'O que é', 'Detalhe que importa'],
          rows: [
            ['<code>CONTAINER ID</code>', 'os 12 primeiros dígitos do id', 'você pode usar só os primeiros caracteres, desde que sejam únicos'],
            ['<code>IMAGE</code>', 'a imagem de origem', 'se aparecer um id em vez de um nome, a tag foi removida depois'],
            ['<code>COMMAND</code>', 'o processo 1, truncado', '<code>--no-trunc</code> mostra inteiro'],
            ['<code>CREATED</code>', 'quando foi criado', 'não é quando foi iniciado'],
            ['<code>STATUS</code>', 'estado e há quanto tempo', 'a coluna mais informativa da tabela'],
            ['<code>PORTS</code>', 'mapeamentos de porta', 'vazio significa que nada foi publicado'],
            ['<code>NAMES</code>', 'o nome', 'o que você vai usar em todos os outros comandos']
          ]
        }
      },

      { h2: 'STATUS conta uma história' },
      {
        table: {
          head: ['Status', 'Leitura'],
          rows: [
            ['<code>Up 3 minutes</code>', 'em execução há 3 minutos'],
            ['<code>Up 5 seconds (health: starting)</code>', 'subiu, mas o healthcheck ainda não aprovou'],
            ['<code>Up 2 minutes (healthy)</code>', 'a aplicação respondeu ao healthcheck'],
            ['<code>Up 4 minutes (unhealthy)</code>', 'está rodando, mas <strong>não está funcionando</strong>'],
            ['<code>Exited (0) 2 minutes ago</code>', 'terminou normalmente'],
            ['<code>Exited (1) 5 seconds ago</code>', 'terminou com erro'],
            ['<code>Exited (137) 1 minute ago</code>', 'foi morto — 137 = 128+9 = SIGKILL. Muitas vezes é OOM'],
            ['<code>Restarting (1) 8 seconds ago</code>', 'está em laço de reinício: sobe, morre, sobe']
          ]
        }
      },
      {
        box: 'key', label: 'Códigos de saída que você vai encontrar', body: [
          {
            ul: [
              '<code>0</code> — terminou normalmente',
              '<code>1</code> — erro genérico da aplicação; leia os logs',
              '<code>125</code> — o próprio comando <code>docker</code> falhou (flag inválida, por exemplo)',
              '<code>126</code> — o comando existe mas não pôde ser executado (sem permissão de execução)',
              '<code>127</code> — o comando não foi encontrado no <code>$PATH</code> do container',
              '<code>137</code> — <code>SIGKILL</code>. Se você não matou, foi o kernel por falta de memória',
              '<code>143</code> — <code>SIGTERM</code>: encerramento pedido'
            ]
          }
        ]
      },

      { h2: 'Filtros' },
      { code: ['$ docker ps -a --filter status=exited',
        '$ docker ps --filter name=web',
        '$ docker ps --filter ancestor=nginx:alpine',
        '$ docker ps --filter health=unhealthy',
        '$ docker ps -a --filter label=com.docker.compose.project=loja'] },
      { p: 'Filtros compõem: pode usar vários <code>--filter</code> na mesma linha.' },

      { h2: 'Formatação' },
      { p: 'A saída padrão é larga demais para caber num terminal de servidor. O <code>--format</code> resolve:' },
      { code: ['$ docker ps --format "{{.Names}}\\t{{.Status}}"',
        '$ docker ps --format "{{.Names}} usa {{.Image}} em {{.Ports}}"',
        '$ docker ps -aq'] },
      { p: 'O <code>-q</code> (<em>quiet</em>) imprime só os ids — é o que alimenta as substituições de comando, como <code>docker rm $(docker ps -aq)</code>.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>STATUS</code> é a coluna que mais informa; leia inclusive o código de saída.',
          '<code>137</code> costuma ser falta de memória; <code>127</code> é comando inexistente.',
          '<code>--filter</code> restringe a listagem; <code>--format</code> escolhe as colunas.',
          '<code>-q</code> serve para alimentar outros comandos.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td2-3-a', kind: 'guiado', title: 'Ler as colunas e aplicar --format',
        body: [
          { p: 'Suba um serviço publicado e leia a mesma informação de três jeitos:' },
          { code: ['$ docker run -d --name web -p 8080:80 nginx:alpine', '$ docker ps', '$ docker ps --filter name=web', '$ docker ps --format "{{.Names}}\\t{{.Status}}"'] },
          { p: 'A listagem padrão, a filtrada e a formatada mostram a mesma informação — só muda a apresentação.' }
        ],
        hints: ['Rode um comando de cada vez e compare as colunas antes de filtrar ou formatar.'],
        solution: '<pre>$ docker run -d --name web -p 8080:80 nginx:alpine\n$ docker ps\n$ docker ps --filter name=web\n$ docker ps --format "{{.Names}}\\t{{.Status}}"</pre>',
        check: async (ctx) => H.checkAll([
          [() => D.rodando(ctx, 'web'), 'Suba o container com <code>docker run -d --name web -p 8080:80 nginx:alpine</code>.'],
          [() => H.usedCommand(ctx, /docker\s+ps\s+--filter/), 'Filtre a listagem com <code>docker ps --filter name=web</code>.'],
          [() => H.usedCommand(ctx, /docker\s+ps\s+--format/), 'Formate a saída com <code>docker ps --format</code>.']
        ])
      },
      {
        id: 'td2-3-q', kind: 'quiz', title: 'O que aconteceu com este container',
        body: [
          { p: 'Você chega em um servidor e encontra:' },
          { code: ['$ docker ps -a', 'CONTAINER ID   IMAGE            COMMAND     CREATED       STATUS                       PORTS   NAMES',
            'a91f2c4e7b10   api-loja:2.1     "node ..."  2 hours ago   Exited (137) 4 minutes ago           api'], run: false, lang: 'text' },
          { p: 'Qual é a hipótese mais provável, e qual o primeiro comando para confirmá-la?' }
        ],
        options: [
          { text: 'O processo foi morto com SIGKILL — provavelmente estouro de memória. Confirmar com <code>docker inspect api --format "{{.State.OOMKilled}}"</code> e olhar os logs.', correct: true },
          { text: 'A aplicação terminou normalmente; 137 é código de sucesso.', why: 'Sucesso é 0. 137 = 128 + 9, ou seja, morte por sinal 9 (SIGKILL).' },
          { text: 'A imagem não existe; por isso o container não subiu.', why: 'Imagem inexistente impede a criação — o container nem chegaria a ter rodado por duas horas.' },
          { text: 'Falta de permissão no socket do Docker.', why: 'Isso impediria o comando <code>docker</code> de funcionar, não geraria um container que rodou e depois morreu.' }
        ],
        explain: '137 é a assinatura do SIGKILL, e a causa nº 1 em servidor é o <em>OOM killer</em> do kernel matando o processo por estouro do limite de memória. A investigação segue assim: <code>docker inspect api --format "{{.State.OOMKilled}}"</code> confirma; <code>docker logs --tail 50 api</code> mostra o que a aplicação fazia antes; <code>docker stats</code> nos outros containers mostra se o consumo está no limite. O módulo de CPU e memória trata disso em detalhe.'
      },
      {
        id: 'td2-3-b', kind: 'desafio', title: 'Um relatório de uma linha por container',
        body: [
          { p: 'Você precisa de uma visão rápida da máquina, com <strong>uma linha por container</strong>, incluindo os parados, no formato:' },
          { code: ['nome | imagem | status'], run: false, lang: 'text' },
          { p: 'Grave o resultado em <code>~/containers.txt</code>.' },
          { p: 'Antes disso, garanta que existem pelo menos três containers na máquina para o relatório ter conteúdo.' }
        ],
        hints: [
          'Use <code>docker ps -a</code> com <code>--format</code>.',
          'O separador literal " | " pode ir dentro do próprio formato: <code>--format "{{.Names}} | {{.Image}} | {{.Status}}"</code>.',
          'Redirecione com <code>&gt; ~/containers.txt</code> e confira com <code>cat</code>.'
        ],
        solution: '<pre>$ docker run -d --name a1 nginx:alpine\n$ docker run -d --name a2 nginx:alpine\n$ docker run --name a3 alpine echo ola\n$ docker ps -a --format "{{.Names}} | {{.Image}} | {{.Status}}" &gt; ~/containers.txt\n$ cat ~/containers.txt</pre>',
        check: async (ctx) => {
          const texto = H.read(ctx, '/home/aluno/containers.txt');
          const linhas = texto ? texto.trim().split('\n').filter(Boolean) : [];
          const total = D.containers(ctx).length;
          return H.checkAll([
            [() => total >= 3, () => `Só existem ${total} container(es) na máquina. Crie pelo menos três antes de gerar o relatório.`],
            [() => texto !== null, 'O arquivo <code>~/containers.txt</code> ainda não existe. Redirecione a saída com <code>&gt; ~/containers.txt</code>.'],
            [() => linhas.length >= 3, () => `O relatório tem ${linhas.length} linha(s), mas a máquina tem ${total} containers. Use <code>docker ps -a</code> (com o <code>-a</code>) para incluir os parados.`],
            [() => linhas.every(l => (l.match(/\|/g) || []).length >= 2),
              'Cada linha precisa ter nome, imagem e status separados por <code>|</code>. Monte com <code>--format "{{.Names}} | {{.Image}} | {{.Status}}"</code>.'],
            [() => {
              /* os nomes do relatório precisam bater com os containers de verdade */
              const nomes = D.containers(ctx).map(c => c.nome);
              const noArquivo = linhas.map(l => l.split('|')[0].trim());
              return noArquivo.length > 0 && noArquivo.every(n => nomes.includes(n));
            }, 'Há nomes no relatório que não correspondem a containers existentes. Gere o arquivo a partir da saída real do <code>docker ps -a</code>, sem digitar à mão.']
          ]);
        },
        forja: ['printf "inventado | nginx | Up\\ninventado2 | nginx | Up\\ninventado3 | nginx | Up\\n" > ~/containers.txt']
      }
    ]
  });
})();
