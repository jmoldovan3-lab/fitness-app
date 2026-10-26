import { EXERCISE_BY_ID } from '../data/exercises';
import { asset } from './labels';

/** Loops the start/end frames of an exercise (CSS opacity toggle every 0.8s). */
export function Demo({ id, size = 'thumb' }: { id: string; size?: 'thumb' | 'large' }) {
  const ex = EXERCISE_BY_ID[id];
  if (!ex) return null;
  return (
    <div class={`demo demo-${size}`} role="img" aria-label={`${ex.name} demonstration`}>
      <img src={asset(ex.images[0])} alt="" loading={size === 'thumb' ? 'lazy' : 'eager'} decoding="async" />
      <img src={asset(ex.images[1])} alt="" class="demo-b" loading={size === 'thumb' ? 'lazy' : 'eager'} decoding="async" />
    </div>
  );
}
