export const SCHEMA_VERSION = 1;

export const SCHEMA_V1_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destination TEXT NOT NULL,
    departure_date TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS checklist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    offset_days INTEGER NOT NULL CHECK (offset_days IN (1, 7)),
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    status TEXT NOT NULL,
    revision INTEGER NOT NULL,
    notification_id TEXT NOT NULL UNIQUE,
    target_date TEXT NULL,
    scheduled_at INTEGER NULL,
    scheduled_timezone TEXT NULL,
    error_code TEXT NULL,
    PRIMARY KEY (trip_id, offset_days)
  )`,
  'CREATE INDEX IF NOT EXISTS index_trips_departure_date_id ON trips(departure_date, id)',
  'CREATE INDEX IF NOT EXISTS index_checklist_items_trip_id_id ON checklist_items(trip_id, id)',
] as const;
