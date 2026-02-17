'use client'

import { useEffect, useState } from 'react'

interface TrustEvent {
  id: number
  event_type: string
  delta: number
  old_score: number
  new_score: number
  reason: string
  created_at: string
}

const EVENT_LABELS: Record<string, string> = {
  approval_accepted: '承認',
  approval_rejected: '却下',
  budget_exceeded: '予算超過',
  task_completed: 'タスク完了',
  manual_adjust: '手動調整',
}

export function TrustHistory({ agentId }: { agentId: string }) {
  const [events, setEvents] = useState<TrustEvent[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch(`/api/agents/${agentId}/trust-history?limit=10`)
      .then(r => r.ok ? r.json() : [])
      .then(setEvents)
      .catch(() => {})
  }, [agentId])

  if (events.length === 0) return null

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        信頼度履歴 {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div className="space-y-1 text-xs">
          {events.map(e => (
            <div key={e.id} className="flex items-center justify-between rounded px-2 py-1 bg-muted/50">
              <span>{EVENT_LABELS[e.event_type] || e.event_type}</span>
              <span className={e.delta > 0 ? 'text-green-600' : 'text-red-600'}>
                {e.delta > 0 ? '+' : ''}{e.delta} → {e.new_score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
