import { View } from 'react-native';
import { ETexte, creerStyles } from '@empreinte-studio/react-native';
import { pas } from './fondations';

/*
 * Une courte liste de ce qui vient de se passer, en « détail » et en encre douce : le journal d'une réplique, posé
 * au-dessus de la ligne d'état du fil (« J'ai noté ton message. »). Elle n'est pas annoncée : la ligne d'état l'est.
 */

const useStyles = creerStyles(() => ({
  journal: {
    gap: pas['pas-1'],
  },
}));

export function Journal({ lignes }: { readonly lignes: readonly string[] }) {
  const styles = useStyles();

  return (
    <View role="list" style={styles.journal}>
      {lignes.map((ligne, index) => (
        <ETexte key={index} role="listitem" variante="detail" couleur="encre-douce">
          {ligne}
        </ETexte>
      ))}
    </View>
  );
}
