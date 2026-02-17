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
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCaret.configure({
        provider,
        user: { name: userName, color: userColor },
      }),
      ApprovalCard,
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

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
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
        <span>{status === 'connected' ? '接続中' : status === 'connecting' ? '接続中...' : '切断'}</span>
      </div>

      {/* A4 Page */}
      <div className="w-full max-w-[var(--page-width)] min-h-[var(--page-min-height)] bg-white shadow-lg border border-neutral-200 rounded-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
