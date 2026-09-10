/* Audit the taught Git/GitHub operations and flags before each exercise.
   The generic vocabulary test separately checks Linux/Docker command names. */
const {loadEngine}=require('./harness');
const LX=loadEngine(),commands=new Set(),flags=new Set(),errors=[];
for(const s of LX.GitLab.lessons){
 const taught=[s.text,s.scenario,s.pitfall,s.practice,...(s.example||[])].join('\n');
 for(const m of taught.matchAll(/\b(git|gh)\s+([\w-]+)(?:\s+([\w-]+))?/g))commands.add(m[1]+' '+m[2]+(m[1]==='gh'?' '+m[3]:''));
 for(const m of taught.matchAll(/(?:^|[\s>])(\-\-?[a-zA-Z][\w-]*)/g))flags.add(m[1]);
 for(const c of [...(s.solution||[]),...(s.guide||[])]){
  const m=/^(git|gh)\s+([\w-]+)(?:\s+([\w-]+))?/.exec(c);if(!m)continue;
  const key=m[1]+' '+m[2]+(m[1]==='gh'?' '+m[3]:'');
  if(!commands.has(key))errors.push(`G${s.n}: ${key} not taught`);
  for(const f of c.matchAll(/(?:^|\s)(\-\-?[a-zA-Z][\w-]*)/g))if(!flags.has(f[1]))errors.push(`G${s.n}: ${f[1]} not taught`);
 }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Git vocabulary: ${LX.GitLab.lessons.length} lessons; no untaught operation or flag detected.`);
