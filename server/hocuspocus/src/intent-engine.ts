/**
 * 意図推論エンジン
 * ルールベース判定 → LLM呼び出し（必要時のみ）
 */
import { callLLM } from './llm-client'
import { readPage } from './agent-writer'

export type IntentType = 'stuck' | 'searching' | 'drafting' | 'idle' | 'unknown'

export interface IntentResult {
  intent: IntentType
  confidence: number
  suggestion?: string
}

interface BehaviorEvent {
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

const LLM_CONFIDENCE_THRESHOLD = 0.5
const MIN_INTERVAL_MS = 60_000 // 前回の推論から60秒以上

const lastInference = new Map<string, number>()

/** Clean up inference cache when agent loop stops */
export function clearInferenceCache(pageId: string) {
  lastInference.delete(pageId)
}

/**
 * ルールベース意図推論
 * LLM呼び出しの前段フィルタ
 */
export function inferRuleBased(events: BehaviorEvent[]): IntentResult {
  if (events.length === 0) return { intent: 'idle', confidence: 0.9 }

  const recent = events.slice(-20) // 直近20イベント
  const edits = recent.filter(e => e.event_type === 'edit')
  const cursorMoves = recent.filter(e => e.event_type === 'cursor_move')
  const pauses = recent.filter(e => e.event_type === 'pause')

  // パターン1: 同段落3回以上編集 + pause → "stuck"
  if (edits.length >= 3 && pauses.length >= 1) {
    return { intent: 'stuck', confidence: 0.7 }
  }

  // パターン2: 大量cursor_move（5回以上） → "searching"
  if (cursorMoves.length >= 5 && edits.length <= 1) {
    return { intent: 'searching', confidence: 0.6 }
  }

  // パターン3: 連続edit + 文字数増加 → "drafting"（介入不要）
  if (edits.length >= 3 && pauses.length === 0) {
    return { intent: 'drafting', confidence: 0.8 }
  }

  return { intent: 'unknown', confidence: 0.3 }
}

/**
 * LLM拡張推論（ルールベースでconfidence不足時）
 */
export async function inferWithLLM(
  pageId: string,
  events: BehaviorEvent[],
  ruleResult: IntentResult
): Promise<IntentResult> {
  // インターバルチェック
  const now = Date.now()
  const last = lastInference.get(pageId) ?? 0
  if (now - last < MIN_INTERVAL_MS) {
    return ruleResult
  }

  // confidence閾値チェック
  if (ruleResult.confidence >= LLM_CONFIDENCE_THRESHOLD && ruleResult.intent !== 'unknown') {
    return ruleResult
  }

  lastInference.set(pageId, now)

  try {
    const pageContent = await readPage(pageId)
    const recentEvents = events.slice(-10).map(e => `${e.event_type}: ${JSON.stringify(e.payload)}`).join('\n')

    const llmResult = await callLLM(
      { provider: 'deepseek' },
      [
        {
          role: 'system',
          content: 'You are an ambient AI assistant observing a user editing a document. Based on their behavior, infer their intent and suggest how to help. Respond in JSON: {"intent":"stuck"|"searching"|"drafting"|"idle"|"unknown","confidence":0-1,"suggestion":"text"}',
        },
        {
          role: 'user',
          content: `Document content:\n${pageContent.substring(0, 1000)}\n\nRecent behavior:\n${recentEvents}\n\nRule-based inference: ${ruleResult.intent} (confidence: ${ruleResult.confidence})`,
        },
      ],
      300,
      0.3,
    )

    if (!llmResult?.text) return ruleResult
    const parsed = JSON.parse(llmResult.text)
    return {
      intent: parsed.intent || ruleResult.intent,
      confidence: parsed.confidence ?? ruleResult.confidence,
      suggestion: parsed.suggestion,
    }
  } catch (e) {
    console.error('[intent-engine] LLM inference failed:', e)
    return ruleResult
  }
}

/**
 * メイン推論関数
 */
export async function inferIntent(
  pageId: string,
  events: BehaviorEvent[]
): Promise<IntentResult> {
  const ruleResult = inferRuleBased(events)

  // drafting or idle → 介入不要
  if (ruleResult.intent === 'drafting' || ruleResult.intent === 'idle') {
    return ruleResult
  }

  // stuck or searching → LLM で提案テキスト生成
  return inferWithLLM(pageId, events, ruleResult)
}
