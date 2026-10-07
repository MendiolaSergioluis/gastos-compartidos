/**
 * Comprueba que la app funcione SIN CONEXIÓN.
 *
 *   node scripts/cdp-offline.mjs [url]
 *
 * Pasos: cargar, esperar a que el service worker precachée, recargar, cortar la
 * red por completo (Network.emulateNetworkConditions offline) y verificar que la
 * app sigue arrancando y navegando entre secciones.
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const base = process.argv[2] ?? 'http://localhost:4174/'
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = join(process.cwd(), '.chrome-offline')
const port = 9700

rmSync(profile, { recursive: true, force: true })

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
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function debuggerUrl() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* arrancando */
    }
    await sleep(250)
  }
  throw new Error('Chrome no expuso el depurador')
}

const socket = new WebSocket(await debuggerUrl())
const pending = new Map()
let nextId = 0
await new Promise((done, fail) => {
  socket.addEventListener('open', done)
  socket.addEventListener('error', fail)
})
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  const entry = pending.get(message.id)
  if (!entry) return
  pending.delete(message.id)
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
  else entry.resolve(message.result)
})

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = (nextId += 1)
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? 'error al evaluar')
  }
  return result.result.value
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const go = async (hash = '') => {
  await send('Page.navigate', { url: `${base}${hash}` })
  await sleep(2200)
}

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })

  // 1. primera visita: se instala el service worker y precachea
  await go('#resumen')
  const registro = await evaluate(`(async () => {
    if (!('serviceWorker' in navigator)) return 'sin soporte'
    const reg = await navigator.serviceWorker.ready
    return reg.active ? 'activo' : 'inactivo'
  })()`)
  check('el service worker se registra y activa', registro === 'activo', String(registro))

  const precache = await evaluate(`(async () => {
    const keys = await caches.keys()
    let total = 0
    for (const key of keys) {
      const cache = await caches.open(key)
      total += (await cache.keys()).length
    }
    return { caches: keys.length, entradas: total }
  })()`)
  check(
    'precaché poblado',
    typeof precache === 'object' && precache.entradas > 20,
    JSON.stringify(precache),
  )

  // 2. segunda visita: ya con el service worker controlando la página
  await go('#resumen')
  const controlada = await evaluate(`Boolean(navigator.serviceWorker.controller)`)
  check('la página queda controlada por el service worker', controlada === true)

  // 3. se corta la red por completo
  await send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  })
  const sinRed = await evaluate(`navigator.onLine`)
  check('el navegador está sin conexión', sinRed === false)

  // 4. recarga en frío sin red: debe servir todo desde la caché
  await send('Page.navigate', { url: `${base}#resumen` })
  await sleep(2500)
  const trasRecargar = await evaluate(`({
    titulo: document.title,
    marca: document.querySelector('.brand__name')?.textContent ?? null,
    heroe: document.querySelector('.hero') !== null,
    porcentaje: document.querySelector('.ring__value')?.textContent ?? null,
    iconos: [...document.querySelectorAll('.iconchip .icon')].length,
  })`)
  check(
    'la app arranca sin conexión',
    trasRecargar.heroe === true && Boolean(trasRecargar.porcentaje),
    JSON.stringify(trasRecargar),
  )

  // 5. navegar entre secciones sin red
  const secciones = []
  for (const [tab, marcador] of [
    ['Mes', 'Sueldos del mes'],
    ['Gastos', 'Catálogo de gastos compartidos'],
    ['Metas', 'Seguimiento de metas'],
    ['Historial', 'Evolución del %'],
    ['Ajustes', 'Formato de moneda'],
    ['Resumen', 'Detalle del mes'],
  ]) {
    const indice = await evaluate(
      `[...document.querySelectorAll('.nav--bottom .nav__item')].findIndex(b => b.textContent.includes(${JSON.stringify(tab)}))`,
    )
    const punto = await evaluate(`(() => {
      const el = document.querySelectorAll('.nav--bottom .nav__item')[${indice}];
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
    })()`)
    const { x, y } = JSON.parse(punto)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    await sleep(500)
    const contenido = await evaluate(`document.querySelector('.app__content')?.textContent ?? ''`)
    secciones.push(`${tab}:${contenido.includes(marcador) ? 'ok' : 'FALLA'}`)
  }
  check(
    'las seis secciones navegan sin conexión',
    secciones.every((entrada) => entrada.endsWith('ok')),
    secciones.join(' · '),
  )

  // 6. los iconos se pintan sin red (vienen del precaché)
  const iconosSinRed = await evaluate(`(async () => {
    const iconos = [...document.querySelectorAll('.icon')];
    const urls = iconos.map(i => (getComputedStyle(i).maskImage || '').match(/url\\("?([^")]+)"?\\)/)?.[1]).filter(Boolean);
    let ok = 0;
    for (const url of urls.slice(0, 8)) {
      const respuesta = await fetch(url);
      if (respuesta.ok) ok += 1;
    }
    return { probados: Math.min(urls.length, 8), ok };
  })()`)
  check(
    'los iconos cargan desde la caché',
    iconosSinRed.probados > 0 && iconosSinRed.ok === iconosSinRed.probados,
    JSON.stringify(iconosSinRed),
  )

  // 7. se recupera la conexión: todo sigue igual
  await send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await sleep(600)
  const online = await evaluate(`navigator.onLine && Boolean(document.querySelector('.hero'))`)
  check('vuelve a estar en línea sin recargar', online === true)
} catch (error) {
  check('la prueba se completó', false, error.message)
} finally {
  const fallos = results.filter((entry) => !entry.ok)
  console.log(
    `\n${fallos.length === 0 ? '✓ funciona sin conexión' : `✗ ${fallos.length} de ${results.length} fallaron`}`,
  )
  socket.close()
  chrome.kill('SIGKILL')
  await sleep(200)
  rmSync(profile, { recursive: true, force: true })
  process.exit(fallos.length === 0 ? 0 : 1)
}
