import { formatHorizon } from '../shared/dates';
import type { Objective, Task } from './objective';
import { cardProgress, objectivesSummary, toObjectiveCard, toObjectiveCards } from './objective-card';
import {
  UNTITLED_STAGE,
  foldedDoneStageId,
  openStageId,
  stageName,
  stageOptions,
  stageWithout,
  toObjectiveDetail,
} from './objective-detail';
import { objectiveErasure, stageErasure } from './erasure';
import { EMPTY_STAGE_DETAIL, stageDetail } from './progress';

/* Les cas du client web (`objective-view.mapper.spec.ts`), pour que les deux clients lisent l'arête pareil. */

const NOW = new Date(2026, 9, 19); // lundi 19 octobre 2026

const objective = (
  id: string,
  title: string,
  parentId: string | null = null,
  dueDate: string | null = null,
  done = false,
): Objective => ({
  id,
  title,
  why: parentId ? '' : 'Pour me prouver que je peux tenir six mois.',
  description: '',
  dueDate,
  parentId,
  done,
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

describe('détails lisibles', () => {
  it("compte ce qui est fait d'abord (legendeProgression d'Empreinte)", () => {
    expect(stageDetail({ done: 4, toDo: 3 })).toBe('4 pas faits · 3 à faire');
    expect(stageDetail({ done: 4, toDo: 0 })).toBe('4 pas faits');
    expect(stageDetail({ done: 0, toDo: 0 })).toBe(EMPTY_STAGE_DETAIL);
  });
});

describe('cartes et vue détaillée', () => {
  const objectives = [
    objective('semi', 'Courir un semi-marathon en mai', null, new Date(2026, 4, 31).toISOString()),
    objective('programme', 'Programme', 'semi', null, true),
    objective('endurance', 'Endurance', 'semi', new Date(2026, 10, 1).toISOString()),
    objective('sorties', 'Sorties longues', 'endurance'),
    objective('mental', 'Mental', 'semi'),
    objective('guitare', 'Jouer trois morceaux', null, null, true),
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

  it('la carte compte les étapes faites, celles à faire et les pas', () => {
    const card = toObjectiveCard(objectives[0] as Objective, objectives, tasks, NOW);
    expect(card).toEqual({
      id: 'semi',
      title: 'Courir un semi-marathon en mai',
      why: 'Pour me prouver que je peux tenir six mois.',
      horizon: "Jusqu'en mai",
      stageProgress: { done: 1, toDo: 2 },
      stageCount: 3,
      taskCount: { done: 4, total: 7 },
      accomplished: false,
    });
  });

  it("un objectif sans étape : aucune étape à compter, et le serveur dit s'il est fait", () => {
    const card = toObjectiveCard(objectives[5] as Objective, objectives, tasks, NOW);
    expect(card.stageProgress).toEqual({ done: 0, toDo: 0 });
    expect(card.accomplished).toBe(true);
    expect(card.horizon).toBe('');
  });

  it('une carte par objectif racine', () => {
    expect(toObjectiveCards(objectives, tasks, NOW).map((card) => card.id)).toEqual(['semi', 'guitare']);
  });

  it('la vue détaillée donne les étapes directes, leurs pas (profonds compris) et ce que le serveur dit d’elles', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail?.objective).toMatchObject({ id: 'semi', horizon: "Jusqu'en mai" });
    expect(detail?.stages.map((stage) => [stage.id, stage.done])).toEqual([
      ['programme', true],
      ['endurance', false],
      ['mental', false],
    ]);
    const stage = detail?.stages[1];
    expect(stage?.horizon).toBe("Jusqu'en novembre");
    expect(stage?.tasks.map((item) => [item.title, item.done, item.objectiveId])).toEqual([
      [endurance[0]?.title, true, 'endurance'],
      [endurance[1]?.title, true, 'sorties'],
      ['Sortie de 30 minutes', false, 'endurance'],
      ['Courir 8 km', false, 'sorties'],
    ]);
    expect(stage?.progress).toEqual({ done: 2, toDo: 2 });
    expect(stage?.detail).toBe('2 pas faits · 2 à faire');
    expect(stage?.tasks[0]?.quadrant).toBe('maintenant');
    expect(detail?.stages[0]?.detail).toBe('2 pas faits');
    expect(detail?.stages[2]?.detail).toBe(EMPTY_STAGE_DETAIL);
  });

  it('isole les pas sans étape, et prépare l’arête sans autre état que faite ou non', () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(detail?.tasksWithoutStage.map((item) => [item.title, item.done])).toEqual([
      ['Comparer des montres GPS', false],
    ]);
    expect(detail?.aretes).toEqual([
      { id: 'programme', nom: 'Programme', faite: true },
      { id: 'endurance', nom: 'Endurance', faite: false },
      { id: 'mental', nom: 'Mental', faite: false },
    ]);
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

  it("garde ouverte l'étape choisie tant qu'elle existe, et n'en ouvre aucune d'elle-même", () => {
    const detail = toObjectiveDetail('semi', objectives, tasks, NOW);
    expect(openStageId(null, detail)).toBeNull();
    expect(openStageId('programme', detail)).toBe('programme');
    expect(openStageId('disparue', detail)).toBeNull();
    expect(openStageId('programme', undefined)).toBeNull();
  });

  it("l'arête « Faites » ouvre chaque étape faite, à tour de rôle", () => {
    const list = [
      objective('o', 'O'),
      objective('e1', 'Une', 'o', null, true),
      objective('e2', 'Deux', 'o', null, true),
      objective('e3', 'Trois', 'o'),
    ];
    const stages = toObjectiveDetail('o', list, [], NOW)?.stages ?? [];
    expect(foldedDoneStageId(stages, null)).toBe('e2');
    expect(foldedDoneStageId(stages, 'e2')).toBe('e1');
    expect(foldedDoneStageId(stages, 'e1')).toBe('e2');
    expect(foldedDoneStageId(stages.slice(2), null)).toBeNull();
  });
});

describe('cas limites du cahier (§ 4)', () => {
  it('fait ou non fait, c’est le serveur qui le dit : les vues ne le déduisent jamais des pas', () => {
    const objectives = [
      objective('o', 'O'),
      objective('e1', 'Une', 'o'),
      objective('e2', 'Deux', 'o', null, true),
    ];
    const tasks = [pas('a', 'e1', true), pas('b', 'e2', false)];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, tasks, NOW);
    expect(card.stageProgress).toEqual({ done: 1, toDo: 1 });
    expect(card.accomplished).toBe(false);
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail?.stages.map((stage) => stage.done)).toEqual([false, true]);
    expect(detail?.aretes.map((arete) => arete.faite)).toEqual([false, true]);
  });

  it('une étape faite n’attend pas les autres : aucun ordre entre elles', () => {
    const objectives = [
      objective('o', 'O'),
      objective('e1', 'Une', 'o'),
      objective('e2', 'Deux', 'o', null, true),
      objective('e3', 'Trois', 'o'),
    ];
    expect(toObjectiveDetail('o', objectives, [], NOW)?.aretes.map((arete) => arete.faite)).toEqual([
      false,
      true,
      false,
    ]);
    expect(toObjectiveCard(objectives[0] as Objective, objectives, [], NOW).stageProgress).toEqual({
      done: 1,
      toDo: 2,
    });
  });

  it('objectif sans étape : ses pas comptent', () => {
    const objectives = [objective('o', 'Lire 12 livres')];
    const tasks = [pas('a', 'o', true), pas('b', 'o', false), pas('c', 'o', false)];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, tasks, NOW);
    expect(card).toMatchObject({
      stageProgress: { done: 0, toDo: 0 },
      stageCount: 0,
      taskCount: { done: 1, total: 3 },
      accomplished: false,
    });
    expect(cardProgress(card)).toEqual({ kind: 'cases', unit: 'pas', done: 1, toDo: 2 });
    const detail = toObjectiveDetail('o', objectives, tasks, NOW);
    expect(detail).toMatchObject({ stages: [], aretes: [] });
    expect(detail?.tasksWithoutStage.map((item) => item.done)).toEqual([true, false, false]);
  });

  it("objectif sans étape ni pas : l'invitation à poser des étapes", () => {
    const objectives = [objective('o', 'Vide')];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, [], NOW);
    expect(card).toMatchObject({ taskCount: { done: 0, total: 0 }, accomplished: false });
    expect(cardProgress(card)).toEqual({ kind: 'invite' });
  });

  it("toutes les étapes faites mais un pas sans étape à faire : la légende ne dit pas l'objectif accompli", () => {
    const objectives = [
      objective('o', 'O'),
      objective('e1', 'Une', 'o', null, true),
      objective('e2', 'Deux', 'o', null, true),
    ];
    const tasks = [pas('a', 'e1', true), pas('b', 'e2', true), pas('c', 'o', false)];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, tasks, NOW);
    expect(card.stageProgress).toEqual({ done: 2, toDo: 0 });
    expect(card.accomplished).toBe(false);
    expect(cardProgress(card)).toMatchObject({
      kind: 'cases',
      legend: '2 étapes faites · 1 pas sans étape à faire',
    });
  });

  it('au-delà de 12 étapes, la légende seule', () => {
    const objectives = [
      objective('o', 'O'),
      ...Array.from({ length: 13 }, (_, i) => objective(`e${i}`, `Étape ${i}`, 'o')),
    ];
    const card = toObjectiveCard(objectives[0] as Objective, objectives, [], NOW);
    expect(cardProgress(card)).toEqual({ kind: 'legend', text: '13 étapes à faire' });
  });

  it("sous-objectifs sur trois niveaux sous une étape : leurs pas comptent dans l'étape de premier niveau", () => {
    const objectives = [
      objective('o', 'O'),
      objective('e1', 'Étape', 'o'),
      objective('s1', 'Sous', 'e1'),
      objective('ss1', 'Sous-sous', 's1'),
      objective('sss1', 'Sous-sous-sous', 'ss1'),
      objective('e2', 'Autre', 'o'),
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
    expect(detail?.stages[0]?.tasks.map((item) => [item.id, item.objectiveId, item.done])).toEqual([
      ['a', 'sss1', true],
      ['b', 'ss1', false],
      ['c', 's1', true],
      ['d', 'e1', false],
    ]);
    expect(detail?.taskCount).toEqual({ done: 2, total: 5 });
  });

  it('ids temporaires : un objectif, une étape et un pas optimistes sont montrés comme les autres', () => {
    const objectives = [
      objective('temp-id-o', 'Nouvel objectif'),
      objective('temp-id-e', 'Nouvelle étape', 'temp-id-o'),
    ];
    const tasks = [pas('temp-id-p', 'temp-id-e', false, 4, 1)];
    expect(toObjectiveCards(objectives, tasks, NOW)[0]).toMatchObject({
      id: 'temp-id-o',
      stageProgress: { done: 0, toDo: 1 },
    });
    const detail = toObjectiveDetail('temp-id-o', objectives, tasks, NOW);
    expect(detail?.stages[0]?.tasks[0]).toMatchObject({
      id: 'temp-id-p',
      quadrant: 'planifier',
      done: false,
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

describe('ce qu’un effacement emporte', () => {
  const plan = () => {
    const objectives = [
      objective('o', 'Courir un semi-marathon'),
      objective('e1', 'Programme', 'o', null, true),
      objective('e2', 'Endurance', 'o'),
      objective('s', 'Sorties longues', 'e2'),
      objective('e3', '', 'o'),
      objective('x', 'Apprendre le piano'),
    ];
    const tasks = [
      pas('p1', 'e1', true),
      pas('p2', 'e2', true),
      pas('p3', 'e2', false),
      pas('p4', 's', true),
      pas('p5', 'o', false),
      pas('p6', 'x', false),
    ];
    return { objectives, tasks };
  };

  it('une étape : ses pas (ceux de ses sous-objectifs compris), et ce qui reste sur l’arête', () => {
    const { objectives, tasks } = plan();
    expect(stageErasure('e2', objectives, tasks)).toEqual({
      name: 'Endurance',
      remaining: { done: 1, toDo: 1 },
      stageCount: 3,
      tasks: { done: 2, total: 3 },
    });
    expect(stageErasure('e3', objectives, tasks)?.name).toBe(UNTITLED_STAGE);
  });

  it('le pas dont la trace est à l’écran ne compte plus : il part déjà', () => {
    const { objectives, tasks } = plan();
    expect(stageErasure('e2', objectives, tasks, 'p3')?.tasks).toEqual({ done: 2, total: 2 });
    expect(objectiveErasure('o', objectives, tasks, 'p5')?.tasks).toEqual({ done: 3, total: 4 });
  });

  it('un objectif : ses étapes, et tous ses pas', () => {
    const { objectives, tasks } = plan();
    expect(objectiveErasure('o', objectives, tasks)).toEqual({
      title: 'Courir un semi-marathon',
      stageCount: 3,
      tasks: { done: 3, total: 5 },
    });
  });

  it('rien pour ce qui n’est pas une étape, ou pas un objectif', () => {
    const { objectives, tasks } = plan();
    expect(stageErasure('o', objectives, tasks)).toBeUndefined();
    expect(stageErasure('inconnu', objectives, tasks)).toBeUndefined();
    expect(objectiveErasure('e1', objectives, tasks)).toBeUndefined();
  });

  it('l’étape ouverte ne compte plus le pas dont la trace est à l’écran, mais le garde à sa place', () => {
    const { objectives, tasks } = plan();
    const stage = toObjectiveDetail('o', objectives, tasks, NOW)?.stages.find((item) => item.id === 'e2');
    if (!stage) throw new Error('étape attendue');
    const leaving = stageWithout(stage, 'p3');
    expect(leaving.progress).toEqual({ done: 2, toDo: 0 });
    expect(leaving.detail).toBe(stageDetail({ done: 2, toDo: 0 }));
    expect(leaving.tasks.map((item) => item.id)).toEqual(stage.tasks.map((item) => item.id));
    expect(stageWithout(stage, null)).toBe(stage);
    expect(stageWithout(stage, 'p6')).toBe(stage);
  });
});
