'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vague-old-crew-'));
const apps = [];
const wait = async check => { const end = Date.now() + 20000; while (!await check()) { if (Date.now() > end) throw Error('Équipage partagé non reçu'); await new Promise(r => setTimeout(r, 50)); } };
const status = p => p.evaluate(() => window.vagueNetwork.bootstrap());
async function launch(i) {
  const profile = path.join(fixture, 'profile-' + i);
  const app = await electron.launch({ executablePath: require('electron'), args: [fixture, '--no-sandbox', '--ozone-platform=headless', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: profile + '-cache' } });
  apps.push(app); const page = await app.firstWindow(); await page.locator('#start').click(); return { app, page };
}
async function lobby(p) { const opened = p.app.waitForEvent('window'); await p.page.locator('#network').click(); const w = await opened; await w.locator('#status').waitFor(); return w; }
(async () => {
  try {
    for (const dir of ['desktop', 'build']) fs.cpSync(path.join(root, dir), path.join(fixture, dir), { recursive: true });
    fs.copyFileSync(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
    // Fixed previous release: exercise the actual upgrade, not already-updated sources.
    for (const file of ['index.html', 'style.css', 'game.js']) fs.writeFileSync(path.join(fixture, file), execFileSync('git', ['show', 'v1.4.0:' + file], { cwd: root }));
    const host = await launch(0); assert.equal(await host.page.locator('.crew-card').count(), 3);
    let w = await lobby(host); await w.locator('#port').fill('0'); await w.locator('#host').click(); await w.locator('#code').waitFor();
    const invitation = await w.locator('#code').inputValue(); await w.locator('#back').click();
    const client = await launch(1); w = await lobby(client); await w.locator('#join-tab').click(); await w.locator('#invitation').fill(invitation); await w.locator('#join').click();
    await wait(async () => (await status(client.page)).phase === 'running');
    const ids = (await status(host.page)).players.map(p => p.id).sort();
    const opened = host.app.waitForEvent('window'); await host.page.locator('#pokeball').click(); w = await opened;
    await w.locator('#script').fill(fs.readFileSync(path.join(root, 'patches/CAPITAINE-INSPECTEUR-POKEBALL.txt'), 'utf8'));
    await w.locator('#apply').click();
    for (const p of [host, client]) await wait(async () => { try { const s = await status(p.page); return s.phase === 'running' && s.revision === 2 && s.runtime.state.crew.length === 5; } catch { return false; } });
    for (const p of [host, client]) assert.equal(await p.page.locator('.crew-card').count(), 5);
    await host.page.locator('#resume').click();
    await client.page.locator('#action-3').click(); await client.page.locator('#action-4').click();
    await wait(async () => { const s = (await status(host.page)).runtime.state; return s.objectives[3] && s.objectives[4]; });
    for (const p of [host, client]) {
      const s = await status(p.page); assert.deepEqual(s.players.map(p => p.id).sort(), ids);
      assert.equal(s.runtime.state.inventory.charts, 1); assert.equal(s.runtime.state.inventory.tools, 1);
    }
    assert.equal((await status(host.page)).acceptedConnections, 1);
    console.log('PASS: real 1.4.0 three-person game updated through Pokéball, five crew on both screens, guest controls captain and inspector, same connection and players.');
  } finally { for (const app of apps.reverse()) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
