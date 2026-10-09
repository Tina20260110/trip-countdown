import type { ReminderRepository } from '../../../src/contracts/repositories';
import type { Reminder, ReminderOffset } from '../../../src/domain/types';
import type {
  NotificationAdapter,
  NotificationPermission,
} from '../../../src/features/reminders/notification-adapter';

export function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    tripId: 1,
    offsetDays: 7,
    enabled: true,
    status: 'scheduled',
    revision: 2,
    notificationId: 'trip-1-before-7',
    targetDate: '2026-10-13',
    scheduledAt: new Date(2026, 9, 13, 9).getTime(),
    scheduledTimezone: 'Asia/Shanghai',
    errorCode: null,
    ...overrides,
  };
}

function key(tripId: number, offsetDays: ReminderOffset): string {
  return `${tripId}:${offsetDays}`;
}

export class FakeReminderRepository implements ReminderRepository {
  readonly values = new Map<string, Reminder>();
  readonly calls: string[] = [];
  failNextCreate = false;
  failNextUpdate = false;
  beforeUpdate?: (expectedRevision: number, value: Reminder) => void;

  constructor(initial: readonly Reminder[] = []) {
    initial.forEach((value) => this.values.set(key(value.tripId, value.offsetDays), value));
  }

  async list(tripId: number) {
    this.calls.push(`list:${tripId}`);
    return {
      ok: true as const,
      value: [...this.values.values()].filter((value) => value.tripId === tripId),
    };
  }

  async get(tripId: number, offsetDays: ReminderOffset) {
    this.calls.push(`get:${tripId}:${offsetDays}`);
    const value = this.values.get(key(tripId, offsetDays));
    return value
      ? { ok: true as const, value }
      : {
          ok: false as const,
          error: { kind: 'not-found' as const, message: '旅行不存在' },
        };
  }

  async create(value: Reminder) {
    this.calls.push(`create:${value.status}:${value.revision}`);
    if (this.failNextCreate) {
      this.failNextCreate = false;
      return {
        ok: false as const,
        error: { kind: 'storage' as const, message: '本地数据暂时不可用' },
      };
    }
    this.values.set(key(value.tripId, value.offsetDays), value);
    return { ok: true as const, value };
  }

  async updateIfRevision(expectedRevision: number, value: Reminder) {
    this.calls.push(
      `update:${expectedRevision}:${value.status}:${value.revision}`,
    );
    this.beforeUpdate?.(expectedRevision, value);
    if (this.failNextUpdate) {
      this.failNextUpdate = false;
      return {
        ok: false as const,
        error: { kind: 'storage' as const, message: '本地数据暂时不可用' },
      };
    }
    const current = this.values.get(key(value.tripId, value.offsetDays));
    if (!current || current.revision !== expectedRevision) {
      return {
        ok: false as const,
        error: { kind: 'unavailable' as const, message: '状态已变化' },
      };
    }
    this.values.set(key(value.tripId, value.offsetDays), value);
    return { ok: true as const, value };
  }
}

export function createNotificationAdapter(
  permission: NotificationPermission = {
    status: 'granted',
    canAskAgain: true,
  },
): jest.Mocked<NotificationAdapter> {
  return {
    getPermission: jest.fn().mockResolvedValue({ ok: true, value: permission }),
    requestPermission: jest.fn().mockResolvedValue({ ok: true, value: permission }),
    schedule: jest.fn().mockImplementation(async ({ identifier }) => ({
      ok: true,
      value: identifier,
    })),
    cancel: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    listScheduled: jest.fn().mockResolvedValue({ ok: true, value: [] }),
    cleanupDelivered: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
}

export function coordinatorOptions(
  repository: ReminderRepository,
  notifications: NotificationAdapter,
) {
  return {
    repository,
    notifications,
    platform: 'android' as const,
    now: () => new Date(2026, 9, 1, 8),
    getTimeZone: () => 'Asia/Shanghai',
  };
}
