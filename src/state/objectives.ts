import { useQuery, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toObjectiveCards, type ObjectiveCard } from '@/domain/objectives/objective-card';
import {
  stageOptions,
  toObjectiveDetail,
  type ObjectiveDetail,
  type StageOption,
} from '@/domain/objectives/objective-detail';
import { toMatrix, type Matrix } from '@/domain/objectives/matrix';
import {
  EMPTY_SNAPSHOT,
  type Objective,
  type ObjectivesSnapshot,
  type Task,
} from '@/domain/objectives/objective';
import { findObjective, findTask } from '@/domain/objectives/snapshot';
import { isRootObjective } from '@/domain/objectives/tree';
import { failureReport } from '@/domain/objectives/messages';
import { CLIENT_ERRORS, FailureError, UNKNOWN_ERROR, unwrap, type Failure } from '@/domain/shared/result';
import type { ObjectivesCache } from '@/application/objectives/objectives-cache';
import type { ObjectiveCommands } from '@/application/objectives/objective-commands';
import { queryKeys } from './query-keys';
import { useServices } from './services';
import { useCurrentUser } from './session';

/*
 * Les objectifs de la personne connectée : une seule lecture (`GET /v1/objectives`, à plat), gardée dans le
 * cache de TanStack Query, d'où chaque écran tire sa vue (cartes, arête, matrice) par les règles du domaine.
 */

/** La copie locale des objectifs rangée dans le cache de TanStack Query, pour les commandes de l'application. */
export function createQueryObjectivesCache(
  queryClient: QueryClient,
  key: () => QueryKey | null,
): ObjectivesCache {
  return {
    read: () => {
      const current = key();
      return current ? queryClient.getQueryData<ObjectivesSnapshot>(current) : undefined;
    },
    update: (change) => {
      const current = key();
      if (!current) return;
      queryClient.setQueryData<ObjectivesSnapshot>(current, (snapshot) => change(snapshot ?? EMPTY_SNAPSHOT));
    },
  };
}

export type ObjectivesView = {
  /** La copie locale (vide tant que rien n'est chargé). */
  readonly snapshot: ObjectivesSnapshot;
  /** Une lecture du serveur a abouti : un écran vide l'est vraiment. */
  readonly loaded: boolean;
  /** Le premier chargement n'a pas abouti. */
  readonly failure: Failure | null;
  /** Un rechargement est en cours (tirer pour rafraîchir). */
  readonly refreshing: boolean;
  readonly refresh: () => void;
};

/** Une panne lue dans une erreur de TanStack Query. */
function failureOf(error: unknown): Failure {
  return error instanceof FailureError ? error.failure : { code: UNKNOWN_ERROR, message: String(error) };
}

/** Les objectifs de la personne connectée, chargés au premier écran qui les lit. */
export function useObjectives(): ObjectivesView {
  const { objectives, announcements } = useServices();
  const user = useCurrentUser();
  const query = useQuery({
    queryKey: queryKeys.objectives(user?.id ?? null),
    queryFn: async () => unwrap(await objectives.loader.load()),
    enabled: user !== null,
    // Une copie qui ne contient que des gestes optimistes n'a encore jamais été lue : on la lit tout de suite.
    refetchOnMount: (current) => (current.state.data?.loaded ? true : 'always'),
  });
  const snapshot = query.data ?? EMPTY_SNAPSHOT;
  const loaded = snapshot.loaded;
  const { refetch } = query;

  // Un rechargement demandé (l'écran tiré vers le bas) dit s'il n'a pas abouti, même si l'écran montre encore
  // une lecture précédente. Le premier chargement, lui, est signalé par `reportLoadFailures`.
  const refresh = useCallback(() => {
    void refetch().then((result) => {
      if (!result.isError) return;
      const { code } = failureOf(result.error);
      if (code !== CLIENT_ERRORS.signedOut) announcements.report(failureReport('loadObjectives', code));
    });
  }, [announcements, refetch]);

  return {
    snapshot,
    loaded,
    failure: !loaded && query.error ? failureOf(query.error) : null,
    refreshing: query.isRefetching,
    refresh,
  };
}

/** Les cartes des objectifs : en marche, et accomplis. */
export function useObjectiveCards(now: Date): ObjectivesView & {
  readonly running: readonly ObjectiveCard[];
  readonly accomplished: readonly ObjectiveCard[];
} {
  const view = useObjectives();
  const { objectives, tasks } = view.snapshot;
  const cards = useMemo(() => toObjectiveCards(objectives, tasks, now), [objectives, tasks, now]);
  return {
    ...view,
    running: useMemo(() => cards.filter((card) => !card.accomplished), [cards]),
    accomplished: useMemo(() => cards.filter((card) => card.accomplished), [cards]),
  };
}

/** La vue détaillée d'un objectif racine ; undefined s'il n'est pas (encore) connu. */
export function useObjectiveDetail(
  objectiveId: string,
  now: Date,
): ObjectivesView & {
  readonly detail: ObjectiveDetail | undefined;
  /** Les objectifs sont chargés, et celui-ci n'en fait pas partie (ou c'est une étape). */
  readonly notFound: boolean;
} {
  const view = useObjectives();
  const { objectives, tasks } = view.snapshot;
  const detail = useMemo(
    () => toObjectiveDetail(objectiveId, objectives, tasks, now),
    [objectiveId, objectives, tasks, now],
  );
  return { ...view, detail, notFound: view.loaded && !isRootObjective(objectiveId, objectives) };
}

/** Tous les pas par quadrant. */
export function useMatrix(): ObjectivesView & { readonly matrix: Matrix } {
  const view = useObjectives();
  const { objectives, tasks } = view.snapshot;
  return { ...view, matrix: useMemo(() => toMatrix(objectives, tasks), [objectives, tasks]) };
}

/** Un objectif ou une étape, et les étapes de son objectif racine (pour les feuilles). */
export function useObjectiveItem(objectiveId: string): Objective | undefined {
  const { snapshot } = useObjectives();
  return useMemo(() => findObjective(snapshot, objectiveId), [snapshot, objectiveId]);
}

export function useTaskItem(taskId: string): Task | undefined {
  const { snapshot } = useObjectives();
  return useMemo(() => findTask(snapshot, taskId), [snapshot, taskId]);
}

export function useStageOptions(objectiveId: string): readonly StageOption[] {
  const { snapshot } = useObjectives();
  return useMemo(() => stageOptions(objectiveId, snapshot.objectives), [snapshot.objectives, objectiveId]);
}

/** Les gestes sur les objectifs : optimistes, écrits dans la file, annoncés ou signalés. */
export function useObjectiveCommands(): ObjectiveCommands {
  return useServices().objectives.commands;
}
