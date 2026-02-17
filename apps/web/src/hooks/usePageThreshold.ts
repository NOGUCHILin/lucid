'use client'

import { useCallback, useEffect, useState } from 'react'

const CHAR_THRESHOLD = 2000

export function usePageThreshold(pageId: string) {
  const [charCount, setCharCount] = useState(0)
  const [nextPageId, setNextPageId] = useState<string | null>(null)
  const [thresholdReached, setThresholdReached] = useState(false)

  // エディタの文字数を監視するためのコールバック
  const onUpdate = useCallback((text: string) => {
    const count = text.length
    setCharCount(count)
    setThresholdReached(count >= CHAR_THRESHOLD)
  }, [])

  // 次のページを作成
  const createNextPage = useCallback(async () => {
    if (nextPageId) return nextPageId

    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '無題のページ',
        prevPageId: pageId,
      }),
    })
    const page = await res.json()
    setNextPageId(page.id)
    return page.id as string
  }, [pageId, nextPageId])

  // 既存の次ページを確認
  useEffect(() => {
    fetch(`/api/pages/${pageId}/next`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.id) setNextPageId(data.id)
      })
      .catch(() => {})
  }, [pageId])

  return {
    charCount,
    thresholdReached,
    nextPageId,
    onUpdate,
    createNextPage,
  }
}
