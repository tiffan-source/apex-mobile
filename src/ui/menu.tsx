import { useRef, useState } from 'react';
import { type PressableInstance } from 'react-native';
import { EBouton, EIcone, type NomIcone } from '@empreinte-studio/react-native';
import { poserLeLecteurSur } from './accessibilite';
import { Deroulant, ElementDeroulant, mesurerAncre, type Ancre } from './deroulant';

/*
 * Un menu d'actions derrière un bouton à icône, comme `e-menu` d'Empreinte : « Déplacer vers… » sur un pas de
 * la matrice. Le bouton dit ce qu'il ouvre ; chaque entrée fait une seule chose et referme le menu.
 */

export type EntreeMenu<V> = {
  readonly valeur: V;
  readonly libelle: string;
  readonly icone?: NomIcone;
  /** Une sortie douce, en encre douce. */
  readonly doux?: boolean;
};

export type ProprietesMenu<V> = {
  /** Ce que le bouton ouvre : « Déplacer « Réviser » vers… ». C'est son nom pour les lecteurs d'écran. */
  readonly libelle: string;
  readonly icone?: NomIcone;
  readonly entrees: readonly EntreeMenu<V>[];
  readonly onChoix: (valeur: V) => void;
  /** Le bouton réduit (36 points), pour une ligne de tâche. */
  readonly petit?: boolean;
  readonly testID?: string;
};

export function Menu<V>({
  libelle,
  icone = 'actions',
  entrees,
  onChoix,
  petit = false,
  testID,
}: ProprietesMenu<V>) {
  const bouton = useRef<PressableInstance>(null);
  const premiere = useRef<PressableInstance>(null);
  const [ancre, setAncre] = useState<Ancre | null>(null);

  const ouvrir = async () => setAncre(await mesurerAncre(bouton.current));
  const fermer = () => setAncre(null);

  return (
    <>
      <EBouton
        ref={bouton}
        variante="nu"
        icone
        petit={petit}
        aria-label={libelle}
        aria-expanded={ancre !== null}
        onPress={() => void ouvrir()}
        testID={testID}
      >
        <EIcone nom={icone} taille={petit ? 18 : 20} />
      </EBouton>
      <Deroulant
        ancre={ancre}
        onFermer={fermer}
        role="menu"
        libelle={libelle}
        onPret={() => {
          poserLeLecteurSur(premiere.current);
        }}
      >
        {entrees.map((entree, index) => (
          <ElementDeroulant
            key={String(entree.valeur)}
            ref={index === 0 ? premiere : undefined}
            role="menuitem"
            libelle={entree.libelle}
            {...(entree.icone ? { icone: entree.icone } : {})}
            doux={entree.doux ?? false}
            onPress={() => {
              fermer();
              onChoix(entree.valeur);
            }}
            {...(testID ? { testID: `${testID}-${String(entree.valeur)}` } : {})}
          />
        ))}
      </Deroulant>
    </>
  );
}
