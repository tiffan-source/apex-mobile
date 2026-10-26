import { typesetTexts } from '@/domain/shared/typography';

/** Les textes communs aux écrans : la coque, la navigation, les états d'attente. */
export const SHELL_TEXTS = typesetTexts({
  brand: 'Apex',
  settings: 'Réglages',
  tabs: {
    objectives: 'Objectifs',
    matrix: 'Matrice',
  },
  crumbs: {
    objectives: 'Objectifs',
    akari: 'Akari',
  },
  understood: 'Compris',
  reload: 'Recharger',
  seeObjectives: 'Voir mes objectifs',
  notFound: {
    title: 'Cet objectif est introuvable',
    body: 'Le lien est peut-être incomplet. Retrouve-le parmi tes objectifs.',
  },
  notLoaded: {
    title: 'Tes objectifs ne sont pas chargés',
    body: 'Vérifie ta connexion, puis recharge.',
  },
  unknownRoute: {
    title: 'Cette page est introuvable',
    body: 'Le lien mène nulle part. Reprends depuis tes objectifs.',
  },
} as const);
