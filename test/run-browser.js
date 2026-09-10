const path=require('node:path'),{spawnSync}=require('node:child_process');
for(const test of ['ui','auth','aluno','interface']){const r=spawnSync(process.execPath,['test/'+test+'.js'],{cwd:path.join(__dirname,'..'),stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
