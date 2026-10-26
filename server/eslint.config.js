import js from '@eslint/js';
import globals from 'globals';

// Layer rules (see the header of each example.js). Real imports between layers:
//   usecases -> domain      controllers -> dto      dto -> domain/errors.js
//   dao -> dao/db.js        routes -> express
// Everything else is handed over by app.js, which is free to import anything.
// Only dao/db.js imports the database driver (pg).
const forbid = (message, ...group) => ({
  'no-restricted-imports': ['error', { patterns: [{ group, message }] }],
});

const noClock = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date']",
      message: 'Do not read the clock here: use the injected clock, or take the time as a parameter.',
    },
    {
      selector: "CallExpression[callee.object.name='Date']",
      message: 'Do not read the clock here: use the injected clock, or take the time as a parameter.',
    },
  ],
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
    rules: {
      eqeqeq: 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/domain/**/*.js'],
    rules: {
      ...forbid(
        'domain/ must stay pure: no imports from other layers, express or the database.',
        '**/dao/**',
        '**/usecases/**',
        '**/dto/**',
        '**/controllers/**',
        '**/routes/**',
        'express',
        'pg',
      ),
      ...noClock,
    },
  },
  {
    files: ['src/usecases/**/*.js'],
    rules: {
      ...forbid(
        'usecases/ import only domain/: dao modules and the clock arrive as parameters from app.js.',
        '**/dao/**',
        '**/dto/**',
        '**/controllers/**',
        '**/routes/**',
        'express',
        'pg',
      ),
      ...noClock,
    },
  },
  {
    files: ['src/dto/**/*.js'],
    rules: forbid(
      'dto/ only shapes data: it may import domain/errors.js and nothing else from the project.',
      '**/dao/**',
      '**/usecases/**',
      '**/controllers/**',
      '**/routes/**',
      '**/domain/**',
      '!**/domain/errors.js',
      'express',
      'pg',
    ),
  },
  {
    files: ['src/controllers/**/*.js'],
    rules: forbid(
      'controllers/ call the use cases they are given: no dao/, domain/, usecases/ or database imports.',
      '**/dao/**',
      '**/domain/**',
      '**/usecases/**',
      '**/routes/**',
      'pg',
    ),
  },
  {
    files: ['src/routes/**/*.js'],
    rules: forbid(
      'routes/ only map URLs to the controllers they are given: no project imports.',
      '**/dao/**',
      '**/domain/**',
      '**/usecases/**',
      '**/dto/**',
      '**/controllers/**',
      'pg',
    ),
  },
  {
    files: ['src/middleware/**/*.js'],
    rules: forbid(
      'middleware/ imports nothing from the project: what it needs is handed over by app.js.',
      '**/dao/**',
      '**/domain/**',
      '**/usecases/**',
      '**/dto/**',
      '**/controllers/**',
      '**/routes/**',
      'pg',
    ),
  },
  {
    files: ['src/dao/**/*.js'],
    ignores: ['src/dao/db.js'],
    rules: forbid(
      'dao/ only talks to the database through db.js: no driver, no imports from other layers or express.',
      '**/domain/**',
      '**/usecases/**',
      '**/dto/**',
      '**/controllers/**',
      '**/routes/**',
      'express',
      'pg',
    ),
  },
  {
    // db.js is the one file that imports the driver.
    files: ['src/dao/db.js'],
    rules: forbid(
      'db.js only wraps the driver: no imports from other layers or express.',
      '**/domain/**',
      '**/usecases/**',
      '**/dto/**',
      '**/controllers/**',
      '**/routes/**',
      'express',
    ),
  },
];
