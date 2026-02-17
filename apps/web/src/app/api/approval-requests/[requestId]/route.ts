import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@lucid/database'

// PATCH /api/approval-requests/[requestId] — approve or reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { status } = await request.json()

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be "approved" or "rejected"' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('approval_requests')
    .update({
      status,
      resolved_by: user?.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  }

  // 信頼度自動調整
  const admin = createAdminClient()
  if (data.agent_id) {
    const eventType = status === 'approved' ? 'approval_accepted' : 'approval_rejected'
    const delta = status === 'approved' ? 2 : -5
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).rpc('adjust_trust', {
      p_agent_id: data.agent_id,
      p_event_type: eventType,
      p_delta: delta,
      p_reason: `Approval request ${requestId} ${status}`,
    })
  }

  // 承認→実行: spend アクションの場合は agent_spend RPC で決済
  let executionResult = null
  if (status === 'approved' && data.action_type === 'spend' && data.amount && data.agent_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: spendResult, error: spendError } = await (admin as any).rpc('agent_spend', {
      p_agent_id: data.agent_id,
      p_amount: data.amount,
      p_description: data.description || 'Approved spend',
    })

    if (spendError) {
      executionResult = { error: spendError.message }
    } else {
      executionResult = spendResult
    }
  }

  return NextResponse.json({ ...data, execution: executionResult })
}
