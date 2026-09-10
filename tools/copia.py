#!/usr/bin/env python3
"""Copia um relatorio de pesquisa salvo em JSON para markdown legivel."""
import json
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("uso: python tools/copia.py origem.json destino.md")

origem, destino = map(Path, sys.argv[1:])
dados = json.loads(origem.read_text(encoding='utf-8'))
texto = dados[0]['text'] if isinstance(dados, list) else dados['text']
destino.write_text(texto, encoding='utf-8')
print(len(texto))
