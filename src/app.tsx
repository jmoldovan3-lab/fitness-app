import { useEffect, useState } from 'preact/hooks';
import { EXERCISES } from './data/exercises';
import { getCurrentPlan, getProfile, savePlan, saveProfile } from './db';
import { generatePlan } from './generator';
import type { Plan, Profile } from './types';
import { Onboarding } from './ui/Onboarding';
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

  const load = async () => {
    const [p, pl] = await Promise.all([getProfile(), getCurrentPlan()]);
    setProfile(p);
    setPlan(pl);
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

  if (!loaded) return <div class="screen" />;

  let body;
  if (tab === 'plan') {
    body = !plan || editing
      ? <Onboarding initial={profile} onGenerate={generate} onCancel={plan ? () => setEditing(false) : undefined} />
      : <PlanView plan={plan} onEdit={() => setEditing(true)} onRegenerate={() => generate(plan.profile)} onStart={() => {}} />;
  } else if (tab === 'history') {
    body = <Placeholder title="History" text="Finished workouts will show up here." />;
  } else if (tab === 'progress') {
    body = <Placeholder title="Progress" text="Volume, estimated 1RM and per-lift charts are coming soon." />;
  } else {
    body = <Settings onImported={load} />;
  }

  return (
    <>
      <main class="main">{body}</main>
      <TabBar tab={tab} onTab={(t) => { setTab(t); window.scrollTo(0, 0); }} />
    </>
  );
}
