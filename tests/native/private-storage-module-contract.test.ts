jest.mock('expo', () => ({
  NativeModule: class {},
  requireOptionalNativeModule: jest.fn(() => ({
    preparePrivateStorage: jest.fn().mockResolvedValue({
      directory: '/protected/trip-countdown',
    }),
  })),
}));

import ExpoTripNativeModule from '../../modules/expo-trip-native/src/ExpoTripNativeModule';
import { isExpoTripNativeError } from '../../modules/expo-trip-native/src/ExpoTripNative.types';

const mockRequireNativeModule = jest.requireMock('expo').requireOptionalNativeModule as jest.Mock;

describe('ExpoTripNative TypeScript boundary', () => {
  it('exposes the no-argument private storage preparation contract', async () => {
    await expect(ExpoTripNativeModule!.preparePrivateStorage()).resolves.toEqual({
      directory: '/protected/trip-countdown',
    });
    expect(mockRequireNativeModule).toHaveBeenCalledWith('ExpoTripNative');
    expect(ExpoTripNativeModule!.preparePrivateStorage).toHaveBeenCalledWith();
  });

  it('recognizes only the declared safe native error codes', () => {
    const known = Object.assign(new Error('safe'), {
      code: 'ERR_PRIVATE_STORAGE_VERIFICATION_FAILED',
    });
    const unknown = Object.assign(new Error('unsafe'), { code: 'SQLITE_IOERR' });

    expect(isExpoTripNativeError(known)).toBe(true);
    expect(isExpoTripNativeError(unknown)).toBe(false);
    expect(isExpoTripNativeError({ code: 'ERR_PRIVATE_STORAGE_UNAVAILABLE' })).toBe(false);
  });
});
