import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import reactHooks from 'eslint-plugin-react-hooks';

const noImport = (names, message) => ({
  'no-restricted-imports': ['error', { paths: names.map((name) => ({ name, message })) }],
});

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/allure-*/**',
      '**/.aiqa/**',
      '**/.next/**',
      'apps/documentation/dist/**',
      'apps/documentation/.astro/**',
      '**/next-env.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    // Architecture boundary: shared knows nothing about Playwright.
    files: ['packages/shared/**/*.ts'],
    rules: noImport(
      ['@playwright/test', 'playwright', 'playwright-core'],
      'shared must not import Playwright.',
    ),
  },
  {
    // Architecture boundary: engines stay runnable without the test runner.
    files: [
      'packages/ai-engine/**/*.ts',
      'packages/self-healing-engine/**/*.ts',
      'packages/reporting-engine/**/*.ts',
      'packages/test-data-engine/**/*.ts',
    ],
    // reporting-engine may import the reporter *types* (@playwright/test/reporter) but not the runner itself.
    rules: noImport(['@playwright/test'], 'Engines must not import the test runner.'),
  },
  {
    files: [
      'packages/playwright-framework/tests/**/*.ts',
      'packages/api-framework/tests/**/*.ts',
      'packages/data-framework/tests/**/*.ts',
      'packages/dashboard/tests/**/*.ts',
      'apps/web/tests/e2e/**/*.ts',
      // Lab solutions are model answers, so they meet the rules; the exercises break them on purpose.
      'packages/examples/labs/**/solution.spec.ts',
    ],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      // These specs teach skip, conditions and counts on purpose.
      'playwright/no-skipped-test': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/prefer-to-have-count': 'off',
      'playwright/consistent-spacing-between-blocks': 'off',
      'playwright/expect-expect': [
        'error',
        { assertFunctionNames: ['expect', 'expectList', 'expectSchema', 'expectToMatch', 'expectRefused'] },
      ],
    },
  },
  {
    // Setup projects prepare state (health checks, sign-in); they record results, not assertions.
    files: ['packages/*/tests/setup/**/*.ts'],
    rules: { 'playwright/expect-expect': 'off' },
  },
  {
    // React components and the web app: the rules of hooks.
    files: ['packages/dashboard/**/*.tsx', 'apps/web/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
