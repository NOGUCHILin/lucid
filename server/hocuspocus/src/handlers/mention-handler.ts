/**
 * mention ハンドラ: @agent で明示的に呼びかけた時
 * → Graphiti検索 → DeepSeek応答 → 信頼度判定で書き込みor承認カード
 */
import type { AgentEvent, AgentConfig } from '../event-router'
import { readPage } from '../agent-writer'
import { searchFacts, formatFactsForPrompt } from '../graphiti-client'
import { generateAgentResponse } from '../deepseek-client'
import { resolveAction, agentDirectWrite, insertApprovalCard } from '../agent-actions'
import { supabase } from '../supabase'

export async function handleMention(event: AgentEvent, config: AgentConfig) {
  const instructionText = (event.payload.instructionText as string) || ''

  try {
    // 1. ページ内容取得
    const pageContent = await readPage(config.pageId)
    if (!pageContent) return

    // 2. Graphiti検索
    const groupId = `user-${config.ownerId || event.userId}`
    const facts = await searchFacts({ query: instructionText || pageContent.substring(0, 200), groupId })
    const graphitiFacts = formatFactsForPrompt(facts)

    // 3. LLM応答生成（llmConfig指定時はマルチLLM）
    const response = await generateAgentResponse({
      pageContent,
      intent: 'mention',
      confidence: 1.0,
      recentEvents: `@mention: ${instructionText}${graphitiFacts ? `\n\n関連知識:\n${graphitiFacts}` : ''}`,
      trustScore: config.trustScore,
      agentName: config.agentName,
      llmConfig: config.llmConfig,
    })

    if (!response) return

    // 4. コスト追跡
    if (supabase) {
      await supabase.rpc('agent_spend', {
        p_agent_id: config.agentId,
        p_amount: response.costJpy,
        p_description: `mention response, tokens: ${response.inputTokens}+${response.outputTokens}`,
      })
    }

    // 5. 信頼度に応じてアクション
    const actionType = resolveAction(config.trustScore, response.text.length)

    if (actionType === 'direct_write') {
      await agentDirectWrite(config.pageId, config.agentName, response.text)
      console.log(`[mention] Direct write to page=${config.pageId}`)
    } else {
      const requestId = await insertApprovalCard({
        pageId: config.pageId,
        agentId: config.agentId,
        agentName: config.agentName,
        suggestion: response.text,
        intent: 'mention',
        costJpy: response.costJpy,
      })
      console.log(`[mention] Approval card inserted: ${requestId}`)
    }
  } catch (e) {
    console.error('[mention] Error:', e)
  }
}
