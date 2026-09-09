/* =========================================================================
   TERMINALIS — páginas de manual (man / man -k / apropos / whatis)
   ---------------------------------------------------------------------
   O comando `man` (em 32-admin.js) lê LX.MAN_PAGES e LX.renderManPage
   daqui. Cada entrada tem uma descrição de uma linha (`short`, no estilo
   real do apropos, em inglês) para a busca por palavra-chave funcionar, e
   opcionalmente sinopse (`syn`) e um parágrafo (`desc`). Como este arquivo
   (34-*) é concatenado depois de 32-admin.js, o `man` já encontra os dados.
   ========================================================================= */
'use strict';
(function () {

  /* short = a linha NAME do manual real (mantida em inglês, como o apropos
     de verdade, para que `man -k disk`, `man -k copy` etc. encontrem). */
  const M = {
    /* ---------- navegação e arquivos ---------- */
    ls: { short: 'list directory contents', syn: 'ls [OPTION]... [FILE]...' },
    cd: { short: 'change the working directory', syn: 'cd [DIR]' },
    pwd: { short: 'print name of current/working directory', syn: 'pwd [OPTION]...' },
    cp: { short: 'copy files and directories', syn: 'cp [OPTION]... SOURCE... DEST' },
    mv: { short: 'move (rename) files', syn: 'mv [OPTION]... SOURCE... DEST' },
    rm: { short: 'remove files or directories', syn: 'rm [OPTION]... FILE...' },
    rmdir: { short: 'remove empty directories', syn: 'rmdir [OPTION]... DIRECTORY...' },
    mkdir: { short: 'make directories', syn: 'mkdir [OPTION]... DIRECTORY...' },
    touch: { short: 'change file timestamps, or create empty files', syn: 'touch [OPTION]... FILE...' },
    cat: { short: 'concatenate files and print on the standard output', syn: 'cat [OPTION]... [FILE]...' },
    tac: { short: 'concatenate and print files in reverse', syn: 'tac [OPTION]... [FILE]...' },
    less: { short: 'opposite of more; a pager to view file contents', syn: 'less [OPTION]... [FILE]...' },
    more: { short: 'file perusal filter for crt viewing (pager)', syn: 'more [OPTION]... [FILE]...' },
    head: { short: 'output the first part of files', syn: 'head [OPTION]... [FILE]...' },
    tail: { short: 'output the last part of files', syn: 'tail [OPTION]... [FILE]...' },
    stat: { short: 'display file or file system status', syn: 'stat [OPTION]... FILE...' },
    file: { short: 'determine file type', syn: 'file [OPTION]... FILE...' },
    ln: { short: 'make links between files', syn: 'ln [OPTION]... TARGET LINK_NAME' },
    tree: { short: 'list contents of directories in a tree-like format', syn: 'tree [OPTION]... [DIR]' },
    find: { short: 'search for files in a directory hierarchy', syn: 'find [PATH]... [EXPRESSION]' },
    locate: { short: 'find files by name (from an index)', syn: 'locate PATTERN...' },
    plocate: { short: 'find files by name, quickly (from an index)', syn: 'plocate PATTERN...' },
    updatedb: { short: 'update a database for locate', syn: 'updatedb [OPTION]...' },
    which: { short: 'locate a command in the PATH', syn: 'which COMMAND...' },
    whereis: { short: 'locate the binary, source, and manual page files for a command', syn: 'whereis COMMAND...' },
    readlink: { short: 'print resolved symbolic links or canonical file names', syn: 'readlink [OPTION]... FILE...' },
    realpath: { short: 'print the resolved absolute file name', syn: 'realpath [OPTION]... FILE...' },
    basename: { short: 'strip directory and suffix from filenames', syn: 'basename NAME [SUFFIX]' },
    dirname: { short: 'strip last component from file name', syn: 'dirname NAME...' },
    namei: { short: 'follow a pathname until a terminal point is found', syn: 'namei [OPTION]... PATHNAME...' },
    install: { short: 'copy files and set attributes', syn: 'install [OPTION]... SOURCE... DEST' },
    mktemp: { short: 'create a temporary file or directory', syn: 'mktemp [OPTION]... [TEMPLATE]' },
    rsync: { short: 'a fast, versatile, remote (and local) file-copying tool', syn: 'rsync [OPTION]... SRC... DEST' },

    /* ---------- texto e busca ---------- */
    grep: { short: 'print lines that match patterns', syn: 'grep [OPTION]... PATTERN [FILE]...' },
    egrep: { short: 'print lines that match extended regular expressions', syn: 'egrep [OPTION]... PATTERN [FILE]...' },
    fgrep: { short: 'print lines that match fixed strings', syn: 'fgrep [OPTION]... PATTERN [FILE]...' },
    sed: { short: 'stream editor for filtering and transforming text', syn: 'sed [OPTION]... SCRIPT [FILE]...' },
    awk: { short: 'pattern scanning and processing language', syn: 'awk [OPTION]... PROGRAM [FILE]...' },
    gawk: { short: 'pattern scanning and processing language', syn: 'gawk [OPTION]... PROGRAM [FILE]...' },
    cut: { short: 'remove sections from each line of files', syn: 'cut OPTION... [FILE]...' },
    sort: { short: 'sort lines of text files', syn: 'sort [OPTION]... [FILE]...' },
    uniq: { short: 'report or omit repeated lines', syn: 'uniq [OPTION]... [INPUT [OUTPUT]]' },
    wc: { short: 'print newline, word, and byte counts for each file', syn: 'wc [OPTION]... [FILE]...' },
    tr: { short: 'translate or delete characters', syn: 'tr [OPTION]... SET1 [SET2]' },
    nl: { short: 'number lines of files', syn: 'nl [OPTION]... [FILE]...' },
    rev: { short: 'reverse lines characterwise', syn: 'rev [FILE]...' },
    comm: { short: 'compare two sorted files line by line', syn: 'comm [OPTION]... FILE1 FILE2' },
    diff: { short: 'compare files line by line', syn: 'diff [OPTION]... FILES' },
    cmp: { short: 'compare two files byte by byte', syn: 'cmp [OPTION]... FILE1 [FILE2]' },
    paste: { short: 'merge lines of files', syn: 'paste [OPTION]... [FILE]...' },
    tee: { short: 'read from standard input and write to standard output and files', syn: 'tee [OPTION]... [FILE]...' },
    xargs: { short: 'build and execute command lines from standard input', syn: 'xargs [OPTION]... COMMAND' },
    fold: { short: 'wrap each input line to fit in specified width', syn: 'fold [OPTION]... [FILE]...' },
    expand: { short: 'convert tabs to spaces', syn: 'expand [OPTION]... [FILE]...' },
    seq: { short: 'print a sequence of numbers', syn: 'seq [OPTION]... LAST' },
    shuf: { short: 'generate random permutations', syn: 'shuf [OPTION]... [FILE]' },
    echo: { short: 'display a line of text', syn: 'echo [OPTION]... [STRING]...' },
    printf: { short: 'format and print data', syn: 'printf FORMAT [ARGUMENT]...' },
    md5sum: { short: 'compute and check MD5 message digest', syn: 'md5sum [OPTION]... [FILE]...' },
    sha1sum: { short: 'compute and check SHA1 message digest', syn: 'sha1sum [OPTION]... [FILE]...' },
    sha256sum: { short: 'compute and check SHA256 message digest', syn: 'sha256sum [OPTION]... [FILE]...' },

    /* ---------- disco e armazenamento ---------- */
    df: { short: 'report file system disk space usage', syn: 'df [OPTION]... [FILE]...' },
    du: { short: 'estimate file space usage', syn: 'du [OPTION]... [FILE]...' },
    mount: { short: 'mount a filesystem', syn: 'mount [OPTION]... DEVICE DIR' },
    umount: { short: 'unmount file systems', syn: 'umount [OPTION]... {DIR|DEVICE}' },
    lsblk: { short: 'list block devices', syn: 'lsblk [OPTION]... [DEVICE]...' },
    blkid: { short: 'locate/print block device attributes', syn: 'blkid [OPTION]... [DEVICE]...' },
    findmnt: { short: 'find a filesystem', syn: 'findmnt [OPTION]... [DEVICE|MOUNTPOINT]' },
    fdisk: { short: 'manipulate disk partition table', syn: 'fdisk [OPTION]... DEVICE' },
    parted: { short: 'a partition manipulation program', syn: 'parted [OPTION]... [DEVICE [COMMAND]]' },
    mkfs: { short: 'build a Linux filesystem', syn: 'mkfs [OPTION]... DEVICE' },
    'mkfs.ext4': { short: 'create an ext4 filesystem', syn: 'mkfs.ext4 [OPTION]... DEVICE' },
    dd: { short: 'convert and copy a file', syn: 'dd [OPERAND]...' },
    sync: { short: 'flush file system buffers to disk', syn: 'sync [OPTION]...' },
    truncate: { short: 'shrink or extend the size of a file', syn: 'truncate [OPTION]... FILE...' },

    /* ---------- permissões, usuários, contas ---------- */
    chmod: { short: 'change file mode bits (permissions)', syn: 'chmod [OPTION]... MODE FILE...' },
    chown: { short: 'change file owner and group', syn: 'chown [OPTION]... OWNER[:GROUP] FILE...' },
    chgrp: { short: 'change group ownership', syn: 'chgrp [OPTION]... GROUP FILE...' },
    umask: { short: 'set file mode creation mask', syn: 'umask [MODE]' },
    useradd: { short: 'create a new user or update default new user information', syn: 'useradd [OPTION]... LOGIN' },
    usermod: { short: 'modify a user account', syn: 'usermod [OPTION]... LOGIN' },
    userdel: { short: 'delete a user account and related files', syn: 'userdel [OPTION]... LOGIN' },
    groupadd: { short: 'create a new group', syn: 'groupadd [OPTION]... GROUP' },
    groupdel: { short: 'delete a group', syn: 'groupdel GROUP' },
    gpasswd: { short: 'administer /etc/group and /etc/gshadow', syn: 'gpasswd [OPTION]... GROUP' },
    passwd: { short: 'change user password', syn: 'passwd [OPTION]... [LOGIN]' },
    chage: { short: 'change user password expiry information', syn: 'chage [OPTION]... LOGIN' },
    id: { short: 'print real and effective user and group IDs', syn: 'id [OPTION]... [USER]' },
    groups: { short: 'print the groups a user is in', syn: 'groups [USER]...' },
    getent: { short: 'get entries from Name Service Switch libraries', syn: 'getent DATABASE [KEY]...' },
    su: { short: 'run a command with substitute user and group ID', syn: 'su [OPTION]... [USER]' },
    sudo: { short: 'execute a command as another user', syn: 'sudo [OPTION]... COMMAND' },
    visudo: { short: 'edit the sudoers file safely', syn: 'visudo [OPTION]...' },
    chsh: { short: 'change login shell', syn: 'chsh [OPTION]... [LOGIN]' },
    whoami: { short: 'print effective user name', syn: 'whoami' },
    who: { short: 'show who is logged on', syn: 'who [OPTION]...' },
    w: { short: 'show who is logged on and what they are doing', syn: 'w [OPTION]... [USER]' },
    last: { short: 'show a listing of last logged in users', syn: 'last [OPTION]... [NAME]...' },
    newgrp: { short: 'log in to a new group', syn: 'newgrp [GROUP]' },
    getfacl: { short: 'get file access control lists', syn: 'getfacl FILE...' },
    setfacl: { short: 'set file access control lists', syn: 'setfacl [OPTION]... FILE...' },

    /* ---------- processos e serviços ---------- */
    ps: { short: 'report a snapshot of the current processes', syn: 'ps [OPTION]...' },
    top: { short: 'display Linux processes', syn: 'top [OPTION]...' },
    htop: { short: 'interactive process viewer', syn: 'htop [OPTION]...' },
    kill: { short: 'send a signal to a process', syn: 'kill [OPTION]... PID...' },
    killall: { short: 'kill processes by name', syn: 'killall [OPTION]... NAME...' },
    pkill: { short: 'signal processes based on name and other attributes', syn: 'pkill [OPTION]... PATTERN' },
    pgrep: { short: 'look up processes based on name and other attributes', syn: 'pgrep [OPTION]... PATTERN' },
    pidof: { short: 'find the process ID of a running program', syn: 'pidof [OPTION]... PROGRAM...' },
    pstree: { short: 'display a tree of processes', syn: 'pstree [OPTION]... [PID|USER]' },
    nice: { short: 'run a program with modified scheduling priority', syn: 'nice [OPTION] [COMMAND]' },
    renice: { short: 'alter priority of running processes', syn: 'renice PRIORITY PID...' },
    nohup: { short: 'run a command immune to hangups', syn: 'nohup COMMAND [ARG]...' },
    sleep: { short: 'delay for a specified amount of time', syn: 'sleep NUMBER[SUFFIX]...' },
    timeout: { short: 'run a command with a time limit', syn: 'timeout DURATION COMMAND [ARG]...' },
    watch: { short: 'execute a program periodically, showing output fullscreen', syn: 'watch [OPTION]... COMMAND' },
    free: { short: 'display amount of free and used memory in the system', syn: 'free [OPTION]...' },
    uptime: { short: 'tell how long the system has been running', syn: 'uptime [OPTION]...' },
    vmstat: { short: 'report virtual memory statistics', syn: 'vmstat [OPTION]...' },
    lsof: { short: 'list open files', syn: 'lsof [OPTION]...' },
    fuser: { short: 'identify processes using files or sockets', syn: 'fuser [OPTION]... NAME...' },
    strace: { short: 'trace system calls and signals', syn: 'strace [OPTION]... COMMAND' },
    systemctl: { short: 'control the systemd system and service manager', syn: 'systemctl [OPTION]... COMMAND [UNIT]...' },
    journalctl: { short: 'query the systemd journal', syn: 'journalctl [OPTION]...' },
    'systemd-analyze': { short: 'analyze and debug system boot-up performance', syn: 'systemd-analyze [OPTION]... [COMMAND]' },
    crontab: { short: 'maintain crontab files for individual users', syn: 'crontab [OPTION]... [FILE]' },
    logrotate: { short: 'rotates, compresses, and mails system logs', syn: 'logrotate [OPTION]... CONFIG' },
    logger: { short: 'enter messages into the system log', syn: 'logger [OPTION]... [MESSAGE]' },
    dmesg: { short: 'print or control the kernel ring buffer', syn: 'dmesg [OPTION]...' },

    /* ---------- rede e SSH ---------- */
    ip: { short: 'show / manipulate routing, network devices, interfaces', syn: 'ip [OPTION]... OBJECT COMMAND' },
    ifconfig: { short: 'configure a network interface', syn: 'ifconfig [INTERFACE]' },
    ss: { short: 'another utility to investigate sockets', syn: 'ss [OPTION]...' },
    netstat: { short: 'print network connections, routing tables, statistics', syn: 'netstat [OPTION]...' },
    ping: { short: 'send ICMP ECHO_REQUEST to network hosts', syn: 'ping [OPTION]... HOST' },
    traceroute: { short: 'print the route packets trace to network host', syn: 'traceroute [OPTION]... HOST' },
    curl: { short: 'transfer data from or to a server', syn: 'curl [OPTION]... URL...' },
    wget: { short: 'the non-interactive network downloader', syn: 'wget [OPTION]... URL...' },
    ssh: { short: 'OpenSSH remote login client', syn: 'ssh [OPTION]... DESTINATION [COMMAND]' },
    scp: { short: 'secure copy (remote file copy program)', syn: 'scp [OPTION]... SOURCE... TARGET' },
    'ssh-keygen': { short: 'authentication key generation, management and conversion', syn: 'ssh-keygen [OPTION]...' },
    'ssh-copy-id': { short: 'install your public key in a remote machine\'s authorized_keys', syn: 'ssh-copy-id [OPTION]... [USER@]HOST' },
    dig: { short: 'DNS lookup utility', syn: 'dig [OPTION]... [NAME] [TYPE]' },
    nslookup: { short: 'query Internet name servers interactively', syn: 'nslookup [HOST]' },
    host: { short: 'DNS lookup utility', syn: 'host [OPTION]... NAME' },
    hostname: { short: 'show or set the system\'s host name', syn: 'hostname [NAME]' },
    ufw: { short: 'uncomplicated firewall', syn: 'ufw [OPTION]... COMMAND' },
    nc: { short: 'arbitrary TCP and UDP connections and listens', syn: 'nc [OPTION]... [HOST] [PORT]' },

    /* ---------- pacotes ---------- */
    apt: { short: 'command-line interface for the package manager', syn: 'apt [OPTION]... COMMAND' },
    'apt-get': { short: 'APT package handling utility', syn: 'apt-get [OPTION]... COMMAND' },
    'apt-cache': { short: 'query the APT package cache', syn: 'apt-cache [OPTION]... COMMAND' },
    dpkg: { short: 'package manager for Debian', syn: 'dpkg [OPTION]... ACTION' },
    apk: { short: 'Alpine Package Keeper - manage packages', syn: 'apk [OPTION]... COMMAND' },

    /* ---------- compactação e arquivos ---------- */
    tar: { short: 'an archiving utility', syn: 'tar [OPTION]... [FILE]...' },
    gzip: { short: 'compress or expand files', syn: 'gzip [OPTION]... [FILE]...' },
    gunzip: { short: 'compress or expand files', syn: 'gunzip [OPTION]... [FILE]...' },
    zip: { short: 'package and compress (archive) files', syn: 'zip [OPTION]... ARCHIVE FILE...' },
    unzip: { short: 'list, test and extract compressed files in a ZIP archive', syn: 'unzip [OPTION]... ARCHIVE' },
    xz: { short: 'compress or decompress .xz and .lzma files', syn: 'xz [OPTION]... [FILE]...' },
    bzip2: { short: 'a block-sorting file compressor', syn: 'bzip2 [OPTION]... [FILE]...' },
    zstd: { short: 'fast lossless compression algorithm', syn: 'zstd [OPTION]... [FILE]...' },

    /* ---------- sistema e ambiente ---------- */
    man: { short: 'an interface to the system reference manuals', syn: 'man [OPTION]... [COMMAND]' },
    apropos: { short: 'search the manual page names and descriptions', syn: 'apropos KEYWORD...' },
    whatis: { short: 'display one-line manual page descriptions', syn: 'whatis COMMAND...' },
    uname: { short: 'print system information', syn: 'uname [OPTION]...' },
    hostnamectl: { short: 'control the system hostname', syn: 'hostnamectl [OPTION]... COMMAND' },
    timedatectl: { short: 'control the system time and date', syn: 'timedatectl [OPTION]... COMMAND' },
    date: { short: 'print or set the system date and time', syn: 'date [OPTION]... [+FORMAT]' },
    env: { short: 'run a program in a modified environment', syn: 'env [OPTION]... [NAME=VALUE]... [COMMAND]' },
    printenv: { short: 'print all or part of environment', syn: 'printenv [OPTION]... [VARIABLE]...' },
    export: { short: 'set export attribute for shell variables', syn: 'export [NAME[=VALUE]]...' },
    history: { short: 'display or manipulate the history list', syn: 'history [OPTION]...' },
    clear: { short: 'clear the terminal screen', syn: 'clear' },
    reset: { short: 'reinitialize the terminal', syn: 'reset' },
    help: { short: 'display help for shell builtin commands', syn: 'help [TOPIC]' },
    bash: { short: 'GNU Bourne-Again SHell', syn: 'bash [OPTION]... [FILE]' },
    sh: { short: 'command interpreter (shell)', syn: 'sh [OPTION]... [FILE]' },
    nano: { short: 'Nano\'s ANOther editor, a small and friendly text editor', syn: 'nano [OPTION]... [FILE]...' },
    vim: { short: 'Vi IMproved, a programmer\'s text editor', syn: 'vim [OPTION]... [FILE]...' },
    vi: { short: 'a screen-oriented text editor', syn: 'vi [OPTION]... [FILE]...' },
    editor: { short: 'the default text editor', syn: 'editor [FILE]...' },
    lscpu: { short: 'display information about the CPU architecture', syn: 'lscpu [OPTION]...' },
    nproc: { short: 'print the number of processing units available', syn: 'nproc [OPTION]...' },
    locale: { short: 'get locale-specific information', syn: 'locale [OPTION]...' },
    true: { short: 'do nothing, successfully', syn: 'true' },
    false: { short: 'do nothing, unsuccessfully', syn: 'false' },
    yes: { short: 'output a string repeatedly until killed', syn: 'yes [STRING]...' },

    /* ---------- containers e banco ---------- */
    docker: { short: 'the Docker container platform command line', syn: 'docker [OPTION]... COMMAND' },
    mariadb: { short: 'the MariaDB command-line client', syn: 'mariadb [OPTION]... [DATABASE]' },
    'mariadb-dump': { short: 'a database backup program', syn: 'mariadb-dump [OPTION]... DATABASE' },
    psql: { short: 'the PostgreSQL interactive terminal', syn: 'psql [OPTION]... [DATABASE]' },
    'redis-cli': { short: 'the Redis command line interface', syn: 'redis-cli [OPTION]... [COMMAND]' }
  };

  /* aliases: mesma página que outro comando */
  const ALIAS = {
    'apt-mark': 'apt', gawk: 'awk', mawk: 'awk', vim: 'vim', vi: 'vi',
    egrep: 'egrep', fgrep: 'fgrep', gunzip: 'gzip', zcat: 'gzip', bunzip2: 'bzip2',
    unxz: 'xz', 'mysql': 'mariadb', 'mysqldump': 'mariadb-dump', pico: 'nano',
    'mkfs.ext2': 'mkfs.ext4', 'mkfs.ext3': 'mkfs.ext4', 'mkfs.xfs': 'mkfs.ext4',
    netcat: 'nc', pgrep: 'pgrep'
  };
  for (const a in ALIAS) { if (!M[a] && M[ALIAS[a]]) M[a] = M[ALIAS[a]]; }

  LX.MAN_PAGES = M;

  /* Renderiza uma página de manual no formato clássico. */
  LX.renderManPage = function (nome, page) {
    const short = page.short || 'manual page';
    const syn = page.syn || (nome + ' [OPTION]...');
    const desc = page.desc || ('O comando <strong>' + nome + '</strong> — ' + short + '.').replace(/<[^>]+>/g, '');
    const cab = nome.toUpperCase() + '(1)';
    const larg = 78;
    const linhaCab = cab + ' '.repeat(Math.max(1, (larg - cab.length * 2) / 2 | 0)) + 'User Commands'
      + ' '.repeat(Math.max(1, larg - cab.length * 2 - 13 - Math.max(1, (larg - cab.length * 2) / 2 | 0))) + cab;
    const ind = '       ';
    return [
      linhaCab,
      '',
      'NAME',
      ind + nome + ' - ' + short,
      '',
      'SYNOPSIS',
      ind + syn,
      '',
      'DESCRIPTION',
      ind + desc,
      '',
      ind + 'Esta é uma página de manual resumida da plataforma Terminalis. Para a',
      ind + 'lista completa de opções deste comando, experimente `' + nome + ' --help`.',
      '',
      'SEE ALSO',
      ind + 'man(1), apropos(1), info(1)',
      '',
      cab.replace(/\(1\)$/, '') + '                         Terminalis                         ' + cab,
      ''
    ].join('\n');
  };

  /* whatis: descrição de uma linha (usa as mesmas páginas). */
  if (LX.defcmd) {
    LX.defcmd({
      name: 'whatis', pkg: 'man-db', run: async ({ io, args }) => {
        if (!args.length) { io.stderr.write('whatis what?\n'); return 1; }
        let falhou = 0;
        for (const a of args) {
          const p = LX.MAN_PAGES[a];
          if (p) io.stdout.write(`${a} (1)${' '.repeat(Math.max(1, 15 - a.length))}- ${p.short}\n`);
          else { io.stdout.write(`${a}: nothing appropriate.\n`); falhou = 1; }
        }
        return falhou;
      }
    });
  }
})();
