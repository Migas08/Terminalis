'use strict';
(function(){
 const G=LX.Git;
 LX.defcmd({name:'git',help:'Git no laboratório: init, config, status, add, commit, diff, log, branch, switch, merge, remote, clone, push, fetch, pull, tag, restore, reset, revert, rebase, cherry-pick, stash, reflog.',run:async({sh,io,args})=>{
  const out=s=>io.stdout.write(s+'\n');const value=(a,k)=>a[a.indexOf(k)+1];
  try{
   let a=args.slice(),cmd=a.shift();if(cmd==='--version'){out('git version 2.47.0 (simulador Terminalis)');return 0;}
   if(!cmd||cmd==='help'||cmd==='--help'){out(LX.COMMANDS.git.help);return 0;}
   if(cmd==='config'){
    const global=a.includes('--global');a=a.filter(x=>!['--global','--local'].includes(x));const r=G.Repo.find(sh,!global),c=global?G.globalConfig(sh):r.d.config;
    if(a[0]==='--list'||a[0]==='-l'){out(Object.entries(global?c:Object.assign({},G.globalConfig(sh),c)).map(([k,v])=>k+'='+v).join('\n'));return 0;}
    if(a[0]==='--get')a.shift();if(a.length===1){const v=c[a[0]]??G.globalConfig(sh)[a[0]];if(v===undefined)return 1;out(v);return 0;}
    if(a.length!==2||!a[0].includes('.'))G.fail('usage: git config [--global|--local] section.key value');c[a[0]]=a[1];
    if(global){const groups={};for(const [k,v]of Object.entries(c)){const i=k.indexOf('.'),s=k.slice(0,i);(groups[s]||= []).push('    '+k.slice(i+1)+' = '+v);}sh.m.fs.writeFile(sh.getVar('HOME')+'/.gitconfig',Object.entries(groups).map(([s,v])=>'['+s+']\n'+v.join('\n')).join('\n')+'\n',sh.fsopts());}else r.save();return 0;
   }
   if(cmd==='init'){let branch='main';if(a.includes('-b')){branch=value(a,'-b');a.splice(a.indexOf('-b'),2);}const r=G.Repo.init(sh,a[0]||sh.cwd,branch);out('Initialized Git repository in '+r.root+'/.git/');return 0;}
   if(cmd==='clone'){const remote=LX.Github.get(sh.m,a[0]);if(!remote)G.fail('fatal: repository not found in the local GitHub laboratory');const path=a[1]||remote.name.split('/').pop(),root=LX.FileSystem.normalize(path,sh.cwd);if(sh.m.fs.exists(root,sh.fsopts()))G.fail('fatal: destination path already exists');const r=G.Repo.init(sh,root);Object.assign(r.d,{commits:G.copy(remote.commits),branches:G.copy(remote.branches),branch:remote.defaultBranch,remotes:{origin:a[0]}});r.checkoutTree(r.snapshot());for(const[b,id]of Object.entries(remote.branches))r.d.tracking['origin/'+b]=id;r.d.upstream[r.d.branch]='origin/'+r.d.branch;r.save();out('Cloning into '+path+'...\ndone. (laboratório local)');return 0;}
   const r=G.Repo.find(sh),d=r.d;
   if(cmd==='status'){const ss=r.status();if(a.includes('--short')||a.includes('-s'))out(ss.map(x=>(d.conflicts.includes(x.path)?'UU':x.y==='?'&&x.x===' '?'??':x.x+x.y)+' '+x.path).join('\n'));else{out(d.branch?'On branch '+d.branch:'HEAD detached at '+r.head?.slice(0,7));if(!r.head)out('\nNo commits yet');if(d.conflicts.length)out('\nUnmerged paths:\n'+d.conflicts.map(p=>'  both modified: '+p).join('\n'));if(ss.some(x=>x.x!==' '))out('\nChanges to be committed:\n'+ss.filter(x=>x.x!==' ').map(x=>'  '+({A:'new file',M:'modified',D:'deleted'}[x.x])+': '+x.path).join('\n'));if(ss.some(x=>['M','D'].includes(x.y)))out('\nChanges not staged for commit:\n'+ss.filter(x=>['M','D'].includes(x.y)).map(x=>'  '+(x.y==='D'?'deleted':'modified')+': '+x.path).join('\n'));if(ss.some(x=>x.y==='?'&&x.x===' '))out('\nUntracked files:\n'+ss.filter(x=>x.y==='?'&&x.x===' ').map(x=>'  '+x.path).join('\n'));if(!ss.length)out('nothing to commit, working tree clean');}return 0;}
   if(cmd==='add'){if(!a.length)G.fail('Nothing specified, nothing added.');r.add(a.includes('-A')||a.includes('--all')?['.']:a);return 0;}
   if(cmd==='commit'){let msg=a.includes('-m')?value(a,'-m'):null;if(a.includes('-a'))r.add(Object.keys(d.index).map(p=>r.root+'/'+p));if(a.includes('--no-edit'))msg=d.commits[r.head]?.message;if(!msg){const p=r.root+'/.git/COMMIT_EDITMSG';sh.m.fs.writeFile(p,'',sh.fsopts());await io.term.editor(p);msg=sh.m.fs.readFile(p,sh.fsopts()).trim();}const id=r.commit(msg,{amend:a.includes('--amend'),allowEmpty:a.includes('--allow-empty')});out('['+(d.branch||'detached HEAD')+' '+id.slice(0,7)+'] '+msg);return 0;}
   if(cmd==='log'||cmd==='show'){const ref=a.find(x=>!x.startsWith('-'))||'HEAD';if(!r.head)G.fail('fatal: your current branch does not have any commits yet');const ids=cmd==='show'?[r.resolve(ref)]:r.ancestors(r.resolve(ref));out(ids.map(id=>{const c=d.commits[id],labels=Object.entries(d.branches).filter(x=>x[1]===id).map(x=>x[0]);return (a.includes('--graph')?'* ':'')+(a.includes('--oneline')?id.slice(0,7)+' '+(labels.length?'('+labels.join(', ')+') ':'')+c.message:'commit '+id+'\nAuthor: '+c.author+' <'+c.email+'>\n\n    '+c.message)+(cmd==='show'?'\n'+r.diff(r.snapshot(c.parents[0]||null),c.tree):'');}).join('\n'));return 0;}
   if(cmd==='diff'){let left=d.index,right=Object.fromEntries(Object.entries(r.working()).filter(([p])=>p in d.index));if(a.includes('--staged')||a.includes('--cached')){left=r.snapshot();right=d.index;}else if(a[0]&&!a[0].startsWith('-')){left=r.snapshot(r.resolve(a[0]));if(a[1])right=r.snapshot(r.resolve(a[1]));}out(r.diff(left,right));return 0;}
   if(cmd==='rev-parse'){out(a[0]==='--show-toplevel'?r.root:a[0]==='--is-inside-work-tree'?'true':r.resolve(a[0]));return 0;}
   if(cmd==='ls-files'){out(Object.keys(d.index).sort().join('\n'));return 0;}
   if(cmd==='branch'){
    if(!a.length){out(Object.keys(d.branches).map(b=>(b===d.branch?'* ':'  ')+b).join('\n'));return 0;}
    if(a[0]==='-d'||a[0]==='-D'){const b=a[1];if(b===d.branch||!(b in d.branches))G.fail('error: cannot delete this branch');if(a[0]==='-d'&&!r.ancestors(r.head).includes(d.branches[b]))G.fail('error: branch is not fully merged');delete d.branches[b];r.save();out('Deleted branch '+b);return 0;}
    if(a[0]==='-M'||a[0]==='-m'){const b=a[1];d.branches[b]=r.head;delete d.branches[d.branch];d.branch=b;r.save();return 0;}
    if(d.branches[a[0]]!==undefined)G.fail('fatal: branch already exists');d.branches[a[0]]=a[1]?r.resolve(a[1]):r.head;r.save();return 0;
   }
   if(cmd==='switch'||cmd==='checkout'){const create=a[0]==='-c'||a[0]==='-b',detach=a[0]==='--detach';r.switch(a[create||detach?1:0],create,detach);out('Switched to '+(create?'a new branch ':'branch ')+(d.branch||'detached HEAD'));return 0;}
   if(cmd==='merge'){if(a[0]==='--abort'){if(!d.merge)G.fail('fatal: no merge in progress');r.checkoutTree(r.snapshot(d.merge.original),true);delete d.merge;d.conflicts=[];r.save();return 0;}out(r.merge(a.find(x=>!x.startsWith('-')),a.includes('--no-ff')));return d.conflicts.length?1:0;}
   if(cmd==='restore'){const staged=a.includes('--staged');const paths=a.filter(x=>!x.startsWith('-')).map(x=>r.path(x));if(!paths.length)G.fail('fatal: specify paths to restore');const source=staged?r.snapshot():d.index;const w=r.working();for(const p of r.selected(paths,Object.assign({},w,source))){if(staged){if(p in source)d.index[p]=source[p];else delete d.index[p];}else{const q=r.root+'/'+p;if(p in source)sh.m.fs.writeFile(q,source[p],sh.fsopts());else if(p in d.index&&sh.m.fs.exists(q,sh.fsopts()))sh.m.fs.unlink(q,sh.fsopts());}}r.save();return 0;}
   if(cmd==='reset'){r.reset(a.find(x=>!x.startsWith('-'))||'HEAD',a.find(x=>x.startsWith('--'))||'--mixed');out('HEAD is now at '+r.head.slice(0,7));return 0;}
   if(cmd==='revert'||cmd==='cherry-pick'){out('Created commit '+r.applyCommit(r.resolve(a[0]),cmd==='revert').slice(0,7));return 0;}
   if(cmd==='tag'){if(!a.length){out(Object.keys(d.tags).sort().join('\n'));return 0;}const n=a[0]==='-a'?a[1]:a[0];if(d.tags[n])G.fail('fatal: tag already exists');d.tags[n]={id:r.head,message:a.includes('-m')?value(a,'-m'):''};r.save();return 0;}
   if(cmd==='reflog'){out(d.reflog.map((x,i)=>x.id?.slice(0,7)+' HEAD@{'+i+'}: '+x.msg).join('\n'));return 0;}
   if(cmd==='stash'){
    const op=a[0]||'push';if(op==='list'){out(d.stash.map((s,i)=>'stash@{'+i+'}: WIP on '+s.branch).join('\n'));return 0;}
    if(op==='push'||op==='save'||op==='-u'){const w=r.working(),include=a.includes('-u');const selected={};for(const p of Object.keys(w))if(p in d.index||include&&!r.ignored(p,w))selected[p]=w[p];d.stash.unshift({tree:selected,index:G.copy(d.index),base:r.snapshot(),branch:d.branch});r.checkoutTree(r.snapshot(),true);if(include)for(const p of Object.keys(selected))if(!(p in d.index)&&sh.m.fs.exists(r.root+'/'+p,sh.fsopts()))sh.m.fs.unlink(r.root+'/'+p,sh.fsopts());r.save();out('Saved working directory and index state');return 0;}
    if(op==='pop'||op==='apply'){const s=d.stash[0];if(!s)G.fail('No stash entries found.');if(!r.clean())G.fail('error: commit changes before applying stash');const rr=r.mergeTrees(s.base,r.working(),s.tree,'stash');r.checkoutTree(rr.tree);d.index=a.includes('--index')?G.copy(s.index):r.snapshot();d.conflicts=rr.conflicts;if(op==='pop'&&!rr.conflicts.length)d.stash.shift();r.save();out(rr.conflicts.length?'CONFLICT applying stash':'Applied stash');return rr.conflicts.length?1:0;}G.fail('stash operation unsupported in this laboratory');
   }
   if(cmd==='rebase'){
    if(a.includes('-i')){out('Interactive rebase is taught in the interactive lesson editor. This terminal supports simple rebase, --continue and --abort.');return 1;}
    if(a[0]==='--abort'){if(!d.rebase)G.fail('No rebase in progress');const old=d.rebase.original;r.checkoutTree(r.snapshot(old),true);r.move(old,'rebase: abort');delete d.rebase;d.conflicts=[];r.save();return 0;}
    if(a[0]==='--continue'){if(!d.rebase||d.conflicts.length)G.fail('Resolve conflicts and add the files first');r.commit(d.rebase.pending.message);delete d.rebase.pending;}
    else{if(!r.clean())G.fail('error: commit or stash changes before rebase');const target=r.resolve(a[0]),original=r.head,base=r.ancestors(original).find(x=>r.ancestors(target).includes(x));const todo=[];let id=original;while(id&&id!==base){todo.unshift(id);id=d.commits[id]?.parents[0];}d.rebase={original,todo};r.checkoutTree(r.snapshot(target));r.move(target,'rebase: start');}
    while(d.rebase.todo.length){const c=d.commits[d.rebase.todo.shift()],rr=r.mergeTrees(r.snapshot(c.parents[0]||null),r.snapshot(),c.tree,'rebase');r.checkoutTree(rr.tree);d.conflicts=rr.conflicts;if(rr.conflicts.length){d.rebase.pending=c;r.save();G.fail('CONFLICT: resolve, git add, then git rebase --continue');}if(!G.eq(r.snapshot(),d.index))r.commit(c.message);}
    delete d.rebase;r.save();out('Successfully rebased '+d.branch);return 0;
   }
   if(cmd==='remote'){if(!a.length||a[0]==='-v'){out(Object.entries(d.remotes).map(([n,url])=>a[0]==='-v'?n+'\t'+url+' (fetch)\n'+n+'\t'+url+' (push)':n).join('\n'));return 0;}if(a[0]==='add'){if(d.remotes[a[1]])G.fail('error: remote already exists');d.remotes[a[1]]=a[2];}else if(a[0]==='remove')delete d.remotes[a[1]];else G.fail('remote operation unsupported');r.save();return 0;}
   if(['push','fetch','pull'].includes(cmd))return LX.Github.transfer(r,cmd,a,out);
   G.fail('git: unsupported command in this laboratory: '+cmd);
  }catch(e){io.stderr.write(e.message+'\n');return 1;}
 }});
})();
