import { useRouter } from 'expo-router';
import { EBouton, EIcone } from '@empreinte-studio/react-native';
import { Bandeau } from '@/ui/bandeau';
import { routes } from './routes';
import { SHELL_TEXTS } from './shell.texts';

/** Le bandeau des écrans à onglets : la marque, et les réglages. */
export function AppBand() {
  const router = useRouter();
  return (
    <Bandeau
      marque={SHELL_TEXTS.brand}
      action={
        <EBouton
          variante="nu"
          icone
          aria-label={SHELL_TEXTS.settings}
          onPress={() => router.push(routes.settings)}
          testID="ouvrir-reglages"
        >
          <EIcone nom="reglages" />
        </EBouton>
      }
    />
  );
}
