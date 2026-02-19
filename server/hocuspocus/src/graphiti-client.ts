/**
 * Graphiti REST APIクライアント
 * Hocuspocusサーバーからナレッジグラフに読み書きする
 */

const GRAPHITI_URL = process.env.GRAPHITI_API_URL || 'http://localhost:8000'

export interface GraphitiFact {
  uuid: string
  fact: string
  valid_at: string
  invalid_at: string | null
  created_at: string
}

/** ナレッジグラフに会話エピソードを追加 */
export async function addEpisode(params: {
  groupId: string
  name: string
  content: string
  role: 'user' | 'agent'
  sourceDescription: string
}): Promise<void> {
  try {
    await fetch(`${GRAPHITI_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: params.groupId,
        messages: [{
          uuid: crypto.randomUUID(),
          name: params.name,
          role: params.role,
          role_type: 'user',
          content: params.content,
          timestamp: new Date().toISOString(),
          source_description: params.sourceDescription,
        }],
      }),
    })
  } catch (e) {
    console.error('[graphiti] addEpisode error:', e)
  }
}

/** ナレッジグラフを検索し関連事実を取得 */
export async function searchFacts(params: {
  query: string
  groupId: string
  maxFacts?: number
}): Promise<GraphitiFact[]> {
  try {
    const res = await fetch(`${GRAPHITI_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.query,
        group_ids: [params.groupId],
        max_facts: params.maxFacts || 5,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.facts || []
  } catch (e) {
    console.error('[graphiti] searchFacts error:', e)
    return []
  }
}

/** 事実リストをプロンプト用文字列に整形 */
export function formatFactsForPrompt(facts: GraphitiFact[]): string {
  if (facts.length === 0) return ''
  return facts.map(f => `- ${f.fact}`).join('\n')
}
