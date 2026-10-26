/*
 * Les objectifs et les pas tels que le client les connaît : la copie, à plat, de ce que rend
 * `GET /v1/objectives`, plus les éléments optimistes en cours d'enregistrement.
 *
 * Vocabulaire (cahier de migration d'Apex, § 4) : un objectif est un objectif racine (`parentId === null`) ;
 * une étape est un sous-objectif direct d'un objectif ; un pas est une tâche. L'interface s'arrête à trois
 * niveaux, le modèle non : les pas d'un sous-objectif plus profond comptent dans leur étape.
 */

export type Objective = {
  readonly id: string;
  readonly title: string;
  /** Vide s'il n'a pas été écrit. */
  readonly description: string;
  /** Le « pourquoi », vide s'il n'a pas été dit. */
  readonly why: string;
  /** L'échéance, instant ISO 8601 (minuit local du jour choisi), ou null. */
  readonly dueDate: string | null;
  /** L'objectif (ou l'étape) parent ; null pour un objectif racine. */
  readonly parentId: string | null;
};

export type Task = {
  readonly id: string;
  readonly title: string;
  /** De 1 à 5 ; à partir de 3, le pas est important. */
  readonly importance: number;
  /** De 1 à 5 ; à partir de 3, le pas est urgent. */
  readonly urgency: number;
  readonly done: boolean;
  /** L'objectif, l'étape ou le sous-objectif plus profond qui porte le pas. */
  readonly objectiveId: string;
};

/** L'importance et l'urgence d'un pas. */
export type Levels = {
  readonly importance: number;
  readonly urgency: number;
};

/** Tout ce que la personne a : ses objectifs, étapes et sous-objectifs, et ses pas, dans l'ordre de création. */
export type ObjectivesSnapshot = {
  readonly objectives: readonly Objective[];
  readonly tasks: readonly Task[];
  /**
   * Vrai dès qu'une lecture du serveur a abouti. Faux tant que la copie ne contient que des éléments
   * optimistes : les écrans n'affirment alors rien (ni « aucun objectif », ni « introuvable »).
   */
  readonly loaded: boolean;
};

export const EMPTY_SNAPSHOT: ObjectivesSnapshot = { objectives: [], tasks: [], loaded: false };
