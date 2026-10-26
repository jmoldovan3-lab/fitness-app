import raw from './exercises.json';
import type { Exercise } from '../types';

export const EXERCISES = raw as Exercise[];
export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
