import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  EIcone,
  ETexte,
  creerStyles,
  type NomIcone,
  type VarianteTexte,
} from '@empreinte-studio/react-native';
import { pas } from './fondations';

/*
 * L'en-tête d'un écran, comme `.ds-page-header` du client web : le fil d'Ariane, le repère (le jour,
 * « Akari »), le titre (un manifeste par écran au plus), le pourquoi en « voix », une ligne de détail, puis les
 * actions de l'écran. Sur un téléphone, les actions passent sous le titre plutôt qu'à côté.
 */

/** L'espace insécable qui lie les guillemets au pourquoi : jamais un « » » seul en début de ligne. */
const INSECABLE = '\u00a0';

export type ProprietesEnTete = {
  /** D'où l'on vient (`FilAriane`), au-dessus de tout. */
  readonly filAriane?: ReactNode;
  /** Le repère au-dessus du titre, en capitales : « Lundi 19 octobre ». */
  readonly repere?: string;
  /** Une icône devant le repère (« akari »). */
  readonly iconeRepere?: NomIcone;
  /** Une ligne au-dessus du titre, en détail : l'horizon d'un objectif. */
  readonly surTitre?: string;
  readonly titre: string;
  /** `manifeste` pour le titre d'un écran, `objectif` pour le nom d'un objectif. */
  readonly variante?: Extract<VarianteTexte, 'manifeste' | 'objectif'>;
  /** Le pourquoi d'un objectif, écrit en « voix » entre « ». */
  readonly voix?: string;
  /** Ce qu'on lit sous le titre, en encre douce. */
  readonly detail?: string;
  /** Les actions de l'écran (le bouton sceau de l'engagement, « Modifier l'objectif »…). */
  readonly actions?: ReactNode;
};

const useStyles = creerStyles(() => ({
  entete: {
    gap: pas['pas-6'],
  },
  textes: {
    gap: pas['pas-2'],
  },
  repere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-2'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: pas['pas-2'],
  },
}));

export function EnTete({
  filAriane,
  repere,
  iconeRepere,
  surTitre,
  titre,
  variante = 'manifeste',
  voix,
  detail,
  actions,
}: ProprietesEnTete) {
  const styles = useStyles();
  return (
    <View style={styles.entete}>
      {filAriane}
      <View style={styles.textes}>
        {repere ? (
          <View style={styles.repere}>
            {iconeRepere ? <EIcone nom={iconeRepere} taille={16} /> : null}
            <ETexte variante="repere" couleur="encre-douce">
              {repere}
            </ETexte>
          </View>
        ) : null}
        {surTitre ? (
          <ETexte variante="detail" couleur="encre-douce">
            {surTitre}
          </ETexte>
        ) : null}
        <ETexte variante={variante} role="heading">
          {titre}
        </ETexte>
        {voix ? (
          <ETexte variante="voix" couleur="encre-douce">
            {`«${INSECABLE}${voix}${INSECABLE}»`}
          </ETexte>
        ) : null}
        {detail ? (
          <ETexte variante="detail" couleur="encre-douce">
            {detail}
          </ETexte>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}
