# Fitness PWA — PROJECT.md

Personal fitness Progressive Web App for молд, installed to the iPhone Home Screen.
Read this file first before continuing work.

## Goals
- Generate a sensible weekly strength plan from goal, experience, days/week, session length and available equipment.
- Run workouts in the gym: looping exercise demos, log sets/reps/weight, rest timer.
- Track history and progress; apply progressive overload automatically.
- **$0 and open source only.** No backend, no cloud DB, no paid APIs. All data stays on the device (IndexedDB); JSON export/import for backup.
- Works fully offline once installed. No medical advice in app copy.

## Stack
- Vite + TypeScript + Preact, plain CSS (mobile-first, safe-area insets, dark-first with `prefers-color-scheme`, tap targets ≥ 44px).
- IndexedDB via Dexie.
- vite-plugin-pwa (Workbox `generateSW`, auto-update) + web app manifest + Apple meta tags + apple-touch-icon.
- Vitest (+ fake-indexeddb) for unit tests; Playwright (chromium, iPhone 390×844 @3x) for a smoke check.
- Exercise data: curated subset of [free-exercise-db](https://github.com/yuhonas/free-exercise-db) bundled into the app.

### Commands
- `npm run dev` / `npm run build` / `npm run preview`
- `npx vitest run` — unit tests
- `node tests/e2e/smoke.mjs` — Playwright smoke test against `npm run preview` (writes screenshots to /workspace/fitness-shots/)
- `npm run curate` — re-download + re-curate exercises and images (reproducible; cached in `.cache/`)
- `npm run icons` — regenerate PNG icons
- `BASE_PATH=/repo-name/ npm run build` — build for a GitHub Pages subpath (default base is `/`).

## Decisions
- **Exercise data is static and bundled** (`src/data/exercises.json`, imported by the app) rather than copied into a Dexie table: it ships with each app version, needs no migration, and is precached by the service worker. Dexie stores only user data.
- Curation (`scripts/curate-exercises.mjs`) holds a hand-picked list of ids with app-specific tags: movement `pattern`, `role` (main/secondary/accessory), `equipment` required (all must be available; bodyweight = none), `skill` 1–3 and derived `loadType`. Images are resized to max 400px wide WebP (q70) → ~2.1 MB for 202 frames.
- Equipment keys: barbell, dumbbell, kettlebell, cable, machine, bands, pullupBar, bench. Bodyweight is always available.
- Generator is a pure, deterministic module (`src/generator.ts`) using a seeded PRNG (mulberry32). Splits: 2–3 days full body, 4 upper/lower, 5 push/pull/legs + upper/lower, 6 PPL×2.
- Exercise count per day comes from a session-length table adjusted by goal, then sets are trimmed (never below 2) and, if still needed, exercises dropped (never below 2) until the estimated duration (sets × (work + rest) + 1 min setup per exercise) fits the session length.
- If no exercise for a movement pattern exists with the chosen equipment, the generator substitutes a related pattern (e.g. vertical ↔ horizontal pull) or skips the slot and adds a note to the plan.
- Sessions have a `type` discriminator (`'strength'` now; `'run' | 'ride'` reserved with optional `distanceM`/`durationSec`).
- Weights are stored in the user's chosen unit as entered (`unit` stored on each set) — no silent conversion.
- An in-progress workout is persisted to the settings table so a reload/app switch does not lose it.
- Rest timer is timestamp-based (survives backgrounding); on finish calls `navigator.vibrate` (no-op on iOS Safari) and a short Web Audio beep (AudioContext is unlocked on the set-check tap; the iOS silent switch mutes it).

## Feature backlog
1. **Workout generator** — done (v0.1).
2. **Workout player** — looping demos, set/rep/weight logging, rest timer with vibration and sound — done (v0.1 basic).
3. **History** — list + detail — done (v0.1 basic).
4. **Progressive overload (double progression)**: when all sets hit the top of the rep range, add the smallest load step next time; if the target is missed twice in a row, hold, or deload ~10%.
5. **Progress dashboard**: volume, Epley e1RM (`w × (1 + r/30)`, helper already in `src/stats.ts`), per-lift SVG charts.
- Later: running, cycling (session types `run`/`ride`), Strava import/sync.

## Known bugs / limitations
- iOS Safari ignores `navigator.vibrate`; the rest-finished beep is muted by the iPhone silent switch, and timers pause while the PWA is backgrounded (the timer is timestamp-based, so it shows the right time on return, but the alert fires only when the app is foregrounded).
- Plans with very limited equipment (bodyweight only) have no true vertical pull; the plan shows a note and substitutes related movements (e.g. Superman).
- Exercise demos are two still frames from free-exercise-db, not video.
- Incomplete (unchecked) sets are not saved with a session.

## Attribution
Exercise names, instructions and images: **free-exercise-db** by yuhonas — https://github.com/yuhonas/free-exercise-db — released into the public domain (Unlicense). Images resized/re-encoded to WebP. Credit is also shown on the Settings → About screen.

## Changelog
- 0.1.0 (2026-10-26): first slice.
  - Scaffold: Vite 8 + Preact + TypeScript, vite-plugin-pwa (manifest, Workbox precache incl. all exercise images, auto-update), Apple meta tags, generated PNG icons (180/192/512 + maskable), configurable `BASE_PATH`.
  - Exercise data: 101 curated free-exercise-db exercises (all major patterns; barbell, dumbbell, kettlebell, cable, machine, bands, bodyweight, pull-up bar, bench) with 2 WebP frames each; reproducible `npm run curate`.
  - Dexie data model: settings (profile, current plan id, in-progress workout draft), plans, sessions (`type` discriminator), sets; JSON export/import (Settings screen; uses the iOS share sheet when available).
  - Deterministic workout generator (seeded) with splits by days/week, equipment filtering, pattern substitution, goal-based prescriptions, session-length fitting.
  - UI: chip-based onboarding, plan view with looping two-frame thumbnails, bottom tab bar (Plan / History / Progress placeholder / Settings with About + credits).
  - Workout player: large looping demo, per-set weight/reps logging with weight carry-forward and last-used weight prefill, set check → auto rest timer (+15s / Skip; vibrate + Web Audio beep at the end), add set, how-to instructions, draft survives reload, Finish saves session + completed sets.
  - History: session list (date, day, exercises, sets, volume) and detail view.
  - Tests: Vitest (generator, storage + export/import round-trip with fake-indexeddb, workout state, stats) and Playwright iPhone smoke test (`npm run smoke`).
