import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../src/data/exercises';
import { FitnessDB, getSession, listSessions, saveSession } from '../src/db';
import { generatePlan } from '../src/generator';
import {
  addSet, createWorkout, extendRest, goTo, isExerciseDone, restRemainingSec, skipRest, summarize, toggleSet, toRecords, updateSet,
} from '../src/workout';
import type { Profile } from '../src/types';

const profile: Profile = { goal: 'hypertrophy', experience: 'intermediate', daysPerWeek: 3, sessionMinutes: 45, equipment: ['dumbbell', 'bench'], units: 'kg' };
const plan = { ...generatePlan(profile, EXERCISES, { seed: 3, createdAt: 0 }), id: 7 };
const T0 = 1_000_000;

describe('workout state', () => {
  it('creates a workout from a plan day with prefilled sets', () => {
    const first = plan.days[0].exercises[0];
    const w = createWorkout(plan, 0, T0, { [first.exerciseId]: 22.5 });
    expect(w.dayName).toBe(plan.days[0].name);
    expect(w.planId).toBe(7);
    expect(w.exercises).toHaveLength(plan.days[0].exercises.length);
    expect(w.exercises[0].sets).toHaveLength(first.sets);
    expect(w.exercises[0].sets[0]).toEqual({ weight: 22.5, reps: first.repMin, completed: false });
    expect(w.exercises[1].sets[0].weight).toBe(0);
    expect(() => createWorkout(plan, 99, T0)).toThrow(RangeError);
  });

  it('checking a set starts a rest timer with the exercise rest time; +15s and skip work', () => {
    let w = createWorkout(plan, 0, T0);
    const rest = w.exercises[0].restSec;
    w = toggleSet(w, 0, 0, T0 + 5000);
    expect(w.exercises[0].sets[0].completed).toBe(true);
    expect(w.exercises[0].sets[0].completedAt).toBe(T0 + 5000);
    expect(restRemainingSec(w, T0 + 5000)).toBe(rest);
    expect(restRemainingSec(w, T0 + 5000 + 10_000)).toBe(rest - 10);
    w = extendRest(w, 15);
    expect(restRemainingSec(w, T0 + 5000)).toBe(rest + 15);
    expect(restRemainingSec(w, T0 + 5000 + (rest + 60) * 1000)).toBe(0);
    w = skipRest(w);
    expect(w.rest).toBeUndefined();
    expect(restRemainingSec(w, T0)).toBe(0);
  });

  it('unchecking a set does not start a rest timer', () => {
    let w = toggleSet(createWorkout(plan, 0, T0), 0, 0, T0);
    w = skipRest(w);
    w = toggleSet(w, 0, 0, T0 + 1);
    expect(w.exercises[0].sets[0].completed).toBe(false);
    expect(w.exercises[0].sets[0].completedAt).toBeUndefined();
    expect(w.rest).toBeUndefined();
  });

  it('updates weight forward to later incomplete sets, reps only for that set', () => {
    let w = createWorkout(plan, 0, T0);
    w = toggleSet(w, 0, 2, T0);
    w = updateSet(w, 0, 0, { weight: 30 });
    w = updateSet(w, 0, 1, { reps: 9 });
    const s = w.exercises[0].sets;
    expect(s[0].weight).toBe(30);
    expect(s[1].weight).toBe(30);
    expect(s[2].weight).toBe(0); // already completed, untouched
    expect(s[1].reps).toBe(9);
    expect(s[0].reps).toBe(plan.days[0].exercises[0].repMin);
  });

  it('adds sets, navigates within bounds, detects done exercises, does not mutate', () => {
    const w0 = createWorkout(plan, 0, T0);
    const w1 = addSet(w0, 0);
    expect(w1.exercises[0].sets.length).toBe(w0.exercises[0].sets.length + 1);
    expect(goTo(w0, -3).current).toBe(0);
    expect(goTo(w0, 99).current).toBe(w0.exercises.length - 1);
    let w = w0;
    w.exercises[0].sets.forEach((_, i) => { w = toggleSet(w, 0, i, T0 + i); });
    expect(isExerciseDone(w.exercises[0])).toBe(true);
    expect(isExerciseDone(w0.exercises[0])).toBe(false);
  });
});

describe('session save/load', () => {
  it('saves only completed sets and computes volume summary', async () => {
    const d = new FitnessDB('workout-test');
    let w = createWorkout(plan, 1, T0);
    w = updateSet(w, 0, 0, { weight: 20, reps: 10 });
    w = toggleSet(w, 0, 0, T0 + 1000);
    w = updateSet(w, 0, 1, { reps: 8 });
    w = toggleSet(w, 0, 1, T0 + 2000);
    w = updateSet(w, 1, 0, { weight: 10, reps: 12 });
    w = toggleSet(w, 1, 0, T0 + 3000);
    const { session, sets } = toRecords(w, T0 + 60_000);
    expect(session).toMatchObject({ type: 'strength', startedAt: T0, finishedAt: T0 + 60_000, planId: 7, dayIndex: 1 });
    expect(sets).toHaveLength(3);
    expect(sets.every((s) => s.unit === 'kg' && s.completed)).toBe(true);

    const id = await saveSession(session, sets, d);
    const loaded = await getSession(id, d);
    expect(loaded?.sets.map((s) => [s.weight, s.reps])).toEqual([[20, 10], [20, 8], [10, 12]]);
    const sum = summarize(loaded!.sets);
    expect(sum).toEqual({ exerciseIds: [w.exercises[0].exerciseId, w.exercises[1].exerciseId], sets: 3, volume: 200 + 160 + 120 });
    expect((await listSessions(d))[0].session.dayName).toBe(plan.days[1].name);
    await d.delete();
  });
});
