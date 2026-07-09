import { describe, expect, it } from 'vitest';
import { isDarkColor } from '../src/core/color';

describe('isDarkColor', () => {
  it('classifies dark backgrounds', () => {
    expect(isDarkColor('rgb(28, 28, 28)')).toBe(true);
    expect(isDarkColor('rgb(0, 0, 0)')).toBe(true);
    expect(isDarkColor('rgba(30, 30, 46, 1)')).toBe(true);
  });

  it('classifies light backgrounds', () => {
    expect(isDarkColor('rgb(255, 255, 255)')).toBe(false);
    expect(isDarkColor('rgb(250, 250, 245)')).toBe(false);
  });

  it('handles space-separated rgb() syntax', () => {
    expect(isDarkColor('rgb(20 20 20)')).toBe(true);
    expect(isDarkColor('rgba(255 255 255 / 1)')).toBe(false);
  });

  it('falls back for transparent or unparseable values', () => {
    expect(isDarkColor('rgba(0, 0, 0, 0)')).toBe(true);
    expect(isDarkColor('rgba(0, 0, 0, 0)', false)).toBe(false);
    expect(isDarkColor('transparent')).toBe(true);
    expect(isDarkColor('not-a-color', false)).toBe(false);
  });

  it('green-heavy colors count as light (luminance weighting)', () => {
    expect(isDarkColor('rgb(0, 220, 0)')).toBe(false);
    expect(isDarkColor('rgb(0, 0, 220)')).toBe(true);
  });
});
