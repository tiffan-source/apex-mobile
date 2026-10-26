import { useState } from 'react';
import { NEW_TASK_LEVELS } from '@/domain/objectives/eisenhower';
import { hasErrors, validateNewTask, type TaskForm } from '@/domain/objectives/forms';
import { rootIdOf } from '@/domain/objectives/tree';
import { useObjectiveCommands, useObjectives, useStageOptions } from '@/state/objectives';
import { Feuille } from '@/ui/feuille';
import { GoneSheet, LoadingSheet, SheetActions, useCloseSheet } from './sheet-frame';
import { SHEETS_TEXTS } from './sheets.texts';
import { TaskFields } from './task-fields';

const T = SHEETS_TEXTS.task;

/**
 * La feuille « Ajouter un pas » : son intitulé, son étape (jamais l'objectif lui-même), son importance et son
 * urgence. Un nouveau pas naît « À planifier » (important, pas urgent) : là où vont les pas des objectifs.
 * L'ajout est optimiste : la feuille se ferme tout de suite.
 */
export function AddTaskSheet({ stageId }: { readonly stageId: string }) {
  const { snapshot, loaded } = useObjectives();
  const rootId = rootIdOf(stageId, snapshot.objectives);
  if (!rootId && !loaded) return <LoadingSheet title={T.addTitle} />;
  if (!rootId) return <GoneSheet title={T.addTitle} text={SHEETS_TEXTS.gone.stage} />;
  return <AddTaskForm rootId={rootId} stageId={stageId} />;
}

function AddTaskForm({ rootId, stageId }: { readonly rootId: string; readonly stageId: string }) {
  const close = useCloseSheet();
  const commands = useObjectiveCommands();
  const stages = useStageOptions(rootId);
  const [form, setForm] = useState<TaskForm>({ title: '', stageId, ...NEW_TASK_LEVELS });
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateNewTask(form) : {};

  const add = () => {
    setSubmitted(true);
    if (hasErrors(validateNewTask(form)) || form.stageId === null) return;
    void commands.addTask(form.stageId, {
      title: form.title.trim(),
      importance: form.importance,
      urgency: form.urgency,
    });
    close();
  };

  return (
    <Feuille
      titre={T.addTitle}
      onFermer={close}
      actions={<SheetActions label={SHEETS_TEXTS.add} onConfirm={add} onCancel={close} testID="ajouter" />}
      testID="feuille-ajout-pas"
    >
      <TaskFields
        form={form}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        errors={errors}
        stages={stages}
        titleHelp={T.help}
        onSubmit={add}
      />
    </Feuille>
  );
}
