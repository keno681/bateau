'use strict';
// boat3d:start
// Embedded into game.js by scripts/embed-boat3d.cjs; no external runtime files.
function createBoat3D(api) {
 const canvas=document.getElementById('boat-3d'),scene=document.getElementById('scene');
 if(!canvas)return null;
 const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});
 if(!gl){document.getElementById('view-3d-status').textContent='La 3D est indisponible sur cet appareil · vue de secours';return null;}
 const rooms=[
  {id:'engine',name:'Salle des machines',x:-7.2,y:1,color:'#667b70',note:'Gaston y entretient le moteur et répare la coque.'},
  {id:'kitchen',name:'Cambuse',x:-2.4,y:1,color:'#b28d64',note:'Suzanne y prépare les repas de tout l’équipage.'},
  {id:'hold',name:'Cale',x:2.4,y:1,color:'#738d87',note:'Les réserves, les caisses et le matériel de pêche.'},
  {id:'workshop',name:'Atelier',x:7.2,y:1,color:'#a48a66',note:'Victor y vérifie les outils et les points faibles du bateau.'},
  {id:'bridge',name:'Passerelle',x:-7.2,y:4.15,color:'#5e8796',note:'Émile tient la barre pour protéger le bateau des vagues.'},
  {id:'radio',name:'Salle radio',x:-2.4,y:4.15,color:'#718d94',note:'Le poste radio permet de suivre les messages et la météo.'},
  {id:'medical',name:'Infirmerie',x:2.4,y:4.15,color:'#8ba698',note:'Un espace de soins pour surveiller la santé de l’équipage.'},
  {id:'dorm',name:'Dortoir',x:7.2,y:4.15,color:'#8e8495',note:'Les couchettes abritent les marins pendant la tempête.'}
 ];
 const byId=Object.fromEntries(rooms.map(r=>[r.id,r])),home=['engine','kitchen','hold','bridge','workshop'];
 const roomOfType={parts:'engine',ingredients:'kitchen',bait:'hold',charts:'bridge',tools:'workshop'};
 let yaw=.2,pitch=.31,zoom=1,drag=null,last=0,elapsed=0,vertices=[],matrix,eye,right,up,forward,width=1,height=1,focused='engine',lost=false;
 const positions=new Map(),items=new Map(),labels=new Map();
 const vsub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{let l=Math.hypot(...a);return a.map(x=>x/l);};
 function multiply(a,b){let c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
 const color=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uMatrix;uniform vec3 uEye;varying vec3 vColor;varying float vFog;void main(){gl_Position=uMatrix*vec4(aPosition,1.0);float light=0.45+0.55*max(dot(normalize(aNormal),normalize(vec3(-0.4,1.0,0.65))),0.0);vColor=aColor*light;vFog=clamp((distance(aPosition,uEye)-38.0)/85.0,0.0,0.8);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 vColor;varying float vFog;void main(){gl_FragColor=vec4(mix(vColor,vec3(0.065,0.12,0.16),vFog),1.0);}'));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Initialisation de la vue 3D impossible.');
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 for(const [name,offset] of [['aPosition',0],['aNormal',12],['aColor',24]]){let a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,offset);}
 const matrixLocation=gl.getUniformLocation(program,'uMatrix'),eyeLocation=gl.getUniformLocation(program,'uEye');
 gl.enable(gl.DEPTH_TEST);gl.clearColor(.045,.09,.13,1);
 const seaColor=color('#31566a');
 function triangle(a,b,c,col){const n=norm(cross(vsub(b,a),vsub(c,a)));for(const p of [a,b,c])vertices.push(...p,...n,...col);}
 function boat(p){return [p[0],p[1]+Math.sin(elapsed*.9)*.12+p[0]*Math.sin(elapsed*.7)*.011,p[2]];}
 function box(x,y,z,sx,sy,sz,hex,angle=0,ship=true){
  const col=color(hex),co=Math.cos(angle),si=Math.sin(angle),p=[];
  for(const [a,b,c] of [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]){
   const dx=a*sx/2,dy=b*sy/2,q=[x+dx*co-dy*si,y+dx*si+dy*co,z+c*sz/2];p.push(ship?boat(q):q);
  }
  for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){triangle(p[a],p[b],p[c],col);triangle(p[a],p[c],p[d],col);}
 }
 function furniture(r){const x=r.x,y=r.y;
  box(x,y+.04,0,4.62,.12,4.5,r.color);box(x,y+1.2,-2.2,4.65,2.4,.14,'#344e59');
  box(x-2.32,y+1.15,0,.12,2.3,4.5,'#45606a');
  box(x,y+.14,2.2,4.6,.08,.12,'#c9aa71');
  box(x,y+2.35,-2,1.15,.07,.2,'#e8c98f');
  if(r.id==='engine'){
   box(x,y+.7,-.8,2.5,1.35,1.7,'#7c977f');for(let i=0;i<3;i++)box(x-.8+i*.8,y+1.45,-.8,.5,.35,.8,'#bec4a4');
   box(x-1.8,y+1.3,-1.8,.15,2.4,.16,'#bc995e');box(x-.5,y+2.1,-1.8,2.8,.15,.16,'#bc995e');box(x+.65,y+.9,.1,.55,.5,.12,'#d0b16b');
  }else if(r.id==='kitchen'){
   box(x,y+.45,-1,3.9,.9,1.1,'#a49c7a');box(x-.8,y+.95,-1.1,1.4,.1,.7,'#303f43');
   box(x+.9,y+1.2,-1.1,.65,.5,.65,'#b6c2b2');box(x+1,y+.5,.7,1.5,.12,.9,'#cfad78');box(x+1,y+.25,.7,.1,.5,.1,'#796d52');
  }else if(r.id==='hold'){
   for(let i=0;i<4;i++)box(x-1.3+(i%2)*1.2,y+.4+Math.floor(i/2)*.75,-1,.95,.7,1,'#ae8a5a');
   box(x+1.2,y+.6,-1.2,.8,1.1,.8,'#7f978b');box(x+1.2,y+.6,-.73,.85,.12,.12,'#d5b87e');
  }else if(r.id==='workshop'){
   box(x,y+.65,-1,3.6,.15,1.3,'#b59563');for(let k of [-1.5,1.5])box(x+k,y+.3,-1,.15,.6,1,'#657a72');
   for(let i=0;i<4;i++)box(x-1+i*.6,y+1.65,-2,.08,.6,.13,'#d6c493',.2*(i%2?1:-1));box(x+.8,y+.9,-1,.6,.4,.6,'#6c9b83');
  }else if(r.id==='bridge'){
   box(x,y+.7,-1,3.7,1.3,1,'#45646c');for(let i=0;i<3;i++)box(x-1.1+i*1.1,y+1.45,-1.1,.8,.55,.12,'#8fb5b0');
   box(x,y+.8,.05,.15,1.4,.15,'#c9a366');for(let i=0;i<8;i++){let a=i*Math.PI/4;box(x+Math.cos(a)*.42,y+1.25+Math.sin(a)*.42,.2,.25,.09,.15,'#dbc08b',a);}
  }else if(r.id==='radio'){
   box(x,y+.6,-1,3.7,.18,1.4,'#b08f63');box(x-.7,y+1.1,-1,1.5,.85,.7,'#526969');box(x-.8,y+1.2,-.63,.8,.3,.05,'#a3c8ab');
   for(let i=0;i<3;i++)box(x+.6+i*.35,y+.85,-.8,.18,.12,.2,'#d5b87a');box(x+.7,y+1.9,-1.3,.06,1.5,.06,'#c9cabb');
  }else if(r.id==='medical'){
   box(x-.5,y+.45,-.6,2.9,.2,1.2,'#68897b');box(x-.5,y+.65,-.6,2.7,.22,1.1,'#d5dcc6');box(x-1.45,y+.85,-.6,.55,.2,.8,'#f0e5c8');
   box(x+1.5,y+1.1,-1.6,.8,1.6,.65,'#bdc9b8');box(x+1.5,y+1.4,-1.24,.45,.14,.05,'#b86e61');box(x+1.5,y+1.4,-1.21,.14,.45,.05,'#b86e61');
  }else if(r.id==='dorm'){
   for(let level=0;level<2;level++){box(x-.6,y+.5+level*1.1,-.8,3,.15,1.3,'#b19366');box(x-.5,y+.65+level*1.1,-.8,2.7,.18,1.2,'#8498a7');box(x-1.45,y+.82+level*1.1,-.8,.6,.17,1,'#ddd7be');}
   for(let k of [-1.95,.85])box(x+k,y+1.25,-.9,.12,2.5,1.4,'#b19366');box(x+1.6,y+.55,.15,.8,1.1,.9,'#807366');
  }
 }
 function character(i,state,dt){
  const c=state.crew[i],r=byId[c.room]||byId[home[i]],work=c.work;
  let target=[r.x,r.y,.85];
  if(work?.kind==='collect') {const o=state.objects.find(o=>o.id===work.objectId);if(o){const p=objectPosition(o);target=[p[0]-.45,p[1]-.35,p[2]];}}
  else if(work)target=[r.x,r.y,.55];
  let p=positions.get(i);if(!p){p=target.slice();positions.set(i,p);}const distance=Math.hypot(p[0]-target[0],p[1]-target[1]);
  const moving=distance>.06;
  if(!api.paused())for(let k=0;k<3;k++)p[k]+=(target[k]-p[k])*Math.min(1,dt*3.5);
  const gait=moving?Math.sin(elapsed*13+i)*.38:0,breathe=Math.sin(elapsed*2+i)*.025,y=p[1]+breathe;
  const clothing=['#bd9866','#c2c9ad','#c5ad71','#547b98','#819e77'][i];
  for(let side of [-1,1]){box(p[0]+side*.16,y+.31,p[2],.22,.6,.27,'#354f60',side*gait);box(p[0]+side*.16,y+.06,p[2]+.07,.27,.13,.42,'#243941');}
  box(p[0],y+.86,p[2],.64,.7,.38,clothing);box(p[0],y+.6,p[2]+.21,.65,.09,.05,'#c8af76');
  for(let side of [-1,1]){let swing=work?Math.sin(elapsed*9)*.4:-side*gait;box(p[0]+side*.43,y+.86,p[2],.19,.65,.25,clothing,swing);box(p[0]+side*.43,y+.52,p[2]+.04,.19,.18,.22,'#dbb18d');}
  box(p[0],y+1.44,p[2],.55,.55,.48,'#ddb18b');for(let side of [-1,1])box(p[0]+side*.13,y+1.49,p[2]+.25,.065,.065,.035,'#283c46');
  if(i===0){box(p[0],y+1.78,p[2],.7,.12,.6,'#d2ac60');box(p[0],y+1.86,p[2],.5,.16,.44,'#b98f4e');}
  if(i===1){box(p[0],y+1.86,p[2],.62,.33,.5,'#e6e5d5');box(p[0]-.16,y+2.04,p[2],.3,.2,.38,'#e6e5d5');box(p[0]+.14,y+2.04,p[2],.3,.2,.38,'#e6e5d5');}
  if(i===2){box(p[0],y+1.8,p[2],.73,.1,.6,'#d3b46b');box(p[0],y+1.86,p[2],.49,.12,.4,'#bba063');}
  if(i===3){box(p[0],y+1.83,p[2],.65,.19,.5,'#ecebd9');box(p[0],y+1.73,p[2]+.07,.68,.07,.6,'#284755');box(p[0],y+1.84,p[2]+.26,.12,.1,.03,'#d6b46d');for(let side of [-1,1])box(p[0]+side*.23,y+1.16,p[2]+.2,.18,.07,.05,'#d6b46d');}
  if(i===4){box(p[0],y+1.8,p[2],.66,.16,.52,'#78936d');box(p[0],y+1.72,p[2]+.1,.7,.06,.6,'#3c604b');box(p[0]+.25,y+.84,p[2]+.27,.32,.43,.08,'#d6ca9b');for(let side of [-1,1]){box(p[0]+side*.13,y+1.49,p[2]+.27,.2,.025,.03,'#465f57');box(p[0]+side*.13,y+1.57,p[2]+.27,.2,.025,.03,'#465f57');}}
  if(i===api.selected())box(p[0],p[1]+.025,p[2],.95,.04,.75,'#eac07d');
  const element=document.getElementById('char-'+i);if(element){const q=project(boat([p[0],y+1.2,p[2]]));element.style.left=Math.round(q[0])+'px';element.style.top=Math.round(q[1])+'px';}
 }
 function objectPosition(o){const r=byId[roomOfType[o.type]],offset=((o.id*17)%29)/29;return [r.x-1.5+offset*3,r.y+.25,1.65];}
 function project(p){const w=matrix[3]*p[0]+matrix[7]*p[1]+matrix[11]*p[2]+matrix[15];return [(matrix[0]*p[0]+matrix[4]*p[1]+matrix[8]*p[2]+matrix[12])/w*width/2+width/2,height/2-(matrix[1]*p[0]+matrix[5]*p[1]+matrix[9]*p[2]+matrix[13])/w*height/2];}
 function camera(){
  const aspect=width/height,distance=Math.max(16.5,23/aspect)/zoom,target=[0,2,0];
  eye=[Math.sin(yaw)*Math.cos(pitch)*distance,2+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance];
  forward=norm(vsub(target,eye));right=norm(cross(forward,[0,1,0]));up=cross(right,forward);
  const view=new Float32Array([right[0],up[0],-forward[0],0,right[1],up[1],-forward[1],0,right[2],up[2],-forward[2],0,-dot(right,eye),-dot(up,eye),dot(forward,eye),1]);
  const f=1/Math.tan(.58),near=.1,far=180,projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);matrix=multiply(projection,view);
 }
 function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);let d=Math.min(devicePixelRatio||1,1.5);if(canvas.width!==Math.round(width*d)||canvas.height!==Math.round(height*d)){canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);gl.viewport(0,0,canvas.width,canvas.height);}camera();}
 function render(now){
  if(lost)return;if(last&&now-last<32){requestAnimationFrame(render);return;}const dt=Math.min(.05,(now-last)/1000||0);last=now;if(!api.paused())elapsed+=dt;
  resize();vertices=[];const state=api.state();
  for(let x=-36;x<37;x+=4)for(let z=-28;z<29;z+=4){let points=[[x,z],[x+4,z],[x+4,z+4],[x,z+4]].map(([a,b])=>[a,-.5+Math.sin(a*.28+elapsed*1.8)*.16+Math.cos(b*.4+elapsed)*.12,b]);let c=seaColor.map((v,i)=>v*(.85+Math.sin(x+z)*.018));triangle(points[0],points[2],points[1],c);triangle(points[0],points[3],points[2],c);}
  box(0,.35,0,20.3,1.1,5.1,'#294553');box(0,.82,2.6,20.4,.24,.16,'#c3a579');
  const bow=[boat([10.15,-.2,-2.55]),boat([10.15,-.2,2.55]),boat([12,-.2,0]),boat([10.15,.9,-2.55]),boat([10.15,.9,2.55]),boat([12,.9,0])];
  for(const [a,b,c] of [[0,1,2],[3,5,4],[0,3,4],[0,4,1],[1,4,5],[1,5,2],[2,5,3],[2,3,0]])triangle(bow[a],bow[b],bow[c],color('#385766'));
  for(const r of rooms)furniture(r);
  for(let level of [1,4.15]){box(9.6,level+1.15,0,.12,2.3,4.5,'#496370');box(0,level+2.45,-2.2,19.3,.16,.25,'#c0a477');}
  box(-9.6,6.6,0,.14,1.1,4.5,'#587983');box(-7.2,6.65,-.3,4.9,.16,4,'#c1b28c');
  box(-7.2,7.5,-1.3,.12,1.7,.12,'#c7b788');box(-6.65,8,-1.3,1,.5,.04,'#cb9667');
  if(state?.crew){state.crew.forEach((_,i)=>character(i,state,dt));
   for(const o of state.objects){const p=objectPosition(o);box(p[0],p[1],p[2],.35,.35,.35,{parts:'#c3cec6',ingredients:'#d5ad76',bait:'#d3ab85',charts:'#e1cc93',tools:'#a8c4a3'}[o.type]);const button=document.querySelector('.resource[data-id="'+o.id+'"]');if(button){let q=project(boat(p));button.style.left=Math.round(q[0])+'px';button.style.top=Math.round(q[1])+'px';}}
  }
  for(const r of rooms){const q=project(boat([r.x,r.y+.15,2.25]));const label=labels.get(r.id);label.style.left=Math.round(q[0])+'px';label.style.top=Math.round(q[1])+'px';}
  if(!api.paused())for(let i=0;i<55;i++){let x=((i*17)%49)-24,z=((i*13)%25)-10,y=((i*.73-elapsed*10)%12+12)%12;box(x,y,z,.018,.5,.018,'#758e9a',-.35,false);}
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);gl.uniformMatrix4fv(matrixLocation,false,matrix);gl.uniform3fv(eyeLocation,eye);gl.drawArrays(gl.TRIANGLES,0,vertices.length/9);
  requestAnimationFrame(render);
 }
 function focusRoom(id,move=true){const r=byId[id];if(!r)return;focused=id;document.getElementById('room-detail').textContent=r.name+' · '+r.note;for(const [k,b] of items)b.setAttribute('aria-pressed',String(k===id));if(move)api.move(id);}
 const list=document.getElementById('room-list'),layer=document.getElementById('room-labels');list.replaceChildren();
 for(const r of rooms){let b=document.createElement('button');b.textContent=r.name;b.dataset.room=r.id;b.onclick=()=>focusRoom(r.id);items.set(r.id,b);list.append(b);let label=document.createElement('span');label.className='room-3d-label';label.textContent=r.name;labels.set(r.id,label);layer.append(label);}
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch,moved:false};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;let dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;yaw=Math.max(-.7,Math.min(.7,drag.yaw+dx*.005));pitch=Math.max(.1,Math.min(.75,drag.pitch+dy*.004));});
 canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){let rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/width*2-1,y=1-(e.clientY-rect.top)/height*2;const direction=norm(forward.map((v,i)=>v+right[i]*x*width/height*Math.tan(.58)+up[i]*y*Math.tan(.58)));let hits=[];for(const r of rooms){let t=(r.y-eye[1])/direction[1];let p=eye.map((v,i)=>v+t*direction[i]);if(t>0&&Math.abs(p[0]-r.x)<2.3&&Math.abs(p[2])<2.25)hits.push({r,t});}hits.sort((a,b)=>a.t-b.t);if(hits[0])focusRoom(hits[0].r.id);}drag=null;});
 canvas.addEventListener('pointercancel',()=>{drag=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(1.65,zoom-e.deltaY*.001));},{passive:false});
 document.getElementById('camera-left').onclick=()=>{yaw=Math.max(-.7,yaw-.17);};document.getElementById('camera-right').onclick=()=>{yaw=Math.min(.7,yaw+.17);};
 document.getElementById('camera-in').onclick=()=>{zoom=Math.min(1.65,zoom+.12);};document.getElementById('camera-out').onclick=()=>{zoom=Math.max(.65,zoom-.12);};
 document.getElementById('camera-reset').onclick=()=>{yaw=.2;pitch=.31;zoom=1;};
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;scene.classList.remove('webgl-ready');api.fallback?.();document.getElementById('view-3d-status').textContent='La vue 3D a été interrompue · rechargez le jeu pour la rétablir';});
 scene.classList.add('webgl-ready');document.getElementById('view-3d-status').textContent='Vue 3D · glisser pour tourner · molette pour zoomer';focusRoom(focused,false);requestAnimationFrame(render);
 return { rooms:rooms.map(r=>r.id),home,roomForType:type=>roomOfType[type],focus:focusRoom,projectEffect:origin=>{if(!matrix||!origin)return null;let p;if(origin.object)p=objectPosition(origin.object);else if(Number.isInteger(origin.role))p=positions.get(origin.role)?.slice();if(!p)return null;p=p.slice();p[1]+=1.8;return project(boat(p));} };
}

// boat3d:end
(async () => {
const $ = (id) => document.getElementById(id);
const DAY_LENGTH = 140, SAVE_KEY = 'derniere-vague-v1';
// vague-network-v1 — Le moteur réseau reste dans le processus principal.
const NET=window.vagueNetwork;
let boatView=null;
const ROOM_IDS=['engine','kitchen','hold','workshop','bridge','radio','medical','dorm'];
const HOME_ROOMS=['engine','kitchen','hold','bridge','workshop'];
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
 {id:'fisher',name:'Marin',job:'Pêcheur',color:'#b9a263',resource:'bait',action:'Lancer la ligne',cost:{bait:1},duration:6,home:{x:77,y:28}},
 {id:'captain',name:'Émile',job:'Capitaine',color:'#54768c',resource:'charts',action:'Tenir le cap',cost:{charts:1},duration:7,home:{x:22,y:28}},
 {id:'inspector',name:'Victor',job:'Inspecteur',color:'#7d9877',resource:'tools',action:'Inspecter le bateau',cost:{tools:1},duration:6,home:{x:48,y:28}}
];
const resources = {
 parts:{label:'Pièces',singular:'une pièce',color:'#b2bcb3',role:0},
 ingredients:{label:'Provisions',singular:'une provision',color:'#c4946d',role:1},
 bait:{label:'Appâts',singular:'un appât',color:'#c3b081',role:2},
 fish:{label:'Poissons',singular:'un poisson',color:'#8bb5bc',role:2},
 charts:{label:'Cartes',singular:'une carte marine',color:'#c9c5a0',role:3},
 tools:{label:'Outils',singular:'un outil de contrôle',color:'#a0baa1',role:4}
};
function icon(type){
 const drawings={parts:'<path d="M8 4h5l2 7 5-5 4 3-5 8 2 7-6 3-4-8-7 1-2-5 7-4Z" fill="#a9b5ae"/><circle cx="13" cy="15" r="4" fill="#41575c"/><path d="m23 23 6 6" stroke="#e2d1aa" stroke-width="4"/>',ingredients:'<path d="M8 10h19l-2 20H10Z" fill="#b89466"/><path d="M10 10V7q7-5 15 0v3" fill="none" stroke="#e1c28b" stroke-width="2"/><path d="M17 14q-5-8 0-10 5 3 3 9" fill="#8cab78"/><circle cx="17" cy="22" r="5" fill="#cf7753"/>',bait:'<path d="M7 22c4-13 8 9 13-4s9-7 7-2" fill="none" stroke="#d1ac83" stroke-width="5" stroke-linecap="round"/><path d="M24 4v14q0 8-6 4" stroke="#b0c5c0" stroke-width="2" fill="none"/><circle cx="9" cy="19" r="1" fill="#354e54"/>',fish:'<path d="m4 17 5-7 5 4q12-12 18 3-7 14-18 4l-5 4Z" fill="#8bb7bc"/><path d="m20 10 4-5 3 9" fill="#5e909b"/><circle cx="27" cy="16" r="1.5" fill="#233d4a"/><path d="M19 14q-4 4 0 8" stroke="#c6d5c0" fill="none"/>'};
 drawings.charts='<path d="m4 8 9-3 10 3 9-3v23l-9 3-10-3-9 3Z" fill="#d8c99e"/><path d="M13 5v23m10-20v23" stroke="#8a977e" fill="none"/><path d="m7 19 4-5 7 8 9-9" stroke="#597f8d" stroke-width="2" fill="none"/><circle cx="27" cy="13" r="2" fill="#be7657"/>';
 drawings.tools='<path d="M7 12h23v17H7Z" fill="#809d88"/><path d="M13 12V7h11v5" fill="none" stroke="#c9bd91" stroke-width="3"/><path d="m10 24 13-13 4 4-13 13Z" fill="#c8d3ca"/><circle cx="12" cy="25" r="1.5" fill="#3e5956"/><path d="M7 18h23" stroke="#405d54"/>';
 return `<svg viewBox="0 0 36 36" aria-hidden="true">${drawings[type]}</svg>`;
}
function avatar(index){
 const r=roles[index];
 const hats=['<path d="M9 15q0-12 15-12t15 12" fill="#c79853"/><path d="M6 15h36" stroke="#ebbe74" stroke-width="4"/><path d="M24 4v9" stroke="#a77742" stroke-width="2"/>','<path d="M11 15V9q-8-10 4-9 8-9 13 0 14-4 10 8v7" fill="#eee7d2"/><path d="M12 11h26v7H12Z" fill="#d7d6bc"/>','<path d="M10 15q1-10 15-10 12 0 14 10Z" fill="#d6b467"/><path d="M8 15h34" stroke="#e2bf71" stroke-width="4"/>','<path d="M9 14 7 6q17-7 34 0l-2 8Z" fill="#e2e4d5"/><path d="M9 13h31v5H9Z" fill="#283e51"/><path d="M14 18q11 5 22 0" stroke="#ddbd78" stroke-width="3"/><path d="M24 6v7m-4-3q4 5 8 0" stroke="#c6a35f" fill="none"/>','<path d="M9 14q0-12 16-12 13 0 15 12Z" fill="#7d9877"/><path d="M8 14h32l-5 5H11Z" fill="#3a564b"/><rect x="22" y="6" width="6" height="6" rx="1" fill="#d8bd72"/>'];
 return `<svg viewBox="0 0 48 76" aria-hidden="true"><ellipse cx="25" cy="73" rx="14" ry="3" fill="#1a2a2b" opacity=".35"/><g class="body"><g class="leg-left"><path d="M16 51v17" stroke="#394e53" stroke-width="9"/><path d="M12 70h12" stroke="#202f35" stroke-width="6" stroke-linecap="round"/></g><g class="leg-right"><path d="M31 51v17" stroke="#394e53" stroke-width="9"/><path d="M28 70h12" stroke="#202f35" stroke-width="6" stroke-linecap="round"/></g><path d="M13 35q12-8 24 0l-1 21H14Z" fill="${r.color}"/><path d="M24 35v18" stroke="#e3cf9f" stroke-width="2"/><path d="M13 51h23" stroke="#4e5344" stroke-width="3"/><rect x="22" y="49" width="5" height="4" fill="#d8ba7e"/><g class="arm-left"><path d="m13 36-6 13" stroke="${r.color}" stroke-width="7" stroke-linecap="round"/><circle cx="6" cy="51" r="4" fill="#d9ad88"/></g><g class="arm-right"><path d="m36 36 5 13" stroke="${r.color}" stroke-width="7" stroke-linecap="round"/><circle cx="41" cy="51" r="4" fill="#d9ad88"/></g>${index===3?'<path d="M16 39h6m-6 4h6m6-4h6m-6 4h6" stroke="#ddbd78" stroke-width="2"/>':index===4?'<rect x="28" y="41" width="12" height="17" rx="2" fill="#d8caa1"/><path d="M30 45h8m-8 4h8m-8 4h5" stroke="#728d76"/>':''}</g><g class="head"><path d="M11 14q-3 18 13 21 16-1 15-20" fill="#d9ad88"/><circle cx="10" cy="23" r="3" fill="#d9ad88"/><circle cx="39" cy="23" r="3" fill="#d9ad88"/>${hats[index]}${index===4?'<g fill="none" stroke="#344746" stroke-width="1.2"><rect x="14" y="18" width="10" height="8" rx="3"/><rect x="26" y="18" width="10" height="8" rx="3"/><path d="M24 21h2"/></g>':''}<g class="eye"><circle cx="19" cy="22" r="1.7" fill="#2d373a"/><circle cx="31" cy="22" r="1.7" fill="#2d373a"/></g><path d="M23 24v3h3" fill="none" stroke="#b98970" stroke-width="1.5"/><path d="M20 29q5 4 10-1" fill="none" stroke="#814f3e" stroke-width="1.5"/>${index===0?'<path d="M16 27q4-3 8 0 4-3 9 0l-2 3-7-1-6 1Z" fill="#675343"/>':''}${index===1?'<path d="M11 16 8 27" stroke="#665444" stroke-width="5"/>':''}</g></svg>`;
}
let state, selected=0, paused=true, started=false, spawnTimer=0, saveTimer=0, uiTimer=0, lastTime=0, toastTimer, modalWasPaused=true;
function fresh(){return {version:1,day:1,time:0,hull:100,food:80,health:100,protection:0,inventory:{parts:2,ingredients:2,bait:2,fish:0,charts:2,tools:2},crew:roles.map(()=>({mood:Math.floor(Math.random()*moods.length),work:null})),objects:[],nextId:1,objectives:roles.map(()=>false),log:[],outcome:null};}
function validSave(s){return s && s.version===1 && Number.isInteger(s.day)&&s.day>0&&Number.isFinite(s.time)&&s.time>=0&&s.time<=DAY_LENGTH&&['hull','food','health'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=100)&&s.inventory&&Object.keys(resources).every(k=>Number.isInteger(s.inventory[k])&&s.inventory[k]>=0)&&Array.isArray(s.crew)&&s.crew.length===roles.length&&s.crew.every(c=>Number.isInteger(c.mood)&&c.mood>=0&&c.mood<moods.length)&&Array.isArray(s.objects)&&s.objects.length<=24&&s.objects.every(o=>['parts','ingredients','bait','charts','tools'].includes(o.type)&&Number.isFinite(o.x)&&Number.isFinite(o.y))&&Array.isArray(s.objectives)&&s.objectives.length===roles.length&&Array.isArray(s.log)&&Number.isInteger(s.nextId)&&[null,'won','lost'].includes(s.outcome);}
function upgradeSave(s){
 if(!s||!s.inventory||!Array.isArray(s.crew)||!Array.isArray(s.objectives))return s;
 s=JSON.parse(JSON.stringify(s));
 if(s.crew.length===3&&s.objectives.length===3){s.crew.push(...roles.slice(3).map(()=>({mood:Math.floor(Math.random()*moods.length),work:null})));s.objectives.push(false,false);s.inventory.charts=2;s.inventory.tools=2;}
 s.crew.forEach((c,i)=>{if(!ROOM_IDS.includes(c.room))c.room=HOME_ROOMS[i];});
 s.protection=Number.isFinite(s.protection)?Math.max(0,Math.min(18,s.protection)):0;
 return s;
}
function load(){try{const s=upgradeSave(JSON.parse(localStorage.getItem(SAVE_KEY)));if(validSave(s)){
 s.crew.forEach(c=>{const w=c.work;if(w && (!['collect','action'].includes(w.kind)||!Number.isFinite(w.duration)||w.duration<=0||!Number.isFinite(w.elapsed)||w.elapsed<0||(w.kind==='collect'&&!s.objects.some(o=>o.id===w.objectId)))) c.work=null;});
 s.objects.forEach(o=>o.claimed=s.crew.some(c=>c.work?.kind==='collect'&&c.work.objectId===o.id));return s;}}catch{}return null;}
function save(){try{localStorage.setItem(clientSave?'derniere-vague-coop-v1':SAVE_KEY,JSON.stringify(state));publishNetwork();$('save-status').textContent='Sauvegarde locale automatique';}catch{$('save-status').textContent='Sauvegarde indisponible dans ce navigateur';}}
function clock(){let mins=Math.floor(state.time/DAY_LENGTH*720)+360;return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;}
function log(message){state.log.unshift({time:clock(),message});state.log=state.log.slice(0,12);renderLog();}
function renderLog(){const target=$('log');target.replaceChildren();state.log.slice(0,3).forEach(entry=>{let div=document.createElement('div');div.className='log-entry';let time=document.createElement('span');time.textContent=entry.time;div.append(time,document.createTextNode(entry.message));target.append(div);});}
function toast(message){document.querySelector('.toast')?.remove();let t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=message;document.body.append(t);clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.remove(),3300);}
function float(text,x,y,origin){let el=document.createElement('span');el.className='float-text';el.textContent=text;const p=boatView?.projectEffect(origin);el.style.left=p?p[0]+'px':x+'%';el.style.top=(p?p[1]:y)+'px';$('float-texts').append(el);setTimeout(()=>el.remove(),2000);}
function spawn(type){if(state.objects.length>=20)return;type=type||['parts','ingredients','bait','charts','tools'][Math.floor(Math.random()*5)];let zones={parts:{min:8,max:31,y:176},ingredients:{min:39,max:63,y:174},bait:{min:65,max:92,y:26},charts:{min:9,max:30,y:26},tools:{min:36,max:57,y:26}};let z=zones[type],x=z.min+Math.random()*(z.max-z.min);for(let i=0;i<12 && state.objects.some(o=>o.type===type&&Math.abs(o.x-x)<7);i++)x=z.min+Math.random()*(z.max-z.min);if(state.objects.some(o=>o.type===type&&Math.abs(o.x-x)<5))return;state.objects.push({id:state.nextId++,type,x,y:z.y,claimed:false});renderObjects();}
function seedObjects(){['parts','parts','ingredients','ingredients','bait','bait','charts','charts','tools','tools'].forEach(spawn);}
function renderObjects(){const holder=$('objects');holder.replaceChildren();state.objects.forEach(o=>{let btn=document.createElement('button');btn.className='resource'+(roles[selected].resource!==o.type?' incompatible':'')+(o.claimed?' claimed':'');btn.style.left=o.x+'%';btn.style.top=o.y+'px';btn.dataset.id=o.id;btn.title=`Récupérer ${resources[o.type].singular} · ${roles[resources[o.type].role].job}`;btn.setAttribute('aria-label',btn.title);btn.disabled=!!o.claimed||paused||!!state.outcome||(netInfo.role!=='offline'&&netInfo.phase!=='running');btn.innerHTML=icon(o.type);btn.onclick=()=>collect(o.id);holder.append(btn);});}
function renderCrew(){
 $('crew-cards').innerHTML=roles.map((r,i)=>{const c=state.crew[i],m=moods[c.mood];return `<article class="crew-card ${selected===i?'selected':''}" data-crew="${i}"><button class="crew-select" data-select="${i}" aria-pressed="${selected===i}"><span class="portrait">${avatar(i)}</span><span><span class="crew-name">${r.name}</span><span class="crew-job" style="display:block">${r.job}</span></span><span class="mood" title="${m.note}">${m.icon} ${m.name}<small>Humeur du jour</small></span></button><div class="crew-status" id="status-${i}">Disponible · ${m.note.toLowerCase()}</div><button class="crew-action" id="action-${i}" data-action="${i}">${r.action}<span id="cost-${i}"></span></button><div class="work-track"><div id="work-${i}" style="width:0%"></div></div></article>`;}).join('');
 $('crew-cards').querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>select(Number(b.dataset.select)));
 $('crew-cards').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>work(Number(b.dataset.action)));
 $('characters').innerHTML=roles.map((r,i)=>`<button class="character ${i===selected?'selected':''}" id="char-${i}" style="left:${r.home.x}%;top:${r.home.y}px" aria-label="Sélectionner ${r.name}, ${r.job}" title="${r.name} · ${r.job}"><span class="name-tag">${r.name.toUpperCase()}</span>${avatar(i)}</button>`).join('');
 roles.forEach((r,i)=>{const el=$('char-'+i);el.onclick=()=>select(i);const w=state.crew[i].work;if(w){el.classList.add(w.kind==='collect'?'walking':'working');const o=state.objects.find(o=>o.id===w.objectId);if(o){el.style.left=o.x+'%';el.style.top=o.y+'px';}}});
}
function select(i){selected=i;document.querySelectorAll('.crew-card').forEach((c,j)=>c.classList.toggle('selected',i===j));document.querySelectorAll('.crew-select').forEach((c,j)=>c.setAttribute('aria-pressed',String(i===j)));roles.forEach((_,j)=>$('char-'+j).classList.toggle('selected',i===j));$('scene-hint').textContent=`${roles[i].name} · Récupérez ${i===0?'les pièces pour réparer':i===1?'les provisions pour cuisiner':i===2?'les appâts pour pêcher':i===3?'les cartes pour tenir le cap':'les outils pour inspecter le bateau'}.`;renderObjects();boatView?.focus(state.crew[i].room||HOME_ROOMS[i],false);}
function moveToRoom(id,role=selected){
 if(!ROOM_IDS.includes(id)||!Number.isInteger(role)||role<0||role>=roles.length||!canAct())return;
 if(state.crew[role].work){toast(roles[role].name+' termine d’abord son travail.');return;}
 if(netInfo.role==='client'){NET.command({type:'work',role:Math.min(role,2),crewRole:role,moveRoom:id});return;}
 state.crew[role].room=id;save();
}
function canAct(){if(netInfo.role!=='offline'&&netInfo.phase!=='running'){toast('Synchronisation du jeu en cours…');return false;}if(paused||state.outcome){toast('Reprenez la traversée pour donner un ordre.');return false;}return true;}
function collect(id){if(netInfo.role==='client'){if(canAct())NET.command({type:'collect',role:Math.min(selected,2),crewRole:selected,objectId:id});return;}if(!canAct())return;let o=state.objects.find(o=>o.id===id);if(!o||o.claimed)return;let r=roles[selected],c=state.crew[selected];if(r.resource!==o.type){toast(`Cet objet est destiné au ${roles[resources[o.type].role].job.toLowerCase()}. Sélectionnez le bon marin.`);return;}if(c.work){toast(`${r.name} est déjà au travail.`);return;}o.claimed=true;c.room=boatView?.roomForType(o.type)||HOME_ROOMS[selected];c.work={kind:'collect',objectId:id,duration:3/moods[c.mood].speed,elapsed:0};let el=$('char-'+selected);el.style.left=o.x+'%';el.style.top=o.y+'px';el.classList.add('walking');renderObjects();renderStats();save();}
function costFor(i){return i===1&&state.inventory.fish>0?{fish:1}:roles[i].cost;}
function work(i){if(netInfo.role==='client'){if(canAct())NET.command({type:'work',role:Math.min(i,2),crewRole:i});return;}if(!canAct())return;select(i);let c=state.crew[i];if(c.work){toast(`${roles[i].name} termine d’abord son travail.`);return;}let cost=costFor(i);if(Object.entries(cost).some(([key,n])=>state.inventory[key]<n)){toast(i===0?'Il faut 2 pièces. Récupérez-les dans la salle des machines.':i===1?'Il faut 2 provisions ou 1 poisson. Récupérez des provisions ou envoyez le pêcheur.':i===2?'Il faut 1 appât. Récupérez-en sur le pont.':i===3?'Il faut 1 carte marine. Récupérez-en sur le pont.':'Il faut 1 outil de contrôle. Récupérez-en sur le pont.');return;}Object.entries(cost).forEach(([key,n])=>state.inventory[key]-=n);c.room=HOME_ROOMS[i];c.work={kind:'action',duration:roles[i].duration/moods[c.mood].speed,elapsed:0};let el=$('char-'+i);el.style.left=roles[i].home.x+'%';el.style.top=roles[i].home.y+'px';el.classList.add('working');renderStats();save();}
function complete(i){let c=state.crew[i],job=c.work;c.work=null;let char=$('char-'+i);char.classList.remove('walking','working');if(job.kind==='collect'){let o=state.objects.find(o=>o.id===job.objectId);if(o){state.inventory[o.type]++;state.objects=state.objects.filter(x=>x.id!==o.id);float('+1 '+resources[o.type].label,o.x,o.y-35,{object:o});log(`${roles[i].name} a récupéré ${resources[o.type].singular}.`);renderObjects();}}else{state.objectives[i]=true;if(i===0){state.hull=Math.min(100,state.hull+26);float('+26 coque',roles[i].home.x,135,{role:i});log('Gaston consolide la coque. On tiendra !');}if(i===1){state.food=Math.min(100,state.food+30);state.health=Math.min(100,state.health+8);float('+30 repas',roles[i].home.x,135,{role:i});log('Un repas chaud. Suzanne remonte le moral du bord.');}if(i===2){state.inventory.fish+=2;float('+2 poissons',roles[i].home.x,0,{role:i});log('Deux poissons ! De quoi remplir la marmite.');}if(i===3){state.protection=18;float('Cap tenu · 18 s',roles[i].home.x,0,{role:i});log('Émile tient le cap : dégâts de tempête réduits de moitié pendant 18 secondes.');}if(i===4){state.hull=Math.min(100,state.hull+8);state.health=Math.min(100,state.health+12);float('+8 coque · +12 santé',roles[i].home.x,0,{role:i});log('Victor repère les points faibles : coque renforcée et équipage rassuré.');}}char.style.left=roles[i].home.x+'%';char.style.top=roles[i].home.y+'px';save();}
function renderStats(){
 for(const key of ['hull','food','health']){let n=Math.ceil(state[key]);$(key+'-value').textContent=n+'%';$(key+'-bar').style.width=n+'%';$(key+'-value').classList.toggle('critical',n<25);}
 $('hull-note').textContent=state.protection>0?'Cap tenu : dégâts réduits · '+Math.ceil(state.protection)+' s':state.hull<25?'Danger ! Réparez la coque rapidement':state.hull<60?'La coque subit les assauts de la mer':'Le bateau tient bon';
 $('food-note').textContent=state.food<20?'Repas épuisés : la santé baisse':'De quoi tenir quelques heures';
 $('health-note').textContent=state.health<35?'L’équipage a besoin de repas chauds':'Tout le monde est à bord';
 $('day-label').textContent='JOUR '+String(state.day).padStart(2,'0');$('clock').textContent=clock()+' · '+(state.time<35?'À l’aube':state.time<95?'En pleine tempête':'Dernière ligne droite');
 $('time-bar').style.width=state.time/DAY_LENGTH*100+'%';$('remaining').textContent='Tenir jusqu’à 18:00 · '+Math.ceil(DAY_LENGTH-state.time)+' s';
 $('inventory').innerHTML=Object.entries(resources).map(([k,r])=>`<div class="inventory-item">${icon(k)}<div><strong id="count-${k}">${state.inventory[k]}</strong><small>${r.label}</small></div></div>`).join('');
 roles.forEach((r,i)=>{const c=state.crew[i],cost=costFor(i);$('cost-'+i).textContent=Object.entries(cost).map(([key,n])=>n+' '+(n===1?{parts:'pièce',ingredients:'provision',bait:'appât',fish:'poisson',charts:'carte',tools:'outil'}[key]:resources[key].label.toLowerCase())).join(' + ');$('action-'+i).disabled=paused||(netInfo.role!=='offline'&&netInfo.phase!=='running')||!!state.outcome||!!c.work||Object.entries(cost).some(([key,n])=>state.inventory[key]<n);$('status-'+i).textContent=c.work?(c.work.kind==='collect'?'Récupération en cours…':'Au travail…'):'Disponible · '+moods[c.mood].note.toLowerCase();$('work-'+i).style.width=c.work?Math.min(100,c.work.elapsed/c.work.duration*100)+'%':'0%';});
 $('objectives').innerHTML=['Réparer la coque','Préparer un repas chaud','Ramener du poisson','Tenir le cap','Inspecter le bateau'].map((label,i)=>`<div class="objective ${state.objectives[i]?'done':''}"><i>${state.objectives[i]?'✓':''}</i>${label}</div>`).join('');$('objective-count').textContent=state.objectives.filter(Boolean).length+' / '+roles.length;
}
function setPause(value){paused=value;document.querySelector('.app').classList.toggle('paused',value);$('pause-shade').hidden=!value||!!state.outcome||$('welcome').open||$('confirm-reset').open||$('code-notebook').open;$('pause').textContent=value?'▶':'II';$('pause').setAttribute('aria-label',value?'Reprendre la partie':'Mettre en pause');renderObjects();renderStats();}
function endDay(outcome){state.outcome=outcome;setPause(true);log(outcome==='won'?'18:00. Une journée de plus. Nous sommes toujours là.':state.hull<=0?'La coque a cédé sous les vagues.':'L’équipage n’a plus la force de tenir.');save();showResult();}
function showResult(){let won=state.outcome==='won';$('result-eyebrow').textContent=won?'JOUR '+state.day+' · TRAVERSÉE RÉUSSIE':'FIN DE LA TRAVERSÉE';$('result-title').textContent=won?'Encore à flot.':'La mer a eu le dernier mot.';$('result-description').textContent=won?'Le soir est arrivé et tout l’équipage est vivant. Demain, la tempête sera plus forte et chacun aura une nouvelle humeur.':state.hull<=0?'La coque a cédé. Collectez des pièces et faites réparer Gaston plus souvent lors de la prochaine traversée.':'Les repas ont manqué trop longtemps. Pêchez et cuisinez pour protéger l’équipage.';$('result-stats').innerHTML=`<div><strong>${Math.ceil(state.hull)} %</strong>Coque</div><div><strong>${Math.ceil(state.health)} %</strong>Santé</div><div><strong>${state.objectives.filter(Boolean).length} / ${roles.length}</strong>Objectifs</div>`;$('next-day').textContent=won?'Affronter le jour '+(state.day+1)+' →':'Recommencer la traversée →';if(!$('result').open)$('result').showModal();}
function nextDay(){if(state.outcome==='lost'){reset();return;}state.day++;state.time=0;state.protection=0;state.outcome=null;state.objectives=roles.map(()=>false);state.crew.forEach((c,i)=>{c.mood=Math.floor(Math.random()*moods.length);c.work=null;});state.objects=[];spawnTimer=0;renderCrew();seedObjects();log('Nouvelle aube. Les humeurs changent, la tempête reste.');$('result').close();started=true;setPause(false);select(selected);save();}
function reset(){state=fresh();selected=0;spawnTimer=saveTimer=0;document.querySelectorAll('dialog').forEach(d=>d.close());$('float-texts').replaceChildren();renderCrew();seedObjects();log('L’Espérance quitte l’abri. Tout le monde à son poste !');started=true;setPause(false);select(0);save();}
function tick(dt){if(netInfo.role==='client'||netInfo.role==='host'&&netInfo.phase!=='running')return;if(paused||state.outcome)return;dt=Math.min(dt,DAY_LENGTH-state.time);state.time+=dt;const storm=1+Math.min(state.day-1,9)*.13;state.hull=Math.max(0,state.hull-.31*storm*(dt-Math.min(dt,state.protection)*.5));state.protection=Math.max(0,state.protection-dt);state.food=Math.max(0,state.food-dt*.36);if(state.food<15)state.health=Math.max(0,state.health-dt*(state.food<=0?1.1:.3));state.crew.forEach((c,i)=>{if(c.work){c.work.elapsed+=dt;if(c.work.elapsed>=c.work.duration)complete(i);}});spawnTimer+=dt;saveTimer+=dt;uiTimer+=dt;if(spawnTimer>=4.5){spawnTimer=0;const type=['parts','ingredients','bait','charts','tools'][Math.floor(Math.random()*5)];spawn(type);}
 if(state.hull<=0||state.health<=0)endDay('lost');else if(state.time>=DAY_LENGTH)endDay('won');if(saveTimer>=2){saveTimer=0;save();}if(uiTimer>=.1){uiTimer=0;renderStats();publishNetwork();}}
function frame(now){if(lastTime)tick(Math.min((now-lastTime)/1000,.25));lastTime=now;requestAnimationFrame(frame);}
$('pause').onclick=()=>{if(state.outcome)return;setPause(!paused);save();};$('resume').onclick=()=>setPause(false);
$('help').onclick=()=>{modalWasPaused=paused;setPause(true);$('start').textContent='Retour à bord →';$('welcome').showModal();$('pause-shade').hidden=true;};
$('start').onclick=()=>{const first=!started;$('welcome').close();started=true;setPause(first?false:modalWasPaused);save();};
$('welcome').addEventListener('cancel',e=>{e.preventDefault();$('start').click();});
$('result').addEventListener('cancel',e=>e.preventDefault());$('next-day').onclick=nextDay;
$('reset').onclick=()=>{modalWasPaused=paused;setPause(true);$('confirm-reset').showModal();$('pause-shade').hidden=true;};
$('cancel-reset').onclick=()=>{$('confirm-reset').close();setPause(modalWasPaused);};$('confirm-reset').addEventListener('cancel',e=>{e.preventDefault();$('cancel-reset').click();});$('confirm-new').onclick=reset;
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();$('pause').click();}if(['1','2','3','4','5'].includes(e.key))select(Number(e.key)-1);});
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
 if(value)value={...value,state:upgradeSave(value.state)};
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
state=load();let restored=!!state;if(!state)state=fresh();
try{boatView=createBoat3D({state:()=>state,selected:()=>selected,paused:()=>paused,move:moveToRoom,fallback:()=>{renderCrew();renderObjects();}});}catch(error){console.error(error);$('view-3d-status').textContent='Vue de secours · la 3D n’a pas pu démarrer';}
if(!boatView){$('room-list').querySelectorAll('button').forEach(b=>b.onclick=()=>{moveToRoom(b.dataset.room);$('room-detail').textContent=b.textContent+' · vue de secours';});for(const id of ['camera-left','camera-right','camera-in','camera-out','camera-reset'])$(id).disabled=true;}
renderCrew();if(!state.objects.length)seedObjects();renderLog();select(0);setPause(true);
if(netInfo.role!=='offline'){
 started=true;
 if(netInfo.runtime&&!applyShared(netInfo.runtime))return;
}else if(!restored){log('L’Espérance quitte l’abri. Tout le monde à son poste !');$('welcome').showModal();$('pause-shade').hidden=true;}
else{started=true;if(state.outcome)showResult();else toast('Partie retrouvée. Reprenez la traversée quand vous êtes prêt.');}
renderNetwork();
if(NET){
 NET.onStatus(info=>{netInfo=info;renderNetwork();renderStats();renderObjects();});
 NET.onSnapshot(packet=>{if(packet.revision===netInfo.revision&&(netInfo.role==='client'||packet.force)){applyShared(packet.runtime);if(netInfo.role==='host'&&packet.force)publishNetwork();}});
 NET.onCommand(command=>{if(netInfo.role!=='host'||netInfo.phase!=='running')return;const role=command.crewRole??command.role;if(!Number.isInteger(role)||role<0||role>=roles.length)return;if(command.moveRoom!==undefined){moveToRoom(command.moveRoom,role);publishNetwork();return;}const previous=selected;if(command.type==='collect'){select(role);collect(command.objectId);}else if(command.type==='work')work(role);select(previous);publishNetwork();});
 if(netInfo.role!=='offline')NET.ready(netInfo.revision);
 publishNetwork();
}
requestAnimationFrame(frame);
})().catch(error=>{console.error(error);});
