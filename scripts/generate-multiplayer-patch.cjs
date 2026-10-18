'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const patch = {
  format: 'derniere-vague-patch-v1',
  title: 'Multijoueur 5 personnes — moteur Windows 1.4.0 nécessaire',
  changes: ['index.html', 'style.css', 'game.js'].map(file => ({ file, content: fs.readFileSync(path.join(root, file), 'utf8') }))
};
fs.writeFileSync(path.join(root, 'patches', 'MULTIJOUEUR-5-JOUEURS-POKEBALL.txt'), JSON.stringify(patch, null, 2) + '\n');
console.log('Fichier texte Pokéball généré depuis les trois fichiers du jeu.');
