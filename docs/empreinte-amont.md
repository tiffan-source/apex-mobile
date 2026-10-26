# Ce qui pourrait remonter dans Empreinte

Empreinte React Native 0.3.1 publie les fondations (thème, polices, `ETexte`, `ETrame`, `ESurface`,
icônes, gardien du sceau) et les composants `EBouton`, `EEtiquette`, `EMarque`, `ECarte`, `EPas`,
`EEmpreinte`, `ECase`, `EChamp`/`ESaisie`, `EListe`/`ETache`, `ENote`. Le kit CSS et les composants
Angular d'Empreinte en ont davantage : ce qu'Apex mobile en a eu besoin est composé dans `src/ui`, dans
la langue d'Empreinte (noms et propriétés en français, `creerStyles`, `ETrame`, tokens seulement, un
repli pour le mouvement réduit, chaque test comme sur iOS puis comme sur Android), pour pouvoir y
remonter sans être réécrit.

Selon les consignes d'Empreinte, seul ce que toute la suite réutiliserait y monte : jamais la mise en
page d'Apex. `Ecran`, `EnTete`, `Panneau`/`Trame`, `Bandeau` et `Signalement` composent les écrans
d'Apex et restent ici.

## Les composants

| `src/ui`                                                          | Équivalent web d'Empreinte                         | Ce que fait la version React Native                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feuille.tsx` — `Feuille`                                         | `e-feuille`                                        | Feuille posée par le bas sur un voile, titre en `objectif` qui reçoit le lecteur d'écran, bouton de fermeture, actions en pied, clavier évité, gardien du sceau.                                                                                   |
| `deroulant.tsx` — `Deroulant`, `ElementDeroulant`, `mesurerAncre` | `e-menu`, `e-liste-options`                        | La superposition qui se déplie depuis un bouton : mesurée avant d'être montrée, posée dessous ou dessus selon la place, largeur des entrées (200 à 360) ou du champ, ombre `ombre-feuille`, fermée par un toucher ailleurs ou le retour d'Android. |
| `menu.tsx` — `Menu`                                               | `e-menu`                                           | Un bouton à icône qui ouvre des actions (`menuitem`) ; le lecteur se pose sur la première.                                                                                                                                                         |
| `selection.tsx` — `Selection`                                     | `e-selection`                                      | Un champ qui déplie ses options (`radio`, coche en deux traits droits sur l'option choisie).                                                                                                                                                       |
| `filtres.tsx` — `Filtres`                                         | `e-filtres`                                        | Une rangée de filtres qui défile en bord perdu ; le filtre actif porte la corne.                                                                                                                                                                   |
| `barre-onglets.tsx` — `BarreOnglets`                              | `e-onglets`, `ELienNav`                            | Des onglets en bas d'écran ; l'onglet courant est un panneau à corne et rabat.                                                                                                                                                                     |
| `quadrants.tsx` — `Quadrants`                                     | `e-matrice`                                        | La vue d'ensemble d'une matrice sur un téléphone : quatre panneaux dans une trame d'encre, axes en repère (ceux des rangées tournés), le panneau ouvert à corne.                                                                                   |
| `arete.tsx` — `Arete`, `LegendeArete`                             | `e-arete`                                          | L'arête dressée : bornes reliées à une colonne, la tête en sceau dessous, repli « Faites » au-delà de 8 étapes (`etapesAffichees` du noyau), étape choisie marquée, légende en cases d'`EPas`.                                                     |
| `fil.tsx` — `Fil`                                                 | `e-conversation`, `ol[eFil]`, `li[eReplique]`      | Le fil des répliques : signature (losange d'Akari), voix ou corps selon qui parle, deux actions au plus, ligne d'état dite aux lecteurs d'écran, les nouvelles répliques se déplient.                                                              |
| `composeur.tsx` — `Composeur`                                     | `e-conversation` (zone de réponse)                 | La zone de réponse : saisie de 1 à 6 lignes et bouton d'envoi ; le texte revient s'il n'est pas parti.                                                                                                                                             |
| `prose.tsx` — `Prose`                                             | `.e-replique__prose`                               | Le Markdown d'une réplique en textes d'Empreinte : titres à la taille du texte, pas d'italique, puces carrées, liens soulignés (http, https, mailto), code qui défile, rien qui se charge seul.                                                    |
| `repli.tsx` — `Repli`                                             | aucun (le web note l'absence d'un repli générique) | Un titre qui déplie ce qu'il cache, filets haut et bas, chevron, état annoncé.                                                                                                                                                                     |
| `fil-ariane.tsx` — `FilAriane`                                    | `e-fil-ariane`                                     | D'où l'on vient, en détail et en encre douce, liens soulignés.                                                                                                                                                                                     |
| `champ-date.tsx` — `ChampDate`                                    | aucun                                              | Une date dans un `EChamp` : écrite en toutes lettres, calendrier du téléphone accordé au thème (déplié sous le champ sur iOS, boîte de dialogue sur Android), bouton nu pour la retirer.                                                           |
| `liste-choix.tsx` — `ListeChoix`                                  | aucun (`e-menu` avec `menuitemradio`)              | Un choix parmi quelques valeurs, sur un panneau (le thème des réglages).                                                                                                                                                                           |

## Dans le noyau

- **La typographie française** : `domain/shared/typography.ts` pose les espaces insécables avant « ? »,
  « ! », « : », « ; » et dans les guillemets. Toute la suite écrit en français : un `typographier()` du
  noyau servirait aussi au web, qui écrit ses insécables à la main dans les gabarits.
- **La voix** : `motsAEviter()` ne voit pas les mots qui commencent par une lettre accentuée (« échec »,
  « raté », « manqué ») et ne connaît ni « erreur » ni les emoji ; Apex le complète avec `voiceIssues`
  (`domain/shared/voice.ts`), comme le client web.

## Ce qu'il faudrait dans les fondations

- **Une superposition** (le `Deroulant`) : feuilles, menus et sélections en dépendent. Elle pose la
  question de la mesure (`measureInWindow`) et de la couche (`Modal`) une fois pour toutes.
- **Poser le lecteur d'écran** sur un élément (`ui/accessibilite.ts`) : `sendAccessibilityEvent` n'existe
  pas dans React Native Web ; les composants qui ouvrent quelque chose en ont tous besoin.
