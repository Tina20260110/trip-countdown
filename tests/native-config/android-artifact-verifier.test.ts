const {
  extractPermissions,
  verifyAndroidManifest,
  verifyBackupRules,
} = require('../../scripts/lib/android-artifact-verifier');
const {
  backupRulesXml,
  dataExtractionRulesXml,
} = require('../../plugins/withBackupExclusion');

const protectedManifest = `
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
  <application
    android:allowBackup="false"
    android:fullBackupContent="@xml/backup_rules"
    android:dataExtractionRules="@xml/data_extraction_rules" />
</manifest>`;

describe('Android generated artifact verifier', () => {
  it('accepts the intended backup configuration and non-sensitive notification permission', () => {
    expect(verifyAndroidManifest(protectedManifest)).toEqual({
      permissions: ['android.permission.POST_NOTIFICATIONS'],
    });
    expect(() => verifyBackupRules(backupRulesXml, dataExtractionRulesXml)).not.toThrow();
  });

  it.each([
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.CAMERA',
    'android.permission.READ_CONTACTS',
    'android.permission.RECORD_AUDIO',
  ])('rejects forbidden merged permission %s', (permission) => {
    const manifest = protectedManifest.replace(
      '<application',
      `<uses-permission android:name="${permission}" />\n  <application`,
    );
    expect(() => verifyAndroidManifest(manifest)).toThrow(permission);
  });

  it('recognizes version-qualified uses-permission elements', () => {
    const manifest = '<uses-permission-sdk-23 android:name="android.permission.CAMERA" />';
    expect(extractPermissions(manifest)).toEqual(['android.permission.CAMERA']);
  });

  it('treats CNG permission removal markers as blocked rather than effective permissions', () => {
    const manifest = `
      <uses-permission
        android:name="android.permission.READ_EXTERNAL_STORAGE"
        tools:node="remove" />`;
    expect(extractPermissions(manifest)).toEqual([]);
  });

  it('rejects incomplete cloud and device-transfer exclusions', () => {
    expect(() => verifyBackupRules(backupRulesXml, '<data-extraction-rules />')).toThrow(
      'cloud-backup missing',
    );
  });
});
