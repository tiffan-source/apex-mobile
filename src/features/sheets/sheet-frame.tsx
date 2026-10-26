import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { EBouton, ETexte } from '@empreinte-studio/react-native';
import { Feuille } from '@/ui/feuille';
import { routes } from '../shell/routes';
import { LoadingLine } from '../shell/screen-states';
import { SHEETS_TEXTS } from './sheets.texts';

/** Fermer une feuille : revenir à l'écran qui l'a ouverte (ou à l'accueil, si elle a été ouverte par un lien). */
export function useCloseSheet(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.home);
  }, [router]);
}

/** L'action de la feuille, puis la sortie douce. */
export function SheetActions({
  label,
  onConfirm,
  onCancel,
  testID,
}: {
  readonly label: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly testID?: string;
}) {
  return (
    <>
      <EBouton onPress={onConfirm} testID={testID}>
        {label}
      </EBouton>
      <EBouton variante="nu" onPress={onCancel}>
        {SHEETS_TEXTS.cancel}
      </EBouton>
    </>
  );
}

/** Ce que la feuille devait modifier n'est plus là (supprimé ailleurs, ou pas encore chargé). */
export function GoneSheet({ title, text }: { readonly title: string; readonly text: string }) {
  const close = useCloseSheet();
  return (
    <Feuille
      titre={title}
      onFermer={close}
      actions={
        <EBouton variante="nu" onPress={close}>
          {SHEETS_TEXTS.close}
        </EBouton>
      }
    >
      <ETexte>{text}</ETexte>
    </Feuille>
  );
}

/** Les objectifs ne sont pas encore là (la feuille a été ouverte par un lien) : elle attend leur chargement. */
export function LoadingSheet({ title }: { readonly title: string }) {
  const close = useCloseSheet();
  return (
    <Feuille titre={title} onFermer={close}>
      <LoadingLine text={SHEETS_TEXTS.loading} />
    </Feuille>
  );
}
