'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Page {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export default function PageList() {
  const router = useRouter()
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pages')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then((data: Page[]) => setPages(data))
      .catch(() => setPages([]))
      .finally(() => setLoading(false))
  }, [])

  async function createPage() {
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '無題のページ' }),
    })
    if (!res.ok) return
    const page: { id: string } = await res.json()
    router.push(`/${page.id}`)
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Lucid</h1>
        <Button onClick={createPage}>
          <Plus className="size-4" />
          新しいページ
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      ) : pages.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">まだページがありません</p>
          <Button variant="outline" onClick={createPage}>
            <Plus className="size-4" />
            最初のページを作成
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Link key={page.id} href={`/${page.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">{page.title || '無題のページ'}</CardTitle>
                  <CardDescription>
                    {new Date(page.updated_at).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
