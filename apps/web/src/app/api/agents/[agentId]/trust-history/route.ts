import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/agents/[agentId]/trust-history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const supabase = await createServerClient()

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
  const offset = Number(url.searchParams.get('offset')) || 0

  const { data, error } = await supabase
    .from('trust_events')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
