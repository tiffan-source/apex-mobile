/*
 * Les clés du cache de TanStack Query. Chaque clé porte la personne connectée : changer de compte ne montre
 * jamais les données d'un autre, même un instant.
 */
export const queryKeys = {
  objectives: (userId: string | null) => ['objectives', userId] as const,
  akariMessages: (userId: string | null, objectiveId: string) =>
    ['akari', userId, objectiveId, 'messages'] as const,
  akariState: (userId: string | null, objectiveId: string) =>
    ['akari', userId, objectiveId, 'state'] as const,
} as const;

/** Toutes les clés des objectifs, toutes personnes confondues (pour les invalider). */
export const OBJECTIVES_ROOT_KEY = ['objectives'] as const;
