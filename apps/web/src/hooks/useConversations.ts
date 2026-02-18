'use client'

import { useCallback, useEffect, useState } from 'react'

export interface ConversationItem {
  id: string
  type: 'human' | 'agent'
  name: string
  avatarUrl: string | null
  pinned: boolean
  lastActivity: string
  latestPageTitle: string | null
  agentId: string | null
  agentStatus?: string
  agentTrustScore?: number
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const fetchConversations = useCallback(async () => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)

    const res = await fetch(`/api/conversations?${params}`)
    if (res.ok) {
      setConversations(await res.json())
    }
    setLoading(false)
  }, [query])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const togglePin = useCallback(async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId)
    if (!conv) return

    // Optimistic update
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, pinned: !c.pinned } : c)
    )

    // TODO: API call to update pinned status when endpoint is available
  }, [conversations])

  const search = useCallback((q: string) => {
    setQuery(q)
  }, [])

  const refresh = useCallback(() => {
    fetchConversations()
  }, [fetchConversations])

  return {
    conversations,
    loading,
    query,
    search,
    togglePin,
    refresh,
  }
}
