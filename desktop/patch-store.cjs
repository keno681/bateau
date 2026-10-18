'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const FILES = Object.freeze(['index.html', 'style.css', 'game.js']);
const FORMAT = 'derniere-vague-patch-v1';
const MAX_FILE = 1_000_000, MAX_SCRIPT = 2_000_000, MAX_DRAFT = 500_000;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function fail(message) { throw new Error(message); }
function exactKeys(object, keys) {
  if (Object.keys(object).some(key => !keys.includes(key))) fail('Le script contient un champ inconnu.');
}
function parsePatch(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > MAX_SCRIPT) fail('Le script est trop volumineux (2 Mo maximum).');
  let text = source.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*)\n```$/i.exec(text);
  if (fenced) text = fenced[1];
  let patch;
  try { patch = JSON.parse(text); } catch { fail('Le script doit être un document JSON valide. Copiez tout le script fourni, accolades comprises.'); }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) fail('Le script doit être un objet JSON.');
  exactKeys(patch, ['format', 'title', 'changes']);
  if (patch.format !== FORMAT) fail(`Le champ format doit être « ${FORMAT} ».`);
  if (patch.title !== undefined && (typeof patch.title !== 'string' || patch.title.length > 120)) fail('Le titre doit contenir au maximum 120 caractères.');
  if (!Array.isArray(patch.changes) || !patch.changes.length || patch.changes.length > 80) fail('Le script doit contenir entre 1 et 80 modifications.');
  const changes = patch.changes.map((op, i) => {
    if (!op || typeof op !== 'object' || Array.isArray(op) || !FILES.includes(op.file)) fail(`Modification ${i + 1} : seuls index.html, style.css et game.js peuvent être modifiés.`);
    if (own(op, 'content')) {
      exactKeys(op, ['file', 'content']);
      if (typeof op.content !== 'string') fail(`Modification ${i + 1} : content doit être du texte.`);
      return { file: op.file, content: op.content };
    }
    if (own(op, 'append')) {
      exactKeys(op, ['file', 'append']);
      if (typeof op.append !== 'string' || !op.append) fail(`Modification ${i + 1} : append doit contenir du texte.`);
      return { file: op.file, append: op.append };
    }
    exactKeys(op, ['file', 'find', 'replace']);
    if (typeof op.find !== 'string' || !op.find || typeof op.replace !== 'string') fail(`Modification ${i + 1} : find et replace doivent contenir le texte à remplacer et son remplacement.`);
    return { file: op.file, find: op.find, replace: op.replace };
  });
  return { format: FORMAT, title: patch.title || 'Modification du jeu', changes };
}
class PatchStore {
  constructor(baseDir, dataDir) {
    this.baseDir = baseDir; this.dataDir = dataDir; this.warning = null;
    fs.mkdirSync(path.join(dataDir, 'versions'), { recursive: true });
    this.originals = Object.fromEntries(FILES.map(file => [file, fs.readFileSync(path.join(baseDir, file), 'utf8')]));
    this.state = { active: null, previous: null };
    try {
      const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8'));
      if (!saved || ![saved.active, saved.previous].every(id => id === null || typeof id === 'string' && UUID.test(id))) fail('État invalide');
      if (saved.active) this.readVersion(saved.active);
      this.state = { active: saved.active, previous: saved.previous };
    } catch (error) {
      if (error.code !== 'ENOENT' || fs.existsSync(path.join(dataDir, 'state.json'))) this.warning = 'Les modifications enregistrées sont illisibles. Le jeu d’origine a été chargé.';
    }
  }
  readVersion(id) {
    if (!UUID.test(id)) fail('Version de modification invalide.');
    const dir = path.join(this.dataDir, 'versions', id);
    const files = Object.fromEntries(FILES.map(file => [file, fs.readFileSync(path.join(dir, file), 'utf8')]));
    this.validateFiles(files);
    const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
    if (typeof metadata.title !== 'string' || !Array.isArray(metadata.hashes) || !metadata.hashes.every(hash => /^[a-f0-9]{64}$/.test(hash))) fail('Métadonnées invalides.');
    return { files, metadata };
  }
  validateFiles(files) {
    for (const file of FILES) if (typeof files[file] !== 'string' || Buffer.byteLength(files[file]) > MAX_FILE) fail(`${file} dépasse la taille maximale de 1 Mo.`);
    if (!/<html(?:\s|>)/i.test(files['index.html']) || !/<\/html\s*>/i.test(files['index.html'])) fail('index.html doit rester une page HTML complète.');
    try { new vm.Script(files['game.js'], { filename: 'game.js' }); }
    catch (error) { fail(`Le JavaScript modifié contient une erreur de syntaxe : ${error.message}`); }
  }
  current() { return this.state.active ? this.readVersion(this.state.active) : { files: { ...this.originals }, metadata: { title: 'Version d’origine', hashes: [] } }; }
  readGameFile(file) {
    if (!FILES.includes(file)) fail('Fichier du jeu inconnu.');
    return this.state.active ? fs.readFileSync(path.join(this.dataDir, 'versions', this.state.active, file), 'utf8') : this.originals[file];
  }
  writeState(next) {
    const target = path.join(this.dataDir, 'state.json');
    const temporary = target + '.' + crypto.randomUUID() + '.tmp';
    try { fs.writeFileSync(temporary, JSON.stringify(next), { encoding: 'utf8', flag: 'wx' }); fs.renameSync(temporary, target); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    this.state = next; this.warning = null;
  }
  getDraft() { try { return fs.readFileSync(path.join(this.dataDir, 'draft.txt'), 'utf8').slice(0, MAX_DRAFT); } catch (error) { if (error.code === 'ENOENT') return ''; throw error; } }
  hasDraft() { return fs.existsSync(path.join(this.dataDir, 'draft.txt')); }
  saveDraft(text) {
    if (typeof text !== 'string' || text.length > MAX_DRAFT) fail('Le brouillon est trop long (500 000 caractères maximum).');
    const file = path.join(this.dataDir, 'draft.txt');
    const temporary = file + '.' + crypto.randomUUID() + '.tmp';
    try { fs.writeFileSync(temporary, text, { encoding: 'utf8', flag: 'wx' }); fs.renameSync(temporary, file); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  status() {
    const current = this.current();
    return { modified: !!this.state.active, previous: !!(this.state.active || this.state.previous), title: current.metadata.title, warning: this.warning, draft: this.getDraft() };
  }
  apply(source) {
    const patch = parsePatch(source), current = this.current();
    const hash = crypto.createHash('sha256').update(JSON.stringify(patch)).digest('hex');
    if (current.metadata.hashes.includes(hash)) fail('Ce script est déjà appliqué. Vous pouvez en coller un nouveau ou revenir à la version d’origine.');
    const files = { ...current.files };
    patch.changes.forEach((op, i) => {
      if (own(op, 'content')) files[op.file] = op.content;
      else if (own(op, 'append')) files[op.file] += op.append;
      else {
        const first = files[op.file].indexOf(op.find);
        if (first < 0) fail(`Modification ${i + 1} : le texte à remplacer est introuvable dans ${op.file}. Aucune modification n’a été enregistrée.`);
        if (files[op.file].indexOf(op.find, first + 1) >= 0) fail(`Modification ${i + 1} : plusieurs passages correspondent dans ${op.file}. Le script doit préciser un passage unique.`);
        files[op.file] = files[op.file].slice(0, first) + op.replace + files[op.file].slice(first + op.find.length);
      }
    });
    this.validateFiles(files);
    const id = crypto.randomUUID(), directory = path.join(this.dataDir, 'versions', id);
    fs.mkdirSync(directory);
    let committed = false;
    try {
      for (const file of FILES) fs.writeFileSync(path.join(directory, file), files[file], { encoding: 'utf8', flag: 'wx' });
      const metadata = { title: patch.title, created: new Date().toISOString(), hashes: [...current.metadata.hashes, hash] };
      fs.writeFileSync(path.join(directory, 'metadata.json'), JSON.stringify(metadata), { encoding: 'utf8', flag: 'wx' });
      this.writeState({ active: id, previous: this.state.active }); committed = true;
    } finally { if (!committed) fs.rmSync(directory, { recursive: true, force: true }); }
    return { title: patch.title, files: [...new Set(patch.changes.map(op => op.file))] };
  }
  restoreOriginal() { this.writeState({ active: null, previous: this.state.active }); }
  undo() {
    if (!this.state.active && !this.state.previous) fail('Aucune version précédente n’est disponible.');
    if (this.state.previous) this.readVersion(this.state.previous);
    this.writeState({ active: this.state.previous, previous: this.state.active });
  }
}
module.exports = { PatchStore, parsePatch, FILES, FORMAT };
