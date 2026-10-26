import type { Href } from 'expo-router';

/*
 * Les adresses de l'application, au même endroit : les mêmes chemins que le client web (`/objectifs/:id`,
 * `/objectifs/:id/akari`, `/matrice`, `/auth`), pour qu'un lien ouvre le même écran partout. Les feuilles ont
 * aussi leur adresse : le geste de retour d'Android les referme. Jamais d'id temporaire dans une adresse.
 */
export const routes = {
  home: '/' as Href,
  matrix: '/matrice' as Href,
  auth: '/auth' as Href,
  settings: '/reglages' as Href,
  newObjective: '/objectifs/nouveau' as Href,
  objective: (objectiveId: string): Href => `/objectifs/${objectiveId}`,
  /** Akari sur un objectif ; avec une étape, Akari propose des pas pour elle. */
  akari: (objectiveId: string, stageId?: string | null): Href =>
    stageId
      ? { pathname: '/objectifs/[id]/akari', params: { id: objectiveId, etape: stageId } }
      : `/objectifs/${objectiveId}/akari`,
  editObjective: (objectiveId: string): Href => `/objectifs/${objectiveId}/modifier`,
  addStage: (objectiveId: string): Href => `/objectifs/${objectiveId}/nouvelle-etape`,
  editStage: (stageId: string): Href => `/etapes/${stageId}/modifier`,
  /** Ajouter un pas, l'étape proposée par défaut étant celle-ci. */
  addTask: (stageId: string): Href => `/etapes/${stageId}/nouveau-pas`,
  /** Modifier un pas ; `shownStageId` est l'étape où il est affiché (rien pour un pas sans étape). */
  editTask: (taskId: string, shownStageId?: string | null): Href =>
    shownStageId
      ? { pathname: '/pas/[id]/modifier', params: { id: taskId, etape: shownStageId } }
      : `/pas/${taskId}/modifier`,
} as const;

/** Un paramètre d'adresse : une seule valeur, ou null. */
export function routeParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
}
