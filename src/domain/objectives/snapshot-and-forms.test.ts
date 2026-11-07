import {
  EMPTY_DRAFT,
  FORM_MESSAGES,
  toCreateObjectiveInput,
  toEditObjectiveInput,
  toEditTaskInput,
  toObjectiveForm,
  validateDraft,
  validateNewTask,
} from './forms';
import type { Objective, ObjectivesSnapshot, Task } from './objective';
import {
  addTask,
  eraseObjective,
  eraseTask,
  erasedParents,
  isTemporaryId,
  keepOptimistic,
  removeObjective,
  restoreErased,
  swapObjectiveId,
  swapTaskId,
} from './snapshot';

const objective = (
  id: string,
  parentId: string | null = null,
  extra: Partial<Objective> = {},
): Objective => ({
  id,
  title: id,
  why: '',
  description: '',
  dueDate: null,
  parentId,
  done: false,
  ...extra,
});
const task = (id: string, objectiveId: string, done = false): Task => ({
  id,
  title: id,
  importance: 3,
  urgency: 2,
  done,
  objectiveId,
});
const snapshot = (objectives: Objective[], tasks: Task[] = []): ObjectivesSnapshot => ({
  objectives,
  tasks,
  loaded: true,
});

describe('la copie optimiste', () => {
  it('reconnaît un id temporaire', () => {
    expect(isTemporaryId('temp-id-1')).toBe(true);
    expect(isTemporaryId('8c1e')).toBe(false);
    expect(isTemporaryId(null)).toBe(false);
  });

  it("donne l'id définitif à un objectif, à ses étapes et à ses pas", () => {
    const before = snapshot(
      [objective('temp-id-o'), objective('temp-id-e', 'temp-id-o')],
      [task('temp-id-p', 'temp-id-o')],
    );
    const after = swapObjectiveId(before, 'temp-id-o', 'o1');
    expect(after.objectives.map((item) => [item.id, item.parentId])).toEqual([
      ['o1', null],
      ['temp-id-e', 'o1'],
    ]);
    expect(after.tasks[0]?.objectiveId).toBe('o1');
  });

  it("donne l'id définitif à un pas en gardant son état optimiste", () => {
    const after = swapTaskId(snapshot([objective('o')], [task('temp-id-p', 'o', true)]), 'temp-id-p', 'p1');
    expect(after.tasks[0]).toMatchObject({ id: 'p1', done: true });
  });

  it('garde au chargement ce qui est encore en cours de création, après ce qui est chargé', () => {
    const current = snapshot([objective('o'), objective('temp-id-n')], [task('temp-id-p', 'o')]);
    const loaded = { objectives: [objective('o'), objective('x')], tasks: [task('t', 'x')] };
    const merged = keepOptimistic(loaded, current);
    expect(merged.objectives.map((item) => item.id)).toEqual(['o', 'x', 'temp-id-n']);
    expect(merged.tasks.map((item) => item.id)).toEqual(['t', 'temp-id-p']);
    expect(merged.loaded).toBe(true);
    expect(keepOptimistic(loaded, undefined).objectives).toHaveLength(2);
  });

  it('retire un objectif optimiste avec ses étapes et les pas créés dessus', () => {
    const before = snapshot(
      [objective('o'), objective('temp-id-n'), objective('temp-id-e', 'temp-id-n')],
      [task('a', 'o'), task('temp-id-b', 'temp-id-e'), task('temp-id-c', 'temp-id-n')],
    );
    const after = removeObjective(before, 'temp-id-n');
    expect(after.objectives.map((item) => item.id)).toEqual(['o']);
    expect(after.tasks.map((item) => item.id)).toEqual(['a']);
    expect(addTask(after, task('d', 'o')).tasks).toHaveLength(2);
  });

  it('garde un pas enregistré rangé sur une étape dont la création n’a pas abouti', () => {
    // Son propre geste, refusé à son tour (l'étape n'existe pas), le ramène à sa place.
    const before = snapshot([objective('o'), objective('temp-id-e', 'o')], [task('p1', 'temp-id-e')]);
    expect(removeObjective(before, 'temp-id-e').tasks.map((item) => item.id)).toEqual(['p1']);
  });
});

describe('effacer dans la copie', () => {
  const ids = (items: readonly { readonly id: string }[]) => items.map((item) => item.id);
  const plan = () =>
    snapshot(
      [objective('o'), objective('e1', 'o'), objective('s', 'e1'), objective('e2', 'o'), objective('x')],
      [task('a', 'e1'), task('b', 's'), task('c', 'e2'), task('d', 'o')],
    );

  it('un objectif part avec ses descendants et tous leurs pas, chacun avec sa place', () => {
    const { snapshot: after, removed } = eraseObjective(plan(), 'e1');
    expect(ids(after.objectives)).toEqual(['o', 'e2', 'x']);
    expect(ids(after.tasks)).toEqual(['c', 'd']);
    expect(removed.objectives.map(({ index, item }) => [index, item.id])).toEqual([
      [1, 'e1'],
      [2, 's'],
    ]);
    expect(removed.tasks.map(({ index, item }) => [index, item.id])).toEqual([
      [0, 'a'],
      [1, 'b'],
    ]);
  });

  it('un id inconnu ne retire rien', () => {
    expect(eraseObjective(plan(), 'inconnu').removed).toEqual({ objectives: [], tasks: [] });
    expect(eraseTask(plan(), 'inconnu').snapshot.tasks).toHaveLength(4);
  });

  it('ce qui revient retrouve sa place, sans doublon', () => {
    const { snapshot: after, removed } = eraseObjective(plan(), 'e1');
    const back = restoreErased(after, removed);
    expect(back && ids(back.objectives)).toEqual(['o', 'e1', 's', 'e2', 'x']);
    expect(back && ids(back.tasks)).toEqual(['a', 'b', 'c', 'd']);
    // Une relecture l'a déjà rendu : il n'est pas remis deux fois.
    const again = back && restoreErased(back, removed);
    expect(again && ids(again.objectives)).toEqual(['o', 'e1', 's', 'e2', 'x']);
  });

  it('ce qui a été effacé reviendrait chez son parent : l’objectif d’une étape, l’étape d’un pas', () => {
    expect(erasedParents(eraseObjective(plan(), 'e1').removed)).toEqual(['o']);
    expect(erasedParents(eraseObjective(plan(), 'o').removed)).toEqual([]);
    expect(erasedParents(eraseTask(plan(), 'c').removed)).toEqual(['e2']);
  });

  it('rien ne revient quand son parent n’est plus là', () => {
    const { snapshot: withoutStage, removed } = eraseObjective(plan(), 'e1');
    expect(restoreErased(eraseObjective(withoutStage, 'o').snapshot, removed)).toBeNull();

    const { snapshot: withoutTask, removed: task } = eraseTask(plan(), 'c');
    expect(restoreErased(eraseObjective(withoutTask, 'e2').snapshot, task)).toBeNull();
    const back = restoreErased(withoutTask, task);
    expect(back && ids(back.tasks)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('le brouillon d’un nouvel objectif', () => {
  const now = new Date(2026, 9, 19, 15);

  it('demande un titre (des espaces ne comptent pas) et un horizon à venir', () => {
    expect(validateDraft(EMPTY_DRAFT, now)).toEqual({ title: FORM_MESSAGES.objectiveTitleRequired });
    expect(validateDraft({ ...EMPTY_DRAFT, title: '   ' }, now).title).toBe(
      FORM_MESSAGES.objectiveTitleRequired,
    );
    expect(validateDraft({ ...EMPTY_DRAFT, title: 'Courir', dueDate: new Date(2026, 9, 18) }, now)).toEqual({
      dueDate: FORM_MESSAGES.dueDateInPast,
    });
    expect(validateDraft({ ...EMPTY_DRAFT, title: 'Courir', dueDate: new Date(2026, 9, 19) }, now)).toEqual(
      {},
    );
  });

  it("se prépare pour l'API : textes nettoyés, champs vides omis, horizon au minuit local", () => {
    const dueDate = new Date(2027, 4, 1, 17, 30);
    expect(toCreateObjectiveInput({ title: '  Courir  ', why: ' ', description: '', dueDate })).toEqual({
      title: 'Courir',
      dueDate: new Date(2027, 4, 1).toISOString(),
    });
    expect(toCreateObjectiveInput(EMPTY_DRAFT)).toBeNull();
  });
});

describe('les feuilles', () => {
  const initial = objective('o', null, {
    title: 'Courir',
    why: 'Tenir',
    description: 'Un semi',
    dueDate: new Date(2027, 4, 1).toISOString(),
  });

  it("n'envoie rien quand rien n'a changé", () => {
    expect(toEditObjectiveInput(initial, toObjectiveForm(initial))).toBeNull();
  });

  it("n'envoie que ce qui a changé, efface un texte vidé, retire un horizon avec null", () => {
    const form = { ...toObjectiveForm(initial), why: '  ', dueDate: null };
    expect(toEditObjectiveInput(initial, form)).toEqual({ title: 'Courir', why: '', dueDate: null });
    const moved = { ...toObjectiveForm(initial), dueDate: new Date(2027, 5, 1, 9) };
    expect(toEditObjectiveInput(initial, moved)).toEqual({
      title: 'Courir',
      dueDate: new Date(2027, 5, 1).toISOString(),
    });
  });

  it('un nouveau pas a un intitulé et une étape', () => {
    expect(validateNewTask({ title: ' ', stageId: null, importance: 3, urgency: 2 })).toEqual({
      title: FORM_MESSAGES.taskTitleRequired,
      stageId: FORM_MESSAGES.taskStageRequired,
    });
  });

  it('ne déplace un pas profond que si la personne choisit une autre étape', () => {
    const deep = { title: 'Courir 8 km', objectiveId: 'sorties', importance: 3, urgency: 3 };
    expect(toEditTaskInput(deep, 'endurance', { ...deep, stageId: 'endurance' })).toBeNull();
    expect(toEditTaskInput(deep, 'endurance', { ...deep, stageId: 'endurance', urgency: 1 })).toEqual({
      title: 'Courir 8 km',
      objectiveId: 'sorties',
      importance: 3,
      urgency: 1,
    });
    expect(toEditTaskInput(deep, 'endurance', { ...deep, stageId: 'mental' })?.objectiveId).toBe('mental');
    // Un pas sans étape (affiché hors de toute étape) se range dans l'étape choisie.
    const loose = { title: 'Montre', objectiveId: 'semi', importance: 3, urgency: 3 };
    expect(toEditTaskInput(loose, null, { ...loose, stageId: 'endurance' })?.objectiveId).toBe('endurance');
  });
});
