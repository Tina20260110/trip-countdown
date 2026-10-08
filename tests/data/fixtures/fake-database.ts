import type {
  DatabaseConnection,
  DatabaseRunResult,
  SqlBindValue,
} from '../../../src/data/database';

export class FakeDatabaseConnection implements DatabaseConnection {
  readonly executedSql: string[] = [];
  transactionCount = 0;
  closeCount = 0;
  userVersion: number;
  failWhenSqlIncludes: string | null = null;

  constructor(userVersion = 0) {
    this.userVersion = userVersion;
  }

  async execAsync(sql: string): Promise<void> {
    if (this.failWhenSqlIncludes && sql.includes(this.failWhenSqlIncludes)) {
      throw new Error('injected database failure');
    }

    this.executedSql.push(sql);
    const version = /PRAGMA\s+user_version\s*=\s*(\d+)/i.exec(sql);
    if (version) {
      this.userVersion = Number(version[1]);
    }
  }

  async runAsync(
    _sql: string,
    _params?: readonly SqlBindValue[],
  ): Promise<DatabaseRunResult> {
    throw new Error('not implemented by migration test adapter');
  }

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    if (/PRAGMA\s+user_version/i.test(sql)) {
      return { user_version: this.userVersion } as T;
    }

    return null;
  }

  async getAllAsync<T>(
    _sql: string,
    _params?: readonly SqlBindValue[],
  ): Promise<T[]> {
    throw new Error('not implemented by migration test adapter');
  }

  async closeAsync(): Promise<void> {
    this.closeCount += 1;
  }

  async withExclusiveTransactionAsync(
    task: (transaction: DatabaseConnection) => Promise<void>,
  ): Promise<void> {
    this.transactionCount += 1;
    const beforeSql = [...this.executedSql];
    const beforeVersion = this.userVersion;

    try {
      await task(this);
    } catch (error) {
      this.executedSql.splice(0, this.executedSql.length, ...beforeSql);
      this.userVersion = beforeVersion;
      throw error;
    }
  }
}
