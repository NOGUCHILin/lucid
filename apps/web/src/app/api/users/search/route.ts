import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@lucid/database'

// GET /api/users/search?q=query — search users by email prefix
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || ''
  if (q.length < 1) return NextResponse.json([])

  const admin = createAdminClient()

  // Search auth.users via admin API (email ilike)
  const { data, error } = await (admin as any).auth.admin.listUsers({
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
