'use client'

import Link from 'next/link'
import { Bot, User, Pin } from 'lucide-react'
import type { ConversationItem as ConversationItemType } from '@/hooks/useConversations'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '今'
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}日前`
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

interface Props {
  conversation: ConversationItemType
  isActive: boolean
  onClick?: () => void
}

export function ConversationItem({ conversation, isActive, onClick }: Props) {
  const { id, type, name, pinned, lastActivity, latestPageTitle } = conversation

  return (
    <Link href={`/c/${id}`} onClick={onClick}>
      <div className={`flex items-center gap-2.5 px-2 py-2.5 rounded-md text-sm transition-colors ${
        isActive ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50 text-muted-foreground'
      }`}>
        {/* Avatar */}
        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
          type === 'agent' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'
        }`}>
          {type === 'agent' ? <Bot className="size-4" /> : <User className="size-4" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium text-foreground">{name || '自分'}</span>
            {pinned && <Pin className="size-3 text-muted-foreground shrink-0" />}
          </div>
          {latestPageTitle && (
            <p className="truncate text-xs text-muted-foreground">{latestPageTitle}</p>
          )}
        </div>

        {/* Time */}
        <span className="text-xs text-muted-foreground shrink-0">
          {timeAgo(lastActivity)}
        </span>
      </div>
    </Link>
  )
}
