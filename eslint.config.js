import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'server/dist/**',
      'coverage/**',
      'playwright-report/**',
      'lighthouse-report/**',
      'test-results/**',
      'node_modules/**',
      // Tutorial video tooling (docs/video/README.md): scripts, not app code.
      'docs/video/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Shared TypeScript rules
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // Browser app
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: { globals: globals.browser },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    // Generated shadcn/ui primitives are kept as upstream ships them.
    files: ['src/components/ui/**'],
    rules: {
      'jsx-a11y/anchor-has-content': 'off',
      'jsx-a11y/heading-has-content': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
    },
  },
  {
    // Server, scripts, tests and config run in Node
    files: ['server/**/*.ts', 'e2e/**/*.ts', 'scripts/**/*.{js,mjs,ts}', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // CommonJS config files (PM2 ecosystem).
    files: ['**/*.cjs'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Tests may use `any` for request/response fixtures.
    files: ['server/test/**', 'src/**/*.test.{ts,tsx}', 'src/test/**', 'e2e/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
