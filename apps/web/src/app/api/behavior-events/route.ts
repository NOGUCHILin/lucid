import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@lucid/database'

// POST /api/behavior-events — batch insert behavior events
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { events } = await request.json()

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'events must be a non-empty array' }, { status: 400 })
  }
  if (events.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 events per batch' }, { status: 400 })
  }

  const rows = events.map((e: { pageId: string; eventType: string; payload?: Record<string, unknown> }) => ({
    page_id: e.pageId,
    user_id: user.id,
    event_type: e.eventType,
    payload: e.payload || {},
  }))

  // service_role でRLSバイパス（API側で既にユーザー認証済み）
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('behavior_events')
    .insert(rows)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ inserted: data.length }, { status: 201 })
}
