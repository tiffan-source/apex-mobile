import { useState } from 'react';
import { hasErrors, toEditTaskInput, validateTaskEdit, type TaskForm } from '@/domain/objectives/forms';
import type { Task } from '@/domain/objectives/objective';
import { rootIdOf } from '@/domain/objectives/tree';
import { useObjectiveCommands, useObjectives, useStageOptions, useTaskItem } from '@/state/objectives';
import { Feuille } from '@/ui/feuille';
import { GoneSheet, LoadingSheet, SheetActions, useCloseSheet } from './sheet-frame';
import { SHEETS_TEXTS } from './sheets.texts';
import { TaskFields } from './task-fields';

const T = SHEETS_TEXTS.task;

/**
 * La feuille « Modifier le pas » : son intitulé, son étape, son importance et son urgence. Un pas sans étape
 * s'y range dans une étape. L'enregistrement est optimiste ; rien ne part si rien n'a changé.
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
  const close = useCloseSheet();
  const commands = useObjectiveCommands();
  const stages = useStageOptions(rootId);
  const [initial] = useState(task);
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
    <Feuille
      titre={T.editTitle}
      onFermer={close}
      actions={
        <SheetActions label={SHEETS_TEXTS.save} onConfirm={save} onCancel={close} testID="enregistrer" />
      }
      testID="feuille-pas"
    >
      <TaskFields
        form={form}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        errors={errors}
        stages={stages}
        {...(shownStageId === null ? { stageHelp: T.placeInStage } : {})}
      />
    </Feuille>
  );
}
