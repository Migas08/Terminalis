#!/usr/bin/env python3
"""Monta o arquivo único da plataforma Terminalis."""
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
OUTPUT = DIST / "terminalis.html"
MAX_ARTIFACT_SIZE = 15_500_000

# A ordem abaixo faz parte do contrato de inicialização do Terminalis. Cada
# módulo deve pertencer a exatamente um grupo; arquivos novos exigem uma
# decisão consciente sobre a dependência que representam.
JS_GROUPS = (
    ("núcleo", (
        "09-runtime.js",
        "10-vfs.js",
        "11-kernel.js",
        "12-catalog.js",
    )),
    ("shell", (
        "20-shell-lex.js",
        "21-shell-exec.js",
        "22-shell-run.js",
    )),
    ("comandos Linux", (
        "30-coreutils.js",
        "31-textutils.js",
        "32-admin-10-access.js",
        "32-admin-20-processes.js",
        "32-admin-30-system.js",
        "32-admin-40-packages.js",
        "32-admin-50-archives.js",
        "32-admin-60-storage.js",
        "32-admin-70-tools.js",
        "33-net.js",
        "34-manpages.js",
    )),
    ("motor Git", (
        "35-git-core.js",
        "36-git-cli.js",
        "37-github-service.js",
        "38-github-cli.js",
    )),
    ("runner JavaScript", (
        "39-js-protocol.js",
        "39-js-runner.js",
        "39-js-sandbox.js",
        "39-js-typescript.js",
    )),
    ("motor Docker", (
        "40-docker.js",
        "41-sql.js",
        "42-imgbin.js",
        "43-docker-hub.js",
        "44-yaml.js",
        "45-traefik.js",
        "46-docker-cli.js",
        "47-dockerfile.js",
        "48-compose.js",
    )),
    ("workspace", (
        "49-workspace-00-codec.js",
        "49-workspace-10-domains.js",
    )),
    ("base de conteúdo", (
        "50-content-00-core.js",
        "50-content-01-modules.js",
        "50-content-02-trilhas.js",
    )),
    ("curso Linux", (
        "51-mod01.js",
        "52-mod02.js",
        "53-mod03.js",
        "54-mod04.js",
        "55-mod05.js",
        "56-mod06.js",
        "57-mod07.js",
        "58-mod08.js",
        "59-mod09.js",
        "60-mod10.js",
        "61-mod11.js",
        "62-mod12.js",
        "62-mod12b.js",
        "63-mod13.js",
        "63-mod13b.js",
        "64-mod14.js",
        "64-mod14b.js",
        "65-mod15.js",
        "65-mod15b.js",
        "66-mpf1.js",
        "67-mod16.js",
        "68-mod16d.js",
    )),
    ("desafios práticos", (
        "69-challenge-00-core.js",
        "69-challenge-10-technologies.js",
        "69-challenge-20-linux.js",
    )),
    ("interface", (
        "70-workspace-mutation.js",
        "71-terminal.js",
        "72-app.js",
        "72-file-browser.js",
        "72-js-workspace.js",
        "72-task-ui.js",
        "73-render.js",
        "74-auth.js",
        "74-cloud-10-config.js",
        "74-cloud-20-supabase.js",
        "74-cloud-30-storage.js",
        "74-cloud-35-local-store.js",
        "74-cloud-40-sync.js",
        "76-progressao.js",
        "77-authui.js",
        "78-jornada.js",
        "79-docker-helpers.js",
    )),
    ("curso Docker", (
        "80-d01.js",
        "80-d02.js",
        "80-d03.js",
        "80-d04.js",
        "80-d05.js",
        "80-d06.js",
        "80-d07.js",
        "80-d08.js",
        "80-d09.js",
        "80-d10.js",
        "80-d11.js",
        "80-d12.js",
        "80-d13.js",
        "80-d14.js",
        "80-d15.js",
        "80-d16.js",
        "80-d17.js",
        "80-d18.js",
        "80-d19.js",
        "80-d20.js",
        "80-d21.js",
        "80-d22.js",
        "81-mpf2.js",
        "82-m25.js",
        "83-m26.js",
    )),
    ("curso Git", (
        "84-git-course.js",
        "85-git-lessons.js",
        "86-git-final.js",
        "87-git-visual.js",
    )),
    ("configurações", (
        "88-settings.js",
    )),
    ("curso JavaScript", (
        "89-js-course.js",
        "89-z-js-course-extended.js",
    )),
    ("experiência V2", (
        "89-v2-progress.js",
        "90-v2-ui.js",
        "91-v2-styles.js",
    )),
)

CSS_FILES = (
    "70-00-tokens-layout.css",
    "70-10-learning.css",
    "70-20-workspace.css",
    "70-30-account-auth.css",
    "70-40-journey.css",
    "70-50-refinements-cloud.css",
)

# Mantém os espaços entre as seções do CSS original no bundle publicado.
CSS_GAPS_AFTER = ("\n", "\n", "\n\n", "\n", "", "\n")

ICONS = {
    '__ICON_MENU__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    '__ICON_MAP__': '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/></svg>',
    '__ICON_TROPHY__': '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3"/><path d="M10 13v3h4v-3M8 20h8"/></svg>',
    '__ICON_HELP__': '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.3"/><path d="M12 17h.01"/></svg>',
    '__ICON_TERM__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-5-6-5"/><path d="M12 19h8"/></svg>',
    '__ICON_FILES__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    '__ICON_NOTES__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    '__ICON_PLUS__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    '__ICON_RESET__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    '__ICON_PLAY__': '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 4.5v15l13-7.5z"/></svg>',
    '__ICON_CLOCK__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/></svg>',
    '__ICON_HOME__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-5h4v5h5V9.5"/></svg>',
    '__ICON_BOOK__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/></svg>',
    '__ICON_ROUTE__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18.5" r="2.5"/><circle cx="18" cy="5.5" r="2.5"/><path d="M8.5 18.5H14a3.5 3.5 0 0 0 0-7H9.5a3.5 3.5 0 0 1 0-7H15"/></svg>',
    '__ICON_CUBE__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 21 7v10l-9 4.5L3 17V7z"/><path d="M3 7l9 4.5L21 7M12 11.5V21.5"/></svg>',
    '__ICON_GEAR__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/></svg>',
    '__ICON_BELL__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10.5 20a2 2 0 0 0 3 0"/></svg>',
    '__ICON_BACK__': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
}

def js_files():
    """Valida o manifesto e retorna os módulos na ordem de inicialização."""
    ordered = []
    seen = set()

    for group_name, filenames in JS_GROUPS:
        for filename in filenames:
            if filename in seen:
                raise RuntimeError(
                    f"Módulo duplicado no manifesto ({group_name}): {filename}"
                )
            seen.add(filename)
            path = SRC / filename
            if not path.is_file():
                raise FileNotFoundError(
                    f"Módulo ausente no grupo {group_name}: {filename}"
                )
            ordered.append(path)

    actual = {path.name for path in SRC.glob("*.js")}
    unclassified = sorted(actual - seen)
    if unclassified:
        raise RuntimeError(
            "Módulos sem grupo no manifesto: " + ", ".join(unclassified)
        )

    return ordered

def css_files():
    """Valida e retorna as folhas na ordem da cascata."""
    expected = set(CSS_FILES)
    actual = {path.name for path in SRC.glob("70-*.css")}
    missing = sorted(expected - actual)
    unclassified = sorted(actual - expected)

    if missing:
        raise FileNotFoundError("Folhas de estilo ausentes: " + ", ".join(missing))
    if unclassified:
        raise RuntimeError(
            "Folhas de estilo sem ordem definida: " + ", ".join(unclassified)
        )

    return [SRC / filename for filename in CSS_FILES]

def build():
    DIST.mkdir(exist_ok=True)
    modules = js_files()
    parts = [f"/* ==== {path.name} ==== */\n{path.read_text(encoding='utf-8')}" for path in modules]
    js = '\n;\n'.join(parts)
    offline = os.environ.get("TERMINALIS_OFFLINE") == "1"

    # Os testes automatizados devem continuar independentes do projeto Supabase.
    # O site publicado não define esta variável e usa a configuração de nuvem normal.
    if offline:
        js = (
            "globalThis.TERMINALIS_CONFIG = { supabase: { url: '', anonKey: '' } };\n"
            + js
        )

    css = "".join(
        path.read_text(encoding="utf-8") + gap
        for path, gap in zip(css_files(), CSS_GAPS_AFTER)
    )
    html = (SRC / "75-shell.html").read_text(encoding="utf-8")
    if offline:
        # O SDK vem antes do bundle; só injetar a configuração offline no JS não
        # impedia a requisição à CDN. Removê-la torna os testes realmente sem rede.
        html = html.replace(
            '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js" crossorigin="anonymous" onerror="window.__supabaseIndisponivel=true"></script>',
            '<script>window.__supabaseIndisponivel=true</script>',
        )

    for k, v in ICONS.items():
        html = html.replace(k, v)
    html = html.replace('__CSS__', css)
    html = html.replace('__JS__', js)

    # O artefato é versionado. CRLF explícito evita diferenças entre o build
    # feito no Windows e a mesma geração executada pelo CI no Linux.
    OUTPUT.write_text(html, encoding="utf-8", newline="\r\n")

    size = OUTPUT.stat().st_size
    print(f"OK  {OUTPUT}  ({size / 1048576:.2f} MB, {len(modules)} arquivos JS)")
    if size > MAX_ARTIFACT_SIZE:
        print("AVISO: acima do limite de 16 MB do Artifact")
    return OUTPUT

if __name__ == '__main__':
    build()
