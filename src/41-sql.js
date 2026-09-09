/* =========================================================================
   TERMINALIS — banco de dados relacional em miniatura
   Serve aos containers de MariaDB e PostgreSQL. É um banco de verdade
   dentro do emulador: cria tabelas, guarda linhas, roda SELECT/INSERT/
   UPDATE/DELETE, erra com as mensagens reais e sabe fazer dump e restore.

   Sem isso, o módulo de troubleshooting de banco seria teatro: o aluno
   precisa entrar no container, abrir o cliente, olhar a tabela que falta
   e criar a tabela — e a API tem que voltar a funcionar de verdade.
   ========================================================================= */
'use strict';
(function () {

  /* --------------------------- valores --------------------------- */
  function comoNumero(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  function formatar(v) {
    if (v === null || v === undefined) return null;
    return v;
  }

  /* --------------------------- tokenizador --------------------------- */
  function tokens(sql) {
    const out = [];
    let i = 0;
    while (i < sql.length) {
      const ch = sql[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
      if (ch === '#') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
      if (ch === '/' && sql[i + 1] === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i += 2; continue; }
      if (ch === "'" || ch === '"' || ch === '`') {
        const fim = ch; let s = ''; i++;
        while (i < sql.length) {
          if (sql[i] === '\\' && fim === "'") { s += sql[i + 1] === 'n' ? '\n' : sql[i + 1]; i += 2; continue; }
          if (sql[i] === fim) { if (sql[i + 1] === fim) { s += fim; i += 2; continue; } break; }
          s += sql[i++];
        }
        i++;
        out.push({ t: fim === "'" ? 'str' : 'id', v: s });
        continue;
      }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
        let s = ''; while (i < sql.length && /[0-9.]/.test(sql[i])) s += sql[i++];
        out.push({ t: 'num', v: parseFloat(s) });
        continue;
      }
      if (/[A-Za-z_@]/.test(ch)) {
        let s = ''; while (i < sql.length && /[A-Za-z0-9_@$]/.test(sql[i])) s += sql[i++];
        out.push({ t: 'palavra', v: s });
        continue;
      }
      const dois = sql.slice(i, i + 2);
      if (['<=', '>=', '<>', '!='].includes(dois)) { out.push({ t: 'op', v: dois }); i += 2; continue; }
      out.push({ t: 'op', v: ch }); i++;
    }
    return out;
  }

  /* Separa comandos por ";" sem quebrar dentro de aspas */
  LX.separarSQL = function (texto) {
    const partes = [];
    let atual = '', dentro = null;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (dentro) { atual += ch; if (ch === dentro && texto[i - 1] !== '\\') dentro = null; continue; }
      if (ch === "'" || ch === '`' || ch === '"') { dentro = ch; atual += ch; continue; }
      if (ch === ';') { partes.push(atual); atual = ''; continue; }
      atual += ch;
    }
    if (atual.trim()) partes.push(atual);
    return partes;
  };

  /* =====================================================================
     BANCO
     ===================================================================== */
  class Banco {
    constructor(opts = {}) {
      this.motor = opts.motor || 'mariadb';   // 'mariadb' | 'postgres'
      this.versao = opts.versao || (this.motor === 'mariadb' ? '11.4.4-MariaDB-ubu2404' : '17.2');
      this.bancos = new Map();
      this.usuarios = new Map();
      this.atual = null;
      const sistema = this.motor === 'mariadb'
        ? ['information_schema', 'mysql', 'performance_schema', 'sys']
        : ['postgres', 'template0', 'template1'];
      for (const b of sistema) this.bancos.set(b, { nome: b, sistema: true, tabelas: new Map() });
    }

    criarBanco(nome) {
      if (this.bancos.has(nome)) return { erro: this.motor === 'mariadb'
        ? `ERROR 1007 (HY000): Can't create database '${nome}'; database exists`
        : `ERROR:  database "${nome}" already exists` };
      this.bancos.set(nome, { nome, tabelas: new Map() });
      return { ok: true, afetadas: 1 };
    }
    usar(nome) {
      if (!this.bancos.has(nome)) return { erro: this.motor === 'mariadb'
        ? `ERROR 1049 (42000): Unknown database '${nome}'`
        : `FATAL:  database "${nome}" does not exist` };
      this.atual = nome;
      return { ok: true, mensagem: 'Database changed' };
    }
    db() { return this.atual ? this.bancos.get(this.atual) : null; }

    erroSemBanco() {
      return this.motor === 'mariadb'
        ? 'ERROR 1046 (3D000): No database selected'
        : 'ERROR:  no database selected';
    }
    erroTabela(nome) {
      return this.motor === 'mariadb'
        ? `ERROR 1146 (42S02): Table '${this.atual}.${nome}' doesn't exist`
        : `ERROR:  relation "${nome}" does not exist`;
    }
    erroColuna(nome, onde = 'field list') {
      return this.motor === 'mariadb'
        ? `ERROR 1054 (42S22): Unknown column '${nome}' in '${onde}'`
        : `ERROR:  column "${nome}" does not exist`;
    }

    tabela(nome) {
      const d = this.db();
      if (!d) return null;
      if (d.tabelas.has(nome)) return d.tabelas.get(nome);
      /* MariaDB no Linux diferencia maiúsculas; Postgres normaliza para minúsculas */
      if (this.motor === 'postgres') {
        for (const [k, v] of d.tabelas) if (k.toLowerCase() === nome.toLowerCase()) return v;
      }
      return null;
    }

    /* --------------------- execução de um comando --------------------- */
    executar(sql) {
      const r = this._executar(sql);
      /* Toda escrita vai para o volume. É por isso que apagar o container
         do banco não apaga os dados — eles nunca estiveram no container. */
      if (r && !r.erro && r.afetadas !== undefined && this._persistir) {
        try { this._persistir(); } catch (e) { }
      }
      return r;
    }

    _executar(sql) {
      const tk = tokens(sql);
      if (!tk.length) return { ok: true, vazio: true };
      const pal = (i) => (tk[i] && tk[i].t === 'palavra') ? tk[i].v.toUpperCase() : '';
      const c1 = pal(0), c2 = pal(1);

      try {
        if (c1 === 'SELECT') return this._select(tk);
        if (c1 === 'INSERT') return this._insert(tk);
        if (c1 === 'UPDATE') return this._update(tk);
        if (c1 === 'DELETE') return this._delete(tk);
        if (c1 === 'CREATE' && (c2 === 'DATABASE' || c2 === 'SCHEMA')) return this._criarBanco(tk);
        if (c1 === 'CREATE' && c2 === 'TABLE') return this._criarTabela(tk);
        if (c1 === 'CREATE' && c2 === 'USER') return { ok: true, afetadas: 0 };
        if (c1 === 'DROP' && (c2 === 'DATABASE' || c2 === 'SCHEMA')) return this._dropBanco(tk);
        if (c1 === 'DROP' && c2 === 'TABLE') return this._dropTabela(tk);
        if (c1 === 'ALTER' && c2 === 'TABLE') return this._alterar(tk);
        if (c1 === 'SHOW') return this._show(tk);
        if (c1 === 'DESCRIBE' || c1 === 'DESC') return this._describe(tk[1] ? tk[1].v : '');
        if (c1 === 'USE') return this.usar(tk[1] ? String(tk[1].v) : '');
        if (c1 === 'GRANT' || c1 === 'REVOKE' || c1 === 'FLUSH' || c1 === 'SET' ||
          c1 === 'START' || c1 === 'COMMIT' || c1 === 'BEGIN' || c1 === 'LOCK' || c1 === 'UNLOCK') {
          return { ok: true, afetadas: 0 };
        }
        if (c1 === 'TRUNCATE') {
          const nome = tk[c2 === 'TABLE' ? 2 : 1].v;
          const t = this.tabela(nome);
          if (!t) return { erro: this.erroTabela(nome) };
          t.linhas.length = 0;
          return { ok: true, afetadas: 0 };
        }
        return { erro: this.motor === 'mariadb'
          ? `ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near '${sql.trim().slice(0, 30)}' at line 1`
          : `ERROR:  syntax error at or near "${tk[0].v}"` };
      } catch (e) {
        if (e && e.sqlErro) return { erro: e.sqlErro };
        return { erro: `ERROR: ${e.message}` };
      }
    }

    /* Vários comandos separados por ; (usado no restore de um .sql) */
    executarLote(texto) {
      const partes = LX.separarSQL(texto);
      const res = [];
      for (const p of partes) {
        if (!p.replace(/--[^\n]*/g, '').trim()) continue;
        const r = this.executar(p);
        res.push(r);
        if (r.erro) return { erro: r.erro, executados: res.length - 1 };
      }
      return { ok: true, executados: res.length };
    }

    /* ----------------------------- CREATE ----------------------------- */
    _criarBanco(tk) {
      let i = 2;
      if (tk[2] && String(tk[2].v).toUpperCase() === 'IF') i = 5;   // IF NOT EXISTS
      const nome = String(tk[i].v);
      if (i === 5 && this.bancos.has(nome)) return { ok: true, afetadas: 1 };
      return this.criarBanco(nome);
    }
    _dropBanco(tk) {
      let i = 2;
      if (tk[2] && String(tk[2].v).toUpperCase() === 'IF') i = 4;
      const nome = String(tk[i].v);
      if (!this.bancos.has(nome)) {
        if (i === 4) return { ok: true, afetadas: 0 };
        return { erro: `ERROR 1008 (HY000): Can't drop database '${nome}'; database doesn't exist` };
      }
      this.bancos.delete(nome);
      if (this.atual === nome) this.atual = null;
      return { ok: true, afetadas: 0 };
    }
    _criarTabela(tk) {
      let i = 2;
      if (String(tk[2].v).toUpperCase() === 'IF') i = 5;
      const d = this.db();
      if (!d) return { erro: this.erroSemBanco() };
      const nome = String(tk[i].v);
      if (d.tabelas.has(nome)) {
        if (i === 5) return { ok: true, afetadas: 0, aviso: `Note 1050 Table '${nome}' already exists` };
        return { erro: this.motor === 'mariadb'
          ? `ERROR 1050 (42S01): Table '${nome}' already exists`
          : `ERROR:  relation "${nome}" already exists` };
      }
      i++;
      if (!tk[i] || tk[i].v !== '(') return { erro: `ERROR 1064 (42000): You have an error in your SQL syntax` };
      i++;
      const colunas = [];
      let profundidade = 0;
      let corrente = [];
      for (; i < tk.length; i++) {
        const t = tk[i];
        if (t.v === '(' ) { profundidade++; corrente.push(t); continue; }
        if (t.v === ')') {
          if (profundidade === 0) break;
          profundidade--; corrente.push(t); continue;
        }
        if (t.v === ',' && profundidade === 0) { colunas.push(corrente); corrente = []; continue; }
        corrente.push(t);
      }
      if (corrente.length) colunas.push(corrente);

      const defs = [];
      let chavePrimaria = null;
      for (const col of colunas) {
        if (!col.length) continue;
        const primeiro = String(col[0].v).toUpperCase();
        if (['PRIMARY', 'KEY', 'UNIQUE', 'INDEX', 'CONSTRAINT', 'FOREIGN'].includes(primeiro)) {
          if (primeiro === 'PRIMARY') {
            const alvo = col.find((t, k) => k > 1 && t.t === 'id') || col.find((t, k) => k > 1 && t.t === 'palavra');
            if (alvo) chavePrimaria = String(alvo.v);
          }
          continue;
        }
        const nomeCol = String(col[0].v);
        let tipo = col[1] ? String(col[1].v).toUpperCase() : 'VARCHAR';
        let k = 2;
        if (col[2] && col[2].v === '(') { tipo += '('; k = 3; while (col[k] && col[k].v !== ')') { tipo += col[k].v; k++; } tipo += ')'; k++; }
        const resto = col.slice(k).map(t => String(t.v).toUpperCase()).join(' ');
        const naoNulo = /NOT\s+NULL/.test(resto);
        const autoInc = /AUTO_INCREMENT/.test(resto) || tipo === 'SERIAL' || tipo === 'BIGSERIAL';
        const pk = /PRIMARY\s+KEY/.test(resto);
        if (pk) chavePrimaria = nomeCol;
        let padrao = null;
        const md = col.slice(k).findIndex(t => String(t.v).toUpperCase() === 'DEFAULT');
        if (md >= 0 && col[k + md + 1]) padrao = col[k + md + 1].v;
        defs.push({
          nome: nomeCol, tipo: tipo === 'SERIAL' ? 'int(11)' : tipo.toLowerCase(),
          nulo: !naoNulo && !pk, padrao, autoInc, chave: pk ? 'PRI' : ''
        });
      }
      if (chavePrimaria) { const c = defs.find(x => x.nome === chavePrimaria); if (c) { c.chave = 'PRI'; c.nulo = false; } }
      d.tabelas.set(nome, { nome, colunas: defs, linhas: [], proxId: 1, chavePrimaria });
      return { ok: true, afetadas: 0 };
    }
    _dropTabela(tk) {
      let i = 2;
      if (String(tk[2].v).toUpperCase() === 'IF') i = 4;
      const d = this.db();
      if (!d) return { erro: this.erroSemBanco() };
      const nome = String(tk[i].v);
      if (!d.tabelas.has(nome)) {
        if (i === 4) return { ok: true, afetadas: 0 };
        return { erro: this.motor === 'mariadb'
          ? `ERROR 1051 (42S02): Unknown table '${this.atual}.${nome}'`
          : `ERROR:  table "${nome}" does not exist` };
      }
      d.tabelas.delete(nome);
      return { ok: true, afetadas: 0 };
    }
    _alterar(tk) {
      const nome = String(tk[2].v);
      const t = this.tabela(nome);
      if (!t) return { erro: this.erroTabela(nome) };
      const acao = String(tk[3] ? tk[3].v : '').toUpperCase();
      if (acao === 'ADD') {
        let i = 4;
        if (String(tk[4].v).toUpperCase() === 'COLUMN') i = 5;
        const nomeCol = String(tk[i].v);
        if (t.colunas.some(c => c.nome === nomeCol)) {
          return { erro: `ERROR 1060 (42S21): Duplicate column name '${nomeCol}'` };
        }
        let tipo = tk[i + 1] ? String(tk[i + 1].v).toLowerCase() : 'varchar(255)';
        let k = i + 2;
        if (tk[k] && tk[k].v === '(') { tipo += '('; k++; while (tk[k] && tk[k].v !== ')') { tipo += tk[k].v; k++; } tipo += ')'; k++; }
        const resto = tk.slice(k).map(x => String(x.v).toUpperCase()).join(' ');
        const col = { nome: nomeCol, tipo, nulo: !/NOT\s+NULL/.test(resto), padrao: null, autoInc: false, chave: '' };
        t.colunas.push(col);
        for (const l of t.linhas) l[nomeCol] = null;
        return { ok: true, afetadas: 0 };
      }
      if (acao === 'DROP') {
        let i = 4;
        if (String(tk[4].v).toUpperCase() === 'COLUMN') i = 5;
        const nomeCol = String(tk[i].v);
        const idx = t.colunas.findIndex(c => c.nome === nomeCol);
        if (idx < 0) return { erro: this.erroColuna(nomeCol) };
        t.colunas.splice(idx, 1);
        for (const l of t.linhas) delete l[nomeCol];
        return { ok: true, afetadas: 0 };
      }
      return { ok: true, afetadas: 0 };
    }

    /* ------------------------------ SHOW ------------------------------ */
    _show(tk) {
      const o = String(tk[1] ? tk[1].v : '').toUpperCase();
      if (o === 'DATABASES' || o === 'SCHEMAS') {
        return { ok: true, colunas: ['Database'], linhas: Array.from(this.bancos.keys()).sort().map(n => ({ Database: n })) };
      }
      if (o === 'TABLES') {
        const d = this.db();
        if (!d) return { erro: this.erroSemBanco() };
        const col = `Tables_in_${d.nome}`;
        return { ok: true, colunas: [col], linhas: Array.from(d.tabelas.keys()).sort().map(n => ({ [col]: n })) };
      }
      if (o === 'COLUMNS') {
        const idx = tk.findIndex(t => String(t.v).toUpperCase() === 'FROM');
        return this._describe(String(tk[idx + 1].v));
      }
      if (o === 'CREATE') {
        const nome = String(tk[3].v);
        const t = this.tabela(nome);
        if (!t) return { erro: this.erroTabela(nome) };
        return { ok: true, colunas: ['Table', 'Create Table'], linhas: [{ Table: nome, 'Create Table': this.ddl(t) }] };
      }
      return { ok: true, colunas: ['Variable_name', 'Value'], linhas: [{ Variable_name: 'version', Value: this.versao }] };
    }
    _describe(nome) {
      const t = this.tabela(String(nome));
      if (!t) return { erro: this.erroTabela(String(nome)) };
      return {
        ok: true, colunas: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'],
        linhas: t.colunas.map(c => ({
          Field: c.nome, Type: c.tipo, Null: c.nulo ? 'YES' : 'NO', Key: c.chave || '',
          Default: c.padrao === null || c.padrao === undefined ? null : String(c.padrao),
          Extra: c.autoInc ? 'auto_increment' : ''
        }))
      };
    }
    ddl(t) {
      const linhas = t.colunas.map(c =>
        `  \`${c.nome}\` ${c.tipo}${c.nulo ? '' : ' NOT NULL'}${c.autoInc ? ' AUTO_INCREMENT' : ''}` +
        (c.padrao !== null && c.padrao !== undefined ? ` DEFAULT ${typeof c.padrao === 'string' ? "'" + c.padrao + "'" : c.padrao}` : ''));
      if (t.chavePrimaria) linhas.push(`  PRIMARY KEY (\`${t.chavePrimaria}\`)`);
      return `CREATE TABLE \`${t.nome}\` (\n${linhas.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
    }

    /* ----------------------------- INSERT ----------------------------- */
    _insert(tk) {
      let i = 1;
      if (String(tk[1].v).toUpperCase() === 'INTO') i = 2;
      const nome = String(tk[i].v);
      const t = this.tabela(nome);
      if (!t) return { erro: this.erroTabela(nome) };
      i++;
      let cols = null;
      if (tk[i] && tk[i].v === '(') {
        cols = []; i++;
        while (tk[i] && tk[i].v !== ')') { if (tk[i].v !== ',') cols.push(String(tk[i].v)); i++; }
        i++;
      }
      if (!tk[i] || String(tk[i].v).toUpperCase() !== 'VALUES') {
        return { erro: `ERROR 1064 (42000): You have an error in your SQL syntax` };
      }
      i++;
      const grupos = [];
      while (i < tk.length) {
        if (tk[i].v === ',') { i++; continue; }
        if (tk[i].v !== '(') break;
        i++;
        const vals = [];
        let neg = false;
        while (tk[i] && tk[i].v !== ')') {
          if (tk[i].v === ',') { i++; continue; }
          if (tk[i].v === '-') { neg = true; i++; continue; }
          let v = tk[i].v;
          if (tk[i].t === 'palavra') {
            const up = String(v).toUpperCase();
            if (up === 'NULL') v = null;
            else if (up === 'TRUE') v = 1;
            else if (up === 'FALSE') v = 0;
            else if (up === 'NOW' || up === 'CURRENT_TIMESTAMP') {
              v = new Date().toISOString().slice(0, 19).replace('T', ' ');
              if (tk[i + 1] && tk[i + 1].v === '(') { i += 2; while (tk[i] && tk[i].v !== ')') i++; }
            }
          }
          if (neg && typeof v === 'number') { v = -v; neg = false; }
          vals.push(v);
          i++;
        }
        i++;
        grupos.push(vals);
      }
      const alvo = cols || t.colunas.map(c => c.nome);
      for (const c of alvo) {
        if (!t.colunas.some(x => x.nome === c)) return { erro: this.erroColuna(c) };
      }
      let n = 0;
      for (const vals of grupos) {
        if (vals.length !== alvo.length) {
          return { erro: `ERROR 1136 (21S01): Column count doesn't match value count at row ${n + 1}` };
        }
        const linha = {};
        for (const col of t.colunas) linha[col.nome] = col.padrao !== undefined ? col.padrao : null;
        alvo.forEach((c, k) => { linha[c] = vals[k]; });
        for (const col of t.colunas) {
          if (col.autoInc && (linha[col.nome] === null || linha[col.nome] === undefined)) linha[col.nome] = t.proxId++;
          else if (col.autoInc && typeof linha[col.nome] === 'number') t.proxId = Math.max(t.proxId, linha[col.nome] + 1);
        }
        for (const col of t.colunas) {
          if (!col.nulo && (linha[col.nome] === null || linha[col.nome] === undefined) && !col.autoInc) {
            return { erro: `ERROR 1364 (HY000): Field '${col.nome}' doesn't have a default value` };
          }
        }
        if (t.chavePrimaria) {
          const v = linha[t.chavePrimaria];
          if (t.linhas.some(l => l[t.chavePrimaria] === v)) {
            return { erro: `ERROR 1062 (23000): Duplicate entry '${v}' for key 'PRIMARY'` };
          }
        }
        t.linhas.push(linha);
        n++;
      }
      return { ok: true, afetadas: n };
    }

    /* --------------------------- WHERE / ORDER --------------------------- */
    _condicao(tk, inicio, t) {
      /* subconjunto suficiente: col OP valor  [AND|OR ...], com LIKE, IN, IS NULL */
      const partes = [];
      let i = inicio;
      let juncao = 'AND';
      while (i < tk.length) {
        const p = String(tk[i].v).toUpperCase();
        if (['ORDER', 'LIMIT', 'GROUP', 'HAVING'].includes(p)) break;
        if (p === 'AND' || p === 'OR') { juncao = p; i++; continue; }
        const campo = String(tk[i].v);
        if (t && !t.colunas.some(c => c.nome === campo)) {
          const e = new Error('coluna'); e.sqlErro = this.erroColuna(campo, 'where clause'); throw e;
        }
        i++;
        let op = String(tk[i] ? tk[i].v : '=').toUpperCase();
        i++;
        if (op === 'IS') {
          let negado = false;
          if (String(tk[i].v).toUpperCase() === 'NOT') { negado = true; i++; }
          i++; // NULL
          partes.push({ juncao, teste: (l) => negado ? (l[campo] !== null && l[campo] !== undefined) : (l[campo] === null || l[campo] === undefined) });
          continue;
        }
        if (op === 'IN' || op === 'NOT') {
          const negado = op === 'NOT';
          if (negado) i++;
          i++; // (
          const lista = [];
          while (tk[i] && tk[i].v !== ')') { if (tk[i].v !== ',') lista.push(tk[i].v); i++; }
          i++;
          partes.push({ juncao, teste: (l) => negado ? !lista.includes(l[campo]) : lista.includes(l[campo]) });
          continue;
        }
        let valor = tk[i] ? tk[i].v : null;
        if (tk[i] && tk[i].v === '-') { i++; valor = -tk[i].v; }
        if (tk[i] && tk[i].t === 'palavra' && String(valor).toUpperCase() === 'NULL') valor = null;
        i++;
        if (op === 'LIKE') {
          const re = new RegExp('^' + String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
          partes.push({ juncao, teste: (l) => re.test(String(l[campo] === null ? '' : l[campo])) });
          continue;
        }
        partes.push({
          juncao, teste: (l) => {
            const a = l[campo], b = valor;
            const na = comoNumero(a), nb = comoNumero(b);
            const usaNum = na !== null && nb !== null && typeof b !== 'string';
            const x = usaNum ? na : (a === null ? null : String(a));
            const y = usaNum ? nb : (b === null ? null : String(b));
            switch (op) {
              case '=': case '==': return x === y;
              case '!=': case '<>': return x !== y;
              case '>': return x > y;
              case '<': return x < y;
              case '>=': return x >= y;
              case '<=': return x <= y;
              default: return false;
            }
          }
        });
      }
      const filtro = (l) => {
        if (!partes.length) return true;
        let r = partes[0].teste(l);
        for (let k = 1; k < partes.length; k++) {
          r = partes[k].juncao === 'OR' ? (r || partes[k].teste(l)) : (r && partes[k].teste(l));
        }
        return r;
      };
      return { filtro, fim: i };
    }

    /* ----------------------------- SELECT ----------------------------- */
    _select(tk) {
      /* SELECT VERSION() / DATABASE() / NOW() sem FROM */
      const temFrom = tk.some(t => t.t === 'palavra' && String(t.v).toUpperCase() === 'FROM');
      if (!temFrom) {
        const nome = String(tk[1] ? tk[1].v : '').toUpperCase();
        if (nome === 'VERSION') return { ok: true, colunas: ['VERSION()'], linhas: [{ 'VERSION()': this.versao }] };
        if (nome === 'DATABASE' || nome === 'CURRENT_DATABASE') return { ok: true, colunas: ['DATABASE()'], linhas: [{ 'DATABASE()': this.atual }] };
        if (nome === 'NOW' || nome === 'CURRENT_TIMESTAMP') {
          const agora = new Date().toISOString().slice(0, 19).replace('T', ' ');
          return { ok: true, colunas: ['NOW()'], linhas: [{ 'NOW()': agora }] };
        }
        if (nome === 'USER' || nome === 'CURRENT_USER') return { ok: true, colunas: ['USER()'], linhas: [{ 'USER()': 'root@localhost' }] };
        return { ok: true, colunas: ['?'], linhas: [{ '?': tk[1] ? tk[1].v : '' }] };
      }

      const iFrom = tk.findIndex(t => t.t === 'palavra' && String(t.v).toUpperCase() === 'FROM');
      const selecao = tk.slice(1, iFrom);
      const nomeTab = String(tk[iFrom + 1].v);
      const t = this.tabela(nomeTab);
      if (!t) {
        if (!this.db()) return { erro: this.erroSemBanco() };
        return { erro: this.erroTabela(nomeTab) };
      }

      let i = iFrom + 2;
      let filtro = () => true;
      if (tk[i] && String(tk[i].v).toUpperCase() === 'WHERE') {
        const r = this._condicao(tk, i + 1, t);
        filtro = r.filtro; i = r.fim;
      }
      let linhas = t.linhas.filter(filtro);

      /* COUNT(*) e agregações simples */
      const primeiro = selecao.length ? String(selecao[0].v).toUpperCase() : '*';
      if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(primeiro) && selecao[1] && selecao[1].v === '(') {
        const arg = selecao[2] ? String(selecao[2].v) : '*';
        let rotulo = `${primeiro}(${arg})`;
        const apelido = selecao.findIndex(x => String(x.v).toUpperCase() === 'AS');
        if (apelido >= 0 && selecao[apelido + 1]) rotulo = String(selecao[apelido + 1].v);
        let valor;
        if (primeiro === 'COUNT') valor = arg === '*' ? linhas.length : linhas.filter(l => l[arg] !== null && l[arg] !== undefined).length;
        else {
          const nums = linhas.map(l => comoNumero(l[arg])).filter(n => n !== null);
          if (primeiro === 'SUM') valor = nums.reduce((a, b) => a + b, 0);
          else if (primeiro === 'AVG') valor = nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4) : null;
          else if (primeiro === 'MIN') valor = nums.length ? Math.min(...nums) : null;
          else valor = nums.length ? Math.max(...nums) : null;
        }
        return { ok: true, colunas: [rotulo], linhas: [{ [rotulo]: valor }] };
      }

      /* ORDER BY / LIMIT */
      if (tk[i] && String(tk[i].v).toUpperCase() === 'ORDER') {
        const campo = String(tk[i + 2].v);
        const dir = String(tk[i + 3] ? tk[i + 3].v : 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
        if (!t.colunas.some(c => c.nome === campo)) return { erro: this.erroColuna(campo, 'order clause') };
        linhas = linhas.slice().sort((a, b) => {
          const x = a[campo], y = b[campo];
          const nx = comoNumero(x), ny = comoNumero(y);
          if (nx !== null && ny !== null) return (nx - ny) * dir;
          return String(x).localeCompare(String(y)) * dir;
        });
        i += (String(tk[i + 3] ? tk[i + 3].v : '').toUpperCase() === 'DESC' || String(tk[i + 3] ? tk[i + 3].v : '').toUpperCase() === 'ASC') ? 4 : 3;
      }
      if (tk[i] && String(tk[i].v).toUpperCase() === 'LIMIT') {
        const n = Number(tk[i + 1].v);
        linhas = linhas.slice(0, n);
      }

      let colunas;
      if (primeiro === '*') colunas = t.colunas.map(c => c.nome);
      else {
        colunas = selecao.filter(x => x.v !== ',').map(x => String(x.v));
        for (const c of colunas) if (!t.colunas.some(x => x.nome === c)) return { erro: this.erroColuna(c) };
      }
      return { ok: true, colunas, linhas: linhas.map(l => { const o = {}; for (const c of colunas) o[c] = formatar(l[c]); return o; }) };
    }

    /* ----------------------------- UPDATE ----------------------------- */
    _update(tk) {
      const nome = String(tk[1].v);
      const t = this.tabela(nome);
      if (!t) return { erro: this.erroTabela(nome) };
      let i = 2;
      if (String(tk[i].v).toUpperCase() !== 'SET') return { erro: `ERROR 1064 (42000): You have an error in your SQL syntax` };
      i++;
      const atrib = [];
      while (i < tk.length && String(tk[i].v).toUpperCase() !== 'WHERE') {
        if (tk[i].v === ',') { i++; continue; }
        const campo = String(tk[i].v);
        if (!t.colunas.some(c => c.nome === campo)) return { erro: this.erroColuna(campo) };
        i += 2;
        let v = tk[i] ? tk[i].v : null;
        if (tk[i] && tk[i].v === '-') { i++; v = -tk[i].v; }
        if (tk[i] && tk[i].t === 'palavra' && String(v).toUpperCase() === 'NULL') v = null;
        atrib.push([campo, v]);
        i++;
      }
      let filtro = () => true;
      if (tk[i] && String(tk[i].v).toUpperCase() === 'WHERE') {
        try { filtro = this._condicao(tk, i + 1, t).filtro; }
        catch (e) { return { erro: e.sqlErro }; }
      }
      let n = 0;
      for (const l of t.linhas) {
        if (!filtro(l)) continue;
        for (const [c, v] of atrib) l[c] = v;
        n++;
      }
      return { ok: true, afetadas: n };
    }

    _delete(tk) {
      let i = 1;
      if (String(tk[1].v).toUpperCase() === 'FROM') i = 2;
      const nome = String(tk[i].v);
      const t = this.tabela(nome);
      if (!t) return { erro: this.erroTabela(nome) };
      i++;
      let filtro = () => true;
      if (tk[i] && String(tk[i].v).toUpperCase() === 'WHERE') {
        try { filtro = this._condicao(tk, i + 1, t).filtro; }
        catch (e) { return { erro: e.sqlErro }; }
      }
      const antes = t.linhas.length;
      const restam = t.linhas.filter(l => !filtro(l));
      t.linhas.length = 0;
      t.linhas.push(...restam);
      return { ok: true, afetadas: antes - t.linhas.length };
    }

    /* ------------------------- dump e restore ------------------------- */
    dump(nomeBanco, opts = {}) {
      const d = this.bancos.get(nomeBanco);
      if (!d) return null;
      const asp = (v) => v === null || v === undefined ? 'NULL'
        : (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "\\'")}'`);
      const L = [];
      L.push(`-- MariaDB dump 10.19  Distrib ${this.versao}, for debian-linux-gnu (x86_64)`);
      L.push('--');
      L.push(`-- Host: localhost    Database: ${nomeBanco}`);
      L.push('-- ------------------------------------------------------');
      L.push(`-- Server version\t${this.versao}`);
      L.push('');
      L.push('/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;');
      L.push('/*!40103 SET TIME_ZONE=\'+00:00\' */;');
      L.push('');
      for (const [nome, t] of d.tabelas) {
        L.push('--');
        L.push(`-- Table structure for table \`${nome}\``);
        L.push('--');
        L.push('');
        L.push(`DROP TABLE IF EXISTS \`${nome}\`;`);
        L.push(this.ddl(t) + ';');
        L.push('');
        L.push('--');
        L.push(`-- Dumping data for table \`${nome}\``);
        L.push('--');
        L.push('');
        if (t.linhas.length && !opts.semDados) {
          const cols = t.colunas.map(c => '`' + c.nome + '`').join(', ');
          const valores = t.linhas.map(l => '(' + t.colunas.map(c => asp(l[c.nome])).join(',') + ')').join(',');
          L.push(`INSERT INTO \`${nome}\` (${cols}) VALUES ${valores};`);
        }
        L.push('');
      }
      L.push('/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;');
      L.push('');
      L.push(`-- Dump completed on ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
      L.push('');
      return L.join('\n');
    }
  }

  LX.Banco = Banco;

  /* =====================================================================
     Formatação da saída dos clientes
     ===================================================================== */
  LX.tabelaMySQL = function (colunas, linhas) {
    if (!colunas.length) return '';
    const txt = (v) => (v === null || v === undefined) ? 'NULL' : String(v);
    const larg = colunas.map((c, i) => Math.max(c.length, ...linhas.map(l => txt(l[c]).length), 1));
    const risco = '+' + larg.map(w => '-'.repeat(w + 2)).join('+') + '+';
    const linha = (vals) => '| ' + vals.map((v, i) => v + ' '.repeat(larg[i] - v.length)).join(' | ') + ' |';
    const out = [risco, linha(colunas), risco];
    for (const l of linhas) out.push(linha(colunas.map(c => txt(l[c]))));
    out.push(risco);
    return out.join('\n');
  };

  LX.tabelaPsql = function (colunas, linhas) {
    const txt = (v) => (v === null || v === undefined) ? '' : String(v);
    const larg = colunas.map(c => Math.max(c.length, ...linhas.map(l => txt(l[c]).length), 1));
    const centro = (s, w) => {
      const e = Math.floor((w - s.length) / 2);
      return ' '.repeat(e) + s + ' '.repeat(w - s.length - e);
    };
    const out = [];
    out.push(' ' + colunas.map((c, i) => centro(c, larg[i])).join(' | '));
    out.push(larg.map(w => '-'.repeat(w + 2)).join('+'));
    for (const l of linhas) out.push(' ' + colunas.map((c, i) => txt(l[c]) + ' '.repeat(larg[i] - txt(l[c]).length)).join(' | '));
    out.push(`(${linhas.length} row${linhas.length === 1 ? '' : 's'})`);
    return out.join('\n');
  };
})();
