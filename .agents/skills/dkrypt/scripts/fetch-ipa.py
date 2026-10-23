#!/usr/bin/env python3
"""List or download decrypted IPAs from dkrypt (ipa.dylib.dev).

  fetch-ipa.py --list <bundleId>
  fetch-ipa.py <bundleId> [appstore|testflight]

DKRYPT_API_KEY comes from the environment, else from .env at the root of the current git repo.
Downloads land in $IPA_DIR (default ~/ipas) and are checked against the listed SHA-256.
"""

import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = 'https://ipa.dylib.dev'


def api_key():
    if key := os.environ.get('DKRYPT_API_KEY'):
        return key

    root = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True)
    env = Path(root.stdout.strip() or '.') / '.env'

    for line in env.read_text().splitlines() if env.is_file() else []:
        name, _, value = line.partition('=')

        if name.strip().removeprefix('export ') == 'DKRYPT_API_KEY':
            return value.strip().strip('\'"')

    sys.exit('DKRYPT_API_KEY is not set and no .env in this repo defines it')


def get(path, key, timeout):
    # The default Python-urllib user agent is refused with a 403.
    headers = {'Authorization': f'Bearer {key}', 'User-Agent': 'fetch-ipa'}

    try:
        return urllib.request.urlopen(urllib.request.Request(BASE + path, headers=headers), timeout=timeout)
    except urllib.error.HTTPError as error:
        sys.exit(f'GET {path}: HTTP {error.code} {error.read().decode(errors="replace")[:200]}')


def main(args):
    if not args or args[0] in ('-h', '--help') or (args[0] == '--list' and len(args) < 2):
        sys.exit(__doc__)

    key = api_key()
    artifacts = json.load(get('/v1/artifacts', key, 60))['artifacts']
    artifacts.sort(key=lambda a: a['createdAt'], reverse=True)

    if args[0] == '--list':
        for a in artifacts:
            if a['bundleId'] == args[1]:
                print(a['id'], a['channel'], a['versionLabel'], a['buildNumber'], a['createdAt'])

        return

    bundle, channel = args[0], args[1] if len(args) > 1 else 'appstore'
    hits = [a for a in artifacts if a['bundleId'] == bundle and a['channel'] == channel]

    if not hits:
        sys.exit(f'no cached {channel} artifact for {bundle}')

    a = hits[0]
    out_dir = Path(os.environ.get('IPA_DIR', '~/ipas')).expanduser()
    out = out_dir / f"{bundle}-{a['versionLabel']}-{a['buildNumber']}.ipa"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not out.exists():
        part = out.with_suffix('.part')

        with get(a['fileUrl'], key, 900) as response, part.open('wb') as file:
            while chunk := response.read(1 << 20):
                file.write(chunk)

        part.rename(out)

    digest = hashlib.sha256()

    with out.open('rb') as file:
        while chunk := file.read(1 << 20):
            digest.update(chunk)

    if digest.hexdigest() != a['sha256']:
        sys.exit(f'sha256 mismatch, delete and retry: {out}')

    print('ok', out)


main(sys.argv[1:])
