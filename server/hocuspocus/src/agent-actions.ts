/**
 * エージェントアクション: 信頼度に基づく書き込み方式の判定
 */
import * as Y from 'yjs'
import { createClient } from '@supabase/supabase-js'
import { writeToPage } from './agent-writer'
import type { Hocuspocus } from '@hocuspocus/server'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

let hocuspocusRef: Hocuspocus | null = null
export function setHocuspocusRef(instance: Hocuspocus) {
  hocuspocusRef = instance
}

export type ActionType = 'direct_write' | 'approval_card'

export function resolveAction(trustScore: number, responseLength: number): ActionType {
  if (trustScore < 50) return 'approval_card'
  if (trustScore >= 80) return 'direct_write'
  return responseLength > 200 ? 'approval_card' : 'direct_write'
}

/** エージェント名付きでページに直接書き込み */
export async function agentDirectWrite(pageId: string, agentName: string, text: string) {
  await writeToPage(pageId, `💡 ${agentName}: ${text}`)
}

/** 承認カードをY.Docに挿入 + approval_requestsレコード作成 */
export async function insertApprovalCard(params: {
  pageId: string
  agentId: string
  agentName: string
  suggestion: string
  intent: string
  costJpy: number
}): Promise<string | null> {
  if (!supabase || !hocuspocusRef) return null

  // DB に approval_request を作成
  const { data, error } = await supabase.from('approval_requests').insert({
    agent_id: params.agentId,
    page_id: params.pageId,
    action_type: 'write',
    description: params.suggestion,
    amount: params.costJpy,
    metadata: { intent: params.intent, agent_name: params.agentName },
  }).select('id').single()

  if (error || !data) {
    console.error('[agent-actions] Failed to create approval request:', error?.message)
    return null
  }

  // Y.Doc に承認カードノードを挿入
  try {
    const connection = await hocuspocusRef.openDirectConnection(params.pageId, { agentWrite: true })
    await connection.transact((doc: Y.Doc) => {
      const fragment = doc.getXmlFragment('default')
      const cardNode = new Y.XmlElement('approvalCard')
      cardNode.setAttribute('requestId', data.id)
      cardNode.setAttribute('agentId', params.agentId)
      cardNode.setAttribute('agentName', params.agentName)
      cardNode.setAttribute('suggestion', params.suggestion)
      cardNode.setAttribute('intent', params.intent)
      cardNode.setAttribute('status', 'pending')
      fragment.insert(fragment.length, [cardNode])
    })
    await connection.disconnect()
  } catch (e) {
    console.error('[agent-actions] Failed to insert approval card:', e)
  }

  return data.id
}
