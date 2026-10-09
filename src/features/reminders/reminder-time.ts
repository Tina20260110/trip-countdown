import {
  formatDateOnly,
  parseDateOnly,
  type DateOnly,
  type DateOnlyComponents,
} from '../../domain/date-only';
import type { ReminderOffset, Result } from '../../domain/types';
import type { NotificationTrigger } from './notification-adapter';

export const REMINDER_CHANNEL_ID = 'trip-reminders';

export interface ReminderTime {
  targetDate: DateOnly;
  localHour: 9;
  scheduledAt: number;
  iosTrigger: Extract<NotificationTrigger, { platform: 'ios' }>;
  androidTrigger: Extract<NotificationTrigger, { platform: 'android' }>;
}

export interface ReminderTimeError {
  kind: 'unavailable';
  message: string;
}

export type ReminderTimeResult = Result<ReminderTime, ReminderTimeError>;

function subtractCalendarDays(
  components: DateOnlyComponents,
  days: ReminderOffset,
): DateOnlyComponents {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(components.year, components.month - 1, components.day);
  value.setUTCDate(value.getUTCDate() - days);
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

export function createReminderTime(
  departureDate: string,
  offsetDays: ReminderOffset,
  now: Date = new Date(),
): ReminderTimeResult {
  const departure = parseDateOnly(departureDate);
  if (!departure.ok || Number.isNaN(now.getTime())) {
    return {
      ok: false,
      error: { kind: 'unavailable', message: '无法计算提醒时间。' },
    };
  }

  const targetComponents = subtractCalendarDays(departure.value, offsetDays);
  const targetDate = formatDateOnly(targetComponents);
  if (!targetDate.ok) {
    return {
      ok: false,
      error: { kind: 'unavailable', message: '无法计算提醒时间。' },
    };
  }

  // The numeric instant is built from local calendar components. The date-only
  // value itself is never parsed as a UTC timestamp.
  const localTarget = new Date(
    targetComponents.year,
    targetComponents.month - 1,
    targetComponents.day,
    9,
    0,
    0,
    0,
  );

  if (localTarget.getTime() <= now.getTime()) {
    return {
      ok: false,
      error: {
        kind: 'unavailable',
        message: '提醒时间已过，无法安排提醒。',
      },
    };
  }

  return {
    ok: true,
    value: {
      targetDate: targetDate.value,
      localHour: 9,
      scheduledAt: localTarget.getTime(),
      iosTrigger: {
        platform: 'ios',
        type: 'calendar',
        ...targetComponents,
        hour: 9,
        minute: 0,
        second: 0,
        repeats: false,
      },
      androidTrigger: {
        platform: 'android',
        type: 'date',
        date: localTarget.getTime(),
        channelId: REMINDER_CHANNEL_ID,
        repeats: false,
      },
    },
  };
}
