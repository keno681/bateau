'use strict';
(() => {
  const api = window.vagueNetwork, $ = id => document.getElementById(id);
  let busy = false;
  function message(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : 'success'; }
  function render(s) {
    const online = s.role !== 'offline' && s.phase !== 'connecting';
    $('setup').hidden = online; $('connected').hidden = !online;
    if (online) {
      $('room-title').textContent = (s.role === 'host' ? 'Votre partie' : 'Partie rejointe') + ' · ' + s.players.length + '/5';
      $('share').hidden = s.role !== 'host';
      if (s.invitation) $('code').value = s.invitation;
      if (s.addresses) $('address').textContent = 'Adresses locales : ' + s.addresses.filter(a => a !== '127.0.0.1').join(', ') + ' · Port ' + s.port;
      $('players').replaceChildren();
      for (const player of s.players) { const li = document.createElement('li'); li.textContent = player.name + (player.host ? ' · Hôte' : '') + (player.id === s.id ? ' · Vous' : ''); $('players').append(li); }
      $('phase').textContent = s.phase === 'running' ? 'Connecté · Les trois marins sont contrôlables par tous.' : s.phase === 'reconnecting' ? 'Reconnexion à l’hôte…' : 'Synchronisation du jeu…';
      message(s.error || 'Connecté à l’équipage.', !!s.error);
    } else if (s.error) message(s.error, s.phase !== 'connecting');
  }
  async function run(action) {
    if (busy) return; busy = true; $('host').disabled = $('join').disabled = true;
    message('Connexion en cours…');
    try { const result = await action(); if (!result.ok) message(result.error, true); else if(result.role)render(result);else message('Retour au bateau…'); }
    catch { message('La connexion n’a pas pu être établie. Vérifiez le réseau et le code de l’hôte.', true); }
    finally { busy = false; $('host').disabled = $('join').disabled = false; }
  }
  $('host-tab').onclick = () => { $('host-panel').hidden = false; $('join-panel').hidden = true; $('host-tab').classList.add('active'); $('join-tab').classList.remove('active'); };
  $('join-tab').onclick = () => { $('host-panel').hidden = true; $('join-panel').hidden = false; $('join-tab').classList.add('active'); $('host-tab').classList.remove('active'); };
  $('host').onclick = () => run(() => api.host({ name: $('name').value, port: Number($('port').value) }));
  $('join').onclick = () => run(() => api.join({ name: $('name').value, invitation: $('invitation').value.trim() }));
  $('copy').onclick = async () => { const r = await api.copyInvitation(); message(r.ok ? 'Code copié. Envoyez-le aux autres joueurs.' : r.error, !r.ok); };
  $('close').onclick = $('back').onclick = () => api.close();
  $('leave').onclick = () => run(() => api.leave());
  api.onStatus(() => api.status().then(render).catch(() => {}));
  api.status().then(render).catch(() => message('Impossible de charger le salon.', true));
})();
