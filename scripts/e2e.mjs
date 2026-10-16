// Two-role end-to-end test in real Chrome, using isolated browser contexts
// over the DevTools protocol: freelancer on a 1440px desktop, client on a
// 390px phone. Walks the salon journey from brief to AGREED export, probes
// access rules from the client page, and checks for horizontal overflow and
// runtime errors. Exits non-zero on any failure.
//
// Start the built app on :8080 and a separate headless Chrome on :9223 first
// (see README > Checks). Screenshots go to the ignored artifacts/ folder.
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const origin = process.env.SCOPEMATCH_E2E_ORIGIN ?? 'http://127.0.0.1:8080'
const cdp = process.env.SCOPEMATCH_CDP_ORIGIN ?? 'http://127.0.0.1:9223'
const shots = resolve(process.env.SCOPEMATCH_E2E_OUTPUT ?? 'artifacts/e2e')
// Start clean so a renumbered screenshot never leaves a stale file behind.
await rm(shots, { recursive: true, force: true })
await mkdir(shots, { recursive: true })

const { webSocketDebuggerUrl } = await (await fetch(`${cdp}/json/version`)).json()
const ws = new WebSocket(webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const problems = []
const sessionNames = new Map()
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id) { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.j(Error(JSON.stringify(m.error))) : p.r(m.result); return }
  const who = sessionNames.get(m.sessionId) ?? '?'
  if (m.method === 'Runtime.exceptionThrown') problems.push(`${who} exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(`${who} console.error: ${m.params.args.map(a => a.value ?? a.description).join(' ')}`)
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/40[134]|409|422/.test(m.params.entry.text)) problems.push(`${who} log: ${m.params.entry.text} ${m.params.entry.url ?? ''}`)
}
const send = (method, params = {}, sessionId) => new Promise((r, j) => {
  const n = ++id; pending.set(n, { r, j })
  setTimeout(() => { if (pending.delete(n)) j(Error(`CDP timeout ${method}`)) }, 20000)
  ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }))
})
const delay = ms => new Promise(r => setTimeout(r, ms))
const contexts = []
let step = 0
const results = []
function check(ok, what) { results.push(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) problems.push(`assert: ${what}`) }

async function page(name, width, height, mobile) {
  const { browserContextId } = await send('Target.createBrowserContext'); contexts.push(browserContextId)
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  sessionNames.set(sessionId, name)
  const call = (m, p = {}) => send(m, p, sessionId)
  await call('Runtime.enable'); await call('Page.enable'); await call('Log.enable')
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  if (mobile) await call('Emulation.setTouchEmulationEnabled', { enabled: true })
  const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(`${name}: ${x}\n${JSON.stringify(r.exceptionDetails.exception?.description)}`); return r.result.value }
  const until = async (x, what = x) => { for (let i = 0; i < 120; i++) { if (await ev(x)) return; await delay(150) } throw Error(`${name} timeout: ${what}`) }
  const btn = (text, scope = 'body') => `[...(document.querySelector(${JSON.stringify(scope)})?.querySelectorAll('button')??[])].find(b=>b.textContent.includes(${JSON.stringify(text)})&&!b.disabled)`
  const click = async (text, scope) => { await until(`!!(${btn(text, scope)})`, `button "${text}" in ${scope ?? 'body'}`); await ev(`(${btn(text, scope)}).click()`); await delay(400) }
  const choose = async (n, v) => { const s = `input[name="${n}"][value="${v}"]:not(:disabled)`; await until(`!!document.querySelector(${JSON.stringify(s)})`, s); await ev(`document.querySelector(${JSON.stringify(s)}).click()`); await delay(300) }
  // Set a React-controlled field through the native setter + input event.
  const type = async (selector, text) => { await until(`!!document.querySelector(${JSON.stringify(selector)})`, selector); await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('blur',{bubbles:true}))})()`); await delay(300) }
  const go = async url => { await call('Page.navigate', { url }); await delay(600) }
  const text = () => ev('document.body.innerText')
  const shot = async label => {
    const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    await writeFile(`${shots}/${String(++step).padStart(2, '0')}-${name}-${label}.png`, Buffer.from(data, 'base64'))
    const overflow = await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    check(overflow <= 0, `${name} no horizontal overflow at ${label} (${overflow}px)`)
  }
  const api = (method, path, token, body) => ev(`fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json',...(${JSON.stringify(token)}?{Authorization:'Bearer '+${JSON.stringify(token)}}:{})},body:${body === undefined ? 'undefined' : JSON.stringify(JSON.stringify(body))}}).then(async r=>({status:r.status,body:await r.text()}))`)
  return { ev, until, click, choose, type, go, text, shot, api }
}

const owner = await page('freelancer', 1440, 900, false)
const client = await page('client', 390, 844, true)
try {
  // 1. Create
  await owner.go(`${origin}/new`)
  await owner.click('Read the brief')
  await owner.until("document.querySelectorAll('[role=alert]').length>0", 'validation errors')
  check((await owner.text()).includes('Paste the client'), 'empty brief shows inline validation')
  await owner.type('#name', 'Salon website')
  await owner.type('#freelancerName', 'Dimas')
  await owner.type('#clientName', 'Maya')
  await owner.type('#brief', 'We need a salon website with booking, two languages, and editable content.')
  await owner.click('Read the brief')
  await owner.until("location.pathname.startsWith('/o/')", 'navigate to owner workspace')
  const ownerToken = await owner.ev("location.pathname.split('/').pop()")
  await owner.until("document.body.innerText.includes('Lock questions')", 'setup loaded')
  check((await owner.ev("document.querySelectorAll('mark').length")) === 3, 'brief shows 3 marked phrases')
  await owner.ev(`document.querySelector('[data-card="booking"]').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`)
  await delay(900)
  check(await owner.ev("!!document.querySelector('svg path')&&document.querySelector('[data-card-mark=booking]').className.length>0"), 'hovering a card draws the brief→question line')
  await owner.shot('setup')

  // Toggle a card off and back on.
  const toggle = n => owner.ev(`[...[...document.querySelectorAll('li')].find(li=>li.textContent.includes('§ ${n} ·')).querySelectorAll('button')].find(b=>/Asking|Ask this/.test(b.textContent)).click()`)
  await toggle(3); await delay(900)
  let s = JSON.parse((await owner.api('GET', '/api/session', ownerToken)).body)
  check(s.cards.length === 3, 'removing a card persists (3 cards)')
  await toggle(3); await delay(900)
  s = JSON.parse((await owner.api('GET', '/api/session', ownerToken)).body)
  check(s.cards.length === 4, 're-adding a card persists (4 cards)')

  // 2. Lock and links
  await owner.click('Lock questions & get links')
  await owner.until("document.querySelectorAll('input[readonly]').length===2", 'two links')
  const [ownerURL, clientURL] = await owner.ev("[...document.querySelectorAll('input[readonly]')].map(i=>i.value)")
  check(new URL(ownerURL).pathname === `/o/${ownerToken}`, 'owner link matches')
  const clientToken = new URL(clientURL).pathname.split('/').pop()
  check(clientToken !== ownerToken && clientToken.length >= 40, 'client token differs and is long')
  const setAfterLock = await owner.api('PUT', '/api/project/cards', ownerToken, { cardIds: ['booking'] })
  check(setAfterLock.status === 409, `cards locked after invite (${setAfterLock.status})`)
  const wa = await owner.ev("document.querySelector('a[href^=\"https://wa.me/?text=\"]')?.href ?? ''")
  check(decodeURIComponent(wa).includes(clientURL) && decodeURIComponent(wa).includes('Hi Maya'), 'WhatsApp invite carries the client link and greeting')
  await owner.shot('links')

  // 3. Client opens link on phone; probes access rules.
  await client.go(clientURL)
  await client.until("document.body.innerText.includes('Before work starts')", 'client welcome')
  const welcome = await client.text()
  check(welcome.includes('Salon website') && welcome.includes('until both are sealed'), 'client welcome names the project and the sealing rule')
  await client.shot('welcome')
  for (const [m, p, b] of [['PUT', '/api/project/cards', { cardIds: ['booking'] }], ['POST', '/api/project/lock'], ['GET', '/api/scope/draft']]) {
    const r = await client.api(m, p, clientToken, b)
    check(r.status === 403, `client blocked from ${m} ${p} (${r.status})`)
  }
  const bad = await client.api('GET', '/api/session', clientToken.slice(0, -2) + 'xx')
  check(bad.status === 401, `tampered token rejected (${bad.status})`)
  check(!(await client.text()).includes('Lock questions'), 'client sees no setup controls')
  await client.click('Start answering')
  await client.until("document.body.innerText.includes('What do you have in mind?')", 'client answer screen')
  await client.shot('answer-first')

  // 4. Freelancer answers all four and seals first.
  await owner.click('Answer the questions')
  const ownerAnswers = { booking: 'a', languages: 'a', editable: 'b', 'launch-content': 'other' }
  for (const [card, opt] of Object.entries(ownerAnswers)) {
    for (let i = 0; i < 6 && !(await owner.ev(`!!document.querySelector('input[name="${card}"]')`)); i++) await owner.click('Next')
    await owner.choose(card, opt)
    if (opt === 'other') await owner.type('textarea[placeholder^="What would"]', 'I write the text; the client sends photos.')
  }
  await delay(800)
  await owner.click('Seal my answers')
  await owner.until("document.body.innerText.includes('Sealed. Waiting for')", 'owner sealed')
  await owner.shot('sealed-waiting')
  const sealedChange = await owner.api('PUT', '/api/answers', ownerToken, { answers: [{ cardId: 'booking', optionId: 'c' }] })
  check(sealedChange.status === 409, `sealed answers cannot change (${sealedChange.status})`)

  // Raw client session must not contain the freelancer's answers yet.
  const raw = (await client.api('GET', '/api/session', clientToken)).body
  const parsed = JSON.parse(raw)
  check(parsed.other.submitted === true && !parsed.other.answers && !parsed.compare, 'client session omits freelancer answers before both submit')
  check(!raw.includes('I write the text'), 'freelancer custom text absent from client response')

  // 5. Client answers on phone, page by page.
  const clientAnswers = { booking: 'c', languages: 'a', editable: 'unsure', 'launch-content': 'a' }
  for (const [card, opt] of Object.entries(clientAnswers)) {
    for (let i = 0; i < 6 && !(await client.ev(`!!document.querySelector('input[name="${card}"]')`)); i++) await client.click('Next')
    await client.choose(card, opt)
  }
  await delay(800)
  await client.click('Seal my answers')

  // 6. Reveal on both sides (owner via polling).
  await client.until("document.querySelectorAll('[data-reveal]').length>=2", 'client reveal')
  await owner.until("document.querySelectorAll('[data-reveal]').length>=2", 'owner reveal via polling')
  s = JSON.parse((await owner.api('GET', '/api/session', ownerToken)).body)
  const status = Object.fromEntries(s.compare.map(c => [c.cardId, c.status]))
  check(status.booking === 'needs_discussion', `booking needs discussion (${status.booking})`)
  check(status.languages === 'same_answer', `languages same answer (${status.languages})`)
  check(status.editable === 'needs_clarification', `editable needs clarification (${status.editable})`)
  check(status['launch-content'] === 'needs_clarification', `launch content needs clarification (${status['launch-content']})`)
  check(s.counts?.decided === 0, `nothing auto-decided (${s.counts?.decided})`)
  await delay(1500)
  await owner.shot('compare'); await client.shot('compare')

  // 7. Resolve.
  const region = t => `section[aria-label="Decision for ${t}"]`
  // Booking: owner proposes B, client counter-proposes C, owner counter B, client confirms.
  await owner.click('Propose a decision', region('Booking')); await owner.choose('proposal-booking', 'b'); await owner.click('Send proposal', region('Booking'))
  await client.go(clientURL); await client.until(`!!document.querySelector('${region('Booking')}')`)
  await client.click('Counter-propose', region('Booking')); await client.choose('proposal-booking', 'c'); await client.click('Send proposal', region('Booking'))
  await owner.go(ownerURL); await owner.click('Compare'); await owner.until(`!!document.querySelector('${region('Booking')}')`)
  await owner.click('Counter-propose', region('Booking')); await owner.choose('proposal-booking', 'b'); await owner.click('Send proposal', region('Booking'))
  await client.go(clientURL); await client.click('Confirm decision', region('Booking'))
  const steps = await client.ev(`[...document.querySelectorAll('${region('Booking')} ol li')].map(li=>li.textContent)`)
  check(steps.length === 2 && steps[0].includes('Dimas proposed') && steps[1].includes('Maya proposed'), `booking shows the two replaced proposals, oldest first (${steps.length})`)
  // Languages: same answer needs both.
  await client.click('Confirm decision', region('Languages'))
  s = JSON.parse((await owner.api('GET', '/api/session', ownerToken)).body)
  check(s.compare.find(c => c.cardId === 'languages').status !== 'decided', 'same answer not decided after one confirmation')
  // Editable: client proposes B, owner confirms. Launch: owner custom decision, client confirms.
  await client.click('Propose a decision', region('Editable content')); await client.choose('proposal-editable', 'b'); await client.click('Send proposal', region('Editable content'))
  const unsure = await client.api('POST', '/api/cards/editable/proposals', clientToken, { optionId: 'unsure' })
  check(unsure.status === 422, `"Not sure" cannot be proposed (${unsure.status})`)
  await owner.go(ownerURL); await owner.click('Compare'); await owner.until(`!!document.querySelector('${region('Languages')}')`)
  await owner.click('Confirm decision', region('Languages'))
  await owner.click('Confirm decision', region('Editable content'))
  await owner.click('Propose a decision', region('Launch content')); await owner.choose('proposal-launch-content', 'other')
  await owner.type(`${region('Launch content')} textarea[required]`, 'Freelancer writes the text; client sends photos before design starts.')
  await owner.click('Send proposal', region('Launch content'))
  await client.go(clientURL); await client.click('Confirm decision', region('Launch content'))
  await owner.go(ownerURL)
  await owner.until("!!document.querySelector('[aria-label=\"4 of 4 decided\"]')", '4 of 4 decided')
  await owner.shot('decided')

  // 8. Scope v1 → one confirmation → edit v2 → both confirm.
  await owner.click('Review scope')
  await owner.until("!!document.querySelector('textarea[aria-label=Included]')", 'scope draft')
  const included = await owner.ev("document.querySelector('textarea[aria-label=Included]').value")
  check(included.includes('booking request form') && included.includes('Freelancer writes the text'), 'draft assembled from decisions incl. custom text')
  await owner.click('Send for confirmation')
  await owner.until("document.body.innerText.includes('Confirm scope v1')", 'v1 saved')
  await owner.type('form input[autocomplete=name]', 'Dimas'); await owner.click('Confirm scope v1')
  await owner.click('Edit as a new version')
  await owner.type('textarea[aria-label="Open questions"]', 'Which stylist photos are ready by launch?')
  await owner.click('Send for confirmation')
  await owner.until("document.body.innerText.includes('Confirm scope v2')", 'v2 saved')
  const oldConfirm = await client.api('POST', '/api/scope/versions/1/confirm', clientToken, { name: 'Maya' })
  check(oldConfirm.status === 409, `confirming outdated v1 rejected (${oldConfirm.status})`)
  await owner.type('form input[autocomplete=name]', 'Dimas'); await owner.click('Confirm scope v2')
  await client.go(clientURL); await client.click('View scope')
  await client.until("document.body.innerText.includes('Confirm scope v2')", 'client sees v2')
  await client.shot('scope-confirm')
  await client.type('form input[autocomplete=name]', 'Maya'); await client.click('Confirm scope v2')
  await client.until("document.body.innerText.includes('Download Markdown')", 'agreed on client')
  await owner.go(ownerURL); await owner.click('Scope')
  await owner.until("document.body.innerText.includes('The agreed scope.')", 'agreed on owner')
  await delay(1500)
  await owner.shot('agreed'); await client.shot('agreed')

  // 9. Export equals stored version; writes locked.
  const exp = await client.api('GET', '/api/scope/export.md', clientToken)
  check(exp.status === 200 && exp.body.includes('v2') && exp.body.includes('Which stylist photos') && exp.body.includes('not identity-verified'), 'client export contains agreed v2 and record label')
  const exp2 = await owner.api('GET', '/api/scope/export.md', ownerToken)
  check(exp2.body === exp.body, 'owner and client exports identical')
  const late = await owner.api('POST', '/api/cards/booking/proposals', ownerToken, { optionId: 'a' })
  check(late.status === 409, `no proposals after agreed (${late.status})`)
  await writeFile(`${shots}/agreed.md`, exp.body)

  // 10. Invalid link page and projects list.
  await client.go(`${origin}/c/not-a-valid-token`)
  await client.until("document.body.innerText.includes(\"This link isn't valid\")", 'invalid link page')
  await client.shot('invalid')
  await owner.go(`${origin}/`)
  await owner.until("/agreed/i.test(document.body.innerText)", 'projects shows Agreed')
  await owner.shot('projects')
} catch (e) {
  problems.push(`ABORTED: ${e.message}`)
} finally {
  for (const c of contexts) await send('Target.disposeBrowserContext', { browserContextId: c }).catch(() => {})
  ws.close()
  console.log(results.join('\n'))
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : `\nAll ${results.length} checks passed. Screenshots: ${shots}`)
  if (problems.length) process.exitCode = 1
}
