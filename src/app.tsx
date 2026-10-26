import { useEffect, useMemo, useState } from 'preact/hooks';
import { EXERCISE_BY_ID, EXERCISES } from './data/exercises';
import {
  clearBuilt, clearDraft, getBuilt, getDraft, getProfile, lastSetFor, listSessions, saveBuilt, saveDraft, saveProfile, saveSession,
} from './db';
import { addExercise, generateSession, sessionTitle, suggestFocus, type FocusSuggestion, type RecentSession } from './generator';
import { prefetchExercises } from './offline';
import type { BuiltWorkout, Exercise, Profile } from './types';
import { createWorkout, toRecords, type ActiveWorkout } from './workout';
import { History } from './ui/History';
import { Home, type BuilderInput } from './ui/Home';
import { Library } from './ui/Library';
import { Onboarding } from './ui/Onboarding';
import { Player } from './ui/Player';
import { Placeholder } from './ui/Placeholder';
import { Settings } from './ui/Settings';
import { TabBar, type Tab } from './ui/TabBar';

const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const top = () => window.scrollTo(0, 0);

export function App() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile>();
  const [built, setBuilt] = useState<BuiltWorkout>();
  const [input, setInput] = useState<BuilderInput>();
  const [suggestion, setSuggestion] = useState<FocusSuggestion>({ focus: 'full', reason: '' });
  const [tab, setTab] = useState<Tab>('workout');
  const [workout, setWorkout] = useState<ActiveWorkout>();
  const [playing, setPlaying] = useState(false);
  const [historyId, setHistoryId] = useState<number>();
  const [libDetail, setLibDetail] = useState<string>();

  const load = async () => {
    const [p, b, draft, recent] = await Promise.all([getProfile(), getBuilt(), getDraft<ActiveWorkout>(), listSessions(undefined, 5)]);
    const history: RecentSession[] = recent.map(({ session, sets }) => ({
      startedAt: session.startedAt, focus: session.focus, exerciseIds: [...new Set(sets.filter((s) => s.completed).map((s) => s.exerciseId))],
    }));
    const sug = suggestFocus(history, EXERCISE_BY_ID, Date.now());
    // Built workouts are for one session: a leftover from another day is dropped.
    const todays = b && sameDay(b.createdAt, Date.now()) ? b : undefined;
    if (b && !todays) await clearBuilt();
    setProfile(p);
    setSuggestion(sug);
    setBuilt(todays);
    if (todays) prefetchExercises(todays.exercises.map((e) => e.exerciseId));
    setInput(todays
      ? { focus: todays.input.focus, muscles: todays.input.muscles, minutes: todays.input.minutes, equipment: todays.input.equipment }
      : p ? { focus: sug.focus, muscles: [], minutes: p.sessionMinutes, equipment: p.equipment } : undefined);
    setWorkout(draft);
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const inWorkout = useMemo(() => new Set(built?.exercises.map((e) => e.exerciseId) ?? []), [built]);

  const storeBuilt = (w: BuiltWorkout) => {
    setBuilt(w);
    void saveBuilt(w);
    prefetchExercises(w.exercises.map((e) => e.exerciseId));
  };
  const build = (seed = newSeed()) => {
    if (!profile || !input) return;
    storeBuilt(generateSession({ ...input, goal: profile.goal, experience: profile.experience, seed }, EXERCISES, Date.now()));
    top();
  };
  const reset = async () => { setBuilt(undefined); await clearBuilt(); top(); };

  const addFromLibrary = (ex: Exercise) => {
    if (!profile || !input) return;
    const base: BuiltWorkout = built ?? {
      createdAt: Date.now(), title: sessionTitle(input.focus, input.muscles), exercises: [], notes: [],
      input: { ...input, goal: profile.goal, experience: profile.experience, seed: newSeed() },
    };
    storeBuilt(addExercise(base, ex));
  };

  const updateWorkout = (w: ActiveWorkout) => { setWorkout(w); void saveDraft(w); };

  const start = async () => {
    if (!built || !profile) return;
    const ids = built.exercises.map((e) => e.exerciseId);
    prefetchExercises(ids);
    const last = await Promise.all(ids.map((id) => lastSetFor(id)));
    const weights = Object.fromEntries(ids.flatMap((id, i) => (last[i] && last[i]!.unit === profile.units ? [[id, last[i]!.weight]] : [])));
    updateWorkout(createWorkout(built, profile.units, Date.now(), weights));
    setPlaying(true);
    top();
  };

  const finish = async (w: ActiveWorkout) => {
    const { session, sets } = toRecords(w, Date.now());
    const id = await saveSession(session, sets);
    await Promise.all([clearDraft(), clearBuilt()]);
    setWorkout(undefined);
    setBuilt(undefined);
    setPlaying(false);
    setHistoryId(id);
    setTab('history');
    top();
    void load().then(() => { setTab('history'); setHistoryId(id); });
  };

  const discard = async () => { await clearDraft(); setWorkout(undefined); setPlaying(false); top(); };

  const saveDefaults = async (p: Profile) => {
    await saveProfile(p);
    setProfile(p);
    if (!built) setInput((i) => ({ focus: i?.focus ?? suggestion.focus, muscles: i?.muscles ?? [], minutes: p.sessionMinutes, equipment: p.equipment }));
  };

  if (!loaded) return <div class="screen" />;
  if (!profile || !input) {
    return <main class="main"><Onboarding onDone={async (p) => { await saveProfile(p); await load(); }} /></main>;
  }
  if (workout && playing) {
    return <Player workout={workout} onChange={updateWorkout} onFinish={finish} onDiscard={discard} onMinimize={() => { setPlaying(false); setTab('workout'); top(); }} />;
  }

  let body;
  if (tab === 'workout') {
    body = (
      <Home input={input} onInput={setInput} suggestion={suggestion} built={built} active={workout}
        onBuild={() => build()} onChangeBuilt={storeBuilt} onRegenerate={() => build()} onReset={reset}
        onAddFromLibrary={() => { setTab('library'); setLibDetail(undefined); top(); }}
        onStart={start} onResume={() => { setPlaying(true); top(); }} />
    );
  } else if (tab === 'library') {
    body = <Library inWorkout={inWorkout} onAdd={addFromLibrary} onViewWorkout={() => { setTab('workout'); top(); }} detailId={libDetail} onDetail={setLibDetail} />;
  } else if (tab === 'history') {
    body = <History openId={historyId} onOpen={setHistoryId} />;
  } else if (tab === 'progress') {
    body = <Placeholder title="Progress" text="Volume, estimated 1RM and per-lift charts are coming soon." />;
  } else {
    body = <Settings onImported={load} profile={profile} onProfile={saveDefaults} />;
  }

  return (
    <>
      <main class="main">{body}</main>
      <TabBar tab={tab} onTab={(t) => { setTab(t); setHistoryId(undefined); setLibDetail(undefined); top(); }} />
    </>
  );
}
