import type {
  ChecklistItem,
  ChecklistItemInput,
} from '../domain/types';
import { validateChecklistItemInput } from '../domain/validation';
import type { DatabaseConnection } from './database';
import { mapDatabaseError } from './error-mapping';
import { mapChecklistItemRow } from './mappers';
import {
  notFoundError,
  type RepositoryResult,
} from './repository-result';
import {
  getWriteCoordinator,
  runExclusiveTransaction,
} from './transactions';

const LIST_ITEMS_SQL =
  'SELECT * FROM checklist_items WHERE trip_id = ? ORDER BY id ASC';
const GET_ITEM_SQL = 'SELECT * FROM checklist_items WHERE id = ?';
const GET_PARENT_SQL = 'SELECT id FROM trips WHERE id = ?';
const INSERT_ITEM_SQL = `INSERT INTO checklist_items
  (trip_id, title, completed, created_at) VALUES (?, ?, 0, ?)`;
const SET_COMPLETED_SQL =
  'UPDATE checklist_items SET completed = ? WHERE id = ?';
const DELETE_ITEM_SQL = 'DELETE FROM checklist_items WHERE id = ?';

export interface ChecklistRepository {
  list(tripId: number): Promise<RepositoryResult<readonly ChecklistItem[]>>;
  add(
    tripId: number,
    input: ChecklistItemInput,
  ): Promise<RepositoryResult<ChecklistItem>>;
  setCompleted(
    itemId: number,
    completed: boolean,
  ): Promise<RepositoryResult<ChecklistItem>>;
  remove(itemId: number): Promise<RepositoryResult<void>>;
}

interface ChecklistRepositoryOptions {
  now?: () => number;
}

export function createChecklistRepository(
  database: DatabaseConnection,
  { now = Date.now }: ChecklistRepositoryOptions = {},
): ChecklistRepository {
  const writes = getWriteCoordinator(database);

  async function readItem(id: number): Promise<RepositoryResult<ChecklistItem>> {
    const row = await database.getFirstAsync<unknown>(GET_ITEM_SQL, [id]);
    return row === null
      ? { ok: false, error: notFoundError() }
      : mapChecklistItemRow(row);
  }

  return {
    async list(tripId) {
      try {
        const rows = await database.getAllAsync<unknown>(LIST_ITEMS_SQL, [tripId]);
        const items: ChecklistItem[] = [];
        for (const row of rows) {
          const mapped = mapChecklistItemRow(row);
          if (!mapped.ok) return mapped;
          items.push(mapped.value);
        }
        return { ok: true, value: items };
      } catch (error) {
        return { ok: false, error: mapDatabaseError(error, 'read') };
      }
    },

    add(tripId, input) {
      const validated = validateChecklistItemInput(input);
      if (!validated.ok) return Promise.resolve(validated);

      return writes.run(async () => {
        const transaction = await runExclusiveTransaction(
          database,
          async (connection) => {
            const parent = await connection.getFirstAsync<unknown>(
              GET_PARENT_SQL,
              [tripId],
            );
            if (parent === null) return null;
            const result = await connection.runAsync(INSERT_ITEM_SQL, [
              tripId,
              validated.value.title,
              now(),
            ]);
            return result.lastInsertRowId;
          },
        );
        if (!transaction.ok) return transaction;
        if (transaction.value === null) {
          return { ok: false, error: notFoundError() };
        }
        try {
          return await readItem(transaction.value);
        } catch (error) {
          return { ok: false, error: mapDatabaseError(error, 'read') };
        }
      });
    },

    setCompleted(itemId, completed) {
      return writes.run(async () => {
        try {
          const result = await database.runAsync(SET_COMPLETED_SQL, [
            completed ? 1 : 0,
            itemId,
          ]);
          if (result.changes === 0) {
            return { ok: false, error: notFoundError() };
          }
          return await readItem(itemId);
        } catch (error) {
          return { ok: false, error: mapDatabaseError(error, 'write') };
        }
      });
    },

    remove(itemId) {
      return writes.run(async () => {
        try {
          const result = await database.runAsync(DELETE_ITEM_SQL, [itemId]);
          return result.changes === 0
            ? { ok: false, error: notFoundError() }
            : { ok: true, value: undefined };
        } catch (error) {
          return { ok: false, error: mapDatabaseError(error, 'write') };
        }
      });
    },
  };
}
