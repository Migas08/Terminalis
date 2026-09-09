/* =========================================================================
   MÓDULO D20 — Banco de dados em container
   Entrar num banco que roda em container, consultar, corrigir dados com
   segurança, e o par que salva a pele: backup e restauração.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* Atalho: a tabela de um banco vivo dentro de um container, para os
     verificadores olharem o estado real das linhas. */
  function tabela(ctx, container, banco, tab) {
    const c = D.container(ctx, container);
    if (!c || !c.banco || !c.rodando) return null;
    const db = c.banco.bancos.get(banco);
    if (!db) return null;
    return db.tabelas.get(tab) || null;
  }

  /* ============================== 20.1 ============================== */
  LX.lesson('d20', {
    id: 'ld20-1', n: '20.1', title: 'Entrar no banco e rodar SQL',
    goal: 'Abrir uma sessão no banco que roda dentro de um container e rodar comandos SQL — de dentro do container, sem publicar porta nem instalar cliente na máquina.',
    setup: (m) => {
      if (!m.docker) return;
      D.montar(m, {
        nome: 'banco', imagem: 'mariadb:11.4',
        env: { MARIADB_ROOT_PASSWORD: 'SENHA_DO_BANCO', MARIADB_DATABASE: 'loja' }
      });
    },
    body: [
      { h2: 'O banco está preso dentro do container — de propósito' },
      { p: 'Um bom banco de produção <strong>não</strong> publica porta para fora: quem precisa dele são os outros containers da mesma rede, não o mundo. Então como você, o operador, entra para dar uma olhada? Você executa o cliente <strong>de dentro do próprio container</strong>, onde o banco escuta em <code>localhost</code>.' },
      { p: 'A imagem <code>mariadb:11.4</code> já traz o cliente <code>mariadb</code>. Você o roda com o <code>docker exec</code> que já conhece:' },
      {
        code: [
          '# uma sessão interativa (o "monitor" do MariaDB)',
          'docker exec -it banco mariadb -uroot -pSENHA_DO_BANCO loja'
        ], run: false
      },
      { p: 'O <code>-uroot</code> é o usuário, o <code>-p</code> colado à senha é a senha (<code>-pSENHA_DO_BANCO</code>, sem espaço), e o <code>loja</code> no fim é o banco de dados que você quer usar. Dentro do monitor, você digita SQL terminado em <code>;</code> e sai com <code>exit</code>.' },
      {
        box: 'key', label: 'Senha na linha de comando: -p colado', body: [
          { p: 'No cliente do MySQL/MariaDB, <code>-p</code> é a senha e ela vem <strong>colada</strong>: <code>-pSENHA_DO_BANCO</code>. Um espaço (<code>-p SENHA_DO_BANCO</code>) faz o <code>SENHA_DO_BANCO</code> virar o <em>nome do banco</em>, e o cliente pergunta a senha depois. Em telas de verdade, o ideal é não pôr a senha no comando (fica no histórico); aqui, no curso, usamos o marcador <code>SENHA_DO_BANCO</code> para focar no que importa.' }
        ]
      },

      { h2: 'Uma consulta só, sem abrir o monitor: -e' },
      { p: 'Para rodar um comando e sair — perfeito para scripts e para uma olhada rápida — use <code>-e</code> com o SQL entre aspas. Nada de sessão interativa: ele executa, imprime e volta ao shell.' },
      {
        code: [
          '# quais bancos existem?',
          'docker exec banco mariadb -uroot -pSENHA_DO_BANCO -e "SHOW DATABASES;"',
          '',
          '# quais tabelas há no banco loja?',
          'docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SHOW TABLES;"'
        ], run: false
      },
      { p: 'Repare que sem sessão interativa não precisa do <code>-it</code>: não há terminal para alocar, o comando roda e termina.' },

      { h2: 'Criar uma tabela e pôr dados' },
      { p: 'O banco <code>loja</code> foi criado vazio (foi o <code>MARIADB_DATABASE</code> que o criou). Uma tabela nasce com <code>CREATE TABLE</code>, e as linhas entram com <code>INSERT</code>:' },
      {
        code: [
          'docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE produtos (id INT PRIMARY KEY AUTO_INCREMENT, nome VARCHAR(50), preco INT);"',
          'docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "INSERT INTO produtos (nome, preco) VALUES (\'cafe\', 900), (\'cha\', 500);"',
          'docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM produtos;"'
        ], run: false
      },
      {
        table: {
          head: ['SQL', 'Faz'],
          rows: [
            ['<code>SHOW DATABASES;</code>', 'lista os bancos de dados'],
            ['<code>SHOW TABLES;</code>', 'lista as tabelas do banco em uso'],
            ['<code>CREATE TABLE ...;</code>', 'cria uma tabela com suas colunas'],
            ['<code>INSERT INTO t (...) VALUES (...);</code>', 'insere uma ou mais linhas'],
            ['<code>SELECT * FROM t;</code>', 'lê as linhas da tabela']
          ]
        }
      },
      {
        box: 'note', label: 'O SQL é o mesmo, dentro ou fora de container', body: [
          { p: 'Nada aqui é "SQL de Docker". É SQL comum — o mesmo que você rodaria num banco instalado direto na máquina. O container só muda <em>como você chega</em> ao banco (via <code>docker exec</code>); o que você faz lá dentro é o banco de sempre.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td20-1-a', kind: 'guiado', title: 'Entre e olhe o que existe',
        body: [
          { p: 'O container <code>banco</code> já está no ar com o banco <code>loja</code> (vazio). Explore-o sem abrir o monitor:' },
          {
            code: [
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO -e "SHOW DATABASES;"',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SHOW TABLES;"',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE teste (id INT);"',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SHOW TABLES;"'
            ]
          },
          { p: 'O <code>loja</code> aparece na lista de bancos; começa sem tabelas; depois do <code>CREATE TABLE</code>, o <code>SHOW TABLES</code> já mostra a <code>teste</code>. Você está rodando SQL de dentro do container, sem publicar porta nenhuma.' }
        ],
        hints: ['O cliente é <code>mariadb</code>, o usuário <code>-uroot</code>, a senha colada <code>-pSENHA_DO_BANCO</code>, e o banco (<code>loja</code>) vem antes do <code>-e</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+exec\s+.*mariadb/), 'Rode o cliente de dentro do container com <code>docker exec banco mariadb ...</code>.']
        ])
      },
      {
        id: 'td20-1-q', kind: 'quiz', title: 'Por que -it na sessão e não no -e',
        body: [
          { p: 'Para abrir o <em>monitor</em> interativo você usa <code>docker exec -it banco mariadb ...</code>, mas para rodar <code>-e "SELECT ..."</code> você usa <code>docker exec banco mariadb ...</code>, sem o <code>-it</code>. Por quê?' }
        ],
        options: [
          { text: 'O <code>-it</code> aloca um terminal interativo, que a sessão do monitor precisa para você digitar. Com <code>-e</code>, o comando roda sozinho e termina — não há nada para digitar, então o terminal é desnecessário.', correct: true },
          { text: 'O <code>-e</code> não funciona junto com <code>-it</code>; são incompatíveis.', why: 'Não são incompatíveis — <code>-it</code> apenas não faz falta com <code>-e</code>. O ponto é que não há interação para justificar alocar um terminal.' },
          { text: 'O <code>-it</code> é obrigatório em todo <code>docker exec</code>; foi esquecido no exemplo do <code>-e</code>.', why: 'Não é obrigatório. O <code>-it</code> serve para comandos interativos; um comando que roda e sai (como <code>-e</code>) não precisa dele.' },
          { text: 'Sem <code>-it</code>, o <code>-e</code> roda como outro usuário.', why: 'O usuário do banco vem do <code>-u</code>; o <code>-it</code> não tem relação com isso. Ele só controla a alocação de terminal interativo.' }
        ],
        explain: 'O <code>-i</code> mantém a entrada padrão aberta e o <code>-t</code> aloca um pseudo-terminal — os dois servem para <em>interação</em>. O monitor do MariaDB é interativo (você digita comandos), então pede <code>-it</code>. Já <code>-e "SQL"</code> executa e sai: não há o que digitar, e o <code>-it</code> vira supérfluo.'
      },
      {
        id: 'td20-1-b', kind: 'desafio', title: 'Monte uma tabela de clientes',
        body: [
          { p: 'No banco <code>loja</code> (dentro do container <code>banco</code>), crie uma tabela e popule-a — tudo de dentro do container, com <code>docker exec</code>:' },
          { ol: [
            'crie a tabela <code>clientes</code> com, no mínimo, uma coluna <code>id</code> (chave primária) e uma coluna <code>nome</code>;',
            'insira <strong>duas</strong> linhas de clientes (nomes à sua escolha).'
          ] },
          { p: 'Ao final: a tabela <code>clientes</code> precisa existir no banco <code>loja</code> e ter pelo menos duas linhas.' }
        ],
        hints: [
          'Crie com <code>docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE clientes (id INT PRIMARY KEY AUTO_INCREMENT, nome VARCHAR(50));"</code>.',
          'Insira com <code>... -e "INSERT INTO clientes (nome) VALUES (\'Ana\'), (\'Bruno\');"</code> e confira com um <code>SELECT * FROM clientes;</code>.'
        ],
        solution: '<pre>$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE clientes (id INT PRIMARY KEY AUTO_INCREMENT, nome VARCHAR(50));"\n$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "INSERT INTO clientes (nome) VALUES (\'Ana\'), (\'Bruno\');"\n$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM clientes;"</pre>',
        check: (ctx) => {
          const t = tabela(ctx, 'banco', 'loja', 'clientes');
          return H.checkAll([
            [() => D.rodando(ctx, 'banco'), 'O container <code>banco</code> não está rodando.'],
            [() => !!t, 'A tabela <code>clientes</code> não existe no banco <code>loja</code>. Crie-a com <code>CREATE TABLE</code> via <code>docker exec</code>.'],
            [() => !!t && (t.linhas || []).length >= 2,
              () => 'A tabela <code>clientes</code> tem ' + ((t && t.linhas ? t.linhas.length : 0)) + ' linha(s). Insira pelo menos duas com <code>INSERT</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 20.2 ============================== */
  LX.lesson('d20', {
    id: 'ld20-2', n: '20.2', title: 'Consultar e corrigir dados',
    goal: 'Encontrar a linha certa com SELECT e WHERE, e corrigi-la com UPDATE — entendendo por que o WHERE é o que separa um conserto de um desastre.',
    setup: (m) => {
      if (!m.docker) return;
      const c = D.montar(m, {
        nome: 'banco', imagem: 'mariadb:11.4',
        env: { MARIADB_ROOT_PASSWORD: 'SENHA_DO_BANCO', MARIADB_DATABASE: 'loja' }
      });
      if (c && c.banco) {
        c.banco.executarLote(
          'CREATE TABLE produtos (id INT PRIMARY KEY AUTO_INCREMENT, nome VARCHAR(50), preco INT);' +
          "INSERT INTO produtos (nome, preco) VALUES ('cafe', 900), ('cha', 500), ('bolo', 9900);");
        if (c.banco._persistir) c.banco._persistir();
      }
    },
    body: [
      { h2: 'Achar antes de mexer' },
      { p: 'Corrigir um dado tem dois passos: <strong>encontrar</strong> exatamente a linha errada e só então <strong>alterar</strong> aquela linha. O <code>WHERE</code> é o que faz o "aquela": ele filtra quais linhas o comando enxerga.' },
      {
        code: [
          '# ver tudo',
          'docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM produtos;"',
          '',
          '# ver só uma linha, pelo nome',
          'docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM produtos WHERE nome = \'cafe\';"'
        ], run: false
      },
      { p: 'O primeiro <code>SELECT</code> confirma o que existe; o segundo, com <code>WHERE nome = \'cafe\'</code>, isola a linha que você quer conferir <em>antes</em> de alterar. É o mesmo <code>WHERE</code> que você vai usar no <code>UPDATE</code> — testá-lo com um <code>SELECT</code> primeiro é a rede de segurança.' },

      { h2: 'Corrigir com UPDATE ... WHERE' },
      { p: 'O <code>UPDATE</code> muda valores de colunas. O <code>SET</code> diz o quê mudar; o <code>WHERE</code> diz <strong>em quais linhas</strong>:' },
      {
        code: [
          '# o preço do cafe estava errado; corrige para 1200',
          'docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "UPDATE produtos SET preco = 1200 WHERE nome = \'cafe\';"'
        ], run: false
      },
      {
        box: 'warn', label: 'UPDATE sem WHERE muda TODAS as linhas', body: [
          { p: 'Este é um dos erros mais caros que existem. <code>UPDATE produtos SET preco = 1200;</code> — <strong>sem</strong> <code>WHERE</code> — põe o preço 1200 em <em>todos</em> os produtos, não só no café. O mesmo vale para <code>DELETE FROM produtos;</code> sem <code>WHERE</code>: apaga a tabela inteira, linha por linha. Antes de todo <code>UPDATE</code> ou <code>DELETE</code>, rode o mesmo filtro com <code>SELECT</code> e confira quantas linhas ele pega. Se o <code>SELECT ... WHERE</code> devolve as linhas certas, o <code>UPDATE ... WHERE</code> vai acertar as mesmas.' }
        ]
      },
      {
        box: 'key', label: 'A rotina segura de conserto', body: [
          { ol: [
            '<code>SELECT * FROM t WHERE &lt;condição&gt;;</code> — confirme que o filtro pega só as linhas certas;',
            '<code>UPDATE t SET col = valor WHERE &lt;a mesma condição&gt;;</code> — aplique;',
            '<code>SELECT * FROM t WHERE &lt;condição&gt;;</code> — confira que ficou como esperado.'
          ] }
        ]
      },
      {
        box: 'note', label: 'Apagar uma linha: DELETE ... WHERE', body: [
          { p: 'Simétrico ao <code>UPDATE</code>: <code>DELETE FROM produtos WHERE nome = \'bolo\';</code> apaga só o bolo. E, como o <code>UPDATE</code>, um <code>DELETE</code> sem <code>WHERE</code> não perdoa — leva a tabela inteira. A condição é tudo.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td20-2-a', kind: 'guiado', title: 'Isole a linha antes de mexer',
        body: [
          { p: 'A tabela <code>produtos</code> já tem dados. Pratique a rotina segura: veja tudo, isole uma linha, veja de novo.' },
          {
            code: [
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM produtos;"',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM produtos WHERE nome = \'cha\';"',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT nome, preco FROM produtos WHERE preco > 1000;"'
            ]
          },
          { p: 'O <code>WHERE</code> filtra as linhas; escolher colunas (<code>nome, preco</code> em vez de <code>*</code>) filtra o que aparece. Testar o filtro com <code>SELECT</code> é o passo que você repete antes de qualquer <code>UPDATE</code>.' }
        ],
        hints: ['Rode um <code>SELECT ... FROM produtos WHERE ...</code> via <code>docker exec banco mariadb ...</code>.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+exec\s+.*mariadb.*select/i), 'Rode ao menos um <code>SELECT</code> na tabela via <code>docker exec banco mariadb ...</code>.']
        ])
      },
      {
        id: 'td20-2-q', kind: 'quiz', title: 'O UPDATE sem WHERE',
        body: [
          { p: 'Você quer corrigir só o preço do café e digita <code>UPDATE produtos SET preco = 1200;</code>, esquecendo o <code>WHERE</code>. O que acontece?' }
        ],
        options: [
          { text: 'Todas as linhas da tabela ficam com <code>preco = 1200</code> — o UPDATE sem WHERE atinge a tabela inteira. Por isso se testa o filtro com um SELECT antes.', correct: true },
          { text: 'Nada: sem <code>WHERE</code>, o MariaDB recusa o comando por segurança.', why: 'O servidor executa normalmente. Alguns clientes têm um "safe updates" opcional, mas o padrão é obedecer — e mudar tudo. A proteção real é você pôr o WHERE.' },
          { text: 'Só a primeira linha muda.', why: 'Não há "primeira" para o UPDATE: sem WHERE, ele percorre e altera todas as linhas.' },
          { text: 'O comando muda a estrutura da coluna <code>preco</code>, não os valores.', why: 'Mudar estrutura é <code>ALTER TABLE</code>. <code>UPDATE ... SET</code> muda <em>valores</em> — e sem WHERE, em todas as linhas.' }
        ],
        explain: 'O <code>WHERE</code> define o alcance de <code>UPDATE</code> e <code>DELETE</code>. Sem ele, o alcance é a tabela inteira. A defesa é sempre a mesma: rode o mesmo filtro como <code>SELECT</code> primeiro e veja quantas (e quais) linhas ele pega; se estiver certo, troque o <code>SELECT</code> pelo <code>UPDATE</code>.'
      },
      {
        id: 'td20-2-b', kind: 'desafio', title: 'Corrija um preço errado',
        body: [
          { p: 'A tabela <code>produtos</code> no banco <code>loja</code> tem um erro: o produto <code>bolo</code> foi cadastrado com o preço <code>9900</code>, mas o correto é <code>1500</code>. Corrija <strong>apenas</strong> a linha do bolo.' },
          { p: 'Ao final: o <code>bolo</code> precisa ter <code>preco = 1500</code>, e os outros produtos (<code>cafe</code> = 900, <code>cha</code> = 500) precisam continuar intactos.' }
        ],
        hints: [
          'Primeiro confirme o alvo: <code>SELECT * FROM produtos WHERE nome = \'bolo\';</code>.',
          'Depois aplique só nele: <code>UPDATE produtos SET preco = 1500 WHERE nome = \'bolo\';</code> — com o WHERE, senão você muda todos os preços.'
        ],
        solution: '<pre>$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM produtos WHERE nome = \'bolo\';"\n$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "UPDATE produtos SET preco = 1500 WHERE nome = \'bolo\';"\n$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM produtos;"</pre>',
        check: (ctx) => {
          const t = tabela(ctx, 'banco', 'loja', 'produtos');
          const preco = (nome) => {
            if (!t) return null;
            const l = (t.linhas || []).find(r => String(r.nome) === nome);
            return l ? Number(l.preco) : null;
          };
          return H.checkAll([
            [() => D.rodando(ctx, 'banco'), 'O container <code>banco</code> não está rodando.'],
            [() => !!t, 'Não encontrei a tabela <code>produtos</code> no banco <code>loja</code>.'],
            [() => preco('bolo') === 1500,
              () => 'O <code>bolo</code> está com preço <code>' + preco('bolo') + '</code>. Corrija para <code>1500</code> com <code>UPDATE ... WHERE nome = \'bolo\'</code>.'],
            [() => preco('cafe') === 900 && preco('cha') === 500,
              'Os outros produtos foram alterados por engano. Só o <code>bolo</code> deveria mudar — reveja se faltou o <code>WHERE</code> no seu <code>UPDATE</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 20.3 ============================== */
  LX.lesson('d20', {
    id: 'ld20-3', n: '20.3', title: 'Backup e restauração',
    goal: 'Gerar um dump lógico do banco com mariadb-dump e trazer os dados de volta a partir dele — o par que transforma um acidente em um susto.',
    setup: (m) => {
      if (!m.docker) return;
      const c = D.montar(m, {
        nome: 'banco', imagem: 'mariadb:11.4',
        env: { MARIADB_ROOT_PASSWORD: 'SENHA_DO_BANCO', MARIADB_DATABASE: 'loja' }
      });
      if (c && c.banco) {
        c.banco.executarLote(
          'CREATE TABLE pedidos (id INT PRIMARY KEY AUTO_INCREMENT, cliente VARCHAR(50), total INT);' +
          "INSERT INTO pedidos (cliente, total) VALUES ('Ana', 4200), ('Bruno', 1800), ('Carla', 9500);");
        /* um backup pronto, feito "ontem", já espera na home do aluno */
        const dump = c.banco.dump('loja');
        if (dump) D.arquivo(m, '/home/aluno/backup.sql', dump);
        /* o acidente já aconteceu: a tabela pedidos foi perdida */
        c.banco.executarLote('DROP TABLE pedidos;');
        if (c.banco._persistir) c.banco._persistir();
      }
    },
    body: [
      { h2: 'Copiar o volume não é backup de banco' },
      { p: 'Pode parecer que basta copiar os arquivos de <code>/var/lib/mysql</code> para ter um backup. É arriscado: com o banco no ar, esses arquivos mudam a cada instante, e uma cópia pega o banco no meio de uma escrita — inconsistente. O backup <strong>lógico</strong> resolve isso: em vez de copiar arquivos, você pede ao banco que gere o SQL capaz de recriar tudo do zero.' },
      { p: 'A imagem do MariaDB traz a ferramenta <code>mariadb-dump</code>. Ela conecta no banco e imprime, na saída padrão, os comandos <code>CREATE TABLE</code> e <code>INSERT</code> que reconstroem os dados. Você redireciona essa saída para um arquivo:' },
      {
        code: [
          '# gera o dump do banco loja e salva no arquivo backup.sql (na sua máquina)',
          'docker exec banco mariadb-dump -uroot -pSENHA_DO_BANCO loja > backup.sql'
        ], run: false
      },
      {
        box: 'key', label: 'O dump sai do container e cai na sua máquina', body: [
          { p: 'Repare no <code>&gt; backup.sql</code>: o <code>mariadb-dump</code> roda <em>dentro</em> do container, mas o <code>&gt;</code> é do <strong>seu</strong> shell — então o arquivo <code>backup.sql</code> é gravado na sua máquina, fora do container. Isso é o que você quer: o backup não pode morar dentro do mesmo container que ele existe para proteger.' }
        ]
      },

      { h2: 'Restaurar: o SQL de volta para dentro' },
      { p: 'Restaurar é o caminho inverso: você manda o conteúdo do <code>backup.sql</code> para a entrada padrão do cliente <code>mariadb</code>, que executa cada comando e reconstrói as tabelas. Aqui o <code>-i</code> é obrigatório — é ele que mantém a entrada padrão aberta para o arquivo entrar:' },
      {
        code: [
          '# reconstrói o banco loja a partir do arquivo',
          'docker exec -i banco mariadb -uroot -pSENHA_DO_BANCO loja < backup.sql'
        ], run: false
      },
      {
        box: 'warn', label: 'O -i no restore não é opcional', body: [
          { p: 'No <code>docker exec -i</code>, o <code>-i</code> mantém a entrada padrão (stdin) conectada. Sem ele, o <code>&lt; backup.sql</code> não chega ao cliente <code>mariadb</code> lá dentro, e nada é restaurado. No backup (<code>mariadb-dump</code>) não precisa de <code>-i</code>, porque o fluxo sai do container para você; na restauração o fluxo <em>entra</em>, e aí o <code>-i</code> é o que abre a porta.' }
        ]
      },
      {
        box: 'note', label: 'Testar o backup é parte do backup', body: [
          { p: 'Um backup que nunca foi restaurado é uma esperança, não uma garantia. A única prova de que um dump presta é restaurá-lo — de preferência num banco de teste — e ver os dados de volta. Um dump corrompido ou incompleto só se revela na hora H, que é o pior momento para descobrir.' }
        ]
      }
    ],
    tasks: [
      {
        id: 'td20-3-a', kind: 'guiado', title: 'O ciclo completo: dump, perda, restore',
        body: [
          { p: 'Veja o par backup/restauração provar seu valor num banco de teste. (Estes comandos usam um banco separado para você experimentar sem medo.)' },
          {
            code: [
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO -e "CREATE DATABASE teste;"',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO teste -e "CREATE TABLE notas (id INT PRIMARY KEY AUTO_INCREMENT, texto VARCHAR(50));"',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO teste -e "INSERT INTO notas (texto) VALUES (\'importante\');"',
              '$ docker exec banco mariadb-dump -uroot -pSENHA_DO_BANCO teste > ~/teste.sql',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO teste -e "DROP TABLE notas;"',
              '$ docker exec -i banco mariadb -uroot -pSENHA_DO_BANCO teste < ~/teste.sql',
              '$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO teste -e "SELECT * FROM notas;"'
            ]
          },
          { p: 'Você criou dados, guardou o dump, apagou a tabela (o "acidente") e a trouxe de volta pelo arquivo. O último <code>SELECT</code> mostra a nota <code>importante</code> de novo — a prova de que o backup funcionou.' }
        ],
        hints: ['O <code>mariadb-dump ... &gt; arquivo</code> guarda; o <code>mariadb ... &lt; arquivo</code> (com <code>docker exec -i</code>) restaura.'],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+exec\s+.*mariadb-dump/), 'Gere um dump com <code>docker exec banco mariadb-dump ... &gt; arquivo</code>.'],
          [() => H.usedCommand(ctx, /docker\s+exec\s+-i\s+.*mariadb/), 'Restaure com <code>docker exec -i banco mariadb ... &lt; arquivo</code>.']
        ])
      },
      {
        id: 'td20-3-q', kind: 'quiz', title: 'Por que o dump e não a cópia dos arquivos',
        body: [
          { p: 'Por que <code>mariadb-dump</code> (que gera SQL) é preferível a simplesmente copiar os arquivos de <code>/var/lib/mysql</code> com o banco no ar?' }
        ],
        options: [
          { text: 'Com o banco no ar, os arquivos mudam a cada escrita; uma cópia pode pegá-los no meio de uma transação e sair inconsistente. O dump lógico pede ao banco um retrato coerente dos dados, em SQL que recria tudo.', correct: true },
          { text: 'Copiar arquivos é impossível dentro de um container.', why: 'É possível copiar (com o container parado, inclusive). O problema não é possibilidade, é consistência: copiar com o banco ativo arrisca um retrato quebrado.' },
          { text: 'O dump ocupa sempre menos espaço que os arquivos.', why: 'Às vezes sim, às vezes não — dumps de texto podem ser grandes. A vantagem central é a <em>consistência</em> e a portabilidade do SQL, não o tamanho.' },
          { text: 'Arquivos de <code>/var/lib/mysql</code> não podem ser restaurados nunca.', why: 'Podem, com o banco parado e a mesma versão. Mas o dump lógico é mais seguro com o banco no ar e mais portável entre versões.' }
        ],
        explain: 'Um backup precisa de um retrato <em>coerente</em> num instante. Copiar os arquivos de dados com o servidor escrevendo neles arrisca capturar um estado no meio de uma operação. O <code>mariadb-dump</code> conversa com o banco e emite o SQL (<code>CREATE TABLE</code> + <code>INSERT</code>) que reconstrói os dados de forma consistente e portável — e o <code>&gt; arquivo</code> guarda esse SQL fora do container.'
      },
      {
        id: 'td20-3-b', kind: 'desafio', title: 'Recupere a tabela perdida',
        body: [
          { p: 'Aconteceu o pior: a tabela <code>pedidos</code> do banco <code>loja</code> foi apagada por engano. Mas há um backup pronto: o arquivo <code>~/backup.sql</code>, feito antes do acidente, tem os dados. Restaure a tabela a partir dele.' },
          { p: 'Ao final: a tabela <code>pedidos</code> precisa estar de volta no banco <code>loja</code>, com os três pedidos originais (Ana, Bruno e Carla).' }
        ],
        hints: [
          'O backup já está em <code>~/backup.sql</code>. Você não precisa gerá-lo — só mandá-lo de volta para o banco.',
          'Restaure com <code>docker exec -i banco mariadb -uroot -pSENHA_DO_BANCO loja &lt; ~/backup.sql</code>. O <code>-i</code> é o que deixa o arquivo entrar.'
        ],
        solution: '<pre>$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SHOW TABLES;"\n$ docker exec -i banco mariadb -uroot -pSENHA_DO_BANCO loja < ~/backup.sql\n$ docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "SELECT * FROM pedidos;"</pre>',
        check: (ctx) => {
          const t = tabela(ctx, 'banco', 'loja', 'pedidos');
          const clientes = t ? (t.linhas || []).map(r => String(r.cliente)) : [];
          return H.checkAll([
            [() => D.rodando(ctx, 'banco'), 'O container <code>banco</code> não está rodando.'],
            [() => !!t, 'A tabela <code>pedidos</code> ainda não voltou. Restaure-a com <code>docker exec -i banco mariadb ... loja &lt; ~/backup.sql</code>.'],
            [() => (t.linhas || []).length >= 3,
              () => 'A tabela <code>pedidos</code> voltou com ' + ((t && t.linhas ? t.linhas.length : 0)) + ' linha(s); deveriam ser 3. Confira se restaurou o backup certo.'],
            [() => ['Ana', 'Bruno', 'Carla'].every(n => clientes.includes(n)),
              'Os pedidos restaurados não batem com os originais (Ana, Bruno, Carla). Restaure a partir de <code>~/backup.sql</code>.']
          ]);
        }
      }
    ]
  });
})();
