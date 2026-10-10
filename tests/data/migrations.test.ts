import { createDatabaseInitializer } from '../../src/data/database';
import { migrateDatabase } from '../../src/data/migrations';
import { SCHEMA_VERSION, SCHEMA_V1_STATEMENTS } from '../../src/data/schema';
import { storageError } from '../../src/data/errors';
import { FakeDatabaseConnection } from './fixtures/fake-database';

describe('schema v1', () => {
  const schema = SCHEMA_V1_STATEMENTS.join('\n');

  it('defines the three tables and required indexes', () => {
    expect(schema.match(/CREATE TABLE IF NOT EXISTS/gi)).toHaveLength(3);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS trips/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS checklist_items/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS reminders/);
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS index_trips_departure_date_id/);
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS index_checklist_items_trip_id_id/);
  });

  it('defines constraints and cascading ownership', () => {
    expect(schema).toMatch(/destination TEXT NOT NULL/);
    expect(schema).toMatch(/notes TEXT NOT NULL DEFAULT ''/);
    expect(schema).toMatch(/completed INTEGER NOT NULL DEFAULT 0 CHECK \(completed IN \(0, 1\)\)/);
    expect(schema).toMatch(/offset_days INTEGER NOT NULL CHECK \(offset_days IN \(1, 7\)\)/);
    expect(schema).toMatch(/PRIMARY KEY \(trip_id, offset_days\)/);
    expect(schema).toMatch(/notification_id TEXT NOT NULL UNIQUE/);
    expect(schema.match(/REFERENCES trips\(id\) ON DELETE CASCADE/g)).toHaveLength(2);
  });
});

describe('schema migrations', () => {
  it('moves user_version from 0 to 1 only after schema statements', async () => {
    const database = new FakeDatabaseConnection(0);

    const result = await migrateDatabase(database);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(database.transactionCount).toBe(1);
    expect(database.userVersion).toBe(SCHEMA_VERSION);
    expect(database.executedSql.at(-1)).toBe('PRAGMA user_version = 1');
  });

  it('is idempotent when the supported schema is already initialized', async () => {
    const database = new FakeDatabaseConnection(SCHEMA_VERSION);

    await expect(migrateDatabase(database)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(database.transactionCount).toBe(0);
    expect(database.executedSql).toEqual([]);
  });

  it('rejects a future schema version without writing', async () => {
    const database = new FakeDatabaseConnection(SCHEMA_VERSION + 1);

    const result = await migrateDatabase(database);

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'migration', code: 'unsupported-schema-version' },
    });
    expect(database.transactionCount).toBe(0);
    expect(database.executedSql).toEqual([]);
  });

  it('rolls back a failed migration without deleting or recreating storage', async () => {
    const database = new FakeDatabaseConnection(0);
    database.failWhenSqlIncludes = 'CREATE TABLE IF NOT EXISTS reminders';

    const result = await migrateDatabase(database);

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'migration', code: 'migration-failed' },
    });
    expect(database.userVersion).toBe(0);
    expect(database.executedSql).toEqual([]);
  });
});

describe('database initialization', () => {
  it('prepares private storage before open and configures every connection before migration', async () => {
    const events: string[] = [];
    const database = new FakeDatabaseConnection(0);
    const initializer = createDatabaseInitializer({
      privateStorage: {
        async preparePrivateStorage() {
          events.push('prepare');
          return { ok: true, value: { directory: '/private/storage' } };
        },
      },
      driver: {
        async openDatabase(directory, name) {
          events.push(`open:${directory}/${name}`);
          return database;
        },
      },
      migrate: async (connection) => {
        events.push('migrate');
        return migrateDatabase(connection);
      },
    });

    const result = await initializer.initialize();

    expect(result).toEqual({ ok: true, value: database });
    expect(events).toEqual([
      'prepare',
      'open:/private/storage/trip-countdown.db',
      'migrate',
      'prepare',
    ]);
    expect(database.executedSql[0]).toBe('PRAGMA foreign_keys = ON');
    expect(database.executedSql.at(-1)).toBe('PRAGMA journal_mode = WAL');
  });

  it('closes and fails when post-open sidecar verification fails', async () => {
    const database = new FakeDatabaseConnection(1);
    const preparePrivateStorage = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, value: { directory: '/private/storage' } })
      .mockResolvedValueOnce({ ok: false, error: storageError('private-storage-unavailable') });
    const initializer = createDatabaseInitializer({
      privateStorage: { preparePrivateStorage },
      driver: { async openDatabase() { return database; } },
      migrate: migrateDatabase,
    });

    await expect(initializer.initialize()).resolves.toMatchObject({
      ok: false,
      error: { code: 'private-storage-unavailable' },
    });
    expect(database.closeCount).toBe(1);
    expect(initializer.getState()).toMatchObject({ status: 'failed' });
  });

  it('rejects a changed post-open directory instead of opening or falling back elsewhere', async () => {
    const database = new FakeDatabaseConnection(1);
    const preparePrivateStorage = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, value: { directory: '/private/storage' } })
      .mockResolvedValueOnce({ ok: true, value: { directory: '/different/storage' } });
    const initializer = createDatabaseInitializer({
      privateStorage: { preparePrivateStorage },
      driver: { async openDatabase() { return database; } },
      migrate: migrateDatabase,
    });

    await expect(initializer.initialize()).resolves.toMatchObject({
      ok: false,
      error: { code: 'private-storage-unavailable' },
    });
    expect(database.closeCount).toBe(1);
  });

  it('shares one in-flight initialization promise', async () => {
    let releasePreparation: (() => void) | undefined;
    const preparationGate = new Promise<void>((resolve) => {
      releasePreparation = resolve;
    });
    const database = new FakeDatabaseConnection(1);
    const openDatabase = jest.fn(async () => database);
    const migrate = jest.fn(async () => ({ ok: true as const, value: undefined }));
    const initializer = createDatabaseInitializer({
      privateStorage: {
        async preparePrivateStorage() {
          await preparationGate;
          return { ok: true, value: { directory: '/private/storage' } };
        },
      },
      driver: { openDatabase },
      migrate,
    });

    const first = initializer.initialize();
    const second = initializer.initialize();
    expect(second).toBe(first);
    releasePreparation?.();
    await expect(first).resolves.toEqual({ ok: true, value: database });
    expect(openDatabase).toHaveBeenCalledTimes(1);
    expect(migrate).toHaveBeenCalledTimes(1);
  });

  it('performs zero database opens and writes when private storage fails', async () => {
    const openDatabase = jest.fn();
    const initializer = createDatabaseInitializer({
      privateStorage: {
        async preparePrivateStorage() {
          return {
            ok: false,
            error: storageError('private-storage-unavailable'),
          };
        },
      },
      driver: { openDatabase },
      migrate: migrateDatabase,
    });

    const result = await initializer.initialize();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'private-storage-unavailable' },
    });
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it('does not enable WAL or run schema writes for a future database version', async () => {
    const database = new FakeDatabaseConnection(SCHEMA_VERSION + 1);
    const initializer = createDatabaseInitializer({
      privateStorage: {
        async preparePrivateStorage() {
          return { ok: true, value: { directory: '/private/storage' } };
        },
      },
      driver: { async openDatabase() { return database; } },
      migrate: migrateDatabase,
    });

    const result = await initializer.initialize();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'unsupported-schema-version' },
    });
    expect(database.executedSql).toEqual(['PRAGMA foreign_keys = ON']);
  });

  it('maps a rejected migration, closes the failed connection, and allows retry', async () => {
    const database = new FakeDatabaseConnection(1);
    const openDatabase = jest.fn(async () => database);
    const migrate = jest
      .fn()
      .mockRejectedValueOnce(
        new Error('Migration failed at /private/user/trips.db for Tokyo'),
      )
      .mockResolvedValueOnce({ ok: true, value: undefined });
    const initializer = createDatabaseInitializer({
      privateStorage: {
        async preparePrivateStorage() {
          return { ok: true, value: { directory: '/private/user' } };
        },
      },
      driver: { openDatabase },
      migrate,
    });

    const failed = await initializer.initialize();

    expect(failed).toEqual({
      ok: false,
      error: {
        kind: 'migration',
        code: 'migration-failed',
        message: '本地数据升级未完成，请重试',
        retryable: true,
      },
    });
    expect(initializer.getState()).toEqual({
      status: 'failed',
      error: failed.ok ? undefined : failed.error,
    });
    expect(database.closeCount).toBe(1);
    expect(JSON.stringify(failed)).not.toMatch(/\/private|Tokyo|trips\.db/);

    await expect(initializer.initialize()).resolves.toEqual({
      ok: true,
      value: database,
    });
    expect(openDatabase).toHaveBeenCalledTimes(2);
    expect(migrate).toHaveBeenCalledTimes(2);
    expect(initializer.getState()).toEqual({
      status: 'ready',
      connection: database,
    });
  });
});
