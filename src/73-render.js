/* =========================================================================
   TERMINALIS — renderização dos blocos de conteúdo
   ========================================================================= */
'use strict';
(function () {
  const { escapeHtml: esc } = LX.Util;

  function highlightShell(line) {
    return String(line).split(/('[^']*'|"[^"]*"|#[^\n]*|--?[A-Za-z][\w-]*)/g).map(token => {
      const cls=/^['"]/.test(token)?'str':token.startsWith('#')?'cmt':/^--?\w/.test(token)?'flag':'';
      return cls?'<span class="'+cls+'">'+esc(token)+'</span>':esc(token);
    }).join('');
  }
  const highlightDockerfile = highlightShell;
  const highlightYaml = highlightShell;

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
    if (b.gitVisual && LX.GitVisual) return LX.GitVisual.render(b.gitVisual, app);
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
  // Verifier messages mix prose and code markup with values from the lab.
  // Rebuild only formatting tags; never insert attributes or executable HTML.
  LX.feedbackHtml = message => {
    const template = document.createElement('template');
    template.innerHTML = String(message);
    const allowed = new Set(['CODE', 'STRONG', 'B', 'EM', 'I', 'BR', 'P', 'PRE', 'UL', 'OL', 'LI']);
    const render = node => {
      if (node.nodeType === 3) return esc(node.textContent);
      if (node.nodeType !== 1) return '';
      if (!allowed.has(node.tagName)) return esc(node.outerHTML);
      const tag = node.tagName.toLowerCase();
      return tag === 'br' ? '<br>' : `<${tag}>${Array.from(node.childNodes, render).join('')}</${tag}>`;
    };
    return Array.from(template.content.childNodes, render).join('');
  };
  LX.highlightShell = highlightShell;
})();
