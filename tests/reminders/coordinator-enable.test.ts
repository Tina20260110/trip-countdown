import { createReminderCoordinator } from '../../src/features/reminders/reminder-coordinator';
import {
  coordinatorOptions,
  createNotificationAdapter,
  FakeReminderRepository,
  reminder,
} from './fixtures/coordinator-fakes';

describe('ReminderCoordinator enable', () => {
  it.each([1, 7] as const)(
    'persists pending, cancels, schedules, and conditionally confirms offset %i',
    async (offsetDays) => {
      const repository = new FakeReminderRepository();
      const notifications = createNotificationAdapter();
      const coordinator = createReminderCoordinator(
        coordinatorOptions(repository, notifications),
      );

      const result = await coordinator.enable({
        tripId: 1,
        offsetDays,
        departureDate: '2026-10-20',
      });

      expect(result).toMatchObject({
        ok: true,
        value: { enabled: true, status: 'scheduled', revision: 2 },
      });
      expect(repository.calls).toEqual([
        `get:1:${offsetDays}`,
        'create:pending:1',
        'update:1:scheduled:2',
      ]);
      expect(notifications.cancel).toHaveBeenCalledWith(
        `trip-1-before-${offsetDays}`,
      );
      expect(notifications.schedule).toHaveBeenCalledTimes(1);
      expect(notifications.cancel.mock.invocationCallOrder[0]).toBeLessThan(
        notifications.schedule.mock.invocationCallOrder[0],
      );
    },
  );

  it('stops before OS work when pending intent cannot be persisted', async () => {
    const repository = new FakeReminderRepository();
    repository.failNextCreate = true;
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(
      coordinator.enable({ tripId: 1, offsetDays: 7, departureDate: '2026-10-20' }),
    ).resolves.toMatchObject({ ok: false, error: { phase: 'persist-intent' } });
    expect(notifications.cancel).not.toHaveBeenCalled();
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it('persists permission_denied and does not schedule when permission is refused', async () => {
    const repository = new FakeReminderRepository();
    const notifications = createNotificationAdapter({
      status: 'undetermined',
      canAskAgain: true,
    });
    notifications.requestPermission.mockResolvedValue({
      ok: true,
      value: { status: 'denied', canAskAgain: false },
    });
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    const result = await coordinator.enable({
      tripId: 1,
      offsetDays: 7,
      departureDate: '2026-10-20',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'permission-denied' },
    });
    expect(repository.values.get('1:7')).toMatchObject({
      enabled: false,
      status: 'permission_denied',
      revision: 2,
    });
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it('keeps a recoverable error when old notification cancellation fails', async () => {
    const repository = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    notifications.cancel.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'scheduling', message: 'native detail' },
    });
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(
      coordinator.enable({ tripId: 1, offsetDays: 7, departureDate: '2026-10-20' }),
    ).resolves.toMatchObject({ ok: false, error: { phase: 'cancel' } });
    expect(repository.values.get('1:7')).toMatchObject({
      enabled: true,
      status: 'error',
      revision: 4,
      errorCode: 'cancel-failed',
    });
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it('persists schedule failure and can retry successfully', async () => {
    const repository = new FakeReminderRepository();
    const notifications = createNotificationAdapter();
    notifications.schedule.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'scheduling', message: 'private path' },
    });
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );
    const input = { tripId: 1, offsetDays: 7 as const, departureDate: '2026-10-20' };

    await expect(coordinator.enable(input)).resolves.toMatchObject({
      ok: false,
      error: { phase: 'schedule' },
    });
    expect(repository.values.get('1:7')).toMatchObject({
      status: 'error',
      errorCode: 'schedule-failed',
    });
    await expect(coordinator.enable(input)).resolves.toMatchObject({
      ok: true,
      value: { status: 'scheduled' },
    });
    expect(notifications.schedule).toHaveBeenCalledTimes(2);
  });

  it('records an unavailable scheduler result distinctly', async () => {
    const repository = new FakeReminderRepository();
    const notifications = createNotificationAdapter();
    notifications.schedule.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'unavailable', message: 'native detail' },
    });
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );

    await expect(
      coordinator.enable({ tripId: 1, offsetDays: 1, departureDate: '2026-10-20' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: 'unavailable', phase: 'schedule' },
    });
    expect(repository.values.get('1:1')).toMatchObject({
      status: 'unavailable',
      errorCode: 'schedule-unavailable',
    });
  });

  it('distinguishes OS success from database confirmation failure', async () => {
    const repository = new FakeReminderRepository();
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );
    repository.beforeUpdate = (_expected, value) => {
      if (value.status === 'scheduled') repository.failNextUpdate = true;
    };

    await expect(
      coordinator.enable({ tripId: 1, offsetDays: 7, departureDate: '2026-10-20' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: 'confirmation-failed', phase: 'confirm' },
    });
    expect(notifications.schedule).toHaveBeenCalledTimes(1);
    expect(repository.values.get('1:7')).toMatchObject({
      status: 'pending',
      revision: 1,
    });
  });

  it('does not let a stale revision confirm over a newer intent', async () => {
    const repository = new FakeReminderRepository();
    const notifications = createNotificationAdapter();
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );
    repository.beforeUpdate = (expected, value) => {
      if (value.status === 'scheduled') {
        repository.values.set('1:7', { ...value, revision: expected + 10 });
      }
    };

    await expect(
      coordinator.enable({ tripId: 1, offsetDays: 7, departureDate: '2026-10-20' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: 'confirmation-failed' },
    });
    expect(repository.values.get('1:7')?.revision).toBe(11);
  });

  it('serializes rapid operations for the same Trip and leaves one effective request', async () => {
    const repository = new FakeReminderRepository();
    const notifications = createNotificationAdapter();
    let release!: () => void;
    notifications.schedule.mockImplementationOnce(
      () => new Promise((resolve) => {
        release = () => resolve({ ok: true, value: 'trip-1-before-7' });
      }),
    );
    const coordinator = createReminderCoordinator(
      coordinatorOptions(repository, notifications),
    );
    const input = { tripId: 1, offsetDays: 7 as const, departureDate: '2026-10-20' };

    const first = coordinator.enable(input);
    const second = coordinator.enable(input);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notifications.schedule).toHaveBeenCalledTimes(1);
    release();
    await first;
    await second;

    expect(notifications.schedule).toHaveBeenCalledTimes(2);
    expect(notifications.cancel).toHaveBeenCalledTimes(2);
    expect(repository.values.get('1:7')).toMatchObject({ status: 'scheduled' });
  });
});
