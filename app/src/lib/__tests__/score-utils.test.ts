import { describe, it, expect } from 'vitest';
import { scoreColor } from '../score-utils';

describe('scoreColor', () => {
  it('returns red at 0.0', () => {
    expect(scoreColor(0.0)).toBe('#CC4125');
  });

  it('returns amber at 0.5', () => {
    expect(scoreColor(0.5)).toBe('#FFD966');
  });

  it('returns green at 1.0', () => {
    expect(scoreColor(1.0)).toBe('#6AA84F');
  });

  it('interpolates midpoint between red and amber (0.25)', () => {
    const color = scoreColor(0.25);
    // Midpoint: R=(CC+FF)/2=E5, G=(41+D9)/2=8D, B=(25+66)/2=46
    // Exact: R=0xCC + (0xFF-0xCC)*0.5 = 0xE6, G=0x41 + (0xD9-0x41)*0.5 = 0x8D, B=0x25 + (0x66-0x25)*0.5 = 0x46
    expect(color).toBe('#E68D46');
  });

  it('interpolates midpoint between amber and green (0.75)', () => {
    const color = scoreColor(0.75);
    // R=0xFF + (0x6A-0xFF)*0.5 = 0xB5, G=0xD9 + (0xA8-0xD9)*0.5 = 0xC1, B=0x66 + (0x4F-0x66)*0.5 = 0x5B
    expect(color).toBe('#B5C15B');
  });

  it('clamps values below 0 to red', () => {
    expect(scoreColor(-0.5)).toBe('#CC4125');
  });

  it('clamps values above 1 to green', () => {
    expect(scoreColor(1.5)).toBe('#6AA84F');
  });

  it('returns a valid hex color for any value in range', () => {
    for (let v = 0; v <= 1; v += 0.1) {
      const color = scoreColor(v);
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
