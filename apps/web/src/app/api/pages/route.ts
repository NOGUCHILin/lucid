import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/pages
export async function GET() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('pages')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/pages
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const body = await request.json()

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('pages')
    .insert({
      title: body.title || '無題のページ',
      owner_id: user?.id,
      prev_page_id: body.prevPageId || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
