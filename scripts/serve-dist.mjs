/**
 * Sirve dist/ aplicando las MISMAS cabeceras y reglas que netlify.toml.
 *
 *   node scripts/serve-dist.mjs [puerto]
 *
 * Sirve para comprobar en local lo que hará Netlify: caché del service worker,
 * inmutabilidad de los assets, redirección de SPA y cabeceras de seguridad. Sin
 * esto, las cabeceras solo se estrenan en producción.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const port = Number(process.argv[2] ?? 4180)
const dist = resolve(import.meta.dirname, '../dist')

if (!existsSync(join(dist, 'index.html'))) {
  console.error('No hay build: ejecuta `npm run build` antes.')
  process.exit(1)
}

/* --------------------- lectura de las reglas del toml --------------------- */

const toml = readFileSync(resolve(import.meta.dirname, '../netlify.toml'), 'utf8')

/** Parser acotado a la forma que usa este archivo: bloques [[headers]] y [[redirects]]. */
function reglasDeCabeceras(texto) {
  const reglas = []
  const bloques = texto.split('[[headers]]').slice(1)
  for (const bloque of bloques) {
    const para = bloque.match(/for\s*=\s*"([^"]+)"/)?.[1]
    if (!para) continue
    const valores = {}
    const seccion = bloque.split('[headers.values]')[1]
    if (!seccion) continue
    for (const linea of seccion.split('\n')) {
      if (/^\s*\[/.test(linea)) break
      const par = linea.match(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"/)
      if (par) valores[par[1]] = par[2]
    }
    reglas.push({ para, valores })
  }
  return reglas
}

const CABECERAS = reglasDeCabeceras(toml)
if (CABECERAS.length === 0) {
  console.error('No pude leer cabeceras de netlify.toml')
  process.exit(1)
}
console.log(`# ${CABECERAS.length} reglas de cabeceras leídas de netlify.toml`)

/** Convierte un patrón de Netlify (`/assets/*`, `/workbox-*.js`) en expresión regular. */
function coincide(patron, ruta) {
  if (patron.endsWith('*') && !patron.slice(0, -1).includes('*')) {
    return ruta.startsWith(patron.slice(0, -1))
  }
  if (patron.includes('*')) {
    const regex = new RegExp(
      `^${patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`,
    )
    return regex.test(ruta)
  }
  return patron === ruta
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const servidor = createServer((peticion, respuesta) => {
  const url = new URL(peticion.url ?? '/', `http://localhost:${port}`)
  const ruta = url.pathname === '/' ? '/index.html' : url.pathname
  const archivo = join(dist, normalize(ruta).replace(/^(\.\.[/\\])+/, ''))

  const existe = existsSync(archivo) && statSync(archivo).isFile()
  // como Netlify: primero los archivos reales, la redirección solo como último recurso
  const destino = existe ? archivo : join(dist, 'index.html')
  const rutaEfectiva = existe ? ruta : '/index.html'

  const cabeceras = { 'Content-Type': TIPOS[extname(destino)] ?? 'application/octet-stream' }
  for (const regla of CABECERAS) {
    if (coincide(regla.para, rutaEfectiva)) Object.assign(cabeceras, regla.valores)
  }

  respuesta.writeHead(200, cabeceras)
  createReadStream(destino).pipe(respuesta)
})

servidor.listen(port, () => {
  console.log(`# dist servido en http://localhost:${port} con las cabeceras de Netlify`)
})
