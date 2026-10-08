import type {
  DatabaseConnection,
  DatabaseRunResult,
  SqlBindValue,
} from '../../../src/data/database';

type Row = Record<string, unknown>;

interface TripRow extends Row {
  id: number;
  destination: string;
  departure_date: string;
  notes: string;
  created_at: number;
  updated_at: number;
}

interface ChecklistRow extends Row {
  id: number;
  trip_id: number;
  title: string;
  completed: number;
  created_at: number;
}

interface ReminderRow extends Row {
  trip_id: number;
  offset_days: number;
  enabled: number;
  status: string;
  revision: number;
  notification_id: string;
  target_date: string | null;
  scheduled_at: number | null;
  scheduled_timezone: string | null;
  error_code: string | null;
}

export interface DatabaseCall {
  kind: 'run' | 'first' | 'all';
  sql: string;
  params: readonly SqlBindValue[];
}

export class MemoryRepositoryDatabase implements DatabaseConnection {
  readonly calls: DatabaseCall[] = [];
  readonly trips: TripRow[] = [];
  readonly checklistItems: ChecklistRow[] = [];
  readonly reminders: ReminderRow[] = [];
  failNextRun = false;
  private nextTripId = 1;
  private nextChecklistId = 1;

  seedTrip(row: Omit<TripRow, 'id'> & { id?: number }): TripRow {
    const value = { ...row, id: row.id ?? this.nextTripId++ } as TripRow;
    this.nextTripId = Math.max(this.nextTripId, value.id + 1);
    this.trips.push(value);
    return value;
  }

  seedChecklist(row: Omit<ChecklistRow, 'id'> & { id?: number }): ChecklistRow {
    const value = { ...row, id: row.id ?? this.nextChecklistId++ } as ChecklistRow;
    this.nextChecklistId = Math.max(this.nextChecklistId, value.id + 1);
    this.checklistItems.push(value);
    return value;
  }

  seedReminder(row: ReminderRow): ReminderRow {
    this.reminders.push({ ...row });
    return row;
  }

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<DatabaseRunResult> {
    this.calls.push({ kind: 'run', sql, params: [...params] });
    if (this.failNextRun) {
      this.failNextRun = false;
      throw new Error('SQL and /private/path must remain hidden');
    }

    if (sql.includes('INSERT INTO trips')) {
      const [destination, departureDate, notes, createdAt, updatedAt] = params;
      const row = this.seedTrip({
        destination: destination as string,
        departure_date: departureDate as string,
        notes: notes as string,
        created_at: createdAt as number,
        updated_at: updatedAt as number,
      });
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (sql.includes('UPDATE trips')) {
      const [destination, departureDate, notes, updatedAt, id] = params;
      const row = this.trips.find((trip) => trip.id === id);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      Object.assign(row, {
        destination,
        departure_date: departureDate,
        notes,
        updated_at: updatedAt,
      });
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (sql.includes('DELETE FROM trips')) {
      const [id] = params;
      const index = this.trips.findIndex((trip) => trip.id === id);
      if (index < 0) return { lastInsertRowId: 0, changes: 0 };
      this.trips.splice(index, 1);
      this.removeWhere(this.checklistItems, (row) => row.trip_id === id);
      this.removeWhere(this.reminders, (row) => row.trip_id === id);
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (sql.includes('INSERT INTO checklist_items')) {
      const [tripId, title, createdAt] = params;
      if (!this.trips.some((trip) => trip.id === tripId)) throw new Error('foreign key');
      const row = this.seedChecklist({
        trip_id: tripId as number,
        title: title as string,
        completed: 0,
        created_at: createdAt as number,
      });
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (sql.includes('UPDATE checklist_items')) {
      const [completed, id] = params;
      const row = this.checklistItems.find((item) => item.id === id);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.completed = completed as number;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (sql.includes('DELETE FROM checklist_items')) {
      const [id] = params;
      const before = this.checklistItems.length;
      this.removeWhere(this.checklistItems, (row) => row.id === id);
      return { lastInsertRowId: 0, changes: before - this.checklistItems.length };
    }
    if (sql.includes('INSERT INTO reminders')) {
      const [tripId, offset, enabled, status, revision, notificationId, targetDate,
        scheduledAt, timezone, errorCode] = params;
      if (!this.trips.some((trip) => trip.id === tripId)) throw new Error('foreign key');
      if (this.reminders.some((row) => row.trip_id === tripId && row.offset_days === offset)) {
        throw new Error('unique');
      }
      if (this.reminders.some((row) => row.notification_id === notificationId)) {
        throw new Error('unique');
      }
      this.reminders.push({
        trip_id: tripId as number,
        offset_days: offset as number,
        enabled: enabled as number,
        status: status as string,
        revision: revision as number,
        notification_id: notificationId as string,
        target_date: targetDate as string | null,
        scheduled_at: scheduledAt as number | null,
        scheduled_timezone: timezone as string | null,
        error_code: errorCode as string | null,
      });
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (sql.includes('UPDATE reminders')) {
      const [enabled, status, nextRevision, notificationId, targetDate, scheduledAt,
        timezone, errorCode, tripId, offset, expectedRevision] = params;
      const row = this.reminders.find(
        (item) => item.trip_id === tripId && item.offset_days === offset &&
          item.revision === expectedRevision,
      );
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      Object.assign(row, {
        enabled,
        status,
        revision: nextRevision,
        notification_id: notificationId,
        target_date: targetDate,
        scheduled_at: scheduledAt,
        scheduled_timezone: timezone,
        error_code: errorCode,
      });
      return { lastInsertRowId: 0, changes: 1 };
    }

    throw new Error('unsupported run');
  }

  async getFirstAsync<T>(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<T | null> {
    this.calls.push({ kind: 'first', sql, params: [...params] });
    const rows = await this.readRows(sql, params);
    return (rows[0] as T | undefined) ?? null;
  }

  async getAllAsync<T>(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<T[]> {
    this.calls.push({ kind: 'all', sql, params: [...params] });
    return (await this.readRows(sql, params)) as T[];
  }

  async withExclusiveTransactionAsync(
    task: (transaction: DatabaseConnection) => Promise<void>,
  ): Promise<void> {
    const snapshot = JSON.stringify({
      trips: this.trips,
      checklist: this.checklistItems,
      reminders: this.reminders,
    });
    try {
      await task(this);
    } catch (error) {
      const state = JSON.parse(snapshot) as {
        trips: TripRow[];
        checklist: ChecklistRow[];
        reminders: ReminderRow[];
      };
      this.replace(this.trips, state.trips);
      this.replace(this.checklistItems, state.checklist);
      this.replace(this.reminders, state.reminders);
      throw error;
    }
  }

  private async readRows(sql: string, params: readonly SqlBindValue[]): Promise<Row[]> {
    if (sql.includes('checklist_total')) {
      const [today] = params;
      return [...this.trips]
        .sort((a, b) => {
          const aFuture = a.departure_date >= (today as string);
          const bFuture = b.departure_date >= (today as string);
          if (aFuture !== bFuture) return aFuture ? -1 : 1;
          const dateOrder = a.departure_date.localeCompare(b.departure_date);
          if (dateOrder !== 0) return aFuture ? dateOrder : -dateOrder;
          return a.id - b.id;
        })
        .map((trip) => {
          const items = this.checklistItems.filter((item) => item.trip_id === trip.id);
          return {
            ...trip,
            checklist_total: items.length,
            checklist_completed: items.filter((item) => item.completed === 1).length,
          };
        });
    }
    if (sql.includes('FROM trips')) {
      return this.trips.filter((row) => row.id === params[0]);
    }
    if (sql.includes('FROM checklist_items')) {
      const rows = sql.includes('trip_id = ?')
        ? this.checklistItems.filter((row) => row.trip_id === params[0])
        : this.checklistItems.filter((row) => row.id === params[0]);
      return [...rows].sort((a, b) => a.id - b.id);
    }
    if (sql.includes('FROM reminders')) {
      return this.reminders
        .filter((row) => row.trip_id === params[0] &&
          (params.length < 2 || row.offset_days === params[1]))
        .sort((a, b) => a.offset_days - b.offset_days);
    }
    throw new Error('unsupported read');
  }

  private removeWhere<T>(items: T[], predicate: (item: T) => boolean): void {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (predicate(items[index])) items.splice(index, 1);
    }
  }

  private replace<T>(target: T[], values: T[]): void {
    target.splice(0, target.length, ...values);
  }
}
