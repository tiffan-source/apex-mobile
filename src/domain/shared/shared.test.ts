import { formatLongDate, formatToday, isBeforeToday, msUntilMidnight, startOfDay, toApiDate } from './dates';
import { CLIENT_ERRORS, FailureError, isConnectivityFailure, ok, unwrap, fail } from './result';
import { CRUMB_TITLE_MAX, FILTER_TITLE_MAX, distinctShortTitles, firstName, shortTitle } from './titles';
import { NBSP, keepTogether, quoted, typeset, typesetTexts } from './typography';
import { voiceIssues } from './voice';

describe('shortTitle et distinctShortTitles (comme le client web)', () => {
  it('garde un titre court tel quel, coupe un titre long au dernier mot entier', () => {
    expect(shortTitle('  Licence  ', FILTER_TITLE_MAX)).toBe('Licence');
    expect(
      shortTitle('Préparer et courir un semi-marathon avant la fin du mois de mai', CRUMB_TITLE_MAX),
    ).toBe('Préparer et courir un…');
    expect(shortTitle('Courir un semi-marathon en mai', FILTER_TITLE_MAX)).toBe('Courir un semi-marathon…');
    expect(shortTitle('Licence, master et doctorat en trois ans', 12)).toBe('Licence…');
    expect(shortTitle('a'.repeat(40), 10)).toBe(`${'a'.repeat(9)}…`);
  });

  it('départage deux titres coupés au même endroit par leurs derniers mots', () => {
    const labels = distinctShortTitles(
      ["Préparer le concours d'entrée 2027", "Préparer le concours d'entrée 2028", 'Licence'],
      FILTER_TITLE_MAX,
    );
    expect(labels).toEqual(['Préparer le… 2027', 'Préparer le… 2028', 'Licence']);
  });

  it("signe d'un prénom, jamais d'une adresse", () => {
    expect(firstName('Anlyou Zohoun', 'Toi')).toBe('Anlyou');
    expect(firstName('anlyou@exemple.fr', 'Toi')).toBe('Toi');
    expect(firstName('  ', 'Toi')).toBe('Toi');
    expect(firstName(null, 'Toi')).toBe('Toi');
  });
});

describe('dates', () => {
  it('écrit le repère du jour et une date en toutes lettres', () => {
    expect(formatToday(new Date(2026, 9, 19))).toBe('Lundi 19 octobre');
    expect(formatLongDate(new Date(2027, 5, 1))).toBe('1er juin 2027');
    expect(formatLongDate(new Date(2027, 5, 12))).toBe('12 juin 2027');
  });

  it("envoie une échéance comme l'instant de son minuit local", () => {
    const date = new Date(2027, 3, 1, 18, 45);
    expect(toApiDate(date)).toBe(new Date(2027, 3, 1).toISOString());
    expect(startOfDay(date).getHours()).toBe(0);
  });

  it('compare au jour près, et sait quand vient minuit', () => {
    const now = new Date(2026, 9, 19, 23, 0);
    expect(isBeforeToday(new Date(2026, 9, 18, 23, 59), now)).toBe(true);
    expect(isBeforeToday(new Date(2026, 9, 19, 0, 0), now)).toBe(false);
    expect(msUntilMidnight(now)).toBe(60 * 60 * 1000);
  });
});

describe('résultats', () => {
  it('déballe un succès, lève une FailureError sur un échec', () => {
    expect(unwrap(ok(3))).toBe(3);
    expect(() => unwrap(fail({ code: 'TASK_NOT_FOUND', message: 'nope' }))).toThrow(FailureError);
    expect(isConnectivityFailure({ code: CLIENT_ERRORS.timeout, message: '' })).toBe(true);
    expect(isConnectivityFailure({ code: 'TASK_NOT_FOUND', message: '' })).toBe(false);
  });
});

describe('voiceIssues', () => {
  it('relève ce que la voix évite, accents compris', () => {
    expect(voiceIssues('Une erreur est survenue !')).toEqual(
      expect.arrayContaining(['erreur', "point d'exclamation"]),
    );
    expect(voiceIssues('Échec de la connexion')).toContain('échec');
    expect(voiceIssues('Tâche supprimée')).toContain('supprimer');
    expect(voiceIssues('Il te reste 43 %')).toContain('pourcentage');
    expect(voiceIssues("Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.")).toEqual(
      [],
    );
  });
});

describe('la typographie française', () => {
  it('lie les signes doubles et les guillemets au mot qu’ils ponctuent', () => {
    expect(typeset('Pour quand ?')).toBe(`Pour quand${NBSP}?`);
    expect(typeset('Par exemple : Endurance ; ou Bases')).toBe(
      `Par exemple${NBSP}: Endurance${NBSP}; ou Bases`,
    );
    expect(typeset('Ce pas passe dans « À planifier ».')).toBe(
      `Ce pas passe dans «${NBSP}À planifier${NBSP}».`,
    );
  });

  it('ne touche ni aux autres espaces, ni à un texte déjà composé', () => {
    expect(typeset('4 pas faits · 3 à venir')).toBe('4 pas faits · 3 à venir');
    expect(typeset('https://apex.example/objectifs')).toBe('https://apex.example/objectifs');
    expect(typeset(typeset('On commence ?'))).toBe(typeset('On commence ?'));
  });

  it('met un texte entre guillemets français, et garde un nom court d’un seul tenant', () => {
    expect(quoted('Courir un semi-marathon')).toBe(`«${NBSP}Courir un semi-marathon${NBSP}»`);
    expect(keepTogether('À laisser filer')).toBe(`À${NBSP}laisser${NBSP}filer`);
  });

  it('compose une table de textes, jusqu’aux phrases que ses fonctions écrivent', () => {
    const texts = typesetTexts({
      question: 'Pour quand ?',
      choices: [{ value: 'jour', label: 'Thème : Jour' }],
      nested: { hint: 'Range-les avec « Modifier ».' },
      moveLabel: (title: string) => `Déplacer « ${title} » vers…`,
    });
    expect(texts.question).toBe(`Pour quand${NBSP}?`);
    expect(texts.choices).toEqual([{ value: 'jour', label: `Thème${NBSP}: Jour` }]);
    expect(texts.nested.hint).toBe(`Range-les avec «${NBSP}Modifier${NBSP}».`);
    expect(texts.moveLabel('Réviser')).toBe(`Déplacer «${NBSP}Réviser${NBSP}» vers…`);
  });
});
