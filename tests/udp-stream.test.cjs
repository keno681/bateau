'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const crypto = require('node:crypto');
const { once } = require('node:events');
const udp = require('../desktop/udp-stream.cjs');

test('UDP fiable : pertes, doublons, désordre et faux paquets pendant un transfert volumineux', { timeout: 20000 }, async t => {
  const secret = crypto.randomBytes(24).toString('base64url');
  const sent = crypto.randomBytes(240000), reply = crypto.randomBytes(190000);
  let accepts = 0, client, remote, counter = 0, largest = 0;
  const server = udp.createServer(secret, stream => {
    accepts++; stream.on('error', () => {});
    let received = Buffer.alloc(0);
    stream.on('data', bytes => {
      received = Buffer.concat([received, bytes]);
      if (received.length === sent.length) { assert.deepEqual(received, sent); stream.write(reply); }
    });
  });
  server.on('error', error => assert.fail(error.message));
  server.listen(0, '127.0.0.1'); await once(server, 'listening').catch(() => {});
  const proxy = dgram.createSocket('udp4'); proxy.bind(0, '127.0.0.1'); await once(proxy, 'listening');
  t.after(async () => { client?.destroy(); proxy.close(); await new Promise(resolve => server.close(resolve)); });
  proxy.on('message', (bytes, from) => {
    largest = Math.max(largest, bytes.length);
    const fromHost = from.port === server.address().port;
    if (!fromHost) remote = from;
    const target = fromHost ? remote : server.address();
    if (!target || ++counter % 11 === 0) return; // Real datagrams deliberately lost.
    const send = () => { try { proxy.send(bytes, target.port, '127.0.0.1', () => {}); } catch {} };
    if (counter % 3 === 0) setTimeout(send, 12); else send();
    if (counter % 7 === 0) send();
  });
  // Unauthenticated traffic must not create virtual connections.
  proxy.send(crypto.randomBytes(100), server.address().port, '127.0.0.1');
  client = udp.createConnection({ host: '127.0.0.1', port: proxy.address().port, secret });
  client.on('error', error => assert.fail(error.message));
  const result = new Promise(resolve => {
    let received = Buffer.alloc(0);
    client.on('data', bytes => { received = Buffer.concat([received, bytes]); if (received.length === reply.length) resolve(received); });
  });
  await once(client, 'connect'); client.write(sent);
  assert.deepEqual(await result, reply); assert.equal(accepts, 1); assert.ok(largest <= 1033);
});
