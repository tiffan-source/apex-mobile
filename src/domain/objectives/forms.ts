import { isBeforeToday, isSameDay, toApiDate, toDate } from '../shared/dates';
import type { Levels, Objective } from './objective';
import { typesetTexts } from '../shared/typography';

/*
 * Les formulaires des objectifs : le brouillon d'un nouvel objectif et les feuilles (modifier l'objectif,
 * ajouter ou modifier une étape, ajouter ou modifier un pas). Chaque règle dit ce qu'il faut faire, dans la
 * voix d'Empreinte ; le champ l'écrit en encre, jamais en rouge.
 */

/** Ce que disent les champs quand il manque quelque chose, avec la solution. */
export const FORM_MESSAGES = typesetTexts({
  objectiveTitleRequired: 'Donne un nom à ton objectif pour continuer.',
  objectiveTitleToSave: "Donne un nom à ton objectif pour l'enregistrer.",
  dueDateInPast: "Choisis aujourd'hui ou une date à venir.",
  stageTitleRequired: "Donne un nom à cette étape pour l'ajouter.",
  stageTitleToSave: "Donne un nom à cette étape pour l'enregistrer.",
  taskTitleRequired: "Écris ce pas en quelques mots pour l'ajouter.",
  taskTitleToSave: "Écris ce pas en quelques mots pour l'enregistrer.",
  taskStageRequired: "Choisis l'étape où ranger ce pas.",
} as const);

/** Les erreurs d'un formulaire, champ par champ ; vide quand tout est bon. */
export type FormErrors<K extends string> = Partial<Record<K, string>>;

export function hasErrors(errors: FormErrors<string>): boolean {
  return Object.values(errors).some(Boolean);
}

/** Un texte qui ne compte pas s'il n'a que des espaces. */
function blank(value: string): boolean {
  return value.trim() === '';
}

// #region Nouvel objectif

/** Le brouillon d'un nouvel objectif, tel que la personne l'écrit. Rien n'est enregistré avant l'engagement. */
export type NewObjectiveDraft = {
  readonly title: string;
  readonly why: string;
  readonly description: string;
  /** L'horizon choisi, à minuit en heure locale, ou null. */
  readonly dueDate: Date | null;
};

export const EMPTY_DRAFT: NewObjectiveDraft = { title: '', why: '', description: '', dueDate: null };

/** Le titre est obligatoire ; l'horizon est facultatif, mais jamais avant aujourd'hui. */
export function validateDraft(
  draft: NewObjectiveDraft,
  now: Date = new Date(),
): FormErrors<'title' | 'dueDate'> {
  return {
    ...(blank(draft.title) ? { title: FORM_MESSAGES.objectiveTitleRequired } : {}),
    ...(draft.dueDate && isBeforeToday(draft.dueDate, now) ? { dueDate: FORM_MESSAGES.dueDateInPast } : {}),
  };
}

/** Ce que reçoit la création d'un objectif. */
export type CreateObjectiveInput = {
  readonly title: string;
  readonly why?: string;
  readonly description?: string;
  /** Instant ISO 8601 du minuit local de l'échéance. */
  readonly dueDate?: string;
};

/** Le brouillon prêt à enregistrer : textes sans espaces autour, champs vides omis. null sans titre. */
export function toCreateObjectiveInput(draft: NewObjectiveDraft): CreateObjectiveInput | null {
  const title = draft.title.trim();
  if (!title) return null;
  const why = draft.why.trim();
  const description = draft.description.trim();
  return {
    title,
    ...(why ? { why } : {}),
    ...(description ? { description } : {}),
    ...(draft.dueDate ? { dueDate: toApiDate(draft.dueDate) } : {}),
  };
}

// #endregion

// #region Modifier un objectif ou une étape

/** Un objectif ou une étape, tel que la feuille le montre. */
export type ObjectiveForm = {
  readonly title: string;
  readonly description: string;
  readonly why: string;
  readonly dueDate: Date | null;
};

export function toObjectiveForm(objective: Objective): ObjectiveForm {
  return {
    title: objective.title,
    description: objective.description,
    why: objective.why,
    dueDate: toDate(objective.dueDate),
  };
}

export function validateObjectiveForm(form: ObjectiveForm, kind: 'objective' | 'stage'): FormErrors<'title'> {
  if (!blank(form.title)) return {};
  return {
    title: kind === 'objective' ? FORM_MESSAGES.objectiveTitleToSave : FORM_MESSAGES.stageTitleToSave,
  };
}

/**
 * Ce que reçoit la modification : le titre, et seulement ce qui a changé. Une chaîne vide efface la
 * description ou le pourquoi ; `dueDate: null` retire l'échéance (l'API le permet). null : rien n'a changé,
 * rien ne part.
 */
export type EditObjectiveInput = {
  readonly title: string;
  readonly description?: string;
  readonly why?: string;
  readonly dueDate?: string | null;
};

export function toEditObjectiveInput(initial: Objective, form: ObjectiveForm): EditObjectiveInput | null {
  const title = form.title.trim();
  const description = form.description.trim();
  const why = form.why.trim();
  const initialDue = toDate(initial.dueDate);
  const dueChanged =
    (initialDue === null) !== (form.dueDate === null) ||
    (initialDue !== null && form.dueDate !== null && !isSameDay(initialDue, form.dueDate));
  const changed =
    title !== initial.title || description !== initial.description || why !== initial.why || dueChanged;
  if (!changed) return null;
  return {
    title,
    ...(description !== initial.description ? { description } : {}),
    ...(why !== initial.why ? { why } : {}),
    ...(dueChanged ? { dueDate: form.dueDate ? toApiDate(form.dueDate) : null } : {}),
  };
}

// #endregion

// #region Étapes et pas

export function validateStageTitle(title: string): FormErrors<'title'> {
  return blank(title) ? { title: FORM_MESSAGES.stageTitleRequired } : {};
}

/** Un pas, tel que sa feuille le montre. */
export type TaskForm = {
  readonly title: string;
  /** L'étape choisie, ou null (un pas sans étape, à ranger). */
  readonly stageId: string | null;
} & Levels;

export function validateNewTask(form: TaskForm): FormErrors<'title' | 'stageId'> {
  return {
    ...(blank(form.title) ? { title: FORM_MESSAGES.taskTitleRequired } : {}),
    // Tout nouveau pas appartient à une étape.
    ...(form.stageId === null ? { stageId: FORM_MESSAGES.taskStageRequired } : {}),
  };
}

export function validateTaskEdit(form: TaskForm): FormErrors<'title'> {
  return blank(form.title) ? { title: FORM_MESSAGES.taskTitleToSave } : {};
}

/** Ce que reçoit la modification d'un pas. */
export type EditTaskInput = {
  readonly title: string;
  /** L'objectif ou l'étape qui porte le pas : le changer déplace le pas. */
  readonly objectiveId: string;
} & Levels;

/**
 * La modification d'un pas, seulement si quelque chose a changé. Le porteur réel du pas peut être un
 * sous-objectif plus profond de l'étape : on ne le change que si la personne a choisi une autre étape,
 * sinon le pas déménagerait.
 */
export function toEditTaskInput(
  task: { readonly title: string; readonly objectiveId: string } & Levels,
  shownStageId: string | null,
  form: TaskForm,
): EditTaskInput | null {
  const title = form.title.trim();
  const objectiveId =
    form.stageId === null || form.stageId === shownStageId ? task.objectiveId : form.stageId;
  const changed =
    title !== task.title ||
    form.importance !== task.importance ||
    form.urgency !== task.urgency ||
    objectiveId !== task.objectiveId;
  if (!changed) return null;
  return { title, objectiveId, importance: form.importance, urgency: form.urgency };
}

// #endregion
