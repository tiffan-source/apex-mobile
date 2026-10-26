import { collectTexts, voiceIssues } from '@/domain/shared/voice';
import { AKARI_SCREEN_TEXTS } from './akari/akari.texts';
import { AUTH_TEXTS } from './auth/auth.texts';
import { MATRIX_TEXTS } from './matrix/matrix.texts';
import { NEW_OBJECTIVE_TEXTS } from './new-objective/new-objective.texts';
import { OBJECTIVE_TEXTS } from './objective/objective.texts';
import { OBJECTIVES_TEXTS } from './objectives/objectives.texts';
import { SETTINGS_TEXTS } from './settings/settings.texts';
import { SHELL_TEXTS } from './shell/shell.texts';
import { SHEETS_TEXTS } from './sheets/sheets.texts';

/*
 * Chaque phrase des écrans parle comme Empreinte : tutoiement, phrases courtes, jamais « erreur », « échec »,
 * « supprimer », « en retard », de pourcentage, de point d'exclamation ni d'emoji. Les phrases construites
 * (« Ouvrir « … » ») sont vérifiées avec un exemple.
 */
const samples = [
  OBJECTIVES_TEXTS.openLabel('Courir un semi-marathon'),
  OBJECTIVE_TEXTS.arete(3),
  OBJECTIVE_TEXTS.stageMarker(2, 'en-cours'),
  OBJECTIVE_TEXTS.stageChosen(3, 'a-venir', 'Fractionné'),
  OBJECTIVE_TEXTS.editTaskLabel('Sortie de 30 minutes'),
  OBJECTIVE_TEXTS.looseHint(true),
  OBJECTIVE_TEXTS.looseHint(false),
  AKARI_SCREEN_TEXTS.summary("Jusqu'en mai", 4, 13),
  AKARI_SCREEN_TEXTS.stageTasks(2),
  AKARI_SCREEN_TEXTS.looseTasks(1),
  MATRIX_TEXTS.moveLabel('Sortie de 30 minutes'),
  MATRIX_TEXTS.filterChosen('Apprendre le piano', '1 pas'),
  SHEETS_TEXTS.task.quadrant('maintenant'),
  SETTINGS_TEXTS.version('0.1.0'),
];

const texts = [
  ...collectTexts([
    AKARI_SCREEN_TEXTS,
    AUTH_TEXTS,
    MATRIX_TEXTS,
    NEW_OBJECTIVE_TEXTS,
    OBJECTIVE_TEXTS,
    OBJECTIVES_TEXTS,
    SETTINGS_TEXTS,
    SHELL_TEXTS,
    SHEETS_TEXTS,
  ]),
  ...samples,
];

describe('La voix des écrans', () => {
  it.each(texts)('« %s » parle comme Empreinte', (text) => {
    expect(voiceIssues(text)).toEqual([]);
  });
});
