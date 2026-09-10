/* Percorre a plataforma como um aluno novo, em Chromium:
   cria conta, abre a primeira aula, resolve desafios de verdade digitando
   no terminal, avança pelas etapas e confere que a progressão responde. */
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ARQ = path.join(__dirname, '..', 'dist', 'terminalis.html');
let ok = 0, mau = 0;
const T = (nome, cond, extra) => {
  if (cond) { ok++; console.log('  ✓ ' + nome); }
  else { mau++; console.log('  ✗ ' + nome + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 300) : '')); }
};

(async () => {
  const shots = path.join(__dirname, '..', 'work');
  fs.mkdirSync(shots, { recursive: true });
  const html = fs.readFileSync(ARQ);
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(html); });
  await new Promise(res => srv.listen(0, res));
  const url = 'http://127.0.0.1:' + srv.address().port + '/';

  const browser = await chromium.launch({
    ...require('./browser-options'),
    args: ['--disable-features=Autofill,AutofillServerCommunication', '--disable-save-password-bubble', '--password-store=basic']
  });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });

  await page.goto(url);
  await page.waitForFunction(() => !!window.LX && !!LX.AuthUI && !!LX.AuthUI.el, null, { timeout: 20000 });

  console.log('\n=== O ALUNO NOVO ===\n');

  console.log('1. a primeira coisa que ele vê');
  T('a plataforma pede conta antes de qualquer coisa',
    await page.evaluate(() => !document.getElementById('auth-screen').classList.contains('hidden')));
  T('a tela de acesso explica o que é a plataforma',
    await page.evaluate(() => /terminal|prática/i.test(document.querySelector('.auth-vitrine').innerText)));

  await page.evaluate(async () => {
    await LX.Auth.criar({ usuario: 'novato', email: 'novato@exemplo.com', senha: 'primeiraSenha9' });
    LX.AuthUI.esconder();
    window.__app = new LX.App();
    window.__app.start();
  });
  await page.waitForTimeout(900);

  console.log('\n2. a tela inicial responde "onde estou / o que faço agora"');
  const inicio = await page.evaluate(() => document.querySelector('#page').innerText);
  T('mostra a proposta e o wordmark', /terminalis/i.test(inicio) && /Assuma o terminal/i.test(inicio));
  T('mostra a jornada em cursos', /Linux e o terminal/.test(inicio) && /Docker/.test(inicio));
  T('o botão principal diz "Começar agora" para quem nunca fez nada', /Começar a estudar/.test(inicio));
  const cursoLinux = await page.evaluate(() => { window.__app.goCurso('linux'); return document.querySelector('#page').innerText; });
  T('a página do curso mostra a próxima aula', /Próximo conteúdo/i.test(cursoLinux) && /1\.1/.test(cursoLinux), cursoLinux.slice(0, 200));
  T('a página do curso lista os módulos', await page.evaluate(() => document.querySelectorAll('.cs-mod').length >= 5));

  console.log('\n3. por que o Docker está bloqueado');
  const naLista = await page.evaluate(() => {
    window.__app.goCursos();
    const n = Array.from(document.querySelectorAll('.crs-row')).find(x => /Docker na prática/.test(x.textContent));
    return n ? n.innerText.replace(/\s+/g, ' ') : null;
  });
  T('a lista de cursos diz "Bloqueado", não só um cadeado', /Bloqueado/.test(naLista || ''), naLista);
  T('a lista diz o que concluir para liberar', /Conclua .* para liberar/i.test(naLista || ''), naLista);
  const naJornada = await page.evaluate(() => {
    window.__app.goJornada();
    const n = Array.from(document.querySelectorAll('.jn-painel')).find(x => /Docker na prática/.test(x.textContent));
    return n ? n.innerText.replace(/\s+/g, ' ') : null;
  });
  T('a jornada lista os requisitos item por item',
    /Para desbloquear/i.test(naJornada || '') && /\d+ de \d+/i.test(naJornada || ''), naJornada);

  console.log('\n4. começar a estudar');
  await page.evaluate(() => { window.__app.goHome(); document.querySelector('#hm-continuar').click(); });
  await page.waitForTimeout(700);
  const aula = await page.evaluate(() => ({
    rota: window.__app.route.view,
    licao: window.__app.route.lesson,
    texto: document.querySelector('#page').innerText.slice(0, 4000)
  }));
  T('o botão leva direto para a primeira aula', aula.rota === 'lesson' && aula.licao === 'l1-1', aula.licao);
  T('a aula abre com o objetivo declarado', /Objetivo|goal|kernel/i.test(aula.texto));
  T('a aula tem exercício e desafio', /Desafio|Exercício|Prática/i.test(aula.texto));

  console.log('\n5. resolver um desafio digitando no terminal de verdade');
  const antes = await page.evaluate(() => Object.keys(LX.Progress.data.tasks).length);
  /* runVisible é o caminho do botão "rodar" da aula: escreve no terminal,
     registra no histórico e executa — igual a digitar. */
  await page.evaluate(async () => {
    await window.__app.term.runVisible('uname -r');
    await window.__app.term.runVisible('cat /etc/os-release');
    await window.__app.term.runVisible('hostname');
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /Verificar/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(900);
  const depois = await page.evaluate(() => Object.keys(LX.Progress.data.tasks).length);
  T('o desafio verificado marca progresso', depois > antes, { antes, depois });

  console.log('\n   e o verificador recusa quem não fez');
  const recusa = await page.evaluate(async () => {
    const f = LX.COURSE.modules.flatMap(m => m.lessons).find(l => l.id === 'l1-1');
    const t = f.tasks.find(x => x.id === 't1-1-b');
    const r = await t.check({ app: window.__app, machine: window.__app.machine, term: window.__app.term, sh: window.__app.term.sh, run: (c) => window.__app.term.runQuiet(c) });
    return r;
  });
  T('o desafio não resolvido é reprovado com explicação', recusa.ok === false && !!recusa.msg, recusa);

  console.log('\n6. a jornada mostra a evolução');
  await page.evaluate(() => window.__app.goJornada());
  await page.waitForTimeout(500);
  const jornada = await page.evaluate(() => document.querySelector('#page').innerText);
  T('a página da jornada abre', /Sua jornada/i.test(jornada));
  T('tem placar de aulas e desafios', /aulas concluídas/i.test(jornada) && /desafios verificados/i.test(jornada));
  T('lista os objetivos do curso', /Ao terminar, você sabe/i.test(jornada));
  T('lista as etapas com os módulos dentro', /Etapa 1/.test(jornada) && /01 · Fundamentos/.test(jornada));
  T('explica que o curso travado abre sozinho', /abre sozinho/i.test(jornada));

  console.log('\n7. a progressão responde ao trabalho feito');
  const etapa1 = await page.evaluate(async () => {
    const t = LX.trilhaPorId('linux');
    const mods = LX.COURSE.modules.filter(m => ['m01', 'm02'].includes(m.id));
    for (const m of mods) for (const l of m.lessons) {
      for (const k of (l.tasks || [])) LX.Progress.markTask(k.id);
      LX.Progress.markLesson(l.id, true);
    }
    window.__app.avaliarProgressao(true);
    await new Promise(r => setTimeout(r, 200));
    const et = LX.Progressao.etapas('linux', LX.Auth.progresso);
    return { e1: et[0].estado, e2: et[1].estado, e3: et[2].estado };
  });
  T('a etapa 1 fecha quando todas as aulas e desafios dela fecham', etapa1.e1 === 'concluida', etapa1);
  T('a etapa 2 vira a atual', etapa1.e2 === 'atual', etapa1);
  T('a etapa 3 continua aguardando', etapa1.e3 === 'aguardando', etapa1);

  console.log('\n8. a corrente inteira até o Docker');
  const corrente = await page.evaluate(async () => {
    for (const tid of ['linux', 'pf-linux']) {
      const t = LX.trilhaPorId(tid);
      const mods = LX.COURSE.modules.filter(m => (t.mods || []).includes(m.id));
      for (const m of mods) for (const l of m.lessons) {
        for (const k of (l.tasks || [])) LX.Progress.markTask(k.id);
        LX.Progress.markLesson(l.id, true);
      }
      window.__app.avaliarProgressao(false);
      await new Promise(r => setTimeout(r, 60));
    }
    const st = LX.Progressao.status('docker', LX.Auth.progresso);
    return { liberada: st.liberada, permanente: st.permanente, situacao: st.situacao };
  });
  T('concluir Linux + projeto final desbloqueia o Docker', corrente.liberada === true, corrente);
  T('o desbloqueio fica registrado como permanente', corrente.permanente === true);

  console.log('\n9. o conteúdo cobre o que foi prometido');
  const cobertura = await page.evaluate(() => {
    const t = LX.trilhaPorId('linux');
    const mods = LX.COURSE.modules.filter(m => (t.mods || []).includes(m.id));
    const texto = JSON.stringify(mods).toLowerCase();
    const exigidos = {
      'navegar': 'cd ', 'arquivos': 'mkdir', 'caminhos': 'caminho absoluto',
      'texto': 'grep', 'pipes': 'stdout', 'permissões': 'chmod', 'usuários': 'useradd',
      'processos': 'sigterm', 'serviços': 'systemctl', 'systemd': '[install]',
      'pacotes': 'apt install', 'variáveis': 'export', 'ssh': 'authorized_keys',
      'rede': 'ss -tln', 'diagnóstico': 'refused', 'armazenamento': 'fstab',
      'compactação': 'tar -czf', 'logs': 'journalctl', 'bash': 'set -euo pipefail',
      'scripts': 'shebang', 'administração': 'logrotate', 'troubleshooting': '203/exec',
      'agendamento': 'crontab', 'backup': 'restaura', 'monitoramento': 'load average'
    };
    const faltando = [];
    for (const [assunto, marca] of Object.entries(exigidos)) if (!texto.includes(marca)) faltando.push(assunto);
    return { faltando, aulas: mods.reduce((a, m) => a + m.lessons.length, 0) };
  });
  T('todos os assuntos prometidos aparecem no curso de Linux',
    cobertura.faltando.length === 0, cobertura.faltando);
  T('o curso de Linux tem conteúdo suficiente', cobertura.aulas >= 90, cobertura.aulas);

  console.log('\n10. nada quebrado na interface');
  await page.evaluate(() => window.__app.goHome());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, 'student-home.png'), fullPage: true });
  await page.evaluate(() => window.__app.goJornada());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, 'student-journey.png'), fullPage: true });
  await page.evaluate(() => window.__app.goLesson('l17-2'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, 'student-lesson.png'), fullPage: true });
  T('uma aula de troubleshooting renderiza',
    await page.evaluate(() => /chamado/i.test(document.querySelector('#page').innerText)
      && /5120/.test(document.querySelector('#page').innerText)));

  await browser.close();
  srv.close();

  const ruido = erros.filter(e => !/favicon|ERR_|net::/.test(e));
  if (ruido.length) { console.log('\nerros no console:'); ruido.slice(0, 8).forEach(e => console.log('  ' + e)); }
  console.log(`\n=== ${ok} passaram · ${mau} falharam${ruido.length ? ' · ' + ruido.length + ' erros de console' : ''} ===\n`);
  process.exit(mau || ruido.length ? 1 : 0);
})();
