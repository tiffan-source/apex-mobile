import type { Announcer } from '../ports/platform';
import { ObservableValue } from '../shared/observable-value';

/**
 * Ce qui remplace les toasts (cahier de migration d'Apex, § 7), comme `AnnoncesStore` du client web.
 * Rien ne surgit dans Empreinte :
 * - `announce(texte)` : une réussite, dite aux lecteurs d'écran, sans rien afficher ;
 * - `report(texte)` : quelque chose n'a pas marché. Le texte reste jusqu'à `acknowledge()` ; l'écran l'affiche
 *   dans une note d'Akari avec un bouton « Compris », et il est annoncé tout de suite.
 */
export class AnnouncementCenter {
  /** Le signalement en cours, affiché par l'écran, ou null. */
  readonly report$ = new ObservableValue<string | null>(null);

  constructor(private readonly announcer: Announcer) {}

  announce(text: string): void {
    const phrase = text.trim();
    if (phrase) this.announcer.announce(phrase, 'polite');
  }

  /**
   * Gardé pour l'écran et annoncé sans attendre. La même phrase, encore affichée, n'est pas réannoncée (sans
   * connexion, plusieurs gestes de la file n'aboutissent pas à la suite).
   */
  report(text: string): void {
    const phrase = text.trim();
    if (!phrase || this.report$.get() === phrase) return;
    this.report$.set(phrase);
    this.announcer.announce(phrase, 'assertive');
  }

  /** La personne a lu le signalement : la note disparaît. */
  acknowledge(): void {
    this.report$.set(null);
  }
}
