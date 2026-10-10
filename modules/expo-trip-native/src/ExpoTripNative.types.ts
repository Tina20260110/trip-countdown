export type PrivateStorageErrorCode =
  | 'ERR_PRIVATE_STORAGE_UNAVAILABLE'
  | 'ERR_PRIVATE_STORAGE_VERIFICATION_FAILED';

export interface ExpoTripNativeError extends Error {
  code: PrivateStorageErrorCode;
}

export function isExpoTripNativeError(
  value: unknown,
): value is ExpoTripNativeError {
  if (!(value instanceof Error) || !('code' in value)) return false;
  return (
    value.code === 'ERR_PRIVATE_STORAGE_UNAVAILABLE' ||
    value.code === 'ERR_PRIVATE_STORAGE_VERIFICATION_FAILED'
  );
}
