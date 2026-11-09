import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { EFeuilleConfirmation } from '@empreinte-studio/react-native';
import { objectiveErasure, type ObjectiveErasure } from '@/domain/objectives/erasure';
import { useEraser, useObjectives } from '@/state/objectives';
import { routes } from '../shell/routes';
import { GoneSheet, LoadingSheet, useCloseSheet } from './sheet-frame';
import { SHEETS_TEXTS } from './sheets.texts';

const T = SHEETS_TEXTS.eraseObjective;

/**
 * La confirmation qui précède l'effacement d'un objectif (maquette « Effacer ») : un dialogue d'alerte, ouvert depuis
 * le pied de la feuille « Modifier l'objectif », qui dit ce que l'objectif emporte et attend qu'on réécrive son nom.
 * Le geste est à l'encre, jamais le sceau ; « Garder l'objectif » referme la feuille. Laisser filer attend Apex
 * Brain : la feuille ne le propose pas encore.
 */
export function EraseObjectiveSheet({ objectiveId }: { readonly objectiveId: string }) {
  const { snapshot, loaded } = useObjectives();
  const { erasing } = useEraser();
  const erasure = useMemo(
    () => objectiveErasure(objectiveId, snapshot.objectives, snapshot.tasks, erasing),
    [objectiveId, snapshot, erasing],
  );
  // Ce que la feuille montrait : l'objectif effacé d'ici quitte la copie avant que la feuille se referme.
  const [shown, setShown] = useState(erasure);
  if (erasure && erasure !== shown) setShown(erasure);
  const current = erasure ?? shown;
  if (!current && !loaded) return <LoadingSheet title={T.title} />;
  if (!current) return <GoneSheet title={T.title} text={SHEETS_TEXTS.gone.objective} />;
  return <EraseObjectiveConfirmation objectiveId={objectiveId} erasure={current} />;
}

function EraseObjectiveConfirmation({
  objectiveId,
  erasure,
}: {
  readonly objectiveId: string;
  readonly erasure: ObjectiveErasure;
}) {
  const router = useRouter();
  const close = useCloseSheet();
  const { eraser } = useEraser();
  const [erased, setErased] = useState(false);

  // Retour à ses objectifs, où il n'est plus. L'arête qu'on quitte le garde le temps de partir. L'`Eraser` fait d'abord
  // partir le pas en attente, pour de bon : il ne reviendra pas avec l'objectif si celui-ci revient.
  const erase = () => {
    if (erased) return;
    setErased(true);
    router.dismissTo(routes.home);
    void eraser.eraseObjective(objectiveId);
  };

  return (
    <EFeuilleConfirmation
      titre={T.title}
      texte={T.carries(erasure.stageCount, erasure.tasks)}
      libelleConfirmer={T.confirm}
      libelleAnnuler={T.keep}
      aReecrire={erasure.title}
      sansRetour
      onConfirmer={erase}
      onAnnuler={close}
      testID="feuille-effacer-objectif"
    />
  );
}
