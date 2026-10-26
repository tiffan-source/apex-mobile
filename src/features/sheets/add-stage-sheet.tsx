import { useState } from 'react';
import { EChamp, ESaisie } from '@empreinte-studio/react-native';
import { hasErrors, validateStageTitle } from '@/domain/objectives/forms';
import { useObjectiveCommands } from '@/state/objectives';
import { Feuille } from '@/ui/feuille';
import { SheetActions, useCloseSheet } from './sheet-frame';
import { SHEETS_TEXTS } from './sheets.texts';

const T = SHEETS_TEXTS.addStage;

/**
 * La feuille « Ajouter une étape » : un nom, et l'étape rejoint l'arête. L'ajout est optimiste : la feuille se
 * ferme tout de suite, et l'enregistrement est annoncé, ou signalé s'il n'aboutit pas.
 */
export function AddStageSheet({ objectiveId }: { readonly objectiveId: string }) {
  const close = useCloseSheet();
  const commands = useObjectiveCommands();
  const [title, setTitle] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateStageTitle(title) : {};

  const add = () => {
    setSubmitted(true);
    if (hasErrors(validateStageTitle(title))) return;
    void commands.addStage(objectiveId, title.trim());
    close();
  };

  return (
    <Feuille
      titre={T.title}
      onFermer={close}
      actions={<SheetActions label={SHEETS_TEXTS.add} onConfirm={add} onCancel={close} testID="ajouter" />}
      testID="feuille-ajout-etape"
    >
      <EChamp libelle={T.name} aide={T.help} erreur={errors.title ?? null}>
        <ESaisie
          value={title}
          onChangeText={setTitle}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={add}
          testID="champ-nom-etape"
        />
      </EChamp>
    </Feuille>
  );
}
