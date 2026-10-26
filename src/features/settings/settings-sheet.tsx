import Constants from 'expo-constants';
import { View } from 'react-native';
import { EBouton, ETexte, creerStyles, useTheme } from '@empreinte-studio/react-native';
import { identityOf, initialOf } from '@/domain/session/user';
import { useAnnouncements } from '@/state/announcements';
import { useCurrentUser, useSessionActions } from '@/state/session';
import { Feuille } from '@/ui/feuille';
import { pas } from '@/ui/fondations';
import { ListeChoix } from '@/ui/liste-choix';
import { useCloseSheet } from '../sheets/sheet-frame';
import { SETTINGS_TEXTS as T } from './settings.texts';

const useStyles = creerStyles(({ couleurs }) => ({
  section: {
    gap: pas['pas-3'],
  },
  personne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-3'],
  },
  initiale: {
    width: pas['pas-8'],
    height: pas['pas-8'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.creux,
  },
  identite: {
    flex: 1,
    minWidth: 0,
  },
}));

/**
 * Les réglages, comme le menu « Réglages » du client web : la personne (son initiale et son nom), le thème
 * (Jour, Nuit, ou comme l'appareil), et, propre au téléphone, la déconnexion : le coffre de l'appareil garde la
 * session jusque-là.
 */
export function SettingsSheet() {
  const styles = useStyles();
  const close = useCloseSheet();
  const user = useCurrentUser();
  const { preference, definir } = useTheme();
  const { signOut } = useSessionActions();
  const announcements = useAnnouncements();
  const identity = identityOf(user);
  const version = Constants.expoConfig?.version;

  return (
    <Feuille
      titre={T.title}
      onFermer={close}
      actions={
        <EBouton variante="nu" onPress={close}>
          {T.close}
        </EBouton>
      }
      testID="feuille-reglages"
    >
      <View style={styles.section}>
        <ETexte variante="section" role="heading">
          {T.theme}
        </ETexte>
        <ListeChoix
          libelle={T.theme}
          options={T.themeChoices}
          valeur={preference}
          onChoix={(choice) => {
            definir(choice);
            announcements.announce(T.themeAnnouncements[choice]);
          }}
          testID="theme"
        />
      </View>

      <View style={styles.section}>
        <ETexte variante="section" role="heading">
          {T.account}
        </ETexte>
        {identity ? (
          <View style={styles.personne}>
            <View style={styles.initiale} aria-hidden>
              <ETexte variante="voix">{initialOf(user)}</ETexte>
            </View>
            <ETexte variante="detail" numberOfLines={1} style={styles.identite}>
              {identity}
            </ETexte>
          </View>
        ) : null}
        <ETexte variante="detail" couleur="encre-douce">
          {T.signOutHelp}
        </ETexte>
        <EBouton onPress={() => void signOut()} testID="se-deconnecter">
          {T.signOut}
        </EBouton>
      </View>

      {version ? (
        <ETexte variante="detail" couleur="encre-douce">
          {T.version(version)}
        </ETexte>
      ) : null}
    </Feuille>
  );
}
