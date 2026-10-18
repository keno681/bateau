'use strict';
(async () => {
const $ = (id) => document.getElementById(id);
const DAY_LENGTH = 140, SAVE_KEY = 'derniere-vague-v1';
// vague-network-v1 — Le moteur réseau reste dans le processus principal.
const NET=window.vagueNetwork;
let netInfo={role:'offline',phase:'idle',revision:0,players:[]}, clientSave=false;
const moods = [
 {name:'Motivé',icon:'✦',speed:1.3,note:'Travaille 30 % plus vite'},
 {name:'Serein',icon:'☀',speed:1,note:'Vitesse habituelle'},
 {name:'Fatigué',icon:'☾',speed:.75,note:'Travaille 25 % moins vite'},
 {name:'Grincheux',icon:'☁',speed:.85,note:'Travaille 15 % moins vite'}
];
const roles = [
 {id:'mechanic',name:'Gaston',job:'Mécano',color:'#b5885e',resource:'parts',action:'Réparer la coque',cost:{parts:2},duration:5,home:{x:25,y:187}},
 {id:'cook',name:'Suzanne',job:'Cuisinière',color:'#b4bdab',resource:'ingredients',action:'Préparer un repas',cost:{ingredients:2},duration:5,home:{x:54,y:187}},
 {id:'fisher',name:'Marin',job:'Pêcheur',color:'#b9a263',resource:'bait',action:'Lancer la ligne',cost:{bait:1},duration:6,home:{x:77,y:28}}
];
const resources = {
 parts:{label:'Pièces',singular:'une pièce',color:'#b2bcb3',role:0},
 ingredients:{label:'Provisions',singular:'une provision',color:'#c4946d',role:1},
 bait:{label:'Appâts',singular:'un appât',color:'#c3b081',role:2},
 fish:{label:'Poissons',singular:'un poisson',color:'#8bb5bc',role:2}
};
function icon(type){
 const drawings={parts:'<path d="M8 4h5l2 7 5-5 4 3-5 8 2 7-6 3-4-8-7 1-2-5 7-4Z" fill="#a9b5ae"/><circle cx="13" cy="15" r="4" fill="#41575c"/><path d="m23 23 6 6" stroke="#e2d1aa" stroke-width="4"/>',ingredients:'<path d="M8 10h19l-2 20H10Z" fill="#b89466"/><path d="M10 10V7q7-5 15 0v3" fill="none" stroke="#e1c28b" stroke-width="2"/><path d="M17 14q-5-8 0-10 5 3 3 9" fill="#8cab78"/><circle cx="17" cy="22" r="5" fill="#cf7753"/>',bait:'<path d="M7 22c4-13 8 9 13-4s9-7 7-2" fill="none" stroke="#d1ac83" stroke-width="5" stroke-linecap="round"/><path d="M24 4v14q0 8-6 4" stroke="#b0c5c0" stroke-width="2" fill="none"/><circle cx="9" cy="19" r="1" fill="#354e54"/>',fish:'<path d="m4 17 5-7 5 4q12-12 18 3-7 14-18 4l-5 4Z" fill="#8bb7bc"/><path d="m20 10 4-5 3 9" fill="#5e909b"/><circle cx="27" cy="16" r="1.5" fill="#233d4a"/><path d="M19 14q-4 4 0 8" stroke="#c6d5c0" fill="none"/>'};
 return `<svg viewBox="0 0 36 36" aria-hidden="true">${drawings[type]}</svg>`;
}
function avatar(index){
 const r=roles[index];
 const hats=['<path d="M9 15q0-12 15-12t15 12" fill="#c79853"/><path d="M6 15h36" stroke="#ebbe74" stroke-width="4"/><path d="M24 4v9" stroke="#a77742" stroke-width="2"/>','<path d="M11 15V9q-8-10 4-9 8-9 13 0 14-4 10 8v7" fill="#eee7d2"/><path d="M12 11h26v7H12Z" fill="#d7d6bc"/>','<path d="M10 15q1-10 15-10 12 0 14 10Z" fill="#d6b467"/><path d="M8 15h34" stroke="#e2bf71" stroke-width="4"/>'];
 return `<svg viewBox="0 0 48 76" aria-hidden="true"><ellipse cx="25" cy="73" rx="14" ry="3" fill="#1a2a2b" opacity=".35"/><g class="body"><g class="leg-left"><path d="M16 51v17" stroke="#394e53" stroke-width="9"/><path d="M12 70h12" stroke="#202f35" stroke-width="6" stroke-linecap="round"/></g><g class="leg-right"><path d="M31 51v17" stroke="#394e53" stroke-width="9"/><path d="M28 70h12" stroke="#202f35" stroke-width="6" stroke-linecap="round"/></g><path d="M13 35q12-8 24 0l-1 21H14Z" fill="${r.color}"/><path d="M24 35v18" stroke="#e3cf9f" stroke-width="2"/><path d="M13 51h23" stroke="#4e5344" stroke-width="3"/><rect x="22" y="49" width="5" height="4" fill="#d8ba7e"/><g class="arm-left"><path d="m13 36-6 13" stroke="${r.color}" stroke-width="7" stroke-linecap="round"/><circle cx="6" cy="51" r="4" fill="#d9ad88"/></g><g class="arm-right"><path d="m36 36 5 13" stroke="${r.color}" stroke-width="7" stroke-linecap="round"/><circle cx="41" cy="51" r="4" fill="#d9ad88"/></g></g><g class="head"><path d="M11 14q-3 18 13 21 16-1 15-20" fill="#d9ad88"/><circle cx="10" cy="23" r="3" fill="#d9ad88"/><circle cx="39" cy="23" r="3" fill="#d9ad88"/>${hats[index]}<g class="eye"><circle cx="19" cy="22" r="1.7" fill="#2d373a"/><circle cx="31" cy="22" r="1.7" fill="#2d373a"/></g><path d="M23 24v3h3" fill="none" stroke="#b98970" stroke-width="1.5"/><path d="M20 29q5 4 10-1" fill="none" stroke="#814f3e" stroke-width="1.5"/>${index===0?'<path d="M16 27q4-3 8 0 4-3 9 0l-2 3-7-1-6 1Z" fill="#675343"/>':''}${index===1?'<path d="M11 16 8 27" stroke="#665444" stroke-width="5"/>':''}</g></svg>`;
}
let state, selected=0, paused=true, started=false, spawnTimer=0, saveTimer=0, uiTimer=0, lastTime=0, toastTimer, modalWasPaused=true;
function fresh(){return {version:1,day:1,time:0,hull:100,food:80,health:100,inventory:{parts:2,ingredients:2,bait:2,fish:0},crew:roles.map(()=>({mood:Math.floor(Math.random()*moods.length),work:null})),objects:[],nextId:1,objectives:[false,false,false],log:[],outcome:null};}
function validSave(s){return s && s.version===1 && Number.isInteger(s.day)&&s.day>0&&Number.isFinite(s.time)&&s.time>=0&&s.time<=DAY_LENGTH&&['hull','food','health'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=100)&&s.inventory&&Object.keys(resources).every(k=>Number.isInteger(s.inventory[k])&&s.inventory[k]>=0)&&Array.isArray(s.crew)&&s.crew.length===3&&s.crew.every(c=>Number.isInteger(c.mood)&&c.mood>=0&&c.mood<moods.length)&&Array.isArray(s.objects)&&s.objects.length<=16&&s.objects.every(o=>['parts','ingredients','bait'].includes(o.type)&&Number.isFinite(o.x)&&Number.isFinite(o.y))&&Array.isArray(s.objectives)&&s.objectives.length===3&&Array.isArray(s.log)&&Number.isInteger(s.nextId)&&[null,'won','lost'].includes(s.outcome);}
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(validSave(s)){
 s.crew.forEach(c=>{const w=c.work;if(w && (!['collect','action'].includes(w.kind)||!Number.isFinite(w.duration)||w.duration<=0||!Number.isFinite(w.elapsed)||w.elapsed<0||(w.kind==='collect'&&!s.objects.some(o=>o.id===w.objectId)))) c.work=null;});
 s.objects.forEach(o=>o.claimed=s.crew.some(c=>c.work?.kind==='collect'&&c.work.objectId===o.id));return s;}}catch{}return null;}
function save(){try{localStorage.setItem(clientSave?'derniere-vague-coop-v1':SAVE_KEY,JSON.stringify(state));publishNetwork();$('save-status').textContent='Sauvegarde locale automatique';}catch{$('save-status').textContent='Sauvegarde indisponible dans ce navigateur';}}
function clock(){let mins=Math.floor(state.time/DAY_LENGTH*720)+360;return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;}
function log(message){state.log.unshift({time:clock(),message});state.log=state.log.slice(0,12);renderLog();}
function renderLog(){const target=$('log');target.replaceChildren();state.log.slice(0,3).forEach(entry=>{let div=document.createElement('div');div.className='log-entry';let time=document.createElement('span');time.textContent=entry.time;div.append(time,document.createTextNode(entry.message));target.append(div);});}
function toast(message){document.querySelector('.toast')?.remove();let t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=message;document.body.append(t);clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.remove(),3300);}
function float(text,x,y){let el=document.createElement('span');el.className='float-text';el.textContent=text;el.style.left=x+'%';el.style.top=y+'px';$('float-texts').append(el);setTimeout(()=>el.remove(),2000);}
function spawn(type){if(state.objects.length>=14)return;type=type||['parts','ingredients','bait'][Math.floor(Math.random()*3)];let zones={parts:{min:8,max:31,y:176},ingredients:{min:39,max:63,y:174},bait:{min:65,max:92,y:26}};let z=zones[type],x=z.min+Math.random()*(z.max-z.min);for(let i=0;i<12 && state.objects.some(o=>o.type===type&&Math.abs(o.x-x)<7);i++)x=z.min+Math.random()*(z.max-z.min);if(state.objects.some(o=>o.type===type&&Math.abs(o.x-x)<5))return;state.objects.push({id:state.nextId++,type,x,y:z.y,claimed:false});renderObjects();}
function seedObjects(){['parts','parts','ingredients','ingredients','bait','bait'].forEach(spawn);}
function renderObjects(){const holder=$('objects');holder.replaceChildren();state.objects.forEach(o=>{let btn=document.createElement('button');btn.className='resource'+(roles[selected].resource!==o.type?' incompatible':'')+(o.claimed?' claimed':'');btn.style.left=o.x+'%';btn.style.top=o.y+'px';btn.dataset.id=o.id;btn.title=`Récupérer ${resources[o.type].singular} · ${roles[resources[o.type].role].job}`;btn.setAttribute('aria-label',btn.title);btn.disabled=!!o.claimed||paused||!!state.outcome||(netInfo.role!=='offline'&&netInfo.phase!=='running');btn.innerHTML=icon(o.type);btn.onclick=()=>collect(o.id);holder.append(btn);});}
function renderCrew(){
 $('crew-cards').innerHTML=roles.map((r,i)=>{const c=state.crew[i],m=moods[c.mood];return `<article class="crew-card ${selected===i?'selected':''}" data-crew="${i}"><button class="crew-select" data-select="${i}" aria-pressed="${selected===i}"><span class="portrait">${avatar(i)}</span><span><span class="crew-name">${r.name}</span><span class="crew-job" style="display:block">${r.job}</span></span><span class="mood" title="${m.note}">${m.icon} ${m.name}<small>Humeur du jour</small></span></button><div class="crew-status" id="status-${i}">Disponible · ${m.note.toLowerCase()}</div><button class="crew-action" id="action-${i}" data-action="${i}">${r.action}<span id="cost-${i}"></span></button><div class="work-track"><div id="work-${i}" style="width:0%"></div></div></article>`;}).join('');
 $('crew-cards').querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>select(Number(b.dataset.select)));
 $('crew-cards').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>work(Number(b.dataset.action)));
 $('characters').innerHTML=roles.map((r,i)=>`<button class="character ${i===selected?'selected':''}" id="char-${i}" style="left:${r.home.x}%;top:${r.home.y}px" aria-label="Sélectionner ${r.name}, ${r.job}" title="${r.name} · ${r.job}"><span class="name-tag">${r.name.toUpperCase()}</span>${avatar(i)}</button>`).join('');
 roles.forEach((r,i)=>{const el=$('char-'+i);el.onclick=()=>select(i);const w=state.crew[i].work;if(w){el.classList.add(w.kind==='collect'?'walking':'working');const o=state.objects.find(o=>o.id===w.objectId);if(o){el.style.left=o.x+'%';el.style.top=o.y+'px';}}});
}
function select(i){selected=i;document.querySelectorAll('.crew-card').forEach((c,j)=>c.classList.toggle('selected',i===j));document.querySelectorAll('.crew-select').forEach((c,j)=>c.setAttribute('aria-pressed',String(i===j)));roles.forEach((_,j)=>$('char-'+j).classList.toggle('selected',i===j));$('scene-hint').textContent=`${roles[i].name} · Récupérez ${i===0?'les pièces pour réparer':i===1?'les provisions pour cuisiner':'les appâts pour pêcher'}.`;renderObjects();}
function canAct(){if(netInfo.role!=='offline'&&netInfo.phase!=='running'){toast('Synchronisation du jeu en cours…');return false;}if(paused||state.outcome){toast('Reprenez la traversée pour donner un ordre.');return false;}return true;}
function collect(id){if(netInfo.role==='client'){if(canAct())NET.command({type:'collect',role:selected,objectId:id});return;}if(!canAct())return;let o=state.objects.find(o=>o.id===id);if(!o||o.claimed)return;let r=roles[selected],c=state.crew[selected];if(r.resource!==o.type){toast(`Cet objet est destiné au ${roles[resources[o.type].role].job.toLowerCase()}. Sélectionnez le bon marin.`);return;}if(c.work){toast(`${r.name} est déjà au travail.`);return;}o.claimed=true;c.work={kind:'collect',objectId:id,duration:3/moods[c.mood].speed,elapsed:0};let el=$('char-'+selected);el.style.left=o.x+'%';el.style.top=o.y+'px';el.classList.add('walking');renderObjects();renderStats();save();}
function costFor(i){return i===1&&state.inventory.fish>0?{fish:1}:roles[i].cost;}
function work(i){if(netInfo.role==='client'){if(canAct())NET.command({type:'work',role:i});return;}if(!canAct())return;select(i);let c=state.crew[i];if(c.work){toast(`${roles[i].name} termine d’abord son travail.`);return;}let cost=costFor(i);if(Object.entries(cost).some(([key,n])=>state.inventory[key]<n)){toast(i===0?'Il faut 2 pièces. Récupérez-les dans la salle des machines.':i===1?'Il faut 2 provisions ou 1 poisson. Récupérez des provisions ou envoyez le pêcheur.':'Il faut 1 appât. Récupérez-en sur le pont.');return;}Object.entries(cost).forEach(([key,n])=>state.inventory[key]-=n);c.work={kind:'action',duration:roles[i].duration/moods[c.mood].speed,elapsed:0};let el=$('char-'+i);el.style.left=roles[i].home.x+'%';el.style.top=roles[i].home.y+'px';el.classList.add('working');renderStats();save();}
function complete(i){let c=state.crew[i],job=c.work;c.work=null;let char=$('char-'+i);char.classList.remove('walking','working');if(job.kind==='collect'){let o=state.objects.find(o=>o.id===job.objectId);if(o){state.inventory[o.type]++;state.objects=state.objects.filter(x=>x.id!==o.id);float('+1 '+resources[o.type].label,o.x,o.y-35);log(`${roles[i].name} a récupéré ${resources[o.type].singular}.`);renderObjects();}}else{state.objectives[i]=true;if(i===0){state.hull=Math.min(100,state.hull+26);float('+26 coque',roles[i].home.x,135);log('Gaston consolide la coque. On tiendra !');}if(i===1){state.food=Math.min(100,state.food+30);state.health=Math.min(100,state.health+8);float('+30 repas',roles[i].home.x,135);log('Un repas chaud. Suzanne remonte le moral du bord.');}if(i===2){state.inventory.fish+=2;float('+2 poissons',roles[i].home.x,0);log('Deux poissons ! De quoi remplir la marmite.');}}char.style.left=roles[i].home.x+'%';char.style.top=roles[i].home.y+'px';save();}
function renderStats(){
 for(const key of ['hull','food','health']){let n=Math.ceil(state[key]);$(key+'-value').textContent=n+'%';$(key+'-bar').style.width=n+'%';$(key+'-value').classList.toggle('critical',n<25);}
 $('hull-note').textContent=state.hull<25?'Danger ! Réparez la coque rapidement':state.hull<60?'La coque subit les assauts de la mer':'Le bateau tient bon';
 $('food-note').textContent=state.food<20?'Repas épuisés : la santé baisse':'De quoi tenir quelques heures';
 $('health-note').textContent=state.health<35?'L’équipage a besoin de repas chauds':'Tout le monde est à bord';
 $('day-label').textContent='JOUR '+String(state.day).padStart(2,'0');$('clock').textContent=clock()+' · '+(state.time<35?'À l’aube':state.time<95?'En pleine tempête':'Dernière ligne droite');
 $('time-bar').style.width=state.time/DAY_LENGTH*100+'%';$('remaining').textContent='Tenir jusqu’à 18:00 · '+Math.ceil(DAY_LENGTH-state.time)+' s';
 $('inventory').innerHTML=Object.entries(resources).map(([k,r])=>`<div class="inventory-item">${icon(k)}<div><strong id="count-${k}">${state.inventory[k]}</strong><small>${r.label}</small></div></div>`).join('');
 roles.forEach((r,i)=>{const c=state.crew[i],cost=costFor(i);$('cost-'+i).textContent=Object.entries(cost).map(([key,n])=>n+' '+resources[key].label.toLowerCase()).join(' + ');$('action-'+i).disabled=paused||(netInfo.role!=='offline'&&netInfo.phase!=='running')||!!state.outcome||!!c.work||Object.entries(cost).some(([key,n])=>state.inventory[key]<n);$('status-'+i).textContent=c.work?(c.work.kind==='collect'?'Récupération en cours…':'Au travail…'):'Disponible · '+moods[c.mood].note.toLowerCase();$('work-'+i).style.width=c.work?Math.min(100,c.work.elapsed/c.work.duration*100)+'%':'0%';});
 $('objectives').innerHTML=['Réparer la coque','Préparer un repas chaud','Ramener du poisson'].map((label,i)=>`<div class="objective ${state.objectives[i]?'done':''}"><i>${state.objectives[i]?'✓':''}</i>${label}</div>`).join('');$('objective-count').textContent=state.objectives.filter(Boolean).length+' / 3';
}
function setPause(value){paused=value;document.querySelector('.app').classList.toggle('paused',value);$('pause-shade').hidden=!value||!!state.outcome||$('welcome').open||$('confirm-reset').open||$('code-notebook').open;$('pause').textContent=value?'▶':'II';$('pause').setAttribute('aria-label',value?'Reprendre la partie':'Mettre en pause');renderObjects();renderStats();}
function endDay(outcome){state.outcome=outcome;setPause(true);log(outcome==='won'?'18:00. Une journée de plus. Nous sommes toujours là.':state.hull<=0?'La coque a cédé sous les vagues.':'L’équipage n’a plus la force de tenir.');save();showResult();}
function showResult(){let won=state.outcome==='won';$('result-eyebrow').textContent=won?'JOUR '+state.day+' · TRAVERSÉE RÉUSSIE':'FIN DE LA TRAVERSÉE';$('result-title').textContent=won?'Encore à flot.':'La mer a eu le dernier mot.';$('result-description').textContent=won?'Le soir est arrivé et tout l’équipage est vivant. Demain, la tempête sera plus forte et chacun aura une nouvelle humeur.':state.hull<=0?'La coque a cédé. Collectez des pièces et faites réparer Gaston plus souvent lors de la prochaine traversée.':'Les repas ont manqué trop longtemps. Pêchez et cuisinez pour protéger l’équipage.';$('result-stats').innerHTML=`<div><strong>${Math.ceil(state.hull)} %</strong>Coque</div><div><strong>${Math.ceil(state.health)} %</strong>Santé</div><div><strong>${state.objectives.filter(Boolean).length} / 3</strong>Objectifs</div>`;$('next-day').textContent=won?'Affronter le jour '+(state.day+1)+' →':'Recommencer la traversée →';if(!$('result').open)$('result').showModal();}
function nextDay(){if(state.outcome==='lost'){reset();return;}state.day++;state.time=0;state.outcome=null;state.objectives=[false,false,false];state.crew.forEach((c,i)=>{c.mood=Math.floor(Math.random()*moods.length);c.work=null;});state.objects=[];spawnTimer=0;renderCrew();seedObjects();log('Nouvelle aube. Les humeurs changent, la tempête reste.');$('result').close();started=true;setPause(false);select(selected);save();}
function reset(){state=fresh();selected=0;spawnTimer=saveTimer=0;document.querySelectorAll('dialog').forEach(d=>d.close());$('float-texts').replaceChildren();renderCrew();seedObjects();log('L’Espérance quitte l’abri. Tout le monde à son poste !');started=true;setPause(false);select(0);save();}
function tick(dt){if(netInfo.role==='client'||netInfo.role==='host'&&netInfo.phase!=='running')return;if(paused||state.outcome)return;dt=Math.min(dt,DAY_LENGTH-state.time);state.time+=dt;const storm=1+Math.min(state.day-1,9)*.13;state.hull=Math.max(0,state.hull-dt*.31*storm);state.food=Math.max(0,state.food-dt*.36);if(state.food<15)state.health=Math.max(0,state.health-dt*(state.food<=0?1.1:.3));state.crew.forEach((c,i)=>{if(c.work){c.work.elapsed+=dt;if(c.work.elapsed>=c.work.duration)complete(i);}});spawnTimer+=dt;saveTimer+=dt;uiTimer+=dt;if(spawnTimer>=4.5){spawnTimer=0;const type=['parts','ingredients','bait'][Math.floor(Math.random()*3)];spawn(type);}
 if(state.hull<=0||state.health<=0)endDay('lost');else if(state.time>=DAY_LENGTH)endDay('won');if(saveTimer>=2){saveTimer=0;save();}if(uiTimer>=.1){uiTimer=0;renderStats();publishNetwork();}}
function frame(now){if(lastTime)tick(Math.min((now-lastTime)/1000,.25));lastTime=now;requestAnimationFrame(frame);}
$('pause').onclick=()=>{if(state.outcome)return;setPause(!paused);save();};$('resume').onclick=()=>setPause(false);
$('help').onclick=()=>{modalWasPaused=paused;setPause(true);$('start').textContent='Retour à bord →';$('welcome').showModal();$('pause-shade').hidden=true;};
$('start').onclick=()=>{const first=!started;$('welcome').close();started=true;setPause(first?false:modalWasPaused);save();};
$('welcome').addEventListener('cancel',e=>{e.preventDefault();$('start').click();});
$('result').addEventListener('cancel',e=>e.preventDefault());$('next-day').onclick=nextDay;
$('reset').onclick=()=>{modalWasPaused=paused;setPause(true);$('confirm-reset').showModal();$('pause-shade').hidden=true;};
$('cancel-reset').onclick=()=>{$('confirm-reset').close();setPause(modalWasPaused);};$('confirm-reset').addEventListener('cancel',e=>{e.preventDefault();$('cancel-reset').click();});$('confirm-new').onclick=reset;
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();$('pause').click();}if(['1','2','3'].includes(e.key))select(Number(e.key)-1);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!state.outcome&&netInfo.role!=='host'){setPause(true);save();}});window.addEventListener('pagehide',save);
// Le carnet est séparé de la partie : recommencer ne supprime pas le code.
const CODE_KEY='derniere-vague-code-v1';
let codeWasPaused=true, codeSaveTimer;
const codeInput=$('code-input');
function updateCodeLines(){
 const count=codeInput.value.split('\n').length;
 $('code-lines').textContent=Array.from({length:count},(_,i)=>i+1).join('\n');
 $('code-line-count').textContent=count+(count===1?' ligne':' lignes');
 $('code-lines').scrollTop=codeInput.scrollTop;
}
function saveCode(){
 clearTimeout(codeSaveTimer);
 try{localStorage.setItem(CODE_KEY,codeInput.value);$('code-save-status').textContent='Enregistré sur cet appareil';return true;}
 catch{$('code-save-status').textContent='Enregistrement indisponible : gardez une copie de votre texte.';return false;}
}
try{codeInput.value=localStorage.getItem(CODE_KEY)||'';}catch{$('code-save-status').textContent='Stockage local indisponible';}
updateCodeLines();
if(window.vagueWorkshop){
 let nativeWasPaused=true;
 window.vagueWorkshop.onVisibility(open=>{if(open){nativeWasPaused=paused;setPause(true);save();}else setPause(nativeWasPaused);});
}
$('pokeball').onclick=async()=>{
 if(window.vagueWorkshop){try{const result=await window.vagueWorkshop.open(codeInput.value);if(!result.ok)toast(result.error);}catch{toast('Impossible d’ouvrir l’atelier. Essayez le menu Jeu ou F8.');}return;}
 codeWasPaused=paused;setPause(true);$('code-notebook').showModal();$('pause-shade').hidden=true;codeInput.focus();
};
function closeCode(){saveCode();$('code-notebook').close();setPause(codeWasPaused);$('pokeball').focus();}
$('close-code').onclick=closeCode;$('save-code').onclick=closeCode;
$('code-notebook').addEventListener('cancel',e=>{e.preventDefault();closeCode();});
codeInput.addEventListener('input',()=>{updateCodeLines();$('code-save-status').textContent='Enregistrement…';clearTimeout(codeSaveTimer);codeSaveTimer=setTimeout(saveCode,400);});
codeInput.addEventListener('scroll',()=>{$('code-lines').scrollTop=codeInput.scrollTop;});
codeInput.addEventListener('keydown',e=>{
 if(e.key==='Tab'){e.preventDefault();const start=codeInput.selectionStart,end=codeInput.selectionEnd;if(codeInput.value.length-(end-start)+2>codeInput.maxLength)return;codeInput.setRangeText('  ',start,end,'end');codeInput.dispatchEvent(new Event('input'));}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveCode();}
});
window.addEventListener('pagehide',saveCode);
function publishNetwork(){
 if(NET&&state&&netInfo.role!=='client')NET.publish({state,paused,spawnTimer},netInfo.revision).catch(()=>{});
}
function renderNetwork(){
 const online=netInfo.role!=='offline';
 $('network-status').hidden=!online;
 const phase=netInfo.phase==='running'?'Connecté':netInfo.phase==='reconnecting'?'Reconnexion…':'Synchronisation…';
 $('network-status').textContent=(netInfo.role==='host'?'Vous hébergez':'Partie partagée')+' · '+netInfo.players.length+'/5 · '+phase+' · '+netInfo.players.map(p=>p.name).join(' / ');
 for(const id of ['pause','resume','reset','next-day'])$(id).disabled=netInfo.role==='client'||online&&netInfo.phase!=='running';
}
function applyShared(value){
 if(!value||!validSave(value.state)){toast('État partagé incompatible. Ouvrez F8 pour revenir à l’origine.');return false;}
 const moodsBefore=state?.crew.map(c=>c.mood).join(',');
 const objectsBefore=JSON.stringify(state?.objects);
 state=JSON.parse(JSON.stringify(value.state));spawnTimer=Number.isFinite(value.spawnTimer)?value.spawnTimer:0;started=true;
 if(moodsBefore!==state.crew.map(c=>c.mood).join(','))renderCrew();
 if(objectsBefore!==JSON.stringify(state.objects))renderObjects();
 roles.forEach((r,i)=>{const w=state.crew[i].work,el=$('char-'+i),o=w?.kind==='collect'?state.objects.find(o=>o.id===w.objectId):null;el.style.left=(o?o.x:r.home.x)+'%';el.style.top=(o?o.y:r.home.y)+'px';el.classList.toggle('walking',w?.kind==='collect');el.classList.toggle('working',w?.kind==='action');});
 paused=value.paused;setPause(paused);renderLog();renderNetwork();
 if(state.outcome){if(!$('result').open)showResult();$('next-day').disabled=netInfo.role==='client';}else if($('result').open)$('result').close();
 return true;
}
$('network').onclick=()=>{if(NET)NET.open();else toast('Le multijoueur nécessite la version Windows 1.3.0 ou plus récente.');};
if(NET){try{netInfo=await NET.bootstrap();clientSave=netInfo.role==='client';}catch{toast('Le moteur multijoueur est indisponible.');}}
state=load();let restored=!!state;if(!state)state=fresh();renderCrew();if(!state.objects.length)seedObjects();renderLog();select(0);setPause(true);
if(netInfo.role!=='offline'){
 started=true;
 if(netInfo.runtime&&!applyShared(netInfo.runtime))return;
}else if(!restored){log('L’Espérance quitte l’abri. Tout le monde à son poste !');$('welcome').showModal();$('pause-shade').hidden=true;}
else{started=true;if(state.outcome)showResult();else toast('Partie retrouvée. Reprenez la traversée quand vous êtes prêt.');}
renderNetwork();
if(NET){
 NET.onStatus(info=>{netInfo=info;renderNetwork();renderStats();renderObjects();});
 NET.onSnapshot(packet=>{if(packet.revision===netInfo.revision&&(netInfo.role==='client'||packet.force))applyShared(packet.runtime);});
 NET.onCommand(command=>{if(netInfo.role!=='host'||netInfo.phase!=='running')return;const previous=selected;if(command.type==='collect'){select(command.role);collect(command.objectId);}else if(command.type==='work')work(command.role);select(previous);publishNetwork();});
 if(netInfo.role!=='offline')NET.ready(netInfo.revision);
 publishNetwork();
}
requestAnimationFrame(frame);
})().catch(error=>{console.error(error);});
