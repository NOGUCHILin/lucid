'use client'

import { useEffect, useState } from 'react'
import type { HocuspocusProvider } from '@hocuspocus/provider'

interface TypingIndicatorProps {
  provider: HocuspocusProvider | null
}

export function TypingIndicator({ provider }: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [thinkingAgents, setThinkingAgents] = useState<string[]>([])

  useEffect(() => {
    if (!provider) return

    const awareness = provider.awareness
    if (!awareness) return

    const update = () => {
      const states = awareness.getStates()
      const names: string[] = []
      const agentNames: string[] = []
      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return
        if (state.user?.role === 'agent' && state.user?.status === 'thinking') {
          agentNames.push(state.user.name || 'AI')
        } else if (state.user?.isTyping) {
          names.push(state.user.name || '誰か')
        }
      })
      setTypingUsers(names)
      setThinkingAgents(agentNames)
    }

    awareness.on('change', update)
    return () => { awareness.off('change', update) }
  }, [provider])

  if (typingUsers.length === 0 && thinkingAgents.length === 0) return null

  const parts: string[] = []
  if (typingUsers.length === 1) parts.push(`${typingUsers[0]}が入力中`)
  else if (typingUsers.length > 1) parts.push(`${typingUsers.length}人が入力中`)
  if (thinkingAgents.length === 1) parts.push(`${thinkingAgents[0]}が考え中`)
  else if (thinkingAgents.length > 1) parts.push(`${thinkingAgents.length}体のAIが考え中`)

  return (
    <p className="text-xs text-muted-foreground animate-pulse">{parts.join(' / ')}...</p>
  )
}
