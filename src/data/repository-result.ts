import type {
  NotFoundError,
  Result,
  UnavailableError,
  ValidationError,
} from '../domain/types';
import type { DataStorageError } from './errors';

export type RepositoryError =
  | ValidationError
  | NotFoundError
  | DataStorageError
  | UnavailableError;

export type RepositoryResult<T> = Result<T, RepositoryError>;

export function notFoundError(): NotFoundError {
  return { kind: 'not-found', message: '旅行不存在' };
}

export function unavailableError(): UnavailableError {
  return { kind: 'unavailable', message: '本地数据暂时不可用，请重试' };
}
