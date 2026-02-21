'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useEffect, useMemo, useState } from 'react'
import { useBehaviorTracker } from '@/hooks/useBehaviorTracker'
import { useAgentEvents } from '@/hooks/useAgentEvents'
import { ApprovalCard } from './extensions/approval-card'
import { createMentionExtension } from './extensions/mention'
import { ImageUpload } from './extensions/image-upload'
import { CodeBlockHighlight } from './extensions/code-block-highlight'
import { InlineSuggestion, pluginKey as inlineSuggestionKey } from './extensions/inline-suggestion'
import { PresenceBar } from './PresenceBar'
import { TypingIndicator } from './TypingIndicator'

interface TipTapEditorProps {
  pageId: string
  userId?: string
  userName?: string
  userColor?: string
  onTextUpdate?: (text: string) => void
  /** 環境エージェントのインライン補完を有効にする */
  enableSuggestion?: boolean
  /** ページに割り当てられたエージェントID */
  agentId?: string | null
}

export function TipTapEditor({
  pageId,
  userId = 'anonymous',
  userName = 'Anonymous',
  userColor = '#3b82f6',
  onTextUpdate,
  enableSuggestion = false,
  agentId,
}: TipTapEditorProps) {
  const [, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  const { ydoc, provider } = useMemo(() => {
    const ydoc = new Y.Doc()
    const provider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://127.0.0.1:1234',
      name: pageId,
      document: ydoc,
      onConnect() {
        setStatus('connected')
      },
      onDisconnect() {
        setStatus('disconnected')
      },
    })
    return { ydoc, provider }
  }, [pageId])

  useEffect(() => {
    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [provider, ydoc])

  const extensions = useMemo(() => [
    StarterKit.configure({
      undoRedo: false,
      codeBlock: false,
    }),
    Collaboration.configure({
      document: ydoc,
    }),
    CollaborationCaret.configure({
      provider,
      user: { name: userName, color: userColor },
    }),
    ApprovalCard,
    createMentionExtension(agentId),
    ImageUpload,
    CodeBlockHighlight,
    InlineSuggestion,
  ], [ydoc, provider, userName, userColor, agentId])

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none focus:outline-none min-h-[var(--page-min-height)] p-[var(--page-padding)]',
      },
    },
    onUpdate({ editor: e }) {
      onTextUpdate?.(e.getText())
    },
  }, [ydoc, provider])

  useBehaviorTracker({ editor, pageId, userId })
  useAgentEvents({ editor, provider, pageId, userId, enabled: enableSuggestion, agentId })

  // サーバーPush: provider.on('stateless') で提案を受信しインライン表示
  useEffect(() => {
    if (!provider || !editor || !enableSuggestion) return

    const handler = ({ payload }: { payload: string }) => {
      try {
        const data = JSON.parse(payload)
        if (data.type === 'suggestion' && data.suggestion) {
          const { tr } = editor.state
          tr.setMeta(inlineSuggestionKey, { suggestion: data.suggestion })
          editor.view.dispatch(tr)
        }
      } catch {
        // invalid JSON — ignore
      }
    }

    provider.on('stateless', handler)
    return () => { provider.off('stateless', handler) }
  }, [provider, editor, enableSuggestion])

  // Idle detection: 30s no activity → away
  useEffect(() => {
    if (!provider?.awareness) return
    let idleTimer: ReturnType<typeof setTimeout>

    const resetIdle = () => {
      provider.awareness?.setLocalStateField('user', {
        name: userName, color: userColor, role: 'human', status: 'online', isTyping: false,
      })
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        provider.awareness?.setLocalStateField('user', {
          name: userName, color: userColor, role: 'human', status: 'away', isTyping: false,
        })
      }, 30_000)
    }

    resetIdle()
    const events = ['mousemove', 'keydown', 'click', 'scroll'] as const
    events.forEach((e) => document.addEventListener(e, resetIdle))

    return () => {
      clearTimeout(idleTimer)
      events.forEach((e) => document.removeEventListener(e, resetIdle))
    }
  }, [provider, userName, userColor])

  // Typing indicator
  useEffect(() => {
    if (!editor || !provider?.awareness) return
    let typingTimer: ReturnType<typeof setTimeout>

    const onUpdate = () => {
      provider.awareness?.setLocalStateField('user', {
        name: userName, color: userColor, role: 'human', status: 'online', isTyping: true,
      })
      clearTimeout(typingTimer)
      typingTimer = setTimeout(() => {
        provider.awareness?.setLocalStateField('user', {
          name: userName, color: userColor, role: 'human', status: 'online', isTyping: false,
        })
      }, 2_000)
    }

    editor.on('update', onUpdate)
    return () => {
      clearTimeout(typingTimer)
      editor.off('update', onUpdate)
    }
  }, [editor, provider, userName, userColor])

  return (
    <div className="flex flex-col items-center gap-0 md:gap-4">
      {/* Presence — デスクトップのみ */}
      <div className="hidden md:flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <PresenceBar provider={provider} />
      </div>
      <TypingIndicator provider={provider} />

      {/* A4 Page */}
      <div className="w-full max-w-[var(--page-width)] min-h-[var(--page-min-height)] bg-white md:shadow-lg md:border md:border-neutral-200 md:rounded-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
