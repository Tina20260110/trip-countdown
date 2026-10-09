import type { TripRepository } from '../../src/contracts/repositories';
import { createTripDeletionPort } from '../../src/features/trips/trip-deletion-port';
import { createReminderCoordinator, createReminderTripQueue } from '../../src/features/reminders/reminder-coordinator';
import { createReminderReconciler } from '../../src/features/reminders/reconciliation';
import {
  coordinatorOptions,
  createNotificationAdapter,
  FakeReminderRepository,
  reminder,
} from './fixtures/coordinator-fakes';

function tripRepository(deleteResult: Awaited<ReturnType<TripRepository['delete']>> = { ok: true, value: undefined }) {
  return {
    list: jest.fn().mockResolvedValue({ ok: true, value: [{
      id: 1, destination: 'Trip', departureDate: '2026-10-20', notes: '', createdAt: 1, updatedAt: 1,
      checklistProgress: { completed: 0, total: 0 },
    }] }),
    get: jest.fn(), create: jest.fn(), update: jest.fn(),
    delete: jest.fn().mockResolvedValue(deleteResult),
  } satisfies TripRepository;
}

describe('Trip deletion coordination', () => {
  it('cancels only this Trip scheduled requests before deleting SQLite data', async () => {
    const reminders = new FakeReminderRepository([
      reminder(),
      reminder({ tripId: 2, notificationId: 'trip-2-before-7' }),
    ]);
    const notifications = createNotificationAdapter();
    notifications.listScheduled.mockResolvedValue({ ok: true, value: [
      { identifier: 'trip-1-before-7' },
      { identifier: 'trip-2-before-7' },
    ] });
    const trips = tripRepository();
    const port = createTripDeletionPort({
      tripRepository: trips,
      reminderRepository: reminders,
      notifications,
      queue: createReminderTripQueue(),
    });

    await expect(port.deleteTrip(1)).resolves.toEqual({ ok: true, value: undefined });
    expect(notifications.cancel).toHaveBeenCalledWith('trip-1-before-7');
    expect(notifications.cancel).not.toHaveBeenCalledWith('trip-2-before-7');
    expect(notifications.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      trips.delete.mock.invocationCallOrder[0],
    );
  });

  it('keeps SQLite data when any cancellation fails, including partial cancellation', async () => {
    const reminders = new FakeReminderRepository([
      reminder(),
      reminder({ offsetDays: 1, notificationId: 'trip-1-before-1' }),
    ]);
    const notifications = createNotificationAdapter();
    notifications.listScheduled.mockResolvedValue({ ok: true, value: [
      { identifier: 'trip-1-before-7' }, { identifier: 'trip-1-before-1' },
    ] });
    notifications.cancel
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockResolvedValueOnce({ ok: false, error: { kind: 'scheduling', message: 'fail' } });
    const trips = tripRepository();
    const port = createTripDeletionPort({
      tripRepository: trips, reminderRepository: reminders, notifications,
      queue: createReminderTripQueue(),
    });

    await expect(port.deleteTrip(1)).resolves.toMatchObject({ ok: false });
    expect(trips.delete).not.toHaveBeenCalled();
    expect(reminders.values.size).toBe(2);
  });

  it('does not report success when database deletion fails', async () => {
    const reminders = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    const trips = tripRepository({ ok: false, error: { kind: 'storage', message: 'fail' } });
    const port = createTripDeletionPort({
      tripRepository: trips, reminderRepository: reminders, notifications,
      queue: createReminderTripQueue(),
    });

    await expect(port.deleteTrip(1)).resolves.toEqual({
      ok: false, error: { kind: 'failed' },
    });
  });

  it('does not let delivered history block deletion', async () => {
    const reminders = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    notifications.listScheduled.mockResolvedValue({ ok: true, value: [] });
    const trips = tripRepository();
    const port = createTripDeletionPort({
      tripRepository: trips, reminderRepository: reminders, notifications,
      queue: createReminderTripQueue(),
    });

    await expect(port.deleteTrip(1)).resolves.toMatchObject({ ok: true });
    expect(notifications.cleanupDelivered).not.toHaveBeenCalled();
  });

  it('recovers the cancel-before-delete crash window on next reconciliation', async () => {
    const reminders = new FakeReminderRepository([reminder()]);
    const notifications = createNotificationAdapter();
    notifications.listScheduled.mockResolvedValueOnce({
      ok: true, value: [{ identifier: 'trip-1-before-7' }],
    });
    const trips = tripRepository();
    const queue = createReminderTripQueue();
    const port = createTripDeletionPort({
      tripRepository: trips, reminderRepository: reminders, notifications, queue,
      afterCancellations: () => { throw new Error('simulated crash'); },
    });
    await expect(port.deleteTrip(1)).rejects.toThrow('simulated crash');
    expect(trips.delete).not.toHaveBeenCalled();

    notifications.listScheduled.mockResolvedValue({ ok: true, value: [] });
    const coordinator = createReminderCoordinator({
      ...coordinatorOptions(reminders, notifications), queue,
    });
    const reconciler = createReminderReconciler({
      tripRepository: trips,
      reminderRepository: reminders,
      notifications,
      coordinator,
      now: () => new Date(2026, 9, 1),
    });
    await reconciler.reconcile();

    expect(notifications.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'trip-1-before-7' }),
    );
    expect(reminders.values.get('1:7')?.status).toBe('scheduled');
  });
});
