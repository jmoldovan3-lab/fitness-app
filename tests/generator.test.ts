import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID } from '../src/data/exercises';
import { estimateSeconds, generatePlan, mulberry32, splitFor, targetExerciseCount } from '../src/generator';
import type { Equipment, Goal, Profile, SessionMinutes } from '../src/types';

const ALL_EQ: Equipment[] = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bands', 'pullupBar', 'bench'];
const base: Profile = { goal: 'hypertrophy', experience: 'intermediate', daysPerWeek: 3, sessionMinutes: 60, equipment: ALL_EQ, units: 'kg' };
const GOALS: Goal[] = ['strength', 'hypertrophy', 'general', 'conditioning'];
const MINUTES: SessionMinutes[] = [30, 45, 60, 75, 90];
const ids = (p: ReturnType<typeof generatePlan>) => p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));

describe('exercise data', () => {
  it('has a curated set with two image frames each and covers every pattern', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(60);
    for (const e of EXERCISES) expect(e.images).toHaveLength(2);
    const patterns = new Set(EXERCISES.map((e) => e.pattern));
    for (const p of ['squat', 'hinge', 'lunge', 'hpush', 'vpush', 'hpull', 'vpull', 'core']) expect(patterns).toContain(p);
  });
});

describe('prng', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });
});

describe('day counts and splits', () => {
  it.each([2, 3, 4, 5, 6])('%i days → %i plan days', (n) => {
    const plan = generatePlan({ ...base, daysPerWeek: n }, EXERCISES, { seed: 1 });
    expect(plan.days).toHaveLength(n);
    for (const d of plan.days) expect(d.exercises.length).toBeGreaterThanOrEqual(2);
  });
  it('uses full body for 2–3, upper/lower for 4, PPL for 5–6', () => {
    expect(splitFor(2).split).toMatch(/Full body/);
    expect(splitFor(3).split).toMatch(/Full body/);
    expect(splitFor(4).split).toBe('Upper / Lower');
    expect(splitFor(5).split).toMatch(/Push \/ Pull \/ Legs/);
    expect(splitFor(6).split).toMatch(/Push \/ Pull \/ Legs/);
  });
  it('rejects out-of-range day counts', () => {
    expect(() => generatePlan({ ...base, daysPerWeek: 1 }, EXERCISES, { seed: 1 })).toThrow(RangeError);
    expect(() => generatePlan({ ...base, daysPerWeek: 7 }, EXERCISES, { seed: 1 })).toThrow(RangeError);
  });
  it('covers squat, hinge, push and pull across a full-body week', () => {
    const plan = generatePlan(base, EXERCISES, { seed: 9 });
    const patterns = new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.pattern)));
    for (const p of ['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull', 'core']) expect(patterns).toContain(p);
  });
  it('never repeats an exercise within a day', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const plan = generatePlan({ ...base, daysPerWeek: n, sessionMinutes: 90 }, EXERCISES, { seed: n });
      for (const d of plan.days) expect(new Set(d.exercises.map((e) => e.exerciseId)).size).toBe(d.exercises.length);
    }
  });
});

describe('equipment filtering', () => {
  const combos: Equipment[][] = [[], ['dumbbell'], ['dumbbell', 'bench'], ['kettlebell'], ['bands', 'pullupBar'], ['barbell', 'bench'], ['cable', 'machine'], ALL_EQ];
  it.each(combos.map((c) => [c.join('+') || 'bodyweight', c]))('only uses available equipment: %s', (_label, eq) => {
    for (const days of [2, 4, 6]) {
      const plan = generatePlan({ ...base, daysPerWeek: days, equipment: eq as Equipment[] }, EXERCISES, { seed: 7 });
      for (const id of ids(plan)) {
        for (const need of EXERCISE_BY_ID[id].equipment) expect(eq).toContain(need);
      }
    }
  });
  it('prefers barbell main lifts for strength when a barbell is available', () => {
    const plan = generatePlan({ ...base, goal: 'strength', equipment: ['barbell', 'bench'] }, EXERCISES, { seed: 3 });
    expect(EXERCISE_BY_ID[plan.days[0].exercises[0].exerciseId].loadType).toBe('barbell');
  });
});

describe('bodyweight only', () => {
  it.each(GOALS)('produces a valid plan for %s on every day count', (goal) => {
    for (const days of [2, 3, 4, 5, 6]) {
      const plan = generatePlan({ ...base, goal, daysPerWeek: days, equipment: [] }, EXERCISES, { seed: 11 });
      expect(plan.days).toHaveLength(days);
      for (const d of plan.days) {
        expect(d.exercises.length).toBeGreaterThanOrEqual(2);
        for (const e of d.exercises) {
          expect(EXERCISE_BY_ID[e.exerciseId].equipment).toEqual([]);
          expect(e.sets).toBeGreaterThanOrEqual(2);
          expect(e.repMin).toBeLessThanOrEqual(e.repMax);
        }
      }
    }
  });
});

describe('session length', () => {
  it('scales exercise count with session length', () => {
    for (const goal of GOALS) {
      const counts = MINUTES.map((m) => generatePlan({ ...base, goal, sessionMinutes: m }, EXERCISES, { seed: 5 }).days[0].exercises.length);
      for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
      expect(counts[4]).toBeGreaterThan(counts[0]);
      expect(targetExerciseCount(goal, 90)).toBeGreaterThan(targetExerciseCount(goal, 30));
    }
  });
  it('fits the estimated duration inside the session length', () => {
    for (const goal of GOALS) for (const m of MINUTES) for (const days of [2, 4, 6]) for (const exp of ['beginner', 'advanced'] as const) {
      const plan = generatePlan({ ...base, goal, experience: exp, sessionMinutes: m, daysPerWeek: days }, EXERCISES, { seed: m + days });
      for (const d of plan.days) expect(estimateSeconds(d.exercises)).toBeLessThanOrEqual(m * 60);
    }
  });
});

describe('goal prescriptions', () => {
  const first = (goal: Goal) => generatePlan({ ...base, goal }, EXERCISES, { seed: 2 }).days[0].exercises[0];
  it('strength: low reps, long rest', () => {
    const e = first('strength');
    expect(e.repMax).toBeLessThanOrEqual(6);
    expect(e.restSec).toBeGreaterThanOrEqual(150);
  });
  it('hypertrophy: ~6–12 reps', () => {
    const e = first('hypertrophy');
    expect(e.repMin).toBeGreaterThanOrEqual(6);
    expect(e.repMax).toBeLessThanOrEqual(12);
  });
  it('conditioning: higher reps and shorter rest than strength', () => {
    const c = first('conditioning'), s = first('strength');
    expect(c.repMin).toBeGreaterThanOrEqual(12);
    expect(c.restSec).toBeLessThan(s.restSec);
  });
  it('conditioning days include a conditioning exercise when possible', () => {
    const plan = generatePlan({ ...base, goal: 'conditioning' }, EXERCISES, { seed: 4 });
    expect(plan.days.some((d) => d.exercises.some((e) => e.pattern === 'conditioning'))).toBe(true);
  });
});

describe('determinism', () => {
  it('same input + seed → identical plan', () => {
    expect(generatePlan(base, EXERCISES, { seed: 123 })).toEqual(generatePlan(base, EXERCISES, { seed: 123 }));
  });
  it('different seeds can vary exercise selection', () => {
    const variants = new Set(Array.from({ length: 10 }, (_, s) => ids(generatePlan(base, EXERCISES, { seed: s })).join()));
    expect(variants.size).toBeGreaterThan(1);
  });
  it('does not mutate inputs', () => {
    const profile = structuredClone(base);
    generatePlan(profile, EXERCISES, { seed: 1 });
    expect(profile).toEqual(base);
  });
});

describe('prescription details', () => {
  it('bodyweight exercises never get strength-style 3–5 reps', () => {
    const plan = generatePlan({ ...base, goal: 'strength', equipment: [] }, EXERCISES, { seed: 1 });
    for (const e of plan.days.flatMap((d) => d.exercises)) if (e.unit === 'reps') expect(e.repMin).toBeGreaterThanOrEqual(6);
  });
  it('reports missing patterns once in notes for bodyweight-only', () => {
    const plan = generatePlan({ ...base, daysPerWeek: 4, equipment: [] }, EXERCISES, { seed: 1 });
    expect(plan.notes).toHaveLength(1);
    expect(plan.notes[0]).toMatch(/vertical pull/);
    expect(generatePlan(base, EXERCISES, { seed: 1 }).notes).toEqual([]);
  });
  it('timed holds use seconds', () => {
    const plan = generatePlan({ ...base, equipment: [], sessionMinutes: 90, daysPerWeek: 4 }, EXERCISES, { seed: 1 });
    const plank = plan.days.flatMap((d) => d.exercises).find((e) => e.exerciseId === 'Plank' || e.exerciseId === 'Side_Bridge');
    if (plank) expect(plank.unit).toBe('sec');
  });
});
