import { storageError, type DataStorageError } from './errors';

export type DatabaseOperation = 'read' | 'write';

function errorSignature(error: unknown): string {
  if (typeof error !== 'object' || error === null) return '';
  const record = error as Record<string, unknown>;
  const parts = [record.code, record.name, record.message].filter(
    (value): value is string => typeof value === 'string',
  );
  return parts.join(' ').toUpperCase();
}

export function mapDatabaseError(
  error: unknown,
  operation: DatabaseOperation,
): DataStorageError {
  const signature = errorSignature(error);

  if (signature.includes('SQLITE_CORRUPT') || signature.includes('SQLITE_NOTADB')) {
    return storageError('database-corrupt');
  }
  if (signature.includes('SQLITE_FULL')) {
    return storageError('database-full');
  }
  if (signature.includes('SQLITE_IOERR')) {
    return storageError('database-io');
  }
  if (signature.includes('SQLITE_BUSY') || signature.includes('SQLITE_LOCKED')) {
    return storageError('database-busy');
  }

  return storageError(operation === 'read' ? 'read-failed' : 'write-failed');
}
