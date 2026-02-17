'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface FundTransferProps {
  agentId: string
  onTransfer?: () => void
}

export function FundTransfer({ agentId, onTransfer }: FundTransferProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleTransfer = async () => {
    const num = Number(amount)
    if (!num || num <= 0) { setError('金額を入力してください'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/agents/${agentId}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'エラーが発生しました')
        return
      }
      setAmount('')
      onTransfer?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">資金配分</label>
      <div className="flex gap-2">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="金額"
          className="flex-1 rounded-md border px-3 py-1.5 text-sm"
        />
        <Button size="sm" onClick={handleTransfer} disabled={loading}>
          送金
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
