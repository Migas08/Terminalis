/* Auditoria de vocabulário.

   Regra do curso: um desafio só pode exigir o que já foi ENSINADO — nesta
   aula ou em alguma anterior. Nada de "descubra sozinho um comando novo".

   Este teste percorre as aulas na ordem do curso, coleta os comandos que
   cada aula APRESENTA (blocos de código e trechos <code> do texto) e depois
   confere se a solução oficial de cada desafio usa apenas comandos do
   vocabulário acumulado até ali.                                          */

const { loadEngine } = require('./harness');
const LX = loadEngine();

/* ------------------------------------------------------------------ */
const PALAVRAS_DE_SHELL = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done',
  'case', 'esac', 'function', 'in', 'select', 'time', 'coproc',
  'cd', 'echo', 'exit', 'export', 'unset', 'set', 'shift', 'source', 'eval',
  'exec', 'read', 'local', 'return', 'test', 'true', 'false', 'trap', 'wait',
  'alias', 'unalias', 'pwd', 'printf', 'declare', 'readonly', 'let', 'type',
  'command', 'builtin', 'jobs', 'bg', 'fg', 'kill', 'umask', 'ulimit',
  'break', 'continue', 'shopt', 'history', 'help', 'sleep', 'EOF', 'PY',
  'YEOF', 'SQL', 'CONF', 'DOCKERFILE', 'then;', '{', '}', '[', '[[', ']]',
  'sudo', 'env'
]);

/* Comandos que a plataforma ensina fora do texto (menu, terminal, etc.) */
const SEMPRE_DISPONIVEL = new Set(['clear', 'exit', 'man', 'ls', 'cat', 'cd', 'pwd']);

function stripHtml(s) {
  return String(s)
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/* Nomes de comando de um texto de shell: começo de linha, depois de pipe,
   &&, ||, ;, $( e do sudo. */
function comandosDe(texto) {
  const achados = new Set();
  const linhas = String(texto).replace(/\\\n/g, ' ').split('\n');
  let aspaAberta = false;
  for (let bruta of linhas) {
    const linhaOriginal = bruta;
    let linha = bruta.replace(/^\s*\$\s+/, '').trim();
    const dentroDeAspas = aspaAberta;
    /* uma aspa simples aberta atravessa linhas (programas awk, sed) */
    const simples = (linhaOriginal.match(/'/g) || []).length;
    if (simples % 2 === 1) aspaAberta = !aspaAberta;
    if (dentroDeAspas) continue;
    if (!linha || linha.startsWith('#')) continue;
    /* aspa que abre e não fecha nesta linha: dali para a frente é argumento
       de várias linhas (um programa awk, por exemplo) */
    if (simples % 2 === 1) linha = linha.slice(0, linha.indexOf("'"));
    /* o que está entre aspas é argumento (um programa awk, um sh -c),
       não uma sequência de comandos: some antes de separar por ; e | */
    linha = linha.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
    for (const pedaco of linha.split(/\||&&|\|\||;|\$\(|`/)) {
      let p = pedaco.trim();
      /* pula atribuições de variável antes do comando */
      while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(p)) p = p.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s*/, '');
      if (p.startsWith('sudo ')) p = p.slice(5).trim();
      const m = /^([A-Za-z_][A-Za-z0-9_.-]*)/.exec(p);
      if (!m) continue;
      const nome = m[1];
      if (PALAVRAS_DE_SHELL.has(nome)) continue;
      /* nomes de comando são minúsculos; MAIÚSCULA é cabeçalho de saída */
      if (/^[A-Z]/.test(nome)) continue;
      achados.add(nome);
    }
  }
  return achados;
}

/* O que uma aula apresenta: blocos de código + trechos <code> do texto. */
function apresentadosPor(blocos, saida = new Set()) {
  for (const b of (blocos || [])) {
    if (!b) continue;
    if (b.code) {
      const linhas = Array.isArray(b.code) ? b.code : String(b.code).split('\n');
      /* blocos de YAML/Dockerfile não são shell, mas os nomes citados ali
         (docker, traefik) contam como apresentados */
      for (const c of comandosDe(linhas.join('\n'))) saida.add(c);
    }
    for (const campo of ['p', 'h2', 'h4', 'ascii']) {
      if (typeof b[campo] === 'string') {
        /* só os trechos entre <code>: é ali que um comando é apresentado */
        const re = /<code>([\s\S]*?)<\/code>/g;
        let m;
        while ((m = re.exec(b[campo]))) for (const c of comandosDe(stripHtml(m[1]))) saida.add(c);
      }
    }
    for (const campo of ['ul', 'ol']) {
      for (const item of (b[campo] || [])) {
        const re = /<code>([\s\S]*?)<\/code>/g;
        let m;
        while ((m = re.exec(String(item)))) for (const c of comandosDe(stripHtml(m[1]))) saida.add(c);
      }
    }
    if (b.table) {
      const celulas = [].concat(b.table.head || []).concat(...(b.table.rows || []));
      for (const cel of celulas) {
        const re = /<code>([\s\S]*?)<\/code>/g;
        let m;
        while ((m = re.exec(String(cel)))) for (const c of comandosDe(stripHtml(m[1]))) saida.add(c);
      }
    }
    if (b.box && b.body) apresentadosPor(b.body, saida);
  }
  return saida;
}

/* O que um desafio EXIGE: comandos da solução oficial. */
function exigidosPor(t) {
  const usados = new Set();
  const pres = String(t.solution || '').match(/<pre>([\s\S]*?)<\/pre>/g) || [];
  for (const p of pres) {
    const txt = stripHtml(p.replace(/^<pre>/, '').replace(/<\/pre>$/, ''));
    /* um <pre> que é YAML (ou outro arquivo) não contém comandos */
    const primeira = txt.split('\n').map(l => l.trim()).find(Boolean) || '';
    if (/:$/.test(primeira) || /^-\s/.test(primeira)) continue;
    /* Quando a solução marca o prompt com "$ ", as demais linhas são saída
       do comando — não comandos. */
    let linhas = txt.split('\n');
    if (linhas.some(l => /^\s*\$ /.test(l))) linhas = linhas.filter(l => /^\s*\$ /.test(l));
    const limpas = [];
    let dentro = null;
    for (const l of linhas) {
      if (dentro !== null) { if (l.trim() === dentro) dentro = null; continue; }
      const hd = /<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/.exec(l);
      limpas.push(l);
      if (hd) dentro = hd[1];
    }
    for (const c of comandosDe(limpas.join('\n'))) usados.add(c);
  }
  return usados;
}

/* ------------------------------------------------------------------ */
let problemas = 0, aulas = 0, desafios = 0;
const vocabulario = new Set(SEMPRE_DISPONIVEL);

for (const mod of LX.COURSE.modules) {
  for (const lesson of mod.lessons) {
    aulas++;
    /* o corpo da aula vem antes dos desafios dela */
    apresentadosPor(lesson.body, vocabulario);
    for (const t of (lesson.tasks || [])) {
      /* Somente o corpo da aula ensina: dicas não substituem explicação anterior. */
      if (!t.solution) continue;
      /* Desafio cujo OBJETIVO é praticar a descoberta com uma ferramenta já
         ensinada (man -k): o comando encontrado é o resultado, não o
         pré-requisito. */
      if (t.descoberta) { for (const c of exigidosPor(t)) vocabulario.add(c); continue; }
      desafios++;
      const faltando = [];
      for (const c of exigidosPor(t)) if (!vocabulario.has(c)) faltando.push(c);
      if (faltando.length) {
        problemas++;
        console.log(`  ✗ ${t.id} (${lesson.n} ${lesson.title})`);
        console.log(`      usa sem ter ensinado: ${faltando.join(', ')}`);
      }
      /* depois de resolvido, o comando passa a fazer parte do vocabulário */
      for (const c of exigidosPor(t)) vocabulario.add(c);
    }
  }
}

console.log(`\n=== vocabulário: ${aulas} aulas · ${desafios} desafios com solução · ${problemas} usam comando não ensinado ===\n`);
process.exit(problemas ? 1 : 0);
