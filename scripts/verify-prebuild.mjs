import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import verifier from './lib/android-artifact-verifier.js';

const projectRoot = resolve(import.meta.dirname, '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'trip-countdown-prebuild-'));
const isolatedProject = join(temporaryRoot, 'project');
const ignored = new Set(['.git', '.expo', 'android', 'ios', 'node_modules', 'coverage']);

function copyFilter(source) {
  return !ignored.has(basename(source));
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: isolatedProject,
    env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
    stdio: 'inherit',
  });
}

function read(relativePath) {
  const file = join(isolatedProject, relativePath);
  if (!existsSync(file)) throw new Error(`Missing generated artifact: ${relativePath}`);
  return readFileSync(file, 'utf8');
}

function generatedEvidence() {
  const artifacts = {
    manifest: read('android/app/src/main/AndroidManifest.xml'),
    legacyRules: read('android/app/src/main/res/xml/backup_rules.xml'),
    modernRules: read('android/app/src/main/res/xml/data_extraction_rules.xml'),
    androidSettings: read('android/settings.gradle'),
    iosPodfile: read('ios/Podfile'),
  };
  for (const expected of [
    'android:allowBackup="false"',
    'android:fullBackupContent="@xml/backup_rules"',
    'android:dataExtractionRules="@xml/data_extraction_rules"',
  ]) {
    if (!artifacts.manifest.includes(expected)) throw new Error(`Manifest missing ${expected}`);
  }
  verifier.verifyAndroidManifest(artifacts.manifest);
  verifier.verifyBackupRules(artifacts.legacyRules, artifacts.modernRules);
  return createHash('sha256').update(JSON.stringify(artifacts)).digest('hex');
}

try {
  cpSync(projectRoot, isolatedProject, { recursive: true, filter: copyFilter });
  symlinkSync(
    join(projectRoot, 'node_modules'),
    join(isolatedProject, 'node_modules'),
    lstatSync(join(projectRoot, 'node_modules')).isDirectory() ? 'dir' : undefined,
  );

  const hashes = [];
  for (let runNumber = 1; runNumber <= 2; runNumber += 1) {
    // Expo SDK 57 prebuild is clean by default; omitting --no-clean is the
    // versioned equivalent of the historical --clean flag.
    run('npx', ['expo', 'prebuild', '--no-install', '--platform', 'all']);
    run('npx', ['expo-modules-autolinking', 'verify', '--verbose']);
    hashes.push(generatedEvidence());
  }
  if (hashes[0] !== hashes[1]) throw new Error('Repeated clean prebuild artifacts differ');
  console.log(`CNG verification passed: ${hashes[0]}`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
