import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { EBouton, EChamp, ESaisie, ETexte, creerStyles } from '@empreinte-studio/react-native';
import {
  EMPTY_DRAFT,
  toCreateObjectiveInput,
  validateDraft,
  type NewObjectiveDraft,
} from '@/domain/objectives/forms';
import { formatHorizon, formatLongDate, isBeforeToday, startOfDay } from '@/domain/shared/dates';
import { firstName } from '@/domain/shared/titles';
import { quoted } from '@/domain/shared/typography';
import { useObjectiveCommands } from '@/state/objectives';
import { useCurrentUser } from '@/state/session';
import { useToday } from '@/state/today';
import { ChampDate } from '@/ui/champ-date';
import { Ecran } from '@/ui/ecran';
import { EnTete } from '@/ui/en-tete';
import { Fil, type RepliqueFil } from '@/ui/fil';
import { FilAriane } from '@/ui/fil-ariane';
import { pas } from '@/ui/fondations';
import { Panneau, Trame } from '@/ui/panneau';
import { ReportNote } from '../shell/report-note';
import { routes } from '../shell/routes';
import { SHELL_TEXTS } from '../shell/shell.texts';
import { NEW_OBJECTIVE_TEXTS as T } from './new-objective.texts';

const useStyles = creerStyles(() => ({
  brouillon: {
    gap: pas['pas-3'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: pas['pas-2'],
  },
}));

/**
 * Nouvel objectif (`/objectifs/nouveau`), la phase « brouillon » d'Akari : Akari pose ses questions et la
 * personne répond dans des champs ; dessous, le brouillon se met à jour en direct. Rien n'est enregistré avant
 * « Je m'y engage » (le seul sceau de l'écran), qui crée l'objectif puis ouvre Akari sur lui, avec son id
 * définitif. Si l'enregistrement n'aboutit pas, la note d'Akari le dit et le brouillon garde ce qui a été écrit.
 */
export function NewObjectiveScreen() {
  const styles = useStyles();
  const router = useRouter();
  const today = useToday();
  const user = useCurrentUser();
  const commands = useObjectiveCommands();
  const [draft, setDraft] = useState<NewObjectiveDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const errors = submitted ? validateDraft(draft, today) : {};
  const change = (patch: Partial<NewObjectiveDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const person = firstName(user?.name, T.personFallback);

  const preview = {
    title: draft.title.trim(),
    why: draft.why.trim(),
    description: draft.description.trim(),
    horizon: draft.dueDate && !isBeforeToday(draft.dueDate, today) ? formatHorizon(draft.dueDate, today) : '',
  };

  const engage = async () => {
    if (saving) return;
    setSubmitted(true);
    if (Object.keys(validateDraft(draft, today)).length > 0) return;
    const input = toCreateObjectiveInput(draft);
    if (!input) return;
    setSaving(true);
    const id = await commands.createObjective(input);
    if (!mounted.current) return;
    setSaving(false);
    // L'objectif est enregistré : Akari s'ouvre sur lui. Sinon, la note d'Akari le dit et le brouillon reste.
    if (id) router.replace(routes.akari(id));
  };

  const akari = (id: string, text: string): RepliqueFil => ({ id, auteur: 'assistant', contenu: text });
  const answer = (id: string, field: ReactNode): RepliqueFil => ({ id, auteur: 'personne', contenu: field });

  const replies: RepliqueFil[] = [
    akari('question-titre', T.questions.title),
    answer(
      'reponse-titre',
      <EChamp libelle={T.fields.title} erreur={errors.title ?? null}>
        <ESaisie
          value={draft.title}
          onChangeText={(title) => change({ title })}
          placeholder={T.fields.titlePlaceholder}
          autoComplete="off"
          returnKeyType="next"
          testID="champ-titre"
        />
      </EChamp>,
    ),
    akari('question-pourquoi', T.questions.why),
    answer(
      'reponse-pourquoi',
      <EChamp libelle={T.fields.why} facultatif>
        <ESaisie
          tailleAuto
          lignesMin={2}
          lignesMax={6}
          value={draft.why}
          onChangeText={(why) => change({ why })}
        />
      </EChamp>,
    ),
    akari('question-horizon', T.questions.dueDate),
    answer(
      'reponse-horizon',
      <EChamp
        libelle={T.fields.dueDate}
        facultatif
        aide={T.fields.dueDateHelp}
        erreur={errors.dueDate ?? null}
      >
        <ChampDate
          libelle={T.fields.dueDate}
          valeur={draft.dueDate}
          {...(draft.dueDate ? { texte: formatLongDate(draft.dueDate) } : {})}
          onChange={(date) => change({ dueDate: date ? startOfDay(date) : null })}
          minimum={startOfDay(today)}
          texteVide={T.fields.chooseDate}
          retirable
          libelleRetirer={T.fields.removeDate}
          invalide={!!errors.dueDate}
          testID="champ-horizon"
        />
      </EChamp>,
    ),
    akari('question-description', T.questions.description),
    answer(
      'reponse-description',
      <EChamp libelle={T.fields.description} facultatif>
        <ESaisie
          tailleAuto
          lignesMin={2}
          lignesMax={8}
          value={draft.description}
          onChangeText={(description) => change({ description })}
        />
      </EChamp>,
    ),
    ...(preview.title ? [akari('relire', T.questions.review)] : []),
  ];

  return (
    <Ecran note={<ReportNote />} testID="ecran-nouvel-objectif">
      <EnTete
        filAriane={
          <FilAriane
            miettes={[
              { libelle: SHELL_TEXTS.crumbs.objectives, onPress: () => router.dismissTo(routes.home) },
              { libelle: T.title },
            ]}
          />
        }
        repere={T.marker}
        iconeRepere="akari"
        titre={T.title}
        detail={T.intro}
      />

      <Trame>
        <Panneau>
          <Fil repliques={replies} personne={person} />
        </Panneau>
        <Panneau corne="l" style={styles.brouillon}>
          <ETexte variante="repere" couleur="encre-douce">
            {T.draft.marker}
          </ETexte>
          <ETexte variante="objectif" role="heading" couleur={preview.title ? 'encre' : 'encre-douce'}>
            {preview.title || T.draft.untitled}
          </ETexte>
          {preview.why ? (
            <ETexte variante="voix" couleur="encre-douce">
              {quoted(preview.why)}
            </ETexte>
          ) : null}
          {preview.description ? <ETexte>{preview.description}</ETexte> : null}
          <ETexte variante="detail" couleur={preview.horizon ? 'encre' : 'encre-douce'}>
            {preview.horizon || T.draft.noHorizon}
          </ETexte>
          <View style={styles.actions}>
            <EBouton
              variante="sceau"
              disabled={!preview.title}
              aria-busy={saving}
              onPress={() => void engage()}
              testID="m-y-engager"
            >
              {T.draft.engage}
            </EBouton>
            <EBouton variante="nu" onPress={() => router.dismissTo(routes.home)}>
              {T.draft.later}
            </EBouton>
          </View>
          {saving ? (
            <ETexte variante="detail" couleur="encre-douce" role="status" accessibilityLiveRegion="polite">
              {T.draft.saving}
            </ETexte>
          ) : null}
          <ETexte variante="detail" couleur="encre-douce">
            {T.draft.after}
          </ETexte>
        </Panneau>
      </Trame>
    </Ecran>
  );
}
