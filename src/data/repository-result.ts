import type {
  NotFoundError,
  UnavailableError,
} from '../domain/types';
export type {
  RepositoryError,
  RepositoryResult,
} from '../contracts/repository-result';

export function notFoundError(): NotFoundError {
  return { kind: 'not-found', message: '旅行不存在' };
}

export function unavailableError(): UnavailableError {
  return { kind: 'unavailable', message: '本地数据暂时不可用，请重试' };
}
