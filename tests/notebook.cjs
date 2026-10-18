const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
(async()=>{
 let app;
 try{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vague-notebook-'));
 app=await electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'..'),...(process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[])],env:{...process.env,XDG_CONFIG_HOME:path.join(profile,'config'),XDG_CACHE_HOME:path.join(profile,'cache')}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('#start').click();await page.locator('#pokeball').click();
 assert.equal(await page.locator('#code-notebook').isVisible(),true);
 const clock=await page.locator('#clock').textContent();await page.waitForTimeout(600);assert.equal(await page.locator('#clock').textContent(),clock);
 const code='// Mon futur code\ndocument.body.dataset.executed = "yes";\n';
 await page.locator('#code-input').fill(code);
 await page.locator('#code-input').press('Tab');
 await page.locator('#code-input').press('Control+s');
 assert.equal(await page.locator('#code-line-count').textContent(),'3 lignes');
 const text=await page.locator('#code-input').inputValue();
 assert.equal(text,code+'  ');
 assert.equal(await page.evaluate(()=>document.body.dataset.executed),undefined);
 await page.screenshot({path:'/tmp/derniere-vague-notebook.png'});
 await page.locator('#save-code').click();assert.equal(await page.locator('#pause-shade').isVisible(),false);
 await page.reload();await page.locator('#pokeball').click();assert.equal(await page.locator('#code-input').inputValue(),text);
 await page.locator('#code-input').press('Escape');assert.equal(await page.locator('#pause-shade').isVisible(),true);
 await page.locator('#reset').click();await page.locator('#confirm-new').click();await page.locator('#pokeball').click();assert.equal(await page.locator('#code-input').inputValue(),text);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('#code-notebook').evaluate(e=>e.getBoundingClientRect().width<=innerWidth),true);
 await page.screenshot({path:'/tmp/derniere-vague-notebook-mobile.png'});
 await page.locator('#close-code').click();await page.locator('#pokeball').click();
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');}});
 await page.locator('#code-input').fill('texte à conserver');await page.locator('#code-input').press('Control+s');assert.match(await page.locator('#code-save-status').textContent(),/indisponible/);
 assert.deepEqual(errors,[]);console.log('PASS : Pokéball, pause/restauration, lignes et Tab, sauvegarde/rechargement, nouvelle traversée, texte sans exécution, mobile, erreur de stockage.');
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exit(1)});
