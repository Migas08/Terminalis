'use strict';
(function(){
 const G=LX.Git;
 const root=n=>'/home/aluno/git-lab/c'+String(n).padStart(2,'0');
 const shell=(m,n)=>new LX.Shell(m,{cwd:root(n),uid:1000,gid:1000,user:'aluno'});
 function prepare(m,n){
  m.gitLessons||={};if(m.gitLessons[n])return;m.gitLessons[n]=true;
  const sh=shell(m,n),fs=m.fs,o=sh.fsopts();fs.mkdirp(root(n),o);
  const write=(p,t)=>{fs.mkdirp(LX.FileSystem.dirname(root(n)+'/'+p),o);fs.writeFile(root(n)+'/'+p,t,o);};
  write('index.html','Inicio\n');write('README.md','# Projeto de treino\n');
  if(n<4||n===35)return;
  const r=G.Repo.init(sh);r.d.config={'user.name':'Aluno','user.email':'aluno@example.invalid'};r.add(['.']);const first=r.commit('Base do projeto');r.d.fixtureBase=first;r.save();
  if([9,10,18,27,29,34].includes(n)){
   r.switch('feature',true);write(n===10?'index.html':'feature.txt',n===10?'Inicio com login\n':'Funcionalidade\n');r.add(['.']);r.commit('Adiciona funcionalidade');r.switch('main');
   if([10,27].includes(n)){write(n===10?'index.html':'equipe.txt',n===10?'Inicio com dashboard\n':'Trabalho da equipe\n');r.add(['.']);r.commit('Atualiza main');}
   if([18,27,34].includes(n))r.switch('feature');
  }
  if([22,24,25,26,28,31].includes(n)){write('index.html','Segunda versao\n');r.add(['.']);r.commit('Atualiza pagina');}
  if(n===28){write('README.md','# Documentacao revisada\n');r.add(['.']);r.commit('Ajusta documentacao');}
  if([4,5,6,23,30].includes(n)){write('index.html','Pagina revisada\n');if(n===23)r.add(['index.html']);}
  if(n===7){write('.env','SEGREDO=EXEMPLO_SEM_VALOR\n');write('debug.log','log temporario\n');write('node_modules/cache.txt','dependencia\n');}
  if(n>=13&&n!==35){const h=LX.Github.hub(m);h.auth={user:'aluno',protocol:'https'};const remote=LX.Github.create(m,'equipe/c'+n);remote.commits=G.copy(r.d.commits);remote.branches=G.copy(r.d.branches);if(n!==13){r.d.remotes.origin='https://github.com/equipe/c'+n+'.git';r.d.tracking['origin/main']=remote.branches.main;r.save();}
   if(n===15){const id='abcde01500000000000000000000000000000015',tree=G.copy(remote.commits[remote.branches.main].tree);tree['remoto.txt']='Atualizacao da equipe\n';remote.commits[id]={id,tree,parents:[remote.branches.main],message:'Atualizacao remota',author:'Colega',email:'colega@example.invalid'};remote.branches.main=id;}
   if(n===16)h.auth=null;
  }
 }
 function state(ctx,n){const sh=shell(ctx.machine,n);return {sh,r:G.Repo.find(sh,false),read:p=>{try{return sh.m.fs.readFile(root(n)+'/'+p,sh.fsopts());}catch{return null;}},hub:LX.Github.hub(ctx.machine)};}
 const titles=['Por que versionar','Instalação e configuração','O primeiro repositório','A staging area','Commits com intenção','Lendo diferenças','O que fica fora do Git','Branches e linhas de trabalho','Integrando com merge','Resolvendo conflitos','Git e GitHub','Um repositório no GitHub','Remotos e primeiro push','Clonar um projeto','Push, fetch e pull','Identidade e autenticação','Um fluxo com branches','Pull Requests e revisão','Issues que orientam trabalho','README profissional','Tags e releases','HEAD e referências','Restaurar sem confundir','Corrigir o último commit','Reset: três efeitos distintos','Revert e histórico compartilhado','Rebase com responsabilidade','Rebase interativo','Cherry-pick','Guardar trabalho com stash','Recuperação com reflog','Forks e contribuição','GitHub Actions','Práticas profissionais'];
 const mods=titles.map((title,i)=>{const id='g'+String(i+1).padStart(2,'0');LX.mod({id,num:String(i+1).padStart(2,'0'),group:'Git & GitHub',title,blurb:'Capítulo '+(i+1)+' · '+title});return id;});
 const t=LX.trilhaPorId('git');Object.assign(t,{nome:'Git & GitHub',resumo:'Controle de versão do primeiro snapshot ao fluxo de trabalho profissional.',detalhe:'34 capítulos com prática no terminal, laboratório GitHub, diagramas, revisão de código e recuperação de histórico.',nivel:'Do básico ao avançado · requer Linux',estado:'disponivel',mods,requer:[{trilha:'linux'}],objetivos:['Entender working tree, índice e commits','Construir e integrar branches com segurança','Colaborar com Issues, Pull Requests e forks','Recuperar trabalho e publicar versões verificadas'],etapas:mods.map((id,i)=>({id:'git-'+(i+1),nome:titles[i],resumo:'Explicação, observação e prática verificável.',mods:[id]}))});
 LX.mod({id:'gpf',num:'PF',group:'Projeto final de Git',title:'Entrega colaborativa',blurb:'Do repositório vazio à release com revisão e CI.'});
 LX.TRILHAS.splice(LX.TRILHAS.indexOf(t)+1,0,{id:'pf-git',nome:'Projeto final de Git & GitHub',icone:t.icone,cor:'mono',resumo:'Entregue uma funcionalidade com histórico, conflito resolvido, revisão e release.',estado:'disponivel',mods:['gpf'],requer:[{trilha:'git'}],etapas:[{id:'entrega',nome:'Entrega colaborativa',mods:['gpf']}]});
 LX.GitLab={root,shell,prepare,state,titles,lessons:[],register(spec){
  const n=spec.n,id='lg'+n,path=root(n),codes=spec.example||['git status'];
  const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const pre=commands=>'<pre>'+escape(['cd '+path,...commands].join('\n'))+'</pre>';
  const body=[{box:'note',label:'Seu ambiente de estudo',body:[{p:'Este capítulo usa <code>'+path+'</code>. O cenário é independente dos demais: arquivos e histórico preparados pela aula não alteram seus outros exercícios. Git e GitHub aqui são simulações locais; nenhum comando envia arquivos ou credenciais à internet.'},{p:n>=4&&n!==35?'Você recebe um repositório já configurado com um commit inicial e arquivos de treino. As alterações adicionais do cenário são descritas abaixo.':'Use <code>cd '+path+'</code> para entrar na pasta. <code>cat</code> lê arquivos, <code>echo texto &gt; arquivo</code> grava texto e <code>cp origem destino</code> copia um arquivo, como no curso Linux.'}]},...spec.text.split('\n\n').map(p=>({p})),{gitVisual:spec.visual||'areas'},{h2:'Experimente e interprete'},{p:spec.scenario},{code:['$ cd '+path,...codes.map(c=>'$ '+c)],run:spec.run!==false},{box:'key',label:'Resultado esperado',body:[{p:spec.expected}]},{h2:'Erros comuns e boas práticas'},{p:spec.pitfall},{p:spec.practice},{h2:'Referência para consulta'},{p:'A prática acima é autocontida. Para aprofundar: <a href="'+(spec.source||'https://git-scm.com/docs/'+(['gitignore','glossary'].includes(spec.doc)?(spec.doc==='glossary'?'gitglossary':'gitignore'):'git-'+(spec.doc||'status')))+'" target="_blank" rel="noopener noreferrer">documentação oficial de '+(spec.source?'GitHub':'Git')+'</a>.'}];
  const lesson={id,n:'G'+n,title:LX.GitLab.titles[n-1],goal:spec.goal,objectives:[spec.goal,spec.task],setup:m=>prepare(m,n),body,tasks:[{id:id+'-a',kind:'guiado',title:'Observe o cenário',body:[{p:spec.observe||'Entre na pasta e execute a inspeção. Compare a saída com a explicação acima.'},{code:['$ cd '+path,...(spec.guide||['git status']).map(c=>'$ '+c)]}],hints:['Execute o bloco do guiado e leia a saída antes da pergunta.'],check:ctx=>({ok:(ctx.term.history||[]).some(c=>(spec.guide||['git status']).some(g=>c===g||c.includes(g))),msg:'Execute o comando de inspeção apresentado no guiado.'})},{id:id+'-q',kind:'quiz',title:spec.question,body:[{p:'Escolha a resposta que explica o comportamento, não apenas o nome do comando.'}],options:[{text:spec.answer,correct:true},...spec.wrong.map(([text,why])=>({text,why}))],hints:[spec.hint],solution:spec.answer,explain:spec.answer},{id:id+'-b',kind:'desafio',title:spec.task,body:[{p:spec.requirement}],hints:[spec.hint,spec.expected],solution:pre(spec.solution),check:ctx=>{try{return {ok:!!spec.check(state(ctx,n),ctx),msg:spec.requirement};}catch{return {ok:false,msg:spec.requirement};}}}]};
  const options=lesson.tasks[1].options; for(let i=0;i<n%options.length;i++)options.push(options.shift());
  LX.lesson(spec.mod||'g'+String(n).padStart(2,'0'),lesson);this.lessons.push(spec);
 }};
})();
