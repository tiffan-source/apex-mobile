import { View } from 'react-native';
import { EChamp, ESaisie, ETexte, creerStyles } from '@empreinte-studio/react-native';
import { IMPORTANCE_OPTIONS, URGENCY_OPTIONS, quadrantOf } from '@/domain/objectives/eisenhower';
import type { StageOption } from '@/domain/objectives/objective-detail';
import type { FormErrors, TaskForm } from '@/domain/objectives/forms';
import { pas } from '@/ui/fondations';
import { Selection } from '@/ui/selection';
import { SHEETS_TEXTS } from './sheets.texts';

const T = SHEETS_TEXTS.task;

const useStyles = creerStyles(() => ({
  niveaux: {
    flexDirection: 'row',
    gap: pas['pas-4'],
  },
  niveau: {
    flex: 1,
    minWidth: 0,
  },
}));

const importanceOptions = IMPORTANCE_OPTIONS.map(({ value, label }) => ({ valeur: value, libelle: label }));
const urgencyOptions = URGENCY_OPTIONS.map(({ value, label }) => ({ valeur: value, libelle: label }));

/**
 * Les champs d'un pas : son intitulé, son étape, son importance et son urgence, qui le placent dans la matrice
 * (la ligne du bas le dit, comme un aperçu).
 */
export function TaskFields({
  form,
  onChange,
  errors,
  stages,
  titleHelp,
  stageHelp,
  onSubmit,
}: {
  readonly form: TaskForm;
  readonly onChange: (patch: Partial<TaskForm>) => void;
  readonly errors: FormErrors<'title' | 'stageId'>;
  readonly stages: readonly StageOption[];
  readonly titleHelp?: string;
  readonly stageHelp?: string;
  readonly onSubmit?: () => void;
}) {
  const styles = useStyles();
  return (
    <>
      <EChamp libelle={T.name} {...(titleHelp ? { aide: titleHelp } : {})} erreur={errors.title ?? null}>
        <ESaisie
          value={form.title}
          onChangeText={(title) => onChange({ title })}
          autoComplete="off"
          returnKeyType="done"
          {...(onSubmit ? { onSubmitEditing: onSubmit } : {})}
          testID="champ-pas"
        />
      </EChamp>
      {stages.length > 0 ? (
        <EChamp libelle={T.stage} {...(stageHelp ? { aide: stageHelp } : {})} erreur={errors.stageId ?? null}>
          <Selection
            libelle={T.stage}
            options={stages.map((stage) => ({ valeur: stage.id, libelle: stage.label }))}
            valeur={form.stageId}
            onChange={(stageId) => onChange({ stageId })}
            texteVide={T.chooseStage}
            invalide={!!errors.stageId}
            testID="choix-etape"
          />
        </EChamp>
      ) : (
        <ETexte variante="detail" couleur="encre-douce">
          {T.noStage}
        </ETexte>
      )}
      <View style={styles.niveaux}>
        <EChamp libelle={T.importance} style={styles.niveau}>
          <Selection
            libelle={T.importance}
            options={importanceOptions}
            valeur={form.importance}
            onChange={(importance) => onChange({ importance })}
            testID="choix-importance"
          />
        </EChamp>
        <EChamp libelle={T.urgency} style={styles.niveau}>
          <Selection
            libelle={T.urgency}
            options={urgencyOptions}
            valeur={form.urgency}
            onChange={(urgency) => onChange({ urgency })}
            testID="choix-urgence"
          />
        </EChamp>
      </View>
      <ETexte variante="detail" couleur="encre-douce">
        {T.quadrant(quadrantOf(form))}
      </ETexte>
    </>
  );
}
