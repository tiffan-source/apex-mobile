import { Children, isValidElement, type ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { ESurface, creerStyles, type TailleCorne } from '@empreinte-studio/react-native';
import { pas, traits } from './fondations';

/*
 * La trame des maquettes d'Apex (`.ds-panels`, `.ds-panel` du client web), telle qu'elle se pose sur un
 * téléphone : des panneaux empilés, plus lumineux que le fond, séparés par un seul filet trame. Chaque panneau
 * dessine son propre filet ; ils se recouvrent d'un trait pour n'en montrer qu'un entre deux panneaux.
 */

/** Les marges d'un panneau sur un téléphone : 24 en haut et en bas, 20 sur les côtés (maquettes mobiles). */
export const MARGE_PANNEAU = { verticale: pas['pas-6'], laterale: 20 } as const;

const useStyles = creerStyles(() => ({
  panneau: {
    gap: pas['pas-4'],
    paddingVertical: MARGE_PANNEAU.verticale,
    paddingHorizontal: MARGE_PANNEAU.laterale,
  },
  bordPerdu: {
    paddingHorizontal: 0,
  },
  recouvre: {
    marginTop: -traits['trait-fin'],
  },
}));

export type ProprietesPanneau = ViewProps & {
  /**
   * À bord perdu : les listes de pas vont d'un bord à l'autre (leurs pas gardent la marge du panneau) ; les
   * autres éléments prennent la marge avec `EnRetrait`.
   */
  readonly bordPerdu?: boolean;
  /** La corne de ce qui compte maintenant : une par écran ou par groupe, jamais en décoration. */
  readonly corne?: TailleCorne | null;
  readonly children?: ReactNode;
};

/** Un panneau de la trame. */
export function Panneau({ bordPerdu = false, corne = null, style, children, ...props }: ProprietesPanneau) {
  const styles = useStyles();
  return (
    <ESurface corne={corne} style={[styles.panneau, bordPerdu && styles.bordPerdu, style]} {...props}>
      {children}
    </ESurface>
  );
}

/** Dans un panneau à bord perdu : la marge latérale du panneau. */
export function EnRetrait({
  children,
  style,
}: {
  readonly children?: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ paddingHorizontal: MARGE_PANNEAU.laterale }, style]}>{children}</View>;
}

/** Des panneaux (ou des cartes) empilés, un seul filet entre deux. */
export function Trame({
  children,
  style,
}: {
  readonly children?: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const enfants = Children.toArray(children);
  return (
    <View style={style}>
      {enfants.map((enfant, index) => (
        <View
          key={isValidElement(enfant) && enfant.key !== null ? enfant.key : index}
          style={index > 0 ? styles.recouvre : null}
        >
          {enfant}
        </View>
      ))}
    </View>
  );
}
