'use client'

import { useEffect, useState } from 'react'
import type { HocuspocusProvider } from '@hocuspocus/provider'

interface TypingIndicatorProps {
  provider: HocuspocusProvider | null
}

export function TypingIndicator({ provider }: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  useEffect(() => {
    if (!provider) return

    const awareness = provider.awareness
    if (!awareness) return

    const update = () => {
      const states = awareness.getStates()
      const names: string[] = []
      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return
        if (state.user?.isTyping) names.push(state.user.name || '誰か')
      })
      setTypingUsers(names)
    }

    awareness.on('change', update)
    return () => { awareness.off('change', update) }
  }, [provider])

  if (typingUsers.length === 0) return null

  const text = typingUsers.length === 1
    ? `${typingUsers[0]}が入力中...`
    : `${typingUsers.length}人が入力中...`

  return (
    <p className="text-xs text-muted-foreground animate-pulse">{text}</p>
  )
}
