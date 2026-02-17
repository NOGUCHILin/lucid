import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/wallets — list wallets for current user
export async function GET() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/wallets — create a wallet
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('wallets')
    .insert({
      entity_id: body.entityId,
      entity_type: body.entityType || 'user',
      balance: body.balance ?? 0,
      daily_limit: body.dailyLimit ?? 1000,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
