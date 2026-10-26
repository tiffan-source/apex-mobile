import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import type { CouleursEmpreinte } from '@empreinte-studio/react-native';

/**
 * Les couleurs d'Empreinte pour la navigation (le fond derrière les transitions, les cartes des écrans) : sans
 * elles, un éclair blanc passerait entre deux écrans en Nuit.
 */
export function navigationTheme(couleurs: CouleursEmpreinte, nuit: boolean): Theme {
  const base = nuit ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: nuit,
    colors: {
      ...base.colors,
      primary: couleurs.encre,
      background: couleurs.fond,
      card: couleurs.fond,
      text: couleurs.encre,
      border: couleurs.trame,
      notification: couleurs.sceau,
    },
  };
}
