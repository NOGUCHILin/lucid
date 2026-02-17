import { NextRequest, NextResponse } from 'next/server'

// POST /api/agents/[agentId]/write — Hocuspocusサーバーに書き込みリクエストを転送
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const { pageId, text } = await request.json()

  if (!pageId || !text) {
    return NextResponse.json({ error: 'pageId and text are required' }, { status: 400 })
  }

  const hocuspocusUrl = process.env.HOCUSPOCUS_INTERNAL_URL || 'http://127.0.0.1:1234'

  try {
    const res = await fetch(`${hocuspocusUrl}/api/agent-write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
