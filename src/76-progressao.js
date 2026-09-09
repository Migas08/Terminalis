/* =========================================================================
   TERMINALIS — jornada, etapas e progressão entre cursos
   ---------------------------------------------------------------------
   Três níveis, do menor para o maior:

     desafio  →  aula  →  ETAPA  →  CURSO (trilha)  →  JORNADA

   ETAPA é o degrau que o aluno enxerga. Cada curso declara suas etapas em
   50-content-02-trilhas.js (`etapas: [{id, nome, resumo, mods}]`); uma
   etapa está concluída quando todas as aulas dos seus módulos e todos os
   desafios obrigatórios delas foram verificados. As etapas abrem em
   ordem: a etapa N fica disponível quando a N-1 fecha. Isso não é um
   cadeado extra — é o mapa do caminho, para o aluno saber onde está.

   CURSO abre quando os pré-requisitos declarados nele mesmo fecham
   (`requer: [{trilha: 'id'}]`). O grafo é dado, não codificado aqui:
   acrescentar Redes → Git → Programação depois é declarar a trilha e
   apontar o pré-requisito.

   Nada disso olha para cliques. Olha para o progresso gravado do usuário
   logado. E o desbloqueio é permanente: no instante em que os requisitos
   fecham, gravamos a data em progresso.desbloqueios[trilha], então a
   trilha continua aberta mesmo que o conteúdo cresça depois.
   ========================================================================= */
'use strict';
(function () {

  const vazio = () => (LX.PROGRESSO_VAZIO ? LX.PROGRESSO_VAZIO() : { lessons: {}, tasks: {} });

  function modulosDe(trilha) {
    if (!trilha) return [];
    return LX.COURSE.modules.filter(m => (trilha.mods || []).includes(m.id));
  }
  function modulosPorIds(ids) {
    return LX.COURSE.modules.filter(m => (ids || []).includes(m.id));
  }
  function licoesDeModulos(mods) {
    return mods.flatMap(m => m.lessons);
  }
  function desafiosDeLicoes(licoes) {
    const out = [];
    for (const l of licoes) for (const t of (l.tasks || [])) if (!t.opcional) out.push(t);
    return out;
  }

  /* Conta aulas e desafios feitos em um conjunto de módulos. */
  function contar(mods, prog) {
    const licoes = licoesDeModulos(mods);
    const desafios = desafiosDeLicoes(licoes);
    const feitasL = licoes.filter(l => !!(prog.lessons || {})[l.id]).length;
    const feitosD = desafios.filter(d => !!(prog.tasks || {})[d.id]).length;
    const total = licoes.length + desafios.length;
    const feito = feitasL + feitosD;
    return {
      licoes: { feitas: feitasL, total: licoes.length },
      desafios: { feitos: feitosD, total: desafios.length },
      vazia: licoes.length === 0,
      pct: total ? Math.round(feito / total * 100) : 0,
      completo: licoes.length > 0 && feitasL >= licoes.length && feitosD >= desafios.length
    };
  }

  const Progressao = {

    modulosDe,
    licoesDe: (t) => licoesDeModulos(modulosDe(t)),
    desafiosDe: (t) => desafiosDeLicoes(licoesDeModulos(modulosDe(t))),

    /* ------------------------------ medidas ------------------------------ */

    medir(trilhaId, prog) {
      const t = LX.trilhaPorId(trilhaId);
      const c = contar(modulosDe(t), prog || vazio());
      return Object.assign({ id: trilhaId, nome: t ? t.nome : trilhaId }, c);
    },

    concluiu(trilhaId, prog) {
      return this.medir(trilhaId, prog || vazio()).completo;
    },

    /* --------------------------- etapas do curso --------------------------- */

    /* Devolve as etapas de um curso com o estado de cada uma. A primeira
       etapa não concluída é a "atual" — é dela que sai o próximo passo. */
    etapas(trilhaId, prog) {
      prog = prog || vazio();
      const t = LX.trilhaPorId(trilhaId);
      if (!t) return [];
      const decl = t.etapas && t.etapas.length
        ? t.etapas
        : [{ id: 'unica', nome: t.nome, resumo: t.resumo || '', mods: t.mods || [] }];

      let anteriorFechou = true;
      let jaMarcouAtual = false;
      return decl.map((e, i) => {
        const mods = modulosPorIds(e.mods);
        const c = contar(mods, prog);
        const disponivel = anteriorFechou;
        const atual = disponivel && !c.completo && !jaMarcouAtual;
        if (atual) jaMarcouAtual = true;
        const estado = c.completo ? 'concluida' : (atual ? 'atual' : (disponivel ? 'disponivel' : 'aguardando'));
        anteriorFechou = anteriorFechou && c.completo;
        return {
          n: i + 1, id: e.id, nome: e.nome, resumo: e.resumo,
          mods, modIds: e.mods, estado, atual,
          licoes: c.licoes, desafios: c.desafios, pct: c.pct,
          completo: c.completo, vazia: c.vazia
        };
      });
    },

    /* A próxima aula não concluída do curso, e a etapa a que ela pertence. */
    proximoPasso(trilhaId, prog) {
      prog = prog || vazio();
      for (const et of this.etapas(trilhaId, prog)) {
        for (const m of et.mods) {
          for (const l of m.lessons) {
            if (!(prog.lessons || {})[l.id]) return { etapa: et, mod: m, lesson: l };
          }
          /* aula marcada como feita mas com desafio pendente ainda conta */
          for (const l of m.lessons) {
            const pend = (l.tasks || []).filter(x => !x.opcional && !(prog.tasks || {})[x.id]);
            if (pend.length) return { etapa: et, mod: m, lesson: l, desafiosPendentes: pend.length };
          }
        }
      }
      return null;
    },

    /* ------------------------- estado de um curso ------------------------- */

    status(trilhaId, prog) {
      const t = LX.trilhaPorId(trilhaId);
      if (!t) return { existe: false };
      prog = prog || vazio();
      const sticky = !!(prog.desbloqueios || {})[trilhaId];
      const reqs = (t.requer || []).map(r => {
        const med = this.medir(r.trilha, prog);
        return Object.assign(med, { ok: med.completo || !!(prog.conclusoes || {})[r.trilha] });
      });
      const cumpridos = reqs.every(r => r.ok);
      const proprio = this.medir(trilhaId, prog);
      const liberada = t.estado === 'disponivel' && (sticky || cumpridos);
      const concluida = proprio.completo || !!(prog.conclusoes || {})[trilhaId];

      let situacao;
      if (t.estado !== 'disponivel') situacao = 'planejada';
      else if (!liberada) situacao = 'bloqueada';
      else if (concluida) situacao = 'concluida';
      else if (proprio.vazia) situacao = 'em-producao';
      else if (proprio.pct > 0) situacao = 'em-andamento';
      else situacao = 'disponivel';

      return {
        existe: true, trilha: t, id: trilhaId,
        situacao,
        planejada: t.estado !== 'disponivel',
        liberada, permanente: sticky, concluida,
        requisitos: reqs, proprio,
        etapas: this.etapas(trilhaId, prog)
      };
    },

    /* Rótulo curto do estado, para chips e cabeçalhos. */
    rotulo(situacao) {
      return ({
        'concluida': 'Concluído',
        'em-andamento': 'Em andamento',
        'disponivel': 'Disponível',
        'em-producao': 'Em produção',
        'bloqueada': 'Bloqueado',
        'planejada': 'Em breve'
      })[situacao] || situacao;
    },

    /* ------------------------------ requisitos ------------------------------ */

    /* Lista literal do que falta para abrir um curso — cada item com o seu
       próprio progresso, para a interface poder desenhar ✓ / ○ e barra. */
    requisitos(trilhaId, prog, _vistos) {
      prog = prog || vazio();
      const t = LX.trilhaPorId(trilhaId);
      if (!t) return [];
      const vistos = _vistos || new Set([trilhaId]);
      const out = [];
      for (const r of (t.requer || [])) {
        /* O pré-requisito pode ter pré-requisitos próprios ainda abertos.
           Mostramos a corrente inteira: quem vê "Docker bloqueado" precisa
           saber que o caminho passa por Linux e pelo projeto final, não só
           pelo último elo. */
        if (!vistos.has(r.trilha)) {
          vistos.add(r.trilha);
          const alvoT = LX.trilhaPorId(r.trilha);
          const cumprido = this.concluiu(r.trilha, prog) || !!(prog.conclusoes || {})[r.trilha];
          if (alvoT && !cumprido) out.push(...this.requisitos(r.trilha, prog, vistos));
        }
      }
      for (const r of (t.requer || [])) {
        const alvo = LX.trilhaPorId(r.trilha);
        const med = this.medir(r.trilha, prog);
        const feitoAntes = !!(prog.conclusoes || {})[r.trilha];
        const temEtapas = alvo && alvo.etapas && alvo.etapas.length > 1;

        if (temEtapas && !med.completo && !feitoAntes) {
          /* curso com etapas: mostrar etapa por etapa, é muito mais legível */
          for (const et of this.etapas(r.trilha, prog)) {
            out.push({
              ok: et.completo,
              titulo: `${alvo.nome} · ${et.nome}`,
              detalhe: et.completo
                ? 'concluída'
                : (et.vazia ? 'conteúdo em preparação'
                  : `${et.licoes.feitas}/${et.licoes.total} aulas · ${et.desafios.feitos}/${et.desafios.total} desafios`),
              pct: et.pct
            });
          }
        } else {
          out.push({
            ok: med.completo || feitoAntes,
            titulo: `Concluir ${alvo ? alvo.nome : r.trilha}`,
            detalhe: (med.completo || feitoAntes)
              ? 'concluído'
              : (med.vazia ? 'conteúdo em preparação'
                : `${med.licoes.feitas}/${med.licoes.total} aulas · ${med.desafios.feitos}/${med.desafios.total} desafios`),
            pct: (med.completo || feitoAntes) ? 100 : med.pct
          });
        }
      }
      return out;
    },

    /* Uma frase só, para toast e para o chip do cartão. */
    frasePendente(trilhaId, prog) {
      const falta = this.requisitos(trilhaId, prog).filter(r => !r.ok)[0];
      if (!falta) return null;
      return falta.titulo + ' — ' + falta.detalhe;
    },

    /* ------------------------------- avaliação ------------------------------- */

    /* Percorre os cursos, grava conclusões e desbloqueios novos e devolve
       o que acabou de acontecer para a interface avisar o aluno. */
    avaliar(prog) {
      prog.desbloqueios = prog.desbloqueios || {};
      prog.conclusoes = prog.conclusoes || {};
      prog.etapasFeitas = prog.etapasFeitas || {};
      const novas = [], etapasNovas = [], concluidas = [];
      let mudou = false;

      for (const t of LX.TRILHAS) {
        if (t.estado !== 'disponivel') continue;
        /* etapas concluídas ficam registradas (para o "você desbloqueou" e o histórico) */
        for (const et of this.etapas(t.id, prog)) {
          const chave = t.id + ':' + et.id;
          if (et.completo && !prog.etapasFeitas[chave]) {
            prog.etapasFeitas[chave] = Date.now();
            etapasNovas.push({ trilha: t, etapa: et });
            mudou = true;
          }
        }
        if (!prog.conclusoes[t.id] && this.concluiu(t.id, prog)) {
          prog.conclusoes[t.id] = Date.now();
          concluidas.push(t);
          mudou = true;
        }
      }

      /* várias passadas: abrir A pode fechar o requisito de B na mesma hora */
      for (let volta = 0; volta < LX.TRILHAS.length; volta++) {
        let abriu = false;
        for (const t of LX.TRILHAS) {
          if (t.estado !== 'disponivel' || prog.desbloqueios[t.id]) continue;
          const reqs = t.requer || [];
          const ok = reqs.every(r => this.concluiu(r.trilha, prog) || !!prog.conclusoes[r.trilha]);
          if (ok) {
            prog.desbloqueios[t.id] = Date.now();
            if (reqs.length) novas.push(t.id);     // curso sem pré-requisito não é "novidade"
            abriu = true; mudou = true;
          }
        }
        if (!abriu) break;
      }
      return { mudou, novas, etapasNovas, concluidas };
    },

    /* ------------------------------- a jornada ------------------------------- */

    /* Todos os cursos, na ordem em que se abrem, com o estado de cada um.
       É a estrutura que a página "Sua jornada" desenha. */
    jornada(prog) {
      prog = prog || vazio();
      const ordem = this.ordenar();
      return ordem.map(t => this.status(t.id, prog));
    },

    /* Ordena os cursos por dependência (topológica), estáveis quando empatam. */
    ordenar() {
      const feitos = new Set(), saida = [];
      const restam = LX.TRILHAS.slice();
      let guarda = 0;
      while (restam.length && guarda++ < 100) {
        let mexeu = false;
        for (let i = 0; i < restam.length; i++) {
          const t = restam[i];
          if ((t.requer || []).every(r => feitos.has(r.trilha))) {
            saida.push(t); feitos.add(t.id); restam.splice(i, 1); mexeu = true; break;
          }
        }
        if (!mexeu) break;             // ciclo ou dependência inexistente: solta o resto
      }
      return saida.concat(restam);
    },

    /* Compatibilidade com a versão anterior da interface. */
    explicar(trilhaId, prog) {
      return this.requisitos(trilhaId, prog).map(r => ({
        ok: r.ok, texto: r.titulo + (r.ok ? '' : ' — ' + r.detalhe), pct: r.pct
      }));
    }
  };

  LX.Progressao = Progressao;
})();
