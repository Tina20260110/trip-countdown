const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const uiBoundaryRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['expo-sqlite', 'expo-sqlite/*'],
          message: 'UI routes and features must not import SQLite directly.',
        },
        {
          group: [
            '@/src/data',
            '@/src/data/**',
            '**/src/data',
            '**/src/data/**',
            '../data',
            '../data/**',
            '../../data',
            '../../data/**',
          ],
          message:
            'UI routes and features must depend on typed boundaries, not data or SQL implementations.',
        },
      ],
    },
  ],
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['.expo/**', 'coverage/**', 'dist/**', 'build/**', 'node_modules/**'],
  },
  {
    files: ['app/**/*.{js,jsx,ts,tsx}', 'src/features/**/*.{js,jsx,ts,tsx}'],
    rules: uiBoundaryRules,
  },
  {
    files: ['components/EditScreenInfo.tsx'],
    rules: {
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}', '"'] }],
    },
  },
]);
