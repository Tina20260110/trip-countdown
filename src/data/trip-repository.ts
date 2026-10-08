import { parseDateOnly } from '../domain/date-only';
import type {
  CreateTripInput,
  EditTripInput,
  Reminder,
  Trip,
  TripDetail,
  TripSummary,
} from '../domain/types';
import {
  validateCreateTripInput,
  validateEditTripInput,
} from '../domain/validation';
import type { DatabaseConnection } from './database';
import { mapDatabaseError } from './error-mapping';
import { storageError } from './errors';
import {
  mapChecklistItemRow,
  mapReminderRow,
  mapTripRow,
} from './mappers';
import {
  notFoundError,
  type RepositoryResult,
} from './repository-result';
import {
  getWriteCoordinator,
  runExclusiveTransaction,
} from './transactions';

const LIST_TRIPS_SQL = `SELECT
  t.id, t.destination, t.departure_date, t.notes, t.created_at, t.updated_at,
  COUNT(ci.id) AS checklist_total,
  COALESCE(SUM(CASE WHEN ci.completed = 1 THEN 1 ELSE 0 END), 0) AS checklist_completed
FROM trips t
LEFT JOIN checklist_items ci ON ci.trip_id = t.id
GROUP BY t.id
ORDER BY
  CASE WHEN t.departure_date >= ? THEN 0 ELSE 1 END,
  CASE WHEN t.departure_date >= ? THEN t.departure_date END ASC,
  CASE WHEN t.departure_date < ? THEN t.departure_date END DESC,
  t.id ASC`;
const GET_TRIP_SQL = 'SELECT * FROM trips WHERE id = ?';
const GET_CHECKLIST_SQL =
  'SELECT * FROM checklist_items WHERE trip_id = ? ORDER BY id ASC';
const GET_REMINDERS_SQL =
  'SELECT * FROM reminders WHERE trip_id = ? ORDER BY offset_days ASC';
const INSERT_TRIP_SQL = `INSERT INTO trips
  (destination, departure_date, notes, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)`;
const UPDATE_TRIP_SQL = `UPDATE trips
  SET destination = ?, departure_date = ?, notes = ?, updated_at = ?
  WHERE id = ?`;
const DELETE_TRIP_SQL = 'DELETE FROM trips WHERE id = ?';

interface TripSummaryRow extends Record<string, unknown> {
  checklist_total?: unknown;
  checklist_completed?: unknown;
}

export interface TripRepository {
  list(localToday: string): Promise<RepositoryResult<readonly TripSummary[]>>;
  get(id: number): Promise<RepositoryResult<TripDetail>>;
  create(
    input: CreateTripInput,
    localToday: string,
  ): Promise<RepositoryResult<Trip>>;
  update(id: number, input: EditTripInput): Promise<RepositoryResult<Trip>>;
  delete(id: number): Promise<RepositoryResult<void>>;
}

interface TripRepositoryOptions {
  now?: () => number;
}

function mapTripSummaryRow(row: unknown): RepositoryResult<TripSummary> {
  const trip = mapTripRow(row);
  if (!trip.ok) return trip;
  const aggregate = row as TripSummaryRow;
  if (
    typeof aggregate.checklist_total !== 'number' ||
    !Number.isInteger(aggregate.checklist_total) ||
    aggregate.checklist_total < 0 ||
    typeof aggregate.checklist_completed !== 'number' ||
    !Number.isInteger(aggregate.checklist_completed) ||
    aggregate.checklist_completed < 0 ||
    aggregate.checklist_completed > aggregate.checklist_total
  ) {
    return { ok: false, error: storageError('corrupt-data') };
  }
  return {
    ok: true,
    value: {
      ...trip.value,
      checklistProgress: {
        completed: aggregate.checklist_completed,
        total: aggregate.checklist_total,
      },
    },
  };
}

export function createTripRepository(
  database: DatabaseConnection,
  { now = Date.now }: TripRepositoryOptions = {},
): TripRepository {
  const writes = getWriteCoordinator(database);

  async function readTrip(id: number): Promise<RepositoryResult<Trip>> {
    const row = await database.getFirstAsync<unknown>(GET_TRIP_SQL, [id]);
    if (row === null) return { ok: false, error: notFoundError() };
    return mapTripRow(row);
  }

  return {
    async list(localToday) {
      if (!parseDateOnly(localToday).ok) {
        return { ok: false, error: storageError('read-failed') };
      }
      try {
        const rows = await database.getAllAsync<unknown>(LIST_TRIPS_SQL, [
          localToday,
          localToday,
          localToday,
        ]);
        const trips: TripSummary[] = [];
        for (const row of rows) {
          const mapped = mapTripSummaryRow(row);
          if (!mapped.ok) return mapped;
          trips.push(mapped.value);
        }
        return { ok: true, value: trips };
      } catch (error) {
        return { ok: false, error: mapDatabaseError(error, 'read') };
      }
    },

    async get(id) {
      try {
        const trip = await readTrip(id);
        if (!trip.ok) return trip;
        const [checklistRows, reminderRows] = await Promise.all([
          database.getAllAsync<unknown>(GET_CHECKLIST_SQL, [id]),
          database.getAllAsync<unknown>(GET_REMINDERS_SQL, [id]),
        ]);
        const checklistItems = [];
        for (const row of checklistRows) {
          const mapped = mapChecklistItemRow(row);
          if (!mapped.ok) return mapped;
          checklistItems.push(mapped.value);
        }
        const reminders: Reminder[] = [];
        for (const row of reminderRows) {
          const mapped = mapReminderRow(row);
          if (!mapped.ok) return mapped;
          reminders.push(mapped.value);
        }
        return {
          ok: true,
          value: { ...trip.value, checklistItems, reminders },
        };
      } catch (error) {
        return { ok: false, error: mapDatabaseError(error, 'read') };
      }
    },

    create(input, localToday) {
      const validated = validateCreateTripInput(input, localToday);
      if (!validated.ok) return Promise.resolve(validated);
      return writes.run(async () => {
        try {
          const timestamp = now();
          const result = await database.runAsync(INSERT_TRIP_SQL, [
            validated.value.destination,
            validated.value.departureDate,
            validated.value.notes,
            timestamp,
            timestamp,
          ]);
          return await readTrip(result.lastInsertRowId);
        } catch (error) {
          return { ok: false, error: mapDatabaseError(error, 'write') };
        }
      });
    },

    update(id, input) {
      const validated = validateEditTripInput(input);
      if (!validated.ok) return Promise.resolve(validated);
      return writes.run(async () => {
        try {
          const result = await database.runAsync(UPDATE_TRIP_SQL, [
            validated.value.destination,
            validated.value.departureDate,
            validated.value.notes,
            now(),
            id,
          ]);
          if (result.changes === 0) return { ok: false, error: notFoundError() };
          return await readTrip(id);
        } catch (error) {
          return { ok: false, error: mapDatabaseError(error, 'write') };
        }
      });
    },

    delete(id) {
      return writes.run(async () => {
        const transaction = await runExclusiveTransaction(
          database,
          async (connection) =>
            (await connection.runAsync(DELETE_TRIP_SQL, [id])).changes,
        );
        if (!transaction.ok) return transaction;
        return transaction.value === 0
          ? { ok: false, error: notFoundError() }
          : { ok: true, value: undefined };
      });
    },
  };
}
