import { typesetTexts } from '@/domain/shared/typography';

/** Les textes de la matrice (`/matrice`), repris du client web. */
export const MATRIX_TEXTS = typesetTexts({
  title: 'La matrice',
  filters: 'Filtrer par objectif',
  allObjectives: 'Tous les objectifs',
  empty: "Aucun pas pour l'instant. Ajoute des pas à tes objectifs : ils viennent se ranger ici.",
  loading: 'Chargement de tes pas…',
  loadFailed: 'Tes pas ne sont pas chargés. Vérifie ta connexion, puis recharge.',
  emptyQuadrant: "Aucun pas ici pour l'instant.",
  moveLabel: (title: string) => `Déplacer « ${title} » vers…`,
  filterChosen: (name: string, count: string) => `${name} · ${count}`,
} as const);
