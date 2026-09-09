/* =========================================================================
   MÓDULO D07 — docker build
   Contexto, .dockerignore, cache, build args, multi-stage e buildx.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 7.1 ============================== */
  LX.lesson('d07', {
    id: 'ld7-1', n: '7.1', title: 'O contexto de build e o .dockerignore',
    goal: 'Entender o que o ponto final do `docker build .` significa — e por que ele decide o tamanho e a segurança do seu build.',
    setup: (m) => {
      LX.D.pasta(m, '/home/aluno/vazamento');
      LX.D.arquivo(m, '/home/aluno/vazamento/.env',
        'SENHA_DO_BANCO=trocar-antes-de-usar\nHASH_KEY=chave-ficticia-de-exemplo\n', 0o600);
      LX.D.arquivo(m, '/home/aluno/vazamento/app.js', 'console.log("aplicacao de exemplo");\n');
      LX.D.arquivo(m, '/home/aluno/vazamento/package.json',
        '{"name":"vazamento","version":"1.0.0","scripts":{"start":"node app.js"}}\n');
      LX.D.arquivo(m, '/home/aluno/vazamento/Dockerfile',
        '# syntax=docker/dockerfile:1\nFROM alpine:3.21\nWORKDIR /app\nCOPY . .\nCMD ["ls", "-la", "/app"]\n');
      try { m.fs.unlink('/home/aluno/vazamento/.dockerignore', { ctx: m.ctxRoot() }); } catch (e) { }
    },
    body: [
      { h2: 'O ponto não é onde está o Dockerfile' },
      { code: ['$ docker build -t app:1.0 .'], run: false, lang: 'bash' },
      { p: 'Aquele <code>.</code> é o <strong>contexto de build</strong>: o conjunto de arquivos que o cliente empacota e envia ao daemon. Só o que está dentro do contexto pode ser copiado com <code>COPY</code>.' },
      {
        ascii: `  seu diretório                    daemon
 ┌──────────────────┐         ┌──────────────────┐
 │ Dockerfile       │         │                  │
 │ package.json     │  ────▶  │  recebe o pacote │
 │ src/             │ contexto│  e executa as    │
 │ node_modules/ ✗  │         │  instruções      │
 │ .git/         ✗  │         │                  │
 └──────────────────┘         └──────────────────┘
   ✗ = deveria estar no .dockerignore`
      },
      {
        box: 'key', label: 'Duas consequências imediatas', body: [
          {
            ul: [
              '<code>COPY ../config.json .</code> <strong>não funciona</strong>: sair do contexto é proibido, e o erro é <em>forbidden path outside the build context</em>.',
              'Um contexto de 2 GB (com <code>node_modules</code> e <code>.git</code> dentro) faz o build parecer travado no começo: ele está transferindo tudo, mesmo que o Dockerfile não copie nada disso.'
            ]
          }
        ]
      },

      { h2: 'Separar contexto e Dockerfile' },
      { code: ['$ docker build -f docker/Dockerfile.prod -t app:1.0 .'], run: false, lang: 'bash' },
      { p: 'Aqui o Dockerfile está em <code>docker/</code>, mas o contexto continua sendo <code>.</code>. Os caminhos do <code>COPY</code> são relativos ao <strong>contexto</strong>, não ao diretório do Dockerfile — esse é o erro nº 1 quando o arquivo é movido de lugar.' },

      { h2: '.dockerignore' },
      { p: 'Mesmo formato de ideia do <code>.gitignore</code>, e mesmo lugar: a raiz do contexto.' },
      { code: ['node_modules', '.git', '.gitignore', '*.log', '.env', '.env.*', '!.env.example',
        'dist', 'coverage', 'Dockerfile*', 'docker-compose*.yml', 'README.md', '**/__pycache__'], run: false, lang: 'text' },
      {
        table: {
          head: ['Motivo', 'Explicação'],
          rows: [
            ['<strong>Velocidade</strong>', 'menos bytes transferidos, cache mais estável'],
            ['<strong>Tamanho</strong>', 'um <code>COPY . .</code> descuidado leva tudo para dentro da imagem'],
            ['<strong>Segurança</strong>', 'é assim que um <code>.env</code> com credenciais vai parar em uma imagem publicada'],
            ['<strong>Cache</strong>', 'sem ele, qualquer arquivo temporário invalida o cache do <code>COPY . .</code>']
          ]
        }
      },
      {
        box: 'warn', label: 'O vazamento silencioso', body: [
          { p: 'Um <code>COPY . .</code> em um projeto sem <code>.dockerignore</code> leva para dentro da imagem: o <code>.env</code> com senhas, o <code>.git</code> com todo o histórico (inclusive segredos que alguém "removeu" em um commit posterior) e as chaves SSH que estiverem na pasta.' },
          { p: 'Essa imagem vai para o registry. Qualquer pessoa que consiga baixá-la roda <code>docker run --rm -it a-imagem sh</code> e lê tudo. Não é hipótese: é um dos vazamentos mais comuns que existem.' }
        ]
      },
      { p: 'A verificação leva dez segundos e vale sempre a pena:' },
      { code: ['$ docker run --rm -it minha-imagem:1.0 sh -c "ls -la /app"'], run: false, lang: 'bash' },

      { h2: 'Ler a saída do build' },
      { code: ['$ docker build -t app:1.0 .'] },
      { p: 'A saída do BuildKit tem uma estrutura fixa:' },
      {
        ul: [
          '<code>[internal] load build definition</code> — leu o Dockerfile',
          '<code>[internal] load .dockerignore</code> — leu as exclusões',
          '<code>[internal] load metadata for ...</code> — consultou a imagem base',
          '<code>[1/6] FROM ...</code>, <code>[2/6] WORKDIR ...</code> — cada passo, numerado',
          '<code>CACHED</code> — esse passo foi reaproveitado, não executou',
          '<code>[internal] load build context</code> — transferiu os arquivos; o tamanho aqui denuncia contexto inchado',
          '<code>exporting to image</code> — gravou as camadas'
        ]
      },
      { p: 'Quando um <code>RUN</code> falha, você quer ver a saída completa dele:' },
      { code: ['$ docker build --progress=plain -t app:1.0 .'], run: false, lang: 'bash' },
      { p: 'Sem <code>--progress=plain</code>, o BuildKit colapsa as linhas e você vê só o resumo.' },

      { h2: 'Resumo' },
      {
        ul: [
          'O argumento final é o contexto, não a pasta do Dockerfile.',
          '<code>COPY</code> não pode sair do contexto.',
          '<code>-f</code> separa o Dockerfile do contexto; os caminhos continuam relativos ao contexto.',
          '<code>.dockerignore</code> protege velocidade, tamanho e segredos.',
          '<code>--progress=plain</code> mostra a saída inteira dos <code>RUN</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td7-1-a', kind: 'guiado', title: 'Ver o vazamento acontecer',
        body: [
          { p: 'O diretório <code>~/vazamento</code> tem um projeto com um <code>Dockerfile</code> que faz <code>COPY . .</code>, e um <code>.env</code> com uma credencial fictícia dentro.' },
          {
            code: [
              '$ cd ~/vazamento',
              '$ docker build -t vazamento:1.0 .',
              '$ docker run --rm vazamento:1.0 ls -la /app',
              '$ docker run --rm vazamento:1.0 cat /app/.env'
            ]
          },
          { p: 'O <code>.env</code> com a credencial fictícia está dentro da imagem — pronto para ir a qualquer lugar que essa imagem for.' }
        ],
        hints: ['Rode dentro de <code>~/vazamento</code>, sem mexer nos arquivos ainda — é só para ver o problema.'],
        check: async (ctx) => {
          const img = D.imagem(ctx, 'vazamento:1.0');
          return H.checkAll([
            [() => H.usedCommand(ctx, /docker\s+build\s+-t\s+vazamento:1\.0\s+\./), 'Construa a imagem com <code>docker build -t vazamento:1.0 .</code>, dentro de <code>~/vazamento</code>.'],
            [() => !!img, 'A imagem <code>vazamento:1.0</code> ainda não existe.'],
            [() => H.usedCommand(ctx, /docker\s+run\s+--rm\s+vazamento:1\.0/), 'Rode a imagem para olhar dentro: <code>docker run --rm vazamento:1.0 ls -la /app</code>.']
          ]);
        }
      },
      {
        id: 'td7-1-q', kind: 'quiz', title: 'Por que o build parece travado',
        body: [
          { p: 'Um projeto tem uma pasta <code>node_modules</code> de 900 MB e um <code>.git</code> de 400 MB, sem nenhum <code>.dockerignore</code>. O Dockerfile não tem nenhum <code>COPY node_modules</code> nem <code>COPY .git</code>. Mesmo assim, os primeiros segundos de <code>docker build -t app:1.0 .</code> ficam parados na etapa <code>[internal] load build context</code>. Por quê?' }
        ],
        options: [
          { text: 'O contexto de build é todo o conteúdo do diretório, enviado ao daemon antes do build começar — <code>node_modules</code> e <code>.git</code> entram nesse envio mesmo que o Dockerfile nunca os copie.', correct: true },
          { text: 'O Dockerfile tem um <code>COPY . .</code>, e por isso baixa a internet toda de novo.', why: 'Copiar do contexto não "baixa da internet" — o contexto já está no disco local. O que demora é o envio desses arquivos ao daemon.' },
          { text: 'O <code>docker build</code> sempre roda <code>npm install</code> antes de qualquer instrução.', why: 'Nada nesse cenário mostra um <code>RUN npm install</code>; o atraso descrito acontece antes de qualquer instrução, na etapa de carregar o contexto.' },
          { text: 'A imagem base ainda não foi baixada.', why: 'Isso apareceria como <code>[internal] load metadata</code>, uma etapa diferente da que travou.' }
        ],
        explain: 'O <code>.dockerignore</code> resolve os dois problemas de uma vez: exclui <code>node_modules</code> e <code>.git</code> do que é enviado ao daemon, o que acelera o build e, de quebra, impede que esses diretórios (às vezes com segredo dentro) parem numa imagem publicada.'
      },
      {
        id: 'td7-1-b', kind: 'desafio', title: 'Impedir que um segredo entre na imagem',
        body: [
          { p: 'O diretório <code>~/vazamento</code> tem um projeto com um <code>Dockerfile</code> que faz <code>COPY . .</code>, e um arquivo <code>.env</code> com uma credencial fictícia dentro.' },
          { ol: [
            'Construa a imagem <code>vazamento:1.0</code> como está e confirme que o <code>.env</code> foi parar dentro dela.',
            'Crie um <code>.dockerignore</code> que impeça isso.',
            'Reconstrua a imagem e confirme que o <code>.env</code> não está mais lá dentro.'
          ] },
          { p: 'No fim, a imagem <code>vazamento:1.0</code> não pode conter o arquivo <code>.env</code>.' }
        ],
        hints: [
          'Para olhar dentro da imagem sem subir a aplicação: <code>docker run --rm vazamento:1.0 ls -la /app</code>.',
          'O <code>.dockerignore</code> vai na raiz do contexto, junto do Dockerfile, e uma linha com <code>.env</code> basta.',
          'Depois de criar o arquivo, é preciso <strong>reconstruir</strong> a imagem — o <code>.dockerignore</code> só age em tempo de build.'
        ],
        solution: '<pre>$ cd ~/vazamento\n$ docker build -t vazamento:1.0 .\n$ docker run --rm vazamento:1.0 ls -la /app\n(o .env aparece)\n$ printf ".env\\n.git\\nnode_modules\\n" &gt; .dockerignore\n$ docker build -t vazamento:1.0 .\n$ docker run --rm vazamento:1.0 ls -la /app\n(o .env sumiu)</pre>',
        check: async (ctx) => {
          const img = D.imagem(ctx, 'vazamento:1.0');
          const ign = H.read(ctx, '/home/aluno/vazamento/.dockerignore');
          let temEnv = null;
          if (img) {
            const e = D.eng(ctx);
            const r = e.criarContainer({ imagem: 'vazamento:1.0', nome: 'v-' + LX.dockerHex(6) });
            if (r.ok) {
              temEnv = false;
              try { r.container.maquina.fs.lstat('/app/.env', { ctx: r.container.maquina.ctxRoot() }); temEnv = true; }
              catch (err) { temEnv = false; }
              e.remover(r.container, { force: true, silencioso: true });
            }
          }
          return H.checkAll([
            [() => !!img, 'A imagem <code>vazamento:1.0</code> ainda não existe. Construa com <code>docker build -t vazamento:1.0 .</code>.'],
            [() => ign !== null, 'Crie o arquivo <code>~/vazamento/.dockerignore</code>.'],
            [() => /(^|\n)\s*\.env\s*(\n|$)/.test(ign || ''), 'O <code>.dockerignore</code> precisa ter uma linha com <code>.env</code>.'],
            [() => temEnv === false,
              'A imagem ainda tem o <code>.env</code> dentro. Depois de criar o <code>.dockerignore</code>, é preciso reconstruir: <code>docker build -t vazamento:1.0 .</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 7.2 ============================== */
  LX.lesson('d07', {
    id: 'ld7-2', n: '7.2', title: 'Cache de camadas: a ordem que faz a diferença',
    goal: 'Escrever Dockerfiles que reaproveitam cache, e saber por que o seu build demora sempre.',
    setup: (m) => {
      LX.D.pasta(m, '/home/aluno/lento');
      LX.D.arquivo(m, '/home/aluno/lento/app.js', 'console.log("aplicacao lenta no ar");\n');
      LX.D.arquivo(m, '/home/aluno/lento/package.json',
        '{"name":"lento","version":"1.0.0","scripts":{"start":"node app.js"}}\n');
      LX.D.arquivo(m, '/home/aluno/lento/Dockerfile',
        '# syntax=docker/dockerfile:1\nFROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["node", "app.js"]\n');
    },
    body: [
      { h2: 'Como o cache decide' },
      { p: 'Para cada instrução, o BuildKit calcula uma chave a partir da camada anterior mais a própria instrução. Se essa chave já existe, ele reaproveita e mostra <code>CACHED</code>.' },
      {
        box: 'key', label: 'Uma quebra invalida tudo abaixo', body: [
          { p: 'O cache é uma corrente. Se a instrução 3 mudou, as instruções 4, 5 e 6 são reexecutadas — mesmo que elas próprias não tenham mudado, porque a base delas é outra.' },
          { p: 'Daí a regra de ouro: <strong>o que muda pouco vai em cima, o que muda muito vai embaixo</strong>.' }
        ]
      },
      { p: 'Para <code>COPY</code> e <code>ADD</code>, a chave inclui o <em>conteúdo</em> dos arquivos copiados. Para as demais, é o texto da instrução.' },

      { h2: 'O erro clássico' },
      { code: ['FROM node:22-alpine', 'WORKDIR /app', 'COPY . .', 'RUN npm install', 'CMD ["node", "server.js"]'], run: false, lang: 'dockerfile' },
      { p: 'Trocar uma vírgula em qualquer arquivo do projeto muda o <code>COPY . .</code>, o que invalida o <code>RUN npm install</code>. Resultado: baixar todas as dependências de novo, a cada build.' },
      { p: 'A versão que aproveita o cache:' },
      { code: ['FROM node:22-alpine', 'WORKDIR /app', '',
        '# muda raramente: fica em cima', 'COPY package.json package-lock.json ./', 'RUN npm ci', '',
        '# muda a cada commit: fica embaixo', 'COPY . .', 'CMD ["node", "server.js"]'], run: false, lang: 'dockerfile' },
      { p: 'Agora o <code>npm ci</code> só roda de novo quando as dependências realmente mudam. Em um projeto grande, isso transforma um build de três minutos em um de dez segundos.' },
      { p: 'O mesmo princípio em outras linguagens: <code>requirements.txt</code> antes do código em Python, <code>go.mod</code> e <code>go.sum</code> antes do código em Go, <code>composer.json</code> antes em PHP.' },

      { h2: 'Quando o cache atrapalha' },
      { code: ['FROM debian:bookworm-slim', 'RUN apt-get update', 'RUN apt-get install -y curl'], run: false, lang: 'dockerfile' },
      { p: 'Semanas depois, o <code>apt-get update</code> está em cache e não roda; o <code>apt-get install</code> tenta baixar pacotes de um índice velho, e falha com <em>404 Not Found</em>. Por isso os dois vão sempre juntos, no mesmo <code>RUN</code>.' },
      { code: ['$ docker build --no-cache -t app:1.0 .', '$ docker build --pull -t app:1.0 .'], run: false, lang: 'bash' },
      {
        ul: [
          '<code>--no-cache</code> ignora todo o cache — use para reproduzir um build limpo',
          '<code>--pull</code> força buscar a imagem base atualizada, mesmo já tendo uma cópia local'
        ]
      },

      { h2: 'Cache mounts' },
      { p: 'Com a diretiva <code>syntax</code>, existe um mecanismo mais fino: um diretório de cache que <strong>persiste entre builds</strong> sem entrar em nenhuma camada.' },
      { code: ['# syntax=docker/dockerfile:1', 'FROM node:22-alpine', 'WORKDIR /app', 'COPY package.json package-lock.json ./',
        'RUN --mount=type=cache,target=/root/.npm npm ci'], run: false, lang: 'dockerfile' },
      { p: 'O diretório de cache do npm sobrevive de um build para o outro, mas não vai para a imagem. É o melhor dos dois mundos: rápido e enxuto.' },

      { h2: 'Segredos no build' },
      { code: ['# syntax=docker/dockerfile:1', 'FROM alpine:3.21',
        'RUN --mount=type=secret,id=token \\', '    TOKEN=$(cat /run/secrets/token) && \\', '    echo "usando o token sem gravá-lo em camada nenhuma"'], run: false, lang: 'dockerfile' },
      { code: ['$ docker build --secret id=token,src=./token.txt -t app:1.0 .'], run: false, lang: 'bash' },
      { p: 'Este é o mecanismo correto para um build que precisa de credencial — baixar de um repositório privado, por exemplo. O conteúdo existe só durante aquele <code>RUN</code> e não deixa rastro em nenhuma camada.' },

      { h2: 'Resumo' },
      {
        ul: [
          'O cache é uma corrente: quebrou em cima, tudo abaixo reexecuta.',
          'Dependências antes do código-fonte. Sempre.',
          '<code>apt-get update</code> e <code>install</code> no mesmo <code>RUN</code>.',
          '<code>--no-cache</code> e <code>--pull</code> para builds limpos.',
          '<code>--mount=type=cache</code> acelera; <code>--mount=type=secret</code> protege.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td7-2-a', kind: 'guiado', title: 'Escrever um Dockerfile que aproveita cache',
        body: [
          { p: 'Construa uma imagem separando o que muda pouco (dependências) do que muda a cada commit (código).' },
          {
            code: [
              '$ mkdir -p ~/cache-demo && cd ~/cache-demo',
              '$ echo \'{"name":"demo","version":"1.0.0"}\' > package.json',
              '$ echo "console.log(\'ola\')" > app.js',
              '$ cat > Dockerfile <<\'FIM\'',
              'FROM node:22-alpine',
              'WORKDIR /app',
              'COPY package.json ./',
              'RUN npm install',
              'COPY . .',
              'CMD ["node", "app.js"]',
              'FIM',
              '$ docker build -t cache-demo:1.0 .',
              '$ docker run --rm cache-demo:1.0'
            ]
          },
          { p: 'O <code>package.json</code> entra antes do <code>RUN npm install</code>, e só depois o <code>COPY . .</code> traz o resto — é essa ordem que preserva o cache quando só o código muda.' }
        ],
        hints: ['A ordem é: <code>COPY package.json</code>, depois <code>RUN npm install</code>, e só então <code>COPY . .</code>.'],
        check: async (ctx) => {
          const df = D.dockerfile(ctx, '/home/aluno/cache-demo/Dockerfile');
          const img = D.imagem(ctx, 'cache-demo:1.0');
          let ordemOk = false;
          if (df && !df.erro) {
            const seq = df.instrucoes.filter(i => ['COPY', 'RUN'].includes(i.nome));
            const iPkg = seq.findIndex(i => i.nome === 'COPY' && /package/.test(i.arg));
            const iInstall = seq.findIndex(i => i.nome === 'RUN' && /npm\s+(ci|install)/.test(i.arg));
            const iCopyTudo = seq.findIndex(i => i.nome === 'COPY' && /^\.\s+/.test(i.arg.trim()));
            ordemOk = iPkg >= 0 && iInstall > iPkg && (iCopyTudo === -1 || iCopyTudo > iInstall);
          }
          return H.checkAll([
            [() => df !== null, 'Crie o <code>~/cache-demo/Dockerfile</code>.'],
            [() => df && !df.erro, () => 'O Dockerfile tem um erro de sintaxe: ' + ((df && df.erro) || '')],
            [() => ordemOk, 'O <code>COPY package.json</code> precisa vir antes do <code>RUN npm install</code>, e o <code>COPY . .</code> só depois.'],
            [() => !!img, 'Construa a imagem com <code>docker build -t cache-demo:1.0 .</code>.'],
            [() => H.usedCommand(ctx, /docker\s+run\s+--rm\s+cache-demo:1\.0/), 'Rode a imagem com <code>docker run --rm cache-demo:1.0</code>.']
          ]);
        }
      },
      {
        id: 'td7-2-q', kind: 'quiz', title: 'Por que o apt-get install falha semanas depois',
        body: [
          { p: 'Este Dockerfile funcionou perfeitamente no dia em que foi escrito:' },
          { code: ['FROM debian:bookworm-slim', 'RUN apt-get update', 'RUN apt-get install -y curl'], run: false, lang: 'dockerfile' },
          { p: 'Semanas depois, sem nenhuma mudança no Dockerfile, um novo build falha no segundo <code>RUN</code> com <em>404 Not Found</em> ao baixar o <code>curl</code>. Por quê?' }
        ],
        options: [
          { text: 'O <code>RUN apt-get update</code> ficou em cache (a instrução não mudou) e não roda de novo; o <code>RUN apt-get install</code> roda contra um índice de pacotes velho, e algum pacote já saiu dali.', correct: true },
          { text: 'A imagem base <code>debian:bookworm-slim</code> deixou de existir.', why: 'Nada indica isso — o erro é 404 ao instalar um pacote específico, não uma falha em baixar a imagem base.' },
          { text: 'Falta um <code>apt-get upgrade</code> antes do <code>install</code>.', why: '<code>upgrade</code> não resolveria: o problema é o <code>update</code> congelado em cache, não a ausência de upgrade.' },
          { text: 'O build perdeu acesso à internet.', why: 'Sem rede, o próprio <code>apt-get update</code> teria falhado — e ele é justamente o passo que não rodou de novo.' }
        ],
        explain: 'É por isso que <code>apt-get update</code> e <code>apt-get install</code> precisam sempre estar no mesmo <code>RUN</code>: juntos, os dois sempre reexecutam juntos, e o índice nunca fica velho em relação à instalação.'
      },
      {
        id: 'td7-2-b', kind: 'desafio', title: 'Consertar a ordem de um Dockerfile',
        body: [
          { p: 'O projeto em <code>~/lento</code> tem um Dockerfile que reinstala as dependências a cada build, porque a ordem das instruções está errada.' },
          { ol: [
            'Leia o Dockerfile atual e identifique por que o cache quebra sempre.',
            'Reescreva-o para que a instalação de dependências só reexecute quando o <code>package.json</code> mudar.',
            'Construa a imagem com a tag <code>lento:2.0</code>.',
            'Altere o arquivo <code>app.js</code> e reconstrua: o passo de instalação deve aparecer como <code>CACHED</code>.'
          ] },
          { p: 'A imagem final precisa continuar funcionando: <code>docker run --rm lento:2.0</code> deve imprimir a mensagem da aplicação.' }
        ],
        hints: [
          'O problema é o <code>COPY . .</code> vir antes do <code>RUN npm install</code>: qualquer mudança no código invalida a instalação.',
          'A ordem correta é: <code>COPY package.json ./</code>, depois <code>RUN npm install</code>, e só então <code>COPY . .</code>.',
          'Depois de reconstruir duas vezes, procure a linha <code>CACHED</code> na saída do build.'
        ],
        solution: '<pre>$ cd ~/lento\n$ cat &gt; Dockerfile &lt;&lt;\'FIM\'\n# syntax=docker/dockerfile:1\nFROM node:22-alpine\nWORKDIR /app\nCOPY package.json ./\nRUN npm install\nCOPY . .\nCMD ["node", "app.js"]\nFIM\n$ docker build -t lento:2.0 .\n$ echo \'console.log("mudou");\' &gt;&gt; app.js\n$ docker build -t lento:2.0 .\n$ docker run --rm lento:2.0</pre>',
        check: async (ctx) => {
          const df = D.dockerfile(ctx, '/home/aluno/lento/Dockerfile');
          const img = D.imagem(ctx, 'lento:2.0');
          let ordemOk = false;
          if (df && !df.erro) {
            const seq = df.instrucoes.filter(i => ['COPY', 'RUN'].includes(i.nome));
            const iPkg = seq.findIndex(i => i.nome === 'COPY' && /package/.test(i.arg));
            const iInstall = seq.findIndex(i => i.nome === 'RUN' && /npm\s+(ci|install)/.test(i.arg));
            const iTudo = seq.findIndex(i => i.nome === 'COPY' && /^\.\s|\s\.\s*$|^\.\s+\./.test(i.arg.trim()) === false && /^\.\s/.test(i.arg.trim()));
            const iCopyTudo = seq.findIndex(i => i.nome === 'COPY' && /^\.\s+/.test(i.arg.trim()));
            ordemOk = iPkg >= 0 && iInstall > iPkg && (iCopyTudo === -1 || iCopyTudo > iInstall);
          }
          let saida = null;
          if (img) {
            const e = D.eng(ctx);
            const r = e.criarContainer({ imagem: 'lento:2.0', nome: 'v-' + LX.dockerHex(6) });
            if (r.ok) {
              e.iniciar(r.container);
              const pedacos = [];
              await e.rodarPrincipal(r.container, {
                stdin: new LX.InStream(''),
                stdout: new LX.Stream({ onWrite: s => pedacos.push(s) }),
                stderr: new LX.Stream({ onWrite: s => pedacos.push(s) }),
                term: { readLine: async () => '' }
              });
              saida = pedacos.join('');
              e.remover(r.container, { force: true, silencioso: true });
            }
          }
          return H.checkAll([
            [() => df !== null, 'O <code>~/lento/Dockerfile</code> sumiu.'],
            [() => !df.erro, () => 'O Dockerfile tem erro de sintaxe: ' + df.erro],
            [() => df.instrucoes.some(i => i.nome === 'COPY' && /package/.test(i.arg)),
              'Falta um <code>COPY</code> só do <code>package.json</code>, antes da instalação.'],
            [() => ordemOk,
              'A ordem ainda não aproveita o cache. O <code>COPY</code> do <code>package.json</code> precisa vir antes do <code>RUN npm install</code>, e o <code>COPY . .</code> depois dele.'],
            [() => !!img, 'A imagem <code>lento:2.0</code> ainda não foi construída.'],
            [() => saida !== null && saida.trim() !== '',
              'A imagem foi construída, mas rodá-la não produz saída. Confira se o <code>CMD</code> continua apontando para o <code>app.js</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 7.3 ============================== */
  LX.lesson('d07', {
    id: 'ld7-3', n: '7.3', title: 'Multi-stage: a imagem de produção',
    goal: 'Separar o ambiente de construção do ambiente de execução, e chegar a uma imagem pequena e segura.',
    setup: (m) => {
      LX.D.pasta(m, '/home/aluno/site');
      LX.D.arquivo(m, '/home/aluno/site/package.json',
        '{\n  "name": "site",\n  "version": "1.0.0",\n  "scripts": {\n' +
        '    "build": "mkdir -p dist && echo \'<h1>Site construido</h1>\' > dist/index.html"\n  }\n}\n');
      LX.D.arquivo(m, '/home/aluno/site/index.js', 'console.log("servidor node de desenvolvimento");\n');
      LX.D.arquivo(m, '/home/aluno/site/Dockerfile',
        '# syntax=docker/dockerfile:1\nFROM node:22-alpine\nWORKDIR /src\nCOPY . .\nRUN npm install\nRUN npm run build\nCMD ["node", "index.js"]\n');
    },
    body: [
      { h2: 'O problema' },
      { p: 'Para construir uma aplicação você precisa de compilador, dependências de desenvolvimento e ferramentas de build. Para <em>executar</em>, não precisa de nada disso.' },
      { p: 'Em uma imagem de estágio único, tudo isso vai junto: a imagem fica grande, demora para transferir e carrega uma superfície de ataque enorme — um invasor que consiga executar comandos ali encontra um compilador à disposição.' },

      { h2: 'A solução: vários FROM' },
      { code: ['# syntax=docker/dockerfile:1', '',
        '# ---------- estágio 1: construir ----------', 'FROM node:22-alpine AS construcao', 'WORKDIR /src',
        'COPY package.json package-lock.json ./', 'RUN npm ci', 'COPY . .', 'RUN npm run build', '',
        '# ---------- estágio 2: executar ----------', 'FROM nginx:alpine AS producao',
        'COPY --from=construcao /src/dist /usr/share/nginx/html', 'EXPOSE 80',
        'CMD ["nginx", "-g", "daemon off;"]'], run: false, lang: 'dockerfile' },
      { p: 'A imagem final é <strong>somente o último estágio</strong>. Tudo do primeiro — o Node, o npm, as dependências de desenvolvimento, o código-fonte — fica de fora. Só os arquivos explicitamente copiados com <code>COPY --from</code> atravessam.' },
      {
        ascii: `estágio "construcao"        estágio "producao"
┌────────────────────┐      ┌──────────────────────┐
│ node + npm  ~150MB │      │ nginx alpine   ~48MB │
│ node_modules ~300MB│  ──▶ │ + dist/         ~2MB │
│ código-fonte       │ COPY └──────────────────────┘
│ dist/          2MB │--from      IMAGEM FINAL
└────────────────────┘         descartado: 450MB`
      },

      { h2: 'Nomear estágios' },
      { code: ['FROM golang:1.24 AS compilador', 'FROM alpine:3.21 AS final', 'COPY --from=compilador /out/app /app'], run: false, lang: 'dockerfile' },
      { p: 'Sem <code>AS</code>, os estágios são referenciados por número (<code>--from=0</code>). Nomear é mais legível e não quebra quando você insere um estágio no meio.' },
      { p: 'O <code>--from</code> também aceita uma imagem externa, o que é útil para pegar um binário pronto sem instalá-lo:' },
      { code: ['COPY --from=traefik:v3.7 /usr/local/bin/traefik /usr/local/bin/traefik'], run: false, lang: 'dockerfile' },

      { h2: '--target: parar em um estágio' },
      { code: ['$ docker build --target construcao -t app:dev .', '$ docker build -t app:prod .'], run: false, lang: 'bash' },
      { p: 'É o padrão mais prático do multi-stage: o mesmo Dockerfile gera a imagem de desenvolvimento (com as ferramentas, para rodar testes) e a de produção (enxuta). Um único arquivo, duas saídas.' },
      { code: ['FROM node:22-alpine AS base', 'WORKDIR /app', 'COPY package.json package-lock.json ./', '',
        'FROM base AS dependencias', 'RUN npm ci', '',
        'FROM dependencias AS teste', 'COPY . .', 'RUN npm test', '',
        'FROM dependencias AS producao', 'ENV NODE_ENV=production', 'COPY . .', 'USER node',
        'CMD ["node", "server.js"]'], run: false, lang: 'dockerfile' },

      { h2: 'A progressão completa' },
      {
        table: {
          head: ['Etapa', 'O que muda', 'Tamanho típico'],
          rows: [
            ['1. ingênua', '<code>FROM node:22</code>, <code>COPY . .</code>, <code>RUN npm install</code>', '~1,1 GB'],
            ['2. base menor', '<code>FROM node:22-alpine</code>', '~450 MB'],
            ['3. cache correto', '<code>package.json</code> antes do código', '~450 MB, mas build 10× mais rápido'],
            ['4. só produção', '<code>npm ci --omit=dev</code>', '~200 MB'],
            ['5. multi-stage', 'compila em um estágio, roda em outro', '~60 MB'],
            ['6. endurecida', '<code>USER</code>, <code>--read-only</code>, <code>HEALTHCHECK</code>', '~60 MB, e bem mais segura']
          ]
        }
      },
      { p: 'Cada passo é pequeno e independente. Não é preciso chegar ao passo 6 de uma vez — mas em produção, é para lá que se caminha.' },

      { h2: 'buildx e multi-plataforma' },
      { p: 'Desde a versão 23, <code>docker build</code> <strong>já é</strong> <code>docker buildx build</code>: o BuildKit é o construtor padrão. Não é preciso ativar nada.' },
      { code: ['$ docker buildx version', '$ docker buildx ls'] },
      { p: 'O buildx aparece explicitamente em dois casos: construir para outra arquitetura, e construir para várias de uma vez.' },
      { code: ['$ docker build --platform linux/arm64 -t app:1.0 .',
        '$ docker buildx build --platform linux/amd64,linux/arm64 -t registro.exemplo.test/app:1.0 --push .'], run: false, lang: 'bash' },
      { p: 'Isso importa quando a máquina de desenvolvimento é ARM (um notebook Apple Silicon, por exemplo) e o servidor é x86_64 — uma imagem construída sem <code>--platform</code> simplesmente não roda lá.' },
      {
        box: 'note', label: 'DOCKER_BUILDKIT=0 é coisa do passado', body: [
          { p: 'O construtor clássico está formalmente obsoleto desde a versão 23. Se você encontrar um tutorial mandando definir <code>DOCKER_BUILDKIT=0</code>, ele é antigo — ignore.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Vários <code>FROM</code>: só o último estágio vira a imagem.',
          '<code>COPY --from</code> traz apenas os artefatos que interessam.',
          '<code>--target</code> gera imagens diferentes do mesmo arquivo.',
          'Multi-stage reduz tamanho e superfície de ataque ao mesmo tempo.',
          '<code>docker build</code> já é buildx; <code>--platform</code> para outra arquitetura.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td7-3-a', kind: 'guiado', title: 'Ver dois estágios virarem uma imagem só',
        body: [
          { p: 'Construa uma imagem multi-stage simples: um estágio gera um arquivo, o outro só o recebe.' },
          {
            code: [
              '$ mkdir -p ~/multi-demo && cd ~/multi-demo',
              '$ cat > Dockerfile <<\'FIM\'',
              'FROM alpine:3.21 AS gerador',
              'RUN mkdir -p /saida && echo "<h1>gerado no estagio 1</h1>" > /saida/index.html',
              '',
              'FROM nginx:alpine',
              'COPY --from=gerador /saida/index.html /usr/share/nginx/html/index.html',
              'FIM',
              '$ docker build -t multi-demo:1.0 .',
              '$ docker run --rm multi-demo:1.0 cat /usr/share/nginx/html/index.html',
              '$ docker run --rm multi-demo:1.0 which node ; echo "codigo: $?"'
            ]
          },
          { p: 'O último comando não encontra <code>node</code> — porque ele nunca existiu nessa imagem: o estágio <code>gerador</code> usou Alpine puro, e só o arquivo final atravessou com <code>COPY --from</code>.' }
        ],
        hints: ['Nomeie o primeiro estágio com <code>AS gerador</code> e traga o arquivo com <code>COPY --from=gerador</code>.'],
        check: async (ctx) => {
          const df = D.dockerfile(ctx, '/home/aluno/multi-demo/Dockerfile');
          const img = D.imagem(ctx, 'multi-demo:1.0');
          const froms = df && !df.erro ? df.instrucoes.filter(i => i.nome === 'FROM') : [];
          let saida = null;
          if (img) {
            const e = D.eng(ctx);
            const r = e.criarContainer({ imagem: 'multi-demo:1.0', nome: 'v-' + LX.dockerHex(6), cmd: ['cat', '/usr/share/nginx/html/index.html'] });
            if (r.ok) {
              e.iniciar(r.container);
              const pedacos = [];
              await e.rodarPrincipal(r.container, {
                stdin: new LX.InStream(''),
                stdout: new LX.Stream({ onWrite: s => pedacos.push(s) }),
                stderr: new LX.Stream({ onWrite: s => pedacos.push(s) }),
                term: { readLine: async () => '' }
              });
              saida = pedacos.join('');
              e.remover(r.container, { force: true, silencioso: true });
            }
          }
          return H.checkAll([
            [() => froms.length >= 2, () => `O Dockerfile tem ${froms.length} <code>FROM</code>. Multi-stage precisa de pelo menos dois.`],
            [() => df.instrucoes.some(i => i.nome === 'COPY' && /--from=/.test(i.arg)),
              'Falta o <code>COPY --from=</code> trazendo o arquivo do primeiro estágio.'],
            [() => !!img, 'Construa a imagem com <code>docker build -t multi-demo:1.0 .</code>.'],
            [() => saida !== null && /gerado no estagio 1/.test(saida),
              'A imagem final precisa ter o arquivo gerado no primeiro estágio, em <code>/usr/share/nginx/html/index.html</code>.']
          ]);
        }
      },
      {
        id: 'td7-3-q', kind: 'quiz', title: 'Uma imagem multi-stage que continua grande',
        body: [
          { p: 'Alguém converte um Dockerfile em multi-stage, mas a imagem final continua com quase 1 GB — o mesmo tamanho de antes:' },
          { code: ['FROM node:22-alpine AS construcao', 'WORKDIR /src', 'COPY package.json package-lock.json ./', 'RUN npm ci', 'COPY . .', 'RUN npm run build', '',
            'FROM node:22-alpine', 'WORKDIR /app', 'COPY --from=construcao /src/dist ./dist', 'COPY --from=construcao /src/node_modules ./node_modules', 'CMD ["node", "server.js"]'], run: false, lang: 'dockerfile' },
          { p: 'Por que o multi-stage não reduziu nada aqui?' }
        ],
        options: [
          { text: 'O segundo estágio ainda parte de <code>node:22-alpine</code> completo, e ainda traz o <code>node_modules</code> inteiro (inclusive dependências de desenvolvimento) via <code>COPY --from</code>. Multi-stage só reduz quando o estágio final é enxuto e recebe só o necessário.', correct: true },
          { text: 'Falta usar <code>--target</code> no <code>docker build</code>.', why: '<code>--target</code> escolhe em qual estágio parar; sem ele, o build já usa o último estágio — que é justamente o problema aqui.' },
          { text: '<code>COPY --from</code> só pode ser usado uma vez por Dockerfile.', why: 'Pode ser usado quantas vezes for preciso, em instruções <code>COPY</code> diferentes, como no próprio exemplo.' },
          { text: 'Os estágios precisam ser numerados, não nomeados com <code>AS</code>.', why: 'Nomear com <code>AS</code> é só uma questão de legibilidade; não influencia o tamanho da imagem final.' }
        ],
        explain: 'A imagem final é só o último estágio — mas "último estágio" continua sendo uma imagem inteira se a base dele for pesada. O ganho de tamanho vem de terminar em uma base enxuta (como <code>nginx:alpine</code>) e copiar apenas os artefatos prontos, sem <code>node_modules</code> nem ferramentas de build.'
      },
      {
        id: 'td7-3-b', kind: 'desafio', title: 'Transformar em multi-stage',
        body: [
          { p: 'O projeto em <code>~/site</code> tem um Dockerfile de estágio único: ele usa Node para gerar a pasta <code>dist/</code> e depois serve com o próprio Node. A imagem carrega tudo.' },
          { p: 'Reescreva o Dockerfile como multi-stage:' },
          { ul: [
            'um estágio chamado <code>construcao</code>, baseado em <code>node:22-alpine</code>, que rode <code>npm run build</code>;',
            'um estágio final baseado em <code>nginx:alpine</code>, que receba a pasta <code>/src/dist</code> do primeiro estágio em <code>/usr/share/nginx/html</code>;',
            'a imagem final não pode ter o <code>node</code> instalado.'
          ] },
          { p: 'Construa como <code>site:2.0</code>, suba um container chamado <code>site</code> na porta 8085 e confirme que a página responde.' }
        ],
        hints: [
          'Nomeie o primeiro estágio com <code>FROM node:22-alpine AS construcao</code>.',
          'O segundo estágio começa com outro <code>FROM</code>, e traz o artefato com <code>COPY --from=construcao /src/dist /usr/share/nginx/html</code>.',
          'Para provar que o node não está na imagem final: <code>docker run --rm site:2.0 which node</code> não deve encontrar nada.'
        ],
        solution: '<pre>$ cd ~/site\n$ cat &gt; Dockerfile &lt;&lt;\'FIM\'\n# syntax=docker/dockerfile:1\nFROM node:22-alpine AS construcao\nWORKDIR /src\nCOPY package.json ./\nRUN npm install\nCOPY . .\nRUN npm run build\n\nFROM nginx:alpine\nCOPY --from=construcao /src/dist /usr/share/nginx/html\nEXPOSE 80\nFIM\n$ docker build -t site:2.0 .\n$ docker run -d --name site -p 8085:80 site:2.0\n$ curl -s localhost:8085</pre>',
        check: async (ctx) => {
          const df = D.dockerfile(ctx, '/home/aluno/site/Dockerfile');
          const img = D.imagem(ctx, 'site:2.0');
          const resp = D.http(ctx, 'localhost', 8085, '/');
          const temNode = D.container(ctx, 'site')
            ? D.existeNoContainer(ctx, 'site', '/usr/local/bin/node') || D.existeNoContainer(ctx, 'site', '/usr/bin/node')
            : null;
          const froms = df && !df.erro ? df.instrucoes.filter(i => i.nome === 'FROM') : [];
          return H.checkAll([
            [() => df !== null && !df.erro, () => 'O Dockerfile tem um problema: ' + ((df && df.erro) || 'não foi encontrado')],
            [() => froms.length >= 2, () => `O Dockerfile tem ${froms.length} <code>FROM</code>. Multi-stage precisa de pelo menos dois.`],
            [() => froms.some(f => /AS\s+construcao/i.test(f.arg)), 'O primeiro estágio precisa se chamar <code>construcao</code> (<code>FROM node:22-alpine AS construcao</code>).'],
            [() => /nginx/.test(froms[froms.length - 1].arg), 'O último estágio precisa ser baseado em <code>nginx:alpine</code>.'],
            [() => df.instrucoes.some(i => i.nome === 'COPY' && /--from=construcao/.test(i.arg)),
              'Falta o <code>COPY --from=construcao</code> trazendo o artefato para a imagem final.'],
            [() => !!img, 'A imagem <code>site:2.0</code> ainda não foi construída.'],
            [() => !!D.container(ctx, 'site'), 'Suba um container chamado <code>site</code> a partir da imagem.'],
            [() => D.rodando(ctx, 'site'), 'O container <code>site</code> precisa estar em execução.'],
            [() => D.publicada(ctx, 'site', 8085), 'Publique a porta 8085 do servidor para a 80 do container.'],
            [() => !!resp && resp.status === 200 && /Site construido/.test(resp.body || ''),
              'A porta 8085 ainda não devolve a página construída. Confira se o <code>COPY --from</code> levou o conteúdo para <code>/usr/share/nginx/html</code>.'],
            [() => temNode === false,
              'A imagem final ainda tem o <code>node</code> dentro — sinal de que o último estágio não é o nginx, ou que o <code>COPY --from</code> não está sendo usado.']
          ]);
        }
      }
    ]
  });
})();
