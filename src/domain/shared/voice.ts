import { motsAEviter } from '@empreinte-studio/noyau';

/*
 * La voix d'Empreinte, vérifiée : tutoiement, phrases courtes, jamais « échec », « erreur », « succès »,
 * « supprimer », « en retard », de pourcentage, de point d'exclamation ni d'emoji.
 *
 * `motsAEviter()` d'Empreinte ne suffit pas seul : ses motifs commencent par `\b`, qui ne reconnaît pas une
 * lettre accentuée en début de mot (« échec », « raté », « manqué », « supprimé » lui échappent). Ces motifs-ci
 * s'appuient sur les lettres Unicode, comme le test de voix du client web (`voiceIssues`).
 */
const OUTSIDE_THE_VOICE: readonly { readonly word: string; readonly pattern: RegExp }[] = [
  { word: 'échec', pattern: /(?<!\p{L})(échec|échou)/iu },
  { word: 'erreur', pattern: /(?<!\p{L})erreur/iu },
  { word: 'succès', pattern: /(?<!\p{L})succès/iu },
  { word: 'raté', pattern: /(?<!\p{L})rat(é|ée|és|ées)(?!\p{L})/iu },
  { word: 'manqué', pattern: /(?<!\p{L})manqu(é|ée|és|ées)(?!\p{L})/iu },
  { word: 'perdu', pattern: /(?<!\p{L})perdu(e|s|es)?(?!\p{L})/iu },
  { word: 'supprimer', pattern: /(?<!\p{L})supprim/iu },
  { word: 'en retard', pattern: /(?<!\p{L})en retard(?!\p{L})/iu },
  { word: 'pourcentage', pattern: /\d+\s*%/u },
  { word: "point d'exclamation", pattern: /!/u },
  { word: 'emoji', pattern: /\p{Extended_Pictographic}/u },
];

/** Les mots hors de la voix d'Empreinte dans un texte (vide : le texte parle comme Empreinte). */
export function voiceIssues(text: string): string[] {
  const words = new Set(motsAEviter(text).map(({ mot }) => mot));
  for (const { word, pattern } of OUTSIDE_THE_VOICE) if (pattern.test(text)) words.add(word);
  return [...words];
}

/** Toutes les chaînes d'un objet de textes (constantes, tableaux, objets imbriqués), pour les tests de voix. */
export function collectTexts(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectTexts(item, found));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((item) => collectTexts(item, found));
  return found;
}
