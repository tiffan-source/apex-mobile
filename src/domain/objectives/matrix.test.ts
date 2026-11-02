import type { Quadrant } from '@empreinte-studio/noyau';
import { NEW_TASK_LEVELS, quadrantOf } from './eisenhower';
import { filterMatrixByObjective, matrixSize, matrixTaskDetail, toMatrix } from './matrix';
import type { Objective, Task } from './objective';

/* Les cas du client web (`matrix.mapper.spec.ts`) : la règle d'apex-library. */

const objective = (id: string, title: string, parentId: string | null = null): Objective => ({
  id,
  title,
  why: '',
  description: '',
  dueDate: null,
  parentId,
});

const task = (id: string, objectiveId: string, importance: number, urgency: number, done = false): Task => ({
  id,
  title: `Pas ${id}`,
  importance,
  urgency,
  done,
  objectiveId,
});

describe('quadrantOf (règle ApexLibsMetier, seuil 3)', () => {
  it.each([
    [3, 3, 'maintenant'],
    [5, 4, 'maintenant'],
    [3, 2, 'planifier'],
    [4, 1, 'planifier'],
    [2, 3, 'confier'],
    [1, 5, 'confier'],
    [2, 2, 'laisser-filer'],
    [1, 1, 'laisser-filer'],
  ] as const)('importance %i, urgence %i → %s', (importance, urgency, quadrant) => {
    expect(quadrantOf({ importance, urgency })).toBe(quadrant);
  });

  it('un nouveau pas naît « À planifier »', () => {
    expect(quadrantOf(NEW_TASK_LEVELS)).toBe('planifier');
  });
});

describe('toMatrix', () => {
  const objectives = [
    objective('semi', 'Courir un semi-marathon'),
    objective('endurance', 'Endurance', 'semi'),
    objective('sorties', 'Sorties longues', 'endurance'),
    objective('licence', 'Valider ma licence'),
  ];
  const tasks = [
    task('t1', 'semi', 4, 4),
    task('t2', 'endurance', 4, 1, true),
    task('t3', 'sorties', 1, 4),
    task('t4', 'licence', 1, 1),
  ];

  it("range chaque pas dans son quadrant, dans l'ordre de chargement, faits compris", () => {
    const matrix = toMatrix(objectives, tasks);
    const ids = (quadrant: Quadrant) => matrix[quadrant].map((item) => item.id);
    expect(ids('maintenant')).toEqual(['t1']);
    expect(ids('planifier')).toEqual(['t2']);
    expect(ids('confier')).toEqual(['t3']);
    expect(ids('laisser-filer')).toEqual(['t4']);
    expect(matrixSize(matrix)).toBe(4);
  });

  it('donne à chaque pas son objectif racine et son étape de premier niveau', () => {
    const matrix = toMatrix(objectives, tasks);
    expect(matrix.maintenant[0]).toMatchObject({ rootObjectiveId: 'semi', stageId: null, stageTitle: null });
    expect(matrix.planifier[0]).toMatchObject({ rootObjectiveId: 'semi', stageId: 'endurance', done: true });
    expect(matrix.confier[0]).toMatchObject({
      rootObjectiveId: 'semi',
      stageId: 'endurance',
      stageTitle: 'Endurance',
    });
    expect(matrixTaskDetail(matrix.confier[0]!)).toBe('Courir un semi-marathon · étape Endurance');
    expect(matrixTaskDetail(matrix.maintenant[0]!)).toBe('Courir un semi-marathon');
  });

  it('filtre par objectif racine, ou garde tout avec null', () => {
    const matrix = toMatrix(objectives, tasks);
    const semi = filterMatrixByObjective(matrix, 'semi');
    expect(semi.maintenant).toHaveLength(1);
    expect(semi['laisser-filer']).toHaveLength(0);
    expect(filterMatrixByObjective(matrix, null)).toBe(matrix);
  });

  it("les ids temporaires suivent, et un pas profond garde l'étape de premier niveau", () => {
    const deep = [
      objective('temp-id-o', 'Nouvel objectif'),
      objective('e1', 'Étape', 'temp-id-o'),
      objective('s1', 'Sous', 'e1'),
      objective('sss1', 'Sous-sous-sous', 's1'),
    ];
    const matrix = toMatrix(deep, [task('temp-id-p', 'sss1', 5, 5), task('loose', 'temp-id-o', 1, 1)]);
    expect(matrix.maintenant[0]).toMatchObject({
      rootObjectiveId: 'temp-id-o',
      stageId: 'e1',
      stageTitle: 'Étape',
    });
    expect(matrix['laisser-filer'][0]).toMatchObject({ rootObjectiveId: 'temp-id-o', stageId: null });
  });
});
