import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'
import { getTier } from '@/lib/trust-tiers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const supabase = await createServerClient()
  const { trustScore } = await request.json()

  if (typeof trustScore !== 'number' || trustScore < 0 || trustScore > 100) {
    return NextResponse.json({ error: 'trustScore must be 0-100' }, { status: 400 })
  }

  const tier = getTier(trustScore)

  // Update agent trust_score
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .update({ trust_score: trustScore })
    .eq('id', agentId)
    .select()
    .single()

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 })
  }

  // Sync wallet daily_limit
  const { error: walletError } = await supabase
    .from('wallets')
    .update({ daily_limit: tier.dailyLimit })
    .eq('entity_id', agentId)
    .eq('entity_type', 'agent')

  if (walletError) {
    return NextResponse.json({ error: walletError.message }, { status: 500 })
  }

  return NextResponse.json({ ...agent, tier })
}
