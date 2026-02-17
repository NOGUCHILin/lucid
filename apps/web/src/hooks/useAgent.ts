'use client'

import { useState, useEffect, useCallback } from 'react'

interface Agent {
  id: string
  name: string
  trust_score: number
  status: string
  config: Record<string, unknown>
  wallet?: {
    id: string
    balance: number
    daily_spent: number
    daily_limit: number
  }
}

export function useAgent(agentId: string | null) {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchAgent = useCallback(async () => {
    if (!agentId) { setAgent(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}`)
      if (res.ok) {
        setAgent(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchAgent()
    const interval = setInterval(fetchAgent, 10_000) // 10秒ポーリング
    return () => clearInterval(interval)
  }, [fetchAgent])

  const updateTrust = async (trustScore: number) => {
    if (!agentId) return
    const res = await fetch(`/api/agents/${agentId}/trust`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustScore }),
    })
    if (res.ok) await fetchAgent()
  }

  return { agent, loading, updateTrust, refetch: fetchAgent }
}
