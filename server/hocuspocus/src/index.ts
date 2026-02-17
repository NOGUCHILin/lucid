import 'dotenv/config'
import { Server } from '@hocuspocus/server'
import { createClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { authExtension } from './extensions/auth'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const enableAuth = !!supabaseServiceKey

const supabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

const server = new Server({
  port: 1234,
  name: 'lucid-hocuspocus',
  extensions: enableAuth ? [authExtension] : [],

  async onLoadDocument({ document, documentName }) {
    if (!supabase) return

    const { data } = await supabase
      .from('pages')
      .select('content_snapshot')
      .eq('id', documentName)
      .single()

    if (data?.content_snapshot) {
      try {
        const snapshot = Buffer.from(data.content_snapshot, 'base64')
        Y.applyUpdate(document, new Uint8Array(snapshot))
      } catch (e) {
        console.error(`[onLoadDocument] snapshot broken for ${documentName}, starting fresh`)
      }
    }
  },

  async onStoreDocument({ document, documentName }) {
    if (!supabase) return

    const snapshot = Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64')

    await supabase
      .from('pages')
      .update({ content_snapshot: snapshot })
      .eq('id', documentName)
  },

  async onConnect({ documentName }) {
    console.log(`[connect] ${documentName}`)
  },

  async onDisconnect({ documentName }) {
    console.log(`[disconnect] ${documentName}`)
  },
})

server.listen().then(() => {
  console.log(`Hocuspocus running on ws://127.0.0.1:1234`)
})
