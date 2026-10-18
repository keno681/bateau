'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vague-workshop-'));
  let app, page;
  const launch = async () => {
    app = await electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '..'), ...(process.platform === 'linux' ? ['--no-sandbox', '--ozone-platform=headless', '--disable-gpu'] : [])], env: { ...process.env, XDG_CONFIG_HOME: path.join(profile, 'config'), XDG_CACHE_HOME: path.join(profile, 'cache') } });
    page = await app.firstWindow(); await page.locator('h1').waitFor();
  };
  const open = async (recovery = false) => {
    const waiting = app.waitForEvent('window');
    if (recovery) await app.evaluate(({ BrowserWindow }) => { const game = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === 'vague://game/index.html'); game.focus(); game.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F8' }); }); else await page.locator('#pokeball').click();
    const workshop = await waiting; await workshop.locator('#script').waitFor();
    await workshop.waitForFunction(() => document.getElementById('current').textContent.startsWith('Version '));
    return workshop;
  };
  const restart = async (workshop, button) => {
    const loaded = page.waitForEvent('domcontentloaded');
    await workshop.locator(button).click(); await loaded; await page.locator('h1').waitFor();
  };
  const patch = changes => JSON.stringify({ format: 'derniere-vague-patch-v1', title: 'Mon premier script', changes }, null, 2);
  try {
    await launch(); await page.locator('#start').click();
    let workshop = await open();
    assert.equal(workshop.url(), 'vague://workshop/index.html');
    const clock = await page.locator('#clock').textContent(); await page.waitForTimeout(650); assert.equal(await page.locator('#clock').textContent(), clock);
    await workshop.locator('#script').fill('ceci n’est pas un script JSON'); await workshop.locator('#apply').click();
    await workshop.waitForFunction(() => document.getElementById('status').classList.contains('error'));
    assert.match(await workshop.locator('#status').textContent(), /JSON valide/);
    assert.equal(await page.locator('h1').textContent(), 'Gardez le cap.');
    const source = patch([{ file: 'index.html', find: 'Gardez le cap.', replace: 'Tous à bord !' }, { file: 'style.css', append: '\nh1 { color: rgb(255, 170, 85); }\n' }, { file: 'game.js', find: "name:'Gaston'", replace: "name:'Gaston le mécano'" }]);
    await workshop.locator('#script').fill(source); await workshop.locator('#script').press('Control+s');
    await workshop.waitForFunction(() => document.getElementById('draft-status').textContent.includes('enregistré'));
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('derniere-vague-v1')));
    await restart(workshop, '#apply');
    assert.equal(await page.locator('h1').textContent(), 'Tous à bord !');
    assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(255, 170, 85)');
    assert.equal(await page.locator('[data-select="0"] .crew-name').textContent(), 'Gaston le mécano');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('derniere-vague-v1')));
    assert.deepEqual(after.inventory, before.inventory); assert.equal(after.day, before.day);
    const data = await app.evaluate(({ app }) => app.getPath('userData'));
    const state = JSON.parse(fs.readFileSync(path.join(data, 'modifications', 'state.json')));
    assert.match(fs.readFileSync(path.join(data, 'modifications', 'versions', state.active, 'index.html'), 'utf8'), /Tous à bord !/);
    const denied = await page.evaluate(async () => { try { await window.vagueWorkshop.apply('{}'); return false; } catch { return true; } }); assert.equal(denied, true);
    await app.close(); app = null; await launch();
    assert.equal(await page.locator('h1').textContent(), 'Tous à bord !');
    workshop = await open(); assert.equal(await workshop.locator('#script').inputValue(), source);
    await restart(workshop, '#undo'); assert.equal(await page.locator('h1').textContent(), 'Gardez le cap.');
    workshop = await open();
    await workshop.locator('#script').fill(patch([{ file: 'index.html', content: '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Test</title></head><body><h1>Jeu sans bouton</h1></body></html>' }]));
    await restart(workshop, '#apply'); assert.equal(await page.locator('#pokeball').count(), 0);
    workshop = await open(true); await restart(workshop, '#restore');
    assert.equal(await page.locator('h1').textContent(), 'Gardez le cap.'); assert.equal(await page.locator('#pokeball').count(), 1);
    workshop = await open(); await workshop.setViewportSize({ width: 560, height: 680 });
    assert.equal(await workshop.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await workshop.screenshot({ path: '/tmp/vague-patch-workshop.png' });
    await workshop.locator('#close').click();
    console.log('PASS : scripts invalides refusés, fichiers HTML/CSS/JavaScript modifiés, redémarrage, sauvegarde de partie conservée, persistance après fermeture de l’application, IPC limité à l’atelier, annulation, récupération F8 même sans Pokéball, retour à l’origine.');
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exit(1); });
