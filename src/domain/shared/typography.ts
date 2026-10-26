/*
 * La typographie française des phrases d'Apex, comme les gabarits du client web (`«&nbsp;…&nbsp;»`,
 * `construire&nbsp;?`) : une espace insécable lie au mot qu'ils ponctuent les signes doubles (« ? », « ! »,
 * « : », « ; ») et les guillemets. Un retour à la ligne ne laisse donc jamais un « ? » ou un « » » seul en début
 * de ligne. Les textes s'écrivent avec des espaces ordinaires : `typeset` pose les insécables.
 */

/** L'espace insécable. */
export const NBSP = '\u00a0';

/** Les espaces ordinaires avant un signe double ou un guillemet fermant, ou après un guillemet ouvrant. */
const BEFORE_MARK = / +(?=[?!:;»])/g;
const AFTER_OPENING_QUOTE = /« +/g;

/** Une phrase avec ses espaces insécables : « Pour quand ? » ne se coupe plus avant « ? ». */
export function typeset(text: string): string {
  return text.replace(BEFORE_MARK, NBSP).replace(AFTER_OPENING_QUOTE, `«${NBSP}`);
}

/** Un nom court qui ne se coupe pas en fin de ligne : « À laisser filer », jamais « À » seul. */
export function keepTogether(text: string): string {
  return text.replace(/ +/g, NBSP);
}

/** Un texte entre guillemets français, lié à eux : « Courir un semi-marathon ». */
export function quoted(text: string): string {
  return `«${NBSP}${text}${NBSP}»`;
}

/**
 * Une table de textes, avec la typographie posée sur chacune de ses phrases, y compris celles que ses
 * fonctions écrivent. Le type reste celui des textes écrits : seules les espaces changent.
 */
export function typesetTexts<T extends object>(texts: T): T {
  return typesetValue(texts) as T;
}

function typesetValue(value: unknown): unknown {
  if (typeof value === 'string') return typeset(value);
  if (typeof value === 'function') {
    const write = value as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => typesetValue(write(...args));
  }
  if (Array.isArray(value)) return value.map(typesetValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typesetValue(entry)]));
  }
  return value;
}
