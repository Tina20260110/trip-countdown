import { createReminderCoordinator } from '../../src/features/reminders/reminder-coordinator';
import {
  coordinatorOptions,
  createNotificationAdapter,
  FakeReminderRepository,
  reminder,
} from './fixtures/coordinator-fakes';

describe('ReminderCoordinator departure-date reschedule', () => {
  it('keeps both enabled offsets and reschedules each from the latest date', async () => {
    const seven = reminder();
    const one = reminder({
      offsetDays: 1,
      notificationId: 'trip-1-before-1',
      targetDate: '2026-10-19',
    });
    const repository = new FakeReminderRepository([seven, one]);
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(
      coordinator.rescheduleForTrip(1, '2026-11-10'),
    ).resolves.toMatchObject({
      ok: true,
      value: [
        { offsetDays: 7, targetDate: '2026-11-03', status: 'scheduled' },
        { offsetDays: 1, targetDate: '2026-11-09', status: 'scheduled' },
      ],
    });
    expect(notifications.cancel).toHaveBeenCalledTimes(2);
    expect(notifications.schedule).toHaveBeenCalledTimes(2);
  });

  it('cancels and marks an elapsed target unavailable without backfilling', async () => {
    const repository = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator({
      ...coordinatorOptions(repository, notifications),
      now: () => new Date(2026, 9, 19, 10),
    });

    await expect(
      coordinator.rescheduleForTrip(1, '2026-10-20'),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: 'unavailable', phase: 'schedule' },
    });
    expect(notifications.cancel).toHaveBeenCalledWith('trip-1-before-7');
    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(repository.values.get('1:7')).toMatchObject({
      enabled: true,
      status: 'unavailable',
      errorCode: 'target-in-past',
    });
  });

  it('does not request permission during date-edit rescheduling', async () => {
    const repository = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter({
      status: 'denied',
      canAskAgain: false,
    });
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(
      coordinator.rescheduleForTrip(1, '2026-11-10'),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: 'permission-denied', phase: 'permission' },
    });
    expect(notifications.requestPermission).not.toHaveBeenCalled();
    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(repository.values.get('1:7')).toMatchObject({
      status: 'permission_denied',
      enabled: true,
    });
  });

  it('ignores disabled reminders and reminders owned by another Trip', async () => {
    const disabled = reminder({
      offsetDays: 1,
      enabled: false,
      status: 'disabled',
      notificationId: 'trip-1-before-1',
    });
    const otherTrip = reminder({
      tripId: 2,
      notificationId: 'trip-2-before-7',
    });
    const repository = new FakeReminderRepository([
      reminder(),
      disabled,
      otherTrip,
    ]);
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await coordinator.rescheduleForTrip(1, '2026-11-10');

    expect(repository.values.get('1:1')).toEqual(disabled);
    expect(repository.values.get('2:7')).toEqual(otherTrip);
    expect(notifications.schedule).toHaveBeenCalledTimes(1);
  });

  it('records scheduling failure without reverting other persisted state', async () => {
    const repository = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    notifications.schedule.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'scheduling', message: 'user body /path' },
    });
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(
      coordinator.rescheduleForTrip(1, '2026-11-10'),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: 'scheduling', phase: 'schedule' },
    });
    expect(repository.values.get('1:7')).toMatchObject({
      status: 'error',
      targetDate: '2026-11-03',
      errorCode: 'schedule-failed',
    });
  });

  it('does not schedule a likely delivered reminder whose new target is past', async () => {
    const delivered = reminder({
      targetDate: '2026-09-24',
      scheduledAt: new Date(2026, 8, 24, 9).getTime(),
    });
    const repository = new FakeReminderRepository([delivered]);
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator({
      ...coordinatorOptions(repository, notifications),
      now: () => new Date(2026, 9, 20, 10),
    });

    await coordinator.rescheduleForTrip(1, '2026-10-21');

    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(repository.values.get('1:7')?.status).toBe('unavailable');
  });
});
