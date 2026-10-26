import { useRef, useState } from 'react';
import { Pressable, View, type PressableInstance } from 'react-native';
import { EIcone, ETexte, ETrame, creerStyles, police, useTheme } from '@empreinte-studio/react-native';
import { pas, traits } from './fondations';
import { poserLeLecteurSur } from './accessibilite';
import { Deroulant, ElementDeroulant, mesurerAncre, type Ancre } from './deroulant';

/*
 * La sélection d'Empreinte (`e-selection`) : un champ qui déplie une liste d'options. Même creux, même contour
 * que la saisie ; l'option choisie porte la coche en deux traits droits. À poser dans un `EChamp`, qui écrit le
 * libellé, l'aide et le message.
 */

export type OptionSelection<V> = { readonly valeur: V; readonly libelle: string };

const HAUTEUR = 44;

const useStyles = creerStyles(() => ({
  champ: {
    minHeight: HAUTEUR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pas['pas-2'],
    paddingVertical: 10,
    paddingLeft: pas['pas-4'],
    paddingRight: pas['pas-3'],
  },
  valeur: {
    flexShrink: 1,
    fontFamily: police('structure', 400),
    fontSize: 16,
    lineHeight: 24,
  },
}));

export type ProprietesSelection<V> = {
  /** Le libellé du champ qui l'entoure : le nom de la sélection pour les lecteurs d'écran. */
  readonly libelle: string;
  readonly options: readonly OptionSelection<V>[];
  readonly valeur: V | null;
  readonly onChange: (valeur: V) => void;
  /** Ce qu'on lit tant que rien n'est choisi : « Choisis une étape ». */
  readonly texteVide?: string;
  /** Le champ dit ce qui manque : le contour passe en trait net. */
  readonly invalide?: boolean;
  readonly desactivee?: boolean;
  readonly testID?: string;
};

export function Selection<V>({
  libelle,
  options,
  valeur,
  onChange,
  texteVide = 'Choisis',
  invalide = false,
  desactivee = false,
  testID,
}: ProprietesSelection<V>) {
  const styles = useStyles();
  const { couleurs } = useTheme();
  const champ = useRef<PressableInstance>(null);
  const choisie = useRef<PressableInstance>(null);
  const [ancre, setAncre] = useState<Ancre | null>(null);
  const option = options.find((candidate) => candidate.valeur === valeur);
  const ouverte = ancre !== null;

  const ouvrir = async () => setAncre(await mesurerAncre(champ.current));
  const fermer = () => setAncre(null);

  return (
    <>
      <Pressable
        ref={champ}
        role="button"
        aria-label={`${libelle} : ${option?.libelle ?? texteVide}`}
        aria-expanded={ouverte}
        aria-disabled={desactivee}
        accessibilityHint="Ouvre la liste des choix."
        disabled={desactivee}
        onPress={() => void ouvrir()}
        testID={testID}
        style={styles.champ}
      >
        {({ pressed }) => (
          <>
            <ETrame
              fond={desactivee ? couleurs.fond : couleurs.creux}
              contour={
                desactivee
                  ? couleurs.trame
                  : ouverte || invalide || pressed
                    ? couleurs.encre
                    : couleurs['trame-forte']
              }
              trait={ouverte || invalide ? traits['trait-net'] : traits['trait-fin']}
            />
            <ETexte
              couleur={option && !desactivee ? 'encre' : 'encre-douce'}
              numberOfLines={1}
              style={styles.valeur}
              maxFontSizeMultiplier={1.6}
            >
              {option?.libelle ?? texteVide}
            </ETexte>
            <View style={{ transform: [{ rotate: ouverte ? '180deg' : '0deg' }] }}>
              <EIcone nom="chevron-bas" />
            </View>
          </>
        )}
      </Pressable>
      <Deroulant
        ancre={ancre}
        onFermer={fermer}
        role="radiogroup"
        libelle={libelle}
        largeur="ancre"
        alignement="debut"
        onPret={() => {
          poserLeLecteurSur(choisie.current);
        }}
      >
        {options.map((candidate, index) => {
          const estChoisie = candidate.valeur === valeur;
          return (
            <ElementDeroulant
              key={String(candidate.valeur)}
              ref={estChoisie || (option === undefined && index === 0) ? choisie : undefined}
              role="radio"
              libelle={candidate.libelle}
              choisi={estChoisie}
              onPress={() => {
                fermer();
                if (!estChoisie) onChange(candidate.valeur);
              }}
              {...(testID ? { testID: `${testID}-${String(candidate.valeur)}` } : {})}
            />
          );
        })}
      </Deroulant>
    </>
  );
}
