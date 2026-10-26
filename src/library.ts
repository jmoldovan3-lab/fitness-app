// Pure library search/filter over the exercise list.
import type { Category, Equipment, Exercise, Muscle } from './types';

export interface LibraryQuery {
  q?: string;
  muscle?: Muscle | '';
  /** 'bodyweight' = needs no equipment */
  equipment?: Equipment | 'bodyweight' | '';
  category?: Category | '';
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Filters and ranks exercises. Name matches rank above muscle-only matches; ties sort by name. */
export function filterExercises(all: Exercise[], query: LibraryQuery): Exercise[] {
  const tokens = norm(query.q ?? '').split(' ').filter(Boolean);
  const out: { e: Exercise; rank: number }[] = [];
  for (const e of all) {
    if (query.muscle && !e.primaryMuscles.includes(query.muscle) && !e.secondaryMuscles.includes(query.muscle)) continue;
    if (query.equipment === 'bodyweight' ? e.equipment.length > 0 : query.equipment && !e.equipment.includes(query.equipment)) continue;
    if (query.category && e.category !== query.category) continue;
    let rank = query.muscle && e.primaryMuscles.includes(query.muscle) ? 0 : 1;
    if (tokens.length) {
      const name = norm(e.name);
      const hay = `${name} ${norm(e.primaryMuscles.join(' '))}`;
      if (!tokens.every((t) => hay.includes(t))) continue;
      const q = tokens.join(' ');
      const words = name.split(' ');
      rank += name.startsWith(q) ? 0 : tokens.every((t) => words.some((w) => w.startsWith(t))) ? 2 : tokens.every((t) => name.includes(t)) ? 4 : 6;
    }
    out.push({ e, rank });
  }
  out.sort((a, b) => a.rank - b.rank || a.e.name.localeCompare(b.e.name));
  return out.map((x) => x.e);
}

export function facetValues<K extends 'category'>(all: Exercise[], key: K): Exercise[K][] {
  return [...new Set(all.map((e) => e[key]))].sort();
}
export function muscleValues(all: Exercise[]): Muscle[] {
  return [...new Set(all.flatMap((e) => e.primaryMuscles))].sort();
}
