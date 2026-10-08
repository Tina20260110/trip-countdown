import { calculateCountdown } from '@/src/domain/countdown';

describe('calculateCountdown', () => {
  it('returns 今天出发 for the same local calendar date', () => {
    expect(calculateCountdown('2026-10-08', { year: 2026, month: 10, day: 8 })).toEqual({
      ok: true,
      value: { status: 'today', daysRemaining: 0, label: '今天出发' },
    });
  });

  it('returns future calendar days with Chinese text', () => {
    expect(calculateCountdown('2026-10-22', { year: 2026, month: 10, day: 8 })).toEqual({
      ok: true,
      value: { status: 'future', daysRemaining: 14, label: '还有 14 天' },
    });
  });

  it('returns 旅行已结束 for a past date', () => {
    expect(calculateCountdown('2026-10-07', { year: 2026, month: 10, day: 8 })).toEqual({
      ok: true,
      value: { status: 'completed', daysRemaining: -1, label: '旅行已结束' },
    });
  });

  it.each([
    ['crosses a month boundary', '2026-02-01', { year: 2026, month: 1, day: 31 }, 1],
    ['crosses a year boundary', '2027-01-01', { year: 2026, month: 12, day: 31 }, 1],
    ['includes leap day', '2024-03-01', { year: 2024, month: 2, day: 28 }, 2],
  ])('%s', (_label, departureDate, localToday, daysRemaining) => {
    expect(calculateCountdown(departureDate, localToday)).toEqual({
      ok: true,
      value: {
        status: 'future',
        daysRemaining,
        label: `还有 ${daysRemaining} 天`,
      },
    });
  });

  it.each(['2025-02-29', '2026-13-01', '2026-1-01', 'not-a-date'])(
    'returns a typed error for an invalid departure date: %s',
    (departureDate) => {
      expect(calculateCountdown(departureDate, { year: 2026, month: 10, day: 8 })).toEqual({
        ok: false,
        error: { kind: 'invalid-date-only', value: departureDate },
      });
    },
  );
});
