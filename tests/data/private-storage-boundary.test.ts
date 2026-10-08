import {
  continueWithPrivateStorage,
  type PreparePrivateStoragePort,
} from '@/src/data/private-storage';
import { storageError } from '@/src/data/errors';

describe('private storage boundary', () => {
  it('passes the protected directory to the next initialization step', async () => {
    const port: PreparePrivateStoragePort = {
      preparePrivateStorage: jest.fn().mockResolvedValue({
        ok: true,
        value: { directory: '/protected/trip-countdown' },
      }),
    };
    const openDatabase = jest.fn().mockResolvedValue('connection');

    await expect(continueWithPrivateStorage(port, openDatabase)).resolves.toEqual({
      ok: true,
      value: 'connection',
    });
    expect(openDatabase).toHaveBeenCalledWith('/protected/trip-countdown');
  });

  it('does not call openDatabase or use a default path when preparation fails', async () => {
    const failure = storageError('private-storage-unavailable');
    const port: PreparePrivateStoragePort = {
      preparePrivateStorage: jest.fn().mockResolvedValue({ ok: false, error: failure }),
    };
    const openDatabase = jest.fn();

    await expect(continueWithPrivateStorage(port, openDatabase)).resolves.toEqual({
      ok: false,
      error: failure,
    });
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it('maps an unexpected preparation rejection to a safe typed error', async () => {
    const port: PreparePrivateStoragePort = {
      preparePrivateStorage: jest.fn().mockRejectedValue(
        new Error('Failed at /private/user/path for Tokyo'),
      ),
    };
    const openDatabase = jest.fn();

    const result = await continueWithPrivateStorage(port, openDatabase);

    expect(result).toEqual({
      ok: false,
      error: storageError('private-storage-unavailable'),
    });
    expect(JSON.stringify(result)).not.toContain('/private/user/path');
    expect(JSON.stringify(result)).not.toContain('Tokyo');
    expect(openDatabase).not.toHaveBeenCalled();
  });
});
