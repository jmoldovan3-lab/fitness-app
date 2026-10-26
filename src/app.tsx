import { useEffect, useState } from 'preact/hooks';
import { EXERCISES } from './data/exercises';
import { clearDraft, getCurrentPlan, getDraft, getProfile, lastSetFor, saveDraft, savePlan, saveProfile, saveSession } from './db';
import { generatePlan } from './generator';
import type { Plan, Profile } from './types';
import { createWorkout, toRecords, type ActiveWorkout } from './workout';
import { History } from './ui/History';
import { Onboarding } from './ui/Onboarding';
import { Player } from './ui/Player';
import { Placeholder } from './ui/Placeholder';
import { PlanView } from './ui/PlanView';
import { Settings } from './ui/Settings';
import { TabBar, type Tab } from './ui/TabBar';

const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

export function App() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile>();
  const [plan, setPlan] = useState<Plan>();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('plan');
  const [workout, setWorkout] = useState<ActiveWorkout>();
  const [historyId, setHistoryId] = useState<number>();

  const load = async () => {
    const [p, pl, draft] = await Promise.all([getProfile(), getCurrentPlan(), getDraft<ActiveWorkout>()]);
    setProfile(p);
    setPlan(pl);
    setWorkout(draft);
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const generate = async (p: Profile) => {
    const next = generatePlan(p, EXERCISES, { seed: newSeed(), createdAt: Date.now() });
    await saveProfile(p);
    const id = await savePlan(next);
    setProfile(p);
    setPlan({ ...next, id });
    setEditing(false);
    setTab('plan');
    window.scrollTo(0, 0);
  };

  const updateWorkout = (w: ActiveWorkout) => { setWorkout(w); void saveDraft(w); };

  const start = async (dayIndex: number) => {
    if (!plan) return;
    const ids = plan.days[dayIndex].exercises.map((e) => e.exerciseId);
    const last = await Promise.all(ids.map((id) => lastSetFor(id)));
    const weights = Object.fromEntries(ids.flatMap((id, i) => (last[i] && last[i]!.unit === plan.profile.units ? [[id, last[i]!.weight]] : [])));
    updateWorkout(createWorkout(plan, dayIndex, Date.now(), weights));
    window.scrollTo(0, 0);
  };

  const finish = async (w: ActiveWorkout) => {
    const { session, sets } = toRecords(w, Date.now());
    const id = await saveSession(session, sets);
    await clearDraft();
    setWorkout(undefined);
    setHistoryId(id);
    setTab('history');
    window.scrollTo(0, 0);
  };

  const discard = async () => { await clearDraft(); setWorkout(undefined); };

  if (!loaded) return <div class="screen" />;
  if (workout) return <Player workout={workout} onChange={updateWorkout} onFinish={finish} onDiscard={discard} />;

  let body;
  if (tab === 'plan') {
    body = !plan || editing
      ? <Onboarding initial={profile} onGenerate={generate} onCancel={plan ? () => setEditing(false) : undefined} />
      : <PlanView plan={plan} onEdit={() => setEditing(true)} onRegenerate={() => generate(plan.profile)} onStart={start} />;
  } else if (tab === 'history') {
    body = <History openId={historyId} onOpen={setHistoryId} />;
  } else if (tab === 'progress') {
    body = <Placeholder title="Progress" text="Volume, estimated 1RM and per-lift charts are coming soon." />;
  } else {
    body = <Settings onImported={load} />;
  }

  return (
    <>
      <main class="main">{body}</main>
      <TabBar tab={tab} onTab={(t) => { setTab(t); setHistoryId(undefined); window.scrollTo(0, 0); }} />
    </>
  );
}
