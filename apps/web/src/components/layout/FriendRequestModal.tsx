'use client'

import { useState } from 'react'
import { Search, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFriends, type FriendItem } from '@/hooks/useFriends'

interface SearchResult {
  id: string
  display_name: string
  avatar_url: string | null
}

interface Props {
  open: boolean
  onClose: () => void
}

export function FriendRequestModal({ open, onClose }: Props) {
  const { pendingRequests, sendRequest, respond } = useFriends()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())

  if (!open) return null

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.length < 3) { setResults([]); return }

    setSearching(true)
    const res = await fetch(`/api/profiles/search?q=${encodeURIComponent(q)}`)
    if (res.ok) setResults(await res.json())
    setSearching(false)
  }

  async function handleSend(userId: string) {
    const ok = await sendRequest(userId)
    if (ok) setSentIds(prev => new Set(prev).add(userId))
  }

  async function handleRespond(friendshipId: string, status: 'accepted' | 'rejected') {
    await respond(friendshipId, status)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold">フレンドを追加</h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="名前で検索..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Search Results */}
        {searching && <Loader2 className="size-4 animate-spin mx-auto" />}
        {results.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {results.map(r => (
              <div key={r.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-50">
                <span className="text-sm truncate">{r.display_name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  disabled={sentIds.has(r.id)}
                  onClick={() => handleSend(r.id)}
                >
                  {sentIds.has(r.id) ? '送信済み' : '追加'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <>
            <div className="border-t pt-3">
              <h3 className="text-sm font-medium mb-2">保留中のリクエスト</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pendingRequests.map((req: FriendItem) => (
                  <div key={req.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-50">
                    <span className="text-sm truncate">{req.displayName}</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleRespond(req.id, 'accepted')}>
                        <Check className="size-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleRespond(req.id, 'rejected')}>
                        <X className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>閉じる</Button>
      </div>
    </div>
  )
}
