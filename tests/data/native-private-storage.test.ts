import { createNativePrivateStoragePort } from '../../src/data/native-private-storage';
import { createDatabaseInitializer } from '../../src/data/database';

describe('native private storage adapter', () => {
  it('returns the verified native directory', async () => {
    const port = createNativePrivateStoragePort({
      preparePrivateStorage: jest.fn().mockResolvedValue({ directory: '/protected/trips' }),
    });
    await expect(port.preparePrivateStorage()).resolves.toEqual({
      ok: true,
      value: { directory: '/protected/trips' },
    });
  });

  it.each([
    ['missing module', null],
    ['native rejection', { preparePrivateStorage: jest.fn().mockRejectedValue(new Error('/private/path')) }],
    ['invalid result', { preparePrivateStorage: jest.fn().mockResolvedValue({ directory: '   ' }) }],
  ])('fails closed for %s', async (_label, nativeModule) => {
    const port = createNativePrivateStoragePort(nativeModule);
    const result = await port.preparePrivateStorage();
    expect(result).toMatchObject({ ok: false, error: { code: 'private-storage-unavailable' } });
    expect(JSON.stringify(result)).not.toContain('/private/path');
  });

  it.each(['android', 'ios'])('%s native preparation failure performs zero database opens', async () => {
    const openDatabase = jest.fn();
    const initializer = createDatabaseInitializer({
      privateStorage: createNativePrivateStoragePort({
        preparePrivateStorage: jest.fn().mockRejectedValue(new Error('native failure')),
      }),
      driver: { openDatabase },
      migrate: jest.fn(),
    });

    await expect(initializer.initialize()).resolves.toMatchObject({
      ok: false,
      error: { code: 'private-storage-unavailable' },
    });
    expect(openDatabase).not.toHaveBeenCalled();
  });
});
