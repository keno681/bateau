'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8010');await page.locator('#start').click();
  await page.waitForFunction(()=>document.getElementById('scene').classList.contains('webgl-ready'));
  assert.equal(await page.locator('#room-list button').count(),8);
  assert.equal(await page.locator('.room-3d-label').count(),8);
  await page.locator('[data-room="radio"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('derniere-vague-v1')).crew[0].room==='radio');
  await page.waitForTimeout(900);await page.locator('#pause').click();
  const canvas=page.locator('#boat-3d');const before=await canvas.screenshot();
  await page.locator('#camera-left').click();await page.waitForTimeout(100);
  const rotated=await canvas.screenshot();assert.notDeepEqual(before,rotated,'camera changes actual 3D rendering while paused');
  await page.locator('#camera-in').click();await page.waitForTimeout(100);
  assert.notDeepEqual(rotated,await canvas.screenshot(),'3D zoom changes rendering');
  await page.reload();await page.locator('#action-4').waitFor();
  await page.locator('#resume').click();await page.locator('[data-room="medical"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('derniere-vague-v1')).crew[0].room==='medical');
  // Picking the profession's object sends the sailor back to his workroom.
  await page.locator('.resource[aria-label*="pièce"]').first().click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('derniere-vague-v1')).crew[0].work?.kind==='collect');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('derniere-vague-v1')).crew[0].room),'engine');
  assert.equal(await page.evaluate(()=>document.getElementById('boat-3d').getContext('webgl').getError()),0);
  const sleeping=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('derniere-vague-v1'));s.crew[0].work=null;s.crew[0].sleepDay=s.day;s.crew[0].sleepUntil=141;s.crew[0].dream='Une accalmie demain : les vagues feront moins de dégâts.';return s;});
  await page.addInitScript(s=>{if(!sessionStorage.getItem('sleep-3d-test')){localStorage.setItem('derniere-vague-v1',JSON.stringify(s));sessionStorage.setItem('sleep-3d-test','1');}},sleeping);
  await page.reload();await page.waitForFunction(()=>document.getElementById('char-0').classList.contains('asleep'));
  assert.equal(await page.locator('#action-0').isDisabled(),true);assert.equal(await page.locator('#dream-panel').isVisible(),true);assert.match(await page.locator('#dream-text').textContent(),/accalmie demain/);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/tmp/bateau-3d-tested-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: real WebGL rendering, eight rooms, navigation, saved destinations, camera rotation, zoom, collecting after room travel and mobile layout.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
