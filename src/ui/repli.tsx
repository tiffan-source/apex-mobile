import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { type CSSAnimationProperties } from 'react-native-reanimated';
import {
  COURBE_PLI,
  EIcone,
  ETexte,
  FONDU,
  creerStyles,
  useMouvementReduit,
} from '@empreinte-studio/react-native';
import { durees, pas, traits } from './fondations';

/*
 * Un repli : un titre qui déplie ce qu'il cache, comme le bloc « Accomplis » du client web (un `details` entre
 * deux filets trame). Empreinte n'a pas encore de repli générique : à remonter quand il existera.
 */

const DEPLIER: CSSAnimationProperties = {
  animationName: {
    from: { opacity: 0, transform: [{ translateY: -8 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: durees.deplier,
  animationTimingFunction: COURBE_PLI,
  animationFillMode: 'both',
};

const useStyles = creerStyles(({ couleurs }) => ({
  repli: {
    borderTopWidth: traits['trait-fin'],
    borderBottomWidth: traits['trait-fin'],
    borderColor: couleurs.trame,
  },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-3'],
    minHeight: pas['pas-12'],
  },
  titre: {
    flexShrink: 1,
  },
  contenu: {
    paddingBottom: pas['pas-4'],
  },
}));

export type ProprietesRepli = {
  readonly titre: string;
  /** Ce qu'on lit à côté du titre : un compte, un résumé. */
  readonly detail?: string;
  /** Déplié au départ. */
  readonly ouvert?: boolean;
  readonly children?: ReactNode;
  readonly testID?: string;
};

export function Repli({ titre, detail, ouvert: ouvertAuDepart = false, children, testID }: ProprietesRepli) {
  const styles = useStyles();
  const reduit = useMouvementReduit();
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  return (
    <View style={styles.repli} testID={testID}>
      <Pressable
        role="button"
        aria-expanded={ouvert}
        aria-label={detail ? `${titre}, ${detail}` : titre}
        onPress={() => setOuvert((avant) => !avant)}
        style={styles.resume}
      >
        <EIcone nom={ouvert ? 'chevron-bas' : 'chevron-droite'} />
        <ETexte variante="section" style={styles.titre}>
          {titre}
        </ETexte>
        {detail ? (
          <ETexte variante="detail" couleur="encre-douce" style={styles.titre}>
            {detail}
          </ETexte>
        ) : null}
      </Pressable>
      {ouvert ? (
        <Animated.View style={[styles.contenu, reduit ? FONDU : DEPLIER]}>{children}</Animated.View>
      ) : null}
    </View>
  );
}
