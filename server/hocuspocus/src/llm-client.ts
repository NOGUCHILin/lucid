/**
 * マルチLLMクライアント
 * agents.config の provider/model に応じて適切なAPIを呼び分ける
 * DeepSeek/OpenAI は OpenAI互換API、Anthropic は Messages API
 */

export interface LLMConfig {
  provider: 'deepseek' | 'openai' | 'anthropic'
  model?: string
  systemPrompt?: string
}

export interface LLMResponse {
  text: string
  inputTokens: number
  outputTokens: number
  costJpy: number
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string; keyEnv: string }> = {
  deepseek: {
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyEnv: 'OPENAI_API_KEY',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5-20250929',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
}

// Cost per token (JPY)
const JPY_PER_USD = 150
const COST_TABLE: Record<string, { input: number; output: number }> = {
  deepseek: { input: (0.28 / 1_000_000) * JPY_PER_USD, output: (0.42 / 1_000_000) * JPY_PER_USD },
  openai: { input: (0.15 / 1_000_000) * JPY_PER_USD, output: (0.60 / 1_000_000) * JPY_PER_USD },
  anthropic: { input: (3.0 / 1_000_000) * JPY_PER_USD, output: (15.0 / 1_000_000) * JPY_PER_USD },
}

export function calculateCost(provider: string, inputTokens: number, outputTokens: number): number {
  const costs = COST_TABLE[provider] || COST_TABLE.deepseek
  return Math.ceil((inputTokens * costs.input + outputTokens * costs.output) * 100) / 100
}

/** OpenAI互換API呼び出し (DeepSeek / OpenAI) */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature?: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(temperature !== undefined && { temperature }),
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    text: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  }
}

/** Anthropic Messages API 呼び出し */
async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature?: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const systemMessage = messages.find(m => m.role === 'system')?.content || ''
  const nonSystemMessages = messages.filter(m => m.role !== 'system')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(temperature !== undefined && { temperature }),
      ...(systemMessage && { system: systemMessage }),
      messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    text: data.content?.[0]?.text || '',
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  }
}

/** 統一LLM呼び出し */
export async function callLLM(
  config: LLMConfig,
  messages: ChatMessage[],
  maxTokens: number,
  temperature?: number,
): Promise<LLMResponse | null> {
  const provider = config.provider || 'deepseek'
  const defaults = PROVIDER_DEFAULTS[provider]
  if (!defaults) {
    console.error(`[llm-client] Unknown provider: ${provider}`)
    return null
  }

  const apiKey = process.env[defaults.keyEnv] || ''
  if (!apiKey) {
    console.warn(`[llm-client] ${defaults.keyEnv} not set, skipping`)
    return null
  }

  const model = config.model || defaults.model

  try {
    let result: { text: string; inputTokens: number; outputTokens: number }

    if (provider === 'anthropic') {
      result = await callAnthropic(apiKey, model, messages, maxTokens, temperature)
    } else {
      result = await callOpenAICompatible(defaults.baseUrl, apiKey, model, messages, maxTokens, temperature)
    }

    return {
      text: result.text.trim(),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costJpy: calculateCost(provider, result.inputTokens, result.outputTokens),
    }
  } catch (e) {
    console.error(`[llm-client] ${provider} API error:`, e)
    return null
  }
}

/** agents.config jsonb から LLMConfig を抽出 */
export function extractLLMConfig(agentConfig: Record<string, unknown>): LLMConfig | undefined {
  const provider = agentConfig?.provider as string | undefined
  if (!provider || !PROVIDER_DEFAULTS[provider]) return undefined
  return {
    provider: provider as LLMConfig['provider'],
    model: agentConfig?.model as string | undefined,
    systemPrompt: agentConfig?.systemPrompt as string | undefined,
  }
}
