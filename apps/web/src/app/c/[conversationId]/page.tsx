'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// 会話ビュー: 最新ページを自動表示
export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = use(params)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 会話内のページ一覧を取得し、最新ページにリダイレクト
    fetch(`/api/conversations/${conversationId}/pages`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load pages')
        return res.json()
      })
      .then((pages: { id: string }[]) => {
        if (pages.length > 0) {
          // 最新ページ（配列末尾=created_at昇順の最後）
          const latestPage = pages[pages.length - 1]
          router.replace(`/c/${conversationId}/${latestPage.id}`)
        } else {
          setError('この会話にはまだページがありません')
        }
      })
      .catch(() => setError('会話の読み込みに失敗しました'))
  }, [conversationId, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {error}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
