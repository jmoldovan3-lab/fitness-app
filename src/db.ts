import Dexie, { type Table } from 'dexie';
import type { BuiltWorkout, Profile, Session, SetLog, SettingRow } from './types';

export class FitnessDB extends Dexie {
  settings!: Table<SettingRow, string>;
  sessions!: Table<Session, number>;
  sets!: Table<SetLog, number>;

  constructor(name = 'fitness') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      plans: '++id, createdAt',
      sessions: '++id, type, startedAt',
      sets: '++id, sessionId, exerciseId, [exerciseId+completedAt]',
    });
    // v2: per-session builder replaces weekly plans. Drop the plans table and the
    // current-plan pointer; sessions, sets and the profile are kept unchanged.
    this.version(2).stores({ plans: null }).upgrade(async (tx) => {
      await tx.table('settings').delete('currentPlanId');
      const row = await tx.table('settings').get('profile');
      const p = row?.value as Profile | undefined;
      if (p && ![20, 30, 45, 60, 75, 90].includes(p.sessionMinutes)) {
        await tx.table('settings').put({ key: 'profile', value: { ...p, sessionMinutes: 45 } });
      }
      // An in-progress workout from v1 is still compatible (same shape); keep it.
    });
  }
}

export const db = new FitnessDB();

// ---- profile ----
export async function getProfile(d: FitnessDB = db): Promise<Profile | undefined> {
  return (await d.settings.get('profile'))?.value as Profile | undefined;
}
export async function saveProfile(p: Profile, d: FitnessDB = db) {
  await d.settings.put({ key: 'profile', value: p });
}

// ---- today's built (not yet started) workout ----
export async function getBuilt(d: FitnessDB = db): Promise<BuiltWorkout | undefined> {
  return (await d.settings.get('todayWorkout'))?.value as BuiltWorkout | undefined;
}
export async function saveBuilt(w: BuiltWorkout, d: FitnessDB = db) {
  await d.settings.put({ key: 'todayWorkout', value: w });
}
export async function clearBuilt(d: FitnessDB = db) {
  await d.settings.delete('todayWorkout');
}

// ---- sessions ----
export async function saveSession(session: Session, sets: Omit<SetLog, 'sessionId' | 'id'>[], d: FitnessDB = db): Promise<number> {
  return d.transaction('rw', d.sessions, d.sets, async () => {
    const sessionId = await d.sessions.add({ ...session, id: undefined });
    await d.sets.bulkAdd(sets.map((s) => ({ ...s, sessionId })));
    return sessionId;
  });
}

export interface SessionWithSets { session: Session; sets: SetLog[] }

export async function listSessions(d: FitnessDB = db, limit?: number): Promise<SessionWithSets[]> {
  let q = d.sessions.orderBy('startedAt').reverse();
  if (limit) q = q.limit(limit);
  const sessions = await q.toArray();
  const all = await d.sets.where('sessionId').anyOf(sessions.map((s) => s.id!)).toArray();
  return sessions.map((session) => ({
    session,
    sets: all.filter((s) => s.sessionId === session.id).sort((a, b) => a.id! - b.id!),
  }));
}

export async function getSession(id: number, d: FitnessDB = db): Promise<SessionWithSets | undefined> {
  const session = await d.sessions.get(id);
  if (!session) return undefined;
  const sets = (await d.sets.where('sessionId').equals(id).toArray()).sort((a, b) => a.id! - b.id!);
  return { session, sets };
}

/** Most recent completed set for an exercise (used to pre-fill weight). */
export async function lastSetFor(exerciseId: string, d: FitnessDB = db): Promise<SetLog | undefined> {
  return d.sets.where('[exerciseId+completedAt]').between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey]).last();
}

// ---- in-progress workout draft ----
export async function getDraft<T>(d: FitnessDB = db): Promise<T | undefined> {
  return (await d.settings.get('activeWorkout'))?.value as T | undefined;
}
export async function saveDraft(value: unknown, d: FitnessDB = db) {
  await d.settings.put({ key: 'activeWorkout', value });
}
export async function clearDraft(d: FitnessDB = db) {
  await d.settings.delete('activeWorkout');
}

// ---- export / import ----
export interface ExportFile {
  app: 'fitness-app';
  version: 2;
  exportedAt: string;
  settings: SettingRow[];
  sessions: Session[];
  sets: SetLog[];
}

export async function exportAll(d: FitnessDB = db): Promise<ExportFile> {
  return d.transaction('r', [d.settings, d.sessions, d.sets], async () => ({
    app: 'fitness-app' as const,
    version: 2 as const,
    exportedAt: new Date().toISOString(),
    settings: await d.settings.toArray(),
    sessions: await d.sessions.toArray(),
    sets: await d.sets.toArray(),
  }));
}

/** Accepts v2 exports and legacy v1 exports (whose `plans` are ignored). */
export function validateExport(data: unknown): asserts data is ExportFile {
  const f = data as ExportFile;
  if (!f || f.app !== 'fitness-app' || ![1, 2].includes(f.version)) throw new Error('Not a fitness-app export file');
  for (const k of ['settings', 'sessions', 'sets'] as const) {
    if (!Array.isArray(f[k])) throw new Error(`Export file is missing "${k}"`);
  }
}

/** Replaces all user data with the contents of an export file. */
export async function importAll(data: unknown, d: FitnessDB = db): Promise<void> {
  validateExport(data);
  await d.transaction('rw', [d.settings, d.sessions, d.sets], async () => {
    await Promise.all([d.settings.clear(), d.sessions.clear(), d.sets.clear()]);
    await d.settings.bulkPut(data.settings.filter((r) => r.key !== 'currentPlanId'));
    await d.sessions.bulkPut(data.sessions);
    await d.sets.bulkPut(data.sets);
  });
}
