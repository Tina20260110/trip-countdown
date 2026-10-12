import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'eas.json'), 'utf8'));
const development = config.build?.development;
const preview = config.build?.preview;
const production = config.build?.production;

const failures = [];

if (development?.developmentClient !== true) {
  failures.push('development must set developmentClient=true');
}
if (development?.distribution !== 'internal') {
  failures.push('development must use internal distribution');
}
if (preview?.developmentClient === true) {
  failures.push('preview must not include the development client');
}
if (preview?.distribution !== 'internal') {
  failures.push('preview must use internal distribution');
}
if (preview?.android?.buildType !== 'apk') {
  failures.push('preview Android output must be an installable APK');
}
if (!production || production.developmentClient === true) {
  failures.push('production must remain separate from development-client profiles');
}
if ('submit' in config) {
  failures.push('automatic submission is outside the current phase');
}

const serialized = JSON.stringify(config);
if (/(?:token|secret|password|privateKey)/i.test(serialized)) {
  failures.push('eas.json must not contain secrets');
}

if (failures.length > 0) {
  throw new Error(`EAS config verification failed:\n${failures.join('\n')}`);
}

console.log('EAS profile verification passed.');
console.log('Development: development client + internal distribution.');
console.log('Preview: internal APK without development client; bundled JS is validated by a later build task.');
