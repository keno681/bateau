'use strict';
const fs=require('node:fs'),path=require('node:path');require('./embed-boat3d.cjs');const root=path.resolve(__dirname,'..');
const patch={format:'derniere-vague-patch-v1',title:'Salon, saboteur secret et rêves prémonitoires — moteur 1.5.0 obligatoire',changes:['index.html','style.css','game.js'].map(file=>({file,content:fs.readFileSync(path.join(root,file),'utf8')}))};
fs.writeFileSync(path.join(root,'patches/SALON-SABOTEUR-POKEBALL.txt'),JSON.stringify(patch,null,2)+'\n');
