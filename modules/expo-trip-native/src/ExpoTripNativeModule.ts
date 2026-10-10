import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { PreparedPrivateStorage } from '../../../src/data/private-storage';

export declare class ExpoTripNativeModule extends NativeModule<{}> {
  preparePrivateStorage(): Promise<PreparedPrivateStorage>;
}

export default requireOptionalNativeModule<ExpoTripNativeModule>('ExpoTripNative');
