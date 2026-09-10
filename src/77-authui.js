/* =========================================================================
   TERMINALIS — tela de acesso
   Duas colunas: à esquerda o que a plataforma é, à direita o formulário.
   Toda a validação daqui é conveniência; quem decide é o LX.Auth.
   ========================================================================= */
'use strict';
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const IC = {
    term: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-5-6-5"/><path d="M12 19h8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.2M12 16.4h.01"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6 5-5.4"/></svg>',
    olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    olhoOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16"/><path d="M9.9 5.7A9.9 9.9 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.4 7.6A17 17 0 0 0 2 12s3.5 6.5 10 6.5c1.4 0 2.6-.3 3.7-.7"/><path d="M9.6 10a2.8 2.8 0 0 0 3.9 3.9"/></svg>'
  };

  const FEATS = [
    { ic: IC.term, t: 'Um laboratório de terminal no navegador', s: 'Linux, Docker e Git simulados: comandos modificam arquivos e serviços do ambiente virtual.' },
    { ic: IC.check, t: 'Desafios verificados pelo estado da máquina', s: 'A plataforma inspeciona o sistema, não o que você digitou. Vários caminhos são aceitos.' },
    { ic: IC.bulb, t: 'Dica 1, dica 2, e só então a solução', s: 'Errar faz parte do método. Nada é revelado antes de você tentar.' },
    { ic: IC.map, t: 'Trilhas que abrem em ordem', s: 'Linux, Docker e Git & GitHub, com projetos finais. Seu progresso libera as próximas etapas.' }
  ];

  const AuthUI = {
    aba: 'entrar',
    ocupado: false,
    aoEntrar: null,       // callback definido no bootstrap

    montar() {
      const el = document.createElement('div');
      el.id = 'auth-screen';
      el.innerHTML = `
        <section class="auth-vitrine">
          <div class="auth-marca"><div class="mk">&gt;_</div><div class="nm">Terminalis</div></div>
          <h1>Aprenda tecnologia <em>na prática</em>.</h1>
          <p class="lede">Sem vídeo, sem decoreba. Você lê uma explicação curta, executa no terminal ao lado, erra, recebe o retorno do sistema e avança.</p>
          <div class="auth-feats">
            ${FEATS.map(f => `<div class="auth-feat"><span class="ic">${f.ic}</span><span><span class="t">${esc(f.t)}</span><br><span class="s">${esc(f.s)}</span></span></div>`).join('')}
          </div>
          <div class="auth-term">
            <div class="bar"><i></i><i></i><i></i><span>aluno@srv-aula: ~</span></div>
<pre><span class="p">aluno@srv-aula</span>:<span class="c">~</span>$ ls -ld /srv/projeto
drwxrws--- 4 root dados 4096 /srv/projeto
<span class="p">aluno@srv-aula</span>:<span class="c">~</span>$ <span class="d">verificando desafio…</span>
<span class="p">✓ SGID presente — arquivos novos herdam o grupo</span>
<span class="p">aluno@srv-aula</span>:<span class="c">~</span>$ <span class="cur"></span></pre>
          </div>
        </section>

        <section class="auth-form-wrap">
          <form class="auth-form" id="auth-form" novalidate>
            <div class="auth-abas" role="tablist">
              <button type="button" role="tab" data-aba="entrar" aria-selected="true">Entrar</button>
              <button type="button" role="tab" data-aba="criar" aria-selected="false">Criar conta</button>
            </div>
            <h2 id="auth-titulo">Bem-vindo de volta</h2>
            <p class="sub" id="auth-sub">Entre para continuar de onde você parou.</p>

            <div class="auth-alerta" id="auth-alerta"></div>

            <div class="campo" id="c-login">
              <label for="f-login">Usuário ou e-mail</label>
              <div class="caixa"><input id="f-login" name="login" autocomplete="username" placeholder="ana ou ana@exemplo.com" autocapitalize="off" spellcheck="false"></div>
              <div class="msg"></div>
            </div>

            <div class="campo hidden" id="c-usuario">
              <label for="f-usuario">Nome de usuário</label>
              <div class="caixa"><input id="f-usuario" name="usuario" autocomplete="username" placeholder="ana.silva" autocapitalize="off" spellcheck="false"></div>
              <div class="msg"></div>
              <div class="ajuda">3 a 24 caracteres: letras, números, ponto, hífen ou _</div>
            </div>

            <div class="campo hidden" id="c-email">
              <label for="f-email">E-mail</label>
              <div class="caixa"><input id="f-email" name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com" autocapitalize="off" spellcheck="false"></div>
              <div class="msg"></div>
            </div>

            <div class="campo" id="c-senha">
              <label for="f-senha">Senha</label>
              <div class="caixa">
                <input id="f-senha" name="senha" type="password" autocomplete="current-password" placeholder="••••••••">
                <button type="button" class="olho" id="f-olho" aria-label="Mostrar senha">${IC.olho}</button>
              </div>
              <div class="msg"></div>
              <div class="ajuda hidden" id="ajuda-senha">Mínimo de 8 caracteres. Ela é transformada em hash antes de ser gravada — nem a plataforma consegue lê-la de volta.</div>
            </div>

            <button type="submit" class="auth-enviar" id="auth-enviar"><span class="giro"></span><span id="auth-enviar-txt">Entrar</span></button>

            <p class="auth-troca" id="auth-troca"></p>

            <div class="auth-rodape">
              As senhas são derivadas com <code>PBKDF2-SHA256</code>, 150.000 iterações e salt aleatório por conta; a sessão usa um token de 32 bytes do qual só o hash fica guardado. Ainda assim, este é um ambiente de estudo: <strong>use uma senha que você não usa em nenhum outro serviço</strong>.
              <div class="auth-modo" id="auth-modo"><i></i><span>verificando armazenamento…</span></div>
            </div>
          </form>
        </section>`;
      document.body.appendChild(el);
      this.el = el;
      this.ligar();
      this.pintarAba();
      return el;
    },

    ligar() {
      $$('.auth-abas button', this.el).forEach(b => b.onclick = () => this.trocarAba(b.dataset.aba));
      $('#auth-form', this.el).addEventListener('submit', (e) => { e.preventDefault(); this.enviar(); });
      const olho = $('#f-olho', this.el);
      olho.onclick = () => {
        const i = $('#f-senha', this.el);
        const mostrando = i.type === 'text';
        i.type = mostrando ? 'password' : 'text';
        olho.innerHTML = mostrando ? IC.olho : IC.olhoOff;
        olho.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
        i.focus();
      };
      $$('#auth-form input', this.el).forEach(i => {
        i.addEventListener('input', () => { i.closest('.campo').classList.remove('erro'); });
      });
    },

    trocarAba(aba) {
      if (this.ocupado) return;
      this.aba = aba;
      this.limparErros();
      this.alerta(null);
      this.pintarAba();
      setTimeout(() => { const p = $(aba === 'entrar' ? '#f-login' : '#f-usuario', this.el); if (p) p.focus(); }, 30);
    },

    pintarAba() {
      const criar = this.aba === 'criar';
      $$('.auth-abas button', this.el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === this.aba)));
      $('#c-login', this.el).classList.toggle('hidden', criar);
      $('#c-usuario', this.el).classList.toggle('hidden', !criar);
      $('#c-email', this.el).classList.toggle('hidden', !criar);
      $('#ajuda-senha', this.el).classList.toggle('hidden', !criar);
      $('#auth-titulo', this.el).textContent = criar ? 'Criar sua conta' : 'Bem-vindo de volta';
      $('#auth-sub', this.el).textContent = criar
        ? 'Seu progresso fica guardado nesta conta e só nela.'
        : 'Entre para continuar de onde você parou.';
      $('#auth-enviar-txt', this.el).textContent = criar ? 'Criar conta e começar' : 'Entrar';
      $('#f-senha', this.el).setAttribute('autocomplete', criar ? 'new-password' : 'current-password');
      $('#auth-troca', this.el).innerHTML = criar
        ? 'Já tem conta? <button type="button" data-ir="entrar">Entrar</button>'
        : 'Ainda não tem conta? <button type="button" data-ir="criar">Criar conta</button>';
      const b = $('#auth-troca button', this.el);
      if (b) b.onclick = () => this.trocarAba(b.dataset.ir);
    },

    /* ---------- feedback ---------- */
    limparErros() { $$('.campo', this.el).forEach(c => c.classList.remove('erro')); },
    erroCampo(id, msg) {
      const c = $('#c-' + id, this.el);
      if (!c) return this.alerta(msg);
      c.classList.add('erro');
      $('.msg', c).innerHTML = esc(msg);
      const i = $('input', c); if (i) i.focus();
    },
    alerta(msg, ok) {
      const a = $('#auth-alerta', this.el);
      a.classList.toggle('on', !!msg);
      a.classList.toggle('ok', !!ok);
      a.innerHTML = msg ? (ok ? IC.ok : IC.alerta) + '<span>' + esc(msg) + '</span>' : '';
    },
    carregando(v) {
      this.ocupado = v;
      const f = $('#auth-form', this.el);
      f.classList.toggle('carregando', v);
      $('#auth-enviar', this.el).disabled = v;
      $('#auth-enviar-txt', this.el).textContent = v
        ? (this.aba === 'criar' ? 'Criando conta…' : 'Entrando…')
        : (this.aba === 'criar' ? 'Criar conta e começar' : 'Entrar');
    },

    pintarModo() {
      const el = $('#auth-modo', this.el);
      if (!el) return;
      const nuvem = LX.Store.modo === 'nuvem';
      el.classList.toggle('nuvem', nuvem);
      $('span', el).textContent = nuvem
        ? 'contas guardadas na nuvem da plataforma — dá para entrar de outro aparelho'
        : 'contas guardadas neste navegador';
    },

    /* ---------- envio ---------- */
    async enviar() {
      if (this.ocupado) return;
      this.limparErros();
      this.alerta(null);
      const v = (id) => $('#f-' + id, this.el).value;

      /* validação local antes de gastar 150 mil iterações à toa */
      if (this.aba === 'criar') {
        if (!v('usuario').trim()) return this.erroCampo('usuario', 'Escolha um nome de usuário.');
        if (!v('email').trim()) return this.erroCampo('email', 'Informe seu e-mail.');
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v('email').trim())) return this.erroCampo('email', 'Esse e-mail não parece válido.');
        if (v('senha').length < 8) return this.erroCampo('senha', 'A senha precisa de pelo menos 8 caracteres.');
      } else {
        if (!v('login').trim()) return this.erroCampo('login', 'Informe seu usuário ou e-mail.');
        if (!v('senha')) return this.erroCampo('senha', 'Informe sua senha.');
      }

      this.carregando(true);
      try {
        const u = this.aba === 'criar'
          ? await LX.Auth.criar({ usuario: v('usuario'), email: v('email'), senha: v('senha') })
          : await LX.Auth.entrar({ login: v('login'), senha: v('senha') });
        this.alerta('Tudo certo, ' + u.nome + '. Carregando seu progresso…', true);
        await new Promise(r => setTimeout(r, 260));
        this.esconder();
        if (this.aoEntrar) await this.aoEntrar(u);
      } catch (e) {
        this.carregando(false);
        const campo = e && e.campo;
        if (campo === 'usuario' || campo === 'email' || campo === 'senha' || campo === 'login') this.erroCampo(campo, e.message);
        else this.alerta((e && e.message) || 'Não foi possível concluir. Tente de novo.');
        return;
      }
      this.carregando(false);
    },

    mostrar(aba) {
      if (!this.el) this.montar();
      document.body.classList.add('autenticando');
      this.el.classList.remove('hidden');
      this.carregando(false);
      $('#auth-form', this.el).reset();
      this.limparErros();
      this.alerta(null);
      this.aba = aba || 'entrar';
      this.pintarAba();
      this.pintarModo();
      setTimeout(() => { const p = $(this.aba === 'entrar' ? '#f-login' : '#f-usuario', this.el); if (p) p.focus(); }, 60);
    },

    esconder() {
      document.body.classList.remove('autenticando');
      if (this.el) this.el.classList.add('hidden');
    }
  };

  LX.AuthUI = AuthUI;
})();
