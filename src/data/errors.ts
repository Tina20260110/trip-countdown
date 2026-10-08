export type StorageErrorCode =
  | 'private-storage-unavailable'
  | 'database-open-failed'
  | 'database-configuration-failed'
  | 'database-busy'
  | 'database-io'
  | 'database-full'
  | 'database-corrupt'
  | 'read-failed'
  | 'write-failed'
  | 'corrupt-data';

export interface DataStorageError {
  kind: 'storage';
  code: StorageErrorCode;
  message: string;
  retryable: boolean;
}

export type MigrationErrorCode =
  | 'migration-failed'
  | 'unsupported-schema-version';

export interface DataMigrationError {
  kind: 'migration';
  code: MigrationErrorCode;
  message: string;
  retryable: boolean;
}

export type DatabaseInitializationError = DataStorageError | DataMigrationError;

export function storageError(code: StorageErrorCode): DataStorageError {
  const messages: Partial<Record<StorageErrorCode, string>> = {
    'database-busy': '本地数据正忙，请重试',
    'database-io': '本地数据读写失败，请重试',
    'database-full': '设备存储空间不足，无法保存',
    'database-corrupt': '本地数据已损坏，暂时无法使用',
  };
  return {
    kind: 'storage',
    code,
    message: messages[code] ?? '本地数据暂时不可用，请重试',
    retryable: code !== 'database-full' && code !== 'database-corrupt',
  };
}

export function migrationError(code: MigrationErrorCode): DataMigrationError {
  return {
    kind: 'migration',
    code,
    message:
      code === 'unsupported-schema-version'
        ? '本地数据版本暂不受支持'
        : '本地数据升级未完成，请重试',
    retryable: code === 'migration-failed',
  };
}
