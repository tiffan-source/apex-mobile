import { Pressable, View } from 'react-native';
import { AXES_MATRICE } from '@empreinte-studio/noyau';
import { ETexte, ETrame, creerStyles, useTheme } from '@empreinte-studio/react-native';
import { cornes, pas, traits } from './fondations';

/*
 * La matrice d'Eisenhower d'Empreinte (`e-matrice`), dessinée comme un shoji, en vue d'ensemble pour un
 * téléphone : quatre panneaux lumineux dans une trame d'encre, avec leurs axes (urgent, pas urgent ; important,
 * secondaire). Chaque panneau dit son nom et ce qu'il contient ; le panneau ouvert porte la corne et ses pas se
 * lisent dessous. Jamais de rouge, d'orange ni de vert : les quadrants se distinguent par leur nom.
 */

export type TuileQuadrant<Q extends string> = {
  readonly cle: Q;
  readonly titre: string;
  /** « 3 pas ». */
  readonly compte: string;
  /** Ce que demandent ses axes, pour les lecteurs d'écran : « Important · urgent ». */
  readonly description: string;
};

const LARGEUR_AXE = 20;
/**
 * La hauteur d'un panneau : moins que les 128 pixels de `e-quadrant` (la matrice tient au-dessus de sa liste),
 * assez pour que les repères tournés de deux rangées (« Important », « Secondaire ») ne se touchent pas.
 */
const HAUTEUR_TUILE = 112;

const useStyles = creerStyles(({ couleurs }) => ({
  matrice: {
    gap: pas['pas-2'],
  },
  axesHaut: {
    flexDirection: 'row',
    paddingLeft: LARGEUR_AXE + pas['pas-2'],
  },
  axeHaut: {
    flex: 1,
    alignItems: 'center',
  },
  corps: {
    flexDirection: 'row',
    gap: pas['pas-2'],
  },
  axesGauche: {
    width: LARGEUR_AXE,
  },
  axeGauche: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  // Le repère tourné d'un quart de tour : posé dans une boîte assez large pour lui, qui tourne avec lui.
  boiteAxeGauche: {
    width: 120,
    alignItems: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  texteAxeGauche: {
    textAlign: 'center',
  },
  grille: {
    flex: 1,
    gap: traits['trait-fin'],
    padding: traits['trait-fin'],
    backgroundColor: couleurs.encre,
  },
  rangee: {
    flexDirection: 'row',
    gap: traits['trait-fin'],
  },
  tuile: {
    flex: 1,
    minHeight: HAUTEUR_TUILE,
    gap: pas['pas-1'],
    paddingTop: pas['pas-3'],
    paddingBottom: pas['pas-4'],
    paddingLeft: pas['pas-3'],
    paddingRight: pas['pas-6'],
  },
}));

export type ProprietesQuadrants<Q extends string> = {
  /** Les quatre quadrants, dans l'ordre d'Empreinte : maintenant, planifier, confier, laisser filer. */
  readonly tuiles: readonly [TuileQuadrant<Q>, TuileQuadrant<Q>, TuileQuadrant<Q>, TuileQuadrant<Q>];
  readonly choisi: Q;
  readonly onChoisir: (quadrant: Q) => void;
  readonly testID?: string;
};

export function Quadrants<Q extends string>({ tuiles, choisi, onChoisir, testID }: ProprietesQuadrants<Q>) {
  const styles = useStyles();
  const { couleurs } = useTheme();

  const tuile = (quadrant: TuileQuadrant<Q>) => {
    const ouvert = quadrant.cle === choisi;
    return (
      <Pressable
        key={quadrant.cle}
        role="tab"
        aria-selected={ouvert}
        aria-label={`${quadrant.titre}, ${quadrant.description}, ${quadrant.compte}`}
        onPress={() => onChoisir(quadrant.cle)}
        style={styles.tuile}
        testID={testID ? `${testID}-${quadrant.cle}` : undefined}
      >
        {({ pressed }) => (
          <>
            <ETrame
              fond={pressed && !ouvert ? couleurs.creux : couleurs.panneau}
              corne={ouvert ? cornes['corne-m'] : null}
              rabat={ouvert ? couleurs.creux : null}
            />
            <ETexte variante="section" numberOfLines={2}>
              {quadrant.titre}
            </ETexte>
            <ETexte variante="detail" couleur="encre-douce">
              {quadrant.compte}
            </ETexte>
          </>
        )}
      </Pressable>
    );
  };

  const [maintenant, planifier, confier, laisserFiler] = tuiles;
  return (
    <View style={styles.matrice} testID={testID}>
      <View style={styles.axesHaut} aria-hidden>
        <View style={styles.axeHaut}>
          <ETexte variante="repere" couleur="encre-douce">
            {AXES_MATRICE.urgent}
          </ETexte>
        </View>
        <View style={styles.axeHaut}>
          <ETexte variante="repere" couleur="encre-douce">
            {AXES_MATRICE.pasUrgent}
          </ETexte>
        </View>
      </View>
      <View style={styles.corps}>
        <View style={styles.axesGauche} aria-hidden>
          <View style={styles.axeGauche}>
            <View style={styles.boiteAxeGauche}>
              <ETexte variante="repere" couleur="encre-douce" numberOfLines={1} style={styles.texteAxeGauche}>
                {AXES_MATRICE.important}
              </ETexte>
            </View>
          </View>
          <View style={styles.axeGauche}>
            <View style={styles.boiteAxeGauche}>
              <ETexte variante="repere" couleur="encre-douce" numberOfLines={1} style={styles.texteAxeGauche}>
                {AXES_MATRICE.secondaire}
              </ETexte>
            </View>
          </View>
        </View>
        <View role="tablist" aria-label="Les quadrants" style={styles.grille}>
          <View style={styles.rangee}>
            {tuile(maintenant)}
            {tuile(planifier)}
          </View>
          <View style={styles.rangee}>
            {tuile(confier)}
            {tuile(laisserFiler)}
          </View>
        </View>
      </View>
    </View>
  );
}
