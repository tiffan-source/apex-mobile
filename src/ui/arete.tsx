import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { type CSSAnimationProperties } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';
import {
  detailEtape,
  etapesAffichees,
  lignesTete,
  resumeArete,
  type EtapeArete,
} from '@empreinte-studio/noyau';
import {
  COURBE_PLI,
  EPas,
  ETexte,
  ETrame,
  FONDU,
  creerStyles,
  police,
  useMouvementReduit,
  useSceau,
  useTheme,
  type CouleursEmpreinte,
} from '@empreinte-studio/react-native';
import { cornes, durees, pas, traits } from './fondations';

/*
 * L'arête d'Empreinte (`e-arete`, le diagramme d'Ishikawa), dressée pour un téléphone. Sur le web, la colonne
 * court de gauche à droite jusqu'à la tête ; ici, elle descend et finit dans la tête, le sceau de l'objectif. Les
 * étapes sont indépendantes : leur place sur la colonne ne dit aucun ordre. Chaque étape est une arête à 45° qui
 * remonte vers la queue, comme les arêtes du web reculent depuis la colonne ; son nom se lit au bout, en toutes
 * lettres, sans être coupé.
 *
 * La tête est le seul grand sceau de l'écran. Au-delà de 8 étapes, les étapes faites se replient dans une seule
 * arête « Faites » (`etapesAffichees`, règle partagée avec le web). À remonter dans Empreinte.
 */

/** Une étape de l'arête, avec l'id qui permet de la retrouver quand on la choisit. */
export type EtapeAreteApex = EtapeArete & { readonly id?: string };

/** La colonne, à 12 points du bord ; chaque arête monte de 36 points vers la droite jusqu'à sa borne. */
const COLONNE_X = 12;
const LONGUEUR = 36;
const BORNE = 8;
/** La borne s'aligne sur la première ligne du nom (20 d'interligne). */
const BOUT_Y = 10;
const RETRAIT_TEXTE = COLONNE_X + LONGUEUR + BORNE / 2 + pas['pas-3'];
const HAUTEUR_ETAPE = BOUT_Y + LONGUEUR + pas['pas-3'];
const CARACTERES_TETE = 24;

const DEPLIER: CSSAnimationProperties = {
  animationName: {
    from: { opacity: 0, transform: [{ translateX: -12 }] },
    to: { opacity: 1, transform: [{ translateX: 0 }] },
  },
  animationDuration: durees.deplier,
  animationTimingFunction: COURBE_PLI,
  animationFillMode: 'both',
};

const useStyles = creerStyles(({ couleurs }) => ({
  arete: {
    alignSelf: 'stretch',
  },
  etape: {
    minHeight: HAUTEUR_ETAPE,
    paddingLeft: RETRAIT_TEXTE,
    paddingRight: pas['pas-2'],
    paddingBottom: pas['pas-3'],
    justifyContent: 'flex-start',
  },
  etapeVue: {
    backgroundColor: couleurs.creux,
  },
  dessin: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  colonne: {
    position: 'absolute',
    pointerEvents: 'none',
    left: COLONNE_X - traits['trait-net'] / 2,
    top: 0,
    bottom: 0,
    width: traits['trait-net'],
    backgroundColor: couleurs.encre,
  },
  nom: {
    fontFamily: police('structure', 600),
    fontSize: 15,
    lineHeight: 20,
  },
  tete: {
    alignSelf: 'flex-start',
    minWidth: 180,
    maxWidth: 300,
    gap: pas['pas-1'],
    paddingVertical: pas['pas-4'],
    paddingLeft: pas['pas-4'],
    paddingRight: pas['pas-6'],
  },
  teteTexte: {
    fontFamily: police('sens', 600),
    fontSize: 18,
    lineHeight: 24,
  },
  queue: {
    height: pas['pas-3'],
  },
  legende: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: pas['pas-4'],
    rowGap: pas['pas-1'],
  },
  legendeElement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pas['pas-2'],
  },
  legendeCase: {
    width: 12,
  },
}));

function trait(faite: boolean, c: CouleursEmpreinte): { couleur: string; epaisseur: number } {
  if (faite) return { couleur: c.encre, epaisseur: traits['trait-net'] };
  return { couleur: c['trame-forte'], epaisseur: traits['trait-icone'] };
}

/** L'arête d'une étape et sa borne, tracées depuis la colonne. */
function Branche({ faite }: { readonly faite: boolean }) {
  const { couleurs } = useTheme();
  const styles = useStyles();
  const { couleur, epaisseur } = trait(faite, couleurs);
  const xBout = COLONNE_X + LONGUEUR;
  const largeur = xBout + BORNE;
  const hauteur = BOUT_Y + LONGUEUR + 1;
  return (
    <Svg width={largeur} height={hauteur} style={styles.dessin} aria-hidden>
      <Line
        x1={COLONNE_X}
        y1={BOUT_Y + LONGUEUR}
        x2={xBout}
        y2={BOUT_Y}
        stroke={couleur}
        strokeWidth={epaisseur}
        strokeLinecap="square"
      />
      <Rect
        x={xBout - BORNE / 2}
        y={BOUT_Y - BORNE / 2}
        width={BORNE}
        height={BORNE}
        fill={faite ? couleurs.encre : couleurs.panneau}
        stroke={couleur}
        strokeWidth={traits['trait-icone']}
      />
    </Svg>
  );
}

export type ProprietesArete = {
  /** Le nom de l'objectif, écrit dans la tête. Deux lignes au plus. */
  readonly objectif: string;
  /** Les étapes, sans ordre entre elles : leur place sur la colonne ne dit rien. */
  readonly etapes: readonly EtapeAreteApex[];
  /** Le repère au-dessus du nom de l'objectif. */
  readonly repere?: string;
  /** Les étapes s'ouvrent quand on les touche. */
  readonly interactive?: boolean;
  /** L'étape ouverte à côté de l'arête : elle est marquée. */
  readonly choisie?: string | null;
  readonly onChoisir?: (etape: EtapeAreteApex) => void;
  readonly testID?: string;
};

export function Arete({
  objectif,
  etapes,
  repere = 'OBJECTIF',
  interactive = false,
  choisie = null,
  onChoisir,
  testID,
}: ProprietesArete) {
  const styles = useStyles();
  const { couleurs } = useTheme();
  const reduit = useMouvementReduit();
  useSceau("tête de l'arête");

  const affichees = etapesAffichees(etapes) as readonly EtapeAreteApex[];

  // Une arête ajoutée (par Akari, par une feuille) se déplie depuis la colonne ; les autres restent immobiles.
  const [vues, setVues] = useState(affichees.length);
  const [neuvesDepuis, setNeuvesDepuis] = useState(Number.POSITIVE_INFINITY);
  if (affichees.length !== vues) {
    if (affichees.length > vues) setNeuvesDepuis(vues);
    setVues(affichees.length);
  }

  return (
    <View style={styles.arete} testID={testID}>
      <View>
        {affichees.length > 0 ? <View style={styles.queue} /> : null}
        {affichees.map((etape, index) => {
          const detail = detailEtape(etape);
          const vue = choisie !== null && etape.id === choisie;
          const animation = index >= neuvesDepuis ? (reduit ? FONDU : DEPLIER) : null;
          const contenu = (
            <>
              <Branche faite={etape.faite} />
              <ETexte style={styles.nom} numberOfLines={2}>
                {etape.nom}
              </ETexte>
              <ETexte variante="detail" couleur="encre-douce" numberOfLines={2}>
                {detail}
              </ETexte>
            </>
          );
          return (
            <Animated.View key={etape.id ?? `faites-${index}`} style={animation}>
              {interactive ? (
                <Pressable
                  role="button"
                  aria-label={`${etape.nom} : ${detail}`}
                  aria-selected={vue}
                  onPress={() => onChoisir?.(etape)}
                  style={({ pressed }) => [styles.etape, (vue || pressed) && styles.etapeVue]}
                  testID={testID ? `${testID}-etape-${index}` : undefined}
                >
                  {contenu}
                </Pressable>
              ) : (
                <View accessible aria-label={`${etape.nom} : ${detail}`} style={styles.etape}>
                  {contenu}
                </View>
              )}
            </Animated.View>
          );
        })}
        {affichees.length > 0 ? <View style={styles.colonne} /> : null}
      </View>
      <View accessible role="img" aria-label={resumeArete(objectif, etapes)} style={styles.tete}>
        <ETrame fond={couleurs.sceau} corne={cornes['corne-m']} />
        <ETexte variante="repere" couleur="sur-sceau">
          {repere}
        </ETexte>
        {lignesTete(objectif, CARACTERES_TETE).map((ligne, index) => (
          <ETexte key={index} couleur="sur-sceau" style={styles.teteTexte} maxFontSizeMultiplier={1.4}>
            {ligne}
          </ETexte>
        ))}
      </View>
    </View>
  );
}

/** La légende de l'arête, avec les cases d'`EPas` : faite, à faire. */
export function LegendeArete() {
  const styles = useStyles();
  const elements = [
    { cle: 'faite', libelle: 'Faite', pas: { faits: 1 } },
    { cle: 'a-faire', libelle: 'À faire', pas: { aFaire: 1 } },
  ] as const;
  return (
    <View style={styles.legende}>
      {elements.map((element) => (
        <View key={element.cle} style={styles.legendeElement}>
          <View style={styles.legendeCase} aria-hidden>
            <EPas {...element.pas} legende="" />
          </View>
          <ETexte variante="detail" couleur="encre-douce">
            {element.libelle}
          </ETexte>
        </View>
      ))}
    </View>
  );
}
