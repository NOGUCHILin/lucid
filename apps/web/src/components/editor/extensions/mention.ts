import Mention from '@tiptap/extension-mention'
import { type SuggestionOptions } from '@tiptap/suggestion'

// Simple suggestion config: fetches users from API
const suggestion: Partial<SuggestionOptions> = {
  items: async ({ query }) => {
    if (!query || query.length < 1) return []
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
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

function updatePopup(popup: HTMLDivElement, props: any) {
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

  items.forEach((item: any) => {
    const btn = document.createElement('button')
    btn.className = 'block w-full rounded px-3 py-1.5 text-left hover:bg-neutral-100'
    btn.textContent = item.name || item.email || item.id
    btn.addEventListener('click', () => command({ id: item.id, label: item.name || item.email }))
    popup.appendChild(btn)
  })
}

export const MentionExtension = Mention.configure({
  HTMLAttributes: {
    class: 'mention bg-blue-100 text-blue-800 rounded px-1',
  },
  suggestion,
})
