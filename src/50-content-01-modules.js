/* =========================================================================
   TERMINALIS — mapa dos módulos
   ========================================================================= */
'use strict';
(function () {
  const L = 'Linux', D = 'Docker', P = 'Projeto final', PF = 'Projeto final de Linux', PD = 'Projeto final de Docker', OP = 'Operação';

  const M = [
    ['m01', '01', L, 'Fundamentos', 'Kernel, distribuição, shell e a lógica do sistema de arquivos.'],
    ['m02', '02', L, 'Terminal e comandos básicos', 'Navegar, criar, copiar, mover, apagar e ler arquivos.'],
    ['m04', '03', L, 'Pipes e redirecionamentos', 'stdin, stdout, stderr e como os comandos se encaixam.'],
    ['m03', '04', L, 'Texto e busca', 'grep, find, sort, cut, tr, sed e awk — encontrar e transformar.'],
    ['m05', '05', L, 'Permissões', 'rwx, octal, dono, grupo, sudo, SUID, SGID e sticky bit.'],
    ['m06', '06', L, 'Usuários e grupos', '/etc/passwd, /etc/shadow, criação e administração de contas.'],
    ['m07', '07', L, 'Processos', 'PID, sinais, primeiro e segundo plano, ps, top e kill.'],
    ['m08', '08', L, 'Serviços e systemd', 'systemctl, journalctl, unidades, boot e diagnóstico.'],
    ['m09', '09', L, 'Redes', 'IP, CIDR, DNS, portas, TCP/UDP e as ferramentas do iproute2.'],
    ['m10', '10', L, 'SSH', 'Chaves, agente, config, scp e rsync — acesso remoto com segurança.'],
    ['m11', '11', L, 'Armazenamento', 'Discos, partições, filesystems, inodes, montagem e fstab.'],
    ['m12', '12', L, 'Pacotes', 'apt e dpkg: instalar, remover, investigar e manter repositórios.'],
    ['m13', '13', L, 'Compactação e arquivos', 'tar, gzip, zip — empacotar, transferir e restaurar.'],
    ['m14', '14', L, 'Variáveis e ambiente', 'PATH, HOME, export, .bashrc e o que o shell carrega.'],
    ['m15', '15', L, 'Bash scripting', 'Do shebang à automação com funções, testes e tratamento de erro.'],
    ['m16', '16', L, 'Administração de servidores', 'Rotina real: logs, monitoramento, firewall, backup e segurança.'],
    ['m16d', '17', L, 'Diagnóstico e troubleshooting', 'Método para investigar uma máquina que parou de funcionar, sem chutar.'],
    ['mpf1', 'PF', PF, 'Projeto final de Linux', 'Entregar um servidor inteiro: contas, permissões, serviço, firewall, backup e relatório.'],
    ['d01', '01', D, 'O que é Docker', 'O problema que os containers resolvem, e o que existe por baixo deles.'],
    ['d02', '02', D, 'Primeiros containers', 'Do docker run ao docker ps: o ciclo de vida, comando por comando.'],
    ['d03', '03', D, 'Investigar um container', 'logs, exec, inspect, top, diff, cp e port — olhar por dentro.'],
    ['d04', '04', D, 'As flags do docker run', 'Por que cada flag existe, quando usar e quando não usar.'],
    ['d05', '05', D, 'Imagens, camadas e registries', 'Tags, digest, latest, Docker Hub, push, pull e segurança.'],
    ['d06', '06', D, 'Dockerfile', 'Cada instrução, o que ela grava na imagem e as que se confundem.'],
    ['d07', '07', D, 'docker build', 'Contexto, .dockerignore, cache, build args, multi-stage e buildx.'],
    ['d08', '08', D, 'Volumes e persistência', 'Volumes, bind mounts, tmpfs, permissões, backup e restauração.'],
    ['d09', '09', D, 'Redes do Docker', 'Bridge, host, none, DNS interno, portas internas e publicadas.'],
    ['d10', '10', D, 'YAML sem decoreba', 'Indentação, listas, mapas e os erros que quebram um compose.'],
    ['d11', '11', D, 'Docker Compose', 'compose.yaml de ponta a ponta, com projetos progressivos.'],
    ['d12', '12', D, 'Ambiente e segredos', '.env, env_file, interpolação, dev vs produção e o que não vai para o Git.'],
    ['d13', '13', D, 'Healthcheck e dependências', 'Rodando não é pronto: readiness, depends_on e restart policies.'],
    ['d14', '14', D, 'Traefik: os conceitos', 'Proxy reverso, entryPoints, routers, middlewares, services e providers.'],
    ['d15', '15', D, 'Traefik na prática', 'Labels, descoberta automática, vários domínios e o dashboard.'],
    ['d16', '16', D, 'Traefik e HTTPS', 'TLS, Let\'s Encrypt, desafios ACME, redirect e ambiente local de teste.'],
    ['d17', '17', D, 'Segurança', 'Menor privilégio, não-root, capabilities, socket do Docker e imagens confiáveis.'],
    ['d18', '18', D, 'CPU, memória e disco', 'Limites, OOM, docker stats, cache, otimização de imagem e limpeza.'],
    ['d19', '19', D, 'Docker em servidor', 'SSH, scp, save/load, registry, deploy e atualização de stack.'],
    ['d20', '20', D, 'Banco de dados em container', 'Entrar, consultar, corrigir, fazer backup e restaurar.'],
    ['d21', '21', D, 'Troubleshooting', 'Método de diagnóstico e ambientes quebrados de propósito.'],
    ['d22', '22', D, 'Projetos progressivos', 'Seis projetos, do primeiro container ao ambiente quase de produção.'],
    ['mpf2', 'PF', PD, 'Projeto final de Docker', 'Um servidor recebido por SSH, uma stack inteira e um problema real para resolver.'],
    ['m25', '25', OP, 'Troubleshooting avançado', 'Cenários que cruzam Linux e Docker no mesmo incidente.'],
    ['m26', '26', OP, 'Projetos integrados', 'Projetos que juntam tudo o que foi aprendido.']
  ];

  for (const [id, num, group, title, blurb] of M) {
    LX.mod({ id, num, group, title, blurb });
  }
})();
