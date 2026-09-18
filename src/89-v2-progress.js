/* =========================================================================
   TERMINALIS V2 — tentativas, favoritos e progressão local compatível
   Em produção, XP e badges públicos devem ser concedidos pelo backend.
   ========================================================================= */
'use strict';
(function () {
  const VERSION = 1;

  function now() { return Date.now(); }
  function save() { if (LX.Progress && typeof LX.Progress.save === 'function') LX.Progress.save(); }
  function data(input) { return input || (LX.Progress && LX.Progress.data) || {}; }

  function ensure(input) {
    const value = data(input);
    value.v2 = Object.assign({ version: VERSION, rewardAuthority: 'local-preview' }, value.v2 || {});
    value.challengeAttempts = value.challengeAttempts || {};
    value.challengeCompletions = value.challengeCompletions || {};
    value.challengeFavorites = Array.isArray(value.challengeFavorites) ? value.challengeFavorites : [];
    value.v2Activity = Array.isArray(value.v2Activity) ? value.v2Activity : [];
    return value;
  }

  function challengeOrFail(id) {
    const challenge = LX.ChallengeCatalog.challenge(id);
    if (!challenge) throw new Error('Desafio inexistente: ' + id);
    return challenge;
  }

  function thresholdForLevel(level) {
    level = Math.max(1, Math.floor(Number(level) || 1));
    let threshold = 0;
    for (let current = 1; current < level; current++) {
      threshold += 400 + (current - 1) * 150 + Math.floor((current - 1) / 5) * 250;
    }
    return threshold;
  }

  function levelForXp(xp) {
    xp = Math.max(0, Math.floor(Number(xp) || 0));
    let level = 1;
    while (level < 100 && thresholdForLevel(level + 1) <= xp) level++;
    const floor = thresholdForLevel(level);
    const ceiling = thresholdForLevel(level + 1);
    return {
      level, xp, floor, ceiling,
      inLevel: xp - floor,
      needed: ceiling - floor,
      percent: ceiling === floor ? 100 : Math.round((xp - floor) / (ceiling - floor) * 100)
    };
  }

  function start(id, options, input) {
    const challenge = challengeOrFail(id);
    const value = ensure(input);
    const previous = value.challengeAttempts[challenge.id];
    if (previous && !previous.completedAt && !(options && options.restart)) return previous;
    const attempt = {
      challengeId: challenge.id,
      challengeVersion: challenge.version,
      startedAt: now(),
      updatedAt: now(),
      completedAt: null,
      mode: options && options.mode === 'realistic' ? 'realistic' : 'guided',
      hintsUsed: [],
      validations: 0,
      commandsAtStart: Number(options && options.commandsAtStart) || 0
    };
    value.challengeAttempts[challenge.id] = attempt;
    save();
    return attempt;
  }

  function attempt(id, input) { return ensure(input).challengeAttempts[id] || null; }

  function recordHint(id, index, input) {
    const value = ensure(input);
    const active = value.challengeAttempts[id] || start(id, {}, value);
    const challenge = challengeOrFail(id);
    index = Math.floor(Number(index));
    if (index < 0 || index >= challenge.hints.length) throw new Error('Dica inexistente: ' + index);
    if (!active.hintsUsed.includes(index)) active.hintsUsed.push(index);
    active.hintsUsed.sort((a, b) => a - b);
    active.updatedAt = now();
    save();
    return active;
  }

  function recordValidation(id, result, input) {
    const value = ensure(input);
    const active = value.challengeAttempts[id] || start(id, {}, value);
    active.validations++;
    active.updatedAt = now();
    active.lastValidation = { ok: !!(result && result.ok), at: active.updatedAt };
    save();
    return active;
  }

  function complete(id, metrics, input) {
    const challenge = challengeOrFail(id);
    const value = ensure(input);
    if (value.challengeCompletions[id]) return { fresh: false, awardedXp: 0, completion: value.challengeCompletions[id] };
    const active = value.challengeAttempts[id] || start(id, {}, value);
    const finishedAt = now();
    active.completedAt = finishedAt;
    active.updatedAt = finishedAt;
    const completion = {
      challengeId: id,
      challengeVersion: challenge.version,
      completedAt: finishedAt,
      technology: challenge.technology,
      type: challenge.type,
      difficulty: challenge.difficulty,
      xpGranted: challenge.xp,
      rewardAuthority: value.v2.rewardAuthority,
      hintsUsed: active.hintsUsed.length,
      withoutHints: active.hintsUsed.length === 0,
      validations: active.validations,
      mode: active.mode,
      durationMs: Math.max(0, finishedAt - active.startedAt),
      commandsCount: Math.max(0, Number(metrics && metrics.commandsCount) || 0)
    };
    value.challengeCompletions[id] = completion;
    value.v2Activity.unshift({
      id: 'challenge:' + id + ':' + finishedAt,
      kind: 'challenge-completed',
      challengeId: id,
      technology: challenge.technology,
      xp: challenge.xp,
      at: finishedAt
    });
    value.v2Activity = value.v2Activity.slice(0, 50);
    save();
    return { fresh: true, awardedXp: challenge.xp, completion };
  }

  function toggleFavorite(id, input) {
    challengeOrFail(id);
    const value = ensure(input);
    const index = value.challengeFavorites.indexOf(id);
    if (index >= 0) value.challengeFavorites.splice(index, 1);
    else value.challengeFavorites.push(id);
    save();
    return index < 0;
  }

  function totalXp(input) {
    return Object.values(ensure(input).challengeCompletions)
      .reduce((sum, item) => sum + Math.max(0, Number(item.xpGranted) || 0), 0);
  }

  function technologyStats(input) {
    const grouped = {};
    for (const technology of LX.ChallengeCatalog.technologies) {
      grouped[technology.id] = { technology, xp: 0, completed: 0, available: 0 };
    }
    for (const challenge of LX.ChallengeCatalog.challenges) {
      if (challenge.status === 'published' && grouped[challenge.technology]) grouped[challenge.technology].available++;
    }
    for (const completion of Object.values(ensure(input).challengeCompletions)) {
      if (!grouped[completion.technology]) continue;
      grouped[completion.technology].completed++;
      grouped[completion.technology].xp += Math.max(0, Number(completion.xpGranted) || 0);
    }
    return Object.values(grouped).map(item => Object.assign(item, { level: levelForXp(item.xp) }));
  }

  function summary(input) {
    const value = ensure(input);
    const xp = totalXp(value);
    const completions = Object.values(value.challengeCompletions);
    return {
      xp,
      level: levelForXp(xp),
      completed: completions.length,
      withoutHints: completions.filter(item => item.withoutHints).length,
      incidents: completions.filter(item => item.type === 'incident').length,
      technologies: technologyStats(value),
      rewardAuthority: value.v2.rewardAuthority
    };
  }

  LX.V2Progress = {
    version: VERSION,
    ensure,
    thresholdForLevel,
    levelForXp,
    start,
    attempt,
    recordHint,
    recordValidation,
    complete,
    toggleFavorite,
    totalXp,
    technologyStats,
    summary
  };
})();
