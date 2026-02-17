import 'dotenv/config'
import { Server } from '@hocuspocus/server'
import { authExtension } from './extensions/auth'
import { persistenceExtension } from './extensions/persistence'
import { agentBridgeExtension } from './extensions/agent-bridge'
import { setHocuspocusInstance } from './agent-writer'

const enableAuth = !!process.env.SUPABASE_SERVICE_ROLE_KEY

export const server = new Server({
  port: 1234,
  name: 'lucid-hocuspocus',
  extensions: [
    persistenceExtension,
    agentBridgeExtension,
    ...(enableAuth ? [authExtension] : []),
  ],
})

server.listen().then(() => {
  // @ts-expect-error Server内部のHocuspocusインスタンスにアクセス
  setHocuspocusInstance(server.hocuspocus)
  console.log(`Hocuspocus running on ws://127.0.0.1:1234`)
})
