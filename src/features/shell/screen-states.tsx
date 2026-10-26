import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EBouton, ETexte, creerStyles } from '@empreinte-studio/react-native';
import { pas } from '@/ui/fondations';
import { routes } from './routes';
import { SHELL_TEXTS } from './shell.texts';

/*
 * Les états d'un écran qui attend ses données, comme sur le web : ce qui se charge, un objectif introuvable,
 * des objectifs qui n'ont pas pu être chargés. La page garde toujours un titre et un chemin.
 */

const useStyles = creerStyles(() => ({
  section: {
    gap: pas['pas-4'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: pas['pas-2'],
  },
}));

/** Ce qui se charge, dit en une ligne. */
export function LoadingLine({ text }: { readonly text: string }) {
  return (
    <ETexte variante="detail" couleur="encre-douce" role="status" accessibilityLiveRegion="polite">
      {text}
    </ETexte>
  );
}

/** Un objectif que la personne n'a pas (ou plus) : un titre, et le chemin de ses objectifs. */
export function NotFound() {
  const styles = useStyles();
  const router = useRouter();
  return (
    <View style={styles.section}>
      <ETexte variante="objectif" role="heading">
        {SHELL_TEXTS.notFound.title}
      </ETexte>
      <ETexte>{SHELL_TEXTS.notFound.body}</ETexte>
      <View style={styles.actions}>
        <EBouton onPress={() => router.dismissTo(routes.home)}>{SHELL_TEXTS.seeObjectives}</EBouton>
      </View>
    </View>
  );
}

/**
 * Les objectifs n'ont pas pu être chargés. La note d'Akari explique ; une fois lue (« Compris »), l'écran dit
 * encore quoi faire.
 */
export function NotLoaded({
  hasReport,
  onReload,
}: {
  readonly hasReport: boolean;
  readonly onReload: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <View style={styles.section}>
      <ETexte variante="objectif" role="heading">
        {SHELL_TEXTS.notLoaded.title}
      </ETexte>
      {hasReport ? null : <ETexte>{SHELL_TEXTS.notLoaded.body}</ETexte>}
      <View style={styles.actions}>
        <EBouton onPress={onReload}>{SHELL_TEXTS.reload}</EBouton>
        <EBouton variante="nu" onPress={() => router.dismissTo(routes.home)}>
          {SHELL_TEXTS.seeObjectives}
        </EBouton>
      </View>
    </View>
  );
}
