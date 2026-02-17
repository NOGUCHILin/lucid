export interface BehaviorEvent {
  pageId: string
  userId: string
  eventType: 'edit' | 'cursor_move' | 'pause' | 'selection' | 'focus' | 'blur'
  payload: Record<string, unknown>
}

const FLUSH_INTERVAL = 5_000 // 5秒

let buffer: BehaviorEvent[] = []
let timer: ReturnType<typeof setInterval> | null = null

function flush() {
  if (buffer.length === 0) return
  const events = [...buffer]
  buffer = []

  const body = JSON.stringify({ events })

  // sendBeacon（ページ離脱時にも送れる）
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    const sent = navigator.sendBeacon('/api/behavior-events', blob)
    if (sent) return
  }

  // fallback: fetch
  fetch('/api/behavior-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // ネットワークエラー時はバッファに戻す
    buffer.unshift(...events)
  })
}

export function pushEvent(event: BehaviorEvent) {
  buffer.push(event)
}

export function startFlushing() {
  if (timer) return
  timer = setInterval(flush, FLUSH_INTERVAL)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }
}

export function stopFlushing() {
  flush() // 残りを送信
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', flush)
  }
}
