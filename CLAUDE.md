# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Apex mobile is the iOS and Android client of Apex (objectives → stages → steps, an Eisenhower matrix,
the Akari AI assistant). It reproduces Apex V1 (the Angular web client, repo `tiffan-source/apex`) in
**React Native with Expo SDK 58** (React Native 0.88, React 19.3, TypeScript 6, Expo Router), talks to
**Apex Brain** (repo `tiffan-source/apex-brain`, NestJS REST API) and draws with **Empreinte React
Native** (`@empreinte-studio/react-native`). Code is in English, except the UI compositions in
`src/ui`, which use Empreinte's French API; **docs, comments, UI copy and commit messages are in
French** — match that.

Read `docs/architecture.md` (layers, data flow, session, UI), `docs/plan.md` (parity with the web, what's
left) and `docs/empreinte-amont.md` before larger changes. Decisions live in `docs/adr/`.

## Commands

| Task                                                                  | Command                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Install (needs a GitHub token with `read:packages`)                   | `NODE_AUTH_TOKEN=… npm install`                              |
| Dev server (Expo Go, simulator, emulator)                             | `npm start`                                                  |
| Web preview (dev only, Apex Brain must allow `http://localhost:8081`) | `npm run web`                                                |
| Everything CI checks                                                  | `npm run verifier`                                           |
| Lint / types / format                                                 | `npm run lint`, `npm run typecheck`, `npm run format:check`  |
| Tests (all, or one file)                                              | `npm test`, `npx jest src/features/matrix`                   |
| iOS + Android bundles                                                 | `npm run export`                                             |
| Regenerate the API types                                              | `npm run api:types` (from `openapi/apex-brain.openapi.json`) |

- `npm run typecheck` first generates typed routes (`expo customize tsconfig.json` writes
  `.expo/types/router.d.ts` and `expo-env.d.ts`, both ignored), so hrefs are checked.
- `@empreinte-studio/*` come from GitHub Packages (`.npmrc` reads `NODE_AUTH_TOKEN`). The lockfile entries
  of these three packages have no `resolved`/`integrity` yet: the first install with a token fills them.
- Apex Brain runs on port 3000 (`npx nx serve api`). The API URL is `EXPO_PUBLIC_APEX_API_URL`, or in dev
  the Metro host on port 3000 (`src/infrastructure/config/api-url.ts`); production requires the variable.

## Architecture

Layers in `src/`, enforced by `no-restricted-imports` in `eslint.config.js`:

- `domain/` — Apex rules in plain TypeScript (objectives tree, card/arête/matrix views, Eisenhower, forms,
  Akari conversation, voice, dates, typography). No React, Expo, TanStack Query or Empreinte rendering
  (`@empreinte-studio/noyau` only).
- `application/` — services and ports: `SessionManager`, `ObjectiveCommands` (optimistic gestures),
  `WriteQueue`, `ObjectivesLoader`, `AkariWritesWatcher`, `AnnouncementCenter`; ports in `ports/`.
- `infrastructure/` — adapters: `openapi-fetch` client with token refresh and one replay on `401`,
  `http-*-gateway.ts`, `expo-secure-store` token store, AsyncStorage preferences, screen-reader announcer.
- `state/` — TanStack Query (keys carry the user id), hooks over the services, theme, current day.
- `ui/` — compositions on Empreinte with a French API (`Feuille`, `Menu`, `Selection`, `Quadrants`,
  `Arete`, `Fil`, `Prose`…). They know nothing of Apex (no `domain` import): upstream candidates.
- `features/` — screens, one folder per feature, copy in `*.texts.ts` (wrapped in `typesetTexts`).
- `app/` — Expo Router routes; each only renders a screen. `(app)` is protected by `Stack.Protected`;
  `(onglets)` holds the two tabs; sheets are `transparentModal` routes.
- `composition/` — the composition root (`assembleServices`), used by production and tests alike.

Reads go through TanStack Query (one flat snapshot of objectives per user); **writes never use
`useMutation`**: they go through `ObjectiveCommands` → `WriteQueue`, as in the web client's stores — one
at a time, each reconciled inside its queued operation (temporary id linked to the real id, cache fixed)
before the next one starts. A rollback restores what the server accepted (`PendingChanges`: the state
before the first pending gesture plus accepted changes), never a refused gesture's value. Reads queued
with `read()` don't count as gestures. `WriteQueue.close()` at sign-out drops what is still waiting, and
a late response of a closed session reconciles and reports nothing. Only a server refusal (401/400 on
refresh) ends the session; transient failures keep it. No toasts: `announcements.announce()` for screen readers, `announcements.report()` for
the Akari note shown at the top of screens. Never show a server error message; map its code to a French
sentence (`domain/objectives/messages.ts`, `domain/session/auth.ts`).

## Conventions

- Empreinte first: `ETexte` variants, `ETrame`/`ESurface`, `EBouton` (one `sceau` per screen), colors from
  `useTheme()` (Jour/Nuit), spacing/rules/corners from tokens (`src/ui/fondations.ts`), one font per weight
  via `police()` (never `fontWeight`), no hard-coded color, no rounded corner, reduced-motion fallback.
- Voice: _tu_, short sentences, never « erreur », « échec », « succès », « supprimer », « en retard »,
  percentages, exclamation marks or emoji; `src/features/voice.test.ts` checks every text table. Write
  plain spaces in copy: `typesetTexts`/`typeset` add the French non-breaking spaces.
- Accessibility: role and name on every pressable, 44pt targets, `aria-selected`/`aria-expanded`/
  `aria-checked`, focus moved to what opens (`poserLeLecteurSur`), successes announced.
- Tests: domain/application/infrastructure run once ("Règles"); ui/state/features/app run as iOS then as
  Android. Screen tests render real routes with real services on in-memory doubles
  (`src/testing/test-app.tsx`). RNTL 14: `render` and `fireEvent` are async — always `await`; keep the
  fake timers `renderRouter` enables (`findBy*`/`waitFor` advance them). `jest.setup.ts` mocks AsyncStorage,
  native measurements and the date picker.
