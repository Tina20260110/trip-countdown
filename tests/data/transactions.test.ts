import { mapDatabaseError } from '../../src/data/error-mapping';
import {
  createWriteCoordinator,
  runExclusiveTransaction,
} from '../../src/data/transactions';
import { MemoryRepositoryDatabase } from './fixtures/memory-repository-database';

describe('exclusive transaction helper', () => {
  it('returns the committed operation value', async () => {
    const database = new MemoryRepositoryDatabase();
    database.seedTrip({ id: 1, destination: 'Tokyo', departure_date: '2027-01-01', notes: '', created_at: 1, updated_at: 1 });

    const result = await runExclusiveTransaction(database, async (transaction) => {
      await transaction.runAsync('DELETE FROM trips WHERE id = ?', [1]);
      return 'committed';
    });

    expect(result).toEqual({ ok: true, value: 'committed' });
    expect(database.trips).toEqual([]);
  });

  it('rolls back all changes when an injected operation fails', async () => {
    const database = new MemoryRepositoryDatabase();
    database.seedTrip({ id: 1, destination: 'Tokyo', departure_date: '2027-01-01', notes: 'private', created_at: 1, updated_at: 1 });

    const result = await runExclusiveTransaction(database, async (transaction) => {
      await transaction.runAsync('DELETE FROM trips WHERE id = ?', [1]);
      throw Object.assign(new Error('SQL at /private/trips.db for Tokyo'), {
        code: 'SQLITE_IOERR',
      });
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'database-io' } });
    expect(database.trips).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/SQL|\/private|Tokyo|private/);
  });
});

describe('SQLite error mapping', () => {
  it.each([
    ['SQLITE_BUSY', 'database-busy', true],
    ['SQLITE_LOCKED', 'database-busy', true],
    ['SQLITE_IOERR', 'database-io', true],
    ['SQLITE_FULL', 'database-full', false],
    ['SQLITE_CORRUPT', 'database-corrupt', false],
    ['SQLITE_NOTADB', 'database-corrupt', false],
  ] as const)('maps %s to a stable safe error', (code, expected, retryable) => {
    const error = Object.assign(
      new Error('SELECT secret FROM /private/path Notes Checklist title'),
      { code },
    );

    const mapped = mapDatabaseError(error, 'write');

    expect(mapped).toMatchObject({ kind: 'storage', code: expected, retryable });
    expect(JSON.stringify(mapped)).not.toMatch(/SELECT|\/private|Notes|Checklist/);
  });

  it('uses a safe operation-specific fallback for unknown errors', () => {
    const source = new Error('Tokyo Notes Passport /private/db.sqlite');

    const read = mapDatabaseError(source, 'read');
    const write = mapDatabaseError(source, 'write');

    expect(read.code).toBe('read-failed');
    expect(write.code).toBe('write-failed');
    expect(`${JSON.stringify(read)}${JSON.stringify(write)}`).not.toMatch(
      /Tokyo|Notes|Passport|\/private/,
    );
  });
});

describe('write serialization', () => {
  it('runs queued writes in FIFO order with at most one active operation', async () => {
    const coordinator = createWriteCoordinator();
    const events: string[] = [];
    let active = 0;
    let maxActive = 0;
    let releaseFirst: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = coordinator.run(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      events.push('first:start');
      await gate;
      events.push('first:end');
      active -= 1;
      return 1;
    });
    const second = coordinator.run(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      events.push('second:start');
      active -= 1;
      return 2;
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);
    releaseFirst?.();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(events).toEqual(['first:start', 'first:end', 'second:start']);
    expect(maxActive).toBe(1);
  });

  it('continues the queue after a failed write', async () => {
    const coordinator = createWriteCoordinator();
    const first = coordinator.run(async () => {
      throw new Error('failure');
    });
    const second = coordinator.run(async () => 'saved');

    await expect(first).rejects.toThrow('failure');
    await expect(second).resolves.toBe('saved');
  });
});
