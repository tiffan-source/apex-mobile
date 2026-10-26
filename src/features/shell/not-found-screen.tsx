import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EBouton, ETexte, creerStyles } from '@empreinte-studio/react-native';
import { Ecran } from '@/ui/ecran';
import { pas } from '@/ui/fondations';
import { routes } from './routes';
import { SHELL_TEXTS } from './shell.texts';

const useStyles = creerStyles(() => ({
  section: {
    gap: pas['pas-4'],
  },
}));

/** Une adresse qui ne mène à aucun écran : un titre, et le chemin des objectifs. */
export function NotFoundScreen() {
  const styles = useStyles();
  const router = useRouter();
  return (
    <Ecran centre testID="ecran-introuvable">
      <View style={styles.section}>
        <ETexte variante="objectif" role="heading">
          {SHELL_TEXTS.unknownRoute.title}
        </ETexte>
        <ETexte>{SHELL_TEXTS.unknownRoute.body}</ETexte>
        <EBouton onPress={() => router.replace(routes.home)}>{SHELL_TEXTS.seeObjectives}</EBouton>
      </View>
    </Ecran>
  );
}
