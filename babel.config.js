// Metro et Jest : le préréglage d'Expo (TypeScript, JSX, plugin des worklets de Reanimated).
module.exports = function configurer(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
