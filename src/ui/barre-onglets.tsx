import { Pressable, View } from 'react-native';
import {
  EIcone,
  ETexte,
  ETrame,
  creerStyles,
  police,
  styleTexte,
  useTheme,
  type NomIcone,
} from '@empreinte-studio/react-native';
import { cornes, pas, traits } from './fondations';

/*
 * La barre d'onglets d'Apex, au pied de l'écran : les entrées de la navigation du client web (Objectifs,
 * Matrice), avec leur forme d'Empreinte (`e-nav__lien`). L'entrée courante devient un panneau éclairé, cerné de
 * trame, avec sa petite corne ; les autres restent en encre douce. Un filet trame la sépare de la page.
 */

export type Onglet = {
  readonly cle: string;
  readonly libelle: string;
  readonly icone: NomIcone;
  readonly actif: boolean;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly testID?: string;
};

/** La hauteur d'une entrée : la cible tactile d'Android, qui couvre celle d'iOS. */
const HAUTEUR = 48;

const useStyles = creerStyles(({ couleurs }) => ({
  barre: {
    flexDirection: 'row',
    gap: pas['pas-2'],
    paddingTop: pas['pas-2'],
    paddingHorizontal: pas['pas-4'],
    backgroundColor: couleurs.fond,
    borderTopWidth: traits['trait-fin'],
    borderTopColor: couleurs.trame,
  },
  onglet: {
    flex: 1,
    minHeight: HAUTEUR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: pas['pas-3'],
    paddingHorizontal: pas['pas-3'],
  },
  libelle: {
    ...styleTexte('corps'),
    fontSize: 15,
    lineHeight: 20,
  },
  libelleActif: {
    fontFamily: police('structure', 600),
  },
}));

export function BarreOnglets({
  onglets,
  basSur,
}: {
  readonly onglets: readonly Onglet[];
  readonly basSur: number;
}) {
  const styles = useStyles();
  const { couleurs } = useTheme();
  return (
    <View role="tablist" style={[styles.barre, { paddingBottom: pas['pas-2'] + basSur }]}>
      {onglets.map((onglet) => (
        <Pressable
          key={onglet.cle}
          role="tab"
          aria-selected={onglet.actif}
          aria-label={onglet.libelle}
          onPress={onglet.onPress}
          onLongPress={onglet.onLongPress}
          testID={onglet.testID}
          style={styles.onglet}
        >
          {({ pressed }) => {
            const couleur = onglet.actif || pressed ? couleurs.encre : couleurs['encre-douce'];
            return (
              <>
                {onglet.actif ? (
                  <ETrame
                    fond={couleurs.panneau}
                    contour={couleurs.trame}
                    corne={cornes['corne-s']}
                    rabat={couleurs.creux}
                  />
                ) : pressed ? (
                  <ETrame fond={couleurs.creux} />
                ) : null}
                <EIcone nom={onglet.icone} couleur={couleur} />
                <ETexte
                  style={[styles.libelle, onglet.actif && styles.libelleActif, { color: couleur }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.4}
                >
                  {onglet.libelle}
                </ETexte>
              </>
            );
          }}
        </Pressable>
      ))}
    </View>
  );
}
