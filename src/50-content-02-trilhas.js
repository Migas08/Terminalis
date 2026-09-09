/* =========================================================================
   TERMINALIS — trilhas de aprendizado
   A plataforma é multi-trilha: hoje Linux e Docker, com espaço para
   novas trilhas sem mexer na estrutura.
   ========================================================================= */
'use strict';
(function () {

  const SVG = {
    linux: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18.5c0-2 1.2-3.2 1.2-5.4C6.2 8.4 8 4 12 4s5.8 4.4 5.8 9.1c0 2.2 1.2 3.4 1.2 5.4 0 1.4-1.6 2-3.2 1.4-1 1-2.5 1.1-3.8 1.1s-2.8-.1-3.8-1.1C6.6 20.5 5 19.9 5 18.5z"/><circle cx="10.2" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="13.8" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M10.6 13.3c.5.6 2.3.6 2.8 0"/></svg>',
    docker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="11" width="3" height="3"/><rect x="6.5" y="11" width="3" height="3"/><rect x="10" y="11" width="3" height="3"/><rect x="13.5" y="11" width="3" height="3"/><rect x="6.5" y="7.6" width="3" height="3"/><rect x="10" y="7.6" width="3" height="3"/><rect x="10" y="4.2" width="3" height="3"/><path d="M2 15.5c0 3 2.4 4.8 6.4 4.8 5.6 0 9.4-2.6 10.6-6.6 1.4.5 2.6.2 3-1.2-1-.7-2.4-.7-3.4-.2"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3.5a5 5 0 0 0-5.9 6.6L3.6 16a2 2 0 1 0 2.8 2.8l5.9-5.9a5 5 0 0 0 6.6-5.9l-2.8 2.8-2.5-.7-.7-2.5z"/></svg>',
    git: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="6.5" cy="6" r="2.2"/><circle cx="6.5" cy="18" r="2.2"/><circle cx="17.5" cy="9" r="2.2"/><path d="M6.5 8.2v7.6M8.7 6.6c3.5.6 6.6 1 6.6 2.4M17.5 11.2c0 4.4-4.2 3.6-8.8 5.6"/></svg>',
    python: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3c-3 0-4 1.2-4 3v2h4.5v.8H6.5C4.6 8.8 3.5 10 3.5 13s1 4.2 2.5 4.2H8v-2.4c0-1.8 1.4-3.2 3.2-3.2h3.6c1.5 0 2.7-1.2 2.7-2.7V6C17.5 4.2 15.5 3 12 3z"/><path d="M12 21c3 0 4-1.2 4-3v-2h-4.5v-.8h6c1.9 0 3-1.2 3-4.2s-1-4.2-2.5-4.2H16v2.4c0 1.8-1.4 3.2-3.2 3.2H9.2c-1.5 0-2.7 1.2-2.7 2.7V18c0 1.8 2 3 5.5 3z"/></svg>',
    net: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 2.6 15 0 18M12 3c-2.6 2.6-2.6 15 0 18"/></svg>',
    db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4.5h9l-1.4 3.2L14 11H5z" fill="currentColor" fill-opacity=".18"/><path d="M14 6.5h5l-1.4 3.2L19 13h-5"/></svg>',
    k8s: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.6l8 3.8v7.2l-8 3.8-8-3.8V6.4z"/><circle cx="12" cy="10" r="2.4"/><path d="M12 2.6V7.6M19.2 6.9l-4.9 2.2M4.8 6.9l4.9 2.2M12 12.4v5.2M6 13.6l4.2-2M18 13.6l-4.2-2"/></svg>'
  };

  LX.TRILHAS = [
    {
      id: 'linux', nome: 'Linux e o terminal', icone: SVG.linux, cor: 'amber',
      resumo: 'Do primeiro comando à administração de um servidor de produção.',
      detalhe: 'Fundamentos, arquivos, texto, pipes, permissões, usuários, processos, serviços, redes, SSH, armazenamento, pacotes, ambiente, Bash scripting e administração.',
      nivel: 'Iniciante → avançado',
      mods: ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15', 'm16', 'm16d'],
      estado: 'disponivel',
      requer: [],
      objetivos: [
        'Navegar e trabalhar no terminal sem depender de interface gráfica',
        'Ler e transformar texto com grep, sed, awk e pipes',
        'Controlar permissões, usuários, processos e serviços',
        'Configurar rede, SSH, discos e pacotes em um servidor',
        'Escrever scripts em Bash e diagnosticar uma máquina quebrada'
      ],
      etapas: [
        { id: 'e1', nome: 'Fundamentos', resumo: 'Onde você está, como o sistema é organizado e como conversar com ele.', mods: ['m01', 'm02'] },
        { id: 'e2', nome: 'Texto, fluxo e permissões', resumo: 'Encontrar, transformar e proteger o que está dentro dos arquivos.', mods: ['m04', 'm03', 'm05'] },
        { id: 'e3', nome: 'O sistema vivo', resumo: 'Quem usa a máquina, o que está rodando nela e o que sobe no boot.', mods: ['m06', 'm07', 'm08'] },
        { id: 'e4', nome: 'Servidor conectado', resumo: 'Rede, acesso remoto, disco, pacotes e transporte de arquivos.', mods: ['m09', 'm10', 'm11', 'm12', 'm13'] },
        { id: 'e5', nome: 'Automação e operação', resumo: 'Ambiente, Bash, a rotina de quem administra e o método de diagnóstico.', mods: ['m14', 'm15', 'm16', 'm16d'] }
      ]
    },
    {
      id: 'pf-linux', nome: 'Projeto final de Linux', icone: SVG.flag, cor: 'green',
      resumo: 'Um servidor de produção inteiro, do zero, sem passo a passo — só o requisito.',
      detalhe: 'Você recebe a especificação de um servidor: contas e grupos, permissões do diretório compartilhado, um serviço systemd próprio, firewall, rotina de backup e relatório de verificação. Ninguém dita os comandos.',
      nivel: 'Fecha a trilha de Linux',
      mods: ['mpf1'],
      estado: 'disponivel',
      requer: [{ trilha: 'linux' }],
      objetivos: [
        'Entregar um servidor a partir de uma especificação escrita, sem passo a passo',
        'Combinar contas, permissões, serviços, rede, pacotes, backup e diagnóstico',
        'Provar cada requisito com saída de comando, e não com afirmação'
      ],
      etapas: [
        { id: 'p1', nome: 'A entrega', resumo: 'Um chamado real, dividido em partes, com critérios de aceite verificados na máquina.', mods: ['mpf1'] }
      ]
    },
    {
      id: 'docker', nome: 'Docker na prática', icone: SVG.docker, cor: 'blue',
      resumo: 'Do primeiro container à administração de uma stack em servidor Linux.',
      detalhe: 'Fundamentos, CLI, flags, imagens, Dockerfile, build, volumes, redes, YAML, Compose, ambiente e segredos, healthchecks, Traefik, HTTPS, segurança, limites, servidor, banco de dados e troubleshooting.',
      nivel: 'Requer Linux e o projeto final de Linux',
      mods: ['d01', 'd02', 'd03', 'd04', 'd05', 'd06', 'd07', 'd08', 'd09', 'd10', 'd11', 'd12',
        'd13', 'd14', 'd15', 'd16', 'd17', 'd18', 'd19', 'd20', 'd21', 'd22'],
      estado: 'disponivel',
      requer: [{ trilha: 'pf-linux' }],
      objetivos: [
        'Entender o que um container realmente é, por baixo dos comandos',
        'Rodar, investigar e depurar containers pelo terminal',
        'Escrever Dockerfiles e entender camadas, cache e multi-stage',
        'Guardar dados com volumes e ligar serviços com redes e DNS interno',
        'Montar ambientes completos com Compose, healthchecks e Traefik',
        'Administrar e atualizar uma stack em um servidor Linux por SSH',
        'Diagnosticar uma stack quebrada com método, do log até a correção'
      ],
      etapas: [
        { id: 'k1', nome: 'Fundamentos', resumo: 'O que é um container, e o que acontece por trás de cada comando.', mods: ['d01'] },
        { id: 'k2', nome: 'Containers', resumo: 'Criar, parar, entrar, investigar e entender cada flag do run.', mods: ['d02', 'd03', 'd04'] },
        { id: 'k3', nome: 'Imagens', resumo: 'Camadas, tags, digest, registries e o que "latest" não significa.', mods: ['d05'] },
        { id: 'k4', nome: 'Dockerfile', resumo: 'Escrever, construir, otimizar e chegar a uma imagem de produção.', mods: ['d06', 'd07'] },
        { id: 'k5', nome: 'Volumes', resumo: 'Onde os dados moram de verdade, e como sobrevivem ao container.', mods: ['d08'] },
        { id: 'k6', nome: 'Networks', resumo: 'Como um container fala com o outro, e por que às vezes não fala.', mods: ['d09'] },
        { id: 'k7', nome: 'Compose', resumo: 'YAML, compose.yaml, variáveis de ambiente, segredos e prontidão.', mods: ['d10', 'd11', 'd12', 'd13'] },
        { id: 'k8', nome: 'Traefik', resumo: 'Proxy reverso, roteamento por labels, dashboard e HTTPS.', mods: ['d14', 'd15', 'd16'] },
        { id: 'k9', nome: 'Operação', resumo: 'Segurança, limites de recursos, servidor, deploy e banco de dados.', mods: ['d17', 'd18', 'd19', 'd20'] },
        { id: 'k10', nome: 'Troubleshooting', resumo: 'Método de diagnóstico e ambientes quebrados para consertar.', mods: ['d21', 'd22'] }
      ]
    },
    {
      id: 'pf-docker', nome: 'Projeto final de Docker', icone: SVG.flag, cor: 'green',
      resumo: 'Um servidor de verdade, uma stack inteira e um problema que ninguém explica.',
      detalhe: 'Você recebe acesso SSH a um servidor com uma aplicação em vários containers. Precisa inspecionar a stack, fazer backup do banco, atualizar imagens, recriar os serviços, encontrar o defeito plantado e provar que voltou a funcionar.',
      nivel: 'Fecha a trilha de Docker',
      mods: ['mpf2'],
      estado: 'disponivel',
      requer: [{ trilha: 'docker' }],
      objetivos: [
        'Administrar uma aplicação Dockerizada em um servidor Linux, do SSH ao healthcheck',
        'Integrar Linux, SSH, Docker, Compose, MariaDB, redes, volumes e Traefik em uma entrega só',
        'Investigar e corrigir uma falha real sem receber a resposta pronta'
      ],
      etapas: [
        { id: 'q1', nome: 'A entrega', resumo: 'Um chamado de trabalho, dividido em partes, verificado no ambiente.', mods: ['mpf2'] }
      ]
    },
    {
      id: 'ops', nome: 'Troubleshooting e projetos', icone: SVG.wrench, cor: 'red',
      resumo: 'Ambientes quebrados para você investigar, e projetos que integram tudo.',
      detalhe: 'Método de diagnóstico que cruza Linux e Docker, cenários reais de falha e projetos que integram as duas trilhas até um ambiente operacional completo.',
      nivel: 'Depois de Linux e Docker',
      mods: ['m25', 'm26'],
      estado: 'disponivel',
      requer: [{ trilha: 'pf-docker' }],
      objetivos: [
        'Diagnosticar falhas em Linux e Docker com método, não por tentativa',
        'Entregar projetos que integram host e containers, até um ambiente operacional completo'
      ],
      etapas: [
        { id: 'o1', nome: 'Ambientes quebrados', resumo: 'Incidentes cuja causa cruza Linux e Docker, para você investigar.', mods: ['m25'] },
        { id: 'o2', nome: 'Projetos integrados', resumo: 'Projetos que juntam host e containers num ambiente operacional.', mods: ['m26'] }
      ]
    },
    { id: 'git', requer: [{ trilha: 'ops' }], nome: 'Git e fluxo de trabalho', icone: SVG.git, cor: 'amber', resumo: 'Versionamento, branches, merge, rebase e trabalho em equipe.', estado: 'planejado' },
    { id: 'py', requer: [{ trilha: 'git' }], nome: 'Python para automação', icone: SVG.python, cor: 'blue', resumo: 'Scripts que substituem tarefas repetitivas de infraestrutura.', estado: 'planejado' },
    { id: 'redes', requer: [{ trilha: 'ops' }], nome: 'Redes para quem opera', icone: SVG.net, cor: 'green', resumo: 'TCP/IP, DNS, TLS, proxies reversos e diagnóstico de conectividade.', estado: 'planejado' },
    { id: 'sql', requer: [{ trilha: 'redes' }], nome: 'SQL e bancos de dados', icone: SVG.db, cor: 'violet', resumo: 'Consultas, índices, backup e restauração no dia a dia de operação.', estado: 'planejado' },
    { id: 'k8s', requer: [{ trilha: 'pf-docker' }], nome: 'Kubernetes', icone: SVG.k8s, cor: 'blue', resumo: 'Pods, deployments, services e o passo seguinte ao Docker.', estado: 'planejado' }
  ];

  LX.trilhaDe = function (modId) {
    return LX.TRILHAS.find(t => (t.mods || []).includes(modId)) || null;
  };
  LX.trilhaPorId = function (id) { return LX.TRILHAS.find(t => t.id === id) || null; };
})();
