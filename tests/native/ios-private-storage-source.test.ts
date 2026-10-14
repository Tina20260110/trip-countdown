const { readFileSync } = require('fs');

const moduleSource = readFileSync(
  'modules/expo-trip-native/ios/ExpoTripNativeModule.swift',
  'utf8',
);
const storageSource = readFileSync(
  'modules/expo-trip-native/ios/PrivateStorage.swift',
  'utf8',
);

describe('iOS private storage production source boundary', () => {
  it('resolves the private directory from user-domain Application Support', () => {
    expect(moduleSource).toContain('for: .applicationSupportDirectory');
    expect(moduleSource).toContain('in: .userDomainMask');
    expect(moduleSource).not.toContain('.cachesDirectory');
    expect(moduleSource).not.toContain('temporaryDirectory');
  });

  it('returns a file URL compatible with expo-sqlite path parsing', () => {
    expect(moduleSource).toContain('directory.absoluteString');
    expect(moduleSource).not.toContain('["directory": directory.path]');
  });

  it('sets and reads back backup exclusion for the directory and SQLite files', () => {
    expect(storageSource).toContain('values.isExcludedFromBackup = true');
    expect(storageSource).toContain('forKeys: [.isExcludedFromBackupKey]');
    for (const suffix of ['-wal', '-shm', '-journal']) {
      expect(storageSource).toContain(`\\(privateStorageDatabaseName)${suffix}`);
    }
  });
});
