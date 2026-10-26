// Pure state helpers for an in-progress strength workout. All functions return new objects.
import type { Plan, Prescription, Session, SetLog, Units } from './types';
import { completedSetCount, totalVolume } from './stats';

export interface WorkoutSet { weight: number; reps: number; completed: boolean; completedAt?: number }
export interface WorkoutExercise extends Omit<Prescription, 'sets'> { exerciseId: string; sets: WorkoutSet[] }
export interface Rest { startedAt: number; endsAt: number; exerciseIndex: number }
export interface ActiveWorkout {
  planId?: number;
  dayIndex: number;
  dayName: string;
  startedAt: number;
  units: Units;
  current: number;
  exercises: WorkoutExercise[];
  rest?: Rest;
}

export function createWorkout(plan: Plan, dayIndex: number, now: number, lastWeight: Record<string, number> = {}): ActiveWorkout {
  const day = plan.days[dayIndex];
  if (!day) throw new RangeError(`No day ${dayIndex} in plan`);
  return {
    planId: plan.id, dayIndex, dayName: day.name, startedAt: now, units: plan.profile.units, current: 0,
    exercises: day.exercises.map(({ exerciseId, sets, repMin, repMax, unit, restSec }) => ({
      exerciseId, sets: Array.from({ length: sets }, () => ({ weight: lastWeight[exerciseId] ?? 0, reps: repMin, completed: false })),
      repMin, repMax, unit, restSec,
    })),
  };
}

const mapEx = (w: ActiveWorkout, i: number, f: (e: WorkoutExercise) => WorkoutExercise): ActiveWorkout => ({
  ...w, exercises: w.exercises.map((e, j) => (j === i ? f(e) : e)),
});

export function updateSet(w: ActiveWorkout, ex: number, set: number, patch: Partial<Pick<WorkoutSet, 'weight' | 'reps'>>): ActiveWorkout {
  return mapEx(w, ex, (e) => {
    const sets = e.sets.map((s, k) => (k === set ? { ...s, ...patch } : s));
    // Changing weight on a set carries forward to later, not-yet-completed sets.
    if (patch.weight != null) for (let k = set + 1; k < sets.length; k++) if (!sets[k].completed) sets[k] = { ...sets[k], weight: patch.weight };
    return { ...e, sets };
  });
}

/** Toggle a set's completion. Completing a set starts the rest timer with the exercise's rest time. */
export function toggleSet(w: ActiveWorkout, ex: number, set: number, now: number): ActiveWorkout {
  const target = w.exercises[ex]?.sets[set];
  if (!target) return w;
  const completed = !target.completed;
  const next = mapEx(w, ex, (e) => ({
    ...e, sets: e.sets.map((s, k) => (k === set ? { ...s, completed, completedAt: completed ? now : undefined } : s)),
  }));
  if (!completed) return next;
  const restSec = w.exercises[ex].restSec;
  return { ...next, rest: { startedAt: now, endsAt: now + restSec * 1000, exerciseIndex: ex } };
}

export function addSet(w: ActiveWorkout, ex: number): ActiveWorkout {
  return mapEx(w, ex, (e) => {
    const last = e.sets[e.sets.length - 1];
    return { ...e, sets: [...e.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? e.repMin, completed: false }] };
  });
}

export function extendRest(w: ActiveWorkout, sec: number): ActiveWorkout {
  return w.rest ? { ...w, rest: { ...w.rest, endsAt: w.rest.endsAt + sec * 1000 } } : w;
}
export function skipRest(w: ActiveWorkout): ActiveWorkout {
  const { rest: _rest, ...rest } = w;
  return rest;
}
export function restRemainingSec(w: ActiveWorkout, now: number): number {
  return w.rest ? Math.max(0, Math.ceil((w.rest.endsAt - now) / 1000)) : 0;
}
export function goTo(w: ActiveWorkout, index: number): ActiveWorkout {
  return { ...w, current: Math.min(Math.max(0, index), w.exercises.length - 1) };
}

export function isExerciseDone(e: WorkoutExercise): boolean {
  return e.sets.length > 0 && e.sets.every((s) => s.completed);
}

/** Converts the workout to DB records. Sets that were never completed are dropped. */
export function toRecords(w: ActiveWorkout, now: number): { session: Session; sets: Omit<SetLog, 'id' | 'sessionId'>[] } {
  const sets = w.exercises.flatMap((e) =>
    e.sets.map((s, setIndex) => ({ ...s, setIndex, exerciseId: e.exerciseId })).filter((s) => s.completed)
      .map(({ exerciseId, setIndex, weight, reps, completed, completedAt }) => ({ exerciseId, setIndex, weight, reps, completed, completedAt, unit: w.units })),
  );
  return {
    session: { type: 'strength', startedAt: w.startedAt, finishedAt: now, planId: w.planId, dayIndex: w.dayIndex, dayName: w.dayName },
    sets,
  };
}

export interface SessionSummary { exerciseIds: string[]; sets: number; volume: number }
export function summarize(sets: Pick<SetLog, 'exerciseId' | 'weight' | 'reps' | 'completed'>[]): SessionSummary {
  const exerciseIds = [...new Set(sets.filter((s) => s.completed).map((s) => s.exerciseId))];
  return { exerciseIds, sets: completedSetCount(sets), volume: totalVolume(sets) };
}
