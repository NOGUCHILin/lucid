import Mention from '@tiptap/extension-mention'
import { type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion'

interface MentionItem {
  id: string
  name: string
  email: string
  isAgent?: boolean
}

// エージェント候補を保持するグローバル変数（configure時に設定）
let _agentId: string | null = null
let _agentName: string = 'Agent'

// Simple suggestion config: fetches users from API + agent
const suggestion: Partial<SuggestionOptions<MentionItem>> = {
  items: async ({ query }) => {
    if (!query || query.length < 1) return []
    const results: MentionItem[] = []

    // エージェント候補
    if (_agentId && 'agent'.startsWith(query.toLowerCase())) {
      results.push({ id: _agentId, name: _agentName, email: '', isAgent: true })
    }

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const users = await res.json()
        results.push(...users)
      }
    } catch { /* ignore */ }
    return results
  },
  render: () => {
    let popup: HTMLDivElement | null = null

    return {
      onStart: (props) => {
        popup = document.createElement('div')
        popup.className = 'mention-popup absolute z-50 rounded-lg border bg-white shadow-lg p-1 text-sm'
        document.body.appendChild(popup)
        updatePopup(popup, props)
      },
      onUpdate: (props) => {
        if (popup) updatePopup(popup, props)
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          popup?.remove()
          popup = null
          return true
        }
        return false
      },
      onExit: () => {
        popup?.remove()
        popup = null
      },
    }
  },
}

function updatePopup(popup: HTMLDivElement, props: SuggestionProps<MentionItem>) {
  const { items, command, clientRect } = props
  popup.innerHTML = ''

  if (!items.length) {
    popup.style.display = 'none'
    return
  }

  popup.style.display = 'block'
  const rect = clientRect?.()
  if (rect) {
    popup.style.top = `${rect.bottom + window.scrollY + 4}px`
    popup.style.left = `${rect.left + window.scrollX}px`
  }

  items.forEach((item: MentionItem) => {
    const btn = document.createElement('button')
    btn.className = 'block w-full rounded px-3 py-1.5 text-left hover:bg-neutral-100'
    if (item.isAgent) {
      btn.innerHTML = `<span class="text-violet-600 font-medium">${item.name}</span> <span class="text-xs text-neutral-400">AI</span>`
    } else {
      btn.textContent = item.name || item.email || item.id
    }
    btn.addEventListener('click', () => command({ id: item.id, label: item.name || item.email }))
    popup.appendChild(btn)
  })
}

export function createMentionExtension(agentId?: string | null, agentName?: string) {
  _agentId = agentId || null
  _agentName = agentName || 'Agent'
  return Mention.configure({
    HTMLAttributes: {
      class: 'mention bg-blue-100 text-blue-800 rounded px-1',
    },
    suggestion,
  })
}

/** 後方互換: agentなしデフォルト */
export const MentionExtension = Mention.configure({
  HTMLAttributes: {
    class: 'mention bg-blue-100 text-blue-800 rounded px-1',
  },
  suggestion,
})
