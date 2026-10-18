'use strict';
const crypto=require('node:crypto');
const copy=x=>JSON.parse(JSON.stringify(x));
class Match {
 constructor({goalDays=3,sleepDuration='day'}={}) {
  this.goalDays=[1,3,5].includes(goalDays)?goalDays:3;this.sleepDuration=sleepDuration==='30s'?'30s':'day';
  this.stage='waiting';this.members=[];this.ready=new Set();this.saboteur=null;this.day=1;this.used={damage:false,sleep:false};this.sleepers=new Map();this.effectsRevision=0;this.winner=null;this.forecasts=new Map();
 }
 public(connected) {return {enabled:true,stage:this.stage,goalDays:this.goalDays,sleepDuration:this.sleepDuration,day:this.day,ready:[...this.ready],blocked:this.stage==='playing'&&this.members.some(id=>!connected.includes(id)),winner:this.winner,...(this.stage==='finished'?{revealedSaboteur:this.saboteur}: {})};}
 forecast(day){if(!this.forecasts.has(day)){const events=[{kind:'calm',label:'Une accalmie demain : les vagues feront moins de dégâts.',hullFactor:.7,fishBonus:0},{kind:'squall',label:'Une forte bourrasque demain : la coque subira davantage de dégâts.',hullFactor:1.25,fishBonus:0},{kind:'fish',label:'Un banc de poissons demain : chaque pêche rapportera un poisson de plus.',hullFactor:1,fishBonus:1}];this.forecasts.set(day,day===1?{kind:'normal',label:'Tempête ordinaire',hullFactor:1,fishBonus:0}:events[crypto.randomInt(events.length)]);}return this.forecasts.get(day);}
 private(id) {return this.stage==='waiting'?{role:null}: {role:id===this.saboteur?'saboteur':'crew',...(id===this.saboteur?{remaining:{damage:!this.used.damage,sleep:!this.used.sleep}}:{})};}
 setReady(id,value){if(this.stage!=='waiting')throw Error('La partie a déjà commencé.');if(value)this.ready.add(id);else this.ready.delete(id);}
 checkStart(ids){if(this.stage!=='waiting'||ids.length<2)throw Error('Il faut au moins deux joueurs pour une partie avec saboteur.');if(ids.some(id=>!this.ready.has(id)))throw Error('Tous les joueurs doivent cliquer sur Prêt.');}
 start(ids){this.checkStart(ids);this.members=ids.slice();this.saboteur=ids[crypto.randomInt(ids.length)];this.stage='playing';this.day=1;this.used={damage:false,sleep:false};this.sleepers.clear();this.effectsRevision++;this.winner=null;const value=this.fresh();this.enforce(value);return value;}
 fresh(){const types=['parts','ingredients','bait','charts','tools'],homes=['engine','kitchen','hold','bridge','workshop'];const zones={parts:[13,176],ingredients:[43,174],bait:[70,26],charts:[14,26],tools:[40,26]};let id=1;
  return {effectsRevision:this.effectsRevision,paused:false,spawnTimer:0,state:{version:1,day:1,time:0,hull:100,food:80,health:100,protection:0,inventory:{parts:2,ingredients:2,bait:2,fish:0,charts:2,tools:2},crew:homes.map(room=>({room,mood:crypto.randomInt(4),work:null})),objects:types.flatMap(type=>[0,1].map(n=>({id:id++,type,x:zones[type][0]+n*9,y:zones[type][1],claimed:false}))),nextId:11,objectives:[false,false,false,false,false],log:[{time:'06:00',message:'La traversée commence. Un saboteur se cache dans l’équipage.'}],outcome:null}};
 }
 update(value,previous){
  if(this.stage==='waiting'){value.paused=true;return;}
  if(value.state.day!==this.day){
   if(this.stage!=='playing'||value.state.day!==this.day+1||previous?.state.outcome!=='won')throw Error('Changement de journée invalide.');
   this.day=value.state.day;this.used={damage:false,sleep:false};this.sleepers.clear();this.effectsRevision++;
  }
  if(this.stage==='playing'&&(value.state.outcome==='lost'||value.state.hull<=0||value.state.health<=0)){this.stage='finished';this.winner='saboteur';value.state.outcome='lost';}
  else if(this.stage==='playing'&&value.state.outcome==='won'&&this.day>=this.goalDays){this.stage='finished';this.winner='crew';}
  if(this.stage==='finished')value.paused=true;
  this.enforce(value);
 }
 enforce(value){
  value.effectsRevision=this.effectsRevision;value.state.forecast=copy(this.forecast(this.day));
  value.state.crew.forEach((c,i)=>{const s=this.sleepers.get(i);c.sleepDay=s?.day||0;c.sleepUntil=s?.until||0;c.dream=s?.dream||'';
   if(s&&s.day===value.state.day&&value.state.time<s.until){if(c.work?.kind==='collect'){const o=value.state.objects.find(o=>o.id===c.work.objectId);if(o)o.claimed=false;}c.work=null;}
  });
 }
 act(id,action,target,current){
  if(this.stage!=='playing'||id!==this.saboteur)throw Error('Cette action est réservée au saboteur pendant la traversée.');
  if(current.paused||current.state.outcome)throw Error('Reprenez la traversée pour saboter.');
  if(!['damage','sleep'].includes(action))throw Error('Action inconnue.');
  if(this.used[action])throw Error('Cette action a déjà été utilisée aujourd’hui.');
  if(action==='sleep'&&(!Number.isInteger(target)||target<0||target>=current.state.crew.length))throw Error('Choisissez un marin à endormir.');
  const value=copy(current);this.used[action]=true;this.effectsRevision++;
  if(action==='damage'){value.state.hull=Math.max(0,value.state.hull-15);value.state.log.unshift({time:'⚠',message:'Une avarie soudaine a endommagé la coque (−15).'});}
  else{this.sleepers.set(target,{day:this.day,until:this.sleepDuration==='30s'?Math.min(140,value.state.time+30):141,dream:this.forecast(this.day+1).label});value.state.log.unshift({time:'☾',message:'Un membre de l’équipage s’est endormi.'});}
  value.state.log=value.state.log.slice(0,12);this.update(value,current);return value;
 }
}
module.exports={Match};
