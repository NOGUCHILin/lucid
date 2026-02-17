import { Database } from '@hocuspocus/extension-database'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

export const persistenceExtension = new Database({
  async fetch({ documentName }) {
    if (!supabase) return null

    const { data } = await supabase
      .from('pages')
      .select('content_snapshot')
      .eq('id', documentName)
      .single()

    if (data?.content_snapshot) {
      try {
        const snapshot = Buffer.from(data.content_snapshot, 'base64')
        return new Uint8Array(snapshot)
      } catch {
        console.error(`[persistence] snapshot broken for ${documentName}`)
      }
    }

    return null
  },

  async store({ documentName, state }) {
    if (!supabase) return

    // content_snapshot は TEXT カラム → base64 で保存
    const snapshot = Buffer.from(state).toString('base64')

    const { error } = await supabase
      .from('pages')
      .update({ content_snapshot: snapshot })
      .eq('id', documentName)

    if (error) {
      console.error(`[persistence] store error: ${error.message}`)
    }
  },
})
