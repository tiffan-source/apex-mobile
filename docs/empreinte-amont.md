# Ce qui vit dans Empreinte, ce qui reste ici

Depuis la 0.5, Empreinte React Native porte tout ce qu'Apex mobile avait composé en attendant (ADR 0006). Un
composant qu'une autre application de la suite réutiliserait va dans Empreinte ; la mise en page d'Apex reste
ici.

## Dans Empreinte

| Composant                                         | Équivalent web d'Empreinte                   | Ce qu'il fait sur un téléphone                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EFeuille`                                        | `e-feuille`                                  | Feuille posée par le bas sur un voile, titre qui reçoit le lecteur d'écran, actions en pied, clavier évité, gardien du sceau.                                        |
| `EDeroulant`, `EElementDeroulant`, `mesurerAncre` | `e-menu`, `e-liste-options`                  | La superposition qui se déplie depuis un bouton : mesurée avant d'être montrée, posée dessous ou dessus selon la place, fermée par un toucher ailleurs ou le retour. |
| `EMenu`                                           | `e-menu`                                     | Un bouton à icône qui ouvre des actions ; le lecteur se pose sur la première.                                                                                        |
| `ESelection`                                      | `e-selection`                                | Un champ qui déplie ses options.                                                                                                                                     |
| `EFiltres`                                        | `e-filtres`                                  | Une rangée de filtres qui défile en bord perdu ; le filtre actif porte la corne.                                                                                     |
| `EBarreOnglets`                                   | `e-onglets`, `ELienNav`                      | Des onglets en bas d'écran ; l'onglet courant est un panneau à corne et rabat.                                                                                       |
| `EQuadrants`                                      | `e-matrice`                                  | La vue d'ensemble d'une matrice : quatre panneaux dans une trame d'encre, le panneau ouvert à corne.                                                                 |
| `EArete`, `ELegendeArete`                         | `e-arete`, `ul[eLegendeArete]`               | L'arête dressée, et sa légende.                                                                                                                                      |
| `EFil`, `EJournal`, `EComposeur`                  | `e-conversation`, `ol[eFil]`, `ol[eJournal]` | Le fil des répliques, le journal d'un tour d'Akari, la zone de réponse.                                                                                              |
| `EProse` (`/prose`)                               | `eMarkdown`, `.e-replique__prose`            | Le Markdown d'une réplique en textes d'Empreinte.                                                                                                                    |
| `ERepli`                                          | `details[eRepli]`                            | Un titre qui déplie ce qu'il cache, filets haut et bas, chevron, état annoncé.                                                                                       |
| `EFilAriane`                                      | `nav[eFilAriane]`                            | D'où l'on vient, en détail et en encre douce, liens soulignés.                                                                                                       |
| `EChampDate` (`/champ-date`)                      | `input[type=date][eSaisie]`                  | Une date dans un `EChamp` : le calendrier du téléphone, accordé au thème.                                                                                            |
| `EListeChoix`                                     | aucun (`e-menu` avec une coche)              | Un choix parmi quelques valeurs, sur un panneau.                                                                                                                     |
| `EInitiale`                                       | `e-initiale`                                 | L'initiale de la personne, décorative.                                                                                                                               |
| `ECarteObjectif`                                  | `article[eCarteObjectif]`                    | La carte d'un objectif : horizon, nom, pourquoi, progression, action.                                                                                                |
| `poserLeLecteurSur`, `useZonesSures`              | aucun                                        | Poser VoiceOver ou TalkBack sur un élément ; les zones sûres de l'écran.                                                                                             |

## Ce qui reste dans Apex

`Ecran`, `EnTete`, `Panneau`/`EnRetrait`/`Trame`, `Bandeau` et `Signalement` composent les écrans d'Apex : ses
marges, sa gouttière, la place de sa note et de son bandeau. Selon les consignes d'Empreinte, la mise en page
d'une application n'y monte jamais.

## Ce qui peut encore monter, dans le noyau

- **La typographie française** : `domain/shared/typography.ts` pose les espaces insécables avant « ? »,
  « ! », « : », « ; » et dans les guillemets. Toute la suite écrit en français : un `typographier()` du
  noyau servirait aussi au web, qui écrit ses insécables à la main dans les gabarits.
- **La voix** : `motsAEviter()` ne voit pas les mots qui commencent par une lettre accentuée (« échec »,
  « raté », « manqué ») et ne connaît ni « erreur » ni les emoji ; Apex le complète avec `voiceIssues`
  (`domain/shared/voice.ts`), comme le client web.
