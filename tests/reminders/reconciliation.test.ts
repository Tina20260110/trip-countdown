import type { TripRepository } from '../../src/contracts/repositories';
import type { TripSummary } from '../../src/domain/types';
import { createReminderCoordinator, createReminderTripQueue } from '../../src/features/reminders/reminder-coordinator';
import { createReminderReconciler } from '../../src/features/reminders/reconciliation';
import {
  coordinatorOptions,
  createNotificationAdapter,
  FakeReminderRepository,
  reminder,
} from './fixtures/coordinator-fakes';

function trip(id = 1): TripSummary {
  return {
    id,
    destination: `Trip ${id}`,
    departureDate: '2026-10-20',
    notes: '',
    createdAt: id,
    updatedAt: id,
    checklistProgress: { completed: 0, total: 0 },
  };
}

function tripRepository(trips: readonly TripSummary[] = [trip()]): TripRepository {
  return {
    list: jest.fn().mockResolvedValue({ ok: true, value: trips }),
    get: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
  };
}

function setup(initial = [reminder()]) {
  const reminders = new FakeReminderRepository(initial);
  const notifications = createNotificationAdapter();
  const queue = createReminderTripQueue();
  const coordinator = createReminderCoordinator({
    ...coordinatorOptions(reminders, notifications),
    queue,
  });
  const reconciler = createReminderReconciler({
    tripRepository: tripRepository(),
    reminderRepository: reminders,
    notifications,
    coordinator,
    now: () => new Date(2026, 9, 1, 8),
  });
  return { reminders, notifications, coordinator, reconciler };
}

describe('Reminder reconciliation', () => {
  it('keeps a scheduled reminder when the matching OS request exists', async () => {
    const context = setup();
    context.notifications.listScheduled.mockResolvedValue({
      ok: true,
      value: [{ identifier: 'trip-1-before-7' }],
    });

    await expect(context.reconciler.reconcile()).resolves.toMatchObject({ ok: true });
    expect(context.notifications.schedule).not.toHaveBeenCalled();
    expect(context.notifications.cancel).not.toHaveBeenCalled();
    expect(context.reminders.values.get('1:7')?.revision).toBe(2);
  });

  it('confirms pending after OS schedule succeeded but DB confirmation failed', async () => {
    const context = setup([
      reminder({ status: 'pending', revision: 1, scheduledAt: null, scheduledTimezone: null }),
    ]);
    context.notifications.listScheduled.mockResolvedValue({
      ok: true,
      value: [{ identifier: 'trip-1-before-7' }],
    });

    await context.reconciler.reconcile();

    expect(context.reminders.values.get('1:7')).toMatchObject({
      status: 'scheduled',
      revision: 2,
    });
    expect(context.notifications.schedule).not.toHaveBeenCalled();
  });

  it('repairs pending intent when the OS request is missing', async () => {
    const context = setup([
      reminder({ status: 'pending', revision: 1, scheduledAt: null, scheduledTimezone: null }),
    ]);

    await context.reconciler.reconcile();

    expect(context.notifications.schedule).toHaveBeenCalledTimes(1);
    expect(context.notifications.requestPermission).not.toHaveBeenCalled();
    expect(context.reminders.values.get('1:7')?.status).toBe('scheduled');
  });

  it('cancels stale disabled and managed orphan requests but preserves unrelated requests', async () => {
    const context = setup([
      reminder({ enabled: false, status: 'disabled', scheduledAt: null }),
    ]);
    context.notifications.listScheduled.mockResolvedValue({
      ok: true,
      value: [
        { identifier: 'trip-1-before-7' },
        { identifier: 'trip-9-before-1' },
        { identifier: 'calendar-from-another-feature' },
      ],
    });

    await context.reconciler.reconcile();

    expect(context.notifications.cancel).toHaveBeenCalledWith('trip-1-before-7');
    expect(context.notifications.cancel).toHaveBeenCalledWith('trip-9-before-1');
    expect(context.notifications.cancel).not.toHaveBeenCalledWith(
      'calendar-from-another-feature',
    );
  });

  it('does not backfill an elapsed reminder and remains idempotent', async () => {
    const context = setup([
      reminder({ status: 'pending', revision: 1, scheduledAt: null }),
    ]);
    const lateCoordinator = createReminderCoordinator({
      ...coordinatorOptions(context.reminders, context.notifications),
      now: () => new Date(2026, 9, 20, 10),
    });
    const late = createReminderReconciler({
      tripRepository: tripRepository(),
      reminderRepository: context.reminders,
      notifications: context.notifications,
      coordinator: lateCoordinator,
      now: () => new Date(2026, 9, 20, 10),
    });

    await late.reconcile();
    const afterFirst = context.reminders.values.get('1:7');
    await late.reconcile();

    expect(context.notifications.schedule).not.toHaveBeenCalled();
    expect(afterFirst).toMatchObject({ status: 'unavailable' });
    expect(context.reminders.values.get('1:7')).toEqual(afterFirst);
  });

  it('reschedules an Android reminder after timezone changes', async () => {
    const context = setup([
      reminder({ scheduledTimezone: 'America/New_York' }),
    ]);
    context.notifications.listScheduled.mockResolvedValue({
      ok: true,
      value: [{ identifier: 'trip-1-before-7' }],
    });

    await context.reconciler.reconcile();

    expect(context.notifications.cancel).toHaveBeenCalledWith('trip-1-before-7');
    expect(context.notifications.schedule).toHaveBeenCalledTimes(1);
    expect(context.reminders.values.get('1:7')?.scheduledTimezone).toBe(
      'Asia/Shanghai',
    );
  });

  it('reports OS list failure without changing persisted intent', async () => {
    const context = setup();
    const before = context.reminders.values.get('1:7');
    context.notifications.listScheduled.mockResolvedValue({
      ok: false,
      error: { kind: 'unavailable', message: '/private Tokyo' },
    });

    await expect(context.reconciler.reconcile()).resolves.toMatchObject({ ok: false });
    expect(context.reminders.values.get('1:7')).toEqual(before);
  });
});
