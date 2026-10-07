/**
 * Auditoría de interfaz, accesibilidad y SEO con el MCP de chrome-devtools.
 *
 *   node scripts/cdp-audit.mjs [url] [salida.json]
 *
 * Revisa: consola, peticiones fallidas, Lighthouse (accesibilidad, SEO, buenas
 * prácticas), tamaños de letra, contrastes, objetivos táctiles, desbordes,
 * encabezados, etiquetas de formulario e imágenes sin alt.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { startCdpMcp } from './cdp-mcp.mjs'
import { toolContent } from './lib/stdio-mcp.mjs'

const url = process.argv[2] ?? 'http://localhost:4174/'
const outFile = process.argv[3] ? resolve(process.argv[3]) : null

/** Se ejecuta dentro de la página: devuelve hallazgos serializables. */
const PAGE_AUDIT = `() => {
  const parse = (value) => {
    if (!value) return null
    let m = value.match(/rgba?\\(([^)]+)\\)/)
    if (m) {
      const p = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number)
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
    }
    m = value.match(/color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/)
    if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: m[4] === undefined ? 1 : +m[4] }
    return null
  }
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const contrast = (a, b) => {
    const l1 = lum(a), l2 = lum(b)
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)
  }
  const flatten = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  })
  const backgroundOf = (el) => {
    let node = el
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor)
      if (c && c.a > 0.6) return c
      node = node.parentElement
    }
    const body = parse(getComputedStyle(document.body).backgroundColor)
    return body && body.a > 0.6 ? body : { r: 8, g: 10, b: 20, a: 1 }
  }
  const path = (el) => {
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && parts.length < 3) {
      let s = node.tagName.toLowerCase()
      if (node.className && typeof node.className === 'string') {
        s += '.' + node.className.trim().split(/\\s+/).slice(0, 2).join('.')
      }
      parts.unshift(s)
      node = node.parentElement
    }
    return parts.join(' > ')
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05
  }
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)

  const small = [], lowContrast = [], smallTargets = [], unlabeled = []
  let checked = 0

  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    checked += 1
    const cs = getComputedStyle(el)

    if (hasText(el)) {
      const size = parseFloat(cs.fontSize)
      const weight = +cs.fontWeight || 400
      const color = parse(cs.color)
      if (color) {
        const bg = backgroundOf(el)
        const ratio = contrast(flatten(color, bg), bg)
        const large = size >= 24 || (size >= 18.66 && weight >= 700)
        const min = large ? 3 : 4.5
        if (ratio < min) {
          lowContrast.push({ sel: path(el), ratio: +ratio.toFixed(2), min, size, text: el.textContent.trim().slice(0, 42) })
        }
      }
      if (size < 12) small.push({ sel: path(el), size, text: el.textContent.trim().slice(0, 42) })
    }

    const tag = el.tagName.toLowerCase()
    const interactive = tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'switch'
    if (interactive) {
      const r = el.getBoundingClientRect()
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim()
      if (r.height < 24 || r.width < 24) {
        smallTargets.push({ sel: path(el), w: Math.round(r.width), h: Math.round(r.height), label: label.slice(0, 30) })
      }
      if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        const id = el.id
        const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
          (id && document.querySelector('label[for="' + id + '"]')) || el.closest('label')
        if (!labelled) unlabeled.push({ sel: path(el), type: el.getAttribute('type') || tag })
      }
    }
  }

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(visible)
    .map((h) => ({ level: +h.tagName[1], text: h.textContent.trim().slice(0, 48) }))
  let headingJump = null
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i].level - headings[i - 1].level > 1) {
      headingJump = headings[i - 1].text + ' (h' + headings[i - 1].level + ') → ' + headings[i].text + ' (h' + headings[i].level + ')'
      break
    }
  }

  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
  const duplicateIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]

  const images = [...document.querySelectorAll('img')].filter(visible)
  const imagesWithoutAlt = images.filter((img) => !img.hasAttribute('alt')).map((img) => img.getAttribute('src'))

  const meta = (name) => document.querySelector('meta[name="' + name + '"]')?.content ?? null
  const prop = (name) => document.querySelector('meta[property="' + name + '"]')?.content ?? null

  return {
    viewport: { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight },
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    elementsChecked: checked,
    smallFonts: small.slice(0, 12),
    smallFontsCount: small.length,
    lowContrast: lowContrast.slice(0, 14),
    lowContrastCount: lowContrast.length,
    smallTargets: smallTargets.slice(0, 12),
    smallTargetsCount: smallTargets.length,
    unlabeled: unlabeled.slice(0, 8),
    headings: headings.slice(0, 18),
    headingCount: headings.length,
    headingJump,
    duplicateIds,
    imagesWithoutAlt,
    landmarks: {
      header: !!document.querySelector('header'),
      nav: document.querySelectorAll('nav').length,
      main: !!document.querySelector('main'),
      footer: !!document.querySelector('footer'),
      h1: headings.filter((h) => h.level === 1).length,
    },
    seo: {
      lang: document.documentElement.lang,
      title: document.title,
      titleLength: document.title.length,
      description: meta('description'),
      descriptionLength: (meta('description') ?? '').length,
      viewportMeta: meta('viewport'),
      themeColor: meta('theme-color'),
      ogTitle: prop('og:title'),
      ogDescription: prop('og:description'),
      ogImage: prop('og:image'),
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? null,
    },
  }
}`

// perfil limpio: sin esto el service worker sirve el build anterior
const profile = process.env.CDP_PROFILE ?? join(process.cwd(), '.chrome-mcp')
rmSync(profile, { recursive: true, force: true })
const reportsDir = join(process.cwd(), 'audit-reports')
mkdirSync(reportsDir, { recursive: true })

const isMain = process.argv[1] && process.argv[1].endsWith('cdp-audit.mjs')
const client = isMain ? startCdpMcp() : null
const report = { url, startedAt: new Date().toISOString() }

const step = async (name, fn) => {
  try {
    const value = await fn()
    report[name] = value
    console.log(`✓ ${name}`)
    return value
  } catch (error) {
    report[name] = { error: error.message }
    console.log(`✗ ${name}: ${error.message}`)
    return null
  }
}

/** evaluate_script devuelve el JSON envuelto en un bloque de texto. */
export function unwrapScript(value) {
  if (typeof value !== 'string') return value
  const match = value.match(/```json\n([\s\S]*?)\n```/)
  if (!match) return value
  try {
    return JSON.parse(match[1])
  } catch {
    return value
  }
}

/** El navegador tarda en exponer el frame principal: reintenta hasta que responda. */
async function call(name, args, attempts = 12) {
  let last
  for (let i = 0; i < attempts; i += 1) {
    try {
      const result = toolContent(await client.callTool(name, args))
      if (typeof result === 'string' && result.includes('too early')) {
        last = new Error(result)
      } else {
        return result
      }
    } catch (error) {
      last = error
    }
    await new Promise((done) => setTimeout(done, 1500))
  }
  throw last ?? new Error(`sin respuesta de ${name}`)
}

if (!isMain) {
  // importado como módulo: solo se exportan utilidades
} else
try {
  const server = await client.connect()
  console.log(`# chrome-devtools-mcp ${server?.serverInfo?.version ?? '?'} · auditando ${url}\n`)

  const pages = await step('pages', async () => call('list_pages', {}))
  const pageId = Number(String(pages).match(/^(\d+):/m)?.[1] ?? 1)

  await step('navigate', async () =>
    call('navigate_page', { pageId, type: 'url', url, ignoreCache: true }),
  )
  await new Promise((done) => setTimeout(done, 2500))

  await step('console', async () => {
    const result = await call('list_console_messages', {
      pageId,
      types: ['error', 'warn'],
      pageSize: 60,
    })
    return result
  })

  await step('network', async () => {
    const result = await call('list_network_requests', { pageId, pageSize: 150 })
    const list = Array.isArray(result) ? result : []
    return {
      total: list.length,
      failed: list.filter((item) => (item.status ?? 0) >= 400).slice(0, 20),
    }
  })

  await step('mobile', async () => {
    // emulación real de dispositivo: resize_page no baja de 500px en macOS
    try {
      await call('emulate', { pageId, viewport: '390x844x3,mobile,touch' })
    } catch {
      await call('resize_page', { pageId, width: 390, height: 844 })
    }
    await new Promise((done) => setTimeout(done, 1500))
    return unwrapScript(await call('evaluate_script', { pageId, function: PAGE_AUDIT }))
  })

  await step('desktop', async () => {
    // se limpia la emulación móvil anterior con un viewport de escritorio
    try {
      await call('emulate', { pageId, viewport: '1440x900x1' })
    } catch {
      await call('resize_page', { pageId, width: 1440, height: 900 })
    }
    await new Promise((done) => setTimeout(done, 1500))
    return unwrapScript(await call('evaluate_script', { pageId, function: PAGE_AUDIT }))
  })

  for (const device of ['mobile', 'desktop']) {
    await step(`lighthouse_${device}`, async () =>
      call('lighthouse_audit', {
        pageId,
        mode: 'navigation',
        device,
      }),
    )
  }

  if (outFile) {
    writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
    console.log(`\n# informe: ${outFile}`)
  }

  console.log('\n=== RESUMEN ===')
  const mobile = report.mobile ?? {}
  const desktop = report.desktop ?? {}
  const line = (label, value) => console.log(`${label.padEnd(34)} ${value}`)
  line('fuente < 12px (móvil/escritorio)', `${mobile.smallFontsCount ?? '?'} / ${desktop.smallFontsCount ?? '?'}`)
  line('contraste insuficiente', `${mobile.lowContrastCount ?? '?'} / ${desktop.lowContrastCount ?? '?'}`)
  line('objetivos < 24px (móvil)', mobile.smallTargetsCount ?? '?')
  line('desborde horizontal', `${mobile.overflowX ?? '?'}px / ${desktop.overflowX ?? '?'}px`)
  line('h1 / encabezados', `${mobile.landmarks?.h1 ?? '?'} / ${mobile.headingCount ?? '?'}`)
} finally {
  client?.close()
}
