'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Page {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type SortField = 'updated_at' | 'created_at' | 'title'

export function usePages() {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortField>('updated_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const fetchPages = useCallback(async (q: string, s: SortField, o: 'asc' | 'desc') => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('sort', s)
    params.set('order', o)

    try {
      const res = await fetch(`/api/pages?${params}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data: Page[] = await res.json()
      setPages(data)
    } catch {
      setPages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPages(query, sort, order)
  }, [sort, order, fetchPages]) // eslint-disable-line react-hooks/exhaustive-deps

  const search = useCallback((q: string) => {
    setQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPages(q, sort, order), 300)
  }, [sort, order, fetchPages])

  const refresh = useCallback(() => fetchPages(query, sort, order), [query, sort, order, fetchPages])

  return { pages, loading, query, sort, order, search, setSort, setOrder, refresh }
}
