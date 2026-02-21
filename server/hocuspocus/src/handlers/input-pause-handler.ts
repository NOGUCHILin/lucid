/**
 * input_pause ハンドラ: ユーザーが数秒間タイピングを停止した時
 * → Graphiti検索 → DeepSeek提案生成 → キャッシュ
 */
import type { AgentEvent, AgentConfig } from '../event-router'
import { readPage } from '../agent-writer'
import { searchFacts, formatFactsForPrompt } from '../graphiti-client'
import { generateAmbientResponse } from '../deepseek-client'
import { getDocumentInstance } from '../extensions/agent-bridge'
import { supabase } from '../supabase'

// 提案キャッシュ（suggest APIから取得用）
const latestSuggestions = new Map<string, { text: string; generatedAt: number }>()

export function getLatestSuggestion(pageId: string): string | null {
  const s = latestSuggestions.get(pageId)
  if (!s) return null
  if (Date.now() - s.generatedAt > 60_000) {
    latestSuggestions.delete(pageId)
    return null
  }
  return s.text
}

export async function handleInputPause(event: AgentEvent, config: AgentConfig) {
  const contextText = (event.payload.contextText as string) || ''
  if (!contextText || contextText.trim().length < 5) return

  try {
    // 1. ページ内容取得
    const pageContent = await readPage(config.pageId)
    if (!pageContent) return

    // 2. Graphiti検索（Graphiti未接続時はスキップ）
    const groupId = `user-${config.ownerId || event.userId}`
    const facts = await searchFacts({ query: contextText, groupId })
    const graphitiFacts = formatFactsForPrompt(facts)

    // 3. ユーザー名取得
    let userName = 'ユーザー'
    if (supabase && config.ownerId) {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', config.ownerId)
        .single()
      if (data?.display_name) userName = data.display_name
    }

    // 4. LLM提案生成（llmConfig指定時はマルチLLM）
    const response = await generateAmbientResponse({
      pageContent,
      crossContextSummaries: '',
      graphitiFacts,
      userName,
      agentName: config.agentName,
      llmConfig: config.llmConfig,
    })

    if (response?.text) {
      latestSuggestions.set(config.pageId, {
        text: response.text,
        generatedAt: Date.now(),
      })

      // サーバーPush: クライアントに提案を即時配信
      const doc = getDocumentInstance(config.pageId)
      if (doc) {
        doc.broadcastStateless(JSON.stringify({ type: 'suggestion', suggestion: response.text }))
        console.log(`[input-pause] Suggestion pushed: "${response.text.substring(0, 50)}..."`)
      } else {
        console.log(`[input-pause] Suggestion cached (no doc): "${response.text.substring(0, 50)}..."`)
      }

      // コスト追跡
      if (supabase && response.costJpy > 0) {
        await supabase.rpc('agent_spend', {
          p_agent_id: config.agentId,
          p_amount: response.costJpy,
          p_description: `input_pause suggestion, tokens: ${response.inputTokens}+${response.outputTokens}`,
        })
      }
    }
  } catch (e) {
    console.error('[input-pause] Error:', e)
  }
}
