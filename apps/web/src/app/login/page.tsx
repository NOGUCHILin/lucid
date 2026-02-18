'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient as createBrowserClient } from '@lucid/database/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteValid, setInviteValid] = useState<boolean | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient()

  // URLから招待コードを取得
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setInviteCode(code)
      setMode('signup')
      verifyInviteCode(code)
    }
  }, [searchParams])

  async function verifyInviteCode(code: string) {
    if (!code || code.length < 4) {
      setInviteValid(null)
      setInviteError(null)
      return
    }
    try {
      const res = await fetch('/api/invitations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      setInviteValid(data.valid)
      if (!data.valid) {
        const reasons: Record<string, string> = {
          not_found: '招待コードが見つかりません',
          already_used: 'この招待コードは既に使用されています',
          expired: 'この招待コードは期限切れです',
        }
        setInviteError(reasons[data.reason] || '無効な招待コードです')
      } else {
        setInviteError(null)
      }
    } catch {
      setInviteValid(null)
      setInviteError('検証に失敗しました')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'signup') {
      // 招待コードの検証
      if (!inviteCode) {
        setError('招待コードが必要です')
        setLoading(false)
        return
      }
      if (inviteValid === false) {
        setError('無効な招待コードです')
        setLoading(false)
        return
      }

      // signUp with invite code in metadata
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { invite_code: inviteCode } },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // 招待コード使用をマーク
      if (signUpData.user) {
        await fetch('/api/invitations/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: inviteCode, userId: signUpData.user.id }),
        })
      }
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) {
        setError(loginError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Lucid</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </p>
          {mode === 'signup' && (
            <p className="text-xs text-muted-foreground mt-1">
              招待制アプリケーションです
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <Input
                type="text"
                placeholder="招待コード"
                aria-label="招待コード"
                value={inviteCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase()
                  setInviteCode(val)
                  if (val.length >= 8) verifyInviteCode(val)
                  else { setInviteValid(null); setInviteError(null) }
                }}
                required
                className={
                  inviteValid === true
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : inviteValid === false
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : ''
                }
              />
              {inviteValid === true && (
                <p className="text-xs text-green-600 mt-1">有効な招待コードです</p>
              )}
              {inviteError && (
                <p className="text-xs text-red-500 mt-1">{inviteError}</p>
              )}
            </div>
          )}

          <Input
            type="email"
            placeholder="メールアドレス"
            aria-label="メールアドレス"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="パスワード"
            aria-label="パスワード"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (mode === 'signup' && inviteValid === false)}
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : '登録'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'login' ? (
            <>
              招待コードをお持ちの方は{' '}
              <button className="underline" onClick={() => setMode('signup')}>
                新規登録
              </button>
            </>
          ) : (
            <>
              アカウントをお持ちの方は{' '}
              <button className="underline" onClick={() => setMode('login')}>
                ログイン
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
