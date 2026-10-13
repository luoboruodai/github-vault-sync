import { describe, expect, it } from 'vitest';
import { nextSettingsTab, SETTINGS_TABS, showSettingsTab } from '../src/settings-tabs';

function fakeTab() {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  return {
    attrs,
    classes,
    tabIndex: -1,
    setAttribute(name: string, value: string) { attrs.set(name, value); },
    classList: { toggle(name: string, active: boolean) {
      if (active) classes.add(name); else classes.delete(name);
    } }
  };
}

describe('settings page tabs', () => {
  it('uses four dedicated pages and wraps arrow navigation; Home/End do not scroll the host', () => {
    expect(SETTINGS_TABS.map(({ id }) => id)).toEqual(['sync', 'privacy', 'account', 'advanced']);
    expect(nextSettingsTab('ArrowRight', 3, 4)).toBe(0);
    expect(nextSettingsTab('ArrowLeft', 0, 4)).toBe(3);
    expect(nextSettingsTab('Home', 2, 4)).toBe(0);
    expect(nextSettingsTab('End', 1, 4)).toBe(3);
    expect(nextSettingsTab('Enter', 1, 4)).toBeNull();
    expect(nextSettingsTab('ArrowRight', -1, 4)).toBeNull();
  });

  it('switches visibility and keyboard focus without reconstructing panel contents', () => {
    const buttons = SETTINGS_TABS.map(() => fakeTab());
    const panels = SETTINGS_TABS.map(() => ({ hidden: false, tabIndex: -1, draft: 'kept' }));
    showSettingsTab(buttons as unknown as HTMLButtonElement[], panels as unknown as HTMLElement[], 0);
    expect(buttons.map((button) => button.attrs.get('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true, true]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(buttons[0].classes.has('is-active')).toBe(true);

    showSettingsTab(buttons as unknown as HTMLButtonElement[], panels as unknown as HTMLElement[], 2);
    expect(panels.map((panel) => panel.hidden)).toEqual([true, true, false, true]);
    expect(buttons[0].classes.has('is-active')).toBe(false);
    expect(buttons[2].classes.has('is-active')).toBe(true);
    expect(panels[1].draft).toBe('kept');
    expect(panels[2].tabIndex).toBe(0);
    expect(() => showSettingsTab(buttons as unknown as HTMLButtonElement[], panels as unknown as HTMLElement[], 4)).toThrow();
  });
});
