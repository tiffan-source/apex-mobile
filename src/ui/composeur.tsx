import { useState } from 'react';
import { View } from 'react-native';
import { EBouton, EIcone, ESaisie, creerStyles } from '@empreinte-studio/react-native';
import { GOUTTIERE, pas, traits } from './fondations';

/*
 * La zone de réponse d'une conversation (`e-conversation__saisie`) : la saisie prend la place et grandit avec le
 * texte, le bouton d'envoi reste carré, en bas, sous un filet trame. La personne peut écrire pendant qu'Akari
 * répond : seul l'envoi attend. Un message qui n'a pas pu partir revient dans la saisie.
 */

const useStyles = creerStyles(({ couleurs }) => ({
  composeur: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: pas['pas-3'],
    paddingTop: pas['pas-3'],
    paddingBottom: pas['pas-3'],
    paddingHorizontal: GOUTTIERE,
    borderTopWidth: traits['trait-fin'],
    borderTopColor: couleurs.trame,
    backgroundColor: couleurs.fond,
  },
  saisie: {
    flex: 1,
    minWidth: 0,
  },
}));

export type ProprietesComposeur = {
  /** Le nom de la saisie : « Réponds à Akari ». */
  readonly libelle: string;
  /** Le texte indicatif : « Réponds à Akari… ». */
  readonly indication?: string;
  /** Akari écoute : l'envoi est possible. */
  readonly pret: boolean;
  /** Envoie le message ; rend faux s'il n'est pas parti (il revient alors dans la saisie). */
  readonly onEnvoyer: (texte: string) => boolean | Promise<boolean>;
  readonly libelleEnvoyer?: string;
  readonly testID?: string;
};

export function Composeur({
  libelle,
  indication,
  pret,
  onEnvoyer,
  libelleEnvoyer = 'Envoyer',
  testID,
}: ProprietesComposeur) {
  const styles = useStyles();
  const [brouillon, setBrouillon] = useState('');
  const peutEnvoyer = pret && brouillon.trim().length > 0;

  const envoyer = async () => {
    const texte = brouillon.trim();
    if (!pret || !texte) return;
    setBrouillon('');
    const parti = await onEnvoyer(texte);
    if (!parti) setBrouillon((actuel) => actuel || texte);
  };

  return (
    <View style={styles.composeur}>
      <View style={styles.saisie}>
        <ESaisie
          tailleAuto
          lignesMin={1}
          lignesMax={6}
          aria-label={libelle}
          placeholder={indication}
          value={brouillon}
          onChangeText={setBrouillon}
          testID={testID ? `${testID}-saisie` : undefined}
        />
      </View>
      <EBouton
        icone
        aria-label={libelleEnvoyer}
        disabled={!peutEnvoyer}
        onPress={() => void envoyer()}
        testID={testID ? `${testID}-envoyer` : undefined}
      >
        <EIcone nom="envoyer" />
      </EBouton>
    </View>
  );
}
