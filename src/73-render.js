/* =========================================================================
   TERMINALIS — renderização dos blocos de conteúdo
   ========================================================================= */
'use strict';
(function () {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const SH_KEYWORDS = /\b(if|then|else|elif|fi|for|while|until|do|done|case|esac|in|function|return|local|export|source|echo|printf|read|exit|break|continue|declare|shift|set|trap|select)\b/g;

  function highlightShell(line) {
    // linha de saída (sem prompt) fica esmaecida
    let s = esc(line);
    s = s.replace(/(#[^\n]*)$/g, '<span class="cmt">$1</span>');
    s = s.replace(/('[^']*'|"[^"]*")/g, '<span class="str">$1</span>');
    s = s.replace(/(^|\s)(--?[A-Za-z][\w-]*)/g, '$1<span class="flag">$2</span>');
    s = s.replace(SH_KEYWORDS, '<span class="kw">$&</span>');
    s = s.replace(/(^|[\s=(])(\d+)([\s);]|$)/g, '$1<span class="num">$2</span>$3');
    return s;
  }

  function highlightDockerfile(line) {
    let s = esc(line);
    s = s.replace(/^(\s*)(FROM|RUN|CMD|ENTRYPOINT|COPY|ADD|WORKDIR|ENV|ARG|EXPOSE|USER|LABEL|SHELL|VOLUME|HEALTHCHECK|ONBUILD|STOPSIGNAL)\b/,
      '$1<span class="kw">$2</span>');
    s = s.replace(/(#[^\n]*)$/g, '<span class="cmt">$1</span>');
    s = s.replace(/("[^"]*")/g, '<span class="str">$1</span>');
    return s;
  }

  function highlightYaml(line) {
    let s = esc(line);
    s = s.replace(/(#[^\n]*)$/g, '<span class="cmt">$1</span>');
    s = s.replace(/^(\s*)([\w.-]+)(:)/, '$1<span class="flag">$2</span>$3');
    s = s.replace(/(^|\s)(-)(\s)/, '$1<span class="kw">$2</span>$3');
    s = s.replace(/("[^"]*"|'[^']*')/g, '<span class="str">$1</span>');
    return s;
  }

  function renderCode(b) {
    const lines = Array.isArray(b.code) ? b.code : String(b.code).split('\n');
    const lang = b.lang || 'bash';
    const hl = lang === 'dockerfile' ? highlightDockerfile : (lang === 'yaml' ? highlightYaml : highlightShell);
    const runnable = [];
    let body = '';
    for (const raw of lines) {
      const line = String(raw);
      if (lang === 'bash' && /^\$ /.test(line)) {
        const cmd = line.slice(2);
        runnable.push(cmd);
        body += `<span class="cmdline" data-cmd="${esc(cmd)}"><span class="prompt">$ </span>${hl(cmd)}</span>\n`;
      } else if (lang === 'bash' && /^# /.test(line)) {
        body += `<span class="cmt">${esc(line)}</span>\n`;
      } else if (lang === 'bash' && /^\s*$/.test(line)) {
        body += '\n';
      } else if (lang === 'bash' && b.mixed !== false && runnable.length && !/^\$ /.test(line)) {
        body += `<span class="out">${esc(line)}</span>\n`;
      } else {
        body += hl(line) + '\n';
      }
    }
    body = body.replace(/\n$/, '');
    const canRun = b.run !== false && runnable.length > 0 && lang === 'bash';
    return `<div class="code">
      ${b.title ? `<div class="code-head">${esc(b.title)}</div>` : ''}
      <div class="code-actions">
        ${canRun ? `<button class="code-btn" data-run="${esc(runnable.join('\n'))}" title="Executar no terminal">${LX.ICON.play}rodar</button>` : ''}
        <button class="code-btn" data-copy title="Copiar">${LX.ICON.copy}</button>
      </div>
      <pre>${body}</pre>
    </div>`;
  }

  function renderBlock(b, app) {
    if (typeof b === 'string') return `<p>${b}</p>`;
    if (b.p) return `<p>${b.p}</p>`;
    if (b.h2) return `<h2>${b.h2}</h2>`;
    if (b.h3) return `<h3>${b.h3}</h3>`;
    if (b.h4) return `<h4>${b.h4}</h4>`;
    if (b.lede) return `<p class="lede">${b.lede}</p>`;
    if (b.cmd) return `<div class="cmd-chip">${esc(b.cmd)}</div>`;
    if (b.code) return renderCode(b);
    if (b.ul) return `<ul>${b.ul.map(i => `<li>${i}</li>`).join('')}</ul>`;
    if (b.ol) return `<ol>${b.ol.map(i => `<li>${i}</li>`).join('')}</ol>`;
    if (b.hr) return `<hr>`;
    if (b.ascii) return `<div class="ascii">${esc(b.ascii)}</div>`;
    if (b.svg) return `<figure class="figure">${b.svg}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
    if (b.cheat) return `<div class="cheat">${b.cheat.map(([c, d]) => `<div class="cheat-row"><code>${esc(c)}</code><span>${d}</span></div>`).join('')}</div>`;
    if (b.table) {
      const t = b.table;
      return `<div class="table-wrap"><table><thead><tr>${t.head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (b.box) {
      const labels = { tip: 'Dica', note: 'Nota', warn: 'Atenção', key: 'Conceito-chave', old: 'Prática antiga' };
      return `<div class="box ${b.box}">
        <div class="box-label">${esc(b.label || labels[b.box] || '')}</div>
        ${renderBlocks(b.body || [{ p: b.text || '' }], app)}
      </div>`;
    }
    return '';
  }

  function renderBlocks(blocks, app) {
    return (blocks || []).map(b => renderBlock(b, app)).join('');
  }

  LX.renderBlocks = renderBlocks;
  LX.highlightShell = highlightShell;
})();
