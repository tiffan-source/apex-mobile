import { useState } from 'react';
import { EChamp, ESaisie } from '@empreinte-studio/react-native';
import {
  hasErrors,
  toEditObjectiveInput,
  toObjectiveForm,
  validateObjectiveForm,
  type ObjectiveForm,
} from '@/domain/objectives/forms';
import type { Objective } from '@/domain/objectives/objective';
import { formatLongDate, startOfDay } from '@/domain/shared/dates';
import { useObjectiveCommands, useObjectiveItem, useObjectives } from '@/state/objectives';
import { ChampDate } from '@/ui/champ-date';
import { Feuille } from '@/ui/feuille';
import { GoneSheet, LoadingSheet, SheetActions, useCloseSheet } from './sheet-frame';
import { SHEETS_TEXTS } from './sheets.texts';

const T = SHEETS_TEXTS.editStage;

/**
 * La feuille « Modifier l'étape » : son nom, quelques mots et son échéance. Une étape est un sous-objectif :
 * l'enregistrement passe par la modification d'un objectif, de façon optimiste, et seulement si quelque chose a
 * changé.
 */
export function EditStageSheet({ stageId }: { readonly stageId: string }) {
  const { loaded } = useObjectives();
  const stage = useObjectiveItem(stageId);
  if (!stage && !loaded) return <LoadingSheet title={T.title} />;
  if (!stage) return <GoneSheet title={T.title} text={SHEETS_TEXTS.gone.stage} />;
  return <EditStageForm stage={stage} />;
}

function EditStageForm({ stage }: { readonly stage: Objective }) {
  const close = useCloseSheet();
  const commands = useObjectiveCommands();
  const [initial] = useState(stage);
  const [form, setForm] = useState<ObjectiveForm>(() => toObjectiveForm(stage));
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateObjectiveForm(form, 'stage') : {};
  const change = (patch: Partial<ObjectiveForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = () => {
    setSubmitted(true);
    if (hasErrors(validateObjectiveForm(form, 'stage'))) return;
    const input = toEditObjectiveInput(initial, form);
    if (input) void commands.editObjective(initial.id, input);
    close();
  };

  return (
    <Feuille
      titre={T.title}
      onFermer={close}
      actions={
        <SheetActions label={SHEETS_TEXTS.save} onConfirm={save} onCancel={close} testID="enregistrer" />
      }
      testID="feuille-etape"
    >
      <EChamp libelle={T.name} erreur={errors.title ?? null}>
        <ESaisie value={form.title} onChangeText={(title) => change({ title })} autoComplete="off" />
      </EChamp>
      <EChamp libelle={T.description} facultatif>
        <ESaisie
          tailleAuto
          lignesMin={2}
          lignesMax={6}
          value={form.description}
          onChangeText={(description) => change({ description })}
        />
      </EChamp>
      <EChamp libelle={T.dueDate} facultatif aide={T.dueDateHelp}>
        <ChampDate
          libelle={T.dueDate}
          valeur={form.dueDate}
          {...(form.dueDate ? { texte: formatLongDate(form.dueDate) } : {})}
          onChange={(date) => change({ dueDate: date ? startOfDay(date) : null })}
          texteVide={SHEETS_TEXTS.chooseDate}
          retirable
          libelleRetirer={T.removeDueDate}
        />
      </EChamp>
    </Feuille>
  );
}
