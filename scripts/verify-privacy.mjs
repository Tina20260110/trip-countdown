import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const productionRoots = ['app', 'src', 'modules', 'plugins'];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.kt', '.swift', '.json']);
const forbiddenSourcePatterns = [
  ['remote push token API', /get(?:Expo|Device)PushTokenAsync/],
  ['Firebase product import', /(?:@react-native-firebase|from\s+['"]firebase(?:\/|['"]))/],
  ['Analytics product API', /(?:FirebaseAnalytics|GoogleAnalytics|expo-firebase-analytics)/],
  ['Crashlytics product API', /(?:FirebaseCrashlytics|crashlytics\s*\()/i],
  ['Firestore product API', /(?:FirebaseFirestore|firestore\s*\()/i],
  ['Firebase Auth product API', /(?:FirebaseAuth|firebase\.auth\s*\()/i],
];

function filesUnder(relativePath) {
  const absolute = join(root, relativePath);
  if (!existsSync(absolute)) return [];
  const entries = [];
  for (const name of readdirSync(absolute)) {
    const child = join(absolute, name);
    if (statSync(child).isDirectory()) entries.push(...filesUnder(child.slice(root.length + 1)));
    else if (sourceExtensions.has(extname(child))) entries.push(child);
  }
  return entries;
}

const failures = [];
for (const file of productionRoots.flatMap(filesUnder)) {
  const source = readFileSync(file, 'utf8');
  for (const [label, pattern] of forbiddenSourcePatterns) {
    if (pattern.test(source)) failures.push(`${label}: ${file.slice(root.length + 1)}`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const dependencyNames = Object.keys({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
});
for (const name of dependencyNames) {
  if (/(?:firebase|analytics|crashlytics|firestore)/i.test(name)) {
    failures.push(`product dependency: ${name}`);
  }
}

const appConfig = readFileSync(join(root, 'app.json'), 'utf8');
if (/googleServicesFile|google-services\.json|GoogleService-Info\.plist/.test(appConfig)) {
  failures.push('Firebase project configuration in app.json');
}
for (const fileName of ['google-services.json', 'GoogleService-Info.plist']) {
  if (existsSync(join(root, fileName))) failures.push(`Firebase project file: ${fileName}`);
}

const notificationsGradle = join(root, 'node_modules/expo-notifications/android/build.gradle');
const hasAcceptedMessagingDependency = existsSync(notificationsGradle)
  && /com\.google\.firebase:firebase-messaging:/.test(readFileSync(notificationsGradle, 'utf8'));
if (!hasAcceptedMessagingDependency) {
  failures.push('expected expo-notifications Firebase Messaging transitive boundary was not observable');
}

if (failures.length > 0) {
  throw new Error(`Privacy verification failed:\n${failures.join('\n')}`);
}

console.log('Privacy source/dependency verification passed.');
console.log('Accepted boundary: expo-notifications includes Firebase Messaging transitively; no product Firebase configuration or API use was found.');
console.log('Device network observation and merged release dependency/manifest review remain pending.');
