'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const LLM_PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek', description: '低コスト・高速' },
  { value: 'openai', label: 'OpenAI (GPT-4o mini)', description: 'バランス型' },
  { value: 'anthropic', label: 'Anthropic (Claude)', description: '高品質・高コスト' },
] as const

interface AgentCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function AgentCreateDialog({ open, onOpenChange, onCreated }: AgentCreateDialogProps) {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<string>('deepseek')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          config: {
            type: 'ambient',
            provider,
            ...(systemPrompt.trim() && { systemPrompt: systemPrompt.trim() }),
          },
        }),
      })
      if (res.ok) {
        setName('')
        setProvider('deepseek')
        setSystemPrompt('')
        onOpenChange(false)
        onCreated?.()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>エージェント作成</SheetTitle>
          <SheetDescription>新しいAIエージェントを作成します</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">名前</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="エージェント名"
            />
          </div>

          {/* LLM Provider */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">LLMプロバイダー</label>
            <div className="flex flex-col gap-2">
              {LLM_PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProvider(p.value)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    provider === p.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </div>
                  {provider === p.value && (
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              システムプロンプト
              <span className="text-xs text-muted-foreground ml-1">(任意)</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="エージェントの振る舞いをカスタマイズ..."
              rows={4}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="w-full"
          >
            {submitting ? '作成中...' : '作成'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
