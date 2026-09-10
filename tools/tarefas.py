#!/usr/bin/env python3
"""Manipula os objetos de tarefa dentro dos arquivos de conteúdo.

  python3 tools/tarefas.py listar <arquivo.js>
  python3 tools/tarefas.py remover <arquivo.js> <id> [<id> ...]
  python3 tools/tarefas.py inserir <arquivo.js> <id-de-referencia> antes|depois < corpo.js

O corpo lido do stdin é inserido como um item novo da lista `tasks`.
"""
import os
import re
import sys

def acha_tarefa(src, tid):
    """Devolve (inicio, fim) do objeto { id: 'tid', ... } incluindo a vírgula."""
    m = re.search(r"id:\s*'" + re.escape(tid) + r"'", src)
    if not m:
        return None
    # volta até a chave de abertura do objeto
    i = m.start()
    while i > 0 and src[i] != '{':
        i -= 1
    if src[i] != '{':
        return None
    # avança equilibrando chaves, respeitando strings e comentários
    j = i
    prof = 0
    aspas = None
    while j < len(src):
        c = src[j]
        if aspas:
            if c == '\\':
                j += 2
                continue
            if c == aspas:
                aspas = None
            j += 1
            continue
        if c in "'\"`":
            aspas = c
            j += 1
            continue
        if c == '/' and j + 1 < len(src) and src[j + 1] == '*':
            k = src.find('*/', j + 2)
            j = (k + 2) if k >= 0 else len(src)
            continue
        if c == '/' and j + 1 < len(src) and src[j + 1] == '/':
            k = src.find('\n', j)
            j = (k + 1) if k >= 0 else len(src)
            continue
        if c == '{':
            prof += 1
        elif c == '}':
            prof -= 1
            if prof == 0:
                j += 1
                break
        j += 1
    # engole a vírgula e o espaço em branco seguintes
    k = j
    while k < len(src) and src[k] in ' \t':
        k += 1
    if k < len(src) and src[k] == ',':
        k += 1
        while k < len(src) and src[k] in ' \t':
            k += 1
        if k < len(src) and src[k] == '\n':
            k += 1
    # e a indentação antes do objeto
    p = i
    while p > 0 and src[p - 1] in ' \t':
        p -= 1
    return (p, k)

def listar(arq):
    src = open(arq, encoding='utf-8').read()
    for m in re.finditer(r"id:\s*'([^']+)',\s*kind:\s*'([^']+)'", src):
        linha = src[:m.start()].count('\n') + 1
        print(f"{linha:6d}  {m.group(2):9s} {m.group(1)}")

def remover(arq, ids):
    import subprocess
    import tempfile
    src = open(arq, encoding='utf-8').read()
    for tid in ids:
        r = acha_tarefa(src, tid)
        if not r:
            print(f"  ! não achei {tid} em {arq}", file=sys.stderr)
            continue
        trecho = src[r[0]:r[1]].strip().rstrip(',').strip()
        if not (trecho.startswith('{') and trecho.endswith('}')):
            print(f"  ! recorte suspeito em {tid}: não é um objeto isolado", file=sys.stderr)
            sys.exit(1)
        novo = src[:r[0]] + src[r[1]:]
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
            f.write(novo); temp = f.name
        ok = subprocess.run(['node', '--check', temp], capture_output=True)
        os.unlink(temp)
        if ok.returncode != 0:
            print(f"  ! remover {tid} quebraria {arq}:\n{ok.stderr.decode()[:300]}", file=sys.stderr)
            sys.exit(1)
        src = novo
        print(f"  - removida {tid}")
    open(arq, 'w', encoding='utf-8').write(src)

def inserir(arq, ref, onde, corpo):
    src = open(arq, encoding='utf-8').read()
    r = acha_tarefa(src, ref)
    if not r:
        print(f"  ! não achei {ref} em {arq}", file=sys.stderr)
        sys.exit(1)
    corpo = corpo.rstrip()
    if not corpo.endswith(','):
        corpo += ','
    corpo += '\n'
    pos = r[0] if onde == 'antes' else r[1]
    # se inserimos DEPOIS de uma tarefa que era a última (sem vírgula final),
    # é preciso separar os dois objetos com vírgula
    if onde != 'antes':
        antes = src[:pos].rstrip()
        if antes.endswith('}'):
            src = antes + ',\n      ' + corpo + src[pos:]
            open(arq, 'w', encoding='utf-8').write(src)
            print(f"  + inserida {onde} de {ref}")
            return
    src = src[:pos] + corpo + src[pos:]
    open(arq, 'w', encoding='utf-8').write(src)
    print(f"  + inserida {onde} de {ref}")

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'listar':
        listar(sys.argv[2])
    elif cmd == 'remover':
        remover(sys.argv[2], sys.argv[3:])
    elif cmd == 'inserir':
        inserir(sys.argv[2], sys.argv[3], sys.argv[4], sys.stdin.read())
    else:
        print(__doc__)
        sys.exit(2)
