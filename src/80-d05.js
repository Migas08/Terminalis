/* =========================================================================
   MÓDULO D05 — Imagens, camadas e registries
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 5.1 ============================== */
  LX.lesson('d05', {
    id: 'ld5-1', n: '5.1', title: 'Camadas, Image ID e digest',
    goal: 'Entender como uma imagem é montada por dentro e o que cada identificador significa.',
    body: [
      { h2: 'Uma imagem é uma pilha' },
      { p: 'Cada instrução de um Dockerfile que muda o sistema de arquivos gera uma <strong>camada</strong>: um conjunto somente leitura de arquivos, guardando apenas a diferença em relação à camada anterior.' },
      { code: ['$ docker pull nginx:alpine', '$ docker history nginx:alpine'] },
      { p: 'A leitura é de baixo para cima: a linha de baixo é a base, a de cima é a última instrução. As linhas com <code>&lt;missing&gt;</code> não são erro — camadas intermediárias não recebem id próprio quando a imagem vem pronta do registry.' },
      {
        table: {
          head: ['Coluna do history', 'O que diz'],
          rows: [
            ['<code>IMAGE</code>', 'o id da camada, quando existe'],
            ['<code>CREATED BY</code>', 'a instrução do Dockerfile que a gerou'],
            ['<code>SIZE</code>', 'quanto essa camada acrescentou'],
            ['<code>0B</code>', 'a instrução só mudou metadado (ENV, CMD, LABEL), sem tocar em arquivo']
          ]
        }
      },
      {
        box: 'key', label: 'Camada só cresce', body: [
          { p: 'Uma camada nunca diminui. Se uma instrução cria um arquivo de 200 MB e a instrução seguinte o apaga, a imagem continua com 200 MB: a primeira camada guarda o arquivo, e a segunda guarda apenas a marca de que ele foi removido.' },
          { p: 'É por isso que <code>RUN apt-get update</code> em uma linha e <code>RUN rm -rf /var/lib/apt/lists/*</code> em outra <strong>não</strong> reduz nada. Tem que estar no mesmo <code>RUN</code>. Voltamos a isso no módulo de build.' }
        ]
      },

      { h2: 'Compartilhamento entre imagens' },
      { code: ['$ docker pull nginx:alpine', '$ docker pull redis:alpine', '$ docker images', '$ docker system df'] },
      { p: 'Some os tamanhos de <code>docker images</code> e compare com o que o <code>docker system df</code> reporta. A soma é maior — porque as duas imagens compartilham a camada base do Alpine, que existe uma vez só no disco.' },
      { code: ['$ docker system df -v | head -20'] },
      { p: 'O modo detalhado tem as colunas <code>SHARED SIZE</code> e <code>UNIQUE SIZE</code>. A segunda é o que você realmente libera ao remover aquela imagem.' },

      { h2: 'Os três identificadores' },
      {
        table: {
          head: ['Identificador', 'Exemplo', 'Característica'],
          rows: [
            ['<strong>Tag</strong>', '<code>nginx:1.27-alpine</code>', 'nome legível, escolhido por quem publica. <strong>Pode ser reapontado</strong>'],
            ['<strong>Image ID</strong>', '<code>sha256:9c7a54a9a39d…</code>', 'identidade local, calculada a partir da configuração e das camadas'],
            ['<strong>Digest</strong>', '<code>nginx@sha256:1e8b3f…</code>', 'identidade no registry, imutável: aquele conteúdo exato']
          ]
        }
      },
      { code: ['$ docker images --digests | head -5',
        '$ docker image inspect nginx:alpine --format "{{.Id}}"',
        '$ docker image inspect nginx:alpine --format "{{json .RepoDigests}}"'] },
      {
        box: 'warn', label: 'Tag não é garantia de conteúdo', body: [
          { p: 'A tag é um ponteiro. Quem publica a imagem pode apontar <code>1.27-alpine</code> para um conteúdo novo amanhã. Você faz <code>docker pull</code> na mesma tag e recebe uma imagem diferente.' },
          { p: 'Quando a reprodutibilidade importa de verdade — auditoria, conformidade, um deploy que precisa ser idêntico ao que foi testado — a referência é o digest:' },
          { code: ['docker pull nginx@sha256:1e8b3f...'], run: false, lang: 'bash' },
          { p: 'Isso é imutável por construção: o digest <em>é</em> o hash do conteúdo.' }
        ]
      },

      { h2: 'latest não quer dizer "a mais recente"' },
      { p: 'Esta é a confusão mais cara do Docker. <code>latest</code> é apenas <strong>a tag que o Docker assume quando você não escreve nenhuma</strong>. Nada mais.' },
      {
        ul: [
          'Não é atualizada sozinha.',
          'Não aponta necessariamente para a versão mais nova — muitos projetos deixam <code>latest</code> parada há anos.',
          'Pode nem existir: há imagens que só publicam versões explícitas.'
        ]
      },
      {
        box: 'key', label: 'A regra', body: [
          { p: 'Em produção, <strong>nunca</strong> use <code>latest</code>. Fixe a versão: <code>nginx:1.27-alpine</code>, <code>mariadb:11.4</code>, <code>node:22-alpine</code>.' },
          { p: 'O motivo não é estética: com <code>latest</code>, dois servidores que subiram a stack em semanas diferentes podem estar rodando versões diferentes — e você não tem como saber qual, nem como voltar atrás.' }
        ]
      },

      { h2: 'Imagens oficiais' },
      { p: 'No Docker Hub, imagens sem namespace (<code>nginx</code>, <code>mariadb</code>, <code>node</code>) estão no namespace <code>library</code> e são as <strong>oficiais</strong>: mantidas com a participação da Docker, documentadas e atualizadas. Imagens com namespace (<code>bitnami/postgresql</code>, <code>traefik/whoami</code>) são de terceiros.' },
      { p: 'Uma imagem oficial costuma oferecer várias variantes da mesma versão:' },
      {
        table: {
          head: ['Sufixo', 'O que significa'],
          rows: [
            ['<code>22</code>', 'base Debian completa — maior, com todas as ferramentas'],
            ['<code>22-slim</code>', 'Debian enxuto — sem documentação e ferramentas de desenvolvimento'],
            ['<code>22-alpine</code>', 'base Alpine — a menor, mas com libc diferente (musl)'],
            ['<code>22-bookworm</code>', 'versão explícita da distribuição base']
          ]
        }
      },
      {
        box: 'note', label: 'Alpine nem sempre é a escolha certa', body: [
          { p: 'Alpine usa <strong>musl libc</strong> em vez da <strong>glibc</strong>. A maioria das aplicações não nota, mas binários compilados para glibc podem simplesmente não rodar, e algumas linguagens têm diferenças de desempenho conhecidas. Quando surgir um erro estranho e específico de Alpine, testar em <code>-slim</code> é um diagnóstico rápido.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Camadas só crescem: apagar em outra instrução não reduz a imagem.',
          'Imagens compartilham camadas; por isso a soma dos tamanhos engana.',
          'Tag é ponteiro; digest é conteúdo.',
          '<code>latest</code> é só um padrão de nome — fixe versões em produção.',
          'Imagens oficiais vivem em <code>library</code> e têm variantes por tamanho.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td5-1-a', kind: 'guiado', title: 'Ver as camadas e o compartilhamento',
        body: [
          { code: ['$ docker pull nginx:alpine', '$ docker pull redis:alpine',
            '$ docker images', '$ docker history nginx:alpine', '$ docker system df', '$ docker system df -v | head -12'] },
          { p: 'Compare a soma da coluna SIZE do <code>docker images</code> com o total do <code>docker system df</code>.' }
        ],
        hints: ['As duas imagens são Alpine: elas dividem a camada base.'],
        solution: '<pre>$ docker pull nginx:alpine\n$ docker pull redis:alpine\n$ docker images\n$ docker history nginx:alpine\n$ docker system df\n$ docker system df -v | head -12</pre>',
        check: async (ctx) => H.checkAll([
          [() => !!D.imagem(ctx, 'nginx:alpine'), 'Baixe a imagem com <code>docker pull nginx:alpine</code>.'],
          [() => !!D.imagem(ctx, 'redis:alpine'), 'Baixe também <code>redis:alpine</code>.'],
          [() => H.usedCommand(ctx, /docker\s+history/), 'Veja as camadas com <code>docker history nginx:alpine</code>.'],
          [() => H.usedCommand(ctx, /docker\s+system\s+df/), 'Compare com <code>docker system df</code>.']
        ])
      },
      {
        id: 'td5-1-q', kind: 'quiz', title: 'Por que a imagem não emagreceu',
        body: [
          { p: 'Alguém tenta reduzir uma imagem assim:' },
          { code: ['FROM debian:bookworm-slim', 'RUN apt-get update && apt-get install -y build-essential', 'RUN apt-get purge -y build-essential && apt-get autoremove -y'], run: false, lang: 'dockerfile' },
          { p: 'A imagem final continua com centenas de megabytes. Por quê?' }
        ],
        options: [
          { text: 'Cada <code>RUN</code> gera uma camada. A primeira guarda os arquivos instalados; a segunda apenas anota que foram removidos. As duas continuam na imagem, e o tamanho é a soma.', correct: true },
          { text: 'O <code>apt-get purge</code> não remove os arquivos de verdade.', why: 'Remove sim, dentro daquela camada. O problema é que a camada anterior, com os arquivos, continua existindo na pilha.' },
          { text: 'Faltou <code>--no-install-recommends</code>.', why: 'Ajuda a instalar menos, mas não resolve o problema estrutural das camadas.' },
          { text: 'A base <code>bookworm-slim</code> já é grande demais.', why: 'A <code>slim</code> tem cerca de 75 MB. Os "centenas de megabytes" vieram do <code>build-essential</code> que ficou preso na primeira camada.' }
        ],
        explain: 'A regra é: <strong>o que precisa desaparecer tem que ser removido na mesma instrução que criou</strong>. A correção é juntar tudo em um <code>RUN</code> só, com <code>&amp;&amp;</code>. Mas quando existe uma etapa de compilação, a solução realmente boa é outra: um <em>multi-stage build</em>, em que o compilador vive em um estágio que não vai para a imagem final. É o assunto do módulo de build.'
      },
      {
        id: 'td5-1-b', kind: 'desafio', title: 'Comparar os Image IDs de duas imagens',
        body: [
          { p: 'Baixe as imagens <code>nginx:alpine</code> e <code>redis:7-alpine</code>. Grave em <code>~/imagens.txt</code>, uma por linha e nessa ordem, o Image ID completo de cada uma.' },
          { p: 'Depois, confira que os dois ids no arquivo são diferentes: cada imagem tem a própria identidade local, mesmo compartilhando a camada base do Alpine.' }
        ],
        hints: [
          'O Image ID de uma imagem aparece em <code>docker image inspect NOME --format "{{.Id}}"</code>.',
          'Redirecione a saída do primeiro comando com <code>&gt;</code> e a do segundo com <code>&gt;&gt;</code>, para acumular no mesmo arquivo.'
        ],
        solution: '<pre>$ docker pull nginx:alpine\n$ docker pull redis:7-alpine\n$ docker image inspect nginx:alpine --format "{{.Id}}" &gt; ~/imagens.txt\n$ docker image inspect redis:7-alpine --format "{{.Id}}" &gt;&gt; ~/imagens.txt\n$ cat ~/imagens.txt</pre>',
        check: async (ctx) => {
          const nginx = D.imagem(ctx, 'nginx:alpine'), redis = D.imagem(ctx, 'redis:7-alpine');
          const texto = H.read(ctx, '/home/aluno/imagens.txt');
          const linhas = texto ? texto.trim().split('\n').filter(Boolean).map(l => l.trim()) : [];
          return H.checkAll([
            [() => !!nginx, 'Baixe <code>nginx:alpine</code> com <code>docker pull</code>.'],
            [() => !!redis, 'Baixe também <code>redis:7-alpine</code>.'],
            [() => texto !== null, 'Grave os dois Image IDs em <code>~/imagens.txt</code>.'],
            [() => linhas.length === 2, () => `O arquivo tem ${linhas.length} linha(s); precisa ter exatamente duas.`],
            [() => !!nginx && linhas[0] === nginx.id, () => `A primeira linha precisa ser o Image ID de <code>nginx:alpine</code> (<code>${nginx ? nginx.id : '?'}</code>), pego com <code>docker image inspect --format "{{.Id}}"</code>.`],
            [() => !!redis && linhas[1] === redis.id, () => `A segunda linha precisa ser o Image ID de <code>redis:7-alpine</code> (<code>${redis ? redis.id : '?'}</code>).`],
            [() => linhas[0] !== linhas[1], 'Os dois ids ficaram iguais no arquivo. Confira se pegou o id de cada imagem separadamente.']
          ]);
        }
      }
    ]
  });

  /* ============================== 5.2 ============================== */
  LX.lesson('d05', {
    id: 'ld5-2', n: '5.2', title: 'pull, tag, rmi e o ciclo do registry',
    goal: 'Gerenciar imagens locais e entender o caminho entre a sua máquina e um registry.',
    body: [
      { h2: 'O ciclo completo' },
      {
        ascii: `código  →  Dockerfile  →  docker build  →  imagem local
                                            │
                                    docker tag (dá um nome de registry)
                                            │
                                    docker push
                                            ▼
                                       ┌──────────┐
                                       │ registry │
                                       └────┬─────┘
                                    docker pull
                                            ▼
                                    servidor de produção
                                            │
                                    docker run / compose up`
      },

      { h2: 'docker tag: dar outro nome à mesma imagem' },
      { code: ['$ docker pull alpine:3.21',
        '$ docker tag alpine:3.21 minha-base:v1',
        '$ docker images | grep -E "alpine|minha-base"'] },
      { p: 'Repare que o <code>IMAGE ID</code> é o mesmo nas duas linhas. <code>tag</code> não copia nada: cria mais um nome apontando para a mesma imagem. Custa zero bytes.' },
      { p: 'É assim que se prepara uma imagem para um registry: o nome precisa começar com o endereço dele.' },
      { code: ['$ docker tag minha-api:1.4.2 registro.exemplo.test:5000/equipe/minha-api:1.4.2'], run: false, lang: 'bash' },

      { h2: 'docker rmi: remover' },
      { code: ['$ docker rmi minha-base:v1', '$ docker images | grep alpine'] },
      { p: 'A imagem <code>alpine:3.21</code> continua lá. O <code>rmi</code> de uma tag quando existem outras apenas <strong>desmarca</strong>: aparece <code>Untagged:</code> e nenhum <code>Deleted:</code>. Só quando some a última referência é que as camadas são apagadas.' },
      { p: 'E o daemon protege as imagens em uso:' },
      { code: ['Error response from daemon: conflict: unable to remove repository reference "nginx:alpine" (must force) - container a1b2c3 is using its referenced image'], run: false, lang: 'text' },
      { p: 'A saída indica o container culpado. O <code>-f</code> força, mas a atitude correta quase sempre é remover o container antes.' },

      { h2: 'Imagens órfãs' },
      { p: 'Quando você reconstrói uma imagem com a mesma tag, a versão antiga perde o nome e vira <code>&lt;none&gt;:&lt;none&gt;</code>: uma imagem <em>dangling</em>.' },
      { code: ['$ docker images -f dangling=true', '$ docker image prune -f'] },
      { p: 'Em um servidor de deploy frequente, essas órfãs são a principal causa de disco cheio. O <code>docker image prune</code> remove só as órfãs; o <code>-a</code> remove <strong>toda</strong> imagem que não esteja sendo usada por algum container — bem mais agressivo.' },

      { h2: 'login e push' },
      { code: ['$ echo "$TOKEN_DO_REGISTRY" | docker login registro.exemplo.test -u equipe --password-stdin'], run: false, lang: 'bash' },
      {
        box: 'warn', label: 'Nunca passe a senha na linha de comando', body: [
          { p: '<code>docker login -u user -p senha</code> deixa a credencial no histórico do shell, na lista de processos e nos logs de auditoria. O próprio Docker emite um aviso quando você faz isso.' },
          { p: 'Use <code>--password-stdin</code>, lendo de uma variável de ambiente ou de um gerenciador de segredos. E prefira <em>token de acesso</em> a senha: um token pode ser revogado sozinho, com escopo limitado.' },
          { p: 'As credenciais ficam em <code>~/.docker/config.json</code>, em base64 — que <strong>não é criptografia</strong>. Em servidor compartilhado, isso importa.' }
        ]
      },
      { code: ['$ docker push registro.exemplo.test:5000/equipe/minha-api:1.4.2'], run: false, lang: 'bash' },
      { p: 'O push envia camada por camada, e pula as que o registry já tem. Por isso a segunda publicação de uma imagem grande costuma ser muito mais rápida que a primeira.' },

      { h2: 'Versionamento de tags' },
      { p: 'Uma convenção que funciona bem em equipe: publicar a mesma imagem com várias tags.' },
      { code: ['$ docker tag app:build registro.exemplo.test/equipe/app:1.4.2',
        '$ docker tag app:build registro.exemplo.test/equipe/app:1.4',
        '$ docker tag app:build registro.exemplo.test/equipe/app:producao'], run: false, lang: 'bash' },
      {
        ul: [
          '<code>1.4.2</code> — imutável, é a que vai no arquivo de deploy',
          '<code>1.4</code> — acompanha as correções da linha',
          '<code>producao</code> — ponteiro móvel para o que está no ar'
        ]
      },
      { p: 'Uma tag adicional útil é o hash do commit: <code>app:git-9c7a54a</code> liga a imagem ao código exato que a gerou.' },

      { h2: 'Segurança das imagens' },
      {
        ul: [
          '<strong>De onde veio?</strong> Prefira imagens oficiais ou do próprio fornecedor. Uma imagem qualquer do Hub pode conter o que o autor quiser.',
          '<strong>Está atualizada?</strong> Imagem antiga carrega vulnerabilidades antigas do sistema base. Reconstruir periodicamente é manutenção, não capricho.',
          '<strong>Tem segredo dentro?</strong> Um <code>ARG SENHA</code> usado no build fica visível em <code>docker history</code>. Segredo não entra em imagem.',
          '<strong>É a que você acha que é?</strong> Em cadeias sensíveis, referencie por digest.'
        ]
      },
      { code: ['$ docker history minha-api:1.0 --no-trunc | head -5'], run: false, lang: 'bash' },
      { p: 'Esse comando revela todos os argumentos de build. Vale rodá-lo em qualquer imagem que você publique, só para conferir o que ficou registrado.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>tag</code> cria nome, não cópia — mesmo Image ID.',
          '<code>rmi</code> de uma tag entre várias só desmarca.',
          'Imagens <code>&lt;none&gt;</code> são órfãs de rebuild; <code>image prune</code> resolve.',
          '<code>--password-stdin</code> sempre; token em vez de senha.',
          'Publique com várias tags, incluindo uma imutável.',
          '<code>docker history --no-trunc</code> mostra o que ficou gravado na imagem.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td5-2-a', kind: 'guiado', title: 'Tag, ID e remoção',
        body: [
          { code: ['$ docker pull alpine:3.21',
            '$ docker images -q alpine:3.21',
            '$ docker tag alpine:3.21 minha-base:v1',
            '$ docker images -q minha-base:v1',
            '$ docker rmi minha-base:v1',
            '$ docker images | grep alpine'] },
          { p: 'Os dois <code>docker images -q</code> devolvem o mesmo id. E, no fim, a <code>alpine</code> continua lá.' }
        ],
        hints: ['O <code>-q</code> mostra só o ID, o que facilita a comparação.'],
        solution: '<pre>$ docker pull alpine:3.21\n$ docker images -q alpine:3.21\n$ docker tag alpine:3.21 minha-base:v1\n$ docker images -q minha-base:v1\n$ docker rmi minha-base:v1\n$ docker images | grep alpine</pre>',
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+tag/), 'Crie a tag adicional com <code>docker tag alpine:3.21 minha-base:v1</code>.'],
          [() => H.usedCommand(ctx, /docker\s+rmi|docker\s+image\s+rm/), 'Remova a tag extra com <code>docker rmi minha-base:v1</code>.'],
          [() => !D.imagem(ctx, 'minha-base:v1'), 'A tag <code>minha-base:v1</code> ainda existe — remova com <code>docker rmi</code>.'],
          [() => !!D.imagem(ctx, 'alpine:3.21'), 'A imagem <code>alpine:3.21</code> deveria continuar existindo: remover uma tag entre várias só desmarca.']
        ])
      },
      {
        id: 'td5-2-q', kind: 'quiz', title: 'De onde vêm as imagens <none>',
        body: [
          { p: 'O servidor de deploy está com o disco quase cheio, e <code>docker images</code> mostra várias entradas com <code>REPOSITORY</code> e <code>TAG</code> iguais a <code>&lt;none&gt;</code>. De onde vêm essas imagens, e qual comando as remove sem tocar em nenhuma imagem que ainda tem nome?' }
        ],
        options: [
          { text: 'São imagens <em>dangling</em>: versões antigas que perderam a tag quando a mesma tag foi reconstruída e reaplicada sobre um conteúdo novo. <code>docker image prune</code> remove só essas, sem mexer em nenhuma imagem com nome.', correct: true },
          { text: 'São imagens corrompidas por uma falha no pull; a correção é baixar de novo com <code>docker pull --force</code>.', why: 'Não existe corrupção nem essa flag. A causa é a tag antiga soltando a referência quando a mesma tag é reconstruída em cima de um conteúdo diferente.' },
          { text: 'São restos de containers já removidos; o comando certo é <code>docker rmi -a</code>.', why: 'A causa não tem relação com containers removidos, e <code>-a</code> não é uma flag válida de <code>docker rmi</code> para essa limpeza.' },
          { text: 'É normal e só dá para limpar com <code>docker system prune -a</code>, mesmo que isso remova imagens nomeadas não usadas.', why: '<code>docker image prune</code> (sem <code>-a</code>) já resolve exatamente esse caso, sem o efeito colateral agressivo do <code>-a</code>, que também apaga imagens nomeadas que não estão em uso.' }
        ],
        explain: 'Toda vez que uma tag é reconstruída, a imagem antiga que tinha aquele nome perde a referência e vira <code>&lt;none&gt;:&lt;none&gt;</code> — uma órfã de rebuild. Em um servidor com deploy frequente, elas se acumulam e são a causa nº 1 de disco cheio. <code>docker image prune</code> limpa exatamente as órfãs; o <code>-a</code> vai bem mais longe, removendo qualquer imagem sem container usando-a, nomeada ou não.'
      },
      {
        id: 'td5-2-b', kind: 'desafio', title: 'Preparar uma imagem para o registry',
        body: [
          { p: 'A equipe usa o registry fictício <code>registro.exemplo.test:5000</code> e o namespace <code>infra</code>. Você precisa preparar a imagem <code>nginx:alpine</code> para publicação como o web básico da equipe, na versão <code>1.0.0</code>.' },
          { ol: [
            'Crie a tag <code>registro.exemplo.test:5000/infra/web:1.0.0</code>.',
            'Crie também a tag móvel <code>registro.exemplo.test:5000/infra/web:producao</code>.',
            'Confirme que as três referências (a original e as duas novas) apontam para o <strong>mesmo</strong> Image ID.',
            'Grave os três nomes, um por linha, em <code>~/tags.txt</code>.'
          ] }
        ],
        hints: [
          'O nome completo de uma imagem em registry próprio é <code>host:porta/namespace/repositorio:tag</code>.',
          '<code>docker tag nginx:alpine registro.exemplo.test:5000/infra/web:1.0.0</code>.',
          'Para listar: <code>docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "nginx:alpine|infra/web"</code>.'
        ],
        solution: '<pre>$ docker pull nginx:alpine\n$ docker tag nginx:alpine registro.exemplo.test:5000/infra/web:1.0.0\n$ docker tag nginx:alpine registro.exemplo.test:5000/infra/web:producao\n$ docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "^nginx:alpine$|infra/web" &gt; ~/tags.txt\n$ cat ~/tags.txt</pre>',
        check: async (ctx) => {
          const base = D.imagem(ctx, 'nginx:alpine');
          const v = D.imagem(ctx, 'registro.exemplo.test:5000/infra/web:1.0.0');
          const p = D.imagem(ctx, 'registro.exemplo.test:5000/infra/web:producao');
          const texto = H.read(ctx, '/home/aluno/tags.txt') || '';
          const linhas = texto.trim().split('\n').map(l => l.trim()).filter(Boolean);
          return H.checkAll([
            [() => !!base, 'A imagem <code>nginx:alpine</code> precisa existir na máquina. Baixe com <code>docker pull nginx:alpine</code>.'],
            [() => !!v, 'Falta a tag <code>registro.exemplo.test:5000/infra/web:1.0.0</code>.'],
            [() => !!p, 'Falta a tag <code>registro.exemplo.test:5000/infra/web:producao</code>.'],
            [() => !!v && !!p && v.id === base.id && p.id === base.id,
              'As tags novas apontam para imagens diferentes. Use <code>docker tag</code> a partir de <code>nginx:alpine</code> — não construa nada novo.'],
            [() => linhas.length === 3, () => `O arquivo <code>~/tags.txt</code> tem ${linhas.length} linha(s); precisa ter as três referências.`],
            [() => linhas.some(l => /infra\/web:1\.0\.0$/.test(l)) && linhas.some(l => /infra\/web:producao$/.test(l)) && linhas.some(l => /nginx:alpine$/.test(l)),
              'O arquivo precisa conter as três referências: <code>nginx:alpine</code> e as duas do registry.']
          ]);
        }
      }
    ]
  });
})();
