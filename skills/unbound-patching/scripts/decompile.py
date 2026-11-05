#!/usr/bin/env python3
"""Decompile a Discord Hermes bundle into one file per source module.

  decompile.py <app.ipa | app.apk | bundle> <out dir> [--skip-decompile]

Writes <out>/main.js (the whole decompile), <out>/dec.log and <out>/mods/<source path>.
Installs hermes-dec into $HERMES_DEC_VENV (default ~/.cache/unbound/hermes-dec) on first run.
"""

import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

MODULE_PATH = re.compile(r"r\d+ = '([^']+\.(?:tsx|ts|js|jsx))';")


def decompiler():
    cache = Path(os.environ.get('XDG_CACHE_HOME', '~/.cache')).expanduser()
    venv = Path(os.environ.get('HERMES_DEC_VENV', cache / 'unbound' / 'hermes-dec'))
    bin_dir = venv / ('Scripts' if os.name == 'nt' else 'bin')
    tool = bin_dir / 'hbc-decompiler'

    if tool.exists():
        return tool

    if shutil.which('uv'):
        steps = [['uv', 'venv', venv], ['uv', 'pip', 'install', '--python', bin_dir / 'python', 'hermes-dec']]
    else:
        steps = [[sys.executable, '-m', 'venv', venv], [bin_dir / 'python', '-m', 'pip', 'install', 'hermes-dec']]

    for step in steps:
        if subprocess.run(step).returncode:
            sys.exit(f"failed: {' '.join(map(str, step))}. Install uv or python3-venv.")

    return tool


def split(main_js, mods):
    # Each module ends at a `fileFinishedImporting` call; the next line names its source path.
    buf, count, ended = [], 0, False

    with main_js.open(encoding='utf-8', errors='replace') as src:
        for line in src:
            buf.append(line)

            if ended and (match := MODULE_PATH.search(line)):
                out = mods / match.group(1).replace('../', '_up_/')
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_text(''.join(buf), encoding='utf-8')
                buf, count = [], count + 1

            ended = 'fileFinishedImporting' in line

    return count


BUNDLE_ENTRY = re.compile(r'Payload/[^/]+\.app/main\.jsbundle|assets/index\.android\.bundle')


def extract_bundle(source, out):
    target = out / 'main.jsbundle'

    if not zipfile.is_zipfile(source):
        shutil.copyfile(source, target)
        return target

    with zipfile.ZipFile(source) as archive:
        name = next(n for n in archive.namelist() if BUNDLE_ENTRY.fullmatch(n))
        target.write_bytes(archive.read(name))

    return target


def main(args):
    skip = '--skip-decompile' in args
    args = [arg for arg in args if arg != '--skip-decompile']

    if len(args) != 2:
        sys.exit(__doc__)

    source, out = Path(args[0]), Path(args[1]).expanduser()
    out.mkdir(parents=True, exist_ok=True)

    if not skip:
        bundle = extract_bundle(source, out)

        with (out / 'dec.log').open('w') as log:
            subprocess.run([decompiler(), bundle, out / 'main.js'], stderr=log, check=True)

    print(split(out / 'main.js', out / 'mods'), 'modules in', out / 'mods')


main(sys.argv[1:])
