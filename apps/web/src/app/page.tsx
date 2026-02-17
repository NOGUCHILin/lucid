'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, ArrowUpDown, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { usePages } from '@/hooks/usePages'

export default function Dashboard() {
  const router = useRouter()
  const { pages, loading, query, sort, order, search, setSort, setOrder, refresh } = usePages()

  async function createPage() {
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '無題のページ' }),
    })
    if (!res.ok) return
    const page: { id: string } = await res.json()
    refresh()
    router.push(`/${page.id}`)
  }

  function toggleSort(field: typeof sort) {
    if (sort === field) setOrder(order === 'desc' ? 'asc' : 'desc')
    else { setSort(field); setOrder('desc') }
  }

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Lucid</h1>
        <Button onClick={createPage}>
          <Plus className="size-4" />
          新しいページ
        </Button>
      </div>

      {/* Search & Sort */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ページを検索..."
            value={query}
            onChange={(e) => search(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => toggleSort('updated_at')} className="shrink-0">
          <ArrowUpDown className="size-3.5 mr-1" />
          更新日{sort === 'updated_at' && (order === 'desc' ? ' ↓' : ' ↑')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toggleSort('title')} className="shrink-0">
          <ArrowUpDown className="size-3.5 mr-1" />
          タイトル{sort === 'title' && (order === 'desc' ? ' ↓' : ' ↑')}
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            {query ? `「${query}」に一致するページがありません` : 'まだページがありません'}
          </p>
          {!query && (
            <Button variant="outline" onClick={createPage}>
              <Plus className="size-4" />
              最初のページを作成
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Link key={page.id} href={`/${page.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-base truncate">{page.title || '無題のページ'}</CardTitle>
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
