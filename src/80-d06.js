/* =========================================================================
   MÓDULO D06 — Dockerfile
   Instrução por instrução, com as confusões clássicas separadas:
   CMD x ENTRYPOINT, COPY x ADD, ARG x ENV, EXPOSE x publicação.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 6.1 ============================== */
  LX.lesson('d06', {
    id: 'ld6-1', n: '6.1', title: 'O primeiro Dockerfile',
    goal: 'Escrever, construir e rodar uma imagem própria, entendendo o papel de cada instrução.',
    body: [
      { h2: 'O que é um Dockerfile' },
      { p: 'É uma receita em texto. Cada linha é uma instrução, executada de cima para baixo, e a maioria delas produz uma camada. O resultado é uma imagem.' },
      { code: ['# syntax=docker/dockerfile:1',
        'FROM alpine:3.21',
        'RUN apk add --no-cache curl',
        'WORKDIR /app',
        'COPY mensagem.txt .',
        'CMD ["cat", "/app/mensagem.txt"]'], run: false, lang: 'dockerfile' },
      {
        table: {
          head: ['Instrução', 'O que faz'],
          rows: [
            ['<code># syntax=</code>', 'diretiva opcional na primeira linha; faz o BuildKit usar a sintaxe mais recente, sem depender da versão do Docker instalado'],
            ['<code>FROM</code>', 'a imagem base. <strong>Obrigatória</strong>, e precisa ser a primeira instrução de verdade'],
            ['<code>RUN</code>', 'executa um comando <em>durante o build</em> e grava o resultado em uma camada'],
            ['<code>WORKDIR</code>', 'define o diretório de trabalho das instruções seguintes e do container'],
            ['<code>COPY</code>', 'copia arquivos do contexto de build para dentro da imagem'],
            ['<code>CMD</code>', 'o comando padrão de quem rodar essa imagem — executa no <em>run</em>, não no build']
          ]
        }
      },
      {
        box: 'key', label: 'RUN acontece no build, CMD acontece no run', body: [
          { p: 'É a distinção que organiza o arquivo inteiro. <code>RUN</code> monta a imagem: instala pacotes, compila, cria diretórios — e o resultado fica gravado. <code>CMD</code> não executa nada durante o build; ele apenas registra na imagem qual comando rodar quando alguém der <code>docker run</code>.' },
          { p: 'Um Dockerfile com dez <code>RUN</code> produz dez camadas no build. Um Dockerfile com dez <code>CMD</code> tem nove instruções inúteis: só o último vale.' }
        ]
      },

      { h2: 'Construindo' },
      { code: ['$ mkdir -p ~/primeira && cd ~/primeira',
        '$ echo "ola do meu container" > mensagem.txt',
        '$ docker build -t primeira:1.0 .',
        '$ docker run --rm primeira:1.0'] },
      { p: 'O ponto final é o <strong>contexto de build</strong> — o diretório cujos arquivos ficam disponíveis para o <code>COPY</code>. Não é "onde está o Dockerfile": é "de onde o build pode copiar". A próxima aula trata disso.' },

      { h2: 'FROM' },
      { code: ['FROM alpine:3.21', 'FROM node:22-alpine', 'FROM scratch'], run: false, lang: 'dockerfile' },
      {
        ul: [
          'Sempre com tag explícita. <code>FROM node</code> pega o <code>latest</code>, que muda sem aviso.',
          '<code>scratch</code> é a imagem vazia: nenhum arquivo, nenhum shell. Serve para binários estáticos.',
          'Um Dockerfile pode ter vários <code>FROM</code> — é o <em>multi-stage build</em>, no próximo módulo.'
        ]
      },

      { h2: 'RUN: as duas formas' },
      { code: ['RUN apk add --no-cache curl',
        'RUN ["apk", "add", "--no-cache", "curl"]'], run: false, lang: 'dockerfile' },
      { p: 'A primeira é <em>shell form</em>: roda dentro de <code>/bin/sh -c</code>, então aceita <code>&amp;&amp;</code>, pipes, variáveis e redirecionamentos. A segunda é <em>exec form</em>: executa o binário direto, sem shell — e por isso <strong>não</strong> interpreta <code>$VAR</code> nem <code>|</code>.' },
      { p: 'Para <code>RUN</code>, a shell form é o normal. Encadear com <code>&amp;&amp;</code> mantém tudo em uma camada só:' },
      { code: ['RUN apt-get update \\',
        ' && apt-get install -y --no-install-recommends curl ca-certificates \\',
        ' && rm -rf /var/lib/apt/lists/*'], run: false, lang: 'dockerfile' },
      { p: 'A limpeza do cache do apt precisa estar <strong>nesse mesmo</strong> <code>RUN</code>. Em um <code>RUN</code> separado, os arquivos já teriam ido para a camada anterior e a imagem não emagreceria.' },
      { p: 'Com a diretiva <code>syntax</code>, dá para usar <em>heredoc</em> e ficar bem mais legível:' },
      { code: ['RUN <<FIM',
        'apk add --no-cache curl',
        'adduser -D -u 1000 app',
        'mkdir -p /app/dados',
        'FIM'], run: false, lang: 'dockerfile' },

      { h2: 'WORKDIR' },
      { code: ['WORKDIR /app'], run: false, lang: 'dockerfile' },
      { p: 'Vale para todas as instruções seguintes e para o container em execução. Cria o diretório se ele não existir. Aceita caminhos relativos, que se acumulam.' },
      {
        box: 'warn', label: 'Não use RUN cd', body: [
          { p: 'Cada <code>RUN</code> é um processo novo: o <code>cd</code> de um não vale no seguinte.' },
          { code: ['# não funciona', 'RUN cd /app', 'RUN npm install     # roda em /, não em /app', '',
            '# funciona', 'WORKDIR /app', 'RUN npm install'], run: false, lang: 'dockerfile' }
        ]
      },

      { h2: 'COPY' },
      { code: ['COPY package.json .', 'COPY src/ /app/src/', 'COPY --chown=app:app . /app', 'COPY --from=build /out/app /usr/local/bin/app'], run: false, lang: 'dockerfile' },
      {
        ul: [
          'A origem é sempre <strong>relativa ao contexto de build</strong>, e não pode sair dele: <code>COPY ../coisa</code> é erro.',
          'Destino terminando em <code>/</code> é diretório; sem barra, é o nome do arquivo.',
          '<code>--chown</code> define o dono, útil quando a imagem roda como usuário sem privilégio.',
          '<code>--from</code> copia de outro estágio ou de outra imagem.'
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>FROM</code> primeiro, sempre com tag explícita.',
          '<code>RUN</code> executa no build; <code>CMD</code> só registra o comando do run.',
          'Encadeie com <code>&amp;&amp;</code> o que precisa ficar na mesma camada.',
          '<code>WORKDIR</code>, não <code>RUN cd</code>.',
          '<code>COPY</code> lê do contexto de build e não sai dele.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td6-1-a', kind: 'guiado', title: 'Escrever, construir e rodar um Dockerfile',
        body: [
          { p: 'Repita a receita da aula: escreva o Dockerfile, construa a imagem e rode.' },
          {
            code: [
              '$ mkdir -p ~/ola && cd ~/ola',
              '$ echo "ola do meu container" > mensagem.txt',
              '$ cat > Dockerfile <<\'FIM\'',
              'FROM alpine:3.21',
              'WORKDIR /app',
              'COPY mensagem.txt .',
              'CMD ["cat", "/app/mensagem.txt"]',
              'FIM',
              '$ docker build -t ola:1.0 .',
              '$ docker run --rm ola:1.0'
            ]
          },
          { p: 'A saída do <code>run</code> mostra o conteúdo do <code>mensagem.txt</code>: prova de que o <code>COPY</code> levou o arquivo para dentro da imagem e o <code>CMD</code> definiu o que ela executa.' }
        ],
        hints: ['Rode os comandos na ordem, dentro do diretório <code>~/ola</code>.'],
        check: async (ctx) => {
          const img = D.imagem(ctx, 'ola:1.0');
          const df = D.dockerfile(ctx, '/home/aluno/ola/Dockerfile');
          let saida = null;
          if (img) {
            const e = D.eng(ctx);
            const r = e.criarContainer({ imagem: 'ola:1.0', nome: 'v-' + LX.dockerHex(6) });
            if (r.ok) {
              e.iniciar(r.container);
              const pedacos = [];
              await e.rodarPrincipal(r.container, {
                stdin: new LX.InStream(''),
                stdout: new LX.Stream({ onWrite: (x) => pedacos.push(x) }),
                stderr: new LX.Stream({ onWrite: (x) => pedacos.push(x) }),
                term: { readLine: async () => '' }
              });
              saida = pedacos.join('');
              e.remover(r.container, { force: true, silencioso: true });
            }
          }
          return H.checkAll([
            [() => H.usedCommand(ctx, /docker\s+build\s+-t\s+ola:1\.0/), 'Construa a imagem com <code>docker build -t ola:1.0 .</code>.'],
            [() => !!img, 'A imagem <code>ola:1.0</code> ainda não existe.'],
            [() => df !== null && !df.erro, 'Escreva o <code>~/ola/Dockerfile</code> partindo de <code>alpine:3.21</code>.'],
            [() => df && df.instrucoes.some(i => i.nome === 'CMD'), 'Falta o <code>CMD</code> no Dockerfile.'],
            [() => H.usedCommand(ctx, /docker\s+run\s+--rm\s+ola:1\.0/), 'Rode a imagem com <code>docker run --rm ola:1.0</code>.'],
            [() => saida !== null && /ola do meu container/.test(saida),
              () => `Rodar a imagem deveria mostrar o conteúdo de <code>mensagem.txt</code>, mas mostrou: ${JSON.stringify(String(saida).slice(0, 60))}`]
          ]);
        }
      },
      {
        id: 'td6-1-q', kind: 'quiz', title: 'Por que só a última mensagem aparece',
        body: [
          { p: 'Um colega escreve este Dockerfile e não entende por que rodar a imagem imprime só uma linha:' },
          { code: ['FROM alpine:3.21', 'CMD ["echo", "preparando"]', 'CMD ["echo", "pronto"]'], run: false, lang: 'dockerfile' },
          { p: 'A saída é só <code>pronto</code>. Por quê?' }
        ],
        options: [
          { text: '<code>CMD</code> só registra na imagem qual comando o <code>run</code> vai executar; um segundo <code>CMD</code> substitui o primeiro, e nenhum dos dois roda durante o build.', correct: true },
          { text: 'O Dockerfile tem um erro de sintaxe e o build deveria ter falhado.', why: 'Vários <code>CMD</code> são aceitos sem erro — é desperdício, não erro de sintaxe. Só o último vale.' },
          { text: '<code>CMD</code> executa no build, então o primeiro já rodou e imprimiu antes do segundo apagar a tela.', why: 'É o contrário: <code>CMD</code> não roda durante o build. Quem executa no build é o <code>RUN</code>.' },
          { text: 'Falta encadear os dois <code>CMD</code> com <code>&amp;&amp;</code>.', why: '<code>&amp;&amp;</code> encadeia comandos dentro de uma única instrução; não é assim que se combinam duas instruções <code>CMD</code> — e nunca é preciso, porque só uma pode valer.' }
        ],
        explain: '<code>CMD</code> é só um registro na imagem, não uma execução. Cada novo <code>CMD</code> sobrescreve o anterior, e vale apenas o último. Confirme com <code>docker inspect app:1.0 --format "{{json .Config.Cmd}}"</code>: sempre um único comando ali.'
      },
      {
        id: 'td6-1-b', kind: 'desafio', title: 'Sua primeira imagem',
        body: [
          { p: 'Construa uma imagem própria, do zero.' },
          { ol: [
            'Crie o diretório <code>~/primeira</code>.',
            'Dentro dele, crie <code>mensagem.txt</code> com um texto qualquer que contenha a palavra <code>Terminalis</code>.',
            'Escreva um <code>Dockerfile</code> que parta de <code>alpine:3.21</code>, defina <code>/app</code> como diretório de trabalho, copie o <code>mensagem.txt</code> para lá e tenha como comando padrão a exibição desse arquivo.',
            'Construa com a tag <code>primeira:1.0</code>.',
            'Rode e confirme que a mensagem aparece.'
          ] }
        ],
        hints: [
          'São quatro instruções: <code>FROM</code>, <code>WORKDIR</code>, <code>COPY</code> e <code>CMD</code>.',
          'Para o <code>CMD</code>, prefira a forma de lista: <code>CMD ["cat", "/app/mensagem.txt"]</code>.',
          'O build roda de dentro do diretório: <code>cd ~/primeira && docker build -t primeira:1.0 .</code> — o ponto final é o contexto.'
        ],
        solution: '<pre>$ mkdir -p ~/primeira\n$ cd ~/primeira\n$ echo "ola do Terminalis" &gt; mensagem.txt\n$ cat &gt; Dockerfile &lt;&lt;\'FIM\'\nFROM alpine:3.21\nWORKDIR /app\nCOPY mensagem.txt .\nCMD ["cat", "/app/mensagem.txt"]\nFIM\n$ docker build -t primeira:1.0 .\n$ docker run --rm primeira:1.0</pre>',
        check: async (ctx) => {
          const img = D.imagem(ctx, 'primeira:1.0');
          const df = D.dockerfile(ctx, '/home/aluno/primeira/Dockerfile');
          const msg = H.read(ctx, '/home/aluno/primeira/mensagem.txt');
          let saida = null;
          if (img) {
            const e = D.eng(ctx);
            const r = e.criarContainer({ imagem: 'primeira:1.0', nome: 'v-' + LX.dockerHex(6) });
            if (r.ok) {
              e.iniciar(r.container);
              const pedacos = [];
              await e.rodarPrincipal(r.container, {
                stdin: new LX.InStream(''),
                stdout: new LX.Stream({ onWrite: (x) => pedacos.push(x) }),
                stderr: new LX.Stream({ onWrite: (x) => pedacos.push(x) }),
                term: { readLine: async () => '' }
              });
              saida = pedacos.join('');
              e.remover(r.container, { force: true, silencioso: true });
            }
          }
          return H.checkAll([
            [() => msg !== null, 'Crie o arquivo <code>~/primeira/mensagem.txt</code>.'],
            [() => /Terminalis/.test(msg || ''), 'O <code>mensagem.txt</code> precisa conter a palavra <code>Terminalis</code>.'],
            [() => df !== null, 'Crie o <code>~/primeira/Dockerfile</code>.'],
            [() => !df.erro, () => 'O Dockerfile tem um erro de sintaxe: ' + df.erro],
            [() => df.instrucoes.some(i => i.nome === 'FROM' && /alpine/.test(i.arg)), 'O Dockerfile precisa partir de <code>alpine:3.21</code>.'],
            [() => df.instrucoes.some(i => i.nome === 'WORKDIR'), 'Falta o <code>WORKDIR /app</code>.'],
            [() => df.instrucoes.some(i => i.nome === 'COPY'), 'Falta o <code>COPY</code> do arquivo para dentro da imagem.'],
            [() => df.instrucoes.some(i => i.nome === 'CMD'), 'Falta o <code>CMD</code> com o comando padrão.'],
            [() => !!img, 'A imagem <code>primeira:1.0</code> ainda não existe. Construa com <code>docker build -t primeira:1.0 .</code>.'],
            [() => saida !== null && /Terminalis/.test(saida),
              'A imagem existe, mas rodá-la não mostra a mensagem. Confira o caminho no <code>CMD</code> — com <code>WORKDIR /app</code> e <code>COPY mensagem.txt .</code>, o arquivo fica em <code>/app/mensagem.txt</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 6.2 ============================== */
  LX.lesson('d06', {
    id: 'ld6-2', n: '6.2', title: 'CMD e ENTRYPOINT',
    goal: 'Dominar a confusão mais persistente do Dockerfile: as duas instruções que definem o que o container executa.',
    body: [
      { h2: 'As duas juntas formam a linha de comando' },
      { p: 'O que o container executa é <code>ENTRYPOINT</code> seguido de <code>CMD</code>. O <code>ENTRYPOINT</code> é o executável; o <code>CMD</code> são os argumentos padrão.' },
      { code: ['ENTRYPOINT ["ping"]', 'CMD ["localhost"]'], run: false, lang: 'dockerfile' },
      {
        ascii: `docker run minha-imagem
   → ping localhost

docker run minha-imagem 8.8.8.8
   → ping 8.8.8.8          (o argumento substituiu o CMD)`
      },
      { p: 'A regra é: <strong>o que você escreve depois da imagem substitui o <code>CMD</code>, nunca o <code>ENTRYPOINT</code></strong>. Para trocar o entrypoint é preciso a flag <code>--entrypoint</code>.' },

      { h2: 'Exec form e shell form' },
      {
        table: {
          head: ['Forma', 'Escrita', 'O que o kernel executa'],
          rows: [
            ['exec form', '<code>CMD ["nginx", "-g", "daemon off;"]</code>', '<code>nginx -g "daemon off;"</code> direto, como PID 1'],
            ['shell form', '<code>CMD nginx -g "daemon off;"</code>', '<code>/bin/sh -c "nginx -g \'daemon off;\'"</code>']
          ]
        }
      },
      {
        box: 'key', label: 'Por que a exec form importa de verdade', body: [
          { p: 'Na shell form, o PID 1 é o <code>/bin/sh</code>, e a sua aplicação é um filho dele. Quando você roda <code>docker stop</code>, o <code>SIGTERM</code> vai para o PID 1 — ou seja, para o shell, que <strong>não repassa o sinal</strong>.' },
          { p: 'Resultado: a aplicação não é avisada, não fecha nada, e depois de 10 segundos leva um <code>SIGKILL</code>. Em um banco de dados, isso é corrupção. Em uma API, são requisições cortadas no meio.' },
          { p: 'Com a exec form, a aplicação <em>é</em> o PID 1 e recebe o sinal diretamente. Use exec form, sempre. Se precisar de recursos de shell, escreva um script de entrypoint que termine em <code>exec "$@"</code> — o <code>exec</code> substitui o shell pela aplicação, preservando o PID 1.' }
        ]
      },

      { h2: 'A tabela de combinação' },
      { p: 'Este é o comportamento oficial, e a coluna do meio é a armadilha:' },
      {
        table: {
          head: ['', 'Sem ENTRYPOINT', 'ENTRYPOINT shell form', 'ENTRYPOINT exec form'],
          rows: [
            ['<strong>Sem CMD</strong>', 'erro: nada para executar', '<code>/bin/sh -c entry</code>', '<code>entry</code>'],
            ['<strong>CMD exec form</strong>', '<code>cmd</code>', '<code>/bin/sh -c entry</code>', '<code>entry cmd</code>'],
            ['<strong>CMD shell form</strong>', '<code>/bin/sh -c cmd</code>', '<code>/bin/sh -c entry</code>', '<code>entry /bin/sh -c cmd</code>']
          ]
        }
      },
      {
        box: 'warn', label: 'ENTRYPOINT em shell form ignora tudo', body: [
          { p: 'Repare na coluna do meio: qualquer que seja o <code>CMD</code>, o resultado é o mesmo. Um <code>ENTRYPOINT</code> escrito em shell form <strong>descarta o <code>CMD</code> e descarta os argumentos da linha de comando</strong>.' },
          { p: 'É por isso que às vezes você passa um argumento no <code>docker run</code> e ele simplesmente não faz efeito. A causa é essa, e a correção é escrever o <code>ENTRYPOINT</code> em exec form.' }
        ]
      },

      { h2: 'Quando usar cada um' },
      {
        table: {
          head: ['Objetivo', 'Como escrever'],
          rows: [
            ['Imagem de serviço (nginx, banco, API)', 'só <code>CMD</code> em exec form, ou <code>ENTRYPOINT</code> de script + <code>CMD</code> com os argumentos'],
            ['Imagem que <em>é</em> um comando (ferramenta de linha)', '<code>ENTRYPOINT ["ferramenta"]</code> e <code>CMD ["--help"]</code>'],
            ['Precisa de preparação antes de subir', '<code>ENTRYPOINT ["/entrypoint.sh"]</code>, e o script termina em <code>exec "$@"</code>']
          ]
        }
      },
      { p: 'O padrão do entrypoint script é o que as imagens oficiais usam:' },
      { code: ['#!/bin/sh', 'set -e', '', '# preparação: espera dependência, gera config, ajusta permissão',
        'if [ ! -f /app/config.json ]; then', '  echo "gerando configuração padrão"', '  cp /app/config.exemplo.json /app/config.json', 'fi', '',
        '# entrega o controle ao comando, preservando o PID 1', 'exec "$@"'], run: false, lang: 'bash' },
      { p: 'Sem o <code>exec</code>, o script continuaria sendo o PID 1 e o problema dos sinais voltaria.' },

      { h2: 'Investigar' },
      { code: ['$ docker inspect nginx:alpine --format "ENTRYPOINT={{json .Config.Entrypoint}}"',
        '$ docker inspect nginx:alpine --format "CMD={{json .Config.Cmd}}"',
        '$ docker inspect mariadb:11.4 --format "{{json .Config.Entrypoint}} {{json .Config.Cmd}}"'] },
      { p: 'Antes de discutir por que um container não faz o que você esperava, olhe o que ele executa.' },

      { h2: 'Resumo' },
      {
        ul: [
          'O container executa <code>ENTRYPOINT</code> + <code>CMD</code>.',
          'Argumento do <code>docker run</code> substitui o <code>CMD</code>; para trocar o entrypoint existe <code>--entrypoint</code>.',
          'Exec form (lista JSON) faz a aplicação ser o PID 1 e receber os sinais.',
          '<code>ENTRYPOINT</code> em shell form ignora o <code>CMD</code> e os argumentos.',
          'Script de entrypoint termina em <code>exec "$@"</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td6-2-a', kind: 'guiado', title: 'Ver o que o Docker gravou: exec form x shell form',
        body: [
          { p: 'Construa duas imagens com o mesmo <code>CMD</code>, uma em cada forma, e compare o que ficou gravado.' },
          {
            code: [
              '$ mkdir -p ~/forma-shell && cd ~/forma-shell',
              '$ cat > Dockerfile <<\'FIM\'',
              'FROM alpine:3.21',
              'CMD echo ola',
              'FIM',
              '$ docker build -t forma-shell:1.0 .',
              '$ cd .. && mkdir -p ~/forma-exec && cd ~/forma-exec',
              '$ cat > Dockerfile <<\'FIM\'',
              'FROM alpine:3.21',
              'CMD ["echo", "ola"]',
              'FIM',
              '$ docker build -t forma-exec:1.0 .',
              '$ docker inspect forma-shell:1.0 --format "{{json .Config.Cmd}}"',
              '$ docker inspect forma-exec:1.0 --format "{{json .Config.Cmd}}"'
            ]
          },
          { p: 'A primeira mostra <code>["/bin/sh","-c","echo ola"]</code> — o Docker embrulhou o comando em um shell. A segunda mostra <code>["echo","ola"]</code> puro: é a exec form, sem PID 1 intermediário.' }
        ],
        hints: ['O que muda entre as duas imagens é só uma linha do Dockerfile: com colchetes ou sem.'],
        check: async (ctx) => {
          const shellImg = D.imagem(ctx, 'forma-shell:1.0');
          const execImg = D.imagem(ctx, 'forma-exec:1.0');
          return H.checkAll([
            [() => !!shellImg, 'Construa a imagem <code>forma-shell:1.0</code> com <code>CMD echo ola</code> (shell form, sem colchetes).'],
            [() => !!execImg, 'Construa a imagem <code>forma-exec:1.0</code> com <code>CMD ["echo", "ola"]</code> (exec form).'],
            [() => (shellImg.config.Cmd || [])[0] === '/bin/sh', 'A imagem <code>forma-shell:1.0</code> precisa ter o <code>CMD</code> em <strong>shell form</strong> — sem colchetes.'],
            [() => JSON.stringify(execImg.config.Cmd) === JSON.stringify(['echo', 'ola']),
              'A imagem <code>forma-exec:1.0</code> precisa ter o <code>CMD</code> em <strong>exec form</strong> — <code>CMD ["echo", "ola"]</code>.'],
            [() => H.usedCommand(ctx, /docker\s+inspect.*Cmd/), 'Compare as duas com <code>docker inspect ... --format "{{json .Config.Cmd}}"</code>.']
          ]);
        }
      },
      {
        id: 'td6-2-q', kind: 'quiz', title: 'O container que ignora docker stop',
        body: [
          { p: 'Uma API demora exatamente 10 segundos para parar em todo deploy, e nos logs nunca aparece a mensagem de encerramento que a aplicação deveria imprimir. O Dockerfile termina assim:' },
          { code: ['CMD node /app/server.js'], run: false, lang: 'dockerfile' },
          { p: 'Qual é a causa e a correção?' }
        ],
        options: [
          { text: 'A shell form faz o <code>/bin/sh</code> ser o PID 1; ele recebe o SIGTERM e não repassa ao node. Passados 10 segundos, vem o SIGKILL. A correção é <code>CMD ["node", "/app/server.js"]</code>.', correct: true },
          { text: 'O timeout padrão do <code>docker stop</code> é curto demais; aumente com <code>-t 60</code>.', why: 'Aumentar o tempo só faz esperar mais antes do SIGKILL. O sinal continua não chegando à aplicação.' },
          { text: 'Falta <code>--restart unless-stopped</code>.', why: 'Política de reinício não tem relação com o encerramento.' },
          { text: 'O node não trata SIGTERM.', why: 'Pode ser — mas o cenário diz que a aplicação <em>tem</em> uma mensagem de encerramento que nunca aparece, ou seja, ela trata o sinal e não o está recebendo.' }
        ],
        explain: 'Esses 10 segundos são a assinatura do problema: é exatamente o tempo de graça do <code>docker stop</code> antes do SIGKILL. Escrever <code>CMD</code> em exec form resolve. Quando a preparação exige shell mesmo, o caminho é um script de entrypoint terminando em <code>exec "$@"</code>. Verifique com <code>docker exec CONTAINER ps aux</code>: se o PID 1 for <code>/bin/sh -c ...</code>, o problema está aí.'
      },
      {
        id: 'td6-2-b', kind: 'desafio', title: 'Uma imagem que é um comando',
        body: [
          { p: 'Construa uma imagem chamada <code>saudacao:1.0</code> que se comporte assim:' },
          { code: ['$ docker run --rm saudacao:1.0', 'Ola, mundo', '',
            '$ docker run --rm saudacao:1.0 Terminalis', 'Ola, Terminalis'], run: false, lang: 'text' },
          { p: 'Ou seja: o programa é sempre o mesmo, e o argumento tem um valor padrão que pode ser substituído na linha de comando.' },
          { p: 'Trabalhe em <code>~/saudacao</code>.' }
        ],
        hints: [
          'Isso é exatamente o par <code>ENTRYPOINT</code> + <code>CMD</code>: o executável fixo em um, o argumento padrão no outro.',
          'Use <code>ENTRYPOINT ["echo", "Ola,"]</code> e <code>CMD ["mundo"]</code>. Ambos em exec form.',
          'Se você escrever o <code>ENTRYPOINT</code> em shell form, o argumento da linha de comando será ignorado — teste e veja.'
        ],
        solution: '<pre>$ mkdir -p ~/saudacao &amp;&amp; cd ~/saudacao\n$ cat &gt; Dockerfile &lt;&lt;\'FIM\'\nFROM alpine:3.21\nENTRYPOINT ["echo", "Ola,"]\nCMD ["mundo"]\nFIM\n$ docker build -t saudacao:1.0 .\n$ docker run --rm saudacao:1.0\n$ docker run --rm saudacao:1.0 Terminalis</pre>',
        check: async (ctx) => {
          const img = D.imagem(ctx, 'saudacao:1.0');
          const e = D.eng(ctx);
          const rodar = async (args) => {
            const r = e.criarContainer({ imagem: 'saudacao:1.0', nome: 'v-' + LX.dockerHex(6), cmd: args });
            if (!r.ok) return null;
            e.iniciar(r.container);
            const pedacos = [];
            await e.rodarPrincipal(r.container, {
              stdin: new LX.InStream(''),
              stdout: new LX.Stream({ onWrite: s => pedacos.push(s) }),
              stderr: new LX.Stream({ onWrite: s => pedacos.push(s) }),
              term: { readLine: async () => '' }
            });
            e.remover(r.container, { force: true, silencioso: true });
            return pedacos.join('');
          };
          const padrao = img ? await rodar([]) : null;
          const custom = img ? await rodar(['Terminalis']) : null;
          return H.checkAll([
            [() => !!img, 'A imagem <code>saudacao:1.0</code> ainda não existe.'],
            [() => (img.config.Entrypoint || []).length > 0,
              'A imagem não tem <code>ENTRYPOINT</code>. É ele que fixa o programa, independente do que vier na linha de comando.'],
            [() => (img.config.Cmd || []).length > 0,
              'A imagem não tem <code>CMD</code>. É ele que dá o argumento padrão.'],
            [() => padrao !== null && /Ola,\s*mundo/i.test(padrao),
              () => `Rodar sem argumento deveria imprimir "Ola, mundo", mas imprimiu: ${JSON.stringify(String(padrao).slice(0, 80))}`],
            [() => custom !== null && /Ola,\s*Terminalis/i.test(custom),
              () => `Rodar com o argumento <code>Terminalis</code> deveria imprimir "Ola, Terminalis", mas imprimiu: ${JSON.stringify(String(custom).slice(0, 80))}. Se o ENTRYPOINT estiver em shell form, o argumento é descartado.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 6.3 ============================== */
  LX.lesson('d06', {
    id: 'ld6-3', n: '6.3', title: 'ENV, ARG, EXPOSE, USER, VOLUME, LABEL e HEALTHCHECK',
    goal: 'Completar o repertório de instruções e separar as três confusões restantes.',
    body: [
      { h2: 'ENV: variável que existe no container' },
      { code: ['ENV NODE_ENV=production', 'ENV PORTA=3000 TZ=America/Sao_Paulo'], run: false, lang: 'dockerfile' },
      { p: 'Fica gravada na imagem e está disponível em toda instrução seguinte do build <em>e</em> dentro do container em execução. Pode ser sobrescrita no <code>docker run</code> com <code>-e</code>.' },
      {
        box: 'warn', label: 'A forma antiga sem "=" ainda funciona, mas morde', body: [
          { code: ['ENV CHAVE valor'], run: false, lang: 'dockerfile' },
          { p: 'Está formalmente obsoleta desde a versão 20.10 e o BuildKit emite o aviso <code>LegacyKeyValueFormat</code>. Pior: ela engana. <code>ENV UM DOIS= TRES=mundo</code> define <strong>uma</strong> variável chamada <code>UM</code> com o valor <code>"DOIS= TRES=mundo"</code>.' },
          { p: 'Use sempre <code>ENV CHAVE=valor</code>.' }
        ]
      },

      { h2: 'ARG: variável que existe só no build' },
      { code: ['ARG VERSAO_NODE=22', 'FROM node:${VERSAO_NODE}-alpine', '', 'ARG AMBIENTE=producao', 'RUN echo "construindo para $AMBIENTE"'], run: false, lang: 'dockerfile' },
      {
        table: {
          head: ['', '<code>ARG</code>', '<code>ENV</code>'],
          rows: [
            ['Existe durante o build', 'sim', 'sim'],
            ['Existe no container', '<strong>não</strong>', 'sim'],
            ['Como definir de fora', '<code>--build-arg</code>', '<code>-e</code> no run'],
            ['Antes do primeiro FROM', 'sim (e só ele)', 'não']
          ]
        }
      },
      { p: 'Para um valor que vem do build e precisa sobreviver no container, combine os dois:' },
      { code: ['ARG VERSAO_APP=0.0.0', 'ENV VERSAO_APP=$VERSAO_APP'], run: false, lang: 'dockerfile' },
      { p: 'Um <code>ARG</code> declarado antes do primeiro <code>FROM</code> é global e pode ser usado na própria linha do <code>FROM</code>. Depois disso, cada estágio precisa redeclarar o <code>ARG</code> que quiser usar.' },
      {
        box: 'key', label: 'Nem ARG nem ENV servem para segredo', body: [
          { p: 'A documentação oficial é explícita: <em>"Build arguments and environment variables are inappropriate for passing secrets to your build, because they\'re exposed in the final image."</em>' },
          { p: 'Prove você mesmo com <code>docker history --no-trunc</code>: o valor do <code>--build-arg</code> aparece ali, para qualquer pessoa que tenha a imagem.' },
          { p: 'Segredo em build tem mecanismo próprio: <code>RUN --mount=type=secret</code> com <code>docker build --secret</code>. O conteúdo fica disponível durante aquele <code>RUN</code> e não vai para camada nenhuma.' }
        ]
      },

      { h2: 'EXPOSE: documentação' },
      { code: ['EXPOSE 3000', 'EXPOSE 80 443', 'EXPOSE 53/udp'], run: false, lang: 'dockerfile' },
      { p: 'Já vimos: não abre porta no host. O que ela faz de concreto é alimentar o <code>docker run -P</code> e servir de metadado — inclusive para o Traefik, que usa a primeira porta exposta quando você não informa qual é a do serviço.' },

      { h2: 'USER: não rodar como root' },
      { code: ['RUN adduser -D -u 1000 app', 'USER app', 'CMD ["node", "server.js"]'], run: false, lang: 'dockerfile' },
      { p: 'A ordem importa: o usuário precisa existir antes do <code>USER</code>, e tudo que vier <em>depois</em> roda com ele — inclusive os <code>RUN</code> seguintes, que perdem a permissão de instalar pacotes.' },
      { p: 'O padrão é: instalar tudo como root, ajustar donos, e só então trocar de usuário — na última parte do arquivo.' },

      { h2: 'VOLUME: declarar um ponto de dados' },
      { code: ['VOLUME /var/lib/mysql'], run: false, lang: 'dockerfile' },
      { p: 'Declara que aquele caminho guarda dados. Se ninguém montar nada ali, o Docker cria um <strong>volume anônimo</strong> automaticamente — o que evita perder dados por esquecimento, mas gera volumes com nomes de 64 caracteres espalhados pela máquina.' },
      { p: 'Em imagem própria, costuma ser melhor <em>não</em> declarar <code>VOLUME</code> e deixar quem usa a imagem decidir onde os dados vão. Imagens oficiais de banco declaram porque o custo de não declarar seria maior.' },

      { h2: 'LABEL: metadados' },
      { code: ['LABEL org.opencontainers.image.authors="equipe@exemplo.test"',
        'LABEL org.opencontainers.image.source="https://git.exemplo.test/equipe/api"',
        'LABEL org.opencontainers.image.version="1.4.2"'], run: false, lang: 'dockerfile' },
      { p: 'A instrução <code>MAINTAINER</code> foi substituída por <code>LABEL</code> — está obsoleta desde a versão 1.13, e o BuildKit avisa. As chaves padronizadas <code>org.opencontainers.image.*</code> são lidas por ferramentas de inventário e segurança.' },

      { h2: 'HEALTHCHECK: como saber se está pronto' },
      { code: ['HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\',
        '  CMD wget -q --spider http://localhost:3000/health || exit 1'], run: false, lang: 'dockerfile' },
      {
        table: {
          head: ['Opção', 'Padrão', 'Para quê'],
          rows: [
            ['<code>--interval</code>', '30s', 'de quanto em quanto tempo testar'],
            ['<code>--timeout</code>', '30s', 'quanto esperar cada teste'],
            ['<code>--start-period</code>', '0s', 'período de graça inicial: falhas não contam'],
            ['<code>--retries</code>', '3', 'quantas falhas seguidas até declarar <code>unhealthy</code>']
          ]
        }
      },
      { p: 'O comando precisa <strong>existir dentro da imagem</strong>. Um healthcheck com <code>curl</code> em uma imagem Alpine que não tem curl fica permanentemente <code>unhealthy</code> — e o motivo não aparece no <code>docker ps</code>, só no <code>docker inspect</code>.' },
      { code: ['$ docker inspect app --format "{{json .State.Health}}"'] },
      { p: 'O <code>--start-period</code> é o que evita o falso negativo em aplicação que demora a subir: sem ele, um banco que leva 20 segundos para abrir já é declarado doente antes de terminar de iniciar.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>ENV</code> vive no container; <code>ARG</code> só no build.',
          '<code>ENV chave valor</code> (sem <code>=</code>) está obsoleta e engana.',
          'Nem <code>ARG</code> nem <code>ENV</code> guardam segredo: <code>docker history</code> revela.',
          '<code>EXPOSE</code> documenta; <code>USER</code> deve vir por último.',
          '<code>HEALTHCHECK</code> precisa de um comando que exista na imagem, e de <code>--start-period</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td6-3-a', kind: 'guiado', title: 'ARG no build, ENV no container',
        body: [
          { p: 'Construa a mesma imagem duas vezes, passando um <code>--build-arg</code> diferente, e veja o valor atravessar para dentro do container.' },
          {
            code: [
              '$ mkdir -p ~/versao && cd ~/versao',
              '$ cat > Dockerfile <<\'FIM\'',
              'FROM alpine:3.21',
              'ARG VERSAO=1.0.0',
              'ENV VERSAO=$VERSAO',
              'CMD ["sh", "-c", "echo versao=$VERSAO"]',
              'FIM',
              '$ docker build -t versao:1.0 .',
              '$ docker run --rm versao:1.0',
              '$ docker build --build-arg VERSAO=2.0.0 -t versao:2.0 .',
              '$ docker run --rm versao:2.0'
            ]
          },
          { p: 'A primeira imprime <code>versao=1.0.0</code> — o padrão do <code>ARG</code>. A segunda imprime <code>versao=2.0.0</code>: o valor do <code>--build-arg</code> passou pelo <code>ENV VERSAO=$VERSAO</code> e sobreviveu ao container.' }
        ],
        hints: ['Sem o <code>ENV VERSAO=$VERSAO</code> depois do <code>ARG</code>, o valor não chegaria ao container — é exatamente o que a aula explica.'],
        check: async (ctx) => {
          const img1 = D.imagem(ctx, 'versao:1.0');
          const img2 = D.imagem(ctx, 'versao:2.0');
          const rodar = async (tag) => {
            const img = D.imagem(ctx, tag);
            if (!img) return null;
            const e = D.eng(ctx);
            const r = e.criarContainer({ imagem: tag, nome: 'v-' + LX.dockerHex(6) });
            if (!r.ok) return null;
            e.iniciar(r.container);
            const pedacos = [];
            await e.rodarPrincipal(r.container, {
              stdin: new LX.InStream(''),
              stdout: new LX.Stream({ onWrite: s => pedacos.push(s) }),
              stderr: new LX.Stream({ onWrite: s => pedacos.push(s) }),
              term: { readLine: async () => '' }
            });
            e.remover(r.container, { force: true, silencioso: true });
            return pedacos.join('');
          };
          const s1 = img1 ? await rodar('versao:1.0') : null;
          const s2 = img2 ? await rodar('versao:2.0') : null;
          return H.checkAll([
            [() => !!img1, 'Construa a imagem <code>versao:1.0</code> com <code>ARG VERSAO=1.0.0</code> e <code>ENV VERSAO=$VERSAO</code>.'],
            [() => !!img2, 'Construa também <code>versao:2.0</code> com <code>docker build --build-arg VERSAO=2.0.0 -t versao:2.0 .</code>.'],
            [() => s1 !== null && /versao=1\.0\.0/.test(s1),
              () => `Rodar <code>versao:1.0</code> deveria imprimir "versao=1.0.0", mas mostrou: ${JSON.stringify(String(s1).slice(0, 60))}`],
            [() => s2 !== null && /versao=2\.0\.0/.test(s2),
              () => `Rodar <code>versao:2.0</code> deveria imprimir "versao=2.0.0" — confira se o <code>ENV</code> recebeu o valor do <code>ARG</code>.`]
          ]);
        }
      },
      {
        id: 'td6-3-q', kind: 'quiz', title: 'A variável que sumiu',
        body: [
          { p: 'Este Dockerfile constrói sem erro, mas a variável não aparece no container:' },
          { code: ['FROM alpine:3.21', 'ARG VERSAO=1.4.2', 'CMD ["sh", "-c", "echo versao=$VERSAO"]'], run: false, lang: 'dockerfile' },
          { code: ['$ docker run --rm app:1.0', 'versao='], run: false, lang: 'text' },
          { p: 'Por quê?' }
        ],
        options: [
          { text: '<code>ARG</code> só existe durante o build. Para o valor chegar ao container, é preciso <code>ENV VERSAO=$VERSAO</code> depois do <code>ARG</code>.', correct: true },
          { text: 'Faltou passar <code>--build-arg VERSAO=1.4.2</code> no build.', why: 'O <code>ARG</code> tem valor padrão, então ele existiu durante o build. O problema é que ARG não sobrevive ao build.' },
          { text: 'O <code>CMD</code> em exec form não expande variáveis.', why: 'De fato não expande — mas aqui o comando é <code>sh -c</code>, e o shell expande. A prova é que ele imprimiu <code>versao=</code>, com a variável vazia, e não a string literal.' },
          { text: 'A imagem Alpine não suporta variáveis de ambiente.', why: 'Suporta normalmente.' }
        ],
        explain: 'É a distinção central entre as duas instruções. <code>ARG</code> configura o <em>build</em>; <code>ENV</code> configura o <em>container</em>. O padrão consagrado é declarar os dois: <code>ARG VERSAO=1.4.2</code> seguido de <code>ENV VERSAO=$VERSAO</code>. Assim o valor pode vir do <code>--build-arg</code> e ainda assim existir em tempo de execução.'
      },
      {
        id: 'td6-3-b', kind: 'desafio', title: 'Uma imagem com as boas práticas',
        body: [
          { p: 'Em <code>~/servico</code>, construa a imagem <code>servico:2.0</code> atendendo a todos estes requisitos:' },
          { ul: [
            'base <code>nginx:alpine</code>;',
            'um <code>LABEL</code> <code>org.opencontainers.image.version</code> com o valor <code>2.0</code>;',
            'declarar que a imagem escuta na porta 80;',
            'uma variável de ambiente <code>AMBIENTE</code> com valor <code>producao</code>, presente <strong>dentro</strong> do container;',
            'um <code>HEALTHCHECK</code> que teste <code>http://localhost/</code> com <code>wget</code>, com intervalo de 10 segundos e 3 tentativas;',
            'a página inicial substituída por um arquivo seu contendo a palavra <code>Servico</code>.'
          ] },
          { p: 'Depois, suba um container chamado <code>svc</code> a partir dela e confirme que ele fica <code>healthy</code>.' }
        ],
        hints: [
          'A imagem Alpine tem <code>wget</code>, não tem <code>curl</code>. O teste é <code>wget -q --spider http://localhost/ || exit 1</code>.',
          'A página do nginx fica em <code>/usr/share/nginx/html/index.html</code> — copie seu arquivo para lá.',
          'Para conferir a saúde: <code>docker ps</code> mostra <code>(healthy)</code> na coluna STATUS, e <code>docker inspect svc --format "{{.State.Health.Status}}"</code> mostra o valor exato.'
        ],
        solution: '<pre>$ mkdir -p ~/servico &amp;&amp; cd ~/servico\n$ echo "&lt;h1&gt;Servico no ar&lt;/h1&gt;" &gt; index.html\n$ cat &gt; Dockerfile &lt;&lt;\'FIM\'\nFROM nginx:alpine\nLABEL org.opencontainers.image.version="2.0"\nENV AMBIENTE=producao\nEXPOSE 80\nCOPY index.html /usr/share/nginx/html/index.html\nHEALTHCHECK --interval=10s --retries=3 CMD wget -q --spider http://localhost/ || exit 1\nFIM\n$ docker build -t servico:2.0 .\n$ docker run -d --name svc servico:2.0\n$ docker inspect svc --format "{{.State.Health.Status}}"</pre>',
        check: async (ctx) => {
          const img = D.imagem(ctx, 'servico:2.0');
          const c = D.container(ctx, 'svc');
          const saude = c ? await D.saude(ctx, 'svc') : 'none';
          const pagina = c ? D.leNoContainer(ctx, 'svc', '/usr/share/nginx/html/index.html') : null;
          return H.checkAll([
            [() => !!img, 'A imagem <code>servico:2.0</code> ainda não existe.'],
            [() => (img.config.Labels || {})['org.opencontainers.image.version'] === '2.0',
              'Falta o <code>LABEL org.opencontainers.image.version="2.0"</code>.'],
            [() => !!(img.config.ExposedPorts || {})['80/tcp'], 'Falta declarar a porta com <code>EXPOSE 80</code>.'],
            [() => (img.config.Env || []).some(e => e === 'AMBIENTE=producao'),
              'Falta <code>ENV AMBIENTE=producao</code>. Lembre que <code>ARG</code> não sobrevive ao build.'],
            [() => !!img.config.Healthcheck && (img.config.Healthcheck.Test || []).length > 0,
              'Falta o <code>HEALTHCHECK</code> na imagem.'],
            [() => img.config.Healthcheck.Interval === 10_000_000_000,
              'O intervalo do healthcheck precisa ser de 10 segundos (<code>--interval=10s</code>).'],
            [() => img.config.Healthcheck.Retries === 3, 'O healthcheck precisa de <code>--retries=3</code>.'],
            [() => !!c, 'Suba um container chamado <code>svc</code> a partir da imagem.'],
            [() => !!c && c.rodando, 'O container <code>svc</code> precisa estar em execução.'],
            [() => /Servico/.test(pagina || ''),
              'A página inicial dentro do container ainda não tem a palavra <code>Servico</code>. Copie o seu arquivo com <code>COPY</code> para <code>/usr/share/nginx/html/index.html</code>.'],
            [() => saude === 'healthy',
              () => `O container está com saúde <code>${saude}</code>. Confira o comando do healthcheck com <code>docker inspect svc --format "{{json .State.Health}}"</code> — o programa usado precisa existir dentro da imagem.`]
          ]);
        }
      }
    ]
  });
})();
