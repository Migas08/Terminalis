/* =========================================================================
   TERMINALIS — aplicação: navegação, progresso, desafios
   ========================================================================= */
'use strict';
(function () {
  const { query: $, queryAll: $$, escapeHtml: esc } = LX.Util;

  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none" opacity=".18"/><circle cx="12" cy="12" r="9.5"/><path d="M8 12.4l2.6 2.6L16 9.6"/></svg>',
    ring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/></svg>',
    circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
    terminal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-5-6-5"/><path d="M12 19h8"/></svg>',
    files: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 4.5v15l13-7.5z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    verify: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3"/><path d="M10 13v3h4v-3M8 20h8"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.3"/><path d="M12 17h.01"/></svg>'
  };
  LX.ICON = ICON;

  /* ============================== progresso ============================== */
  const VAZIO = () => (LX.PROGRESSO_VAZIO ? LX.PROGRESSO_VAZIO()
    : { lessons: {}, tasks: {}, notes: {}, projetos: {}, desbloqueios: {}, seconds: 0, lastLesson: null, streakDays: [], atualizadoEm: 0 });
  const Progress = {
    data: VAZIO(),
    /* O progresso vem do usuário autenticado — nunca de um armazenamento global. */
    load() {
      this.data = (LX.Auth && LX.Auth.usuario) ? LX.Auth.progresso : VAZIO();
      return this.data;
    },
    replace(d) { this.data = Object.assign(VAZIO(), d || {}); if (LX.Auth) LX.Auth.progresso = this.data; return this.data; },
    save() {
      this.data.atualizadoEm = Date.now();
      if (LX.Auth && LX.Auth.usuario) { LX.Auth.progresso = this.data; LX.Auth.agendarGravacao(this.data); }
    },
    lessonDone(id) { return !!this.data.lessons[id]; },
    markLesson(id, v) { if (v) this.data.lessons[id] = Date.now(); else delete this.data.lessons[id]; this.save(); },
    taskDone(id) { return !!this.data.tasks[id]; },
    markTask(id) { if (!this.data.tasks[id]) { this.data.tasks[id] = Date.now(); this.save(); return true; } return false; },
    reset() { this.data = VAZIO(); this.save(); }
  };
  LX.Progress = Progress;

  /* ============================== aplicação ============================== */
  class App {
    constructor() {
      this.course = LX.COURSE;
      this.route = { view: 'home', mod: null, lesson: null };
      this.trilhaId = null;
      this.openMods = new Set();
      this.sessionStart = Date.now();
    }

    async start() {
      Progress.load();
      this.avaliarProgressao(false);
      this.pintarConta();
      this.buildMachine();
      this.term = new LX.Terminal(document.getElementById('side-panel'), this);
      this.term.boot(this.machine);
      this.bindChrome();
      this.renderRail();
      this.startClock();
      try { this.trilhaId = localStorage.getItem(this.chaveTrilha()) || null; } catch (e) { }
      // Liga a sincronização em nuvem e restaura o laboratório salvo. Precisa
      // rodar tanto aqui (boot com sessão ativa e primeiro login) quanto em
      // entrarComUsuario (troca de conta) — sem isto, no fluxo normal a VM
      // nunca é salva nem restaurada do Supabase.
      await this.iniciarNuvem();
      const last = Progress.data.lastLesson;
      if (last && this.findLesson(last)) { this.trilhaId = (LX.trilhaDe(this.findLesson(last).mod.id) || {}).id || this.trilhaId; this.goLesson(last); }
      else if (this.trilhaId && LX.trilhaPorId(this.trilhaId)) this.goRoadmap();
      else this.goHome();
      this.term.focus();
    }

    buildMachine() {
      this.machine = new LX.Machine();
      LX.installBinaries(this.machine);
      if (LX.DockerEngine) this.machine.docker = new LX.DockerEngine(this.machine);
      // cenário base de arquivos para os primeiros módulos
      if (LX.seedWorkspace) LX.seedWorkspace(this.machine);
    }

    resetEnvironment() {
      if (!confirm('Recriar a máquina do zero? Os arquivos que você criou no terminal serão perdidos (seu progresso nas aulas é mantido).')) return;
      this.buildMachine();
      this.term.boot(this.machine);
      this.toast('Ambiente reiniciado');
      if (this.route.view === 'lesson') this.applyLessonSetup();
      // Recriar a máquina também é uma alteração persistente do workspace: marca
      // como sujo para que a máquina limpa seja salva e propagada a outros
      // dispositivos, sem depender de o aluno rodar mais um comando.
      if (LX.Sync) LX.Sync.marcarSujo('workspace');
    }

    /* Recebe um progresso novo (troca de perfil ou sincronização) */
    recarregarProgresso(dados) {
      Progress.replace(dados);
      this.renderRail();
      if (this.route.view === 'lesson' && this.findLesson(this.route.lesson)) this.goLesson(this.route.lesson);
      else if (this.route.view === 'roadmap') this.renderRoadmap();
    }

    /* ====================== conta, sessão e progressão ====================== */

    /* Entrada depois do login: tudo é reconstruído para o usuário novo. */
    async entrarComUsuario() {
      // Troca de conta: descarta todo o estado de sync do usuário anterior
      // (revisão, assinatura, conflito, pausa, timers) antes de restaurar o novo.
      if (LX.Sync) LX.Sync.resetarSessao();
      Progress.load();
      this.openMods = new Set();
      this.trilhaId = null;
      this.sessionStart = Date.now();
      this.avaliarProgressao(false);
      this.buildMachine();
      this.term.boot(this.machine);
      this.pintarConta();
      this.renderRail();
      await this.iniciarNuvem();
      const last = Progress.data.lastLesson;
      if (last && this.findLesson(last)) this.goLesson(last); else this.goHome();
      this.term.focus();
    }

    async sair() {
      if (!confirm('Sair da conta? Seu progresso já está salvo e volta quando você entrar de novo.')) return;
      if (LX.Sync) await LX.Sync.capturarAgora();
      await LX.Auth.gravarAgora(Progress.data);
      await LX.Auth.sair();
      // A gravação pendente já foi capturada acima; agora zera o estado de sync
      // para que a próxima conta não herde revisão/conflito/pausa desta sessão.
      if (LX.Sync) LX.Sync.resetarSessao();
      Progress.replace(null);
      $('#conta-menu').classList.add('hidden');
      try { localStorage.removeItem(this.chaveTrilha()); } catch (e) { }
      LX.AuthUI.mostrar('entrar');
    }

    chaveTrilha() { return 'terminalis.trilha.' + ((LX.Auth.usuario && LX.Auth.usuario.uid) || 'anon'); }

    pintarConta() {
      const u = LX.Auth && LX.Auth.usuario;
      const chip = $('#conta-chip');
      if (!chip) return;
      const iniciais = u ? (u.nome || u.usuario).trim().slice(0, 2).toUpperCase() : '?';
      chip.innerHTML = `<span class="av">${esc(iniciais)}</span><span>${esc(u ? u.usuario : 'entrar')}</span>`;
      const modoNuvem = LX.Store.modo === 'nuvem' || LX.Store.modo === 'supabase';
      const modo = modoNuvem
        ? (LX.Store.modo === 'supabase' ? 'na nuvem (Supabase)' : 'na nuvem da plataforma')
        : 'neste navegador';
      const sync = $('#sync-state');
      if (sync) {
        sync.className = 'sync-state ' + (modoNuvem ? 'dot-ok' : 'dot-local');
        sync.innerHTML = `<i></i><span>${u ? esc(u.usuario) : 'sem conta'}</span>`;
      }
      const st = this.stats();
      $('#conta-menu').innerHTML = u ? `
        <div class="cm-head">
          <span class="av grande">${esc(iniciais)}</span>
          <span><span class="nm">${esc(u.nome || u.usuario)}</span><br><span class="em">${esc(u.email)}</span></span>
        </div>
        <div class="cm-linha"><span>Aulas concluídas</span><b>${st.done}</b></div>
        <div class="cm-linha"><span>Desafios verificados</span><b>${st.tasks}</b></div>
        <div class="cm-linha"><span>Progresso salvo</span><b>${modo}</b></div>
        <div class="cm-sep"></div>
        <button class="cm-btn" id="cm-sair">Sair da conta</button>` : '';
      const sair = $('#cm-sair');
      if (sair) sair.onclick = () => this.sair();
    }

    alternarMenuConta() {
      this.pintarConta();
      $('#conta-menu').classList.toggle('hidden');
    }

    /* Recalcula os desbloqueios a partir do progresso real e avisa o aluno. */
    avaliarProgressao(avisar) {
      if (!LX.Progressao) return;
      const r = LX.Progressao.avaliar(Progress.data);
      if (r.mudou) Progress.save();
      if (avisar && (r.novas.length || r.etapasNovas.length)) {
        for (const e of r.etapasNovas) this.toast('Etapa concluída: ' + e.etapa.nome);
        for (const id of r.novas) {
          const t = LX.trilhaPorId(id);
          if (t) this.toast('Curso desbloqueado: ' + t.nome);
        }
        if (this.route.view === 'home') this.renderHome();
        else if (this.route.view === 'jornada') LX.Jornada.renderJornada(this);
      }
      return r;
    }

    /* ----------------------------- estrutura ----------------------------- */
    trilha() { return this.trilhaId ? LX.trilhaPorId(this.trilhaId) : null; }
    modulosDaTrilha() {
      const t = this.trilha();
      if (!t) return this.course.modules;
      return this.course.modules.filter(m => (t.mods || []).includes(m.id));
    }
    allLessons() {
      const out = [];
      for (const m of this.modulosDaTrilha()) for (const l of m.lessons) out.push({ mod: m, lesson: l });
      return out;
    }
    todasAsLicoes() {
      const out = [];
      for (const m of this.course.modules) for (const l of m.lessons) out.push({ mod: m, lesson: l });
      return out;
    }
    statsTrilha(t) {
      const mods = this.course.modules.filter(m => (t.mods || []).includes(m.id));
      const licoes = mods.flatMap(m => m.lessons);
      const feitas = licoes.filter(l => Progress.lessonDone(l.id)).length;
      return { mods: mods.length, licoes: licoes.length, feitas, pct: licoes.length ? Math.round(feitas / licoes.length * 100) : 0 };
    }
    findLesson(id) { return this.todasAsLicoes().find(x => x.lesson.id === id) || null; }
    lessonIndex(id) { return this.allLessons().findIndex(x => x.lesson.id === id); }

    stats() {
      const all = this.allLessons();
      const done = all.filter(x => Progress.lessonDone(x.lesson.id)).length;
      const tasks = Object.keys(Progress.data.tasks).length;
      let totalTasks = 0;
      for (const { lesson } of all) totalTasks += (lesson.tasks || []).length;
      const modsDone = this.course.modules.filter(m => m.lessons.length && m.lessons.every(l => Progress.lessonDone(l.id))).length;
      return { total: all.length, done, pct: all.length ? Math.round(done / all.length * 100) : 0, tasks, totalTasks, modsDone, totalMods: this.course.modules.length };
    }

    /* ----------------------------- chrome ----------------------------- */
    bindChrome() {
      $('#rail-toggle').onclick = () => { const open=document.body.classList.toggle('rail-open'); $('#rail-toggle').setAttribute('aria-expanded',String(open)); };
      document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('rail-open');$('#rail-toggle').setAttribute('aria-expanded','false');}});
      $('#btn-bell').onclick = () => this.goJornada();
      document.addEventListener('click', (e) => {
        if (document.body.classList.contains('rail-open') && !e.target.closest('#sidebar') && !e.target.closest('#rail-toggle'))
          document.body.classList.remove('rail-open');
      });
      const irNav = (n) => {
        document.body.classList.remove('rail-open');
        if (n === 'home') this.goHome();
        else if (n === 'cursos') this.goCursos();
        else if (n === 'jornada') this.goJornada();
        else if (n === 'projetos') this.goProjetos();
        else if (n === 'config') this.goPage('config');
      };
      $$('.sb-item[data-nav]').forEach(b => b.onclick = () => irNav(b.dataset.nav));
      $$('.mobile-tabs button[data-nav]').forEach(b => b.onclick = () => irNav(b.dataset.nav));
      $$('.mobile-tabs [data-m]').forEach(b=>b.onclick=()=>{document.body.classList.toggle('show-term',b.dataset.m==='term');$$('.mobile-tabs [data-m]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(b.dataset.m==='term')this.switchTab('term');});
      $('#sb-brand').onclick = () => this.goHome();
      $('#sb-brand').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.goHome();}};
      const tb = $('#topback'); if (tb) tb.onclick = () => this.voltar();
      $('#conta-chip').onclick = (e) => { e.stopPropagation(); this.alternarMenuConta(); };
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.conta-wrap')) $('#conta-menu').classList.add('hidden');
      });
      $$('.sp-tab').forEach(t => t.onclick = () => this.switchTab(t.dataset.tab));
      this.bindWorkspaceResizer();
      $('#btn-reset-term').onclick = () => this.resetEnvironment();
      $('#btn-new-term').onclick = () => { this.term.clear(); this.term.prompt(); this.term.focus(); };
      const notes = $('#notes-area');
      notes.addEventListener('input', () => {
        const key = this.route.lesson || '_geral';
        Progress.data.notes[key] = notes.value;
        Progress.save();
        $('#notes-status').textContent = 'salvo';
        clearTimeout(this._nt);
        this._nt = setTimeout(() => { $('#notes-status').textContent = 'salvo automaticamente'; }, 1200);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('rail-open')) document.body.classList.remove('rail-open');
        if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); this.switchTab('term'); this.term.focus(); }
      });
    }

    bindWorkspaceResizer() {
      const handle = $('#workspace-resizer'), body = $('#body');
      if (!handle || !body) return;
      const aplicar = (x) => {
        if (!document.body.classList.contains('lab-code')) return;
        const r = body.getBoundingClientRect();
        const pct = Math.max(28, Math.min(62, ((x - r.left) / r.width) * 100));
        body.style.setProperty('--lesson-pct', pct.toFixed(1) + '%');
      };
      handle.addEventListener('pointerdown', e => {
        e.preventDefault(); handle.setPointerCapture(e.pointerId); handle.classList.add('dragging');
      });
      handle.addEventListener('pointermove', e => { if (handle.hasPointerCapture(e.pointerId)) aplicar(e.clientX); });
      handle.addEventListener('pointerup', e => { if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId); handle.classList.remove('dragging'); });
      handle.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const atual = parseFloat(getComputedStyle(body).getPropertyValue('--lesson-pct')) || 40;
        body.style.setProperty('--lesson-pct', Math.max(28, Math.min(62, atual + (e.key === 'ArrowRight' ? 2 : -2))) + '%');
      });
    }

    switchTab(tab) {
      // Se a aba pedida está escondida (ex.: terminal no curso JS), cai para uma visível.
      const alvo = $('.sp-tab[data-tab="' + tab + '"]');
      if (alvo && alvo.classList.contains('hidden')) {
        const js = $('.sp-tab[data-tab="js"]');
        tab = (js && !js.classList.contains('hidden')) ? 'js' : ($('.sp-tab:not(.hidden)') || {}).dataset?.tab || 'term';
      }
      $$('.sp-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
      $$('.sp-view').forEach(v => v.classList.toggle('active', v.dataset.view === tab));
      $('#sp-term-actions').classList.toggle('hidden', tab !== 'term');
      $('#sp-file-actions').classList.toggle('hidden', tab !== 'files');
      $('#sp-js-actions').classList.toggle('hidden', tab !== 'js');
      if (tab === 'files') this.renderFiles();
      if (tab === 'js' && LX.JSWorkspace) LX.JSWorkspace.onShow(this);
      if (tab === 'notes') {
        const key = this.route.lesson || '_geral';
        $('#notes-area').value = Progress.data.notes[key] || '';
        $('#notes-title').textContent = this.route.lesson ? (this.findLesson(this.route.lesson).lesson.title) : 'Anotações gerais';
      }
      if (tab === 'term') this.term.focus();
    }

    startClock() {
      const el = $('#term-clock');
      setInterval(() => {
        const s = Math.floor((Date.now() - this.sessionStart) / 1000) + (Progress.data.seconds || 0);
        const h = String(Math.floor(s / 3600)).padStart(2, '0');
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        el.textContent = `${h}:${m}:${ss}`;
      }, 1000);
      setInterval(() => {
        Progress.data.seconds = (Progress.data.seconds || 0) + 30;
        this.sessionStart = Date.now();
        const today = new Date().toISOString().slice(0, 10);
        if (!Progress.data.streakDays.includes(today)) Progress.data.streakDays.push(today);
        Progress.save();
      }, 30000);
    }

    toast(msg) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role','status');
      t.innerHTML = `<span class="ic">${ICON.check}</span>${esc(msg)}`;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2400);
    }

    /* ----------------------------- barra lateral ----------------------------- */
    /* Os "cursos" de topo da barra lateral: as trilhas principais de estudo. */
    cursosPrincipais() {
      return ['linux', 'docker', 'git', 'js', 'ops']
        .map(id => LX.trilhaPorId(id))
        .filter(t => t && (t.mods || []).some(mid => {
          const m = this.course.modules.find(x => x.id === mid);
          return m && m.lessons.length;
        }));
    }

    /* qual "nav" de topo corresponde à rota atual */
    navAtual() {
      const v = this.route.view;
      if (v === 'jornada') return 'jornada';
      if (v === 'cursos' || v === 'curso') return 'cursos';
      if (v === 'projetos' || v === 'projeto') return 'projetos';
      if (v === 'home') return 'home';
      if (v === 'lesson') return 'cursos';
      return '';
    }

    renderRail() {
      const nav = this.navAtual();
      $$('.sb-item[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === nav));
      $$('.mobile-tabs button[data-nav]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nav === nav)));

      const cont = $('#sb-cursos');
      if (!cont) return;
      const trilhaAtiva = this.trilhaId;
      cont.innerHTML = this.cursosPrincipais().map(t => {
        const s = this.statsTrilha(t);
        const st = LX.Progressao ? LX.Progressao.status(t.id, Progress.data) : { liberada: true };
        const bloqueada = !st.liberada;
        const ativa = t.id === trilhaAtiva && (this.route.view === 'lesson' || this.route.view === 'curso');
        return `<button class="sb-curso ${ativa ? 'active' : ''}" data-curso="${t.id}" title="${esc(t.nome)}">
          <span class="sb-curso-ic c-${t.cor}">${bloqueada ? ICON.lock : t.icone}</span>
          <span class="sb-curso-body">
            <span class="sb-curso-nm">${esc(t.nome)}</span>
            <span class="sb-curso-sub">${bloqueada ? 'Bloqueado' : (s.pct === 100 ? 'Concluído' : s.pct + '% concluído')}</span>
          </span>
        </button>`;
      }).join('');
      if(this.route.view==='lesson'){const f=this.findLesson(this.route.lesson);if(f){const now=document.createElement('div');now.className='sb-current-lesson';now.setAttribute('aria-current','page');now.textContent='Aula atual · '+f.lesson.title;cont.appendChild(now);}}
      $$('.sb-curso', cont).forEach(b => b.onclick = () => { this.goCurso(b.dataset.curso); document.body.classList.remove('rail-open'); });
    }

    /* mostra/esconde o painel do terminal conforme a rota (só em aula/terminal) */
    aplicarChrome() {
      if (LX.Settings) LX.Settings.apply();
      const emAula = this.route.view === 'lesson';
      document.body.classList.toggle('route-lesson', emAula);
      document.body.classList.toggle('route-page', !emAula);
      const body = $('#body');
      if (body) body.classList.toggle('solo', !emAula);
      // No curso de JavaScript o painel é o editor JS; o terminal Linux não
      // serve à aula, então some. Fora do curso, o inverso.
      const emCursoJs = emAula && this.trilhaId === 'js';
      document.body.classList.toggle('lab-code', emCursoJs);
      document.body.classList.toggle('lab-terminal', emAula && !emCursoJs);
      const tipoLab = $('#lab-kind');
      if (tipoLab) {
        tipoLab.classList.toggle('hidden', !emAula);
        tipoLab.textContent = emCursoJs ? 'Code Lab' : 'Terminal Lab';
      }
      const mobileLab = $('.mobile-tabs [data-m="term"] span');
      if (mobileLab) mobileLab.textContent = emCursoJs ? 'Código' : 'Terminal';
      const abaJs = $('.sp-tab[data-tab="js"]');
      const abaTerm = $('.sp-tab[data-tab="term"]');
      if (abaJs) abaJs.classList.toggle('hidden', !emCursoJs);
      if (abaTerm) abaTerm.classList.toggle('hidden', emCursoJs);
      const sel = $('.sp-tab[aria-selected="true"]');
      if (sel && sel.classList.contains('hidden')) this.switchTab(emCursoJs ? 'js' : 'term');
    }

    setCrumbs(a, b) {
      const c1 = $('#crumb-1'), sep = $('#crumb-sep'), c2 = $('#crumb-2');
      if (c2) c2.textContent = b || a || '';
      if (c1) { c1.textContent = a || ''; c1.classList.toggle('hidden', !(a && b)); }
      if (sep) sep.classList.toggle('hidden', !(a && b));
      const mn = $('#mobile-now'); if (mn) mn.textContent = b || a || '';
      const semVoltar = ['home', 'cursos', 'jornada', 'projetos'].includes(this.route.view);
      const tb = $('#topback'); if (tb) tb.classList.toggle('hidden', semVoltar);
    }

    voltar() {
      if (this.route.view === 'lesson' && this.trilhaId) this.goCurso(this.trilhaId);
      else if (this.route.view === 'curso') this.goCursos();
      else if (this.route.view === 'projeto') this.goProjetos();
      else this.goHome();
    }

    /* ----------------------------- roteamento ----------------------------- */
    goHome() {
      this.route = { view: 'home', mod: null, lesson: null };
      this.trilhaId = null;
      this.setCrumbs('', 'Início');
      $('#modprog').style.visibility = 'hidden';
      $('#lesson-foot').classList.add('hidden');
      this.aplicarChrome();
      this.renderHome();
      this.renderRail();
      $('#page').scrollTop = 0;
    }

    goCursos() {
      this.route = { view: 'cursos', mod: null, lesson: null };
      this.trilhaId = null;
      this.setCrumbs('', 'Cursos');
      $('#modprog').style.visibility = 'hidden';
      $('#lesson-foot').classList.add('hidden');
      this.aplicarChrome();
      if (LX.Jornada.renderCursos) LX.Jornada.renderCursos(this); else LX.Jornada.renderJornada(this);
      this.renderRail();
      $('#page').scrollTop = 0;
    }

    goCurso(id) {
      const t = LX.trilhaPorId(id);
      if (!t) return this.goCursos();
      if (LX.Jornada.renderCurso) {
        this.trilhaId = id;
        this.route = { view: 'curso', mod: null, lesson: null };
        this.setCrumbs('Cursos', t.nome);
        $('#modprog').style.visibility = 'hidden';
        $('#lesson-foot').classList.add('hidden');
        this.aplicarChrome();
        LX.Jornada.renderCurso(this, t);
        this.renderRail();
        $('#page').scrollTop = 0;
      } else {
        this.abrirTrilha(id);
      }
    }

    goProjetos() {
      this.route = { view: 'projetos', mod: null, lesson: null };
      this.trilhaId = null;
      this.setCrumbs('', 'Projetos');
      $('#modprog').style.visibility = 'hidden';
      $('#lesson-foot').classList.add('hidden');
      this.aplicarChrome();
      if (LX.Jornada.renderProjetos) LX.Jornada.renderProjetos(this); else LX.Jornada.renderJornada(this);
      this.renderRail();
      $('#page').scrollTop = 0;
    }

    abrirTrilha(id) {
      const t = LX.trilhaPorId(id);
      if (!t || t.estado !== 'disponivel') return;
      const st = LX.Progressao.status(id, Progress.data);
      if (!st.liberada) {                       // o cadeado não é enfeite: barra aqui também
        this.toast(LX.Progressao.frasePendente(id, Progress.data) || 'Curso ainda bloqueado');
        this.goJornada(id);
        return;
      }
      this.trilhaId = id;
      try { localStorage.setItem(this.chaveTrilha(), id); } catch (e) { }
      const licoes = this.allLessons();
      if (!licoes.length) return this.mostrarEmProducao(t);
      const prox = licoes.find(x => !Progress.lessonDone(x.lesson.id));
      if (prox) this.goLesson(prox.lesson.id);
      else { this.route = { view: 'roadmap', mod: null, lesson: null }; this.setCrumbs('Terminalis', t.nome); this.renderRoadmap(); this.renderRail(); }
    }

    /* Trilha liberada mas ainda sem aulas escritas — melhor dizer do que fingir. */
    mostrarEmProducao(t) {
      this.route = { view: 'home', mod: null, lesson: null };
      this.setCrumbs('Cursos', t.nome);
      $('#modprog').style.visibility = 'hidden';
      $('#lesson-foot').classList.add('hidden');
      this.aplicarChrome();
      const mods = this.modulosDaTrilha();
      $('#page').innerHTML = `<div class="doc wide home">
        <div class="home-hero">
          <div class="eyebrow">Trilha liberada</div>
          <h1 class="title">${esc(t.nome)}</h1>
          <p class="lede">${esc(t.detalhe || t.resumo)}</p>
          <p class="lede" style="color:var(--amber)">As aulas desta trilha ainda estão sendo escritas. O acesso já é seu — assim que o conteúdo entrar, ele aparece aqui.</p>
          <div class="home-cont"><button class="btn primary" id="voltar-home">Voltar para as trilhas</button></div>
        </div>
        <div class="rm-phase"><span class="tag final">Módulos previstos</span></div>
        <div class="trilha-grid pequena">
          ${mods.map(m => `<div class="trilha-card planejado c-${t.cor}">
            <span class="tc-top"><span class="tc-tag">${esc(m.num)}</span></span>
            <span class="tc-nome">${esc(m.title)}</span>
            <span class="tc-resumo">${esc(m.blurb || '')}</span>
          </div>`).join('')}
        </div></div>`;
      const b = $('#voltar-home');
      if (b) b.onclick = () => this.goHome();
      this.renderRail();
      $('#page').scrollTop = 0;
    }

    /* O início e a jornada são desenhados por LX.Jornada (78-jornada.js). */
    renderHome() { LX.Jornada.renderHome(this); }

    goJornada(foco) {
      this.route = { view: 'jornada', mod: null, lesson: null };
      this.trilhaId = null;
      this.setCrumbs('', 'Jornada');
      $('#modprog').style.visibility = 'hidden';
      $('#lesson-foot').classList.add('hidden');
      this.aplicarChrome();
      LX.Jornada.renderJornada(this, foco);
      this.renderRail();
      $('#page').scrollTop = 0;
    }

    goRoadmap() {
      this.route = { view: 'home', mod: null, lesson: null };
      this.trilhaId = null;
      this.setCrumbs('Cursos', 'Trilha completa');
      $('#modprog').style.visibility = 'hidden';
      $('#lesson-foot').classList.add('hidden');
      this.aplicarChrome();
      this.renderRoadmap();
      this.renderRail();
      $('#page').scrollTop = 0;
    }

    goPage(name) {
      this.route = { view: 'page:' + name, mod: null, lesson: null };
      $('#modprog').style.visibility = 'hidden';
      $('#lesson-foot').classList.add('hidden');
      if (name === 'config') { this.setCrumbs('', 'Configurações'); LX.Settings.render(this); }
      if (name === 'ajuda') { this.setCrumbs('', 'Guia do terminal'); this.renderHelp(); }
      this.aplicarChrome();
      $('#page').scrollTop = 0;
      this.renderRail();
    }

    goLesson(id) {
      const found = this.findLesson(id);
      if (!found) return this.goRoadmap();
      const tr = LX.trilhaDe(found.mod.id);
      if(tr){const st=LX.Progressao.status(tr.id,Progress.data),et=st.etapas.find(e=>e.modIds.includes(found.mod.id));if(!st.liberada||et?.estado==='aguardando'){this.goCurso(tr.id);this.toast(!st.liberada?'Conclua os pré-requisitos deste curso.':'Conclua as atividades da etapa anterior para avançar.');return;}}
      if (tr) { this.trilhaId = tr.id; try { localStorage.setItem(this.chaveTrilha(), tr.id); } catch (e) { } }
      document.body.classList.remove('show-term');
      $$('.mobile-tabs [data-m]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.m==='lesson')));
      this.route = { view: 'lesson', mod: found.mod.id, lesson: id };
      this.openMods.add(found.mod.id);
      Progress.data.lastLesson = id;
      Progress.data.recentLessons = [id, ...(Progress.data.recentLessons || []).filter(x => x !== id)].slice(0, 8);
      Progress.save();
      this.setCrumbs(found.mod.title, found.lesson.n + ' ' + found.lesson.title);
      this.aplicarChrome();
      const done = found.mod.lessons.filter(l => Progress.lessonDone(l.id)).length;
      const pct = Math.round(done / found.mod.lessons.length * 100);
      $('#modprog').style.visibility = 'visible';
      $('#modprog-bar').style.width = pct + '%';
      $('#modprog-pct').textContent = pct + '%';
      $('#lesson-foot').classList.remove('hidden');
      this.renderLesson(found.mod, found.lesson);
      this.renderRail();
      this.applyLessonSetup();
      if (LX.GitVisual) LX.GitVisual.wire(this);
      $('#page').scrollTop = 0;
      if ($('.sp-tab[aria-selected="true"]').dataset.tab === 'notes') this.switchTab('notes');
    }

    applyLessonSetup() {
      const f = this.findLesson(this.route.lesson);
      if (!f || !f.lesson.setup) return;
      try { f.lesson.setup(this.machine, this.term); }
      catch (e) { console.warn(`[Terminalis] Falha ao preparar a aula ${f.lesson.id}:`, e); }
    }

    /* ----------------------------- render de aula ----------------------------- */
    renderLesson(mod, lesson) {
      const idx = this.lessonIndex(lesson.id);
      const all = this.allLessons();
      const prev = idx > 0 ? all[idx - 1] : null;
      const next = idx < all.length - 1 ? all[idx + 1] : null;

      let html = `<div class="doc">
        <div class="doc-top">
          <div class="eyebrow">Aula ${esc(lesson.n)}</div>
          <div class="doc-tools">
            <button class="icon-btn" id="btn-copy-link" title="Copiar referência da aula">${ICON.link}</button>
          </div>
        </div>
        <h1 class="title">${esc(lesson.title)}</h1>`;
      if (lesson.goal) html += `<p class="lede">${lesson.goal}</p>`;
      /* "O que você vai aprender" — a partir dos títulos de seção da aula */
      const pontos = lesson.objectives || (lesson.body || []).filter(b => b && b.h2).map(b => String(b.h2).replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 5);
      if (pontos.length >= 2) {
        html += `<div class="learn-box"><div class="learn-tt">${ICON.bulb} O que você vai aprender</div>
          <ul class="learn-list">${pontos.map(p => `<li>${ICON.check}<span>${esc(p)}</span></li>`).join('')}</ul></div>`;
      }
      html += LX.renderBlocks(lesson.body || [], this);
      for (const t of (lesson.tasks || [])) html += this.renderTask(t);
      html += `</div>`;
      $('#page').innerHTML = html;

      // rodapé
      const foot = $('#lesson-foot');
      const doneNow = Progress.lessonDone(lesson.id);
      foot.innerHTML =
        `<button class="nav-btn" id="nav-prev" ${prev ? '' : 'disabled'}>${ICON.prev}<span>Aula anterior</span></button>
         <div class="spacer"></div>
         <button class="nav-btn ${doneNow ? '' : 'ready'}" id="nav-done">${doneNow ? '✓ Aula concluída' : 'Marcar como concluída'}</button>
         <button class="nav-btn next ready" id="nav-next" ${next ? '' : 'disabled'}><span>Próxima aula</span>${ICON.next}</button>`;
      $('#nav-prev').onclick = () => prev && this.goLesson(prev.lesson.id);
      $('#nav-next').onclick = () => {
        if (!Progress.lessonDone(lesson.id) && lesson.tasks.every(t => Progress.taskDone(t.id))) { Progress.markLesson(lesson.id, true); this.avaliarProgressao(true); }
        next && this.goLesson(next.lesson.id);
      };
      $('#nav-done').onclick = () => {
        if (!Progress.lessonDone(lesson.id) && !lesson.tasks.every(t => Progress.taskDone(t.id))) return this.toast('Conclua as atividades para concluir esta aula.');
        Progress.markLesson(lesson.id, !Progress.lessonDone(lesson.id));
        this.avaliarProgressao(true);
        this.renderRail();
        this.goLesson(lesson.id);
      };
      const cl = $('#btn-copy-link');
      if (cl) cl.onclick = () => this.copyText(`Terminalis — aula ${lesson.n}: ${lesson.title}`);

      this.wireDoc();
    }

    async copyText(text) {
      try { if(!navigator.clipboard)throw new Error('unavailable');await navigator.clipboard.writeText(text);this.toast('Copiado'); }
      catch { this.toast('Não foi possível copiar. Selecione o texto e copie pelo navegador.'); }
    }

    wireDoc() {
      $$('.code-btn[data-run]').forEach(b => b.onclick = async () => {
        this.switchTab('term');
        document.body.classList.add('show-term');
        $$('.mobile-tabs button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === 'term')));
        const cmds = b.dataset.run.split('\n').filter(Boolean);
        for (const c of cmds) await this.term.runVisible(c);
      });
      $$('.code-btn[data-copy]').forEach(b => b.onclick = () => {
        const pre = b.closest('.code').querySelector('pre');
        const text = Array.from(pre.querySelectorAll('.cmdline')).map(x => x.dataset.cmd).join('\n') || pre.textContent;
        this.copyText(text);
      });
      $$('.code-btn[data-open-editor]').forEach(b => b.onclick = () => {
        const pre = b.closest('.code').querySelector('pre');
        if (!pre || !LX.JSWorkspace || typeof LX.JSWorkspace.openSnippet !== 'function') return;
        LX.JSWorkspace.openSnippet(this, pre.textContent);
        this.toast('Exemplo aberto no Code Lab');
      });
      $$('[data-task]').forEach(el => this.wireTask(el));
    }

    onCommandRun() {
      if (LX.GitVisual) LX.GitVisual.refresh(this);
      if ($('.sp-tab[aria-selected="true"]').dataset.tab === 'files') this.renderFiles();
      if (LX.Sync) LX.Sync.marcarSujo('workspace');
    }

    aplicarWorkspaceRestaurado(restaurado) {
      if (!restaurado || !restaurado.machine) return;
      this.machine = restaurado.machine;
      if (restaurado.environment && restaurado.environment.trilhaId) this.trilhaId = restaurado.environment.trilhaId;
      if (this.term && this.term.bootRestored) this.term.bootRestored(restaurado);
      if (this.route && this.route.view === 'files') this.renderFiles();
    }

    async iniciarNuvem() {
      if (!LX.Sync) return;
      LX.Sync.iniciar(this);
      if (LX.Auth?.backend !== 'supabase' && LX.Store?.modo !== 'supabase') return;
      const uid = LX.Auth && LX.Auth.usuario ? LX.Auth.usuario.uid : null;
      if (!uid) return;
      this.overlayRestauracao(true);
      try {
        await LX.Sync.migrarLocais(uid);
        await LX.Sync.restaurar(uid);
      } catch (e) { console.warn(`[Terminalis] Falha ao iniciar a nuvem para ${uid}:`, e); }
      this.overlayRestauracao(false);
    }

    overlayRestauracao(mostrar) {
      let el = document.getElementById('restore-overlay');
      if (mostrar) {
        if (!el) {
          el = document.createElement('div');
          el.id = 'restore-overlay';
          el.innerHTML = '<div class="ro-card"><span class="ro-spin"></span><span>Restaurando seu ambiente…</span></div>';
          document.body.appendChild(el);
        }
        el.classList.remove('hidden');
      } else if (el) el.classList.add('hidden');
    }

    /* ----------------------------- roadmap ----------------------------- */
    renderRoadmap() {
      const st = this.stats();
      const tr = this.trilha();
      let html = `<div class="doc wide">
        <div class="eyebrow">Trilha de aprendizado</div>
        <h1 class="title">${esc(tr ? tr.nome : 'Do primeiro comando ao servidor em produção')}</h1>
        <p class="lede">${esc(tr && tr.detalhe ? tr.detalhe : 'Uma sequência única: cada módulo assume o anterior. Você lê, pratica no terminal ao lado e só avança depois de resolver.')}</p>
        <div class="stat-grid">
          <div class="stat"><div class="v">${st.pct}%</div><div class="l">Progresso</div></div>
          <div class="stat"><div class="v">${st.done}<span style="color:var(--tx-3);font-size:16px">/${st.total}</span></div><div class="l">Aulas</div></div>
          <div class="stat"><div class="v">${st.tasks}<span style="color:var(--tx-3);font-size:16px">/${st.totalTasks}</span></div><div class="l">Desafios</div></div>
          <div class="stat"><div class="v">${st.modsDone}<span style="color:var(--tx-3);font-size:16px">/${st.totalMods}</span></div><div class="l">Módulos</div></div>
        </div>`;

      let lastGroup = null;
      let firstIncomplete = true;
      for (const m of this.modulosDaTrilha()) {
        if (m.group !== lastGroup) {
          if (lastGroup !== null) html += `</div>`;
          const g = m.group.toLowerCase();
          const tag = g.includes('docker') ? 'docker' : (g.includes('final') || g.includes('projet') || g.includes('opera') ? 'final' : 'linux');
          html += `<div class="rm-phase"><span class="tag ${tag}">${esc(m.group)}</span></div><div class="rm-track">`;
          lastGroup = m.group;
        }
        const done = m.lessons.filter(l => Progress.lessonDone(l.id)).length;
        const complete = done === m.lessons.length && m.lessons.length > 0;
        if (!m.lessons.length) { html += `<div class="rm-node"><button class="rm-card" data-mod="${m.id}" disabled style="opacity:.5;cursor:default"><span class="n">${esc(m.num)}</span><span><span class="t">${esc(m.title)}</span><span class="d">${esc(m.blurb || '')}</span></span><span class="pg">em breve</span></button></div>`; continue; }
        let cls = complete ? 'done' : '';
        if (!complete && firstIncomplete) { cls = 'current'; firstIncomplete = false; }
        html += `<div class="rm-node ${cls}">
          <button class="rm-card" data-mod="${m.id}">
            <span class="n">${esc(m.num)}</span>
            <span><span class="t">${esc(m.title)}</span><span class="d">${esc(m.blurb || '')}</span></span>
            <span class="pg ${complete ? 'full' : ''}">${m.lessons.length ? done + '/' + m.lessons.length : 'em breve'}</span>
          </button></div>`;
      }
      if (lastGroup !== null) html += `</div>`;
      html += `</div>`;
      $('#page').innerHTML = html;
      $$('.rm-card').forEach(b => b.onclick = () => {
        const m = this.course.modules.find(x => x.id === b.dataset.mod);
        if (m && m.lessons.length) {
          const nextL = m.lessons.find(l => !Progress.lessonDone(l.id)) || m.lessons[0];
          this.goLesson(nextL.id);
        }
      });
    }

    renderHelp() {
      $('#page').innerHTML = `<div class="doc">
        <div class="eyebrow">Guia rápido</div>
        <h1 class="title">Como usar esta plataforma</h1>
        <p class="lede">O terminal à direita é um simulador educacional de Linux no navegador: sistema de arquivos, permissões, processos, serviços, rede e Docker. Os comandos suportados modificam o estado do laboratório; não executam programas no seu computador.</p>
        <h2>O ciclo</h2>
        <p>Cada aula segue o mesmo caminho: você <strong>lê</strong> a explicação, <strong>testa</strong> os exemplos no terminal, resolve o <strong>exercício guiado</strong>, responde uma <strong>pergunta conceitual</strong> e resolve uma <strong>atividade prática</strong>.</p>
        <p>Quando você clica em <em>Verificar desafio</em>, a plataforma não olha o que você digitou: ela inspeciona o <strong>estado real da máquina</strong> — se o diretório existe, se a permissão está certa, se o serviço subiu. Existem muitos caminhos para o mesmo resultado, e todos valem.</p>
        <h2>Teclas do terminal</h2>
        <div class="cheat">
          <div class="cheat-row"><code>Tab</code><span>Completa comandos e caminhos</span></div>
          <div class="cheat-row"><code>↑ / ↓</code><span>Navega pelo histórico</span></div>
          <div class="cheat-row"><code>Ctrl+C</code><span>Interrompe o comando em execução</span></div>
          <div class="cheat-row"><code>Ctrl+L</code><span>Limpa a tela</span></div>
          <div class="cheat-row"><code>Ctrl+A / Ctrl+E</code><span>Início / fim da linha</span></div>
          <div class="cheat-row"><code>Ctrl+U / Ctrl+K</code><span>Apaga até o início / fim da linha</span></div>
          <div class="cheat-row"><code>Ctrl+W</code><span>Apaga a palavra anterior</span></div>
          <div class="cheat-row"><code>Ctrl+D</code><span>Sai de uma sessão aninhada (ssh, container)</span></div>
        </div>
        <h2>Editar arquivos</h2>
        <p>Use <code>nano arquivo.sh</code> para abrir o editor em tela cheia. <span class="kbd">Ctrl+S</span> grava, <span class="kbd">Ctrl+X</span> grava e sai, <span class="kbd">Esc</span> sai sem gravar. Também funciona <code>cat &gt; arquivo &lt;&lt; 'EOF'</code>.</p>
        <h2>Se você quebrar tudo</h2>
        <p>Ótimo — quebrar é parte do aprendizado. O botão <em>Resetar terminal</em>, no topo do painel, recria a máquina do zero. Seu progresso nas aulas não é perdido.</p>
        <div class="box note"><div class="box-label">Onde fica salvo</div><p>Aulas concluídas, desafios verificados, anotações e tempo de estudo ficam gravados <strong>na sua conta</strong> — separados dos de qualquer outra pessoa que use esta plataforma. Sua senha nunca é guardada: o que fica é um hash PBKDF2-SHA256 com salt próprio, do qual não dá para voltar à senha. A máquina do terminal, essa sim, vive só na memória da aba: resetar ou fechar não afeta o seu progresso.</p></div>
      </div>`;
    }
  }

  LX.App = App;
})();
