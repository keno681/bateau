'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Room, parseInvitation } = require('../desktop/room.cjs');
const files = { 'index.html': '<html><body>bateau</body></html>', 'game.js': 'window.ready=true;', 'style.css': 'body{color:white}' };
const initial = { paused: false, spawnTimer: 1.25, state: { day: 3, hull: 72, inventory: { parts: 4 }, crew: [{ work: { elapsed: 1 } }] } };
const wait = async (check, timeout = 6000) => { const end = Date.now() + timeout; while (!check()) { if (Date.now() > end) throw new Error('État réseau attendu non reçu'); await new Promise(r => setTimeout(r, 10)); } };
function invite(host) { const i = parseInvitation(host.invitation); i.addresses = ['127.0.0.1']; return 'VAGUE1-' + Buffer.from(JSON.stringify(i)).toString('base64url'); }
async function fixture(t, count = 4, options = {}) {
  const rooms = [], create = config => { const r = new Room({ barrierTimeout: 1500, ...config }); rooms.push(r); r.on('reload', () => setTimeout(() => r.ready(r.revision), 5)); return r; };
  t.after(async () => { for (const r of rooms.slice().reverse()) await r.leave(); });
  const host = create(); host.publish(initial, 0); await host.host({ name: 'Capitaine', port: 0, files });
  const clients = [];
  for (let i = 0; i < count; i++) { const r = create(options); await r.join({ name: 'Marin '+i, invitation: invite(host) }); clients.push(r); }
  await wait(() => clients.every(r => r.phase === 'running'));
  return { host, clients, create };
}
test('cinq joueurs maximum, état partagé et commandes clients vers l’hôte', async t => {
  const { host, clients, create } = await fixture(t);
  assert.equal(host.players.length, 5); await wait(() => clients.every(r => r.players.length === 5));
  const sixth = create(); await assert.rejects(sixth.join({ name: 'En trop', invitation: invite(host) }), /complète/);
  assert.equal(host.players.length, 5);
  let command; host.once('command', value => { command = value; }); clients[1].command({ type: 'work', role: 2 }); await wait(() => !!command);
  assert.equal(command.player, clients[1].id); assert.equal(command.role, 2);
  host.publish({ ...initial, state: { ...initial.state, hull: 61 } }, host.revision);
  await wait(() => clients.every(r => r.runtime.state.hull === 61));
});
test('Pokéball synchronisée et redémarrage : mêmes joueurs et mêmes connexions', async t => {
  const { host, clients } = await fixture(t); const ids = host.players.map(p => p.id), accepted = host.accepted;
  await host.prepareFiles({ ...files, 'style.css': 'body{color:gold}' }); assert.equal(host.phase, 'prepared');
  host.commitPrepared(); await wait(() => host.phase === 'running' && clients.every(r => r.phase === 'running' && r.revision === 2));
  for (const r of [host, ...clients]) { assert.equal(r.files['style.css'], 'body{color:gold}'); assert.deepEqual(r.runtime, initial); }
  assert.equal(host.accepted, accepted); assert.deepEqual(host.players.map(p => p.id), ids);
});
test('un client refuse les fichiers : annulation commune avant redémarrage', async t => {
  const { host, clients } = await fixture(t, 2, { validateFiles: f => { if (f['style.css'].includes('refus')) throw new Error('refus'); } });
  await assert.rejects(host.prepareFiles({ ...files, 'style.css': 'refus' }), /joueur/);
  await wait(() => clients.every(r => r.phase === 'running'));
  assert.equal(host.revision, 1); for (const r of [host, ...clients]) assert.equal(r.files['style.css'], files['style.css']);
});
test('un écran ne redémarre pas : retour commun aux fichiers précédents, sockets conservées', async t => {
  const { host, clients } = await fixture(t, 2); const accepted = host.accepted;
  clients[0].removeAllListeners('reload'); clients[0].on('reload', () => { if (clients[0].revision !== 2) clients[0].ready(clients[0].revision); });
  await host.prepareFiles({ ...files, 'style.css': 'body{color:red}' }); host.commitPrepared();
  await wait(() => host.revision === 3 && host.phase === 'running' && clients.every(r => r.phase === 'running'));
  for (const r of [host, ...clients]) assert.equal(r.files['style.css'], files['style.css']); assert.equal(host.accepted, accepted);
});
test('coupure réelle : reconnexion automatique avec le même identifiant', async t => {
  const { host, clients } = await fixture(t, 1); const id = clients[0].id;
  clients[0].link.socket.destroy(); await wait(() => host.accepted === 2 && clients[0].phase === 'running');
  assert.equal(clients[0].id, id); assert.equal(host.players.length, 2);
});
test('invitation erronée et port occupé : erreurs lisibles', async t => {
  const { host, create } = await fixture(t, 0);
  const r = create(); await assert.rejects(r.join({ invitation: 'pas de code' }), /invitation/);
  r.publish(initial, 0); await assert.rejects(r.host({ port: host.port, files }), /déjà utilisé/);
  const i = parseInvitation(invite(host)); i.secret = 'x'.repeat(32);
  await assert.rejects(r.join({ invitation: 'VAGUE1-'+Buffer.from(JSON.stringify(i)).toString('base64url') }), /Hôte introuvable/);
});
