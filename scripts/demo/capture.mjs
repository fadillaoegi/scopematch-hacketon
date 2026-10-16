// A real, automated walkthrough, using fictional sample participants.
// Browser interactions only; API reads assert results without changing state.
import { readFile, readdir } from 'node:fs/promises'
import { person, send, sleep, errors, finish, encode, origin, outDir, writeFile, mkdir, join } from './browser.mjs'

const owner = await person('owner', {width:1280,height:720,scale:1.5})
const client = await person('client', {width:390,height:844,scale:2,touch:true})
const downloadDir=join(outDir,'download')
await mkdir(downloadDir,{recursive:true})
await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir,browserContextId:owner.contextId})
const brief='We need a surf school website with online booking and two languages. Guests should also be able to choose a lesson level.'
const scenes=[]; const checks={}; let token, clientToken, custom, begin, end
const region = title => `section[aria-label=${JSON.stringify('Decision for '+title)}]`
const waitButton = (p,text,scope) => p.until(`!!([...(${scope?`document.querySelector(${JSON.stringify(scope)})`:'document'}?.querySelectorAll('button')??[])].find(b=>b.textContent.includes(${JSON.stringify(text)})&&!b.disabled))`,text,60000)
const state=async t=>{const r=await fetch(origin+'/api/session',{headers:{Authorization:'Bearer '+t}});if(!r.ok)throw Error('Session unavailable');return r.json()}
const check=(name,valid)=>{if(!valid)throw Error('Evidence failed: '+name);checks[name]=true}
async function scene(id,role,fn){const s={id,role,start:Date.now()/1000};scenes.push(s);console.log('Scene: '+id);await fn();s.end=Date.now()/1000;await writeFile(join(outDir,'capture.json'),JSON.stringify({begin,scenes,checks},null,2))}
const paste=async(p,selector,text)=>{await p.click(`document.querySelector(${JSON.stringify(selector)})`);await p.call('Input.insertText',{text});await p.read(900)}
try {
  await owner.go(origin+'/new');await client.go('about:blank')
  await owner.start();await client.start();begin=Date.now()/1000
  await scene('brief','owner',async()=>{
    await owner.read(1500)
    await owner.fill('#name','Ombak surf school')
    await owner.fill('#freelancerName','Raka');await owner.fill('#clientName','Nadia')
    await paste(owner,'#brief',brief);await owner.press('Read the brief')
    await owner.until("document.body.textContent.includes('Lock questions')")
    token=await owner.ev("location.pathname.split('/').at(-1)")
    await owner.read(1400)
  })
  await scene('questions','owner',async()=>{
    await owner.hover(`document.querySelector('[data-card="booking"]')`,2000)
    await owner.hover(`document.querySelector('[data-card="languages"]')`,1800)
    if(await owner.ev(`!!document.querySelector('[data-card="launch-content"]')`))await owner.click(`document.querySelector('[data-card="launch-content"] button')`)
    await owner.read(1200)
  })
  await scene('ai','owner',async()=>{
    await owner.hover(`document.querySelector('section[aria-labelledby="ai-heading"]')`,2400)
    for(let attempt=0;attempt<3;attempt++){
      await owner.press('Suggest questions with AI')
      await owner.until(`!!document.querySelector('section[aria-labelledby="ai-heading"] article')||document.body.textContent.includes("The AI service didn't answer")`,'Gemini response',150000)
      if(await owner.ev(`!!document.querySelector('section[aria-labelledby="ai-heading"] article')`))break
      console.log('Provider unavailable; retrying live request');await owner.read(1800)
    }
    await owner.until(`!!document.querySelector('section[aria-labelledby="ai-heading"] article')`,'live Gemini drafts',1000)
    await owner.read(2200)
    await owner.click(`document.querySelector('section[aria-labelledby="ai-heading"] article details summary')`)
    await owner.read(3000)
    await owner.click(`document.querySelector('section[aria-labelledby="ai-heading"] article details summary')`)
    await owner.press('Add to questions','section[aria-labelledby="ai-heading"] article')
    await owner.until("document.body.textContent.includes('Suggested by AI · added by you')")
    const s=await state(token);custom=s.customCards.find(c=>s.cards.some(r=>r.id===c.id))
    check('live AI card reviewed and added',!!custom)
    await owner.hover(`document.querySelector('[data-card="${custom.id}"]')`,2200)
  })
  await scene('invite','owner',async()=>{
    await owner.press('Lock questions & get links')
    await owner.until("document.querySelectorAll('input[readonly]').length===2")
    const url=await owner.ev("document.querySelectorAll('input[readonly]')[1].value")
    clientToken=new URL(url).pathname.split('/').at(-1)
    await owner.hover(`document.querySelector('a[href^="https://wa.me/"]')`,1500)
    await client.go(url);await client.until("document.body.textContent.includes('Before work starts')")
  })
  await scene('welcome','client',async()=>{
    await client.read(3000);await client.press('Start answering');await client.read(1500)
  })
  await scene('owner-answers','owner',async()=>{
    await owner.press('Answer the questions')
    for(const id of ['booking','languages',custom.id]){await owner.click(owner.option(id,'a'));await owner.read(700)}
    await owner.press('Seal my answers');await owner.until("document.body.textContent.includes('Sealed. Waiting for')")
    const s=await state(clientToken);check('other answers hidden before both seals',!s.other.answers)
    await owner.read(2200)
  })
  await scene('client-answers','client',async()=>{
    for(const [i,id] of ['booking','languages',custom.id].entries()){
      await client.click(client.option(id,i===0?'c':'a'));await client.read(900)
      if(i<2)await client.pressIfShown('Next')
    }
    await client.press('Seal my answers');await owner.until("document.querySelectorAll('[data-reveal]').length>=2")
  })
  await scene('reveal','owner',async()=>{
    await owner.top();await owner.read(2600)
    await owner.hover(`document.querySelector('[aria-label="Different answers"]')`,2600)
    await owner.scrollBy(290);await owner.read(2600)
    check('different and same answers remain undecided',(await state(token)).counts.decided===0)
  })
  await scene('propose','owner',async()=>{
    await owner.press('Propose a decision',region('Booking'))
    await owner.click(owner.option('proposal-booking','a'));await owner.press('Send proposal',region('Booking'))
    await owner.read(1800)
  })
  await scene('counter','client',async()=>{
    await waitButton(client,'Counter-propose',region('Booking'))
    await client.press('Counter-propose',region('Booking'));await client.click(client.option('proposal-booking','b'))
    await paste(client,`${region('Booking')} textarea:not([required])`,'Staff confirm lesson availability.')
    await client.press('Send proposal',region('Booking'));await client.read(2200)
  })
  await scene('decision','owner',async()=>{
    await waitButton(owner,'Confirm decision',region('Booking'))
    await owner.hover(`document.querySelector(${JSON.stringify(region('Booking'))})`,1500)
    await owner.press('Confirm decision',region('Booking'))
    await owner.read(1700)
  })
  await scene('same','owner',async()=>{
    for(const title of ['Languages',custom.title]){
      await owner.press('Confirm decision',region(title))
      await waitButton(client,'Confirm decision',region(title));await client.press('Confirm decision',region(title))
    }
    await owner.until(`!!document.querySelector('[aria-label="3 of 3 decided"]')`,'3 decisions')
    check('all decisions confirmed by both',(await state(token)).counts.decided===3)
    await owner.top();await owner.read(2000)
  })
  await scene('scope','owner',async()=>{
    await owner.press('Review scope');await owner.until("!!document.querySelector('textarea[aria-label=Included]')")
    await owner.read(1500);await owner.scrollBy(450);await owner.read(1700)
    await owner.scrollBy(450);await owner.read(1400)
    await owner.press('Send for confirmation');await owner.fill('form input[autocomplete=name]','Raka');await owner.press('Confirm scope v1')
    await waitButton(client,'View scope');await client.press('View scope');await client.until("document.body.textContent.includes('Confirm scope v1')")
    await owner.read(1200)
  })
  await scene('revision','owner',async()=>{
    await owner.press('Edit as a new version')
    await paste(owner,'textarea[aria-label="Open questions"]','Confirm lesson photos before launch.')
    await owner.press('Send for confirmation');await owner.read(1800)
    const s=await state(token);check('revision clears old confirmations',s.scope.latestVersion===2&&!s.scope.ownerConfirmedAt&&!s.scope.clientConfirmedAt)
  })
  await scene('agreement','owner',async()=>{
    await owner.fill('form input[autocomplete=name]','Raka');await owner.press('Confirm scope v2')
    await client.until("document.body.textContent.includes('Confirm scope v2')",'version two arrives')
    await client.fill('form input[autocomplete=name]','Nadia');await client.press('Confirm scope v2')
    await owner.until("document.body.textContent.includes('The agreed scope.')")
    await owner.top();await owner.read(3500)
    check('latest version agreed by both',(await state(token)).stage==='agreed')
  })
  await scene('export','owner',async()=>{
    const earlierDownloads=new Set(await readdir(downloadDir))
    await owner.press('Download Markdown');await owner.read(1500)
    let file;for(let i=0;i<40;i++){file=(await readdir(downloadDir)).find(n=>n.endsWith('.md')&&!earlierDownloads.has(n));if(file)break;await sleep(200)}
    if(!file)throw Error('Actual download missing')
    const downloaded=await readFile(join(downloadDir,file),'utf8')
    const r=await fetch(origin+'/api/scope/export.md',{headers:{Authorization:'Bearer '+token}})
    check('download matches stored agreed version',downloaded===await r.text())
    check('export contains both names and version 2',downloaded.includes('Nadia')&&downloaded.includes('Raka')&&downloaded.includes('AGREED · v2'))
    const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f4efe4;color:#1b1a17}header{padding:18px 42px;border-bottom:1px solid #ccc;font:12px monospace;text-transform:uppercase;letter-spacing:.1em}pre{font:17px/1.6 monospace;white-space:pre-wrap;max-width:1080px;margin:28px 42px}</style><header>Actual downloaded file · ${file}</header><pre>${downloaded.replaceAll('&','&amp;').replaceAll('<','&lt;')}</pre>`
    await owner.go('data:text/html;charset=utf-8,'+encodeURIComponent(html));await owner.read(2300)
    await owner.scrollBy(590);await owner.read(2200)
    await owner.ev('window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"})');await owner.read(2600)
  })
  end=Date.now()/1000
} catch(e) {
  await owner.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile(join(outDir,'capture-error.png'),Buffer.from(r.data,'base64')))
  throw e
} finally {
  await owner.stop();await client.stop();await sleep(350)
  end??=Date.now()/1000
  await writeFile(join(outDir,'capture.json'),JSON.stringify({begin,end,scenes,checks,errors},null,2))
  // Preserve the frame manifest even if a later assertion needs adjustment.
  await writeFile(join(outDir,'frames.json'),JSON.stringify({begin,end,owner:owner.frames,client:client.frames}))
  await finish()
}
if(errors.length)throw Error('Browser runtime error')
if(process.env.SCOPEMATCH_SAVE_RAW==='1'){
  await encode(owner,join(outDir,'owner-raw.mp4'),begin,end,'scale=1920:1080,setsar=1')
  await encode(client,join(outDir,'client-raw.mp4'),begin,end,'scale=780:1688,setsar=1')
}
console.log('Capture completed; all real-flow evidence checks passed.')
