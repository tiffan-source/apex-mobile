import type { ObjectivesSnapshot } from '@/domain/objectives/objective';
import { TEMPORARY_ID_PREFIX } from '@/domain/objectives/snapshot';

/**
 * La copie locale des objectifs de la personne connectée, telle que les écrans la lisent. L'application la
 * change pour les gestes optimistes et leur réconciliation ; l'adaptateur la range où l'interface la lit
 * (le cache de TanStack Query).
 */
export interface ObjectivesCache {
  /** La copie actuelle ; undefined tant que rien n'est chargé ni posé. */
  read(): ObjectivesSnapshot | undefined;
  /** Change la copie. Sans copie, le changement part d'une copie vide, pas encore chargée. */
  update(change: (snapshot: ObjectivesSnapshot) => ObjectivesSnapshot): void;
}

/** Les ids temporaires des éléments optimistes. */
export interface TemporaryIds {
  next(): string;
}

/** Des ids temporaires uniques pour la durée de l'application. */
export function createTemporaryIds(): TemporaryIds {
  let sequence = 0;
  const session = Date.now().toString(36);
  return {
    next: () => {
      sequence += 1;
      return `${TEMPORARY_ID_PREFIX}${session}-${sequence}`;
    },
  };
}
