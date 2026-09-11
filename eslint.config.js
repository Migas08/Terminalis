const sharedRules = {
  'constructor-super': 'error',
  'for-direction': 'error',
  'getter-return': 'error',
  'no-async-promise-executor': 'error',
  'no-class-assign': 'error',
  'no-constant-binary-expression': 'error',
  'no-const-assign': 'error',
  'no-debugger': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-dupe-else-if': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-loss-of-precision': 'error',
  'no-new-native-nonconstructor': 'error',
  'no-obj-calls': 'error',
  'no-self-assign': 'error',
  'no-setter-return': 'error',
  'no-this-before-super': 'error',
  'no-unreachable': 'error',
  'no-unreachable-loop': 'warn',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'no-unused-private-class-members': 'error',
  'no-unused-vars': [
    'warn',
    {
      args: 'none',
      caughtErrors: 'none',
      ignoreRestSiblings: true,
      varsIgnorePattern: '^_$',
    },
  ],
  'require-yield': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
};

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'work/**'],
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: sharedRules,
  },
  {
    files: ['test/**/*.js', 'tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    rules: sharedRules,
  },
];
