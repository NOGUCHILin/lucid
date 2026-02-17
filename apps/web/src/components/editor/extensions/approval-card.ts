import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ApprovalCardView } from '../ApprovalCardView'

export const ApprovalCard = Node.create({
  name: 'approvalCard',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      requestId: { default: null },
      agentId: { default: null },
      suggestion: { default: '' },
      intent: { default: 'unknown' },
      status: { default: 'pending' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-approval-card]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-approval-card': '', ...HTMLAttributes }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ApprovalCardView)
  },
})
