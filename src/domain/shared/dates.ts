/*
 * Les dates d'Apex : l'horizon d'un objectif (« Jusqu'en mai »), le repère du jour (« Lundi 19 octobre »),
 * et les échéances choisies dans un sélecteur de date.
 *
 * Une échéance est un jour, pas un instant : on la garde à minuit, en heure locale, et on l'envoie à l'API
 * comme l'instant de ce minuit (ISO 8601). Envoyer « 2027-04-01 » seul donnerait minuit UTC : à l'ouest de
 * Greenwich, ce serait encore le 31 mars, et l'horizon deviendrait « Jusqu'en mars ».
 */

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long' });
const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const LONG_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Une date lue depuis l'API (ISO 8601) ou déjà en `Date` ; `null` si elle est absente ou illisible. */
export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Le même jour, à minuit, en heure locale. */
export function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Vrai si les deux dates tombent le même jour, en heure locale. */
export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Vrai si la date est avant aujourd'hui (une échéance passée ne se choisit pas). */
export function isBeforeToday(date: Date, now: Date = new Date()): boolean {
  return startOfDay(date).getTime() < startOfDay(now).getTime();
}

/** Une échéance prête pour l'API : l'instant du minuit local de ce jour. */
export function toApiDate(date: Date): string {
  return startOfDay(date).toISOString();
}

/**
 * L'horizon d'un objectif : « Jusqu'en mai », ou « Jusqu'en mai 2027 » si l'année n'est pas l'année en cours.
 * Vide sans échéance (ou avec une date illisible).
 */
export function formatHorizon(dueDate: string | Date | null | undefined, now: Date = new Date()): string {
  const date = toDate(dueDate);
  if (!date) return '';
  const month = MONTH.format(date);
  return date.getFullYear() === now.getFullYear()
    ? `Jusqu'en ${month}`
    : `Jusqu'en ${month} ${date.getFullYear()}`;
}

/** Le repère du jour des écrans : « Lundi 19 octobre ». */
export function formatToday(date: Date): string {
  const text = DAY.format(date);
  return text.charAt(0).toLocaleUpperCase('fr') + text.slice(1);
}

/** Une date en toutes lettres, pour un champ : « 1er juin 2027 ». */
export function formatLongDate(date: Date): string {
  return LONG_DATE.format(date).replace(/^1 /, '1er ');
}

/** Le nombre de millisecondes avant le prochain minuit local : le repère du jour change à ce moment-là. */
export function msUntilMidnight(now: Date = new Date()): number {
  const midnight = startOfDay(now);
  midnight.setDate(midnight.getDate() + 1);
  return midnight.getTime() - now.getTime();
}
