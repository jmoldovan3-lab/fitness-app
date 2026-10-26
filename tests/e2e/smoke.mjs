#!/usr/bin/env node
// Playwright smoke test at iPhone viewport against `vite preview`.
// Usage: npm run build && node tests/e2e/smoke.mjs   (SHOTS_DIR overrides screenshot dir)
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 4173;
const URL_ = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS_DIR ?? '/workspace/fitness-shots';
await fs.mkdir(SHOTS, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview did not start')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); resolve(); } });
  server.on('exit', (c) => reject(new Error(`preview exited ${c}`)));
});

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

  // --- onboarding ---
  await page.click('[data-name="goal"] [data-value="hypertrophy"]');
  await page.click('[data-name="experience"] [data-value="intermediate"]');
  await page.click('[data-name="days"] [data-value="4"]');
  await page.click('[data-name="minutes"] [data-value="45"]');
  for (const eq of ['barbell', 'pullupBar']) await page.click(`[data-name="equipment"] [data-value="${eq}"]`);
  const chipBox = await page.locator('.chip').first().boundingBox();
  check(chipBox && chipBox.height >= 44, `chip tap target ${chipBox?.height}px >= 44`);
  await page.screenshot({ path: `${SHOTS}/onboarding.png`, fullPage: true });
  await page.click('[data-testid="generate"]');

  // --- plan ---
  await page.waitForSelector('[data-testid="plan"]');
  const days = await page.locator('[data-testid="day"]').count();
  check(days === 4, `plan renders 4 days (got ${days})`);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('[data-testid="day"]:first-of-type .demo img')];
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 10000 });
  const imgInfo = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.demo img')];
    return { total: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length };
  });
  check(imgInfo.loaded > 0, `exercise images loaded (${imgInfo.loaded}/${imgInfo.total} incl. lazy)`);
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.demo .demo-b')).animationName);
  check(anim === 'demo-flip', `demo loop animation (${anim})`);
  await page.screenshot({ path: `${SHOTS}/plan.png` });
  await page.screenshot({ path: `${SHOTS}/plan-full.png`, fullPage: true });

  // persistence across reload
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator('[data-testid="plan"]').count() === 1, 'plan persists after reload');

  if (process.env.SMOKE_PLAYER !== '0' && (await import('./player-steps.mjs').catch(() => null))) {
    const { playerSteps } = await import('./player-steps.mjs');
    await playerSteps(page, { check, SHOTS });
  }

  // settings
  await page.click('[data-tab="settings"]');
  check(await page.getByText('free-exercise-db').count() > 0, 'about/credits visible in Settings');
  await page.screenshot({ path: `${SHOTS}/settings.png` });

  // offline: reload with network off, app shell from SW cache
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.click('[data-tab="plan"]');
  await page.waitForSelector('[data-testid="plan"]', { timeout: 5000 }).catch(() => {});
  check(await page.locator('[data-testid="plan"]').count() === 1, 'app loads offline from service worker');
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
