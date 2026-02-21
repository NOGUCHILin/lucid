import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

export async function GET() {
  const supabase = await createServerClient()
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch wallets separately (entity_id based, no FK)
  const agentIds = (agents ?? []).map(a => a.id)
  const { data: wallets } = agentIds.length > 0
    ? await supabase
        .from('wallets')
        .select('*')
        .in('entity_id', agentIds)
        .eq('entity_type', 'agent')
    : { data: [] }

  const walletMap = new Map((wallets ?? []).map(w => [w.entity_id, w]))
  const data = (agents ?? []).map(a => ({ ...a, wallet: walletMap.get(a.id) ?? null }))

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const body = await request.json()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('agents')
    .insert({
      owner_id: user.id,
      name: body.name || 'Agent',
      config: body.config || {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
