/**
 * Cliente MCP mínimo sobre stdio (mensajes JSON-RPC delimitados por saltos de
 * línea). Sirve para hablar con servidores MCP locales como chrome-devtools-mcp.
 */
import { spawn } from 'node:child_process'

export class StdioMcp {
  #child
  #buffer = ''
  #pending = new Map()
  #nextId = 0

  constructor(command, args = [], options = {}) {
    this.#child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(options.env ?? {}) },
    })

    this.#child.stdout.setEncoding('utf8')
    this.#child.stdout.on('data', (chunk) => this.#onData(chunk))
    this.#child.stderr.setEncoding('utf8')
    this.#child.stderr.on('data', (chunk) => {
      if (process.env.MCP_DEBUG) process.stderr.write(`[mcp] ${chunk}`)
    })
    this.#child.on('exit', (code) => {
      for (const { reject } of this.#pending.values()) {
        reject(new Error(`el servidor MCP terminó con código ${code}`))
      }
      this.#pending.clear()
    })
  }

  #onData(chunk) {
    this.#buffer += chunk
    let index = this.#buffer.indexOf('\n')
    while (index >= 0) {
      const line = this.#buffer.slice(0, index).trim()
      this.#buffer = this.#buffer.slice(index + 1)
      if (line) {
        try {
          const message = JSON.parse(line)
          const entry = message.id !== undefined ? this.#pending.get(message.id) : undefined
          if (entry) {
            this.#pending.delete(message.id)
            if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
            else entry.resolve(message.result)
          }
        } catch {
          /* línea no JSON: se ignora */
        }
      }
      index = this.#buffer.indexOf('\n')
    }
  }

  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = (this.#nextId += 1)
      this.#pending.set(id, { resolve, reject })
      this.#child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
      setTimeout(() => {
        if (this.#pending.has(id)) {
          this.#pending.delete(id)
          reject(new Error(`timeout esperando ${method}`))
        }
      }, 120_000)
    })
  }

  notify(method, params = {}) {
    this.#child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }

  async connect() {
    const result = await this.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'dsh-budget-audit', version: '1.0.0' },
    })
    this.notify('notifications/initialized', {})
    return result
  }

  listTools() {
    return this.request('tools/list', {})
  }

  callTool(name, args = {}) {
    return this.request('tools/call', { name, arguments: args })
  }

  close() {
    this.#child.kill('SIGKILL')
  }
}

/** Extrae el JSON o el texto que devuelven las herramientas MCP. */
export function toolContent(result) {
  const parts = result?.content ?? []
  const text = parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
  if (!text) return result
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
