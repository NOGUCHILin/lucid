'use client'

import Link from 'next/link'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  page_id: string | null
  read: boolean
  created_at: string
}

interface NotificationListProps {
  notifications: Notification[]
  onMarkRead: (ids: string[]) => void
}

const TYPE_LABELS: Record<string, string> = {
  mention: '@メンション',
  approval_request: '承認リクエスト',
  agent_paused: 'エージェント停止',
  fund_low: '残高不足',
}

export function NotificationList({ notifications, onMarkRead }: NotificationListProps) {
  if (notifications.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">通知はありません</div>
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h4 className="text-sm font-medium">通知</h4>
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={() => onMarkRead(notifications.filter((n) => !n.read).map((n) => n.id))}
        >
          すべて既読
        </button>
      </div>
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`border-b px-4 py-3 text-sm ${n.read ? 'opacity-60' : 'bg-blue-50/50'}`}
          onClick={() => !n.read && onMarkRead([n.id])}
        >
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {TYPE_LABELS[n.type] || n.type}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="mt-1 font-medium">{n.title}</p>
          {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
          {n.page_id && (
            <Link href={`/${n.page_id}`} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
              ページを開く →
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
