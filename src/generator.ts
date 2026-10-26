// Pure, deterministic workout plan generator. No I/O, no Date/Math.random.
import type {
  Equipment, Exercise, Experience, Goal, Pattern, Plan, PlanDay, PlannedExercise, Prescription, Profile, Role,
} from './types';

export interface GenerateOptions { seed: number; createdAt?: number }

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
const MAX_SKILL: Record<Experience, number> = { beginner: 2, intermediate: 3, advanced: 3 };

const ROLE_RANK: Record<Role, number> = { main: 0, secondary: 1, accessory: 2 };

export function prescribe(goal: Goal, experience: Experience, slotRole: Role, ex: Exercise): Prescription {
  // An isolation exercise in a compound slot keeps its isolation prescription.
  const role = ROLE_RANK[ex.role] > ROLE_RANK[slotRole] ? ex.role : slotRole;
  // Bodyweight moves can't be loaded for low reps: use hypertrophy ranges for strength.
  const g: Goal = goal === 'strength' && ex.loadType === 'bodyweight' ? 'hypertrophy' : goal;
  const base = RX[g][role];
  const rxRole = role;
  const minSets = 2;
  const sets = Math.max(minSets, base.sets + (rxRole === 'accessory' && experience !== 'advanced' ? 0 : SETS_DELTA[experience]));
  const timed = TIMED[ex.id];
  if (timed) return { sets, repMin: timed[0], repMax: timed[1], unit: 'sec', restSec: Math.min(base.restSec, 60) };
  return { sets, repMin: base.repMin, repMax: base.repMax, unit: 'reps', restSec: base.restSec };
}

/** Rough duration: per set, work (~3s/rep or the hold time) + rest; plus 1 min setup per exercise. */
export function estimateSeconds(items: Prescription[]): number {
  return items.reduce((sum, p) => {
    const work = p.unit === 'sec' ? p.repMax : p.repMax * 3;
    return sum + p.sets * (work + p.restSec) + 60;
  }, 0);
}

// ---------- splits ----------
type Slot = [Pattern, Role];
interface DayTemplate { name: string; focus: string; slots: Slot[] }

const FB_A: DayTemplate = { name: 'Full Body A', focus: 'Squat · Push · Pull', slots: [
  ['squat', 'main'], ['hpush', 'main'], ['hpull', 'main'], ['hinge', 'secondary'], ['vpush', 'secondary'],
  ['core', 'accessory'], ['lunge', 'secondary'], ['biceps', 'accessory'], ['triceps', 'accessory'], ['calves', 'accessory'] ] };
const FB_B: DayTemplate = { name: 'Full Body B', focus: 'Hinge · Overhead · Pull-down', slots: [
  ['hinge', 'main'], ['vpush', 'main'], ['vpull', 'main'], ['lunge', 'secondary'], ['hpush', 'secondary'],
  ['core', 'accessory'], ['hpull', 'accessory'], ['shoulders', 'accessory'], ['biceps', 'accessory'], ['squat', 'accessory'] ] };
const FB_C: DayTemplate = { name: 'Full Body C', focus: 'Legs · Push · Row', slots: [
  ['squat', 'secondary'], ['hpush', 'secondary'], ['hpull', 'secondary'], ['hinge', 'secondary'], ['vpull', 'secondary'],
  ['core', 'accessory'], ['lunge', 'secondary'], ['triceps', 'accessory'], ['shoulders', 'accessory'], ['calves', 'accessory'] ] };
const UPPER_A: DayTemplate = { name: 'Upper A', focus: 'Bench · Row', slots: [
  ['hpush', 'main'], ['hpull', 'main'], ['vpush', 'secondary'], ['vpull', 'secondary'], ['hpush', 'accessory'],
  ['triceps', 'accessory'], ['biceps', 'accessory'], ['shoulders', 'accessory'], ['core', 'accessory'] ] };
const UPPER_B: DayTemplate = { name: 'Upper B', focus: 'Overhead · Pull-up', slots: [
  ['vpush', 'main'], ['vpull', 'main'], ['hpush', 'secondary'], ['hpull', 'secondary'], ['shoulders', 'accessory'],
  ['hpull', 'accessory'], ['biceps', 'accessory'], ['triceps', 'accessory'], ['core', 'accessory'] ] };
const LOWER_A: DayTemplate = { name: 'Lower A', focus: 'Squat', slots: [
  ['squat', 'main'], ['hinge', 'secondary'], ['lunge', 'secondary'], ['hinge', 'accessory'], ['squat', 'accessory'],
  ['calves', 'accessory'], ['core', 'accessory'], ['core', 'accessory'] ] };
const LOWER_B: DayTemplate = { name: 'Lower B', focus: 'Hinge', slots: [
  ['hinge', 'main'], ['squat', 'secondary'], ['lunge', 'secondary'], ['hinge', 'accessory'], ['calves', 'accessory'],
  ['core', 'accessory'], ['squat', 'accessory'], ['core', 'accessory'] ] };
const PUSH: DayTemplate = { name: 'Push', focus: 'Chest · Shoulders · Triceps', slots: [
  ['hpush', 'main'], ['vpush', 'secondary'], ['hpush', 'secondary'], ['shoulders', 'accessory'], ['triceps', 'accessory'],
  ['hpush', 'accessory'], ['triceps', 'accessory'], ['core', 'accessory'] ] };
const PULL: DayTemplate = { name: 'Pull', focus: 'Back · Biceps', slots: [
  ['vpull', 'main'], ['hpull', 'main'], ['hpull', 'secondary'], ['hpull', 'accessory'], ['biceps', 'accessory'],
  ['vpull', 'accessory'], ['biceps', 'accessory'], ['core', 'accessory'] ] };
const LEGS: DayTemplate = { name: 'Legs', focus: 'Quads · Hamstrings · Glutes', slots: [
  ['squat', 'main'], ['hinge', 'secondary'], ['lunge', 'secondary'], ['squat', 'accessory'], ['hinge', 'accessory'],
  ['calves', 'accessory'], ['core', 'accessory'], ['core', 'accessory'] ] };

const rename = (t: DayTemplate, name: string): DayTemplate => ({ ...t, name });

export function splitFor(days: number): { split: string; templates: DayTemplate[] } {
  switch (days) {
    case 2: return { split: 'Full body ×2', templates: [FB_A, FB_B] };
    case 3: return { split: 'Full body ×3', templates: [FB_A, FB_B, FB_C] };
    case 4: return { split: 'Upper / Lower', templates: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] };
    case 5: return { split: 'Push / Pull / Legs + Upper / Lower', templates: [PUSH, PULL, LEGS, UPPER_B, LOWER_B] };
    case 6: return { split: 'Push / Pull / Legs ×2', templates: [
      rename(PUSH, 'Push A'), rename(PULL, 'Pull A'), rename(LEGS, 'Legs A'),
      rename(PUSH, 'Push B'), rename(PULL, 'Pull B'), { ...LOWER_B, name: 'Legs B' } ] };
    default: throw new RangeError(`daysPerWeek must be 2–6, got ${days}`);
  }
}

const COUNT: Record<Goal, Record<number, number>> = {
  strength: { 30: 3, 45: 4, 60: 5, 75: 6, 90: 7 },
  hypertrophy: { 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 },
  general: { 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 },
  conditioning: { 30: 5, 45: 6, 60: 7, 75: 8, 90: 9 },
};
export function targetExerciseCount(goal: Goal, minutes: number): number {
  const keys = [30, 45, 60, 75, 90];
  const k = keys.reduce((best, m) => (Math.abs(m - minutes) < Math.abs(best - minutes) ? m : best), 30);
  return COUNT[goal][k];
}

const SUBSTITUTE: Partial<Record<Pattern, Pattern[]>> = {
  vpull: ['hpull'], hpull: ['vpull'], vpush: ['hpush'], hpush: ['vpush'], lunge: ['squat'], squat: ['lunge'],
  hinge: ['lunge'], shoulders: ['vpush'], calves: ['lunge'], biceps: ['hpull'], triceps: ['hpush'],
};
const LOAD_PREF: Record<string, number> = { barbell: 6, dumbbell: 5, kettlebell: 4, machine: 3, cable: 3, band: 1, bodyweight: 2 };

export function availableExercises(all: Exercise[], equipment: Equipment[]): Exercise[] {
  const have = new Set(equipment);
  return all.filter((e) => e.equipment.every((q) => have.has(q)));
}

export function generatePlan(profile: Profile, exercises: Exercise[], opts: GenerateOptions): Plan {
  const { goal, experience, daysPerWeek, sessionMinutes } = profile;
  const rand = mulberry32(opts.seed);
  const pool = availableExercises(exercises, profile.equipment).filter((e) => e.skill <= MAX_SKILL[experience]);
  const usedInWeek = new Map<string, number>();
  const missing = new Set<Pattern>();
  const { split, templates } = splitFor(daysPerWeek);

  const slots = (t: DayTemplate): Slot[] => {
    const s = [...t.slots];
    if (goal === 'conditioning') s.splice(3, 0, ['conditioning', 'secondary']);
    return s;
  };

  const pick = (pattern: Pattern, role: Role, usedToday: Set<string>): Exercise | undefined => {
    const cands = pool.filter((e) => e.pattern === pattern && !usedToday.has(e.id));
    if (!cands.length) return undefined;
    const scored = cands.map((e) => {
      let score = 0;
      if (e.role === role) score += 10;
      else if (role === 'main' && e.role === 'secondary') score += 6;
      else if (role === 'secondary' && e.role === 'main') score += 5;
      else if (role === 'accessory' && e.role === 'secondary') score += 2;
      if (role !== 'accessory') score += LOAD_PREF[e.loadType] * (goal === 'strength' ? 1 : 0.5);
      if (experience === 'beginner') score -= (e.skill - 1) * 3;
      if (experience === 'advanced') score += (e.skill - 1);
      score -= (usedInWeek.get(e.id) ?? 0) * 4;
      score += rand() * 3;
      return { e, score };
    });
    scored.sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
    return scored[0].e;
  };

  const days: PlanDay[] = templates.map((t) => {
    const target = targetExerciseCount(goal, sessionMinutes);
    const usedToday = new Set<string>();
    const chosen: PlannedExercise[] = [];
    for (const [pattern, role] of slots(t)) {
      if (chosen.length >= target) break;
      let ex = pick(pattern, role, usedToday);
      for (const alt of SUBSTITUTE[pattern] ?? []) {
        if (ex) break;
        ex = pick(alt, role, usedToday);
      }
      if (!pool.some((e) => e.pattern === pattern)) missing.add(pattern);
      if (!ex) continue;
      usedToday.add(ex.id);
      usedInWeek.set(ex.id, (usedInWeek.get(ex.id) ?? 0) + 1);
      chosen.push({ exerciseId: ex.id, pattern: ex.pattern, ...prescribe(goal, experience, role, ex) });
    }
    // Top up from any remaining patterns if substitutions left us short.
    if (chosen.length < target) {
      for (const p of ['core', 'lunge', 'hpush', 'squat', 'hinge', 'hpull', 'conditioning'] as Pattern[]) {
        if (chosen.length >= target) break;
        const ex = pick(p, 'accessory', usedToday);
        if (!ex) continue;
        usedToday.add(ex.id);
        chosen.push({ exerciseId: ex.id, pattern: ex.pattern, ...prescribe(goal, experience, 'accessory', ex) });
      }
    }
    fitToTime(chosen, sessionMinutes * 60);
    return { name: t.name, focus: t.focus, exercises: chosen, estMinutes: Math.round(estimateSeconds(chosen) / 60) };
  });

  const notes = missing.size
    ? [`No ${[...missing].map((p) => PATTERN_LABEL[p]).join(', ')} exercises match your equipment — related movements were used instead where possible.`]
    : [];
  return { createdAt: opts.createdAt ?? 0, seed: opts.seed, profile, split, days, notes };
}

/** Trim sets (min 2), then drop trailing exercises (min 2), until the estimate fits. Mutates. */
export function fitToTime(items: PlannedExercise[], budgetSec: number): void {
  while (estimateSeconds(items) > budgetSec) {
    // reduce sets on the exercise with the most sets, preferring later exercises
    let idx = -1;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].sets > 2 && (idx === -1 || items[i].sets > items[idx].sets)) idx = i;
    }
    if (idx >= 0) { items[idx].sets--; continue; }
    if (items.length > 2) { items.pop(); continue; }
    break;
  }
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  squat: 'squat', hinge: 'hinge', lunge: 'single-leg', hpush: 'horizontal push', vpush: 'vertical push',
  hpull: 'horizontal pull', vpull: 'vertical pull', core: 'core', biceps: 'biceps', triceps: 'triceps',
  shoulders: 'shoulder', calves: 'calf', conditioning: 'conditioning',
};
