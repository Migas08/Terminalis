/* Estado e regras do laboratório GitHub. Nenhuma operação acessa a rede. */
'use strict';
(function () {
  const Git = LX.Git;
  const SAFE_CI_COMMANDS = ['test -f README.md', 'test -f index.html'];

  function hub(machine) {
    machine.gitHub ||= { repos: {}, auth: null };
    return machine.gitHub;
  }

  function repositoryName(url) {
    return String(url || '')
      .replace(/^https:\/\/github\.com\//, '')
      .replace(/^git@github\.com:/, '')
      .replace(/\.git$/, '');
  }

  function get(machine, url) {
    return hub(machine).repos[repositoryName(url)];
  }

  function create(machine, requestedName, visibility = 'private') {
    const name = repositoryName(requestedName);
    if (!/^[\w.-]+\/[\w.-]+$/.test(name)) Git.fail('Use owner/repository');
    if (get(machine, name)) Git.fail('Repository already exists');

    const repository = {
      name,
      visibility,
      description: '',
      defaultBranch: 'main',
      commits: {},
      branches: { main: null },
      tags: {},
      issues: [],
      prs: [],
      releases: [],
      runs: [],
      protected: false
    };
    hub(machine).repos[name] = repository;
    return repository;
  }

  function remoteFor(repository) {
    const remote = get(repository.sh.m, repository.d.remotes.origin);
    if (!remote) Git.fail('Configure origin with a repository created in the laboratory');
    return remote;
  }

  function evaluateCheck(command, tree) {
    if (command.endsWith('README.md')) return 'README.md' in tree;
    return 'index.html' in tree;
  }

  function runCI(remote, branch) {
    const commit = remote.branches[branch];
    const tree = remote.commits[commit]?.tree || {};

    for (const [path, text] of Object.entries(tree)) {
      if (!/^\.github\/workflows\/.*\.ya?ml$/.test(path)) continue;
      let status = 'failure';
      let reason = 'Workflow precisa de on, jobs e steps.';

      try {
        const workflow = LX.lerYaml(text);
        if (workflow.on && workflow.jobs) {
          const steps = Object.values(workflow.jobs).flatMap(job => job.steps || []);
          const checks = steps.filter(step => step.run);
          if (checks.length && checks.every(step => SAFE_CI_COMMANDS.includes(step.run))) {
            status = checks.every(step => evaluateCheck(step.run, tree)) ? 'success' : 'failure';
            reason = status === 'success'
              ? 'Arquivos necessários presentes.'
              : 'Arquivo necessário ausente.';
          } else {
            reason = 'Laboratório executa apenas test -f README.md e test -f index.html. Outros workflows podem ser estudados como texto.';
          }
        }
      } catch (error) {
        reason = error.message;
      }
      remote.runs.push({ path, commit, status, reason });
    }
  }

  function requireAuthentication(repository) {
    if (!hub(repository.sh.m).auth) {
      Git.fail('Authentication required in the laboratory: gh auth login');
    }
  }

  function push(repository, args, remoteName, branch, remote, output) {
    if (args.includes('--tags')) {
      remote.tags = Git.copy(repository.d.tags);
      Object.assign(remote.commits, Git.copy(repository.d.commits));
      output('Tags pushed (laboratório)');
      return 0;
    }

    const localCommit = repository.d.branches[branch];
    const remoteCommit = remote.branches[branch];
    if (remote.protected && branch === remote.defaultBranch) {
      Git.fail('Protected branch: use a reviewed Pull Request');
    }
    if (remoteCommit && !repository.ancestors(localCommit).includes(remoteCommit)) {
      Git.fail('! [rejected] non-fast-forward; fetch and integrate remote changes');
    }
    if (!localCommit) Git.fail('error: src refspec does not match any');

    Object.assign(remote.commits, Git.copy(repository.d.commits));
    remote.branches[branch] = localCommit;
    repository.d.tracking[remoteName + '/' + branch] = localCommit;
    if (args.includes('-u') || args.includes('--set-upstream')) {
      repository.d.upstream[branch] = remoteName + '/' + branch;
    }
    repository.save();
    runCI(remote, branch);
    output(branch + ' -> ' + branch + ' (laboratório local)');
    return 0;
  }

  function fetch(repository, remoteName, remote, output) {
    Object.assign(repository.d.commits, Git.copy(remote.commits));
    for (const [branch, commit] of Object.entries(remote.branches)) {
      repository.d.tracking[remoteName + '/' + branch] = commit;
    }
    repository.save();
    output('Fetched ' + remoteName);
  }

  function transfer(repository, command, args, output) {
    const parameters = args.filter(argument => !argument.startsWith('-'));
    const remoteName = parameters[0] || 'origin';
    const branch = parameters[1] || repository.d.branch;
    const remote = get(repository.sh.m, repository.d.remotes[remoteName]);
    if (!remote) Git.fail('fatal: remote repository not found in the laboratory');
    requireAuthentication(repository);

    if (command === 'push') return push(repository, args, remoteName, branch, remote, output);

    fetch(repository, remoteName, remote, output);
    if (command !== 'pull') return 0;

    const trackingCommit = repository.d.tracking[remoteName + '/' + branch];
    const branchesDiverged = repository.head
      && !repository.ancestors(trackingCommit).includes(repository.head)
      && !repository.ancestors(repository.head).includes(trackingCommit);
    if (args.includes('--ff-only') && branchesDiverged) {
      Git.fail('fatal: Not possible to fast-forward, aborting.');
    }
    output(repository.merge(remoteName + '/' + branch));
    return repository.d.conflicts.length ? 1 : 0;
  }

  function createIssue(remote, options) {
    if (!options.title?.trim()) Git.fail('Title required');
    const issue = {
      number: remote.issues.length + 1,
      title: options.title,
      body: options.body || '',
      label: options.label || '',
      assignee: options.assignee || '',
      milestone: options.milestone || '',
      state: 'open'
    };
    remote.issues.push(issue);
    return issue;
  }

  function createPullRequest(repository, remote, options) {
    const source = options.source ? get(repository.sh.m, options.source) : remote;
    const head = options.head || repository.d.branch;
    const base = options.base || 'main';
    const hasChanges = source?.branches[head]
      && remote.branches[base]
      && source.branches[head] !== remote.branches[base];
    if (!hasChanges) Git.fail('Push a branch with new commits before opening a PR');

    const pullRequest = {
      number: remote.prs.length + 1,
      title: options.title || 'Proposta de alteração',
      body: options.body || '',
      head,
      base,
      source: source.name,
      state: 'open',
      review: 'pending',
      comments: []
    };
    remote.prs.push(pullRequest);
    return pullRequest;
  }

  function mergePullRequest(repository, remote, pullRequest) {
    const source = get(repository.sh.m, pullRequest.source);
    const headCommit = source.branches[pullRequest.head];
    if (pullRequest.review !== 'approved' || pullRequest.reviewedHead !== headCommit) {
      Git.fail('A revisão simulada precisa aprovar o PR');
    }

    Object.assign(remote.commits, Git.copy(source.commits));
    const temporary = new Git.Repo(repository.sh, repository.root, Git.copy(repository.d));
    Object.assign(temporary.d, {
      commits: Git.copy(remote.commits),
      branches: Git.copy(remote.branches),
      branch: pullRequest.base,
      index: Git.copy(remote.commits[remote.branches[pullRequest.base]]?.tree || {})
    });
    const baseCommit = remote.branches[pullRequest.base];
    const commonAncestor = temporary.ancestors(baseCommit)
      .find(candidate => temporary.ancestors(headCommit).includes(candidate));
    const merge = temporary.mergeTrees(
      temporary.snapshot(commonAncestor),
      temporary.snapshot(baseCommit),
      temporary.snapshot(headCommit),
      pullRequest.head
    );
    if (merge.conflicts.length) Git.fail('PR has conflicts; resolve locally and push');

    const id = 'ff' + Number(remote.prs.length).toString(16).padStart(6, '0') + headCommit.slice(8);
    remote.commits[id] = {
      id,
      tree: merge.tree,
      parents: [baseCommit, headCommit],
      message: pullRequest.title,
      author: 'Revisão do laboratório',
      email: 'review@example.invalid'
    };
    pullRequest.baseCommit = baseCommit;
    pullRequest.headCommit = headCommit;
    remote.branches[pullRequest.base] = id;
    pullRequest.state = 'merged';
    runCI(remote, pullRequest.base);
  }

  function updatePullRequest(repository, remote, operation, options) {
    const pullRequest = remote.prs.find(item => item.number === +(options.number || 1));
    if (!pullRequest || pullRequest.state !== 'open') Git.fail('Open PR not found');

    if (operation === 'review') {
      pullRequest.review = options.requestChanges ? 'changes_requested' : 'approved';
      pullRequest.reviewedHead = get(repository.sh.m, pullRequest.source).branches[pullRequest.head];
    } else if (operation === 'comment') {
      if (!options.body?.trim()) Git.fail('Comment required');
      pullRequest.comments.push(options.body);
    } else if (operation === 'close') pullRequest.state = 'closed';
    else if (operation === 'merge') mergePullRequest(repository, remote, pullRequest);
    return pullRequest;
  }

  function createRelease(remote, options) {
    if (!remote.tags[options.tag]) Git.fail('Push the tag before creating a release');
    if (remote.releases.some(release => release.tag === options.tag)) Git.fail('Release already exists');
    const release = { tag: options.tag, title: options.title || options.tag, notes: options.notes || '' };
    remote.releases.push(release);
    return release;
  }

  function action(repository, group, operation, options = {}) {
    const remote = remoteFor(repository);
    if (group === 'issue' && operation === 'create') return createIssue(remote, options);
    if (group === 'pr' && operation === 'create') return createPullRequest(repository, remote, options);
    if (group === 'pr' && ['review', 'comment', 'close', 'merge'].includes(operation)) {
      return updatePullRequest(repository, remote, operation, options);
    }
    if (group === 'release' && operation === 'create') return createRelease(remote, options);
    Git.fail('Unsupported GitHub laboratory action');
  }

  LX.Github = { hub, get, create, name: repositoryName, transfer, action, remoteFor, runCI };
})();
