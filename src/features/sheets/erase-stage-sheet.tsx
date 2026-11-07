import { useMemo, useState } from 'react';
import { EFeuilleConfirmation, EPas, ETexte } from '@empreinte-studio/react-native';
import { stageErasure, type StageErasure } from '@/domain/objectives/erasure';
import { useObjectiveCommands, useObjectives, useTaskTrace } from '@/state/objectives';
import { GoneSheet, LoadingSheet, useCloseSheet } from './sheet-frame';
import { SHEETS_TEXTS } from './sheets.texts';

const T = SHEETS_TEXTS.eraseStage;

/**
 * La validation qui précède l'effacement d'une étape (maquette « Effacer », mobile) : un dialogue d'alerte qui montre
 * l'arête avec l'étape qui sort du plan, en pointillés, et dit ce qu'elle emporte. « Effacer l'étape » est un trait,
 * jamais le sceau ; « Garder l'étape » referme la feuille.
 */
export function EraseStageSheet({ stageId }: { readonly stageId: string }) {
  const { snapshot, loaded } = useObjectives();
  const { erasing } = useTaskTrace();
  const erasure = useMemo(
    () => stageErasure(stageId, snapshot.objectives, snapshot.tasks, erasing),
    [stageId, snapshot, erasing],
  );
  // Ce que la feuille montrait : l'étape effacée d'ici quitte l'arête avant que la feuille se referme.
  const [shown, setShown] = useState(erasure);
  if (erasure && erasure !== shown) setShown(erasure);
  const current = erasure ?? shown;
  if (!current && !loaded) return <LoadingSheet title={T.title} />;
  if (!current) return <GoneSheet title={T.title} text={SHEETS_TEXTS.gone.stage} />;
  return <EraseStageConfirmation stageId={stageId} erasure={current} />;
}

function EraseStageConfirmation({
  stageId,
  erasure,
}: {
  readonly stageId: string;
  readonly erasure: StageErasure;
}) {
  const close = useCloseSheet();
  const commands = useObjectiveCommands();
  const [erased, setErased] = useState(false);

  const erase = () => {
    if (erased) return;
    setErased(true);
    close();
    void commands.deleteObjective(stageId);
  };

  return (
    <EFeuilleConfirmation
      titre={T.title}
      libelleConfirmer={T.confirm}
      libelleAnnuler={T.keep}
      onConfirmer={erase}
      onAnnuler={close}
      testID="feuille-effacer-etape"
    >
      <EPas
        faits={erasure.remaining.done}
        aFaire={erasure.remaining.toDo}
        sortants={1}
        unite="etape"
        legende={T.arete(erasure.stageCount)}
      />
      <ETexte>{T.carries(erasure.name, erasure.tasks)}</ETexte>
    </EFeuilleConfirmation>
  );
}
