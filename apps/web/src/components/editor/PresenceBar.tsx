'use client'

import { useEffect, useState } from 'react'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { Bot, User } from 'lucide-react'

interface PresenceUser {
  name: string
  color: string
  role?: 'human' | 'agent'
  status?: 'online' | 'away' | 'idle'
  trustScore?: number
}

interface PresenceBarProps {
  provider: HocuspocusProvider | null
}

export function PresenceBar({ provider }: PresenceBarProps) {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!provider) return

    const awareness = provider.awareness
    if (!awareness) return

    const update = () => {
      const states = awareness.getStates()
      const list: PresenceUser[] = []
      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return
        if (state.user) list.push(state.user as PresenceUser)
      })
      setUsers(list)
    }

    awareness.on('change', update)
    update()

    return () => {
      awareness.off('change', update)
    }
  }, [provider])

  if (users.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {users.map((u, i) => (
        <div
          key={i}
          className="relative flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
          style={{ borderColor: u.color }}
          title={u.name}
        >
          {u.role === 'agent' ? (
            <Bot className="size-3" style={{ color: u.color }} />
          ) : (
            <User className="size-3" style={{ color: u.color }} />
          )}
          <span style={{ color: u.color }}>{u.name}</span>
          {/* Status dot */}
          <div
            className={`absolute -right-0.5 -top-0.5 size-2 rounded-full border border-white ${
              u.status === 'online' ? 'bg-green-500'
                : u.status === 'away' ? 'bg-yellow-500'
                : 'bg-neutral-400'
            }`}
          />
          {u.role === 'agent' && u.trustScore != null && (
            <span className="text-[10px] text-muted-foreground">{u.trustScore}</span>
          )}
        </div>
      ))}
    </div>
  )
}
