import ExpoTripNative from '../../modules/expo-trip-native';
import type { ExpoTripNativeModule } from '../../modules/expo-trip-native/src/ExpoTripNativeModule';
import { storageError } from './errors';
import type { PreparePrivateStoragePort } from './private-storage';

type NativePrivateStorage = Pick<ExpoTripNativeModule, 'preparePrivateStorage'>;

export function createNativePrivateStoragePort(
  nativeModule: NativePrivateStorage | null = ExpoTripNative,
): PreparePrivateStoragePort {
  return {
    async preparePrivateStorage() {
      if (!nativeModule) {
        return { ok: false, error: storageError('private-storage-unavailable') };
      }

      try {
        const prepared = await nativeModule.preparePrivateStorage();
        if (typeof prepared.directory !== 'string' || prepared.directory.trim() === '') {
          return { ok: false, error: storageError('private-storage-unavailable') };
        }
        return { ok: true, value: { directory: prepared.directory } };
      } catch {
        return { ok: false, error: storageError('private-storage-unavailable') };
      }
    },
  };
}
