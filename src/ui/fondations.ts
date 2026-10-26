/*
 * Les fondations d'Empreinte qu'Apex utilise pour sa mise en page : les pas (espacements), les traits, les
 * cornes et les durées, en nombres pour React Native. Les couleurs viennent toujours du thème (`useTheme`).
 */
export { cornes, durees, pas, traits } from '@empreinte-studio/tokens/native';

/** Une couleur du thème avec une opacité (le fond voilé derrière une feuille, comme `color-mix` sur le web). */
export function avecOpacite(couleur: string, opacite: number): string {
  const hex = couleur.replace('#', '');
  const plein = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6);
  const alpha = Math.round(Math.max(0, Math.min(1, opacite)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${plein}${alpha}`;
}

/** La gouttière d'un écran de téléphone (« pas-4 : gouttière mobile »). */
export const GOUTTIERE = 16;

/** La largeur au-delà de laquelle le contenu ne s'étire plus (tablettes) : une colonne lisible. */
export const LARGEUR_MAX = 720;
