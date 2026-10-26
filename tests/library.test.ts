import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../src/data/exercises';
import { filterExercises, muscleValues } from '../src/library';

describe('library search & filter', () => {
  it('no query returns everything sorted by name', () => {
    const all = filterExercises(EXERCISES, {});
    expect(all).toHaveLength(EXERCISES.length);
    const names = all.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it('search is case-insensitive, multi-word, and ranks prefix matches first', () => {
    const r = filterExercises(EXERCISES, { q: 'BENCH press' });
    expect(r.length).toBeGreaterThan(10);
    expect(r.every((e) => /bench/i.test(e.name) && /press/i.test(e.name) || e.primaryMuscles.join(' ').includes('bench'))).toBe(true);
    expect(r[0].name.toLowerCase().startsWith('bench press')).toBe(true);
    expect(filterExercises(EXERCISES, { q: 'pull-up' }).some((e) => e.id === 'Pullups' || /pull-?up/i.test(e.name))).toBe(true);
    expect(filterExercises(EXERCISES, { q: 'zzzzqq' })).toHaveLength(0);
  });
  it('filters by muscle, equipment and category (combined)', () => {
    const r = filterExercises(EXERCISES, { muscle: 'biceps', equipment: 'dumbbell', category: 'strength' });
    expect(r.length).toBeGreaterThan(5);
    for (const e of r) {
      expect([...e.primaryMuscles, ...e.secondaryMuscles]).toContain('biceps');
      expect(e.equipment).toContain('dumbbell');
      expect(e.category).toBe('strength');
    }
    // primary-muscle matches rank before secondary-only ones
    const firstSecondary = r.findIndex((e) => !e.primaryMuscles.includes('biceps'));
    if (firstSecondary >= 0) expect(r.slice(firstSecondary).every((e) => !e.primaryMuscles.includes('biceps'))).toBe(true);
  });
  it('bodyweight filter means no equipment', () => {
    const r = filterExercises(EXERCISES, { equipment: 'bodyweight' });
    expect(r.length).toBeGreaterThan(100);
    expect(r.every((e) => e.equipment.length === 0)).toBe(true);
  });
  it('stretching category is browsable', () => {
    expect(filterExercises(EXERCISES, { category: 'stretching' }).length).toBeGreaterThan(100);
  });
  it('lists all 17 muscles', () => {
    expect(muscleValues(EXERCISES)).toHaveLength(17);
  });
});
