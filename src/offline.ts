// Exercise-image offline cache. The service worker serves /exercises/*.webp CacheFirst from
// IMAGE_CACHE (see vite.config.ts); this module fills that cache from the page.
import { EXERCISE_BY_ID, EXERCISES } from './data/exercises';
import { asset } from './ui/labels';

export const IMAGE_CACHE = 'exercise-images';
const supported = () => typeof caches !== 'undefined' && typeof location !== 'undefined';

export function imageUrls(ids: string[]): string[] {
  if (typeof location === 'undefined') return [];
  return ids.flatMap((id) => EXERCISE_BY_ID[id]?.images ?? []).map((p) => new URL(asset(p), location.href).href);
}
export const allImageUrls = () => imageUrls(EXERCISES.map((e) => e.id));

export interface CacheProgress { done: number; total: number; failed: number }

/** Fetches any not-yet-cached URLs into the image cache (6 at a time). Safe to call repeatedly. */
export async function cacheImages(urls: string[], onProgress?: (p: CacheProgress) => void, signal?: AbortSignal): Promise<CacheProgress> {
  const p: CacheProgress = { done: 0, total: urls.length, failed: 0 };
  if (!supported() || !urls.length) return p;
  const cache = await caches.open(IMAGE_CACHE);
  let i = 0;
  let last = 0;
  const tick = () => { const t = Date.now(); if (t - last > 100 || p.done === p.total) { last = t; onProgress?.({ ...p }); } };
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < urls.length && !signal?.aborted) {
      const url = urls[i++];
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { signal });
          if (!res.ok) throw new Error(String(res.status));
          await cache.put(url, res);
        }
      } catch { p.failed++; }
      p.done++;
      tick();
    }
  }));
  onProgress?.({ ...p });
  return p;
}

/** Fire-and-forget eager caching for the exercises in a workout. */
export function prefetchExercises(ids: string[]): void {
  void cacheImages(imageUrls(ids)).catch(() => {});
}

export async function countCached(urls: string[]): Promise<number> {
  if (!supported()) return 0;
  const cache = await caches.open(IMAGE_CACHE);
  const keys = new Set((await cache.keys()).map((r) => r.url));
  return urls.filter((u) => keys.has(u)).length;
}
