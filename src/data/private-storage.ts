import type { Result } from '../domain/types';
import { storageError, type DatabaseInitializationError } from './errors';

export interface PreparedPrivateStorage {
  directory: string;
}

export interface PreparePrivateStoragePort {
  preparePrivateStorage(): Promise<
    Result<PreparedPrivateStorage, DatabaseInitializationError>
  >;
}

export type DatabaseInitializationState<Connection = unknown> =
  | { status: 'idle' }
  | { status: 'preparing-private-storage' }
  | { status: 'opening-database' }
  | { status: 'configuring-connection' }
  | { status: 'migrating' }
  | { status: 'ready'; connection: Connection }
  | { status: 'failed'; error: DatabaseInitializationError };

export async function continueWithPrivateStorage<T>(
  port: PreparePrivateStoragePort,
  operation: (directory: string) => Promise<T>,
): Promise<Result<T, DatabaseInitializationError>> {
  let prepared: Result<PreparedPrivateStorage, DatabaseInitializationError>;

  try {
    prepared = await port.preparePrivateStorage();
  } catch {
    return { ok: false, error: storageError('private-storage-unavailable') };
  }

  if (!prepared.ok) {
    return prepared;
  }

  if (prepared.value.directory.trim() === '') {
    return { ok: false, error: storageError('private-storage-unavailable') };
  }

  return { ok: true, value: await operation(prepared.value.directory) };
}
