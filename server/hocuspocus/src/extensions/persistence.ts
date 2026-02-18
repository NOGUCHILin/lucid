import { Database } from '@hocuspocus/extension-database'
import { supabase } from '../supabase'

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
