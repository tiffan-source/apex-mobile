import { typesetTexts } from '@/domain/shared/typography';

/** Les textes de « Nouvel objectif », la phase « brouillon » d'Akari, repris du client web. */
export const NEW_OBJECTIVE_TEXTS = typesetTexts({
  marker: 'Akari',
  title: 'Nouvel objectif',
  intro: "On le construit ensemble. Rien n'est enregistré tant que tu ne t'engages pas.",
  questions: {
    title: "Qu'est-ce que tu veux construire ?",
    why: 'Pourquoi est-ce que ça compte pour toi ?',
    dueDate: 'Pour quand ?',
    description: 'Tu veux en dire plus ?',
    review: "Relis ton brouillon. Change ce que tu veux avant de t'engager.",
  },
  fields: {
    title: 'Ton objectif',
    titlePlaceholder: 'Décrocher un stage cet été',
    why: 'Ton pourquoi',
    dueDate: 'Ton horizon',
    dueDateHelp: 'Une date, même approximative.',
    description: 'En quelques mots',
    chooseDate: 'Choisis une date',
    removeDate: "Retirer l'horizon",
  },
  draft: {
    marker: 'Brouillon · pas encore enregistré',
    untitled: "Ton objectif s'écrit ici.",
    noHorizon: "Sans horizon pour l'instant",
    engage: "Je m'y engage",
    later: 'Plus tard',
    saving: "J'enregistre ton objectif…",
    after: "En t'engageant, l'objectif rejoint tes objectifs, puis Akari te propose des étapes.",
  },
  personFallback: 'Toi',
} as const);
