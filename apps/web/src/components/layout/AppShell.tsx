'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'
import { useIsMobile } from '@/hooks/useIsMobile'

const HIDDEN_PATHS = ['/login']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // localStorage永続化
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  // ページ遷移時にSheetを閉じる
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const hideSidebar = HIDDEN_PATHS.includes(pathname)

  if (hideSidebar) return <>{children}</>

  if (isMobile) {
    return (
      <div className="flex flex-col h-dvh overflow-hidden">
        <header className="shrink-0 z-40 flex items-center h-12 px-3 border-b bg-white/95 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <Link href="/" className="font-bold text-lg ml-2">Lucid</Link>
        </header>
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetTitle className="sr-only">ナビゲーション</SheetTitle>
            <Sidebar collapsed={false} onToggle={() => setSidebarOpen(false)} onNavigate={() => setSidebarOpen(false)} inSheet />
          </SheetContent>
        </Sheet>
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
