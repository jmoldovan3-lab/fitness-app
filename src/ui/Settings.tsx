import { useRef, useState } from 'preact/hooks';
import { exportAll, importAll } from '../db';

export function Settings({ onImported }: { onImported: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

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
