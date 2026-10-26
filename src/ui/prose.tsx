import { Fragment, useMemo, type ReactNode } from 'react';
import { Linking, ScrollView, Text, View, type TextStyle } from 'react-native';
import { Lexer, type Token, type Tokens } from 'marked';
import {
  AGRANDISSEMENT_MAXIMAL,
  ETexte,
  POLICE_CODE,
  creerStyles,
  police,
  styleTexte,
  useTheme,
  type CouleursEmpreinte,
} from '@empreinte-studio/react-native';
import { pas, traits } from './fondations';

/*
 * La prose d'une réplique : le Markdown d'un message rendu en textes d'Empreinte, avec les règles de la prose
 * du web (`.e-replique__prose`) et du rendu d'Apex (`markdown.pipe.ts`) :
 * - la typographie reste celle de la réplique : un titre garde la taille du texte, en semi-gras ;
 * - pas d'italique : *mot* et _mot_ restent du texte droit ; un mot sur lequel on insiste passe en semi-gras ;
 * - les puces sont carrées ; un lien garde l'encre du texte, souligné comme un bouton nu, et s'ouvre dans le
 *   navigateur (http, https, mailto seulement) ;
 * - rien ne se charge tout seul : une image devient un lien vers elle ; le HTML écrit dans le texte est retiré,
 *   son texte gardé ;
 * - un retour à la ligne simple est gardé.
 */

/** La voix de la réplique : Akari parle en « voix », la personne en « corps ». */
export type VoixProse = 'voix' | 'corps';

const LIENS_OUVRABLES = /^(https?:|mailto:)/i;

/** Les entités HTML que le Markdown laisse dans le texte. */
const ENTITES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

export function decoderEntites(texte: string): string {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entite, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X'))
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITES[code.toLowerCase()] ?? entite;
  });
}

/** Le texte d'un morceau de HTML, sans ses balises. */
function sansBalises(html: string): string {
  return decoderEntites(html.replace(/<[^>]*>/g, ''));
}

const useStyles = creerStyles(({ couleurs }) => ({
  prose: {
    gap: pas['pas-3'],
  },
  liste: {
    gap: pas['pas-1'],
  },
  element: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: pas['pas-3'],
  },
  contenuElement: {
    flex: 1,
    minWidth: 0,
    gap: pas['pas-1'],
  },
  puce: {
    width: 6,
    height: 6,
    backgroundColor: couleurs.encre,
  },
  citation: {
    paddingLeft: pas['pas-4'],
    borderLeftWidth: traits['trait-net'],
    borderLeftColor: couleurs.trame,
    gap: pas['pas-3'],
  },
  filet: {
    height: traits['trait-fin'],
    backgroundColor: couleurs.trame,
  },
  blocCode: {
    backgroundColor: couleurs.creux,
  },
  blocCodeContenu: {
    paddingVertical: pas['pas-3'],
    paddingHorizontal: pas['pas-4'],
  },
  texteCode: {
    fontFamily: POLICE_CODE,
    fontSize: 14,
    lineHeight: 20,
    color: couleurs.encre,
  },
  tableau: {
    borderTopWidth: traits['trait-fin'],
    borderTopColor: couleurs.trame,
  },
  ligneTableau: {
    paddingVertical: pas['pas-2'],
    borderBottomWidth: traits['trait-fin'],
    borderBottomColor: couleurs.trame,
  },
}));

type Contexte = {
  readonly base: TextStyle;
  readonly fort: TextStyle;
  readonly couleurs: CouleursEmpreinte;
  readonly couleurTexte: string;
  readonly styles: ReturnType<typeof useStyles>;
  readonly selectionnable: boolean;
  readonly agrandissement: number;
};

function ouvrir(adresse: string): void {
  if (LIENS_OUVRABLES.test(adresse)) void Linking.openURL(adresse).catch(() => undefined);
}

/** Les éléments d'une ligne : texte, insistance, code, liens. */
function enLigne(jetons: readonly Token[] | undefined, ctx: Contexte, cle: string): ReactNode[] {
  return (jetons ?? []).map((jeton, index) => {
    const k = `${cle}-${index}`;
    switch (jeton.type) {
      case 'text': {
        const texte = jeton as Tokens.Text;
        return texte.tokens ? (
          <Fragment key={k}>{enLigne(texte.tokens, ctx, k)}</Fragment>
        ) : (
          <Fragment key={k}>{decoderEntites(texte.text)}</Fragment>
        );
      }
      case 'escape':
        return <Fragment key={k}>{decoderEntites((jeton as Tokens.Escape).text)}</Fragment>;
      case 'strong':
        return (
          <Text key={k} style={ctx.fort}>
            {enLigne((jeton as Tokens.Strong).tokens, ctx, k)}
          </Text>
        );
      case 'em':
      case 'del':
        return <Fragment key={k}>{enLigne((jeton as Tokens.Em).tokens, ctx, k)}</Fragment>;
      case 'codespan':
        return (
          <Text
            key={k}
            style={[
              ctx.styles.texteCode,
              { fontSize: (ctx.base.fontSize ?? 16) * 0.875, backgroundColor: ctx.couleurs.creux },
            ]}
          >
            {` ${decoderEntites((jeton as Tokens.Codespan).text)} `}
          </Text>
        );
      case 'br':
        return <Fragment key={k}>{'\n'}</Fragment>;
      case 'link': {
        const lien = jeton as Tokens.Link;
        return (
          <Text
            key={k}
            role="link"
            onPress={() => ouvrir(lien.href)}
            style={{ textDecorationLine: 'underline', textDecorationColor: ctx.couleurTexte }}
          >
            {enLigne(lien.tokens, ctx, k)}
          </Text>
        );
      }
      case 'image': {
        const image = jeton as Tokens.Image;
        return (
          <Text
            key={k}
            role="link"
            onPress={() => ouvrir(image.href)}
            style={{ textDecorationLine: 'underline', textDecorationColor: ctx.couleurTexte }}
          >
            {decoderEntites(image.text || image.href)}
          </Text>
        );
      }
      case 'html':
        return <Fragment key={k}>{sansBalises((jeton as Tokens.HTML).text)}</Fragment>;
      default:
        return 'text' in jeton && typeof jeton.text === 'string' ? (
          <Fragment key={k}>{decoderEntites(jeton.text)}</Fragment>
        ) : null;
    }
  });
}

/** Un paragraphe : un seul texte, qu'on peut sélectionner pour le copier. */
function Paragraphe({ ctx, enfants, fort = false }: { ctx: Contexte; enfants: ReactNode; fort?: boolean }) {
  return (
    <Text
      selectable={ctx.selectionnable}
      maxFontSizeMultiplier={ctx.agrandissement}
      style={[ctx.base, { color: ctx.couleurTexte }, fort && ctx.fort]}
    >
      {enfants}
    </Text>
  );
}

/** Les blocs : paragraphes, titres, listes, citations, code, tableaux. */
function enBlocs(jetons: readonly Token[], ctx: Contexte, cle: string): ReactNode[] {
  const blocs: ReactNode[] = [];
  jetons.forEach((jeton, index) => {
    const k = `${cle}-${index}`;
    switch (jeton.type) {
      case 'space':
      case 'def':
      case 'checkbox':
        return;
      case 'paragraph':
        blocs.push(
          <Paragraphe key={k} ctx={ctx} enfants={enLigne((jeton as Tokens.Paragraph).tokens, ctx, k)} />,
        );
        return;
      case 'heading':
        blocs.push(
          <Paragraphe key={k} ctx={ctx} fort enfants={enLigne((jeton as Tokens.Heading).tokens, ctx, k)} />,
        );
        return;
      case 'text': {
        const texte = jeton as Tokens.Text;
        blocs.push(
          <Paragraphe
            key={k}
            ctx={ctx}
            enfants={texte.tokens ? enLigne(texte.tokens, ctx, k) : decoderEntites(texte.text)}
          />,
        );
        return;
      }
      case 'list': {
        const liste = jeton as Tokens.List;
        const depart = typeof liste.start === 'number' ? liste.start : 1;
        blocs.push(
          <View key={k} style={ctx.styles.liste}>
            {liste.items.map((element, rang) => (
              <View key={`${k}-${rang}`} style={ctx.styles.element}>
                {liste.ordered ? (
                  <Text style={[ctx.base, { color: ctx.couleurTexte }]}>{`${depart + rang}.`}</Text>
                ) : (
                  <View
                    style={[
                      ctx.styles.puce,
                      { marginTop: ((ctx.base.lineHeight ?? 24) - 6) / 2, backgroundColor: ctx.couleurTexte },
                    ]}
                  />
                )}
                <View style={ctx.styles.contenuElement}>{enBlocs(element.tokens, ctx, `${k}-${rang}`)}</View>
              </View>
            ))}
          </View>,
        );
        return;
      }
      case 'blockquote':
        blocs.push(
          <View key={k} style={ctx.styles.citation}>
            {enBlocs(
              (jeton as Tokens.Blockquote).tokens,
              { ...ctx, couleurTexte: ctx.couleurs['encre-douce'] },
              k,
            )}
          </View>,
        );
        return;
      case 'hr':
        blocs.push(<View key={k} style={ctx.styles.filet} />);
        return;
      case 'code':
        blocs.push(
          <ScrollView
            key={k}
            horizontal
            style={ctx.styles.blocCode}
            contentContainerStyle={ctx.styles.blocCodeContenu}
          >
            <Text selectable={ctx.selectionnable} style={ctx.styles.texteCode}>
              {(jeton as Tokens.Code).text}
            </Text>
          </ScrollView>,
        );
        return;
      case 'table': {
        const tableau = jeton as Tokens.Table;
        const ligne = (cellules: readonly Tokens.TableCell[], entete: boolean, rang: number) => (
          <View key={`${k}-${rang}`} style={ctx.styles.ligneTableau}>
            <Text
              style={[
                styleTexte('detail'),
                { color: ctx.couleurTexte },
                entete && { fontFamily: police('structure', 600) },
              ]}
            >
              {cellules.map((cellule, colonne) => (
                <Fragment key={colonne}>
                  {colonne > 0 ? '  ·  ' : null}
                  {enLigne(cellule.tokens, ctx, `${k}-${rang}-${colonne}`)}
                </Fragment>
              ))}
            </Text>
          </View>
        );
        blocs.push(
          <View key={k} style={ctx.styles.tableau}>
            {ligne(tableau.header, true, 0)}
            {tableau.rows.map((rangee, rang) => ligne(rangee, false, rang + 1))}
          </View>,
        );
        return;
      }
      case 'html': {
        const texte = sansBalises((jeton as Tokens.HTML).text).trim();
        if (texte) blocs.push(<Paragraphe key={k} ctx={ctx} enfants={texte} />);
        return;
      }
      default:
        if ('tokens' in jeton && Array.isArray(jeton.tokens)) blocs.push(...enBlocs(jeton.tokens, ctx, k));
    }
  });
  return blocs;
}

/** Les jetons Markdown d'un texte (GFM, retours à la ligne gardés). */
export function lireMarkdown(texte: string): Token[] {
  return Lexer.lex(texte, { gfm: true, breaks: true });
}

export type ProprietesProse = {
  readonly texte: string;
  readonly voix?: VoixProse;
  /** En encre douce : une réplique qui part encore. */
  readonly douce?: boolean;
  readonly selectionnable?: boolean;
};

/** Un message en Markdown, dans la voix de qui parle. */
export function Prose({ texte, voix = 'corps', douce = false, selectionnable = true }: ProprietesProse) {
  const styles = useStyles();
  const { couleurs } = useTheme();
  const jetons = useMemo(() => lireMarkdown(texte), [texte]);
  const base = styleTexte(voix);
  const ctx: Contexte = {
    base,
    fort: { fontFamily: voix === 'voix' ? police('sens', 600) : police('structure', 600) },
    couleurs,
    couleurTexte: douce ? couleurs['encre-douce'] : couleurs.encre,
    styles,
    selectionnable,
    agrandissement: AGRANDISSEMENT_MAXIMAL[voix],
  };
  const blocs = enBlocs(jetons, ctx, 'prose');
  return (
    <View style={styles.prose}>
      {blocs.length > 0 ? (
        blocs
      ) : (
        <ETexte variante={voix} couleur={douce ? 'encre-douce' : 'encre'}>
          {texte}
        </ETexte>
      )}
    </View>
  );
}
