import { compter } from '@empreinte-studio/noyau';
import { STAGE_STATE_LABELS, type StageState } from '@/domain/objectives/progress';
import { typesetTexts } from '@/domain/shared/typography';

/** Les textes de l'arête d'un objectif (`/objectifs/:id`), repris du client web. */
export const OBJECTIVE_TEXTS = typesetTexts({
  addStage: 'Ajouter une étape',
  editObjective: "Modifier l'objectif",
  arete: (stageCount: number) => `L'arête · ${compter(stageCount, 'étape')}`,
  stageMarker: (index: number, state: StageState) => `Étape ${index} · ${STAGE_STATE_LABELS[state]}`,
  stageChosen: (index: number, state: StageState, name: string) =>
    `Étape ${index} · ${STAGE_STATE_LABELS[state]} : ${name}`,
  edit: 'Modifier',
  editTaskLabel: (title: string) => `Modifier « ${title} »`,
  addTask: 'Ajouter un pas',
  proposeTasks: 'Proposer des pas avec Akari',
  editStage: "Modifier l'étape",
  firstStage: "Une arête commence par une étape. Ajoute la première, ou demande-moi de t'en proposer.",
  firstStagePlain: 'Une arête commence par une étape.',
  proposeStages: 'Proposer des étapes',
  looseTitle: 'Pas sans étape',
  looseHint: (hasStages: boolean) =>
    hasStages
      ? 'Ces pas ne sont dans aucune étape. Range-les avec « Modifier ».'
      : 'Ces pas ne sont dans aucune étape. Ajoute une étape, puis range-les avec « Modifier ».',
  loading: 'Chargement de ton objectif…',
} as const);
