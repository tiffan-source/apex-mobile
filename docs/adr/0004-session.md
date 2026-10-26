# ADR 0004 — La session dans le coffre de l'appareil

- Statut : accepté
- Date : 2026-10-25

## Contexte

Apex Brain est sans état (son ADR 0003) : la connexion rend un jeton d'accès, un jeton de
renouvellement et une échéance ; chaque requête porte `Authorization: Bearer` ; un `401` dit que le jeton
ne vaut plus. Sur un téléphone, on ne se reconnecte pas à chaque lancement.

## Décision

- **La session est gardée dans le coffre de l'appareil** (`expo-secure-store` : trousseau d'iOS,
  Keystore d'Android), lisible après le premier déverrouillage, jamais migrée vers un autre appareil.
  La personne y est gardée aussi : l'écran s'affiche sans attendre le réseau.
- **`SessionManager` la retrouve au lancement**, la renouvelle une minute avant son échéance, ou après un
  `401` ; le client HTTP rejoue alors la requête une fois. Plusieurs requêtes refusées en même temps ne
  renouvellent qu'une fois. Une réponse arrivée après une déconnexion est ignorée.
- **Un renouvellement refusé ferme la session** : l'écran de connexion dit que la session a pris fin.
- **Fermer la session emporte tout ce qui lui appartenait** : le cache de TanStack Query, la file
  d'écritures, la surveillance d'Akari, la note en cours. Les clés du cache portent la personne.
- **Les préférences** (le thème) vont dans AsyncStorage : rien de secret.

## Conséquences

- L'écran de lancement reste tant que la session retenue n'est pas relue : ni éclair de la connexion, ni
  éclair d'un autre thème.
- L'aperçu web garde la session dans le stockage de l'onglet (`secure-token-store.web.ts`), pour le
  développement seulement.
