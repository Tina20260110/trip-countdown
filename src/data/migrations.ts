import type { Result } from '../domain/types';
import { migrationError, type DataMigrationError } from './errors';
import type { DatabaseConnection } from './database';
import { SCHEMA_VERSION, SCHEMA_V1_STATEMENTS } from './schema';

interface UserVersionRow {
  user_version: unknown;
}

function readVersion(row: UserVersionRow | null): number | null {
  if (
    row === null ||
    typeof row.user_version !== 'number' ||
    !Number.isInteger(row.user_version) ||
    row.user_version < 0
  ) {
    return null;
  }

  return row.user_version;
}

export async function migrateDatabase(
  connection: DatabaseConnection,
): Promise<Result<void, DataMigrationError>> {
  try {
    const version = readVersion(
      await connection.getFirstAsync<UserVersionRow>('PRAGMA user_version'),
    );

    if (version === null) {
      return { ok: false, error: migrationError('migration-failed') };
    }

    if (version > SCHEMA_VERSION) {
      return {
        ok: false,
        error: migrationError('unsupported-schema-version'),
      };
    }

    if (version === SCHEMA_VERSION) {
      return { ok: true, value: undefined };
    }

    await connection.withExclusiveTransactionAsync(async (transaction) => {
      for (const statement of SCHEMA_V1_STATEMENTS) {
        await transaction.execAsync(statement);
      }
      await transaction.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    });

    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: migrationError('migration-failed') };
  }
}
