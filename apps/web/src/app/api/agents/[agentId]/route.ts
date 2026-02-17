import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  }

  // Fetch associated wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('entity_id', agentId)
    .eq('entity_type', 'agent')
    .single()

  return NextResponse.json({ ...data, wallet })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const supabase = await createServerClient()
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.status !== undefined) updates.status = body.status
  if (body.config !== undefined) updates.config = body.config

  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', agentId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', agentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
