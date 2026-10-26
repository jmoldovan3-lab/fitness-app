import { useState } from 'preact/hooks';
import type { Equipment, Profile } from '../types';
import { Chips } from './Chips';
import { DAYS, EQUIPMENT, EXPERIENCE, GOALS, MINUTES } from './labels';

export const DEFAULT_PROFILE: Profile = {
  goal: 'hypertrophy', experience: 'beginner', daysPerWeek: 3, sessionMinutes: 60, equipment: ['dumbbell', 'bench'], units: 'kg',
};

export function Onboarding({ initial, onGenerate, onCancel }: { initial?: Profile; onGenerate: (p: Profile) => void; onCancel?: () => void }) {
  const [p, setP] = useState<Profile>(initial ?? DEFAULT_PROFILE);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });
  const toggleEq = (e: Equipment) =>
    set('equipment', p.equipment.includes(e) ? p.equipment.filter((x) => x !== e) : [...p.equipment, e]);

  return (
    <section class="screen onboarding">
      <header class="top">
        <h1>{initial ? 'Edit your setup' : 'Let’s build your plan'}</h1>
        <p class="muted">Tell me what you’re training for and what you have. Everything stays on this phone.</p>
      </header>
      <Chips name="goal" label="Goal" options={GOALS} value={p.goal} onChange={(v) => set('goal', v)} />
      <Chips name="experience" label="Experience" options={EXPERIENCE} value={p.experience} onChange={(v) => set('experience', v)} />
      <Chips name="days" label="Days per week" options={DAYS.map((d) => [d, String(d)] as [number, string])} value={p.daysPerWeek} onChange={(v) => set('daysPerWeek', v)} />
      <Chips name="minutes" label="Session length (min)" options={MINUTES.map((m) => [m, String(m)] as [typeof m, string])} value={p.sessionMinutes} onChange={(v) => set('sessionMinutes', v)} />
      <Chips name="equipment" label="Equipment (bodyweight is always included)" multi options={EQUIPMENT} value={p.equipment} onChange={toggleEq} />
      <Chips name="units" label="Units" options={[['kg', 'kg'], ['lb', 'lb']]} value={p.units} onChange={(v) => set('units', v)} />
      <div class="actions">
        <button type="button" class="btn primary big" data-testid="generate" onClick={() => onGenerate(p)}>Generate plan</button>
        {onCancel && <button type="button" class="btn ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </section>
  );
}
