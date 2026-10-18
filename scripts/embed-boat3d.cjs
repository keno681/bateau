'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'game.js');
let game=fs.readFileSync(file,'utf8');
const block='// boat3d:start\n'+fs.readFileSync(path.join(__dirname,'boat3d.js'),'utf8')+'\n// boat3d:end\n';
if(game.includes('// boat3d:start'))game=game.replace(/\/\/ boat3d:start[\s\S]*?\/\/ boat3d:end\n/,()=>block);else game=game.replace("'use strict';\n",()=>"'use strict';\n"+block);
fs.writeFileSync(file,game);
