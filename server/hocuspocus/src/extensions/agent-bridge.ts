import type { Extension, onRequestPayload } from '@hocuspocus/server'
import { writeToPage, readPage } from '../agent-writer'
import { registerAgent, unregisterAgent } from '../agent-loop'
import { getLatestSuggestion } from '../handlers/input-pause-handler'
import { getTransitionSuggestion } from '../handlers/page-transition-handler'
import { dispatch, type AgentEvent } from '../event-router'
import { extractLLMConfig } from '../llm-client'
import { supabase, supabaseKey } from '../supabase'
import type { IncomingMessage, ServerResponse } from 'http'

// Internal API auth: requests must include this secret
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || supabaseKey

/** ページに割り当てられたエージェント情報をキャッシュ */
const pageAgents = new Map<string, { agentId: string; agentName: string; trustScore: number; isAmbient?: boolean; ownerId?: string; llmConfig?: import('../llm-client').LLMConfig } | null>()

/** Hocuspocusドキュメント参照（broadcastStateless用） */
const documentInstances = new Map<string, { broadcastStateless(payload: string): void }>()

export function getDocumentInstance(pageId: string) {
  return documentInstances.get(pageId) ?? null
}

function verifyInternalAuth(request: IncomingMessage): boolean {
  const authHeader = request.headers['authorization'] || ''
  return authHeader === `Bearer ${INTERNAL_API_SECRET}`
}

const MAX_BODY_SIZE = 1024 * 1024 // 1MB limit

function parseBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_SIZE) {
        request.destroy()
        reject(new Error('Body too large'))
        return
      }
      body += chunk.toString()
    })
    request.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) }
    })
    request.on('error', reject)
  })
}

export const agentBridgeExtension: Extension = {
  async onLoadDocument({ documentName, document }: { documentName: string; document: { broadcastStateless(payload: string): void } }) {
    documentInstances.set(documentName, document)

    if (!supabase) return
    const { data } = await supabase
      .from('pages')
      .select('agent_id, owner_id, agents(name, trust_score, config)')
      .eq('id', documentName)
      .single()

    if (data?.agent_id) {
      const agent = data.agents as unknown as { trust_score: number; name: string; config: Record<string, unknown> } | null
      const isAmbient = agent?.config?.type === 'ambient'
      const llmConfig = agent?.config ? extractLLMConfig(agent.config) : undefined
      const info = {
        agentId: data.agent_id,
        agentName: agent?.name ?? 'Agent',
        trustScore: agent?.trust_score ?? 0,
        isAmbient,
        ownerId: data.owner_id as string | undefined,
        llmConfig,
      }
      pageAgents.set(documentName, info)

      // AgentLoop を起動
      registerAgent({
        pageId: documentName,
        agentId: info.agentId,
        agentName: info.agentName,
        trustScore: info.trustScore,
        isAmbient,
        ownerId: info.ownerId,
      })
    } else {
      pageAgents.set(documentName, null)
    }
  },

  async afterUnloadDocument({ documentName }: { documentName: string }) {
    unregisterAgent(documentName)
    pageAgents.delete(documentName)
    documentInstances.delete(documentName)
  },

  async onStateless({ payload, document, documentName }: { payload: string; document: { broadcastStateless(p: string): void }; documentName: string }) {
    if (document && documentName) {
      documentInstances.set(documentName, document)
    }
    try {
      const event = JSON.parse(payload) as { type: string; [key: string]: unknown }
      if (event.type === 'agentEvent') {
        const agentEvent = event.data as AgentEvent
        const pageId = agentEvent.pageId || documentName
        const agentInfo = pageAgents.get(pageId)
        if (agentInfo) {
          dispatch(agentEvent, { ...agentInfo, pageId })
        }
      }
    } catch {
      // invalid JSON or missing fields — ignore
    }
  },

  async onRequest(data: onRequestPayload) {
    const { request, response } = data
    const url = new URL(request.url || '/', `http://${request.headers.host}`)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      response.end()
      throw null
    }

    if (url.pathname === '/api/agent-write' && request.method === 'POST') {
      if (!verifyInternalAuth(request)) {
        response.writeHead(401, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'Unauthorized' }))
        throw null
      }
      await handleAgentWrite(request, response)
      throw null
    }
    if (url.pathname === '/api/agent-read' && request.method === 'POST') {
      if (!verifyInternalAuth(request)) {
        response.writeHead(401, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'Unauthorized' }))
        throw null
      }
      await handleAgentRead(request, response)
      throw null
    }
    // 提案取得API（フロントエンドから呼ばれる）
    if (url.pathname === '/api/suggest' && request.method === 'POST') {
      await handleSuggest(request, response)
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

async function handleSuggest(request: IncomingMessage, response: ServerResponse) {
  try {
    const body = await parseBody(request)
    const { pageId } = body as { pageId?: string }

    if (!pageId) {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'pageId is required' }))
      return
    }

    const suggestion = getLatestSuggestion(pageId) || getTransitionSuggestion(pageId)
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    response.end(JSON.stringify({ suggestion: suggestion || '' }))
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
