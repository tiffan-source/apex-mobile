import { EBouton, ENote } from '@empreinte-studio/react-native';

/*
 * Ce qui n'a pas marché, dit par Akari en haut de l'écran (la note de la coque du client web) : la phrase, avec
 * ce qu'il faut faire, et « Compris » pour la ranger. Rien ne surgit, rien ne rougit.
 */
export function Signalement({
  texte,
  onCompris,
  libelleCompris = 'Compris',
}: {
  readonly texte: string;
  readonly onCompris: () => void;
  readonly libelleCompris?: string;
}) {
  return (
    <ENote
      accessibilityLiveRegion="assertive"
      actions={
        <EBouton petit onPress={onCompris}>
          {libelleCompris}
        </EBouton>
      }
    >
      {texte}
    </ENote>
  );
}
