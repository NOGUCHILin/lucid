/**
 * paragraph_complete ハンドラ: 段落を書き終えて改行した時
 * → Graphitiにエピソード追加（非同期、fire-and-forget）
 */
import type { AgentEvent, AgentConfig } from '../event-router'
import { addEpisode } from '../graphiti-client'

export async function handleParagraphComplete(event: AgentEvent, config: AgentConfig) {
  const paragraphText = (event.payload.paragraphText as string) || ''
  if (!paragraphText || paragraphText.trim().length < 10) return

  const groupId = `user-${config.ownerId || event.userId}`

  // Graphitiにエピソード追加（非同期）
  addEpisode({
    groupId,
    name: `page:${config.pageId}:paragraph`,
    content: paragraphText,
    role: 'user',
    sourceDescription: `Lucid page ${config.pageId}`,
  }).catch(e => {
    console.error('[paragraph] addEpisode error:', e)
  })

  console.log(`[paragraph] Episode queued for page=${config.pageId}, len=${paragraphText.length}`)
}
