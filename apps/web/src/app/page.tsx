'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ダッシュボード: 最新の会話にリダイレクト、なければウェルカム画面
export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.ok ? res.json() : [])
      .then((convs: { id: string }[]) => {
        if (convs.length > 0) {
          router.replace(`/c/${convs[0].id}`)
        } else {
          setEmpty(true)
          setLoading(false)
        }
      })
      .catch(() => {
        setEmpty(true)
        setLoading(false)
      })
  }, [router])

  if (loading && !empty) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <MessageSquare className="size-12 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-medium">Lucidへようこそ</h2>
        <p className="text-sm text-muted-foreground">
          フレンドを追加して会話を始めましょう
        </p>
        <Button variant="outline" onClick={() => {/* FriendRequestModal is in sidebar */}}>
          <UserPlus className="size-4" />
          サイドバーからフレンドを追加
        </Button>
      </div>
    </div>
  )
}
