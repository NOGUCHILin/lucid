'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useEffect, useMemo, useState } from 'react'

interface TipTapEditorProps {
  pageId: string
  userName?: string
  userColor?: string
  onTextUpdate?: (text: string) => void
}

export function TipTapEditor({
  pageId,
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
        undoRedo: false, // Collaboration handles undo/redo
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCaret.configure({
        provider,
        user: { name: userName, color: userColor },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none focus:outline-none min-h-[1123px] p-16',
      },
    },
    onUpdate({ editor: e }) {
      onTextUpdate?.(e.getText())
    },
  })

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div
          className={`h-2 w-2 rounded-full ${
            status === 'connected'
              ? 'bg-green-500'
              : status === 'connecting'
                ? 'bg-yellow-500'
                : 'bg-red-500'
          }`}
        />
        <span>{status === 'connected' ? '接続中' : status === 'connecting' ? '接続中...' : '切断'}</span>
      </div>

      {/* A4 Page */}
      <div className="w-[794px] min-h-[1123px] bg-white shadow-lg border border-neutral-200 rounded-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
