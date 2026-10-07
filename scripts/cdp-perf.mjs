/**
 * Medición de rendimiento con el MCP de chrome-devtools.
 *
 *   node scripts/cdp-perf.mjs [url]
 *
 * Instala observadores ANTES de que cargue la página (initScript) para capturar
 * LCP, CLS y tareas largas, y luego resume recursos por peso y por tiempo.
 */
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { startCdpMcp } from './cdp-mcp.mjs'
import { toolContent } from './lib/stdio-mcp.mjs'
import { unwrapScript } from './cdp-audit.mjs'

const url = process.argv[2] ?? 'http://localhost:4174/'

const OBSERVERS = `
  window.__perf = { lcp: 0, cls: 0, longTasks: [], fps: [] }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') window.__perf.lcp = entry.startTime
      if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) window.__perf.cls += entry.value
      if (entry.entryType === 'longtask') window.__perf.longTasks.push(Math.round(entry.duration))
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) window.__perf.cls += entry.value
      if (entry.entryType === 'longtask') window.__perf.longTasks.push(Math.round(entry.duration))
    }
  }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__perf.longTasks.push(Math.round(entry.duration))
  }).observe({ type: 'longtask', buffered: true })
`

const READ = `() => {
  const nav = performance.getEntriesByType('navigation')[0] ?? {}
  const resources = performance.getEntriesByType('resource')
  const bySize = resources
    .map((r) => ({ name: r.name.split('/').pop(), size: r.transferSize || r.decodedBodySize || 0, ms: Math.round(r.duration) }))
    .sort((a, b) => b.size - a.size)
  const paint = performance.getEntriesByType('paint').map((p) => ({ name: p.name, ms: Math.round(p.startTime) }))
  return {
    lcp: Math.round(window.__perf?.lcp ?? 0),
    cls: +(window.__perf?.cls ?? 0).toFixed(4),
    longTasks: window.__perf?.longTasks ?? [],
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd ?? 0),
    load: Math.round(nav.loadEventEnd ?? 0),
    transferTotal: resources.reduce((acc, r) => acc + (r.transferSize || 0), 0),
    paint,
    heaviest: bySize.slice(0, 8),
    resources: resources.length,
  }
}`

const profile = process.env.CDP_PROFILE ?? join(process.cwd(), '.chrome-mcp')
rmSync(profile, { recursive: true, force: true })

const client = startCdpMcp()

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
  await client.connect()
  const pages = await call('list_pages', {})
  const pageId = Number(String(pages).match(/^(\d+):/m)?.[1] ?? 1)

  const reports = {}
  for (const device of ['movil', 'escritorio']) {
    await call('emulate', { pageId, viewport: device === 'movil' ? '390x844x3,mobile,touch' : '1440x900x1' })
    // primera carga en frío, con los observadores ya instalados
    await call('navigate_page', { pageId, type: 'url', url: 'about:blank' })
    const result = await call('navigate_page', {
      pageId,
      type: 'url',
      url,
      ignoreCache: true,
      initScript: OBSERVERS,
    })
    void result
    await new Promise((done) => setTimeout(done, 3500))
    reports[device] = unwrapScript(await call('evaluate_script', { pageId, function: READ }))

    // segunda carga, ya con el service worker y la caché en su sitio
    await call('navigate_page', { pageId, type: 'url', url })
    await new Promise((done) => setTimeout(done, 3000))
    reports[`${device}_cacheada`] = unwrapScript(await call('evaluate_script', { pageId, function: READ }))
  }

  for (const [device, report] of Object.entries(reports)) {
    console.log(`\n=== ${device} ===`)
    console.log(`LCP ${report.lcp} ms · CLS ${report.cls} · DOMContentLoaded ${report.domContentLoaded} ms · load ${report.load} ms`)
    console.log(`tareas largas: ${report.longTasks.length ? report.longTasks.join(', ') + ' ms' : 'ninguna'}`)
    console.log(`recursos: ${report.resources} · transferido ${(report.transferTotal / 1024).toFixed(1)} kB`)
    console.log(`pintados: ${report.paint.map((p) => `${p.name} ${p.ms}ms`).join(' · ')}`)
    console.log('más pesados:')
    for (const item of report.heaviest) {
      console.log(`  ${String(item.size).padStart(8)} B  ${String(item.ms).padStart(4)} ms  ${item.name}`)
    }
  }
} finally {
  client.close()
}
