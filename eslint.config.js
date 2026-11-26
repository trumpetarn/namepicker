import js from '@eslint/js';
import globals from 'globals';
import html from 'eslint-plugin-html';

export default [
  { ignores: ['node_modules/', '.claude/'] },

  js.configs.recommended,

  {
    rules: {
      // `catch {}` is used on purpose to ignore unavailable storage, bad
      // JSON and cancelled share sheets.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // The page: plain browser scripts (no modules), in .js files or inline in
  // index.html. They share globals across files, so no-undef is off; tsc
  // (tsconfig/app.json) resolves names across the whole page instead.
  {
    files: ['*.{js,html}'],
    ignores: ['eslint.config.js'],
    plugins: { html },
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
    rules: {
      'no-undef': 'off',
      // Top-level declarations in a script are globals another script (or an
      // inline handler) may use, so only flag unused locals.
      'no-unused-vars': ['error', { vars: 'local', args: 'after-used', caughtErrors: 'none' }],
    },
  },

  {
    files: ['sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },

  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
];
