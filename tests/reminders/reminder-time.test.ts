import {
  createReminderTime,
  type ReminderTimeResult,
} from '../../src/features/reminders/reminder-time';

function expectAvailable(result: ReminderTimeResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected reminder time to be available');
  return result.value;
}

describe('reminder calendar time', () => {
  it.each([
    [7, '2026-10-20', '2026-10-13'],
    [1, '2026-10-20', '2026-10-19'],
    [7, '2027-01-03', '2026-12-27'],
    [1, '2028-03-01', '2028-02-29'],
  ] as const)('subtracts %i calendar days from %s', (offset, departure, target) => {
    const value = expectAvailable(
      createReminderTime(departure, offset, new Date(2026, 0, 1, 0, 0)),
    );

    expect(value.targetDate).toBe(target);
    expect(value.localHour).toBe(9);
  });

  it('builds non-repeating iOS calendar components without a fixed timezone', () => {
    const value = expectAvailable(
      createReminderTime('2026-10-20', 7, new Date(2026, 0, 1)),
    );

    expect(value.iosTrigger).toEqual({
      platform: 'ios',
      type: 'calendar',
      year: 2026,
      month: 10,
      day: 13,
      hour: 9,
      minute: 0,
      second: 0,
      repeats: false,
    });
    expect(value.iosTrigger).not.toHaveProperty('timezone');
  });

  it('builds an Android date instant from current local timezone components', () => {
    const value = expectAvailable(
      createReminderTime('2026-04-02', 1, new Date(2026, 0, 1)),
    );
    const scheduled = new Date(value.androidTrigger.date);

    expect(scheduled.getFullYear()).toBe(2026);
    expect(scheduled.getMonth()).toBe(3);
    expect(scheduled.getDate()).toBe(1);
    expect(scheduled.getHours()).toBe(9);
    expect(scheduled.getMinutes()).toBe(0);
    expect(value.androidTrigger.repeats).toBe(false);
  });

  it('uses calendar components across a DST boundary rather than elapsed days', () => {
    const value = expectAvailable(
      createReminderTime('2026-03-10', 1, new Date(2026, 0, 1)),
    );

    expect(value.targetDate).toBe('2026-03-09');
    expect(new Date(value.androidTrigger.date).getHours()).toBe(9);
  });

  it.each([
    new Date(2026, 9, 13, 9, 0),
    new Date(2026, 9, 13, 10, 0),
  ])('does not backfill a target at or before now', (now) => {
    expect(createReminderTime('2026-10-20', 7, now)).toEqual({
      ok: false,
      error: {
        kind: 'unavailable',
        message: '提醒时间已过，无法安排提醒。',
      },
    });
  });
});
