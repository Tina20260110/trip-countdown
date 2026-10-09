import type {
  ReminderRepository,
  TripRepository,
} from '../../contracts/repositories';
import type { NotificationAdapter } from '../reminders/notification-adapter';
import type { ReminderTripQueue } from '../reminders/reminder-coordinator';

export type TripDeletionError = { kind: 'unavailable' | 'failed' };

export type TripDeletionResult =
  | { ok: true; value: undefined }
  | { ok: false; error: TripDeletionError };

export interface TripDeletionPort {
  deleteTrip(tripId: number): Promise<TripDeletionResult>;
}

export const unavailableTripDeletionPort: TripDeletionPort = {
  async deleteTrip() {
    return { ok: false, error: { kind: 'unavailable' } };
  },
};

interface TripDeletionPortOptions {
  tripRepository: TripRepository;
  reminderRepository: ReminderRepository;
  notifications: NotificationAdapter;
  queue: ReminderTripQueue;
  afterCancellations?: () => void | Promise<void>;
}

export function createTripDeletionPort({
  tripRepository,
  reminderRepository,
  notifications,
  queue,
  afterCancellations,
}: TripDeletionPortOptions): TripDeletionPort {
  return {
    deleteTrip(tripId) {
      return queue.run(tripId, async () => {
        const [reminders, scheduled] = await Promise.all([
          reminderRepository.list(tripId),
          notifications.listScheduled(),
        ]);
        if (!reminders.ok || !scheduled.ok) {
          return { ok: false, error: { kind: 'unavailable' } };
        }

        const scheduledIds = new Set(
          scheduled.value.map(({ identifier }) => identifier),
        );
        for (const reminder of reminders.value) {
          if (!scheduledIds.has(reminder.notificationId)) continue;
          const cancelled = await notifications.cancel(reminder.notificationId);
          if (!cancelled.ok) {
            return { ok: false, error: { kind: 'failed' } };
          }
        }

        await afterCancellations?.();
        const deleted = await tripRepository.delete(tripId);
        return deleted.ok
          ? { ok: true, value: undefined }
          : { ok: false, error: { kind: 'failed' } };
      });
    },
  };
}
