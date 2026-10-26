import { formatHorizon } from '../shared/dates';
import type { Objective, Task } from './objective';
import { cardProgress, objectivesSummary, toObjectiveCard, toObjectiveCards } from './objective-card';
import {
  UNTITLED_STAGE,
  openStageId,
  stageName,
  stageOptions,
  toObjectiveDetail,
  areteDetail,
} from './objective-detail';
import {
  EMPTY_STAGE_DETAIL,
  isAccomplished,
  nextTaskOf,
  stageDetail,
  stageStates,
  taskStates,
} from './progress';

/* Les cas du client web (`objective-view.mapper.spec.ts`), pour que les deux clients lisent l'arête pareil. */

const NOW = new Date(2026, 9, 19); // lundi 19 octobre 2026

const objective = (
  id: string,
  title: string,
  parentId: string | null = null,
  dueDate: string | null = null,
): Objective => ({
  id,
  title,
  why: parentId ? '' : 'Pour me prouver que je peux tenir six mois.',
  description: '',
  dueDate,
  parentId,
});

let taskCounter = 0;
const task = (objectiveId: string, done: boolean, title?: string): Task => {
  taskCounter += 1;
  return {
    id: `t${taskCounter}`,
    title: title ?? `Pas ${taskCounter}`,
    importance: 3,
    urgency: 3,
    done,
    objectiveId,
  };
};

const pas = (id: string, objectiveId: string, done: boolean, importance = 3, urgency = 3): Task => ({
  id,
  title: `Pas ${id}`,
  importance,
  urgency,
  done,
  objectiveId,
});

describe('formatHorizon', () => {
  it("écrit le mois seul pour l'année en cours", () => {
    expect(formatHorizon(new Date(2026, 4, 31).toISOString(), NOW)).toBe("Jusqu'en mai");
    expect(formatHorizon(new Date(2026, 7, 15), NOW)).toBe("Jusqu'en août");
  });

  it("ajoute l'année quand ce n'est pas l'année en cours", () => {
    expect(formatHorizon(new Date(2027, 4, 1).toISOString(), NOW)).toBe("Jusqu'en mai 2027");
    expect(formatHorizon(new Date(2025, 11, 1).toISOString(), NOW)).toBe("Jusqu'en décembre 2025");
  });

  it('reste vide sans échéance ou avec une date illisible', () => {
    expect(formatHorizon('', NOW)).toBe('');
    expect(formatHorizon(null, NOW)).toBe('');
    expect(formatHorizon(undefined, NOW)).toBe('');
    expect(formatHorizon('pas une date', NOW)).toBe('');
  });
});

describe('états des étapes et des pas', () => {
  it('faite (au moins un pas, tous faits), puis une seule en cours, puis à venir', () => {
    expect(
      stageStates([
        [task('a', true), task('a', true)],
        [task('b', true), task('b', false)],
        [task('c', false)],
        [],
      ]),
    ).toEqual(['faite', 'en-cours', 'a-venir', 'a-venir']);
  });

  it("une étape sans pas n'est pas faite : elle peut être en cours", () => {
    expect(stageStates([[], [task('b', false)]])).toEqual(['en-cours', 'a-venir']);
  });

  it("une étape faite reste faite même après l'étape en cours", () => {
    expect(stageStates([[task('a', false)], [task('b', true)]])).toEqual(['en-cours', 'faite']);
  });

  it("dans l'étape en cours, le premier pas non fait est en cours ; ailleurs, aucun", () => {
    expect(taskStates([task('s', true), task('s', false), task('s', false)], 'en-cours')).toEqual([
      'fait',
      'en-cours',
      'a-venir',
    ]);
    expect(taskStates([task('s', false), task('s', true)], 'a-venir')).toEqual(['a-venir', 'fait']);
  });

  it("compte ce qui est fait d'abord, et écrit sur l'arête un texte court", () => {
    expect(stageDetail({ done: 4, inProgress: true, upcoming: 2 })).toBe('4 pas faits · 3 à venir');
    expect(stageDetail({ done: 4, inProgress: false, upcoming: 0 })).toBe('4 pas faits · étape accomplie');
    expect(stageDetail({ done: 0, inProgress: false, upcoming: 0 })).toBe(EMPTY_STAGE_DETAIL);
    expect(areteDetail('en-cours', { done: 4, inProgress: true, upcoming: 3 })).toBe('4 pas faits');
    expect(areteDetail('en-cours', { done: 1, inProgress: true, upcoming: 0 })).toBe('1 pas fait');
    expect(areteDetail('faite', { done: 4, inProgress: false, upcoming: 0 })).toBeUndefined();
  });
});

describe('prochain pas et objectif accompli', () => {
  it("prend le premier pas non fait de l'étape en cours, sinon de l'objectif", () => {
    const stage = [task('s', true), task('s', false, 'Courir 8 km')];
    const all = [task('o', false, 'Acheter des chaussures'), ...stage];
    expect(nextTaskOf(stage, all)?.title).toBe('Courir 8 km');
    expect(nextTaskOf(null, [task('o', true), task('o', false, 'Acheter des chaussures')])?.title).toBe(
      'Acheter des chaussures',
    );
    expect(nextTaskOf(null, [task('o', true)])).toBeNull();
  });

  it('accompli : au moins un pas, et tous faits', () => {
    expect(isAccomplished([])).toBe(false);
    expect(isAccomplished([task('o', true), task('o', false)])).toBe(false);
    expect(isAccomplished([task('o', true), task('o', true)])).toBe(true);
  });
});

describe('cartes et vue détaillée', () => {
  const objectives = [
    objective('semi', 'Courir un semi-marathon en mai', null, new Date(2026, 4, 31).toISOString()),
    objective('programme', 'Programme', 'semi'),
    objective('endurance', 'Endurance', 'semi', new Date(2026, 10, 1).toISOString()),
    objective('sorties', 'Sorties longues', 'endurance'),
    objective('mental', 'Mental', 'semi'),
    objective('guitare', 'Jouer trois morceaux'),
  ];
  const programme = [task('programme', true), task('programme', true)];
  const endurance = [
    task('endurance', true),
    task('sorties', true),
    task('endurance', false, 'Sortie de 30 minutes'),
  ];
  const deep = [task('sorties', false, 'Courir 8 km')];
  const loose = [task('semi', false, 'Comparer des montres GPS')];
  const guitare = [task('guitare', true)];
  const tasks = [...loose, ...programme, ...endurance, ...deep, ...guitare];

  it("la carte compte les étapes, les pas, et nomme l'étape en cours", () => {
    const card = toObjectiveCard(objectives[0] as Objective, objectives, tasks, NOW);
    expect(card).toEqual({
      id: 'semi',
      title: 'Courir un semi-marathon en mai',
      why: 'Pour me prouver que je peux tenir six mois.',
      horizon: "Jusqu'en mai",
      stageProgress: { done: 1, inProgress: true, upcoming: 1, inProgressName: 'Endurance' },
      stageCount: 3,
      taskCount: { done: 4, total: 7 },
      nextTask: endurance[2],
      accomplished: false,
    });
  });

  it("sans étape en cours, la carte n'a pas de nom en cours", () => {
    const card = toObjectiveCard(objectives[5] as Objective, objectives, tasks, NOW);
    expect(card.stageProgress).toEqual({ done: 0, inProgress: false, upcoming: 0 });
    expect(card.accomplished).toBe(true);
    expect(card.nextTask).toBeNull();
    expect(card.horizon).toBe('');
  });

  it("une carte par objectif racine, dans l'ordre de chargement", () => {
    expect(toObjectiveCards(objectives, tasks, NOW).map((card) => card.id)).toEqual(['semi', 'guitare']);
  });

  it('la vue détaillée donne les étapes directes, leurs pas (profonds compris) et leur état', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail?.objective).toMatchObject({ id: 'semi', horizon: "Jusqu'en mai" });
    expect(detail?.stages.map((stage) => [stage.id, stage.index, stage.state])).toEqual([
      ['programme', 1, 'faite'],
      ['endurance', 2, 'en-cours'],
      ['mental', 3, 'a-venir'],
    ]);
    const current = detail?.stages[1];
    expect(current?.horizon).toBe("Jusqu'en novembre");
    expect(current?.tasks.map((item) => [item.title, item.state, item.objectiveId])).toEqual([
      [endurance[0]?.title, 'fait', 'endurance'],
      [endurance[1]?.title, 'fait', 'sorties'],
      ['Sortie de 30 minutes', 'en-cours', 'endurance'],
      ['Courir 8 km', 'a-venir', 'sorties'],
    ]);
    expect(current?.progress).toEqual({ done: 2, inProgress: true, upcoming: 1 });
    expect(current?.detail).toBe('2 pas faits · 2 à venir');
    expect(current?.tasks[0]?.quadrant).toBe('maintenant');
    expect(detail?.stages[0]?.detail).toBe('2 pas faits · étape accomplie');
    expect(detail?.stages[2]?.detail).toBe(EMPTY_STAGE_DETAIL);
  });

  it('isole les pas sans étape, et prépare l’arête avec l’étape ouverte par défaut', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail?.tasksWithoutStage.map((item) => [item.title, item.state])).toEqual([
      ['Comparer des montres GPS', 'a-venir'],
    ]);
    expect(detail?.aretes).toEqual([
      { id: 'programme', nom: 'Programme', etat: 'faite' },
      { id: 'endurance', nom: 'Endurance', etat: 'en-cours', detail: '2 pas faits' },
      { id: 'mental', nom: 'Mental', etat: 'a-venir' },
    ]);
    expect(detail?.defaultStageId).toBe('endurance');
    expect(detail?.taskCount).toEqual({ done: 4, total: 7 });
  });

  it('nomme une étape sans nom, sans toucher à son titre', () => {
    const list = [
      objective('o', 'Objectif'),
      objective('e1', 'Une', 'o'),
      objective('e2', '', 'o'),
      objective('e3', '   ', 'o'),
    ];
    const detail = toObjectiveDetail('o', list, [], NOW);
    expect(detail?.aretes.map((arete) => arete.nom)).toEqual(['Une', UNTITLED_STAGE, UNTITLED_STAGE]);
    expect(detail?.stages.map((stage) => stage.title)).toEqual(['Une', '', '   ']);
    expect(stageName(' Portfolio ')).toBe('Portfolio');
  });

  it("n'ouvre jamais l'arête d'une étape, ni d'un objectif inconnu", () => {
    expect(toObjectiveDetail('endurance', objectives, tasks, NOW)).toBeUndefined();
    expect(toObjectiveDetail('inconnu', objectives, tasks, NOW)).toBeUndefined();
  });

  it('les étapes à choisir ont toujours un nom', () => {
    expect(stageOptions('semi', objectives)).toEqual([
      { id: 'programme', label: 'Programme' },
      { id: 'endurance', label: 'Endurance' },
      { id: 'mental', label: 'Mental' },
    ]);
  });

  it("garde ouverte l'étape choisie tant qu'elle existe, sinon l'étape par défaut", () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(openStageId(null, detail)).toBe('endurance');
    expect(openStageId('programme', detail)).toBe('programme');
    expect(openStageId('disparue', detail)).toBe('endurance');
    expect(openStageId('programme', undefined)).toBeNull();
  });
});

describe('cas limites du cahier (§ 4)', () => {
  it('objectif sans étape : ses pas comptent, le prochain pas est le premier non fait', () => {
    const objectives = [objective('o', 'Lire 12 livres')];
    const tasks = [pas('a', 'o', true), pas('b', 'o', false), pas('c', 'o', false)];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, tasks, NOW);
    expect(card).toMatchObject({
      stageProgress: { done: 0, inProgress: false, upcoming: 0 },
      stageCount: 0,
      taskCount: { done: 1, total: 3 },
      nextTask: { id: 'b' },
      accomplished: false,
    });
    expect(cardProgress(card)).toEqual({
      kind: 'cases',
      unit: 'pas',
      done: 1,
      inProgress: true,
      upcoming: 1,
    });
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail).toMatchObject({ stages: [], aretes: [], defaultStageId: null });
    expect(detail?.tasksWithoutStage.map((item) => item.state)).toEqual(['fait', 'a-venir', 'a-venir']);
  });

  it("objectif sans étape ni pas : l'invitation à poser la première étape", () => {
    const objectives = [objective('o', 'Vide')];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, [], NOW);
    expect(card).toMatchObject({ taskCount: { done: 0, total: 0 }, nextTask: null, accomplished: false });
    expect(cardProgress(card)).toEqual({ kind: 'invite' });
  });

  it("toutes les étapes faites mais un pas sans étape à faire : la légende ne dit pas l'objectif accompli", () => {
    const objectives = [objective('o', 'O'), objective('e1', 'Une', 'o'), objective('e2', 'Deux', 'o')];
    const tasks = [pas('a', 'e1', true), pas('b', 'e2', true), pas('c', 'o', false)];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, tasks, NOW);
    expect(card.stageProgress).toEqual({ done: 2, inProgress: false, upcoming: 0 });
    expect(card.nextTask?.id).toBe('c');
    expect(card.accomplished).toBe(false);
    expect(cardProgress(card)).toMatchObject({
      kind: 'cases',
      legend: '2 étapes faites · 1 pas sans étape à venir',
    });
  });

  it('au-delà de 12 étapes, la légende seule', () => {
    const objectives = [
      objective('o', 'O'),
      ...Array.from({ length: 13 }, (_, i) => objective(`e${i}`, `Étape ${i}`, 'o')),
    ];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, [], NOW);
    expect(cardProgress(card)).toEqual({ kind: 'legend', text: 'Étape 0 en cours · 12 étapes à venir' });
  });

  it("sous-objectifs sur trois niveaux sous une étape : leurs pas comptent dans l'étape de premier niveau", () => {
    const objectives = [
      objective('o', 'O'),
      objective('e1', 'Étape', 'o'),
      objective('s1', 'Sous', 'e1'),
      objective('ss1', 'Sous-sous', 's1'),
      objective('sss1', 'Sous-sous-sous', 'ss1'),
      objective('e2', 'Suivante', 'o'),
    ];
    const tasks = [
      pas('a', 'sss1', true),
      pas('b', 'ss1', false),
      pas('c', 's1', true),
      pas('d', 'e1', false),
      pas('e', 'e2', false),
    ];
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail?.stages.map((stage) => stage.id)).toEqual(['e1', 'e2']);
    expect(detail?.stages[0]?.tasks.map((item) => [item.id, item.objectiveId, item.state])).toEqual([
      ['a', 'sss1', 'fait'],
      ['b', 'ss1', 'en-cours'],
      ['c', 's1', 'fait'],
      ['d', 'e1', 'a-venir'],
    ]);
    expect(detail?.taskCount).toEqual({ done: 2, total: 5 });
    expect(toObjectiveCard(objectives[0] as Objective, objectives, tasks, NOW).nextTask?.id).toBe('b');
  });

  it('ids temporaires : un objectif, une étape et un pas optimistes sont montrés comme les autres', () => {
    const objectives = [
      objective('temp-id-o', 'Nouvel objectif'),
      objective('temp-id-e', 'Nouvelle étape', 'temp-id-o'),
    ];
    const tasks = [pas('temp-id-p', 'temp-id-e', false, 4, 1)];
    expect(toObjectiveCards(objectives, tasks, NOW)[0]).toMatchObject({
      id: 'temp-id-o',
      stageProgress: { done: 0, inProgress: true, upcoming: 0, inProgressName: 'Nouvelle étape' },
      nextTask: { id: 'temp-id-p' },
    });
    const detail = toObjectiveDetail('temp-id-o', objectives, tasks, NOW);
    expect(detail?.defaultStageId).toBe('temp-id-e');
    expect(detail?.stages[0]?.tasks[0]).toMatchObject({
      id: 'temp-id-p',
      quadrant: 'planifier',
      state: 'en-cours',
    });
  });
});

describe('objectivesSummary', () => {
  it('compte ce qui est en marche, puis ce qui est accompli', () => {
    expect(objectivesSummary(4, 1)).toBe('4 en marche · 1 accompli');
    expect(objectivesSummary(1, 0)).toBe('1 en marche');
    expect(objectivesSummary(0, 2)).toBe('2 accomplis');
    expect(objectivesSummary(0, 0)).toBe('');
  });
});
