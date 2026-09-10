/* Adaptador do comando gh para o laboratório GitHub. */
'use strict';
(function () {
  const Git = LX.Git;
  const Github = LX.Github;

  function optionValue(args, option) {
    const index = args.indexOf(option);
    return index >= 0 ? args[index + 1] : undefined;
  }

  function resultOptions(args) {
    return {
      title: optionValue(args, '--title'),
      body: optionValue(args, '--body'),
      head: optionValue(args, '--head'),
      base: optionValue(args, '--base'),
      source: optionValue(args, '--source'),
      number: /^\d+$/.test(args[0]) ? +args[0] : 1,
      tag: args[0],
      notes: optionValue(args, '--notes'),
      label: optionValue(args, '--label'),
      assignee: optionValue(args, '--assignee'),
      milestone: optionValue(args, '--milestone'),
      requestChanges: args.includes('--request-changes')
    };
  }

  function authenticate(shell, operation, args) {
    if (operation === 'login') {
      Github.hub(shell.m).auth = {
        user: 'aluno',
        protocol: optionValue(args, '--git-protocol') || 'https'
      };
    } else if (operation !== 'status') Git.fail('Use gh auth login or status');

    return Github.hub(shell.m).auth
      ? 'Autenticado como aluno no laboratório local. Nenhuma credencial real utilizada.'
      : 'Não autenticado no laboratório.';
  }

  function createRepository(shell, args) {
    const repository = Github.create(shell.m, args[0], args.includes('--public') ? 'public' : 'private');
    repository.description = optionValue(args, '--description') || '';
    return repository;
  }

  function forkRepository(shell, args) {
    const source = Github.get(shell.m, args[0]);
    if (!source) Git.fail('Repository not found');
    const fork = Github.create(shell.m, 'aluno/' + source.name.split('/')[1], source.visibility);
    Object.assign(fork, {
      commits: Git.copy(source.commits),
      branches: Git.copy(source.branches),
      forkOf: source.name
    });
    return fork;
  }

  function listResources(repository, group) {
    const remote = Github.remoteFor(repository);
    if (group === 'issue') return remote.issues;
    if (group === 'pr') return remote.prs;
    if (group === 'release') return remote.releases;
    if (group === 'run') return remote.runs;
    return remote;
  }

  async function run({ sh, io, args }) {
    const commandArgs = args.slice();
    const group = commandArgs.shift();
    const operation = commandArgs.shift();

    try {
      let result;
      if (group === 'auth') result = authenticate(sh, operation, commandArgs);
      else if (group === 'repo' && operation === 'create') result = createRepository(sh, commandArgs);
      else if (group === 'repo' && operation === 'fork') result = forkRepository(sh, commandArgs);
      else {
        const repository = Git.Repo.find(sh);
        const listsResources = operation === 'list' || (group === 'repo' && operation === 'view');
        result = listsResources
          ? listResources(repository, group)
          : Github.action(repository, group, operation, resultOptions(commandArgs));
      }

      io.stdout.write((typeof result === 'string' ? result : JSON.stringify(result, null, 2)) + '\n');
      return 0;
    } catch (error) {
      io.stderr.write(error.message + '\n');
      return 1;
    }
  }

  LX.defcmd({
    name: 'gh',
    help: 'GitHub CLI educacional: auth login/status, repo create/view/fork, issue create/list, pr create/list/review/comment/merge/close, release create/list, run list.',
    run
  });
})();
