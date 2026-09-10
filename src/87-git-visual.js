'use strict';
(function() {
    const {
      escapeHtml: esc
    } = LX.Util;
    const flow = (items, caption) => `<figure class="git-figure"><div class="git-flow">${items.map(([title,detail],i)=>`${i?'<span class="git-arrow" aria-hidden="true">→</span>':''}<div><strong>${title}</strong><small>${detail}</small></div>`).join('')}</div><figcaption>${caption}</figcaption></figure>`;

    function graph(rebase) {
      return `<figure class="git-figure"><svg viewBox="0 0 560 170" role="img" aria-label="${rebase?'Antes: duas linhas divergentes. Depois: commits da feature reaplicados sobre main.':'Main e feature partem de um ancestral comum e se encontram num merge.'}"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M50 45H270${rebase?'':'L430 45'}M160 45L220 105H325${rebase?'':'L430 45'}"/>${rebase?'<path d="M50 150H470" stroke-dasharray="5 4"/>':''}</g>${[[50,45,'A'],[160,45,'B'],[270,45,'C'],[220,105,'D'],[325,105,'E'],...(rebase?[[270,150,'C'],[370,150,'D′'],[470,150,'E′']]:[[430,45,'F']])].map(([x,y,t])=>`<circle cx="${x}" cy="${y}" r="16" fill="var(--surface)" stroke="currentColor"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="currentColor">${t}</text>`).join('')}<text x="475" y="50" fill="currentColor">main</text><text x="360" y="110" fill="currentColor">feature</text></svg><figcaption>${rebase?'Rebase reaplica D e E sobre C: D′ e E′ são novos commits. O original continua recuperável enquanto houver referências ou reflog.':'F tem dois pais: integra os dois históricos. Se main não tivesse avançado, seria possível apenas mover sua referência (fast-forward).'}</figcaption></figure>`;
    }

    function render(kind) {
      if (kind === 'github') return '<section class="git-lab" aria-label="GitHub simulado"><div class="eyebrow">GitHub · laboratório local</div><div data-gh-panel></div><p class="git-feedback" role="status" aria-live="polite"></p></section>';
      if (kind === 'conflict') return flow([
        ['HEAD', 'Sua versão atual'],
        ['=======', 'Separador das duas versões'],
        ['Branch integrada', 'A versão que está chegando']
      ], 'Os marcadores &lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD e &gt;&gt;&gt;&gt;&gt;&gt;&gt; delimitam o conflito. Edite o resultado desejado, remova todos os marcadores e prepare o arquivo resolvido com git add.');
      if (kind === 'branches' || kind === 'rebase') return graph(kind === 'rebase');
      if (kind === 'remote') return flow([
        ['Repositório local', 'Seus commits e branches'],
        ['Referências remotas', 'origin/main: última posição conhecida'],
        ['GitHub simulado', 'Histórico compartilhado']
      ], 'Push publica commits; fetch atualiza o conhecimento local do remoto; pull busca e integra. origin/main é uma referência local, não o servidor.');
      if (kind === 'reset') return `<figure class="git-figure"><strong>Atenção: use apenas os arquivos de treinamento.</strong><div class="table-wrap"><table><thead><tr><th>Modo</th><th>HEAD / branch</th><th>Índice</th><th>Arquivos</th></tr></thead><tbody><tr><td>--soft</td><td>Move</td><td>Preserva</td><td>Preserva</td></tr><tr><td>--mixed</td><td>Move</td><td>Restaura</td><td>Preserva</td></tr><tr><td>--hard</td><td>Move</td><td>Restaura</td><td>Descarta alterações rastreadas</td></tr></tbody></table></div><figcaption>Reflog pode recuperar commits. Ele não recupera necessariamente edições que nunca foram registradas.</figcaption></figure>`;
      if (kind === 'interactive') return `<section class="git-figure"><h3>Monte um plano de rebase</h3><p>Prévia conceitual: escolha o destino de dois commits, do mais antigo para o mais recente. Isso não altera o repositório.</p>${[1,2].map(n=>`<label class="git-plan-row">Commit ${n}<select data-rebase-action aria-label="Ação do commit ${n}">${['pick','reword','squash','fixup'].map(a=>`<option>${a}</option>`).join('')}</select></label>`).join('')}<output data-rebase-result aria-live="polite"></output></section>`;
      return flow([
        ['Working tree', 'Arquivos que você edita'],
        ['Staging area', 'Conteúdo selecionado com git add'],
        ['Repository', 'Snapshots registrados com git commit']
      ], 'Editar, preparar e registrar são operações diferentes. Uma edição posterior ao add não entra automaticamente no próximo commit.');
    }

    function wire(app) {
      const actions = [...document.querySelectorAll('[data-rebase-action]')];
      if (actions.length) {
        const update = () => {
          const values = actions.map(s => s.value);
          document.querySelector('[data-rebase-result]').textContent = ['squash', 'fixup'].includes(values[0]) ? 'O primeiro commit não tem um anterior ao qual se juntar. Comece com pick ou reword.' : values[1] === 'squash' ? 'Resultado: um commit combinando alterações e mensagens.' : values[1] === 'fixup' ? 'Resultado: um commit combinando alterações, preservando a primeira mensagem.' : `Resultado: dois commits${values.includes('reword')?', com edição de mensagem':''}.`;
        };
        actions.forEach(s => s.onchange = update);
        update();
      }
      refresh(app);
    }

  function repositoryHeader(remote) {
    const branches = Object.entries(remote.branches)
      .map(([branch, id]) => `<code>${esc(branch)} · ${esc(id?.slice(0, 7) || 'sem commits')}</code>`)
      .join('');
    return `<h3>${esc(remote.name)}</h3><p>${esc(remote.visibility)} · ${esc(remote.description || 'Repositório de treinamento')}</p><div class="git-branches">${branches}</div>`;
  }

  function pullRequestHtml(machine, remote, pr) {
    const source = LX.Github.get(machine, pr.source);
    const base = remote.commits[pr.baseCommit || remote.branches[pr.base]]?.tree || {};
    const head = source?.commits[pr.headCommit || source.branches[pr.head]]?.tree || {};
    const paths = [...new Set([...Object.keys(base), ...Object.keys(head)])]
      .filter(path => base[path] !== head[path]);
    const changes = paths.map(path =>
      `<strong>${esc(path)}</strong><pre>${esc('- ' + (base[path] || '(arquivo novo)') + '\n+ ' + (head[path] || '(arquivo removido)'))}</pre>`
    ).join('') || '<p>Não há diferenças atuais entre as branches.</p>';
    const comments = pr.comments.map(comment => `<blockquote>${esc(comment)}</blockquote>`).join('');
    const actions = pr.state === 'open' ?
      `<form data-pr-comment="${pr.number}"><label>Comentário<input name="body" required></label><button class="btn">Comentar</button></form><div class="git-actions"><button class="btn" data-pr-action="review" data-number="${pr.number}">Aprovar revisão</button><button class="btn" data-pr-action="changes" data-number="${pr.number}">Solicitar alterações</button><button class="btn" data-pr-action="merge" data-number="${pr.number}">Integrar PR</button><button class="btn" data-pr-action="close" data-number="${pr.number}">Fechar</button></div>` : '';

    return `<article class="git-pr"><h4>#${pr.number} ${esc(pr.title)}</h4><p>${esc(pr.head)} → ${esc(pr.base)} · ${esc(pr.state)} · revisão: ${esc(pr.review)}</p><details><summary>Ver alterações (${paths.length} arquivos)</summary>${changes}</details>${comments}${actions}</article>`;
  }

  function pullRequestsHtml(machine, remote) {
    const branches = Object.keys(remote.branches)
      .filter(branch => branch !== 'main')
      .map(branch => `<option>${esc(branch)}</option>`)
      .join('');
    const pullRequests = remote.prs.map(pr => pullRequestHtml(machine, remote, pr)).join('') ||
      '<p>Nenhum Pull Request aberto.</p>';
    return `<h4>Pull Requests</h4><form data-pr-create><label>Título<input name="title" required placeholder="Descreva a mudança"></label><label>Branch de origem<select name="head">${branches}</select></label><button class="btn" type="submit">Abrir Pull Request para main</button></form>${pullRequests}`;
  }

  function issuesHtml(remote) {
    return `<h4>Issues</h4>${remote.issues.map(issue => `<p>#${issue.number} ${esc(issue.title)} · ${esc(issue.label)} · ${esc(issue.assignee)} · ${esc(issue.milestone)}</p>`).join('') || '<p>Nenhuma Issue neste repositório.</p>'}`;
  }

  function releasesHtml(remote) {
    return `<h4>Releases</h4>${remote.releases.map(release => `<p>${esc(release.tag)} — ${esc(release.title)}</p>`).join('') || '<p>Nenhuma release publicada.</p>'}`;
  }

  function checksHtml(remote) {
    return `<h4>Verificações de CI</h4>${remote.runs.map(run => `<p>${run.status === 'success' ? '✓' : '×'} ${esc(run.path)} · ${esc(run.reason)}</p>`).join('') || '<p>Nenhuma execução.</p>'}`;
  }

  function wireGithubActions(panel, app, repository) {
    const act = (operation, options) => {
      try {
        LX.Github.action(repository, 'pr', operation, options);
        refresh(app);
        document.querySelector('.git-feedback').textContent = 'Alteração salva no laboratório.';
      } catch (error) {
        document.querySelector('.git-feedback').textContent = error.message;
      }
    };

    panel.querySelector('[data-pr-create]')?.addEventListener('submit', event => {
      event.preventDefault();
      act('create', Object.fromEntries(new FormData(event.target)));
    });
    panel.querySelectorAll('[data-pr-comment]').forEach(form => form.onsubmit = event => {
      event.preventDefault();
      act('comment', { number: form.dataset.prComment, body: new FormData(form).get('body') });
    });
    panel.querySelectorAll('[data-pr-action]').forEach(button => button.onclick = () => act(
      button.dataset.prAction === 'changes' ? 'review' : button.dataset.prAction,
      { number: button.dataset.number, requestChanges: button.dataset.prAction === 'changes' }
    ));
  }

  function refresh(app) {
    const panel = document.querySelector('[data-gh-panel]');
    if (!panel) return;

    const lessonNumber = Number(String(app.route.lesson).replace('lg', ''));
    const shell = LX.GitLab.shell(app.machine, lessonNumber);
    const repository = LX.Git.Repo.find(shell, false);
    let remote;
    try { remote = repository && LX.Github.remoteFor(repository); } catch {}

    if (!remote) {
      panel.innerHTML = '<p>O painel acompanha o repositório conectado a origin. Crie e conecte o remoto com os comandos ensinados nesta aula para ver seus dados aqui.</p>';
      return;
    }

    panel.innerHTML = repositoryHeader(remote) +
      (lessonNumber >= 18 ? pullRequestsHtml(shell.m, remote) : '') +
      (lessonNumber >= 19 ? issuesHtml(remote) : '') +
      (lessonNumber >= 21 ? releasesHtml(remote) : '') +
      (lessonNumber >= 33 ? checksHtml(remote) : '');
    wireGithubActions(panel, app, repository);
  }

  LX.GitVisual = { render, wire, refresh };
})();
