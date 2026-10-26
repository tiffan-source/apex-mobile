import { Pressable, ScrollView, Text } from 'react-native';
import { ETrame, creerStyles, margeTactile, police, useTheme } from '@empreinte-studio/react-native';
import { GOUTTIERE, cornes, pas, traits } from './fondations';

/*
 * Les filtres d'Empreinte (`e-filtres`) : une rangée de boutons à bascule, en trait, réduits. Le filtre actif
 * prend le contour d'encre en trait net et sa petite corne repliée. Sur un téléphone, la rangée défile de côté
 * plutôt que de passer à la ligne : elle garde la hauteur d'un seul filtre.
 */

export type OptionFiltre<V> = { readonly valeur: V; readonly libelle: string };

const HAUTEUR = 36;

const useStyles = creerStyles(() => ({
  filtres: {
    flexDirection: 'row',
    gap: pas['pas-2'],
  },
  bordPerdu: {
    marginHorizontal: -GOUTTIERE,
  },
  contenuBordPerdu: {
    paddingHorizontal: GOUTTIERE,
  },
  filtre: {
    minHeight: HAUTEUR,
    justifyContent: 'center',
    paddingVertical: pas['pas-2'],
    paddingHorizontal: pas['pas-4'],
  },
  libelle: {
    fontFamily: police('structure', 600),
    fontSize: 14,
    lineHeight: 20,
  },
}));

export type ProprietesFiltres<V> = {
  /** Le nom de la rangée, dit par les lecteurs d'écran : « Filtrer par objectif ». */
  readonly libelle: string;
  readonly options: readonly OptionFiltre<V>[];
  /** Le filtre actif, ou null pour « Tous ». */
  readonly selection: V | null;
  readonly onSelection: (valeur: V | null) => void;
  /** Le filtre qui montre tout ; null pour ne pas l'afficher. */
  readonly libelleTous?: string | null;
  /** La rangée défile d'un bord de l'écran à l'autre, au-delà de la gouttière. */
  readonly bordPerdu?: boolean;
  readonly testID?: string;
};

export function Filtres<V>({
  libelle,
  options,
  selection,
  onSelection,
  libelleTous = 'Tous',
  bordPerdu = false,
  testID,
}: ProprietesFiltres<V>) {
  const styles = useStyles();
  const { couleurs } = useTheme();

  const filtre = (cle: string, texte: string, actif: boolean, choisir: () => void) => (
    <Pressable
      key={cle}
      role="button"
      aria-label={texte}
      aria-selected={actif}
      onPress={choisir}
      hitSlop={margeTactile(Number.POSITIVE_INFINITY, HAUTEUR)}
      style={styles.filtre}
      testID={testID ? `${testID}-${cle}` : undefined}
    >
      {({ pressed }) => (
        <>
          <ETrame
            fond={pressed ? couleurs.creux : couleurs.panneau}
            contour={couleurs.encre}
            trait={actif ? traits['trait-net'] : traits['trait-fin']}
            corne={actif ? cornes['corne-s'] : null}
            rabat={actif ? couleurs.creux : null}
          />
          <Text
            style={[styles.libelle, { color: couleurs.encre }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.6}
          >
            {texte}
          </Text>
        </>
      )}
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      role="toolbar"
      aria-label={libelle}
      style={bordPerdu ? styles.bordPerdu : undefined}
      contentContainerStyle={[styles.filtres, bordPerdu && styles.contenuBordPerdu]}
    >
      {libelleTous !== null ? filtre('tous', libelleTous, selection === null, () => onSelection(null)) : null}
      {options.map((option) =>
        filtre(String(option.valeur), option.libelle, selection === option.valeur, () =>
          onSelection(option.valeur),
        ),
      )}
    </ScrollView>
  );
}
