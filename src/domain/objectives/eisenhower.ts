import { QUADRANTS, TITRES_QUADRANTS, type Quadrant } from '@empreinte-studio/noyau';
import type { Levels } from './objective';

/*
 * La matrice d'Eisenhower d'Apex, avec les quadrants d'Empreinte. La règle est celle d'`apex-library`
 * (`ApexLibsMetier.getEisenhowerCategory`) : à partir de 3, un pas est important (ou urgent).
 *
 * | Importance | Urgence | Catégorie d'Apex | Quadrant d'Empreinte |
 * | ≥ 3        | ≥ 3     | DO (Faire)       | maintenant           |
 * | ≥ 3        | < 3     | SCHEDULE         | planifier            |
 * | < 3        | ≥ 3     | DELEGATE         | confier              |
 * | < 3        | < 3     | DELETE           | laisser-filer        |
 */

export type { Quadrant };
export { QUADRANTS, TITRES_QUADRANTS };

/** Le seuil d'`apex-library` : à partir de 3, un pas est important (ou urgent). */
export const EISENHOWER_THRESHOLD = 3;

/** Les niveaux vont de 1 à 5. */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

/** Ce que chaque quadrant demande : important ou secondaire, urgent ou pas urgent. */
export const QUADRANT_AXES: Readonly<
  Record<Quadrant, { readonly important: boolean; readonly urgent: boolean }>
> = {
  maintenant: { important: true, urgent: true },
  planifier: { important: true, urgent: false },
  confier: { important: false, urgent: true },
  'laisser-filer': { important: false, urgent: false },
};

/** Le quadrant d'un pas, selon la règle d'Apex. */
export function quadrantOf(levels: Levels): Quadrant {
  const important = levels.importance >= EISENHOWER_THRESHOLD;
  const urgent = levels.urgency >= EISENHOWER_THRESHOLD;
  if (important) return urgent ? 'maintenant' : 'planifier';
  return urgent ? 'confier' : 'laisser-filer';
}

/**
 * L'importance et l'urgence d'un pas déplacé vers un quadrant, en ne changeant que ce qui doit changer :
 * côté « important » ou « urgent », une valeur sous 3 passe à 3 ; côté « secondaire » ou « pas urgent »,
 * une valeur de 3 ou plus passe à 2. Le reste ne bouge pas.
 */
export function levelsForQuadrant(levels: Levels, quadrant: Quadrant): Levels {
  const { important, urgent } = QUADRANT_AXES[quadrant];
  return {
    importance: adjustLevel(levels.importance, important),
    urgency: adjustLevel(levels.urgency, urgent),
  };
}

function adjustLevel(value: number, high: boolean): number {
  if (high) return value < EISENHOWER_THRESHOLD ? EISENHOWER_THRESHOLD : value;
  return value >= EISENHOWER_THRESHOLD ? EISENHOWER_THRESHOLD - 1 : value;
}

/** Les trois autres quadrants : là où un pas peut aller depuis le sien. */
export function otherQuadrants(quadrant: Quadrant): Quadrant[] {
  return QUADRANTS.filter((target) => target !== quadrant);
}

/**
 * Les niveaux d'un nouveau pas : important, pas urgent, donc « À planifier ». Le brand book d'Empreinte en
 * fait le cœur de la progression : c'est là qu'on place les pas des objectifs (cahier de migration, § 4).
 */
export const NEW_TASK_LEVELS: Levels = { importance: 3, urgency: 2 };

/** Une valeur de niveau et son libellé. */
export type LevelOption = { readonly value: number; readonly label: string };

/** L'importance d'un pas, de 1 à 5, avec les libellés du client web. */
export const IMPORTANCE_OPTIONS: readonly LevelOption[] = [
  { value: 1, label: 'Accessoire' },
  { value: 2, label: 'Secondaire' },
  { value: 3, label: 'Important' },
  { value: 4, label: 'Très important' },
  { value: 5, label: 'Essentiel' },
];

/** L'urgence d'un pas, de 1 à 5, avec les libellés du client web. */
export const URGENCY_OPTIONS: readonly LevelOption[] = [
  { value: 1, label: 'Rien ne presse' },
  { value: 2, label: 'Pas urgent' },
  { value: 3, label: 'Urgent' },
  { value: 4, label: 'Très urgent' },
  { value: 5, label: 'Tout de suite' },
];

/** Ce que dit un quadrant de ses deux axes : « Important · urgent ». */
export const QUADRANT_DESCRIPTIONS: Readonly<Record<Quadrant, string>> = {
  maintenant: 'Important · urgent',
  planifier: 'Important · pas urgent',
  confier: 'Secondaire · urgent',
  'laisser-filer': 'Secondaire · pas urgent',
};
