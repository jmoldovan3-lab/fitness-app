export type Goal = 'strength' | 'hypertrophy' | 'general' | 'conditioning';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Equipment =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'cable' | 'machine' | 'bands' | 'pullupBar' | 'bench'
  | 'medicineBall' | 'stabilityBall' | 'foamRoller' | 'other';
export type Units = 'kg' | 'lb';
export type SessionMinutes = 20 | 30 | 45 | 60 | 75 | 90;
export type Focus = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'core';
export type Muscle =
  | 'abdominals' | 'abductors' | 'adductors' | 'biceps' | 'calves' | 'chest' | 'forearms' | 'glutes' | 'hamstrings'
  | 'lats' | 'lower back' | 'middle back' | 'neck' | 'quadriceps' | 'shoulders' | 'traps' | 'triceps';
export type Category = 'strength' | 'stretching' | 'plyometrics' | 'strongman' | 'powerlifting' | 'cardio' | 'olympic weightlifting';

export type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'hpush' | 'vpush' | 'hpull' | 'vpull' | 'core'
  | 'biceps' | 'triceps' | 'shoulders' | 'calves' | 'conditioning' | 'other' | 'stretch' | 'cardio';
export type Role = 'main' | 'secondary' | 'accessory';
export type LoadType = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'band' | 'bodyweight' | 'other';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  pattern: Pattern;
  role: Role;
  /** App equipment keys required (all must be available); empty = bodyweight. */
  equipment: Equipment[];
  skill: number;
  loadType: LoadType;
  force?: string;
  mechanic?: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  instructions: string[];
  images: string[];
  /** Hand-curated staple (preferred by the generator). */
  featured?: boolean;
  /** Eligible for generated workouts. */
  gen?: boolean;
}

/** Saved defaults from onboarding (editable in Settings). */
export interface Profile {
  goal: Goal;
  experience: Experience;
  /** Default session length for the builder. */
  sessionMinutes: SessionMinutes;
  equipment: Equipment[];
  units: Units;
  /** @deprecated weekly-plan era; ignored */
  daysPerWeek?: number;
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
  /** Slot role the prescription was made for (kept when swapping). */
  role?: Role;
}

/** Inputs to the single-session generator. */
export interface BuildInput {
  focus: Focus;
  muscles: Muscle[];
  minutes: SessionMinutes;
  equipment: Equipment[];
  goal: Goal;
  experience: Experience;
  seed: number;
}

/** A workout built for today's session (editable before Start). */
export interface BuiltWorkout {
  createdAt: number;
  input: BuildInput;
  title: string;
  exercises: PlannedExercise[];
  notes: string[];
}

export type SessionType = 'strength' | 'run' | 'ride';

export interface Session {
  id?: number;
  type: SessionType;
  startedAt: number;
  finishedAt?: number;
  /** Session title, e.g. "Upper body" */
  dayName?: string;
  focus?: Focus;
  /** legacy (weekly plan era) */
  planId?: number;
  dayIndex?: number;
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
