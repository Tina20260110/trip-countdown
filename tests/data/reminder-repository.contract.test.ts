import type { Reminder } from '../../src/domain/types';
import { createReminderRepository } from '../../src/data/reminder-repository';
import { createTripRepository } from '../../src/data/trip-repository';
import { MemoryRepositoryDatabase } from './fixtures/memory-repository-database';

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    tripId: 1,
    offsetDays: 7,
    enabled: true,
    status: 'pending',
    revision: 1,
    notificationId: 'trip-1-before-7',
    targetDate: '2027-01-03',
    scheduledAt: null,
    scheduledTimezone: null,
    errorCode: null,
    ...overrides,
  };
}

describe('ReminderRepository contract', () => {
  function setup() {
    const database = new MemoryRepositoryDatabase();
    database.seedTrip({ id: 1, destination: 'Tokyo', departure_date: '2027-01-10', notes: '', created_at: 1, updated_at: 1 });
    return { database, repository: createReminderRepository(database) };
  }

  it('persists and reads intent plus scheduling observation fields', async () => {
    const { repository } = setup();
    const value = reminder({
      enabled: true,
      status: 'scheduled',
      revision: 4,
      scheduledAt: 123,
      scheduledTimezone: 'Asia/Shanghai',
    });

    await expect(repository.create(value)).resolves.toEqual({ ok: true, value });
    await expect(repository.list(1)).resolves.toEqual({ ok: true, value: [value] });
  });

  it.each([1, 7] as const)('accepts supported offset %s', async (offsetDays) => {
    const { repository } = setup();
    await expect(repository.create(reminder({ offsetDays, notificationId: `id-${offsetDays}` }))).resolves.toMatchObject({ ok: true });
  });

  it('rejects unsupported offsets and statuses before writing', async () => {
    const { repository, database } = setup();
    await expect(repository.create(reminder({ offsetDays: 3 as 1 }))).resolves.toMatchObject({
      ok: false, error: { kind: 'storage', code: 'corrupt-data' },
    });
    await expect(repository.create(reminder({ status: 'unknown' as 'pending' }))).resolves.toMatchObject({
      ok: false, error: { kind: 'storage', code: 'corrupt-data' },
    });
    expect(database.reminders).toEqual([]);
  });

  it('enforces one row per Trip and offset', async () => {
    const { repository, database } = setup();
    await repository.create(reminder());
    await expect(repository.create(reminder({ notificationId: 'duplicate' }))).resolves.toMatchObject({
      ok: false, error: { kind: 'storage', code: 'write-failed' },
    });
    expect(database.reminders).toHaveLength(1);
  });

  it('enforces notification_id uniqueness across offsets', async () => {
    const { repository, database } = setup();
    await repository.create(reminder());

    await expect(repository.create(reminder({ offsetDays: 1 }))).resolves.toMatchObject({
      ok: false, error: { kind: 'storage', code: 'write-failed' },
    });
    expect(database.reminders).toHaveLength(1);
  });

  it('conditionally updates only the expected revision', async () => {
    const { repository } = setup();
    await repository.create(reminder());
    const next = reminder({
      enabled: false,
      status: 'disabled',
      revision: 2,
      targetDate: null,
    });

    await expect(repository.updateIfRevision(1, next)).resolves.toEqual({ ok: true, value: next });
    await expect(repository.updateIfRevision(1, reminder({ revision: 2 }))).resolves.toMatchObject({
      ok: false, error: { kind: 'unavailable' },
    });
    await expect(repository.get(1, 7)).resolves.toEqual({ ok: true, value: next });
  });

  it('rejects a skipped revision without writing', async () => {
    const { repository, database } = setup();
    await repository.create(reminder());
    const callsBefore = database.calls.length;

    await expect(repository.updateIfRevision(1, reminder({ revision: 3 }))).resolves.toMatchObject({
      ok: false, error: { kind: 'unavailable' },
    });
    expect(database.calls).toHaveLength(callsBefore);
  });

  it('uses bound parameters for notification identifiers and state', async () => {
    const { repository, database } = setup();
    const notificationId = "id'); DELETE FROM reminders; --";
    await repository.create(reminder({ notificationId }));

    const insert = database.calls.find((call) => call.sql.includes('INSERT INTO reminders'));
    expect(insert?.sql).not.toContain(notificationId);
    expect(insert?.params).toContain(notificationId);
  });

  it('is deleted by the owning Trip foreign-key cascade', async () => {
    const { repository, database } = setup();
    await repository.create(reminder());
    const trips = createTripRepository(database);

    await trips.delete(1);

    await expect(repository.list(1)).resolves.toEqual({ ok: true, value: [] });
  });
});
