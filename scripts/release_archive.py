#!/usr/bin/env python3
"""Build or verify a self-contained, portable Obsidian release ZIP.

No recursive directory traversal: the member allowlist is fixed and excludes
settings, vault data, private test evidence and development dependencies.
"""
import argparse
import json
import os
import re
from urllib.parse import urlsplit
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
PREFIX = 'github-vault-sync/'
# Explicit source -> install mapping: repository READMEs contain links to files
# deliberately absent from the ZIP. Ship independent, offline-usable guides.
MEMBERS = {
    'manifest.json': 'manifest.json',
    'main.js': 'main.js',
    'styles.css': 'styles.css',
    'README.md': 'docs/install/README.md',
    'README.zh-CN.md': 'docs/install/README.zh-CN.md',
}


def release_path() -> Path:
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    versions = json.loads((ROOT / 'versions.json').read_text(encoding='utf-8'))
    version = manifest['version']
    if manifest['id'] != PREFIX.rstrip('/') or package['version'] != version:
        raise ValueError('The package and manifest versions or plugin IDs do not match')
    if not manifest.get('isDesktopOnly') or versions.get(version) != manifest['minAppVersion']:
        raise ValueError('The desktop manifest and versions.json do not match')
    return ROOT / 'releases' / f'github-vault-sync-{version}.zip'


def entry(name: str, mode: int) -> ZipInfo:
    info = ZipInfo(name, (1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = mode << 16
    return info


def build(archive: Path) -> None:
    archive.parent.mkdir(exist_ok=True)
    temp = archive.with_suffix('.zip.tmp')
    try:
        with ZipFile(temp, 'w', compression=ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr(entry(PREFIX, 0o40755), b'')
            for name, source in MEMBERS.items():
                z.writestr(entry(PREFIX + name, 0o100644), (ROOT / source).read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
        # Never replace an existing archive with a candidate that cannot verify.
        verify(temp)
        os.replace(temp, archive)
    finally:
        temp.unlink(missing_ok=True)


def verify(archive: Path) -> None:
    expected = [PREFIX] + [PREFIX + name for name in MEMBERS]
    with ZipFile(archive) as z:
        if z.namelist() != expected or z.testzip() is not None:
            raise ValueError('Unexpected release ZIP members or CRC failure')
        for name, source in MEMBERS.items():
            if z.read(PREFIX + name) != (ROOT / source).read_bytes():
                raise ValueError(f'Release ZIP member differs from reviewed source: {name}')
        version = json.loads(z.read(PREFIX + 'manifest.json'))['version']
        for name in ('README.md', 'README.zh-CN.md'):
            guide = z.read(PREFIX + name).decode('utf-8')
            if f'v{version}' not in guide.splitlines()[0]:
                raise ValueError(f'Installation guide version mismatch: {name}')
            if re.search(r'<(?:video|source|img)\b|!\[', guide, re.IGNORECASE):
                raise ValueError(f'Installation guide embeds unpackaged media: {name}')
            for link in re.findall(r'\]\(([^)]+)\)', guide):
                parsed = urlsplit(link)
                if parsed.scheme == 'https' and parsed.netloc:
                    continue  # Explicit online-only references, not bundled assets.
                if parsed.scheme or parsed.netloc or parsed.query:
                    raise ValueError(f'Unsupported installation guide link: {name}')
                if parsed.path and parsed.path not in MEMBERS:
                    raise ValueError(f'Installation guide link is not packaged: {name}')
    print(f'Verified {archive.name}: {len(expected)} allowed members, source bytes and standalone guides match')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('build', 'verify'))
    args = parser.parse_args()
    target = release_path()
    if args.command == 'build':
        build(target)
    verify(target)
