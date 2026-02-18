'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Plus, Search, PanelLeftClose, PanelLeft, FileText, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WalletWidget } from '@/components/wallet/WalletWidget'
import { NotificationBell } from '@/components/notifications/NotificationBell'

interface Page {
  id: string
  title: string
  updated_at: string
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [pages, setPages] = useState<Page[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    params.set('sort', 'updated_at')
    params.set('order', 'desc')

    fetch(`/api/pages?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setPages)
      .catch(() => setPages([]))
  }, [query, pathname]) // refetch on navigation

  async function createPage() {
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '無題のページ' }),
    })
    if (!res.ok) return
    const page: { id: string } = await res.json()
    router.push(`/${page.id}`)
  }

  const currentPageId = pathname.startsWith('/') ? pathname.slice(1) : ''

  if (collapsed) {
    return (
      <div className="w-12 shrink-0 border-r bg-white flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" onClick={onToggle} className="size-8">
          <PanelLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={createPage} className="size-8">
          <Plus className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="w-60 shrink-0 border-r bg-white flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <Link href="/" className="font-bold text-lg">Lucid</Link>
        <Button variant="ghost" size="icon" onClick={onToggle} className="size-7">
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* New page */}
      <div className="px-3 pb-2">
        <Button variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={createPage}>
          <Plus className="size-3.5 mr-1.5" />
          新しいページ
        </Button>
      </div>

      {/* Page list */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {pages.map((page) => {
          const isActive = currentPageId === page.id
          return (
            <Link key={page.id} href={`/${page.id}`}>
              <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                isActive ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50 text-muted-foreground'
              }`}>
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{page.title || '無題のページ'}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Bottom: Invite + Wallet + Notifications */}
      <div className="border-t px-3 py-2 space-y-1">
        <Link href="/invitations">
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
            pathname === '/invitations' ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50 text-muted-foreground'
          }`}>
            <UserPlus className="size-3.5 shrink-0" />
            <span>招待管理</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <WalletWidget />
          <NotificationBell />
        </div>
      </div>
    </div>
  )
}
