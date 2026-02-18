'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Search, PanelLeftClose, PanelLeft, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WalletWidget } from '@/components/wallet/WalletWidget'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ConversationItem } from './ConversationItem'
import { FriendRequestModal } from './FriendRequestModal'
import { useConversations } from '@/hooks/useConversations'
import { useFriends } from '@/hooks/useFriends'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { conversations, query, search } = useConversations()
  const { pendingCount } = useFriends()
  const [friendModalOpen, setFriendModalOpen] = useState(false)

  // /c/[conversationId] からIDを抽出
  const activeConvId = pathname.startsWith('/c/')
    ? pathname.split('/')[2]
    : ''

  const pinned = conversations.filter(c => c.pinned)
  const recent = conversations.filter(c => !c.pinned)

  if (collapsed) {
    return (
      <div className="w-12 shrink-0 border-r bg-white flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" onClick={onToggle} className="size-8">
          <PanelLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setFriendModalOpen(true)} className="size-8">
          <UserPlus className="size-4" />
        </Button>
        <FriendRequestModal open={friendModalOpen} onClose={() => setFriendModalOpen(false)} />
      </div>
    )
  }

  return (
    <div className="w-60 shrink-0 border-r bg-white flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <Link href="/" className="font-bold text-lg">Lucid</Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setFriendModalOpen(true)} className="size-7">
            <UserPlus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggle} className="size-7">
            <PanelLeftClose className="size-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="検索..."
            value={query}
            onChange={(e) => search(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {/* Pinned */}
        {pinned.length > 0 && (
          <>
            <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              ピン留め
            </div>
            {pinned.map(conv => (
              <ConversationItem key={conv.id} conversation={conv} isActive={activeConvId === conv.id} />
            ))}
          </>
        )}

        {/* Recent */}
        {recent.length > 0 && (
          <>
            {pinned.length > 0 && (
              <div className="px-2 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                最近
              </div>
            )}
            {recent.map(conv => (
              <ConversationItem key={conv.id} conversation={conv} isActive={activeConvId === conv.id} />
            ))}
          </>
        )}

        {conversations.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            会話がありません
          </div>
        )}
      </div>

      {/* Pending Friend Requests */}
      {pendingCount > 0 && (
        <button
          onClick={() => setFriendModalOpen(true)}
          className="mx-3 mb-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-neutral-50 text-muted-foreground"
        >
          <Users className="size-3.5" />
          <span>フレンドリクエスト</span>
          <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
            {pendingCount}
          </span>
        </button>
      )}

      {/* Bottom: Wallet + Notifications */}
      <div className="border-t px-3 py-2">
        <div className="flex items-center gap-2">
          <WalletWidget />
          <NotificationBell />
        </div>
      </div>

      <FriendRequestModal open={friendModalOpen} onClose={() => setFriendModalOpen(false)} />
    </div>
  )
}
