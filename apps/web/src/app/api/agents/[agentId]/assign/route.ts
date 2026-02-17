import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// POST /api/agents/[agentId]/assign — assign agent to a page
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const supabase = await createServerClient()
  const { pageId } = await request.json()

  if (!pageId) {
    return NextResponse.json({ error: 'pageId is required' }, { status: 400 })
  }

  // Verify agent exists
  const { error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .single()

  if (agentError) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  // Assign agent to page
  const { data, error } = await supabase
    .from('pages')
    .update({ agent_id: agentId })
    .eq('id', pageId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
