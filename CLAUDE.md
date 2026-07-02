# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local-first PWA (React + Vite + TypeScript) for tracking daily weight and meals (calories + PFC), built from the specs in `docs/`:

- `docs/ライフログアプリ_要件定義書.md` — requirements (goals, MVP scope, tech stack rationale)
- `docs/ライフログアプリ_画面設計書.md` — screen specs, data model, sync flow
- `docs/ライフログアプリ_デザインガイド.md` — color palette, typography, layout rules

Read these before making product/UX decisions — they're the source of truth, not this file.

## Commands

```
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # tsc -b && vite build (also generates the PWA service worker)
npm run test      # vitest run (all tests)
npx vitest run src/db/__tests__/weightRecords.test.ts   # single test file
npm run preview   # serve the production build (needed to inspect real PWA/install behavior)
```

`npm run lint` is defined in package.json but ESLint isn't actually installed/configured yet — don't rely on it.

There is no browser test runner wired into the repo. To visually verify UI changes, run `npm run dev` and drive it with Playwright (`npm install playwright` + `npx playwright install chromium` in a scratch dir) — there's no in-repo helper script for this.

## Workflow

Work is tracked as GitHub Issues, not a separate backlog doc — the repo's Issues tab is the source of truth for what's outstanding. Each issue links back to the relevant section of `docs/` (requirements/screen-design doc) it comes from.

- **File an issue before starting non-trivial work**, even when you're the only one working on it. It keeps `docs/` decisions traceable to the code that implements them, and gives later sessions (human or Claude) the "why" without re-reading the spec.
- Implement on a branch, verify with `npm run test` / `npm run build` and (for UI changes) a manual Playwright pass per the Commands section above.
- **Open a PR when the issue is done**, with the PR body referencing the issue (e.g. `Closes #6`) so merging auto-closes it. Don't merge straight to `main` without a PR — it's the record of what changed and why.

## Architecture

### Data layer (`src/db/`)

Dexie wraps IndexedDB. `db.ts` defines the schema; one file per entity (`weightRecords.ts`, `mealRecords.ts`, `settings.ts`) exports plain async CRUD functions — no repository classes, no ORM abstraction beyond Dexie itself.

Key modeling choices that aren't obvious from the types alone:
- **`WeightRecord` uses `date` (YYYY-MM-DD) as the Dexie primary key.** This is what makes "one record per day, last-write-wins" work automatically — `saveWeightRecord` just calls `.put()`, no manual overwrite logic needed.
- **`MealRecord` uses a generated UUID as its key**, since multiple entries per `mealType` per day are allowed (e.g. two snacks).
- **Every record has a `synced: boolean`.** `saveWeightRecord`/`updateWeightRecord`/`updateMealRecord` all reset it to `false` whenever the record's content changes, so edits after a sync are picked up again. Never hand-set `synced: true` outside of `markWeightRecordsSynced`/`markMealRecordsSynced`.
- **`getUnsyncedWeightRecords`/`getUnsyncedMealRecords` filter in JS (`.filter()`), not via a Dexie index** — IndexedDB can't index booleans as keys, and record counts here are small enough (single user, a handful of rows/day) that this is fine. Don't "optimize" this into an index.
- `getDailyCalorieTotals(startDate, endDate)` backfills every day in the range with `0kcal` even if there's no meal record — this is what makes the calorie trend chart show gaps instead of a misleadingly compressed line.

Tests use `fake-indexeddb/auto` (see `src/db/__tests__/setup.ts`, wired via `vitest.config.ts`'s `setupFiles`) so the whole data layer is tested in Node with no browser. `beforeEach` clears tables directly (`db.weightRecords.clear()` etc.) — there's no shared test-DB-reset helper, each test file clears what it uses.

### Sync engine (`src/sync/`)

`runSync()` (in `syncEngine.ts`) is transport-agnostic: it pulls unsynced records, calls `SyncTransport.push()`, and only marks records synced that the transport reports as succeeded (partial success is expected and handled). On any thrown error, nothing is marked synced and the error surfaces to the caller — that's the retry mechanism, there's no separate retry queue.

`notConfiguredTransport` is the current (default) transport — it always throws. **The actual Cloudflare Worker → Google Sheets integration hasn't been built yet.** To wire it up: implement `SyncTransport` (see `types.ts`) against the Worker endpoint, then swap the `transport` passed into `runSync()` in `App.tsx` (auto-sync on launch) and `Settings.tsx` (manual "今すぐ同期" button). Per `画面設計書` 7章, the target is the user's *existing* spreadsheet (already used as a manual DB substitute), not a new one.

### UI (`src/pages/`, `src/components/`)

Client state comes from `dexie-react-hooks`' `useLiveQuery`, not React state + manual refetching — pages re-render automatically when the underlying IndexedDB tables change.

**Gotcha:** `useLiveQuery` cannot distinguish "still loading" from "resolved to `undefined`". Since `.first()`/`.last()` on an empty Dexie table resolve to `undefined`, a query like `db.weightRecords.orderBy("date").first()` will make the component hang on its loading branch forever for a brand-new user with zero records — the query silently never signals completion. The fix used throughout this codebase is to coerce those results to `null` before returning them from the query function (see `Trends.tsx`), and only treat `undefined` as "not yet loaded". Apply the same pattern for any new `useLiveQuery` call whose query can legitimately resolve to "nothing found."

Charts (`WeightChart.tsx`, `CalorieChart.tsx`) are hand-rolled SVG, not a charting library — this is deliberate, to keep exact control over the design guide's palette rather than fighting a library's defaults.

### Design system constraint

`tailwind.config.js` registers the design guide's palette as named colors (`background`, `primary`, `secondary`, `accent`, `ink`, `muted`) and fonts (`font-rounded` = M PLUS Rounded 1c for numbers/headings, `font-body` = Noto Sans JP). **`accent` (yellow) is reserved for "moment of achievement" celebrations only** (goal reached, streak, etc.) per the design guide — it must not be used for static/always-visible UI like reference lines or badges. Chart target/goal lines use muted gray for exactly this reason; don't change them to accent without re-reading the design guide's rationale.

### PWA

`vite-plugin-pwa` (see `vite.config.ts`) generates the manifest and service worker at build time — nothing to maintain by hand except icons (`public/icons/`, generated once from the design guide's primary color, not hand-drawn).

### Deployment

Hosted on Cloudflare Workers (Git-integrated, not the classic separate "Pages" product) at https://lifelog.tatu1228.workers.dev/, auto-deploying from `main` on push. Build command `npm run build`, deploy command `npx wrangler deploy`, driven by `wrangler.toml`'s `[assets]` block (`directory = "dist"`, `not_found_handling = "single-page-application"` for SPA routing).

**Don't add a `public/_redirects` file** — combining it with `not_found_handling = "single-page-application"` makes Cloudflare reject the deploy as an infinite redirect loop (both try to handle the SPA fallback). The `[assets]` config alone is sufficient and is what's currently deployed.

`npm run deploy` runs the same build+deploy locally, but requires `wrangler login` first (not set up in this sandboxed dev environment — assume it isn't authenticated unless told otherwise).
