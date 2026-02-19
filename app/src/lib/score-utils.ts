import { SCORE_GRADIENT } from './constants';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(c).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Linear interpolation on the 3-stop score gradient.
 *
 * @param value — score in [0, 1] (clamped if out of range)
 * @returns CSS hex color string (uppercase, e.g. '#CC4125')
 *
 * 0.0 → '#CC4125' (red)
 * 0.5 → '#FFD966' (amber)
 * 1.0 → '#6AA84F' (green)
 */
export function scoreColor(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));

  // Find the two stops that bracket the value
  for (let i = 0; i < SCORE_GRADIENT.length - 1; i++) {
    const lo = SCORE_GRADIENT[i];
    const hi = SCORE_GRADIENT[i + 1];
    if (lo === undefined || hi === undefined) continue;

    if (clamped >= lo.stop && clamped <= hi.stop) {
      const range = hi.stop - lo.stop;
      const t = range === 0 ? 0 : (clamped - lo.stop) / range;

      const [r1, g1, b1] = hexToRgb(lo.color);
      const [r2, g2, b2] = hexToRgb(hi.color);

      return rgbToHex(
        r1 + (r2 - r1) * t,
        g1 + (g2 - g1) * t,
        b1 + (b2 - b1) * t,
      );
    }
  }

  // Fallback — should never reach here with a valid gradient
  const last = SCORE_GRADIENT[SCORE_GRADIENT.length - 1];
  return last?.color ?? '#6AA84F';
}
