import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@lucid/database'

// POST /api/invitations/verify — 招待コードの有効性チェック（認証不要）
export async function POST(request: NextRequest) {
  const { code } = await request.json()

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ valid: false, reason: 'invalid_input' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('verify_invitation', { p_code: code })

  if (error) {
    return NextResponse.json({ valid: false, reason: 'server_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
