module.exports = {
  root: true,
  env: { node: true, es2020: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest' },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_|next' }],
    'no-console': 'off',
  },
  overrides: [
    {
      // vitest.config.js usa globals: true
      files: ['src/__tests__/**/*.js', 'tests/**/*.js'],
      globals: {
        vi: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly',
        beforeAll: 'readonly', afterAll: 'readonly', beforeEach: 'readonly', afterEach: 'readonly',
      },
    },
  ],
};
