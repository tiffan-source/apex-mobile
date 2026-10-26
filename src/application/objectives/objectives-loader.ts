import type { ObjectivesSnapshot } from '@/domain/objectives/objective';
import { keepOptimistic } from '@/domain/objectives/snapshot';
import { CLIENT_ERRORS, fail, ok, type Result } from '@/domain/shared/result';
import type { ObjectivesAndTasks, ObjectivesGateway } from '../ports/objectives-gateway';
import type { ObjectivesCache } from './objectives-cache';
import { SessionClosedError, type WriteQueue } from './write-queue';

/**
 * Le chargement des objectifs, comme `withObjectiveQuery` du client web : une lecture de la base, dans la file
 * des écritures, qui ne rend que ce que l'écran peut montrer.
 *
 * Un geste fait après la mise en file d'un rechargement (cocher, modifier, déplacer un pas chargé) a déjà
 * changé l'écran, mais il n'est écrit qu'après la lecture : plus ancienne que lui, elle l'effacerait de l'écran
 * alors qu'il est enregistré. Elle est alors laissée de côté, et la base relue après ces écritures. Au premier
 * chargement, rien n'est encore à l'écran : la lecture vaut tout de suite. Les éléments encore optimistes (id
 * temporaire) sont gardés au remplacement, sinon ils disparaîtraient jusqu'au prochain chargement.
 *
 * Seules les écritures comptent comme des gestes : deux chargements en même temps ne se relancent pas l'un
 * l'autre. Un chargement abandonné (`signal`, quand un autre le remplace) ne relit pas la base.
 */
export class ObjectivesLoader {
  constructor(
    private readonly deps: {
      readonly gateway: ObjectivesGateway;
      readonly writes: WriteQueue;
      readonly cache: ObjectivesCache;
    },
  ) {}

  async load(signal?: AbortSignal): Promise<Result<ObjectivesSnapshot>> {
    const { writes, gateway, cache } = this.deps;
    const mark = writes.enqueued;
    const result = await writes
      .read(() => gateway.list())
      .catch((error: unknown) => {
        // La session a pris fin pendant que la lecture attendait son tour.
        if (error instanceof SessionClosedError)
          return fail<ObjectivesAndTasks>({ code: CLIENT_ERRORS.signedOut, message: error.message });
        throw error;
      });
    if (!result.success) return result;
    if (writes.enqueued !== mark && cache.read()?.loaded && !signal?.aborted) return this.load(signal);
    return ok(keepOptimistic(result.data, cache.read()));
  }
}
