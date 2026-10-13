#!/usr/bin/env python3
"""Build or verify a self-contained, portable Obsidian release ZIP.

No recursive directory traversal: the member allowlist is fixed and excludes
settings, vault data, private test evidence and development dependencies.
"""
import argparse
import json
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
PREFIX = 'github-vault-sync/'
MEMBERS = ('manifest.json', 'main.js', 'styles.css', 'README.md', 'README.zh-CN.md')


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
            for name in MEMBERS:
                z.writestr(entry(PREFIX + name, 0o100644), (ROOT / name).read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
        os.replace(temp, archive)
    finally:
        temp.unlink(missing_ok=True)


def verify(archive: Path) -> None:
    expected = [PREFIX] + [PREFIX + name for name in MEMBERS]
    with ZipFile(archive) as z:
        if z.namelist() != expected or z.testzip() is not None:
            raise ValueError('Unexpected release ZIP members or CRC failure')
        for name in MEMBERS:
            if z.read(PREFIX + name) != (ROOT / name).read_bytes():
                raise ValueError(f'Release ZIP member differs from reviewed source: {name}')
    print(f'Verified {archive.name}: {len(expected)} allowed members, source bytes match')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('build', 'verify'))
    args = parser.parse_args()
    target = release_path()
    if args.command == 'build':
        build(target)
    verify(target)
