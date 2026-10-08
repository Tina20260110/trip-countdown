const path = require('node:path');

const baseConfig = require('../../../jest.config');

module.exports = {
  ...baseConfig,
  rootDir: path.resolve(__dirname, '../../..'),
  testMatch: ['<rootDir>/tests/domain/fixtures/countdown-timezone.fixture.ts'],
};
