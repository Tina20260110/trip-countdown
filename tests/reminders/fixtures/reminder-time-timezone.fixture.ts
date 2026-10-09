import { createReminderTime } from '@/src/features/reminders/reminder-time';

describe(`Reminder timezone fixture: ${process.env.TZ}`, () => {
  it('keeps calendar subtraction and local 09:00 across spring DST', () => {
    const result = createReminderTime(
      '2026-03-09',
      1,
      new Date(2026, 0, 1, 0, 0),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.targetDate).toBe('2026-03-08');
    const instant = new Date(result.value.androidTrigger.date);
    expect({
      year: instant.getFullYear(),
      month: instant.getMonth() + 1,
      day: instant.getDate(),
      hour: instant.getHours(),
      minute: instant.getMinutes(),
    }).toEqual({ year: 2026, month: 3, day: 8, hour: 9, minute: 0 });
  });

  it('keeps calendar subtraction and local 09:00 across fall DST', () => {
    const result = createReminderTime(
      '2026-11-02',
      1,
      new Date(2026, 0, 1, 0, 0),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.targetDate).toBe('2026-11-01');
    const instant = new Date(result.value.androidTrigger.date);
    expect(instant.getHours()).toBe(9);
  });
});
