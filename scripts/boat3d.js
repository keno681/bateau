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
