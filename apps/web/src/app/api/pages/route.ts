import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/pages?q=検索語&sort=updated_at&order=desc
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const ALLOWED_SORT_COLUMNS = ['updated_at', 'created_at', 'title']
  const sort = ALLOWED_SORT_COLUMNS.includes(searchParams.get('sort') || '')
    ? searchParams.get('sort')!
    : 'updated_at'
  const order = searchParams.get('order') || 'desc'

  let query = supabase.from('pages').select('id, title, created_at, updated_at')
  if (q) query = query.ilike('title', `%${q}%`)
  query = query.order(sort, { ascending: order === 'asc' })

  const { data, error } = await query
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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('pages')
    .insert({
      title: body.title || '無題のページ',
      owner_id: user.id,
      prev_page_id: body.prevPageId || null,
      conversation_id: body.conversationId || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
