/* =========================================================================
   TERMINALIS — YAML
   Um analisador de YAML de verdade para o subconjunto que Compose e
   Traefik usam. Erra onde o YAML de verdade erra: tabulação proibida,
   indentação inconsistente, `no` virando booleano, `22:22` virando
   conversão implícita de tipos. É esse comportamento que a aula precisa demonstrar.
   ========================================================================= */
'use strict';
(function () {

  class ErroYaml extends Error {
    constructor(msg, linha, coluna) {
      super(msg);
      this.linha = linha;
      this.coluna = coluna;
      this.yaml = true;
    }
  }
  LX.ErroYaml = ErroYaml;

  /* -------------------------------------------------------------------
     Valores escalares — a parte que mais confunde
     ------------------------------------------------------------------- */
  function escalar(bruto) {
    let s = String(bruto).trim();
    if (s === '') return null;

    /* com aspas, é sempre string; nada de conversão implícita */
    if ((s.startsWith('"') && s.endsWith('"') && s.length > 1) ||
      (s.startsWith("'") && s.endsWith("'") && s.length > 1)) {
      const interno = s.slice(1, -1);
      return s[0] === '"' ? interno.replace(/\\n/g, '\n').replace(/\\"/g, '"') : interno.replace(/''/g, "'");
    }
    /* comentário depois do valor (só depois de espaço) */
    const ic = s.search(/\s#/);
    if (ic >= 0) s = s.slice(0, ic).trim();
    if (s === '') return null;

    if (s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
    /* Esquema "core" do YAML 1.2 — é o que o yaml.v3 do Go usa, e portanto o
       que o Docker Compose v2, o Traefik e o Kubernetes realmente enxergam.
       Só estas seis grafias viram booleano: `no`, `yes`, `on` e `off` são
       STRINGS aqui (no YAML 1.1 do PyYAML/Ansible não são — a aula explica). */
    if (/^(true|True|TRUE)$/.test(s)) return true;
    if (/^(false|False|FALSE)$/.test(s)) return false;
    if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
    if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8);
    /* decimal: `0755` vale SETECENTOS E CINQUENTA E CINCO, não 493 */
    if (/^[-+]?[0-9]+$/.test(s)) return parseInt(s, 10);
    if (/^[-+]?(\.[0-9]+|[0-9]+\.[0-9]*)([eE][-+]?[0-9]+)?$/.test(s)) return parseFloat(s);
    if (/^[-+]?[0-9]+[eE][-+]?[0-9]+$/.test(s)) return parseFloat(s);
    if (/^[-+]?\.(inf|Inf|INF)$/.test(s)) return s[0] === '-' ? -Infinity : Infinity;
    if (/^\.(nan|NaN|NAN)$/.test(s)) return NaN;
    /* `22:22` NÃO vira 1342 aqui: sexagesimal é YAML 1.1, e o Compose v2 não usa */
    /* [a, b] e {a: 1} em linha */
    if (s.startsWith('[') && s.endsWith(']')) {
      const dentro = s.slice(1, -1).trim();
      if (!dentro) return [];
      return dividirEmLinha(dentro).map(escalar);
    }
    if (s.startsWith('{') && s.endsWith('}')) {
      const dentro = s.slice(1, -1).trim();
      const o = {};
      if (!dentro) return o;
      for (const par of dividirEmLinha(dentro)) {
        const dp = par.indexOf(':');
        if (dp < 0) { o[par.trim()] = null; continue; }
        o[par.slice(0, dp).trim()] = escalar(par.slice(dp + 1));
      }
      return o;
    }
    return s;
  }
  function dividirEmLinha(s) {
    const partes = []; let atual = '', prof = 0, aspas = null;
    for (const ch of s) {
      if (aspas) { atual += ch; if (ch === aspas) aspas = null; continue; }
      if (ch === '"' || ch === "'") { aspas = ch; atual += ch; continue; }
      if (ch === '[' || ch === '{') prof++;
      if (ch === ']' || ch === '}') prof--;
      if (ch === ',' && prof === 0) { partes.push(atual); atual = ''; continue; }
      atual += ch;
    }
    if (atual.trim()) partes.push(atual);
    return partes.map(x => x.trim());
  }

  /* Divide "chave: valor" respeitando aspas — `rule: Host(`a`) && x` tem
     dois pontos dentro do valor e não pode quebrar a chave. */
  function separarChave(texto) {
    let aspas = null;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (aspas) { if (ch === aspas) aspas = null; continue; }
      if (ch === '"' || ch === "'") { aspas = ch; continue; }
      if (ch === '#' && i > 0 && /\s/.test(texto[i - 1])) break;
      if (ch === ':' && (i + 1 >= texto.length || /[\s]/.test(texto[i + 1]))) {
        return { chave: texto.slice(0, i).trim(), resto: texto.slice(i + 1) };
      }
    }
    return null;
  }

  /* -------------------------------------------------------------------
     Analisador por indentação
     ------------------------------------------------------------------- */
  LX.lerYaml = function (texto) {
    const cruas = String(texto).replace(/\r\n?/g, '\n').split('\n');
    const linhas = [];
    for (let i = 0; i < cruas.length; i++) {
      const l = cruas[i];
      if (/^\s*$/.test(l)) continue;
      if (/^\s*#/.test(l)) continue;
      if (/^---\s*$/.test(l) || /^\.\.\.\s*$/.test(l)) continue;
      const rec = /^(\s*)/.exec(l)[1];
      if (rec.includes('\t')) {
        throw new ErroYaml(`found character '\\t' that cannot start any token`, i + 1, rec.indexOf('\t') + 1);
      }
      linhas.push({ n: i + 1, ind: rec.length, texto: l.trim(), cru: l });
    }
    if (!linhas.length) return null;

    let pos = 0;
    function bloco(indMin) {
      /* lista? */
      if (linhas[pos] && linhas[pos].texto.startsWith('- ') || (linhas[pos] && linhas[pos].texto === '-')) {
        const ind = linhas[pos].ind;
        const arr = [];
        while (pos < linhas.length && linhas[pos].ind === ind && (linhas[pos].texto.startsWith('- ') || linhas[pos].texto === '-')) {
          const l = linhas[pos];
          const conteudo = l.texto === '-' ? '' : l.texto.slice(2).trim();
          pos++;
          if (!conteudo) {
            const filho = (pos < linhas.length && linhas[pos].ind > ind) ? bloco(ind + 1) : null;
            arr.push(filho);
            continue;
          }
          const par = separarChave(conteudo);
          if (par) {
            /* item de lista que é um mapa: "- type: bind" */
            const obj = {};
            const indItem = l.ind + 2;
            if (par.resto.trim() === '') {
              if (pos < linhas.length && linhas[pos].ind > l.ind) obj[par.chave] = bloco(l.ind + 1);
              else obj[par.chave] = null;
            } else obj[par.chave] = escalar(par.resto);
            while (pos < linhas.length && linhas[pos].ind >= indItem && !linhas[pos].texto.startsWith('- ')) {
              const p2 = separarChave(linhas[pos].texto);
              if (!p2) break;
              const indAtual = linhas[pos].ind;
              pos++;
              if (p2.resto.trim() === '') {
                obj[p2.chave] = (pos < linhas.length && linhas[pos].ind > indAtual) ? bloco(indAtual + 1) : null;
              } else obj[p2.chave] = escalar(p2.resto);
            }
            arr.push(obj);
            continue;
          }
          arr.push(escalar(conteudo));
        }
        return arr;
      }

      /* mapa */
      const obj = {};
      if (!linhas[pos]) return obj;
      const ind = linhas[pos].ind;
      while (pos < linhas.length && linhas[pos].ind >= ind) {
        if (linhas[pos].ind > ind) {
          throw new ErroYaml(`mapping values are not allowed here`, linhas[pos].n, linhas[pos].ind + 1);
        }
        const l = linhas[pos];
        const par = separarChave(l.texto);
        if (!par) {
          throw new ErroYaml(`could not find expected ':'`, l.n, l.ind + 1);
        }
        pos++;
        let chave = par.chave;
        if (/^["'].*["']$/.test(chave)) chave = chave.slice(1, -1);
        const resto = par.resto.trim();
        if (resto === '' || resto === '|' || resto === '>' || resto === '|-' || resto === '>-') {
          if (resto === '|' || resto === '>' || resto === '|-' || resto === '>-') {
            /* bloco literal: junta as linhas mais indentadas */
            const partes = [];
            while (pos < linhas.length && linhas[pos].ind > ind) { partes.push(linhas[pos].cru.slice(ind + 2)); pos++; }
            obj[chave] = partes.join(resto[0] === '|' ? '\n' : ' ') + (resto.endsWith('-') ? '' : '\n');
            continue;
          }
          if (pos < linhas.length && (linhas[pos].ind > ind ||
            (linhas[pos].ind === ind && (linhas[pos].texto.startsWith('- ') || linhas[pos].texto === '-')))) {
            obj[chave] = bloco(linhas[pos].ind);
          } else obj[chave] = null;
          continue;
        }
        obj[chave] = escalar(resto);
      }
      return obj;
    }

    const r = bloco(linhas[0].ind);
    return r;
  };

  /* -------------------------------------------------------------------
     Escrita (usada por `docker compose config`)
     ------------------------------------------------------------------- */
  LX.escreverYaml = function (valor, nivel = 0) {
    const pad = '  '.repeat(nivel);
    if (valor === null || valor === undefined) return 'null';
    if (typeof valor === 'boolean' || typeof valor === 'number') return String(valor);
    if (typeof valor === 'string') {
      if (valor === '' ) return '""';
      /* cita o que voltaria como outro tipo se ficasse solto */
      if (/^(true|false|yes|no|on|off|null|~)$/i.test(valor) || /^[-+]?\d+(\.\d+)?$/.test(valor) ||
        /^\d{1,2}(:\d{2})+$/.test(valor) || /[:#{}\[\],&*?|<>=!%@`]/.test(valor) || /^\s|\s$/.test(valor)) {
        return '"' + valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
      }
      return valor;
    }
    if (Array.isArray(valor)) {
      if (!valor.length) return '[]';
      return '\n' + valor.map(v => {
        const s = LX.escreverYaml(v, nivel + 1);
        if (s.startsWith('\n')) return pad + '- ' + s.replace(/^\n/, '').replace(new RegExp('^' + '  '.repeat(nivel + 1)), '').replace(new RegExp('\n' + '  '.repeat(nivel + 1), 'g'), '\n' + '  '.repeat(nivel + 1));
        return pad + '- ' + s;
      }).join('\n');
    }
    const chaves = Object.keys(valor);
    if (!chaves.length) return '{}';
    return '\n' + chaves.map(k => {
      const s = LX.escreverYaml(valor[k], nivel + 1);
      return pad + k + ':' + (s.startsWith('\n') ? s : ' ' + s);
    }).join('\n');
  };

  LX.yamlDocumento = function (obj) {
    const s = LX.escreverYaml(obj, 0);
    return (s.startsWith('\n') ? s.slice(1) : s) + '\n';
  };
})();
