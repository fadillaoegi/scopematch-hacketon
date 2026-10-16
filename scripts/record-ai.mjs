// Record the optional AI question flow against the running app and its real
// configured provider. No mocked responses, generated captions, or narration.
// Uses a new isolated Chrome context; never reads an API key or a normal profile.
// Start the built server and Chrome CDP first (see README > Checks).
// Outputs an ignored MP4, screenshots, and factual capture metadata.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const origin = process.env.SCOPEMATCH_DEMO_ORIGIN ?? 'http://127.0.0.1:8080'
const cdp = process.env.SCOPEMATCH_CDP_ORIGIN ?? 'http://127.0.0.1:9223'
const out = resolve(process.env.SCOPEMATCH_AI_OUTPUT ?? 'artifacts/ai-demo')
const scratch = await mkdtemp(join(tmpdir(), 'scopematch-ai-capture-'))
await mkdir(out, { recursive: true })
const { webSocketDebuggerUrl } = await (await fetch(`${cdp}/json/version`)).json()
const ws = new WebSocket(webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0
const pending = new Map()
const browserErrors = []
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data)
  if (m.method === 'Runtime.exceptionThrown') browserErrors.push(m.params.exceptionDetails.text)
  const p = pending.get(m.id)
  if (!p) return
  pending.delete(m.id); clearTimeout(p.timer)
  m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result)
}
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq
  const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)) }, 20000)
  pending.set(id, { resolve, reject, timer })
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
})
const sleep = ms => new Promise(r => setTimeout(r, ms))
let context, sessionId, capturing = false, captureTask, captureError, started
const frames = [], stages = [], checks = []
const call = (m, p) => send(m, p, sessionId)
const ev = async expression => {
  const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw Error('Browser evaluation failed')
  return r.result.value
}
const until = async (expr, label, ms = 20000) => {
  const end = Date.now() + ms
  while (Date.now() < end) { if (await ev(expr)) return; await sleep(200) }
  throw Error(`Timed out: ${label}`)
}
const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); console.log(`PASS ${label}`) }
const findButton = text => `[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)})&&!b.disabled)`
async function click(find, label) {
  await until(`!!(${find})`, label)
  await ev(`(${find}).scrollIntoView({block:'center',behavior:'smooth'})`)
  await sleep(900)
  const r = await ev(`(()=>{const r=(${find}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...r })
  await sleep(250)
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...r, button: 'left', clickCount: 1 })
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...r, button: 'left', clickCount: 1 })
  await sleep(900)
}
const press = text => click(findButton(text), text)
const mark = action => { stages.push({ seconds: +(Date.now() / 1000 - started).toFixed(2), action }); console.log(action) }
async function screenshot(name) {
  const { data } = await call('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(out, `${name}.png`), Buffer.from(data, 'base64'))
}
let duration
try {
  context = (await send('Target.createBrowserContext')).browserContextId
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId: context })
  sessionId = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId
  await call('Runtime.enable'); await call('Page.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='input[readonly],[data-secret]{color:transparent!important}';document.head.append(s)})` })
  await call('Page.navigate', { url: `${origin}/new` })
  await until("!!document.querySelector('#brief')", 'new project')
  const form = { name: 'Bakery website', freelancerName: 'Dimas', clientName: 'Maya', brief: 'We need a bakery website with a cake gallery, local delivery, allergen information, and custom cake orders.' }
  for (const [id, value] of Object.entries(form)) {
    await ev(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  }
  started = Date.now() / 1000; capturing = true
  captureTask = (async () => {
    try {
      while (capturing) {
        const time = Date.now() / 1000
        const { data } = await call('Page.captureScreenshot', { format: 'jpeg', quality: 85 })
        const path = join(scratch, `${String(frames.length).padStart(6, '0')}.jpg`)
        await writeFile(path, Buffer.from(data, 'base64')); frames.push({ time, path })
        await sleep(200)
      }
    } catch (err) { captureError = err }
  })()
  mark('Create a bakery project')
  await sleep(3000); await press('Read the brief')
  await until("!!document.querySelector('#ai-heading')", 'AI configured on this server')
  check(await ev("document.body.textContent.includes('Google Gemini')"), 'Privacy disclosure is visible before requesting AI')
  mark('Review optional AI disclosure')
  await ev("document.querySelector('#ai-heading').closest('section').scrollIntoView({block:'center',behavior:'smooth'})")
  await sleep(4000); await screenshot('01-privacy')
  mark('Request real provider suggestions')
  await press('Suggest questions with AI')
  await until("document.querySelectorAll('[aria-labelledby=ai-heading] article').length>0", 'real AI suggestions', 150000)
  const titles = await ev("[...document.querySelectorAll('[aria-labelledby=ai-heading] article h4')].map(x=>x.textContent)")
  check(titles.length > 0 && titles.length <= 3, 'Provider returned one to three drafts')
  mark('Review generated questions and option scope details')
  await sleep(3500)
  await click("document.querySelector('[aria-labelledby=ai-heading] article details summary')", 'review option details')
  check(await ev("document.querySelector('[aria-labelledby=ai-heading] article details[open]').textContent.includes('Acceptance criteria')"), 'Scope and acceptance criteria can be reviewed before Add')
  await sleep(5000); await screenshot('02-review')
  await click("document.querySelector('[aria-labelledby=ai-heading] article details summary')", 'close details')
  if (titles.length > 1) {
    mark('Discard one draft')
    await click("[...document.querySelectorAll('[aria-labelledby=ai-heading] article')].at(-1).querySelector('.btn-link')", 'Discard last draft')
    await sleep(1800)
    check(await ev(`document.querySelectorAll('[aria-labelledby=ai-heading] article').length===${titles.length - 1}`), 'Discard removes the draft')
  }
  mark('Add a reviewed draft to this project')
  await press('Add to questions')
  await until("document.body.textContent.includes('Suggested by AI · added by you')", 'accepted question')
  check(await ev("document.body.textContent.includes('Suggested by AI · added by you')"), 'Accepted question is labelled with AI origin')
  await ev("[...document.querySelectorAll('[data-card]')].find(x=>x.textContent.includes('Suggested by AI')).scrollIntoView({block:'center',behavior:'smooth'})")
  await sleep(4000); await screenshot('03-added')
  mark('Reload and check the accepted question persists')
  await call('Page.reload')
  await until("document.body.textContent.includes('Suggested by AI · added by you')", 'persisted AI question')
  check(true, 'Accepted question persists after reload')
  await ev("[...document.querySelectorAll('[data-card]')].find(x=>x.textContent.includes('Suggested by AI')).scrollIntoView({block:'center',behavior:'smooth'})")
  await sleep(3500)
  check(await ev('document.documentElement.scrollWidth<=innerWidth'), 'No horizontal overflow')
  check(browserErrors.length === 0, 'No browser runtime exceptions')
  await writeFile(join(out, 'recording.json'), JSON.stringify({ source: origin, synthetic: true, provider: 'Configured live provider; no response interception', audio: false, generatedCaptions: false, resolution: '1920x1200', stages, suggestedQuestions: titles, checks }, null, 2))
} finally {
  capturing = false
  await captureTask
  duration = Date.now() / 1000 - started
  if (context) await send('Target.disposeBrowserContext', { browserContextId: context }).catch(() => {})
  ws.close()
}
if (captureError) throw captureError
if (!frames.length) throw Error('No frames captured')
let list = 'ffconcat version 1.0\n'
for (let i = 0; i < frames.length; i++) {
  const end = frames[i + 1]?.time ?? started + duration
  list += `file '${frames[i].path.replaceAll("'", "'\\''")}'\nduration ${Math.max(.001, end - frames[i].time).toFixed(4)}\n`
}
list += `file '${frames.at(-1).path.replaceAll("'", "'\\''")}'\n`
const manifest = join(scratch, 'frames.ffconcat')
await writeFile(manifest, list)
const output = join(out, 'scopematch-ai.mp4')
await new Promise((r, j) => {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', manifest, '-vf', 'scale=1920:1200,setsar=1', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', output], { stdio: ['ignore', 'ignore', 'pipe'] })
  let error = ''; p.stderr.on('data', d => { error += d }); p.on('error', j); p.on('exit', c => c === 0 ? r() : j(Error(error)))
})
console.log(`Saved ${output} (${duration.toFixed(1)}s). Silent supplementary footage; no upload performed.`)
