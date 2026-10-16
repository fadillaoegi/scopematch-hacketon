// Browser/capture adapter shared by the submission-film walkthrough.
// Derived from the existing human-paced recorder; isolated contexts only.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const origin = process.env.SCOPEMATCH_DEMO_ORIGIN ?? 'http://127.0.0.1:8080'
const cdp = process.env.SCOPEMATCH_CDP_ORIGIN ?? 'http://127.0.0.1:9223'
const outDir = resolve(process.env.SCOPEMATCH_FILM_OUTPUT ?? 'artifacts/submission-demo')
const scratch = await mkdtemp(join(tmpdir(), 'scopematch-footage-'))
await mkdir(outDir, { recursive: true })

const { webSocketDebuggerUrl } = await (await fetch(`${cdp}/json/version`)).json()
const ws = new WebSocket(webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const frameHandlers = new Map()
const errors = []
const frameWrites = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id) { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); clearTimeout(p.timer); m.error ? p.j(Error(JSON.stringify(m.error))) : p.r(m.result); return }
  if (m.method === 'Page.screencastFrame') frameHandlers.get(m.sessionId)?.(m.params)
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
}
const send = (method, params = {}, sessionId) => new Promise((r, j) => {
  const n = ++id
  const timer = setTimeout(() => { if (pending.delete(n)) j(Error(`CDP timeout ${method}`)) }, 30000)
  pending.set(n, { r, j, timer })
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
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='input[readonly],textarea[readonly],[data-secret]{filter:blur(6px)!important}';document.head.append(s)})` })

  const frames = []
  frameHandlers.set(sessionId, async p => {
    const path = join(scratch, `${name}-${String(frames.length).padStart(6, '0')}.jpg`)
    frames.push({ path, t: p.metadata.timestamp })
    frameWrites.push(writeFile(path, Buffer.from(p.data, 'base64')))
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
      await sleep(/[ ,.]/.test(ch) ? jitter(50, 105) : jitter(30, 65))
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
  const start = () => call('Page.startScreencast', { format: 'jpeg', quality: 86, everyNthFrame: 2 })
  const stop = () => call('Page.stopScreencast').catch(() => {})
  const go = async url => { await call('Page.navigate', { url }); await sleep(900); await glide(mouse.x, mouse.y) }
  return { name, ev, until, hover, click, press, pressIfShown, option, type, fill, read, scrollBy, top, start, stop, go, frames, width, call, contextId: browserContextId }
}


async function finish() {
  await Promise.all(frameWrites)
  for (const c of contexts) await send('Target.disposeBrowserContext', { browserContextId: c }).catch(() => {})
  ws.close()
}
async function encode(p, file, begin, end, filter) {
  const frames = p.frames.filter(f => f.t >= begin - 1 && f.t <= end)
  if (!frames.length) throw Error('No capture frames for '+p.name)
  let list = 'ffconcat version 1.0\n'
  for (let i=0;i<frames.length;i++) {
    const a=i===0?begin:Math.max(begin,frames[i].t)
    const b=frames[i+1]?.t??end
    list+=`file '${frames[i].path.replaceAll("'", "'\\''")}'\nduration ${Math.max(.001,b-a).toFixed(4)}\n`
  }
  list+=`file '${frames.at(-1).path}'\n`
  const manifest=join(scratch,p.name+'.ffconcat')
  await writeFile(manifest,list)
  await new Promise((r,j)=>{
    const f=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',manifest,'-vf',filter,'-r','30','-fps_mode','cfr','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-an',file],{stdio:['ignore','ignore','pipe']})
    let error='';f.stderr.on('data',d=>{error+=d});f.on('error',j);f.on('exit',c=>c===0?r():j(Error(error)))
  })
  console.log('Saved raw '+p.name+' footage ('+(end-begin).toFixed(2)+'s)')
}
export {person,send,sleep,errors,finish,encode,origin,outDir,writeFile,mkdir,join}
