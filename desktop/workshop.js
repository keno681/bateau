'use strict';
(() => {
  const api = window.vagueWorkshop, $ = id => document.getElementById(id), editor = $('script');
  let busy = false, timer, modified = false, previous = false, warning = false, readOnly = false;
  const sample = JSON.stringify({ format: 'derniere-vague-patch-v1', title: 'Un cap couleur cuivre', changes: [{ file: 'style.css', append: '\n/* Ajout depuis la Pokéball */\nh1 { color: #f1ae65; }\n' }] }, null, 2);
  function message(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : 'success'; }
  function setBusy(value) {
    busy = value; editor.disabled = value;
    for (const id of ['apply', 'example', 'close']) $(id).disabled = value || readOnly && id !== 'close';
    $('restore').disabled = value || readOnly || !(modified || warning); $('undo').disabled = value || readOnly || !previous;
  }
  function lines() {
    const count = editor.value.split('\n').length;
    $('lines').textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    $('line-count').textContent = count + (count === 1 ? ' ligne' : ' lignes'); $('lines').scrollTop = editor.scrollTop;
  }
  async function saveDraft() {
    clearTimeout(timer);
    try {
      const result = await api.saveDraft(editor.value);
      $('draft-status').textContent = result.ok ? 'Brouillon enregistré sur ce PC' : 'Brouillon non enregistré';
      if (!result.ok) message(result.error, true);
      return result.ok;
    } catch { $('draft-status').textContent = 'Brouillon non enregistré'; message('Le brouillon n’a pas pu être enregistré. Gardez une copie du script.', true); return false; }
  }
  async function act(action) {
    if (busy) return;
    setBusy(true); clearTimeout(timer);
    try {
      if (!await saveDraft()) { setBusy(false); return; }
      const result = await action();
      if (!result.ok) { message(result.error, true); setBusy(false); return; }
      message('Modifications enregistrées. Redémarrage du jeu…');
    } catch (error) { message(error.message || 'La modification n’a pas pu être appliquée.', true); setBusy(false); }
  }
  editor.addEventListener('input', () => { lines(); $('draft-status').textContent = 'Enregistrement…'; clearTimeout(timer); timer = setTimeout(saveDraft, 400); });
  editor.addEventListener('scroll', () => { $('lines').scrollTop = editor.scrollTop; });
  editor.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); const a = editor.selectionStart, b = editor.selectionEnd; if (editor.value.length - (b - a) + 2 > editor.maxLength) return; editor.setRangeText('  ', a, b, 'end'); editor.dispatchEvent(new Event('input')); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveDraft(); }
  });
  $('example').onclick = () => { if (editor.value.trim()) { message('Gardez une copie du texte actuel, puis videz le champ pour charger l’exemple.', true); return; } editor.value = sample; editor.dispatchEvent(new Event('input')); editor.focus(); };
  $('apply').onclick = () => act(() => api.apply(editor.value));
  $('restore').onclick = () => act(() => api.restore());
  $('undo').onclick = () => act(() => api.undo());
  $('close').onclick = async () => { if (!busy && await saveDraft()) api.close(); };
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !busy) { event.preventDefault(); $('close').click(); } });
  api.status().then(result => {
    if (!result.ok) throw new Error(result.error);
    readOnly = result.network?.role === 'client';
    editor.value = result.draft; modified = result.modified; previous = result.previous; warning = !!result.warning;
    $('current').textContent = 'Version ' + result.appVersion + ' · ' + result.title;
    lines(); setBusy(false); if (readOnly) message('Les modifications Pokéball sont appliquées par l’hôte à tous les joueurs.'); else if (result.warning) message(result.warning, true); editor.focus();
  }).catch(error => { message(error.message, true); setBusy(true); $('close').disabled = false; $('close').onclick = () => api.close(); });
})();
