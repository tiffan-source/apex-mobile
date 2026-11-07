# ADR 0006 — Les compositions d'interface montent dans Empreinte

- Statut : accepté
- Date : 2026-11-04

## Contexte

L'ADR 0005 composait dans `src/ui` ce qui manquait à Empreinte React Native, pour pouvoir le remonter sans
le réécrire. Le client web comptait lui aussi, écrits dans ses écrans, des morceaux que toute la suite
réutiliserait : le repli « Accomplis », le journal d'Akari, la légende de l'arête, l'initiale, la carte
d'objectif. Une même chose existait donc en double, ou manquait à une plateforme.

## Décision

- **Ce qu'une autre application de la suite réutiliserait vit dans Empreinte** : les composants de `src/ui`
  ont rejoint `@empreinte-studio/react-native` 0.5, avec leurs tests et un spécimen dans la vitrine mobile.
  Ils prennent le préfixe `E` et gardent leur comportement dans Apex. Leur API s'élargit pour servir toute la
  suite :
  - `ERepli` : `ouvert` garde l'état avec `onOuvertChange` ; `ouvertAuDepart` dit ce que disait `ouvert`.
  - `EMenu` accepte des séparateurs, `EBarreOnglets` lit seul la zone sûre si `basSur` manque.
  - `EFiltres` (`gouttiere`), `EComposeur` (`retrait`, `style`), `EQuadrants` et `EFilAriane` (`libelle`)
    rendent réglable ce qu'Apex écrivait en dur.
  - `EtapeAreteApex` devient `EtapeAreteIdentifiee`.
  - `EProse` lit une image placée dans un lien par son texte, et ne plante plus sur une entité hors d'Unicode.
- **`src/ui` ne garde que la mise en page d'Apex** (`Ecran`, `EnTete`, `Panneau`, `Trame`, `Bandeau`,
  `Signalement`), selon la règle d'Empreinte : la mise en page d'une application reste dans l'application.
- **La carte d'un objectif** est `ECarteObjectif` : `objective-card.tsx` ne fait plus que relier le domaine
  à ses propriétés.
- **`EProse` et `EChampDate` ont leur propre point d'entrée** (`/prose`, `/champ-date`) : `marked` et le
  calendrier natif ne pèsent que sur l'application qui s'en sert.

## Conséquences

- Un composant générique qui manque se propose à Empreinte, puis une montée de version l'amène ici. On peut
  composer dans un écran en attendant, pas dans `src/ui`.
- Les menus et les sélections restent sur `Modal` et `measureInWindow` : @rn-primitives, prévu au départ, n'a
  pas été nécessaire. L'API ne changerait pas si un motif clavier le demandait un jour.
