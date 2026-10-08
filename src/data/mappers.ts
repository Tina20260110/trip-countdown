import { parseDateOnly } from '../domain/date-only';
import type {
  ChecklistItem,
  Reminder,
  ReminderOffset,
  ReminderStatus,
  Result,
  Trip,
} from '../domain/types';
import { storageError, type DataStorageError } from './errors';

type UnknownRecord = Record<string, unknown>;
type MapperResult<T> = Result<T, DataStorageError>;

const REMINDER_STATUSES: ReadonlySet<ReminderStatus> = new Set([
  'disabled',
  'pending',
  'scheduled',
  'permission_denied',
  'unavailable',
  'error',
]);

function corrupt<T>(): MapperResult<T> {
  return { ok: false, error: storageError('corrupt-data') };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}

function isDateOnly(value: unknown): value is string {
  return typeof value === 'string' && parseDateOnly(value).ok;
}

function isNullableDateOnly(value: unknown): value is string | null {
  return value === null || isDateOnly(value);
}

function isReminderStatus(value: unknown): value is ReminderStatus {
  return typeof value === 'string' && REMINDER_STATUSES.has(value as ReminderStatus);
}

function isReminderOffset(value: unknown): value is ReminderOffset {
  return value === 1 || value === 7;
}

export function mapTripRow(row: unknown): MapperResult<Trip> {
  if (
    !isRecord(row) ||
    !isInteger(row.id, 1) ||
    typeof row.destination !== 'string' ||
    !isDateOnly(row.departure_date) ||
    typeof row.notes !== 'string' ||
    !isInteger(row.created_at) ||
    !isInteger(row.updated_at)
  ) {
    return corrupt();
  }

  return {
    ok: true,
    value: {
      id: row.id,
      destination: row.destination,
      departureDate: row.departure_date,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

export function mapChecklistItemRow(row: unknown): MapperResult<ChecklistItem> {
  if (
    !isRecord(row) ||
    !isInteger(row.id, 1) ||
    !isInteger(row.trip_id, 1) ||
    typeof row.title !== 'string' ||
    (row.completed !== 0 && row.completed !== 1) ||
    !isInteger(row.created_at)
  ) {
    return corrupt();
  }

  return {
    ok: true,
    value: {
      id: row.id,
      tripId: row.trip_id,
      title: row.title,
      completed: row.completed === 1,
      createdAt: row.created_at,
    },
  };
}

export function mapReminderRow(row: unknown): MapperResult<Reminder> {
  if (
    !isRecord(row) ||
    !isInteger(row.trip_id, 1) ||
    !isReminderOffset(row.offset_days) ||
    (row.enabled !== 0 && row.enabled !== 1) ||
    !isReminderStatus(row.status) ||
    !isInteger(row.revision) ||
    typeof row.notification_id !== 'string' ||
    !isNullableDateOnly(row.target_date) ||
    !isNullableInteger(row.scheduled_at) ||
    !isNullableString(row.scheduled_timezone) ||
    !isNullableString(row.error_code)
  ) {
    return corrupt();
  }

  return {
    ok: true,
    value: {
      tripId: row.trip_id,
      offsetDays: row.offset_days,
      enabled: row.enabled === 1,
      status: row.status,
      revision: row.revision,
      notificationId: row.notification_id,
      targetDate: row.target_date,
      scheduledAt: row.scheduled_at,
      scheduledTimezone: row.scheduled_timezone,
      errorCode: row.error_code,
    },
  };
}
