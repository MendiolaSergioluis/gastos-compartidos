/**
 * Prueba de interacción con clics REALES de ratón (Input.dispatchMouseEvent).
 *
 *   node scripts/cdp-interact.mjs [base]
 *
 * Los clics programáticos (`elemento.click()`) no reproducen el comportamiento
 * del navegador con `<label>`, propagación de eventos ni foco, así que aquí se
 * pulsa donde pulsaría una persona. Cada control se usa varias veces seguidas:
 * el fallo que se busca es «funciona una vez y luego no».
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const base = process.argv[2] ?? 'http://localhost:4174/'
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = join(process.cwd(), '.chrome-interact')
const port = 9500

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

/**
 * Pulsa donde pulsaría una persona: evento real en el centro del elemento.
 *
 * Solo desplaza si hace falta y con `behavior: 'instant'`: el CSS tiene
 * `scroll-behavior: smooth`, y medir a mitad de la animación daba coordenadas
 * viejas. Un panel flotante además se recoloca al hacer scroll, así que
 * desplazar sin necesidad hacía que el clic cayera en otro sitio.
 */
async function click(selector, index = 0) {
  const point = await evaluate(`(() => {
    const list = document.querySelectorAll(${JSON.stringify(selector)});
    const el = list[${index}];
    if (!el) return null;
    const first = el.getBoundingClientRect();
    const dentro = first.top >= 0 && first.bottom <= window.innerHeight && first.left >= 0 && first.right <= window.innerWidth;
    if (!dentro) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    // ¿hay algo por encima? Un panel con z-index menor que el modal se dibuja
    // detrás y el clic no llega: el control parece "no funcionar".
    const top = document.elementFromPoint(x, y);
    return {
      x, y, w: Math.round(r.width), h: Math.round(r.height),
      encima: top ? (el.contains(top) || top.contains(el) ? 'ok' : (top.className || top.tagName).toString().slice(0, 60)) : 'fuera',
    };
  })()`)
  if (!point) throw new Error(`no encontré ${selector}[${index}]`)
  if (point.w === 0 || point.h === 0) throw new Error(`${selector}[${index}] no es visible`)
  if (point.encima !== 'ok') {
    throw new Error(`${selector}[${index}] está tapado por "${point.encima}"`)
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  })
  await sleep(260)
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const go = async (hash) => {
  await send('Page.navigate', { url: `${base}#${hash}` })
  await sleep(1400)
}

await send('Page.enable')
await send('Runtime.enable')
// viewport explícito: sin esto Chrome headless arranca estrecho y la media
// query móvil oculta la barra de pestañas
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})

try {
  // ---------------------------------------------------------------- pestañas
  await go('resumen')
  const tabText = () =>
    evaluate(`document.querySelector('.app__content')?.textContent?.slice(0, 60) ?? ''`)
  const seen = []
  for (const tab of ['Mes', 'Gastos', 'Mes', 'Gastos', 'Resumen']) {
    const index = await evaluate(
      `[...document.querySelectorAll('.nav--tabs .nav__item')].findIndex(b => b.textContent.includes(${JSON.stringify(tab)}))`,
    )
    await click('.nav--tabs .nav__item', index)
    seen.push(`${tab}:${(await tabText()).slice(0, 18)}`)
  }
  const uniqueViews = new Set(seen.map((entry) => entry.split(':')[1])).size
  check('las pestañas responden siempre', uniqueViews >= 3, seen.join(' | '))

  // ----------------------------------------------------------------- toggles
  await go('mes')
  const toggleState = (index) =>
    evaluate(`document.querySelectorAll('.monthrow .toggle')[${index}]?.getAttribute('aria-checked')`)
  const sequence = []
  for (let i = 0; i < 4; i += 1) {
    await click('.monthrow .toggle', 0)
    sequence.push(await toggleState(0))
  }
  check(
    'un interruptor alterna en cada pulsación',
    /^(true|false)(,(true|false)){3}$/.test(sequence.join(',')) &&
      new Set(sequence).size === 2 &&
      sequence.every((value, index) => index === 0 || value !== sequence[index - 1]),
    sequence.join(','),
  )

  // ------------------------------------------------- desplegables (varias veces)
  const triggerLabel = () =>
    evaluate(`document.querySelector('.monthrow .select__trigger')?.textContent?.trim()`)
  const elegir = async (texto) => {
    await click('.monthrow .select__trigger', 0)
    const abierto = await evaluate(`document.querySelectorAll('.select__option').length`)
    if (abierto === 0) return `no abrió (${texto})`
    const index = await evaluate(
      `[...document.querySelectorAll('.select__option')].findIndex(o => o.textContent.trim().startsWith(${JSON.stringify(texto)}))`,
    )
    if (index < 0) return `sin opción ${texto}`
    await click('.select__option', index)
    return triggerLabel()
  }
  const primero = await elegir('Partes iguales')
  const segundo = await elegir('Montos fijos')
  const tercero = await elegir('Proporcional')
  const cuarto = await elegir('Partes iguales')
  check(
    'el desplegable funciona en usos sucesivos',
    primero === 'Partes iguales' &&
      segundo === 'Montos fijos' &&
      tercero === 'Proporcional' &&
      cuarto === 'Partes iguales',
    [primero, segundo, tercero, cuarto].join(' → '),
  )

  // ------------------------------------------------------ selector de mes
  const meses = []
  for (const index of [2, 5, 0]) {
    await click('.monthpicker__trigger')
    if ((await evaluate(`document.querySelectorAll('.monthpicker__month').length`)) !== 12) {
      meses.push('no abrió')
      continue
    }
    await click('.monthpicker__month', index)
    meses.push(await evaluate(`document.querySelector('.monthpicker__value')?.textContent?.trim()`))
  }
  check(
    'el selector de mes cambia de mes en usos sucesivos',
    !meses.includes('no abrió') && new Set(meses).size === meses.length,
    meses.join(' → '),
  )

  // ------------------------------------------------------------- modal
  await go('gastos')
  const abreModal = async () => {
    const index = await evaluate(
      `[...document.querySelectorAll('button')].findIndex(b => b.textContent.includes('Nuevo gasto'))`,
    )
    await click('button', index)
    return evaluate(`document.querySelectorAll('.modal').length`)
  }
  const primeroModal = await abreModal()
  await click('.modal__head .iconbtn')
  const cerrado = await evaluate(`document.querySelectorAll('.modal').length`)
  const bloqueoTrasCerrar = await evaluate(`getComputedStyle(document.body).overflow`)
  const segundoModal = await abreModal()
  check(
    'el modal se abre, se cierra y vuelve a abrirse',
    primeroModal === 1 && cerrado === 0 && segundoModal === 1,
    `abre ${primeroModal} · cierra ${cerrado} · reabre ${segundoModal}`,
  )
  check(
    'al cerrar el modal se libera el scroll',
    bloqueoTrasCerrar !== 'hidden',
    `overflow: ${bloqueoTrasCerrar}`,
  )

  // ------------------------------------- toggle y paleta DENTRO de un <label>
  const suscripcion = async () => {
    const index = await evaluate(
      `[...document.querySelectorAll('.modal .toggle')].length`,
    )
    void index
    await click('.modal .toggle', 0)
    return evaluate(`document.querySelector('.modal .toggle')?.getAttribute('aria-checked')`)
  }
  const s1 = await suscripcion()
  const s2 = await suscripcion()
  const s3 = await suscripcion()
  check(
    'el interruptor dentro de un <label> alterna siempre',
    s1 === 'true' && s2 === 'false' && s3 === 'true',
    `${s1},${s2},${s3}`,
  )
  await click('.modal__head .iconbtn')

  // -------------------------------------- desplegables DENTRO del modal
  await go('gastos')
  await abreModal()
  const categoriaAntes = await evaluate(
    `document.querySelector('.modal .select__trigger .select__label')?.textContent`,
  )
  await click('.modal .select__trigger', 0)
  const opcionesModal = await evaluate(`document.querySelectorAll('.select__option').length`)
  const indiceServicios = await evaluate(
    `[...document.querySelectorAll('.select__option')].findIndex(o => o.textContent.includes('Servicios'))`,
  )
  await click('.select__option', indiceServicios)
  const categoriaDespues = await evaluate(
    `document.querySelector('.modal .select__trigger .select__label')?.textContent`,
  )
  check(
    'el desplegable funciona dentro del modal',
    opcionesModal > 0 && categoriaDespues === 'Servicios' && categoriaDespues !== categoriaAntes,
    `${categoriaAntes} → ${categoriaDespues} (${opcionesModal} opciones)`,
  )

  // el segundo desplegable del modal, para descartar que solo funcione el primero
  await click('.modal .select__trigger', 1)
  const opcionesTipo = await evaluate(`document.querySelectorAll('.select__option').length`)
  const indicePuntual = await evaluate(
    `[...document.querySelectorAll('.select__option')].findIndex(o => o.textContent.includes('Puntual'))`,
  )
  await click('.select__option', indicePuntual)
  const tipoDespues = await evaluate(
    `document.querySelectorAll('.modal .select__trigger .select__label')[1]?.textContent`,
  )
  check(
    'el segundo desplegable del modal también responde',
    opcionesTipo > 0 && tipoDespues === 'Puntual',
    `${opcionesTipo} opciones → ${tipoDespues}`,
  )
  await click('.modal__head .iconbtn')

  // --------------------------------------------------------- editar y duplicar
  const editorAbierto = async (texto) => {
    const index = await evaluate(
      `[...document.querySelectorAll('.expense__actions button')].findIndex(b => b.textContent.trim() === ${JSON.stringify(texto)})`,
    )
    await click('.expense__actions button', index)
    return evaluate(`document.querySelectorAll('.modal').length`)
  }
  const e1 = await editorAbierto('Editar')
  await click('.modal__head .iconbtn')
  const e2 = await editorAbierto('Editar')
  await click('.modal__head .iconbtn')
  const d1 = await editorAbierto('Duplicar')
  await click('.modal__head .iconbtn')
  const d2 = await editorAbierto('Duplicar')
  await click('.modal__head .iconbtn')
  check(
    'Editar y Duplicar funcionan en usos sucesivos',
    [e1, e2, d1, d2].every((value) => value === 1),
    `editar ${e1},${e2} · duplicar ${d1},${d2}`,
  )

  // ------------------------------------------------- paleta de color (label)
  await go('ajustes')
  const colorElegido = async (index) => {
    await click('.personrow .colorpicker__swatch', index)
    return evaluate(
      `[...document.querySelectorAll('.personrow .colorpicker__swatch')].findIndex(b => b.className.includes('selected'))`,
    )
  }
  const c1 = await colorElegido(3)
  const c2 = await colorElegido(5)
  const c3 = await colorElegido(1)
  check(
    'la paleta de color responde al color pulsado',
    c1 === 3 && c2 === 5 && c3 === 1,
    `elegidos ${c1},${c2},${c3}`,
  )
} catch (error) {
  check('la prueba se completó', false, error.message)
} finally {
  const fallos = results.filter((entry) => !entry.ok)
  console.log(
    `\n${fallos.length === 0 ? '✓ todo responde' : `✗ ${fallos.length} de ${results.length} fallaron`}`,
  )
  socket.close()
  chrome.kill('SIGKILL')
  await sleep(200)
  rmSync(profile, { recursive: true, force: true })
  process.exit(fallos.length === 0 ? 0 : 1)
}
