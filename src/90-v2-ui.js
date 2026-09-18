/* =========================================================================
   TERMINALIS V2 — dashboard, exploração e experiência de desafio
   ========================================================================= */
'use strict';
(function () {
  if (!LX.App || !LX.ChallengeCatalog || !LX.V2Progress) return;
  const { query: $, queryAll: $$, escapeHtml: esc } = LX.Util;
  const Catalog = LX.ChallengeCatalog;
  const V2 = LX.V2Progress;
  const appProto = LX.App.prototype;

  const icon = {
    challenge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8l1 3h3v15H4V6h3z"/><path d="M9 11h6M9 15h4"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M14 7l5 5-5 5"/></svg>'
  };

  function progress() { return V2.ensure(LX.Progress.data); }
  function completed(id) { return !!progress().challengeCompletions[id]; }
  function favorite(id) { return progress().challengeFavorites.includes(id); }
  function difficultyLabel(value) { return Catalog.labels.difficulties[value] || value; }
  function typeLabel(value) { return Catalog.labels.types[value] || value; }
  function technologyLabel(id) { return (Catalog.technology(id) || { name: id }).name; }
  function duration(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  function ensureChrome() {
    if (typeof document === 'undefined') return;
    $$('[data-nav="cursos"] span').forEach(label => { label.textContent = 'Biblioteca'; });
    const sidebar = $('.sb-nav');
    if (sidebar && !sidebar.querySelector('[data-nav="challenges"]')) {
      const button = document.createElement('button');
      button.className = 'sb-item';
      button.dataset.nav = 'challenges';
      button.innerHTML = icon.challenge + '<span>Desafios</span>';
      const home = sidebar.querySelector('[data-nav="home"]');
      if (home) home.insertAdjacentElement('afterend', button); else sidebar.prepend(button);
    }
    const mobile = $('.mobile-tabs');
    if (mobile && !mobile.querySelector('[data-nav="challenges"]')) {
      const button = document.createElement('button');
      button.dataset.nav = 'challenges';
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = icon.challenge + '<span>Desafios</span>';
      const home = mobile.querySelector('[data-nav="home"]');
      if (home) home.insertAdjacentElement('afterend', button); else mobile.appendChild(button);
    }
  }

  function challengeCard(challenge) {
    const isDone = completed(challenge.id);
    const isFavorite = favorite(challenge.id);
    return `<article class="v2-card ${isDone ? 'is-done' : ''}" data-challenge-card="${esc(challenge.id)}">
      <button class="v2-favorite ${isFavorite ? 'active' : ''}" data-favorite="${esc(challenge.id)}" aria-label="${isFavorite ? 'Remover dos salvos' : 'Salvar desafio'}" title="${isFavorite ? 'Remover dos salvos' : 'Salvar desafio'}">${icon.star}</button>
      <div class="v2-card-top"><span class="v2-tech">${esc(technologyLabel(challenge.technology))}</span><span>${esc(difficultyLabel(challenge.difficulty))}</span></div>
      <h3>${esc(challenge.title)}</h3>
      <p>${esc(challenge.summary)}</p>
      <div class="v2-card-foot"><span>${esc(typeLabel(challenge.type))}</span><strong>+${challenge.xp} XP</strong>${isDone ? '<span class="v2-done">Concluído</span>' : ''}</div>
    </article>`;
  }

  function wireCards(app, root) {
    $$('[data-challenge-card]', root).forEach(card => card.onclick = event => {
      if (event.target.closest('[data-favorite]')) return;
      app.goChallenge(card.dataset.challengeCard);
    });
    $$('[data-favorite]', root).forEach(button => button.onclick = event => {
      event.stopPropagation();
      const active = V2.toggleFavorite(button.dataset.favorite);
      button.classList.toggle('active', active);
      button.setAttribute('aria-label', active ? 'Remover dos salvos' : 'Salvar desafio');
      button.title = button.getAttribute('aria-label');
    });
  }

  function renderDashboard(app) {
    const state = progress();
    const summary = V2.summary(state);
    const open = Catalog.search({ status: 'open' }, state);
    const active = Object.values(state.challengeAttempts)
      .filter(item => item && !item.completedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const recommendations = open.slice(0, 3);
    const published = Catalog.search({}, state);
    const availableTechnologies = summary.technologies.filter(item => item.available > 0);
    const recent = state.v2Activity.slice(0, 4);
    const level = summary.level;
    const resumeChallenge = active && Catalog.challenge(active.challengeId);
    const daily = published.length
      ? published[Math.floor(Date.now() / 86400000) % published.length]
      : null;

    $('#page').innerHTML = `<div class="doc wide v2-dashboard">
      <header class="v2-hero">
        <div><div class="eyebrow">TERMINALIS V2 / LABORATÓRIO PRÁTICO</div><h1>Aprenda resolvendo.</h1><p>Escolha uma tecnologia, assuma o ambiente e produza um resultado verificável. A teoria continua disponível quando você precisar dela.</p></div>
        <div class="v2-level-card"><span>Nível global</span><strong>${level.level}</strong><small>${summary.xp.toLocaleString('pt-BR')} XP</small><div class="v2-progress"><i style="width:${level.percent}%"></i></div><em>${level.ceiling - level.xp} XP para o próximo nível</em></div>
      </header>

      ${resumeChallenge ? `<section class="v2-resume"><div><span class="v2-kicker">CONTINUAR DESAFIO</span><h2>${esc(resumeChallenge.title)}</h2><p>${esc(technologyLabel(resumeChallenge.technology))} · ${esc(difficultyLabel(resumeChallenge.difficulty))} · tentativa em andamento</p></div><button class="btn primary" id="v2-resume">Retomar ${icon.arrow}</button></section>` : ''}

      <section class="v2-stats" aria-label="Resumo da prática">
        <div><strong>${summary.completed}</strong><span>desafios concluídos</span></div>
        <div><strong>${summary.withoutHints}</strong><span>sem dicas</span></div>
        <div><strong>${summary.incidents}</strong><span>incidentes resolvidos</span></div>
        <div><strong>${state.challengeFavorites.length}</strong><span>salvos</span></div>
      </section>

      <div class="v2-section-title"><div><span class="v2-kicker">PRÓXIMO PASSO</span><h2>Desafios recomendados</h2></div><button class="v2-link" id="v2-explore-all">Explorar todos ${icon.arrow}</button></div>
      <div class="v2-card-grid">${recommendations.map(challengeCard).join('') || '<div class="v2-empty">Você concluiu todos os desafios publicados.</div>'}</div>

      ${daily ? `<section class="v2-daily"><div><span class="v2-kicker">DESAFIO DO DIA</span><h2>${esc(daily.title)}</h2><p>${esc(daily.summary)}</p></div><div><strong>+${daily.xp} XP</strong><button class="btn ghost" id="v2-daily-open">Abrir desafio</button></div></section>` : ''}

      <div class="v2-section-title"><div><span class="v2-kicker">COMPETÊNCIAS</span><h2>Progresso por tecnologia</h2></div><button class="v2-link" id="v2-library">Abrir biblioteca de apoio</button></div>
      <div class="v2-tech-grid">${availableTechnologies.map(item => `<button data-tech="${esc(item.technology.id)}"><span>${esc(item.technology.name)}</span><strong>Nível ${item.level.level}</strong><div class="v2-progress"><i style="width:${item.available ? Math.round(item.completed / item.available * 100) : 0}%"></i></div><small>${item.completed}/${item.available} desafios · ${item.xp} XP</small></button>`).join('')}</div>

      ${recent.length ? `<section class="v2-activity"><div class="v2-section-title"><div><span class="v2-kicker">HISTÓRICO</span><h2>Atividade recente</h2></div></div>${recent.map(item => { const challenge = Catalog.challenge(item.challengeId); return challenge ? `<button data-recent-challenge="${esc(challenge.id)}"><span>Concluiu</span><strong>${esc(challenge.title)}</strong><em>+${item.xp} XP</em></button>` : ''; }).join('')}</section>` : ''}
      <footer class="v2-authority">XP desta primeira fatia é uma prévia local. A publicação de recompensas e badges dependerá da validação autoritativa no Supabase.</footer>
    </div>`;
    if ($('#v2-resume')) $('#v2-resume').onclick = () => app.goChallenge(resumeChallenge.id);
    $('#v2-explore-all').onclick = () => app.goChallenges();
    $('#v2-library').onclick = () => app.goCursos();
    if ($('#v2-daily-open')) $('#v2-daily-open').onclick = () => app.goChallenge(daily.id);
    $$('[data-tech]').forEach(button => button.onclick = () => app.goChallenges({ technology: button.dataset.tech }));
    $$('[data-recent-challenge]').forEach(button => button.onclick = () => app.goChallenge(button.dataset.recentChallenge));
    wireCards(app, $('#page'));
  }

  function selectOptions(items, labels, current, placeholder) {
    return `<option value="">${esc(placeholder)}</option>` + items.map(item => `<option value="${esc(item)}" ${current === item ? 'selected' : ''}>${esc(labels[item] || item)}</option>`).join('');
  }

  function renderChallenges(app, initialFilters) {
    const filters = Object.assign({ query: '', technology: '', difficulty: '', type: '', status: '', xp: '' }, app._challengeFilters || {}, initialFilters || {});
    app._challengeFilters = filters;
    const state = progress();
    const searchFilters = Object.assign({}, filters);
    if (filters.xp === 'under-100') searchFilters.xpMax = 99;
    if (filters.xp === '100-199') { searchFilters.xpMin = 100; searchFilters.xpMax = 199; }
    if (filters.xp === '200-plus') searchFilters.xpMin = 200;
    const results = Catalog.search(searchFilters, state);
    const technologies = Catalog.technologies.filter(technology => Catalog.challenges.some(challenge => challenge.technology === technology.id && challenge.status === 'published'));
    $('#page').innerHTML = `<div class="doc wide v2-explore">
      <header class="v2-page-head"><div><div class="eyebrow">DESAFIOS</div><h1>Escolha o próximo problema.</h1><p>Pesquise por tecnologia, ferramenta ou situação. Cada desafio abre um ambiente isolado para você investigar.</p></div><div class="v2-result-count"><strong>${results.length}</strong><span>encontrados</span></div></header>
      <div class="v2-filters">
        <label class="v2-search"><span>Pesquisar</span><input id="v2-query" type="search" value="${esc(filters.query)}" placeholder="docker network, permissões, serviço…"></label>
        <label><span>Tecnologia</span><select id="v2-technology"><option value="">Todas</option>${technologies.map(item => `<option value="${esc(item.id)}" ${filters.technology === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
        <label><span>Dificuldade</span><select id="v2-difficulty">${selectOptions(Catalog.difficulties, Catalog.labels.difficulties, filters.difficulty, 'Todas')}</select></label>
        <label><span>Tipo</span><select id="v2-type">${selectOptions(Catalog.types, Catalog.labels.types, filters.type, 'Todos')}</select></label>
        <label><span>Status</span><select id="v2-status"><option value="">Todos</option><option value="open" ${filters.status === 'open' ? 'selected' : ''}>Não concluídos</option><option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>Concluídos</option><option value="favorite" ${filters.status === 'favorite' ? 'selected' : ''}>Salvos</option></select></label>
        <label><span>XP</span><select id="v2-xp"><option value="">Qualquer XP</option><option value="under-100" ${filters.xp === 'under-100' ? 'selected' : ''}>Até 99 XP</option><option value="100-199" ${filters.xp === '100-199' ? 'selected' : ''}>100–199 XP</option><option value="200-plus" ${filters.xp === '200-plus' ? 'selected' : ''}>200+ XP</option></select></label>
      </div>
      <div class="v2-active-filters">${Object.entries(filters).filter(([, value]) => value).map(([key, value]) => `<button data-clear-filter="${esc(key)}">${esc(key === 'technology' ? technologyLabel(value) : (key === 'difficulty' ? difficultyLabel(value) : (key === 'type' ? typeLabel(value) : value)))} ×</button>`).join('')}</div>
      <div class="v2-card-grid v2-all">${results.map(challengeCard).join('') || '<div class="v2-empty"><strong>Nenhum desafio encontrado.</strong><span>Remova um filtro ou tente outra busca.</span></div>'}</div>
    </div>`;
    const update = () => {
      app._challengeFilters = {
        query: $('#v2-query').value.trim(), technology: $('#v2-technology').value,
        difficulty: $('#v2-difficulty').value, type: $('#v2-type').value,
        status: $('#v2-status').value, xp: $('#v2-xp').value
      };
      renderChallenges(app);
    };
    $('#v2-query').oninput = () => { clearTimeout(app._challengeSearchTimer); app._challengeSearchTimer = setTimeout(update, 180); };
    for (const id of ['#v2-technology', '#v2-difficulty', '#v2-type', '#v2-status', '#v2-xp']) $(id).onchange = update;
    $$('[data-clear-filter]').forEach(button => button.onclick = () => { app._challengeFilters[button.dataset.clearFilter] = ''; renderChallenges(app); });
    wireCards(app, $('#page'));
  }

  function renderConcepts(challenge) {
    if (!challenge.concepts.length) return '';
    return `<details class="v2-support"><summary>Entender conceitos</summary><div>${challenge.concepts.map(concept => `<article><code>${esc(concept.term)}</code><p>${esc(concept.summary)}</p>${concept.detail ? `<small>${esc(concept.detail)}</small>` : ''}</article>`).join('')}</div></details>`;
  }

  function renderChallenge(app, challenge) {
    const state = progress();
    const attempt = V2.attempt(challenge.id, state) || V2.start(challenge.id, { commandsAtStart: app.term.history.length }, state);
    const storedCompletion = state.challengeCompletions[challenge.id];
    const replaying = app._challengeReplayId === challenge.id;
    const completion = replaying ? null : storedCompletion;
    const shownHints = attempt.hintsUsed.map(index => challenge.hints[index]).filter(Boolean);
    const solutionLines = challenge.possibleSolution.split('\n');
    const commandCount = completion ? completion.commandsCount : Math.max(0, app.term.history.length - attempt.commandsAtStart);
    $('#page').innerHTML = `<div class="doc v2-challenge">
      <header class="v2-challenge-head">
        <div class="v2-challenge-code">DESAFIO #${esc(challenge.id)}</div>
        <div class="v2-challenge-actions"><button class="v2-icon-action ${favorite(challenge.id) ? 'active' : ''}" id="v2-save-challenge" title="Salvar desafio">${icon.star}</button>${!completion ? `<button class="v2-mode ${attempt.mode === 'realistic' ? 'active' : ''}" id="v2-mode">${attempt.mode === 'realistic' ? 'Modo realista ativo' : 'Ativar modo realista'}</button>` : ''}</div>
        <h1>${esc(challenge.title)}</h1>
        <div class="v2-meta"><span>${esc(technologyLabel(challenge.technology))}</span><span>${esc(difficultyLabel(challenge.difficulty))}</span><span>${esc(typeLabel(challenge.type))}</span><strong>+${challenge.xp} XP</strong></div>
      </header>

      ${completion ? `<section class="v2-complete"><div><span>CONCLUÍDO</span><strong>+${completion.xpGranted} XP</strong></div><dl><div><dt>Tempo</dt><dd>${duration(completion.durationMs)}</dd></div><div><dt>Dicas</dt><dd>${completion.hintsUsed}</dd></div><div><dt>Comandos</dt><dd>${completion.commandsCount}</dd></div><div><dt>Modo</dt><dd>${completion.mode === 'realistic' ? 'Realista' : 'Guiado'}</dd></div></dl></section>` : ''}

      <section class="v2-brief"><span>SITUAÇÃO</span><p>${esc(challenge.situation)}</p></section>
      <section class="v2-brief"><span>MISSÃO</span><p>${esc(challenge.mission)}</p></section>
      <section class="v2-objectives"><span>OBJETIVOS</span>${challenge.objectives.map(objective => `<div class="${completion ? 'done' : ''}"><i>${completion ? '✓' : ''}</i><p>${esc(objective)}</p></div>`).join('')}</section>

      ${shownHints.length ? `<section class="v2-hints"><span>PISTAS ABERTAS</span>${shownHints.map((hint, index) => `<article><strong>${esc(hint.title || 'Dica ' + (index + 1))}</strong><p>${esc(hint.content)}</p></article>`).join('')}</section>` : ''}
      <div class="v2-verdict hidden" id="v2-verdict" role="status" aria-live="polite"></div>
      <div class="v2-challenge-buttons">
        ${!completion && shownHints.length < challenge.hints.length ? `<button class="btn ghost" id="v2-next-hint">Solicitar dica ${shownHints.length + 1}/${challenge.hints.length}</button>` : ''}
        <button class="btn ghost" id="v2-focus-terminal">Ir para o terminal</button>
        ${!completion ? '<button class="btn primary" id="v2-validate">Validar ambiente</button>' : '<button class="btn ghost" id="v2-retry">Refazer desafio</button>'}
      </div>

      ${renderConcepts(challenge)}
      ${challenge.referenceLessonIds.length ? `<details class="v2-support"><summary>Documentação relacionada</summary><div class="v2-reference-list">${challenge.referenceLessonIds.map(id => { const found = app.findLesson(id); return found ? `<button data-reference="${esc(id)}"><span>${esc(found.mod.title)}</span><strong>${esc(found.lesson.title)}</strong></button>` : ''; }).join('')}</div><div class="v2-reference-preview hidden" id="v2-reference-preview"></div></details>` : ''}

      ${completion ? `<section class="v2-debrief"><span>O QUE ACONTECEU</span><p>${esc(challenge.explanation)}</p><h2>Uma solução possível</h2><div class="v2-solution"><pre>${esc(solutionLines.join('\n'))}</pre></div>${challenge.alternatives.length ? `<h2>Outros caminhos válidos</h2><ul>${challenge.alternatives.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${challenge.skills.length ? `<h2>Competências praticadas</h2><div class="v2-skill-tags">${challenge.skills.map(item => `<span>${esc(item)}</span>`).join('')}</div>` : ''}${challenge.extraChallenge ? `<aside><strong>Desafio extra</strong><p>${esc(challenge.extraChallenge)}</p></aside>` : ''}</section>` : ''}
      <footer class="v2-attempt-note">Tentativa ${attempt.mode === 'realistic' ? 'em modo realista' : 'guiada'} · ${commandCount} comando(s) desde o início. Erros do terminal fazem parte da investigação.</footer>
    </div>`;

    $('#v2-save-challenge').onclick = () => {
      const active = V2.toggleFavorite(challenge.id);
      $('#v2-save-challenge').classList.toggle('active', active);
    };
    if ($('#v2-focus-terminal')) $('#v2-focus-terminal').onclick = () => {
      app.switchTab('term'); document.body.classList.add('show-term'); app.term.focus();
    };
    if ($('#v2-next-hint')) $('#v2-next-hint').onclick = () => {
      V2.recordHint(challenge.id, attempt.hintsUsed.length);
      renderChallenge(app, challenge);
    };
    if ($('#v2-mode')) $('#v2-mode').onclick = () => app.restartChallenge(challenge.id, attempt.mode === 'realistic' ? 'guided' : 'realistic');
    if ($('#v2-retry')) $('#v2-retry').onclick = () => app.restartChallenge(challenge.id, 'guided');
    if ($('#v2-validate')) $('#v2-validate').onclick = async () => {
      const button = $('#v2-validate');
      const verdict = $('#v2-verdict');
      button.disabled = true; button.textContent = 'Validando…';
      try {
        const result = await challenge.validate({
          app, machine: app.machine, term: app.term, sh: app.term.sh,
          run: command => app.term.runQuiet(command)
        });
        V2.recordValidation(challenge.id, result);
        verdict.classList.remove('hidden', 'ok', 'fail');
        if (result && result.ok) {
          const activeAttempt = V2.attempt(challenge.id);
          const commandsCount = Math.max(0, app.term.history.length - activeAttempt.commandsAtStart);
          const award = V2.complete(challenge.id, { commandsCount });
          app._challengeReplayId = null;
          verdict.classList.add('ok'); verdict.textContent = 'Ambiente validado. Desafio concluído.';
          app.toast(award.fresh ? 'Desafio concluído · +' + challenge.xp + ' XP' : 'Prática concluída novamente');
          setTimeout(() => renderChallenge(app, challenge), 350);
        } else {
          verdict.classList.add('fail');
          verdict.innerHTML = '<strong>O ambiente ainda não atende à missão.</strong>' + LX.feedbackHtml((result && result.msg) || 'Continue investigando e tente novamente.');
        }
      } catch (error) {
        verdict.classList.remove('hidden', 'ok'); verdict.classList.add('fail');
        verdict.textContent = 'Não foi possível validar: ' + error.message;
      }
      button.disabled = false; button.textContent = 'Validar ambiente';
    };
    $$('[data-reference]').forEach(button => button.onclick = () => {
      const found = app.findLesson(button.dataset.reference);
      const preview = $('#v2-reference-preview');
      if (!found || !preview) return;
      preview.classList.remove('hidden');
      preview.innerHTML = `<span>RESUMO DA DOCUMENTAÇÃO</span><h3>${esc(found.lesson.title)}</h3><p>${esc(found.lesson.goal || found.mod.blurb || '')}</p><button class="btn ghost small" data-open-reference="${esc(found.lesson.id)}">Abrir aula completa</button>`;
      $('[data-open-reference]', preview).onclick = () => app.goLesson(found.lesson.id);
    });
  }

  const originalBindChrome = appProto.bindChrome;
  appProto.bindChrome = function () {
    ensureChrome();
    originalBindChrome.call(this);
    $$('[data-nav="challenges"]').forEach(button => button.onclick = () => this.goChallenges());
  };

  const originalNavAtual = appProto.navAtual;
  appProto.navAtual = function () {
    if (this.route.view === 'challenges' || this.route.view === 'challenge') return 'challenges';
    return originalNavAtual.call(this);
  };

  const originalAplicarChrome = appProto.aplicarChrome;
  appProto.aplicarChrome = function () {
    originalAplicarChrome.call(this);
    const laboratory = this.route.view === 'lesson' || this.route.view === 'challenge';
    document.body.classList.toggle('route-lesson', laboratory);
    document.body.classList.toggle('route-challenge', this.route.view === 'challenge');
    document.body.classList.toggle('route-page', !laboratory);
    const body = $('#body');
    if (body) body.classList.toggle('solo', !laboratory);
  };

  const originalSetCrumbs = appProto.setCrumbs;
  appProto.setCrumbs = function (a, b) {
    originalSetCrumbs.call(this, a, b);
    if (this.route.view === 'challenges') $('#topback').classList.add('hidden');
  };

  const originalVoltar = appProto.voltar;
  appProto.voltar = function () {
    if (this.route.view === 'challenge') return this.goChallenges();
    return originalVoltar.call(this);
  };

  appProto.goHome = function () {
    this.route = { view: 'home', mod: null, lesson: null, challenge: null };
    this.trilhaId = null;
    this.setCrumbs('', 'Início');
    $('#modprog').style.visibility = 'hidden';
    $('#lesson-foot').classList.add('hidden');
    this.aplicarChrome();
    renderDashboard(this);
    this.renderRail();
    $('#page').scrollTop = 0;
  };

  appProto.goChallenges = function (filters) {
    this.route = { view: 'challenges', mod: null, lesson: null, challenge: null };
    this.trilhaId = null;
    this.setCrumbs('', 'Desafios');
    $('#modprog').style.visibility = 'hidden';
    $('#lesson-foot').classList.add('hidden');
    this.aplicarChrome();
    renderChallenges(this, filters);
    this.renderRail();
    $('#page').scrollTop = 0;
  };

  appProto.goChallenge = function (id) {
    const challenge = Catalog.challenge(id);
    if (!challenge) return this.goChallenges();
    this.route = { view: 'challenge', mod: null, lesson: null, challenge: challenge.id };
    this.trilhaId = null;
    this.setCrumbs('Desafios', challenge.title);
    const mobileLabel = $('.mobile-tabs [data-m="lesson"] span');
    if (mobileLabel) mobileLabel.textContent = 'Desafio';
    $('#modprog').style.visibility = 'hidden';
    $('#lesson-foot').classList.add('hidden');
    if (this._activeChallengeId !== challenge.id) {
      this.buildMachine();
      this.term.boot(this.machine);
      challenge.setup(this.machine, this.term);
      this._activeChallengeId = challenge.id;
      V2.start(challenge.id, { commandsAtStart: this.term.history.length });
      this._challengeReplayId = null;
    }
    LX.Progress.data.lastChallenge = challenge.id;
    LX.Progress.save();
    this.aplicarChrome();
    renderChallenge(this, challenge);
    this.renderRail();
    $('#page').scrollTop = 0;
    this.term.focus();
  };

  const originalGoLesson = appProto.goLesson;
  appProto.goLesson = function (id) {
    const mobileLabel = $('.mobile-tabs [data-m="lesson"] span');
    if (mobileLabel) mobileLabel.textContent = 'Aula';
    return originalGoLesson.call(this, id);
  };

  appProto.restartChallenge = function (id, mode) {
    const challenge = Catalog.challenge(id);
    if (!challenge) return;
    this.buildMachine();
    this.term.boot(this.machine);
    challenge.setup(this.machine, this.term);
    this._activeChallengeId = challenge.id;
    this._challengeReplayId = progress().challengeCompletions[id] ? id : null;
    V2.start(challenge.id, { mode, restart: true, commandsAtStart: this.term.history.length });
    renderChallenge(this, challenge);
    this.term.focus();
  };

  const originalStart = appProto.start;
  appProto.start = async function () {
    ensureChrome();
    await originalStart.call(this);
    this.goHome();
  };

  const originalEnter = appProto.entrarComUsuario;
  appProto.entrarComUsuario = async function () {
    await originalEnter.call(this);
    this.goHome();
  };
})();
