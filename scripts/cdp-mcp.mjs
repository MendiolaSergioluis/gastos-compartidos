/**
 * CLI para el MCP de chrome-devtools.
 *
 *   node scripts/cdp-mcp.mjs list
 *   node scripts/cdp-mcp.mjs call <herramienta> '<json>'
 *   node scripts/cdp-mcp.mjs audit <url> [ancho] [alto]     # auditoría completa
 *
 * El paquete se ejecuta con npx; la caché de npm se redirige a un directorio
 * temporal porque el sandbox no deja escribir en ~/.npm.
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StdioMcp, toolContent } from './lib/stdio-mcp.mjs'

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export function startCdpMcp() {
  const profile = process.env.CDP_PROFILE ?? join(process.cwd(), '.chrome-mcp')
  return new StdioMcp(
    'npx',
    [
      '-y',
      'chrome-devtools-mcp@latest',
      '--headless=true',
      // sin --isolated: el perfil propio vive dentro del workspace porque el
      // directorio por defecto (~/.cache) no es escribible en el sandbox
      `--userDataDir=${profile}`,
      '--viewport=1440x900',
      '--usageStatistics=false',
      '--chromeArg=--no-sandbox',
      '--chromeArg=--disable-dev-shm-usage',
      `--executablePath=${CHROME}`,
    ],
    {
      env: {
        npm_config_cache: join(tmpdir(), 'dsh-npm-cache'),
        CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1',
      },
    },
  )
}

const isMain = process.argv[1] && process.argv[1].endsWith('cdp-mcp.mjs')
const [command, toolName, rawArgs] = isMain ? process.argv.slice(2) : []

if (isMain && command) {
  const client = startCdpMcp()
  try {
    const server = await client.connect()
    console.error(
      `# chrome-devtools-mcp conectado · ${server?.serverInfo?.name ?? '?'} v${server?.serverInfo?.version ?? '?'}`,
    )

    if (command === 'list') {
      const { tools = [] } = await client.listTools()
      for (const tool of tools) {
        const props = Object.keys(tool.inputSchema?.properties ?? {})
        const required = new Set(tool.inputSchema?.required ?? [])
        console.log(`\n### ${tool.name}`)
        console.log((tool.description ?? '').split('\n')[0])
        if (props.length > 0) {
          console.log(
            '  args: ' +
              props.map((name) => `${name}${required.has(name) ? '*' : ''}`).join(', '),
          )
        }
      }
    } else if (command === 'call' && toolName) {
      const result = await client.callTool(toolName, rawArgs ? JSON.parse(rawArgs) : {})
      console.log(typeof result === 'string' ? result : JSON.stringify(toolContent(result), null, 2))
    } else {
      console.error('comando no reconocido')
      process.exitCode = 2
    }
  } finally {
    client.close()
  }
}
