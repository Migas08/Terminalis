/* =========================================================================
   TERMINALIS V2 — tecnologias disponíveis e planejadas
   ========================================================================= */
'use strict';
(function () {
  const technologies = [
    ['linux', 'Linux', 'Sistemas, shell, serviços e administração.', 'available'],
    ['docker', 'Docker', 'Containers, imagens, Compose e operação.', 'available'],
    ['git', 'Git', 'Versionamento, branches, conflitos e recuperação.', 'available'],
    ['github', 'GitHub', 'Colaboração, pull requests, issues e automação.', 'available'],
    ['javascript', 'JavaScript', 'Linguagem, browser, Node.js e APIs.', 'planned'],
    ['typescript', 'TypeScript', 'Modelagem de tipos e aplicações seguras.', 'planned'],
    ['python', 'Python', 'Programação, scripts e automação.', 'planned'],
    ['java', 'Java', 'Aplicações, orientação a objetos e ecossistema.', 'planned'],
    ['c', 'C', 'Fundamentos de baixo nível e memória.', 'planned'],
    ['csharp', 'C#', 'Aplicações modernas no ecossistema .NET.', 'planned'],
    ['sql', 'SQL', 'Consultas, modelagem e desempenho.', 'planned'],
    ['databases', 'Banco de Dados', 'Operação, backup, restauração e diagnóstico.', 'planned'],
    ['networks', 'Redes', 'TCP/IP, DNS, roteamento e conectividade.', 'planned'],
    ['apis', 'APIs', 'HTTP, contratos, autenticação e integração.', 'planned'],
    ['backend', 'Backend', 'Serviços, persistência e arquitetura.', 'planned'],
    ['frontend', 'Frontend', 'Interfaces, estado, acessibilidade e performance.', 'planned'],
    ['devops', 'DevOps', 'Entrega, observabilidade e automação operacional.', 'planned'],
    ['troubleshooting', 'Troubleshooting', 'Investigação sistemática de falhas.', 'planned'],
    ['security', 'Segurança', 'Práticas defensivas e menor privilégio.', 'planned']
  ];
  technologies.forEach((item, index) => LX.technology({
    id: item[0], slug: item[0], name: item[1], description: item[2],
    status: item[3], order: index + 1, icon: item[0].slice(0, 2).toUpperCase()
  }));
})();
