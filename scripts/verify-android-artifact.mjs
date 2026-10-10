import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import verifier from './lib/android-artifact-verifier.js';

const [manifestPath, legacyRulesPath, modernRulesPath] = process.argv.slice(2);
if (!manifestPath || !legacyRulesPath || !modernRulesPath) {
  console.error(
    'Usage: node scripts/verify-android-artifact.mjs <merged-manifest> <backup_rules.xml> <data_extraction_rules.xml>',
  );
  process.exitCode = 2;
} else {
  const manifest = readFileSync(resolve(manifestPath), 'utf8');
  const legacyRules = readFileSync(resolve(legacyRulesPath), 'utf8');
  const modernRules = readFileSync(resolve(modernRulesPath), 'utf8');
  const result = verifier.verifyAndroidManifest(manifest);
  verifier.verifyBackupRules(legacyRules, modernRules);
  console.log(`Android artifact verification passed (${result.permissions.length} permissions inspected).`);
}
