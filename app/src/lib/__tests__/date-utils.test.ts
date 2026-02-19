import { describe, it, expect } from 'vitest';
import {
  parseYMD,
  toYMD,
  addDays,
  formatDisplayDate,
  todayYMD,
  compareDates,
} from '../date-utils';

describe('parseYMD', () => {
  it('parses a date string to local midnight', () => {
    const d = parseYMD('2026-02-17');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // 0-indexed
    expect(d.getDate()).toBe(17);
  });

  it('handles single-digit month and day', () => {
    const d = parseYMD('2026-01-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });
});

describe('toYMD', () => {
  it('formats a Date to YYYY-MM-DD with zero-padding', () => {
    expect(toYMD(new Date(2026, 1, 17))).toBe('2026-02-17');
  });

  it('pads single-digit month and day', () => {
    expect(toYMD(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-02-17', 3)).toBe('2026-02-20');
  });

  it('crosses a month boundary', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('crosses a year boundary backwards', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('subtracts days', () => {
    expect(addDays('2026-02-17', -5)).toBe('2026-02-12');
  });

  it('adds zero days (identity)', () => {
    expect(addDays('2026-02-17', 0)).toBe('2026-02-17');
  });
});

describe('formatDisplayDate', () => {
  it('formats as "Weekday, Month Day, Year"', () => {
    expect(formatDisplayDate('2026-02-17')).toBe('Tuesday, February 17, 2026');
  });

  it('formats another date correctly', () => {
    expect(formatDisplayDate('2026-01-01')).toBe('Thursday, January 1, 2026');
  });
});

describe('todayYMD', () => {
  it('returns a valid YYYY-MM-DD string', () => {
    const today = todayYMD();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches the current local date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayYMD()).toBe(expected);
  });
});

describe('compareDates', () => {
  it('returns -1 when a < b', () => {
    expect(compareDates('2026-02-17', '2026-02-18')).toBe(-1);
  });

  it('returns 0 when equal', () => {
    expect(compareDates('2026-02-17', '2026-02-17')).toBe(0);
  });

  it('returns 1 when a > b', () => {
    expect(compareDates('2026-02-18', '2026-02-17')).toBe(1);
  });

  it('compares across months', () => {
    expect(compareDates('2026-01-31', '2026-02-01')).toBe(-1);
  });

  it('compares across years', () => {
    expect(compareDates('2025-12-31', '2026-01-01')).toBe(-1);
  });
});

describe('round-trip', () => {
  it('parseYMD → toYMD is identity', () => {
    const dates = ['2026-02-17', '2026-01-01', '2025-12-31', '2026-06-15'];
    for (const d of dates) {
      expect(toYMD(parseYMD(d))).toBe(d);
    }
  });
});
