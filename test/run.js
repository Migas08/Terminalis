const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
for(const file of fs.readdirSync(path.join(root,'src')).filter(x=>x.endsWith('.js')))run(['--check','src/'+file]);
for(const test of ['smoke','docker','git','estrutura','vocabulario','git-vocabulary','javascript-curriculum','solutions','workspace','cloud','mutation','local-store','javascript-runtime','javascript-security','javascript-typescript'])run(['test/'+test+'.js']);
