import type { Extension, onRequestPayload } from '@hocuspocus/server'
import { createClient } from '@supabase/supabase-js'
import { writeToPage, readPage } from '../agent-writer'
import { startAgentLoop, stopAgentLoop } from '../agent-loop'
import type { IncomingMessage, ServerResponse } from 'http'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

/** ページに割り当てられたエージェント情報をキャッシュ */
const pageAgents = new Map<string, { agentId: string; agentName: string; trustScore: number } | null>()

function parseBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk: Buffer) => { body += chunk.toString() })
    request.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) }
    })
    request.on('error', reject)
  })
}

export const agentBridgeExtension: Extension = {
  async onLoadDocument({ documentName }) {
    if (!supabase) return
    const { data } = await supabase
      .from('pages')
      .select('agent_id, agents(name, trust_score)')
      .eq('id', documentName)
      .single()

    if (data?.agent_id) {
      const agent = data.agents as unknown as { trust_score: number; name: string } | null
      const info = {
        agentId: data.agent_id,
        agentName: agent?.name ?? 'Agent',
        trustScore: agent?.trust_score ?? 0,
      }
      pageAgents.set(documentName, info)

      // AgentLoop を起動
      startAgentLoop({
        pageId: documentName,
        agentId: info.agentId,
        agentName: info.agentName,
        trustScore: info.trustScore,
      })
    } else {
      pageAgents.set(documentName, null)
    }
  },

  async afterUnloadDocument({ documentName }) {
    stopAgentLoop(documentName)
    pageAgents.delete(documentName)
  },

  async onRequest(data: onRequestPayload) {
    const { request, response } = data
    const url = new URL(request.url || '/', `http://${request.headers.host}`)

    if (url.pathname === '/api/agent-write' && request.method === 'POST') {
      await handleAgentWrite(request, response)
      // 空throwでデフォルトの"Welcome to Hocuspocus!"レスポンスを抑制
      throw null
    }
    if (url.pathname === '/api/agent-read' && request.method === 'POST') {
      await handleAgentRead(request, response)
      throw null
    }
  },
}

async function handleAgentWrite(request: IncomingMessage, response: ServerResponse) {
  try {
    const body = await parseBody(request)
    const { pageId, text } = body as { agentId?: string; pageId?: string; text?: string }

    if (!pageId || !text) {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'pageId and text are required' }))
      return
    }

    await writeToPage(pageId, text)
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ success: true }))
  } catch (e) {
    response.writeHead(500, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: String(e) }))
  }
}

async function handleAgentRead(request: IncomingMessage, response: ServerResponse) {
  try {
    const body = await parseBody(request)
    const { pageId } = body as { pageId?: string }

    if (!pageId) {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'pageId is required' }))
      return
    }

    const text = await readPage(pageId)
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ text }))
  } catch (e) {
    response.writeHead(500, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: String(e) }))
  }
}

export function getPageAgent(pageId: string) {
  return pageAgents.get(pageId) ?? null
}

export async function refreshPageAgent(pageId: string) {
  if (!supabase) return null
  const { data } = await supabase
    .from('pages')
    .select('agent_id, agents(name, trust_score)')
    .eq('id', pageId)
    .single()

  if (data?.agent_id) {
    const agent = data.agents as unknown as { name: string; trust_score: number } | null
    const info = { agentId: data.agent_id, agentName: agent?.name ?? 'Agent', trustScore: agent?.trust_score ?? 0 }
    pageAgents.set(pageId, info)
    return info
  }
  pageAgents.set(pageId, null)
  return null
}
