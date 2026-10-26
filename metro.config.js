// Metro : la configuration d'Expo telle quelle (alias `@/` lus dans tsconfig.json).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
