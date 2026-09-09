/* =========================================================================
   MÓDULO D01 — O que é Docker
   Antes de qualquer comando: que problema isso resolve, o que é uma
   imagem, o que é um container, e o que o kernel realmente faz.
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H, D = LX.D;

  /* ============================== 1.1 ============================== */
  LX.lesson('d01', {
    id: 'ld1-1', n: '1.1', title: 'O problema que o Docker resolve',
    goal: 'Entender por que containers existem — a partir de problemas que você já viu no curso de Linux, e não de uma definição decorada.',
    body: [
      { h2: 'Comece pelo problema, não pela ferramenta' },
      { p: 'Você já instalou o nginx neste curso. Rodou <code>sudo apt install nginx</code>, editou <code>/etc/nginx/nginx.conf</code>, subiu o serviço com <code>systemctl</code>. Funcionou.' },
      { p: 'Agora imagine que a empresa tem três aplicações no mesmo servidor: uma precisa do Node 18, outra do Node 22, e a terceira é em Python 3.9 enquanto o sistema traz o 3.13. As três precisam de bibliotecas do sistema em versões diferentes. E o servidor de homologação tem uma distribuição diferente da de produção.' },
      {
        box: 'key', label: 'A frase que originou tudo isso', body: [
          { p: '<em>"Na minha máquina funciona."</em>' },
          { p: 'Não é piada de programador: é a descrição exata de um problema de engenharia. O programa não depende só do próprio código. Ele depende do interpretador, das bibliotecas, das variáveis de ambiente, dos arquivos de configuração, da versão da distribuição, das permissões. Isso tudo junto é o <strong>ambiente</strong> — e o ambiente nunca era entregue junto com o código.' }
        ]
      },

      { h2: 'As três soluções anteriores, e por que não bastaram' },
      {
        table: {
          head: ['Abordagem', 'Como funciona', 'O que dá errado'],
          rows: [
            ['Documento de instalação', 'Um README com os passos', 'Fica desatualizado no primeiro dia; cada pessoa executa diferente; não é verificável'],
            ['Script de provisionamento', 'Um <code>.sh</code> ou Ansible que instala tudo', 'Melhor, mas roda <em>sobre</em> um sistema que já tem estado. Duas execuções em máquinas diferentes não dão o mesmo resultado'],
            ['Máquina virtual', 'Um sistema operacional inteiro por aplicação', 'Resolve o isolamento, mas custa caro: cada VM carrega um kernel, gigabytes de disco e dezenas de segundos de boot']
          ]
        }
      },
      { p: 'O container pega o isolamento da máquina virtual e joga fora o que ela tem de caro: o kernel próprio e o boot. O resultado é um pacote que carrega o ambiente inteiro da aplicação, sobe em frações de segundo e roda igual em qualquer máquina Linux.' },

      { h2: 'O que é um container, na prática' },
      { p: 'Um container <strong>é um processo comum do Linux</strong>. Não é uma máquina, não é um sistema operacional, não tem boot. É o mesmo tipo de processo que você viu no módulo de processos do curso de Linux — só que o kernel mente para ele sobre três coisas:' },
      {
        ul: [
          '<strong>o que ele enxerga</strong> — ele acha que o sistema de arquivos dele é o único que existe, e que ele é o PID 1',
          '<strong>quanto ele pode usar</strong> — CPU e memória têm teto',
          '<strong>com quem ele fala</strong> — tem a própria interface de rede e o próprio conjunto de portas'
        ]
      },
      { p: 'Essas três mentiras têm nomes: <strong>namespaces</strong> (o que enxerga), <strong>cgroups</strong> (quanto usa) e o <strong>sistema de arquivos em camadas</strong> (de onde vêm os arquivos). Você vai ver cada uma na aula 1.3.' },

      { h2: 'Container × máquina virtual' },
      {
        ascii: `MÁQUINA VIRTUAL                      CONTAINER

┌─────────┬─────────┬─────────┐      ┌─────────┬─────────┬─────────┐
│  app A  │  app B  │  app C  │      │  app A  │  app B  │  app C  │
├─────────┼─────────┼─────────┤      ├─────────┼─────────┼─────────┤
│  libs   │  libs   │  libs   │      │  libs   │  libs   │  libs   │
├─────────┼─────────┼─────────┤      └─────────┴─────────┴─────────┘
│ SO      │ SO      │ SO      │      ┌─────────────────────────────┐
│ convi-  │ convi-  │ convi-  │      │      Docker Engine          │
│ dado    │ dado    │ dado    │      ├─────────────────────────────┤
├─────────┴─────────┴─────────┤      │   Kernel do sistema host    │
│        Hipervisor           │      ├─────────────────────────────┤
├─────────────────────────────┤      │         Hardware            │
│   SO host + Hardware        │      └─────────────────────────────┘
└─────────────────────────────┘
   3 kernels rodando                     1 kernel, compartilhado`
      },
      {
        table: {
          head: ['', 'Máquina virtual', 'Container'],
          rows: [
            ['Kernel', 'um por VM', 'compartilha o do host'],
            ['Tamanho típico', 'gigabytes', 'de dezenas a centenas de megabytes'],
            ['Tempo para subir', 'dezenas de segundos', 'frações de segundo'],
            ['Isolamento', 'muito forte (virtualização de hardware)', 'forte, mas é o mesmo kernel para todos'],
            ['Roda outro sistema?', 'sim — Windows sobre Linux, por exemplo', 'não: um container Linux precisa de um kernel Linux'],
            ['Densidade', 'poucas por servidor', 'dezenas ou centenas']
          ]
        }
      },
      {
        box: 'warn', label: 'A consequência prática do kernel compartilhado', body: [
          { p: 'Como todos os containers usam o <strong>mesmo kernel</strong>, uma falha grave de segurança no kernel afeta todo mundo ao mesmo tempo. É por isso que o módulo de segurança deste curso insiste em rodar containers sem privilégios, sem <code>root</code> e sem capabilities desnecessárias: o isolamento é bom, mas não é o de uma máquina virtual.' },
          { p: 'É também por isso que não existe container Windows rodando sobre Linux nem o contrário — sem tradução. O container usa o kernel que está debaixo dele.' }
        ]
      },

      { h2: 'Imagem e container: a distinção que organiza tudo' },
      { p: 'Estes dois nomes se confundem o tempo todo, e quase todo erro de iniciante vem daí.' },
      {
        table: {
          head: ['Imagem', 'Container'],
          rows: [
            ['Um pacote parado, no disco', 'Um processo em execução'],
            ['Somente leitura, imutável', 'Tem uma camada gravável em cima'],
            ['Uma imagem gera <em>muitos</em> containers', 'Cada container vem de uma imagem'],
            ['Análogo: o arquivo <code>.iso</code>, ou a classe', 'Análogo: a máquina instalada, ou o objeto'],
            ['<code>docker images</code>', '<code>docker ps</code>'],
            ['Some com <code>docker rmi</code>', 'Some com <code>docker rm</code>']
          ]
        }
      },
      { p: 'Você vai provar essa diferença com as próprias mãos na aula 1.4: dois containers da mesma imagem, alterações diferentes dentro de cada um, e a imagem intacta no fim.' },

      { h2: 'Resumo' },
      {
        ul: [
          'Containers existem porque o ambiente da aplicação nunca era entregue junto com o código.',
          'Um container é um processo comum do Linux com uma visão restrita do sistema.',
          'Ele compartilha o kernel do host — daí a leveza, e daí também o limite do isolamento.',
          'Imagem é o pacote parado; container é a execução dele.'
        ]
      },
      { h2: 'Próximo passo' },
      { p: 'Antes de rodar o primeiro container, vale entender <em>quem</em> executa o comando que você digita. É a próxima aula.' }
    ],
    tasks: [
      {
        id: 'td1-1-a', kind: 'guiado', title: 'O Docker já está aqui',
        body: [
          { p: 'Este servidor já tem o Docker instalado. Confirme, e repare no que a saída conta:' },
          { code: ['$ docker --version', '$ docker version', '$ docker info | head -20'] },
          { p: 'O <code>docker version</code> mostra <strong>duas</strong> versões: a do <em>Client</em> e a do <em>Server</em>. Guarde essa observação — a próxima aula é sobre exatamente isso.' }
        ],
        hints: [
          'São três comandos, um de cada vez.',
          '<code>docker info</code> é longo; o <code>| head -20</code> mostra só o começo.'
        ],
        solution: '<pre>$ docker --version\n$ docker version\n$ docker info | head -20</pre>',
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /docker\s+(--version|version)/), 'Rode <code>docker version</code> para ver as versões do cliente e do servidor.'],
          [() => H.usedCommand(ctx, /docker\s+info/), 'Rode <code>docker info</code> para ver o estado do daemon.']
        ])
      },
      {
        id: 'td1-1-q', kind: 'quiz', title: 'Onde o container é diferente da VM',
        body: [{ p: 'Sua equipe precisa rodar uma aplicação Windows legada em um servidor Linux. Alguém sugere "coloca num container, é mais leve". Qual é a resposta correta?' }],
        options: [
          { text: 'Não funciona: o container usa o kernel do host, e um binário Windows precisa de um kernel Windows. Esse caso pede uma máquina virtual.', correct: true },
          { text: 'Funciona, containers rodam qualquer sistema operacional.', why: 'Containers não trazem kernel. Um container Linux precisa de kernel Linux; um container Windows precisa de kernel Windows.' },
          { text: 'Funciona se a imagem for construída com <code>--platform windows</code>.', why: '<code>--platform</code> escolhe arquitetura e sistema de uma imagem <em>que exista</em> para aquela plataforma, mas o host continua tendo que fornecer o kernel compatível.' },
          { text: 'Funciona, mas fica mais lento que uma VM.', why: 'Não é questão de desempenho: simplesmente não há kernel Windows para o processo usar.' }
        ],
        explain: 'Essa é a diferença que mais importa na prática. Container = isolamento de processo sobre um kernel compartilhado. VM = hardware virtualizado com kernel próprio. Sempre que a necessidade for "outro sistema operacional", a resposta é máquina virtual. Quando for "mesmo sistema, ambientes separados", a resposta é container.'
      },
      {
        id: 'td1-1-b', kind: 'desafio', title: 'Provar que uma imagem gera muitos containers',
        body: [
          { p: 'Rode dois containers diferentes a partir da <strong>mesma</strong> imagem <code>alpine</code>: um chamado <code>um</code>, que imprima a frase <code>sou o container um</code>; outro chamado <code>dois</code>, que imprima <code>sou o container dois</code>.' },
          { p: 'Depois, confirme com <code>docker images</code> que a imagem <code>alpine</code> aparece uma única vez, mesmo tendo originado dois containers.' }
        ],
        hints: [
          'Um comando por container, em segundo plano e com um comando diferente do padrão: <code>docker run -d --name um alpine echo "sou o container um"</code>.',
          'Repita para o <code>dois</code>, trocando o nome e a frase. No fim, rode <code>docker images</code>.'
        ],
        solution: '<pre>$ docker run -d --name um alpine echo "sou o container um"\n$ docker run -d --name dois alpine echo "sou o container dois"\n$ docker images</pre>',
        check: async (ctx) => {
          const c1 = D.container(ctx, 'um'), c2 = D.container(ctx, 'dois');
          const l1 = D.logs(ctx, 'um'), l2 = D.logs(ctx, 'dois');
          return H.checkAll([
            [() => !!c1, 'Crie o container <code>um</code> a partir da imagem <code>alpine</code>.'],
            [() => !!c2, 'Crie o container <code>dois</code>, também a partir de <code>alpine</code>.'],
            [() => /sou o container um/.test(l1), 'O container <code>um</code> precisa imprimir a frase <code>sou o container um</code>.'],
            [() => /sou o container dois/.test(l2), 'O container <code>dois</code> precisa imprimir a frase <code>sou o container dois</code>.'],
            [() => l1.trim() !== l2.trim(), 'As duas saídas ficaram iguais. Escreva uma frase diferente em cada container — é isso que prova que são independentes.'],
            [() => H.usedCommand(ctx, /docker\s+images/), 'Confirme com <code>docker images</code> que a imagem <code>alpine</code> aparece uma vez só.']
          ]);
        }
      }
    ]
  });

  /* ============================== 1.2 ============================== */
  LX.lesson('d01', {
    id: 'ld1-2', n: '1.2', title: 'Cliente, daemon e registry: quem faz o quê',
    goal: 'Saber exatamente o que acontece entre você apertar Enter e o container existir — e por que o erro de permissão do socket é o primeiro que todo mundo encontra.',
    body: [
      { h2: 'O comando que você digita não executa nada' },
      { p: 'Quando você roda <code>docker run nginx</code>, o programa <code>docker</code> não cria container nenhum. Ele monta uma requisição HTTP e envia para outro programa, que está rodando o tempo todo em segundo plano: o <strong>daemon</strong>, chamado <code>dockerd</code>.' },
      {
        ascii: ` você                    máquina                      internet
┌───────────┐        ┌──────────────────────┐        ┌──────────────┐
│  docker   │  API   │       dockerd        │  pull  │  Docker Hub  │
│ (cliente) │───────▶│      (daemon)        │───────▶│  (registry)  │
└───────────┘ socket │                      │        └──────────────┘
                     │  ┌────────────────┐  │
                     │  │  containerd    │  │
                     │  │      runc      │  │
                     │  └────────────────┘  │
                     │          │           │
                     │      namespaces      │
                     │        cgroups       │
                     └──────────────────────┘
                              kernel`
      },
      {
        table: {
          head: ['Peça', 'Papel'],
          rows: [
            ['<code>docker</code>', 'O cliente de linha de comando. Só traduz o que você digita em chamadas de API. Pode até estar em outra máquina.'],
            ['<code>dockerd</code>', 'O daemon. Guarda imagens, cria containers, gerencia redes e volumes. É ele que faz o trabalho.'],
            ['<code>containerd</code>', 'O runtime de alto nível: cuida do ciclo de vida dos containers e do download das imagens.'],
            ['<code>runc</code>', 'O runtime de baixo nível: fala com o kernel para criar namespaces e cgroups. É quem realmente "cria" o container.'],
            ['<strong>registry</strong>', 'O repositório de imagens. O Docker Hub é o público padrão; empresas costumam ter um privado.']
          ]
        }
      },
      { p: 'Você acabou de ver os nomes <code>containerd</code> e <code>runc</code> na saída do <code>docker info</code>. E o <code>docker version</code> mostrava duas versões porque cliente e servidor são programas diferentes — podem, inclusive, estar em versões diferentes.' },

      { h2: 'O daemon é um serviço do systemd' },
      { p: 'Você já sabe administrar serviços. O Docker é mais um:' },
      { code: ['$ systemctl status docker --no-pager | head -8'] },
      { p: 'Se o daemon estiver parado, <strong>nenhum comando docker funciona</strong> — e a mensagem de erro diz isso com todas as letras. Guarde essa informação para o módulo de troubleshooting.' },

      { h2: 'O socket: onde cliente e daemon se encontram' },
      { p: 'A conversa entre os dois passa por um arquivo especial:' },
      { code: ['$ ls -l /var/run/docker.sock'] },
      { p: 'Repare no primeiro caractere da saída: <code>s</code>, de <em>socket</em>. Você viu esse tipo de arquivo no módulo de permissões. E repare no grupo dono: <code>docker</code>.' },
      {
        box: 'key', label: 'Por que o primeiro comando de todo mundo falha', body: [
          { p: 'O socket pertence a <code>root:docker</code> com permissão <code>660</code>. Traduzindo: só o root e quem estiver no grupo <code>docker</code> pode falar com o daemon. Um usuário comum recebe:' },
          { code: ['permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock'], run: false, lang: 'text' },
          { p: 'A correção é entrar no grupo — exatamente o que você aprendeu no módulo de usuários e grupos:' },
          { code: ['sudo usermod -aG docker $USER'], run: false, lang: 'bash' },
          { p: 'E depois <strong>abrir uma sessão nova</strong>, porque os grupos de um processo são definidos no login e não mudam sozinhos.' }
        ]
      },
      {
        box: 'warn', label: 'Estar no grupo docker é ser root', body: [
          { p: 'Quem fala com o daemon pode montar qualquer diretório do host dentro de um container e escrever nele como root. Ou seja: <strong>o grupo <code>docker</code> equivale a acesso administrativo total à máquina</strong>, mesmo sem <code>sudo</code>.' },
          { p: 'Isso não é bug, é consequência do desenho. Está documentado pela própria Docker na página sobre a superfície de ataque do daemon. Voltaremos a isso no módulo de segurança, quando você entender o que significa montar <code>/var/run/docker.sock</code> dentro de um container.' }
        ]
      },

      { h2: 'O registry e o nome completo de uma imagem' },
      { p: 'Quando você escreve <code>nginx</code>, o Docker completa o nome sozinho:' },
      {
        ascii: `        nginx
          ↓  o Docker completa
   docker.io / library / nginx : latest
   └───┬────┘ └──┬────┘ └─┬───┘ └──┬──┘
    registry  namespace  repo    tag`
      },
      {
        ul: [
          '<strong>registry</strong> — sem host, assume <code>docker.io</code> (Docker Hub)',
          '<strong>namespace</strong> — sem namespace, assume <code>library</code>, que é reservado às imagens oficiais',
          '<strong>repositório</strong> — o nome do projeto',
          '<strong>tag</strong> — sem tag, assume <code>latest</code>'
        ]
      },
      { p: 'Por isso <code>nginx</code>, <code>library/nginx</code> e <code>docker.io/library/nginx:latest</code> são a mesma coisa. E por isso uma imagem em um registry privado se escreve com o host na frente: <code>registro.exemplo.test:5000/equipe/api:1.4.2</code>.' },

      { h2: 'Resumo' },
      {
        ul: [
          'O cliente <code>docker</code> só envia requisições; quem executa é o daemon <code>dockerd</code>.',
          'A conversa passa pelo socket <code>/var/run/docker.sock</code>, do grupo <code>docker</code>.',
          'Entrar no grupo <code>docker</code> dá poder equivalente ao de root na máquina.',
          'Um nome curto de imagem é completado para <code>docker.io/library/nome:latest</code>.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td1-2-a', kind: 'guiado', title: 'Ver as peças com os comandos que você já conhece',
        body: [
          { p: 'Nada aqui é novo: são comandos do curso de Linux, aplicados ao Docker.' },
          { code: ['$ systemctl status docker --no-pager | head -6', '$ ls -l /var/run/docker.sock', '$ getent group docker', '$ id'] },
          { p: 'O <code>getent group docker</code> mostra quem pode falar com o daemon. O <code>id</code> mostra se você está nessa lista.' }
        ],
        hints: ['Rode um de cada vez e leia a saída antes de passar para o próximo.'],
        solution: '<pre>$ systemctl status docker --no-pager | head -6\n$ ls -l /var/run/docker.sock\n$ getent group docker\n$ id</pre>',
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /systemctl\s+(status|is-active).*docker/), 'Veja o estado do daemon com <code>systemctl status docker</code>.'],
          [() => H.usedCommand(ctx, /docker\.sock/), 'Olhe o socket com <code>ls -l /var/run/docker.sock</code>.'],
          [() => H.usedCommand(ctx, /getent\s+group\s+docker|groups|\bid\b/), 'Confira quem está no grupo <code>docker</code>.']
        ])
      },
      {
        id: 'td1-2-q', kind: 'quiz', title: 'Um nome de registry que não é o que parece',
        body: [
          { p: 'Alguém roda <code>docker pull registro-interno/api:2.0</code>, esperando baixar de um registry privado da empresa chamado <code>registro-interno</code>. O comando tenta contatar o Docker Hub e falha. Por quê?' }
        ],
        options: [
          { text: 'Sem um host reconhecível na frente (com ponto ou porta), o Docker interpreta <code>registro-interno</code> como um <em>namespace</em> do Docker Hub, não como o endereço de um registry. O nome completo precisaria ser algo como <code>registro.exemplo.test:5000/api:2.0</code>.', correct: true },
          { text: 'O Docker só aceita <code>docker pull</code> de imagens oficiais, sem namespace.', why: 'Imagens com namespace (como <code>bitnami/postgresql</code>) são baixadas normalmente do Hub. O problema aqui não é o namespace, é o registry pretendido.' },
          { text: 'Faltou <code>sudo</code> na frente do comando.', why: 'Falta de permissão no socket dá <em>permission denied</em>, uma mensagem completamente diferente de não achar a imagem no Hub.' },
          { text: 'A tag <code>2.0</code> não existe para essa imagem.', why: 'O erro relatado é de contato com o registro errado, não de tag inexistente numa imagem que foi encontrada.' }
        ],
        explain: 'O Docker só reconhece um pedaço do nome como <em>host</em> de registry quando ele tem ponto, dois-pontos (porta) ou é <code>localhost</code>. <code>registro-interno/api</code> não tem nenhum desses sinais, então vira <code>docker.io/registro-interno/api</code> — um namespace qualquer do Hub, quase certamente vazio. Para apontar para um registry próprio, o nome precisa do host completo: <code>registro.exemplo.test:5000/api:2.0</code>.'
      },
      {
        id: 'td1-2-b', kind: 'desafio', title: 'Tire o acesso e devolva',
        body: [
          { p: 'A melhor forma de entender o erro de permissão é provocá-lo. Faça exatamente isto:' },
          { ol: [
            'Remova o usuário <code>aluno</code> do grupo <code>docker</code>.',
            'Rode <code>docker ps</code> e leia a mensagem inteira.',
            'Coloque o usuário de volta no grupo.',
            'Rode <code>docker ps</code> de novo e confirme que voltou a funcionar.'
          ] },
          { p: 'No fim, o ambiente precisa estar como estava: o <code>aluno</code> de volta no grupo <code>docker</code>.' }
        ],
        hints: [
          'Para tirar alguém de um grupo existe <code>gpasswd -d usuario grupo</code> — você viu isso no módulo de usuários e grupos.',
          'Para colocar de volta sem apagar os outros grupos, use <code>usermod -aG docker aluno</code>. O <code>-a</code> é de <em>append</em>; sem ele, você substituiria a lista inteira.',
          'Ambos precisam de <code>sudo</code>.'
        ],
        solution: '<pre>$ sudo gpasswd -d aluno docker\n$ docker ps\npermission denied while trying to connect to the Docker daemon socket...\n$ sudo usermod -aG docker aluno\n$ docker ps\nCONTAINER ID   IMAGE   ...</pre>',
        check: async (ctx) => {
          const m = ctx.machine;
          const g = m.groups().find(x => x.name === 'docker');
          return H.checkAll([
            [() => H.usedCommand(ctx, /gpasswd\s+-d|deluser\s+aluno\s+docker|usermod\s+-G(?!.*a)/),
              'Primeiro tire o <code>aluno</code> do grupo <code>docker</code> — é assim que você vê o erro acontecer.'],
            [() => H.usedCommand(ctx, /docker\s+ps/), 'Rode <code>docker ps</code> enquanto está fora do grupo, e leia a mensagem.'],
            [() => H.usedCommand(ctx, /usermod\s+-aG\s+docker|gpasswd\s+-a\s+aluno\s+docker|adduser\s+aluno\s+docker/),
              'Agora devolva o acesso com <code>sudo usermod -aG docker aluno</code>.'],
            [() => !!g && g.members.includes('aluno'),
              () => 'O ambiente precisa terminar como começou: o <code>aluno</code> ainda não está no grupo <code>docker</code>. Rode <code>sudo usermod -aG docker aluno</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 1.3 ============================== */
  LX.lesson('d01', {
    id: 'ld1-3', n: '1.3', title: 'Por baixo: namespaces, cgroups e camadas',
    goal: 'Entender os três mecanismos do kernel que fazem um processo comum virar um container — e por que isso explica quase todo comportamento estranho do Docker.',
    body: [
      { h2: 'Container não é uma tecnologia' },
      { p: 'Não existe uma "chamada de sistema <code>criar_container()</code>". O que existe são recursos do kernel Linux que já estavam lá antes do Docker, e que o Docker combina:' },
      {
        table: {
          head: ['Recurso do kernel', 'O que faz', 'O que o container ganha'],
          rows: [
            ['<strong>namespaces</strong>', 'Dão a um processo uma visão própria de um recurso', 'Acha que é o único no sistema'],
            ['<strong>cgroups</strong>', 'Limitam e contabilizam o uso de recursos', 'Não derruba a máquina inteira'],
            ['<strong>union filesystem</strong>', 'Empilha diretórios em uma única visão', 'Imagens em camadas, compartilhadas'],
            ['<strong>capabilities</strong>', 'Fatiam os poderes do root', 'Root de mentira, com poderes reduzidos'],
            ['<strong>seccomp</strong>', 'Filtra chamadas de sistema', 'Não pode fazer tudo o que quiser']
          ]
        }
      },

      { h2: 'Namespaces: a visão restrita' },
      { p: 'Cada tipo de namespace isola uma coisa diferente:' },
      {
        table: {
          head: ['Namespace', 'Isola', 'Consequência visível'],
          rows: [
            ['<code>pid</code>', 'a tabela de processos', 'seu processo é o PID 1 lá dentro'],
            ['<code>mnt</code>', 'os pontos de montagem', 'o sistema de arquivos dele é outro'],
            ['<code>net</code>', 'interfaces, rotas e portas', 'tem o próprio IP e as próprias portas'],
            ['<code>uts</code>', 'hostname e nome de domínio', '<code>hostname</code> devolve o id do container'],
            ['<code>ipc</code>', 'memória compartilhada e filas', 'não conversa com processos do host por IPC'],
            ['<code>user</code>', 'mapeamento de UID e GID', 'o root de dentro pode não ser o root de fora']
          ]
        }
      },
      {
        box: 'key', label: 'O PID 1 é a pista mais reveladora', body: [
          { p: 'Dentro do container, o seu processo é o número 1. Fora, ele é um processo qualquer, com um PID alto. É <strong>o mesmo processo</strong>, visto de dois lugares — e isso prova que o container não é uma máquina separada.' },
          { p: 'Consequência prática: um container <strong>não tem systemd</strong>. Não existe <code>systemctl</code> lá dentro, não existe boot, não existem serviços de sistema. Quando o processo 1 termina, o container termina junto. É por isso que "meu container morre sozinho" é quase sempre "meu processo terminou e você não percebeu".' }
        ]
      },

      { h2: 'cgroups: o teto de recursos' },
      { p: 'Namespaces respondem "o que eu vejo". Cgroups respondem "quanto eu posso usar". Sem eles, um container com vazamento de memória consumiria toda a RAM e derrubaria o servidor.' },
      {
        ul: [
          '<code>--memory 512m</code> — o kernel mata o processo se passar disso (o famoso <em>OOM kill</em>)',
          '<code>--cpus 1.5</code> — no máximo uma CPU e meia de tempo de processador',
          '<code>--pids-limit 100</code> — teto de processos, para conter <em>fork bombs</em>'
        ]
      },
      { p: 'Você vai usar essas flags no módulo de CPU, memória e disco, e vai ver o consumo real com <code>docker stats</code>.' },

      { h2: 'Camadas: por que a imagem é pequena e o pull é rápido' },
      { p: 'Uma imagem não é um arquivo único. É uma pilha de camadas, cada uma somente leitura, cada uma guardando apenas <em>a diferença</em> em relação à de baixo.' },
      {
        ascii: `        ┌──────────────────────────────┐
        │  camada gravável (container) │ ← só existe enquanto o container existe
        ╞══════════════════════════════╡
        │  4. COPY . /app              │ ┐
        │  3. RUN npm install          │ │  a IMAGEM:
        │  2. WORKDIR /app             │ │  somente leitura,
        │  1. FROM node:22-alpine      │ ┘  imutável
        └──────────────────────────────┘`
      },
      { p: 'Três consequências que você vai sentir todos os dias:' },
      {
        ol: [
          '<strong>Compartilhamento.</strong> Dez imagens construídas sobre <code>alpine</code> guardam a camada do Alpine <em>uma vez só</em> no disco. Por isso a soma dos tamanhos em <code>docker images</code> é maior que o espaço realmente ocupado.',
          '<strong>Cache de build.</strong> Se uma camada não mudou, ela é reaproveitada. Por isso a ordem das instruções no Dockerfile importa tanto — assunto do módulo de build.',
          '<strong>A camada gravável é descartável.</strong> Tudo que o container escreve vai para ela, e ela morre junto com o container. É exatamente por isso que existem volumes.'
        ]
      },
      {
        box: 'warn', label: 'A frase que causa perda de dados', body: [
          { p: '<em>"Está dentro do container, então está salvo."</em> Não está. A camada gravável é apagada com <code>docker rm</code>. Um banco de dados sem volume perde tudo quando o container é recriado — e containers são recriados o tempo todo, em toda atualização.' }
        ]
      },

      { h2: 'Resumo' },
      {
        ul: [
          'Container = processo + namespaces + cgroups + sistema de arquivos em camadas.',
          'Namespaces dão a visão restrita; o PID 1 é a prova mais direta disso.',
          'Não há systemd dentro de um container: o processo 1 é a aplicação, e quando ele morre o container morre.',
          'Cgroups impedem que um container derrube a máquina.',
          'A camada gravável some com o container — dados que importam precisam de volume.'
        ]
      }
    ],
    tasks: [
      {
        id: 'td1-3-a', kind: 'guiado', title: 'Ver a mentira do hostname',
        body: [
          { p: 'O namespace <code>uts</code> dá a cada container o próprio hostname, diferente do servidor. Compare:' },
          { code: ['$ hostname', '$ docker run --rm alpine hostname', '$ docker run --rm alpine hostname'] },
          { p: 'Nenhum dos dois hostnames de dentro do container é igual ao do servidor. E repare: os dois containers, vindos da mesma imagem, também têm hostnames diferentes entre si — cada um enxerga a própria identidade.' }
        ],
        hints: ['Rode o <code>hostname</code> sozinho primeiro, depois compare com o hostname de dentro de cada container.'],
        solution: '<pre>$ hostname\n$ docker run --rm alpine hostname\n$ docker run --rm alpine hostname</pre>',
        check: async (ctx) => H.checkAll([
          [() => H.usedCommand(ctx, /^\s*hostname\s*$/m), 'Rode <code>hostname</code> sozinho, para ver o hostname do servidor.'],
          [() => H.usedCommand(ctx, /docker\s+run\s+.*alpine\s+hostname/), 'Rode <code>docker run --rm alpine hostname</code> para ver o hostname de dentro do container.']
        ])
      },
      {
        id: 'td1-3-q', kind: 'quiz', title: 'Por que o container parou sozinho',
        body: [
          { p: 'Alguém sobe um container assim e reclama que ele "morre na hora":' },
          { code: ['$ docker run -d --name teste ubuntu:24.04', '$ docker ps', 'CONTAINER ID   IMAGE   COMMAND   ...   (vazio)'], run: false, lang: 'text' },
          { p: 'Qual é a explicação?' }
        ],
        options: [
          { text: 'O comando padrão da imagem é <code>bash</code>. Sem terminal ligado, o bash não tem o que ler, termina imediatamente — e o container termina junto com o processo 1.', correct: true },
          { text: 'A imagem <code>ubuntu:24.04</code> está corrompida.', why: 'A imagem está íntegra. O comportamento é o esperado para o comando padrão dela.' },
          { text: 'Faltou <code>--restart always</code>.', why: 'Isso faria o container reiniciar em laço, morrendo de novo a cada vez. Não corrige a causa.' },
          { text: 'Faltou publicar uma porta com <code>-p</code>.', why: 'Publicar porta não tem relação com o tempo de vida do processo.' }
        ],
        explain: 'Esta é a consequência mais direta do "o container vive enquanto o PID 1 viver". A imagem <code>ubuntu</code> tem <code>CMD ["/bin/bash"]</code>; sem <code>-it</code> não existe entrada para o bash ler, e ele encerra. Um container não é uma máquina que fica ligada: é um processo. Para ter um shell, use <code>docker run -it ubuntu:24.04</code>; para ter um serviço, use uma imagem cujo processo principal seja um servidor.'
      },
      {
        id: 'td1-3-b', kind: 'desafio', title: 'O mesmo processo, visto de dois lugares',
        body: [
          { p: 'Prove com as próprias mãos que o container é um processo do host.' },
          { ol: [
            'Suba um nginx em segundo plano com o nome <code>prova</code>.',
            'Liste os processos <strong>de dentro</strong> do container.',
            'Liste os processos <strong>do host</strong> e encontre o nginx lá também.'
          ] },
          { p: 'Repare no número do PID nos dois lugares. É o mesmo processo — com dois números diferentes, porque o container tem o próprio namespace de PID.' }
        ],
        hints: [
          'Para subir em segundo plano com nome: <code>docker run -d --name prova nginx:alpine</code>.',
          'Para rodar um comando dentro de um container existente: <code>docker exec prova ps aux</code>.',
          'No host, o <code>ps aux</code> de sempre resolve — filtre com <code>grep nginx</code>.'
        ],
        solution: '<pre>$ docker run -d --name prova nginx:alpine\n$ docker exec prova ps aux\nUSER  PID  ...  COMMAND\nroot    1  ...  /docker-entrypoint.sh nginx -g daemon off;\nnginx  20  ...  nginx: worker process\n\n$ ps aux | grep nginx\nroot  4001  ...  /docker-entrypoint.sh nginx -g daemon off;</pre>',
        check: async (ctx) => {
          const c = D.container(ctx, 'prova');
          return H.checkAll([
            [() => !!c, 'Ainda não existe um container chamado <code>prova</code>. Crie com <code>docker run -d --name prova nginx:alpine</code>.'],
            [() => !!c && c.rodando, 'O container <code>prova</code> existe mas não está em execução. Suba com <code>docker start prova</code>.'],
            [() => H.usedCommand(ctx, /docker\s+(exec|top)\s+.*\bprova\b/), 'Liste os processos de dentro do container com <code>docker exec prova ps aux</code>.'],
            [() => H.usedCommand(ctx, /^(?!docker).*\bps\b/m) || H.usedCommand(ctx, /\bps\s+(aux|-ef)/),
              'Agora liste os processos do host com <code>ps aux | grep nginx</code> e compare os PIDs.']
          ]);
        }
      }
    ]
  });

  /* ============================== 1.4 ============================== */
  LX.lesson('d01', {
    id: 'ld1-4', n: '1.4', title: 'O primeiro container, e a prova de que imagem ≠ container',
    goal: 'Rodar o primeiro container, entender cada linha da saída e demonstrar na prática que uma imagem gera muitos containers independentes.',
    body: [
      { h2: 'hello-world: o menor container que existe' },
      { p: 'A imagem <code>hello-world</code> tem um único arquivo dentro: um binário que imprime um texto e termina. Nem shell ela tem. É perfeita para ver o fluxo completo sem nenhum ruído.' },
      { code: ['$ docker run hello-world'] },
      { p: 'Leia a saída com atenção — ela descreve exatamente os quatro passos que acabamos de estudar:' },
      {
        ascii: `1. O cliente docker falou com o daemon.
2. O daemon baixou a imagem "hello-world" do Docker Hub.
3. O daemon criou um container a partir dessa imagem.
4. O daemon transmitiu a saída de volta para o seu terminal.`
      },
      { p: 'Antes do texto, apareceram linhas como <code>Unable to find image locally</code> e <code>Pull complete</code>. Elas contam que o daemon procurou a imagem no disco, não achou, e foi buscar no registry.' },

      { h2: 'O container terminou, mas não desapareceu' },
      { code: ['$ docker ps', '$ docker ps -a'] },
      { p: 'O primeiro comando não mostra nada: <code>docker ps</code> lista apenas containers <strong>em execução</strong>. O segundo mostra o <code>hello-world</code> com status <code>Exited (0)</code>.' },
      {
        box: 'key', label: 'Um container parado continua existindo', body: [
          { p: 'Ele ocupa espaço, guarda o próprio sistema de arquivos e os próprios logs. Some só com <code>docker rm</code>. É por isso que um servidor esquecido acumula dezenas de containers parados — e por isso existe <code>docker container prune</code>.' }
        ]
      },

      { h2: 'A prova: dois containers, a mesma imagem' },
      { p: 'Rode estes três comandos, um de cada vez, e acompanhe o raciocínio:' },
      { code: ['$ docker run --name caixa1 alpine sh -c \'echo "sou a caixa 1" > /marca.txt\'',
        '$ docker run --name caixa2 alpine sh -c \'echo "sou a caixa 2" > /marca.txt\'',
        '$ docker run --rm alpine cat /marca.txt'] },
      { p: 'O terceiro comando falha com <em>No such file or directory</em>. Isso é o ponto inteiro da aula:' },
      {
        ul: [
          'A <code>caixa1</code> escreveu na <strong>camada gravável dela</strong>.',
          'A <code>caixa2</code> escreveu na <strong>camada gravável dela</strong>, sem ver a da outra.',
          'A <strong>imagem</strong> <code>alpine</code> continua exatamente como veio do registry — por isso o terceiro container não encontra o arquivo.'
        ]
      },
      { p: 'Para ver a camada gravável de cada um:' },
      { code: ['$ docker diff caixa1', '$ docker diff caixa2'] },
      { p: 'O <code>docker diff</code> compara o sistema de arquivos atual do container com a imagem de origem. <code>A</code> é <em>added</em>, <code>C</code> é <em>changed</em>, <code>D</code> é <em>deleted</em>.' },

      { h2: 'Limpando' },
      { code: ['$ docker rm caixa1 caixa2', '$ docker ps -a'] },
      { p: 'Os containers somem. A imagem <code>alpine</code> continua em <code>docker images</code> — porque imagem e container são coisas diferentes.' },

      { h2: 'Resumo' },
      {
        ul: [
          '<code>docker run</code> baixa a imagem se precisar, cria o container e o executa.',
          '<code>docker ps</code> mostra os em execução; <code>docker ps -a</code> mostra todos.',
          'Cada container tem a própria camada gravável, isolada dos outros.',
          'A imagem é imutável: nada do que o container escreve volta para ela.',
          '<code>docker diff</code> mostra o que o container escreveu por cima da imagem.'
        ]
      },
      { h2: 'Próximo passo' },
      { p: 'Agora que a distinção está clara, o próximo módulo percorre o ciclo de vida completo de um container: criar, parar, iniciar, reiniciar, pausar e remover — cada um com o comando certo.' }
    ],
    tasks: [
      {
        id: 'td1-4-a', kind: 'guiado', title: 'Rodar o primeiro container',
        body: [
          { p: 'Rode o <code>hello-world</code> e depois veja o que ficou:' },
          { code: ['$ docker run hello-world', '$ docker ps', '$ docker ps -a'] },
          { p: 'Compare as duas listagens: sem o <code>-a</code>, o container que já terminou não aparece.' }
        ],
        hints: ['Três comandos, um de cada vez.'],
        solution: '<pre>$ docker run hello-world\n$ docker ps\n$ docker ps -a</pre>',
        check: async (ctx) => H.checkAll([
          [() => D.porImagem(ctx, 'hello-world').length > 0 || H.usedCommand(ctx, /docker\s+run\s+.*hello-world/),
            'Rode <code>docker run hello-world</code>.'],
          [() => H.usedCommand(ctx, /docker\s+ps\s+-a|docker\s+container\s+ls\s+-a/),
            'Agora liste também os containers parados com <code>docker ps -a</code>.']
        ])
      },
      {
        id: 'td1-4-q', kind: 'quiz', title: 'O log que sumiu junto com o container',
        body: [
          { p: 'Alguém roda <code>docker run --rm hello-world</code>. Minutos depois, quer reler a saída com <code>docker ps -a</code> seguido de <code>docker logs</code>, mas o container nem aparece na lista. Por quê?' }
        ],
        options: [
          { text: 'O <code>--rm</code> remove o container assim que o processo termina — camada gravável, logs e tudo. Sem <code>--rm</code>, ele continuaria em <code>docker ps -a</code> com status <code>Exited (0)</code>.', correct: true },
          { text: 'A imagem <code>hello-world</code> não gera logs.', why: 'Ela imprime um texto inteiro na saída padrão — é exatamente o que o <code>docker logs</code> mostraria, se o container ainda existisse.' },
          { text: '<code>docker ps -a</code> só mostra containers das últimas 24 horas.', why: 'Não existe esse limite de tempo; um container parado fica listado até alguém rodar <code>docker rm</code> — ou até ter sido criado com <code>--rm</code>.' },
          { text: 'Faltou <code>sudo</code> no <code>docker ps -a</code>.', why: 'Falta de permissão no socket bloquearia o comando inteiro com um erro de <em>permission denied</em>, não faria um container específico sumir da lista.' }
        ],
        explain: '<code>--rm</code> é exatamente para isso: descartar o container — e tudo que está na camada gravável dele, inclusive os logs — assim que ele termina. É ótimo para testes rápidos, mas nunca deveria ir num serviço: se ele cair e você precisar investigar, o <code>--rm</code> já apagou a evidência.'
      },
      {
        id: 'td1-4-b', kind: 'desafio', title: 'Provar que a imagem não muda',
        body: [
          { p: 'Reproduza a demonstração e deixe o resultado no ambiente:' },
          { ol: [
            'Crie um container chamado <code>caixa1</code> a partir do <code>alpine</code> que escreva alguma coisa em <code>/marca.txt</code>.',
            'Crie um <code>caixa2</code>, também do <code>alpine</code>, que escreva um conteúdo <strong>diferente</strong> no mesmo caminho.',
            'Confirme com <code>docker diff</code> que cada um tem a sua própria alteração.'
          ] },
          { p: 'Os dois containers precisam continuar existindo no fim (podem estar parados).' }
        ],
        hints: [
          'A forma de escrever um arquivo dentro do container é dar um comando ao container: <code>docker run --name caixa1 alpine sh -c \'echo texto > /marca.txt\'</code>.',
          'Use aspas simples ao redor do <code>sh -c</code>, senão o redirecionamento <code>&gt;</code> é executado pelo shell do <em>host</em>, e o arquivo seria criado aqui fora.',
          'Depois confira com <code>docker diff caixa1</code> — deve aparecer <code>A /marca.txt</code>.'
        ],
        solution: '<pre>$ docker run --name caixa1 alpine sh -c \'echo "sou a caixa 1" &gt; /marca.txt\'\n$ docker run --name caixa2 alpine sh -c \'echo "sou a caixa 2" &gt; /marca.txt\'\n$ docker diff caixa1\nA /marca.txt\n$ docker diff caixa2\nA /marca.txt</pre>',
        check: async (ctx) => {
          const c1 = D.container(ctx, 'caixa1'), c2 = D.container(ctx, 'caixa2');
          const t1 = c1 ? D.leNoContainer(ctx, 'caixa1', '/marca.txt') : null;
          const t2 = c2 ? D.leNoContainer(ctx, 'caixa2', '/marca.txt') : null;
          return H.checkAll([
            [() => !!c1, 'Falta o container <code>caixa1</code>.'],
            [() => !!c2, 'Falta o container <code>caixa2</code>.'],
            [() => t1 !== null, 'O <code>caixa1</code> existe, mas não tem <code>/marca.txt</code> dentro. Lembre das aspas simples: sem elas o <code>&gt;</code> é executado no host.'],
            [() => t2 !== null, 'O <code>caixa2</code> existe, mas não tem <code>/marca.txt</code> dentro.'],
            [() => String(t1).trim() !== String(t2).trim(),
              'Os dois arquivos têm o mesmo conteúdo. Escreva textos diferentes em cada container — é isso que mostra que as camadas graváveis são independentes.']
          ]);
        }
      }
    ]
  });
})();
