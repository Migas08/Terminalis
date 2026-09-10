/* Git educacional: snapshots imutáveis, índice e grafo de commits no VFS.
   Não executa Git nativo nem acessa a rede. */
'use strict';
(function () {
  const { deepClone: clone, objectEqual, uniqueKeys } = LX.Util;
  const REPOSITORY_FILE = '.git/terminalis.json';

  function fail(message) {
    throw new Error(message);
  }

  function readGlobalConfig(shell) {
    try {
      const text = shell.m.fs.readFile(shell.getVar('HOME') + '/.gitconfig', shell.fsopts());
      const config = {};
      let section = '';

      for (const line of text.split('\n')) {
        const sectionMatch = /^\s*\[([^\]]+)\]/.exec(line);
        const valueMatch = /^\s*([\w.-]+)\s*=\s*(.*)/.exec(line);
        if (sectionMatch) section = sectionMatch[1];
        else if (valueMatch) config[section + '.' + valueMatch[1]] = valueMatch[2];
      }
      return config;
    } catch {
      return {};
    }
  }

  function emptyRepository(branch) {
    return {
      branch,
      detached: null,
      branches: { [branch]: null },
      commits: {},
      index: {},
      config: {},
      tags: {},
      remotes: {},
      tracking: {},
      upstream: {},
      reflog: [],
      stash: [],
      conflicts: [],
      seq: 0
    };
  }

  function commitId(tree, parents, message, sequence) {
    let hash = 2166136261;
    for (const character of JSON.stringify([tree, parents, message, sequence])) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0') + sequence.toString(16).padStart(32, '0');
  }

  function ignorePattern(pattern) {
    const hasDirectory = pattern.includes('/');
    const matchesDirectory = pattern.endsWith('/');
    const body = pattern
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\u0001')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0001/g, '.*')
      .replace(/\?/g, '[^/]');
    return new RegExp((hasDirectory ? '^' : '(^|/)') + body + (matchesDirectory ? '(/|$)' : '$'));
  }

  class GitRepo {
    constructor(shell, root, state) {
      this.sh = shell;
      this.root = root;
      this.d = state;
    }

    static find(shell, required = true) {
      let current = shell.cwd;
      while (true) {
        const stateFile = current + '/' + REPOSITORY_FILE;
        if (shell.m.fs.exists(stateFile, shell.fsopts())) {
          return new GitRepo(shell, current, JSON.parse(shell.m.fs.readFile(stateFile, shell.fsopts())));
        }
        if (current === '/') break;
        current = LX.FileSystem.dirname(current);
      }
      if (required) fail('fatal: not a git repository (or any of the parent directories): .git');
      return null;
    }

    static init(shell, root = shell.cwd, branch = 'main') {
      const normalizedRoot = LX.FileSystem.normalize(root, shell.cwd);
      const stateFile = normalizedRoot + '/' + REPOSITORY_FILE;
      if (shell.m.fs.exists(stateFile, shell.fsopts())) {
        return new GitRepo(shell, normalizedRoot, JSON.parse(shell.m.fs.readFile(stateFile, shell.fsopts())));
      }

      shell.m.fs.mkdirp(normalizedRoot + '/.git', shell.fsopts());
      const repository = new GitRepo(shell, normalizedRoot, emptyRepository(branch));
      repository.save();
      return repository;
    }

    get head() {
      return this.d.branch ? this.d.branches[this.d.branch] : this.d.detached;
    }

    save() {
      const fs = this.sh.m.fs;
      const options = this.sh.fsopts();
      fs.writeFile(this.root + '/' + REPOSITORY_FILE, JSON.stringify(this.d), options);
      fs.writeFile(
        this.root + '/.git/HEAD',
        this.d.branch ? 'ref: refs/heads/' + this.d.branch + '\n' : this.head + '\n',
        options
      );
      fs.mkdirp(this.root + '/.git/refs/heads', options);
      for (const [branch, id] of Object.entries(this.d.branches)) {
        const reference = this.root + '/.git/refs/heads/' + branch;
        fs.mkdirp(LX.FileSystem.dirname(reference), options);
        fs.writeFile(reference, (id || '') + '\n', options);
      }
    }

    snapshot(reference = this.head) {
      return clone(this.d.commits[reference]?.tree || {});
    }

    resolve(reference = 'HEAD') {
      const match = /^(.*?)(?:~(\d+)|\^(\d*))?$/.exec(reference);
      const base = match[1];
      let id;

      if (/^HEAD@\{\d+\}$/.test(base)) id = this.d.reflog[+base.slice(6, -1)]?.id;
      else if (base === 'HEAD') id = this.head;
      else {
        id = this.d.branches[base]
          || this.d.tags[base]?.id
          || this.d.tracking[base]
          || Object.keys(this.d.commits).find(candidate => candidate.startsWith(base));
      }

      if (!id) fail('fatal: unknown revision: ' + reference);
      if (match[2]) {
        for (let step = 0; step < +match[2]; step++) id = this.d.commits[id]?.parents[0];
      }
      if (match[3] !== undefined) id = this.d.commits[id]?.parents[+(match[3] || 1) - 1];
      if (!id) fail('fatal: revision has no such parent: ' + reference);
      return id;
    }

    working() {
      const files = {};
      const fs = this.sh.m.fs;
      const options = this.sh.fsopts();

      const visit = (directory, relative) => {
        for (const entry of fs.readdir(directory, options)) {
          const name = typeof entry === 'string' ? entry : entry.name;
          if (name === '.git') continue;
          const absolutePath = directory + '/' + name;
          const relativePath = relative + name;
          const stat = fs.lstat(absolutePath, options);
          if (stat.type === 'dir') visit(absolutePath, relativePath + '/');
          else if (stat.type === 'file') files[relativePath] = fs.readFile(absolutePath, options);
        }
      };

      visit(this.root, '');
      return files;
    }

    ignored(path, workingTree = this.working()) {
      let ignored = false;
      const patterns = (workingTree['.gitignore'] || '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      for (let pattern of patterns) {
        const negate = pattern.startsWith('!');
        if (negate) pattern = pattern.slice(1);
        if (ignorePattern(pattern).test(path)) ignored = !negate;
      }
      return ignored;
    }

    path(path) {
      const absolutePath = LX.FileSystem.normalize(path, this.sh.cwd);
      const outside = absolutePath !== this.root && !absolutePath.startsWith(this.root + '/');
      if (outside) fail('fatal: path is outside repository');
      return absolutePath === this.root ? '' : absolutePath.slice(this.root.length + 1);
    }

    selected(paths, files) {
      return uniqueKeys(files, this.d.index)
        .filter(file => paths.some(path => path === '' || file === path || file.startsWith(path + '/')));
    }

    add(paths) {
      const workingTree = this.working();
      const selectedPaths = paths.map(path => this.path(path));
      for (const path of this.selected(selectedPaths, workingTree)) {
        if (path in workingTree) {
          if (path in this.d.index || !this.ignored(path, workingTree)) this.d.index[path] = workingTree[path];
        } else delete this.d.index[path];
        this.d.conflicts = this.d.conflicts.filter(conflict => conflict !== path);
      }
      this.save();
    }

    status() {
      const committed = this.snapshot();
      const workingTree = this.working();
      return uniqueKeys(committed, this.d.index, workingTree)
        .filter(path => path in this.d.index || path in committed || !this.ignored(path, workingTree))
        .map(path => ({
          path,
          x: committed[path] === this.d.index[path] ? ' ' : !(path in this.d.index) ? 'D' : !(path in committed) ? 'A' : 'M',
          y: this.d.index[path] === workingTree[path] ? ' ' : !(path in workingTree) ? 'D' : !(path in this.d.index) ? '?' : 'M'
        }))
        .filter(status => status.x !== ' ' || status.y !== ' ');
    }

    clean() {
      return this.status().every(status => status.x === ' ' && status.y === '?');
    }

    identity() {
      const config = Object.assign({}, readGlobalConfig(this.sh), this.d.config);
      if (!config['user.name'] || !config['user.email']) {
        fail('Author identity unknown. Configure user.name and user.email.');
      }
      return config;
    }

    move(id, message) {
      if (this.d.branch) this.d.branches[this.d.branch] = id;
      else this.d.detached = id;
      this.d.reflog.unshift({ id, msg: message });
    }

    commit(message, options = {}) {
      if (this.d.conflicts.length) fail('error: resolve conflicts and git add the files first');
      if (!message?.trim()) fail('Aborting commit due to empty commit message.');

      const identity = this.identity();
      const previousHead = this.head;
      const hasNoChanges = objectEqual(this.snapshot(), this.d.index);
      if (hasNoChanges && !options.amend && !this.d.merge && !options.allowEmpty) {
        fail('nothing to commit, working tree clean');
      }

      const parents = options.parents || (options.amend
        ? (this.d.commits[previousHead]?.parents || [])
        : [previousHead, this.d.merge?.other].filter(Boolean));
      const tree = clone(this.d.index);
      const sequence = ++this.d.seq;
      const id = commitId(tree, parents, message, sequence);

      this.d.commits[id] = {
        id,
        tree,
        parents,
        message,
        author: identity['user.name'],
        email: identity['user.email']
      };
      this.move(id, (options.amend ? 'commit (amend): ' : 'commit: ') + message);
      delete this.d.merge;
      this.save();
      return id;
    }

    checkoutTree(tree, force = false) {
      const workingTree = this.working();
      for (const path of Object.keys(tree)) {
        const overwritesUntracked = !(path in this.d.index)
          && path in workingTree
          && workingTree[path] !== tree[path];
        if (overwritesUntracked && !force) fail('error: untracked file would be overwritten: ' + path);
      }

      const fs = this.sh.m.fs;
      const options = this.sh.fsopts();
      for (const path of uniqueKeys(this.d.index, tree)) {
        const absolutePath = this.root + '/' + path;
        if (path in tree) {
          fs.mkdirp(LX.FileSystem.dirname(absolutePath), options);
          fs.writeFile(absolutePath, tree[path], options);
        } else if (fs.exists(absolutePath, options)) fs.unlink(absolutePath, options);
      }
      this.d.index = clone(tree);
    }

    switch(reference, create = false, detach = false) {
      if (!this.clean() || this.d.conflicts.length) {
        fail('error: commit or stash changes before switching branches');
      }
      if (create) {
        if (this.d.branches[reference] !== undefined) fail('fatal: branch already exists');
        this.d.branches[reference] = this.head;
      }

      const isBranch = this.d.branches[reference] !== undefined;
      const id = isBranch ? this.d.branches[reference] : this.resolve(reference);
      if (!isBranch && !detach) fail('fatal: a branch is expected; use switch --detach');

      this.checkoutTree(this.snapshot(id));
      this.d.branch = detach ? null : reference;
      this.d.detached = detach ? id : null;
      this.d.reflog.unshift({ id, msg: 'checkout: moving to ' + reference });
      this.save();
    }

    ancestors(id) {
      const ancestors = [];
      const pending = [id];
      while (pending.length) {
        const current = pending.shift();
        if (!current || ancestors.includes(current)) continue;
        ancestors.push(current);
        pending.push(...(this.d.commits[current]?.parents || []));
      }
      return ancestors;
    }

    mergeTrees(base, ours, theirs, label) {
      const tree = {};
      const conflicts = [];
      for (const path of uniqueKeys(base, ours, theirs)) {
        const current = ours[path];
        const incoming = theirs[path];
        let result;

        if (current === incoming) result = current;
        else if (current === base[path]) result = incoming;
        else if (incoming === base[path]) result = current;
        else {
          const currentLines = (current || '').split('\n');
          const incomingLines = (incoming || '').split('\n');
          const baseLines = (base[path] || '').split('\n');
          const sameShape = current !== undefined
            && incoming !== undefined
            && currentLines.length === incomingLines.length
            && currentLines.length === baseLines.length;
          const independentLines = sameShape && currentLines.every((line, index) => (
            line === incomingLines[index]
            || line === baseLines[index]
            || incomingLines[index] === baseLines[index]
          ));

          if (independentLines) {
            result = currentLines
              .map((line, index) => line === baseLines[index] ? incomingLines[index] : line)
              .join('\n');
          } else {
            result = '<<<<<<< HEAD\n' + (current || '')
              + '=======\n' + (incoming || '')
              + '>>>>>>> ' + label + '\n';
            conflicts.push(path);
          }
        }
        if (result !== undefined) tree[path] = result;
      }
      return { tree, conflicts };
    }

    merge(reference, noFastForward = false) {
      if (!this.clean()) fail('error: commit or stash changes before merging');
      const incoming = this.resolve(reference);
      const current = this.head;

      if (this.ancestors(current).includes(incoming)) return 'Already up to date.';
      if (!current || (this.ancestors(incoming).includes(current) && !noFastForward)) {
        this.checkoutTree(this.snapshot(incoming));
        this.move(incoming, 'merge: Fast-forward');
        this.save();
        return 'Fast-forward';
      }

      const base = this.ancestors(current)
        .find(candidate => this.ancestors(incoming).includes(candidate));
      if (!base) fail('fatal: refusing to merge unrelated histories');

      const merge = this.mergeTrees(
        this.snapshot(base),
        this.snapshot(current),
        this.snapshot(incoming),
        reference
      );
      this.checkoutTree(merge.tree);
      this.d.conflicts = merge.conflicts;
      this.d.merge = { other: incoming, original: current };
      this.save();

      if (merge.conflicts.length) {
        return 'CONFLICT (content): ' + merge.conflicts.join(', ')
          + '\nAutomatic merge failed; fix conflicts and then commit the result.';
      }
      this.commit('Merge branch ' + reference);
      return 'Merge made by the three-way strategy.';
    }

    diff(left, right) {
      return uniqueKeys(left, right)
        .filter(path => left[path] !== right[path])
        .map(path => {
          const removed = (left[path] || '').split('\n').filter(Boolean).map(line => '-' + line).join('\n');
          const added = (right[path] || '').split('\n').filter(Boolean).map(line => '+' + line).join('\n');
          return 'diff --git a/' + path + ' b/' + path
            + '\n--- ' + (path in left ? 'a/' + path : '/dev/null')
            + '\n+++ ' + (path in right ? 'b/' + path : '/dev/null')
            + '\n@@ snapshot comparison @@\n' + removed + '\n' + added;
        })
        .join('\n');
    }

    reset(reference, mode) {
      const id = this.resolve(reference);
      if (mode === '--hard') this.checkoutTree(this.snapshot(id), true);
      else if (mode !== '--soft') this.d.index = this.snapshot(id);
      this.move(id, 'reset: moving to ' + reference);
      this.d.conflicts = [];
      delete this.d.merge;
      this.save();
    }

    applyCommit(id, revert = false) {
      if (!this.clean()) fail('error: commit or stash changes before applying a commit');
      const commit = this.d.commits[id];
      const parent = this.snapshot(commit.parents[0] || null);
      const applied = this.mergeTrees(
        revert ? commit.tree : parent,
        this.snapshot(),
        revert ? parent : commit.tree,
        id.slice(0, 7)
      );
      this.checkoutTree(applied.tree);
      this.d.conflicts = applied.conflicts;
      this.save();
      if (applied.conflicts.length) fail('CONFLICT: resolve files and commit');
      return this.commit(revert ? 'Revert "' + commit.message + '"' : commit.message);
    }
  }

  LX.Git = {
    Repo: GitRepo,
    copy: clone,
    eq: objectEqual,
    keys: uniqueKeys,
    fail,
    globalConfig: readGlobalConfig
  };
})();
