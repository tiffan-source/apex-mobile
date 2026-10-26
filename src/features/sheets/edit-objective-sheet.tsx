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

const T = SHEETS_TEXTS.editObjective;

/**
 * La feuille « Modifier l'objectif » : son nom, quelques mots, son pourquoi et son horizon. La description et
 * le pourquoi s'effacent en vidant leur champ ; l'horizon se retire (Apex Brain le permet). L'enregistrement est
 * optimiste : la feuille se ferme tout de suite, sans rien envoyer si rien n'a changé.
 */
export function EditObjectiveSheet({ objectiveId }: { readonly objectiveId: string }) {
  const { loaded } = useObjectives();
  const objective = useObjectiveItem(objectiveId);
  if (!objective && !loaded) return <LoadingSheet title={T.title} />;
  if (!objective) return <GoneSheet title={T.title} text={SHEETS_TEXTS.gone.objective} />;
  return <EditObjectiveForm objective={objective} />;
}

function EditObjectiveForm({ objective }: { readonly objective: Objective }) {
  const close = useCloseSheet();
  const commands = useObjectiveCommands();
  // La feuille part de l'objectif tel qu'il était à son ouverture.
  const [initial] = useState(objective);
  const [form, setForm] = useState<ObjectiveForm>(() => toObjectiveForm(objective));
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateObjectiveForm(form, 'objective') : {};
  const change = (patch: Partial<ObjectiveForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = () => {
    setSubmitted(true);
    if (hasErrors(validateObjectiveForm(form, 'objective'))) return;
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
      testID="feuille-objectif"
    >
      <EChamp libelle={T.name} erreur={errors.title ?? null}>
        <ESaisie
          value={form.title}
          onChangeText={(title) => change({ title })}
          autoComplete="off"
          testID="champ-titre"
        />
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
      <EChamp libelle={T.why} facultatif>
        <ESaisie
          tailleAuto
          lignesMin={2}
          lignesMax={6}
          value={form.why}
          onChangeText={(why) => change({ why })}
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
