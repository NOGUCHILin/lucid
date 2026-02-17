import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// POST /api/agents/[agentId]/fund — transfer funds from user to agent
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

  // Get user wallet
  const { data: userWallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('entity_id', user.id)
    .eq('entity_type', 'user')
    .single()

  if (!userWallet || userWallet.balance < amount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
  }

  // Get agent wallet
  const { data: agentWallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('entity_id', agentId)
    .eq('entity_type', 'agent')
    .single()

  if (!agentWallet) {
    return NextResponse.json({ error: 'Agent wallet not found' }, { status: 404 })
  }

  // Transfer: deduct from user, add to agent
  const { error: deductError } = await supabase
    .from('wallets')
    .update({ balance: userWallet.balance - amount })
    .eq('id', userWallet.id)

  if (deductError) {
    return NextResponse.json({ error: deductError.message }, { status: 500 })
  }

  const { error: addError } = await supabase
    .from('wallets')
    .update({ balance: agentWallet.balance + amount })
    .eq('id', agentWallet.id)

  if (addError) {
    return NextResponse.json({ error: addError.message }, { status: 500 })
  }

  // Record transaction
  await supabase.from('transactions').insert({
    type: 'transfer',
    from_wallet_id: userWallet.id,
    to_wallet_id: agentWallet.id,
    amount,
    description: `Fund transfer to agent`,
    status: 'completed',
  })

  return NextResponse.json({ success: true })
}
