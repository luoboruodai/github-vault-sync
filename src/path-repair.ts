import { normalizeRelPath } from './utils';

export interface WindowsPathRepair {
  from: string;
  to: string;
}

export interface WindowsPathRepairPlan {
  repairs: WindowsPathRepair[];
  errors: string[];
}

const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

export function convertWindowsPath(path: string): string {
  return normalizeRelPath(path).split('/').map((segment) => {
    let converted = segment
      .replace(/</g, '＜')
      .replace(/>/g, '＞')
      .replace(/:/g, '：')
      .replace(/"/g, '＂')
      .replace(/\|/g, '｜')
      .replace(/\?/g, '？')
      .replace(/\*/g, '＊');
    if (converted.endsWith('.')) converted = `${converted.slice(0, -1)}．`;
    if (converted.endsWith(' ')) converted = `${converted.slice(0, -1)}　`;
    if (WINDOWS_RESERVED.test(converted.split('.')[0] ?? '')) converted = `_${converted}`;
    return converted;
  }).join('/');
}

export function planWindowsPathRepairs(
  paths: readonly string[],
  targetExists: (target: string) => boolean
): WindowsPathRepairPlan {
  const repairs: WindowsPathRepair[] = [];
  const errors: string[] = [];
  const targets = new Set<string>();

  for (const source of paths) {
    const from = normalizeRelPath(source);
    const to = convertWindowsPath(from);
    if (from === to) {
      errors.push(`Path is already compatible: ${from}`);
      continue;
    }
    if (targets.has(to)) {
      errors.push(`Multiple files would rename to ${to}`);
      continue;
    }
    if (targetExists(to)) {
      errors.push(`Rename target already exists: ${to}`);
      continue;
    }
    targets.add(to);
    repairs.push({ from, to });
  }

  return { repairs, errors };
}
