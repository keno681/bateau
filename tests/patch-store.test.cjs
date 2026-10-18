'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PatchStore, FORMAT } = require('../desktop/patch-store.cjs');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vague-patches-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const base = path.join(dir, 'base'), data = path.join(dir, 'data'); fs.mkdirSync(base);
  for (const f of ['index.html', 'game.js', 'style.css']) fs.copyFileSync(path.join(__dirname, '..', f), path.join(base, f));
  return { base, data, store: new PatchStore(base, data) };
}
const patch = changes => JSON.stringify({ format: FORMAT, title: 'Test du bateau', changes });
test('modifications de vrais fichiers, persistance, version précédente et restauration', t => {
  const { base, data, store } = fixture(t);
  const originals = { ...store.current().files };
  const source = patch([{ file: 'index.html', find: 'Gardez le cap.', replace: 'Tous à bord !' }, { file: 'style.css', append: '\nh1 { color: gold; }\n' }]);
  store.apply(source);
  const state = JSON.parse(fs.readFileSync(path.join(data, 'state.json')));
  assert.match(fs.readFileSync(path.join(data, 'versions', state.active, 'index.html'), 'utf8'), /Tous à bord !/);
  assert.equal(fs.readFileSync(path.join(base, 'index.html'), 'utf8'), originals['index.html']);
  const reopened = new PatchStore(base, data);
  assert.match(reopened.readGameFile('index.html'), /Tous à bord !/);
  assert.throws(() => reopened.apply(source), /déjà appliqué/);
  reopened.apply(patch([{ file: 'game.js', append: '\nwindow.patchApplied = true;\n' }]));
  reopened.undo(); assert.equal(reopened.readGameFile('game.js'), originals['game.js']);
  assert.match(reopened.readGameFile('index.html'), /Tous à bord !/);
  reopened.restoreOriginal(); assert.deepEqual(reopened.current().files, originals);
  const reset = new PatchStore(base, data); assert.equal(reset.status().modified, false);
  reset.undo(); assert.match(reset.readGameFile('index.html'), /Tous à bord !/);
});
test('script entier rejeté si une opération est impossible, sans application partielle', t => {
  const { store, data } = fixture(t); const original = store.readGameFile('style.css');
  assert.throws(() => store.apply(patch([{ file: 'style.css', append: '\nbody {color:red}' }, { file: 'game.js', find: 'passage inexistant 123', replace: '' }])), /introuvable/);
  assert.equal(store.readGameFile('style.css'), original); assert.equal(fs.existsSync(path.join(data, 'state.json')), false);
});
test('erreur JavaScript, remplacement ambigu et chemins hors du jeu refusés', t => {
  const { store } = fixture(t);
  assert.throws(() => store.apply(patch([{ file: 'game.js', append: '\nconst = ;' }])), /syntaxe/);
  assert.throws(() => store.apply(patch([{ file: 'index.html', find: '<div', replace: '<section' }])), /plusieurs passages/);
  for (const file of ['../main.cjs', 'desktop/main.cjs', '/tmp/test', 'state.json', '__proto__']) assert.throws(() => store.apply(patch([{ file, content: 'x' }])), /seuls/);
  assert.equal(store.status().modified, false);
});
test('format, types et taille contrôlés, blocs JSON Markdown acceptés', t => {
  const { store } = fixture(t);
  for (const invalid of ['{}', '[]', 'null', 'bonjour', patch([{ file: 'style.css', append: false }]), patch([{ file: 'style.css', content: 'x', append: 'y' }])]) assert.throws(() => store.apply(invalid));
  assert.throws(() => store.apply(patch([{ file: 'style.css', content: 'x'.repeat(1_000_001) }])), /taille/);
  store.apply('```json\n' + patch([{ file: 'style.css', append: '\n/* ok */' }]) + '\n```');
  assert.equal(store.status().modified, true);
});
test('échec disque : la version active précédente reste intacte', t => {
  const { store, data } = fixture(t);
  store.apply(patch([{ file: 'style.css', append: '\n/* premier */' }]));
  const before = JSON.stringify(store.state), file = store.readGameFile('style.css');
  const rename = fs.renameSync;
  try {
    fs.renameSync = (a, b) => { if (b === path.join(data, 'state.json')) throw new Error('Disque indisponible'); return rename(a, b); };
    assert.throws(() => store.apply(patch([{ file: 'style.css', append: '\n/* second */' }])), /Disque indisponible/);
  } finally { fs.renameSync = rename; }
  assert.equal(JSON.stringify(store.state), before); assert.equal(store.readGameFile('style.css'), file);
  assert.equal(fs.readdirSync(path.join(data, 'versions')).length, 1);
});
test('une version corrompue revient au jeu d’origine sans supprimer les fichiers', t => {
  const { store, base, data } = fixture(t);
  store.apply(patch([{ file: 'style.css', append: '\n/* test */' }]));
  fs.writeFileSync(path.join(data, 'versions', store.state.active, 'game.js'), 'const =');
  const restarted = new PatchStore(base, data);
  assert.equal(restarted.status().modified, false); assert.match(restarted.status().warning, /illisibles/);
  restarted.restoreOriginal(); assert.equal(restarted.status().warning, null);
});
test('brouillon indépendant de la restauration et sauvegarde atomique', t => {
  const { store, base, data } = fixture(t);
  store.saveDraft('mon script'); store.restoreOriginal();
  assert.equal(new PatchStore(base, data).getDraft(), 'mon script');
  assert.throws(() => store.saveDraft('x'.repeat(500_001)), /trop long/);
  assert.equal(store.getDraft(), 'mon script');
});
