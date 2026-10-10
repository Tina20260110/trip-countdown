const fs = require('node:fs/promises');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const excludedDomains = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];

function exclusions(indent) {
  return excludedDomains
    .map((domain) => `${indent}<exclude domain="${domain}" path="." />`)
    .join('\n');
}

const backupRulesXml = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${exclusions('  ')}
</full-backup-content>
`;

const dataExtractionRulesXml = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup disableIfNoEncryptionCapabilities="false">
${exclusions('    ')}
  </cloud-backup>
  <device-transfer>
${exclusions('    ')}
  </device-transfer>
</data-extraction-rules>
`;

function applyBackupAttributes(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) throw new Error('Android application manifest entry is unavailable');
  application.$ = application.$ || {};
  application.$['android:allowBackup'] = 'false';
  application.$['android:fullBackupContent'] = '@xml/backup_rules';
  application.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
  return androidManifest;
}

async function writeBackupRules(projectRoot) {
  const resourceDirectory = path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'res',
    'xml',
  );
  await fs.mkdir(resourceDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(resourceDirectory, 'backup_rules.xml'), backupRulesXml),
    fs.writeFile(
      path.join(resourceDirectory, 'data_extraction_rules.xml'),
      dataExtractionRulesXml,
    ),
  ]);
}

function withBackupExclusion(config) {
  config = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = applyBackupAttributes(modConfig.modResults);
    return modConfig;
  });
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      await writeBackupRules(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);
}

module.exports = withBackupExclusion;
module.exports.applyBackupAttributes = applyBackupAttributes;
module.exports.backupRulesXml = backupRulesXml;
module.exports.dataExtractionRulesXml = dataExtractionRulesXml;
module.exports.excludedDomains = excludedDomains;
module.exports.writeBackupRules = writeBackupRules;
