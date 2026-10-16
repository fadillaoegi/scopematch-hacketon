// Real app print-button click followed by Chrome's configured Save-as-PDF
// destination. No Page.printToPDF substitution or fabricated document/viewer.
import {readFile,readdir,stat} from 'node:fs/promises'
import {person,finish,encode,writeFile,sleep,send,errors} from './browser.mjs'
const root='artifacts/pdf-demo'
const fixture=JSON.parse(await readFile(root+'/session.json','utf8'))
const {resolve}=await import('node:path')
const directory=resolve(root,'output')
const initial=new Set(await readdir(directory))
const p=await person('print-click',{width:1280,height:720,scale:1.5})
await p.go(fixture.url)
await p.until("document.body.textContent.includes('Print / Save as PDF')")
await p.hover(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Print / Save as PDF'))`,500)
await p.start();const begin=Date.now()/1000
await p.read(1000)
await p.press('Print / Save as PDF')
let pdf
for(let i=0;i<150;i++){
 pdf=(await readdir(directory)).find(n=>n.toLowerCase().endsWith('.pdf')&&!initial.has(n))
 if(pdf&&(await stat(directory+'/'+pdf)).size>1000)break
 await sleep(200)
}
if(!pdf)throw Error('Chrome did not save the actual printed PDF')
await p.read(1200);await p.stop();const clickEnd=Date.now()/1000
await writeFile(root+'/print-click-frames.json',JSON.stringify({begin,end:clickEnd,frames:p.frames}))
await p.go('file://'+directory+'/'+pdf)
await p.read(2500)
await p.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile(root+'/pdf-viewer.png',Buffer.from(r.data,'base64')))
// Start after the actual PDF plugin has loaded, then scroll through the file.
const {targetInfos}=await send('Target.getTargets')
const viewerTarget=targetInfos.find(t=>t.url.startsWith('file://')&&t.url.endsWith('.pdf'))
await p.start();const viewBegin=Date.now()/1000
await p.read(2600)
await p.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:970,y:480})
await p.call('Input.dispatchMouseEvent',{type:'mouseWheel',x:970,y:480,deltaX:0,deltaY:570})
await p.read(1600)
await p.call('Input.dispatchMouseEvent',{type:'mouseWheel',x:970,y:480,deltaX:0,deltaY:800})
await p.read(2200);await p.stop();const viewEnd=Date.now()/1000
await writeFile(root+'/pdf-view-frames.json',JSON.stringify({begin:viewBegin,end:viewEnd,frames:p.frames.filter(f=>f.t>=viewBegin-.1)}))
await writeFile(root+'/capture.json',JSON.stringify({pdf:directory+'/'+pdf,printClick:{begin,end:clickEnd},viewer:{begin:viewBegin,end:viewEnd,nativePdfViewer:!!viewerTarget},errors},null,2))
await finish()
await encode(p,root+'/print-click-raw.mp4',begin,clickEnd,'scale=1920:1080,setsar=1')
await encode(p,root+'/pdf-view-raw.mp4',viewBegin,viewEnd,'scale=1920:1080,setsar=1')
console.log('Actual print-button click, real saved PDF, and native PDF viewer recorded.')
