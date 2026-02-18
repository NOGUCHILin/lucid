'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard } from 'lucide-react'

const AMOUNTS = [500, 1000, 5000]

interface TopUpButtonProps {
  onSuccess?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TopUpButton({ onSuccess }: TopUpButtonProps) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleTopUp = async (amount: number) => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CreditCard className="size-4" />
        チャージ
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {AMOUNTS.map((a) => (
        <Button
          key={a}
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => handleTopUp(a)}
        >
          ¥{a.toLocaleString()}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        ✕
      </Button>
    </div>
  )
}
