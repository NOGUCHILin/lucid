'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@lucid/database/client'

// 後方互換: /[pageId] → /c/[conversationId]/[pageId] にリダイレクト
export default function LegacyEditorPage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = use(params)
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const supabase = createClient()
      const { data } = await supabase
        .from('pages')
        .select('conversation_id')
        .eq('id', pageId)
        .single()

      if (data?.conversation_id) {
        router.replace(`/c/${data.conversation_id}/${pageId}`)
      } else {
        router.replace('/')
      }
    }
    redirect()
  }, [pageId, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
