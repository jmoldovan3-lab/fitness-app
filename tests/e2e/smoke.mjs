#!/usr/bin/env node
// Playwright smoke test at iPhone viewport against `vite preview`.
// Usage: npm run build && node tests/e2e/smoke.mjs   (SHOTS_DIR overrides screenshot dir)
// Live:  SMOKE_URL=https://jmoldovan3-lab.github.io/fitness-app/ node tests/e2e/smoke.mjs  (no local server)
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 4173;
const URL_ = process.env.SMOKE_URL ?? `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS_DIR ?? '/workspace/fitness-shots';
await fs.mkdir(SHOTS, { recursive: true });

let stop = () => {};
if (!process.env.SMOKE_URL) {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  stop = () => server.kill('SIGTERM');
  process.on('exit', stop);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('preview did not start')), 20000);
    server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); resolve(); } });
    server.on('exit', (c) => reject(new Error(`preview exited ${c}`)));
  });
}

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  colorScheme: 'dark',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

try {
  // --- PWA assets ---
  const manifestRes = await page.request.get(`${URL_}manifest.webmanifest`);
  const manifest = manifestRes.ok() ? await manifestRes.json() : null;
  check(manifestRes.ok() && manifest?.display === 'standalone' && manifest.icons?.length >= 2, `manifest served (${manifestRes.status()}, ${manifest?.icons?.length} icons)`);
  const swRes = await page.request.get(`${URL_}sw.js`);
  const swText = swRes.ok() ? await swRes.text() : '';
  check(swRes.ok() && swText.includes('precache'), `sw.js served (${swRes.status()}, ${swText.length} bytes)`);
  const iconRes = await page.request.get(`${URL_}icons/apple-touch-icon.png`);
  check(iconRes.ok() && iconRes.headers()['content-type']?.includes('png'), 'apple-touch-icon served');

  await page.goto(URL_, { waitUntil: 'networkidle' });
  const meta = await page.evaluate(() => ({
    capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
    status: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content'),
    title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content'),
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  }));
  check(meta.capable === 'yes' && meta.status && meta.title && meta.manifest, `apple meta + manifest link ${JSON.stringify(meta)}`);
  const swReady = await page.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 10000))]);
    return !!reg?.active;
  });
  check(swReady, 'service worker registered and active');

  // --- onboarding (first run: saved defaults) ---
  await page.click('[data-name="goal"] [data-value="hypertrophy"]');
  await page.click('[data-name="experience"] [data-value="intermediate"]');
  await page.click('[data-name="default-minutes"] [data-value="45"]');
  for (const eq of ['barbell', 'pullupBar', 'cable']) await page.click(`[data-name="profile-equipment"] [data-value="${eq}"]`);
  await page.screenshot({ path: `${SHOTS}/onboarding.png`, fullPage: true });
  await page.click('[data-testid="save-profile"]');

  // --- home: today's workout builder ---
  await page.waitForSelector('[data-testid="home"] [data-name="focus"]');
  const tabs = await page.locator('.tab').allTextContents();
  check(tabs.join() === 'Workout,Library,History,Progress,Settings', `tab bar: ${tabs.join(' / ')}`);
  const tabBox = await page.locator('.tab').first().boundingBox();
  check(tabBox && tabBox.width >= 70 && tabBox.height >= 56, `tab tap target ${Math.round(tabBox?.width)}×${Math.round(tabBox?.height)}`);
  const suggested = await page.getAttribute('[data-name="focus"] .chip.on', 'data-value');
  check(suggested === 'full', `suggested focus pre-selected with no history (${suggested})`);
  check(await page.locator('[data-name="minutes"] [data-value="45"].on').count() === 1, 'session length defaults to profile (45)');
  check(await page.locator('[data-name="equipment"] [data-value="barbell"].on').count() === 1, 'equipment defaults to profile');
  const chipBox = await page.locator('.chip').first().boundingBox();
  check(chipBox && chipBox.height >= 44, `chip tap target ${chipBox?.height}px >= 44`);
  await page.click('[data-name="focus"] [data-value="upper"]');
  await page.click('[data-name="minutes"] [data-value="60"]');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/home.png` });
  await page.click('[data-testid="build"]');

  // --- built workout ---
  await page.waitForSelector('[data-testid="built"]');
  const nBuilt = await page.locator('[data-testid="built-ex"]').count();
  check(nBuilt >= 4, `built workout lists exercises (${nBuilt})`);
  const builtText = await page.textContent('[data-testid="built"]');
  check(/Upper body/.test(builtText), 'built title reflects focus');
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('[data-testid="built-ex"]:first-child .demo img')];
    return imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 15000 });
  const anim = await page.evaluate(() => {
    const el = document.querySelector('.demo .demo-b');
    const cs = getComputedStyle(el);
    return { name: cs.animationName, dur: cs.animationDuration, fn: cs.animationTimingFunction, playing: el.parentElement.classList.contains('playing'), state: cs.animationPlayState };
  });
  check(anim.name === 'demo-xfade' && anim.dur === '1.8s' && anim.fn.includes('ease-in-out') && anim.playing && anim.state === 'running', `smooth crossfade demo ${JSON.stringify(anim)}`);
  // eager offline cache of the built workout's images
  const builtIds = await page.locator('[data-testid="built-ex"]').evaluateAll((els) => els.map((e) => e.dataset.id));
  const eager = await page.waitForFunction(async (ids) => {
    const c = await caches.open('exercise-images');
    const keys = new Set((await c.keys()).map((r) => new URL(r.url).pathname));
    return ids.every((id) => [0, 1].every((n) => [...keys].some((k) => k.endsWith(`/exercises/${id}/${n}.webp`))));
  }, builtIds, { timeout: 15000 }).then(() => true).catch(() => false);
  check(eager, 'built workout images cached eagerly for offline');
  await page.screenshot({ path: `${SHOTS}/built.png` });

  // regenerate
  await page.click('[data-testid="regenerate"]');
  await page.waitForTimeout(200);
  const regen = await page.locator('[data-testid="built-ex"]').evaluateAll((els) => els.map((e) => e.dataset.id));
  check(regen.length >= 4, `regenerate builds a new list (${regen.length}, ${regen.join() === builtIds.join() ? 'same' : 'different'} exercises)`);

  // swap the first exercise
  const before = regen[0];
  await page.locator('[data-testid="swap"]').first().click();
  await page.waitForSelector('[data-testid="swap-sheet"]');
  const opts = await page.locator('[data-testid="swap-option"]').count();
  check(opts >= 5, `swap shows alternatives (${opts})`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/swap.png` });
  const pickId = await page.locator('[data-testid="swap-option"]').first().getAttribute('data-id');
  await page.locator('[data-testid="swap-option"]').first().click();
  const afterSwap = await page.locator('[data-testid="built-ex"]').first().getAttribute('data-id');
  check(afterSwap === pickId && afterSwap !== before, `swapped ${before} → ${afterSwap}`);

  // reorder + remove
  const order1 = await page.locator('[data-testid="built-ex"]').evaluateAll((els) => els.map((e) => e.dataset.id));
  await page.locator('[data-testid="down"]').first().click();
  const order2 = await page.locator('[data-testid="built-ex"]').evaluateAll((els) => els.map((e) => e.dataset.id));
  check(order2[0] === order1[1] && order2[1] === order1[0], 'move down reorders');
  await page.locator('[data-testid="remove"]').last().click();
  const nAfterRemove = await page.locator('[data-testid="built-ex"]').count();
  check(nAfterRemove === order1.length - 1, `remove drops an exercise (${order1.length} → ${nAfterRemove})`);

  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator('[data-testid="built-ex"]').count() === nAfterRemove, 'built workout persists across reload');

  // --- library ---
  await page.click('[data-tab="library"]');
  await page.waitForSelector('[data-testid="library"]');
  const total = await page.textContent('[data-testid="lib-count"]');
  check(parseInt(total) > 850, `library lists the full dataset (${total})`);
  const firstPage = await page.locator('[data-testid="lib-item"]').count();
  check(firstPage <= 80, `library is paginated (${firstPage} rows rendered initially)`);
  await page.fill('[data-testid="lib-search"]', 'curl');
  await page.selectOption('[data-testid="filter-muscle"]', 'biceps');
  await page.selectOption('[data-testid="filter-equipment"]', 'dumbbell');
  const filtered = await page.locator('[data-testid="lib-item"]').allTextContents();
  check(filtered.length >= 3 && filtered.every((t) => /curl/i.test(t) && /dumbbell/i.test(t)), `search + filters (${filtered.length}: ${filtered.slice(0, 3).join(' | ')})`);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('[data-testid="lib-item"] .demo img')].slice(0, 6);
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/library.png` });
  const libId = await page.locator('[data-testid="lib-item"]').first().getAttribute('data-id');
  await page.locator('[data-testid="lib-item"]').first().click();
  await page.waitForSelector('[data-testid="lib-detail"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.demo-large img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  const detailText = await page.textContent('[data-testid="lib-detail"]');
  check(/Primary:/.test(detailText) && /How to/.test(detailText) && await page.locator('.demo-large').count() === 1, 'library detail: demo, muscles, instructions');
  await page.screenshot({ path: `${SHOTS}/library-detail.png` });
  await page.click('[data-testid="add-to-workout"]');
  await page.click('[data-testid="view-workout"]');
  await page.waitForSelector('[data-testid="built"]');
  const lastId = await page.locator('[data-testid="built-ex"]').last().getAttribute('data-id');
  check(lastId === libId, `added ${libId} from library to today's workout`);

  // --- start → player → log → rest → finish → history ---
  if (process.env.SMOKE_PLAYER !== '0') {
    const { playerSteps } = await import('./player-steps.mjs');
    await playerSteps(page, { check, SHOTS });
  }

  // next session suggestion avoids what was just trained
  await page.click('[data-tab="workout"]');
  await page.waitForSelector('[data-name="focus"]');
  const nextFocus = await page.getAttribute('[data-name="focus"] .chip.on', 'data-value');
  check(['lower', 'legs'].includes(nextFocus), `after an upper session, suggested focus is ${nextFocus}`);

  // reduced motion → no animation
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.click('[data-tab="library"]');
  await page.waitForSelector('[data-testid="lib-item"] .demo');
  const rm = await page.evaluate(() => getComputedStyle(document.querySelector('.demo .demo-b')).animationName);
  check(rm === 'none', `prefers-reduced-motion disables the demo animation (${rm})`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // settings: download all demos
  await page.click('[data-tab="settings"]');
  check(await page.getByText('free-exercise-db').count() > 0, 'about/credits visible in Settings');
  await page.click('[data-testid="download-all"]');
  await page.waitForSelector('[data-testid="dl-progress"]', { timeout: 5000 }).catch(() => {});
  const sawProgress = await page.locator('[data-testid="dl-progress"]').count();
  await page.waitForSelector('[data-testid="dl-done"]', { timeout: 240000 });
  const dlText = await page.textContent('[data-testid="dl-done"]');
  const cachedText = await page.textContent('[data-testid="cached-count"]');
  check(/available offline/.test(dlText) && /^(\d+) of \1 /.test(cachedText), `download all demos (${sawProgress ? 'progress shown' : 'no progress seen'}; ${cachedText})`);
  await page.screenshot({ path: `${SHOTS}/settings.png` });

  // offline: reload with network off; app shell from SW, demo images from the runtime cache
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="home"]', { timeout: 8000 }).catch(() => {});
  check(await page.locator('[data-testid="home"]').count() === 1, 'app loads offline from service worker');
  await page.click('[data-tab="library"]');
  await page.fill('[data-testid="lib-search"]', 'zercher');
  await page.locator('[data-testid="lib-item"]').first().click();
  const offImg = await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('.demo-large img')];
    return imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  check(offImg, 'library demo images load offline after Download all');
  await ctx.setOffline(false);

  check(errors.length === 0, `no console/page errors ${errors.length ? JSON.stringify(errors) : ''}`);
} catch (e) {
  console.error(e);
  await page.screenshot({ path: `${SHOTS}/failure.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
  stop();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
