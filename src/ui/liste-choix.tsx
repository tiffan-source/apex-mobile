import { Pressable, View } from 'react-native';
import {
  CIBLE_TACTILE,
  EIcone,
  ESeparateur,
  ETexte,
  ETrame,
  creerStyles,
  police,
  useTheme,
} from '@empreinte-studio/react-native';
import { pas } from './fondations';

/*
 * Un choix parmi quelques options, posé dans la page (le thème, dans les réglages) : les options d'une liste
 * d'Empreinte (`e-option`) sur un panneau, l'option retenue avec sa coche en deux traits droits et son libellé
 * en semi-gras.
 */

export type OptionChoix<V> = { readonly valeur: V; readonly libelle: string };

const useStyles = creerStyles(({ couleurs }) => ({
  option: {
    minHeight: CIBLE_TACTILE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: pas['pas-2'],
    paddingLeft: pas['pas-12'],
    paddingRight: pas['pas-4'],
  },
  presse: {
    backgroundColor: couleurs.creux,
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
}));

export type ProprietesListeChoix<V> = {
  /** Le nom du choix, dit par les lecteurs d'écran : « Thème ». */
  readonly libelle: string;
  readonly options: readonly OptionChoix<V>[];
  readonly valeur: V;
  readonly onChoix: (valeur: V) => void;
  readonly testID?: string;
};

export function ListeChoix<V>({ libelle, options, valeur, onChoix, testID }: ProprietesListeChoix<V>) {
  const styles = useStyles();
  const { couleurs } = useTheme();
  return (
    <View role="radiogroup" aria-label={libelle}>
      <ETrame fond={couleurs.panneau} contour={couleurs.trame} />
      {options.map((option, index) => {
        const choisie = option.valeur === valeur;
        return (
          <View key={String(option.valeur)}>
            {index > 0 ? <ESeparateur /> : null}
            <Pressable
              role="radio"
              aria-checked={choisie}
              aria-label={option.libelle}
              onPress={() => {
                if (!choisie) onChoix(option.valeur);
              }}
              style={({ pressed }) => [styles.option, pressed && styles.presse]}
              testID={testID ? `${testID}-${String(option.valeur)}` : undefined}
            >
              {choisie ? <EIcone nom="coche" taille={20} style={styles.coche} /> : null}
              <ETexte style={[styles.libelle, choisie && styles.libelleChoisi]}>{option.libelle}</ETexte>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
