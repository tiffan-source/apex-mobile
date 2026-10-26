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
  `401` ; le client HTTP rejoue alors la requête une fois, et seulement avec un jeton de sa propre
  session. Plusieurs requêtes refusées en même temps ne renouvellent qu'une fois ; un renouvellement en
  route ne sert jamais à la session suivante. Une réponse arrivée après une déconnexion est ignorée.
- **Seul un refus du serveur ferme la session** (`401` ou `400` au renouvellement) : l'écran de connexion
  dit qu'elle a pris fin. Sans réseau, serveur indisponible (`5xx`) ou trop de demandes (`429`), elle
  reste ouverte, et le renouvellement suivant attend quelques secondes.
- **Une horloge d'appareil en avance ne fait pas renouveler à chaque requête** : un jeton tout juste
  renouvelé sert une minute, et le serveur dit (`401`) quand il ne vaut plus.
- **Les écritures du coffre se suivent** : une fermeture n'est jamais suivie d'une écriture plus ancienne
  qui ferait revivre la session au lancement suivant.
- **Fermer la session emporte tout ce qui lui appartenait** : le cache de TanStack Query, la file
  d'écritures, la surveillance d'Akari, la note en cours. Les clés du cache portent la personne.
- **Les préférences** (le thème) vont dans AsyncStorage : rien de secret.

## Conséquences

- L'écran de lancement reste tant que la session retenue n'est pas relue : ni éclair de la connexion, ni
  éclair d'un autre thème.
- L'aperçu web garde la session dans le stockage de l'onglet (`secure-token-store.web.ts`), pour le
  développement seulement.
