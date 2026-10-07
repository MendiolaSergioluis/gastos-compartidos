/**
 * Cliente MCP mínimo para el servidor remoto de fal.ai.
 *
 *   node scripts/fal-mcp.mjs list
 *   node scripts/fal-mcp.mjs call <herramienta> '<json-de-argumentos>'
 *
 * La autenticación sale del helper de Claude Code (~/.claude/mcp-helpers/fal-headers.sh),
 * que lee la API key del Keychain de macOS. La key nunca se imprime.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const ENDPOINT = 'https://mcp.fal.ai/mcp'
const PROTOCOL = '2025-06-18'
const HEADERS_HELPER = resolve(homedir(), '.claude/mcp-helpers/fal-headers.sh')

function authHeaders() {
  if (existsSync(HEADERS_HELPER)) {
    const raw = execFileSync(HEADERS_HELPER, { encoding: 'utf8' })
    const parsed = JSON.parse(raw)
    if (parsed.Authorization) return parsed
  }
  const direct = process.env.FAL_KEY ?? process.env.FAL_API_KEY
  if (direct) return { Authorization: `Bearer ${direct}` }
  throw new Error(
    `No encontré credenciales de fal. Revisa ${HEADERS_HELPER} o exporta FAL_KEY.`,
  )
}

function parseBody(text, contentType) {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (contentType.includes('text/event-stream') || trimmed.startsWith('event:') || trimmed.startsWith('data:')) {
    const payloads = trimmed
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== '[DONE]')
    for (const payload of payloads.reverse()) {
      try {
        const parsed = JSON.parse(payload)
        if (parsed && (parsed.result !== undefined || parsed.error !== undefined)) return parsed
      } catch {
        /* sigue con el anterior */
      }
    }
    return null
  }
  return JSON.parse(trimmed)
}

class FalMcp {
  #sessionId = null
  #id = 0

  async #post(method, params, { notification = false } = {}) {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...authHeaders(),
    }
    if (this.#sessionId) headers['mcp-session-id'] = this.#sessionId

    const body = { jsonrpc: '2.0', method, ...(notification ? {} : { id: (this.#id += 1) }), params }
    const response = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) })
    const session = response.headers.get('mcp-session-id')
    if (session) this.#sessionId = session

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} en ${method}: ${text.slice(0, 400)}`)
    }
    if (notification) return null
    const parsed = parseBody(text, response.headers.get('content-type') ?? '')
    if (!parsed) throw new Error(`Respuesta sin JSON-RPC útil en ${method}: ${text.slice(0, 400)}`)
    if (parsed.error) throw new Error(`Error MCP en ${method}: ${JSON.stringify(parsed.error)}`)
    return parsed.result
  }

  async connect() {
    const result = await this.#post('initialize', {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: 'dsh-budget', version: '1.0.0' },
    })
    await this.#post('notifications/initialized', {}, { notification: true })
    return result
  }

  listTools() {
    return this.#post('tools/list', {})
  }

  callTool(name, args) {
    return this.#post('tools/call', { name, arguments: args })
  }
}

const [command, toolName, rawArgs] = process.argv.slice(2)

if (!command) {
  console.error('uso: node scripts/fal-mcp.mjs list | call <herramienta> \'<json>\'')
  process.exit(2)
}

const client = new FalMcp()
const server = await client.connect()
console.error(
  `# conectado a ${ENDPOINT} · servidor "${server?.serverInfo?.name ?? '?'}" v${server?.serverInfo?.version ?? '?'} · protocolo ${server?.protocolVersion ?? '?'}`,
)

if (command === 'list') {
  const { tools = [] } = await client.listTools()
  for (const tool of tools) {
    console.log(`\n### ${tool.name}`)
    console.log((tool.description ?? '').trim().split('\n').slice(0, 6).join('\n'))
    const props = tool.inputSchema?.properties ?? {}
    const required = new Set(tool.inputSchema?.required ?? [])
    const names = Object.keys(props)
    if (names.length > 0) {
      console.log('  argumentos:')
      for (const name of names) {
        const schema = props[name]
        const type = schema.type ?? (schema.anyOf ? 'anyOf' : '?')
        const options = schema.enum ? ` [${schema.enum.join(' | ')}]` : ''
        console.log(`    - ${name}: ${type}${options}${required.has(name) ? ' (requerido)' : ''}`)
      }
    }
  }
} else if (command === 'call' && toolName) {
  const args = rawArgs ? JSON.parse(rawArgs) : {}
  const result = await client.callTool(toolName, args)
  console.log(JSON.stringify(result, null, 2))
} else {
  console.error('comando no reconocido')
  process.exit(2)
}
