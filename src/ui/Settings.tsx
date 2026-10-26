import { useEffect, useRef, useState } from 'preact/hooks';
import { EXERCISES } from '../data/exercises';
import { exportAll, importAll } from '../db';
import { allImageUrls, cacheImages, countCached, type CacheProgress } from '../offline';
import type { Profile } from '../types';
import { ProfileForm } from './Onboarding';

export function Settings({ onImported, profile, onProfile }: { onImported: () => void; profile: Profile; onProfile: (p: Profile) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState(false);
  const [cached, setCached] = useState<number>();
  const [dl, setDl] = useState<CacheProgress>();
  const [dlDone, setDlDone] = useState('');
  const urls = allImageUrls();
  useEffect(() => { countCached(urls).then(setCached).catch(() => setCached(0)); }, []);

  const downloadAll = async () => {
    setDlDone('');
    const res = await cacheImages(urls, setDl);
    setDl(undefined);
    const n = await countCached(urls).catch(() => 0);
    setCached(n);
    setDlDone(res.failed ? `${res.failed} images failed — check your connection and try again.` : 'All exercise demos are available offline.');
  };

  const doExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const name = `fitness-export-${new Date().toISOString().slice(0, 10)}.json`;
    const f = new File([blob], name, { type: 'application/json' });
    // iOS: the share sheet is the most reliable way to save a file ("Save to Files").
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: name }); setMsg('Export shared.'); return; } catch { /* fall back */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(`Exported ${data.sessions.length} sessions.`);
  };

  const doImport = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('Replace all data on this device with the imported file?')) return;
      await importAll(data);
      setMsg('Import complete.');
      onImported();
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`);
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  return (
    <section class="screen settings">
      <header class="top"><h1>Settings</h1></header>
      <details class="card defaults" data-testid="defaults">
        <summary><h2>Workout defaults</h2></summary>
        <p class="muted small">Used to pre-fill today’s builder. You can still change equipment and length per session.</p>
        <ProfileForm key={JSON.stringify(profile)} initial={profile} saveLabel={saved ? 'Saved ✓' : 'Save defaults'}
          onSave={(p) => { onProfile(p); setSaved(true); setTimeout(() => setSaved(false), 1500); }} />
      </details>
      <article class="card" data-testid="offline-card">
        <h2>Offline demos</h2>
        <p class="muted small">
          The app works offline; exercise demo images are saved as you view them, and the exercises in a built workout are
          saved right away. Download all {EXERCISES.length} demos (~12 MB) to browse the whole library offline.
        </p>
        {cached != null && <p class="small" data-testid="cached-count">{Math.floor(cached / 2)} of {EXERCISES.length} demos saved on this device</p>}
        {dl ? (
          <div class="dl" role="status">
            <progress max={dl.total} value={dl.done} data-testid="dl-progress" />
            <span class="small">{Math.round((dl.done / dl.total) * 100)}% · {dl.done} / {dl.total} images</span>
          </div>
        ) : (
          <div class="row">
            <button type="button" class="btn primary" data-testid="download-all" onClick={downloadAll}>Download all exercise demos for offline</button>
          </div>
        )}
        {dlDone && <p class="small" role="status" data-testid="dl-done">{dlDone}</p>}
      </article>
      <article class="card">
        <h2>Your data</h2>
        <p class="muted small">All data is stored only on this device. Export a backup file regularly.</p>
        <div class="row">
          <button type="button" class="btn primary" onClick={doExport}>Export</button>
          <button type="button" class="btn" onClick={() => file.current?.click()}>Import</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={doImport} />
        </div>
        {msg && <p class="small" role="status">{msg}</p>}
      </article>
      <article class="card about">
        <h2>About</h2>
        <p class="small">Fitness v{__APP_VERSION__} — free and open source, works offline.</p>
        <p class="small muted">
          Exercise data and images from <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> by yuhonas (public domain).
        </p>
        <p class="small muted">This app is a training log and planner, not medical advice.</p>
      </article>
    </section>
  );
}
