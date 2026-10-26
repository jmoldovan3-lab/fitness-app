import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FitnessDB, exportAll, getProfile, getSession, importAll, lastSetFor, listSessions,
  saveDraft, getDraft, clearDraft, saveProfile, saveSession, getBuilt, saveBuilt, clearBuilt,
} from '../src/db';
import Dexie from 'dexie';
import { generateSession } from '../src/generator';
import { EXERCISES } from '../src/data/exercises';
import type { Profile } from '../src/types';

const profile: Profile = { goal: 'strength', experience: 'beginner', sessionMinutes: 45, equipment: ['dumbbell', 'bench'], units: 'kg' };
let n = 0;
const dbs: FitnessDB[] = [];
const fresh = () => { const d = new FitnessDB(`test-${n++}`); dbs.push(d); return d; };
afterEach(async () => { for (const d of dbs.splice(0)) await d.delete(); });

async function seed(d: FitnessDB) {
  await saveProfile(profile, d);
  const sid = await saveSession({ type: 'strength', startedAt: 2000, finishedAt: 5000, focus: 'full', dayName: 'Full Body A' }, [
    { exerciseId: 'Dumbbell_Bench_Press', setIndex: 0, weight: 20, reps: 8, unit: 'kg', completed: true, completedAt: 2100 },
    { exerciseId: 'Dumbbell_Bench_Press', setIndex: 1, weight: 22.5, reps: 6, unit: 'kg', completed: true, completedAt: 2200, rpe: 8 },
    { exerciseId: 'Dumbbell_Squat', setIndex: 0, weight: 0, reps: 0, unit: 'kg', completed: false },
  ], d);
  await saveSession({ type: 'strength', startedAt: 9000, finishedAt: 9500, dayName: 'Full Body B' }, [
    { exerciseId: 'Dumbbell_Bench_Press', setIndex: 0, weight: 25, reps: 5, unit: 'kg', completed: true, completedAt: 9100 },
  ], d);
  return { sid };
}

describe('storage', () => {
  it('persists profile and today’s built workout', async () => {
    const d = fresh();
    await seed(d);
    expect(await getProfile(d)).toEqual(profile);
    const built = generateSession({ focus: 'upper', muscles: [], minutes: 45, equipment: profile.equipment, goal: 'strength', experience: 'beginner', seed: 1 }, EXERCISES, 1000);
    await saveBuilt(built, d);
    expect(await getBuilt(d)).toEqual(built);
    await clearBuilt(d);
    expect(await getBuilt(d)).toBeUndefined();
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
    await expect(importAll({ app: 'fitness-app', version: 9, settings: [], sessions: [], sets: [] }, d)).rejects.toThrow(/Not a fitness-app/);
    expect(await getProfile(d)).toEqual(profile);
  });

  it('imports a legacy v1 export (plans ignored, currentPlanId dropped)', async () => {
    const d = fresh();
    await importAll({
      app: 'fitness-app', version: 1, exportedAt: '', plans: [{ id: 1, days: [] }],
      settings: [{ key: 'profile', value: profile }, { key: 'currentPlanId', value: 1 }],
      sessions: [{ id: 3, type: 'strength', startedAt: 10, planId: 1, dayIndex: 0, dayName: 'Upper A' }],
      sets: [{ id: 1, sessionId: 3, exerciseId: 'Pullups', setIndex: 0, weight: 0, reps: 8, unit: 'kg', completed: true, completedAt: 11 }],
    }, d);
    expect(await getProfile(d)).toEqual(profile);
    expect(await d.settings.get('currentPlanId')).toBeUndefined();
    expect((await listSessions(d))[0].sets).toHaveLength(1);
  });
});

describe('Dexie migration v1 → v2', () => {
  it('drops the plans table and plan pointer but keeps profile, sessions, sets and draft', async () => {
    const name = `migrate-${n++}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      settings: 'key', plans: '++id, createdAt', sessions: '++id, type, startedAt',
      sets: '++id, sessionId, exerciseId, [exerciseId+completedAt]',
    });
    const oldProfile = { ...profile, daysPerWeek: 4, sessionMinutes: 60 };
    await v1.table('settings').bulkPut([
      { key: 'profile', value: oldProfile }, { key: 'currentPlanId', value: 1 },
      { key: 'activeWorkout', value: { dayName: 'Upper A', dayIndex: 0, planId: 1, startedAt: 5, units: 'kg', current: 0, exercises: [] } },
    ]);
    await v1.table('plans').add({ createdAt: 1, days: [] });
    const sid = await v1.table('sessions').add({ type: 'strength', startedAt: 100, finishedAt: 200, planId: 1, dayIndex: 0, dayName: 'Upper A' });
    await v1.table('sets').add({ sessionId: sid, exerciseId: 'Pullups', setIndex: 0, weight: 0, reps: 8, unit: 'kg', completed: true, completedAt: 150 });
    v1.close();

    const d = new FitnessDB(name);
    dbs.push(d);
    await d.open();
    expect(d.verno).toBe(2);
    expect(d.tables.map((t) => t.name).sort()).toEqual(['sessions', 'sets', 'settings']);
    expect(await getProfile(d)).toEqual(oldProfile);
    expect(await d.settings.get('currentPlanId')).toBeUndefined();
    expect((await getDraft<{ dayName: string }>(d))?.dayName).toBe('Upper A');
    const list = await listSessions(d);
    expect(list).toHaveLength(1);
    expect(list[0].session.dayName).toBe('Upper A');
    expect(list[0].sets[0].reps).toBe(8);
    expect((await lastSetFor('Pullups', d))?.reps).toBe(8);
  });

  it('normalises an out-of-range legacy session length', async () => {
    const name = `migrate-${n++}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ settings: 'key', plans: '++id, createdAt', sessions: '++id, type, startedAt', sets: '++id, sessionId, exerciseId, [exerciseId+completedAt]' });
    await v1.table('settings').put({ key: 'profile', value: { ...profile, sessionMinutes: 50 } });
    v1.close();
    const d = new FitnessDB(name);
    dbs.push(d);
    expect((await getProfile(d))?.sessionMinutes).toBe(45);
  });
});
