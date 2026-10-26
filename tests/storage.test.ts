import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FitnessDB, exportAll, getCurrentPlan, getProfile, getSession, importAll, lastSetFor, listSessions,
  saveDraft, getDraft, clearDraft, savePlan, saveProfile, saveSession,
} from '../src/db';
import { generatePlan } from '../src/generator';
import { EXERCISES } from '../src/data/exercises';
import type { Profile } from '../src/types';

const profile: Profile = { goal: 'strength', experience: 'beginner', daysPerWeek: 3, sessionMinutes: 45, equipment: ['dumbbell', 'bench'], units: 'kg' };
let n = 0;
const dbs: FitnessDB[] = [];
const fresh = () => { const d = new FitnessDB(`test-${n++}`); dbs.push(d); return d; };
afterEach(async () => { for (const d of dbs.splice(0)) await d.delete(); });

async function seed(d: FitnessDB) {
  await saveProfile(profile, d);
  const planId = await savePlan(generatePlan(profile, EXERCISES, { seed: 1, createdAt: 1000 }), d);
  const sid = await saveSession({ type: 'strength', startedAt: 2000, finishedAt: 5000, planId, dayIndex: 0, dayName: 'Full Body A' }, [
    { exerciseId: 'Dumbbell_Bench_Press', setIndex: 0, weight: 20, reps: 8, unit: 'kg', completed: true, completedAt: 2100 },
    { exerciseId: 'Dumbbell_Bench_Press', setIndex: 1, weight: 22.5, reps: 6, unit: 'kg', completed: true, completedAt: 2200, rpe: 8 },
    { exerciseId: 'Dumbbell_Squat', setIndex: 0, weight: 0, reps: 0, unit: 'kg', completed: false },
  ], d);
  await saveSession({ type: 'strength', startedAt: 9000, finishedAt: 9500, dayName: 'Full Body B' }, [
    { exerciseId: 'Dumbbell_Bench_Press', setIndex: 0, weight: 25, reps: 5, unit: 'kg', completed: true, completedAt: 9100 },
  ], d);
  return { planId, sid };
}

describe('storage', () => {
  it('persists profile and current plan', async () => {
    const d = fresh();
    const { planId } = await seed(d);
    expect(await getProfile(d)).toEqual(profile);
    const plan = await getCurrentPlan(d);
    expect(plan?.id).toBe(planId);
    expect(plan?.days).toHaveLength(3);
  });

  it('saves and loads sessions with sets, newest first', async () => {
    const d = fresh();
    const { sid } = await seed(d);
    const list = await listSessions(d);
    expect(list.map((s) => s.session.dayName)).toEqual(['Full Body B', 'Full Body A']);
    const detail = await getSession(sid, d);
    expect(detail?.session.type).toBe('strength');
    expect(detail?.sets).toHaveLength(3);
    expect(detail?.sets.every((s) => s.sessionId === sid)).toBe(true);
    expect((await lastSetFor('Dumbbell_Bench_Press', d))?.weight).toBe(25);
    expect(await lastSetFor('Nope', d)).toBeUndefined();
  });

  it('stores and clears an in-progress draft', async () => {
    const d = fresh();
    await saveDraft({ dayIndex: 1 }, d);
    expect(await getDraft(d)).toEqual({ dayIndex: 1 });
    await clearDraft(d);
    expect(await getDraft(d)).toBeUndefined();
  });

  it('export → import round-trips all user data into an empty database', async () => {
    const src = fresh();
    await seed(src);
    const dump = await exportAll(src);
    expect(dump.sessions).toHaveLength(2);
    expect(dump.sets).toHaveLength(4);
    const json = JSON.parse(JSON.stringify(dump));

    const dst = fresh();
    await saveProfile({ ...profile, units: 'lb' }, dst); // pre-existing data gets replaced
    await importAll(json, dst);
    const again = await exportAll(dst);
    expect({ ...again, exportedAt: '' }).toEqual({ ...dump, exportedAt: '' });
    expect(await getProfile(dst)).toEqual(profile);
    expect((await listSessions(dst))[0].sets[0].weight).toBe(25);
  });

  it('rejects invalid import files without touching data', async () => {
    const d = fresh();
    await seed(d);
    await expect(importAll({ app: 'other' }, d)).rejects.toThrow(/Not a fitness-app/);
    await expect(importAll({ app: 'fitness-app', version: 1, settings: [] }, d)).rejects.toThrow(/missing/);
    expect(await getProfile(d)).toEqual(profile);
  });
});
