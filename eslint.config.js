// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ---------------------------------------------------------------------------
  // Architectural rule 1: device input events exist in exactly one place.
  //
  // This is what actually stops the PC and mobile code paths diverging. Both
  // must funnel through InputProvider -> InputState -> PlayerController, so no
  // module outside src/input/ may touch a raw device event.
  // ---------------------------------------------------------------------------
  {
    files: ['src/**/*.ts'],
    ignores: ['src/input/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'KeyboardEvent', message: 'Device events belong in src/input/ only.' },
        { name: 'TouchEvent', message: 'Device events belong in src/input/ only.' },
        { name: 'PointerEvent', message: 'Device events belong in src/input/ only.' },
        { name: 'MouseEvent', message: 'Device events belong in src/input/ only.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='addEventListener'][arguments.0.value=/^(key|touch|pointer|mouse|wheel)/]",
          message:
            'Register device listeners in an InputProvider under src/input/, not here.',
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Architectural rule 2: no dimensional magic numbers in part builders.
  //
  // Every measurement must come from src/spec so that the dimension tests and
  // the DimensionOverlay are asserting the same values the geometry uses.
  // Small numbers (segment counts, indices, 0/1/2 detail levels) are exempt.
  // ---------------------------------------------------------------------------
  {
    files: ['src/parts/**/*.ts'],
    rules: {
      'no-magic-numbers': [
        'error',
        {
          ignore: [-2, -1, 0, 0.5, 1, 2, 3, 4, 5],
          ignoreArrayIndexes: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
    },
  },

  {
    files: ['tests/**/*.ts', '*.config.ts', 'eslint.config.js'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
