/**
 * 信頼度自動調整
 * 承認/却下フィードバック等に基づき信頼度を動的に変化させる
 */
import { supabase } from './supabase'

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
