/** Lightweight settings tabs: panels stay mounted, so switching never discards
 * text input or temporarily hides a saved setting from the plugin. */
export const SETTINGS_TABS = [
  { id: 'sync', label: '笔记同步' },
  { id: 'privacy', label: '隐私与恢复' },
  { id: 'account', label: '账户与仓库' },
  { id: 'advanced', label: '高级设置' }
] as const;

export type SettingsSection = (typeof SETTINGS_TABS)[number]['id'];

export function nextSettingsTab(key: string, current: number, count: number): number | null {
  if (!Number.isInteger(current) || current < 0 || current >= count || count < 1) return null;
  if (key === 'ArrowRight') return (current + 1) % count;
  if (key === 'ArrowLeft') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export function showSettingsTab(
  buttons: readonly HTMLButtonElement[], panels: readonly HTMLElement[], selected: number
): void {
  if (buttons.length !== panels.length || !buttons.length || !Number.isInteger(selected)
    || selected < 0 || selected >= buttons.length) throw new Error('Invalid settings tab selection');
  buttons.forEach((button, index) => {
    const active = index === selected;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    button.classList.toggle('is-active', active);
    panels[index].hidden = !active;
    panels[index].tabIndex = active ? 0 : -1;
  });
}
