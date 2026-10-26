// Pure, deterministic single-session workout generator. No I/O, no Date/Math.random.
import type {
  BuildInput, BuiltWorkout, Equipment, Exercise, Experience, Focus, Goal, Muscle, Pattern, PlannedExercise,
  Prescription, Role, SessionMinutes,
} from './types';

// ---------- seeded PRNG ----------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- prescriptions ----------
type Rx = Omit<Prescription, 'unit'>;
const RX: Record<Goal, Record<Role, Rx>> = {
  strength: {
    main: { sets: 5, repMin: 3, repMax: 5, restSec: 180 },
    secondary: { sets: 3, repMin: 5, repMax: 8, restSec: 120 },
    accessory: { sets: 3, repMin: 8, repMax: 12, restSec: 75 },
  },
  hypertrophy: {
    main: { sets: 4, repMin: 6, repMax: 10, restSec: 120 },
    secondary: { sets: 3, repMin: 8, repMax: 12, restSec: 90 },
    accessory: { sets: 3, repMin: 10, repMax: 15, restSec: 60 },
  },
  general: {
    main: { sets: 3, repMin: 8, repMax: 12, restSec: 90 },
    secondary: { sets: 3, repMin: 10, repMax: 12, restSec: 75 },
    accessory: { sets: 2, repMin: 12, repMax: 15, restSec: 60 },
  },
  conditioning: {
    main: { sets: 3, repMin: 12, repMax: 15, restSec: 60 },
    secondary: { sets: 3, repMin: 12, repMax: 15, restSec: 45 },
    accessory: { sets: 3, repMin: 15, repMax: 20, restSec: 30 },
  },
};
const TIMED: Record<string, [number, number]> = {
  Plank: [30, 60], Side_Bridge: [20, 45], Mountain_Climbers: [30, 45],
};
const SETS_DELTA: Record<Experience, number> = { beginner: -1, intermediate: 0, advanced: 1 };
export const MAX_SKILL: Record<Experience, number> = { beginner: 2, intermediate: 3, advanced: 3 };
const ROLE_RANK: Record<Role, number> = { main: 0, secondary: 1, accessory: 2 };

export function prescribe(goal: Goal, experience: Experience, slotRole: Role, ex: Exercise): Prescription {
  // An isolation exercise in a compound slot keeps its isolation prescription.
  const role = ROLE_RANK[ex.role] > ROLE_RANK[slotRole] ? ex.role : slotRole;
  // Bodyweight moves can't be loaded for low reps: use hypertrophy ranges for strength.
  const g: Goal = goal === 'strength' && ex.loadType === 'bodyweight' ? 'hypertrophy' : goal;
  const base = RX[g][role];
  const sets = Math.max(2, base.sets + (role === 'accessory' && experience !== 'advanced' ? 0 : SETS_DELTA[experience]));
  const timed = TIMED[ex.id] ?? (ex.force === 'static' && ex.pattern !== 'stretch' ? [20, 45] as [number, number] : undefined);
  if (timed) return { sets, repMin: timed[0], repMax: timed[1], unit: 'sec', restSec: Math.min(base.restSec, 60) };
  if (ex.pattern === 'stretch') return { sets: 1, repMin: 30, repMax: 30, unit: 'sec', restSec: 15 };
  return { sets, repMin: base.repMin, repMax: base.repMax, unit: 'reps', restSec: base.restSec };
}

/** Rough duration: per set, work (~3s/rep or the hold time) + rest; plus 1 min setup per exercise. */
export function estimateSeconds(items: Prescription[]): number {
  return items.reduce((sum, p) => {
    const work = p.unit === 'sec' ? p.repMax : p.repMax * 3;
    return sum + p.sets * (work + p.restSec) + 60;
  }, 0);
}

// ---------- focus templates ----------
type Slot = [Pattern, Role];
export const FOCUS_LABEL: Record<Focus, string> = {
  full: 'Full body', upper: 'Upper body', lower: 'Lower body', push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core',
};
const TEMPLATES: Record<Focus, Slot[]> = {
  full: [['squat', 'main'], ['hpush', 'main'], ['hpull', 'main'], ['hinge', 'secondary'], ['vpush', 'secondary'],
    ['vpull', 'secondary'], ['core', 'accessory'], ['lunge', 'secondary'], ['biceps', 'accessory'], ['triceps', 'accessory'],
    ['calves', 'accessory'], ['shoulders', 'accessory']],
  upper: [['hpush', 'main'], ['hpull', 'main'], ['vpush', 'secondary'], ['vpull', 'secondary'], ['hpush', 'accessory'],
    ['shoulders', 'accessory'], ['triceps', 'accessory'], ['biceps', 'accessory'], ['hpull', 'accessory'], ['core', 'accessory'],
    ['triceps', 'accessory'], ['biceps', 'accessory']],
  lower: [['squat', 'main'], ['hinge', 'secondary'], ['lunge', 'secondary'], ['hinge', 'accessory'], ['squat', 'accessory'],
    ['calves', 'accessory'], ['core', 'accessory'], ['core', 'accessory'], ['lunge', 'accessory'], ['calves', 'accessory']],
  push: [['hpush', 'main'], ['vpush', 'secondary'], ['hpush', 'secondary'], ['shoulders', 'accessory'], ['triceps', 'accessory'],
    ['hpush', 'accessory'], ['triceps', 'accessory'], ['shoulders', 'accessory'], ['vpush', 'accessory'], ['core', 'accessory']],
  pull: [['vpull', 'main'], ['hpull', 'main'], ['hpull', 'secondary'], ['hpull', 'accessory'], ['biceps', 'accessory'],
    ['vpull', 'accessory'], ['biceps', 'accessory'], ['core', 'accessory'], ['hinge', 'accessory'], ['biceps', 'accessory']],
  legs: [['squat', 'main'], ['hinge', 'main'], ['lunge', 'secondary'], ['squat', 'accessory'], ['hinge', 'accessory'],
    ['calves', 'accessory'], ['lunge', 'accessory'], ['calves', 'accessory'], ['squat', 'accessory'], ['hinge', 'accessory']],
  core: [['core', 'secondary'], ['core', 'accessory'], ['core', 'accessory'], ['core', 'accessory'], ['core', 'accessory'],
    ['core', 'accessory'], ['core', 'accessory'], ['core', 'accessory'], ['core', 'accessory'], ['core', 'accessory']],
};
/** Muscles each focus is meant to train (used for filtering checks and history suggestions). */
export const FOCUS_PATTERNS: Record<Focus, Pattern[]> = Object.fromEntries(
  (Object.keys(TEMPLATES) as Focus[]).map((f) => [f, [...new Set(TEMPLATES[f].map(([p]) => p))]]),
) as Record<Focus, Pattern[]>;

const COUNT: Record<Goal, Record<SessionMinutes, number>> = {
  strength: { 20: 2, 30: 3, 45: 4, 60: 5, 75: 6, 90: 7 },
  hypertrophy: { 20: 3, 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 },
  general: { 20: 3, 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 },
  conditioning: { 20: 4, 30: 5, 45: 6, 60: 7, 75: 8, 90: 9 },
};
export function targetExerciseCount(goal: Goal, minutes: SessionMinutes): number {
  return COUNT[goal][minutes] ?? COUNT[goal][45];
}

const SUBSTITUTE: Partial<Record<Pattern, Pattern[]>> = {
  vpull: ['hpull'], hpull: ['vpull'], vpush: ['hpush'], hpush: ['vpush'], lunge: ['squat'], squat: ['lunge'],
  hinge: ['lunge'], shoulders: ['vpush'], calves: ['lunge'], biceps: ['hpull'], triceps: ['hpush'],
};
const LOAD_PREF: Record<string, number> = { barbell: 6, dumbbell: 5, kettlebell: 4, machine: 3, cable: 3, band: 1, bodyweight: 2, other: 1 };

export function hasEquipment(e: Exercise, equipment: Equipment[]): boolean {
  const have = new Set(equipment);
  return e.equipment.every((q) => have.has(q));
}
export function availableExercises(all: Exercise[], equipment: Equipment[]): Exercise[] {
  return all.filter((e) => hasEquipment(e, equipment));
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  squat: 'squat', hinge: 'hinge', lunge: 'single-leg', hpush: 'horizontal push', vpush: 'vertical push',
  hpull: 'horizontal pull', vpull: 'vertical pull', core: 'core', biceps: 'biceps', triceps: 'triceps',
  shoulders: 'shoulder', calves: 'calf', conditioning: 'conditioning', other: 'other', stretch: 'stretch', cardio: 'cardio',
};

export function sessionTitle(focus: Focus, muscles: Muscle[]): string {
  const m = muscles.map((x) => x[0].toUpperCase() + x.slice(1));
  return m.length ? `${FOCUS_LABEL[focus]} · ${m.join(', ')}` : FOCUS_LABEL[focus];
}

/** Builds one workout for today's session. Same input (incl. seed) → same workout. */
export function generateSession(input: BuildInput, exercises: Exercise[], createdAt = 0): BuiltWorkout {
  const { focus, muscles, minutes, equipment, goal, experience, seed } = input;
  const rand = mulberry32(seed);
  const pool = exercises.filter((e) => e.gen && hasEquipment(e, equipment) && e.skill <= MAX_SKILL[experience]);
  const used = new Set<string>();
  const missing = new Set<Pattern>();
  const chosen: PlannedExercise[] = [];
  const target = targetExerciseCount(goal, minutes);

  const best = (cands: Exercise[], role: Role): Exercise | undefined => {
    if (!cands.length) return undefined;
    const scored = cands.map((e) => {
      let score = 0;
      if (e.role === role) score += 10;
      else if (role === 'main' && e.role === 'secondary') score += 6;
      else if (role === 'secondary' && e.role === 'main') score += 5;
      else if (role === 'accessory' && e.role === 'secondary') score += 2;
      if (role !== 'accessory') score += LOAD_PREF[e.loadType] * (goal === 'strength' ? 1 : 0.8);
      if (e.featured) score += 3;
      if (experience === 'beginner') score -= (e.skill - 1) * 3;
      if (experience === 'advanced') score += e.skill - 1;
      score += rand() * 4;
      return { e, score };
    });
    scored.sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
    return scored[0].e;
  };
  const add = (ex: Exercise | undefined, role: Role) => {
    if (!ex) return;
    used.add(ex.id);
    chosen.push({ exerciseId: ex.id, pattern: ex.pattern, role, ...prescribe(goal, experience, role, ex) });
  };
  const byPattern = (p: Pattern) => pool.filter((e) => e.pattern === p && !used.has(e.id));

  // 1. Target muscles first (one compound-ish slot each, then a second accessory round).
  for (let round = 0; round < 2 && muscles.length; round++) {
    for (const m of muscles) {
      if (chosen.length >= target) break;
      const role: Role = round === 0 ? 'secondary' : 'accessory';
      const cands = pool.filter((e) => e.primaryMuscles.includes(m) && !used.has(e.id) && e.pattern !== 'conditioning');
      if (!cands.length && round === 0) missing.add('other');
      add(best(cands, role), role);
    }
    if (muscles.length * 2 > target) break;
  }

  // 2. Focus template slots.
  const slots: Slot[] = [...TEMPLATES[focus]];
  if (goal === 'conditioning') slots.splice(Math.min(3, slots.length), 0, ['conditioning', 'secondary']);
  for (const [pattern, role] of slots) {
    if (chosen.length >= target) break;
    let ex = best(byPattern(pattern), role);
    for (const alt of focus === 'core' ? [] : SUBSTITUTE[pattern] ?? []) {
      if (ex) break;
      ex = best(byPattern(alt), role);
    }
    if (!pool.some((e) => e.pattern === pattern)) missing.add(pattern);
    add(ex, role);
  }
  // 3. Top up within the focus if substitutions left us short.
  for (const p of FOCUS_PATTERNS[focus]) {
    if (chosen.length >= target) break;
    add(best(byPattern(p), 'accessory'), 'accessory');
  }

  fitToTime(chosen, minutes * 60);
  const notes: string[] = [];
  const m = [...missing].filter((p) => p !== 'other');
  if (m.length) notes.push(`No ${m.map((p) => PATTERN_LABEL[p]).join(', ')} exercises match today’s equipment — related movements were used where possible.`);
  if (missing.has('other')) notes.push('Some target muscles have no exercise for today’s equipment.');
  if (!chosen.length) notes.push('Nothing matches this focus and equipment. Try adding equipment or another focus.');
  return { createdAt, input, title: sessionTitle(focus, muscles), exercises: chosen, notes };
}

/** Trim sets (min 2), then drop trailing exercises (min 2), until the estimate fits. Mutates. */
export function fitToTime(items: PlannedExercise[], budgetSec: number): void {
  while (estimateSeconds(items) > budgetSec) {
    let idx = -1;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].sets > 2 && (idx === -1 || items[i].sets > items[idx].sets)) idx = i;
    }
    if (idx >= 0) { items[idx].sets--; continue; }
    if (items.length > 2) { items.pop(); continue; }
    break;
  }
}

export function estMinutes(w: Pick<BuiltWorkout, 'exercises'>): number {
  return Math.round(estimateSeconds(w.exercises) / 60);
}

// ---------- editing a built workout (pure) ----------
const withExercises = (w: BuiltWorkout, exercises: PlannedExercise[]): BuiltWorkout => ({ ...w, exercises });

/** Alternatives for swapping: same movement pattern or primary muscle, doable with the given equipment. */
export function swapAlternatives(
  exerciseId: string, exercises: Exercise[], opts: { equipment: Equipment[]; exclude?: string[]; limit?: number },
): Exercise[] {
  const cur = exercises.find((e) => e.id === exerciseId);
  if (!cur) return [];
  const skip = new Set([exerciseId, ...(opts.exclude ?? [])]);
  const prim = new Set(cur.primaryMuscles);
  return exercises
    .filter((e) => !skip.has(e.id) && hasEquipment(e, opts.equipment) && e.pattern !== 'stretch' && e.pattern !== 'cardio')
    .map((e) => {
      const samePattern = e.pattern === cur.pattern && cur.pattern !== 'other';
      const sameMain = e.primaryMuscles[0] === cur.primaryMuscles[0];
      const overlap = e.primaryMuscles.some((m) => prim.has(m));
      if (!samePattern && !overlap) return undefined;
      const score = (samePattern ? 4 : 0) + (sameMain ? 3 : 0) + (overlap ? 1 : 0) + (e.gen ? 2 : 0) + (e.featured ? 2 : 0)
        + (e.role === cur.role ? 1 : 0);
      return { e, score };
    })
    .filter((x): x is { e: Exercise; score: number } => !!x)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .slice(0, opts.limit ?? 20)
    .map((x) => x.e);
}

export function swapExercise(w: BuiltWorkout, index: number, next: Exercise): BuiltWorkout {
  const old = w.exercises[index];
  if (!old) return w;
  const role = old.role ?? next.role;
  const rx = prescribe(w.input.goal, w.input.experience, role, next);
  return withExercises(w, w.exercises.map((e, i) => (i === index ? { exerciseId: next.id, pattern: next.pattern, role, ...rx } : e)));
}
export function removeExercise(w: BuiltWorkout, index: number): BuiltWorkout {
  return withExercises(w, w.exercises.filter((_, i) => i !== index));
}
export function moveExercise(w: BuiltWorkout, index: number, delta: -1 | 1): BuiltWorkout {
  const j = index + delta;
  if (j < 0 || j >= w.exercises.length) return w;
  const list = [...w.exercises];
  [list[index], list[j]] = [list[j], list[index]];
  return withExercises(w, list);
}
export function addExercise(w: BuiltWorkout, ex: Exercise): BuiltWorkout {
  if (w.exercises.some((e) => e.exerciseId === ex.id)) return w;
  const role: Role = ex.role === 'main' ? 'secondary' : ex.role;
  return withExercises(w, [...w.exercises, { exerciseId: ex.id, pattern: ex.pattern, role, ...prescribe(w.input.goal, w.input.experience, role, ex) }]);
}

// ---------- history-based focus suggestion ----------
type Region = 'push' | 'pull' | 'legs' | 'core';
const REGION: Partial<Record<Muscle, Region>> = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  lats: 'pull', 'middle back': 'pull', biceps: 'pull', traps: 'pull', forearms: 'pull',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs', 'lower back': 'legs',
  abdominals: 'core',
};
const FOCUS_REGIONS: Record<Focus, Region[]> = {
  full: ['push', 'pull', 'legs'], upper: ['push', 'pull'], lower: ['legs'], push: ['push'], pull: ['pull'], legs: ['legs'], core: ['core'],
};
const SUGGEST_ORDER: Focus[] = ['full', 'upper', 'lower', 'push', 'pull', 'legs'];
const REGION_LABEL: Record<Region, string> = { push: 'chest/shoulders/triceps', pull: 'back/biceps', legs: 'legs', core: 'core' };

export interface RecentSession { startedAt: number; focus?: Focus; exerciseIds: string[] }
export interface FocusSuggestion { focus: Focus; reason: string }

/**
 * Suggests today's focus, avoiding the regions trained in the last 1–2 sessions (within 4 days).
 * The most recent session counts fully, the one before half.
 */
export function suggestFocus(history: RecentSession[], byId: Record<string, Exercise>, now: number): FocusSuggestion {
  const recent = [...history].filter((s) => now - s.startedAt < 4 * 864e5 && s.exerciseIds.length)
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, 2);
  if (!recent.length) return { focus: 'full', reason: 'No recent sessions — full body is a good start.' };
  const load: Record<Region, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  recent.forEach((s, i) => {
    const weight = i === 0 ? 1 : 0.5;
    const regions = s.exerciseIds.map((id) => REGION[byId[id]?.primaryMuscles[0] as Muscle]).filter((r): r is Region => !!r);
    for (const r of regions) load[r] += weight / regions.length;
  });
  const score = (f: Focus) => FOCUS_REGIONS[f].reduce((n, r) => n + load[r], 0) / FOCUS_REGIONS[f].length;
  const min = Math.min(...SUGGEST_ORDER.map(score));
  const ties = SUGGEST_ORDER.filter((f) => score(f) - min < 1e-9);
  const focus = ties.find((f) => f !== recent[0].focus) ?? ties[0];
  const hit = (Object.keys(load) as Region[]).filter((r) => r !== 'core' && load[r] >= 0.25).map((r) => REGION_LABEL[r]);
  const reason = hit.length ? `Recently trained: ${hit.join(', ')}.` : 'Recent sessions were light.';
  return { focus, reason };
}

/** Muscles hit (primary) by a list of exercise ids — handy for display. */
export function musclesOf(ids: string[], byId: Record<string, Exercise>): Muscle[] {
  return [...new Set(ids.flatMap((id) => byId[id]?.primaryMuscles ?? []))];
}
