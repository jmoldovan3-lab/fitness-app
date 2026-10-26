// Player → rest timer → finish → history steps for the smoke test.
const waitImgs = (page, sel) => page.waitForFunction((s) => {
  const imgs = [...document.querySelectorAll(s)];
  return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
}, sel, { timeout: 10000 });

export async function playerSteps(page, { check, SHOTS }) {
  await page.clock.install();
  await page.evaluate(() => {
    window.__vibrations = [];
    navigator.vibrate = (p) => { window.__vibrations.push(p); return true; };
  });

  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="player"]');
  await waitImgs(page, '.demo-large img');
  const rows = await page.locator('[data-testid="set-row"]').count();
  check(rows >= 2, `player shows set rows (${rows})`);
  const demoBox = await page.locator('.demo-large').boundingBox();
  check(demoBox && demoBox.width > 300, `large looping demo (${Math.round(demoBox?.width)}px wide)`);

  // log set 1
  await page.locator('[data-testid="weight"]').nth(0).fill('20');
  await page.locator('[data-testid="reps"]').nth(0).fill('10');
  check(await page.locator('[data-testid="weight"]').nth(1).inputValue() === '20', 'weight carries forward to next set');
  await page.screenshot({ path: `${SHOTS}/player.png` });
  await page.locator('[data-testid="check"]').nth(0).click();

  // rest timer
  await page.waitForSelector('[data-testid="rest"]');
  const t1 = await page.textContent('[data-testid="rest-time"]');
  check(/^\d+:\d\d$/.test(t1 ?? ''), `rest timer visible after checking a set (${t1})`);
  await page.click('[data-testid="rest-add"]');
  await page.clock.runFor(300);
  const t2 = await page.textContent('[data-testid="rest-time"]');
  const sec = (t) => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
  check(sec(t2) >= sec(t1) + 14, `+15s extends rest (${t1} → ${t2})`);
  await page.screenshot({ path: `${SHOTS}/rest-timer.png` });
  await page.click('[data-testid="rest-skip"]');
  check(await page.locator('[data-testid="rest"]').count() === 0, 'skip closes rest timer');

  // set 2: let the rest run out → vibration + timer closes
  await page.locator('[data-testid="reps"]').nth(1).fill('8');
  await page.locator('[data-testid="check"]').nth(1).click();
  await page.waitForSelector('[data-testid="rest"]');
  await page.clock.runFor((sec(await page.textContent('[data-testid="rest-time"]')) + 2) * 1000);
  await page.waitForSelector('[data-testid="rest"]', { state: 'detached', timeout: 3000 }).catch(() => {});
  const vib = await page.evaluate(() => window.__vibrations.length);
  check(vib >= 1 && await page.locator('[data-testid="rest"]').count() === 0, `rest finish vibrates (${vib} call) and closes`);

  // in-progress workout survives reload → home shows Resume
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="resume"]');
  check(true, 'home shows Resume for the in-progress workout after reload');
  await page.click('[data-testid="resume"]');
  await page.waitForSelector('[data-testid="player"]');
  const doneAfterReload = await page.locator('.set-row.done').count();
  check(doneAfterReload === 2, `in-progress workout restored after reload (${doneAfterReload} done sets)`);

  // finish → history detail
  await page.click('[data-testid="finish"]');
  await page.waitForSelector('[data-testid="history-detail"]');
  const detailText = await page.textContent('[data-testid="history-detail"]');
  check(/2 sets/.test(detailText) && /360 kg volume/.test(detailText) && /20 kg × 10/.test(detailText), 'history detail shows sets and volume (2 sets, 360 kg)');
  await page.screenshot({ path: `${SHOTS}/history-detail.png` });
  await page.click('.back');
  await page.waitForSelector('[data-testid="session"]');
  const sessions = await page.locator('[data-testid="session"]').count();
  const listText = await page.textContent('[data-testid="session"]');
  check(sessions === 1 && /2 sets · 360 kg volume/.test(listText), `history lists the session (${listText?.trim().slice(0, 80)})`);
  await page.screenshot({ path: `${SHOTS}/history.png` });
}
