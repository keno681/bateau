'use strict';
const net = require('node:net');
const os = require('node:os');
const udp = require('./udp-stream.cjs');
const { Match } = require('./match.cjs');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const FILES = ['index.html', 'style.css', 'game.js'];
const MAX_FRAME = 4 * 1024 * 1024;
const cleanName = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 24) || 'Marin' : 'Marin';
const clone = value => JSON.parse(JSON.stringify(value));
const digest = files => crypto.createHash('sha256').update(JSON.stringify(FILES.map(f => [f, files[f]]))).digest('hex');
function bundle(files) {
  if (!files || typeof files !== 'object' || Object.keys(files).length !== 3 || !FILES.every(f => typeof files[f] === 'string' && Buffer.byteLength(files[f]) <= 1_000_000)) throw new Error('Fichiers de partie invalides.');
  const checked = Object.fromEntries(FILES.map(f => [f, files[f]]));
  if (Buffer.byteLength(JSON.stringify(checked)) > MAX_FRAME - 4096) throw new Error('Les fichiers sont trop volumineux pour le multijoueur.');
  return checked;
}
function runtime(value) {
  if (!value || typeof value.paused !== 'boolean' || !value.state || typeof value.state !== 'object' || Array.isArray(value.state) || JSON.stringify(value).length > 200000) throw new Error('État de partie invalide.');
  return clone(value);
}
function keyFor(secret) { return crypto.createHash('sha256').update('derniere-vague-room-v1:' + secret).digest(); }
function wire(socket, secret, onMessage, onClose) {
  const key = keyFor(secret); let data = Buffer.alloc(0), count = 0, start = Date.now(), closed = false;
  socket.setNoDelay(true); socket.setKeepAlive(true, 2000);
  const send = message => {
    if (socket.destroyed || socket.writableLength > MAX_FRAME * 2) return false;
    const raw = Buffer.from(JSON.stringify(message)); if (raw.length > MAX_FRAME - 64) throw new Error('Message trop volumineux.');
    const nonce = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const ciphertext = Buffer.concat([cipher.update(raw), cipher.final()]);
    const payload = Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]), header = Buffer.alloc(4); header.writeUInt32BE(payload.length);
    socket.write(Buffer.concat([header, payload])); return true;
  };
  socket.on('data', chunk => {
    try {
      data = Buffer.concat([data, chunk]); if (data.length > MAX_FRAME * 2) throw new Error('Message trop volumineux.');
      while (data.length >= 4) {
        const length = data.readUInt32BE(0); if (length < 29 || length > MAX_FRAME) throw new Error('Trame invalide.');
        if (data.length < length + 4) break;
        const packet = data.subarray(4, length + 4); data = data.subarray(length + 4);
        if (Date.now() - start > 1000) { count = 0; start = Date.now(); } if (++count > 200) throw new Error('Trop de messages.');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, packet.subarray(0, 12)); decipher.setAuthTag(packet.subarray(12, 28));
        const message = JSON.parse(Buffer.concat([decipher.update(packet.subarray(28)), decipher.final()]).toString('utf8'));
        if (!message || typeof message.type !== 'string') throw new Error('Message invalide.');
        onMessage(message);
      }
    } catch { socket.destroy(); }
  });
  socket.on('error', () => {}); socket.on('end', () => socket.destroy());
  socket.on('close', () => { if (!closed) { closed = true; onClose(); } });
  return { socket, send };
}
function parseInvitation(text) {
  if (typeof text !== 'string' || text.length > 1600 || !text.trim().startsWith('VAGUE1-')) throw new Error('Collez le code d’invitation complet fourni par l’hôte (VAGUE1-…).');
  let value; try { value = JSON.parse(Buffer.from(text.trim().slice(7), 'base64url').toString('utf8')); } catch { throw new Error('Code d’invitation illisible.'); }
  if (value?.v === 1) throw new Error('Ce code utilise l’ancien réseau TCP. Installez la version UDP 1.4.0 sur tous les PC et créez un nouveau salon.');
  if (value.v !== 2 || !Array.isArray(value.addresses) || !value.addresses.length || value.addresses.length > 8 || !value.addresses.every(a => typeof a === 'string' && net.isIPv4(a)) || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || typeof value.secret !== 'string' || !/^[\w-]{32}$/.test(value.secret)) throw new Error('Code d’invitation invalide.');
  return value;
}
function addresses() {
  const all = Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  all.sort((a, b) => (a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : 2) - (b.startsWith('192.168.') ? 0 : b.startsWith('10.') ? 1 : 2));
  return [...new Set([...all.slice(0, 7), '127.0.0.1'])];
}
class Room extends EventEmitter {
  constructor({ version, validateFiles, barrierTimeout = 12000, id } = {}) {
    super(); this.version = version || '1.5.0'; this.validateFiles = validateFiles || bundle; this.barrierTimeout = barrierTimeout;
    this.role = 'offline'; this.phase = 'idle'; this.revision = 0; this.files = null; this.runtime = null; this.players = [];
    this.id = typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)?id:crypto.randomUUID(); this.peers = new Map(); this.connections = new Set(); this.server = null; this.link = null; this.closed = false; this.pending = null; this.error = null; this.accepted = 0; this.match = null; this.remoteMatch = null; this.actionRequests = new Map();
  }
  connectedIds(){return [this.id,...[...this.peers].filter(([,p])=>p.ready===this.revision).map(([id])=>id)];}
  status(privateInfo = false) {
    return { role: this.role, phase: this.phase, revision: this.revision, id: this.id, players: clone(this.players), error: this.error, ...(this.match ? {match:{...this.match.public(this.connectedIds()),...this.match.private(this.id)}} : this.remoteMatch ? {match:clone(this.remoteMatch)} : {}), ...(this.role === 'host' ? { acceptedConnections: this.accepted } : {}), ...(privateInfo && this.role === 'host' ? { invitation: this.invitation, addresses: this.addresses, port: this.port } : {}) };
  }
  notify() { this.emit('status', this.status()); }
  bootstrap() { return { ...this.status(), runtime: this.runtime && clone(this.runtime) }; }
  checkFiles(files) { const checked = bundle(files); this.validateFiles(checked); return checked; }
  broadcastMatch() {
    if (!this.match) return;
    const shared=this.match.public(this.connectedIds());
    for(const [id,peer] of this.peers)peer.link.send({type:'match',match:{...shared,...this.match.private(id)}});
    this.notify();
  }
  lobbyReady(value) {
    if(typeof value!=='boolean')throw Error('État Prêt invalide.');
    if(this.role==='client'){if(this.phase!=='running')throw Error('Le jeu se synchronise encore.');this.link.send({type:'lobby-ready',value});return;}
    if(!this.match)throw Error('Aucun salon avec saboteur.');this.match.setReady(this.id,value);this.broadcastMatch();
  }
  async startMatch() {
    if(this.role!=='host'||!this.match||this.phase!=='running')throw Error('Seul l’hôte peut commencer la partie.');
    const ids=this.players.map(p=>p.id);this.match.checkStart(ids);
    if([...this.peers.values()].some(p=>p.ready!==this.revision))throw Error('Les fichiers se chargent encore chez un joueur.');
    await this.prepareFiles(this.files);
    // Slots cannot change during preparation; every participant acknowledged.
    const current=this.players.map(p=>p.id);
    try {this.pending.runtime=this.match.start(current);this.broadcastMatch();this.commitPrepared();}
    catch(error){this.abortPreparation(error.message);throw error;}
  }
  returnToLobby() {
    if(this.role!=='host'||!this.match||this.phase!=='running'||this.match.stage!=='finished')throw Error('Terminez la traversée avant de revenir au salon.');
    this.match=new Match({goalDays:this.match.goalDays,sleepDuration:this.match.sleepDuration});this.runtime.paused=true;this.runtime.effectsRevision=0;this.broadcastMatch();this.pushRuntime();
  }
  pushRuntime(){this.broadcast({type:'snapshot',revision:this.revision,runtime:this.runtime});this.emit('snapshot',{runtime:clone(this.runtime),revision:this.revision,force:true});}
  sabotage(action,target) {
    if(this.role==='client')return new Promise(resolve=>{
      if(this.phase!=='running'||this.actionRequests.size){resolve({ok:false,error:'Une action ou une synchronisation est déjà en cours.'});return;}
      const id=crypto.randomUUID(),timer=setTimeout(()=>{this.actionRequests.delete(id);resolve({ok:false,error:'L’hôte ne répond pas. Vérifiez votre mission avant de réessayer.'});},12000);timer.unref();this.actionRequests.set(id,{resolve,timer});
      this.link.send({type:'sabotage',id,action,target,revision:this.revision});
    });
    try {this.applySabotage(this.id,action,target);return Promise.resolve({ok:true});}catch(error){return Promise.resolve({ok:false,error:error.message});}
  }
  applySabotage(id,action,target) {
    if(!this.match||this.phase!=='running'||this.match.public(this.connectedIds()).blocked)throw Error('La partie n’est pas prête.');
    this.runtime=this.match.act(id,action,target,this.runtime);this.broadcastMatch();this.pushRuntime();
  }
  roster() {
    this.players = [{ id: this.id, name: this.name, host: true }, ...[...this.peers].map(([id, p]) => ({ id, name: p.name, host: false }))];
    this.broadcast({ type: 'roster', players: this.players }); if(this.match){if(this.match.stage==='waiting')for(const id of this.match.ready)if(!this.players.some(p=>p.id===id))this.match.ready.delete(id);this.broadcastMatch();if(this.match.public(this.connectedIds()).blocked){this.runtime.paused=true;this.pushRuntime();}}this.notify();
  }
  broadcast(message) { for (const peer of this.peers.values()) peer.link.send(message); }
  async host({ name, port = 16383, files, traitor = false, goalDays = 3, sleepDuration = 'day' } = {}) {
    if (this.role !== 'offline') throw new Error('Quittez la partie actuelle avant d’en héberger une autre.');
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port invalide.');
    const checked = this.checkFiles(files);
    if(traitor&&!files['game.js'].includes('vague-saboteur-v1'))throw Error('Appliquez SALON-SABOTEUR-POKEBALL.txt ou utilisez F8 pour restaurer les fichiers du moteur 1.5.0 avant de créer ce salon.');
    if (!this.runtime) throw new Error('Le jeu se charge encore. Fermez le salon puis réessayez.');
    this.files = checked; this.name = cleanName(name); this.secret = crypto.randomBytes(24).toString('base64url');
    this.match=traitor?new Match({goalDays,sleepDuration}):null;this.remoteMatch=null;if(this.match)this.runtime.paused=true;
    this.closed = false; this.server = udp.createServer(this.secret, socket => this.accept(socket));
    try {
      await new Promise((resolve, reject) => { const fail = e => reject(e); this.server.once('error', fail); this.server.listen(port, '0.0.0.0', () => { this.server.removeListener('error', fail); resolve(); }); });
    } catch (error) { this.server = null; this.files = null; throw new Error(error.code === 'EADDRINUSE' ? 'Ce port est déjà utilisé. Choisissez un autre port.' : 'Impossible d’héberger : ' + error.message); }
    this.server.on('error', e => { this.error = e.message; this.notify(); });
    this.port = this.server.address().port; this.addresses = addresses();
    this.invitation = 'VAGUE1-' + Buffer.from(JSON.stringify({ v: 2, addresses: this.addresses, port: this.port, secret: this.secret })).toString('base64url');
    this.role = 'host'; this.phase = 'running'; this.revision = 1; this.error = null; this.roster();
    this.heartbeat = setInterval(() => { for (const peer of this.peers.values()) { if (Date.now()-peer.lastSeen>15000) peer.link.socket.destroy(); else peer.link.send({ type: 'ping' }); } }, 3000); this.heartbeat.unref();
    return this.status(true);
  }
  accept(socket) {
    if (this.connections.size > 12) { socket.destroy(); return; }
    this.connections.add(socket); let peerId = null;
    const timer = setTimeout(() => socket.destroy(), 5000); timer.unref();
    const link = wire(socket, this.secret, message => {
      if (!peerId) {
        if (message.type !== 'hello' || message.protocol !== 1 || message.version !== this.version || typeof message.id !== 'string' || !/^[a-f0-9-]{36}$/.test(message.id)) { link.send({ type: 'reject', error: 'Tous les joueurs doivent utiliser la même version du jeu.' }); socket.end(); return; }
        if (this.phase !== 'running') { link.send({ type: 'reject', error: 'Mise à jour en cours. Réessayez dans quelques secondes.' }); socket.end(); return; }
        if(this.match&&this.match.stage!=='waiting'&&!this.match.members.includes(message.id)){link.send({type:'reject',error:'Cette traversée a déjà commencé. Attendez le prochain salon.'});socket.end();return;}
        if (this.peers.size >= 4 || this.peers.has(message.id) || message.id === this.id) { link.send({ type: 'reject', error: 'La partie est complète : cinq personnes maximum.' }); socket.end(); return; }
        clearTimeout(timer); peerId = message.id; this.accepted++;
        this.peers.set(peerId, { link, name: cleanName(message.name), lastSeen: Date.now(), ready: 0 });
        this.roster(); link.send({ type: 'welcome', revision: this.revision, files: this.files, digest: digest(this.files), runtime: this.runtime, players: this.players, ...(this.match?{match:{...this.match.public(this.connectedIds()),...this.match.private(peerId)}}:{}) }); return;
      }
      const peer = this.peers.get(peerId); if (!peer || peer.link !== link) return; peer.lastSeen = Date.now();
      if(message.type==='lobby-ready'&&this.match&&typeof message.value==='boolean'&&peer.ready===this.revision){try{this.match.setReady(peerId,message.value);this.broadcastMatch();}catch{}return;}
      if(message.type==='sabotage'&&typeof message.id==='string'&&/^[a-f0-9-]{36}$/.test(message.id)){
        let result;try{if(peer.ready!==this.revision||message.revision!==this.revision)throw Error('Le jeu se synchronise.');this.applySabotage(peerId,message.action,message.target);result={ok:true};}catch(error){result={ok:false,error:error.message};}
        link.send({type:'sabotage-result',id:message.id,result});return;
      }
      if (message.type === 'command' && this.phase === 'running' && peer.ready === this.revision && message.revision === this.revision) {
        if(this.match&&(this.match.stage!=='playing'||this.match.public(this.connectedIds()).blocked))return;
        const c = message.command;
        if (c && ['work', 'collect'].includes(c.type) && Number.isInteger(c.role) && c.role >= 0 && c.role <= 2 && (c.type !== 'collect' || Number.isInteger(c.objectId))) this.emit('command', { ...c, player: peerId });
      }
      if (message.type === 'prepared' && this.pending && message.revision === this.pending.revision) {
        if (!message.ok) this.abortPreparation('Un joueur ne peut pas charger cette modification. Aucun changement partagé n’a été appliqué.');
        else { this.pending.waiting.delete(peerId); this.checkPrepared(); }
      }
      if (message.type === 'ready' && message.revision === this.revision) { peer.ready = this.revision; if(this.match)this.broadcastMatch(); if (this.phase === 'running') link.send({ type: 'resume', revision: this.revision, runtime: this.runtime }); else this.checkReady(); }
    }, () => {
      clearTimeout(timer); this.connections.delete(socket);
      if (peerId && this.peers.get(peerId)?.link === link) { this.peers.delete(peerId); if (this.pending) this.pending.waiting.delete(peerId); this.roster(); this.checkPrepared(); this.checkReady(); }
    });
  }
  async join({ name, invitation } = {}) {
    if (this.role !== 'offline') throw new Error('Quittez la partie actuelle avant de rejoindre une autre partie.');
    this.invite = parseInvitation(invitation); this.name = cleanName(name); this.role = 'client'; this.phase = 'connecting'; this.closed = false; this.error = null; this.notify();
    try { await this.connect(); return this.status(); }
    catch (error) { this.role = 'offline'; this.phase = 'idle'; this.files = null; this.error = error.message; this.notify(); throw error; }
  }
  async connect() {
    let last;
    for (const address of this.invite.addresses) {
      if (this.closed) throw new Error('Connexion annulée.');
      this.error = 'Connexion à ' + address + '…'; this.notify();
      try { await this.connectAddress(address); return; } catch (error) { last = error; if (error.rejected) throw error; }
    }
    throw new Error(last?.rejected ? last.message : 'Hôte introuvable. Vérifiez le même Wi-Fi, le code complet et l’autorisation du jeu sur le réseau privé dans le pare-feu Windows.');
  }
  connectAddress(address) {
    return new Promise((resolve, reject) => {
      const socket = udp.createConnection({ host: address, port: this.invite.port, secret: this.invite.secret }); let welcomed = false, settled = false;
      const finish = error => { if (settled) return; settled = true; clearTimeout(timer); if (error) { socket.destroy(); reject(error); } else resolve(); };
      const timer = setTimeout(() => finish(new Error('Délai de connexion dépassé.')), 8000); timer.unref();
      const link = wire(socket, this.invite.secret, message => {
        try {
          if (message.type === 'reject') { const error = new Error(message.error); error.rejected = true; finish(error); return; }
          if (message.type === 'welcome') {
            const files = this.checkFiles(message.files); if (digest(files) !== message.digest || !Number.isInteger(message.revision)) throw new Error('La version reçue est invalide.');
            this.files = files; this.revision = message.revision; this.runtime = message.runtime ? runtime(message.runtime) : null; this.players = message.players; this.remoteMatch=message.match||null; this.link = link; this.phase = 'loading'; this.error = null; this.lastReceived = Date.now(); clearInterval(this.watchdog); this.watchdog = setInterval(() => { if (this.link && Date.now()-this.lastReceived>15000) this.link.socket.destroy(); }, 3000); this.watchdog.unref(); welcomed = true; this.retryCount = 0; finish(); this.notify(); this.emit('reload', this.bootstrap()); return;
          }
          if (!welcomed) return;
          this.receive(message, link);
        } catch (error) { if (!welcomed) finish(error); else { this.error = error.message; this.notify(); } }
      }, () => {
        clearTimeout(timer);
        if (!welcomed) finish(new Error('Connexion refusée ou code incorrect.'));
        else if (!this.closed && this.link === link && this.role === 'client') { this.phase = 'reconnecting'; this.error = 'Connexion interrompue, nouvelle tentative…'; this.notify(); this.retry(); }
      });
      socket.on('connect', () => link.send({ type: 'hello', protocol: 1, version: this.version, name: this.name, id: this.id }));
      socket.on('error', error => { if (!welcomed) finish(error); });
    });
  }
  receive(message, link) {
    this.lastReceived = Date.now();
    if(message.type==='match'){this.remoteMatch=message.match;this.notify();return;}
    if(message.type==='sabotage-result'){const request=this.actionRequests.get(message.id);if(request){clearTimeout(request.timer);this.actionRequests.delete(message.id);request.resolve(message.result);}return;}
    if (message.type === 'ping') { link.send({ type: 'pong' }); return; }
    if (message.type === 'roster') { if (Array.isArray(message.players) && message.players.length <= 5) { this.players = message.players; this.notify(); } return; }
    if (message.type === 'snapshot' && message.revision === this.revision) { this.runtime = runtime(message.runtime); this.emit('snapshot', { runtime: this.runtime, revision: this.revision }); return; }
    if (message.type === 'prepare') {
      try { const files = this.checkFiles(message.files); if (digest(files) !== message.digest || message.revision !== this.revision + 1) throw new Error('Version inattendue.'); this.prepared = { files, revision: message.revision }; this.phase = 'preparing'; this.notify(); link.send({ type: 'prepared', revision: message.revision, ok: true }); }
      catch { link.send({ type: 'prepared', revision: message.revision, ok: false }); }
      return;
    }
    if (message.type === 'abort') { this.prepared = null; this.phase = 'running'; this.error = message.error; this.notify(); return; }
    if (message.type === 'commit' && this.prepared?.revision === message.revision) {
      this.files = this.prepared.files; this.prepared = null; this.revision = message.revision; this.runtime = runtime(message.runtime); this.phase = 'loading'; this.notify(); this.emit('reload', this.bootstrap()); return;
    }
    if (message.type === 'resume' && message.revision === this.revision) { this.runtime = runtime(message.runtime); this.phase = 'running'; this.error = null; this.notify(); this.emit('snapshot', { runtime: this.runtime, revision: this.revision, force: true }); return; }
    if (message.type === 'rollback') {
      this.files = this.checkFiles(message.files); this.revision = message.revision; this.runtime = runtime(message.runtime); this.prepared = null; this.phase = 'loading'; this.error = 'La modification n’a pas démarré : retour à la version précédente.'; this.notify(); this.emit('reload', this.bootstrap()); return;
    }
    if (message.type === 'ended') { this.leave().then(() => this.emit('reload', this.bootstrap())); }
  }
  retry() {
    clearTimeout(this.retryTimer);
    if ((this.retryCount = (this.retryCount || 0) + 1) > 10) { this.error = 'L’hôte est indisponible. Quittez la partie ou relancez une connexion.'; this.notify(); return; }
    this.retryTimer = setTimeout(() => { if (!this.closed && this.role === 'client') this.connect().catch(() => this.retry()); }, 1500); this.retryTimer.unref();
  }
  publish(value, revision) {
    if (this.role === 'client' || this.role === 'host' && (this.phase !== 'running' || revision !== this.revision)) return;
    value=runtime(value);
    if(this.match){
      if(this.match.stage!=='waiting'&&value.effectsRevision!==this.match.effectsRevision){this.emit('snapshot',{runtime:clone(this.runtime),revision:this.revision,force:true});return;}
      if(this.match.public(this.connectedIds()).blocked){value=clone(this.runtime);value.paused=true;}
      const before=JSON.stringify(this.match.public(this.connectedIds())),effects=this.match.effectsRevision;
      try{this.match.update(value,this.runtime);}catch{this.emit('snapshot',{runtime:clone(this.runtime),revision:this.revision,force:true});return;}
      this.runtime=value;
      if(before!==JSON.stringify(this.match.public(this.connectedIds())))this.broadcastMatch();
      if(effects!==this.match.effectsRevision)this.emit('snapshot',{runtime:clone(this.runtime),revision:this.revision,force:true});
    }else this.runtime=value;
    if (this.role === 'host') this.broadcast({ type: 'snapshot', revision: this.revision, runtime: this.runtime });
  }
  command(command) {
    if (this.phase !== 'running') return false;
    if (this.role === 'client') return this.link?.send({ type: 'command', revision: this.revision, command }) || false;
    return false;
  }
  ready(revision) {
    if (revision !== this.revision) return;
    if (this.role === 'client') { this.link?.send({ type: 'ready', revision }); }
    else if (this.role === 'host') { this.localReady = revision; this.checkReady(); }
  }
  prepareFiles(files) {
    if (this.role !== 'host' || this.phase !== 'running' || !this.runtime) return Promise.reject(new Error('La partie doit être prête et hébergée sur ce PC.'));
    files = this.checkFiles(files); this.error = null; this.phase = 'preparing'; this.notify();
    return new Promise((resolve, reject) => {
      this.pending = { files, oldFiles: this.files, runtime: clone(this.runtime), revision: this.revision + 1, waiting: new Set(this.peers.keys()), resolve, reject };
      this.pending.timer = setTimeout(() => this.abortPreparation('Un joueur ne répond pas. La modification n’a pas été appliquée.'), this.barrierTimeout); this.pending.timer.unref();
      this.broadcast({ type: 'prepare', files, digest: digest(files), revision: this.pending.revision }); this.checkPrepared();
    });
  }
  checkPrepared() { if (this.pending && !this.pending.waiting.size && this.phase === 'preparing') { clearTimeout(this.pending.timer); this.phase = 'prepared'; this.notify(); this.pending.resolve(); } }
  abortPreparation(error) {
    if (!this.pending || !['preparing', 'prepared'].includes(this.phase)) return;
    clearTimeout(this.pending.timer); const reject = this.pending.reject; this.pending = null; this.phase = 'running'; this.error = error; this.broadcast({ type: 'abort', error }); this.notify(); reject(new Error(error));
  }
  commitPrepared() {
    if (!this.pending || this.phase !== 'prepared') throw new Error('Modification non préparée.');
    const p = this.pending; this.files = p.files; this.revision = p.revision; this.runtime = p.runtime; this.phase = 'loading'; this.localReady = 0;
    for (const peer of this.peers.values()) peer.ready = 0;
    this.broadcast({ type: 'commit', revision: this.revision, runtime: this.runtime }); this.notify(); this.emit('reload', this.bootstrap());
    p.timer = setTimeout(() => this.rollback(), this.barrierTimeout); p.timer.unref(); this.checkReady();
  }
  checkReady() {
    if (this.role !== 'host' || this.phase !== 'loading' || this.localReady !== this.revision || [...this.peers.values()].some(p => p.ready !== this.revision)) return;
    if (this.pending) clearTimeout(this.pending.timer); this.pending = null; this.phase = 'running'; this.broadcast({ type: 'resume', revision: this.revision, runtime: this.runtime }); this.notify(); this.emit('snapshot', { runtime: this.runtime, revision: this.revision, force: true });
  }
  rollback() {
    if (!this.pending || this.phase !== 'loading') return;
    const p = this.pending; clearTimeout(p.timer); this.files = p.oldFiles; this.revision++; this.runtime = p.runtime; this.localReady = 0; this.pending = null;
    this.emit('rollback'); this.error = 'Modification annulée : un écran n’a pas redémarré correctement.';
    for (const peer of this.peers.values()) peer.ready = 0;
    this.broadcast({ type: 'rollback', files: this.files, revision: this.revision, runtime: this.runtime }); this.notify(); this.emit('reload', this.bootstrap());
  }
  async leave() {
    for(const r of this.actionRequests.values()){clearTimeout(r.timer);r.resolve({ok:false,error:'La partie est fermée.'});}this.actionRequests.clear();
    this.closed = true; clearInterval(this.heartbeat); clearInterval(this.watchdog); clearTimeout(this.retryTimer);
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('La partie est fermée.')); this.pending = null; }
    if (this.role === 'host') { this.broadcast({ type: 'ended' }); for (const socket of this.connections) socket.end(); }
    if (this.link) this.link.socket.destroy();
    const server = this.server; this.server = null;
    this.role = 'offline'; this.phase = 'idle'; this.files = null; this.players = []; this.link = null; this.error = null; this.peers.clear(); this.match=null;this.remoteMatch=null;this.notify();
    if (server) await new Promise(resolve => { server.close(resolve); for (const socket of this.connections) { const t = setTimeout(() => socket.destroy(), 300); t.unref(); } });
  }
}
module.exports = { Room, parseInvitation, digest, bundle };
