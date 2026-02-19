'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, List, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  // スワイプ検出用
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

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

  // スワイプハンドラー
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    // 水平方向のスワイプのみ検出（60px以上、垂直は30px未満）
    if (Math.abs(dx) < 60 || Math.abs(dy) > 30) return
    if (dx > 0 && prevPageId) {
      router.push(`/c/${conversationId}/${prevPageId}`)
    } else if (dx < 0 && nextPage) {
      router.push(`/c/${conversationId}/${nextPage}`)
    } else if (dx < 0 && !nextPage) {
      handleCreateNext()
    }
  }, [prevPageId, nextPage, conversationId, router, handleCreateNext])

  return (
    <div
      className="h-full md:h-auto md:min-h-screen overflow-hidden md:overflow-auto flex flex-col md:block bg-white md:bg-neutral-100 py-0 md:py-4"
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      {/* Conversation Header — モバイルでは非表示（AppShellヘッダーに統合） */}
      {/* デスクトップのみ表示 */}
      <div className="hidden md:flex max-w-[var(--page-width)] mx-auto mb-3 items-center justify-between">
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
          {/* Page list toggle — デスクトップのみ */}
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

      {/* Mobile: 統合ヘッダー内の会話情報（AppShellのヘッダーに代わるインライン表示） */}
      <div className="flex md:hidden items-center justify-between px-3 py-1.5 border-b">
        <div className="flex items-center gap-2">
          <div className={`size-6 rounded-full flex items-center justify-center ${
            convType === 'agent' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {convType === 'agent' ? <Bot className="size-3" /> : <User className="size-3" />}
          </div>
          <span className="font-medium text-sm truncate">{convName || '自分'}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-0 md:flex-none md:gap-4 max-w-full md:max-w-[calc(var(--page-width)+320px)] mx-auto">
        {/* Editor */}
        <div className="flex-1 min-w-0 overflow-y-auto md:overflow-visible">
          <TipTapEditor pageId={pageId} userId={userId} onTextUpdate={onUpdate} enableSuggestion={convType === 'agent'} />

          {/* Page Navigation — デスクトップ */}
          <div className="hidden md:flex max-w-[var(--page-width)] mx-auto mt-3 items-center justify-between">
            {prevPageId ? (
              <Link href={`/c/${conversationId}/${prevPageId}`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <ChevronLeft className="size-4" />
                  前のページ
                </Button>
              </Link>
            ) : <div />}
            {nextPage ? (
              <Link href={`/c/${conversationId}/${nextPage}`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  次のページ
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleCreateNext}>
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

      {/* Mobile: ドットインジケーター（画面下部固定） */}
      {isMobile && totalPages > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center items-center gap-1.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {pages.map((p) => (
            <Link key={p.id} href={`/c/${conversationId}/${p.id}`}>
              <div className={`rounded-full transition-all ${
                p.id === pageId
                  ? 'w-2 h-2 bg-foreground'
                  : 'w-1.5 h-1.5 bg-neutral-300'
              }`} />
            </Link>
          ))}
          <button onClick={handleCreateNext} className="w-1.5 h-1.5 rounded-full border border-neutral-300 border-dashed" />
        </div>
      )}

    </div>
  )
}
