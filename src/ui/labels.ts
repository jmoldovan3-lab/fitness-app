import type { Equipment, Experience, Goal, PlannedExercise, SessionMinutes } from '../types';

export const GOALS: [Goal, string][] = [
  ['strength', 'Strength'], ['hypertrophy', 'Muscle'], ['general', 'General fitness'], ['conditioning', 'Fat loss / conditioning'],
];
export const EXPERIENCE: [Experience, string][] = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];
export const DAYS = [2, 3, 4, 5, 6];
export const MINUTES: SessionMinutes[] = [30, 45, 60, 75, 90];
export const EQUIPMENT: [Equipment, string][] = [
  ['barbell', 'Barbell'], ['dumbbell', 'Dumbbells'], ['kettlebell', 'Kettlebell'], ['bench', 'Bench'],
  ['pullupBar', 'Pull-up bar'], ['cable', 'Cable'], ['machine', 'Machines'], ['bands', 'Bands'],
];

export const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

export function rxText(e: Pick<PlannedExercise, 'sets' | 'repMin' | 'repMax' | 'unit'>): string {
  const reps = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}–${e.repMax}`;
  return `${e.sets} × ${reps}${e.unit === 'sec' ? 's' : ''}`;
}
export function restText(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`;
}
