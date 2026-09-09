/* =========================================================================
   MÓDULO D19 — Docker em servidor
   Levar a imagem para o servidor (save/load e registry), e atualizar uma
   stack em produção sem quebrar.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 19.1 ============================== */
  LX.lesson('d19', {
    id: 'ld19-1', n: '19.1', title: 'Levar a imagem para o servidor: save e load',
    goal: 'Transferir uma imagem para outra máquina sem registry, empacotando-a em um arquivo.',
    body: [
      { h2: 'A imagem precisa chegar ao servidor' },
      { p: 'Você construiu a imagem na sua máquina. O servidor de produção é outra máquina. Como a imagem chega lá? Há dois caminhos: um <strong>registry</strong> (um servidor de imagens, que a próxima aula cobre) ou, quando não há registry, um <strong>arquivo</strong> que você transfere na mão.' },
      { p: 'O par <code>docker save</code> / <code>docker load</code> empacota uma imagem inteira — todas as camadas e metadados — em um único arquivo <code>.tar</code>, que você copia para o servidor e recarrega lá.' },
      {
        code: [
          '# na sua máquina: empacota a imagem',
          'docker save minha-api:1.0 -o minha-api.tar',
          '',
          '# copia para o servidor (o scp que você viu no curso de Linux)',
          'scp minha-api.tar deploy@servidor:/tmp/',
          '',
          '# no servidor: recarrega a imagem',
          'docker load -i /tmp/minha-api.tar'
        ], run: false
      },
      {
        table: {
          head: ['Comando', 'Faz'],
          rows: [
            ['<code>docker save img -o arq.tar</code>', 'grava a imagem (todas as camadas) em um arquivo'],
            ['<code>docker load -i arq.tar</code>', 'recria a imagem a partir do arquivo'],
            ['<code>docker save img | gzip &gt; arq.tar.gz</code>', 'o mesmo, comprimido — imagens grandes encolhem bastante']
          ]
        }
      },
      {
        box: 'key', label: 'save × export: não confunda', body: [
          { p: '<code>docker save</code> empacota uma <strong>imagem</strong> com todas as camadas e o histórico — dá para rodar depois. <code>docker export</code> empacota o sistema de arquivos de um <strong>container</strong> num tar plano, sem camadas nem metadados de imagem. Para transportar algo que você vai <em>rodar</em>, é <code>save</code>/<code>load</code>.' }
        ]
      },
      {
        box: 'note', label: 'Quando save/load é o caminho certo', body: [
          { p: 'Registry é o padrão para deploy contínuo. Mas <code>save</code>/<code>load</code> brilha em dois casos: servidores <strong>sem acesso à internet</strong> (ambiente isolado, air-gapped), e quando você quer transferir <em>exatamente</em> aquela imagem, uma vez, sem montar infraestrutura. É a transferência mais simples que existe.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td19-1-a', kind: 'guiado', title: 'Empacote e recarregue',
        body: [
          { p: 'Veja o ciclo completo de transporte por arquivo, na mesma máquina:' },
          {
            code: [
              '$ docker pull nginx:alpine',
              '$ docker save nginx:alpine -o ~/nginx.tar',
              '$ ls -lh ~/nginx.tar',
              '$ docker rmi nginx:alpine',
              '$ docker load -i ~/nginx.tar',
              '$ docker images | grep nginx'
            ]
          },
          { p: 'O <code>save</code> gera o arquivo; o <code>rmi</code> apaga a imagem local para provar que o <code>load</code> a traz de volta inteira, com o mesmo ID.' }
        ],
        hints: ['O <code>docker save</code> pede a imagem e o arquivo de saída com <code>-o</code>; o <code>load</code> lê com <code>-i</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+save/), 'Empacote a imagem com <code>docker save nginx:alpine -o ~/nginx.tar</code>.'],
          [() => H.usedCommand(ctx, /docker\s+load/), 'Recarregue com <code>docker load -i ~/nginx.tar</code>.']
        ])
      },
      {
        id: 'td19-1-q', kind: 'quiz', title: 'save ou export?',
        body: [
          { p: 'Você quer transferir uma imagem para um servidor sem internet e <strong>rodá-la</strong> lá. Qual comando gera o arquivo certo, e por quê?' }
        ],
        options: [
          { text: '<code>docker save</code> — empacota a imagem com todas as camadas e metadados, então o <code>docker load</code> no servidor recria uma imagem executável.', correct: true },
          { text: '<code>docker export</code> — é o comando oficial para mover imagens.', why: '<code>docker export</code> empacota o sistema de arquivos de um <em>container</em> num tar plano, sem as camadas nem o histórico da imagem — não é o certo para transportar algo que você vai rodar.' },
          { text: '<code>docker cp</code> — copia a imagem para o servidor.', why: '<code>docker cp</code> copia arquivos entre o host e um container; não empacota imagens.' },
          { text: 'Nenhum: sem registry é impossível mover uma imagem.', why: 'É justamente para isso que existem <code>save</code>/<code>load</code>: mover imagens sem registry, inclusive em ambientes isolados.' }
        ],
        explain: 'Para transportar uma imagem que será executada, use <code>docker save</code> (imagem completa) + <code>docker load</code>. O <code>docker export</code>/<code>import</code> trabalha com o sistema de arquivos de um container e perde as camadas e a configuração da imagem — serve para outro propósito.'
      },
      {
        id: 'td19-1-b', kind: 'desafio', title: 'Transporte uma imagem por arquivo',
        body: [
          { p: 'Simule a transferência de uma imagem para um servidor isolado, na mesma máquina:' },
          { ol: [
            'garanta que a imagem <code>redis:7-alpine</code> está presente (faça <code>pull</code> se preciso);',
            'empacote-a no arquivo <code>~/redis.tar</code> com <code>docker save</code>;',
            'apague a imagem local com <code>docker rmi</code>, para provar que ela sumiu;',
            'recupere-a a partir do arquivo com <code>docker load</code>.'
          ] },
          { p: 'Ao final: o arquivo <code>~/redis.tar</code> precisa existir e a imagem <code>redis:7-alpine</code> precisa estar presente de novo (recarregada do arquivo).' }
        ],
        hints: [
          '<code>docker save redis:7-alpine -o ~/redis.tar</code> gera o arquivo; depois <code>docker rmi redis:7-alpine</code> apaga a imagem.',
          'Recupere com <code>docker load -i ~/redis.tar</code> e confira com <code>docker images | grep redis</code>.'
        ],
        solution: '<pre>$ docker pull redis:7-alpine\n$ docker save redis:7-alpine -o ~/redis.tar\n$ docker rmi redis:7-alpine\n$ docker load -i ~/redis.tar\n$ docker images | grep redis</pre>',
        check: (ctx) => {
          const m = ctx.machine || ctx.sh.m;
          let tar = null;
          try { tar = m.fs.stat('/home/aluno/redis.tar', { ctx: m.ctxRoot() }); } catch (e) { }
          return H.checkAll([
            [() => !!tar, 'Não encontrei <code>~/redis.tar</code>. Empacote a imagem com <code>docker save redis:7-alpine -o ~/redis.tar</code>.'],
            [() => (tar.size || 0) > 0, 'O arquivo <code>~/redis.tar</code> está vazio.'],
            [() => !!D.imagem(ctx, 'redis:7-alpine'), 'A imagem <code>redis:7-alpine</code> não está presente. Recupere-a com <code>docker load -i ~/redis.tar</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 19.2 ============================== */
  LX.lesson('d19', {
    id: 'ld19-2', n: '19.2', title: 'Um registry privado',
    goal: 'Subir um registry próprio, enviar uma imagem para ele e recuperá-la — o caminho padrão para distribuir imagens em uma equipe.',
    body: [
      { h2: 'O que é um registry' },
      { p: 'Um <strong>registry</strong> é um servidor de imagens. O Docker Hub é um registry público; sua empresa costuma ter um privado, onde ficam as imagens que não vão para o mundo. Subir um de teste é um container só:' },
      {
        code: [
          'docker run -d --name registry -p 5000:5000 --restart unless-stopped registry:2'
        ], run: false
      },
      { p: 'A partir daí, o endereço do seu registry é <code>localhost:5000</code> (ou o IP/nome do servidor onde ele roda). Enviar uma imagem para ele tem três passos:' },
      {
        code: [
          '# 1. dê à imagem um nome que aponte para o registry',
          'docker tag minha-api:1.0 localhost:5000/minha-api:1.0',
          '',
          '# 2. envie',
          'docker push localhost:5000/minha-api:1.0',
          '',
          '# 3. em outro servidor, baixe',
          'docker pull localhost:5000/minha-api:1.0'
        ], run: false
      },
      {
        box: 'key', label: 'O registro faz parte do nome da imagem', body: [
          { p: 'Repare: <code>localhost:5000/minha-api:1.0</code>. O prefixo antes da primeira barra é o <strong>endereço do registry</strong>. É isso que diz ao Docker para onde enviar (no push) e de onde buscar (no pull). Sem prefixo, o Docker assume o Docker Hub.' }
        ]
      },

      { h2: 'O ciclo completo, na prática' },
      {
        code: [
          '$ docker tag nginx:alpine localhost:5000/site:1.0',
          '$ docker push localhost:5000/site:1.0',
          '$ docker rmi localhost:5000/site:1.0',
          '$ docker pull localhost:5000/site:1.0'
        ], run: false
      },
      { p: 'Você marca a imagem com o endereço do registry, envia, apaga a cópia local para provar que sumiu, e baixa de volta. É exatamente o fluxo que uma equipe usa: um constrói e faz push, os servidores fazem pull.' },
      {
        box: 'warn', label: 'Registry de produção é mais que um container', body: [
          { p: 'O <code>registry:2</code> cru, como aqui, não tem autenticação nem HTTPS — serve para aprender e para uma rede interna confiável. Em produção você põe TLS (o mesmo assunto de HTTPS que viu no Traefik), autenticação, e um volume para os dados não sumirem quando o container reiniciar. Muitas equipes usam um registry gerenciado (GitHub Container Registry, GitLab, Harbor) em vez de manter o próprio.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td19-2-a', kind: 'guiado', title: 'Suba um registry e envie uma imagem',
        body: [
          { p: 'Coloque um registry no ar e mande uma imagem para ele:' },
          {
            code: [
              '$ docker run -d --name registry -p 5000:5000 registry:2',
              '$ docker pull nginx:alpine',
              '$ docker tag nginx:alpine localhost:5000/site:1.0',
              '$ docker push localhost:5000/site:1.0',
              '$ docker image ls | grep 5000'
            ]
          },
          { p: 'O <code>tag</code> cria o nome com o endereço do registry na frente; o <code>push</code> envia. A partir daí, qualquer máquina que alcance <code>localhost:5000</code> pode dar <code>pull</code> nessa imagem.' }
        ],
        hints: ['O nome precisa começar com o endereço do registry: <code>localhost:5000/site:1.0</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => D.rodando(ctx, 'registry'), 'Suba o registry com <code>docker run -d --name registry -p 5000:5000 registry:2</code>.'],
          [() => H.usedCommand(ctx, /docker\s+push\s+localhost:5000/), 'Envie a imagem com <code>docker push localhost:5000/site:1.0</code>.']
        ])
      },
      {
        id: 'td19-2-q', kind: 'quiz', title: 'O prefixo do nome',
        body: [
          { p: 'Você tem a imagem <code>minha-api:1.0</code> localmente e quer enviá-la ao registry em <code>localhost:5000</code>. Rodar <code>docker push minha-api:1.0</code> não funciona. Por quê?' }
        ],
        options: [
          { text: 'Sem o endereço do registry no nome, o Docker tenta enviar para o Docker Hub. É preciso primeiro <code>docker tag minha-api:1.0 localhost:5000/minha-api:1.0</code> e dar push nesse nome.', correct: true },
          { text: 'Falta fazer login no registry local.', why: 'O <code>registry:2</code> cru não exige login. O problema é o nome: sem o prefixo <code>localhost:5000/</code>, o push vai para o Hub.' },
          { text: 'O registry precisa estar na mesma rede do container da API.', why: 'O push é uma operação do cliente docker contra o registry publicado na porta; não depende de rede de container. O que falta é o endereço no nome da imagem.' },
          { text: 'Imagens com tag <code>1.0</code> não podem ser enviadas, só <code>latest</code>.', why: 'Qualquer tag pode ser enviada. A tag não tem relação com o destino; quem define o destino é o prefixo do registry no nome.' }
        ],
        explain: 'O endereço do registry é a primeira parte do nome da imagem. <code>docker push nome</code> envia para o registry embutido no <code>nome</code> — e sem prefixo, esse registry é o Docker Hub. Para o seu registry, marque a imagem com <code>docker tag origem localhost:5000/destino:tag</code> e dê push nesse nome completo.'
      },
      {
        id: 'td19-2-b', kind: 'desafio', title: 'Distribua pela sua estante de imagens',
        body: [
          { p: 'Monte o fluxo que uma equipe usa para distribuir uma imagem:' },
          { ol: [
            'suba um registry chamado <code>estante</code> a partir de <code>registry:2</code>, publicando a porta <strong>5000</strong>;',
            'garanta a imagem <code>nginx:alpine</code> localmente e marque-a como <code>localhost:5000/portal:2.0</code>;',
            'envie-a ao registry com <code>docker push</code>;',
            'apague a cópia local (<code>docker rmi localhost:5000/portal:2.0</code>) e recupere-a com <code>docker pull</code>.'
          ] },
          { p: 'Ao final: o registry <code>estante</code> precisa estar rodando e a imagem <code>localhost:5000/portal:2.0</code> precisa estar presente localmente (recuperada do registry).' }
        ],
        hints: [
          'O nome de destino carrega o endereço do registry: <code>localhost:5000/portal:2.0</code>. Marque com <code>docker tag nginx:alpine localhost:5000/portal:2.0</code>.',
          'Depois do <code>push</code>, <code>docker rmi localhost:5000/portal:2.0</code> prova que sumiu, e <code>docker pull localhost:5000/portal:2.0</code> traz de volta.'
        ],
        solution: '<pre>$ docker run -d --name estante -p 5000:5000 registry:2\n$ docker pull nginx:alpine\n$ docker tag nginx:alpine localhost:5000/portal:2.0\n$ docker push localhost:5000/portal:2.0\n$ docker rmi localhost:5000/portal:2.0\n$ docker pull localhost:5000/portal:2.0\n$ docker images | grep portal</pre>',
        check: (ctx) => {
          return H.checkAll([
            [() => D.rodando(ctx, 'estante'), 'O registry <code>estante</code> não está rodando. Suba-o com <code>docker run -d --name estante -p 5000:5000 registry:2</code>.'],
            [() => !!D.imagem(ctx, 'localhost:5000/portal:2.0'),
              'A imagem <code>localhost:5000/portal:2.0</code> não está presente. Marque, envie, apague e recupere com <code>docker pull</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 19.3 ============================== */
  LX.lesson('d19', {
    id: 'ld19-3', n: '19.3', title: 'Atualizar uma stack em produção',
    goal: 'Trocar a versão de um serviço em produção com método: com backup antes, verificação depois e um caminho de volta.',
    setup: (m) => {
      const e = m.docker;
      if (!e) return;
      LX.D.pasta(m, '/home/aluno/loja');
      LX.D.arquivo(m, '/home/aluno/loja/compose.yaml',
        'services:\n' +
        '  web:\n' +
        '    image: nginx:1.27-alpine\n' +
        '    restart: unless-stopped\n' +
        '    ports:\n' +
        '      - "8300:80"\n');
      /* a versão "antiga" e a "nova" existem no registro (aqui, o hub simulado) */
      e.puxar('nginx:1.27-alpine');
      e.puxar('nginx:1.28-alpine');
    },
    body: [
      { h2: 'Atualizar não é derrubar e rezar' },
      { p: 'Uma versão nova da imagem saiu, e você precisa colocá-la no servidor. O jeito errado é editar o arquivo, rodar um <code>down</code> e um <code>up</code>, e torcer. O jeito certo é um procedimento com rede de segurança: você sabe o que vai mudar, tem como voltar, e confirma que funcionou.' },
      {
        box: 'key', label: 'O ciclo de atualização', body: [
          { ol: [
            '<strong>Backup do que tem estado</strong> — o banco, os volumes. Antes de qualquer coisa.',
            '<strong>Baixe a imagem nova</strong> (<code>docker compose pull</code>) — separado do <code>up</code>, para o download não atrasar a troca.',
            '<strong>Anote a versão atual</strong> — é o seu caminho de volta se der errado.',
            '<strong>Troque e recrie</strong> (<code>docker compose up -d</code>) — o Compose recria só o que mudou.',
            '<strong>Verifique</strong> — o serviço responde? O healthcheck ficou <code>healthy</code>? O log está limpo?',
            '<strong>Se quebrou, volte</strong> — a versão anterior, que você anotou, com um novo <code>up -d</code>.'
          ] }
        ]
      },

      { h2: 'A troca em si' },
      { p: 'Com Compose, a atualização é editar a tag da imagem e recriar. O Compose compara o desejado com o real e recria <strong>apenas</strong> o serviço cuja imagem mudou — os outros nem piscam.' },
      {
        code: [
          '# antes: image: nginx:1.27-alpine',
          '# depois de editar para 1.28-alpine:',
          '$ docker compose pull          # baixa a nova',
          '$ docker compose up -d          # recria só o web',
          '$ docker compose ps             # confere o estado',
          '$ curl -sI http://localhost:8300/   # confere que responde'
        ], run: false
      },
      {
        box: 'note', label: 'Por que pull separado do up', body: [
          { p: 'Se você deixa o <code>up -d</code> baixar a imagem, o serviço fica no ar com a versão antiga durante todo o download, e só troca no fim. Fazendo <code>pull</code> antes, a imagem já está no disco quando o <code>up</code> roda — a troca é quase instantânea, e a janela de risco encolhe.' }
        ]
      },

      { h2: 'O caminho de volta' },
      { p: 'Toda atualização precisa de um <em>rollback</em>: se a versão nova quebrou, você volta para a anterior. Por isso você anotou a versão atual <strong>antes</strong> de trocar. Voltar é o mesmo procedimento, na direção contrária:' },
      {
        code: [
          '# a 1.28 quebrou? volte a tag para 1.27 e recrie',
          '$ docker compose up -d'
        ], run: false
      },
      {
        box: 'warn', label: 'Tag fixa é o que torna o rollback possível', body: [
          { p: 'Se a sua stack usa <code>nginx:latest</code>, você não tem para onde voltar — não existe "a versão anterior de latest". É por isso que produção usa tags de versão explícitas (<code>1.27-alpine</code>, <code>1.28-alpine</code>): elas são os pontos de restauração. O rollback só existe se cada versão tem um nome estável.' }
        ]
      },
      {
        box: 'key', label: 'E o banco?', body: [
          { p: 'Atualizar a imagem de uma <em>aplicação</em> é reversível: troca a tag, recria. Atualizar a imagem de um <em>banco</em> pode migrar o formato dos dados no disco, e aí o rollback não é só trocar a tag de volta — os dados já mudaram. Por isso o passo 1 é backup: com o dump na mão, você reconstrói o banco na versão antiga se precisar. O módulo seguinte é todo sobre isso.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td19-3-a', kind: 'guiado', title: 'Veja a stack antes de mexer',
        body: [
          { p: 'Antes de atualizar qualquer coisa, levante o estado atual da stack em <code>~/loja</code>:' },
          {
            code: [
              '$ cd ~/loja',
              '$ docker compose up -d',
              '$ docker compose ps',
              '$ docker compose config | grep image',
              '$ curl -sI http://localhost:8300/'
            ]
          },
          { p: 'Repare na versão da imagem que está rodando (<code>nginx:1.27-alpine</code>). É essa versão que você anota como caminho de volta antes de trocar por uma nova.' }
        ],
        hints: ['O <code>docker compose config | grep image</code> mostra a imagem que a stack usa hoje.'],
        check: async (ctx) => LX.H.checkAll([
          [() => D.rodando(ctx, D.doProjeto(ctx, 'loja', 'web') ? D.doProjeto(ctx, 'loja', 'web').nome : ''),
            'Suba a stack com <code>docker compose up -d</code> dentro de <code>~/loja</code>.'],
          [() => H.usedCommand(ctx, /docker\s+compose\s+(ps|config)/), 'Veja o estado com <code>docker compose ps</code> e a imagem com <code>docker compose config</code>.']
        ])
      },
      {
        id: 'td19-3-q', kind: 'quiz', title: 'Por que anotar a versão antiga',
        body: [
          { p: 'No ciclo de atualização, um dos passos é anotar a versão atual da imagem <strong>antes</strong> de trocar. Qual é a função desse passo?' }
        ],
        options: [
          { text: 'É o caminho de volta: se a versão nova quebrar, você troca a tag de volta para a anotada e recria — o rollback. Só funciona se as versões têm tags fixas.', correct: true },
          { text: 'É só documentação; não muda nada na prática.', why: 'Não é decorativo: é a informação que torna o rollback possível. Sem saber qual era a versão boa, você não tem para onde voltar depressa.' },
          { text: 'O Docker precisa da versão antiga registrada para conseguir baixar a nova.', why: 'O pull da nova não depende de conhecer a antiga. A anotação serve para você, não para o Docker.' },
          { text: 'Serve para o <code>docker compose down</code> saber o que remover.', why: 'O <code>down</code> remove os containers da stack independentemente de versões anotadas. A anotação é sobre poder voltar, não sobre derrubar.' }
        ],
        explain: 'Toda atualização precisa de um rollback planejado. Anotar a versão atual antes de trocar é o que permite voltar rápido se a nova quebrar: reeditar a tag para a anterior e <code>up -d</code>. E isso só existe com tags de versão fixas — com <code>latest</code>, não há "versão anterior" para onde voltar.'
      },
      {
        id: 'td19-3-b', kind: 'desafio', title: 'Atualize a imagem do serviço',
        body: [
          { p: 'A stack em <code>~/loja</code> roda o <code>web</code> na imagem <code>nginx:1.27-alpine</code>. Atualize-a para <code>nginx:1.28-alpine</code> pelo procedimento correto: baixe a nova imagem, edite o arquivo e recrie o serviço.' },
          { p: 'Ao final: o serviço <code>web</code> precisa estar rodando na imagem <strong>1.28</strong>, ainda publicando a porta 8300 e respondendo.' }
        ],
        hints: [
          'Edite o <code>~/loja/compose.yaml</code> trocando <code>nginx:1.27-alpine</code> por <code>nginx:1.28-alpine</code>.',
          'Depois, na pasta: <code>docker compose pull</code> e <code>docker compose up -d</code>. O Compose recria o <code>web</code> com a imagem nova.'
        ],
        solution: '<pre>$ cd ~/loja\n$ docker compose up -d\n$ sed -i "s/nginx:1.27-alpine/nginx:1.28-alpine/" compose.yaml\n$ docker compose pull\n$ docker compose up -d\n$ docker compose ps\n$ curl -sI http://localhost:8300/</pre>',
        check: (ctx) => {
          const doc = D.compose(ctx, '/home/aluno/loja/compose.yaml');
          const web = D.doProjeto(ctx, 'loja', 'web');
          const r = D.http(ctx, 'localhost', 8300, '/');
          return H.checkAll([
            [() => doc !== null, 'Não encontrei <code>~/loja/compose.yaml</code>.'],
            [() => !(doc && doc.erroYaml), () => 'O YAML não é válido: <code>' + (doc.erroYaml || '') + '</code>'],
            [() => doc.services && doc.services.web && /1\.28-alpine/.test(String(doc.services.web.image)),
              'O <code>compose.yaml</code> ainda não aponta para <code>nginx:1.28-alpine</code>.'],
            [() => !!web && web.rodando, 'O serviço <code>web</code> não está rodando.'],
            [() => !!web && /1\.28-alpine/.test(web.imagemRef || ''),
              () => 'O container do <code>web</code> ainda roda <code>' + (web ? web.imagemRef : '?') + '</code>. Rode <code>docker compose up -d</code> para recriá-lo com a imagem nova.'],
            [() => D.publicada(ctx, web.nome, 8300), 'O <code>web</code> precisa continuar publicando a porta 8300.'],
            [() => !!r && r.status === 200, 'A porta 8300 não respondeu com sucesso.']
          ]);
        }
      }
    ]
  });
})();
