/**
 * Sondea los trabajos de fal.ai y descarga las hojas de iconos cuando terminan.
 *
 *   node scripts/fal-fetch-icons.mjs [minutos-maximos]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { toolJson, withFal } from './lib/fal-mcp.mjs'

const root = resolve(import.meta.dirname, '..')
const jobsPath = resolve(root, '.fal-jobs.json')
const outDir = resolve(root, 'assets/generated')
const maxMinutes = Number(process.argv[2] ?? 20)
const deadline = Date.now() + maxMinutes * 60_000

mkdirSync(outDir, { recursive: true })

const jobs = JSON.parse(readFileSync(jobsPath, 'utf8'))
console.log(`# ${jobs.length} trabajo(s) · esperando hasta ${maxMinutes} min`)

await withFal(async (client) => {
  const done = new Map()

  while (Date.now() < deadline && done.size < jobs.length) {
    for (const job of jobs) {
      if (done.has(job.sheet)) continue

      const status = toolJson(
        await client.callTool('check_job', {
          endpoint_id: 'openai/gpt-image-2.5/flare/text-to-image',
          request_id: job.request_id,
          status_url: job.status_url,
        }),
      )
      const state = status?.queue_status ?? status?.status ?? '?'
      console.log(`[${new Date().toISOString().slice(11, 19)}] ${job.sheet}: ${state}`)

      if (state === 'COMPLETED') {
        const result = toolJson(
          await client.callTool('get_job_result', {
            endpoint_id: 'openai/gpt-image-2.5/flare/text-to-image',
            request_id: job.request_id,
            response_url: job.response_url,
          }),
        )
        const image =
          result?.images?.[0] ??
          result?.result?.images?.[0] ??
          result?.data?.images?.[0] ??
          result?.data?.result?.images?.[0]
        if (!image?.url) {
          console.error(`# ${job.sheet}: resultado sin imagen —`, JSON.stringify(result).slice(0, 400))
          done.set(job.sheet, null)
          continue
        }
        const response = await fetch(image.url)
        if (!response.ok) throw new Error(`descarga fallida ${response.status}`)
        const bytes = Buffer.from(await response.arrayBuffer())
        const file = resolve(outDir, job.file)
        writeFileSync(file, bytes)
        console.log(`✓ ${job.sheet} → ${file} (${bytes.length} bytes, ${image.width}×${image.height})`)
        done.set(job.sheet, { file, url: image.url, width: image.width, height: image.height })
      } else if (state === 'FAILED' || status?.status === 'error') {
        console.error(`✗ ${job.sheet} falló:`, JSON.stringify(status).slice(0, 400))
        done.set(job.sheet, null)
      }
    }

    if (done.size < jobs.length) await new Promise((r) => setTimeout(r, 20_000))
  }

  const manifest = [...done.entries()].map(([sheet, info]) => ({ sheet, ...(info ?? {}) }))
  writeFileSync(resolve(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`# listo: ${manifest.filter((item) => item.file).length}/${jobs.length} descargadas`)

  if (!existsSync(resolve(outDir, 'manifest.json'))) {
    console.error('# no se pudo escribir el manifiesto')
    process.exitCode = 1
  }
})
