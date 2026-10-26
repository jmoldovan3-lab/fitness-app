import { useState } from 'preact/hooks';
import type { Equipment, Profile } from '../types';
import { Chips } from './Chips';
import { EQUIPMENT, EXPERIENCE, GOALS, MINUTES } from './labels';

export const DEFAULT_PROFILE: Profile = {
  goal: 'hypertrophy', experience: 'beginner', sessionMinutes: 45, equipment: ['dumbbell', 'bench'], units: 'kg',
};

export const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Profile defaults form: used for first-run onboarding and in Settings. */
export function ProfileForm({ initial, onSave, saveLabel, intro }: { initial?: Profile; onSave: (p: Profile) => void; saveLabel: string; intro?: boolean }) {
  const [p, setP] = useState<Profile>(initial ?? DEFAULT_PROFILE);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });
  return (
    <>
      {intro && (
        <header class="top">
          <h1>Welcome</h1>
          <p class="muted">Set your defaults once. Each time you open the app you build a workout for that session. Everything stays on this phone.</p>
        </header>
      )}
      <Chips name="goal" label="Goal" options={GOALS} value={p.goal} onChange={(v) => set('goal', v)} />
      <Chips name="experience" label="Experience" options={EXPERIENCE} value={p.experience} onChange={(v) => set('experience', v)} />
      <Chips name="default-minutes" label="Usual session length (min)" options={MINUTES.map((m) => [m, String(m)] as [typeof m, string])} value={p.sessionMinutes} onChange={(v) => set('sessionMinutes', v)} />
      <Chips name="profile-equipment" label="Equipment you usually have (bodyweight is always included)" multi options={EQUIPMENT} value={p.equipment} onChange={(e: Equipment) => set('equipment', toggle(p.equipment, e))} />
      <Chips name="units" label="Units" options={[['kg', 'kg'], ['lb', 'lb']]} value={p.units} onChange={(v) => set('units', v)} />
      <div class="actions">
        <button type="button" class="btn primary big" data-testid="save-profile" onClick={() => onSave(p)}>{saveLabel}</button>
      </div>
    </>
  );
}

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  return <section class="screen onboarding"><ProfileForm intro saveLabel="Save & continue" onSave={onDone} /></section>;
}
