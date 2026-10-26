import type { SetLog } from './types';

/** Volume = weight × reps over completed sets (bodyweight sets with weight 0 add 0). */
export function setVolume(s: Pick<SetLog, 'weight' | 'reps' | 'completed'>): number {
  return s.completed ? Math.max(0, s.weight) * Math.max(0, s.reps) : 0;
}

export function totalVolume(sets: Pick<SetLog, 'weight' | 'reps' | 'completed'>[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0);
}

export function completedSetCount(sets: Pick<SetLog, 'completed'>[]): number {
  return sets.filter((s) => s.completed).length;
}

/** Epley estimated one-rep max. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
