/**
 * DeepSeek API クライアント（OpenAI互換）
 * トークン使用量→JPYコスト計算を提供
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat' // DeepSeek-V3.2

// DeepSeek-V3.2 pricing (USD per 1M tokens → JPY)
const JPY_PER_USD = 150
const COST_PER_INPUT_TOKEN = (0.28 / 1_000_000) * JPY_PER_USD   // ¥0.000042
const COST_PER_OUTPUT_TOKEN = (0.42 / 1_000_000) * JPY_PER_USD  // ¥0.000063

export interface LLMResponse {
  text: string
  inputTokens: number
  outputTokens: number
  costJpy: number
}

export function calculateCost(inputTokens: number, outputTokens: number): number {
  return Math.ceil(
    (inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN) * 100
  ) / 100
}

export async function generateAgentResponse(params: {
  pageContent: string
  intent: string
  confidence: number
  recentEvents: string
  trustScore: number
  agentName: string
}): Promise<LLMResponse | null> {
  if (!DEEPSEEK_API_KEY) {
    console.warn('[deepseek-client] DEEPSEEK_API_KEY not set, skipping')
    return null
  }

  const systemPrompt = `あなたは共同編集ドキュメントに存在する環境型AIアシスタント「${params.agentName}」です。
ユーザーの行動を観察し、困っている時や探している時にだけ自然に補助します。
侵入的にならず、短く的確な助言を日本語で提供してください。

現在の信頼度: ${params.trustScore}/100
- 信頼度 < 50: 提案は承認カード経由（直接書き込み禁止）
- 信頼度 50-79: 短い提案は直接、大きな変更は承認カード
- 信頼度 >= 80: 自律的に行動可能`

  const userMessage = `【ページ内容】
${params.pageContent.substring(0, 2000)}

【検出された意図】${params.intent}（確信度: ${params.confidence}）

【直近の行動】
${params.recentEvents}

上記を踏まえ、ユーザーを助ける短いテキスト（1-3文）を生成してください。`

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      console.error(`[deepseek-client] API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    const inputTokens = data.usage?.prompt_tokens || 0
    const outputTokens = data.usage?.completion_tokens || 0

    return {
      text,
      inputTokens,
      outputTokens,
      costJpy: calculateCost(inputTokens, outputTokens),
    }
  } catch (e) {
    console.error('[deepseek-client] API error:', e)
    return null
  }
}

/**
 * 環境型エージェント専用: ユーザーのクローンとして次の文章を予測
 */
export async function generateAmbientResponse(params: {
  pageContent: string
  crossContextSummaries: string
  userName: string
  agentName: string
}): Promise<LLMResponse | null> {
  if (!DEEPSEEK_API_KEY) {
    console.warn('[deepseek-client] DEEPSEEK_API_KEY not set, skipping')
    return null
  }

  const systemPrompt = `あなたは「${params.userName}」の環境型AIアシスタントです。
${params.userName}の全会話の文脈を把握しており、${params.userName}のように考え、提案します。

## あなたの役割
- ユーザーが書きそうな次の文章を予測して提案する
- 他の会話で得た情報を統合して助言する
- ユーザーの文体・口調を模倣する

## ルール
- 提案は1文のみ（短く自然に）
- ユーザーの文脈に合った内容だけを提案
- 説明や前置きは不要。提案文のみ出力`

  const userMessage = `${params.crossContextSummaries ? `【他の会話の文脈】\n${params.crossContextSummaries}\n\n` : ''}【現在のテキスト】
${params.pageContent.substring(0, 2000)}

上記テキストの続きとして${params.userName}が書きそうな次の1文を提案してください。提案文のみ出力。`

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      console.error(`[deepseek-client] Ambient API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    const inputTokens = data.usage?.prompt_tokens || 0
    const outputTokens = data.usage?.completion_tokens || 0

    return {
      text: text.trim(),
      inputTokens,
      outputTokens,
      costJpy: calculateCost(inputTokens, outputTokens),
    }
  } catch (e) {
    console.error('[deepseek-client] Ambient API error:', e)
    return null
  }
}

/**
 * コンテキスト要約生成（低コスト設定）
 */
export async function generateContextSummary(text: string): Promise<LLMResponse | null> {
  if (!DEEPSEEK_API_KEY) return null

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0.3,
        messages: [
          { role: 'system', content: '会話テキストを100-200字で要約してください。要約のみ出力。' },
          { role: 'user', content: text.substring(0, 3000) },
        ],
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content || ''
    const inputTokens = data.usage?.prompt_tokens || 0
    const outputTokens = data.usage?.completion_tokens || 0

    return {
      text: summary.trim(),
      inputTokens,
      outputTokens,
      costJpy: calculateCost(inputTokens, outputTokens),
    }
  } catch {
    return null
  }
}
