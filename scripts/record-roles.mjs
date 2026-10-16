// Record two synchronized footages of one synthetic tester session, one per role:
// the freelancer on a laptop (1920×1080) and the client on a phone (1080×1920).
// Actions are paced like a person: a visible cursor glides to each target, text
// is typed character by character, and pages are read before acting. The story
// follows devpost/test-scenario-ombak.md. This is synthetic: one agent plays
// both people, so it is footage and a UX check, never user-research evidence.
//
// Start the built app (default :8080) and a separate headless Chrome with
// --remote-debugging-port (default :9223) first. Output: ignored artifacts/footage/.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const origin = process.env.SCOPEMATCH_DEMO_ORIGIN ?? 'http://127.0.0.1:8080'
const cdp = process.env.SCOPEMATCH_CDP_ORIGIN ?? 'http://127.0.0.1:9223'
const outDir = resolve(process.env.SCOPEMATCH_FOOTAGE_OUTPUT ?? 'artifacts/footage')
const scratch = await mkdtemp(join(tmpdir(), 'scopematch-footage-'))
await mkdir(outDir, { recursive: true })

const { webSocketDebuggerUrl } = await (await fetch(`${cdp}/json/version`)).json()
const ws = new WebSocket(webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const frameHandlers = new Map()
const errors = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id) { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.j(Error(JSON.stringify(m.error))) : p.r(m.result); return }
  if (m.method === 'Page.screencastFrame') frameHandlers.get(m.sessionId)?.(m.params)
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
}
const send = (method, params = {}, sessionId) => new Promise((r, j) => {
  const n = ++id; pending.set(n, { r, j })
  setTimeout(() => { if (pending.delete(n)) j(Error(`CDP timeout ${method}`)) }, 30000)
  ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }))
})
const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = (min, max) => min + Math.random() * (max - min)
const contexts = []

// A cursor drawn into the page so it appears in the footage. It follows real
// mouse events, so hover effects in the app fire exactly as for a person.
const cursorScript = touch => `(() => {
  const add = () => {
    const c = document.createElement('div')
    c.id = '__tester_cursor'
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;transform:translate(-100px,-100px)'
    c.innerHTML = ${JSON.stringify(touch
      ? '<div style="width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(27,26,23,.18);border:2px solid rgba(27,26,23,.55)"></div>'
      : '<svg width="26" height="26" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))"><path d="M4 2l15 11.2-6.6.9 3.9 7.4-2.7 1.4-3.9-7.5L4 20z" fill="#1b1a17" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>')}
    document.documentElement.appendChild(c)
    addEventListener('mousemove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)' }, true)
    addEventListener('mousedown', e => {
      const r = document.createElement('div')
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;left:' + (e.clientX - 22) + 'px;top:' + (e.clientY - 22) + 'px;width:44px;height:44px;border-radius:50%;border:2px solid #d9472b;opacity:.9;transition:transform .45s ease-out,opacity .45s ease-out'
      document.documentElement.appendChild(r)
      requestAnimationFrame(() => { r.style.transform = 'scale(1.6)'; r.style.opacity = '0' })
      setTimeout(() => r.remove(), 500)
    }, true)
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', add) : add()
})()`

async function person(name, { width, height, scale, touch }) {
  const { browserContextId } = await send('Target.createBrowserContext'); contexts.push(browserContextId)
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (m, p = {}) => send(m, p, sessionId)
  await call('Runtime.enable'); await call('Page.enable')
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: !!touch })
  await call('Page.addScriptToEvaluateOnNewDocument', { source: cursorScript(touch) })
  // Hide link values in footage; the links still work.
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='input[readonly],[data-secret]{color:transparent!important}';document.head.append(s)})` })

  const frames = []
  frameHandlers.set(sessionId, async p => {
    const path = join(scratch, `${name}-${String(frames.length).padStart(6, '0')}.jpg`)
    frames.push({ path, t: p.metadata.timestamp })
    writeFile(path, Buffer.from(p.data, 'base64'))
    call('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {})
  })

  const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(`${name}: ${x}\n${r.exceptionDetails.exception?.description}`); return r.result.value }
  const until = async (x, what = x, ms = 60000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(x)) return; await sleep(200) } throw Error(`${name} timeout: ${what}`) }
  let mouse = { x: width * 0.6, y: height * 0.7 }

  // `find` is a JS expression that yields an element.
  async function rectOf(find) {
    return ev(`(()=>{const el=(${find});if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})()`)
  }
  async function bringIntoView(find) {
    const r = await rectOf(find)
    if (!r) throw Error(`${name}: missing ${find}`)
    if (r.y < 70 || r.y + Math.min(r.h, 120) > height - 30) {
      await ev(`(${find}).scrollIntoView({block:'center',behavior:'smooth'})`)
      await sleep(900)
    }
    return rectOf(find)
  }
  async function glide(x, y) {
    const steps = Math.max(10, Math.round(Math.hypot(x - mouse.x, y - mouse.y) / 28))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mouse.x + (x - mouse.x) * e, y: mouse.y + (y - mouse.y) * e })
      await sleep(16)
    }
    mouse = { x, y }
  }
  async function hover(find, dwell = 1200) {
    await until(`!!(${find})`, find)
    const r = await bringIntoView(find)
    await glide(r.x + r.w * jitter(.35, .6), r.y + Math.min(r.h * .5, 60))
    await sleep(dwell)
  }
  async function click(find, what = find) {
    await until(`(()=>{const el=(${find});return !!el&&!el.disabled})()`, what)
    // The page re-renders while polling, so re-check the target is still
    // under the cursor before pressing; a person would re-aim too.
    let x, y
    for (let attempt = 0; ; attempt++) {
      const r = await bringIntoView(find)
      x = r.x + r.w * jitter(.4, .6); y = r.y + r.h * jitter(.4, .6)
      await glide(x, y); await sleep(jitter(120, 260))
      const onTarget = await ev(`(()=>{const el=(${find});const hit=document.elementFromPoint(${x},${y});return !!el&&!!hit&&(el===hit||el.contains(hit))})()`)
      if (onTarget) break
      if (attempt === 4) throw Error(`${name}: could not aim at ${what}; at point: ${await ev(`(()=>{const h=document.elementFromPoint(${x},${y});return h?h.outerHTML.slice(0,160):'nothing'})()`)}; target: ${await ev(`(()=>{const el=(${find});const r=el.getBoundingClientRect();return el.outerHTML.slice(0,120)+' rect '+[r.x,r.y,r.width,r.height].map(Math.round)})()`)} point ${Math.round(x)},${Math.round(y)}`)
      await sleep(400)
    }
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await sleep(70)
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    await sleep(jitter(450, 750))
  }
  const button = (text, scope = 'document') => `[...(${scope === 'document' ? 'document' : `document.querySelector(${JSON.stringify(scope)})`}?.querySelectorAll('button,a')??[])].find(b=>b.textContent.trim().includes(${JSON.stringify(text)})&&b.getClientRects().length>0)`
  const press = (text, scope) => click(button(text, scope), `button "${text}"`)
  // Paging buttons exist only on phone widths; desktop shows every question.
  const pressIfShown = async text => { if (await ev(`!!(${button(text)})`)) await press(text) }
  const option = (n, v) => `document.querySelector('input[name="${n}"][value="${v}"]')?.closest('label')`
  async function type(text) {
    for (const ch of text) {
      await call('Input.insertText', { text: ch })
      await sleep(/[ ,.]/.test(ch) ? jitter(90, 220) : jitter(38, 105))
    }
    await sleep(jitter(350, 700))
  }
  async function fill(selector, text) {
    await click(`document.querySelector(${JSON.stringify(selector)})`, selector)
    // Select whatever is already there so typing replaces it, like Cmd+A.
    await ev(`document.querySelector(${JSON.stringify(selector)}).select()`)
    await sleep(250)
    await type(text)
  }
  async function read(ms) { await sleep(ms) }
  async function scrollBy(dy) { await ev(`window.scrollBy({top:${dy},behavior:'smooth'})`); await sleep(1100) }
  async function top() { await ev(`window.scrollTo({top:0,behavior:'smooth'})`); await sleep(1000) }
  const start = () => call('Page.startScreencast', { format: 'jpeg', quality: 86, everyNthFrame: 1 })
  const stop = () => call('Page.stopScreencast').catch(() => {})
  const go = async url => { await call('Page.navigate', { url }); await sleep(900); await glide(mouse.x, mouse.y) }
  return { name, ev, until, hover, click, press, pressIfShown, option, type, fill, read, scrollBy, top, start, stop, go, frames, width }
}

const raka = await person('freelancer', { width: 1280, height: 720, scale: 1.5 })
const nadia = await person('client', { width: 390, height: 844, scale: 2, touch: true })
const brief = 'Ombak is a small surf school in Canggu. We need a website where tourists can book surf lessons, in English and Indonesian. We want to update our lesson schedule and prices ourselves. Most of our photos are on Instagram.'
const region = title => `section[aria-label="Decision for ${title}"]`
const waitFor = (p, text, scope) => p.until(`!!(${`[...(${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document'}?.querySelectorAll('button')??[])].find(b=>b.textContent.includes(${JSON.stringify(text)})&&!b.disabled)`})`, `${p.name} sees "${text}"`, 90000)
let t0, t1
try {
  await raka.go(`${origin}/new`)
  await nadia.go('about:blank')
  await nadia.ev("document.body.style.background='#f4efe4'")
  await raka.start(); await nadia.start()
  t0 = Date.now() / 1000
  console.log('Freelancer creates the project')
  await raka.read(2500)
  await raka.fill('#name', 'Ombak surf school website')
  await raka.fill('#freelancerName', 'Raka')
  await raka.fill('#clientName', 'Nadia')
  await raka.click("document.querySelector('#brief')", 'brief')
  await raka.type(brief)
  await raka.read(1200)
  await raka.press('Read the brief')
  await raka.until("document.body.innerText.includes('Lock questions')")
  await raka.read(2500)
  console.log('Freelancer checks where each question came from')
  for (const card of ['booking', 'languages', 'editable', 'launch-content']) await raka.hover(`document.querySelector('[data-card="${card}"]')`, 1700)
  await raka.press('Lock questions & get links')
  await raka.until("document.querySelectorAll('input[readonly]').length===2")
  const clientURL = await raka.ev("document.querySelectorAll('input[readonly]')[1].value")
  await raka.read(1500)
  await raka.hover(`document.querySelector('a[href^="https://wa.me/"]')`, 2500)

  console.log('Client opens the private link')
  await nadia.go(clientURL)
  await nadia.until("document.body.innerText.includes('Before work starts')")
  await nadia.read(4500)
  await nadia.press('Start answering')
  await nadia.until("document.body.innerText.includes('What do you have in mind?')")
  await nadia.read(2000)

  console.log('Freelancer answers and seals')
  await raka.press('Answer the questions')
  await raka.read(1500)
  for (const [card, choice] of [['booking', 'a'], ['languages', 'c'], ['editable', 'b'], ['launch-content', 'b']]) {
    await raka.until(`!!(${raka.option(card, choice)})`, `${card} visible`)
    await raka.read(1400)
    await raka.click(raka.option(card, choice), `${card} ${choice}`)
    if (card !== 'launch-content') await raka.pressIfShown('Next')
  }
  await raka.press('Seal my answers')
  await raka.until("document.body.innerText.includes('Sealed. Waiting for')")
  await raka.read(2500)

  console.log('Client answers on the phone and seals')
  for (const [card, choice] of [['booking', 'c'], ['languages', 'b'], ['editable', 'unsure'], ['launch-content', 'b']]) {
    await nadia.until(`!!(${nadia.option(card, choice)})`, `${card} visible`)
    await nadia.read(1600)
    await nadia.click(nadia.option(card, choice), `${card} ${choice}`)
    if (card !== 'launch-content') await nadia.pressIfShown('Next')
  }
  await nadia.press('Seal my answers')

  console.log('Reveal')
  await nadia.until("document.querySelectorAll('[data-reveal]').length>=2")
  await raka.until("document.querySelectorAll('[data-reveal]').length>=2", 'freelancer reveal', 30000)
  await raka.read(3500); await nadia.read(2000)
  await raka.hover(`document.querySelector('[aria-label="Different answers"]')`, 2500)
  await raka.scrollBy(380); await raka.read(2500)
  await nadia.scrollBy(500); await nadia.read(2000)

  console.log('Booking: propose, counter, counter, confirm')
  await raka.press('Propose a decision', region('Booking'))
  await raka.click(raka.option('proposal-booking', 'a'))
  await raka.click(`document.querySelector('${region('Booking')} textarea:not([required])')`, 'why')
  await raka.type("Cheapest to build, and you already reply on WhatsApp.")
  await raka.press('Send proposal', region('Booking'))
  await waitFor(nadia, 'Counter-propose', region('Booking'))
  await nadia.read(2500)
  await nadia.press('Counter-propose', region('Booking'))
  await nadia.click(nadia.option('proposal-booking', 'c'))
  await nadia.click(`document.querySelector('${region('Booking')} textarea:not([required])')`, 'why')
  await nadia.type("Tourists book from abroad at night. They won't wait for a chat reply.")
  await nadia.press('Send proposal', region('Booking'))
  await raka.until(`document.querySelector('${region('Booking')}')?.textContent.includes('Proposed by Nadia')`, 'counter arrives', 30000)
  await raka.read(3000)
  await raka.press('Counter-propose', region('Booking'))
  await raka.click(raka.option('proposal-booking', 'b'))
  await raka.click(`document.querySelector('${region('Booking')} textarea:not([required])')`, 'why')
  await raka.type("Lessons depend on swell and tides, so staff must confirm each slot.")
  await raka.press('Send proposal', region('Booking'))
  await nadia.until(`document.querySelector('${region('Booking')}')?.textContent.includes('Proposed by Raka')`, 'counter arrives', 30000)
  await nadia.read(3500)
  await nadia.press('Confirm decision', region('Booking'))
  await raka.read(3000)

  console.log('Languages: client proposes, freelancer writes a custom decision')
  await nadia.press('Propose a decision', region('Languages'))
  await nadia.click(nadia.option('proposal-languages', 'b'))
  await nadia.press('Send proposal', region('Languages'))
  await waitFor(raka, 'Counter-propose', region('Languages'))
  await raka.read(2000)
  await raka.press('Counter-propose', region('Languages'))
  await raka.click(raka.option('proposal-languages', 'other'))
  await raka.click(`document.querySelector('${region('Languages')} textarea[required]')`, 'custom')
  await raka.type('Every page in both languages. Nadia translates class descriptions; Raka translates the rest.')
  await raka.press('Send proposal', region('Languages'))
  await waitFor(nadia, 'Confirm decision', region('Languages'))
  await nadia.read(3000)
  await nadia.press('Confirm decision', region('Languages'))

  console.log('Editable content: client writes what she meant')
  await nadia.press('Propose a decision', region('Editable content'))
  await nadia.click(nadia.option('proposal-editable', 'other'))
  await nadia.click(`document.querySelector('${region('Editable content')} textarea[required]')`, 'custom')
  await nadia.type('Lesson schedule and prices only.')
  await nadia.press('Send proposal', region('Editable content'))
  await waitFor(raka, 'Confirm decision', region('Editable content'))
  await raka.read(2500)
  await raka.press('Confirm decision', region('Editable content'))

  console.log('Launch content: same answer, both confirm')
  await raka.press('Confirm decision', region('Launch content'))
  await waitFor(nadia, 'Confirm decision', region('Launch content'))
  await nadia.press('Confirm decision', region('Launch content'))
  await raka.until(`!!document.querySelector('[aria-label="4 of 4 decided"]')`, 'all decided', 30000)
  await raka.top(); await raka.read(3000)

  console.log('Scope v1, then v2 after a phone call')
  await raka.press('Review scope')
  await raka.until("!!document.querySelector('textarea[aria-label=Included]')")
  await raka.read(2500); await raka.scrollBy(450); await raka.read(2500); await raka.scrollBy(450); await raka.read(2000)
  await raka.press('Send for confirmation')
  await raka.fill('form input[autocomplete=name]', 'Raka')
  await raka.press('Confirm scope v1')
  await waitFor(nadia, 'View scope')
  await nadia.press('View scope')
  await nadia.until("document.body.innerText.includes('Confirm scope v1')")
  await nadia.read(2500); await nadia.scrollBy(600); await nadia.read(3000)
  await raka.press('Edit as a new version')
  await raka.click(`document.querySelector('textarea[aria-label="Open questions"]')`, 'open questions')
  await raka.type('Who cancels lessons when the swell is too big or too flat, and how are customers told?')
  await raka.press('Send for confirmation')
  await raka.fill('form input[autocomplete=name]', 'Raka')
  await raka.press('Confirm scope v2')
  await nadia.until("document.body.innerText.includes('Confirm scope v2')", 'v2 arrives', 30000)
  await nadia.read(2500)
  await nadia.fill('form input[autocomplete=name]', 'Nadia')
  await nadia.press('Confirm scope v2')

  console.log('Agreed')
  await nadia.until("document.body.innerText.includes('Download Markdown')")
  await raka.until("document.body.innerText.includes('The agreed scope.')", 'agreed', 30000)
  await raka.top(); await nadia.top()
  await raka.read(3500)
  await raka.press('Download Markdown'); await nadia.press('Download Markdown')
  await raka.top(); await nadia.top()
  await raka.read(3000)
  t1 = Date.now() / 1000
} finally {
  await raka.stop(); await nadia.stop()
  await sleep(500)
  for (const c of contexts) await send('Target.disposeBrowserContext', { browserContextId: c }).catch(() => {})
  ws.close()
}
if (errors.length) throw Error(`Browser errors: ${errors.join('; ')}`)

async function encode(p, file, filter) {
  const frames = p.frames.filter(f => f.t >= t0 - 1)
  const q = s => s.replaceAll("'", "'\\''")
  let list = 'ffconcat version 1.0\n'
  for (let i = 0; i < frames.length; i++) {
    const end = frames[i + 1]?.t ?? t1
    const begin = i === 0 ? t0 : frames[i].t
    list += `file '${q(frames[i].path)}'\nduration ${Math.max(0.001, end - begin).toFixed(4)}\n`
  }
  list += `file '${q(frames.at(-1).path)}'\n`
  const manifest = join(scratch, `${p.name}.ffconcat`)
  await writeFile(manifest, list)
  await new Promise((r, j) => {
    const f = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', manifest, '-vf', filter, '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file], { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''; f.stderr.on('data', d => { err += d }); f.on('exit', c => c === 0 ? r() : j(Error(err)))
  })
  console.log(`Saved ${file} (${frames.length} frames, ${(t1 - t0).toFixed(1)}s)`)
}
const paper = 'color=0xf4efe4'
await encode(raka, join(outDir, 'freelancer-laptop.mp4'), `scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:${paper},setsar=1`)
await encode(nadia, join(outDir, 'client-phone.mp4'), `scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:${paper},setsar=1`)
console.log('Both footages share one clock: place them side by side from 0:00 to stay in sync. No upload performed.')
