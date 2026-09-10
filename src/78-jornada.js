/* =========================================================================
   TERMINALIS — a jornada
   ---------------------------------------------------------------------
   Duas telas construídas sobre LX.Progressao:

     · início   — o próximo passo em destaque + a trilha de cursos em pé,
                  cada um com suas etapas e, se estiver fechado, a lista
                  literal do que falta para abrir.
     · jornada  — a mesma trilha aberta em detalhe: objetivos do curso,
                  etapa por etapa, módulo por módulo.

   Nada aqui decide nada: só desenha o que a progressão calculou.
   ========================================================================= */
'use strict';
(function () {
  const { query: $, queryAll: $$, escapeHtml: esc } = LX.Util;

  const IC = () => LX.ICON;

  /* Marcador de estado usado em etapas e requisitos. */
  function marca(estado) {
    if (estado === 'concluida' || estado === true) return `<span class="mk feito">${IC().check}</span>`;
    if (estado === 'atual') return `<span class="mk atual">${IC().ring}</span>`;
    if (estado === 'aguardando') return `<span class="mk trava">${IC().lock}</span>`;
    return `<span class="mk aberto">${IC().circle}</span>`;
  }

  function barra(pct, classe) {
    return `<span class="jn-bar ${classe || ''}"><i style="width:${Math.max(0, Math.min(100, pct || 0))}%"></i></span>`;
  }

  function chip(situacao) {
    const txt = LX.Progressao.rotulo(situacao);
    const ic = situacao === 'concluida' ? IC().check
      : situacao === 'bloqueada' ? IC().lock
        : situacao === 'em-andamento' ? IC().ring
          : situacao === 'planejada' ? IC().clock : IC().circle;
    return `<span class="jn-chip ${situacao}">${ic}${esc(txt)}</span>`;
  }

  /* ---------------------------- etapas de um curso ---------------------------- */

  function etapasHTML(st, detalhado) {
    if (!st.etapas.length) return '';
    return `<ol class="jn-etapas ${detalhado ? 'detalhe' : ''}">` + st.etapas.map(et => {
      const mods = detalhado
        ? `<div class="jn-mods">` + et.mods.map(m => {
          const total = m.lessons.length;
          const feitas = m.lessons.filter(l => !!(LX.Progress.data.lessons || {})[l.id]).length;
          return `<button class="jn-mod ${total && feitas === total ? 'feito' : ''} ${!total ? 'vazio' : ''}"
                    data-ir-mod="${m.id}" ${total ? '' : 'disabled'}>
              <span class="nm">${esc(m.num)} · ${esc(m.title)}</span>
              <span class="ct">${total ? feitas + '/' + total : 'em breve'}</span>
            </button>`;
        }).join('') + `</div>`
        : '';
      return `<li class="jn-etapa ${et.estado}">
        ${marca(et.estado)}
        <div class="jn-etapa-corpo">
          <div class="jn-etapa-topo">
            <span class="jn-etapa-nome">Etapa ${et.n} · ${esc(et.nome)}</span>
            <span class="jn-etapa-num">${et.vazia ? 'em breve' : et.licoes.feitas + '/' + et.licoes.total + ' aulas · ' + et.desafios.feitos + '/' + et.desafios.total + ' desafios'}</span>
          </div>
          ${detalhado ? `<p class="jn-etapa-res">${esc(et.resumo)}</p>` : ''}
          ${et.vazia ? '' : barra(et.pct)}
          ${mods}
        </div>
      </li>`;
    }).join('') + `</ol>`;
  }

  /* ------------------------------ requisitos ------------------------------ */

  function requisitosHTML(id, prog) {
    const reqs = LX.Progressao.requisitos(id, prog);
    if (!reqs.length) return '';
    const feitos = reqs.filter(r => r.ok).length;
    return `<div class="jn-req">
      <div class="jn-req-cab">Para desbloquear <b>${feitos} de ${reqs.length}</b></div>
      <ul class="jn-req-lista">
        ${reqs.map(r => `<li class="${r.ok ? 'ok' : ''}">
          ${marca(r.ok ? 'concluida' : 'aberto')}
          <span class="tx"><span class="t">${esc(r.titulo)}</span><span class="d">${esc(r.detalhe)}</span>
          ${r.ok ? '' : barra(r.pct, 'fina')}</span>
        </li>`).join('')}
      </ul>
    </div>`;
  }

  /* ============================== TELA INICIAL ============================== */

  /* estado curto de um nó da jornada, para os cartões */
  function estadoCard(st) {
    if (st.concluida) return { cls: 'done', ic: IC().check, txt: 'Concluído' };
    if (!st.liberada) return { cls: 'lock', ic: IC().lock, txt: 'Bloqueado' };
    if (st.proprio && st.proprio.vazia) return { cls: 'lock', ic: IC().clock, txt: 'Em breve' };
    return { cls: 'prog', ic: IC().ring, txt: 'Em andamento' };
  }

  function renderHome(app) {
    const prog=LX.Progress.data, states=LX.Progressao.jornada(prog).filter(s=>!s.planejada);
    const total=states.reduce((v,s)=>v+s.proprio.licoes.total,0), done=states.reduce((v,s)=>v+s.proprio.licoes.feitas,0);
    const current=states.find(s=>s.liberada&&!s.concluida&&!s.proprio.vazia)||states[0];
    const recent=(prog.recentLessons||[]).map(id=>app.findLesson(id)).filter(Boolean).slice(0,4);
    const resume=app.findLesson(prog.lastLesson);
    $('#page').innerHTML=`<div class="doc wide home study-home">
      <header class="study-hero"><div class="eyebrow">SEU ESPAÇO DE PRÁTICA / TERMINALIS</div><h1>Entenda o código.<br>Assuma o terminal.</h1><p>Linux, containers e controle de versão. Aprenda o conceito, experimente no laboratório e comprove o que sabe.</p></header>
      <section class="study-resume"><div><div class="eyebrow">${resume?'CONTINUAR DE ONDE PAROU':'SEU PRIMEIRO PASSO'}</div><h2>${esc(resume?.lesson.title||current.trilha.nome)}</h2><p>${esc(resume?.mod.title||current.trilha.resumo)}</p></div><button class="btn primary" id="hm-continuar">${resume?'Retomar aula':'Começar a estudar'} ${IC().next}</button></section>
      <section class="study-overview" aria-label="Progresso geral"><strong>${total?Math.round(done/total*100):0}<small>%</small></strong><div><span>Progresso geral</span>${barra(total?done/total*100:0)}<p>${done} de ${total} aulas concluídas · ${Object.values(prog.tasks||{}).filter(Boolean).length} atividades concluídas</p></div><button class="lk" id="hm-ver-jornada">Ver progresso ${IC().next}</button></section>
      <div class="study-section-title"><h2>Suas ferramentas.</h2><span>Do fundamento à prática profissional</span></div><div class="study-courses">${states.filter(s=>['linux','docker','git'].includes(s.id)).map((s,i)=>`<button class="study-course" data-curso="${s.id}"><span class="study-course-num">0${i+1}</span><div><h3>${esc(s.trilha.nome)}</h3><p>${esc(s.trilha.resumo)}</p><span>${s.proprio.licoes.feitas}/${s.proprio.licoes.total} aulas · ${esc(LX.Progressao.rotulo(s.situacao))}</span>${barra(s.proprio.pct)}</div><strong>${s.proprio.pct}%</strong><span aria-hidden="true">↗</span></button>`).join('')}</div>
      ${recent.length?`<section class="study-recent"><h2>Acessados recentemente</h2>${recent.map(f=>`<button class="study-recent-item" data-recent="${f.lesson.id}"><span>${esc(f.mod.title)}</span><strong>${esc(f.lesson.title)}</strong><span aria-hidden="true">→</span></button>`).join('')}</section>`:''}
      <footer class="study-note">Um laboratório local para experimentar. Seu progresso é salvo automaticamente na sua conta de estudo.</footer></div>`;
    $('#hm-continuar').onclick=()=>resume?app.goLesson(resume.lesson.id):app.abrirTrilha(current.id);
    $('#hm-ver-jornada').onclick=()=>app.goJornada();
    $$('[data-curso]').forEach(b=>b.onclick=()=>app.goCurso(b.dataset.curso));
    $$('[data-recent]').forEach(b=>b.onclick=()=>app.goLesson(b.dataset.recent));
  }

  /* ============================== SUA JORNADA ============================== */

  function renderJornada(app, focoId) {
    const prog = LX.Progress.data;
    const P = LX.Progressao;
    const jornada = P.jornada(prog);
    const reais = jornada.filter(s => !s.planejada);

    const aulas = reais.reduce((a, s) => a + s.proprio.licoes.feitas, 0);
    const aulasT = reais.reduce((a, s) => a + s.proprio.licoes.total, 0);
    const des = reais.reduce((a, s) => a + s.proprio.desafios.feitos, 0);
    const desT = reais.reduce((a, s) => a + s.proprio.desafios.total, 0);
    const cursos = reais.filter(s => s.concluida).length;
    const etapasFeitas = reais.reduce((a, s) => a + s.etapas.filter(e => e.completo).length, 0);
    const horas = Math.floor((prog.seconds || 0) / 3600);
    const minutos = Math.floor(((prog.seconds || 0) % 3600) / 60);

    let html = `<div class="doc wide jornada">
      <header class="jn-hero">
        <div class="eyebrow">Sua evolução</div>
        <h1 class="title">Sua jornada</h1>
        <p class="lede">Tudo o que você já concluiu, o que está em andamento e o que falta para abrir o próximo curso. Este quadro é só seu: ele vem da sua conta e ninguém mais o enxerga.</p>
      </header>

      <div class="jn-placar">
        <div class="jp"><span class="n">${aulas}<small>/${aulasT}</small></span><span class="l">aulas concluídas</span></div>
        <div class="jp"><span class="n">${des}<small>/${desT}</small></span><span class="l">desafios verificados</span></div>
        <div class="jp"><span class="n">${etapasFeitas}</span><span class="l">etapas fechadas</span></div>
        <div class="jp"><span class="n">${cursos}<small>/${reais.length}</small></span><span class="l">cursos concluídos</span></div>
        <div class="jp"><span class="n">${horas}<small>h</small> ${String(minutos).padStart(2, '0')}<small>min</small></span><span class="l">no terminal</span></div>
      </div>`;

    for (const st of reais) {
      const t = st.trilha;
      const foco = focoId === t.id;
      html += `<section class="jn-painel c-${t.cor} ${st.situacao} ${foco ? 'foco' : ''}" id="jp-${t.id}">
        <header class="jn-painel-topo">
          <span class="jn-card-ic">${t.icone}</span>
          <div class="jn-card-tit">
            <span class="nm">${esc(t.nome)}</span>
            <span class="rs">${esc(t.detalhe || t.resumo)}</span>
          </div>
          ${chip(st.situacao)}
        </header>

        ${st.liberada && !st.proprio.vazia ? `<div class="jn-card-prog grande">
          ${barra(st.proprio.pct)}
          <span class="pc">${st.proprio.pct}%</span>
          <span class="nm2">${st.proprio.licoes.feitas}/${st.proprio.licoes.total} aulas · ${st.proprio.desafios.feitos}/${st.proprio.desafios.total} desafios</span>
        </div>` : ''}

        ${(t.objetivos || []).length ? `<div class="jn-obj">
          <span class="jn-obj-tt">Ao terminar, você sabe</span>
          <ul>${t.objetivos.map(o => `<li>${IC().check}${esc(o)}</li>`).join('')}</ul>
        </div>` : ''}

        ${st.liberada ? etapasHTML(st, true) : `
          <div class="jn-travado">
            <p class="jn-travado-tt">${IC().lock} Este curso ainda não abriu</p>
            <p class="jn-travado-p">Ele não está escondido nem trancado por tempo: abre sozinho no instante em que os itens abaixo forem concluídos, e depois disso continua aberto para sempre.</p>
            ${requisitosHTML(t.id, prog)}
            <button class="btn small" data-ir-req="${(t.requer || [])[0] ? t.requer[0].trilha : ''}">Ir para o que falta ${IC().next}</button>
          </div>`}
      </section>`;
    }

    html += `</div>`;
    $('#page').innerHTML = html;

    $$('[data-ir-mod]').forEach(b => b.onclick = () => {
      const m = LX.modById(b.dataset.irMod);
      if (m && m.lessons.length) {
        const prox = m.lessons.find(l => !LX.Progress.lessonDone(l.id)) || m.lessons[0];
        app.goLesson(prox.id);
      }
    });
    $$('[data-ir-req]').forEach(b => b.onclick = () => { if (b.dataset.irReq) app.abrirTrilha(b.dataset.irReq); });

    if (focoId) {
      const el = $('#jp-' + focoId);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    }
  }

  /* ============================== PÁGINA DE CURSOS ============================== */

  /* Os cursos de catálogo: trilhas de topo (não os projetos finais, que são
     parte de um curso). */
  function cursosCatalogo() {
    return (LX.TRILHAS || []).filter(t => !/^pf-/.test(t.id));
  }

  function statsCurso(app, t) {
    const mods = app.course.modules.filter(m => (t.mods || []).includes(m.id));
    const comLicoes = mods.filter(m => m.lessons.length);
    const licoes = mods.flatMap(m => m.lessons);
    const feitas = licoes.filter(l => LX.Progress.lessonDone(l.id)).length;
    let atv = 0, atvF = 0, des = 0, desF = 0;
    for (const l of licoes) for (const tk of (l.tasks || [])) {
      atv++; if (LX.Progress.taskDone(tk.id)) atvF++;
      if (tk.kind === 'desafio' || tk.kind === 'avancado') { des++; if (LX.Progress.taskDone(tk.id)) desF++; }
    }
    const modsFeitos = comLicoes.filter(m => m.lessons.every(l => LX.Progress.lessonDone(l.id))).length;
    return {
      mods: comLicoes.length, modsFeitos,
      aulas: licoes.length, aulasF: feitas,
      atv, atvF, des, desF,
      pct: licoes.length ? Math.round(feitas / licoes.length * 100) : 0
    };
  }

  function renderCursos(app) {
    const prog = LX.Progress.data;
    const P = LX.Progressao;
    let html = `<div class="doc wide cursos-pg">
      <header class="pg-head">
        <h1 class="title">Cursos disponíveis</h1>
        <p class="lede">Explore toda a formação Terminalis. Cada curso abre o seguinte — comece pelo Linux e siga a trilha até virar quem opera servidores de verdade.</p>
      </header>
      <div class="crs-lista">`;

    for (const t of cursosCatalogo()) {
      const st = P.status(t.id, prog);
      const s = statsCurso(app, t);
      const planejado = t.estado === 'planejado' || s.aulas === 0;
      const bloqueado = !planejado && st && !st.liberada;
      const concluido = !planejado && s.aulas > 0 && s.aulasF === s.aulas;
      const clicavel = !planejado && !bloqueado;
      let situ, situCls;
      if (planejado) { situ = 'Em breve'; situCls = 'lock'; }
      else if (bloqueado) { situ = 'Bloqueado'; situCls = 'lock'; }
      else if (concluido) { situ = 'Concluído · 100%'; situCls = 'done'; }
      else { situ = s.pct > 0 ? 'Em andamento · ' + s.pct + '%' : 'Disponível'; situCls = s.pct > 0 ? 'prog' : 'open'; }
      const req = (t.requer || [])[0];
      const nomeReq = req ? (LX.trilhaPorId(req.trilha) || {}).nome : null;
      html += `<button class="crs-row c-${t.cor} ${planejado ? 'planejado' : ''} ${bloqueado ? 'bloqueado' : ''}"
                 ${clicavel ? `data-curso="${t.id}"` : 'disabled'}>
        <span class="crs-ic">${(planejado || bloqueado) ? IC().lock : t.icone}</span>
        <span class="crs-body">
          <span class="crs-nm">${esc(t.nome)}</span>
          <span class="crs-rs">${esc(t.resumo)}</span>
          ${(bloqueado || planejado) && nomeReq ? `<span class="crs-dep">${IC().lock} Conclua ${esc(nomeReq)} para liberar</span>` : ''}
        </span>
        <span class="crs-side">
          <span class="crs-situ ${situCls}">${situ}</span>
          ${!planejado && !bloqueado && s.aulas > 0 ? barra(s.pct, 'fina') : ''}
        </span>
        ${clicavel ? `<span class="crs-arrow">${IC().next}</span>` : ''}
      </button>`;
    }
    html += `</div></div>`;
    $('#page').innerHTML = html;
    $$('#page [data-curso]').forEach(b => b.onclick = () => app.goCurso(b.dataset.curso));
  }

  /* ============================== PÁGINA DO CURSO ============================== */

  let abaCurso = 'modulos';

  function renderCurso(app, t) {
    const prog = LX.Progress.data;
    const P = LX.Progressao;
    const jn = P.jornada(prog).find(s => s.id === t.id) || {};
    const s = statsCurso(app, t);
    const pf = LX.trilhaPorId('pf-' + t.id);
    const nivel = t.nivel || 'Do básico ao avançado';

    /* próxima aula do curso */
    const mods = app.course.modules.filter(m => (t.mods || []).includes(m.id));
    const todas = mods.flatMap(m => m.lessons.map(l => ({ m, l })));
    const prox = todas.find(x => !LX.Progress.lessonDone(x.l.id)) || todas[0];

    let html = `<div class="doc wide curso-pg">
      <header class="cs-head c-${t.cor}">
        <span class="cs-ic">${t.icone}</span>
        <div class="cs-head-body">
          <h1 class="title">${esc(t.nome)}</h1>
          <p class="cs-head-sub">${esc(t.detalhe || t.resumo)}</p>
        </div>
        <span class="cs-nivel">${esc(nivel)}</span>
      </header>

      <div class="cs-prog">
        ${barra(s.pct)}
        <span class="cs-prog-pc">${s.pct}%</span>
        <span class="cs-prog-tx">concluído</span>
      </div>

      <div class="cs-stats">
        <div class="cs-stat"><span class="v">${s.modsFeitos}<small>/${s.mods}</small></span><span class="l">módulos</span></div>
        <div class="cs-stat"><span class="v">${s.aulasF}<small>/${s.aulas}</small></span><span class="l">aulas</span></div>
        <div class="cs-stat"><span class="v">${s.atvF}<small>/${s.atv}</small></span><span class="l">atividades</span></div>
        <div class="cs-stat"><span class="v">${s.desF}<small>/${s.des}</small></span><span class="l">desafios</span></div>
      </div>

      <div class="cs-corpo">
        <div class="cs-main">
          <div class="cs-tabs">
            <button class="cs-tab ${abaCurso === 'modulos' ? 'active' : ''}" data-aba="modulos">Módulos</button>
            <button class="cs-tab ${abaCurso === 'atividades' ? 'active' : ''}" data-aba="atividades">Atividades</button>
            <button class="cs-tab ${abaCurso === 'desafios' ? 'active' : ''}" data-aba="desafios">Desafios</button>
            <button class="cs-tab ${abaCurso === 'projeto' ? 'active' : ''}" data-aba="projeto">Projeto Final</button>
          </div>
          <div class="cs-aba" id="cs-aba"></div>
        </div>

        <aside class="cs-side">
          ${prox ? `<div class="cs-side-card">
            <div class="cs-side-lb">Próximo conteúdo</div>
            <div class="cs-side-mod">${esc(prox.m.title)}</div>
            <div class="cs-side-aula">${esc(prox.l.n)} · ${esc(prox.l.title)}</div>
            <button class="btn primary bloco" id="cs-continuar">${s.pct > 0 ? 'Continuar' : 'Começar'} ${IC().next}</button>
          </div>` : ''}
          ${pf ? `<div class="cs-side-card pf">
            <span class="cs-pf-ic">${IC().trophy}</span>
            <div class="cs-side-lb">Projeto final do curso</div>
            <div class="cs-pf-tx">${esc(pf.resumo)}</div>
            <button class="btn ghost bloco" id="cs-ver-pf">Ver detalhes</button>
          </div>` : ''}
        </aside>
      </div>
    </div>`;

    $('#page').innerHTML = html;
    pintarAba(app, t, jn, pf);

    $$('.cs-tab').forEach(b => b.onclick = () => { abaCurso = b.dataset.aba; $$('.cs-tab').forEach(x => x.classList.toggle('active', x.dataset.aba === abaCurso)); pintarAba(app, t, jn, pf); });
    const cont = $('#cs-continuar'); if (cont) cont.onclick = () => prox && app.goLesson(prox.l.id);
    const vpf = $('#cs-ver-pf'); if (vpf && pf) vpf.onclick = () => app.goCurso(pf.id);
  }

  function pintarAba(app, t, jn, pf) {
    const box = $('#cs-aba'); if (!box) return;
    const mods = app.course.modules.filter(m => (t.mods || []).includes(m.id));

    if (abaCurso === 'modulos') {
      /* estado de cada módulo via etapas (gate progressivo) */
      const estadoMod = {};
      for (const et of (jn.etapas || [])) for (const m of (et.mods || [])) estadoMod[m.id] = et.estado;
      box.innerHTML = mods.map(m => {
        const total = m.lessons.length;
        const feitas = m.lessons.filter(l => LX.Progress.lessonDone(l.id)).length;
        const est = estadoMod[m.id] || (feitas === total && total ? 'concluida' : 'disponivel');
        const bloq = !jn.liberada || est === 'aguardando' && feitas < total;
        const cls = !total ? 'vazio' : (feitas === total ? 'feito' : (bloq ? 'bloq' : (feitas ? 'andando' : '')));
        const situ = !total ? 'em breve' : (feitas === total ? 'Concluído' : (bloq ? 'Bloqueado' : (feitas ? 'Em andamento' : 'A fazer')));
        return `<button class="cs-mod ${cls}" ${total && !bloq ? `data-mod="${m.id}"` : 'disabled'}>
          <span class="cs-mod-n">${esc(m.num)}</span>
          <span class="cs-mod-body">
            <span class="cs-mod-nm">${esc(m.title)}</span>
            <span class="cs-mod-rs">${esc(m.blurb || '')}</span>
          </span>
          <span class="cs-mod-situ ${cls}">${total ? feitas + '/' + total : ''} <b>${situ}</b></span>
          ${total && !bloq ? `<span class="cs-mod-arrow">${IC().next}</span>` : `<span class="cs-mod-arrow">${bloq ? IC().lock : ''}</span>`}
        </button>`;
      }).join('');
      $$('#cs-aba [data-mod]').forEach(b => b.onclick = () => {
        const m = LX.modById(b.dataset.mod);
        const prox = m.lessons.find(l => !LX.Progress.lessonDone(l.id)) || m.lessons[0];
        if (prox) app.goLesson(prox.id);
      });
    }

    else if (abaCurso === 'atividades' || abaCurso === 'desafios') {
      const soDesafio = abaCurso === 'desafios';
      const rows = [];
      for (const m of mods) for (const l of m.lessons) for (const tk of (l.tasks || [])) {
        if (soDesafio && !(tk.kind === 'desafio' || tk.kind === 'avancado')) continue;
        rows.push({ m, l, tk });
      }
      if (!rows.length) { box.innerHTML = `<p class="cs-vazio">Nada por aqui ainda.</p>`; return; }
      box.innerHTML = rows.map(r => {
        const done = LX.Progress.taskDone(r.tk.id);
        const rot = { guiado: 'Guiado', desafio: 'Desafio', avancado: 'Desafio+', quiz: 'Pergunta', fill: 'Preencher' }[r.tk.kind] || r.tk.kind;
        return `<button class="cs-atv ${done ? 'feito' : ''}" data-lesson="${r.l.id}">
          <span class="cs-atv-mk">${done ? IC().check : IC().circle}</span>
          <span class="cs-atv-body">
            <span class="cs-atv-nm">${esc(r.tk.title || r.l.title)}</span>
            <span class="cs-atv-loc">${esc(r.l.n)} · ${esc(r.l.title)}</span>
          </span>
          <span class="cs-atv-kind ${r.tk.kind}">${rot}</span>
        </button>`;
      }).join('');
      $$('#cs-aba [data-lesson]').forEach(b => b.onclick = () => app.goLesson(b.dataset.lesson));
    }

    else if (abaCurso === 'projeto') {
      if (!pf) { box.innerHTML = `<p class="cs-vazio">Este curso não tem um projeto final próprio — a prática está distribuída ao longo dos módulos.</p>`; return; }
      const sp = statsCurso(app, pf);
      const st = LX.Progressao.status(pf.id, LX.Progress.data);
      const bloq = st && !st.liberada;
      box.innerHTML = `<div class="cs-pf-painel c-${pf.cor}">
        <span class="cs-pf-big">${IC().trophy}</span>
        <h3>${esc(pf.nome)}</h3>
        <p>${esc(pf.detalhe || pf.resumo)}</p>
        ${bloq ? `<div class="cs-pf-lock">${IC().lock} Desbloqueia ao concluir os módulos do curso</div>`
          : `<button class="btn primary" id="cs-pf-ir">${sp.pct > 0 ? 'Continuar projeto' : 'Começar projeto'} ${IC().next}</button>`}
      </div>`;
      const ir = $('#cs-pf-ir'); if (ir) ir.onclick = () => app.goCurso(pf.id);
    }
  }

  /* ============================== PROJETOS ============================== */

  function renderProjetos(app) {
    const prog = LX.Progress.data;
    const P = LX.Progressao;
    const pfs = (LX.TRILHAS || []).filter(t => /^pf-/.test(t.id));
    let html = `<div class="doc wide projetos-pg">
      <header class="pg-head">
        <h1 class="title">Projetos finais</h1>
        <p class="lede">Cada curso termina num projeto de verdade: um chamado de trabalho, dividido em etapas, verificado no ambiente. É onde tudo o que você aprendeu vira entrega.</p>
      </header>
      <div class="pj-lista">`;
    for (const t of pfs) {
      const st = P.status(t.id, prog);
      const s = statsCurso(app, t);
      const bloq = st && !st.liberada;
      const concl = !bloq && s.aulas > 0 && s.aulasF === s.aulas;
      const cursoPai = LX.trilhaPorId(t.id.replace('pf-', ''));
      html += `<div class="pj-card c-${t.cor} ${bloq ? 'bloq' : ''}">
        <span class="pj-ic">${bloq ? IC().lock : IC().trophy}</span>
        <div class="pj-body">
          <span class="pj-curso">${cursoPai ? esc(cursoPai.nome) : ''}</span>
          <span class="pj-nm">${esc(t.nome)}</span>
          <span class="pj-rs">${esc(t.detalhe || t.resumo)}</span>
        </div>
        <div class="pj-side">
          ${bloq ? `<span class="pj-situ lock">${IC().lock} Bloqueado</span>`
            : concl ? `<span class="pj-situ done">${IC().check} Concluído</span>`
              : `<span class="pj-situ prog">${s.pct}%</span>`}
          ${bloq ? '' : `<button class="btn ${concl ? 'ghost' : 'primary'} small" data-curso="${t.id}">${concl ? 'Revisar' : (s.pct > 0 ? 'Continuar' : 'Começar')}</button>`}
        </div>
      </div>`;
    }
    html += `</div></div>`;
    $('#page').innerHTML = html;
    $$('#page [data-curso]').forEach(b => b.onclick = () => app.goCurso(b.dataset.curso));
  }

  LX.Jornada = { renderHome, renderJornada, renderCursos, renderCurso, renderProjetos, etapasHTML, requisitosHTML, chip, barra, marca };
})();
