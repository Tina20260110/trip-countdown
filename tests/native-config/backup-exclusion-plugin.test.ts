import appConfig from '../../app.json';

const {
  applyBackupAttributes,
  backupRulesXml,
  dataExtractionRulesXml,
  excludedDomains,
} = require('../../plugins/withBackupExclusion');

describe('Android backup exclusion config plugin', () => {
  it('is registered in app config', () => {
    expect(appConfig.expo.plugins).toContain('./plugins/withBackupExclusion');
  });

  it('blocks legacy external-storage permissions contributed by native dependencies', () => {
    expect(appConfig.expo.android?.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ]),
    );
  });

  it('sets manifest backup attributes', () => {
    const manifest = applyBackupAttributes({
      manifest: { application: [{ $: {} }] },
    });
    expect(manifest.manifest.application[0].$).toMatchObject({
      'android:allowBackup': 'false',
      'android:fullBackupContent': '@xml/backup_rules',
      'android:dataExtractionRules': '@xml/data_extraction_rules',
    });
  });

  it('excludes business files and expo-notifications shared preferences from both rule formats', () => {
    expect(excludedDomains).toEqual(
      expect.arrayContaining(['file', 'database', 'sharedpref']),
    );
    for (const domain of excludedDomains) {
      expect(backupRulesXml).toContain(`<exclude domain="${domain}" path="." />`);
      expect(dataExtractionRulesXml.match(new RegExp(`domain="${domain}"`, 'g'))).toHaveLength(2);
    }
    expect(dataExtractionRulesXml).toContain('<cloud-backup');
    expect(dataExtractionRulesXml).toContain('<device-transfer>');
  });
});
