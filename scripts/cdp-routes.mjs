/**
 * Comprobación programática de todas las rutas y tamaños con el MCP de
 * chrome-devtools: una sola sesión, sin relanzar el navegador.
 *
 *   node scripts/cdp-routes.mjs [base] [salida.json]
 *
 * Revisa en cada ruta y viewport: desborde horizontal, contraste, tamaños de
 * letra, objetivos táctiles, encabezados, etiquetas e ids duplicados.
 */
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { rmSync } from 'node:fs'
import { startCdpMcp } from './cdp-mcp.mjs'
import { toolContent } from './lib/stdio-mcp.mjs'
import { unwrapScript } from './cdp-audit.mjs'

const base = process.argv[2] ?? 'http://localhost:4174/'
const outFile = process.argv[3] ? resolve(process.argv[3]) : null

const ROUTES = ['resumen', 'mes', 'gastos', 'metas', 'historial', 'ajustes']
const VIEWPORTS = [
  { name: 'movil', value: '390x844x2,mobile,touch' },
  { name: 'escritorio', value: '1440x900x1' },
]

/** Se ejecuta en la página y devuelve los hallazgos. */
const CHECK = `() => {
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
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  const flat = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  const bgOf = (el) => {
    let node = el
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor)
      if (c && c.a > 0.6) return c
      node = node.parentElement
    }
    return { r: 8, g: 10, b: 20, a: 1 }
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05
  }
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
  const small = [], lowContrast = [], targets = [], unlabeled = []
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    if (hasText(el)) {
      const size = parseFloat(cs.fontSize)
      const weight = +cs.fontWeight || 400
      const color = parse(cs.color)
      if (color) {
        const bg = bgOf(el)
        const ratio = contrast(flat(color, bg), bg)
        const large = size >= 24 || (size >= 18.66 && weight >= 700)
        if (ratio < (large ? 3 : 4.5)) lowContrast.push({ ratio: +ratio.toFixed(2), size, text: el.textContent.trim().slice(0, 30) })
      }
      if (size < 12) small.push({ size, text: el.textContent.trim().slice(0, 30) })
    }
    const tag = el.tagName.toLowerCase()
    const interactive = tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea' || ['button', 'switch'].includes(el.getAttribute('role'))
    if (interactive) {
      const r = el.getBoundingClientRect()
      if (r.height < 24 || r.width < 24) targets.push({ w: Math.round(r.width), h: Math.round(r.height), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24) })
      if (['input', 'select', 'textarea'].includes(tag)) {
        const id = el.id
        const ok = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (id && document.querySelector('label[for="' + id + '"]')) || el.closest('label')
        if (!ok) unlabeled.push(tag + ':' + (el.getAttribute('type') || ''))
      }
    }
  }
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((h) => +h.tagName[1])
  let jump = false
  for (let i = 1; i < heads.length; i += 1) if (heads[i] - heads[i - 1] > 1) jump = true
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
  return {
    w: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    contrast: lowContrast.length,
    contrastSample: lowContrast.slice(0, 3),
    tiny: small.length,
    tinySample: small.slice(0, 2),
    targets: targets.length,
    targetsSample: targets.slice(0, 3),
    unlabeled: unlabeled.length,
    headings: heads.length,
    h1: heads.filter((l) => l === 1).length,
    headingJump: jump,
    duplicates: [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].length,
  }
}`

const profile = process.env.CDP_PROFILE ?? join(process.cwd(), '.chrome-mcp')
rmSync(profile, { recursive: true, force: true })

const client = startCdpMcp()
const results = []

async function call(name, args, attempts = 12) {
  let last
  for (let i = 0; i < attempts; i += 1) {
    try {
      const value = toolContent(await client.callTool(name, args))
      if (typeof value === 'string' && value.includes('too early')) last = new Error(value)
      else return value
    } catch (error) {
      last = error
    }
    await new Promise((done) => setTimeout(done, 1500))
  }
  throw last ?? new Error(`sin respuesta de ${name}`)
}

try {
  const server = await client.connect()
  console.log(`# chrome-devtools-mcp ${server?.serverInfo?.version ?? '?'}\n`)

  const pages = await call('list_pages', {})
  const pageId = Number(String(pages).match(/^(\d+):/m)?.[1] ?? 1)

  for (const viewport of VIEWPORTS) {
    await call('emulate', { pageId, viewport: viewport.value })
    for (const route of ROUTES) {
      await call('navigate_page', {
        pageId,
        type: 'url',
        url: `${base}#${route}`,
        ignoreCache: true,
      })
      // 1,5 s: la animación de entrada escalonada dura ~600 ms y mientras
      // corre los elementos tienen opacity 0, lo que falseaba el chequeo de
      // encabezados (parecían saltos de nivel que no existen)
      await new Promise((done) => setTimeout(done, 1500))
      const report = unwrapScript(await call('evaluate_script', { pageId, function: CHECK }))
      results.push({ viewport: viewport.name, route, ...report })
      const bad =
        report.overflow > 0 || report.contrast > 0 || report.targets > 0 || report.unlabeled > 0 || report.headingJump || report.duplicates > 0
      console.log(
        `${bad ? '⚠' : '✓'} ${viewport.name.padEnd(11)} ${route.padEnd(10)} ` +
          `desborde ${String(report.overflow).padStart(2)}  contraste ${String(report.contrast).padStart(2)}  ` +
          `<12px ${String(report.tiny).padStart(2)}  objetivos ${report.targets}  h1 ${report.h1}  encabezados ${report.headings}`,
      )
      if (report.contrastSample?.length) console.log('    contraste:', JSON.stringify(report.contrastSample))
      if (report.targetsSample?.length) console.log('    objetivos:', JSON.stringify(report.targetsSample))
    }
  }

  const problems = results.filter(
    (r) => r.overflow > 0 || r.contrast > 0 || r.targets > 0 || r.unlabeled > 0 || r.headingJump || r.duplicates > 0,
  )
  console.log(
    `\n${problems.length === 0 ? '✓ sin problemas' : `⚠ ${problems.length} rutas con hallazgos`} en ${results.length} comprobaciones`,
  )

  if (outFile) {
    writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`)
    console.log(`# informe: ${outFile}`)
  }
} finally {
  client.close()
}
