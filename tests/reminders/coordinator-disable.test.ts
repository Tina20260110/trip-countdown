import { createReminderCoordinator } from '../../src/features/reminders/reminder-coordinator';
import {
  coordinatorOptions,
  createNotificationAdapter,
  FakeReminderRepository,
  reminder,
} from './fixtures/coordinator-fakes';

describe('ReminderCoordinator disable', () => {
  it('persists pending intent, cancels OS request, then confirms disabled', async () => {
    const repository = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(coordinator.disable(1, 7)).resolves.toMatchObject({
      ok: true,
      value: { enabled: false, status: 'disabled', revision: 4 },
    });
    expect(repository.calls).toEqual([
      'get:1:7',
      'update:2:pending:3',
      'update:3:disabled:4',
    ]);
    expect(notifications.cancel).toHaveBeenCalledWith('trip-1-before-7');
  });

  it('records a retryable error and never reports disabled when cancellation fails', async () => {
    const repository = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    notifications.cancel.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'scheduling', message: 'native path' },
    });
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(coordinator.disable(1, 7)).resolves.toMatchObject({
      ok: false,
      error: { phase: 'cancel' },
    });
    expect(repository.values.get('1:7')).toMatchObject({
      enabled: false,
      status: 'error',
      revision: 4,
      errorCode: 'cancel-failed',
    });
    await expect(coordinator.disable(1, 7)).resolves.toMatchObject({
      ok: true,
      value: { status: 'disabled' },
    });
  });

  it('does not affect another Trip or offset', async () => {
    const otherOffset = reminder({
      offsetDays: 1,
      notificationId: 'trip-1-before-1',
    });
    const otherTrip = reminder({
      tripId: 2,
      notificationId: 'trip-2-before-7',
    });
    const repository = new FakeReminderRepository([
      reminder(),
      otherOffset,
      otherTrip,
    ]);
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await coordinator.disable(1, 7);

    expect(repository.values.get('1:1')).toEqual(otherOffset);
    expect(repository.values.get('2:7')).toEqual(otherTrip);
    expect(notifications.cancel).toHaveBeenCalledTimes(1);
  });

  it('is idempotent after a reminder is confirmed disabled', async () => {
    const disabled = reminder({
      enabled: false,
      status: 'disabled',
      scheduledAt: null,
      scheduledTimezone: null,
      targetDate: null,
    });
    const repository = new FakeReminderRepository([disabled]);
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(coordinator.disable(1, 7)).resolves.toEqual({
      ok: true,
      value: disabled,
    });
    expect(notifications.cancel).not.toHaveBeenCalled();
    expect(repository.calls).toEqual(['get:1:7']);
  });

  it('uses revision protection for final confirmation', async () => {
    const repository = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );
    repository.beforeUpdate = (expected, value) => {
      if (value.status === 'disabled') {
        repository.values.set('1:7', { ...value, revision: expected + 5 });
      }
    };

    await expect(coordinator.disable(1, 7)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'confirmation-failed', phase: 'confirm' },
    });
    expect(repository.values.get('1:7')?.revision).toBe(8);
  });
});
