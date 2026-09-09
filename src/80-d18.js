/* =========================================================================
   MÓDULO D18 — CPU, memória e disco
   Limitar o que um container consome, observar o que ele usa, e limpar o
   que o Docker acumula no disco.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 18.1 ============================== */
  LX.lesson('d18', {
    id: 'ld18-1', n: '18.1', title: 'Limitar a memória e o OOM killer',
    goal: 'Impedir que um container consuma toda a memória do servidor, e entender o que acontece quando ele estoura o limite.',
    body: [
      { h2: 'Sem limite, um container consome tudo' },
      { p: 'Por padrão, um container pode usar <strong>toda</strong> a memória do servidor. Um vazamento de memória em uma aplicação, ou um pico de tráfego, e esse container engole a RAM inteira — derrubando não só a si mesmo, mas todos os outros serviços da máquina junto.' },
      { p: 'A defesa é dar a cada container um teto: <code>--memory</code> (ou <code>-m</code>). Assim o estrago fica contido no container que causou o problema.' },
      {
        code: [
          'docker run -d --name api --memory 256m minha-api',
          'docker run -d --name cache --memory 512m redis:7-alpine'
        ], run: false
      },
      {
        table: {
          head: ['Sufixo', 'Significa'],
          rows: [
            ['<code>256m</code>', '256 mebibytes'],
            ['<code>1g</code>', '1 gibibyte'],
            ['<code>512k</code>', '512 kibibytes']
          ]
        }
      },

      { h2: 'O OOM killer: quando o limite é atingido' },
      { p: 'Quando um container tenta usar mais memória do que o limite permite, o kernel aciona o <strong>OOM killer</strong> (<em>Out Of Memory</em>): ele mata o processo que estourou. Do lado de fora, o container termina com o código de saída <strong>137</strong> — o sinal de que foi morto por falta de memória.' },
      {
        code: [
          '$ docker inspect api --format "{{.State.OOMKilled}} {{.State.ExitCode}}"',
          'true 137'
        ], run: false
      },
      {
        box: 'key', label: 'Reconheça o 137', body: [
          { p: 'Um container que reinicia sozinho a cada poucos minutos, sempre com <code>Exited (137)</code>, quase nunca é bug de código: é o OOM killer. Ou o limite está apertado demais para a carga real, ou a aplicação está vazando memória. O <code>docker inspect</code> com <code>.State.OOMKilled</code> confirma.' }
        ]
      },
      { p: 'Note a diferença dos outros códigos que você já viu: <strong>137</strong> é morte por <code>SIGKILL</code> (9) — e o OOM killer usa exatamente esse sinal. <strong>143</strong> seria <code>SIGTERM</code> (um encerramento pedido com jeito). O 137 é sempre uma morte forçada.' },

      { h2: 'Memória e swap' },
      { p: 'O <code>--memory</code> limita a RAM. Existe também o <code>--memory-swap</code>, que define o total de RAM + swap. A regra que evita confusão: se você quer <strong>proibir swap</strong> (o comum em servidor, porque swap num container degrada tudo em silêncio), iguale os dois.' },
      {
        code: [
          '# 256m de RAM, sem swap nenhum',
          'docker run --memory 256m --memory-swap 256m minha-api'
        ], run: false
      },
      {
        box: 'note', label: 'Reservar não é limitar', body: [
          { p: 'Há ainda o <code>--memory-reservation</code>, um limite <em>suave</em>: sob pressão de memória, o kernel tenta empurrar o container para baixo desse valor, mas não o mata. É útil para priorizar serviços; não substitui o <code>--memory</code>, que é o teto rígido.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td18-1-a', kind: 'guiado', title: 'Ponha um teto e confira',
        body: [
          { p: 'Suba um container com limite de memória e leia o limite de volta pelo inspect:' },
          {
            code: [
              '$ docker run -d --name limitado --memory 256m nginx:alpine',
              '$ docker inspect limitado --format "limite: {{.HostConfig.Memory}} bytes"',
              '$ docker stats --no-stream limitado'
            ]
          },
          { p: 'O <code>HostConfig.Memory</code> mostra o teto em bytes (256m = 268435456). No <code>docker stats</code>, a coluna <code>MEM USAGE / LIMIT</code> passa a mostrar o limite que você definiu, em vez da memória total da máquina.' }
        ],
        hints: ['256 mebibytes = 256 × 1024 × 1024 = 268435456 bytes.'],
        check: async (ctx) => LX.H.checkAll([
          [() => D.rodando(ctx, 'limitado'), 'Suba o container <code>limitado</code> com <code>--memory 256m</code>.'],
          [() => H.usedCommand(ctx, /docker\s+(inspect|stats)/), 'Confira o limite com <code>docker inspect</code> ou <code>docker stats</code>.']
        ])
      },
      {
        id: 'td18-1-q', kind: 'quiz', title: 'Exited (137)',
        body: [
          { p: 'Um container reinicia sozinho a cada poucos minutos. O <code>docker ps</code> mostra sempre <code>Exited (137)</code> pouco antes de reiniciar. Qual é a causa mais provável?' }
        ],
        options: [
          { text: 'O OOM killer: o container está atingindo o limite de memória e sendo morto com SIGKILL (código 137). O limite pode estar apertado demais, ou a aplicação está vazando memória.', correct: true },
          { text: 'A aplicação está terminando normalmente com sucesso.', why: 'Sucesso é código 0. O 137 é morte forçada por SIGKILL — o oposto de um encerramento limpo.' },
          { text: 'Falta de espaço em disco.', why: 'Disco cheio dá outros erros (<code>No space left on device</code>), não código 137. O 137 é especificamente SIGKILL, que o OOM killer usa.' },
          { text: 'A porta do container está ocupada.', why: 'Porta ocupada impede o container de subir e dá uma mensagem de <code>bind</code>, não um 137 recorrente depois de já estar rodando.' }
        ],
        explain: 'O código 137 = 128 + 9 (SIGKILL). O OOM killer mata com SIGKILL quando o container passa do <code>--memory</code>. Confirme com <code>docker inspect NOME --format "{{.State.OOMKilled}}"</code>: se vier <code>true</code>, é memória. A correção é aumentar o limite se a carga real justifica, ou caçar o vazamento na aplicação.'
      },
      {
        id: 'td18-1-b', kind: 'desafio', title: 'Contenha um serviço',
        body: [
          { p: 'Suba um container chamado <code>medido</code> a partir de <code>redis:7-alpine</code>, limitado a <strong>256m</strong> de memória e <strong>sem swap</strong> (RAM e swap iguais).' },
          { p: 'Ao final, o container precisa estar rodando com o teto de 256m aplicado.' }
        ],
        hints: [
          'Um único <code>docker run -d --name medido</code> com <code>--memory 256m --memory-swap 256m</code> antes do nome da imagem.',
          'Confira com <code>docker inspect medido --format "{{.HostConfig.Memory}}"</code> — deve dar 268435456.'
        ],
        solution: '<pre>$ docker run -d --name medido --memory 256m --memory-swap 256m redis:7-alpine\n$ docker inspect medido --format "{{.HostConfig.Memory}}"</pre>',
        check: (ctx) => {
          const c = D.container(ctx, 'medido');
          return H.checkAll([
            [() => !!c, 'O container <code>medido</code> não existe. Suba-o a partir de <code>redis:7-alpine</code>.'],
            [() => c.rodando, 'O container <code>medido</code> não está rodando.'],
            [() => /redis:7-alpine/.test(c.imagemRef || ''), () => 'A imagem é <code>' + c.imagemRef + '</code>; o desafio pede <code>redis:7-alpine</code>.'],
            [() => c.recursos && c.recursos.memoria === 256 * 1024 * 1024,
              () => 'O limite de memória não está em 256m (está em <code>' + ((c.recursos && c.recursos.memoria) || 0) + '</code> bytes). Use <code>--memory 256m</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 18.2 ============================== */
  LX.lesson('d18', {
    id: 'ld18-2', n: '18.2', title: 'CPU e observar o consumo',
    goal: 'Limitar quanto de CPU um container pode usar, e observar o consumo real de uma stack em tempo real.',
    body: [
      { h2: 'Fatiar a CPU' },
      { p: 'Assim como a memória, a CPU é compartilhada por todos os containers. Um processo em laço infinito pode ocupar todos os núcleos e deixar o resto da máquina sem resposta. O <code>--cpus</code> limita quantos núcleos (ou frações) um container pode usar.' },
      {
        code: [
          'docker run -d --name api --cpus 1.5 minha-api',
          'docker run -d --name lote --cpus 0.5 processador-de-fila'
        ], run: false
      },
      {
        table: {
          head: ['Valor', 'Significa'],
          rows: [
            ['<code>--cpus 0.5</code>', 'no máximo meio núcleo — bom para tarefas de fundo'],
            ['<code>--cpus 1</code>', 'um núcleo inteiro'],
            ['<code>--cpus 2</code>', 'até dois núcleos'],
            ['<code>--cpu-shares 512</code>', 'peso <em>relativo</em> quando há disputa (o padrão é 1024)']
          ]
        }
      },
      {
        box: 'key', label: 'Limite rígido × peso relativo', body: [
          { p: 'O <code>--cpus</code> é um teto absoluto: 0.5 nunca passa de meio núcleo, mesmo com a máquina ociosa. O <code>--cpu-shares</code> é diferente — só entra em ação quando há <em>disputa</em>: com a CPU sobrando, um container de share baixo ainda pode usar tudo. Para conter um vizinho barulhento, use <code>--cpus</code>.' }
        ]
      },

      { h2: 'Ver o que está acontecendo agora' },
      { p: 'Dois comandos respondem "o que este container está consumindo?" e "o que está rodando dentro dele?":' },
      {
        table: {
          head: ['Comando', 'Mostra'],
          rows: [
            ['<code>docker stats</code>', 'CPU %, memória, rede e I/O de disco de cada container, ao vivo'],
            ['<code>docker stats --no-stream</code>', 'o mesmo, mas uma foto única (bom para script)'],
            ['<code>docker top NOME</code>', 'a lista de processos rodando dentro do container'],
            ['<code>docker stats NOME</code>', 'só o container que interessa']
          ]
        }
      },
      {
        code: [
          '$ docker stats --no-stream',
          'CONTAINER   NAME    CPU %   MEM USAGE / LIMIT   MEM %   ...',
          '0cf0214023df web    0.24%   11.3MB / 256MiB     4.4%    ...'
        ], run: false
      },
      { p: 'O <code>docker stats</code> é a primeira coisa a olhar quando "o servidor está lento": em segundos você vê qual container está comendo CPU ou memória, sem precisar entrar em nenhum deles. E o <code>docker top</code> mostra, sem <code>exec</code>, quais processos estão rodando lá dentro — útil quando o container nem tem shell.' },
      {
        box: 'note', label: 'stats é uma foto, não um histórico', body: [
          { p: 'O <code>docker stats</code> mostra o instante atual. Para acompanhar consumo ao longo do tempo e receber alertas, o caminho são ferramentas de monitoramento (cAdvisor, Prometheus). Mas para o "por que está lento agora?", o <code>stats</code> resolve na hora.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td18-2-a', kind: 'guiado', title: 'Observe uma stack consumindo',
        body: [
          { p: 'Suba dois serviços e observe o consumo e os processos:' },
          {
            code: [
              '$ docker run -d --name web nginx:alpine',
              '$ docker run -d --name cache redis:7-alpine',
              '$ docker stats --no-stream',
              '$ docker top web'
            ]
          },
          { p: 'O <code>docker stats</code> lista os dois de uma vez, com CPU e memória lado a lado. O <code>docker top web</code> mostra os processos do Nginx rodando dentro do container — sem precisar de <code>docker exec</code>.' }
        ],
        hints: ['O <code>--no-stream</code> tira uma foto única em vez de atualizar continuamente.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+stats/), 'Rode <code>docker stats --no-stream</code> para ver o consumo.'],
          [() => H.usedCommand(ctx, /docker\s+top/), 'Rode <code>docker top web</code> para ver os processos de dentro.']
        ])
      },
      {
        id: 'td18-2-q', kind: 'quiz', title: 'O vizinho barulhento',
        body: [
          { p: 'Um container de processamento em lote às vezes dispara e ocupa todos os núcleos, deixando a API do mesmo servidor sem resposta. Você quer garantir que esse container <strong>nunca</strong> use mais que meio núcleo, mesmo com a máquina ociosa. Qual flag?' }
        ],
        options: [
          { text: '<code>--cpus 0.5</code> — é um teto absoluto: o container nunca passa de meio núcleo, independentemente de haver CPU sobrando.', correct: true },
          { text: '<code>--cpu-shares 512</code> — garante que ele use no máximo meio núcleo.', why: '<code>--cpu-shares</code> é peso relativo, só age quando há disputa. Com a máquina ociosa, o container ainda pode usar todos os núcleos.' },
          { text: '<code>--memory 512m</code> — limitar a memória contém o uso de CPU.', why: 'Memória e CPU são recursos independentes; limitar uma não limita a outra.' },
          { text: 'Não dá para limitar CPU no Docker; só memória.', why: 'Dá sim, com <code>--cpus</code> (teto absoluto) e <code>--cpu-shares</code> (peso relativo).' }
        ],
        explain: 'Para conter um vizinho barulhento com garantia, o teto absoluto <code>--cpus</code> é o certo: <code>--cpus 0.5</code> nunca ultrapassa meio núcleo. O <code>--cpu-shares</code> serve para priorizar sob disputa, não para impor um máximo rígido.'
      },
      {
        id: 'td18-2-b', kind: 'desafio', title: 'Segure a tarefa de fundo',
        body: [
          { p: 'Suba um container chamado <code>fundo</code> a partir de <code>alpine:3.21</code> que rode uma tarefa longa (por exemplo <code>sleep 3600</code>), limitado a no máximo <strong>meio núcleo</strong> de CPU.' },
          { p: 'Ao final, o container precisa estar rodando com o limite de <code>0.5</code> CPU aplicado.' }
        ],
        hints: [
          '<code>docker run -d --name fundo --cpus 0.5 alpine:3.21 sleep 3600</code>. O comando longo (<code>sleep</code>) mantém o container de pé.',
          'Confira com <code>docker inspect fundo --format "{{.HostConfig.NanoCpus}}"</code> — meio núcleo é 500000000.'
        ],
        solution: '<pre>$ docker run -d --name fundo --cpus 0.5 alpine:3.21 sleep 3600\n$ docker inspect fundo --format "{{.HostConfig.NanoCpus}}"</pre>',
        check: (ctx) => {
          const c = D.container(ctx, 'fundo');
          return H.checkAll([
            [() => !!c, 'O container <code>fundo</code> não existe.'],
            [() => c.rodando, 'O container <code>fundo</code> não está rodando. Use um comando longo como <code>sleep 3600</code>.'],
            [() => c.recursos && c.recursos.cpus === 0.5,
              () => 'O limite de CPU não está em 0.5 (está em <code>' + ((c.recursos && c.recursos.cpus) || 'nenhum') + '</code>). Use <code>--cpus 0.5</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 18.3 ============================== */
  LX.lesson('d18', {
    id: 'ld18-3', n: '18.3', title: 'Disco: o que ocupa e como limpar',
    goal: 'Descobrir o que o Docker acumulou no disco e recuperar espaço com segurança, sabendo o que cada prune apaga.',
    setup: (m) => {
      const e = m.docker;
      if (!e) return;
      /* deixa um servidor com lixo típico: containers parados e um rodando */
      if (!e.containerPorNome('ativo')) {
        LX.D.montar(m, { imagem: 'nginx:alpine', nome: 'ativo' });
      }
      for (const nome of ['antigo-1', 'antigo-2', 'antigo-3']) {
        if (!e.containerPorNome(nome)) {
          const r = e.criarContainer({ imagem: 'alpine:3.21', nome, cmd: ['echo', 'ok'] });
          if (r.ok) { e.iniciar(r.container); e.parar(r.container); }
        }
      }
    },
    body: [
      { h2: 'O Docker acumula, e ninguém percebe' },
      { p: 'Depois de alguns meses, um servidor com Docker costuma ter dezenas de gigabytes presos em coisas que ninguém usa: containers parados que nunca foram removidos, imagens de versões antigas, volumes órfãos, cache de build. O disco enche, e a causa não é óbvia.' },
      { p: 'O primeiro comando é o que mostra <strong>onde</strong> está o espaço:' },
      {
        code: [
          '$ docker system df',
          'TYPE            TOTAL   ACTIVE   SIZE     RECLAIMABLE',
          'Images          12      4        3.2GB    2.1GB (65%)',
          'Containers      18      3        1.1GB    980MB (89%)',
          'Local Volumes   9       2        4.4GB    2.0GB (45%)',
          'Build Cache     40      0        1.8GB    1.8GB (100%)'
        ], run: false
      },
      { p: 'A coluna <strong>RECLAIMABLE</strong> é a que importa: é o quanto você recupera limpando o que não está em uso. No exemplo, quase 8 GB estão presos em coisa morta.' },

      { h2: 'Os quatro tipos de lixo, e como limpar cada um' },
      {
        table: {
          head: ['Comando', 'Apaga', 'Cuidado'],
          rows: [
            ['<code>docker container prune</code>', 'containers <strong>parados</strong>', 'seguro: containers parados não têm estado que importe (os dados estão em volumes)'],
            ['<code>docker image prune</code>', 'imagens <strong>penduradas</strong> (<code>&lt;none&gt;</code>, órfãs de rebuild)', 'seguro'],
            ['<code>docker image prune -a</code>', 'toda imagem <strong>não usada</strong> por algum container', 'cuidado: apaga imagens que você teria que baixar de novo'],
            ['<code>docker volume prune</code>', 'volumes que <strong>nenhum</strong> container usa', '<strong>PERIGO: apaga dados</strong> — um volume órfão pode ser um banco que você esqueceu'],
            ['<code>docker system prune</code>', 'containers parados + redes não usadas + imagens penduradas + cache', 'não apaga volumes por padrão']
          ]
        }
      },
      {
        box: 'warn', label: 'O -a e o --volumes mudam tudo', body: [
          { p: '<code>docker system prune</code> sozinho é razoavelmente seguro. Mas <code>docker system prune -a --volumes</code> apaga <strong>toda</strong> imagem não usada no momento <em>e</em> todos os volumes órfãos. Num servidor onde um serviço está temporariamente parado, "não usado agora" inclui coisas que você quer manter. E <code>--volumes</code> é o caminho mais curto para apagar um banco de dados sem querer.' },
          { p: 'A regra: <code>prune</code> sem <code>-a</code> e sem <code>--volumes</code> no dia a dia; as versões agressivas só quando você sabe exatamente o que está no servidor.' }
        ]
      },

      { h2: 'Imagem menor é menos disco (e menos risco)' },
      { p: 'Metade do problema de disco nasce no tamanho das imagens. Uma imagem baseada em <code>ubuntu</code> cheia pode ter 1 GB; a mesma aplicação sobre <code>alpine</code> ou uma imagem <em>slim</em>, uma fração disso. Menos conteúdo é menos disco, download mais rápido e menos superfície para vulnerabilidade.' },
      {
        table: {
          head: ['Técnica', 'Efeito'],
          rows: [
            ['base <code>alpine</code> ou <code>-slim</code>', 'a maior economia, de longe'],
            ['multi-stage (visto no módulo de build)', 'a imagem final não carrega o compilador nem as ferramentas de build'],
            ['<code>.dockerignore</code>', 'o contexto de build não sobe lixo desnecessário'],
            ['juntar <code>RUN</code> e limpar cache no mesmo passo', 'evita que arquivos temporários fiquem presos numa camada']
          ]
        }
      },
      {
        box: 'key', label: 'A rotina saudável', body: [
          { p: 'Rodar <code>docker system df</code> de vez em quando e um <code>docker system prune</code> quando o número de RECLAIMABLE incomodar mantém o servidor limpo sem susto. É a diferença entre uma manutenção de dois minutos e um "disco cheio" às 3h da manhã.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td18-3-a', kind: 'guiado', title: 'Veja o que ocupa',
        body: [
          { p: 'Este servidor já tem alguns containers. Veja o que está usando espaço e o que dá para recuperar:' },
          {
            code: [
              '$ docker ps -a',
              '$ docker system df',
              '$ docker ps -a --filter status=exited'
            ]
          },
          { p: 'O <code>docker ps -a</code> mostra todos os containers, inclusive os parados. O <code>docker system df</code> resume o espaço por tipo, e a coluna RECLAIMABLE diz quanto está preso em coisa não usada.' }
        ],
        hints: ['O <code>--filter status=exited</code> mostra só os containers parados — os candidatos naturais a limpeza.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+system\s+df/), 'Rode <code>docker system df</code> para ver o espaço por tipo.'],
          [() => H.usedCommand(ctx, /docker\s+ps\s+-a/), 'Liste todos os containers, inclusive os parados, com <code>docker ps -a</code>.']
        ])
      },
      {
        id: 'td18-3-q', kind: 'quiz', title: 'O prune que apaga o banco',
        body: [
          { p: 'Você quer liberar espaço num servidor de produção que tem um serviço temporariamente parado para manutenção e vários bancos em volumes. Qual comando é seguro rodar agora?' }
        ],
        options: [
          { text: '<code>docker container prune</code> — remove só os containers parados, cujos dados já estão em volumes; não toca em imagens em uso nem em volume nenhum.', correct: true },
          { text: '<code>docker system prune -a --volumes</code> — libera o máximo de espaço de uma vez.', why: 'O <code>--volumes</code> apagaria os bancos, e o <code>-a</code> apagaria a imagem do serviço em manutenção (que conta como "não usada" enquanto ele está parado). É o comando mais perigoso da lista nesse cenário.' },
          { text: '<code>docker volume prune</code> — limpa os volumes que sobraram.', why: 'Um volume "órfão" pode ser justamente um banco cujo container está parado para manutenção. Volume prune em produção sem certeza absoluta apaga dados.' },
          { text: '<code>docker image prune -a</code> — remove imagens antigas.', why: 'O <code>-a</code> remove toda imagem não usada <em>agora</em> — inclusive a do serviço parado para manutenção, que você teria que baixar de novo.' }
        ],
        explain: 'Em produção, prefira o prune mais específico e conservador. <code>docker container prune</code> mexe só em containers parados (dados ficam nos volumes). As versões com <code>-a</code> e <code>--volumes</code> são poderosas e perigosas: "não usado agora" inclui serviços parados de propósito, e <code>--volumes</code> apaga dados de verdade.'
      },
      {
        id: 'td18-3-b', kind: 'desafio', title: 'Limpe os containers parados',
        body: [
          { p: 'Este servidor tem três containers parados (<code>antigo-1</code>, <code>antigo-2</code>, <code>antigo-3</code>) e um rodando (<code>ativo</code>). Recupere o espaço removendo <strong>todos os parados de uma vez</strong>, sem tocar no que está rodando.' },
          { p: 'Ao final: nenhum container parado deve restar, e o <code>ativo</code> precisa continuar de pé.' }
        ],
        hints: [
          'O comando que remove todos os containers parados de uma vez é <code>docker container prune</code>. O <code>-f</code> dispensa a confirmação.',
          'Ele não toca em containers rodando — o <code>ativo</code> fica intacto por definição. Confira com <code>docker ps -a</code>.'
        ],
        solution: '<pre>$ docker container prune -f\n$ docker ps -a</pre>',
        check: (ctx) => {
          const parados = D.containers(ctx, c => !c.rodando);
          const ativo = D.container(ctx, 'ativo');
          return H.checkAll([
            [() => !!ativo && ativo.rodando, 'O container <code>ativo</code> precisa continuar rodando — não o remova.'],
            [() => !D.container(ctx, 'antigo-1') && !D.container(ctx, 'antigo-2') && !D.container(ctx, 'antigo-3'),
              'Ainda há containers <code>antigo-*</code> parados. Remova todos de uma vez com <code>docker container prune -f</code>.'],
            [() => parados.length === 0, () => 'Ainda restam ' + parados.length + ' container(es) parado(s). O <code>docker container prune -f</code> remove todos os parados.']
          ]);
        }
      }
    ]
  });
})();
