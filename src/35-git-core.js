/* Git educacional: snapshots imutáveis, índice e grafo de commits no VFS.
   Não executa Git nativo nem acessa a rede. */
'use strict';
(function () {
  const copy = x => JSON.parse(JSON.stringify(x));
  const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const keys = (...xs) => [...new Set(xs.flatMap(x=>Object.keys(x||{})))].sort();
  const fail = msg => { throw new Error(msg); };
  class GitRepo {
    constructor(sh, root, data) { this.sh=sh; this.root=root; this.d=data; }
    static find(sh, required=true) {
      let p=sh.cwd;
      while (true) {
        const file=p+'/.git/terminalis.json';
        if(sh.m.fs.exists(file,sh.fsopts())) return new GitRepo(sh,p,JSON.parse(sh.m.fs.readFile(file,sh.fsopts())));
        if(p==='/') break; p=LX.FileSystem.dirname(p);
      }
      if(required) fail('fatal: not a git repository (or any of the parent directories): .git');
      return null;
    }
    static init(sh,root=sh.cwd,branch='main') {
      const p=LX.FileSystem.normalize(root,sh.cwd);
      if(sh.m.fs.exists(p+'/.git/terminalis.json',sh.fsopts())) return new GitRepo(sh,p,JSON.parse(sh.m.fs.readFile(p+'/.git/terminalis.json',sh.fsopts())));
      sh.m.fs.mkdirp(p+'/.git',sh.fsopts());
      const r=new GitRepo(sh,p,{branch,detached:null,branches:{[branch]:null},commits:{},index:{},config:{},tags:{},remotes:{},tracking:{},upstream:{},reflog:[],stash:[],conflicts:[],seq:0});r.save();return r;
    }
    save() {
      const fs=this.sh.m.fs,o=this.sh.fsopts();
      fs.writeFile(this.root+'/.git/terminalis.json',JSON.stringify(this.d),o);
      fs.writeFile(this.root+'/.git/HEAD',this.d.branch?'ref: refs/heads/'+this.d.branch+'\n':this.head+'\n',o);
      fs.mkdirp(this.root+'/.git/refs/heads',o);
      for(const [b,id] of Object.entries(this.d.branches)) {const p=this.root+'/.git/refs/heads/'+b;fs.mkdirp(LX.FileSystem.dirname(p),o);fs.writeFile(p,(id||'')+'\n',o);}
    }
    get head(){return this.d.branch?this.d.branches[this.d.branch]:this.d.detached;}
    snapshot(ref=this.head){return copy(this.d.commits[ref]?.tree||{});}
    resolve(ref='HEAD') {
      const m=/^(.*?)(?:~(\d+)|\^(\d*))?$/.exec(ref);let base=m[1],id;
      if(/^HEAD@\{\d+\}$/.test(base)) id=this.d.reflog[+base.slice(6,-1)]?.id;
      else id=base==='HEAD'?this.head:this.d.branches[base]||this.d.tags[base]?.id||this.d.tracking[base]||Object.keys(this.d.commits).find(k=>k.startsWith(base));
      if(!id) fail('fatal: unknown revision: '+ref);
      if(m[2])for(let i=0;i<+m[2];i++)id=this.d.commits[id]?.parents[0];
      if(m[3]!==undefined)id=this.d.commits[id]?.parents[+(m[3]||1)-1];
      if(!id)fail('fatal: revision has no such parent: '+ref);return id;
    }
    working(){
      const out={},fs=this.sh.m.fs,o=this.sh.fsopts();
      const walk=(p,rel)=>{for(const name of fs.readdir(p,o)){const n=typeof name==='string'?name:name.name;if(n==='.git')continue;const q=p+'/'+n,r=rel+n,s=fs.lstat(q,o);if(s.type==='dir')walk(q,r+'/');else if(s.type==='file')out[r]=fs.readFile(q,o);}};
      walk(this.root,'');return out;
    }
    ignored(p,w=this.working()) {
      let ignored=false;
      for(let pat of (w['.gitignore']||'').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'))){const negate=pat[0]==='!';if(negate)pat=pat.slice(1);const dir=pat.endsWith('/');pat=pat.replace(/^\//,'').replace(/\/$/,'');const re=new RegExp((pat.includes('/')?'^':'(^|/)')+pat.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*/g,'\u0001').replace(/\*/g,'[^/]*').replace(/\u0001/g,'.*').replace(/\?/g,'[^/]')+(dir?'(/|$)':'$'));if(re.test(p))ignored=!negate;}return ignored;
    }
    path(p){const abs=LX.FileSystem.normalize(p,this.sh.cwd);if(abs!==this.root&&!abs.startsWith(this.root+'/'))fail('fatal: path is outside repository');return abs===this.root?'':abs.slice(this.root.length+1);}
    selected(paths,all){return keys(all,this.d.index).filter(p=>paths.some(q=>q===''||p===q||p.startsWith(q+'/')));}
    add(paths){const w=this.working();for(const p of this.selected(paths.map(p=>this.path(p)),w)){if(p in w){if(p in this.d.index||!this.ignored(p,w))this.d.index[p]=w[p];}else delete this.d.index[p];this.d.conflicts=this.d.conflicts.filter(x=>x!==p);}this.save();}
    status(){const h=this.snapshot(),w=this.working();return keys(h,this.d.index,w).filter(p=>p in this.d.index||p in h||!this.ignored(p,w)).map(p=>({path:p,x:h[p]===this.d.index[p]?' ':!(p in this.d.index)?'D':!(p in h)?'A':'M',y:this.d.index[p]===w[p]?' ':!(p in w)?'D':!(p in this.d.index)?'?':'M'})).filter(x=>x.x!==' '||x.y!==' ');}
    clean(){return this.status().every(x=>x.y==='?'&&x.x===' ');}
    identity(){const c=Object.assign({},LX.Git.globalConfig(this.sh),this.d.config);if(!c['user.name']||!c['user.email'])fail('Author identity unknown. Configure user.name and user.email.');return c;}
    move(id,msg){if(this.d.branch)this.d.branches[this.d.branch]=id;else this.d.detached=id;this.d.reflog.unshift({id,msg});}
    commit(message,opts={}){
      if(this.d.conflicts.length)fail('error: resolve conflicts and git add the files first');
      if(!message?.trim())fail('Aborting commit due to empty commit message.');
      const who=this.identity(),old=this.head;
      if(eq(this.snapshot(),this.d.index)&&!opts.amend&&!this.d.merge&&!opts.allowEmpty)fail('nothing to commit, working tree clean');
      const parents=opts.parents||(opts.amend?(this.d.commits[old]?.parents||[]):[old,this.d.merge?.other].filter(Boolean));
      const tree=copy(this.d.index),seq=++this.d.seq;let hash=2166136261;for(const c of JSON.stringify([tree,parents,message,seq]))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
      const id=hash.toString(16).padStart(8,'0')+seq.toString(16).padStart(32,'0');
      this.d.commits[id]={id,tree,parents,message,author:who['user.name'],email:who['user.email']};this.move(id,(opts.amend?'commit (amend): ':'commit: ')+message);delete this.d.merge;this.save();return id;
    }
    checkoutTree(tree,force=false){
      const w=this.working();for(const p of Object.keys(tree))if(!(p in this.d.index)&&p in w&&w[p]!==tree[p]&&!force)fail('error: untracked file would be overwritten: '+p);
      const fs=this.sh.m.fs,o=this.sh.fsopts();for(const p of keys(this.d.index,tree)){const path=this.root+'/'+p;if(p in tree){fs.mkdirp(LX.FileSystem.dirname(path),o);fs.writeFile(path,tree[p],o);}else if(fs.exists(path,o))fs.unlink(path,o);}
      this.d.index=copy(tree);
    }
    switch(ref,create=false,detach=false){
      if(!this.clean()||this.d.conflicts.length)fail('error: commit or stash changes before switching branches');
      if(create){if(this.d.branches[ref]!==undefined)fail('fatal: branch already exists');this.d.branches[ref]=this.head;}
      const id=this.d.branches[ref]!==undefined?this.d.branches[ref]:this.resolve(ref);
      if(this.d.branches[ref]===undefined&&!detach)fail('fatal: a branch is expected; use switch --detach');
      this.checkoutTree(this.snapshot(id));this.d.branch=detach?null:ref;this.d.detached=detach?id:null;this.d.reflog.unshift({id,msg:'checkout: moving to '+ref});this.save();
    }
    ancestors(id){const out=[],queue=[id];while(queue.length){const c=queue.shift();if(!c||out.includes(c))continue;out.push(c);queue.push(...(this.d.commits[c]?.parents||[]));}return out;}
    mergeTrees(base,ours,theirs,label){
      const result={},conflicts=[];for(const p of keys(base,ours,theirs)){let a=ours[p],b=theirs[p],v;if(a===b)v=a;else if(a===base[p])v=b;else if(b===base[p])v=a;else {const aa=(a||'').split('\n'),bb=(b||'').split('\n'),cc=(base[p]||'').split('\n');if(a!==undefined&&b!==undefined&&aa.length===bb.length&&aa.length===cc.length&&aa.every((v,i)=>v===bb[i]||v===cc[i]||bb[i]===cc[i]))v=aa.map((v,i)=>v===cc[i]?bb[i]:v).join('\n');else{v='<<<<<<< HEAD\n'+(a||'')+'=======\n'+(b||'')+'>>>>>>> '+label+'\n';conflicts.push(p);}}if(v!==undefined)result[p]=v;}return {tree:result,conflicts};
    }
    merge(ref,noFF=false){
      if(!this.clean())fail('error: commit or stash changes before merging');const other=this.resolve(ref),ours=this.head;
      if(this.ancestors(ours).includes(other))return 'Already up to date.';
      if(!ours||this.ancestors(other).includes(ours)&&!noFF){this.checkoutTree(this.snapshot(other));this.move(other,'merge: Fast-forward');this.save();return 'Fast-forward';}
      const base=this.ancestors(ours).find(x=>this.ancestors(other).includes(x));
      if(!base)fail('fatal: refusing to merge unrelated histories');
      const r=this.mergeTrees(this.snapshot(base),this.snapshot(ours),this.snapshot(other),ref);
      this.checkoutTree(r.tree);this.d.conflicts=r.conflicts;this.d.merge={other,original:ours};this.save();
      if(r.conflicts.length)return 'CONFLICT (content): '+r.conflicts.join(', ')+'\nAutomatic merge failed; fix conflicts and then commit the result.';
      this.commit('Merge branch '+ref);return 'Merge made by the three-way strategy.';
    }
    diff(a,b){return keys(a,b).filter(p=>a[p]!==b[p]).map(p=>'diff --git a/'+p+' b/'+p+'\n--- '+(p in a?'a/'+p:'/dev/null')+'\n+++ '+(p in b?'b/'+p:'/dev/null')+'\n@@ snapshot comparison @@\n'+(a[p]||'').split('\n').filter(Boolean).map(l=>'-'+l).join('\n')+'\n'+(b[p]||'').split('\n').filter(Boolean).map(l=>'+'+l).join('\n')).join('\n');}
    reset(ref,mode){const id=this.resolve(ref);if(mode==='--hard')this.checkoutTree(this.snapshot(id),true);else if(mode!=='--soft')this.d.index=this.snapshot(id);this.move(id,'reset: moving to '+ref);this.d.conflicts=[];delete this.d.merge;this.save();}
    applyCommit(id,revert=false){if(!this.clean())fail('error: commit or stash changes before applying a commit');const c=this.d.commits[id];const r=this.mergeTrees(revert?c.tree:this.snapshot(c.parents[0]||null),this.snapshot(),revert?this.snapshot(c.parents[0]||null):c.tree,id.slice(0,7));this.checkoutTree(r.tree);this.d.conflicts=r.conflicts;this.save();if(r.conflicts.length)fail('CONFLICT: resolve files and commit');return this.commit(revert?'Revert "'+c.message+'"':c.message);}
  }
  LX.Git={Repo:GitRepo,copy,eq,keys,fail,globalConfig(sh){try{const t=sh.m.fs.readFile(sh.getVar('HOME')+'/.gitconfig',sh.fsopts());let section='',o={};for(const l of t.split('\n')){const h=/^\s*\[([^\]]+)\]/.exec(l),v=/^\s*([\w.-]+)\s*=\s*(.*)/.exec(l);if(h)section=h[1];else if(v)o[section+'.'+v[1]]=v[2];}return o;}catch{return {};}}};
})();
