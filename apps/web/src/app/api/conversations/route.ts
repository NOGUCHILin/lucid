import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/conversations — 自分の会話一覧（メンバー情報・最新ページ付き）
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  // 自分がメンバーの会話を取得
  const { data: memberships, error: memErr } = await supabase
    .from('conversation_members')
    .select('conversation_id, pinned, last_read_at')
    .eq('user_id', user.id)

  if (memErr || !memberships?.length) {
    return NextResponse.json([])
  }

  const convIds = memberships.map(m => m.conversation_id)

  // 会話詳細を取得
  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('id, type, agent_id, updated_at')
    .in('id', convIds)
    .order('updated_at', { ascending: false })

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

  // 各会話のメンバー情報（相手のprofile）を取得
  const { data: allMembers } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in('conversation_id', convIds)

  // profilesを一括取得
  const memberUserIds = [...new Set((allMembers ?? []).map(m => m.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', memberUserIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  // agent情報を取得
  const agentIds = (conversations ?? []).filter(c => c.agent_id).map(c => c.agent_id!)
  const { data: agents } = agentIds.length
    ? await supabase.from('agents').select('id, name, status, trust_score, config').in('id', agentIds)
    : { data: [] }
  const agentMap = new Map((agents ?? []).map(a => [a.id, a]))

  // 各会話の最新ページタイトルを取得
  const { data: latestPages } = await supabase
    .from('pages')
    .select('conversation_id, title, updated_at')
    .in('conversation_id', convIds)
    .order('updated_at', { ascending: false })

  const latestPageMap = new Map<string, { title: string; updated_at: string }>()
  for (const p of latestPages ?? []) {
    if (p.conversation_id && !latestPageMap.has(p.conversation_id)) {
      latestPageMap.set(p.conversation_id, { title: p.title, updated_at: p.updated_at })
    }
  }

  const membershipMap = new Map(memberships.map(m => [m.conversation_id, m]))

  // レスポンス組み立て
  const result = (conversations ?? []).map(conv => {
    const membership = membershipMap.get(conv.id)!
    const members = (allMembers ?? []).filter(m => m.conversation_id === conv.id)
    const otherMember = members.find(m => m.user_id !== user.id)
    const otherProfile = otherMember ? profileMap.get(otherMember.user_id) : null
    const agent = conv.agent_id ? agentMap.get(conv.agent_id) : null
    const latestPage = latestPageMap.get(conv.id)

    // 自分だけの会話（他メンバーなし）= 自分の名前を表示
    const myProfile = profileMap.get(user.id)
    const isSelfConversation = conv.type === 'human' && !otherMember
    const isAmbientAgent = agent?.config?.type === 'ambient'
    const name = isAmbientAgent
      ? (myProfile?.display_name ?? '自分')
      : conv.type === 'agent'
        ? (agent?.name ?? 'Agent')
        : isSelfConversation
          ? (myProfile?.display_name ?? '自分')
          : (otherProfile?.display_name ?? '不明')
    const avatarUrl = conv.type === 'human'
      ? (isSelfConversation ? myProfile?.avatar_url : otherProfile?.avatar_url)
      : null

    return {
      id: conv.id,
      type: conv.type,
      name,
      avatarUrl,
      pinned: membership.pinned,
      lastActivity: conv.updated_at,
      latestPageTitle: latestPage?.title ?? null,
      agentId: conv.agent_id,
      agentStatus: agent?.status,
      agentTrustScore: agent?.trust_score,
    }
  })

  // 検索フィルタ
  const filtered = q
    ? result.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : result

  // ピン留め優先 → 最新順
  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  })

  return NextResponse.json(filtered)
}

// POST /api/conversations — 新規会話作成
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type = 'human', agentId, memberUserId } = body as {
    type?: 'human' | 'agent'
    agentId?: string
    memberUserId?: string
  }

  // 会話を作成
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ type, agent_id: agentId ?? null })
    .select()
    .single()

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

  // 自分をメンバーに追加
  await supabase.from('conversation_members').insert({
    conversation_id: conv.id,
    user_id: user.id,
  })

  // human会話の場合、相手もメンバーに追加
  if (type === 'human' && memberUserId) {
    await supabase.from('conversation_members').insert({
      conversation_id: conv.id,
      user_id: memberUserId,
    })
  }

  // 最初のページを自動作成
  const { data: page } = await supabase
    .from('pages')
    .insert({
      title: '',
      owner_id: user.id,
      conversation_id: conv.id,
    })
    .select()
    .single()

  return NextResponse.json({ ...conv, firstPageId: page?.id }, { status: 201 })
}
