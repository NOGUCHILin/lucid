import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/friends — フレンド一覧＋保留中リクエスト
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // 'pending' | 'accepted' | null(all)

  let query = supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at, updated_at')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  if (status) query = query.eq('status', status)

  const { data: friendships, error } = await query.order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 相手のprofileを取得
  const otherIds = (friendships ?? []).map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  )
  const { data: profiles } = otherIds.length
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', otherIds)
    : { data: [] }
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const result = (friendships ?? []).map(f => {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
    const profile = profileMap.get(otherId)
    return {
      id: f.id,
      userId: otherId,
      displayName: profile?.display_name ?? '',
      avatarUrl: profile?.avatar_url,
      status: f.status,
      isRequester: f.requester_id === user.id,
      createdAt: f.created_at,
    }
  })

  return NextResponse.json(result)
}

// POST /api/friends — フレンドリクエスト送信
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { addresseeId } = await request.json() as { addresseeId: string }
  if (!addresseeId) return NextResponse.json({ error: 'addresseeId required' }, { status: 400 })
  if (addresseeId === user.id) return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 })

  // 既存のfriendshipチェック
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),` +
      `and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`
    )
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Friendship already exists', status: existing.status }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: addresseeId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 通知を送信
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  await supabase.from('notifications').insert({
    user_id: addresseeId,
    type: 'friend_request',
    title: 'フレンドリクエスト',
    body: `${myProfile?.display_name ?? ''}さんからフレンドリクエストが届きました`,
  })

  return NextResponse.json(data, { status: 201 })
}
