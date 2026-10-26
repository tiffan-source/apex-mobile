// Les règles (domaine, application, infrastructure) tournent une fois. L'interface tourne deux fois,
// comme sur iOS puis comme sur Android (Platform.OS, fichiers .ios/.android), comme les composants
// d'Empreinte.
const { getAndroidPreset, getIOSPreset } = require('jest-expo/config');

const REGLES = ['<rootDir>/src/domain', '<rootDir>/src/application', '<rootDir>/src/infrastructure'];
const INTERFACE = ['<rootDir>/src/ui', '<rootDir>/src/state', '<rootDir>/src/features', '<rootDir>/src/app'];

// Les paquets publiés en modules ES (Empreinte, openapi-fetch, marked) passent par Babel comme le reste.
const A_TRANSFORMER = [
  '.pnpm',
  'react-native',
  '@react-native',
  '@react-native-community',
  'expo',
  '@expo',
  'react-navigation',
  '@react-navigation',
  '@empreinte-studio',
  'openapi-fetch',
  'openapi-typescript-helpers',
  'marked',
  'standard-navigation',
];

/** Un projet Jest tiré d'un préréglage de jest-expo, sans les réglages réservés à la racine. */
function projet(preset, nom, couleur, roots, reglagesInterface) {
  const reglages = Object.fromEntries(
    Object.entries(preset).filter(([cle]) => !['passWithNoTests', 'watchPlugins'].includes(cle)),
  );
  return {
    ...reglages,
    displayName: { name: nom, color: couleur },
    roots,
    transformIgnorePatterns: [`/node_modules/(?!(${A_TRANSFORMER.join('|')}))`],
    moduleNameMapper: { ...reglages.moduleNameMapper, '^@/(.*)$': '<rootDir>/src/$1' },
    ...(reglagesInterface
      ? {
          // Reanimated et ses worklets en JavaScript plutôt qu'en natif pendant les tests.
          resolver: '<rootDir>/node_modules/react-native-reanimated/jest/resolver.js',
          setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
        }
      : {}),
  };
}

module.exports = {
  projects: [
    projet(getIOSPreset(), 'Règles', 'magenta', REGLES, false),
    projet(getIOSPreset(), 'iOS', 'blue', INTERFACE, true),
    projet(getAndroidPreset(), 'Android', 'green', INTERFACE, true),
  ],
};
