import { Fragment } from 'react';
import { Pressable, View } from 'react-native';
import { ETexte, creerStyles, margeTactile } from '@empreinte-studio/react-native';
import { pas, traits } from './fondations';

/*
 * Le fil d'Ariane, comme `e-fil-ariane` d'Empreinte : d'où l'on vient, en « detail » et en encre douce,
 * souligné comme un lien, la page courante en encre. Les écrans d'un objectif le gardent sur le téléphone :
 * il dit où l'on est, quel que soit le chemin pris pour y arriver (le geste de retour, lui, suit l'historique).
 */

export type Miette = {
  readonly libelle: string;
  /** Rejoindre cette page. Sans action, la miette est la page courante. */
  readonly onPress?: () => void;
};

const HAUTEUR_LIGNE = 20;

const useStyles = creerStyles(({ couleurs }) => ({
  fil: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: pas['pas-2'],
    rowGap: pas['pas-1'],
  },
  lien: {
    borderBottomWidth: traits['trait-fin'],
    borderBottomColor: couleurs['encre-douce'],
  },
  lienPresse: {
    borderBottomWidth: traits['trait-net'],
    borderBottomColor: couleurs.encre,
  },
}));

export function FilAriane({ miettes }: { readonly miettes: readonly Miette[] }) {
  const styles = useStyles();
  return (
    <View role="navigation" aria-label="Fil d'Ariane" style={styles.fil}>
      {miettes.map((miette, index) => (
        <Fragment key={`${index}-${miette.libelle}`}>
          {index > 0 ? (
            <ETexte variante="detail" couleur="encre-douce" aria-hidden>
              /
            </ETexte>
          ) : null}
          {miette.onPress ? (
            <Pressable
              role="link"
              aria-label={miette.libelle}
              onPress={miette.onPress}
              hitSlop={margeTactile(0, HAUTEUR_LIGNE)}
            >
              {({ pressed }) => (
                <View style={[styles.lien, pressed && styles.lienPresse]}>
                  <ETexte variante="detail" couleur={pressed ? 'encre' : 'encre-douce'} numberOfLines={1}>
                    {miette.libelle}
                  </ETexte>
                </View>
              )}
            </Pressable>
          ) : (
            <ETexte variante="detail" numberOfLines={1}>
              {miette.libelle}
            </ETexte>
          )}
        </Fragment>
      ))}
    </View>
  );
}
