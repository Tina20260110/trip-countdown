import { createChecklistRepository } from '../../../src/data/checklist-repository';
import { createDatabaseInitializer } from '../../../src/data/database';
import {
  createExpoSqliteDriver,
  type CloseableDatabaseConnection,
} from '../../../src/data/expo-sqlite-adapter';
import { migrateDatabase } from '../../../src/data/migrations';
import { createTripRepository } from '../../../src/data/trip-repository';
import { runExclusiveTransaction } from '../../../src/data/transactions';

export interface ChecklistSqliteContractEvidence {
  databaseName: string;
  persistenceAfterReopen: boolean;
  completedAfterReopen: boolean;
  cascadeRemovedTripA: boolean;
  tripBUnaffected: boolean;
  isolationAfterReopen: boolean;
  rollbackPreservedData: boolean;
}

function assertContract(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Checklist SQLite contract failed: ${message}`);
}

function initializer(directory: string, databaseName: string) {
  return createDatabaseInitializer({
    privateStorage: {
      async preparePrivateStorage() {
        return { ok: true, value: { directory } };
      },
    },
    driver: createExpoSqliteDriver(),
    migrate: migrateDatabase,
    databaseName,
  });
}

async function open(directory: string, databaseName: string) {
  const result = await initializer(directory, databaseName).initialize();
  assertContract(result.ok, 'database initialization');
  return result.value as CloseableDatabaseConnection;
}

/**
 * Runs only with the real expo-sqlite native adapter in an Android/iOS
 * development build. The supplied directory must come from the platform
 * private-storage boundary; this entry never falls back to a default path.
 */
export async function runChecklistSqliteContract(
  privateDirectory: string,
  runId = Date.now().toString(),
): Promise<ChecklistSqliteContractEvidence> {
  const databaseName = `trip-countdown-checklist-contract-${runId}.db`;
  let connection = await open(privateDirectory, databaseName);
  let trips = createTripRepository(connection, { now: () => 1 });
  let checklist = createChecklistRepository(connection, { now: () => 2 });

  const persistedTrip = await trips.create(
    { destination: '持久化测试', departureDate: '2099-01-10', notes: '' },
    '2099-01-01',
  );
  assertContract(persistedTrip.ok, 'create persistence Trip');
  const persistedItem = await checklist.add(persistedTrip.value.id, { title: '护照' });
  assertContract(persistedItem.ok, 'add persistence item');
  const completed = await checklist.setCompleted(persistedItem.value.id, true);
  assertContract(completed.ok, 'complete persistence item');

  await connection.closeAsync();
  connection = await open(privateDirectory, databaseName);
  trips = createTripRepository(connection, { now: () => 3 });
  checklist = createChecklistRepository(connection, { now: () => 4 });
  const persistedItems = await checklist.list(persistedTrip.value.id);
  const persistenceAfterReopen =
    persistedItems.ok && persistedItems.value.length === 1 && persistedItems.value[0]?.title === '护照';
  const completedAfterReopen =
    persistedItems.ok && persistedItems.value[0]?.completed === true;
  assertContract(persistenceAfterReopen, 'item persists after close/reopen');
  assertContract(completedAfterReopen, 'completed state persists after close/reopen');

  const tripA = await trips.create(
    { destination: '隔离 A', departureDate: '2099-02-10', notes: '' },
    '2099-01-01',
  );
  const tripB = await trips.create(
    { destination: '隔离 B', departureDate: '2099-03-10', notes: '' },
    '2099-01-01',
  );
  assertContract(tripA.ok && tripB.ok, 'create isolated Trips');
  const itemA1 = await checklist.add(tripA.value.id, { title: 'A 护照' });
  const itemA2 = await checklist.add(tripA.value.id, { title: 'A 签证' });
  const itemB = await checklist.add(tripB.value.id, { title: 'B 充电器' });
  assertContract(itemA1.ok && itemA2.ok && itemB.ok, 'add isolated items');
  assertContract((await checklist.setCompleted(itemA1.value.id, true)).ok, 'update Trip A item');
  assertContract((await checklist.remove(itemA2.value.id)).ok, 'delete Trip A item');

  const rollback = await runExclusiveTransaction(connection, async (transaction) => {
    await transaction.runAsync(
      'UPDATE checklist_items SET completed = 0 WHERE id = ?',
      [itemA1.value.id],
    );
    throw new Error('intentional checklist contract rollback');
  });
  const afterFailure = await checklist.list(tripA.value.id);
  const rollbackPreservedData =
    !rollback.ok && afterFailure.ok && afterFailure.value[0]?.completed === true;
  assertContract(rollbackPreservedData, 'failed transaction preserves prior Checklist state');

  const beforeReopenB = await checklist.list(tripB.value.id);
  assertContract(
    beforeReopenB.ok && beforeReopenB.value.length === 1 && beforeReopenB.value[0]?.title === 'B 充电器',
    'Trip B unaffected before reopen',
  );
  await connection.closeAsync();
  connection = await open(privateDirectory, databaseName);
  trips = createTripRepository(connection);
  checklist = createChecklistRepository(connection);
  const reopenedA = await checklist.list(tripA.value.id);
  const reopenedB = await checklist.list(tripB.value.id);
  const isolationAfterReopen =
    reopenedA.ok && reopenedA.value.length === 1 && reopenedA.value[0]?.completed === true &&
    reopenedB.ok && reopenedB.value.length === 1 && reopenedB.value[0]?.title === 'B 充电器';
  assertContract(isolationAfterReopen, 'Trip isolation persists after reopen');

  assertContract((await trips.delete(tripA.value.id)).ok, 'delete Trip A for cascade');
  const afterCascadeA = await checklist.list(tripA.value.id);
  const afterCascadeB = await checklist.list(tripB.value.id);
  const cascadeRemovedTripA = afterCascadeA.ok && afterCascadeA.value.length === 0;
  const tripBUnaffected =
    afterCascadeB.ok && afterCascadeB.value.length === 1 && afterCascadeB.value[0]?.title === 'B 充电器';
  assertContract(cascadeRemovedTripA, 'Trip A Checklist cascade');
  assertContract(tripBUnaffected, 'Trip B survives Trip A cascade');
  await connection.closeAsync();

  return {
    databaseName,
    persistenceAfterReopen,
    completedAfterReopen,
    cascadeRemovedTripA,
    tripBUnaffected,
    isolationAfterReopen,
    rollbackPreservedData,
  };
}
