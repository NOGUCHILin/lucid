'use client'

import { use, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, ChevronLeft, ChevronRight, List, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { usePageThreshold } from '@/hooks/usePageThreshold'
import { useIsMobile } from '@/hooks/useIsMobile'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { createClient } from '@lucid/database/client'

const TipTapEditor = dynamic(
  () => import('@/components/editor/TipTapEditor').then((m) => m.TipTapEditor),
  { ssr: false, loading: () => <div className="w-full max-w-[var(--page-width)] min-h-[var(--page-min-height)] mx-auto bg-white md:shadow-lg md:border md:border-neutral-200 md:rounded-sm animate-pulse" /> }
)

interface PageInfo {
  id: string
  title: string
  prev_page_id: string | null
  created_at: string
}

export default function ConversationPageView({
  params,
}: {
  params: Promise<{ conversationId: string; pageId: string }>
}) {
  const { conversationId, pageId } = use(params)
  const router = useRouter()
  const isMobile = useIsMobile()
  const { nextPageId, onUpdate, createNextPage } = usePageThreshold(pageId, conversationId)
  const [userId, setUserId] = useState<string>('anonymous')
  const [agentId, setAgentId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [pages, setPages] = useState<PageInfo[]>([])
  const [convName, setConvName] = useState('')
  const [convType, setConvType] = useState<'human' | 'agent'>('human')
  const [pageListOpen, setPageListOpen] = useState(false)

  // ユーザー情報＋ページ情報取得
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
    supabase.from('pages').select('agent_id').eq('id', pageId).single().then(({ data }) => {
      if (data?.agent_id) setAgentId(data.agent_id)
    })
  }, [pageId])

  // 会話情報＋ページ一覧取得
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/pages`)
      .then(res => res.ok ? res.json() : [])
      .then(setPages)
      .catch(() => {})

    fetch('/api/conversations')
      .then(res => res.ok ? res.json() : [])
      .then((convs: { id: string; name: string; type: 'human' | 'agent'; agentId: string | null }[]) => {
        const conv = convs.find(c => c.id === conversationId)
        if (conv) {
          setConvName(conv.name)
          setConvType(conv.type)
          if (conv.agentId) setAgentId(conv.agentId)
        }
      })
      .catch(() => {})
  }, [conversationId])

  const currentIdx = pages.findIndex(p => p.id === pageId)
  const prevPageId = currentIdx > 0 ? pages[currentIdx - 1].id : null
  const nextPage = currentIdx >= 0 && currentIdx < pages.length - 1 ? pages[currentIdx + 1].id : nextPageId

  async function handleCreateNext() {
    const newId = await createNextPage()
    if (newId) router.push(`/c/${conversationId}/${newId}`)
  }

  const pageNumber = currentIdx >= 0 ? currentIdx + 1 : 1
  const totalPages = pages.length

  return (
    <div className="min-h-screen bg-neutral-100 py-2 md:py-4">
      {/* Conversation Header */}
      <div className="max-w-[var(--page-width)] mx-auto mb-2 md:mb-3 px-3 md:px-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`size-7 rounded-full flex items-center justify-center ${
            convType === 'agent' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {convType === 'agent' ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
          </div>
          <span className="font-medium text-sm truncate">{convName || '自分'}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {pageNumber} / {totalPages} ページ
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Page list toggle */}
          <div className="relative">
            <Button variant="ghost" size="icon" className="size-9" onClick={() => setPageListOpen(!pageListOpen)}>
              <List className="size-4" />
            </Button>
            {pageListOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10 py-1 max-h-60 overflow-y-auto">
                {pages.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/c/${conversationId}/${p.id}`}
                    onClick={() => setPageListOpen(false)}
                  >
                    <div className={`px-3 py-2 text-sm hover:bg-neutral-50 ${p.id === pageId ? 'bg-neutral-100 font-medium' : 'text-muted-foreground'}`}>
                      {p.title || `ページ ${i + 1}`}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {convType === 'agent' && (
            <Button variant="outline" size="icon" className="size-9" onClick={() => setPanelOpen(!panelOpen)}>
              <Bot className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-0 md:gap-4 max-w-full md:max-w-[calc(var(--page-width)+320px)] mx-auto">
        {/* Editor */}
        <div className="flex-1 min-w-0">
          <TipTapEditor pageId={pageId} userId={userId} onTextUpdate={onUpdate} enableSuggestion={convType === 'agent'} />

          {/* Page Navigation */}
          <div className="max-w-[var(--page-width)] mx-auto mt-2 md:mt-3 px-3 md:px-0 flex items-center justify-between">
            {prevPageId ? (
              <Link href={`/c/${conversationId}/${prevPageId}`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground min-h-[44px]">
                  <ChevronLeft className="size-4" />
                  前のページ
                </Button>
              </Link>
            ) : <div />}

            {nextPage ? (
              <Link href={`/c/${conversationId}/${nextPage}`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground min-h-[44px]">
                  次のページ
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="ghost" size="sm" className="text-muted-foreground min-h-[44px]" onClick={handleCreateNext}>
                + 次のページを作成
              </Button>
            )}
          </div>
        </div>

        {/* Agent Panel — Desktop: sidebar, Mobile: Drawer */}
        {!isMobile && panelOpen && (
          <aside className="w-72 shrink-0 rounded-lg border bg-white shadow-sm">
            <AgentPanel agentId={agentId} />
          </aside>
        )}
      </div>

      {/* Agent Panel — Mobile Drawer */}
      {isMobile && (
        <Drawer open={panelOpen} onOpenChange={setPanelOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>エージェント</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-4">
              <AgentPanel agentId={agentId} />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  )
}
