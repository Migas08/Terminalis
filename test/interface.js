/* Integration checks for the study interface and its GitHub laboratory. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 fs.mkdirSync(path.join(__dirname,'../work'),{recursive:true});
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync(path.join(__dirname,'../dist/terminalis.html')));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;const errors=[];
 try{
  browser=await chromium.launch(require('./browser-options'));
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(async()=>{await LX.Auth.criar({nome:'Aluno de teste',usuario:'interface',email:'interface@example.invalid',senha:'TesteSeguro123'});LX.AuthUI.esconder();window.__app=new LX.App();await __app.start();__app.goHome();});
  await page.locator('.study-hero').waitFor();
  assert.equal(await page.locator('.study-course').count(),4);
  assert.match(await page.locator('.study-courses').innerText(),/JavaScript/, 'home includes the JavaScript course');
  await page.screenshot({path:path.join(__dirname,'../work/home-desktop.png')});
  await page.evaluate(()=>{__app.goLesson('lg4');});
  assert.equal(await page.evaluate(()=>__app.route.view),'curso','locked direct route stays on course');
  await page.evaluate(()=>{for(const m of LX.COURSE.modules)for(const l of m.lessons){LX.Progress.data.lessons[l.id]=1;for(const t of l.tasks)LX.Progress.data.tasks[t.id]=1;}__app.goLesson('lg4');});
  assert.equal(await page.locator('.git-flow>div').count(),3);
  const expected=await page.locator('[data-run]').first().getAttribute('data-run');assert(expected.includes('git'));
  await page.evaluate(()=>__app.goLesson('lg5'));
  const cmds=await page.locator('[data-run]').first().getAttribute('data-run');assert(cmds.includes('"'), 'quoted command survives HTML attributes');
  assert.equal(await page.locator('.code pre').first().innerText().then(x=>x.includes('class=')),false);
  await page.evaluate(()=>__app.goLesson('lg18'));
  await page.evaluate(async()=>{await __app.term.runVisible('cd /home/aluno/git-lab/c18');await __app.term.runVisible('git push -u origin feature');});
  await page.locator('[data-pr-create] input').fill('Revisar funcionalidade');
  await page.locator('[data-pr-create] button').click();
  await page.locator('[data-pr-comment] input').fill('Alteração conferida.');
  await page.locator('[data-pr-comment] button').click();
  await page.locator('[data-pr-action="changes"]').click();
  assert.equal(await page.evaluate(()=>LX.Github.hub(__app.machine).repos['equipe/c18'].prs[0].review),'changes_requested');
  await page.locator('[data-pr-action="merge"]').click();
  assert((await page.locator('.git-feedback').textContent()).includes('aprovar'));
  await page.locator('[data-pr-action="review"]').click();
  await page.locator('[data-pr-action="merge"]').click();
  assert.equal(await page.evaluate(()=>LX.Github.hub(__app.machine).repos['equipe/c18'].prs[0].state),'merged');
  await page.screenshot({path:path.join(__dirname,'../work/lesson-desktop.png')});
  await page.evaluate(()=>__app.goLesson('lg28'));
  await page.locator('[data-rebase-action]').nth(1).selectOption('squash');
  assert((await page.locator('[data-rebase-result]').textContent()).includes('um commit'));
  await page.evaluate(()=>__app.goPage('config'));
  await page.locator('#reading-size').selectOption('18');
  await page.locator('#reduce-motion').check();
  await page.waitForTimeout(1000);
  await page.reload();await page.waitForFunction(()=>window.__app?.machine);
  assert.equal(await page.evaluate(()=>LX.Progress.data.settings.readingSize),18);
  assert.equal(await page.evaluate(()=>LX.Progress.data.recentLessons[0]),'lg28');
  for(const width of [1440,1024,768,390,320]){
   await page.setViewportSize({width,height:900});
   for(const route of ['home','course','lesson']){
    await page.evaluate(r=>r==='home'?__app.goHome():r==='course'?__app.goCurso('git'):__app.goLesson('lg18'),route);
    const overflow=await page.evaluate(()=>({root:document.documentElement.scrollWidth,viewport:innerWidth,page:document.querySelector('#page').scrollWidth,pageWidth:document.querySelector('#page').clientWidth}));
    if(overflow.root>width+1)console.log(await page.evaluate(()=>[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth&&e.getBoundingClientRect().width>0).map(e=>({tag:e.tagName,cls:e.className,id:e.id,width:e.getBoundingClientRect().width})).slice(0,20)));
    assert(overflow.root<=width+1,JSON.stringify({width,route,overflow}));
    if(overflow.page>overflow.pageWidth+1)console.log(await page.evaluate(()=>[...document.querySelectorAll("#page *")].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,text:e.textContent.slice(0,70)})).slice(0,15)));
    assert(overflow.page<=overflow.pageWidth+1,JSON.stringify({width,route,overflow}));
   }
   if(width===390){await page.locator('.mobile-tabs [data-m=term]').click();assert(await page.locator('#side-panel').isVisible());await page.locator('.mobile-tabs [data-m=lesson]').click();assert(await page.locator('#lesson-panel').isVisible());await page.screenshot({path:path.join(__dirname,'../work/lesson-mobile.png')});await page.evaluate(()=>__app.goHome());await page.screenshot({path:path.join(__dirname,'../work/home-mobile.png')});await page.locator('#rail-toggle').click();assert.equal(await page.locator('#rail-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#rail-toggle').getAttribute('aria-expanded'),'false');}
  }
  const colors=await page.evaluate(()=>[...document.querySelectorAll('#app *')].flatMap(e=>{const s=getComputedStyle(e);return ['color','backgroundColor','borderTopColor'].map(k=>s[k]);}).filter(c=>{const m=/rgba?\((\d+), (\d+), (\d+)/.exec(c);return m&&(m[1]!==m[2]||m[2]!==m[3]);}));
  assert.deepEqual([...new Set(colors)],[],'interface uses neutral colors');
  assert.deepEqual(errors,[]);
  console.log('Interface: dashboard, code quoting, Git diagrams, PR review and merge, settings persistence, 15 responsive routes, keyboard menu: passed.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

