import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { EBouton, EFeuille, creerStyles } from '@empreinte-studio/react-native';
import { hasErrors, toEditTaskInput, validateTaskEdit, type TaskForm } from '@/domain/objectives/forms';
import type { Task } from '@/domain/objectives/objective';
import { isTemporaryId } from '@/domain/objectives/snapshot';
import { rootIdOf } from '@/domain/objectives/tree';
import {
  useObjectiveCommands,
  useObjectives,
  useStageOptions,
  useTaskItem,
  useTaskTrace,
} from '@/state/objectives';
import { routes } from '../shell/routes';
import { GoneSheet, LoadingSheet, SheetActions, useCloseSheet } from './sheet-frame';
import { SHEETS_TEXTS } from './sheets.texts';
import { TaskFields } from './task-fields';

const T = SHEETS_TEXTS.task;

const useStyles = creerStyles(() => ({
  // Le mot s'aligne sur le bord des champs, comme dans la maquette.
  effacer: {
    paddingHorizontal: 0,
  },
}));

/**
 * La feuille « Modifier le pas » : son intitulé, son étape, son importance et son urgence. Un pas sans étape
 * s'y range dans une étape. L'enregistrement est optimiste ; rien ne part si rien n'a changé. Son pied efface le
 * pas sans glisser sa ligne (maquette « Effacer », mobile) : la feuille se ferme, et sa trace prend sa place dans
 * l'arête.
 */
export function EditTaskSheet({
  taskId,
  shownStageId,
}: {
  readonly taskId: string;
  readonly shownStageId: string | null;
}) {
  const task = useTaskItem(taskId);
  const { snapshot, loaded } = useObjectives();
  const rootId = task ? rootIdOf(task.objectiveId, snapshot.objectives) : null;
  if ((!task || !rootId) && !loaded) return <LoadingSheet title={T.editTitle} />;
  if (!task || !rootId) return <GoneSheet title={T.editTitle} text={SHEETS_TEXTS.gone.task} />;
  return <EditTaskForm task={task} rootId={rootId} shownStageId={shownStageId} />;
}

function EditTaskForm({
  task,
  rootId,
  shownStageId,
}: {
  readonly task: Task;
  readonly rootId: string;
  readonly shownStageId: string | null;
}) {
  const styles = useStyles();
  const router = useRouter();
  const close = useCloseSheet();
  const commands = useObjectiveCommands();
  const { trace } = useTaskTrace();
  const stages = useStageOptions(rootId);
  const [initial] = useState(task);
  const [erasing, setErasing] = useState(false);

  // La feuille partie, la trace du pas prend sa place dans l'arête : le lecteur d'écran s'y pose, sur « Remettre ».
  useEffect(() => {
    if (!erasing) return undefined;
    return () => trace.start(initial.id);
  }, [erasing, trace, initial.id]);

  const erase = () => {
    if (erasing) return;
    if (router.canGoBack()) {
      setErasing(true);
      router.back();
      return;
    }
    // Ouverte par un lien, sans l'arête dessous : rien ne montrerait sa trace, le pas part tout de suite.
    void commands.deleteTask(initial.id);
    router.replace(routes.home);
  };
  // L'étape affichée n'est gardée que si elle est bien une étape de cet objectif.
  const [form, setForm] = useState<TaskForm>(() => ({
    title: task.title,
    stageId: shownStageId !== null && stages.some((stage) => stage.id === shownStageId) ? shownStageId : null,
    importance: task.importance,
    urgency: task.urgency,
  }));
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateTaskEdit(form) : {};

  const save = () => {
    setSubmitted(true);
    if (hasErrors(validateTaskEdit(form))) return;
    const input = toEditTaskInput(initial, shownStageId, form);
    if (input) void commands.editTask(initial.id, input);
    close();
  };

  return (
    <EFeuille
      titre={T.editTitle}
      onFermer={close}
      actions={
        <SheetActions label={SHEETS_TEXTS.save} onConfirm={save} onCancel={close} testID="enregistrer" />
      }
      {...(isTemporaryId(initial.id)
        ? {}
        : {
            pied: (
              <EBouton variante="nu" petit doux onPress={erase} style={styles.effacer}>
                {T.erase}
              </EBouton>
            ),
          })}
      testID="feuille-pas"
    >
      <TaskFields
        form={form}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        errors={errors}
        stages={stages}
        {...(shownStageId === null ? { stageHelp: T.placeInStage } : {})}
      />
    </EFeuille>
  );
}
