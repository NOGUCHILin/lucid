/**
 * EventRouter: クライアントからのイベントを適切なハンドラに振り分ける
 */

export type AgentEventType = 'input_pause' | 'mention' | 'paragraph_complete' | 'page_transition'

export interface AgentEvent {
  type: AgentEventType
  payload: Record<string, unknown>
  timestamp: string
  userId: string
  pageId: string
}

export interface AgentConfig {
  pageId: string
  agentId: string
  agentName: string
  trustScore: number
  isAmbient?: boolean
  ownerId?: string
}

// 重複イベント抑制
const lastProcessed = new Map<string, number>()
const DEBOUNCE_MS: Record<AgentEventType, number> = {
  input_pause: 3000,
  mention: 0,
  paragraph_complete: 5000,
  page_transition: 0,
}

type EventHandler = (event: AgentEvent, config: AgentConfig) => Promise<void>
const handlers = new Map<AgentEventType, EventHandler>()

/** ハンドラを登録 */
export function registerHandler(type: AgentEventType, handler: EventHandler) {
  handlers.set(type, handler)
}

/** イベントをディスパッチ */
export function dispatch(event: AgentEvent, config: AgentConfig) {
  const key = `${event.pageId}:${event.type}`
  const now = Date.now()
  const last = lastProcessed.get(key) || 0
  const debounce = DEBOUNCE_MS[event.type]

  if (now - last < debounce) return

  lastProcessed.set(key, now)

  const handler = handlers.get(event.type)
  if (handler) {
    handler(event, config).catch(err => {
      console.error(`[event-router] Handler error for ${event.type}:`, err)
    })
  } else {
    console.warn(`[event-router] No handler for event type: ${event.type}`)
  }
}
