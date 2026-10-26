import { useEffect, useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInstance } from 'react-native';
import Animated, { type CSSAnimationProperties } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COURBE_PLI,
  EBouton,
  EIcone,
  ETexte,
  FONDU,
  GardienSceau,
  creerStyles,
  ombreFeuille,
  useMouvementReduit,
  useTheme,
} from '@empreinte-studio/react-native';
import { poserLeLecteurSur } from './accessibilite';
import { avecOpacite, durees, pas } from './fondations';

/*
 * La feuille : ce qui se déplie au-dessus du reste (modifier un pas, ajouter une étape…), comme `e-feuille`
 * d'Empreinte sur le web. Sur un téléphone, elle se déplie depuis le bas de l'écran et prend sa largeur ; le
 * reste de l'écran se voile du fond à 72 %. Carrée, avec la seule ombre du système (`ombre-feuille`).
 *
 * En attendant la feuille de @empreinte-studio/react-native (annoncée avec les superpositions), Apex la compose
 * avec les fondations d'Empreinte : à remonter dans Empreinte quand elle existera.
 */

/** La feuille se déplie depuis son pli haut : elle monte en se dévoilant, sans surgir. */
const DEPLIER: CSSAnimationProperties = {
  animationName: {
    from: { opacity: 0, transform: [{ translateY: 32 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: durees['deplier-lent'],
  animationTimingFunction: COURBE_PLI,
  animationFillMode: 'both',
};

const VOILER: CSSAnimationProperties = {
  animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
  animationDuration: durees['deplier-vite'],
  animationTimingFunction: 'linear',
  animationFillMode: 'both',
};

const useStyles = creerStyles(({ couleurs }) => ({
  ecran: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fond: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: avecOpacite(couleurs.fond, 0.72),
  },
  panneau: {
    maxHeight: '92%',
    backgroundColor: couleurs.panneau,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: pas['pas-4'],
    paddingTop: pas['pas-8'],
    paddingHorizontal: pas['pas-6'],
  },
  titre: {
    flex: 1,
  },
  fermer: {
    marginTop: -pas['pas-2'],
    marginRight: -pas['pas-3'],
  },
  corps: {
    gap: pas['pas-4'],
    paddingHorizontal: pas['pas-6'],
    paddingTop: pas['pas-6'],
    paddingBottom: pas['pas-2'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: pas['pas-2'],
    paddingHorizontal: pas['pas-6'],
    paddingTop: pas['pas-4'],
  },
}));

export type ProprietesFeuille = {
  /** Le titre de la feuille : le lecteur d'écran s'y pose à l'ouverture. */
  readonly titre: string;
  readonly children?: ReactNode;
  /** L'action d'abord (« Ajouter »), la sortie douce ensuite (« Annuler »), en bouton nu. */
  readonly actions?: ReactNode;
  /** Fermer sans rien faire : le voile, la croix. */
  readonly onFermer: () => void;
  readonly testID?: string;
};

/** Une feuille posée sur un écran transparent (une route présentée en `transparentModal`). */
export function Feuille({ titre, children, actions, onFermer, testID }: ProprietesFeuille) {
  const styles = useStyles();
  const theme = useTheme();
  const reduit = useMouvementReduit();
  const marges = useSafeAreaInsets();
  const titreRef = useRef<TextInstance>(null);

  useEffect(() => {
    // Le lecteur d'écran se pose sur le titre, comme le focus sur le web.
    poserLeLecteurSur(titreRef.current);
  }, []);

  return (
    <GardienSceau>
      <KeyboardAvoidingView style={styles.ecran} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[styles.fond, reduit ? FONDU : VOILER]}>
          <Pressable
            style={styles.ecran}
            onPress={onFermer}
            accessible={false}
            importantForAccessibility="no"
          />
        </Animated.View>
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          aria-modal
          style={[styles.panneau, ombreFeuille(theme), reduit ? FONDU : DEPLIER]}
        >
          <View style={styles.entete}>
            <ETexte ref={titreRef} variante="objectif" role="heading" style={styles.titre}>
              {titre}
            </ETexte>
            <EBouton variante="nu" icone aria-label="Fermer" onPress={onFermer} style={styles.fermer}>
              <EIcone nom="fermer" />
            </EBouton>
          </View>
          <ScrollView
            contentContainerStyle={styles.corps}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={false}
          >
            {children}
          </ScrollView>
          {actions ? (
            <View style={[styles.actions, { paddingBottom: pas['pas-6'] + marges.bottom }]}>{actions}</View>
          ) : (
            <View style={{ height: pas['pas-6'] + marges.bottom }} />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </GardienSceau>
  );
}
