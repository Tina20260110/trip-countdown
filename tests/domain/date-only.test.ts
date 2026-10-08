import {
  formatDateOnly,
  getLocalDateOnly,
  parseDateOnly,
  toUtcDayOrdinal,
} from '@/src/domain/date-only';

describe('date-only parsing', () => {
  it.each([
    ['2024-02-29', { year: 2024, month: 2, day: 29 }],
    ['2026-12-31', { year: 2026, month: 12, day: 31 }],
    ['2027-01-01', { year: 2027, month: 1, day: 1 }],
    ['0099-01-02', { year: 99, month: 1, day: 2 }],
  ])('parses and round-trips %s', (value, components) => {
    const result = parseDateOnly(value);

    expect(result).toEqual({ ok: true, value: { value, ...components } });
    expect(formatDateOnly(components)).toEqual({ ok: true, value });
  });

  it.each([
    '2026-1-01',
    '26-01-01',
    '2026/01/01',
    ' 2026-01-01',
    '2026-01-01 ',
    '2026-01-01T00:00:00Z',
  ])('rejects a non-YYYY-MM-DD representation: %s', (value) => {
    expect(parseDateOnly(value)).toEqual({
      ok: false,
      error: { kind: 'invalid-date-only', value },
    });
  });

  it.each([
    '2025-02-29',
    '2026-00-01',
    '2026-13-01',
    '2026-04-31',
    '2026-01-00',
    '2026-01-32',
  ])('rejects a nonexistent Gregorian date: %s', (value) => {
    expect(parseDateOnly(value)).toEqual({
      ok: false,
      error: { kind: 'invalid-date-only', value },
    });
  });
});

describe('date-only calendar helpers', () => {
  it('reads local calendar components without parsing an ISO date string', () => {
    const localDate = new Date(0);
    localDate.setHours(23, 45, 0, 0);
    localDate.setFullYear(99, 0, 2);

    expect(getLocalDateOnly(localDate)).toEqual({
      value: '0099-01-02',
      year: 99,
      month: 1,
      day: 2,
    });
  });

  it('maps adjacent calendar dates to adjacent UTC day ordinals', () => {
    const endOfYear = parseDateOnly('2026-12-31');
    const startOfYear = parseDateOnly('2027-01-01');

    expect(endOfYear.ok).toBe(true);
    expect(startOfYear.ok).toBe(true);

    if (endOfYear.ok && startOfYear.ok) {
      expect(toUtcDayOrdinal(startOfYear.value) - toUtcDayOrdinal(endOfYear.value)).toBe(1);
    }
  });

  it('handles leap-day ordinal transitions', () => {
    const leapDay = parseDateOnly('2024-02-29');
    const nextDay = parseDateOnly('2024-03-01');

    if (leapDay.ok && nextDay.ok) {
      expect(toUtcDayOrdinal(nextDay.value) - toUtcDayOrdinal(leapDay.value)).toBe(1);
    } else {
      throw new Error('Test fixture must contain valid dates');
    }
  });
});
