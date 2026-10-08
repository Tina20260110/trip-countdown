import { createChecklistRepository } from '../../src/data/checklist-repository';
import { MemoryRepositoryDatabase } from './fixtures/memory-repository-database';

describe('ChecklistRepository contract', () => {
  function setup() {
    const database = new MemoryRepositoryDatabase();
    const first = database.seedTrip({ destination: 'Tokyo', departure_date: '2027-01-01', notes: '', created_at: 1, updated_at: 1 });
    const second = database.seedTrip({ destination: 'Osaka', departure_date: '2027-02-01', notes: '', created_at: 1, updated_at: 1 });
    return {
      database,
      first,
      second,
      repository: createChecklistRepository(database, { now: () => 50 }),
    };
  }

  it('adds trimmed items and lists each Trip in stable ID order', async () => {
    const { repository, first, second } = setup();
    await repository.add(first.id, { title: ' Passport ' });
    await repository.add(second.id, { title: 'Visa' });
    await repository.add(first.id, { title: 'Charger' });

    await expect(repository.list(first.id)).resolves.toMatchObject({
      ok: true,
      value: [{ title: 'Passport' }, { title: 'Charger' }],
    });
    await expect(repository.list(second.id)).resolves.toMatchObject({
      ok: true,
      value: [{ title: 'Visa' }],
    });
  });

  it('sets an explicit completed target in both directions', async () => {
    const { repository, first } = setup();
    const added = await repository.add(first.id, { title: 'Passport' });
    if (!added.ok) throw new Error('expected item');

    await expect(repository.setCompleted(added.value.id, true)).resolves.toMatchObject({
      ok: true, value: { completed: true },
    });
    await expect(repository.setCompleted(added.value.id, false)).resolves.toMatchObject({
      ok: true, value: { completed: false },
    });
  });

  it('removes an item without affecting another Trip', async () => {
    const { repository, first, second } = setup();
    const firstItem = await repository.add(first.id, { title: 'Passport' });
    await repository.add(second.id, { title: 'Visa' });
    if (!firstItem.ok) throw new Error('expected item');

    await expect(repository.remove(firstItem.value.id)).resolves.toEqual({ ok: true, value: undefined });
    await expect(repository.list(first.id)).resolves.toEqual({ ok: true, value: [] });
    await expect(repository.list(second.id)).resolves.toMatchObject({ ok: true, value: [{ title: 'Visa' }] });
  });

  it('rejects an absent parent Trip and invalid title without inserting', async () => {
    const { repository, database } = setup();
    await expect(repository.add(999, { title: 'Passport' })).resolves.toMatchObject({
      ok: false, error: { kind: 'not-found' },
    });
    await expect(repository.add(1, { title: '   ' })).resolves.toMatchObject({
      ok: false, error: { kind: 'validation' },
    });
    expect(database.checklistItems).toEqual([]);
  });

  it('returns not-found for missing setCompleted and remove targets', async () => {
    const { repository } = setup();
    await expect(repository.setCompleted(999, true)).resolves.toMatchObject({ ok: false, error: { kind: 'not-found' } });
    await expect(repository.remove(999)).resolves.toMatchObject({ ok: false, error: { kind: 'not-found' } });
  });

  it('keeps the last successful state when a write fails', async () => {
    const { repository, database, first } = setup();
    const added = await repository.add(first.id, { title: 'Passport' });
    if (!added.ok) throw new Error('expected item');
    database.failNextRun = true;

    await expect(repository.setCompleted(added.value.id, true)).resolves.toMatchObject({
      ok: false, error: { kind: 'storage', code: 'write-failed' },
    });
    await expect(repository.list(first.id)).resolves.toMatchObject({
      ok: true, value: [{ completed: false }],
    });
  });

  it('uses bound parameters for checklist content', async () => {
    const { repository, database, first } = setup();
    const title = "Passport'); DELETE FROM trips; --";
    await repository.add(first.id, { title });

    const insert = database.calls.find((call) => call.sql.includes('INSERT INTO checklist_items'));
    expect(insert?.sql).not.toContain(title);
    expect(insert?.params).toContain(title);
  });
});
