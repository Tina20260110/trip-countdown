import { calculateCountdown } from '@/src/domain/countdown';

function localComponents(instant: Date) {
  return {
    year: instant.getFullYear(),
    month: instant.getMonth() + 1,
    day: instant.getDate(),
  };
}

describe(`Countdown timezone fixture: ${process.env.TZ}`, () => {
  if (process.env.TZ === 'America/New_York') {
    it('is stable across the spring DST clock change', () => {
      const beforeJump = new Date(Date.UTC(2026, 2, 8, 6, 30));
      const afterJump = new Date(Date.UTC(2026, 2, 8, 7, 30));

      expect(localComponents(beforeJump)).toEqual({ year: 2026, month: 3, day: 8 });
      expect(localComponents(afterJump)).toEqual({ year: 2026, month: 3, day: 8 });
      expect(calculateCountdown('2026-03-09', localComponents(beforeJump))).toMatchObject({
        ok: true,
        value: { status: 'future', daysRemaining: 1 },
      });
      expect(calculateCountdown('2026-03-09', localComponents(afterJump))).toMatchObject({
        ok: true,
        value: { status: 'future', daysRemaining: 1 },
      });
    });

    it('is stable across the repeated hour at the fall DST boundary', () => {
      const firstOccurrence = new Date(Date.UTC(2026, 10, 1, 5, 30));
      const secondOccurrence = new Date(Date.UTC(2026, 10, 1, 6, 30));

      expect(localComponents(firstOccurrence)).toEqual({ year: 2026, month: 11, day: 1 });
      expect(localComponents(secondOccurrence)).toEqual({ year: 2026, month: 11, day: 1 });
      expect(calculateCountdown('2026-11-02', localComponents(firstOccurrence))).toMatchObject({
        ok: true,
        value: { status: 'future', daysRemaining: 1 },
      });
      expect(calculateCountdown('2026-11-02', localComponents(secondOccurrence))).toMatchObject({
        ok: true,
        value: { status: 'future', daysRemaining: 1 },
      });
    });
  } else {
    it('uses the Asia/Shanghai local calendar date around a UTC day boundary', () => {
      const instant = new Date(Date.UTC(2026, 2, 8, 16, 30));

      expect(localComponents(instant)).toEqual({ year: 2026, month: 3, day: 9 });
      expect(calculateCountdown('2026-03-10', localComponents(instant))).toEqual({
        ok: true,
        value: { status: 'future', daysRemaining: 1, label: '还有 1 天' },
      });
    });
  }
});
