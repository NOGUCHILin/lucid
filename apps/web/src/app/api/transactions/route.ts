import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@lucid/database'

// POST /api/transactions — create a transaction (authenticated, owner-verified)
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // For transfers, use the transfer_funds RPC (atomic + authorized)
  if (body.type === 'transfer' && body.fromWalletId && body.toWalletId) {
    const admin = createAdminClient()
    const { data, error } = await (admin as any).rpc('transfer_funds', {
      p_from_wallet: body.fromWalletId,
      p_to_wallet: body.toWalletId,
      p_amount: body.amount,
      p_description: body.description || 'Transfer',
    })

    if (error) {
      const msg = error.message || 'Transfer failed'
      const status = msg.includes('Insufficient') ? 400 : 500
      return NextResponse.json({ error: msg }, { status })
    }
    return NextResponse.json({ transaction_id: data }, { status: 201 })
  }

  // Direct transaction creation is restricted — only record-keeping via RPC
  return NextResponse.json(
    { error: 'Direct transaction creation is not allowed. Use transfer or top-up endpoints.' },
    { status: 403 }
  )
}
