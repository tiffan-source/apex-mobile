import { typesetTexts } from '@/domain/shared/typography';

/** Les textes de l'écran Objectifs (l'accueil), repris du client web. */
export const OBJECTIVES_TEXTS = typesetTexts({
  title: 'Mes objectifs',
  newObjective: 'Nouvel objectif',
  open: 'Ouvrir',
  openLabel: (title: string) => `Ouvrir « ${title} »`,
  nextStep: 'Prochain pas',
  noStageYet: "Aucune étape pour l'instant. Pose la première quand tu veux.",
  empty: {
    question: "Qu'est-ce que tu veux construire ?",
    invitation: 'Dis-le-moi en une phrase : on trouve les étapes ensemble.',
    start: 'Commencer',
  },
  loading: 'Chargement de tes objectifs…',
  loadFailed: 'Tes objectifs ne sont pas chargés. Vérifie ta connexion, puis recharge.',
  accomplished: 'Accomplis',
  accomplishedOne: 'Accompli',
} as const);
