import type { PreferenceTheme } from '@empreinte-studio/noyau';
import { typesetTexts } from '@/domain/shared/typography';

/** Les textes des réglages, repris du menu « Réglages » du client web. */
export const SETTINGS_TEXTS = typesetTexts({
  title: 'Réglages',
  theme: 'Thème',
  themeChoices: [
    { valeur: 'jour', libelle: 'Thème Jour' },
    { valeur: 'nuit', libelle: 'Thème Nuit' },
    { valeur: 'systeme', libelle: "Comme l'appareil" },
  ] as const satisfies readonly { valeur: PreferenceTheme; libelle: string }[],
  themeAnnouncements: {
    jour: 'Thème Jour choisi.',
    nuit: 'Thème Nuit choisi.',
    systeme: 'Le thème suit ton appareil.',
  } as const satisfies Record<PreferenceTheme, string>,
  account: 'Ton compte',
  signOut: 'Me déconnecter',
  signOutHelp: 'Tes objectifs restent enregistrés : tu les retrouves en te reconnectant.',
  close: 'Fermer',
  version: (version: string) => `Apex ${version}`,
} as const);
