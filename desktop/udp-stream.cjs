'use strict';
// Reliable, ordered byte streams over authenticated IPv4 UDP datagrams.
// Wire encryption remains in room.cjs. Datagrams stay below the usual LAN MTU.
const dgram = require('node:dgram');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const SIZE = 1000, WINDOW = 32, LIMIT = 8 * 1024 * 1024;
const keyFor = secret => crypto.createHash('sha256').update('vague-udp-v1:' + secret).digest();
function encode(key, session, type, seq, payload = Buffer.alloc(0)) {
  const h = Buffer.alloc(17); h.write('DVU1'); session.copy(h, 4); h[12] = type; h.writeUInt32BE(seq, 13);
  const body = Buffer.concat([h, payload]);
  return Buffer.concat([body, crypto.createHmac('sha256', key).update(body).digest().subarray(0, 16)]);
}
function decode(key, bytes) {
  if (bytes.length < 33 || bytes.length > SIZE + 33 || bytes.toString('ascii', 0, 4) !== 'DVU1') return null;
  const body = bytes.subarray(0, -16), tag = crypto.createHmac('sha256', key).update(body).digest().subarray(0, 16);
  if (!crypto.timingSafeEqual(tag, bytes.subarray(-16))) return null;
  return { session: bytes.subarray(4, 12), type: bytes[12], seq: bytes.readUInt32BE(13), payload: bytes.subarray(17, -16) };
}
class Stream extends EventEmitter {
  constructor(udp, key, session, address, port, owned = false) {
    super(); Object.assign(this, { udp, key, session, address, port, owned });
    this.destroyed = false; this.writableLength = 0; this.next = 1; this.expected = 1;
    this.pending = new Map(); this.received = new Map(); this.queue = []; this.lastSeen = Date.now();
    this.timer = setInterval(() => this.pump(), 40); this.timer.unref();
  }
  setNoDelay() {} setKeepAlive() {}
  send(type, seq, data) {
    if (this.destroyed) return;
    this.udp.send(encode(this.key, this.session, type, seq, data), this.port, this.address, error => {
      if (error && !this.destroyed) { this.emit('error', error); this.destroy(); }
    });
  }
  write(bytes) {
    if (this.destroyed || this.ending) return false;
    if (this.writableLength + bytes.length > LIMIT) { this.destroy(); return false; }
    for (let i = 0; i < bytes.length; i += SIZE) {
      const data = Buffer.from(bytes.subarray(i, i + SIZE)); this.queue.push(data); this.writableLength += data.length;
    }
    this.pump(); return true;
  }
  pump() {
    if (this.destroyed) return;
    const now = Date.now();
    if (now - this.lastSeen > 15000) { this.destroy(); return; }
    while (this.pending.size < WINDOW && this.queue.length) {
      const seq = this.next++, data = this.queue.shift(); this.pending.set(seq, { data, sent: now }); this.send(1, seq, data);
    }
    for (const [seq, item] of this.pending) if (now - item.sent >= 160) { item.sent = now; this.send(1, seq, item.data); }
    if (this.ending && !this.pending.size && !this.queue.length) this.destroy();
  }
  receive(packet) {
    if (this.destroyed) return;
    this.lastSeen = Date.now();
    if (packet.type === 2) {
      const item = this.pending.get(packet.seq);
      if (item) { this.writableLength -= item.data.length; this.pending.delete(packet.seq); this.pump(); }
    } else if (packet.type === 1) {
      if (!packet.seq || packet.seq >= this.expected + WINDOW * 2) return;
      this.send(2, packet.seq);
      if (packet.seq < this.expected) return;
      if (!this.received.has(packet.seq)) this.received.set(packet.seq, Buffer.from(packet.payload));
      while (this.received.has(this.expected) && !this.destroyed) {
        const bytes = this.received.get(this.expected); this.received.delete(this.expected++); this.emit('data', bytes);
      }
    } else if (packet.type === 3) this.destroy(false);
  }
  end() { this.ending = true; this.pump(); }
  destroy(notify = true) {
    if (this.destroyed) return;
    if (notify) for (let i = 0; i < 3; i++) this.send(3, 0);
    this.destroyed = true; clearInterval(this.timer); this.pending.clear(); this.received.clear(); this.queue = []; this.writableLength = 0;
    // Let queued FIN datagrams reach the OS before closing the owned socket.
    if (this.owned) setTimeout(() => this.udp.close(), 50);
    this.emit('close');
  }
}
function createServer(secret, onConnection) {
  const udp = dgram.createSocket('udp4'), server = new EventEmitter(), key = keyFor(secret), streams = new Map();
  let closing = false;
  udp.on('listening', () => server.emit('listening'));
  udp.on('error', error => server.emit('error', error));
  udp.on('message', (bytes, remote) => {
    if (closing) return;
    const packet = decode(key, bytes); if (!packet) return;
    const id = remote.address + ':' + remote.port + ':' + packet.session.toString('hex');
    let stream = streams.get(id);
    if (!stream) {
      // Allocate only for authenticated first data; reject stale sessions that
      // arrive after close instead of treating a delayed ACK as a new player.
      if (packet.type !== 1 || packet.seq !== 1 || streams.size >= 12) return;
      stream = new Stream(udp, key, packet.session, remote.address, remote.port);
      streams.set(id, stream); stream.once('close', () => streams.delete(id)); onConnection(stream);
    }
    stream.receive(packet);
  });
  server.listen = (port, address, ready) => { udp.bind({ port, address, exclusive: true }, ready); return server; };
  server.address = () => udp.address();
  server.close = done => {
    closing = true;
    for (const stream of [...streams.values()]) stream.destroy();
    setTimeout(() => udp.close(done), 50);
  };
  return server;
}
function createConnection({ host, port, secret }) {
  const udp = dgram.createSocket('udp4'), stream = new Stream(udp, keyFor(secret), crypto.randomBytes(8), host, port, true);
  udp.on('error', error => { if (!stream.destroyed) { stream.emit('error', error); stream.destroy(); } });
  udp.on('message', (bytes, remote) => {
    if (remote.address !== host || remote.port !== port) return;
    const packet = decode(stream.key, bytes);
    if (packet && packet.session.equals(stream.session)) stream.receive(packet);
  });
  udp.bind(0, '0.0.0.0', () => { if (!stream.destroyed) stream.emit('connect'); });
  return stream;
}
module.exports = { createServer, createConnection };
