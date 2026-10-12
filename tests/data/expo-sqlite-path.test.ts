jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import { openDatabaseAsync } from 'expo-sqlite';
import { openExpoSqliteConnection } from '../../src/data/expo-sqlite-adapter';

beforeEach(() => {
  jest.mocked(openDatabaseAsync).mockReset();
});

it('passes the verified private directory as the SDK 57 SQLite directory argument', async () => {
  const database = { closeAsync: jest.fn() };
  jest.mocked(openDatabaseAsync).mockResolvedValue(database as never);

  await openExpoSqliteConnection('/protected/trips', 'trip-countdown.db');

  expect(openDatabaseAsync).toHaveBeenCalledWith(
    'trip-countdown.db',
    {},
    '/protected/trips',
  );
});

function createExpoDatabase(foreignKeys = 1) {
  const events: string[] = [];
  const database = {
    closeAsync: jest.fn(async () => {
      events.push('close');
    }),
    execAsync: jest.fn(async (sql: string) => {
      events.push(sql);
    }),
    getFirstAsync: jest.fn(async (sql: string) => {
      events.push(sql);
      return sql === 'PRAGMA foreign_keys' ? { foreign_keys: foreignKeys } : null;
    }),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
  };
  return { database, events };
}

describe('exclusive Expo SQLite transaction connection', () => {
  it('opens a dedicated connection and enables and verifies foreign keys before BEGIN', async () => {
    const main = createExpoDatabase();
    const transaction = createExpoDatabase();
    jest.mocked(openDatabaseAsync)
      .mockResolvedValueOnce(main.database as never)
      .mockResolvedValueOnce(transaction.database as never);
    const connection = await openExpoSqliteConnection('/protected/trips', 'trip-countdown.db');

    await connection.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM trips WHERE id = ?', [1]);
      transaction.events.push('task');
    });

    expect(openDatabaseAsync).toHaveBeenNthCalledWith(
      2,
      'trip-countdown.db',
      { useNewConnection: true },
      '/protected/trips',
    );
    expect(transaction.events).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA foreign_keys',
      'BEGIN IMMEDIATE',
      'task',
      'COMMIT',
      'close',
    ]);
  });

  it('rejects the transaction before BEGIN when foreign keys cannot be verified', async () => {
    const main = createExpoDatabase();
    const transaction = createExpoDatabase(0);
    jest.mocked(openDatabaseAsync)
      .mockResolvedValueOnce(main.database as never)
      .mockResolvedValueOnce(transaction.database as never);
    const connection = await openExpoSqliteConnection('/protected/trips', 'trip-countdown.db');
    const task = jest.fn();

    await expect(connection.withExclusiveTransactionAsync(task)).rejects.toThrow(
      'Foreign key enforcement is unavailable',
    );

    expect(task).not.toHaveBeenCalled();
    expect(transaction.events).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA foreign_keys',
      'close',
    ]);
  });

  it('rolls back and closes the dedicated connection when the task fails', async () => {
    const main = createExpoDatabase();
    const transaction = createExpoDatabase();
    jest.mocked(openDatabaseAsync)
      .mockResolvedValueOnce(main.database as never)
      .mockResolvedValueOnce(transaction.database as never);
    const connection = await openExpoSqliteConnection('/protected/trips', 'trip-countdown.db');

    await expect(
      connection.withExclusiveTransactionAsync(async () => {
        transaction.events.push('task');
        throw new Error('injected failure');
      }),
    ).rejects.toThrow('injected failure');

    expect(transaction.events).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA foreign_keys',
      'BEGIN IMMEDIATE',
      'task',
      'ROLLBACK',
      'close',
    ]);
  });
});
