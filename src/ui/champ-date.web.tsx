import { View } from 'react-native';
import { EBouton, EIcone, creerStyles, police, useTheme } from '@empreinte-studio/react-native';
import { pas, traits } from './fondations';
import type { ProprietesChampDate } from './champ-date';

/*
 * Le choix d'une date dans le navigateur (l'aperçu web de l'application, pour le développement) : le champ de date
 * du navigateur, habillé comme la saisie d'Empreinte. Sur iOS et Android, `champ-date.tsx` ouvre le calendrier
 * du téléphone.
 */

/** « 2027-06-01 », en heure locale. */
function versChamp(date: Date | null | undefined): string {
  if (!date) return '';
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/** Minuit, en heure locale, du jour écrit dans le champ. */
function depuisChamp(valeur: string): Date | null {
  const [annee, mois, jour] = valeur.split('-').map(Number);
  if (!annee || !mois || !jour) return null;
  return new Date(annee, mois - 1, jour);
}

const useStyles = creerStyles(() => ({
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-1'],
  },
}));

export function ChampDate({
  libelle,
  valeur,
  onChange,
  minimum,
  retirable = false,
  libelleRetirer = 'Retirer la date',
  invalide = false,
  testID,
}: ProprietesChampDate) {
  const styles = useStyles();
  const { couleurs, actif } = useTheme();
  return (
    <View style={styles.ligne}>
      <input
        type="date"
        aria-label={libelle}
        data-testid={testID}
        value={versChamp(valeur)}
        min={versChamp(minimum)}
        onChange={(evenement) => onChange(depuisChamp(evenement.target.value))}
        style={{
          flex: 1,
          minWidth: 0,
          boxSizing: 'border-box',
          minHeight: 44,
          padding: `10px ${pas['pas-3']}px 10px ${pas['pas-4']}px`,
          border: 0,
          borderRadius: 0,
          background: couleurs.creux,
          color: couleurs.encre,
          boxShadow: `inset 0 0 0 ${invalide ? traits['trait-net'] : traits['trait-fin']}px ${invalide ? couleurs.encre : couleurs['trame-forte']}`,
          fontFamily: police('structure', 400),
          fontSize: 16,
          lineHeight: '24px',
          colorScheme: actif === 'nuit' ? 'dark' : 'light',
        }}
      />
      {retirable && valeur ? (
        <EBouton variante="nu" icone aria-label={libelleRetirer} onPress={() => onChange(null)}>
          <EIcone nom="fermer" taille={20} />
        </EBouton>
      ) : null}
    </View>
  );
}
