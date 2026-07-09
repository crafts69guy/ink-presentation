import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/config';
import { getHighlightSheet, resolveTheme } from '../src/reveal/themes';

describe('resolveTheme', () => {
  it('resolves every configured theme name', () => {
    for (const name of THEMES) {
      const theme = resolveTheme(name);
      expect(theme.base.length, name).toBeGreaterThan(0);
      expect(theme.base[0], name).toContain('.reveal');
    }
  });

  it('inkdrop theme follows the app appearance and maps app variables', () => {
    const theme = resolveTheme('inkdrop');
    expect(theme.dark).toBe('auto');
    const overrides = theme.overrides.join('\n');
    expect(overrides).toContain('--r-background-color: var(--editor-background');
    expect(overrides).toContain('--r-main-color: var(--text-color');
    expect(overrides).toContain('--r-link-color: var(--mde-preview-link-color');
  });

  it('built-in themes carry a fixed light/dark classification', () => {
    expect(resolveTheme('black').dark).toBe(true);
    expect(resolveTheme('white').dark).toBe(false);
    expect(resolveTheme('night').dark).toBe(true);
    expect(resolveTheme('simple').dark).toBe(false);
  });

  it('highlight sheets differ between light and dark', () => {
    const dark = getHighlightSheet(true);
    const light = getHighlightSheet(false);
    expect(dark).toContain('.hljs');
    expect(light).toContain('.hljs');
    expect(dark).not.toBe(light);
  });
});
