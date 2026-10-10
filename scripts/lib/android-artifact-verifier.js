const EXACT_ALARM_PERMISSIONS = new Set([
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
]);

const UNRELATED_SENSITIVE_PERMISSIONS = new Set([
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',
  'android.permission.READ_CALENDAR',
  'android.permission.READ_CALL_LOG',
  'android.permission.READ_CONTACTS',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_PHONE_STATE',
  'android.permission.RECORD_AUDIO',
  'android.permission.WRITE_CALENDAR',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.WRITE_CONTACTS',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]);

function extractPermissions(manifest) {
  return [...manifest.matchAll(/<uses-permission(?:-sdk-\d+)?\b[^>]*>/g)]
    .filter((match) => !/tools:node=["']remove["']/.test(match[0]))
    .map((match) => match[0].match(/android:name=["']([^"']+)["']/)?.[1])
    .filter((permission) => typeof permission === 'string');
}

function verifyAndroidManifest(manifest, { requireBackupAttributes = true } = {}) {
  const failures = [];
  if (requireBackupAttributes) {
    for (const attribute of [
      'android:allowBackup="false"',
      'android:fullBackupContent="@xml/backup_rules"',
      'android:dataExtractionRules="@xml/data_extraction_rules"',
    ]) {
      if (!manifest.includes(attribute)) failures.push(`missing ${attribute}`);
    }
  }

  const permissions = extractPermissions(manifest);
  for (const permission of permissions) {
    if (EXACT_ALARM_PERMISSIONS.has(permission)) {
      failures.push(`exact alarm permission present: ${permission}`);
    }
    if (UNRELATED_SENSITIVE_PERMISSIONS.has(permission)) {
      failures.push(`unrelated sensitive permission present: ${permission}`);
    }
  }

  if (failures.length > 0) throw new Error(failures.join('; '));
  return { permissions };
}

function verifyBackupRules(legacyRules, modernRules) {
  const failures = [];
  const requiredDomains = ['file', 'database', 'sharedpref'];
  if (!legacyRules.includes('<full-backup-content>')) failures.push('legacy root missing');
  if (!modernRules.includes('<cloud-backup')) failures.push('cloud-backup missing');
  if (!modernRules.includes('<device-transfer>')) failures.push('device-transfer missing');
  for (const domain of requiredDomains) {
    if (!legacyRules.includes(`<exclude domain="${domain}" path="." />`)) {
      failures.push(`legacy ${domain} exclusion missing`);
    }
    const count = modernRules.split(`domain="${domain}"`).length - 1;
    if (count !== 2) failures.push(`modern ${domain} exclusions expected twice, received ${count}`);
  }
  if (failures.length > 0) throw new Error(failures.join('; '));
}

module.exports = {
  EXACT_ALARM_PERMISSIONS,
  UNRELATED_SENSITIVE_PERMISSIONS,
  extractPermissions,
  verifyAndroidManifest,
  verifyBackupRules,
};
