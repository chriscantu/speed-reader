import globals from 'globals';

export default [
  {
    // Extension source files — browser environment with WebExtension globals
    files: ['SpeedReader/SpeedReaderExtension/Resources/**/*.js'],
    ignores: ['SpeedReader/SpeedReaderExtension/Resources/lib/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        browser: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-implicit-globals': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'off', // content.js must use var for Safari classic script compat
      'no-throw-literal': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    // Test files — Node.js environment
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Ignore vendored libraries
    ignores: ['SpeedReader/SpeedReaderExtension/Resources/lib/**'],
  },
];
