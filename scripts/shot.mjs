/**
 * Capturas de pantalla precisas vía Chrome DevTools Protocol.
 *
 *   node scripts/shot.mjs <url> <salida.png> [ancho] [alto] [--full] [--theme=light|dark]
 *
 * Usa Emulation.setDeviceMetricsOverride, así que el viewport es exactamente el
 * pedido: el --window-size de Chrome en macOS no baja de ~500 px y recorta.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const [url, out, widthArg, heightArg, ...flags] = process.argv.slice(2)
if (!url || !out) {
  console.error('uso: node scripts/shot.mjs <url> <salida.png> [ancho] [alto] [--full]')
  process.exit(2)
}

const width = Number(widthArg ?? 1440)
const height = Number(heightArg ?? 900)
const fullPage = flags.includes('--full')
const theme = flags.find((flag) => flag.startsWith('--theme='))?.split('=')[1]
/** --eval="expresión" imprime el resultado de evaluar en la página y no captura */
const evalIndex = flags.findIndex((flag) => flag.startsWith('--eval='))
const evalExpression = evalIndex >= 0 ? flags[evalIndex].slice('--eval='.length) : null
/** --scrollTo=<selector> deja el elemento arriba antes de capturar */
const scrollIndex = flags.findIndex((flag) => flag.startsWith('--scrollTo='))
const scrollTo = scrollIndex >= 0 ? flags[scrollIndex].slice('--scrollTo='.length) : null
/** --do=<expresión> interactúa con la página antes de capturar */
const doIndex = flags.findIndex((flag) => flag.startsWith('--do='))
const doExpression = doIndex >= 0 ? flags[doIndex].slice('--do='.length) : null
const port = 9333 + (process.pid % 400)
const profile = resolve(dirname(out), `.chrome-shot-${process.pid}`)

rmSync(profile, { recursive: true, force: true })
mkdirSync(dirname(out), { recursive: true })

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-crash-reporter',
    '--no-first-run',
    '--hide-scrollbars',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore', detached: false },
)

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function debuggerUrl() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const targets = await response.json()
      const page = targets.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* todavía arrancando */
    }
    await sleep(250)
  }
  throw new Error('Chrome no expuso el depurador')
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl)
  const pending = new Map()
  const events = []
  let nextId = 0

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve: done, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else done(message.result)
      return
    }
    events.push(message)
  })

  const ready = new Promise((done, fail) => {
    socket.addEventListener('open', done)
    socket.addEventListener('error', fail)
  })

  const send = (method, params = {}) =>
    new Promise((done, reject) => {
      const id = (nextId += 1)
      pending.set(id, { resolve: done, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  return { ready, send, events, close: () => socket.close() }
}

let exitCode = 0
try {
  const wsUrl = await debuggerUrl()
  const client = connect(wsUrl)
  await client.ready

  await client.send('Page.enable')
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: width < 700,
  })
  if (theme) {
    await client.send('Emulation.setEmulatedMedia', { features: [] })
  }

  await client.send('Page.navigate', { url })
  await sleep(2200)

  if (theme) {
    await client.send('Runtime.evaluate', {
      expression: `document.documentElement.dataset.theme = ${JSON.stringify(theme)}`,
    })
    await sleep(350)
  }

  const bounds = await client.send('Runtime.evaluate', {
    expression: `JSON.stringify({
      vw: document.documentElement.clientWidth,
      vh: document.documentElement.clientHeight,
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      overflow: Array.from(document.querySelectorAll('body *'))
        .filter(function (el) {
          var r = el.getBoundingClientRect()
          return r.width > 0 && r.right > document.documentElement.clientWidth + 1
        })
        .slice(0, 8)
        .map(function (el) {
          var r = el.getBoundingClientRect()
          return el.tagName + '.' + String(el.className).slice(0, 40) + ' right=' + Math.round(r.right)
        })
    })`,
    returnByValue: true,
  })

  const metrics = JSON.parse(bounds.result.value)
  console.log(
    `# ${width}×${height} → viewport ${metrics.vw}×${metrics.vh}, documento ${metrics.sw}×${metrics.sh}`,
  )
  if (metrics.sw > metrics.vw + 1) {
    console.log(`# ⚠ desborde horizontal de ${metrics.sw - metrics.vw}px:`)
    for (const item of metrics.overflow) console.log(`#   ${item}`)
  }

  if (doExpression) {
    await client.send('Runtime.evaluate', {
      expression: doExpression,
      awaitPromise: true,
      returnByValue: true,
    })
    await sleep(700)
  }

  if (scrollTo) {
    await client.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(scrollTo)})?.scrollIntoView({ block: 'start' })`,
    })
    await sleep(700)
  }

  if (evalExpression) {
    const probe = await client.send('Runtime.evaluate', {
      expression: evalExpression,
      returnByValue: true,
      awaitPromise: true,
    })
    console.log(JSON.stringify(probe.result.value, null, 2))
    client.close()
    chrome.kill('SIGKILL')
    await sleep(200)
    rmSync(profile, { recursive: true, force: true })
    process.exit(0)
  }

  const shot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: fullPage,
    ...(fullPage ? { clip: { x: 0, y: 0, width: metrics.vw, height: metrics.sh, scale: 1 } } : {}),
  })

  writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log(`✓ ${out}`)
  client.close()
} catch (error) {
  console.error('error:', error.message)
  exitCode = 1
} finally {
  chrome.kill('SIGKILL')
  await sleep(200)
  rmSync(profile, { recursive: true, force: true })
  process.exit(exitCode)
}
