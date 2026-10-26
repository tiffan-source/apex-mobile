import type { ReactNode } from 'react';
import { View } from 'react-native';
import { EMarque, creerStyles } from '@empreinte-studio/react-native';
import { GOUTTIERE, pas, traits } from './fondations';

/*
 * Le bandeau des écrans à onglets, comme la navigation du client web sous 760px : la marque à gauche, les
 * réglages à droite, un filet trame dessous, et il part avec la page quand elle défile. Les entrées de la
 * navigation, elles, passent dans la barre d'onglets, au pouce.
 */

const useStyles = creerStyles(({ couleurs }) => ({
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pas['pas-2'],
    paddingVertical: pas['pas-2'],
    paddingLeft: GOUTTIERE,
    paddingRight: GOUTTIERE - pas['pas-2'],
    borderBottomWidth: traits['trait-fin'],
    borderBottomColor: couleurs.trame,
  },
}));

export function Bandeau({ marque, action }: { readonly marque: string; readonly action?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.bandeau}>
      <EMarque>{marque}</EMarque>
      {action}
    </View>
  );
}
