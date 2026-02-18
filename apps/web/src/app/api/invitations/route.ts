import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'
import { randomBytes } from 'crypto'

function generateCode(): string {
  return randomBytes(4).toString('hex').toUpperCase() // 8文字の英数字
}

// GET /api/invitations — 自分が発行した招待一覧
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('invitations')
    .select('id, code, used_by, used_at, expires_at, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitations: data })
}

// POST /api/invitations — 新しい招待コード生成
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const expiresInDays = Math.min(Math.max(body.expiresInDays || 7, 1), 30)

  const code = generateCode()
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      code,
      created_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitation: data }, { status: 201 })
}
