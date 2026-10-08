import type {
  NotFoundError,
  Result,
  StorageError,
  UnavailableError,
  ValidationError,
} from '../domain/types';

export type RepositoryError =
  | ValidationError
  | NotFoundError
  | StorageError
  | UnavailableError;

export type RepositoryResult<T> = Result<T, RepositoryError>;
