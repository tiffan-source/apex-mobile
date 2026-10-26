import { useEffect, useState, type ReactNode, type Ref } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type HostInstance,
  type PressableInstance,
  type Role,
} from 'react-native';
import Animated, { type CSSAnimationProperties } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CIBLE_TACTILE,
  COURBE_PLI,
  EIcone,
  ETexte,
  ETrame,
  FONDU,
  creerStyles,
  ombreFeuille,
  police,
  useMouvementReduit,
  useTheme,
  type NomIcone,
} from '@empreinte-studio/react-native';
import { durees, pas, traits } from './fondations';

/*
 * Ce qui se déplie au-dessus du reste depuis un bouton : la liste d'un menu ou d'une sélection (`e-menu`,
 * `e-liste-options` d'Empreinte). Une feuille étroite, carrée, posée par son pli haut sous le bouton (au-dessus
 * s'il n'y a pas la place), avec l'ombre « ombre-feuille ». Un menu prend la largeur de ses entrées (de 200 à
 * 360 points, comme `e-menu`) ; une sélection, celle de son champ. Toucher ailleurs, ou le geste de retour
 * d'Android, la referme.
 *
 * En attendant les superpositions de @empreinte-studio/react-native : à remonter dans Empreinte.
 */

/** Où se trouve le bouton qui déplie la liste, dans la fenêtre. */
export type Ancre = {
  readonly x: number;
  readonly y: number;
  readonly largeur: number;
  readonly hauteur: number;
};

/** La place du bouton dans la fenêtre, pour y poser la liste. */
export function mesurerAncre(element: HostInstance | null): Promise<Ancre | null> {
  return new Promise((resoudre) => {
    if (!element) {
      resoudre(null);
      return;
    }
    element.measureInWindow((x, y, largeur, hauteur) => resoudre({ x, y, largeur, hauteur }));
  });
}

const ECART = pas['pas-1'];
const MARGE_ECRAN = pas['pas-4'];
const LARGEUR_MIN = 200;
const LARGEUR_MAX = 360;
const HAUTEUR_MAX = 360;

const DEPLIER: CSSAnimationProperties = {
  animationName: {
    from: { opacity: 0, transform: [{ translateY: -6 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: durees.deplier,
  animationTimingFunction: COURBE_PLI,
  animationFillMode: 'both',
};

const useStyles = creerStyles(({ couleurs }) => ({
  panneau: {
    position: 'absolute',
    paddingVertical: pas['pas-1'],
  },
  element: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-3'],
    minHeight: CIBLE_TACTILE,
    paddingVertical: pas['pas-2'],
    paddingHorizontal: pas['pas-4'],
  },
  elementPresse: {
    backgroundColor: couleurs.creux,
  },
  option: {
    paddingLeft: pas['pas-12'],
  },
  coche: {
    position: 'absolute',
    left: 14,
  },
  libelle: {
    flexShrink: 1,
    fontFamily: police('structure', 400),
    fontSize: 15,
    lineHeight: 20,
  },
  libelleChoisi: {
    fontFamily: police('structure', 600),
  },
  separateur: {
    height: traits['trait-fin'],
    marginVertical: pas['pas-1'],
    backgroundColor: couleurs.trame,
  },
}));

export type ProprietesDeroulant = {
  /** Où poser la liste ; null : elle est repliée. */
  readonly ancre: Ancre | null;
  readonly onFermer: () => void;
  /** `menu` pour des actions, `radiogroup` pour une valeur à choisir. */
  readonly role: Extract<Role, 'menu' | 'radiogroup'>;
  readonly libelle: string;
  /** La largeur du bouton (une sélection), ou celle de ses entrées (un menu, de 200 à 360 points). */
  readonly largeur?: 'ancre' | 'menu';
  /** La liste s'aligne sur le début du bouton (une sélection) ou sur sa fin (un menu au bout d'une ligne). */
  readonly alignement?: 'debut' | 'fin';
  /** La liste est posée : le lecteur d'écran peut se poser sur son premier élément. */
  readonly onPret?: () => void;
  readonly children?: ReactNode;
};

export function Deroulant({
  ancre,
  onFermer,
  role,
  libelle,
  largeur = 'menu',
  alignement = 'fin',
  onPret,
  children,
}: ProprietesDeroulant) {
  const styles = useStyles();
  const theme = useTheme();
  const reduit = useMouvementReduit();
  const ecran = useWindowDimensions();
  const marges = useSafeAreaInsets();
  const [taille, setTaille] = useState<{ largeur: number; hauteur: number } | null>(null);

  // Chaque ouverture mesure la liste avant de la montrer : elle se pose sans sauter.
  const [ancreVue, setAncreVue] = useState(ancre);
  if (ancre !== ancreVue) {
    setAncreVue(ancre);
    setTaille(null);
  }

  const pret = ancre !== null && taille !== null;
  useEffect(() => {
    if (pret) onPret?.();
    // onPret n'est appelé qu'une fois par ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);

  if (!ancre) return null;

  const largeurEcran = ecran.width - 2 * MARGE_ECRAN;
  const largeurMax = largeur === 'ancre' ? largeurEcran : Math.min(LARGEUR_MAX, largeurEcran);
  const largeurMin = Math.min(LARGEUR_MIN, largeurMax);
  const largeurPosee = Math.min(
    Math.max(largeur === 'ancre' ? ancre.largeur : (taille?.largeur ?? largeurMin), largeurMin),
    largeurMax,
  );
  const departX = alignement === 'fin' ? ancre.x + ancre.largeur - largeurPosee : ancre.x;
  const gauche = Math.min(Math.max(departX, MARGE_ECRAN), ecran.width - MARGE_ECRAN - largeurPosee);

  const haut = marges.top + MARGE_ECRAN;
  const bas = ecran.height - marges.bottom - MARGE_ECRAN;
  const sousLeBouton = ancre.y + ancre.hauteur + ECART;
  const espaceDessous = bas - sousLeBouton;
  const espaceDessus = ancre.y - ECART - haut;
  const voulue = taille?.hauteur ?? 0;
  const dessous = voulue <= espaceDessous || espaceDessous >= espaceDessus;
  const hauteurMax = Math.min(HAUTEUR_MAX, Math.max(dessous ? espaceDessous : espaceDessus, CIBLE_TACTILE));
  const posee = Math.min(voulue, hauteurMax);
  const top = dessous ? sousLeBouton : ancre.y - ECART - posee;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onFermer}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onFermer}
        accessible={false}
        importantForAccessibility="no"
      />
      <Animated.View
        role={role}
        aria-label={libelle}
        accessibilityViewIsModal
        onLayout={(evenement) => {
          const { width, height } = evenement.nativeEvent.layout;
          if (taille === null) setTaille({ largeur: width, hauteur: height });
        }}
        style={[
          styles.panneau,
          ombreFeuille(theme),
          pret
            ? { top, left: gauche, width: largeurPosee, maxHeight: hauteurMax }
            : // La première mesure, invisible : un menu y prend la largeur de ses entrées, et la liste sa
              // hauteur sans autre limite que la sienne. Sa place en dépend.
              {
                top: haut,
                left: MARGE_ECRAN,
                ...(largeur === 'ancre'
                  ? { width: largeurPosee }
                  : { minWidth: largeurMin, maxWidth: largeurMax }),
                maxHeight: HAUTEUR_MAX,
                opacity: 0,
              },
          pret && (reduit ? FONDU : DEPLIER),
        ]}
      >
        <ETrame fond={theme.couleurs.panneau} contour={theme.couleurs.trame} />
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export type ProprietesElementDeroulant = {
  readonly libelle: string;
  readonly onPress: () => void;
  /** `menuitem` dans un menu, `radio` dans une sélection. */
  readonly role: Extract<Role, 'menuitem' | 'radio'>;
  readonly icone?: NomIcone;
  /** Une sortie douce (« Plus tard ») parle plus bas. */
  readonly doux?: boolean;
  /** L'option choisie d'une sélection : sa coche et son libellé en semi-gras. */
  readonly choisi?: boolean;
  readonly ref?: Ref<PressableInstance>;
  readonly testID?: string;
};

/** Un élément de la liste : 44 points au moins, il s'enfonce au creux sous le doigt. */
export function ElementDeroulant({
  libelle,
  onPress,
  role,
  icone,
  doux = false,
  choisi,
  ref,
  testID,
}: ProprietesElementDeroulant) {
  const styles = useStyles();
  const option = choisi !== undefined;
  return (
    <Pressable
      ref={ref}
      role={role}
      aria-checked={option ? choisi : undefined}
      aria-label={libelle}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.element, option && styles.option, pressed && styles.elementPresse]}
    >
      {option && choisi ? <EIcone nom="coche" taille={20} style={styles.coche} /> : null}
      {icone ? <EIcone nom={icone} taille={20} /> : null}
      <ETexte
        couleur={doux ? 'encre-douce' : 'encre'}
        style={[styles.libelle, choisi && styles.libelleChoisi]}
        maxFontSizeMultiplier={1.6}
      >
        {libelle}
      </ETexte>
    </Pressable>
  );
}

/** Le filet entre deux groupes d'éléments. */
export function SeparateurDeroulant() {
  const styles = useStyles();
  return <View style={styles.separateur} aria-hidden />;
}
