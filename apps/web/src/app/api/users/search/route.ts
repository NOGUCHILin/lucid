/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@lucid/database'

// GET /api/users/search?q=query — search users by email prefix (authenticated)
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q') || ''
  if (q.length < 2) return NextResponse.json([])

  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 10,
  })

  if (error) return NextResponse.json([])

  const filtered = (data?.users || [])
    .filter((u: any) =>
      (u.email || '').toLowerCase().includes(q.toLowerCase()) ||
      (u.user_metadata?.name || '').toLowerCase().includes(q.toLowerCase())
    )
    .slice(0, 5)
    .map((u: any) => ({
      id: u.id,
      name: u.user_metadata?.name || u.email?.split('@')[0] || 'User',
      email: u.email,
    }))

  return NextResponse.json(filtered)
}
