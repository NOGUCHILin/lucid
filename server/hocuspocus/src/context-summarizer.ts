/**
 * コンテキスト要約ジョブ
 * 5分間隔で各ユーザーの全会話テキストを要約し、user_context_summaries に保存
 */
import { supabase } from './supabase'
import { readPage } from './agent-writer'
import { generateContextSummary } from './deepseek-client'

const SUMMARIZE_INTERVAL_MS = 5 * 60 * 1000 // 5分

let timer: ReturnType<typeof setInterval> | null = null

export function startContextSummarizer() {
  if (timer) return
  console.log('[context-summarizer] Starting (interval: 5min)')
  timer = setInterval(summarizeAll, SUMMARIZE_INTERVAL_MS)
  // 初回は30秒後に実行
  setTimeout(summarizeAll, 30_000)
}

export function stopContextSummarizer() {
  if (timer) {
    clearInterval(timer)
    timer = null
    console.log('[context-summarizer] Stopped')
  }
}

async function summarizeAll() {
  if (!supabase) return

  try {
    // ambient エージェントを持つユーザーを取得
    const { data: ambientAgents } = await supabase
      .from('agents')
      .select('id, owner_id')
      .eq('config->>type', 'ambient')
      .eq('status', 'active')

    if (!ambientAgents || ambientAgents.length === 0) return

    for (const agent of ambientAgents) {
      await summarizeUserConversations(agent.owner_id, agent.id)
    }
  } catch (e) {
    console.error('[context-summarizer] Error:', e)
  }
}

async function summarizeUserConversations(userId: string, agentId: string) {
  if (!supabase) return

  // ユーザーの全会話を取得
  const { data: memberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId)

  if (!memberships) return

  for (const m of memberships) {
    try {
      await summarizeConversation(userId, m.conversation_id, agentId)
    } catch (e) {
      console.error(`[context-summarizer] Error for conv=${m.conversation_id}:`, e)
    }
  }
}

async function summarizeConversation(userId: string, conversationId: string, agentId: string) {
  if (!supabase) return

  // 会話の最新ページを取得
  const { data: pages } = await supabase
    .from('pages')
    .select('id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(3) // 直近3ページまで

  if (!pages || pages.length === 0) return

  // ページテキストを結合
  let fullText = ''
  for (const page of pages) {
    try {
      const text = await readPage(page.id)
      if (text) fullText += text + '\n\n'
    } catch {
      // ページ読み込み失敗（ドキュメント未ロード等）は無視
    }
  }

  if (fullText.trim().length < 20) return // テキスト不十分

  // 既存の要約と比較（テキスト長で簡易差分チェック）
  const { data: existing } = await supabase
    .from('user_context_summaries')
    .select('token_count')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .single()

  const approxTokens = Math.ceil(fullText.length / 3)
  if (existing && Math.abs(existing.token_count - approxTokens) < 50) return // 差分小

  // DeepSeek で要約生成
  const result = await generateContextSummary(fullText)
  if (!result?.text) return

  // upsert
  await supabase
    .from('user_context_summaries')
    .upsert({
      user_id: userId,
      conversation_id: conversationId,
      summary: result.text,
      token_count: approxTokens,
    }, { onConflict: 'user_id,conversation_id' })

  // コスト追跡
  if (result.costJpy > 0) {
    await supabase.rpc('agent_spend', {
      p_agent_id: agentId,
      p_amount: result.costJpy,
      p_description: `Context summary, conv=${conversationId}`,
    })
  }

  console.log(`[context-summarizer] Updated summary for user=${userId} conv=${conversationId}`)
}
