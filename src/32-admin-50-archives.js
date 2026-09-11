/* =========================================================================
   TERMINALIS — arquivos compactados
   ========================================================================= */
'use strict';
(function () {
  const { FileSystem, defcmd, getopt } = LX;
  function P(sh, p) { return FileSystem.normalize(p, sh.cwd); }

  /* ============================== arquivos compactados ============================== */
  const TAR_MAGIC = 'TARDATA\n';
  const GZ_MAGIC = 'GZIPDATA\n';
  const ZIP_MAGIC = 'ZIPDATA\n';
  function packTree(sh, paths, base) {
    const entries = {};
    for (const p of paths) {
      const abs = P(sh, p);
      sh.m.fs.walk(abs, (path, node) => {
        const rel = p.replace(/^\.\//, '').replace(/\/$/, '') + (path === abs ? '' : path.slice(abs.length));
        entries[rel] = { type: node.type, mode: node.mode, uid: node.uid, gid: node.gid, mtime: node.mtime, content: node.type === 'file' ? node.read() : (node.type === 'link' ? node.target : '') };
      }, sh.fsopts());
    }
    return entries;
  }
  function unpackTree(sh, entries, dest, io, verbose) {
    const names = Object.keys(entries).sort();
    for (const rel of names) {
      const e = entries[rel];
      const target = FileSystem.join(P(sh, dest), rel);
      try {
        if (e.type === 'dir') sh.m.fs.mkdirp(target, sh.fsopts());
        else if (e.type === 'link') { try { sh.m.fs.unlink(target, sh.fsopts()); } catch (x) { } sh.m.fs.symlink(e.content, target, sh.fsopts()); }
        else { sh.m.fs.mkdirp(FileSystem.dirname(target), sh.fsopts()); const n = sh.m.fs.create(target, e.content, sh.fsopts()); n.mode = e.mode; n.mtime = e.mtime || Date.now(); }
        if (verbose) io.stdout.write(rel + (e.type === 'dir' ? '/' : '') + '\n');
      } catch (err) { io.stderr.write(`tar: ${rel}: Cannot open: ${err.message}\n`); }
    }
  }
  LX.packTree = packTree;

  defcmd({
    name: 'tar', pkg: 'tar', run: async ({ sh, io, args }) => {
      /* Só os agrupamentos curtos entram no flagStr. Opções longas ficam de
         fora: `--strip-components` contém "c" e "t" e faria o tar achar que
         é para criar e listar ao mesmo tempo. */
      const flagStr = args.filter(a => /^-[cxtzjvfJaCk]+$/.test(a) || (args.indexOf(a) === 0 && /^[cxtzjvfJa]+$/.test(a))).join('');
      const has = (c) => flagStr.includes(c) || args.some(a => a === '--' + ({ c: 'create', x: 'extract', t: 'list', z: 'gzip', v: 'verbose' }[c] || '###'));
      const { opts, rest } = getopt(args, { f: 1, C: 1, '--file': 1, '--directory': 1, '--exclude': 1 });
      const file = opts.f || opts['--file'];
      const positional = rest.filter(r => !/^[-]?[cxtzjvfJa]+$/.test(r) || r.includes('.') || r.includes('/'));
      const files = positional.filter(p => p !== file);
      const create = has('c'), extract = has('x'), list = has('t'), verbose = has('v');
      const bz = has('j') || args.includes('--bzip2') || (file && /\.(tbz2?|tar\.bz2)$/.test(file));
      const xz = flagStr.includes('J') || args.includes('--xz') || (file && /\.(txz|tar\.xz)$/.test(file));
      const zst = args.includes('--zstd') || (file && /\.tar\.zst$/.test(file));
      const gz = has('z') || (file && /\.(tgz|tar\.gz)$/.test(file));
      const comprimido = gz || bz || xz || zst;
      const excluir = [].concat(opts['--exclude'] || []).filter(Boolean)
        .concat(args.filter(a => a.startsWith('--exclude=')).map(a => a.slice(10)));
      if (!create && !extract && !list) {
        io.stderr.write("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information.\n");
        return 2;
      }
      if (!file) { io.stderr.write('tar: Refusing to read archive contents from terminal (missing -f option?)\ntar: Error is not recoverable: exiting now\n'); return 2; }
      const dest = opts.C || opts['--directory'] || '.';
      if (create) {
        if (!files.length) { io.stderr.write('tar: Cowardly refusing to create an empty archive\nTry \'tar --help\' for more information.\n'); return 2; }
        const arquivoDestino = P(sh, file);            // resolve antes de mudar de diretório
        let entries;
        const cwdAntes = sh.cwd;
        try {
          if (dest && dest !== '.') {
            const alvo = P(sh, dest);
            const st = sh.m.fs.stat(alvo, sh.fsopts());
            if (st.type !== 'dir') throw new Error(`${dest}: Not a directory`);
            sh.cwd = alvo;
          }
          entries = packTree(sh, files, '.');
        } catch (e) { sh.cwd = cwdAntes; io.stderr.write(`tar: ${e.message}\n`); return 2; }
        sh.cwd = cwdAntes;
        if (excluir.length) {
          for (const k of Object.keys(entries)) {
            const base = k.replace(/^.*\//, '');
            if (excluir.some(pat => LX.matchGlob(base, pat) || LX.matchGlob(k, pat))) delete entries[k];
          }
        }
        if (verbose) Object.keys(entries).sort().forEach(k => io.stdout.write(k + (entries[k].type === 'dir' ? '/' : '') + '\n'));
        let payload = TAR_MAGIC + JSON.stringify(entries);
        if (comprimido) payload = GZ_MAGIC + payload;
        const taxaTar = zst ? 0.30 : xz ? 0.22 : bz ? 0.28 : 0.36;
        sh.m.fs.writeFile(arquivoDestino, payload, sh.fsopts());
        return 0;
      }
      let data;
      try { data = sh.m.fs.readFile(P(sh, file), sh.fsopts()); }
      catch (e) { io.stderr.write(`tar: ${file}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now\n`); return 2; }
      if (data.startsWith(GZ_MAGIC)) data = data.slice(GZ_MAGIC.length);
      else if (comprimido) { io.stderr.write('\ngzip: stdin: not in gzip format\ntar: Child returned status 1\ntar: Error is not recoverable: exiting now\n'); return 2; }
      if (!data.startsWith(TAR_MAGIC)) { io.stderr.write(`tar: This does not look like a tar archive\ntar: Exiting with failure status due to previous errors\n`); return 2; }
      let entries;
      try { entries = JSON.parse(data.slice(TAR_MAGIC.length)); } catch (e) { io.stderr.write('tar: arquivo corrompido\n'); return 2; }
      if (list) { Object.keys(entries).sort().forEach(k => io.stdout.write(k + (entries[k].type === 'dir' ? '/' : '') + '\n')); return 0; }

      /* Extração seletiva: `tar -xzf a.tgz caminho/dentro` traz só aquilo
         (e o que estiver abaixo dele). Com --wildcards, o membro pode ser
         um padrão. Sem membros, extrai o arquivo inteiro. */
      const membros = files.filter(f => f !== file);
      const curinga = args.includes('--wildcards');
      let selecionadas = entries;
      if (membros.length) {
        selecionadas = {};
        for (const k of Object.keys(entries)) {
          const casa = membros.some(mm => {
            const alvo = mm.replace(/\/+$/, '');
            if (curinga || /[*?\[]/.test(alvo)) return LX.matchGlob(k, alvo) || LX.matchGlob(k, alvo + '/*');
            return k === alvo || k.startsWith(alvo + '/');
          });
          if (casa) selecionadas[k] = entries[k];
        }
        if (!Object.keys(selecionadas).length) {
          for (const mm of membros) io.stderr.write(`tar: ${mm}: Not found in archive\n`);
          io.stderr.write('tar: Exiting with failure status due to previous errors\n');
          return 2;
        }
      }

      /* --strip-components=N remove os N primeiros níveis de cada caminho —
         é o que tira o diretório de versão dos tarballs de release. */
      const stripArg = args.find(a => /^--strip-components(=|$)/.test(a));
      let strip = 0;
      if (stripArg) {
        strip = stripArg.includes('=') ? +stripArg.split('=')[1] : +(args[args.indexOf(stripArg) + 1] || 0);
        if (!isFinite(strip) || strip < 0) strip = 0;
      }
      if (strip > 0) {
        const cortadas = {};
        for (const k of Object.keys(selecionadas)) {
          const partes = k.split('/').filter(Boolean);
          if (partes.length <= strip) continue;          // some junto com o nível removido
          cortadas[partes.slice(strip).join('/')] = selecionadas[k];
        }
        selecionadas = cortadas;
      }

      unpackTree(sh, selecionadas, dest, io, verbose);
      return 0;
    }
  });

  /* bzip2 / xz / zstd: mesma mecânica do gzip, extensões diferentes */
  for (const fam of [
    { nomes: ['bzip2', 'bunzip2', 'bzcat'], ext: '.bz2', pkg: 'bzip2', taxa: 0.28 },
    { nomes: ['xz', 'unxz', 'xzcat'], ext: '.xz', pkg: 'xz-utils', taxa: 0.22 },
    { nomes: ['zstd', 'unzstd', 'zstdcat'], ext: '.zst', pkg: 'zstd', taxa: 0.30 }
  ]) {
    defcmd({
      name: fam.nomes, path: '/usr/bin/', pkg: fam.pkg,
      run: async ({ sh, io, args, name }) => {
        const { opts, rest } = getopt(args, { d: 0, k: 0, c: 0, f: 0, v: 0, '9': 0, '1': 0, '--version': 0, '--decompress': 0, '--keep': 0, '--stdout': 0 });
        if (opts['--version']) { io.stdout.write(`${fam.nomes[0]} (Terminalis) 1.9\n`); return 0; }
        const descomprimir = name === fam.nomes[1] || name === fam.nomes[2] || opts.d || opts['--decompress'];
        const paraStdout = name === fam.nomes[2] || opts.c || opts['--stdout'];
        const manter = opts.k || opts['--keep'] || paraStdout;
        let status = 0;
        for (const f of rest) {
          const caminho = P(sh, f);
          try {
            const conteudo = sh.m.fs.readFile(caminho, sh.fsopts());
            if (descomprimir) {
              if (!f.endsWith(fam.ext)) { io.stderr.write(`${name}: ${f}: Unknown suffix -- ignored\n`); status = 1; continue; }
              const dados = conteudo.startsWith(GZ_MAGIC) ? conteudo.slice(GZ_MAGIC.length) : conteudo;
              if (paraStdout) { io.stdout.write(dados); continue; }
              sh.m.fs.writeFile(caminho.slice(0, -fam.ext.length), dados, sh.fsopts());
              if (!manter) sh.m.fs.unlink(caminho, sh.fsopts());
            } else {
              if (f.endsWith(fam.ext)) { io.stderr.write(`${name}: ${f} already has ${fam.ext} suffix -- unchanged\n`); status = 1; continue; }
              const dados = GZ_MAGIC + conteudo;
              if (paraStdout) { io.stdout.write(dados); continue; }
              const n = sh.m.fs.writeFile(caminho + fam.ext, dados, sh.fsopts());
              n.compressedFrom = conteudo.length;
              n.tamanhoComprimido = Math.max(20, Math.round(conteudo.length * fam.taxa));
              if (opts.v) io.stderr.write(`  ${f}: ${(100 - fam.taxa * 100).toFixed(1)}% -- replaced with ${f}${fam.ext}\n`);
              if (!manter) sh.m.fs.unlink(caminho, sh.fsopts());
            }
          } catch (e) { io.stderr.write(`${name}: ${f}: ${e.message}\n`); status = 1; }
        }
        return status;
      }
    });
  }

  defcmd({
    name: ['gzip', 'gunzip', 'zcat'], path: '/usr/bin/', pkg: 'gzip',
    run: async ({ sh, io, args, name }) => {
      const { opts, rest } = getopt(args, { d: 0, k: 0, c: 0, r: 0, '9': 0, '1': 0, l: 0, f: 0, '--decompress': 0, '--keep': 0, '--stdout': 0 });
      const decompress = name === 'gunzip' || name === 'zcat' || opts.d || opts['--decompress'];
      const toStdout = name === 'zcat' || opts.c || opts['--stdout'];
      let status = 0;
      for (const f of rest) {
        const path = P(sh, f);
        try {
          const data = sh.m.fs.readFile(path, sh.fsopts());
          if (decompress) {
            if (!data.startsWith(GZ_MAGIC)) { io.stderr.write(`\ngzip: ${f}: not in gzip format\n`); status = 1; continue; }
            const out = data.slice(GZ_MAGIC.length);
            if (toStdout) { io.stdout.write(out); continue; }
            const newPath = path.replace(/\.gz$/, '');
            sh.m.fs.writeFile(newPath, out, sh.fsopts());
            if (!opts.k && !opts['--keep']) sh.m.fs.unlink(path, sh.fsopts());
          } else {
            if (data.startsWith(GZ_MAGIC)) { io.stderr.write(`gzip: ${f} already has .gz suffix -- unchanged\n`); status = 1; continue; }
            const out = GZ_MAGIC + data;
            if (toStdout) { io.stdout.write(out); continue; }
            const nz = sh.m.fs.writeFile(path + '.gz', out, sh.fsopts());
            nz.compressedFrom = data.length;
            nz.tamanhoComprimido = Math.max(20, Math.round(data.length * 0.36));
            if (!opts.k && !opts['--keep']) sh.m.fs.unlink(path, sh.fsopts());
          }
        } catch (e) { io.stderr.write(`gzip: ${f}: ${e.message}\n`); status = 1; }
      }
      if (!rest.length) { const d = io.stdin.readAll(); io.stdout.write(decompress ? d.replace(GZ_MAGIC, '') : GZ_MAGIC + d); }
      return status;
    }
  });

  defcmd({
    name: 'zip', pkg: 'zip', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { r: 0, q: 0, '9': 0, e: 0 });
      const archive = rest[0];
      const files = rest.slice(1);
      if (!archive || !files.length) { io.stderr.write('zip error: Nothing to do! (try: zip -r arquivo.zip . -i *)\n'); return 12; }
      const entries = packTree(sh, files, '.');
      sh.m.fs.writeFile(P(sh, archive.endsWith('.zip') ? archive : archive + '.zip'), ZIP_MAGIC + JSON.stringify(entries), sh.fsopts());
      if (!opts.q) Object.keys(entries).sort().forEach(k => io.stdout.write(`  adding: ${k}${entries[k].type === 'dir' ? '/' : ''} (stored 0%)\n`));
      return 0;
    }
  });
  defcmd({
    name: 'unzip', pkg: 'unzip', run: async ({ sh, io, args }) => {
      const { opts, rest } = getopt(args, { l: 0, d: 1, q: 0, o: 0 });
      const archive = rest[0];
      if (!archive) { io.stderr.write('UnZip 6.00 -- usage: unzip file[.zip] [-d exdir]\n'); return 10; }
      let data;
      try { data = sh.m.fs.readFile(P(sh, archive), sh.fsopts()); }
      catch (e) { io.stderr.write(`unzip:  cannot find or open ${archive}, ${archive}.zip or ${archive}.ZIP.\n`); return 9; }
      if (!data.startsWith(ZIP_MAGIC)) { io.stderr.write(`Archive:  ${archive}\n  End-of-central-directory signature not found.\n`); return 9; }
      const entries = JSON.parse(data.slice(ZIP_MAGIC.length));
      io.stdout.write(`Archive:  ${archive}\n`);
      if (opts.l) {
        io.stdout.write('  Length      Date    Time    Name\n---------  ---------- -----   ----\n');
        let total = 0;
        for (const k of Object.keys(entries).sort()) { total += entries[k].content.length; io.stdout.write(`${String(entries[k].content.length).padStart(9)}  2026-09-01 12:00   ${k}\n`); }
        io.stdout.write(`---------                     -------\n${String(total).padStart(9)}                     ${Object.keys(entries).length} files\n`);
        return 0;
      }
      unpackTree(sh, entries, opts.d || '.', io, false);
      for (const k of Object.keys(entries).sort()) io.stdout.write(`  inflating: ${k}${entries[k].type === 'dir' ? '/' : ''}\n`);
      return 0;
    }
  });

})();
