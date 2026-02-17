'use client'

import { useEffect } from 'react'

interface Shortcuts {
  onSearch?: () => void
  onNewPage?: () => void
  onToggleSidebar?: () => void
  onToggleAgent?: () => void
}

export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return

      if (e.key === 'k' && shortcuts.onSearch) {
        e.preventDefault()
        shortcuts.onSearch()
      }
      if (e.key === 'n' && shortcuts.onNewPage) {
        e.preventDefault()
        shortcuts.onNewPage()
      }
      if (e.key === 'b' && shortcuts.onToggleSidebar) {
        e.preventDefault()
        shortcuts.onToggleSidebar()
      }
      if (e.key === '.' && shortcuts.onToggleAgent) {
        e.preventDefault()
        shortcuts.onToggleAgent()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [shortcuts])
}
