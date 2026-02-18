'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, Plus, UserCheck, Clock, XCircle } from 'lucide-react'

interface Invitation {
  id: string
  code: string
  used_by: string | null
  used_at: string | null
  expires_at: string
  created_at: string
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchInvitations = useCallback(async () => {
    const res = await fetch('/api/invitations')
    if (res.ok) {
      const data = await res.json()
      setInvitations(data.invitations || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchInvitations() }, [fetchInvitations])

  async function createInvitation() {
    setCreating(true)
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInDays: 7 }),
    })
    if (res.ok) await fetchInvitations()
    setCreating(false)
  }

  function copyInviteLink(invitation: Invitation) {
    const url = `${window.location.origin}/invite/${invitation.code}`
    navigator.clipboard.writeText(url)
    setCopiedId(invitation.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function getStatus(inv: Invitation): { label: string; icon: React.ReactNode; color: string } {
    if (inv.used_by) return { label: '使用済み', icon: <UserCheck className="size-3.5" />, color: 'text-blue-600' }
    if (new Date(inv.expires_at) < new Date()) return { label: '期限切れ', icon: <XCircle className="size-3.5" />, color: 'text-muted-foreground' }
    return { label: '有効', icon: <Clock className="size-3.5" />, color: 'text-green-600' }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>招待管理</CardTitle>
          <CardDescription>招待コードを発行してユーザーを招待できます</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={createInvitation} disabled={creating} size="sm">
            <Plus className="size-3.5 mr-1.5" />
            {creating ? '作成中...' : '新しい招待コードを作成'}
          </Button>

          {loading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ招待コードがありません</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => {
                const status = getStatus(inv)
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between border rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <code className="font-mono text-sm font-medium bg-neutral-100 px-2 py-1 rounded">
                        {inv.code}
                      </code>
                      <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(inv.created_at)}
                      </span>
                      {!inv.used_by && new Date(inv.expires_at) >= new Date() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => copyInviteLink(inv)}
                        >
                          {copiedId === inv.id ? (
                            <Check className="size-3.5 text-green-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
