// Re-record the initial form against the actual build after removing the example
// shortcut. No UI erasing or painted-over controls in the video.
import {person,finish,encode,writeFile,join,outDir,sleep,errors} from './browser.mjs'
const p=await person('brief-pickup',{width:1280,height:720,scale:1.5})
await p.go('http://127.0.0.1:8092/new')
await p.until("!!document.querySelector('#brief')")
if(await p.ev("document.body.textContent.includes('Use the salon example')"))throw Error('Old example shortcut is still present')
await p.start();const begin=Date.now()/1000
try{
 await p.read(500)
 await p.fill('#name','Ombak surf school')
 await p.fill('#freelancerName','Raka');await p.fill('#clientName','Nadia')
 await p.click("document.querySelector('#brief')")
 await p.call('Input.insertText',{text:'We need a surf school website with online booking and two languages. Guests should also be able to choose a lesson level.'})
 await p.read(900);await p.press('Read the brief')
 await p.until("document.body.textContent.includes('Lock questions')")
 await p.read(300)
}finally{await p.stop();await sleep(300)}
const end=Date.now()/1000
await writeFile(join(outDir,'brief-capture.json'),JSON.stringify({begin,end,duration:end-begin,exampleShortcut:false,errors},null,2))
await finish()
await encode(p,join(outDir,'brief-raw.mp4'),begin,end,'scale=1920:1080,setsar=1')
