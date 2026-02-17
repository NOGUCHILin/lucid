'use client'

import { useState } from 'react'
import { createClient as createBrowserClient } from '@lucid/database/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

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
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : '登録'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'login' ? (
            <>
              アカウントがない方は{' '}
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
