import { useEffect, useState } from 'preact/hooks';
import { EXERCISE_BY_ID } from '../data/exercises';
import { getSession, listSessions, type SessionWithSets } from '../db';
import { formatDuration } from '../stats';
import { summarize } from '../workout';

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtVol = (v: number) => Math.round(v).toLocaleString();
const name = (id: string) => EXERCISE_BY_ID[id]?.name ?? id;

export function History({ openId, onOpen }: { openId?: number; onOpen: (id?: number) => void }) {
  const [items, setItems] = useState<SessionWithSets[]>();
  const [detail, setDetail] = useState<SessionWithSets>();

  useEffect(() => { listSessions().then(setItems); }, []);
  useEffect(() => { if (openId != null) getSession(openId).then(setDetail); else setDetail(undefined); }, [openId]);

  if (openId != null && detail) {
    const { session: s, sets } = detail;
    const sum = summarize(sets);
    const unit = sets[0]?.unit ?? '';
    return (
      <section class="screen" data-testid="history-detail">
        <header class="top">
          <button type="button" class="btn ghost back" onClick={() => onOpen(undefined)}>‹ History</button>
          <h1>{s.dayName ?? 'Workout'}</h1>
          <p class="muted">{fmtDate(s.startedAt)} · {fmtTime(s.startedAt)}{s.finishedAt ? ` · ${formatDuration(s.finishedAt - s.startedAt)}` : ''}</p>
          <p class="muted">{sum.sets} {sum.sets === 1 ? "set" : "sets"} · {fmtVol(sum.volume)} {unit} volume</p>
        </header>
        {sum.exerciseIds.map((id) => (
          <article class="card" key={id}>
            <h2>{name(id)}</h2>
            <ol class="set-list">
              {sets.filter((x) => x.exerciseId === id).map((x) => (
                <li key={x.id}>{x.weight ? `${x.weight} ${x.unit} × ${x.reps}` : `${x.reps} reps`}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section class="screen" data-testid="history">
      <header class="top"><h1>History</h1></header>
      {!items ? null : items.length === 0 ? (
        <article class="card"><p class="muted">No workouts yet. Build one on the Workout tab.</p></article>
      ) : items.map(({ session: s, sets }) => {
        const sum = summarize(sets);
        return (
          <button type="button" class="card session" key={s.id} data-testid="session" onClick={() => onOpen(s.id)}>
            <div class="session-head">
              <strong>{s.dayName ?? 'Workout'}</strong>
              <span class="muted small">{fmtDate(s.startedAt)}</span>
            </div>
            <span class="muted small">{sum.exerciseIds.map(name).join(' · ') || 'No sets logged'}</span>
            <span class="small">{sum.sets} {sum.sets === 1 ? "set" : "sets"} · {fmtVol(sum.volume)} {sets[0]?.unit ?? ''} volume</span>
          </button>
        );
      })}
    </section>
  );
}
