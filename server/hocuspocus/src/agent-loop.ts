/**
 * AgentLoop: 環境型AIエージェントのメインループ
 * 通常エージェント: 行動イベントをポーリングし、意図推論→DeepSeek→書き込み
 * ambient エージェント: 全会話コンテキストを集約してユーザーのクローンとして振る舞う
 */
import { inferIntent, clearInferenceCache, type IntentResult } from './intent-engine'
import { generateAgentResponse, generateAmbientResponse } from './deepseek-client'
import { readPage } from './agent-writer'
import { resolveAction, agentDirectWrite, insertApprovalCard } from './agent-actions'
import { supabase } from './supabase'
import type { Hocuspocus } from '@hocuspocus/server'

const POLL_INTERVAL_MS = 10_000 // 10秒

let hocuspocusInstance: Hocuspocus | null = null
export function setAgentLoopHocuspocus(instance: Hocuspocus) {
  hocuspocusInstance = instance
}

/** アクティブなループを管理 */
const activeLoops = new Map<string, ReturnType<typeof setTimeout>>()

interface AgentConfig {
  pageId: string
  agentId: string
  agentName: string
  trustScore: number
  isAmbient?: boolean
  ownerId?: string
}

/** Hocuspocusドキュメントのawarenessにエージェント状態を設定 */
function setAgentAwareness(pageId: string, agentName: string, status: 'online' | 'thinking' | 'offline') {
  if (!hocuspocusInstance) return
  try {
    const doc = (hocuspocusInstance as any).documents?.get(pageId)
    if (doc?.awareness) {
      // サーバー側のclientIDでエージェントプレゼンスを設定
      const awareness = doc.awareness
      // Generate stable unique clientID from full pageId hash
      let hash = 0
      for (let i = 0; i < pageId.length; i++) {
        hash = ((hash << 5) - hash + pageId.charCodeAt(i)) | 0
      }
      const agentClientId = 999_000 + Math.abs(hash % 100_000)
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
  // Use setTimeout chain instead of setInterval to prevent overlapping ticks
  const scheduleNext = () => {
    const timer = setTimeout(async () => {
      await tick(config)
      if (activeLoops.has(config.pageId)) scheduleNext()
    }, POLL_INTERVAL_MS)
    activeLoops.set(config.pageId, timer)
  }
  scheduleNext()
}

/** AgentLoopを停止 */
export function stopAgentLoop(pageId: string) {
  const timer = activeLoops.get(pageId)
  if (timer) {
    clearTimeout(timer)
    activeLoops.delete(pageId)
    clearInferenceCache(pageId)
    setAgentAwareness(pageId, '', 'offline')
    console.log(`[agent-loop] Stopped for page=${pageId}`)
  }
}

/** 1ティック: イベント取得→意図推論→アクション */
async function tick(config: AgentConfig) {
  if (!supabase) return

  // ambient エージェントは専用tickへ
  if (config.isAmbient) {
    await ambientTick(config)
    return
  }

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

// ============================================================
// Ambient Agent: クロスコンテキスト集約ティック
// ============================================================

/** 最新の提案をキャッシュ（APIから取得用） */
const latestSuggestions = new Map<string, { text: string; generatedAt: number }>()

export function getLatestSuggestion(pageId: string): string | null {
  const s = latestSuggestions.get(pageId)
  if (!s) return null
  // 30秒以内の提案のみ有効
  if (Date.now() - s.generatedAt > 30_000) {
    latestSuggestions.delete(pageId)
    return null
  }
  return s.text
}

/** クロスコンテキスト要約を取得 */
async function getCrossContextSummaries(userId: string): Promise<string> {
  if (!supabase) return ''
  const { data } = await supabase
    .from('user_context_summaries')
    .select('summary, conversation_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!data || data.length === 0) return ''
  return data.map(d => d.summary).join('\n---\n')
}

/** ユーザーのプロフィール名を取得 */
async function getUserDisplayName(userId: string): Promise<string> {
  if (!supabase) return ''
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()
  return data?.display_name || ''
}

/** ambient エージェント専用tick */
async function ambientTick(config: AgentConfig) {
  if (!supabase || !config.ownerId) return

  try {
    // 1. ページ内容を取得
    const pageContent = await readPage(config.pageId)
    if (!pageContent || pageContent.trim().length < 5) return

    // 2. クロスコンテキスト要約取得
    const crossContext = await getCrossContextSummaries(config.ownerId)

    // 3. ユーザー名取得
    const userName = await getUserDisplayName(config.ownerId)

    // 4. Awareness: 考え中
    setAgentAwareness(config.pageId, config.agentName, 'thinking')

    // 5. 環境エージェント専用レスポンス生成
    const response = await generateAmbientResponse({
      pageContent,
      crossContextSummaries: crossContext,
      userName: userName || 'ユーザー',
      agentName: config.agentName,
    })

    if (response?.text) {
      // 提案をキャッシュ（suggest APIから取得される）
      latestSuggestions.set(config.pageId, {
        text: response.text,
        generatedAt: Date.now(),
      })
      console.log(`[agent-loop] Ambient suggestion cached for page=${config.pageId}: "${response.text.substring(0, 50)}..."`)

      // コスト追跡
      if (response.costJpy > 0) {
        await supabase.rpc('agent_spend', {
          p_agent_id: config.agentId,
          p_amount: response.costJpy,
          p_description: `Ambient suggestion, tokens: ${response.inputTokens}+${response.outputTokens}`,
        })
      }
    }

    setAgentAwareness(config.pageId, config.agentName, 'online')
  } catch (e) {
    console.error(`[agent-loop] ambient tick error for page=${config.pageId}:`, e)
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
