'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { pushEvent, startFlushing, stopFlushing } from '@/lib/behavior-buffer'

const IDLE_THRESHOLD = 10_000 // 10秒で pause イベント

interface UseBehaviorTrackerOptions {
  editor: Editor | null
  pageId: string
  userId: string
}

export function useBehaviorTracker({ editor, pageId, userId }: UseBehaviorTrackerOptions) {
  const lastActivityRef = useRef(Date.now())
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPausedRef = useRef(false)

  const emit = useCallback(
    (eventType: 'edit' | 'cursor_move' | 'pause' | 'selection' | 'focus' | 'blur', payload: Record<string, unknown> = {}) => {
      pushEvent({ pageId, userId, eventType, payload })
    },
    [pageId, userId]
  )

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    hasPausedRef.current = false
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (!hasPausedRef.current) {
        hasPausedRef.current = true
        emit('pause', { idleMs: IDLE_THRESHOLD })
      }
    }, IDLE_THRESHOLD)
  }, [emit])

  useEffect(() => {
    if (!editor) return

    startFlushing()
    resetIdleTimer()

    const onTransaction = () => {
      resetIdleTimer()
    }

    const onUpdate = () => {
      emit('edit', { charCount: editor.storage.characterCount?.characters?.() ?? 0 })
    }

    const onSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      if (from === to) {
        emit('cursor_move', { pos: from })
      } else {
        emit('selection', { from, to })
      }
    }

    const onFocus = () => emit('focus')
    const onBlur = () => emit('blur')

    editor.on('transaction', onTransaction)
    editor.on('update', onUpdate)
    editor.on('selectionUpdate', onSelectionUpdate)
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)

    return () => {
      editor.off('transaction', onTransaction)
      editor.off('update', onUpdate)
      editor.off('selectionUpdate', onSelectionUpdate)
      editor.off('focus', onFocus)
      editor.off('blur', onBlur)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      stopFlushing()
    }
  }, [editor, emit, resetIdleTimer])
}
