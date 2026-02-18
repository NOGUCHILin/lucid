import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// POST /api/agents/[agentId]/write — Hocuspocusサーバーに書き込みリクエストを転送
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { agentId } = await params
  const { pageId, text } = await request.json()

  if (!pageId || !text) {
    return NextResponse.json({ error: 'pageId and text are required' }, { status: 400 })
  }

  const hocuspocusUrl = process.env.HOCUSPOCUS_INTERNAL_URL || 'http://127.0.0.1:1234'
  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  try {
    const res = await fetch(`${hocuspocusUrl}/api/agent-write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalSecret}`,
      },
      body: JSON.stringify({ agentId, pageId, text }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hocuspocus server unreachable' }, { status: 502 })
  }
}
