import { useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type HostInstance,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EBouton, EIcone, GardienSceau, creerStyles, useTheme } from '@empreinte-studio/react-native';
import { GOUTTIERE, LARGEUR_MAX, pas } from './fondations';

/*
 * L'écran d'Apex : le fond, les marges du téléphone (zones sûres, gouttière de 16), le défilement, le
 * rafraîchissement par glissement, le clavier, et son propre gardien du sceau (dans une pile de navigation,
 * les écrans précédents restent montés : chacun compte ses sceaux).
 */

/** À cette distance du bas, on considère que la personne lit la fin (une conversation la suit alors). */
const PRES_DE_LA_FIN = 96;

export type ProprietesEcran = {
  readonly children?: ReactNode;
  /** Le bandeau d'un écran à onglets (la marque, les réglages), posé tout en haut, bord à bord. */
  readonly bandeau?: ReactNode;
  /** La note d'Akari qui signale un souci, posée en haut du contenu. */
  readonly note?: ReactNode;
  /** Ce qui reste au pied, au-dessus du clavier (la zone de réponse d'Akari). */
  readonly pied?: ReactNode;
  /** Tirer pour rafraîchir. */
  readonly rafraichir?: { readonly enCours: boolean; readonly onRafraichir: () => void };
  /** Sous une barre d'onglets : la barre prend déjà la zone sûre du bas. */
  readonly sousOnglets?: boolean;
  /**
   * L'écran suit sa fin, comme une conversation : il s'ouvre sur ses derniers éléments, y reste quand du contenu
   * arrive, et propose d'y revenir quand la personne relit plus haut.
   */
  readonly suivreLaFin?: boolean;
  /** Le libellé du bouton qui ramène à la fin. */
  readonly libelleRetourFin?: string;
  /** Le contenu se pose au milieu de l'écran quand il est court (la connexion). */
  readonly centre?: boolean;
  /** Pour faire défiler l'écran depuis l'extérieur (jusqu'à un panneau, par exemple). */
  readonly defilement?: RefObject<ScrollViewInstance | null>;
  readonly testID?: string;
};

const useStyles = creerStyles(({ couleurs }) => ({
  ecran: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  colonne: {
    flex: 1,
    width: '100%',
    maxWidth: LARGEUR_MAX,
    alignSelf: 'center',
  },
  cadre: {
    flex: 1,
  },
  centre: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  contenu: {
    gap: pas['pas-8'],
    paddingHorizontal: GOUTTIERE,
    paddingTop: pas['pas-6'],
  },
  retourFin: {
    position: 'absolute',
    pointerEvents: 'box-none',
    left: 0,
    right: 0,
    bottom: pas['pas-4'],
    alignItems: 'center',
  },
}));

export function Ecran({
  children,
  bandeau,
  note,
  pied,
  rafraichir,
  sousOnglets = false,
  suivreLaFin = false,
  libelleRetourFin = 'Dernières répliques',
  centre = false,
  defilement,
  testID,
}: ProprietesEcran) {
  const styles = useStyles();
  const { couleurs } = useTheme();
  const marges = useSafeAreaInsets();
  const basContenu = pas['pas-8'] + (sousOnglets || pied ? 0 : marges.bottom);

  const interne = useRef<ScrollViewInstance | null>(null);
  const vue = defilement ?? interne;

  // La fin suivie : on y va à l'ouverture, puis chaque fois que le contenu grandit pendant qu'on la lit.
  const presDeLaFin = useRef(true);
  const premiereFois = useRef(true);
  const [relit, setRelit] = useState(false);

  const allerALaFin = (anime: boolean) => {
    vue.current?.scrollToEnd({ animated: anime });
    presDeLaFin.current = true;
    setRelit(false);
  };

  const auDefilement = (evenement: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = evenement.nativeEvent;
    const proche = contentOffset.y + layoutMeasurement.height >= contentSize.height - PRES_DE_LA_FIN;
    presDeLaFin.current = proche;
    setRelit(!proche);
  };

  const contenuChange = () => {
    if (!presDeLaFin.current) return;
    allerALaFin(!premiereFois.current);
    premiereFois.current = false;
  };

  // Le clavier s'ouvre et l'écran rétrécit : la fin, si on la lisait, reste visible.
  const cadreChange = () => {
    if (presDeLaFin.current && !premiereFois.current) allerALaFin(false);
  };

  return (
    <View style={styles.ecran} testID={testID}>
      <GardienSceau>
        <KeyboardAvoidingView
          style={styles.ecran}
          // iOS décale le défilement au-dessus du clavier ; avec un pied (la zone de réponse), c'est l'écran
          // entier qui remonte. Android, bord à bord, rétrécit l'écran.
          behavior={Platform.OS === 'ios' ? (pied ? 'padding' : undefined) : 'height'}
        >
          <View style={[styles.colonne, { paddingTop: marges.top }]}>
            <View style={styles.cadre}>
              <ScrollView
                ref={vue}
                contentContainerStyle={[{ paddingBottom: basContenu }, centre && styles.centre]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets={!pied}
                {...(suivreLaFin
                  ? {
                      onScroll: auDefilement,
                      scrollEventThrottle: 64,
                      onContentSizeChange: contenuChange,
                      onLayout: cadreChange,
                    }
                  : {})}
                refreshControl={
                  rafraichir ? (
                    <RefreshControl
                      refreshing={rafraichir.enCours}
                      onRefresh={rafraichir.onRafraichir}
                      tintColor={couleurs.encre}
                      colors={[couleurs.encre]}
                      progressBackgroundColor={couleurs.panneau}
                    />
                  ) : undefined
                }
              >
                {bandeau}
                <View style={styles.contenu}>
                  {note}
                  {children}
                </View>
              </ScrollView>
              {suivreLaFin && relit ? (
                <View style={styles.retourFin}>
                  <EBouton petit onPress={() => allerALaFin(true)}>
                    <EIcone nom="chevron-bas" taille={18} />
                    {libelleRetourFin}
                  </EBouton>
                </View>
              ) : null}
            </View>
            {pied ? <View style={{ paddingBottom: sousOnglets ? 0 : marges.bottom }}>{pied}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </GardienSceau>
    </View>
  );
}

/**
 * Fait défiler l'écran jusqu'à un élément qui n'est pas en vue (le panneau de l'étape qu'on vient de choisir
 * sur l'arête). Rien ne bouge s'il est déjà à l'écran.
 */
export function amenerALEcran(
  defilement: RefObject<ScrollViewInstance | null>,
  cible: RefObject<HostInstance | null>,
  marge: number = pas['pas-4'],
): void {
  const vue = defilement.current;
  const element = cible.current;
  const contenu = vue?.getInnerViewRef();
  if (!vue || !element || !contenu) return;
  element.measureInWindow((_x, y, _largeur, hauteur) => {
    const ecran = Dimensions.get('window').height;
    const enVue = y >= 0 && y + Math.min(hauteur, ecran / 3) <= ecran;
    if (enVue) return;
    element.measureLayout(contenu, (_gauche, haut) =>
      vue.scrollTo({ y: Math.max(0, haut - marge), animated: true }),
    );
  });
}
