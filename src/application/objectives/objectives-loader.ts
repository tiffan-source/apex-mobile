import type { ObjectivesSnapshot } from '@/domain/objectives/objective';
import { keepOptimistic } from '@/domain/objectives/snapshot';
import { ok, type Result } from '@/domain/shared/result';
import type { ObjectivesGateway } from '../ports/objectives-gateway';
import type { ObjectivesCache } from './objectives-cache';
import type { WriteQueue } from './write-queue';

/**
 * Le chargement des objectifs, comme `withObjectiveQuery` du client web : une lecture de la base, dans la file
 * des écritures, qui ne rend que ce que l'écran peut montrer.
 *
 * Un geste fait après la mise en file d'un rechargement (cocher, modifier, déplacer un pas chargé) a déjà
 * changé l'écran, mais il n'est écrit qu'après la lecture : plus ancienne que lui, elle l'effacerait de l'écran
 * alors qu'il est enregistré. Elle est alors laissée de côté, et la base relue après ces écritures. Au premier
 * chargement, rien n'est encore à l'écran : la lecture vaut tout de suite. Les éléments encore optimistes (id
 * temporaire) sont gardés au remplacement, sinon ils disparaîtraient jusqu'au prochain chargement.
 */
export class ObjectivesLoader {
  constructor(
    private readonly deps: {
      readonly gateway: ObjectivesGateway;
      readonly writes: WriteQueue;
      readonly cache: ObjectivesCache;
    },
  ) {}

  async load(): Promise<Result<ObjectivesSnapshot>> {
    const read = this.deps.writes.run(() => this.deps.gateway.list());
    const mark = this.deps.writes.enqueued;
    const result = await read;
    if (!result.success) return result;
    if (this.deps.writes.enqueued !== mark && this.deps.cache.read()?.loaded) return this.load();
    return ok(keepOptimistic(result.data, this.deps.cache.read()));
  }
}
