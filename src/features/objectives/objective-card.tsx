import { EBouton, ECarteObjectif, ETexte } from '@empreinte-studio/react-native';
import { cardProgress, type ObjectiveCard } from '@/domain/objectives/objective-card';
import { isTemporaryId } from '@/domain/objectives/snapshot';
import { OBJECTIVES_TEXTS } from './objectives.texts';

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
  const progress = cardProgress(card);

  return (
    <ECarteObjectif
      testID={`carte-${card.id}`}
      titre={card.title}
      horizon={card.horizon}
      pourquoi={card.why}
      filet
      {...(progress.kind === 'cases'
        ? {
            faits: progress.done,
            aFaire: progress.toDo,
            unite: progress.unit,
            ...(progress.legend ? { legende: progress.legend } : {}),
          }
        : {
            progression: (
              <ETexte variante="detail" couleur="encre-douce">
                {progress.kind === 'legend' ? progress.text : OBJECTIVES_TEXTS.noStageYet}
              </ETexte>
            ),
          })}
      action={
        <EBouton
          petit
          disabled={isTemporaryId(card.id)}
          aria-label={OBJECTIVES_TEXTS.openLabel(card.title)}
          onPress={onOpen}
          testID={`ouvrir-${card.id}`}
        >
          {OBJECTIVES_TEXTS.open}
        </EBouton>
      }
    />
  );
}
