import { EXERCISE_BY_ID } from '../data/exercises';
import type { Plan } from '../types';
import { Demo } from './Demo';
import { EQUIPMENT, GOALS, restText, rxText } from './labels';

interface Props { plan: Plan; onEdit: () => void; onRegenerate: () => void; onStart: (dayIndex: number) => void }

export function PlanView({ plan, onEdit, onRegenerate, onStart }: Props) {
  const p = plan.profile;
  const goal = GOALS.find(([g]) => g === p.goal)?.[1];
  const eq = p.equipment.length ? p.equipment.map((e) => EQUIPMENT.find(([k]) => k === e)?.[1]).join(', ') : 'Bodyweight only';
  return (
    <section class="screen plan" data-testid="plan">
      <header class="top">
        <h1>Your plan</h1>
        <p class="muted">{plan.split} · {goal} · {p.sessionMinutes} min · {eq}</p>
        <div class="row">
          <button type="button" class="btn" onClick={onEdit}>Edit setup</button>
          <button type="button" class="btn" onClick={onRegenerate}>Shuffle exercises</button>
        </div>
        {plan.notes.map((n) => <p class="note" key={n}>{n}</p>)}
      </header>
      {plan.days.map((day, i) => (
        <article class="card day" key={i} data-testid="day">
          <div class="day-head">
            <div>
              <h2>{day.name}</h2>
              <p class="muted small">{day.focus} · ~{day.estMinutes} min</p>
            </div>
            <button type="button" class="btn primary" data-testid="start" onClick={() => onStart(i)}>Start</button>
          </div>
          <ul class="ex-list">
            {day.exercises.map((e) => (
              <li class="ex" key={e.exerciseId}>
                <Demo id={e.exerciseId} />
                <div class="ex-text">
                  <strong>{EXERCISE_BY_ID[e.exerciseId]?.name ?? e.exerciseId}</strong>
                  <span class="muted small">{rxText(e)} · rest {restText(e.restSec)}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
