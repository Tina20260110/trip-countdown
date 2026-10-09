import type {
  ReminderRepository,
  TripRepository,
} from '../../contracts/repositories';
import { getLocalDateOnly } from '../../domain/date-only';
import type { Result } from '../../domain/types';
import type { NotificationAdapter } from './notification-adapter';
import type {
  ReminderCoordinator,
  ReminderCoordinatorError,
} from './reminder-coordinator';

const MANAGED_IDENTIFIER = /^trip-([1-9]\d*)-before-(1|7)$/;

export interface ReminderReconciler {
  reconcile(): Promise<Result<void, ReminderCoordinatorError>>;
}

interface ReminderReconcilerOptions {
  tripRepository: TripRepository;
  reminderRepository: ReminderRepository;
  notifications: NotificationAdapter;
  coordinator: ReminderCoordinator;
  now?: () => Date;
}

function unavailable(message: string): ReminderCoordinatorError {
  return { kind: 'unavailable', phase: 'read', message };
}

export function createReminderReconciler({
  tripRepository,
  reminderRepository,
  notifications,
  coordinator,
  now = () => new Date(),
}: ReminderReconcilerOptions): ReminderReconciler {
  return {
    async reconcile() {
      const scheduled = await notifications.listScheduled();
      if (!scheduled.ok) {
        return {
          ok: false,
          error: unavailable('无法读取系统提醒，请稍后重试。'),
        };
      }

      const instant = now();
      const trips = await tripRepository.list(getLocalDateOnly(instant).value);
      if (!trips.ok) {
        return { ok: false, error: unavailable('无法读取旅行提醒，请稍后重试。') };
      }

      const scheduledIds = new Set(
        scheduled.value.map(({ identifier }) => identifier),
      );
      const managedIds = new Set<string>();
      let firstError: ReminderCoordinatorError | null = null;

      for (const trip of trips.value) {
        const reminders = await reminderRepository.list(trip.id);
        if (!reminders.ok) {
          firstError ??= unavailable('无法读取旅行提醒，请稍后重试。');
          continue;
        }
        reminders.value.forEach(({ notificationId }) => managedIds.add(notificationId));
        const result = await coordinator.reconcileTrip(
          trip.id,
          trip.departureDate,
          scheduledIds,
        );
        if (!result.ok) firstError ??= result.error;
      }

      for (const { identifier } of scheduled.value) {
        const match = MANAGED_IDENTIFIER.exec(identifier);
        if (!match || managedIds.has(identifier)) continue;
        const result = await coordinator.cancelOrphan(Number(match[1]), identifier);
        if (!result.ok) firstError ??= result.error;
      }

      return firstError
        ? { ok: false, error: firstError }
        : { ok: true, value: undefined };
    },
  };
}
