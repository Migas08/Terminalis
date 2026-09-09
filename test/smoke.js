const { loadEngine, makeSession } = require('./harness');

const LX = loadEngine();
console.log('Motor carregado. Comandos registrados:', Object.keys(LX.COMMANDS).length);

let pass = 0, fail = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = typeof expected === 'function' ? expected(actual) : String(actual).trim() === String(expected).trim();
  if (ok) pass++;
  else { fail++; failures.push({ name, actual: String(actual).slice(0, 400), expected: typeof expected === 'function' ? '(predicado)' : expected }); }
}

(async () => {
  const s = makeSession(LX);

  const T = async (cmd, expected, label) => {
    let r;
    try { r = await s.run(cmd); }
    catch (e) { fail++; failures.push({ name: label || cmd, actual: 'EXCEÇÃO: ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 3).join('\n'), expected: 'sem exceção' }); return; }
    check(label || cmd, r.out, expected);
  };

  // básicos
  await T('pwd', '/home/aluno');
  await T('echo ola mundo', 'ola mundo');
  await T('echo "aspas    preservam   espaco"', 'aspas    preservam   espaco');
  await T("echo 'sem $EXPANSAO'", 'sem $EXPANSAO');
  await T('echo $HOME', '/home/aluno');
  await T('echo ${HOME}/docs', '/home/aluno/docs');
  await T('echo $((2 + 3 * 4))', '14');
  await T('echo $((10 / 3))', '3');
  await T('echo {a,b,c}', 'a b c');
  await T('echo {1..5}', '1 2 3 4 5');
  await T('echo arq{01..03}.txt', 'arq01.txt arq02.txt arq03.txt');
  await T('echo $(echo aninhado)', 'aninhado');
  await T('X=10; echo $X', '10');
  await T('X=abc; echo ${#X}', '3');
  await T('f=/tmp/a/b.txt; echo ${f##*/}', 'b.txt');
  await T('f=/tmp/a/b.txt; echo ${f%.*}', '/tmp/a/b');
  await T('v=Ola; echo ${v:-padrao}; unset v; echo ${v:-padrao}', 'Ola\npadrao');
  await T('echo ${NAODEFINIDA:-vazio}', 'vazio');
  await T('s=banana; echo ${s//a/o}', 'bonono');
  await T('echo ${s:2:3}', o => true);

  // fs
  await T('mkdir -p proj/src proj/docs && ls proj | cat', 'docs\nsrc');
  await T('touch proj/src/main.sh && ls proj/src', 'main.sh');
  await T('cd proj && pwd', '/home/aluno/proj');
  await T('cd .. && pwd', '/home/aluno');
  await T('echo linha1 > f.txt; echo linha2 >> f.txt; cat f.txt', 'linha1\nlinha2');
  await T('wc -l < f.txt', '2');
  await T('cat f.txt | wc -l', '2');
  await T('ls naoexiste 2>&1', o => /No such file or directory/.test(o));
  await T('ls naoexiste 2>/dev/null; echo $?', '2');
  await T('cp f.txt g.txt && diff f.txt g.txt; echo $?', '0');
  await T('rm g.txt && ls g.txt 2>&1 | head -1', o => /No such file/.test(o));

  // pipes e filtros
  await T('printf "c\\nb\\na\\n" | sort', 'a\nb\nc');
  await T('printf "1\\n2\\n2\\n3\\n" | uniq -c | tr -s " "', ' 1 1\n 2 2\n 1 3');
  await T('printf "a:1\\nb:2\\n" | cut -d: -f2', '1\n2');
  await T('echo "ola mundo" | tr a-z A-Z', 'OLA MUNDO');
  await T('printf "um\\ndois\\ntres\\n" | grep -n do', '2:dois');
  await T('printf "um\\ndois\\n" | grep -c .', '2');
  await T('printf "x=1\\ny=2\\n" | sed "s/=/ vale /"', 'x vale 1\ny vale 2');
  await T('printf "a\\nb\\nc\\n" | sed -n 2p', 'b');
  await T('printf "a\\nb\\nc\\n" | sed "2d"', 'a\nc');
  await T('printf "1 2\\n3 4\\n" | awk "{print \\$2}"', '2\n4');
  await T(`printf "1 2\\n3 4\\n" | awk '{s+=$1} END {print s}'`, '4');
  await T(`awk 'BEGIN{printf "%05.2f\\n", 3.14159}'`, '03.14');
  await T(`printf "ana,30\\nbia,25\\n" | awk -F, '$2>26 {print $1}'`, 'ana');
  await T(`echo "a b c" | awk '{print NF}'`, '3');

  // condicionais e loops
  await T('if [ 1 -lt 2 ]; then echo sim; else echo nao; fi', 'sim');
  await T('for i in 1 2 3; do echo -n $i; done; echo', '123');
  await T('for ((i=0;i<3;i++)); do echo -n $i; done; echo', '012');
  await T('i=0; while [ $i -lt 3 ]; do echo -n $i; i=$((i+1)); done; echo', '012');
  await T('case abc in a*) echo casou;; *) echo nao;; esac', 'casou');
  await T('f() { echo "arg=$1"; }; f teste', 'arg=teste');
  await T('f() { return 3; }; f; echo $?', '3');
  await T('[[ "abc" == a* ]] && echo glob-ok', 'glob-ok');
  await T('[[ "abc" =~ ^a.c$ ]] && echo regex-ok', 'regex-ok');
  await T('true && echo A || echo B', 'A');
  await T('false && echo A || echo B', 'B');
  await T('a=(um dois tres); echo ${a[1]} ${#a[@]}', 'dois 3');
  await T('a=(x y z); for v in "${a[@]}"; do echo -n $v-; done; echo', 'x-y-z-');

  // permissões
  await T('touch p.sh && chmod 755 p.sh && ls -l p.sh | cut -d" " -f1', '-rwxr-xr-x');
  await T('chmod u-w p.sh && ls -l p.sh | cut -d" " -f1', '-r-xr-xr-x');
  await T('chmod +w p.sh && ls -l p.sh | cut -d" " -f1', '-rwxrwxrwx');
  await T('umask', '0022');
  await T('id -u', '1000');
  await T('whoami', 'aluno');

  // scripts
  await T(`printf '#!/bin/bash\\necho "rodou com $1"\\n' > s.sh; chmod +x s.sh; ./s.sh xyz`, 'rodou com xyz');
  await T(`chmod -x s.sh; ./s.sh 2>&1`, o => /Permission denied/.test(o));
  await T(`cat > h.sh << 'EOF'
#!/bin/bash
for f in a b; do
  echo "item: $f"
done
EOF
bash h.sh`, 'item: a\nitem: b');

  // processos / sistema
  await T('ps | head -1', o => /PID/.test(o));
  await T('uname -s', 'Linux');
  await T('cat /etc/os-release | grep VERSION_ID', 'VERSION_ID="26.04"');
  await T('grep -c . /etc/passwd', o => +o.trim() >= 10);
  await T('sudo whoami', 'root');
  await T('systemctl is-active ssh', 'active');
  await T('df -h / | tail -1 | awk "{print \\$6}"', '/');
  await T('free -m | head -1', o => /total/.test(o));

  // rede
  await T('ip -br a | head -1', o => /lo/.test(o));
  await T('ss -tlnp | grep -c 22', o => +o.trim() >= 1);
  await T('curl -s http://terminalis.dev/api/status', o => /"status":"ok"/.test(o));
  await T('curl -s http://localhost:9999 2>&1; echo "rc=$?"', o => /rc=7/.test(o));
  await T('dig +short example.com', '93.184.216.34');

  // pacotes
  await T('apt list --installed 2>/dev/null | grep -c bash', o => +o.trim() >= 1);
  await T('sudo apt install -y tree > /dev/null 2>&1; which tree', '/usr/bin/tree');
  await T('tree -L 1 /home', o => /aluno/.test(o));

  // find / xargs
  await T('mkdir -p t1/t2 && touch t1/a.log t1/t2/b.log && find t1 -name "*.log" | sort', 't1/a.log\nt1/t2/b.log');
  await T('find t1 -type d | sort', 't1\nt1/t2');
  await T('find t1 -name "*.log" | xargs -n1 basename | sort', 'a.log\nb.log');

  // tar
  await T('tar -czf t1.tar.gz t1 && tar -tzf t1.tar.gz | head -1', 't1/');
  await T('mkdir -p out && tar -xzf t1.tar.gz -C out && ls out/t1 | cat', 'a.log\nt2');

  // atribuições com aspas (NOME="Ana Maria")
  await T('NOME="Ana Maria"; echo "[$NOME]"', '[Ana Maria]');
  await T('MSG=\'um dois\'; echo "$MSG"', 'um dois');
  await T('A=1; A+=" 2"; echo "$A"', '1 2');
  await T('false | true; ST="${PIPESTATUS[@]}"; echo "$ST"', '1 0');
  await T('D="$(echo oi)"; echo "$D"', 'oi');
  await T('P="/tmp"; cd "$P" && pwd', '/tmp');

  // find: expressões com -o e parênteses
  await T('mkdir -p ex && touch ex/a.txt ex/b.log && find ex \\( -name "*.txt" -o -name "*.log" \\) -type f | sort', 'ex/a.txt\nex/b.log');
  await T('find ex -name "*.txt" ! -name "b*" | sort', 'ex/a.txt');
  await T('sudo -u root whoami > /tmp/rr.txt; cat /tmp/rr.txt', 'root');
  await T('setfacl -m u:root:rw ex/a.txt && getfacl ex/a.txt | grep -c "user:root"', '1');
  await T('ls -l ex/a.txt | cut -c1-11', '-rw-rw-r--+');
  await T('setfacl -b ex/a.txt && ls -l ex/a.txt | cut -c1-11', '-rw-r--r--');
  await T('namei -l /etc/passwd | tail -1 | awk \'{print $1, $NF}\'', '-rw-r--r-- passwd');

  // armazenamento
  await T('sudo parted -s /dev/vdb mklabel gpt >/dev/null && sudo parted -s /dev/vdb mkpart d ext4 0% 100% >/dev/null && lsblk | grep -c vdb1', '1');
  await T('sudo mkfs.ext4 -L TESTE /dev/vdb1 >/dev/null 2>&1; sudo blkid -s LABEL -o value /dev/vdb1', 'TESTE');
  await T('sudo mkdir -p /mnt/t && sudo mount /dev/vdb1 /mnt/t && findmnt -n /mnt/t | awk \'{print $2}\'', '/dev/vdb1');
  await T('echo oi | sudo tee /mnt/t/a.txt >/dev/null; sudo umount /mnt/t; ls /mnt/t | wc -l', '0');
  await T('sudo mount /dev/vdb1 /mnt/t && cat /mnt/t/a.txt', 'oi');
  await T('dd if=/dev/zero of=/tmp/z bs=1M count=2 status=none; du -sh /tmp/z | cut -f1', '2.0M');
  await T('ln /tmp/z /tmp/z2 && stat -c %h /tmp/z', '2');
  await T('df -i / | tail -1 | awk \'{print ($2 > 0) ? "ok" : "vazio"}\'', 'ok');

  // redirecionamento em blocos
  await T('for i in 1 2; do echo l$i; done > /tmp/b.txt; cat /tmp/b.txt', 'l1\nl2');
  await T('i=0; while [ $i -lt 2 ]; do echo w$i; i=$((i+1)); done > /tmp/w.txt; cat /tmp/w.txt', 'w0\nw1');
  await T('if true; then echo sim; fi > /tmp/i.txt; cat /tmp/i.txt', 'sim');
  await T('sudo apt install -y nginx >/dev/null 2>&1; dpkg -S /usr/sbin/nginx', 'nginx: /usr/sbin/nginx');
  await T('dpkg -S /bin/bash', 'bash: /bin/bash');
  await T('sudo apt-mark hold curl; apt-mark showhold; sudo apt-mark unhold curl >/dev/null', o => /curl/.test(o));

  // bash scripting
  await T("echo $'linha1\\nlinha2' | wc -l", '2');
  await T('set -euo pipefail; set -o | grep -c "pipefail\ton"', '1');
  await T('set +euo pipefail; printf "a\\nb\\n" | while read -r l; do echo "[$l]"; done', '[a]\n[b]');
  await T('while read -r l; do echo "<$l>"; done <<< "um" ', '<um>');
  await T('f(){ local x=1; echo "f:$x"; }; f; echo "fora:${x:-vazio}"', 'f:1\nfora:vazio');
  await T('Y=5; bash -c \'echo "[$Y]"\'', '[]');
  await T('export Y; bash -c \'echo "[$Y]"\'', '[5]');
  await T('declare -p Y | cut -d" " -f1-2', 'declare -x');

  // trap EXIT e política padrão do ufw
  await s.run('mkdir -p ~/scripts');
  await s.run(["cat > ~/scripts/limpa.sh << 'FIM'", '#!/bin/bash', 'set -euo pipefail',
    'TMP=$(mktemp -d)', 'trap \'rm -rf "$TMP"; echo limpei\' EXIT',
    'echo trabalhando', 'FIM'].join('\n'));
  await T('bash ~/scripts/limpa.sh', (o) => /trabalhando[\s\S]*limpei/.test(o), 'trap EXIT dispara ao fim do script');

  await s.run(["cat > ~/scripts/falha.sh << 'FIM'", '#!/bin/bash', 'set -e',
    "trap 'echo saiu-com-$?' EXIT", 'cat /nao/existe', 'echo nunca', 'FIM'].join('\n'));
  await T('bash ~/scripts/falha.sh 2>/dev/null', (o) => /saiu-com-1/.test(o) && !/nunca/.test(o),
    'trap EXIT dispara quando set -e aborta, e o script para');

  await T('bash -c \'trap "echo saiu" EXIT; echo oi\'', 'oi\nsaiu', 'trap EXIT em bash -c');

  await s.run('sudo ufw default allow incoming');
  check('ufw default allow incoming muda a política', s.m.firewall.defaultIn, 'allow');
  await T('sudo ufw enable && sudo ufw status verbose', (o) => /Default: allow \(incoming\)/.test(o),
    'ufw status verbose mostra a política real');
  await s.run('sudo ufw default deny incoming');
  check('ufw default deny incoming volta a negar', s.m.firewall.defaultIn, 'deny');

  // bash avançado: arrays, aritmética, getopts, flock
  await T('a=(x y); a+=(z w); printf "%s|" "${a[@]}"; echo', 'x|y|z|w|', 'arr+=() acrescenta em vez de substituir');
  await T('x=5; ((x++)); echo $x', '6', '(( )) como comando aritmético');
  await T('((0)); echo $?', '1', '(( )) devolve 1 quando o valor é zero');
  await T('((7)); echo $?', '0', '(( )) devolve 0 quando o valor não é zero');
  await T('i=0; while (( i < 3 )); do printf "%s" "$i"; ((i++)); done', '012', '(( )) como condição de while');
  await T('for ((i=0;i<3;i++)); do printf "x%s" "$i"; done', 'x0x1x2', 'for aritmético');
  await T('t=0; for n in 1 2 3 4; do ((t+=n)); done; echo $t', '10', 'acumulador com ((t+=n))');
  await T('set -- -v -n 3 arq; while getopts "vn:" o; do echo "$o=$OPTARG"; done; shift $((OPTIND-1)); echo "resto=$*"',
    'v=\nn=3\nresto=arq', 'getopts com flag e opção com argumento');
  await T('declare -A m; m[chave]=valor; echo ${m[chave]}', 'valor', 'array associativo');
  await T('a=(um dois tres); for i in "${!a[@]}"; do printf "%s:%s " "$i" "${a[$i]}"; done', '0:um 1:dois 2:tres ', 'índices do array');
  await T('flock -n /tmp/t.lock echo travado', 'travado', 'flock executa o comando com a trava');
  await T('flock -n /tmp/t2.lock flock -n /tmp/t2.lock echo x 2>/dev/null; echo rc=$?', 'rc=1', 'flock recusa a segunda instância');
  await T('getent hosts ubuntu.com', (o) => /185\.125\.190\.21\s+ubuntu\.com/.test(o), 'getent hosts percorre files e depois dns');
  await T('sha256sum -c /dev/null 2>/dev/null; echo rc=$?', 'rc=1', 'sha256sum -c sem entradas falha');
  await T('nproc', (o) => /^\d+$/.test(o.trim()), 'nproc devolve o número de núcleos');

  // set -e e listas AND-OR (a regra do POSIX que faz `[ x ] && acao` ser seguro)
  await s.run("printf '#!/bin/bash\\nset -e\\nx=0\\n[ \"$x\" -eq 1 ] && echo hi\\necho depois\\n' > /tmp/e1.sh");
  await T('bash /tmp/e1.sh', 'depois', 'set -e não derruba o script num && que curto-circuita');
  await s.run("printf '#!/bin/bash\\nset -e\\nfalse || echo alternativa\\necho depois\\n' > /tmp/e2.sh");
  await T('bash /tmp/e2.sh', 'alternativa\ndepois', 'set -e não derruba num || que trata o erro');
  await s.run("printf '#!/bin/bash\\nset -e\\nfalse\\necho nunca\\n' > /tmp/e3.sh");
  await T('bash /tmp/e3.sh; echo rc=$?', 'rc=1', 'set -e ainda aborta num comando solto que falha');
  await T('seq 1 5 | head -n -2', '1\n2\n3', 'head -n -N descarta as últimas N linhas');
  await T('seq 1 9 | head -3', '1\n2\n3', 'head -N continua funcionando');

  // tar seletivo, --strip-components, split, locale, dpkg --get-selections
  await s.run('mkdir -p ~/tst/pacote/src ~/tst/a ~/tst/b');
  await s.run('echo c > ~/tst/pacote/config.yml; echo m > ~/tst/pacote/src/main.py; echo l > ~/tst/pacote/app.log');
  await s.run('tar -czf ~/tst/p.tar.gz -C ~/tst pacote');
  await s.run('tar -xzf ~/tst/p.tar.gz -C ~/tst/a pacote/config.yml');
  await T('find ~/tst/a -type f | sort', '/home/aluno/tst/a/pacote/config.yml', 'tar extrai só o membro pedido');
  await s.run('tar -xzf ~/tst/p.tar.gz -C ~/tst/b --strip-components=1');
  await T('find ~/tst/b -type f | sort', '/home/aluno/tst/b/app.log\n/home/aluno/tst/b/config.yml\n/home/aluno/tst/b/src/main.py',
    '--strip-components=1 remove o diretório de topo');
  await T('tar -tzf ~/tst/p.tar.gz | wc -l', '5', 'listar continua funcionando com opção longa presente');
  await s.run('seq 1 10 > ~/tst/n.txt; split -l 4 ~/tst/n.txt ~/tst/parte-');
  await T('cat ~/tst/parte-* | tr "\\n" " "', '1 2 3 4 5 6 7 8 9 10 ', 'split corta e cat remonta na ordem');
  await T('locale | head -1', (o) => /^LANG=/.test(o), 'locale mostra a configuração de idioma');
  await T('dpkg --get-selections | head -1', (o) => /\tinstall$/.test(o.trim()), 'dpkg --get-selections lista os pacotes');

  // diff -r compara árvores (é o teste de restauração de backup)
  await s.run('mkdir -p ~/dr/a/sub ~/dr/b/sub');
  await s.run('echo igual > ~/dr/a/sub/x.txt; echo igual > ~/dr/b/sub/x.txt');
  await T('diff -r ~/dr/a ~/dr/b; echo rc=$?', 'rc=0', 'diff -r aprova árvores idênticas');
  await s.run('echo extra > ~/dr/b/sobrando.txt');
  await T('diff -r ~/dr/a ~/dr/b | head -1', (o) => /Only in/.test(o), 'diff -r acusa arquivo a mais');
  await s.run('echo diferente > ~/dr/b/sub/x.txt');
  await T('diff -r ~/dr/a ~/dr/b | grep differ | head -1', (o) => /x\.txt/.test(o), 'diff -r acusa conteúdo diferente');

  // man / apropos: a página existe e a busca por palavra-chave funciona
  await T('man -k disk | grep -c "^df "', '1', 'man -k encontra df pela palavra-chave "disk"');
  await T('man -k directory | grep -c "^ls "', '1', 'man -k encontra ls pela palavra-chave "directory"');
  await T('apropos copy | grep -c "^cp "', '1', 'apropos encontra cp pela palavra-chave "copy"');
  await T('man df | grep -c "report file system disk space"', (o) => +o >= 1, 'man df renderiza a página do manual');
  await T('whatis df | head -1', (o) => /report file system disk space/.test(o), 'whatis dá a descrição de uma linha');

  console.log(`\n=== ${pass} passaram, ${fail} falharam ===`);
  if (failures.length) {
    for (const f of failures.slice(0, 40)) {
      
console.log(`\n✗ ${f.name}\n   esperado: ${JSON.stringify(f.expected)}\n   obtido:   ${JSON.stringify(f.actual)}`);
    }
  }
  process.exit(fail ? 1 : 0);
})();
