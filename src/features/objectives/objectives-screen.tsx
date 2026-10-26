import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EBouton, EEmpreinte, EIcone, ENote, ETexte, creerStyles } from '@empreinte-studio/react-native';
import { objectivesSummary } from '@/domain/objectives/objective-card';
import { formatToday } from '@/domain/shared/dates';
import { useReport } from '@/state/announcements';
import { useObjectiveCards, useObjectiveCommands } from '@/state/objectives';
import { useToday } from '@/state/today';
import { Ecran } from '@/ui/ecran';
import { EnTete } from '@/ui/en-tete';
import { pas, traits } from '@/ui/fondations';
import { Trame } from '@/ui/panneau';
import { Repli } from '@/ui/repli';
import { AppBand } from '../shell/app-band';
import { ReportNote } from '../shell/report-note';
import { routes } from '../shell/routes';
import { LoadingLine } from '../shell/screen-states';
import { SHELL_TEXTS } from '../shell/shell.texts';
import { ObjectiveCardView } from './objective-card';
import { OBJECTIVES_TEXTS } from './objectives.texts';

const useStyles = creerStyles(({ couleurs }) => ({
  echec: {
    gap: pas['pas-3'],
  },
  accompli: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-4'],
    paddingVertical: pas['pas-3'],
    borderTopWidth: traits['trait-fin'],
    borderTopColor: couleurs.trame,
  },
  accompliTextes: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
}));

/**
 * L'écran Objectifs, l'accueil (maquette « Objectifs ») : les objectifs en marche en cartes, chacun avec sa
 * progression et son prochain pas à cocher, puis les objectifs accomplis dans un repli.
 */
export function ObjectivesScreen() {
  const styles = useStyles();
  const router = useRouter();
  const today = useToday();
  const { running, accomplished, loaded, failure, refreshing, refresh } = useObjectiveCards(today);
  const commands = useObjectiveCommands();
  const { report } = useReport();

  // Une question à la fois : tant qu'Akari signale un souci, l'invitation attend.
  const empty = loaded && running.length === 0 && !report;
  const loading = !loaded && !failure && running.length === 0;
  const loadFailed = !loaded && !!failure && running.length === 0;

  return (
    <Ecran
      sousOnglets
      bandeau={<AppBand />}
      note={<ReportNote />}
      rafraichir={{ enCours: refreshing, onRafraichir: refresh }}
      testID="ecran-objectifs"
    >
      <EnTete
        repere={formatToday(today)}
        titre={OBJECTIVES_TEXTS.title}
        detail={objectivesSummary(running.length, accomplished.length)}
        actions={
          // Le seul sceau de l'écran : l'engagement principal.
          <EBouton variante="sceau" onPress={() => router.push(routes.newObjective)} testID="nouvel-objectif">
            <EIcone nom="plus" taille={18} />
            {OBJECTIVES_TEXTS.newObjective}
          </EBouton>
        }
      />

      {running.length > 0 ? (
        <Trame>
          {running.map((card) => (
            <ObjectiveCardView
              key={card.id}
              card={card}
              onToggleNextStep={(taskId, done) => void commands.setTaskDone(taskId, done)}
              onOpen={() => router.push(routes.objective(card.id))}
            />
          ))}
        </Trame>
      ) : empty ? (
        <ENote
          actions={
            <EBouton petit onPress={() => router.push(routes.newObjective)}>
              {OBJECTIVES_TEXTS.empty.start}
            </EBouton>
          }
        >
          <ETexte variante="voix">{OBJECTIVES_TEXTS.empty.question}</ETexte>
          <ETexte variante="voix">{OBJECTIVES_TEXTS.empty.invitation}</ETexte>
        </ENote>
      ) : loading ? (
        <LoadingLine text={OBJECTIVES_TEXTS.loading} />
      ) : loadFailed && !report ? (
        // La note d'Akari a été lue (« Compris ») : l'écran dit encore quoi faire.
        <View style={styles.echec}>
          <ETexte>{OBJECTIVES_TEXTS.loadFailed}</ETexte>
          <EBouton petit onPress={refresh}>
            {SHELL_TEXTS.reload}
          </EBouton>
        </View>
      ) : null}

      {accomplished.length > 0 ? (
        <Repli titre={OBJECTIVES_TEXTS.accomplished} detail={String(accomplished.length)} testID="accomplis">
          {accomplished.map((objective) => (
            <View key={objective.id} style={styles.accompli}>
              <EEmpreinte taille={32} decorative />
              <View style={styles.accompliTextes}>
                <ETexte>{objective.title}</ETexte>
                <ETexte variante="detail" couleur="encre-douce">
                  {OBJECTIVES_TEXTS.accomplishedOne}
                </ETexte>
              </View>
              <EBouton
                petit
                aria-label={OBJECTIVES_TEXTS.openLabel(objective.title)}
                onPress={() => router.push(routes.objective(objective.id))}
              >
                {OBJECTIVES_TEXTS.open}
              </EBouton>
            </View>
          ))}
        </Repli>
      ) : null}
    </Ecran>
  );
}
