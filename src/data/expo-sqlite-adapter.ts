import {
  openDatabaseAsync,
  type SQLiteDatabase,
  type SQLiteRunResult,
} from 'expo-sqlite';
import type {
  DatabaseConnection,
  DatabaseDriver,
  DatabaseRunResult,
  DatabaseTransactionConnection,
  SqlBindValue,
} from './database';

export interface CloseableDatabaseConnection extends DatabaseConnection {
  closeAsync(): Promise<void>;
}

type ExpoConnection = SQLiteDatabase;
type ExclusiveTransactionRunner = (
  task: (transaction: DatabaseTransactionConnection) => Promise<void>,
) => Promise<void>;

function bindValues(values: readonly SqlBindValue[]): SqlBindValue[] {
  return [...values];
}

function adaptConnection(
  database: ExpoConnection,
  close?: () => Promise<void>,
  runExclusiveTransaction?: ExclusiveTransactionRunner,
): CloseableDatabaseConnection {
  return {
    execAsync(sql) {
      return database.execAsync(sql);
    },
    async runAsync(sql, params = []): Promise<DatabaseRunResult> {
      const result: SQLiteRunResult = await database.runAsync(
        sql,
        bindValues(params),
      );
      return {
        lastInsertRowId: result.lastInsertRowId,
        changes: result.changes,
      };
    },
    getFirstAsync<T>(sql: string, params = []) {
      return database.getFirstAsync<T>(sql, bindValues(params));
    },
    getAllAsync<T>(sql: string, params = []) {
      return database.getAllAsync<T>(sql, bindValues(params));
    },
    withExclusiveTransactionAsync(task) {
      if (!runExclusiveTransaction) {
        throw new Error('Nested exclusive transactions are unavailable');
      }
      return runExclusiveTransaction(task);
    },
    async closeAsync() {
      if (!close) return;
      await close();
    },
  };
}

export async function openExpoSqliteConnection(
  directory: string,
  databaseName: string,
): Promise<CloseableDatabaseConnection> {
  const database = await openDatabaseAsync(databaseName, {}, directory);

  const runExclusiveTransaction: ExclusiveTransactionRunner = async (task) => {
    const transaction = await openDatabaseAsync(
      databaseName,
      { useNewConnection: true },
      directory,
    );
    let began = false;

    try {
      await transaction.execAsync('PRAGMA foreign_keys = ON');
      const foreignKeys = await transaction.getFirstAsync<{ foreign_keys?: unknown }>(
        'PRAGMA foreign_keys',
      );
      if (foreignKeys?.foreign_keys !== 1) {
        throw new Error('Foreign key enforcement is unavailable');
      }

      await transaction.execAsync('BEGIN IMMEDIATE');
      began = true;
      await task(adaptConnection(transaction));
      await transaction.execAsync('COMMIT');
      began = false;
    } catch (error) {
      if (began) {
        try {
          await transaction.execAsync('ROLLBACK');
        } catch {
          // Preserve the original transaction failure for stable error mapping.
        }
      }
      throw error;
    } finally {
      await transaction.closeAsync();
    }
  };

  return adaptConnection(
    database,
    () => database.closeAsync(),
    runExclusiveTransaction,
  );
}

export function createExpoSqliteDriver(): DatabaseDriver {
  return {
    openDatabase: openExpoSqliteConnection,
  };
}
