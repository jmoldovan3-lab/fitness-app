import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID } from '../src/data/exercises';
import {
  addExercise, estimateSeconds, generateSession, moveExercise, mulberry32, removeExercise, suggestFocus, swapAlternatives,
  swapExercise, targetExerciseCount, hasEquipment, FOCUS_PATTERNS,
} from '../src/generator';
import type { BuildInput, Equipment, Focus, Goal, Muscle, SessionMinutes } from '../src/types';

const ALL_EQ: Equipment[] = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bands', 'pullupBar', 'bench'];
const base: BuildInput = { focus: 'full', muscles: [], minutes: 60, equipment: ALL_EQ, goal: 'hypertrophy', experience: 'intermediate', seed: 1 };
const GOALS: Goal[] = ['strength', 'hypertrophy', 'general', 'conditioning'];
const FOCI: Focus[] = ['full', 'upper', 'lower', 'push', 'pull', 'legs', 'core'];
const MINUTES: SessionMinutes[] = [20, 30, 45, 60, 75, 90];
const gen = (o: Partial<BuildInput> = {}) => generateSession({ ...base, ...o }, EXERCISES);
const ex = (id: string) => EXERCISE_BY_ID[id];

describe('exercise data', () => {
  it('ships the full free-exercise-db with two frames each', () => {
    expect(EXERCISES.length).toBeGreaterThan(850);
    for (const e of EXERCISES) {
      expect(e.images).toEqual([`exercises/${e.id}/0.webp`, `exercises/${e.id}/1.webp`]);
      expect(e.primaryMuscles.length).toBeGreaterThan(0);
    }
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
  it('marks a large strength subset as generator-eligible, never stretching/cardio unless hand-featured', () => {
    const g = EXERCISES.filter((e) => e.gen);
    expect(g.length).toBeGreaterThan(400);
    expect(g.some((e) => !e.featured && (e.category === 'stretching' || e.category === 'cardio'))).toBe(false);
    for (const p of ['squat', 'hinge', 'lunge', 'hpush', 'vpush', 'hpull', 'vpull', 'core']) expect(g.some((e) => e.pattern === p)).toBe(true);
  });
});

describe('prng', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(mulberry32(42)()).not.toEqual(c());
  });
});

describe('focus filtering', () => {
  it.each(FOCI)('%s only uses patterns from its template', (focus) => {
    for (let seed = 1; seed <= 5; seed++) {
      const w = gen({ focus, seed });
      expect(w.exercises.length).toBeGreaterThanOrEqual(2);
      for (const e of w.exercises) expect(FOCUS_PATTERNS[focus]).toContain(e.pattern);
    }
  });
  it('upper never includes leg patterns; lower/legs never include upper pushes or pulls', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(gen({ focus: 'upper', seed }).exercises.some((e) => ['squat', 'hinge', 'lunge', 'calves'].includes(e.pattern))).toBe(false);
      for (const focus of ['lower', 'legs'] as Focus[]) {
        expect(gen({ focus, seed }).exercises.some((e) => ['hpush', 'vpush', 'hpull', 'vpull'].includes(e.pattern))).toBe(false);
      }
    }
  });
  it('full body covers squat/hinge, push and pull', () => {
    const p = gen({ focus: 'full' }).exercises.map((e) => e.pattern);
    expect(p.some((x) => x === 'squat' || x === 'lunge')).toBe(true);
    expect(p.some((x) => x === 'hpush' || x === 'vpush')).toBe(true);
    expect(p.some((x) => x === 'hpull' || x === 'vpull')).toBe(true);
  });
  it('target muscles come first and are trained', () => {
    const muscles: Muscle[] = ['biceps', 'calves'];
    const w = gen({ focus: 'upper', muscles });
    expect(w.title).toBe('Upper body · Biceps, Calves');
    expect(ex(w.exercises[0].exerciseId).primaryMuscles).toContain('biceps');
    expect(ex(w.exercises[1].exerciseId).primaryMuscles).toContain('calves');
  });
  it('never repeats an exercise', () => {
    for (const focus of FOCI) for (let seed = 1; seed <= 5; seed++) {
      const ids = gen({ focus, seed, minutes: 90 }).exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('only uses generator-eligible exercises', () => {
    for (const focus of FOCI) expect(gen({ focus }).exercises.every((e) => ex(e.exerciseId).gen)).toBe(true);
  });
});

describe('equipment filtering', () => {
  const sets: Equipment[][] = [[], ['dumbbell'], ['dumbbell', 'bench'], ['kettlebell'], ['bands', 'pullupBar'], ['machine', 'cable'], ALL_EQ];
  it.each(sets.map((s) => [s.join('+') || 'bodyweight', s] as const))('%s: every exercise is doable', (_n, eq) => {
    for (const focus of FOCI) {
      const w = gen({ focus, equipment: eq });
      for (const e of w.exercises) expect(hasEquipment(ex(e.exerciseId), eq)).toBe(true);
    }
  });
  it('prefers barbell main lifts for strength when a barbell is available', () => {
    const w = gen({ focus: 'lower', goal: 'strength', equipment: ['barbell', 'bench'] });
    expect(ex(w.exercises[0].exerciseId).loadType).toBe('barbell');
  });
  it('bodyweight-only full body still builds a workout', () => {
    const w = gen({ equipment: [], minutes: 45 });
    expect(w.exercises.length).toBeGreaterThanOrEqual(3);
    expect(w.exercises.every((e) => ex(e.exerciseId).equipment.length === 0)).toBe(true);
  });
  it('beginners do not get expert-level exercises', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(gen({ experience: 'beginner', seed }).exercises.every((e) => ex(e.exerciseId).skill <= 2)).toBe(true);
    }
  });
});

describe('session length scaling', () => {
  it('scales exercise count with length', () => {
    for (const goal of GOALS) {
      const counts = MINUTES.map((m) => targetExerciseCount(goal, m));
      for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
      const built = MINUTES.map((minutes) => gen({ goal, minutes }).exercises.length);
      expect(built[built.length - 1]).toBeGreaterThan(built[0]);
    }
  });
  it.each(MINUTES)('%i min: estimate fits the length (min 2 exercises × 2 sets)', (minutes) => {
    for (const goal of GOALS) for (const focus of FOCI) {
      const w = gen({ goal, focus, minutes });
      const fits = estimateSeconds(w.exercises) <= minutes * 60;
      const floor = w.exercises.length <= 2 && w.exercises.every((e) => e.sets === 2);
      expect(fits || floor).toBe(true);
    }
  });
});

describe('prescriptions', () => {
  it('strength: low reps, long rest on the main lift', () => {
    const first = gen({ focus: 'lower', goal: 'strength' }).exercises[0];
    expect(first.repMax).toBeLessThanOrEqual(5);
    expect(first.restSec).toBeGreaterThanOrEqual(150);
  });
  it('conditioning includes a conditioning exercise', () => {
    expect(gen({ goal: 'conditioning', minutes: 60 }).exercises.some((e) => e.pattern === 'conditioning')).toBe(true);
  });
  it('bodyweight exercises never get 3–5 reps', () => {
    const w = gen({ goal: 'strength', equipment: [] });
    for (const e of w.exercises) expect(e.unit === 'sec' || e.repMax > 5).toBe(true);
  });
});

describe('determinism', () => {
  it('same input + seed → identical workout', () => {
    for (const focus of FOCI) expect(gen({ focus, seed: 99 })).toEqual(gen({ focus, seed: 99 }));
  });
  it('different seeds vary selection (regenerate)', () => {
    const a = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) a.add(gen({ seed }).exercises.map((e) => e.exerciseId).join());
    expect(a.size).toBeGreaterThan(3);
  });
  it('does not mutate inputs', () => {
    const input = structuredClone(base);
    const copy = JSON.stringify(EXERCISES.slice(0, 50));
    generateSession(input, EXERCISES);
    expect(input).toEqual(base);
    expect(JSON.stringify(EXERCISES.slice(0, 50))).toBe(copy);
  });
});

describe('swap alternatives', () => {
  it('returns same-pattern / same-muscle options doable with the equipment, best first', () => {
    const alts = swapAlternatives('Barbell_Bench_Press_-_Medium_Grip', EXERCISES, { equipment: ['dumbbell', 'bench'] });
    expect(alts.length).toBeGreaterThanOrEqual(5);
    for (const a of alts) {
      expect(hasEquipment(a, ['dumbbell', 'bench'])).toBe(true);
      expect(a.pattern === 'hpush' || a.primaryMuscles.includes('chest')).toBe(true);
    }
    expect(alts[0].pattern).toBe('hpush');
    expect(alts.map((a) => a.id)).not.toContain('Barbell_Bench_Press_-_Medium_Grip');
    expect(alts.map((a) => a.id)).toContain('Dumbbell_Bench_Press');
  });
  it('excludes exercises already in the workout and stretches', () => {
    const alts = swapAlternatives('Pullups', EXERCISES, { equipment: ALL_EQ, exclude: ['Chin-Up'] });
    expect(alts.map((a) => a.id)).not.toContain('Chin-Up');
    expect(alts.some((a) => a.pattern === 'stretch')).toBe(false);
  });
  it('is deterministic', () => {
    const o = { equipment: ALL_EQ };
    expect(swapAlternatives('Barbell_Squat', EXERCISES, o)).toEqual(swapAlternatives('Barbell_Squat', EXERCISES, o));
  });
});

describe('editing a built workout', () => {
  const w = gen({ focus: 'push', seed: 5 });
  it('swap keeps the slot role and re-prescribes', () => {
    const next = ex('Pushups');
    const s = swapExercise(w, 0, next);
    expect(s.exercises[0].exerciseId).toBe('Pushups');
    expect(s.exercises[0].role).toBe(w.exercises[0].role);
    expect(s.exercises.slice(1)).toEqual(w.exercises.slice(1));
    expect(w.exercises[0].exerciseId).not.toBe('Pushups');
  });
  it('remove, move and add', () => {
    expect(removeExercise(w, 0).exercises).toEqual(w.exercises.slice(1));
    const m = moveExercise(w, 0, 1);
    expect(m.exercises[0]).toEqual(w.exercises[1]);
    expect(m.exercises[1]).toEqual(w.exercises[0]);
    expect(moveExercise(w, 0, -1)).toBe(w);
    const a = addExercise(w, ex('Plank'));
    expect(a.exercises.at(-1)).toMatchObject({ exerciseId: 'Plank', unit: 'sec' });
    expect(addExercise(a, ex('Plank')).exercises).toHaveLength(a.exercises.length);
  });
});

describe('history-based focus suggestion', () => {
  const H = 3600e3;
  const NOW = 1e12;
  it('defaults to full body without recent history', () => {
    expect(suggestFocus([], EXERCISE_BY_ID, NOW).focus).toBe('full');
    expect(suggestFocus([{ startedAt: NOW - 10 * 24 * H, exerciseIds: ['Barbell_Squat'] }], EXERCISE_BY_ID, NOW).focus).toBe('full');
  });
  it('after an upper session suggests lower body', () => {
    const s = suggestFocus([{ startedAt: NOW - 24 * H, focus: 'upper', exerciseIds: ['Barbell_Bench_Press_-_Medium_Grip', 'Pullups', 'Bent_Over_Barbell_Row'] }], EXERCISE_BY_ID, NOW);
    expect(s.focus).toBe('lower');
    expect(s.reason).toMatch(/chest|back/);
  });
  it('after a lower session suggests an upper-body focus', () => {
    const s = suggestFocus([{ startedAt: NOW - 24 * H, focus: 'lower', exerciseIds: ['Barbell_Squat', 'Romanian_Deadlift'] }], EXERCISE_BY_ID, NOW);
    expect(['upper', 'push', 'pull']).toContain(s.focus);
  });
  it('after push then pull suggests legs/lower', () => {
    const s = suggestFocus([
      { startedAt: NOW - 20 * H, focus: 'pull', exerciseIds: ['Pullups', 'Seated_Cable_Rows'] },
      { startedAt: NOW - 44 * H, focus: 'push', exerciseIds: ['Dumbbell_Bench_Press', 'Dumbbell_Shoulder_Press'] },
    ], EXERCISE_BY_ID, NOW);
    expect(['lower', 'legs']).toContain(s.focus);
  });
  it('does not repeat full body twice in a row', () => {
    const s = suggestFocus([{ startedAt: NOW - 20 * H, focus: 'full', exerciseIds: ['Barbell_Squat', 'Dumbbell_Bench_Press', 'Pullups'] }], EXERCISE_BY_ID, NOW);
    expect(s.focus).not.toBe('full');
  });
});
