import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// PATCH /api/approval-requests/[requestId] — approve or reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params
  const supabase = await createServerClient()
  const { status } = await request.json()

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be "approved" or "rejected"' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('approval_requests')
    .update({ status })
    .eq('id', requestId)
    .eq('status', 'pending') // can only update pending requests
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  }

  return NextResponse.json(data)
}
