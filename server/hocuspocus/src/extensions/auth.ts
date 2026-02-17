import { Extension, onAuthenticatePayload } from '@hocuspocus/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const authExtension: Extension = {
  async onAuthenticate({ token }: onAuthenticatePayload) {
    // トークンなし → 開発用ユーザーとして許可
    if (!token || !supabaseServiceKey) {
      return { user: { name: 'dev-user', id: 'dev' } }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
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
