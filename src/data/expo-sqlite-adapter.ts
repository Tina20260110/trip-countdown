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

type ExpoTransaction = Parameters<
  Parameters<SQLiteDatabase['withExclusiveTransactionAsync']>[0]
>[0];
type ExpoConnection = SQLiteDatabase | ExpoTransaction;

function bindValues(values: readonly SqlBindValue[]): SqlBindValue[] {
  return [...values];
}

function adaptConnection(
  database: ExpoConnection,
  close?: () => Promise<void>,
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
      if (!('withExclusiveTransactionAsync' in database)) {
        throw new Error('Nested exclusive transactions are unavailable');
      }
      return database.withExclusiveTransactionAsync(async (transaction) => {
        const adaptedTransaction: DatabaseConnection = adaptConnection(transaction);
        await task(adaptedTransaction as DatabaseTransactionConnection);
      });
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
  return adaptConnection(database, () => database.closeAsync());
}

export function createExpoSqliteDriver(): DatabaseDriver {
  return {
    openDatabase: openExpoSqliteConnection,
  };
}
