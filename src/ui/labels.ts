import type { Category, Equipment, Experience, Focus, Goal, Muscle, PlannedExercise, SessionMinutes } from '../types';

export const GOALS: [Goal, string][] = [
  ['strength', 'Strength'], ['hypertrophy', 'Muscle'], ['general', 'General fitness'], ['conditioning', 'Fat loss / conditioning'],
];
export const EXPERIENCE: [Experience, string][] = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];
export const MINUTES: SessionMinutes[] = [20, 30, 45, 60, 75, 90];
export const FOCI: [Focus, string][] = [
  ['full', 'Full body'], ['upper', 'Upper'], ['lower', 'Lower'], ['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs'], ['core', 'Core'],
];
/** Equipment offered in the builder/profile. */
export const EQUIPMENT: [Equipment, string][] = [
  ['barbell', 'Barbell'], ['dumbbell', 'Dumbbells'], ['kettlebell', 'Kettlebell'], ['bench', 'Bench'],
  ['pullupBar', 'Pull-up / dip bar'], ['cable', 'Cable'], ['machine', 'Machines'], ['bands', 'Bands'],
  ['medicineBall', 'Medicine ball'], ['stabilityBall', 'Exercise ball'],
];
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  ...(Object.fromEntries(EQUIPMENT) as Record<Equipment, string>), foamRoller: 'Foam roller', other: 'Other / special',
};
export const MUSCLES: Muscle[] = [
  'chest', 'shoulders', 'triceps', 'lats', 'middle back', 'traps', 'biceps', 'forearms', 'abdominals', 'lower back',
  'glutes', 'quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors', 'neck',
];
export const CATEGORY_LABEL: Record<Category, string> = {
  strength: 'Strength', powerlifting: 'Powerlifting', 'olympic weightlifting': 'Olympic lifting', strongman: 'Strongman',
  plyometrics: 'Plyometrics', stretching: 'Stretching', cardio: 'Cardio',
};
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export const equipmentText = (eq: Equipment[]) => (eq.length ? eq.map((e) => EQUIPMENT_LABEL[e]).join(' + ') : 'Bodyweight');

export const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

export function rxText(e: Pick<PlannedExercise, 'sets' | 'repMin' | 'repMax' | 'unit'>): string {
  const reps = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}–${e.repMax}`;
  return `${e.sets} × ${reps}${e.unit === 'sec' ? 's' : ''}`;
}
export function restText(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`;
}
