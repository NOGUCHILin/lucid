'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import type { HocuspocusProvider } from '@hocuspocus/provider'

export type AgentEventType = 'input_pause' | 'mention' | 'paragraph_complete' | 'page_transition'

export interface AgentEvent {
  type: AgentEventType
  payload: Record<string, unknown>
  timestamp: string
  userId: string
  pageId: string
}

interface UseAgentEventsOptions {
  editor: Editor | null
  provider: HocuspocusProvider | null
  pageId: string
  userId: string
  enabled: boolean
  agentId?: string | null
}

const INPUT_PAUSE_MS = 3000

export function useAgentEvents({ editor, provider, pageId, userId, enabled, agentId }: UseAgentEventsOptions) {
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMentionCount = useRef(0)

  const sendEvent = useCallback((type: AgentEventType, payload: Record<string, unknown> = {}) => {
    if (!provider) return
    const event: AgentEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      userId,
      pageId,
    }
    provider.sendStateless(JSON.stringify({ type: 'agentEvent', data: event }))
  }, [provider, userId, pageId])

  // input_pause: エディタ更新後3秒で発火
  useEffect(() => {
    if (!editor || !enabled) return

    const onUpdate = () => {
      if (pauseTimer.current) clearTimeout(pauseTimer.current)
      pauseTimer.current = setTimeout(() => {
        const text = editor.getText()
        if (text.trim().length < 5) return
        const pos = editor.state.selection.$head.pos
        // カーソル前200文字をコンテキストとして送信
        const start = Math.max(0, pos - 200)
        const contextText = editor.state.doc.textBetween(start, pos, '\n')
        sendEvent('input_pause', { cursorPos: pos, contextText })
      }, INPUT_PAUSE_MS)
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      if (pauseTimer.current) clearTimeout(pauseTimer.current)
    }
  }, [editor, enabled, sendEvent])

  // paragraph_complete: Enter押下検知
  useEffect(() => {
    if (!editor || !enabled) return

    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean; steps: Array<{ toJSON?: () => { stepType?: string } }>; selection: { $from: { depth: number; node: (d: number) => { type?: { name: string } } | null; nodeBefore: { textContent: string } | null } } } }) => {
      if (!transaction.docChanged) return
      // Enter押下でノード追加された場合を検出
      const steps = transaction.steps
      for (const step of steps) {
        if (step.toJSON?.()?.stepType === 'replaceAround' || step.toJSON?.()?.stepType === 'replace') {
          // 新しい段落が作成された → 前の段落のテキストを確認
          const { $from } = transaction.selection
          const prevNode = $from.node($from.depth)
          if (prevNode?.type?.name === 'paragraph') {
            const prevText = $from.nodeBefore?.textContent || ''
            if (prevText.length > 20) {
              sendEvent('paragraph_complete', { paragraphText: prevText })
            }
          }
        }
      }
    }

    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor, enabled, sendEvent])

  // mention: @agentメンション検出（新規追加時のみ）
  useEffect(() => {
    if (!editor || !enabled || !agentId) return

    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean; doc: { nodesBetween: (from: number, to: number, cb: (node: { type: { name: string }; attrs: { id?: string } }, pos: number) => boolean | void) => void; textBetween: (from: number, to: number, sep?: string) => string; content: { size: number } } } }) => {
      if (!transaction.docChanged) return
      // 現在のdoc内のagentメンション数をカウント
      let count = 0
      transaction.doc.nodesBetween(0, transaction.doc.content.size, (node) => {
        if (node.type.name === 'mention' && node.attrs.id === agentId) count++
      })
      // 新しいメンションが追加された場合のみ発火
      if (count > lastMentionCount.current) {
        const pageText = editor.getText()
        sendEvent('mention', { instructionText: pageText.substring(0, 500) })
      }
      lastMentionCount.current = count
    }

    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor, enabled, agentId, sendEvent])

  // page_transition: アンマウント時
  useEffect(() => {
    if (!enabled) return
    return () => {
      sendEvent('page_transition', { oldPageId: pageId })
    }
  }, [pageId, enabled, sendEvent])
}
