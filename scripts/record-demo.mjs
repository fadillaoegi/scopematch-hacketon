// Record the approved salon workflow from real local UI sessions. No narration,
// captions, external uploads, or access to the user's normal browser profile.
// Start the built app on :8080 and a separate Chrome CDP instance on :9223 first.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'

const origin = process.env.SCOPEMATCH_DEMO_ORIGIN ?? 'http://127.0.0.1:8080'
const cdp = process.env.SCOPEMATCH_CDP_ORIGIN ?? 'http://127.0.0.1:9223'
const output = resolve(process.env.SCOPEMATCH_DEMO_OUTPUT ?? 'artifacts/demo/scopematch-demo.mp4')
const scratch = await mkdtemp(join(tmpdir(), 'scopematch-recording-'))
await mkdir(resolve(output, '..'), { recursive: true })
const { webSocketDebuggerUrl } = await (await fetch(`${cdp}/json/version`)).json()
const ws = new WebSocket(webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let id = 0
const pending = new Map()
const runtimeErrors = []
ws.onmessage = event => {
  const m = JSON.parse(event.data)
  if (m.id) {
    const p = pending.get(m.id)
    if (!p) return
    pending.delete(m.id)
    clearTimeout(p.timer)
    m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result)
  } else if (m.method === 'Runtime.exceptionThrown') runtimeErrors.push(m.params.exceptionDetails.text)
}
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const n = ++id
    const timer = setTimeout(() => { pending.delete(n); reject(Error(`CDP timeout: ${method}`)) }, 20000)
    pending.set(n, { resolve, reject, timer })
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const contexts = []
async function page(width, height, mobile = false, scale = 1) {
  const { browserContextId } = await send('Target.createBrowserContext')
  contexts.push(browserContextId)
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params = {}) => send(method, params, sessionId)
  await call('Runtime.enable')
  await call('Page.enable')
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile })
  // Redact link values before their first rendered frame. The link buttons and
  // real access-control behavior remain intact; only demo URLs are concealed.
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='input[readonly]{color:transparent!important;text-shadow:none!important}';document.head.append(s)})` })
  async function evaluate(expression) {
    const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  async function until(expression) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(150) }
    throw Error(`UI timeout: ${expression}`)
  }
  async function click(text, selector = 'body') {
    const find = `[...document.querySelector(${JSON.stringify(selector)})?.querySelectorAll('button')??[]].find(b=>b.textContent.includes(${JSON.stringify(text)})&&!b.disabled)`
    await until(`!!(${find})`)
    await evaluate(`(${find}).scrollIntoView({block:'center',behavior:'instant'})`)
    await delay(650)
    await evaluate(`(${find}).click()`)
    await delay(650)
  }
  async function choose(name, value) {
    const selector = `input[name="${name}"][value="${value}"]:not(:disabled)`
    await until(`!!document.querySelector(${JSON.stringify(selector)})`)
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`)
    await delay(850)
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
    await delay(1000)
  }
  return { call, evaluate, until, click, choose }
}
let recording = false
let active
let captureBusy = false
let captureWork = Promise.resolve()
let captureFailure
const frames = []
const events = []
let start = 0
async function capture() {
  if (!recording || !active || captureBusy) return
  captureBusy = true
  try {
    const when = performance.now()
    const { data } = await active.call('Page.captureScreenshot', { format: 'jpeg', quality: 88, captureBeyondViewport: false })
    const path = join(scratch, `frame-${String(frames.length).padStart(6, '0')}.jpg`)
    await writeFile(path, Buffer.from(data, 'base64'))
    frames.push({ path, when })
  } catch (e) { captureFailure = e; recording = false }
  finally { captureBusy = false }
}
function phase(name) { events.push({ seconds: Math.round((performance.now() - start) / 100) / 10, action: name }); console.log(`Demo phase: ${name}`) }
async function top(p) { await p.evaluate("window.scrollTo({top:0,behavior:'instant'})"); await delay(500) }
async function inView(p, selector) { await p.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`); await delay(650) }
async function encode(manifest) {
  const filter = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4efe4,setsar=1'
  await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', manifest, '-vf', filter, '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-metadata', 'title=ScopeMatch', output], { stdio: ['ignore', 'ignore', 'pipe'] })
    let error = ''; p.stderr.on('data', chunk => { error += chunk.toString().slice(-3000) })
    p.on('error', reject); p.on('exit', code => code === 0 ? resolve() : reject(Error(`ffmpeg ${code}: ${error}`)))
  })
}
// A narrower CSS viewport rendered at a higher pixel ratio fills 1920×1080
// with larger, still-sharp text, so the video stays readable when watched small.
const owner = await page(1024, 576, false, 1920 / 1024)
const client = await page(390, 844, true, 1080 / 844)
let timer
try {
  await owner.call('Page.navigate', { url: `${origin}/new` })
  await owner.until("document.body.textContent.includes('Use the salon example')")
  active = owner; recording = true; start = performance.now()
  await capture()
  timer = setInterval(() => { captureWork = capture() }, 85)
  phase('Create project from salon brief')
  await delay(2500)
  await owner.click('Use the salon example')
  await delay(2500)
  await owner.click('Read the brief')
  await owner.until("document.body.textContent.includes('Lock questions & get links')")
  await top(owner)
  await delay(3000)
  // Keep Booking, the scenario approved for the demo; the rest remain in the
  // library. Selection is performed using the same visible UI as a real user.
  for (const n of [4, 3, 2]) {
    const find = `[...document.querySelectorAll('li')].find(li=>li.textContent.includes('§ ${n} ·')&&[...li.querySelectorAll('button')].some(b=>b.textContent.includes('Asking')&&!b.disabled))`
    await owner.until(`!!(${find})`)
    await owner.evaluate(`(${find}).scrollIntoView({block:'center',behavior:'instant'})`)
    await delay(750)
    await owner.evaluate(`[...(${find}).querySelectorAll('button')].find(b=>b.textContent.includes('Asking')).click()`)
    await delay(850)
  }
  await top(owner)
  await delay(2500)
  phase('Lock and open separate client link')
  await owner.click('Lock questions & get links')
  await owner.until("document.querySelectorAll('input[readonly]').length===2")
  const [ownerURL, clientURL] = await owner.evaluate("[...document.querySelectorAll('input[readonly]')].map(i=>i.value)")
  const ownerToken = new URL(ownerURL).pathname.split('/').pop()
  await client.call('Page.navigate', { url: clientURL })
  await client.until("document.body.textContent.includes('What do you have in mind?')")
  await delay(2500)
  await owner.click('Answer the questions')
  phase('Freelancer chooses A and seals')
  await owner.choose('booking', 'a')
  await owner.click('Seal my answers')
  await owner.until("document.body.textContent.includes('Sealed. Waiting for')")
  await top(owner); await delay(4500)
  active = client; await top(client); await delay(3500)
  phase('Client independently chooses C')
  await client.choose('booking', 'c')
  await client.click('Seal my answers')
  await client.until("document.querySelectorAll('[data-reveal]').length===2")
  await top(client); await delay(2000)
  active = owner
  await owner.until("document.querySelectorAll('[data-reveal]').length===2")
  await top(owner)
  phase('Reveal different expectations and booking previews')
  await delay(3500)
  await inView(owner, 'article'); await delay(6500)
  phase('Agree on booking B with two confirmations')
  const region = 'section[aria-label="Decision for Booking"]'
  await owner.click('Propose a decision', region)
  await owner.choose('proposal-booking', 'b')
  await owner.click('Send proposal', region)
  await delay(2200)
  active = client
  await client.click('Confirm decision', region)
  await delay(2200)
  active = owner
  await owner.until("!!document.querySelector('[aria-label=\"1 of 1 decided\"]')")
  await top(owner); await delay(3000)
  phase('Send a saved scope version')
  await owner.click('Review scope')
  await owner.until("!!document.querySelector('textarea[aria-label=Included]')")
  await top(owner); await delay(3500)
  await owner.click('Send for confirmation')
  await top(owner); await delay(3000)
  await owner.click('Confirm scope v1')
  await delay(2200)
  active = client
  await client.click('View scope')
  await client.until("document.body.textContent.includes('Confirm scope v1')")
  await top(client); await delay(2500)
  await client.click('Confirm scope v1')
  await client.until("document.body.textContent.includes('Download Markdown')")
  await top(client); await delay(2200)
  active = owner
  await owner.until("document.body.textContent.includes('Download Markdown')")
  await top(owner)
  phase('Both confirmed; AGREED and Markdown export')
  await delay(5000)
  await owner.click('Download Markdown')
  const exported = await owner.evaluate(`(async()=>{const r=await fetch('/api/scope/export.md',{headers:{Authorization:'Bearer '+${JSON.stringify(ownerToken)}}});if(!r.ok)throw Error('Export failed');return r.text()})()`)
  if (!exported.includes('AGREED · v1') || !exported.includes('Submit a request for staff approval')) throw Error('Unexpected agreed export')
  await writeFile(resolve(output, '..', 'agreed-scope.md'), exported)
  await top(owner)
  const remaining = Math.max(6000, 105000 - (performance.now() - start))
  await delay(Math.min(remaining, 15000))
  recording = false; clearInterval(timer); await captureWork
  if (captureFailure) throw captureFailure
  if (runtimeErrors.length) throw Error(`Browser errors: ${runtimeErrors.join(', ')}`)
  const duration = (performance.now() - start) / 1000
  if (duration >= 178 || duration < 60) throw Error(`Recording outside target duration: ${duration.toFixed(1)}s`)
  const quote = path => path.replaceAll("'", "'\\''")
  let manifest = 'ffconcat version 1.0\n'
  for (let i = 0; i < frames.length; i++) {
    const end = frames[i + 1]?.when ?? start + duration * 1000
    manifest += `file '${quote(frames[i].path)}'\nduration ${Math.max(.001, (end - frames[i].when) / 1000).toFixed(6)}\n`
  }
  manifest += `file '${quote(frames.at(-1).path)}'\n`
  const path = join(scratch, 'frames.ffconcat'); await writeFile(path, manifest)
  phase('Encode real screen capture')
  await encode(path)
  await writeFile(resolve(output, '..', 'recording.json'), JSON.stringify({ source: origin, durationSeconds: duration, frames: frames.length, resolution: '1920x1080', audio: false, overlayCaptions: false, stages: events, finalScope: 'agreed-scope.md', scratch }, null, 2))
  console.log(`Saved ${output}; ${duration.toFixed(1)}s, ${frames.length} actual captured frames. No upload performed.`)
} finally {
  recording = false; clearInterval(timer); await captureWork
  for (const browserContextId of contexts) await send('Target.disposeBrowserContext', { browserContextId }).catch(() => {})
  ws.close()
}
