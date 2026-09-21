/* =========================================================================
   TERMINALIS V2 — primeira coleção de desafios Linux
   Dados fictícios; verificadores aceitam qualquer caminho que produza o
   estado final solicitado.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const root = machine => machine.ctxRoot();
  const write = (machine, path, content, mode = 0o644, uid = 1000, gid = 1000) => {
    machine.fs.mkdirp(LX.FileSystem.dirname(path), { ctx: root(machine) });
    const file = machine.fs.writeFile(path, content, { ctx: root(machine) });
    file.mode = mode; file.uid = uid; file.gid = gid;
    return file;
  };

  LX.challenge({
    id: 'LINUX-006', slug: 'inspecione-o-deploy-atual',
    title: 'Inspecione o deploy atual',
    summary: 'Confirme o diretório certo antes de alterar uma aplicação em produção.',
    technology: 'linux', difficulty: 'beginner', type: 'command', format: 'training', order: 10, xp: 40,
    estimatedMinutes: 5, tags: ['pwd', 'ls', 'navegação', 'deploy'], skills: ['Navegação', 'Inspeção segura'],
    situation: 'Você entrou no servidor fictício srv-web-03 para apoiar um deploy. Antes de qualquer alteração, a equipe pediu uma evidência simples do caminho ativo e dos arquivos que estão publicados.',
    mission: 'Entre em /srv/portal/releases/current e crie ~/inspecao-deploy.txt com o caminho absoluto na primeira linha e uma listagem, incluindo arquivos ocultos, nas linhas seguintes.',
    objectives: ['Navegar até o release ativo', 'Confirmar o caminho absoluto', 'Registrar uma listagem completa como evidência'],
    hints: [
      'Comece entrando no diretório informado e confirme onde o terminal está.',
      'pwd mostra o caminho atual. ls -la inclui arquivos ocultos.',
      'Redirecione pwd com > e acrescente ls -la com >> ao mesmo arquivo.'
    ],
    concepts: [
      { term: 'pwd', summary: 'Mostra o caminho absoluto do diretório atual. É uma verificação simples antes de qualquer mudança.' },
      { term: '>>', summary: 'Acrescenta a saída ao fim de um arquivo sem apagar o conteúdo que já existe.' }
    ],
    setup(machine) {
      write(machine, '/srv/portal/releases/current/VERSION', '2026.09.21\n', 0o644, 0, 33);
      write(machine, '/srv/portal/releases/current/app.js', 'console.log("portal");\n', 0o644, 0, 33);
      write(machine, '/srv/portal/releases/current/.env', 'NODE_ENV=production\n', 0o640, 0, 33);
    },
    validate(ctx) {
      const report = H.read(ctx, '/home/aluno/inspecao-deploy.txt') || '';
      const firstLine = report.trim().split('\n')[0] || '';
      return H.checkAll([
        [firstLine === '/srv/portal/releases/current', 'A primeira linha deve ser o caminho absoluto do release ativo.'],
        [report.includes('VERSION'), 'A listagem ainda não mostra o arquivo <code>VERSION</code>.'],
        [report.includes('app.js'), 'A listagem ainda não mostra <code>app.js</code>.'],
        [report.includes('.env'), 'Inclua arquivos ocultos na evidência; o <code>.env</code> precisa aparecer.']
      ]);
    },
    explanation: 'A inspeção registra contexto antes da mudança. O caminho evita atuar no release errado, e a listagem completa deixa uma evidência reproduzível para a equipe.',
    possibleSolution: 'cd /srv/portal/releases/current\npwd > ~/inspecao-deploy.txt\nls -la >> ~/inspecao-deploy.txt\ncat ~/inspecao-deploy.txt',
    alternatives: ['Executar pwd e ls dentro de um subshell e redirecionar toda a saída de uma vez.'],
    extraChallenge: 'Acrescente ao relatório somente o conteúdo do arquivo VERSION.',
    referenceLessonIds: ['l2-1']
  });

  LX.challenge({
    id: 'LINUX-007', slug: 'prepare-a-estrutura-do-release',
    title: 'Prepare a estrutura do release',
    summary: 'Monte diretórios previsíveis e copie uma configuração modelo sem destruir a origem.',
    technology: 'linux', difficulty: 'beginner', type: 'command', format: 'training', order: 20, xp: 45,
    estimatedMinutes: 6, tags: ['mkdir', 'cp', 'diretórios', 'deploy'], skills: ['Diretórios', 'Cópia de arquivos'],
    prerequisites: ['LINUX-006'],
    situation: 'O próximo release do portal será preparado manualmente antes de a automação assumir. A equipe padronizou uma pasta para aplicação, outra para configuração e outra para logs.',
    mission: 'Crie app, config e logs dentro de /srv/portal/releases/2026-09-22. Copie /srv/portal/template/.env.example para config/app.env sem remover o modelo original.',
    objectives: ['Criar os três diretórios do release', 'Copiar a configuração para o destino correto', 'Preservar o arquivo modelo'],
    hints: [
      'mkdir aceita vários caminhos na mesma execução.',
      'A opção -p cria também os diretórios pais que ainda não existem.',
      'Use cp para criar /srv/portal/releases/2026-09-22/config/app.env a partir do modelo.'
    ],
    concepts: [
      { term: 'mkdir -p', summary: 'Cria toda a árvore necessária e não falha quando parte dela já existe.' },
      { term: 'cp', summary: 'Copia o conteúdo para outro caminho; o arquivo de origem permanece disponível.' }
    ],
    setup(machine) {
      write(machine, '/srv/portal/template/.env.example', 'PORT=8080\nLOG_LEVEL=info\n', 0o644, 0, 33);
      const release = machine.fs.mkdirp('/srv/portal/releases/2026-09-22', { ctx: root(machine) });
      release.uid = 1000; release.gid = 1000; release.mode = 0o755;
    },
    validate(ctx) {
      const base = '/srv/portal/releases/2026-09-22';
      const expected = 'PORT=8080\nLOG_LEVEL=info\n';
      return H.checkAll([
        [H.isDir(ctx, base + '/app'), 'Crie o diretório <code>app</code> dentro do release.'],
        [H.isDir(ctx, base + '/config'), 'Crie o diretório <code>config</code> dentro do release.'],
        [H.isDir(ctx, base + '/logs'), 'Crie o diretório <code>logs</code> dentro do release.'],
        [H.read(ctx, base + '/config/app.env') === expected, 'Copie a configuração modelo para <code>config/app.env</code>.'],
        [H.read(ctx, '/srv/portal/template/.env.example') === expected, 'O arquivo modelo deve continuar no local original.']
      ]);
    },
    explanation: 'Uma estrutura previsível reduz erros no deploy e facilita scripts futuros. A configuração foi copiada porque o modelo precisa continuar disponível para os próximos releases.',
    possibleSolution: 'mkdir -p /srv/portal/releases/2026-09-22/app /srv/portal/releases/2026-09-22/config /srv/portal/releases/2026-09-22/logs\ncp /srv/portal/template/.env.example /srv/portal/releases/2026-09-22/config/app.env\nls -la /srv/portal/releases/2026-09-22/config',
    alternatives: ['Entrar no diretório do release e criar app, config e logs usando caminhos relativos.'],
    extraChallenge: 'Crie um arquivo RELEASE com a data e o nome do responsável fictício pelo deploy.',
    referenceLessonIds: ['l2-2', 'l2-4']
  });

  LX.challenge({
    id: 'LINUX-001', slug: 'organize-os-backups-sql',
    title: 'Organize os backups SQL',
    summary: 'Separe dumps de banco sem mover a documentação da migração.',
    technology: 'linux', difficulty: 'beginner', type: 'command', format: 'training', order: 30, xp: 50,
    estimatedMinutes: 6, tags: ['arquivos', 'diretórios', 'glob'], skills: ['Navegação', 'Arquivos'],
    prerequisites: ['LINUX-007'],
    situation: 'A equipe deixou dumps SQL e documentos misturados em /srv/migracao. O próximo processo automatizado espera encontrar todos os dumps dentro de uma subpasta chamada backup.',
    mission: 'Crie /srv/migracao/backup e mova para ela somente os arquivos com extensão .sql. Os demais arquivos devem permanecer no diretório original.',
    objectives: ['Criar o diretório backup', 'Mover os três arquivos .sql', 'Preservar README.md e inventario.csv'],
    hints: [
      'Liste /srv/migracao e observe o padrão comum nos arquivos que precisam ser movidos.',
      'O caractere * pode representar qualquer trecho de um nome. Um padrão como *.sql seleciona arquivos pela extensão.',
      'Uma solução curta combina mkdir -p /srv/migracao/backup e mv /srv/migracao/*.sql /srv/migracao/backup/.'
    ],
    concepts: [
      { term: 'glob', summary: 'O shell expande padrões como *.sql antes de executar o comando.', detail: 'O comando recebe a lista de caminhos que o shell encontrou. Arquivos sem a extensão não entram na expansão.' },
      { term: 'mkdir -p', summary: 'Cria o caminho e não falha se o diretório já existir.' }
    ],
    setup(machine) {
      const directory = machine.fs.mkdirp('/srv/migracao', { ctx: root(machine) });
      directory.uid = 1000; directory.gid = 1000; directory.mode = 0o755;
      write(machine, '/srv/migracao/clientes.sql', '-- dump clientes\n');
      write(machine, '/srv/migracao/pedidos.sql', '-- dump pedidos\n');
      write(machine, '/srv/migracao/estoque.sql', '-- dump estoque\n');
      write(machine, '/srv/migracao/README.md', '# Migração\nNão mover este arquivo.\n');
      write(machine, '/srv/migracao/inventario.csv', 'arquivo,responsavel\nclientes.sql,equipe-db\n');
    },
    validate(ctx) {
      const expected = ['clientes.sql', 'estoque.sql', 'pedidos.sql'];
      const found = H.ls(ctx, '/srv/migracao/backup') || [];
      return H.checkAll([
        [H.isDir(ctx, '/srv/migracao/backup'), 'Crie o diretório <code>/srv/migracao/backup</code>.'],
        [expected.every(name => found.includes(name)), 'Ainda faltam dumps <code>.sql</code> dentro de <code>backup</code>.'],
        [expected.every(name => !H.exists(ctx, '/srv/migracao/' + name)), 'Os dumps devem ser movidos, não apenas copiados.'],
        [H.isFile(ctx, '/srv/migracao/README.md'), 'O <code>README.md</code> deve permanecer no diretório original.'],
        [H.isFile(ctx, '/srv/migracao/inventario.csv'), 'O <code>inventario.csv</code> deve permanecer no diretório original.']
      ]);
    },
    explanation: 'O padrão *.sql foi expandido pelo shell apenas para os três dumps. O diretório de destino organiza o processo sem afetar os documentos que não pertencem ao backup.',
    possibleSolution: 'mkdir -p /srv/migracao/backup\nmv /srv/migracao/*.sql /srv/migracao/backup/\nls -la /srv/migracao /srv/migracao/backup',
    alternatives: ['Usar find com -maxdepth 1 e -exec mv para selecionar os dumps.', 'Mover os arquivos individualmente; é mais longo, mas produz o mesmo estado.'],
    extraChallenge: 'Crie um arquivo lista.txt dentro de backup contendo os nomes dos dumps em ordem alfabética.',
    referenceLessonIds: ['l2-3', 'l2-4']
  });

  LX.challenge({
    id: 'LINUX-008', slug: 'separe-os-erros-do-chamado',
    title: 'Separe os erros do chamado',
    summary: 'Extraia de um log somente os eventos relevantes para uma requisição.',
    technology: 'linux', difficulty: 'easy', type: 'debugging', format: 'ticket', order: 40, xp: 65,
    estimatedMinutes: 8, tags: ['grep', 'pipes', 'logs', 'suporte'], skills: ['Filtros', 'Análise de logs'],
    prerequisites: ['LINUX-001'],
    situation: 'Chamado #2187. O checkout falhou para a requisição fictícia req-7f3a. O arquivo /var/log/checkout/app.log contém eventos de vários usuários e níveis de severidade.',
    mission: 'Crie ~/chamado-2187.log contendo somente as linhas ERROR relacionadas a req-7f3a. Não inclua avisos, informações nem eventos de outras requisições.',
    objectives: ['Filtrar pelo identificador da requisição', 'Manter somente erros', 'Salvar uma evidência limpa para o chamado'],
    hints: [
      'Procure primeiro pelo identificador req-7f3a e leia o resultado.',
      'Você pode ligar dois filtros com um pipe: um para a requisição e outro para a severidade.',
      'Redirecione o resultado de grep "req-7f3a" ... | grep "ERROR" para ~/chamado-2187.log.'
    ],
    concepts: [
      { term: 'pipe', summary: 'Envia a saída de um comando para a entrada do próximo, permitindo montar uma investigação em etapas.' },
      { term: 'correlation ID', summary: 'Um identificador de requisição conecta eventos do mesmo fluxo entre diferentes linhas ou serviços.' }
    ],
    setup(machine) {
      write(machine, '/var/log/checkout/app.log', [
        '2026-09-21T10:00:01Z INFO req-a91c checkout iniciado',
        '2026-09-21T10:00:03Z INFO req-7f3a checkout iniciado',
        '2026-09-21T10:00:04Z WARN req-7f3a tentativa de pagamento repetida',
        '2026-09-21T10:00:05Z ERROR req-7f3a timeout no gateway ficticio',
        '2026-09-21T10:00:06Z ERROR req-b820 estoque indisponivel',
        '2026-09-21T10:00:08Z ERROR req-7f3a checkout cancelado',
        '2026-09-21T10:00:10Z INFO req-7f3a resposta 503'
      ].join('\n') + '\n', 0o644, 0, 33);
    },
    validate(ctx) {
      const evidence = H.read(ctx, '/home/aluno/chamado-2187.log') || '';
      const lines = evidence.trim().split('\n').filter(Boolean);
      return H.checkAll([
        [lines.length === 2, 'A evidência deve conter exatamente os dois erros da requisição.'],
        [lines.every(line => line.includes('ERROR')), 'Remova linhas que não sejam de nível <code>ERROR</code>.'],
        [lines.every(line => line.includes('req-7f3a')), 'Remova eventos de outras requisições.'],
        [evidence.includes('timeout no gateway ficticio') && evidence.includes('checkout cancelado'), 'Ainda falta um dos erros relacionados ao chamado.']
      ]);
    },
    explanation: 'Filtrar pelo identificador e pela severidade reduz ruído sem perder o encadeamento do incidente. O arquivo final pode ser anexado ao chamado sem expor eventos de outros fluxos.',
    possibleSolution: 'grep "req-7f3a" /var/log/checkout/app.log | grep "ERROR" > ~/chamado-2187.log\ncat ~/chamado-2187.log',
    alternatives: ['Usar um único grep com uma expressão que exija ERROR e req-7f3a na mesma linha.', 'Usar awk para selecionar os dois campos.'],
    extraChallenge: 'Gere outro arquivo com todos os eventos da requisição em ordem cronológica.',
    referenceLessonIds: ['l3-2', 'l4-1']
  });

  LX.challenge({
    id: 'LINUX-009', slug: 'identifique-o-consumo-de-disco',
    title: 'Identifique o consumo de disco',
    summary: 'Descubra qual área de uma aplicação está pressionando o armazenamento.',
    technology: 'linux', difficulty: 'easy', type: 'incident', format: 'ticket', order: 50, xp: 75,
    estimatedMinutes: 9, tags: ['du', 'sort', 'armazenamento', 'diagnóstico'], skills: ['Armazenamento', 'Troubleshooting'],
    prerequisites: ['LINUX-008'],
    situation: 'Chamado #2214. O alerta do servidor fictício srv-api-04 informa 91% de uso em disco. A equipe suspeita de /var/lib/terminalis, mas não autorizou apagar nada durante o diagnóstico.',
    mission: 'Compare o uso dos diretórios imediatamente abaixo de /var/lib/terminalis e grave a maior entrada em ~/maior-consumo.txt. Não remova nem altere os arquivos investigados.',
    objectives: ['Medir o uso por diretório', 'Ordenar do maior para o menor', 'Registrar a maior entrada sem apagar dados'],
    hints: [
      'du resume quanto espaço cada caminho ocupa.',
      'Use um padrão para medir cada item dentro de /var/lib/terminalis e depois ordene os resultados.',
      'Uma sequência possível é du -sh /var/lib/terminalis/* | sort -hr | head -1.'
    ],
    concepts: [
      { term: 'du -sh', summary: 'Resume o espaço usado por cada caminho em uma unidade legível.' },
      { term: 'diagnóstico não destrutivo', summary: 'Primeiro produza evidências. Remover dados exige autorização e uma decisão separada.' }
    ],
    setup(machine) {
      write(machine, '/var/lib/terminalis/cache/blocos.tmp', 'x'.repeat(180000), 0o640, 0, 33);
      write(machine, '/var/lib/terminalis/uploads/lote.bin', 'x'.repeat(42000), 0o640, 0, 33);
      write(machine, '/var/lib/terminalis/packages/index.db', 'x'.repeat(12000), 0o640, 0, 33);
    },
    validate(ctx) {
      const report = H.read(ctx, '/home/aluno/maior-consumo.txt') || '';
      return H.checkAll([
        [report.trim().length > 0, 'Crie <code>~/maior-consumo.txt</code> com a maior entrada encontrada.'],
        [report.includes('/var/lib/terminalis/cache'), 'A maior entrada registrada ainda não é o diretório <code>cache</code>.'],
        [H.isFile(ctx, '/var/lib/terminalis/cache/blocos.tmp'), 'O diagnóstico não autorizava remover ou mover o arquivo de cache.'],
        [H.isFile(ctx, '/var/lib/terminalis/uploads/lote.bin'), 'Preserve os dados investigados durante o diagnóstico.']
      ]);
    },
    explanation: 'O diagnóstico separa medição de correção. O cache é a maior área, mas a evidência foi produzida sem apagar dados; a equipe pode decidir depois se deve limpar, mover ou ampliar o volume.',
    possibleSolution: 'du -sh /var/lib/terminalis/* | sort -hr | head -1 > ~/maior-consumo.txt\ncat ~/maior-consumo.txt',
    alternatives: ['Usar du -h --max-depth=1 e selecionar a maior subpasta, ignorando a linha do total.'],
    extraChallenge: 'Crie um segundo relatório ordenado com todas as entradas, da maior para a menor.',
    referenceLessonIds: ['l13-3', 'l3-3']
  });

  LX.challenge({
    id: 'LINUX-002', slug: 'encontre-a-configuracao-perdida',
    title: 'Encontre a configuração perdida',
    summary: 'Localize um endpoint esquecido entre arquivos de configuração.',
    technology: 'linux', difficulty: 'easy', type: 'command', format: 'ticket', order: 60, xp: 70,
    estimatedMinutes: 8, tags: ['find', 'grep', 'configuração'], skills: ['Busca', 'Redirecionamento'],
    prerequisites: ['LINUX-009'],
    situation: 'Um serviço legado ainda aponta para uma API interna. A equipe sabe o nome da variável, API_ENDPOINT, mas não lembra em qual arquivo ela foi definida.',
    mission: 'Investigue /etc/terminalis e /opt/legacy. Grave em ~/endpoint-encontrado.txt a linha encontrada junto com o caminho do arquivo de origem.',
    objectives: ['Pesquisar em mais de um diretório', 'Encontrar API_ENDPOINT', 'Registrar caminho e valor como evidência'],
    hints: [
      'Você não precisa abrir cada arquivo. Procure pelo texto API_ENDPOINT de forma recursiva.',
      'grep possui uma opção recursiva. Ao pesquisar vários arquivos, a saída inclui o caminho de origem.',
      'Use grep -R "API_ENDPOINT" /etc/terminalis /opt/legacy e redirecione a saída para ~/endpoint-encontrado.txt.'
    ],
    concepts: [
      { term: 'grep -R', summary: 'Pesquisa texto recursivamente dentro de uma árvore de diretórios.' },
      { term: 'evidência', summary: 'Um diagnóstico profissional registra o valor e também a sua origem.' }
    ],
    setup(machine) {
      write(machine, '/etc/terminalis/sites/producao.conf', 'PORT=8080\nLOG_LEVEL=warn\n', 0o644, 0, 0);
      write(machine, '/etc/terminalis/sites/homologacao.conf', 'PORT=8081\nLOG_LEVEL=debug\n', 0o644, 0, 0);
      write(machine, '/opt/legacy/portal.env', 'APP_NAME=portal\nAPI_ENDPOINT=https://api.interna.test/v1\nTIMEOUT=5000\n', 0o644, 0, 0);
      write(machine, '/opt/legacy/README.txt', 'Configuração antiga do portal.\n', 0o644, 0, 0);
    },
    validate(ctx) {
      const evidence = H.read(ctx, '/home/aluno/endpoint-encontrado.txt') || '';
      return H.checkAll([
        [evidence.trim().length > 0, 'Crie <code>~/endpoint-encontrado.txt</code> com a evidência encontrada.'],
        [/portal\.env/.test(evidence), 'A evidência precisa incluir o caminho ou nome do arquivo de origem.'],
        [/API_ENDPOINT=https:\/\/api\.interna\.test\/v1/.test(evidence), 'O valor de <code>API_ENDPOINT</code> ainda não aparece corretamente no arquivo.']
      ]);
    },
    explanation: 'Uma busca recursiva reduz o espaço de investigação e mantém o caminho junto da linha encontrada. Isso torna a evidência reproduzível para outra pessoa da equipe.',
    possibleSolution: 'grep -R "API_ENDPOINT" /etc/terminalis /opt/legacy > ~/endpoint-encontrado.txt\ncat ~/endpoint-encontrado.txt',
    alternatives: ['Combinar find -type f com grep.', 'Usar grep -Rl para achar o arquivo e depois grep -H para registrar a linha.'],
    extraChallenge: 'Gere uma segunda evidência contendo apenas o valor da URL, sem o nome da variável.',
    referenceLessonIds: ['l4-1', 'l4-2']
  });

  LX.challenge({
    id: 'LINUX-003', slug: 'servico-caiu-apos-reboot',
    title: 'Serviço caiu após o reboot',
    summary: 'Recupere o acesso remoto e garanta que ele volte no próximo boot.',
    technology: 'linux', difficulty: 'intermediate', type: 'incident', format: 'incident', order: 80, xp: 120,
    estimatedMinutes: 12, tags: ['systemd', 'serviços', 'ssh', 'reboot'], skills: ['Serviços', 'Troubleshooting'],
    prerequisites: ['LINUX-002'],
    situation: 'Chamado #1042. Após uma reinicialização de manutenção, o monitoramento marcou o acesso SSH como indisponível. A máquina continua ligada e você possui acesso pelo console.',
    mission: 'Descubra o estado do serviço responsável pelo SSH, restaure o acesso e garanta que ele seja iniciado automaticamente nos próximos boots.',
    objectives: ['Investigar o estado do serviço', 'Iniciar o SSH', 'Habilitar inicialização no boot'],
    hints: [
      'Comece identificando o estado atual do serviço, sem alterar nada.',
      'O serviço se chama ssh. systemctl consegue mostrar separadamente se ele está ativo e se está habilitado.',
      'systemctl enable --now ssh habilita o serviço no boot e também o inicia agora.'
    ],
    concepts: [
      { term: 'active', summary: 'Indica se o serviço está executando neste momento.' },
      { term: 'enabled', summary: 'Indica se o serviço foi configurado para iniciar no boot.', detail: 'Um serviço pode estar active e disabled ao mesmo tempo; nesse caso funciona agora, mas não volta após reiniciar.' }
    ],
    setup(machine) {
      try { machine.stopUnit('ssh.service'); } catch (e) { }
      const unit = machine.unit('ssh.service');
      if (unit) { unit.state = 'inactive'; unit.sub = 'dead'; unit.enabled = false; }
      machine.log('systemd', 'ssh.service: unit was not enabled for the new boot target.', 4, 1, 'ssh.service');
    },
    validate(ctx) {
      const machine = ctx.machine || ctx.sh.m;
      const unit = machine.unit('ssh.service');
      return H.checkAll([
        [!!unit, 'O serviço <code>ssh.service</code> não foi encontrado.'],
        [() => unit && unit.state === 'active', 'O SSH ainda não está ativo. Verifique o estado e inicie o serviço.'],
        [() => unit && unit.enabled === true, 'O serviço funciona agora, mas ainda não está habilitado para o próximo boot.']
      ]);
    },
    explanation: 'O incidente combinava dois estados diferentes do systemd: execução atual e inicialização futura. Iniciar resolveu a indisponibilidade; habilitar removeu a causa da recorrência após reboot.',
    possibleSolution: 'systemctl status ssh --no-pager\nsystemctl is-enabled ssh\nsudo systemctl enable --now ssh\nsystemctl is-active ssh\nsystemctl is-enabled ssh',
    alternatives: ['Executar systemctl start ssh e systemctl enable ssh separadamente.'],
    extraChallenge: 'Consulte o journal da unidade e registre em um arquivo a evidência de que o serviço voltou.',
    referenceLessonIds: ['l8-1', 'l8-2', 'l17-2']
  });

  LX.challenge({
    id: 'LINUX-004', slug: 'aplicacao-sem-permissao-no-relatorio',
    title: 'Aplicação sem permissão no relatório',
    summary: 'Corrija dono, grupo e modo sem tornar um arquivo sensível público.',
    technology: 'linux', difficulty: 'intermediate', type: 'configuration', format: 'ticket', order: 70, xp: 110,
    estimatedMinutes: 12, tags: ['chmod', 'chown', 'permissões'], skills: ['Permissões', 'Menor privilégio'],
    prerequisites: ['LINUX-002'],
    situation: 'O serviço web, executado como www-data, precisa ler /srv/financeiro/fechamento.csv. Depois de uma restauração, o arquivo voltou como root:root com modo 600 e a aplicação recebe Permission denied.',
    mission: 'Permita que www-data leia o relatório. O arquivo deve continuar pertencendo a root, não pode ser gravável pelo serviço e não pode ficar acessível para outros usuários.',
    objectives: ['Preservar root como proprietário', 'Dar leitura ao grupo www-data', 'Remover qualquer acesso de outros'],
    hints: [
      'Inspecione proprietário, grupo e permissões do arquivo antes de mudar algo.',
      'Você pode trocar somente o grupo do arquivo e então conceder leitura a esse grupo.',
      'Um estado final apropriado é root:www-data com modo 640.'
    ],
    concepts: [
      { term: 'menor privilégio', summary: 'Conceda apenas a permissão necessária, à identidade que realmente precisa dela.' },
      { term: '640', summary: 'Dono lê e escreve, grupo apenas lê, outros não possuem acesso.' }
    ],
    setup(machine) {
      write(machine, '/srv/financeiro/fechamento.csv', 'conta,valor\nreceita,12840\ndespesa,7390\n', 0o600, 0, 0);
    },
    validate(ctx) {
      const stat = H.lstat(ctx, '/srv/financeiro/fechamento.csv');
      const owner = H.owner(ctx, '/srv/financeiro/fechamento.csv');
      const content = H.read(ctx, '/srv/financeiro/fechamento.csv') || '';
      return H.checkAll([
        [!!stat, 'O relatório não deve ser removido.'],
        [() => owner && owner.user === 'root', 'O proprietário deve continuar sendo <code>root</code>.'],
        [() => owner && owner.group === 'www-data', 'O grupo do arquivo deve ser <code>www-data</code>.'],
        [() => !!stat && (stat.mode & 0o040) !== 0, 'O grupo precisa de permissão de leitura.'],
        [() => !!stat && (stat.mode & 0o020) === 0, 'O serviço não deve receber permissão de escrita.'],
        [() => !!stat && (stat.mode & 0o007) === 0, 'Outros usuários não devem possuir acesso ao relatório.'],
        [content.includes('receita,12840'), 'O conteúdo original do relatório deve ser preservado.']
      ]);
    },
    explanation: 'A correção usa o grupo do processo como fronteira de acesso. O modo 640 entrega leitura ao serviço, mantém a escrita com root e não abre o dado para todos.',
    possibleSolution: 'ls -l /srv/financeiro/fechamento.csv\nsudo chown root:www-data /srv/financeiro/fechamento.csv\nsudo chmod 640 /srv/financeiro/fechamento.csv\nstat -c "%a %U:%G %n" /srv/financeiro/fechamento.csv',
    alternatives: ['Usar chgrp www-data e chmod u=rw,g=r,o= no lugar de chown e modo octal.'],
    extraChallenge: 'Explique por que chmod 644 faria a aplicação funcionar, mas violaria o requisito de menor privilégio.',
    referenceLessonIds: ['l5-1', 'l5-2', 'l5-3']
  });

  LX.challenge({
    id: 'LINUX-005', slug: 'entrega-de-backup-verificavel',
    title: 'Entrega de backup verificável',
    summary: 'Empacote uma aplicação e gere evidência de integridade antes da transferência.',
    technology: 'linux', difficulty: 'advanced', type: 'project', format: 'project', order: 90, xp: 220,
    estimatedMinutes: 20, tags: ['tar', 'gzip', 'sha256', 'backup'], skills: ['Compactação', 'Backup', 'Integridade'],
    prerequisites: ['LINUX-003', 'LINUX-004'],
    situation: 'Uma manutenção será feita no servidor fictício srv-app-07. Antes da janela, a equipe precisa de um backup transportável de /srv/aplicacao e de uma soma que permita detectar corrupção.',
    mission: 'Crie /var/backups/aplicacao.tar.gz, gere /var/backups/aplicacao.sha256 e confirme a soma. Registre os dois artefatos em ~/entrega-backup.txt.',
    objectives: ['Criar um arquivo tar comprimido', 'Gerar e validar SHA-256', 'Registrar os caminhos entregues'],
    hints: [
      'Primeiro inspecione /srv/aplicacao e confira se há espaço no destino.',
      'tar combina -c para criar, -z para gzip e -f para escolher o arquivo de saída.',
      'Depois de criar o arquivo, use sha256sum nele e redirecione a saída. Entre em /var/backups antes de gerar a soma para registrar um nome relativo verificável.'
    ],
    concepts: [
      { term: 'arquivo tar', summary: 'Agrupa uma árvore de arquivos preservando caminhos e metadados.' },
      { term: 'checksum', summary: 'Uma soma permite verificar se o artefato recebido tem o mesmo conteúdo do original.' }
    ],
    setup(machine) {
      write(machine, '/srv/aplicacao/app.conf', 'PORT=9000\nENV=production\n', 0o640, 0, 33);
      write(machine, '/srv/aplicacao/public/index.html', '<h1>Portal interno</h1>\n', 0o644, 33, 33);
      write(machine, '/srv/aplicacao/scripts/start.sh', '#!/bin/sh\necho iniciando\n', 0o755, 0, 0);
    },
    async validate(ctx) {
      const archive = H.read(ctx, '/var/backups/aplicacao.tar.gz') || '';
      const checksum = H.read(ctx, '/var/backups/aplicacao.sha256') || '';
      const report = H.read(ctx, '/home/aluno/entrega-backup.txt') || '';
      let integrity = false;
      if (ctx.run && checksum) {
        const result = await ctx.run('cd /var/backups && sha256sum -c aplicacao.sha256');
        integrity = !!result && result.status === 0;
      }
      return H.checkAll([
        [archive.startsWith('GZIPDATA\n'), 'Crie um arquivo gzip válido em <code>/var/backups/aplicacao.tar.gz</code>.'],
        [/^[0-9a-f]{64}\s+[* ]?aplicacao\.tar\.gz\s*$/m.test(checksum), 'Gere <code>aplicacao.sha256</code> apontando para o nome relativo do arquivo.'],
        [integrity, 'A soma não confere. Gere novamente e teste com <code>sha256sum -c</code>.'],
        [report.includes('/var/backups/aplicacao.tar.gz'), 'Registre o caminho do arquivo compactado em <code>~/entrega-backup.txt</code>.'],
        [report.includes('/var/backups/aplicacao.sha256'), 'Registre o caminho da soma em <code>~/entrega-backup.txt</code>.']
      ]);
    },
    explanation: 'O tar preserva a árvore; o gzip reduz o transporte; o SHA-256 prova integridade. O arquivo de soma usa nome relativo para continuar verificável dentro do diretório de entrega.',
    possibleSolution: 'sudo tar -czf /var/backups/aplicacao.tar.gz -C /srv aplicacao\ncd /var/backups\nsha256sum aplicacao.tar.gz | sudo tee aplicacao.sha256\nsha256sum -c aplicacao.sha256\nprintf "/var/backups/aplicacao.tar.gz\\n/var/backups/aplicacao.sha256\\n" > ~/entrega-backup.txt',
    alternatives: ['Criar o tar sem compressão e aplicar gzip em uma segunda etapa produz um artefato equivalente.'],
    extraChallenge: 'Restaure o backup em /tmp/restore-test e compare a árvore restaurada antes da manutenção.',
    referenceLessonIds: ['l13-1', 'l13-2', 'l16-6']
  });
})();
