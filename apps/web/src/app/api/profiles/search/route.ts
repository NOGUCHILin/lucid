import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/profiles/search?q=email@example.com — メールでユーザー検索
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q')
  if (!q || q.length < 3) return NextResponse.json([])

  // display_nameで部分一致検索
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .neq('id', user.id)
    .ilike('display_name', `%${q}%`)
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
