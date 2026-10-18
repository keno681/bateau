'use strict';
const fs=require('node:fs'),path=require('node:path');
require('./embed-boat3d.cjs');
const root=path.resolve(__dirname,'..');
const patch={format:'derniere-vague-patch-v1',title:'Bateau 3D — cinq nouvelles salles, caméra et déplacements — moteur 1.4.0',changes:['index.html','style.css','game.js'].map(file=>({file,content:fs.readFileSync(path.join(root,file),'utf8')}))};
fs.writeFileSync(path.join(root,'patches/BATEAU-3D-8-SALLES-POKEBALL.txt'),JSON.stringify(patch,null,2)+'\n');
console.log('Texte Pokéball 3D généré.');
