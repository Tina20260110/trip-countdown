import { createTripRepository } from '../../src/data/trip-repository';
import { MemoryRepositoryDatabase } from './fixtures/memory-repository-database';

const tripInput = {
  destination: ' Tokyo ',
  departureDate: '2027-01-10',
  notes: 'Bring passport',
};

describe('TripRepository contract', () => {
  it('creates, gets, updates, and deletes a trip using validated values', async () => {
    const database = new MemoryRepositoryDatabase();
    const repository = createTripRepository(database, { now: () => 100 });

    const created = await repository.create(tripInput, '2027-01-01');
    expect(created).toMatchObject({ ok: true, value: { destination: 'Tokyo' } });
    if (!created.ok) throw new Error('expected created trip');

    await expect(repository.get(created.value.id)).resolves.toMatchObject({
      ok: true,
      value: { checklistItems: [], reminders: [] },
    });
    await expect(
      repository.update(created.value.id, {
        destination: 'Kyoto',
        departureDate: '2026-12-01',
        notes: '',
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { destination: 'Kyoto', departureDate: '2026-12-01' },
    });
    await expect(repository.delete(created.value.id)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(repository.get(created.value.id)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'not-found' },
    });
  });

  it('separates Create and Edit date validation without writing invalid input', async () => {
    const database = new MemoryRepositoryDatabase();
    const repository = createTripRepository(database, { now: () => 100 });

    const create = await repository.create(
      { ...tripInput, departureDate: '2026-12-31' },
      '2027-01-01',
    );
    expect(create).toMatchObject({ ok: false, error: { kind: 'validation' } });
    expect(database.calls.filter((call) => call.kind === 'run')).toHaveLength(0);

    const seeded = database.seedTrip({
      destination: 'Tokyo', departure_date: '2027-02-01', notes: '',
      created_at: 1, updated_at: 1,
    });
    await expect(repository.update(seeded.id, {
      destination: 'Tokyo', departureDate: '2020-01-01', notes: 'edited',
    })).resolves.toMatchObject({ ok: true, value: { departureDate: '2020-01-01' } });
  });

  it('lists today/future ascending, then past descending, with stable same-day IDs', async () => {
    const database = new MemoryRepositoryDatabase();
    database.seedTrip({ id: 5, destination: 'Past old', departure_date: '2026-12-01', notes: '', created_at: 1, updated_at: 1 });
    database.seedTrip({ id: 4, destination: 'Future later', departure_date: '2027-02-01', notes: '', created_at: 1, updated_at: 1 });
    database.seedTrip({ id: 3, destination: 'Today second', departure_date: '2027-01-01', notes: '', created_at: 1, updated_at: 1 });
    database.seedTrip({ id: 2, destination: 'Past recent', departure_date: '2026-12-20', notes: '', created_at: 1, updated_at: 1 });
    database.seedTrip({ id: 1, destination: 'Today first', departure_date: '2027-01-01', notes: '', created_at: 1, updated_at: 1 });
    const repository = createTripRepository(database, { now: () => 100 });

    const result = await repository.list('2027-01-01');

    expect(result.ok && result.value.map((trip) => trip.id)).toEqual([1, 3, 4, 2, 5]);
  });

  it('aggregates checklist progress in one list query without N+1 reads', async () => {
    const database = new MemoryRepositoryDatabase();
    const first = database.seedTrip({ destination: 'Tokyo', departure_date: '2027-01-01', notes: '', created_at: 1, updated_at: 1 });
    const second = database.seedTrip({ destination: 'Osaka', departure_date: '2027-02-01', notes: '', created_at: 1, updated_at: 1 });
    database.seedChecklist({ trip_id: first.id, title: 'Passport', completed: 1, created_at: 1 });
    database.seedChecklist({ trip_id: first.id, title: 'Visa', completed: 0, created_at: 2 });
    database.seedChecklist({ trip_id: second.id, title: 'Charger', completed: 1, created_at: 3 });
    const repository = createTripRepository(database, { now: () => 100 });

    const result = await repository.list('2027-01-01');

    expect(result).toMatchObject({ ok: true, value: [
      { checklistProgress: { completed: 1, total: 2 } },
      { checklistProgress: { completed: 1, total: 1 } },
    ] });
    expect(database.calls.filter((call) => call.kind === 'all')).toHaveLength(1);
  });

  it('returns not-found for absent get, update, and delete targets', async () => {
    const repository = createTripRepository(new MemoryRepositoryDatabase(), { now: () => 1 });
    await expect(repository.get(99)).resolves.toMatchObject({ ok: false, error: { kind: 'not-found' } });
    await expect(repository.update(99, { ...tripInput, destination: 'Tokyo' })).resolves.toMatchObject({ ok: false, error: { kind: 'not-found' } });
    await expect(repository.delete(99)).resolves.toMatchObject({ ok: false, error: { kind: 'not-found' } });
  });

  it('binds user values as parameters instead of interpolating them into SQL', async () => {
    const database = new MemoryRepositoryDatabase();
    const repository = createTripRepository(database, { now: () => 1 });
    const destination = "Tokyo'); DELETE FROM trips; --";

    await repository.create({ ...tripInput, destination }, '2027-01-01');

    const insert = database.calls.find((call) => call.sql.includes('INSERT INTO trips'));
    expect(insert?.sql).not.toContain(destination);
    expect(insert?.params).toContain(destination);
  });

  it('maps corrupt aggregate rows to storage errors', async () => {
    const database = new MemoryRepositoryDatabase();
    database.seedTrip({ destination: 'Tokyo', departure_date: 'invalid', notes: '', created_at: 1, updated_at: 1 });
    const repository = createTripRepository(database, { now: () => 1 });

    await expect(repository.list('2027-01-01')).resolves.toMatchObject({
      ok: false,
      error: { kind: 'storage', code: 'corrupt-data' },
    });
  });
});
