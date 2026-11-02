import { View } from 'react-native';
import { EBouton, ECarte, EPas, ETexte, creerStyles } from '@empreinte-studio/react-native';
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
    justifyContent: 'flex-end',
    paddingTop: pas['pas-4'],
    borderTopWidth: traits['trait-fin'],
    borderTopColor: couleurs.trame,
  },
}));

/**
 * La carte d'un objectif en marche (maquette « Objectifs ») : son horizon, son nom, son pourquoi et sa
 * progression. Un objectif pas encore enregistré ne s'ouvre pas : son adresse n'existe pas encore.
 */
export function ObjectiveCardView({
  card,
  onOpen,
}: {
  readonly card: ObjectiveCard;
  readonly onOpen: () => void;
}) {
  const styles = useStyles();
  const progress = cardProgress(card);

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
          aFaire={progress.toDo}
          unite={progress.unit}
          {...(progress.legend ? { legende: progress.legend } : {})}
        />
      ) : (
        <ETexte variante="detail" couleur="encre-douce">
          {progress.kind === 'legend' ? progress.text : OBJECTIVES_TEXTS.noStageYet}
        </ETexte>
      )}

      <View style={styles.pied}>
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
