/* =========================================================================
   MÓDULO 11 — Armazenamento
   ========================================================================= */
'use strict';
(function () {
  const H = LX.H;
  const disco = (ctx, nome) => {
    const m = ctx.machine || ctx.sh.m;
    return (m.blockDevices || []).find(d => d.name === nome) || null;
  };
  const particao = (ctx, nome) => {
    const m = ctx.machine || ctx.sh.m;
    return (m.blockDevices || []).flatMap(d => [d].concat(d.children || [])).find(x => x.name === nome) || null;
  };
  const montagem = (ctx, ponto) => {
    const m = ctx.machine || ctx.sh.m;
    return m.fs.mounts.find(x => x.mount === ponto) || null;
  };

  /* ============================== 11.1 ============================== */
  LX.lesson('m11', {
    id: 'l11-1', n: '11.1', title: 'Discos, partições e a árvore única',
    goal: 'Enxergar como um disco vira um diretório dentro da árvore, e ler o mapa de armazenamento de qualquer servidor.',
    body: [
      { lede: 'No Windows, cada disco ganha uma letra. No Linux não existe letra: todo disco é <em>enxertado</em> em algum ponto da mesma árvore que começa em <code>/</code>.' },
      {
        ascii: `        HARDWARE                            ÁRVORE ÚNICA

  /dev/vda  (disco 20G)                       /
    ├─ vda1  512M  ──── montado em ────▶      ├── boot/
    │                                         │     └── efi/   ← vda1
    └─ vda2  19.5G ──── montado em ────▶      ├── etc/
                                              ├── home/
  /dev/vdb  (disco 5G)                        ├── var/         ← tudo isto é vda2
    └─ vdb1  5G    ──── montado em ────▶      └── mnt/
                                                    └── dados/ ← vdb1

  "montar" = dizer em qual DIRETÓRIO o conteúdo de uma partição aparece`
      },
      { p: 'Três camadas, três comandos:' },
      {
        table: {
          head: ['Camada', 'O que é', 'Comando'],
          rows: [
            ['<strong>disco</strong>', 'o hardware inteiro: <code>/dev/vda</code>, <code>/dev/sda</code>, <code>/dev/nvme0n1</code>', '<code>lsblk</code>, <code>fdisk -l</code>'],
            ['<strong>partição</strong>', 'uma fatia do disco: <code>/dev/vda1</code>', '<code>parted</code>, <code>fdisk</code>'],
            ['<strong>sistema de arquivos</strong>', 'a organização dentro da fatia: ext4, xfs, vfat', '<code>mkfs</code>, <code>blkid</code>'],
            ['<strong>montagem</strong>', 'onde aquele conteúdo aparece na árvore', '<code>mount</code>, <code>findmnt</code>']
          ]
        }
      },
      { cmd: 'lsblk' },
      { code: ['$ lsblk', '$ lsblk -f', '$ sudo fdisk -l | head -12'] },
      { p: 'O <code>lsblk</code> mostra a hierarquia física; o <code>-f</code> acrescenta sistema de arquivos, rótulo, UUID e ponto de montagem — é a visão mais completa em um comando só.' },

      { h2: 'Os nomes dos dispositivos' },
      {
        table: {
          head: ['Nome', 'Tipo de disco'],
          rows: [
            ['<code>/dev/sda</code>, <code>/dev/sdb</code>', 'SATA, SAS, USB (o "s" veio de SCSI)'],
            ['<code>/dev/vda</code>, <code>/dev/vdb</code>', '<strong>disco virtual</strong> (KVM/virtio) — comum em nuvem'],
            ['<code>/dev/nvme0n1</code>', 'SSD NVMe; a partição é <code>nvme0n1<strong>p1</strong></code>'],
            ['<code>/dev/mapper/vg-lv</code>', 'volume lógico (LVM)'],
            ['<code>/dev/loop0</code>', 'arquivo montado como se fosse disco (snaps, imagens ISO)']
          ]
        }
      },
      {
        box: 'key', body: [
          { p: 'A letra final <strong>não é estável</strong>: dependendo da ordem de detecção, o disco que hoje é <code>/dev/sdb</code> pode virar <code>/dev/sdc</code> depois de um reboot. É por isso que o <code>/etc/fstab</code> moderno usa <strong>UUID</strong> em vez de nome de dispositivo — assunto da aula 11.4.' }
        ]
      },

      { h2: 'Ver o que está montado' },
      { code: ['$ mount | head -6', '$ findmnt', '$ df -h', '$ df -h /home'] },
      { p: 'O <code>df -h</code> é o comando do dia a dia: espaço total, usado e livre por <strong>sistema de arquivos montado</strong>. Note que <code>/home</code> aparece dentro de <code>/</code> nesta máquina — não é uma partição separada aqui.' },
      {
        box: 'tip', label: 'Por que os números do df não fecham', body: [
          { p: 'Em ext4, cerca de 5% do espaço fica reservado para o root — daí a diferença entre "usado + disponível" e o total. Isso existe para que o sistema continue funcionando (e você consiga logar para limpar) mesmo com o disco "cheio" para os usuários comuns.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't11-1-a', kind: 'guiado', title: 'Leia o mapa de armazenamento',
        body: [
          { p: 'Levante as quatro camadas nesta máquina.' },
          {
            code: [
              '$ lsblk',
              '$ lsblk -f',
              '$ sudo fdisk -l | head -14',
              '$ mount | head -5',
              '$ findmnt',
              '$ df -h'
            ]
          },
          { p: 'Responda para você: quantos discos existem? Qual partição é a raiz? Existe algum disco <strong>sem</strong> sistema de arquivos?' }
        ],
        hints: ['O disco <code>vdb</code> aparece no <code>lsblk</code> sem nenhuma partição embaixo — guarde isso, você vai usá-lo nas próximas aulas.'],
        solution: '<div class="code"><pre>lsblk\nlsblk -f\nsudo fdisk -l | head -14\nmount | head -5\nfindmnt\ndf -h</pre></div>',
        check: async (ctx) => LX.H.checkAll([
          [() => H.usedCommand(ctx, /lsblk/), 'Veja os discos com <code>lsblk</code>.'],
          [() => H.usedCommand(ctx, /lsblk\s+-f|blkid/), 'Veja os sistemas de arquivos com <code>lsblk -f</code>.'],
          [() => H.usedCommand(ctx, /\bdf\b/), 'Veja o espaço com <code>df -h</code>.'],
          [() => H.usedCommand(ctx, /findmnt|mount\s*$/m), 'Liste as montagens com <code>findmnt</code> ou <code>mount</code>.']
        ])
      },
      {
        id: 't11-1-q', kind: 'quiz', title: 'Conceito: disco cheio, mas não está',
        body: [
          { p: 'Uma aplicação falha com <code>No space left on device</code>. Você roda <code>df -h</code> e a partição está com 62% de uso. O que investigar?' }
        ],
        options: [
          { text: 'Os <strong>inodes</strong>: <code>df -i</code>. Um sistema de arquivos pode ter espaço em bytes e mesmo assim esgotar a tabela de inodes com milhões de arquivos pequenos.', correct: true },
          { text: 'A memória RAM, que também gera esse erro.', why: 'Falta de RAM produz erros de alocação ou o OOM killer, não <code>ENOSPC</code>.' },
          { text: 'O <code>df</code> está errado; reiniciar resolve.', why: 'O <code>df</code> lê o superbloco; o número está correto — só não é a métrica que esgotou.' },
          { text: 'A cota de disco do usuário, que é o único caso possível.', why: 'É uma hipótese válida, mas a causa mais comum com <code>df</code> mostrando espaço livre são os inodes.' }
        ],
        explain: 'Duas causas clássicas para "disco cheio com espaço livre": <strong>inodes esgotados</strong> (<code>df -i</code>) e <strong>arquivo apagado que um processo ainda mantém aberto</strong> (<code>lsof | grep deleted</code>, do módulo 7) — nesse segundo caso o espaço só volta quando o processo fecha o descritor.'
      },
      {
        id: 't11-1-b', kind: 'desafio', title: 'Relatório de armazenamento',
        body: [
          { p: 'Um colega vai revisar esta máquina remotamente e pediu um retrato do armazenamento antes de mexer em qualquer disco.' },
          {
            ul: [
              'grave em <code>~/relatorio-disco.txt</code> a saída de <code>lsblk -f</code>;',
              'logo depois, <strong>no mesmo arquivo</strong>, acrescente a saída de <code>df -h</code> — sem apagar a primeira parte.'
            ]
          }
        ],
        hints: [
          'O primeiro redirecionamento cria o arquivo (<code>&gt;</code>); o segundo precisa <strong>acrescentar</strong> (<code>&gt;&gt;</code>), senão apaga o que já estava lá.',
          '<code>lsblk -f &gt; ~/relatorio-disco.txt</code> e depois <code>df -h &gt;&gt; ~/relatorio-disco.txt</code>.'
        ],
        solution: '<pre>lsblk -f > ~/relatorio-disco.txt\ndf -h >> ~/relatorio-disco.txt\ncat ~/relatorio-disco.txt</pre>',
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/relatorio-disco.txt');
          return LX.H.checkAll([
            [c !== null, 'O arquivo <code>~/relatorio-disco.txt</code> ainda não existe.'],
            [() => /NAME\s+FSTYPE/.test(c || ''), 'Falta a saída de <code>lsblk -f</code> no arquivo — o cabeçalho com NAME/FSTYPE não aparece.'],
            [() => /Filesystem/.test(c || '') && /Mounted on/.test(c || ''), 'Falta a saída de <code>df -h</code> no arquivo — o cabeçalho com Filesystem/Mounted on não aparece.'],
            [() => (c || '').indexOf('NAME') >= 0 && (c || '').indexOf('Filesystem') >= 0 && (c || '').indexOf('NAME') < (c || '').indexOf('Filesystem'), 'A ordem importa: primeiro <code>lsblk -f</code>, depois <code>df -h</code>, no mesmo arquivo.'],
            [() => H.usedCommand(ctx, /lsblk\s+-f/), 'Rode <code>lsblk -f</code>.'],
            [() => H.usedCommand(ctx, /df\s+-h/), 'Rode <code>df -h</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 11.2 ============================== */
  LX.lesson('m11', {
    id: 'l11-2', n: '11.2', title: 'Particionar e formatar',
    goal: 'Transformar um disco novo e vazio em uma partição formatada, pronta para receber dados.',
    body: [
      { p: 'Um disco recém-adicionado não serve para nada até passar por dois passos: <strong>particionar</strong> (dividir) e <strong>formatar</strong> (criar o sistema de arquivos).' },
      { code: ['$ lsblk', '$ sudo parted -s /dev/vdb print'] },
      { p: 'O <code>vdb</code> aparece sem partições e sem tabela: é um disco cru.' },

      { h2: 'Tabela de partições: GPT ou MBR' },
      {
        table: {
          head: ['', 'MBR (msdos)', 'GPT'],
          rows: [
            ['Idade', '1983', '2010 em diante'],
            ['Tamanho máximo', '2 TB', 'praticamente ilimitado'],
            ['Partições', '4 primárias (ou 3 + estendida)', '128 por padrão'],
            ['Redundância', 'uma cópia da tabela', 'cópia primária e de backup'],
            ['Quando usar', 'compatibilidade com sistemas antigos', '<strong>o padrão hoje</strong>']
          ]
        }
      },
      { cmd: 'parted' },
      { p: 'O <code>parted -s</code> ("script") faz tudo sem perguntar nada — é a forma usada em automação. O <code>fdisk</code> interativo continua existindo, mas exige uma sequência de teclas que não cabe em um script.' },
      {
        code: [
          '$ sudo parted -s /dev/vdb mklabel gpt',
          '$ sudo parted -s /dev/vdb mkpart dados ext4 0% 100%',
          '$ lsblk',
          '$ sudo parted -s /dev/vdb print'
        ]
      },
      {
        box: 'warn', body: [
          {
        box: 'note', label: 'O "ext4" do mkpart não formata nada', body: [
          { p: 'No comando <code>parted mkpart dados ext4 0% 100%</code>, o <code>ext4</code> é apenas um <strong>rótulo de tipo</strong> gravado na tabela de partições — uma anotação sobre o que se pretende colocar ali. Nenhum sistema de arquivos é criado.' },
          { p: 'Quem cria o sistema de arquivos é o <code>mkfs</code>, no passo seguinte. Se você parar depois do <code>mkpart</code> e tentar montar, vai receber <em>"wrong fs type"</em> — e o <code>lsblk -f</code> vai mostrar a coluna FSTYPE vazia, que é a prova.' }
        ]
      },
      { p: 'O <code>mklabel</code> <strong>apaga a tabela de partições inteira</strong> — todos os dados do disco tornam-se inacessíveis. Confira duas vezes o nome do dispositivo antes de rodar. Trocar <code>vdb</code> por <code>vda</code> nesse comando destrói o sistema em execução.' },
          { p: 'A checagem de dois segundos que evita o desastre: <code>lsblk</code> e confirme o <strong>tamanho</strong> e o <strong>ponto de montagem</strong> do disco antes de mexer. Disco com <code>/</code> montado nunca é o alvo.' }
        ]
      },

      { h2: 'Formatar: criar o sistema de arquivos' },
      { cmd: 'mkfs' },
      {
        table: {
          head: ['Sistema', 'Quando usar'],
          rows: [
            ['<strong>ext4</strong>', 'o padrão sólido do Linux — escolha segura para quase tudo'],
            ['<strong>xfs</strong>', 'ótimo para arquivos grandes e paralelismo; padrão no RHEL'],
            ['<strong>btrfs</strong>', 'snapshots e checksums integrados; padrão em algumas distribuições'],
            ['<strong>vfat</strong> / exFAT', 'pendrives e partição EFI — compatível com Windows'],
            ['<strong>tmpfs</strong>', 'vive na RAM; <code>/run</code> e <code>/dev/shm</code>']
          ]
        }
      },
      {
        code: [
          '$ sudo mkfs.ext4 -L DADOS /dev/vdb1',
          '$ sudo blkid | tail -2',
          '$ lsblk -f'
        ]
      },
      { p: 'O <code>-L</code> dá um <strong>rótulo</strong> à partição, e o <code>mkfs</code> gera um <strong>UUID</strong> novo. Os dois servem para identificar a partição sem depender da letra do dispositivo — e é por UUID que o <code>fstab</code> vai apontar.' },
      {
        box: 'key', body: [
          { p: 'Formatar é destrutivo. Um <code>mkfs.ext4 /dev/vdb1</code> em cima de uma partição com dados apaga tudo em segundos.' },
          { p: 'As proteções que existem são poucas e não substituem conferir o nome do dispositivo duas vezes: o <code>mkfs</code> se recusa a agir numa partição <strong>montada</strong>, e o <code>mke2fs</code> <em>pede confirmação</em> quando detecta um sistema de arquivos já existente ou quando você aponta para o disco inteiro em vez de uma partição — é para isso que existe o <code>-F</code>, que força e ignora o aviso. Fora esses casos, ele obedece em silêncio.' }
        ]
      },
      { p: 'Para conferir a saúde de um sistema de arquivos ext4 <strong>desmontado</strong>, existe o <code>fsck</code> — nunca em partição montada, sob risco de corromper:' },
      {
        code: [
          '# apenas leitura, seguro:  sudo dumpe2fs -h /dev/vdb1',
          '# verificação:  sudo fsck -n /dev/vdb1   (partição DESMONTADA)'
        ], run: false, lang: 'text'
      }
    ],
    tasks: [
      {
        id: 't11-2-a', kind: 'guiado', title: 'Prepare o disco novo',
        body: [
          { p: 'Transforme o <code>vdb</code> cru em uma partição formatada.' },
          {
            code: [
              '$ lsblk',
              '$ sudo parted -s /dev/vdb print',
              '$ sudo parted -s /dev/vdb mklabel gpt',
              '$ sudo parted -s /dev/vdb mkpart dados ext4 0% 100%',
              '$ lsblk',
              '$ sudo mkfs.ext4 -L DADOS /dev/vdb1',
              '$ lsblk -f',
              '$ sudo blkid | tail -1'
            ]
          },
          { p: 'Compare o <code>lsblk -f</code> antes e depois do <code>mkfs</code>: as colunas FSTYPE, LABEL e UUID aparecem só depois da formatação.' }
        ],
        hints: ['Sem tabela de partições, o <code>mkpart</code> falha — o <code>mklabel</code> vem primeiro.'],
        solution: '<div class="code"><pre>lsblk\nsudo parted -s /dev/vdb mklabel gpt\nsudo parted -s /dev/vdb mkpart dados ext4 0% 100%\nlsblk\nsudo mkfs.ext4 -L DADOS /dev/vdb1\nlsblk -f\nsudo blkid | tail -1</pre></div>',
        check: async (ctx) => {
          const d = disco(ctx, 'vdb');
          if (!d) return { ok: false, msg: 'Este ambiente não tem o disco <code>/dev/vdb</code>.' };
          const p1 = particao(ctx, 'vdb1');
          return LX.H.checkAll([
            [!!d.tabela, 'O disco ainda não tem tabela de partições. Crie com <code>sudo parted -s /dev/vdb mklabel gpt</code>.'],
            [d.tabela === 'gpt', `A tabela deve ser <code>gpt</code>; está <code>${d.tabela}</code>.`],
            [!!p1, 'Crie a partição com <code>sudo parted -s /dev/vdb mkpart dados ext4 0% 100%</code>.'],
            [!!p1 && p1.fstype === 'ext4', 'Formate a partição com <code>sudo mkfs.ext4 /dev/vdb1</code>.'],
            [!!p1 && !!p1.uuid, 'A partição deveria ter ganhado um UUID na formatação.'],
            [() => H.usedCommand(ctx, /lsblk/), 'Confira o resultado com <code>lsblk -f</code>.']
          ]);
        }
      },
      {
        id: 't11-2-q', kind: 'quiz', title: 'Encontre o erro',
        body: [
          { p: 'Um administrador quer adicionar um disco novo em um servidor e digita:' },
          { code: ['sudo parted -s /dev/sda mklabel gpt'], run: false, mixed: false },
          { p: 'O <code>lsblk</code> antes mostrava:' },
          {
            code: [
              'sda    223G  disk',
              '├─sda1 512M  part /boot/efi',
              '└─sda2 222G  part /',
              'sdb    1.8T  disk'
            ], run: false, mixed: false, lang: 'text'
          },
          { p: 'O que aconteceu?' }
        ],
        options: [
          { text: 'Ele destruiu a tabela de partições do disco <strong>do sistema</strong> — <code>sda</code> é onde estão <code>/boot/efi</code> e <code>/</code>. O disco novo era o <code>sdb</code>.', correct: true },
          { text: 'Nada de grave: o sistema continua rodando, então está tudo bem.', why: 'O sistema continua enquanto está em memória, mas não sobrevive ao próximo boot — o que torna o erro ainda mais perigoso, porque parece que deu certo.' },
          { text: 'O comando falharia, já que o disco está montado.', why: 'O <code>parted</code> avisa sobre partições em uso, mas o <code>-s</code> (script) suprime perguntas e a tabela pode ser sobrescrita.' },
          { text: 'Ele apenas renomeou a tabela para GPT, sem perder dados.', why: '<code>mklabel</code> cria uma tabela <strong>nova e vazia</strong>: as entradas das partições existentes desaparecem.' }
        ],
        explain: 'A prevenção cabe em uma linha: antes de qualquer comando destrutivo, rode <code>lsblk</code> e confirme <strong>tamanho</strong> e <strong>ponto de montagem</strong>. Um disco com <code>/</code> ou <code>/boot</code> montado nunca é o alvo. Em servidores de produção, vale ainda conferir o número de série com <code>lsblk -o NAME,SIZE,SERIAL</code>.'
      },
      {
        id: 't11-2-b', kind: 'desafio', title: 'Volume de staging com rótulo próprio',
        body: [
          { p: 'A equipe vai usar este disco para arquivos de staging e quer poder identificá-lo pelo <strong>rótulo</strong>, não pelo nome do dispositivo.' },
          {
            ul: [
              'o disco <code>vdb</code> deve ter tabela <strong>gpt</strong> e uma partição <code>vdb1</code>;',
              'a partição formatada em <strong>ext4</strong>, com o rótulo <strong><code>STAGING</code></strong> (não <code>DADOS</code>);',
              'grave em <code>~/vdb1-info.txt</code> a saída de <code>sudo blkid /dev/vdb1</code>, confirmando rótulo e UUID.'
            ]
          },
          { p: 'Se você já formatou o <code>vdb1</code> numa aula anterior com outro rótulo, reformate — o <code>mkfs</code> sobrescreve sem pena.' }
        ],
        hints: [
          'O rótulo vai na formatação: a opção <code>-L</code> do <code>mkfs.ext4</code>, não no <code>parted</code>.',
          '<code>sudo mkfs.ext4 -L STAGING /dev/vdb1</code> e depois <code>sudo blkid /dev/vdb1 &gt; ~/vdb1-info.txt</code>.'
        ],
        solution: '<pre>sudo parted -s /dev/vdb mklabel gpt\nsudo parted -s /dev/vdb mkpart dados ext4 0% 100%\nsudo mkfs.ext4 -L STAGING /dev/vdb1\nsudo blkid /dev/vdb1 > ~/vdb1-info.txt\ncat ~/vdb1-info.txt</pre>',
        check: async (ctx) => {
          const d = disco(ctx, 'vdb');
          const p1 = particao(ctx, 'vdb1');
          const info = H.read(ctx, '/home/aluno/vdb1-info.txt');
          return LX.H.checkAll([
            [!!d && d.tabela === 'gpt', 'O disco <code>vdb</code> precisa de uma tabela <code>gpt</code>.'],
            [!!p1, 'Crie a partição <code>vdb1</code> com <code>parted mkpart</code>.'],
            [!!p1 && p1.fstype === 'ext4', 'Formate a partição em <code>ext4</code>.'],
            [!!p1 && p1.label === 'STAGING', () => `O rótulo deve ser <code>STAGING</code>; está "${(p1 && p1.label) || '(nenhum)'}" — use <code>mkfs.ext4 -L STAGING</code>.`],
            [info !== null, 'Falta o arquivo <code>~/vdb1-info.txt</code>.'],
            [() => /STAGING/.test(info || ''), 'O arquivo deve conter a saída de <code>blkid</code>, com o rótulo <code>STAGING</code>.'],
            [() => H.usedCommand(ctx, /blkid\s+\/dev\/vdb1/), 'Rode <code>blkid /dev/vdb1</code> e redirecione a saída para o arquivo.']
          ]);
        }
      }
    ]
  });

  /* ============================== 11.3 ============================== */
  LX.lesson('m11', {
    id: 'l11-3', n: '11.3', title: 'Montar e desmontar',
    goal: 'Enxertar a partição na árvore, entender por que os arquivos "somem" e resolver o clássico "target is busy".',
    body: [
      { cmd: 'mount' },
      { p: 'Montar é apontar: "o conteúdo desta partição aparece <em>neste</em> diretório".' },
      {
        code: [
          '$ sudo mkdir -p /mnt/dados',
          '$ ls /mnt/dados',
          '$ sudo mount /dev/vdb1 /mnt/dados',
          '$ findmnt /mnt/dados',
          '$ ls /mnt/dados',
          '$ df -h /mnt/dados'
        ]
      },
      { p: 'Apareceu um <code>lost+found</code>: é um diretório criado pelo próprio ext4, onde o <code>fsck</code> deposita arquivos recuperados que perderam o nome. Sua presença é sinal de que você está mesmo vendo o conteúdo da partição, e não do diretório vazio de antes.' },
      { p: 'Grave algo e comprove que os dados vivem na partição, não no diretório:' },
      {
        code: [
          '$ echo "dados importantes" | sudo tee /mnt/dados/arquivo.txt',
          '$ ls /mnt/dados',
          '$ sudo umount /mnt/dados',
          '$ ls /mnt/dados',
          '$ sudo mount /dev/vdb1 /mnt/dados && cat /mnt/dados/arquivo.txt'
        ]
      },
      {
        box: 'key', label: 'O diretório continua lá embaixo', body: [
          { p: 'Ao desmontar, o <code>/mnt/dados</code> volta a ser o diretório vazio original — o arquivo não sumiu, ele está na partição, que deixou de aparecer ali.' },
          { p: 'A recíproca gera o susto clássico: se você montar uma partição em cima de um diretório <strong>que já tinha arquivos</strong>, eles ficam <em>escondidos</em> (não apagados) enquanto a montagem existir. Desmontou, voltaram. Muita gente já achou que perdeu dados por causa disso.' }
        ]
      },

      { h2: 'Opções de montagem' },
      {
        table: {
          head: ['Opção', 'Efeito'],
          rows: [
            ['<code>ro</code> / <code>rw</code>', 'somente leitura / leitura e escrita'],
            ['<code>noexec</code>', 'proíbe executar binários — comum em <code>/tmp</code> e partições de dados'],
            ['<code>nosuid</code>', 'ignora bits SUID/SGID (módulo 5) — importante em mídia removível'],
            ['<code>nodev</code>', 'ignora arquivos de dispositivo'],
            ['<code>noatime</code>', 'não grava o horário de leitura — ganho de desempenho'],
            ['<code>defaults</code>', 'equivale a <code>rw,suid,dev,exec,auto,nouser,async</code>']
          ]
        }
      },
      { code: ['$ sudo umount /mnt/dados', '$ sudo mount -o ro /dev/vdb1 /mnt/dados', '$ findmnt /mnt/dados', '$ sudo touch /mnt/dados/teste 2>&1 | head -1', '$ sudo umount /mnt/dados && sudo mount /dev/vdb1 /mnt/dados'] },
      { p: 'A combinação <code>noexec,nosuid,nodev</code> é o padrão de endurecimento para qualquer partição que receba dados de usuários — ela impede que um arquivo enviado por upload seja executado.' },

      { h2: 'target is busy' },
      { p: 'A mensagem mais comum ao desmontar. Ela significa: <strong>alguém está usando</strong> aquele ponto de montagem.' },
      { code: ['$ cd /mnt/dados', '$ sudo umount /mnt/dados', '$ cd /', '$ sudo umount /mnt/dados', '$ sudo mount /dev/vdb1 /mnt/dados'] },
      { p: 'O culpado mais frequente é o seu próprio shell, com o <code>cd</code> dentro do diretório. Quando não for, os comandos do módulo 7 respondem quem é:' },
      {
        table: {
          head: ['Comando', 'Responde'],
          rows: [
            ['<code>sudo fuser -vm /mnt/dados</code>', 'quais processos usam o ponto de montagem'],
            ['<code>sudo lsof +D /mnt/dados</code>', 'quais arquivos estão abertos lá dentro'],
            ['<code>sudo umount -l /mnt/dados</code>', '"lazy": desmonta quando o último uso terminar'],
            ['<code>sudo umount -f ...</code>', 'força — último recurso, e só para montagens de rede travadas']
          ]
        }
      },
      {
        box: 'warn', body: [
          { p: 'Evite o hábito de <code>umount -f</code>: se houver escrita em andamento, o resultado é perda de dados. Descubra quem segura, encerre com educação (módulo 7) e desmonte normalmente.' }
        ]
      }
    ],
    tasks: [
      {
        id: 't11-3-a', kind: 'guiado', title: 'Monte, escreva, desmonte',
        body: [
          { p: 'Comprove que os dados moram na partição — e provoque o "target is busy" de propósito.' },
          { p: 'Se você recarregou o ambiente desde a aula anterior, prepare o disco de novo:' },
          {
            code: [
              '$ sudo parted -s /dev/vdb mklabel gpt',
              '$ sudo parted -s /dev/vdb mkpart dados ext4 0% 100%',
              '$ sudo mkfs.ext4 -L DADOS /dev/vdb1'
            ]
          },
          {
            code: [
              '$ sudo mkdir -p /mnt/dados',
              '$ sudo mount /dev/vdb1 /mnt/dados',
              '$ ls /mnt/dados && df -h /mnt/dados',
              '$ echo "dados importantes" | sudo tee /mnt/dados/arquivo.txt',
              '$ sudo umount /mnt/dados && ls /mnt/dados',
              '$ sudo mount /dev/vdb1 /mnt/dados && cat /mnt/dados/arquivo.txt'
            ]
          },
          { p: 'Agora o erro clássico:' },
          { code: ['$ cd /mnt/dados', '$ sudo umount /mnt/dados', '$ cd ~', '$ sudo umount /mnt/dados', '$ sudo mount /dev/vdb1 /mnt/dados'] }
        ],
        hints: ['Se o <code>mount</code> reclamar que o dispositivo não existe, volte à aula 11.2 e prepare o <code>/dev/vdb1</code>.'],
        solution: '<div class="code"><pre>sudo mkdir -p /mnt/dados\nsudo mount /dev/vdb1 /mnt/dados\nls /mnt/dados\necho "dados importantes" | sudo tee /mnt/dados/arquivo.txt\nsudo umount /mnt/dados\nls /mnt/dados\nsudo mount /dev/vdb1 /mnt/dados\ncat /mnt/dados/arquivo.txt\ncd /mnt/dados\nsudo umount /mnt/dados\ncd ~\nsudo umount /mnt/dados\nsudo mount /dev/vdb1 /mnt/dados</pre></div>',
        check: async (ctx) => {
          const p1 = particao(ctx, 'vdb1');
          if (!p1 || !p1.fstype) return { ok: false, msg: 'Prepare antes o <code>/dev/vdb1</code> (aula 11.2): particionar e formatar.' };
          return LX.H.checkAll([
            [() => H.usedCommand(ctx, /mount\s+\/dev\/vdb1/), 'Monte a partição com <code>sudo mount /dev/vdb1 /mnt/dados</code>.'],
            [() => H.usedCommand(ctx, /umount/), 'Desmonte ao menos uma vez para ver os arquivos "sumirem".'],
            [!!montagem(ctx, '/mnt/dados'), 'Ao final, a partição deve estar montada em <code>/mnt/dados</code>.'],
            [() => { const c = H.read(ctx, '/mnt/dados/arquivo.txt'); return c !== null && /dados importantes/.test(c); }, 'Grave o arquivo <code>/mnt/dados/arquivo.txt</code> e confirme que ele sobrevive à desmontagem.']
          ]);
        }
      },
      {
        id: 't11-3-q', kind: 'quiz', title: 'Conceito: os arquivos que sumiram',
        body: [
          { p: 'Um servidor tinha 40 GB de logs em <code>/var/log</code>. Para dar espaço, o administrador adicionou um disco, formatou e montou em <code>/var/log</code>. Depois da montagem, <code>ls /var/log</code> mostra apenas <code>lost+found</code>. O que aconteceu com os 40 GB?' }
        ],
        options: [
          { text: 'Continuam intactos no disco antigo, <strong>escondidos</strong> embaixo do ponto de montagem — voltam a aparecer se ele for desmontado.', correct: true },
          { text: 'Foram apagados pela formatação do disco novo.', why: 'A formatação foi na partição nova; ela não toca no disco antigo.' },
          { text: 'Foram movidos automaticamente para a partição nova.', why: 'Montar não copia nada; apenas troca o que aparece naquele caminho.' },
          { text: 'Estão em <code>lost+found</code>.', why: 'O <code>lost+found</code> é um diretório vazio criado pelo ext4 na formatação.' }
        ],
        explain: 'O procedimento correto é: montar a partição nova em um caminho temporário (<code>/mnt/novo</code>), copiar preservando permissões (<code>sudo rsync -aHAX /var/log/ /mnt/novo/</code>), parar os serviços que escrevem lá, desmontar, e só então montar em <code>/var/log</code>. Depois de tudo funcionando, o espaço antigo pode ser recuperado.'
      },
      {
        id: 't11-3-b', kind: 'desafio', title: 'Área de uploads endurecida',
        body: [
          { p: 'Prepare um ponto de montagem para receber arquivos enviados por usuários — onde nada pode ser executado.' },
          { p: 'Se o disco ainda não estiver pronto:' },
          {
            code: [
              '$ sudo parted -s /dev/vdb mklabel gpt',
              '$ sudo parted -s /dev/vdb mkpart dados ext4 0% 100%',
              '$ sudo mkfs.ext4 -L DADOS /dev/vdb1'
            ]
          },
          { p: 'Requisitos do estado final:' },
          {
            ul: [
              'a partição <code>/dev/vdb1</code> (formatada em ext4) montada em <code>/srv/uploads</code>;',
              'a montagem deve usar as opções <code>noexec</code>, <code>nosuid</code> e <code>nodev</code>;',
              'o diretório montado pertence a <code>root</code> e ao grupo <code>www-data</code>, com modo <code>770</code>;',
              'dentro dele, um arquivo <code>/srv/uploads/README.txt</code> com qualquer conteúdo.'
            ]
          },
          { p: 'Se a partição já estiver montada em outro lugar, desmonte antes.' }
        ],
        hints: [
          'As opções de montagem vão em <code>-o</code>, separadas por vírgula: <code>mount -o noexec,nosuid,nodev ...</code>.',
          'O ponto de montagem precisa existir antes: <code>sudo mkdir -p /srv/uploads</code>.',
          'Dono e permissões se ajustam <strong>depois</strong> de montar — antes disso você estaria mexendo no diretório de baixo, não na partição.'
        ],
        solution: '<div class="code"><pre>sudo umount /mnt/dados 2&gt;/dev/null\nsudo mkdir -p /srv/uploads\nsudo mount -o noexec,nosuid,nodev /dev/vdb1 /srv/uploads\nsudo chown root:www-data /srv/uploads\nsudo chmod 770 /srv/uploads\necho "area de uploads" | sudo tee /srv/uploads/README.txt &gt; /dev/null\nfindmnt /srv/uploads\nls -ld /srv/uploads</pre></div><p style="margin-top:8px">A dupla <code>noexec</code> + permissão restrita é a defesa padrão contra upload malicioso: mesmo que alguém consiga gravar um script ali, o kernel se recusa a executá-lo.</p>',
        check: async (ctx) => {
          const m = montagem(ctx, '/srv/uploads');
          if (!m) return { ok: false, msg: 'A partição ainda não está montada em <code>/srv/uploads</code>.' };
          const modo = H.mode(ctx, '/srv/uploads');
          const dono = H.owner(ctx, '/srv/uploads');
          return LX.H.checkAll([
            [m.dev === '/dev/vdb1', `A montagem deve usar <code>/dev/vdb1</code>; está usando <code>${m.dev}</code>.`],
            [/noexec/.test(m.opts), `Falta a opção <code>noexec</code>. Opções atuais: ${m.opts}.`],
            [/nosuid/.test(m.opts), `Falta a opção <code>nosuid</code>. Opções atuais: ${m.opts}.`],
            [/nodev/.test(m.opts), `Falta a opção <code>nodev</code>. Opções atuais: ${m.opts}.`],
            [dono.user === 'root' && dono.group === 'www-data', `O diretório deve pertencer a <code>root:www-data</code>; está <code>${dono.user}:${dono.group}</code>.`],
            [modo === 0o770, `O modo deve ser <code>770</code>; está ${modo.toString(8)}.`],
            [H.exists(ctx, '/srv/uploads/README.txt'), 'Crie o arquivo <code>/srv/uploads/README.txt</code> dentro da partição montada.']
          ]);
        }
      }
    ]
  });

  /* ============================== 11.4 ============================== */
  LX.lesson('m11', {
    id: 'l11-4', n: '11.4', title: 'fstab: montar no boot',
    goal: 'Tornar uma montagem permanente sem correr o risco de deixar a máquina sem subir.',
    body: [
      { p: 'Tudo que você montou até aqui desaparece no próximo reboot. O <code>/etc/fstab</code> é a lista do que o sistema monta sozinho ao iniciar.' },
      { code: ['$ cat /etc/fstab'] },
      {
        ascii: `UUID=8f3b1c02-...  /          ext4  errors=remount-ro  0  1
└──────┬───────┘   └──┬───┘  └─┬┘  └───────┬────────┘  │  │
       │              │        │           │           │  └─ ordem do fsck
       │              │        │           │           │     0=não checa 1=raiz 2=demais
       │              │        │           │           └──── dump (praticamente sempre 0)
       │              │        │           └──────────────── opções de montagem
       │              │        └──────────────────────────── tipo do sistema de arquivos
       │              └───────────────────────────────────── ponto de montagem
       └──────────────────────────────────────────────────── o que montar`
      },
      {
        box: 'key', label: 'Por que UUID e não /dev/sdb1', body: [
          { p: 'Nomes de dispositivo dependem da ordem de detecção: acrescente um disco, troque uma controladora, e o <code>sdb</code> de ontem vira o <code>sdc</code> de hoje. O <code>fstab</code> apontaria para o disco errado — ou para nenhum, e a máquina não sobe.' },
          { p: 'O UUID é gravado <em>dentro</em> do sistema de arquivos, na formatação, e acompanha a partição para sempre. Alternativa aceitável: <code>LABEL=</code>.' }
        ]
      },
      { code: ['$ sudo blkid | tail -2', '$ lsblk -f'] },

      { h2: 'Acrescentar uma entrada com segurança' },
      {
        code: [
          '$ sudo cp /etc/fstab /etc/fstab.bak',
          '$ UUID=$(sudo blkid -s UUID -o value /dev/vdc1)',
          '$ echo "UUID=$UUID /mnt/dados ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab',
          '$ cat /etc/fstab | tail -2'
        ]
      },
      { p: 'E o teste que <strong>não pode ser pulado</strong>:' },
      { code: ['$ sudo umount /mnt/dados 2>/dev/null; sudo mount -a', '$ findmnt /mnt/dados', '$ df -h /mnt/dados'] },
      {
        box: 'warn', label: 'A regra que evita servidor que não sobe', body: [
          { p: 'Uma linha errada no <code>fstab</code> pode <strong>impedir o boot</strong>: o systemd espera pela montagem, falha, e cai em modo de emergência pedindo a senha do root — em um servidor remoto, isso significa console do provedor.' },
          { p: 'Duas proteções sempre:' },
          { ol: [
            '<strong>teste com <code>sudo mount -a</code></strong> antes de reiniciar. Se não der erro, o boot também não dará;',
            '<strong>use <code>nofail</code></strong> nas montagens que não são essenciais: se o disco não estiver lá, o sistema sobe assim mesmo em vez de travar.'
          ] }
        ]
      },
      {
        table: {
          head: ['Opção do fstab', 'Para quê'],
          rows: [
            ['<code>defaults</code>', 'o conjunto padrão (<code>rw,suid,dev,exec,auto,nouser,async</code>)'],
            ['<code>nofail</code>', '<strong>não trava o boot</strong> se o dispositivo faltar'],
            ['<code>noauto</code>', 'não monta no boot — só quando alguém pedir'],
            ['<code>x-systemd.automount</code>', 'monta na primeira vez que alguém acessar o caminho'],
            ['<code>noexec,nosuid,nodev</code>', 'endurecimento para partições de dados'],
            ['<code>noatime</code>', 'menos escrita em disco']
          ]
        }
      },
      {
        box: 'tip', body: [
          { p: 'Em máquinas com systemd, cada linha do <code>fstab</code> vira uma unit <code>.mount</code> automaticamente. Isso significa que <code>systemctl status mnt-dados.mount</code> e <code>journalctl -u mnt-dados.mount</code> mostram por que uma montagem falhou — muito mais informativo que a mensagem do <code>mount</code>.' }
        ]
      },

      { h2: 'Swap, de passagem' },
      { p: 'A área de troca também aparece no <code>fstab</code>, com ponto de montagem <code>none</code> e tipo <code>swap</code>. Hoje ela costuma ser um <strong>arquivo</strong> (<code>/swap.img</code>), não uma partição — mais fácil de redimensionar.' },
      { code: ['$ grep swap /etc/fstab', '$ free -h | tail -1'] }
    ],
    tasks: [
      {
        id: 't11-4-a', kind: 'guiado', title: 'Torne a montagem permanente',
        body: [
          { p: 'Descubra o UUID, acrescente a linha, teste com <code>mount -a</code>.' },
          { p: 'Garanta primeiro que a partição existe e está formatada:' },
          {
            code: [
              '$ sudo parted -s /dev/vdc mklabel gpt',
              '$ sudo parted -s /dev/vdc mkpart dados ext4 0% 100%',
              '$ sudo mkfs.ext4 -L DADOS /dev/vdc1'
            ]
          },
          {
            code: [
              '$ cat /etc/fstab',
              '$ sudo blkid | grep vdc1',
              '$ sudo cp /etc/fstab /etc/fstab.bak',
              '$ sudo mkdir -p /mnt/dados'
            ]
          },
          {
            code: [
              '$ U=$(sudo blkid -s UUID -o value /dev/vdc1)',
              '$ echo "UUID=$U /mnt/dados ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab',
              '$ sudo umount /mnt/dados 2>/dev/null; sudo mount -a',
              '$ findmnt /mnt/dados'
            ]
          }
        ],
        hints: ['O <code>blkid -s UUID -o value /dev/vdc1</code> imprime só o UUID, sem aspas nem outros campos — ideal para usar dentro de <code>$( )</code>.'],
        solution: '<div class="code"><pre>sudo cp /etc/fstab /etc/fstab.bak\nsudo mkdir -p /mnt/dados\nU=$(sudo blkid -s UUID -o value /dev/vdc1)\necho "UUID=$U /mnt/dados ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab\nsudo umount /mnt/dados 2&gt;/dev/null\nsudo mount -a\nfindmnt /mnt/dados</pre></div>',
        check: async (ctx) => {
          const fstab = H.read(ctx, '/etc/fstab') || '';
          const p1 = particao(ctx, 'vdc1');
          if (!p1 || !p1.uuid) return { ok: false, msg: 'Prepare antes o <code>/dev/vdc1</code> (aulas 11.2 e 11.3).' };
          return LX.H.checkAll([
            [new RegExp(p1.uuid).test(fstab), 'Acrescente ao <code>/etc/fstab</code> uma linha com o UUID do <code>/dev/vdc1</code>.'],
            [/\/mnt\/dados/.test(fstab), 'A linha deve montar em <code>/mnt/dados</code>.'],
            [() => H.usedCommand(ctx, /mount\s+-a/), 'Teste a configuração com <code>sudo mount -a</code> — o passo que evita um servidor que não sobe.'],
            [!!montagem(ctx, '/mnt/dados'), 'Depois do <code>mount -a</code>, a partição deveria estar montada em <code>/mnt/dados</code>.']
          ]);
        }
      },
      {
        id: 't11-4-q', kind: 'quiz', title: 'Conceito: o servidor que não sobe',
        body: [
          { p: 'Um servidor de produção não reinicia: fica em modo de emergência pedindo a senha do root. A última alteração foi acrescentar um disco de backup ao <code>/etc/fstab</code>. O disco está em manutenção e foi removido fisicamente. Qual opção teria evitado o problema?' }
        ],
        options: [
          { text: '<code>nofail</code> — o sistema sobe normalmente mesmo se o dispositivo não estiver presente.', correct: true },
          { text: '<code>noauto</code> — não montaria nunca, o que resolve o boot.', why: 'Resolve o boot, mas nunca monta sozinho, nem quando o disco está presente. O <code>nofail</code> é o meio-termo correto.' },
          { text: '<code>ro</code> — montar em somente leitura evita a falha.', why: 'O problema não é escrita; é o dispositivo ausente.' },
          { text: 'Usar <code>/dev/sdc1</code> em vez do UUID.', why: 'Piora: o nome do dispositivo é ainda mais instável que o UUID.' }
        ],
        explain: 'A combinação recomendada para volumes secundários é <code>defaults,nofail,x-systemd.device-timeout=10</code>: se o disco não aparecer em 10 segundos, o boot continua sem ele. Para volumes essenciais, o comportamento de travar é <em>desejado</em> — melhor não subir do que subir sem os dados.'
      },
      {
        id: 't11-4-b', kind: 'desafio', title: 'Volume de dados permanente e endurecido',
        body: [
          { p: 'Coloque o disco <code>/dev/vdc</code> em produção do jeito completo, do zero ao fstab.' },
          { p: 'Estado final exigido:' },
          {
            ul: [
              'o disco <code>vdc</code> com tabela <strong>gpt</strong> e uma partição <code>vdc1</code>;',
              'a partição formatada em <strong>ext4</strong> com rótulo <strong><code>APPDATA</code></strong>;',
              'montada em <code>/srv/appdata</code>, com as opções <code>noexec</code> e <code>nosuid</code>;',
              'uma entrada no <code>/etc/fstab</code> referenciando a partição <strong>por UUID</strong> (não por <code>/dev/vdc1</code>), com <code>nofail</code>, montando em <code>/srv/appdata</code>;',
              'a montagem atual precisa ter vindo do próprio <code>fstab</code> — ou seja, funcionar com <code>sudo mount -a</code>;',
              'um arquivo <code>/srv/appdata/ok.txt</code> dentro da partição.'
            ]
          },
          { p: 'Se você já montou o <code>vdc1</code> em outro lugar nas aulas anteriores, desmonte antes de recomeçar.' }
        ],
        hints: [
          'A ordem completa é: mklabel → mkpart → mkfs (com <code>-L</code>) → mkdir → linha no fstab → <code>mount -a</code>.',
          'Pegue só o UUID com <code>sudo blkid -s UUID -o value /dev/vdc1</code>. Formatar de novo gera um UUID <strong>novo</strong> — por isso o fstab vem depois do mkfs.',
          'Para o teste valer, desmonte tudo e monte pelo fstab: <code>sudo umount /srv/appdata; sudo mount -a</code>.'
        ],
        solution: '<div class="code"><pre>sudo umount /mnt/dados 2&gt;/dev/null\nsudo parted -s /dev/vdc mklabel gpt\nsudo parted -s /dev/vdc mkpart appdata ext4 0% 100%\nsudo mkfs.ext4 -L APPDATA /dev/vdc1\n\nsudo mkdir -p /srv/appdata\nU=$(sudo blkid -s UUID -o value /dev/vdc1)\necho "UUID=$U /srv/appdata ext4 defaults,nofail,noexec,nosuid 0 2" | sudo tee -a /etc/fstab\n\nsudo mount -a\nfindmnt /srv/appdata\necho ok | sudo tee /srv/appdata/ok.txt &gt; /dev/null\nlsblk -f</pre></div><p style="margin-top:8px">Esse é o roteiro inteiro de "adicionaram um disco no servidor": particionar, formatar com rótulo, montar por UUID com as opções certas e testar com <code>mount -a</code> antes de confiar no próximo boot.</p>',
        check: async (ctx) => {
          const d = disco(ctx, 'vdc');
          const p1 = particao(ctx, 'vdc1');
          const fstab = H.read(ctx, '/etc/fstab') || '';
          const m = montagem(ctx, '/srv/appdata');
          if (!p1) return { ok: false, msg: 'A partição <code>/dev/vdc1</code> ainda não existe.' };
          const linha = fstab.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean)
            .find(l => l.split(/\s+/)[1] === '/srv/appdata');
          return LX.H.checkAll([
            [d && d.tabela === 'gpt', 'O disco <code>vdc</code> deve ter tabela <code>gpt</code>.'],
            [p1.fstype === 'ext4', 'A partição deve estar formatada em <code>ext4</code>.'],
            [p1.label === 'APPDATA', `O rótulo deve ser <code>APPDATA</code>; está "${p1.label || '(nenhum)'}" — use <code>mkfs.ext4 -L APPDATA</code>.`],
            [!!linha, 'Falta a linha no <code>/etc/fstab</code> montando em <code>/srv/appdata</code>.'],
            [!!linha && /^UUID=/.test(linha), `A linha do fstab deve referenciar a partição por <strong>UUID</strong>, não por caminho de dispositivo. Linha atual: "${linha}".`],
            [!!linha && linha.startsWith('UUID=' + p1.uuid), 'O UUID no fstab não é o da partição atual — se você reformatou depois de escrever a linha, o UUID mudou.'],
            [!!linha && /nofail/.test(linha), 'A linha do fstab precisa da opção <code>nofail</code>.'],
            [!!m, 'A partição não está montada em <code>/srv/appdata</code>. Teste com <code>sudo mount -a</code>.'],
            [!!m && /noexec/.test(m.opts) && /nosuid/.test(m.opts), `A montagem precisa das opções <code>noexec</code> e <code>nosuid</code>. Atuais: ${m ? m.opts : ''}.`],
            [H.exists(ctx, '/srv/appdata/ok.txt'), 'Crie o arquivo <code>/srv/appdata/ok.txt</code> dentro da partição montada.'],
            [() => H.usedCommand(ctx, /mount\s+-a/), 'Comprove que o fstab funciona com <code>sudo mount -a</code>.']
          ]);
        }
      }
    ]
  });

  /* ============================== 11.5 ============================== */
  LX.lesson('m11', {
    id: 'l11-5', n: '11.5', title: 'Espaço, inodes e links',
    goal: 'Achar o que está ocupando o disco, entender por que ele pode encher sem estar cheio, e dominar os dois tipos de link.',
    body: [
      { h2: 'Quem está ocupando o disco' },
      { cmd: 'du' },
      { p: 'O <code>df</code> diz <em>quanto</em>; o <code>du</code> diz <em>onde</em>.' },
      {
        code: [
          '$ df -h',
          '$ sudo du -sh /var/* 2>/dev/null | sort -rh | head -8',
          '$ du -sh ~/* 2>/dev/null | sort -rh | head -5'
        ]
      },
      { p: 'O padrão de investigação é descer nível a nível: rode no topo, escolha o maior, entre nele e repita. Em três ou quatro passos você chega ao culpado.' },
      {
        cheat: [
          ['<code>du -sh DIR</code>', 'total do diretório'],
          ['<code>du -sh * | sort -rh | head</code>', 'os maiores itens aqui'],
          ['<code>du -h --max-depth=1 /var</code>', 'um nível abaixo'],
          ['<code>du -x</code>', 'não atravessa para outros sistemas de arquivos'],
          ['<code>find / -size +500M -type f 2>/dev/null</code>', 'arquivos gigantes, onde quer que estejam'],
          ['<code>ncdu /var</code>', 'navegador interativo (pacote <code>ncdu</code>)']
        ]
      },
      {
        box: 'key', label: 'Os três "disco cheio" que não são disco cheio', body: [
          { ol: [
            '<strong>inodes esgotados</strong> — <code>df -i</code> mostra <code>IUse%</code> em 100% com espaço sobrando. Causa: milhões de arquivos minúsculos (sessões, cache, filas de e-mail).',
            '<strong>arquivo apagado ainda aberto</strong> — você apagou um log de 20 GB e o espaço não voltou. <code>sudo lsof | grep deleted</code>; a solução é reiniciar o serviço dono.',
            '<strong>espaço reservado ao root</strong> — 5% do ext4 fica reservado; usuário comum vê "cheio" antes do fim real.'
          ] }
        ]
      },
      { code: ['$ df -i', '$ df -h /'] },

      { h2: 'Inodes: o que realmente é um arquivo' },
      { p: 'O <strong>inode</strong> guarda tudo sobre um arquivo — tipo, permissões, dono, datas, tamanho e onde estão os blocos de dados. Uma coisa ele <em>não</em> guarda: <strong>o nome</strong>. O nome vive no diretório, apontando para o número do inode.' },
      { code: ['$ ls -i ~/documentos', '$ stat ~/documentos/notas.txt | head -5', '$ stat -f / | head -5'] },
      {
        ascii: `  DIRETÓRIO                    INODE 335              BLOCOS
  ┌───────────────┐          ┌──────────────┐      ┌────────┐
  │ notas.txt →335│─────────▶│ modo, dono   │─────▶│ dados  │
  │ copia.txt →335│─────────▶│ datas, nlink │      └────────┘
  └───────────────┘          │ blocos       │
     (dois nomes)            └──────────────┘
                              nlink = 2`
      },

      { h2: 'Hard link × link simbólico' },
      { cmd: 'ln' },
      {
        table: {
          head: ['', 'hard link (<code>ln</code>)', 'link simbólico (<code>ln -s</code>)'],
          rows: [
            ['O que é', 'outro <strong>nome</strong> para o mesmo inode', 'um arquivo que contém <strong>um caminho</strong>'],
            ['Apagar o original', 'o conteúdo continua acessível', '<strong>quebra</strong> (dangling)'],
            ['Atravessa partições', 'não', 'sim'],
            ['Aponta para diretório', 'não (proibido)', 'sim'],
            ['Aparece no <code>ls -l</code>', 'igual a um arquivo comum', '<code>l</code> no início e <code>-&gt;</code> no fim'],
            ['Conta em <code>nlink</code>', 'sim', 'não']
          ]
        }
      },
      {
        code: [
          '$ cd ~ && echo "original" > alvo.txt',
          '$ ln alvo.txt duro.txt',
          '$ ln -s alvo.txt simbolico.txt',
          '$ ls -li alvo.txt duro.txt simbolico.txt',
          '$ rm alvo.txt',
          '$ cat duro.txt',
          '$ cat simbolico.txt'
        ]
      },
      { p: 'Repare no resultado: o hard link continua funcionando (o inode só é liberado quando o último nome some) e o link simbólico virou um ponteiro para o nada.' },
      {
        box: 'tip', body: [
          { p: 'Links simbólicos são o mecanismo por trás de meia infraestrutura Linux: <code>/etc/systemd/system/*.wants/</code> (módulo 8), alternativas de pacotes (<code>update-alternatives</code>), e o clássico <code>/usr/bin/python3 → python3.13</code>. Reconhecer um link quebrado no <code>ls -l</code> é uma habilidade prática de diagnóstico.' }
        ]
      },
      { code: ['$ ls -l /usr/bin/python3 2>/dev/null || echo "(sem python aqui)"', '$ find ~ -xtype l 2>/dev/null | head -3'] }
    ],
    tasks: [
      {
        id: 't11-5-a', kind: 'guiado', title: 'Links, inodes e espaço',
        body: [
          { p: 'Veja o inode compartilhado e a diferença entre os dois links.' },
          {
            code: [
              '$ cd ~ && echo "original" > alvo.txt',
              '$ ln alvo.txt duro.txt',
              '$ ln -s alvo.txt simbolico.txt',
              '$ ls -li alvo.txt duro.txt simbolico.txt',
              '$ rm alvo.txt',
              '$ cat duro.txt',
              '$ cat simbolico.txt',
              '$ ls -l simbolico.txt'
            ]
          },
          { p: 'Agora a investigação de espaço:' },
          { code: ['$ df -h', '$ df -i', '$ sudo du -sh /var/* 2>/dev/null | sort -rh | head -5'] }
        ],
        hints: ['O <code>ls -li</code> mostra o número do inode na primeira coluna — compare os três.'],
        solution: '<div class="code"><pre>cd ~ &amp;&amp; echo "original" &gt; alvo.txt\nln alvo.txt duro.txt\nln -s alvo.txt simbolico.txt\nls -li alvo.txt duro.txt simbolico.txt\nrm alvo.txt\ncat duro.txt\ncat simbolico.txt\nls -l simbolico.txt\ndf -h\ndf -i\nsudo du -sh /var/* 2&gt;/dev/null | sort -rh | head -5</pre></div>',
        check: async (ctx) => {
          const duro = H.lstat(ctx, '/home/aluno/duro.txt');
          const sim = H.lstat(ctx, '/home/aluno/simbolico.txt');
          return LX.H.checkAll([
            [!!duro, 'Crie o hard link <code>~/duro.txt</code> com <code>ln alvo.txt duro.txt</code>.'],
            [!!sim, 'Crie o link simbólico <code>~/simbolico.txt</code> com <code>ln -s</code>.'],
            [!!sim && sim.type === 'link', 'O <code>simbolico.txt</code> deve ser um link simbólico (<code>ln -s</code>).'],
            [!H.exists(ctx, '/home/aluno/alvo.txt'), 'Apague o <code>alvo.txt</code> para ver o que acontece com cada link.'],
            [() => { const c = H.read(ctx, '/home/aluno/duro.txt'); return c !== null && /original/.test(c); }, 'O hard link deveria continuar com o conteúdo mesmo depois de apagar o original.'],
            [() => H.usedCommand(ctx, /df\s+-i/), 'Consulte também os inodes com <code>df -i</code>.'],
            [() => H.usedCommand(ctx, /du\s+-/), 'Investigue o uso de espaço com <code>du</code>.']
          ]);
        }
      },
      {
        id: 't11-5-q', kind: 'quiz', title: 'Preveja o resultado',
        body: [
          { p: 'Você executa:' },
          {
            code: [
              'echo "dados" > a.txt',
              'ln a.txt b.txt',
              'ln -s a.txt c.txt',
              'rm a.txt',
              'cat b.txt',
              'cat c.txt'
            ], run: false, mixed: false
          },
          { p: 'O que sai nas duas últimas linhas?' }
        ],
        options: [
          { text: '<code>cat b.txt</code> mostra "dados"; <code>cat c.txt</code> falha com <code>No such file or directory</code>.', correct: true },
          { text: 'Os dois mostram "dados": links preservam o conteúdo.', why: 'O link simbólico guarda apenas o <em>caminho</em> <code>a.txt</code>, que deixou de existir.' },
          { text: 'Os dois falham: apagar o original destrói o conteúdo.', why: 'O hard link é um nome adicional para o mesmo inode; o conteúdo sobrevive enquanto houver ao menos um nome.' },
          { text: '<code>b.txt</code> falha e <code>c.txt</code> funciona.', why: 'É o contrário: o hard link é que sobrevive.' }
        ],
        explain: 'O contador <code>nlink</code> (segunda coluna do <code>ls -l</code>) é o número de nomes apontando para o inode. O <code>rm</code> remove um nome e decrementa o contador; os dados só são liberados quando ele chega a zero <em>e</em> nenhum processo mantém o arquivo aberto — o que explica também o "arquivo apagado que não libera espaço" do módulo 7.'
      },
      {
        id: 't11-5-b', kind: 'desafio', title: 'Caça ao espaço',
        body: [
          { p: 'Monte o cenário de um diretório que cresceu demais:' },
          {
            code: [
              '$ rm -rf ~/analise && mkdir -p ~/analise/logs ~/analise/cache ~/analise/docs',
              '$ dd if=/dev/zero of=$HOME/analise/logs/log1.txt bs=1M count=8 status=none',
              '$ dd if=/dev/zero of=$HOME/analise/logs/log2.txt bs=1M count=4 status=none',
              '$ dd if=/dev/zero of=$HOME/analise/cache/c1.bin bs=1M count=2 status=none',
              '$ echo "documento" > ~/analise/docs/leia.txt',
              '$ du -sh ~/analise/*'
            ]
          },
          { p: 'Produza <code>~/maiores.txt</code> com os subdiretórios de <code>~/analise</code> ordenados <strong>do maior para o menor</strong>, um por linha, no formato do <code>du -sh</code> (tamanho, TAB, caminho).' },
          { p: 'Devem aparecer exatamente três linhas, e a primeira precisa ser a de <code>logs</code>.' }
        ],
        hints: [
          'O <code>du -sh DIR/*</code> mede cada item de primeiro nível.',
          'Ordenar tamanhos legíveis (K, M, G) corretamente exige <code>sort -h</code>; para decrescente, <code>-rh</code>.',
          '<code>du -sh ~/analise/* | sort -rh &gt; ~/maiores.txt</code>'
        ],
        solution: '<div class="code"><pre>du -sh ~/analise/* | sort -rh &gt; ~/maiores.txt\ncat ~/maiores.txt</pre></div><p style="margin-top:8px">Esse é literalmente o comando que você vai rodar quando um servidor avisar "disco em 95%": comece na raiz, ordene, entre no maior e repita.</p>',
        forja: ["mkdir -p ~/analise", "printf '4,0K\\t/home/aluno/analise/logs\\n2,0K\\t/home/aluno/analise/cache\\n1,0K\\t/home/aluno/analise/docs\\n' > ~/maiores.txt"],
        check: async (ctx) => {
          const c = H.read(ctx, '/home/aluno/maiores.txt');
          if (c === null) return { ok: false, msg: 'O arquivo <code>~/maiores.txt</code> ainda não existe.' };
          const linhas = c.split('\n').filter(l => l.trim());
          const nomes = linhas.map(l => l.trim().split(/\s+/).pop());
          const medido = ctx.run ? (await ctx.run('du -sh ~/analise/* | sort -rh')).out : null;
          return LX.H.checkAll([
            [H.isDir(ctx, '/home/aluno/analise/logs'), 'Monte o cenário do enunciado primeiro.'],
            [linhas.length === 3, `O arquivo deve ter exatamente 3 linhas (uma por subdiretório); tem ${linhas.length}.`],
            [linhas.every(l => /^\s*[\d.,]+[KMG]?\s/.test(l)), 'Cada linha deve começar com o tamanho legível — use <code>du -sh</code>.'],
            [nomes.every(n => /analise\/(logs|cache|docs)$/.test(n)), 'As linhas devem se referir aos três subdiretórios de <code>~/analise</code>.'],
            [/logs$/.test(nomes[0] || ''), () => `A primeira linha deve ser a de <code>logs</code> (o maior). Está: "${nomes[0]}". Ordene com <code>sort -rh</code>.`],
            [/docs$/.test(nomes[2] || ''), 'A última linha deve ser a de <code>docs</code> (o menor).'],
            /* o verificador mede de novo e compara: número digitado à mão não passa */
            [() => {
              const real = (medido || '').split('\n').filter(x => x.trim())
                .map(x => x.trim().split(/\s+/)[0]);
              const dito = linhas.map(x => x.trim().split(/\s+/)[0]);
              return real.length === dito.length && real.every((v, i) => v === dito[i]);
            }, 'Os tamanhos do arquivo não batem com os que o <code>du</code> mede agora. Eles precisam vir do comando, não da sua leitura do enunciado.'],
            [() => H.usedCommand(ctx, /sort\s+-[a-z]*r[a-z]*h|sort\s+-[a-z]*h[a-z]*r/), 'Use <code>sort -rh</code> para ordenar tamanhos legíveis em ordem decrescente.']
          ]);
        }
      }
    ]
  });

})();
