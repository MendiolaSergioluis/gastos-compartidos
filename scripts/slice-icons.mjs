/**
 * Recorta las hojas generadas por fal.ai en iconos individuales.
 *
 *   node scripts/slice-icons.mjs
 *
 * - Detecta si el PNG trae transparencia real; si no, recorta por color de fondo.
 * - Para cada celda calcula el rectángulo de tinta, lo centra en un cuadrado y
 *   lo reduce a 256×256 promediando áreas (sin alias).
 * - Escribe PNG monocromos (negro + alfa) listos para usar como `mask-image`.
 * - Genera una hoja de contacto para revisión visual y el manifiesto de iconos.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PNG } from 'pngjs'
import { GRID, SHEETS } from './icon-sheets.mjs'

const root = resolve(import.meta.dirname, '..')
const sourceDir = resolve(root, 'assets/generated')
const outDir = resolve(root, 'public/icons')
const OUTPUT_SIZE = 256
/** límite duro: ningún icono pasa de este porcentaje del lienzo */
const MAX_EXTENT = 0.92
/** tamaño óptico objetivo: media geométrica del rectángulo de tinta */
const TARGET_OPTICAL = 0.78
/** margen de la celda que no se escanea, para no capturar al vecino */
const INK_THRESHOLD = 0.12

mkdirSync(outDir, { recursive: true })

/* ------------------------------- utilidades ------------------------------ */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Extrae un canal de tinta (0..1) del PNG, con o sin transparencia real. */
function extractInk(png) {
  const { width, height, data } = png
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent += 1
  const transparencyRatio = transparent / (width * height)

  if (transparencyRatio > 0.02) {
    const ink = new Float32Array(width * height)
    for (let p = 0; p < width * height; p += 1) ink[p] = data[p * 4 + 3] / 255
    return { ink, mode: `transparencia real (${(transparencyRatio * 100).toFixed(1)} % de píxeles)` }
  }

  // Fondo opaco: se usa el color de la esquina como clave y la oscuridad como tinta.
  const corner = (x, y) => {
    const p = (y * width + x) * 4
    return luminance(data[p], data[p + 1], data[p + 2])
  }
  const background = Math.max(corner(2, 2), corner(width - 3, 2), corner(2, height - 3), corner(width - 3, height - 3))
  const ink = new Float32Array(width * height)
  for (let p = 0; p < width * height; p += 1) {
    const lum = luminance(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])
    ink[p] = clamp((background - lum) / Math.max(0.2, background), 0, 1)
  }
  return { ink, mode: `clave de fondo (luminancia ${background.toFixed(2)})` }
}

/**
 * Etiqueta las manchas de tinta de toda la hoja (8-conectividad). Así cada icono
 * se reconstruye con TODAS sus piezas (los rayos del foco, las almohadillas de la
 * huella) y se descarta cualquier resto que pertenezca al icono vecino.
 */
function labelComponents(ink, width, height) {
  const visited = new Uint8Array(width * height)
  const stack = new Int32Array(width * height)
  const components = []

  for (let start = 0; start < ink.length; start += 1) {
    if (visited[start] || ink[start] <= INK_THRESHOLD) continue

    let top = 0
    stack[top++] = start
    visited[start] = 1

    let area = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    let sumX = 0
    let sumY = 0

    while (top > 0) {
      const p = stack[--top]
      const x = p % width
      const y = (p - x) / width
      area += 1
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const np = ny * width + nx
          if (visited[np] || ink[np] <= INK_THRESHOLD) continue
          visited[np] = 1
          stack[top++] = np
        }
      }
    }

    components.push({
      area,
      minX,
      minY,
      maxX,
      maxY,
      centerX: sumX / area,
      centerY: sumY / area,
    })
  }

  return components
}

/** Reduce (o amplía) promediando el área cubierta: sin alias en los bordes. */
function resample(source, sourceWidth, sourceHeight, rect, outWidth, outHeight) {
  const out = new Float32Array(outWidth * outHeight)
  const scaleX = rect.width / outWidth
  const scaleY = rect.height / outHeight

  for (let y = 0; y < outHeight; y += 1) {
    const sy0 = rect.y + y * scaleY
    const sy1 = sy0 + scaleY
    for (let x = 0; x < outWidth; x += 1) {
      const sx0 = rect.x + x * scaleX
      const sx1 = sx0 + scaleX
      let acc = 0
      let area = 0
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy += 1) {
        const wy = Math.min(sy1, sy + 1) - Math.max(sy0, sy)
        if (wy <= 0) continue
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx += 1) {
          const wx = Math.min(sx1, sx + 1) - Math.max(sx0, sx)
          if (wx <= 0) continue
          const weight = wx * wy
          // fuera de la imagen cuenta como transparente, nunca se replica el borde
          const inside = sx >= 0 && sy >= 0 && sx < sourceWidth && sy < sourceHeight
          if (inside) acc += source[sy * sourceWidth + sx] * weight
          area += weight
        }
      }
      out[y * outWidth + x] = clamp(area > 0 ? acc / area : 0, 0, 1)
    }
  }
  return out
}

/** Coloca la tinta ya escalada en el centro de un lienzo cuadrado. */
function centerOnCanvas(alpha, width, height, size) {
  const canvas = new Uint8Array(size * size)
  const offsetX = Math.round((size - width) / 2)
  const offsetY = Math.round((size - height) / 2)
  for (let y = 0; y < height; y += 1) {
    const targetY = y + offsetY
    if (targetY < 0 || targetY >= size) continue
    for (let x = 0; x < width; x += 1) {
      const targetX = x + offsetX
      if (targetX < 0 || targetX >= size) continue
      canvas[targetY * size + targetX] = Math.round(alpha[y * width + x] * 255)
    }
  }
  return canvas
}

function encodeIcon(alpha, size) {
  const png = new PNG({ width: size, height: size })
  for (let p = 0; p < size * size; p += 1) {
    png.data[p * 4] = 0
    png.data[p * 4 + 1] = 0
    png.data[p * 4 + 2] = 0
    png.data[p * 4 + 3] = alpha[p]
  }
  return PNG.sync.write(png)
}

function encodeContactSheet(tiles, columns) {
  const tile = 128
  const gap = 12
  const rows = Math.ceil(tiles.length / columns)
  const width = columns * tile + (columns + 1) * gap
  const height = rows * tile + (rows + 1) * gap
  const png = new PNG({ width, height })

  for (let p = 0; p < width * height; p += 1) {
    png.data[p * 4] = 0xf4
    png.data[p * 4 + 1] = 0xf5
    png.data[p * 4 + 2] = 0xfb
    png.data[p * 4 + 3] = 255
  }

  tiles.forEach((alpha, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const originX = gap + column * (tile + gap)
    const originY = gap + row * (tile + gap)
    for (let y = 0; y < tile; y += 1) {
      for (let x = 0; x < tile; x += 1) {
        const a = alpha[y * tile + x] / 255
        const target = ((originY + y) * width + originX + x) * 4
        png.data[target] = Math.round(0x14 * a + png.data[target] * (1 - a))
        png.data[target + 1] = Math.round(0x17 * a + png.data[target + 1] * (1 - a))
        png.data[target + 2] = Math.round(0x2a * a + png.data[target + 2] * (1 - a))
        png.data[target + 3] = 255
      }
    }
  })

  return PNG.sync.write(png)
}

/* --------------------------------- proceso -------------------------------- */

const generated = []
const tiles = []
const warnings = []

for (const sheet of SHEETS) {
  const file = resolve(sourceDir, sheet.file)
  const png = PNG.sync.read(readFileSync(file))
  const { ink, mode } = extractInk(png)
  console.log(`\n=== ${sheet.id}: ${png.width}×${png.height} · ${mode}`)

  const expectedWidth = GRID.columns * GRID.cell
  const expectedHeight = GRID.rows * GRID.cell
  if (png.width !== expectedWidth || png.height !== expectedHeight) {
    warnings.push(
      `${sheet.id}: tamaño ${png.width}×${png.height}, se esperaba ${expectedWidth}×${expectedHeight}; se usa una grilla proporcional.`,
    )
  }

  const cellWidth = png.width / GRID.columns
  const cellHeight = png.height / GRID.rows
  const components = labelComponents(ink, png.width, png.height)
  console.log(`  ${components.length} manchas de tinta en la hoja`)

  sheet.icons.forEach((icon, index) => {
    const column = index % GRID.columns
    const row = Math.floor(index / GRID.columns)
    const cell = {
      x0: column * cellWidth,
      y0: row * cellHeight,
      x1: (column + 1) * cellWidth,
      y1: (row + 1) * cellHeight,
    }

    // solo las manchas cuyo centro de masa cae dentro de la celda: el icono
    // completo, sin restos del vecino
    const mine = components.filter(
      (part) => part.centerX >= cell.x0 && part.centerX < cell.x1 && part.centerY >= cell.y0 && part.centerY < cell.y1,
    )
    if (mine.length === 0) {
      warnings.push(`${sheet.id}/${icon.slug}: celda vacía, no se generó icono.`)
      return
    }

    // se descartan motas sueltas (ruido) pero se conservan piezas pequeñas
    // legítimas como los rayos del foco o las almohadillas de la huella
    const largest = Math.max(...mine.map((part) => part.area))
    const kept = mine.filter((part) => part.area >= Math.max(30, largest * 0.04))

    const bounds = {
      minX: Math.min(...kept.map((part) => part.minX)),
      minY: Math.min(...kept.map((part) => part.minY)),
      maxX: Math.max(...kept.map((part) => part.maxX)),
      maxY: Math.max(...kept.map((part) => part.maxY)),
    }

    const boxWidth = bounds.maxX - bounds.minX + 1
    const boxHeight = bounds.maxY - bounds.minY + 1

    // tamaño óptico: los iconos con el mismo "peso" se ven igual de grandes,
    // sin que ninguno se salga del lienzo
    const scale = Math.min(
      (OUTPUT_SIZE * MAX_EXTENT) / Math.max(boxWidth, boxHeight),
      (OUTPUT_SIZE * TARGET_OPTICAL) / Math.sqrt(boxWidth * boxHeight),
    )
    const outWidth = Math.max(1, Math.round(boxWidth * scale))
    const outHeight = Math.max(1, Math.round(boxHeight * scale))

    // pequeño margen alrededor de la tinta para que el suavizado no corte el borde
    const bleed = 3
    const sourceRect = {
      x: bounds.minX - bleed,
      y: bounds.minY - bleed,
      width: boxWidth + bleed * 2,
      height: boxHeight + bleed * 2,
    }
    const fullWidth = outWidth + bleed * 2
    const fullHeight = outHeight + bleed * 2

    const canvas = centerOnCanvas(
      resample(ink, png.width, png.height, sourceRect, fullWidth, fullHeight),
      fullWidth,
      fullHeight,
      OUTPUT_SIZE,
    )
    writeFileSync(resolve(outDir, `${icon.slug}.png`), encodeIcon(canvas, OUTPUT_SIZE))
    generated.push(icon.slug)

    const tileWidth = Math.max(1, Math.round((fullWidth * 128) / OUTPUT_SIZE))
    const tileHeight = Math.max(1, Math.round((fullHeight * 128) / OUTPUT_SIZE))
    tiles.push(
      centerOnCanvas(
        resample(ink, png.width, png.height, sourceRect, tileWidth, tileHeight),
        tileWidth,
        tileHeight,
        128,
      ),
    )

    const nearEdge =
      bounds.minX - cell.x0 < 3 ||
      bounds.minY - cell.y0 < 3 ||
      cell.x1 - bounds.maxX < 3 ||
      cell.y1 - bounds.maxY < 3
    if (nearEdge) {
      warnings.push(`${sheet.id}/${icon.slug}: la tinta llega al borde de su celda; revisa si el modelo la cortó.`)
    }

    console.log(
      `  \u2713 ${icon.slug.padEnd(10)} celda ${column},${row}  tinta ${boxWidth}\u00d7${boxHeight}  piezas ${kept.length}  lienzo ${outWidth}\u00d7${outHeight}`,
    )
  })
}

const columns = 8
writeFileSync(resolve(sourceDir, 'contact-sheet.png'), encodeContactSheet(tiles, columns))
writeFileSync(
  resolve(root, 'src/domain/icon-assets.ts'),
  `// GENERADO por scripts/slice-icons.mjs — no editar a mano.\n` +
    `/** Slugs con PNG disponible en public/icons/. */\n` +
    `export const GENERATED_ICON_SLUGS: readonly string[] = [\n${generated
      .map((slug) => `  '${slug}',`)
      .join('\n')}\n]\n`,
)

console.log(`\n${generated.length} iconos escritos en public/icons/`)
console.log(`Hoja de contacto: assets/generated/contact-sheet.png (${columns} por fila)`)
if (warnings.length > 0) {
  console.log('\nAvisos:')
  for (const warning of warnings) console.log(` - ${warning}`)
}
