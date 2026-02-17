import { NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/pages/[pageId]/next
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('pages')
    .select('id, title')
    .eq('prev_page_id', pageId)
    .single()

  if (error || !data) {
    return NextResponse.json(null, { status: 404 })
  }
  return NextResponse.json(data)
}
