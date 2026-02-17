/**
 * AgentLoop: 環境型AIエージェントのメインループ
 * ページ上の行動イベントをポーリングし、意図推論→Claude API→書き込みを実行
 */
import { createClient } from '@supabase/supabase-js'
import { inferIntent, type IntentResult } from './intent-engine'
import { generateAgentResponse } from './claude-client'
import { readPage } from './agent-writer'
import { resolveAction, agentDirectWrite, insertApprovalCard } from './agent-actions'
import type { Hocuspocus } from '@hocuspocus/server'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const POLL_INTERVAL_MS = 10_000 // 10秒

let hocuspocusInstance: Hocuspocus | null = null
export function setAgentLoopHocuspocus(instance: Hocuspocus) {
  hocuspocusInstance = instance
}

/** アクティブなループを管理 */
const activeLoops = new Map<string, ReturnType<typeof setInterval>>()

interface AgentConfig {
  pageId: string
  agentId: string
  agentName: string
  trustScore: number
}

/** Hocuspocusドキュメントのawarenessにエージェント状態を設定 */
function setAgentAwareness(pageId: string, agentName: string, status: 'online' | 'thinking' | 'offline') {
  if (!hocuspocusInstance) return
  try {
    const doc = (hocuspocusInstance as any).documents?.get(pageId)
    if (doc?.awareness) {
      // サーバー側のclientIDでエージェントプレゼンスを設定
      const awareness = doc.awareness
      const agentClientId = 999_000 + Math.abs(pageId.charCodeAt(0)) // 一意のclientID
      awareness.setLocalStateField('user', {
        name: agentName,
        color: '#8b5cf6',
        role: 'agent',
        status,
        isTyping: status === 'thinking',
      })
    }
  } catch {
    // awareness操作の失敗は致命的でない
  }
}

/** AgentLoopを開始 */
export function startAgentLoop(config: AgentConfig) {
  if (activeLoops.has(config.pageId)) return // 既に稼働中

  console.log(`[agent-loop] Starting for page=${config.pageId} agent=${config.agentName} trust=${config.trustScore}`)

  setAgentAwareness(config.pageId, config.agentName, 'online')
  const timer = setInterval(() => tick(config), POLL_INTERVAL_MS)
  activeLoops.set(config.pageId, timer)
}

/** AgentLoopを停止 */
export function stopAgentLoop(pageId: string) {
  const timer = activeLoops.get(pageId)
  if (timer) {
    clearInterval(timer)
    activeLoops.delete(pageId)
    setAgentAwareness(pageId, '', 'offline')
    console.log(`[agent-loop] Stopped for page=${pageId}`)
  }
}

/** 1ティック: イベント取得→意図推論→アクション */
async function tick(config: AgentConfig) {
  if (!supabase) return

  try {
    // 1. 直近の行動イベントを取得
    const since = new Date(Date.now() - 30_000).toISOString() // 直近30秒
    const { data: events } = await supabase
      .from('behavior_events')
      .select('event_type, payload, created_at')
      .eq('page_id', config.pageId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(50)

    if (!events || events.length === 0) return

    // 2. 意図推論
    const intent = await inferIntent(config.pageId, events)
    console.log(`[agent-loop] page=${config.pageId} intent=${intent.intent} confidence=${intent.confidence}`)

    // stuck/searching のみ介入
    if (intent.intent !== 'stuck' && intent.intent !== 'searching') return

    await act(config, intent, events)
  } catch (e) {
    console.error(`[agent-loop] tick error for page=${config.pageId}:`, e)
  }
}

/** アクション実行: Claude API呼び出し→書き込みorカード */
async function act(
  config: AgentConfig,
  intent: IntentResult,
  events: Array<{ event_type: string; payload: Record<string, unknown>; created_at: string }>
) {
  // ページ内容を取得
  const pageContent = await readPage(config.pageId)

  // 直近イベントのサマリ
  const recentEvents = events.slice(-10)
    .map(e => `${e.event_type} @ ${e.created_at}`)
    .join('\n')

  // Awareness: 考え中
  setAgentAwareness(config.pageId, config.agentName, 'thinking')

  // Claude API 呼び出し
  const response = await generateAgentResponse({
    pageContent,
    intent: intent.intent,
    confidence: intent.confidence,
    recentEvents,
    trustScore: config.trustScore,
    agentName: config.agentName,
  })

  if (!response) return

  console.log(`[agent-loop] DeepSeek response: "${response.text.substring(0, 80)}..." cost=¥${response.costJpy}`)

  // コスト追跡: agent_spend RPC
  if (supabase) {
    const { data: spendResult } = await supabase.rpc('agent_spend', {
      p_agent_id: config.agentId,
      p_amount: response.costJpy,
      p_description: `Intent: ${intent.intent}, tokens: ${response.inputTokens}+${response.outputTokens}`,
    })

    if (spendResult?.error) {
      console.warn(`[agent-loop] Budget exceeded: ${spendResult.error}`)
      stopAgentLoop(config.pageId)
      return
    }
  }

  // 信頼度に応じて直接書き込みor承認カード
  const actionType = resolveAction(config.trustScore, response.text.length)

  if (actionType === 'direct_write') {
    await agentDirectWrite(config.pageId, config.agentName, response.text)
    console.log(`[agent-loop] Direct write to page=${config.pageId}`)
  } else {
    const requestId = await insertApprovalCard({
      pageId: config.pageId,
      agentId: config.agentId,
      agentName: config.agentName,
      suggestion: response.text,
      intent: intent.intent,
      costJpy: response.costJpy,
    })
    console.log(`[agent-loop] Approval card inserted: ${requestId}`)
  }

  // Awareness: オンラインに戻す
  setAgentAwareness(config.pageId, config.agentName, 'online')
}
