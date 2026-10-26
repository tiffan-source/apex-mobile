# ADR 0005 — L'interface : Empreinte d'abord, des compositions à remonter

- Statut : accepté
- Date : 2026-10-25

## Contexte

Il n'existe pas de maquette native d'Apex. Le client web suit les maquettes d'Empreinte et son cahier
de migration (vocabulaire, voix, un sceau par écran, une corne par groupe, aucune erreur en rouge).
Empreinte React Native 0.3.1 fournit les fondations et une partie des composants ; il lui manque les
superpositions (feuille, menu, sélection), les onglets, les filtres, la matrice, l'arête dressée, la
conversation et le fil d'Ariane. Le mobile ne doit pas ressembler au web à l'identique, mais partager
son style avec le web sur un petit écran.

## Décision

- **Les composants d'Empreinte d'abord**, réglés par leurs propriétés ; les couleurs par le thème (Jour,
  Nuit), les espacements, filets et cornes par les tokens ; une police par graisse, jamais
  `fontWeight` ; aucune couleur en dur.
- **Ce qui manque est composé dans `src/ui`**, dans la langue d'Empreinte et sur ses primitives
  (`ETrame`, `creerStyles`, tokens, mouvement réduit), sans rien savoir d'Apex : ces compositions sont
  des candidates à Empreinte ([`../empreinte-amont.md`](../empreinte-amont.md)). La mise en page d'Apex
  (`Ecran`, `EnTete`, panneaux) reste dans Apex.
- **Le petit écran du web comme référence** : une colonne, une gouttière de 16 points, les actions sous
  le titre, la matrice en vue d'ensemble, les feuilles posées par le bas, la navigation en onglets
  (Objectifs, Matrice) avec les réglages dans le bandeau.
- **Les textes d'un écran sont dans une table** (`*.texts.ts`), vérifiée par le test de voix et
  composée par `typesetTexts` (espaces insécables de la typographie française). Le message d'une erreur
  du serveur n'est jamais montré.
- **L'accessibilité est une exigence d'écran** : rôle et nom de chaque élément touchable, cibles de 44
  points, états annoncés, lecteur posé sur ce qui s'ouvre, réussites annoncées, texte agrandi borné.

## Conséquences

- Quand Empreinte publiera ces composants, ils remplaceront ceux de `src/ui` sans toucher aux écrans
  plus que leurs imports et quelques propriétés.
- Les écrans se vérifient en Jour et en Nuit, à 375 points, avec le texte agrandi.
