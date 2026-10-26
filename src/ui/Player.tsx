import { useEffect, useState } from 'preact/hooks';
import { EXERCISE_BY_ID } from '../data/exercises';
import {
  addSet, extendRest, goTo, isExerciseDone, restRemainingSec, skipRest, toggleSet, updateSet, type ActiveWorkout,
} from '../workout';
import { restDoneAlert, unlockAudio } from './alert';
import { Demo } from './Demo';
import { restText, rxText } from './labels';

interface Props {
  workout: ActiveWorkout;
  onChange: (w: ActiveWorkout) => void;
  onFinish: (w: ActiveWorkout) => void;
  onDiscard: () => void;
}

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function Player({ workout: w, onChange, onFinish, onDiscard }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  // Rest finished → alert once and close the timer.
  useEffect(() => {
    if (w.rest && now >= w.rest.endsAt) { restDoneAlert(); onChange(skipRest(w)); }
  }, [now, w]);

  const ex = w.exercises[w.current];
  const info = EXERCISE_BY_ID[ex.exerciseId];
  // `now` ticks every 250ms, so clamp to the rest length right after a set is checked.
  const remaining = w.rest ? Math.min(restRemainingSec(w, now), Math.ceil((w.rest.endsAt - w.rest.startedAt) / 1000)) : 0;
  const doneSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const isLast = w.current === w.exercises.length - 1;

  const check = (i: number) => {
    unlockAudio();
    let next = toggleSet(w, w.current, i, Date.now());
    // When the last set of an exercise is completed, move on (rest keeps running).
    if (isExerciseDone(next.exercises[w.current]) && !isExerciseDone(ex) && !isLast) next = goTo(next, w.current + 1);
    onChange(next);
  };

  const finish = () => {
    if (doneSets === 0 && !confirm('No sets completed. Finish anyway?')) return;
    onFinish(w);
  };

  return (
    <section class="player" data-testid="player">
      <header class="player-head">
        <button type="button" class="btn ghost" onClick={() => confirm('Discard this workout?') && onDiscard()}>Discard</button>
        <div class="player-title">
          <strong>{w.dayName}</strong>
          <span class="muted small">{clock(Math.floor((now - w.startedAt) / 1000))} · {doneSets} {doneSets === 1 ? "set" : "sets"}</span>
        </div>
        <button type="button" class="btn primary" data-testid="finish" onClick={finish}>Finish</button>
      </header>

      <nav class="ex-dots" aria-label="Exercises">
        {w.exercises.map((e, i) => (
          <button type="button" key={i} aria-label={`Exercise ${i + 1}`} aria-current={i === w.current ? 'step' : undefined}
            class={`dot${i === w.current ? ' on' : ''}${isExerciseDone(e) ? ' done' : ''}`} onClick={() => onChange(goTo(w, i))} />
        ))}
      </nav>

      <Demo id={ex.exerciseId} size="large" />
      <div>
        <p class="muted small">Exercise {w.current + 1} of {w.exercises.length}</p>
        <h1 class="ex-name">{info?.name}</h1>
        <p class="muted">Target {rxText({ ...ex, sets: ex.sets.length })} · rest {restText(ex.restSec)}</p>
      </div>

      <div class="sets" data-testid="sets">
        <div class="set-row set-head muted small"><span>Set</span><span>{w.units}</span><span>{ex.unit === 'sec' ? 'sec' : 'reps'}</span><span /></div>
        {ex.sets.map((s, i) => (
          <div class={`set-row${s.completed ? ' done' : ''}`} key={`${w.current}-${i}`} data-testid="set-row">
            <span class="set-n">{i + 1}</span>
            <input type="number" inputMode="decimal" step="any" min="0" aria-label={`Set ${i + 1} weight`} data-testid="weight"
              value={s.weight || ''} placeholder="0" onInput={(e) => onChange(updateSet(w, w.current, i, { weight: num(e.currentTarget.value) }))} />
            <input type="number" inputMode="numeric" min="0" aria-label={`Set ${i + 1} reps`} data-testid="reps"
              value={s.reps || ''} placeholder="0" onInput={(e) => onChange(updateSet(w, w.current, i, { reps: Math.round(num(e.currentTarget.value)) }))} />
            <button type="button" class={`check${s.completed ? ' on' : ''}`} aria-pressed={s.completed} aria-label={`Complete set ${i + 1}`}
              data-testid="check" onClick={() => check(i)}>✓</button>
          </div>
        ))}
        <button type="button" class="btn ghost" onClick={() => onChange(addSet(w, w.current))}>+ Add set</button>
      </div>

      {info?.instructions.length ? (
        <details class="card how">
          <summary>How to</summary>
          <ol>{info.instructions.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </details>
      ) : null}

      <div class="row nav-row">
        <button type="button" class="btn" disabled={w.current === 0} onClick={() => onChange(goTo(w, w.current - 1))}>‹ Prev</button>
        {isLast
          ? <button type="button" class="btn primary" onClick={finish}>Finish workout</button>
          : <button type="button" class="btn" data-testid="next" onClick={() => onChange(goTo(w, w.current + 1))}>Next ›</button>}
      </div>

      {w.rest && (
        <div class="rest" role="timer" aria-live="polite" data-testid="rest">
          <div>
            <span class="muted small">Rest</span>
            <strong class="rest-time" data-testid="rest-time">{clock(remaining)}</strong>
          </div>
          <div class="rest-bar"><span style={{ width: `${Math.min(100, (100 * (w.rest.endsAt - now)) / Math.max(1, w.rest.endsAt - w.rest.startedAt))}%` }} /></div>
          <div class="row">
            <button type="button" class="btn" data-testid="rest-add" onClick={() => onChange(extendRest(w, 15))}>+15s</button>
            <button type="button" class="btn primary" data-testid="rest-skip" onClick={() => onChange(skipRest(w))}>Skip</button>
          </div>
        </div>
      )}
    </section>
  );
}
