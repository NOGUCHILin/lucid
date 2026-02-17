'use client'

import { use, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePageThreshold } from '@/hooks/usePageThreshold'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { createClient } from '@lucid/database/client'

const TipTapEditor = dynamic(
  () => import('@/components/editor/TipTapEditor').then((m) => m.TipTapEditor),
  { ssr: false, loading: () => <div className="w-full max-w-[var(--page-width)] min-h-[var(--page-min-height)] mx-auto bg-white shadow-lg border border-neutral-200 rounded-sm animate-pulse" /> }
)

export default function EditorPage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = use(params)
  const { nextPageId, onUpdate, createNextPage } = usePageThreshold(pageId)
  const [userId, setUserId] = useState<string>('anonymous')
  const [agentId, setAgentId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
    supabase.from('pages').select('agent_id').eq('id', pageId).single().then(({ data }) => {
      if (data?.agent_id) setAgentId(data.agent_id)
    })
  }, [pageId])

  return (
    <div className="min-h-screen bg-neutral-100 py-8">
      {/* Header */}
      <div className="max-w-[var(--page-width)] mx-auto mb-4 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            戻る
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPanelOpen(!panelOpen)}>
            <Bot className="size-4" />
            エージェント
          </Button>
          {nextPageId && (
            <Link href={`/${nextPageId}`}>
              <Button variant="outline" size="sm">
                次のページ →
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-4 max-w-[calc(var(--page-width)+320px)] mx-auto">
        {/* Editor */}
        <div className="flex-1">
          <TipTapEditor pageId={pageId} userId={userId} onTextUpdate={onUpdate} />

          {/* Next page trigger */}
          {!nextPageId && (
            <div className="max-w-[var(--page-width)] mt-4 flex justify-end">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={createNextPage}>
                + 次のページを作成
              </Button>
            </div>
          )}
        </div>

        {/* Agent Panel */}
        {panelOpen && (
          <aside className="w-72 shrink-0 rounded-lg border bg-white shadow-sm">
            <AgentPanel agentId={agentId} />
          </aside>
        )}
      </div>
    </div>
  )
}
