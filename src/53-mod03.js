/* =========================================================================
   MÓDULO 3 — Texto e busca
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 4.1 ============================== */
  LX.lesson('m03', {
    id: 'l3-1', n: '4.1', title: 'grep: encontrar a agulha',
    goal: 'O comando que transforma um log de meio milhão de linhas em três linhas relevantes. Depois desta aula você vai usá-lo todo dia.',
    brief: [
      { p: '<code>grep PADRÃO ARQUIVO</code> imprime as linhas que contêm o padrão. Ele diferencia maiúsculas de minúsculas; use <code>-i</code> para ignorar isso, <code>-n</code> para ver os números das linhas e <code>-r</code> para buscar em uma pasta.' },
      { code: ['$ grep -in "erro" app.log', '$ grep -rn "porta=8080" ./config'] },
      { p: '<code>-v</code> mostra as linhas que não casam e <code>-C 3</code> inclui três linhas de contexto antes e depois. Coloque padrões com espaços ou símbolos entre aspas.' }
    ],
    body: [
      { p: 'O nome vem de um comando do editor <code>ed</code>: <code>g/re/p</code> — <em>globally search a regular expression and print</em>. Ele faz exatamente isso: procura um padrão e imprime as linhas que casam.' },
      { code: ['$ grep erro /var/log/app/erro.log', '$ grep ERROR /var/log/app/erro.log'] },
      { p: 'A primeira busca não achou nada e a segunda achou: o <code>grep</code> diferencia maiúsculas de minúsculas por padrão.' },

      { h2: 'As opções que resolvem 90% dos casos' },
      {
        table: {
          head: ['Opção', 'O que faz', 'Uso típico'],
          rows: [
            ['<code>-i</code>', 'ignora maiúsculas/minúsculas', 'quando não se sabe como foi escrito'],
            ['<code>-v</code>', '<strong>inverte</strong>: mostra o que NÃO casa', 'remover ruído de um log'],
            ['<code>-n</code>', 'mostra o número da linha', 'ir direto ao ponto no editor'],
            ['<code>-c</code>', 'conta em vez de mostrar', '"quantos erros hoje?"'],
            ['<code>-l</code>', 'só o nome dos arquivos que casam', '"em qual arquivo está isso?"'],
            ['<code>-r</code>', 'busca recursiva em diretórios', 'procurar em um projeto inteiro'],
            ['<code>-w</code>', 'palavra inteira', 'evitar que "log" case com "login"'],
            ['<code>-A n</code> / <code>-B n</code> / <code>-C n</code>', 'linhas depois / antes / em volta', 'ver o contexto de um erro'],
            ['<code>-o</code>', 'imprime só a parte que casou', 'extrair valores'],
            ['<code>-E</code>', 'regex estendida (ERE)', 'padrões com <code>|</code>, <code>+</code>, <code>?</code>']
          ]
        }
      },
      { code: ['$ grep -i erro /var/log/app/erro.log', '$ grep -n ERROR /var/log/app/erro.log', '$ grep -c ERROR /var/log/app/erro.log'] },

      { h2: 'Contexto: o -A, -B e -C' },
      { p: 'Um erro raramente está sozinho. Ver o que veio antes e depois é o que transforma "encontrei a linha" em "entendi o problema":' },
      { code: ['$ grep -B 2 -A 2 "timeout" /var/log/app/erro.log', '$ grep -C 3 "disco cheio" /var/log/app/erro.log'] },
      {
        box: 'tip', body: [
          { p: 'Em investigação real, comece sempre com <code>-C 5</code>. As linhas ao redor quase sempre contam a história: a tentativa, a falha, e a consequência.' }
        ]
      },

      { h2: 'Inverter: o -v é subestimado' },
      { p: 'Muitas vezes você não sabe o que procurar, mas sabe o que <strong>ignorar</strong>. O <code>-v</code> vai removendo ruído até sobrar o interessante:' },
      {
        code: [
          '$ grep -v "^#" /etc/ssh/sshd_config',
          '$ grep -v "^#" /etc/ssh/sshd_config | grep -v "^$"'
        ]
      },
      { p: 'Esse par é a receita clássica para ler um arquivo de configuração: tira comentários, tira linhas em branco, e sobra só o que está de fato configurado.' },

      { h2: 'Busca recursiva' },
      { p: 'Com <code>-r</code>, o <code>grep</code> percorre diretórios inteiros. É como você encontra "onde está definida essa porta?" em um projeto:' },
      { code: ['$ grep -rn "8080" ~/projetos', '$ grep -rn "Port" /etc/ssh/'] },
      {
        cheat: [
          ['grep -r --include="*.conf" x /etc', 'limita a certos arquivos'],
          ['grep -r --exclude="*.log" x .', 'exclui certos arquivos'],
          ['grep -rl x .', 'só os nomes dos arquivos'],
          ['grep -ri x .', 'ignorando maiúsculas']
        ]
      },

      { h2: 'Encadeando greps' },
      { p: 'Cada <code>grep</code> em sequência é um filtro adicional. É a forma mais simples de fazer uma busca com "E":' },
      {
        code: [
          '# requisições de erro 404 vindas de um IP específico',
          '$ grep " 404 " /var/log/app/acesso.log | grep "10.0.2.2" | head -5',
          '# quantas requisições deram erro 500',
          '$ grep -c " 500 " /var/log/app/acesso.log'
        ]
      },
      { p: 'Para "OU", use uma regex estendida com <code>-E</code>:' },
      { code: ['$ grep -cE " (500|502|503) " /var/log/app/acesso.log'] },

      { h2: 'Código de saída: grep serve para decidir' },
      { p: 'O <code>grep</code> retorna 0 se encontrou, 1 se não encontrou e 2 em caso de erro. Isso o torna um ótimo teste dentro de scripts:' },
      { code: ['$ grep -q "PermitRootLogin no" /etc/ssh/sshd_config && echo "seguro" || echo "revisar"'] },
      { p: 'O <code>-q</code> (<em>quiet</em>) não imprime nada — só devolve o código de saída. É assim que se testa uma condição sem poluir a saída.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>grep -i</code> ignora caixa; <code>-n</code> numera; <code>-c</code> conta; <code>-r</code> desce em diretórios.',
          '<code>grep -C 5</code> mostra o contexto — comece sempre por aí ao investigar.',
          '<code>grep -v "^#" arq | grep -v "^$"</code> lê uma configuração sem ruído.',
          'Vários <code>grep</code> em série fazem "E"; <code>-E "a|b"</code> faz "OU".',
          '<code>grep -q</code> serve para decidir dentro de scripts.'
        ]
      }
    ],
    tasks: [
      {
        id: 't3-1-a', kind: 'guiado', title: 'Leia uma configuração de verdade',
        body: [
          { p: 'Arquivos de configuração vêm cheios de comentários. Compare o antes e o depois:' },
          { code: ['$ wc -l /etc/ssh/sshd_config', '$ grep -v "^#" /etc/ssh/sshd_config | grep -v "^$"', '$ grep -v "^#" /etc/ssh/sshd_config | grep -v "^$" | wc -l'] },
          { p: 'De dezenas de linhas para menos de dez. Essa é a diferença entre "ler um arquivo" e "ver a configuração".' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /grep\s+-v\s+["']?\^#/), 'Use <code>grep -v "^#"</code> para remover os comentários.'],
          [() => H.usedCommand(ctx, /grep[^|]*\|\s*grep/), 'Encadeie dois <code>grep</code> com um pipe para tirar também as linhas em branco.']
        ])
      },
      {
        id: 't3-1-p', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Um arquivo contém estas quatro linhas:' },
          { code: ['login realizado', 'LOGIN falhou', 'log rotacionado', 'sem eventos'], run: false, mixed: false, lang: 'text' },
          { p: 'Quantas linhas o comando <code>grep -iw log arquivo</code> imprime?' }
        ],
        options: [
          { text: '1 — apenas "log rotacionado".', correct: true },
          { text: '3 — todas as que contêm "log".', why: 'O <code>-w</code> exige <strong>palavra inteira</strong>. Em "login" e "LOGIN", o "log" é parte de uma palavra maior.' },
          { text: '2 — "login realizado" e "log rotacionado".', why: 'O <code>-w</code> descarta "login". E o <code>-i</code> não muda isso — ele só afeta maiúsculas.' },
          { text: '0 — o <code>-w</code> e o <code>-i</code> são incompatíveis.', why: 'São perfeitamente combináveis. <code>-i</code> ignora a caixa, <code>-w</code> exige limite de palavra.' }
        ],
        explain: 'O <code>-w</code> equivale a envolver o padrão em limites de palavra. "login" e "LOGIN" têm letras coladas em "log", então não casam. Sem o <code>-w</code>, as três primeiras linhas apareceriam.'
      },
      {
        id: 't3-1-b', kind: 'desafio', title: 'Relatório de erros do servidor web',
        body: [
          { p: 'O arquivo <code>/var/log/app/acesso.log</code> está no formato do nginx. O código HTTP é o número de três dígitos depois da requisição — por exemplo <code>"GET /admin HTTP/1.1" 404 1832</code>.' },
          { p: 'Produza um arquivo <code>~/erros.txt</code> contendo, em três linhas:' },
          {
            ol: [
              'o total de requisições que resultaram em <strong>404</strong>;',
              'o total de requisições que resultaram em <strong>erro de servidor</strong> (500 ou 502);',
              'a <strong>última</strong> linha completa do log que teve erro 500.'
            ]
          }
        ],
        hints: [
          'Para contar, use <code>grep -c</code>. Cuide para não contar por engano um "404" que apareça no tamanho da resposta — busque com espaços em volta: <code>" 404 "</code>.',
          'Para "500 ou 502" use regex estendida: <code>grep -cE " (500|502) "</code>. Para a última ocorrência: <code>grep " 500 " arquivo | tail -1</code>.'
        ],
        solution: '<div class="code"><pre>grep -c " 404 " /var/log/app/acesso.log        &gt;  ~/erros.txt\ngrep -cE " (500|502) " /var/log/app/acesso.log &gt;&gt; ~/erros.txt\ngrep " 500 " /var/log/app/acesso.log | tail -1 &gt;&gt; ~/erros.txt\ncat ~/erros.txt</pre></div><p style="margin-top:8px">Os espaços em volta do número são o detalhe que evita falso positivo — sem eles, um tamanho de resposta como <code>4041</code> entraria na conta.</p>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/erros.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/erros.txt ainda não existe.' };
          const log = (H.read(ctx, '/var/log/app/acesso.log') || '').split('\n').filter(Boolean);
          const n404 = log.filter(l => / 404 /.test(l)).length;
          const n5xx = log.filter(l => / (500|502) /.test(l)).length;
          const ult500 = log.filter(l => / 500 /.test(l)).pop() || '';
          return LX.H.checkAll([
            [new RegExp('(^|\\s)' + n404 + '(\\s|$)', 'm').test(c), `Não encontrei o total de 404 (deveria ser ${n404}).`],
            [new RegExp('(^|\\s)' + n5xx + '(\\s|$)', 'm').test(c), `Não encontrei o total de erros de servidor (deveria ser ${n5xx}).`],
            [ult500 && c.includes(ult500.slice(0, 45)), 'Não encontrei a última linha com erro 500.']
          ]);
        }
      },

    ]
  });

  /* ============================== 4.2 ============================== */
  LX.lesson('m03', {
    id: 'l3-2', n: '4.2', title: 'Expressões regulares na prática',
    goal: 'Aprender o suficiente de regex para ser perigoso — sem virar um curso de regex. Só o que você realmente usa no terminal.',
    brief: [
      { p: 'Regex descreve padrões dentro do texto. <code>^</code> marca o início da linha, <code>$</code> o fim, <code>.</code> aceita um caractere e classes como <code>[0-9]</code> aceitam um conjunto.' },
      { code: ['$ grep -E "^ERROR|^WARN" app.log', '$ grep -E "[0-9]{3}" codigos.txt'] },
      { p: 'Com <code>grep -E</code>, use <code>+</code> para uma ou mais repetições, <code>?</code> para zero ou uma e <code>{n}</code> para uma quantidade exata. Regex e o curinga <code>*</code> do shell têm regras diferentes.' }
    ],
    body: [
      { p: 'Uma expressão regular é um padrão que descreve um conjunto de textos. Você já usou um parente delas: o <em>glob</em> do shell. Regex é mais expressiva e funciona <strong>dentro</strong> das linhas, não em nomes de arquivo.' },
      {
        box: 'warn', label: 'Não confunda', body: [
          { p: 'No glob, <code>*</code> significa "qualquer sequência". Em regex, <code>*</code> significa "<strong>zero ou mais do item anterior</strong>". <code>ab*</code> no glob casa "ab", "abc", "abxyz". Em regex casa "a", "ab", "abbb" — porque o <code>*</code> se aplica ao <code>b</code>.' }
        ]
      },

      { h2: 'Âncoras: onde na linha' },
      {
        table: {
          head: ['Símbolo', 'Significa', 'Exemplo'],
          rows: [
            ['<code>^</code>', 'início da linha', '<code>^erro</code> — linhas que <em>começam</em> com erro'],
            ['<code>$</code>', 'fim da linha', '<code>falhou$</code> — linhas que <em>terminam</em> com falhou'],
            ['<code>^$</code>', 'linha vazia', 'usado com <code>-v</code> para remover linhas em branco'],
            ['<code>\\b</code>', 'limite de palavra', '<code>\\blog\\b</code> — a palavra "log" isolada']
          ]
        }
      },
      { code: ['$ grep "^ERROR" /var/log/app/erro.log', '$ grep "cheio$" /var/log/app/erro.log', '$ grep -c "^$" /etc/ssh/sshd_config'] },

      { h2: 'Classes: que tipo de caractere' },
      {
        table: {
          head: ['Padrão', 'Casa com'],
          rows: [
            ['<code>.</code>', 'qualquer caractere, uma vez'],
            ['<code>[abc]</code>', 'a, b ou c'],
            ['<code>[^abc]</code>', 'qualquer coisa <em>menos</em> a, b ou c'],
            ['<code>[0-9]</code>', 'um dígito'],
            ['<code>[a-z]</code>', 'uma letra minúscula'],
            ['<code>[[:digit:]]</code>', 'um dígito (forma POSIX, mais legível)'],
            ['<code>[[:alpha:]]</code>', 'uma letra'],
            ['<code>[[:space:]]</code>', 'espaço, tab ou quebra de linha']
          ]
        }
      },

      { h2: 'Quantificadores: quantas vezes' },
      {
        table: {
          head: ['Padrão', 'Repete o item anterior…'],
          rows: [
            ['<code>*</code>', 'zero ou mais vezes'],
            ['<code>+</code>', 'uma ou mais vezes (só em ERE)'],
            ['<code>?</code>', 'zero ou uma vez (só em ERE)'],
            ['<code>{3}</code>', 'exatamente 3 vezes'],
            ['<code>{2,5}</code>', 'de 2 a 5 vezes'],
            ['<code>{3,}</code>', '3 ou mais vezes']
          ]
        }
      },
      {
        box: 'note', label: 'BRE e ERE — por que o -E existe', body: [
          { p: 'O <code>grep</code> tem duas gramáticas. Na básica (<strong>BRE</strong>, o padrão), os símbolos <code>+</code>, <code>?</code>, <code>|</code>, <code>(</code> e <code>{</code> são literais e precisam de contrabarra para virarem operadores. Na estendida (<strong>ERE</strong>, com <code>-E</code>), eles já são operadores.' },
          { p: 'Conselho prático: <strong>use sempre <code>-E</code></strong>. A sintaxe fica igual à que você conhece de outras linguagens e você para de brigar com contrabarras.' }
        ]
      },
      {
        code: [
          '# as duas linhas fazem a mesma coisa',
          '$ grep -E "(500|502)" /var/log/app/acesso.log | head -2',
          '$ grep "\\(500\\|502\\)" /var/log/app/acesso.log | head -2'
        ]
      },

      { h2: 'Padrões que você vai usar de verdade' },
      {
        cheat: [
          ['^$', 'linha vazia'],
          ['^#', 'linha de comentário'],
          ['^[^#]', 'linha que NÃO é comentário'],
          ['[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}', 'endereço IPv4'],
          ['[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', 'e-mail'],
          ['^[0-9]{4}-[0-9]{2}-[0-9]{2}', 'data ISO no início da linha'],
          ['" [45][0-9]{2} "', 'código HTTP de erro (4xx ou 5xx)'],
          ['[[:space:]]+$', 'espaços sobrando no fim da linha']
        ]
      },
      { p: 'Testando alguns deles no log de acesso:' },
      {
        code: [
          '$ grep -oE "^[0-9]{1,3}(\\.[0-9]{1,3}){3}" /var/log/app/acesso.log | head -5',
          '$ grep -cE \'" [45][0-9]{2} \' /var/log/app/acesso.log'
        ]
      },
      { p: 'O <code>-o</code> é a peça que falta para <strong>extrair</strong> em vez de só filtrar: ele imprime apenas o trecho que casou, não a linha inteira.' },

      { h2: 'Aspas: sempre' },
      {
        box: 'tip', body: [
          { p: 'Coloque o padrão entre <strong>aspas simples</strong>. Sem elas, o shell tenta interpretar <code>*</code>, <code>$</code>, <code>?</code> e espaços antes do <code>grep</code> ver o padrão. Use aspas duplas apenas quando quiser que uma variável seja expandida dentro do padrão.' }
        ]
      },
      {
        code: [
          "$ grep -E '^[0-9]+' arquivo.txt      # correto",
          '$ grep -E ^[0-9]+ arquivo.txt        # o shell pode estragar o padrão'
        ], run: false, mixed: false
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>^</code> início, <code>$</code> fim, <code>.</code> qualquer caractere, <code>[...]</code> classe.',
          '<code>*</code> zero+ · <code>+</code> um+ · <code>?</code> zero ou um · <code>{n,m}</code> intervalo.',
          'Use <code>grep -E</code> sempre: a sintaxe fica moderna e previsível.',
          '<code>-o</code> extrai só o trecho que casou.',
          'Padrão sempre entre aspas simples.'
        ]
      }
    ],
    tasks: [
      {
        id: 't3-2-a', kind: 'guiado', title: 'Âncoras e classes',
        body: [
          { p: 'Compare com e sem âncora, e veja a diferença entre filtrar e extrair:' },
          {
            code: [
              '$ grep -c "root" /etc/passwd',
              '$ grep -c "^root" /etc/passwd',
              "$ grep -E '^[a-z]+:x:[0-9]{4}:' /etc/passwd",
              "$ grep -oE '^[a-z]+' /etc/passwd | head -5"
            ]
          },
          { p: 'A terceira linha encontra os usuários com UID de <strong>exatamente</strong> quatro dígitos — os humanos, na faixa 1000–9999. A quarta extrai apenas o nome de cada usuário.' },
          {
            box: 'note', body: [
              { p: 'Repare no <code>:</code> no fim do padrão: <code>[0-9]{4}:</code>. Sem ele, o <code>{4}</code> significaria "pelo menos quatro dígitos", e a busca casaria também o <code>nobody</code>, cujo UID é <code>65534</code>. É o tipo de detalhe que faz um relatório de auditoria ficar silenciosamente errado.' }
            ]
          }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /grep[^|]*\^root/), 'Use a âncora <code>^</code> em um padrão.'],
          [() => H.usedCommand(ctx, /grep\s+-[a-zA-Z]*o[a-zA-Z]*E?\s|grep\s+-oE/), 'Use a opção <code>-o</code> para extrair só o trecho que casou.']
        ])
      },
      {
        id: 't3-2-f', kind: 'fill', title: 'Complete a expressão',
        body: [
          { p: 'Você quer encontrar, no log de acesso, todas as linhas cujo código HTTP seja <strong>4xx ou 5xx</strong> (qualquer erro). O código aparece entre aspas e o tamanho, assim: <code>"GET / HTTP/1.1" 404 1832</code>.' },
          { p: 'Complete a classe de caracteres que representa "4 ou 5":' }
        ],
        template: `grep -E '" ___[0-9]{2} ' /var/log/app/acesso.log`, sample: '[45]',
        answers: ['\\[45\\]'],
        hints: ['Você precisa de uma classe que aceite o dígito 4 <em>ou</em> o dígito 5.'],
        solution: 'A resposta é <code>[45]</code>. O padrão completo fica <code>grep -E \'" [45][0-9]{2} \' arquivo</code>: um espaço, o dígito 4 ou 5, mais dois dígitos quaisquer, e outro espaço.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').trim();
          if (/^\(4\|5\)$/.test(v)) return { ok: true, msg: 'Funciona também! <code>(4|5)</code> é equivalente em ERE.' };
          return LX.H.checkAll([
            [/^\[45\]$|^\[54\]$/.test(v), 'Use uma classe de caracteres com os dígitos 4 e 5: <code>[45]</code>.']
          ]);
        }
      },
      {
        id: 't3-2-b', kind: 'desafio', title: 'Extraia os IPs que mais acessaram',
        body: [
          { p: 'No log <code>/var/log/app/acesso.log</code>, o endereço IP é a <strong>primeira coisa de cada linha</strong>.' },
          { p: 'Grave em <code>~/ips.txt</code> a lista de <strong>IPs distintos</strong> que aparecem no log, cada um em uma linha, sem repetição.' },
          { p: 'Extraia com regex — não vale usar <code>cut</code> nem <code>awk</code> ainda.' }
        ],
        hints: [
          'Um IPv4 no início da linha: <code>^[0-9]{1,3}(\\.[0-9]{1,3}){3}</code>. Use <code>grep -oE</code> para extrair só ele.',
          'Depois de extrair, você tem uma lista com repetições. <code>sort -u</code> ordena e remove duplicatas de uma vez.'
        ],
        solution: `<div class="code"><pre>grep -oE '^[0-9]{1,3}(\\.[0-9]{1,3}){3}' /var/log/app/acesso.log | sort -u &gt; ~/ips.txt\ncat ~/ips.txt</pre></div><p style="margin-top:8px">O <code>-o</code> extrai, o <code>sort -u</code> deduplica. Sem o <code>-o</code>, você teria a linha inteira.</p>`,
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/ips.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/ips.txt ainda não existe.' };
          const log = H.read(ctx, '/var/log/app/acesso.log') || '';
          const esperados = Array.from(new Set((log.match(/^[0-9]{1,3}(\.[0-9]{1,3}){3}/gm) || []))).sort();
          const obtidos = c.split('\n').map(l => l.trim()).filter(Boolean).sort();
          const usouProibido = (ctx.term.history || []).some(h => /(cut|awk)/.test(h) && /ips\.txt/.test(h));
          return LX.H.checkAll([
            [!usouProibido, 'Você usou <code>cut</code> ou <code>awk</code>. O desafio pede extração por regex com <code>grep -oE</code>.'],
            [obtidos.length === esperados.length, `Encontrei ${obtidos.length} IP(s); são esperados ${esperados.length} distintos.`],
            [esperados.every(ip => obtidos.includes(ip)), 'Alguns IPs do log estão faltando na sua lista.'],
            [obtidos.every(l => /^[0-9.]+$/.test(l)), 'Alguma linha contém mais do que apenas o IP. Use <code>-o</code> para extrair só a parte que casou.']
          ]);
        }
      }
    ]
  });

  /* ============================== 4.3 ============================== */
  LX.lesson('m03', {
    id: 'l3-3', n: '4.3', title: 'find: encontrar arquivos por critério',
    goal: 'Localizar arquivos por nome, tamanho, data, dono ou permissão — e executar ações em massa sobre o que encontrar.',
    brief: [
      { p: '<code>find ONDE CRITÉRIOS</code> procura arquivos e diretórios. Combine <code>-type f</code> para arquivos, <code>-type d</code> para pastas, <code>-name</code> para nome, <code>-size</code> para tamanho e <code>-mtime</code> para data.' },
      { code: ['$ find . -type f -name "*.log"', '$ find /var/log -type f -size +10M', '$ find . -type f -mtime -7'] },
      { p: 'Coloque padrões como <code>*.log</code> entre aspas para o shell não expandi-los antes do <code>find</code>. Vários critérios na mesma linha precisam ser verdadeiros ao mesmo tempo.' }
    ],
    body: [
      { p: 'Se o <code>grep</code> procura <em>dentro</em> dos arquivos, o <code>find</code> procura <em>os</em> arquivos. A forma geral é:' },
      { code: ['find ONDE CRITÉRIOS AÇÃO'], run: false, mixed: false, lang: 'text' },
      { code: ['$ find ~/documentos', '$ find ~/projetos -type f'] },

      { h2: 'Critérios por nome' },
      { code: ['$ find /etc -name "*.conf"', '$ find ~ -iname "*.TXT"', '$ find ~ -name "notas*"'] },
      {
        box: 'warn', body: [
          { p: 'Coloque o padrão entre <strong>aspas</strong>. Sem elas, o shell expande o <code>*</code> antes de o <code>find</code> ver — e o resultado fica errado de um jeito difícil de perceber.' }
        ]
      },

      { h2: 'Critérios por tipo, tamanho e data' },
      {
        table: {
          head: ['Critério', 'Significado'],
          rows: [
            ['<code>-type f</code>', 'arquivo comum'],
            ['<code>-type d</code>', 'diretório'],
            ['<code>-type l</code>', 'link simbólico'],
            ['<code>-size +10M</code>', 'maior que 10 MB'],
            ['<code>-size -1k</code>', 'menor que 1 KB'],
            ['<code>-empty</code>', 'vazio (arquivo ou diretório)'],
            ['<code>-mtime -7</code>', 'modificado nos últimos 7 dias'],
            ['<code>-mtime +30</code>', 'modificado há mais de 30 dias'],
            ['<code>-mmin -60</code>', 'modificado na última hora'],
            ['<code>-newer arq</code>', 'mais recente que outro arquivo'],
            ['<code>-user aluno</code>', 'pertence a um usuário'],
            ['<code>-perm 777</code>', 'com permissão exatamente 777'],
            ['<code>-perm -u+x</code>', 'que tenha, ao menos, execução para o dono'],
            ['<code>-maxdepth 2</code>', 'no máximo dois níveis abaixo']
          ]
        }
      },
      {
        code: [
          '$ find /var/log -type f -size +1k',
          '$ find ~ -type f -mtime -1',
          '$ find ~ -type d -empty',
          '$ find /etc -maxdepth 1 -name "*.conf"'
        ]
      },
      { p: 'Critérios se acumulam com "E" implícito: <code>find ~ -type f -name "*.log" -size +1k</code> exige as três coisas ao mesmo tempo.' },
      {
        box: 'tip', label: 'Sinais no -size e no -mtime', body: [
          { p: 'Sem sinal significa "exatamente". <code>+</code> significa "mais que". <code>-</code> significa "menos que". A confusão mais comum: <code>-mtime 7</code> não é "última semana", é "exatamente no sétimo dia atrás". Você quase sempre quer <code>-mtime -7</code>.' }
        ]
      },

      { h2: 'Ações: fazer algo com o que encontrou' },
      { p: 'O <code>find</code> não serve só para listar. Ele executa comandos sobre cada resultado.' },
      { h4: '-exec' },
      { code: ['$ find ~/projetos -name "*.html" -exec ls -lh {} \\;'] },
      { p: 'O <code>{}</code> é substituído pelo arquivo encontrado; o <code>\\;</code> encerra o comando. A contrabarra existe para o shell não engolir o ponto e vírgula.' },
      { p: 'Existe uma variante muito mais eficiente:' },
      { code: ['$ find ~/projetos -name "*.html" -exec ls -lh {} +'] },
      { p: 'Com <code>+</code>, o <code>find</code> junta vários arquivos em <strong>uma única chamada</strong> do comando, em vez de chamar uma vez por arquivo. Em diretórios grandes, a diferença é de segundos para minutos.' },
      { h4: '-delete' },
      { code: ['$ find /tmp -name "*.tmp" -type f -delete'] },
      {
        box: 'warn', label: 'Sempre em dois passos', body: [
          { p: 'Nunca escreva <code>-delete</code> de primeira. Rode o mesmo <code>find</code> <strong>sem</strong> a ação para ver a lista, confira, e só então acrescente o <code>-delete</code>. O <code>find</code> não pergunta nada.' }
        ]
      },

      { h2: 'find × locate' },
      { p: 'Existe uma alternativa muito mais rápida para busca por nome: o <code>locate</code>. Ele não varre o disco — consulta um banco de dados criado periodicamente pelo <code>updatedb</code>.' },
      { code: ['$ sudo updatedb', '$ locate sshd_config', '$ locate -i NOTAS'] },
      {
        table: {
          head: ['', '<code>find</code>', '<code>locate</code>'],
          rows: [
            ['Velocidade', 'lento (varre o disco)', '<strong>instantâneo</strong>'],
            ['Atualidade', '<strong>sempre atual</strong>', 'até a última indexação'],
            ['Critérios', 'nome, tamanho, data, dono, permissão…', 'só o caminho'],
            ['Ações', '<code>-exec</code>, <code>-delete</code>', 'nenhuma'],
            ['Instalado por padrão', 'sim', 'nem sempre']
          ]
        }
      },
      { p: 'Regra simples: <strong>procurando pelo nome e com pressa</strong>, use <code>locate</code>. <strong>Qualquer outro critério</strong>, ou arquivos criados agora, use <code>find</code>.' },

      { h2: 'Resumo' },
      {
        cheat: [
          ['find . -name "*.log"', 'por nome (com aspas!)'],
          ['find . -type f -size +100M', 'arquivos grandes'],
          ['find . -mtime -7', 'modificados na última semana'],
          ['find . -type d -empty -delete', 'limpa diretórios vazios'],
          ['find . -name "*.sh" -exec chmod +x {} +', 'ação em massa, eficiente'],
          ['locate nome', 'busca instantânea por nome']
        ]
      }
    ],
    tasks: [
      {
        id: 't3-3-a', kind: 'guiado', title: 'Busque por vários critérios',
        body: [
          { p: 'Rode e observe como cada critério vai estreitando o resultado:' },
          {
            code: [
              '$ find ~ -type f | wc -l',
              '$ find ~ -type f -name "*.txt"',
              '$ find ~ -type f -name "*.txt" -size +100c',
              '$ find /var/log -type f -exec ls -lh {} +'
            ]
          }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /find[^|]*-type\s+f/), 'Use <code>find</code> com <code>-type f</code>.'],
          [() => H.usedCommand(ctx, /find[^|]*-name/), 'Use o critério <code>-name</code>.'],
          [() => H.usedCommand(ctx, /find[^|]*-exec/), 'Use uma ação <code>-exec</code>.']
        ])
      },
      {
        id: 't3-3-q', kind: 'quiz', title: 'Por que essa busca não funcionou?',
        body: [
          { p: 'Você está em <code>~/projetos</code>, que contém <code>index.html</code> e <code>estilo.css</code> dentro de <code>site/</code>. Você roda:' },
          { code: ['find . -name *.html'], run: false, mixed: false },
          { p: 'E recebe um erro estranho ou nenhum resultado. Qual é a causa?' }
        ],
        options: [
          { text: 'O padrão está sem aspas: o shell tentou expandi-lo antes do <code>find</code> receber.', correct: true },
          { text: 'Falta a opção <code>-type f</code>.', why: 'Sem <code>-type</code> o find busca tudo — isso amplia o resultado, não o elimina.' },
          { text: 'O <code>find</code> não desce em subdiretórios sem <code>-r</code>.', why: 'O <code>find</code> é recursivo por natureza. Ele não tem nem aceita <code>-r</code>.' },
          { text: 'É preciso usar caminho absoluto.', why: 'O <code>.</code> é perfeitamente válido e significa "a partir daqui".' }
        ],
        explain: 'Sem aspas, o shell tenta expandir <code>*.html</code> no diretório <em>atual</em>. Se não houver nenhum <code>.html</code> ali, ele passa o literal <code>*.html</code> e por acaso funciona; se houver <strong>um</strong>, o find recebe aquele nome fixo; se houver <strong>vários</strong>, o find recebe argumentos demais e reclama. Escreva sempre <code>find . -name "*.html"</code>.'
      },
      {
        id: 't3-3-b', kind: 'desafio', title: 'Faxina programada',
        body: [
          { p: 'Monte o cenário:' },
          {
            code: [
              '$ mkdir -p ~/faxina/{cache,uploads,vazio1,vazio2}',
              '$ touch ~/faxina/cache/{a,b,c}.tmp ~/faxina/uploads/foto.jpg ~/faxina/uploads/doc.pdf',
              '$ touch -d "2019-05-10" ~/faxina/uploads/doc.pdf',
              '$ ls -R ~/faxina'
            ]
          },
          { p: 'Agora, usando <strong>apenas <code>find</code></strong>:' },
          {
            ol: [
              'grave em <code>~/antigos.txt</code> a lista dos arquivos dentro de <code>~/faxina</code> modificados há <strong>mais de 365 dias</strong>;',
              'apague todos os arquivos <code>.tmp</code> de <code>~/faxina</code>;',
              'apague os <strong>diretórios vazios</strong> de <code>~/faxina</code>.'
            ]
          },
          { p: 'Confira cada busca antes de apagar.' }
        ],
        hints: [
          'Arquivos antigos: <code>find ~/faxina -type f -mtime +365</code>. Redirecione com <code>&gt;</code>.',
          'Para apagar: acrescente <code>-delete</code> ao mesmo find. Diretórios vazios: <code>find ~/faxina -type d -empty -delete</code>.'
        ],
        solution: '<div class="code"><pre>find ~/faxina -type f -mtime +365 &gt; ~/antigos.txt\ncat ~/antigos.txt\n\nfind ~/faxina -type f -name "*.tmp"\nfind ~/faxina -type f -name "*.tmp" -delete\n\nfind ~/faxina -type d -empty\nfind ~/faxina -type d -empty -delete\n\nls -R ~/faxina</pre></div>',
        check: async (ctx) => {
          const base = '/home/aluno/faxina';
          const c = H.read(ctx, '/home/aluno/antigos.txt');
          const cache = H.ls(ctx, base + '/cache');
          return LX.H.checkAll([
            [c !== null, 'O arquivo ~/antigos.txt ainda não existe.'],
            [c && /doc\.pdf/.test(c), 'A lista de antigos deveria conter o <code>doc.pdf</code> (data de 2019).'],
            [c && !/foto\.jpg/.test(c), 'A lista contém o <code>foto.jpg</code>, que é recente. Use <code>-mtime +365</code>.'],
            [!cache || cache.filter(n => n.endsWith('.tmp')).length === 0, 'Ainda existem arquivos <code>.tmp</code> em <code>~/faxina</code>.'],
            [!H.exists(ctx, base + '/vazio1') && !H.exists(ctx, base + '/vazio2'), 'Os diretórios vazios ainda existem.'],
            [H.isFile(ctx, base + '/uploads/foto.jpg'), 'O arquivo <code>foto.jpg</code> foi apagado — ele deveria ser preservado.'],
            [() => H.usedCommand(ctx, /find[^|]*-delete/), 'Use a ação <code>-delete</code> do próprio <code>find</code>.']
          ]);
        }
      },

    ]
  });

  /* ============================== 4.4 ============================== */
  LX.lesson('m03', {
    id: 'l3-4', n: '4.4', title: 'Recortar e resumir: cut, sort, uniq, tr e wc',
    goal: 'Cinco ferramentas pequenas que, combinadas, respondem quase qualquer pergunta sobre um arquivo de dados.',
    brief: [
      { p: '<code>cut</code> seleciona campos, <code>sort</code> ordena, <code>uniq</code> agrupa linhas repetidas, <code>tr</code> troca caracteres e <code>wc</code> conta. O valor aparece quando você conecta essas ferramentas com pipes.' },
      { code: ['$ cut -d, -f3 servidores.csv | sort | uniq -c | sort -rn', '$ wc -l app.log'] },
      { p: 'Use <code>sort -n</code> para números. Como <code>uniq</code> reconhece apenas repetições adjacentes, normalmente ele vem depois de <code>sort</code>. Em CSV complexo, com vírgulas entre aspas, essas ferramentas simples não bastam.' }
    ],
    body: [
      { p: 'A filosofia Unix em uma frase: <em>programas pequenos que fazem uma coisa bem e se encaixam</em>. Este é o kit de encaixe.' },

      { cmd: 'cut' },
      { p: 'Recorta <strong>colunas</strong> de cada linha. Precisa saber duas coisas: qual o separador (<code>-d</code>) e quais campos (<code>-f</code>).' },
      { code: ['$ head -3 ~/documentos/servidores.csv', '$ cut -d, -f1 ~/documentos/servidores.csv', '$ cut -d, -f1,3 ~/documentos/servidores.csv', '$ cut -d, -f2-4 ~/documentos/servidores.csv'] },
      { p: 'No <code>/etc/passwd</code>, o separador é <code>:</code>:' },
      { code: ['$ cut -d: -f1,7 /etc/passwd | head -6'] },
      {
        cheat: [
          ['cut -d, -f2', 'o segundo campo'],
          ['cut -d, -f1,3', 'campos 1 e 3'],
          ['cut -d, -f2-', 'do segundo em diante'],
          ['cut -c1-10', 'os 10 primeiros caracteres'],
          ['cut -d, -f2 --output-delimiter=" "', 'troca o separador de saída']
        ]
      },
      {
        box: 'warn', label: 'A limitação do cut', body: [
          { p: 'O <code>cut</code> só entende separador de <strong>um caractere</strong> e não sabe lidar com múltiplos espaços seguidos. Para saída de comandos alinhada por espaços variáveis (como <code>ls -l</code> ou <code>ps</code>), ele falha — use <code>awk</code> (aula 4.6).' }
        ]
      },

      { cmd: 'sort' },
      { p: 'Ordena linhas. Alfabeticamente por padrão — o que gera a pegadinha mais comum do terminal:' },
      { code: ['$ printf "10\\n9\\n100\\n2\\n" | sort', '$ printf "10\\n9\\n100\\n2\\n" | sort -n'] },
      { p: 'Sem o <code>-n</code>, "10" vem antes de "9" porque a comparação é caractere por caractere.' },
      {
        cheat: [
          ['sort -n', 'ordem numérica'],
          ['sort -h', 'numérica com sufixos (1K, 2M, 3G)'],
          ['sort -r', 'ordem inversa'],
          ['sort -u', 'ordena e remove duplicatas'],
          ['sort -k2', 'ordena pelo segundo campo'],
          ['sort -t, -k3', 'campo 3, separador vírgula'],
          ['sort -t, -k5 -n -r', 'campo 5, numérico, decrescente']
        ]
      },
      { code: ['$ sort -t, -k5 -n -r ~/documentos/servidores.csv | head -3'] },

      { cmd: 'uniq' },
      { p: 'Remove linhas repetidas — mas apenas quando elas estão <strong>adjacentes</strong>. Por isso ele quase sempre vem depois de um <code>sort</code>.' },
      { code: ['$ cut -d, -f3 ~/documentos/servidores.csv | sort | uniq', '$ cut -d, -f3 ~/documentos/servidores.csv | sort | uniq -c'] },
      { p: 'O <code>-c</code> transforma o <code>uniq</code> em uma máquina de contar ocorrências — talvez o combo mais útil de todo o terminal:' },
      {
        code: [
          '# ranking de ambientes por quantidade de servidores',
          '$ cut -d, -f3 ~/documentos/servidores.csv | tail -n +2 | sort | uniq -c | sort -rn'
        ]
      },
      {
        cheat: [
          ['uniq -c', 'conta as ocorrências'],
          ['uniq -d', 'só as linhas duplicadas'],
          ['uniq -u', 'só as que aparecem uma vez'],
          ['uniq -i', 'ignora maiúsculas']
        ]
      },
      {
        box: 'key', label: 'O padrão que você vai repetir a vida toda', body: [
          { p: '<code>extrair | sort | uniq -c | sort -rn</code>. Extraia a coluna que interessa, ordene, conte e ordene pela contagem. É assim que se descobre o IP que mais acessou, a URL mais pedida, o erro mais frequente.' }
        ]
      },

      { cmd: 'tr' },
      { p: '<em>Translate</em>: troca ou apaga caracteres. Não trabalha com linhas, e sim caractere a caractere. Só lê da entrada padrão.' },
      {
        code: [
          '$ echo "olá mundo" | tr a-z A-Z',
          '$ echo "a,b,c" | tr "," "\\n"',
          '$ echo "texto   com   espaços" | tr -s " "',
          '$ echo "remova os digitos 123" | tr -d "0-9"'
        ]
      },
      {
        cheat: [
          ['tr a-z A-Z', 'para maiúsculas'],
          ['tr -d "x"', 'apaga o caractere'],
          ['tr -s " "', 'colapsa repetições'],
          ['tr "," "\\n"', 'troca vírgula por quebra de linha'],
          ['tr -cd "[:print:]"', 'remove caracteres não imprimíveis']
        ]
      },

      { cmd: 'wc' },
      { p: '<em>Word count</em>: conta linhas, palavras e bytes.' },
      { code: ['$ wc ~/documentos/notas.txt', '$ wc -l /var/log/app/acesso.log', '$ wc -w ~/documentos/notas.txt', '$ ls /usr/bin | wc -l'] },
      {
        box: 'tip', body: [
          { p: '<code>wc -l arquivo</code> imprime o número <em>e</em> o nome. <code>wc -l &lt; arquivo</code> imprime só o número — porque o comando recebe os dados pela entrada padrão e não sabe o nome do arquivo. Use a segunda forma quando quiser o valor puro para um script.' }
        ]
      },

      { h2: 'Juntando tudo' },
      { p: 'Uma pergunta real: <em>quais são os cinco IPs que mais acessaram o servidor?</em>' },
      {
        code: [
          '$ grep -oE "^[0-9]+(\\.[0-9]+){3}" /var/log/app/acesso.log | sort | uniq -c | sort -rn | head -5'
        ]
      },
      { p: 'Cinco comandos simples, nenhum deles sabendo o que é um log, respondendo a uma pergunta específica. É esse encaixe que faz o terminal valer a pena.' },

      { h2: 'Resumo' },
      {
        cheat: [
          ['cut -d, -f2', 'recorta colunas por separador'],
          ['sort -n / -h / -r / -u', 'ordena numérico / legível / invertido / único'],
          ['sort -t, -k3 -n', 'ordena pelo campo 3'],
          ['uniq -c', 'conta ocorrências (precisa de sort antes)'],
          ['tr a-z A-Z / tr -d / tr -s', 'troca, apaga e colapsa caracteres'],
          ['wc -l', 'conta linhas']
        ]
      }
    ],
    tasks: [
      {
        id: 't3-4-a', kind: 'guiado', title: 'O padrão do ranking',
        body: [
          { p: 'Construa o pipeline por partes e veja o que cada etapa acrescenta:' },
          {
            code: [
              '$ cut -d, -f3 ~/documentos/servidores.csv',
              '$ cut -d, -f3 ~/documentos/servidores.csv | tail -n +2',
              '$ cut -d, -f3 ~/documentos/servidores.csv | tail -n +2 | sort',
              '$ cut -d, -f3 ~/documentos/servidores.csv | tail -n +2 | sort | uniq -c',
              '$ cut -d, -f3 ~/documentos/servidores.csv | tail -n +2 | sort | uniq -c | sort -rn'
            ]
          },
          { p: 'O <code>tail -n +2</code> descarta o cabeçalho. Sem ele, a palavra "ambiente" entraria na contagem.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /cut\s+-d/), 'Use o <code>cut</code> com <code>-d</code> e <code>-f</code>.'],
          [() => H.usedCommand(ctx, /uniq\s+-c/), 'Use <code>uniq -c</code> para contar.'],
          [() => H.usedCommand(ctx, /sort\s+-[a-z]*r[a-z]*n|sort\s+-n[a-z]*r/), 'Ordene o resultado por quantidade com <code>sort -rn</code>.']
        ])
      },
      {
        id: 't3-4-p', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Um arquivo <code>frutas.txt</code> contém, nesta ordem: <code>uva</code>, <code>maca</code>, <code>uva</code>, <code>pera</code>, <code>uva</code>.' },
          { p: 'O que <code>uniq -c frutas.txt</code> imprime?' }
        ],
        options: [
          { text: 'Cinco linhas: 1 uva, 1 maca, 1 uva, 1 pera, 1 uva — cada uma com contagem 1.', correct: true, why: '' },
          { text: 'Três linhas: 3 uva, 1 maca, 1 pera.', why: 'Isso só aconteceria se as "uva" estivessem juntas. O <code>uniq</code> compara apenas linhas <strong>adjacentes</strong>.' },
          { text: 'Erro: o <code>uniq</code> exige entrada ordenada.', why: 'Ele não exige nem reclama — apenas produz um resultado que não é o esperado.' },
          { text: 'Uma linha: 5 uva.', why: 'Ele nunca junta linhas diferentes.' }
        ],
        explain: 'Como as três "uva" não são vizinhas, o <code>uniq</code> não as agrupa: a saída tem cinco linhas com contagem 1 cada. Por isso o pipeline correto é sempre <code>sort frutas.txt | uniq -c</code> — o <code>sort</code> junta as iguais e só então o <code>uniq</code> consegue contar.'
      },
      {
        id: 't3-4-b', kind: 'desafio', title: 'Top 3 do log de acesso',
        body: [
          { p: 'Usando o log <code>/var/log/app/acesso.log</code>, produza <code>~/top.txt</code> com <strong>as três URLs mais requisitadas</strong>, no formato do <code>uniq -c</code> (quantidade seguida da URL), da mais pedida para a menos.' },
          { p: 'O caminho é o terceiro campo quando se separa por espaço, dentro das aspas: <code>"GET /api/status HTTP/1.1"</code>.' }
        ],
        hints: [
          'Extraia com regex: <code>grep -oE \'"GET [^ ]+\' arquivo</code> pega o método e o caminho. Depois recorte o caminho com <code>cut -d" " -f2</code>.',
          'Complete com o padrão do ranking: <code>| sort | uniq -c | sort -rn | head -3</code>.'
        ],
        solution: `<div class="code"><pre>grep -oE '"GET [^ ]+' /var/log/app/acesso.log \\\n  | cut -d" " -f2 \\\n  | sort | uniq -c | sort -rn | head -3 &gt; ~/top.txt\n\ncat ~/top.txt</pre></div>`,
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/top.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/top.txt ainda não existe.' };
          const log = H.read(ctx, '/var/log/app/acesso.log') || '';
          const caminhos = (log.match(/"GET ([^ ]+)/g) || []).map(s => s.slice(5));
          const cont = {};
          caminhos.forEach(p => cont[p] = (cont[p] || 0) + 1);
          const top = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 3);
          const linhas = c.split('\n').filter(l => l.trim());
          return LX.H.checkAll([
            [linhas.length === 3, `O arquivo tem ${linhas.length} linha(s); são esperadas exatamente 3.`],
            [linhas.every(l => /^\s*\d+\s+\S+/.test(l)), 'Cada linha deve ter a contagem seguida da URL (formato do <code>uniq -c</code>).'],
            [linhas[0] && linhas[0].includes(top[0][0]), `A URL mais requisitada é <code>${top[0][0]}</code> e ela deveria estar na primeira linha.`],
            [top.slice(0, 3).every(([p]) => c.includes(p)), 'Alguma das três URLs mais requisitadas está faltando.'],
            [() => H.usedCommand(ctx, /uniq\s+-c/), 'Use o padrão <code>sort | uniq -c | sort -rn</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 4.5 ============================== */
  LX.lesson('m03', {
    id: 'l3-5', n: '4.5', title: 'sed: editar sem abrir o arquivo',
    goal: 'Substituir texto em massa, apagar linhas e transformar arquivos por script — a ferramenta que automatiza o "abre e troca".',
    brief: [
      { p: '<code>sed</code> transforma texto linha por linha. A forma mais usada é <code>s/procurar/trocar/</code>; a flag <code>g</code> troca todas as ocorrências da linha. Sem <code>-i</code>, o arquivo original não muda.' },
      { code: ['$ sed "s/8080/9090/g" app.conf', '$ sed "/^#/d" app.conf'] },
      { p: 'Primeiro confira a saída na tela. Só depois use <code>sed -i.bak</code> para editar o arquivo e criar uma cópia de segurança. Quando o texto contém barras, outro separador deixa o comando mais legível: <code>s|/antigo|/novo|</code>.' }
    ],
    body: [
      { p: '<code>sed</code> é o <em>stream editor</em>: ele lê linha por linha, aplica um comando e imprime o resultado. Por padrão <strong>não altera o arquivo</strong> — só mostra na tela o que sairia.' },

      { h2: 'A substituição: s' },
      { p: 'Noventa por cento do uso do <code>sed</code> é uma única forma:' },
      { code: ['s/procurar/trocar/flags'], run: false, mixed: false, lang: 'text' },
      { code: ['$ echo "porta=8080" | sed \'s/8080/9090/\'', '$ sed \'s/ERROR/ERRO/\' /var/log/app/erro.log'] },
      { h3: 'As flags' },
      {
        table: {
          head: ['Flag', 'Efeito'],
          rows: [
            ['(nenhuma)', 'troca apenas a <strong>primeira</strong> ocorrência de cada linha'],
            ['<code>g</code>', '<em>global</em>: troca <strong>todas</strong> as ocorrências da linha'],
            ['<code>i</code>', 'ignora maiúsculas/minúsculas'],
            ['<code>2</code>', 'troca apenas a segunda ocorrência'],
            ['<code>p</code>', 'imprime a linha alterada (use com <code>-n</code>)']
          ]
        }
      },
      {
        code: [
          '$ echo "a-b-c-d" | sed \'s/-/+/\'',
          '$ echo "a-b-c-d" | sed \'s/-/+/g\'',
          '$ echo "a-b-c-d" | sed \'s/-/+/2\''
        ]
      },
      {
        box: 'tip', label: 'O separador não precisa ser barra', body: [
          { p: 'Quando o texto contém barras (caminhos!), troque o delimitador: <code>sed \'s|/var/log|/opt/log|\'</code>. Qualquer caractere serve — <code>|</code>, <code>#</code>, <code>,</code>. Isso evita a "cerca de contrabarras" <code>s/\\/var\\/log/\\/opt\\/log/</code>.' }
        ]
      },

      { h2: 'Endereços: onde aplicar' },
      { p: 'Antes do comando você pode dizer <em>em quais linhas</em> ele age:' },
      {
        table: {
          head: ['Endereço', 'Significa'],
          rows: [
            ['<code>3s/a/b/</code>', 'só na linha 3'],
            ['<code>2,5s/a/b/</code>', 'nas linhas 2 a 5'],
            ['<code>$s/a/b/</code>', 'só na última linha'],
            ['<code>/erro/s/a/b/</code>', 'só nas linhas que contêm "erro"'],
            ['<code>/^#/d</code>', 'apaga as linhas que começam com #']
          ]
        }
      },
      { code: ['$ sed \'2,3s/^/>> /\' ~/documentos/notas.txt | head -5'] },

      { h2: 'Outros comandos além do s' },
      {
        cheat: [
          ["sed '3d' arq", 'apaga a linha 3'],
          ["sed '/^#/d' arq", 'apaga comentários'],
          ["sed '/^$/d' arq", 'apaga linhas vazias'],
          ["sed -n '5,10p' arq", 'imprime só as linhas 5 a 10'],
          ["sed -n '$p' arq", 'imprime só a última linha'],
          ["sed '2i TEXTO' arq", 'insere TEXTO antes da linha 2'],
          ["sed '$a TEXTO' arq", 'acrescenta TEXTO ao final'],
          ["sed 'y/abc/xyz/' arq", 'troca caractere por caractere']
        ]
      },
      { p: 'A dupla <code>-n</code> + <code>p</code> merece atenção: o <code>-n</code> desliga a impressão automática e o <code>p</code> imprime só o que você escolheu. É como se recorta um intervalo:' },
      { code: ['$ sed -n \'3,6p\' ~/documentos/servidores.csv'] },
      { p: 'Para remover comentários e linhas em branco de uma configuração, o <code>sed</code> faz em um comando o que precisava de dois <code>grep</code>:' },
      { code: ['$ sed -e \'/^#/d\' -e \'/^$/d\' /etc/ssh/sshd_config'] },

      { h2: 'Editar o arquivo de verdade: -i' },
      { p: 'Por padrão o <code>sed</code> só imprime. Com <code>-i</code> (<em>in place</em>), ele grava.' },
      {
        box: 'warn', label: 'O fluxo seguro, em três passos', body: [
          {
            ol: [
              'Rode <strong>sem</strong> <code>-i</code> e leia a saída.',
              'Se estiver certo, rode com <code>-i.bak</code> — isso grava e ainda deixa uma cópia do original.',
              'Confira o resultado. Se algo deu errado, o <code>.bak</code> te salva.'
            ]
          }
        ]
      },
      {
        code: [
          '$ cp ~/documentos/tarefas.txt ~/tarefas-teste.txt',
          '$ sed \'s/\\[ \\]/[PENDENTE]/g\' ~/tarefas-teste.txt',
          '$ sed -i.bak \'s/\\[ \\]/[PENDENTE]/g\' ~/tarefas-teste.txt',
          '$ cat ~/tarefas-teste.txt',
          '$ ls ~/tarefas-teste*'
        ]
      },

      { h2: 'Grupos de captura' },
      { p: 'Você pode capturar pedaços do que casou e reutilizá-los na substituição. Em ERE (<code>-E</code>), use parênteses; na troca, <code>\\1</code>, <code>\\2</code>…' },
      {
        code: [
          '$ echo "2026-09-01" | sed -E \'s/([0-9]{4})-([0-9]{2})-([0-9]{2})/\\3\\/\\2\\/\\1/\'',
          '$ echo "usuario: ana" | sed -E \'s/usuario: (.*)/\\1@empresa.com/\''
        ]
      },
      { p: 'O <code>&</code> representa tudo o que casou:' },
      { code: ['$ echo "erro 500" | sed -E \'s/[0-9]+/[&]/\''] },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>sed \'s/a/b/\'</code> troca a primeira ocorrência por linha; com <code>g</code>, todas.',
          'Troque o delimitador quando o texto tiver barras: <code>s|a|b|</code>.',
          'Endereços restringem onde agir: <code>3s///</code>, <code>2,5d</code>, <code>/regex/d</code>.',
          '<code>sed -n \'5,10p\'</code> recorta um intervalo de linhas.',
          '<code>-i</code> grava no arquivo. Use <code>-i.bak</code> e teste antes sem <code>-i</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't3-5-a', kind: 'guiado', title: 'Substituir, apagar e recortar',
        body: [
          { p: 'Experimente os três usos principais em um arquivo de teste:' },
          {
            code: [
              '$ cp ~/documentos/notas.txt ~/nota-teste.txt',
              '$ sed \'s/terminal/TERMINAL/g\' ~/nota-teste.txt',
              '$ sed \'/^$/d\' ~/nota-teste.txt',
              '$ sed -n \'1,3p\' ~/nota-teste.txt',
              '$ cat ~/nota-teste.txt'
            ]
          },
          { p: 'Repare que o arquivo original continua intacto no último comando — nenhuma das operações usou <code>-i</code>.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /sed\s+.*s\//), 'Faça uma substituição com <code>sed \'s/.../.../\'</code>.'],
          [() => H.usedCommand(ctx, /sed\s+.*\/d['"]?\s*$|sed[^|]*\/d/), 'Apague linhas com o comando <code>d</code>.'],
          [() => H.usedCommand(ctx, /sed\s+-n/), 'Use <code>sed -n</code> com <code>p</code> para imprimir só um intervalo.']
        ])
      },
      {
        id: 't3-5-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Você quer trocar todas as ocorrências de <code>/var/log</code> por <code>/opt/log</code> dentro de um arquivo de configuração e escreve:' },
          { code: ["sed 's//var/log//opt/log/g' app.conf"], run: false, mixed: false },
          { p: 'O comando falha. Qual é o problema e a melhor correção?' }
        ],
        options: [
          { text: 'As barras do caminho confundem o delimitador. A melhor correção é trocar o delimitador: <code>sed \'s|/var/log|/opt/log|g\'</code>.', correct: true },
          { text: 'Falta a opção <code>-E</code> para caminhos.', why: 'O <code>-E</code> muda a gramática da regex, não tem relação com delimitadores.' },
          { text: 'Falta a opção <code>-i</code>.', why: 'O <code>-i</code> só define se grava no arquivo. Sem ele o comando ainda deveria funcionar e imprimir na tela.' },
          { text: 'Caminhos precisam ser escritos entre aspas duplas.', why: 'O tipo de aspa não resolve a ambiguidade das barras dentro do comando <code>s</code>.' }
        ],
        explain: 'O <code>sed</code> usa o caractere logo após o <code>s</code> como delimitador. Com <code>s/</code>, a primeira barra de <code>/var</code> é lida como fim do padrão. Você pode escapar cada barra (<code>s/\\/var\\/log/\\/opt\\/log/g</code>), mas trocar o delimitador é muito mais legível — e <code>|</code> ou <code>#</code> são as escolhas usuais.'
      },
      {
        id: 't3-5-b', kind: 'desafio', title: 'Prepare uma configuração para produção',
        body: [
          { p: 'Crie o arquivo de configuração de exemplo:' },
          {
            code: [
              `$ cat > ~/app.conf << 'EOF'`,
              `# configuracao da aplicacao`,
              `ambiente=desenvolvimento`,
              ``,
              `# banco de dados`,
              `db_host=localhost`,
              `db_porta=5432`,
              ``,
              `# servidor`,
              `porta=3000`,
              `debug=true`,
              `EOF`,
              `$ cat ~/app.conf`
            ]
          },
          { p: 'Gere a versão de produção em <strong>um único comando <code>sed</code></strong> (pode ter vários <code>-e</code>), gravando em <code>~/app-prod.conf</code>, com estas mudanças:' },
          {
            ol: [
              '<code>ambiente=desenvolvimento</code> vira <code>ambiente=producao</code>;',
              '<code>db_host=localhost</code> vira <code>db_host=db01.interno</code>;',
              '<code>debug=true</code> vira <code>debug=false</code>;',
              'todas as linhas de comentário e todas as linhas em branco são removidas.'
            ]
          }
        ],
        hints: [
          'Você pode encadear vários comandos no mesmo <code>sed</code> com <code>-e</code>: <code>sed -e \'cmd1\' -e \'cmd2\' arquivo</code>.',
          'As remoções são <code>-e \'/^#/d\' -e \'/^$/d\'</code>. Redirecione o resultado com <code>&gt; ~/app-prod.conf</code>.'
        ],
        solution: `<div class="code"><pre>sed -e 's/ambiente=desenvolvimento/ambiente=producao/' \\\n    -e 's/db_host=localhost/db_host=db01.interno/' \\\n    -e 's/debug=true/debug=false/' \\\n    -e '/^#/d' -e '/^$/d' \\\n    ~/app.conf &gt; ~/app-prod.conf\n\ncat ~/app-prod.conf</pre></div>`,
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/app-prod.conf');
          if (c === null) return { ok: false, msg: 'O arquivo ~/app-prod.conf ainda não existe.' };
          const orig = H.read(ctx, '/home/aluno/app.conf');
          return LX.H.checkAll([
            [orig !== null, 'O arquivo de origem <code>~/app.conf</code> não existe. Crie-o com o heredoc do enunciado.'],
            [/ambiente=producao/.test(c), 'A linha <code>ambiente</code> ainda não está como <code>producao</code>.'],
            [/db_host=db01\.interno/.test(c), 'A linha <code>db_host</code> ainda não aponta para <code>db01.interno</code>.'],
            [/debug=false/.test(c), 'A linha <code>debug</code> ainda não está como <code>false</code>.'],
            [!/^#/m.test(c), 'Ainda há linhas de comentário no resultado.'],
            [!/^\s*$/m.test(c.replace(/\n$/, '')), 'Ainda há linhas em branco no resultado.'],
            [/db_porta=5432/.test(c) && /porta=3000/.test(c), 'As linhas que não deveriam mudar sumiram. Só as quatro transformações pedidas.'],
            [orig && /ambiente=desenvolvimento/.test(orig), 'O arquivo original foi alterado. Ele deveria permanecer intacto — não use <code>-i</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 4.6 ============================== */
  LX.lesson('m03', {
    id: 'l3-6', n: '4.6', title: 'awk: a linguagem das colunas',
    goal: 'Processar dados tabulares com condições, cálculos e relatórios — em uma linha de comando.',
    brief: [
      { p: '<code>awk</code> lê cada linha, separa campos e executa uma ação. <code>$1</code> é o primeiro campo, <code>$NF</code> o último, <code>NR</code> o número da linha e <code>-F</code> define o separador.' },
      { code: ['$ awk -F, \'NR > 1 {print $1, $5}\' servidores.csv', '$ awk -F, \'$5 > 8 {print $1}\' servidores.csv'] },
      { p: 'A forma geral é <code>awk \'condição { ação }\' arquivo</code>. Sem uma ação, as linhas que passam pela condição são impressas. Use <code>BEGIN</code> para preparar valores e <code>END</code> para imprimir totais.' }
    ],
    body: [
      { p: 'O <code>awk</code> é uma linguagem de programação completa disfarçada de comando. Mas você não precisa aprender a linguagem inteira: <strong>cinco construções resolvem quase tudo</strong>.' },
      { p: 'A ideia central: o awk lê linha por linha, quebra cada linha em <strong>campos</strong> e executa um bloco de código para cada linha.' },
      { code: ["awk 'padrão { ação }' arquivo"], run: false, mixed: false, lang: 'text' },

      { h2: '1. Campos: $1, $2, $NF' },
      { p: 'Por padrão o separador é espaço em branco (e o awk trata múltiplos espaços corretamente — onde o <code>cut</code> falha).' },
      {
        code: [
          '$ echo "ana silva 30" | awk \'{print $1}\'',
          '$ echo "ana silva 30" | awk \'{print $3, $1}\'',
          '$ echo "ana silva 30" | awk \'{print $NF}\'',
          '$ echo "ana silva 30" | awk \'{print NF}\''
        ]
      },
      {
        cheat: [
          ['$0', 'a linha inteira'],
          ['$1, $2, $3…', 'os campos'],
          ['NF', 'número de campos da linha'],
          ['$NF', 'o último campo'],
          ['$(NF-1)', 'o penúltimo'],
          ['NR', 'número da linha atual'],
          ['FS', 'separador de entrada'],
          ['OFS', 'separador de saída']
        ]
      },
      { p: 'Para outro separador, use <code>-F</code>:' },
      { code: ['$ awk -F, \'{print $1, $5}\' ~/documentos/servidores.csv', '$ awk -F: \'{print $1}\' /etc/passwd | head -5'] },

      { h2: '2. Padrões: filtrar linhas' },
      { p: 'O que vem antes das chaves decide <em>quais</em> linhas serão processadas:' },
      {
        code: [
          '$ awk -F, \'$3 == "producao"\' ~/documentos/servidores.csv',
          '$ awk -F, \'$5 > 8 {print $1, $5}\' ~/documentos/servidores.csv',
          '$ awk -F, \'/web/ {print $1}\' ~/documentos/servidores.csv',
          '$ awk \'NR > 1\' ~/documentos/servidores.csv | head -3'
        ]
      },
      { p: 'O último é o jeito idiomático de pular o cabeçalho: <code>NR &gt; 1</code>.' },
      {
        table: {
          head: ['Padrão', 'Seleciona'],
          rows: [
            ['<code>/texto/</code>', 'linhas que contêm o texto'],
            ['<code>$3 == "x"</code>', 'campo 3 igual a x'],
            ['<code>$5 &gt; 100</code>', 'campo 5 maior que 100 (comparação numérica)'],
            ['<code>$1 ~ /^web/</code>', 'campo 1 casa com a regex'],
            ['<code>$1 !~ /web/</code>', 'campo 1 <em>não</em> casa'],
            ['<code>NR == 1</code>', 'a primeira linha'],
            ['<code>NR &gt; 1 &amp;&amp; $3 == "x"</code>', 'combinação com E'],
            ['<code>NF == 0</code>', 'linhas vazias']
          ]
        }
      },

      { h2: '3. BEGIN e END' },
      { p: '<code>BEGIN</code> roda antes da primeira linha; <code>END</code>, depois da última. É onde vivem cabeçalhos e totais.' },
      {
        code: [
          '$ awk -F, \'NR>1 {soma += $5} END {print "Total de memória:", soma, "GB"}\' ~/documentos/servidores.csv',
          '$ awk -F, \'NR>1 {n++; soma += $4} END {print "Média de CPU:", soma/n}\' ~/documentos/servidores.csv'
        ]
      },
      { p: 'Repare que você não declara variáveis nem as inicializa — no awk elas começam em zero (ou vazio) automaticamente.' },

      { h2: '4. printf: formatar a saída' },
      { p: 'O <code>print</code> é simples; o <code>printf</code> alinha:' },
      {
        code: [
          '$ awk -F, \'NR>1 {printf "%-10s %-14s %3s GB\\n", $1, $3, $5}\' ~/documentos/servidores.csv'
        ]
      },
      {
        cheat: [
          ['%s', 'string'],
          ['%d', 'número inteiro'],
          ['%.2f', 'número com 2 casas decimais'],
          ['%-10s', 'string alinhada à esquerda em 10 colunas'],
          ['%5d', 'inteiro alinhado à direita em 5 colunas'],
          ['\\n', 'quebra de linha (o printf não quebra sozinho)']
        ]
      },

      { h2: '5. Arrays: agrupar e somar' },
      { p: 'Aqui o awk supera qualquer combinação de <code>sort | uniq -c</code>, porque ele agrupa <em>e</em> calcula ao mesmo tempo:' },
      {
        code: [
          '$ awk -F, \'NR>1 {mem[$3] += $5} END {for (a in mem) print a, mem[a], "GB"}\' ~/documentos/servidores.csv'
        ]
      },
      { p: 'Em uma linha: some a memória de cada servidor agrupando por ambiente, e imprima o total de cada grupo. Fazer isso com <code>cut</code>/<code>sort</code>/<code>uniq</code> seria bem mais trabalhoso.' },

      { h2: 'awk × cut × sed' },
      {
        table: {
          head: ['Preciso…', 'Use'],
          rows: [
            ['pegar a coluna 2 de um CSV simples', '<code>cut -d, -f2</code>'],
            ['pegar a coluna 2 de saída alinhada por espaços', '<code>awk \'{print $2}\'</code>'],
            ['trocar texto', '<code>sed \'s/a/b/\'</code>'],
            ['filtrar por valor de uma coluna', '<code>awk \'$3 &gt; 10\'</code>'],
            ['somar, contar, calcular média', '<code>awk</code>'],
            ['agrupar e totalizar', '<code>awk</code> com array']
          ]
        }
      },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>awk -F, \'{print $1, $3}\'</code> — campos com separador definido.',
          '<code>NR &gt; 1</code> pula o cabeçalho; <code>$NF</code> é o último campo.',
          'Padrão antes das chaves filtra; <code>END</code> imprime totais.',
          '<code>{soma += $5} END {print soma}</code> é o esqueleto de qualquer totalização.',
          '<code>{a[$1] += $2} END {for (k in a) print k, a[k]}</code> agrupa e soma.'
        ]
      }
    ],
    tasks: [
      {
        id: 't3-6-a', kind: 'guiado', title: 'Do campo ao relatório',
        body: [
          { p: 'Suba a escada do awk, um degrau por vez:' },
          {
            code: [
              '$ awk -F, \'{print $1}\' ~/documentos/servidores.csv',
              '$ awk -F, \'NR>1 {print $1, $3}\' ~/documentos/servidores.csv',
              '$ awk -F, \'NR>1 && $3=="producao" {print $1}\' ~/documentos/servidores.csv',
              '$ awk -F, \'NR>1 {s += $5} END {print "total:", s}\' ~/documentos/servidores.csv',
              '$ awk -F, \'NR>1 {printf "%-10s %2d CPU %3d GB\\n", $1, $4, $5}\' ~/documentos/servidores.csv'
            ]
          }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /awk\s+-F/), 'Use o <code>awk</code> com <code>-F</code>.'],
          [() => H.usedCommand(ctx, /awk[^|]*NR\s*>\s*1/), 'Use <code>NR>1</code> para pular o cabeçalho.'],
          [() => H.usedCommand(ctx, /awk[^|]*END/), 'Use um bloco <code>END</code> para totalizar.']
        ])
      },
      {
        id: 't3-6-f', kind: 'fill', title: 'Complete o awk',
        body: [
          { p: 'Você quer imprimir o <strong>nome</strong> (campo 1) dos servidores cuja <strong>memória</strong> (campo 5) seja maior que 8 GB, pulando o cabeçalho. Complete o padrão:' }
        ],
        template: `awk -F, '___ { print $1 }' ~/documentos/servidores.csv`, sample: 'NR>1 && $5>8',
        answers: ['NR>1 && \\$5>8'],
        hints: ['São duas condições unidas por E: pular a linha 1 e testar o campo 5.'],
        solution: 'A resposta é <code>NR&gt;1 &amp;&amp; $5&gt;8</code>. O comando completo: <code>awk -F, \'NR&gt;1 &amp;&amp; $5&gt;8 { print $1 }\' arquivo</code>. Espaços em volta dos operadores são opcionais.',
        check: async (ctx) => {
          const v = (ctx.vals[0] || '').replace(/\s+/g, '');
          return LX.H.checkAll([
            [/NR>1/.test(v), 'Falta a condição que pula o cabeçalho (<code>NR&gt;1</code>).'],
            [/&&/.test(v), 'Falta unir as duas condições com <code>&amp;&amp;</code>.'],
            [/\$5>8/.test(v), 'Falta a condição sobre a memória (<code>$5&gt;8</code>).']
          ]);
        }
      },
      {
        id: 't3-6-b', kind: 'desafio', title: 'Relatório de capacidade',
        body: [
          { p: 'A partir de <code>~/documentos/servidores.csv</code>, produza <code>~/capacidade.txt</code> com <strong>uma linha por ambiente</strong>, no formato exato:' },
          { code: ['AMBIENTE: N servidores, X CPUs, Y GB'], run: false, mixed: false, lang: 'text' },
          { p: 'Por exemplo: <code>producao: 4 servidores, 18 CPUs, 52 GB</code>. A ordem das linhas não importa.' },
          { p: 'Tudo em um único comando <code>awk</code>, sem cabeçalho na contagem.' }
        ],
        hints: [
          'Você vai precisar de três arrays indexados pelo ambiente (<code>$3</code>): um para contar servidores, um para somar CPUs (<code>$4</code>) e um para somar memória (<code>$5</code>).',
          'No <code>END</code>, percorra com <code>for (a in n)</code> e use <code>printf</code> com <code>"%s: %d servidores, %d CPUs, %d GB\\n"</code>.'
        ],
        solution: `<div class="code"><pre>awk -F, 'NR>1 { n[$3]++; cpu[$3] += $4; mem[$3] += $5 }\n         END { for (a in n) printf "%s: %d servidores, %d CPUs, %d GB\\n", a, n[a], cpu[a], mem[a] }' \\\n  ~/documentos/servidores.csv &gt; ~/capacidade.txt\n\ncat ~/capacidade.txt</pre></div>`,
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/capacidade.txt');
          if (c === null) return { ok: false, msg: 'O arquivo ~/capacidade.txt ainda não existe.' };
          const csv = (H.read(ctx, '/home/aluno/documentos/servidores.csv') || '').split('\n').filter(Boolean).slice(1);
          const g = {};
          for (const l of csv) {
            const f = l.split(',');
            if (f.length < 6) continue;
            g[f[2]] = g[f[2]] || { n: 0, cpu: 0, mem: 0 };
            g[f[2]].n++; g[f[2]].cpu += +f[3]; g[f[2]].mem += +f[4];
          }
          const checks = [[Object.keys(g).length > 0, 'Não consegui ler o CSV de referência.']];
          for (const [amb, v] of Object.entries(g)) {
            const linha = c.split('\n').find(l => l.startsWith(amb));
            checks.push([!!linha, `Falta a linha do ambiente <code>${amb}</code>.`]);
            if (linha) {
              checks.push([new RegExp(`${v.n}\\s+servidores`).test(linha), `O ambiente <code>${amb}</code> tem ${v.n} servidores.`]);
              checks.push([new RegExp(`${v.cpu}\\s+CPUs`).test(linha), `O ambiente <code>${amb}</code> soma ${v.cpu} CPUs.`]);
              checks.push([new RegExp(`${v.mem}\\s+GB`).test(linha), `O ambiente <code>${amb}</code> soma ${v.mem} GB.`]);
            }
          }
          checks.push([() => H.usedCommand(ctx, /awk/), 'Use o <code>awk</code> para montar o relatório.']);
          return LX.H.checkAll(checks);
        }
      }
    ]
  });

  /* ============================== 4.7 ============================== */
  LX.lesson('m03', {
    id: 'l3-7', n: '4.7', title: 'Comparar e distribuir: diff, cmp, tee e xargs',
    goal: 'Fechar o kit de texto: comparar versões, gravar e mostrar ao mesmo tempo, e transformar listas em comandos.',
    brief: [
      { p: '<code>diff -u</code> mostra diferenças de texto; <code>cmp</code> compara byte a byte; <code>tee</code> exibe uma saída e também a grava; <code>xargs</code> transforma a entrada em argumentos de outro comando.' },
      { code: ['$ diff -u app.conf app.conf.novo', '$ comando | tee resultado.txt', '$ find scripts -type f -print0 | xargs -0 chmod +x'] },
      { p: 'Use o par <code>-print0</code> e <code>xargs -0</code> quando nomes podem conter espaços. Antes de executar uma ação em massa, troque temporariamente o comando final por <code>printf</code> ou <code>echo</code> e confira a lista.' }
    ],
    body: [
      { cmd: 'diff' },
      { p: 'Mostra as diferenças entre dois arquivos. É como você descobre "o que mudou desde ontem?" em uma configuração.' },
      {
        code: [
          '$ cp ~/documentos/notas.txt ~/notas-v2.txt',
          '$ echo "linha nova no final" >> ~/notas-v2.txt',
          '$ diff ~/documentos/notas.txt ~/notas-v2.txt'
        ]
      },
      { h3: 'Os três formatos' },
      {
        table: {
          head: ['Comando', 'Formato', 'Quando usar'],
          rows: [
            ['<code>diff a b</code>', 'clássico (<code>&lt;</code> e <code>&gt;</code>)', 'leitura rápida'],
            ['<code>diff -u a b</code>', 'unificado (<code>-</code> e <code>+</code>)', '<strong>o padrão hoje</strong>; igual ao git'],
            ['<code>diff -y a b</code>', 'lado a lado', 'comparação visual'],
            ['<code>diff -q a b</code>', 'só diz se diferem', 'scripts'],
            ['<code>diff -r a b</code>', 'diretórios inteiros', 'comparar duas versões de um projeto']
          ]
        }
      },
      { code: ['$ diff -u ~/documentos/notas.txt ~/notas-v2.txt'] },
      { p: 'No formato unificado, a linha <code>@@ -1,5 +1,6 @@</code> significa: no arquivo original, 5 linhas a partir da linha 1; no novo, 6 linhas a partir da linha 1. Linhas com <code>-</code> saíram, com <code>+</code> entraram, sem prefixo são contexto.' },
      {
        cheat: [
          ['diff -u a b', 'formato unificado (o mais usado)'],
          ['diff -i a b', 'ignora maiúsculas'],
          ['diff -w a b', 'ignora diferenças de espaço'],
          ['diff -B a b', 'ignora linhas em branco'],
          ['diff -q a b', 'só informa se são diferentes'],
          ['diff -r dir1 dir2', 'compara diretórios recursivamente']
        ]
      },
      {
        box: 'tip', label: 'O uso mais valioso', body: [
          { p: 'Antes de aplicar uma mudança em produção: <code>diff -u /etc/nginx/nginx.conf /etc/nginx/nginx.conf.novo</code>. Você vê exatamente o que vai mudar, em vez de confiar na memória.' }
        ]
      },

      { cmd: 'cmp' },
      { p: 'Compara <strong>byte a byte</strong> e para na primeira diferença. Funciona com arquivos binários, onde o <code>diff</code> não ajuda.' },
      { code: ['$ cmp ~/documentos/notas.txt ~/notas-v2.txt', '$ cmp -s ~/documentos/notas.txt ~/documentos/notas.txt; echo $?'] },
      { p: 'Com <code>-s</code> ele fica em silêncio e só devolve o código de saída — ideal para verificar em script se dois arquivos são idênticos.' },

      { cmd: 'tee' },
      { p: 'Resolve um problema específico: você quer <strong>ver</strong> a saída na tela <strong>e</strong> gravá-la em arquivo. Com <code>&gt;</code> você só grava; com <code>tee</code>, os dois.' },
      { code: ['$ ls -lh /var/log | tee ~/listagem.txt', '$ cat ~/listagem.txt'] },
      { p: 'O nome vem do encanamento: um "T" divide o fluxo em dois.' },
      {
        cheat: [
          ['cmd | tee arq', 'mostra e grava (substituindo)'],
          ['cmd | tee -a arq', 'mostra e acrescenta'],
          ['cmd | tee a.txt b.txt', 'grava em vários arquivos'],
          ['cmd | tee arq | grep x', 'grava tudo e continua o pipeline']
        ]
      },
      {
        box: 'key', label: 'O uso que você não vai esquecer', body: [
          { p: 'Como escrever em um arquivo protegido com <code>sudo</code>? Isto <strong>não funciona</strong>:' },
          { code: ['echo "linha" > /etc/arquivo          # falha: o shell abre o arquivo, não o sudo', 'sudo echo "linha" > /etc/arquivo     # falha igual!'], run: false, mixed: false, lang: 'text' },
          { p: 'O redirecionamento é feito pelo <strong>shell</strong>, que continua sendo você. A solução é o <code>tee</code>, que é um programa e portanto pode rodar com <code>sudo</code>:' },
          { code: ['echo "linha" | sudo tee -a /etc/arquivo'], run: false, mixed: false, lang: 'text' }
        ]
      },

      { cmd: 'xargs' },
      { p: 'Alguns comandos leem da entrada padrão (<code>grep</code>, <code>sort</code>, <code>wc</code>). Outros só aceitam <strong>argumentos</strong> (<code>rm</code>, <code>chmod</code>, <code>mkdir</code>). O <code>xargs</code> é o adaptador entre os dois mundos: ele pega o que chega pelo pipe e transforma em argumentos.' },
      {
        code: [
          '# isto NÃO funciona: o rm não lê da entrada padrão',
          '$ find /tmp -name "*.naoexiste" | rm',
          '# isto funciona',
          '$ find /tmp -name "*.naoexiste" | xargs rm -f'
        ]
      },
      {
        cheat: [
          ['... | xargs cmd', 'passa tudo como argumentos'],
          ['... | xargs -n 1 cmd', 'um argumento por execução'],
          ['... | xargs -I {} cmd {} extra', 'controla onde o item entra'],
          ['... | xargs -0 cmd', 'entrada separada por NUL'],
          ['... | xargs -t cmd', 'mostra o comando antes de executar'],
          ['... | xargs -r cmd', 'não executa se a entrada estiver vazia']
        ]
      },
      { p: 'O <code>-I {}</code> é o mais versátil: ele deixa você colocar o item em qualquer posição do comando.' },
      {
        code: [
          '$ ls ~/documentos | xargs -I {} echo "arquivo encontrado: {}"'
        ]
      },
      {
        box: 'warn', label: 'Nomes com espaço', body: [
          { p: 'Por padrão o <code>xargs</code> separa por espaço — então <code>meu arquivo.txt</code> vira dois argumentos. A solução canônica é usar NUL como separador dos dois lados:' },
          { code: ['find . -name "*.log" -print0 | xargs -0 rm'], run: false, mixed: false, lang: 'text' },
          { p: 'Ou, mais simples, deixe o próprio <code>find</code> executar: <code>find . -name "*.log" -exec rm {} +</code>.' }
        ]
      },
      { h3: 'xargs ou -exec?' },
      {
        table: {
          head: ['', '<code>find -exec ... +</code>', '<code>| xargs</code>'],
          rows: [
            ['Nomes com espaço', 'sempre seguro', 'precisa de <code>-print0</code>/<code>-0</code>'],
            ['Legibilidade', 'boa', 'muito boa em pipelines'],
            ['Fonte dos dados', 'só o <code>find</code>', '<strong>qualquer</strong> comando'],
            ['Recomendação', 'quando a origem é o find', 'quando a origem é outro pipeline']
          ]
        }
      },

      { h2: 'Resumo' },
      {
        cheat: [
          ['diff -u a b', 'o que mudou, no formato padrão'],
          ['diff -q a b', 'só diz se diferem (para scripts)'],
          ['cmp -s a b', 'idênticos byte a byte? (código de saída)'],
          ['cmd | tee arq', 'ver e gravar ao mesmo tempo'],
          ['echo x | sudo tee -a /etc/arq', 'escrever em arquivo protegido'],
          ['... | xargs -I {} cmd {}', 'transformar lista em comandos']
        ]
      }
    ],
    tasks: [
      {
        id: 't3-7-a', kind: 'guiado', title: 'Compare, grave e distribua',
        body: [
          { p: 'Os três comandos em ação:' },
          {
            code: [
              '$ cp ~/documentos/tarefas.txt ~/tarefas-v2.txt',
              '$ echo "[ ] revisar backup" >> ~/tarefas-v2.txt',
              '$ diff -u ~/documentos/tarefas.txt ~/tarefas-v2.txt',
              '$ ls -lh ~/documentos | tee ~/relatorio-docs.txt | wc -l',
              '$ cat ~/relatorio-docs.txt'
            ]
          },
          { p: 'Repare no quarto comando: o <code>tee</code> gravou o arquivo <strong>e</strong> deixou o pipeline continuar até o <code>wc</code>.' }
        ],
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /diff\s+-u/), 'Compare dois arquivos com <code>diff -u</code>.'],
          [() => H.usedCommand(ctx, /\|\s*tee/), 'Use o <code>tee</code> em um pipeline.'],
          [H.isFile(ctx, '/home/aluno/relatorio-docs.txt'), 'O <code>tee</code> deveria ter criado <code>~/relatorio-docs.txt</code>.']
        ])
      },
      {
        id: 't3-7-q', kind: 'quiz', title: 'Por que isso falha?',
        body: [
          { p: 'Você precisa acrescentar uma linha ao <code>/etc/hosts</code>, que só o root pode escrever. Roda:' },
          { code: ['sudo echo "10.0.2.99 novo-servidor" >> /etc/hosts'], run: false, mixed: false },
          { p: 'E recebe <code>Permission denied</code>. Por quê?' }
        ],
        options: [
          { text: 'O redirecionamento <code>&gt;&gt;</code> é executado pelo shell — que é você, não o root. O <code>sudo</code> só elevou o <code>echo</code>.', correct: true },
          { text: 'O <code>sudo</code> não funciona com <code>echo</code>.', why: 'Funciona normalmente. O problema não está no <code>echo</code>, e sim em quem abre o arquivo de destino.' },
          { text: 'Faltou o <code>-a</code> no sudo.', why: 'Não existe essa opção com esse propósito no <code>sudo</code>.' },
          { text: 'O <code>/etc/hosts</code> é somente leitura mesmo para o root.', why: 'O root escreve nele normalmente — é assim que se configura a máquina.' }
        ],
        explain: 'A ordem das operações é: o shell monta o comando, <strong>abre o arquivo de destino</strong> e só depois executa o programa. Quando ele abre o <code>/etc/hosts</code>, ainda é o seu usuário. A solução é passar a escrita para um programa que pode rodar como root: <code>echo "10.0.2.99 novo-servidor" | sudo tee -a /etc/hosts</code>.'
      },
      {
        id: 't3-7-b', kind: 'desafio', title: 'Deixe os scripts executáveis',
        body: [
          { p: 'Monte o cenário:' },
          {
            code: [
              '$ mkdir -p ~/scripts/{deploy,backup}',
              '$ touch ~/scripts/deploy/{publicar.sh,reverter.sh} ~/scripts/backup/{diario.sh,semanal.sh}',
              '$ touch ~/scripts/leiame.md',
              '$ ls -lR ~/scripts'
            ]
          },
          { p: 'Nenhum deles tem permissão de execução. Sua tarefa: dar permissão de execução <strong>apenas aos arquivos <code>.sh</code></strong>, em qualquer subdiretório, usando <code>find</code> combinado com <code>xargs</code>.' },
          { p: 'Depois, grave em <code>~/executaveis.txt</code> a lista dos arquivos que ficaram executáveis.' }
        ],
        hints: [
          'Encontre primeiro: <code>find ~/scripts -type f -name "*.sh"</code>. Confira a lista antes de agir.',
          'Depois encaixe: <code>find ~/scripts -type f -name "*.sh" | xargs chmod +x</code>. Para a lista final, use <code>find ~/scripts -type f -perm -u+x</code>.'
        ],
        solution: '<div class="code"><pre>find ~/scripts -type f -name "*.sh"\nfind ~/scripts -type f -name "*.sh" | xargs chmod +x\n\nfind ~/scripts -type f -perm -u+x &gt; ~/executaveis.txt\ncat ~/executaveis.txt\nls -lR ~/scripts</pre></div>',
        check: async (ctx) => {
          const alvos = ['/home/aluno/scripts/deploy/publicar.sh', '/home/aluno/scripts/deploy/reverter.sh',
            '/home/aluno/scripts/backup/diario.sh', '/home/aluno/scripts/backup/semanal.sh'];
          const c = H.read(ctx, '/home/aluno/executaveis.txt');
          const checks = alvos.map(a => [(H.mode(ctx, a) & 0o100) !== 0, `O arquivo <code>${a.split('/').pop()}</code> ainda não é executável.`]);
          checks.push([(H.mode(ctx, '/home/aluno/scripts/leiame.md') & 0o111) === 0, 'O <code>leiame.md</code> ficou executável — só os <code>.sh</code> deveriam mudar.']);
          checks.push([c !== null, 'O arquivo ~/executaveis.txt ainda não existe.']);
          if (c !== null) checks.push([alvos.every(a => c.includes(a.split('/').pop())), 'A lista em ~/executaveis.txt está incompleta.']);
          checks.push([() => H.usedCommand(ctx, /xargs/), 'Use o <code>xargs</code> para encaixar o <code>find</code> no <code>chmod</code>.']);
          return LX.H.checkAll(checks);
        }
      }
    ]
  });
})();
