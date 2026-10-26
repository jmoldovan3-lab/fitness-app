import { useEffect, useRef } from 'preact/hooks';
import { EXERCISE_BY_ID } from '../data/exercises';
import { asset } from './labels';

// One shared observer pauses demos that are off-screen (CSS animation-play-state).
let observer: IntersectionObserver | undefined;
function observe(el: Element) {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  observer ??= new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('playing', e.isIntersecting);
  }, { rootMargin: '100px' });
  observer.observe(el);
  return () => observer?.unobserve(el);
}

/**
 * Smooth looping demo: two stacked frames, the top one crossfades in and out with an
 * ease-in-out opacity animation and a short hold at each end (GPU-composited, ~1.8s cycle).
 * Paused off-screen; static first frame when the user prefers reduced motion.
 */
export function Demo({ id, size = 'thumb' }: { id: string; size?: 'thumb' | 'large' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? observe(ref.current) : undefined), [id]);
  const ex = EXERCISE_BY_ID[id];
  if (!ex) return null;
  const loading = size === 'thumb' ? 'lazy' : 'eager';
  return (
    <div ref={ref} class={`demo demo-${size}`} role="img" aria-label={`${ex.name} demonstration`}>
      <img src={asset(ex.images[0])} alt="" loading={loading} decoding="async" width={320} height={240} />
      <img src={asset(ex.images[1])} alt="" class="demo-b" loading={loading} decoding="async" width={320} height={240} />
    </div>
  );
}
