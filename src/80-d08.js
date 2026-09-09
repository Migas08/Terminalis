/* =========================================================================
   MÓDULO D08 — Volumes e persistência
   Onde os dados moram de verdade, e por que apagar o container não é
   apagar os dados.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 8.1 ============================== */
  LX.lesson('d08', {
    id: 'ld8-1', n: '8.1', title: 'A camada gravável é descartável',
    goal: 'Ver com os próprios olhos que dados dentro do container somem, e conhecer as três formas de persistir.',
    setup: (m) => {
      LX.D.pasta(m, '/home/aluno/portfolio');
      LX.D.arquivo(m, '/home/aluno/portfolio/index.html', '<h1>portfolio inicial</h1>\n');
    },
    body: [
      { h2: 'A demonstração que assusta' },
      { code: ['$ docker run -d --name efemero -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja mariadb:11.4',
        '$ docker exec efemero mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE clientes (id INT PRIMARY KEY, nome VARCHAR(50)); INSERT INTO clientes VALUES (1, \'ana\');"',
        '$ docker exec efemero mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM clientes;"',
        '$ docker rm -f efemero',
        '$ docker run -d --name efemero -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja mariadb:11.4',
        '$ docker exec efemero mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM clientes;"'] },
      { p: 'A última linha responde <em>Table \'loja.clientes\' doesn\'t exist</em>. Os dados não estavam "no MariaDB": estavam na <strong>camada gravável daquele container</strong>, que foi apagada junto com ele.' },
      {
        box: 'warn', label: 'Isso não é um caso extremo', body: [
          { p: 'Containers são recriados o tempo todo: em toda atualização de imagem, em toda mudança de configuração, em todo <code>docker compose up</code> que muda algum parâmetro. Um banco sem volume perde tudo no primeiro deploy.' }
        ]
      },

      { h2: 'As três formas de persistir' },
      {
        table: {
          head: ['', 'Volume nomeado', 'Bind mount', 'tmpfs'],
          rows: [
            ['Onde fica', 'gerenciado pelo Docker, em <code>/var/lib/docker/volumes/</code>', 'em um caminho do servidor escolhido por você', 'na memória RAM'],
            ['Sobrevive ao container', 'sim', 'sim', '<strong>não</strong>'],
            ['Quem cria', 'o Docker', 'você', 'o Docker'],
            ['Portabilidade', 'alta: só o nome importa', 'baixa: depende do caminho existir', '—'],
            ['Uso típico', 'dados de banco, uploads', 'código em desenvolvimento, arquivo de configuração', 'segredos e temporários'],
            ['Sintaxe', '<code>-v dados:/var/lib/mysql</code>', '<code>-v ./site:/usr/share/nginx/html</code>', '<code>--tmpfs /tmp</code>']
          ]
        }
      },
      {
        ascii: `        CONTAINER
   ┌──────────────────────────┐
   │  camada gravável         │ ← some com o container
   ├──────────────────────────┤
   │  /var/lib/mysql  ────────┼──▶ VOLUME  /var/lib/docker/volumes/dados/_data
   │  /app/site       ────────┼──▶ BIND    /home/aluno/site
   │  /tmp            ────────┼──▶ TMPFS   (RAM, some junto)
   ├──────────────────────────┤
   │  camadas da imagem       │ ← somente leitura
   └──────────────────────────┘`
      },

      { h2: 'Volume nomeado: o padrão para dados' },
      { code: ['$ docker volume create dados-loja',
        '$ docker volume ls',
        '$ docker volume inspect dados-loja',
        '$ docker run -d --name banco -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja -v dados-loja:/var/lib/mysql mariadb:11.4'] },
      { p: 'Não é preciso criar antes: se o volume não existir, o <code>docker run</code> cria. Criar explicitamente é melhor em script, porque deixa a intenção clara.' },
      { p: 'E o volume é um diretório de verdade no servidor. Você pode olhar:' },
      { code: ['$ docker volume inspect dados-loja --format "{{.Mountpoint}}"', '$ sudo ls -la /var/lib/docker/volumes/dados-loja/_data'] },
      {
        box: 'key', label: 'É por isso que o dado sobrevive', body: [
          { p: 'O caminho <code>/var/lib/mysql</code> <em>dentro</em> do container é uma montagem apontando para um diretório <em>fora</em> dele. Quando o container é destruído, o diretório continua no disco do servidor. O próximo container que montar o mesmo volume encontra tudo lá.' }
        ]
      },

      { h2: 'Bind mount: um caminho seu' },
      { code: ['$ mkdir -p ~/site && echo "<h1>meu site</h1>" > ~/site/index.html',
        '$ docker run -d --name web -p 8080:80 -v ~/site:/usr/share/nginx/html:ro nginx:alpine',
        '$ curl -s localhost:8080',
        '$ echo "<h1>editado sem reiniciar</h1>" > ~/site/index.html',
        '$ curl -s localhost:8080'] },
      { p: 'A edição aparece na hora: é o mesmo arquivo, visto dos dois lados. É isso que torna o bind mount a ferramenta de desenvolvimento — você edita no editor e o container já serve a versão nova.' },
      { p: 'O <code>:ro</code> no fim monta somente leitura. Para configuração, é uma boa prática: o container não deveria poder alterar o próprio arquivo de config.' },
      {
        box: 'warn', label: 'Três armadilhas do bind mount', body: [
          {
            ol: [
              '<strong>Caminho relativo precisa de <code>./</code></strong>. <code>-v site:/app</code> cria um <em>volume chamado site</em>; <code>-v ./site:/app</code> monta a pasta. A diferença é uma barra e um ponto.',
              '<strong>Montar sobre um diretório o esconde.</strong> Se você montar uma pasta vazia sobre <code>/usr/share/nginx/html</code>, o conteúdo original da imagem desaparece — não é apagado, está coberto.',
              '<strong>O caminho tem que existir no servidor certo.</strong> Bind mount amarra o container à máquina. Em produção, isso torna a stack menos portátil que volumes nomeados.'
            ]
          }
        ]
      },
      { p: 'A forma longa, com <code>--mount</code>, é mais explícita e recusa origem inexistente em vez de criar um diretório vazio por engano:' },
      { code: ['$ docker run -d --name web2 -p 8081:80 \\',
        '    --mount type=bind,source=/home/aluno/site,target=/usr/share/nginx/html,readonly \\',
        '    nginx:alpine'], run: false, lang: 'bash' },
      {
        table: {
          head: ['', '<code>-v</code>', '<code>--mount</code>'],
          rows: [
            ['Sintaxe', 'curta, posicional', 'explícita, <code>chave=valor</code>'],
            ['Origem inexistente', '<strong>cria um diretório vazio</strong>', '<strong>falha com erro</strong>'],
            ['Legibilidade', 'menor', 'maior'],
            ['Situação', 'linha de comando rápida', 'script e produção']
          ]
        }
      },
      { p: 'Não existe "<code>-v</code> obsoleto": a documentação apenas recomenda <code>--mount</code> por ser mais claro. Os dois continuam suportados.' },

      { h2: 'tmpfs: na memória' },
      { code: ['$ docker run --rm --tmpfs /tmp:size=64m alpine sh -c \'echo teste > /tmp/x && ls -la /tmp\''] },
      { p: 'Some quando o container para, nunca toca o disco. Uso típico: diretório temporário de uma aplicação com <code>--read-only</code>, e material sensível que não deve ser gravado.' },

      { h2: 'Resumo' },
      {
        ul: [
          'A camada gravável morre com o container. Dado que importa precisa de volume.',
          'Volume nomeado: o Docker gerencia; é o padrão para dados de aplicação.',
          'Bind mount: um caminho seu; ideal em desenvolvimento e para arquivos de configuração.',
          'tmpfs: memória, some junto — para temporários e segredos.',
          '<code>-v</code> cria o que falta; <code>--mount</code> recusa e avisa.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td8-1-a', kind: 'guiado', title: 'Ver o dado sumir e depois sobreviver',
        body: [
          { p: 'Primeiro sem volume — e o dado se perde:' },
          { code: ['$ docker run -d --name b1 -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja mariadb:11.4',
            '$ docker exec b1 mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE t (id INT PRIMARY KEY); INSERT INTO t VALUES (1);"',
            '$ docker rm -f b1',
            '$ docker run -d --name b1 -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja mariadb:11.4',
            '$ docker exec b1 mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM t;"'] },
          { p: 'Agora com volume — e o dado fica:' },
          { code: ['$ docker rm -f b1',
            '$ docker run -d --name b2 -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja -v cofre:/var/lib/mysql mariadb:11.4',
            '$ docker exec b2 mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE t (id INT PRIMARY KEY); INSERT INTO t VALUES (1);"',
            '$ docker rm -f b2',
            '$ docker run -d --name b2 -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -v cofre:/var/lib/mysql mariadb:11.4',
            '$ docker exec b2 mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM t;"'] }
        ],
        hints: ['A diferença entre os dois blocos é uma única flag: <code>-v cofre:/var/lib/mysql</code>.'],
        solution: '<pre>$ docker run -d --name b2 -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja -v cofre:/var/lib/mysql mariadb:11.4\n$ docker exec b2 mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE t (id INT PRIMARY KEY); INSERT INTO t VALUES (1);"\n$ docker rm -f b2\n$ docker run -d --name b2 -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -v cofre:/var/lib/mysql mariadb:11.4\n$ docker exec b2 mariadb -uroot -pSENHA_DO_BANCO loja -N -B -e "SELECT * FROM t;"</pre>',
        check: async (ctx) => {
          const r = await D.exec(ctx, 'b2', 'mariadb -uroot -pSENHA_DO_BANCO loja -N -B -e "SELECT id FROM t;"');
          return H.checkAll([
            [() => !!D.volume(ctx, 'cofre'), 'Falta o volume <code>cofre</code>. Crie montando com <code>-v cofre:/var/lib/mysql</code>.'],
            [() => D.rodando(ctx, 'b2'), 'O container <code>b2</code> precisa estar em execução.'],
            [() => !!D.montagem(ctx, 'b2', '/var/lib/mysql'), 'O <code>b2</code> precisa montar o volume em <code>/var/lib/mysql</code>.'],
            [() => r.status === 0 && /1/.test(r.out),
              'O dado não sobreviveu. Confira se o volume foi montado <em>antes</em> de criar a tabela, e se o mesmo volume foi usado na recriação.']
          ]);
        }
      },
      {
        id: 'td8-1-q', kind: 'quiz', title: 'Qual dos três combina com este caso',
        body: [
          { p: 'Uma aplicação grava um arquivo de sessão temporário. Por segurança, ele não pode sobreviver a um reinício do container, e nunca deve tocar o disco do servidor. Qual mecanismo de persistência combina com isso?' }
        ],
        options: [
          { text: '<code>tmpfs</code>: fica só na RAM e some quando o container para — exatamente o comportamento desejado para um dado sensível e temporário.', correct: true },
          { text: 'Volume nomeado, porque o Docker cuida das permissões sozinho.', why: 'Volume nomeado sobrevive ao container — o oposto do que se quer aqui, que é o dado sumir ao reiniciar.' },
          { text: 'Bind mount somente leitura, com <code>:ro</code>.', why: 'A aplicação precisa <em>gravar</em> o arquivo; <code>:ro</code> impede a escrita. E bind mount grava no disco do servidor, o que o enunciado descarta.' },
          { text: 'Nenhum: deixar na camada gravável do próprio container.', why: 'Funcionaria por acaso, mas some também quando o container é apenas recriado com a mesma configuração — não é uma escolha deliberada, é fragilidade.' }
        ],
        explain: 'A tabela da aula resume: volume para o que precisa sobreviver, bind mount para um caminho seu, e <code>tmpfs</code> para o que é temporário e sensível — nunca deve tocar disco, e não precisa sobreviver a nada.'
      },
      {
        id: 'td8-1-b', kind: 'desafio', title: 'Servir o site do servidor, sem reconstruir imagem',
        body: [
          { p: 'Você tem uma pasta <code>~/portfolio</code> com um <code>index.html</code>. Sirva esse conteúdo com nginx, de forma que:' },
          { ul: [
            'o container se chame <code>portfolio</code> e responda na porta 8090 do servidor;',
            'a pasta do servidor seja montada dentro do container, <strong>somente leitura</strong>;',
            'editar o arquivo no servidor mude a página <strong>sem reiniciar</strong> o container.'
          ] },
          { p: 'Prove o último ponto: depois de subir, edite o arquivo para conter a palavra <code>atualizado</code> e confirme com <code>curl</code>.' }
        ],
        hints: [
          'A raiz do nginx é <code>/usr/share/nginx/html</code>.',
          'Bind mount somente leitura: <code>-v /home/aluno/portfolio:/usr/share/nginx/html:ro</code>.',
          'Depois de subir, um <code>echo "&lt;h1&gt;atualizado&lt;/h1&gt;" &gt; ~/portfolio/index.html</code> e um <code>curl localhost:8090</code> fecham o exercício.'
        ],
        solution: '<pre>$ docker run -d --name portfolio -p 8090:80 -v /home/aluno/portfolio:/usr/share/nginx/html:ro nginx:alpine\n$ curl -s localhost:8090\n$ echo "&lt;h1&gt;atualizado&lt;/h1&gt;" &gt; ~/portfolio/index.html\n$ curl -s localhost:8090</pre>',
        check: async (ctx) => {
          const mo = D.montagem(ctx, 'portfolio', '/usr/share/nginx/html');
          const resp = D.http(ctx, 'localhost', 8090, '/');
          const noHost = H.read(ctx, '/home/aluno/portfolio/index.html') || '';
          return H.checkAll([
            [() => D.rodando(ctx, 'portfolio'), 'O container <code>portfolio</code> precisa estar em execução.'],
            [() => D.publicada(ctx, 'portfolio', 8090), 'Publique a porta 8090 do servidor.'],
            [() => !!mo, 'Falta montar a pasta do servidor em <code>/usr/share/nginx/html</code>.'],
            [() => mo.tipo === 'bind', () => `A montagem está como <code>${mo.tipo}</code>. Aqui o objetivo é um <strong>bind mount</strong> da pasta do servidor: use um caminho começando com <code>/</code> ou <code>./</code>.`],
            [() => LX.FileSystem.normalize(mo.origem) === '/home/aluno/portfolio',
              () => `A origem montada é <code>${mo.origem}</code>, e deveria ser <code>/home/aluno/portfolio</code>.`],
            [() => mo.ro === true, 'A montagem precisa ser somente leitura — acrescente <code>:ro</code> no fim.'],
            [() => /atualizado/.test(noHost), 'Edite o <code>~/portfolio/index.html</code> para conter a palavra <code>atualizado</code>.'],
            [() => !!resp && resp.status === 200 && /atualizado/.test(resp.body || ''),
              'O <code>curl localhost:8090</code> ainda não devolve a página editada. Se o conteúdo do servidor já mudou e o container não vê, a montagem não está apontando para a pasta certa.']
          ]);
        }
      }
    ]
  });

  /* ============================== 8.2 ============================== */
  LX.lesson('d08', {
    id: 'ld8-2', n: '8.2', title: 'Permissões, backup e restauração',
    goal: 'Resolver o "permission denied" de volume e saber tirar e devolver um backup dos dados.',
    setup: (m) => {
      /* Um volume com conteúdo e um container que o monta: o desafio de
         backup precisa de dados reais para salvar e restaurar. */
      const e = m.docker;
      if (!e) return;
      LX.D.pasta(m, '/home/aluno/backups');
      if (!e.volumes.has('uploads')) {
        e.criarVolume('uploads');
        const ctx = m.ctxRoot();
        const dir = e.caminhoVolume('uploads');
        try {
          m.fs.writeFile(dir + '/relatorio.txt', 'relatorio mensal de setembro\ntotal de acessos: 18422\n', { ctx });
          m.fs.writeFile(dir + '/notas.txt', 'anotacoes da equipe\n', { ctx });
        } catch (err) { }
      }
      if (!e.containerPorNome('arquivos')) {
        LX.D.montar(m, {
          imagem: 'nginx:alpine', nome: 'arquivos',
          montagens: [{ tipo: 'volume', nome: 'uploads', destino: '/dados' }]
        });
      }
    },
    body: [
      { h2: 'O erro de permissão mais comum do Docker' },
      { p: 'A aplicação dentro do container roda com um UID. O diretório montado tem um dono no servidor. Se os dois não combinam, a aplicação não escreve — e a mensagem é a de sempre:' },
      { code: ['Error: EACCES: permission denied, open \'/app/dados/arquivo.txt\''], run: false, lang: 'text' },
      {
        box: 'key', label: 'A chave: o kernel só olha números', body: [
          { p: 'Permissão é comparação de UID e GID — <strong>números</strong>. O nome do usuário não atravessa a fronteira do container. Um usuário chamado <code>app</code> com UID 1000 dentro do container é, para o kernel, exatamente o mesmo que o <code>aluno</code> com UID 1000 no servidor.' },
          { p: 'Por isso o diagnóstico é sempre o mesmo par de comandos:' },
          { code: ['$ ls -ln /caminho/no/servidor', '$ docker exec container id'], run: false, lang: 'bash' },
          { p: 'O <code>-n</code> do <code>ls</code> mostra os números em vez dos nomes. Compare com o UID de dentro. Se forem diferentes e o modo não der permissão a "outros", está aí a causa.' }
        ]
      },
      { p: 'Três soluções, em ordem de preferência:' },
      {
        table: {
          head: ['Solução', 'Como', 'Quando'],
          rows: [
            ['Ajustar o dono no servidor', '<code>sudo chown -R 1000:1000 ~/dados</code>', 'quase sempre a certa: alinha os números'],
            ['Rodar o container com o UID do dono', '<code>-u $(id -u):$(id -g)</code>', 'quando o diretório precisa continuar sendo seu'],
            ['Usar volume nomeado em vez de bind', '<code>-v dados:/app/dados</code>', 'quando o caminho no servidor não importa — o Docker cuida das permissões']
          ]
        }
      },
      {
        box: 'warn', label: 'O que não fazer', body: [
          { p: '<code>chmod -R 777</code> resolve e cria um problema maior: qualquer processo do servidor passa a poder escrever ali. É a correção que aparece em fórum e que nenhuma revisão de segurança aceita.' }
        ]
      },

      { h2: 'Backup de um volume' },
      { p: 'Volume não tem um "docker volume backup". A técnica padrão é usar um container temporário que monta o volume e o diretório de destino ao mesmo tempo:' },
      { code: ['$ docker run --rm \\',
        '    -v dados-loja:/origem:ro \\',
        '    -v /home/aluno/backups:/destino \\',
        '    alpine tar -czf /destino/dados-loja.tar.gz -C /origem .'], run: false, lang: 'bash' },
      { p: 'Leia a linha inteira, ela é elegante:' },
      {
        ul: [
          '<code>--rm</code> — o container é descartável, existe só para essa tarefa',
          '<code>-v dados-loja:/origem:ro</code> — o volume entra somente leitura (o backup não pode alterar nada)',
          '<code>-v /home/aluno/backups:/destino</code> — a pasta do servidor onde o arquivo vai cair',
          '<code>tar -czf ... -C /origem .</code> — compacta o conteúdo; o <code>-C</code> evita que os caminhos comecem com <code>/origem</code>'
        ]
      },
      { p: 'A restauração é o mesmo movimento ao contrário:' },
      { code: ['$ docker run --rm \\',
        '    -v dados-loja:/destino \\',
        '    -v /home/aluno/backups:/origem:ro \\',
        '    alpine sh -c "cd /destino && tar -xzf /origem/dados-loja.tar.gz"'], run: false, lang: 'bash' },
      {
        box: 'warn', label: 'Pare o serviço antes de fazer backup de um banco', body: [
          { p: 'Copiar os arquivos de um banco <strong>em execução</strong> produz um backup possivelmente inconsistente: pode haver escrita no meio da cópia.' },
          { p: 'Para banco de dados, o backup correto é o <em>dump lógico</em> — <code>mariadb-dump</code> ou <code>pg_dump</code>, com o serviço no ar. É o assunto do módulo de banco de dados em container. O backup de volume é para dados que não são de banco: uploads, arquivos gerados, certificados.' }
        ]
      },

      { h2: 'Inspecionar e limpar' },
      { code: ['$ docker volume ls',
        '$ docker volume ls -f dangling=true',
        '$ docker volume inspect dados-loja',
        '$ docker system df -v | tail -10'] },
      { p: 'Um volume "dangling" é um que não está montado em nenhum container. Note: isso <strong>não</strong> quer dizer que ele é inútil — pode ser o volume do banco de um serviço que está parado agora.' },
      {
        box: 'warn', label: 'Os comandos que apagam dados', body: [
          {
            table: {
              head: ['Comando', 'O que apaga'],
              rows: [
                ['<code>docker volume rm NOME</code>', 'aquele volume, se não estiver em uso'],
                ['<code>docker volume prune</code>', '<strong>todos</strong> os volumes anônimos sem uso'],
                ['<code>docker volume prune -a</code>', '<strong>todos</strong> os volumes sem uso, inclusive nomeados'],
                ['<code>docker compose down -v</code>', 'os volumes declarados naquele compose'],
                ['<code>docker system prune --volumes</code>', 'containers, redes, imagens e volumes anônimos']
              ]
            }
          },
          { p: 'Nenhum deles pergunta duas vezes, e nenhum tem desfazer. Antes de rodar qualquer um em servidor: <code>docker volume ls</code>, olhe a lista, e só então decida.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Permissão é comparação de UID: <code>ls -ln</code> no servidor, <code>id</code> dentro do container.',
          'Alinhe os números com <code>chown</code> ou <code>-u</code>. Nunca com <code>777</code>.',
          'Backup de volume: container temporário montando volume e destino.',
          'Backup de banco é dump lógico, não cópia de arquivo.',
          '<code>prune</code> e <code>down -v</code> apagam dados sem perguntar.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td8-2-a', kind: 'guiado', title: 'Diagnosticar e corrigir um permission denied',
        body: [
          { p: 'Crie uma pasta do servidor dona de outro UID, monte-a em um container e veja o erro de permissão — depois corrija.' },
          {
            code: [
              '$ mkdir -p ~/dados-app',
              '$ sudo chown -R 1001:1001 ~/dados-app',
              '$ docker run -d --name escritor -u 1000:1000 -v /home/aluno/dados-app:/dados alpine sleep 1000',
              '$ docker exec escritor sh -c "echo novo > /dados/novo.txt"; echo "codigo: $?"',
              '$ ls -ln ~/dados-app',
              '$ docker exec escritor id',
              '$ sudo chown -R 1000:1000 ~/dados-app',
              '$ docker exec escritor sh -c "echo novo > /dados/novo.txt"; echo "codigo: $?"',
              '$ docker exec escritor cat /dados/novo.txt'
            ]
          },
          { p: 'Na primeira tentativa, o UID do container (1000) não é dono da pasta (1001): <em>permission denied</em>. Depois do <code>chown</code> alinhar os números, a escrita funciona.' }
        ],
        hints: ['O container roda com <code>-u 1000:1000</code>; a pasta começa com dono <code>1001:1001</code>. Alinhe os dois com <code>chown</code>, nunca com <code>chmod 777</code>.'],
        check: async (ctx) => {
          const c = D.container(ctx, 'escritor');
          const mo = c ? D.montagem(ctx, 'escritor', '/dados') : null;
          const conteudo = c ? D.leNoContainer(ctx, 'escritor', '/dados/novo.txt') : null;
          return H.checkAll([
            [() => !!c, 'Suba um container chamado <code>escritor</code> montando <code>~/dados-app</code> em <code>/dados</code>.'],
            [() => !!c && c.rodando, 'O container <code>escritor</code> precisa estar em execução.'],
            [() => !!mo && mo.tipo === 'bind', 'O <code>escritor</code> precisa montar <code>/home/aluno/dados-app</code> em <code>/dados</code> como bind mount.'],
            [() => H.usedCommand(ctx, /chown/), 'Alinhe o dono do diretório com <code>chown</code>.'],
            [() => !H.usedCommand(ctx, /chmod\s+(-R\s+)?777/), 'Evite <code>chmod 777</code>: a correção certa é alinhar os números com <code>chown</code>, não abrir geral.'],
            [() => conteudo !== null && /novo/.test(conteudo),
              'O arquivo <code>/dados/novo.txt</code> ainda não está gravado dentro do container. Depois de alinhar o dono, escreva com <code>docker exec escritor sh -c "echo novo &gt; /dados/novo.txt"</code>.']
          ]);
        }
      },
      {
        id: 'td8-2-q', kind: 'quiz', title: 'Permission denied em um bind mount',
        body: [
          { p: 'Uma aplicação Node não consegue escrever em um diretório montado:' },
          { code: ['Error: EACCES: permission denied, open \'/app/dados/log.txt\''], run: false, lang: 'text' },
          { p: 'Você investiga:' },
          { code: ['$ ls -ln /home/deploy/dados', 'drwxr-xr-x 2 1001 1001 4096 Sep  8 10:12 .', '',
            '$ docker exec api id', 'uid=1000(node) gid=1000(node) groups=1000(node)'], run: false, lang: 'text' },
          { p: 'Qual é a causa e a correção mais adequada?' }
        ],
        options: [
          { text: 'O diretório é do UID 1001 com modo 755; o processo roda como UID 1000, cai na permissão de "outros" e não tem escrita. A correção é alinhar os números: <code>sudo chown -R 1000:1000 /home/deploy/dados</code>.', correct: true },
          { text: '<code>chmod -R 777 /home/deploy/dados</code>.', why: 'Resolve o sintoma e abre o diretório para qualquer processo do servidor. É a resposta de fórum, não a de produção.' },
          { text: 'O bind mount está corrompido; recriar o container resolve.', why: 'Nada está corrompido, e recriar não muda dono nem modo.' },
          { text: 'Falta <code>:rw</code> no fim do <code>-v</code>.', why: 'Montagem já é leitura e escrita por padrão; o <code>rw</code> é o padrão. O impedimento vem das permissões do sistema de arquivos.' }
        ],
        explain: 'A investigação inteira cabe em dois comandos: <code>ls -ln</code> no servidor (números, não nomes) e <code>id</code> dentro do container. Se o UID de dentro não é o dono e o modo não dá escrita a "outros", está explicado. Além do <code>chown</code>, há duas alternativas legítimas: rodar o container com o UID do dono (<code>-u 1001:1001</code>) ou trocar o bind mount por um volume nomeado, em que o Docker acerta as permissões sozinho.'
      },
      {
        id: 'td8-2-b', kind: 'desafio', title: 'Backup e restauração de um volume',
        body: [
          { p: 'O volume <code>uploads</code> já existe e tem arquivos dentro, montados no container <code>arquivos</code>.' },
          { ol: [
            'Faça um backup do conteúdo do volume em <code>/home/aluno/backups/uploads.tar.gz</code>, usando um container temporário.',
            'Simule um desastre: apague o conteúdo do volume por dentro do container <code>arquivos</code>.',
            'Restaure a partir do backup.',
            'Confirme que os arquivos voltaram.'
          ] },
          { p: 'No fim, o volume precisa ter de volta o arquivo <code>relatorio.txt</code> com o conteúdo original.' }
        ],
        hints: [
          'O container do backup monta duas coisas: o volume (em <code>:ro</code>) e a pasta de destino do servidor.',
          'Compacte com <code>tar -czf /destino/uploads.tar.gz -C /origem .</code> — o ponto final é o conteúdo do diretório.',
          'Para restaurar, monte o volume como destino (sem <code>:ro</code>) e extraia lá dentro.'
        ],
        solution: '<pre>$ mkdir -p ~/backups\n$ docker run --rm -v uploads:/origem:ro -v /home/aluno/backups:/destino alpine tar -czf /destino/uploads.tar.gz -C /origem .\n$ ls -l ~/backups\n$ docker exec arquivos sh -c "rm -f /dados/*"\n$ docker exec arquivos ls /dados\n$ docker run --rm -v uploads:/destino -v /home/aluno/backups:/origem:ro alpine sh -c "cd /destino &amp;&amp; tar -xzf /origem/uploads.tar.gz"\n$ docker exec arquivos cat /dados/relatorio.txt</pre>',
        check: async (ctx) => {
          const tar = H.read(ctx, '/home/aluno/backups/uploads.tar.gz');
          const rel = D.noVolume(ctx, 'uploads', 'relatorio.txt');
          return H.checkAll([
            [() => !!D.volume(ctx, 'uploads'), 'O volume <code>uploads</code> precisa continuar existindo.'],
            [() => tar !== null, 'Ainda não existe o backup em <code>/home/aluno/backups/uploads.tar.gz</code>. Gere com um container temporário montando o volume e a pasta de destino.'],
            [() => H.usedCommand(ctx, /docker\s+run.*-v\s+uploads:/), 'O backup precisa sair de um container que monta o volume — é assim que se acessa o conteúdo de um volume sem depender do container original.'],
            [() => H.usedCommand(ctx, /\btar\b/), 'Use <code>tar</code> dentro do container temporário para compactar o conteúdo.'],
            [() => H.usedCommand(ctx, /\brm\b/), 'Falta a parte do desastre: apague o conteúdo do volume por dentro do container <code>arquivos</code> antes de restaurar.'],
            [() => rel !== null,
              'O arquivo <code>relatorio.txt</code> não está no volume. Restaure o backup extraindo o <code>.tar.gz</code> dentro do volume montado.'],
            [() => /18422/.test(rel || ''),
              'O <code>relatorio.txt</code> voltou, mas o conteúdo não é o original. Restaure a partir do backup, sem recriar o arquivo à mão.']
          ]);
        },
        forja: ['docker exec arquivos sh -c "echo conteudo-inventado > /dados/relatorio.txt"',
          'mkdir -p ~/backups && echo falso > ~/backups/uploads.tar.gz']
      }
    ]
  });
})();
