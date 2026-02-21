/**
 * AgentLoop: エージェント登録/解除 + Awareness管理
 * ポーリングは廃止 → イベント駆動（event-router.ts）に移行済み
 * suggest APIのキャッシュは input-pause-handler / page-transition-handler に移動
 */
import type { Hocuspocus } from '@hocuspocus/server'

let hocuspocusInstance: Hocuspocus | null = null
export function setAgentLoopHocuspocus(instance: Hocuspocus) {
  hocuspocusInstance = instance
}

/** アクティブなエージェント登録を管理 */
const activeAgents = new Set<string>()

interface AgentConfig {
  pageId: string
  agentId: string
  agentName: string
  trustScore: number
  isAmbient?: boolean
  ownerId?: string
}

/** Hocuspocusドキュメントのawarenessにエージェント状態を設定 */
export function setAgentAwareness(pageId: string, agentName: string, status: 'online' | 'thinking' | 'offline') {
  if (!hocuspocusInstance) return
  try {
    const doc = (hocuspocusInstance as any).documents?.get(pageId)
    if (doc?.awareness) {
      doc.awareness.setLocalStateField('user', {
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

/** エージェントを登録（awarenessにオンライン表示） */
export function registerAgent(config: AgentConfig) {
  if (activeAgents.has(config.pageId)) return
  activeAgents.add(config.pageId)
  setAgentAwareness(config.pageId, config.agentName, 'online')
  console.log(`[agent-loop] Registered agent for page=${config.pageId} agent=${config.agentName}`)
}

/** エージェントを解除 */
export function unregisterAgent(pageId: string) {
  if (!activeAgents.has(pageId)) return
  activeAgents.delete(pageId)
  setAgentAwareness(pageId, '', 'offline')
  console.log(`[agent-loop] Unregistered agent for page=${pageId}`)
}
