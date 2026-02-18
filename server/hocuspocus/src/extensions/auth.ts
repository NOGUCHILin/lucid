import { Extension, onAuthenticatePayload } from '@hocuspocus/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from '../supabase'

export const authExtension: Extension = {
  async onAuthenticate({ token }: onAuthenticatePayload) {
    // トークンなし → 開発用ユーザーとして許可
    if (!token || !supabaseKey) {
      return { user: { name: 'dev-user', id: 'dev' } }
    }

    // 認証時はトークン検証のため毎回新しいクライアントを使用
    const supabase = createClient(supabaseUrl, supabaseKey)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new Error('認証に失敗しました')
    }

    return {
      user: {
        id: user.id,
        name: user.email ?? 'Anonymous',
      },
    }
  },
}
