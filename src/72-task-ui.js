/* =========================================================================
   TERMINALIS — interface e verificação das atividades
   ========================================================================= */
'use strict';
(function () {
  const { query: $, queryAll: $$, escapeHtml: esc } = LX.Util;
  const { ICON, Progress } = LX;

  class TaskUI extends LX.App {
    renderTask(t) {
      const done = Progress.taskDone(t.id);
      const kindLabel = { guiado: 'Exercício guiado', desafio: 'Desafio', avancado: 'Desafio avançado', quiz: 'Conceito', erro: 'Encontre o erro', prever: 'Preveja o resultado', trouble: 'Investigação' }[t.kind] || t.kind;
      const kindClass = ['guiado', 'desafio', 'avancado', 'quiz'].includes(t.kind) ? t.kind : (t.kind === 'trouble' || t.kind === 'erro' ? 'avancado' : 'quiz');
      let inner = `<div class="task ${done ? 'done' : ''}" data-task="${t.id}">
        <div class="task-head">
          <span class="task-kind ${kindClass}">${esc(kindLabel)}</span>
          <span class="task-state ${done ? 'ok' : ''}">${done ? '✓ concluído' : ''}</span>
        </div>
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-body">${LX.renderBlocks(t.body || [], this)}</div>`;

      if (t.kind === 'quiz') {
        inner += `<div class="task-body quiz-opts">`;
        t.options.forEach((o, i) => {
          inner += `<div class="opt"><button data-opt="${i}"><span class="k">${'ABCDE'[i]}</span><span>${o.text}</span></button></div>`;
        });
        inner += `</div><div class="explain hidden"></div>`;
      } else if (t.kind === 'fill') {
        inner += `<div class="task-body"><div class="fill">${(t.template || '').split('___').map((p, i, a) =>
          `<span class="fixed">${esc(p)}</span>` + (i < a.length - 1 ? `<input type="text" data-blank="${i}" spellcheck="false" autocomplete="off">` : '')).join('')}</div></div>`;
      }

      if (t.hints && t.hints.length) {
        inner += `<div class="hints" id="hints-${t.id}"></div>`;
      }
      inner += `<div class="verdict hidden" role="status" aria-live="polite"></div>`;
      inner += `<div class="task-foot">`;
      if (t.hints && t.hints.length) {
        t.hints.forEach((h, i) => inner += `<button class="btn ghost small" data-hint="${i}">${ICON.bulb}Dica ${i + 1}</button>`);
      }
      if (t.solution) inner += `<button class="btn ghost small" data-solution>${ICON.eye}Ver solução</button>`;
      if (t.check || t.kind === 'fill') inner += `<button class="btn primary" data-verify>${ICON.verify}Verificar desafio</button>`;
      inner += `</div></div>`;
      return inner;
    }

    wireTask(el) {
      const id = el.dataset.task;
      const t = this.taskById(id);
      if (!t) return;
      const verdict = $('.verdict', el);
      const hintsBox = $('.hints', el);

      $$('[data-hint]', el).forEach(b => b.onclick = () => {
        const i = +b.dataset.hint;
        if ($(`[data-hint-shown="${i}"]`, hintsBox)) return;
        const d = document.createElement('div');
        d.className = 'hint';
        d.dataset.hintShown = String(i);
        d.innerHTML = `<span class="hl">Dica ${i + 1}</span>${t.hints[i]}`;
        hintsBox.appendChild(d);
        b.disabled = true;
      });
      const sol = $('[data-solution]', el);
      if (sol) sol.onclick = () => {
        if ($('.hint.solution', hintsBox)) return;
        const d = document.createElement('div');
        d.className = 'hint solution';
        d.innerHTML = `<span class="hl">Solução</span>${t.solution}`;
        (hintsBox || el).appendChild(d);
        sol.disabled = true;
      };

      $$('[data-opt]', el).forEach(b => b.onclick = () => {
        if (el.dataset.answered) return;
        el.dataset.answered = '1';
        const i = +b.dataset.opt;
        const opt = t.options[i];
        $$('[data-opt]', el).forEach((x, j) => {
          if (t.options[j].correct) x.classList.add('right');
          else if (j === i) x.classList.add('wrong');
          x.disabled = true;
        });
        const ex = $('.explain', el);
        ex.classList.remove('hidden');
        ex.innerHTML = opt.correct
          ? `<strong style="color:var(--green)">Correto.</strong> ${t.explain || opt.why || ''}`
          : `<strong style="color:var(--red)">Não é essa.</strong> ${opt.why || t.explain || ''}`;
        if (opt.correct) this.completeTask(t, el);
      });

      const vb = $('[data-verify]', el);
      if (vb) vb.onclick = async () => {
        vb.disabled = true;
        vb.textContent = 'Verificando…';
        try {
          let res;
          if (t.kind === 'fill') {
            const vals = $$('[data-blank]', el).map(i => i.value.trim());
            res = t.check ? await t.check({ vals, app: this, machine: this.machine, term: this.term, sh: this.term.sh })
              : { ok: vals.every((v, i) => new RegExp('^(?:' + t.answers[i] + ')$').test(v)), msg: 'Compare com a sintaxe apresentada na aula.' };
          } else {
            res = await t.check({ app: this, machine: this.machine, term: this.term, sh: this.term.sh, run: (c) => this.term.runQuiet(c) });
          }
          verdict.classList.remove('hidden', 'ok', 'fail');
          if (res.ok) {
            verdict.classList.add('ok');
            verdict.innerHTML = '<strong>✓ Desafio concluído.</strong>' + (res.msg ? LX.feedbackHtml(res.msg) : '');
            this.completeTask(t, el);
          } else {
            verdict.classList.add('fail');
            verdict.innerHTML = '<strong>× Ainda não.</strong>' + LX.feedbackHtml(res.msg || 'Confira o enunciado e tente de novo.');
          }
        } catch (e) {
          verdict.classList.remove('hidden', 'ok');
          verdict.classList.add('fail');
          verdict.textContent = 'Não consegui verificar: ' + e.message;
        }
        vb.disabled = false;
        vb.innerHTML = ICON.verify + 'Verificar desafio';
      };
    }

    taskById(id) {
      for (const { lesson } of this.allLessons()) {
        for (const t of (lesson.tasks || [])) if (t.id === id) return t;
      }
      for (const p of (this.course.pages || [])) for (const t of (p.tasks || [])) if (t.id === id) return t;
      return null;
    }

    completeTask(t, el) {
      const fresh = Progress.markTask(t.id);
      el.classList.add('done');
      const st = $('.task-state', el);
      st.classList.add('ok');
      st.textContent = '✓ concluído';
      if (fresh) {
        this.toast('Desafio concluído');
        this.renderRail();
      }
      // aula completa se todos os desafios verificáveis foram feitos
      const f = this.findLesson(this.route.lesson);
      if (f) {
        const req = (f.lesson.tasks || []).filter(x => x.check || x.kind === 'quiz');
        if (req.length && req.every(x => Progress.taskDone(x.id)) && !Progress.lessonDone(f.lesson.id)) {
          Progress.markLesson(f.lesson.id, true);
          this.renderRail();
          const btn = $('#nav-done');
          if (btn) { btn.textContent = '✓ Aula concluída'; btn.classList.remove('ready'); }
        }
      }
      this.avaliarProgressao(true);
    }
  }

  for (const name of ['renderTask', 'wireTask', 'taskById', 'completeTask']) {
    Object.defineProperty(LX.App.prototype, name, Object.getOwnPropertyDescriptor(TaskUI.prototype, name));
  }
})();
