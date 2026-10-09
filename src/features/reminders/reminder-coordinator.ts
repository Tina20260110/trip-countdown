import type { ReminderRepository } from '../../contracts/repositories';
import type {
  Reminder,
  ReminderOffset,
  ReminderStatus,
  Result,
} from '../../domain/types';
import type {
  NotificationAdapter,
  NotificationAdapterError,
} from './notification-adapter';
import { enableReminderPermission, observeReminderPermission } from './permission';
import { createReminderTime } from './reminder-time';

export interface EnableReminderInput {
  tripId: number;
  offsetDays: ReminderOffset;
  departureDate: string;
}

export interface ReminderCoordinatorError {
  kind:
    | 'storage'
    | 'unavailable'
    | 'permission-denied'
    | 'scheduling'
    | 'confirmation-failed';
  phase:
    | 'read'
    | 'persist-intent'
    | 'permission'
    | 'cancel'
    | 'schedule'
    | 'confirm';
  message: string;
}

export type ReminderCoordinatorResult<T> = Result<
  T,
  ReminderCoordinatorError
>;

export interface ReminderCoordinator {
  enable(input: EnableReminderInput): Promise<ReminderCoordinatorResult<Reminder>>;
  disable(
    tripId: number,
    offsetDays: ReminderOffset,
  ): Promise<ReminderCoordinatorResult<Reminder>>;
  rescheduleForTrip(
    tripId: number,
    departureDate: string,
  ): Promise<ReminderCoordinatorResult<readonly Reminder[]>>;
  reconcileTrip(
    tripId: number,
    departureDate: string,
    scheduledIds: ReadonlySet<string>,
  ): Promise<ReminderCoordinatorResult<readonly Reminder[]>>;
  cancelOrphan(tripId: number, identifier: string): Promise<ReminderCoordinatorResult<void>>;
}

export interface ReminderTripQueue {
  run<T>(tripId: number, operation: () => Promise<T>): Promise<T>;
}

export function createReminderTripQueue(): ReminderTripQueue {
  const queues = new Map<number, Promise<void>>();
  return {
    run<T>(tripId: number, operation: () => Promise<T>): Promise<T> {
      const previous = queues.get(tripId) ?? Promise.resolve();
      const result = previous.then(operation, operation);
      const tail = result.then(() => undefined, () => undefined);
      queues.set(tripId, tail);
      void tail.finally(() => {
        if (queues.get(tripId) === tail) queues.delete(tripId);
      });
      return result;
    },
  };
}

export interface ReminderCoordinatorOptions {
  repository: ReminderRepository;
  notifications: NotificationAdapter;
  platform: 'ios' | 'android';
  now?: () => Date;
  getTimeZone?: () => string;
  queue?: ReminderTripQueue;
}

function stableNotificationId(
  tripId: number,
  offsetDays: ReminderOffset,
): string {
  return `trip-${tripId}-before-${offsetDays}`;
}

function coordinatorError(
  kind: ReminderCoordinatorError['kind'],
  phase: ReminderCoordinatorError['phase'],
  message: string,
): ReminderCoordinatorError {
  return { kind, phase, message };
}

function adapterError(
  error: NotificationAdapterError,
  phase: 'permission' | 'cancel' | 'schedule',
): ReminderCoordinatorError {
  return coordinatorError(
    error.kind === 'permission-denied'
      ? 'permission-denied'
      : error.kind === 'unavailable'
        ? 'unavailable'
        : 'scheduling',
    phase,
    phase === 'cancel'
      ? '提醒取消失败，请重试。'
      : phase === 'schedule'
        ? '提醒安排失败，请重试。'
        : '无法确认通知权限，请重试。',
  );
}

function repositoryError(
  phase: 'read' | 'persist-intent' | 'confirm',
): ReminderCoordinatorError {
  return coordinatorError(
    phase === 'confirm' ? 'confirmation-failed' : 'storage',
    phase,
    phase === 'confirm'
      ? '提醒操作结果未能写入本地状态，请稍后重试。'
      : '提醒状态保存失败，请重试。',
  );
}

function nextReminder(
  current: Reminder,
  patch: Partial<Omit<Reminder, 'tripId' | 'offsetDays' | 'notificationId'>>,
): Reminder {
  return { ...current, ...patch, revision: current.revision + 1 };
}

export function createReminderCoordinator({
  repository,
  notifications,
  platform,
  now = () => new Date(),
  getTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  queue = createReminderTripQueue(),
}: ReminderCoordinatorOptions): ReminderCoordinator {
  function forTrip<T>(tripId: number, operation: () => Promise<T>): Promise<T> {
    return queue.run(tripId, operation);
  }

  async function readCurrent(
    tripId: number,
    offsetDays: ReminderOffset,
  ): Promise<ReminderCoordinatorResult<Reminder | null>> {
    const result = await repository.get(tripId, offsetDays);
    if (result.ok) return { ok: true, value: result.value };
    if (result.error.kind === 'not-found') return { ok: true, value: null };
    return { ok: false, error: repositoryError('read') };
  }

  async function persistIntent(
    current: Reminder | null,
    input: EnableReminderInput,
  ): Promise<ReminderCoordinatorResult<Reminder>> {
    const calculated = createReminderTime(
      input.departureDate,
      input.offsetDays,
      now(),
    );
    const pending: Reminder = current
      ? nextReminder(current, {
          enabled: true,
          status: 'pending',
          targetDate: calculated.ok ? calculated.value.targetDate : null,
          scheduledAt: null,
          scheduledTimezone: null,
          errorCode: null,
        })
      : {
          tripId: input.tripId,
          offsetDays: input.offsetDays,
          enabled: true,
          status: 'pending',
          revision: 1,
          notificationId: stableNotificationId(input.tripId, input.offsetDays),
          targetDate: calculated.ok ? calculated.value.targetDate : null,
          scheduledAt: null,
          scheduledTimezone: null,
          errorCode: null,
        };
    const result = current
      ? await repository.updateIfRevision(current.revision, pending)
      : await repository.create(pending);
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, error: repositoryError('persist-intent') };
  }

  async function confirm(
    current: Reminder,
    status: ReminderStatus,
    patch: Partial<Reminder>,
  ): Promise<ReminderCoordinatorResult<Reminder>> {
    const value = nextReminder(current, { ...patch, status });
    const result = await repository.updateIfRevision(current.revision, value);
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, error: repositoryError('confirm') };
  }

  async function recordFailure(
    pending: Reminder,
    status: Extract<ReminderStatus, 'error' | 'unavailable' | 'permission_denied'>,
    errorCode: string,
    error: ReminderCoordinatorError,
    enabled = pending.enabled,
  ): Promise<ReminderCoordinatorResult<Reminder>> {
    const recorded = await confirm(pending, status, {
      enabled,
      scheduledAt: null,
      scheduledTimezone: null,
      errorCode,
    });
    return recorded.ok ? { ok: false, error } : recorded;
  }

  async function enableNow(
    input: EnableReminderInput,
  ): Promise<ReminderCoordinatorResult<Reminder>> {
    const currentResult = await readCurrent(input.tripId, input.offsetDays);
    if (!currentResult.ok) return currentResult;
    const wasEnabled = currentResult.value?.enabled ?? false;

    const pendingResult = await persistIntent(currentResult.value, input);
    if (!pendingResult.ok) return pendingResult;
    const pending = pendingResult.value;

    const cancelled = await notifications.cancel(pending.notificationId);
    if (!cancelled.ok) {
      return recordFailure(
        pending,
        'error',
        'cancel-failed',
        adapterError(cancelled.error, 'cancel'),
      );
    }

    const calculated = createReminderTime(
      input.departureDate,
      input.offsetDays,
      now(),
    );
    if (!calculated.ok) {
      return recordFailure(
        pending,
        'unavailable',
        'target-in-past',
        coordinatorError('unavailable', 'schedule', calculated.error.message),
      );
    }

    const permission = await enableReminderPermission(notifications);
    if (!permission.ok) {
      return recordFailure(
        pending,
        'error',
        'permission-check-failed',
        adapterError(permission.error, 'permission'),
      );
    }
    if (permission.value.status !== 'granted') {
      return recordFailure(
        pending,
        'permission_denied',
        'permission-denied',
        coordinatorError(
          'permission-denied',
          'permission',
          permission.value.message,
        ),
        wasEnabled,
      );
    }

    const scheduled = await notifications.schedule({
      identifier: pending.notificationId,
      trigger:
        platform === 'ios'
          ? calculated.value.iosTrigger
          : calculated.value.androidTrigger,
    });
    if (!scheduled.ok) {
      const status = scheduled.error.kind === 'unavailable' ? 'unavailable' : 'error';
      return recordFailure(
        pending,
        status,
        status === 'unavailable' ? 'schedule-unavailable' : 'schedule-failed',
        adapterError(scheduled.error, 'schedule'),
      );
    }

    return confirm(pending, 'scheduled', {
      enabled: true,
      targetDate: calculated.value.targetDate,
      scheduledAt: calculated.value.scheduledAt,
      scheduledTimezone: getTimeZone(),
      errorCode: null,
    });
  }

  async function disableNow(
    tripId: number,
    offsetDays: ReminderOffset,
  ): Promise<ReminderCoordinatorResult<Reminder>> {
    const currentResult = await readCurrent(tripId, offsetDays);
    if (!currentResult.ok) return currentResult;
    const current = currentResult.value;
    if (!current) {
      return {
        ok: false,
        error: coordinatorError('unavailable', 'read', '该提醒尚未启用。'),
      };
    }
    if (!current.enabled && current.status === 'disabled') {
      return { ok: true, value: current };
    }

    const pending = nextReminder(current, {
      enabled: false,
      status: 'pending',
      errorCode: null,
    });
    const persisted = await repository.updateIfRevision(current.revision, pending);
    if (!persisted.ok) {
      return { ok: false, error: repositoryError('persist-intent') };
    }

    const cancelled = await notifications.cancel(pending.notificationId);
    if (!cancelled.ok) {
      return recordFailure(
        pending,
        'error',
        'cancel-failed',
        adapterError(cancelled.error, 'cancel'),
        false,
      );
    }

    return confirm(pending, 'disabled', {
      enabled: false,
      targetDate: null,
      scheduledAt: null,
      scheduledTimezone: null,
      errorCode: null,
    });
  }

  async function rescheduleOne(
    current: Reminder,
    departureDate: string,
  ): Promise<ReminderCoordinatorResult<Reminder>> {
    const calculated = createReminderTime(
      departureDate,
      current.offsetDays,
      now(),
    );
    const pending = nextReminder(current, {
      enabled: true,
      status: 'pending',
      targetDate: calculated.ok ? calculated.value.targetDate : null,
      scheduledAt: null,
      scheduledTimezone: null,
      errorCode: null,
    });
    const persisted = await repository.updateIfRevision(current.revision, pending);
    if (!persisted.ok) {
      return { ok: false, error: repositoryError('persist-intent') };
    }

    const cancelled = await notifications.cancel(pending.notificationId);
    if (!cancelled.ok) {
      return recordFailure(
        pending,
        'error',
        'cancel-failed',
        adapterError(cancelled.error, 'cancel'),
      );
    }

    if (!calculated.ok) {
      return recordFailure(
        pending,
        'unavailable',
        'target-in-past',
        coordinatorError('unavailable', 'schedule', calculated.error.message),
      );
    }

    // Date edits are ordinary Trip operations, so they may observe permission
    // but must never display a permission prompt.
    const permission = await observeReminderPermission(notifications);
    if (!permission.ok) {
      return recordFailure(
        pending,
        'error',
        'permission-check-failed',
        adapterError(permission.error, 'permission'),
      );
    }
    if (permission.value.status !== 'granted') {
      return recordFailure(
        pending,
        'permission_denied',
        'permission-denied',
        coordinatorError(
          'permission-denied',
          'permission',
          permission.value.message,
        ),
      );
    }

    const scheduled = await notifications.schedule({
      identifier: pending.notificationId,
      trigger:
        platform === 'ios'
          ? calculated.value.iosTrigger
          : calculated.value.androidTrigger,
    });
    if (!scheduled.ok) {
      const status = scheduled.error.kind === 'unavailable' ? 'unavailable' : 'error';
      return recordFailure(
        pending,
        status,
        status === 'unavailable' ? 'schedule-unavailable' : 'schedule-failed',
        adapterError(scheduled.error, 'schedule'),
      );
    }

    return confirm(pending, 'scheduled', {
      enabled: true,
      targetDate: calculated.value.targetDate,
      scheduledAt: calculated.value.scheduledAt,
      scheduledTimezone: getTimeZone(),
      errorCode: null,
    });
  }

  async function rescheduleNow(
    tripId: number,
    departureDate: string,
  ): Promise<ReminderCoordinatorResult<readonly Reminder[]>> {
    const listed = await repository.list(tripId);
    if (!listed.ok) {
      return { ok: false, error: repositoryError('read') };
    }

    const updated: Reminder[] = [];
    let firstError: ReminderCoordinatorError | null = null;
    for (const reminder of listed.value) {
      if (!reminder.enabled) continue;
      const result = await rescheduleOne(reminder, departureDate);
      if (result.ok) updated.push(result.value);
      else firstError ??= result.error;
    }

    return firstError
      ? { ok: false, error: firstError }
      : { ok: true, value: updated };
  }

  async function reconcileNow(
    tripId: number,
    departureDate: string,
    scheduledIds: ReadonlySet<string>,
  ): Promise<ReminderCoordinatorResult<readonly Reminder[]>> {
    const listed = await repository.list(tripId);
    if (!listed.ok) return { ok: false, error: repositoryError('read') };
    const values: Reminder[] = [];
    let firstError: ReminderCoordinatorError | null = null;
    const timezone = getTimeZone();

    for (const value of listed.value) {
      const exists = scheduledIds.has(value.notificationId);
      if (!value.enabled || value.status === 'disabled') {
        if (exists) {
          const cancelled = await notifications.cancel(value.notificationId);
          if (!cancelled.ok) firstError ??= adapterError(cancelled.error, 'cancel');
        }
        values.push(value);
        continue;
      }
      if (value.status !== 'pending' && value.status !== 'scheduled') {
        values.push(value);
        continue;
      }

      const calculated = createReminderTime(departureDate, value.offsetDays, now());
      if (!calculated.ok) {
        if (exists) {
          const cancelled = await notifications.cancel(value.notificationId);
          if (!cancelled.ok) {
            firstError ??= adapterError(cancelled.error, 'cancel');
            values.push(value);
            continue;
          }
        }
        const unavailable = await confirm(value, 'unavailable', {
          enabled: true,
          targetDate: null,
          scheduledAt: null,
          scheduledTimezone: null,
          errorCode: 'target-in-past',
        });
        if (unavailable.ok) values.push(unavailable.value);
        else firstError ??= unavailable.error;
        continue;
      }

      if (value.status === 'pending' && exists) {
        const confirmed = await confirm(value, 'scheduled', {
          enabled: true,
          targetDate: calculated.value.targetDate,
          scheduledAt: calculated.value.scheduledAt,
          scheduledTimezone: timezone,
          errorCode: null,
        });
        if (confirmed.ok) values.push(confirmed.value);
        else firstError ??= confirmed.error;
        continue;
      }

      const timezoneChanged =
        platform === 'android' &&
        value.status === 'scheduled' &&
        value.scheduledTimezone !== timezone;
      if (
        (value.status === 'pending' && !exists) ||
        (value.status === 'scheduled' && (!exists || timezoneChanged))
      ) {
        const repaired = await rescheduleOne(value, departureDate);
        if (repaired.ok) values.push(repaired.value);
        else firstError ??= repaired.error;
      } else {
        values.push(value);
      }
    }

    return firstError ? { ok: false, error: firstError } : { ok: true, value: values };
  }

  return {
    enable(input) {
      return forTrip(input.tripId, () => enableNow(input));
    },

    disable(tripId, offsetDays) {
      return forTrip(tripId, () => disableNow(tripId, offsetDays));
    },

    rescheduleForTrip(tripId, departureDate) {
      return forTrip(tripId, () => rescheduleNow(tripId, departureDate));
    },
    reconcileTrip(tripId, departureDate, scheduledIds) {
      return forTrip(tripId, () => reconcileNow(tripId, departureDate, scheduledIds));
    },
    cancelOrphan(tripId, identifier) {
      return forTrip(tripId, async () => {
        const result = await notifications.cancel(identifier);
        return result.ok
          ? { ok: true, value: undefined }
          : { ok: false, error: adapterError(result.error, 'cancel') };
      });
    },
  };
}
