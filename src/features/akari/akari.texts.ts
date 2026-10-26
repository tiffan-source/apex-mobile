import { compter } from '@empreinte-studio/noyau';
import { typesetTexts } from '@/domain/shared/typography';

/** Les textes de l'écran Akari d'un objectif (`/objectifs/:id/akari`), repris du client web. */
export const AKARI_SCREEN_TEXTS = typesetTexts({
  marker: 'Akari',
  intro: "Akari propose, tu décides : rien n'est ajouté sans ton accord.",
  composer: {
    label: 'Réponds à Akari',
    hint: 'Réponds à Akari…',
    send: 'Envoyer',
  },
  latest: 'Dernières répliques',
  arete: "L'arête",
  noStage: "Aucune étape pour l'instant. Akari peut t'en proposer.",
  seeArete: "Voir l'arête",
  searching: 'Akari retrouve ton objectif…',
  personFallback: 'Toi',
  /** « Jusqu'en mai · 4 étapes · 13 pas » */
  summary: (horizon: string, stageCount: number, taskCount: number) =>
    [
      horizon,
      stageCount ? compter(stageCount, 'étape') : '',
      taskCount ? compter(taskCount, 'pas', 'pas') : '',
    ]
      .filter(Boolean)
      .join(' · '),
  stageTasks: (count: number) => compter(count, 'pas', 'pas'),
  looseTasks: (count: number) => `${compter(count, 'pas', 'pas')} sans étape`,
} as const);
