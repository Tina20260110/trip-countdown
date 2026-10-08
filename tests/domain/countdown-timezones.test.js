const { spawnSync } = require('node:child_process');
const path = require('node:path');

describe('calculateCountdown in independent timezone processes', () => {
  const fixture = path.join(__dirname, 'fixtures/countdown-timezone.fixture.ts');
  const fixtureConfig = path.join(__dirname, 'fixtures/jest.timezone.config.js');
  const jestExecutable = require.resolve('jest/bin/jest');

  it.each(['Asia/Shanghai', 'America/New_York'])(
    'preserves calendar-day results in %s, including DST boundaries',
    (timezone) => {
      const result = spawnSync(
        process.execPath,
        [
          jestExecutable,
          '--config',
          fixtureConfig,
          '--ci',
          '--runInBand',
          '--runTestsByPath',
          fixture,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, TZ: timezone },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      expect({
        status: result.status,
        signal: result.signal,
        stdout: result.stdout,
        stderr: result.stderr,
      }).toMatchObject({ status: 0, signal: null });
    },
    20_000,
  );
});
