/**
 * Envía las hojas de iconos a la cola de fal.ai y guarda los ids de trabajo.
 *
 *   node scripts/fal-submit-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GENERATION_INPUT, MODEL, SHEETS, buildPrompt } from './icon-sheets.mjs'
import { toolJson, withFal } from './lib/fal-mcp.mjs'

const jobsPath = resolve(import.meta.dirname, '../.fal-jobs.json')
const only = process.argv.slice(2)
const sheets = only.length > 0 ? SHEETS.filter((sheet) => only.includes(sheet.id)) : SHEETS

const jobs = await withFal(async (client) => {
  const submitted = []
  for (const sheet of sheets) {
    const prompt = buildPrompt(sheet)
    console.log(`\n→ ${sheet.id} · ${sheet.icons.length} iconos · ${prompt.length} caracteres de prompt`)
    const result = toolJson(
      await client.callTool('submit_job', {
        endpoint_id: MODEL,
        input: { ...GENERATION_INPUT, prompt },
      }),
    )
    console.log(JSON.stringify(result, null, 2))
    submitted.push({
      sheet: sheet.id,
      file: sheet.file,
      request_id: result?.request_id ?? null,
      status_url: result?.status_url ?? null,
      response_url: result?.response_url ?? null,
      submitted_at: new Date().toISOString(),
    })
  }
  return submitted
})

const previous = (() => {
  try {
    return JSON.parse(readFileSync(jobsPath, 'utf8'))
  } catch {
    return []
  }
})()

writeFileSync(
  jobsPath,
  `${JSON.stringify([...previous.filter((job) => !jobs.some((item) => item.sheet === job.sheet)), ...jobs], null, 2)}\n`,
)
console.log(`\nTrabajos guardados en ${jobsPath}`)
