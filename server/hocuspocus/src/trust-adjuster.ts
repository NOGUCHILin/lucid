/**
 * 信頼度自動調整
 * 承認/却下フィードバック等に基づき信頼度を動的に変化させる
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export type TrustEventType =
  | 'approval_accepted'
  | 'approval_rejected'
  | 'budget_exceeded'
  | 'task_completed'
  | 'manual_adjust'

const DELTA_MAP: Record<Exclude<TrustEventType, 'manual_adjust'>, number> = {
  approval_accepted: 2,
  approval_rejected: -5,
  budget_exceeded: -3,
  task_completed: 1,
}

export async function adjustTrust(
  agentId: string,
  eventType: TrustEventType,
  reason = '',
  customDelta?: number
): Promise<{ oldScore: number; newScore: number; delta: number } | null> {
  if (!supabase) return null

  const delta = eventType === 'manual_adjust'
    ? (customDelta ?? 0)
    : DELTA_MAP[eventType]

  const { data, error } = await supabase.rpc('adjust_trust', {
    p_agent_id: agentId,
    p_event_type: eventType,
    p_delta: delta,
    p_reason: reason,
  })

  if (error) {
    console.error('[trust-adjuster] error:', error.message)
    return null
  }

  return {
    oldScore: data.old_score,
    newScore: data.new_score,
    delta: data.delta,
  }
}
