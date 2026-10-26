import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  EBouton,
  EIcone,
  ETexte,
  ETrame,
  creerStyles,
  police,
  useTheme,
} from '@empreinte-studio/react-native';
import { pas, traits } from './fondations';

/*
 * Le choix d'une date, à poser dans un `EChamp` : le même creux et le même contour que la saisie, la date écrite
 * en toutes lettres (« 1er juin 2027 »). Le calendrier est celui du téléphone, accordé au thème : sur iOS, il se
 * déplie sous le champ ; sur Android, il s'ouvre dans sa boîte de dialogue. Une date qu'on peut retirer porte, à
 * côté du champ, un bouton nu marqué d'une croix : l'aide du champ reste juste dessous.
 */

const HAUTEUR = 44;

const useStyles = creerStyles(() => ({
  champ: {
    gap: pas['pas-2'],
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-1'],
  },
  declencheur: {
    flex: 1,
    minHeight: HAUTEUR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pas['pas-2'],
    paddingVertical: 10,
    paddingLeft: pas['pas-4'],
    paddingRight: pas['pas-3'],
  },
  valeur: {
    flexShrink: 1,
    fontFamily: police('structure', 400),
    fontSize: 16,
    lineHeight: 24,
  },
  calendrier: {
    alignSelf: 'stretch',
  },
}));

export type ProprietesChampDate = {
  /** Le libellé du champ qui l'entoure, pour les lecteurs d'écran. */
  readonly libelle: string;
  readonly valeur: Date | null;
  /** La date écrite en toutes lettres, quand il y en a une. */
  readonly texte?: string;
  readonly onChange: (date: Date | null) => void;
  /** La première date qu'on peut choisir (aujourd'hui, pour un horizon). */
  readonly minimum?: Date;
  /** Ce qu'on lit tant qu'aucune date n'est choisie. */
  readonly texteVide?: string;
  /** On peut retirer la date : un bouton nu marqué d'une croix le propose, à côté du champ. */
  readonly retirable?: boolean;
  /** Le nom de ce bouton pour les lecteurs d'écran : « Retirer l'horizon ». */
  readonly libelleRetirer?: string;
  readonly invalide?: boolean;
  readonly testID?: string;
};

export function ChampDate({
  libelle,
  valeur,
  texte,
  onChange,
  minimum,
  texteVide = 'Choisis une date',
  retirable = false,
  libelleRetirer = 'Retirer la date',
  invalide = false,
  testID,
}: ProprietesChampDate) {
  const styles = useStyles();
  const { couleurs, actif } = useTheme();
  const [deplie, setDeplie] = useState(false);
  const affichee = valeur ?? minimum ?? new Date();

  const ouvrir = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: affichee,
        mode: 'date',
        ...(minimum ? { minimumDate: minimum } : {}),
        onChange: (evenement: DateTimePickerEvent, date?: Date) => {
          if (evenement.type === 'set' && date) onChange(date);
        },
      });
      return;
    }
    setDeplie((avant) => !avant);
  };

  return (
    <View style={styles.champ}>
      <View style={styles.ligne}>
        <Pressable
          role="button"
          aria-label={`${libelle} : ${texte ?? texteVide}`}
          aria-expanded={Platform.OS === 'ios' ? deplie : undefined}
          accessibilityHint="Ouvre le calendrier."
          onPress={ouvrir}
          testID={testID}
          style={styles.declencheur}
        >
          {({ pressed }) => (
            <>
              <ETrame
                fond={couleurs.creux}
                contour={deplie || invalide || pressed ? couleurs.encre : couleurs['trame-forte']}
                trait={deplie || invalide ? traits['trait-net'] : traits['trait-fin']}
              />
              <ETexte couleur={texte ? 'encre' : 'encre-douce'} style={styles.valeur} numberOfLines={1}>
                {texte ?? texteVide}
              </ETexte>
              <EIcone nom="calendrier" />
            </>
          )}
        </Pressable>
        {retirable && valeur ? (
          <EBouton
            variante="nu"
            icone
            aria-label={libelleRetirer}
            onPress={() => {
              setDeplie(false);
              onChange(null);
            }}
          >
            <EIcone nom="fermer" taille={20} />
          </EBouton>
        ) : null}
      </View>
      {deplie && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={affichee}
          mode="date"
          display="inline"
          locale="fr-FR"
          themeVariant={actif === 'nuit' ? 'dark' : 'light'}
          accentColor={couleurs.encre}
          textColor={couleurs.encre}
          {...(minimum ? { minimumDate: minimum } : {})}
          onChange={(evenement, date) => {
            if (evenement.type === 'set' && date) {
              onChange(date);
              setDeplie(false);
            }
          }}
          style={styles.calendrier}
        />
      ) : null}
    </View>
  );
}
