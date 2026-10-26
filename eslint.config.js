// ESLint : la configuration d'Expo, Prettier pour la forme, et la règle de dépendance des couches
// (docs/architecture.md), vérifiée à chaque lint comme les tags Nx d'Apex Brain.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

/** Une couche interdite : par l'alias `@/` comme par un chemin relatif. */
const couche = (nom, message) => ({ group: [`@/${nom}`, `@/${nom}/**`, `**/${nom}/**`], message });

const INTERDITS = {
  application: couche('application', 'Une couche plus profonde ne connaît pas l’application.'),
  infrastructure: couche('infrastructure', 'Seule la racine de composition connaît l’infrastructure.'),
  state: couche('state', 'L’état React ne se lit que depuis les écrans (features) et les routes.'),
  ui: couche('ui', 'Les compositions d’interface ne se posent que dans les écrans.'),
  features: couche('features', 'Les écrans ne se posent que dans les routes.'),
  app: couche('app', 'Les routes ne s’importent pas.'),
  composition: couche('composition', 'La racine de composition ne s’importe que dans la route racine.'),
  domain: couche(
    'domain',
    'Les compositions d’interface ignorent le domaine : elles reçoivent des textes et des nombres.',
  ),
};

const REACT = {
  group: ['react', 'react/**', 'react-native', 'react-native/**', 'react-native-*', 'react-native-*/**'],
  message: 'Cette couche ne dépend ni de React ni de React Native.',
};
const EXPO = {
  group: ['expo', 'expo-*', 'expo-*/**', '@expo/**'],
  message: 'Cette couche ne dépend pas d’Expo.',
};
const TANSTACK = { group: ['@tanstack/**'], message: 'TanStack Query reste dans la couche state.' };
const EMPREINTE_RENDU = {
  group: ['@empreinte-studio/react-native', '@empreinte-studio/tokens', '@empreinte-studio/tokens/**'],
  message: 'Seule l’interface dessine : le domaine et l’application ne lisent que @empreinte-studio/noyau.',
};

/** Une règle `no-restricted-imports` pour une couche. */
const restreindre = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

module.exports = defineConfig([
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      'dist/**',
      '.expo/**',
      'vendor/**',
      'node_modules/**',
      'src/infrastructure/apex-brain/schema.d.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  restreindre(
    ['src/domain/**'],
    [
      INTERDITS.application,
      INTERDITS.infrastructure,
      INTERDITS.state,
      INTERDITS.ui,
      INTERDITS.features,
      INTERDITS.app,
      INTERDITS.composition,
      REACT,
      EXPO,
      TANSTACK,
      EMPREINTE_RENDU,
    ],
  ),
  restreindre(
    ['src/application/**'],
    [
      INTERDITS.infrastructure,
      INTERDITS.state,
      INTERDITS.ui,
      INTERDITS.features,
      INTERDITS.app,
      INTERDITS.composition,
      REACT,
      EXPO,
      TANSTACK,
      EMPREINTE_RENDU,
    ],
  ),
  restreindre(
    ['src/infrastructure/**'],
    [
      INTERDITS.state,
      INTERDITS.ui,
      INTERDITS.features,
      INTERDITS.app,
      INTERDITS.composition,
      { group: ['react', 'react/**'], message: 'L’infrastructure ne rend rien : pas de React.' },
      TANSTACK,
      EMPREINTE_RENDU,
    ],
  ),
  restreindre(
    ['src/state/**'],
    [
      INTERDITS.infrastructure,
      INTERDITS.ui,
      INTERDITS.features,
      INTERDITS.app,
      INTERDITS.composition,
      EMPREINTE_RENDU,
    ],
  ),
  restreindre(
    ['src/ui/**'],
    [
      INTERDITS.domain,
      INTERDITS.application,
      INTERDITS.infrastructure,
      INTERDITS.state,
      INTERDITS.features,
      INTERDITS.app,
      INTERDITS.composition,
      TANSTACK,
    ],
  ),
  restreindre(['src/features/**'], [INTERDITS.infrastructure, INTERDITS.app, INTERDITS.composition]),
  restreindre(['src/app/**'], [INTERDITS.infrastructure, INTERDITS.application, INTERDITS.composition]),
  {
    // La route racine installe la racine de composition, et elle seule.
    files: ['src/app/_layout.tsx'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [INTERDITS.infrastructure, INTERDITS.application] }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'jest.setup.ts', 'src/testing/**'],
    languageOptions: { globals: { jest: 'readonly' } },
    rules: { 'no-restricted-imports': 'off' },
  },
]);
