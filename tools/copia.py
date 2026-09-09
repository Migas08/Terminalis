#!/usr/bin/env python3
"""Copia um relatorio de pesquisa salvo em JSON para markdown legivel."""
import json
import os
import sys

origem = sys.argv[1]
destino = sys.argv[2]
dados = json.load(open(origem, encoding='utf-8'))
texto = dados[0]['text'] if isinstance(dados, list) else dados['text']
with open(destino, 'w', encoding='utf-8') as fh:
    fh.write(texto)
print(len(texto))
