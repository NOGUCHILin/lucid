/**
 * Vercel AI SDK ベースの LLM クライアント
 * プロバイダー切り替えで任意のモデルに対応
 */
import { generateText, generateObject, streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

// OpenAI互換プロバイダー（OpenRouter, Ollama, vLLM等にも使える）
const provider = createOpenAI({
  baseURL: process.env.LLM_BASE_URL || 'http://localhost:11434/v1',
  apiKey: process.env.LLM_API_KEY || 'ollama', // OllamaはダミーキーでOK
})

const defaultModel = process.env.LLM_MODEL || 'llama3.2'

export async function generate(
  messages: ModelMessage[],
  model?: string
): Promise<string> {
  const { text } = await generateText({
    model: provider(model || defaultModel),
    messages,
    temperature: 0.7,
    maxOutputTokens: 500,
  })
  return text
}

export async function generateStructured<T>(
  messages: ModelMessage[],
  schema: z.ZodType<T>,
  model?: string
): Promise<T> {
  const { object } = await generateObject({
    model: provider(model || defaultModel),
    messages,
    schema,
    temperature: 0.3,
  })
  return object
}

export function stream(
  messages: ModelMessage[],
  model?: string
) {
  return streamText({
    model: provider(model || defaultModel),
    messages,
    temperature: 0.7,
    maxOutputTokens: 500,
  })
}

export async function health(): Promise<boolean> {
  try {
    await generate([{ role: 'user', content: 'hi' }])
    return true
  } catch {
    return false
  }
}
