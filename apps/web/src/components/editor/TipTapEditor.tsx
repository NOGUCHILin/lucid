'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useEffect, useMemo, useState } from 'react'
import { useBehaviorTracker } from '@/hooks/useBehaviorTracker'
import { ApprovalCard } from './extensions/approval-card'
import { MentionExtension } from './extensions/mention'
import { ImageUpload } from './extensions/image-upload'
import { CodeBlockHighlight } from './extensions/code-block-highlight'
import { PresenceBar } from './PresenceBar'
import { TypingIndicator } from './TypingIndicator'

interface TipTapEditorProps {
  pageId: string
  userId?: string
  userName?: string
  userColor?: string
  onTextUpdate?: (text: string) => void
}

export function TipTapEditor({
  pageId,
  userId = 'anonymous',
  userName = 'Anonymous',
  userColor = '#3b82f6',
  onTextUpdate,
}: TipTapEditorProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
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
      MentionExtension,
      ImageUpload,
      CodeBlockHighlight,
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none focus:outline-none min-h-[var(--page-min-height)] p-16',
      },
    },
    onUpdate({ editor: e }) {
      onTextUpdate?.(e.getText())
    },
  }, [ydoc, provider])

  useBehaviorTracker({ editor, pageId, userId })

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
    <div className="flex flex-col items-center gap-4">
      {/* Status + Presence */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              status === 'connected'
                ? 'bg-green-500'
                : status === 'connecting'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            aria-hidden="true"
          />
          <span>{status === 'connected' ? '接続済み' : status === 'connecting' ? '接続中...' : '切断'}</span>
        </div>
        <PresenceBar provider={provider} />
      </div>
      <TypingIndicator provider={provider} />

      {/* A4 Page */}
      <div className="w-full max-w-[var(--page-width)] min-h-[var(--page-min-height)] bg-white shadow-lg border border-neutral-200 rounded-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
