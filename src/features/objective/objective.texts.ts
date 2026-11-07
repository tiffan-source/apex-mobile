import { compter } from '@empreinte-studio/noyau';
import { stageStateLabel } from '@/domain/objectives/progress';
import { typesetTexts } from '@/domain/shared/typography';

/** Les textes de l'arête d'un objectif (`/objectifs/:id`), repris du client web. */
export const OBJECTIVE_TEXTS = typesetTexts({
  addStage: 'Ajouter une étape',
  editObjective: "Modifier l'objectif",
  arete: (stageCount: number) => `L'arête · ${compter(stageCount, 'étape')}`,
  stageMarker: (done: boolean) => `Étape · ${stageStateLabel(done)}`,
  stageChosen: (done: boolean, name: string) => `${name} · ${stageStateLabel(done)}`,
  stageAccomplished: 'étape accomplie',
  chooseStage: "Choisis une étape sur l'arête pour voir ses pas.",
  edit: 'Modifier',
  editTaskLabel: (title: string) => `Modifier « ${title} »`,
  addTask: 'Ajouter un pas',
  proposeTasks: 'Proposer des pas avec Akari',
  editStage: "Modifier l'étape",
  /** La sortie discrète, au pied de l'étape ouverte : elle demande une validation. */
  eraseStage: "Effacer l'étape",
  firstStage: "Une arête se construit avec des étapes. Ajoute-en une, ou demande-moi de t'en proposer.",
  firstStagePlain: 'Une arête se construit avec des étapes.',
  proposeStages: 'Proposer des étapes',
  looseTitle: 'Pas sans étape',
  looseHint: (hasStages: boolean) =>
    hasStages
      ? 'Ces pas ne sont dans aucune étape. Range-les avec « Modifier ».'
      : 'Ces pas ne sont dans aucune étape. Ajoute une étape, puis range-les avec « Modifier ».',
  loading: 'Chargement de ton objectif…',
} as const);
