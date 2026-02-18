import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@lucid/database'

// POST /api/invitations/use — 招待コード使用をマーク（signUp直後に呼ばれる）
export async function POST(request: NextRequest) {
  const { code, userId } = await request.json()

  if (!code || !userId) {
    return NextResponse.json({ error: 'code and userId are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('use_invitation', {
    p_code: code,
    p_user_id: userId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
