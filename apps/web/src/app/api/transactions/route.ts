import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// POST /api/transactions — create a transaction
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      type: body.type,
      from_wallet_id: body.fromWalletId || null,
      to_wallet_id: body.toWalletId || null,
      amount: body.amount,
      description: body.description || '',
      metadata: body.metadata || {},
      status: body.status || 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
