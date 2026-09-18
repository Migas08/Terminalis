/* =========================================================================
   TERMINALIS V2 — catálogo data-driven de tecnologias e desafios
   ========================================================================= */
'use strict';
(function () {
  const DIFFICULTIES = ['beginner', 'easy', 'intermediate', 'advanced', 'expert'];
  const TYPES = ['command', 'debugging', 'incident', 'code', 'configuration', 'project'];
  const STATUS = ['draft', 'published', 'archived'];

  const labels = {
    difficulties: {
      beginner: 'Iniciante', easy: 'Fácil', intermediate: 'Intermediário',
      advanced: 'Avançado', expert: 'Especialista'
    },
    types: {
      command: 'Comandos', debugging: 'Debugging', incident: 'Incidente',
      code: 'Código', configuration: 'Configuração', project: 'Projeto'
    }
  };

  const catalog = {
    technologies: [],
    challenges: [],
    technologyById: new Map(),
    challengeById: new Map(),
    challengeBySlug: new Map()
  };

  function fail(message) { throw new Error('Catálogo V2: ' + message); }
  function plainText(value, field) {
    const text = String(value == null ? '' : value).trim();
    if (!text) fail('`' + field + '` é obrigatório');
    return text;
  }
  function validSlug(value, field) {
    const slug = plainText(value, field);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('`' + field + '` deve ser um slug em kebab-case');
    return slug;
  }
  function list(value) { return Array.isArray(value) ? value.slice() : []; }

  function registerTechnology(spec) {
    spec = spec || {};
    const technology = {
      id: validSlug(spec.id || spec.slug, 'technology.id'),
      slug: validSlug(spec.slug || spec.id, 'technology.slug'),
      name: plainText(spec.name, 'technology.name'),
      description: plainText(spec.description, 'technology.description'),
      icon: String(spec.icon || '>_'),
      status: spec.status || 'planned',
      order: Number.isFinite(spec.order) ? spec.order : 999
    };
    if (!['available', 'planned'].includes(technology.status)) fail('status de tecnologia inválido: ' + technology.status);
    if (catalog.technologyById.has(technology.id)) fail('tecnologia duplicada: ' + technology.id);
    if (catalog.technologies.some(item => item.slug === technology.slug)) fail('slug de tecnologia duplicado: ' + technology.slug);
    Object.freeze(technology);
    catalog.technologies.push(technology);
    catalog.technologies.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    catalog.technologyById.set(technology.id, technology);
    return technology;
  }

  function normalizeHint(hint, index) {
    if (typeof hint === 'string') return Object.freeze({ title: 'Dica ' + (index + 1), content: hint });
    hint = hint || {};
    return Object.freeze({
      title: String(hint.title || 'Dica ' + (index + 1)),
      content: plainText(hint.content, 'challenge.hints[' + index + '].content')
    });
  }

  function registerChallenge(spec) {
    spec = spec || {};
    const technology = plainText(spec.technology, 'challenge.technology');
    if (!catalog.technologyById.has(technology)) fail('tecnologia não registrada: ' + technology);
    const difficulty = spec.difficulty || 'easy';
    const type = spec.type || 'command';
    const status = spec.status || 'published';
    if (!DIFFICULTIES.includes(difficulty)) fail('dificuldade inválida: ' + difficulty);
    if (!TYPES.includes(type)) fail('tipo inválido: ' + type);
    if (!STATUS.includes(status)) fail('status inválido: ' + status);
    const xp = Number(spec.xp);
    if (!Number.isInteger(xp) || xp < 10 || xp > 5000) fail('XP deve ser inteiro entre 10 e 5000');
    if (typeof spec.setup !== 'function') fail('`challenge.setup` deve ser função');
    if (typeof spec.validate !== 'function') fail('`challenge.validate` deve ser função');

    const challenge = {
      id: plainText(spec.id, 'challenge.id'),
      slug: validSlug(spec.slug, 'challenge.slug'),
      title: plainText(spec.title, 'challenge.title'),
      summary: plainText(spec.summary, 'challenge.summary'),
      technology,
      difficulty,
      type,
      xp,
      status,
      version: Number.isInteger(spec.version) && spec.version > 0 ? spec.version : 1,
      estimatedMinutes: Number.isInteger(spec.estimatedMinutes) ? spec.estimatedMinutes : null,
      tags: list(spec.tags).map(String),
      skills: list(spec.skills).map(String),
      situation: plainText(spec.situation, 'challenge.situation'),
      mission: plainText(spec.mission, 'challenge.mission'),
      objectives: list(spec.objectives).map(String),
      hints: list(spec.hints).map(normalizeHint),
      concepts: list(spec.concepts).map(item => Object.freeze({
        term: plainText(item && item.term, 'challenge.concepts.term'),
        summary: plainText(item && item.summary, 'challenge.concepts.summary'),
        detail: String((item && item.detail) || '')
      })),
      setup: spec.setup,
      validate: spec.validate,
      explanation: plainText(spec.explanation, 'challenge.explanation'),
      possibleSolution: plainText(spec.possibleSolution, 'challenge.possibleSolution'),
      alternatives: list(spec.alternatives).map(String),
      extraChallenge: String(spec.extraChallenge || ''),
      referenceLessonIds: list(spec.referenceLessonIds).map(String),
      prerequisites: list(spec.prerequisites).map(String)
    };
    if (!challenge.objectives.length) fail('desafio sem objetivos: ' + challenge.id);
    if (!challenge.hints.length) fail('desafio sem dicas progressivas: ' + challenge.id);
    if (catalog.challengeById.has(challenge.id)) fail('desafio duplicado: ' + challenge.id);
    if (catalog.challengeBySlug.has(challenge.slug)) fail('slug de desafio duplicado: ' + challenge.slug);
    Object.freeze(challenge.tags);
    Object.freeze(challenge.skills);
    Object.freeze(challenge.objectives);
    Object.freeze(challenge.hints);
    Object.freeze(challenge.concepts);
    Object.freeze(challenge.alternatives);
    Object.freeze(challenge.referenceLessonIds);
    Object.freeze(challenge.prerequisites);
    Object.freeze(challenge);
    catalog.challenges.push(challenge);
    catalog.challengeById.set(challenge.id, challenge);
    catalog.challengeBySlug.set(challenge.slug, challenge);
    return challenge;
  }

  function normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function search(filters, progress) {
    filters = filters || {};
    const query = normalizeSearch(filters.query);
    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];
    const completed = (progress && progress.challengeCompletions) || {};
    const favorites = new Set((progress && progress.challengeFavorites) || []);
    return catalog.challenges.filter(challenge => {
      if (challenge.status !== 'published' && !filters.includeDrafts) return false;
      if (filters.technology && challenge.technology !== filters.technology) return false;
      if (filters.difficulty && challenge.difficulty !== filters.difficulty) return false;
      if (filters.type && challenge.type !== filters.type) return false;
      if (Number.isFinite(filters.xpMin) && challenge.xp < filters.xpMin) return false;
      if (Number.isFinite(filters.xpMax) && challenge.xp > filters.xpMax) return false;
      if (filters.status === 'completed' && !completed[challenge.id]) return false;
      if (filters.status === 'open' && completed[challenge.id]) return false;
      if (filters.status === 'favorite' && !favorites.has(challenge.id)) return false;
      if (tokens.length) {
        const haystack = normalizeSearch([
          challenge.id, challenge.title, challenge.summary, challenge.technology,
          challenge.difficulty, challenge.type, ...challenge.tags, ...challenge.skills
        ].join(' '));
        if (!tokens.every(token => haystack.includes(token))) return false;
      }
      return true;
    });
  }

  LX.ChallengeCatalog = {
    difficulties: DIFFICULTIES.slice(),
    types: TYPES.slice(),
    labels,
    technologies: catalog.technologies,
    challenges: catalog.challenges,
    registerTechnology,
    registerChallenge,
    technology(id) { return catalog.technologyById.get(id) || null; },
    challenge(idOrSlug) { return catalog.challengeById.get(idOrSlug) || catalog.challengeBySlug.get(idOrSlug) || null; },
    search
  };
  LX.technology = registerTechnology;
  LX.challenge = registerChallenge;
})();
