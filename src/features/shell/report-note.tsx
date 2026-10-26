import { useReport } from '@/state/announcements';
import { Signalement } from '@/ui/signalement';
import { SHELL_TEXTS } from './shell.texts';

/**
 * Ce qui n'a pas marché, en haut de l'écran, jusqu'à « Compris » : la note de la coque du client web. Une note
 * par écran au plus : tant qu'elle est là, l'écran ne pose pas la sienne.
 */
export function ReportNote() {
  const { report, acknowledge } = useReport();
  return report ? (
    <Signalement texte={report} onCompris={acknowledge} libelleCompris={SHELL_TEXTS.understood} />
  ) : null;
}
