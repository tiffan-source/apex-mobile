import { useRouter } from 'expo-router';
import { useState } from 'react';
import { EBouton, EChamp, EFeuille, ESaisie } from '@empreinte-studio/react-native';
import { EChampDate } from '@empreinte-studio/react-native/champ-date';
import {
  hasErrors,
  toEditObjectiveInput,
  toObjectiveForm,
  validateObjectiveForm,
  type ObjectiveForm,
} from '@/domain/objectives/forms';
import type { Objective } from '@/domain/objectives/objective';
import { isTemporaryId } from '@/domain/objectives/snapshot';
import { formatLongDate, startOfDay } from '@/domain/shared/dates';
import { useObjectiveCommands, useObjectiveItem, useObjectives } from '@/state/objectives';
import { routes } from '../shell/routes';
import { GoneSheet, LoadingSheet, SheetActions, useCloseSheet } from './sheet-frame';
import { SHEETS_TEXTS } from './sheets.texts';

const T = SHEETS_TEXTS.editObjective;

/**
 * La feuille « Modifier l'objectif » : son nom, quelques mots, son pourquoi et son horizon. La description et
 * le pourquoi s'effacent en vidant leur champ ; l'horizon se retire (Apex Brain le permet). L'enregistrement est
 * optimiste : la feuille se ferme tout de suite, sans rien envoyer si rien n'a changé. Son pied garde une sortie
 * discrète, « Effacer l'objectif », qui passe la main à la feuille de confirmation.
 */
export function EditObjectiveSheet({ objectiveId }: { readonly objectiveId: string }) {
  const { loaded } = useObjectives();
  const objective = useObjectiveItem(objectiveId);
  if (!objective && !loaded) return <LoadingSheet title={T.title} />;
  if (!objective) return <GoneSheet title={T.title} text={SHEETS_TEXTS.gone.objective} />;
  return <EditObjectiveForm objective={objective} />;
}

function EditObjectiveForm({ objective }: { readonly objective: Objective }) {
  const router = useRouter();
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
    <EFeuille
      titre={T.title}
      onFermer={close}
      actions={
        <SheetActions label={SHEETS_TEXTS.save} onConfirm={save} onCancel={close} testID="enregistrer" />
      }
      {...(isTemporaryId(initial.id)
        ? {}
        : {
            pied: (
              <>
                {T.exitQuestion}
                {/* La confirmation prend la place de cette feuille : la garder ramène à l'arête. */}
                <EBouton
                  variante="nu"
                  petit
                  doux
                  onPress={() => router.replace(routes.eraseObjective(initial.id))}
                >
                  {T.erase}
                </EBouton>
              </>
            ),
          })}
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
        <EChampDate
          libelle={T.dueDate}
          valeur={form.dueDate}
          {...(form.dueDate ? { texte: formatLongDate(form.dueDate) } : {})}
          onChange={(date) => change({ dueDate: date ? startOfDay(date) : null })}
          texteVide={SHEETS_TEXTS.chooseDate}
          retirable
          libelleRetirer={T.removeDueDate}
        />
      </EChamp>
    </EFeuille>
  );
}
