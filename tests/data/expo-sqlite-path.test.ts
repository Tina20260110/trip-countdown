jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import { openDatabaseAsync } from 'expo-sqlite';
import { openExpoSqliteConnection } from '../../src/data/expo-sqlite-adapter';

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
