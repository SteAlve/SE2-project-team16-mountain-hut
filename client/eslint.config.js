import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// Layer rules (see the header of each example file):
//   pages -> hooks, components      hooks -> api, lib      components -> lib
//   api and lib import nothing of the project. App.jsx and main.jsx are free.
const forbid = (message, ...group) => ({
  'no-restricted-imports': ['error', { patterns: [{ group, message }] }],
});

// Only api/ talks to the server.
const noFetch = {
  'no-restricted-globals': ['error', { name: 'fetch', message: 'Only api/ talks to the server.' }],
};

const reactLibs = ['react', 'react-dom', 'react-router-dom'];

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      eqeqeq: 'error',
      // Capitalized names are components: used in JSX, which this rule does not see.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/lib/**/*.{js,jsx}'],
    rules: {
      ...forbid(
        'lib/ is pure: no React and no imports from other folders.',
        '**/api/**',
        '**/hooks/**',
        '**/components/**',
        '**/pages/**',
        ...reactLibs,
      ),
      ...noFetch,
    },
  },
  {
    files: ['src/api/**/*.{js,jsx}'],
    rules: forbid(
      'api/ only talks to the server: no React and no imports from other folders.',
      '**/lib/**',
      '**/hooks/**',
      '**/components/**',
      '**/pages/**',
      ...reactLibs,
    ),
  },
  {
    files: ['src/hooks/**/*.{js,jsx}'],
    rules: {
      ...forbid(
        'hooks/ hold data and state: no imports from components/ or pages/.',
        '**/components/**',
        '**/pages/**',
      ),
      ...noFetch,
    },
  },
  {
    files: ['src/components/**/*.{js,jsx}'],
    rules: {
      ...forbid(
        'components/ only draw their props: no api/, hooks/ or pages/ (they may import lib/).',
        '**/api/**',
        '**/hooks/**',
        '**/pages/**',
      ),
      ...noFetch,
    },
  },
  {
    files: ['src/pages/**/*.{js,jsx}'],
    rules: {
      ...forbid('pages/ go through hooks/: no api/ imports.', '**/api/**'),
      ...noFetch,
    },
  },
];
