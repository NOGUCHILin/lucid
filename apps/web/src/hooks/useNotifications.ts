'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@lucid/database/client'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  page_id: string | null
  read: boolean
  created_at: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications?limit=20')
    if (res.ok) {
      const data = await res.json()
      setNotifications(data)
      setUnreadCount(data.filter((n: Notification) => !n.read).length)
    }
  }, [])

  const markAsRead = useCallback(async (ids: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - ids.length))
  }, [])

  // Supabase Realtime subscription
  useEffect(() => {
    fetchNotifications()

    const supabase = createClient()
    let userId: string | null = null

    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id || null
      if (!userId) return

      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const newNotif = payload.new as Notification
            setNotifications((prev) => [newNotif, ...prev])
            setUnreadCount((prev) => prev + 1)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })
  }, [fetchNotifications])

  return { notifications, unreadCount, markAsRead, refetch: fetchNotifications }
}
