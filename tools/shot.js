/* Tira screenshots das telas do app para revisão visual.
   uso: node tools/shot.js <saida-dir> [rota1 rota2 ...]
   rotas: home | cursos | jornada | projetos | lesson:<id> | curso:<trilha> | progresso | ajuda */
const path=require('path'), http=require('http'), fs=require('fs');
const { chromium } = require('playwright');
(async()=>{
  const outDir = process.argv[2] || '/tmp/shots';
  const rotas = process.argv.slice(3); if(!rotas.length) rotas.push('home');
  fs.mkdirSync(outDir,{recursive:true});
  const html = fs.readFileSync(path.join(__dirname,'..','dist','terminalis.html'));
  const srv = http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html);});
  await new Promise(res=>srv.listen(0,res));
  const alvo='http://127.0.0.1:'+srv.address().port+'/';
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--disable-features=Autofill'] });
  const page = await browser.newPage({ viewport:{width:1440,height:900} });
  const errs=[]; page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
  await page.goto(alvo);
  await page.waitForFunction(()=>!!window.LX&&!!LX.AuthUI&&!!LX.AuthUI.el,null,{timeout:15000});
  await page.evaluate(async()=>{ try{await LX.Auth.criar({usuario:'miguel',email:'miguel@exemplo.com',senha:'umaSenhaBoa9'});}catch(e){} LX.AuthUI.esconder(); window.__app=new LX.App(); window.__app.start(); });
  await page.waitForTimeout(700);
  // simula algum progresso p/ ver estados (linux várias aulas feitas)
  await page.evaluate(()=>{ try{ const P=LX.Progress; for(const m of LX.COURSE.modules){ if(['m01','m02','m03'].includes(m.id)) for(const l of m.lessons) P.markLesson(l.id,true);} P.save(); window.__app.avaliarProgressao(false);}catch(e){} });
  for(const rota of rotas){
    await page.evaluate((r)=>{
      const a=window.__app;
      if(r==='home') a.goHome();
      else if(r==='cursos'&&a.goCursos) a.goCursos();
      else if(r==='jornada') a.goJornada();
      else if(r==='projetos'&&a.goProjetos) a.goProjetos();
      else if(r==='progresso'&&a.goProgresso) a.goProgresso();
      else if(r.startsWith('lesson:')) a.goLesson(r.slice(7));
      else if(r.startsWith('curso:')&&a.goCurso) a.goCurso(r.slice(6));
      else a.goHome();
    }, rota);
    await page.waitForTimeout(500);
    const nome = rota.replace(/[:]/g,'-');
    await page.screenshot({ path: path.join(outDir, nome+'.png'), fullPage:false });
    console.log('shot:', nome);
  }
  if(errs.length) console.log('ERROS:', errs.slice(0,5).join(' | '));
  await browser.close(); srv.close();
})();
