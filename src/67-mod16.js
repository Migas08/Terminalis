/* =========================================================================
   MÓDULO 16 — Administração de servidores
   A rotina de quem cuida de uma máquina que outras pessoas dependem.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;

  /* ============================== 16.1 ============================== */
  LX.lesson('m16', {
    id: 'l16-1', n: '16.1', title: 'Logs: o que a máquina está te contando',
    goal: 'Parar de "olhar o log" no escuro e passar a fazer uma pergunta específica ao sistema — por serviço, por prioridade, por período.',
    body: [
      { h2: 'Por que existe log' },
      { p: 'Um servidor roda sem ninguém olhando. Quando alguma coisa dá errado às três da manhã, a única testemunha é o que os programas escreveram enquanto aconteceu. <strong>Log é a memória da máquina</strong> — e a diferença entre "o site caiu, não sei por quê" e "o banco recusou conexão às 03:14 porque estourou o limite" está inteiramente em saber ler essa memória.' },
      { p: 'A pergunta que um iniciante faz é "onde fica o log?". A pergunta certa é <strong>"que pergunta eu quero fazer?"</strong>. As ferramentas abaixo existem para responder perguntas diferentes.' },

      { h2: 'Dois mundos: arquivos de texto e journald' },
      { p: 'O Linux moderno guarda log em dois lugares ao mesmo tempo, e isso confunde muita gente:' },
      {
        table: {
          head: ['', '<code>/var/log/*.log</code>', '<code>journalctl</code>'],
          rows: [
            ['O que é', 'arquivos de texto puro', 'banco binário indexado do systemd'],
            ['Quem escreve', 'o próprio programa, ou o rsyslog', 'tudo que o systemd inicia, mais o kernel'],
            ['Como se lê', '<code>cat</code>, <code>tail</code>, <code>grep</code>, <code>less</code>', 'só com <code>journalctl</code>'],
            ['Vantagem', 'funciona com qualquer ferramenta de texto', 'filtra por unit, prioridade, tempo e boot'],
            ['Sobrevive ao reboot?', 'sim', '<strong>depende da configuração</strong> — veja adiante']
          ]
        }
      },
      { p: 'Não é redundância inútil: um programa que não é gerenciado pelo systemd (um script seu, por exemplo) escreve num arquivo; um serviço que o systemd iniciou tem tudo capturado pelo journald automaticamente, mesmo que o programa só use <code>echo</code>.' },

      { h2: 'O que existe em /var/log' },
      { code: ['$ ls -l /var/log', '$ sudo tail -n 5 /var/log/syslog', '$ sudo tail -n 5 /var/log/auth.log'] },
      {
        table: {
          head: ['Arquivo', 'O que registra', 'Quando você abre'],
          rows: [
            ['<code>syslog</code>', 'mensagens gerais do sistema', 'primeira parada em quase tudo'],
            ['<code>auth.log</code>', 'login, <code>sudo</code>, SSH, autenticação', 'investigar acesso indevido'],
            ['<code>kern.log</code>', 'mensagens do kernel', 'hardware, disco, rede, OOM killer'],
            ['<code>dpkg.log</code>', 'instalação e remoção de pacotes', '"o que mudou nesta máquina?"'],
            ['<code>nginx/</code>, <code>apache2/</code>', 'logs da aplicação', 'erro 500, requisição lenta']
          ]
        }
      },
      {
        box: 'warn', label: 'Por que muitos precisam de sudo', body: [
          { p: 'Repare no <code>ls -l</code>: <code>auth.log</code> e <code>syslog</code> são <code>-rw-r-----</code> de <code>root:adm</code>. Log revela nome de usuário, IP e às vezes trecho de comando — é informação sensível. Ou você usa <code>sudo</code>, ou entra no grupo <code>adm</code>.' }
        ]
      },

      { h2: 'journalctl: a pergunta antes do comando' },
      { p: 'O <code>journalctl</code> sem argumento despeja o journal inteiro, e isso não serve para nada. Ele é útil quando você <strong>combina filtros</strong>:' },
      {
        table: {
          head: ['Pergunta', 'Comando'],
          rows: [
            ['O que este serviço registrou?', '<code>journalctl -u ssh</code>'],
            ['Só o que deu errado', '<code>journalctl -p err</code>'],
            ['O que aconteceu na última hora', '<code>journalctl --since "1 hour ago"</code>'],
            ['As últimas 20 linhas', '<code>journalctl -n 20</code>'],
            ['Acompanhar em tempo real', '<code>journalctl -f</code>'],
            ['Do boot atual apenas', '<code>journalctl -b</code>'],
            ['Só o kernel', '<code>journalctl -k</code>'],
            ['Procurar um texto', '<code>journalctl --grep "timeout"</code>'],
            ['O diagnóstico completo de um serviço', '<code>journalctl -xeu nginx</code>']
          ]
        }
      },
      { code: ['$ journalctl -p err --no-pager', '$ journalctl -u ssh -n 10 --no-pager', '$ journalctl --since "2 hours ago" -p warning --no-pager | tail -5'] },
      {
        box: 'key', label: 'As oito prioridades', body: [
          { p: 'O syslog classifica cada mensagem de 0 a 7, do mais grave ao mais irrelevante:' },
          {
            ascii: `0 emerg    o sistema está inutilizável
1 alert    exige ação imediata
2 crit     condição crítica
3 err      erro                    ← "me mostre o que quebrou"
4 warning  aviso                   ← "e o que quase quebrou"
5 notice   normal, mas significativo
6 info     informativo             ← 95% do volume
7 debug    detalhe de depuração`
          },
          { p: 'E o detalhe que economiza tempo: <code>-p err</code> não significa "só erros", significa <strong>"err e tudo mais grave"</strong>. É um teto, não um filtro exato. Por isso <code>-p warning</code> traz também os <code>err</code>, <code>crit</code> e <code>alert</code>.' }
        ]
      },

      { h2: 'O detalhe que perde gente: o journal some no reboot' },
      { p: 'Por padrão em várias instalações, o journald guarda tudo em <code>/run/log/journal</code> — que é <strong>memória RAM</strong>. Você reinicia a máquina para "ver se resolve", ela volta, e o log da falha desapareceu junto.' },
      { code: ['$ journalctl --disk-usage', '$ ls /var/log/journal 2>/dev/null || echo "journal NÃO é persistente nesta máquina"'] },
      { p: 'A correção é uma linha em <code>/etc/systemd/journald.conf</code> — <code>Storage=persistent</code> — mais <code>systemctl restart systemd-journald</code>. A partir daí <code>journalctl -b -1</code> mostra o boot anterior, que é exatamente o que você quer depois de uma queda.' },
      {
        box: 'note', body: [
          { p: 'Journal persistente cresce. Os freios são <code>SystemMaxUse=</code> no <code>journald.conf</code> e, na emergência, <code>sudo journalctl --vacuum-size=200M</code> ou <code>--vacuum-time=7d</code>.' }
        ]
      },

      { h2: 'Ler log é filtrar, contar e comparar' },
      { p: 'Log bom não se lê linha a linha — se agrega. As três perguntas que resolvem a maioria dos incidentes:' },
      {
        ul: [
          '<strong>Quanto?</strong> <code>journalctl -p err --no-pager | wc -l</code> — dez erros e dez mil erros são problemas diferentes.',
          '<strong>Quais, agrupados?</strong> <code>... | awk \'{$1=$2=$3=""; print}\' | sort | uniq -c | sort -rn</code> — o mesmo erro repetido mil vezes é <em>um</em> problema.',
          '<strong>Desde quando?</strong> a primeira ocorrência é o que se correlaciona com o deploy, o reboot ou a mudança de configuração.'
        ]
      },
      { p: 'É o módulo 3 e o módulo 4 voltando com propósito: <code>grep</code>, <code>awk</code>, <code>sort</code> e <code>uniq -c</code> aplicados ao log são a diferença entre olhar e enxergar.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>/var/log</code> guarda texto; o <code>journald</code> guarda um banco indexado. Você vai usar os dois.',
          'O <code>journalctl</code> só é útil com filtro: <code>-u</code>, <code>-p</code>, <code>--since</code>, <code>--grep</code>, <code>-b</code>.',
          '<code>-p err</code> significa "err e mais grave", não "exatamente err".',
          'Se <code>/var/log/journal</code> não existe, o log morre no reboot — e é aí que você mais precisa dele.',
          'Contar e agrupar vale mais do que ler: <code>sort | uniq -c | sort -rn</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't16-1-a', kind: 'guiado', title: 'Quatro perguntas ao journal',
        body: [
          { p: 'Faça quatro perguntas diferentes ao mesmo journal e repare em como o volume muda:' },
          { code: ['$ journalctl --no-pager | wc -l', '$ journalctl -p warning --no-pager | wc -l', '$ journalctl -p err --no-pager | wc -l', '$ journalctl -u ssh --no-pager | tail -6'] },
          { p: 'A terceira lista é um subconjunto da segunda, que é subconjunto da primeira. É essa a lógica do <code>-p</code>: você move um teto, não escolhe um rótulo.' }
        ],
        hints: ['O <code>--no-pager</code> impede que a saída fique presa num paginador quando você a manda para outro comando.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /journalctl[^|]*-p\s*(err|3)/), 'Peça só os erros com <code>journalctl -p err</code>.'],
          [() => H.usedCommand(ctx, /journalctl[^|]*-p\s*(warning|4)/), 'Peça os avisos com <code>journalctl -p warning</code>.'],
          [() => H.usedCommand(ctx, /journalctl.*-u\s*ssh/), 'Filtre por unit com <code>journalctl -u ssh</code>.']
        ])
      },
      {
        id: 't16-1-q', kind: 'quiz', title: 'Conceito: o log que sumiu',
        body: [
          { p: 'Um serviço travou de madrugada. De manhã, alguém reiniciou a máquina "para ver se resolvia". Agora você roda <code>journalctl -b -1 -u api</code> para ver o que aconteceu antes do reboot e recebe <code>Failed to look up boot -1</code>.' },
          { p: 'O que aconteceu?' }
        ],
        options: [
          { text: 'O serviço <code>api</code> não existia no boot anterior.', why: 'A mensagem é sobre o <em>boot</em> não ser encontrado, não sobre a unit. O erro apareceria antes de sequer filtrar por unit.' },
          { text: 'O journal desta máquina não é persistente: ele vive em <code>/run</code>, na RAM, e foi apagado no reboot.', correct: true },
          { text: 'Falta <code>sudo</code>: um usuário comum não enxerga boots anteriores.', why: 'Sem privilégio você perde mensagens de outros usuários, mas o índice de boots continua acessível — a mensagem seria de permissão, não de boot inexistente.' },
          { text: 'O <code>-b -1</code> não existe; o correto é <code>--boot=previous</code>.', why: '<code>-b -1</code> é a sintaxe correta para o boot anterior. O problema é não haver boot anterior guardado.' }
        ],
        explain: 'Sem <code>/var/log/journal</code>, o journald usa <code>/run/log/journal</code> — um sistema de arquivos em memória. Cada reboot começa do zero. A correção é <code>Storage=persistent</code> em <code>/etc/systemd/journald.conf</code>, e ela precisa estar feita <strong>antes</strong> do incidente. Esse é um dos primeiros itens a conferir quando você assume um servidor.'
      },
      {
        id: 't16-1-b', kind: 'desafio', title: 'Relatório de erros por serviço',
        body: [
          { p: 'Sua primeira tarefa no servidor novo é responder: <em>quais serviços estão registrando erro, e quantos?</em>' },
          { p: 'Gere <code>~/erros-por-servico.txt</code> com uma linha por serviço que aparece nas mensagens de prioridade <code>err</code> ou pior, no formato <code>contagem servico</code>, da maior contagem para a menor.' },
          { p: 'A saída do <code>journalctl</code> tem a forma <code>Set 02 11:54:29 srv-aula systemd[1]: mensagem</code>. O nome do processo é o quinto campo, com o PID entre colchetes — você vai precisar limpar isso.' }
        ],
        hints: [
          'O quinto campo separado por espaço é <code>systemd[1]:</code>. Para ficar só <code>systemd</code>, corte no <code>[</code>.',
          'Um caminho: <code>journalctl -p err --no-pager | grep -v "^--" | awk \'{print $5}\' | cut -d"[" -f1 | sort | uniq -c | sort -rn > ~/erros-por-servico.txt</code>'
        ],
        solution: '<div class="code"><pre>journalctl -p err --no-pager | grep -v "^--" \\\n  | awk \'{print $5}\' | cut -d"[" -f1 \\\n  | sort | uniq -c | sort -rn &gt; ~/erros-por-servico.txt\ncat ~/erros-por-servico.txt</pre></div><p style="margin-top:8px">Esse pipeline de cinco etapas é literalmente o que você vai digitar no primeiro dia em qualquer servidor herdado. Ele responde "onde dói" em uma linha.</p>',
        forja: ["printf '  9 systemd\\n  3 sshd\\n' > ~/erros-por-servico.txt"],
        check: async (ctx) => {
          const c = H.readText(ctx, '/home/aluno/erros-por-servico.txt');
          if (!c.trim()) return { ok: false, msg: 'O arquivo <code>~/erros-por-servico.txt</code> ainda não existe ou está vazio.' };
          const m = ctx.machine || ctx.sh.m;
          /* a resposta certa é recalculada aqui a partir do journal desta máquina */
          const reais = {};
          for (const e of (m.journal || [])) {
            if ((e.prio === undefined ? 6 : e.prio) > 3) continue;
            const nome = String(e.unit || '').replace(/\.(service|socket|timer)$/, '');
            reais[nome] = (reais[nome] || 0) + 1;
          }
          const esperado = Object.entries(reais).sort((a, b) => b[1] - a[1]);
          const linhas = c.split('\n').map(x => x.trim()).filter(Boolean);
          const par = linhas.map(l => { const p = l.split(/\s+/); return [p.slice(1).join(' '), +p[0]]; });
          return H.checkAll([
            [() => esperado.length > 0, 'Este journal não tem mensagens de erro — nada a relatar.'],
            [() => linhas.every(l => /^\d+\s+\S+$/.test(l)), 'Cada linha deve ser <code>contagem servico</code> — só dois campos, a contagem primeiro. É o formato que o <code>uniq -c</code> produz.'],
            [() => par.length === esperado.length, () => `O relatório deveria ter ${esperado.length} linha(s), uma por serviço com erro; tem ${par.length}.`],
            [() => par.every(([nome]) => reais[nome] !== undefined), () => `Algum nome de serviço não bate. Os serviços com erro nesta máquina são: ${esperado.map(e => e[0]).join(', ')}.`],
            [() => par.every(([nome, n]) => reais[nome] === n), 'Alguma contagem não bate com o journal. Deixe o <code>uniq -c</code> contar em vez de escrever o número.'],
            [() => par.every((p, i) => i === 0 || par[i - 1][1] >= p[1]), 'As linhas devem estar da maior contagem para a menor (<code>sort -rn</code>).']
          ]);
        }
      }
    ]
  });

  /* ============================== 16.2 ============================== */
  LX.lesson('m16', {
    id: 'l16-2', n: '16.2', title: 'Rotação de logs: por que o disco enche',
    goal: 'Entender por que um arquivo de log derruba um servidor e como o logrotate impede isso — inclusive quando ele silenciosamente não está impedindo.',
    body: [
      { h2: 'O incidente mais comum de todos' },
      { p: 'Pergunte a qualquer pessoa que opera servidor qual foi o último incidente bobo. A resposta, com frequência desconfortável, é: <strong>o disco encheu de log</strong>.' },
      { p: 'A mecânica é sempre a mesma. Um serviço passa a registrar mais do que o normal — um erro que se repete, um modo debug que alguém esqueceu ligado. O arquivo cresce. O disco chega a 100%. E aí <em>tudo</em> quebra ao mesmo tempo, porque quase todo programa precisa escrever alguma coisa: o banco não grava, o serviço não sobe, e — a ironia final — você não consegue nem apagar o log, porque apagar exige escrever no journal.' },
      {
        box: 'warn', label: 'Por que apagar o arquivo não resolve', body: [
          { p: 'A reação instintiva é <code>rm /var/log/enorme.log</code>. Não funciona: enquanto o processo estiver com o arquivo aberto, o kernel <strong>não libera o espaço</strong> — o arquivo some do diretório mas continua ocupando disco, e o <code>df</code> não muda. Você vê a discrepância com <code>lsof | grep deleted</code>.' },
          { p: 'O jeito certo de esvaziar sem reiniciar nada é <code>sudo truncate -s 0 /var/log/enorme.log</code>, que zera o conteúdo mantendo o mesmo inode aberto.' }
        ]
      },

      { h2: 'Rotacionar: a ideia' },
      { p: '<strong>Rotacionar</strong> um log é o oposto de apagar: é fechar o arquivo atual, guardá-lo com outro nome, começar um novo vazio e descartar as gerações mais antigas. Você mantém histórico <em>limitado</em> — o suficiente para investigar, pouco o bastante para não encher o disco.' },
      {
        ascii: `antes                        depois de girar
─────────────────────        ──────────────────────────
app.log     (12 MB)   ──▶    app.log      (0 bytes, novo)
app.log.1   (12 MB)          app.log.1    (12 MB, o antigo)
app.log.2.gz                 app.log.2.gz (comprimido)
app.log.3.gz                 app.log.3.gz
app.log.4.gz                 app.log.4.gz  ← a 5ª geração é apagada`
      },
      { p: 'Quem faz isso é o <strong>logrotate</strong>, que roda uma vez por dia por um timer do systemd. Ele não fica vigiando arquivo: acorda, olha as regras, decide o que girar e volta a dormir.' },

      { h2: 'Onde ficam as regras' },
      { code: ['$ cat /etc/logrotate.conf', '$ ls /etc/logrotate.d/', '$ cat /etc/logrotate.d/nginx'] },
      { p: 'O <code>/etc/logrotate.conf</code> traz os padrões e termina com <code>include /etc/logrotate.d</code>. Cada pacote deixa o seu bloco num arquivo próprio nesse diretório — é a mesma lógica do <code>/etc/sudoers.d</code> e do <code>/etc/apt/sources.list.d</code>: <strong>configuração por arquivo, não por edição de arquivo compartilhado</strong>. Assim uma atualização de pacote não pisa na sua configuração.' },
      {
        table: {
          head: ['Diretiva', 'O que faz', 'Cuidado'],
          rows: [
            ['<code>daily</code> / <code>weekly</code>', 'de quanto em quanto tempo girar', 'só decide a frequência, não o tamanho'],
            ['<code>size 100M</code>', 'girar ao passar do tamanho', 'a alternativa quando o volume é imprevisível'],
            ['<code>rotate 14</code>', 'quantas gerações manter', '<strong>é isso que limita o disco</strong>'],
            ['<code>compress</code>', 'comprime as antigas', 'log de texto comprime 10× a 20×'],
            ['<code>delaycompress</code>', 'só comprime na rodada seguinte', 'evita comprimir arquivo ainda aberto'],
            ['<code>missingok</code>', 'não reclama se o arquivo não existe', 'evita erro no cron'],
            ['<code>notifempty</code>', 'não gira arquivo vazio', 'evita lixo'],
            ['<code>create 0640 www-data adm</code>', 'modo e dono do arquivo novo', 'esquecer isso quebra a aplicação'],
            ['<code>copytruncate</code>', 'copia e zera em vez de renomear', 'para programa que não sabe reabrir o arquivo']
          ]
        }
      },
      {
        box: 'key', label: 'O detalhe que faz a diferença', body: [
          { p: 'Quando o logrotate renomeia <code>app.log</code> para <code>app.log.1</code>, o processo que estava escrevendo <strong>continua escrevendo no arquivo renomeado</strong> — ele guarda o descritor, não o nome. O log novo fica eternamente vazio e ninguém percebe.' },
          { p: 'Por isso existem duas soluções: <code>postrotate ... systemctl reload nginx ... endscript</code>, que avisa o programa para reabrir o arquivo; ou <code>copytruncate</code>, que copia o conteúdo e zera o original, quando o programa não sabe reabrir.' }
        ]
      },

      { h2: 'Testar antes de confiar' },
      { p: 'A regra de ouro: <strong>nunca escreva uma configuração de logrotate sem rodar em modo de simulação</strong>. O <code>-d</code> mostra o que ele faria, sem tocar em nada.' },
      { code: ['$ sudo logrotate -d /etc/logrotate.conf'] },
      { p: 'E quando você quer forçar agora, para conferir o resultado de verdade, use <code>-f</code> (force). Sem ele, o logrotate respeita a periodicidade e simplesmente não faz nada — o que costuma ser lido como "minha configuração está errada" quando na verdade estava certa.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Disco cheio de log é o incidente bobo mais comum em servidor.',
          '<code>rm</code> num log aberto não libera espaço; <code>truncate -s 0</code> libera.',
          'Rotacionar = renomear, começar do zero e descartar as gerações antigas.',
          'Regras em <code>/etc/logrotate.d/</code>, um arquivo por serviço; <code>rotate N</code> é o que limita o disco.',
          'Sem <code>postrotate</code> ou <code>copytruncate</code>, o programa continua escrevendo no arquivo antigo.',
          '<code>-d</code> simula, <code>-f</code> força.'
        ]
      }
    ],
    tasks: [
      {
        id: 't16-2-a', kind: 'guiado', title: 'Leia as regras que já existem',
        body: [
          { p: 'Antes de escrever uma regra, leia as que a máquina já tem:' },
          { code: ['$ cat /etc/logrotate.conf', '$ ls /etc/logrotate.d/', '$ cat /etc/logrotate.d/nginx', '$ sudo logrotate -d /etc/logrotate.conf'] },
          { p: 'Repare que o bloco do nginx é mais específico que o padrão global: ele gira diariamente e mantém 14 gerações, em vez de semanalmente e 4. O bloco específico vence.' }
        ],
        hints: ['O <code>-d</code> não altera nada — pode rodar à vontade.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /logrotate\.conf/), 'Leia o <code>/etc/logrotate.conf</code>.'],
          [() => H.usedCommand(ctx, /logrotate\.d/), 'Veja o que existe em <code>/etc/logrotate.d/</code>.'],
          [() => H.usedCommand(ctx, /logrotate\s+.*-d/), 'Rode a simulação com <code>sudo logrotate -d /etc/logrotate.conf</code>.']
        ])
      },
      {
        id: 't16-2-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um servidor gira o log do nginx todo dia, conforme a regra. Mas há três semanas o <code>access.log</code> está sempre com 0 bytes, enquanto o <code>access.log.1</code> cresce sem parar e já tem 4 GB. A regra é:' },
          { code: ['/var/log/nginx/*.log {', '    daily', '    rotate 14', '    compress', '    create 0640 www-data adm', '}'], run: false, lang: 'text' },
          { p: 'O que está faltando?' }
        ],
        options: [
          { text: 'Falta <code>postrotate systemctl reload nginx endscript</code>: o nginx continua escrevendo no descritor antigo, que agora se chama <code>.log.1</code>.', correct: true },
          { text: 'Falta <code>size 100M</code>: sem limite de tamanho o arquivo cresce indefinidamente.', why: 'O <code>size</code> mudaria o gatilho da rotação, mas o log novo continuaria vazio — o problema não é quando girar, é o processo não largar o arquivo antigo.' },
          { text: 'O <code>rotate 14</code> está alto demais para um log desse volume.', why: 'Reduzir a retenção economizaria disco, mas não explica o arquivo novo permanentemente vazio.' },
          { text: 'Falta <code>notifempty</code>.', why: 'Ele impediria girar um arquivo vazio — aqui o vazio é a consequência do problema, não a causa.' }
        ],
        explain: 'Um processo não escreve em "um nome de arquivo": ele escreve num <strong>descritor</strong> que aponta para o inode. Renomear o arquivo não muda o inode, então o nginx segue alimentando o mesmo arquivo, que agora se chama <code>.log.1</code>. O <code>postrotate</code> resolve mandando o serviço reabrir; <code>copytruncate</code> resolve de outro jeito, copiando o conteúdo e zerando o original — com o risco de perder as linhas escritas entre a cópia e o truncamento.'
      },
      {
        id: 't16-2-b', kind: 'desafio', title: 'Uma regra para a sua aplicação',
        body: [
          { p: 'A aplicação da equipe escreve em <code>/var/log/app/app.log</code> e ninguém configurou rotação. Comece criando o cenário:' },
          { code: ['$ sudo mkdir -p /var/log/app', '$ sudo sh -c \'for i in 1 2 3 4 5; do echo "linha de log $i" >> /var/log/app/app.log; done\'', '$ ls -l /var/log/app/'] },
          { p: 'Agora escreva <code>/etc/logrotate.d/app</code> com uma regra para <code>/var/log/app/*.log</code> que atenda a estes critérios:' },
          {
            ul: [
              'rotação <strong>diária</strong>;',
              'manter <strong>7</strong> gerações;',
              '<strong>comprimir</strong> as antigas;',
              'não reclamar se o arquivo não existir (<code>missingok</code>);',
              'não girar arquivo vazio (<code>notifempty</code>);',
              'criar o arquivo novo com modo <code>0640</code>, dono <code>root</code> e grupo <code>adm</code>.'
            ]
          },
          { p: 'Depois valide com <code>sudo logrotate -d /etc/logrotate.conf</code> e force uma rotação com <code>-f</code> para ver o resultado no diretório.' }
        ],
        hints: [
          'A estrutura é <code>/caminho/*.log {</code>, uma diretiva por linha, e <code>}</code> no fim. Use <code>tee</code> com heredoc para escrever como root.',
          'A diretiva do dono é <code>create 0640 root adm</code> — modo, usuário e grupo, nessa ordem. E o <code>-f</code> do logrotate é o que faz a rotação acontecer agora, ignorando a periodicidade.'
        ],
        solution: '<div class="code"><pre>sudo mkdir -p /var/log/app\nsudo sh -c \'for i in 1 2 3 4 5; do echo "linha de log $i" &gt;&gt; /var/log/app/app.log; done\'\n\nsudo tee /etc/logrotate.d/app &gt; /dev/null &lt;&lt; \'EOF\'\n/var/log/app/*.log {\n    daily\n    rotate 7\n    compress\n    missingok\n    notifempty\n    create 0640 root adm\n}\nEOF\n\nsudo logrotate -d /etc/logrotate.conf\nsudo logrotate -f /etc/logrotate.conf\nls -l /var/log/app/</pre></div><p style="margin-top:8px">Repare que a regra fica num arquivo só dela. Se amanhã a aplicação virar pacote, ou você mudar de servidor, é esse arquivo que viaja junto.</p>',
        check: async (ctx) => {
          const conf = H.readText(ctx, '/etc/logrotate.d/app');
          const lista = (H.ls(ctx, '/var/log/app') || []).map(x => (typeof x === 'string' ? x : x.name));
          return H.checkAll([
            [() => H.isDir(ctx, '/var/log/app'), 'Monte o cenário: falta o diretório <code>/var/log/app</code>.'],
            [!!conf, 'Não encontrei <code>/etc/logrotate.d/app</code>.'],
            [() => /\/var\/log\/app\/\*\.log\s*\{/.test(conf), 'O bloco deve começar com o padrão <code>/var/log/app/*.log {</code>.'],
            [() => /^\s*daily\s*$/m.test(conf), 'Falta a diretiva <code>daily</code>.'],
            [() => /^\s*rotate\s+7\s*$/m.test(conf), 'Falta <code>rotate 7</code> — é ela que limita quanto disco o log pode ocupar.'],
            [() => /^\s*compress\s*$/m.test(conf), 'Falta <code>compress</code>.'],
            [() => /^\s*missingok\s*$/m.test(conf), 'Falta <code>missingok</code>.'],
            [() => /^\s*notifempty\s*$/m.test(conf), 'Falta <code>notifempty</code>.'],
            [() => /^\s*create\s+0640\s+root\s+adm\s*$/m.test(conf), 'Falta <code>create 0640 root adm</code> — sem isso o arquivo novo nasce com o dono errado e a aplicação para de escrever.'],
            [() => /\}/.test(conf), 'O bloco precisa ser fechado com <code>}</code>.'],
            [() => lista.some(n => /^app\.log\.1(\.gz)?$/.test(n)), 'A rotação ainda não aconteceu. Force com <code>sudo logrotate -f /etc/logrotate.conf</code> e confira <code>ls -l /var/log/app/</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 16.3 ============================== */
  LX.lesson('m16', {
    id: 'l16-3', n: '16.3', title: 'Monitorar: carga, memória, disco e I/O',
    goal: 'Olhar quatro números e saber dizer se a máquina está saudável, sobrecarregada ou prestes a cair — e por qual dos quatro motivos.',
    body: [
      { h2: 'A pergunta "o servidor está lento" não é uma pergunta' },
      { p: '"Está lento" descreve o sintoma. O trabalho é descobrir <strong>qual recurso acabou</strong>. Só existem quatro candidatos, e cada um tem um instrumento próprio:' },
      {
        table: {
          head: ['Recurso', 'Instrumento', 'Sinal de problema'],
          rows: [
            ['<strong>CPU</strong>', '<code>uptime</code>, <code>top</code>', 'load acima do número de núcleos'],
            ['<strong>Memória</strong>', '<code>free -h</code>', '<code>available</code> baixo, swap sendo usado'],
            ['<strong>Disco (espaço)</strong>', '<code>df -h</code>, <code>df -i</code>', 'acima de 90%, ou inodes esgotados'],
            ['<strong>Disco (velocidade)</strong>', '<code>vmstat</code>, <code>iostat</code>', 'processos em estado <code>D</code>, <code>wa</code> alto']
          ]
        }
      },
      { p: 'Descobrir qual dos quatro é o gargalo leva trinta segundos e elimina 90% do chute.' },

      { h2: 'Load average: o número mais mal interpretado do Linux' },
      { code: ['$ uptime', '$ cat /proc/loadavg', '$ nproc'] },
      { p: 'A saída traz três números: a média de processos <strong>querendo rodar ou esperando disco</strong> em 1, 5 e 15 minutos.' },
      {
        box: 'key', label: 'Como ler de verdade', body: [
          { p: 'O número sozinho não significa nada — ele só faz sentido <strong>dividido pelo número de núcleos</strong>.' },
          {
            ascii: `load 4.0 numa máquina de 1 núcleo  →  400% — fila enorme
load 4.0 numa máquina de 4 núcleos →  100% — no limite
load 4.0 numa máquina de 16 núcleos→   25% — folgada`
          },
          { p: 'E a comparação entre os três números conta a história: <code>0.5 2.0 4.0</code> é um pico que <strong>já passou</strong>; <code>4.0 2.0 0.5</code> é um problema que <strong>está começando agora</strong>. O primeiro você investiga com calma, o segundo você atende.' }
        ]
      },
      { p: 'A armadilha: no Linux, ao contrário de outros Unix, o load conta também os processos travados em <strong>espera de disco</strong> (estado <code>D</code>). Uma máquina com load 20 e CPU a 5% não está com falta de processador — está com o disco (ou a rede, num NFS) engasgado.' },

      { h2: 'Memória: pare de olhar o "free"' },
      { code: ['$ free -h', '$ free -m'] },
      {
        ascii: `              total   used    free   shared  buff/cache  available
Mem:          3,8Gi   1,1Gi   180Mi    12Mi      2,5Gi       2,4Gi
                              ↑                    ↑            ↑
                       "só 180 MB!"        cache do kernel   o que
                        — irrelevante      (descartável)     importa`
      },
      { p: 'O Linux usa toda a memória livre como cache de disco, porque RAM parada é desperdício. Um servidor saudável tem <code>free</code> baixo — é sinal de que o cache está funcionando. <strong>A coluna que importa é <code>available</code></strong>: quanto uma aplicação nova conseguiria alocar, contando que o kernel vai devolver o cache.' },
      {
        box: 'warn', label: 'Swap: o alarme silencioso', body: [
          { p: 'Swap em uso não é necessariamente ruim — o kernel move para o disco páginas que ninguém toca há horas. O que é ruim é <strong>swap ativo</strong>: páginas indo e voltando o tempo todo. Você vê isso nas colunas <code>si</code> e <code>so</code> do <code>vmstat 1</code>. Se elas não zeram, a máquina está trocando RAM por disco continuamente e cada operação ficou milhares de vezes mais lenta.' },
          { p: 'E quando a memória acaba de vez, o kernel escolhe uma vítima e a mata. Isso aparece no <code>dmesg</code> como <code>Out of memory: Killed process</code>. Se um serviço "morre sozinho" sem log de erro próprio, esse é o primeiro lugar para olhar.' }
        ]
      },

      { h2: 'Disco: dois jeitos de encher' },
      { code: ['$ df -h', '$ df -i', '$ sudo du -sh /var/log'] },
      { p: 'Todo mundo conhece o primeiro jeito: acabaram os <strong>bytes</strong>. O segundo pega gente desprevenida: acabaram os <strong>inodes</strong>. Cada arquivo consome um inode, independente do tamanho. Um diretório de cache com milhões de arquivos de 1 KB esgota os inodes com o disco em 15% de uso — e o sistema responde <code>No space left on device</code>, o que manda você olhar o número errado.' },
      { p: 'A rotina de investigação, quando o <code>df</code> acusa, é sempre a mesma descida:' },
      { code: ['$ sudo du -sh /var/* 2>/dev/null | sort -rh | head -5'] },
      { p: 'Olhe o maior, entre nele, repita. Em três ou quatro passos você chega no culpado. E lembre da aula anterior: se o <code>du</code> soma muito menos do que o <code>df</code> acusa, procure arquivo apagado ainda aberto com <code>sudo lsof | grep deleted</code>.' },

      { h2: 'vmstat: os quatro recursos numa tela só' },
      { code: ['$ vmstat 1 3'] },
      {
        table: {
          head: ['Coluna', 'Significa', 'Preocupa quando'],
          rows: [
            ['<code>r</code>', 'processos prontos, esperando CPU', 'maior que o nº de núcleos'],
            ['<code>b</code>', 'processos bloqueados em I/O', 'consistentemente > 0'],
            ['<code>si</code> / <code>so</code>', 'swap entrando / saindo', 'diferente de 0 continuamente'],
            ['<code>us</code> / <code>sy</code>', 'CPU em usuário / sistema', '<code>sy</code> alto = muita syscall'],
            ['<code>wa</code>', 'CPU parada esperando disco', 'acima de 20%'],
            ['<code>id</code>', 'CPU ociosa', 'perto de 0 com <code>wa</code> baixo = CPU é o gargalo']
          ]
        }
      },
      { p: 'A primeira linha do <code>vmstat</code> é a média desde o boot e deve ser <strong>ignorada</strong>. Sempre rode com intervalo (<code>vmstat 1</code>) e leia da segunda linha em diante.' },
      {
        box: 'note', label: 'Acompanhar sem ficar apertando Enter', body: [
          { p: 'O <code>watch</code> repete um comando a cada N segundos na mesma tela: <code>watch -n 2 df -h</code>. Combinado com <code>-d</code>, ele destaca o que mudou entre uma execução e outra — ótimo para ver um diretório crescendo em tempo real.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'São quatro recursos: CPU, memória, espaço em disco e velocidade de disco. Descubra qual antes de mexer em qualquer coisa.',
          'Load só significa algo dividido pelo número de núcleos — e conta espera de disco, não só CPU.',
          'Em memória, olhe <code>available</code>, não <code>free</code>. Swap em movimento (<code>si</code>/<code>so</code>) é o alarme.',
          'Disco enche de duas formas: bytes (<code>df -h</code>) e inodes (<code>df -i</code>).',
          '<code>vmstat 1</code> mostra os quatro de uma vez; ignore a primeira linha.'
        ]
      }
    ],
    tasks: [
      {
        id: 't16-3-a', kind: 'guiado', title: 'O exame de trinta segundos',
        body: [
          { p: 'Este é o conjunto de comandos que você roda ao receber "o servidor está estranho". Faça-o inteiro:' },
          { code: ['$ uptime', '$ nproc', '$ free -h', '$ df -h', '$ df -i', '$ vmstat 1 3'] },
          { p: 'Compare o load com o <code>nproc</code>. Compare <code>available</code> com <code>total</code>. Compare o uso em bytes com o uso em inodes. Nesta máquina tudo está folgado — é bom conhecer o normal antes de precisar reconhecer o anormal.' }
        ],
        hints: ['O <code>vmstat 1 3</code> coleta três amostras de um segundo e sai sozinho.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /\buptime\b|loadavg/), 'Veja o load com <code>uptime</code>.'],
          [() => H.usedCommand(ctx, /\bnproc\b|cpuinfo/), 'Descubra quantos núcleos a máquina tem com <code>nproc</code> — sem isso o load não significa nada.'],
          [() => H.usedCommand(ctx, /\bfree\b/), 'Olhe a memória com <code>free -h</code>.'],
          [() => H.usedCommand(ctx, /\bdf\b(?!.*-i)/), 'Veja o espaço em disco com <code>df -h</code>.'],
          [() => H.usedCommand(ctx, /df\s+.*-i/), 'Veja também os inodes com <code>df -i</code> — é a segunda forma de encher um disco.'],
          [() => H.usedCommand(ctx, /\bvmstat\b/), 'Rode <code>vmstat 1 3</code>.']
        ])
      },
      {
        id: 't16-3-q', kind: 'quiz', title: 'Diagnóstico: quatro números',
        body: [
          { p: 'Uma máquina de <strong>4 núcleos</strong> apresenta:' },
          {
            code: [
              '$ uptime',
              ' 03:14:07 up 61 days,  load average: 18.42, 17.90, 15.33',
              '$ free -h  →  available 2,9Gi de 8,0Gi   swap: 0B usado',
              '$ df -h    →  /  47% usado',
              '$ vmstat 1 →  r: 1   b: 12   si: 0  so: 0   us: 4  sy: 3  wa: 88  id: 5'
            ], run: false, lang: 'text'
          },
          { p: 'Qual é o gargalo?' }
        ],
        options: [
          { text: 'Disco: <code>wa</code> em 88% e 12 processos bloqueados indicam que quase todo mundo está parado esperando I/O.', correct: true },
          { text: 'CPU: um load de 18 numa máquina de 4 núcleos é 4,5× a capacidade.', why: 'O load está altíssimo, mas <code>us</code> + <code>sy</code> somam 7% e a fila de prontos (<code>r</code>) é 1. Ninguém está disputando processador: o load está inflado pelos processos em espera de disco, que no Linux entram nessa conta.' },
          { text: 'Memória: sobram só 2,9 GB de 8 GB.', why: '2,9 GB disponíveis é bastante, e o swap está zerado — se fosse falta de memória, <code>si</code> e <code>so</code> estariam se movendo.' },
          { text: 'Rede, já que nenhum dos quatro indicadores locais explica.', why: 'O <code>wa</code> de 88% explica muito bem, e é local. Rede entraria na conta se o I/O fosse para um sistema de arquivos remoto — o que seria a investigação seguinte, não a conclusão.' }
        ],
        explain: 'Este é o caso clássico em que o load engana. Como o Linux soma ao load os processos em estado <code>D</code> (espera ininterrompível de disco), um armazenamento lento produz load altíssimo com CPU ociosa. Os passos seguintes seriam <code>iostat -x 1</code> para ver qual dispositivo está saturado e <code>ps -eo state,pid,comm | grep "^D"</code> para descobrir quem está preso.'
      },
      {
        id: 't16-3-b', kind: 'desafio', title: 'Painel de saúde do servidor',
        body: [
          { p: 'Monte um <code>~/painel.sh</code> executável que imprima o exame de trinta segundos em formato de painel, com <strong>exatamente estas quatro linhas</strong>, nesta ordem e nestes rótulos:' },
          {
            code: [
              'CPU: <load de 1 min> / <núcleos>',
              'MEM: <disponível em MB> MB livres de <total em MB> MB',
              'DISCO: <percentual de uso de />',
              'INODES: <percentual de uso de inodes de />'
            ], run: false, lang: 'text'
          },
          { p: 'Exemplo de saída válida: <code>CPU: 0.08 / 2</code>. Todos os números precisam vir de comando, nenhum pode estar escrito no script.' },
          { p: 'Depois rode o script e guarde a saída em <code>~/painel.txt</code>.' }
        ],
        hints: [
          'O load de 1 minuto é o primeiro campo de <code>/proc/loadavg</code>; os núcleos saem de <code>nproc</code>. Para a memória, <code>free -m</code> e a linha <code>Mem:</code>: o total é a coluna 2, o disponível é a coluna 7.',
          'Para o percentual de <code>/</code>: <code>df -h / | awk \'NR==2 {print $5}\'</code>. Para inodes é o mesmo com <code>df -i</code>. Monte cada linha com <code>echo "CPU: $(...) / $(...)"</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/bin\ncat &gt; ~/painel.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\n\necho "CPU: $(awk \'{print $1}\' /proc/loadavg) / $(nproc)"\necho "MEM: $(free -m | awk \'/^Mem:/ {print $7}\') MB livres de $(free -m | awk \'/^Mem:/ {print $2}\') MB"\necho "DISCO: $(df -h / | awk \'NR==2 {print $5}\')"\necho "INODES: $(df -i / | awk \'NR==2 {print $5}\')"\nEOF\nchmod +x ~/painel.sh\n./painel.sh\n./painel.sh &gt; ~/painel.txt\ncat ~/painel.txt</pre></div><p style="margin-top:8px">Quatro linhas, quatro recursos. Um script assim, rodando por cron e mandando a saída para algum lugar, é o embrião honesto de qualquer sistema de monitoramento — e ensina mais sobre a máquina do que um painel pronto.</p>',
        forja: ["printf 'CPU: 0.08 / 2\\nMEM: 2000 MB livres de 4000 MB\\nDISCO: 47%%\\nINODES: 37%%\\n' > ~/painel.txt"],
        check: async (ctx) => {
          const sc = H.readText(ctx, '/home/aluno/painel.sh');
          const saida = H.readText(ctx, '/home/aluno/painel.txt');
          const l = saida.split('\n').map(x => x.trim()).filter(Boolean);
          /* o painel tem de descrever ESTA máquina: o verificador mede tudo de novo */
          const load = (H.readText(ctx, '/proc/loadavg').split(/\s+/)[0]) || '';
          const nucleos = H.readText(ctx, '/proc/cpuinfo').split('\n').filter(x => /^processor/.test(x)).length;
          const mem = /MemAvailable:\s+(\d+)/.exec(H.readText(ctx, '/proc/meminfo'));
          const memTotal = /MemTotal:\s+(\d+)/.exec(H.readText(ctx, '/proc/meminfo'));
          const dfSaida = ctx.run ? (await ctx.run('df -h / | awk \'NR==2 {print $5}\'; df -i / | awk \'NR==2 {print $5}\'')).out : '';
          const [pDisco, pInode] = dfSaida.split('\n').map(x => x.trim()).filter(Boolean);
          const perto = (a, b) => Math.abs(a - b) <= 3;
          return H.checkAll([
            [!!sc, 'Não encontrei <code>~/painel.sh</code>.'],
            [() => (H.mode(ctx, '/home/aluno/painel.sh') & 0o111) !== 0, 'O script precisa ser executável (<code>chmod +x ~/painel.sh</code>).'],
            [() => /^#!/.test(sc), 'Falta o shebang na primeira linha do script.'],
            [() => /loadavg|uptime/.test(sc) && /nproc|processor/.test(sc), 'O script precisa obter o load e os núcleos por comando, não escrevê-los.'],
            [() => /free/.test(sc) && /df/.test(sc), 'O script precisa usar <code>free</code> e <code>df</code>.'],
            [!!saida.trim(), 'Rode o script e guarde a saída em <code>~/painel.txt</code>.'],
            [() => l.length === 4, () => `O painel deve ter exatamente 4 linhas; tem ${l.length}.`],
            [() => /^CPU:\s*[\d.]+\s*\/\s*\d+$/.test(l[0] || ''), () => `A primeira linha deve ser <code>CPU: &lt;load&gt; / &lt;núcleos&gt;</code>. Obtive: "${l[0] || ''}".`],
            [() => (l[0] || '').includes(load) && (l[0] || '').trim().endsWith(String(nucleos)), () => `Os números da linha CPU não são os desta máquina (load ${load}, ${nucleos} núcleos).`],
            [() => /^MEM:\s*\d+\s*MB livres de\s*\d+\s*MB$/.test(l[1] || ''), () => `A segunda linha deve ser <code>MEM: &lt;livres&gt; MB livres de &lt;total&gt; MB</code>. Obtive: "${l[1] || ''}".`],
            [() => { const n = (l[1] || '').match(/\d+/g) || []; return mem && memTotal && perto(+n[0], Math.floor(+mem[1] / 1024)) && perto(+n[1], Math.floor(+memTotal[1] / 1024)); },
              'Os números de memória não batem com o <code>free</code> desta máquina.'],
            [() => /^DISCO:\s*\d+%$/.test(l[2] || ''), () => `A terceira linha deve ser <code>DISCO: &lt;percentual&gt;</code>. Obtive: "${l[2] || ''}".`],
            [() => !pDisco || (l[2] || '').includes(pDisco), () => `O uso de disco não bate: o <code>df -h /</code> diz ${pDisco}.`],
            [() => /^INODES:\s*\d+%$/.test(l[3] || ''), () => `A quarta linha deve ser <code>INODES: &lt;percentual&gt;</code>. Obtive: "${l[3] || ''}".`],
            [() => !pInode || (l[3] || '').includes(pInode), () => `O uso de inodes não bate: o <code>df -i /</code> diz ${pInode}.`]
          ]);
        }
      }
    ]
  });

  /* ============================== 16.4 ============================== */
  LX.lesson('m16', {
    id: 'l16-4', n: '16.4', title: 'Tarefas agendadas: cron e systemd timers',
    goal: 'Agendar trabalho recorrente que realmente roda — e saber depurar quando "funciona no meu terminal e não no agendador".',
    body: [
      { h2: 'Por que existe agendamento' },
      { p: 'Boa parte do trabalho de administração é repetitivo e previsível: girar log, fazer backup, renovar certificado, limpar arquivo temporário, coletar métrica. Nada disso pode depender de alguém lembrar. <strong>O sistema precisa fazer sozinho, no horário certo, mesmo com todo mundo dormindo.</strong>' },
      { p: 'O Linux tem duas ferramentas para isso, de gerações diferentes, e as duas convivem na mesma máquina.' },

      { h2: 'cron: cinco campos e um comando' },
      { code: ['$ crontab -l', '$ cat /etc/crontab', '$ ls /etc/cron.d/'] },
      {
        ascii: `┌───────────── minuto        (0-59)
│ ┌─────────── hora          (0-23)
│ │ ┌───────── dia do mês    (1-31)
│ │ │ ┌─────── mês           (1-12)
│ │ │ │ ┌───── dia da semana (0-7, 0 e 7 = domingo)
│ │ │ │ │
* * * * *  comando a executar`
      },
      {
        table: {
          head: ['Expressão', 'Quando roda'],
          rows: [
            ['<code>0 3 * * *</code>', 'todo dia às 03:00'],
            ['<code>*/15 * * * *</code>', 'a cada 15 minutos'],
            ['<code>0 2 * * 0</code>', 'domingo às 02:00'],
            ['<code>30 4 1 * *</code>', 'dia 1º de cada mês às 04:30'],
            ['<code>0 9-18 * * 1-5</code>', 'de hora em hora, das 9h às 18h, de segunda a sexta'],
            ['<code>@reboot</code>', 'uma vez, quando a máquina inicia']
          ]
        }
      },
      {
        box: 'warn', label: 'A armadilha do dia do mês com o dia da semana', body: [
          { p: '<code>0 0 13 * 5</code> <strong>não</strong> significa "sexta-feira 13". Quando os dois campos de dia estão preenchidos, o cron usa <em>OU</em>, não <em>E</em>: essa linha roda todo dia 13 <strong>e</strong> toda sexta-feira. Para "sexta-feira 13" de verdade é preciso testar a data dentro do próprio comando.' }
        ]
      },

      { h2: 'Três lugares diferentes para agendar' },
      {
        table: {
          head: ['Onde', 'Como se edita', 'Tem campo de usuário?', 'Use quando'],
          rows: [
            ['crontab do usuário', '<code>crontab -e</code>', 'não — roda como você', 'tarefa pessoal, script no seu home'],
            ['<code>/etc/crontab</code>', 'editar o arquivo', '<strong>sim</strong>', 'quase nunca; prefira o próximo'],
            ['<code>/etc/cron.d/nome</code>', 'criar um arquivo', '<strong>sim</strong>', 'tarefa de sistema, versionável, uma por arquivo']
          ]
        }
      },
      { p: 'Esse campo extra é a fonte de um erro clássico: copiar uma linha do seu <code>crontab -e</code> direto para <code>/etc/cron.d/</code> faz o cron interpretar o primeiro pedaço do comando como nome de usuário, e a tarefa nunca roda.' },
      { code: ['$ printf \'*/10 * * * * /usr/local/bin/coleta.sh\\n\' | crontab -', '$ crontab -l'] },
      { p: 'O <code>crontab -</code> instala a agenda lendo da entrada padrão — é assim que se automatiza a configuração, sem abrir editor. E repare que o <code>crontab</code> <strong>valida</strong> antes de instalar: uma linha malformada é recusada inteira, e a agenda anterior é preservada.' },

      { h2: 'Por que o seu script funciona no terminal e falha no cron' },
      { p: 'É a pergunta mais frequente sobre cron, e a resposta quase sempre é a mesma: <strong>o cron não é o seu shell</strong>.' },
      {
        table: {
          head: ['No seu terminal', 'No cron'],
          rows: [
            ['<code>PATH</code> completo, vindo do <code>.bashrc</code>', '<code>PATH=/usr/bin:/bin</code>, e só'],
            ['<code>~/.bashrc</code> e <code>~/.profile</code> carregados', '<strong>nenhum</strong> arquivo de perfil é lido'],
            ['variáveis de ambiente da sessão', 'praticamente nenhuma'],
            ['diretório atual onde você está', 'sempre o <code>$HOME</code> do usuário'],
            ['saída aparece na tela', 'vira e-mail — que ninguém lê, ou some']
          ]
        }
      },
      { p: 'As três correções, na ordem em que se aplicam:' },
      {
        ul: [
          '<strong>Caminho absoluto sempre.</strong> <code>/usr/local/bin/meu.sh</code>, nunca <code>meu.sh</code>. E dentro do script, <code>/usr/bin/docker</code> em vez de <code>docker</code> — ou defina o <code>PATH</code> na primeira linha do script.',
          '<strong>Redirecione a saída.</strong> <code>&gt;&gt; /var/log/coleta.log 2&gt;&amp;1</code> no fim da linha do cron. Sem isso, quando falhar, você não terá nada para ler.',
          '<strong>Teste no ambiente do cron</strong>, não no seu: <code>env -i /bin/sh -c \'/usr/local/bin/meu.sh\'</code> aproxima bastante — sem nenhuma variável herdada.'
        ]
      },
      {
        box: 'note', label: 'Cuidado com o %', body: [
          { p: 'No cron, <code>%</code> significa "nova linha" e tudo depois do primeiro <code>%</code> vira entrada padrão do comando. Por isso <code>date +%F</code> numa linha de cron <strong>quebra</strong>. Escape com <code>\\%</code> ou, melhor, ponha o comando dentro de um script.' }
        ]
      },

      { h2: 'systemd timers: a alternativa moderna' },
      { p: 'O systemd resolve o mesmo problema com duas unidades: uma <code>.service</code> que diz <em>o que</em> fazer e uma <code>.timer</code> que diz <em>quando</em>. Dá mais trabalho para escrever e entrega bem mais em troca.' },
      { code: ['$ systemctl list-timers --no-pager', '$ systemd-analyze calendar daily', '$ systemd-analyze calendar "Mon *-*-* 03:30:00"'] },
      {
        table: {
          head: ['', 'cron', 'systemd timer'],
          rows: [
            ['Escrever', 'uma linha', 'dois arquivos'],
            ['Log', 'você tem que redirecionar', 'vai para o journal automaticamente'],
            ['Ver o que falhou', 'não existe', '<code>systemctl status</code> da unit'],
            ['Perdeu o horário (máquina desligada)', 'não roda', '<code>Persistent=true</code> roda ao ligar'],
            ['Espalhar a carga', 'não', '<code>RandomizedDelaySec=</code>'],
            ['Depende de outro serviço', 'não', '<code>After=</code>, <code>Requires=</code>'],
            ['Limitar recursos', 'não', 'as diretivas de <code>[Service]</code>']
          ]
        }
      },
      { p: 'O <code>OnCalendar=</code> tem sintaxe própria — <code>DiaSemana Ano-Mês-Dia Hora:Minuto:Segundo</code> — com atalhos como <code>daily</code>, <code>hourly</code>, <code>weekly</code>. E há uma ferramenta para conferir antes de confiar: <code>systemd-analyze calendar "Mon *-*-* 03:30:00"</code> devolve a forma normalizada e o próximo disparo. <strong>Use sempre</strong>: uma expressão inválida faz o timer nunca disparar, em silêncio.' },
      {
        box: 'key', label: 'Qual escolher', body: [
          { p: 'Para uma tarefa pessoal, simples, no seu usuário: cron resolve e é mais rápido de escrever. Para qualquer coisa que a operação vai depender — backup, sincronismo, coleta — vale o timer: quando falhar às três da manhã, você vai querer <code>systemctl status</code> e <code>journalctl -u</code>, não um e-mail perdido.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Cinco campos: minuto, hora, dia do mês, mês, dia da semana. Os dois campos de dia se combinam com OU.',
          '<code>crontab -e</code> para o usuário; <code>/etc/cron.d/</code> para o sistema — e lá existe um campo de usuário a mais.',
          'O cron roda com <code>PATH</code> mínimo e sem ler perfil nenhum: caminho absoluto e redirecionamento de saída não são opcionais.',
          '<code>%</code> tem significado especial no cron.',
          'Timer do systemd custa mais para escrever e dá log, estado, recuperação de horário perdido e dependências.',
          'Valide a agenda antes: <code>systemd-analyze calendar</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 't16-4-a', kind: 'guiado', title: 'Os três lugares do cron',
        body: [
          { p: 'Veja como a mesma ideia aparece em três formatos:' },
          { code: ['$ cat /etc/crontab', '$ cat /etc/cron.d/e2scrub_all', '$ printf \'*/10 * * * * /usr/local/bin/coleta.sh >> /var/log/coleta.log 2>&1\\n\' | crontab -', '$ crontab -l'] },
          { p: 'Compare: as linhas de <code>/etc/crontab</code> e <code>/etc/cron.d/</code> têm <code>root</code> entre a agenda e o comando; a sua não tem, porque já roda como você.' },
          { p: 'Agora veja o que acontece com uma linha inválida:' },
          { code: ['$ printf \'todo dia às 3\\n\' | crontab -', '$ crontab -l'] },
          { p: 'O cron recusou e manteve a agenda anterior. É uma proteção real: uma linha errada não apaga o que já estava funcionando.' }
        ],
        hints: ['O <code>crontab -</code> lê a agenda da entrada padrão.'],
        check: async (ctx) => {
          const cron = H.readText(ctx, '/var/spool/cron/crontabs/aluno');
          return H.checkAll([
            [() => H.usedCommand(ctx, /cat\s+\/etc\/crontab|\/etc\/crontab/), 'Leia o <code>/etc/crontab</code> e repare no campo de usuário.'],
            [() => H.usedCommand(ctx, /cron\.d/), 'Veja um arquivo de <code>/etc/cron.d/</code>.'],
            [() => /coleta\.sh/.test(cron), 'Instale a agenda de exemplo com <code>crontab -</code>.'],
            [() => !/todo dia/.test(cron), 'A linha inválida não deveria ter sido instalada — se ela está lá, algo saiu do roteiro.']
          ]);
        }
      },
      {
        id: 't16-4-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um backup foi agendado assim, e há duas semanas não gera arquivo nenhum. O script funciona quando rodado à mão.' },
          { code: ['0 3 * * * backup.sh'], run: false, lang: 'text' },
          { p: 'Qual é o problema mais provável — e o que é preciso mudar?' }
        ],
        options: [
          { text: 'Caminho relativo: o cron roda com <code>PATH</code> mínimo e não encontra <code>backup.sh</code>. Use o caminho absoluto e redirecione a saída para um log.', correct: true },
          { text: 'A expressão <code>0 3 * * *</code> está errada; o correto seria <code>3 0 * * *</code>.', why: '<code>0 3 * * *</code> é minuto 0 da hora 3, ou seja, 03:00 — está certo. <code>3 0 * * *</code> seria 00:03.' },
          { text: 'Falta o campo de usuário antes do comando.', why: 'Ele só existe em <code>/etc/crontab</code> e <code>/etc/cron.d/</code>. Num crontab de usuário, acrescentar esse campo é que quebraria a linha.' },
          { text: 'O cron precisa ser reiniciado depois de cada alteração.', why: 'O cron relê o crontab sozinho. <code>crontab -e</code> já sinaliza a mudança; reiniciar o serviço não é necessário.' }
        ],
        explain: 'A linha corrigida fica <code>0 3 * * * /usr/local/bin/backup.sh &gt;&gt; /var/log/backup.log 2&gt;&amp;1</code>. Os dois acréscimos importam igualmente: o caminho absoluto faz rodar, e o redirecionamento faz você <strong>saber</strong> que rodou. Sem o segundo, o próximo diagnóstico seria tão às cegas quanto este.'
      },
      {
        id: 't16-4-b', kind: 'desafio', title: 'Agendar a limpeza de temporários',
        body: [
          { p: 'O <code>/var/tmp/app</code> acumula arquivos e ninguém limpa. Monte a automação completa:' },
          {
            ul: [
              'um script <code>/usr/local/bin/limpa-tmp.sh</code>, executável, com shebang e <code>set -euo pipefail</code>, que apaga de <code>/var/tmp/app</code> os arquivos com mais de 7 dias e registra o que fez em <code>/var/log/limpa-tmp.log</code>;',
              'uma entrada no <strong>crontab do root</strong> rodando esse script <strong>todo dia às 4h da manhã</strong>, com a saída redirecionada para <code>/var/log/limpa-tmp.log</code>.'
            ]
          },
          { p: 'Crie o diretório antes: <code>sudo mkdir -p /var/tmp/app</code>.' },
          { p: 'Lembre de tudo o que a aula disse sobre o ambiente do cron ao escrever a linha.' }
        ],
        hints: [
          'Para apagar por idade: <code>find /var/tmp/app -type f -mtime +7 -delete</code>. O <code>-mtime +7</code> é "modificado há mais de 7 dias".',
          'A linha do cron do root instala-se com <code>printf \'...\\n\' | sudo crontab -</code>. Ela precisa de caminho absoluto e de <code>&gt;&gt; /var/log/limpa-tmp.log 2&gt;&amp;1</code> no fim.'
        ],
        solution: '<div class="code"><pre>sudo mkdir -p /var/tmp/app\n\nsudo tee /usr/local/bin/limpa-tmp.sh &gt; /dev/null &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\nALVO=/var/tmp/app\nfind "$ALVO" -type f -mtime +7 -delete\necho "$(date +%F) limpeza de $ALVO concluida"\nEOF\nsudo chmod 755 /usr/local/bin/limpa-tmp.sh\n\nprintf \'0 4 * * * /usr/local/bin/limpa-tmp.sh &gt;&gt; /var/log/limpa-tmp.log 2&gt;&amp;1\\n\' | sudo crontab -\nsudo crontab -l\nsudo /usr/local/bin/limpa-tmp.sh</pre></div><p style="margin-top:8px">Repare que a agenda é curta e o cuidado todo está fora dela: caminho absoluto, saída redirecionada e um script que aborta no primeiro erro. A linha do cron é a parte fácil.</p>',
        check: async (ctx) => {
          const sc = H.readText(ctx, '/usr/local/bin/limpa-tmp.sh');
          const cron = H.readText(ctx, '/var/spool/cron/crontabs/root');
          const linha = cron.split('\n').map(x => x.trim()).find(l => l && !l.startsWith('#') && /limpa-tmp/.test(l)) || '';
          const campos = linha.split(/\s+/);
          return H.checkAll([
            [() => H.isDir(ctx, '/var/tmp/app'), 'Crie o diretório <code>/var/tmp/app</code>.'],
            [!!sc, 'Não encontrei <code>/usr/local/bin/limpa-tmp.sh</code>.'],
            [() => (H.mode(ctx, '/usr/local/bin/limpa-tmp.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [() => /^#!/.test(sc), 'Falta o shebang.'],
            [() => /set\s+-euo\s+pipefail|set\s+-e/.test(sc), 'O script precisa de <code>set -euo pipefail</code>.'],
            [() => /\bfind\b/.test(sc) && /\/var\/tmp\/app/.test(sc), 'O script deve usar <code>find</code> sobre <code>/var/tmp/app</code> (direto ou por uma variável).'],
            [() => /-mtime\s*\+7/.test(sc), 'Falta o critério de idade <code>-mtime +7</code> (mais de 7 dias).'],
            [() => /-delete|-exec\s+rm/.test(sc), 'O script encontra os arquivos mas não os apaga.'],
            [!!linha, 'Não encontrei a tarefa no crontab do <strong>root</strong>. Instale com <code>| sudo crontab -</code>.'],
            [() => campos[0] === '0' && campos[1] === '4', () => `A agenda deve ser <code>0 4 * * *</code> (todo dia às 4h). Está: "${campos.slice(0, 5).join(' ')}".`],
            [() => campos[2] === '*' && campos[3] === '*' && campos[4] === '*', 'Os campos de dia, mês e dia da semana devem ser <code>*</code> — a tarefa é diária.'],
            [() => /^\//.test(campos[5] || ''), 'O comando precisa de <strong>caminho absoluto</strong>. O cron não tem o seu <code>PATH</code>.'],
            [() => />>?\s*\/var\/log\/limpa-tmp\.log/.test(linha), 'Redirecione a saída para <code>/var/log/limpa-tmp.log</code> — sem isso você não saberá se rodou.'],
            [() => /2>&1/.test(linha), 'Falta <code>2&gt;&amp;1</code>: sem ele, os erros não vão para o log, que é justamente o que você vai querer ler.']
          ]);
        }
      }
    ]
  });

  /* ============================== 16.5 ============================== */
  LX.lesson('m16', {
    id: 'l16-5', n: '16.5', title: 'Backup e restauração de verdade',
    goal: 'Sair da ilusão do "temos backup" e montar uma rotina com retenção, verificação e — o item que quase todo mundo pula — teste de restauração.',
    body: [
      { h2: 'A frase que assombra' },
      { p: 'Existe uma frase que todo administrador ouve uma vez e nunca mais esquece: <strong>"ninguém quer backup; todo mundo quer restauração"</strong>. É a mesma diferença entre ter um extintor e saber usá-lo com fogo na sua frente.' },
      { p: 'Backup nunca testado é uma crença, não um controle. E ele falha de maneiras específicas e chatas: o arquivo estava corrompido, faltava metade dos dados, a chave de criptografia se perdeu, o script vinha falhando em silêncio há três meses porque ninguém lia o log.' },

      { h2: 'A regra 3-2-1' },
      {
        ascii: `3  cópias dos dados          (o original + duas)
2  mídias/lugares diferentes  (disco local + outro destino)
1  cópia fora do site         (outra máquina, outra região, nuvem)`
      },
      { p: 'A terceira é a que quase sempre falta e a que mais importa. Um backup guardado na mesma máquina protege contra "apaguei sem querer" e contra nada mais: não protege contra o disco morrer, contra ransomware, contra a máquina ser destruída. O critério prático é: <em>se esta máquina sumir agora, o backup some junto?</em> Se sim, você tem uma cópia, não um backup.' },

      { h2: 'O que entra e o que não entra' },
      {
        table: {
          head: ['Fazer backup', 'Não fazer backup', 'Por quê'],
          rows: [
            ['<code>/etc</code>', '', 'a configuração inteira do servidor'],
            ['<code>/home</code>, <code>/srv</code>, <code>/var/www</code>', '', 'os dados de gente'],
            ['dumps de banco', 'os arquivos do banco em uso', 'copiar arquivo de banco vivo produz cópia inconsistente'],
            ['<code>/var/lib</code> de serviços parados', '<code>/proc</code>, <code>/sys</code>, <code>/dev</code>', 'não são arquivos de verdade'],
            ['a lista de pacotes (<code>dpkg --get-selections</code>)', '<code>/usr</code>, <code>/bin</code>', 'reinstalar é mais rápido e mais limpo'],
            ['', '<code>/tmp</code>, caches', 'volume alto, valor zero']
          ]
        }
      },
      {
        box: 'key', label: 'Banco de dados é caso à parte', body: [
          { p: 'Copiar os arquivos de um banco em funcionamento gera um backup que <em>parece</em> bom e não restaura. O jeito certo é pedir ao próprio banco: <code>pg_dump</code>, <code>mysqldump</code>, ou um snapshot consistente. Essa é uma das poucas regras deste curso que não tem exceção prática.' }
        ]
      },

      { h2: 'Completo, incremental, diferencial' },
      {
        table: {
          head: ['Tipo', 'O que copia', 'Restaurar exige', 'Custo'],
          rows: [
            ['<strong>Completo</strong>', 'tudo, sempre', 'um arquivo só', 'muito espaço, muito tempo'],
            ['<strong>Incremental</strong>', 'o que mudou desde o último backup', 'o completo + <em>todos</em> os incrementais', 'pouco espaço, restauro frágil'],
            ['<strong>Diferencial</strong>', 'o que mudou desde o último completo', 'o completo + o último diferencial', 'meio-termo']
          ]
        }
      },
      { p: 'Na prática, para um servidor pequeno, o padrão que resolve é: completo semanal + incremental diário, ou simplesmente <code>rsync</code> com <code>--link-dest</code>, que produz snapshots que <em>parecem</em> completos mas compartilham os arquivos não alterados por hard link — ocupando o espaço de um incremental.' },

      { h2: 'Retenção: o que impede o disco de encher' },
      { p: 'Toda rotina de backup precisa responder três perguntas, e a terceira é onde as pessoas param:' },
      {
        ul: [
          '<strong>Com que frequência?</strong> — define quanto trabalho você aceita perder (o RPO).',
          '<strong>Por quanto tempo guardamos?</strong> — define quanto disco a rotina consome, para sempre.',
          '<strong>Quando foi o último teste de restauração?</strong> — define se as duas primeiras respostas valem alguma coisa.'
        ]
      },
      { p: 'Sem política de retenção, o backup vira o próprio incidente: o disco enche de cópias e derruba o servidor que ele deveria proteger. A implementação é uma linha:' },
      { code: ['$ find /var/backups -name "app-*.tar.gz" -mtime +30 -delete'], run: false },
      { p: 'Um padrão mais realista é o escalonado: 7 diários, 4 semanais, 12 mensais. Você mantém granularidade fina para o passado recente e granularidade grossa para o passado distante — que é exatamente como as pessoas precisam.' },

      { h2: 'Verificar: sem isso é fé' },
      { p: 'Três verificações, do mais barato ao mais caro, e cada uma pega um tipo de falha:' },
      {
        ul: [
          '<strong>O arquivo existe e não está vazio?</strong> — pega o script que falhou no meio.',
          '<strong>A soma de verificação confere?</strong> — <code>sha256sum</code> ao gerar, <code>sha256sum -c</code> ao conferir; pega corrupção em disco ou na transferência.',
          '<strong>A restauração funciona?</strong> — extrair em um diretório temporário e comparar com <code>diff -r</code>; pega tudo o mais, inclusive o backup que sempre esteve incompleto.'
        ]
      },
      {
        box: 'warn', label: 'O teste que precisa estar no calendário', body: [
          { p: 'Restauração testada uma vez, no dia em que o script foi escrito, não conta. Coisas mudam: o caminho muda, um diretório novo aparece e ninguém o incluiu, o formato muda. O teste de restauro precisa ser <strong>recorrente</strong> — agendado, como o próprio backup.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Backup não testado é crença. O que se mede é a <em>restauração</em>.',
          '3-2-1: três cópias, dois lugares, uma fora da máquina.',
          'Banco de dados se copia com dump, nunca copiando os arquivos em uso.',
          'Retenção não é detalhe: sem ela o backup enche o disco e vira o incidente.',
          'Verifique em três níveis: existe, a soma confere, restaura.'
        ]
      }
    ],
    tasks: [
      {
        id: 't16-5-a', kind: 'guiado', title: 'Gere, some e confira',
        body: [
          { p: 'Faça o ciclo mínimo: empacotar excluindo o que não serve, gerar a soma, conferir, e testar a retenção sem apagar nada por engano.' },
          {
            code: [
              '$ mkdir -p ~/demo/site ~/demo/backups',
              '$ echo "conteudo" > ~/demo/site/index.html',
              '$ echo "cache" > ~/demo/site/tmp.cache',
              '$ tar --exclude="*.cache" -czf ~/demo/backups/site.tar.gz -C ~/demo site',
              '$ cd ~/demo/backups && sha256sum site.tar.gz > SHA256SUMS',
              '$ sha256sum -c SHA256SUMS',
              '$ find ~/demo/backups -name "site*.tar.gz" -mtime +30 -delete',
              '$ ls ~/demo/backups',
              '$ cd ~'
            ]
          },
          { p: 'O <code>find ... -delete</code> não imprimiu nada e o arquivo continua em <code>ls</code>: o backup acabou de ser criado, então não tem 30 dias. É exatamente esse silêncio que você quer ver rodando a retenção em produção.' }
        ],
        hints: ['<code>sha256sum -c</code> lê o arquivo de somas e confirma se cada arquivo listado bate com o que está no disco agora.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /tar\s+.*--exclude/), 'Gere o pacote excluindo os arquivos de cache com <code>--exclude</code>.'],
          [() => H.usedCommand(ctx, /sha256sum\s+\S*\.tar\.gz\s*>/), 'Gere a soma de verificação com <code>sha256sum ... &gt; SHA256SUMS</code>.'],
          [() => H.usedCommand(ctx, /sha256sum\s+-c/), 'Confira a soma com <code>sha256sum -c</code>.'],
          [() => H.usedCommand(ctx, /find\s+.*-mtime\s*\+30/), 'Rode a retenção com <code>find ... -mtime +30 -delete</code>.']
        ])
      },
      {
        id: 't16-5-q', kind: 'quiz', title: 'Conceito: isto é um backup?',
        body: [
          { p: 'Uma equipe descreve com orgulho a rotina: "todo dia às 2h um cron roda <code>tar -czf /backup/site-$(date +%F).tar.gz /var/www</code>. O <code>/backup</code> é uma partição separada do mesmo servidor. Temos 400 dias de histórico."' },
          { p: 'Qual é o problema <strong>mais grave</strong> dessa rotina?' }
        ],
        options: [
          { text: 'Tudo está na mesma máquina: se o servidor for perdido, destruído ou tomado por ransomware, os 400 backups vão junto.', correct: true },
          { text: 'Usar <code>tar -czf</code> em vez de uma ferramenta dedicada de backup.', why: '<code>tar</code> é perfeitamente adequado para esse volume. A ferramenta não é o problema.' },
          { text: 'Guardar 400 dias é excessivo e vai encher a partição.', why: 'É um problema real de retenção e vai custar caro em disco — mas é recuperável. Perder tudo de uma vez não é.' },
          { text: 'Rodar às 2h da manhã pode conflitar com outras tarefas agendadas.', why: 'Concorrência de janela é um ajuste fino. Não é o que faz a rotina inteira valer zero num incidente sério.' }
        ],
        explain: 'Partição separada protege contra "apaguei sem querer" e contra o sistema de arquivos raiz encher — e é só. Sumiu a máquina, sumiu o backup. O mesmo comando ganha valor real com um destino remoto: <code>rsync</code> para outro host, envio para armazenamento de objetos, ou um segundo disco que sai fisicamente do lugar. A retenção de 400 dias é o segundo problema, e o terceiro é que ninguém mencionou testar restauração.'
      },
      {
        id: 't16-5-b', kind: 'desafio', title: 'Rotina de backup completa',
        body: [
          { p: 'Monte o cenário e escreva a rotina que a aula descreve.' },
          { code: ['$ mkdir -p ~/site/paginas ~/backups', '$ echo "<h1>inicio</h1>" > ~/site/index.html', '$ echo "conteudo" > ~/site/paginas/sobre.html', '$ echo "cache" > ~/site/tmp.cache'] },
          { p: 'Escreva <code>~/backup-site.sh</code>, executável, que a cada execução:' },
          {
            ul: [
              'gere <code>~/backups/site-AAAA-MM-DD.tar.gz</code> com o conteúdo de <code>~/site</code>, <strong>excluindo</strong> arquivos <code>*.cache</code>;',
              'gere ou atualize <code>~/backups/SHA256SUMS</code> com a soma do arquivo criado;',
              'apague backups com mais de 30 dias (retenção);',
              'aborte no primeiro erro.'
            ]
          },
          { p: 'Depois rode o script e comprove a restauração: extraia em <code>~/restauro</code> e confira que o <code>index.html</code> voltou e que o <code>.cache</code> <strong>não</strong> está lá.' }
        ],
        hints: [
          'Use uma variável para a data: <code>D=$(date +%F)</code> e monte o nome com ela. O <code>--exclude="*.cache"</code> vai no <code>tar</code>.',
          'Gere a soma <strong>dentro</strong> de <code>~/backups</code> (<code>cd</code> antes), senão o caminho gravado no SHA256SUMS não bate na hora de conferir. A retenção é <code>find ~/backups -name "site-*.tar.gz" -mtime +30 -delete</code>.'
        ],
        solution: '<div class="code"><pre>mkdir -p ~/site/paginas ~/backups\necho "&lt;h1&gt;inicio&lt;/h1&gt;" &gt; ~/site/index.html\necho "conteudo" &gt; ~/site/paginas/sobre.html\necho "cache" &gt; ~/site/tmp.cache\n\ncat &gt; ~/backup-site.sh &lt;&lt; \'EOF\'\n#!/bin/bash\nset -euo pipefail\nORIGEM="$HOME/site"\nDESTINO="$HOME/backups"\nD=$(date +%F)\nARQ="$DESTINO/site-$D.tar.gz"\n\nmkdir -p "$DESTINO"\ntar --exclude="*.cache" -czf "$ARQ" -C "$HOME" site\n\ncd "$DESTINO"\nsha256sum "site-$D.tar.gz" &gt; SHA256SUMS\n\nfind "$DESTINO" -name "site-*.tar.gz" -mtime +30 -delete\necho "backup gerado: $ARQ"\nEOF\nchmod +x ~/backup-site.sh\n~/backup-site.sh\n\nmkdir -p ~/restauro\ntar -xzf ~/backups/site-$(date +%F).tar.gz -C ~/restauro\nls -R ~/restauro\ncd ~/backups &amp;&amp; sha256sum -c SHA256SUMS &amp;&amp; cd ~</pre></div><p style="margin-top:8px">Note a ordem: gerar, somar, expirar. E note que o teste de restauro é um passo separado — porque na vida real ele é a parte que se esquece.</p>',
        check: async (ctx) => {
          const sc = H.readText(ctx, '/home/aluno/backup-site.sh');
          const lista = (H.ls(ctx, '/home/aluno/backups') || []).map(x => (typeof x === 'string' ? x : x.name));
          const bkp = lista.find(n => /^site-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(n));
          const sums = H.readText(ctx, '/home/aluno/backups/SHA256SUMS');
          const confere = (sums && ctx.run) ? (await ctx.run('cd ~/backups && sha256sum -c SHA256SUMS 2>&1')).out : '';
          const conteudo = bkp ? (H.read(ctx, '/home/aluno/backups/' + bkp) || '') : '';
          return H.checkAll([
            [!!sc, 'Não encontrei <code>~/backup-site.sh</code>.'],
            [() => (H.mode(ctx, '/home/aluno/backup-site.sh') & 0o111) !== 0, 'O script precisa ser executável.'],
            [() => /set\s+-e/.test(sc), 'Falta <code>set -euo pipefail</code>: um backup que continua depois de um erro é pior que nenhum.'],
            [() => /date/.test(sc), 'A data do nome precisa ser calculada com <code>date</code>, não escrita fixa.'],
            [() => /--exclude/.test(sc), 'Falta a exclusão dos arquivos <code>*.cache</code> no <code>tar</code>.'],
            [() => /sha256sum/.test(sc), 'O script precisa gerar a soma de verificação.'],
            [() => /-mtime\s*\+30/.test(sc) && /(-delete|rm\b)/.test(sc), 'Falta a retenção: apagar os backups com mais de 30 dias (<code>find ... -mtime +30 -delete</code>).'],
            [!!bkp, 'Nenhum <code>~/backups/site-AAAA-MM-DD.tar.gz</code> foi gerado. Rode o script.'],
            [() => /index\.html/.test(conteudo), 'O backup não contém o <code>index.html</code>.'],
            [() => /sobre\.html/.test(conteudo), 'O backup não contém o <code>paginas/sobre.html</code> — o <code>tar</code> precisa descer no diretório inteiro.'],
            [() => !/tmp\.cache/.test(conteudo), 'O arquivo <code>tmp.cache</code> entrou no backup; a exclusão não pegou.'],
            [!!sums, 'Falta o <code>~/backups/SHA256SUMS</code>.'],
            [() => /: OK$/m.test(confere), 'O <code>sha256sum -c</code> não valida o backup. Gere a soma com o comando, dentro do diretório do backup.'],
            [() => H.exists(ctx, '/home/aluno/restauro/site/index.html'), 'Falta o teste de restauração: extraia o backup em <code>~/restauro</code> e confira o resultado.'],
            [() => !H.exists(ctx, '/home/aluno/restauro/site/tmp.cache'), 'O <code>.cache</code> apareceu no restauro — sinal de que ele foi para dentro do backup.']
          ]);
        }
      }
    ]
  });

  /* ============================== 16.6 ============================== */
  LX.lesson('m16', {
    id: 'l16-6', n: '16.6', title: 'Endurecimento e a rotina de quem administra',
    goal: 'Fechar o módulo com o que se faz no primeiro dia em um servidor herdado e o que se repete toda semana — não como lista decorada, mas com o motivo de cada item.',
    body: [
      { h2: 'Superfície de ataque' },
      { p: 'Endurecer (<em>hardening</em>) um servidor é reduzir a <strong>superfície de ataque</strong>: a soma de tudo por onde alguém poderia entrar. Cada porta aberta, cada serviço rodando, cada conta com senha fraca, cada binário SUID é um item dessa soma.' },
      { p: 'O princípio que organiza tudo é um só, e você já o viu no módulo 5: <strong>menor privilégio</strong>. Cada processo, cada conta e cada porta deve ter exatamente o acesso necessário e nada além.' },

      { h2: 'Os cinco itens que dão 90% do resultado' },
      {
        table: {
          head: ['#', 'O quê', 'Por quê'],
          rows: [
            ['1', 'Atualizações de segurança aplicadas', 'a maioria dos ataques usa falha conhecida e já corrigida'],
            ['2', 'SSH sem senha e sem root', 'força bruta é o tráfego de fundo da internet'],
            ['3', 'Firewall negando por padrão', 'serviço esquecido escutando é o clássico'],
            ['4', 'Contas revisadas', 'ex-funcionário com chave é o furo mais silencioso'],
            ['5', 'Log persistente e monitorado', 'sem ele, você não sabe nem que foi invadido']
          ]
        }
      },
      { p: 'Repare que nenhum deles é sofisticado. Segurança de servidor é muito mais rotina do que engenhosidade.' },

      { h2: '1. Atualizações' },
      { code: ['$ apt list --upgradable 2>/dev/null | head', '$ cat /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null | head -12'] },
      { p: 'O <code>unattended-upgrades</code> aplica sozinho as atualizações de <strong>segurança</strong> — não todas, só as do repositório <code>-security</code>. É o padrão certo para servidor: o risco de uma atualização de segurança quebrar algo é bem menor que o de ficar meses vulnerável.' },
      { p: 'O que ele não faz: reiniciar quando o kernel ou a libc mudam. Uma biblioteca atualizada em disco não substitui a que já está carregada na memória dos processos. O <code>needrestart</code> aponta o que precisa reiniciar; o kernel exige reboot.' },

      { h2: '2. SSH' },
      { p: 'Você já viu isto no módulo 10; aqui ele entra como item de rotina. Três diretivas resolvem quase tudo, num arquivo separado para não brigar com atualização de pacote:' },
      { code: ['$ sudo grep -E "^(PermitRootLogin|PasswordAuthentication)" /etc/ssh/sshd_config', '$ ls /etc/ssh/sshd_config.d/ 2>/dev/null'] },
      {
        ul: [
          '<code>PermitRootLogin no</code> — ninguém entra como root; entra como gente e escala com <code>sudo</code>, o que deixa rastro no <code>auth.log</code>.',
          '<code>PasswordAuthentication no</code> — só chave. Elimina de uma vez a força bruta, que é a maior parte do tráfego hostil.',
          '<code>AllowUsers</code> ou <code>AllowGroups</code> — lista explícita de quem pode entrar por SSH.'
        ]
      },
      {
        box: 'warn', label: 'Sempre valide antes de recarregar', body: [
          { p: '<code>sudo sshd -t</code> testa a sintaxe. Errar a configuração do SSH e recarregar sem testar é o jeito clássico de perder acesso a uma máquina remota — e o único conserto é o console do provedor. Mantenha também uma segunda sessão aberta enquanto mexe.' }
        ]
      },

      { h2: '3. Firewall' },
      { code: ['$ sudo ufw status verbose'] },
      { p: 'A configuração de base é sempre a mesma: negar tudo que entra, permitir tudo que sai, abrir só o necessário — e liberar o SSH <strong>antes</strong> de ativar.' },
      { code: ['$ sudo ufw default deny incoming', '$ sudo ufw default allow outgoing', '$ sudo ufw allow 22/tcp', '$ sudo ufw enable', '$ sudo ufw status verbose'] },
      { p: 'E o item que quase ninguém faz: conferir de tempos em tempos <strong>o que está escutando</strong>, com <code>sudo ss -tlnp</code>. Serviço que ninguém usa mas continua de pé é superfície de ataque de graça.' },

      { h2: '4. Contas' },
      { code: ['$ getent passwd | awk -F: \'$3>=1000 && $3<60000 {print $1}\'', '$ getent group sudo', '$ sudo awk -F: \'$2 == "" {print $1 " SEM SENHA"}\' /etc/shadow'] },
      { p: 'Três perguntas, uma vez por mês: quem tem conta que não deveria mais ter; quem está no grupo <code>sudo</code> sem precisar; e existe conta sem senha ou com shell interativo que deveria ser de serviço. Somando: revise também as <code>authorized_keys</code> — desativar a senha não fecha o acesso por chave.' },

      { h2: '5. Log e observação' },
      { p: 'Fecha o círculo do módulo. Sem journal persistente e sem alguém (ou algum script) olhando, os quatro itens anteriores viram controles que ninguém sabe se estão funcionando.' },
      { code: ['$ sudo journalctl -p err --since "24 hours ago" --no-pager | tail -5', '$ sudo journalctl -u ssh --grep "Failed password" --no-pager | tail -5'] },
      { p: 'Aquele segundo comando costuma ser uma surpresa desconfortável em qualquer servidor exposto: tentativas de login com usuários como <code>admin</code>, <code>test</code> e <code>root</code>, vindas de endereços que você nunca viu. É o tráfego de fundo da internet — e é exatamente por isso que <code>PasswordAuthentication no</code> importa tanto.' },

      { h2: 'Assumindo um servidor que você não montou' },
      { p: 'A sequência abaixo é o que se roda no primeiro dia, antes de mudar qualquer coisa. Ela responde "o que é esta máquina?" sem alterar nada:' },
      {
        code: [
          '$ hostnamectl; uptime',
          '$ df -h; free -h',
          '$ systemctl list-units --type=service --state=running --no-pager | head -20',
          '$ sudo ss -tlnp',
          '$ sudo ufw status verbose',
          '$ getent passwd | awk -F: \'$3>=1000 && $3<60000 {print $1}\'',
          '$ crontab -l; sudo crontab -l; ls /etc/cron.d/',
          '$ systemctl list-timers --no-pager',
          '$ sudo journalctl -p err -b --no-pager | tail -20'
        ]
      },
      { p: 'Nove comandos, todos de leitura. Ao fim deles você sabe o que a máquina é, o que ela roda, quem entra, o que está agendado e o que tem reclamado. <strong>Só então</strong> se muda alguma coisa.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Endurecer é reduzir superfície de ataque, guiado por menor privilégio.',
          'Cinco itens dão quase todo o resultado: atualizar, SSH por chave, firewall fechado, contas revisadas, log persistente.',
          '<code>sshd -t</code> antes de recarregar; libere o SSH antes de ativar o firewall.',
          'Desativar senha não fecha acesso por chave — revise <code>authorized_keys</code>.',
          'Ao assumir um servidor, primeiro leia (nove comandos), depois mude.'
        ]
      }
    ],
    tasks: [
      {
        id: 't16-6-a', kind: 'guiado', title: 'O reconhecimento do primeiro dia',
        body: [
          { p: 'Rode a sequência de leitura completa nesta máquina e vá anotando o que chama atenção:' },
          { code: ['$ hostnamectl', '$ uptime', '$ df -h', '$ free -h', '$ sudo ss -tlnp', '$ sudo ufw status verbose', '$ crontab -l', '$ systemctl list-timers --no-pager', '$ sudo journalctl -p err -b --no-pager | tail -10'] },
          { p: 'Três coisas devem ter chamado sua atenção: portas escutando, o estado do firewall e as mensagens de erro do boot. Elas viram as primeiras três perguntas para quem entregou o servidor.' }
        ],
        hints: ['Todos são comandos de leitura — nenhum altera nada.'],
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /\bss\b.*-[a-z]*l/), 'Veja o que está escutando com <code>sudo ss -tlnp</code>.'],
          [() => H.usedCommand(ctx, /ufw\s+status/), 'Confira o firewall com <code>sudo ufw status verbose</code>.'],
          [() => H.usedCommand(ctx, /journalctl.*-p\s*(err|3)/), 'Veja os erros do boot com <code>journalctl -p err -b</code>.'],
          [() => H.usedCommand(ctx, /list-timers/), 'Veja o que está agendado com <code>systemctl list-timers</code>.'],
          [() => H.usedCommand(ctx, /\bdf\b/) && H.usedCommand(ctx, /\bfree\b/), 'Confira disco e memória.']
        ])
      },
      {
        id: 't16-6-q', kind: 'quiz', title: 'O que ainda ficou aberto',
        body: [
          { p: 'Um administrador troca <code>PasswordAuthentication</code> para <code>no</code>, testa com <code>sshd -t</code>, recarrega o serviço, e considera o item "SSH" resolvido. Ele não revisa mais nada relacionado a contas.' },
          { p: 'Que porta de acesso continua aberta, e para quem?' }
        ],
        options: [
          {
            text: 'Qualquer chave já presente em <code>authorized_keys</code> continua autenticando — inclusive de gente que não deveria mais ter acesso. Desativar senha não revoga chave nenhuma.',
            correct: true
          },
          { text: 'Nenhuma: <code>PasswordAuthentication no</code> fecha o SSH por completo.', why: 'Fecha só o método por senha. A autenticação por chave pública continua funcionando normalmente — e é justamente aí que mora o acesso esquecido.' },
          { text: 'A porta 22 continua aberta no firewall.', why: 'Isso é esperado e correto — a porta precisa estar aberta para qualquer SSH funcionar. O problema não é a porta, é quem ainda consegue autenticar por ela.' },
          { text: '<code>PermitRootLogin</code> volta a permitir senha para o root.', why: '<code>PermitRootLogin</code> e <code>PasswordAuthentication</code> são diretivas independentes; mudar uma não desfaz a outra.' }
        ],
        explain: 'É por isso que o item "Contas" da aula existe separado do item "SSH": trocar o método de autenticação não revê <em>quem</em> está autorizado. Uma chave de um ex-funcionário, ou de uma máquina de teste esquecida, continua válida até alguém explicitamente remover a linha de <code>authorized_keys</code> — a checagem mensal do grupo <code>sudo</code> e das chaves autorizadas é o que fecha esse buraco.'
      },
      {
        id: 't16-6-b', kind: 'desafio', title: 'Endurecer a máquina',
        body: [
          { p: 'Aplique os itens 2, 3 e 4 da aula neste servidor. Estado final exigido:' },
          {
            ul: [
              '<strong>SSH</strong>: <code>PermitRootLogin no</code> e <code>PasswordAuthentication no</code> em um arquivo <em>drop-in</em> <code>/etc/ssh/sshd_config.d/99-endurecimento.conf</code>, com <code>sshd -t</code> passando e o serviço recarregado;',
              '<strong>Firewall</strong>: ufw ativo, política de entrada <code>deny</code>, e apenas a porta 22 liberada;',
              '<strong>Contas</strong>: um relatório <code>~/revisao-contas.txt</code> com uma linha por membro do grupo <code>sudo</code>, só o nome.'
            ]
          },
          { p: 'A ordem importa: libere o SSH no firewall antes de ativá-lo, e teste a configuração do SSH antes de recarregar o serviço.' }
        ],
        hints: [
          'O diretório <code>/etc/ssh/sshd_config.d/</code> pode não existir — crie com <code>sudo mkdir -p</code>. O arquivo aceita as mesmas diretivas do <code>sshd_config</code>.',
          'Os membros do grupo sudo saem de <code>getent group sudo | cut -d: -f4 | tr "," "\\n"</code>. Para o firewall: <code>ufw default deny incoming</code>, <code>ufw allow 22/tcp</code>, <code>ufw enable</code> — nessa ordem.'
        ],
        solution: '<div class="code"><pre>sudo mkdir -p /etc/ssh/sshd_config.d\nsudo tee /etc/ssh/sshd_config.d/99-endurecimento.conf &gt; /dev/null &lt;&lt; \'EOF\'\nPermitRootLogin no\nPasswordAuthentication no\nEOF\nsudo sshd -t &amp;&amp; sudo systemctl reload ssh\n\nsudo ufw default deny incoming\nsudo ufw allow 22/tcp\nsudo ufw enable\nsudo ufw status verbose\n\ngetent group sudo | cut -d: -f4 | tr "," "\\n" | grep . &gt; ~/revisao-contas.txt\ncat ~/revisao-contas.txt</pre></div><p style="margin-top:8px">Três controles, nenhum sofisticado — e juntos eles eliminam a maior parte do que realmente acontece com servidores expostos.</p>',
        check: async (ctx) => {
          const drop = H.readText(ctx, '/etc/ssh/sshd_config.d/99-endurecimento.conf');
          const f = ctx.sh.m.firewall || {};
          const regras = (f.rules || []).filter(r => (r.dir || 'in') === 'in');
          const rel = H.readText(ctx, '/home/aluno/revisao-contas.txt');
          const m = ctx.machine || ctx.sh.m;
          const admins = (m.groupByName('sudo') || { members: [] }).members.slice().sort();
          const ditos = rel.split('\n').map(x => x.trim()).filter(Boolean).sort();
          return H.checkAll([
            [!!drop, 'Não encontrei <code>/etc/ssh/sshd_config.d/99-endurecimento.conf</code>.'],
            [() => /^\s*PermitRootLogin\s+no\s*$/m.test(drop), 'Falta <code>PermitRootLogin no</code> no drop-in.'],
            [() => /^\s*PasswordAuthentication\s+no\s*$/m.test(drop), 'Falta <code>PasswordAuthentication no</code> no drop-in.'],
            [() => H.usedCommand(ctx, /sshd\s+-t/), 'Valide a configuração com <code>sudo sshd -t</code> antes de recarregar — errar aqui custa o acesso à máquina.'],
            [() => H.usedCommand(ctx, /systemctl\s+(reload|restart)\s+(ssh|sshd)/), 'Recarregue o serviço para a configuração valer.'],
            [() => f.enabled === true, 'O firewall precisa estar ativo.'],
            [() => /^(deny|reject)$/i.test(String(f.defaultIn)), () => `A política padrão de entrada deve ser negar; está <code>${f.defaultIn}</code>.`],
            [() => regras.some(r => String(r.port) === '22'), 'A porta 22 precisa estar liberada — sem ela você se tranca do lado de fora.'],
            [() => regras.filter(r => /allow|limit/i.test(r.action || 'allow')).every(r => String(r.port) === '22'), () => `Só a porta 22 deveria estar liberada. Estão: ${regras.map(r => r.port).join(', ')}.`],
            [!!rel.trim(), 'Falta o relatório <code>~/revisao-contas.txt</code>.'],
            [() => ditos.length === admins.length && ditos.every((v, i) => v === admins[i]),
              () => `O relatório não bate com os membros reais do grupo <code>sudo</code>: ${admins.join(', ') || '(nenhum)'}.`]
          ]);
        }
      }
    ]
  });
})();
