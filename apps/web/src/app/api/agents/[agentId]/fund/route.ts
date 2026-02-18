/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'
import { createAdminClient } from '@lucid/database/admin'

// POST /api/agents/[agentId]/fund — transfer funds from user to agent (atomic RPC)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const supabase = await createServerClient()
  const { amount } = await request.json()

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient() as any

  // Get user wallet
  const { data: userWallet } = await admin
    .from('wallets')
    .select('id')
    .eq('entity_id', user.id)
    .eq('entity_type', 'user')
    .single()

  if (!userWallet) {
    return NextResponse.json({ error: 'User wallet not found' }, { status: 404 })
  }

  // Get agent wallet
  const { data: agentWallet } = await admin
    .from('wallets')
    .select('id')
    .eq('entity_id', agentId)
    .eq('entity_type', 'agent')
    .single()

  if (!agentWallet) {
    return NextResponse.json({ error: 'Agent wallet not found' }, { status: 404 })
  }

  // Atomic transfer via RPC
  const { data, error } = await admin.rpc('transfer_funds', {
    p_from_wallet: userWallet.id,
    p_to_wallet: agentWallet.id,
    p_amount: amount,
    p_description: `Fund transfer to agent`,
  })

  if (error) {
    const msg = error.message || 'Transfer failed'
    const status = msg.includes('Insufficient') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }

  return NextResponse.json({ success: true, transaction_id: data })
}
