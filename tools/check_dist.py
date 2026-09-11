#!/usr/bin/env python3
"""Confirma que o HTML versionado corresponde ao build de produção."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import build  # noqa: E402


def main():
    before = build.OUTPUT.read_bytes() if build.OUTPUT.is_file() else None
    build.build()
    after = build.OUTPUT.read_bytes()
    if before != after:
        print("ERRO: dist/terminalis.html está desatualizado.", file=sys.stderr)
        print("Execute python build.py antes de criar o commit.", file=sys.stderr)
        return 1
    print("OK  dist/terminalis.html está sincronizado com src.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
