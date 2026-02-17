'use client'

import { useEffect, useState, useCallback } from 'react'
import { Wallet } from 'lucide-react'
import { createClient } from '@lucid/database/client'
import { TopUpButton } from './TopUpButton'

export function WalletWidget() {
  const [balance, setBalance] = useState<number | null>(null)

  const fetchBalance = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('wallets')
      .select('balance')
      .eq('entity_id', user.id)
      .eq('entity_type', 'user')
      .single()

    if (data) setBalance(data.balance)
  }, [])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  if (balance === null) return null

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm shadow-sm">
      <Wallet className="size-4 text-muted-foreground" />
      <span className="font-mono">¥{balance.toLocaleString()}</span>
      <TopUpButton onSuccess={fetchBalance} />
    </div>
  )
}
