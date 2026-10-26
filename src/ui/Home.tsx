import { useMemo, useState } from 'preact/hooks';
import { EXERCISE_BY_ID, EXERCISES } from '../data/exercises';
import { estMinutes, moveExercise, removeExercise, swapAlternatives, swapExercise, type FocusSuggestion } from '../generator';
import type { BuildInput, BuiltWorkout, Equipment, Focus, Muscle, SessionMinutes } from '../types';
import type { ActiveWorkout } from '../workout';
import { Chips } from './Chips';
import { Demo } from './Demo';
import { toggle } from './Onboarding';
import { cap, EQUIPMENT, equipmentText, FOCI, MINUTES, MUSCLES, restText, rxText } from './labels';

export type BuilderInput = Pick<BuildInput, 'focus' | 'muscles' | 'minutes' | 'equipment'>;

interface Props {
  input: BuilderInput;
  onInput: (i: BuilderInput) => void;
  suggestion: FocusSuggestion;
  built?: BuiltWorkout;
  active?: ActiveWorkout;
  onBuild: () => void;
  onChangeBuilt: (w: BuiltWorkout) => void;
  onRegenerate: () => void;
  onReset: () => void;
  onAddFromLibrary: () => void;
  onStart: () => void;
  onResume: () => void;
}

const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

export function Home(props: Props) {
  const { built, active } = props;
  return (
    <section class="screen home" data-testid="home">
      <header class="top">
        <h1>Today’s workout</h1>
        <p class="muted">{today()}</p>
      </header>
      {active && (
        <article class="card resume" data-testid="resume-card">
          <div>
            <h2>{active.dayName} in progress</h2>
            <p class="muted small">{active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)} sets done</p>
          </div>
          <button type="button" class="btn primary big" data-testid="resume" onClick={props.onResume}>Resume workout</button>
        </article>
      )}
      {!active && (built ? <BuiltView {...props} built={built} /> : <Builder {...props} />)}
    </section>
  );
}

function Builder({ input, onInput, suggestion, onBuild }: Props) {
  const set = <K extends keyof BuilderInput>(k: K, v: BuilderInput[K]) => onInput({ ...input, [k]: v });
  const focusOptions = FOCI.map(([f, label]) => [f, f === suggestion.focus ? `${label} ★` : label] as [Focus, string]);
  return (
    <>
      <Chips name="focus" label="Focus" options={focusOptions} value={input.focus} onChange={(v) => set('focus', v)} />
      <p class="note" data-testid="suggestion">★ Suggested: {FOCI.find(([f]) => f === suggestion.focus)?.[1]}. {suggestion.reason}</p>
      <details class="more" open={input.muscles.length > 0}>
        <summary>Target muscles (optional){input.muscles.length ? ` · ${input.muscles.length}` : ''}</summary>
        <Chips name="muscles" label="Prioritise these muscles" multi options={MUSCLES.map((m) => [m, cap(m)] as [Muscle, string])}
          value={input.muscles} onChange={(m: Muscle) => set('muscles', toggle(input.muscles, m))} />
      </details>
      <Chips name="minutes" label="Session length (min)" options={MINUTES.map((m) => [m, String(m)] as [SessionMinutes, string])} value={input.minutes} onChange={(v) => set('minutes', v)} />
      <Chips name="equipment" label="Equipment today (bodyweight always included)" multi options={EQUIPMENT} value={input.equipment}
        onChange={(e: Equipment) => set('equipment', toggle(input.equipment, e))} />
      <div class="actions sticky-actions">
        <button type="button" class="btn primary big" data-testid="build" onClick={onBuild}>Build workout</button>
      </div>
    </>
  );
}

function BuiltView({ built, onChangeBuilt, onRegenerate, onReset, onAddFromLibrary, onStart }: Props & { built: BuiltWorkout }) {
  const [swapIdx, setSwapIdx] = useState<number>();
  const ex = built.exercises;
  return (
    <>
      <article class="card built-head" data-testid="built">
        <h2>{built.title}</h2>
        <p class="muted small">{ex.length} exercises · ~{estMinutes(built)} min · {equipmentText(built.input.equipment)}</p>
        {built.notes.map((n) => <p class="note" key={n}>{n}</p>)}
        <div class="row">
          <button type="button" class="btn" data-testid="regenerate" onClick={onRegenerate}>↻ Regenerate</button>
          <button type="button" class="btn ghost" data-testid="change-setup" onClick={onReset}>Change setup</button>
        </div>
      </article>
      <ol class="built-list">
        {ex.map((e, i) => (
          <li class="card built-ex" key={e.exerciseId} data-testid="built-ex" data-id={e.exerciseId}>
            <div class="ex">
              <Demo id={e.exerciseId} />
              <div class="ex-text">
                <strong>{EXERCISE_BY_ID[e.exerciseId]?.name ?? e.exerciseId}</strong>
                <span class="muted small">{rxText(e)} · rest {restText(e.restSec)}</span>
              </div>
            </div>
            <div class="ex-actions">
              <button type="button" class="btn icon" aria-label="Move up" data-testid="up" disabled={i === 0} onClick={() => onChangeBuilt(moveExercise(built, i, -1))}>↑</button>
              <button type="button" class="btn icon" aria-label="Move down" data-testid="down" disabled={i === ex.length - 1} onClick={() => onChangeBuilt(moveExercise(built, i, 1))}>↓</button>
              <button type="button" class="btn" data-testid="swap" onClick={() => setSwapIdx(i)}>⇄ Swap</button>
              <button type="button" class="btn icon danger" aria-label="Remove" data-testid="remove" onClick={() => onChangeBuilt(removeExercise(built, i))}>✕</button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" class="btn big" data-testid="add-exercise" onClick={onAddFromLibrary}>+ Add from library</button>
      <div class="actions sticky-actions">
        <button type="button" class="btn primary big" data-testid="start" disabled={!ex.length} onClick={onStart}>Start workout</button>
      </div>
      {swapIdx != null && ex[swapIdx] && (
        <SwapSheet built={built} index={swapIdx} onClose={() => setSwapIdx(undefined)}
          onPick={(id) => { onChangeBuilt(swapExercise(built, swapIdx, EXERCISE_BY_ID[id])); setSwapIdx(undefined); }} />
      )}
    </>
  );
}

function SwapSheet({ built, index, onPick, onClose }: { built: BuiltWorkout; index: number; onPick: (id: string) => void; onClose: () => void }) {
  const cur = built.exercises[index];
  const [all, setAll] = useState(false);
  const alts = useMemo(() => swapAlternatives(cur.exerciseId, EXERCISES, {
    equipment: built.input.equipment, exclude: built.exercises.map((e) => e.exerciseId), limit: all ? 60 : 15,
  }), [cur.exerciseId, built, all]);
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label="Swap exercise" data-testid="swap-sheet">
        <div class="sheet-head">
          <div>
            <h2>Swap {EXERCISE_BY_ID[cur.exerciseId]?.name}</h2>
            <p class="muted small">Same movement or muscles, with today’s equipment</p>
          </div>
          <button type="button" class="btn ghost" onClick={onClose}>Close</button>
        </div>
        <ul class="sheet-list">
          {alts.map((a) => (
            <li key={a.id}>
              <button type="button" class="pick" data-testid="swap-option" data-id={a.id} onClick={() => onPick(a.id)}>
                <Demo id={a.id} />
                <span class="ex-text">
                  <strong>{a.name}</strong>
                  <span class="muted small">{cap(a.primaryMuscles.join(', '))} · {equipmentText(a.equipment)}</span>
                </span>
              </button>
            </li>
          ))}
          {!alts.length && <li class="muted">No alternatives for today’s equipment.</li>}
        </ul>
        {!all && alts.length >= 15 && <button type="button" class="btn ghost" onClick={() => setAll(true)}>Show more</button>}
      </div>
    </div>
  );
}
