'use client'

import { useCallback, useEffect, useState } from 'react'

export interface FriendItem {
  id: string
  userId: string
  displayName: string
  avatarUrl: string | null
  status: 'pending' | 'accepted' | 'rejected'
  isRequester: boolean
  createdAt: string
}

export function useFriends() {
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFriends = useCallback(async () => {
    const res = await fetch('/api/friends')
    if (res.ok) {
      const data: FriendItem[] = await res.json()
      setFriends(data.filter(f => f.status === 'accepted'))
      setPendingRequests(data.filter(f => f.status === 'pending' && !f.isRequester))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFriends()
  }, [fetchFriends])

  const sendRequest = useCallback(async (addresseeId: string) => {
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresseeId }),
    })
    if (res.ok) {
      await fetchFriends()
      return true
    }
    return false
  }, [fetchFriends])

  const respond = useCallback(async (friendshipId: string, status: 'accepted' | 'rejected') => {
    const res = await fetch(`/api/friends/${friendshipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      await fetchFriends()
      return true
    }
    return false
  }, [fetchFriends])

  return {
    friends,
    pendingRequests,
    pendingCount: pendingRequests.length,
    loading,
    sendRequest,
    respond,
    refresh: fetchFriends,
  }
}
