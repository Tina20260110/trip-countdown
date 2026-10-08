import type {
  Reminder,
  ReminderOffset,
} from '../domain/types';
import type { DatabaseConnection } from './database';
import { mapDatabaseError } from './error-mapping';
import { mapReminderRow } from './mappers';
import {
  notFoundError,
  unavailableError,
  type RepositoryResult,
} from './repository-result';
import { getWriteCoordinator } from './transactions';

const LIST_REMINDERS_SQL =
  'SELECT * FROM reminders WHERE trip_id = ? ORDER BY offset_days ASC';
const GET_REMINDER_SQL =
  'SELECT * FROM reminders WHERE trip_id = ? AND offset_days = ?';
const INSERT_REMINDER_SQL = `INSERT INTO reminders
  (trip_id, offset_days, enabled, status, revision, notification_id,
   target_date, scheduled_at, scheduled_timezone, error_code)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const UPDATE_REMINDER_SQL = `UPDATE reminders SET
  enabled = ?, status = ?, revision = ?, notification_id = ?,
  target_date = ?, scheduled_at = ?, scheduled_timezone = ?, error_code = ?
  WHERE trip_id = ? AND offset_days = ? AND revision = ?`;

export interface ReminderRepository {
  list(tripId: number): Promise<RepositoryResult<readonly Reminder[]>>;
  get(
    tripId: number,
    offsetDays: ReminderOffset,
  ): Promise<RepositoryResult<Reminder>>;
  create(reminder: Reminder): Promise<RepositoryResult<Reminder>>;
  updateIfRevision(
    expectedRevision: number,
    reminder: Reminder,
  ): Promise<RepositoryResult<Reminder>>;
}

function toRow(reminder: Reminder): Record<string, unknown> {
  return {
    trip_id: reminder.tripId,
    offset_days: reminder.offsetDays,
    enabled: reminder.enabled ? 1 : 0,
    status: reminder.status,
    revision: reminder.revision,
    notification_id: reminder.notificationId,
    target_date: reminder.targetDate,
    scheduled_at: reminder.scheduledAt,
    scheduled_timezone: reminder.scheduledTimezone,
    error_code: reminder.errorCode,
  };
}

function validateReminder(reminder: Reminder): RepositoryResult<Reminder> {
  return mapReminderRow(toRow(reminder));
}

export function createReminderRepository(
  database: DatabaseConnection,
): ReminderRepository {
  const writes = getWriteCoordinator(database);

  async function read(
    tripId: number,
    offsetDays: ReminderOffset,
  ): Promise<RepositoryResult<Reminder>> {
    const row = await database.getFirstAsync<unknown>(GET_REMINDER_SQL, [
      tripId,
      offsetDays,
    ]);
    return row === null
      ? { ok: false, error: notFoundError() }
      : mapReminderRow(row);
  }

  return {
    async list(tripId) {
      try {
        const rows = await database.getAllAsync<unknown>(LIST_REMINDERS_SQL, [
          tripId,
        ]);
        const reminders: Reminder[] = [];
        for (const row of rows) {
          const mapped = mapReminderRow(row);
          if (!mapped.ok) return mapped;
          reminders.push(mapped.value);
        }
        return { ok: true, value: reminders };
      } catch (error) {
        return { ok: false, error: mapDatabaseError(error, 'read') };
      }
    },

    async get(tripId, offsetDays) {
      try {
        return await read(tripId, offsetDays);
      } catch (error) {
        return { ok: false, error: mapDatabaseError(error, 'read') };
      }
    },

    create(reminder) {
      const validated = validateReminder(reminder);
      if (!validated.ok) return Promise.resolve(validated);
      return writes.run(async () => {
        try {
          await database.runAsync(INSERT_REMINDER_SQL, [
            reminder.tripId,
            reminder.offsetDays,
            reminder.enabled ? 1 : 0,
            reminder.status,
            reminder.revision,
            reminder.notificationId,
            reminder.targetDate,
            reminder.scheduledAt,
            reminder.scheduledTimezone,
            reminder.errorCode,
          ]);
          return await read(reminder.tripId, reminder.offsetDays);
        } catch (error) {
          return { ok: false, error: mapDatabaseError(error, 'write') };
        }
      });
    },

    updateIfRevision(expectedRevision, reminder) {
      const validated = validateReminder(reminder);
      if (!validated.ok) return Promise.resolve(validated);
      if (
        !Number.isInteger(expectedRevision) ||
        expectedRevision < 0 ||
        reminder.revision !== expectedRevision + 1
      ) {
        return Promise.resolve({ ok: false, error: unavailableError() });
      }
      return writes.run(async () => {
        try {
          const result = await database.runAsync(UPDATE_REMINDER_SQL, [
            reminder.enabled ? 1 : 0,
            reminder.status,
            reminder.revision,
            reminder.notificationId,
            reminder.targetDate,
            reminder.scheduledAt,
            reminder.scheduledTimezone,
            reminder.errorCode,
            reminder.tripId,
            reminder.offsetDays,
            expectedRevision,
          ]);
          if (result.changes === 0) {
            return { ok: false, error: unavailableError() };
          }
          return await read(reminder.tripId, reminder.offsetDays);
        } catch (error) {
          return { ok: false, error: mapDatabaseError(error, 'write') };
        }
      });
    },
  };
}
