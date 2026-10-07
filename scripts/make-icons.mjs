/**
 * Genera los iconos PNG de la PWA sin dependencias externas:
 * fondo degradado con esquinas redondeadas y dos círculos superpuestos
 * (las dos personas que comparten los gastos).
 *
 *   node scripts/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public')

/* ------------------------------- PNG básico ------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0 // filtro none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* --------------------------------- diseño -------------------------------- */

const lerp = (a, b, t) => a + (b - a) * t

function makeIcon(size, { padding = 0.14, transparentCorners = true } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  const inset = size * padding
  const box = { x0: inset, y0: inset, x1: size - inset, y1: size - inset }
  const radius = (box.x1 - box.x0) * (transparentCorners ? 0.24 : 0.2)
  const cy = size / 2
  const circleRadius = size * 0.155
  const cx1 = size / 2 - size * 0.105
  const cx2 = size / 2 + size * 0.105
  const SS = 3

  const inRounded = (x, y) => {
    if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) return false
    const dx = Math.max(box.x0 + radius - x, 0, x - (box.x1 - radius))
    const dy = Math.max(box.y0 + radius - y, 0, y - (box.y1 - radius))
    return dx * dx + dy * dy <= radius * radius
  }

  const inCircle = (x, y, cx) => {
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= circleRadius * circleRadius
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let inside = 0
      let c1 = 0
      let c2 = 0
      const total = SS * SS
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (!transparentCorners || inRounded(px, py)) inside += 1
          if (inCircle(px, py, cx1)) c1 += 1
          if (inCircle(px, py, cx2)) c2 += 1
        }
      }

      const coverage = transparentCorners ? inside / total : 1
      const offset = (y * size + x) * 4
      if (coverage <= 0) {
        pixels[offset + 3] = 0
        continue
      }

      const t = (x + y) / (2 * size)
      let r = lerp(124, 240, t)
      let g = lerp(108, 87, t)
      let b = lerp(255, 124, t)

      const either = Math.max(c1, c2) / total
      const both = Math.min(c1, c2) / total
      const white = 0.5 * either + 0.42 * both
      r = lerp(r, 255, white)
      g = lerp(g, 255, white)
      b = lerp(b, 255, white)

      pixels[offset] = Math.round(r)
      pixels[offset + 1] = Math.round(g)
      pixels[offset + 2] = Math.round(b)
      pixels[offset + 3] = Math.round(coverage * 255)
    }
  }

  return encodePng(size, pixels)
}

mkdirSync(outDir, { recursive: true })

writeFileSync(resolve(outDir, 'icon-192.png'), makeIcon(192))
writeFileSync(resolve(outDir, 'icon-512.png'), makeIcon(512))
writeFileSync(resolve(outDir, 'icon-maskable-512.png'), makeIcon(512, { padding: 0.22 }))
writeFileSync(resolve(outDir, 'apple-touch-icon.png'), makeIcon(180, { padding: 0.08, transparentCorners: false }))

console.log('Iconos generados en public/: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png')
