import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// PATCH /api/friends/[friendshipId] — 承認/拒否
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ friendshipId: string }> }
) {
  const { friendshipId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await request.json() as { status: 'accepted' | 'rejected' }
  if (!['accepted', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // friendshipを取得（addresseeのみ更新可能）
  const { data: friendship, error: fetchErr } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', friendshipId)
    .eq('addressee_id', user.id)
    .single()

  if (fetchErr || !friendship) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (friendship.status !== 'pending') {
    return NextResponse.json({ error: 'Already resolved' }, { status: 409 })
  }

  // ステータス更新
  const { error: updateErr } = await supabase
    .from('friendships')
    .update({ status })
    .eq('id', friendshipId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 承認時: 会話を自動作成
  if (status === 'accepted') {
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ type: 'human' })
      .select()
      .single()

    if (conv) {
      // 両者をメンバーに追加
      await supabase.from('conversation_members').insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: friendship.requester_id },
      ])

      // 最初のページを作成
      await supabase.from('pages').insert({
        title: '',
        owner_id: user.id,
        conversation_id: conv.id,
      })

      // 承認通知
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      await supabase.from('notifications').insert({
        user_id: friendship.requester_id,
        type: 'friend_accepted',
        title: 'フレンド承認',
        body: `${myProfile?.display_name ?? ''}さんがフレンドリクエストを承認しました`,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
