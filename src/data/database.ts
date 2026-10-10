import type { Result } from '../domain/types';
import {
  migrationError,
  storageError,
  type DatabaseInitializationError,
  type DataMigrationError,
} from './errors';
import type {
  DatabaseInitializationState,
  PreparePrivateStoragePort,
} from './private-storage';

export interface DatabaseTransactionConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: readonly SqlBindValue[],
  ): Promise<DatabaseRunResult>;
  getFirstAsync<T>(
    sql: string,
    params?: readonly SqlBindValue[],
  ): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: readonly SqlBindValue[]): Promise<T[]>;
}

export interface DatabaseConnection extends DatabaseTransactionConnection {
  withExclusiveTransactionAsync(
    task: (transaction: DatabaseTransactionConnection) => Promise<void>,
  ): Promise<void>;
  closeAsync?(): Promise<void>;
}

export type SqlBindValue = string | number | null;

export interface DatabaseRunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface DatabaseDriver {
  openDatabase(directory: string, name: string): Promise<DatabaseConnection>;
}

export type MigrationRunner = (
  connection: DatabaseConnection,
) => Promise<Result<void, DataMigrationError>>;

interface DatabaseInitializerOptions {
  privateStorage: PreparePrivateStoragePort;
  driver: DatabaseDriver;
  migrate: MigrationRunner;
  databaseName?: string;
}

export interface DatabaseInitializer {
  initialize(): Promise<
    Result<DatabaseConnection, DatabaseInitializationError>
  >;
  getState(): DatabaseInitializationState<DatabaseConnection>;
}

export function createDatabaseInitializer({
  privateStorage,
  driver,
  migrate,
  databaseName = 'trip-countdown.db',
}: DatabaseInitializerOptions): DatabaseInitializer {
  let state: DatabaseInitializationState<DatabaseConnection> = {
    status: 'idle',
  };
  let inFlight: Promise<
    Result<DatabaseConnection, DatabaseInitializationError>
  > | null = null;
  let ready: Result<DatabaseConnection, DatabaseInitializationError> | null =
    null;

  async function run(): Promise<
    Result<DatabaseConnection, DatabaseInitializationError>
  > {
    state = { status: 'preparing-private-storage' };

    let prepared;
    try {
      prepared = await privateStorage.preparePrivateStorage();
    } catch {
      prepared = {
        ok: false as const,
        error: storageError('private-storage-unavailable'),
      };
    }

    if (!prepared.ok || prepared.value.directory.trim() === '') {
      const error = prepared.ok
        ? storageError('private-storage-unavailable')
        : prepared.error;
      state = { status: 'failed', error };
      return { ok: false, error };
    }

    let connection: DatabaseConnection;
    state = { status: 'opening-database' };
    try {
      connection = await driver.openDatabase(
        prepared.value.directory,
        databaseName,
      );
    } catch {
      const error = storageError('database-open-failed');
      state = { status: 'failed', error };
      return { ok: false, error };
    }

    async function closeFailedConnection(): Promise<void> {
      try {
        await connection.closeAsync?.();
      } catch {
        // Initialization has already failed. Cleanup errors must not replace the
        // safe typed failure or expose platform details.
      }
    }

    state = { status: 'configuring-connection' };
    try {
      await connection.execAsync('PRAGMA foreign_keys = ON');
    } catch {
      const error = storageError('database-configuration-failed');
      await closeFailedConnection();
      state = { status: 'failed', error };
      return { ok: false, error };
    }

    state = { status: 'migrating' };
    let migration: Result<void, DataMigrationError>;
    try {
      migration = await migrate(connection);
    } catch {
      const error = migrationError('migration-failed');
      await closeFailedConnection();
      state = { status: 'failed', error };
      return { ok: false, error };
    }
    if (!migration.ok) {
      await closeFailedConnection();
      state = { status: 'failed', error: migration.error };
      return migration;
    }

    state = { status: 'configuring-connection' };
    try {
      await connection.execAsync('PRAGMA journal_mode = WAL');
    } catch {
      const error = storageError('database-configuration-failed');
      await closeFailedConnection();
      state = { status: 'failed', error };
      return { ok: false, error };
    }

    // Opening SQLite may create the database and WAL/SHM files. Re-run the
    // idempotent native verification so newly created files are protected too.
    state = { status: 'preparing-private-storage' };
    let verified;
    try {
      verified = await privateStorage.preparePrivateStorage();
    } catch {
      verified = { ok: false as const, error: storageError('private-storage-unavailable') };
    }
    if (
      !verified.ok ||
      verified.value.directory.trim() === '' ||
      verified.value.directory !== prepared.value.directory
    ) {
      const error = verified.ok
        ? storageError('private-storage-unavailable')
        : verified.error;
      await closeFailedConnection();
      state = { status: 'failed', error };
      return { ok: false, error };
    }

    state = { status: 'ready', connection };
    ready = { ok: true, value: connection };
    return ready;
  }

  function initialize(): Promise<
    Result<DatabaseConnection, DatabaseInitializationError>
  > {
    if (ready) {
      return Promise.resolve(ready);
    }
    if (inFlight) {
      return inFlight;
    }

    inFlight = run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return { initialize, getState: () => state };
}
