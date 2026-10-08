import type { Result } from '../domain/types';
import type {
  DatabaseConnection,
  DatabaseTransactionConnection,
} from './database';
import { mapDatabaseError } from './error-mapping';
import type { DataStorageError } from './errors';

export interface WriteCoordinator {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

const coordinators = new WeakMap<DatabaseConnection, WriteCoordinator>();

export function createWriteCoordinator(): WriteCoordinator {
  let tail: Promise<void> = Promise.resolve();

  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation, operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

export function getWriteCoordinator(
  database: DatabaseConnection,
): WriteCoordinator {
  const existing = coordinators.get(database);
  if (existing) return existing;

  const coordinator = createWriteCoordinator();
  coordinators.set(database, coordinator);
  return coordinator;
}

export async function runExclusiveTransaction<T>(
  database: DatabaseConnection,
  operation: (transaction: DatabaseTransactionConnection) => Promise<T>,
): Promise<Result<T, DataStorageError>> {
  let value: T | undefined;
  let completed = false;

  try {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      value = await operation(transaction);
      completed = true;
    });
    if (!completed) {
      return { ok: false, error: mapDatabaseError(undefined, 'write') };
    }
    return { ok: true, value: value as T };
  } catch (error) {
    return { ok: false, error: mapDatabaseError(error, 'write') };
  }
}
