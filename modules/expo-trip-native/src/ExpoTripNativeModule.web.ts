import { NativeModule, registerWebModule } from 'expo';

import type { PreparedPrivateStorage } from '../../../src/data/private-storage';
import type { ExpoTripNativeError } from './ExpoTripNative.types';

// ExpoTripNativeModule is not available on the web platform.
class ExpoTripNativeModule extends NativeModule<{}> {
  async preparePrivateStorage(): Promise<PreparedPrivateStorage> {
    const error = new Error(
      'Private storage is unavailable on this platform.',
    ) as ExpoTripNativeError;
    error.code = 'ERR_PRIVATE_STORAGE_UNAVAILABLE';
    throw error;
  }
}

export default registerWebModule(ExpoTripNativeModule, 'ExpoTripNative');
