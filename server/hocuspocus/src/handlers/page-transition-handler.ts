/**
 * page_transition ハンドラ: ページ遷移時
 * → 旧ページ全文をGraphitiに保存 + 新ページへの引き継ぎ提案
 */
import type { AgentEvent, AgentConfig } from '../event-router'
import { readPage } from '../agent-writer'
import { addEpisode, searchFacts, formatFactsForPrompt } from '../graphiti-client'
import { generateAmbientResponse } from '../deepseek-client'
import { supabase } from '../supabase'

// input-pause-handlerと同じキャッシュを使う（直接importではなく、共通モジュールに移すのが理想）
const transitionSuggestions = new Map<string, { text: string; generatedAt: number }>()

export function getTransitionSuggestion(pageId: string): string | null {
  const s = transitionSuggestions.get(pageId)
  if (!s) return null
  if (Date.now() - s.generatedAt > 60_000) {
    transitionSuggestions.delete(pageId)
    return null
  }
  return s.text
}

export async function handlePageTransition(event: AgentEvent, config: AgentConfig) {
  const oldPageId = (event.payload.oldPageId as string) || config.pageId

  try {
    // 1. 旧ページ全文取得
    const fullText = await readPage(oldPageId)
    if (!fullText || fullText.trim().length < 10) return

    const groupId = `user-${config.ownerId || event.userId}`

    // 2. Graphitiにエピソード保存（非同期）
    addEpisode({
      groupId,
      name: `page:${oldPageId}:full`,
      content: fullText,
      role: 'user',
      sourceDescription: `Lucid page ${oldPageId} (full)`,
    }).catch(e => {
      console.error('[page-transition] addEpisode error:', e)
    })

    // 3. 新ページへの引き継ぎ: 旧ページの要約で関連知識を検索
    const summary = fullText.substring(0, 500)
    const facts = await searchFacts({ query: summary, groupId })
    const graphitiFacts = formatFactsForPrompt(facts)

    if (!graphitiFacts) return

    // 4. ユーザー名取得
    let userName = 'ユーザー'
    if (supabase && config.ownerId) {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', config.ownerId)
        .single()
      if (data?.display_name) userName = data.display_name
    }

    // 5. 新ページの初期提案を生成
    const response = await generateAmbientResponse({
      pageContent: '',
      crossContextSummaries: '',
      graphitiFacts,
      userName,
      agentName: config.agentName,
    })

    if (response?.text) {
      // 新ページID用にキャッシュ
      const newPageId = (event.payload.newPageId as string) || config.pageId
      transitionSuggestions.set(newPageId, {
        text: response.text,
        generatedAt: Date.now(),
      })
      console.log(`[page-transition] Suggestion cached for new page: "${response.text.substring(0, 50)}..."`)
    }
  } catch (e) {
    console.error('[page-transition] Error:', e)
  }
}
