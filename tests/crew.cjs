'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install(); await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8010');
    await page.locator('#start').click();
    // A previous three-person save keeps its progress and active work.
    const previous = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('derniere-vague-v1'));
      s.crew = s.crew.slice(0, 3); s.objectives = [true, false, true];
      delete s.inventory.charts; delete s.inventory.tools; delete s.protection;
      s.objects = s.objects.filter(o => ['parts', 'ingredients', 'bait'].includes(o.type));
      s.day = 4; s.time = 26; s.hull = 67; s.health = 54;
      s.crew[2].work = { kind: 'action', duration: 9, elapsed: 2 };
      localStorage.setItem('derniere-vague-v1', JSON.stringify(s)); return s;
    });
    await page.addInitScript(s => {
      if (!sessionStorage.getItem('crew-migration-fixture')) {
        localStorage.setItem('derniere-vague-v1', JSON.stringify(s));
        sessionStorage.setItem('crew-migration-fixture', '1');
      }
    }, previous);
    await page.reload(); await page.locator('#action-4').waitFor();
    assert.equal(await page.locator('.crew-card').count(), 5);
    assert.equal(await page.locator('#day-label').textContent(), 'JOUR 04');
    assert.equal(await page.locator('#hull-value').textContent(), '67%');
    assert.equal(await page.locator('#health-value').textContent(), '54%');
    assert.equal(await page.locator('#objective-count').textContent(), '2 / 5');
    assert.equal(await page.locator('#action-2').isDisabled(), true);
    await page.locator('#resume').click(); await page.clock.runFor(1000);
    await page.locator('#pause').click();
    const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('derniere-vague-v1')));
    assert.equal(migrated.day, previous.day); assert.equal(migrated.crew.length, 5);
    assert.ok(migrated.crew[2].work.elapsed > 2); assert.equal(migrated.inventory.charts, 2);
    // Both new jobs have costs, completion effects and daily objectives.
    await page.locator('#resume').click(); await page.locator('#action-3').click();
    assert.equal(await page.locator('#count-charts').textContent(), '1');
    await page.clock.runFor(11000);
    assert.match(await page.locator('#hull-note').textContent(), /Cap tenu/);
    await page.locator('#pause').click();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('derniere-vague-v1')));
    assert.equal(saved.objectives[3], true); assert.ok(saved.protection > 0);
    const hull = saved.hull;
    await page.locator('#resume').click(); await page.clock.runFor(1000); await page.locator('#pause').click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('derniere-vague-v1')));
    assert.ok(Math.abs(hull - saved.hull - .31 * 1.39 / 2) < .03, 'captain halves storm damage');
    await page.locator('#resume').click(); await page.locator('#action-4').click();
    assert.equal(await page.locator('#count-tools').textContent(), '1');
    await page.clock.runFor(10000); await page.locator('#pause').click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('derniere-vague-v1')));
    assert.equal(saved.objectives[4], true); assert.equal(saved.health, 66);
    await page.reload(); assert.equal(await page.locator('.crew-card').count(), 5);
    assert.equal(await page.locator('#count-tools').textContent(), '1');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: '/tmp/bateau-five-crew-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: three-person save migration, five crew, captain damage protection, inspector health, costs, progress, reload and mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
