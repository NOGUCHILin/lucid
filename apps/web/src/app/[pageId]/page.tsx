'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePageThreshold } from '@/hooks/usePageThreshold'

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

        {nextPageId && (
          <Link href={`/${nextPageId}`}>
            <Button variant="outline" size="sm">
              次のページ →
            </Button>
          </Link>
        )}
      </div>

      {/* Editor */}
      <TipTapEditor pageId={pageId} onTextUpdate={onUpdate} />

      {/* Next page trigger */}
      {!nextPageId && (
        <div className="max-w-[var(--page-width)] mx-auto mt-4 flex justify-end">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={createNextPage}>
            + 次のページを作成
          </Button>
        </div>
      )}
    </div>
  )
}
