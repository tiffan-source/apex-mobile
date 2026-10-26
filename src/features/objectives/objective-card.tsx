import { View } from 'react-native';
import { EBouton, ECarte, EPas, ETache, ETexte, creerStyles } from '@empreinte-studio/react-native';
import { cardProgress, type ObjectiveCard } from '@/domain/objectives/objective-card';
import { isTemporaryId } from '@/domain/objectives/snapshot';
import { quoted } from '@/domain/shared/typography';
import { pas, traits } from '@/ui/fondations';
import { OBJECTIVES_TEXTS } from './objectives.texts';

const useStyles = creerStyles(({ couleurs }) => ({
  textes: {
    gap: pas['pas-2'],
  },
  pied: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pas['pas-3'],
    paddingTop: pas['pas-4'],
    borderTopWidth: traits['trait-fin'],
    borderTopColor: couleurs.trame,
  },
  piedSeul: {
    justifyContent: 'flex-end',
  },
  prochainPas: {
    flexGrow: 1,
    flexBasis: 200,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
}));

/**
 * La carte d'un objectif en marche (maquette « Objectifs ») : son horizon, son nom, son pourquoi, sa
 * progression, et son prochain pas à cocher sur place. Un objectif pas encore enregistré ne s'ouvre pas : son
 * adresse n'existe pas encore.
 */
export function ObjectiveCardView({
  card,
  onToggleNextStep,
  onOpen,
}: {
  readonly card: ObjectiveCard;
  readonly onToggleNextStep: (taskId: string, done: boolean) => void;
  readonly onOpen: () => void;
}) {
  const styles = useStyles();
  const progress = cardProgress(card);
  const next = card.nextTask;

  return (
    <ECarte testID={`carte-${card.id}`}>
      <View style={styles.textes}>
        {card.horizon ? (
          <ETexte variante="detail" couleur="encre-douce">
            {card.horizon}
          </ETexte>
        ) : null}
        <ETexte variante="objectif" role="heading">
          {card.title}
        </ETexte>
        {card.why ? (
          <ETexte variante="voix" couleur="encre-douce">
            {quoted(card.why)}
          </ETexte>
        ) : null}
      </View>

      {progress.kind === 'cases' ? (
        <EPas
          faits={progress.done}
          enCours={progress.inProgress}
          aVenir={progress.upcoming}
          unite={progress.unit}
          {...(progress.currentName ? { nomEnCours: progress.currentName } : {})}
          {...(progress.legend ? { legende: progress.legend } : {})}
        />
      ) : (
        <ETexte variante="detail" couleur="encre-douce">
          {progress.kind === 'legend' ? progress.text : OBJECTIVES_TEXTS.noStageYet}
        </ETexte>
      )}

      <View style={[styles.pied, !next && styles.piedSeul]}>
        {next ? (
          // La clé suit le pas : quand le pas coché laisse place au suivant, la case est recréée, non cochée.
          <ETache
            key={next.id}
            titre={next.title}
            meta={OBJECTIVES_TEXTS.nextStep}
            fait={next.done}
            onFaitChange={(done) => onToggleNextStep(next.id, done)}
            style={styles.prochainPas}
            testID={`prochain-pas-${next.id}`}
          />
        ) : null}
        <EBouton
          petit
          disabled={isTemporaryId(card.id)}
          aria-label={OBJECTIVES_TEXTS.openLabel(card.title)}
          onPress={onOpen}
          testID={`ouvrir-${card.id}`}
        >
          {OBJECTIVES_TEXTS.open}
        </EBouton>
      </View>
    </ECarte>
  );
}
