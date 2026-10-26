export type Goal = 'strength' | 'hypertrophy' | 'general' | 'conditioning';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'barbell' | 'dumbbell' | 'kettlebell' | 'cable' | 'machine' | 'bands' | 'pullupBar' | 'bench';
export type Units = 'kg' | 'lb';
export type SessionMinutes = 30 | 45 | 60 | 75 | 90;

export type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'hpush' | 'vpush' | 'hpull' | 'vpull' | 'core'
  | 'biceps' | 'triceps' | 'shoulders' | 'calves' | 'conditioning';
export type Role = 'main' | 'secondary' | 'accessory';
export type LoadType = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'band' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  role: Role;
  equipment: Equipment[];
  skill: number;
  loadType: LoadType;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

export interface Profile {
  goal: Goal;
  experience: Experience;
  daysPerWeek: number;
  sessionMinutes: SessionMinutes;
  equipment: Equipment[];
  units: Units;
}

export interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  /** 'sec' for timed holds such as planks */
  unit: 'reps' | 'sec';
  restSec: number;
}

export interface PlannedExercise extends Prescription {
  exerciseId: string;
  pattern: Pattern;
}

export interface PlanDay {
  name: string;
  focus: string;
  exercises: PlannedExercise[];
  estMinutes: number;
}

export interface Plan {
  id?: number;
  createdAt: number;
  seed: number;
  profile: Profile;
  split: string;
  days: PlanDay[];
  notes: string[];
}

export type SessionType = 'strength' | 'run' | 'ride';

export interface Session {
  id?: number;
  type: SessionType;
  startedAt: number;
  finishedAt?: number;
  planId?: number;
  dayIndex?: number;
  dayName?: string;
  /** cardio (later): metres and seconds */
  distanceM?: number;
  durationSec?: number;
  notes?: string;
}

export interface SetLog {
  id?: number;
  sessionId: number;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  unit: Units;
  rpe?: number;
  completed: boolean;
  completedAt?: number;
}

export interface SettingRow { key: string; value: unknown }
