import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated, { type CSSAnimationProperties } from 'react-native-reanimated';
import {
  COURBE_PLI,
  EBouton,
  ETexte,
  FONDU,
  creerStyles,
  useMouvementReduit,
} from '@empreinte-studio/react-native';
import { durees, pas } from './fondations';

/*
 * Le fil d'une conversation avec Akari, comme `e-fil` et `e-replique` d'Empreinte : des répliques posées dans la
 * page, sans bulle ni cadre. Sur un téléphone, le fil est étroit : le nom passe au-dessus de la phrase (comme le
 * web sous 480px). Akari signe de son losange et parle en « voix » ; la personne signe de son prénom et parle en
 * « corps ». Une réplique qui part encore s'écrit en encre douce. Deux actions au plus sous une phrase : la
 * première en trait, la suivante nue. La ligne d'état (« Akari réfléchit… ») suit la dernière réplique.
 */

export type ActionReplique = { readonly id: string; readonly libelle: string };

export type RepliqueFil = {
  readonly id: string;
  readonly auteur: 'personne' | 'assistant';
  /** Le texte, ou un contenu déjà rendu (la prose d'un message, un champ). */
  readonly contenu: ReactNode;
  /** Pas encore enregistrée. */
  readonly enAttente?: boolean;
  readonly actions?: readonly ActionReplique[];
};

/** La réponse d'Akari se déplie depuis son pli haut ; les répliques déjà là à l'ouverture restent immobiles. */
const DEPLIER: CSSAnimationProperties = {
  animationName: {
    from: { opacity: 0, transform: [{ translateY: -8 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: durees.deplier,
  animationTimingFunction: COURBE_PLI,
  animationFillMode: 'both',
};

const LOSANGE = 7;

const useStyles = creerStyles(({ couleurs }) => ({
  fil: {
    gap: pas['pas-6'] + pas['pas-1'],
  },
  replique: {
    gap: pas['pas-1'],
  },
  qui: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-2'],
  },
  losange: {
    width: LOSANGE,
    height: LOSANGE,
    transform: [{ rotate: '45deg' }],
    backgroundColor: couleurs.encre,
  },
  sansLosange: {
    width: LOSANGE,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: pas['pas-2'],
    marginTop: pas['pas-2'],
  },
  statut: {
    marginTop: -pas['pas-2'],
  },
}));

function Replique({
  replique,
  qui,
  animer,
  onAction,
}: {
  readonly replique: RepliqueFil;
  readonly qui: string;
  readonly animer: boolean;
  readonly onAction?: (replique: RepliqueFil, action: ActionReplique) => void;
}) {
  const styles = useStyles();
  const reduit = useMouvementReduit();
  // Décidé à l'arrivée de la réplique, une fois : un nouveau rendu ne la rejoue pas.
  const [animation] = useState(() =>
    animer && replique.auteur === 'assistant' ? (reduit ? FONDU : DEPLIER) : null,
  );
  const assistant = replique.auteur === 'assistant';
  const contenu =
    typeof replique.contenu === 'string' ? (
      <ETexte
        variante={assistant ? 'voix' : 'corps'}
        couleur={replique.enAttente ? 'encre-douce' : 'encre'}
        selectable
      >
        {replique.contenu}
      </ETexte>
    ) : (
      replique.contenu
    );

  return (
    <Animated.View role="listitem" style={[styles.replique, animation]}>
      <View style={styles.qui}>
        <View style={assistant ? styles.losange : styles.sansLosange} aria-hidden />
        <ETexte variante="repere" couleur="encre-douce">
          {qui}
        </ETexte>
      </View>
      {contenu}
      {replique.actions && replique.actions.length > 0 ? (
        <View style={styles.actions}>
          {replique.actions.slice(0, 2).map((action, index) => (
            <EBouton
              key={action.id}
              variante={index === 0 ? 'trait' : 'nu'}
              petit
              onPress={() => onAction?.(replique, action)}
            >
              {action.libelle}
            </EBouton>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

export type ProprietesFil = {
  readonly repliques: readonly RepliqueFil[];
  /** Ce que fait Akari (« Akari réfléchit… »), dit aux lecteurs d'écran. Vide quand il écoute. */
  readonly statut?: string;
  /** Le nom qui signe les répliques d'Akari. */
  readonly assistant?: string;
  /** Le prénom qui signe celles de la personne. */
  readonly personne?: string;
  readonly onAction?: (replique: RepliqueFil, action: ActionReplique) => void;
  readonly testID?: string;
};

export function Fil({
  repliques,
  statut = '',
  assistant = 'Akari',
  personne = 'Toi',
  onAction,
  testID,
}: ProprietesFil) {
  const styles = useStyles();

  // Les répliques affichées à l'ouverture restent immobiles ; celles qui arrivent ensuite se déplient.
  const [ouverture, setOuverture] = useState<ReadonlySet<string> | null>(null);
  if (ouverture === null && repliques.length > 0)
    setOuverture(new Set(repliques.map((replique) => replique.id)));

  // iOS n'a pas de région vivante : la ligne d'état est annoncée quand elle change (Android la lit seul).
  useEffect(() => {
    if (Platform.OS === 'ios' && statut) {
      AccessibilityInfo.announceForAccessibilityWithOptions(statut, { queue: true });
    }
  }, [statut]);

  return (
    <View style={styles.fil} testID={testID}>
      <View role="list" aria-label={`Conversation avec ${assistant}`} style={styles.fil}>
        {repliques.map((replique) => (
          <Replique
            key={replique.id}
            replique={replique}
            qui={replique.auteur === 'assistant' ? assistant : personne}
            animer={ouverture !== null && !ouverture.has(replique.id)}
            {...(onAction ? { onAction } : {})}
          />
        ))}
      </View>
      {statut ? (
        <ETexte
          variante="detail"
          couleur="encre-douce"
          role="status"
          accessibilityLiveRegion="polite"
          style={styles.statut}
        >
          {statut}
        </ETexte>
      ) : null}
    </View>
  );
}
