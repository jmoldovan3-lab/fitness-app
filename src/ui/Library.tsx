import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EXERCISE_BY_ID, EXERCISES } from '../data/exercises';
import { filterExercises, type LibraryQuery } from '../library';
import type { Category, Equipment, Exercise, Muscle } from '../types';
import { Demo } from './Demo';
import { cap, CATEGORY_LABEL, EQUIPMENT_LABEL, equipmentText, MUSCLES } from './labels';

const PAGE = 40;
const EQUIP_FILTER: (Equipment | 'bodyweight')[] = ['bodyweight', 'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bands', 'pullupBar', 'bench', 'medicineBall', 'stabilityBall', 'foamRoller', 'other'];
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

interface Props {
  inWorkout: Set<string>;
  onAdd: (ex: Exercise) => void;
  onViewWorkout: () => void;
  detailId?: string;
  onDetail: (id?: string) => void;
}

export function Library({ inWorkout, onAdd, onViewWorkout, detailId, onDetail }: Props) {
  const [query, setQuery] = useState<LibraryQuery>({ q: '', muscle: '', equipment: '', category: '' });
  const [shown, setShown] = useState(PAGE);
  const results = useMemo(() => filterExercises(EXERCISES, query), [query]);
  const sentinel = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<LibraryQuery>) => { setQuery({ ...query, ...patch }); setShown(PAGE); };

  // Paginate: load the next page when the sentinel scrolls near the viewport.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setShown((n) => n + PAGE); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [results, detailId]);

  const detail = detailId ? EXERCISE_BY_ID[detailId] : undefined;
  if (detail) return <Detail ex={detail} added={inWorkout.has(detail.id)} onAdd={() => onAdd(detail)} onBack={() => onDetail(undefined)} onViewWorkout={onViewWorkout} />;

  const active = [query.muscle, query.equipment, query.category].filter(Boolean).length;
  return (
    <section class="screen library" data-testid="library">
      <header class="top">
        <h1>Library</h1>
        <p class="muted">{EXERCISES.length} exercises</p>
      </header>
      <input class="search" type="search" placeholder="Search exercises" aria-label="Search exercises" data-testid="lib-search"
        value={query.q} onInput={(e) => set({ q: e.currentTarget.value })} />
      <div class="filters">
        <select aria-label="Muscle" data-testid="filter-muscle" value={query.muscle} onChange={(e) => set({ muscle: e.currentTarget.value as Muscle | '' })}>
          <option value="">All muscles</option>
          {MUSCLES.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
        </select>
        <select aria-label="Equipment" data-testid="filter-equipment" value={query.equipment} onChange={(e) => set({ equipment: e.currentTarget.value as Equipment | '' })}>
          <option value="">All equipment</option>
          {EQUIP_FILTER.map((q) => <option key={q} value={q}>{q === 'bodyweight' ? 'Bodyweight' : EQUIPMENT_LABEL[q]}</option>)}
        </select>
        <select aria-label="Category" data-testid="filter-category" value={query.category} onChange={(e) => set({ category: e.currentTarget.value as Category | '' })}>
          <option value="">All types</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>
      <p class="muted small" data-testid="lib-count">
        {results.length} {results.length === 1 ? 'match' : 'matches'}
        {active > 0 && <> · <button type="button" class="linkish" onClick={() => set({ muscle: '', equipment: '', category: '' })}>clear filters</button></>}
      </p>
      <ul class="lib-list">
        {results.slice(0, shown).map((e) => (
          <li key={e.id}>
            <button type="button" class="lib-row" data-testid="lib-item" data-id={e.id} onClick={() => { onDetail(e.id); window.scrollTo(0, 0); }}>
              <Demo id={e.id} />
              <span class="ex-text">
                <strong>{e.name}{inWorkout.has(e.id) ? ' ✓' : ''}</strong>
                <span class="muted small">{cap(e.primaryMuscles.join(', '))} · {equipmentText(e.equipment)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {shown < results.length && (
        <div ref={sentinel}><button type="button" class="btn big" onClick={() => setShown(shown + PAGE)}>Show more</button></div>
      )}
    </section>
  );
}

function Detail({ ex, added, onAdd, onBack, onViewWorkout }: { ex: Exercise; added: boolean; onAdd: () => void; onBack: () => void; onViewWorkout: () => void }) {
  return (
    <section class="screen" data-testid="lib-detail">
      <header class="top">
        <button type="button" class="btn ghost back" data-testid="lib-back" onClick={onBack}>‹ Library</button>
        <h1>{ex.name}</h1>
        <p class="muted">{CATEGORY_LABEL[ex.category]} · {equipmentText(ex.equipment)}</p>
      </header>
      <Demo id={ex.id} size="large" />
      {added
        ? <button type="button" class="btn big" data-testid="view-workout" onClick={onViewWorkout}>✓ In today’s workout — view</button>
        : <button type="button" class="btn primary big" data-testid="add-to-workout" onClick={onAdd}>+ Add to today’s workout</button>}
      <article class="card">
        <h2>Muscles</h2>
        <p><strong>Primary:</strong> {cap(ex.primaryMuscles.join(', '))}</p>
        {ex.secondaryMuscles.length > 0 && <p class="muted"><strong>Secondary:</strong> {cap(ex.secondaryMuscles.join(', '))}</p>}
      </article>
      {ex.instructions.length > 0 && (
        <article class="card how">
          <h2>How to</h2>
          <ol>{ex.instructions.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </article>
      )}
    </section>
  );
}
