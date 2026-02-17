'use client'

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'

export function ApprovalCardView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const { requestId, suggestion, intent, status } = node.attrs as {
    requestId: string
    agentId: string
    suggestion: string
    intent: string
    status: string
  }
  const [loading, setLoading] = useState(false)

  const handleAction = async (action: 'approved' | 'rejected') => {
    setLoading(true)
    try {
      await fetch(`/api/approval-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })
      updateAttributes({ status: action })
      if (action === 'rejected') {
        setTimeout(deleteNode, 1000)
      }
    } finally {
      setLoading(false)
    }
  }

  const intentLabel: Record<string, string> = {
    stuck: '行き詰まり検出',
    searching: '探索中',
    unknown: '提案',
  }

  return (
    <NodeViewWrapper contentEditable={false}>
      <div className="my-4 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-sm text-blue-600">
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium">
            AI {intentLabel[intent] || intent}
          </span>
        </div>

        <p className="mb-3 text-sm text-neutral-700">{suggestion}</p>

        {status === 'pending' ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => handleAction('approved')}
              disabled={loading}
            >
              <Check className="mr-1 size-3" />
              承認
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('rejected')}
              disabled={loading}
            >
              <X className="mr-1 size-3" />
              却下
            </Button>
          </div>
        ) : (
          <span className={`text-xs ${status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
            {status === 'approved' ? '承認済み' : '却下済み'}
          </span>
        )}
      </div>
    </NodeViewWrapper>
  )
}
