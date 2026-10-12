import type { Reminder } from '../../../src/domain/types';
import { createChecklistRepository } from '../../../src/data/checklist-repository';
import { createDatabaseInitializer } from '../../../src/data/database';
import {
  createExpoSqliteDriver,
  type CloseableDatabaseConnection,
} from '../../../src/data/expo-sqlite-adapter';
import { migrateDatabase } from '../../../src/data/migrations';
import { createReminderRepository } from '../../../src/data/reminder-repository';
import { createTripRepository } from '../../../src/data/trip-repository';
import { runExclusiveTransaction } from '../../../src/data/transactions';
import {
  runChecklistSqliteContract,
  type ChecklistSqliteContractEvidence,
} from './checklist-contract';

export interface SqliteContractEvidence {
  databaseName: string;
  userVersion: number;
  journalMode: string;
  foreignKeys: number;
  transactionForeignKeys: number;
  illegalForeignKeyRejected: boolean;
  reopenRead: boolean;
  cascade: boolean;
  rollback: boolean;
  futureVersionRejected: boolean;
  checklist: ChecklistSqliteContractEvidence;
}

interface PragmaRow {
  user_version?: number;
  journal_mode?: string;
  foreign_keys?: number;
}

function assertContract(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SQLite contract failed: ${message}`);
}

function createInitializer(directory: string, databaseName: string) {
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

/**
 * Runs only inside an Android/iOS development build with a private directory
 * already prepared by the platform boundary. It is intentionally not a Jest test.
 */
export async function runExpoSqliteContract(
  privateDirectory: string,
  runId = Date.now().toString(),
): Promise<SqliteContractEvidence> {
  const databaseName = `trip-countdown-contract-${runId}.db`;
  const initialized = await createInitializer(
    privateDirectory,
    databaseName,
  ).initialize();
  assertContract(initialized.ok, 'v0 to v1 initialization');
  const connection = initialized.value as CloseableDatabaseConnection;

  const version = await connection.getFirstAsync<PragmaRow>(
    'PRAGMA user_version',
  );
  const journal = await connection.getFirstAsync<PragmaRow>(
    'PRAGMA journal_mode',
  );
  const foreignKeys = await connection.getFirstAsync<PragmaRow>(
    'PRAGMA foreign_keys',
  );
  assertContract(version?.user_version === 1, 'user_version is 1');
  assertContract(journal?.journal_mode?.toLowerCase() === 'wal', 'WAL enabled');
  assertContract(foreignKeys?.foreign_keys === 1, 'foreign keys enabled');

  const transactionForeignKeysResult = await runExclusiveTransaction(
    connection,
    async (transaction) =>
      (
        await transaction.getFirstAsync<PragmaRow>('PRAGMA foreign_keys')
      )?.foreign_keys ?? 0,
  );
  assertContract(
    transactionForeignKeysResult.ok && transactionForeignKeysResult.value === 1,
    'transaction foreign keys enabled',
  );
  const illegalForeignKey = await runExclusiveTransaction(
    connection,
    async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO checklist_items
          (trip_id, title, completed, created_at) VALUES (?, ?, 0, ?)`,
        [999_999_999, '非法外键', 0],
      );
    },
  );
  const illegalForeignKeyRejected = !illegalForeignKey.ok;
  assertContract(illegalForeignKeyRejected, 'illegal foreign key rejected');

  const trips = createTripRepository(connection, { now: () => 1 });
  const created = await trips.create(
    { destination: '契约测试', departureDate: '2099-01-10', notes: '' },
    '2099-01-01',
  );
  assertContract(created.ok, 'Trip write');
  const tripId = created.value.id;
  const checklist = createChecklistRepository(connection, { now: () => 2 });
  const item = await checklist.add(tripId, { title: '护照' });
  assertContract(item.ok, 'Checklist write');
  const reminder: Reminder = {
    tripId,
    offsetDays: 7,
    enabled: true,
    status: 'pending',
    revision: 1,
    notificationId: `contract-${runId}`,
    targetDate: '2099-01-03',
    scheduledAt: null,
    scheduledTimezone: null,
    errorCode: null,
  };
  const reminderSaved = await createReminderRepository(connection).create(
    reminder,
  );
  assertContract(reminderSaved.ok, 'Reminder write');

  const beforeRollback = await connection.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM trips',
  );
  const rollbackResult = await runExclusiveTransaction(
    connection,
    async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO trips
          (destination, departure_date, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)`,
        ['回滚测试', '2099-02-01', '', 3, 3],
      );
      throw new Error('intentional contract rollback');
    },
  );
  const afterRollback = await connection.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM trips',
  );
  const rollback =
    !rollbackResult.ok && beforeRollback?.total === afterRollback?.total;
  assertContract(rollback, 'exclusive transaction rollback');

  await connection.closeAsync();
  const reopened = await createInitializer(
    privateDirectory,
    databaseName,
  ).initialize();
  assertContract(reopened.ok, 'close and reopen');
  const reopenedConnection = reopened.value as CloseableDatabaseConnection;
  const reopenRead = (await createTripRepository(reopenedConnection).get(tripId)).ok;
  assertContract(reopenRead, 'read after reopen');
  const deleted = await createTripRepository(reopenedConnection).delete(tripId);
  assertContract(deleted.ok, 'Trip delete');
  const childCounts = await Promise.all([
    reopenedConnection.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM checklist_items WHERE trip_id = ?',
      [tripId],
    ),
    reopenedConnection.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM reminders WHERE trip_id = ?',
      [tripId],
    ),
  ]);
  const cascade = childCounts.every((row) => row?.total === 0);
  assertContract(cascade, 'foreign-key cascade');
  await reopenedConnection.closeAsync();

  const futureName = `trip-countdown-future-${runId}.db`;
  const futureSeed = await createExpoSqliteDriver().openDatabase(
    privateDirectory,
    futureName,
  );
  await futureSeed.execAsync('PRAGMA user_version = 2');
  await (futureSeed as CloseableDatabaseConnection).closeAsync();
  const future = await createInitializer(privateDirectory, futureName).initialize();
  const futureVersionRejected =
    !future.ok && future.error.code === 'unsupported-schema-version';
  assertContract(futureVersionRejected, 'future schema version rejection');
  const checklistEvidence = await runChecklistSqliteContract(
    privateDirectory,
    runId,
  );

  return {
    databaseName,
    userVersion: version.user_version ?? 0,
    journalMode: journal.journal_mode ?? '',
    foreignKeys: foreignKeys.foreign_keys ?? 0,
    transactionForeignKeys: transactionForeignKeysResult.value,
    illegalForeignKeyRejected,
    reopenRead,
    cascade,
    rollback,
    futureVersionRejected,
    checklist: checklistEvidence,
  };
}
