import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { McpServerConfig } from '@shared/domain'

/**
 * A thin, resilient wrapper around one MCP server (streamable-http transport).
 * Connections are lazy and self-healing: a failed call drops the client so the
 * next call reconnects. All errors are surfaced to callers as thrown errors so
 * the agent layer can degrade gracefully.
 */
export class McpConnection {
  private client: Client | null = null
  private connecting: Promise<Client> | null = null
  private toolNames: string[] = []

  constructor(
    public readonly label: string,
    private config: McpServerConfig
  ) {}

  updateConfig(config: McpServerConfig): void {
    const changed = config.url !== this.config.url || config.accessToken !== this.config.accessToken
    this.config = config
    if (changed) this.reset()
  }

  get enabled(): boolean {
    return this.config.enabled && !!this.config.url
  }

  private reset(): void {
    if (this.client) {
      this.client.close().catch(() => {})
    }
    this.client = null
    this.connecting = null
    this.toolNames = []
  }

  private async getClient(): Promise<Client> {
    if (this.client) return this.client
    if (this.connecting) return this.connecting
    this.connecting = this.openClient()
    try {
      this.client = await this.connecting
      return this.client
    } finally {
      this.connecting = null
    }
  }

  private async openClient(): Promise<Client> {
    const headers: Record<string, string> = {}
    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`
    }
    const transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: { headers }
    })
    const client = new Client({ name: 'open-co-scientist', version: '0.1.0' })
    await client.connect(transport)
    const tools = await client.listTools()
    this.toolNames = tools.tools.map((t) => t.name)
    return client
  }

  /** Connect (if needed) and report the available tools. */
  async test(): Promise<{ ok: boolean; message: string; toolCount?: number; tools?: { name: string; description?: string }[] }> {
    if (!this.enabled) {
      return { ok: false, message: 'Server is disabled in Settings.' }
    }
    try {
      const client = await this.getClient()
      const res = await client.listTools()
      this.toolNames = res.tools.map((t) => t.name)
      return {
        ok: true,
        message: `Connected to ${this.config.url}`,
        toolCount: res.tools.length,
        tools: res.tools.map((t) => ({ name: t.name, description: t.description ?? undefined }))
      }
    } catch (err) {
      this.reset()
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  hasTool(name: string): boolean {
    return this.toolNames.includes(name)
  }

  /** Call a tool and return the concatenated text content. */
  async callText(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.enabled) throw new Error(`${this.label} is disabled`)
    const client = await this.getClient()
    try {
      const res: any = await client.callTool({ name, arguments: args })
      if (res?.isError) {
        throw new Error(textOf(res) || 'tool reported an error')
      }
      return textOf(res)
    } catch (err) {
      // Drop the client so the next call reconnects.
      this.reset()
      throw err
    }
  }
}

function textOf(res: any): string {
  if (!res?.content) return ''
  return res.content
    .filter((c: any) => c?.type === 'text')
    .map((c: any) => c.text)
    .join('\n')
}

/** A pack-declared tool the manager should hold a connection for. */
export interface ToolDef {
  id: string
  label: string
  defaultConfig: McpServerConfig
}

const DEEP_RESEARCH_DEFAULT: McpServerConfig = { enabled: false, url: 'http://127.0.0.1:3000/api/mcp' }

/**
 * Owns the shared deep-research connection plus one connection per pack-declared
 * tool (keyed by tool id), and lets the engine reconfigure them live. Server
 * configs are keyed by id in {@link McpServerConfig} settings; `deepResearch` is
 * the reserved core key.
 */
export class McpManager {
  readonly deepResearch: McpConnection
  private toolConns = new Map<string, McpConnection>()

  constructor(mcp: Record<string, McpServerConfig>, tools: ToolDef[]) {
    this.deepResearch = new McpConnection('Deep Research', mcp.deepResearch ?? DEEP_RESEARCH_DEFAULT)
    for (const t of tools) {
      this.toolConns.set(t.id, new McpConnection(t.label, mcp[t.id] ?? t.defaultConfig))
    }
  }

  update(mcp: Record<string, McpServerConfig>, tools: ToolDef[]): void {
    this.deepResearch.updateConfig(mcp.deepResearch ?? DEEP_RESEARCH_DEFAULT)
    for (const t of tools) {
      const existing = this.toolConns.get(t.id)
      if (existing) existing.updateConfig(mcp[t.id] ?? t.defaultConfig)
      else this.toolConns.set(t.id, new McpConnection(t.label, mcp[t.id] ?? t.defaultConfig))
    }
  }

  /** A pack tool connection by tool id. */
  tool(id: string): McpConnection | undefined {
    return this.toolConns.get(id)
  }

  /** Resolve any server connection by its settings id (`deepResearch` or a tool id). */
  byServerId(id: string): McpConnection | undefined {
    return id === 'deepResearch' ? this.deepResearch : this.toolConns.get(id)
  }
}
