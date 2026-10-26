# Fitness PWA — PROJECT.md

**Live:** https://jmoldovan3-lab.github.io/fitness-app/ · **Repo:** https://github.com/jmoldovan3-lab/fitness-app (public)

Personal fitness Progressive Web App for молд, installed to the iPhone Home Screen.
Read this file first before continuing work.

## Goals
- Build a sensible workout **for today's session** (focus, optional target muscles, length, equipment) from saved defaults (goal, experience, equipment, units); edit it (swap / remove / reorder / add / regenerate) before starting.
- Run workouts in the gym: looping exercise demos, log sets/reps/weight, rest timer.
- Track history and progress; apply progressive overload automatically.
- **$0 and open source only.** No backend, no cloud DB, no paid APIs. All data stays on the device (IndexedDB); JSON export/import for backup.
- Works fully offline once installed. No medical advice in app copy.

## Stack
- Vite + TypeScript + Preact, plain CSS (mobile-first, safe-area insets, dark-first with `prefers-color-scheme`, tap targets ≥ 44px).
- IndexedDB via Dexie.
- vite-plugin-pwa (Workbox `generateSW`, auto-update) + web app manifest + Apple meta tags + apple-touch-icon.
- Vitest (+ fake-indexeddb) for unit tests; Playwright (chromium, iPhone 390×844 @3x) for a smoke check.
- Exercise data: the full [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (873 exercises with images) bundled into the app.

### Commands
- `npm run dev` / `npm run build` / `npm run preview`
- `npx vitest run` — unit tests
- `node tests/e2e/smoke.mjs` — Playwright smoke test against `npm run preview` (writes screenshots to /workspace/fitness-shots/)
- `npm run curate` — re-download + re-import all exercises and images (reproducible; cached in `.cache/`; `WEBP_Q`/`WEBP_W` override quality/width)
- `npm run icons` — regenerate PNG icons
- `BASE_PATH=/repo-name/ npm run build` — build for a GitHub Pages subpath (default base is `/`).
- `SMOKE_URL=https://jmoldovan3-lab.github.io/fitness-app/ node tests/e2e/smoke.mjs` — run the smoke test against the live site (no local server). Use `SHOTS_DIR=/workspace/fitness-shots/live` so live screenshots don't overwrite local ones.
- Deploy: push to `main` → GitHub Actions builds and publishes to Pages (or run the workflow manually: `gh workflow run deploy.yml`).

## Decisions
- **Per-session builder, no weekly plan (v0.2).** The Workout tab always opens on "Today's workout". The profile (goal, experience, usual length, equipment, units) is set once in onboarding and editable in Settings → Workout defaults; it only pre-fills the builder. Builder inputs: focus (Full body / Upper / Lower / Push / Pull / Legs / Core), optional multi-select target muscles, length (20/30/45/60/75/90), equipment for today. The built workout is saved in `settings.todayWorkout` so a reload keeps it; a built workout from a previous day is discarded on open. Finish clears it. An in-progress workout (`settings.activeWorkout`) shows a **Resume** card on home instead of the builder; the player has a "‹ Home" button and Discard at the bottom.
- **Focus suggestion** (`suggestFocus`): looks at the last 2 sessions within 4 days, maps each exercise's first primary muscle to a region (push / pull / legs / core), weights the latest session 1 and the one before 0.5, and pre-selects the focus whose regions are least loaded (order: full, upper, lower, push, pull, legs; ties skip the last session's focus so full body isn't suggested twice in a row). Core is never suggested. The reason is shown under the focus chips (★ marks the suggested chip).
- **Single-session generator** (`src/generator.ts`, pure, seeded mulberry32): target-muscle slots first (one per muscle, then a second accessory round if room), then the focus template's pattern slots with related-pattern substitution, then top-up within the focus. Pool = `gen` exercises doable with today's equipment and ≤ experience skill. Scoring: slot-role match, load-type preference (barbell > dumbbell > … for compounds), +3 for hand-featured staples, beginner skill penalty, seeded jitter. Exercise count from a goal × length table, then `fitToTime` trims sets (min 2) and exercises (min 2). Editing helpers (swap/remove/move/add) are pure functions; swap keeps the slot role and re-prescribes. Swap alternatives: same pattern or overlapping primary muscle, doable with the workout's equipment, ranked same pattern > same main muscle > generator-eligible > featured.
- **Exercise data is static and bundled** (`src/data/exercises.json`, 873 entries, ~0.9 MB → 167 KB gzip, emitted as its own `exercises-*.js` chunk so app-code updates don't re-download it). Dexie stores only user data.
- **Full free-exercise-db import** (`scripts/curate-exercises.mjs`): all 876 exercises except 3 without images (Kettlebell_Halo, Kettlebell_Halo_With_Overhead_Extension, Kettlebell_Overhead_Triceps_Extension). All 7 categories are in the library. Tags are derived per exercise: movement `pattern` from primary muscle + force/mechanic + name keywords; `role` (compound barbell big-pattern lifts = main, other compounds = secondary, isolation = accessory); required `equipment` keys (dataset equipment mapped; "bench/incline/decline/preacher" free-weight moves add `bench`; pull-up/chin-up/hanging/dip bodyweight moves add `pullupBar`); `skill` from level. The 101 hand-curated v0.1 picks are kept as `FEATURED` overrides (their tags win, marked `featured`).
- **Generator eligibility (`gen`)**: categories strength, powerlifting, plyometrics (as conditioning) only, excluding equipment "other"/foam roller, stretches/cardio, and technical or special-kit lifts by name (clean, snatch, jerk, chains, board/pin press, atlas…). Stretching, cardio, strongman and olympic weightlifting are library-only. 574 of 873 are generator-eligible. Featured overrides are always eligible (incl. Split Squats and Superman, which the dataset files under stretching).
- Equipment keys: barbell (incl. EZ-bar), dumbbell, kettlebell, cable, machine, bands, pullupBar ("Pull-up / dip bar"), bench, medicineBall, stabilityBall, plus library-only foamRoller and other. Bodyweight is always available.
- **Images**: both frames, 320px wide WebP q70 (effort 6) → **12.09 MB** for 1,746 frames (~7 KB each). Not precached. The service worker serves `/exercises/*.webp` **CacheFirst** from the `exercise-images` cache; the page fills the same cache (`src/offline.ts`): eagerly for every exercise in a built workout (on build / edit / start / app open), and on demand via Settings → **Download all exercise demos for offline** (6 parallel fetches, progress bar, skips already-cached, reports failures). Precache = app shell + exercise JSON chunk + icons (~1.1 MB).
- **Demos**: two stacked frames; the top frame runs a CSS opacity keyframe animation (`demo-xfade`, 1.8s, ease-in-out, hold ~0.2s on frame A and ~0.36s on frame B) — compositor-only, so smooth 60fps and cheap. A shared IntersectionObserver adds `.playing` only to on-screen demos (others `animation-play-state: paused`). `prefers-reduced-motion: reduce` shows the first frame only. Custom cartoon-style animations would need new art for 800+ exercises; out of scope for $0 — the crossfade is the cheap 60fps upgrade.
- **Library tab**: search (case-insensitive, multi-word, name + primary muscle, prefix matches rank first) and native-select filters (muscle incl. secondary, equipment incl. Bodyweight, category); pure `src/library.ts`. The list is paginated (40 rows, next page auto-loads via IntersectionObserver near the bottom + a Show more button) with `content-visibility: auto` rows. Detail: large demo, category/equipment, primary/secondary muscles, dataset instructions, "Add to today's workout" (creates a workout if none is built yet).
- Tab bar: Workout / Library / History / Progress / Settings (5 tabs, 78×60 px targets at 390 px wide).
- **Dexie v2 migration**: `version(2).stores({ plans: null })` deletes the old plans table; the upgrade removes `settings.currentPlanId` and normalises an out-of-range `sessionMinutes` to 45. Profile, sessions, sets and an in-progress draft are kept (v0.1 drafts have the same shape). Export format v2 has no `plans`; import accepts v1 files (plans ignored, `currentPlanId` dropped).
- Sessions have a `type` discriminator (`'strength'` now; `'run' | 'ride'` reserved with optional `distanceM`/`durationSec`); strength sessions now store `focus` and the title in `dayName`.
- Weights are stored in the user's chosen unit as entered (`unit` stored on each set) — no silent conversion.
- Rest timer is timestamp-based (survives backgrounding); on finish calls `navigator.vibrate` (no-op on iOS Safari) and a short Web Audio beep (AudioContext is unlocked on the set-check tap; the iOS silent switch mutes it).
- **Hosting: GitHub Pages (free) via GitHub Actions.** Public repo `jmoldovan3-lab/fitness-app`, default branch `main`, Pages `build_type=workflow`. `.github/workflows/deploy.yml` on push to `main` (and manual dispatch): `npm ci` → `npx vitest run` → `npm run build` with `BASE_PATH=/fitness-app/` (read by `vite.config.ts` as `base`, also used for manifest `start_url`/`scope`) → `upload-pages-artifact` (dist) → `deploy-pages`. Tests failing blocks the deploy. No paid features enabled.
- Asset URLs in code go through `asset()` (`import.meta.env.BASE_URL`) so the app works under the `/fitness-app/` subpath.

## Feature backlog
1. **Workout builder** (per session) — done (v0.2). Weekly plans removed.
2. **Workout player** — demos, set/rep/weight logging, rest timer with vibration and sound — done (v0.1).
3. **History** — list + detail — done (v0.1).
4. **Exercise library** — full free-exercise-db, search/filter/detail, add to workout, offline download — done (v0.2).
5. **Progressive overload (double progression)**: when all sets hit the top of the rep range, add the smallest load step next time; if the target is missed twice in a row, hold, or deload ~10%.
6. **Progress dashboard**: volume, Epley e1RM (`w × (1 + r/30)`, helper already in `src/stats.ts`), per-lift SVG charts.
7. Builder polish: save favourite builder presets; "repeat last workout"; edit sets/reps/rest per exercise before starting; drag-to-reorder.
8. Library polish: "only what I have" equipment toggle; favourites; spot-check/curate derived tags for non-featured exercises.
- Later: running, cycling (session types `run`/`ride`), Strava import/sync.

## Known bugs / limitations
- iOS Safari ignores `navigator.vibrate`; the rest-finished beep is muted by the iPhone silent switch, and timers pause while the PWA is backgrounded (the timer is timestamp-based, so it shows the right time on return, but the alert fires only when the app is foregrounded).
- Bodyweight-only sessions have few true vertical pulls (need a bar); the workout shows a note and substitutes related movements.
- Exercise demos are two frames from free-exercise-db crossfaded, not video or true animation.
- Tags for non-featured exercises are derived heuristically (pattern/role/equipment) and may be off for odd entries; the generator prefers the 101 featured staples. Dips are mapped to the pull-up/dip bar.
- Download all uses ~12 MB of the browser's storage; iOS may evict PWA storage if the app is unused for weeks (images re-download when online).
- Incomplete (unchecked) sets are not saved with a session.

## Attribution
Exercise names, instructions and images: **free-exercise-db** by yuhonas — https://github.com/yuhonas/free-exercise-db — released into the public domain (Unlicense). All 873 exercises with images are included; images resized to 320px and re-encoded to WebP. Credit is also shown on the Settings → About screen.

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
- 0.1.1 (2026-10-26): deployed.
  - GitHub Pages deploy workflow (`.github/workflows/deploy.yml`); live at https://jmoldovan3-lab.github.io/fitness-app/.
  - Verified live: index, `manifest.webmanifest`, `sw.js`, icons and exercise WebP images all 200 under `/fitness-app/`; full Playwright smoke (iPhone 390×844) passes against the live URL, incl. service worker + offline reload.
  - Smoke test accepts `SMOKE_URL` to test a deployed site; branch renamed `master` → `main`; `.gitignore` covers Playwright artifacts.
- 0.2.0 (2026-10-26): per-session builder + full library.
  - Home is "Today's workout": focus chips (with history-based ★ suggestion), optional target muscles, length 20–90, equipment override → Build → list with demos, sets × reps, rest; swap (bottom sheet of alternatives), remove, move up/down, add from library, Regenerate → Start → player → Finish → history. Resume card for an in-progress workout. Weekly plan UI and the Plan tab removed.
  - Single-session generator (pure, seeded) replaces the weekly plan generator; profile defaults editable in Settings.
  - Full free-exercise-db: 873 exercises (574 generator-eligible), 1,746 WebP frames at 320px = 12.09 MB; library tab with search, muscle/equipment/category filters, paginated list, detail with instructions and add-to-workout.
  - Images runtime-cached (CacheFirst); built workouts cached eagerly; Settings → Download all exercise demos for offline (progress bar). Precache is app shell + exercise JSON only.
  - Smooth 1.8s ease-in-out crossfade demos (CSS opacity), paused off-screen, static with reduced motion.
  - Dexie v2 migration (drops plans; keeps profile, sessions, sets, draft); export v2, imports v1.
  - Tests: 71 Vitest tests (session generator: focus/equipment filtering, length scaling, focus suggestion, swap, determinism; library search/filter; migration; storage; workout state); iPhone smoke covers builder → build → regenerate → swap → reorder/remove → library search/filter/detail/add → player → rest → finish → history → suggestion → download all → offline.
