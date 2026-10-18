'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const apps = [];
async function launch(i) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vague-multi-'+i+'-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '..'), ...(process.platform === 'linux' ? ['--no-sandbox','--ozone-platform=headless','--disable-gpu'] : [])], env: { ...process.env, XDG_CONFIG_HOME: path.join(root,'config'), XDG_CACHE_HOME: path.join(root,'cache') } });
  apps.push(app); const page = await app.firstWindow(); await page.locator('#start').click();
  return { app, page };
}
async function lobby(p) { const waiting = p.app.waitForEvent('window'); await p.page.locator('#network').click(); const w = await waiting; await w.locator('#status').waitFor(); return w; }
async function status(p) { return p.page.evaluate(() => window.vagueNetwork.bootstrap()); }
async function wait(check, timeout=15000) { const end = Date.now()+timeout; while (!await check()) { if (Date.now()>end) throw new Error('Synchronisation multijoueur non reçue'); await new Promise(r=>setTimeout(r,50)); } }
(async()=>{
 try {
  const host = await launch(0); let w = await lobby(host);
  await w.locator('#name').fill('Capitaine'); await w.locator('#port').fill('0'); await w.locator('#host').click(); await w.locator('#code').waitFor();
  const invitation = await w.locator('#code').inputValue(); assert.ok(invitation.startsWith('VAGUE1-')); await w.locator('#back').click();
  const clients=[];
  for(let i=1;i<=4;i++) {
    const player=await launch(i); clients.push(player); w=await lobby(player); await w.locator('#join-tab').click(); await w.locator('#name').fill('Marin '+i); await w.locator('#invitation').fill(invitation);
    const loaded=player.page.waitForEvent('domcontentloaded'); await w.locator('#join').click(); await loaded;
    await wait(async()=>{const s=await status(player);return s.role==='client'&&s.phase==='running';});
  }
  await wait(async()=> (await status(host)).players.length===5);
  const before=await status(host), ids=before.players.map(p=>p.id).sort(); assert.equal(before.acceptedConnections,4);
  await clients[0].page.locator('#action-2').click();
  await wait(async()=>!!(await status(host)).runtime.state.crew[2].work);
  await host.page.locator('#pause').click();
  await wait(async()=> (await status(clients[3])).runtime.paused);
  const saved=(await status(host)).runtime.state;
  assert.ok(saved.crew[2].work); assert.equal(saved.inventory.bait,1);
  const opened=host.app.waitForEvent('window'); await host.page.locator('#pokeball').click(); const workshop=await opened; await workshop.locator('#script').waitFor();
  const patch=JSON.stringify({format:'derniere-vague-patch-v1',title:'Coop : modification commune',changes:[{file:'index.html',find:'Gardez le cap.',replace:'À cinq, le bateau tient !'},{file:'game.js',append:'\nwindow.sharedPatchWorks = true;\n'}]});
  await workshop.locator('#script').fill(patch); await workshop.locator('#apply').click();
  await wait(async()=>{try {return (await status(host)).phase==='running'&&(await status(host)).revision===2&&await Promise.all(clients.map(async p=>(await status(p)).revision===2&&(await status(p)).phase==='running')).then(a=>a.every(Boolean));}catch{return false;}},20000);
  for(const p of [host,...clients]) {
    assert.equal(await p.page.locator('h1').textContent(),'À cinq, le bateau tient !'); assert.equal(await p.page.evaluate(()=>window.sharedPatchWorks),true);
    const s=await status(p);assert.deepEqual(s.players.map(v=>v.id).sort(),ids);assert.equal(s.runtime.state.inventory.bait,1);assert.ok(s.runtime.state.crew[2].work);
  }
  assert.equal((await status(host)).acceptedConnections,4);
  const clientOpen=clients[0].app.waitForEvent('window');await clients[0].page.locator('#pokeball').click();const clientWorkshop=await clientOpen;
  await clientWorkshop.waitForFunction(()=>document.getElementById('status').textContent.includes('hôte'));
  assert.equal(await clientWorkshop.locator('#apply').isDisabled(),true); await clientWorkshop.locator('#close').click();
  await host.page.locator('#resume').click();
  await wait(async()=>!(await status(clients[2])).runtime.state.crew[2].work,14000);
  for(const p of [host,...clients])await wait(async()=> (await status(p)).runtime.state.inventory.fish===2);
  w=await lobby(clients[3]);const left=clients[3].page.waitForEvent('domcontentloaded');await w.locator('#leave').click();await left;
  await clients[3].page.locator('#count-bait').waitFor();assert.equal(await clients[3].page.locator('#count-bait').textContent(),'2');assert.equal(await clients[3].page.locator('#count-fish').textContent(),'0');assert.equal(await clients[3].page.locator('h1').textContent(),'Gardez le cap.');
  console.log('PASS : cinq applications Electron, invitation locale, action client appliquée par l’hôte, cinq écrans modifiés et redémarrés, quatre sockets conservées, mêmes identifiants, travail en cours conservé puis terminé, atelier réservé à l’hôte, retour solo sans écraser la sauvegarde personnelle.');
 } finally {for(const app of apps.slice().reverse())await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exit(1)});
